#!/usr/bin/env node
'use strict';
const assert = require('assert/strict');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { bootRenderHarness } = require('./render-helper');
const regions = require('../lib/region-map.generated');
const apis = require('../src/api_table.json');

// Literal expectations frozen before baseline. DirectDraw reports per-interface
// AddRef/Release counts; the shared total governs lifetime. QI(IUnknown) must
// return the controlling pointer and acquire one reference through that pointer.
// https://learn.microsoft.com/en-us/windows/win32/com/implementing-reference-counting
// https://learn.microsoft.com/en-us/windows/win32/com/rules-for-implementing-queryinterface
const S_OK = 0, E_POINTER = 0x80004003, E_NOINTERFACE = 0x80004002;
const ddWords = [
  ['IDirectDraw', [0x6c14db80, 0x11cea733, 0x200021a5, 0x60e50baf]],
  ['IDirectDraw2', [0xb3a6f3e0, 0x11cf2b43, 0xaa00dea2, 0x5633b900]],
  ['IDirectDraw4', [0x9c59509a, 0x11d139bd, 0xc0004a8c, 0xc530d94f]],
  ['IDirectDraw7', [0x15e65ec0, 0x11d23b9c, 0x60002fb9, 0x5bea9797]],
];
const d3dWords = [
  ['IDirect3D', [0x3bba0080, 0x11cf2421, 0xaa001aa3, 0x5633b900]],
  ['IDirect3D2', [0x6aae1ec1, 0x11d0662a, 0xaa009d88, 0x6ab7bb00]],
  ['IDirect3D3', [0xbb223240, 0x11d0e72b, 0xaa00b4a9, 0x3e99c000]],
  ['IDirect3D7', [0xf5049e77, 0x11d24861, 0xa00007a4, 0xa82906c9]],
];

