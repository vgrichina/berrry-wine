#!/usr/bin/env node
'use strict';

// An 8bpp DirectDraw surface must describe itself as DDPF_PALETTEINDEXED8 with
// no RGB masks, and GetPalette must hand back an object bound to the palette
// the surface actually carries. When either half lies, a caller that converts
// palettized art to 16bpp reads index bytes through 5-6-5 masks (dark blue
// noise) or reads an all-zero colour table (black silhouettes) -- both of which
// d3drm did to Organic Art's leaf textures.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_ddpf_present_pixel") (param $surface i32) (param $hdc i32) (param $index i32)
    (local $entry i32) (local $bits i32)
    (local.set $entry (call $dx_from_this (local.get $surface)))
    (local.set $bits (load.field DxObject misc1 (local.get $entry)))
    (i32.store8 (i32.add (local.get $bits)
      (i32.add (i32.mul (load.field DxObject pitch (local.get $entry)) (i32.const 4)) (i32.const 4)))
      (local.get $index))
    (call $dx_blit_entry_rect_to_hdc (local.get $entry) (local.get $hdc)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 32) (i32.const 32)))
  (func (export "test_ddpf_set_entries") (param $pal i32) (param $start i32) (param $count i32) (param $entries i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDrawPalette_SetEntries (local.get $pal) (i32.const 0)
      (local.get $start) (local.get $count) (local.get $entries) (i32.const 0)))
  (func (export "test_ddpf_seed") (param $ddraw_vtbl i32) (param $surface_vtbl i32) (param $pal_vtbl i32)
    (global.set $DX_VTBL_DDRAW (local.get $ddraw_vtbl))
    (global.set $DX_VTBL_DDSURF2 (local.get $surface_vtbl))
    (global.set $DX_VTBL_DDPAL (local.get $pal_vtbl)))
  (func (export "test_ddpf_create") (param $desc i32) (param $out i32) (result i32)
    (local $ddraw i32)
    (local.set $ddraw (call $dx_create_com_obj (i32.const 1) (global.get $DX_VTBL_DDRAW)))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDraw_CreateSurface
      (local.get $ddraw) (local.get $desc) (local.get $out) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_ddpf_get_pixel_format") (param $surface i32) (param $pf i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDrawSurface_GetPixelFormat
      (local.get $surface) (local.get $pf) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_ddpf_get_surface_desc") (param $surface i32) (param $desc i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDrawSurface_GetSurfaceDesc
      (local.get $surface) (local.get $desc) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_ddpf_create_palette") (param $entries i32) (param $out i32) (result i32)
    (local $ddraw i32)
    (local.set $ddraw (call $dx_create_com_obj (i32.const 1) (global.get $DX_VTBL_DDRAW)))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDraw_CreatePalette
      (local.get $ddraw) (i32.const 0) (local.get $entries) (local.get $out)
      (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_ddpf_set_palette") (param $surface i32) (param $pal i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDrawSurface_SetPalette
      (local.get $surface) (local.get $pal) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_ddpf_palette_data") (param $pal i32) (result i32)
    (i32.load offset=20 (call $dx_from_this (local.get $pal))))
  (func (export "test_ddpf_get_palette") (param $surface i32) (param $out i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDrawSurface_GetPalette
      (local.get $surface) (local.get $out) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_ddpf_get_entries") (param $pal i32) (param $count i32) (param $out i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDrawPalette_GetEntries
      (local.get $pal) (i32.const 0) (i32.const 0) (local.get $count)
      (local.get $out) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
`;

const DDPF_RGB = 0x40;
const DDPF_PALETTEINDEXED8 = 0x20;

const createSurface = (wat, desc, out, bpp, caps) => {
  for (let i = 0; i < 128; i += 4) wat.guest_write32(desc + i, 0);
  wat.guest_write32(desc, 108);
  wat.guest_write32(desc + 4, 0x1007);   // CAPS|HEIGHT|WIDTH|PIXELFORMAT
  wat.guest_write32(desc + 8, 32);       // dwHeight
  wat.guest_write32(desc + 12, 32);      // dwWidth
  wat.guest_write32(desc + 72, 32);      // ddpfPixelFormat.dwSize
  wat.guest_write32(desc + 76, bpp === 8 ? (DDPF_RGB | DDPF_PALETTEINDEXED8) : DDPF_RGB);
  wat.guest_write32(desc + 84, bpp);     // dwRGBBitCount
  wat.guest_write32(desc + 104, caps);
  assert.strictEqual(wat.test_ddpf_create(desc, out) >>> 0, 0);
  const surface = wat.guest_read32(out) >>> 0;
  assert(surface, `surface should be published for ${bpp}bpp`);
  return surface;
};

(async () => {
  const h = await bootRenderHarness({ extraWat });
  const wat = h.exports;
  const desc = 0x410000;
  const out = 0x410200;
  const pf = 0x410240;
  const query = 0x410300;
  const entriesIn = 0x411000;
  const entriesOut = 0x412000;
  const palOut = 0x410280;

  wat.test_ddpf_seed(0x51000000, 0x52000000, 0x53000000);

  // --- 8bpp offscreen: palettized, no masks -------------------------------
  const surf8 = createSurface(wat, desc, out, 8, 0x40); // OFFSCREENPLAIN
  assert.strictEqual(wat.test_ddpf_get_pixel_format(surf8, pf) >>> 0, 0);
  assert.strictEqual(wat.guest_read32(pf + 12) >>> 0, 8, '8bpp surface reports 8 bits');
  const flags8 = wat.guest_read32(pf + 4) >>> 0;
  assert(flags8 & DDPF_PALETTEINDEXED8,
    `8bpp surface must set DDPF_PALETTEINDEXED8 (got 0x${flags8.toString(16)})`);
  for (const off of [16, 20, 24]) {
    assert.strictEqual(wat.guest_read32(pf + off) >>> 0, 0,
      `a palettized format carries no RGB mask at +${off}`);
  }

  // GetSurfaceDesc must agree with GetPixelFormat.
  assert.strictEqual(wat.test_ddpf_get_surface_desc(surf8, query) >>> 0, 0);
  assert.strictEqual(wat.guest_read32(query + 84) >>> 0, 8);
  assert(wat.guest_read32(query + 76) & DDPF_PALETTEINDEXED8,
    'GetSurfaceDesc must report the same palettized format as GetPixelFormat');
  assert.strictEqual(wat.guest_read32(query + 88) >>> 0, 0,
    'GetSurfaceDesc must not leave a 5-6-5 red mask on a palettized surface');

  // --- 16bpp: RGB with 5-6-5 masks ----------------------------------------
  const surf16 = createSurface(wat, desc, out, 16, 0x40);
  assert.strictEqual(wat.test_ddpf_get_pixel_format(surf16, pf) >>> 0, 0);
  assert.strictEqual(wat.guest_read32(pf + 12) >>> 0, 16);
  assert.strictEqual(wat.guest_read32(pf + 4) >>> 0, DDPF_RGB,
    '16bpp surface is plain DDPF_RGB');
  assert.strictEqual(wat.guest_read32(pf + 16) >>> 0, 0xF800);
  assert.strictEqual(wat.guest_read32(pf + 20) >>> 0, 0x07E0);
  assert.strictEqual(wat.guest_read32(pf + 24) >>> 0, 0x001F);

  // --- GetPalette round trip ----------------------------------------------
  // Distinctive entries so an all-zero read-back cannot pass by accident.
  for (let i = 0; i < 256; i++) {
    wat.guest_write32(entriesIn + i * 4, 0x04000000 | (i * 7) & 0xFF | (((i * 3) & 0xFF) << 8) | (((255 - i) & 0xFF) << 16));
  }
  assert.strictEqual(wat.test_ddpf_create_palette(entriesIn, palOut) >>> 0, 0);
  const palette = wat.guest_read32(palOut) >>> 0;
  assert(palette, 'CreatePalette should publish an object');

  // An offscreen surface owns its palette, but it is not the display. This
  // distinction must survive process-shared DirectDraw state: in Worker mode
  // a secondary thread attaching an artwork palette must not turn the primary
  // framebuffer neon green/black by replacing its display palette.
  const displayPalette = 0x123456;
  wat.test_dx_set_primary_palette_wa(displayPalette);
  assert.strictEqual(wat.test_ddpf_set_palette(surf8, palette) >>> 0, 0);
  assert.strictEqual(wat.get_dx_primary_pal_wa() >>> 0, displayPalette,
    'attaching an offscreen palette must not replace the display palette');

  // The corresponding positive path matters too: attaching that palette to
  // the actual primary surface must publish it as the display palette.
  wat.test_dx_set_process_state(32, 32, 8, 1, 0, 0, displayPalette);
  const primary8 = createSurface(wat, desc, out, 8, 0x200); // PRIMARYSURFACE
  assert.strictEqual(wat.test_ddpf_set_palette(primary8, palette) >>> 0, 0);
  assert.strictEqual(wat.get_dx_primary_pal_wa() >>> 0,
    wat.test_ddpf_palette_data(palette) >>> 0,
    'attaching a primary-surface palette must publish the display palette');

  // A primary palette governs the actual indexed desktop, including the
  // GDI window backing used to present windowed DirectDraw pixels.
  wat.set_desktop_color_depth(8);
  const hwnd = 0x10001;
  h.renderer.createWindow(hwnd, 0x10000000, 0, 0, 32, 32, 'DD palette', 0);
  wat.wnd_table_set(hwnd, 0);
  wat.ctrl_set_geom(hwnd, 0, 0, 32, 32);
  wat.wnd_set_style_export(hwnd, 0x10000000);
  wat.test_gdi_client_rect_set(hwnd, 0, 0, 32, 32);
  const dc = wat.test_call_GetDC(hwnd);
  assert.strictEqual(wat.test_ddpf_set_palette(primary8, palette) >>> 0, 0);
  const color = wat.guest_read32(entriesIn + 37 * 4) >>> 0;
  wat.test_call_SetPixel(dc, 4, 4, color);
  const pixel = () => [...h.renderer.getWindowCanvas(hwnd).canvas.getContext('2d').getImageData(4, 4, 1, 1).data];
  assert.deepStrictEqual(pixel(), [color & 255, (color >>> 8) & 255, (color >>> 16) & 255, 255],
    'window backing must use colors attached to the indexed primary');

  wat.test_call_SetPixel(dc, 4, 4, 0);
  wat.test_ddpf_present_pixel(primary8, dc, 47);
  assert.deepStrictEqual(pixel(), [color & 255, (color >>> 8) & 255, (color >>> 16) & 255, 255],
    'DirectDraw indexed primary presentation preserves the attached palette color');
  wat.test_ddpf_present_pixel(primary8, dc, 0);
  assert.deepStrictEqual(pixel(), [0, 0, 0, 255], 'windowed static black is reserved');
  wat.test_ddpf_present_pixel(primary8, dc, 255);
  assert.deepStrictEqual(pixel(), [255, 255, 255, 255], 'windowed static white is reserved');
  wat.test_ddpf_present_pixel(primary8, dc, 47);
  const beforeOffscreen = pixel();
  for (let i = 0; i < 256; i++) wat.guest_write32(entriesOut + i * 4, 0x0000ff00);
  assert.strictEqual(wat.test_ddpf_create_palette(entriesOut, palOut + 12) >>> 0, 0);
  const otherPalette = wat.guest_read32(palOut + 12) >>> 0;
  wat.test_ddpf_set_palette(surf8, otherPalette);
  assert.deepStrictEqual(pixel(), beforeOffscreen, 'offscreen palette cannot recolor displayed pixels');
  wat.test_ddpf_set_palette(surf8, palette);
  wat.guest_write32(entriesIn + 37 * 4, 0x04ca3917);
  wat.test_ddpf_set_entries(palette, 37, 1, entriesIn + 37 * 4);
  assert.deepStrictEqual(pixel(), [23, 57, 202, 255],
    'primary palette update recolors retained pixels without another draw');

  wat.test_dx_set_process_state(32, 32, 8, 1, hwnd, 1, wat.get_dx_primary_pal_wa());
  const exclusiveDc = wat.test_call_GetDC(hwnd);
  wat.test_ddpf_present_pixel(primary8, exclusiveDc, 37);
  assert.deepStrictEqual(pixel(), [23, 57, 202, 255],
    'exclusive primary uses unshifted palette indices');

  for (let i = 0; i < 256; i++) wat.guest_write32(entriesOut + i * 4, 0xDEADBEEF);
  assert.strictEqual(wat.test_ddpf_get_palette(surf8, palOut + 8) >>> 0, 0);
  const fetched = wat.guest_read32(palOut + 8) >>> 0;
  assert(fetched, 'GetPalette should publish an object');

  assert.strictEqual(wat.test_ddpf_get_entries(fetched, 256, entriesOut) >>> 0, 0);
  for (let i = 0; i < 256; i++) {
    assert.strictEqual(wat.guest_read32(entriesOut + i * 4) >>> 0,
      wat.guest_read32(entriesIn + i * 4) >>> 0,
      `GetPalette->GetEntries must return the surface's own colour table (entry ${i})`);
  }

  console.log('PASS test-directdraw-palette-format');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
