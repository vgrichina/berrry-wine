#!/usr/bin/env node
'use strict';

// Direct3D 3 and 7 expose the same GetTextureStageState contract.  The API
// table keeps both public identities and vtable slots, but dispatches them to
// one state-reading implementation so revisions cannot drift.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');
const apiTable = require('../src/api_table.json');

const extraWat = String.raw`
  (func (export "d3dim_tss_create_device") (result i32)
    (local $obj i32) (local $entry i32) (local $state i32)
    (local.set $obj
      (call $dx_create_com_obj (i32.const 20) (i32.const 0x53000000)))
    (if (i32.eqz (local.get $obj)) (then (return (i32.const 0))))
    (local.set $entry (call $dx_from_this (local.get $obj)))
    (local.set $state (call $heap_alloc (i32.const 4096)))
    (call $d3ddev_init_state (local.get $state))
    (i32.store offset=16 (local.get $entry) (local.get $state))
    (local.get $obj))

  (func (export "d3dim_tss_seed")
      (param $device i32) (param $stage i32) (param $type i32) (param $value i32)
    (call $d3dim_set_tss
      (local.get $device) (local.get $stage) (local.get $type) (local.get $value)))

  (func (export "d3dim_tss_get")
      (param $api i32) (param $device i32) (param $stage i32)
      (param $type i32) (param $out i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $dispatch_api_table
      (local.get $api) (local.get $device) (local.get $stage)
      (local.get $type) (local.get $out) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "d3dim_tss_set")
      (param $api i32) (param $device i32) (param $stage i32)
      (param $type i32) (param $value i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $dispatch_api_table
      (local.get $api) (local.get $device) (local.get $stage)
      (local.get $type) (local.get $value) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "d3dim_validate")
      (param $api i32) (param $device i32) (param $passes i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $dispatch_api_table
      (local.get $api) (local.get $device) (local.get $passes)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  ;; Real format metadata, shared native combiner, and GPU descriptor path.
  (func (export "legacy_texture") (param $device i32) (param $fmt i32)
    (local $obj i32) (local $entry i32)
    (local.set $obj (call $dx_create_com_obj (i32.const 2) (i32.const 0x52000000)))
    (local.set $entry (call $dx_from_this (local.get $obj)))
    (i32.store offset=12 (local.get $entry) (i32.const 0x00010001))
    (i32.store offset=16 (local.get $entry) (i32.const 0x00040020))
    (i32.store offset=20 (local.get $entry) (call $g2w (call $heap_alloc (i32.const 4))))
    (call $dx_surf_fmt_set (local.get $entry) (local.get $fmt))
    (call $d3dim_set_texture (local.get $device) (i32.const 0) (local.get $obj)))
  (func (export "legacy_rs") (param $device i32) (param $mode i32)
    (call $d3dim_set_render_state (local.get $device) (i32.const 21) (local.get $mode)))
  (func (export "legacy_effective") (param $device i32) (param $type i32) (result i32)
    (call $d3dim_tss_load (call $d3ddev_state (local.get $device)) (i32.const 0) (local.get $type)))
  (func (export "d3dim_tss_esp") (result i32) (i32.load offset=16 (global.get $reg_base)))
`;