(async () => {
  // Complete production closure: no extracted WAT or test-only handler exports.
  const wasm = process.argv[2] ? fs.readFileSync(process.argv[2]) : require('./compile-src').compileSrcWasm();
  console.log('complete production module', crypto.createHash('sha256').update(wasm).digest('hex'));
  const { exports: e, memory } = await bootRenderHarness({prebuiltModule: await WebAssembly.compile(wasm), fonts: 'none'});
  const exe = fs.readFileSync(path.join(__dirname, 'binaries/calc.exe'));
  new Uint8Array(memory.buffer).set(exe, e.get_staging());
  assert(e.load_pe(exe.length), 'fixture PE initializes COM thunks'); e.init_dx_com_thunks();
  const read = p => e.guest_read32(p) >>> 0, write = (p, n) => e.guest_write32(p, n >>> 0);
  const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert(p); return p; };
  const dv = new DataView(memory.buffer), waRead = p => dv.getUint32(p, true);
  const entry = obj => regions.BASE.DX_OBJECTS + read(obj + 4) * 32;
  const total = obj => waRead(entry(obj) + 4);
  const aux = obj => {
    const off = (e.guest_to_wasm(obj) >>> 0) - regions.BASE.COM_WRAPPERS_AUX;
    return off >= 0 && off < regions.SIZE.COM_WRAPPERS_AUX
      ? waRead(regions.BASE.COM_AUX_REFS + (off / 8) * 4) : 0;
  };
  const live = () => {
    let count = 0;
    for (let i = 0; i < regions.SIZE.DX_OBJECTS; i += 32) if (waRead(regions.BASE.DX_OBJECTS + i)) count++;
    return count;
  };
  const stack = alloc(8192) + 4096;
  let calls = 0;
  function invoke(args, obj, slot, target) {
    const code = [], word = n => code.push(n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24);
    for (const arg of args.slice().reverse()) { code.push(0x68); word(arg); }
    if (obj) {
      assert(read(read(obj) + slot * 4), 'published COM method');
      code.push(0xb8); word(obj); code.push(0x8b, 0x00, 0xff, 0x90); word(slot * 4);
    } else { code.push(0xb8); word(target); code.push(0xff, 0xd0); }
    const result = alloc(8);
    code.push(0xa3); word(result); code.push(0x89, 0x25); word(result + 4); code.push(0xc3);
    const pc = alloc(code.length); code.forEach((b, i) => e.guest_write8(pc + i, b));
    e.set_esp(stack); e.call_func(pc, 0, 0, 0, 0);
    for (let n = 0; n < 100 && e.get_eip(); n++) e.run(10000);
    assert.equal(e.get_eip(), 0, 'bounded guest return');
    assert.equal(read(result + 4), stack - 20, 'COM stdcall cleanup');
    assert.equal(e.get_esp() >>> 0, stack - 16, 'caller RET');
    calls++; return read(result);
  }
  const com = (obj, slot, ...args) => invoke([obj, ...args], obj, slot);
  const outStorage = alloc(12), out = outStorage + 4, out2 = alloc(4);
  write(outStorage, 0x12345678); write(out + 4, 0x87654321);
  const create = () => {
    // Bind an existing API-dispatch thunk; dispatcher/handler remain production.
    const thunkWa = regions.BASE.THUNK_BASE, saved = waRead(thunkWa + 4);
    const thunk = (thunkWa - e.get_guest_base() + e.get_image_base()) >>> 0;
    try {
      dv.setUint32(thunkWa + 4, apis.find(a => a.name === 'DirectDrawCreate').id, true);
      assert.equal(invoke([0, out, 0], 0, 0, thunk), S_OK);
    } finally { dv.setUint32(thunkWa + 4, saved, true); }
    const obj = read(out); assert(obj); assert.equal(total(obj), 1); return obj;
  };
  const guid = words => { const p = alloc(16); words.forEach((v, i) => write(p + i * 4, v)); return p; };
  const iunknown = guid([0, 0, 0xc0, 0x46000000]);
  const ddIids = ddWords.map(([name, words]) => [name, guid(words)]);
  const d3dIids = d3dWords.map(([name, words]) => [name, guid(words)]);
  const object = create();
  assert.equal(com(object, 0, iunknown, 0), E_POINTER);
  write(out, 0xcccccccc); assert.equal(com(object, 0, 0, out), E_POINTER);
  assert.equal(read(out), 0, 'null IID clears output'); assert.equal(total(object), 1);
  assert.equal(com(object, 0, iunknown, out), S_OK);
  assert.equal(read(out), object, 'controlling primary identity'); assert.equal(total(object), 2);
  assert.equal(com(object, 2), 1);

  for (const [index, [name, iid]] of ddIids.entries()) {
    assert.equal(com(object, 0, iid, out), S_OK, name);
    const iface = read(out); assert(iface); assert.equal(total(iface), 2);
    if (index) assert.notEqual(iface, object, `${name} has its own ABI wrapper`);
    assert.equal(aux(iface), index ? 1 : 0);
    assert.equal(com(iface, 0, iunknown, out2), S_OK);
    assert.equal(read(out2), object, `${name} controlling identity`);
    assert.equal(total(object), 3, 'QI(IUnknown) acquires exactly one reference');
    assert.equal(com(read(out2), 2), index ? 1 : 2, 'IUnknown Release returns primary count');
    assert.equal(total(object), 2, 'IUnknown Release balances shared total');
    assert.equal(aux(iface), index ? 1 : 0, 'secondary ownership unchanged');
    console.log(name, 'IUnknown Release: shared=2 primary=' + (index ? 1 : 2) + ' secondary=' + aux(iface));
    assert.equal(com(iface, 2), index ? 0 : 1, `${name} Release returns its own count`);
    assert.equal(total(object), 1); assert.equal(aux(iface), 0);
  }

  const wrappers = [object];
  for (const [, iid] of ddIids.slice(1)) {
    assert.equal(com(object, 0, iid, out), S_OK); wrappers.push(read(out));
  }
  assert.equal(total(object), 4);
  for (const source of wrappers) {
    for (const iid of [iunknown, ...ddIids.map(x => x[1])]) {
      assert.equal(com(source, 0, iid, out), S_OK, 'cross-interface QI');
      const target = read(out); if (iid === iunknown) assert.equal(target, object);
      assert.equal(total(object), 5);
      assert.equal(com(target, 1), 3, 'AddRef returned interface'); assert.equal(total(object), 6);
      assert.equal(com(target, 2), 2); assert.equal(com(target, 2), 1);
      assert.equal(total(object), 4, 'cross-interface ownership balanced');
    }
    // Retain same-Data1 rejection and independently corrupt each GUID word.
    for (const [name, words] of [...ddWords, ...d3dWords, ['IUnknown', [0, 0, 0xc0, 0x46000000]]]) {
      const forgeries = [[words[0], 0, 0, 0]];
      for (let i = 0; i < 4; i++) { const forged = words.slice(); forged[i] ^= 1; forgeries.push(forged); }
      for (const forged of forgeries) {
        const beforeLive = live(); write(out, 0xcccccccc);
        assert.equal(com(source, 0, guid(forged), out), E_NOINTERFACE, `${name} full GUID required`);
        assert.equal(read(out), 0, 'failed query clears output'); assert.equal(total(object), 4);
        assert.deepEqual(wrappers.slice(1).map(aux), [1, 1, 1], 'failed query leaves interface counts');
        assert.equal(live(), beforeLive, 'failed query allocates no object');
        assert.equal(read(outStorage), 0x12345678); assert.equal(read(out + 4), 0x87654321);
      }
    }
  }
  for (const wrapper of wrappers.slice(1)) assert.equal(com(wrapper, 2), 0);
  assert.equal(total(object), 1);
  // Preserve original child creation/release coverage. D3D child identity is a
  // separate implementation and is not changed by this DirectDraw regression.
  for (const [name, iid] of d3dIids) {
    assert.equal(com(object, 0, iid, out), S_OK, name);
    const child = read(out); assert(child); assert.notEqual(child, object);
    assert.equal(total(child), 1); assert.equal(com(child, 2), 0);
    assert.equal(total(object), 1, 'parent ownership stable');
  }
  assert.equal(live(), 1); assert.equal(com(object, 2), 0); assert.equal(live(), 0);

  // A zero primary count must leave the object alive through each secondary.
  // Reacquire the SAME controlling identity, then release it before the survivor.
  for (const [name, iid] of ddIids.slice(1)) {
    const primary = create(); assert.equal(com(primary, 0, iid, out), S_OK);
    const secondary = read(out);
    assert.equal(com(primary, 2), 0); assert.equal(total(secondary), 1); assert.equal(live(), 1);
    assert.equal(com(secondary, 0, iunknown, out2), S_OK);
    const unknown = read(out2); assert.equal(unknown, primary, name + ' identity at primary count zero');
    assert.equal(total(secondary), 2);
    assert.equal(com(unknown, 1), 2); assert.equal(total(secondary), 3);
    assert.equal(com(unknown, 2), 1); assert.equal(total(secondary), 2);
    assert.equal(com(unknown, 2), 0); assert.equal(total(secondary), 1);
    assert.equal(aux(secondary), 1); assert.equal(live(), 1);
    assert.equal(com(secondary, 2), 0);
    assert.equal(waRead(entry(secondary)), 0, 'final shared Release retires object');
    assert.equal(aux(secondary), 0); assert.equal(live(), 0, 'no leaked objects');
  }
  console.log(`PASS DirectDraw QueryInterface HRESULT/identity/ownership: ${calls} real x86 COM/API calls`);
})().catch(error => { console.error(error.stack || error); process.exit(1); });
