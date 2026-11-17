#!/usr/bin/env node

'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const STACK = 0x00300000;
const CALLER_RETURN = 0x00408888;
const CONTINUATION = 0x00402000;
const ENTRY_SENTINEL = 0x00407777;

const extraWat = String.raw`
  (func (export "test_init_common_controls_ex") (param $init i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const ${STACK}))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const ${CALLER_RETURN}))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 4)) (local.get $init))
    (global.set $eip (i32.const ${ENTRY_SENTINEL}))
    (global.set $handler_set_eip (i32.const 0))
    (global.set $steps (i32.const 17))
    (global.set $font_enum_ret_thunk (i32.const ${CONTINUATION}))
    (call $handle_InitCommonControlsEx
      (local.get $init) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))


  (func (export "test_guest_common_controls_entry") (result i32)
    (call $guest_comctl32_init_common_controls_ex))
`;

(async () => {
  const { exports: wat } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const policy = require('../lib/dll-registry');
  assert(policy.isBuiltinOnlyDll('comctl32.dll'));
  assert(!policy.isLoadableDll('comctl32.dll'));
  const init = wat.guest_alloc(8) >>> 0;
  const call = flags => {
    wat.guest_write32(init, 8);
    wat.guest_write32(init + 4, flags);
    return wat.test_init_common_controls_ex(init);
  };
  assert.strictEqual(wat.test_init_common_controls_ex(0), 0, 'NULL fails');
  for (const size of [0, 4, 12]) {
    wat.guest_write32(init, size);
    assert.strictEqual(wat.test_init_common_controls_ex(init), 0, 'invalid cbSize fails');
    assert.strictEqual(wat.get_esp(), STACK + 8, 'failure pops one stdcall argument');
  }
  assert.strictEqual(wat.test_guest_common_controls_entry(), 0,
    'ordinary builtin selection has no mapped native COMCTL32 entry');
  // Do not fabricate a native DLL table row: the supported loader deliberately
  // refuses native COMCTL32 mapping. Class behavior is independently covered by
  // test-get-class-info-ex-common-control.js and test-combobox.js.
  for (const flags of [0, 0xff, 0x200, 0x400, 0x404, 0x8000, 0x8404, 0xffff]) {
    assert.strictEqual(call(flags), 1, 'documented builtin class mask succeeds');
    assert.strictEqual(wat.guest_read32(init), 8);
    assert.strictEqual(wat.guest_read32(init + 4) >>> 0, flags,
      'caller-owned flags remain unchanged');
    assert.strictEqual(wat.get_eip() >>> 0, ENTRY_SENTINEL,
      'builtin initialization never redirects into native PE code');
    assert.strictEqual(wat.get_esp(), STACK + 8, 'success pops one stdcall argument');
    assert.strictEqual(wat.get_handler_set_eip(), 0);
    assert.strictEqual(wat.get_steps(), 17);
  }
  for (const flags of [0x10000, 0x80000000, 0xffffffff]) {
    assert.strictEqual(call(flags), 0, 'unknown ICC flags fail');
    assert.strictEqual(wat.get_esp(), STACK + 8);
    assert.strictEqual(wat.get_eip() >>> 0, ENTRY_SENTINEL);
  }
  console.log('PASS InitCommonControlsEx builtin-only selection, masks, ownership and stdcall ABI');
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
