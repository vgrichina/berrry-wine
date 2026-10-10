#!/usr/bin/env node
'use strict';
const assert = require('assert');
const {bootRenderHarness} = require('./render-helper');
const {Bridge} = require('../lib/d3d9-host');
const {Device:SoftwareDevice} = require('../lib/d3d9-software-backend');
(async () => {
  // Malformed transport banks must fail before even coalescing native storage.
  for(const stage of ['vertex','pixel'])for(const [kind,Type,length] of
    [['Integer',Int32Array,64],['Boolean',Uint32Array,16]]){
    for(const value of [null,Array(length).fill(0),new Float32Array(length),new Type(length-1),new Type(length+1)]){
      assert.throws(()=>SoftwareDevice.prototype.prepare.call({idle(){},exports(){
        throw Error('malformed typed banks touched native storage');
      }},{[stage+kind+'Constants']:value}),/invalid typed shader constants/);
    }
  }
  let bridge;
  const typedExecutions=[];
  const names=['CreateVertexShader','CreatePixelShader','SetVertexShader','SetPixelShader',
    'SetVertexShaderConstantF','SetPixelShaderConstantF','SetMaterial','SetLight','LightEnable',
    'SetVertexShaderConstantI','SetVertexShaderConstantB','SetPixelShaderConstantI','SetPixelShaderConstantB',
    'SetDepthStencilSurface','GetDepthStencilSurface',
    'Reset','TestCooperativeLevel','GetVertexShader','GetPixelShader','GetViewport','GetRenderState','BeginStateBlock','EndStateBlock','SetScissorRect',
    'SetFVF','SetRenderState','SetTransform','SetViewport','SetStreamSource','SetTexture','SetSamplerState','DrawPrimitive','DrawPrimitiveUP','Present'];
  const {exports:e,memory}=await bootRenderHarness({fonts:'none',
    extraHostOverrides:{gpu_gl_call:(op,p,a)=>bridge.call(op,p,a)},extraWat:`
    ${['Apply','Release'].map(n=>`(func (export "block_${n}") (param $b i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $handle_${require('../src/api_table.json').find(a=>a.name===`IDirect3DStateBlock9_${n}`).handler||`IDirect3DStateBlock9_${n}`} (local.get $b) (i32.const 0) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))`).join('\n')}
    (func (export "create_depth") (param $d i32) (param $format i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (i32.const 0))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (i32.const 0))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)) (local.get $out))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)) (i32.const 0))
      (call $handle_IDirect3DDevice9_CreateDepthStencilSurface (local.get $d) (i32.const 8) (i32.const 8) (local.get $format) (i32.const 0) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "release_depth") (param $s i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $handle_IDirect3DSurface9_Release (local.get $s) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "clear_target") (param $d i32) (param $count i32) (param $rects i32) (param $flags i32) (param $color i32) (param $z f32) (param $stencil i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (i32.reinterpret_f32 (local.get $z)))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (local.get $stencil))
      (call $handle_IDirect3DDevice9_Clear (local.get $d) (local.get $count) (local.get $rects) (local.get $flags) (local.get $color) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "create_device") (param $pp i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (local.get $pp))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (local.get $out))
      (call $handle_IDirect3D9_CreateDevice (i32.const 0) (i32.const 0) (i32.const 1)
        (i32.const 1) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "target_bits") (param $d i32) (result i32)
      (load.field DxObject misc1 (call $d3ddev_rt_entry (local.get $d))))
    (func (export "create_buffer") (param $d i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (local.get $out))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (i32.const 0))
      (call $handle_IDirect3DDevice9_CreateVertexBuffer (local.get $d) (i32.const 96)
        (i32.const 0) (i32.const 0x42) (i32.const 1) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "cube_create") (param $d i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (i32.const 1))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (local.get $out))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)) (i32.const 0))
      (call $handle_IDirect3DDevice9_CreateCubeTexture (local.get $d) (i32.const 2) (i32.const 0)
        (i32.const 0) (i32.const 21) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "cube_lock") (param $t i32) (param $face i32) (param $level i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (i32.const 0))
      (call $handle_IDirect3DCubeTexture9_LockRect (local.get $t) (local.get $face) (local.get $level)
        (local.get $out) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "cube_unlock") (param $t i32) (param $face i32) (param $level i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $handle_IDirect3DCubeTexture9_UnlockRect (local.get $t) (local.get $face) (local.get $level)
        (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "cube_lod") (param $t i32) (param $level i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $handle_IDirect3DCubeTexture9_SetLOD (local.get $t) (local.get $level) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "create_texture") (param $d i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (i32.const 21))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (i32.const 1))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)) (local.get $out))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)) (i32.const 0))
      (call $handle_IDirect3DDevice9_CreateTexture (local.get $d) (i32.const 1)
        (i32.const 1) (i32.const 1) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    ${[['Buffer9','Lock'],['Buffer9','Unlock'],['Texture9','LockRect'],['Texture9','UnlockRect']].map(([type,n])=>`
      (func (export "${type}_${n}") (param $a i32) (param $b i32) (param $c i32) (param $d i32) (param $f i32) (result i32)
        (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
        (call $handle_IDirect3D${type}_${n} (local.get $a) (local.get $b) (local.get $c) (local.get $d) (local.get $f) (i32.const 0))
        (i32.load offset=0 (global.get $reg_base)))`).join('\n')}
    ${names.map(n=>`(func (export "${n}") (param $a i32) (param $b i32) (param $c i32) (param $d i32) (param $f i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $handle_IDirect3DDevice9_${n} (local.get $a) (local.get $b) (local.get $c) (local.get $d) (local.get $f) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))`).join('\n')}
  `});
  assert.strictEqual(typeof document,'undefined','this is a browser-free integration gate');
  bridge=new Bridge({backend:'software',enableProgrammable:true,
    getExports:()=>({...e,d3d_shader_ir_compile(){throw Error('draw must consume retained creation IR');},
      d3d_software_create_deferred(...args){
        const vertex={integer:new Int32Array(memory.buffer,args[1],64).slice(),
          boolean:new Uint32Array(memory.buffer,args[1]+256,16).slice().map(v=>v?1:0)};
        const ctx=e.d3d_software_create_deferred(...args)>>>0;
        if(ctx){
          // Inspect copied PS constants before setup starts executing packets.
          const vm=new Uint32Array(memory.buffer,ctx+148,1)[0];
          typedExecutions.push([vertex,{integer:new Int32Array(memory.buffer,vm+73760,64).slice(),
            boolean:new Uint32Array(memory.buffer,vm+74016,16).slice()}]);
        }
        return ctx;
      }}),getMemory:()=>memory.buffer,guestToWasm:p=>e.guest_to_wasm(p)>>>0});
  e.init_dx_com_thunks();
  const alloc=n=>e.guest_alloc(n)>>>0,wa=p=>e.guest_to_wasm(p)>>>0;
  const out=alloc(4),pp=alloc(64);
  new Uint8Array(memory.buffer,wa(pp),64).fill(0);
  [8,8,21,1,0,0,1,1,1].forEach((v,i)=>e.guest_write32(pp+i*4,v));
  e.guest_write32(pp+52,0x80000000); // IMMEDIATE: synchronous pixel fixture
  e.guest_write32(pp+36,1);e.guest_write32(pp+40,77); // real automatic D24X8 attachment
  const ok=(result,label)=>assert.strictEqual(result>>>0,0,`${label}: ${bridge.lastError||''}`);
  ok(e.create_device(pp,out),'device');const device=e.guest_read32(out)>>>0;
  function shader(tokens,pixel){
    const p=alloc(tokens.length*4);new Uint32Array(memory.buffer,wa(p),tokens.length).set(tokens);
    ok(e[pixel?'CreatePixelShader':'CreateVertexShader'](device,p,out,0,0),'shader creation');
    const s=e.guest_read32(out)>>>0;
    ok(e[pixel?'SetPixelShader':'SetVertexShader'](device,s,0,0,0),'shader binding');
    return s;
  }
  shader([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0x90e40005,0xffff],false);
  shader([0xffff0101,1,0x800f0000,0x90e40000,0xffff],true);
  ok(e.SetFVF(device,0x42,0,0,0),'FVF XYZ+diffuse');
  ok(e.SetRenderState(device,22,1,0,0),'no cull');
  const input=alloc(48),view=new DataView(memory.buffer);
  [[-1,1,.5],[1,1,.5],[-1,-1,.5]].forEach((v,i)=>{
    v.forEach((x,j)=>view.setFloat32(wa(input)+i*16+j*4,x,true));
    view.setUint32(wa(input)+i*16+12,0xffff0000,true);
  });
  // Enabling alpha test alone retains native CreateDevice ALWAYS, even when
  // zero source alpha is below the maximum reference. Then test the same
  // programmable shaders with an exact 8-bit boundary and masked DWORD ref.
  ok(e.SetRenderState(device,15,1,0,0),'enable alpha test with default comparator');
  ok(e.SetRenderState(device,24,255,0,0),'maximum alpha reference');
  const typedInput=alloc(256);
  const typedBanks=[
    ['Vertex','I',Int32Array,64],['Vertex','B',Uint32Array,16],
    ['Pixel','I',Int32Array,64],['Pixel','B',Uint32Array,16],
  ];
  const typedExpected=typedBanks.map(([stage,kind,Type,length],bank)=>{
    const values=Type.from({length},(_,i)=>kind==='I'?(i%2?-2147483648+i:2147483647-i):
      (i%3===0?0:i%3===1?0x80000000:0xffffffff));
    new Type(memory.buffer,wa(typedInput),length).set(values);
    ok(e[`Set${stage}ShaderConstant${kind}`](device,0,typedInput,16,0),`typed bank ${bank}`);
    new Uint8Array(memory.buffer,wa(typedInput),256).fill(0);
    return values;
  });
  for(let i=0;i<3;i++)view.setUint32(wa(input)+i*16+12,0x00ff0000,true);
  typedExecutions.length=0;
  ok(e.DrawPrimitiveUP(device,4,1,input,16),'programmed alpha default ALWAYS draw');
  // Setters after submission must not rewrite the queued draw's detached banks.
  for(const [stage,kind] of typedBanks)
    ok(e[`Set${stage}ShaderConstant${kind}`](device,0,typedInput,16,0),'clear live typed bank');
  ok(e.Present(device,0,0,0,0),'alpha default Present');
  assert(typedExecutions.length>0,'bridge uses typed constructor');
  for(const execution of typedExecutions)for(let stage=0;stage<2;stage++){
    assert.deepStrictEqual(execution[stage].integer,typedExpected[stage*2],'detached signed integer bank reaches native VM');
    assert.deepStrictEqual(execution[stage].boolean,typedExpected[stage*2+1].map(v=>v?1:0),
      'raw BOOL bank is normalized only at execution');
  }
  typedExecutions.length=0;
  const alphaPixel=()=>new Uint32Array(memory.buffer,e.target_bits(device)>>>0,64)[9];
  assert.strictEqual(alphaPixel(),0x00ff0000,'default ALWAYS accepts alpha below reference');
  for(let i=0;i<3;i++)view.setUint32(wa(input)+i*16+12,0x8000ff00,true);
  ok(e.SetRenderState(device,24,0xdead0080,0,0),'alpha reference DWORD low8');
  ok(e.SetRenderState(device,25,5,0,0),'alpha GREATER');
  ok(e.DrawPrimitiveUP(device,4,1,input,16),'programmed alpha equal rejects GREATER');
  ok(e.Present(device,0,0,0,0),'rejected alpha Present');
  assert(typedExecutions.length>0,'second draw reaches typed constructor');
  for(const execution of typedExecutions)for(const stage of execution){
    assert(stage.integer.every(v=>v===0),'next draw sees cleared integer constants');
    assert(stage.boolean.every(v=>v===0),'next draw sees cleared boolean constants');
  }
  assert.strictEqual(alphaPixel(),0x00ff0000,'rejected programmable alpha leaves canonical target unchanged');
  ok(e.SetRenderState(device,25,7,0,0),'alpha GREATEREQUAL');
  ok(e.DrawPrimitiveUP(device,4,1,input,16),'programmed alpha boundary accepted');
  ok(e.SetRenderState(device,24,255,0,0),'mutate alpha reference after queued draw');
  ok(e.Present(device,0,0,0,0),'accepted alpha Present');
  assert.strictEqual(alphaPixel(),0x8000ff00,'accepted draw retains its alpha reference snapshot');
  ok(e.SetRenderState(device,15,0,0,0),'disable alpha test');
  for(let i=0;i<3;i++)view.setUint32(wa(input)+i*16+12,0xffff0000,true);
  ok(e.SetRenderState(device,27,1,0,0),'enable blend');
  ok(e.DrawPrimitiveUP(device,4,1,input,16),'blend with native CreateDevice defaults');
  ok(e.Present(device,0,0,0,0),'default blend Present');
  assert.strictEqual(new Uint32Array(memory.buffer,e.target_bits(device)>>>0,64)[9],0xffff0000,
    'native ONE/ZERO/ADD and default write mask preserve source color');
  ok(e.SetRenderState(device,19,16,0,0),'unsupported extended blend factor');
  assert.strictEqual(e.DrawPrimitiveUP(device,4,1,input,16)>>>0,0x8876086c,
    'unsupported software state returns INVALIDCALL');
  ok(e.SetRenderState(device,27,0,0,0),'disable blend');
  ok(e.SetRenderState(device,19,2,0,0),'restore ONE source blend');
  ok(e.DrawPrimitiveUP(device,4,1,input,16),'real queued software draw');
  new Uint8Array(memory.buffer,wa(input),48).fill(0); // caller bytes can be reused
  ok(e.Present(device,0,0,0,0),'native presentation');
  const pixels=new Uint32Array(memory.buffer,e.target_bits(device)>>>0,64);
  assert.strictEqual(pixels[1+8],0xffff0000,'shader output reaches canonical guest target');
  assert.strictEqual(pixels[63],0,'uncovered target remains clear');
  // The same frontend must work with locked native resources, not just UP
  // snapshots authored directly by this test.
  ok(e.create_buffer(device,out),'CreateVertexBuffer');const buffer=e.guest_read32(out)>>>0;
  ok(e.Buffer9_Lock(buffer,0,0,out,0),'vertex buffer lock');
  const bufferBits=e.guest_read32(out)>>>0;
  [[-1,1,.25],[1,1,.25],[-1,-1,.25]].forEach((v,i)=>{
    v.forEach((x,j)=>view.setFloat32(wa(bufferBits)+i*16+j*4,x,true));
    view.setUint32(wa(bufferBits)+i*16+12,0xff0000ff,true);
  });
  ok(e.Buffer9_Unlock(buffer,0,0,0,0),'vertex buffer unlock');
  ok(e.SetStreamSource(device,0,buffer,0,16),'bind vertex buffer');
  ok(e.DrawPrimitive(device,4,0,1,0),'buffer-backed draw');
  ok(e.Present(device,0,0,0,0),'buffer Present');
  assert.strictEqual(pixels[9],0xff0000ff,'locked vertex color reaches native output');
  const lock=alloc(8);
  ok(e.create_texture(device,out),'CreateTexture');const texture=e.guest_read32(out)>>>0;
  ok(e.Texture9_LockRect(texture,0,lock,0,0),'texture lock');
  assert.strictEqual(e.guest_read32(lock),4,'native pitch');
  e.guest_write32(e.guest_read32(lock+4),0xff00ff00);
  ok(e.Texture9_UnlockRect(texture,0,0,0,0),'texture unlock');
  ok(e.SetTexture(device,0,texture,0,0),'texture binding');
  shader([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xe00f0000,0x90e40007,0xffff],false);
  shader([0xffff0101,66,0xb00f0000,1,0x800f0000,0xb0e40000,0xffff],true);
  ok(e.SetFVF(device,0x102,0,0,0),'XYZ+UV');
  const textured=alloc(60);
  new Float32Array(memory.buffer,wa(textured),15).set([-1,1,.1,.5,.5,1,1,.1,.5,.5,-1,-1,.1,.5,.5]);
  ok(e.DrawPrimitiveUP(device,4,1,textured,20),'locked texture sampling');
  ok(e.Present(device,0,0,0,0),'texture Present');
  assert.strictEqual(pixels[9],0xff00ff00,'native texture lock bytes pass through TEX shader');
  // Exercise the actual COM NULL-shader state snapshot, not a hand-built
  // adapter descriptor. The fixed compiler must replace both bound shaders.
  ok(e.SetVertexShader(device,0,0,0,0),'NULL vertex shader');
  ok(e.SetPixelShader(device,0,0,0,0),'NULL pixel shader');
  ok(e.SetRenderState(device,137,0,0,0),'unlit fixed function');
  ok(e.SetRenderState(device,7,0,0,0),'disable depth for fixed coverage');
  ok(e.SetTexture(device,0,0,0,0),'unbind programmable texture');
  const matrix=alloc(64);
  new Float32Array(memory.buffer,wa(matrix),16).set([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  for(const transform of [256,2,3])ok(e.SetTransform(device,transform,matrix,0,0),'identity fixed transform');
  ok(e.SetFVF(device,0x42,0,0,0),'fixed XYZ+diffuse');
  // Exercise actual COM binding transitions, not hand-built mixed snapshots.
  // Deliberately poison the opposite programmable constant bank: fixed DEF
  // values must remain independent of both banks and of later setter calls.
  const constant=alloc(64);
  const setConstant=(pixel,values)=>{
    new Float32Array(memory.buffer,wa(constant),values.length).set(values);
    ok(e[pixel?'SetPixelShaderConstantF':'SetVertexShaderConstantF'](device,0,constant,values.length/4,0),'COM stage constants');
  };
  [[-1,1,.5],[1,1,.5],[-1,-1,.5]].forEach((v,i)=>{
    v.forEach((x,j)=>view.setFloat32(wa(input)+i*16+j*4,x,true));
    view.setUint32(wa(input)+i*16+12,0xffff0000,true);
  });
  setConstant(false,Array(16).fill(0));setConstant(true,[0,1,0,1]);
  shader([0xffff0101,1,0x800f0000,0xa0e40000,0xffff],true);
  ok(e.SetVertexShader(device,0,0,0,0),'mixed NULL vertex setter');
  ok(e.DrawPrimitiveUP(device,4,1,input,16),'COM fixed VS and guest PS constants');
  setConstant(true,[0,0,0,0]);
  ok(e.Present(device,0,0,0,0),'mixed fixed VS Present');
  assert.strictEqual(pixels[9],0xff00ff00,'fixed VS matrix DEF survives guest constants and guest PS owns c0');
  shader([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0xa0e40000,0xffff],false);
  setConstant(false,[0,0,1,1]);setConstant(true,Array(16).fill(0));
  ok(e.SetPixelShader(device,0,0,0,0),'mixed NULL pixel setter');
  ok(e.DrawPrimitiveUP(device,4,1,input,16),'COM guest VS constants and fixed PS');
  setConstant(false,[0,0,0,0]);
  ok(e.Present(device,0,0,0,0),'mixed fixed PS Present');
  assert.strictEqual(pixels[9],0xff0000ff,'fixed PS consumes guest VS diffuse without stealing its constants');
  shader([0xffff0101,1,0x800f0000,0xa0e40000,0xffff],true);
  setConstant(true,[1,0,1,1]);
  ok(e.DrawPrimitiveUP(device,4,1,input,16),'transition back to two guest stages');
  ok(e.Present(device,0,0,0,0),'programmed transition Present');
  assert.strictEqual(pixels[9],0xffff00ff,'rebinding guest PS replaces fixed PS');
  ok(e.SetVertexShader(device,0,0,0,0),'restore NULL vertex after mixed fixtures');
  ok(e.SetPixelShader(device,0,0,0,0),'restore NULL pixel after mixed fixtures');
  [[-1,1,.5],[1,1,.5],[-1,-1,.5]].forEach((v,i)=>{
    v.forEach((x,j)=>view.setFloat32(wa(input)+i*16+j*4,x,true));
    view.setUint32(wa(input)+i*16+12,0xffffff00,true);
  });
  ok(e.DrawPrimitiveUP(device,4,1,input,16),'COM fixed XYZ draw');
  new Uint8Array(memory.buffer,wa(input),48).fill(0);
  ok(e.Present(device,0,0,0,0),'fixed XYZ Present');
  for(let y=0;y<8;y++)for(let x=0;x<8;x++)
    assert.strictEqual(pixels[y*8+x],x+y<8?0xffffff00:0,`fixed XYZ canonical pixel ${x},${y}`);
  const tl=alloc(60);
  [[0,0,.5,1],[8,0,.5,.5],[0,8,.5,.25]].forEach((v,i)=>{
    v.forEach((x,j)=>view.setFloat32(wa(tl)+i*20+j*4,x,true));
    view.setUint32(wa(tl)+i*20+16,0xffff00ff,true);
  });
  ok(e.SetFVF(device,0x44,0,0,0),'fixed POSITIONT+diffuse');
  ok(e.DrawPrimitiveUP(device,4,1,tl,20),'COM fixed POSITIONT draw with varied RHW');
  new Uint8Array(memory.buffer,wa(tl),60).fill(0);
  ok(e.Present(device,0,0,0,0),'fixed POSITIONT Present');
  for(let y=0;y<8;y++)for(let x=0;x<8;x++)
    assert.strictEqual(pixels[y*8+x],x+y<8?0xffff00ff:0,`fixed POSITIONT canonical pixel ${x},${y}`);
  // Black & White's first measured draw uses TRIANGLESTRIP/count2. Exercise
  // the same real COM path with a nonzero start, guarding against applying
  // StartVertex twice while normalizing the strip into native triangles.
  ok(e.SetFVF(device,0x42,0,0,0),'strip XYZ+diffuse');
  ok(e.Buffer9_Lock(buffer,0,0,out,0),'strip vertex buffer lock');
  const stripBits=e.guest_read32(out)>>>0;
  [[4,4],[-1,1],[1,1],[-1,-1],[1,-1],[4,4]].forEach(([x,y],i)=>{
    [x,y,.5].forEach((v,j)=>view.setFloat32(wa(stripBits)+i*16+j*4,v,true));
    view.setUint32(wa(stripBits)+i*16+12,0xff00ffff,true);
  });
  ok(e.Buffer9_Unlock(buffer,0,0,0,0),'strip vertex buffer unlock');
  ok(e.SetStreamSource(device,0,buffer,0,16),'strip stream source');
  ok(e.DrawPrimitive(device,5,1,2,0),'COM triangle strip start1 count2');
  ok(e.Present(device,0,0,0,0),'strip Present');
  assert(pixels.every(v=>v===0xff00ffff),'strip covers all canonical pixels with alternating winding');
  const fan=alloc(64);
  [[-1,1],[1,1],[1,-1],[-1,-1]].forEach(([x,y],i)=>{
    [x,y,.5].forEach((v,j)=>view.setFloat32(wa(fan)+i*16+j*4,v,true));
    view.setUint32(wa(fan)+i*16+12,0xffff8000,true);
  });
  ok(e.DrawPrimitiveUP(device,6,2,fan,16),'COM triangle fan count2');
  new Uint8Array(memory.buffer,wa(fan),64).fill(0);
  ok(e.Present(device,0,0,0,0),'fan Present');
  assert(pixels.every(v=>v===0xffff8000),'fan root anchors both native triangles');
  const fanColor=color=>{for(let i=0;i<4;i++)view.setUint32(wa(fan)+i*16+12,color,true);};
  // Restore the reusable caller positions after the preceding snapshot test.
  [[-1,1],[1,1],[1,-1],[-1,-1]].forEach(([x,y],i)=>{
    [x,y,.5].forEach((v,j)=>view.setFloat32(wa(fan)+i*16+j*4,v,true));
  });
  fanColor(0xff0000ff);ok(e.DrawPrimitiveUP(device,6,2,fan,16),'blue blend destination');
  for(const [state,value]of[[19,5],[20,6],[171,1],[193,0xffffffff],[206,0],[207,1],[208,2],[209,1],[168,15],[27,1]])
    ok(e.SetRenderState(device,state,value,0,0),'COM blend state');
  fanColor(0x80ff0000);ok(e.DrawPrimitiveUP(device,6,2,fan,16),'COM source-alpha blend');
  ok(e.Present(device,0,0,0,0),'blend Present');
  assert(pixels.every(v=>v===0xbf80007f),'source alpha blends RGB and alpha in native WAT');
  ok(e.SetRenderState(device,27,0,0,0),'disable blend to restore destination');
  fanColor(0xff0000ff);ok(e.DrawPrimitiveUP(device,6,2,fan,16),'restore blue destination');
  ok(e.SetRenderState(device,206,1,0,0),'separate alpha enabled');
  ok(e.SetRenderState(device,27,1,0,0),'enable separate blend');
  fanColor(0x80ff0000);ok(e.DrawPrimitiveUP(device,6,2,fan,16),'COM separate alpha draw');
  ok(e.Present(device,0,0,0,0),'separate blend Present');
  assert(pixels.every(v=>v===0xff80007f),'separate ZERO/ONE alpha preserves destination alpha');
  for(const [state,value]of[[19,14],[20,1],[193,0x80402010],[206,0],[168,9]])
    ok(e.SetRenderState(device,state,value,0,0),'constant blend and mask state');
  ok(e.DrawPrimitiveUP(device,6,2,fan,16),'COM constant factor masked draw');
  ok(e.Present(device,0,0,0,0),'masked blend Present');
  assert(pixels.every(v=>v===0x4040007f),'ARGB factor and post-blend red/alpha write mask reach native raster');
  ok(e.SetRenderState(device,27,0,0,0),'disable blend after fixture');
  ok(e.SetRenderState(device,168,15,0,0),'restore full color write mask');
  // The NULL-shader state compiler uses the same native post-shader test.
  // Whole-frame references use adjacent alpha bytes: interpolation may add
  // sub-UNORM8 rounding, whose native precision parity remains a separate gate.
  for(const [state,value]of[[15,1],[24,129],[25,5]])ok(e.SetRenderState(device,state,value,0,0),'fixed alpha state');
  fanColor(0x8000ff00);ok(e.DrawPrimitiveUP(device,6,2,fan,16),'fixed alpha below reference rejected');
  ok(e.Present(device,0,0,0,0),'fixed rejected alpha Present');
  assert(pixels.every(v=>v===0x4040007f),'fixed alpha rejection preserves prior masked blend frame');
  ok(e.SetRenderState(device,24,127,0,0),'fixed alpha lower reference');
  ok(e.DrawPrimitiveUP(device,6,2,fan,16),'fixed alpha above reference accepted');
  fanColor(0x00ffffff);ok(e.SetRenderState(device,24,0,0,0),'mutate fixed reference after draw');
  ok(e.Present(device,0,0,0,0),'fixed accepted alpha Present');
  assert(pixels.every(v=>v===0x8000ff00),'fixed shader alpha and state snapshots reach canonical pixels');
  ok(e.SetRenderState(device,15,0,0,0),'disable fixed alpha fixture');
  // Return to real programmable shader objects after fixed bundles retire.
  shader([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xe00f0000,0x90e40007,0xffff],false);
  shader([0xffff0101,66,0xb00f0000,1,0x800f0000,0xb0e40000,0xffff],true);
  ok(e.SetTexture(device,0,texture,0,0),'rebind programmable texture');
  ok(e.SetFVF(device,0x102,0,0,0),'restore programmable XYZ+UV');
  ok(e.DrawPrimitiveUP(device,4,1,textured,20),'programmable draw after fixed function');
  ok(e.Present(device,0,0,0,0),'restored programmable Present');
  assert.strictEqual(pixels[9],0xff00ff00,'fixed lowering does not replace subsequent guest shaders');
  const entry=bridge.devices.get(device);
  ok(e.clear_target(device,0,0,3,0xff112233,.75),'full color and nondefault depth clear');
  assert.strictEqual(pixels[9],0xff00ff00,'Clear does not publish canonical pixels before Present');
  ok(e.Present(device,0,0,0,0),'full Clear Present');
  assert(pixels.every(v=>v===0xff112233));
  const viewport=alloc(24),rectangles=alloc(32);
  new Uint32Array(memory.buffer,wa(viewport),4).set([2,1,4,5]);
  new Float32Array(memory.buffer,wa(viewport)+16,2).set([0,1]);
  ok(e.SetViewport(device,viewport,0,0,0),'clear viewport');
  new Int32Array(memory.buffer,wa(rectangles),8).set([-5,-5,4,3,5,4,99,99]);
  ok(e.clear_target(device,2,rectangles,3,0xffabcdef,.25),'clipped disjoint rectangle clear');
  new Int32Array(memory.buffer,wa(rectangles),8).fill(0);
  ok(e.Present(device,0,0,0,0),'rectangle Clear Present');
  const depths=new Float32Array(memory.buffer,[...entry.device.depthSurfaces.values()][0].wa,64);
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){
    const hit=(x>=2&&x<4&&y>=1&&y<3)||(x===5&&y>=4&&y<6);
    assert.strictEqual(pixels[y*8+x],hit?0xffabcdef:0xff112233,'Clear rectangles clip to viewport');
    assert.strictEqual(depths[y*8+x],e.d3d_software_quantize_depth(77,hit?.25:.75),'Clear depth uses quantized supplied value in the same rectangles');
  }
  const prior=pixels.slice();
  for(const [count,pointer,flags,z]of[[1,0,1,1],[0,rectangles,1,1],[0,0,4,1],[0,0,2,NaN]])
    assert.strictEqual(e.clear_target(device,count,pointer,flags,0,z)>>>0,0x8876086c,'invalid Clear rejects');
  ok(e.Present(device,0,0,0,0),'invalid Clear Present');assert.deepStrictEqual(pixels,prior);
  ok(e.GetDepthStencilSurface(device,out,0,0,0),'get retained automatic depth');const depthA=e.guest_read32(out)>>>0;
  ok(e.create_depth(device,80,out),'create independent D16 surface');const depthB=e.guest_read32(out)>>>0;
  const idB=e.guest_read32(depthB+36)>>>0;
  ok(e.SetDepthStencilSurface(device,depthB,0,0,0),'bind depth B');
  ok(e.clear_target(device,0,0,3,0xff0000ff,.05),'clear B lower than geometry');
  ok(e.SetRenderState(device,7,1,0,0),'enable attached depth');
  ok(e.SetRenderState(device,14,0,0,0),'disable depth writes');
  ok(e.DrawPrimitiveUP(device,4,1,textured,20),'B rejects geometry');ok(e.Present(device,0,0,0,0),'B Present');
  assert.strictEqual(pixels[2+2*8],0xff0000ff);
  ok(e.SetDepthStencilSurface(device,depthA,0,0,0),'rebind A');
  ok(e.clear_target(device,0,0,2,0,.75),'clear only A depth');
  ok(e.DrawPrimitiveUP(device,4,1,textured,20),'A accepts geometry');ok(e.Present(device,0,0,0,0),'A Present');
  assert.strictEqual(pixels[2+2*8],0xff00ff00);
  ok(e.SetDepthStencilSurface(device,depthB,0,0,0),'rebind B preserving contents');
  ok(e.clear_target(device,0,0,1,0xff0000ff,NaN),'color clear ignores unused Z');
  ok(e.DrawPrimitiveUP(device,4,1,textured,20),'B still rejects after A');ok(e.Present(device,0,0,0,0),'B restored Present');
  assert.strictEqual(pixels[2+2*8],0xff0000ff,'A/B/A storage identity is not a single depth buffer');
  assert.strictEqual(e.release_depth(depthB),0,'external B reference retires but binding keeps it alive');
  assert(entry.device.depthSurfaces.has(idB));
  ok(e.SetDepthStencilSurface(device,0,0,0,0),'NULL disables depth');
  assert(!entry.device.depthSurfaces.has(idB),'last binding release retires backend depth storage');
  assert.strictEqual(e.clear_target(device,0,0,2,0,1)>>>0,0x8876086c,'depth clear without surface rejects');
  ok(e.DrawPrimitiveUP(device,4,1,textured,20),'NULL depth ignores enabled Z state');
  ok(e.Present(device,0,0,0,0),'NULL depth Present');assert.strictEqual(pixels[2+2*8],0xff00ff00);
  ok(e.SetDepthStencilSurface(device,depthA,0,0,0),'restore automatic attachment');
  assert.strictEqual(e.release_depth(depthA),0);
  // Native COM cube resources -> immutable six-face mip snapshot -> WAT
  // TEXM3x3 lookup. All matrix rows arrive through real VS constant state.
  new Uint32Array(memory.buffer,wa(viewport),4).set([0,0,8,8]);
  ok(e.SetViewport(device,viewport,0,0,0),'cube full viewport');
  ok(e.cube_create(device,out),'CreateCubeTexture');const cube=e.guest_read32(out)>>>0;
  const cubeColors=[0xffff0000,0xff00ff00,0xff0000ff,0xffffff00,0xffff00ff,0xff00ffff];
  const fillCube=(face,level,color)=>{
    ok(e.cube_lock(cube,face,level,lock),'cube face LockRect');
    const pitch=e.guest_read32(lock),bits=e.guest_read32(lock+4),size=2>>level;
    assert.strictEqual(pitch,size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++)e.guest_write32(bits+y*pitch+x*4,color);
    ok(e.cube_unlock(cube,face,level),'cube face UnlockRect');
  };
  for(let face=0;face<6;face++){fillCube(face,0,cubeColors[face]);fillCube(face,1,0xff808080);}
  ok(e.SetTexture(device,0,0,0,0),'remove unused source sampler');
  ok(e.SetTexture(device,3,cube,0,0),'bind final cube stage');
  for(const [type,value]of[[1,3],[2,3],[5,1],[6,1],[7,2]])ok(e.SetSamplerState(device,3,type,value,0),'cube sampler');
  for(const [state,value]of[[7,0],[15,0],[27,0],[168,15]])ok(e.SetRenderState(device,state,value,0,0),'cube neutral raster state');
  shader([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xe00f0000,0xa0e40000,
    1,0xe00f0001,0xa0e40001,1,0xe00f0002,0xa0e40002,1,0xe00f0003,0xa0e40003,0xffff],false);
  shader([0xffff0101,64,0xb00f0000,73,0xb00f0001,0xb0e40000,
    73,0xb00f0002,0xb0e40000,74,0xb00f0003,0xb0e40000,1,0x800f0000,0xb0e40003,0xffff],true);
  const cubeConstants=alloc(64),cubeRows=new Float32Array(memory.buffer,wa(cubeConstants),16);
  const cubeDirections=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  for(let face=0;face<6;face++){
    cubeRows.set([.75,.5,.25,1]);
    cubeDirections[face].forEach((value,row)=>cubeRows.set([value/.75,0,0,99],4+row*4));
    ok(e.SetVertexShaderConstantF(device,0,cubeConstants,4,0),'cube matrix constants');
    ok(e.DrawPrimitiveUP(device,4,1,textured,20),'cube matrix draw');
    if(face===5){fillCube(face,0,0xffffffff);e.cube_lod(cube,1);}
    ok(e.Present(device,0,0,0,0),'cube Present');
    assert.strictEqual(pixels[9],cubeColors[face],'native cube face pixels preserve draw-time metadata and bytes');
  }
  ok(e.DrawPrimitiveUP(device,4,1,textured,20),'resident cube mip draw');
  ok(e.Present(device,0,0,0,0),'resident cube mip Present');
  assert.strictEqual(pixels[9],0xff808080,'SetLOD1 keeps six resident faces and original dimensions');
  ok(e.SetTexture(device,3,0,0,0),'unbind cube before Reset');
  const ps12Constants=alloc(48);
  new Float32Array(memory.buffer,wa(ps12Constants),12).set([-.25,0,.5,-0,.2,.4,.6,.8,.8,.6,.4,.2]);
  ok(e.SetPixelShaderConstantF(device,0,ps12Constants,3,0),'PS1.2 constants');
  const ps12Shader=shader([0xffff0102,1,0x800f0001,0xa0e40001,
    88,0x800f0000,0xa0e40000,0x80e40001,0xa0e40002,0xffff],true);
  assert.strictEqual(e.guest_read32(ps12Shader+12)>>>0,0xffff0102,'native object preserves profile version');
  assert.strictEqual(e.guest_read32(ps12Shader+24)>>>0,0xffff0102,'owned function bytes preserve profile version');
  assert.strictEqual(e.SetVertexShader(device,ps12Shader,0,0,0)>>>0,0x8876086c,'PS1.2 cannot bind as vertex shader');
  ok(e.DrawPrimitiveUP(device,4,1,textured,20),'real PS1.2 CMP draw');ok(e.Present(device,0,0,0,0),'CMP Present');
  assert.strictEqual(pixels[9],0xcccc6699,'native COM CMP per-component result');
  for(const reverse of [false,true]) {
    const cmp=[88,0x80070000,0xa0e40000,0x80e40001,0xa0e40002],mov=[1,0x80080000,0xa0e40001];
    const pair=reverse?[mov,cmp]:[cmp,mov];pair[1]=[pair[1][0]|0x40000000,...pair[1].slice(1)];
    shader([0xffff0102,1,0x800f0001,0xa0e40001,...pair.flat(),0xffff],true);
    ok(e.DrawPrimitiveUP(device,4,1,textured,20),'native COM paired CMP draw');
    ok(e.Present(device,0,0,0,0),'paired CMP Present');
    assert.strictEqual(pixels[9],0xcccc6699,'native COM reversed/same-destination CMP pair');
  }
  for(const tokens of [
    [0xffff0102,1,0x800f0000,0xa0e40000,9,0x800f0000,0x80e40000,0xa0e40001,0xffff],
    [0xffff0102,9,0xb00f0000,0xa0e40000,0xa0e40001,0xffff],
    [0xffff0102,88,0x80070000,0x90e40000,0xa0e40000,0xa0e40001,0x40000001,0x80070000,0xa0e40000,0xffff]
  ]) {
    const code=alloc(tokens.length*4);new Uint32Array(memory.buffer,wa(code),tokens.length).set(tokens);
    assert.strictEqual(e.CreatePixelShader(device,code,out,0,0)>>>0,0x8876086c,'native COM rejects DP4 alias/destination and overlapping CMP pair masks');
  }
  // D3D9-CREATE-DRAW-SHADER-AGREEMENT: with the software executor (0x800),
  // CreatePixelShader also compiles the VM program the draw will use, so a
  // shader the VM refuses fails here instead of latching the draw queue.
  // Both ps_1_4 pairs below used to pass create and fail at draw.
  assert.strictEqual(bridge.call(0x30017,0,0)&0x800,0x800,'create-time VM check is armed');
  for(const tokens of [
    [0xffff0104,1,0x800f0000,0xa0e40000,1,0x80010000,0xa0e40001,0x40000001,0x80080000,0xa0e40002,0xffff], // .r + .a pair
    [0xffff0104,1,0x800f0001,0xa0e40000,1,0x800f0002,0xa0e40001,1,0x800f0003,0xa0e40002,1,0x800f0004,0xa0e40003,
      5,0x80070000,0x80e40001,0x80e40002,0x40000002,0x80080000,0x80e40003,0x80e40004,0xffff] // grass.sdv: four temps across a pair
  ]) {
    const code=alloc(tokens.length*4);new Uint32Array(memory.buffer,wa(code),tokens.length).set(tokens);
    ok(e.CreatePixelShader(device,code,out,0,0),'ps_1_4 pair the VM compiles');
  }
  new Float32Array(memory.buffer,wa(ps12Constants),8).set([.25,.5,.75,1,.1,.1,.1,.1]);
  ok(e.SetPixelShaderConstantF(device,0,ps12Constants,2,0),'DP4 constants');
  shader([0xffff0102,9,0x800f0000,0xa0e40000,0xa0e40001,0xffff],true);
  ok(e.DrawPrimitiveUP(device,4,1,textured,20),'real PS1.2 DP4 draw');ok(e.Present(device,0,0,0,0),'DP4 Present');
  assert.strictEqual(pixels[9],0x40404040,'native COM DP4 result');
  shader([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xe00f0000,0xa0e40000,0xffff],false);
  shader([0xffff0101,1,0xb00f0000,0xa0e40000,65,0xb00f0000,1,0x800f0000,0xa0e40001,0xffff],true);
  for(const originalNegative of [true,false]) {
    new Float32Array(memory.buffer,wa(cubeConstants),4).set([originalNegative?-1:1,1,1,1]);
    ok(e.SetVertexShaderConstantF(device,0,cubeConstants,1,0),'original TEXKILL coordinates');
    new Float32Array(memory.buffer,wa(ps12Constants),8).set([originalNegative?1:-1,1,1,1,1,0,0,1]);
    ok(e.SetPixelShaderConstantF(device,0,ps12Constants,2,0),'opposite-sign mutable texture register');
    ok(e.clear_target(device,0,0,1,0xff123456,1),'clear TEXKILL oracle');
    const beforeSamples=entry.device.sampleCount();
    ok(e.DrawPrimitiveUP(device,4,1,textured,20),'original-coordinate TEXKILL draw');
    ok(e.Present(device,0,0,0,0),'TEXKILL Present');
    const passed=entry.device.sampleCount()-beforeSamples;
    assert.strictEqual(pixels[9],originalNegative?0xff123456:0xffff0000,'COM TEXKILL ignores mutable t0');
    if(originalNegative)assert.strictEqual(passed,0n,'discarded fragments never increment query samples');
    else {
      const changed=pixels.filter(pixel=>pixel===0xffff0000).length;
      assert(changed>0);assert.strictEqual(passed,BigInt(changed),'passing samples count exactly the surviving coverage');
    }
  }
  {
    const priorState=[7,14,23].map(state=>{ok(e.GetRenderState(device,state,out,0,0),'save depth state');return[state,e.guest_read32(out)>>>0];});
    ok(e.create_depth(device,75,out),'PS1.3 D24S8 attachment');const attachment=e.guest_read32(out)>>>0;
    ok(e.SetDepthStencilSurface(device,attachment,0,0,0),'bind PS1.3 depth');
    for(const [state,value]of [[7,1],[14,1],[23,2]])ok(e.SetRenderState(device,state,value,0,0),'PS1.3 depth state');
    shader([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xe00f0000,0xa0e40000,
      1,0xe00f0001,0xa0e40001,1,0xe00f0002,0xa0e40002,65535],false);
    const depthShader=shader([0xffff0103,64,0xb00f0000,71,0xb00f0001,0xb0e40000,
      84,0xb00f0002,0xb0e40000,1,0x800f0000,0xa0e40000,65535],true);
    assert.strictEqual(e.guest_read32(depthShader+12)>>>0,0xffff0103);
    assert.strictEqual(e.guest_read32(depthShader+24)>>>0,0xffff0103,'owned PS1.3 bytecode retains exact version');
    assert.strictEqual(e.SetVertexShader(device,depthShader,0,0,0)>>>0,0x8876086c,'PS1.3 cannot bind as vertex shader');
    const malformed=[0xffff0103,64,0xb00f0000,71,0xb00f0001,0xb0e40000,
      84,0xb00f0002,0xb0e40000,1,0x800f0000,0xb0e40002,65535];
    const invalidCode=alloc(malformed.length*4);new Uint32Array(memory.buffer,wa(invalidCode),malformed.length).set(malformed);
    assert.strictEqual(e.CreatePixelShader(device,invalidCode,out,0,0)>>>0,0x8876086c,'COM rejects consumed depth destination read');
    for(const pass of [false,true]) {
      new Float32Array(memory.buffer,wa(cubeConstants),12).set([1,0,0,1,pass?.25:.75,0,0,1,1,0,0,1]);
      ok(e.SetVertexShaderConstantF(device,0,cubeConstants,3,0),'PS1.3 depth rows');
      new Float32Array(memory.buffer,wa(ps12Constants),4).set([1,0,0,1]);
      ok(e.SetPixelShaderConstantF(device,0,ps12Constants,1,0),'PS1.3 color');
      ok(e.clear_target(device,0,0,3,0xff000000,pass?.4:.6),'clear opposite interpolated-depth outcome');
      const samples=entry.device.sampleCount();
      ok(e.DrawPrimitiveUP(device,4,1,textured,20),'PS1.3 native COM draw');
      ok(e.Present(device,0,0,0,0),'PS1.3 Present');
      assert.strictEqual(pixels[9],pass?0xffff0000:0xff000000,'native COM shader-written depth controls visibility');
      assert.strictEqual(entry.device.sampleCount()-samples,BigInt(pixels.filter(pixel=>pixel===0xffff0000).length));
    }
    for(const [state,value]of priorState)ok(e.SetRenderState(device,state,value,0,0),'restore depth state');
    ok(e.SetDepthStencilSurface(device,0,0,0,0),'unbind PS1.3 depth');e.release_depth(attachment);
  }
  const survivingVS=shader([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0x90e40005,0xffff],false);
  const survivingPS=shader([0xffff0101,1,0x800f0000,0x90e40000,0xffff],true);
  ok(e.create_depth(device,75,out),'create real D24S8 stencil attachment');const stencilDepth=e.guest_read32(out)>>>0;
  ok(e.SetDepthStencilSurface(device,stencilDepth,0,0,0),'bind stencil attachment');
  ok(e.SetFVF(device,0x42,0,0,0),'stencil FVF');
  [[-1,1,.5],[1,1,.5],[-1,-1,.5]].forEach((v,i)=>{
    v.forEach((x,j)=>view.setFloat32(wa(input)+i*16+j*4,x,true));view.setUint32(wa(input)+i*16+12,0xffff0000,true);
  });
  ok(e.clear_target(device,0,0,7,0xff0000ff,1,0x107),'native Clear stencil low byte');
  for(const [state,value]of[[7,0],[15,0],[27,0],[22,1],[52,1],[56,3],[57,7]])
    ok(e.SetRenderState(device,state,value,0,0),'stencil state');
  ok(e.DrawPrimitiveUP(device,4,1,input,16),'stencil-equal accepting draw');ok(e.Present(device,0,0,0,0),'stencil Present');
  assert.strictEqual(pixels[9],0xffff0000,'actual COM Clear stencil reference reaches native compare');
  ok(e.SetRenderState(device,57,8,0,0),'change stencil reference');
  ok(e.clear_target(device,0,0,1,0xff0000ff,1),'color-only clear preserves stencil');
  ok(e.DrawPrimitiveUP(device,4,1,input,16),'stencil-equal rejecting draw');ok(e.Present(device,0,0,0,0),'rejected stencil Present');
  assert.strictEqual(pixels[9],0xff0000ff,'actual COM stencil rejection preserves color');
  assert.strictEqual(e.SetRenderState(device,53,9,0,0)>>>0,0x8876086c,'invalid stencil operation rejected before state mutation');
  ok(e.SetRenderState(device,52,0,0,0),'disable stencil');
  ok(e.SetDepthStencilSurface(device,depthA,0,0,0),'restore automatic depth');assert.strictEqual(e.release_depth(stencilDepth),0);
  ok(e.SetRenderState(device,8,2,0,0),'select native wireframe');
  ok(e.clear_target(device,0,0,1,0xff000000,1),'wireframe background');
  ok(e.DrawPrimitiveUP(device,4,1,input,16),'wireframe DrawPrimitiveUP');ok(e.Present(device,0,0,0,0),'wireframe Present');
  assert.strictEqual(pixels[3+3*8],0xff000000,'wireframe triangle interior remains unfilled');
  assert.strictEqual(pixels[4+4*8],0xffff0000,'wireframe original edge reaches canonical Present');
  ok(e.SetRenderState(device,8,3,0,0),'switch back to solid');
  ok(e.DrawPrimitiveUP(device,4,1,input,16),'solid draw after wireframe');ok(e.Present(device,0,0,0,0),'solid Present');
  assert.strictEqual(pixels[3+3*8],0xffff0000,'fill-mode switching changes native coverage');
  assert.strictEqual(e.SetRenderState(device,8,4,0,0)>>>0,0x8876086c,'invalid fill enum rejects');
  ok(e.SetRenderState(device,8,1,0,0),'select point fill state');
  ok(e.clear_target(device,0,0,1,0xff000000,1),'POINT background');
  ok(e.DrawPrimitiveUP(device,4,1,input,16),'native POINT fill');ok(e.Present(device,0,0,0,0),'POINT Present');
  assert.strictEqual(pixels[0],0xffff0000,'POINT rasterizes the original visible vertex');
  assert.strictEqual(pixels[4+4*8],0xff000000,'POINT does not render wireframe edges');
  ok(e.SetRenderState(device,154,0x40000000,0,0),'request larger points');
  ok(e.DrawPrimitiveUP(device,4,1,input,16),'requested size is clamped to advertised MaxPointSize1');
  ok(e.SetRenderState(device,157,1,0,0),'request point distance scaling');
  assert.strictEqual(e.DrawPrimitiveUP(device,4,1,input,16)>>>0,0x8876086c,'programmable point attenuation remains a native-reference gate');
  ok(e.SetRenderState(device,157,0,0,0),'restore unscaled points');
  ok(e.SetRenderState(device,154,0x3f800000,0,0),'restore point size1');
  ok(e.SetRenderState(device,8,3,0,0),'restore solid after POINT');
  ok(e.clear_target(device,0,0,1,0xff000000,1),'point-list background');
  ok(e.SetRenderState(device,22,3,0,0),'polygon cull state does not cull point lists');
  ok(e.DrawPrimitiveUP(device,1,1,input,16),'one POINTLIST vertex through guest API');
  ok(e.Present(device,0,0,0,0),'point-list Present');
  assert.strictEqual(pixels[0],0xffff0000,'one point reaches canonical presented pixels');
  assert.strictEqual([...pixels].filter(v=>v===0xffff0000).length,1,'one point produces one pixel');
  const screenPoint=alloc(20);
  new Float32Array(memory.buffer,wa(screenPoint),4).set([4,4,.5,1]);
  e.guest_write32(screenPoint+16,0xff00ff00);
  ok(e.SetVertexShader(device,0),'point-list fixed vertex stage');
  ok(e.SetPixelShader(device,0),'point-list fixed pixel stage');
  ok(e.SetRenderState(device,137,0),'point-list unlit diffuse');
  ok(e.SetTexture(device,0,0),'point-list no texture');
  ok(e.SetFVF(device,0x44),'point-list XYZRHW diffuse, stride20');
  ok(e.clear_target(device,0,0,1,0xff000000,1),'screen point background');
  ok(e.DrawPrimitiveUP(device,1,1,screenPoint,20),'fixed screen point through guest API');
  ok(e.Present(device,0,0,0,0),'screen point Present');
  assert.strictEqual(pixels[36],0xff00ff00,'fixed screen point preserves position and diffuse');
  assert.strictEqual([...pixels].filter(v=>v===0xff00ff00).length,1,'fixed point emits once');
  ok(e.SetFVF(device,0x42),'restore XYZ diffuse');
  ok(e.SetVertexShader(device,survivingVS),'restore surviving vertex shader');
  ok(e.SetPixelShader(device,survivingPS),'restore surviving pixel shader');
  ok(e.SetRenderState(device,22,1,0,0),'restore cull after point list');
  const resetPP=alloc(64);new Uint8Array(memory.buffer,wa(resetPP),64).fill(0);
  const setResetPP=()=>[16,10,21,1,0,0,1,1,1,1,80,0,0,0x80000000].forEach((v,i)=>e.guest_write32(resetPP+i*4,v));
  setResetPP();ok(e.create_depth(device,80,out),'external default-pool Reset blocker');const blocker=e.guest_read32(out)>>>0;
  assert.strictEqual(e.Reset(device,resetPP,0,0,0)>>>0,0x8876086c,'Reset rejects retained explicit depth surface');
  assert.strictEqual(e.TestCooperativeLevel(device,0,0,0,0)>>>0,0x88760868);
  assert.strictEqual(entry.device.width,8,'failed Reset preserves old backend allocation');
  assert.strictEqual(e.release_depth(blocker),0);
  ok(e.Reset(device,resetPP,0,0,0),'real size-changing Reset');
  ok(e.TestCooperativeLevel(device,0,0,0,0),'successful Reset recovers device');
  assert.strictEqual(entry.device.width,16);assert.strictEqual(entry.device.height,10);
  for(const offset of[0,4,8,12])assert.strictEqual(e.guest_read32(resetPP+offset),0,'windowed Reset output presentation fields');
  ok(e.GetVertexShader(device,out,0,0,0),'Reset vertex binding');assert.strictEqual(e.guest_read32(out),0);
  ok(e.GetPixelShader(device,out,0,0,0),'Reset pixel binding');assert.strictEqual(e.guest_read32(out),0);
  ok(e.GetViewport(device,viewport,0,0,0),'Reset viewport');
  assert.deepStrictEqual(Array.from(new Uint32Array(memory.buffer,wa(viewport),4)),[0,0,16,10]);
  ok(e.GetRenderState(device,22,out,0,0),'Reset default cull');assert.strictEqual(e.guest_read32(out),3);
  ok(e.SetVertexShader(device,survivingVS,0,0,0),'surviving vertex shader rebind');
  ok(e.SetPixelShader(device,survivingPS,0,0,0),'surviving pixel shader rebind');
  ok(e.SetFVF(device,0x42,0,0,0),'post Reset vertex format');ok(e.SetRenderState(device,22,1,0,0),'post Reset no cull');
  [[-1,1,.5],[1,1,.5],[-1,-1,.5]].forEach((v,i)=>{
    v.forEach((x,j)=>view.setFloat32(wa(input)+i*16+j*4,x,true));view.setUint32(wa(input)+i*16+12,0xffff0000,true);
  });
  ok(e.clear_target(device,0,0,3,0xff000000,1),'post Reset Clear');
  ok(e.DrawPrimitiveUP(device,4,1,input,16),'surviving shader draw on resized target');
  ok(e.Present(device,0,0,0,0),'resized Present');
  const resized=new Uint32Array(memory.buffer,e.target_bits(device)>>>0,160);
  assert.strictEqual(resized[17],0xffff0000);assert.strictEqual(resized[159],0xff000000);
  // Real COM lighting state -> immutable queue snapshot -> native fixed VS
  // SIMD execution -> canonical Present. No private lighting descriptor here.
  ok(e.SetVertexShader(device,0),'lit fixed vertex stage');ok(e.SetPixelShader(device,0),'lit fixed pixel stage');
  for(const [state,value]of[[137,1],[145,0],[139,0],[29,0],[7,0],[22,1]])
    ok(e.SetRenderState(device,state,value),'lit state '+state);
  ok(e.SetFVF(device,0x12),'lit XYZ+NORMAL');
  const litVertices=alloc(72),material=alloc(68),light=alloc(104);
  [[-1,1,.5],[1,1,.5],[-1,-1,.5]].forEach((v,i)=>
    new Float32Array(memory.buffer,wa(litVertices)+i*24,6).set([...v,0,0,-1]));
  const mat=new Float32Array(memory.buffer,wa(material),17);mat.fill(0);mat.set([.25,.5,.75,.5]);
  ok(e.SetMaterial(device,material),'SetMaterial actual native state');
  new Uint8Array(memory.buffer,wa(light),104).fill(0);e.guest_write32(light,3);
  new Float32Array(memory.buffer,wa(light)+4,4).set([1,1,1,0]);
  new Float32Array(memory.buffer,wa(light)+64,3).set([0,0,1]);
  ok(e.SetLight(device,0xf1234567,light),'SetLight arbitrary DWORD index');
  ok(e.LightEnable(device,0xf1234567,1),'LightEnable');
  new Uint8Array(memory.buffer,wa(light),104).fill(0x77); // call-time ownership
  const litDraw=(expected,label)=>{
    ok(e.clear_target(device,0,0,1,0xff000000,1),label+' clear');
    ok(e.DrawPrimitiveUP(device,4,1,litVertices,24),label+' draw');ok(e.Present(device),label+' present');
    const pixel=resized[17],rgba=[pixel>>>16&255,pixel>>>8&255,pixel&255,pixel>>>24];
    rgba.forEach((v,i)=>assert(Math.abs(v-expected[i])<=1,`${label}: ${rgba} != ${expected}`));
  };
  litDraw([64,128,191,128],'directional diffuse material');
  ok(e.LightEnable(device,0xf1234567,0),'disable directional light');
  litDraw([0,0,0,128],'disabled light removes diffuse RGB but preserves material alpha');
  mat.set([.125,.25,.375,0],12);ok(e.SetMaterial(device,material),'change emissive material');
  mat.fill(0);litDraw([32,64,96,128],'emissive without enabled lights');
  shader([0xffff0101,1,0x800f0000,0x90e40000,0xffff],true);
  litDraw([32,64,96,128],'lit fixed VS feeds actual PS1.1 v0');
  ok(e.BeginStateBlock(device),'record viewport');
  [8,0,8,10,0,0x3f800000].forEach((v,i)=>e.guest_write32(viewport+i*4,v));
  ok(e.SetViewport(device,viewport),'record right-half viewport');
  litDraw([32,64,96,128],'recorded viewport does not affect live draw');
  ok(e.EndStateBlock(device,out),'finish viewport block');const viewportBlock=e.guest_read32(out)>>>0;
  new Uint8Array(memory.buffer,wa(viewport),24).fill(0);
  // Clear uses the current viewport too: erase the old left-hand triangle
  // before switching, so retained pixels cannot masquerade as a new draw.
  ok(e.clear_target(device,0,0,1,0xff000000,1),'clear full target before viewport Apply');
  ok(e.block_Apply(viewportBlock),'apply recorded viewport');
  litDraw([0,0,0,255],'viewport block changes native raster coverage');
  assert.strictEqual(resized[25],0x80204060,'lit triangle moves to the right-half viewport');
  assert.strictEqual(e.block_Release(viewportBlock),0);
  [0,0,16,10,0,0x3f800000].forEach((v,i)=>e.guest_write32(viewport+i*4,v));
  ok(e.SetViewport(device,viewport),'restore full viewport for scissor');
  ok(e.clear_target(device,0,0,1,0xff000000,1),'erase before enabling scissor');
  const scissorRect=alloc(16);
  [2,0,5,3].forEach((v,i)=>e.guest_write32(scissorRect+i*4,v));
  ok(e.SetScissorRect(device,scissorRect),'native scissor rectangle');
  ok(e.SetRenderState(device,174,1),'enable scissor');
  new Uint8Array(memory.buffer,wa(scissorRect),16).fill(0x77);
  litDraw([0,0,0,255],'scissor rejects fragments outside owned rectangle');
  assert.strictEqual(resized[19],0x80204060,'lit pixel inside scissor survives');
  ok(e.clear_target(device,0,0,1,0xff00ff00,1),'scissored Clear');ok(e.Present(device),'scissored Clear Present');
  assert.strictEqual(resized[19],0xff00ff00);assert.strictEqual(resized[17],0xff000000);
  assert.strictEqual(resized[21],0xff000000,'right scissor edge is exclusive');
  const beforeEmpty=resized.slice();[4,4,4,4].forEach((v,i)=>e.guest_write32(scissorRect+i*4,v));
  ok(e.SetScissorRect(device,scissorRect),'empty native scissor');
  ok(e.clear_target(device,0,0,1,0xffffff00,1),'empty scissored Clear');
  ok(e.DrawPrimitiveUP(device,4,1,litVertices,24),'empty scissored Draw');ok(e.Present(device),'empty scissor Present');
  assert.deepStrictEqual(resized,beforeEmpty,'empty scissor has no pixel side effects');
  ok(e.SetRenderState(device,174,0),'disable scissor');
  litDraw([32,64,96,128],'disabled scissor restores full viewport');
  assert.strictEqual(entry.kind,'software');
  assert.strictEqual(entry.queue.completed,entry.queue.submitted);
  assert(entry.queue.completed>=3,'initial clear, draw and Present use one queue');
  assert.strictEqual(bridge.call(0x30006,0,device),1,'ordered EVENT');
  assert.strictEqual(bridge.call(0x30004,0,device),1,'ordered destruction');
  assert.strictEqual(bridge.devices.size,0);
  console.log('PASS real D3D9 COM -> shared queue -> WAT software: programmable/fixed/mixed stages, independent constants and rebinding, XYZ/POSITIONT, strips/fans, alpha tests/defaults/reference snapshots, blending, directional lighting state and canonical Present pixels, no DOM/WebGL');
})().catch(error=>{console.error(error);process.exitCode=1;});
