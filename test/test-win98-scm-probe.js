#!/usr/bin/env node

'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`

  (func (export "test_call_OpenSCManagerA") (result i32)
    (local $saved_esp i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_OpenSCManagerA
      (i32.const 0) (i32.const 0) (i32.const 0xF003F)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_call_CloseServiceHandle") (param $handle i32) (result i32)
    (local $saved_esp i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_CloseServiceHandle
      (local.get $handle) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (i32.load offset=0 (global.get $reg_base)))
`;

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat });
  assert.strictEqual(e.test_call_OpenSCManagerA(), 0,
    'Windows 98 personality does not advertise NT service management');
  assert.strictEqual(e.test_get_last_error(), 120,
    'failure reports ERROR_CALL_NOT_IMPLEMENTED');
  assert.strictEqual(e.test_call_CloseServiceHandle(0), 0);
  assert.strictEqual(e.test_get_last_error(), 6,
    'a null service handle reports ERROR_INVALID_HANDLE');
  assert.strictEqual(e.test_call_CloseServiceHandle(0x53434d31), 0,
    'a fabricated service handle is not accepted');
  assert.strictEqual(e.test_get_last_error(), 6,
    'a fabricated service handle reports ERROR_INVALID_HANDLE');
  console.log('PASS  Win98 SCM probe selects the non-NT installer path');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
