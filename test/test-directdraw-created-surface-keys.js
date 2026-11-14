#!/usr/bin/env node
'use strict';

// Run: node test/test-directdraw-created-surface-keys.js [module.wasm]
// Shipped WASM, public x86 COM calls, caller-owned guarded storage. No private
// surface-state injection. Bootstrap matches test-directdraw-key-clip-sprites.js.
// Descriptor contracts: DDSURFACEDESC(108)/DDSURFACEDESC2(124), DDSD_CKSRCBLT
// 0x10000 at +64/+68 and DDSD_CKDESTBLT 0x4000 at +48/+52. Both endpoints
// are inclusive; equal endpoints specify a single color. See the primary
// contract references in scratch/runs/20261113-ddraw-created-key-state-0800/result.json.
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
      const method = read(read(object) + slot * 4);
      assert(method, 'published COM method');
      const wa = (method - e.get_image_base() + e.get_guest_base()) >>> 0;
      const view = new DataView(memory.buffer);
      assert.equal(view.getUint32(wa, true), 0xcaca0010, 'public COM dispatch thunk');
      const names = {0:'QueryInterface', 2:'Release', 5:'Blt', 6:'CreateSurface',
        16:'GetColorKey', 20:'SetCooperativeLevel', 25:'Lock', 29:'SetColorKey', 32:'Unlock'};
      assert.equal(apis[view.getUint32(wa + 4, true)].name.split('_').pop(), names[slot], 'published slot identity');
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
  const iid1 = guid([0x6c14db80, 0x11cea733, 0x200021a5, 0x60e50baf]);
  const out = alloc(4), dv = new DataView(memory.buffer);
  const thunkWa = regions.BASE.THUNK_BASE;
  const thunk = (thunkWa - e.get_guest_base() + e.get_image_base()) >>> 0;
  const saved = dv.getUint32(thunkWa + 4, true);
  try {
    dv.setUint32(thunkWa + 4, apis.find(a => a.name === 'DirectDrawCreateEx').id, true);
    ok(invoke([0, out, iid7, 0], 0, 0, thunk));
  } finally { dv.setUint32(thunkWa + 4, saved, true); }
  const dd7 = read(out); assert(dd7); ok(com(dd7, 20, 0, 8));
  ok(com(dd7, 0, iid1, out)); const dd1 = read(out); assert(dd1);

  const width = 7, height = 7, guard = 32, failures = [];
  let surfaces = 0, queries = 0, blits = 0;
  // Keep collecting state/pixel mismatches so a missing creation import does
  // not stop at GetColorKey before its corresponding Blt is observed.
  function expect(actual, expected, label) {
    try { assert.deepEqual(actual, expected, label); }
    catch (error) { failures.push({label, message:error.message}); }
  }
  function getKeys(s, sk, dk, phase) {
    for (const [direction, key] of [[8, sk], [2, dk]]) {
      const answer = alloc(16); fill(answer, 16, 0xa5);
      const hr = com(s.obj, 16, direction, answer + 4);
      expect(hr, key ? 0 : 0x887600d7, `${s.name}/${phase}/GetColorKey${direction}/hr`);
      expect(snapshot(answer + 4, 8), key
        ? key.flatMap(n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, n >>> 24])
        : Array(8).fill(0xa5), `${s.name}/${phase}/GetColorKey${direction}/value`);
      expect(snapshot(answer, 4), Array(4).fill(0xa5), `${s.name}/query leading canary`);
      expect(snapshot(answer + 12, 4), Array(4).fill(0xa5), `${s.name}/query trailing canary`);
      queries++;
    }
  }
  function surface(dd, descSize, bpp, sk, dk, name, sourceValues, destValues) {
    const bps = bpp / 8, pitch = ((width * bps + 3) & ~3) + 8, size = pitch * height;
    const base = alloc(size + guard * 2), pixels = base + guard;
    const descBase = alloc(descSize + 16), desc = descBase + 8;
    fill(base, size + guard * 2, 0xa7); fill(descBase, descSize + 16, 0xa5); fill(desc, descSize, 0);
    // Even absent keys have nonzero descriptor bytes: only DDSD flags make
    // them valid. No overlay flags or malformed descriptor cases here.
    for (const [o, v] of [[0,descSize],[4,0x180f | (sk ? 0x10000 : 0) | (dk ? 0x4000 : 0)],
      [8,height],[12,width],[16,pitch],[36,pixels],
      [48,(dk || destValues)[0]],[52,(dk || destValues)[1]],
      [64,(sk || sourceValues)[0]],[68,(sk || sourceValues)[1]],
      [72,32],[76,bpp === 8 ? 0x60 : 0x40],[84,bpp],
      [88,bpp === 16 ? 0xf800 : bpp === 8 ? 0 : 0xff0000],
      [92,bpp === 16 ? 0x7e0 : bpp === 8 ? 0 : 0xff00],
      [96,bpp === 16 ? 0x1f : bpp === 8 ? 0 : 0xff],[104,0x840]]) write(desc + o, v);
    const descriptorBefore = snapshot(descBase, descSize + 16);
    write(out, 0); ok(com(dd, 6, desc, out, 0)); const obj = read(out); assert(obj);
    expect(snapshot(descBase, descSize + 16), descriptorBefore, `${name}/creation input/canaries`);
    const s = {obj, base, pixels, pitch, size, bps, name};
    getKeys(s, sk, dk, 'created');
    // Poison the entire caller descriptor, not just endpoints; query again
    // before any SetColorKey can seed state or conceal a missing import.
    fill(desc, descSize, 0xcc);
    getKeys(s, sk, dk, 'caller-mutated');
    const lock = alloc(descSize); fill(lock, descSize, 0); write(lock, descSize);
    ok(com(obj, 25, 0, lock, 1, 0));
    assert.equal(read(lock + 36), pixels, 'public Lock caller storage');
    assert.equal(read(lock + 16), pitch, 'public Lock caller pitch');
    assert.equal(read(lock + 84), bpp, 'public Lock surface-owned pixel depth');
    ok(com(obj, 32, 0)); surfaces++;
    return s;
  }
  const pixel = (bytes, at, bps) => bytes.slice(at, at + bps).reduce((n, v, i) => n + v * 2 ** (8 * i), 0);
  // Independent copy oracle: source ranges exclude, destination ranges admit.
  const allowed = (s, d, sk, dk) => (!sk || s < sk[0] || s > sk[1]) && (!dk || (d >= dk[0] && d <= dk[1]));
  assert.equal(allowed(32, 64, [32,35], [64,67]), false);
  assert.equal(allowed(36, 64, [32,35], [64,67]), true);
  assert.equal(allowed(36, 68, [32,35], [64,67]), false);
  function blit(src, dst, sk, dk, bias, label) {
    for (const [s, isSource] of [[src,true], [dst,false]]) {
      fill(s.base, s.size + guard * 2, 0xa7);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        // Cartesian grid crosses below/low/interior/high/above independently.
        const value = bias + (isSource ? 31 + x : 63 + y);
        for (let b = 0; b < s.bps; b++) e.guest_write8(s.pixels + y * s.pitch + x * s.bps + b, (value >>> (8*b)) & 255);
      }
    }
    const before = snapshot(dst.base, dst.size + guard * 2);
    const source = snapshot(src.base, src.size + guard * 2), want = before.slice();
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const si = guard + y * src.pitch + x * src.bps, di = guard + y * dst.pitch + x * dst.bps;
      if (allowed(pixel(source, si, src.bps), pixel(before, di, dst.bps), sk, dk))
        for (let b = 0; b < dst.bps; b++) want[di+b] = source[si+b];
    }
    const hr = com(dst.obj, 5, 0, src.obj, 0, 0x1000000 | (sk ? 0x8000 : 0) | (dk ? 0x2000 : 0), 0);
    expect(hr, 0, `${label}/Blt/hr`);
    expect(snapshot(dst.base, dst.size + guard * 2), want, `${label}/pixels/padding/canaries`);
    expect(snapshot(src.base, src.size + guard * 2), source, `${label}/source untouched`);
    blits++;
  }
  for (const [dd, descSize] of [[dd1,108], [dd7,124]]) for (const bpp of [8,16,24,32]) {
    // Nonzero high bytes exercise every pixel width, including unsigned 32-bit.
    // All descriptor endpoints are valid native pixel values within this mask.
    const bias = {8:0, 16:0x8000, 24:0x800000, 32:0x80000000}[bpp];
    const pixelMask = {8:0xff, 16:0xffff, 24:0xffffff, 32:0xffffffff}[bpp];
    const sr = [bias+32,bias+35], dr = [bias+64,bias+67];
    assert(bias + 69 <= pixelMask, 'all seeded pixels and keys fit the native pixel mask');
    for (const [mode, sk, dk] of [
      ['absent',null,null], ['source-single',[sr[0],sr[0]],null], ['source-range',sr,null],
      ['destination-single',null,[dr[0],dr[0]]], ['destination-range',null,dr],
      ['both-singles',[sr[0],sr[0]],[dr[0],dr[0]]],
      ['both-ranges',sr,dr], ['source-single-destination-range',[sr[0],sr[0]],dr],
      ['source-range-destination-single',sr,[dr[0],dr[0]]],
    ]) {
      const name = `${descSize}/${bpp}/${mode}`;
      const src = surface(dd, descSize, bpp, sk, dk, name+'/src', sr, dr);
      const dst = surface(dd, descSize, bpp, sk, dk, name+'/dst', sr, dr);
      blit(src, dst, null, null, bias, name+'/unkeyed');
      if (sk) blit(src, dst, sk, null, bias, name+'/source');
      if (dk) blit(src, dst, null, dk, bias, name+'/destination');
      if (sk && dk) blit(src, dst, sk, dk, bias, name+'/both');
      // Removal on creation-initialized state must preserve the other direction.
      // These occur after all creation-only pixel checks; no repair by setter.
      ok(com(src.obj, 29, 8, 0)); getKeys(src, null, dk, 'source-removed');
      ok(com(dst.obj, 29, 2, 0)); getKeys(dst, sk, null, 'destination-removed');
      com(src.obj, 2); com(dst.obj, 2);
    }
  }
  com(dd1, 2); com(dd7, 2);
  console.log(JSON.stringify({surfaces, queries, blits, calls, failures}, null, 2));
  assert.equal(failures.length, 0, 'creation-initialized directional keys and exact guarded copies');
  console.log('PASS public COM CreateSurface descriptor blit keys');
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
