#!/usr/bin/env node
'use strict';

// EndDialog destroys the dialog with the same window lifecycle as
// DestroyWindow. Storm's SDlgEndDialog uses it for modeless nested dialogs and
// depends on WM_DESTROY/WM_NCDESTROY before the owner continues.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

const ROOT = path.join(__dirname, '..');
const extraWat = String.raw`
  (func (export "test_make_owner") (param $proc i32) (result i32)
    (local $h i32)
    (local.set $h (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (local.get $h) (i32.const 1)))
    (call $wnd_table_set (local.get $h) (local.get $proc))
    (drop (call $wnd_set_style (local.get $h) (i32.const 0x10000000)))
    (local.get $h))
  (func (export "test_assign_owner") (param $dlg i32) (param $owner i32)
    (call $wnd_set_owner (local.get $dlg) (local.get $owner))
    (global.set $focus_hwnd (i32.const 0)))
  (func (export "test_finish_common") (param $dlg i32) (param $stack i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (i32.store offset=12 (global.get $reg_base) (i32.const 11))
    (i32.store offset=24 (global.get $reg_base) (i32.const 22))
    (i32.store offset=28 (global.get $reg_base) (i32.const 33))
    (i32.store offset=20 (global.get $reg_base) (i32.const 44))
    (call $gs32 (local.get $stack) (i32.const 0x405678))
    (call $modal_begin (local.get $dlg) (i32.const 20))
    (call $modal_done (i32.const 42))
    (i32.store (global.get $THUNK_BASE) (i32.const 0xCACA0006))
    (call $win32_dispatch (i32.const 0)))
  (func (export "test_set_child_proc") (param $h i32) (param $proc i32)
    (call $wnd_table_set (local.get $h) (local.get $proc)))
  (func (export "test_clobber_modal_completion") (param $nested i32)
    (global.set $dlg_pump_hwnd (local.get $nested))
    (global.set $dlg_result (i32.const 99))
    (global.set $dlg_ret_addr (i32.const 0x405999)))

  (func (export "test_finish_modal") (param $dlg i32) (param $stack i32)
    (global.set $dlg_pump_hwnd (local.get $dlg))
    (global.set $dlg_init_focus_hwnd (i32.const 0))
    (global.set $dlg_ended (i32.const 1))
    (global.set $dlg_result (i32.const 42))
    (global.set $dlg_ret_addr (i32.const 0x405678))
    (i32.store (global.get $SHARED_DLG_ENDED) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (memory.fill (call $g2w (local.get $stack)) (i32.const 0) (i32.const 24))
    (i32.store (global.get $THUNK_BASE) (i32.const 0xCACA0004))
    (call $win32_dispatch (i32.const 0)))
  (func (export "test_create_modeless_dialog")
    (param $dlgproc i32) (result i64)
    (local $dlg i32) (local $child i32)
    (local.set $dlg (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $dlg) (global.get $WNDPROC_DIALOG))
    (drop (call $wnd_set_style (local.get $dlg) (i32.const 0x90000000)))
    (drop (call $dialog_proc_set (local.get $dlg) (local.get $dlgproc)))
    (local.set $child (call $ctrl_create_child
      (local.get $dlg) (i32.const 1) (i32.const 1062)
      (i32.const 0) (i32.const 0) (i32.const 100) (i32.const 24)
      (i32.const 0x5001400b) (i32.const 0)))
    (i64.or (i64.extend_i32_u (local.get $dlg))
      (i64.shl (i64.extend_i32_u (local.get $child)) (i64.const 32))))

  (func (export "test_call_EndDialog") (param $hwnd i32) (param $result i32)
    (local $saved_esp i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_EndDialog
      (local.get $hwnd) (local.get $result)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp)))

  ;; DialogBoxParamA writes both the instance global and its shared-memory
  ;; mirror; EndDialog reads the mirror, because the thread that calls it is
  ;; not always the thread running the pump.
  (func (export "test_set_modal_dialog") (param $hwnd i32)
    (global.set $dlg_pump_hwnd (local.get $hwnd))
    (i32.store (global.get $SHARED_DLG_PUMP_HWND) (local.get $hwnd)))

  (func (export "test_yield_flag") (result i32)
    (global.get $yield_flag))

  (func (export "test_window_exists") (param $hwnd i32) (result i32)
    (i32.ge_s (call $wnd_table_find (local.get $hwnd)) (i32.const 0)))

  (func (export "test_dlg_result") (result i32)
    (global.get $dlg_result))

  ;; Reset the shared mirrors too, not just this instance's globals: EndDialog
  ;; makes both of its decisions -- "is this the pump's dialog" and "has one
  ;; already ended" -- off the mirrors, so a stale mirror from the previous
  ;; case would make the next EndDialog a no-op.
  (func (export "test_reset_modal") (param $hwnd i32)
    (global.set $dlg_pump_hwnd (local.get $hwnd))
    (global.set $dlg_ended (i32.const 0))
    (global.set $dlg_result (i32.const 0))
    (global.set $yield_flag (i32.const 0))
    (i32.store (global.get $SHARED_DLG_PUMP_HWND) (local.get $hwnd))
    (i32.store (global.get $SHARED_DLG_ENDED) (i32.const 0))
    (i32.store (global.get $SHARED_DLG_RESULT) (i32.const 0)))

  ;; Hand the guest a callable EndDialog: a bare import thunk carrying the API
  ;; id, so an x86 DLGPROC can re-enter the handler the way a real one does.
  (func (export "test_make_api_thunk") (param $api_id i32) (result i32)
    (local $addr i32)
    (local.set $addr (i32.add (global.get $THUNK_BASE)
      (i32.mul (global.get $num_thunks) (i32.const 8))))
    (i32.store (local.get $addr) (i32.const 0))
    (i32.store offset=4 (local.get $addr) (local.get $api_id))
    (global.set $num_thunks (i32.add (global.get $num_thunks) (i32.const 1)))
    (call $update_thunk_end)
    (i32.add (i32.sub (local.get $addr) (global.get $GUEST_BASE))
             (global.get $image_base)))
`;

