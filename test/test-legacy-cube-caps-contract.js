#!/usr/bin/env node
'use strict';

// Source contract, not a guest/COM or renderer test. Compile only the actual
// descriptor/GetCaps helpers and the unchanged CreateSurface admission prefix.
// The rest of CreateSurface is deliberately NOT simulated: fallthrough means
// "admitted to the existing allocation path", never successful allocation.
// Full storage/ABI coverage already lives in test-directdraw-surface47-abi-candidate.js.
//
// Microsoft SDK headers (DIRECT3D_VERSION 0x0700), checked 2026-10-20:
// https://raw.githubusercontent.com/microsoft/win32metadata/main/generation/WinSDK/RecompiledIdlHeaders/um/d3dcaps.h
// D3DPTEXTURECAPS_CUBEMAP=0x0800; PROJECTED=0x0400 (not the cube bit).
// https://raw.githubusercontent.com/microsoft/win32metadata/main/generation/WinSDK/RecompiledIdlHeaders/um/ddraw.h
// DDSCAPS2_CUBEMAP=0x0200; six face bits=0x0400..0x8000, ALLFACES=0xfc00.
// https://learn.microsoft.com/en-us/windows/win32/api/ddraw/ns-ddraw-ddscaps2
// A format enumeration supplies pixel formats, not a promise of cube storage.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { compile } = require('../tools/watx');
const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, 'src', name), 'utf8');
const dx = read('09a8-handlers-directx.wat');
const core = read('09ab-handlers-d3dim-core.wat');
const handlers = read('09aa-handlers-d3dim.wat');
const CUBE = 0x800, SURFACE_CUBE = 0x200, ALL_FACES = 0xfc00;
const BEFORE = 0xffdf;

// Balanced extraction, rejecting syntax this small scanner does not support.
// Never use a regexp ending at the first closing parenthesis as a function.
function extract(source, name) {
  const marker = `(func $${name} `;
  const start = source.indexOf(marker);
  assert(start >= 0 && source.indexOf(marker, start + 1) < 0, `unique ${name}`);
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
  const names = ['fill_primcaps', 'fill_d3d_device_desc',
    'd3d_fill_texture_format', 'd3d_fill_texture_desc', 'handle_IDirect3DDevice3_GetCaps'];
  const pieces = names.map(name => extract(source, name));
  for (const name of ['d3dim_fill_device_desc', 'd3dim_fill_device_desc7'])
    pieces.push(extract(core, name));
  for (const version of ['', '2', '7'])
    pieces.push(extract(handlers, `handle_IDirect3DDevice${version}_GetCaps`));

  const create = extract(source, 'handle_IDirectDraw_CreateSurface');
  const stop = '(local.set $ddsd_wa (call $g2w (local.get $arg1)))';
  assert.equal(create.split(stop).length, 2, 'unique boundary before ordinary allocation path');
  // Exact entry prefix; no rewriting of the tested rejection condition/body.
  pieces.push(create.slice(0, create.indexOf(stop)) +
    '(global.set $admitted (i32.const 1)))');
  const exports = [...names, 'd3dim_fill_device_desc', 'd3dim_fill_device_desc7',
    ...['', '2', '7'].map(v => `handle_IDirect3DDevice${v}_GetCaps`),
    'handle_IDirectDraw_CreateSurface']
    .map(name => `(export "${name}" (func $${name}))`).join('\n');
  const result = compile(`
    (memory 1) (export "memory" (memory 0))
    (global $reg_base i32 (i32.const 64))
    (global $admitted (mut i32) (i32.const 0))
    (export "admitted" (global $admitted))
    (func $g2w (param $p i32) (result i32) (local.get $p))
    (func $gl32 (param $p i32) (result i32) (i32.load (local.get $p)))
    (func $gs32 (param $p i32) (param $v i32) (i32.store (local.get $p) (local.get $v)))
    (func $zero_memory (param $p i32) (param $n i32)
      (memory.fill (local.get $p) (i32.const 0) (local.get $n)))
    ;; Harness interface discriminator and descriptor validity, not production
    ;; QI/vtable routing. Existing full ABI test owns that separate requirement.
    (func $dx_native_desc_size (param $version i32) (result i32)
      (if (result i32) (i32.ge_u (local.get $version) (i32.const 4))
        (then (i32.const 124)) (else (i32.const 108))))
    (func $dx_surface_desc_valid (param $version i32) (param $p i32) (result i32)
      (i32.eq (i32.load (local.get $p)) (call $dx_native_desc_size (local.get $version))))
    ${pieces.join('\n')}
    ${exports}
  `, new Map(), { mode: 'production' });
  assert(result.wasmBinary, 'extracted source compilation');
  return new WebAssembly.Instance(new WebAssembly.Module(result.wasmBinary)).exports;
}

