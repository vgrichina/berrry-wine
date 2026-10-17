#!/usr/bin/env node
'use strict';
const assert=require('assert/strict');
const {ThreadManager}=require('../lib/thread-manager');

function exercise(mode){
  const memory=new WebAssembly.Memory({initial:1});
  new Uint8Array(memory.buffer,512,128).forEach((_,i,a)=>{a[i]=i;});
  const main={exports:{get_sync_table:()=>0,get_heap_ptr:()=>0,set_heap_ptr:()=>{}}};
  const tm=new ThreadManager({},memory,main,()=>({host:{}}),{});
  const logs=[];tm._log=s=>{if(mode==='logger-throws')throw Error('log sink');logs.push(s);};
  let runs=0,translations=0;
  const e={get_yield_reason:()=>0,get_eip:()=>0x1a84eb,get_esp:()=>0x1000,
    get_eax:()=>42,get_ecx:()=>{if(mode==='export-throws')throw Error('bad export');return 7;},
    get_sreg_cs:()=>0x57,get_sreg_ss:()=>0x77,
    win16_seg_base_of:id=>id===1?0x1a0000:0x1e0000,
    guest_to_wasm:addr=>{translations++;return mode==='sentinel'?0xF0:mode==='out-of-bounds'?65536:512+addr-0x1000;},
    run:()=>{runs++;throw Error('actual cooperative fixture trap');}};
  if(mode==='missing'){delete e.get_esp;delete e.win16_seg_base_of;delete e.guest_to_wasm;}
  if(mode==='translate-throws')e.guest_to_wasm=()=>{throw Error('translation failed');};
  const t={tid:1,state:'active',sleepCount:0,sleepUntil:0,waitPolls:0,waitStartedAt:0,
    _dllAttachNotified:true,instance:{exports:e}};
  tm.threads.set(0xe1000,t);
  assert.doesNotThrow(()=>tm.runSlice(1));
  assert.equal(runs,1);assert.equal(t.state,'exited');assert.equal(t.exitCode,1);
  assert.equal(tm._runningThreadHandle,0,'finally clears running child');
  assert(translations<=128,'diagnostic reads no more than128 stack bytes');
  if(mode==='logger-throws')return;
  assert(logs.some(s=>s.includes('Thread 1 crashed')));
  const detail=JSON.parse(logs.find(s=>s.startsWith('[ThreadManager] crash detail ')).slice(29));
  assert(detail.errorStack.includes('actual cooperative fixture trap'));
  assert.equal(detail.regs.eax,42);
  assert.equal(detail.regs.ecx,mode==='export-throws'?null:7);
  assert.equal(detail.stack.hex.length,mode==='ok'||mode==='export-throws'?256:0);
  if(mode==='ok'){
    assert.equal(detail.segments.csBase,0x1a0000);assert.equal(detail.segments.ssBase,0x1e0000);
    assert.equal(detail.regs.sreg_cs,0x57);assert.equal(detail.stack.hex.slice(-4),'7e7f');
  }
}
for(const mode of ['ok','missing','export-throws','translate-throws','sentinel','out-of-bounds','logger-throws'])exercise(mode);
console.log('PASS cooperative crash diagnostics preserve retirement with missing/throwing exports and bounded stack reads');
