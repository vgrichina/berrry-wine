#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const crypto = require('crypto');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');

const extraWat = String.raw`
  (global $test_fail_mouse_queue (mut i32) (i32.const 0))
  (func (export "test_queue_fail") (param i32) (global.set $test_fail_mouse_queue (local.get 0)))
  (func (export "test_track") (param $p i32) (param $wrapper i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x120000))
    (if (local.get $wrapper)
      (then (call $handle__TrackMouseEvent (local.get $p) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
      (else (call $handle_TrackMouseEvent (local.get $p) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))))
    (i32.load (global.get $reg_base)))
  (func (export "test_tracking_state") (param $tid i32) (result i32)
    (local $r i32)
    (local.set $r (call $mouse_track_record (local.get $tid)))
    (if (result i32) (local.get $r)
      (then (i32.load offset=4 (local.get $r))) (else (i32.const -1))))
  (func (export "test_remove") (param $hwnd i32) (call $wnd_table_remove (local.get $hwnd)))
  (func (export "test_queue_count") (param $tid i32) (result i32)
    (call $shared_post_queue_total_count_tid (local.get $tid)))
  (func (export "test_queue_field") (param $tid i32) (param $index i32) (param $field i32) (result i32)
    (call $shared_post_queue_peek_field_tid (local.get $tid) (local.get $index) (local.get $field)))
  (func (export "test_queue_clear") (param $hwnd i32) (call $shared_post_queue_purge_hwnd (local.get $hwnd)))
  (func (export "test_pump") (param $tid i32) (result i32)
    (call $shared_post_queue_peek_tid (local.get $tid) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0)))
  (func (export "test_geometry") (param $hwnd i32) (param $parent i32) (param $class i32)
      (param $x i32) (param $y i32) (param $w i32) (param $h i32)
    (local $slot i32) (local $g i32)
    (call $wnd_table_set (local.get $hwnd) (global.get $WNDPROC_DIALOG))
    (call $wnd_set_parent (local.get $hwnd) (local.get $parent))
    (drop (call $wnd_set_style (local.get $hwnd)
      (if (result i32) (local.get $parent) (then (i32.const 0x50000003)) (else (i32.const 0x10000000)))))
    (local.set $slot (call $wnd_table_find (local.get $hwnd)))
    (call $ctrl_table_set (local.get $slot) (local.get $class) (i32.const 1))
    (local.set $g (call $ctrl_geom_addr (local.get $slot)))
    (i32.store16 (local.get $g) (local.get $x))
    (i32.store16 offset=2 (local.get $g) (local.get $y))
    (i32.store16 offset=4 (local.get $g) (local.get $w))
    (i32.store16 offset=6 (local.get $g) (local.get $h))
    (call $client_rect_set (local.get $hwnd) (i32.const 0) (i32.const 0) (local.get $w) (local.get $h)))
`;

