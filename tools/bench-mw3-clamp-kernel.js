#!/usr/bin/env node
'use strict';
// Authentic clamp loop, relocated without changing its instructions. A focused
// timing/parity experiment; not a replacement for real-game A/B or x87 fuzzing.
const fs=require('fs'),path=require('path'),assert=require('assert');
const {createHostImports}=require('../lib/host-imports'),{readPE}=require('../lib/pe');
const exe=fs.readFileSync(path.resolve(__dirname,'../test/binaries/shareware/mw3/ex/Program_Files/mech3demo.exe'));
const pe=readPE(exe),body=exe.subarray(pe.va2off(0x51bc31),pe.va2off(0x51bc7a));
const n=100000,values=[0,0x3f000000,0x3f800000,0x40000000,0xbf800000,0x7fc00000];
async function arm(file){
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const ctx={exports:null,getMemory:()=>memory.buffer};const host=createHostImports(ctx).host;
  Object.assign(host,{memory,log(){},log_i32(){},exit(){},crash_unimplemented(){throw Error('unimplemented');}});
  const {instance}=await WebAssembly.instantiate(fs.readFileSync(file),{host});const e=instance.exports;ctx.exports=e;
  new Uint8Array(memory.buffer).set(exe,e.get_staging());assert(e.load_pe(exe.length));
  const code=e.guest_alloc(body.length+16),data=e.guest_alloc(n*4),stack=e.guest_alloc(64)+32;
  for(let i=0;i<body.length;i++)e.guest_write8(code+i,body[i]);e.guest_write8(code+body.length,0xc3);
  e.set_x87_pipeline4_fusion(1);e.set_x87_island_predecode(1);e.set_uop(1);
  const times=[];let state;
  assert.equal(typeof process.threadCpuUsage,'function','Node with threadCpuUsage is required');
  for(let k=0;k<16;k++){
    for(let i=0;i<n;i++)e.guest_write32(data+i*4,values[i%values.length]);
    e.guest_write32(stack,0);e.set_esp(stack);e.set_ecx(data+n*4);e.set_edx(n);e.set_edi(0);e.set_eip(code);
    const cpu=process.threadCpuUsage(),t=performance.now();e.run(10000000);
    const dt=performance.now()-t,used=process.threadCpuUsage(cpu);assert.equal(e.get_eip(),0,'kernel must finish');
    if(k>=8)times.push({wallMs:dt,threadCpuMs:(used.user+used.system)/1000});
    if(k===15)state={eax:e.get_eax(),ecx:e.get_ecx()-data,edx:e.get_edx(),edi:e.get_edi(),
      top:e.get_fpu_top(),tag:e.get_fpu_tags(),sw:e.get_fpu_sw(),
      flags:[e.get_flag_res(),e.get_flag_op(),e.get_flag_a(),e.get_flag_b(),e.get_flag_sign_shift()],
      output:Array.from({length:n},(_,i)=>e.guest_read32(data+i*4)>>>0)};
  }
  return {file,times,state,islands:e.get_x87_island_runs()};
}
(async()=>{assert.equal(process.argv.length,4,'usage: bench-mw3-clamp-kernel.js BASE.wasm CANDIDATE.wasm');
  const a=await arm(process.argv[2]),b=await arm(process.argv[3]);
  assert.deepStrictEqual(b.state,a.state,'candidate changes architectural state or output');
  delete a.state;delete b.state;console.log(JSON.stringify({iterations:n,parity:true,baseline:a,candidate:b},null,2));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
