#!/usr/bin/env node
'use strict';
// Microsoft public UINT/BOOL contract: zero selects 500 ms, >5000 clamps.
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setdoubleclicktime
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getdoubleclicktime
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const extraWat = String.raw`
  (func (export "dc_lookup") (param $setter i32) (result i32)
    (if (local.get $setter)
      (then (return (call $lookup_api_id "SetDoubleClickTime"))))
    (call $lookup_api_id "GetDoubleClickTime"))
  (func (export "dc_reg") (param $index i32) (result i32)
    (i32.load (i32.add (global.get $reg_base) (i32.mul (local.get $index) (i32.const 4)))))
  (func (export "dc_seed") (param $index i32) (param $value i32)
    (i32.store (i32.add (global.get $reg_base) (i32.mul (local.get $index) (i32.const 4))) (local.get $value)))
  (func (export "dc_call") (param $id i32) (param $value i32)
    (call $dispatch_api_table (local.get $id) (local.get $value)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
`;
(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none', width: 32, height: 32 });
  const getter = e.dc_lookup(0), setter = e.dc_lookup(1);
  assert.notEqual(getter, 0xffff, 'public GetDoubleClickTime resolves');
  const stack = e.guest_alloc(128) + 32;
  let calls = 0;
  function call(id, value, argumentCount) {
    const saved = Array.from({ length: 8 }, (_, i) => 0x13570000 + i);
    saved[4] = stack;
    saved.forEach((value, index) => e.dc_seed(index, value));
    for (let offset = -16; offset <= 32; offset += 4)
      e.guest_write32(stack + offset, 0x24680000 + offset);
    e.guest_write32(stack + 4, value);
    const canaries = Array.from({ length: 13 }, (_, i) => e.guest_read32(stack - 16 + i * 4) >>> 0);
    const eip = e.get_eip();
    e.dc_call(id, value);
    assert.equal(e.dc_reg(4) >>> 0, stack + 4 + argumentCount * 4, 'stdcall return address and arguments');
    for (const index of [1, 2, 3, 5, 6, 7])
      assert.equal(e.dc_reg(index) >>> 0, saved[index], 'preserved register ' + index);
    assert.equal(e.get_eip(), eip, 'dispatch table does not change caller EIP');
    assert.deepEqual(Array.from({ length: 13 }, (_, i) => e.guest_read32(stack - 16 + i * 4) >>> 0), canaries, 'guest stack unchanged');
    ++calls;
    return e.dc_reg(0) >>> 0;
  }
  assert.equal(call(getter, 0, 0), 500, 'fresh process/session default');
  console.log(JSON.stringify({ publicGetter: getter, publicSetter: setter, initialInterval: 500 }));
  // This check is deliberately after compilation and the actual getter call:
  // parent proof is public lookup absence, never a missing-symbol compile error.
  assert.notEqual(setter, 0xffff, 'public SetDoubleClickTime must resolve');
  const original = call(getter, 0, 0);
  try {
    for (const [input, expected] of [
      [1, 1], [250, 250], [250, 250], [750, 750],
      [4999, 4999], [5000, 5000], [5001, 5000],
      [0x7fffffff, 5000], [0x80000000, 5000], [0xffffffff, 5000],
      [0, 500], [500, 500],
    ]) {
      assert.notEqual(call(setter, input, 1), 0, 'successful setter BOOL: ' + input);
      assert.equal(call(getter, 0, 0), expected, 'current interval after UINT ' + input);
      assert.equal(call(getter, 0, 0), expected, 'getter does not consume setting');
    }
  } finally {
    assert.notEqual(call(setter, original, 1), 0, 'restore original interval');
    assert.equal(call(getter, 0, 0), original, 'restored interval');
  }
  console.log('PASS double-click setting: default, repeated setting, restore, UINT boundaries and ABI (' + calls + ' public dispatch calls)');
})().catch(error => { console.error(error); process.exitCode = 1; });
