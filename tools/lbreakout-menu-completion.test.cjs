'use strict';
const assert=require('node:assert/strict'),cp=require('node:child_process'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=cp.execFileSync('python3',['-c',"import importlib.util;s=importlib.util.spec_from_file_location('h','tools/lbreakout-case-inspection.py');h=importlib.util.module_from_spec(s);s.loader.exec_module(h);print(h.menu_completion_observer_source())"],{cwd:root,encoding:'utf8'});
const context={setTimeout,clearTimeout,Date,DataView};vm.createContext(context);vm.runInContext(source+';globalThis.install=installMenuCompletion',context);
(async()=>{
 const binding={exe:0x10000,sdl:0x100000,index:0,generation:7,mappingState:2,keys:0x160000},reviewed={label:'main-menu',sha256:'a'.repeat(64)};
 async function setup(){
  const memory={buffer:new ArrayBuffer(0x190000)},v=new DataView(memory.buffer);let esp=0x180000,clock=0,eax=1;
  const w=(p,x)=>v.setUint32(p,x,true),byte=(p,x)=>v.setUint8(p,x);
  const before=0x140000,item=0x140100,target=0x140200,event=0x141000;
  w(32,binding.sdl);w(64,2);w(68,7);w(binding.exe+0x77150,before);w(before+28,item);w(item+4,6);w(item+72,target);
  const e={guest_to_wasm:p=>p,get_dll_table:()=>32,get_dll_lifecycle_table:()=>64,get_dll_lifecycle_stride:()=>16,get_image_base:()=>binding.exe,get_current_thread_id:()=>1,get_esp:()=>esp,get_eax:()=>eax,set_trace_eip_range:(f,lo,hi)=>assert(!f||hi===lo+1)};
  const o=await context.install({e,memory,binding,token:'enter-menu',expected:13,reviewed,now:()=>clock});
  const hit=rva=>o.boundary(binding.exe+rva);
  const key=down=>{esp=0x180000;w(esp,0x150000);w(esp+4,down);w(esp+8,0x142000);w(0x142004,13);o.boundary(binding.sdl+0x19870);byte(binding.keys+13,down);esp+=4;o.boundary(0x150000);};
  const poll=(symbol=13)=>{esp=0x180000;w(esp,event);byte(event,2);w(event+8,symbol);hit(0x105f6);};
  const handler=()=>{esp=0x180000;w(esp,binding.exe+0x107b2);w(esp+4,before);w(esp+8,event);hit(0xc36a);};
  const returned=(change=true)=>{if(change)w(binding.exe+0x77150,target);eax=0;esp=0x180004;hit(0x107b2);};
  const display=()=>{hit(0x26026);hit(0x10849);};
  return {o,e,w,byte,hit,key,poll,handler,returned,display,expire:()=>{clock=2000;hit(0);}};
 }
 for(const released of [false,true]){
  const s=await setup();s.key(1);s.poll(32);assert.equal(s.o.snapshot().phase,'poll-return');s.poll();s.handler();s.returned();
  s.hit(0x10849);assert(s.o.snapshot().active,'manager return alone lacks SDL display');
  if(released)s.byte(binding.keys+13,0);s.display();
  if(!released){assert(s.o.snapshot().active,'display requires release');s.key(0);}
  assert.equal(s.o.snapshot().reason,'complete');assert.equal(s.o.snapshot().reviewed.sha256,reviewed.sha256);
 }
 for(const mode of ['module','event','unchanged','poll-incomplete','display-incomplete']){
  const s=await setup();s.key(1);
  if(mode==='module'){s.w(68,8);s.poll();}
  else if(mode==='poll-incomplete')s.expire();
  else {s.poll();if(mode==='event')s.w(0x141008,32);s.handler();
   if(mode==='unchanged')s.returned(false);else if(mode==='display-incomplete'){s.returned();s.expire();}}
  // Event contents must remain bound through the actual handler entry.
  assert.equal(s.o.snapshot().reason,mode.endsWith('incomplete')?'deadline':'failure',mode);
  const saved=JSON.stringify(s.o.snapshot());s.display();s.key(0);assert.equal(JSON.stringify(s.o.snapshot()),saved,'sticky first failure');
 }
 console.log('PASS menu observer: queued Enter, original link/SDL display ordering, release, binding, deadline and sticky failure');
 await compiledHandler();
})().catch(e=>{console.error(e);process.exitCode=1});

async function compiledHandler(){
 // Isolated offline objects only. Original PE/DLL code performs all keyboard,
 // state and menu transitions. This control makes no native visual claim.
 const fs=require('node:fs'),crypto=require('node:crypto'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
 const {createHostImports}=require(root+'/lib/host-imports'),loader=require(root+'/lib/dll-loader');
 const bytes=fs.readFileSync(root+'/build/wine-assembly.wasm'),pe=fs.readFileSync(root+'/test/binaries/candidates/lbreakout2-251/game/LBREAKOUT/lbreakout2.exe'),dll=fs.readFileSync(root+'/test/binaries/candidates/lbreakout2-251/game/LBREAKOUT/SDL.dll');
 assert.equal(hash(pe),'cc1fd5c3d229cc1d4f910e658f5abefa80ef8ebf4b5e47801648f0be0e1ca244');assert.equal(hash(dll),'0b5aeef9054872cce11992679ad05a5bc96e5a4cfb515da8983e2e1f2ecbbbd8');
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),ctx={getMemory:()=>memory.buffer,renderer:null,resourceJson:{}};
 const module=await WebAssembly.compile(bytes),imports=createHostImports(ctx);imports.host.memory=memory;
 for(const x of WebAssembly.Module.imports(module))if(x.kind==='function'&&!imports.host[x.name])imports.host[x.name]=()=>{throw Error('unexpected import '+x.name)};
 const e=(await WebAssembly.instantiate(module,imports)).exports;ctx.exports=e;
 const b=new Uint8Array(memory.buffer),v=new DataView(memory.buffer),wa=p=>e.guest_to_wasm(p)>>>0,w=(p,n)=>v.setUint32(wa(p),n>>>0,true),u=p=>v.getUint32(wa(p),true);
 b.set(pe,e.get_staging());assert(e.load_pe(pe.length));const base=loader.loadDll(e,memory.buffer,dll,'C:\\fixture\\SDL.dll').loadAddr;
 loader.patchExeImports(e,memory.buffer,pe,[{name:'SDL.dll'}]);const stack=e.guest_alloc(65536)+65520;
 const call=(pc,args=[])=>{
  e.set_esp(stack);e.call_func(pc,...Array.from({length:4},(_,i)=>args[i]||0));const entry=e.get_esp()>>>0;
  if(args.length>4)w(entry+20,args[4]);
  for(let n=0;n<20000&&e.get_eip();n++){e.run(100);assert.equal(e.get_yield_reason(),0);}
  assert.equal(e.get_eip(),0,'bounded original return');assert.equal(e.get_esp()>>>0,entry+4);return e.get_eax()>>>0;
 };
 call(base+0x10c20);const keys=call(base+0x19810),event=e.guest_alloc(64),before=e.guest_alloc(64),target=e.guest_alloc(64),item=e.guest_alloc(128);
 // Suppress sound through the original disabled flag, with no code patches.
 w(0x452484,0);w(0x477150,before);w(before+28,item);w(item+4,6);w(item+72,target);
 const key=down=>call(base+0x10a10,[0,0x10001,down?0x100:0x101,13,down?0x001c0001:0xc01c0001]);
 key(true);key(false);assert.equal(b[wa(keys+13)],0,'released before polling');
 // An isolated SDL_KeyboardEvent, matching PollEvent's original event layout.
 // Queue/presentation ordering is exercised above by the boundary control.
 b[wa(event)]=3;w(event+8,13);
 assert.equal(call(0x40c36a,[before,event]),0);assert.equal(u(0x477150),before,'original keyup cannot activate link');
 b[wa(event)]=2;w(event+8,32);
 assert.equal(call(0x40c36a,[before,event]),0);assert.equal(u(0x477150),before,'original other key cannot activate link');
 w(event+8,13);
 assert.equal(call(0x40c36a,[before,event]),0);assert.equal(u(0x477150),target,'original Enter selected submenu');
 assert.equal(u(before+28),0);assert.equal(u(target+28),0);
 console.log(JSON.stringify({passed:true,scope:'original compiled SDL delivery and menu Enter handler, isolated event/menu objects',module:hash(bytes),exe:hash(pe),sdl:hash(dll),balancedPulseReleased:true,originalSubmenuTransition:true}));
}
