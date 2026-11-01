#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createHostImports } = require('../lib/host-imports');
const { compileSrcWasm } = require('./compile-src');

const ROOT = path.join(__dirname, '..');
const extraWat = String.raw`
  (func (export "test_dx_ddraw") (param $version i32) (result i32)
    (call $dx_create_com_obj (i32.const 1)
      (if (result i32) (i32.eq (local.get $version) (i32.const 4))
        (then (call $dx_get_ddraw4_vtbl))
        (else (call $dx_get_ddraw7_vtbl)))))
  (func (export "test_dx_create_surface") (param $dd i32) (param $desc i32) (param $out i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDraw_CreateSurface (local.get $dd) (local.get $desc) (local.get $out)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "test_dx_get_desc") (param $surface i32) (param $desc i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDrawSurface_GetSurfaceDesc (local.get $surface) (local.get $desc)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))

  (func (export "test_surface3_create") (result i32)
    (call $dx_create_com_obj (i32.const 2) (global.get $DX_VTBL_DDSURF2)))
  (func (export "test_surface3_query") (param $surface i32) (param $iid i32) (param $out i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDrawSurface_QueryInterface
      (local.get $surface) (local.get $iid) (local.get $out)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_surface3_set_desc") (param $surface i32) (param $desc i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDrawSurface3_SetSurfaceDesc
      (local.get $surface) (local.get $desc) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_surface3_pixels") (param $surface i32) (result i32)
    (i32.load offset=20 (call $dx_from_this (local.get $surface))))
  (func (export "test_surface3_pitch") (param $surface i32) (result i32)
    (i32.load16_u offset=18 (call $dx_from_this (local.get $surface))))
  (func (export "test_surface3_vtbl") (result i32)
    (global.get $DX_VTBL_DDSURF3))
`;

async function main() {
  // Plain append: src fragments are self-balanced, so there is no trailing `)`
  // for the old splice to match — it silently dropped the fragment.
  const wasm = compileSrcWasm((file, source) =>
    file === '13-exports.wat' ? `${source}\n${extraWat}\n` : source);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const imports = createHostImports({ getMemory: () => memory.buffer, renderer: null, resourceJson: {} });
  Object.assign(imports.host, {
    memory,
    create_thread: () => 0,
    exit_thread: () => 0,
    terminate_thread: () => 0,
    create_event: () => 0,
    set_event: () => 0,
    reset_event: () => 0,
    wait_single: () => 0,
    wait_multiple: () => 0,
    com_create_instance: () => 0x80004002,
  });

  const { instance } = await WebAssembly.instantiate(wasm, imports);
  const e = instance.exports;
  const exe = fs.readFileSync(path.join(ROOT, 'test', 'binaries', 'calc.exe'));
  new Uint8Array(memory.buffer).set(exe, e.get_staging());
  assert(e.load_pe(exe.length), 'fixture PE should initialize thunk memory');
  e.init_dx_com_thunks();

  const surface = e.test_surface3_create() >>> 0;
  const iid = e.guest_alloc(16) >>> 0;
  const out = e.guest_alloc(4) >>> 0;
  const desc = e.guest_alloc(108) >>> 0;
  const pixels = e.guest_alloc(64000) >>> 0;
  assert(surface && iid && out && desc && pixels, 'test allocations should succeed');

  e.guest_write32(iid, 0xDA044E00);
  e.guest_write32(iid + 4, 0x11D069B2);
  e.guest_write32(iid + 8, 0xAA00D5A1);
  e.guest_write32(iid + 12, 0xBBDFB800);
  assert.strictEqual(e.test_surface3_query(surface, iid, out) >>> 0, 0);
  const surface3 = e.guest_read32(out) >>> 0;
  assert(surface3, 'Surface3 QueryInterface should publish a wrapper');
  assert.strictEqual(e.guest_read32(surface3) >>> 0, e.test_surface3_vtbl() >>> 0,
    'Surface3 QueryInterface should use the 40-slot Surface3 vtable');
  assert(e.guest_read32((e.test_surface3_vtbl() + 39 * 4) >>> 0) >>> 0,
    'Surface3 vtable slot 39 should contain a callable thunk');

  e.guest_write32(desc, 108);
  e.guest_write32(desc + 4, 0x808); // DDSD_PITCH | DDSD_LPSURFACE
  e.guest_write32(desc + 16, 320);
  e.guest_write32(desc + 36, pixels);
  assert.strictEqual(e.test_surface3_set_desc(surface3, desc) >>> 0, 0);
  assert.strictEqual(e.test_surface3_pitch(surface3) >>> 0, 320);
  const expectedWa = (pixels - (e.get_image_base() >>> 0) + (e.get_guest_base() >>> 0)) >>> 0;
  assert.strictEqual(e.test_surface3_pixels(surface3) >>> 0, expectedWa,
    'SetSurfaceDesc should attach the caller-owned framebuffer');

  const { instance: second } = await WebAssembly.instantiate(wasm, imports);
  const worker = second.exports;
  worker.init_thread(2, e.get_image_base(), e.get_code_start(), e.get_code_end(),
    e.get_thunk_base(), e.get_thunk_end(), e.get_num_thunks(), e.get_rsrc_rva());
  // A DirectDraw4/7 object acquired in one instance must create a Surface4/7
  // in another. Lazy tables used to be absent from the shared registry:
  // CreateSurface succeeded but selected Surface2, rejecting DDSURFACEDESC2.
  for (const version of [4, 7]) {
    const dd = e.test_dx_ddraw(version) >>> 0;
    const desc = e.guest_alloc(124) >>> 0, out = e.guest_alloc(4) >>> 0;
    for (let i = 0; i < 124; i += 4) e.guest_write32(desc + i, 0);
    for (const [offset, value] of [[0, 124], [4, 0x1007], [8, 8], [12, 16],
      [72, 32], [76, 0x40], [84, 16], [88, 0xf800], [92, 0x7e0],
      [96, 0x1f], [104, 0x1800]]) e.guest_write32(desc + offset, value);
    assert.strictEqual(worker.test_dx_create_surface(dd, desc, out) >>> 0, 0,
      `DirectDraw${version} creates a cross-instance surface`);
    const surface = e.guest_read32(out) >>> 0;
    assert(surface, 'CreateSurface publishes an object');
    assert.strictEqual(worker.test_dx_get_desc(surface, desc) >>> 0, 0,
      `DirectDraw${version} surface accepts DDSURFACEDESC2 across instances`);
    assert.strictEqual(e.guest_read32(desc + 8), 8);
    assert.strictEqual(e.guest_read32(desc + 12), 16);
    assert.strictEqual(e.guest_read32(desc + 84), 16);
    e.guest_write32(desc, 108);
    assert.strictEqual(worker.test_dx_get_desc(surface, desc) >>> 0, 0x80070057,
      'new interfaces still reject the old descriptor ABI');
  }

  console.log('PASS  Surface3 pixel memory; cross-instance DirectDraw4/7 surfaces preserve DDSURFACEDESC2');
}

main().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
