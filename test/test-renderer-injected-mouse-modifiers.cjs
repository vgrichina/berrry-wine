#!/usr/bin/env node
'use strict';
// Independent contracts (read before constructing this oracle):
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-mouse_event
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput
// https://learn.microsoft.com/en-us/windows/win32/inputdev/wm-mousemove
// Mouse-only injection preserves held keyboard state. MK_SHIFT=4, MK_CONTROL=8.
const assert = require('node:assert/strict');
const { Win98Renderer } = require('../lib/renderer');
const canvas = { width: 640, height: 480, getContext() {
  return new Proxy({}, { get: (_, k) => k === 'measureText'
    ? () => ({ width: 0 }) : () => {} });
} };
const sl = [16, { code: 'ShiftLeft', location: 1 }];
const sr = [16, { code: 'ShiftRight', location: 2 }];
const cl = [17, { code: 'ControlLeft', location: 1 }];
const cr = [17, { code: 'ControlRight', location: 2 }];
const up = ([vk, info]) => [-vk, info];
const states = [
  ['bare', [], 0], ['Shift', [[16]], 4], ['Ctrl', [[17]], 8],
  ['both', [[16], [17]], 12],
  ['released', [[16], [17], [-16], [-17]], 0],
  ['left Shift', [sl], 4], ['right Ctrl', [cr], 8],
  ['Shift overlap', [sl, sr, up(sl)], 4],
  ['Ctrl overlap', [cl, cr, up(cr)], 8],
  ['all sides released', [sl, sr, cl, cr, up(sr), up(sl), up(cl), up(cr)], 0],
  ['repress', [sl, up(sl), sr, cr], 12],
  // Deliberately poisoned legacy state after actual public releases detects
  // a fallback that ORs physical state with historical renderer booleans.
  ['released stale true', [sl, cr, up(sl), up(cr)], 0, true],
];
// [flags, dx, dy, data, expected messages [message, buttons, high word]]
const actions = [
  ['move', [[0x2001, 3, -4, 0, [[0x200, 0, 0]]]]],
  ['left', [[2, 999, 999, 0, [[0x201, 1, 0]]], [4, 0, 0, 0, [[0x202, 0, 0]]]]],
  ['right', [[8, 0, 0, 0, [[0x204, 2, 0]]], [16, 0, 0, 0, [[0x205, 0, 0]]]]],
  ['middle', [[32, 0, 0, 0, [[0x207, 16, 0]]], [64, 0, 0, 0, [[0x208, 0, 0]]]]],
  ['both X', [[128, 0, 0, 3, [[0x20b, 32, 1], [0x20b, 96, 2]]],
    [256, 0, 0, 3, [[0x20c, 64, 1], [0x20c, 0, 2]]]]],
  ['wheel', [[0x800, 0, 0, -240, [[0x20a, 0, -240]]]]],
  ['horizontal wheel', [[0x1000, 0, 0, 120, [[0x20e, 0, 120]]]]],
  ['ordered combined', [[1 | 2 | 8 | 32, 3, -4, 0,
    [[0x200, 0, 0], [0x201, 1, 0], [0x204, 3, 0], [0x207, 19, 0]]],
    [4 | 16 | 64, 0, 0, 0, [[0x202, 18, 0], [0x205, 16, 0], [0x208, 0, 0]]]]],
  ['absolute', [[0x8001, 65535, 0, 0, [[0x200, 0, 0]]]]],
];
function fixture(route) {
  const r = new Win98Renderer(canvas), sent = [];
  const captured = route.startsWith('capture'), child = route.includes('child');
  const target = child ? 101 : 100;
  const process = { id: route };
  const wasm = { exports: {
    get_focus_hwnd: () => route === 'EDIT' ? 101 : 0,
    ctrl_get_class: h => route === 'EDIT' && h === 101 ? 2 : 0,
    send_message: (...args) => sent.push(args),
    get_capture_hwnd: () => captured ? target : 0,
    get_authoritative_capture_hwnd: () => captured ? target : 0,
    wnd_top_level: () => 100,
    wnd_mouse_msg_origin_x: () => child ? 110 : 100,
    wnd_mouse_msg_origin_y: () => child ? 120 : 110,
    wnd_window_screen_x: () => child ? 110 : 100,
    wnd_window_screen_y: () => child ? 120 : 110,
    wnd_child_from_point_deep: () => child ? 101 : 0,
    wnd_get_style_export: () => 0,
  } };
  r.wasm = wasm;
  r.windows[100] = { hwnd:100, visible:true, isChild:false, x:0, y:0,
    w:640, h:480, style:0, zOrder:1, wasm, _lookupProcess:process };
  r.setMousePosition(80, 90);
  return { r, sent, target, process, child, captured };
}
const failures = [];
let count = 0;
for (const route of ['ordinary-top', 'ordinary-child', 'capture-top', 'capture-child', 'EDIT']) {
  for (const [name, keys, bits, poison] of states) for (const [action, calls] of actions) {
    const {r, sent, target, process, child} = fixture(route);
    const label = `${route}/${name}/${action}`;
    try {
      for (const [vk, info] of keys) {
        if (vk > 0) r.handleKeyDown(vk, info); else r.handleKeyUp(-vk, info);
      }
      assert.equal(!!r.peekKeyDownState(16), !!(bits & 4), 'actual physical Shift setup');
      assert.equal(!!r.peekKeyDownState(17), !!(bits & 8), 'actual physical Ctrl setup');
      if (route === 'EDIT') {
        assert.equal(sent.filter(e => e[1] === 0x100).length,
          keys.filter(([vk]) => vk > 0).length, 'native EDIT consumed each DOWN');
        // EDIT consumes DOWN before legacy assignment, but UP always recomputes
        // that modifier from the sides still held. Model only that bookkeeping
        // contract from the input sequence, independently of the mouse MK oracle.
        for (const [modifier, field] of [[16, '_shiftDown'], [17, '_ctrlDown']]) {
          const held = new Set();
          let legacy = false;
          for (const [vk, info] of keys) {
            if (Math.abs(vk) !== modifier) continue;
            const side = info?.code || 'generic';
            if (vk > 0) held.add(side);
            else { held.delete(side); legacy = held.size > 0; }
          }
          assert.equal(!!r[field], legacy, `EDIT ${field} follows DOWN/UP contract`);
        }
      }
      if (poison) r._shiftDown = r._ctrlDown = true;
      const keyboardQueue = r.inputQueue.slice();
      const state = () => JSON.stringify([
        [16,17,160,161,162,163].map(v => [r._asyncKeys?.[v],
          r._asyncPressedKeys?.[v], r.peekKeyDownState(v)]), r._shiftDown, r._ctrlDown]);
      const before = state(), sentCount = sent.length;
      let x = 80, y = 90;
      for (const [flags, dx, dy, data, expected] of calls) {
        if (flags & 1) {
          x = flags & 0x8000 ? 639 : x + dx;
          y = flags & 0x8000 ? 0 : y + dy;
        }
        const start = r.inputQueue.length;
        assert.equal(r.queueMouseInput(flags, dx, dy, data, 0xfedcba98), 1);
        const events = r.inputQueue.slice(start);
        assert.equal(events.length, expected.length, 'message count/order');
        for (let i = 0; i < expected.length; i++) {
          const e = events[i], [msg, buttons, high] = expected[i];
          assert.equal(e.msg, msg, 'message order');
          assert.equal(e.hwnd, target, 'routing/capture target');
          assert.equal(e.pointerProcess, process, 'process ownership');
          assert.equal(e.mouseButtons, buttons, 'event-time button snapshot');
          assert.equal(e.wParam & 0xffff, buttons | bits, 'physical MK mask');
          assert.equal(e.wParam >> 16, high, 'signed wheel/X high word');
          const screen = msg === 0x20a || msg === 0x20e;
          assert.equal(e.lParam << 16 >> 16, screen ? x : x - (child ? 110 : 100), 'signed X');
          assert.equal(e.lParam >> 16, screen ? y : y - (child ? 120 : 110), 'signed Y');
          assert.deepEqual([e.mouseX,e.mouseY], [x,y], 'screen snapshot');
          assert.equal(e.extraInfo, 0xfedcba98, 'unsigned extra info');
        }
        assert.equal(r._mouseButtonsMask, expected.at(-1)[1], 'final physical buttons');
      }
      assert.deepEqual(r.inputQueue.slice(0,keyboardQueue.length), keyboardQueue, 'keyboard queue undrained');
      assert.equal(state(), before, 'modifier state and pressed bits unchanged');
      assert.equal(sent.length, sentCount, 'injection queues without guest reentry');
    } catch (error) { failures.push({label, error:error.message}); }
    count++;
  }
}
// Negative screen coordinates without MOVE, captured outside the client.
for (const [msg, flag] of [[0x20a,0x800],[0x20e,0x1000]]) {
  const {r} = fixture('capture-child');
  r._applyCursorClip = (x,y) => ({x,y}); r.setMousePosition(-21,-31);
  r.handleKeyDown(16, sl[1]);
  r.queueMouseInput(flag,0,0,-120,7);
  const e = r.inputQueue.at(-1);
  try {
    assert.equal(e.msg,msg); assert.equal(e.hwnd,101);
    assert.equal(e.wParam & 0xffff,4);
    assert.equal(e.lParam << 16 >> 16,-21); assert.equal(e.lParam >> 16,-31);
  } catch(error) { failures.push({label:`signed-screen/${msg}`,error:error.message}); }
  count++;
}
console.log(JSON.stringify({count,failures},null,2));
assert.equal(failures.length,0,`${failures.length}/${count} injected mouse cases failed`);
