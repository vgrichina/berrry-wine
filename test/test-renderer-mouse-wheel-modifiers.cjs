#!/usr/bin/env node
'use strict';

// Independently specified from Microsoft's WM_MOUSEWHEEL contract:
// https://learn.microsoft.com/en-us/windows/win32/inputdev/wm-mousewheel
// Signed delta in HIWORD, currently held MK flags in LOWORD, signed SCREEN
// coordinates, delivered to focus. Zero DOM delta retains existing +120 behavior.
const assert = require('node:assert/strict');
const { Win98Renderer } = require('../lib/renderer');
const { BASE } = require('../lib/region-map.generated');
const canvas = { width: 640, height: 480, getContext() {
  return new Proxy({}, { get: (_, k) => k === 'measureText'
    ? () => ({ width: 0 }) : () => {} });
} };
const leftShift = { code: 'ShiftLeft', location: 1 };
const rightShift = { code: 'ShiftRight', location: 2 };
const leftCtrl = { code: 'ControlLeft', location: 1 };
const rightCtrl = { code: 'ControlRight', location: 2 };
const cases = [
  ['bare', [], 0],
  ['generic Shift', [[16]], 4],
  ['generic Ctrl', [[17]], 8],
  ['generic both', [[16], [17]], 12],
  ['generic releases undrained', [[16], [17], [-16], [-17]], 0],
  ['left Shift', [[16, leftShift]], 4],
  ['right Ctrl', [[17, rightCtrl]], 8],
  ['sided releases undrained', [[16, leftShift], [17, rightCtrl], [-16, leftShift], [-17, rightCtrl]], 0],
  ['both Shift sides one released', [[16, leftShift], [16, rightShift], [-16, leftShift]], 4],
  ['both Ctrl sides one released', [[17, leftCtrl], [17, rightCtrl], [-17, rightCtrl]], 8],
  ['both sides released', [[16, leftShift], [16, rightShift], [17, leftCtrl],
    [17, rightCtrl], [-16, rightShift], [-16, leftShift], [-17, leftCtrl], [-17, rightCtrl]], 0],
  ['release then repress', [[16], [-16], [16, rightShift], [17, rightCtrl]], 12],
];
const memory = new WebAssembly.Memory({ initial: 2048, maximum: 2048, shared: true });
const words = new Int32Array(memory.buffer);
const di = BASE.DI_MOUSE_INPUT_STATE >>> 2;
const failures = [];
let count = 0;
for (const route of ['focus', 'EDIT', 'disabled', 'no-focus', 'no-callback', 'exclusive']) {
  for (const held of [0, 1, 2, 3]) for (const deltaY of [-1, 0, 1]) {
    for (const [name, keys, flags] of cases) {
      const r = new Win98Renderer(canvas), sent = [], foreign = [];
      const owner = { exports: {
        get_focus_hwnd: () => route === 'no-focus' ? 0 : 101,
        ctrl_get_class: () => route === 'EDIT' ? 2 : 0,
        wnd_top_level: () => 100,
        get_capture_hwnd: () => 200,
        send_message: (hwnd, msg, wParam, lParam) => sent.push({ hwnd, msg, wParam, lParam }),
      } };
      const sibling = { exports: { get_focus_hwnd: () => 201,
        send_message: (...args) => foreign.push(args) } };
      r.wasm = owner; r.wasmMemory = memory;
      const win = { hwnd: 100, visible: true, isChild: false, x: 40, y: 50,
        w: 200, h: 160, style: route === 'disabled' ? 0x08000000 : 0,
        zOrder: 1, wasm: owner, wasmMemory: memory };
      r.windows[100] = win;
      r.windows[200] = { ...win, hwnd: 200, wasm: sibling, zOrder: 2 };
      // Physical button handlers run outside either window. Wheel must neither
      // hit-test there nor follow another process's capture or scheduler slice.
      if (held & 1) r.handleMouseDown(600, 450, 0);
      if (held & 2) r.handleMouseDown(600, 450, 2);
      r._foregroundWindow = win;
      for (const [vk, info] of keys) {
        if (vk > 0) r.handleKeyDown(vk, info);
        else r.handleKeyUp(-vk, info);
      }
      const label = `${route}/${held}/${deltaY}/${name}`;
      try {
        assert.equal(r._mouseButtonsMask || 0, held, 'real held buttons');
        assert.equal(!!r.peekKeyDownState(16), !!(flags & 4), 'physical Shift setup');
        assert.equal(!!r.peekKeyDownState(17), !!(flags & 8), 'physical Ctrl setup');
        const queue = r.inputQueue.slice();
        const presses = JSON.stringify(r._asyncPressedKeys);
        const before = Atomics.load(words, di + 71);
        const tail = Atomics.load(words, di + 3) >>> 0;
        if (route === 'no-callback') delete owner.exports.send_message;
        r.refreshInputPresentation = () => {};
        if (route === 'exclusive') r._exclusiveTransform = { hwnd: 100,
          srcX: -160, srcY: -100, srcW: 320, srcH: 200,
          dstX: 0, dstY: 0, dstW: 640, dstH: 400 };
        r.wasm = sibling;
        sent.length = 0; foreign.length = 0;
        r.handleWheel(route === 'exclusive' ? 100 : -71,
          route === 'exclusive' ? 80 : -29, deltaY);
        const delta = deltaY > 0 ? -120 : 120;
        assert.equal(Atomics.load(words, di + 71) - before, delta, 'DirectInput signed notch');
        assert.equal(Atomics.load(words, di + 3) >>> 0, tail + 1, 'one DI record');
        const event = Atomics.load(words, di + 4 + (tail & 63));
        assert.equal(event >>> 28, 9, 'DI wheel record type');
        assert.equal(event << 4 >> 4, delta, 'DI wheel record delta');
        assert.deepEqual(r.inputQueue, queue, 'keyboard queue stays undrained');
        assert.equal(JSON.stringify(r._asyncPressedKeys), presses, 'peek preserves press bits');
        assert.deepEqual(foreign, [], 'foreground process owns wheel');
        const wheels = sent.filter(e => e.msg === 0x20a);
        if (route === 'no-focus' || route === 'no-callback') {
          assert.deepEqual(wheels, [], 'no USER wheel without focus/callback');
        } else {
          assert.equal(wheels.length, 1, 'one USER wheel');
          const e = wheels[0];
          assert.equal(e.hwnd, 101, 'focus wins over pointer/capture/sibling');
          assert.equal(e.wParam >> 16, delta, 'signed high word');
          assert.equal(e.lParam << 16 >> 16, route === 'exclusive' ? -110 : -71, 'signed SCREEN X');
          assert.equal(e.lParam >> 16, route === 'exclusive' ? -60 : -29, 'signed SCREEN Y');
          assert.equal(e.wParam & 0xffff, flags | held, 'physical MK flags');
        }
      } catch (error) { failures.push({ label, error: error.message, sent }); }
      count++;
      // Fresh physical ring per case, without allocating a new large memory.
      words.fill(0, di, di + 72);
    }
  }
}
console.log(JSON.stringify({ count, failures }, null, 2));
assert.equal(failures.length, 0, `${failures.length}/${count} wheel cases failed`);
