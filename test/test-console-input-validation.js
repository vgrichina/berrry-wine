#!/usr/bin/env node

'use strict';

const assert = require('assert');
const apiTable = require('../src/api_table.json');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func $pack_console_input_result (result i64)
    (i64.or
      (i64.extend_i32_u (i32.load offset=0 (global.get $reg_base)))
      (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))

  (func (export "test_read_a")
        (param $handle i32) (param $buffer i32) (param $length i32)
        (param $count i32) (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_ReadConsoleInputA
      (local.get $handle) (local.get $buffer) (local.get $length)
      (local.get $count) (i32.const 0) (i32.const 0))
    (call $pack_console_input_result))

  (func (export "test_read_w")
        (param $handle i32) (param $buffer i32) (param $length i32)
        (param $count i32) (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_ReadConsoleInputW
      (local.get $handle) (local.get $buffer) (local.get $length)
      (local.get $count) (i32.const 0) (i32.const 0))
    (call $pack_console_input_result))

  (func (export "test_peek_a")
        (param $handle i32) (param $buffer i32) (param $length i32)
        (param $count i32) (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_PeekConsoleInputA
      (local.get $handle) (local.get $buffer) (local.get $length)
      (local.get $count) (i32.const 0) (i32.const 0))
    (call $pack_console_input_result))

  (func (export "test_peek_w")
        (param $handle i32) (param $buffer i32) (param $length i32)
        (param $count i32) (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_PeekConsoleInputW
      (local.get $handle) (local.get $buffer) (local.get $length)
      (local.get $count) (i32.const 0) (i32.const 0))
    (call $pack_console_input_result))

  (func (export "test_get_count")
        (param $handle i32) (param $count i32) (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_GetNumberOfConsoleInputEvents
      (local.get $handle) (local.get $count) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (call $pack_console_input_result))

  (func (export "test_reset_input")
    (i32.store (global.get $CONSOLE_INPUT) (i32.const 0))
    (i32.store (region.addr $CONSOLE_INPUT 4) (i32.const 0))
    (global.set $yield_flag (i32.const 0))
    (global.set $yield_reason (i32.const 0))
    (global.set $handler_set_eip (i32.const 0)))
  (func (export "test_push") (param $character i32) (param $vk i32)
    (call $console_input_push (local.get $character) (local.get $vk)))
  (func (export "test_queue_count") (result i32)
    (call $console_input_count))
  (func (export "test_yield_flag") (result i32)
    (global.get $yield_flag))
  (func (export "test_set_last_error") (param $value i32)
    (global.set $last_error (local.get $value)))
`;

const resultOf = packed => ({
  eax: Number(packed & 0xffffffffn) >>> 0,
  esp: Number(packed >> 32n) >>> 0,
});

(async () => {
  for (const [name, nargs] of [
    ['ReadConsoleInputA', 4],
    ['ReadConsoleInputW', 4],
    ['PeekConsoleInputA', 4],
    ['PeekConsoleInputW', 4],
    ['GetNumberOfConsoleInputEvents', 2],
  ]) {
    const api = apiTable.find(entry => entry.name === name);
    assert(api, `${name} is exported`);
    assert.strictEqual(api.nargs, nargs, `${name} argument count`);
    assert.strictEqual(api.convention, 'stdcall', `${name} calling convention`);
  }
  const { exports: wat } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const stack = 0x074ff000;
  const buffer = wat.guest_alloc(40) >>> 0;
  const count = wat.guest_alloc(4) >>> 0;
  const read16 = offset => {
    const word = wat.guest_read32(buffer + (offset & ~3)) >>> 0;
    return (word >>> ((offset & 2) * 8)) & 0xffff;
  };
  const invoke = (kind, handle = 1, output = buffer, length = 1, countOut = count) => {
    wat.guest_write32(count, 0xcccccccc);
    const calls = {
      readA: wat.test_read_a,
      readW: wat.test_read_w,
      peekA: wat.test_peek_a,
      peekW: wat.test_peek_w,
    };
    const packed = calls[kind](handle, output, length, countOut, stack);
    return {
      ...resultOf(packed),
      count: countOut ? wat.guest_read32(count) >>> 0 : undefined,
    };
  };

  // Peek on an empty queue returns immediately and reports zero.
  wat.test_reset_input();
  assert.deepStrictEqual(invoke('peekA'),
    { eax: 1, esp: stack + 20, count: 0 });
  assert.strictEqual(wat.test_yield_flag(), 0, 'empty PeekConsoleInputA blocked');
  assert.deepStrictEqual(invoke('peekW'),
    { eax: 1, esp: stack + 20, count: 0 });
  assert.strictEqual(wat.test_yield_flag(), 0, 'empty PeekConsoleInputW blocked');

  // A zero-sized read completes without a destination and does not consume or
  // wait, even when a record is pending.
  for (const kind of ['readA', 'readW', 'peekA', 'peekW']) {
    wat.test_reset_input();
    wat.test_push(0x51, 0x51);
    assert.deepStrictEqual(invoke(kind, 1, 0, 0),
      { eax: 1, esp: stack + 20, count: 0 }, `${kind} zero-length result`);
    assert.strictEqual(wat.test_queue_count(), 1, `${kind} consumed a record at length zero`);
    assert.strictEqual(wat.test_yield_flag(), 0, `${kind} blocked at length zero`);
  }

  // Peek preserves the queue and applies ANSI narrowing; the W read that
  // follows preserves the complete Unicode character and drains the record.
  wat.test_reset_input();
  wat.test_push(0x03a9, 0x70);
  assert.deepStrictEqual(invoke('peekA'),
    { eax: 1, esp: stack + 20, count: 1 });
  assert.strictEqual(read16(0), 1, 'peek did not return KEY_EVENT');
  assert.strictEqual(read16(10), 0x70);
  assert.strictEqual(read16(14), 0xa9, 'ANSI peek did not narrow Unicode char');
  assert.strictEqual(wat.test_queue_count(), 1, 'peek drained its record');
  assert.deepStrictEqual(invoke('peekW'),
    { eax: 1, esp: stack + 20, count: 1 });
  assert.strictEqual(read16(14), 0x03a9, 'wide peek lost Unicode char');
  assert.strictEqual(wat.test_queue_count(), 1, 'wide peek drained its record');
  assert.deepStrictEqual(invoke('readW'),
    { eax: 1, esp: stack + 20, count: 1 });
  assert.strictEqual(read16(14), 0x03a9, 'wide read lost Unicode char');
  assert.strictEqual(wat.test_queue_count(), 0, 'read did not consume its record');

  // ReadConsoleInput remains blocking when capacity is nonzero and the queue
  // is empty. A parked handler has not returned to pop its stdcall frame.
  wat.test_reset_input();
  wat.guest_write32(count, 0xcccccccc);
  assert.deepStrictEqual(resultOf(wat.test_read_a(1, buffer, 1, count, stack)),
    { eax: 1, esp: stack });
  assert.strictEqual(wat.guest_read32(count) >>> 0, 0xcccccccc,
    'blocked read fabricated a completed count');
  assert.strictEqual(wat.test_yield_flag(), 1, 'empty ReadConsoleInputA did not block');

  // Every exported reader rejects the wrong handle before polling or touching
  // caller output, and rejects missing required output pointers.
  for (const kind of ['readA', 'readW', 'peekA', 'peekW']) {
    wat.test_reset_input();
    wat.test_push(0x52, 0x52);
    wat.guest_write32(buffer, 0xfeedface);
    wat.test_set_last_error(0x1234);
    assert.deepStrictEqual(invoke(kind, 0x1234),
      { eax: 0, esp: stack + 20, count: 0xcccccccc }, `${kind} invalid handle`);
    assert.strictEqual(wat.test_get_last_error(), 6, `${kind} invalid-handle error`);
    assert.strictEqual(wat.guest_read32(buffer) >>> 0, 0xfeedface,
      `${kind} invalid handle changed destination`);
    assert.strictEqual(wat.test_queue_count(), 1, `${kind} invalid handle consumed input`);

    wat.test_set_last_error(0x1234);
    assert.deepStrictEqual(invoke(kind, 1, 0, 1),
      { eax: 0, esp: stack + 20, count: 0 }, `${kind} NULL buffer`);
    assert.strictEqual(wat.test_get_last_error(), 87, `${kind} NULL-buffer error`);
    assert.strictEqual(wat.test_queue_count(), 1, `${kind} NULL buffer consumed input`);

    wat.test_set_last_error(0x1234);
    assert.deepStrictEqual(invoke(kind, 1, buffer, 1, 0),
      { eax: 0, esp: stack + 20, count: undefined }, `${kind} NULL count pointer`);
    assert.strictEqual(wat.test_get_last_error(), 87, `${kind} NULL-count error`);
    assert.strictEqual(wat.test_queue_count(), 1, `${kind} NULL count consumed input`);
  }

  // GetNumberOfConsoleInputEvents counts every unread record and has the same
  // strict input-handle/output-pointer boundary.
  wat.test_reset_input();
  wat.test_push(0x41, 0x41);
  wat.test_push(0x42, 0x42);
  wat.guest_write32(count, 0xcccccccc);
  assert.deepStrictEqual(resultOf(wat.test_get_count(1, count, stack)),
    { eax: 1, esp: stack + 12 });
  assert.strictEqual(wat.guest_read32(count) >>> 0, 2);
  assert.strictEqual(wat.test_queue_count(), 2, 'count query consumed input');

  wat.guest_write32(count, 0xcccccccc);
  wat.test_set_last_error(0x1234);
  assert.deepStrictEqual(resultOf(wat.test_get_count(0x1234, count, stack)),
    { eax: 0, esp: stack + 12 });
  assert.strictEqual(wat.guest_read32(count) >>> 0, 0xcccccccc);
  assert.strictEqual(wat.test_get_last_error(), 6);

  wat.test_set_last_error(0x1234);
  assert.deepStrictEqual(resultOf(wat.test_get_count(1, 0, stack)),
    { eax: 0, esp: stack + 12 });
  assert.strictEqual(wat.test_get_last_error(), 87);
  assert.strictEqual(wat.test_queue_count(), 2);

  console.log('PASS console input readers validate, count, peek, block, and handle zero length');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
