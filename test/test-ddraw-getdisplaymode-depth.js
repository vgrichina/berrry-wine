#!/usr/bin/env node
'use strict';

// IDirectDraw::GetDisplayMode reports the pitch and pixel format of the mode
// SetDisplayMode chose. It used to answer a 16bpp 5-6-5 format with a
// width*2 pitch for every mode, and Disciples (640x480x8) sized its software
// back buffer from that: its first SmackBlitClear then ran with a NULL buffer
// and a garbage pitch.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_dm_seed") (param $ddraw_vtbl i32)
    (global.set $DX_VTBL_DDRAW (local.get $ddraw_vtbl)))
  (func (export "test_dm_ddraw") (result i32)
    (call $dx_create_com_obj (i32.const 1) (global.get $DX_VTBL_DDRAW)))
  (func (export "test_dm_set") (param $dd i32) (param $w i32) (param $h i32) (param $bpp i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDraw_SetDisplayMode (local.get $dd) (local.get $w) (local.get $h)
      (local.get $bpp) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_dm_get") (param $dd i32) (param $desc i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDraw_GetDisplayMode (local.get $dd) (local.get $desc) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
`;

(async () => {
  const { exports: wat } = await bootRenderHarness({ extraWat });
  const desc = 0x410000;
  wat.test_dm_seed(0x51000000);
  const dd = wat.test_dm_ddraw() >>> 0;
  const mode = () => ({
    h: wat.guest_read32(desc + 8), w: wat.guest_read32(desc + 12), pitch: wat.guest_read32(desc + 16),
    pfFlags: wat.guest_read32(desc + 76) >>> 0, bpp: wat.guest_read32(desc + 84),
    r: wat.guest_read32(desc + 88) >>> 0, g: wat.guest_read32(desc + 92) >>> 0, b: wat.guest_read32(desc + 96) >>> 0,
  });

  // Before an explicit mode, DirectDraw and GDI describe the same desktop.
  wat.set_desktop_color_depth(8);
  assert.strictEqual(wat.test_dm_get(dd, desc) >>> 0, 0);
  assert.deepStrictEqual(mode(), { h: 480, w: 640, pitch: 640, pfFlags: 0x60, bpp: 8, r: 0, g: 0, b: 0 },
    'initial indexed desktop is reported before SetDisplayMode');
  wat.set_desktop_color_depth(32);
  assert.strictEqual(wat.test_dm_get(dd, desc) >>> 0, 0);
  assert.strictEqual(mode().bpp, 32, 'initial truecolor desktop');
  assert.strictEqual(mode().pitch, 2560, 'initial truecolor pitch');
  wat.set_desktop_color_depth(8);

  assert.strictEqual(wat.test_dm_set(dd, 640, 480, 8) >>> 0, 0);
  assert.strictEqual(wat.test_dm_get(dd, desc) >>> 0, 0);
  assert.deepStrictEqual(mode(), { h: 480, w: 640, pitch: 640, pfFlags: 0x60, bpp: 8, r: 0, g: 0, b: 0 },
    '8bpp: one byte per pixel, DDPF_RGB|DDPF_PALETTEINDEXED8, no masks');

  assert.strictEqual(wat.test_dm_set(dd, 800, 600, 16) >>> 0, 0);
  assert.strictEqual(wat.test_dm_get(dd, desc) >>> 0, 0);
  assert.deepStrictEqual(mode(), { h: 600, w: 800, pitch: 1600, pfFlags: 0x40, bpp: 16, r: 0xf800, g: 0x07e0, b: 0x001f },
    '16bpp keeps the 5-6-5 answer it always gave');

  assert.strictEqual(wat.test_dm_set(dd, 640, 480, 32) >>> 0, 0);
  assert.strictEqual(wat.test_dm_get(dd, desc) >>> 0, 0);
  assert.deepStrictEqual(mode(), { h: 480, w: 640, pitch: 2560, pfFlags: 0x40, bpp: 32, r: 0xff0000, g: 0xff00, b: 0xff },
    '32bpp: four bytes per pixel, 8-8-8 masks');
  console.log('PASS  GetDisplayMode reports the pitch and pixel format of the current mode');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
