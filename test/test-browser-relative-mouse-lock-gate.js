#!/usr/bin/env node
'use strict';

const assert = require('assert');

const listeners = new Map();
const addListener = (type, fn) => listeners.set(type, fn);
const classNames = new Set();
const lockRequests = [];
const canvas = {
  width: 640,
  height: 480,
  style: {},
  classList: {
    toggle(name, enabled) {
      if (enabled) classNames.add(name);
      else classNames.delete(name);
    },
  },
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 480 }),
  addEventListener: addListener,
  removeEventListener() {},
  setAttribute() {},
  focus() {},
  webkitRequestPointerLock(options) {
    lockRequests.push(options);
  },
};

global.window = {
  addEventListener: addListener,
  removeEventListener() {},
  MobileKeyboard: null,
};
global.document = {
  pointerLockElement: null,
  webkitPointerLockElement: null,
  body: {},
  documentElement: {},
  activeElement: canvas,
  visibilityState: 'visible',
  getElementById: () => null,
  querySelectorAll: () => [],
  addEventListener: addListener,
  elementFromPoint: () => null,
};

const realSetInterval = global.setInterval;
const realClearInterval = global.clearInterval;
const intervals = [];
global.setInterval = fn => { intervals.push(fn); return intervals.length; };
global.clearInterval = () => {};

const calls = { absolute: [], relative: [], hover: [] };
let wantsRelative = false;
const runningApps = [{ name: 'quake2_demo', relativeMouse: true, wine: { running: true } }];
const renderer = {
  windows: {},
  _exclusiveTransform: { hwnd: 1 },
  wantsRelativeMouse: (x, y, explicit) => explicit === true,
  wantsHiddenMouse: () => wantsRelative,
  handleMouseMove: (x, y) => calls.absolute.push([x, y]),
  handleRelativeMouseMove: (x, y) => calls.relative.push([x, y]),
  handleMenuHover: (x, y) => calls.hover.push([x, y]),
  handleMouseDown() {},
  handleMouseUp() {},
  handleWheel() {},
};

