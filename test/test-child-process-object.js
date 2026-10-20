#!/usr/bin/env node
'use strict';

// The process object of a child CreateProcess started (phase 3 of
// docs/design-anonymous-pipes.md). hProcess used to be the constant 0xE3001:
// a wait on it returned at once, GetExitCodeProcess said 0 while the child
// ran, and TerminateProcess(hChild) called host_exit on the CALLER. Now the
// handle names the child (0x00E40000 | pid) and every answer comes from the
// host that started it (process_ctl), here a stub holding one child.

const assert = require('assert');
const { ThreadManager } = require('../lib/thread-manager');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_last_error") (result i32) (global.get $last_error))
  (func (export "t_GetExitCodeProcess") (param $h i32) (param $out i32) (result i32)
    (call $handle_GetExitCodeProcess (local.get $h) (local.get $out) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "t_TerminateProcess") (param $h i32) (param $code i32) (result i32)
    (call $handle_TerminateProcess (local.get $h) (local.get $code) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "t_child_handle") (param $pid i32) (result i32)
    (call $pipe_child_process_handle (local.get $pid)))
`;

(async () => {
  const children = new Map([[0x4004, { exited: false, exitCode: 259 }]]);
  const ctlCalls = [];
  let hostExitCode = null;
  const processCtl = (op, pid, arg) => {
    ctlCalls.push([op, pid, arg]);
    const c = children.get(pid & 0xFFFF);
    if (!c) return op === 8 ? -1 : -6;
    if (op === 4) return c.exitCode >>> 0;
    if (op === 6) return (0x1FFFFF & arg) === arg ? 1 : -5;
    if (op === 7) { children.delete(pid & 0xFFFF); return 1; }
    if (op === 8) return c.exited ? 0 : 0x102;
    if (op === 5) {
      if (c.exited) return -5;
      c.exitCode = arg >>> 0; c.exited = true; return 1;
    }
    return -1;
  };
  const harness = await bootRenderHarness({
    extraWat, fonts: 'none',
    extraHostOverrides: { process_ctl: processCtl, exit: code => { hostExitCode = code; } },
  });
  const e = harness.exports;
  const out = e.guest_alloc(16) >>> 0;
  const stack = e.guest_alloc(256) >>> 0;
  const call = (name, ...a) => { e.set_esp(stack + 128); return e[name](...a) >>> 0; };

  const h = e.t_child_handle(0x4004) >>> 0;
  assert.strictEqual(h, 0x00E44004, 'a child hProcess is 0x00E40000 | pid');

  // --- running child ---
  assert.strictEqual(call('t_GetExitCodeProcess', h, out), 1);
  assert.strictEqual(e.guest_read32(out) >>> 0, 259, 'a running child reports STILL_ACTIVE');
  assert.strictEqual(e.get_esp() >>> 0, stack + 128 + 12, 'GetExitCodeProcess pops two arguments');

  const tm = new ThreadManager(null, harness.memory, harness.instance, () => ({ host: {} }), {});
  tm._log = () => {};
  tm.processCtl = processCtl;
  assert.strictEqual(tm.waitSingle(h, 0), 0x102, 'polling a running child is WAIT_TIMEOUT');
  assert.strictEqual(tm.waitSingle(h, 0xFFFFFFFF), 0xFFFF, 'an infinite wait blocks');

  // --- TerminateProcess(child) stops the child, not the caller ---
  assert.strictEqual(call('t_TerminateProcess', h, 7), 1, 'TerminateProcess(hChild) succeeds');
  assert.strictEqual(hostExitCode, null, 'and does not end the calling process');
  assert.deepStrictEqual(ctlCalls[ctlCalls.length - 1], [5, h, 7], 'the host is asked to stop that child');
  assert.strictEqual(e.get_esp() >>> 0, stack + 128 + 12, 'TerminateProcess pops two arguments');

  // --- exited child ---
  assert.strictEqual(call('t_GetExitCodeProcess', h, out), 1);
  assert.strictEqual(e.guest_read32(out) >>> 0, 7, "the exit code is the terminate code");
  assert.strictEqual(tm.waitSingle(h, 0xFFFFFFFF), 0, 'a wait on an exited child is WAIT_OBJECT_0');

  // --- unknown child handle ---
  const ghost = e.t_child_handle(0x4100) >>> 0;
  assert.strictEqual(call('t_GetExitCodeProcess', ghost, out), 0, 'an unknown child handle fails');
  assert.strictEqual(e.test_last_error() >>> 0, 6, 'with ERROR_INVALID_HANDLE');
  assert.strictEqual(call('t_TerminateProcess', ghost, 1), 0);

  // --- the caller's own handle still ends the caller ---
  call('t_TerminateProcess', 0xFFFFFFFF, 3);
  assert.strictEqual(hostExitCode, 3, 'TerminateProcess(GetCurrentProcess()) still exits this process');

  console.log('PASS test-child-process-object');
})().catch(err => { console.error(err); process.exit(1); });
