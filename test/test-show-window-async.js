#!/usr/bin/env node
'use strict';

// ShowWindowAsync must only enqueue owner-thread work.  The ordinary window
// state, host window, and WM_SHOWWINDOW notification change when that queue
// record is dispatched, never on the initiating caller's stack.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const apiTable = require('../src/api_table.json');

const ESP0 = 0x07390000;
const MSG = 0x00510000;
const WS_VISIBLE = 0x10000000;
const ERROR_INVALID_WINDOW_HANDLE = 1400;
const LAST_ERROR_SENTINEL = 0x5a5aa55a;

const extraWat = String.raw`
  (func (export "test_guest_wndproc") (param $hwnd i32)
    (call $wnd_table_set (local.get $hwnd) (i32.const 0x401234)))
  (func (export "test_guest_return")
    (i32.store (global.get $THUNK_BASE) (i32.const 0xCACA0001))
    (i32.store offset=16 (global.get $reg_base)
      (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
    (call $win32_dispatch (i32.const 0)))
  (func (export "test_create_hidden_iconic_window") (result i32)
    (local $hwnd i32)
    (local.set $hwnd (global.get $next_hwnd))
    (global.set $next_hwnd
      (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $hwnd) (global.get $WNDPROC_BUILTIN))
    (drop (call $wnd_set_style (local.get $hwnd) (i32.const 0)))
    (call $wnd_min_set (local.get $hwnd) (i32.const 1))
    (global.set $main_hwnd (local.get $hwnd))
    ;; Keep this queue/dispatch test out of ShowWindow's one-time startup
    ;; callback continuation; the state path under test is otherwise the same.
    (global.set $show_window_activated (i32.const 1))
    (global.set $active_hwnd (local.get $hwnd))
    (local.get $hwnd))

  (func (export "test_call_ShowWindowAsync")
      (param $hwnd i32) (param $cmd i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const ${ESP0}))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0))
    (call $handle_ShowWindowAsync
      (local.get $hwnd) (local.get $cmd)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_dispatch_first_post") (result i32)
    (if (i32.eqz (call $shared_post_queue_read (i32.const ${MSG}) (i32.const 1)))
      (then (unreachable)))
    (i32.store offset=16 (global.get $reg_base) (i32.const ${ESP0}))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0))
    (call $handle_DispatchMessageA
      (i32.const ${MSG})
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_is_minimized") (param $hwnd i32) (result i32)
    (call $wnd_min_get (local.get $hwnd)))
  (func (export "test_set_last_error") (param $value i32)
    (global.set $last_error (local.get $value)))
  (func (export "test_show_window_async_api_id") (result i32)
    (call $lookup_api_id "ShowWindowAsync"))
`;

