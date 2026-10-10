#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = `
  (func (export "test_native_control") (param $h i32)
    (call $wnd_table_set (local.get $h) (global.get $WNDPROC_CTRL_NATIVE)))
  (func (export "test_modal_template") (result i32)
    (local $sel i32) (local $p i32)
    ;; Reserve the three synthetic code/stack/thunk segments before using the
    ;; real global allocator for an empty Win16 DLGTEMPLATE.
    (if (i32.lt_u (call $win16_next_seg_get) (i32.const 4))
      (then (call $win16_next_seg_set (i32.const 4))))
    (local.set $sel (call $win16_global_alloc (i32.const 32)))
    (local.set $p (call $win16_far_to_guest (local.get $sel) (i32.const 0)))
    (call $zero_memory (call $g2w (local.get $p)) (i32.const 32))
    (call $gs32 (local.get $p) (i32.const 0x80000000))
    (call $gs16 (i32.add (local.get $p) (i32.const 9)) (i32.const 80))
    (call $gs16 (i32.add (local.get $p) (i32.const 11)) (i32.const 40))
    (local.get $sel))
  (func (export "test_widen") (param $h i32) (result i32) (call $win16_h32 (local.get $h)))
  (func (export "test_modal_finish") (param $dlg i32) (param $owner i32)
        (param $main i32) (param $focus i32) (param $active i32)
    (call $post_queue_reset)
    (call $wnd_set_owner (local.get $dlg) (local.get $owner))
    (global.set $main_hwnd (local.get $main))
    (global.set $active_hwnd (local.get $active))
    (global.set $focus_hwnd (local.get $focus))
    (global.set $win16_dlg_result (i32.const 42))
    (global.set $win16_dlg_ended (i32.const 1))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x110800))
    (call $gs16 (i32.const 0x110800) (call $win16_h16 (local.get $dlg)))
    (call $gs16 (i32.const 0x110802) (i32.const 0x90))
    (call $gs16 (i32.const 0x110804) (i32.const 0x000f))
    (call $win16_dlg_pump))
  (func (export "test_peek_thunk") (result i32)
    (call $win16_thunk_for (i32.const 2) (i32.const 109) (i32.const 0)))
  (func (export "test_modal_mouse") (param $h i32) (result i32)
    (local $dirty i32)
    (call $post_queue_reset)
    (call $test_modal_clear_nc)
    (block $clean (loop $next
      (local.set $dirty (call $paint_flag_first))
      (br_if $clean (i32.eqz (local.get $dirty)))
      (call $paint_flag_clear_hwnd (local.get $dirty))
      (call $update_clear_hwnd (local.get $dirty))
      (br $next)))
    (global.set $win16_dlg_ended (i32.const 0))
    (global.set $yield_reason (i32.const 0))
    (drop (call $dialog_proc_set (local.get $h) (call $wnd_table_get (local.get $h))))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x110800))
    (call $gs16 (i32.const 0x110800) (call $win16_h16 (local.get $h)))
    (call $win16_dlg_pump)
    (i32.add (i32.const 0x120000) (global.get $WIN16_DLG_PUMP)))
  (func (export "test_modal_step") (call $win16_dlg_pump))
  (func (export "test_mouse_pump") (param $peek i32) (param $remove i32) (param $min i32) (param $max i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x110800))
    (call $gs16 (i32.const 0x110800) (i32.const 0x90))
    (call $gs16 (i32.const 0x110802) (i32.const 0x000f))
    (if (local.get $peek)
      (then
        (call $gs16 (i32.const 0x110804) (local.get $remove))
        (call $gs16 (i32.const 0x110806) (local.get $max))
        (call $gs16 (i32.const 0x110808) (local.get $min))
        (call $gs16 (i32.const 0x11080a) (i32.const 0))
        (call $gs32 (i32.const 0x11080c) (i32.const 0x00170e00))
        (call $win16_PeekMessage))
      (else
        (call $gs16 (i32.const 0x110804) (local.get $max))
        (call $gs16 (i32.const 0x110806) (local.get $min))
        (call $gs16 (i32.const 0x110808) (i32.const 0))
        (call $gs32 (i32.const 0x11080a) (i32.const 0x00170e00))
        (call $win16_GetMessage))))
  (func $test_modal_clear_nc (export "test_mouse_clear_nc")
    (local $h i32)
    (block $done (loop $next
      (local.set $h (call $nc_flags_scan (i32.const 7)))
      (br_if $done (i32.eqz (local.get $h)))
      (call $nc_flags_clear (local.get $h) (i32.const 7))
      (br $next))))
  (func (export "test_focus_api") (param $h i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x110800))
    (call $gs16 (i32.const 0x110800) (i32.const 0x90))
    (call $gs16 (i32.const 0x110802) (i32.const 0x000f))
    (call $gs16 (i32.const 0x110804) (call $win16_h16 (local.get $h)))
    (call $win16_SetFocus))
  (func (export "test_click_activate") (param $h i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x11080e))
    (call $win16_cont_push (i32.const 0x000f0090) (i32.const 42))
    (call $win16_activate_start_reason (local.get $h) (i32.const 2)))
  (func (export "test_mouse") (param $h i32) (param $top i32) (param $lp i32) (param $send i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x110800))
    (call $gs16 (i32.const 0x110800) (i32.const 0x90))
    (call $gs16 (i32.const 0x110802) (i32.const 0x000f))
    (call $gs32 (i32.const 0x110804) (local.get $lp))
    (call $gs16 (i32.const 0x110808) (call $win16_h16 (local.get $top)))
    (call $gs16 (i32.const 0x11080a) (i32.const 0x21))
    (call $gs16 (i32.const 0x11080c) (call $win16_h16 (local.get $h)))
    (if (local.get $send)
      (then (call $win16_SendMessage))
      (else (call $win16_DefWindowProc))))
  (func (export "test_long_result") (result i32)
    (i32.or (i32.and (i32.load (global.get $reg_base)) (i32.const 0xFFFF))
      (i32.shl (i32.load offset=8 (global.get $reg_base)) (i32.const 16))))
  (func (export "test_init")
    (global.set $WIN16_THUNK_SEL (call $win16_index_to_sel (i32.const 3)))
    (call $win16_seg_set (i32.const 1) (i32.const 0x100000) (i32.const 65536) (i32.const 0) (i32.const 1))
    (call $win16_seg_set (i32.const 2) (i32.const 0x110000) (i32.const 65536) (i32.const 1) (i32.const 2))
    (call $win16_seg_set (i32.const 3) (i32.const 0x120000) (i32.const 65536) (i32.const 0) (i32.const 3))
    (global.set $code16 (i32.const 1))
    (call $win16_set_sreg (i32.const 1) (call $win16_index_to_sel (i32.const 1)))
    (call $win16_set_sreg (i32.const 2) (call $win16_index_to_sel (i32.const 2))))
  (func (export "test_window") (param $proc i32) (result i32)
    (local $h i32)
    (local.set $h (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $h) (i32.or (i32.const 0x000f0000) (local.get $proc)))
    (drop (call $wnd_set_style (local.get $h) (i32.const 0x10000000)))
    (call $client_rect_set (local.get $h) (i32.const 3) (i32.const 4) (i32.const 116) (i32.const 218))
    (local.get $h))
  (func (export "test_narrow") (param $h i32) (result i32) (call $win16_h16 (local.get $h)))
  (func (export "test_as_child") (param $h i32) (param $parent i32)
    (drop (call $wnd_set_style (local.get $h) (i32.const 0x50000000)))
    (call $wnd_set_parent (local.get $h) (local.get $parent))
    (call $ctrl_geom_sync (local.get $h) (i32.const 7) (i32.const 26)
      (i32.const 120) (i32.const 230) (i32.const 8)))
  (func (export "test_thunk") (result i32)
    (call $win16_thunk_for (i32.const 2) (i32.const 107) (i32.const 0)))
  (func (export "test_set_thunk") (result i32)
    (call $win16_thunk_for (i32.const 2) (i32.const 232) (i32.const 0)))
  (func (export "test_destroy_thunk") (result i32)
    (call $win16_thunk_for (i32.const 2) (i32.const 53) (i32.const 0)))
  (func (export "test_call") (param $h i32) (param $pointer i32) (param $caller i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x110800))
    (call $gs16 (i32.const 0x110800) (local.get $caller))
    (call $gs16 (i32.const 0x110802) (i32.const 0x000f))
    (call $gs32 (i32.const 0x110804) (local.get $pointer))
    (call $gs16 (i32.const 0x110808) (i32.const 0))
    (call $gs16 (i32.const 0x11080a) (i32.const 0x47))
    (call $gs16 (i32.const 0x11080c) (call $win16_h16 (local.get $h)))
    (call $win16_DefWindowProc))
  (func (export "test_result") (result i32) (i32.load (global.get $reg_base)))
  (func (export "test_min") (param $h i32) (result i32) (call $wnd_min_get (local.get $h)))
  (func (export "test_max") (param $h i32) (result i32) (call $wnd_max_get (local.get $h)))
  (func (export "test_iconify") (param $h i32) (call $wnd_apply_show_state (local.get $h) (i32.const 6)))
  (func (export "test_sys") (param $h i32) (param $sc i32) (param $caller i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x110800))
    (call $gs16 (i32.const 0x110800) (local.get $caller))
    (call $gs16 (i32.const 0x110802) (i32.const 0x000f))
    (call $gs32 (i32.const 0x110804) (i32.const 0))
    (call $gs16 (i32.const 0x110808) (local.get $sc))
    (call $gs16 (i32.const 0x11080a) (i32.const 0x112))
    (call $gs16 (i32.const 0x11080c) (call $win16_h16 (local.get $h)))
    (call $win16_DefWindowProc))
  (func (export "test_active") (result i32) (global.get $active_hwnd))
  (func (export "test_rank") (param $h i32) (result i32) (call $wnd_z_get (local.get $h)))
  (func (export "test_focus") (result i32) (global.get $focus_hwnd))
  (func (export "test_reset_activation")
    (global.set $active_hwnd (i32.const 0)) (global.set $focus_hwnd (i32.const 0)))
  (func (export "test_set") (param $h i32) (param $flags i32) (param $caller i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x110800))
    (call $gs16 (i32.const 0x110800) (local.get $caller))
    (call $gs16 (i32.const 0x110802) (i32.const 0x000f))
    (call $gs16 (i32.const 0x110804) (local.get $flags))
    (call $gs16 (i32.const 0x110806) (i32.const 40))
    (call $gs16 (i32.const 0x110808) (i32.const 30))
    (call $gs16 (i32.const 0x11080a) (i32.const 2))
    (call $gs16 (i32.const 0x11080c) (i32.const 1))
    (call $gs16 (i32.const 0x11080e) (i32.const 0))
    (call $gs16 (i32.const 0x110810) (call $win16_h16 (local.get $h)))
    (call $win16_SetWindowPos))
  (func (export "test_move") (param $h i32) (param $repaint i32) (param $caller i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x110800))
    (call $gs16 (i32.const 0x110800) (local.get $caller))
    (call $gs16 (i32.const 0x110802) (i32.const 0x000f))
    (call $gs16 (i32.const 0x110804) (local.get $repaint))
    (call $gs16 (i32.const 0x110806) (i32.const 40))
    (call $gs16 (i32.const 0x110808) (i32.const 30))
    (call $gs16 (i32.const 0x11080a) (i32.const 2))
    (call $gs16 (i32.const 0x11080c) (i32.const 1))
    (call $gs16 (i32.const 0x11080e) (call $win16_h16 (local.get $h)))
    (call $win16_MoveWindow))
  (func (export "test_dirty") (param $h i32) (result i32)
    (call $update_get_rect (local.get $h) (i32.const 0)))
  (func (export "test_damage") (param $h i32) (param $erase i32)
    (call $update_invalidate_rect (local.get $h) (i32.const 3) (i32.const 4) (i32.const 12) (i32.const 15))
    (call $paint_flag_set (local.get $h))
    (if (local.get $erase) (then (call $nc_flags_set (local.get $h) (i32.const 2)))))
  (func (export "test_visible") (param $h i32) (param $visible i32)
    (drop (call $wnd_set_style (local.get $h) (select (i32.const 0x10000000) (i32.const 0) (local.get $visible)))))
  (func (export "test_clean") (param $h i32) (call $update_clear_hwnd (local.get $h)))
  (func (export "test_visible_bit") (param $h i32) (result i32)
    (i32.ne (i32.and (call $wnd_get_style (local.get $h)) (i32.const 0x10000000)) (i32.const 0)))
  (func (export "test_update") (param $h i32) (param $caller i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x110800))
    (call $gs16 (i32.const 0x110800) (local.get $caller))
    (call $gs16 (i32.const 0x110802) (i32.const 0xf))
    (call $gs16 (i32.const 0x110804) (call $win16_h16 (local.get $h)))
    (call $win16_UpdateWindow))
  (func (export "test_user_thunk") (param $ordinal i32) (result i32)
    (call $win16_thunk_for (i32.const 2) (local.get $ordinal) (i32.const 0)))
  (func (export "test_show") (param $h i32) (param $cmd i32) (param $caller i32)
    (call $post_queue_reset)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x110800))
    (call $gs16 (i32.const 0x110800) (local.get $caller))
    (call $gs16 (i32.const 0x110802) (i32.const 0xf))
    (call $gs16 (i32.const 0x110804) (local.get $cmd))
    (call $gs16 (i32.const 0x110806) (call $win16_h16 (local.get $h)))
    (call $win16_ShowWindow))
  (func (export "test_post_count") (result i32) (call $post_queue_total_count))
  (func (export "test_post_msg") (param $i i32) (result i32)
    (call $post_queue_peek_field (local.get $i) (i32.const 1)))
  (func (export "test_begin_core") (param $h i32) (result i32)
    (i32.store (global.get $reg_base) (i32.const 0x12345678))
    (i32.store offset=8 (global.get $reg_base) (i32.const 0x23456789))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x110800))
    (drop (call $begin_paint_core (local.get $h) (i32.const 0x110e00) (i32.const 1)))
    (i32.and
      (i32.eq (i32.load (global.get $reg_base)) (i32.const 0x12345678))
      (i32.and
        (i32.eq (i32.load offset=8 (global.get $reg_base)) (i32.const 0x23456789))
        (i32.eq (i32.load offset=16 (global.get $reg_base)) (i32.const 0x110800)))))
  (func (export "test_begin16") (param $h i32) (param $caller i32)
    (call $gs32 (global.get $GUEST_STACK) (i32.const 0x76543210))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x110800))
    (call $gs16 (i32.const 0x110800) (local.get $caller))
    (call $gs16 (i32.const 0x110802) (i32.const 0xf))
    (call $gs32 (i32.const 0x110804) (i32.const 0x00170e00))
    (call $gs16 (i32.const 0x110808) (call $win16_h16 (local.get $h)))
    (call $win16_BeginPaint))
  (func (export "test_bridge_scratch") (result i32) (call $gl32 (global.get $GUEST_STACK)))
  (func (export "test_background") (param $h i32) (param $brush i32)
    (call $wnd_set_bg_brush (local.get $h) (local.get $brush)))
  (func (export "test_expose_children") (param $h i32)
    (call $win16_rearm_visible_child_erases (local.get $h)))
  (func (export "test_erase_pending") (param $h i32) (result i32)
    (i32.and (call $nc_flags_test (local.get $h)) (i32.const 2)))
  (func (export "test_as_dialog") (param $h i32)
    (drop (call $dialog_proc_set (local.get $h) (call $wnd_table_get (local.get $h))))
    (call $wnd_table_set (local.get $h) (global.get $WNDPROC_DIALOG)))
  (func (export "test_post_reset") (call $post_queue_reset))
  (func (export "test_main_get") (result i32) (global.get $main_hwnd))
  (func (export "test_sound_ordinal") (param $pstr i32) (result i32)
    (call $win16_sound_ordinal (call $g2w (local.get $pstr))))
  (func (export "test_wait_sound") (param $state i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x110800))
    (call $gs16 (i32.const 0x110800) (i32.const 0x90))
    (call $gs16 (i32.const 0x110802) (i32.const 0xf))
    (call $gs16 (i32.const 0x110804) (local.get $state))
    (drop (call $win16_sound (i32.const 11))))
  (func (export "test_main_size") (param $h i32) (param $size i32)
    (global.set $main_hwnd (local.get $h))
    (global.set $pending_wm_size (local.get $size)))
  (func (export "test_alive") (param $h i32) (result i32)
    (i32.ge_s (call $wnd_table_find (local.get $h)) (i32.const 0)))
