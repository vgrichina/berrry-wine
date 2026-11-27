#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const apiTable = require('../src/api_table.json');
const { bootRenderHarness } = require('./render-helper');

// Exercise the supported WM_FONTCHANGE route with real x86 window procedures.
// Other callback/message/thread routes must fail visibly until implemented.
const extraWat = String.raw`
  (global $test_callback_stack_delta (mut i32) (i32.const 0))
  (func (export "test_callback_window") (param $proc i32) (param $style i32)
      (param $parent i32) (param $owner i32) (result i32)
    (local $h i32)
    (local.set $h (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (local.get $h) (i32.const 1)))
    (call $wnd_table_set (local.get $h) (local.get $proc))
    (drop (call $wnd_set_style (local.get $h) (local.get $style)))
    (call $wnd_set_parent (local.get $h) (local.get $parent))
    (call $wnd_set_owner (local.get $h) (local.get $owner))
    (local.get $h))
  (func (export "test_callback_remove") (param $h i32)
    (call $wnd_table_remove (local.get $h)))
  (func (export "test_callback_retire") (param $h i32)
    (i32.store8 (i32.add (region.addr $WND_LOOKUP_RETIRED 0)
      (call $wnd_table_find (local.get $h))) (i32.const 1)))
  (func (export "test_callback_replace") (param $h i32) (param $proc i32)
    (call $wnd_table_remove (local.get $h))
    (call $wnd_table_set (local.get $h) (local.get $proc)))
  (func (export "test_callback_send") (param $h i32) (param $msg i32)
      (param $w i32) (param $l i32) (param $callback i32) (param $data i32) (result i32)
    (local $sp i32) (local $frame i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (local.set $frame (i32.sub (local.get $sp) (i32.const 32)))
    (i32.store offset=16 (global.get $reg_base) (local.get $frame))
    (call $gs32 (i32.add (local.get $frame) (i32.const 24)) (local.get $data))
    (call $handle_SendMessageCallbackA (local.get $h) (local.get $msg)
      (local.get $w) (local.get $l) (local.get $callback) (i32.const 0))
    (global.set $test_callback_stack_delta
      (i32.sub (i32.load offset=16 (global.get $reg_base)) (local.get $frame)))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (i32.load (global.get $reg_base)))
  (func (export "test_callback_delta") (result i32)
    (global.get $test_callback_stack_delta))
  (func (export "test_callback_thunk") (param $id i32) (result i32)
    (local $addr i32)
    (global.set $thunk_guest_base (call $w2g (global.get $THUNK_BASE)))
    (local.set $addr (i32.add (global.get $THUNK_BASE)
      (i32.mul (global.get $num_thunks) (i32.const 8))))
    (i32.store (local.get $addr) (i32.const 0))
    (i32.store offset=4 (local.get $addr) (local.get $id))
    (global.set $num_thunks (i32.add (global.get $num_thunks) (i32.const 1)))
    (call $update_thunk_end)
    (call $w2g (local.get $addr)))
`;

