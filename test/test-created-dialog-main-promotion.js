#!/usr/bin/env node
'use strict';

// CreateDialogParamA can make a resource dialog visible without a later
// ShowWindow call. A retained application DLGPROC must therefore replace an
// invisible framework helper as main_hwnd and arm the normal post-init
// activation continuation at creation time.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_explicit_show") (param $hwnd i32) (param $stack i32) (param $kind i32)
    (call $wnd_table_set (local.get $hwnd) (i32.const 0x401234))
    (drop (call $wnd_set_style (local.get $hwnd) (i32.const 0)))
    (global.set $show_window_activated (i32.const 1))
    (global.set $active_hwnd (local.get $hwnd))
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $gs32 (local.get $stack) (i32.const 0x405678))
    (drop (call $show_window_core (local.get $hwnd) (i32.const 5)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (local.get $kind) (i32.const 0))))
  (func (export "test_explicit_return") (param $hwnd i32) (param $destroy i32)
    (if (local.get $destroy) (then (call $wnd_table_remove (local.get $hwnd))))
    (i32.store offset=16 (global.get $reg_base)
      (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
    (call $win32_dispatch (i32.const 0)))
  (func (export "test_explicit_cdecl_return")
    (i32.store offset=16 (global.get $reg_base)
      (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $win32_dispatch (i32.const 0)))
  (func (export "test_indirect_visibility") (param $visible i32) (result i64)
    (local $template i32) (local $wa i32) (local $hwnd i32) (local $esp i32)
    (local.set $template (call $heap_alloc (i32.const 64)))
    (local.set $wa (call $g2w (local.get $template)))
    (memory.fill (local.get $wa) (i32.const 0) (i32.const 64))
    (i32.store (local.get $wa)
      (i32.or (i32.const 0x80000000) (select (i32.const 0x10000000) (i32.const 0) (local.get $visible))))
    (i32.store16 offset=14 (local.get $wa) (i32.const 100))
    (i32.store16 offset=16 (local.get $wa) (i32.const 80))
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_CreateDialogIndirectParamA (i32.const 0) (local.get $template)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (local.set $hwnd (i32.load (global.get $reg_base)))
    (i32.store offset=16 (global.get $reg_base) (local.get $esp))
    (call $heap_free (local.get $template))
    (i64.or (i64.extend_i32_u (local.get $hwnd))
      (i64.shl (i64.extend_i32_u (call $wnd_get_style (local.get $hwnd))) (i64.const 32))))
  (func (export "test_created_dialog_promotion") (param $visible i32) (result i64)
    (local $hidden i32) (local $dialog i32)
    (global.set $show_window_activated (i32.const 0))
    (global.set $createwnd_implicit_show (i32.const 0))
    (local.set $hidden (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $hidden) (global.get $WNDPROC_BUILTIN))
    (drop (call $wnd_set_style (local.get $hidden) (i32.const 0)))
    (global.set $main_hwnd (local.get $hidden))

    (local.set $dialog (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $dialog) (global.get $WNDPROC_DIALOG))
    (drop (call $wnd_set_style (local.get $dialog)
      (select (i32.const 0x90000000) (i32.const 0x80000000) (local.get $visible))))
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
  const shown = [];
  const { exports: e, renderer } = await bootRenderHarness({
    extraWat, fonts: 'none',
    extraHostOverrides: {
      activate_window: hwnd => { activated.push(hwnd >>> 0); return 1; },
      show_window: (hwnd, cmd) => { shown.push([hwnd >>> 0, cmd]); return renderer.showWindow(hwnd, cmd); },
    },
  });
  const packed = BigInt.asUintN(64, e.test_created_dialog_promotion(1));
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

  assert.strictEqual(Number(BigInt.asUintN(64, e.test_created_dialog_promotion(0)) >> 32n), 0,
    'a hidden modeless dialog does not arm implicit show or activation');
  for (const visible of [0, 1]) {
    const result = BigInt.asUintN(64, e.test_indirect_visibility(visible));
    const hwnd = Number(result & 0xffffffffn);
    const style = Number(result >> 32n);
    assert.strictEqual(!!(style & 0x10000000), !!visible,
      'indirect creation preserves the template visibility bit');
    assert.strictEqual(!!renderer.windows[hwnd].visible, !!visible,
      'hidden indirect dialogs must not be exposed by the host mirror');
  }
  shown.length = 0;
  e.test_explicit_show(0x10030, 0x074fd000);
  assert.strictEqual(e.get_eip(), 0x401234);
  assert.deepStrictEqual([4,8,12,16].map(e.test_stack_word), [0x10030,0x18,1,0]);
  assert.deepStrictEqual(shown, [], 'notification precedes host visibility');
  assert.strictEqual(e.get_esp()>>>0,0x074fd000-40);
  e.test_explicit_return(0x10030,0);
  assert.deepStrictEqual(shown, [[0x10030,5]], 'show completes exactly once');
  assert.strictEqual(e.get_esp()>>>0,0x074fd000+12);
  assert.strictEqual(e.get_eip(),0x405678);
  assert.strictEqual(e.get_eax(),0,'returns original hidden state');
  e.test_explicit_show(0x10030, 0x074fd000);
  e.test_explicit_cdecl_return();
  assert.strictEqual(e.get_esp()>>>0,0x074fd000+12,'cdecl show restores caller stack');
  assert.strictEqual(e.get_eip(),0x405678,'cdecl show resumes caller');
  shown.length=0;
  e.test_explicit_show(0x10031,0x074fd000);
  e.test_explicit_return(0x10031,1);
  assert.deepStrictEqual(shown,[],'destroyed target is not shown');
  assert.strictEqual(e.get_esp()>>>0,0x074fd000+12);
  assert.strictEqual(e.get_eip(),0x405678);
  e.test_explicit_show(0x10032,0x074fd000,1);
  e.test_explicit_return(0x10032,0);
  assert.strictEqual(e.get_eax(),1,'placement success survives the show callback');
  assert.strictEqual(e.get_esp()>>>0,0x074fd000+12);
  console.log('PASS  created dialog activation and indirect visibility');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
