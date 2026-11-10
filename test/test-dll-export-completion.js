'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {bootRenderHarness}=require('./render-helper');
const loader=require('../lib/dll-loader');
const {callDllExport,callDllExportAsync}=loader._test;
const {handleLoadLibraryYield}=require('../lib/process-boot');
const {pe,X86,DATA}=require('./test-dll-lifecycle-real-pe');
const deadline=setTimeout(()=>{throw new Error('export initializer test deadline exceeded');},30000);
(async()=>{
 for(const file of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
  const module=await WebAssembly.compile(fs.readFileSync(path.join(__dirname,'../build',file)));
  for(const call of [callDllExport,callDllExportAsync])for(const [label,tail,calleePops,valid] of [
   ['stdcall',[0xc2,8,0],true,true],['cdecl',[0xc3],false,true],
   ['null jump',[0x31,0xc9,0xff,0xe1],true,false],
   ['trap',[0x0f,0x0b],true,false],['wrong cleanup',[0xc3],true,false],
   ['exit',new X86().push(19).api('ExitThread').finish(),true,false],
  ]){
   const {exports:e,memory}=await bootRenderHarness({fonts:'none',prebuiltModule:module});
   // A misleading success value precedes all failure controls too.
   const bytes=pe([[0x2000,[0xb8,7,0,0,0,...tail]]]);
   new Uint8Array(memory.buffer,e.get_staging(),bytes.length).set(bytes);
   const entry=e.load_pe(bytes.length);
   e.set_eax(91);e.set_ecx(92);e.set_yield_state(5,1);
   const state=()=>Object.fromEntries(['eip','esp','eax','ecx','edx','ebx','ebp','esi','edi','yield_reason','yield_flag']
    .map(key=>[key,e['get_'+key]()>>>0]));
   const before=state();
   const run=()=>call(e,memory.buffer,entry,[3,4],null,label,2000000,calleePops);
   if(valid)assert.equal(await run(),7,file+' '+label);
   else await assert.rejects(async()=>run(),undefined,file+' '+label+' must not return stale EAX=7');
   if(label==='exit'){
    assert.equal(e.get_yield_reason(),2,'terminal exit remains terminal');
    assert.notEqual(e.get_eip(),before.eip,'exited initializer cannot resurrect caller');
   }else assert.deepEqual(state(),before,file+' '+label+' restores caller context');
  }
  for(const mode of ['resume','reject','cancel']){
   const {exports:e,memory}=await bootRenderHarness({fonts:'none',prebuiltModule:module,
    extraHostOverrides:{has_dll_file:()=>1}});
   const code=new X86().store(0x60,1).push(DATA).api('LoadLibraryA').store(0x64,1)
    .emit(0xb8,7,0,0,0,0xc2,8,0).finish();
   const bytes=pe([[0x2000,code],[0x1400,Buffer.from('nested.dll\0')]]);
   new Uint8Array(memory.buffer,e.get_staging(),bytes.length).set(bytes);
   const entry=e.load_pe(bytes.length),before=[e.get_eip(),e.get_esp()];
   const owner=loader.bindDllCallbackOwner(e,71);
   let release,entered;
   const pending=new Promise(resolve=>{release=resolve;});
   const ready=new Promise(resolve=>{entered=resolve;});
   const running=callDllExportAsync(e,memory.buffer,entry,[3,4],null,'awaited export',2000000,true,{
    onLoadLibraryYield:()=>handleLoadLibraryYield({exports:e,memoryBuffer:memory.buffer,
     findDll:async()=>{entered();await pending;
      if(mode==='reject')throw new Error('lookup failed');
      return pe([[0x1000,[0xb8,1,0,0,0,0xc2,12,0]]],true);
     }}),
   });
   const outcome=running.then(value=>({value}),error=>({error}));
   await Promise.race([ready,outcome.then(result=>{throw result.error||new Error('export completed before lookup');})]);
   assert.equal(e.guest_read32(DATA+0x60),1,'pre-wait side effect executed once');
   assert.equal(e.guest_read32(DATA+0x64),0,'export frame retained before post-wait effect');
   assert.notEqual(e.get_esp(),before[1],'caller stack not restored while lookup pending');
   assert(owner.generators.size>0&&owner.gates.size>0,'endpoint owns pending export frame');
   if(mode==='cancel')owner.cancel();
   release();const result=await outcome;
   if(mode==='resume'){
    assert.equal(result.value,7);assert.equal(e.guest_read32(DATA+0x64),1);
   }else{
    assert(result.error,'service failure/cancellation cannot succeed');
    assert.equal(e.guest_read32(DATA+0x64),0,'no resume after failed service');
   }
   assert.deepEqual([e.get_eip(),e.get_esp()],before,'caller restored after final unwind');
   owner.cancel();const receipt=owner.receipt();
   assert.equal(receipt.callbackGenerators,receipt.callbackUnwinds,'all nested frames joined');
  }
 }
 console.log('PASS sync/async exported initializer completion, nested lookup/resume/rejection/cancellation and caller restoration on both WASM builds');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>clearTimeout(deadline));
