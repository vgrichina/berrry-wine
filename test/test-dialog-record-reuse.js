#!/usr/bin/env node
'use strict';

// A destroyed resource dialog must not turn the next window in its table
// slot into a dialog. Rune's viewport inherited the setup wizard's child
// count: renderer dialog traversal translated Escape into IDCANCEL.
const assert = require('assert/strict');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_load_dialog") (param $hwnd i32) (param $template i32) (result i32)
    (call $wnd_table_set (local.get $hwnd) (global.get $WNDPROC_DIALOG))
    (global.set $next_hwnd (i32.add (local.get $hwnd) (i32.const 1)))
    (global.set $dlg_indirect_template_ptr (local.get $template))
    (call $dlg_load (local.get $hwnd) (i32.const 0)))
  (func (export "test_remove") (param $hwnd i32)
    (call $wnd_table_remove (local.get $hwnd)))
  (func (export "test_slot") (param $hwnd i32) (result i32)
    (call $wnd_table_find (local.get $hwnd)))
  (func (export "test_focus") (param $hwnd i32)
    (global.set $focus_hwnd (local.get $hwnd)))
  (func (export "test_record_byte") (param $slot i32) (param $offset i32) (result i32)
    (i32.load8_u (i32.add (call $dlg_record_addr (local.get $slot)) (local.get $offset))))
`;

(async () => {
  const { exports: e, renderer, memory } = await bootRenderHarness({ extraWat });
  // Ordinary DLGTEMPLATE with one STATIC, a caption and nonzero geometry.
  const template = Buffer.alloc(64);
  template.writeUInt32LE(0x90000000, 0);
  template.writeUInt16LE(1, 8);
  template.writeUInt16LE(7, 10);
  template.writeUInt16LE(9, 12);
  template.writeUInt16LE(100, 14);
  template.writeUInt16LE(60, 16);
  template.write('Wizard\0', 22, 'utf16le');
  // DLGITEMTEMPLATE is DWORD aligned after the title at byte 36.
  template.writeUInt32LE(0x50000000, 36);
  template.writeUInt16LE(40, 48);
  template.writeUInt16LE(12, 50);
  template.writeUInt16LE(100, 52);
  template.writeUInt16LE(0xffff, 54);
  template.writeUInt16LE(0x82, 56); // STATIC ordinal
  const pointer = e.guest_alloc(template.length) >>> 0;
  new Uint8Array(memory.buffer).set(template,
    (pointer - e.get_image_base() + e.get_guest_base()) >>> 0);
  const dialog = 0x20001, next = 0x20010;
  assert.equal(e.test_load_dialog(dialog, pointer), 1);
  const slot = e.test_slot(dialog);
  assert.equal(e.dialog_ancestor(dialog), dialog, 'live resource dialog is recognized');
  e.test_focus(dialog);
  renderer.handleKeyDown(27);
  assert.equal(renderer.inputQueue.length, 0, 'live built-in dialog consumes Escape');
  renderer.handleKeyUp(27);
  renderer.inputQueue.length = 0;

  e.test_remove(dialog + 1);
  e.test_remove(dialog);
  e.wnd_table_set(next, 0);
  assert.equal(e.test_slot(next), slot, 'exercise the same recycled slot');
  assert.equal(e.dialog_ancestor(next), 0, 'ordinary replacement is not a dialog');
  assert.deepEqual(Array.from({ length: 32 }, (_, i) => e.test_record_byte(slot, i)),
    Array(32).fill(0), 'all template fields are retired with the dialog');
  e.test_focus(next);
  renderer.handleKeyDown(27);
  renderer.handleKeyUp(27);
  assert.deepEqual(renderer.inputQueue.map(k => [k.msg, k.wParam]),
    [[0x100, 27], [0x101, 27]], 'ordinary replacement receives physical Escape down/up');
  console.log('PASS real template dialog/recycled slot: ancestry, cleared header, live-dialog Escape and ordinary Escape down/up');
})().catch(error => { console.error(error); process.exitCode = 1; });
