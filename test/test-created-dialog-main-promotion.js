#!/usr/bin/env node
'use strict';

// CreateDialogParamA can make a resource dialog visible without a later
// ShowWindow call. A retained application DLGPROC must therefore replace an
// invisible framework helper as main_hwnd and arm the normal post-init
// activation continuation at creation time.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_created_dialog_promotion") (result i64)
    (local $hidden i32) (local $dialog i32)
    (local.set $hidden (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $hidden) (global.get $WNDPROC_BUILTIN))
    (drop (call $wnd_set_style (local.get $hidden) (i32.const 0)))
    (global.set $main_hwnd (local.get $hidden))

    (local.set $dialog (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $dialog) (global.get $WNDPROC_DIALOG))
    (drop (call $wnd_set_style (local.get $dialog) (i32.const 0x80000000)))
    (call $created_dialog_promote_app_main
      (local.get $dialog) (i32.const 0x00401234))

    (i64.or
      (i64.extend_i32_u (global.get $main_hwnd))
      (i64.shl
        (i64.extend_i32_u (global.get $createwnd_implicit_show))
        (i64.const 32))))

  (func (export "test_created_owned_dialog_not_promoted") (result i32)
    (local $main i32) (local $dialog i32)
    (global.set $show_window_activated (i32.const 0))
    (global.set $createwnd_implicit_show (i32.const 0))
    (local.set $main (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $main) (global.get $WNDPROC_BUILTIN))
    (drop (call $wnd_set_style (local.get $main) (i32.const 0)))
    (global.set $main_hwnd (local.get $main))
    (local.set $dialog (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $dialog) (global.get $WNDPROC_DIALOG))
    (call $wnd_set_owner (local.get $dialog) (local.get $main))
    (call $created_dialog_promote_app_main
      (local.get $dialog) (i32.const 0x00401234))
    (i32.eq (global.get $main_hwnd) (local.get $main)))

  (func (export "test_finish_implicit_show") (param $stack i32) (result i32)
    ;; Model the WM_CREATE continuation frame consumed by CACA0001. The
    ;; retained-dialog branch completes its activation chain synchronously.
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $gs32 (local.get $stack) (i32.const 0x00405678))
    (call $gs32 (i32.add (local.get $stack) (i32.const 4))
      (global.get $main_hwnd))
    (i32.store (global.get $THUNK_BASE) (i32.const 0xCACA0001))
    (call $win32_dispatch (i32.const 0))
    (global.get $active_hwnd))
  (func (export "test_guest_show_setup")
    (global.set $main_hwnd (i32.const 0x10010))
    (call $wnd_table_set (global.get $main_hwnd) (i32.const 0x401234))
    (global.set $createwnd_implicit_show (i32.const 1)))
  (func (export "test_child_creation_return") (param $stack i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $gs32 (local.get $stack) (i32.const 0x405678))
    (call $gs32 (i32.add (local.get $stack) (i32.const 4)) (i32.const 0x10011))
    (call $win32_dispatch (i32.const 0))
    (global.get $createwnd_implicit_show))
  (func (export "test_stack_word") (param $offset i32) (result i32)
    (call $gl32 (i32.add (i32.load offset=16 (global.get $reg_base)) (local.get $offset))))
  (func (export "test_guest_show_return") (param $destroy i32)
    ;; Simulate ret 16 from WM_SHOWWINDOW, including nested creation changing
    ;; main_hwnd. The outer continuation must retain its own target.
    (global.set $main_hwnd (i32.const 0x10020))
    (if (local.get $destroy) (then (call $wnd_table_remove (i32.const 0x10010))))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
    (call $win32_dispatch (i32.const 0)))
`;

(async () => {
  // The desktop's foreground is the accepted activation, not the top of the
  // z-order, so the implicit-show chain must publish it to the host as the
  // explicit first ShowWindow does. Dungeon Keeper is created WS_VISIBLE and
  // compares GetForegroundWindow() with its HWND in WM_ACTIVATEAPP.
  const activated = [];
  const { exports: e } = await bootRenderHarness({
    extraWat, fonts: 'none',
    extraHostOverrides: {
      activate_window: hwnd => { activated.push(hwnd >>> 0); return 1; },
    },
  });
  const packed = BigInt.asUintN(64, e.test_created_dialog_promotion());
  const main = Number(packed & 0xffffffffn) >>> 0;
  const armed = Number(packed >> 32n) >>> 0;

  assert.strictEqual(main, 0x10002,
    'retained top-level dialog replaces the first hidden helper HWND');
  assert.strictEqual(armed, 1,
    'created dialog arms activation immediately after WM_INITDIALOG');
  assert.strictEqual(e.test_finish_implicit_show(0x074ff000) >>> 0, main,
    'the WM_CREATE continuation makes the visible dialog active');
  assert.deepStrictEqual(activated, [main],
    'the implicit-show chain publishes the activation to the desktop foreground');
  e.set_post_queue_count(0);
  e.test_finish_implicit_show(0x074ff000);
  assert.strictEqual(e.post_queue_depth(), 0,
    'returning through the creation continuation again does not repeat the show');
  assert.strictEqual(e.test_created_owned_dialog_not_promoted(), 1,
    'owned dialogs do not replace the application main window');

  e.test_guest_show_setup();
  assert.strictEqual(e.test_child_creation_return(0x074fe000),1,
    'nested child return must leave its parent implicit show pending');
  assert.strictEqual(e.get_eip(),0x405678,'child returns normally without activation');
  e.test_finish_implicit_show(0x074ff000);
  assert.deepStrictEqual([4,8,12,16].map(e.test_stack_word),[0x10010,0x18,1,0],
    'initial show runs before activation, on a resumable guest frame');
  assert.strictEqual(e.get_esp()>>>0,0x074ff000-24);
  e.test_guest_show_return(0);
  assert.deepStrictEqual([4,8,12,16].map(e.test_stack_word),[0x10010,0x1c,1,0],
    'activation follows show and retains its target across nested creation');
  e.test_guest_show_setup();
  e.test_finish_implicit_show(0x074ff000);
  e.test_guest_show_return(1);
  assert.strictEqual(e.get_eax(),0,'destruction during show fails creation');
  assert.strictEqual(e.get_eip(),0x405678);
  assert.strictEqual(e.get_esp()>>>0,0x074ff008,'destroyed callback releases its frame');

  console.log('PASS  created top-level app dialog promotes and arms activation');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
