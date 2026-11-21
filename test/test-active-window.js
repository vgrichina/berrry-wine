#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const apiTable = require('../src/api_table.json');
const { bootRenderHarness } = require('./render-helper');
const { createWindowHost } = require('../lib/host-window');

const ROOT = path.join(__dirname, '..');
const CAPACITY = 64;
const COUNT = 0;
const HNDS = 4;
const MSGS = HNDS + CAPACITY * 4;
const WPARAMS = MSGS + CAPACITY * 4;
const LPARAMS = WPARAMS + CAPACITY * 4;
const RECORD_BYTES = LPARAMS + CAPACITY * 4;

const u32 = value => [value, value >>> 8, value >>> 16, value >>> 24]
  .map(byte => byte & 0xff);

let defaultActivateThunk;
function makeWndProc(observed, callback = [], defaultActivation = true) {
  const out = [];
  const emit = (...bytes) => out.push(...bytes.map(byte => byte & 0xff));
  const storeIndexedEax = address => emit(0x89, 0x04, 0x8d, ...u32(address));
  emit(0x8b, 0x0d, ...u32(observed + COUNT)); // mov ecx,[count]
  emit(0x83, 0xf9, CAPACITY, 0x72, 0x02, 0x0f, 0x0b); // trap instead of overflowing records
  for (const [stackOffset, recordOffset] of [
    [4, HNDS], [8, MSGS], [12, WPARAMS], [16, LPARAMS],
  ]) {
    emit(0x8b, 0x44, 0x24, stackOffset); // mov eax,[esp+stackOffset]
    storeIndexedEax(observed + recordOffset);
  }
  emit(0x41); // inc ecx
  emit(0x89, 0x0d, ...u32(observed + COUNT)); // mov [count],ecx
  // These fixtures expect ordinary default focus, so actually delegate
  // WM_ACTIVATE. Run optional reentry hooks after default processing, allowing
  // the hook to select the final focus/active window without a later default.
  if (defaultActivation) {
    const chain = [...Array(4).fill([0xff, 0x74, 0x24, 16]).flat(),
      0xb8, ...u32(defaultActivateThunk), 0xff, 0xd0];
    emit(0x83, 0x7c, 0x24, 8, 6, 0x75, chain.length, ...chain);
  }
  emit(...callback);
  emit(0x31, 0xc0); // xor eax,eax
  emit(0x83, 0x7c, 0x24, 8, 0x13, 0x75, 5); // accept WM_QUERYOPEN for OpenIcon
  emit(0xb8, ...u32(1));
  emit(0xc2, 0x10, 0x00); // ret 16
  return Uint8Array.from(out);
}

const extraWat = String.raw`
  (func (export "test_focus_serial") (result i32) (global.get $focus_transition_serial))
  (func (export "test_window_slot") (param $hwnd i32) (result i32)
    (call $wnd_table_find (local.get $hwnd)))
  (func (export "test_native_control") (param $h i32)
    (call $wnd_table_set (local.get $h) (global.get $WNDPROC_CTRL_NATIVE)))
  (func (export "test_restore_modal_focus") (param $owner i32)
    (call $focus_restore_after_modal (local.get $owner)))
  (func (export "test_mdi_focus") (param $client i32) (param $target i32) (param $mode i32)
    (local $state i32)
    (local.set $state (call $heap_alloc (i32.const 16)))
    (memory.fill (call $g2w (local.get $state)) (i32.const 0) (i32.const 16))
    (call $ctrl_table_set (call $wnd_table_find (local.get $client)) (i32.const 33) (i32.const 0))
    (call $wnd_set_state_ptr (local.get $client) (local.get $state))
    (if (i32.ne (local.get $mode) (i32.const 3))
      (then (call $gs32 (i32.add (local.get $state) (i32.const 8)) (local.get $target))))
    (if (i32.eqz (local.get $mode))
      (then (drop (call $mdiclient_wndproc (local.get $client) (i32.const 7) (i32.const 0) (i32.const 0))))
      (else (if (i32.eq (local.get $mode) (i32.const 1))
        (then (drop (call $mdi_frame_message (call $wnd_get_parent (local.get $client))
          (local.get $client) (i32.const 7) (i32.const 0) (i32.const 0))))
        (else (drop (call $mdi_client_activate (local.get $client) (local.get $target)))))))
    (call $wnd_set_state_ptr (local.get $client) (i32.const 0))
    (call $heap_free (local.get $state)))
  (func (export "test_mouse_clear_nc")
    (local $h i32)
    (block $done (loop $next
      (local.set $h (call $nc_flags_scan (i32.const 7)))
      (br_if $done (i32.eqz (local.get $h)))
      (call $nc_flags_clear (local.get $h) (i32.const 7))
      (br $next))))
  (func (export "test_mouse_state") (param $h i32) (result i32)
    (i32.or (global.get $code16) (i32.or
      (i32.shl (global.get $user_queue_input_flags) (i32.const 4))
      (i32.shl (call $win16_is_far_proc (call $wnd_table_get (local.get $h))) (i32.const 8)))))
  (func (export "test_mouse_pump") (param $ptr i32) (param $sp i32) (param $peek i32)
      (param $remove i32) (param $min i32) (param $max i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (if (local.get $peek)
      (then (call $handle_PeekMessageA (local.get $ptr) (i32.const 0)
        (local.get $min) (local.get $max) (local.get $remove) (i32.const 0)))
      (else (call $handle_GetMessageA (local.get $ptr) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))))
    (i32.load (global.get $reg_base)))
  (func (export "test_focus_api") (param $h i32) (param $stack i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_SetFocus (local.get $h) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "test_default_activate") (param $h i32) (param $wp i32) (param $stack i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_DefWindowProcA (local.get $h) (i32.const 6) (local.get $wp) (i32.const 0) (i32.const 0) (i32.const 0)))
  (func (export "test_iconic") (param $h i32) (call $wnd_apply_show_state (local.get $h) (i32.const 2)))
  (func (export "test_disable") (param $h i32)
    (local $saved i32)
    (local.set $saved (i32.load offset=16 (global.get $reg_base)))
    (call $handle_EnableWindow (local.get $h) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved)))
  (func (export "test_click_activate") (param $h i32) (result i32)
    (call $active_window_transition_reason (local.get $h) (i32.const 2)))
  (func (export "test_thunk") (param $id i32) (result i32)
    (local $p i32)
    (global.set $thunk_guest_base (call $w2g (global.get $THUNK_BASE)))
    (local.set $p (i32.add (global.get $THUNK_BASE) (i32.mul (global.get $num_thunks) (i32.const 8))))
    (i32.store (local.get $p) (i32.const 0))
    (i32.store offset=4 (local.get $p) (local.get $id))
    (global.set $num_thunks (i32.add (global.get $num_thunks) (i32.const 1)))
    (call $update_thunk_end)
    (call $w2g (local.get $p)))
  (func (export "test_make_window")
      (param $proc i32) (param $style i32) (param $parent i32)
      (param $tid i32) (result i32)
    (local $hwnd i32) (local $saved_tid i32)
    (local.set $saved_tid (global.get $current_thread_id))
    (global.set $current_thread_id (local.get $tid))
    (local.set $hwnd (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $hwnd) (local.get $proc))
    (drop (call $wnd_set_style (local.get $hwnd) (local.get $style)))
    (call $wnd_set_parent (local.get $hwnd) (local.get $parent))
    (global.set $current_thread_id (local.get $saved_tid))
    (local.get $hwnd))

  (func (export "test_set_active") (param $hwnd i32) (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_SetActiveWindow
      (local.get $hwnd) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i64.or
      (i64.extend_i32_u (i32.load offset=0 (global.get $reg_base)))
      (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))

  (func (export "test_get_active") (result i32)
    (local $saved_esp i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_GetActiveWindow
      (i32.const 0) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_get_foreground") (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_GetForegroundWindow
      (i32.const 0) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i64.or
      (i64.extend_i32_u (i32.load offset=0 (global.get $reg_base)))
      (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))

  (func (export "test_set_foreground") (param $hwnd i32) (result i32)
    (local $saved_esp i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_SetForegroundWindow
      (local.get $hwnd) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_bring") (param $hwnd i32) (result i32)
    (local $saved_esp i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_BringWindowToTop
      (local.get $hwnd) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_focus") (result i32) (global.get $focus_hwnd))
  (func (export "test_activation_wrapper") (param $kind i32) (param $h i32) (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (if (i32.eq (local.get $kind) (i32.const 1))
      (then (call $handle_SetForegroundWindow (local.get $h) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))))
    (if (i32.eq (local.get $kind) (i32.const 2))
      (then (call $handle_SwitchToThisWindow (local.get $h) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))))
    (if (i32.eq (local.get $kind) (i32.const 3))
      (then
        (call $wnd_apply_show_state (local.get $h) (i32.const 2))
        (call $handle_OpenIcon (local.get $h) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))))
    (if (i32.eq (local.get $kind) (i32.const 4))
      (then (call $show_window_activate_top_level (local.get $h) (i32.const 5))))
    (i64.or
      (i64.extend_i32_u (i32.load (global.get $reg_base)))
      (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))
  (func (export "test_destroy") (param $hwnd i32)
    (call $wnd_destroy_recursive (local.get $hwnd)))
`;

