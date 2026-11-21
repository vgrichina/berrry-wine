#!/usr/bin/env node

'use strict';

const assert = require('assert');
const apiTable = require('../src/api_table.json');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func $pack_console_result (result i64)
    (i64.or
      (i64.extend_i32_u (i32.load offset=0 (global.get $reg_base)))
      (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))

  (func (export "test_write_output_a")
        (param $handle i32) (param $source i32) (param $size i32)
        (param $coord i32) (param $region i32) (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_WriteConsoleOutputA
      (local.get $handle) (local.get $source) (local.get $size)
      (local.get $coord) (local.get $region) (i32.const 0))
    (call $pack_console_result))

  (func (export "test_write_output_w")
        (param $handle i32) (param $source i32) (param $size i32)
        (param $coord i32) (param $region i32) (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_WriteConsoleOutputW
      (local.get $handle) (local.get $source) (local.get $size)
      (local.get $coord) (local.get $region) (i32.const 0))
    (call $pack_console_result))

  (func (export "test_create_buffer") (result i32)
    (call $console_buffer_create))
  (func (export "test_console_cell")
        (param $handle i32) (param $x i32) (param $y i32)
        (param $attribute i32) (result i32)
    (local $value i32) (local $base i32)
    (if (i32.eqz (call $console_buffer_enter (local.get $handle)))
      (then (return (i32.const -1))))
    (call $console_cells_ensure)
    (local.set $base
      (select (global.get $console_attr_base) (global.get $console_text_base)
        (local.get $attribute)))
    (local.set $value
      (i32.load16_u (i32.add (local.get $base)
        (i32.shl
          (i32.add (i32.mul (local.get $y) (global.get $console_width))
            (local.get $x))
          (i32.const 1)))))
    (call $console_buffer_finish (i32.const 0))
    (local.get $value))
  (func (export "test_set_last_error") (param $value i32)
    (global.set $last_error (local.get $value)))
