#!/usr/bin/env node
'use strict';

// Extracted production source only; no fullVM, guest or GPU rendering.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { compile } = require('../tools/watx');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const dx = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8')
  : read('src/09a8-handlers-directx.wat');
const core = read('src/09ab-handlers-d3dim-core.wat');
const handlers = read('src/09aa-handlers-d3dim.wat');
const gpu = read('lib/d3dim-gpu.js');

function extract(source, name) {
  const matches = [...source.matchAll(new RegExp(`\\(func \\$${name}\\s`, 'g'))];
  assert.equal(matches.length, 1, `unique ${name}`);
  const start = matches[0].index;
  let depth = 0, comment = false;
  for (let i = start; i < source.length; i++) {
    if (comment) {
      if (source[i] === '\n') comment = false;
      else continue;
    }
    if (source.slice(i, i + 2) === ';;') { comment = true; i++; continue; }
    assert(source.slice(i, i + 2) !== '(;' && source[i] !== '"', 'unsupported extraction syntax');
    if (source[i] === '(') depth++;
    if (source[i] === ')' && --depth === 0) return source.slice(start, i + 1);
  }
  assert.fail(`unbalanced ${name}`);
}

function build(source) {
  const pieces = [
    ...['fill_primcaps', 'fill_d3d_device_desc', 'handle_IDirect3DDevice3_GetCaps']
      .map(n => [n, extract(source, n)]),
    ...['d3dim_fill_device_desc', 'd3dim_fill_device_desc7', 'd3dim_address_texel']
      .map(n => [n, extract(core, n)]),
    ...['', '2', '7'].map(v => {
      const n = `handle_IDirect3DDevice${v}_GetCaps`;
      return [n, extract(handlers, n)];
    }),
  ];
  const result = compile(`
    (memory 1) (export "memory" (memory 0))
    (global $reg_base i32 (i32.const 64))
    (func $g2w (param $p i32) (result i32) (local.get $p))
    (func $gl32 (param $p i32) (result i32) (i32.load (local.get $p)))
    (func $gs32 (param $p i32) (param $v i32) (i32.store (local.get $p) (local.get $v)))
    (func $zero_memory (param $p i32) (param $n i32)
      (memory.fill (local.get $p) (i32.const 0) (local.get $n)))
    ${pieces.map(([n, body]) => `${body}\n(export "${n}" (func $${n}))`).join('\n')}
  `, new Map(), { mode: 'production' });
  assert(result.wasmBinary, 'extracted functions compile');
  return new WebAssembly.Instance(new WebAssembly.Module(result.wasmBinary)).exports;
}