(async () => {
  const mouseInput = [];
  let currentMouse = null;
  let inputRenderer = null;
  let desktopHost = null;
  const polledFocus = new Set();
  assert.strictEqual(apiTable.find(api => api.name === 'SetActiveWindow').nargs, 1);
  assert.strictEqual(apiTable.find(api => api.name === 'GetActiveWindow').nargs, 0);
  assert.strictEqual(apiTable.find(api => api.name === 'GetForegroundWindow').nargs, 0);

  const hostCalls = [];
  const externalForeground = 0x76543210;
  let foreground = externalForeground;
  const harness = await bootRenderHarness({
    extraWat,
    fonts: 'none',
    extraHostOverrides: {
      check_input() {
        const event = inputRenderer && inputRenderer.takeInput();
        currentMouse = inputRenderer
          ? (event && { hwnd: event.hwnd, msg: event.msg, wp: event.wParam, lp: event.lParam })
          : (mouseInput.shift() || null);
        return currentMouse ? ((currentMouse.wp << 16) | currentMouse.msg) : 0;
      },
      check_input_hwnd(focus) {
        assert.strictEqual(focus, e.get_focus_hwnd(), 'compiled poll passes its live focus to the host');
        polledFocus.add(focus);
        return currentMouse ? currentMouse.hwnd : 0;
      },
      check_input_lparam() { return currentMouse ? currentMouse.lp : 0; },
      activate_window(hwnd) {
        hostCalls.push(['activate', hwnd >>> 0]);
        if (desktopHost) return desktopHost.activate_window(hwnd);
        return hwnd ? 1 : 0;
      },
      foreground_window() {
        if (desktopHost) return desktopHost.foreground_window();
        return foreground === null ? e.test_get_active() : foreground;
      },
      set_window_zorder(hwnd, after) {
        hostCalls.push(['zorder', hwnd >>> 0, after | 0]);
      },
      invalidate_frame() {},
      destroy_window() {},
    },
  });
  const { exports: e, memory } = harness;
  const fixture = fs.readFileSync(path.join(ROOT, 'test', 'binaries', 'calc.exe'));
  new Uint8Array(memory.buffer).set(fixture, e.get_staging());
  assert(e.load_pe(fixture.length), 'fixture PE initializes synchronous wndproc dispatch');
  e.init_dx_com_thunks();

  const imageBase = e.get_image_base() >>> 0;
  const guestBase = e.get_guest_base() >>> 0;
  const toWasm = guest => (guest - imageBase + guestBase) >>> 0;
  const bytes = new Uint8Array(memory.buffer);
  const view = new DataView(memory.buffer);
  const observed = e.guest_alloc(RECORD_BYTES) >>> 0;
  defaultActivateThunk = e.test_thunk(apiTable.find(api => api.name === 'DefWindowProcA').id);
  const proc = e.guest_alloc(256) >>> 0;
  bytes.set(makeWndProc(observed), toWasm(proc));

  const WS_VISIBLE = 0x10000000;
  const WS_CHILD = 0x40000000;
  const first = e.test_make_window(proc, WS_VISIBLE, 0, 1) >>> 0;
  const second = e.test_make_window(proc, WS_VISIBLE, 0, 1) >>> 0;
  const child = e.test_make_window(proc, WS_VISIBLE | WS_CHILD, first, 1) >>> 0;
  const foreign = e.test_make_window(proc, WS_VISIBLE, 0, 2) >>> 0;
  const stack = 0x074ff000;
  const count = () => view.getUint32(toWasm(observed + COUNT), true);
  const records = () => Array.from({ length: count() }, (_, index) => ({
    hwnd: view.getUint32(toWasm(observed + HNDS + index * 4), true),
    msg: view.getUint32(toWasm(observed + MSGS + index * 4), true),
    wParam: view.getUint32(toWasm(observed + WPARAMS + index * 4), true),
    lParam: view.getUint32(toWasm(observed + LPARAMS + index * 4), true),
  }));
  const result = value => Number(value & 0xffffffffn) >>> 0;
  const finalEsp = value => Number(value >> 32n) >>> 0;

  assert.strictEqual(e.test_get_active(), 0,
    'a thread queue starts without an active window');
  let packed = e.test_get_foreground(stack);
  assert.strictEqual(result(packed), externalForeground,
    'GetForegroundWindow reads renderer-wide state rather than this process main HWND');
  assert.strictEqual(finalEsp(packed), stack + 4,
    'zero-argument GetForegroundWindow pops its return address');
  // Nothing foreground is not NULL on a real desktop: the shell owns it.
  // Moorhuhn 2's fmod hands this to IDirectSound::SetCooperativeLevel before
  // creating a window, and NULL failed DirectSound init (a silent game).
  foreground = 0;
  packed = e.test_get_foreground(stack);
  assert.strictEqual(result(packed), 0x10000,
    'GetForegroundWindow falls back to the desktop when no window is foreground');
  foreground = externalForeground;
  packed = e.test_set_active(first, stack);
  assert.strictEqual(result(packed), 0,
    'first successful SetActiveWindow returns the previous NULL active window');
  assert.strictEqual(finalEsp(packed), stack + 8, 'SetActiveWindow cleans stdcall');
  assert.strictEqual(e.test_get_active() >>> 0, first);
  assert.strictEqual(e.test_focus() >>> 0, first,
    'default WM_ACTIVATE behavior assigns focus to the active top-level');
  assert.deepStrictEqual(records(), [
    { hwnd: first, msg: 0x0006, wParam: 1, lParam: 0 },
    { hwnd: first, msg: 0x0007, wParam: 0, lParam: 0 },
  ], 'first activation synchronously sends WM_ACTIVATE then WM_SETFOCUS');

  packed = e.test_set_active(second, stack);
  assert.strictEqual(result(packed), first,
    'SetActiveWindow returns the previously active top-level');
  assert.strictEqual(e.test_get_active() >>> 0, second);
  assert.strictEqual(e.test_focus() >>> 0, second);
  assert.deepStrictEqual(records().slice(2), [
    { hwnd: first, msg: 0x0006, wParam: 0, lParam: second },
    { hwnd: second, msg: 0x0006, wParam: 1, lParam: first },
    { hwnd: first, msg: 0x0008, wParam: second, lParam: 0 },
    { hwnd: second, msg: 0x0007, wParam: first, lParam: 0 },
  ], 'switch sends deactivation/activation before the focus pair');

  packed = e.test_set_active(child, stack);
  assert.strictEqual(result(packed), 0, 'SetActiveWindow rejects child HWNDs');
  assert.strictEqual(e.test_get_active() >>> 0, second,
    'failed child activation preserves active state');

  packed = e.test_set_active(foreign, stack);
  assert.strictEqual(result(packed), second,
    'a foreign-thread HWND returns this queue\'s previous active window');
  assert.strictEqual(e.test_get_active(), 0,
    'a foreign-thread HWND clears rather than steals this queue\'s active state');
  assert.strictEqual(e.test_focus(), 0,
    'clearing the active window releases focus from its old window tree');
  assert.deepStrictEqual(hostCalls, [
    ['activate', first], ['activate', second],
  ], 'only same-thread SetActiveWindow calls reach browser activation');

  assert.strictEqual(e.test_set_foreground(second), 1);
  assert.strictEqual(e.test_get_active() >>> 0, second,
    'SetForegroundWindow updates the caller queue active state');
  assert.strictEqual(e.test_bring(child), 1);
  assert.strictEqual(e.test_get_active() >>> 0, first,
    'BringWindowToTop activates a child HWND\'s top-level ancestor');
  assert.deepStrictEqual(hostCalls.slice(-3), [
    ['activate', second], ['zorder', child, 0], ['activate', child],
  ], 'foreground and child Bring calls preserve their renderer targets');
  assert.strictEqual(e.test_set_foreground(child), 1);
  assert.strictEqual(e.test_get_active() >>> 0, first);
  assert.deepStrictEqual(hostCalls.at(-1), ['activate', child],
    'shared activation keeps the original child HWND for the host');

  e.test_destroy(first);
  assert.strictEqual(e.test_get_active(), 0,
    'destroying the active top-level clears GetActiveWindow state');
  assert.strictEqual(e.test_set_foreground(foreign), 1);
  assert.strictEqual(e.test_get_active(), 0, 'foreign foreground delegation does not steal queue activation');
  assert.deepStrictEqual(hostCalls.at(-1), ['activate', foreign],
    'foreign foreground HWND still reaches the host');

  const setActiveThunk = e.test_thunk(apiTable.find(api => api.name === 'SetActiveWindow').id);
  const armed = e.guest_alloc(4) >>> 0;
  const resetRecords = () => view.setUint32(toWasm(observed + COUNT), 0, true);
  // Reenter from every synchronous notification boundary, using real guest
  // x86 and the public SetActiveWindow thunk, not a host state assignment.
  const boundaries = [
    ['old', 6, 0], ['target', 6, 1], ['old', 8, null], ['target', 7, null],
  ];
  for (const [kind, where, message, wp] of [0, 1, 2, 3, 4]
    .flatMap(kind => boundaries.map(boundary => [kind, ...boundary]))) {
    resetRecords();
    const hookProc = e.guest_alloc(256) >>> 0;
    const old = e.test_make_window(where === 'old' ? hookProc : proc, WS_VISIBLE, 0, 1) >>> 0;
    const target = e.test_make_window(where === 'target' ? hookProc : proc, WS_VISIBLE, 0, 1) >>> 0;
    const chosen = e.test_make_window(proc, WS_VISIBLE, 0, 1) >>> 0;
    const action = [0xc7, 0x05, ...u32(armed), ...u32(0), // disarm before recursion
      0x68, ...u32(chosen), 0xb8, ...u32(setActiveThunk), 0xff, 0xd0];
    const conditionalWp = wp === null ? action :
      [0x83, 0x7c, 0x24, 12, wp, 0x75, action.length, ...action];
    const conditionalMsg = [0x83, 0x7c, 0x24, 8, message,
      0x75, conditionalWp.length, ...conditionalWp];
    bytes.set(makeWndProc(observed, [0x83, 0x3d, ...u32(armed), 0,
      0x74, conditionalMsg.length, ...conditionalMsg]), toWasm(hookProc));
    view.setUint32(toWasm(armed), 0, true);
    e.test_set_active(old, stack);
    resetRecords();
    hostCalls.length = 0;
    view.setUint32(toWasm(armed), 1, true);
    packed = kind === 0 ? e.test_set_active(target, stack) :
      e.test_activation_wrapper(kind, target, stack);
    if (kind === 0) assert.strictEqual(result(packed), old,
      'outer return retains its original previous HWND');
    if (kind === 3) assert.strictEqual(result(packed), 1,
      'OpenIcon still reports its successful restore');
    assert.strictEqual(finalEsp(packed), stack + (kind === 4 ? 0 : kind === 2 ? 12 : 8),
      `wrapper ${kind}: nested activation preserves caller stack`);
    assert.strictEqual(e.test_get_active() >>> 0, chosen);
    assert.strictEqual(e.test_focus() >>> 0, chosen, `${where}/${message}: nested focus survives`);
    const events = records();
    const choice = events.findIndex(r => r.hwnd === chosen && r.msg === 6 && r.wParam === 1);
    assert(count() <= CAPACITY, 'notification recorder stays within its allocation');
    assert(choice >= 0, `${where}/${message}: nested target receives activation: ${JSON.stringify(events)}`);
    assert(!events.slice(choice + 1).some(r => r.hwnd === target &&
      ((r.msg === 6 && r.wParam === 1) || r.msg === 7)),
    `${where}/${message}: superseded target gets no stale activation/focus`);
    assert.deepStrictEqual(hostCalls, [['activate', chosen]],
      `wrapper ${kind}, ${where}/${message}: outer host activation must not undo the nested choice`);
  }

  {
    const first = e.test_make_window(proc, WS_VISIBLE, 0, 1);
    const second = e.test_make_window(proc, WS_VISIBLE, 0, 1);
    e.test_set_active(first, stack);
    resetRecords();
    assert.strictEqual(e.test_click_activate(second), first);
    assert.deepStrictEqual(records(), [
      { hwnd: first, msg: 6, wParam: 0, lParam: second },
      { hwnd: second, msg: 6, wParam: 2, lParam: first },
      { hwnd: first, msg: 8, wParam: second, lParam: 0 },
      { hwnd: second, msg: 7, wParam: first, lParam: 0 },
    ], 'mouse reason changes only the activating WM_ACTIVATE');
    resetRecords();
    e.test_click_activate(second);
    assert.deepStrictEqual(records(), [], 'same-target click does not repeat activation');
    const clickProc = e.guest_alloc(256);
    const clickTarget = e.test_make_window(clickProc, WS_VISIBLE, 0, 1);
    const nestedAction = [0x68, ...u32(first), 0xb8, ...u32(setActiveThunk), 0xff, 0xd0];
    const whenClick = [0x83, 0x7c, 0x24, 12, 2, 0x75, nestedAction.length, ...nestedAction];
    bytes.set(makeWndProc(observed, [0x83, 0x7c, 0x24, 8, 6,
      0x75, whenClick.length, ...whenClick], false), toWasm(clickProc));
    resetRecords();
    e.test_click_activate(clickTarget);
    assert.strictEqual(e.test_get_active(), first);
    assert(records().some(r => r.hwnd === clickTarget && r.msg === 6 && r.wParam === 2));
    assert(records().some(r => r.hwnd === first && r.msg === 6 && r.wParam === 1),
      'nested API activation does not inherit mouse reason');
    assert(!records().some(r => r.hwnd === clickTarget && r.msg === 7),
      'superseded click must not reclaim focus');
  }
  const getActiveThunk = e.test_thunk(apiTable.find(api => api.name === 'GetActiveWindow').id);
  const destroyThunk = e.test_thunk(apiTable.find(api => api.name === 'DestroyWindow').id);
  const seenActive = e.guest_alloc(4);
  for (const mode of [0, 1, 2, 3, 4]) {
    const oldProc = e.guest_alloc(256);
    const old = e.test_make_window(oldProc, WS_VISIBLE, 0, 1);
    const target = e.test_make_window(proc, WS_VISIBLE, 0, 1);
    const chosen = e.test_make_window(proc, WS_VISIBLE, 0, 1);
    const activate = h => [0x68, ...u32(h), 0xb8, ...u32(setActiveThunk), 0xff, 0xd0];
    const action = [0xc7, 0x05, ...u32(armed), ...u32(0),
      0xb8, ...u32(getActiveThunk), 0xff, 0xd0, 0xa3, ...u32(seenActive),
      ...(mode && mode !== 4 ? activate(mode === 2 ? old : chosen) : []),
      ...(mode === 4 ? [0x68, ...u32(target), 0xb8, ...u32(destroyThunk), 0xff, 0xd0] : []),
      ...(mode === 3 ? activate(old) : [])];
    const onInactive = [0x83, 0x7c, 0x24, 12, 0, 0x75, action.length, ...action];
    const onActivate = [0x83, 0x7c, 0x24, 8, 6, 0x75, onInactive.length, ...onInactive];
    bytes.set(makeWndProc(observed, [0x83, 0x3d, ...u32(armed), 0,
      0x74, onActivate.length, ...onActivate]), toWasm(oldProc));
    view.setUint32(toWasm(armed), 0, true);
    e.test_set_active(old, stack);
    resetRecords();
    view.setUint32(toWasm(armed), 1, true);
    assert.strictEqual(result(e.test_set_active(target, stack)), old);
    assert.strictEqual(view.getUint32(toWasm(seenActive), true), old,
      'native deactivation observes old active HWND');
    const expected = mode === 1 ? chosen : mode === 3 || mode === 4 ? old : target;
    assert.strictEqual(e.test_get_active(), expected, `native reentry mode ${mode}`);
    assert.strictEqual(e.test_focus(), expected);
    assert.strictEqual(records().filter(r => r.hwnd === target && r.msg === 6 && r.wParam === 1).length,
      mode === 1 || mode === 3 || mode === 4 ? 0 : 1, 'superseded/retired activation is not delivered');
  }
  const focusA = e.test_make_window(proc, WS_VISIBLE, 0, 1);
  const focusB = e.test_make_window(proc, WS_VISIBLE, 0, 1);
  const focusChild = e.test_make_window(proc, WS_VISIBLE | WS_CHILD, focusB, 1);
  const focusThunk = e.test_thunk(apiTable.find(api => api.name === 'SetFocus').id);
  const getFocusThunk = e.test_thunk(apiTable.find(api => api.name === 'GetFocus').id);
  for (const target of [focusA, focusB, focusChild, 0]) {
    e.test_set_active(focusA, stack);
    resetRecords();
    const old = e.test_focus_api(target, stack);
    assert.strictEqual(e.get_esp(), stack + 8, 'SetFocus cleans stdcall synchronously');
    assert.strictEqual(old, target && target !== focusA ? focusB : focusA,
      'native old focus is captured after activation');
    assert.strictEqual(e.test_focus(), target);
    assert.strictEqual(e.test_get_active(), target && target !== focusA ? focusB : focusA);
    const events = records();
    if (target === focusA) assert.deepStrictEqual(events, []);
    else if (!target) assert.deepStrictEqual(events, [{hwnd: focusA, msg: 8, wParam: 0, lParam: 0}]);
    else assert.deepStrictEqual(events.slice(-2), [
      {hwnd: focusB, msg: 8, wParam: target, lParam: 0},
      {hwnd: target, msg: 7, wParam: focusB, lParam: 0},
    ], 'outer focus transfer follows synchronous activation');
  }
  for (const wp of [0, 1, 2, 0x10000, 0x10001, 0x10002]) {
    e.test_set_active(focusA, stack);
    e.test_focus_api(focusA, stack);
    resetRecords();
    e.test_default_activate(focusB, wp, stack);
    assert.strictEqual(e.test_focus(), (wp & 0xffff) ? focusB : focusA);
    assert.strictEqual(e.get_esp(), stack + 20);
  }
  e.test_set_active(focusA, stack);
  e.test_iconic(focusB);
  e.test_focus_api(focusA, stack);
  resetRecords();
  assert.strictEqual(e.test_focus_api(focusB, stack), 0);
  e.test_default_activate(focusB, 1, stack);
  assert.strictEqual(e.test_focus(), focusA);
  assert.deepStrictEqual(records(), []);
  const disabled = e.test_make_window(proc, WS_VISIBLE, 0, 1);
  e.test_disable(disabled);
  assert.strictEqual(e.test_focus_api(disabled, stack), 0);
  assert.strictEqual(e.test_focus_api(foreign, stack), 0);
  assert.strictEqual(e.test_focus(), focusA);

  // Consuming WM_ACTIVATE is distinct from delegating it to DefWindowProc.
  // In particular, publication serials do not record same-value SetFocus(NULL).
  for (const mode of ['handled', 'null', 'null-twice', 'already-null', 'child', 'foreign', 'dead', 'reused-slot']) {
    const hook = e.guest_alloc(512);
    const target = e.test_make_window(hook, WS_VISIBLE, 0, 1);
    const child = e.test_make_window(proc, WS_VISIBLE | WS_CHILD, target, 1);
    const dead = e.test_make_window(proc, WS_VISIBLE, 0, 1);
    const deadSlot = e.test_window_slot(dead);
    const deadGeneration = e.wnd_lookup_generation(dead);
    e.test_destroy(dead);
    const replacement = mode === 'reused-slot' ? e.test_make_window(proc, WS_VISIBLE, 0, 1) : 0;
    if (replacement) {
      assert.strictEqual(e.test_window_slot(replacement), deadSlot, 'negative really reuses the retired slot');
      assert.notStrictEqual(e.wnd_lookup_generation(replacement), deadGeneration,
        'replacement has a different lifetime generation');
    }
    e.test_set_active(focusA, stack);
    e.test_focus_api(mode === 'already-null' ? 0 : focusA, stack);
    resetRecords();
    const serial = e.test_focus_serial();
    const select = hwnd => [0x68, ...u32(hwnd), 0xb8, ...u32(focusThunk), 0xff, 0xd0];
    const action = mode.includes('null') ? [...select(0), ...(mode === 'null-twice' ? select(0) : [])] :
      mode === 'child' ? select(child) : mode === 'foreign' ? select(foreign) :
      mode === 'dead' || mode === 'reused-slot' ? select(dead) : [];
    const onActive = [0x83, 0x7c, 0x24, 12, 0, 0x74, action.length, ...action];
    bytes.set(makeWndProc(observed, [0x83, 0x7c, 0x24, 8, 6,
      0x75, onActive.length, ...onActive], false), toWasm(hook));
    e.test_set_active(target, stack);
    assert.strictEqual(e.test_get_active(), target, `${mode}: active window is independent of focus`);
    const expected = mode.includes('null') ? 0 : mode === 'child' ? child : focusA;
    assert.strictEqual(e.test_focus(), expected, `${mode}: no second default focus after callback`);
    if (mode === 'already-null') assert.strictEqual(e.test_focus_serial(), serial,
      'already-NULL intent survives without a focus publication');
    assert(!records().some(r => r.hwnd === target && r.msg === 7),
      `${mode}: consumed activation does not synthesize top-level SETFOCUS`);
    if (replacement) assert(!records().some(r => r.hwnd === replacement && r.msg === 7),
      'a stale HWND cannot focus the new generation in its old slot');
  }
  e.test_set_active(focusA, stack);
  e.test_focus_api(focusA, stack);
  resetRecords();
  e.test_set_active(disabled, stack);
  assert.strictEqual(e.test_get_active(), disabled, 'activation and valid keyboard focus remain distinct');
  assert.strictEqual(e.test_focus(), focusA, 'no fallback after default focus rejects a disabled target');
  assert(!records().some(r => r.hwnd === disabled && r.msg === 7));

  // Reenter from KILLFOCUS. It must already observe the new focus, and the
  // nested selection must not receive a later stale outer SETFOCUS.
  const focusHook = e.guest_alloc(256);
  const oldFocus = e.test_make_window(focusHook, WS_VISIBLE | WS_CHILD, focusA, 1);
  const focusTarget = e.test_make_window(proc, WS_VISIBLE | WS_CHILD, focusA, 1);
  const focusChosen = e.test_make_window(proc, WS_VISIBLE | WS_CHILD, focusA, 1);
  const focusAction = [0xc7, 0x05, ...u32(armed), ...u32(0),
    0xb8, ...u32(getFocusThunk), 0xff, 0xd0, 0xa3, ...u32(seenActive),
    0x68, ...u32(focusChosen), 0xb8, ...u32(focusThunk), 0xff, 0xd0];
  const focusMsg = [0x83, 0x7c, 0x24, 8, 8, 0x75, focusAction.length, ...focusAction];
  bytes.set(makeWndProc(observed, [0x83, 0x3d, ...u32(armed), 0,
    0x74, focusMsg.length, ...focusMsg]), toWasm(focusHook));
  view.setUint32(toWasm(armed), 0, true);
  e.test_focus_api(oldFocus, stack);
  resetRecords();
  view.setUint32(toWasm(armed), 1, true);
  assert.strictEqual(e.test_focus_api(focusTarget, stack), oldFocus);
  assert.strictEqual(view.getUint32(toWasm(seenActive), true), focusTarget);
  assert.strictEqual(e.test_focus(), focusChosen);
  assert(!records().some(r => r.hwnd === focusTarget && r.msg === 7));
  // The renderer/control export must publish before KILLFOCUS too, and must
  // not send a stale SETFOCUS after the guest redirects the transfer.
  view.setUint32(toWasm(armed), 0, true);
  e.set_focus(oldFocus);
  resetRecords();
  view.setUint32(toWasm(armed), 1, true);
  harness.renderer._setInputFocus(harness.instance, focusTarget);
  assert.strictEqual(view.getUint32(toWasm(seenActive), true), focusTarget);
  assert.strictEqual(e.test_focus(), focusChosen);
  assert(!records().some(r => r.hwnd === focusTarget && r.msg === 7));
  resetRecords();
  e.set_focus(disabled);
  assert.strictEqual(e.test_focus(), focusChosen, 'internal focus rejects disabled targets');
  assert.deepStrictEqual(records(), []);
  const mdiClient = e.test_make_window(proc, WS_VISIBLE | WS_CHILD, focusA, 1);
  const mdiTarget = e.test_make_window(proc, WS_VISIBLE | WS_CHILD, mdiClient, 1);
  for (const mode of [0, 1, 2, 3]) {
    view.setUint32(toWasm(armed), 0, true);
    e.set_focus(oldFocus);
    resetRecords();
    view.setUint32(toWasm(armed), 1, true);
    e.test_mdi_focus(mdiClient, mdiTarget, mode);
    assert.strictEqual(view.getUint32(toWasm(seenActive), true), mdiTarget);
    assert.strictEqual(e.test_focus(), focusChosen, `MDI route ${mode} preserves nested focus`);
    assert(!records().some(r => r.hwnd === mdiTarget && r.msg === 7),
      `MDI route ${mode} must not notify the superseded target`);
  }
  const restoreProc = e.guest_alloc(512);
  const restoreTarget = e.test_make_window(restoreProc, WS_VISIBLE | WS_CHILD, focusA, 1);
  const restoreMsg = [0x83, 0x7c, 0x24, 8, 7, 0x75, focusAction.length, ...focusAction];
  bytes.set(makeWndProc(observed, [0x83, 0x3d, ...u32(armed), 0,
    0x74, restoreMsg.length, ...restoreMsg]), toWasm(restoreProc));
  e.set_focus(0);
  resetRecords();
  view.setUint32(toWasm(armed), 1, true);
  e.test_restore_modal_focus(restoreTarget);
  assert.strictEqual(view.getUint32(toWasm(seenActive), true), restoreTarget,
    'owner restoration publishes focus before its synchronous callback');
  assert.strictEqual(e.test_focus(), focusChosen, 'owner callback can redirect focus before restoration returns');
  assert(records().some(r => r.hwnd === restoreTarget && r.msg === 7));
  resetRecords();
  e.test_restore_modal_focus(restoreTarget);
  assert.strictEqual(e.test_focus(), focusChosen, 'restoration preserves an existing live focus');
  assert.deepStrictEqual(records(), []);
  // Native reentry case 4: chaining to DefWindowProc after choosing C
  // reactivates B, unlike consuming the activation message.
  const defThunk = e.test_thunk(apiTable.find(api => api.name === 'DefWindowProcA').id);
  const chainProc = e.guest_alloc(512);
  const chainB = e.test_make_window(chainProc, WS_VISIBLE, 0, 1);
  const chainC = e.test_make_window(proc, WS_VISIBLE, 0, 1);
  const selectC = [0xc7, 0x05, ...u32(armed), ...u32(0),
    0x68, ...u32(chainC), 0xb8, ...u32(setActiveThunk), 0xff, 0xd0];
  const armedC = [0x83, 0x3d, ...u32(armed), 0, 0x74, selectC.length, ...selectC];
  const activeC = [0x83, 0x7c, 0x24, 12, 0, 0x74, armedC.length, ...armedC];
  const chain = [...activeC, ...Array(4).fill([0xff, 0x74, 0x24, 16]).flat(),
    0xb8, ...u32(defThunk), 0xff, 0xd0];
  bytes.set(makeWndProc(observed, [0x83, 0x7c, 0x24, 8, 6, 0x75, chain.length, ...chain], false), toWasm(chainProc));
  view.setUint32(toWasm(armed), 0, true);
  e.test_set_active(focusA, stack);
  resetRecords();
  view.setUint32(toWasm(armed), 1, true);
  e.test_set_active(chainB, stack);
  assert.strictEqual(e.test_get_active(), chainB, 'default processing reclaims activation after nested choice');
  assert.strictEqual(e.test_focus(), chainB);
  assert.deepStrictEqual(records().slice(-2), [
    {hwnd: chainB, msg: 8, wParam: chainB, lParam: 0},
    {hwnd: chainB, msg: 7, wParam: chainB, lParam: 0},
  ], 'native reentry ends with the outer self-focus pair');
  const mouseMsg = e.guest_alloc(28) >>> 0;
  foreground = null; // Ordinary single-app cases keep desktop/local activation aligned.
  // Earlier restore/focus cases deliberately left NC work pending. Keep the
  // input transaction matrix independent of that synthetic message source.
  e.test_mouse_clear_nc();
  const readMouse = () => Array.from({length: 7}, (_, i) => view.getUint32(toWasm(mouseMsg) + i * 4, true));
  for (const peek of [1, 0]) {
    for (const answer of [0, 1, 2, 3, 4]) {
      const mouseProc = e.guest_alloc(256) >>> 0;
      bytes.set(makeWndProc(observed, [0x83, 0x7c, 0x24, 8, 0x21, 0x75, 8,
        0xb8, ...u32(answer), 0xc2, 0x10, 0]), toWasm(mouseProc));
      const target = e.test_make_window(mouseProc, WS_VISIBLE, 0, 1);
      e.test_set_active(focusA, stack);
      resetRecords();
      hostCalls.length = 0;
      mouseInput.push({hwnd: target, msg: 0x201, wp: 1, lp: 0x0014000a});
      if (peek) {
        for (let i = 0; i < 2; i++) {
          assert.strictEqual(e.test_mouse_pump(mouseMsg, stack, 1, 0, 0x201, 0x201), 1);
          assert.deepStrictEqual(records(), [], 'PM_NOREMOVE never queries or activates');
          assert.strictEqual(e.test_get_active(), focusA);
        }
      }
      // GetMessage must continue to the button-up when the down is eaten.
      mouseInput.push({hwnd: target, msg: 0x202, wp: 0, lp: 0x0014000a});
      const eats = answer === 2 || answer === 4;
      const activates = answer !== 3 && answer !== 4;
      const result = e.test_mouse_pump(mouseMsg, stack, peek, 1, 0x201, 0x201);
      assert.strictEqual(result, peek && eats ? 0 : 1, `answer ${answer}: pump result`);
      assert.strictEqual(e.get_esp(), stack + (peek ? 24 : 20), 'eaten-message retry preserves stdcall cleanup');
      assert.strictEqual(e.test_get_active(), activates ? target : focusA,
        `peek=${peek} answer=${answer} state=${e.test_mouse_state(target)} esp=${e.get_esp().toString(16)} msg=${readMouse()} events=${JSON.stringify(records())}`);
      assert.strictEqual(records().filter(r => r.msg === 0x21).length, 1, 'query once on removal');
      assert.deepStrictEqual(records()[0], {hwnd: target, msg: 0x21, wParam: target, lParam: 0x02010001});
      assert.strictEqual(records().some(r => r.hwnd === target && r.msg === 6 && r.wParam === 2), activates,
        'mouse activation uses WA_CLICKACTIVE');
      assert.strictEqual(hostCalls.filter(r => r[0] === 'activate').length, activates ? 1 : 0);
      if (!peek && eats) assert.strictEqual(readMouse()[1], 0x202, 'GetMessage skips eaten down and returns up');
      else {
        if (!eats) assert.strictEqual(readMouse()[1], 0x201);
        assert.strictEqual(e.test_mouse_pump(mouseMsg, stack, 1, 1, 0x202, 0x202), 1,
          'eating down does not eat button-up');
      }
      e.test_set_active(focusA, stack);
      resetRecords();
      e.post_message_q(target, 0x201, 1, 0x0014000a);
      assert.strictEqual(e.test_mouse_pump(mouseMsg, stack, 1, 1, 0x201, 0x201), 1);
      assert.deepStrictEqual(records(), [], 'PostMessage button-down never queries/activates');
    }
  }
  const peekThunk = e.test_thunk(apiTable.find(entry => entry.name === 'PeekMessageA').id);
  const nestedMouseProc = e.guest_alloc(256) >>> 0;
  const nestedMouseCall = [0x6a, 1, 0x68, ...u32(0x400), 0x68, ...u32(0x400),
    0x6a, 0, 0x68, ...u32(mouseMsg), 0xb8, ...u32(peekThunk), 0xff, 0xd0,
    0xb8, ...u32(3), 0xc2, 0x10, 0];
  bytes.set(makeWndProc(observed, [0x83, 0x7c, 0x24, 8, 0x21, 0x75, nestedMouseCall.length,
    ...nestedMouseCall]), toWasm(nestedMouseProc));
  const nestedMouseTarget = e.test_make_window(nestedMouseProc, WS_VISIBLE, 0, 1);
  e.test_set_active(focusA, stack);
  resetRecords();
  e.post_message_q(nestedMouseTarget, 0x400, 0xdead, 0xbeef);
  mouseInput.push({hwnd: nestedMouseTarget, msg: 0x201, wp: 1, lp: 0x0014000a});
  assert.strictEqual(e.test_mouse_pump(mouseMsg, stack, 1, 0, 0x201, 0x201), 1);
  const outerMouse = readMouse();
  assert.strictEqual(e.test_mouse_pump(mouseMsg, stack, 1, 1, 0x201, 0x201), 1);
  // MSG.time may be refreshed when removed; all remaining fields must survive
  // the nested callback's PeekMessage into exactly the same destination.
  assert.deepStrictEqual(readMouse().filter((_, i) => i !== 4), outerMouse.filter((_, i) => i !== 4));
  assert.strictEqual(e.test_get_active(), focusA);
  assert.strictEqual(e.test_mouse_pump(mouseMsg, stack, 1, 1, 0x400, 0x400), 0,
    'the nested pump actually consumed the posted sentinel');

  const parentMouseProc = e.guest_alloc(256) >>> 0;
  bytes.set(makeWndProc(observed, [0x83, 0x7c, 0x24, 8, 0x21, 0x75, 8,
    0xb8, ...u32(3), 0xc2, 0x10, 0]), toWasm(parentMouseProc));
  const childMouseProc = e.guest_alloc(256) >>> 0;
  const parentMouseCall = [...Array(4).fill([0xff, 0x74, 0x24, 16]).flat(),
    0xb8, ...u32(defThunk), 0xff, 0xd0, 0xc2, 0x10, 0];
  bytes.set(makeWndProc(observed, [0x83, 0x7c, 0x24, 8, 0x21, 0x75, parentMouseCall.length,
    ...parentMouseCall]), toWasm(childMouseProc));
  const mouseParent = e.test_make_window(parentMouseProc, WS_VISIBLE, 0, 1);
  const mouseChild = e.test_make_window(childMouseProc, WS_VISIBLE | WS_CHILD, mouseParent, 1);
  resetRecords();
  mouseInput.push({hwnd: mouseChild, msg: 0x201, wp: 1, lp: 0x0014000a});
  assert.strictEqual(e.test_mouse_pump(mouseMsg, stack, 1, 1, 0x201, 0x201), 1);
  assert.deepStrictEqual(records(), [mouseChild, mouseParent].map(hwnd =>
    ({hwnd, msg: 0x21, wParam: mouseParent, lParam: 0x02010001})),
    'child default forwards the original query to its parent before delivering the click');
  assert.strictEqual(e.test_get_active(), focusA);
  const nativeMiddle = e.test_make_window(0, WS_VISIBLE | WS_CHILD, mouseParent, 1);
  const nativeChild = e.test_make_window(0, WS_VISIBLE | WS_CHILD, nativeMiddle, 1);
  e.test_native_control(nativeMiddle); e.test_native_control(nativeChild);
  resetRecords();
  mouseInput.push({hwnd: nativeChild, msg: 0x201, wp: 1, lp: 0x0014000a});
  assert.strictEqual(e.test_mouse_pump(mouseMsg, stack, 1, 1, 0x201, 0x201), 1);
  assert.deepStrictEqual(records(), [{hwnd: mouseParent, msg: 0x21,
    wParam: mouseParent, lParam: 0x02010001}], 'native child chain consults the guest parent');
  assert.strictEqual(e.test_get_active(), focusA, 'native children honor the parent activation veto');
  resetRecords();
  mouseInput.push({hwnd: mouseChild, msg: 0x201, wp: 1, lp: 0x0014000a});
  assert.strictEqual(e.test_mouse_pump(mouseMsg, stack, 1, 1, 0x100, 0x100), 0);
  assert.deepStrictEqual(records(), [], 'filter migration alone never queries the guest');
  assert.strictEqual(e.test_mouse_pump(mouseMsg, stack, 1, 1, 0x201, 0x201), 1);
  assert.strictEqual(records().filter(r => r.msg === 0x21).length, 2,
    'input routed through the shared queue still runs child/parent queries on removal');
  for (const msg of [0x204, 0x207, 0xA1, 0xA4, 0xA7]) {
    resetRecords();
    const nonClient = msg < 0x200;
    mouseInput.push({hwnd: mouseParent, msg, wp: nonClient ? 2 : 0, lp: 0x0014000a});
    assert.strictEqual(e.test_mouse_pump(mouseMsg, stack, 1, 1, msg, msg), 1);
    assert.deepStrictEqual(records(), [{hwnd: mouseParent, msg: 0x21,
      wParam: mouseParent, lParam: ((msg << 16) | (nonClient ? 2 : 1)) >>> 0}],
      'other button-downs retain their initiating message and hit code');
  }
  e.test_set_active(mouseParent, stack);
  resetRecords();
  mouseInput.push({hwnd: mouseChild, msg: 0x201, wp: 1, lp: 0x0014000a});
  assert.strictEqual(e.test_mouse_pump(mouseMsg, stack, 1, 1, 0x201, 0x201), 1);
  assert.deepStrictEqual(records(), [], 'an already-active top level needs no activation query');
  for (const desktop of [externalForeground, 0]) for (const answer of [1, 2, 3, 4]) {
    const query = e.guest_alloc(256) >>> 0;
    bytes.set(makeWndProc(observed, [0x83, 0x7c, 0x24, 8, 0x21, 0x75, 8,
      0xb8, ...u32(answer), 0xc2, 0x10, 0]), toWasm(query));
    const target = e.test_make_window(query, WS_VISIBLE, 0, 1);
    e.test_set_active(target, stack);
    foreground = desktop;
    resetRecords(); hostCalls.length = 0;
    mouseInput.push({hwnd: target, msg: 0x201, wp: 1, lp: 0x0014000a});
    assert.strictEqual(e.test_mouse_pump(mouseMsg, stack, 1, 0, 0x201, 0x201), 1);
    assert.deepStrictEqual(records(), [], 'background PM_NOREMOVE still does not query');
    assert.strictEqual(e.test_mouse_pump(mouseMsg, stack, 1, 1, 0x201, 0x201), answer === 2 || answer === 4 ? 0 : 1);
    assert.deepStrictEqual(records(), [{hwnd: target, msg: 0x21, wParam: target, lParam: 0x02010001}],
      'locally active background frame receives the query');
    assert.deepStrictEqual(hostCalls.filter(call => call[0] === 'activate'),
      answer <= 2 ? [['activate', target]] : [], 'only consent publishes desktop activation');
    assert.strictEqual(e.test_get_active(), target, 'desktop rejection does not erase local active state');
  }
  foreground = null;
  // Feed real renderer clicks through the compiled USER pump, then publish
  // accepted activation through the production desktop host. Geometry and
  // app tokens are synthetic; guest focus/callbacks and MA_* decisions are real.
  const r = harness.renderer;
  r.scheduleRepaint = () => {};
  r.repaint = () => {};
  const previousApp = { exports: {} };
  const clickApp = { exports: {
    get_focus_hwnd: e.get_focus_hwnd,
    set_focus: e.set_focus,
    wnd_get_style_export: e.wnd_get_style_export,
    send_message() { throw new Error('queued pointer must not call guest inline'); },
  }};
  inputRenderer = r;
  desktopHost = createWindowHost({ renderer: r }, {}).imports;
  for (const button of [0, 2]) for (const answer of [1, 2, 3, 4]) {
    const down = button === 2 ? 0x204 : 0x201;
    const up = down + 1;
    const query = e.guest_alloc(256) >>> 0;
    bytes.set(makeWndProc(observed, [0x83, 0x7c, 0x24, 8, 0x21, 0x75, 8,
      0xb8, ...u32(answer), 0xc2, 0x10, 0]), toWasm(query));
    const target = e.test_make_window(query, WS_VISIBLE, 0, 1);
    const old = { hwnd: focusA, visible: true, isChild: false,
      x: 350, y: 10, w: 200, h: 150, style: 0, zOrder: 10, wasm: previousApp };
    const clicked = { hwnd: target, visible: true, isChild: false,
      x: 10, y: 10, w: 200, h: 150, style: 0, zOrder: 1, wasm: clickApp };
    r.windows = { [focusA]: old, [target]: clicked };
    r._nextZ = 11;
    r._foregroundWindow = old;
    r.mainWasm = previousApp;
    r._setKeyboardInputOwner(old);
    r.inputQueue.length = 0;
    e.test_set_active(focusA, stack);
    e.test_focus_api(focusA, stack);
    e.test_mouse_clear_nc();
    resetRecords(); hostCalls.length = 0;
    let inputClock = 1000;
    r._inputNowMs = () => inputClock;
    r.handleMouseDown(40, 60, button);
    r.handleMouseUp(40, 60, button);
    assert.deepStrictEqual(r.inputQueue.map(event => event.msg), [0x84, down, up],
      `answer ${answer}: renderer queues hit-test/down/up`);
    assert.strictEqual(clicked.zOrder, 1, 'renderer cannot preempt USER z-order decision');
    assert.strictEqual(r._keyboardInputWasm, previousApp, 'renderer retains accepted keyboard app');
    assert.strictEqual(e.get_focus_hwnd(), focusA, 'renderer cannot preempt guest focus decision');
    assert.deepStrictEqual(records(), [], 'queueing invokes no guest focus callbacks');
    assert.strictEqual(e.test_mouse_pump(mouseMsg, stack, 1, 1, 0x84, 0x84), 1,
      'hit-test message precedes the activation-bearing down');
    assert.strictEqual(r._foregroundWindow, old, 'removing hit-test does not activate');
    assert.strictEqual(e.test_mouse_pump(mouseMsg, stack, 1, 1, down, down),
      answer === 2 || answer === 4 ? 0 : 1, `answer ${answer}: USER decides whether the queued down survives`);
    const activates = answer <= 2;
    assert.strictEqual(r._foregroundWindow, activates ? clicked : old,
      'desktop publication follows the guest MA_* answer');
    assert.strictEqual(r._keyboardInputWasm, activates ? clickApp : previousApp);
    assert.strictEqual(clicked.zOrder > old.zOrder, activates,
      'only accepted activation raises the clicked surface');
    if (!activates) assert.strictEqual(e.get_focus_hwnd(), focusA, 'activation veto retains guest focus');
    assert.strictEqual(records().filter(event => event.msg === 0x21).length, 1);
    assert.strictEqual(records().find(event => event.msg === 0x21).lParam, (down << 16) | 1,
      'activation query identifies the actual initiating button');
    // Since 37ff2f8d a release is never handed over in the pump that took its
    // press: the guest's next, empty poll ends that pump, then 30 ms of
    // input-clock time (renderer._inputNowMs) must pass.
    assert.strictEqual(e.test_mouse_pump(mouseMsg, stack, 1, 1, up, up), 0,
      'the queued release waits out the pump that took its press');
    inputClock += 30;
    assert.strictEqual(e.test_mouse_pump(mouseMsg, stack, 1, 1, up, up), 1,
      'even an eaten down retains its queued release');
  }
  assert(polledFocus.size > 1, 'input polls observe changing guest focus owners');
  console.log('PASS Set/GetActiveWindow and removal-time mouse activation');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
