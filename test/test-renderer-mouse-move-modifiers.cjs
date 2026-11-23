#!/usr/bin/env node
'use strict';
// Independent expected masks from the WM_MOUSEMOVE contract:
// https://learn.microsoft.com/en-us/windows/win32/inputdev/wm-mousemove
// Exercise public physical input handlers, not the mask helper under test.
const assert = require('node:assert/strict');
const { Win98Renderer } = require('../lib/renderer');
const canvas = { width: 640, height: 480, getContext() {
  return new Proxy({}, { get: (_, name) => name === 'measureText'
    ? () => ({ width: 0 }) : () => {} });
} };
function fixture(route) {
  const r = new Win98Renderer(canvas), sent = [];
  const child = route.includes('child'), captured = route.startsWith('capture');
  const target = child ? 101 : 100;
  let capture = 0;
  const wasm = { exports: {
    get_capture_hwnd: () => capture,
    get_authoritative_capture_hwnd: () => capture,
    wnd_top_level: () => 100,
    wnd_mouse_msg_origin_x: h => h === 101 ? 20 : 10,
    wnd_mouse_msg_origin_y: h => h === 101 ? 30 : 10,
    wnd_window_screen_x: h => h === 101 ? 20 : 10,
    wnd_window_screen_y: h => h === 101 ? 30 : 10,
    wnd_child_from_point_deep: () => child ? 101 : 0,
    wnd_get_style_export: () => route === 'disabled-child' ? 0x08000000 : 0,
    ctrl_get_class: () => route.endsWith('sync') ? 1 : 0,
    send_message(hwnd, msg, wParam, lParam) { sent.push({ hwnd, msg, wParam, lParam }); },
  } };
  r.wasm = wasm;
  r.windows[100] = { hwnd: 100, visible: true, isChild: false,
    x: 10, y: 10, w: 200, h: 160, style: 0, zOrder: 1, wasm };
  return { r, sent, target, child, captured, activate() { capture = captured ? target : 0; } };
}
const leftShift = [16, { code: 'ShiftLeft', location: 1 }];
const rightShift = [16, { code: 'ShiftRight', location: 2 }];
const leftCtrl = [17, { code: 'ControlLeft', location: 1 }];
const rightCtrl = [17, { code: 'ControlRight', location: 2 }];
const release = ([vk, info]) => [-vk, info];
const states = [
  { name: 'bare', keys: [], bits: 0 },
  { name: 'Ctrl', keys: [17], bits: 8 },
  { name: 'Shift', keys: [16], bits: 4 },
  { name: 'Ctrl+Shift', keys: [17, 16], bits: 12 },
  { name: 'released', keys: [17, 16, -17, -16], bits: 0 },
  { name: 'left Ctrl', keys: [leftCtrl], bits: 8 },
  { name: 'right Shift', keys: [rightShift], bits: 4 },
  { name: 'one Ctrl side released', keys: [leftCtrl, rightCtrl, release(leftCtrl)], bits: 8 },
  { name: 'one Shift side released', keys: [leftShift, rightShift, release(rightShift)], bits: 4 },
  { name: 'both sides released', keys: [leftCtrl, rightCtrl, leftShift, rightShift,
    release(rightCtrl), release(leftCtrl), release(leftShift), release(rightShift)], bits: 0 },
  { name: 'Alt only', keys: [18], bits: 0 },
];
function key(r, spec) {
  const [vk, info] = Array.isArray(spec) ? spec : [spec];
  if (vk > 0) r.handleKeyDown(vk, info); else r.handleKeyUp(-vk, info);
}
const failures = [];
let count = 0;
function check(label, fn) {
  count++;
  try { fn(); } catch (e) { failures.push({ label, error: e.message }); }
}
for (const route of ['ordinary-top', 'ordinary-child', 'cached-child',
  'capture-top', 'capture-child', 'capture-child-sync']) {
  for (const held of [0, 1, 2, 3]) for (const state of states) {
    const { r, sent, target, child, captured, activate } = fixture(route);
    // Press outside all windows so ordinary routes have no cached target.
    if (held & 1) r.handleMouseDown(500, 400, 0);
    if (held & 2) r.handleMouseDown(500, 400, 2);
    if (route === 'cached-child') r._lastDeepChild = {
      topHwnd: 100, childHwnd: 101, sx: 20, sy: 30, wasm: r.wasm,
    }; // State normally retained by a deep-child DOWN.
    state.keys.forEach(k => key(r, k));
    activate();
    r.inputQueue.length = 0;
    const [x, y] = captured ? [-5, 240] : [80, 90];
    r.handleMouseMove(x, y);
    const moves = [...r.inputQueue, ...sent].filter(e => e.msg === 0x200);
    check(`${route}/${held}/${state.name}`, () => {
      assert.equal(moves.length, 1, 'one move');
      const m = moves[0];
      assert.equal(m.hwnd, target, 'target preserved');
      assert.equal(m.lParam >>> 0, (((y - (child ? 30 : 10)) << 16) |
        ((x - (child ? 20 : 10)) & 0xffff)) >>> 0, 'client coordinates preserved');
      assert.equal(r._mouseButtonsMask || 0, held, 'physical buttons unchanged');
      if (m.mouseButtons !== undefined) assert.equal(m.mouseButtons, held, 'queued button snapshot');
      assert.equal(m.wParam, held | state.bits, 'documented modifier/button flags');
      assert.equal(sent.length, route.endsWith('sync') ? 1 : 0,
        'captured native control uses synchronous dispatch');
    });
  }
}
// Existing routing controls: these assert emulator behavior, not a VM result.
for (const route of ['disabled-child', 'off-window', 'no-windows', 'open-menu']) {
  const { r, sent } = fixture(route);
  key(r, 16); key(r, 17);
  if (route === 'no-windows') r.windows = {};
  if (route === 'open-menu') r._openMenuContext = () => ({ active: true });
  r.inputQueue.length = 0;
  r.handleMouseMove(route === 'off-window' ? 500 : 80, 90);
  check(route, () => assert.equal([...r.inputQueue, ...sent].filter(e => e.msg === 0x200).length, 0));
}
// EDIT consumes key input before the legacy _ctrlDown/_shiftDown assignment.
for (const released of [false, true]) {
  const { r } = fixture('ordinary-top');
  Object.assign(r.wasm.exports, { get_focus_hwnd: () => 101, ctrl_get_class: h => h === 101 ? 2 : 0 });
  key(r, 17); key(r, 16);
  assert.ok(!r._ctrlDown && !r._shiftDown, 'EDIT early return exercised');
  if (released) { key(r, -17); key(r, -16); }
  r.inputQueue.length = 0;
  r.handleMouseMove(80, 90);
  check(`EDIT/${released}`, () => assert.equal(r.inputQueue.find(e => e.msg === 0x200).wParam, released ? 0 : 12));
}
// A modifier change between moves is a coalescing barrier; equal states may
// still coalesce to the newest coordinates.
{
  const { r } = fixture('ordinary-top');
  r.handleMouseMove(80, 90);
  key(r, 17); r.inputQueue = r.inputQueue.filter(e => e.msg === 0x200);
  r.handleMouseMove(81, 91); r.handleMouseMove(82, 92);
  key(r, -17); r.inputQueue = r.inputQueue.filter(e => e.msg === 0x200);
  r.handleMouseMove(83, 93);
  check('modifier transitions/coalescing', () => {
    assert.deepEqual(r.inputQueue.map(e => [e.hwnd, e.wParam, e.lParam]), [
      [100, 0, (80 << 16) | 70], [100, 8, (82 << 16) | 72], [100, 0, (83 << 16) | 73],
    ]);
  });
}
console.log(JSON.stringify({ count, failures }, null, 2));
process.exitCode = failures.length ? 1 : 0;