(async () => {
  const hostShows = [];
  const { exports: e } = await bootRenderHarness({
    extraWat,
    fonts: 'none',
    extraHostOverrides: {
      show_window: (hwnd, cmd) => {
        hostShows.push([hwnd >>> 0, cmd >>> 0]);
        return (640 | (480 << 16)) >>> 0;
      },
    },
  });
  const api = apiTable.find(entry => entry.name === 'ShowWindowAsync');
  assert(api, 'ShowWindowAsync is registered');
  assert.strictEqual(api.nargs, 2);
  assert.strictEqual(api.convention, 'stdcall');
  assert.strictEqual(e.test_show_window_async_api_id(), api.id,
    'runtime import hashing resolves ShowWindowAsync');

  const hwnd = e.test_create_hidden_iconic_window() >>> 0;
  e.set_post_queue_count(0);
  e.test_set_last_error(LAST_ERROR_SENTINEL);

  assert.strictEqual(e.test_call_ShowWindowAsync(hwnd, 9) >>> 0, 1,
    'a valid SW_RESTORE operation starts successfully');
  assert.strictEqual(e.get_esp() >>> 0, ESP0 + 12,
    'ShowWindowAsync pops return address plus two arguments');
  assert.strictEqual(e.test_get_last_error() >>> 0, LAST_ERROR_SENTINEL,
    'successful enqueue preserves LastError');
  assert.strictEqual(e.wnd_get_style_export(hwnd) & WS_VISIBLE, 0,
    'the caller does not make the target visible synchronously');
  assert.strictEqual(e.test_is_minimized(hwnd), 1,
    'the caller does not restore placement synchronously');
  assert.deepStrictEqual(hostShows, [],
    'the browser host is untouched until the owner thread dispatches work');
  assert.strictEqual(e.post_queue_depth(), 1);
  assert.deepStrictEqual([0, 1, 2, 3].map(field =>
    e.post_queue_peek(0, field) >>> 0),
  [hwnd, 0x7fef, 9, 0x53485741],
  'the complete restore command is queued for the owning message pump');

  assert.strictEqual(e.test_dispatch_first_post() >>> 0, 0,
    'the private USER event has no application LRESULT');
  assert.strictEqual(e.get_esp() >>> 0, ESP0 + 8,
    'DispatchMessage keeps its one-argument stdcall cleanup');
  assert.strictEqual(e.wnd_get_style_export(hwnd) & WS_VISIBLE, WS_VISIBLE,
    'dispatch applies ShowWindow visibility');
  assert.strictEqual(e.test_is_minimized(hwnd), 0,
    'dispatch applies SW_RESTORE placement state');
  assert.deepStrictEqual(hostShows, [[hwnd, 9]],
    'dispatch performs the host transition exactly once');
  assert.strictEqual(e.post_queue_depth(), 0,
    'dispatch sends WM_SHOWWINDOW synchronously without posting another event');

  e.set_post_queue_count(0);
  assert.strictEqual(e.test_call_ShowWindowAsync(hwnd, 0) >>> 0, 1);
  assert.strictEqual(e.wnd_get_style_export(hwnd) & WS_VISIBLE, WS_VISIBLE,
    'SW_HIDE is deferred too');
  assert.strictEqual(hostShows.length, 1);
  e.test_dispatch_first_post();
  assert.strictEqual(e.wnd_get_style_export(hwnd) & WS_VISIBLE, 0);
  assert.deepStrictEqual(hostShows, [[hwnd, 9], [hwnd, 0]],
    'the queued hide uses the same host ShowWindow command');

  e.set_post_queue_count(0);
  e.test_set_last_error(LAST_ERROR_SENTINEL);
  assert.strictEqual(e.test_call_ShowWindowAsync(0x12345678, 5) >>> 0, 0,
    'an invalid HWND cannot start an operation');
  assert.strictEqual(e.test_get_last_error() >>> 0,
    ERROR_INVALID_WINDOW_HANDLE);
  assert.strictEqual(e.post_queue_depth(), 0);

  for (let i = 0; i < 64; i++) {
    assert.strictEqual(e.post_message_q(0, 0x500 + i, i, i), 1);
  }
  e.test_set_last_error(LAST_ERROR_SENTINEL);
  assert.strictEqual(e.test_call_ShowWindowAsync(hwnd, 5) >>> 0, 1,
    'an owner queue grows beyond its allocation-free 64-message prefix');
  assert.strictEqual(e.test_get_last_error() >>> 0, LAST_ERROR_SENTINEL);
  assert.strictEqual(e.post_queue_depth(), 65);
  assert.deepStrictEqual([0, 1, 2, 3].map(field =>
    e.post_queue_peek(64, field) >>> 0),
  [hwnd, 0x7fef, 5, 0x53485741],
  'the deferred show command retains FIFO position in heap overflow');
  assert.strictEqual(hostShows.length, 2,
    'growing the queue still has no synchronous host-visible side effect');
  e.set_post_queue_count(0);

  e.test_guest_wndproc(hwnd);
  for(const cmd of [5,0]) {
    const before=hostShows.length;
    e.test_call_ShowWindowAsync(hwnd,cmd);
    e.test_dispatch_first_post();
    assert.strictEqual(e.get_eip(),0x401234,'owner dispatch enters guest WM_SHOWWINDOW');
    assert.strictEqual(hostShows.length,before,'visibility waits for guest callback');
    assert.strictEqual(e.get_esp()>>>0,ESP0-44);
    e.test_guest_return();
    assert.strictEqual(e.get_eax(),0,'private DispatchMessage result survives guest callback');
    assert.strictEqual(e.get_esp()>>>0,ESP0+8);
    assert.strictEqual(e.get_eip(),0);
    assert.strictEqual(hostShows.length,before+1);
    assert.strictEqual(e.wnd_get_style_export(hwnd)&WS_VISIBLE,cmd?WS_VISIBLE:0);
    e.set_post_queue_count(0);
  }
  console.log('PASS ShowWindowAsync owner queue and guest callback completion');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
