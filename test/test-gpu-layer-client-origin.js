#!/usr/bin/env node
'use strict';

// A GPU frame layer -- the WebGL D3D9 back buffer, an OpenGL drawable -- is
// the window's client area, so in a captioned window it starts at the client
// origin. A DirectDraw layer is built window-sized and window-local
// (host-imports places the client area into it; test-dx-present-window-placement)
// and stays at the window origin. UT2003/UT2004 under --headless-gl were
// drawn at the window origin, over the caption, 4 px left of and 24 px above
// where their input landed.

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

const renderer = new Win98Renderer(createCanvas(40, 30));
const hwnd = 0x100;
// Window at (5,3), 20x16; client 16x10 at screen (7,7): 2 px border, 4 rows
// of caption.
const win = renderer.windows[hwnd] = {
  hwnd, x: 5, y: 3, w: 20, h: 16, visible: true, isChild: false,
  clientRect: { x: 7, y: 7, w: 16, h: 10 },
  _backCanvas: solid(20, 16, '#808080'),
  // The caption was painted after the present, so the stacked source keeps it.
  _gdiWriteSeq: 5,
};
const gpu = solid(16, 10, '#ff0000');
win._dxFrameLayer = { canvas: gpu, kind: 'gpu', writeSeq: 1 };

assert.deepStrictEqual(renderer._frameLayerOffset(win, win._dxFrameLayer), { x: 2, y: 4 },
  'GPU layer offset is client origin - window origin');

// The window-local presentation source (post-processing, exclusive views).
for (const stack of [null, [win]]) {
  const source = renderer._buildExclusivePresentationSource(win, stack, 1);
  const at = (x, y) => Array.from(source.getContext('2d').getImageData(x, y, 1, 1).data).slice(0, 3);
  assert.deepStrictEqual(at(2, 4), [255, 0, 0], `source: GPU layer at the client offset (stack=${!!stack})`);
  assert.deepStrictEqual(at(17, 13), [255, 0, 0], `source: GPU layer bottom-right (stack=${!!stack})`);
  assert.deepStrictEqual(at(0, 0), [128, 128, 128], `source: window corner stays GDI (stack=${!!stack})`);
  assert.deepStrictEqual(at(1, 3), [128, 128, 128], `source: caption row stays GDI (stack=${!!stack})`);
}

// The ordinary windowed compositor: a WS_OVERLAPPEDWINDOW whose client rect
// the renderer derives itself (caption + border), blitted by _repaintOnce.
const winR = new Win98Renderer(createCanvas(80, 60));
const framed = winR.windows[0x200] = {
  hwnd: 0x200, x: 5, y: 3, w: 40, h: 36, visible: true, isChild: false,
  style: 0x00CF0000, title: 't', _backCanvas: solid(40, 36, '#808080'), _gdiWriteSeq: 5,
};
const gpu2 = solid(16, 10, '#ff0000');
framed._dxFrameLayer = { canvas: gpu2, kind: 'gpu', writeSeq: 1 };
const blits = [];
const realBlit = winR._blitSurface.bind(winR);
winR._blitSurface = (canvas, x, y, w, h) => { blits.push({ canvas, x, y }); return realBlit(canvas, x, y, w, h); };
winR._repaintOnce();
const gpuBlit = blits.find(b => b.canvas === gpu2);
assert(gpuBlit, 'windowed compositor blits the GPU layer');
assert(framed.clientRect.y > framed.y, 'the framed window has a caption');
assert.deepStrictEqual({ x: gpuBlit.x, y: gpuBlit.y },
  { x: framed.clientRect.x, y: framed.clientRect.y },
  'windowed compositor blits the GPU layer at the client origin, not the window origin');

// DirectDraw layer: window-sized and window-local, unchanged.
win._dxFrameLayer = { canvas: solid(20, 16, '#0000ff'), writeSeq: 2 };
assert.deepStrictEqual(renderer._frameLayerOffset(win, win._dxFrameLayer), { x: 0, y: 0 },
  'DirectDraw layers keep the window origin');
// A captionless (fullscreen-style) GPU window: client origin == window origin.
win.clientRect = { x: 5, y: 3, w: 20, h: 16 };
win._dxFrameLayer = { canvas: solid(20, 16, '#00ff00'), kind: 'gpu', writeSeq: 3 };
assert.deepStrictEqual(renderer._frameLayerOffset(win, win._dxFrameLayer), { x: 0, y: 0 },
  'captionless GPU window is unchanged');

console.log(`PASS  GPU frame layers composite at the client origin; DirectDraw layers at the window origin`);
