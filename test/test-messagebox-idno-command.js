#!/usr/bin/env node
'use strict';

// IDNO is 7. So is one application's ID_EDIT_SELECT_ALL, and
// $menu_try_edit_command claims that id for the focused edit control before
// $wnd_send_message_inner has looked at who the message was addressed to. A
// message box is a WAT-owned window (control class 15) that maps WM_COMMAND
// straight into its modal result, so the collision cost it its "No" button
// entirely: clicking No selected all the text in the document behind the
// dialog and left the modal up forever. WordPad's "Save changes to Document?"
// could not be answered No, and the app could not be closed.
//
// The edit bridge is for an application's own frame window. Prove that a
// WAT-owned window keeps its own command ids even while a perfectly good edit
// control is sitting in the window table waiting to claim id 7.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_msgbox_yesnocancel") (param $text i32) (param $caption i32) (result i32)
    (global.set $esp (i32.const 0x00120000))
    (call $gs32 (global.get $esp) (i32.const 0x00401000))
    ;; MB_YESNOCANCEL (3) — the button row WordPad puts up on close.
    (call $handle_MessageBoxA (i32.const 0) (local.get $text) (local.get $caption)
      (i32.const 3) (i32.const 0) (i32.const 0))
    (global.get $modal_dlg_hwnd))

  (func (export "test_modal_result") (result i32)
    (global.get $modal_result))

  ;; test_create_edit gives the control a hidden WS_POPUP parent, so the edit
  ;; is not "effectively visible" and the id-7 claimant would not be found once
  ;; the dialog takes the focus. Show the parent: an app whose document window
  ;; is on screen is exactly the situation the collision happens in.
  (func (export "test_show_parent") (param $child i32)
    (local $parent i32)
    (local.set $parent (call $wnd_get_parent (local.get $child)))
    (drop (call $wnd_set_style (local.get $parent)
      (i32.or (call $wnd_get_style (local.get $parent)) (i32.const 0x10000000)))))
`;

(async () => {
  const harness = await bootRenderHarness({ extraWat });
  const e = harness.exports;
  const allocA = text => {
    const p = e.guest_alloc(text.length + 1) >>> 0;
    for (let i = 0; i < text.length; i++) e.guest_write8(p + i, text.charCodeAt(i));
    e.guest_write8(p + text.length, 0);
    return p;
  };

  // The claimant. Without a visible EDIT in the table $edit_command_target
  // returns 0, menu_try_edit_command declines, and the bug cannot reproduce —
  // so this control is the whole point of the test, not scenery.
  const edit = e.test_create_edit(0, 0, 200, 24, 0x50000000, allocA('document text')) >>> 0;
  assert(edit, 'the test needs a real EDIT control for id 7 to collide with');
  // Focused, which is the state a user typing in WordPad leaves behind and the
  // first thing $edit_command_target looks at.
  e.set_focus_hwnd(edit);
  e.test_show_parent(edit);
  assert.strictEqual(e.edit_command_target() >>> 0, edit,
    'and that control has to be the one menu_try_edit_command would pick');
  assert.strictEqual(e.wnd_first_visible_control_class(2) >>> 0, edit,
    'and still be found after the dialog takes the focus away from it');

  const dlg = e.test_msgbox_yesnocancel(
    allocA('Save changes to Document?'), allocA('WordPad')) >>> 0;
  assert(dlg, 'MB_YESNOCANCEL should put up a modal dialog');
  assert.strictEqual(e.modal_dialog_hwnd() >>> 0, dlg,
    'and that dialog should own the modal pump');

  // Exactly what a click on "No" does: the button's wndproc notifies its
  // parent through $wnd_send_message.
  e.send_message(dlg, 0x0111, 7, 0);

  assert.strictEqual(e.modal_dialog_hwnd() >>> 0, 0,
    'WM_COMMAND(IDNO) must complete the modal, not select all the text behind it');
  assert.strictEqual(e.test_modal_result() | 0, 7,
    'and the result the parked MessageBoxA call returns must be IDNO');

  console.log('PASS  IDNO reaches the message box instead of the edit control');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
