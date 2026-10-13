#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

// Independently transcribed native SHLWAPI control-flow classification, not
// filesystem legality. Win98 DLL #486 at 70bf16c2, #485 at 70bdde1d.
// Native A truncates to BYTE; W truncates to WORD; neither calls a codepage API.
const exceptions = new Map([
  [32, 1], [34, 0], [42, 4], [44, 1], [47, 8], [58, 8],
  [59, 1], [60, 0], [62, 0], [63, 4], [92, 8], [124, 0],
]);
function expected(ch) { return ch < 32 ? 0 : (exceptions.get(ch) ?? 3); }

(async () => {
  const { exports: e } = await bootRenderHarness({ fonts: 'none', extraWat:
    ['A', 'W'].map(suffix => `
      (func (export "path_char_${suffix}") (param $ch i32) (result i32)
        (global.set $esp (i32.const 0x074ff000))
        (call $handle_PathGetCharType${suffix} (local.get $ch)
          (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
        (global.get $eax))`).join('\n') });
  for (let ch = 0; ch <= 65535; ch++) {
    assert.strictEqual(e.path_char_W(ch), expected(ch), `W ${ch}`);
    assert.strictEqual(e.get_esp() >>> 0, 0x074ff008);
    assert.strictEqual(e.path_char_A(ch), expected(ch & 255), `A ${ch}`);
    assert.strictEqual(e.get_esp() >>> 0, 0x074ff008);
  }
  for (const ch of [-1, -2147483648, 0x12340050, 0x12340100]) {
    assert.strictEqual(e.path_char_W(ch), expected(ch & 65535));
    assert.strictEqual(e.path_char_A(ch), expected(ch & 255));
  }
  // The character that stopped B&W's profile-name encoding loop.
  assert.strictEqual(e.path_char_W(0x50), 3);
  console.log('PASS PathGetCharType A/W: exhaustive WORD domain, truncation, stdcall and profile P');
})().catch(error => { console.error(error); process.exitCode = 1; });