function contract(source) {
  // Pin the link from enumeration producers to the builders exercised below.
  // These are source wiring assertions, not callback execution/lifetime tests.
  for (const [producer, builder, count] of [
    ['d3d_enum_devices_dispatch', 'fill_d3d_device_desc', 2],
    ['d3d_enum_devices7_dispatch', 'd3dim_fill_device_desc7', 1],
    ['d3d_enum_format_dispatch', 'd3d_fill_texture_desc', 1],
    ['d3d_enum_format_dispatch', 'd3d_fill_texture_format', 1],
  ]) {
    const body = extract(source, producer).replace(/;;[^\n]*/g, '');
    assert.equal(body.split(`(call $${builder} `).length - 1, count, `${producer} builder wiring`);
  }
  const e = build(source);
  const bytes = new Uint8Array(e.memory.buffer), view = new DataView(e.memory.buffer);
  const get = p => view.getUint32(p, true);
  const put = (p, v) => view.setUint32(p, v, true);
  const poison = 0xa5a5a5a5;
  let checks = 0;
  function guarded(p, size, action) {
    bytes.fill(0xa5, p - 4, p + size + 4);
    action();
    assert.equal(get(p - 4), poison, 'leading output guard');
    assert.equal(get(p + size), poison, 'trailing output guard');
  }
  function caps(p, offsets) {
    for (const offset of offsets) {
      const mask = get(p + offset);
      assert.equal(mask & CUBE, 0, 'CUBEMAP advertised despite rejected cube surface storage');
      assert.equal(mask, BEFORE & ~CUBE, 'only CUBEMAP changes; PROJECTED/palette/NPOT stay unchanged');
      checks++;
    }
  }
  // Primitive and both line/triangle descriptors, aligned and unaligned.
  for (const p of [512, 513]) {
    guarded(p, 56, () => e.fill_primcaps(p));
    caps(p, [32]);
    const expected = [56, 0x3f, 0x7ff, 0xff, 0x1fff, 0x1fff, 0xff, 0x1ffff,
      BEFORE & ~CUBE, 0xff, 0xffff, 0xff, 1, 1];
    assert.deepEqual(expected.map((_, i) => get(p + i * 4)), expected);
    // EnumDevices' actual HW and HEL descriptor builders.
    for (const hal of [0, 1]) {
      guarded(p, 252, () => e.fill_d3d_device_desc(p, hal));
      caps(p, [76, 132]);
    }
    // Execute whole source GetCaps handlers (identity memory, synthetic registers).
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
        caps(p, [76, 132]); caps(hel, [76, 132]);
      }
    }
    guarded(p, 236, () => {
      put(80, 4096);
      e.handle_IDirect3DDevice7_GetCaps(0, p, 0, 0, 0, 0);
    });
    assert.equal(get(64), 0); assert.equal(get(80), 4108);
    caps(p, [36, 92]);
    assert.equal(get(p + 40), 0x030003ff, 'D3D7 line filters retained');
    assert.equal(get(p + 96), 0x030003ff, 'D3D7 triangle filters retained');
    guarded(p, 236, () => e.d3dim_fill_device_desc7(p));
    caps(p, [36, 92]); // EnumDevices7 builder
  }

  // All five enumerated formats remain ordinary 2D descriptors. DDPIXELFORMAT
  // alone carries no DDSCAPS2 and must not be interpreted as a cube promise.
  for (let index = 0; index < 5; index++) {
    guarded(512, 108, () => e.d3d_fill_texture_desc(512, index));
    guarded(1024, 32, () => e.d3d_fill_texture_format(1024, index));
    assert.equal(get(512), 108);
    assert.equal(get(516), 0x100f);
    assert.equal(get(616), 0x1840);
    assert.deepEqual(bytes.slice(584, 616), bytes.slice(1024, 1056));
    checks++;
  }

  const desc = 2048, out = 2304;
  function admit(version, flags, caps2) {
    bytes.fill(0, desc, desc + 124);
    put(desc, version >= 4 ? 124 : 108); put(desc + 4, flags);
    put(desc + 8, 4); put(desc + 12, 4);
    put(desc + 72, 32); put(desc + 76, 0x40); put(desc + 84, 32);
    put(desc + 104, 0x1808); put(desc + 108, caps2);
    put(64, poison); put(80, 4096); e.admitted.value = 0;
    guarded(out, 4, () => e.handle_IDirectDraw_CreateSurface(version, desc, out, 0, 0, 0));
    return { admitted: e.admitted.value, hr: get(64), output: get(out), esp: get(80) };
  }
  for (const version of [4, 7]) {
    // No imported DX8 all-six-faces rule: each partial-face request also rejects.
    for (const face of [0, 0x400, 0x800, 0x1000, 0x2000, 0x4000, 0x8000, ALL_FACES]) {
      assert.deepEqual(admit(version, 0x1007, SURFACE_CUBE | face),
        { admitted: 0, hr: 0x80004001, output: 0, esp: 4116 },
        'cube storage must reject explicitly, clear output, and return before allocation');
      checks++;
    }
    for (const [flags, caps2] of [[0x1007, 0], [0x1006, SURFACE_CUBE | ALL_FACES]]) {
      assert.deepEqual(admit(version, flags, caps2),
        { admitted: 1, hr: poison, output: poison, esp: 4096 },
        '2D/unused caps2 reach the existing path (not an allocation-success claim)');
      checks++;
    }
  }
  return checks;
}

