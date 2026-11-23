#!/usr/bin/env node
'use strict';

// Microsoft WM_LBUTTONUP / WM_RBUTTONUP: wParam describes keys/buttons
// still down at release, not the modifiers supplied with an earlier DOWN.
// https://learn.microsoft.com/en-us/windows/win32/inputdev/wm-lbuttonup
// https://learn.microsoft.com/en-us/windows/win32/inputdev/wm-rbuttonup
const assert = require('node:assert/strict');
const { Win98Renderer } = require('../lib/renderer');
const canvas = { width: 640, height: 480, getContext() {
  return new Proxy({}, { get: (_, name) => name === 'measureText'
    ? () => ({ width: 0 }) : () => {} });
} };

function fixture(route) {
  const r = new Win98Renderer(canvas);
  const sent = [];
  const child = route.includes('child');
  const captured = route.startsWith('capture');
  const sync = route.endsWith('sync');
  const target = child ? 101 : 100;
  const wasm = { exports: {
    get_capture_hwnd: () => captured ? target : 0,
    get_authoritative_capture_hwnd: () => captured ? target : 0,
    wnd_top_level: () => 100,
    wnd_mouse_msg_origin_x: hwnd => hwnd === 101 ? 20 : 10,
    wnd_mouse_msg_origin_y: hwnd => hwnd === 101 ? 30 : 10,
    wnd_window_screen_x: hwnd => hwnd === 101 ? 20 : 10,
    wnd_window_screen_y: hwnd => hwnd === 101 ? 30 : 10,
    wnd_child_from_point_deep: () => child ? 101 : 0,
    ctrl_get_class: () => sync ? 1 : 0,
    send_message(hwnd, msg, wParam, lParam) { sent.push({ hwnd, msg, wParam, lParam }); },
  } };
  r.wasm = wasm;
  r.windows[100] = { hwnd: 100, visible: true, isChild: false,
    x: 10, y: 10, w: 200, h: 160, style: 0, zOrder: 1, wasm };
  return { r, sent, target, captured, child };
}

const cases = [
  { name: 'bare', before: [], after: [], bits: 0 },
  { name: 'Ctrl', before: [17], after: [], bits: 8 },
  { name: 'Shift', before: [16], after: [], bits: 4 },
  { name: 'Ctrl+Shift', before: [17, 16], after: [], bits: 12 },
  { name: 'released modifiers', before: [17, 16], after: [-17, -16], bits: 0 },
  { name: 'modifiers pressed after DOWN', before: [], after: [17, 16], bits: 12 },
  { name: 'DOWN options alone', before: [], after: [], bits: 0,
    options: { ctrlKey: true, shiftKey: true } },
  { name: 'one Shift side released',
    before: [[16, { code: 'ShiftLeft', location: 1 }], [16, { code: 'ShiftRight', location: 2 }]],
    after: [[-16, { code: 'ShiftLeft', location: 1 }]], bits: 4 },
  { name: 'both Ctrl sides released',
    before: [[17, { code: 'ControlLeft', location: 1 }], [17, { code: 'ControlRight', location: 2 }]],
    after: [[-17, { code: 'ControlRight', location: 2 }], [-17, { code: 'ControlLeft', location: 1 }]], bits: 0 },
];
const failures = [];
let count = 0;
for (const route of ['cached-top', 'ordinary-top', 'cached-child', 'ordinary-child',
  'capture-top', 'capture-child', 'capture-child-sync']) {
  for (const button of [0, 2]) for (const otherHeld of [false, true]) for (const c of cases) {
    const label = `${route}/${button}/${otherHeld}/${c.name}`;
    const { r, sent, target, captured, child } = fixture(route);
    const key = spec => {
      const [vk, info] = Array.isArray(spec) ? spec : [spec];
      if (vk > 0) r.handleKeyDown(vk, info);
      else r.handleKeyUp(-vk, info);
    };
    c.before.forEach(key);
    // An ordinary uncached UP can enter the canvas after a press outside it.
    const start = route.startsWith('ordinary') ? [500, 400] : [40, 60];
    if (otherHeld) r.handleMouseDown(500, 400, button === 0 ? 2 : 0);
    r.handleMouseDown(...start, button, c.options);
    c.after.forEach(key);
    const queuedBefore = r.inputQueue.length;
    const sentBefore = sent.length;
    // Captured releases must retain their owner even outside its bounds.
    const [x, y] = captured ? [310, 240] : [80, 90];
    r.handleMouseUp(x, y, button);
    const msg = button === 0 ? 0x202 : 0x205;
    const ups = [...r.inputQueue.slice(queuedBefore), ...sent.slice(sentBefore)]
      .filter(e => e.msg === msg);
    try {
      assert.equal(ups.length, 1, 'exactly one release');
      const up = ups[0];
      const held = otherHeld ? (button === 0 ? 2 : 1) : 0;
      assert.equal(up.hwnd, target, 'release target');
      assert.equal(up.lParam >>> 0, (((y - (child ? 30 : 10)) << 16) |
        (x - (child ? 20 : 10))) >>> 0, 'current client release coordinates');
      assert.equal(r._mouseButtonsMask, held, 'released button removed');
      assert.equal(r.peekKeyDownState(button === 0 ? 1 : 2), 0, 'physical button released');
      if (up.mouseButtons !== undefined) assert.equal(up.mouseButtons, held, 'queued physical snapshot');
      assert.ok(!r._directMouseDown, 'cached press retired');
      assert.equal(up.wParam, c.bits | held, 'current modifier/button mask');
    } catch (error) { failures.push({ label, error: error.message, ups }); }
    count++;
  }
}
// Native EDIT routing returns before the legacy renderer modifier flags are
// assigned. The same real key handlers used by browser-input must still make
// the current physical state available to the mouse release.
for (const releaseFirst of [false, true]) {
  const { r } = fixture('cached-top');
  Object.assign(r.wasm.exports, {
    get_focus_hwnd: () => 101,
    ctrl_get_class: hwnd => hwnd === 101 ? 2 : 0,
  });
  r.handleKeyDown(17);
  r.handleKeyDown(16);
  assert.ok(!r._ctrlDown && !r._shiftDown, 'EDIT returned before legacy flags');
  assert.equal(r.peekKeyDownState(17), 0x8000);
  assert.equal(r.peekKeyDownState(16), 0x8000);
  r.handleMouseDown(40, 60, 0);
  if (releaseFirst) { r.handleKeyUp(17); r.handleKeyUp(16); }
  r.handleMouseUp(80, 90, 0);
  const up = r.inputQueue.find(e => e.msg === 0x202);
  try { assert.equal(up.wParam, releaseFirst ? 0 : 12, 'EDIT physical modifiers'); }
  catch (error) { failures.push({ label: `EDIT/${releaseFirst}`, error: error.message, ups: [up] }); }
  count++;
}
console.log(JSON.stringify({ count, failures }, null, 2));
assert.equal(failures.length, 0, `${failures.length}/${count} renderer release cases failed`);
