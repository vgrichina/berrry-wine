#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

(async () => {
  const { exports: e } = await bootRenderHarness({ fonts: 'none', extraWat: `
    (func (export "wing_map") (param i32) (result i32)
      (call $virtual_map_commit (local.get 0) (i32.const 4096)))
    (func (export "wing_cleanup") (param $p i32) (result i32)
      (local $sp i32) (local $delta i32)
      (local.set $sp (i32.load offset=16 (global.get $reg_base)))
      (call $handle_WinGRecommendDIBFormat (local.get $p)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
      (local.set $delta (i32.sub (i32.load offset=16 (global.get $reg_base)) (local.get $sp)))
      (i32.store offset=16 (global.get $reg_base) (local.get $sp))
      (local.get $delta))
  ` });
  const expected = [40, 320, 1, 0x00080001, 0, 0, 0, 0, 0, 0];
  const call = ptr => {
    const sp = e.get_esp();
    const result = e.test_call_WinGRecommendDIBFormat(ptr);
    assert.strictEqual(e.get_esp(), sp, 'test-call wrapper restores caller stack');
    return result;
  };
  const check = ptr => {
    for (let i = -4; i < 56; i++) e.guest_write8(ptr + i, 0xa5);
    assert.strictEqual(call(ptr), 1);
    assert.deepStrictEqual(expected.map((_, i) => e.guest_read32(ptr + 4 * i) >>> 0),
      expected, 'complete header is output; input biSize need not be initialized');
    for (const i of [-4, -3, -2, -1, ...Array.from({ length: 16 }, (_, n) => 40 + n)])
      assert.strictEqual(e.guest_read8(ptr + i), 0xa5, `guard/palette byte ${i}`);
  };
  const info = (e.guest_alloc(40 + 256 * 4 + 8) >>> 0) + 4;
  check(info);
  assert.strictEqual(e.wing_cleanup(info), 8, 'one argument plus return address popped');
  assert.strictEqual(e.wing_cleanup(0), 8, 'failure has same stdcall cleanup');
  assert.strictEqual(call(0), 0, 'NULL fails');
  assert.strictEqual(call(0xfffffff0), 0, 'wrapped output range fails');
  assert.strictEqual(call(0x38000000), 0, 'unmapped output fails');

  const page = 0x30000000;
  for (const p of [page, 0x28000000, page + 4096])
    assert.strictEqual(e.wing_map(p) >>> 0, p);
  assert.notStrictEqual(e.guest_to_wasm(page + 4096), e.guest_to_wasm(page) + 4096);
  for (const split of [1, 3, 4, 7, 8, 12, 15, 16, 20, 39]) check(page + 4096 - split);
  const truncated = page + 8192 - 20;
  for (let i = 0; i < 20; i++) e.guest_write8(truncated + i, 0xa5);
  assert.strictEqual(call(truncated), 0, 'partially unmapped header fails before writing');
  for (let i = 0; i < 20; i++) assert.strictEqual(e.guest_read8(truncated + i), 0xa5);

  // Use the recommendation through the real DIB allocator, as WinG callers do.
  check(info);
  e.guest_write32(info + 4, 17);
  e.guest_write32(info + 8, 2);
  for (let i = 40; i < 40 + 256 * 4; i++) e.guest_write8(info + i, 0);
  const bits = e.guest_alloc(4) >>> 0;
  const bitmap = e.test_call_CreateDIBSection(0, info, 0, bits, 0, 0) >>> 0;
  assert(bitmap, 'recommended header creates a real DIB after dimensions/palette supplied');
  assert(e.guest_read32(bits), 'DIB has writable pixel storage');
  assert.strictEqual(e.test_call_DeleteObject(bitmap), 1);
  console.log('PASS WinGRecommendDIBFormat header, guards, NULL, invalid ranges, sparse splits, real DIB');
})().catch(err => { console.error(err); process.exit(1); });
