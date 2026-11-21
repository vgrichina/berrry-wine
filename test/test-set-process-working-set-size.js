#!/usr/bin/env node
'use strict';

// The browser cannot ask its host to page a WASM process, but valid requests
// remain advisory successes. Process identity and documented size constraints
// must still be checked before claiming the request succeeded.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const CURRENT_PROCESS = -1;
const ERROR_INVALID_HANDLE = 6;
const ERROR_INVALID_PARAMETER = 87;
const B_AND_W2_MINIMUM = 128 * 1024 * 1024;
const B_AND_W2_MAXIMUM = 462 * 1024 * 1024;
const extraWat = String.raw`
  (func (export "test_set_working_set")
      (param $process i32) (param $minimum i32) (param $maximum i32)
      (result i32)
    (i32.store offset=16 (global.get $reg_base) (global.get $GUEST_STACK))
    (call $handle_SetProcessWorkingSetSize
      (local.get $process) (local.get $minimum) (local.get $maximum)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_process_id") (result i32)
    (call $current_process_id))
  (func (export "test_open_process") (param $pid i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (global.get $GUEST_STACK))
    (call $handle_OpenProcess
      (i32.const 0x0100) (i32.const 0) (local.get $pid)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_set_last_error") (param $value i32)
    (global.set $last_error (local.get $value)))
  (func (export "test_stack") (result i32)
    (global.get $GUEST_STACK))
`;

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none' });

  e.test_set_last_error(0x1234);
  const stack = e.test_stack() >>> 0;
  assert.strictEqual(
    e.test_set_working_set(CURRENT_PROCESS, B_AND_W2_MINIMUM, B_AND_W2_MAXIMUM), 1,
    'Black & White 2 working-set limits remain a valid advisory request');
  assert.strictEqual(e.test_get_last_error(), 0x1234,
    'successful working-set requests preserve LastError');
  assert.strictEqual(e.get_esp() >>> 0, stack + 16,
    'SetProcessWorkingSetSize pops three stdcall arguments and the return address');

  assert.strictEqual(e.test_set_working_set(CURRENT_PROCESS, -1, -1), 1,
    'the documented working-set trimming request succeeds');
  assert.strictEqual(e.test_set_working_set(CURRENT_PROCESS, 1, 0x0000d000), 1,
    'a positive minimum and thirteen-page maximum meet the documented boundary');

  const process = e.test_open_process(e.test_process_id()) >>> 0;
  assert.notStrictEqual(process, 0,
    'OpenProcess returns a durable handle for the modeled process');
  assert.strictEqual(e.test_set_working_set(process, 0x100000, 0x200000), 1,
    'a durable current-process handle accepts ordered limits');

  for (const [minimum, maximum, label] of [
    [0, 0x200000, 'zero minimum'],
    [0x1000, 0x0000cfff, 'maximum below thirteen pages'],
    [0x300000, 0x200000, 'minimum above maximum'],
    [-1, 0x200000, 'half of the special trimming pair'],
  ]) {
    assert.strictEqual(e.test_set_working_set(CURRENT_PROCESS, minimum, maximum), 0,
      `${label} is rejected`);
    assert.strictEqual(e.test_get_last_error(), ERROR_INVALID_PARAMETER,
      `${label} reports ERROR_INVALID_PARAMETER`);
  }

  assert.strictEqual(e.test_set_working_set(0, 0x100000, 0x200000), 0,
    'a null process handle is rejected');
  assert.strictEqual(e.test_get_last_error(), ERROR_INVALID_HANDLE,
    'a null process handle reports ERROR_INVALID_HANDLE');
  assert.strictEqual(e.test_set_working_set(0x7777, 0, 0), 0,
    'process validation precedes malformed size validation');
  assert.strictEqual(e.test_get_last_error(), ERROR_INVALID_HANDLE,
    'a fabricated process handle reports ERROR_INVALID_HANDLE');
  assert.strictEqual(e.get_esp() >>> 0, stack + 16,
    'failed working-set requests preserve stdcall cleanup');

  console.log('PASS  SetProcessWorkingSetSize validates process and size contract');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
