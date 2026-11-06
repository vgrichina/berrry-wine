#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('../lib/canvas-compat');
const { Win98Renderer } = require('../lib/renderer');
// $DI_MOUSE_INPUT_STATE, from the map declared in src/00-regions.wat.
const RegionMap = require('../lib/region-map.generated.js');

const renderer = new Win98Renderer(createCanvas(1280, 960));
const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
renderer.wasmMemory = memory;
const guestExports = {
  clip_cursor_active: () => 1,
  clip_cursor_left: () => 100,
  clip_cursor_top: () => 50,
  clip_cursor_right: () => 740,
  clip_cursor_bottom: () => 530,
  wnd_mouse_msg_origin_x: () => 100,
  wnd_mouse_msg_origin_y: () => 50,
  post_message_q: () => 1,
};
const wasm = { exports: guestExports };
renderer.wasm = wasm;
renderer.windows[7] = {
  hwnd: 7, visible: true, isChild: false, x: 100, y: 50, w: 640, h: 480,
  clientRect: { x: 100, y: 50, w: 640, h: 480 }, zOrder: 1, wasm,
  wasmMemory: memory,
};
renderer._exclusiveTransform = {
  hwnd: 7,
  srcX: 100, srcY: 50, srcW: 640, srcH: 480,
  dstX: 0, dstY: 0, dstW: 1280, dstH: 960,
};

assert.strictEqual(renderer.wantsRelativeMouse(640, 480), false,
  'ClipCursor alone must not opt into browser pointer lock');
assert.strictEqual(renderer.wantsRelativeMouse(1279, 959, true), true,
  'the full clipped image remains eligible at its lower-right edge');

renderer.setMousePosition(420, 290); // guest SetCursorPos recenter
renderer.handleRelativeMouseMove(40, -20); // logical canvas delta at 2x scale
assert.strictEqual(renderer._mouseX, 440,
  'relative X should start at the guest cursor and cross the presentation transform once');
assert.strictEqual(renderer._mouseY, 280,
  'relative Y should start at the guest cursor and cross the presentation transform once');
const diWords = new Int32Array(memory.buffer);
const diMouseState = RegionMap.BASE.DI_MOUSE_INPUT_STATE >>> 2;
assert.deepStrictEqual([diWords[diMouseState], diWords[diMouseState + 1]], [20, -10],
  'physical relative motion should enter the process-shared DirectInput accumulator');
const move = renderer.inputQueue.find(event => event && event.msg === 0x0200);
assert(move, 'relative motion should enter the ordinary Win32 WM_MOUSEMOVE queue');
assert.strictEqual(move.lParam >>> 0, ((230 << 16) | 340) >>> 0,
  'queued client coordinates should describe the relative guest position');

renderer.setMousePosition(420, 290); // Quake recenters after consuming motion
assert.deepStrictEqual([diWords[diMouseState], diWords[diMouseState + 1]], [20, -10],
  'guest SetCursorPos must not manufacture DirectInput movement');
renderer.handleRelativeMouseMove(40, -20);
assert.deepStrictEqual([renderer._mouseX, renderer._mouseY], [440, 280],
  'a second physical delta must not accumulate the stale absolute DOM cursor');
assert.deepStrictEqual([diWords[diMouseState], diWords[diMouseState + 1]], [40, -20],
  'successive physical movement should accumulate until DirectInput consumes it');

// Pointer Lock delivers mouse COUNTS. A real 640x480 fullscreen game gets one
// pixel of its own mode per count, so 40 counts are 40 guest pixels (80 canvas
// pixels at this 2x presentation), not the 20 a picture-relative scale gives.
renderer.setMousePosition(420, 290);
diWords[diMouseState] = 0; diWords[diMouseState + 1] = 0;
renderer.handleRelativeMouseMove(40, -20, { guestCounts: true });
assert.deepStrictEqual([renderer._mouseX, renderer._mouseY], [460, 270],
  'mouse counts move the guest cursor one guest pixel per count');
assert.deepStrictEqual([diWords[diMouseState], diWords[diMouseState + 1]], [40, -20],
  'mouse counts reach DirectInput unscaled by the presentation stretch');

// FPS engines capture the mouse for aiming without holding any button.
// Capture changes the recipient, never the physical button mask.
guestExports.get_capture_hwnd = () => 7;
for (const mask of [0, 1, 2, 0]) {
  renderer.inputQueue.length = 0;
  renderer._mouseButtonsMask = mask;
  renderer.handleRelativeMouseMove(2, 0);
  const captured = renderer.inputQueue.find(e => e.msg === 0x0200);
  assert(captured, 'captured aiming queues mouse movement');
  assert.strictEqual(captured.wParam, mask,
    'capture must not invent Mouse1 when a finger only aims');
}
delete guestExports.get_capture_hwnd;

guestExports.clip_cursor_active = () => 0;
assert.strictEqual(renderer.wantsRelativeMouse(640, 480), false,
  'releasing ClipCursor should leave ordinary desktop pointer semantics intact');

const browserSource = fs.readFileSync(path.join(__dirname, '..', 'lib/browser-input.js'), 'utf8');
assert(browserSource.includes('canvas.requestPointerLock()'),
  'the trusted canvas mousedown path should request browser pointer lock');
assert(/handleRelativeMouseMove\(Number\(e\.movementX\)[^]*?guestCounts: true/.test(browserSource),
  'locked movementX/Y should enter the renderer relative-mouse path as mouse counts');

console.log('PASS  ClipCursor-gated pointer lock preserves relative guest mouse motion');

// Actual full-shell 1001x800 Aranna control: an 800x600 guest is
// presented into661x568 with a661x496 image at Y36. A recentered
// native(+96) Y move used to round-trip through395.999999 and lose a count.
renderer.canvas.width = 800; renderer.canvas.height = 600;
renderer._exclusiveTransform = { hwnd:7, srcX:0, srcY:0, srcW:800, srcH:600,
  dstX:0, dstY:0, dstW:800, dstH:600 };
renderer._exclusivePresentationViewport = { nativeX:0,nativeY:0,nativeW:800,nativeH:600,
  dstX:0,dstY:36,dstW:661,dstH:496,outputW:661,outputH:568 };
renderer._relativeMouseRemainderX = 0; renderer._relativeMouseRemainderY = 0;
for (const [dx,dy] of [[30,-145],[-60,96],[0,1],[1,0],[-1,-1]]) {
  renderer.setMousePosition(400,300);
  diWords[diMouseState]=0;diWords[diMouseState+1]=0;
  renderer.handleRelativeMouseMove(dx,dy,{guestCounts:true});
  assert.deepStrictEqual([renderer._mouseX,renderer._mouseY],[400+dx,300+dy],
    'locked counts survive the actual letterboxed cursor transform');
  assert.deepStrictEqual([diWords[diMouseState],diWords[diMouseState+1]],[dx,dy],
    'locked counts reach DirectInput exactly while guest warps add none');
}
console.log('PASS native counts preserve exact recentered motion across fractional letterboxing');
