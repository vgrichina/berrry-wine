#!/usr/bin/env node

'use strict';

const assert = require('assert');
const apiTable = require('../src/api_table.json');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_read_attribute")
        (param $handle i32) (param $destination i32) (param $length i32)
        (param $coord i32) (param $read i32) (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_ReadConsoleOutputAttribute
      (local.get $handle) (local.get $destination) (local.get $length)
      (local.get $coord) (local.get $read) (i32.const 0))
    (i64.or
      (i64.extend_i32_u (i32.load offset=0 (global.get $reg_base)))
      (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))

  (func (export "test_seed_attribute")
        (param $handle i32) (param $index i32) (param $value i32) (result i32)
    (if (i32.eqz (call $console_buffer_enter (local.get $handle)))
      (then (return (i32.const 0))))
    (call $console_cells_ensure)
    (i32.store16
      (i32.add (global.get $console_attr_base)
        (i32.shl (local.get $index) (i32.const 1)))
      (local.get $value))
    (call $console_buffer_finish (i32.const 0))
    (i32.const 1))

  (func (export "test_read16") (param $address i32) (result i32)
    (i32.load16_u (call $g2w (local.get $address))))
  (func (export "test_set_last_error") (param $value i32)
    (global.set $last_error (local.get $value)))
`;

const resultOf = packed => ({
  eax: Number(packed & 0xffffffffn) >>> 0,
  esp: Number(packed >> 32n) >>> 0,
});

(async () => {
  const api = apiTable.find(entry => entry.name === 'ReadConsoleOutputAttribute');
  assert(api, 'ReadConsoleOutputAttribute is exported');
  assert.strictEqual(api.nargs, 5, 'ReadConsoleOutputAttribute has five arguments');
  assert.strictEqual(api.convention, 'stdcall', 'ReadConsoleOutputAttribute uses stdcall');

  const { exports: wat } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const handle = 0x00030001;
  const stack = 0x074ff000;
  const destination = wat.guest_alloc(12) >>> 0;
  const readCount = wat.guest_alloc(4) >>> 0;
  const coord = (x, y) => (x & 0xffff) | ((y & 0xffff) << 16);
  const read16 = index => wat.test_read16(destination + index * 2);
  const seed = (x, y, value) => {
    assert.strictEqual(wat.test_seed_attribute(handle, y * 80 + x, value), 1);
  };
  const fillDestination = value => {
    for (let index = 0; index < 6; index++) wat.guest_write16(destination + index * 2, value);
  };
  const readAttributes = (length, x, y, output = destination) => {
    wat.guest_write32(readCount, 0xcccccccc);
    const result = resultOf(wat.test_read_attribute(
      handle, output, length, coord(x, y), readCount, stack));
    return { ...result, read: wat.guest_read32(readCount) >>> 0 };
  };

  seed(79, 23, 0x1e);
  seed(0, 24, 0x2f);
  seed(1, 24, 0x3c);
  fillDestination(0xaaaa);
  assert.deepStrictEqual(readAttributes(3, 79, 23),
    { eax: 1, esp: stack + 24, read: 3 },
    'attribute read did not wrap to the next row');
  assert.deepStrictEqual([read16(0), read16(1), read16(2)], [0x1e, 0x2f, 0x3c]);
  assert.deepStrictEqual([read16(3), read16(4), read16(5)], [0xaaaa, 0xaaaa, 0xaaaa],
    'wrapped read wrote beyond its reported count');

  seed(78, 24, 0x4d);
  seed(79, 24, 0x5e);
  fillDestination(0xbbbb);
  assert.deepStrictEqual(readAttributes(5, 78, 24),
    { eax: 1, esp: stack + 24, read: 2 },
    'attribute read did not clip and report the two remaining cells');
  assert.deepStrictEqual([read16(0), read16(1)], [0x4d, 0x5e]);
  assert.deepStrictEqual([read16(2), read16(3), read16(4)], [0xbbbb, 0xbbbb, 0xbbbb],
    'clipped read zero-filled or overran the caller destination');

  fillDestination(0xdddd);
  assert.deepStrictEqual(readAttributes(0xffffffff, 79, 24),
    { eax: 1, esp: stack + 24, read: 1 },
    'huge attribute read did not clip safely at the final cell');
  assert.deepStrictEqual([read16(0), read16(1)], [0x5e, 0xdddd]);

  assert.deepStrictEqual(readAttributes(0, 0, 0, 0),
    { eax: 1, esp: stack + 24, read: 0 },
    'zero-length read did not succeed without a destination buffer');

  for (const [x, y, label] of [
    [-1, 0, 'negative X'],
    [0, -1, 'negative Y'],
    [80, 0, 'X at buffer width'],
    [0, 25, 'Y at buffer height'],
  ]) {
    fillDestination(0xeeee);
    wat.test_set_last_error(0x1234);
    const result = readAttributes(1, x, y, 0);
    assert.deepStrictEqual(result, { eax: 0, esp: stack + 24, read: 0 },
      `${label} read did not fail with zero attributes read`);
    assert.strictEqual(wat.test_get_last_error(), 87,
      `${label} read did not set ERROR_INVALID_PARAMETER`);
    assert.strictEqual(read16(0), 0xeeee, `${label} read changed the destination`);
  }

  wat.test_set_last_error(0x1234);
  fillDestination(0xfefe);
  wat.guest_write32(readCount, 0xcccccccc);
  const badHandle = resultOf(wat.test_read_attribute(
    0x1234, destination, 1, coord(0, 0), readCount, stack));
  assert.deepStrictEqual(badHandle, { eax: 0, esp: stack + 24 });
  assert.strictEqual(wat.test_get_last_error(), 6, 'invalid handle did not set ERROR_INVALID_HANDLE');
  assert.strictEqual(read16(0), 0xfefe, 'invalid handle changed the destination');

  console.log('PASS console attribute reads wrap, clip, count, and preserve caller bounds');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
