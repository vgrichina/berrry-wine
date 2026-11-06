#!/usr/bin/env node
'use strict';

// A hidden utility HWND can be allocated before an application's real UI.
// When that UI is a retained-DLGPROC top-level dialog, first ShowWindow must
// promote it just like an ordinary guest-wndproc top-level and run USER's
// synchronous activation/focus/size sequence against its DLGPROC.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

const ROOT = path.join(__dirname, '..');
const extraWat = String.raw`
  (func (export "test_seed_hidden_then_show_dialog")
    (param $dlgproc i32) (result i64)
    (local $hidden i32) (local $dlg i32)
    ;; The first allocation models a hidden framework/utility HWND that the
    ;; convenience main_hwnd latch saw before the application's real UI.
    (local.set $hidden (global.get $next_hwnd))
    (global.set $next_hwnd
      (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $hidden) (global.get $WNDPROC_BUILTIN))
    (drop (call $wnd_set_style (local.get $hidden) (i32.const 0)))
    (global.set $main_hwnd (local.get $hidden))

    (local.set $dlg (global.get $next_hwnd))
    (global.set $next_hwnd
      (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $dlg) (global.get $WNDPROC_DIALOG))
    (drop (call $wnd_set_style (local.get $dlg) (i32.const 0x80000000)))
    (drop (call $dialog_proc_set (local.get $dlg) (local.get $dlgproc)))

    ;; Keep a genuine return slot while synchronous guest notifications run.
    ;; Zero is the harness execution stop sentinel.
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0))
    (call $handle_ShowWindow
      (local.get $dlg) (i32.const 5)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i64.or (i64.extend_i32_u (local.get $hidden))
      (i64.shl (i64.extend_i32_u (local.get $dlg)) (i64.const 32))))

  (func (export "test_main_hwnd") (result i32)
    (global.get $main_hwnd))

  (func (export "test_show_window_activated") (result i32)
    (global.get $show_window_activated))

  (func (export "test_active_hwnd") (result i32)
    (global.get $active_hwnd))

  (func (export "test_dialog_marker_installed") (param $hwnd i32) (result i32)
    (i32.eq (call $wnd_table_get (local.get $hwnd))
      (global.get $WNDPROC_DIALOG)))
`;

function u32(value) {
  return [value, value >>> 8, value >>> 16, value >>> 24].map(v => v & 0xff);
}

(async () => {
  const harness = await bootRenderHarness({
    extraWat,
    fonts: 'none',
    // The semantic under test is guest HWND selection/message delivery. A
    // real renderer window is unnecessary; return a stable 640x480 client so
    // the activation chain also exercises its final WM_SIZE.
    extraHostOverrides: { show_window: () => 640 | (480 << 16) },
  });
  const { exports: e, memory } = harness;
  const fixture = fs.readFileSync(path.join(ROOT, 'test', 'binaries', 'calc.exe'));
  new Uint8Array(memory.buffer).set(fixture, e.get_staging());
  assert(e.load_pe(fixture.length), 'fixture PE initializes x86 callback support');

  const imageBase = e.get_image_base() >>> 0;
  const guestBase = e.get_guest_base() >>> 0;
  const toWasm = guest => (guest - imageBase + guestBase) >>> 0;
  const bytes = new Uint8Array(memory.buffer);
  const view = new DataView(memory.buffer);
  const count = e.guest_alloc(4) >>> 0;
  const messages = e.guest_alloc(24) >>> 0;
  const proc = e.guest_alloc(64) >>> 0;

  // DLGPROC: messages[count++] = msg; return TRUE.
  bytes.set(Uint8Array.from([
    0x8b, 0x0d, ...u32(count),
    0x8b, 0x44, 0x24, 0x08,
    0x89, 0x04, 0x8d, ...u32(messages),
    0x41,
    0x89, 0x0d, ...u32(count),
    0xb8, 0x01, 0x00, 0x00, 0x00,
    0xc2, 0x10, 0x00,
  ]), toWasm(proc));

  const initialEsp = e.get_esp() >>> 0;
  const packed = BigInt.asUintN(64, e.test_seed_hidden_then_show_dialog(proc));
  const hidden = Number(packed & 0xffffffffn) >>> 0;
  const dialog = Number(packed >> 32n) >>> 0;
  e.run(1000000);
  assert.strictEqual(e.get_eip(), 0, 'ShowWindow resumes its original caller');
  assert.strictEqual(e.get_esp() >>> 0, initialEsp + 12,
    'guest callbacks preserve ShowWindow stdcall cleanup');

  assert.notStrictEqual(dialog, hidden, 'real dialog is distinct from hidden utility HWND');
  assert.strictEqual(e.test_main_hwnd() >>> 0, dialog,
    'shown retained-DLGPROC top-level replaces the invisible helper as main HWND');
  assert.strictEqual(e.test_show_window_activated(), 1,
    'first ShowWindow consumes the application activation gate');
  assert.strictEqual(e.get_focus_hwnd() >>> 0, dialog,
    'focus state names the dialog before its WM_SETFOCUS callback returns');
  assert.strictEqual(e.test_active_hwnd() >>> 0, dialog,
    'first ShowWindow makes the promoted dialog active on this thread queue');
  assert.strictEqual(e.test_dialog_marker_installed(dialog), 1,
    'synchronous activation restores USER\'s retained dialog marker');
  assert.strictEqual(view.getUint32(toWasm(count), true), 6,
    'dialog procedure receives the complete startup sequence');
  assert.deepStrictEqual(Array.from({ length: 6 }, (_, i) =>
    view.getUint32(toWasm(messages + i * 4), true)),
  [0x0018, 0x001c, 0x0006, 0x0007, 0x0003, 0x0005],
  'startup sends WM_SHOWWINDOW before activation, focus, move and size');

  console.log('PASS  first ShowWindow promotes and activates a retained top-level dialog');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
