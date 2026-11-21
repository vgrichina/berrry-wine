#!/usr/bin/env node
'use strict';

// TrackPopupMenu with TPM_RETURNCMD (0x100) runs the menu loop inside the
// call: it returns only once the popup closes, with the picked command id (0
// when dismissed), and posts no WM_COMMAND. SimCity 2000's palette fly-outs
// (Recreation, Power, ...) are built that way. We used to return 0 at once
// without showing anything, so the fly-out never appeared and the game kept
// re-arming the group's last subtool.
//
// The call parks on its thunk (yield 8, stdcall frame left in place) while
// the popup is open, and completes when it is re-entered after the close.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_set_menu") (param $hwnd i32) (param $menu i32)
    (call $handle_SetMenu (local.get $hwnd) (local.get $menu)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
  ;; Push a TrackPopupMenu frame [ret, hMenu, flags, x, y, 0, hWnd, 0] and
  ;; return its guest ESP.
  (func (export "test_tpm_frame") (param $hmenu i32) (param $flags i32) (param $hwnd i32) (result i32)
    (local $sp i32)
    (local.set $sp (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 32)))
    (call $gs32 (local.get $sp) (i32.const 0x401000))
    (call $gs32 (i32.add (local.get $sp) (i32.const 4)) (local.get $hmenu))
    (call $gs32 (i32.add (local.get $sp) (i32.const 8)) (local.get $flags))
    (call $gs32 (i32.add (local.get $sp) (i32.const 12)) (i32.const 40))
    (call $gs32 (i32.add (local.get $sp) (i32.const 16)) (i32.const 40))
    (call $gs32 (i32.add (local.get $sp) (i32.const 20)) (i32.const 0))
    (call $gs32 (i32.add (local.get $sp) (i32.const 24)) (local.get $hwnd))
    (call $gs32 (i32.add (local.get $sp) (i32.const 28)) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (local.get $sp))
  ;; One entry into the handler, as the thunk would make it.
  (func (export "test_tpm_enter") (param $ex i32)
    (global.set $current_thunk_eip (i32.const 0x7500380))
    (global.set $eip (i32.const 0x401000))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0xdeadbeef))
    (if (local.get $ex)
      (then (call $handle_TrackPopupMenuEx
        (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (i32.const 40) (i32.const 40)
        (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)))
        (i32.const 0)))
      (else (call $handle_TrackPopupMenu
        (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
        (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
        (i32.const 40) (i32.const 40) (i32.const 0) (i32.const 0)))))
  (func (export "test_make_owner") (result i32)
    (local $top i32)
    (local.set $top (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $top) (global.get $WNDPROC_CTRL_NATIVE))
    (local.get $top))
  (func (export "test_eax") (result i32) (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_esp") (result i32) (i32.load offset=16 (global.get $reg_base)))
  (func (export "test_set_esp") (param $v i32) (i32.store offset=16 (global.get $reg_base) (local.get $v)))
  (func (export "test_eip") (result i32) (global.get $eip))
  (func (export "test_posted") (param $buf i32) (result i32)
    (call $shared_post_queue_read (local.get $buf) (i32.const 1)))
`;

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none' });
  // The browser compositor has a separate instance over the guest's memory.
  // It must see guest-opened popups, and its picks must reach the guest call.
  const { exports: ui } = await bootRenderHarness({ extraWat, fonts: 'none', memory });
  assert.strictEqual(ui.menu_open_top(), -1, 'fresh shared menu has no selection');
  const strA = text => {
    const p = e.guest_alloc(text.length + 1) >>> 0;
    for (let i = 0; i < text.length; i++) e.guest_write8(p + i, text.charCodeAt(i));
    e.guest_write8(p + text.length, 0);
    return p;
  };
  const msgBuf = e.guest_alloc(28) >>> 0;
  const drain = () => { while (e.test_posted(msgBuf)) { /* discard */ } };

  const hmenu = e.test_call_CreatePopupMenu() >>> 0;
  assert(hmenu, 'CreatePopupMenu');
  for (const [id, text] of [[201, 'Small Park'], [202, 'Big Park'], [203, 'Zoo']]) {
    assert.strictEqual(e.test_call_AppendMenuA(hmenu, 0, id, strA(text)), 1);
  }
  const hwnd = e.test_make_owner() >>> 0;
  const base = ((e.guest_alloc(256) >>> 0) + 224) >>> 0;
  e.test_set_esp(base);

  // Without TPM_RETURNCMD: TRUE at once, frame popped, the pick is posted.
  drain();
  let sp = e.test_tpm_frame(hmenu, 0x0002, hwnd) >>> 0;
  e.test_tpm_enter(0);
  assert.strictEqual(e.test_eax(), 1, 'plain TrackPopupMenu returns TRUE');
  assert.strictEqual(e.test_esp() >>> 0, (sp + 32) >>> 0, 'plain call pops its 7-arg frame');
  assert.strictEqual(e.get_yield_reason(), 0, 'plain call does not park');
  assert.strictEqual(ui.menu_open_hwnd() >>> 0, hwnd, 'compositor sees guest popup owner');
  assert.strictEqual(ui.menu_child_count(hwnd, 0), 3, 'compositor sees guest popup contents');
  ui.menu_set_hover(1);
  assert.strictEqual(ui.menu_activate(), 202);
  assert.ok(e.test_posted(msgBuf), 'plain popup posts WM_COMMAND');
  assert.strictEqual(e.guest_read32(msgBuf + 4), 0x0111);
  assert.strictEqual(e.guest_read32(msgBuf + 8), 202);
  e.test_set_esp(base);

  // TPM_RETURNCMD: parks while open, returns the picked id, posts nothing.
  drain();
  sp = e.test_tpm_frame(hmenu, 0x0100, hwnd) >>> 0;
  e.test_tpm_enter(0);
  assert.strictEqual(e.get_yield_reason(), 8, 'RETURNCMD parks the call');
  assert.strictEqual(e.test_esp() >>> 0, sp, 'parked call leaves its frame');
  assert.strictEqual(e.test_eip() >>> 0, 0x7500380, 'parked call resumes at its thunk');
  assert.strictEqual(e.menu_track_parked(), 1);
  assert.strictEqual(e.menu_child_count(hwnd, 0), 3, 'the popup is really open');
  e.clear_yield();
  e.test_tpm_enter(0);
  assert.strictEqual(e.get_yield_reason(), 8, 'still open: parks again');
  assert.strictEqual(e.test_esp() >>> 0, sp);
  e.clear_yield();
  ui.menu_set_hover(2);
  assert.strictEqual(ui.menu_activate(), 203);
  assert.strictEqual(e.test_posted(msgBuf), 0, 'RETURNCMD pick is not posted');
  assert.strictEqual(e.menu_track_parked(), 0, 'closing the popup ends the wait');
  e.test_tpm_enter(0);
  assert.strictEqual(e.get_yield_reason(), 0);
  assert.strictEqual(e.test_eax(), 203, 'RETURNCMD returns the picked id');
  assert.strictEqual(e.test_esp() >>> 0, (sp + 32) >>> 0, 'completed call pops its frame');
  e.test_set_esp(base);

  // Dismissed: returns 0.
  sp = e.test_tpm_frame(hmenu, 0x0100, hwnd) >>> 0;
  e.test_tpm_enter(0);
  assert.strictEqual(e.get_yield_reason(), 8);
  e.clear_yield();
  ui.menu_close();
  e.test_tpm_enter(0);
  assert.strictEqual(e.test_eax(), 0, 'a dismissed RETURNCMD popup returns 0');
  assert.strictEqual(e.test_esp() >>> 0, sp + 32);
  e.test_set_esp(base);

  // TrackPopupMenuEx shares the path with its 6-arg frame.
  sp = e.test_tpm_frame(hmenu, 0x0100, hwnd) >>> 0;
  e.test_tpm_enter(1);
  assert.strictEqual(e.get_yield_reason(), 8, 'Ex with RETURNCMD parks');
  e.clear_yield();
  ui.menu_set_hover(0);
  assert.strictEqual(ui.menu_activate(), 201);
  e.test_tpm_enter(1);
  assert.strictEqual(e.test_eax(), 201);
  assert.strictEqual(e.test_esp() >>> 0, (sp + 28) >>> 0, 'Ex pops its 6-arg frame');
  e.test_set_esp(base);

  // A popup that cannot open completes at once with 0.
  sp = e.test_tpm_frame(0x12345, 0x0100, hwnd) >>> 0;
  e.test_tpm_enter(0);
  assert.strictEqual(e.get_yield_reason(), 0, 'a failed open does not park');
  assert.strictEqual(e.test_eax(), 0);
  assert.strictEqual(e.test_esp() >>> 0, sp + 32);

  // A direct menubar command selects without opening a dropdown. Preserve
  // its exact command in the pointer receipt, and the public boolean return.
  drain();
  const bar = e.test_call_CreatePopupMenu() >>> 0;
  assert.strictEqual(e.test_call_AppendMenuA(bar, 0, 4, strA('<<')), 1);
  assert.strictEqual(e.test_call_AppendMenuA(bar, 0, 5, strA('>>')), 1);
  assert.strictEqual(e.test_call_AppendMenuA(bar, 0x10, hmenu, strA('Game')), 1);
  e.test_set_menu(hwnd, bar);
  const bx = ui.menu_bar_screen_x(hwnd), by = ui.menu_bar_screen_y(hwnd) + 4;
  for (const [index, id] of [[0, 4], [1, 5]]) {
    const x = bx + ui.menu_bar_item_x(hwnd, index) + 5;
    const sequence = ui.native_menu_pointer_receipt(0);
    assert.strictEqual(ui.menu_handle_bar_click(hwnd, x, by), 1);
    assert.strictEqual(ui.native_menu_pointer_receipt(0), sequence + 1n);
    assert.strictEqual(ui.native_menu_pointer_receipt(7), 2n, 'command selected, not popup opened');
    assert.strictEqual(ui.native_menu_pointer_receipt(8), BigInt(id));
    assert.strictEqual(ui.menu_open_hwnd(), 0);
    assert.ok(e.test_posted(msgBuf));
    assert.strictEqual(e.guest_read32(msgBuf + 4), 0x111);
    assert.strictEqual(e.guest_read32(msgBuf + 8), id);
    assert.strictEqual(e.test_posted(msgBuf), 0, 'one command only');
  }
  const x = bx + ui.menu_bar_item_x(hwnd, 2) + 5;
  assert.strictEqual(ui.menu_handle_bar_click(hwnd, x, by), 1);
  assert.strictEqual(ui.native_menu_pointer_receipt(7), 1n, 'popup remains an open receipt');
  assert.strictEqual(ui.native_menu_pointer_receipt(8), 0n);
  assert.strictEqual(ui.menu_open_hwnd(), hwnd);
  ui.menu_close();
  const sequence = ui.native_menu_pointer_receipt(0);
  assert.strictEqual(ui.menu_handle_bar_click(hwnd, bx - 10, by), 0);
  assert.strictEqual(ui.native_menu_pointer_receipt(0), sequence, 'miss grants no receipt');

  console.log('PASS  TrackPopupMenu return and direct menubar command pointer receipts');
})().catch(err => { console.error('FAIL ', err && err.stack || err); process.exit(1); });
