#!/usr/bin/env node

'use strict';

const assert = require('assert');
const apiTable = require('../src/api_table.json');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func $pack_fill_result (result i64)
    (i64.or
      (i64.extend_i32_u (i32.load offset=0 (global.get $reg_base)))
      (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))

  (func (export "test_fill_character")
        (param $handle i32) (param $ch i32) (param $length i32)
        (param $coord i32) (param $written i32) (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_FillConsoleOutputCharacterW
      (local.get $handle) (local.get $ch) (local.get $length)
      (local.get $coord) (local.get $written) (i32.const 0))
    (call $pack_fill_result))

  (func (export "test_fill_attribute")
        (param $handle i32) (param $attr i32) (param $length i32)
        (param $coord i32) (param $written i32) (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_FillConsoleOutputAttribute
      (local.get $handle) (local.get $attr) (local.get $length)
      (local.get $coord) (local.get $written) (i32.const 0))
    (call $pack_fill_result))

  (func (export "test_console_cell")
        (param $handle i32) (param $index i32) (param $attribute i32) (result i32)
    (local $value i32)
    (if (i32.eqz (call $console_buffer_enter (local.get $handle)))
      (then (return (i32.const -1))))
    (call $console_cells_ensure)
    (local.set $value
      (i32.load16_u
        (i32.add
          (select (global.get $console_attr_base) (global.get $console_text_base)
            (local.get $attribute))
          (i32.shl (local.get $index) (i32.const 1)))))
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
  for (const name of ['FillConsoleOutputCharacterW', 'FillConsoleOutputAttribute']) {
    const api = apiTable.find(entry => entry.name === name);
    assert(api, `${name} is exported`);
    assert.strictEqual(api.nargs, 5, `${name} has five arguments`);
    assert.strictEqual(api.convention, 'stdcall', `${name} uses stdcall`);
  }

  const { exports: wat } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const handle = 0x00030001;
  const stack = 0x074ff000;
  const written = wat.guest_alloc(4) >>> 0;
  const coord = (x, y) => (x & 0xffff) | ((y & 0xffff) << 16);
  const cell = (x, y, attribute = 0) => wat.test_console_cell(handle, y * 80 + x, attribute);
  const fillCharacter = (ch, length, x, y) => {
    wat.guest_write32(written, 0xcccccccc);
    const result = resultOf(wat.test_fill_character(
      handle, ch.charCodeAt(0), length, coord(x, y), written, stack));
    return { ...result, written: wat.guest_read32(written) >>> 0 };
  };
  const fillAttribute = (attr, length, x, y) => {
    wat.guest_write32(written, 0xcccccccc);
    const result = resultOf(wat.test_fill_attribute(
      handle, attr, length, coord(x, y), written, stack));
    return { ...result, written: wat.guest_read32(written) >>> 0 };
  };

  assert.deepStrictEqual(fillCharacter('X', 3, 79, 23),
    { eax: 1, esp: stack + 24, written: 3 },
    'character fill did not wrap to the next row');
  assert.strictEqual(cell(79, 23), 'X'.charCodeAt(0));
  assert.strictEqual(cell(0, 24), 'X'.charCodeAt(0));
  assert.strictEqual(cell(1, 24), 'X'.charCodeAt(0));
  assert.deepStrictEqual([cell(79, 23, 1), cell(0, 24, 1), cell(1, 24, 1)], [7, 7, 7],
    'character fill changed cell attributes');

  assert.deepStrictEqual(fillAttribute(0x1e, 10, 78, 24),
    { eax: 1, esp: stack + 24, written: 2 },
    'attribute fill did not clip and report the two remaining cells');
  assert.deepStrictEqual([cell(78, 24, 1), cell(79, 24, 1)], [0x1e, 0x1e]);
  assert.deepStrictEqual([cell(78, 24), cell(79, 24)], [32, 32],
    'attribute fill changed cell characters');

  assert.deepStrictEqual(fillCharacter('Z', 0xffffffff, 79, 24),
    { eax: 1, esp: stack + 24, written: 1 },
    'huge character fill did not clip safely at the final cell');
  assert.strictEqual(cell(79, 24), 'Z'.charCodeAt(0));
  assert.strictEqual(cell(79, 24, 1), 0x1e,
    'character fill at the final cell changed its attribute');

  assert.deepStrictEqual(fillCharacter('Q', 0, 0, 0),
    { eax: 1, esp: stack + 24, written: 0 },
    'zero-length fill did not succeed with zero cells written');
  assert.strictEqual(cell(0, 0), 32, 'zero-length fill changed the first cell');

  for (const [x, y, label] of [
    [-1, 0, 'negative X'],
    [0, -1, 'negative Y'],
    [80, 0, 'X at buffer width'],
    [0, 25, 'Y at buffer height'],
  ]) {
    wat.test_set_last_error(0x1234);
    const result = fillAttribute(0x4f, 1, x, y);
    assert.deepStrictEqual(result, { eax: 0, esp: stack + 24, written: 0 },
      `${label} fill did not fail with zero cells written`);
    assert.strictEqual(wat.test_get_last_error(), 87,
      `${label} fill did not set ERROR_INVALID_PARAMETER`);
  }
  assert.deepStrictEqual([cell(0, 0), cell(0, 0, 1)], [32, 7],
    'invalid fills changed the first cell');

  console.log('PASS console fill APIs wrap, clip, count, and preserve cell halves');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
