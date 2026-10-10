#!/usr/bin/env node
'use strict';

// IDirectPlay::EnumSessions(DPENUMSESSIONS_STOPASYNC) ends an asynchronous
// search and returns DP_OK at once; a stop passes no callback. The flag is
// 0x20 in dplay.h. It was tested as 0x4, so a real stop fell through to the
// synchronous path and, with its NULL callback, came back E_INVALIDARG with
// the async search still marked running.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

const ROOT = path.join(__dirname, '..');

const extraWat = String.raw`
  (func (export "test_enum") (param $flags i32) (param $callback i32) (param $stack i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $gs32 (local.get $stack) (i32.const 0x00ABCDEF))
    (call $dpn_enum_sessions (i32.const 0) (i32.const 0) (local.get $callback)
      (i32.const 0) (local.get $flags) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_set_async") (param $v i32) (i32.store offset=60 (global.get $DP_SHARED) (local.get $v)))
  (func (export "test_async") (result i32) (i32.load offset=60 (global.get $DP_SHARED)))
  (func (export "test_active") (result i32) (i32.load offset=56 (global.get $DP_SHARED)))
`;

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const exe = fs.readFileSync(path.join(ROOT, 'test', 'binaries', 'notepad.exe'));
  new Uint8Array(memory.buffer).set(exe, e.get_staging());
  assert(e.load_pe(exe.length) > 0, 'fixture PE loads');
  const stack = (e.guest_alloc(256) >>> 0) + 128;

  // An async search is running; the app stops it.
  e.test_set_async(1);
  const stop = e.test_enum(0x20, 0, stack) >>> 0;
  assert.strictEqual(stop, 0, 'STOPASYNC returns DP_OK');
  assert.strictEqual(e.get_esp() >>> 0, stack + 28, 'STOPASYNC pops the 7-dword stdcall frame');
  assert.strictEqual(e.test_async(), 0, 'STOPASYNC ends the async search');
  assert.strictEqual(e.test_active(), 0, 'STOPASYNC does not start a synchronous search');

  // Its flag is not 0x4: that bit means nothing, so with no callback the call
  // is still a malformed search.
  e.test_set_async(1);
  assert.strictEqual(e.test_enum(0x4, 0, stack) >>> 0, 0x80070057,
    'a search with no callback is E_INVALIDARG');
  assert.strictEqual(e.test_async(), 1, 'an undefined flag bit does not stop the async search');

  // RETURNSTATUS | ASYNC | AVAILABLE with a stop bit set still stops.
  assert.strictEqual(e.test_enum(0x20 | 0x91, 0, stack) >>> 0, 0, 'STOPASYNC wins over the other bits');
  assert.strictEqual(e.test_async(), 0);

  console.log('PASS EnumSessions(DPENUMSESSIONS_STOPASYNC = 0x20) stops the async search');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
