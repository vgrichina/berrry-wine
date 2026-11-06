#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_get_cursor") (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_GetCursor
      (i32.const 0) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_set_cursor") (param $cursor i32) (result i32)
    (call $set_cursor_internal (local.get $cursor)))
  (func (export "test_show_cursor") (param $show i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_ShowCursor (local.get $show) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
`;

(async () => {
  const harness = await bootRenderHarness({ extraWat, fonts: 'none' });
  const wat = harness.exports;
  assert.strictEqual(wat.test_get_cursor() >>> 0, 0x67f00,
    'GetCursor returns the default IDC_ARROW handle');
  assert.strictEqual(wat.get_esp() >>> 0, 0x00300004,
    'zero-argument stdcall pops its return address');
  assert.strictEqual(wat.test_set_cursor(0x12345678) >>> 0, 0x67f00,
    'SetCursor returns the previous cursor');
  assert.strictEqual(wat.test_get_cursor() >>> 0, 0x12345678,
    'GetCursor observes the cursor installed by SetCursor');

  const peer = (await WebAssembly.instantiate(harness.module,
    {host:harness.host,gdi:harness.gdi})).exports;
  peer.set_current_thread_id(2);
  assert.strictEqual(peer.test_get_cursor(), 0x67f00, 'another thread starts with arrow');
  peer.test_set_cursor(0);
  assert.strictEqual(peer.test_show_cursor(0), -1);
  assert.strictEqual(wat.get_thread_cursor(2), 0, 'host shadow sees Worker NULL cursor');
  assert.strictEqual(wat.get_thread_cursor_display_count(2), -1);
  assert.strictEqual(wat.test_get_cursor(), 0x12345678, 'thread states are isolated');
  assert.strictEqual(wat.get_cursor_display_count(), 0);
  peer.test_set_cursor(0x67f00);
  assert.strictEqual(peer.test_show_cursor(1), 0);
  assert.strictEqual(wat.get_thread_cursor(2), 0x67f00);
  assert.strictEqual(wat.get_thread_cursor_display_count(2), 0);
  peer.test_set_cursor(0);
  peer.test_show_cursor(0);
  wat.reset_thread_message_queue(2);
  assert.strictEqual(peer.test_get_cursor(), 0x67f00, 'thread reuse resets handle');
  assert.strictEqual(peer.get_cursor_display_count(), 0, 'thread reuse resets display count');
  console.log('PASS GetCursor and ShowCursor share per-thread state across instances');
})().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