(async () => {
  // Fault injection is confined to the private test compile. The real queue
  // and all tracking code still execute; production contains no test switch.
  const wasm = compileSrcWasm((file, source) => {
    if (file === '13-exports.wat') return source + extraWat;
    if (file === '09a-handlers.wat') return source.replace(
      '(call $shared_post_queue_enqueue_flags (local.get $hwnd) (local.get $msg)',
      '(if (global.get $test_fail_mouse_queue) (then (return (i32.const 0))))\n    (call $shared_post_queue_enqueue_flags (local.get $hwnd) (local.get $msg)');
    return source;
  });
  const dir = 'scratch/track-mouse-event-20261003';
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dir + '/focused-test.wasm', wasm);
  fs.writeFileSync(dir + '/focused-test.sha256', crypto.createHash('sha256').update(wasm).digest('hex') + '\n');
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { getMemory: () => memory.buffer, resourceJson: {}, onExit() {} };
  const imports = createHostImports(ctx);
  imports.host.memory = memory;
  imports.host.crash_unimplemented = () => {};
  const { instance, module } = await WebAssembly.instantiate(wasm, imports);
  const e = instance.exports;
  ctx.exports = e;
  const observer = new WebAssembly.Instance(module, imports).exports;
  observer.set_current_thread_id(2);
  const p = e.guest_alloc(16) >>> 0;
  function request(flags, hwnd, wrapper = 0, size = 16, hoverTime = 0xffffffff) {
    [size, flags, hwnd, hoverTime].forEach((v, i) => e.guest_write32(p + i * 4, v));
    const result = e.test_track(p, wrapper);
    assert.equal(e.get_esp(), 0x120008, 'one-pointer stdcall cleanup');
    return result;
  }
  const query = () => {
    assert.equal(request(0x40000000, 0), 1);
    return [4, 8, 12].map(i => e.guest_read32(p + i) >>> 0);
  };
  const a = 0x10003, b = 0x10004;
  e.set_current_thread_id(1); e.wnd_table_set(a, 0);
  e.set_current_thread_id(2); e.wnd_table_set(b, 0);
  e.set_current_thread_id(1);
  e.track_mouse_observe(a);
  assert.equal(request(2, a), 1);
  assert.deepEqual(query(), [2, a, 400]);
  assert.equal(request(2, a, 0, 16, 123), 1);
  assert.deepEqual(query(), [2, a, 400], 'LEAVE ignores explicit hover time, resolves default');
  assert.equal(request(0, a), 1);
  assert.deepEqual(query(), [0, 0, 0], 'zero-flags request replaces active services');
  assert.equal(request(2, a), 1);
  e.track_mouse_observe(a);
  assert.equal(e.test_queue_count(1), 0, 'same physical client does not leave');
  // The publishing instance is a different thread, as with the browser shadow.
  observer.track_mouse_observe(b);
  observer.track_mouse_observe(a);
  assert.equal(e.test_queue_count(1), 1, 'out-and-back preserves one notification');
  assert.equal(e.test_queue_count(2), 0, 'observer thread must not receive it');
  assert.deepEqual([0, 1, 2, 3].map(i => e.test_queue_field(1, 0, i)), [a, 0x2a3, 0, 0]);
  e.set_current_thread_id(1);
  assert.deepEqual(query(), [0, 0, 0]);
  e.track_mouse_observe(0);
  assert.equal(e.test_queue_count(1), 1, 'leave is one-shot');
  e.test_queue_clear(a);
  assert.equal(request(2, a, 1), 1, 'COMCTL32 wrapper has same behavior');
  assert.equal(e.test_queue_count(1), 1, 'arm outside posts immediately');
  e.test_queue_clear(a);
  e.track_mouse_observe(a);
  assert.equal(request(2, a), 1);
  assert.equal(request(0x80000000, a), 1, 'cancel with no type changes nothing');
  assert.deepEqual(query(), [2, a, 400]);
  assert.equal(request(0x80000002, a), 1);
  e.track_mouse_observe(0);
  assert.equal(e.test_queue_count(1), 0, 'cancelled leave does not post');
  // Outside request must preserve an unrelated active tracker on this thread.
  const c = 0x10005; e.wnd_table_set(c, 0);
  e.track_mouse_observe(a);
  assert.equal(request(2, a), 1);
  assert.equal(request(2, c), 1);
  assert.deepEqual(query(), [2, a, 400]);
  e.test_queue_clear(c);
  observer.test_queue_fail(1);
  observer.track_mouse_observe(0);
  assert.equal(e.test_tracking_state(1), 4, 'allocation failure retains generated leave');
  observer.track_mouse_observe(a);
  assert.equal(e.test_tracking_state(1), 4, 'returning inside does not erase pending leave');
  assert.equal(e.test_queue_count(1), 0);
  observer.test_queue_fail(0);
  assert.equal(e.test_pump(1), 1, 'owner pump retries without another mouse event');
  assert.equal(e.test_tracking_state(1), 0);
  assert.equal(e.test_queue_count(1), 1);
  assert.equal(e.test_pump(1), 1);
  assert.equal(e.test_queue_count(1), 1, 'retry does not duplicate');
  e.test_queue_clear(a);
  e.track_mouse_observe(a);
  assert.equal(request(2, a), 1);
  e.test_remove(a);
  assert.equal(e.test_tracking_state(1), 0, 'destroy retires tracker');
  e.track_mouse_observe(0);
  assert.equal(e.test_queue_count(1), 0, 'destroyed target cannot be notified');
  assert.equal(request(2, a), 0, 'dead HWND rejected');
  e.track_mouse_observe(b);
  assert.equal(request(2, b), 1, 'cross-thread request arms the HWND owner');
  assert.equal(e.test_tracking_state(2), 2);
  assert.deepEqual(query(), [0, 0, 0], 'QUERY describes calling thread, not target owner');
  assert.equal(request(2, b, 0, 12), 0, 'incorrect ABI size rejected');
  assert.equal(e.test_track(0, 0), 0, 'null pointer rejected');
  assert.equal(e.test_track(0xfffffffc, 0), 0, 'wrapped/unmapped pointer rejected');
  e.set_current_thread_id(16);
  const high = 0x10010; e.wnd_table_set(high, 0);
  e.track_mouse_observe(high);
  assert.equal(request(2, high), 1);
  e.set_current_thread_id(1); e.track_mouse_observe(0);
  assert.equal(e.test_queue_count(16), 1, 'highest existing USER queue supported');
  assert.equal(e.test_tracking_state(17), -1, 'no invented extra thread capacity');
  e.track_mouse_observe(high);
  assert.equal(request(2, high), 1, 'cross-thread arm before thread exit');
  e.reset_thread_message_queue(16);
  assert.equal(e.test_tracking_state(16), 0, 'thread lifecycle reset retires tracking');
  e.track_mouse_observe(0);
  assert.equal(e.test_queue_count(16), 0, 'reused thread queue does not inherit tracking');
  // Real WAT geometry, especially a combo whose parent is WNDPROC_DIALOG.
  e.set_current_thread_id(1);
  const parent = 0x10020, combo = 0x10021, nested = 0x10022;
  e.test_geometry(parent, 0, 0, 0, 0, 100, 100);
  e.test_geometry(combo, parent, 5, 10, 20, 30, 30);
  assert.equal(e.track_mouse_client_hit(parent, 15, 25), combo, 'dialog combo is a physical target');
  e.track_mouse_observe(combo);
  assert.equal(request(2, combo), 1);
  e.track_mouse_observe(e.track_mouse_client_hit(parent, 70, 70));
  assert.equal(e.test_queue_field(1, 0, 0), combo, 'combo→parent generates combo leave');
  e.test_queue_clear(combo);
  e.test_geometry(nested, combo, 2, 25, 0, 30, 20);
  assert.equal(e.track_mouse_client_hit(parent, 50, 25), parent, 'child overflow clipped by ancestor');
  assert.equal(e.track_mouse_client_hit(parent, 110, 25), 0, 'outside parent client stays outside');
  // Unknown/unsupported modes never return success, including cancel-hover.
  e.set_current_thread_id(2);
  for (const flags of [1, 3, 0x10, 0x12, 0x80000001, 4]) {
    assert.throws(() => request(flags, b), WebAssembly.RuntimeError);
  }
  console.log('PASS TrackMouseEvent client leave: ABI, one-shot, query/cancel, owner queues, teardown, unsupported modes');
})().catch(error => { console.error(error); process.exitCode = 1; });
