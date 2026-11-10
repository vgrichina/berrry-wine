'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {bootRenderHarness}=require('./render-helper');
const {callDllExport}=require('../lib/dll-loader')._test;
const {pe,X86}=require('./test-dll-lifecycle-real-pe');
(async()=>{
 for(const file of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
  const module=await WebAssembly.compile(fs.readFileSync(path.join(__dirname,'../build',file)));
  for(const [label,tail,calleePops,valid] of [
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
   const run=()=>callDllExport(e,memory.buffer,entry,[3,4],null,label,2000000,calleePops);
   if(valid)assert.equal(run(),7,file+' '+label);
   else assert.throws(run,undefined,file+' '+label+' must not return stale EAX=7');
   if(label==='exit'){
    assert.equal(e.get_yield_reason(),2,'terminal exit remains terminal');
    assert.notEqual(e.get_eip(),before.eip,'exited initializer cannot resurrect caller');
   }else assert.deepEqual(state(),before,file+' '+label+' restores caller context');
  }
 }
 console.log('PASS exported initializer stdcall/cdecl completion, trap/NULL/wrong-cleanup failure and caller restoration on both WASM builds');
})().catch(error=>{console.error(error);process.exitCode=1;});
