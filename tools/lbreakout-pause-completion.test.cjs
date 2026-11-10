'use strict';
// Execute the generated passive observer. Synthetic read-only trace boundaries
// exercise ordering; actual x86 SDL consumption is covered by sdl-input-controls.
const assert=require('node:assert/strict'),cp=require('node:child_process'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=cp.execFileSync('python3',['-c',"import importlib.util;s=importlib.util.spec_from_file_location('h','tools/lbreakout-case-inspection.py');h=importlib.util.module_from_spec(s);s.loader.exec_module(h);print(h.pause_completion_observer_source())"],{cwd:root,encoding:'utf8'});
const context={setTimeout,clearTimeout,Date,DataView};vm.createContext(context);vm.runInContext(source+';globalThis.install=installPauseCompletion',context);
(async()=>{
 const binding={exe:0x10000,sdl:0x100000,index:0,generation:7,mappingState:2,keys:0x160000};
 async function setup(expected=20){
  const memory={buffer:new ArrayBuffer(0x180000)},v=new DataView(memory.buffer);let esp=0x170000,pc=0,clock=0,trace;
  const w=(p,x)=>v.setUint32(p,x,true),byte=(p,x)=>v.setUint8(p,x);
  w(32,binding.sdl);w(64,2);w(68,7);w(binding.exe+0x523b0,expected===20?8:20);
  const e={guest_to_wasm:p=>p,get_dll_table:()=>32,get_dll_lifecycle_table:()=>64,get_dll_lifecycle_stride:()=>16,get_image_base:()=>binding.exe,get_current_thread_id:()=>1,get_esp:()=>esp,get_eip:()=>pc,set_trace_eip_range:(...a)=>trace=a};
  const o=await context.install({e,memory,binding,token:'command-pause',expected,now:()=>clock});
  const hit=p=>{pc=p;o.boundary(p);};
  const key=(down)=>{esp=0x170000;w(esp,0x150000);w(esp+4,down);w(esp+8,0x171000);w(0x171004,112);hit(binding.sdl+0x19870);byte(binding.keys+112,down);esp+=4;hit(0x150000);};
  const enter=()=>{esp=0x170000;w(esp,0x150100);w(esp+4,112);hit(binding.exe+0x1e406);};
  const display=()=>{w(binding.exe+0x523b0,expected);hit(binding.exe+(expected===20?0x1e7b4:0x1e7ec));};
  const returned=()=>{esp=0x170004;hit(0x150100);};
  return {o,e,w,byte,hit,key,enter,display,returned,expire:()=>{clock=2000;hit(0);},trace:()=>trace};
 }
 for(const expected of [8,20]){
  const s=await setup(expected);s.key(1);assert(s.o.snapshot().active,'SDL delivery alone is incomplete');
  assert.deepEqual(s.trace(),[1,binding.exe+0x1e406,binding.exe+0x1e878]);s.enter();
  // More than the old 200001 boundaries in gray drawing do not reach JS:
  assert(binding.exe+0x26bb0>s.trace()[2]);
  s.display();assert(s.o.snapshot().active,'display return still needs handler/release completion');
  s.returned();assert(s.o.snapshot().active,'held SDL P is incomplete');s.key(0);
  assert.equal(s.o.snapshot().reason,'complete');assert(s.o.snapshot().records.some(r=>r.kind==='pause-handler-return'));
 }
 const queued=await setup();queued.key(1);queued.byte(binding.keys+112,0);queued.enter();queued.display();queued.returned();assert.equal(queued.o.snapshot().reason,'complete','release consumed before handler also supported');
 const early=await setup();early.key(1);early.enter();early.expire();assert.equal(early.o.snapshot().reason,'deadline');assert(!early.o.snapshot().records.some(r=>r.kind==='guest-complete'));
 const foreign=await setup();foreign.w(68,8);foreign.hit(0);assert.equal(foreign.o.snapshot().reason,'failure');
 const wrong=await setup();wrong.key(1);wrong.w(binding.exe+0x523b0,5);wrong.enter();assert.equal(wrong.o.snapshot().reason,'failure');
 console.log('PASS generated passive pause observer: SDL, original handler/display/return, release, bounded incomplete and binding failure');
})().catch(e=>{console.error(e);process.exitCode=1});