(async () => {
  const d3 = apiTable.find(entry =>
    entry.name === 'IDirect3DDevice3_GetTextureStageState');
  const d7 = apiTable.find(entry =>
    entry.name === 'IDirect3DDevice7_GetTextureStageState');
  const d3set = apiTable.find(entry =>
    entry.name === 'IDirect3DDevice3_SetTextureStageState');
  const d7set = apiTable.find(entry =>
    entry.name === 'IDirect3DDevice7_SetTextureStageState');
  const d3validate = apiTable.find(entry =>
    entry.name === 'IDirect3DDevice3_ValidateDevice');
  const d7validate = apiTable.find(entry =>
    entry.name === 'IDirect3DDevice7_ValidateDevice');
  assert(d3 && d7 && d3set && d7set && d3validate && d7validate,
    'all six public Direct3D API identities remain registered');
  assert.strictEqual(d3.id, 1185, 'Device3 API id remains stable');
  assert.strictEqual(d7.id, 1381, 'Device7 API id remains stable');
  assert.strictEqual(d3set.id, 1186, 'Device3 setter API id remains stable');
  assert.strictEqual(d7set.id, 1382, 'Device7 setter API id remains stable');
  assert.strictEqual(d3validate.id, 1187, 'Device3 ValidateDevice id remains stable');
  assert.strictEqual(d7validate.id, 1383, 'Device7 ValidateDevice id remains stable');
  assert.strictEqual(d3.nargs, 5);
  assert.strictEqual(d7.nargs, 5);
  assert.strictEqual(d3set.nargs, 5);
  assert.strictEqual(d7set.nargs, 5);
  assert.strictEqual(d3validate.nargs, 5);
  assert.strictEqual(d7validate.nargs, 5);
  assert.strictEqual(d7.handler, 'IDirect3DDevice3_GetTextureStageState',
    'Device7 metadata aliases the canonical Device3 handler');
  assert.strictEqual(d7set.handler, 'IDirect3DDevice3_SetTextureStageState',
    'Device7 setter metadata aliases the canonical Device3 handler');
  assert.strictEqual(d7validate.handler, 'IDirect3DDevice3_ValidateDevice',
    'Device7 validation metadata aliases the canonical Device3 handler');

  const root = path.join(__dirname, '..');
  const dispatch = fs.readFileSync(
    path.join(root, 'src/09b2-dispatch-table.generated.wat'), 'utf8');
  assert.match(dispatch,
    /;; 1381: IDirect3DDevice7_GetTextureStageState[\s\S]*?call \$handle_IDirect3DDevice3_GetTextureStageState/,
    'generated dispatch routes Device7 through the canonical handler');
  assert.match(dispatch,
    /;; 1382: IDirect3DDevice7_SetTextureStageState[\s\S]*?call \$handle_IDirect3DDevice3_SetTextureStageState/,
    'generated dispatch routes the Device7 setter through the canonical handler');
  assert.match(dispatch,
    /;; 1383: IDirect3DDevice7_ValidateDevice[\s\S]*?call \$handle_IDirect3DDevice3_ValidateDevice/,
    'generated dispatch routes Device7 validation through the canonical handler');
  const device7Source = fs.readFileSync(
    path.join(root, 'src/09aa-handlers-d3dim.wat'), 'utf8');
  assert(!device7Source.includes('(func $handle_IDirect3DDevice7_GetTextureStageState'),
    'the duplicate Device7 wrapper is absent');
  assert(!device7Source.includes('(func $handle_IDirect3DDevice7_SetTextureStageState'),
    'the duplicate Device7 setter wrapper is absent');
  assert(!device7Source.includes('(func $handle_IDirect3DDevice7_ValidateDevice'),
    'the duplicate Device7 validation wrapper is absent');

  const { exports: wat, memory } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const device = wat.d3dim_tss_create_device() >>> 0;
  assert(device, 'created a state-backed legacy Direct3D device');
  const out = 0x00310000;
  wat.d3dim_tss_seed(device, 7, 11, 0x11223344);

  for (const api of [d3, d7]) {
    wat.guest_write32(out, 0xdeadbeef);
    assert.strictEqual(wat.d3dim_tss_get(api.id, device, 7, 11, out) >>> 0, 0,
      `${api.name} returns D3D_OK`);
    assert.strictEqual(wat.guest_read32(out) >>> 0, 0x11223344,
      `${api.name} reads the same retained texture-stage state`);
    assert.strictEqual(wat.d3dim_tss_esp() >>> 0, 0x00300014,
      `${api.name} preserves the five-word stdcall cleanup`);
  }

  for (const [index, api] of [d3set, d7set].entries()) {
    const value = 0x55667700 + index;
    assert.strictEqual(wat.d3dim_tss_set(api.id, device, 7, 11, value) >>> 0, 0,
      `${api.name} returns D3D_OK`);
    assert.strictEqual(wat.d3dim_tss_esp() >>> 0, 0x00300014,
      `${api.name} preserves the five-word stdcall cleanup`);
    wat.guest_write32(out, 0xdeadbeef);
    assert.strictEqual(wat.d3dim_tss_get(d3.id, device, 7, 11, out) >>> 0, 0);
    assert.strictEqual(wat.guest_read32(out) >>> 0, value,
      `${api.name} updates the same retained texture-stage state`);
  }

  for (const api of [d3validate, d7validate]) {
    wat.guest_write32(out, 0xdeadbeef);
    assert.strictEqual(wat.d3dim_validate(api.id, device, out) >>> 0, 0,
      `${api.name} returns D3D_OK`);
    assert.strictEqual(wat.guest_read32(out) >>> 0, 1,
      `${api.name} reports one rendering pass`);
    assert.strictEqual(wat.d3dim_tss_esp() >>> 0, 0x0030000c,
      `${api.name} preserves the three-word stdcall cleanup`);
  }

  // Reject the observed Darkstone failure: RGB565 was decoded to RGBA255,
  // hiding geometry despite the original vertices carrying diffuse alpha64.
  wat.d3dim_tss_seed(device, 0, 4, 2);
  wat.legacy_rs(device, 2); // D3DTBLEND_MODULATE
  for (const fmt of [1, 2, 6]) { // RGB565, RGB555, XRGB8888
    wat.legacy_texture(device, fmt);
    assert.strictEqual(wat.legacy_effective(device, 4), 3, 'no-alpha format selects diffuse alpha');
    const descriptor = wat.d3dim_gpu_describe(device);
    assert(descriptor, 'owning GPU descriptor available');
    assert.strictEqual(new DataView(memory.buffer).getUint32(descriptor + 92, true), 3,
      'GPU descriptor carries the same effective diffuse alpha selection');
  }
  for (const fmt of [3, 4, 5, 7]) { // alpha-bearing formats retain texture alpha
    wat.legacy_texture(device, fmt);
    assert.strictEqual(wat.legacy_effective(device, 4), 2);
  }
  wat.legacy_rs(device, 4); // D3DTBLEND_MODULATEALPHA
  assert.strictEqual(wat.legacy_effective(device, 4), 4);
  for (const api of [d3, d7]) {
    wat.d3dim_tss_get(api.id, device, 0, 4, out);
    assert.strictEqual(wat.guest_read32(out), 2, 'legacy lowering preserves raw public TSS query');
  }
  wat.d3dim_tss_seed(device, 1, 4, 2);
  wat.d3dim_tss_seed(device, 0, 12, 1);
  assert.strictEqual(wat.legacy_effective(device, 4), 4, 'other stage/filter does not cancel legacy mode');
  wat.d3dim_tss_set(d7set.id, device, 0, 4, 2);
  assert.strictEqual(wat.legacy_effective(device, 4), 2, 'explicit stage-zero combiner overrides legacy mode');
  wat.legacy_texture(device, 1);
  wat.legacy_rs(device, 2);
  assert.strictEqual(wat.legacy_effective(device, 4), 3, 'later legacy setter reactivates lowering');

  console.log('PASS  Direct3D 3/7 state access and validation share canonical handlers');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
