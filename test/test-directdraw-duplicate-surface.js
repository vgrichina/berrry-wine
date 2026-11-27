#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { bootRenderHarness } = require('./render-helper');
const { makeFixture, iat } = require('../tools/kernel32-native-fixture');

// Contract: https://learn.microsoft.com/en-us/windows/win32/api/ddraw/nf-ddraw-idirectdraw7-duplicatesurface
// HRESULT literals: Microsoft's WinSDK ddraw.h, MAKE_DDHRESULT(583/130).
// Complete canonical module, no extra WAT, source rewrites or private state
// access. All surface observations use real guest x86 COM vtable dispatch.
(async () => {
  const moduleBytes = process.env.DDRAW_TEST_MODULE && fs.readFileSync(process.env.DDRAW_TEST_MODULE);
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none', width: 8, height: 8,
    ...(moduleBytes ? { prebuiltModule: new WebAssembly.Module(moduleBytes) } : {}) });
  if (moduleBytes) console.log('module sha256', crypto.createHash('sha256').update(moduleBytes).digest('hex'));
  const pe = makeFixture();
  new Uint8Array(memory.buffer).set(pe, e.get_staging());
  assert(e.load_pe(pe.length)); e.init_dx_com_thunks(); e.set_api_log(0);
  const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert(p); return p; };
  const w = (p, v) => e.guest_write32(p, v), r = p => e.guest_read32(p) >>> 0;
  const str = s => { const p = alloc(s.length + 1);
    Buffer.from(s + '\0').forEach((v, i) => e.guest_write8(p + i, v)); return p; };
  const stackBase = alloc(512), stack = stackBase + 128;
  const wa = p => e.guest_to_wasm(p) >>> 0;
  let code = alloc(262144), calls = 0;
  const calleeSaved = ['get_ebx', 'get_ebp', 'get_esi', 'get_edi'];
  function call(entry, args) {
    [0x13579bdf, 0x2468ace0, 0x3579bdf1, 0x468ace02].forEach((v, i) =>
      e[calleeSaved[i].replace('get_', 'set_')](v));
    for (let off = 0; off < 512; off += 4) w(stackBase + off, 0x5ac1d00d);
    w(stack, 0); args.forEach((v, i) => w(stack + 4 + i * 4, v));
    w(stack + 4 + args.length * 4, 0xdecafbad);
    const frame = Buffer.from(new Uint8Array(memory.buffer, wa(stackBase), 512));
    const regs = calleeSaved.map(k => e[k]());
    e.set_esp(stack); e.clear_yield(); e.set_eip(entry);
    for (let i = 0; i < 16 && e.get_eip(); i++) e.run(32);
    assert.equal(e.get_eip(), 0, 'returned through guest x86 engine');
    assert.equal(e.get_esp() >>> 0, stack + 4 + args.length * 4, 'stdcall ESP');
    assert.deepEqual(calleeSaved.map(k => e[k]()), regs, 'callee-saved registers');
    assert.deepEqual(Buffer.from(new Uint8Array(memory.buffer, wa(stackBase), 512)), frame, 'complete stack frame/guards');
    calls++; return e.get_eax() >>> 0;
  }
  function com(obj, slot, args = [], receiver = obj) {
    // MOV EAX,obj; MOV EDX,[EAX]; JMP [EDX+slot*4]. The stack contains
    // receiver, permitting invalid-this checks through the actual public slot.
    const bytes = Buffer.from([0xb8, 0, 0, 0, 0, 0x8b, 0x10, 0xff, 0xa2, 0, 0, 0, 0]);
    bytes.writeUInt32LE(obj >>> 0, 1); bytes.writeUInt32LE(slot * 4, 9);
    const pc = code; code += 32;
    bytes.forEach((v, i) => e.guest_write8(pc + i, v));
    return call(pc, [receiver, ...args]);
  }
  const dll = call(r(iat('LoadLibraryA')), [str('ddraw.dll')]); assert(dll);
  const proc = name => { const p = call(r(iat('GetProcAddress')), [dll, str(name)]); assert(p); return p; };
  const out = alloc(16), desc = alloc(124), query = alloc(124), fx = alloc(100), caps = alloc(16);
  assert.equal(call(proc('DirectDrawCreate'), [0, out, 0]), 0);
  const dd = r(out);
  function create(c = 0x40, size = 108, owner = dd, extra = {}) {
    for (let i = 0; i < 124; i += 4) w(desc + i, 0);
    for (const [off, val] of Object.entries({ 0: size, 4: 0x1007, 8: 4, 12: 8,
      72: 32, 76: 0x40, 84: 32, 88: 0xff0000, 92: 0xff00, 96: 0xff, 104: c, ...extra })) w(desc + Number(off), val);
    assert.equal(com(owner, 6, [desc, out, 0]), 0, 'CreateSurface'); return r(out);
  }
  const release = obj => com(obj, 2);
  const duplicate = (obj, owner = dd) => { assert.equal(com(owner, 7, [obj, out + 4]), 0, 'DuplicateSurface DD_OK');
    const p = r(out + 4); assert.notEqual(p, obj, 'distinct COM object'); return p; };
  const getDesc = (obj, size = 108) => { w(query, size); assert.equal(com(obj, 22, [query]), 0);
    return [8, 12, 16, 36, 76, 84, 88, 92, 96, 104].map(n => r(query + n)); };
  function lock(obj, size = 108) {
    w(query, size); assert.equal(com(obj, 25, [0, query, 0, 0]), 0, 'Lock');
    assert.equal(r(query + 8), 4); assert.equal(r(query + 12), 8); assert.equal(r(query + 16), 32);
    const bits = r(query + 36); assert(bits); return bits;
  }
  const unlock = obj => assert.equal(com(obj, 32, [0]), 0, 'Unlock');
  const fill = (obj, value) => { w(fx, 100); w(fx + 80, value);
    assert.equal(com(obj, 5, [0, 0, 0, 0x400, fx]), 0, 'Blt COLORFILL'); };
  const first = create();
  if (process.argv.includes('--expect-unimplemented')) {
    assert.throws(() => com(dd, 7, [first, out + 4]), WebAssembly.RuntimeError);
    console.log('PASS baseline public x86 COM vtable DuplicateSurface traps'); return;
  }
  assert.equal(release(first), 0);

  // Shared edits, independent references, chained duplicates and both orders.
  // Arena reuse after the final Release is observed through new public Locks.
  for (const storage of [0x40, 0x840]) for (const originalFirst of [false, true]) {
    const a = create(storage), b = duplicate(a), c = duplicate(b);
    assert.notEqual(a, c); assert.notEqual(b, c);
    assert.deepEqual(getDesc(a), getDesc(b));
    let bits = lock(a); w(bits, 0x00112233); w(bits + 124, 0x00445566); unlock(a);
    assert.equal(lock(b), bits); assert.equal(r(bits), 0x00112233); assert.equal(r(bits + 124), 0x00445566);
    w(bits + 4, 0x00778899); unlock(b);
    assert.equal(lock(a), bits); assert.equal(r(bits + 4), 0x00778899); unlock(a);
    fill(c, 0x00010203); assert.equal(lock(b), bits); assert.equal(r(bits + 124), 0x00010203); unlock(b);
    assert.equal(com(a, 1), 2, 'AddRef belongs to a only');
    assert.equal(release(a), 1);
    const dead = originalFirst ? a : b, live = originalFirst ? b : a;
    assert.equal(release(dead), 0, 'duplicate did not AddRef source');
    assert.equal(com(dd, 7, [dead, out + 4]), 0x88760082, 'stale source DDERR_INVALIDOBJECT');
    // A new allocation must not reuse or overwrite retained shared bytes.
    const other = create(storage); fill(other, 0x00abcdef);
    assert.notEqual(lock(other), bits); unlock(other);
    assert.equal(lock(live), bits); assert.equal(r(bits), 0x00010203); unlock(live);
    assert.equal(release(live), 0); assert.equal(lock(c), bits); assert.equal(r(bits), 0x00010203); unlock(c);
    assert.equal(release(c), 0); assert.equal(release(other), 0);
    // DIB uses address order; the small heap uses FIFO size bins. Allow the
    // other just-freed surface to be returned first, retaining each candidate
    // so it cannot cycle. This checks emulator reclamation, not a Windows
    // address-allocation promise.
    {
      const fresh = [];
      let reclaimed = false;
      for (let n = 0; n < 4 && !reclaimed; n++) {
        const obj = create(storage); fresh.push(obj); const p = lock(obj);
        if (p === bits) { reclaimed = true; assert.equal(r(p), 0, 'reallocated storage initialized'); }
        unlock(obj);
      }
      assert(reclaimed, 'last object frees backing storage');
      fresh.forEach(obj => assert.equal(release(obj), 0));
    }
  }

  // Replacing one object's storage leaves the other object's old allocation
  // alive. Exercise public Surface3 SetSurfaceDesc in each replacement order.
  const iid3 = alloc(16);
  [0xda044e00, 0x11d069b2, 0xaa00d5a1, 0xbbdfb800].forEach((v, i) => w(iid3 + i * 4, v));
  const external = alloc(128);
  for (const replaceOriginal of [false, true]) {
    const a = create(), b = duplicate(a), chosen = replaceOriginal ? a : b, retained = replaceOriginal ? b : a;
    const bits = lock(retained); w(bits, 0x00334455); unlock(retained);
    assert.equal(com(chosen, 0, [iid3, out]), 0); const view = r(out);
    for (let i = 0; i < 108; i += 4) w(desc + i, 0);
    w(desc, 108); w(desc + 4, 0x800); w(desc + 36, external);
    assert.equal(com(view, 39, [desc, 0]), 0, 'SetSurfaceDesc');
    assert.equal(lock(view), external); w(external, 0x00667788); unlock(view);
    assert.equal(lock(retained), bits); assert.equal(r(bits), 0x00334455); unlock(retained);
    release(view); assert.equal(release(chosen), 0); assert.equal(release(retained), 0);
    assert.equal(r(external), 0x00667788, 'client storage outlives objects');
    const fresh = create(); assert.equal(lock(fresh), bits, 'detached shared allocation reclaimed'); unlock(fresh); release(fresh);
  }
  for (const storage of [0x40, 0x840]) {
    const a = create(storage), b = duplicate(a), bits = lock(a); unlock(a);
    assert.equal(com(b, 0, [iid3, out]), 0); const view = r(out);
    w(desc, 108); w(desc + 4, 0x800); w(desc + 36, external);
    assert.equal(com(view, 39, [desc, 0]), 0);
    w(desc + 36, bits); assert.equal(com(view, 39, [desc, 0]), 0, 'reattach retained backing');
    release(view); assert.equal(release(a), 0);
    assert.equal(lock(b), bits); w(bits, 0x00556677); unlock(b); assert.equal(release(b), 0);
    const fresh = []; let reclaimed = false;
    for (let n = 0; n < 4 && !reclaimed; n++) {
      const obj = create(storage); fresh.push(obj); reclaimed = lock(obj) === bits; unlock(obj);
    }
    assert(reclaimed, 'allocator ownership follows shared storage across reattachment'); fresh.forEach(release);
  }

  // Documented exclusions; implicit identity persists if parent is released.
  for (const c of [0x200, 0x2040]) {
    const a = create(c); assert.equal(com(dd, 7, [a, out + 4]), 0x88760247, 'DDERR_CANTDUPLICATE'); release(a);
  }
  const parent = create(0x4218, 108, dd, { 4: 0x1021, 20: 1 });
  w(caps, 4); assert.equal(com(parent, 12, [caps, out]), 0); const implicit = r(out);
  assert.equal(com(dd, 7, [implicit, out + 4]), 0x88760247); release(parent);
  assert.equal(com(dd, 7, [implicit, out + 4]), 0x88760247); release(implicit);
  const mipRoot = create(0x401008, 108, dd, { 4: 0x21007, 24: 2 });
  w(caps, 0x401000); assert.equal(com(mipRoot, 12, [caps, out]), 0); const mip = r(out);
  assert.equal(com(dd, 7, [mip, out + 4]), 0x88760247); release(mipRoot);
  assert.equal(com(dd, 7, [mip, out + 4]), 0x88760247); release(mip);
  const a = create();
  assert.equal(com(dd, 7, [a, 0]), 0x80070057, 'NULL output DDERR_INVALIDPARAMS');
  for (const bad of [0, a + 1, 0xdeadbeef, dd]) assert.equal(com(dd, 7, [bad, out]), 0x88760082);
  for (const bad of [0, a, dd + 1, 0xdeadbeef]) assert.equal(com(dd, 7, [a, out], bad), 0x88760082);
  release(a);

  // Keys are object-local: changing one duplicate's key cannot change the
  // other object's keyed Blt, although both read the same source pixels.
  const ka = create(), kb = duplicate(ka), target = create(), key = alloc(8);
  const pixels = lock(ka); w(pixels, 0x00112233); w(pixels + 4, 0x00445566); unlock(ka);
  w(key, 0x00112233); w(key + 4, 0x00112233); assert.equal(com(ka, 29, [8, key]), 0);
  w(key, 0x00445566); w(key + 4, 0x00445566); assert.equal(com(kb, 29, [8, key]), 0);
  for (const [source, expected] of [[ka, [0x00abcdef, 0x00445566]], [kb, [0x00112233, 0x00abcdef]]]) {
    fill(target, 0x00abcdef); assert.equal(com(target, 5, [0, source, 0, 0x8000, 0]), 0);
    const bits = lock(target); assert.deepEqual([r(bits), r(bits + 4)], expected); unlock(target);
  }
  release(ka); release(kb); release(target);

  // One ordinary GetDC/ReleaseDC pair, no repeated acquisition, wrong HDC or
  // final Release with a DC held (the separate reference-request lane).
  const gdi = call(r(iat('LoadLibraryA')), [str('gdi32.dll')]); assert(gdi);
  const setPixel = call(r(iat('GetProcAddress')), [gdi, str('SetPixel')]); assert(setPixel);
  const ga = create(), gb = duplicate(ga);
  assert.equal(com(ga, 17, [out]), 0); const hdc = r(out); assert(hdc);
  assert.equal(call(setPixel, [hdc, 0, 0, 0x00332211]), 0x00332211);
  assert.equal(com(ga, 26, [hdc]), 0);
  const gbits = lock(gb); assert.equal(r(gbits), 0x00112233, 'GDI edit visible through duplicate Lock'); unlock(gb);
  release(ga); release(gb);

  // Native v4/v7 descriptor size comes from the receiving DirectDraw view.
  for (const iid of [[0x9c59509a, 0x11d139bd, 0xc0004a8c, 0xc530d94f],
    [0x15e65ec0, 0x11d23b9c, 0x60002fb9, 0x5bea9797]]) {
    const id = alloc(16); iid.forEach((v, i) => w(id + i * 4, v));
    assert.equal(com(dd, 0, [id, out]), 0); const owner = r(out), a = create(0x40, 124, owner), b = duplicate(a, owner);
    assert.deepEqual(getDesc(a, 124), getDesc(b, 124)); const bits = lock(a, 124); unlock(a);
    assert.equal(lock(b, 124), bits); unlock(b);
    release(a); release(b); release(owner);
  }
  assert.equal(release(dd), 0);
  console.log(`PASS DuplicateSurface public x86 COM: shared edits, chains, both release/replacement orders, final arena reclamation, exclusions, stale objects, native views; ${calls} ABI-checked calls`);
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
