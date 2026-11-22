#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');

// Microsoft US layout aVkToWch2 gives identical unshifted/Shift characters
// and attribute 0 (no CAPLOK) for these four keys:
// https://github.com/microsoft/Windows-driver-samples/blob/main/input/layout/kbdus/kbdus.c
// Keyboard-state bit meanings and the return/output contract:
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-toasciiex
// Literal expectations are independent of the implementation under test.
const operators = [[0x6A, '*'], [0x6B, '+'], [0x6D, '-'], [0x6F, '/']];
const extraWat = String.raw`
  (func (export "keypad_toascii")
    (param $vk i32) (param $keys i32) (param $word i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_ToAscii (local.get $vk) (i32.const 0)
      (local.get $keys) (local.get $word) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "keypad_toasciiex")
    (param $vk i32) (param $keys i32) (param $word i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_ToAsciiEx (local.get $vk) (i32.const 0)
      (local.get $keys) (local.get $word) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "keypad_stack") (result i32)
    (i32.load offset=16 (global.get $reg_base)))
`;

(async () => {
  const h = await bootRenderHarness({ extraWat, fonts: 'none' });
  const e = h.exports;
  const state = e.guest_alloc(256) >>> 0;
  const output = e.guest_alloc(8) >>> 0;
  const address = p => (p - (e.get_image_base() >>> 0) + (e.get_guest_base() >>> 0)) >>> 0;
  const bytes = new Uint8Array(h.memory.buffer);
  const words = new DataView(h.memory.buffer);
  const failures = [];
  let cases = 0;
  for (const [api, pop] of [['keypad_toascii', 24], ['keypad_toasciiex', 28]]) {
    for (const [vk, literal] of operators) {
      for (const shift of [0, 1, 0x80, 0x81]) {
        for (const caps of [0, 1, 0x80, 0x81]) {
          bytes.fill(0, address(state), address(state) + 256);
          bytes[address(state) + 0x10] = shift;
          bytes[address(state) + 0x14] = caps;
          const before = bytes.slice(address(state), address(state) + 256);
          bytes.fill(0xA5, address(output), address(output) + 8);
          const returned = e[api](vk, state, output + 2);
          const actual = words.getUint16(address(output) + 2, true);
          const label = {api, vk, shift, caps, literal, returned, actual};
          if (returned !== 1 || actual !== literal.charCodeAt(0)) failures.push(label);
          assert.equal(e.keypad_stack(), 0x00300000 + pop, JSON.stringify(label));
          assert.deepEqual(bytes.slice(address(state), address(state) + 256), before, 'keyboard state preserved');
          assert.deepEqual(Array.from(bytes.slice(address(output), address(output) + 2)), [0xA5, 0xA5]);
          assert.deepEqual(Array.from(bytes.slice(address(output) + 4, address(output) + 8)), [0xA5, 0xA5, 0xA5, 0xA5]);
          cases++;
        }
      }
    }
  }
  console.log(JSON.stringify({cases, failures}));
  assert.equal(failures.length, 0, 'US keypad operator literal translations');
  console.log(`PASS ${cases} ToAscii/ToAsciiEx keypad operator Shift/Caps cases`);
})().catch(e => { console.error(e.stack || e); process.exitCode = 1; });
