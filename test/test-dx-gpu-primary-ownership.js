'use strict';
const assert = require('assert');
const { Canvas } = require('../lib/canvas-compat');
const { createHostImports } = require('../lib/host-imports');
const R = require('../lib/region-map.generated');

// A GPU primary's CPU DIB may still contain its pre-render pixels. An
// unrelated CPU offscreen upload must not acquire scan-out at a boundary.
for (const bpp of [8, 16, 32]) {
  const width = 320, height = 200, pitch = width * bpp / 8, hwnd = 17;
  const memory = new ArrayBuffer(128 * 1024 * 1024), dv = new DataView(memory);
  const bytes = new Uint8Array(memory), primaryDib = 0x40000, otherDib = 0x100000;
  const surface = (slot, dib, flags) => {
    const at = R.BASE.DX_OBJECTS + slot * 32;
    dv.setUint32(at, 2, true); dv.setUint16(at + 12, width, true);
    dv.setUint16(at + 14, height, true); dv.setUint16(at + 16, bpp, true);
    dv.setUint16(at + 18, pitch, true); dv.setUint32(at + 20, dib, true);
    dv.setUint32(at + 28, flags, true);
  };
  surface(1, primaryDib, 1); surface(2, otherDib, 4);
  bytes.fill(255, otherDib, otherDib + pitch * height);
  const gpuCanvas = new Canvas(width, height), gpuCtx = gpuCanvas.getContext('2d');
  gpuCtx.fillStyle = '#0000ff'; gpuCtx.fillRect(0, 0, width, height);
  const gpu = { kind: 'gpu', api: 'd3dim', canvas: gpuCanvas, w: width, h: height };
  const win = { x: 0, y: 0, w: width, h: height, _dxFrameLayer: gpu };
  let owner = 1, derived = true, target = hwnd, uploads = 0;
  const e = { get_main_hwnd: () => target, get_dx_present_hwnd: () => target,
    get_dx_exclusive_hwnd: () => hwnd, get_dx_primary_pal_wa: () => 0,
    d3dim_gps_window_primary_slot: h => h === hwnd ? owner : -1,
    d3dim_gps_dib_is_derived: (s, d) => derived && s === 1 && d === primaryDib };
  const { gdi, host } = createHostImports({ getMemory: () => memory, exports: e,
    renderer: { windows: { [hwnd]: win, 99: win }, getWindowCanvas: () => ({ctx: gpuCtx}),
      scheduleRepaint() { uploads++; } } });
  assert.strictEqual(gdi.presentBestDxOffscreen(true), 0, 'owned GPU primary suppresses unrelated CPU fallback');
  assert.strictEqual(win._dxFrameLayer, gpu);
  assert.strictEqual(uploads, 0);
  const all = Array.from(gpuCtx.getImageData(0, 0, width, height).data);
  assert(all.every((v, i) => v === [0, 0, 255, 255][i % 4]), 'whole GPU image remains blue');
  derived = false; // A retained Lock write supersedes GPU-derived bytes.
  assert.strictEqual(gdi.presentBestDxOffscreen(true), 1);
  assert.notStrictEqual(win._dxFrameLayer, gpu);
  const cpu = win._dxFrameLayer.canvas.getContext('2d').getImageData(0, 0, width, height).data;
  assert(Array.from(cpu).every((v, i) => v === (i % 4 === 3 ? 255 : 0)), 'whole authored CPU primary becomes black');
  owner = -1; host.dx_trace(22, 1); surface(1, primaryDib, 1);
  assert.strictEqual(gdi.presentBestDxOffscreen(true), 1);
  const fallback = win._dxFrameLayer.canvas.getContext('2d').getImageData(0, 0, width, height).data;
  assert(Array.from(fallback).every(v => v === 255), 'retirement/reuse does not inherit native ownership');
  owner = 1; derived = true; target = 99;
  assert.strictEqual(gdi.presentBestDxOffscreen(true), 1, 'foreign HWND receives no GPU pin');
}
console.log('PASS native GPU primary arbitration, whole pixels, retained CPU writes, retirement/reuse and foreign HWND');
