#!/usr/bin/env node
'use strict';

// Final legacy mip bits: LINEARMIPNEAREST (0x10), LINEARMIPLINEAR (0x20).
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
      assert.equal(mask & 4, 0, 'MIPNEAREST remains absent');
      assert.equal(mask & 8, 0, 'previous mip correction retained');
      assert.equal(mask & 0x10, 0, 'unsupported LINEARMIPNEAREST advertised');
      assert.equal(mask & 0x20, 0, 'unsupported LINEARMIPLINEAR advertised');
      assert.equal(mask & 0x30000, 0, 'stage mip flags remain absent');
      for (const bit of [1, 2])
        assert.equal(mask & bit, bit, 'retained point/linear bit');
      assert.equal(mask, offsets[0] === 40 ? 0x030003c3 : 0xc3, 'only final two mip bits change');
      checks++;
    }
  }
  for (const p of [512, 513]) {
    guarded(p, 56, () => e.fill_primcaps(p));
    caps(p, [36]);
    const expected = [56, 0x3f, 0x7ff, 0xff, 0x1fff, 0x1fff, 0xff, 0x1ffff,
      0xf7df, 0xc3, 0xffff, 0xf7, 1, 1];
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
    assert.equal(get(p + 180), 0xf, 'texture ops: DISABLE/SELECTARG1/SELECTARG2/MODULATE');
    guarded(p, 236, () => e.d3dim_fill_device_desc7(p));
    caps(p, [40, 96]);
  }
  return { e, checks };
}

// Run verbatim filter-selection statements from the two production paths.
// Only the surrounding state storage and unrelated fog dependency are fixtures.
// Pixel fetch, format decode, addressing, and filtering are production WAT.
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
  const descriptor = between(extract(source.replace('(func (export "d3dim_gpu_describe")',
    '(func $d3dim_gpu_describe'), 'd3dim_gpu_describe'), ';; Filter: stage MAGFILTER,',
    '    (i32.store offset=108');
  const pieces = ['d3dim_address_texel', 'd3dim_texture_sample_keyed', 'd3dim_bilerp',
    'd3dim_texture_fetch_keyed', 'd3dim_texture_fetch_prepared',
    'd3dim_decode_surface_pixel_fmt', 'd3dim_expand5', 'd3dim_expand6']
    .map(n => `${extract(source, n)}\n(export "${n}" (func $${n}))`).join('\n');
  const compiled = compile(`
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
  const e = new WebAssembly.Instance(new WebAssembly.Module(compiled.wasmBinary)).exports;
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
  // Legacy D3DFILTER: NEAREST=1, LINEAR=2, LINEARMIPNEAREST=5, LINEARMIPLINEAR=6.
  // Values 5/6 are tested only in legacy state: stage filter enums differ.
  // Exercise each fallback source, including nonzero stage MIPFILTER=2.
  for (const slot of [16 * 4, 17 * 4, 324, 328]) {
    for (const filter of (slot < 324 ? [1, 2] : [1, 2, 5, 6])) {
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
        // Distinguishable images representing two levels, each bound explicitly.
        // This is not automatic LOD selection; the sampler has no LOD/chain input.
        for (const [width, ptr, point, bilinear] of [
          [4, 8192, 0xff000000, 0xff7f7f7f],
          [2, 12288, 0xffff0000, 0xff7f007f],
        ]) {
          for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
            const colors = ptr === 8192 ? [0xff000000, 0xffffffff] : [0xffff0000, 0xff0000ff];
            put(ptr + 4 * (y * width + x), colors[(x + y) & 1]);
          }
          const color = e.d3dim_texture_sample_keyed(
            width, width, 32, width * 4, ptr, 0, 0, 0, 0.5, 0.5, 1, 1, linear, 0, 0) >>> 0;
          assert.equal(color, linear ? bilinear : point, 'point/bilinear sample');
          if (filter === 5 || filter === 6) {
            assert.equal(color, point, 'both final mip requests collapse to one image point sampling');
            assert.notEqual(color, bilinear, 'LINEARMIPLINEAR lacks within-level bilinear filtering');
            // At fractional LOD 0.5, point samples black/red would blend to dark red.
            // Bilinear gray/purple would blend to a third color. Neither is available:
            // the actual function accepts one image, no chain or fractional LOD.
            assert.notEqual(color, 0xff7f0000, 'no between-level point interpolation');
            assert.notEqual(color, 0xff7f3f7f, 'no between-level bilinear interpolation');
          }
        }
        cases++;
      }
    }
  }
  return cases;
}

const cases = backendContract(core, gpu);
console.log(`Backend PASS: ${cases} state cases; actual WAT pixel fetch/decode and two bound images; filters 5/6 point-only, GPU mip disabled.`);
const { checks } = contract(dx);
const fixed = '(i32.const 0xC3))     ;; dwTextureFilterCaps';
assert.equal(dx.split(fixed).length, 2);
for (const [mask, error] of [
  ['0xD3', /unsupported LINEARMIPNEAREST advertised/],
  ['0xE3', /unsupported LINEARMIPLINEAR advertised/],
  ['0xF3', /unsupported LINEARMIPNEAREST advertised/],
  ['0xC2', /retained point\/linear bit/],
  ['0xC1', /retained point\/linear bit/],
  ['0x03', /only final two mip bits change/],
]) assert.throws(() => contract(dx.replace(fixed,
  `(i32.const ${mask}))     ;; dwTextureFilterCaps`)), error);
assert.throws(() => backendContract(core, gpu.replace('mip: 0', 'mip: 1')),
  /GPU has no mip selection/);
const selection = '(i32.eq (local.get $filter) (i32.const 2))';
for (const value of [5, 6]) assert.throws(() => backendContract(core.replaceAll(selection,
  `(i32.or ${selection} (i32.eq (local.get $filter) (i32.const ${value})))`), gpu),
  /software filter selection|GPU descriptor filter selection/);
const pixelLoad = '(i32.load (i32.add (local.get $ptr) (i32.shl (local.get $tx) (i32.const 2))))';
assert(core.includes(pixelLoad));
assert.throws(() => backendContract(core.replace(pixelLoad, '(i32.const 0)'), gpu),
  /point\/bilinear sample/);
console.log(`PASS: ${checks} descriptor fields; ${cases} backend cases; 10 mutation negatives. Extracted-source only.`);
