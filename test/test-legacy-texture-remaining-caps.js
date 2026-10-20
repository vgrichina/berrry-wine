#!/usr/bin/env node
'use strict';

// Local extracted-source conformance only: no guest, COM dispatch, GPU, or
// rendering execution. SDK d3dcaps.h: BORDER=8, WRAP=1, MIRROR=2, CLAMP=4,
// INDEPENDENTUV=16. See docs/legacy-texture-remaining-caps-20261020.md.
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
      assert.equal(mask & 8, 0, 'unsupported BORDER advertised');
      for (const bit of [1, 2, 4, 16])
        assert.equal(mask & bit, bit, 'retained supported address bit');
      assert.equal(mask, 0xf7, 'only BORDER changes, including reserved bits');
      checks++;
    }
  }
  for (const p of [512, 513]) {
    guarded(p, 56, () => e.fill_primcaps(p));
    caps(p, [44]);
    const expected = [56, 0x3f, 0x7ff, 0xff, 0x1fff, 0x1fff, 0xff, 0x1ffff,
      get(p + 32), 0xff, 0xffff, 0xf7, 1, 1];
    // The independently owned cube fix may change texture caps, never address caps.
    assert([0xffdf, 0xf7df].includes(expected[8]), 'base or pending cube correction');
    assert.deepEqual(expected.map((_, i) => get(p + i * 4)), expected);
    for (const hal of [0, 1]) {
      guarded(p, 252, () => e.fill_d3d_device_desc(p, hal));
      caps(p, [88, 144]);
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
        caps(p, [88, 144]); caps(hel, [88, 144]);
      }
    }
    guarded(p, 236, () => {
      put(80, 4096);
      e.handle_IDirect3DDevice7_GetCaps(0, p, 0, 0, 0, 0);
    });
    assert.equal(get(64), 0); assert.equal(get(80), 4108);
    caps(p, [48, 104]);
    assert.equal(get(p + 40), 0x030003ff, 'line filters unchanged');
    assert.equal(get(p + 96), 0x030003ff, 'triangle filters unchanged');
    assert.equal(get(p + 180), 0x3ff, 'texture ops unchanged');
    guarded(p, 236, () => e.d3dim_fill_device_desc7(p));
    caps(p, [48, 104]);
  }
  return { e, checks };
}

const { e, checks } = contract(dx);
// Actual software address helper: edge/outside, negative coordinates,
// power-of-two and non-power-of-two textures. Independent U/V calls are wired
// in the sampler; this is not an assertion of rendered pixel correctness.
const address = e.d3dim_address_texel;
for (const size of [3, 4]) {
  for (const i of [-9, -5, -1, 0, 1, size - 1, size, size + 1, 9]) {
    const wrap = ((i % size) + size) % size;
    const period = ((i % (2 * size)) + 2 * size) % (2 * size);
    assert.equal(address(i, size, 1), wrap, 'WRAP');
    assert.equal(address(i, size, 2), period < size ? period : 2 * size - 1 - period, 'MIRROR');
    assert.equal(address(i, size, 3), Math.max(0, Math.min(size - 1, i)), 'CLAMP');
    assert.equal(address(i, size, 4), wrap, 'BORDER currently falls through to WRAP');
  }
}
const sampler = extract(core, 'd3dim_texture_sample_keyed');
assert.equal(sampler.split('(call $d3dim_address_texel').length - 1, 6);
assert(sampler.includes('(local.get $tw) (local.get $address_u)'));
assert(sampler.includes('(local.get $th) (local.get $address_v)'));
const lowering = gpu.match(/const address = ([^;\n]+);/g);
assert.equal(lowering?.length, 1, 'unique GPU address lowering');
const gpuAddress = vm.runInNewContext(`(${lowering[0].slice('const address = '.length, -1)})`);
assert.equal(gpuAddress(4), 3, 'GPU BORDER currently lowered to CLAMP');
for (const mode of [1, 2, 3]) assert.equal(gpuAddress(mode), mode);
assert(gpu.includes('addressU: address(d.addressU), addressV: address(d.addressV)'),
  'GPU descriptor uses independent address lowering');

const fixed = '(i32.const 0xF7))     ;; dwTextureAddressCaps';
assert.equal(dx.split(fixed).length, 2);
for (const [mask, message] of [
  ['0xFF', /unsupported BORDER advertised/],
  ['0xF6', /retained supported address bit/],
  ['0xF5', /retained supported address bit/],
  ['0xF3', /retained supported address bit/],
  ['0xE7', /retained supported address bit/],
  ['0x17', /only BORDER changes/],
]) {
  assert.throws(() => contract(dx.replace(fixed,
    `(i32.const ${mask}))     ;; dwTextureAddressCaps`)), message);
}
// Simulate the pending cube hunk in memory without touching its branch or
// broadening this change. The address contract must still pass after integration.
contract(dx.replace('(i32.const 0xFFDF)', '(i32.const 0xF7DF)'));
console.log(`PASS: ${checks} descriptor address fields; 72 software address cases; ` +
  'GPU lowering; 6 negative controls; pending cube composition. Extracted source only.');
