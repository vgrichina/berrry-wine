#!/usr/bin/env node
'use strict';
// Private validator -> SIMD -> raster integration. Public PS1.4 acceptance is
// deliberately tested as still closed; this is not profile conformance.
const assert=require('assert');
const {bootRenderHarness}=require('./render-helper');
(async()=>{
 const {exports:e,memory}=await bootRenderHarness({fonts:'none',extraWat:`
  (func (export "scan14") (param $p i32) (param $n i32) (param $out i32) (result i32)
    (call $d3d_ir_scan14 (local.get $p) (local.get $n) (local.get $out)))`});
 e.d3dim_worker_init(0x400000);
 const u32=new Uint32Array(memory.buffer),f32=new Float32Array(memory.buffer),owned=[];
 const alloc=bytes=>{const p=e.guest_alloc(bytes)>>>0;owned.push(p);return e.guest_to_wasm(p)>>>0;};
 const psCode=[0xffff0104,66,0x800f0005,0xb0e40005,1,0x800f0000,0x80e40005,0xffff];
 const tokens=alloc(psCode.length*4);u32.set(psCode,tokens/4);
 const pub=e.d3d_shader_ir_compile(tokens,psCode.length)>>>0;assert(pub,'public ps_1_4 compiles (D3D9-PUBLIC-PS14)');
 const count=e.scan14(tokens,psCode.length,0);assert.strictEqual(count,2);
 const ir=alloc(32+count*128);u32.fill(0,ir/4,ir/4+8+count*32);
 u32.set([0x44534952,1,1,0xffff0104,count,psCode.length,32+count*128,0],ir/4);
 assert.strictEqual(e.scan14(tokens,psCode.length,ir),count);
 // The public compile is the private validator's IR, word for word.
 assert.deepStrictEqual([...u32.subarray(pub/4,pub/4+6)],[0x44534952,1,1,0xffff0104,count,psCode.length],'public PS1.4 IR header');
 assert.deepStrictEqual([...u32.subarray(pub/4+8,pub/4+8+count*32)],[...u32.subarray(ir/4+8,ir/4+8+count*32)],'public PS1.4 IR records equal scan14');
 e.d3d_shader_ir_free(pub);
 const ps=e.d3d_shader_vm_compile(ir);assert(ps,'validated texture operands compile into real SIMD code');
 const vsCode=[0xfffe0101,1,0xc00f0000,0x90e40000,1,0xe00f0005,0x90e40007,0xffff];
 const vtokens=alloc(vsCode.length*4);u32.set(vsCode,vtokens/4);
 const vir=e.d3d_shader_ir_compile(vtokens,vsCode.length);assert(vir);
 const vs=e.d3d_shader_vm_compile(vir);e.d3d_shader_ir_free(vir);assert(vs);
 const input=alloc(3*128);
 for(const [i,p]of[[-1,1,.5,1],[1,1,.5,1],[-1,-1,.5,1]].entries()){
  const vertex=Array(32).fill(0);vertex.splice(0,4,...p);vertex.splice(28,4,.75,.25,0,1);
  f32.set(vertex,input/4+i*32);
 }
 const color=alloc(256),depth=alloc(256),desc=alloc(128),pixels=alloc(8),texture=alloc(36);
 u32.fill(0xff000000,color/4,color/4+64);f32.fill(1,depth/4,depth/4+64);u32.fill(0,desc/4,desc/4+32);
 u32.set([0x44535031,3,8,8,color,32,depth,32,input,3,128,0,3,vs,ps,0,0,0,0,0,0,8,8],desc/4);
 f32[desc/4+24]=1;u32.set([3,2,15,1,0,6,0x76543],desc/4+25);
 u32.set([0xff0000ff,0xff00ff00],pixels/4);
 u32.set([pixels,2,1,8,0,3,3,1,0],texture/4);
 const ctx=e.d3d_software_create(desc);assert(ctx,'six-coordinate raster context');
 assert.strictEqual(e.d3d_software_bind_texture(ctx,5,texture),1);
 let status=1,steps=0;while(status===1&&steps++<1000)status=e.d3d_software_step(ctx,1);
 assert.strictEqual(status,0);assert.strictEqual(u32[color/4+5*8+1],0xff00ff00,'t5 drives sampler5 rather than zero-filled lower coordinates');
 assert.strictEqual(u32[color/4+7*8+7],0xff000000,'uncovered pixel remains untouched');
 e.d3d_software_free(ctx);e.d3d_shader_vm_free(vs);e.d3d_shader_vm_free(ps);
 for(const p of owned.reverse())e.guest_free(p);
 console.log('PASS private PS1.4 validator -> SIMD -> six-stage raster linkage; public compile equals the validator');
})().catch(error=>{console.error(error);process.exitCode=1;});
