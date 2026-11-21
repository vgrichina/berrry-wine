#!/usr/bin/env node
'use strict';

// A keystroke on the dialog that owns the running modal pump (Esc, Enter,
// Space) becomes a POSTED WM_COMMAND, which the pump (CACA0004) delivers by
// entering the DLGPROC on its own continuation stack -- as IsDialogMessage
// does inside the real modal loop. The synchronous send it used to be is a
// nested $run that $wnd_send_message abandons after 64 rounds, so a long OK
// handler was cut off mid-way: the Alien vs Predator demo's RAR
// self-extractor unpacks its whole archive inside IDOK and stopped a third
// of the way in. A dialog that is not the modal pump's keeps the send.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "t_set_pump") (param $hwnd i32) (global.set $dlg_pump_hwnd (local.get $hwnd)))
  (func (export "t_child") (param $parent i32) (param $class i32) (param $id i32) (param $style i32) (result i32)
    (call $ctrl_create_child (local.get $parent) (local.get $class) (local.get $id)
      (i32.const 0) (i32.const 0) (i32.const 80) (i32.const 24) (local.get $style) (i32.const 0)))
  (func (export "t_keyboard") (param $hwnd i32) (param $msg i32) (param $vk i32) (result i32)
    (call $dialog_input_keyboard (local.get $hwnd) (local.get $msg) (local.get $vk) (i32.const 0)))
  (func (export "t_post_key") (param $hwnd i32) (param $vk i32)
    (local $stack i32) (local $saved_esp i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (local.set $stack (call $heap_alloc (i32.const 128)))
    (memory.fill (call $g2w (local.get $stack)) (i32.const 0) (i32.const 128))
    (i32.store offset=16 (global.get $reg_base) (i32.add (local.get $stack) (i32.const 64)))
    (global.set $dlg_loop_thunk (call $w2g (global.get $THUNK_BASE)))
    (i32.store (global.get $THUNK_BASE) (i32.const 0xCACA0004))
    ;; Start at the keyboard queue boundary with paint already drained.
    (block $done (loop $paint
      (br_if $done (i32.eqz (call $paint_flag_take))) (br $paint)))
    (global.set $nc_flags_count (i32.const 0))
    (drop (call $post_queue_push (local.get $hwnd) (i32.const 0x100) (local.get $vk) (i32.const 0)))
    (call $win32_dispatch (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (call $heap_free (local.get $stack)))
  ;; A live dialog window, as DialogBoxParamA registers it.
  (func (export "t_make_dialog") (param $hwnd i32) (result i32)
    (call $wnd_table_set (local.get $hwnd) (global.get $WNDPROC_DIALOG))
    (drop (call $wnd_set_style (local.get $hwnd) (i32.const 0x90000000)))
    (call $wnd_get_thread (local.get $hwnd)))
  ;; The modal pump's own read of the shared USER queue (09b-dispatch.wat).
  (func (export "t_take") (result i32)
    (call $shared_post_queue_read (i32.const 0) (i32.const 1)))
  (func (export "t_probe") (param $i i32) (result i32)
    (if (result i32) (i32.eqz (local.get $i)) (then (global.get $user_queue_probe_hwnd))
      (else (if (result i32) (i32.eq (local.get $i) (i32.const 1)) (then (global.get $user_queue_probe_msg))
        (else (if (result i32) (i32.eq (local.get $i) (i32.const 2)) (then (global.get $user_queue_probe_wparam))
          (else (global.get $user_queue_probe_lparam))))))))
  (func (export "t_drain")
    (block $done (loop $l (br_if $done (i32.eqz (call $shared_post_queue_read (i32.const 0) (i32.const 1)))) (br $l))))
`;

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const DLG = 0x00012345, OTHER = 0x00012346;

  assert.notStrictEqual(e.t_make_dialog(DLG), 0, 'the dialog has an owning thread');
  e.t_drain();
  e.t_set_pump(DLG);
  assert.strictEqual(e.dialog_handle_key(DLG, 27, 0), 1, 'Esc is handled');
  assert.strictEqual(e.t_take(), 1, 'the modal dialog gets a posted message, not a nested send');
  assert.deepStrictEqual([0, 1, 2, 3].map(i => e.t_probe(i) >>> 0), [DLG, 0x0111, 2, 0],
    'WM_COMMAND IDCANCEL to the dialog');
  assert.strictEqual(e.t_take(), 0, 'exactly one');

  // Not the modal pump's dialog: the synchronous send stays (no window proc
  // is registered for it here, so the send itself does nothing).
  assert.strictEqual(e.dialog_handle_key(OTHER, 27, 0), 1, 'Esc is still handled');
  assert.strictEqual(e.t_take(), 0, 'a modeless dialog is not posted to');

  e.t_set_pump(0);
  // Ordinary DialogBox native input must run USER selection before dispatch.
  // A group contains a nested page/list; Next is an ownerdraw BUTTON with a
  // custom command id, rather than IDOK or BS_DEFPUSHBUTTON.
  const next = e.t_child(DLG, 1, 1004, 0x5001400b) >>> 0;
  const cancel = e.t_child(DLG, 1, 2, 0x5001400b) >>> 0;
  const group = e.t_child(DLG, 3, 1061, 0x50000007) >>> 0;
  const page = e.t_child(group, 0, 0, 0x50000000) >>> 0;
  const list = e.t_child(page, 4, 1103, 0x50010003) >>> 0;
  e.set_focus_hwnd(list);
  e.t_set_pump(DLG);
  assert.strictEqual(e.t_keyboard(list, 0x100, 9), 1, 'modal Tab is selected by USER');
  assert.strictEqual(e.get_focus_hwnd() >>> 0, next, 'Tab leaves nested list for root Next');
  assert.strictEqual(e.t_take(), 0, 'focus movement alone sends no command');
  assert.strictEqual(e.t_keyboard(next, 0x100, 13), 1, 'modal Enter is selected by USER');
  assert.strictEqual(e.t_take(), 1, 'custom button command uses the existing modal queue');
  assert.deepStrictEqual([0, 1, 2, 3].map(i => e.t_probe(i) >>> 0), [DLG, 0x111, 1004, next]);
  assert.strictEqual(e.t_take(), 0, 'exactly one Next command');
  assert.strictEqual(e.t_keyboard(cancel, 0x102, 13), 0, 'WM_CHAR is left to the control');
  assert.strictEqual(e.t_keyboard(OTHER, 0x100, 13), 0, 'foreign window is not selected');
  assert.strictEqual(e.t_keyboard(list, 0x100, 65), 0, 'ordinary key is left to the control');
  assert.strictEqual(e.t_take(), 0, 'negative cases send no command');
  e.set_focus_hwnd(list);
  e.t_post_key(list, 9);
  assert.strictEqual(e.get_focus_hwnd() >>> 0, next, 'posted Tab also uses modal selection');
  assert.strictEqual(e.t_take(), 0, 'posted Tab sends no command');
  e.t_post_key(next, 13);
  assert.strictEqual(e.t_take(), 1, 'posted Enter becomes a queued modal command');
  assert.deepStrictEqual([0, 1, 2, 3].map(i => e.t_probe(i) >>> 0), [DLG, 0x111, 1004, next]);
  assert.strictEqual(e.t_take(), 0, 'posted Enter sends exactly one command');
  e.t_set_pump(0);
  console.log('PASS dialog keys post WM_COMMAND to the modal pump dialog; other dialogs keep the send');
})().catch(error => { console.error(error); process.exitCode = 1; });
