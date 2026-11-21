#!/usr/bin/env node

'use strict';

const assert = require('assert');
const apiTable = require('../src/api_table.json');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func $pack_input_result (result i64)
    (i64.or
      (i64.extend_i32_u (i32.load offset=0 (global.get $reg_base)))
      (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))

  (func (export "test_write_input")
        (param $handle i32) (param $buffer i32) (param $length i32)
        (param $written i32) (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_WriteConsoleInputW
      (local.get $handle) (local.get $buffer) (local.get $length)
      (local.get $written) (i32.const 0) (i32.const 0))
    (call $pack_input_result))

  (func (export "test_read_input")
        (param $handle i32) (param $buffer i32) (param $length i32)
        (param $read i32) (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_ReadConsoleInputW
      (local.get $handle) (local.get $buffer) (local.get $length)
      (local.get $read) (i32.const 0) (i32.const 0))
    (call $pack_input_result))

  (func (export "test_reset_input")
    (i32.store (global.get $CONSOLE_INPUT) (i32.const 0))
    (i32.store (region.addr $CONSOLE_INPUT 4) (i32.const 0)))
  (func (export "test_push_pending")
    (call $console_input_push (i32.const 0x50) (i32.const 0x50)))
  (func (export "test_input_count") (result i32)
    (call $console_input_count))
  (func (export "test_input_max") (result i32)
    (global.get $CONSOLE_INPUT_MAX))
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
  const api = apiTable.find(entry => entry.name === 'WriteConsoleInputW');
  assert(api, 'WriteConsoleInputW is exported');
  assert.strictEqual(api.nargs, 4, 'WriteConsoleInputW has four arguments');
  assert.strictEqual(api.convention, 'stdcall', 'WriteConsoleInputW uses stdcall');

  const { exports: wat } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const stack = 0x074ff000;
  const records = wat.guest_alloc(6 * 20) >>> 0;
  const output = wat.guest_alloc(6 * 20) >>> 0;
  const countPointer = wat.guest_alloc(4) >>> 0;
  const write16 = (base, offset, value) => wat.guest_write16(base + offset, value);
  const write32 = (base, offset, value) => wat.guest_write32(base + offset, value);
  const read16 = (base, offset) => wat.test_read16(base + offset);
  const read32 = (base, offset) => wat.guest_read32(base + offset) >>> 0;
  const clearRecord = base => {
    for (let offset = 0; offset < 20; offset += 4) write32(base, offset, 0);
  };
  const writeInput = (buffer, length, handle = 1, written = countPointer) => {
    if (written) wat.guest_write32(written, 0xcccccccc);
    const result = resultOf(wat.test_write_input(handle, buffer, length, written, stack));
    return { ...result, written: written ? read32(written, 0) : undefined };
  };
  const readInput = length => {
    wat.guest_write32(countPointer, 0xcccccccc);
    const result = resultOf(wat.test_read_input(1, output, length, countPointer, stack));
    return { ...result, read: read32(countPointer, 0) };
  };

  // KEY_EVENT with Unicode and complete keyboard metadata.
  clearRecord(records);
  write16(records, 0, 1);
  write32(records, 4, 0);       // key up
  write16(records, 8, 3);       // repeat count
  write16(records, 10, 0x70);   // VK_F1
  write16(records, 12, 0x3b);   // scan code
  write16(records, 14, 0x03a9); // Greek capital omega
  write32(records, 16, 0x104);  // RIGHT_CTRL_PRESSED | ENHANCED_KEY

  // MOUSE_EVENT uses the other complete 16-byte INPUT_RECORD union.
  clearRecord(records + 20);
  write16(records + 20, 0, 2);
  write32(records + 20, 4, (7 << 16) | 12);
  write32(records + 20, 8, 5);
  write32(records + 20, 12, 0x18);
  write32(records + 20, 16, 4);

  wat.test_reset_input();
  wat.test_push_pending();
  assert.deepStrictEqual(writeInput(records, 2),
    { eax: 1, esp: stack + 20, written: 2 },
    'WriteConsoleInputW did not report two injected records');
  assert.strictEqual(wat.test_input_count(), 3,
    'injected records did not follow the pending event');
  assert.deepStrictEqual(readInput(3), { eax: 1, esp: stack + 20, read: 3 });
  assert.strictEqual(read16(output, 10), 0x50, 'pending event was not first');
  const key = output + 20;
  assert.strictEqual(read16(key, 0), 1);
  assert.strictEqual(read32(key, 4), 0, 'key-up state was lost');
  assert.strictEqual(read16(key, 8), 3);
  assert.strictEqual(read16(key, 10), 0x70);
  assert.strictEqual(read16(key, 12), 0x3b);
  assert.strictEqual(read16(key, 14), 0x03a9, 'Unicode character was narrowed');
  assert.strictEqual(read32(key, 16), 0x104);
  const mouse = output + 40;
  assert.deepStrictEqual([read16(mouse, 0), read32(mouse, 4), read32(mouse, 8),
    read32(mouse, 12), read32(mouse, 16)], [2, (7 << 16) | 12, 5, 0x18, 4]);
  assert.strictEqual(wat.test_input_count(), 0, 'ReadConsoleInputW did not drain injected records');

  // The three smaller INPUT_RECORD unions remain byte-exact too.
  for (const [index, type, payload] of [
    [0, 4, (40 << 16) | 120], // WINDOW_BUFFER_SIZE_EVENT
    [1, 8, 0x12345678],       // MENU_EVENT
    [2, 16, 1],               // FOCUS_EVENT
  ]) {
    const base = records + index * 20;
    clearRecord(base);
    write16(base, 0, type);
    write32(base, 4, payload);
    write32(base, 8, 0x11110000 + index);
    write32(base, 12, 0x22220000 + index);
    write32(base, 16, 0x33330000 + index);
  }
  wat.test_reset_input();
  assert.deepStrictEqual(writeInput(records, 3),
    { eax: 1, esp: stack + 20, written: 3 });
  assert.deepStrictEqual(readInput(3), { eax: 1, esp: stack + 20, read: 3 });
  for (let index = 0; index < 3; index++) {
    const source = records + index * 20;
    const destination = output + index * 20;
    assert.strictEqual(read16(destination, 0), read16(source, 0));
    for (let offset = 4; offset < 20; offset += 4) {
      assert.strictEqual(read32(destination, offset), read32(source, offset),
        `record ${index} payload dword ${offset} changed`);
    }
  }

  wat.test_reset_input();
  assert.deepStrictEqual(writeInput(0, 0),
    { eax: 1, esp: stack + 20, written: 0 },
    'zero-length input write did not succeed without a source array');
  assert.strictEqual(wat.test_input_count(), 0);

  wat.test_set_last_error(0x1234);
  assert.deepStrictEqual(writeInput(records, 1, 0x1234),
    { eax: 0, esp: stack + 20, written: 0xcccccccc },
    'invalid input handle did not fail');
  assert.strictEqual(wat.test_get_last_error(), 6);
  assert.strictEqual(wat.test_input_count(), 0);

  wat.test_set_last_error(0x1234);
  assert.deepStrictEqual(writeInput(0, 1),
    { eax: 0, esp: stack + 20, written: 0 },
    'NULL record array with nonzero length did not fail');
  assert.strictEqual(wat.test_get_last_error(), 87);
  assert.strictEqual(wat.test_input_count(), 0);

  wat.test_set_last_error(0x1234);
  assert.deepStrictEqual(writeInput(records, 1, 1, 0),
    { eax: 0, esp: stack + 20, written: undefined },
    'NULL written-count pointer did not fail');
  assert.strictEqual(wat.test_get_last_error(), 87);
  assert.strictEqual(wat.test_input_count(), 0);

  // The browser ring is bounded. Never read beyond the supplied array when
  // the request is larger than its remaining capacity; report the actual fit.
  const capacity = wat.test_input_max() >>> 0;
  const many = wat.guest_alloc((capacity + 1) * 20) >>> 0;
  for (let index = 0; index <= capacity; index++) {
    clearRecord(many + index * 20);
    write16(many + index * 20, 0, 16);
    write32(many + index * 20, 4, index & 1);
  }
  wat.test_reset_input();
  assert.deepStrictEqual(writeInput(many, capacity + 1),
    { eax: 1, esp: stack + 20, written: capacity },
    'bounded input ring did not report its actual accepted count');
  assert.strictEqual(wat.test_input_count(), capacity);

  console.log('PASS WriteConsoleInputW enqueues ordered, lossless console input records');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
