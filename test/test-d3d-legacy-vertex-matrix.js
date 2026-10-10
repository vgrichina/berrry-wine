#!/usr/bin/env node
'use strict';
const assert=require('node:assert');
const {bootRenderHarness}=require('./render-helper');
(async()=>{
  const {exports:e,memory}=await bootRenderHarness({fonts:'none',extraWat:`
    (func (export "matrix_alloc") (param $n i32) (result i32) (call $g2w (call $heap_alloc (local.get $n))))
  `});
  const u=new Uint32Array(memory.buffer),f=new Float32Array(memory.buffer);
  const data=e.matrix_alloc(256);
  const register=(ctx,bank,index,values)=>{
    const start=(ctx+32+(bank*128+index)*64)/4;
    if(values)f.set(values.flatMap(v=>[v,v,v,v]),start);
    return Array.from(f.slice(start,start+16));
  };
  for(const [opcode,rows,cols] of [[20,4,4],[21,3,4],[22,4,3],[23,3,3],[24,2,3]]){
    const mask=(1<<rows)-1;
    const tokens=(version,destMask)=>[version,
      1,0x800f0000,0x90e40001, // r0=v1; untouched components must survive
      opcode,(0x80000000|(destMask<<16))>>>0,0x90e40000,0xa0e40000,
      1,0xc00f0000,0x80e40000,0xffff];
    const compile=(version,destMask)=>{
      const words=tokens(version,destMask);u.set(words,data/4);
      return e.d3d_shader_ir_compile(data,words.length);
    };
    const outputs=[];
    for(const [version,destMask] of [[0xfffe0100,15],[0xfffe0101,mask]]){
      const ir=compile(version,destMask);assert(ir,`compile ${version.toString(16)} opcode ${opcode}`);
      assert.equal(u[ir/4+3]>>>0,version,'original profile retained');
      assert.equal(u[(ir+32+128+16+8)/4],mask,'matrix writes only its rows');
      const program=e.d3d_shader_vm_compile(ir);assert(program);
      const ctx=e.d3d_shader_vm_context(program,15);
      register(ctx,1,0,[2,3,4,1]);register(ctx,1,1,[9,9,9,7]);
      for(let row=0;row<4;row++)register(ctx,2,row,Array.from({length:4},(_,col)=>row===col?row+2:0));
      assert.equal(e.d3d_shader_vm_run(ctx,20),0);
      const expected=[4,9,16,cols===4?5:0].map((v,i)=>i<rows?v:[9,9,9,7][i]);
      const output=register(ctx,4,0);assert.deepEqual(output,expected.flatMap(v=>[v,v,v,v]));
      outputs.push(output);
      e.d3d_shader_vm_free(ctx);e.d3d_shader_vm_free(program);e.d3d_shader_ir_free(ir);
    }
    assert.deepEqual(outputs[0],outputs[1],'legacy implicit mask matches explicit matrix rows');
    assert.equal(compile(0xfffe0100,5),0,'arbitrary partial mask stays invalid');
    if(rows<4)assert.equal(compile(0xfffe0101,15),0,'VS1.1 explicit-mask requirement retained');
  }
  console.log('PASS VS1.0 five matrix macros match VS1.1 explicit rows, preserving untouched components');
})().catch(e=>{console.error(e);process.exitCode=1;});
