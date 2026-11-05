#!/usr/bin/env node
'use strict';

// A mapped PE remains resident after FreeLibrary in this emulator, so a later
// LoadLibrary returns the same HMODULE. That successful load must start a new
// lifetime: Quake II unloads/reloads gamex86.dll while restoring a map and
// treats a false result from the following FreeLibrary as a fatal error.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_call_LoadLibraryA") (param $name i32) (result i32)
    (local $sp i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_LoadLibraryA (local.get $name)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (i32.load offset=0 (global.get $reg_base)))

  ;; FreeLibrary yields to the host (yield 5, unload kind 1); the release and
  ;; its BOOL are produced by serviceDllUnload, as in every real host.
  (func (export "test_begin_FreeLibrary") (param $module i32) (result i32)
    (local $sp i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_FreeLibrary (local.get $module)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (global.get $yield_reason))
`;

async function main() {
  const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const loader = require('../lib/dll-loader');
  const freeLibrary = module => {
    assert.strictEqual(e.test_begin_FreeLibrary(module), 5, 'FreeLibrary yields to the host');
    const outcome = loader.serviceDllUnload({ exports: e, memoryBuffer: memory.buffer });
    assert(outcome && !outcome.terminal, 'FreeLibrary is serviced and returns to the caller');
    return e.get_eax() >>> 0;
  };
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

  assert.strictEqual(freeLibrary(0), 0,
    'a null module handle is never a successful unload');
  assert.strictEqual(freeLibrary(ddraw), 1,
    'the first unload of a live handle succeeds');
  e.test_call_LoadLibraryA(dsoundName);
  assert.strictEqual(freeLibrary(ddraw), 0,
    'loading a different module does not re-arm an already freed handle');

  assert.strictEqual(e.test_call_LoadLibraryA(ddrawName) >>> 0, ddraw,
    'a resident module is loaded again at the same handle');
  assert.strictEqual(freeLibrary(ddraw), 1,
    'the reloaded handle has a fresh unload lifetime');
  assert.strictEqual(freeLibrary(ddraw), 0,
    'a consecutive repeated unload still terminates NSIS-style loops');

  console.log('PASS  FreeLibrary accepts a mapped handle after it is loaded again');
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
