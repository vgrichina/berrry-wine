#!/usr/bin/env node
'use strict';

// The display enumeration APIs hand back the largest structs in the emulator:
// DEVMODEA/W (156/220 bytes) and DISPLAY_DEVICEA/W (424/840). Each used to be
// written through one $g2w pointer, so a caller whose buffer crossed a sparse
// guest page boundary got the head of its structure filled in and the tail
// written into unrelated memory -- and DISPLAY_DEVICEW at 840 bytes crosses a
// boundary from a fifth of all possible addresses.
//
// They gather with $guest_span_in and write back now. Each is driven twice
// against identical bytes, once inside one page and once straddling, and the
// two results must agree.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "sp_map") (param i32) (result i32)
    (call $virtual_map_commit (local.get 0) (i32.const 4096)))

  (func (export "test_enumdisplaysettings") (param $sp i32) (param $mode i32)
        (param $devmode i32) (param $wide i32) (result i32)
    (local $saved i32)
    (local.set $saved (i32.load offset=16 (global.get $reg_base)))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (if (local.get $wide)
      (then (call $handle_EnumDisplaySettingsW (i32.const 0) (local.get $mode)
              (local.get $devmode) (i32.const 0) (i32.const 0) (i32.const 0)))
      (else (call $handle_EnumDisplaySettingsA (i32.const 0) (local.get $mode)
              (local.get $devmode) (i32.const 0) (i32.const 0) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_enumdisplaydevices") (param $sp i32) (param $devnum i32)
        (param $dd i32) (param $wide i32) (result i32)
    (local $saved i32)
    (local.set $saved (i32.load offset=16 (global.get $reg_base)))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (if (local.get $wide)
      (then (call $handle_EnumDisplayDevicesW (i32.const 0) (local.get $devnum)
              (local.get $dd) (i32.const 0) (i32.const 0) (i32.const 0)))
      (else (call $handle_EnumDisplayDevicesA (i32.const 0) (local.get $devnum)
              (local.get $dd) (i32.const 0) (i32.const 0) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved))
    (i32.load offset=0 (global.get $reg_base)))
`;

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none' });

  const page = 0x30000000, other = 0x28000000;
  // Three pages, so an 840-byte record can straddle with room on both sides.
  for (const ga of [page, other, page + 4096, page + 8192]) {
    assert.strictEqual(e.sp_map(ga) >>> 0, ga);
  }
  assert.notStrictEqual(e.guest_to_wasm(page + 4096), e.guest_to_wasm(page) + 4096,
    'the two pages must be backed non-adjacently for this test to mean anything');

  const sp = ((e.guest_alloc(256) >>> 0) + 128) >>> 0;
  const read = (ga, n) => Array.from({ length: n }, (_, i) => e.guest_read8(ga + i) & 0xff);
  const zero = (ga, n) => { for (let i = 0; i < n; i++) e.guest_write8(ga + i, 0); return ga; };
  const u32 = (ga, off) => (read(ga + off, 4).reduce((a, b, i) => a + (b << (i * 8)), 0)) >>> 0;
  // A buffer of n bytes with its last k bytes on the following page.
  const split = (n, k) => page + 4096 - (n - k);

  const cursor0 = e.guest_span_cursor_bytes() >>> 0;
  const overflow0 = e.guest_span_overflow_count() >>> 0;

  // --- EnumDisplaySettings, ENUM_CURRENT_SETTINGS --------------------------
  for (const [wide, SIZE, sizeOff, fields] of [
    [0, 156, 36, { bpp: 104, w: 108, h: 112, freq: 120 }],
    [1, 220, 68, { bpp: 168, w: 172, h: 176, freq: 184 }],
  ]) {
    const name = wide ? 'EnumDisplaySettingsW' : 'EnumDisplaySettingsA';
    const prime = ga => { zero(ga, SIZE); e.guest_write8(ga + sizeOff, SIZE & 0xff);
      e.guest_write8(ga + sizeOff + 1, SIZE >> 8); return ga; };
    const ask = ga => {
      const ret = e.test_enumdisplaysettings(sp, -1, prime(ga), wide) | 0;
      return [ret, ...Object.values(fields).map(off => u32(ga, off))];
    };
    const want = ask(e.guest_alloc(SIZE) >>> 0);
    assert.strictEqual(want[0], 1, `${name} reported the current mode`);
    assert.ok(want[2] > 0 && want[3] > 0, `${name} returned a real resolution`);
    for (const k of [4, 40, 108, SIZE - 8]) {
      assert.deepStrictEqual(ask(split(SIZE, k)), want,
        `${name} with ${k} bytes on the far page: wrong DEVMODE`);
    }
  }

  // --- EnumDisplayDevices, the adapter and its monitor ----------------------
  for (const [wide, SIZE, flagsOff] of [[0, 0x1a8, 164], [1, 0x348, 324]]) {
    const name = wide ? 'EnumDisplayDevicesW' : 'EnumDisplayDevicesA';
    const prime = ga => { zero(ga, SIZE); e.guest_write8(ga, SIZE & 0xff);
      e.guest_write8(ga + 1, (SIZE >> 8) & 0xff); return ga; };
    const ask = ga => {
      const ret = e.test_enumdisplaydevices(sp, 0, prime(ga), wide) | 0;
      return [ret, ...read(ga, SIZE)];
    };
    const want = ask(e.guest_alloc(SIZE) >>> 0);
    assert.strictEqual(want[0], 1, `${name} described the adapter`);
    assert.ok(want.slice(1 + flagsOff, 1 + flagsOff + 4).some(v => v !== 0),
      `${name} set StateFlags`);
    // Every split that puts part of the record on the next page, including one
    // that cuts the name, one the string and one the flags word.
    for (const k of [4, 64, SIZE - flagsOff, SIZE - 8]) {
      assert.deepStrictEqual(ask(split(SIZE, k)), want,
        `${name} with ${k} bytes on the far page: wrong DISPLAY_DEVICE`);
    }
  }

  assert.strictEqual(e.guest_span_cursor_bytes() >>> 0, cursor0,
    'the gather arena was not given back');
  assert.strictEqual(e.guest_span_overflow_count() >>> 0, overflow0,
    'a span did not fit the gather arena');

  console.log('PASS  EnumDisplaySettings/EnumDisplayDevices fill a struct split across sparse pages');
})().catch(err => { console.error('FAIL ', err && err.stack || err); process.exit(1); });
