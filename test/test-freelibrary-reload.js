#!/usr/bin/env node
'use strict';

// Synthetic system modules retain stable handles. Real PE modules have
// references, final detach and fresh state on reload: Alice and Quake II
// unload/reload their game DLLs while restoring a map.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const { loadDll, callDllMain } = require('../lib/dll-loader');
const { handleLoadLibraryYield } = require('../lib/process-boot');
const { guestToWasm: translateGuest } = require('../lib/mem-utils');

const extraWat = String.raw`
  (func (export "test_lifetime_ordinal") (param $index i32) (param $ordinal i32) (result i32)
    (call $resolve_ordinal (local.get $index) (local.get $ordinal)))
  (func (export "test_lifetime_refs") (param $index i32) (result i32)
    (i32.shr_u (i32.atomic.load (i32.add (global.get $DLL_FLAGS_TABLE)
      (i32.shl (local.get $index) (i32.const 2)))) (i32.const 3)))
  (func (export "test_lifetime_GetModuleHandleA") (param $name i32) (result i32)
    (local $sp i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_GetModuleHandleA (local.get $name)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_call_LoadLibraryA") (param $name i32) (result i32)
    (local $sp i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_LoadLibraryA (local.get $name)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_call_FreeLibrary") (param $module i32) (result i32)
    (local $sp i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_FreeLibrary (local.get $module)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (i32.load offset=0 (global.get $reg_base)))
`;

// A real mapped PE, with no entry point or exports. Its file name still
// identifies the module, and its final reference must really be released.
function resourceDll(counter = 0) {
  const b = Buffer.alloc(0x400), pe = 0x80, opt = pe + 24, section = opt + 0xe0;
  b.writeUInt16LE(0x5a4d, 0); b.writeUInt32LE(pe, 0x3c);
  b.writeUInt32LE(0x4550, pe); b.writeUInt16LE(0x14c, pe + 4);
  b.writeUInt16LE(1, pe + 6); b.writeUInt16LE(0xe0, pe + 20);
  b.writeUInt16LE(0x210e, pe + 22); b.writeUInt16LE(0x10b, opt);
  b.writeUInt32LE(0x10000000, opt + 28);
  b.writeUInt32LE(0x1000, opt + 32); b.writeUInt32LE(0x200, opt + 36);
  b.writeUInt32LE(0x2000, opt + 56); b.writeUInt32LE(0x200, opt + 60);
  b.writeUInt32LE(16, opt + 92);
  b.write('.data\0\0\0', section, 'ascii');
  b.writeUInt32LE(0x200, section + 8); b.writeUInt32LE(0x1000, section + 12);
  b.writeUInt32LE(0x200, section + 16); b.writeUInt32LE(0x200, section + 20);
  b.writeUInt32LE(0xc0000040, section + 36);
  b.writeUInt32LE(0x12345678, 0x380);
  if (counter) {
    b.writeUInt32LE(0x1000, opt + 16);
    b.writeUInt32LE(0xe0000060, section + 36);
    // DllMain increments counter[reason & 1], then returns TRUE (stdcall).
    Buffer.from([0x8b,0x44,0x24,0x08,0x83,0xe0,0x01,0xba,
      counter & 255,(counter >>> 8) & 255,(counter >>> 16) & 255,counter >>> 24,
      0xff,0x04,0x82,0xb8,1,0,0,0,0xc2,0x0c,0]).copy(b, 0x200);
  }
  return b;
}

function linkedDll(importsDependency) {
  const b = Buffer.alloc(0x800), pe = 0x80, opt = pe + 24, section = opt + 0xe0;
  resourceDll().copy(b);
  b.writeUInt32LE(0x600, section + 8);
  b.writeUInt32LE(0x600, section + 16);
  b.writeUInt32LE(0xe0000060, section + 36);
  b.write('dep.dll' + String.fromCharCode(0), 0x480, 'ascii');
  if (importsDependency) {
    b.writeUInt32LE(0x1200, opt + 104); b.writeUInt32LE(40, opt + 108);
    b.writeUInt32LE(0x1240, 0x400);
    b.writeUInt32LE(0x1280, 0x40c); b.writeUInt32LE(0x1250, 0x410);
    b.writeUInt32LE(0x1290, 0x440); b.writeUInt32LE(0x1290, 0x450);
    b.write('answer' + String.fromCharCode(0), 0x492, 'ascii');
  } else {
    b.writeUInt32LE(0x1200, opt + 96); b.writeUInt32LE(0x100, opt + 100);
    b.writeUInt32LE(0x1280, 0x40c); b.writeUInt32LE(1, 0x410);
    b.writeUInt32LE(1, 0x414); b.writeUInt32LE(1, 0x418);
    b.writeUInt32LE(0x1240, 0x41c); b.writeUInt32LE(0x1244, 0x420);
    b.writeUInt32LE(0x1248, 0x424);
    b.writeUInt32LE(0x1000, 0x440); b.writeUInt32LE(0x1290, 0x444);
    b.write('answer' + String.fromCharCode(0), 0x490, 'ascii');
    Buffer.from([0xb8,7,0,0,0,0xc3]).copy(b, 0x200);
  }
  return b;
}

