'use strict';

// Exercise USER's real controls, dialog key routing and modal interpreter
// continuations. The only guest code is an isolated synthetic DLGPROC.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "t_messagebox") (param $owner i32) (param $text i32)
      (param $caption i32) (param $stack i32) (param $ret i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $gs32 (local.get $stack) (local.get $ret))
    (call $handle_MessageBoxA (local.get $owner) (local.get $text)
      (local.get $caption) (i32.const 3) (i32.const 0) (i32.const 0))
    (global.get $modal_dlg_hwnd))
  (func (export "t_show") (param $hwnd i32)
    (drop (call $wnd_set_style (local.get $hwnd)
      (i32.or (call $wnd_get_style (local.get $hwnd)) (i32.const 0x10000000))))
    (call $host_register_dialog_frame (local.get $hwnd) (i32.const 0) (i32.const 0)
      (i32.const 360) (i32.const 240) (i32.const 0))
    (call $defwndproc_do_nccalcsize (local.get $hwnd))
    (drop (call $host_erase_background (local.get $hwnd) (i32.const 16))))
  (func (export "t_child") (param $dlg i32) (param $id i32) (result i32)
    (call $ctrl_find_by_id (local.get $dlg) (local.get $id)))
  (func (export "t_xy") (param $hwnd i32) (result i32)
    (call $ctrl_get_xy_packed (local.get $hwnd)))
  (func (export "t_exists") (param $hwnd i32) (result i32)
    (i32.ne (call $wnd_table_get (local.get $hwnd)) (i32.const 0)))
  (func (export "t_frame_proc") (param $hwnd i32) (param $proc i32)
    (call $wnd_table_set (local.get $hwnd) (local.get $proc)))
  (func (export "t_dialog") (param $template i32) (param $proc i32)
      (param $owner i32) (param $stack i32) (param $ret i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $gs32 (local.get $stack) (local.get $ret))
    (call $handle_DialogBoxIndirectParamA (i32.const 0) (local.get $template)
      (local.get $owner) (local.get $proc) (i32.const 0) (i32.const 0)))
  (func (export "t_button") (param $dlg i32) (param $id i32) (param $text i32) (result i32)
    (call $ctrl_create_child (local.get $dlg) (i32.const 1) (local.get $id)
      (i32.const 12) (i32.const 12) (i32.const 72) (i32.const 24)
      (i32.const 0x50010001) (local.get $text)))
  (func (export "t_thunk") (param $id i32) (result i32)
    (local $addr i32)
    (local.set $addr (i32.add (global.get $THUNK_BASE)
      (i32.mul (global.get $num_thunks) (i32.const 8))))
    (i32.store (local.get $addr) (i32.const 0))
    (i32.store offset=4 (local.get $addr) (local.get $id))
    (global.set $num_thunks (i32.add (global.get $num_thunks) (i32.const 1)))
    (call $update_thunk_end)
    (call $w2g (local.get $addr)))
