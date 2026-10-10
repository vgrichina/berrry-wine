#!/usr/bin/env node

'use strict';

const assert = require('assert');
const { Win98Renderer } = require('../lib/renderer');

const canvas = {
  width: 640,
  height: 480,
  getContext() {
    return {
      save() {}, restore() {}, beginPath() {}, rect() {}, clip() {},
      clearRect() {}, fillRect() {}, strokeRect() {}, fillText() {},
      measureText() { return { width: 0 }; },
      drawImage() {}, putImageData() {}, getImageData() { return { data: new Uint8ClampedArray(4) }; },
    };
  },
};

const appA = {
  exports: {
    modal_dialog_hwnd() { return 101; },
    wnd_window_screen_x(hwnd) { return hwnd === 101 ? 350 : 300; },
    wnd_window_screen_y() { return 20; },
    wnd_screen_w(hwnd) { return hwnd === 101 ? 100 : 250; },
    wnd_screen_h(hwnd) { return hwnd === 101 ? 100 : 180; },
  },
};
const appB = {
  exports: {
    modal_dialog_hwnd() { return 0; },
    wnd_child_from_point_deep() { return 0; },
    set_focus_hwnd() {},
  },
};

const renderer = new Win98Renderer(canvas);
renderer.wasm = appA;
renderer.windows[100] = {
  hwnd: 100, visible: true, isChild: false,
  x: 300, y: 10, w: 250, h: 200, zOrder: 1, style: 0, wasm: appA,
};
renderer.windows[101] = {
  hwnd: 101, visible: true, isChild: false, isDialog: true, isAboutDialog: true,
  x: 30, y: 20, w: 100, h: 100, zOrder: 2, style: 0, wasm: appA,
};
renderer.windows[200] = {
  hwnd: 200, visible: true, isChild: false,
  x: 10, y: 10, w: 250, h: 200, zOrder: 3, style: 0, wasm: appB,
};
renderer._nextZ = 4;
renderer._setKeyboardInputOwner(renderer.windows[100]);
const oldZ = renderer.windows[200].zOrder;
let prematureFocus = 0;
appB.exports.set_focus = () => { prematureFocus++; };

renderer.handleMouseDown(40, 60, 0);
renderer.handleMouseUp(40, 60, 0);
assert.strictEqual(renderer._keyboardInputWasm, appA, 'queued client click does not decide keyboard ownership');
assert.strictEqual(renderer.windows[200].zOrder, oldZ, 'queued client click does not raise its candidate');
assert.strictEqual(prematureFocus, 0, 'queued client click does not send premature guest focus callbacks');
assert.deepStrictEqual(renderer.inputQueue.map(event => [event.hwnd, event.msg]), [
  [200, 0x0084],
  [200, 0x0201],
  [200, 0x0202],
], 'a dialog in app A must not outrank the frontmost overlapping window in app B');
assert.strictEqual(renderer.inputQueue[0].lParam, (60 << 16) | 40,
  'the owning app receives WM_NCHITTEST in screen coordinates before the click');

// Consuming a pointer event for B does not require giving it the keyboard.
// This is the separation needed while USER has not yet accepted activation.
renderer._setKeyboardInputOwner(renderer.windows[100]);
const owns = wasm => event => renderer.windows[event.hwnd]?.wasm === wasm;
assert.strictEqual(renderer.takeInput(owns(appA)), null,
  'app A cannot consume pending pointer events addressed to B');
// A release is never handed over in the same pump as its press (37ff2f8df):
// it waits for one empty poll and a short floor on the input clock.
let inputClock = 1000;
renderer._inputNowMs = () => inputClock;
assert.deepStrictEqual([0x0084, 0x0201].map(() => renderer.takeInput(owns(appB)).msg),
  [0x0084, 0x0201], 'app B consumes its query/down without keyboard ownership');
assert.strictEqual(renderer.takeInput(owns(appB)), null,
  'the release waits for the pump that delivered the press to end');
