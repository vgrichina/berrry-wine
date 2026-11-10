'use strict';
const assert=require('node:assert/strict'),cp=require('node:child_process'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=cp.execFileSync('python3',['-c',"import importlib.util;s=importlib.util.spec_from_file_location('h','tools/lbreakout-case-inspection.py');h=importlib.util.module_from_spec(s);s.loader.exec_module(h);print(h.level_start_completion_observer_source())"],{cwd:root,encoding:'utf8'});
const context={setTimeout,clearTimeout,Date,DataView};vm.createContext(context);vm.runInContext(source+';globalThis.install=installLevelStartCompletion',context);
(async()=>{
 const binding={exe:0x10000,sdl:0x100000,index:0,generation:7,mappingState:2,keys:0x160000};
 async function setup(){
  const memory={buffer:new ArrayBuffer(0x180000)},v=new DataView(memory.buffer);let esp=0x170000,clock=0,trace;
  const w=(p,x)=>v.setUint32(p,x,true),byte=(p,x)=>v.setUint8(p,x);
  w(32,binding.sdl);w(64,2);w(68,7);w(binding.exe+0x523b0,8);w(esp,0x150000);
  const e={guest_to_wasm:p=>p,get_dll_table:()=>32,get_dll_lifecycle_table:()=>64,get_dll_lifecycle_stride:()=>16,get_image_base:()=>binding.exe,get_current_thread_id:()=>1,get_esp:()=>esp,get_eax:()=>1,set_trace_eip_range:(...a)=>trace=a};
  const o=await context.install({e,memory,binding,token:'start-level',expected:8,now:()=>clock});
  const hit=rva=>o.boundary(binding.exe+rva);
  const init=()=>{hit(0x1f2ac);esp+=4;o.boundary(0x150000);};
  return {o,e,w,byte,hit,init,expire:()=>{clock=2000;hit(0);},trace:()=>trace};
 }
 const s=await setup();s.init();assert(s.o.snapshot().active);s.hit(0x2047a);assert(s.o.snapshot().active,'pre-fade display cannot complete');
 s.hit(0x1faa0);assert.equal(s.o.snapshot().phase,'fade-return');s.hit(0x2047a);assert(s.o.snapshot().active,'black transition cannot complete');
 s.hit(0x1faf2);assert(s.o.snapshot().active,'fade alone needs first gameplay display');s.hit(0x2047a);
 assert.equal(s.o.snapshot().reason,'complete');assert.deepEqual(Array.from(s.o.snapshot().records,r=>r.kind),['completion-arm','local-init-entry','local-init-return','game-run-entry','level-fade-return','level-display-return','guest-complete','completion-stop']);
 for(const phase of ['init','fade','display']){const x=await setup();if(phase!=='init')x.init();if(phase==='display'){x.hit(0x1faa0);x.hit(0x1faf2);}x.expire();assert.equal(x.o.snapshot().reason,'deadline');}
 const f=await setup();f.w(68,8);f.hit(0x1f2ac);assert.equal(f.o.snapshot().reason,'failure');
 const failed=await setup();failed.e.get_eax=()=>0;failed.init();assert.equal(failed.o.snapshot().reason,'failure');
 const held=await setup();held.init();held.hit(0x1faa0);held.hit(0x1faf2);held.byte(binding.keys+13,1);held.hit(0x2047a);assert.equal(held.o.snapshot().reason,'failure');
 console.log('PASS generated level-start observer: init, original fade, gameplay display, release, expiry, failure and module binding');
})().catch(e=>{console.error(e);process.exitCode=1});
