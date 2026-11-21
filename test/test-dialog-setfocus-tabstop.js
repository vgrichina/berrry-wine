#!/usr/bin/env node

// Dialog focus rules: WM_INITDIALOG receives the first visible, enabled tab
// stop and a TRUE DLGPROC return applies that focus after initialization.
// DefDlgProc also moves focus from the dialog itself to its first tab stop on
// WM_SETFOCUS. Diablo's Enter Name dialog depends on the latter fallback.

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const apiTable = require('../src/api_table.json');
const { bootRenderHarness } = require('./render-helper');

const WS_CHILD_VISIBLE = 0x50000000;
const WS_TABSTOP = 0x00010000;
const WS_DISABLED = 0x08000000;
const WM_SETFOCUS = 0x0007;

const extraWat = String.raw`
  (func (export "test_focus_thunk") (param $id i32) (result i32)
    (local $p i32)
    (global.set $thunk_guest_base (call $w2g (global.get $THUNK_BASE)))
    (local.set $p (i32.add (global.get $THUNK_BASE)
      (i32.mul (global.get $num_thunks) (i32.const 8))))
    (i32.store (local.get $p) (i32.const 0))
    (i32.store offset=4 (local.get $p) (local.get $id))
    (global.set $num_thunks (i32.add (global.get $num_thunks) (i32.const 1)))
    (call $update_thunk_end)
    (call $w2g (local.get $p)))
  (func (export "test_setfocus_make_dialog") (result i32)
    (local $dlg i32)
    (local.set $dlg (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $dlg) (global.get $WNDPROC_CTRL_NATIVE))
    ;; WS_POPUP | WS_VISIBLE -- a top-level window whose children can be
    ;; effectively visible.
    (drop (call $wnd_set_style (local.get $dlg) (i32.const 0x90000000)))
    (local.get $dlg))

  (func (export "test_setfocus_add_child")
    (param $dlg i32) (param $id i32) (param $style i32) (result i32)
    (call $ctrl_create_child
      (local.get $dlg) (i32.const 2) (local.get $id)
      (i32.const 0) (i32.const 0) (i32.const 40) (i32.const 20)
      (local.get $style) (i32.const 0)))

  (func (export "test_focus_hwnd") (result i32) (global.get $focus_hwnd))

  (func (export "test_set_focus_hwnd") (param $hwnd i32)
    (global.set $focus_hwnd (local.get $hwnd)))

  (func (export "test_set_active_hwnd") (param $hwnd i32)
    (global.set $active_hwnd (local.get $hwnd)))

  (func (export "test_set_style") (param $hwnd i32) (param $style i32)
    (drop (call $wnd_set_style (local.get $hwnd) (local.get $style))))

  (func (export "test_first_tabstop") (param $dlg i32) (result i32)
    (call $dialog_first_init_tabstop (local.get $dlg)))

  ;; Model the stack left after a modeless DLGPROC returns from
  ;; WM_INITDIALOG. CACA0001 must consume the private marker/candidate, apply
  ;; the BOOL result, and still restore the ordinary saved return/HWND pair.
  (func (export "test_finish_modeless_init")
    (param $dlg i32) (param $candidate i32) (param $accepted i32)
    (param $stack i32) (result i32)
    (global.set $createwnd_implicit_show (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $gs32 (local.get $stack) (i32.const 0x44494643)) ;; "DIFC"
    (call $gs32 (i32.add (local.get $stack) (i32.const 4))
      (local.get $candidate))
    (call $gs32 (i32.add (local.get $stack) (i32.const 8))
      (i32.const 0x00405678))
    (call $gs32 (i32.add (local.get $stack) (i32.const 12))
      (local.get $dlg))
    (i32.store offset=0 (global.get $reg_base) (local.get $accepted))
    (i32.store (global.get $THUNK_BASE) (i32.const 0xCACA0001))
    (call $win32_dispatch (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_eip") (result i32) (global.get $eip))

  (func (export "test_call_DefDlgProcA")
    (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32)
    (result i32)
    (local $saved_esp i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_DefDlgProcA
      (local.get $hwnd) (local.get $msg) (local.get $wParam) (local.get $lParam)
      (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_set_dialog_proc") (param $hwnd i32) (param $proc i32)
    (call $wnd_table_set (local.get $hwnd) (global.get $WNDPROC_DIALOG))
    (drop (call $dialog_proc_set (local.get $hwnd) (local.get $proc))))

  (func (export "test_call_dialog_default_proc")
    (param $hwnd i32) (param $msg i32) (result i32)
    (call $dialog_default_proc
      (local.get $hwnd) (local.get $msg) (i32.const 0) (i32.const 0)))
`;

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat });
  const fixture = fs.readFileSync(path.join(__dirname, 'binaries', 'entertainment-pack', 'sol.exe'));
  new Uint8Array(memory.buffer).set(fixture, e.get_staging());
  assert(e.load_pe(fixture.length), 'initialize real x86 API/callback frames');

  // A dialog whose first child is not a tab stop: the focus skips it.
  const dlg = e.test_setfocus_make_dialog() >>> 0;
  const plain = e.test_setfocus_add_child(dlg, 100, WS_CHILD_VISIBLE) >>> 0;
  const field = e.test_setfocus_add_child(
    dlg, 101, WS_CHILD_VISIBLE | WS_TABSTOP) >>> 0;

  e.test_set_focus_hwnd(0);
  e.test_call_DefDlgProcA(dlg, WM_SETFOCUS, 0, 0);
  assert.strictEqual(e.test_focus_hwnd() >>> 0, field,
    'DefDlgProc WM_SETFOCUS focuses the first WS_TABSTOP child');
  assert.notStrictEqual(e.test_focus_hwnd() >>> 0, plain,
    'a child without WS_TABSTOP is not a focus candidate');

  // Calling it again is idempotent -- it must not hand the focus onward to a
  // later tab stop the way WM_NEXTDLGCTL would.
  e.test_call_DefDlgProcA(dlg, WM_SETFOCUS, 0, 0);
  assert.strictEqual(e.test_focus_hwnd() >>> 0, field,
    'a repeated WM_SETFOCUS leaves the focus where it is');

  // A disabled tab stop is skipped: USER will not focus a control the user
  // cannot reach with the Tab key either.
  const dlg2 = e.test_setfocus_make_dialog() >>> 0;
  e.test_setfocus_add_child(
    dlg2, 200, WS_CHILD_VISIBLE | WS_TABSTOP | WS_DISABLED);
  const enabled = e.test_setfocus_add_child(
    dlg2, 201, WS_CHILD_VISIBLE | WS_TABSTOP) >>> 0;

  e.test_set_focus_hwnd(0);
  e.test_call_DefDlgProcA(dlg2, WM_SETFOCUS, 0, 0);
  assert.strictEqual(e.test_focus_hwnd() >>> 0, enabled,
    'DefDlgProc WM_SETFOCUS skips a disabled tab stop');

  // No tab stop at all: WM_SETFOCUS falls through to DefWindowProc rather
  // than inventing a focus window.
  const dlg3 = e.test_setfocus_make_dialog() >>> 0;
  e.test_setfocus_add_child(dlg3, 300, WS_CHILD_VISIBLE);

  e.test_set_focus_hwnd(0);
  e.test_call_DefDlgProcA(dlg3, WM_SETFOCUS, 0, 0);
  assert.strictEqual(e.test_focus_hwnd() >>> 0, 0,
    'a dialog with no tab stop leaves the focus untouched');

  // WM_INITDIALOG's default-focus decision happens after the DLGPROC returns.
  // The first tab stop is passed before initialization and a TRUE return
  // accepts it.
  const candidate = e.test_first_tabstop(dlg) >>> 0;
  assert.strictEqual(candidate, field,
    'WM_INITDIALOG candidate is the first visible enabled tab stop');
  e.test_set_focus_hwnd(0);
  assert.strictEqual(
    e.test_finish_modeless_init(dlg, candidate, 1, 0x074ff000) >>> 0,
    dlg,
    'modeless continuation still returns the dialog HWND');
  assert.strictEqual(e.test_eip() >>> 0, 0x00405678,
    'modeless continuation restores the caller return address');
  assert.strictEqual(e.test_focus_hwnd() >>> 0, field,
    'TRUE from WM_INITDIALOG applies the default focus');

  // FALSE means the application chose focus itself; USER must not overwrite
  // that choice with wParam.
  e.test_set_focus_hwnd(plain);
  e.test_finish_modeless_init(dlg, candidate, 0, 0x074ff000);
  assert.strictEqual(e.test_focus_hwnd() >>> 0, plain,
    'FALSE from WM_INITDIALOG preserves application-assigned focus');

  // USER revalidates the candidate after initialization. If the callback
  // disables it, focus advances to the next eligible control.
  const next = e.test_setfocus_add_child(
    dlg, 102, WS_CHILD_VISIBLE | WS_TABSTOP) >>> 0;
  e.test_set_style(field, WS_CHILD_VISIBLE | WS_TABSTOP | WS_DISABLED);
  e.test_set_focus_hwnd(0);
  e.test_finish_modeless_init(dlg, candidate, 1, 0x074ff000);
  assert.strictEqual(e.test_focus_hwnd() >>> 0, next,
    'disabled WM_INITDIALOG candidate advances to the next tab stop');

  // SetFocus(dialog) enters USER's internal DefDlgProc dispatcher rather
  // than the exported DefDlgProcA thunk. A FALSE DLGPROC must still run the
  // same WM_SETFOCUS fallback. WinHelp uses exactly this path for its hidden
  // Contents page before showing it.
  const dlg4 = e.test_setfocus_make_dialog() >>> 0;
  e.test_setfocus_add_child(dlg4, 400, WS_CHILD_VISIBLE);
  const internalField = e.test_setfocus_add_child(
    dlg4, 401, WS_CHILD_VISIBLE | WS_TABSTOP) >>> 0;
  const imageBase = e.get_image_base() >>> 0;
  const guestBase = e.get_guest_base() >>> 0;
  const falseProc = e.guest_alloc(16) >>> 0;
  const trueProc = e.guest_alloc(16) >>> 0;
  const bytes = new Uint8Array(memory.buffer);
  bytes.set([0x31, 0xC0, 0xC2, 0x10, 0x00],
    falseProc - imageBase + guestBase); // xor eax,eax; ret 16
  bytes.set([0xB8, 0x01, 0x00, 0x00, 0x00, 0xC2, 0x10, 0x00],
    trueProc - imageBase + guestBase); // mov eax,1; ret 16

  e.test_set_dialog_proc(dlg4, falseProc);
  e.test_set_style(dlg4, 0x80000000); // WinHelp's hidden Contents page
  e.test_set_focus_hwnd(dlg4);
  e.test_call_dialog_default_proc(dlg4, WM_SETFOCUS);
  assert.strictEqual(e.test_focus_hwnd() >>> 0, internalField,
    'internal DefDlgProc fallback focuses first tab stop after FALSE');

  const dlg5 = e.test_setfocus_make_dialog() >>> 0;
  const handledField = e.test_setfocus_add_child(
    dlg5, 500, WS_CHILD_VISIBLE | WS_TABSTOP) >>> 0;
  e.test_set_dialog_proc(dlg5, trueProc);
  e.test_set_focus_hwnd(dlg5);
  e.test_call_dialog_default_proc(dlg5, WM_SETFOCUS);
  assert.notStrictEqual(handledField, dlg5);
  assert.strictEqual(e.test_focus_hwnd() >>> 0, dlg5,
    'handled WM_SETFOCUS does not run DefDlgProc tab-stop fallback');

  // Execute an actual guest wndproc which calls the imported DefDlgProcA
  // thunk. The focus callbacks therefore nest below a live x86 API frame,
  // rather than merely exercising an exported WAT helper.
  const u32 = n => [n, n >>> 8, n >>> 16, n >>> 24].map(n => n & 255);
  const view = new DataView(memory.buffer);
  const toWasm = n => n - imageBase + guestBase;
  const read32 = n => view.getUint32(toWasm(n), true);
  const write32 = (n, value) => view.setUint32(toWasm(n), value, true);
  const thunk = name => e.test_focus_thunk(apiTable.find(api => api.name === name).id) >>> 0;
  const defDlg = thunk('DefDlgProcA');
  const defWindow = thunk('DefWindowProcA');
  const setActive = thunk('SetActiveWindow');
  const setFocus = thunk('SetFocus');
  const destroy = thunk('DestroyWindow');
  const code = body => {
    const p = e.guest_alloc(body.length + 16) >>> 0;
    bytes.set(body, toWasm(p));
    return p;
  };
  const ret0 = [0x31, 0xc0, 0xc2, 0x10, 0x00];
  const makeTop = proc => {
    const h = e.test_setfocus_make_dialog() >>> 0;
    e.test_wnd_table_set(h, proc);
    return h;
  };
  const call1 = (fn, arg) => [0x68, ...u32(arg), 0xb8, ...u32(fn), 0xff, 0xd0];
  const observation = e.guest_alloc(64) >>> 0;
  const msgBuffer = e.guest_alloc(32) >>> 0;
  function liveDefault(dlg, after = []) {
    bytes.fill(0, toWasm(observation), toWasm(observation + 64));
    const proc = code([
      0x53, 0x56, 0x57, 0x55, // preserve caller EBX/ESI/EDI/EBP
      0xbb, ...u32(0x11223344), 0xbe, ...u32(0x22334455),
      0xbf, ...u32(0x33445566), 0xbd, ...u32(0x44556677),
      0x89, 0x25, ...u32(observation), // record live ESP
      0x6a, 0, 0x6a, 0, 0x6a, WM_SETFOCUS, 0x68, ...u32(dlg),
      0xb8, ...u32(defDlg), 0xff, 0xd0,
      0x89, 0x25, ...u32(observation + 4),
      0x89, 0x1d, ...u32(observation + 8),
      0x89, 0x35, ...u32(observation + 12),
      0x89, 0x3d, ...u32(observation + 16),
      0x89, 0x2d, ...u32(observation + 20),
      ...after, 0x5d, 0x5f, 0x5e, 0x5b, ...ret0,
    ]);
    const caller = makeTop(proc);
    const outerEsp = e.get_esp();
    e.send_message(caller, 0x0400, 0, 0);
    assert.strictEqual(e.get_esp(), outerEsp, 'nested sender restores its outer stack');
    assert(read32(observation), 'guest DefDlgProc caller actually ran');
    assert.strictEqual(read32(observation + 4), read32(observation),
      'DefDlgProc stdcall and nested focus callbacks preserve live guest ESP');
    assert.deepStrictEqual([8, 12, 16, 20].map(off => read32(observation + off)),
      [0x11223344, 0x22334455, 0x33445566, 0x44556677],
      'nested focus callbacks preserve guest nonvolatile registers');
  }
  function drainPosted() {
    const messages = [];
    while (e.test_shared_post_read(msgBuffer, 1)) {
      assert(messages.length < 64, 'bounded notification queue');
      const m = [0, 4, 8, 12].map(off => read32(msgBuffer + off));
      messages.push(m);
      e.send_message(...m);
    }
    return messages;
  }

  // A dialog's first child must receive focus before a later top-level
  // activation. Draining the old dialog's queue must not reclaim focus.
  const oldDialog = e.test_setfocus_make_dialog() >>> 0;
  e.test_setfocus_add_child(oldDialog, 600, WS_CHILD_VISIBLE | WS_TABSTOP);
  // This case expects default activation focus: delegate to DefWindowProc
  // rather than consuming WM_ACTIVATE with an unconditional zero return.
  const newWindow = makeTop(code([
    ...Array(4).fill([0xff, 0x74, 0x24, 16]).flat(),
    0xb8, ...u32(defWindow), 0xff, 0xd0, ...ret0,
  ]));
  e.test_set_focus_hwnd(oldDialog);
  e.set_post_queue_count(0);
  liveDefault(oldDialog, call1(setActive, newWindow));
  assert.strictEqual(e.test_focus_hwnd() >>> 0, newWindow);
  const pending = drainPosted();
  assert.strictEqual(e.test_focus_hwnd() >>> 0, newWindow,
    'old dialog notifications cannot steal the newly active window focus');
  assert(!pending.some(m => m[1] === 7 || m[1] === 8),
    'default tab-stop focus notifications complete synchronously');

  const hiddenDialog = e.test_setfocus_make_dialog() >>> 0;
  const hiddenChild = e.test_setfocus_add_child(hiddenDialog, 650,
    WS_CHILD_VISIBLE | WS_TABSTOP) >>> 0;
  e.test_set_style(hiddenDialog, 0x80000000);
  const hiddenNotified = e.guest_alloc(4) >>> 0;
  write32(hiddenNotified, 0);
  e.test_wnd_table_set(hiddenChild, code([
    0x83, 0x7c, 0x24, 8, 7, 0x75, 6,
    0xff, 0x05, ...u32(hiddenNotified), ...ret0,
  ]));
  e.test_set_focus_hwnd(hiddenDialog);
  e.set_post_queue_count(0);
  liveDefault(hiddenDialog);
  assert.strictEqual(read32(hiddenNotified), 1,
    'hidden-page tab stop receives SETFOCUS before guest DefDlgProc returns');
  assert.strictEqual(e.test_focus_hwnd() >>> 0, hiddenChild,
    'hidden WinHelp-style ancestor does not invalidate its eligible tab stop');
  assert(!drainPosted().some(m => m[1] === 7 || m[1] === 8));

  // Reentry from KILLFOCUS may redirect focus or destroy the pending target.
  // The outer dialog transaction must honor that winner/lifetime change.
  for (const action of ['redirect', 'destroy']) {
    const dialog = e.test_setfocus_make_dialog() >>> 0;
    const target = e.test_setfocus_add_child(dialog, 700, WS_CHILD_VISIBLE | WS_TABSTOP) >>> 0;
    const chosen = e.test_setfocus_add_child(dialog, 701, WS_CHILD_VISIBLE | WS_TABSTOP) >>> 0;
    const seen = e.guest_alloc(16) >>> 0;
    write32(seen, 0);
    write32(seen + 4, 1);
    const countSetFocus = [0x83, 0x7c, 0x24, 8, 7, 0x75, 6,
      0xff, 0x05, ...u32(seen), ...ret0];
    e.test_wnd_table_set(target, code(countSetFocus));
    const nested = [0xc7, 0x05, ...u32(seen + 4), ...u32(0),
      ...call1(action === 'redirect' ? setFocus : destroy, action === 'redirect' ? chosen : target)];
    const onKill = [0x83, 0x7c, 0x24, 8, 8, 0x75, nested.length, ...nested];
    const old = makeTop(code([0x83, 0x3d, ...u32(seen + 4), 0,
      0x74, onKill.length, ...onKill, ...ret0]));
    // Isolate redirection within an already active dialog. Activating an
    // inactive dialog during SetFocus legitimately focuses its first child
    // before transferring onward; that is a separate activation contract.
    e.test_set_active_hwnd(dialog);
    e.test_set_focus_hwnd(old);
    e.set_post_queue_count(0);
    liveDefault(dialog);
    assert.strictEqual(read32(seen + 4), 0, `${action}: KILLFOCUS ran before API returned`);
    assert.strictEqual(read32(seen), 0, `${action}: superseded target gets no stale SETFOCUS`);
    assert.notStrictEqual(e.test_focus_hwnd() >>> 0, target);
    if (action === 'redirect') assert.strictEqual(e.test_focus_hwnd() >>> 0, chosen);
    else assert.strictEqual(e.wnd_get_proc_export(target), 0, 'destroyed target stays gone');
    assert(!drainPosted().some(m => m[1] === 7 || m[1] === 8));
  }

  console.log('PASS  dialog initialization and DefDlgProc assign Win98 tab-stop focus');
})().catch(err => {
  console.error(err && err.stack || err);
  process.exit(1);
});
