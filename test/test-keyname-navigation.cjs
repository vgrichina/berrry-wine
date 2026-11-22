#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');

// Literal US aKeyNamesExt entries, independently checked against Microsoft:
// https://github.com/microsoft/Windows-driver-samples/blob/main/input/layout/kbdus/kbdus.c
// GetKeyNameTextA selects the extended key using lParam bit 24:
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getkeynametexta
const navigation = [
  [0x47, 'Home', 'Num 7'], [0x49, 'Page Up', 'Num 9'],
  [0x4F, 'End', 'Num 1'], [0x51, 'Page Down', 'Num 3'],
  [0x52, 'Insert', 'Num 0'], [0x53, 'Delete', 'Num .'],
];
// Preserve published arrows and the runtime's nonextended numpad names.
// In particular, nonextended 0x53 retains this runtime's existing "Num .".
const arrows = [
  [0x48, 'Up', 'Num 8'], [0x4B, 'Left', 'Num 4'],
  [0x4D, 'Right', 'Num 6'], [0x50, 'Down', 'Num 2'],
];
const extraWat = String.raw`
  (func (export "navigation_label") (param $lp i32) (param $out i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x074FF000))
    (call $handle_GetKeyNameTextA (local.get $lp) (local.get $out)
      (i32.const 64) (i32.const 0) (i32.const 0) (i32.const 0))
    (i64.or (i64.extend_i32_u (i32.load (global.get $reg_base)))
      (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))
`;
(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const out = e.guest_alloc(64) >>> 0;
  const failures = [];
  let cases = 0;
  for (const [scan, extendedName, ordinaryName] of [...navigation, ...arrows]) {
    for (const extended of [false, true]) {
      for (const flags of [0, 1, 0xE0000001, 0x02000000]) {
        const lp = ((scan << 16) | (extended ? 0x01000000 : 0) | flags) >>> 0;
        const expected = extended ? extendedName : ordinaryName;
        for (let i = 0; i < 64; i++) e.guest_write8(out + i, 0xA5);
        const result = e.navigation_label(lp, out);
        const length = Number(result & 0xFFFFFFFFn);
        let actual = '', terminated = false;
        for (let i = 0; i < 64; i++) {
          const byte = e.guest_read8(out + i);
          if (!byte) { terminated = true; break; }
          actual += String.fromCharCode(byte);
        }
        if (actual !== expected || length !== expected.length || !terminated)
          failures.push({ lp: lp.toString(16), expected, actual, length, terminated });
        assert.equal(Number(result >> 32n), 0x074FF010, 'stdcall stack cleanup');
        cases++;
      }
    }
  }
  console.log(JSON.stringify({ cases, failures }));
  assert.equal(failures.length, 0, 'US extended navigation labels and preserved numpad/arrow names');
  console.log(`PASS ${cases} GetKeyNameTextA navigation cases`);
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