`;
const u32 = n => [n, n >>> 8, n >>> 16, n >>> 24].map(x => x & 255);

(async () => {
  const { exports: e, memory, canvas, renderer } = await bootRenderHarness({ extraWat });
  const pe = fs.readFileSync(path.join(__dirname, 'binaries/calc.exe'));
  new Uint8Array(memory.buffer).set(pe, e.get_staging());
  assert(e.load_pe(pe.length), 'loader initializes real interpreter continuations');
  const addr = p => p - e.get_image_base() + e.get_guest_base();
  const bytes = new Uint8Array(memory.buffer), view = new DataView(memory.buffer);
  const alloc = n => e.guest_alloc(n) >>> 0;
  const string = s => { const p = alloc(s.length + 1); bytes.set(Buffer.from(s + '\0'), addr(p)); return p; };
  const read = p => view.getUint32(addr(p), true);
  const text = string('Save changes to Document?'), caption = string('Native modal command');
  const stack = alloc(16384) + 8192, ret = alloc(16);
  bytes.set([0xeb, 0xfe], addr(ret)); // park the synthetic caller after API return
  const edit = e.test_create_edit(0, 0, 200, 24, 0x50000000, string('document text'));
  const owner = e.wnd_get_parent(edit);
  e.t_show(owner);
  assert(renderer.windows[owner]?.visible, 'document frame is shown behind dialogs');
  e.send_message(edit, 0xf, 0, 0);
  const selection = () => [e.get_edit_sel_start(edit), e.get_edit_cursor(edit)];
  const prepareEdit = () => {
    e.send_message(edit, 0xb1, 3, 3);
    e.set_focus(edit);
    assert.equal(e.edit_command_target(), edit);
    assert.equal(e.wnd_first_visible_control_class(2), edit);
    assert.deepEqual(selection(), [3, 3]);
  };
  const turn = () => { e.clear_yield(); e.run(10000); };
  const paint = () => { for (let i = 0; i < 32 && e.get_yield_reason() !== 15; i++) turn(); };
  const click = (dlg, id) => {
    const button = e.t_child(dlg, id);
    assert(button, `real button ${id}`);
    const xy = e.t_xy(button), lp = (((xy >>> 16) + 5) << 16) | ((xy & 65535) + 5);
    assert.equal(e.dialog_route_mouse(dlg, 0x201, 1, lp), 1);
    assert(e.button_get_flags(button) & 1, 'native BUTTON records the press');
    assert.equal(e.dialog_route_mouse(dlg, 0x202, 0, lp), 1);
    return button;
  };
  const complete = (expected, adjust) => {
    turn();
    assert.equal(e.get_eax(), expected, 'modal result reaches the actual caller');
    assert.equal(e.get_esp(), stack + adjust, 'API consumes its own stack frame');
    assert.deepEqual(selection(), [3, 3], 'dialog command preserves document selection');
  };
  for (const [route, id] of [['mouse', 7], ['mouse', 6], ['mouse', 2],
    ['button-space', 7], ['button-space', 6], ['button-space', 2],
    ['space', 7], ['enter', 6], ['escape', 2], ['close', 2]]) {
    prepareEdit();
    const dlg = e.t_messagebox(owner, text, caption, stack, ret);
    assert(dlg && e.t_exists(dlg));
    paint();
    assert.equal(e.modal_dialog_hwnd(), dlg);
    assert(renderer.windows[dlg]?.visible, 'native dialog is shown to renderer');
    if (process.env.WINE_MODAL_CAPTURE && route === 'mouse' && id === 7) {
      renderer.repaint();
      fs.writeFileSync(process.env.WINE_MODAL_CAPTURE + '.messagebox.png', canvas.toBuffer('image/png'));
    }
    if (route === 'mouse') click(dlg, id);
    else if (route === 'button-space') {
      const child = e.t_child(dlg, id);
      e.set_focus(child);
      e.send_message(child, 0x100, 32, 0);
      assert(e.button_get_flags(child) & 1, 'native keyboard press sets BUTTON state');
      e.send_message(child, 0x101, 32, 0);
    }
    else if (route === 'close') e.send_message(dlg, 0x10, 0, 0);
    else {
      if (route === 'space') e.set_focus(e.t_child(dlg, id));
      assert.equal(e.dialog_handle_key(dlg, { space: 32, enter: 13, escape: 27 }[route], 0), 1);
    }
    complete(id, 20);
    assert.equal(e.t_exists(dlg), 0);
    assert.equal(e.modal_dialog_hwnd(), 0);
    console.log(`PASS MessageBox ${route} ${id}`);
  }

  // A press can outlive its dialog: Esc retires the controls before the
  // physical release arrives. Old HWND-targeted input must not answer the
  // replacement modal or alter the document.
  prepareEdit();
  const retired = e.t_messagebox(owner, text, caption, stack, ret);
  paint();
  const retiredButton = e.t_child(retired, 7), xy = e.t_xy(retiredButton);
  const lp = (((xy >>> 16) + 5) << 16) | ((xy & 65535) + 5);
  assert.equal(e.dialog_route_mouse(retired, 0x201, 1, lp), 1);
  assert(e.button_get_flags(retiredButton) & 1);
  e.dialog_handle_key(retired, 27, 0);
  complete(2, 20);
  const replacement = e.t_messagebox(owner, text, caption, stack, ret);
  paint();
  e.dialog_route_mouse(retired, 0x202, 0, lp);
  e.send_message(retiredButton, 0x101, 32, 0);
  e.dialog_handle_key(retired, 32, 0);
  turn();
  assert.equal(e.modal_dialog_hwnd(), replacement, 'retired input cannot answer new modal');
  assert.equal(e.t_exists(replacement), 1);
  assert.deepEqual(selection(), [3, 3]);
  click(replacement, 6);
  complete(6, 20);
  console.log('PASS delayed button/key release after modal retirement');

  // A real #32770 dialog has ctrl_class=0 and a DefDlgProc marker. Its
  // native BUTTON must retain command 7 even with a visible EDIT behind it.
  const seen = alloc(16), proc = alloc(128), template = alloc(64);
  bytes.fill(0, addr(template), addr(template) + 64);
  view.setUint32(addr(template), 0x90c80000, true);
  view.setUint16(addr(template) + 14, 160, true);
  view.setUint16(addr(template) + 16, 70, true);
  const end = e.t_thunk(require('../src/api_table.json').find(x => x.name === 'EndDialog').id);
  // Record HWND on WM_INITDIALOG, record WM_COMMAND and close through the
  // actual EndDialog API. No expected values are injected into USER state.
  bytes.set([
    0x81,0x7c,0x24,8,...u32(0x110),0x75,9,
    0x8b,0x44,0x24,4,0xa3,...u32(seen),
    0x81,0x7c,0x24,8,...u32(0x111),0x75,21,
    0x8b,0x44,0x24,12,0xa3,...u32(seen+4),
    0x50,0xff,0x74,0x24,8,0xb8,...u32(end),0xff,0xd0,
    0xb8,1,0,0,0,0xc2,16,0,
  ], addr(proc));
  prepareEdit();
  e.t_dialog(template, proc, owner, stack, ret);
  for (let i = 0; i < 8 && !read(seen); i++) turn();
  const dlg = read(seen);
  assert(dlg && e.t_exists(dlg), 'actual DialogBox initializes its HWND');
  const button = e.t_button(dlg, 7, string('No'));
  assert(button);
  paint();
  assert(renderer.windows[dlg]?.visible, 'native DialogBox is visible');
  if (process.env.WINE_MODAL_CAPTURE) {
    renderer.repaint();
    fs.writeFileSync(process.env.WINE_MODAL_CAPTURE, canvas.toBuffer('image/png'));
  }
  click(dlg, 7);
  turn(); // native DialogBox BUTTON notifications are queued to its guest pump
  console.log(JSON.stringify({ route: 'DialogBox BUTTON 7', received: read(seen+4),
    selection: selection(), dialogAlive: e.t_exists(dlg) }));
  assert.equal(read(seen+4), 7, 'native dialog BUTTON reaches DLGPROC instead of document select-all');
  complete(7, 24);
  assert.equal(e.t_exists(dlg), 0);
  console.log('PASS native DialogBox BUTTON command 7 and modal continuation');

  for (const [route, key, id] of [['space', 32, 7], ['enter', 13, 7], ['escape', 27, 2]]) {
    bytes.fill(0, addr(seen), addr(seen) + 16);
    prepareEdit();
    e.t_dialog(template, proc, owner, stack, ret);
    for (let i = 0; i < 8 && !read(seen); i++) turn();
    const outer = read(seen);
    assert(outer);
    const child = e.t_button(outer, 7, string('No'));
    paint();
    e.set_focus(child);
    assert.equal(e.dialog_handle_key(outer, key, 0), 1);
    for (let i = 0; i < 16 && e.t_exists(outer); i++) turn();
    assert.equal(read(seen + 4), id);
    complete(id, 24);
    console.log(`PASS native DialogBox ${route} ${id}`);
  }

  // The outer guest DLGPROC opens MessageBox on the ordinary interpreter
  // stack. Answer the inner native No button, then resume and close outer.
  const nestedProc = alloc(256);
  const messageBox = e.t_thunk(require('../src/api_table.json').find(x => x.name === 'MessageBoxA').id);
  const body = [
    0x6a,3,0x68,...u32(caption),0x68,...u32(text),0xff,0x74,0x24,16,
    0xb8,...u32(messageBox),0xff,0xd0,0xa3,...u32(seen+8),
    0x6a,7,0xff,0x74,0x24,8,0xb8,...u32(end),0xff,0xd0,
  ];
  bytes.set([
    0x81,0x7c,0x24,8,...u32(0x110),0x75,9,
    0x8b,0x44,0x24,4,0xa3,...u32(seen),
    0x81,0x7c,0x24,8,...u32(0x111),0x75,body.length,...body,
    0xb8,1,0,0,0,0xc2,16,0,
  ], addr(nestedProc));
  bytes.fill(0, addr(seen), addr(seen) + 16);
  prepareEdit();
  e.t_dialog(template, nestedProc, owner, stack, ret);
  for (let i = 0; i < 8 && !read(seen); i++) turn();
  const outer = read(seen);
  assert(outer);
  e.t_button(outer, 7, string('Nested No'));
  paint();
  click(outer, 7);
  for (let i = 0; i < 16 && !e.modal_dialog_hwnd(); i++) turn();
  const inner = e.modal_dialog_hwnd();
  assert(inner && inner !== outer, 'real DLGPROC enters nested MessageBox');
  paint();
  click(inner, 7);
  for (let i = 0; i < 32 && e.t_exists(outer); i++) turn();
  assert.equal(read(seen + 8), 7, 'inner API result reaches outer guest callback');
  assert.equal(e.t_exists(inner), 0);
  assert.equal(e.t_exists(outer), 0);
  complete(7, 24);
  console.log('PASS native nested DialogBox/MessageBox buttons and both continuations');

  // Preserve the application's frame command bridge as a positive control.
  const frameProc = alloc(16);
  bytes.set([0x31,0xc0,0xc2,16,0], addr(frameProc));
  e.t_frame_proc(owner, frameProc);
  prepareEdit();
  e.send_message(owner, 0x111, 7, 0);
  assert.deepEqual(selection(), [0, 13], 'frame select-all still reaches document EDIT');
  console.log('PASS application frame edit command 7');
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
