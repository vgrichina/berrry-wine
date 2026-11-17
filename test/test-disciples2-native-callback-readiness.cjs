'use strict';
// Authored executable only. Return counters are instructions AFTER the real
// DispatchMessage call; wndproc entry or a later Peek cannot increment them.
const assert=require('node:assert/strict');
const RECORD=0x404100;
function fixture({remove=1,nonempty=true,nested=false}={}) {
 const b=require('./test-disciples2-native-hover-pump.cjs').fixture({filter:'none',remove});
 const raw=r=>r-0x1000+0x400,u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
 b.writeUInt32LE(0x1e00,raw(0x1338));b.writeUInt32LE(0,raw(0x133c));
 b.write('GetCursorPos\0',raw(0x1e02));
 function asm(rva,work) {
  const a=[],labels=new Map(),fix=[];
  const emit=(...x)=>a.push(...x),push=n=>emit(0x68,...u32(n)),call=p=>emit(0xff,0x15,...u32(p));
  const label=n=>labels.set(n,a.length),jump=(n,c)=>{emit(...(c?[0x0f,c]:[0xe9]));fix.push([a.length,n]);emit(0,0,0,0);};
  work({emit,push,call,label,jump});const out=Buffer.from(a);
  for(const [o,n]of fix){assert(labels.has(n));out.writeInt32LE(labels.get(n)-o-4,o);}
  assert(out.length<0x400);b.fill(0,raw(rva),raw(rva+0x400));out.copy(b,raw(rva));
 }
 asm(0x2c00,({emit,push,call,label,jump})=>{
  // WM_APP starts the timer only after the normal startup pump has exhausted.
  label('pump');emit(0x83,0x3d,...u32(0x403630),0);jump('query',0x84);
  if(nonempty){
   emit(0x83,0x3d,...u32(RECORD+4),0);jump('armed',0x85);
   for(const n of [0,1,17])push(n);emit(0xff,0x35,...u32(0x403600));call(0x401324);
   emit(0xc7,0x05,...u32(RECORD+4),...u32(1));label('armed');
   // Sleep uses scheduler time even with --real-ticks. Pace from the public
   // real GetTickCount API instead, without changing its source or rate.
   call(0x40120c);emit(0x89,0xc3);label('due');call(0x40120c);
   emit(0x29,0xd8,0x3d,...u32(20));jump('due',0x82);
  }
  label('query');for(const n of [remove,0,0,0,0x403640])push(n);call(0x401334);
  emit(0x85,0xc0);jump('empty',0x84);
  if(!remove){for(const n of [1,0,0,0,0x403640])push(n);call(0x401334);}
  emit(0x81,0x3d,...u32(0x403644),...u32(0x12));jump('exit',0x84);
  // Save the public MSG and pre-call stack in invocation-local stack words.
  emit(0xff,0x35,...u32(0x403644),0x54);push(0x403640);call(0x401314);
  // Actual x86 caller continuation: balanced ESP, returned message counters.
  emit(0x58,0x39,0xe0);jump('badstack',0x85);emit(0x58,0x89,0xc1,0x81,0xe1,...u32(0x3ff));
  emit(0xff,0x04,0x8d,...u32(RECORD+0x100));jump('pump');
  label('badstack');emit(0xff,0x05,...u32(RECORD+12));jump('pump');
  label('empty');emit(0xff,0x05,...u32(RECORD+8));
  // An ordinary drain-then-sample consumer: its hover state advances only
  // after its unfiltered pump has returned no message, outside the wndproc.
  push(RECORD+24);call(0x401338);emit(0xff,0x05,...u32(RECORD+20));
  push(5);call(0x401204);jump('pump');
  label('exit');push(0);call(0x401200);emit(0xcc);
 });
 asm(0x2400,({emit,push,call,label,jump})=>{
  emit(0x55,0x89,0xe5,0xff,0x05,...u32(RECORD));
  emit(0x81,0x7d,12,...u32(0x8000));jump('old',0x85);
  emit(0xc7,0x05,...u32(0x403630),...u32(1));jump('zero');
  label('old');
  if(nested){for(const n of [1,0x400,0x400,0,0x4036c0])push(n);call(0x401334);}
  // Call the original authored wndproc and preserve its result across leave.
  for(const n of [20,16,12,8])emit(0xff,0x75,n);
  emit(0xb8,...u32(0x403a00),0xff,0xd0);jump('done');
  label('zero');emit(0x31,0xc0);
  label('done');emit(0xff,0x0d,...u32(RECORD),0xc9,0xc2,16,0);
 });
 asm(0x2800,({emit,push,call,label,jump})=>{
  label('pump');for(const n of [1,0,0,0,0x4036a0])push(n);call(0x401334);
  emit(0xff,0x05,...u32(RECORD+16));push(5);call(0x401204);jump('pump');
 });
 return b;
}
// This reads only the authored fixture's own post-return telemetry. It never
// mutates runtime state or supplies an input acknowledgement.
function observationCode() {
 return `(()=>{const e=instance.exports,h=e.get_main_hwnd(),w=renderer.windows[h],p=e.guest_to_wasm(${RECORD})>>>0,d=new DataView(memory.buffer);return {owner:e.get_window_thread(h),generation:String(e.wnd_lookup_generation(h)),hwnd:h,sameMemory:w.wasmMemory===memory,visible:w.visible,retired:!!w._lookupProcess?.exited,depth:d.getUint32(p,true),timerArmed:d.getUint32(p+4,true),empty:d.getUint32(p+8,true),badStack:d.getUint32(p+12,true),siblingPeeks:d.getUint32(p+16,true),consumerSamples:d.getUint32(p+20,true),samplePoint:[d.getInt32(p+24,true),d.getInt32(p+28,true)],returns:Object.fromEntries([0x200,0x84,0x20,0x113].map(m=>[m,d.getUint32(p+0x100+4*m,true)])),hover:renderer._pointerMoves?.[h]?{pending:renderer._pointerMoves[h].pending,polled:renderer._pointerMoves[h].polled,nativePump:renderer._pointerMoves[h].nativePump}:null}})()`;
}
async function units() {
 const fs=require('node:fs'),{createHostImports}=require('../lib/host-imports');
 const {Win98Renderer}=require('../lib/renderer'),{createCanvas}=require('../lib/raster-canvas');
 const regions=require('../lib/region-map.generated'),apis=require('../src/api_table.json');
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),dv=new DataView(memory.buffer);
 const r=new Win98Renderer(createCanvas(640,480));let last=null,now=0;
 Object.assign(r,{windows:{},inputQueue:[],_inputNowMs:()=>now,_buttonHoldFloorMs:-1,
  _coordinatePressHoverMs:30,_publishInputQueueDepth(){},_applyModifierSides(){},_wakeMessageWait(){}});
 const ctx={getMemory:()=>memory.buffer,renderer:r,resourceJson:{menus:{},dialogs:{},strings:{},bitmaps:{}}};
 const imports=createHostImports(ctx);Object.assign(imports.host,{memory,log(){},log_i32(){},
  check_input(){last=r.takeInput();return last?(last.wParam<<16)|last.msg:0;},
  check_input_hwnd(){return last.hwnd;},check_input_lparam(){return last.lParam;}});
 const bytes=fs.readFileSync('build/wine-assembly.wasm');
 const {instance}=await WebAssembly.instantiate(bytes,imports),e=ctx.exports=instance.exports;
 const thunk=0x7500000,stack=0x510000,msg=0x520000,proc=0x401000,caller=0x402000,rec=0x530000,h=0x10001;
 const names=['PeekMessageA','DispatchMessageA'];
 e.init_thread(0,0x400000,0x400000,0x600000,thunk,thunk+16,2,0);
 const wa=p=>e.guest_to_wasm(p)>>>0,read=p=>dv.getUint32(wa(p),true),write=(p,n)=>dv.setUint32(wa(p),n,true);
 names.forEach((name,i)=>dv.setUint32(regions.BASE.THUNK_BASE+i*8+4,apis.find(a=>a.name===name).id,true));
 e.set_hwnd_base(h+1);e.wnd_table_set(h,proc);e.wnd_set_style_export(h,0x10000000);
 const win={hwnd:h,visible:true,wasm:instance,wasmMemory:memory};r.windows[h]=win;r.wasm=instance;r.wasmMemory=memory;
 const u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24],push=n=>[0x68,...u32(n)];
 // Every wndproc invocation makes a real nested filtered Peek. The outer
 // invocation also Dispatches an inner cursor callback, with separate stack
 // return sites. None of these filtered queries can complete the owner pump.
 const code=[0xff,0x05,...u32(rec),
  ...[1,0x400,0x400,0,msg+128].flatMap(push),0xb8,...u32(thunk),0xff,0xd0,
  0x83,0x3d,...u32(rec),1,0x75,18,
  ...push(msg+64),0xb8,...u32(thunk+8),0xff,0xd0,0xff,0x05,...u32(rec+4),
  0xff,0x0d,...u32(rec),0xb8,...u32(42),0xc2,16,0];
 new Uint8Array(memory.buffer).set(code,wa(proc));
 new Uint8Array(memory.buffer).set([...push(msg),0xb8,...u32(thunk+8),0xff,0xd0,
  0xa3,...u32(rec+12),0xff,0x05,...u32(rec+8),0xc3],wa(caller));
 for(const [off,value]of [[0,h],[4,0x20],[8,0],[12,0]])write(msg+64+off,value);
 function peek(){[0,msg,0,0,0,1].forEach((v,i)=>write(stack+4*i,v));e.clear_yield();e.set_esp(stack);e.set_eip(thunk);e.run(1000);return e.get_eax();}
 while(peek()){}assert(win._nativeInputPumpCompletion);
 const checks=[],parity=[];
 for(const enabled of [false,true]) {
  e.set_user_pump_observation(enabled?4096:0);r._pointerMoves={};
  for(let n=0;peek();n++)assert(n<32,'drain existing native paint before each independent case');
  now=0;
  for(let i=0;i<4;i++)write(rec+4*i,0);
  const move={hwnd:h,msg:0x200,wParam:0,lParam:1,mouseX:10,mouseY:20};
  const down={...move,msg:0x201,wParam:1};r.inputQueue.push(move,down);
  assert.equal(peek(),1);assert.equal(read(msg+4),0x200);
  write(stack,0);e.clear_yield();e.set_esp(stack);e.set_eip(caller);
  let maxDepth=0,sawInnerReturn=false,steps=0;
  do {
   e.run(1);maxDepth=Math.max(maxDepth,read(rec));
   if(read(rec)>0)assert.equal(read(rec+8),0,'live callback cannot claim caller return');
   if(read(rec+4)&&read(rec)===1){sawInnerReturn=true;assert.equal(read(rec+8),0);}
   assert(++steps<1000,'bounded actual x86 callback execution');
  }while(e.get_eip()!==0);
  assert.equal(maxDepth,2);assert(sawInnerReturn);assert.equal(read(rec),0);
  assert.equal(read(rec+4),1);assert.equal(read(rec+8),1);assert.equal(read(rec+12),42);
  assert.equal(e.get_esp(),stack+4);assert(!r._pointerMoves[h].polled);
  assert.equal(r.inputQueue[0],down,'exact original DOWN retained across nested returns');
  // Actual nonempty native posted timer retrieval and returned callback still
  // cannot prove exhaustion. Then the real empty owner query permits DOWN.
  assert.equal(e.post_message_q(h,0x113,17,0),1);now=100;
  assert.equal(peek(),1);assert.equal(read(msg+4),0x113);assert(!r._pointerMoves[h].polled);
  write(stack,0);e.clear_yield();e.set_esp(stack);e.set_eip(caller);
  for(let n=0;e.get_eip()!==0;n++){assert(n<1000);e.run(1);}
  assert.equal(read(rec+8),2,'timer Dispatch also reached its actual caller');
  assert.equal(read(rec),0);assert(!r._pointerMoves[h].polled);
  e.set_current_thread_id(4);assert.equal(peek(),0);e.set_current_thread_id(1);
  assert(!r._pointerMoves[h].polled);const empty=peek();assert.equal(empty,0,JSON.stringify({enabled,message:read(msg+4),move:r._pointerMoves[h].polled}));assert(r._pointerMoves[h].polled);
  assert.equal(peek(),1);assert.equal(read(msg+4),0x201);assert(!r._pointerMoves[h].pending);
  const result={maxDepth,sawInnerReturn,returned:read(rec+8),result:read(rec+12),stack:e.get_esp(),exactDown:true};
  parity.push(result);checks.push({enabled,...result});
 }
 assert.deepEqual(parity[0],parity[1]);
 // A returned callback cannot carry readiness across destruction/reuse into
 // an actual new native owner or generation, even in the same WASM memory.
 const generation=e.wnd_lookup_generation(h),oldMove={window:win,nativePump:true,pending:true,polled:false,generation};
 r._pointerMoves[h]=oldMove;e.destroy_dialog_frame(h);e.set_current_thread_id(4);
 e.wnd_table_set(h,proc);e.wnd_set_style_export(h,0x10000000);r.windows[h]=win;
 assert.equal(e.get_window_thread(h),4);assert.notEqual(e.wnd_lookup_generation(h),generation);
 r.nativeInputPumpIdle(memory.buffer,1);assert(!oldMove.polled,'old owner refused');
 r.nativeInputPumpIdle(memory.buffer,4);assert(!oldMove.polled,'reused generation refused');
 const fresh={...oldMove,generation:e.wnd_lookup_generation(h)};r._pointerMoves[h]=fresh;
 r.nativeInputPumpIdle(memory.buffer,4);assert(fresh.polled,'fresh exact native lifetime admitted');
 checks.push({nativeOwnerChange:true,nativeGenerationReuse:true,oldMoveRefused:true,newLifetimeAdmitted:true});
 clearTimeout(r._buttonHoldTimer);
 return {pass:true,moduleSHA256:require('node:crypto').createHash('sha256').update(bytes).digest('hex'),checks};
}
module.exports={fixture,observationCode,units};
if(require.main===module) {
 const fail=e=>{console.error(e.stack);process.exitCode=1;};
 if(process.argv[2]==='--unit')units().then(v=>console.log(JSON.stringify(v,null,2))).catch(fail);
 else {
  const options=JSON.parse(process.argv[3]||'{}'),{trace=true,...callbackFixture}=options;
  require('../tools/disciples2-public-pump-fixture.cjs').native(require('node:path').resolve(process.argv[2]),
   {trace,cancel:callbackFixture.nonempty!==false,callbackFixture}).catch(fail);
 }
}
