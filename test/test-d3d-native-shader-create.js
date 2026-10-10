#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
(async () => {
  let hostValidationCalls = 0, capabilityQueries = 0;
  const { exports: e } = await bootRenderHarness({fonts:'none',
    extraHostOverrides:{gpu_gl_call:opcode=>{
      // Backend capability discovery does not compile/validate guest shaders.
      if(opcode===0x30017){capabilityQueries++;return -1;}
      if(opcode===0x30000)hostValidationCalls++;
      throw new Error('shader creation must not call a host shader validator');
    }}, extraWat:`
      (func (export "native_shader_device") (result i32)
        (local $d i32)
        (local.set $d (call $dx_create_com_obj (i32.const 20) (global.get $DX_VTBL_D3DDEV9)))
        (store.field DxObject misc1 (call $dx_from_this (local.get $d)) (call $d3d9_program_alloc))
        (local.get $d))
      (func (export "native_shader_create") (param $d i32) (param $code i32) (param $out i32) (param $pixel i32) (result i32)
        (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
        (if (local.get $pixel)
          (then (call $handle_IDirect3DDevice9_CreatePixelShader (local.get $d) (local.get $code)
            (local.get $out) (i32.const 0) (i32.const 0) (i32.const 0)))
          (else (call $handle_IDirect3DDevice9_CreateVertexShader (local.get $d) (local.get $code)
            (local.get $out) (i32.const 0) (i32.const 0) (i32.const 0))))
        (i32.load offset=0 (global.get $reg_base)))
    `});
  e.init_dx_com_thunks();
  const device=e.native_shader_device(),code=e.guest_alloc(24),out=e.guest_alloc(4);
  for(const pixel of [0,1]){
    const words=[pixel?0xffff0101:0xfffe0101,1,pixel?0x800f0000:0xc00f0000,0x90e40000,0xffff];
    words.forEach((v,i)=>e.guest_write32(code+i*4,v));
    assert.strictEqual(e.native_shader_create(device,code,out,pixel),0);
    assert.strictEqual(e.get_esp()>>>0,0x074ff010);
    const shader=e.guest_read32(out)>>>0;
    assert(shader); assert.strictEqual(e.guest_read32(shader+16),20);
    assert.deepStrictEqual(words.map((_,i)=>e.guest_read32(shader+24+i*4)>>>0),words);
    e.guest_write32(code+4,254);
    assert.strictEqual(e.guest_read32(shader+28),1,'caller mutation cannot change retained shader');
    assert.strictEqual(e.native_shader_create(device,code,out,pixel)>>>0,0x8876086c);
    assert.strictEqual(e.guest_read32(out),0);
    words.forEach((v,i)=>e.guest_write32(code+i*4,v));
    assert.strictEqual(e.native_shader_create(device,code,out,1-pixel)>>>0,0x8876086c,'stage mismatch');
    for(const bad of [0,code+1,0xffffffff])
      assert.strictEqual(e.native_shader_create(device,bad,out,pixel)>>>0,0x8876086c);
  }
  // ps_1_4 is a public profile (D3D9-PUBLIC-PS14): texld r5,t5 / mov r0,r5,
  // and a coissued RGB+alpha pair, both created through CreatePixelShader and
  // retained with their own version word.
  const ps14=e.guest_alloc(64);
  for(const words of [
    [0xffff0104,66,0x800f0005,0xb0e40005,1,0x800f0000,0x80e40005,0xffff],
    [0xffff0104,81,0xa00f0000,0x3f800000,0,0,0,81,0xa00f0001,0,0,0,0x3f000000,
      1,0x80070000,0xa0e40000,0x40000001,0x80080000,0xa0e40001,0xffff],
  ]){
    words.forEach((v,i)=>e.guest_write32(ps14+i*4,v));
    assert.strictEqual(e.native_shader_create(device,ps14,out,1)>>>0,0,'public ps_1_4 CreatePixelShader');
    const shader=e.guest_read32(out)>>>0;assert(shader);
    assert.strictEqual(e.guest_read32(shader+24)>>>0,0xffff0104,'retained ps_1_4 version word');
  }
  // A ps_1_4 texld after arithmetic is still refused by the validator.
  [0xffff0104,1,0x800f0000,0xa0e40000,66,0x800f0001,0xb0e40001,0xffff].forEach((v,i)=>e.guest_write32(ps14+i*4,v));
  assert.strictEqual(e.native_shader_create(device,ps14,out,1)>>>0,0x8876086c,'invalid ps_1_4 stays D3DERR_INVALIDCALL');
  assert.strictEqual(hostValidationCalls,0);
  assert(capabilityQueries>0,'capability-query path exercised without a graphics backend');
  console.log('PASS D3D9 native shader creation: no host graphics, owned bytecode, stage/errors and ABI, public ps_1_4');
})().catch(error=>{console.error(error);process.exitCode=1;});
