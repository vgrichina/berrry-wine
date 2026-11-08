#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

const ROOT = path.join(__dirname, '..');

const extraWat = String.raw`
  (func (export "test_seed_main_window") (param $hwnd i32)
    (call $wnd_table_set (local.get $hwnd) (global.get $WNDPROC_BUILTIN))
    (global.set $main_hwnd (local.get $hwnd)))
  (func (export "test_retire_main_window") (param $hwnd i32) (result i32)
    (call $destroy_main_window_lifecycle (local.get $hwnd))
    (global.get $main_hwnd))

  (func (export "test_seed_window")
    (param $hwnd i32) (param $style i32) (param $parent i32) (param $owner i32)
    (call $wnd_table_set (local.get $hwnd) (global.get $WNDPROC_BUILTIN))
    (drop (call $wnd_set_style (local.get $hwnd) (local.get $style)))
    (call $wnd_set_parent (local.get $hwnd) (local.get $parent))
    (call $wnd_set_owner (local.get $hwnd) (local.get $owner)))
  (func (export "test_remove_window") (param $hwnd i32)
    (call $wnd_table_remove (local.get $hwnd)))
  (func (export "test_set_main") (param $hwnd i32)
    (global.set $main_hwnd (local.get $hwnd)))
  (func (export "test_adopt_main") (param $hwnd i32)
    (call $main_hwnd_adopt (local.get $hwnd)))
  (func (export "test_set_quit") (param $v i32)
    (global.set $quit_flag (local.get $v)))

  (func (export "test_seed_focused_destroy")
    (param $root i32) (param $child i32) (param $main i32) (param $main_proc i32)
    (call $wnd_table_set (local.get $root) (global.get $WNDPROC_CTRL_NATIVE))
    (call $wnd_table_set (local.get $child) (global.get $WNDPROC_CTRL_NATIVE))
    (call $wnd_set_parent (local.get $child) (local.get $root))
    (call $wnd_table_set (local.get $main) (local.get $main_proc))
    (global.set $main_hwnd (local.get $main))
    (global.set $focus_hwnd (local.get $child)))

  (func (export "test_begin_DestroyWindow") (param $hwnd i32)
    (call $handle_DestroyWindow
      (local.get $hwnd) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0)))

  (func (export "test_get_focus_return_thunk") (result i32)
    (global.get $setfocus_ret_thunk))

  (func (export "test_complete_focus_callback")
    ;; Model an x86 zero LRESULT plus ret 16, then enter the real continuation.
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)))
    (call $win32_dispatch
      (i32.div_u
        (i32.sub (global.get $setfocus_ret_thunk) (global.get $thunk_guest_base))
        (i32.const 8))))
`;