function contract(source) {
  // Enumeration callback execution is outside this harness; assert its wiring.
  for (const [producer, builder, count] of [
    ['d3d_enum_devices_dispatch', 'fill_d3d_device_desc', 2],
    ['d3d_enum_devices7_dispatch', 'd3dim_fill_device_desc7', 1],
  ]) {
    assert.equal(extract(source, producer).replace(/;;[^\n]*/g, '')
      .split(`(call $${builder} `).length - 1, count, 'enumeration builder wiring');
  }
  const e = build(source), view = new DataView(e.memory.buffer);
  const bytes = new Uint8Array(e.memory.buffer);
  const get = p => view.getUint32(p, true);
  const put = (p, v) => view.setUint32(p, v, true);
  let checks = 0;
  function guarded(p, size, action) {
    bytes.fill(0xa5, p - 4, p + size + 4);
    action();
    assert.equal(get(p - 4), 0xa5a5a5a5, 'leading guard');
    assert.equal(get(p + size), 0xa5a5a5a5, 'trailing guard');
  }
  function caps(p, offsets) {
    for (const offset of offsets) {
      const mask = get(p + offset);
      assert.equal(mask & 4, 0, 'unsupported MIPNEAREST advertised');
      for (const bit of [1, 2])
        assert.equal(mask & bit, bit, 'retained point/linear bit');
      assert.equal(mask, offsets[0] === 40 ? 0x030003fb : 0xfb, 'only MIPNEAREST changes');
      checks++;
    }
  }
  for (const p of [512, 513]) {
    guarded(p, 56, () => e.fill_primcaps(p));
    caps(p, [36]);
    const expected = [56, 0x3f, 0x7ff, 0xff, 0x1fff, 0x1fff, 0xff, 0x1ffff,
      get(p + 32), 0xfb, 0xffff, get(p + 44), 1, 1];
    // The independently owned cube fix may change texture caps, never address caps.
    assert([0xffdf, 0xf7df].includes(expected[8]), 'base or pending cube correction');
    assert([0xff, 0xf7].includes(expected[11]), 'base or pending border correction');
    assert.deepEqual(expected.map((_, i) => get(p + i * 4)), expected);
    for (const hal of [0, 1]) {
      guarded(p, 252, () => e.fill_d3d_device_desc(p, hal));
      caps(p, [80, 136]);
    }
    for (const version of ['', '2', '3']) {
      for (const size of [172, 204, 252]) {
        const hel = p + 512;
        guarded(p, size, () => {
          put(p, size);
          guarded(hel, size, () => {
            put(hel, size); put(80, 4096);
            e[`handle_IDirect3DDevice${version}_GetCaps`](0, p, hel, 0, 0, 0);
          });
        });
        assert.equal(get(64), 0); assert.equal(get(80), 4112);
        caps(p, [80, 136]); caps(hel, [80, 136]);
      }
    }
    guarded(p, 236, () => {
      put(80, 4096);
      e.handle_IDirect3DDevice7_GetCaps(0, p, 0, 0, 0, 0);
    });
    assert.equal(get(64), 0); assert.equal(get(80), 4108);
    caps(p, [40, 96]);
    assert.equal(get(p + 180), 0x3ff, 'texture ops unchanged');
    guarded(p, 236, () => e.d3dim_fill_device_desc7(p));
    caps(p, [40, 96]);
  }
  return { e, checks };
}

