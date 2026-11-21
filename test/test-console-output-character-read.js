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

  (func (export "test_read_character_a")
        (param $handle i32) (param $destination i32) (param $length i32)
        (param $coord i32) (param $count i32) (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_ReadConsoleOutputCharacterA
      (local.get $handle) (local.get $destination) (local.get $length)
      (local.get $coord) (local.get $count) (i32.const 0))
    (call $pack_console_result))

  (func (export "test_read_character_w")
        (param $handle i32) (param $destination i32) (param $length i32)
        (param $coord i32) (param $count i32) (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_ReadConsoleOutputCharacterW
      (local.get $handle) (local.get $destination) (local.get $length)
      (local.get $coord) (local.get $count) (i32.const 0))
    (call $pack_console_result))

  (func (export "test_create_buffer") (result i32)
    (call $console_buffer_create))
  (func (export "test_seed_character")
        (param $handle i32) (param $index i32) (param $character i32) (result i32)
    (if (i32.eqz (call $console_buffer_enter (local.get $handle)))
      (then (return (i32.const 0))))
    (call $console_cells_ensure)
    (i32.store16
      (i32.add (global.get $console_text_base)
        (i32.shl (local.get $index) (i32.const 1)))
      (local.get $character))
    (call $console_buffer_finish (i32.const 0))
    (i32.const 1))
  (func (export "test_lookup_api") (param $name i32) (result i32)
    (call $lookup_api_id (call $g2w (local.get $name))))
  (func (export "test_set_last_error") (param $value i32)
    (global.set $last_error (local.get $value)))
