#!/usr/bin/env node
'use strict';

// A DirectDraw surface DC's default clip is the whole surface. Delphi's
// TCanvas intersects the clip with the surface rectangle before every
// StretchBlt; with a 0x0 default the intersection was empty, the blit
// reported TRUE and wrote nothing, and Game Maker 5 runners (Castle of Elite)
// loaded every sprite surface black. Exercise the runner's exact chain:
// 24bpp DIB section -> screen-compatible bitmap -> surface DC, clipped.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const RegionMap = require('../lib/region-map.generated.js');

const DX_OBJECTS = RegionMap.BASE.DX_OBJECTS;
const DX_ENTRY_SIZE = 32;
const SRCCOPY = 0x00CC0020, WHITENESS = 0x00FF0062;

(async () => {
  const { exports: wat, memory } = await bootRenderHarness({ fonts: 'none' });
  const dv = () => new DataView(memory.buffer);
  const W = 4, H = 2;

  // 24bpp bottom-up DIB section: B=0x30 G=0x60 R=0xC0 everywhere.
  const bmi = wat.guest_alloc(44) >>> 0;
  for (let i = 0; i < 44; i += 4) wat.guest_write32(bmi + i, 0);
  wat.guest_write32(bmi, 40); wat.guest_write32(bmi + 4, W); wat.guest_write32(bmi + 8, H);
  wat.guest_write32(bmi + 12, 1 | (24 << 16));
  const ppv = wat.guest_alloc(4) >>> 0;
  const dib = wat.test_call_CreateDIBSection(0, bmi, 0, ppv, 0, 0) >>> 0;
  assert(dib, 'CreateDIBSection');
  const bits = wat.guest_read32(ppv) >>> 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = bits + y * 12 + x * 3;
    wat.guest_write32(a, ((wat.guest_read32(a) >>> 0) & 0xFF000000) | 0xC06030);
  }
  const dibDc = wat.test_call_CreateCompatibleDC(0) >>> 0;
  wat.test_call_SelectObject(dibDc, dib);

  const screen = wat.test_call_GetDC(0) >>> 0;
  const compatDc = wat.test_call_CreateCompatibleDC(screen) >>> 0;
  wat.test_call_SelectObject(compatDc, wat.test_call_CreateCompatibleBitmap(screen, W, H) >>> 0);
  wat.test_call_PatBlt(compatDc, 0, 0, W, H, WHITENESS);
  assert.strictEqual(wat.test_call_StretchBlt(compatDc, 0, 0, W, H, dibDc, 0, 0, W, H, SRCCOPY), 1);
  assert.strictEqual(wat.test_call_GetPixel(compatDc, 1, 1) >>> 0, 0x3060C0, 'DIB reaches the compatible bitmap');

  // A 32bpp DirectDraw surface, as IDirectDraw::CreateSurface records it.
  const slot = 9, hdc = 0x200000 + slot;
  const entry = DX_OBJECTS + slot * DX_ENTRY_SIZE;
  const stride = W * 4;
  const bitsWa = RegionMap.g2w(wat.guest_alloc(stride * H) >>> 0, wat.get_image_base());
  dv().setUint32(entry, 2, true);
  dv().setUint16(entry + 12, W, true); dv().setUint16(entry + 14, H, true);
  dv().setUint16(entry + 16, 32, true); dv().setUint16(entry + 18, stride, true);
  dv().setUint32(entry + 20, bitsWa, true);
  const texel = (x, y) => dv().getUint32(bitsWa + y * stride + x * 4, true) & 0xFFFFFF;

  assert.strictEqual(wat.test_gdi_dx_dc_bind(hdc), 1, 'GetDC binds the surface');
  // TCanvas.RequiredState(csHandleValid) -> IntersectClipRect(0, 0, W, H).
  assert.strictEqual(wat.test_gdi_dc_clip_intersect_rect(hdc, 0, 0, W, H), 2,
    'IntersectClipRect against the whole surface is SIMPLEREGION (2), not NULLREGION (1)');
  assert.strictEqual(wat.test_call_StretchBlt(hdc, 0, 0, W, H, compatDc, 0, 0, W, H, SRCCOPY), 1);
  assert.strictEqual(texel(1, 1), 0xC06030, 'the clipped StretchBlt writes the surface');
  assert.strictEqual(texel(W - 1, 0), 0xC06030, 'up to the surface edge');
  assert.strictEqual(wat.test_call_GetPixel(hdc, 1, 1) >>> 0, 0x3060C0, 'GetPixel reads it back');

  // A clip smaller than the surface still clips.
  wat.test_gdi_dx_dc_release(hdc);
  new Uint8Array(memory.buffer).fill(0, bitsWa, bitsWa + stride * H);
  assert.strictEqual(wat.test_gdi_dx_dc_bind(hdc), 1);
  wat.test_gdi_dc_clip_intersect_rect(hdc, 0, 0, 2, H);
  wat.test_call_StretchBlt(hdc, 0, 0, W, H, compatDc, 0, 0, W, H, SRCCOPY);
  assert.deepStrictEqual([texel(1, 0), texel(2, 0)], [0xC06030, 0], 'a 2-wide clip keeps columns 2..3 untouched');
  wat.test_gdi_dx_dc_release(hdc);
  console.log('PASS DirectDraw surface DC: default clip is the surface; clipped StretchBlt from a DIB-fed DDB lands');
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
