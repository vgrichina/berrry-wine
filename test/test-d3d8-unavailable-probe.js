#!/usr/bin/env node
'use strict';
const assert = require('assert');
const table = require('../src/api_table.json');
const { interfaces } = require('../tools/d3d8-methods');
const { bootRenderHarness } = require('./render-helper');

(async () => {
  const methods = interfaces[0].methods;
  assert.deepStrictEqual(methods.map(m => m.name), [
    'QueryInterface', 'AddRef', 'Release', 'RegisterSoftwareDevice',
    'GetAdapterCount', 'GetAdapterIdentifier', 'GetAdapterModeCount',
    'EnumAdapterModes', 'GetAdapterDisplayMode', 'CheckDeviceType',
    'CheckDeviceFormat', 'CheckDeviceMultiSampleType', 'CheckDepthStencilMatch',
    'GetDeviceCaps', 'GetAdapterMonitor', 'CreateDevice',
  ], 'the spec preserves the 16-slot IDirect3D8 ABI');
  const rows = methods.map(m => table.find(a => a.name === `IDirect3D8_${m.name}`));
  assert(rows.every(Boolean));
  assert(rows.every((row, i) => row.id === rows[0].id + i),
    'IDirect3D8 API IDs are contiguous in vtable order');
  assert.deepStrictEqual(rows.map(r => r.nargs), methods.map(m => m.nargs));
  const deviceMethods = interfaces[1].methods;
  assert.strictEqual(deviceMethods.length, 97, 'IDirect3DDevice8 has its exact 97-slot ABI');
  assert.strictEqual(deviceMethods[71].name, 'DrawIndexedPrimitive');
  assert.strictEqual(deviceMethods[71].handler, undefined,
    'D3D8 DrawIndexedPrimitive uses its base-vertex-aware adapter');
  assert.strictEqual(deviceMethods[76].name, 'SetVertexShader');
  assert.strictEqual(deviceMethods[76].handler, undefined,
    'D3D8 SetVertexShader uses its ABI-aware FVF wrapper');
  assert.strictEqual(deviceMethods[62].handler, undefined,
    'D3D8 GetTextureStageState maps its embedded sampler-state namespace');
  assert.strictEqual(deviceMethods[63].handler, undefined,
    'D3D8 SetTextureStageState maps its embedded sampler-state namespace');
  assert.strictEqual(deviceMethods[16].handler, undefined,
    'D3D8 GetBackBuffer inserts the implicit D3D9 swap-chain index');
  const deviceRows = deviceMethods.map(m => table.find(a => a.name === `IDirect3DDevice8_${m.name}`));
  assert(deviceRows.every(Boolean));
  assert(deviceRows.every((row, i) => row.id === deviceRows[0].id + i),
    'IDirect3DDevice8 API IDs are contiguous in vtable order');
  const textureMethods = interfaces[2].methods;
  assert.strictEqual(textureMethods.length, 19, 'IDirect3DTexture8 has its exact 19-slot ABI');
  assert.strictEqual(textureMethods[14].name, 'GetLevelDesc');
  assert.strictEqual(textureMethods[16].name, 'LockRect');
  const textureRows = textureMethods.map(m => table.find(a => a.name === `IDirect3DTexture8_${m.name}`));
  assert(textureRows.every(Boolean));
  assert(textureRows.every((row, i) => row.id === textureRows[0].id + i),
    'IDirect3DTexture8 API IDs are contiguous in vtable order');

  const { exports: e } = await bootRenderHarness({ fonts: 'none', extraWat: `
    (func (export "d3d8_create") (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $handle_Direct3DCreate8 (i32.const 220) (i32.const 0) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "d3d8_caps") (param $p i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $handle_IDirect3D8_GetDeviceCaps (i32.const 0) (i32.const 0)
        (i32.const 1) (local.get $p) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "d3d8_identifier") (param $p i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $handle_IDirect3D8_GetAdapterIdentifier (i32.const 0) (i32.const 0)
        (i32.const 2) (local.get $p) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "d3d8_qi") (param $this i32) (param $iid i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $handle_IDirect3D8_QueryInterface (local.get $this) (local.get $iid)
        (local.get $out) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "d3d8_check_type") (param $adapter i32) (param $type i32)
      (param $display i32) (param $backbuffer i32) (param $windowed i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $gs32 (i32.const 0x074ff018) (local.get $windowed))
      (call $handle_IDirect3D8_CheckDeviceType (i32.const 0) (local.get $adapter)
        (local.get $type) (local.get $display) (local.get $backbuffer) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "d3d8_check_format") (param $adapter i32) (param $type i32)
      (param $adapter_format i32) (param $usage i32) (param $rtype i32)
      (param $check_format i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $gs32 (i32.const 0x074ff018) (local.get $rtype))
      (call $gs32 (i32.const 0x074ff01c) (local.get $check_format))
      (call $handle_IDirect3D8_CheckDeviceFormat (i32.const 0) (local.get $adapter)
        (local.get $type) (local.get $adapter_format) (local.get $usage) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "d3d8_check_multisample") (param $adapter i32) (param $type i32)
      (param $format i32) (param $windowed i32) (param $multisample i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $gs32 (i32.const 0x074ff018) (local.get $multisample))
      (call $handle_IDirect3D8_CheckDeviceMultiSampleType (i32.const 0)
        (local.get $adapter) (local.get $type) (local.get $format)
        (local.get $windowed) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "d3d8_create_device") (param $pp i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $gs32 (i32.const 0x074ff018) (local.get $pp))
      (call $gs32 (i32.const 0x074ff01c) (local.get $out))
      (call $handle_IDirect3D8_CreateDevice (i32.const 0) (i32.const 0)
        (i32.const 1) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "d3d8_set_vertex_shader") (param $dev i32) (param $fvf i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $handle_IDirect3DDevice8_SetVertexShader (local.get $dev) (local.get $fvf)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "d3d8_clear_stream") (param $dev i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $handle_IDirect3DDevice8_SetStreamSource (local.get $dev) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "d3d8_set_indices") (param $dev i32) (param $buffer i32) (param $base i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $handle_IDirect3DDevice8_SetIndices (local.get $dev) (local.get $buffer)
        (local.get $base) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "d3d8_set_tss") (param $dev i32) (param $stage i32)
      (param $type i32) (param $value i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $handle_IDirect3DDevice8_SetTextureStageState (local.get $dev) (local.get $stage)
        (local.get $type) (local.get $value) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "d3d8_get_tss") (param $dev i32) (param $stage i32)
      (param $type i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $handle_IDirect3DDevice8_GetTextureStageState (local.get $dev) (local.get $stage)
        (local.get $type) (local.get $out) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "d3d8_index_base") (param $dev i32) (result i32)
      (local $state i32)
      (local.set $state (call $d3d9_program_state (local.get $dev)))
      (if (result i32) (local.get $state)
        (then (call $gl32 (i32.add (local.get $state) (i32.const 1692))))
        (else (i32.const 0))))
    (func (export "d3d8_get_render_target") (param $dev i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $handle_IDirect3DDevice8_GetRenderTarget (local.get $dev) (local.get $out)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "d3d8_get_back_buffer") (param $dev i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $handle_IDirect3DDevice8_GetBackBuffer (local.get $dev) (i32.const 0)
        (i32.const 0) (local.get $out) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "d3d8_create_texture") (param $dev i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $gs32 (i32.const 0x074ff018) (i32.const 21))
      (call $gs32 (i32.const 0x074ff01c) (i32.const 1))
      (call $gs32 (i32.const 0x074ff020) (local.get $out))
      (call $handle_IDirect3DDevice8_CreateTexture (local.get $dev) (i32.const 8)
        (i32.const 8) (i32.const 1) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "d3d8_create_vertex_buffer") (param $dev i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $gs32 (i32.const 0x074ff018) (local.get $out))
      (call $handle_IDirect3DDevice8_CreateVertexBuffer (local.get $dev) (i32.const 240)
        (i32.const 0x18) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "d3d8_create_index_buffer") (param $dev i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $gs32 (i32.const 0x074ff018) (local.get $out))
      (call $handle_IDirect3DDevice8_CreateIndexBuffer (local.get $dev) (i32.const 48)
        (i32.const 0x08) (i32.const 101) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "d3d8_set_rs") (param $dev i32) (param $rs i32) (param $v i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $handle_IDirect3DDevice9_SetRenderState (local.get $dev) (local.get $rs)
        (local.get $v) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "d3d8_get_rs") (param $dev i32) (param $rs i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $handle_IDirect3DDevice9_GetRenderState (local.get $dev) (local.get $rs)
        (local.get $out) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "d3d8_sb_begin") (param $dev i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $handle_IDirect3DDevice9_BeginStateBlock (local.get $dev) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "d3d8_sb_end") (param $dev i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $handle_IDirect3DDevice9_EndStateBlock (local.get $dev) (local.get $out)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "d3d8_sb_create") (param $dev i32) (param $type i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $handle_IDirect3DDevice9_CreateStateBlock (local.get $dev) (local.get $type)
        (local.get $out) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "d3d8_sb_apply") (param $dev i32) (param $token i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $handle_d3d8_ApplyStateBlock (local.get $dev) (local.get $token)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "d3d8_sb_capture") (param $dev i32) (param $token i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $handle_d3d8_CaptureStateBlock (local.get $dev) (local.get $token)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "d3d8_sb_delete") (param $dev i32) (param $token i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $handle_d3d8_DeleteStateBlock (local.get $dev) (local.get $token)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "d3d8_set_vs") (param $dev i32) (param $vs i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $handle_IDirect3DDevice8_SetVertexShader (local.get $dev) (local.get $vs)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "d3d8_get_vs") (param $dev i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $handle_IDirect3DDevice8_GetVertexShader (local.get $dev) (local.get $out)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "d3d8_create_vertex_decl") (param $dev i32) (param $tokens i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $handle_IDirect3DDevice8_CreateVertexShader (local.get $dev) (local.get $tokens)
        (i32.const 0) (local.get $out) (i32.const 0x10) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
  ` });

  e.init_dx_com_thunks();
  const factory = e.d3d8_create() >>> 0;
  assert(factory, 'Direct3DCreate8 returns a capability object');
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff008);
  const p = 0x00409000;
  e.guest_write32(p, 0); e.guest_write32(p + 4, 0);
  e.guest_write32(p + 8, 0x000000c0); e.guest_write32(p + 12, 0x46000000);
  e.guest_write32(p + 16, 0xdeadbeef);
  assert.strictEqual(e.d3d8_qi(factory, p, p + 16), 0, 'IUnknown QI succeeds');
  assert.strictEqual(e.guest_read32(p + 16) >>> 0, factory);
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff010);
  for (let i = -4; i <= 0x42c; i += 4) e.guest_write32(p + i, 0xdeadbeef);
  assert.strictEqual(e.d3d8_identifier(p), 0);
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff014);
  assert.strictEqual(e.guest_read32(p - 4) >>> 0, 0xdeadbeef);
  // Driver[512] and Description[512] name the adapter (launchers list the
  // Description in their picker); everything after them stays zero, so no
  // version, PCI id or WHQL level is invented.
  const cstr = (at) => { let s = ''; for (let c; (c = e.guest_read8(at)); at++) s += String.fromCharCode(c); return s; };
  assert.strictEqual(cstr(p), 'wine-assembly');
  assert.strictEqual(cstr(p + 512), 'Wine Assembly D3D8');
  assert.ok(Array.from({ length: 512 - 14 }, (_, i) => e.guest_read8(p + 14 + i)).every(v => v === 0));
  assert.ok(Array.from({ length: 0x42c - 1024 }, (_, i) => e.guest_read8(p + 1024 + i)).every(v => v === 0));
  assert.strictEqual(e.guest_read32(p + 0x42c) >>> 0, 0xdeadbeef);
  e.guest_write32(p - 4, 0xdeadbeef); e.guest_write32(p + 0xd4, 0xdeadbeef);
  assert.strictEqual(e.d3d8_caps(p), 0);
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff014);
  assert.strictEqual(e.guest_read32(p), 1);
  assert.strictEqual(e.guest_read32(p + 0x0c), 0x00080000, 'windowed rendering is advertised');
  assert.strictEqual(e.guest_read32(p + 0x3c), 0x00014c05,
    '2D and cube mipmap texture support is advertised without volume support');
  assert.strictEqual(e.guest_read32(p + 0x40), 0x03030300,
    'point/linear minification, magnification and mip filtering are advertised');
  assert.strictEqual(e.guest_read32(p + 0x44), 0x03030300,
    'cube point/linear filtering matches the implemented cube texture adapter');
  assert.strictEqual(e.guest_read32(p + 0x90), 0x03feffff,
    'caps expose exactly the implemented fixed-function texture operations');
  assert.strictEqual(e.guest_read32(p + 0x94), 8);
  assert.strictEqual(e.guest_read32(p + 0x98), 8);
  assert.ok(e.guest_read32(p + 0x9c) & 0x2,
    'DX7 material-source selection is supported by the fixed-function compiler');
  assert.strictEqual(e.guest_read32(p + 0xa0), 8);
  assert.strictEqual(e.guest_read32(p + 0xb4), 1048575);
  assert.strictEqual(e.guest_read32(p + 0xb8), 1048575);
  assert.strictEqual(e.guest_read32(p + 0xbc), 8, 'MaxStreams satisfies UE2');
  assert.strictEqual(e.guest_read32(p + 0xc8), 96);
  assert.strictEqual(e.guest_read32(p - 4) >>> 0, 0xdeadbeef);
  assert.strictEqual(e.guest_read32(p + 0xd4) >>> 0, 0xdeadbeef);
  const D3D_OK = 0;
  const D3DERR_NOTAVAILABLE = 0x8876086a;
  const D3DERR_INVALIDDEVICE = 0x8876086b;
  const D3DERR_INVALIDCALL = 0x8876086c;
  const checkCapability = (fn, args, expected, esp, label) => {
    assert.strictEqual(fn(...args) >>> 0, expected >>> 0, label);
    assert.strictEqual(e.get_esp() >>> 0, esp, `${label}: exact stdcall cleanup`);
  };
  checkCapability(e.d3d8_check_type, [0, 1, 22, 22, 0], D3D_OK, 0x074ff01c,
    'fullscreen X8R8G8B8 device tuple is available');
  checkCapability(e.d3d8_check_type, [0, 1, 22, 21, 1], D3D_OK, 0x074ff01c,
    'windowed alpha back buffer with identical RGB layout is available');
  checkCapability(e.d3d8_check_type, [1, 1, 22, 22, 1], D3DERR_INVALIDCALL, 0x074ff01c,
    'nonexistent adapter is an invalid call');
  checkCapability(e.d3d8_check_type, [0, 2, 22, 22, 1], D3DERR_INVALIDDEVICE, 0x074ff01c,
    'unexposed device type is an invalid device');
  checkCapability(e.d3d8_check_type, [0, 1, 21, 21, 1], D3DERR_NOTAVAILABLE, 0x074ff01c,
    'alpha display format is not an exposed adapter mode');
  checkCapability(e.d3d8_check_type, [0, 1, 22, 23, 1], D3DERR_NOTAVAILABLE, 0x074ff01c,
    'back buffer with a different RGB layout is unavailable');
  for (const format of [0x31545844, 0x33545844, 0x35545844]) {
    checkCapability(e.d3d8_check_format, [0, 1, 22, 0, 3, format], D3D_OK, 0x074ff020,
      `UT2003 texture format 0x${format.toString(16)} is backed by CreateTexture`);
  }
  // X1R5G5B5/A1R5G5B5 (24/25) are stored and decoded now (LithTech's 16-bit
  // textures); A2B10G10R10 (31) is still not.
  checkCapability(e.d3d8_check_format, [0, 1, 22, 0, 3, 31], D3DERR_NOTAVAILABLE,
    0x074ff020, 'unsupported texture storage format is unavailable');
  checkCapability(e.d3d8_check_format, [0, 1, 22, 1, 3, 22], D3DERR_NOTAVAILABLE,
    0x074ff020, 'unmodeled render-target usage is unavailable');
  checkCapability(e.d3d8_check_format, [0, 1, 22, 0, 1, 22], D3DERR_NOTAVAILABLE,
    0x074ff020, 'unimplemented surface resource path is unavailable');
  checkCapability(e.d3d8_check_format, [1, 1, 22, 0, 3, 22], D3DERR_INVALIDCALL,
    0x074ff020, 'format query rejects nonexistent adapter');
  checkCapability(e.d3d8_check_format, [0, 2, 22, 0, 3, 22], D3DERR_INVALIDCALL,
    0x074ff020, 'format query rejects unsupported device type');
  checkCapability(e.d3d8_check_format, [0, 1, 21, 0, 3, 22], D3DERR_NOTAVAILABLE,
    0x074ff020, 'format query rejects an unexposed adapter format');
  checkCapability(e.d3d8_check_multisample, [0, 1, 22, 0, 0], D3D_OK, 0x074ff01c,
    'fullscreen no-multisample mode is available');
  checkCapability(e.d3d8_check_multisample, [0, 1, 21, 1, 0], D3D_OK, 0x074ff01c,
    'windowed no-multisample mode reads the final stack argument');
  checkCapability(e.d3d8_check_multisample, [0, 1, 22, 0, 1], D3DERR_NOTAVAILABLE,
    0x074ff01c, 'nonmaskable multisampling is unavailable');
  checkCapability(e.d3d8_check_multisample, [0, 1, 22, 1, 2], D3DERR_NOTAVAILABLE,
    0x074ff01c, 'two-sample antialiasing is unavailable');
  checkCapability(e.d3d8_check_multisample, [0, 1, 22, 1, 17], D3DERR_INVALIDCALL,
    0x074ff01c, 'out-of-range multisample type is invalid');
  checkCapability(e.d3d8_check_multisample, [1, 1, 22, 1, 0], D3DERR_INVALIDCALL,
    0x074ff01c, 'multisample query rejects nonexistent adapter');
  checkCapability(e.d3d8_check_multisample, [0, 2, 22, 1, 0], D3DERR_INVALIDDEVICE,
    0x074ff01c, 'multisample query rejects unexposed device type');
  checkCapability(e.d3d8_check_multisample, [0, 1, 23, 1, 0], D3DERR_NOTAVAILABLE,
    0x074ff01c, 'multisample query rejects unsupported target format');
  const pp = p + 0x500;
  const out = pp + 0x80;
  for (let i = 0; i < 13; i++) e.guest_write32(pp + i * 4, 0);
  e.guest_write32(pp, 320);
  e.guest_write32(pp + 4, 240);
  e.guest_write32(pp + 8, 22);
  e.guest_write32(pp + 12, 1);
  e.guest_write32(pp + 20, 1);
  e.guest_write32(pp + 28, 1);
  e.guest_write32(out, 0xdeadbeef);
  assert.strictEqual(e.d3d8_create_device(pp, out) >>> 0, 0);
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff020);
  const device = e.guest_read32(out) >>> 0;
  assert(device, 'CreateDevice returns an IDirect3DDevice8 wrapper');
  const vtbl = e.guest_read32(device) >>> 0;
  const firstThunk = e.guest_read32(vtbl) >>> 0;
  assert.strictEqual(e.guest_read32(firstThunk + 4) >>> 0, deviceRows[0].id,
    'returned wrapper uses the D3D8 device vtable, not D3D9 slot order');
  assert.strictEqual(e.d3d8_set_vertex_shader(device, 2) >>> 0, 0,
    'D3D8 fixed-function SetVertexShader translates to D3D9 SetFVF');
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff00c);
  assert.strictEqual(e.d3d8_clear_stream(device) >>> 0, 0,
    'D3D8 SetStreamSource inserts D3D9 offset zero');
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff014);
  assert.strictEqual(e.d3d8_set_indices(device, 0, 0) >>> 0, 0,
    'D3D8 SetIndices clears the D3D9 index binding at base zero');
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff010);
  for (const [type, value] of [[13, 2], [14, 3], [15, 0xff336699], [16, 2],
    [17, 2], [18, 2], [19, 0x3f000000], [20, 1], [21, 1], [25, 3]]) {
    assert.strictEqual(e.d3d8_set_tss(device, 2, type, value) >>> 0, 0,
      `D3D8 sampler-bearing TSS ${type} is accepted`);
    e.guest_write32(out, 0xdeadbeef);
    assert.strictEqual(e.d3d8_get_tss(device, 2, type, out) >>> 0, 0);
    assert.strictEqual(e.guest_read32(out) >>> 0, value >>> 0,
      `D3D8 sampler-bearing TSS ${type} round-trips through the D3D9 sampler bank`);
    assert.strictEqual(e.get_esp() >>> 0, 0x074ff014);
  }
  assert.notStrictEqual(e.d3d8_set_tss(device, 0, 32, 1) >>> 0, 0,
    'D3D9-only constant texture-stage state remains invalid through D3D8');
  e.guest_write32(out, 0);
  assert.strictEqual(e.d3d8_get_render_target(device, out) >>> 0, 0,
    'D3D8 GetRenderTarget inserts D3D9 render-target index zero');
  assert(e.guest_read32(out), 'D3D8 GetRenderTarget returns the implicit backbuffer');
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff00c);
  e.guest_write32(out, 0);
  assert.strictEqual(e.d3d8_get_back_buffer(device, out) >>> 0, 0,
    'D3D8 GetBackBuffer inserts implicit swap-chain zero');
  assert(e.guest_read32(out), 'D3D8 GetBackBuffer returns the implicit backbuffer');
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff014);
  e.guest_write32(out, 0);
  assert.strictEqual(e.d3d8_create_texture(device, out) >>> 0, 0,
    'D3D8 CreateTexture reuses the D3D9 resource allocator without a shared handle');
  const texture = e.guest_read32(out) >>> 0;
  assert(texture, 'D3D8 CreateTexture returns a texture object');
  const textureVtbl = e.guest_read32(texture) >>> 0;
  const textureFirstThunk = e.guest_read32(textureVtbl) >>> 0;
  assert.strictEqual(e.guest_read32(textureFirstThunk + 4) >>> 0, textureRows[0].id,
    'returned texture uses D3D8 slot order rather than the shifted D3D9 vtable');
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff024);
  e.guest_write32(out, 0);
  assert.strictEqual(e.d3d8_create_vertex_buffer(device, out) >>> 0, 0,
    'D3D8 CreateVertexBuffer reuses the D3D9 buffer allocator without a shared handle');
  assert(e.guest_read32(out), 'D3D8 CreateVertexBuffer returns a buffer object');
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff01c);
  e.guest_write32(out, 0);
  assert.strictEqual(e.d3d8_create_index_buffer(device, out) >>> 0, 0,
    'D3D8 CreateIndexBuffer reuses the D3D9 buffer allocator without a shared handle');
  const indexBuffer = e.guest_read32(out) >>> 0;
  assert(indexBuffer, 'D3D8 CreateIndexBuffer returns a buffer object');
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff01c);
  assert.strictEqual(e.d3d8_set_indices(device, indexBuffer, 0x1e5) >>> 0, 0,
    'D3D8 SetIndices accepts and retains a nonzero BaseVertexIndex');
  assert.strictEqual(e.d3d8_index_base(device) >>> 0, 0x1e5);
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff010);
  const tokens = pp + 0x200;
    [536870912, 0x40020000, 0x40020003, 0x40010007, 0x40010008, 0xffffffff]
    .forEach((token, i) => e.guest_write32(tokens + i * 4, token));
  e.guest_write32(out, 0);
  assert.strictEqual(e.d3d8_create_vertex_decl(device, tokens, out) >>> 0, 0,
    'D3D8 declaration tokens translate to a D3D9 vertex declaration');
  const declaration = e.guest_read32(out) >>> 0;
  assert(declaration, 'D3D8 CreateVertexShader returns an opaque declaration handle');
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff018);
  assert.strictEqual(e.d3d8_set_vertex_shader(device, declaration) >>> 0, 0,
    'D3D8 SetVertexShader binds an opaque translated declaration handle');
    [536870912, 0x40020000, 0x40020003, 536870913, 0x40040006,
    536870914, 0x40040005, 536870915, 0x40010007, 536870916,
    0x40010008, 0xffffffff]
    .forEach((token, i) => e.guest_write32(tokens + i * 4, token));
  e.guest_write32(out, 0);
  assert.strictEqual(e.d3d8_create_vertex_decl(device, tokens, out) >>> 0, 0,
    'D3D8 accepts UT2003 terrain declarations split over streams 0..4');
  assert(e.guest_read32(out), 'multi-stream compatibility declaration returns a handle');
  // State blocks (MilkDrop records its render state in one): a D3D8 token
  // is a DWORD naming the block, and Apply/Capture/Delete take it by value.
  assert.deepStrictEqual(deviceMethods.slice(52, 58).map(m => m.name), [
    'BeginStateBlock', 'EndStateBlock', 'ApplyStateBlock', 'CaptureStateBlock',
    'DeleteStateBlock', 'CreateStateBlock']);
  assert(deviceMethods.slice(52, 58).every(m => m.handler !== 'd3d8_unimplemented'),
    'every D3D8 state-block slot is implemented');
  const CULLMODE = 22, rsOut = pp + 0x300;
  const cull = () => {
    assert.strictEqual(e.d3d8_get_rs(device, CULLMODE, rsOut) >>> 0, 0);
    return e.guest_read32(rsOut) >>> 0;
  };
  assert.strictEqual(e.d3d8_set_rs(device, CULLMODE, 1) >>> 0, 0);
  assert.strictEqual(e.d3d8_sb_begin(device) >>> 0, 0);
  assert.strictEqual(e.d3d8_set_rs(device, CULLMODE, 3) >>> 0, 0);
  e.guest_write32(out, 0);
  assert.strictEqual(e.d3d8_sb_end(device, out) >>> 0, 0, 'EndStateBlock returns a token');
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff00c);
  const recorded = e.guest_read32(out) >>> 0;
  assert(recorded, 'the recorded token is nonzero');
  e.d3d8_set_rs(device, CULLMODE, 1);
  assert.strictEqual(e.d3d8_sb_apply(device, recorded) >>> 0, 0);
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff00c, 'ApplyStateBlock pops (device, token)');
  assert.strictEqual(cull(), 3, 'applying the recorded block restores CULLMODE 3');
  e.d3d8_set_rs(device, CULLMODE, 2);
  assert.strictEqual(e.d3d8_sb_capture(device, recorded) >>> 0, 0);
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff00c, 'CaptureStateBlock pops (device, token)');
  e.d3d8_set_rs(device, CULLMODE, 1);
  e.d3d8_sb_apply(device, recorded);
  assert.strictEqual(cull(), 2, 'Capture refreshes the recorded state from the device');
  assert.strictEqual(e.d3d8_sb_apply(device, 0) >>> 0, 0x8876086c, 'token 0 is D3DERR_INVALIDCALL');
  assert.strictEqual(e.d3d8_sb_delete(device, recorded) >>> 0, 0, 'DeleteStateBlock is D3D_OK');
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff00c, 'DeleteStateBlock pops (device, token)');
  e.d3d8_set_rs(device, CULLMODE, 1);
  e.guest_write32(out, 0);
  assert.strictEqual(e.d3d8_sb_create(device, 1, out) >>> 0, 0, 'CreateStateBlock(D3DSBT_ALL)');
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff010);
  const all = e.guest_read32(out) >>> 0;
  assert(all, 'CreateStateBlock returns a token');
  e.d3d8_set_rs(device, CULLMODE, 3);
  e.d3d8_sb_apply(device, all);
  assert.strictEqual(cull(), 1, 'a D3DSBT_ALL block restores the state at its creation');
  assert.strictEqual(e.d3d8_sb_delete(device, all) >>> 0, 0);

  // SetVertexShader(FVF) inside a block records the FVF (MilkDrop does this).
  const vs = () => { assert.strictEqual(e.d3d8_get_vs(device, rsOut) >>> 0, 0); return e.guest_read32(rsOut) >>> 0; };
  assert.strictEqual(e.d3d8_set_vs(device, 0x102) >>> 0, 0);
  assert.strictEqual(e.d3d8_sb_begin(device) >>> 0, 0);
  assert.strictEqual(e.d3d8_set_vs(device, 0x144) >>> 0, 0, 'SetVertexShader(FVF) records');
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff00c, 'recorded SetVertexShader pops (device, handle)');
  assert.strictEqual(vs(), 0x102, 'recording leaves the live FVF');
  e.guest_write32(out, 0);
  assert.strictEqual(e.d3d8_sb_end(device, out) >>> 0, 0);
  const fvfBlock = e.guest_read32(out) >>> 0;
  e.d3d8_sb_apply(device, fvfBlock);
  assert.strictEqual(vs(), 0x144, 'applying the block restores the recorded FVF');
  assert.strictEqual(e.d3d8_sb_delete(device, fvfBlock) >>> 0, 0);

  console.log('PASS  Direct3D8 factory/device ABI, caps bounds, D3D9-backed device creation and state-block tokens');
})().catch(error => { console.error(error && error.stack || error); process.exit(1); });