`;

const resultOf = packed => ({
  eax: Number(packed & 0xffffffffn) >>> 0,
  esp: Number(packed >> 32n) >>> 0,
});

(async () => {
  for (const name of ['WriteConsoleOutputA', 'WriteConsoleOutputW']) {
    const api = apiTable.find(entry => entry.name === name);
    assert(api, `${name} is exported`);
    assert.strictEqual(api.nargs, 5, `${name} has five arguments`);
    assert.strictEqual(api.convention, 'stdcall', `${name} uses stdcall`);
  }

  const { exports: wat } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const active = 0x00030001;
  const stack = 0x074ff000;
  const source = wat.guest_alloc(3 * 2 * 4) >>> 0;
  const region = wat.guest_alloc(8) >>> 0;
  const coord = (x, y) => (x & 0xffff) | ((y & 0xffff) << 16);
  const read16 = ptr => wat.guest_read8(ptr) | (wat.guest_read8(ptr + 1) << 8);
  const readS16 = ptr => (read16(ptr) << 16) >> 16;
  const writeRegion = (left, top, right, bottom) => {
    wat.guest_write16(region, left);
    wat.guest_write16(region + 2, top);
    wat.guest_write16(region + 4, right);
    wat.guest_write16(region + 6, bottom);
  };
  const readRegion = () => [0, 2, 4, 6].map(offset => readS16(region + offset));
  const cell = (handle, x, y, attribute = 0) =>
    wat.test_console_cell(handle, x, y, attribute);
  const seedSource = chars => {
    chars.forEach((ch, index) => {
      wat.guest_write16(source + index * 4, ch);
      wat.guest_write16(source + index * 4 + 2, 0x10 + index);
    });
  };
  const write = (wide, handle, size, sourceCoord, outputRegion = region, input = source) =>
    resultOf((wide ? wat.test_write_output_w : wat.test_write_output_a)(
      handle, input, size, sourceCoord, outputRegion, stack));

  seedSource([0x41, 0x42, 0x43, 0x44, 0x45, 0x46]);
  writeRegion(78, 23, 82, 25);
  assert.deepStrictEqual(write(false, active, coord(3, 2), coord(1, 0)),
    { eax: 1, esp: stack + 24 }, 'ANSI edge-clipped write failed');
  assert.deepStrictEqual(readRegion(), [78, 23, 79, 24],
    'ANSI write did not report the source-and-screen intersection');
  assert.deepStrictEqual([
    cell(active, 78, 23), cell(active, 79, 23),
    cell(active, 78, 24), cell(active, 79, 24),
  ], [0x42, 0x43, 0x45, 0x46],
  'ANSI write did not preserve two-dimensional source row addressing');
  assert.deepStrictEqual([
    cell(active, 78, 23, 1), cell(active, 79, 23, 1),
    cell(active, 78, 24, 1), cell(active, 79, 24, 1),
  ], [0x11, 0x12, 0x14, 0x15], 'ANSI write attributes');

  seedSource([0x263a, 0x263b, 0x263c, 0x263d, 0x263e, 0x263f]);
  writeRegion(10, 5, 12, 7);
  assert.deepStrictEqual(write(true, active, coord(3, 2), coord(-1, -1)),
    { eax: 1, esp: stack + 24 }, 'wide negative-source-coordinate write failed');
  assert.deepStrictEqual(readRegion(), [11, 6, 12, 7],
    'negative source COORD was not clipped as a signed coordinate');
  assert.deepStrictEqual([
    cell(active, 11, 6), cell(active, 12, 6),
    cell(active, 11, 7), cell(active, 12, 7),
  ], [0x263a, 0x263b, 0x263d, 0x263e], 'wide clipped source cells');

  writeRegion(-1, -1, 1, 1);
  assert.deepStrictEqual(write(true, active, coord(3, 2), coord(0, 0)),
    { eax: 1, esp: stack + 24 }, 'negative screen-edge write failed');
  assert.deepStrictEqual(readRegion(), [0, 0, 1, 0],
    'screen-buffer clipping did not update the actual write rectangle');
  assert.deepStrictEqual([
    cell(active, 0, 0), cell(active, 1, 0),
    cell(active, 0, 1), cell(active, 1, 1),
  ], [0x263e, 0x263f, 32, 32],
  'negative destination edge did not leave cells lacking source data untouched');

  const untouched = [cell(active, 20, 10), cell(active, 20, 10, 1)];
  writeRegion(20, 10, 22, 11);
  assert.deepStrictEqual(write(false, active, coord(3, 2), coord(3, 0)),
    { eax: 1, esp: stack + 24 }, 'empty source intersection failed');
  assert.deepStrictEqual(readRegion(), [0, 0, -1, -1],
    'empty source intersection was not reported as an empty rectangle');
  assert.deepStrictEqual([cell(active, 20, 10), cell(active, 20, 10, 1)], untouched,
    'empty source intersection changed the destination');

  const wrappedAlias = [cell(active, 0, 3), cell(active, 0, 3, 1)];
  writeRegion(80, 2, 80, 2);
  assert.deepStrictEqual(write(false, active, coord(3, 2), coord(0, 0)),
    { eax: 1, esp: stack + 24 }, 'fully off-screen write failed');
  assert.deepStrictEqual(readRegion(), [0, 0, -1, -1],
    'fully off-screen write was not reported as empty');
  assert.deepStrictEqual([cell(active, 0, 3), cell(active, 0, 3, 1)], wrappedAlias,
    'column at buffer width aliased into the next screen row');

  const privateBuffer = wat.test_create_buffer() >>> 0;
  assert.ok(privateBuffer && privateBuffer !== 0xffffffff, 'private buffer creation failed');
  seedSource([0x51, 0x52, 0x53, 0x54, 0x55, 0x56]);
  writeRegion(3, 2, 3, 2);
  assert.deepStrictEqual(write(false, privateBuffer, coord(3, 2), coord(0, 0)),
    { eax: 1, esp: stack + 24 }, 'inactive-buffer write failed');
  assert.deepStrictEqual([cell(privateBuffer, 3, 2), cell(privateBuffer, 3, 2, 1)],
    [0x51, 0x10], 'inactive buffer did not receive the write');
  assert.deepStrictEqual([cell(active, 3, 2), cell(active, 3, 2, 1)], [32, 7],
    'inactive-buffer write leaked into the active buffer');

  wat.test_set_last_error(0x1234);
  assert.deepStrictEqual(write(false, privateBuffer, coord(3, 2), coord(0, 0), region, 0),
    { eax: 0, esp: stack + 24 }, 'NULL source pointer was accepted');
  assert.strictEqual(wat.test_get_last_error(), 87,
    'NULL source pointer did not set ERROR_INVALID_PARAMETER');
  assert.deepStrictEqual([cell(active, 3, 2), cell(active, 3, 2, 1)], [32, 7],
    'failed inactive-buffer write left private state loaded');
  wat.test_set_last_error(0x1234);
  assert.deepStrictEqual(write(false, privateBuffer, coord(3, 2), coord(0, 0), 0),
    { eax: 0, esp: stack + 24 }, 'NULL write-region pointer was accepted');
  assert.strictEqual(wat.test_get_last_error(), 87,
    'NULL write-region pointer did not set ERROR_INVALID_PARAMETER');

  writeRegion(30, 4, 31, 5);
  wat.test_set_last_error(0x1234);
  assert.deepStrictEqual(write(false, 0xdeadbeef, coord(3, 2), coord(0, 0)),
    { eax: 0, esp: stack + 24 }, 'invalid output handle was accepted');
  assert.strictEqual(wat.test_get_last_error(), 6,
    'invalid output handle did not set ERROR_INVALID_HANDLE');
  assert.deepStrictEqual(readRegion(), [30, 4, 31, 5],
    'invalid-handle write changed lpWriteRegion');

  console.log('console rectangular output clipping tests passed');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
