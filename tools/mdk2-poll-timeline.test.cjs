'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {workerBootstrap,decode}=require('./mdk2-poll-timeline.cjs');
test('passive import observer preserves results, errors and registers; writes only its SAB',async()=>{
  const listeners=[],rows=new Int32Array(new SharedArrayBuffer((8+8192*28)*4)),control=new Int32Array(new SharedArrayBuffer(8));control[0]=1;
  const memory=new WebAssembly.Memory({initial:1,maximum:1,shared:true}),bytes=Buffer.from(memory.buffer),expected=Buffer.from(bytes),error=Error('same'),ex={get_eip:()=>0x401000,get_current_thread_id:()=>7,get_eax:()=>11,get_yield_reason:()=>0,run:x=>x+1};
  let imports;
  const context={addEventListener:(t,f)=>listeners.push(f),postMessage:()=>{},Atomics:Object.create(Atomics),SharedArrayBuffer,Int32Array,performance,WebAssembly:{instantiate:async(m,i)=>{imports=i;return {exports:ex};},Instance:class{}},GuestRpc:{views:()=>({i32:new Int32Array(memory.buffer,0,64),pub:new Int32Array(memory.buffer,256,64)})}};
  // Object.create(Atomics) inherits its methods in this VM, preserving originals.
  vm.runInNewContext('('+workerBootstrap+')()',context);
  listeners[0]({data:{t:'init',slot:3,endpointIdentity:17,mdk2PollTimeline:{rows:rows.buffer,control:control.buffer}}});
  const result=await context.WebAssembly.instantiate({}, {host:{memory,check_input:()=>123,input_consumed:()=>{throw error;}}});
  assert.equal(imports.host.check_input(),123);assert.throws(()=>imports.host.input_consumed(),e=>e===error);assert.equal(result.exports.run(10),11);assert(bytes.equals(expected));assert.equal(ex.get_eax(),11);
  const records=[];for(let i=0;i<rows[0];i++)records.push(decode(Array.from(rows.subarray(8+i*28,8+(i+1)*28)),['check_input','input_consumed']));
  assert(records.some(r=>r.kind==='import-entry'&&r.import==='check_input'&&r.thread===7&&r.eip===0x401000));assert(records.some(r=>r.kind==='import-return'&&r.result===123));assert(records.some(r=>r.kind==='error'));assert(records.some(r=>r.kind==='run-return'));
  control[0]=0;const n=rows[0];imports.host.check_input();assert.equal(rows[0],n);
});
