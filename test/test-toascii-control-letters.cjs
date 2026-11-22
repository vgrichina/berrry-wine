#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');

// Microsoft explicitly maps ASCII values 001..026 to Ctrl+A..Ctrl+Z.
// https://learn.microsoft.com/en-us/cpp/windows/accelerator-editor
// Ctrl+A is separately documented as SOH (0x01). US A-Z are ASCII letters.
// https://learn.microsoft.com/en-us/windows/win32/learnwin32/keyboard-input
// https://learn.microsoft.com/en-us/windows/console/console-virtual-terminal-sequences
// https://github.com/microsoft/Windows-driver-samples/blob/main/input/layout/kbdus/kbdus.c
// Microsoft Terminal's Ctrl-key rule also masks ASCII letters into that range:
// https://github.com/microsoft/terminal/blob/main/src/terminal/adapter/ut_adapter/inputTest.cpp
// State high bits, Caps toggle and the WORD/count output contract:
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-toasciiex
// Expectations are literal; do not derive control bytes from the translator.
const letters = [
  [0x41, 'a', 'A', 0x01], [0x42, 'b', 'B', 0x02],
  [0x43, 'c', 'C', 0x03], [0x44, 'd', 'D', 0x04],
  [0x45, 'e', 'E', 0x05], [0x46, 'f', 'F', 0x06],
  [0x47, 'g', 'G', 0x07], [0x48, 'h', 'H', 0x08],
  [0x49, 'i', 'I', 0x09], [0x4A, 'j', 'J', 0x0A],
  [0x4B, 'k', 'K', 0x0B], [0x4C, 'l', 'L', 0x0C],
  [0x4D, 'm', 'M', 0x0D], [0x4E, 'n', 'N', 0x0E],
  [0x4F, 'o', 'O', 0x0F], [0x50, 'p', 'P', 0x10],
  [0x51, 'q', 'Q', 0x11], [0x52, 'r', 'R', 0x12],
  [0x53, 's', 'S', 0x13], [0x54, 't', 'T', 0x14],
  [0x55, 'u', 'U', 0x15], [0x56, 'v', 'V', 0x16],
  [0x57, 'w', 'W', 0x17], [0x58, 'x', 'X', 0x18],
  [0x59, 'y', 'Y', 0x19], [0x5A, 'z', 'Z', 0x1A],
];
const extraWat = String.raw`
  (func (export "control_letters_call")
    (param $ex i32) (param $vk i32) (param $keys i32) (param $out i32)
    (result i32)
    (if (local.get $ex)
      (then (call $handle_ToAsciiEx (local.get $vk) (i32.const 0)
        (local.get $keys) (local.get $out) (i32.const 0) (i32.const 0)))
      (else (call $handle_ToAscii (local.get $vk) (i32.const 0)
        (local.get $keys) (local.get $out) (i32.const 0) (i32.const 0))))
    (i32.load (global.get $reg_base)))
  (func (export "control_letters_regs") (result i32) (global.get $reg_base))
`;

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const state = e.guest_alloc(256) >>> 0, output = e.guest_alloc(8) >>> 0;
  const address = guest => (guest - (e.get_image_base() >>> 0) + (e.get_guest_base() >>> 0)) >>> 0;
  const bytes = new Uint8Array(memory.buffer), view = new DataView(memory.buffer);
  const regs = e.control_letters_regs() >>> 0;
  const seeds = [0xC0FFEE, 0x11223344, 0x22334455, 0x33445566,
    0x00300000, 0x44556677, 0x55667788, 0x66778899];
  const failures = [];
  let cases = 0, controlCases = 0;
  for (const ex of [0, 1]) {
    for (const [vk, lower, upper, control] of letters) {
      for (const ctrl of [0, 1, 0x7F, 0x80, 0x81]) {
        for (const shift of [0, 1, 0x80, 0x81]) {
          for (const caps of [0, 1, 0x80, 0x81]) {
            bytes.fill(0, address(state), address(state) + 256);
            bytes[address(state) + 0x10] = shift;
            bytes[address(state) + 0x11] = ctrl;
            bytes[address(state) + 0x14] = caps;
            const before = bytes.slice(address(state), address(state) + 256);
            bytes.fill(0xA5, address(output), address(output) + 8);
            seeds.forEach((seed, i) => view.setUint32(regs + i * 4, seed, true));
            const expected = ctrl & 0x80 ? control
              : ((Boolean(shift & 0x80) !== Boolean(caps & 1)) ? upper : lower).charCodeAt(0);
            const returned = e.control_letters_call(ex, vk, state, output + 2);
            const actual = view.getUint16(address(output) + 2, true);
            const label = { api: ex ? 'ToAsciiEx' : 'ToAscii', vk, ctrl, shift, caps, expected, returned, actual };
            if (returned !== 1 || actual !== expected) failures.push(label);
            assert.equal(view.getUint32(regs + 16, true), seeds[4] + (ex ? 28 : 24), 'stdcall ' + JSON.stringify(label));
            for (const i of [1, 2, 3, 5, 6, 7])
              assert.equal(view.getUint32(regs + i * 4, true), seeds[i], 'register ' + i);
            assert.deepEqual(bytes.slice(address(state), address(state) + 256), before, 'key state');
            assert.deepEqual(Array.from(bytes.slice(address(output), address(output) + 2)), [0xA5, 0xA5], 'prefix');
            assert.deepEqual(Array.from(bytes.slice(address(output) + 4, address(output) + 8)), [0xA5, 0xA5, 0xA5, 0xA5], 'suffix');
            cases++;
            if (ctrl & 0x80) controlCases++;
          }
        }
      }
    }
  }
  console.log(JSON.stringify({ cases, controlCases, failed: failures.length, failures }));
  assert.equal(failures.length, 0, 'US literal control-letter translations');
  console.log(`PASS ${cases} ToAscii/ToAsciiEx Ctrl high-bit and Shift/Caps letter cases`);
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