const u32 = n => [n, n >>> 8, n >>> 16, n >>> 24].map(b => b & 255);
(async () => {
  const api = apiTable.find(a => a.name === 'SendMessageCallbackA');
  assert.strictEqual(api.nargs, 6);
  let onLog;
  const { exports: e, memory } = await bootRenderHarness({
    extraWat, fonts: 'none', extraHostOverrides: { log: (p, n) => {
      if (onLog && n === 1 && new Uint8Array(memory.buffer)[p] === 120) onLog();
    } },
  });
  const fixture = fs.readFileSync(path.join(__dirname, 'binaries', 'calc.exe'));
  new Uint8Array(memory.buffer).set(fixture, e.get_staging());
  assert(e.load_pe(fixture.length));
  const toWasm = p => (p - e.get_image_base() + e.get_guest_base()) >>> 0;
  const write = code => {
    const p = e.guest_alloc(code.length);
    new Uint8Array(memory.buffer).set(code, toWasm(p));
    return p;
  };
  const cell = () => { const p = e.guest_alloc(4); e.guest_write32(p, 0); return p; };
  const seen = cell(), replacedSeen = cell();
  // WM_FONTCHANGE only; zero LRESULT must still count as successful delivery.
  const proc = write([0x8b, 0x44, 0x24, 8, 0x83, 0xf8, 0x1d, 0x75, 6,
    0xff, 5, ...u32(seen), 0x31, 0xc0, 0xc2, 0x10, 0]);
  const replacement = write([0xff, 5, ...u32(replacedSeen), 0x31, 0xc0, 0xc2, 0x10, 0]);
  const send = (h = 0xffff, msg = 0x1d, w = 0, l = 0, cb = 0, data = 0) => {
    const result = e.test_callback_send(h, msg, w, l, cb, data);
    assert.strictEqual(e.test_callback_delta(), 28, 'return address and all six arguments retired');
    return result;
  };
  assert.strictEqual(send(), 1, 'broadcast to an empty desktop succeeds');
  const hidden = e.test_callback_window(proc, 0, 0, 0);
  const WS_DISABLED = 1 << 27;
  const disabled = e.test_callback_window(proc, WS_DISABLED, 0, 0);
  const popup = e.test_callback_window(proc, 0x80000000, 0, hidden);
  const child = e.test_callback_window(proc, 0x40000000, hidden, 0);
  const messageOnly = e.test_callback_window(proc, 0, -3, 0);
  const retiring = e.test_callback_window(proc, 0, 0, 0);
  e.test_callback_retire(retiring);
  assert.strictEqual(send(0xffff, 0x1d, 0, 0, 0, 0x12345678), 1);
  assert.strictEqual(e.guest_read32(seen), 3, 'hidden, disabled and owned popup receive; child/message-only excluded');
  for (const args of [[hidden], [0xffff, 0x400], [0xffff, 0x1d, 1],
    [0xffff, 0x1d, 0, 1], [0xffff, 0x1d, 0, 0, proc]]) {
    assert.strictEqual(send(...args), 0, 'unsupported route fails explicitly');
    assert.strictEqual(e.test_get_last_error(), 50);
  }
  assert.strictEqual(e.guest_read32(seen), 3, 'unsupported calls deliver nothing');
  e.set_current_thread_id(2);
  const foreign = e.test_callback_window(proc, 0, 0, 0);
  e.set_current_thread_id(1);
  assert.strictEqual(send(), 0, 'foreign thread rejected before any recipient is called');
  assert.strictEqual(e.guest_read32(seen), 3);
  e.test_callback_remove(foreign);

  // A real guest wndproc calls OutputDebugStringA, whose host observer performs
  // reentrant retirement/recreation of a later target with the same HWND.
  // Snapshot generation must prevent delivery to that new publication.
  const logThunk = e.test_callback_thunk(apiTable.find(a => a.name === 'OutputDebugStringA').id);
  const text = write([120, 0]);
  const reentrant = write([0x68, ...u32(text), 0xb8, ...u32(logThunk), 0xff, 0xd0,
    0x31, 0xc0, 0xc2, 0x10, 0]);
  e.wnd_table_set(hidden, reentrant);
  let reentered = 0;
  onLog = () => {
    reentered++;
    e.test_callback_replace(disabled, replacement);
    e.test_callback_remove(popup);
  };
  assert.strictEqual(send(), 1);
  assert.strictEqual(reentered, 1, 'wndproc actually entered the reentrant host call');
  assert.strictEqual(e.guest_read32(replacedSeen), 0, 'replacement never receives the old snapshot message');
  assert.strictEqual(e.guest_read32(seen), 3, 'destroyed later recipient is skipped');
  onLog = undefined;
  for (const h of [hidden, disabled, child, messageOnly, retiring]) e.test_callback_remove(h);

  // Public Win32 dispatch: a real x86 caller pushes all six arguments and
  // checks ESP and the success return after calling the newly registered API.
  const thunk = e.test_callback_thunk(api.id);
  const resultCell = cell(), stackBefore = cell(), stackAfter = cell();
  const outer = write([0x89, 0x25, ...u32(stackBefore),
    0x68, ...u32(0x12345678), 0x6a, 0, 0x6a, 0, 0x6a, 0, 0x6a, 0x1d,
    0x68, ...u32(0xffff), 0xb8, ...u32(thunk), 0xff, 0xd0,
    0xa3, ...u32(resultCell), 0x89, 0x25, ...u32(stackAfter), 0xc2, 0x10, 0]);
  const caller = e.test_callback_window(outer, 0x40000000, 0, 0);
  const esp = e.get_esp();
  e.send_message(caller, 0x400, 0, 0);
  assert.strictEqual(e.guest_read32(resultCell), 1, 'registered thunk reaches the handler');
  assert.strictEqual(e.guest_read32(stackBefore), e.guest_read32(stackAfter), 'stdcall preserves caller stack');
  assert.strictEqual(e.get_esp(), esp, 'nested sender stack restored');
  console.log('PASS SendMessageCallbackA font broadcast delivery, exclusions, lifetime, failure and public stdcall');
})().catch(error => { console.error(error.stack || error); process.exit(1); });