(async () => {
  const { exports: wat, memory } = await bootRenderHarness({ extraWat, fonts: 'none' });
  wat.test_seed_main_window(0x10001);
  assert.strictEqual(wat.get_main_hwnd() >>> 0, 0x10001);
  assert.strictEqual(wat.test_retire_main_window(0x10001) >>> 0, 0,
    'destroying the only top-level clears main_hwnd for its replacement');

  // DestroyWindow never posts WM_QUIT. UT2004's splash is the first top-level
  // (so main); the game viewport outlives it at a non-adjacent HWND. The old
  // hwnd+1 promotion missed it and left quit_flag=1 for the whole run.
  const WS_VISIBLE = 0x10000000, WS_CHILD = 0x40000000;
  const retireAll = () => {
    for (const h of [0x10001, 0x10020, 0x10021, 0x10022, 0x10030, 0x10031, 0x10040])
      wat.test_remove_window(h);
  };
  retireAll();
  wat.test_set_quit(0);
  wat.test_seed_window(0x10020, WS_VISIBLE, 0, 0);            // splash (main)
  wat.test_seed_window(0x10021, WS_VISIBLE | WS_CHILD, 0x10020, 0); // its child
  wat.test_seed_window(0x10022, WS_VISIBLE, 0, 0x10020);      // owned by splash
  wat.test_seed_window(0x10030, WS_VISIBLE, 0, 0);            // game viewport
  wat.test_seed_window(0x10031, 0, 0, 0);                     // hidden helper
  wat.test_set_main(0x10020);
  assert.strictEqual(wat.test_retire_main_window(0x10020) >>> 0, 0x10030,
    'a surviving visible top-level becomes main; children, owned windows and hidden helpers do not');
  assert.strictEqual(wat.get_quit_flag(), 0,
    'destroying main while another top-level survives posts no quit');
  assert.strictEqual(wat.has_pending_message(), 0,
    'no stale quit marker keeps every message wait returning at once');

  // The last visible window dying keeps the synthetic launcher loop-exit
  // marker, and adopting a replacement main window retires it at once --
  // not only when a GetMessage happens to run (a PeekMessage pump never does).
  retireAll();
  wat.test_seed_window(0x10040, WS_VISIBLE, 0, 0);
  wat.test_seed_window(0x10031, 0, 0, 0);                     // hidden only
  wat.test_set_main(0x10040);
  assert.strictEqual(wat.test_retire_main_window(0x10040) >>> 0, 0,
    'no visible top-level survives: main_hwnd is cleared');
  assert.strictEqual(wat.get_quit_flag(), 1,
    'the last visible main window leaves the synthetic loop-exit marker');
  wat.test_adopt_main(0x10031);
  assert.strictEqual(wat.get_quit_flag(), 0,
    'adopting a replacement main window retires the synthetic marker');
  assert.strictEqual(wat.get_main_hwnd() >>> 0, 0x10031);

  // An explicit PostQuitMessage is never downgraded or retired.
  retireAll();
  wat.test_seed_window(0x10040, WS_VISIBLE, 0, 0);
  wat.test_set_main(0x10040);
  wat.test_set_quit(2);
  wat.test_retire_main_window(0x10040);
  assert.strictEqual(wat.get_quit_flag(), 2,
    'PostQuitMessage survives the last window being destroyed');
  wat.test_adopt_main(0x10031);
  assert.strictEqual(wat.get_quit_flag(), 2,
    'adopting a new main window does not cancel a real quit');
  wat.test_set_quit(0);
  retireAll();

  // A renderer probe thread destroying its final window must not adopt a
  // different UI thread's window and run that window's MFC focus proc on
  // the renderer's stack/TLS. Cover both the adjacent-HWND fast path and
  // the general successor scan.
  for (const foreign of [0x18002, 0x10001]) {
    wat.set_current_thread_id(1);
    wat.test_seed_window(foreign, WS_VISIBLE, 0, 0);
    wat.set_current_thread_id(2);
    wat.test_seed_window(0x18001, WS_VISIBLE, 0, 0);
    wat.test_set_main(0x18001);
    assert.strictEqual(wat.test_retire_main_window(0x18001), 0,
      'a foreign top-level cannot become this thread main/focus callback target');
    assert.strictEqual(wat.get_window_thread(foreign), 1);
    wat.test_remove_window(foreign);
    wat.test_remove_window(0x18001);
    wat.test_set_quit(0);
  }
  wat.set_current_thread_id(1);

  const fixture = fs.readFileSync(path.join(ROOT, 'test', 'binaries', 'calc.exe'));
  new Uint8Array(memory.buffer).set(fixture, wat.get_staging());
  assert(wat.load_pe(fixture.length), 'fixture PE initializes continuation thunks');

  const imageBase = wat.get_image_base() >>> 0;
  const guestBase = wat.get_guest_base() >>> 0;
  const toWasm = guest => (guest - imageBase + guestBase) >>> 0;
  const focusProc = 0x00402000;
  const stack = wat.guest_alloc(64) >>> 0;
  assert.notStrictEqual(wat.test_get_focus_return_thunk() >>> 0, 0,
    'PE loader initialized the focus callback continuation');
  const view = new DataView(memory.buffer);
  view.setUint32(toWasm(stack), 0, true);          // stop after API return
  view.setUint32(toWasm(stack + 4), 0x10010, true);

  wat.test_seed_focused_destroy(0x10010, 0x10011, 0x10012, focusProc);
  wat.set_esp(stack);
  wat.set_ebx(0x11223344);
  wat.set_esi(0x22334455);
  wat.set_edi(0x33445566);
  wat.set_ebp(0x44556677);
  wat.test_begin_DestroyWindow(0x10010);
  assert.strictEqual(wat.get_eip() >>> 0, focusProc,
    'DestroyWindow transfers focus synchronously after removing the focused tree');
  wat.test_complete_focus_callback();
  assert.strictEqual(wat.get_eip() >>> 0, 0,
    'focus callback returns through the saved API continuation');
  assert.strictEqual(wat.get_eax() >>> 0, 1,
    'focus wndproc LRESULT does not replace DestroyWindow TRUE');
  assert.strictEqual(wat.get_esp() >>> 0, (stack + 8) >>> 0,
    'DestroyWindow continuation consumes its one-argument stdcall frame');
  assert.deepStrictEqual([
    wat.get_ebx() >>> 0, wat.get_esi() >>> 0,
    wat.get_edi() >>> 0, wat.get_ebp() >>> 0,
  ], [0x11223344, 0x22334455, 0x33445566, 0x44556677],
  'focus callback preserves the API caller nonvolatile registers');

  console.log('PASS DestroyWindow main lifecycle and focus-return continuation');
})().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
