#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');

// Public Win32 contracts and US ANSI key names:
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-toasciiex
// https://learn.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes
// Expected characters are literal fixtures, independent of the translator.
const keys = [
  ...Array.from('abcdefghijklmnopqrstuvwxyz', (lower, i) =>
    [0x41 + i, lower, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i], true]),
  [0x30, '0', ')'], [0x31, '1', '!'], [0x32, '2', '@'],
  [0x33, '3', '#'], [0x34, '4', '$'], [0x35, '5', '%'],
  [0x36, '6', '^'], [0x37, '7', '&'], [0x38, '8', '*'], [0x39, '9', '('],
  [0xBA, ';', ':'], [0xBB, '=', '+'], [0xBC, ',', '<'],
  [0xBD, '-', '_'], [0xBE, '.', '>'], [0xBF, '/', '?'],
  [0xC0, '`', '~'], [0xDB, '[', '{'], [0xDC, '\\', '|'],
  [0xDD, ']', '}'], [0xDE, "'", '"'],
  [0x20, ' ', ' '], [0x0D, '\r', '\r'], [0x1B, '\x1b', '\x1b'],
  [0x09, '\t', '\t'], [0x08, '\b', '\b'],
];
const extraWat = String.raw`
  (func (export "test_us_ascii")
    (param $ex i32) (param $vk i32) (param $state i32) (param $out i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (if (local.get $ex)
      (then (call $handle_ToAsciiEx (local.get $vk) (i32.const 0)
        (local.get $state) (local.get $out) (i32.const 0) (i32.const 0)))
      (else (call $handle_ToAscii (local.get $vk) (i32.const 0)
        (local.get $state) (local.get $out) (i32.const 0) (i32.const 0))))
    (i64.or (i64.extend_i32_u (i32.load (global.get $reg_base)))
      (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))
`;
(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const state = e.guest_alloc(256) >>> 0, buffer = e.guest_alloc(8) >>> 0;
  const toWasm = guest => (guest - (e.get_image_base() >>> 0) + (e.get_guest_base() >>> 0)) >>> 0;
  const bytes = new Uint8Array(memory.buffer), view = new DataView(memory.buffer);
  const failures = [];
  let count = 0;
  function check(ex, vk, shiftByte, capsByte, expected) {
    bytes.fill(0, toWasm(state), toWasm(state) + 256);
    bytes[toWasm(state) + 0x10] = shiftByte;
    bytes[toWasm(state) + 0x14] = capsByte;
    const stateBefore = bytes.slice(toWasm(state), toWasm(state) + 256);
    bytes.fill(0xA5, toWasm(buffer), toWasm(buffer) + 8);
    const result = e.test_us_ascii(ex, vk, state, buffer + 2);
    const label = `${ex ? 'ToAsciiEx' : 'ToAscii'} VK=${vk.toString(16)} Shift=${shiftByte} Caps=${capsByte}`;
    const actualCount = Number(result & 0xffffffffn);
    const actualWord = view.getUint16(toWasm(buffer) + 2, true);
    const wantCount = expected === null ? 0 : 1;
    const wantWord = expected === null ? 0xA5A5 : expected.charCodeAt(0);
    if (actualCount !== wantCount || actualWord !== wantWord)
      failures.push({ label, expected, actualCount, actualWord });
    assert.equal(Number(result >> 32n), 0x00300000 + (ex ? 28 : 24), label + ' stack');
    assert.deepEqual(bytes.slice(toWasm(state), toWasm(state) + 256), stateBefore, label + ' key state');
    assert.deepEqual(Array.from(bytes.slice(toWasm(buffer), toWasm(buffer) + 2)), [0xA5, 0xA5], label + ' prefix');
    assert.deepEqual(Array.from(bytes.slice(toWasm(buffer) + 4, toWasm(buffer) + 8)), [0xA5, 0xA5, 0xA5, 0xA5], label + ' suffix');
    count++;
  }
  for (const ex of [0, 1]) {
    for (const [vk, lower, upper, letter] of keys)
      for (const shift of [0, 0x80]) for (const caps of [0, 1])
        check(ex, vk, shift, caps, (Boolean(shift) !== Boolean(letter && caps)) ? upper : lower);
    // Shift's toggle bit and Caps Lock's down bit do not select uppercase.
    check(ex, 0x41, 1, 0x80, 'a');
    check(ex, 0x41, 0x81, 0x81, 'a');
    check(ex, 0x31, 1, 0x81, '1');
    for (const vk of [0x10, 0x14, 0x25, 0x70])
      for (const shift of [0, 0x80]) check(ex, vk, shift, 1, null);
  }
  console.log(JSON.stringify({ cases: count, failed: failures.length, failures }));
  assert.equal(failures.length, 0, 'ordinary US Shift/Caps translation');
  console.log(`PASS ${count} literal US ToAscii/ToAsciiEx cases`);
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
