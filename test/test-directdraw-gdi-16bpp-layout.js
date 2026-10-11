#!/usr/bin/env node
'use strict';

// GDI drawing into a 16bpp DirectDraw surface must use the layout the surface
// was created with. Re-Volt creates A1R5G5B5 texture pages and fills them by
// StretchBlt-ing LoadImage bitmaps through IDirectDrawSurface::GetDC; with
// GDI hard-wired to RGB565 every sampler decoded 565 texels as 1555 (grey road
// purple, wooden fence green, rainbow speckle where green's low bits vary).

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const RegionMap = require('../lib/region-map.generated.js');

const DX_OBJECTS = RegionMap.BASE.DX_OBJECTS;
const DX_ENTRY_SIZE = 32;
const extraWat = String.raw`
  (func (export "test_dx_surf_fmt_set") (param i32) (param i32)
    (call $dx_surf_fmt_set (local.get 0) (local.get 1)))
`;

(async () => {
  const { exports: wat, memory, gdi } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const dv = new DataView(memory.buffer);
  const slot = 9;
  const hdc = 0x200000 + slot;
  const entry = DX_OBJECTS + slot * DX_ENTRY_SIZE;
  const width = 4, height = 2, stride = width * 2;
  const bitsWa = RegionMap.g2w(wat.guest_alloc(stride * height) >>> 0, wat.get_image_base());
  dv.setUint32(entry, 2, true); // DDSurface
  dv.setUint16(entry + 12, width, true);
  dv.setUint16(entry + 14, height, true);
  dv.setUint16(entry + 16, 16, true);
  dv.setUint16(entry + 18, stride, true);
  dv.setUint32(entry + 20, bitsWa, true);
  const texel = (x, y) => dv.getUint16(bitsWa + y * stride + x * 2, true);

  // COLORREF is 0x00BBGGRR; full-scale channels pack exactly in every layout.
  const RED = 0x0000FF, GREEN = 0x00FF00, MAGENTA = 0xFF00FF;
  const cases = [
    // [fmt, name, red, green, magenta]
    [1, 'R5G6B5', 0xF800, 0x07E0, 0xF81F],
    [3, 'A1R5G5B5', 0x7C00, 0x03E0, 0x7C1F],
    [2, 'X1R5G5B5', 0x7C00, 0x03E0, 0x7C1F],
    [4, 'A4R4G4B4', 0x0F00, 0x00F0, 0x0F0F],
  ];
  for (const [fmt, name, red, green, magenta] of cases) {
    // The same slot is rebound with each layout in turn, as a released and
    // re-created DirectDraw surface would be.
    wat.test_dx_surf_fmt_set(entry, fmt);
    new Uint8Array(memory.buffer).fill(0, bitsWa, bitsWa + stride * height);
    assert.strictEqual(wat.test_gdi_dx_dc_bind(hdc), 1, `${name}: GetDC binds`);
    assert.strictEqual(wat.test_call_SetPixel(hdc, 0, 0, RED) >>> 0, RED, `${name}: SetPixel red`);
    assert.strictEqual(wat.test_call_SetPixel(hdc, 1, 0, GREEN) >>> 0, GREEN, `${name}: SetPixel green`);
    assert.strictEqual(wat.test_call_SetPixel(hdc, 2, 1, MAGENTA) >>> 0, MAGENTA, `${name}: SetPixel magenta`);
    assert.deepStrictEqual([texel(0, 0), texel(1, 0), texel(2, 1)], [red, green, magenta],
      `${name}: GDI writes the surface's own layout (alpha bits stay clear)`);
    assert.strictEqual(wat.test_call_GetPixel(hdc, 1, 0) >>> 0, GREEN, `${name}: GetPixel reads it back`);
    const presentation = gdi.surfacePresentations.get(hdc);
    presentation.flush();
    assert.deepStrictEqual([...presentation.canvas.getContext('2d').getImageData(0, 0, 1, 1).data],
      [255, 0, 0, 255], `${name}: host presentation decodes with the same masks`);
    wat.test_gdi_dx_dc_release(hdc);
  }
  console.log('PASS GDI on 16bpp DirectDraw surfaces follows each surface layout (565, 1555, 555, 4444), including slot reuse');
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
