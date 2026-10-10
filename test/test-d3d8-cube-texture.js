#!/usr/bin/env node
'use strict';
const assert = require('node:assert');
const {bootRenderHarness} = require('./render-helper');
const apis = require('../src/api_table.json');

(async () => {
  const {exports: e} = await bootRenderHarness({fonts: 'none', extraWat: `
    (func (export "cube_device") (param $out i32) (result i32)
      (local $device i32)
      (call $d3dim_create_device (i32.const 0) (i32.const 0) (local.get $out) (global.get $DX_VTBL_D3DDEV8))
      (local.set $device (call $gl32 (local.get $out)))
      (store.field DxObject misc1 (call $dx_from_this (local.get $device)) (call $d3d9_program_alloc))
      (local.get $device))
    (func (export "cube_call") (param $id i32) (param $a i32) (param $b i32) (param $c i32)
      (param $d i32) (param $f i32) (param $g i32) (param $h i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
      (call $gs32 (i32.const 0x074ff018) (local.get $g))
      (call $gs32 (i32.const 0x074ff01c) (local.get $h))
      (call $dispatch_api_table (local.get $id) (local.get $a) (local.get $b) (local.get $c)
        (local.get $d) (local.get $f) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
  `});
  e.init_dx_com_thunks();
  const out = 0x00409000, iid = out + 64, device = e.cube_device(out);
  const read = p => e.guest_read32(p) >>> 0, write = (p, v) => e.guest_write32(p, v);
  const call = (name, ...args) => {
    const api = apis.find(a => a.name === name);
    assert(api, name);
    const result = e.cube_call(api.id, ...args) >>> 0;
    assert.equal(e.get_esp() >>> 0, 0x074ff000 + 4 * (api.nargs + 1), name + ' stdcall cleanup');
    return result;
  };
  const slot = (object, index, ...args) => {
    const thunk = read(read(object) + index * 4);
    assert.equal(read(thunk), 0xcaca0010, 'COM thunk');
    return call(apis[read(thunk + 4)].name, object, ...args);
  };
  const invalid = 0x8876086c, unavailable = 0x8876086a;
  for (const format of [21, 22, 0x31545844, 0x35545844])
    assert.equal(call('IDirect3D8_CheckDeviceFormat', 0, 0, 1, 22, 0, 5, format), 0, 'cube format');
  assert.equal(call('IDirect3D8_CheckDeviceFormat', 0, 0, 1, 22, 0, 5, 0xdead), unavailable);
  assert.equal(call('IDirect3DDevice8_GetDeviceCaps', device, out), 0);
  assert.equal(read(out + 0x3c) & 0x10800, 0x10800, 'cube and mip cube caps');
  const create = (size, levels, format = 21) => call('IDirect3DDevice8_CreateCubeTexture', device, size, levels, 0, format, 1, out);
  for (const [size, levels] of [[0, 1], [2049, 1], [4, 4]]) {
    assert.equal(create(size, levels), invalid); assert.equal(read(out), 0);
  }
  for (const format of [21, 22, 0x31545844, 0x35545844]) {
    assert.equal(create(4, 0, format), 0);
    const texture = read(out), surfaces = [], addresses = new Set();
    assert.equal(slot(texture, 10), 5, 'GetType');
    assert.equal(slot(texture, 13), 3, 'GetLevelCount');
    for (let face = 0; face < 6; face++) for (let level = 0; level < 3; level++) {
      const size = 4 >> level, bytes = format === 0x31545844 ? 8 : format === 0x35545844 ? 16 : size * size * 4;
      assert.equal(slot(texture, 14, level, out), 0, 'GetLevelDesc at D3D8 slot14');
      assert.equal(read(out + 16), bytes, 'D3D8 Size field');
      assert.equal(read(out + 20), 0, 'MultiSampleType');
      assert.equal(read(out + 24), size); assert.equal(read(out + 28), size);
      assert.equal(slot(texture, 15, face, level, out), 0);
      const surface = read(out); surfaces.push(surface);
      [0xb96eebca, 0x4ea5b326, 0xf52f2f88, 0xdd21e0ba].forEach((v, i) => write(iid + i * 4, v));
      assert.equal(slot(surface, 0, iid, out), 0, 'Surface8 QI');
      assert.equal(read(out), surface); slot(surface, 2);
      [0x3ee5b968, 0x4c342aca, 0x0c7eb58b, 0x50b7193d].forEach((v, i) => write(iid + i * 4, v));
      assert.equal(slot(surface, 7, iid, out), 0, 'Surface8 GetContainer Cube8');
      assert.equal(read(out), texture); slot(texture, 2);
      assert.equal(slot(surface, 8, out), 0, 'Surface8 GetDesc');
      assert.equal(read(out + 16), bytes);
      assert.equal(slot(texture, 16, face, level, out, 0, 0), 0, 'LockRect');
      const bits = read(out + 4); assert(!addresses.has(bits)); addresses.add(bits);
      write(bits, 0xff000000 + face * 16 + level);
      assert.equal(slot(texture, 16, face, level, out, 0, 0), invalid, 'double lock');
      assert.equal(slot(surface, 10), 0, 'Surface8 UnlockRect shares lock');
      assert.equal(slot(texture, 17, face, level), invalid, 'double unlock');
      assert.equal(slot(texture, 16, face, level, out, 0, 16), 0);
      assert.equal(read(read(out + 4)), 0xff000000 + face * 16 + level, 'face/mip bytes preserved');
      assert.equal(slot(texture, 17, face, level), 0);
    }
    for (const [face, level] of [[6, 0], [-1, 0], [0, 3]]) {
      assert.equal(slot(texture, 16, face, level, out, 0, 0), invalid);
      assert.equal(slot(texture, 15, face, level, out), invalid); assert.equal(read(out), 0);
    }
    for (const words of [
      [0, 0, 0xc0, 0x46000000],
      [0x1b36bb7b, 0x410a09b7, 0x147d45b4, 0x3fb3d730],
      [0xb4211cfa, 0x4a9f51b9, 0x99db78ab, 0x8e67bbb2],
      [0x3ee5b968, 0x4c342aca, 0x0c7eb58b, 0x50b7193d],
    ]) {
      words.forEach((v, i) => write(iid + i * 4, v));
      assert.equal(slot(texture, 0, iid, out), 0); assert.equal(read(out), texture); slot(texture, 2);
    }
    [0xfff32f81, 0x473ad953, 0xd6932392, 0x3fa9ab52].forEach((v, i) => write(iid + i * 4, v));
    assert.equal(slot(texture, 0, iid, out), 0x80004002, 'Cube9 ABI not returned for Cube8');
    assert.equal(read(out), 0);
    assert.equal(slot(texture, 2), surfaces.length, 'surface references retain texture');
    for (const surface of surfaces) assert.equal(slot(surface, 2), 0);
  }
  console.log('PASS D3D8 cube negotiation, real vtable slots, descriptors, face/mip locks, QI and lifetime');
})().catch(error => {console.error(error); process.exitCode = 1;});