inputClock += 100;
assert.strictEqual(renderer.takeInput(owns(appB)).msg, 0x0202,
  'app B then consumes its up, still without keyboard ownership');
assert.strictEqual(renderer._keyboardInputWasm, appA,
  'pointer dequeue must not itself publish an activation decision');

// Secondary apps expose send_message too, but pointer delivery must not use
// that capability as a reason to omit their right-button down. USER needs
// the down to ask WM_MOUSEACTIVATE; an orphan UP cannot substitute for it.
renderer.mainWasm = appA;
appB.exports.send_message = () => { throw new Error('right click entered guest inline'); };
renderer.handleMouseDown(40, 60, 2);
renderer.handleMouseUp(40, 60, 2);
assert.deepStrictEqual(renderer.inputQueue.map(event => [event.hwnd, event.msg]), [
  [200, 0x84], [200, 0x204], [200, 0x205],
], 'secondary app receives the complete queued right-click sequence');
assert.strictEqual(renderer.inputQueue[1].wParam & 2, 2, 'right down carries MK_RBUTTON');
assert.strictEqual(renderer._keyboardInputWasm, appA, 'right click also awaits activation consent');
assert.strictEqual(renderer.windows[200].zOrder, oldZ);
assert.strictEqual(prematureFocus, 0);
renderer.inputQueue.length = 0;

// Accepted foreground, not the provisional click owner or highest surface,
// selects the keyboard app. Restoring the routing context must not execute
// guest focus callbacks (the browser instance may only be a Worker shadow).
{
  const r = new Win98Renderer(canvas);
  const forbidden = () => { throw new Error('routing must not execute guest focus code'); };
  const accepted = { exports: { set_focus: forbidden, set_focus_hwnd: forbidden } };
  const provisional = { exports: {} };
  const acceptedMemory = { owner: 'accepted' };
  const otherMemory = { owner: 'other' };
  const foreground = { hwnd: 400, visible: true, isChild: false, zOrder: 1,
    wasm: accepted, wasmMemory: acceptedMemory };
  const above = { hwnd: 500, visible: true, isChild: false, zOrder: 100,
    wasm: provisional, wasmMemory: otherMemory };
  r.windows[400] = foreground;
  r.windows[500] = above;
  r._foregroundWindow = foreground;
  r._setKeyboardInputOwner(above);
  r._restoreKeyboardInputOwner();
  assert.strictEqual(r._keyboardInputWasm, accepted, 'accepted foreground overrides click owner');
  assert.strictEqual(r.wasm, accepted, 'key dispatch uses accepted app exports');
  assert.strictEqual(r.wasmMemory, acceptedMemory, 'key dispatch uses matching app memory');
  assert.strictEqual(r._keyboardInputMemory, acceptedMemory);
  assert.strictEqual(above.zOrder, 100, 'keyboard restoration does not reorder windows');

  // Absent/hidden/child/replaced foreground records cannot steal routing.
  const hidden = { ...foreground, visible: false };
  const child = { ...foreground, isChild: true };
  for (const [stale, registered] of [[null, foreground], [{ ...foreground }, foreground],
      [hidden, hidden], [child, child]]) {
    r._foregroundWindow = stale;
    r.windows[400] = registered;
    r._setKeyboardInputOwner(above);
    r._restoreKeyboardInputOwner();
    assert.strictEqual(r.wasm, provisional, 'invalid foreground preserves live fallback owner');
    assert.strictEqual(r.wasmMemory, otherMemory);
  }
}

renderer.inputQueue.length = 0;
renderer.windows[100].zOrder = renderer._nextZ++;
renderer.handleMouseDown(310, 180, 0);
renderer.handleMouseUp(310, 180, 0);
assert.deepStrictEqual(renderer.inputQueue, [], 'app A modal dialog should still block its own owner window');

