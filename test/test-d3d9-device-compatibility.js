#!/usr/bin/env node
'use strict';

// Black & White 2 Demo (BW2Demo.exe, SHA-256
// 65130510233cfc9e53758bab8480a3cfeeb6b1043de9774ab6e066191b2bb433)
// makes these twelve compatibility calls in its authentic startup trace:
// CheckDeviceType tests adapter formats X8R8G8B8, R5G6B5 and X1R5G5B5
// against an A8R8G8B8 target in both fullscreen and windowed mode; then
// CheckDepthStencilMatch tests each same adapter/target tuple with D24S8 in
// both contexts. The renderer stores only 32-bit color surfaces, so it must
// reject the two 16-bit fullscreen conversions while retaining their useful
// windowed conversions and all supported depth matches.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const { Bridge } = require('../lib/d3d9-host');

const D3D_OK = 0;
const D3DERR_NOTAVAILABLE = 0x8876086a;
const D3DERR_INVALIDCALL = 0x8876086c;
const STACK = 0x074ff000;

(async () => {
  let rgb565=false;
  const { exports: e } = await bootRenderHarness({ fonts: 'none',
    extraHostOverrides:{gpu_gl_call:(op,p,a)=>op===0x30017&&a===23&&rgb565?1:0},extraWat: `
    (func (export "multisample565") (param $kind i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const ${STACK}))
      (call $gs32 (i32.const ${STACK+24}) (local.get $kind))
      (call $gs32 (i32.const ${STACK+28}) (local.get $out))
      (call $handle_IDirect3D9_CheckDeviceMultiSampleType (i32.const 0) (i32.const 0) (i32.const 1)
        (i32.const 23) (i32.const 1) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "format565") (param $usage i32) (param $kind i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const ${STACK}))
      (call $gs32 (i32.const ${STACK+24}) (local.get $kind))
      (call $gs32 (i32.const ${STACK+28}) (i32.const 23))
      (call $handle_IDirect3D9_CheckDeviceFormat (i32.const 0) (i32.const 0) (i32.const 1)
        (i32.const 22) (local.get $usage) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "convert565") (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const ${STACK}))
      (call $handle_IDirect3D9_CheckDeviceFormatConversion (i32.const 0) (i32.const 0) (i32.const 1)
        (i32.const 23) (i32.const 22) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "new_device") (result i32)
      (local $device i32)
      (local.set $device (call $dx_create_com_obj (i32.const 20) (global.get $DX_VTBL_D3DDEV9)))
      (store.field DxObject misc1 (call $dx_from_this (local.get $device)) (call $d3d9_program_alloc))
      (local.get $device))
    (func (export "check_type") (param $adapter i32) (param $type i32)
      (param $adapter_format i32) (param $target_format i32) (param $windowed i32)
      (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const ${STACK}))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)) (i32.const 0x11223344))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (local.get $windowed))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (i32.const 0x55667788))
      (call $handle_IDirect3D9_CheckDeviceType (i32.const 0)
        (local.get $adapter) (local.get $type) (local.get $adapter_format)
        (local.get $target_format) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "check_depth") (param $adapter i32) (param $type i32)
      (param $adapter_format i32) (param $target_format i32) (param $depth_format i32)
      (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const ${STACK}))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 20)) (i32.const 0x11223344))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (local.get $depth_format))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (i32.const 0x55667788))
      (call $handle_IDirect3D9_CheckDepthStencilMatch (i32.const 0)
        (local.get $adapter) (local.get $type) (local.get $adapter_format)
        (local.get $target_format) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "create_target") (param $device i32) (param $format i32)
      (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const ${STACK}))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (i32.const 0))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (i32.const 0))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)) (local.get $out))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)) (i32.const 0))
      (call $handle_IDirect3DDevice9_CreateRenderTarget (local.get $device)
        (i32.const 8) (i32.const 8) (local.get $format) (i32.const 0) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "create_depth") (param $device i32) (param $format i32)
      (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const ${STACK}))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (i32.const 0))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (i32.const 0))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)) (local.get $out))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)) (i32.const 0))
      (call $handle_IDirect3DDevice9_CreateDepthStencilSurface (local.get $device)
        (i32.const 8) (i32.const 8) (local.get $format) (i32.const 0) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
  ` });
  e.init_dx_com_thunks();
  for(const [backend,enabled,expected]of [['software',true,1],['software',false,0],['webgl',true,0]]){
    const b=new Bridge({backend,enableProgrammable:enabled,getExports:()=>e});
    assert.strictEqual(b.call(0x30017,0,23),expected,'real bridge gates565 by executor');
    await b.close();
  }
  const missing=new Bridge({backend:'software',enableProgrammable:true,getExports:()=>({...e,d3d_software_bind_color_format:undefined})});
  assert.strictEqual(missing.call(0x30017,0,23),0,'missing native export withholds565');await missing.close();

  const checkAbi = label => {
    assert.strictEqual(e.get_esp() >>> 0, STACK + 28, `${label} pops exactly six arguments`);
    assert.strictEqual(e.guest_read32(STACK + 20) >>> 0, 0x11223344, `${label} preserves the preceding slot`);
    assert.strictEqual(e.guest_read32(STACK + 28) >>> 0, 0x55667788, `${label} preserves the following slot`);
  };
  const checkType = (adapter, type, adapterFormat, targetFormat, windowed) => {
    const result = e.check_type(adapter, type, adapterFormat, targetFormat, windowed) >>> 0;
    checkAbi('CheckDeviceType');
    return result;
  };
  const checkDepth = (adapter, type, adapterFormat, targetFormat, depthFormat) => {
    const result = e.check_depth(adapter, type, adapterFormat, targetFormat, depthFormat) >>> 0;
    checkAbi('CheckDepthStencilMatch');
    return result;
  };

  // Exact CheckDeviceType tuples at calls 684871, 684942, 685011, 685080,
  // 685149 and 685218. Only X8R8G8B8 can be our fullscreen display mode.
  const bwTypeTuples = [
    [22, 21, 0, D3D_OK], [22, 21, 1, D3D_OK],
    [24, 21, 0, D3DERR_NOTAVAILABLE], [24, 21, 1, D3D_OK],
    [23, 21, 0, D3DERR_NOTAVAILABLE], [23, 21, 1, D3D_OK],
  ];
  for (const [adapterFormat, targetFormat, windowed, expected] of bwTypeTuples)
    assert.strictEqual(checkType(0, 1, adapterFormat, targetFormat, windowed), expected);

  // Exact CheckDepthStencilMatch tuples at calls 684887, 684958, 685027,
  // 685096, 685165 and 685234. The two contexts repeat each format tuple.
  for (const adapterFormat of [22, 24, 23]) {
    assert.strictEqual(checkDepth(0, 1, adapterFormat, 21, 75), D3D_OK);
    assert.strictEqual(checkDepth(0, 1, adapterFormat, 21, 75), D3D_OK);
  }

  // Windowed UNKNOWN selects the current display format; fullscreen UNKNOWN
  // is forbidden. Both alpha variants use the backend's real 32-bit storage.
  assert.strictEqual(checkType(0, 1, 22, 0, 1), D3D_OK);
  assert.strictEqual(checkType(0, 1, 22, 0, 0), D3DERR_NOTAVAILABLE);
  for (const target of [21, 22]) {
    assert.strictEqual(checkType(0, 1, 22, target, 0), D3D_OK);
    assert.strictEqual(checkType(0, 1, 23, target, 1), D3D_OK);
  }

  // Parameter errors are distinct from well-formed unsupported tuples.
  assert.strictEqual(checkType(1, 1, 22, 21, 1), D3DERR_INVALIDCALL);
  assert.strictEqual(checkType(0, 2, 22, 21, 1), D3DERR_INVALIDCALL);
  assert.strictEqual(checkDepth(1, 1, 22, 21, 75), D3DERR_INVALIDCALL);
  assert.strictEqual(checkDepth(0, 3, 22, 21, 75), D3DERR_INVALIDCALL);
  for (const adapterFormat of [0, 20, 21, 28]) {
    assert.strictEqual(checkType(0, 1, adapterFormat, 21, 1), D3DERR_NOTAVAILABLE);
    assert.strictEqual(checkDepth(0, 1, adapterFormat, 21, 75), D3DERR_NOTAVAILABLE);
  }
  for (const target of [20, 23, 28]) {
    assert.strictEqual(checkType(0, 1, 22, target, 1), D3DERR_NOTAVAILABLE);
    assert.strictEqual(checkDepth(0, 1, 22, target, 75), D3DERR_NOTAVAILABLE);
  }
  for (const depth of [75, 77, 80])
    assert.strictEqual(checkDepth(0, 1, 22, 22, depth), D3D_OK);
  for (const depth of [0, 21, 70, 71, 73, 79])
    assert.strictEqual(checkDepth(0, 1, 22, 21, depth), D3DERR_NOTAVAILABLE);

  // The answers agree with the resource paths they guard: only the two color
  // formats and three depth formats advertised above can actually be created.
  const device = e.new_device() >>> 0;
  const out = e.guest_alloc(16) >>> 0;
  assert.ok(device && out);
  for (const format of [21, 22]) {
    e.guest_write32(out, 0);
    assert.strictEqual(e.create_target(device, format, out) >>> 0, D3D_OK);
    assert.ok(e.guest_read32(out) >>> 0);
    assert.strictEqual(e.get_esp() >>> 0, STACK + 40);
  }
  e.guest_write32(out, 0xdeadbeef);
  assert.strictEqual(e.create_target(device, 23, out) >>> 0, D3DERR_INVALIDCALL);
  assert.strictEqual(e.guest_read32(out) >>> 0, 0);
  rgb565=true;
  for(const kind of [1,3,5])assert.strictEqual(e.format565(1,kind)>>>0,D3D_OK);
  assert.strictEqual(e.format565(2,1)>>>0,D3DERR_NOTAVAILABLE,'565 is not a depth format');
  assert.strictEqual(e.format565(0,4)>>>0,D3DERR_NOTAVAILABLE,'volume target unavailable');
  assert.strictEqual(e.convert565()>>>0,D3DERR_NOTAVAILABLE,'565 StretchRect conversion is not advertised');
  assert.strictEqual(e.multisample565(0,out)>>>0,D3D_OK);assert.strictEqual(e.guest_read32(out),1);
  for(const samples of [1,2,4,16])assert.strictEqual(e.multisample565(samples,out)>>>0,D3DERR_NOTAVAILABLE);
  assert.strictEqual(checkType(0,1,23,23,0),D3D_OK,'software fullscreen 565 pair');
  assert.strictEqual(checkType(0,1,22,23,0),D3DERR_NOTAVAILABLE,'fullscreen conversion rejected');
  assert.strictEqual(checkType(0,1,23,22,0),D3DERR_NOTAVAILABLE);
  assert.strictEqual(checkType(0,1,22,23,1),D3D_OK,'software windowed 565');
  assert.strictEqual(checkDepth(0,1,23,23,75),D3D_OK);
  assert.strictEqual(e.create_target(device,23,out)>>>0,D3D_OK,'capability agrees with allocation');
  const surface=e.guest_read32(out)>>>0;
  assert.strictEqual(e.guest_read32(surface+28),23);
  assert.strictEqual(e.guest_read32(surface+48),16);
  assert.strictEqual(e.guest_read32(surface+52),128);
  rgb565=false;
  assert.strictEqual(e.format565(1,3)>>>0,D3DERR_NOTAVAILABLE);
  assert.strictEqual(e.format565(0,3)>>>0,D3D_OK,'ordinary565 textures retain existing support');
  assert.strictEqual(e.multisample565(0,out)>>>0,D3DERR_NOTAVAILABLE);
  assert.strictEqual(checkType(0,1,23,23,0),D3DERR_NOTAVAILABLE,'disabled/WebGL contract rejects 565');
  for (const format of [75, 77, 80]) {
    e.guest_write32(out, 0);
    assert.strictEqual(e.create_depth(device, format, out) >>> 0, D3D_OK);
    assert.ok(e.guest_read32(out) >>> 0);
    assert.strictEqual(e.get_esp() >>> 0, STACK + 40);
  }
  e.guest_write32(out, 0xdeadbeef);
  assert.strictEqual(e.create_depth(device, 79, out) >>> 0, D3DERR_INVALIDCALL);
  assert.strictEqual(e.guest_read32(out) >>> 0, 0);

  console.log('PASS D3D9 device compatibility: B&W2 tuples, HRESULTs, ABI, create agreement');
})().catch(error => { console.error(error); process.exit(1); });
