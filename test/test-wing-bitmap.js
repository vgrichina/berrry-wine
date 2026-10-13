#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

(async () => {
  const { exports: e } = await bootRenderHarness({ fonts: 'none' });
  const info = e.guest_alloc(1064) >>> 0, out = e.guest_alloc(4) >>> 0;
  assert.strictEqual(e.test_call_WinGRecommendDIBFormat(info), 1);
  e.guest_write32(info + 4, 3); e.guest_write32(info + 8, -2);
  e.guest_write32(info + 40, 0x00102030); e.guest_write32(info + 44, 0x00a0b0c0);
  const src = e.test_call_WinGCreateDC() >>> 0;
  const dst = e.test_call_WinGCreateDC() >>> 0;
  assert(src && dst && src !== dst, 'DCs are independent owned objects');
  const bitmap = e.test_call_WinGCreateBitmap(src, info, out) >>> 0;
  assert(bitmap);
  const bits = e.guest_read32(out) >>> 0;
  assert(bits, 'guest has direct access to canonical DIB pixels');
  const oldSrc = e.test_call_SelectObject(src, bitmap) >>> 0;
  // Top-down indexed rows with DWORD padding. Offset blit uses only the
  // second and third pixels, so swapped stack arguments cannot pass.
  [0, 1, 0, 99, 1, 0, 1, 99].forEach((n, i) => e.guest_write8(bits + i, n));
  e.guest_write32(info + 40, 0); e.guest_write32(info + 44, 0);
  const color = e.guest_alloc(4) >>> 0;
  e.guest_write32(color, 0x00030507);
  assert.strictEqual(e.test_call_WinGSetDIBColorTable(src, 1, 1, color), 1);
  e.guest_write32(color, 0); // palette owns its copy
  assert.strictEqual(e.test_call_WinGSetDIBColorTable(src, 256, 1, color), 0);
  assert.strictEqual(e.test_call_WinGSetDIBColorTable(0xdead, 0, 1, color), 0);

  e.guest_write32(info + 4, 4); e.guest_write32(info + 8, -3);
  e.guest_write32(info + 12, 1 | (32 << 16));
  const destBitmap = e.test_call_WinGCreateBitmap(dst, info, out) >>> 0;
  assert(destBitmap);
  const destBits = e.guest_read32(out) >>> 0;
  const oldDst = e.test_call_SelectObject(dst, destBitmap) >>> 0;
  assert.strictEqual(e.test_call_WinGBitBlt(dst, 1, 1, 2, 2, src, 1, 0), 1);
  const pixel = (x, y) => e.guest_read32(destBits + 4 * (4 * y + x)) & 0xffffff;
  assert.deepStrictEqual([pixel(1, 1), pixel(2, 1), pixel(1, 2), pixel(2, 2)],
    [0x030507, 0x102030, 0x102030, 0x030507], 'copy expands owned palette into real destination pixels');
  assert.strictEqual(pixel(0, 0), 0, 'outside blit remains untouched');
  e.guest_write8(bits + 1, 0);
  assert.strictEqual(e.test_call_WinGBitBlt(dst, 1, 1, 1, 1, src, 1, 0), 1);
  assert.strictEqual(pixel(1, 1), 0x102030, 'later direct guest writes are visible');
  assert.strictEqual(e.test_call_WinGBitBlt(dst, 0, 0, 1, 1, 0xdead, 0, 0), 0);
  assert.strictEqual(e.test_call_WinGBitBlt(0xdead, 0, 0, 1, 1, src, 0, 0), 0);
  assert.strictEqual(e.test_call_WinGCreateBitmap(src, info, 0x38000000), 0);
  assert.strictEqual(e.test_call_WinGCreateBitmap(src, 0, out), 0);
  assert.strictEqual(e.guest_read32(out), 0, 'failed creation clears bits output');
  e.guest_write32(info + 12, 1 | (7 << 16));
  assert.strictEqual(e.test_call_WinGCreateBitmap(src, info, out), 0, 'unsupported depth fails');
  e.test_call_SelectObject(src, oldSrc); e.test_call_SelectObject(dst, oldDst);
  for (const h of [bitmap, destBitmap]) assert.strictEqual(e.test_call_DeleteObject(h), 1);
  for (const h of [src, dst]) assert.strictEqual(e.test_call_DeleteDC(h), 1);
  console.log('PASS WinG DC/bitmap ownership, direct pixels, palette copies, SRCCOPY offsets, failures, deletion');
})().catch(err => { console.error(err); process.exit(1); });
