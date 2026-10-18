#!/usr/bin/env node
'use strict';

// Source-authored conformance candidate; not a claim of current support.
// Run only in the coordinator's serialized runtime lane. See the design note.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');
const regions = require('../lib/region-map.generated');
const apiTable = require('../src/api_table.json');
const C = { texture: 0x1000, complex: 8, system: 0x800, mip: 0x400000,
  flip: 0x10, back: 4, cube: 0x200, all: 0xfc00 };
const faceBits = [0x400, 0x800, 0x1000, 0x2000, 0x4000, 0x8000];
const faceNames = ['+X', '-X', '+Y', '-Y', '+Z', '-Z'];
const colors = [0xff1020, 0x20ff30, 0x3040ff, 0xffe050, 0x60ffee, 0xee70ff];
const POISON = 0xa5a5a5a5;
const trace = [];

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none' });
  const pe = fs.readFileSync(path.join(__dirname, 'binaries/calc.exe'));
  new Uint8Array(memory.buffer).set(pe, e.get_staging());
  assert(e.load_pe(pe.length), 'PE initializes normal API and continuation thunks');
  e.init_dx_com_thunks();
  const read = p => e.guest_read32(p) >>> 0;
  const write = (p, n) => e.guest_write32(p, n >>> 0);
  const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert(p); return p; };
  const zero = (p, n) => { for (let i = 0; i < n; i += 4) write(p + i, 0); };
  const guard = n => {
    const base = alloc(n + 8), p = base + 4;
    for (let i = 0; i < n + 8; i += 4) write(base + i, POISON);
    return { p, check: () => {
      assert.strictEqual(read(base), POISON, 'leading output guard');
      assert.strictEqual(read(p + n), POISON, 'trailing output guard');
    } };
  };
  const guid = words => { const p = alloc(16); words.forEach((n, i) => write(p + 4 * i, n)); return p; };
  const iid7 = guid([0x15e65ec0, 0x11d23b9c, 0x60002fb9, 0x5bea9797]);
  const iidSurface1 = guid([0x6c14db81, 0x11cea733, 0x200021a5, 0x60e50baf]);
  const iidSurface2 = guid([0x57805885, 0x11cf6eec, 0x23a84194, 0x270ec103]);
  const iidSurface3 = guid([0xda044e00, 0x11d069b2, 0xaa00d5a1, 0xbbdfb800]);
  const stack = alloc(8192) + 4096;

  // Each operation executes PUSH arguments + indirect CALL from x86. No
  // handler/helper exports, seeded vtables, or synthetic surface records.
  // Unique code allocations avoid relying on guest code-cache invalidation.
  function invoke(label, args, object, slot, target) {
    const code = [], word = n => code.push(n & 255, (n >>> 8) & 255,
      (n >>> 16) & 255, n >>> 24);
    for (const arg of args.slice().reverse()) { code.push(0x68); word(arg); }
    let vtable = 0;
    if (object) {
      vtable = read(object); target = read(vtable + slot * 4);
      assert(vtable && target, `${label}: published vtable/slot`);
      code.push(0xb8); word(object); // mov eax,this
      code.push(0x8b, 0x00, 0xff, 0x90); word(slot * 4); // call [vtable+slot]
    } else { code.push(0xb8); word(target); code.push(0xff, 0xd0); }
    const result = alloc(8);
    code.push(0xa3); word(result); // mov [result],eax
    code.push(0x89, 0x25); word(result + 4); // mov [result+4],esp
    code.push(0xc3);
    const pc = alloc(code.length + 4);
    code.forEach((b, i) => e.guest_write8(pc + i, b));
    e.set_esp(stack);
    e.call_func(pc, 0, 0, 0, 0);
    for (let n = 0; n < 100 && e.get_eip(); n++) e.run(10000);
    const row = { label, object, vtable, slot, target, result: read(result),
      esp: read(result + 4), finalEsp: e.get_esp() >>> 0, eip: e.get_eip() >>> 0 };
    trace.push(row);
    assert.strictEqual(row.eip, 0, `${label}: bounded guest completion`);
    assert.strictEqual(row.esp, stack - 20, `${label}: exact stdcall cleanup`);
    assert.strictEqual(row.finalEsp, stack - 16, `${label}: caller RET`);
    return row.result;
  }
  const com = (obj, slot, ...args) => invoke(`COM slot ${slot}`, [obj, ...args], obj, slot);
  const ok = (hr, label) => assert.strictEqual(hr, 0, label);
  const out = guard(4);
  // Catalog thunk routing exercises public dispatch, not PE IAT/EAT resolution.
  const thunkWa = regions.BASE.THUNK_BASE;
  const thunk = (thunkWa - e.get_guest_base() + e.get_image_base()) >>> 0;
  const dv = new DataView(memory.buffer), saved = dv.getUint32(thunkWa + 4, true);
  function api(name, ...args) {
    const entry = apiTable.find(a => a.name === name); assert(entry);
    try {
      dv.setUint32(thunkWa + 4, entry.id, true);
      return invoke(name, args, 0, null, thunk);
    } finally { dv.setUint32(thunkWa + 4, saved, true); }
  }
  ok(api('DirectDrawCreateEx', 0, out.p, iid7, 0), 'factory');
  out.check();
  const dd = read(out.p); assert(dd && dd !== POISON);
  ok(com(dd, 20, 0, 8), 'DDSCL_NORMAL cooperative level');

  function desc(caps, caps2 = 0, mipCount = 0, backCount = 0) {
    const p = alloc(124); zero(p, 124);
    write(p, 124); write(p + 4, 0x1007 | (mipCount ? 0x20000 : 0) | (backCount ? 0x20 : 0));
    write(p + 8, 4); write(p + 12, 4); write(p + 20, backCount); write(p + 24, mipCount);
    write(p + 72, 32); write(p + 76, 0x40); write(p + 84, 32);
    write(p + 88, 0xff0000); write(p + 92, 0xff00); write(p + 96, 0xff);
    write(p + 104, caps); write(p + 108, caps2); return p;
  }
  function create(p) {
    write(out.p, POISON); ok(com(dd, 6, p, out.p, 0), 'CreateSurface'); out.check();
    const obj = read(out.p); assert(obj && obj !== POISON); return obj;
  }
  function caps(obj, size = 16) {
    const b = guard(size); ok(com(obj, 14, b.p), 'GetCaps'); b.check();
    return Array.from({ length: size / 4 }, (_, i) => read(b.p + 4 * i));
  }
  function describe(obj, size = 124) {
    const b = guard(size); write(b.p, size);
    ok(com(obj, 22, b.p), 'GetSurfaceDesc'); b.check();
    assert.strictEqual(read(b.p), size, 'descriptor ABI size');
    return b.p;
  }
  function attached(obj, caps1, caps2 = 0, success = true) {
    const q = alloc(16); zero(q, 16); write(q, caps1); write(q + 4, caps2);
    write(out.p, POISON);
    const hr = com(obj, 12, q, out.p); out.check();
    trace.push({ operation: 'GetAttachedSurface', obj, caps1, caps2, hr, output: read(out.p) });
    if (!success) {
      // Learn says ambiguous matches fail; it does not assign a unique HRESULT
      // or guarantee failed-output contents. Do not invent either expectation.
      assert(hr & 0x80000000, 'missing/ambiguous attachment must fail'); return 0;
    }
    ok(hr, 'GetAttachedSurface'); const p = read(out.p); assert(p && p !== POISON); return p;
  }
  function pixels(obj, expected, set = false, dimension = 4) {
    const b = guard(124); write(b.p, 124);
    ok(com(obj, 25, 0, b.p, 1, 0), 'Lock'); b.check();
    assert.strictEqual(read(b.p + 12), dimension); assert.strictEqual(read(b.p + 8), dimension);
    const pitch = read(b.p + 16), data = read(b.p + 36);
    assert(pitch >= dimension * 4 && data, '32-bit storage with usable pitch');
    for (let y = 0; y < dimension; y++) for (let x = 0; x < dimension; x++) {
      const p = data + y * pitch + x * 4;
      if (set) write(p, expected); else assert.strictEqual(read(p), expected, 'independent face contents');
    }
    ok(com(obj, 32, 0), 'Unlock'); return data;
  }
  // Ordinary 2D succeeds independently of cube support. Older interfaces must
  // not overwrite the next DWORD of a DDSCAPS (4-byte) caller allocation.
  const plain = create(desc(C.texture | C.system));
  assert.strictEqual(caps(plain)[1], 0, 'ordinary Surface7 caps2');
  assert.strictEqual(read(describe(plain) + 108), 0);
  pixels(plain, 0x123456, true); pixels(plain, 0x123456);
  attached(plain, C.texture, C.cube | faceBits[0], false);
  for (const iid of [iidSurface1, iidSurface2, iidSurface3]) {
    ok(com(plain, 0, iid, out.p), 'QI legacy surface'); out.check();
    const legacy = read(out.p); assert(legacy);
    assert(caps(legacy, 4)[0] & C.texture);
    describe(legacy, 108); com(legacy, 2);
  }
  com(plain, 2);
  const mip = create(desc(C.texture | C.system | C.complex | C.mip, 0, 3));
  const mip1 = attached(mip, C.texture | C.mip), mip2 = attached(mip1, C.texture | C.mip);
  pixels(mip, 0x112233, true); pixels(mip1, 0x445566, true, 2); pixels(mip2, 0x778899, true, 1);
  pixels(mip, 0x112233); pixels(mip1, 0x445566, false, 2); pixels(mip2, 0x778899, false, 1);
  attached(mip2, C.texture | C.mip, 0, false);
  com(mip2, 2); com(mip1, 2); com(mip, 2);

  // Real flip-chain control: set exclusive mode using a real guest-created
  // window, rather than manufacturing primary/backbuffer records in WAT.
  const className = alloc(8);
  Buffer.from('static\0').forEach((b, i) => e.guest_write8(className + i, b));
  const hwnd = api('CreateWindowExA', 0, className, 0, 0x80000000,
    0, 0, 640, 480, 0, 0, 0, 0);
  assert(hwnd, 'flip control window');
  ok(com(dd, 20, hwnd, 0x11), 'DDSCL_EXCLUSIVE | DDSCL_FULLSCREEN');
  ok(com(dd, 21, 640, 480, 32, 0, 0), 'SetDisplayMode');
  const flipDesc = alloc(124); zero(flipDesc, 124);
  write(flipDesc, 124); write(flipDesc + 4, 0x21); write(flipDesc + 20, 1);
  write(flipDesc + 104, 0x200 | C.flip | C.complex);
  const front = create(flipDesc), back = attached(front, C.back);
  assert.notStrictEqual(front, back); assert(caps(back)[0] & C.back);
  com(front, 2); // a caller-held attachment remains usable after root release
  assert.strictEqual(read(describe(back) + 12), 640);
  com(back, 2);
  ok(com(dd, 19), 'RestoreDisplayMode');
  ok(com(dd, 20, hwnd, 8), 'return to DDSCL_NORMAL');
  assert(api('DestroyWindow', hwnd), 'destroy flip control window');

  const root = create(desc(C.texture | C.system | C.complex, C.cube | C.all));
  const rootCaps = caps(root), rootDesc = describe(root);
  assert(rootCaps[1] & C.cube);
  assert.strictEqual(read(rootDesc + 108), rootCaps[1], 'descriptor/caps2 agree');
  const rootFace = rootCaps[1] & C.all;
  assert(faceBits.includes(rootFace), 'creation root identifies exactly one face');
  const faces = faceBits.map((bit, i) => {
    let p;
    if (bit === rootFace) { p = root; com(p, 1); } // own distinct caller reference
    else p = attached(root, C.texture, C.cube | bit);
    const c = caps(p), d = describe(p);
    assert.strictEqual(c[1] & C.all, bit, `${faceNames[i]} identity`);
    assert.strictEqual(read(d + 108), c[1]);
    return p;
  });
  assert.strictEqual(new Set(faces).size, 6, 'same caps DWORD, different caps2 resolve six faces');
  const storage = faces.map((p, i) => pixels(p, colors[i], true));
  assert.strictEqual(new Set(storage).size, 6, 'six independent live lock allocations');
  faces.forEach((p, i) => pixels(p, colors[i]));
  colors[0] = 0x102938; pixels(faces[0], colors[0], true);
  faces.forEach((p, i) => pixels(p, colors[i]));
  attached(root, C.texture, C.cube, false); // more than one face matches
  const otherIndex = faceBits.findIndex(bit => bit !== rootFace), other = faces[otherIndex];
  const before = com(other, 1); com(other, 2); // debug count baseline, no net reference
  const extra = attached(root, C.texture, C.cube | faceBits[otherIndex]);
  const after = com(other, 1); com(other, 2);
  assert.strictEqual(after, before + 1, 'GetAttachedSurface owns one added reference');
  com(extra, 2); pixels(other, colors[otherIndex]);
  com(root, 2); // release creation ownership, retain six explicitly owned interfaces
  faces.forEach((p, i) => pixels(p, colors[i]));
  com(root, 2); // drop the explicit root-face reference as well
  faces.forEach((p, i) => { if (p !== root) pixels(p, colors[i]); });
  faces.filter(p => p !== root).forEach(p => com(p, 2));
  com(dd, 2); // no methods called on released pointers
  console.log('PASS DirectDraw7 cube API/storage candidate (no renderer qualification)');
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; })
  .finally(() => console.log(JSON.stringify({ route: 'guest-x86 COM/catalog factory', trace }, null, 2)));
