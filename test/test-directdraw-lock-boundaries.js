#!/usr/bin/env node
'use strict';

// Run the shipped module, real allocation and published COM vtables. No WAT
// transforms, helper exports, synthetic surface records or Canvas pixels.
// Native contract: Wine ddraw/tests/ddraw7.c:test_lockrect_invalid records
// DDERR_INVALIDPARAMS and cleared lpSurface for invalid offscreen rectangles,
// but accepts empty rectangles and has permissive system-memory textures.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createHostImports } = require('../lib/host-imports');
const regions = require('../lib/region-map.generated');
const apis = require('../src/api_table.json');

(async () => {
  const modulePath = process.argv[2] || path.join(__dirname, '../build/wine-assembly.wasm');
  const wasm = fs.readFileSync(modulePath);
  console.log('module sha256', crypto.createHash('sha256').update(wasm).digest('hex'));
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const imports = createHostImports({ getMemory: () => memory.buffer, renderer: null, resourceJson: {} });
  Object.assign(imports.host, { memory, create_thread: () => 0, exit_thread: () => 0,
    terminate_thread: () => 0, create_event: () => 0, set_event: () => 0,
    reset_event: () => 0, wait_single: () => 0, wait_multiple: () => 0,
    com_create_instance: () => 0x80004002 });
  const { instance: { exports: e } } = await WebAssembly.instantiate(wasm, imports);
  const pe = fs.readFileSync(path.join(__dirname, 'binaries/calc.exe'));
  new Uint8Array(memory.buffer).set(pe, e.get_staging());
  assert(e.load_pe(pe.length));
  e.init_dx_com_thunks();
  const read = p => e.guest_read32(p) >>> 0;
  const write = (p, n) => e.guest_write32(p, n >>> 0);
  const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert(p); return p; };
  const snapshot = (p, n) => Array.from({ length: n }, (_, i) => e.guest_read8(p + i));
  const fill = (p, n, value) => { for (let i = 0; i < n; i++) e.guest_write8(p + i, value); };
  const stack = alloc(8192) + 4096;
  let calls = 0;
  function invoke(args, object, slot, target) {
    const code = [], word = n => code.push(n & 255, (n >>> 8) & 255, (n >>> 16) & 255, n >>> 24);
    for (const arg of args.slice().reverse()) { code.push(0x68); word(arg); }
    if (object) {
      assert(read(read(object) + slot * 4), 'published COM method');
      code.push(0xb8); word(object);
      code.push(0x8b, 0x00, 0xff, 0x90); word(slot * 4);
    } else { code.push(0xb8); word(target); code.push(0xff, 0xd0); }
    const result = alloc(8);
    code.push(0xa3); word(result);
    code.push(0x89, 0x25); word(result + 4); code.push(0xc3);
    const pc = alloc(code.length);
    code.forEach((b, i) => e.guest_write8(pc + i, b));
    e.set_esp(stack); e.call_func(pc, 0, 0, 0, 0);
    for (let n = 0; n < 100 && e.get_eip(); n++) e.run(10000);
    assert.equal(e.get_eip(), 0, 'bounded guest return');
    assert.equal(read(result + 4), stack - 20, 'exact COM stdcall cleanup');
    assert.equal(e.get_esp() >>> 0, stack - 16, 'caller RET');
    calls++;
    return read(result);
  }
  const com = (obj, slot, ...args) => invoke([obj, ...args], obj, slot);
  const ok = hr => assert.equal(hr, 0);
  const guid = words => { const p = alloc(16); words.forEach((n, i) => write(p + i * 4, n)); return p; };
  const iid7 = guid([0x15e65ec0, 0x11d23b9c, 0x60002fb9, 0x5bea9797]);
  const surfaceIids = [
    [1, [0x6c14db81, 0x11cea733, 0x200021a5, 0x60e50baf]],
    [2, [0x57805885, 0x11cf6eec, 0x23a84194, 0x270ec103]],
    [3, [0xda044e00, 0x11d069b2, 0xaa00d5a1, 0xbbdfb800]],
    [4, [0x0b2b8630, 0x11d0ad35, 0x6000a68e, 0x5bea9797]],
    [7, [0x06675a80, 0x11d23b9b, 0x60002fb9, 0x5bea9797]],
  ].map(([v, words]) => [v, guid(words)]);
  const out = alloc(4), dv = new DataView(memory.buffer);
  const thunkWa = regions.BASE.THUNK_BASE;
  const thunk = (thunkWa - e.get_guest_base() + e.get_image_base()) >>> 0;
  const saved = dv.getUint32(thunkWa + 4, true);
  try {
    dv.setUint32(thunkWa + 4, apis.find(a => a.name === 'DirectDrawCreateEx').id, true);
    ok(invoke([0, out, iid7, 0], 0, 0, thunk));
  } finally { dv.setUint32(thunkWa + 4, saved, true); }
  const dd = read(out); assert(dd); ok(com(dd, 20, 0, 8));
  const poison = 0xa5;
  function guarded(size) {
    const base = alloc(size + 16), p = base + 8;
    fill(base, size + 16, poison); write(p, size);
    return { p, check() {
      assert.deepEqual(snapshot(base, 8), Array(8).fill(poison), 'leading descriptor canary');
      assert.deepEqual(snapshot(p + size, 8), Array(8).fill(poison), 'trailing descriptor canary');
    } };
  }
  const width = 7, height = 5;
  const invalid = [
    [-1, 0, 1, 1], [0, -1, 1, 1], [-2, 0, -1, 1], [0, -2, 1, -1],
    [0, 0, 8, 1], [0, 0, 1, 6], [8, 0, 9, 1], [0, 6, 1, 7], [6, 4, 8, 5],
    [3, 1, 2, 3], [1, 3, 3, 2],
    [-0x80000000, 0, 0x7fffffff, 1], [0, -0x80000000, 1, 0x7fffffff],
    [0x40000000, 0, 0x40000001, 1], [0, 0x40000000, 1, 0x40000001],
  ];
  const failures = [];
  let validCount = 0, invalidCount = 0;
  for (const caps of [0x840, 0x4040]) for (const bpp of [8, 16, 24, 32]) {
    const create = alloc(124); fill(create, 124, 0);
    for (const [offset, value] of [[0, 124], [4, 0x1007], [8, height], [12, width],
      [72, 32], [76, bpp === 8 ? 0x60 : 0x40], [84, bpp],
      [88, bpp === 16 ? 0xf800 : bpp === 8 ? 0 : 0xff0000],
      [92, bpp === 16 ? 0x7e0 : bpp === 8 ? 0 : 0xff00],
      [96, bpp === 16 ? 0x1f : bpp === 8 ? 0 : 0xff], [104, caps]]) write(create + offset, value);
    ok(com(dd, 6, create, out, 0)); const surface = read(out);
    const pitch = (width * (bpp / 8) + 3) & ~3;
    for (const [version, iid] of surfaceIids) {
      ok(com(surface, 0, iid, out)); const obj = read(out), size = version < 4 ? 108 : 124;
      const rect = alloc(16), desc = guarded(size);
      const lock = r => {
        fill(desc.p, size, poison); write(desc.p, size);
        if (r) r.forEach((v, i) => write(rect + i * 4, v));
        const hr = com(obj, 25, r ? rect : 0, desc.p, 1, 0); desc.check(); return hr;
      };
      const unlock = r => ok(com(obj, 32, version < 4 ? read(desc.p + 36) : r ? rect : 0));
      ok(lock(null));
      const pixels = read(desc.p + 36); assert(pixels);
      assert.equal(read(desc.p + 16), pitch); assert.equal(read(desc.p + 84), bpp);
      fill(pixels, pitch * height, 0x39);
      const expected = Array(pitch * height).fill(0x39);
      unlock(null);
      for (const r of [[0, 0, 7, 5], [1, 1, 5, 4], [6, 4, 7, 5], [2, 2, 2, 4], [2, 2, 4, 2]]) {
        ok(lock(r)); validCount++;
        assert.equal(read(desc.p + 36), pixels + r[1] * pitch + r[0] * bpp / 8);
        assert.equal(read(desc.p + 16), pitch, 'subrect retains parent pitch');
        assert.equal(read(desc.p + 12), width); assert.equal(read(desc.p + 8), height);
        for (let y = r[1]; y < r[3]; y++) for (let x = r[0]; x < r[2]; x++) {
          for (let byte = 0; byte < bpp / 8; byte++) {
            const value = (x * 17 + y * 31 + byte) & 255;
            e.guest_write8(read(desc.p + 36) + (y - r[1]) * pitch + (x - r[0]) * bpp / 8 + byte, value);
            expected[y * pitch + x * bpp / 8 + byte] = value;
          }
        }
        unlock(r);
        assert.deepEqual(snapshot(pixels, pitch * height), expected, 'native pixels and row padding');
      }
      for (const r of invalid) {
        const metadata = guarded(size); ok(com(obj, 22, metadata.p)); metadata.check();
        const before = snapshot(metadata.p, size);
        const hr = lock(r); invalidCount++;
        const pointer = read(desc.p + 36);
        if (hr !== 0x80070057 || pointer !== 0) failures.push({ caps, bpp, version, rect: r, hr, pointer,
          base: pixels, delta: (pointer - pixels) | 0 });
        if (hr === 0) unlock(r); // baseline observation only; never dereference the invalid pointer
        else {
          const untouched = Array(size).fill(poison);
          untouched.splice(0, 4, size, 0, 0, 0); untouched.splice(36, 4, 0, 0, 0, 0);
          assert.deepEqual(snapshot(desc.p, size), untouched, 'failure changes only lpSurface');
        }
        ok(com(obj, 22, metadata.p)); metadata.check();
        assert.deepEqual(snapshot(metadata.p, size), before, 'rejected Lock preserves surface descriptor');
        assert.deepEqual(snapshot(pixels, pitch * height), expected, 'failed Lock preserves native memory');
      }
      for (const wrongSize of [0, 4, size - 4, 128]) {
        const bad = guarded(size); write(bad.p, wrongSize);
        const before = snapshot(bad.p, size);
        assert.equal(com(obj, 25, 0, bad.p, 1, 0), 0x80070057);
        bad.check(); assert.deepEqual(snapshot(bad.p, size), before, 'invalid descriptor untouched');
      }
      assert.equal(com(obj, 25, 0, 0, 1, 0), 0x80070057);
      ok(lock(null));
      assert.equal(read(desc.p + 36), pixels, 'subsequent whole Lock retains allocation');
      assert.equal(read(desc.p + 16), pitch);
      assert.deepEqual(snapshot(pixels, pitch * height), expected);
      unlock(null); com(obj, 2);
    }
    com(surface, 2);
    console.log(JSON.stringify({ caps, bpp, pitch, validCount, invalidCount }));
  }
  // Native Windows accepts these rectangles on system-memory/managed textures.
  // Keep the offscreen repair from tightening that distinct compatibility path.
  for (const [caps, caps2] of [[0x1800, 0], [0x1000, 0x10]]) {
    const create = alloc(124); fill(create, 124, 0);
    for (const [offset, value] of [[0, 124], [4, 0x1007], [8, height], [12, width],
      [72, 32], [76, 0x40], [84, 32], [88, 0xff0000], [92, 0xff00],
      [96, 0xff], [104, caps], [108, caps2]]) write(create + offset, value);
    ok(com(dd, 6, create, out, 0)); const obj = read(out);
    const desc = guarded(124), rect = alloc(16);
    [3, 1, 2, 3].forEach((v, i) => write(rect + i * 4, v));
    ok(com(obj, 25, rect, desc.p, 1, 0)); desc.check();
    assert(read(desc.p + 36)); // Do not dereference an invalid rectangle's pointer.
    ok(com(obj, 32, rect)); com(obj, 2);
  }
  com(dd, 2);
  console.log(JSON.stringify({ calls, validCount, invalidCount, failures }, null, 2));
  assert.equal(failures.length, 0, 'invalid offscreen rectangles must fail without publishing an out-of-bounds pointer');
  console.log('PASS shipped WASM COM Lock/Unlock: native pitches, subrect writes, rectangle rejection and descriptor canaries');
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
