#!/usr/bin/env node
'use strict';
const assert=require('assert'),path=require('path');
const {Worker}=require('worker_threads');
const {bootRenderHarness}=require('./render-helper');
const {Bridge}=require('../lib/d3d9-host');
const {WorkerConsumer}=require('../lib/d3d-command-stream');
const apis=require('../src/api_table.json');
const sigs=require('../lib/host-import-sigs.generated.json').sigs;
(async()=>{
 let bridge;const moves=[];
 const {exports:e,memory,module}=await bootRenderHarness({fonts:'none',extraHostOverrides:{gpu_gl_call:(o,p,a)=>bridge.call(o,p,a),
  move_window:(...args)=>moves.push(args),get_window_client_size:()=>12|(10<<16)},extraWat:`
  (global $reset_test_stack (mut i32) (i32.const 0))
  (func (export "test_stack") (param $p i32) (global.set $reset_test_stack (local.get $p)))
  (func (export "stream_token") (result i32) (global.get $D3D8_DECL_TOKEN_STREAM))
  (func (export "api_call") (param $id i32) (param $a i32) (param $b i32) (param $c i32) (param $d i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (global.get $reset_test_stack))
    (call $dispatch_api_table (local.get $id) (local.get $a) (local.get $b) (local.get $c) (local.get $d) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "create") (param $pp i32) (param $out i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (global.get $reset_test_stack))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (local.get $pp))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (local.get $out))
    (call $handle_IDirect3D9_CreateDevice (i32.const 0) (i32.const 0) (i32.const 1) (i32.const 1) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
  (func (export "release") (param $d i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (global.get $reset_test_stack))
    (call $handle_IDirect3DDevice9_Release (local.get $d) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
  (func (export "clear") (param $d i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (global.get $reset_test_stack))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (i32.const 0x3f800000))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (i32.const 0))
    (call $handle_IDirect3DDevice9_Clear (local.get $d) (i32.const 0) (i32.const 0) (i32.const 1) (i32.const -65536) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
  (func (export "program") (param $d i32) (result i32) (call $d3d9_program_state (local.get $d)))
  (func (export "free_head") (result i32) (call $heap_bins_flush) (global.get $free_list))`});

 e.d3dim_worker_init(0x400000);e.init_dx_com_thunks();e.test_stack(e.guest_alloc(128));
 const pp=e.guest_alloc(64),pp8=e.guest_alloc(64),out=e.guest_alloc(4),code=e.guest_alloc(256),decl=code+64,size=code+128,copy=code+160;
 const read=p=>e.guest_read32(p)>>>0,write=(p,v)=>e.guest_write32(p,v),wa=p=>e.guest_to_wasm(p)>>>0;
 const params=()=>[8,8,21,1,0,0,1,1,1,0,0,0,0,0x80000000].forEach((v,i)=>write(pp+i*4,v));
 const params8=()=>[8,8,21,1,0,1,1,1,0,0,0,0,0x80000000].forEach((v,i)=>write(pp8+i*4,v));
 const call=(name,...args)=>e.api_call(apis.find(a=>a.name==='IDirect3DDevice8_'+name).id,...[...args,0,0,0,0].slice(0,4))>>>0;
 for(const async of [false,true]){
  bridge=new Bridge({backend:'software',enableProgrammable:true,getExports:()=>e,getMemory:()=>memory.buffer,guestToWasm:wa,
   ...(async?{createSoftwareWorker:()=>new WorkerConsumer(new Worker(path.join(__dirname,'../lib/d3d-render-worker.js')),
    {module,memory,sigs,imageBase:e.get_image_base()>>>0,reclaimHeap:h=>e.d3d_render_adopt_free_list(h)})}:{})});
  const invoke=async(fn,...args)=>{let v=fn(...args);while(e.get_d3d_render_token()){await bridge.wait(e.get_d3d_render_token());v=fn(...args);}return v>>>0;};
  try{
   params();assert.equal(e.create(pp,out),0);const d=read(out);
   assert.equal(await invoke(e.clear,d),0);
   [e.stream_token(),0x40030000,0xffffffff].forEach((v,i)=>write(decl+i*4,v));
   [0xfffe0101,1,0xc00f0000,0x90e40000,0xffff].forEach((v,i)=>write(code+i*4,v));
   assert.equal(call('CreateVertexShader',d,decl,code,out),0);const deadVs=read(out);
   assert.equal(call('DeleteVertexShader',d,deadVs),0);
   assert.equal(call('CreateVertexShader',d,decl,code,out),0);const vs=read(out);
   [0xffff0101,1,0x800f0000,0x90e40000,0xffff].forEach((v,i)=>write(code+i*4,v));
   const pixel=()=>{assert.equal(call('CreatePixelShader',d,code,out),0);return read(out)};
   const dead=pixel();assert.equal(call('DeletePixelShader',d,dead),0);const ps=pixel();
   assert.equal(call('SetVertexShader',d,vs),0);assert.equal(call('SetPixelShader',d,ps),0);
   const resources=[deadVs,vs,read(vs+8),read(vs+16)],beforeProgram=e.program(d);
   const submit=bridge._submit;bridge._submit=function(entry,opcode,payload){if(payload?.kind==='reset')throw Error('injected reset failure');return submit.call(this,entry,opcode,payload)};
   params8();assert.equal(await invoke(()=>call('Reset',d,pp8)),0x88760868);bridge._submit=submit;
   assert.equal(e.program(d),beforeProgram);assert.equal(call('SetVertexShader',d,vs),0);assert.equal(call('SetPixelShader',d,ps),0);
   for(let cycle=0;cycle<2;cycle++){
    params8();assert.equal(await invoke(()=>call('Reset',d,pp8)),0);
    assert.equal(read(e.program(d)),0,'Reset clears live VS binding');assert.equal(read(e.program(d)+4),0,'Reset clears live PS binding');
    assert.equal(call('SetVertexShader',d,vs),0,'vertex handle survives Reset');assert.equal(call('SetPixelShader',d,ps),0,'pixel handle survives Reset');
    assert.equal(call('GetVertexShader',d,out),0);assert.equal(read(out),vs);
    assert.equal(call('GetPixelShader',d,out),0);assert.equal(read(out),ps);
    assert.equal(call('SetPixelShader',d,dead),0x8876086c,'dead pixel handles stay dead');
    assert.equal(call('SetVertexShader',d,deadVs),0x8876086c,'dead vertex handles stay dead');
    write(size,64);assert.equal(call('GetVertexShaderFunction',d,vs,copy,size),0);assert.equal(read(copy),0xfffe0101);
    write(size,64);assert.equal(call('GetPixelShaderFunction',d,ps,copy,size),0);assert.equal(read(copy),0xffff0101);
    const fresh=pixel();assert(fresh>ps&&fresh!==dead,'counter must not reuse pre-reset handles');assert.equal(call('DeletePixelShader',d,fresh),0);
   }
   assert.equal(await invoke(e.release,d),0,'shader handles do not keep the device alive');
   const spans=[];for(let p=e.free_head()>>>0,i=0;p&&i++<10000;p=read(p+4))spans.push([p,p+(read(p)&~3)]);
   for(const p of resources)assert(spans.some(([a,b])=>p-4>=a&&p<b),'device releases surviving vertex resource '+p);
  }finally{await bridge.close();}
 }
 console.log('PASS D3D8 live/deleted shader handles, counter and lifetime across failed/repeated Reset; direct and worker renderer');
})().catch(e=>{console.error(e);process.exitCode=1});
