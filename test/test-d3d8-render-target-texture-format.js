#!/usr/bin/env node
'use strict';
// D3D8 CheckDeviceFormat(usage=RENDERTARGET, rtype=TEXTURE) must say yes for
// exactly the formats CreateTexture(usage=RENDERTARGET) creates. Spelunky
// Classic's GM8 runner walks this through D3DX; every format used to come back
// D3DERR_NOTAVAILABLE and the game ended itself after its first frame.
const assert = require('node:assert');
const {bootRenderHarness} = require('./render-helper');
const apis = require('../src/api_table.json');

(async () => {
  const {exports: e} = await bootRenderHarness({fonts: 'none', extraWat: `
    (func (export "rt_device") (param $out i32) (result i32)
      (local $device i32)
      (call $d3dim_create_device (i32.const 0) (i32.const 0) (local.get $out) (global.get $DX_VTBL_D3DDEV8))
      (local.set $device (call $gl32 (local.get $out)))
      (store.field DxObject misc1 (call $dx_from_this (local.get $device)) (call $d3d9_program_alloc))
      (local.get $device))
    (func (export "rt_call") (param $id i32) (param $a i32) (param $b i32) (param $c i32)
      (param $d i32) (param $f i32) (param $g i32) (param $h i32) (param $i i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $gs32 (i32.const 0x074ff018) (local.get $g))
      (call $gs32 (i32.const 0x074ff01c) (local.get $h))
      (call $gs32 (i32.const 0x074ff020) (local.get $i))
      (call $dispatch_api_table (local.get $id) (local.get $a) (local.get $b) (local.get $c)
        (local.get $d) (local.get $f) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
  `});
  e.init_dx_com_thunks();
  const out = 0x00409000, device = e.rt_device(out);
  const read = p => e.guest_read32(p) >>> 0;
  const call = (name, ...args) => {
    const api = apis.find(a => a.name === name);
    assert(api, name);
    while (args.length < 8) args.push(0);
    const result = e.rt_call(api.id, ...args) >>> 0;
    assert.equal(e.get_esp() >>> 0, 0x074ff000 + 4 * (api.nargs + 1), name + ' stdcall cleanup');
    return result;
  };
  const unavailable = 0x8876086a;
  // The formats the GM8 runner's D3DX walk asked for, in its order.
  const walk = [0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x28, 0x29, 0x32, 0x33, 0x34,
    0x31545844, 0x35545844];
  const yes = [];
  for (const format of walk) {
    const check = call('IDirect3D8_CheckDeviceFormat', 0, 0, 1, 22, 1, 3, format);
    assert(check === 0 || check === unavailable, 'check result ' + format.toString(16));
    // CreateTexture(this, W, H, Levels, Usage, Format, Pool, pp)
    const create = call('IDirect3DDevice8_CreateTexture', device, 64, 64, 1, 1, format, 0, out);
    const texture = create === 0 ? read(out) : 0;
    assert.equal(check === 0, create === 0 && texture !== 0,
      `format 0x${format.toString(16)}: check ${check.toString(16)} vs create ${create.toString(16)}`);
    if (check === 0) yes.push(format);
  }
  for (const format of [0x15, 0x16]) assert(yes.includes(format), 'A8R8G8B8/X8R8G8B8 render-target textures');
  for (const format of [0x14, 0x1c, 0x32, 0x31545844]) assert(!yes.includes(format), 'non-target format refused');
  // Plain textures and render-target surfaces keep their answers.
  assert.equal(call('IDirect3D8_CheckDeviceFormat', 0, 0, 1, 22, 0, 3, 0x14), 0, 'plain R8G8B8 texture');
  assert.equal(call('IDirect3D8_CheckDeviceFormat', 0, 0, 1, 22, 1, 1, 0x15), 0, 'A8R8G8B8 surface target');
  assert.equal(call('IDirect3D8_CheckDeviceFormat', 0, 0, 1, 22, 1, 3, 0xdead), unavailable);
  console.log('PASS D3D8 render-target texture formats agree with CreateTexture:', yes.map(f => '0x' + f.toString(16)).join(' '));
})().catch(error => {console.error(error); process.exitCode = 1;});
