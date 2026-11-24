#!/usr/bin/env node

'use strict';

// GDI.42 InvertRgn is a real Win16 entry point, not a fail-fast stop.
//
// Tetris for Windows (WEP1, and the identical binary on the Best of WEP floppy)
// flashes a completed row by inverting a region over it. The Win16 GDI dispatch
// had FrameRgn (41) and CombineRgn (47) but nothing for 42, so the first line
// clear reached $crash_unimplemented: `[win16] GDI.42 INVERTRGN` and then
// `RuntimeError: unreachable` (GitHub issue #32).
//
// Driven through $win16_gdi itself, the way the far-call thunk reaches it: a
// Pascal frame on a real 16-bit stack, 16-bit DC and region handles, and the
// shim's own far-return epilogue. Pixels are then read back from the DIB,
// because "the ordinal was handled" and "the region was inverted" are
// different claims.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  ;; InvertRgn(hDC, hRgn): Pascal word 1 = hDC, word 0 = hRgn.
  ;; Returns handled<<16 | AX.
  (func (export "test_invert_rgn16") (param $hdc i32) (param $rgn i32) (result i32)
    (local $handled i32)
    (call $win16_seg_set (i32.const 1) (i32.const 0x00100000)
      (i32.const 0x10000) (i32.const 0) (i32.const 1))
    (call $win16_seg_set (i32.const 2) (i32.const 0x00110000)
      (i32.const 0x10000) (i32.const 1) (i32.const 2))
    (global.set $code16 (i32.const 1))
    (global.set $sreg_cs (call $win16_index_to_sel (i32.const 1)))
    (global.set $seg_base_cs (i32.const 0x00100000))
    (global.set $sreg_ss (call $win16_index_to_sel (i32.const 2)))
    (global.set $seg_base_ss (i32.const 0x00110000))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00110100))
    (call $gs16 (i32.const 0x00110100) (i32.const 0x004d))
    (call $gs16 (i32.const 0x00110102) (call $win16_index_to_sel (i32.const 1)))
    (call $gs16 (i32.const 0x00110104) (call $win16_h16 (local.get $rgn)))
    (call $gs16 (i32.const 0x00110106) (call $win16_h16 (local.get $hdc)))
    (local.set $handled (call $win16_gdi (i32.const 42)))
    (global.set $code16 (i32.const 0))
    (i32.or (i32.shl (local.get $handled) (i32.const 16))
      (i32.and (i32.load (global.get $reg_base)) (i32.const 0xFFFF))))
`;

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const W = 8, H = 8;
  const bmi = e.guest_alloc(40), out = e.guest_alloc(4);
  [40, W, -H, 0x200001].forEach((v, i) => e.guest_write32(bmi + i * 4, v));
  const bitmap = e.test_call_CreateDIBSection(0, bmi, 0, out, 0, 0);
  const dc = e.test_call_CreateCompatibleDC(0);
  assert(bitmap && dc, 'the fixture DIB and DC exist');
  e.test_call_SelectObject(dc, bitmap);
  const bits = e.guest_read32(out);
  assert.strictEqual(e.test_call_PatBlt(dc, 0, 0, W, H, 0x00000042), 1); // BLACKNESS
  const pixel = (x, y) => e.guest_read32(bits + 4 * (y * W + x)) & 0xFFFFFF;

  // A full-width strip, the shape Tetris inverts over a completed row.
  const region = e.test_call_CreateRectRgn(0, 3, W, 5) >>> 0;
  assert(region, 'the fixture region was created');

  const first = e.test_invert_rgn16(dc, region) >>> 0;
  assert.strictEqual(first >>> 16, 1, 'GDI.42 is dispatched instead of falling to crash_unimplemented');
  assert.strictEqual(first & 0xFFFF, 1, 'InvertRgn returns TRUE');
  assert.strictEqual(e.get_esp(), 0x00110108, 'Pascal epilogue pops the far return and both word arguments');
  assert.strictEqual(e.get_eip(), 0x0010004d, 'far return restores CS:IP');

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const inside = y >= 3 && y < 5;
      assert.strictEqual(pixel(x, y), inside ? 0xFFFFFF : 0,
        `pixel ${x},${y} should be ${inside ? 'inverted' : 'untouched'}`);
    }
  }

  // The second flash takes the row back: inverting twice is the identity.
  assert.strictEqual(e.test_invert_rgn16(dc, region) & 0xFFFF, 1);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) assert.strictEqual(pixel(x, y), 0, 'inverting twice restores');
  }

  console.log('PASS  Win16 GDI.42 InvertRgn inverts the region it is given');
})().catch(err => {
  console.error(err && err.stack || err);
  process.exit(1);
});
