'use strict';
// The immutable independent reproducer runs separately. This challenge covers
// every staging/activation RPC boundary with actual OS Worker dispatch.
require('./helpers/directinput-independent-accept-oct27')(String.raw`
(async()=>{
const {Worker,threadId}=require('worker_threads');
const RPC=require('../lib/guest-rpc');
const sigs=require('../lib/host-import-sigs.generated.json').sigs;
const selected=Object.fromEntries(WebAssembly.Module.imports(module_).filter(x=>x.kind==='function').map(x=>[x.name,sigs[x.name]]));
e.unacquire(obj);
const property=0x23000,format=0x24000,objects=0x25000;
function configure(device,slot){
 const entry=e.entry()+32*slot;wr(e.g2w(device)+4,slot);
 wr(entry,7);wr(entry+8,1);wr(entry+12,9);wr(entry+20,256);wr(entry+28,0x100);
 [24,16,2,16,2,objects].forEach((v,i)=>wr(e.g2w(format)+i*4,v));
 [[28,3],[57,7]].forEach(([dik,ofs],i)=>[0,ofs,(dik<<8)|12,0].forEach((v,j)=>wr(e.g2w(objects)+i*16+j*4,v)));
 e.setFormat(device,format);assert.equal(rd(e.reg()),0);
}
configure(obj,0);configure(obj+16,1);
const operations=[],workers=[],stream=[[3,128],[3,0],[7,128],[7,0]];
let probe=null,fail=0;
function input(){for(const vk of [13,32]){renderer.handleKeyDown(vk);renderer.handleKeyUp(vk);}while(renderer.checkInput()){};}
function hit(side,lane,device,op,value){
 if(probe&&!probe.hit&&probe.side===side&&probe.lane===lane&&probe.op===op&&(probe.value===undefined||probe.value===value)){
  probe.hit=true;probe.acquired=!!(rd(device+28)&0x400);input();
 }
}
function createLane(base,lane,device){
 const broker=RPC.createMainBroker(memory,{...imports.host,...base,di_keyboard_buffer(d,op,value){
  operations.push({lane,d,op,value});hit('before',lane,d,op,value);
  const result=fail===op?1:base.di_keyboard_buffer(d,op,value);
  hit('after',lane,d,op,value);return result;
 }},selected,{});
 let next=0,resolveReady,rejectReady;const pending=new Map();
 const ready=new Promise((r,j)=>{resolveReady=r;rejectReady=j;});
 const code=fs.readFileSync(path.join(ROOT,'test/helpers/directinput-independent-os-worker-oct27.js'),'utf8');
 const worker=new Worker(code,{eval:true,execArgv:[],resourceLimits:{maxOldGenerationSizeMb:512},workerData:{rpc:path.join(ROOT,'lib/guest-rpc.js'),selected,module:module_,memory,obj:device,count,buf}});
 workers.push(worker);
 worker.on('error',err=>{rejectReady(err);for(const p of pending.values())p.reject(err);});
 worker.on('message',m=>{
  if(m.kind==='ready'){resolveReady(m);return;}
  if(m.kind==='rpc'){assert.equal(m.message.t,'rpc');assert.equal(broker.serveRpc(m.message.slot),true);return;}
  const p=pending.get(m.id);if(!p)return;pending.delete(m.id);
  if(m.kind==='error')p.reject(Error(m.error));else p.resolve(m);
 });
 return {ready,request(command){const id=++next;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});worker.postMessage({id,command});});}};
}
const timer=setTimeout(()=>{console.error('bounded atomic acquisition deadline');process.exitCode=1;for(const w of workers)w.terminate();},20000);
const checks=[];
try{
 const a=createLane(host,'a',obj);assert.notEqual((await a.ready).threadId,threadId);
 // Each host invocation can allow input before execution and before its reply.
 for(const [op,value] of [[8,9],[9,13],[9,32],[10,0]])for(const side of ['before','after']){
  probe={lane:'a',op,value,side};operations.length=0;
  assert.equal((await a.request('acquire')).hr,0);assert(probe.hit);assert.equal(probe.acquired,false);
  assert.deepEqual(operations.map(x=>[x.op,x.value]),[[8,9],[9,13],[9,32],[10,0]]);
  const observed=await a.request('poll');assert.equal(observed.hr,0);
  assert.deepEqual(observed.records,op===10&&side==='after'?stream:[]);
  checks.push({boundary:side+' op'+op+' value'+value,records:observed.records});
  probe=null;assert.equal((await a.request('unacquire')).hr,0);
 }
 // Input before Acquire and after successful Acquire are separate controls.
 input();assert.equal((await a.request('acquire')).hr,0);assert.equal((await a.request('poll')).count,0);
 input();assert.deepEqual((await a.request('poll')).records,stream);
 assert.equal((await a.request('acquire')).hr,1); // no second activation
 await a.request('unacquire');input();assert.equal((await a.request('poll')).hr,0x8007000c);
 // Both admission and activation failures leave no acquired flag or staged FIFO.
 for(const op of [8,10]){
  fail=op;operations.length=0;assert.equal((await a.request('acquire')).hr,0x8007000e);
  assert.equal(rd(e.entry()+28)&0x400,0);input();
  assert.equal(host.di_keyboard_buffer(e.entry(),2,0),0);
  if(op===10)assert.equal(operations.at(-1).op,1);
  fail=0;assert.equal((await a.request('acquire')).hr,0);assert.equal((await a.request('poll')).count,0);
  input();assert.deepEqual((await a.request('poll')).records,stream);await a.request('unacquire');
 }
 checks.push({lifecycle:'failed admission/activation, cleanup, reacquire, repeated Acquire, unacquire',pass:true});
 // Reuse the same device slot with a changed selection; no stale selection/edges.
 configure(obj,0);wr(e.g2w(objects)+16+8,(30<<8)|12);e.setFormat(obj,format);assert.equal(rd(e.reg()),0);
 await a.request('acquire');input();assert.deepEqual((await a.request('poll')).records,stream.slice(0,2));await a.request('unacquire');configure(obj,0);
 // Two devices in one host and a third device in another host. Stage b
 // while a and c are live, then commit b; no filter/cursor/reset can cross lanes.
 const b=createLane(host,'b',obj+16);await b.ready;
 const host2=createWindowHost({renderer},{}).imports;
 configure(obj+32,2);const c=createLane(host2,'c',obj+32);await c.ready;
 await a.request('acquire');await c.request('acquire');
 probe={lane:'b',op:9,value:13,side:'after'};await b.request('acquire');assert(probe.hit);probe=null;
 assert.deepEqual((await a.request('poll')).records,stream);
 assert.deepEqual((await c.request('poll')).records,stream);
 assert.equal((await b.request('poll')).count,0);
 input();assert.deepEqual((await b.request('poll')).records,stream);
 await b.request('unacquire');
 assert.deepEqual((await a.request('poll')).records,stream);assert.deepEqual((await c.request('poll')).records,stream);
 await a.request('unacquire');await c.request('unacquire');
 checks.push({isolation:'two devices, two host contexts, actual OS Workers, staged/live/reset isolation and slot reuse',pass:true});
 // Legacy op0 remains an immediate activation; staged filters cannot be edited
 // after activation, and invalid/double activation cannot create a live filter.
 const lease=0x1234;
 assert.equal(host2.di_keyboard_buffer(lease,10,0),1);
 assert.equal(host2.di_keyboard_buffer(lease,0,9),0);input();assert.equal(host2.di_keyboard_buffer(lease,2,0),4);
 host2.di_keyboard_buffer(lease,1,0);assert.equal(host2.di_keyboard_buffer(lease,8,9),0);
 input();assert.equal(host2.di_keyboard_buffer(lease,2,0),0);
 host2.di_keyboard_buffer(lease,9,13);host2.di_keyboard_buffer(lease,10,0);
 assert.equal(host2.di_keyboard_buffer(lease,10,0),1);host2.di_keyboard_buffer(lease,9,32);
 input();assert.equal(host2.di_keyboard_buffer(lease,2,0),2);host2.di_keyboard_buffer(lease,1,0);
 checks.push({hostABI:'legacy activation, missing/double commit rejection, immutable active selection',pass:true});
 console.log(JSON.stringify({atomicAcquireChecks:checks,actualOSWorkers:true,fullModule:false,gameplay:false}));
}finally{
 clearTimeout(timer);probe=null;for(const w of workers)await w.terminate();
 host.di_keyboard_buffer(e.entry(),1,0);host.di_keyboard_buffer(e.entry()+32,1,0);
 console.log(JSON.stringify({cleanup:'all actual Workers terminated',workers:workers.length}));
}
})().catch(err=>{console.error(err.stack);process.exitCode=1;});
`);