const checks = contract(dx);
// Sensitivity controls use the same checker and compile mutated production
// source in memory. None touch disk or change the public unsupported path.
const fixed = '(i32.const 0xF7DF)';
assert.equal(dx.split(fixed).length, 2, 'unique corrected mask');
assert.throws(() => contract(dx.replace(fixed, '(i32.const 0xFFDF)')),
  /CUBEMAP advertised/, 'old false advertisement must fail');
assert.throws(() => contract(dx.replace(fixed, '(i32.const 0xF3DF)')),
  /only CUBEMAP changes/, 'do not clear PROJECTED by mistake');
const prefix = extract(dx, 'handle_IDirectDraw_CreateSurface');
const rejection = '(i32.const 0x80004001)';
assert(prefix.includes(rejection));
assert.throws(() => contract(dx.replace(prefix, prefix.replace(rejection, '(i32.const 0)'))),
  /cube storage must reject/, 'success HRESULT on rejected storage must fail');
const clear = '(call $gs32 (local.get $arg2) (i32.const 0))';
assert(prefix.includes(clear));
assert.throws(() => contract(dx.replace(prefix, prefix.replace(clear, '(nop)'))),
  /cube storage must reject/, 'uncleared rejected output must fail');
console.log(`PASS legacy cube caps contract: ${checks} checks; 4 mutation controls. ` +
  'Extracted source only; no full build, guest, allocation, callbacks, or renderer execution.');
