#!/usr/bin/env node
'use strict';
const assert = require('node:assert');
const {bootRenderHarness} = require('./render-helper');
const apis = require('../src/api_table.json');

(async () => {
  const {exports: e} = await bootRenderHarness({fonts: 'none', extraWat: `
    (func (export "vs_stream_token") (result i32) (global.get $D3D8_DECL_TOKEN_STREAM))
    (func (export "vs_device") (result i32)
      (local $device i32)
      (local.set $device (call $dx_create_com_obj (i32.const 20) (global.get $DX_VTBL_D3DDEV8)))
      (store.field DxObject misc1 (call $dx_from_this (local.get $device)) (call $d3d9_program_alloc))
      (local.get $device))
    (func (export "vs_refs") (param $d i32) (result i32)
      (load.field DxObject refcount (call $dx_from_this (local.get $d))))
    (func (export "vs_bound") (param $d i32) (param $offset i32) (result i32)
      (call $gl32 (i32.add (call $d3d9_program_state (local.get $d)) (local.get $offset))))
    (func (export "vs_call") (param $id i32) (param $a i32) (param $b i32)
      (param $c i32) (param $d i32) (param $stack i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (local.get $stack))
      (call $dispatch_api_table (local.get $id) (local.get $a) (local.get $b)
        (local.get $c) (local.get $d) (i32.const 0) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "vs_free_head") (result i32) (call $heap_bins_flush) (global.get $free_list))
  `});
  e.init_dx_com_thunks();
  const device=e.vs_device(), other=e.vs_device(), code=e.guest_alloc(2048)>>>0, stack=e.guest_alloc(64)>>>0;
  const tokens=code+128, out=code+256, copy=code+512, size=code+1024;
  const read=p=>e.guest_read32(p)>>>0, write=(p,v)=>e.guest_write32(p,v);
  const call=(method,...args)=>{
    const api=apis.find(a=>a.name==='IDirect3DDevice8_'+method);
    assert(api,method);
    const result=e.vs_call(api.id,args[0]||0,args[1]||0,args[2]||0,args[3]||0,stack)>>>0;
    assert.equal(e.get_esp()>>>0,stack+4*(api.nargs+1),method+' ABI');
    return result;
  };
  const invalid=0x8876086c;
  const words=[0xfffe0101,1,0xc00f0000,0x90e40000,0xffff]; // mov oPos,v0
  const declaration=[e.vs_stream_token()>>>0,0x40020000,0x40010007,0xffffffff];
  const create=(program=true,version=0xfffe0101)=>{
    words[0]=version;
    words.forEach((v,i)=>write(code+i*4,v));
    declaration.forEach((v,i)=>write(tokens+i*4,v));
    assert.equal(call('CreateVertexShader',device,tokens,program?code:0,out),0);
    assert.equal(e.vs_refs(device),1,'handles do not retain their device');
    return read(out);
  };
  const handle=create();
  assert.equal(call('SetVertexShader',device,handle),0);
  const shader=e.vs_bound(device,0)>>>0, decl=e.vs_bound(device,8)>>>0;
  assert(shader&&decl);
  assert.notEqual(shader,handle);
  assert.equal(read(decl+12),0xd3d80002);
  assert.equal(e.guest_read8(decl+24+read(decl+16)),0);
  assert.equal(e.guest_read8(decl+25+read(decl+16)),7,'retain sparse v7');
  assert.equal(call('SetVertexShader',other,handle),invalid);
  assert.equal(call('SetVertexShader',device,0xdeadbeef),invalid);
  assert.equal(call('DeleteVertexShader',other,handle),invalid);
  assert.equal(call('DeleteVertexShader',device,0xdeadbeef),invalid);
  for(let i=0;i<4;i++){
    assert.equal(call('GetVertexShader',device,out),0);
    assert.equal(read(out),handle);
  }
  assert.equal(e.vs_refs(device),1);
  write(code,0); write(tokens,0); // caller storage is no longer owned by the API
  for(const [method,expected]of [['GetVertexShaderFunction',words],['GetVertexShaderDeclaration',declaration]]){
    assert.equal(call(method,device,handle,0,size),0);
    assert.equal(read(size),expected.length*4);
    assert.equal(call(method,device,handle,copy,size),0);
    assert.deepEqual(expected.map((_,i)=>read(copy+i*4)),expected);
    write(size,1);write(copy,0xdeadbeef);
    assert.equal(call(method,device,handle,copy,size),invalid);
    assert.equal(read(copy),0xdeadbeef);
  }
  const constants=[0x3f800000,0x40000000,0x40400000,0x40800000];
  constants.forEach((v,i)=>write(copy+i*4,v));
  assert.equal(call('SetVertexShaderConstant',device,95,copy,1),0);
  assert.equal(call('GetVertexShaderConstant',device,95,out,1),0);
  assert.deepEqual(constants.map((_,i)=>read(out+i*4)),constants);
  assert.equal(call('SetVertexShaderConstant',device,96,copy,1),invalid);
  assert.equal(call('GetVertexShaderConstant',device,0xffffffff,copy,2),invalid);
  assert.equal(call('SetVertexShader',device,0x102),0);
  assert.equal(e.vs_bound(device,0),0,'FVF clears program');
  assert.equal(call('BeginStateBlock',device),0);
  assert.equal(call('SetVertexShader',device,handle),0);
  assert.equal(e.vs_bound(device,0),0,'recording leaves live program alone');
  assert.equal(call('EndStateBlock',device,out),0);const block=read(out);
  assert.equal(call('ApplyStateBlock',device,block),0);
  assert.equal(e.vs_bound(device,0)>>>0,shader);
  assert.equal(e.vs_bound(device,8)>>>0,decl);
  assert.equal(call('DeleteVertexShader',device,handle),0);
  assert.equal(e.vs_bound(device,0),0);
  assert.equal(call('SetVertexShader',device,handle),invalid);
  assert.equal(call('DeleteVertexShader',device,handle),invalid);
  assert.equal(call('GetVertexShaderFunction',device,handle,0,size),invalid);
  assert.equal(call('ApplyStateBlock',device,block),0);
  assert.equal(e.vs_bound(device,0)>>>0,shader,'state block retains deleted program');
  assert.equal(call('GetVertexShader',device,out),0);assert.equal(read(out),handle);
  assert.equal(call('SetVertexShader',device,0x102),0);
  assert.equal(call('DeleteStateBlock',device,block),0);
  const fixed=create(false);
  assert.equal(call('GetVertexShaderFunction',device,fixed,0,size),0);assert.equal(read(size),0);
  assert.equal(call('DeleteVertexShader',device,fixed),0);
  assert.equal(call('GetVertexShader',device,out),0);assert.equal(read(out),0x102,'unbound deletion preserves FVF');
  // A failed creation must release the intermediate declaration and clear output.
  declaration.forEach((v,i)=>write(tokens+i*4,v));write(code,0);
  assert.equal(call('CreateVertexShader',device,tokens,code,out),invalid);
  assert.equal(read(out),0);assert.equal(e.vs_refs(device),1);
  const legacy=create(true,0xfffe0100);
  assert.equal(call('SetVertexShader',device,legacy),0);
  assert.equal(call('GetVertexShaderFunction',device,legacy,0,size),0);
  assert.equal(call('GetVertexShaderFunction',device,legacy,copy,size),0);
  assert.equal(read(copy),0xfffe0100,'retain original VS1.0 version');
  assert.equal(call('DeleteVertexShader',device,legacy),0);
  const last=create();assert.notEqual(last,handle);
  assert.equal(call('SetVertexShader',device,last),0);
  const resources=[e.vs_bound(device,0)>>>0,e.vs_bound(device,8)>>>0,last];
  assert.equal(call('Release',device),0,'no reference cycle');assert.equal(call('Release',other),0);
  const spans=[];
  for(let p=e.vs_free_head()>>>0,i=0;p&&i<10000;i++,p=read(p+4))spans.push([p,p+(read(p)&~3)]);
  for(const resource of resources)assert(spans.some(([a,b])=>resource-4>=a&&resource<b),'device frees resource '+resource);
  console.log('PASS D3D8 vertex programs, explicit registers, queries/constants, state blocks and lifetime');
})().catch(error=>{console.error(error);process.exitCode=1;});
