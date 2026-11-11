#!/usr/bin/env node
'use strict';

// Relative-mouse autodetection (docs/mouse-model-audit.md). An app with no
// registry choice (relativeMouse absent -> 'auto') gets Pointer Lock / the
// trackpad when the guest shows one of the two capture signals:
//   1. a SetCursorPos recentring loop (Quake II engine, Unreal, Anachronox),
//   2. a DirectInput mouse acquired DISCL_EXCLUSIVE (WAT get_mouse_capture_hint).
// A one-off warp (Diablo, Solitaire) must not arm it, the signal must lapse,
// and an explicit registry true/false still wins.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('../lib/canvas-compat');
const { Win98Renderer } = require('../lib/renderer');

let now = 1000;
global.performance = { now: () => now };

const renderer = new Win98Renderer(createCanvas(640, 480));
let captureHint = 0;
let hintCalls = 0;
const wasm = { exports: {
  get_mouse_capture_hint: () => { hintCalls++; return captureHint; },
  clip_cursor_active: () => 0,
} };
renderer.wasm = wasm;
renderer.windows[7] = {
  hwnd: 7, visible: true, isChild: false, x: 0, y: 0, w: 640, h: 480,
  clientRect: { x: 0, y: 0, w: 640, h: 480 }, zOrder: 1, wasm,
};
renderer._inputWasmAtPoint = () => wasm;

// Without exclusive presentation nothing is relative, whatever the guest does.
assert.strictEqual(renderer.wantsRelativeMouse(320, 240, 'auto'), false,
  'windowed apps keep absolute input');
renderer._exclusiveTransform = { hwnd: 7, srcX: 0, srcY: 0, srcW: 640, srcH: 480, dstX: 0, dstY: 0, dstW: 640, dstH: 480 };

assert.strictEqual(renderer.wantsRelativeMouse(320, 240, 'auto'), false, 'no signal: absolute');
assert.strictEqual(renderer.wantsRelativeMouse(320, 240, false), false, 'registry false stays absolute');
assert.strictEqual(renderer.wantsRelativeMouse(320, 240, true), true, 'registry true stays relative');

// 1. A one-off warp, and two warps to different points, do not arm it.
renderer.setMousePosition(100, 100);
now += 16; renderer.setMousePosition(500, 300);
now += 16; renderer.setMousePosition(320, 240);
now += 300;
assert.strictEqual(renderer.wantsRelativeMouse(320, 240, 'auto'), false,
  'scattered warps are not a recentring loop');

// Three warps to the same point within 500 ms of each other arm it.
now += 16; renderer.setMousePosition(320, 240);
now += 16; renderer.setMousePosition(321, 239);
assert.strictEqual(renderer.wantsRelativeMouse(320, 240, 'auto'), true,
  'three recentring warps arm relative input');
// It lapses 2 s after the last recentring warp (menus use the plain cursor).
now += 1900;
assert.strictEqual(renderer.wantsRelativeMouse(320, 240, 'auto'), true, 'still recentring-armed at 1.9 s');
now += 200;
assert.strictEqual(renderer.wantsRelativeMouse(320, 240, 'auto'), false, 'lapsed after 2 s');
// Slow warps (one per second) never form a loop.
for (let i = 0; i < 5; i++) { now += 1000; renderer.setMousePosition(320, 240); }
assert.strictEqual(renderer.wantsRelativeMouse(320, 240, 'auto'), false,
  'a warp per second to one point is not a frame loop');

// AVP2 native trace 20261111-1150: the loop continues through slower frames.
// These consecutive gaps include the actual pointer-lock loss, with no 2 s pause.
for (let i = 0; i < 3; i++) { now += 16; renderer.setMousePosition(320, 240); }
for (const gap of [355, 354, 580, 317, 511, 314, 831, 818, 990, 347]) {
  now += gap; renderer.setMousePosition(320, 240);
  assert.strictEqual(renderer.wantsRelativeMouse(320, 240, 'auto'), true,
    `established native recentering survives a ${gap} ms frame`);
}
now += 2000;
assert.strictEqual(renderer.wantsRelativeMouse(320, 240, 'auto'), false,
  'an established loop still expires when warps stop');
now += 1; renderer.setMousePosition(320, 240);
assert.strictEqual(renderer.wantsRelativeMouse(320, 240, 'auto'), false,
  'one warp after expiry cannot revive the old loop');

