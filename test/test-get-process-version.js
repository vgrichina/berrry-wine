#!/usr/bin/env node

'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_set_last_error") (param $value i32)
    (global.set $last_error (local.get $value)))

  (func (export "test_set_process_version_headers")
      (param $os_major i32) (param $os_minor i32)
      (param $subsystem_major i32) (param $subsystem_minor i32)
    (global.set $image_base (i32.const 0x00400000))
    (call $gs32 (i32.const 0x0040003c) (i32.const 0x80))
    (call $gs32 (i32.const 0x00400080) (i32.const 0x00004550))
    ;; IMAGE_OPTIONAL_HEADER32 begins at PE+24. Keep the operating-system and
    ;; subsystem stamps deliberately different so the API cannot confuse them.
    (call $gs16 (i32.const 0x004000c0) (local.get $os_major))
    (call $gs16 (i32.const 0x004000c2) (local.get $os_minor))
    (call $gs16 (i32.const 0x004000c8) (local.get $subsystem_major))
    (call $gs16 (i32.const 0x004000ca) (local.get $subsystem_minor)))

  (func (export "test_call_GetProcessVersion") (param $pid i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_GetProcessVersion
      (local.get $pid) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i64.or
      (i64.extend_i32_u (i32.load offset=0 (global.get $reg_base)))
      (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))
`;

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat });
  e.set_process_id(4321);
  e.test_set_process_version_headers(6, 1, 4, 10);

  e.test_set_last_error(0x1234);
  let packed = e.test_call_GetProcessVersion(0);
  assert.strictEqual(Number(packed & 0xffffffffn), 0x0004000a,
    'PID zero returns the executable subsystem version stamp');
  assert.strictEqual(Number(packed >> 32n), 0x00300008,
    'GetProcessVersion pops its one stdcall argument');
  assert.strictEqual(e.test_get_last_error(), 0x1234,
    'a successful query preserves LastError');

  packed = e.test_call_GetProcessVersion(4321);
  assert.strictEqual(Number(packed & 0xffffffffn), 0x0004000a,
    'the modeled current PID returns the same executable version');

  e.test_set_last_error(0x5678);
  packed = e.test_call_GetProcessVersion(9876);
  assert.strictEqual(Number(packed & 0xffffffffn), 0,
    'an unknown PID does not receive a fabricated version');
  assert.strictEqual(e.test_get_last_error(), 87,
    'an unknown PID reports ERROR_INVALID_PARAMETER');

  console.log('PASS  GetProcessVersion reports the current PE subsystem stamp');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