try {
  const browserInput = require('../lib/browser-input');
  browserInput.wireCanvasInput(canvas, renderer, { runningApps, debugMode: false });

  canvas.onmousemove({ clientX: 520, clientY: 240, movementX: 200, movementY: 0 });
  assert.deepStrictEqual(calls.absolute, [],
    'absolute DOM motion must not enter a relative guest while Pointer Lock is pending');
  assert.deepStrictEqual(calls.hover, [],
    'relative capture mode must not leak the pending absolute point through menu hover');

  canvas.onmousedown({
    clientX: 320, clientY: 240, button: 0, buttons: 1,
    ctrlKey: false, shiftKey: false, preventDefault() {},
  });
  assert.deepStrictEqual(lockRequests, [undefined],
    'WebKit-only capture must make one optionless request synchronously inside the trusted click');
  listeners.get('mousemove')({
    clientX: 500, clientY: 240, movementX: 180, movementY: 0, buttons: 1,
    preventDefault() {}, stopPropagation() {},
  });
  assert.deepStrictEqual(calls.absolute, [],
    'motion during asynchronous Pointer Lock acquisition must not become an absolute jump');
  listeners.get('mouseup')({
    clientX: 500, clientY: 240, button: 0,
    preventDefault() {}, stopPropagation() {},
  });

  document.webkitPointerLockElement = canvas;
  canvas.onmousemove({ clientX: 0, clientY: 0, movementX: 7, movementY: -3 });
  assert.deepStrictEqual(calls.relative, [[7, -3]],
    'Pointer Lock movement should still enter the relative mouse path');

  document.webkitPointerLockElement = null;
  runningApps.length = 0;
  canvas.onmousemove({ clientX: 123, clientY: 234, movementX: 1, movementY: 2 });
  assert.deepStrictEqual(calls.absolute, [[123, 234]],
    'ordinary desktop guests must retain absolute mouse movement');
  assert.deepStrictEqual(calls.hover, [[123, 234]],
    'ordinary desktop hover behavior must remain intact');

  // Exercise the real recentring/DI policy through the DOM bridge, including
  // asynchronous acquisition and exit. No wasm or browser process is needed.
  class InputRenderer {}
  require('../lib/renderer-input').installInputHandlers(InputRenderer);
  const policy = InputRenderer.prototype;
  const realPerformance = global.performance;
  let now = 1000, diHint = 0, exits = 0, ups = 0;
  global.performance = { now: () => now };
  try {
    for (const name of ['wantsRelativeMouse', '_autoRelativeMouse', '_noteCursorWarp']) {
      renderer[name] = policy[name];
    }
    renderer._mapExclusiveInputPoint = (x, y) => ({ x, y });
    renderer._unmapExclusiveInputPoint = (x, y) => ({ x, y });
    renderer._mouseX = 320;
    renderer._mouseY = 240;
    renderer._inputWasmAtPoint = () => ({ exports: { get_mouse_capture_hint: () => diHint } });
    renderer.handleMouseUp = () => { ups++; };
    const tick = () => intervals[0]();
    const event = (x = 320, y = 240) => ({ clientX: x, clientY: y,
      button: 0, buttons: 1, movementX: 511, movementY: 277,
      preventDefault() {}, stopPropagation() {} });
    const down = () => canvas.onmousedown(event());
    const up = () => listeners.get('mouseup')(event());
    const acquire = () => {
      document.webkitPointerLockElement = canvas;
      listeners.get('webkitpointerlockchange')();
    };
    const unlock = () => {
      document.webkitPointerLockElement = null;
      listeners.get('webkitpointerlockchange')();
    };
    document.webkitExitPointerLock = function() {
      assert.strictEqual(this, document, 'prefixed exit keeps its receiver');
      exits++; // Browser confirmation arrives separately via unlock().
    };
    const arm = () => {
      for (let i = 0; i < 3; i++) {
        now += 16;
        renderer._noteCursorWarp(320, 240);
      }
    };
    runningApps.push({ wine: { running: true } });
    arm(); down(); acquire(); up();
    now += 1900; tick();
    assert.strictEqual(exits, 0, 'recent recentering keeps automatic lock');
    now += 200; tick();
    assert.strictEqual(exits, 1, 'stationary auto expiry requests unlock');
    const before = calls.relative.length;
    canvas.onmousemove(event(222, 380));
    down(); tick();
    assert.strictEqual(exits, 1, 'pending exit is not requested repeatedly');
    assert.strictEqual(calls.relative.length, before, 'stale locked delta is discarded');
    assert.deepStrictEqual(calls.absolute.at(-1), [123, 234], 'frozen anchor is not absolute input');
    unlock();
    canvas.onmousemove(event(608, 393));
    assert.deepStrictEqual(calls.absolute.at(-1), [608, 393], 'first unlocked move is absolute');

    // Expiry must also be caught before input, even between timer ticks.
    arm(); down(); acquire(); up(); now += 2100;
    canvas.onmousemove(event());
    assert.strictEqual(exits, 2, 'event path releases expired automatic capture');
    unlock();

    // A held acquisition click is balanced when asynchronous exit completes.
    arm(); down(); acquire(); now += 2100; tick();
    const heldUps = ups;
    unlock();
    assert.strictEqual(ups, heldUps + 1, 'expiry balances the held guest button');
    canvas.onmousemove(event(600, 390));
    assert.deepStrictEqual(calls.absolute.at(-1), [600, 390], 'held-click cancellation clears relative gate');

    // The request may complete after its original automatic signal expires.
    arm(); down(); up(); now += 2100;
    acquire();
    assert.strictEqual(exits, 4, 'late acquisition is reconciled immediately');
    unlock();

    arm(); down(); acquire(); up(); now += 2100; diHint = 1; tick();
    assert.strictEqual(exits, 4, 'continuing exclusive DirectInput preserves capture');
    canvas.onmousemove(event());
    assert.strictEqual(calls.relative.length, before + 1, 'DI keeps relative movement');
    diHint = 0; now += 251; tick();
    assert.strictEqual(exits, 5, 'DI Unacquire releases automatic capture');
    unlock();

    runningApps[0].relativeMouse = true;
    down(); acquire(); up(); now += 5000; tick();
    assert.strictEqual(exits, 5, 'explicit relative profile has no automatic expiry');
    unlock();
    delete runningApps[0].relativeMouse;
    acquire(); tick();
    assert.strictEqual(exits, 5, 'externally acquired user lock is not owned by auto detection');
    unlock();

    // A failed request must not claim a later externally acquired lock.
    arm(); down(); up(); listeners.get('pointerlockerror')(); now += 2100;
    acquire(); tick();
    assert.strictEqual(exits, 5, 'failed automatic request relinquishes ownership');
    unlock();

    // Actual AVP2 native cadence after the three fast qualifying warps.
    arm(); down(); acquire(); up();
    const slowExits = exits;
    for (const gap of [355, 354, 580, 317, 511, 314, 831, 818, 990, 347]) {
      now += gap; renderer._noteCursorWarp(320, 240); tick();
      assert.strictEqual(exits, slowExits, 'continuing native recentering retains owned lock');
    }
    now += 2000; tick();
    assert.strictEqual(exits, slowExits + 1, 'stopping the slower loop still releases lock');
    unlock();

    // Modern API, including loss of exclusive presentation or the live app.
    canvas.requestPointerLock = () => lockRequests.push(undefined);
    document.exitPointerLock = function() {
      assert.strictEqual(this, document);
      exits++;
    };
    for (const reason of ['windowed', 'exited', 'explicit absolute']) {
      arm(); down(); acquire(); up();
      if (reason === 'windowed') renderer._exclusiveTransform = null;
      if (reason === 'exited') runningApps[0].wine.running = false;
      if (reason === 'explicit absolute') runningApps[0].relativeMouse = false;
      const previous = exits;
      tick();
      assert.strictEqual(exits, previous + 1, `${reason} retires owned automatic lock`);
      unlock();
      renderer._exclusiveTransform = { hwnd: 1 };
      runningApps[0].wine.running = true;
      delete runningApps[0].relativeMouse;
    }
  } finally {
    global.performance = realPerformance;
  }
} finally {
  global.setInterval = realSetInterval;
  global.clearInterval = realClearInterval;
}

console.log('PASS  Pointer Lock acquisition gate and automatic expiry lifecycle; explicit/DI/external controls');
