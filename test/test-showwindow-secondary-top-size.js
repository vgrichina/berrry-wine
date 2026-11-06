#!/usr/bin/env node
'use strict';

// A secondary top-level cannot use main_hwnd's single pending WM_SIZE slot.
// Its first ShowWindow must queue the concrete client dimensions instead.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const packedSize = (514 | (386 << 16)) >>> 0;
const extraWat = String.raw`
  (func (export "test_create_hidden_secondary") (result i64)
    (local $main i32) (local $secondary i32)
    (local.set $main (global.get $next_hwnd))
    (global.set $next_hwnd
      (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $main) (global.get $WNDPROC_BUILTIN))
    (drop (call $wnd_set_style (local.get $main) (i32.const 0x10000000)))
    (global.set $main_hwnd (local.get $main))
    (global.set $show_window_activated (i32.const 1))

    (local.set $secondary (global.get $next_hwnd))
    (global.set $next_hwnd
      (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $secondary) (global.get $WNDPROC_BUILTIN))
    (drop (call $wnd_set_style (local.get $secondary) (i32.const 0)))
    ;; Keep this queue-only regression out of the unrelated activation path.
    (global.set $active_hwnd (local.get $secondary))
    (i64.or (i64.extend_i32_u (local.get $main))
      (i64.shl (i64.extend_i32_u (local.get $secondary)) (i64.const 32))))

  (func (export "test_call_show_window") (param $hwnd i32)
    (local $saved_esp i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_ShowWindow
      (local.get $hwnd) (i32.const 5)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp)))
`;

(async () => {
  const { exports: e } = await bootRenderHarness({
    extraWat,
    fonts: 'none',
    extraHostOverrides: { show_window: () => packedSize },
  });

  const pair = BigInt.asUintN(64, e.test_create_hidden_secondary());
  const main = Number(pair & 0xffffffffn) >>> 0;
  const secondary = Number(pair >> 32n) >>> 0;
  assert.notStrictEqual(secondary, main);

  e.set_post_queue_count(0);
  e.test_call_show_window(secondary);
  assert.strictEqual(e.post_queue_depth(), 1,
    'first show sends WM_SHOWWINDOW synchronously and queues WM_SIZE');
  assert.deepStrictEqual([0, 1, 2, 3].map(field => e.post_queue_peek(0, field) >>> 0),
    [secondary, 0x0005, 0, packedSize],
    'WM_SIZE carries the secondary top-level client size');

  e.set_post_queue_count(0);
  e.test_call_show_window(secondary);
  assert.strictEqual(e.post_queue_depth(), 0,
    'showing an already-visible top-level sends neither WM_SIZE nor WM_SHOWWINDOW');

  console.log('PASS ShowWindow sizes a hidden secondary top-level on first show');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
