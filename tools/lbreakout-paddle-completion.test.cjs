'use strict';
const assert=require('node:assert/strict'),cp=require('node:child_process'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=cp.execFileSync('python3',['-c',"import importlib.util;s=importlib.util.spec_from_file_location('h','tools/lbreakout-case-inspection.py');h=importlib.util.module_from_spec(s);s.loader.exec_module(h);print(h.paddle_completion_observer_source())"],{cwd:root,encoding:'utf8'});
const context={setTimeout,clearTimeout,Date,DataView};vm.createContext(context);vm.runInContext(source+';globalThis.install=installPaddleCompletion',context);
(async()=>{
 const binding={exe:0x10000,sdl:0x100000,index:0,generation:7,mappingState:2,keys:0x160000};
 const reviewed={label:'ready',sha256:'a'.repeat(64)};
 async function setup(expected=275){
  const memory={buffer:new ArrayBuffer(0x180000)},v=new DataView(memory.buffer);let esp=0x170000,clock=0,trace;
  const w=(p,x)=>v.setUint32(p,x,true),byte=(p,x)=>v.setUint8(p,x),f=(p,x)=>v.setFloat32(p,x,true);
  w(32,binding.sdl);w(64,2);w(68,7);w(binding.exe+0x523b0,8);f(0x140008,320);
  const e={guest_to_wasm:p=>p,get_dll_table:()=>32,get_dll_lifecycle_table:()=>64,get_dll_lifecycle_stride:()=>16,get_image_base:()=>binding.exe,get_current_thread_id:()=>1,get_esp:()=>esp,get_eax:()=>binding.keys,set_trace_eip_range:(...a)=>{assert(!a[0]||a[2]===a[1]+1);trace=a;}};
  const o=await context.install({e,memory,binding,token:'move',expected,reviewed,now:()=>clock});
  const hit=p=>o.boundary(p);
  const key=down=>{esp=0x170000;w(esp,0x150000);w(esp+4,down);w(esp+8,0x171000);w(0x171004,expected);hit(binding.sdl+0x19870);byte(binding.keys+expected,down);esp+=4;hit(0x150000);};
  const enter=()=>{esp=0x170000;w(esp,0x150100);w(esp+4,0x140000);hit(binding.exe+0x5904);};
  const poll=()=>{esp=0x16ff00;w(esp,0x150200);hit(binding.sdl+0x19810);esp+=4;hit(0x150200);};
  const returned=(delta=expected===275?8:-8)=>{f(0x140008,320+delta);esp=0x170004;hit(0x150100);};
  return {o,e,w,byte,hit,key,enter,poll,returned,expire:()=>{clock=2000;hit(0);}};
 }
 for(const expected of [275,276]){
  const s=await setup(expected);s.key(1);assert(s.o.snapshot().active);s.enter();s.poll();assert(s.o.snapshot().active);s.returned();assert(s.o.snapshot().active);s.key(0);
  assert.equal(s.o.snapshot().reason,'complete');assert.equal(s.o.snapshot().reviewed.sha256,reviewed.sha256);
  assert.deepEqual(Array.from(s.o.snapshot().records,r=>r.kind),['completion-arm','sdl-key-entry','sdl-key-return','paddle-entry','sdl-poll-entry','sdl-poll-return','paddle-return','sdl-key-entry','sdl-key-return','guest-complete','completion-stop']);
 }
 for(const mode of ['module','poll','unchanged','incomplete','released']){
  const s=await setup();s.key(1);
  if(mode==='module'){s.w(68,8);s.enter();}
  else if(mode==='released'){s.byte(binding.keys+275,0);s.enter();}
  else {s.enter();if(mode==='poll')s.e.get_eax=()=>0;s.poll();if(mode==='unchanged')s.returned(0);if(mode==='incomplete')s.expire();}
  assert.equal(s.o.snapshot().reason,mode==='incomplete'?'deadline':'failure',mode);
  const before=JSON.stringify(s.o.snapshot());s.key(0);s.returned();assert.equal(JSON.stringify(s.o.snapshot()),before,'failure stays terminal');
 }
 console.log('PASS generated paddle completion: original delivery/poll/handler return/release, both directions, image binding, bounded incomplete and sticky failure controls');
})().catch(e=>{console.error(e);process.exitCode=1});