// Run verbatim filter-selection statements from the two production paths.
// Only the surrounding state storage and unrelated fog dependency are fixtures.
function between(source, first, last) {
  const start = source.indexOf(first);
  assert(start >= 0 && source.indexOf(first, start + 1) < 0, `unique start ${first}`);
  const end = source.indexOf(last, start);
  assert(end > start, `end ${last}`);
  return source.slice(start, end);
}
function backendContract(source, gpuSource) {
  const draw = extract(source, 'd3dim_draw_tl_triangle_textured');
  const start = '(local.set $filter (call $d3dim_tss_load (local.get $state) (i32.const 0) (i32.const 16)))';
  const software = between(draw, start, '\n    ;; The white texel');
  // The final two closes belong to the enclosing production if/then.
  assert(software.trimEnd().endsWith('))))))'));
  const sw = software.trimEnd().slice(0, -2);
  const descriptor = between(source, ';; Filter: stage MAGFILTER,',
    '    (i32.store offset=108');
  const pieces = ['d3dim_address_texel', 'd3dim_texture_sample_keyed', 'd3dim_bilerp']
    .map(n => `${extract(source, n)}\n(export "${n}" (func $${n}))`).join('\n');
  const compiled = compile(`
    (import "fixture" "fetch" (func $d3dim_texture_fetch_keyed
      (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)))
    (memory 1) (export "memory" (memory 0))
    (func $gl32 (param $p i32) (result i32) (i32.load (local.get $p)))
    (func $d3dim_tss_load (param $s i32) (param $stage i32) (param $type i32) (result i32)
      (i32.load (i32.add (local.get $s) (i32.mul (local.get $type) (i32.const 4)))))
    (func $d3dim_vertex_fog_on (param i32) (result i32) (i32.const 0))
    (func (export "software") (param $state i32) (result i32)
      (local $filter i32) (local $shade i32) (local $fog i32) (local $this i32) (local $linear i32)
      ${sw} (local.get $linear))
    (func (export "descriptor") (param $state i32) (param $out i32)
      (local $filter i32) ${descriptor})
    ${pieces}
  `, new Map(), { mode: 'production' });
  assert(compiled.wasmBinary);
  const taps = [];
  const e = new WebAssembly.Instance(new WebAssembly.Module(compiled.wasmBinary), {
    fixture: { fetch: (...args) => {
      taps.push(args);
      const [, , ptr, , , , x, y] = args;
      assert.equal(ptr, 8192, 'sampler stays on bound image');
      return [0xff000000, 0xffffffff, 0xffffffff, 0xff000000][y * 2 + x] | 0;
    } },
  }).exports;
  const view = new DataView(e.memory.buffer);
  const put = (p, v) => view.setUint32(p, v, true);
  // Execute the actual JS sampler assignment (no graphics context).
  const lowering = between(gpuSource, 'const filter = d.linear ?',
    '\n        textures.push(image);');
  const addressDecl = gpuSource.match(/const address = ([^;\n]+);/g);
  assert.equal(addressDecl?.length, 1);
  const lower = vm.runInNewContext(`(d => {
    ${addressDecl[0]} const image = {}; ${lowering} return image.sampler;
  })`);
  let cases = 0;
  // D3DFILTER_NEAREST=1, LINEAR=2, MIPNEAREST=3 (not cap bit 4).
  // Exercise each fallback source, including nonzero stage MIPFILTER=2.
  for (const slot of [16 * 4, 17 * 4, 324, 328]) {
    for (const filter of [1, 2, 3]) {
      for (const mip of [0, 1, 2]) {
        new Uint8Array(e.memory.buffer).fill(0);
        put(1024 + slot, filter); put(1024 + 18 * 4, mip);
        const linear = e.software(1024);
        assert.equal(linear, filter === 2 ? 1 : 0, 'software filter selection');
        e.descriptor(1024, 4096);
        assert.equal(view.getUint32(4200, true), linear, 'GPU descriptor filter selection');
        const sampler = lower({ linear, addressU: 1, addressV: 3 });
        assert.equal(sampler.mag, filter === 2 ? 2 : 1);
        assert.equal(sampler.min, filter === 2 ? 2 : 1);
        assert.equal(sampler.mip, 0, 'GPU has no mip selection');
        taps.length = 0;
        const color = e.d3dim_texture_sample_keyed(
          2, 2, 32, 8, 8192, 0, 0, 0, 0.5, 0.5, 1, 1, linear, 0, 0) >>> 0;
        assert.equal(taps.length, linear ? 4 : 1, 'single image footprint');
        assert.equal(color, linear ? 0xff7f7f7f : 0xff000000, 'point/bilinear sample');
        cases++;
      }
    }
  }
  return cases;
}

const { checks } = contract(dx);
const cases = backendContract(core, gpu);
const fixed = '(i32.const 0xFB))     ;; dwTextureFilterCaps';
assert.equal(dx.split(fixed).length, 2);
for (const [mask, error] of [
  ['0xFF', /unsupported MIPNEAREST advertised/],
  ['0xFA', /retained point\/linear bit/],
  ['0xF9', /retained point\/linear bit/],
  ['0x03', /only MIPNEAREST changes/],
]) assert.throws(() => contract(dx.replace(fixed,
  `(i32.const ${mask}))     ;; dwTextureFilterCaps`)), error);
assert.throws(() => backendContract(core, gpu.replace('mip: 0', 'mip: 1')),
  /GPU has no mip selection/);
const selection = '(i32.eq (local.get $filter) (i32.const 2))';
assert.throws(() => backendContract(core.replaceAll(selection,
  '(i32.eq (local.get $filter) (i32.const 3))'), gpu), /software filter selection|GPU descriptor filter selection/);
// Composition only, without applying either previously completed correction.
contract(dx.replace('(i32.const 0xFFDF)', '(i32.const 0xF7DF)')
  .replace('(i32.const 0xFF))     ;; dwTextureAddressCaps',
    '(i32.const 0xF7))     ;; dwTextureAddressCaps'));
console.log(`PASS: ${checks} descriptor filter fields; ${cases} extracted software/GPU filter cases; ` +
  'point/bilinear footprints; 6 mutation negatives; pending cube+border composition. Source-only.');