`;

// Pascal far wndproc, recording {message,wParam,lParam} into SS:0904.
// BP makes the layout explicit; preserve BX/BP across nested callbacks.
function recorder(extra = []) {
  return [0x55, 0x89, 0xe5, 0x53,
    0x36, 0x8b, 0x1e, 0x00, 0x09, 0xc1, 0xe3, 0x03,
    0x8b, 0x46, 0x0c, 0x36, 0x89, 0x87, 0x04, 0x09,
    0x8b, 0x46, 0x0a, 0x36, 0x89, 0x87, 0x06, 0x09,
    0x66, 0x8b, 0x46, 0x06, 0x36, 0x66, 0x89, 0x87, 0x08, 0x09,
    0x36, 0xff, 0x06, 0x00, 0x09,
    ...extra, 0x5b, 0x5d, 0x31, 0xc0, 0x31, 0xd2, 0xca, 0x0a, 0x00];
}
const word = n => [n & 255, (n >>> 8) & 255];
const pack = (x, y) => ((x & 0xffff) | (y << 16)) >>> 0;
(async () => {
  const mouseInput = [];
  let currentMouse = null;
  let desktopForeground = null;
  const desktopActivations = [];
  const rectangles = new Map(), moves = [], orders = [], systemCommands = [];
  const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none', extraHostOverrides: {
    foreground_window: () => desktopForeground === null ? e.test_active() : desktopForeground,
    activate_window: hwnd => { desktopActivations.push(hwnd); return 1; },
    check_input: () => {
      currentMouse = mouseInput.shift() || null;
      return currentMouse ? ((currentMouse.wp << 16) | currentMouse.msg) : 0;
    },
    check_input_hwnd: () => currentMouse ? currentMouse.hwnd : 0,
    check_input_lparam: () => currentMouse ? currentMouse.lp : 0,
    sys_command: (hwnd, command) => systemCommands.push([hwnd, command]),
    get_window_rect: (hwnd, out) => {
      // Deliberately distinct outer and client geometry, including negatives.
      for (const [i, n] of (rectangles.get(hwnd) || [-20, -30, 200, 300]).entries()) view.setInt32(out + i * 4, n, true);
    },
    move_window: (hwnd, x, y, w, h, flags) => {
      const old = rectangles.get(hwnd) || [-20, -30, 200, 300];
      const nx = flags & 2 ? old[0] : x, ny = flags & 2 ? old[1] : y;
      const nw = flags & 1 ? old[2] - old[0] : w, nh = flags & 1 ? old[3] - old[1] : h;
      rectangles.set(hwnd, [nx, ny, nx + nw, ny + nh]);
      moves.push({ hwnd, x, y, w, h, flags });
    },
    set_window_zorder: (hwnd, after) => orders.push([hwnd, after]),
    get_window_client_size: hwnd => {
      const r = rectangles.get(hwnd) || [-20, -30, 200, 300];
      return pack(r[2] - r[0], r[3] - r[1]);
    },
  }});
  const view = new DataView(memory.buffer);
  e.test_init();
  const writeCode = (offset, code) => code.forEach((b, i) => e.guest_write8(0x100000 + offset + i, b));
  writeCode(0x200, recorder());
  const hwnd = e.test_window(0x200);
  const pointer = 0x00170a00; // SS:0A00, not a flat address
  const flagsAt = 0x110a0c;
  // Poison WINDOWPOS's geometry: messages must describe committed client
  // geometry, not replay these outer-window request fields.
  for (let i = 0; i < 32; i += 4) e.guest_write32(0x110a00 + i, 0x33333333);
  const run = (target, flags, caller) => {
    e.guest_write32(flagsAt, 0xbeef0000 | flags);
    e.guest_write32(0x110900, 0);
    writeCode(caller, [0xeb, 0xfe]);
    e.test_call(target, pointer, caller);
    e.set_bp(0x100000 + caller);
    for (let i = 0; e.get_eip() !== 0x100000 + caller && i < 30; i++) e.run(100);
    e.set_bp(0);
    assert.strictEqual(e.get_eip(), 0x100000 + caller, 'returns to original far caller');
    assert.strictEqual(e.get_esp(), 0x11080e, 'all Pascal and continuation frames consumed');
    assert.strictEqual(e.test_result(), 0);
    assert.strictEqual(e.guest_read32(flagsAt) >>> 0, (0xbeef0000 | flags) >>> 0, 'input and adjacent guard unchanged');
    return Array.from({ length: e.guest_read32(0x110900) }, (_, i) => ({
      msg: e.guest_read32(0x110904 + i * 8) & 0xffff,
      wp: e.guest_read32(0x110904 + i * 8) >>> 16,
      lp: e.guest_read32(0x110908 + i * 8) >>> 0,
    }));
  };
  const move = { msg: 3, wp: 0, lp: pack(-17, -26) };
  const size = { msg: 5, wp: 0, lp: pack(113, 214) };
  assert.deepStrictEqual(run(hwnd, 0, 0x40), [move, size]);
  assert.deepStrictEqual(run(hwnd, 1, 0x50), [move], 'NOSIZE suppresses only size');
  assert.deepStrictEqual(run(hwnd, 2, 0x60), [size], 'NOMOVE suppresses only move');
  assert.deepStrictEqual(run(hwnd, 3, 0x70), [], 'both flags suppress both messages');

  const child = e.test_window(0x200);
  e.test_as_child(child, hwnd);
  assert.deepStrictEqual(run(child, 0, 0x90), [
    { msg: 3, wp: 0, lp: pack(10, 30) }, size,
  ], 'child move is relative to parent client origin');

  // On the outer WM_MOVE, call DefWindowProc for another window with NOMOVE.
  // Its callback must finish before the outer sequence resumes at WM_SIZE.
  const inner = e.test_window(0x200), narrow = e.test_narrow(inner), thunk = e.test_thunk();
  e.guest_write32(0x110b0c, 2);
  const nestedCall = [0x68, ...word(narrow), 0x68, 0x47, 0, 0x6a, 0,
    0x68, 0x17, 0, 0x68, 0x00, 0x0b, 0x9a, ...word(thunk), 0x1f, 0];
  writeCode(0x300, recorder([0x83, 0x7e, 0x0c, 3, 0x75, nestedCall.length, ...nestedCall]));
  const outer = e.test_window(0x300);
  assert.deepStrictEqual(run(outer, 0, 0x80), [move, size, size], 'nested callbacks retain independent flags and stages');

  const mutation = [0x8b, 0x5e, 0x06, // bx = WINDOWPOS offset in SS
    ...[[0, 0xdead], [2, 1], [4, -7], [6, -9], [8, 53], [10, 64], [12, 8]]
      .flatMap(([offset, value]) => [0x36, 0xc7, 0x47, offset, ...word(value)])];
  const mutateChanging = [0x83, 0x7e, 0x0c, 0x46, 0x75, mutation.length, ...mutation];
  const chain = [0xff, 0x76, 0x0e, 0xff, 0x76, 0x0c, 0xff, 0x76, 0x0a,
    0xff, 0x76, 0x08, 0xff, 0x76, 0x06, 0x9a, ...word(thunk), 0x1f, 0];
  const chainChanged = [0x83, 0x7e, 0x0c, 0x47, 0x75, chain.length, ...chain];
  writeCode(0x400, recorder(mutateChanging));
  writeCode(0x500, recorder([...mutateChanging, ...chainChanged]));
  const consuming = e.test_window(0x400), chaining = e.test_window(0x500);
  const runSet = (target, flags, caller, result = 1, isMove = false) => {
    e.guest_write32(0x110900, 0); moves.length = 0; orders.length = 0;
    writeCode(caller, [0xeb, 0xfe]);
    (isMove ? e.test_move : e.test_set)(target, flags, caller);
    if (isMove || !(flags & 0x400)) assert.deepStrictEqual(moves, [], 'changing runs before any geometry is committed');
    e.set_bp(0x100000 + caller);
    for (let i = 0; e.get_eip() !== 0x100000 + caller && i < 30; i++) e.run(100);
    e.set_bp(0);
    assert.strictEqual(e.get_eip(), 0x100000 + caller);
    assert.strictEqual(e.get_esp(), isMove ? 0x110810 : 0x110812, 'positioning continuation and Pascal frame restored');
    assert.strictEqual(e.test_result(), result);
    return Array.from({ length: e.guest_read32(0x110900) }, (_, i) => e.guest_read32(0x110904 + i * 8) & 0xffff);
  };
  assert.deepStrictEqual(runSet(consuming, 0x14, 0xa0), [0x46, 0x47], 'consuming changed gets no synthetic move/size');
  assert.deepStrictEqual(moves, [{ hwnd: consuming, x: -7, y: -9, w: 53, h: 64, flags: 0x18 }]);
  assert.deepStrictEqual(orders, [[consuming, 1]], 'far changing callback can replace insertion target');
  const beforePointer = e.guest_read32(0x110908) >>> 0, afterPointer = e.guest_read32(0x110910) >>> 0;
  assert.strictEqual(beforePointer, afterPointer, 'both notifications share the invocation-owned WINDOWPOS');
  assert.strictEqual(beforePointer >>> 16, 0x17, 'WINDOWPOS is a far pointer in the task stack segment');
  const wp = 0x110000 + (afterPointer & 0xffff);
  assert.strictEqual(e.guest_read32(wp) & 0xffff, e.test_narrow(consuming), 'callback cannot replace the target HWND');
  assert.strictEqual(e.guest_read32(wp + 12) & 0xffff, 0x18, 'changed sees committed flags');
  assert.deepStrictEqual(runSet(chaining, 0x14, 0xb0), [0x46, 0x47, 3, 5], 'default processing alone derives geometry messages');
  assert.deepStrictEqual(runSet(chaining, 0x418, 0xc0), [0x47, 3, 5], 'NOSENDCHANGING skips only changing');
  assert.deepStrictEqual(moves, [{ hwnd: chaining, x: 1, y: 2, w: 30, h: 40, flags: 0x418 }]);
  assert.deepStrictEqual(runSet(chaining, 0x418, 0xd0), [0x47], 'unchanged geometry suppresses derived move/size');

  const setThunk = e.test_set_thunk();
  const nestedSet = [e.test_narrow(consuming), 0, 5, 6, 7, 8, 0x14]
    .flatMap(value => [0x68, ...word(value)]);
  nestedSet.push(0x9a, ...word(setThunk), 0x1f, 0);
  writeCode(0x600, recorder([...mutateChanging,
    0x83, 0x7e, 0x0c, 0x46, 0x75, nestedSet.length, ...nestedSet]));
  const nestedOuter = e.test_window(0x600);
  assert.deepStrictEqual(runSet(nestedOuter, 0x14, 0xe0), [0x46, 0x46, 0x47, 0x47],
    'nested SetWindowPos completes before the outer changing callback returns');
  assert.deepStrictEqual(moves.map(({ hwnd, x, y, w, h }) => [hwnd, x, y, w, h]),
    [[consuming, -7, -9, 53, 64], [nestedOuter, -7, -9, 53, 64]], 'nested WINDOWPOS cannot overwrite outer mutations');
  const pointers = Array.from({ length: 4 }, (_, i) => e.guest_read32(0x110908 + i * 8) >>> 0);
  assert.strictEqual(pointers[0], pointers[3]);
  assert.strictEqual(pointers[1], pointers[2]);
  assert.notStrictEqual(pointers[0], pointers[1], 'nested transactions own distinct far structures');
  const destroyThunk = e.test_destroy_thunk();
  const destroy = [0xff, 0x76, 0x0e, 0x9a, ...word(destroyThunk), 0x1f, 0];
  writeCode(0x700, recorder([0x83, 0x7e, 0x0c, 0x46, 0x75, destroy.length, ...destroy]));
  const doomed = e.test_window(0x700);
  const destroyedMessages = runSet(doomed, 0x14, 0xf0, 0);
  assert.strictEqual(destroyedMessages[0], 0x46);
  assert(!destroyedMessages.includes(0x47), 'destroying the target during changing cancels changed');
  assert.deepStrictEqual(moves, [], 'destroyed target is never moved');
  assert.deepStrictEqual(orders, [], 'destroyed target is never reordered');
  const moveConsuming = e.test_window(0x400), moveChaining = e.test_window(0x500);
  assert.deepStrictEqual(runSet(moveConsuming, 1, 0x100, 1, true), [0x46, 0x47], 'MoveWindow allows consuming CHANGED');
  assert.deepStrictEqual(moves, [{ hwnd: moveConsuming, x: -7, y: -9, w: 53, h: 64, flags: 0x18 }]);
  assert.deepStrictEqual(orders, [[moveConsuming, 1]], 'MoveWindow honors callback-enabled Z-order');
  assert.deepStrictEqual(runSet(moveChaining, 1, 0x110, 1, true), [0x46, 0x47, 3, 5]);
  const mixedOuter = e.test_window(0x600);
  assert.deepStrictEqual(runSet(mixedOuter, 1, 0x170, 1, true), [0x46, 0x46, 0x47, 0x47],
    'MoveWindow retains its own mode across a nested SetWindowPos');
  assert.deepStrictEqual(moves.map(move => move.hwnd), [consuming, mixedOuter]);
  writeCode(0x800, recorder(chainChanged));
  const noRepaint = e.test_window(0x800), repaint = e.test_window(0x800);
  assert.deepStrictEqual(runSet(noRepaint, 0, 0x120, 1, true), [0x46, 0x47, 3, 5]);
  assert.strictEqual(moves[0].flags, 0x1c, 'MoveWindow(FALSE) begins with NOREDRAW');
  assert.strictEqual(e.test_dirty(noRepaint), 0, 'NOREDRAW creates no update region');
  assert.deepStrictEqual(runSet(repaint, 1, 0x130, 1, true), [0x46, 0x47, 3, 5, 0x0f],
    'MoveWindow(TRUE) sends paint after geometry, without erasing before BeginPaint');
  assert.strictEqual(moves[0].flags, 0x14, 'MoveWindow(TRUE) enables repaint');
  assert.strictEqual(e.test_dirty(repaint), 1, 'a wndproc that never calls BeginPaint does not validate damage');
  const moveDoomed = e.test_window(0x700);
  assert(!runSet(moveDoomed, 1, 0x140, 0, true).includes(0x47));
  assert.deepStrictEqual(moves, [], 'destroyed MoveWindow target is not committed');
  for (const [i, target] of [0, 0x76543210].entries()) {
    assert.deepStrictEqual(runSet(target, 1, 0x150 + i * 16, 0, true), []);
    assert.deepStrictEqual(moves, [], 'native bridge preserves invalid MoveWindow failure');
  }
  const runUpdate = (target, caller) => {
    e.guest_write32(0x110900, 0);
    writeCode(caller, [0xeb, 0xfe]);
    e.test_update(target, caller);
    e.set_bp(0x100000 + caller);
    for (let i = 0; e.get_eip() !== 0x100000 + caller && i < 30; i++) e.run(100);
    e.set_bp(0);
    assert.strictEqual(e.get_eip(), 0x100000 + caller);
    assert.strictEqual(e.get_esp(), 0x110806, 'UpdateWindow consumes only its own Pascal and continuation frames');
    return Array.from({ length: e.guest_read32(0x110900) }, (_, i) => e.guest_read32(0x110904 + i * 8) & 0xffff);
  };
  const clean = e.test_window(0x200);
  assert.deepStrictEqual(runUpdate(clean, 0x180), [], 'clean UpdateWindow does not send paint');
  assert.strictEqual(e.test_dirty(clean), 0, 'clean UpdateWindow must not invent damage');
  const begin = e.test_user_thunk(39), end = e.test_user_thunk(40), update = e.test_user_thunk(124);
  const paintCall = thunk => [0xff, 0x76, 0x0e, 0x16, 0x8d, 0x46, 0xde, 0x50,
    0x9a, ...word(thunk), 0x1f, 0];
  const paintBody = nested => [0x83, 0xec, 32, ...paintCall(begin), 0x36, 0xa3, 0x08, 0x0d,
    ...[0, 1, 2, 3].flatMap(i => [0x8b, 0x46, 0xe2 + i * 2, 0x36, 0xa3, ...word(0xd00 + i * 2)]),
    ...nested, ...paintCall(end), 0x83, 0xc4, 32];
  const paintProc = nested => {
    const body = paintBody(nested);
    return recorder([0x83, 0x7e, 0x0c, 0x0f, 0x75, body.length, ...body]);
  };
  writeCode(0x900, paintProc([]));
  const painter = e.test_window(0x900);
  e.test_damage(painter, 0);
  assert.deepStrictEqual(runUpdate(painter, 0x190), [0x0f], 'dirty UpdateWindow completes real BeginPaint/EndPaint before return');
  assert.strictEqual(e.test_dirty(painter), 0);
  assert.deepStrictEqual([0, 1, 2, 3].map(i => (e.guest_read32(0x110d00 + i * 2) & 0xffff)), [3, 4, 12, 15],
    'BeginPaint sees the original partial region, not an expanded client');
  assert.deepStrictEqual(runUpdate(painter, 0x1a0), [], 'completed paint is not delivered again');
  e.test_damage(painter, 1);
  assert.deepStrictEqual(runUpdate(painter, 0x1b0), [0x0f, 0x14], 'pending erase is sent from BeginPaint inside paint');
  assert.strictEqual(e.guest_read32(0x11090c) >>> 16, e.guest_read32(0x110d08) & 0xffff,
    'WM_ERASEBKGND receives the actual returned, narrowed paint DC');
  const innerPaint = e.test_window(0x900);
  const nestedUpdate = [0x68, ...word(e.test_narrow(innerPaint)), 0x9a, ...word(update), 0x1f, 0,
    0x36, 0xff, 0x06, 0x10, 0x0d];
  writeCode(0xa00, paintProc(nestedUpdate));
  const outerPaint = e.test_window(0xa00);
  e.test_damage(innerPaint, 0); e.test_damage(outerPaint, 0);
  e.guest_write32(0x110d10, 0);
  assert.deepStrictEqual(runUpdate(outerPaint, 0x1c0), [0x0f, 0x0f]);
  assert.strictEqual(e.guest_read32(0x110d10), 1, 'outer WM_PAINT resumes after inner UpdateWindow completes');
  assert.strictEqual(e.test_dirty(innerPaint), 0);
  assert.strictEqual(e.test_dirty(outerPaint), 0);
  const movingPainter = e.test_window(0x900);
  assert.deepStrictEqual(runSet(movingPainter, 1, 0x1d0, 1, true), [0x46, 0x47, 0x0f, 0x14]);
  assert.strictEqual(e.test_dirty(movingPainter), 0, 'MoveWindow(TRUE) waits for BeginPaint/EndPaint validation');
  const hidden = e.test_window(0x900);
  e.test_visible(hidden, 0); e.test_damage(hidden, 0);
  assert.deepStrictEqual(runUpdate(hidden, 0x1e0), [], 'hidden window does not paint');
  assert.strictEqual(e.test_dirty(hidden), 1, 'hidden update retains its damage');
  e.test_visible(hidden, 1);
  assert.deepStrictEqual(runUpdate(hidden, 0x1f0), [0x0f]);
  assert.deepStrictEqual([0, 1, 2, 3].map(i => e.guest_read32(0x110d00 + i * 2) & 0xffff), [3, 4, 12, 15]);
  writeCode(0xb00, recorder([0x83, 0x7e, 0x0c, 0x14, 0x75, destroy.length, ...destroy,
    0x83, 0x7e, 0x0c, 0x0f, 0x75, paintBody([]).length, ...paintBody([])]));
  const eraseDoomed = e.test_window(0xb00);
  e.test_damage(eraseDoomed, 1);
  assert.deepStrictEqual(runUpdate(eraseDoomed, 0x30), [0x0f, 0x14, 0x02, 0x82],
    'destruction from the BeginPaint erase callback sends WM_DESTROY/WM_NCDESTROY and returns through both nested frames');
  assert.strictEqual(e.test_alive(eraseDoomed), 0);
  assert.strictEqual(e.test_erase_pending(eraseDoomed), 0, 'declined erase cannot rearm a destroyed window');
  const runShow = (target, cmd, caller, includeActivation = false) => {
    const wasVisible = e.test_visible_bit(target);
    e.guest_write32(0x110900, 0);
    writeCode(caller, [0xeb, 0xfe]);
    e.test_show(target, cmd, caller);
    e.set_bp(0x100000 + caller);
    for (let i = 0; e.get_eip() !== 0x100000 + caller && i < 30; i++) e.run(100);
    e.set_bp(0);
    assert.strictEqual(e.get_eip(), 0x100000 + caller);
    assert.strictEqual(e.get_esp(), 0x110808, 'ShowWindow restores its Pascal and nested callback frames');
    assert.strictEqual(Number((e.test_result() & 0xffff) !== 0), wasVisible,
      'ShowWindow returns pre-call visibility, not success or a callback result');
    assert(!Array.from({length: e.test_post_count()}, (_, i) => e.test_post_msg(i)).includes(0x14),
      'ShowWindow must not leave a posted erase to overwrite later UpdateWindow painting');
    const messages = Array.from({length: e.guest_read32(0x110900)}, (_, i) => e.guest_read32(0x110904 + i * 8) & 0xffff);
    // The original cases below assert paint ordering; the activation matrix
    // checks the complete notification stream separately.
    return includeActivation ? messages : messages.filter(m => ![6, 7, 8].includes(m));
  };
  const showing = e.test_window(0x900);
  e.test_visible(showing, 0);
  assert.deepStrictEqual(runShow(showing, 1, 0x40), [0x14], 'initial erase completes before ShowWindow returns');
  assert.strictEqual(e.test_erase_pending(showing), 2, 'ShowWindow retains a declined erase for BeginPaint');
  assert.deepStrictEqual(runUpdate(showing, 0x50), [0x0f, 0x14]);
  assert.strictEqual(e.test_dirty(showing), 0);
  assert.deepStrictEqual(runShow(showing, 1, 0x60), [], 'showing an already visible window does not repeat initial erase');
  runShow(showing, 0, 0x60);
  assert.strictEqual(e.test_visible_bit(showing), 0, 'hide clears WS_VISIBLE');
  runShow(showing, 0, 0x60); // Already hidden must return FALSE too.
  // Hiding a child exposes what it covered: Civilization II hides its city
  // screen on Exit, and the parent must get that rectangle back as damage.
  const coverParent = e.test_window(0x900);
  const cover = e.test_window(0x900);
  e.test_as_child(cover, coverParent);
  e.test_clean(coverParent);
  e.test_clean(cover);
  runShow(cover, 0, 0x60);
  assert.strictEqual(e.test_visible_bit(cover), 0, 'hide clears the child\'s WS_VISIBLE');
  assert.notStrictEqual(e.test_dirty(coverParent), 0, 'hiding a child invalidates the parent beneath it');
  assert.strictEqual(e.test_dirty(cover), 0, 'the hidden child keeps no update region');
  runShow(showing, 8, 0x60);
  assert.strictEqual(e.test_visible_bit(showing), 1, 'nonactivating show sets WS_VISIBLE');
  const updateSelf = [0xff, 0x76, 0x0e, 0x9a, ...word(update), 0x1f, 0];
  const handledShow = recorder([0x83, 0x7e, 0x0c, 5, 0x75, updateSelf.length, ...updateSelf,
    0x83, 0x7e, 0x0c, 0x0f, 0x75, paintBody([]).length, ...paintBody([])]);
  handledShow.splice(-7, 2, 0xb8, 1, 0); // return AX=1, DX=0: erase handled
  writeCode(0xc00, handledShow);
  const showNested = e.test_window(0xc00);
  e.test_visible(showNested, 0);
  assert.deepStrictEqual(runShow(showNested, 3, 0x70), [5, 0x0f, 0x14],
    'UpdateWindow inside maximize consumes initial erase; ShowWindow must not erase again afterward');
  assert.strictEqual(e.test_dirty(showNested), 0);
  const corePaint = e.test_window(0x900);
  e.test_damage(corePaint, 0);
  assert.strictEqual(e.test_begin_core(corePaint), 1, 'paint core must not change EAX, EDX or ESP');
  assert.deepStrictEqual([0, 1, 2, 3].map(i => e.guest_read32(0x110e08 + 4 * i)), [3, 4, 12, 15]);
  const directPaint = e.test_window(0x900);
  e.test_damage(directPaint, 0);
  e.guest_write32(0x110dfe, 0xabcdef01);
  e.guest_write32(0x110e20, 0x13579bdf);
  e.test_begin16(directPaint, 0x80);
  assert.strictEqual(e.get_eip(), 0x100080);
  assert.strictEqual(e.get_esp(), 0x11080a, 'BeginPaint consumes exactly six Pascal argument bytes');
  assert.strictEqual(e.test_bridge_scratch(), 0x76543210, 'Win16 BeginPaint must not overwrite shared bridge scratch');
  assert.strictEqual(e.guest_read32(0x110dfe) & 0xffff, 0xef01);
  assert.strictEqual(e.guest_read32(0x110e20), 0x13579bdf);
  assert.deepStrictEqual([0, 1, 2, 3].map(i => e.guest_read32(0x110e04 + 2 * i) & 0xffff), [3, 4, 12, 15]);
  assert.strictEqual(e.test_result() & 0xffff, e.guest_read32(0x110e00) & 0xffff, 'returned HDC matches narrowed PAINTSTRUCT');

  // Real far callback results use DX:AX. The high-word-only case catches a
  // BOOL-in-AX shortcut; NULL brush alone must not imply fErase=TRUE.
  let ordinal = 0;
  const finishBegin = () => {
    e.set_bp(0x100090);
    for (let i = 0; e.get_eip() !== 0x100090 && i < 30; i++) e.run(100);
    e.set_bp(0);
    assert.strictEqual(e.get_eip(), 0x100090);
    assert.strictEqual(e.get_esp(), 0x11080a);
  };
  writeCode(0x90, [0xeb, 0xfe]);
  for (const handled of [0, 7, 0x10000]) for (const brush of [0, 16]) for (const erase of [0, 1]) {
    const off = 0x2000 + ordinal++ * 128;
    const body = recorder();
    body.splice(-7, 4, 0xb8, ...word(handled), 0xba, ...word(handled >>> 16));
    writeCode(off, body);
    const h = e.test_window(off);
    e.test_background(h, brush);
    e.test_damage(h, erase);
    e.guest_write32(0x110900, 0);
    e.test_begin16(h, 0x90);
    finishBegin();
    assert.strictEqual(e.guest_read32(0x110900), erase, 'only pending erase calls the far wndproc');
    const dc = e.guest_read32(0x110e00) & 0xffff;
    assert(dc);
    assert.strictEqual(e.test_result(), dc);
    if (erase) {
      assert.strictEqual(e.guest_read32(0x110904) & 0xffff, 0x14);
      assert.strictEqual(e.guest_read32(0x110904) >>> 16, dc);
    }
    assert.strictEqual(e.guest_read32(0x110e02) & 0xffff, +(erase && !handled),
      `Win16 fErase: erase=${erase}, brush=${brush}, DX:AX=${handled}`);
    assert.strictEqual(e.test_erase_pending(h), erase && !handled ? 2 : 0);
    assert.strictEqual(e.test_bridge_scratch(), 0x76543210, 'far callback does not borrow global bridge scratch');
    assert.deepStrictEqual([0, 1, 2, 3].map(i => e.guest_read32(0x110e04 + i * 2) & 0xffff), [3, 4, 12, 15]);
  }
  // A dialog's table procedure is the WNDPROC_DIALOG marker; its DLGPROC lives
  // beside it. BeginPaint must offer WM_ERASEBKGND to that DLGPROC before it
  // returns, and on FALSE do DefDlgProc's erase itself. Sending through the
  // marker only queued the erase: Klotski's selector got it after EndPaint and
  // the modal pump painted the background over the thumbnails.
  for (const handled of [0, 7]) {
    const off = 0x2000 + ordinal++ * 128;
    const body = recorder();
    body.splice(-7, 4, 0xb8, ...word(handled), 0x31, 0xd2);
    writeCode(off, body);
    const dlg = e.test_window(off);
    e.test_as_dialog(dlg);
    e.test_background(dlg, 16);
    e.test_damage(dlg, 1);
    e.test_post_reset();
    e.guest_write32(0x110900, 0);
    e.test_begin16(dlg, 0x90);
    finishBegin();
    assert.strictEqual(e.guest_read32(0x110900), 1, `the DLGPROC gets WM_ERASEBKGND inside BeginPaint (returns ${handled})`);
    const dc = e.guest_read32(0x110e00) & 0xffff;
    assert.strictEqual(e.guest_read32(0x110904) & 0xffff, 0x14);
    assert.strictEqual(e.guest_read32(0x110904) >>> 16, dc, 'with the paint DC');
    assert(!Array.from({ length: e.test_post_count() }, (_, i) => e.test_post_msg(i)).includes(0x14),
      'no WM_ERASEBKGND is left queued behind the paint');
    assert.strictEqual(e.guest_read32(0x110e02) & 0xffff, 0, 'DefDlgProc erased: fErase is FALSE either way');
    assert.strictEqual(e.test_erase_pending(dlg), 0, 'and no erase stays pending');
  }
  // The main window's first WM_SIZE is sent from inside ShowWindow, before
  // the erase, as SIZE_RESTORED. Tut's Tomb keeps its client size only from
  // WM_SIZE and lays out the pyramid in the UpdateWindow right after
  // ShowWindow; a queued size arrived after that and the board sat at x=-35.
  {
    const savedMain = e.test_main_get();
    const main = e.test_window(0x900);
    e.test_visible(main, 0);
    e.test_main_size(main, pack(610, 395));
    const shown = runShow(main, 1, 0x40);
    assert.deepStrictEqual(shown, [5, 0x14], 'WM_SIZE then the initial erase, both before ShowWindow returns');
    const sizeAt = Array.from({ length: e.guest_read32(0x110900) }, (_, i) => i)
      .find(i => (e.guest_read32(0x110904 + i * 8) & 0xffff) === 5);
    assert.strictEqual(e.guest_read32(0x110904 + sizeAt * 8) >>> 16, 0, 'SIZE_RESTORED');
    assert.strictEqual(e.guest_read32(0x110908 + sizeAt * 8) >>> 0, pack(610, 395), 'with the create-time client size');
    const posted = Array.from({ length: e.test_post_count() }, (_, i) => e.test_post_msg(i));
    assert(!posted.includes(5), `no WM_SIZE is left queued (${posted})`);
    e.test_main_size(savedMain, 0);
  }
  // SOUND by name: Visual Basic's Declare is GetProcAddress by name, and a
  // miss is "Sub or Function not defined" (TicTacDrop, on every drop).
  {
    const pstr = (s, at) => { e.guest_write8(at, s.length); [...s].forEach((c, i) => e.guest_write8(at + 1 + i, c.charCodeAt(0))); return at; };
    const names = ['OPENSOUND', 'CLOSESOUND', 'SETVOICEQUEUESIZE', 'SETVOICENOTE', 'SETVOICEACCENT',
      'SETVOICEENVELOPE', 'SETSOUNDNOISE', 'SETVOICESOUND', 'STARTSOUND', 'STOPSOUND', 'WAITSOUNDSTATE',
      'SYNCALLVOICES', 'COUNTVOICENOTES', 'GETTHRESHOLDEVENT', 'GETTHRESHOLDSTATUS', 'SETVOICETHRESHOLD', 'DOBEEP'];
    names.forEach((n, i) => assert.strictEqual(e.test_sound_ordinal(pstr(n, 0x110c00)), i + 1, `SOUND.${n}`));
    for (const miss of ['OPENSOUN', 'OPENSOUNDX', 'SETVOICE', 'BEEP'])
      assert.strictEqual(e.test_sound_ordinal(pstr(miss, 0x110c00)), 0, `${miss} is not a SOUND export`);
    // Nothing is ever queued, so every wait state is already reached.
    for (const [state, ax] of [[0, 0], [1, 0], [2, 0], [3, 0xfff0]]) {
      e.test_wait_sound(state);
      assert.strictEqual(e.test_result() & 0xffff, ax, `WaitSoundState(${state})`);
      assert.strictEqual(e.get_esp(), 0x110806, 'WaitSoundState pops its one word');
    }
  }
  const successProc = extra => {
    const body = recorder(extra);
    body.splice(-7, 4, 0xb8, 7, 0, 0x31, 0xd2);
    return body;
  };
  // Same-window recursion sees the in-flight erase consumed, not a second
  // callback. Both paint structures and the far return survive nesting.
  writeCode(0x3000, successProc(paintBody([])));
  const recursivePaint = e.test_window(0x3000);
  e.test_damage(recursivePaint, 1);
  e.guest_write32(0x110900, 0);
  e.test_begin16(recursivePaint, 0x90);
  finishBegin();
  assert.strictEqual(e.guest_read32(0x110900), 1);
  assert.strictEqual(e.guest_read32(0x110e02) & 0xffff, 0);
  assert.deepStrictEqual([0, 1, 2, 3].map(i => e.guest_read32(0x110e04 + i * 2) & 0xffff), [3, 4, 12, 15]);

  // Different-window erasing does recurse: each callback receives its own DC
  // and the inner continuation must not overwrite the outer caller/result.
  writeCode(0x3100, successProc([]));
  const nestedErase = e.test_window(0x3100);
  const innerCall = thunk => [0x68, ...word(e.test_narrow(nestedErase)), 0x16,
    0x8d, 0x46, 0xde, 0x50, 0x9a, ...word(thunk), 0x1f, 0];
  writeCode(0x3200, successProc([0x83, 0xec, 32, ...innerCall(begin),
    0x36, 0xa3, 0x08, 0x0d, ...innerCall(end), 0x83, 0xc4, 32]));
  const outerErase = e.test_window(0x3200);
  e.test_damage(outerErase, 1); e.test_damage(nestedErase, 1);
  e.guest_write32(0x110900, 0);
  e.test_begin16(outerErase, 0x90);
  finishBegin();
  assert.strictEqual(e.guest_read32(0x110900), 2);
  assert.strictEqual(e.guest_read32(0x110904) >>> 16, e.guest_read32(0x110e00) & 0xffff);
  assert.strictEqual(e.guest_read32(0x11090c) >>> 16, e.guest_read32(0x110d08) & 0xffff);
  assert.notStrictEqual(e.guest_read32(0x110904) >>> 16, e.guest_read32(0x11090c) >>> 16);
  assert.strictEqual(e.guest_read32(0x110e02) & 0xffff, 0);
  for (const [i, handled] of [0, 7, 0x10000].entries()) {
    const off = 0x4000 + i * 128;
    const body = recorder();
    body.splice(-7, 4, 0xb8, ...word(handled), 0xba, ...word(handled >>> 16));
    writeCode(off, body);
    const h = e.test_window(off);
    e.test_visible(h, 0);
    assert.deepStrictEqual(runShow(h, 1, 0x90), [0x14]);
    assert.strictEqual(e.test_erase_pending(h), handled ? 0 : 2,
      `ShowWindow uses the complete DX:AX erase result ${handled}`);
    assert.deepStrictEqual(runShow(h, 1, 0x90), []);
    assert.strictEqual(e.test_erase_pending(h), handled ? 0 : 2,
      'showing an already visible window cannot discard a declined erase');
  }
  const invalidate = e.test_user_thunk(125);
  writeCode(0x4300, successProc([0xff, 0x76, 0x0e, 0x6a, 0, 0x6a, 0, 0x6a, 1,
    0x9a, ...word(invalidate), 0x1f, 0]));
  const renewShow = e.test_window(0x4300);
  e.test_visible(renewShow, 0);
  assert.deepStrictEqual(runShow(renewShow, 1, 0x90), [0x14]);
  assert.strictEqual(e.test_erase_pending(renewShow), 2, 'successful show erase preserves callback reinvalidation');

  const show = e.test_user_thunk(42);
  const innerShow = e.test_window(0x4000); // declines erase
  e.test_visible(innerShow, 0);
  const nestedShowBody = [0x68, ...word(e.test_narrow(innerShow)), 0x6a, 1,
    0x9a, ...word(show), 0x1f, 0, 0x36, 0xa3, 0x20, 0x0f];
  writeCode(0x4400, successProc([0x83, 0x7e, 0x0c, 0x14,
    0x75, nestedShowBody.length, ...nestedShowBody]));
  const outerShow = e.test_window(0x4400);
  e.test_visible(outerShow, 0);
  assert.deepStrictEqual(runShow(outerShow, 1, 0x90), [0x14, 0x14]);
  assert.strictEqual(e.guest_read32(0x110f20) & 0xffff, 0,
    'nested hidden ShowWindow independently returns FALSE');
  assert.strictEqual(e.test_erase_pending(innerShow), 2);
  assert.strictEqual(e.test_erase_pending(outerShow), 0, 'nested ShowWindow results remain invocation-owned');
  e.test_visible(outerShow, 0);
  assert.deepStrictEqual(runShow(outerShow, 1, 0x90), [0x14]);
  assert.strictEqual(e.guest_read32(0x110f20) & 0xffff, 1,
    'nested visible ShowWindow returns TRUE without replacing outer FALSE');

  const showDoomed = e.test_window(0xb00);
  e.test_visible(showDoomed, 0);
  assert.deepStrictEqual(runShow(showDoomed, 1, 0x90), [0x14, 0x02, 0x82]);
  assert.strictEqual(e.test_alive(showDoomed), 0);
  assert.strictEqual(e.test_erase_pending(showDoomed), 0, 'ShowWindow cannot rearm a destroyed HWND');

  // TriPeaks calls UpdateWindow on itself between BeginPaint and EndPaint.
  // Its old damage must already be gone or that call recursively enters the
  // same paint until the guest stack is exhausted.
  writeCode(0x4500, paintProc([0xff, 0x76, 0x0e, 0x9a, ...word(update), 0x1f, 0]));
  const updateDuringPaint = e.test_window(0x4500);
  e.test_damage(updateDuringPaint, 0);
  assert.deepStrictEqual(runUpdate(updateDuringPaint, 0x90), [0x0f]);
  assert.strictEqual(e.test_dirty(updateDuringPaint), 0);

  // Reinvalidate precisely the snapshot rectangle during painting. EndPaint
  // must not validate that newer request just because its coordinates match.
  writeCode(0x4600, paintProc([0xff, 0x76, 0x0e, 0x16, 0x68, 0x00, 0x0d,
    0x6a, 0, 0x9a, ...word(invalidate), 0x1f, 0]));
  const invalidateDuringPaint = e.test_window(0x4600);
  e.test_damage(invalidateDuringPaint, 0);
  assert.deepStrictEqual(runUpdate(invalidateDuringPaint, 0x90), [0x0f]);
  assert.strictEqual(e.test_dirty(invalidateDuringPaint), 1);
  const exposedParent = e.test_window(0x200);
  const exposedChild = e.test_window(0x4500);
  e.test_as_child(exposedChild, exposedParent);
  e.test_background(exposedChild, 6); // COLOR_WINDOW + 1 is not permission to bypass its wndproc
  e.test_expose_children(exposedParent);
  assert.strictEqual(e.test_erase_pending(exposedChild), 2,
    'exposure retains erasing for the guest callback even with a class brush');

  // Full activation stream: old/new handles are narrowed in Win16 lParam,
  // and focus notifications complete before ShowWindow returns.
  writeCode(0x5000, recorder([]));
  e.test_reset_activation();
  const activeA = e.test_window(0x5000), activeB = e.test_window(0x5000);
  desktopActivations.length = 0;
  assert.deepStrictEqual(runShow(activeA, 5, 0x90, true), [6, 7]);
  assert.deepStrictEqual(desktopActivations, [activeA], 'accepted show publishes foreground');
  assert.strictEqual(e.test_active(), activeA);
  assert.strictEqual(e.test_focus(), activeA);
  assert(e.test_rank(activeA) > e.test_rank(activeB), 'activation raises A above B');
  assert.deepStrictEqual(runShow(activeB, 5, 0x90, true), [6, 6, 8, 7]);
  assert.strictEqual(e.guest_read32(0x110908), e.test_narrow(activeB));
  assert.strictEqual(e.guest_read32(0x110910), e.test_narrow(activeA));
  assert.strictEqual(e.test_active(), activeB);
  assert.strictEqual(e.test_focus(), activeB);
  assert(e.test_rank(activeB) > e.test_rank(activeA), 'activation raises B above A');
  const aboveActive = e.test_window(0x5000);
  desktopActivations.length = 0;
  assert(e.test_rank(aboveActive) > e.test_rank(activeB));
  assert.deepStrictEqual(runShow(activeB, 5, 0x90, true), [],
    'reasserting activation does not resend activation/focus notifications');
  assert(e.test_rank(activeB) > e.test_rank(aboveActive), 'same active window is raised again');
  assert.deepStrictEqual(desktopActivations, [activeB], 'same-local-active show reasserts foreground');
  desktopActivations.length = 0;
  for (const mode of [4, 7, 8]) {
    runShow(activeA, mode, 0x90, true);
    assert.strictEqual(e.test_active(), activeB, `show mode ${mode} must not activate`);
    assert.strictEqual(e.test_focus(), activeB);
  }
  const childShow = e.test_window(0x5000);
  e.test_as_child(childShow, activeA);
  runShow(childShow, 5, 0x90, true);
  assert.strictEqual(e.test_active(), activeB, 'showing a child does not activate it');
  assert.deepStrictEqual(desktopActivations, [], 'nonactivating modes and children do not publish foreground');

  const nestedActive = e.test_window(0x5000);
  const activateNested = [0x68, ...word(e.test_narrow(nestedActive)), 0x6a, 5,
    0x9a, ...word(show), 0x1f, 0];
  const activateOnly = [0x83, 0x7e, 0x0a, 0, 0x74, activateNested.length, ...activateNested];
  writeCode(0x5100, recorder([0x83, 0x7e, 0x0c, 6, 0x75, activateOnly.length,
    ...activateOnly]));
  const superseded = e.test_window(0x5100);
  desktopActivations.length = 0;
  runShow(superseded, 5, 0x90, true);
  assert.deepStrictEqual(desktopActivations, [nestedActive], 'superseded outer show cannot steal foreground');
  assert.strictEqual(e.test_active(), nestedActive, 'nested activation wins');
  assert.strictEqual(e.test_focus(), nestedActive, 'outer activation cannot steal focus back');
  const getActive = e.test_user_thunk(60);
  const observeActive = [0x9a, ...word(getActive), 0x1f, 0, 0x36, 0xa3, 0x00, 0x0f];
  writeCode(0x5200, recorder([0x83, 0x7e, 0x0c, 5, 0x75, observeActive.length,
    ...observeActive]));
  const maximizeActive = e.test_window(0x5200);
  runShow(maximizeActive, 3, 0x90, true);
  assert.strictEqual(e.guest_read32(0x110f00) & 0xffff, e.test_narrow(maximizeActive),
    'GetActiveWindow inside SIZE_MAXIMIZED sees the activated window');
  const minimizedActive = e.test_window(0x5000);
  desktopActivations.length = 0;
  assert.deepStrictEqual(runShow(minimizedActive, 2, 0x90, true), [6, 6]);
  assert.strictEqual(e.guest_read32(0x110910), (0x10000 | e.test_narrow(maximizeActive)) >>> 0,
    'Win16 minimized flag is HIWORD(lParam), not wParam');
  const destroyOnActivate = destroy;
  writeCode(0x5300, recorder([0x83, 0x7e, 0x0c, 6, 0x75, destroyOnActivate.length,
    ...destroyOnActivate]));
  const destroyedActive = e.test_window(0x5300);
  runShow(destroyedActive, 5, 0x90, true);
  assert.deepStrictEqual(desktopActivations, [], 'minimized/destroyed show cannot publish foreground');
  assert.strictEqual(e.test_alive(destroyedActive), 0);
  assert.strictEqual(e.test_active(), 0, 'activation must not retain a retired HWND');
  const queryProc = (ax, dx = 0, body = []) => [
    ...recorder(body).slice(0, -9), 0x5b, 0x5d,
    0xb8, ...word(ax), 0xba, ...word(dx), 0xca, 0x0a, 0,
  ];
  const runSys = (target, command) => {
    e.guest_write32(0x110900, 0);
    writeCode(0x90, [0xeb, 0xfe]);
    e.test_sys(target, command, 0x90);
    e.set_bp(0x100090);
    for (let i = 0; e.get_eip() !== 0x100090 && i < 30; i++) e.run(100);
    e.set_bp(0);
    assert.strictEqual(e.get_eip(), 0x100090, 'query returns to far caller');
    assert.strictEqual(e.get_esp(), 0x11080e, 'query consumes only its Pascal/continuation frames');
    assert.strictEqual(e.test_result() & 0xffff, 0, 'DefWindowProc result is not query result');
    return Array.from({length: e.guest_read32(0x110900)}, (_, i) =>
      e.guest_read32(0x110904 + i * 8) & 0xffff);
  };
  const mouseChild = e.test_window(0x200);
  const runMouse = (target, top, lp) => {
    e.guest_write32(0x110900, 0);
    writeCode(0x90, [0xeb, 0xfe]);
    e.test_mouse(target, top, lp);
    e.set_bp(0x100090);
    for (let i = 0; e.get_eip() !== 0x100090 && i < 30; i++) e.run(100);
    e.set_bp(0);
    assert.strictEqual(e.get_eip(), 0x100090, 'mouse default returns to far caller');
    assert.strictEqual(e.get_esp(), 0x11080e, 'mouse default preserves Pascal stack');
    return e.test_long_result();
  };
  for (const hit of [1, 2, 3, 8, 9]) for (const msg of [0x201, 0x204, 0xa1]) {
    assert.strictEqual(runMouse(mouseChild, mouseChild, (msg << 16) | hit),
      hit === 2 && msg === 0x201 ? 3 : 1);
    assert.strictEqual(e.guest_read32(0x110900), 0, 'top-level default does not query itself');
  }
  for (const [idx, answer] of [0, 1, 2, 3, 4, 0x10000].entries()) {
    const off = 0x6000 + idx * 0x100;
    writeCode(off, queryProc(answer & 0xffff, answer >>> 16));
    const parent = e.test_window(off);
    e.test_as_child(mouseChild, parent);
    for (const hit of [1, 2]) {
      const lp = 0x02010000 | hit;
      assert.strictEqual(runMouse(mouseChild, parent, lp), answer || (hit === 2 ? 3 : 1));
      assert.strictEqual(e.guest_read32(0x110900), 1, 'one synchronous parent query');
      assert.strictEqual(e.guest_read32(0x110904) & 0xffff, 0x21);
      assert.strictEqual(e.guest_read32(0x110904) >>> 16, e.test_narrow(parent));
      assert.strictEqual(e.guest_read32(0x110908), lp);
    }
  }
  // A far parent chains to DefWindowProc, which asks its own far parent.
  // Two live continuation frames must retain the original top/lParam/result.
  writeCode(0x6700, [
    ...recorder().slice(0, -9),
    ...[14, 12, 10, 8, 6].flatMap(offset => [0xff, 0x76, offset]),
    0x9a, ...word(e.test_thunk()), 0x1f, 0,
    0x5b, 0x5d, 0xca, 0x0a, 0,
  ]);
  const forwardingParent = e.test_window(0x6700);
  const grandparent = e.test_window(0x6500); // returns DX:AX = 0001:0000
  e.test_as_child(forwardingParent, grandparent);
  e.test_as_child(mouseChild, forwardingParent);
  assert.strictEqual(runMouse(mouseChild, grandparent, 0x02010002), 0x10000);
  assert.strictEqual(e.guest_read32(0x110900), 2, 'nested far parent chain');
  for (const offset of [0x110904, 0x11090c]) {
    assert.strictEqual(e.guest_read32(offset), (e.test_narrow(grandparent) << 16) | 0x21);
    assert.strictEqual(e.guest_read32(offset + 4), 0x02010002);
  }
  writeCode(0x5400, queryProc(1));
  writeCode(0x5500, queryProc(0));
  writeCode(0x5800, queryProc(0, 1)); // WM_QUERYOPEN accepts a nonzero LONG.
  for (const command of [0xF120, 0xF030]) {
    for (const [allowed, proc] of [[true, 0x5400], [true, 0x5800], [false, 0x5500]]) {
      const target = e.test_window(proc);
      e.test_iconify(target);
      const beforeCommands = systemCommands.length;
      assert.deepStrictEqual(runSys(target, command), [0x13], 'query is synchronous, once');
      assert.strictEqual(systemCommands.length - beforeCommands, allowed ? 1 : 0,
        'only accepted query publishes a system command');
      assert.strictEqual(e.test_min(target), allowed ? 0 : 1);
      assert.strictEqual(e.test_max(target), allowed && command === 0xF030 ? 1 : 0);
      if (allowed) assert.deepStrictEqual(runSys(target, command), [], 'non-iconic command does not query');
    }
  }
  const nestedQuery = e.test_window(0x5500);
  e.test_iconify(nestedQuery);
  const nestedSys = [0x68, ...word(e.test_narrow(nestedQuery)), 0x68, ...word(0x112),
    0x68, ...word(0xF030), 0x6a, 0, 0x6a, 0, 0x9a, ...word(e.test_thunk()), 0x1f, 0];
  writeCode(0x5600, queryProc(1, 0, nestedSys));
  const outerQuery = e.test_window(0x5600);
  e.test_iconify(outerQuery);
  assert.deepStrictEqual(runSys(outerQuery, 0xF120), [0x13, 0x13]);
  assert.strictEqual(e.test_min(nestedQuery), 1, 'nested veto remains iconic');
  assert.strictEqual(e.test_min(outerQuery), 0, 'outer accepted restore keeps its own target/command');
  writeCode(0x5700, queryProc(1, 0, [0x83, 0x7e, 0x0c, 0x13, 0x75, destroy.length, ...destroy]));
  const retiredQuery = e.test_window(0x5700);
  e.test_iconify(retiredQuery);
  const beforeRetiredQuery = systemCommands.length;
  runSys(retiredQuery, 0xF120);
  assert.strictEqual(e.test_alive(retiredQuery), 0, 'query can retire target without stale commit');
  assert.strictEqual(systemCommands.length, beforeRetiredQuery, 'retired query emits no host commit');
  const runClick = target => {
    e.guest_write32(0x110900, 0);
    writeCode(0x90, [0xeb, 0xfe]);
    e.test_click_activate(target);
    e.set_bp(0x100090);
    for (let i = 0; e.get_eip() !== 0x100090 && i < 30; i++) e.run(100);
    e.set_bp(0);
    assert.strictEqual(e.get_eip(), 0x100090);
    assert.strictEqual(e.get_esp(), 0x11080e, 'reason frame popped exactly');
    assert.strictEqual(e.test_result() & 0xffff, 42, 'caller continuation result preserved');
    return Array.from({length: e.guest_read32(0x110900)}, (_, i) => ({
      msg: e.guest_read32(0x110904 + i * 8) & 0xffff,
      wp: e.guest_read32(0x110904 + i * 8) >>> 16,
      lp: e.guest_read32(0x110908 + i * 8),
    }));
  };
  const clickA = e.test_window(0x5000), clickB = e.test_window(0x5000);
  runShow(clickA, 5, 0x90, true);
  assert.deepStrictEqual(runClick(clickB), [
    {msg: 6, wp: 0, lp: e.test_narrow(clickB)},
    {msg: 6, wp: 2, lp: e.test_narrow(clickA)},
    {msg: 8, wp: e.test_narrow(clickB), lp: 0},
    {msg: 7, wp: e.test_narrow(clickA), lp: 0},
  ]);
  assert.deepStrictEqual(runClick(clickB), []);
  const nestedClickEvents = runClick(superseded);
  assert(nestedClickEvents.some(r => r.msg === 6 && r.wp === 2));
  assert(nestedClickEvents.some(r => r.msg === 6 && r.wp === 1),
    'nested ShowWindow retains API reason inside click activation');
  assert.strictEqual(e.test_active(), nestedActive);
  assert.strictEqual(e.test_focus(), nestedActive);
  for (const mode of [0, 1, 2, 3, 4]) {
    const off = 0x7000 + mode * 0x100;
    const old = e.test_window(off), target = e.test_window(0x5000), chosen = e.test_window(0x5000);
    const activate = h => [0x68, ...word(e.test_narrow(h)), 0x6a, 5,
      0x9a, ...word(show), 0x1f, 0];
    const action = [0x36, 0xc7, 0x06, 0x40, 0x0f, 0, 0,
      0x9a, ...word(getActive), 0x1f, 0, 0x36, 0xa3, 0x42, 0x0f,
      ...(mode && mode !== 4 ? activate(mode === 2 ? old : chosen) : []),
      ...(mode === 4 ? [0x68, ...word(e.test_narrow(target)),
        0x9a, ...word(e.test_destroy_thunk()), 0x1f, 0] : []),
      ...(mode === 3 ? activate(old) : [])];
    const onInactive = [0x83, 0x7e, 0x0a, 0, 0x75, action.length, ...action];
    const onActivate = [0x83, 0x7e, 0x0c, 6, 0x75, onInactive.length, ...onInactive];
    writeCode(off, recorder([0x36, 0x83, 0x3e, 0x40, 0x0f, 0,
      0x74, onActivate.length, ...onActivate]));
    e.guest_write32(0x110f40, 0);
    runShow(old, 5, 0x90, true);
    e.guest_write32(0x110f40, 1);
    runShow(target, 5, 0x90, true);
    assert.strictEqual(e.guest_read32(0x110f40) >>> 16, e.test_narrow(old),
      'far deactivation observes old active HWND');
    const expected = mode === 1 ? chosen : mode === 3 || mode === 4 ? old : target;
    assert.strictEqual(e.test_active(), expected, `far reentry mode ${mode}`);
    assert.strictEqual(e.test_focus(), expected);
  }
  const runFocus = target => {
    e.guest_write32(0x110900, 0);
    writeCode(0x90, [0xeb, 0xfe]);
    e.test_focus_api(target);
    e.set_bp(0x100090);
    for (let i = 0; e.get_eip() !== 0x100090 && i < 50; i++) e.run(100);
    e.set_bp(0);
    assert.strictEqual(e.get_eip(), 0x100090, 'focus returns to Pascal caller');
    assert.strictEqual(e.get_esp(), 0x110806, 'focus continuation and arguments popped');
    return e.test_result() & 0xffff;
  };
  const focusA = e.test_window(0x5000), focusB = e.test_window(0x5000);
  const focusChild = e.test_window(0x5000);
  e.test_as_child(focusChild, focusB);
  for (const target of [focusA, focusB, focusChild, 0]) {
    runShow(focusA, 5, 0x90, true);
    assert.strictEqual(runFocus(target), e.test_narrow(target && target !== focusA ? focusB : focusA));
    assert.strictEqual(e.test_focus(), target);
    assert.strictEqual(e.test_active(), target && target !== focusA ? focusB : focusA);
    const count = e.guest_read32(0x110900);
    assert.strictEqual(count, target === focusA ? 0 : target ? 6 : 1,
      'far notifications complete synchronously, including post-activation pair');
  }
  runShow(focusA, 5, 0x90, true);
  e.test_iconify(focusB);
  runFocus(focusA);
  assert.strictEqual(runFocus(focusB), 0);
  assert.strictEqual(e.test_focus(), focusA);
  assert.strictEqual(e.guest_read32(0x110900), 0);
  // Native reentry case 4, with both focus and activation suspended through
  // real far procedures rather than the Win32 synchronous sender.
  const chainC = e.test_window(0x5000);
  const selectC = [0x36, 0xc7, 0x06, 0x40, 0x0f, 0, 0,
    0x68, ...word(e.test_narrow(chainC)), 0x6a, 5, 0x9a, ...word(show), 0x1f, 0];
  const armedC = [0x36, 0x83, 0x3e, 0x40, 0x0f, 0, 0x74, selectC.length, ...selectC];
  const activeC = [0x83, 0x7e, 0x0a, 0, 0x74, armedC.length, ...armedC];
  const focusChain = [...activeC, ...[14, 12, 10, 8, 6].flatMap(offset => [0xff, 0x76, offset]),
    0x9a, ...word(e.test_thunk()), 0x1f, 0];
  writeCode(0x7800, recorder([0x83, 0x7e, 0x0c, 6, 0x75, focusChain.length, ...focusChain]));
  const chainB = e.test_window(0x7800);
  e.guest_write32(0x110f40, 0);
  runShow(focusA, 5, 0x90, true);
  runFocus(focusA);
  e.guest_write32(0x110f40, 1);
  runShow(chainB, 5, 0x90, true);
  assert.strictEqual(e.test_active(), chainB, 'far default reclaims activation');
  assert.strictEqual(e.test_focus(), chainB);
  const chainCount = e.guest_read32(0x110900);
  assert.strictEqual(e.guest_read32(0x110904 + (chainCount - 2) * 8), (e.test_narrow(chainB) << 16) | 8);
  assert.strictEqual(e.guest_read32(0x110904 + (chainCount - 1) * 8), (e.test_narrow(chainB) << 16) | 7);
  const setFocus = e.test_user_thunk(22), getFocus = e.test_user_thunk(23);
  for (const retire of [false, true]) {
    const off = retire ? 0x7a00 : 0x7900;
    const old = e.test_window(off), target = e.test_window(0x5000), chosen = e.test_window(0x5000);
    for (const h of [old, target, chosen]) e.test_as_child(h, focusA);
    const action = [0x36, 0xc7, 0x06, 0x40, 0x0f, 0, 0,
      0x9a, ...word(getFocus), 0x1f, 0, 0x36, 0xa3, 0x42, 0x0f,
      0x68, ...word(e.test_narrow(retire ? target : chosen)),
      0x9a, ...word(retire ? e.test_destroy_thunk() : setFocus), 0x1f, 0];
    const onKill = [0x83, 0x7e, 0x0c, 8, 0x75, action.length, ...action];
    writeCode(off, recorder([0x36, 0x83, 0x3e, 0x40, 0x0f, 0, 0x74, onKill.length, ...onKill]));
    e.guest_write32(0x110f40, 0);
    runShow(focusA, 5, 0x90, true);
    runFocus(old);
    e.guest_write32(0x110f40, 1);
    assert.strictEqual(runFocus(target), e.test_narrow(old));
    assert.strictEqual(e.guest_read32(0x110f40) >>> 16, e.test_narrow(target),
      'far KILLFOCUS observes published new focus');
    assert.strictEqual(e.test_focus(), retire ? 0 : chosen, 'nested focus/destruction wins');
    if (!retire) assert.strictEqual(e.guest_read32(0x110900), 3, 'no stale outer SETFOCUS');
  }
  e.test_mouse_clear_nc();
  const pumpMessages = () => Array.from({length: e.guest_read32(0x110900)}, (_, i) => ({
    msg: e.guest_read32(0x110904 + i * 8) & 0xffff,
    wp: e.guest_read32(0x110904 + i * 8) >>> 16,
    lp: e.guest_read32(0x110908 + i * 8) >>> 0,
  }));
  const runPump = (peek, remove, min = 0x201, max = 0x201) => {
    writeCode(0x90, [0xeb, 0xfe]);
    e.test_mouse_pump(peek, remove, min, max);
    e.set_bp(0x100090);
    for (let i = 0; e.get_eip() !== 0x100090 && i < 50; i++) e.run(100);
    e.set_bp(0);
    assert.strictEqual(e.get_eip(), 0x100090, 'mouse pump returns to original far caller');
    assert.strictEqual(e.get_esp(), peek ? 0x110810 : 0x11080e, 'far pump owns and retires its callback frames');
    return e.test_result() & 0xffff;
  };
  // Do not overwrite earlier decoded focus procedures: each case owns code.
  let mouseCode = 0x9000;
  for (const peek of [1, 0]) {
    for (const answer of [0, 1, 2, 3, 4, 0x10003]) {
      writeCode(mouseCode, queryProc(answer & 0xffff, answer >>> 16));
      const target = e.test_window(mouseCode);
      mouseCode += 0x100;
      runFocus(focusA);
      e.guest_write32(0x110900, 0);
      mouseInput.push({hwnd: target, msg: 0x201, wp: 1, lp: 0x0014000a});
      if (peek) for (let i = 0; i < 2; i++) {
        assert.strictEqual(runPump(1, 0), 1);
        assert.deepStrictEqual(pumpMessages(), [], 'far PM_NOREMOVE never calls the guest');
      }
      mouseInput.push({hwnd: target, msg: 0x202, wp: 0, lp: 0x0014000a});
      const eats = answer === 2 || answer === 4;
      const activates = answer !== 3 && answer !== 4;
      assert.strictEqual(runPump(peek, 1), peek && eats ? 0 : 1,
        `far peek=${peek} answer=${answer} msg=${e.guest_read32(0x110e00).toString(16)} events=${JSON.stringify(pumpMessages())}`);
      assert.strictEqual(e.test_active(), activates ? target : focusA,
        `peek=${peek} answer=${answer} msg=${e.guest_read32(0x110e00).toString(16)} callbacks=${JSON.stringify(pumpMessages())}`);
      const queries = pumpMessages().filter(m => m.msg === 0x21);
      assert.deepStrictEqual(queries, [{msg: 0x21, wp: e.test_narrow(target), lp: 0x02010001}],
        'far query carries narrowed top HWND and complete message/hit parameters exactly once');
      assert.strictEqual(pumpMessages().some(m => m.msg === 6 && m.wp === 2), activates);
      if (!peek && eats) assert.strictEqual(e.guest_read32(0x110e00) >>> 16, 0x202);
      else {
        if (!eats) assert.strictEqual(e.guest_read32(0x110e00) >>> 16, 0x201);
        assert.strictEqual(runPump(1, 1, 0x202, 0x202), 1, 'far eating down preserves up');
      }
      runFocus(focusA);
      e.guest_write32(0x110900, 0);
      e.post_message_q(target, 0x201, 1, 0x0014000a);
      assert.strictEqual(runPump(1, 1), 1);
      assert.deepStrictEqual(pumpMessages(), [], 'far posted click does not activate');
    }
  }
  for (const desktop of [0x76543210, 0]) for (const answer of [1, 2, 3, 4]) {
    const off = (desktop ? 0xd000 : 0xe000) + answer * 0x100;
    writeCode(off, queryProc(answer));
    const target = e.test_window(off);
    runFocus(target);
    desktopForeground = desktop;
    desktopActivations.length = 0;
    e.guest_write32(0x110900, 0);
    mouseInput.push({hwnd: target, msg: 0x201, wp: 1, lp: 0x0014000a});
    assert.strictEqual(runPump(1, 0), 1);
    assert.deepStrictEqual(pumpMessages(), [], 'background far PM_NOREMOVE does not query');
    assert.strictEqual(runPump(1, 1), answer === 2 || answer === 4 ? 0 : 1);
    assert.deepStrictEqual(pumpMessages(), [{msg: 0x21, wp: e.test_narrow(target), lp: 0x02010001}],
      'locally active far background frame receives query');
    assert.deepStrictEqual(desktopActivations, answer <= 2 ? [target] : [],
      'far query consent alone publishes desktop activation');
    assert.strictEqual(e.test_active(), target);
    desktopForeground = null;
    e.guest_write32(0x110900, 0);
    mouseInput.push({hwnd: target, msg: 0x201, wp: 1, lp: 0x0014000a});
    assert.strictEqual(runPump(1, 1), 1);
    assert.deepStrictEqual(pumpMessages(), [], 'aligned far foreground/local active state skips the query');
  }
  const peek16 = e.test_peek_thunk();
  // A native child (and a native intermediate parent) must query the far
  // ancestor before input removal decides whether to activate or eat.
  for (const answer of [0, 1, 2, 3, 4, 0x10003]) {
    const off = 0xc000 + (answer === 0x10003 ? 5 : answer) * 0x100;
    writeCode(off, queryProc(answer & 0xffff, answer >>> 16));
    const parent = e.test_window(off), middle = e.test_window(0x5000), child = e.test_window(0x5000);
    e.test_native_control(middle); e.test_native_control(child);
    e.test_as_child(middle, parent); e.test_as_child(child, middle);
    runFocus(focusA);
    e.guest_write32(0x110900, 0);
    mouseInput.push({hwnd: child, msg: 0x201, wp: 1, lp: 0x0014000a});
    assert.strictEqual(runPump(1, 1), answer === 2 || answer === 4 ? 0 : 1);
    assert.strictEqual(e.test_active(), answer === 3 || answer === 4 ? focusA : parent);
    assert.deepStrictEqual(pumpMessages().filter(m => m.msg === 0x21),
      [{msg: 0x21, wp: e.test_narrow(parent), lp: 0x02010001}],
      'native child chain forwards one complete synchronous query to far parent');
    assert.strictEqual(e.test_post_count(), 0, 'far query is never posted');
    e.guest_write32(0x110900, 0);
    e.test_mouse(child, parent, 0x02010001, 1);
    e.set_bp(0x100090);
    for (let i = 0; e.get_eip() !== 0x100090 && i < 50; i++) e.run(100);
    e.set_bp(0);
    assert.strictEqual(e.get_eip(), 0x100090);
    assert.strictEqual(e.get_esp(), 0x11080e, 'SendMessage far forwarding retires its own frames');
    assert.strictEqual(e.test_long_result(), answer || 1, 'explicit SendMessage retains complete parent result');
    assert.strictEqual(pumpMessages().filter(m => m.msg === 0x21).length, 1);
    assert.strictEqual(e.test_post_count(), 0);
  }
  const nestedPump = [0x68, ...word(0x17), 0x68, ...word(0x0e00), 0x6a, 0,
    0x68, ...word(0x400), 0x68, ...word(0x400), 0x6a, 1,
    0x9a, ...word(peek16), 0x1f, 0];
  writeCode(0xa000, queryProc(3, 0, [0x83, 0x7e, 0x0c, 0x21, 0x75, nestedPump.length, ...nestedPump]));
  const nestedMouse = e.test_window(0xa000);
  runFocus(focusA);
  e.guest_write32(0x110900, 0);
  e.post_message_q(nestedMouse, 0x400, 0xdead, 0xbeef);
  mouseInput.push({hwnd: nestedMouse, msg: 0x201, wp: 1, lp: 0x0014000a});
  assert.strictEqual(runPump(1, 0), 1);
  const outerMouseMsg = Array.from({length: 18}, (_, i) => e.guest_read32(0x110e00 + i) & 255);
  assert.strictEqual(runPump(1, 1), 1);
  const completed = Array.from({length: 18}, (_, i) => e.guest_read32(0x110e00 + i) & 255);
  assert.deepStrictEqual(completed.filter((_, i) => i < 10 || i > 13), outerMouseMsg.filter((_, i) => i < 10 || i > 13),
    'nested far PeekMessage into the same destination cannot replace the outer MSG');
  assert.strictEqual(runPump(1, 1, 0x400, 0x400), 0, 'nested far pump consumed the sentinel');

  // The modal route must query before it dispatches the removed click too.
  for (const answer of [1, 2, 3, 4]) {
    const off = 0xa100 + answer * 0x100;
    writeCode(off, queryProc(answer));
    const target = e.test_window(off);
    runFocus(focusA);
    e.guest_write32(0x110900, 0);
    mouseInput.push({hwnd: target, msg: 0x201, wp: 1, lp: 0x0014000a},
      {hwnd: target, msg: 0x202, wp: 0, lp: 0x0014000a});
    const parked = e.test_modal_mouse(target);
    // Stop at each modal continuation, before it drains unrelated queued
    // messages from earlier positioning cases in this long-lived fixture.
    for (let pass = 0; pass < 4; pass++) {
      e.set_bp(parked);
      for (let i = 0; e.get_eip() !== parked && i < 500; i++) e.run(1);
      e.set_bp(0);
      if (!mouseInput.length) break;
      e.test_modal_step();
    }
    assert.strictEqual(e.get_eip(), parked, 'modal continuation returns to its own pump');
    assert.strictEqual(e.get_esp(), 0x110800, 'modal frame remains after mouse callbacks retire');
    const messages = pumpMessages().map(m => m.msg);
    assert.strictEqual(messages.filter(m => m === 0x21).length, 1, 'modal click queried once');
    assert.strictEqual(messages.includes(0x201), answer !== 2 && answer !== 4, 'modal eat controls dispatch');
    assert(messages.includes(0x202), 'modal loop still dispatches button-up');
  }
  // Closing the dialog restores its actual owner synchronously, not the
  // unrelated main window. The focus callback may itself call SetFocus.
  const template = e.test_modal_template();
  const nestedEnd = [0xff, 0x76, 0x0e, 0x6a, 99,
    0x9a, ...word(e.test_user_thunk(88)), 0x1f, 0,
    0x8b, 0x46, 0x0e, 0x36, 0xa3, 0x46, 0x0f];
  writeCode(0xb800, recorder([0x81, 0x7e, 0x0c, 0x10, 1,
    0x75, nestedEnd.length, ...nestedEnd]));
  const modes = ['owner', 'redirect', 'surviving-focus', 'nested-dialog', 'activate-owner', 'main-fallback'];
  for (const [index, mode] of modes.entries()) {
    const off = 0xb000 + index * 0x100;
    const owner = e.test_window(off);
    const main = mode === 'main-fallback' ? owner : e.test_window(0x5000);
    const dlg = e.test_window(0x5000), child = e.test_window(0x5000);
    const chosen = e.test_window(0x5000);
    e.test_as_child(child, dlg);
    e.test_as_child(chosen, owner);
    const action = [0x9a, ...word(getFocus), 0x1f, 0, 0x36, 0xa3, 0x42, 0x0f,
      ...(mode === 'redirect' ? [0x68, ...word(e.test_narrow(chosen)),
        0x9a, ...word(setFocus), 0x1f, 0] : []),
      ...(mode === 'nested-dialog' ? [0x6a, 0, 0x68, ...word(template),
        0x68, ...word(e.test_narrow(owner)), 0x6a, 0x0f, 0x68, 0, 0xb8,
        0x9a, ...word(e.test_user_thunk(218)), 0x1f, 0,
        0x36, 0xa3, 0x44, 0x0f] : [])];
    writeCode(off, recorder([0x83, 0x7e, 0x0c, 7, 0x75, action.length, ...action]));
    e.guest_write32(0x110900, 0);
    e.guest_write32(0x110f40, 0);
    e.test_modal_finish(dlg, mode === 'main-fallback' ? 0 : owner, main,
      mode === 'surviving-focus' ? chosen : child, mode === 'activate-owner' ? dlg : owner);
    e.set_bp(0x100090);
    for (let i = 0; e.get_eip() !== 0x100090 && i < 50; i++) e.run(100);
    e.set_bp(0);
    assert.strictEqual(e.get_eip(), 0x100090, 'modal close returns to its far caller');
    assert.strictEqual(e.get_esp(), 0x110806, 'modal and focus continuation frames retired');
    assert.strictEqual(e.test_long_result(), 42, 'focus callbacks preserve outer result');
    assert.strictEqual(e.test_alive(dlg), 0, 'retiring dialog removed');
    assert.strictEqual(e.test_alive(child), 0, 'retiring focused child removed');
    assert.strictEqual(e.test_alive(owner), 1, 'owner remains live');
    assert.strictEqual(e.test_focus(), mode === 'redirect' || mode === 'surviving-focus' ? chosen : owner);
    assert.strictEqual(e.test_active(), owner, 'owner activation remains/restores correctly');
    assert.strictEqual(e.test_post_count(), 0, 'restoration is not a posted notification');
    if (mode !== 'surviving-focus') {
      assert.strictEqual(e.guest_read32(0x110f40) >>> 16, e.test_narrow(owner),
        'owner has focus before its real far WM_SETFOCUS callback');
      assert(pumpMessages().some(m => m.msg === 7));
    } else assert.deepStrictEqual(pumpMessages(), [], 'surviving guest focus is not replaced');
    if (mode === 'nested-dialog') {
      assert.strictEqual(e.guest_read32(0x110f44) & 0xffff, 99,
        'actual nested DialogBoxIndirect/EndDialog returns its own result');
      const nested = e.guest_read32(0x110f44) >>> 16;
      assert(nested, 'nested WM_INITDIALOG ran');
      assert.strictEqual(e.test_alive(e.test_widen(nested)), 0, 'nested dialog also retired');
    }
  }
  console.log('PASS Win16 WINDOWPOS/focus, task/modal mouse and modal completion callbacks');
})().catch(error => { console.error(error); process.exit(1); });