function cyclicDll(name, dependency) {
  const b = Buffer.alloc(0xa00), opt = 0x80 + 24, section = opt + 0xe0;
  linkedDll(false).copy(b);
  b.writeUInt32LE(0x800, section + 8); b.writeUInt32LE(0x800, section + 16);
  b.fill(0, 0x480, 0x490); b.write(name + String.fromCharCode(0), 0x480, 'ascii');
  b.writeUInt32LE(0x1400, opt + 104); b.writeUInt32LE(40, opt + 108);
  b.writeUInt32LE(0x1440, 0x600); b.writeUInt32LE(0x1480, 0x60c);
  b.writeUInt32LE(0x1450, 0x610); b.writeUInt32LE(0x1490, 0x640);
  b.writeUInt32LE(0x1490, 0x650);
  b.write(dependency + String.fromCharCode(0), 0x680, 'ascii');
  b.write('answer' + String.fromCharCode(0), 0x692, 'ascii');
  return b;
}

async function main() {
  const { exports: e, memory, hostCtx } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const bytes = new Uint8Array(memory.buffer);
  const guestToWasm = guest => translateGuest(guest, e, memory.buffer, e.get_image_base()) >>> 0;
  const writeAscii = value => {
    const guest = e.guest_alloc(value.length + 1) >>> 0;
    const wasm = guestToWasm(guest);
    for (let i = 0; i < value.length; i++) bytes[wasm + i] = value.charCodeAt(i);
    bytes[wasm + value.length] = 0;
    return guest;
  };

  const ddrawName = writeAscii('ddraw.dll');
  const dsoundName = writeAscii('dsound.dll');
  const ddraw = e.test_call_LoadLibraryA(ddrawName) >>> 0;
  const dsound = e.test_call_LoadLibraryA(dsoundName) >>> 0;
  assert(ddraw && dsound && ddraw !== dsound, 'static modules receive distinct handles');

  assert.strictEqual(e.test_call_FreeLibrary(0), 0,
    'a null module handle is never a successful unload');
  assert.strictEqual(e.test_call_FreeLibrary(ddraw), 1,
    'the first unload of a live handle succeeds');
  e.test_call_LoadLibraryA(dsoundName);
  assert.strictEqual(e.test_call_FreeLibrary(ddraw), 0,
    'loading a different module does not re-arm an already freed handle');

  assert.strictEqual(e.test_call_LoadLibraryA(ddrawName) >>> 0, ddraw,
    'a resident module is loaded again at the same handle');
  assert.strictEqual(e.test_call_FreeLibrary(ddraw), 1,
    'the reloaded handle has a fresh unload lifetime');
  assert.strictEqual(e.test_call_FreeLibrary(ddraw), 0,
    'a consecutive repeated unload still terminates NSIS-style loops');

  const mapped = loadDll(e, memory.buffer, resourceDll(), 'lifetime.dll');
  const mappedName = writeAscii('lifetime.dll');
  assert.strictEqual(e.test_lifetime_GetModuleHandleA(mappedName) >>> 0, mapped.loadAddr >>> 0,
    'a mapped PE is discoverable by its file name before unload');
  assert.strictEqual(e.test_call_LoadLibraryA(mappedName) >>> 0, mapped.loadAddr >>> 0);
  assert.strictEqual(e.test_call_FreeLibrary(mapped.loadAddr), 1);
  assert.strictEqual(e.test_lifetime_GetModuleHandleA(mappedName) >>> 0, mapped.loadAddr >>> 0,
    'the first release preserves a DLL with a second reference');
  assert.strictEqual(e.test_call_FreeLibrary(mapped.loadAddr), 1);
  assert.strictEqual(e.test_lifetime_GetModuleHandleA(mappedName), 0,
    'final FreeLibrary must remove the real PE from loaded-module lookup');
  assert.strictEqual(e.test_call_FreeLibrary(mapped.loadAddr), 0,
    'an unloaded real handle is invalid');
  assert.strictEqual(new DataView(memory.buffer).getUint32(e.get_dll_table() + 8, true), 0,
    'retired rows advertise no export directory to legacy table readers');

  const highWater = e.get_dll_count();
  for (let i = 0; i < e.get_dll_capacity() + 2; i++) {
    const again = loadDll(e, memory.buffer, resourceDll(), 'lifetime.dll');
    assert.strictEqual(e.test_call_FreeLibrary(again.loadAddr), 1);
  }
  assert.strictEqual(e.get_dll_count(), highWater, 'reloads reuse retired table slots');

  const dv = new DataView(memory.buffer), counter = e.guest_alloc(8) >>> 0;
  dv.setUint32(guestToWasm(counter), 0, true);
  dv.setUint32(guestToWasm(counter + 4), 0, true);
  const fixture = resourceDll(counter), name = writeAscii('entrylife.dll');
  hostCtx.vfs.files.set('c:\\entrylife.dll', { data: fixture });
  const first = loadDll(e, memory.buffer, fixture, 'entrylife.dll');
  callDllMain(e, first.loadAddr, first.dllMain);
  assert.strictEqual(dv.getUint32(guestToWasm(counter + 4), true), 1, 'initial attach');
  dv.setUint32(guestToWasm(first.loadAddr + 0x1180), 0x77777777, true);
  e.test_call_FreeLibrary(first.loadAddr);
  assert.strictEqual(e.get_yield_reason(), 5, 'detach uses the shared loader service');
  await handleLoadLibraryYield({ exports: e, memoryBuffer: memory.buffer });
  assert.strictEqual(dv.getUint32(guestToWasm(counter), true), 1, 'one final detach');
  assert.strictEqual(e.test_lifetime_GetModuleHandleA(name), 0);
  e.test_call_LoadLibraryA(name);
  assert.strictEqual(e.get_yield_reason(), 5);
  await handleLoadLibraryYield({ exports: e, memoryBuffer: memory.buffer,
    findDll: async () => fixture });
  const second = e.get_eax() >>> 0;
  assert(second);
  assert.strictEqual(dv.getUint32(guestToWasm(counter + 4), true), 2, 'reload attaches again');
  assert.strictEqual(dv.getUint32(guestToWasm(second + 0x1180), true), 0x12345678,
    'reload restores original data rather than stale globals');

  const dependency = loadDll(e, memory.buffer, linkedDll(false), 'dep.dll');
  const dependent = loadDll(e, memory.buffer, linkedDll(true), 'parent.dll');
  const sibling = loadDll(e, memory.buffer, linkedDll(true), 'sibling.dll');
  const dependencyName = writeAscii('dep.dll');
  const dependencyIndex = (() => {
    for (let i = 0; i < e.get_dll_count(); i++) {
      if (dv.getUint32(e.get_dll_table() + i * 32, true) === dependency.loadAddr) return i;
    }
    throw new Error('dependency table row missing');
  })();
  for (let repeat = 0; repeat < 3; repeat++) {
    e.patch_caller_iat(dependent.loadAddr, 0x1200, dependencyName, dependencyIndex);
  }
  assert.strictEqual(e.test_lifetime_ordinal(dependencyIndex, 1) >>> 0,
    (dependency.loadAddr + 0x1000) >>> 0, 'ordinal lookup still reads the PE export metadata');
  assert.strictEqual(e.test_lifetime_ordinal(dependencyIndex, 0), 0);
  assert.strictEqual(e.test_lifetime_ordinal(dependencyIndex, 2), 0);
  assert.strictEqual(e.test_lifetime_refs(dependencyIndex), 3,
    'one explicit reference and two distinct importers retain the dependency');
  assert.strictEqual(dv.getUint32(guestToWasm(dependent.loadAddr + 0x1250), true),
    (dependency.loadAddr + 0x1000) >>> 0, 'parent import binds the real dependency export');
  assert.strictEqual(e.test_lifetime_GetModuleHandleA(dependencyName) >>> 0,
    dependency.loadAddr >>> 0, 'dependency lookup before release');
  assert.strictEqual(e.test_call_FreeLibrary(dependency.loadAddr), 1);
  assert.strictEqual(e.test_lifetime_refs(dependencyIndex), 2, 'explicit release leaves both importer references');
  assert.strictEqual(e.test_lifetime_GetModuleHandleA(dependencyName) >>> 0,
    dependency.loadAddr >>> 0, 'a live importer keeps the dependency mapped after its explicit reference is released');
  e.test_call_FreeLibrary(dependent.loadAddr);
  assert.strictEqual(e.get_yield_reason(), 5, 'dependency release uses the loader service even without a parent entrypoint');
  await handleLoadLibraryYield({ exports: e, memoryBuffer: memory.buffer });
  assert.strictEqual(e.get_eax(), 1, 'parent release reports success after the loader service completes');
  assert.strictEqual(e.test_lifetime_GetModuleHandleA(dependencyName) >>> 0,
    dependency.loadAddr >>> 0, 'another importer retains the shared dependency');
  e.test_call_FreeLibrary(sibling.loadAddr);
  await handleLoadLibraryYield({ exports: e, memoryBuffer: memory.buffer });
  assert.strictEqual(e.test_lifetime_GetModuleHandleA(dependencyName), 0,
    'retiring the last importer releases the dependency; repeated IAT patches do not leak references');

  // Both DLLs retain one another through imports. Their last explicit
  // reference must release the group rather than leak the cycle forever.
  const cycleA = loadDll(e, memory.buffer, cyclicDll('cyclea.dll', 'cycleb.dll'), 'cyclea.dll');
  const cycleB = loadDll(e, memory.buffer, cyclicDll('cycleb.dll', 'cyclea.dll'), 'cycleb.dll');
  const cycleAName = writeAscii('cyclea.dll'), cycleBName = writeAscii('cycleb.dll');
  let cycleBIndex = -1;
  for (let i = 0; i < e.get_dll_count(); i++) {
    if (dv.getUint32(e.get_dll_table() + i * 32, true) === cycleB.loadAddr) cycleBIndex = i;
  }
  assert(cycleBIndex >= 0);
  e.patch_caller_iat(cycleA.loadAddr, 0x1400, cycleBName, cycleBIndex);
  assert.strictEqual(dv.getUint32(guestToWasm(cycleA.loadAddr + 0x1450), true), cycleB.loadAddr + 0x1000);
  assert.strictEqual(dv.getUint32(guestToWasm(cycleB.loadAddr + 0x1450), true), cycleA.loadAddr + 0x1000);
  e.test_call_FreeLibrary(cycleA.loadAddr);
  assert.strictEqual(e.test_lifetime_GetModuleHandleA(cycleAName) >>> 0, cycleA.loadAddr >>> 0,
    'the other explicit reference keeps the entire cycle live');
  e.test_call_FreeLibrary(cycleB.loadAddr);
  if (e.get_yield_reason() === 5) await handleLoadLibraryYield({ exports: e, memoryBuffer: memory.buffer });
  assert.strictEqual(e.test_lifetime_GetModuleHandleA(cycleAName), 0, 'unreferenced import cycle retires A');
  assert.strictEqual(e.test_lifetime_GetModuleHandleA(cycleBName), 0, 'unreferenced import cycle retires B');

  // A detach fault must propagate rather than pretend the callback finished
  // and unmap an image whose cleanup is incomplete.
  const broken = resourceDll(counter);
  broken[0x200] = 0x0f; broken[0x201] = 0x0b; // UD2
  const failed = loadDll(e, memory.buffer, broken, 'detachfault.dll');
  const failedName = writeAscii('detachfault.dll');
  e.test_call_FreeLibrary(failed.loadAddr);
  await assert.rejects(handleLoadLibraryYield({ exports: e, memoryBuffer: memory.buffer }),
    /./, 'detach trap propagates to the caller');
  assert.strictEqual(e.test_lifetime_GetModuleHandleA(failedName) >>> 0, failed.loadAddr >>> 0,
    'failed detach does not retire the mapped image');

  console.log('PASS  DLL references, final detach, fresh reload and slot reuse');
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
