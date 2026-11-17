#!/usr/bin/env node
'use strict';

// tl;dr: the exclusive compositor scales a GPU frame layer by ITS OWN size.
//
//   node test/test-gpu-layer-exclusive-mode-switch.js
//
//   window 800x600 (mode)   GDI back canvas 640x480 (stale)   Glide layer 800x600
//                 \___________ exclusive transform 800 -> 640 (x0.8) ________/
//   expected: layer fills the 640x480 screen; bug: layer stretched to the back
//   canvas (640x480) and then by 0.8 again = 512x384 in the top-left corner.
//
// Diablo II's Glide renderer opens grSstWinOpen at 640x480 for the intro and
// reopens it at 800x600 for the menus. The open resizes the window, but the
// window's GDI surface is only reallocated when the next DC is handed out
// (gdi_window_surface_ensure), and D2 draws its menus through Glide alone, so
// the back canvas keeps the 640x480 it had. The exclusive compositor drew the
// GPU layer at the back canvas's scaled size, so the 800x600 menu came out in
// the top-left 512x384 of the screen. Every other composite path (windowed,
// child, presentation source) already draws a layer at its own size.

const assert = require('assert');
const { createCanvas } = require('../lib/canvas-compat');
const { Win98Renderer } = require('../lib/renderer');

function solid(w, h, color) {
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  return c;
}

function run(layer, backW, backH) {
  const renderer = new Win98Renderer(createCanvas(640, 480));
  const hwnd = 0x10001;
  // The guest's own instance says it holds the display exclusively at 800x600.
  const exports = {
    get_dx_exclusive_hwnd: () => hwnd,
    get_display_fullscreen: () => 1,
    get_display_mode_active: () => 1,
    get_display_mode_w: () => 800,
    get_display_mode_h: () => 600,
  };
  const win = renderer.windows[hwnd] = {
    hwnd, x: 0, y: 0, w: 800, h: 600, visible: true, isChild: false, style: 0x80000000,
    clientRect: { x: 0, y: 0, w: 800, h: 600 },
    wasm: { exports },
    _backCanvas: solid(backW, backH, '#0000ff'),
    _gdiWriteSeq: 0,
  };
  win._dxFrameLayer = win._gpuFrameLayer = layer;
  renderer._repaintOnce();
  assert(renderer._exclusiveFullscreen, 'the window owns the display');
  const t = renderer._exclusiveTransform;
  assert.deepStrictEqual([t.srcW, t.srcH, t.dstW, t.dstH], [800, 600, 640, 480],
    'mode 800x600 fit onto the 640x480 screen');
  const ctx = renderer.canvas.getContext('2d');
  return (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data).slice(0, 3);
}

const RED = [255, 0, 0], GREEN = [0, 255, 0];

// 1. Diablo II Glide menu: layer 800x600 over a stale 640x480 GDI surface.
{
  const at = run({ kind: 'gpu', api: 'glide', canvas: solid(800, 600, '#ff0000'), writeSeq: 1 }, 640, 480);
  assert.deepStrictEqual(at(10, 10), RED, 'top-left is the Glide frame');
  assert.deepStrictEqual(at(600, 450), RED,
    'below-right of 512x384 is still the Glide frame (was the stale GDI surface / black)');
  assert.deepStrictEqual(at(639, 479), RED, 'the frame reaches the bottom-right pixel');
  console.log('ok - GPU layer over a stale-size GDI surface fills the exclusive screen');
}

// 2. The ordinary case is unchanged: GDI surface and layer both window-sized.
{
  const at = run({ kind: 'gpu', api: 'glide', canvas: solid(800, 600, '#ff0000'), writeSeq: 1 }, 800, 600);
  assert.deepStrictEqual(at(10, 10), RED);
  assert.deepStrictEqual(at(639, 479), RED);
  console.log('ok - window-sized GDI surface: GPU layer still fills the screen');
}

// 3. A DirectDraw layer is built window-sized from the back canvas and keeps
//    being stretched over it, as before.
{
  const at = run({ canvas: solid(640, 480, '#00ff00'), writeSeq: 1 }, 640, 480);
  assert.deepStrictEqual(at(10, 10), GREEN);
  assert.deepStrictEqual(at(500, 370), GREEN, 'DirectDraw layer drawn over the back canvas rect');
  console.log('ok - DirectDraw (non-GPU) layer path unchanged');
}

console.log('test-gpu-layer-exclusive-mode-switch: PASS');