// A toolbar combo uses the native container router. Its pending release
// must retain both that container and the emulator which received the down,
// even when a different application's run slice replaces renderer.wasm.
for (const screenRouter of [true, false]) {
  const r = new Win98Renderer(canvas);
  const calls = [];
  let classifications = 0;
  const foreign = { exports: {
    modal_dialog_hwnd: () => 0,
    dialog_route_mouse_screen: (...args) => { calls.push(['foreign', ...args]); return 1; },
    dialog_route_mouse: (...args) => { calls.push(['foreign', ...args]); return 1; },
  }};
  const owner = { exports: {
    modal_dialog_hwnd: () => 0,
    wnd_get_style_export: () => 0,
    wnd_get_parent: hwnd => hwnd === 301 ? 300 : 0,
    wnd_client_screen_x: () => 10,
    wnd_client_screen_y: () => 20,
    get_focus_hwnd: () => 301,
    set_focus() {},
    ctrl_get_class: () => { classifications++; return 5; },
    [screenRouter ? 'dialog_route_mouse_screen' : 'dialog_route_mouse']:
      (...args) => { calls.push(['owner', ...args]); return 1; },
  }};
  r.wasm = owner;
  r.windows[300] = { hwnd: 300, visible: true, isChild: false,
    x: 10, y: 20, w: 200, h: 160, hasCaption: false, style: 0,
    zOrder: 1, wasm: owner };
  r._hitTestDeepChild = () => ({ hwnd: 301, sx: 30, sy: 40 });
  r.handleMouseDown(45, 55, 0);
  assert.strictEqual(r._dialogBtnDrag.wasm, owner, 'pending release retains emulator identity');
  assert.strictEqual(r._dialogBtnDrag.parent, 300, 'release retains the down routing container');
  r.wasm = foreign;
  r.handleMouseUp(47, 58, 0);
  assert.deepStrictEqual(calls, screenRouter ? [
    ['owner', 300, 0x201, 1, 45, 55],
    ['owner', 300, 0x202, 0, 47, 58],
  ] : [
    ['owner', 300, 0x201, 1, (35 << 16) | 35],
    ['owner', 300, 0x202, 0, (38 << 16) | 37],
  ], 'down/up use one owner and container, with screen or container-client coordinates');
  assert.strictEqual(classifications, 1, 'classify the clicked control once in its owner');
  assert.strictEqual(r._dialogBtnDrag, null, 'release retires the pending native press');
  for (const modal of [false, true]) {
    calls.length = 0;
    r.wasm = owner;
    const route = screenRouter ? 'dialog_route_mouse_screen' : 'dialog_route_mouse';
    owner.exports[route] = (...args) => {
      calls.push(['owner', ...args]);
      return args[1] === 0x201 ? 1 : 0; // A missed UP must not be retried.
    };
    if (screenRouter) owner.exports.dialog_route_mouse = (...args) => {
      calls.push(['unexpected-legacy-retry', ...args]); return 1;
    };
    r.handleMouseDown(45, 55, 0);
    owner.exports.modal_dialog_hwnd = () => modal ? 300 : 0;
    r.wasm = foreign;
    r.handleMouseUp(-10, -20, 0);
    assert.deepStrictEqual(calls, screenRouter ? [
      ['owner', 300, 0x201, 1, 45, 55],
      ['owner', 300, 0x202, 0, -10, -20],
    ] : [
      ['owner', 300, 0x201, 1, (35 << 16) | 35],
      ['owner', 300, 0x202, 0, ((-40 & 0xffff) << 16 | (-20 & 0xffff)) >>> 0],
    ], 'outside release reaches its owner exactly once, even outside a modal frame');
    assert.strictEqual(r._dialogBtnDrag, null, 'outside release retires pending press');
    owner.exports.modal_dialog_hwnd = () => 0;
  }
}

console.log('PASS  multi-app modal input and native press ownership stay within the owning emulator instance');
