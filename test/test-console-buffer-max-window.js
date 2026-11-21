#!/usr/bin/env node

'use strict';

const assert = require('assert');
const apiTable = require('../src/api_table.json');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_map") (param i32) (result i32)
    (call $virtual_map_commit (local.get 0) (i32.const 4096)))
  (func (export "test_window_relative") (param $rect i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
    (call $handle_SetConsoleWindowInfo (i32.const 0x30001) (i32.const 0)
      (local.get $rect) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "test_get_console_info")
        (param $handle i32) (param $info i32) (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_GetConsoleScreenBufferInfo
      (local.get $handle) (local.get $info) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i64.or
      (i64.extend_i32_u (i32.load offset=0 (global.get $reg_base)))
      (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))

  (func (export "test_get_largest")
        (param $handle i32) (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_GetLargestConsoleWindowSize
      (local.get $handle) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i64.or
      (i64.extend_i32_u (i32.load offset=0 (global.get $reg_base)))
      (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))

  (func (export "test_set_window")
        (param $handle i32) (param $rect i32) (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_SetConsoleWindowInfo
      (local.get $handle) (i32.const 1) (local.get $rect)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i64.or
      (i64.extend_i32_u (i32.load offset=0 (global.get $reg_base)))
      (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))

  (func (export "test_set_size")
        (param $handle i32) (param $size i32) (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_SetConsoleScreenBufferSize
      (local.get $handle) (local.get $size) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i64.or
      (i64.extend_i32_u (i32.load offset=0 (global.get $reg_base)))
      (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))

  (func (export "test_create_buffer") (result i32)
    (call $console_buffer_create))
  (func (export "test_set_last_error") (param $value i32)
    (global.set $last_error (local.get $value)))
`;

const resultOf = packed => ({
  eax: Number(packed & 0xffffffffn) >>> 0,
  esp: Number(packed >> 32n) >>> 0,
});

(async () => {
  for (const [name, nargs] of [
    ['GetConsoleScreenBufferInfo', 2],
    ['GetLargestConsoleWindowSize', 1],
  ]) {
    const api = apiTable.find(entry => entry.name === name);
    assert(api, `${name} is exported`);
    assert.strictEqual(api.nargs, nargs, `${name} argument count`);
    assert.strictEqual(api.convention, 'stdcall', `${name} calling convention`);
  }

  const { exports: wat } = await bootRenderHarness({
    extraWat,
    fonts: 'none',
    width: 640,
    height: 480,
  });
  const active = 0x00030001;
  const stack = 0x074ff000;
  const info = wat.guest_alloc(22) >>> 0;
  const privateInfo = wat.guest_alloc(22) >>> 0;
  const rect = wat.guest_alloc(8) >>> 0;
  const coord = (x, y) => (x & 0xffff) | ((y & 0xffff) << 16);
  const read16 = ptr => wat.guest_read8(ptr) | (wat.guest_read8(ptr + 1) << 8);
  const maxWindow = ptr => coord(read16(ptr + 18), read16(ptr + 20)) >>> 0;
  const writeRect = (left, top, right, bottom) => {
    wat.guest_write16(rect, left);
    wat.guest_write16(rect + 2, top);
    wat.guest_write16(rect + 4, right);
    wat.guest_write16(rect + 6, bottom);
  };

  assert.deepStrictEqual(resultOf(wat.test_get_largest(active, stack)),
    { eax: coord(79, 37) >>> 0, esp: stack + 8 },
    'display/font maximum does not match the 640x480 browser surface');
  assert.deepStrictEqual(resultOf(wat.test_get_console_info(active, info, stack)),
    { eax: 1, esp: stack + 12 }, 'active buffer info failed');
  assert.strictEqual(wat.guest_read32(info) >>> 0, coord(80, 25) >>> 0,
    'default screen-buffer size changed');
  assert.strictEqual(maxWindow(info), coord(79, 25) >>> 0,
    'buffer info did not cap display width and buffer height independently');

  const privateBuffer = wat.test_create_buffer() >>> 0;
  assert.ok(privateBuffer && privateBuffer !== 0xffffffff,
    'private console screen buffer creation failed');
  writeRect(0, 0, 39, 19);
  assert.deepStrictEqual(resultOf(wat.test_set_window(privateBuffer, rect, stack)),
    { eax: 1, esp: stack + 16 }, 'private viewport shrink failed');
  assert.deepStrictEqual(resultOf(wat.test_set_size(privateBuffer, coord(40, 20), stack)),
    { eax: 1, esp: stack + 12 }, 'private buffer shrink failed');
  assert.deepStrictEqual(resultOf(wat.test_get_console_info(privateBuffer, privateInfo, stack)),
    { eax: 1, esp: stack + 12 }, 'small private buffer info failed');
  assert.strictEqual(maxWindow(privateInfo), coord(40, 20) >>> 0,
    'small private buffer did not constrain both maximum-window dimensions');
  assert.deepStrictEqual(resultOf(wat.test_get_largest(privateBuffer, stack)),
    { eax: coord(79, 37) >>> 0, esp: stack + 8 },
    'GetLargestConsoleWindowSize incorrectly followed the private buffer size');

  assert.deepStrictEqual(resultOf(wat.test_set_size(privateBuffer, coord(120, 50), stack)),
    { eax: 1, esp: stack + 12 }, 'private buffer enlargement failed');
  assert.deepStrictEqual(resultOf(wat.test_get_console_info(privateBuffer, privateInfo, stack)),
    { eax: 1, esp: stack + 12 }, 'large private buffer info failed');
  assert.strictEqual(maxWindow(privateInfo), coord(79, 37) >>> 0,
    'large private buffer did not use the display/font maximum');
  assert.deepStrictEqual(resultOf(wat.test_get_console_info(active, info, stack)),
    { eax: 1, esp: stack + 12 }, 'active buffer info failed after private queries');
  assert.strictEqual(maxWindow(info), coord(79, 25) >>> 0,
    'private-buffer queries leaked state into the active buffer');

  wat.test_set_last_error(0x1234);
  assert.deepStrictEqual(resultOf(wat.test_get_console_info(privateBuffer, 0, stack)),
    { eax: 0, esp: stack + 12 }, 'NULL info pointer was accepted');
  assert.strictEqual(wat.test_get_last_error(), 87,
    'NULL info pointer did not set ERROR_INVALID_PARAMETER');
  assert.deepStrictEqual(resultOf(wat.test_get_console_info(active, info, stack)),
    { eax: 1, esp: stack + 12 }, 'NULL private query left the wrong buffer loaded');
  assert.strictEqual(maxWindow(info), coord(79, 25) >>> 0,
    'failed private query leaked state into the active buffer');

  for (let i = 0; i < 22; i++) wat.guest_write8(privateInfo + i, 0xa5);
  wat.test_set_last_error(0x1234);
  assert.deepStrictEqual(resultOf(wat.test_get_console_info(0xdeadbeef, privateInfo, stack)),
    { eax: 0, esp: stack + 12 }, 'invalid screen-buffer handle was accepted');
  assert.strictEqual(wat.test_get_last_error(), 6,
    'invalid screen-buffer handle did not set ERROR_INVALID_HANDLE');
  assert.deepStrictEqual(
    Array.from({ length: 22 }, (_, index) => wat.guest_read8(privateInfo + index)),
    Array(22).fill(0xa5), 'invalid-handle query changed the destination');

  const page = 0x30000000;
  for (const ga of [page, 0x28000000, page + 4096]) assert.strictEqual(wat.test_map(ga) >>> 0, ga);
  assert.notStrictEqual(wat.guest_to_wasm(page + 4096), wat.guest_to_wasm(page) + 4096);
  const bytes = (ga, n) => Array.from({ length: n }, (_, i) => wat.guest_read8(ga + i));
  const viewport = () => {
    assert.strictEqual(resultOf(wat.test_get_console_info(active, info, stack)).eax, 1);
    return [10, 12, 14, 16].map(offset => read16(info + offset));
  };
  for (let split = 1; split < 8; split++) {
    const edge = page + 4096 - split;
    for (const [absolute, values, expected, success] of [
      [true, [4, 3, 30, 15], [4, 3, 30, 15], 1],
      [false, [-2, -1, 3, 2], [2, 2, 33, 17], 1],
      [true, [-1, 0, 10, 10], [2, 2, 33, 17], 0],
      [false, [-3, 0, 0, 0], [2, 2, 33, 17], 0],
    ]) {
      wat.guest_write8(edge - 1, 0xcc);
      wat.guest_write8(edge + 8, 0xcc);
      values.forEach((v, i) => wat.guest_write16(edge + 2 * i, v));
      const before = bytes(edge - 1, 10);
      const result = absolute
        ? resultOf(wat.test_set_window(active, edge, stack))
        : { eax: wat.test_window_relative(edge), esp: wat.get_esp() >>> 0 };
      assert.deepStrictEqual(result, { eax: success, esp: stack + 16 }, `window split ${split}`);
      if (!success) assert.strictEqual(wat.test_get_last_error(), 87);
      assert.deepStrictEqual(viewport(), expected);
      assert.deepStrictEqual(bytes(edge - 1, 10), before, 'caller rectangle is read-only');
    }
  }

  console.log('console maximum-window reporting tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
