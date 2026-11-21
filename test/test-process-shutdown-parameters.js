#!/usr/bin/env node
'use strict';

// Shutdown priority is observable process state even though the browser never
// asks the guest to participate in a host shutdown. Keep the state truthful
// and reject values outside the documented Win32 contract.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const ERROR_INVALID_PARAMETER = 87;
const extraWat = String.raw`
  (func (export "test_set_shutdown") (param $level i32) (param $flags i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (global.get $GUEST_STACK))
    (call $handle_SetProcessShutdownParameters
      (local.get $level) (local.get $flags) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_get_shutdown") (param $level i32) (param $flags i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (global.get $GUEST_STACK))
    (call $handle_GetProcessShutdownParameters
      (local.get $level) (local.get $flags) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_alloc") (param $size i32) (result i32)
    (call $heap_alloc (local.get $size)))
  (func (export "test_load32") (param $ga i32) (result i32)
    (call $gl32 (local.get $ga)))
  (func (export "test_store32") (param $ga i32) (param $value i32)
    (call $gs32 (local.get $ga) (local.get $value)))
  (func (export "test_set_last_error") (param $value i32)
    (global.set $last_error (local.get $value)))
  (func (export "test_stack") (result i32)
    (global.get $GUEST_STACK))
`;

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const stack = e.test_stack() >>> 0;
  const levelOut = e.test_alloc(4) >>> 0;
  const flagsOut = e.test_alloc(4) >>> 0;

  e.test_set_last_error(0x1234);
  assert.strictEqual(e.test_set_shutdown(0x280, 0), 1,
    'the default application shutdown priority is accepted');
  assert.strictEqual(e.test_get_last_error(), 0x1234,
    'a successful setter preserves LastError');
  assert.strictEqual(e.get_esp() >>> 0, stack + 12,
    'SetProcessShutdownParameters pops two arguments and the return address');

  assert.strictEqual(e.test_set_shutdown(0x4ff, 1), 1,
    'the top documented priority and SHUTDOWN_NORETRY are accepted');
  assert.strictEqual(e.test_get_shutdown(levelOut, flagsOut), 1,
    'the matching getter succeeds with both required outputs');
  assert.strictEqual(e.test_load32(levelOut) >>> 0, 0x4ff,
    'the getter returns the retained shutdown priority');
  assert.strictEqual(e.test_load32(flagsOut) >>> 0, 1,
    'the getter returns the retained shutdown flags');
  assert.strictEqual(e.get_esp() >>> 0, stack + 12,
    'GetProcessShutdownParameters uses exact stdcall cleanup');

  for (const [level, flags, label] of [
    [0x500, 0, 'priority above the documented range'],
    [0x280, 2, 'unknown flag bit'],
    [0xffffffff, 1, 'unsigned out-of-range priority'],
  ]) {
    assert.strictEqual(e.test_set_shutdown(level, flags), 0, `${label} is rejected`);
    assert.strictEqual(e.test_get_last_error(), ERROR_INVALID_PARAMETER,
      `${label} reports ERROR_INVALID_PARAMETER`);
  }

  assert.strictEqual(e.test_get_shutdown(levelOut, flagsOut), 1,
    'failed setters do not damage the retained state');
  assert.strictEqual(e.test_load32(levelOut) >>> 0, 0x4ff,
    'failed setters preserve the prior shutdown priority');
  assert.strictEqual(e.test_load32(flagsOut) >>> 0, 1,
    'failed setters preserve the prior shutdown flags');

  for (const [level, flags, label] of [
    [0, flagsOut, 'NULL level output'],
    [levelOut, 0, 'NULL flags output'],
  ]) {
    e.test_store32(levelOut, 0x11223344);
    e.test_store32(flagsOut, 0x55667788);
    assert.strictEqual(e.test_get_shutdown(level, flags), 0, `${label} is rejected`);
    assert.strictEqual(e.test_get_last_error(), ERROR_INVALID_PARAMETER,
      `${label} reports ERROR_INVALID_PARAMETER`);
    assert.strictEqual(e.test_load32(levelOut) >>> 0, 0x11223344,
      `${label} does not partially write the level destination`);
    assert.strictEqual(e.test_load32(flagsOut) >>> 0, 0x55667788,
      `${label} does not partially write the flags destination`);
  }

  console.log('PASS  process shutdown parameters validate and round-trip state');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
