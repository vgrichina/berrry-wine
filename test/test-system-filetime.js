#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

(async () => {
  let ticks = 0, calls = 0;
  const { exports: e } = await bootRenderHarness({ fonts: 'none',
    extraHostOverrides: { get_ticks: () => { calls++; return ticks; } },
    extraWat: `
      (func (export "system_filetime") (param $out i32)
        (global.set $esp (i32.const 0x074ff000))
        (call $handle_GetSystemTimeAsFileTime (local.get $out)
          (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
    ` });
  const out = e.guest_alloc(16) >>> 0;
  const epoch = 0x01bf53eb256d4000n;
  // Cross the first low-DWORD carry, later carries, and signed i32 ticks.
  const carry = Number((0x100000000n - (epoch & 0xffffffffn) + 9999n) / 10000n);
  let previous;
  for (const value of [0, 1, carry - 1, carry, carry + 1, 429496, 429497,
    900000, 0x7fffffff, 0x80000000, 0xffffffff]) {
    ticks = value; calls = 0;
    e.guest_write32(out, 0x12345678);
    e.guest_write32(out + 12, 0x12345678);
    e.system_filetime(out + 4);
    const actual = BigInt(e.guest_read32(out + 4) >>> 0) |
      BigInt(e.guest_read32(out + 8) >>> 0) << 32n;
    assert.strictEqual(actual, epoch + BigInt(value) * 10000n, `ticks=${value}`);
    if (previous !== undefined) assert(actual > previous, 'no backwards low-DWORD rollover');
    previous = actual;
    assert.strictEqual(calls, 1, 'one clock sample for both halves');
    assert.strictEqual(e.guest_read32(out), 0x12345678);
    assert.strictEqual(e.guest_read32(out + 12), 0x12345678);
    assert.strictEqual(e.get_esp() >>> 0, 0x074ff008);
  }
  console.log('PASS GetSystemTimeAsFileTime: 64-bit carry, unsigned ticks, single sample and stdcall');
})().catch(error => { console.error(error); process.exitCode = 1; });
