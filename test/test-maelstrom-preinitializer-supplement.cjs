'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm');
const {harness,files,source}=require('./test-maelstrom-preinitializer-boundary.cjs');
const results=[];
async function test(name,fn){if(process.argv[5]&&!new RegExp(process.argv[5]).test(name))return;await fn();results.push({name,pass:true});}
async function main(){
 await test('actual archived import graph overrides reversed manifest order',()=>{
   const h=harness();const configs=[{name:'SDL_net.dll',bytes:files.net},{name:'SDL.dll',bytes:files.sdl},{name:'msvcrt.dll',bytes:files.crt}];
   // Direct staged API checks ordering independently of the runner's fixed
   // Maelstrom base validation. Mock guest records instead of executing x86.
   const s=h.api.stageDlls(h.ex,h.low.memory.buffer,files.exe,configs,null,{}),order=[];
   h.ex.run=()=>{const row=s.results.find(r=>r.dllMain===h.ex.get_eip());assert(row);order.push(row.name);h.ex.set_eip(0);h.ex.set_esp(h.ex.get_esp()+16);h.ex.set_eax(1);};
   s.initialize();assert.equal(order.length,3);
   assert(order.indexOf('msvcrt.dll')<order.indexOf('SDL.dll'));assert(order.indexOf('SDL.dll')<order.indexOf('SDL_net.dll'));
   assert.deepEqual([...h.low.callbackWords],[0,0]);
 });
 await test('nested synchronous dependency lookup runs under the same armed owner and restores both frames',async()=>{
   const h=harness();let outer=true,nested=false,returned=false;const original=h.ex.run;
   h.ex.run=()=>{
     if(outer){outer=false;h.ex.set_yield_state(5);h.events.push('outer-yield');return;}
     if(nested){h.ex.set_eip(0);h.ex.set_esp(h.ex.get_esp()+16);h.ex.set_eax(1);h.events.push('nested-return');return;}
     h.ex.clear_yield();returned=true;original();
   };
   h.context.onLoadLibraryYield=()=>{
     assert.equal(h.ex.mne_status(),1);assert.equal(h.low.callbackWords[1],2);
     const saved=[h.low.eip,h.low.esp];nested=true;
     const outcome=h.api.callDllMain(h.ex,0x600000,0x601000,null,{});nested=false;
     assert(outcome.completed);assert.deepEqual([h.low.eip,h.low.esp],saved);h.ex.clear_yield();return true;
   };
   await h.execute();assert(returned);assert(h.events.indexOf('arm')<h.events.indexOf('outer-yield'));
   assert(h.events.includes('nested-return'));assert.deepEqual([...h.low.callbackWords],[0,0]);assert.equal(h.ex.mne_rejectReason(),0);
 });
 await test('preinitialize abort is consumed once, rolls back metadata, runs no guest, and releases gate',()=>{
   const h=harness(),s=h.api.stageDlls(h.ex,h.low.memory.buffer,files.exe,[{name:'msvcrt.dll',bytes:files.crt}],null,{});
   s.abort(Error('exact cancellation'));s.abort();assert.throws(()=>s.initialize(),/already consumed/);
   assert(!h.events.some(e=>e.startsWith('dll-run:')));assert.deepEqual([...h.low.callbackWords],[0,0]);
   const dv=new DataView(h.low.memory.buffer);assert.equal(dv.getUint32(0x2000+52,true),0);assert.equal(dv.getUint32(0x2000+12,true),0);
 });
 await test('busy callback owner cannot consume stage and a later valid owner initializes once',()=>{
   const h=harness(),s=h.api.stageDlls(h.ex,h.low.memory.buffer,files.exe,[],null,{});
   Atomics.store(h.low.callbackWords,0,2);Atomics.store(h.low.callbackWords,1,1);assert.throws(()=>s.initialize(),/gate is busy/);
   Atomics.store(h.low.callbackWords,0,0);Atomics.store(h.low.callbackWords,1,0);assert.equal(s.initialize().length,0);assert.deepEqual([...h.low.callbackWords],[0,0]);
 });
 await test('unmodified synchronous loader API still initializes within call',()=>{
   const h=harness(),order=[];h.ex.run=()=>{order.push(h.ex.get_eip());h.ex.set_eip(0);h.ex.set_esp(h.ex.get_esp()+16);h.ex.set_eax(1);};
   const r=h.api.loadDlls(h.ex,h.low.memory.buffer,files.exe,[{name:'msvcrt.dll',bytes:files.crt}],null,{});
   assert.equal(r.length,1);assert.equal(order.length,1);assert.deepEqual([...h.low.callbackWords],[0,0]);
 });
 await test('asynchronous setup rejection unwinds mapped stage without guest execution',async()=>{
   const h=harness();h.context.ctx.vfs={};h.context.seedExeImage=()=>({base:'Maelstrom.exe'});
   h.context.expandIncludePatterns=()=>{throw Error('async setup seam');};
   await assert.rejects(h.execute(),/async setup seam/);assert.equal(h.starts,0);assert(!h.events.some(e=>e.startsWith('dll-run:')));assert.deepEqual([...h.low.callbackWords],[0,0]);
 });
 await test('genuine awaited overlay rejection releases mapped transaction without guest execution',async()=>{
   const h=harness(),load=h.context.require;let awaited=false;
   h.context.ctx.vfs={};h.context.seedExeImage=()=>({base:'Maelstrom.exe'});h.context.expandIncludePatterns=()=>[];
   Object.assign(h.context,{VFS_TREES:[],VFS_MOUNT:[],WIN16_LIBS:[],OVERLAY_DIR:'fixture-overlay'});
   h.context.require=n=>n==='../lib/overlay-store'?{nodeDirStore:()=>({})}:n==='../lib/vfs-overlay'?{attach:()=>({hydrate:async()=>{
     await Promise.resolve();awaited=true;assert.equal(h.starts,0);assert.deepEqual([...h.low.callbackWords],[0,0]);throw Error('awaited hydration failure');
   }})}:load(n);
   await assert.rejects(h.execute(),/awaited hydration failure/);assert(awaited);assert.equal(h.starts,0);assert(!h.events.some(e=>e.startsWith('dll-run:')));assert.deepEqual([...h.low.callbackWords],[0,0]);
 });
 await test('suspended main retains no run and no observation',async()=>{
   const h=harness(),r=await h.execute();let seen=0;
   Object.assign(h.context,{originalNativeObserve:()=>seen++,mainExecutionSuspended:()=>true,BATCH_SIZE:1,batch:0});
   const snippet=source.match(/if \(!mainExecutionSuspended\(\)\) \{ instance\.exports\.run\(BATCH_SIZE\); originalNativeObserve\(batch\); \}/)[0];
   const before=h.events.length;vm.runInContext(snippet,h.context);assert.equal(seen,0);assert.equal(h.events.length,before);
 });
 console.log(JSON.stringify({pass:true,results,rss:process.memoryUsage().rss}));
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
