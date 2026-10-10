#!/usr/bin/env node
'use strict';

// A class built on a native control's GetWindowLong(GWL_WNDPROC) value is that
// control under another name. Civilization II MGE creates a throwaway EDIT,
// reads its wndproc, registers "MSEditBoxClass" with it, subclasses each such
// window and chains to the saved proc with CallWindowProc. The generic native
// marker named no control, so those fields had no edit state and the join
// screen's name box swallowed every keystroke.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

const ROOT = path.join(__dirname, '..');

const extraWat = String.raw`
  (func (export "test_register_class") (param $wc i32) (result i32)
    (local $saved_esp i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_RegisterClassA
      (local.get $wc) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_create") (param $class i32) (param $stack i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0x00ABCDEF))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (i32.const 10))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (i32.const 160))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)) (i32.const 24))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)) (i32.const 0))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 40)) (i32.const 101))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 44)) (global.get $image_base))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 48)) (i32.const 0))
    (call $handle_CreateWindowExA
      (i32.const 0) (local.get $class) (i32.const 0)
      (i32.const 0x50000080) (i32.const 10) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_get_wndproc") (param $hwnd i32) (param $stack i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_GetWindowLongA (local.get $hwnd) (i32.const -4)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_set_wndproc") (param $hwnd i32) (param $proc i32) (param $stack i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_SetWindowLongA (local.get $hwnd) (i32.const -4) (local.get $proc)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_ctrl_class") (param $hwnd i32) (result i32)
    (call $ctrl_table_get_class (local.get $hwnd)))

  (func (export "test_raw_wndproc") (param $hwnd i32) (result i32)
    (call $wnd_table_get (local.get $hwnd)))

  (func (export "test_call") (param $proc i32) (param $hwnd i32) (param $msg i32)
      (param $wp i32) (param $lp i32) (param $stack i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0x00ABCDEF))
    (call $handle_CallWindowProcA (local.get $proc) (local.get $hwnd)
      (local.get $msg) (local.get $wp) (local.get $lp) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
`;

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none' });

  const fixture = fs.readFileSync(path.join(ROOT, 'test', 'binaries', 'calc.exe'));
  new Uint8Array(memory.buffer).set(fixture, e.get_staging());
  assert(e.load_pe(fixture.length), 'fixture PE initializes continuation thunks');
  const imageBase = e.get_image_base() >>> 0;

  const ansi = text => {
    const ptr = e.guest_alloc(text.length + 1) >>> 0;
    for (let i = 0; i < text.length; i++) e.guest_write8(ptr + i, text.charCodeAt(i));
    e.guest_write8(ptr + text.length, 0);
    return ptr;
  };
  const stack = (e.guest_alloc(512) >>> 0) + 256;
  const KIND = 0xFFFF0100;
  const EDIT = 2;

  // The throwaway EDIT: its wndproc names the control it is.
  const temp = e.test_create(ansi('Edit'), stack) >>> 0;
  assert.ok(temp, 'a native EDIT is created');
  assert.strictEqual(e.test_ctrl_class(temp), EDIT);
  const editProc = e.test_get_wndproc(temp, stack) >>> 0;
  assert.strictEqual(editProc, (KIND | EDIT) >>> 0,
    'GetWindowLong(GWL_WNDPROC) on a native EDIT names the EDIT control');

  // RegisterClassA("MSEditBoxClass", lpfnWndProc = that value, cbWndExtra = 8).
  const wc = e.guest_alloc(40) >>> 0;
  for (let offset = 0; offset < 40; offset += 4) e.guest_write32(wc + offset, 0);
  e.guest_write32(wc + 4, editProc);
  e.guest_write32(wc + 12, 8);
  e.guest_write32(wc + 16, imageBase);
  e.guest_write32(wc + 36, ansi('MSEditBoxClass'));
  assert.ok(e.test_register_class(wc) >>> 0, 'the superclass registers');

  const box = e.test_create(ansi('MSEditBoxClass'), stack) >>> 0;
  assert.ok(box, 'a window of the superclass is created');
  assert.strictEqual(e.test_ctrl_class(box), EDIT,
    'a window of a class built on the EDIT proc is an EDIT control');

  // Subclass it, as Civ2 does, and chain keystrokes to the saved proc.
  const subclass = imageBase + 0x1000;
  const saved = e.test_set_wndproc(box, subclass, stack) >>> 0;
  assert.strictEqual(saved, (KIND | EDIT) >>> 0,
    'SetWindowLong(GWL_WNDPROC) hands back the EDIT marker as the old proc');
  assert.strictEqual(e.test_raw_wndproc(box) >>> 0, subclass >>> 0);
  for (const ch of 'Rome') e.test_call(saved, box, 0x0102, ch.charCodeAt(0), 1, stack);
  assert.strictEqual(e.test_call(saved, box, 0x000E, 0, 0, stack) >>> 0, 4,
    'characters chained through CallWindowProc reach the edit text');

  // Removing the subclass restores the native proc, not a stored marker.
  assert.strictEqual(e.test_set_wndproc(box, saved, stack) >>> 0, subclass >>> 0);
  assert.strictEqual(e.test_raw_wndproc(box) >>> 0, 0xFFFF0002,
    'putting the marker back reinstalls the native control proc');
  assert.strictEqual(e.test_get_wndproc(box, stack) >>> 0, (KIND | EDIT) >>> 0);

  console.log('PASS a class built on a native control\'s wndproc creates that control');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
