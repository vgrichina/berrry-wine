#!/usr/bin/env node
'use strict';

// Authored native Surface4/7 ABI guest candidate; source-only until run.
// Run only in the coordinator's serialized runtime lane. See the design note.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');
const regions = require('../lib/region-map.generated');
const apiTable = require('../src/api_table.json');
const { methodArity } = require('./surface47-abi-contract');
const C = { texture: 0x1000, complex: 8, system: 0x800, mip: 0x400000,
  flip: 0x10, back: 4, cube: 0x200, all: 0xfc00 };
const faceBits = [0x400, 0x800, 0x1000, 0x2000, 0x4000, 0x8000];
const faceNames = ['+X', '-X', '+Y', '-Y', '+Z', '-Z'];
const colors = [0xff1020, 0x20ff30, 0x3040ff, 0xffe050, 0x60ffee, 0xee70ff];
const POISON = 0xa5a5a5a5;
const trace = [];
const tailCalls = !process.argv.includes('--compat');

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none', tailCalls });
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
  const iid4 = guid([0x9c59509a, 0x11d139bd, 0xc0004a8c, 0xc530d94f]);
  const iid1 = guid([0x6c14db80, 0x11cea733, 0x200021a5, 0x60e50baf]);
  const iidSurface4 = guid([0x0b2b8630, 0x11d0ad35, 0x6000a68e, 0x5bea9797]);
  const iidSurface7 = guid([0x06675a80, 0x11d23b9b, 0x60002fb9, 0x5bea9797]);
  const iidUnknown = guid([0, 0, 0xc0, 0x46000000]);
  const iidTexture2 = guid([0x93281502, 0x11d08cf8, 0xa000ab89, 0x294105c9]);
  const iidSurface1 = guid([0x6c14db81, 0x11cea733, 0x200021a5, 0x60e50baf]);
  const iidSurface2 = guid([0x57805885, 0x11cf6eec, 0x23a84194, 0x270ec103]);
  const iidSurface3 = guid([0xda044e00, 0x11d069b2, 0xaa00d5a1, 0xbbdfb800]);
  const stack = alloc(8192) + 4096;
  const directDrawVersions = new Map(); // Published vtable -> independently acquired IID version.

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
      // Check the published method against an independent COM ABI contract.
      // A wrong slot must not consume a different number of guest arguments.
      const targetWa = (target - e.get_image_base() + e.get_guest_base()) >>> 0;
      const thunkView = new DataView(memory.buffer);
      assert.strictEqual(thunkView.getUint32(targetWa, true), 0xcaca0010,
        `${label}: COM thunk marker`);
      const method = apiTable[thunkView.getUint32(targetWa + 4, true)];
      assert(method, `${label}: published API identity`);
      assert.strictEqual(args.length, methodArity(method.name, directDrawVersions.get(vtable)),
        `${method.name}: COM argument count including this`);
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
  directDrawVersions.set(read(dd), 7);
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
  function displayMode(obj, size) {
    const b = guard(size); write(b.p, size);
    // invoke() checks exact stdcall ESP and final caller ESP for every call,
    // including the failure below; both buffers have leading/trailing guards.
    ok(com(obj, 12, b.p), 'GetDisplayMode'); b.check();
    assert.strictEqual(read(b.p), size, 'GetDisplayMode versioned dwSize');
    assert.strictEqual(read(b.p + 4) & 0x1006, 0x1006, 'mode dimensions and format valid');
    assert.strictEqual(read(b.p + 72), 32, 'mode DDPIXELFORMAT size');
    const mode = { width: read(b.p + 12), height: read(b.p + 8),
      pitch: read(b.p + 16), bpp: read(b.p + 84) };
    assert(mode.width > 0 && mode.height > 0);
    assert([8, 16, 24, 32].includes(mode.bpp), 'mode has supported pixel depth');
    assert.strictEqual(mode.pitch, (mode.width * Math.ceil(mode.bpp / 8) + 3) & ~3);
    if (size === 124) {
      for (let offset = 108; offset < 124; offset += 4)
        assert.strictEqual(read(b.p + offset), 0, 'native mode tail initialized');
    }
    const wrongSize = size === 124 ? 108 : 124, wrong = guard(wrongSize);
    write(wrong.p, wrongSize);
    assert.strictEqual(com(obj, 12, wrong.p), 0x80070057, 'GetDisplayMode rejects wrong version size');
    wrong.check();
    assert.strictEqual(read(wrong.p), wrongSize, 'failed mode query leaves header unchanged');
    for (let offset = 4; offset < wrongSize; offset += 4)
      assert.strictEqual(read(wrong.p + offset), POISON, 'failed mode query leaves payload unchanged');
    return mode;
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
  // A real x86 stdcall callback captures the descriptor while it is live.
  // EnumSurfaces passes an owned reference; the test releases it afterwards.
  function captureCallback(surfaceArgs = true) {
    const result = alloc(16); zero(result, 16);
    const code = [], word = n => code.push(n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24);
    const save = (stackOffset, dest, deref) => {
      code.push(0x8b, 0x44, 0x24, stackOffset); // mov eax,[esp+offset]
      if (deref) code.push(0x8b, 0x00); // mov eax,[eax]
      code.push(0xa3); word(result + dest);
    };
    save(surfaceArgs ? 8 : 4, 0, true); // dwSize
    save(surfaceArgs ? 12 : 8, 4, false); // context
    if (surfaceArgs) { save(4, 8, false); save(4, 12, true); }
    code.push(0x31, 0xc0, 0xc2, surfaceArgs ? 12 : 8, 0); // cancel, ret N
    const pc = alloc(code.length); code.forEach((b, i) => e.guest_write8(pc + i, b));
    return { pc, result };
  }
  ok(com(dd, 0, iid4, out.p), 'QI DirectDraw4');
  const dd4 = read(out.p);
  directDrawVersions.set(read(dd4), 4);
  const initialMode = displayMode(dd, 124);
  assert.deepStrictEqual(displayMode(dd4, 124), initialMode, 'DD4 and DD7 report the same mode');
  ok(com(dd4, 6, desc(C.texture | C.system), out.p, 0), 'DirectDraw4 CreateSurface');
  const made4 = read(out.p); caps(made4); describe(made4);
  ok(com(made4, 0, iidSurface4, out.p), 'created Surface4 identity');
  assert.strictEqual(read(out.p), made4); com(made4, 2); com(made4, 2); com(dd4, 2);
  ok(com(dd, 0, iid1, out.p), 'QI DirectDraw1 control');
  const dd1 = read(out.p);
  directDrawVersions.set(read(dd1), 1);
  const legacyDesc = guard(108), template = desc(C.texture | C.system);
  assert.deepStrictEqual(displayMode(dd1, 108), initialMode, 'legacy descriptor reports the same mode');
  for (let k = 0; k < 108; k += 4) write(legacyDesc.p + k, read(template + k));
  write(legacyDesc.p, 108);
  ok(com(dd1, 6, legacyDesc.p, out.p, 0), 'legacy CreateSurface control'); legacyDesc.check();
  const madeLegacy = read(out.p); caps(madeLegacy, 4); describe(madeLegacy, 108);
  ok(com(madeLegacy, 0, iidSurface7, out.p), 'legacy allocation queried as native');
  const upgraded = read(out.p); caps(upgraded); describe(upgraded);
  com(madeLegacy, 2); describe(upgraded); com(upgraded, 2); com(dd1, 2);
  const modes = captureCallback(false);
  ok(com(dd, 8, 0, 0, 0x1234, modes.pc), 'native EnumDisplayModes callback');
  assert.strictEqual(read(modes.result), 124); assert.strictEqual(read(modes.result + 4), 0x1234);
  // Ordinary 2D succeeds independently of cube support. Older interfaces must
  // not overwrite the next DWORD of a DDSCAPS (4-byte) caller allocation.
  const plain = create(desc(C.texture | C.system));
  const enumeration = captureCallback();
  ok(com(dd, 9, 0x11, 0, 0x5678, enumeration.pc), 'native EnumSurfaces callback');
  assert.strictEqual(read(enumeration.result), 124);
  assert.strictEqual(read(enumeration.result + 4), 0x5678);
  assert.strictEqual(read(enumeration.result + 12), read(plain));
  com(read(enumeration.result + 8), 2);
  assert.strictEqual(caps(plain)[1], 0, 'ordinary Surface7 caps2');
  assert.strictEqual(read(describe(plain) + 108), 0);
  pixels(plain, 0x123456, true); pixels(plain, 0x123456);
  attached(plain, C.texture, C.cube | faceBits[0], false);
  for (const iid of [iidSurface1, iidSurface2, iidSurface3]) {
    ok(com(plain, 0, iid, out.p), 'QI legacy surface'); out.check();
    const legacy = read(out.p); assert(legacy);
    assert(caps(legacy, 4)[0] & C.texture);
    describe(legacy, 108);
    const lock = guard(108); write(lock.p, 108);
    ok(com(legacy, 25, 0, lock.p, 1, 0), 'legacy Lock'); lock.check();
    assert.strictEqual(read(lock.p), 108);
    assert.strictEqual(read(read(lock.p + 36)), 0x123456, 'same storage across versions');
    ok(com(legacy, 32, read(lock.p + 36)), 'legacy Unlock takes data pointer');
    const wrong = guard(124); write(wrong.p, 124);
    assert(com(legacy, 22, wrong.p) & 0x80000000); wrong.check();
    ok(com(legacy, 0, iidSurface7, out.p), 'legacy QI back to Surface7');
    assert.strictEqual(read(out.p), plain, 'stable Surface7 identity');
    com(read(out.p), 2); com(legacy, 2);
  }
  ok(com(plain, 0, iidSurface4, out.p), 'QI Surface4');
  const surface4 = read(out.p);
  assert.notStrictEqual(read(surface4), read(plain), 'distinct native v4/v7 vtables');
  assert(read(read(surface4) + 44 * 4), 'Surface4 has all 45 slots');
  assert(read(read(plain) + 48 * 4), 'Surface7 has all 49 slots');
  caps(surface4); describe(surface4); pixels(surface4, 0x123456);
  const replacement = desc(C.texture | C.system);
  write(replacement + 4, 8); write(replacement + 16, 16);
  ok(com(surface4, 39, replacement, 0), 'Surface4 SetSurfaceDesc accepts DDSURFACEDESC2');
  assert.strictEqual(read(describe(surface4) + 16), 16);
  // Wine include/ddraw.h: Surface4 Initialize follows GetSurfaceDesc (22).
  const initializeSlot = 23;
  const initializeThunk = read(read(surface4) + initializeSlot * 4);
  const initializeWa = (initializeThunk - e.get_image_base() + e.get_guest_base()) >>> 0;
  assert.strictEqual(apiTable[dv.getUint32(initializeWa + 4, true)].name,
    'IDirectDrawSurface_Initialize', 'Initialize probe uses its published method');
  assert.strictEqual(com(surface4, initializeSlot, dd, replacement), 0x88760005, 'already initialized');
  ok(com(plain, 0, iidTexture2, out.p), 'surface to texture');
  const texture = read(out.p);
  ok(com(texture, 0, iidSurface4, out.p), 'texture to native Surface4');
  assert.strictEqual(read(out.p), surface4); com(surface4, 2); com(texture, 2);
  const before = com(surface4, 1); com(surface4, 2);
  ok(com(plain, 0, iidSurface4, out.p), 'repeated QI Surface4');
  assert.strictEqual(read(out.p), surface4);
  const after = com(surface4, 1); com(surface4, 2);
  assert.strictEqual(after, before + 1, 'one independent acquired Surface4 reference');
  com(surface4, 2);
  for (const obj of [plain, surface4]) {
    ok(com(obj, 0, iidUnknown, out.p), 'canonical IUnknown');
    assert.strictEqual(read(out.p), plain); com(read(out.p), 2);
    const wrong = guard(108); write(wrong.p, 108);
    assert(com(obj, 22, wrong.p) & 0x80000000); wrong.check();
    assert(com(obj, 25, 0, wrong.p, 1, 0) & 0x80000000); wrong.check();
  }
  for (const iid of [iidSurface1, iidSurface2, iidSurface3, iidSurface4, iidSurface7]) {
    const bad = alloc(16);
    for (let k = 0; k < 4; k++) write(bad + k * 4, read(iid + k * 4));
    write(bad + 12, read(bad + 12) ^ 1);
    assert.strictEqual(com(plain, 0, bad, out.p), 0x80004002, 'full IID required');
    assert.strictEqual(read(out.p), 0); out.check();
  }
  com(plain, 2);
  describe(surface4); pixels(surface4, 0x123456);
  com(surface4, 2);
  const mip = create(desc(C.texture | C.system | C.complex | C.mip, 0, 3));
  const mip1 = attached(mip, C.texture | C.mip), mip2 = attached(mip1, C.texture | C.mip);
  const attachments = captureCallback();
  ok(com(mip, 9, 0x9abc, attachments.pc), 'native EnumAttachedSurfaces callback');
  assert.strictEqual(read(attachments.result), 124);
  assert.strictEqual(read(attachments.result + 4), 0x9abc);
  assert.strictEqual(read(attachments.result + 12), read(mip));
  com(read(attachments.result + 8), 2);
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
  assert.deepStrictEqual(displayMode(dd, 124), { width: 640, height: 480, pitch: 2560, bpp: 32 },
    'GetDisplayMode reports the requested exclusive mode');
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

  const unsupported = desc(C.texture | C.system | C.complex, C.cube | C.all);
  // DDSD_CAPS validates the whole caps field. Garbage in unused fields must
  // neither reject creation nor accidentally request a flip/cube allocation.
  const unusedCaps = desc(POISON, POISON);
  write(unusedCaps + 4, 0x1006);
  write(unusedCaps + 112, POISON); write(unusedCaps + 116, POISON);
  const ignored = create(unusedCaps);
  const ignoredDescription = describe(ignored);
  assert.strictEqual(read(ignoredDescription + 12), 4);
  assert.strictEqual(read(ignoredDescription + 108), 0);
  assert.notStrictEqual(read(ignoredDescription + 104), POISON);
  write(unusedCaps + 4, 8); write(unusedCaps + 16, 16);
  ok(com(ignored, 39, unusedCaps, 0), 'SetSurfaceDesc ignores unused extended caps');
  write(unusedCaps + 4, 9); write(unusedCaps + 16, 20);
  assert.strictEqual(com(ignored, 39, unusedCaps, 0), 0x80004001,
    'SetSurfaceDesc rejects explicitly selected unsupported extended caps');
  assert.strictEqual(read(describe(ignored) + 16), 16, 'failed setter leaves pitch unchanged');
  write(unusedCaps + 4, 0x1007);
  assert.strictEqual(com(dd, 6, unusedCaps, out.p, 0), 0x80004001,
    'same garbage becomes unsupported when DDSD_CAPS is selected');
  assert.strictEqual(read(out.p), 0); out.check(); com(ignored, 2);

  // Deterministic allocator fault injection, not pre-seeded COM objects:
  // only the shared aux cursor is temporarily forced to its declared limit.
  // Every surface, view and failing QI is created/called through guest COM.
  // Derive the private field offset and limit from declarations; region bases
  // always come from the generated map, never from a copied address literal.
  const header = fs.readFileSync(path.join(__dirname, '../src/01-header.wat'), 'utf8');
  const directx = fs.readFileSync(path.join(__dirname, '../src/09a8-handlers-directx.wat'), 'utf8');
  const cursorDecl = header.match(/\(global \$COM_AUX_NEXT_SHARED i32 \(region\.addr \$([A-Z_]+) (0x[0-9A-Fa-f]+)\)\)/);
  const limitDecl = directx.match(/\(global \$COM_WRAPPERS_AUX_MAX i32 \(i32\.const (\d+)\)\)/);
  assert(cursorDecl && limitDecl, 'allocator declarations found');
  const cursorWa = regions.BASE[cursorDecl[1]] + Number(cursorDecl[2]);
  const limit = Number(limitDecl[1]), savedCursor = dv.getUint32(cursorWa, true);
  const owner = create(desc(C.texture | C.system));
  ok(com(owner, 0, iidSurface4, out.p), 'retain view before exhaustion');
  const retained = read(out.p), ownerVtable = read(owner), retainedVtable = read(retained);
  pixels(retained, 0x314159, true);
  const retainedCount = com(retained, 1); com(retained, 2);
  // Save after creating the retained view so restoring does not hide it.
  const populatedCursor = dv.getUint32(cursorWa, true);
  assert(populatedCursor >= savedCursor && populatedCursor < limit);
  try {
    dv.setUint32(cursorWa, limit, true);
    write(out.p, POISON);
    assert.strictEqual(com(owner, 0, iidSurface3, out.p), 0x8007000e, 'wrapper exhaustion fails QI');
    assert.strictEqual(read(out.p), 0); out.check();
    assert.strictEqual(read(owner), ownerVtable, 'primary vtable never mutates on exhaustion');
    assert.strictEqual(read(retained), retainedVtable, 'retained vtable never mutates');
    const countAfter = com(retained, 1); com(retained, 2);
    assert.strictEqual(countAfter, retainedCount, 'failed QI adds no retained-view reference');
    describe(owner); describe(retained); pixels(retained, 0x314159);
    ok(com(owner, 0, iidSurface4, out.p), 'existing view lookup works with pool full');
    assert.strictEqual(read(out.p), retained); com(retained, 2);
    assert.strictEqual(com(owner, 2), 0, 'failed QI adds no primary-interface reference');
    // Independently retained view survives owner release at the allocator limit.
    describe(retained); pixels(retained, 0x314159);
  } finally { dv.setUint32(cursorWa, populatedCursor, true); }
  describe(retained); pixels(retained, 0x314159);
  assert.strictEqual(com(retained, 2), 0, 'retained view releases its last ownership');
  write(out.p, POISON);
  assert(com(dd, 6, unsupported, out.p, 0) & 0x80000000, 'cube fails until storage is implemented');
  out.check(); assert.strictEqual(read(out.p), 0, 'no partial cube published');
  com(dd, 2);
  console.log('PASS native Surface4/7 ABI candidate (cube unsupported)');
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; })
  .finally(() => console.log(JSON.stringify({ route: 'guest-x86 COM/catalog factory',
    dispatch: tailCalls ? 'tail-calls' : 'compat', trace }, null, 2)));
