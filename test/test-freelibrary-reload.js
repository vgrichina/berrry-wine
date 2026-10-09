#!/usr/bin/env node
'use strict';

// Synthetic system modules retain stable handles. Real PE modules have
// references, final detach and fresh state on reload: Alice and Quake II
// unload/reload their game DLLs while restoring a map.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const { loadDll, callDllMain } = require('../lib/dll-loader');
const { handleLoadLibraryYield } = require('../lib/process-boot');

const extraWat = String.raw`
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

async function main() {
  const { exports: e, memory, hostCtx } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const bytes = new Uint8Array(memory.buffer);
  const guestToWasm = guest =>
    (guest - (e.get_image_base() >>> 0) + (e.get_guest_base() >>> 0)) >>> 0;
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
