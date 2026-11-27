#!/usr/bin/env node
// Public thunks and actual guest message removal; uses the shipped module.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=process.env.WA_TEST_ROOT||path.resolve(__dirname,'..');
const {createHostImports}=require(path.join(root,'lib/host-imports'));
const {installInputHandlers}=require(path.join(root,'lib/renderer-input'));
const apis=require(path.join(root,'src/api_table.json'));
const regions=require(path.join(root,'lib/region-map.generated'));
class Input {} installInputHandlers(Input);
(async()=>{
 const modulePath=process.env.WA_TEST_WASM||path.join(root,'build/wine-assembly.wasm');
 const moduleBytes=fs.readFileSync(modulePath);
 const wasm=modulePath.endsWith('.gz')?require('node:zlib').gunzipSync(moduleBytes):moduleBytes;
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),view=new DataView(memory.buffer);
 const renderer=new Input();Object.assign(renderer,{windows:{},inputQueue:[],_physicalKeys:{},_buttonHoldFloorMs:-1});
 const names=['PeekMessageA','GetMessageA','GetKeyState','GetKeyboardState','GetAsyncKeyState','keybd_event','SetKeyboardState','PostMessageA'];
 const image=0x400000,thunk=0x7500000,hwnd=0x10001;
 async function thread(tid){
  const localHwnd=hwnd+tid;
  const ctx={renderer,processId:71,getMemory:()=>memory.buffer,resourceJson:{menus:{},dialogs:{},strings:{},bitmaps:{}}};
  const imports=createHostImports(ctx);let last;
  Object.assign(imports.host,{memory,log(){},log_i32(){},get_tick_count(){return 1234;},
   check_input(){last=renderer.takeInput(e=>e.tid===undefined||e.tid===tid);return last?(last.wParam<<16)|last.msg:0;},
   check_input_hwnd(){return last?.hwnd||hwnd;},check_input_lparam(){return last?.lParam||0;},
   get_window_rect(h,p){[10,20,210,120].forEach((n,i)=>view.setInt32(p+i*4,n,true));}});
  const {instance}=await WebAssembly.instantiate(wasm,imports);const e=ctx.exports=instance.exports;
  e.init_thread(tid,image,image,0x600000,thunk,thunk+names.length*8,names.length,0);
  names.forEach((n,i)=>view.setUint32(regions.BASE.THUNK_BASE+i*8+4,apis.find(a=>a.name===n).id,true));
  e.set_hwnd_base(localHwnd+1);e.wnd_table_set(localHwnd,0x401000);e.wnd_set_style_export(localHwnd,0x10000000);
  const wa=g=>g-image+e.get_guest_base(),stack=0x510000+tid*0x1000,msg=0x520000+tid*0x1000,out=0x530000+tid*0x1000;
  [0x31,0xc0,0xc2,0x10,0].forEach((b,i)=>view.setUint8(wa(0x401000)+i,b));
  function invoke(name,args){const ix=names.indexOf(name);[0,...args].forEach((n,i)=>view.setUint32(wa(stack)+i*4,n,true));e.clear_yield();e.set_esp(stack);e.set_eip(thunk+ix*8);e.run(200);assert.equal(e.get_eip(),0,name+' sentinel');return e.get_eax()>>>0;}
  return {invoke,tid,e,wa,out,ctx,reset(){e.init_thread(tid,image,image,0x600000,thunk,thunk+names.length*8,names.length,0);},peek(remove,min=0,max=0){const ok=invoke('PeekMessageA',[msg,0,min,max,remove]);return ok?view.getUint32(wa(msg)+4,true):0;},get(){invoke('GetMessageA',[msg,0,0,0]);return view.getUint32(wa(msg)+4,true);},key(vk){return invoke('GetKeyState',[vk])&0x8000;},snapshot(){assert.equal(invoke('GetKeyboardState',[out]),1);return new Uint8Array(memory.buffer,wa(out),256).slice();},async(vk){return invoke('GetAsyncKeyState',[vk])&0x8001;}};
 }
 const a=await thread(0);a.e.heap_init(0x800000);
 const rows=[];function record(label,actual,expected){rows.push({label,actual,expected});console.log(JSON.stringify(rows.at(-1)));assert.deepEqual(actual,expected,label);}
 const raw=(vk,up,scan=0x1e,tid=0,system=false)=>renderer.inputQueue.push({type:'key',hwnd:hwnd+tid,tid,msg:(system?0x104:0x100)+(up?1:0),wParam:vk,lParam:(1|(scan<<16)|(up?0xc0000000:0))>>>0,asyncPressPublished:true});
 // Both physical edges happen while the guest is busy. These ordinary queue
 // entries deliberately have no synthetic-only keyStateSnapshot field.
 renderer.pokeKeyDownState(0x41,true,{code:'KeyA'});raw(0x41,false);
 renderer.pokeKeyDownState(0x41,false,{code:'KeyA'});raw(0x41,true);
 renderer._asyncPressedKeys={0x41:true}; // browser producer's independent press latch
 record('initial physical up',renderer.peekKeyDownState(0x41),0);
 record('initial synchronous up',a.key(0x41),0);
 record('PM_NOREMOVE sees down',a.peek(0),0x100);
 record('PM_NOREMOVE leaves synchronous state',a.key(0x41),0);
 record('PM_REMOVE sees down',a.peek(1),0x100);
 record('queued down GetKeyState',a.key(0x41),0x8000);
 record('queued down GetKeyboardState',a.snapshot()[0x41],0x80);
 record('async independent physical up and press latch',a.async(0x41),1);
 record('async press latch consumed once',a.async(0x41),0);
 record('PM_NOREMOVE sees release',a.peek(0),0x101);
 record('PM_NOREMOVE retains previous down',a.key(0x41),0x8000);
 record('GetMessage takes release',a.get(),0x101);
 record('release scalar/snapshot',[a.key(0x41),a.snapshot()[0x41]],[0,0]);
 // Real keybd_event public thunk creates snapshots at enqueue. A no-remove
 // peek must not expose that event before USER commits its removal.
 a.invoke('keybd_event',[0x42,0x30,0,0]);a.invoke('keybd_event',[0x42,0x30,2,0]);
 renderer.inputQueue.forEach(e=>{if(e.tid===undefined)e.tid=0;});
 record('synthetic PM_NOREMOVE',a.peek(0),0x100);
 record('synthetic no-remove scalar/snapshot',[a.key(0x42),a.snapshot()[0x42]],[0,0]);
 record('synthetic remove',a.peek(1),0x100);
 record('synthetic down',a.key(0x42),0x8000);
 const b=await thread(1);
 record('thread1 initial state',[b.key(0x42),b.snapshot()[0x42]],[0,0]);
 raw(0x43,false,0x2e,1);record('thread1 removes its own key',b.peek(1),0x100);
 record('thread0 state survives other dequeue',[a.key(0x42),a.snapshot()[0x42]],[0x8000,0x80]);
 record('thread0 cannot see thread1 key',a.key(0x43),0);
 record('thread0 release after other dequeue',a.get(),0x101);
 record('thread0 now up',a.key(0x42),0);
 // Control chord and system Alt chord through real removals; scan side state
 // must agree with generic modifier state and the other side stays up.
 for(const [vk,scan,side,system] of [[0x11,0x1d,0xa2,false],[0x10,0x36,0xa1,false],[0x12,0x38,0xa4,true]]){
  raw(vk,false,scan,0,system);raw(0x4b,false,0x25,0,system);raw(vk,true,scan,0,system);raw(0x4b,true,0x25,0,system);
  a.get();record('modifier scalar/snapshot '+vk,[a.key(vk),a.snapshot()[vk],a.key(side)],[0x8000,0x80,0x8000]);
  a.get();record('modifier retained on chord '+vk,a.key(vk),0x8000);
  a.get();record('modifier released '+vk,[a.key(vk),a.snapshot()[vk],a.key(side)],[0,0,0]);a.get();
 }

 // Opposite sides of the same modifier must remain independent.
 raw(0x11,false,0x1d);raw(0x11,false,0x11d);raw(0x11,true,0x1d);raw(0x11,true,0x11d);
 a.get();a.get();a.get();
 record('right Ctrl survives left release',[a.key(0x11),a.key(0xa2),a.key(0xa3)],[0x8000,0,0x8000]);
 a.get();record('both Ctrl sides released',[a.key(0x11),a.key(0xa3)],[0,0]);
 // PostMessage key-shaped payloads are not hardware keyboard transitions.
 a.invoke('PostMessageA',[hwnd,0x100,0x41,0x001e0001]);
 record('posted key retrieved',a.peek(1),0x100);
 record('posted key does not change state',a.key(0x41),0);
 // Another thread can take and route the host event into the real shared
 // guest queue. Only its owner commits the synchronous state on removal.
 renderer.inputQueue.push({type:'key',hwnd:hwnd+1,tid:0,msg:0x100,wParam:0x44,lParam:0x00200001,asyncPressPublished:true});
 a.peek(1);record('forwarding thread did not consume key',a.key(0x44),0);
 record('owner peeks forwarded hardware key',b.peek(0),0x100);
 record('forwarded no-remove leaves owner up',b.key(0x44),0);
 record('owner GetMessage removes forwarded key',b.get(),0x100);
 record('owner commits forwarded key',[b.key(0x44),b.snapshot()[0x44]],[0x8000,0x80]);
 record('forwarded key isolated from other thread',a.key(0x44),0);

 // A rejected PeekMessage filter cannot commit the cached transition.
 raw(0x46,false,0x21);
 record('filter rejects key',a.peek(1,0x200,0x200),0);
 record('filter leaves key up',a.key(0x46),0);
 record('unfiltered remove commits key',a.peek(1),0x100);
 record('unfiltered key down',a.key(0x46),0x8000);raw(0x46,true,0x21);a.get();
 // Cover all four bitmap words and their boundaries with real removals.
 for(const vk of [3,63,64,127,128,191,192,254]){
  raw(vk,false);raw(vk,true);a.get();
  record('key word boundary down '+vk,[a.key(vk),a.snapshot()[vk]],[0x8000,0x80]);
  a.get();record('key word boundary up '+vk,[a.key(vk),a.snapshot()[vk]],[0,0]);
 }
 // Explicit setter and queue state share the caller's synchronous table.
 new Uint8Array(memory.buffer,a.wa(a.out),256).fill(0);
 view.setUint8(a.wa(a.out)+0x45,0x80);
 record('SetKeyboardState succeeds',a.invoke('SetKeyboardState',[a.out]),1);
 record('setter scalar/snapshot',[a.key(0x45),a.snapshot()[0x45]],[0x8000,0x80]);
 record('setter leaves other thread state',[b.key(0x43),b.key(0x44)],[0x8000,0x8000]);
 a.reset();
 record('reused instance clears its keyboard state',[a.key(0x45),a.snapshot()[0x45]],[0,0]);
 record('reuse preserves other thread state',[b.key(0x43),b.key(0x44)],[0x8000,0x8000]);
 console.log('PASS public keyboard queue state, async latch, modifiers, two guest instances');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
