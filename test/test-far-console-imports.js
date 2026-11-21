#!/usr/bin/env node

'use strict';

const assert = require('assert');
const apiTable = require('../src/api_table.json');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func $pack_far_console_result (result i64)
    (i64.or
      (i64.extend_i32_u (i32.load offset=0 (global.get $reg_base)))
      (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))

  (func (export "test_set_cp")
        (param $cp i32) (param $output i32) (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (if (local.get $output)
      (then
        (call $handle_SetConsoleOutputCP
          (local.get $cp) (i32.const 0) (i32.const 0)
          (i32.const 0) (i32.const 0) (i32.const 0)))
      (else
        (call $handle_SetConsoleCP
          (local.get $cp) (i32.const 0) (i32.const 0)
          (i32.const 0) (i32.const 0) (i32.const 0))))
    (call $pack_far_console_result))

  (func (export "test_get_cp") (param $output i32) (result i32)
    (if (local.get $output)
      (then
        (call $handle_GetConsoleOutputCP
          (i32.const 0) (i32.const 0) (i32.const 0)
          (i32.const 0) (i32.const 0) (i32.const 0)))
      (else
        (call $handle_GetConsoleCP
          (i32.const 0) (i32.const 0) (i32.const 0)
          (i32.const 0) (i32.const 0) (i32.const 0))))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_set_attribute")
        (param $handle i32) (param $attribute i32) (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_SetConsoleTextAttribute
      (local.get $handle) (local.get $attribute) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (call $pack_far_console_result))

  (func (export "test_create_buffer") (result i32)
    (call $console_buffer_create))
  (func (export "test_buffer_attribute") (param $handle i32) (result i32)
    (i32.load offset=32 (call $console_buffer_record (local.get $handle))))
  (func (export "test_loaded_attribute") (result i32)
    (global.get $console_attr))
  (func (export "test_activate") (param $handle i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
    (call $handle_SetConsoleActiveScreenBuffer
      (local.get $handle) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0)))

  (func (export "test_write_input")
        (param $buffer i32) (param $length i32) (param $written i32)
        (param $wide i32) (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (if (local.get $wide)
      (then
        (call $handle_WriteConsoleInputW
          (i32.const 1) (local.get $buffer) (local.get $length)
          (local.get $written) (i32.const 0) (i32.const 0)))
      (else
        (call $handle_WriteConsoleInputA
          (i32.const 1) (local.get $buffer) (local.get $length)
          (local.get $written) (i32.const 0) (i32.const 0))))
    (call $pack_far_console_result))

  (func (export "test_peek_w")
        (param $handle i32) (param $buffer i32) (param $length i32)
        (param $read i32) (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_PeekConsoleInputW
      (local.get $handle) (local.get $buffer) (local.get $length)
      (local.get $read) (i32.const 0) (i32.const 0))
    (call $pack_far_console_result))

  (func (export "test_read_w")
        (param $buffer i32) (param $length i32) (param $read i32)
        (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_ReadConsoleInputW
      (i32.const 1) (local.get $buffer) (local.get $length)
      (local.get $read) (i32.const 0) (i32.const 0))
    (call $pack_far_console_result))

  (func (export "test_reset_input")
    (i32.store (global.get $CONSOLE_INPUT) (i32.const 0))
    (i32.store (region.addr $CONSOLE_INPUT 4) (i32.const 0)))
  (func (export "test_input_count") (result i32)
    (call $console_input_count))
  (func (export "test_set_attached") (param $attached i32)
    (i32.atomic.store (region.addr $CONSOLE_INPUT 0xC10)
      (select (i32.const 1) (i32.const 2) (local.get $attached))))
  (func (export "test_set_last_error") (param $value i32)
    (global.set $last_error (local.get $value)))
  (func (export "test_read16") (param $address i32) (result i32)
    (i32.load16_u (call $g2w (local.get $address))))
`;

const unpack = packed => ({
  eax: Number(packed & 0xffffffffn) >>> 0,
  esp: Number(packed >> 32n) >>> 0,
});

(async () => {
  for (const [name, nargs] of [
    ['SetConsoleCP', 1],
    ['SetConsoleOutputCP', 1],
    ['SetConsoleTextAttribute', 2],
    ['PeekConsoleInputW', 4],
    ['WriteConsoleInputA', 4],
  ]) {
    const api = apiTable.find(entry => entry.name === name);
    assert(api, `${name} is exported`);
    assert.strictEqual(api.nargs, nargs, `${name} argument count`);
    assert.strictEqual(api.convention, 'stdcall', `${name} calling convention`);
  }

  const { exports: wat } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const stack = 0x074ff000;

  // Console code pages round-trip through the existing input/output state.
  // Successful setters do not promise to clear a caller's prior LastError.
  wat.test_set_attached(1);
  wat.test_set_last_error(0x1234);
  assert.deepStrictEqual(unpack(wat.test_set_cp(932, 0, stack)),
    { eax: 1, esp: stack + 8 });
  assert.strictEqual(wat.test_get_cp(0), 932);
  assert.strictEqual(wat.test_get_last_error(), 0x1234);
  assert.deepStrictEqual(unpack(wat.test_set_cp(1252, 1, stack)),
    { eax: 1, esp: stack + 8 });
  assert.strictEqual(wat.test_get_cp(1), 1252);

  assert.deepStrictEqual(unpack(wat.test_set_cp(0, 0, stack)),
    { eax: 0, esp: stack + 8 });
  assert.strictEqual(wat.test_get_last_error(), 87);
  assert.strictEqual(wat.test_get_cp(0), 932, 'invalid page changed console state');

  wat.test_set_attached(0);
  assert.deepStrictEqual(unpack(wat.test_set_cp(437, 1, stack)),
    { eax: 0, esp: stack + 8 });
  assert.strictEqual(wat.test_get_last_error(), 6);
  assert.strictEqual(wat.test_get_cp(1), 0, 'detached console exposed an output page');
  wat.test_set_attached(1);
  assert.strictEqual(wat.test_get_cp(1), 1252, 'failed setter changed output page');

  // Current attributes belong to each screen buffer. Updating an inactive
  // buffer must not drift the active buffer's loaded drawing state.
  wat.test_set_last_error(0x5678);
  assert.deepStrictEqual(unpack(wat.test_set_attribute(2, 0x1e, stack)),
    { eax: 1, esp: stack + 12 });
  assert.strictEqual(wat.test_get_last_error(), 0x5678);
  const privateBuffer = wat.test_create_buffer() >>> 0;
  assert(privateBuffer, 'private console screen buffer was not created');
  assert.deepStrictEqual(unpack(wat.test_set_attribute(privateBuffer, 0x12342f, stack)),
    { eax: 1, esp: stack + 12 });
  assert.strictEqual(wat.test_buffer_attribute(2), 0x1e);
  assert.strictEqual(wat.test_buffer_attribute(privateBuffer), 0x342f,
    'WORD attribute was not retained by the target buffer');
  assert.strictEqual(wat.test_loaded_attribute(), 0x1e,
    'inactive buffer attribute leaked into active drawing state');
  wat.test_activate(privateBuffer);
  assert.strictEqual(wat.test_loaded_attribute(), 0x342f,
    'activating a buffer did not load its current attribute');

  wat.test_set_last_error(0x1234);
  assert.deepStrictEqual(unpack(wat.test_set_attribute(0x1234, 7, stack)),
    { eax: 0, esp: stack + 12 });
  assert.strictEqual(wat.test_get_last_error(), 6);

  // ANSI input consumes only AsciiChar (+14), never the adjacent padding
  // byte. Unicode input consumes the complete WCHAR at the same offset.
  const records = wat.guest_alloc(40) >>> 0;
  const output = wat.guest_alloc(40) >>> 0;
  const count = wat.guest_alloc(4) >>> 0;
  const write16 = (address, value) => wat.guest_write16(address, value);
  const read16 = address => wat.test_read16(address);
  for (let offset = 0; offset < 40; offset += 4) {
    wat.guest_write32(records + offset, 0);
  }
  write16(records, 1);                // KEY_EVENT
  wat.guest_write32(records + 4, 1);  // key down
  write16(records + 8, 1);
  write16(records + 10, 0x41);
  write16(records + 12, 0x1e);
  write16(records + 14, 0xbeef);      // A sees EF; BE is padding
  write16(records + 20, 1);
  wat.guest_write32(records + 24, 1);
  write16(records + 28, 1);
  write16(records + 30, 0x42);
  write16(records + 32, 0x30);
  write16(records + 34, 0x03a9);      // W preserves complete Unicode

  wat.test_reset_input();
  wat.guest_write32(count, 0xcccccccc);
  assert.deepStrictEqual(unpack(wat.test_write_input(records, 1, count, 0, stack)),
    { eax: 1, esp: stack + 20 });
  assert.strictEqual(wat.guest_read32(count) >>> 0, 1);
  assert.deepStrictEqual(unpack(wat.test_write_input(records + 20, 1, count, 1, stack)),
    { eax: 1, esp: stack + 20 });
  assert.strictEqual(wat.test_input_count(), 2);

  wat.guest_write32(count, 0xcccccccc);
  assert.deepStrictEqual(unpack(wat.test_peek_w(1, output, 2, count, stack)),
    { eax: 1, esp: stack + 20 });
  assert.strictEqual(wat.guest_read32(count) >>> 0, 2);
  assert.strictEqual(read16(output + 14), 0x00ef,
    'WriteConsoleInputA consumed the padding byte as Unicode');
  assert.strictEqual(read16(output + 34), 0x03a9,
    'WriteConsoleInputW narrowed its Unicode character');
  assert.strictEqual(wat.test_input_count(), 2, 'PeekConsoleInputW consumed input');

  wat.guest_write32(count, 0xcccccccc);
  assert.deepStrictEqual(unpack(wat.test_read_w(output, 2, count, stack)),
    { eax: 1, esp: stack + 20 });
  assert.strictEqual(wat.guest_read32(count) >>> 0, 2);
  assert.strictEqual(wat.test_input_count(), 0, 'ReadConsoleInputW did not drain peeked records');

  wat.test_reset_input();
  assert.deepStrictEqual(unpack(wat.test_peek_w(1, output, 2, count, stack)),
    { eax: 1, esp: stack + 20 });
  assert.strictEqual(wat.guest_read32(count) >>> 0, 0);
  assert.strictEqual(wat.test_input_count(), 0, 'empty peek changed the queue');

  wat.test_set_last_error(0x1234);
  wat.guest_write32(count, 0xcccccccc);
  assert.deepStrictEqual(unpack(wat.test_peek_w(0x1234, output, 1, count, stack)),
    { eax: 0, esp: stack + 20 });
  assert.strictEqual(wat.test_get_last_error(), 6);
  assert.strictEqual(wat.guest_read32(count) >>> 0, 0xcccccccc);

  console.log('PASS Far console imports: code pages, per-buffer attributes, A/W input, peek, ABI');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
