'use strict';
// Authored public USER consumer. Its main thread changes from an ordinary
// unfiltered pump to a window/range-filtered pump; its actual CPUWorker keeps
// pumping an empty independent queue. No game bytes, private state or clocks.
const assert=require('node:assert/strict');
function fixture({filter='window',remove=1}={}) {
 const b=require('./test-cli-native-button-delivery.cjs').fixture(0);
 const raw=r=>r-0x1000+0x400,u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
 // Extend the existing authored image's USER import table.
 b.writeUInt32LE(0x1d00,raw(0x1334));b.writeUInt32LE(0,raw(0x1338));
 b.write('PeekMessageA\0',raw(0x1d02));
 function asm(rva,work) {
  const a=[],labels=new Map(),fix=[];const emit=(...x)=>a.push(...x),push=n=>emit(0x68,...u32(n));
  const call=p=>emit(0xff,0x15,...u32(p)),label=n=>labels.set(n,a.length);
  const jump=(n,c)=>{emit(...(c?[0x0f,c]:[0xe9]));fix.push([a.length,n]);emit(0,0,0,0);};
  work({emit,push,call,label,jump});const out=Buffer.from(a);
  for(const [o,n]of fix){assert(labels.has(n));out.writeInt32LE(labels.get(n)-o-4,o);}
  assert(out.length<0x400);b.fill(0,raw(rva),raw(rva+0x400));out.copy(b,raw(rva));
 }
 asm(0x2c00,({emit,push,call,label,jump})=>{
  label('pump');emit(0x83,0x3d,...u32(0x403630),0);jump('filtered',0x85);
  for(const n of [1,0,0,0,0x403640])push(n);jump('peek');
  label('filtered');push(remove);push(filter==='range'?0x209:0);push(filter==='range'?0x200:0);
  if(filter==='window')emit(0xff,0x35,...u32(0x403600));else push(0);
  push(0x403640);
  label('peek');call(0x401334);emit(0x85,0xc0);jump('empty',0x84);
  // PM_NOREMOVE is followed by removing the same message before dispatch.
  if(remove===0){
   for(const n of [1,0,0,0,0x403640])push(n);call(0x401334);
  }
  emit(0x81,0x3d,...u32(0x403644),...u32(0x12));jump('exit',0x84);
  push(0x403640);call(0x401310);push(0x403640);call(0x401314);
  label('empty');push(5);call(0x401204);jump('pump');
  label('exit');push(0);call(0x401200);emit(0xcc);
 });
 // Prefix the real wndproc with a WM_APP transition. Relocate its original
 // body intact; its internal relative branches keep their destinations.
 b.copy(b,raw(0x3a00),raw(0x2400),raw(0x2800));
 // The old body only references fixed data and relative internal labels.
 asm(0x2400,({emit,push,call,label,jump})=>{
  emit(0x81,0x7c,0x24,8,...u32(0x8000));jump('old',0x85);
  emit(0xc7,0x05,...u32(0x403630),...u32(1),0x31,0xc0,0xc2,16,0);
  label('old');emit(0xb8,...u32(0x403a00),0xff,0xe0);
 });
 asm(0x2800,({push,call,label,jump})=>{
  label('pump');for(const n of [1,0,0,0,0x4036a0])push(n);call(0x401334);
  push(5);call(0x401204);jump('pump');
 });
 return b;
}
async function units() {
 const fs=require('node:fs'),{createHostImports}=require('../lib/host-imports');
 const {Win98Renderer}=require('../lib/renderer'),{createCanvas}=require('../lib/raster-canvas');
 const regions=require('../lib/region-map.generated'),apis=require('../src/api_table.json');
 const r=new Win98Renderer(createCanvas(640,480)),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const dv=new DataView(memory.buffer);let now=0,last=null;
 Object.assign(r,{windows:{},inputQueue:[],_inputNowMs:()=>now,_buttonHoldFloorMs:-1,
  _coordinatePressHoverMs:30,_publishInputQueueDepth(){},_applyModifierSides(){},_wakeMessageWait(){}});
 const ctx={getMemory:()=>memory.buffer,renderer:r,resourceJson:{menus:{},dialogs:{},strings:{},bitmaps:{}}};
 const imports=createHostImports(ctx);Object.assign(imports.host,{memory,log(){},log_i32(){},
  check_input(){last=r.takeInput();return last?(last.wParam<<16)|last.msg:0;},
  check_input_hwnd(){return last.hwnd;},check_input_lparam(){return last.lParam;}});
 const bytes=fs.readFileSync('build/wine-assembly.wasm');
 const {instance}=await WebAssembly.instantiate(bytes,imports),e=ctx.exports=instance.exports;
 const image=0x400000,thunk=0x7500000,msg=0x520000,stack=0x510000,h=0x10001,proc=0x401000,record=0x530000;
 const names=['PeekMessageA','GetMessageA','DispatchMessageA'];
 e.init_thread(0,image,image,0x600000,thunk,thunk+names.length*8,names.length,0);
 const wa=p=>e.guest_to_wasm(p)>>>0;
 names.forEach((name,i)=>dv.setUint32(regions.BASE.THUNK_BASE+i*8+4,apis.find(a=>a.name===name).id,true));
 // Executable x86 callback records actual MSG processing, rather than counting
 // a host dequeue or DispatchMessage's redirection as a callback return.
 const u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
 new Uint8Array(memory.buffer).set([0xff,0x05,...u32(record),0x8b,0x44,0x24,8,0xa3,...u32(record+4),0x31,0xc0,0xc2,16,0],wa(proc));
 e.set_hwnd_base(h+1);e.wnd_table_set(h,proc);e.wnd_set_style_export(h,0x10000000);
 r.wasm=instance;r.wasmMemory=memory;
 const win={hwnd:h,visible:true,wasm:instance,wasmMemory:memory};r.windows[h]=win;
 let transcript=null;
 function call(name,args) {
  [0,...args].forEach((n,i)=>dv.setUint32(wa(stack)+i*4,n>>>0,true));
  e.clear_yield();e.set_esp(stack);e.set_eip(thunk+names.indexOf(name)*8);
  e.run(1000);
  const result={result:e.get_eax(),yield:e.get_yield_reason(),eip:e.get_eip(),
   message:[0,4,8,12].map(off=>dv.getUint32(wa(msg)+off,true))};
  transcript?.push({name,args,result});return result;
 }
 const peek=(hwnd=0,min=0,max=0,remove=1)=>call('PeekMessageA',[msg,hwnd,min,max,remove]);
 const dispatch=()=>{const before=dv.getUint32(wa(record),true);const got=call('DispatchMessageA',[msg]);
  assert.equal(got.eip,0);assert.equal(dv.getUint32(wa(record),true),before+1);};
 const edge=(id)=>({hwnd:h,msg:id,wParam:id===0x201?1:0,lParam:0x0014000a,mouseX:10,mouseY:20});
 const checks=[],parity=new Map();
 for(const enabled of [false,true])for(const filter of ['window','range'])for(const remove of [0,1]) {
  e.set_user_pump_observation?.(enabled?4096:0);
  now=0;r._pointerMoves={};r.inputQueue.length=0;
  for(let i=0;;i++){const v=peek();if(!v.result)break;assert(i<32,JSON.stringify(v));}
  assert(win._nativeInputPumpCompletion);
  transcript=[];
  r.inputQueue.push(edge(0x200),edge(0x84),edge(0x201));
  const take=()=>filter==='window'?peek(h,0,0,remove):peek(0,0x84,0x209,remove);
  for(const id of [0x200,0x84]) {
   assert.equal(take().message[1],id);
   if(!remove){assert.equal(take().message[1],id);assert.equal(peek(h).message[1],id);}
   dispatch();assert.equal(dv.getUint32(wa(record+4),true),id);
  }
  now=100;const empty=take();assert.equal(empty.result,0);assert(!r._pointerMoves[h].polled);
  if(enabled){
   assert.equal(e.get_user_pump_observation(1),2);
   assert.equal(e.get_user_pump_observation(4),filter==='window'?h:0);
   assert.equal(e.get_user_pump_observation(5),filter==='range'?0x84:0);
   assert.equal(e.get_user_pump_observation(6),filter==='range'?0x209:0);
   assert.equal(e.get_user_pump_observation(7),remove);
   assert.equal(e.get_user_pump_observation(10),e.get_user_pump_observation(0));
   assert.equal(e.get_user_pump_observation(12),1);assert.equal(e.get_user_pump_observation(13),0);
  }
  e.set_current_thread_id(4);assert.equal(peek().result,0);e.set_current_thread_id(1);
  assert(!r._pointerMoves[h].polled,'sibling empty cannot finish target hover');
  assert.equal(r.inputQueue[0].msg,0x201,'filtered exhaustion retains exact DOWN');
  assert.equal(peek().result,0);assert(r._pointerMoves[h].polled);
  assert.equal(peek().message[1],0x201);dispatch();assert(!r._pointerMoves[h].pending);
  const result={filter,remove,actualMoveAndHitDispatch:true,filteredRefusal:true,siblingRefusal:true,ordinaryTransition:true,
   publicTranscript:transcript};transcript=null;
  if(enabled)assert.deepEqual(result,parity.get(filter+remove));else parity.set(filter+remove,result);
  checks.push({enabled,...result});
 }
 // An excluded message stays native-owned even after an unfiltered query;
 // PM_NOREMOVE cannot manufacture exhaustion or discard that message.
 r._pointerMoves={};r.inputQueue.push(edge(0x200));
 assert.equal(peek(h,0x400,0x400).result,0);
 assert.equal(peek(0,0,0,0).message[1],0x200);
 assert.equal(peek(0,0,0,0).message[1],0x200);
 assert.equal(peek().message[1],0x200);dispatch();assert.equal(peek().result,0);
 const get=call('GetMessageA',[msg,h,0,0]);assert.equal(get.yield,7);
 assert.equal(e.get_user_pump_observation(11),1);assert.equal(e.get_user_pump_observation(12),2);
 assert.equal(e.get_user_pump_observation(14),7,'actual parked wait identity');
 // A real x86 wndproc nests another filtered PeekMessage. Its nested native
 // handler return must keep its own ID, not become Dispatch callback proof.
 new Uint8Array(memory.buffer).set([
  0xff,0x05,...u32(record),...([0,0x400,0x400,0,msg+128].flatMap(n=>[0x68,...u32(n)])),
  0xb8,...u32(thunk),0xff,0xd0,0x31,0xc0,0xc2,16,0],wa(proc));
 e.invalidate_code_range(proc,128);
 r.inputQueue.push(edge(0x200));assert.equal(peek().message[1],0x200);dispatch();
 assert.equal(e.get_user_pump_observation(11),2,'nested Peek has separate completed API identity');
 assert.equal(e.get_user_pump_observation(19),0x200,'actual Dispatch MSG retained across nested call');
 assert(e.get_user_pump_observation(10)>e.get_user_pump_observation(20),'nested call belongs after dispatch entry');
 e.set_user_pump_observation(3);const beforeBudget=e.get_user_pump_observation(0);
 for(let i=0;i<10;i++)peek(h,0x400,0x400);
 assert.equal(e.get_user_pump_observation(0),beforeBudget+3,'native observation work exhausts its hard cap');
 e.set_user_pump_observation(0);
 const costs=[];
 for(let i=0;i<5;i++){
  const sample={};
  for(const enabled of [false,true]){
   e.set_user_pump_observation(enabled?4096:0);const start=performance.now();
   for(let n=0;n<2000;n++)peek(h,0x400,0x400);
   sample[enabled?'onUs':'offUs']=(performance.now()-start)*1000/2000;
  }
  costs.push(sample);
 }
 assert(costs.every(v=>v.onUs-v.offUs<50),'native diagnostic added cost below50us per public API');
 e.set_user_pump_observation(0);
 // Native hover lifetime guards, with actual generation and owner exports.
 for(const mode of ['wrongthread','wrongmemory','generation','retire','replacement','hidden']) {
  const move={window:win,nativePump:true,pending:true,polled:false,generation:e.wnd_lookup_generation(h)};
  r._pointerMoves[h]=move;win.visible=true;delete win._lookupProcess;
  if(mode==='generation')move.generation+=1n;
  if(mode==='retire')win._lookupProcess={exited:true};
  if(mode==='replacement')move.window={...win};
  if(mode==='hidden')win.visible=false;
  r.nativeInputPumpIdle(mode==='wrongmemory'?new ArrayBuffer(8):memory.buffer,mode==='wrongthread'?4:1);
  assert(!move.polled,mode);checks.push({negative:mode,refused:true});
 }
 clearTimeout(r._buttonHoldTimer);
 return {pass:true,moduleSHA256:require('node:crypto').createHash('sha256').update(bytes).digest('hex'),checks,
  filteredGetMessageWait:get.yield,filteredOutMessageRetained:true,actualCallbackReturn:true,
  nestedCallbackIdentity:true,nativeBudgetCap:3,costs};
}
module.exports={fixture,units};
if(require.main===module) {
 const path=require('node:path');
 if(process.argv[2]==='--unit')units().then(v=>console.log(JSON.stringify(v,null,2))).catch(e=>{console.error(e.stack);process.exitCode=1;});
 else require('../tools/disciples2-public-pump-fixture.cjs').native(path.resolve(process.argv[2]),
  {trace:true,cancel:true,hoverFixture:JSON.parse(process.argv[3]||'{}')})
  .catch(e=>{console.error(e.stack);process.exitCode=1;});
}
