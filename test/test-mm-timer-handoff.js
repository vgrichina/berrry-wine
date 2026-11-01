#!/usr/bin/env node

// Exercise the full emitted runtime, x86 callbacks, CACA003B completion and
// ThreadManager's main retry admission under genuine critical-section contention.
'use strict';
const assert=require('assert/strict');
const {createHostImports}=require('../lib/host-imports');
const {ThreadManager}=require('../lib/thread-manager');
const R=require('../lib/region-map.generated');
const api=require('../src/api_table.json');
async function checkHandoff(bytes) {
 const module=await WebAssembly.compile(bytes);
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),dv=new DataView(memory.buffer);
 const image=0x400000,thunk=0x7500000,cs=0x520000,cb=0x401000,mainCode=0x402000,cbCount=0x530000,mainCount=cbCount+4;
 const names=['EnterCriticalSection','LeaveCriticalSection','Sleep','GetTickCount'];
 const ptr=Object.fromEntries(names.map((n,i)=>[n,thunk+8*(i+1)]));
 dv.setUint32(R.BASE.THUNK_BASE,0xcaca003b,true);
 names.forEach((name,i)=>dv.setUint32(R.BASE.THUNK_BASE+8*(i+1)+4,api.find(x=>x.name===name).id,true));
 let clock=100;const traces=[];
 const make=async tid=>{const ctx={getMemory:()=>memory.buffer,onExit:()=>{}};const im=createHostImports(ctx);let e;
 Object.assign(im.host,{memory,log:()=>{},log_i32:()=>{},log_api_exit:()=>{},get_ticks:()=>{if(e?.get_eip()===ptr.GetTickCount)clock+=20;traces.push({tid,eip:e?.get_eip(),clock,last:dv.getUint32(R.BASE.MM_TIMER_TABLE+16,true),steps:e?.get_steps(),budget:e?.get_block_budget()});return clock;}});
 const instance=await WebAssembly.instantiate(module,im);e=instance.exports;ctx.exports=e;
 e.init_thread(tid,image,0x400000,0x600000,thunk,thunk+8*5,5,0);return instance;};
 const mainInstance=await make(0),timerInstance=await make(1),main=mainInstance.exports,timer=timerInstance.exports;
 const write=(g,n)=>dv.setUint32(main.guest_to_wasm(g),n>>>0,true),read=g=>dv.getUint32(main.guest_to_wasm(g),true);
 function program(base,body){const code=[],u32=n=>[n&255,(n>>>8)&255,(n>>>16)&255,n>>>24];const a={push:n=>code.push(0x68,...u32(n)),call:n=>{const pc=base+code.length;code.push(0xe8,...u32(n-pc-5));},inc:n=>code.push(0xff,0x05,...u32(n)),raw:(...n)=>code.push(...n)};body(a);new Uint8Array(memory.buffer).set(code,main.guest_to_wasm(base));}
 program(cb,a=>{a.push(cs);a.call(ptr.EnterCriticalSection);a.inc(cbCount);a.push(0);a.call(ptr.Sleep);a.call(ptr.GetTickCount);a.push(cs);a.call(ptr.LeaveCriticalSection);a.raw(0xc2,20,0);});
 program(mainCode,a=>{a.push(cs);a.call(ptr.EnterCriticalSection);a.inc(mainCount);a.push(0);a.call(ptr.Sleep);a.raw(0xeb,0xfe);});
 main.test_cs_init(cs);main.set_esp(0x510000);main.set_eip(mainCode);
 timer.set_esp(0x508000);timer.set_eip(thunk);
 [1,20,cb,0,80,0].forEach((n,i)=>dv.setUint32(R.BASE.MM_TIMER_TABLE+4*i,n,true));
 [1,0xe1001,thunk,0].forEach((n,i)=>dv.setUint32(R.BASE.TIMER_SHARED+0x50+4*i,n,true));
 const manager=new ThreadManager(module,memory,mainInstance,()=>({}),{now:()=>clock,sleepNow:()=>clock});
 // A real callback stops in Sleep(0) while holding the section. This also
 // covers the new callback-admission boundary, if it yields before entry.
 for(let i=0;i<3 && read(cs+12)!==2;i++){timer.run(1000);timer.get_sleep_yielded();}
 assert.equal(read(cs+12),2,'timer is the genuine current owner');assert.equal(read(cbCount),1);
 main.run(1000);assert.equal(main.get_yield_reason(),9,'main parks on its real EnterCriticalSection thunk');assert.equal(main.get_eip(),ptr.EnterCriticalSection);assert.equal(read(mainCount),0);
 const parkedEsp=main.get_esp();
 // The callback advances by one period, releases, and returns via the real
 // CACA003B/run path. An immediately due successor must give main a turn.
 timer.run(1000);const ownerAtReturn=read(cs+12),timerCountAtReturn=read(cbCount),returnEip=timer.get_eip();
 const suspended=manager.checkMainYield();assert.equal(suspended,false,'the real scheduler admits main retry');
 main.run(1000);
 const result={ownerAtReturn,timerCountAtReturn,returnEip,mainCount:read(mainCount),mainOwner:read(cs+12),mainEspBefore:parkedEsp,mainEspAfter:main.get_esp(),traces};
 console.log(JSON.stringify(result));
 assert.equal(ownerAtReturn,0,'callback completion returns control while its released section is free');
 assert.equal(timerCountAtReturn,1,'a due successor has not run in the completion turn');
 assert.equal(read(mainCount),1,'contending main acquires on its first admitted retry');
 assert.equal(read(cs+12),1,'main owns the section after that retry');
 assert.equal(main.get_esp(),parkedEsp+8,'retry consumes its original stdcall frame exactly once');
 // Repeated admission under contention must park the timer; no forced
 // release or timer/callback state manipulation is needed for fairness.
 timer.run(1000);assert.equal(timer.get_yield_reason(),9);assert.equal(read(cbCount),1);
 main.test_cs_leave(cs);timer.clear_yield();timer.run(1000);assert.equal(read(cbCount),2,'successor resumes normally once main releases');
 return result;
}
checkHandoff(require('./compile-src').compileSrcWasm())
 .then(()=>console.log('PASS actual emitted timer callback/run/main retry handoff'))
 .catch(error=>{console.error(error);process.exitCode=1;});