function u32(value) {
  return [value, value >>> 8, value >>> 16, value >>> 24].map(v => v & 0xff);
}

(async () => {
  let onTick = () => 0;
  let onInvalidate = () => {};
  const { exports: e, memory } = await bootRenderHarness({ extraWat,
    extraHostOverrides: { get_ticks: () => onTick(), invalidate: hwnd => onInvalidate(hwnd) } });
  const fixture = fs.readFileSync(path.join(ROOT, 'test', 'binaries', 'calc.exe'));
  new Uint8Array(memory.buffer).set(fixture, e.get_staging());
  assert(e.load_pe(fixture.length), 'fixture PE initializes x86 callback support');

  const imageBase = e.get_image_base() >>> 0;
  const guestBase = e.get_guest_base() >>> 0;
  const toWasm = guest => (guest - imageBase + guestBase) >>> 0;
  const bytes = new Uint8Array(memory.buffer);
  const view = new DataView(memory.buffer);
  const seen = e.guest_alloc(4) >>> 0;
  const proc = e.guest_alloc(64) >>> 0;

  // DLGPROC(hwnd,msg,wParam,lParam): OR bit 0 for WM_DESTROY and bit 1 for
  // WM_NCDESTROY, then return TRUE.
  bytes.set(Uint8Array.from([
    0x8b, 0x44, 0x24, 0x08,
    0x83, 0xf8, 0x02,
    0x75, 0x07,
    0x83, 0x0d, ...u32(seen), 0x01,
    0x3d, 0x82, 0x00, 0x00, 0x00,
    0x75, 0x07,
    0x83, 0x0d, ...u32(seen), 0x02,
    0xb8, 0x01, 0x00, 0x00, 0x00,
    0xc2, 0x10, 0x00,
  ]), toWasm(proc));

  const packed = BigInt.asUintN(64, e.test_create_modeless_dialog(proc));
  const dialog = Number(packed & 0xffffffffn) >>> 0;
  const child = Number(packed >> 32n) >>> 0;
  assert(dialog && child, 'modeless dialog and focused child were created');

  e.send_message(child, 0x0007, 0, 0); // WM_SETFOCUS
  assert.strictEqual(e.get_focus_hwnd() >>> 0, child,
    'dialog child owns focus before EndDialog');

  e.test_call_EndDialog(dialog, 1062);
  assert.strictEqual(view.getUint32(toWasm(seen), true), 3,
    'EndDialog delivers WM_DESTROY and WM_NCDESTROY to the dialog procedure');
  assert.strictEqual(e.test_window_exists(child), 0,
    'EndDialog recursively destroys child controls');
  assert.strictEqual(e.test_window_exists(dialog), 0,
    'EndDialog destroys the dialog record');
  assert.strictEqual(e.get_focus_hwnd() >>> 0, 0,
    'EndDialog clears focus held by a destroyed child');
  assert.strictEqual(e.test_yield_flag(), 0,
    'modeless EndDialog does not abandon its synchronous native call stack');

  const modalPacked = BigInt.asUintN(64, e.test_create_modeless_dialog(proc));
  const modalDialog = Number(modalPacked & 0xffffffffn) >>> 0;
  e.test_set_modal_dialog(modalDialog);
  e.test_call_EndDialog(modalDialog, 42);
  assert.strictEqual(e.test_yield_flag(), 1,
    'active Wine Assembly modal EndDialog yields to its dialog pump');
  assert.strictEqual(e.test_window_exists(modalDialog), 1,
    'a modal EndDialog only records the result; the CACA0004 pump destroys it');

  // Disk Cleanup's drive-picker answers WM_DESTROY with EndDialog(hDlg,
  // IDCANCEL). Deferring the modal teardown to the pump keeps that reentry
  // from happening at all inside EndDialog, and the IDOK the user chose must
  // survive as the recorded result.
  const END_DIALOG_API_ID = 131;
  const endDialogThunk = e.test_make_api_thunk(END_DIALOG_API_ID) >>> 0;
  const reentrant = e.guest_alloc(64) >>> 0;
  bytes.set(Uint8Array.from([
    0x8b, 0x44, 0x24, 0x08,             // mov eax,[esp+8]   ; msg
    0x83, 0xf8, 0x02,                   // cmp eax,2         ; WM_DESTROY
    0x75, 0x0d,                         // jne +13
    0x8b, 0x4c, 0x24, 0x04,             // mov ecx,[esp+4]   ; hwnd
    0x6a, 0x02,                         // push IDCANCEL
    0x51,                               // push hwnd
    0xb8, ...u32(endDialogThunk),       // mov eax, EndDialog
    0xff, 0xd0,                         // call eax
    0xb8, 0x01, 0x00, 0x00, 0x00,       // mov eax,1
    0xc2, 0x10, 0x00,                   // ret 0x10
  ]), toWasm(reentrant));

  const reentrantPacked = BigInt.asUintN(64, e.test_create_modeless_dialog(reentrant));
  const reentrantDialog = Number(reentrantPacked & 0xffffffffn) >>> 0;
  e.test_reset_modal(reentrantDialog);
  e.test_call_EndDialog(reentrantDialog, 1); // IDOK
  assert.strictEqual(e.test_window_exists(reentrantDialog), 1,
    'the modal dialog outlives EndDialog; its pump tears it down after the DLGPROC returns');
  assert.strictEqual(e.test_dlg_result(), 1,
    'the first EndDialog result wins over one raised from WM_DESTROY');

  // The same DLGPROC as a *modeless* dialog still gets the inline recursive
  // teardown, and the WM_DESTROY reentry must not recurse or overwrite IDOK.
  const modelessReentrantPacked =
    BigInt.asUintN(64, e.test_create_modeless_dialog(reentrant));
  const modelessReentrant = Number(modelessReentrantPacked & 0xffffffffn) >>> 0;
  e.test_reset_modal(0);
  e.test_call_EndDialog(modelessReentrant, 1); // IDOK
  assert.strictEqual(e.test_window_exists(modelessReentrant), 0,
    'a modeless DLGPROC that calls EndDialog from WM_DESTROY still gets torn down once');

  // A child WM_DESTROY calls GetTickCount, whose test host reenters USER.
  // Simulate the writes of a nested modal completion, not an entire second
  // dialog loop: the outer call must retain its HWND, result and return PC.
  const retiringPacked = BigInt.asUintN(64, e.test_create_modeless_dialog(proc));
  const retiring = Number(retiringPacked & 0xffffffffn) >>> 0;
  const retiringChild = Number(retiringPacked >> 32n) >>> 0;
  const nestedPacked = BigInt.asUintN(64, e.test_create_modeless_dialog(proc));
  const nested = Number(nestedPacked & 0xffffffffn) >>> 0;
  const completionStack = (e.guest_alloc(8192) + 4096) >>> 0;
  const apiTable = require('../src/api_table.json');
  const tickThunk = e.test_make_api_thunk(apiTable.find(a => a.name === 'GetTickCount').id);
  const teardownProc = e.guest_alloc(64) >>> 0;
  bytes.set(Uint8Array.from([0xb8, ...u32(tickThunk), 0xff, 0xd0,
    0x31, 0xc0, 0xc2, 0x10, 0]), toWasm(teardownProc));
  e.test_set_child_proc(retiringChild, teardownProc);
  let reentries = 0;
  onTick = () => {
    if (!reentries) {
      reentries++;
      e.test_clobber_modal_completion(nested);
    }
    return 1000;
  };
  e.test_finish_modal(retiring, completionStack);
  assert.strictEqual(reentries, 1);
  assert.strictEqual(e.test_window_exists(retiring), 0, 'teardown removes the retiring HWND');
  assert.strictEqual(e.test_window_exists(nested), 1, 'nested HWND is not mistaken for the retiring dialog');
  assert.strictEqual(e.get_eax(), 42, 'retiring DialogBox keeps its own result');
  assert.strictEqual(e.get_eip(), 0x405678, 'retiring DialogBox keeps its own return address');
  assert.strictEqual(e.get_esp(), completionStack + 24, 'modal completion consumes its own frame');
  // Now exercise an actual nested dialog, without host mutation: the outer
  // child's WM_DESTROY opens DialogBoxIndirectParamA, whose WM_INITDIALOG
  // ends it with 99. Its result must return to the child before outer teardown
  // completes with 42.
  onTick = () => 1000;
  const dialogThunk = e.test_make_api_thunk(apiTable.find(a => a.name === 'DialogBoxIndirectParamA').id);
  const nestedEndThunk = e.test_make_api_thunk(apiTable.find(a => a.name === 'EndDialog').id);
  const template = e.guest_alloc(64) >>> 0;
  bytes.fill(0, toWasm(template), toWasm(template) + 64);
  view.setUint32(toWasm(template), 0x80000000, true); // WS_POPUP, empty DLGTEMPLATE
  view.setUint16(toWasm(template) + 14, 80, true);
  view.setUint16(toWasm(template) + 16, 40, true);
  const nestedSeen = e.guest_alloc(8) >>> 0;
  const nestedProc = e.guest_alloc(128) >>> 0;
  const closeNested = [
    0x8b, 0x44, 0x24, 4, 0xa3, ...u32(nestedSeen),
    0x6a, 99, 0x50, 0xb8, ...u32(nestedEndThunk), 0xff, 0xd0,
  ];
  bytes.set(Uint8Array.from([
    0x81, 0x7c, 0x24, 8, ...u32(0x110), 0x75, closeNested.length,
    ...closeNested, 0x31, 0xc0, 0xc2, 0x10, 0,
  ]), toWasm(nestedProc));
  const openNestedProc = e.guest_alloc(128) >>> 0;
  const openNestedBody = [
    0x6a, 0, 0x68, ...u32(nestedProc), 0x6a, 0,
    0x68, ...u32(template), 0x6a, 0,
    0xb8, ...u32(dialogThunk), 0xff, 0xd0,
    0xa3, ...u32(nestedSeen + 4),
  ];
  bytes.set(Uint8Array.from([...openNestedBody, 0x31, 0xc0, 0xc2, 0x10, 0]), toWasm(openNestedProc));
  const outerPacked = BigInt.asUintN(64, e.test_create_modeless_dialog(proc));
  const outer = Number(outerPacked & 0xffffffffn) >>> 0;
  e.test_set_child_proc(Number(outerPacked >> 32n) >>> 0, openNestedProc);
  e.test_finish_modal(outer, completionStack);
  const nestedHwnd = view.getUint32(toWasm(nestedSeen), true);
  assert(nestedHwnd, 'nested guest DLGPROC received WM_INITDIALOG');
  assert.strictEqual(view.getUint32(toWasm(nestedSeen + 4), true), 99,
    'nested DialogBox returns its own result to the teardown callback');
  assert.strictEqual(e.test_window_exists(nestedHwnd), 0);
  assert.strictEqual(e.test_window_exists(outer), 0);
  assert.strictEqual(e.get_eax(), 42);
  assert.strictEqual(e.get_eip(), 0x405678);
  assert.strictEqual(e.get_esp(), completionStack + 24);
  const ownerProc = e.guest_alloc(128) >>> 0;
  bytes.set(Uint8Array.from([
    0x83, 0x7c, 0x24, 8, 7, 0x75, openNestedBody.length,
    ...openNestedBody, 0x31, 0xc0, 0xc2, 0x10, 0,
  ]), toWasm(ownerProc));
  const owner = e.test_make_owner(ownerProc);
  for (const common of [false, true]) {
    const packed = BigInt.asUintN(64, e.test_create_modeless_dialog(proc));
    const dialog = Number(packed & 0xffffffffn) >>> 0;
    view.setUint32(toWasm(nestedSeen), 0, true);
    view.setUint32(toWasm(nestedSeen + 4), 0, true);
    e.test_assign_owner(dialog, owner);
    if (common) e.test_finish_common(dialog, completionStack);
    else e.test_finish_modal(dialog, completionStack);
    const childDialog = view.getUint32(toWasm(nestedSeen), true);
    assert(childDialog, `common=${common}: owner focus opened an actual nested dialog`);
    assert.strictEqual(view.getUint32(toWasm(nestedSeen + 4), true), 99);
    assert.strictEqual(e.test_window_exists(childDialog), 0);
    assert.strictEqual(e.test_window_exists(dialog), 0);
    assert.strictEqual(e.test_window_exists(owner), 1);
    assert.strictEqual(e.get_eax(), 42);
    assert.strictEqual(e.get_eip(), 0x405678);
    assert.strictEqual(e.get_esp(), completionStack + (common ? 20 : 24));
  }
  // Common dialog inside common dialog: the owner's guest callback calls
  // MessageBoxA. Once its modal pump paints, the host supplies the real OK
  // command (no mutation of saved modal globals).
  const messageThunk = e.test_make_api_thunk(apiTable.find(a => a.name === 'MessageBoxA').id);
  const text = e.guest_alloc(16) >>> 0;
  bytes.set(Buffer.from('nested\0'), toWasm(text));
  const commonOwnerProc = e.guest_alloc(128) >>> 0;
  const openMessage = [
    0x53, 0x56, 0x57, 0x55, // preserve the owner's callee-saved registers
    0xbb, ...u32(111), 0xbe, ...u32(222), 0xbf, ...u32(333), 0xbd, ...u32(444),
    0x6a, 0, 0x68, ...u32(text), 0x68, ...u32(text), 0x6a, 0,
    0xb8, ...u32(messageThunk), 0xff, 0xd0, 0xa3, ...u32(nestedSeen + 4),
    0x5d, 0x5f, 0x5e, 0x5b,
  ];
  bytes.set(Uint8Array.from([0x83, 0x7c, 0x24, 8, 7, 0x75, openMessage.length,
    ...openMessage, 0x31, 0xc0, 0xc2, 0x10, 0]), toWasm(commonOwnerProc));
  const commonOwner = e.test_make_owner(commonOwnerProc);
  const commonOuter = Number(BigInt.asUintN(64, e.test_create_modeless_dialog(proc)) & 0xffffffffn);
  e.test_assign_owner(commonOuter, commonOwner);
  let accepted = 0;
  onInvalidate = () => {
    const dialog = e.modal_dialog_hwnd();
    if (dialog && dialog !== commonOuter && !accepted) {
      accepted = dialog;
      e.send_message(dialog, 0x111, 1, 0);
    }
  };
  view.setUint32(toWasm(nestedSeen + 4), 0, true);
  e.test_finish_common(commonOuter, completionStack);
  assert(accepted, 'nested MessageBox reached its own modal pump');
  assert.strictEqual(view.getUint32(toWasm(nestedSeen + 4), true), 1, 'nested MessageBox returns IDOK');
  assert.strictEqual(e.test_window_exists(accepted), 0);
  assert.strictEqual(e.test_window_exists(commonOuter), 0);
  assert.strictEqual(e.modal_dialog_hwnd(), 0, 'nested focus callback cannot resurrect the completed outer pump');
  assert.strictEqual(e.get_eax(), 42);
  assert.strictEqual(e.get_eip(), 0x405678);
  assert.strictEqual(e.get_esp(), completionStack + 20);
  assert.deepStrictEqual([e.get_ebx(), e.get_esi(), e.get_edi(), e.get_ebp()],
    [11, 22, 33, 44], 'outer common call restores its registers, not the nested MessageBox registers');
  console.log('PASS  EndDialog lifecycle and actual nested guest/common dialog completion');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
