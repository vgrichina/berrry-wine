#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');

// Bit 24 distinguishes navigation-cluster arrows from their numpad scan twins:
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getkeynametexta
// English arrow names match Microsoft's US layout aKeyNamesExt table:
// https://github.com/microsoft/Windows-driver-samples/blob/main/input/layout/kbdus/kbdus.c
// Unrelated fixtures preserve this runtime's existing English naming choices.
const arrows = [
  [0x01480000, 'Up'], [0x014B0000, 'Left'],
  [0x014D0000, 'Right'], [0x01500000, 'Down'],
];
const unchanged = [
  [0x00480000, 'Num 8'], [0x004B0000, 'Num 4'],
  [0x004D0000, 'Num 6'], [0x00500000, 'Num 2'],
  [0x00370000, 'Num *'], [0x00470000, 'Num 7'],
  [0x00490000, 'Num 9'], [0x004A0000, 'Num -'],
  [0x004C0000, 'Num 5'], [0x004E0000, 'Num +'],
  [0x004F0000, 'Num 1'], [0x00510000, 'Num 3'],
  [0x00520000, 'Num 0'], [0x00530000, 'Num .'],
  [0x00010000, 'Esc'], [0x000E0000, 'Backspace'],
  [0x000F0000, 'Tab'], [0x001C0000, 'Enter'],
  [0x001D0000, 'Ctrl'], [0x002A0000, 'Shift'],
  [0x00360000, 'Shift'], [0x00380000, 'Alt'],
  [0x00390000, 'Space'], [0x003A0000, 'Caps Lock'],
  [0x00450000, 'Num Lock'], [0x00460000, 'Scroll Lock'],
  [0x003B0000, 'F1'], [0x00440000, 'F10'],
  [0x00570000, 'F11'], [0x00580000, 'F12'],
  [0x001E0000, 'A'], [0x00300000, 'B'],
  [0x00020000, '1'], [0x000B0000, '0'],
  [0x00350000, '/'], [0x00000000, '?'],
];
const extraWat = String.raw`
  (func (export "test_keyname_extended")
    (param $lp i32) (param $out i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_GetKeyNameTextA (local.get $lp) (local.get $out)
      (i32.const 64) (i32.const 0) (i32.const 0) (i32.const 0))
    (i64.or (i64.extend_i32_u (i32.load (global.get $reg_base)))
      (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))
`;
(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const buffer = e.guest_alloc(80) >>> 0;
  const base = (buffer - (e.get_image_base() >>> 0) + (e.get_guest_base() >>> 0)) >>> 0;
  const bytes = new Uint8Array(memory.buffer), failures = [];
  let cases = 0;
  function check(lp, expected) {
    bytes.fill(0xA5, base, base + 80);
    const result = e.test_keyname_extended(lp, buffer + 8);
    const length = Number(result & 0xffffffffn);
    const output = bytes.subarray(base + 8, base + 72);
    const end = output.indexOf(0);
    const actual = Buffer.from(output.subarray(0, end < 0 ? output.length : end)).toString('ascii');
    if (length !== expected.length || actual !== expected || bytes[base + 8 + expected.length] !== 0)
      failures.push({ lParam: (lp >>> 0).toString(16), expected, actual, length });
    assert.equal(Number(result >> 32n), 0x00300010, 'stdcall ESP');
    assert.ok(bytes.subarray(base, base + 8).every(x => x === 0xA5), 'prefix');
    assert.ok(bytes.subarray(base + 72, base + 80).every(x => x === 0xA5), 'suffix');
    cases++;
  }
  // Literal ordinary arrow pairs, with repeat count, key-up/context bits and
  // the do-not-care flag varied independently of bit 24.
  for (const [lp, name] of [...arrows, ...unchanged])
    for (const flags of [0, 1, 0xE0000001, 0x02000000]) check(lp | flags, name);
  // Microsoft US aKeyNamesExt literals for the six navigation scan twins:
  // https://github.com/microsoft/Windows-driver-samples/blob/main/input/layout/kbdus/kbdus.c
  const extendedNavigation = {
    0x00470000: 'Home', 0x00490000: 'Page Up',
    0x004F0000: 'End', 0x00510000: 'Page Down',
    0x00520000: 'Insert', 0x00530000: 'Delete',
  };
  // Preserve every other unrelated extended-label fixture.
  for (const [lp, name] of unchanged)
    if (![0x00480000, 0x004B0000, 0x004D0000, 0x00500000].includes(lp))
      check(lp | 0x01000000, extendedNavigation[lp] || name);
  console.log(JSON.stringify({ cases, failed: failures.length, failures }));
  assert.equal(failures.length, 0, 'extended arrow labels and existing ordinary names');
  console.log(`PASS ${cases} literal GetKeyNameTextA cases`);
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
