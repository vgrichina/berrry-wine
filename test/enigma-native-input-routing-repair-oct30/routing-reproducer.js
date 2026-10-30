#!/usr/bin/env node
'use strict';
// Uses the untransformed production constructor and input mixin. USER exports
// are a small boundary fixture, not a guest CPU or WAT control implementation.
const assert = require('node:assert/strict');
const { Win98Renderer } = require('../../lib/renderer');
const mutant = process.argv.find(a => a.startsWith('--mutant='))?.split('=')[1];
assert(!mutant || ['drop-top-button', 'false-down-result'].includes(mutant), 'known mutant');
const dispatch = Win98Renderer.prototype._dispatchMouseEvent;
if (mutant) Win98Renderer.prototype._dispatchMouseEvent = function(win, event) {
  if (mutant === 'drop-top-button' && event.hwnd === win.hwnd &&
      (event.msg === 0x201 || event.msg === 0x202)) return true;
  const result = dispatch.call(this, win, event);
  return mutant === 'false-down-result' && event.msg === 0x201 ? false : result;
};
const pack = (x, y) => ((y & 65535) << 16) | (x & 65535);
const reports = [];
function fixture({ child = 0, native = false, dialog = false } = {}) {
  const calls = [], traces = [];
  const top = 0x10001, target = child || top;
  const ox = child ? 310 : 23, oy = child ? 180 : 43;
  const exports = {
    wnd_child_from_point_deep: () => target,
    wnd_window_screen_x: hwnd => hwnd === top ? 20 : ox,
    wnd_window_screen_y: hwnd => hwnd === top ? 20 : oy,
    wnd_mouse_msg_origin_x: hwnd => hwnd === top ? 23 : ox,
    wnd_mouse_msg_origin_y: hwnd => hwnd === top ? 43 : oy,
    ctrl_get_class: hwnd => native && hwnd === target ? 1 : 0,
    wnd_get_proc_export: hwnd => native && hwnd === target ? 0xffff0001 : 0x401000,
    wnd_get_style_export: () => 0,
    get_capture_hwnd: () => 0,
    send_message: (...args) => { calls.push(['send', ...args]); return 1; },
    dialog_route_mouse_screen: (...args) => { calls.push(['route', ...args]); return 1; },
  };
  const owner = { exports }, other = { exports: {
    send_message: () => { throw Error('wrong owner'); },
    dialog_route_mouse_screen: () => { throw Error('wrong owner'); },
  } };
  const ctx = { save() {}, restore() {}, beginPath() {}, rect() {}, clip() {},
    clearRect() {}, fillRect() {}, strokeRect() {}, fillText() {},
    measureText: () => ({ width: 0 }), drawImage() {}, putImageData() {},
    getImageData: () => ({ data: new Uint8ClampedArray(4) }) };
  const r = new Win98Renderer({ getContext: () => ctx });
  r.scheduleRepaint = r.repaint = () => {}; // no pixel claim
  r.wasm = other;
  r._buttonHoldFloorMs = -1; // same setting as pinned test/run.js
  r.onInputTrace = line => traces.push(line);
  r.windows[top] = { hwnd: top, x: 20, y: 20, w: 646, h: 507,
    visible: true, hasCaption: false, style: 0, zOrder: 1,
    isDialog: dialog, wasm: owner };
  return { r, owner, other, calls, traces, top, target, ox, oy };
}
for (const [name, options] of [
  ['guest-top-level-self-hit', {}],
  ['ordinary-custom-child', { child: 0x10002 }],
  ['wat-native-button-on-main', { child: 0x10002, native: true }],
  ['guest-custom-child-in-dialog', { child: 0x10002, dialog: true }],
]) {
  const f = fixture(options), { r, target, ox, oy } = f;
  r.handleMouseDown(343, 213, 1);
  assert.equal(r._directMouseDown?.targetHwnd, target, `${name}: matching release recorded`);
  r.wasm = f.other; // a different drawing slice cannot consume/change the pair
  const ux = options.child ? 305 : 345, uy = options.child ? 175 : 215;
  r.handleMouseUp(ux, uy, 1);
  const queued = r.inputQueue.map(e => [e.hwnd, e.msg, e.wParam, e.lParam]);
  const buttons = queued.filter(e => e[1] === 0x201 || e[1] === 0x202);
  assert.deepEqual(buttons, [[target, 0x201, 1, pack(343-ox, 213-oy)],
    [target, 0x202, 0, pack(ux-ox, uy-oy)]], `${name}: exact pair, target, client coordinates`);
  assert.equal(f.calls.length, 0, `${name}: guest callback not entered on host pointer stack`);
  assert.equal(r.takeInput(e => e.hwnd === 0x99999), null);
  assert.equal(r.inputQueue.length, queued.length, `${name}: foreign poll retains events`);
  const drained = [];
  for (let e; (e = r.checkInput());) drained.push([e.hwnd, e.msg, e.wParam, e.lParam]);
  assert.deepEqual(drained, queued, `${name}: pinned CLI polling boundary drains exactly once`);
  assert.equal(r._directMouseDown, null);
  reports.push({ name, queued, drained, callbacks: f.calls, traces: f.traces });
}
{
  const f = fixture({ child: 0x10002, native: true, dialog: true });
  f.r.handleMouseDown(343, 213, 1);
  assert.equal(f.r._dialogBtnDrag?.wasm, f.owner, 'native dialog retains routing owner');
  f.r.wasm = f.other;
  f.r.handleMouseUp(305, 175, 1); // outside child, inside dialog: no fabricated point
  assert.deepEqual(f.calls, [
    ['route', f.top, 0x201, 1, 343, 213],
    ['route', f.top, 0x202, 0, 305, 175],
  ], 'native USER router receives exact down/up on original owner');
  assert.equal(f.r.inputQueue.length, 0, 'native synchronous route gets no duplicate queue events');
  reports.push({ name: 'wat-native-dialog-router', calls: f.calls });
}
console.log(JSON.stringify({ pass: true, production: ['lib/renderer.js', 'lib/renderer-input.js'],
  guestExecution: false, reports }, null, 2));
