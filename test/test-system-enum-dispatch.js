#!/usr/bin/env node

'use strict';

// The one-string system enumerators borrow CACA0011, whose default frame is
// only one saved return address. Pin the typed SYS1 frame separately: callback
// RET 4 must expose marker/allocation/return in that order, and dispatch must
// free the allocation while restoring the API caller's exact EIP/ESP.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_system_enum_enter") (result i32)
    (global.set $image_base (i32.const 0x00400000))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00500000))
    (global.set $eip (i32.const 0x00409999))
    (global.set $font_enum_ret_thunk (i32.const 0x00402000))
    ;; The source string goes in $TEST_SCRATCH, the region declared for exactly
    ;; this. 0x2DA used to be spelled here, which was an interior address of
    ;; $STRING_CONSTANTS — a live region — so the test both wrote over real
    ;; string data and held a copy of a map the allocator re-places.
    (i32.store (region.addr $TEST_SCRATCH 0) (i32.const 0x32353132))
    (i32.store8 offset=4 (region.addr $TEST_SCRATCH 0) (i32.const 0))
    (call $system_string_enum_a
      (i32.const 0x00401000) (region.addr $TEST_SCRATCH 0) (i32.const 0x00401234))
    (i32.load offset=16 (global.get $reg_base)))
  (func (export "test_system_enum_return") (result i32)
    ;; Model the callback's stdcall RET 4: return address plus LPSTR argument.
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 8)))
    (i32.store (global.get $THUNK_BASE) (i32.const 0xCACA0011))
    (i32.store offset=4 (global.get $THUNK_BASE) (i32.const 0))
    (call $win32_dispatch (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  ;; EnumSystemLocalesW(cb, LCID_INSTALLED) called from 0x00401234 with the
  ;; API frame [ret, cb, flags] below ESP 0x00500000.
  (func (export "test_locales_w_enter") (param $cb i32) (result i32)
    (global.set $image_base (i32.const 0x00400000))
    (global.set $font_enum_ret_thunk (i32.const 0x00402000))
    (global.set $last_error (i32.const 0))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0xDEAD))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x004FFFF4))
    (call $gs32 (i32.const 0x004FFFF4) (i32.const 0x00401234))
    (call $gs32 (i32.const 0x004FFFF8) (local.get $cb))
    (call $gs32 (i32.const 0x004FFFFC) (i32.const 1))
    (call $handle_EnumSystemLocalesW (local.get $cb) (i32.const 1)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=16 (global.get $reg_base)))
  (func (export "test_locales_w_result") (result i32)
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_locales_w_last_error") (result i32)
    (global.get $last_error))
`;

(async () => {
  const { exports: wat } = await bootRenderHarness({ extraWat });
  const esp = wat.test_system_enum_enter() >>> 0;
  assert.strictEqual(esp, 0x004fffec);
  assert.strictEqual(wat.get_eip() >>> 0, 0x00401000,
    'enumerator enters the guest callback');
  assert.strictEqual(wat.guest_read32(esp) >>> 0, 0x00402000,
    'callback returns through CACA0011');
  const text = wat.guest_read32(esp + 4) >>> 0;
  assert(text, 'callback receives an allocated guest string');
  assert.strictEqual(wat.guest_read32(esp + 8) >>> 0, 0x31535953,
    'RET 4 exposes the SYS1 typed marker');
  assert.strictEqual(wat.guest_read32(esp + 12) >>> 0, text,
    'typed frame retains the allocation to release');
  assert.strictEqual(wat.guest_read32(esp + 16) >>> 0, 0x00401234,
    'typed frame retains the API return address');

  assert.strictEqual(wat.test_system_enum_return(), 1);
  assert.strictEqual(wat.get_eip() >>> 0, 0x00401234,
    'dispatch resumes the API caller');
  assert.strictEqual(wat.get_esp() >>> 0, 0x00500000,
    'dispatch consumes the whole typed frame');

  // EnumSystemLocalesW: one UTF-16 locale string through the same SYS1 frame.
  const espW = wat.test_locales_w_enter(0x00401000) >>> 0;
  assert.strictEqual(espW, 0x004fffec, 'W: API args popped, then the 5-dword callback frame');
  assert.strictEqual(wat.get_eip() >>> 0, 0x00401000, 'W: enters the guest callback');
  assert.strictEqual(wat.guest_read32(espW) >>> 0, 0x00402000, 'W: callback returns through CACA0011');
  const wtext = wat.guest_read32(espW + 4) >>> 0;
  let s = '';
  for (let i = 0; i < 9; i++) {
    const unit = (wat.guest_read32(wtext + i * 2) >>> 0) & 0xFFFF;
    if (!unit) break;
    s += String.fromCharCode(unit);
  }
  assert.strictEqual(s, '00000409', 'W: callback receives L"00000409"');
  assert.strictEqual((wat.guest_read32(wtext + 16) >>> 0) & 0xFFFF, 0, 'W: string is NUL-terminated');
  assert.strictEqual(wat.guest_read32(espW + 8) >>> 0, 0x31535953, 'W: SYS1 typed marker');
  assert.strictEqual(wat.guest_read32(espW + 12) >>> 0, wtext, 'W: frame retains the allocation');
  assert.strictEqual(wat.guest_read32(espW + 16) >>> 0, 0x00401234, 'W: frame retains the API return');
  assert.strictEqual(wat.test_system_enum_return(), 1, 'W: returns TRUE after the callback');
  assert.strictEqual(wat.get_eip() >>> 0, 0x00401234, 'W: resumes the API caller');
  assert.strictEqual(wat.get_esp() >>> 0, 0x00500000, 'W: stdcall 2-arg frame fully consumed');

  // NULL callback: FALSE + ERROR_INVALID_PARAMETER, straight back to the caller.
  assert.strictEqual(wat.test_locales_w_enter(0) >>> 0, 0x00500000);
  assert.strictEqual(wat.test_locales_w_result(), 0, 'W: NULL callback returns FALSE');
  assert.strictEqual(wat.test_locales_w_last_error(), 87, 'W: ERROR_INVALID_PARAMETER');
  assert.strictEqual(wat.get_eip() >>> 0, 0x00401234, 'W: NULL callback returns to the caller');

  console.log('PASS system enumeration callback continuation restores EIP/ESP (A and EnumSystemLocalesW)');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
