#!/usr/bin/env node
'use strict';
const assert = require('node:assert');
const {bootRenderHarness} = require('./render-helper');
const apis = require('../src/api_table.json');
(async () => {
  const {exports: e} = await bootRenderHarness({fonts: 'none', extraWat: `
    (func (export "ps_device") (result i32)
      (local $device i32)
      (local.set $device (call $dx_create_com_obj (i32.const 20) (global.get $DX_VTBL_D3DDEV8)))
      (store.field DxObject misc1 (call $dx_from_this (local.get $device)) (call $d3d9_program_alloc))
      (local.get $device))
    (func (export "ps_refs") (param $d i32) (result i32)
      (load.field DxObject refcount (call $dx_from_this (local.get $d))))
    (func (export "ps_bound") (param $d i32) (result i32)
      (call $gl32 (i32.add (call $d3d9_program_state (local.get $d)) (i32.const 4))))
    (func (export "ps_call") (param $id i32) (param $a i32) (param $b i32)
      (param $c i32) (param $d i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $dispatch_api_table (local.get $id) (local.get $a) (local.get $b)
        (local.get $c) (local.get $d) (i32.const 0) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "ps_free_head") (result i32) (call $heap_bins_flush) (global.get $free_list))
  `});
  e.init_dx_com_thunks();
  const device = e.ps_device(), second = e.ps_device(), code = 0x00408000;
  const out = code + 256, copy = code + 512, size = code + 1024;
  const read = p => e.guest_read32(p) >>> 0, write = (p, v) => e.guest_write32(p, v);
  const call = (method, ...args) => {
    const api = apis.find(a => a.name === 'IDirect3DDevice8_' + method);
    assert(api, method);
    const result = e.ps_call(api.id, ...args) >>> 0;
    assert.equal(e.get_esp() >>> 0, 0x00300000 + 4 * (api.nargs + 1), method + ' ABI');
    return result;
  };
  const words = [0xffff0101, 1, 0x800f0000, 0xa0e40000, 0xffff]; // mov r0,c0
  const create = () => {
    words.forEach((v, i) => write(code + i * 4, v));
    assert.equal(call('CreatePixelShader', device, code, out), 0);
    assert.equal(e.ps_refs(device), 1, 'handles must not retain their owning device');
    return read(out);
  };
  const invalid = 0x8876086c, handle = create();
  assert(handle);
  assert.equal(call('SetPixelShader', device, handle), 0);
  const object = e.ps_bound(device) >>> 0;
  assert.notEqual(object, handle, 'opaque handle is not a COM pointer');
  assert.equal(read(object + 4), 0, 'no external shader reference');
  const bindings = read(object + 20);
  for (let i = 0; i < 20; i++) {
    assert.equal(call('GetPixelShader', device, out), 0); assert.equal(read(out), handle);
  }
  assert.equal(read(object + 20), bindings, 'Get does not retain');
  assert.equal(read(object + 4), 0); assert.equal(e.ps_refs(device), 1);
  assert.equal(call('SetPixelShader', second, handle), invalid, 'other device has no such handle');
  assert.equal(call('SetPixelShader', device, 0xdeadbeef), invalid);
  assert.equal(call('GetPixelShader', device, 0), invalid);
  write(code, 0); // The caller may reuse its bytecode immediately.
  assert.equal(call('GetPixelShaderFunction', device, handle, 0, size), 0);
  assert.equal(read(size), words.length * 4);
  assert.equal(call('GetPixelShaderFunction', device, handle, copy, size), 0);
  assert.deepEqual(words.map((_, i) => read(copy + i * 4)), words);
  write(size, 4); write(copy, 0xdeadbeef);
  assert.equal(call('GetPixelShaderFunction', device, handle, copy, size), invalid);
  assert.equal(read(copy), 0xdeadbeef);
  const constants = [0x3f000000, 0x3f800000, 0, 0x3f800000];
  constants.forEach((v, i) => write(copy + i * 4, v));
  assert.equal(call('SetPixelShaderConstant', device, 7, copy, 1), 0);
  assert.equal(call('GetPixelShaderConstant', device, 7, out, 1), 0);
  assert.deepEqual(constants.map((_, i) => read(out + i * 4)), constants);
  assert.equal(call('SetPixelShaderConstant', device, 8, copy, 1), invalid);
  // Captured state retains bytecode after the handle is deleted. Applying
  // the state may report the old handle, but must not revive Set/Delete.
  assert.equal(call('CreateStateBlock', device, 1, out), 0); const block = read(out);
  assert.equal(call('DeletePixelShader', device, handle), 0);
  assert.equal(call('GetPixelShader', device, out), 0); assert.equal(read(out), 0);
  assert.equal(call('DeletePixelShader', device, handle), invalid);
  assert.equal(call('SetPixelShader', device, handle), invalid);
  assert.equal(call('GetPixelShaderFunction', device, handle, copy, size), invalid);
  assert.equal(call('ApplyStateBlock', device, block), 0);
  assert.equal(call('GetPixelShader', device, out), 0); assert.equal(read(out), handle);
  assert.equal(e.ps_bound(device) >>> 0, object);
  assert.equal(call('SetPixelShader', device, 0), 0);
  assert.equal(call('DeleteStateBlock', device, block), 0);
  assert.equal(e.ps_refs(device), 1);
  const next = create(); assert.notEqual(next, handle);
  assert.equal(call('SetPixelShader', device, next), 0);
  const finalObject = e.ps_bound(device) >>> 0;
  assert.equal(call('Release', device), 0, 'final device release retires undeleted handles');
  assert.equal(call('Release', second), 0);
  let free = e.ps_free_head() >>> 0, found = false;
  for (let i = 0; free && i < 10000; i++, free = read(free + 4))
    if (finalObject - 4 >= free && finalObject < free + (read(free) & ~3)) found = true;
  assert(found, 'undeleted shader allocation reclaimed');
  console.log('PASS D3D8 pixel handles, bytecode/constants, deletion, captured state and device lifetime');
})().catch(error => {console.error(error); process.exitCode = 1;});
