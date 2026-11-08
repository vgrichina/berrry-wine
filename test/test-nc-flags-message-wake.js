#!/usr/bin/env node

'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_nc_wake_setup")
    (global.set $next_hwnd (i32.const 0x10002))
    (global.set $main_hwnd (i32.const 0x10001))
    (call $wnd_table_set (i32.const 0x10001) (i32.const 0x00401000))
    (drop (call $wnd_set_style (i32.const 0x10001) (i32.const 0x10000000)))
    (call $nc_flags_set (i32.const 0x10001) (i32.const 8)))
  (func (export "test_nc_add_thread_window") (param $hwnd i32) (param $tid i32)
    (global.set $current_thread_id (local.get $tid))
    (global.set $next_hwnd (i32.add (local.get $hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $hwnd) (i32.const 0x00402000))
    (drop (call $wnd_set_style (local.get $hwnd) (i32.const 0x10000000)))
    (call $nc_flags_set (local.get $hwnd) (i32.const 5)))
  (func (export "test_nc_scan") (param $mask i32) (result i32)
    (call $nc_flags_scan (local.get $mask)))
  (func (export "test_nc_flags") (param $hwnd i32) (result i32)
    (call $nc_flags_test (local.get $hwnd)))
  (func (export "test_nc_wake_set") (param $bits i32)
    (call $nc_flags_set (i32.const 0x10001) (local.get $bits)))
  (func (export "test_nc_wake_clear") (param $bits i32)
    (call $nc_flags_clear (i32.const 0x10001) (local.get $bits)))
  (func (export "test_msgwait_ready") (result i32)
    (call $msgwait_queue_ready))
  (func (export "test_nc_erase_pending") (result i32)
    (i32.and (call $nc_flags_test (i32.const 0x10001)) (i32.const 2)))
  (func (export "test_nc_message") (param $get i32) (param $remove i32) (result i32)
    (local $sp i32) (local $ip i32) (local $result i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (local.set $ip (global.get $eip))
    (if (local.get $get)
      (then (call $handle_GetMessageA (i32.const 0x3000) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
      (else (call $handle_PeekMessageA (i32.const 0x3000) (i32.const 0)
        (i32.const 0) (i32.const 0) (local.get $remove) (i32.const 0))))
    (local.set $result (i32.load (global.get $reg_base)))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (global.set $eip (local.get $ip))
    (global.set $yield_flag (i32.const 0))
    (global.set $yield_reason (i32.const 0))
    (global.set $handler_set_eip (i32.const 0))
    (local.get $result))
  (func (export "test_nc_main_paint_pending") (param $pending i32) (result i32)
    (global.set $paint_pending (local.get $pending))
    (call $paint_flag_test_hwnd (i32.const 0x10001)))
  (func (export "test_nc_paint_work") (param $pending i32)
    (if (local.get $pending)
      (then (call $paint_flag_set (i32.const 0x10001)))
      (else (call $paint_flag_clear_hwnd (i32.const 0x10001)))))
`;

(async () => {
  const { exports: wat, memory } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const msg = new DataView(memory.buffer, wat.get_guest_base() + 0x3000, 28);

  wat.test_nc_wake_setup();
  assert.strictEqual(wat.has_pending_message(), 0,
    'persistent background-erase ownership must not wake GetMessage');
  // MsgWaitForMultipleObjects' "a message is queued" answer. ScummVM's SDL
  // pump loops while it says yes; bit 8 alone used to say yes forever.
  assert.strictEqual(wat.test_msgwait_ready(), 0,
    'persistent background-erase ownership must not satisfy MsgWait');

  for (const bit of [1, 4]) {
    wat.test_nc_wake_set(bit);
    assert.strictEqual(wat.has_pending_message(), 1,
      `transient NC flag ${bit} must wake GetMessage`);
    assert.strictEqual(wat.test_msgwait_ready(), 1,
      `transient NC flag ${bit} must satisfy MsgWait`);
    wat.test_nc_wake_clear(bit);
    assert.strictEqual(wat.has_pending_message(), 0,
      `clearing transient NC flag ${bit} must leave persistent bit 8 idle`);
  }

  wat.test_nc_wake_set(2);
  for (const remove of [0, 1]) {
    assert.strictEqual(wat.test_nc_message(0, remove), 0,
      'PeekMessage must not manufacture a queued erase from pending paint state');
    assert.strictEqual(wat.test_nc_erase_pending(), 2,
      'neither peek mode consumes pending erase');
  }
  msg.setUint32(4, 0xDEADBEEF, true);
  wat.test_nc_message(1, 1);
  assert.notStrictEqual(msg.getUint32(4, true), 0x14,
    'GetMessage must not manufacture a queued erase');
  assert.strictEqual(wat.test_nc_erase_pending(), 2);
  assert.strictEqual(wat.has_pending_message(), 0,
    'pending erase without paint damage must not spin the message waiter');
  assert.strictEqual(wat.test_msgwait_ready(), 0,
    'pending erase without paint damage must not satisfy MsgWait');

  for (const get of [0, 1]) {
    assert.strictEqual(wat.post_message_q(0x10001, 0x14, 0x1234, 0x5678), 1);
    assert.strictEqual(wat.has_pending_message(), 1,
      'an explicitly posted erase still wakes the waiter');
    assert.strictEqual(wat.test_msgwait_ready(), 1,
      'a posted message satisfies MsgWait');
    assert.strictEqual(wat.test_nc_message(0, 0), 1);
    assert.strictEqual(wat.post_queue_depth(), 1, 'PM_NOREMOVE retains a posted erase');
    assert.strictEqual(wat.test_nc_message(get, 1), 1);
    assert.deepStrictEqual([0, 4, 8, 12].map(off => msg.getUint32(off, true)),
      [0x10001, 0x14, 0x1234, 0x5678], 'posted erase parameters pass through intact');
    assert.strictEqual(wat.post_queue_depth(), 0);
    assert.strictEqual(wat.test_nc_erase_pending(), 2,
      'dequeueing an explicit message does not validate pending erase');
    assert.strictEqual(wat.has_pending_message(), 0);
  }

  assert.strictEqual(wat.test_nc_main_paint_pending(1), 1,
    'the paint scheduler must see the main window global paint state');
  assert.strictEqual(wat.has_pending_message(), 1,
    'main-window paint wakes before the selector mirrors it into per-window flags');
  assert.strictEqual(wat.test_nc_main_paint_pending(0), 0,
    'clearing the main paint state must leave no per-window paint behind');
  wat.test_nc_paint_work(1);
  assert.strictEqual(wat.has_pending_message(), 1,
    'per-window paint work still wakes the waiter while erase is pending');
  wat.test_nc_paint_work(0);
  assert.strictEqual(wat.has_pending_message(), 0,
    'only the erase request remains after paint is cleared');

  // Two guest UI threads share NC_FLAGS, but not their message queues.
  // The renderer probe must not dispatch the main thread's MFC wndproc on
  // its own TLS/context. Test the real GetMessage/PeekMessage paths as well
  // as the shared readiness scanner; both transient NC bits must survive
  // foreign polling until their owner consumes them.
  wat.test_nc_wake_set(5);
  wat.test_nc_add_thread_window(0x18001, 2);
  assert.strictEqual(wat.get_window_thread(0x10001), 1);
  assert.strictEqual(wat.get_window_thread(0x18001), 2);
  for (const get of [0, 1]) {
    const expected = get ? 0x85 : 0x83;
    assert.strictEqual(wat.test_nc_message(get, 1), 1);
    assert.strictEqual(msg.getUint32(0, true), 0x18001,
      'only the calling thread window can supply synthesized NC messages');
    assert.strictEqual(msg.getUint32(4, true), expected);
    assert.strictEqual(wat.test_nc_flags(0x10001) & 5, 5,
      'foreign retrieval preserves both NC bits for the owning thread');
  }
  assert.strictEqual(wat.test_nc_scan(5), 0,
    'foreign NC work cannot satisfy the current thread readiness scan');
  wat.set_current_thread_id(1);
  for (const get of [1, 0]) {
    assert.strictEqual(wat.test_nc_message(get, 1), 1);
    assert.strictEqual(msg.getUint32(0, true), 0x10001);
    assert.strictEqual(msg.getUint32(4, true), get ? 0x83 : 0x85);
  }
  assert.strictEqual(wat.test_nc_flags(0x10001) & 5, 0);
  assert.strictEqual(wat.paint_work_audit(), 0,
    'thread filtering leaves shared paint/NC work counts consistent');

  console.log('PASS  persistent NC state does not masquerade as queued message work');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