`;

const resultOf = packed => ({
  eax: Number(packed & 0xffffffffn) >>> 0,
  esp: Number(packed >> 32n) >>> 0,
});

(async () => {
  const apis = ['ReadConsoleOutputCharacterA', 'ReadConsoleOutputCharacterW']
    .map(name => apiTable.find(entry => entry.name === name));
  const priorTail = apiTable.find(entry => entry.name === 'IDirect3D8_CreateDevice');
  assert(priorTail, 'preexisting API-table tail marker is present');
  apis.forEach((api, index) => {
    assert(api, `ReadConsoleOutputCharacter${index ? 'W' : 'A'} is exported`);
    assert.strictEqual(api.nargs, 5, `${api.name} has five arguments`);
    assert.strictEqual(api.convention, 'stdcall', `${api.name} uses stdcall`);
    assert.strictEqual(api.id, priorTail.id + 1 + index,
      `${api.name} was not appended after the preexisting stable API table`);
  });

  const { exports: wat } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const active = 0x00030001;
  const stack = 0x074ff000;
  const ansi = wat.guest_alloc(8) >>> 0;
  const wide = wat.guest_alloc(16) >>> 0;
  const count = wat.guest_alloc(4) >>> 0;
  const coord = (x, y) => (x & 0xffff) | ((y & 0xffff) << 16);
  const read16 = ptr => wat.guest_read8(ptr) | (wat.guest_read8(ptr + 1) << 8);
  const allocText = value => {
    const address = wat.guest_alloc(value.length + 1) >>> 0;
    for (let i = 0; i < value.length; i++) {
      wat.guest_write8(address + i, value.charCodeAt(i));
    }
    wat.guest_write8(address + value.length, 0);
    return address;
  };
  const read = (wideMode, handle, destination, length, x, y, countPointer = count) => {
    if (countPointer) wat.guest_write32(countPointer, 0xcccccccc);
    const result = resultOf((wideMode
      ? wat.test_read_character_w
      : wat.test_read_character_a)(
      handle, destination, length, coord(x, y), countPointer, stack));
    return {
      ...result,
      count: countPointer ? wat.guest_read32(countPointer) >>> 0 : undefined,
    };
  };

  assert.strictEqual(wat.test_lookup_api(allocText(apis[0].name)) >>> 0, apis[0].id,
    'ANSI name was missing from the generated hash table');
  assert.strictEqual(wat.test_lookup_api(allocText(apis[1].name)) >>> 0, apis[1].id,
    'wide name was missing from the generated hash table');

  const wrapped = [0x41, 0x263a, 0x43];
  wrapped.forEach((character, index) => {
    const cellIndex = 23 * 80 + 79 + index;
    assert.strictEqual(wat.test_seed_character(active, cellIndex, character), 1);
  });
  for (let i = 0; i < 8; i++) wat.guest_write8(ansi + i, 0xa5);
  assert.deepStrictEqual(read(false, active, ansi, 3, 79, 23),
    { eax: 1, esp: stack + 24, count: 3 },
    'ANSI character read did not wrap onto the next row');
  assert.deepStrictEqual(
    Array.from({ length: 5 }, (_, index) => wat.guest_read8(ansi + index)),
    [0x41, 0x3a, 0x43, 0xa5, 0xa5],
    'ANSI read did not narrow characters or preserve destination tail bytes');

  for (let i = 0; i < 8; i++) wat.guest_write16(wide + i * 2, 0xa5a5);
  assert.deepStrictEqual(read(true, active, wide, 3, 79, 23),
    { eax: 1, esp: stack + 24, count: 3 },
    'wide character read did not wrap onto the next row');
  assert.deepStrictEqual(
    Array.from({ length: 5 }, (_, index) => read16(wide + index * 2)),
    [0x41, 0x263a, 0x43, 0xa5a5, 0xa5a5],
    'wide read did not preserve UTF-16 cells or the destination tail');

  assert.strictEqual(wat.test_seed_character(active, 24 * 80 + 78, 0x58), 1);
  assert.strictEqual(wat.test_seed_character(active, 24 * 80 + 79, 0x59), 1);
  for (let i = 0; i < 8; i++) wat.guest_write8(ansi + i, 0xb6);
  assert.deepStrictEqual(read(false, active, ansi, 100, 78, 24),
    { eax: 1, esp: stack + 24, count: 2 },
    'read did not stop and report the final two screen-buffer cells');
  assert.deepStrictEqual(
    Array.from({ length: 4 }, (_, index) => wat.guest_read8(ansi + index)),
    [0x58, 0x59, 0xb6, 0xb6], 'end clipping overran the ANSI destination');

  const privateBuffer = wat.test_create_buffer() >>> 0;
  assert.ok(privateBuffer && privateBuffer !== 0xffffffff, 'private buffer creation failed');
  assert.strictEqual(wat.test_seed_character(active, 5, 0x61), 1);
  assert.strictEqual(wat.test_seed_character(privateBuffer, 5, 0x62), 1);
  assert.deepStrictEqual(read(false, privateBuffer, ansi, 1, 5, 0),
    { eax: 1, esp: stack + 24, count: 1 }, 'private-buffer read failed');
  assert.strictEqual(wat.guest_read8(ansi), 0x62, 'private-buffer character was not read');
  assert.deepStrictEqual(read(false, active, ansi, 1, 5, 0),
    { eax: 1, esp: stack + 24, count: 1 },
    'private read leaked selected-buffer state into the active buffer');
  assert.strictEqual(wat.guest_read8(ansi), 0x61, 'active buffer character changed');

  for (let i = 0; i < 8; i++) wat.guest_write8(ansi + i, 0xc7);
  assert.deepStrictEqual(read(false, active, 0, 0, 0, 0),
    { eax: 1, esp: stack + 24, count: 0 },
    'zero-length read did not succeed without a destination buffer');
  assert.strictEqual(wat.guest_read8(ansi), 0xc7, 'zero-length read changed memory');

  for (const [x, y, label] of [
    [-1, 0, 'negative X'],
    [0, -1, 'negative Y'],
    [80, 0, 'X at width'],
    [0, 25, 'Y at height'],
  ]) {
    wat.test_set_last_error(0x1234);
    wat.guest_write8(ansi, 0xd8);
    assert.deepStrictEqual(read(false, active, ansi, 1, x, y),
      { eax: 0, esp: stack + 24, count: 0 }, `${label} did not fail cleanly`);
    assert.strictEqual(wat.test_get_last_error(), 87,
      `${label} did not set ERROR_INVALID_PARAMETER`);
    assert.strictEqual(wat.guest_read8(ansi), 0xd8, `${label} changed destination memory`);
  }

  wat.test_set_last_error(0x1234);
  assert.deepStrictEqual(read(false, active, 0, 1, 0, 0),
    { eax: 0, esp: stack + 24, count: 0 }, 'nonempty NULL destination was accepted');
  assert.strictEqual(wat.test_get_last_error(), 87,
    'NULL destination did not set ERROR_INVALID_PARAMETER');

  wat.test_set_last_error(0x1234);
  const noCount = read(false, privateBuffer, ansi, 1, 0, 0, 0);
  assert.deepStrictEqual(noCount, { eax: 0, esp: stack + 24, count: undefined },
    'NULL count pointer was accepted');
  assert.strictEqual(wat.test_get_last_error(), 87,
    'NULL count pointer did not set ERROR_INVALID_PARAMETER');
  assert.deepStrictEqual(read(false, active, ansi, 1, 5, 0),
    { eax: 1, esp: stack + 24, count: 1 },
    'failed private read left private-buffer state selected');
  assert.strictEqual(wat.guest_read8(ansi), 0x61,
    'active buffer was not restored after failed private read');

  wat.guest_write32(count, 0xfeedface);
  wat.test_set_last_error(0x1234);
  const invalid = resultOf(wat.test_read_character_a(
    0xdeadbeef, ansi, 1, coord(0, 0), count, stack));
  assert.deepStrictEqual(invalid, { eax: 0, esp: stack + 24 },
    'invalid output handle was accepted');
  assert.strictEqual(wat.test_get_last_error(), 6,
    'invalid output handle did not set ERROR_INVALID_HANDLE');
  assert.strictEqual(wat.guest_read32(count) >>> 0, 0xfeedface,
    'invalid-handle failure changed the caller count');

  console.log('console output-character read tests passed');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
