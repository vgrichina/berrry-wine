#!/usr/bin/env node
'use strict';

// A message posted to a thread between CreateThread and the thread's first
// instruction must reach it. CreateThread hands the creator the thread id at
// once, and with the Worker backend the thread's instance starts later,
// asynchronously. Unreal Tournament's splash thread is exactly this: the main
// thread PostThreadMessage(WM_QUIT)s it (ExitSplash, exe 0x10901be0) before
// the Worker has run, and init_thread used to reset the queue, dropping the
// quit. The splash (topmost, created by that thread) then stayed over the
// first-run wizard and took every click (issue #30).
//
// The queue is cleared when the id is allocated instead, so a predecessor's
// leftovers still do not leak into a reused slot.

const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const { ThreadManager } = require('../lib/thread-manager');

const WM_QUIT = 0x12;
const extraWat = String.raw`
  (func (export "test_post_thread") (param $tid i32) (param $msg i32) (result i32)
    (local $saved_esp i32) (local $result i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_PostThreadMessageA
      (local.get $tid) (local.get $msg) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (local.set $result (i32.load offset=0 (global.get $reg_base)))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (local.get $result))
  (func (export "test_queue_count") (param $tid i32) (result i32)
    (call $shared_post_queue_total_count_tid (local.get $tid)))
  (func (export "test_queue_msg") (param $tid i32) (result i32)
    (call $shared_post_queue_peek_field_tid (local.get $tid) (i32.const 0) (i32.const 1)))
  (func (export "test_current_thread_id") (result i32) (global.get $current_thread_id))
`;

(async () => {
  const h = await bootRenderHarness({ extraWat, fonts: 'none' });
  const e = h.exports;
  const manager = new ThreadManager(h.module, h.memory, h.instance,
    () => ({ host: h.host, gdi: h.gdi }), { log: () => {} });

  // A predecessor left a message in Win32 thread 2's queue.
  assert.equal(e.test_post_thread(2, 0x0401), 1);
  assert.equal(e.test_queue_count(2), 1);

  const tidOut = 0x3100;
  const handle = manager.createThread(0x401000, 0, 0, 0, e.guest_to_wasm(tidOut), 1);
  assert.ok(handle, 'CreateThread allocated a thread');
  assert.equal(e.guest_read32(tidOut), 2, 'first worker slot is Win32 thread id 2');
  assert.equal(e.test_queue_count(2), 0, 'a reused id starts with an empty queue');

  // The creator posts before the thread's instance exists (UT ExitSplash).
  assert.equal(e.test_post_thread(2, WM_QUIT), 1);

  // Now the thread's own instance starts, as the Worker backend does later.
  const worker = new WebAssembly.Instance(h.module, { host: h.host, gdi: h.gdi }).exports;
  worker.init_thread(1, e.get_image_base(), 0, 0, 0, 0, 0, 1);
  assert.equal(worker.test_current_thread_id(), 2);
  assert.equal(worker.test_queue_count(2), 1, 'init_thread keeps the message posted before it');
  assert.equal(worker.test_queue_msg(2), WM_QUIT, 'and it is the WM_QUIT the creator posted');

  console.log('PASS PostThreadMessage between CreateThread and the thread start survives; a reused id still starts empty');
})().catch(error => { console.error(error); process.exitCode = 1; });
