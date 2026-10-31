'use strict';
const assert = require('assert');
const { Canvas } = require('../lib/canvas-compat');
const { createHostImports } = require('../lib/host-imports');
const RegionMap = require('../lib/region-map.generated');

// Present ownership cannot be inferred from pixel values: a cleared primary
// is a complete frame even when another surface contains a brighter image.
for (const bpp of [8, 16, 32]) {
  const width = 320, height = 200, pitch = width * bpp / 8;
  const memory = new ArrayBuffer(128 * 1024 * 1024);
  const bytes = new Uint8Array(memory), dv = new DataView(memory);
  const primary = 0x40000, offscreen = 0x100000, hwnd = 17;
  function surface(slot, dib, flags) {
    const at = RegionMap.BASE.DX_OBJECTS + slot * 32;
    dv.setUint32(at, 2, true);
    dv.setUint16(at + 12, width, true); dv.setUint16(at + 14, height, true);
    dv.setUint16(at + 16, bpp, true); dv.setUint16(at + 18, pitch, true);
    dv.setUint32(at + 20, dib, true); dv.setUint32(at + 28, flags, true);
  }
  surface(1, primary, 1); surface(2, offscreen, 4);
  bytes.fill(255, offscreen, offscreen + pitch * height);
  const canvas = new Canvas(width, height), win = { x: 0, y: 0, w: width, h: height };
  const { host, gdi } = createHostImports({ getMemory: () => memory,
    exports: { get_main_hwnd: () => hwnd, get_dx_primary_pal_wa: () => 0 },
    renderer: { windows: { [hwnd]: win },
      getWindowCanvas: () => ({ ctx: canvas.getContext('2d') }), scheduleRepaint() {} } });
  const pixel = () => Array.from(win._dxFrameLayer.canvas.getContext('2d').getImageData(0, 0, 1, 1).data);
  gdi.presentBestDxOffscreen(true);
  assert.deepStrictEqual(pixel(), [255, 255, 255, 255], 'unowned fallback is available');
  host.dx_trace(5, 1);
  assert.strictEqual(gdi.presentBestDxOffscreen(true), 1);
  assert.deepStrictEqual(pixel(), [0, 0, 0, 255], `${bpp}-bit explicit black frame must replace unrelated white offscreen`);
  bytes.fill(0x88, primary, primary + pitch * height);
  gdi.presentBestDxOffscreen(true);
  assert.notDeepStrictEqual(pixel(), [0, 0, 0, 255], 'retained primary writes remain visible');
  bytes.fill(0, primary, primary + pitch * height);
  gdi.presentBestDxOffscreen(true);
  assert.deepStrictEqual(pixel(), [0, 0, 0, 255], 'clearing a retained primary does not relinquish ownership');
  host.dx_trace(22, 1);
  surface(1, primary, 1); // Reusing a retired slot does not restore its old pin.
  gdi.presentBestDxOffscreen(true);
  assert.deepStrictEqual(pixel(), [255, 255, 255, 255], 'actual retirement restores fallback selection');
  host.dx_trace(5, 1);
  gdi.presentBestDxOffscreen(true);
  assert.deepStrictEqual(pixel(), [0, 0, 0, 255], 'the replacement primary can explicitly present black');
}
console.log('PASS explicit primary ownership for black 8/16/32-bit frames, retained writes, clear and slot retirement/reuse');
