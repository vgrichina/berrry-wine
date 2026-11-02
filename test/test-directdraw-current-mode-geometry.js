#!/usr/bin/env node
'use strict';
const assert = require('assert/strict');
const { bootRenderHarness } = require('./render-helper');

// Exercise the actual DirectDraw handlers, with two runtime instances sharing
// one process. Host geometry is deliberately different from every selected mode.
const extraWat = String.raw`
(global $geometry_ddraw (mut i32) (i32.const 0))
(func (export "geometry_init")
 (global.set $DX_VTBL_DDRAW (i32.const 0x51000000))
 (global.set $geometry_ddraw (call $dx_create_com_obj (i32.const 1) (global.get $DX_VTBL_DDRAW))))
(func (export "geometry_query") (param $out i32) (result i32)
 (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
 (call $handle_IDirectDraw_GetDisplayMode (global.get $geometry_ddraw) (local.get $out) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
 (i32.load (global.get $reg_base)))
(func (export "geometry_select") (param $depth i32) (result i32)
 (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
 (call $handle_IDirectDraw_SetDisplayMode (global.get $geometry_ddraw) (i32.const 800) (i32.const 600) (local.get $depth) (i32.const 0) (i32.const 0))
 (i32.load (global.get $reg_base)))
(func (export "geometry_restore")
 (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
 (call $handle_IDirectDraw_RestoreDisplayMode (global.get $geometry_ddraw) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
(func (export "geometry_metrics") (param $index i32) (result i32)
 (call $system_metric (local.get $index)))
`;
(async () => {
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  let desktop = [1024, 768], screenQueries = 0;
  const options = { memory, fonts: 'none', extraWat, extraHostOverrides: {
    get_screen_size: () => { screenQueries++; return desktop[0] | desktop[1] << 16; },
    move_window: () => {},
  } };
  const a = (await bootRenderHarness(options)).exports;
  const b = (await bootRenderHarness(options)).exports;
  a.geometry_init(); b.geometry_init();
  const ptr = 0x410000, failures = [], cases = [];
  const masks = depth => depth === 16 ? [0xf800, 0x7e0, 0x1f] : depth === 32 ? [0xff0000, 0xff00, 0xff] : [0, 0, 0];
  function query(ex, label, dimensions, depth) {
    ex.guest_write32(ptr, 108);
    ex.guest_write32(ptr + 108, 0x19e5cafe);
    assert.equal(ex.geometry_query(ptr), 0, label + ' HRESULT');
    assert.equal(ex.guest_read32(ptr + 108), 0x19e5cafe, label + ' descriptor bounds');
    const actual = { width: ex.guest_read32(ptr + 12), height: ex.guest_read32(ptr + 8),
      pitch: ex.guest_read32(ptr + 16), depth: ex.guest_read32(ptr + 84),
      masks: [88, 92, 96].map(n => ex.guest_read32(ptr + n)) };
    const expected = { width: dimensions[0], height: dimensions[1],
      pitch: (dimensions[0] * depth / 8 + 3) & ~3, depth, masks: masks(depth) };
    cases.push({ label, actual, expected });
    if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push(label);
    assert.equal(ex.geometry_metrics(0), dimensions[0], label + ' screen metric width control');
    assert.equal(ex.geometry_metrics(1), dimensions[1], label + ' screen metric height control');
  }
  a.set_desktop_color_depth(32);
  query(b, 'initial desktop', desktop, 32);
  for (const depth of [8, 16, 32]) {
    assert.equal(a.geometry_select(depth), 0);
    desktop = [641, 477]; // host resize must not replace an active display mode
    const beforeQueries = screenQueries;
    query(b, 'active ' + depth, [800, 600], depth);
    assert.equal(screenQueries, beforeQueries, 'active mode does not query host desktop');
    for (const restoredDepth of [8, 32]) {
      a.set_desktop_color_depth(restoredDepth);
      a.geometry_restore();
      query(b, `restored ${depth} to ${restoredDepth}`, desktop, restoredDepth);
      assert.deepEqual([0, 1, 2].map(i => b.test_dx_get_process_state(i)), [800, 600, depth],
        'query preserves remembered request for repeated mode suppression');
      assert.equal(b.test_dx_get_process_state(3), 0);
      assert.equal(a.geometry_select(depth), 0);
    }
    a.geometry_restore();
    desktop = [1283, 719];
    query(a, 'resized restored desktop ' + depth, desktop, 32);
  }
  b.guest_write32(ptr, 4);
  const beforeInvalid = screenQueries;
  assert.equal(b.geometry_query(ptr) >>> 0, 0x80070057, 'invalid descriptor rejected');
  assert.equal(screenQueries, beforeInvalid, 'invalid query does not consult host');
  console.log(JSON.stringify({ cases, failures }, null, 2));
  assert.deepEqual(failures, [], 'GetDisplayMode must describe the current display, with its actual row pitch');
  console.log('PASS current display geometry: initial/active/restored/resized, 8/16/32-bit, odd-width DWORD rows, two shared instances, bounds and invalid input');
})().catch(e => { console.error(e); process.exitCode = 1; });
