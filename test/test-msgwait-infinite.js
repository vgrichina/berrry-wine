#!/usr/bin/env node

'use strict';

// MsgWaitForMultipleObjects must never answer WAIT_TIMEOUT to an INFINITE
// wait. Windows Installer waits for each custom-action EXE with
// MsgWaitForMultipleObjects(1, &hProcess, FALSE, INFINITE, QS_ALLINPUT) and
// loops only on WAIT_OBJECT_0+1 (a message); WAIT_TIMEOUT sent it on to
// GetExitCodeProcess, which read STILL_ACTIVE, so every custom action
// reported Info 1722 while the child was still running. The idle answer for
// INFINITE is a message wake; a finite timeout keeps WAIT_TIMEOUT.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const WAIT_TIMEOUT = 0x102;
const INFINITE = 0xFFFFFFFF;

const extraWat = String.raw`
  (func (export "test_msgwait_idle") (param $count i32) (param $timeout i32) (result i32)
    (call $msgwait_idle_result (local.get $count) (local.get $timeout)))
  (func (export "test_msgwait_ready") (result i32)
    (call $msgwait_queue_ready))
  (func (export "test_msgwait_call") (param $count i32) (param $handles i32) (param $timeout i32) (result i32)
    (local $sp i32) (local $ip i32) (local $result i32) (local $popped i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (local.set $ip (global.get $eip))
    (call $handle_MsgWaitForMultipleObjects (local.get $count) (local.get $handles)
      (i32.const 0) (local.get $timeout) (i32.const 0x4ff) (i32.const 0))
    (local.set $result (i32.load (global.get $reg_base)))
    (local.set $popped (i32.sub (i32.load offset=16 (global.get $reg_base)) (local.get $sp)))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (global.set $eip (local.get $ip))
    (global.set $yield_flag (i32.const 0))
    (global.set $yield_reason (i32.const 0))
    (global.set $handler_set_eip (i32.const 0))
    (if (i32.ne (local.get $popped) (i32.const 24)) (then (return (i32.const -2))))
    (local.get $result))
`;

(async () => {
  let handleState = 0xFFFF; // "would block": the child process is still running
  const { exports: wat } = await bootRenderHarness({
    extraWat, fonts: 'none',
    extraHostOverrides: { wait_multiple: () => handleState },
  });
  assert.strictEqual(wat.test_msgwait_ready(), 0, 'a fresh harness has no queued message work');

  // The shared idle answer (also used by $win32_dispatch's direct path).
  assert.strictEqual(wat.test_msgwait_idle(1, INFINITE | 0), 1,
    'INFINITE with nothing ready is a message wake, WAIT_OBJECT_0 + nCount');
  assert.strictEqual(wat.test_msgwait_idle(0, INFINITE | 0), 0,
    'INFINITE with no handles is a message wake too');
  assert.strictEqual(wat.test_msgwait_idle(1, 0), WAIT_TIMEOUT, 'a zero-timeout poll still times out');
  assert.strictEqual(wat.test_msgwait_idle(1, 50), WAIT_TIMEOUT, 'a finite timeout still times out');

  // The handler, stdcall frame and all: msi.dll's custom-action wait.
  const handles = 0x3000;
  assert.strictEqual(wat.test_msgwait_call(1, handles, INFINITE | 0), 1,
    'msi.dll custom-action wait on a running process must not see WAIT_TIMEOUT');
  assert.strictEqual(wat.test_msgwait_call(1, handles, 0), WAIT_TIMEOUT,
    'a polling wait on a running process times out');
  assert.strictEqual(wat.test_msgwait_call(1, handles, 50), WAIT_TIMEOUT,
    'a finite wait on a running process times out');

  handleState = 0; // the child exited: its process handle is signaled
  assert.strictEqual(wat.test_msgwait_call(1, handles, INFINITE | 0), 0,
    'a signaled handle still answers WAIT_OBJECT_0 under INFINITE');

  console.log('PASS  MsgWaitForMultipleObjects never answers WAIT_TIMEOUT to INFINITE');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
