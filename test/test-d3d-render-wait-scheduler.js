#!/usr/bin/env node
'use strict';
const assert=require('assert');
const {ThreadManager}=require('../lib/thread-manager');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function machine(yieldReason=0,token=0) {
  const state={yieldReason,token,eip:0x401000,esp:0x1000,runs:0,clears:0};
  const ex={get_sync_table:()=>0,get_yield_reason:()=>state.yieldReason,
    get_d3d_render_token:()=>state.token,set_d3d_render_token:n=>{state.token=n;},
    get_eip:()=>state.eip,set_eip:n=>{state.eip=n;},get_esp:()=>state.esp,
    set_esp:n=>{state.esp=n;},run:()=>{state.runs++;},get_bp_addr:()=>0,get_sleep_yielded:()=>0,
    clear_yield:()=>{state.yieldReason=0;state.clears++;},
    set_yield_state:(y)=>{state.yieldReason=y;},get_yield_flag:()=>!!state.yieldReason};
  for(const name of ['ebp','eax','ebx','ecx','edx','esi','edi','handler_set_eip','steps']){
    ex['get_'+name]=()=>state[name]||0;ex['set_'+name]=v=>{state[name]=v;};
  }
  return {state,ex};
}
function manager(onRenderWait,main=machine()) {
  const tm=new ThreadManager({},new WebAssembly.Memory({initial:1,maximum:1,shared:true}),
    {exports:main.ex},()=>({host:{}}),{onRenderWait});tm._log=()=>{};return tm;
}
// These are already-running guests. Fresh threads spend their first scheduler
// turn completing DLL_THREAD_ATTACH, even when the DLL notification list is empty.
const thread=(tid,m)=>({tid,state:'active',_dllAttachNotified:true,
  sleepCount:0,sleepUntil:0,waitPolls:0,instance:{exports:m.ex}});
(async()=>{
  const gate=deferred(),tokens=[],tm=manager(t=>{tokens.push(t);return gate.promise;});
  const parked=machine(16,-4),peer=machine();
  tm.threads.set(1,thread(1,parked));tm.threads.set(2,thread(2,peer));
  tm.runSlice(100);await tick();tm.runSlice(100);
  assert.deepStrictEqual(tokens,[-4]);assert.strictEqual(parked.state.runs,0);
  assert.strictEqual(parked.state.clears,0);assert.strictEqual(peer.state.runs,2,'parked renderer does not stall peers');
  assert.strictEqual(tm.threads.get(1).state,'active');assert.strictEqual(tm.threads.get(2).state,'active');
  gate.resolve();await tick();tm.runSlice(100);
  assert.strictEqual(parked.state.clears,1);assert.strictEqual(parked.state.runs,1);
  const rejected=deferred();tm._onRenderWait=()=>rejected.promise;
  parked.state.yieldReason=16;parked.state.token=-5;tm.runSlice(100);await tick();
  rejected.reject(new Error('device lost'));await tick();tm.runSlice(100);
  assert.strictEqual(parked.state.clears,2,'failure resumes WAT to obtain actual HRESULT');

  const workerGate=deferred(),wtm=manager(()=>workerGate.promise);let slices=0,clears=0;
  const worker={tid:1,state:'active',link:{async slice(){slices++;return {eip:1,yield:slices===1?16:0,renderToken:-7};},
    async callExport(name){assert.strictEqual(name,'clear_yield');clears++;}}};
  await wtm._runWorkerThread(1,worker,100,{});await tick();
  await wtm._runWorkerThread(1,worker,100,{});assert.strictEqual(slices,1);
  workerGate.resolve();await tick();await wtm._runWorkerThread(1,worker,100,{});
  assert.strictEqual(slices,2);assert.strictEqual(clears,1);

  const nestedGate=deferred(),ntm=manager(()=>nestedGate.promise);let pumped=0,nestedClears=0;
  ntm._pumpWorkersForThreadSend=async()=>{pumped++;};
  // Callback completion belongs to the registered receiving link and exact
  // frame/epoch; generic clear_yield is fenced while that frame is retained.
  const frame={frameToken:3,waitEpoch:1};
  const link={callExport:async()=>assert.fail('callback must use scoped completion'),
    scopedThreadSendYield:async(token,finish=false)=>{
      assert.deepStrictEqual(token,frame);
      if(finish)nestedClears++;
      return {ready:true,completed:finish};
    }},state={};
  ntm.threads.set(1,{tid:1,state:'active',link});
  const nestedYield={yield:16,renderToken:-8,...frame};
  assert.strictEqual(await ntm.resolveThreadSendYield(link,nestedYield,state,new Set([link])),'pending');
  assert.strictEqual(pumped,1);assert.strictEqual(nestedClears,0);
  nestedGate.resolve();await tick();
  assert.strictEqual(await ntm.resolveThreadSendYield(link,nestedYield,state,new Set([link])),'resume');
  assert.strictEqual(nestedClears,1);

  // A synchronous cooperative SendMessage must retain its interrupted frame,
  // not abort it or replay thread_send_begin when its target calls D3D9.
  const sendGate=deferred(),ctm=manager(()=>sendGate.promise);
  const sender=machine(10),target=machine(16,-20);let begins=0,ends=0,returned=null;
  sender.ex.get_send_target_tid=()=>2;
  for(const n of ['hwnd','msg','wparam','lparam'])sender.ex['get_send_'+n]=()=>1;
  sender.ex.complete_thread_send=value=>{returned=value;sender.state.yieldReason=0;};
  target.ex.thread_send_begin=()=>{begins++;target.state.yieldReason=0;return 1;};
  target.ex.run=()=>{target.state.runs++;if(target.state.runs===1){target.state.token=-21;target.state.yieldReason=16;}
    else{target.state.yieldReason=0;target.state.eip=0;}};
  target.ex.thread_send_end=()=>{ends++;return 123;};
  ctm._cooperativeTargetExports=()=>target.ex;
  assert.strictEqual(ctm.resolveCooperativeThreadSend(sender.ex),false);
  assert.strictEqual(ctm.resolveCooperativeThreadSend(sender.ex),false);
  assert(ctm._renderSendTargets.has(target.ex));assert.strictEqual(begins,1);assert.strictEqual(ends,0);
  const other=machine();ctm.threads.set(1,thread(1,target));ctm.threads.set(2,thread(2,other));
  ctm.runSlice(100);assert.strictEqual(target.state.runs,1);assert.strictEqual(other.state.runs,1);
  sendGate.resolve();await tick();assert.strictEqual(ctm.resolveCooperativeThreadSend(sender.ex),true);
  assert.strictEqual(returned,123);assert.strictEqual(ends,1);assert.strictEqual(begins,1);
  assert.strictEqual(target.state.token,-20,'outer parked token restored');
  assert.strictEqual(target.state.yieldReason,16);assert.strictEqual(target.state.eip,0x401000);
  assert(!ctm._renderSendTargets.has(target.ex));
  console.log('PASS render_wait scheduler: cooperative/Worker peers, errors, nested pumping and retained SendMessage frames');
})().catch(error=>{console.error(error);process.exitCode=1;});
