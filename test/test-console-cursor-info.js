#!/usr/bin/env node

'use strict';

const assert = require('assert');
const apiTable = require('../src/api_table.json');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_info_map") (param i32) (result i32)
    (call $virtual_map_commit (local.get 0) (i32.const 4096)))
  (func (export "test_screen_info") (param $out i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
    (call $handle_GetConsoleScreenBufferInfo (i32.const 0x30001) (local.get $out)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func $pack_cursor_result (result i64)
    (i64.or
      (i64.extend_i32_u (i32.load offset=0 (global.get $reg_base)))
      (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))

  (func (export "test_set_cursor_info")
        (param $handle i32) (param $info i32) (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_SetConsoleCursorInfo
      (local.get $handle) (local.get $info) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (call $pack_cursor_result))

  (func (export "test_get_cursor_info")
        (param $handle i32) (param $info i32) (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_GetConsoleCursorInfo
      (local.get $handle) (local.get $info) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (call $pack_cursor_result))

  (func (export "test_create_console_buffer") (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_CreateConsoleScreenBuffer
      (i32.const 0xc0000000) (i32.const 3) (i32.const 0)
      (i32.const 1) (i32.const 0) (i32.const 0))
    (call $pack_cursor_result))

  (func (export "test_set_last_error") (param $value i32)
    (global.set $last_error (local.get $value)))
`;

const resultOf = packed => ({
  eax: Number(packed & 0xffffffffn) >>> 0,
  esp: Number(packed >> 32n) >>> 0,
});

(async () => {
  for (const name of ['SetConsoleCursorInfo', 'GetConsoleCursorInfo']) {
    const api = apiTable.find(entry => entry.name === name);
    assert(api, `${name} is exported`);
    assert.strictEqual(api.nargs, 2, `${name} has two arguments`);
    assert.strictEqual(api.convention, 'stdcall', `${name} uses stdcall`);
  }

  const { exports: wat } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const stack = 0x074ff000;
  const active = 0x00030001;
  const input = wat.guest_alloc(8) >>> 0;
  const output = wat.guest_alloc(8) >>> 0;

  const set = (handle, size, visible, pointer = input) => {
    if (pointer) {
      wat.guest_write32(pointer, size);
      wat.guest_write32(pointer + 4, visible);
    }
    return resultOf(wat.test_set_cursor_info(handle, pointer, stack));
  };
  const get = (handle, pointer = output) =>
    resultOf(wat.test_get_cursor_info(handle, pointer, stack));
  const read = pointer => [
    wat.guest_read32(pointer) >>> 0,
    wat.guest_read32(pointer + 4) >>> 0,
  ];

  const page = 0x30000000;
  for (const ga of [page, 0x28000000, page + 4096]) assert.strictEqual(wat.test_info_map(ga) >>> 0, ga);
  assert.notStrictEqual(wat.guest_to_wasm(page + 4096), wat.guest_to_wasm(page) + 4096);
  const bytes = (ga, n) => Array.from({ length: n }, (_, i) => wat.guest_read8(ga + i));
  for (let i = 0; i < 4096; i++) wat.guest_write8(0x28000000 + i, 0xa5);
  for (let split = 1; split < 8; split++) {
    const edge = page + 4096 - split;
    assert.strictEqual(set(active, 37, 1).eax, 1);
    for (let i = -1; i <= 8; i++) wat.guest_write8(edge + i, 0xcc);
    assert.deepStrictEqual(get(active, edge), { eax: 1, esp: stack + 12 });
    assert.deepStrictEqual(bytes(edge - 1, 10), [0xcc, 37, 0, 0, 0, 1, 0, 0, 0, 0xcc]);
    assert.deepStrictEqual(set(active, split + 10, 7, edge), { eax: 1, esp: stack + 12 });
    get(active);
    assert.deepStrictEqual(read(output), [split + 10, 1]);
    assert.strictEqual(set(active, 101, 0, edge).eax, 0);
    get(active);
    assert.deepStrictEqual(read(output), [split + 10, 1], 'invalid split input preserves state');
  }
  set(active, 25, 1);
  const screenInfo = wat.guest_alloc(22) >>> 0;
  assert.strictEqual(wat.test_screen_info(screenInfo), 1);
  const expectedScreen = bytes(screenInfo, 22);
  assert.deepStrictEqual(expectedScreen.slice(0, 4), [80, 0, 25, 0]);
  for (let split = 1; split < 22; split++) {
    const edge = page + 4096 - split;
    for (let i = -1; i <= 22; i++) wat.guest_write8(edge + i, 0xcc);
    assert.strictEqual(wat.test_screen_info(edge), 1);
    assert.deepStrictEqual(bytes(edge - 1, 24), [0xcc, ...expectedScreen, 0xcc]);
    assert.strictEqual(wat.get_esp() >>> 0, stack + 12);
  }
  assert.deepStrictEqual(bytes(0x28000000, 4096), Array(4096).fill(0xa5),
    'info APIs preserve unrelated physical backing');

  assert.deepStrictEqual(get(active), { eax: 1, esp: stack + 12 },
    'GetConsoleCursorInfo succeeds and pops both arguments');
  assert.deepStrictEqual(read(output), [25, 1], 'default cursor state is 25% and visible');

  assert.deepStrictEqual(set(active, 1, 7), { eax: 1, esp: stack + 12 },
    'minimum cursor size succeeds');
  get(active);
  assert.deepStrictEqual(read(output), [1, 1], 'nonzero bVisible is normalized to TRUE');
  assert.strictEqual(set(active, 100, 0).eax, 1, 'maximum cursor size succeeds');
  get(active);
  assert.deepStrictEqual(read(output), [100, 0], 'hidden maximum-size cursor round-trips');

  assert.strictEqual(set(active, 37, 1).eax, 1, 'known cursor state setup failed');
  for (const [size, label] of [[0, 'zero'], [101, 'over 100'], [0xffffffff, 'unsigned overflow']]) {
    wat.test_set_last_error(0x1234);
    assert.deepStrictEqual(set(active, size, 0), { eax: 0, esp: stack + 12 },
      `${label} cursor size succeeded`);
    assert.strictEqual(wat.test_get_last_error(), 87,
      `${label} cursor size did not set ERROR_INVALID_PARAMETER`);
    get(active);
    assert.deepStrictEqual(read(output), [37, 1], `${label} cursor size changed live state`);
  }

  wat.test_set_last_error(0x1234);
  assert.deepStrictEqual(set(active, 0, 0, 0), { eax: 0, esp: stack + 12 },
    'NULL SetConsoleCursorInfo input succeeded');
  assert.strictEqual(wat.test_get_last_error(), 87,
    'NULL SetConsoleCursorInfo did not set ERROR_INVALID_PARAMETER');
  get(active);
  assert.deepStrictEqual(read(output), [37, 1], 'NULL set changed cursor state');

  wat.test_set_last_error(0x1234);
  assert.deepStrictEqual(get(active, 0), { eax: 0, esp: stack + 12 },
    'NULL GetConsoleCursorInfo output succeeded');
  assert.strictEqual(wat.test_get_last_error(), 87,
    'NULL GetConsoleCursorInfo did not set ERROR_INVALID_PARAMETER');

  wat.guest_write32(output, 0xaaaaaaaa);
  wat.guest_write32(output + 4, 0xbbbbbbbb);
  wat.test_set_last_error(0x1234);
  assert.deepStrictEqual(get(0xdeadbeef), { eax: 0, esp: stack + 12 },
    'invalid screen-buffer handle succeeded');
  assert.strictEqual(wat.test_get_last_error(), 6,
    'invalid screen-buffer handle did not set ERROR_INVALID_HANDLE');
  assert.deepStrictEqual(read(output), [0xaaaaaaaa, 0xbbbbbbbb],
    'failed get mutated caller output');

  const created = resultOf(wat.test_create_console_buffer(stack));
  assert.strictEqual(created.esp, stack + 24,
    'CreateConsoleScreenBuffer did not pop five arguments');
  assert(created.eax && created.eax !== 0xffffffff, 'second screen buffer creation failed');
  assert.strictEqual(set(created.eax, 77, 0).eax, 1,
    'second buffer cursor state setup failed');
  get(created.eax);
  assert.deepStrictEqual(read(output), [77, 0], 'second buffer cursor state did not round-trip');
  get(active);
  assert.deepStrictEqual(read(output), [37, 1], 'second buffer changed active cursor state');

  console.log('PASS Set/GetConsoleCursorInfo validate and retain per-buffer Win98 state');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