// 2. An exclusive DirectInput mouse arms it; the scan is polled at most every 250 ms.
now += 5000;
captureHint = 1;
hintCalls = 0;
assert.strictEqual(renderer.wantsRelativeMouse(320, 240, 'auto'), true, 'exclusive DI mouse arms relative input');
renderer.wantsRelativeMouse(320, 240, 'auto');
renderer.wantsRelativeMouse(320, 240, 'auto');
assert.strictEqual(hintCalls, 1, 'the DX-table scan is cached between polls');
captureHint = 0;
now += 100;
assert.strictEqual(renderer.wantsRelativeMouse(320, 240, 'auto'), true, 'cached for 250 ms');
now += 200;
assert.strictEqual(renderer.wantsRelativeMouse(320, 240, 'auto'), false, 'Unacquire disarms it at the next poll');
assert.strictEqual(hintCalls, 2);

// The browser shell keeps "absent" distinct from false, and browser-input asks
// the renderer in 'auto' mode for it.
const shell = fs.readFileSync(path.join(__dirname, '../lib/browser-shell.js'), 'utf8');
assert(shell.includes("relativeMouse: typeof app.relativeMouse === 'boolean' ? app.relativeMouse : undefined"),
  'browser shell passes an absent relativeMouse through as undefined');
const input = fs.readFileSync(path.join(__dirname, '../lib/browser-input.js'), 'utf8');
assert(input.includes("renderer.wantsRelativeMouse(canvasX, canvasY, 'auto')"),
  'browser input follows the runtime signals for apps without a registry choice');

// WAT side, through the compiled module: a DirectInput device (type 7) that is
// a mouse (misc0 kind 2), set up with DISCL_* bits as SetCooperativeLevel
// stores them, then taken through the real Acquire/Unacquire handlers.
(async () => {
  const { bootRenderHarness } = require('./render-helper');
  const extraWat = String.raw`
    (func (export "test_di_dev") (param $kind i32) (param $discl i32) (result i32)
      (local $obj i32) (local $entry i32)
      (local.set $obj (call $dx_create_com_obj (i32.const 7) (global.get $DX_VTBL_DIDEV2)))
      (local.set $entry (call $dx_from_this (local.get $obj)))
      (store.field DxObject misc0 (local.get $entry) (local.get $kind))
      (store.field DxObject flags (local.get $entry)
        (i32.or (local.get $discl) (i32.or (global.get $DIDEV_FORMAT_SET) (global.get $DIDEV_COOP_SET))))
      (local.get $obj))
    (func (export "test_di_acquire") (param $obj i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
      (call $handle_IDirectInputDevice_Acquire (local.get $obj) (i32.const 0) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "test_di_unacquire") (param $obj i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
      (call $handle_IDirectInputDevice_Unacquire (local.get $obj) (i32.const 0) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
  `;
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const EXCLUSIVE = 1, NONEXCLUSIVE = 2, FOREGROUND = 4;
  assert.strictEqual(e.get_mouse_capture_hint(), 0, 'no DirectInput device: no hint');

  const keyboard = e.test_di_dev(1, EXCLUSIVE | FOREGROUND) >>> 0;
  assert.strictEqual(e.test_di_acquire(keyboard), 0);
  assert.strictEqual(e.get_mouse_capture_hint(), 0, 'an exclusive keyboard is not a captured mouse');

  const shared = e.test_di_dev(2, NONEXCLUSIVE | FOREGROUND) >>> 0;
  assert.strictEqual(e.test_di_acquire(shared), 0);
  assert.strictEqual(e.get_mouse_capture_hint(), 0, 'a nonexclusive mouse keeps the system cursor: absolute');

  const exclusive = e.test_di_dev(2, EXCLUSIVE | FOREGROUND) >>> 0;
  assert.strictEqual(e.get_mouse_capture_hint(), 0, 'not acquired yet');
  assert.strictEqual(e.test_di_acquire(exclusive), 0);
  assert.strictEqual(e.get_mouse_capture_hint(), 1, 'acquired exclusive mouse: capture');
  assert.strictEqual(e.test_di_unacquire(exclusive), 0);
  assert.strictEqual(e.get_mouse_capture_hint(), 0, 'Unacquire releases the hint');

  console.log('PASS  relative-mouse autodetect: recentring loop and exclusive DirectInput mouse arm it, warps and windowed apps do not, registry wins');
})().catch(err => { console.error(err && err.stack || err); process.exit(1); });
