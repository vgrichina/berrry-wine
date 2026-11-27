#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');
const { bootRenderHarness } = require('./render-helper');
const apiTable = require('../src/api_table.json');

// Independent 256-byte physical/down-state oracle; low press bits are separate.
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getkeyboardstate
const physical = Buffer.from([
  '80800000000000008080000000000000','80808080800000000000008000000000',
  '80000000000000000000000000000000','80000000000000000000000000000000',
  '00800000000000000000000000000000','00000000000000000000800000000000',
  '80000000000000000000000000000080','00000000000000000000000000000080',
  '80000000000000000000000000000000','80800000000000000000000000000000',
  '80808080808000000000000000000000','00000000000000000000808080808080',
  '80000000000000000000000000000000','00000000000000000000008080808000',
  '00000000000000000000000000000000','00000000000000000000000000008080',
].join(''),'hex');
const down = [0,1,8,9,16,17,18,19,20,27,32,48,65,90,96,111,127,128,144,145,
  160,161,162,163,164,165,186,187,188,189,190,191,192,219,220,221,222,254,255];
const byteValues = Buffer.from([
  '000102030405060708090a0b0c0d0e0f','101112131415161718191a1b1c1d1e1f',
  '202122232425262728292a2b2c2d2e2f','303132333435363738393a3b3c3d3e3f',
  '404142434445464748494a4b4c4d4e4f','505152535455565758595a5b5c5d5e5f',
  '606162636465666768696a6b6c6d6e6f','707172737475767778797a7b7c7d7e7f',
  '808182838485868788898a8b8c8d8e8f','909192939495969798999a9b9c9d9e9f',
  'a0a1a2a3a4a5a6a7a8a9aaabacadaeaf','b0b1b2b3b4b5b6b7b8b9babbbcbdbebf',
  'c0c1c2c3c4c5c6c7c8c9cacbcccdcecf','d0d1d2d3d4d5d6d7d8d9dadbdcdddedf',
  'e0e1e2e3e4e5e6e7e8e9eaebecedeeef','f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff',
].join(''),'hex');
const extraWat = String.raw`
 (func (export "ks_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base)
   (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE)))) (call $update_thunk_end))
 (func (export "ks_module") (param $p i32) (result i32)
  (call $handle_GetModuleHandleA (local.get $p) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "ks_resolve") (param $m i32) (param $p i32) (result i32)
  (call $handle_GetProcAddress (local.get $m) (local.get $p) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "ks_regs") (result i32) (global.get $reg_base))
 (func (export "ks_live") (result i32)
  (i32.sub (global.get $heap_stat_allocs) (global.get $heap_stat_frees)))
 (func (export "ks_seed_free") (param $base i32) (result i32)
  (local $rec i32) (local $block i32)
  (local.set $rec (call $heap_arena_register (local.get $base) (i32.add (local.get $base) (i32.const 8192))))
  (if (i32.eqz (local.get $rec)) (then (unreachable)))
  (local.set $block (i32.add (local.get $base) (i32.const 3968)))
  (call $gs32 (local.get $block) (i32.const 520))
  (i32.atomic.store offset=8 (local.get $rec) (i32.add (local.get $block) (i32.const 520)))
  (call $heap_arena_charge (local.get $rec) (i32.const 520))
  (global.set $heap_stat_allocs (i32.add (global.get $heap_stat_allocs) (i32.const 1)))
  (call $heap_free (i32.add (local.get $block) (i32.const 4)))
  (i32.add (local.get $block) (i32.const 4)))
 (func (export "ks_call") (param $thunk i32)
  (call $win32_dispatch (i32.shr_u
   (i32.sub (local.get $thunk) (global.get $thunk_guest_base)) (i32.const 3))))
`;
const digest = b => crypto.createHash('sha256').update(b).digest('hex');
// No keyboard input has been removed in this mapping fixture. Keyboard high
// bits therefore remain up in this thread, regardless of the host snapshot.
// Mouse bytes and every low bit still exercise the exact host/scatter path.
const syncByte = (value, vk) => [1,2,4,5,6].includes(vk) ? value : value & 0x7f;
const syncKeys = bytes => Buffer.from(bytes.map(syncByte));
function prepare(h, tid, initializeHeap) {
 const e=h.exports;
 e.init_thread(tid,0x400000,0,0,0,0,0);
 if(initializeHeap)e.heap_init(0x800000);
 e.ks_init();e.set_api_log(0);
 const mem=new Uint8Array(h.memory.buffer),view=new DataView(h.memory.buffer);
 const wa=p=>e.guest_to_wasm(p)>>>0,alloc=n=>{const p=e.guest_alloc(n)>>>0;assert.ok(p);return p;};
 const bytes=(p,n)=>mem.subarray(wa(p),wa(p)+n);
 const stackArea=alloc(256),stack=stackArea+64,regs=e.ks_regs()>>>0;
 const text=s=>{const p=alloc(s.length+1);bytes(p,s.length+1).set(Buffer.from(s+'\0'));return p;};
 view.setUint32(regs+16,stack,true);const user32=e.ks_module(text('USER32.DLL'))>>>0;assert.ok(user32);
 view.setUint32(regs+16,stack,true);const thunk=e.ks_resolve(user32,text('GetKeyboardState'))>>>0;
 const api=apiTable.find(a=>a.name==='GetKeyboardState');assert.ok(thunk);assert.equal(api.nargs,1);
 assert.equal(view.getUint32(wa(thunk)+4,true),api.id,'public resolver thunk ID');
 return {e,mem,view,wa,alloc,bytes,stackArea,stack,regs,thunk};
}
function call(h,p) {
 const {e,view,regs,stack,thunk}=h;
 view.setUint32(regs+16,stack,true);e.guest_write32(stack,0x12345678);e.guest_write32(stack+4,p);
 e.ks_call(thunk);return view.getUint32(regs,true);
}
async function main(prebuiltModule=null) {
 assert.equal(physical.length,256);assert.equal(byteValues.length,256);
 const table=new Uint16Array(256);for(let i=0;i<256;i++)table[i]=(i*37&0x7ffe)|1;
 for(const vk of down)table[vk]|=0x8000;
 const original=Buffer.from(table.buffer);
 let hostCalls=0,peeks=0,scalar=0,consuming=0,mode='physical',nested=null,h,originalPeek,originalAsyncPeek,originalAsync,currentOutput=null;
 const pointers=[],events=[],peekOrder=[];
 const harness=await bootRenderHarness({...(prebuiltModule?{prebuiltModule}:{extraWat}),fonts:'none',width:16,height:16,
  beforeInstantiate(ctx,host){
   originalPeek=ctx.renderer.peekKeyDownState;originalAsyncPeek=ctx.renderer.peekAsyncKeyState;
   originalAsync=ctx.renderer.getAsyncKeyState;
   ctx.renderer.peekKeyDownState=ctx.renderer.peekAsyncKeyState=vk=>{peeks++;peekOrder.push(vk);return table[vk&255];};
   ctx.renderer.getAsyncKeyState=()=>{consuming++;throw Error('consuming snapshot');};
   host.get_key_down_state=()=>{scalar++;throw Error('scalar snapshot');};
   const snapshot=host.get_keyboard_state;
   host.get_keyboard_state=p=>{
    hostCalls++;pointers.push(p>>>0);events.push('enter');
    const out=new Uint8Array(ctx.getMemory(),p>>>0,256);
    if(currentOutput!==null){
     for(let i=0;i<256;i++)assert.equal(h.e.guest_read8(currentOutput+i),0xa5,'destination untouched until snapshot returns');
     assert.ok(out.every(v=>v===0xa5),'host span initialized from destination for failure compatibility');
    }
    let result;
    if(mode==='physical')result=snapshot(p);
    else if(mode==='fail-clean')result=0;
    else if(mode==='fail-partial'){out.set([0x12,0x34,0x56]);result=0;}
    else {out.set(mode==='zero'?Buffer.alloc(256):mode==='ones'?Buffer.alloc(256,255):byteValues);result=7;}
    if(nested){const action=nested;nested=null;action(p>>>0);}
    events.push('leave');return result;
   };
  }});
 h=prepare(harness,1,true);
 const {e,mem,view,wa,alloc,bytes,regs,stackArea,stack}=h;
 const direct=alloc(12288),unrelated=alloc(256),inner=alloc(256);
 const base=0x30000000,decoy=0x28000000,contiguous=0x31000000;
 for(const p of [base,decoy,base+4096])assert.equal(e.test_virtual_map_commit(p,4096)>>>0,p);
 assert.equal(e.test_virtual_map_commit(contiguous,8192)>>>0,contiguous);
 const backing=[base,decoy,base+4096].map(wa);
 assert.equal(backing[1],backing[0]+4096);assert.notEqual(backing[2],backing[0]+4096);
 assert.equal(wa(contiguous+4096),wa(contiguous)+4096);
 const spans=[[wa(direct),12288],...backing.map(p=>[p,4096]),[wa(contiguous),8192]];
 const other=()=>[e.get_eip(),e.get_handler_set_eip(),e.test_get_last_error(),e.get_flag_op(),
  e.get_flag_a(),e.get_flag_b(),e.get_flag_res(),e.get_flag_sign_shift(),e.get_capture_hwnd(),
  e.get_cursor(),e.get_cursor_display_count(),e.get_current_thread_id(),e.get_yield_reason(),
  e.get_yield_flag(),e.get_quit_flag(),e.guest_span_cursor_bytes(),e.guest_span_overflow_count()];
 const failures=[];let calls=0,splitCalls=0,controls=0;
 function check(p,label,split=false){
  for(const [at,n]of spans)mem.fill(0xa5,at,at+n);
  bytes(stackArea,256).fill(0xcc);bytes(unrelated,256).fill(0x6b);
  const expected=spans.map(([at,n])=>Buffer.from(mem.subarray(at,at+n)));
  const hostWant=mode==='physical'?physical:mode==='zero'?Buffer.alloc(256):mode==='ones'?Buffer.alloc(256,255):
   mode==='fail-clean'?Buffer.alloc(256,0xa5):mode==='fail-partial'?Buffer.concat([Buffer.from([0x12,0x34,0x56]),Buffer.alloc(253,0xa5)]):byteValues;
  const want=mode.startsWith('fail')?hostWant:syncKeys(hostWant);
  for(let i=0;i<256;i++){const at=wa(p+i),j=spans.findIndex(([start,n])=>at>=start&&at<start+n);assert.ok(j>=0);expected[j][at-spans[j][0]]=want[i];}
  for(let i=0;i<8;i++)view.setUint32(regs+i*4,0x41320000+i,true);
  view.setUint32(regs+16,stack,true);e.guest_write32(stack,0x12345678);e.guest_write32(stack+4,p);
  const state=other(),frame=Buffer.from(bytes(stackArea,256)),before=hostCalls,peekBefore=peeks,live=e.ks_live();
  currentOutput=p;e.ks_call(h.thunk);currentOutput=null;
  assert.equal(view.getUint32(regs,true),mode.startsWith('fail')?0:mode==='physical'?1:7,label+' BOOL');
  assert.equal(view.getUint32(regs+16,true),stack+8,label+' ESP');
  for(const i of [1,2,3,5,6,7])assert.equal(view.getUint32(regs+i*4,true),0x41320000+i,label+' register');
  assert.deepEqual(other(),state,label+' state');assert.deepEqual(Buffer.from(bytes(stackArea,256)),frame,label+' frame');
  assert.ok(bytes(unrelated,256).every(v=>v===0x6b));assert.equal(e.ks_live(),live,label+' allocation balanced');
  assert.equal(hostCalls-before,1,label+' exactly one snapshot');assert.equal(peeks-peekBefore,mode==='physical'?256:0);
  if(mode==='physical')assert.deepEqual(peekOrder.splice(0),Array.from({length:256},(_,i)=>i),label+' host snapshot key order');
  assert.equal(scalar,0);assert.equal(consuming,0);assert.deepEqual(Buffer.from(table.buffer),original);
  const actual=Buffer.from(Array.from({length:256},(_,i)=>e.guest_read8(p+i)));
  const changed=spans.flatMap(([at,n],i)=>Buffer.from(mem.subarray(at,at+n)).equals(expected[i])?[]:[i]);
  if(!actual.equals(want)||changed.length)failures.push({label,split,actual:digest(actual),expected:digest(want),changed,
   wrongBytes:Array.from({length:256},(_,i)=>actual[i]===want[i]?null:{offset:i,actual:actual[i],expected:want[i]}).filter(Boolean).slice(0,16)});
  calls++;if(split)splitCalls++;else controls++;
 }
 for(mode of ['physical','values','zero','ones','fail-clean','fail-partial'])for(let repeat=0;repeat<2;repeat++){
  check(direct+33,mode+' direct '+repeat);
  for(const split of [1,127,255])check(contiguous+4096-split,mode+' contiguous '+split);
  for(let split=0;split<=256;split++)check(base+4096-split,mode+' split='+split+' repeat='+repeat,split>0&&split<256);
 }
 console.log(JSON.stringify({phase:'mapping',calls,splitCalls,controls,controlFailures:failures.filter(f=>!f.split).length,
  failures:failures.length,first:failures.slice(0,3),backing}));
 assert.equal(failures.filter(f=>!f.split).length,0,'all contiguous/page-boundary controls pass');
 assert.equal(failures.length,0,'public USER32 snapshot bytes and full backing canaries');
 // NULL retains the pre-existing g2w(0) host route, with no Windows pointer claim.
 const nullPointer=wa(0);
 mode='physical';let before=hostCalls;assert.equal(call(h,0),1);assert.equal(hostCalls-before,1);
 assert.equal(pointers.at(-1),nullPointer);assert.deepEqual(Buffer.from(mem.subarray(nullPointer,nullPointer+256)),syncKeys(physical));
 for(mode of ['fail-clean','fail-partial','values']){
  mem.fill(0x5b,nullPointer,nullPointer+256);before=hostCalls;
  assert.equal(call(h,0),mode==='values'?7:0);assert.equal(hostCalls-before,1);assert.equal(pointers.at(-1),nullPointer);
  // The existing miss translator zeroes the sentinel's first DWORD before
  // handing it to the host. Read physical bytes without translating again.
  const want=mode==='values'?syncKeys(byteValues):Buffer.concat([
   mode==='fail-clean'?Buffer.alloc(4):Buffer.from([0x12,0x34,0x56,0]),Buffer.alloc(252,0x5b)]);
  assert.deepEqual(Buffer.from(mem.subarray(nullPointer,nullPointer+256)),want,'NULL preserves existing host BOOL and partial writes');
 }
 // Reenter the same instance while its completed allocation is live in the host.
 const live=e.ks_live();let outerPointer,innerPointer;
 mode='values';nested=p=>{
  outerPointer=p;const output=Buffer.from(mem.subarray(p,p+256));
  const saved=Buffer.from(mem.subarray(regs,regs+32)),frame=Buffer.from(bytes(stackArea,256));
  assert.equal(e.ks_live(),live+1,'outer allocation live during RPC');
  mode='ones';assert.equal(call(h,inner),7);innerPointer=pointers.at(-1);mode='values';
  mem.set(saved,regs);bytes(stackArea,256).set(frame);
  assert.equal(e.ks_live(),live+1,'nested allocation freed, outer retained');
  assert.deepEqual(Buffer.from(mem.subarray(p,p+256)),output,'nested call preserves outer host snapshot');
 };
 events.length=0;before=hostCalls;assert.equal(call(h,direct),7);assert.equal(hostCalls-before,2);
 assert.deepEqual(events,['enter','enter','leave','leave']);
 assert.notEqual(outerPointer,innerPointer,'distinct LIVE same-instance buffers');
 assert.equal(outerPointer&255,0);assert.equal(innerPointer&255,0);
 assert.equal(outerPointer>>>12,(outerPointer+255)>>>12);
 assert.equal(e.ks_live(),live);assert.deepEqual(Buffer.from(bytes(direct,256)),syncKeys(byteValues));
 assert.deepEqual(Buffer.from(bytes(inner,256)),syncKeys(Buffer.alloc(256,255)));
 const reused=new Set();for(let i=0;i<64;i++){assert.equal(call(h,direct),7);reused.add(pointers.at(-1));assert.equal(e.ks_live(),live);}
 assert.ok(reused.size<=2,'freed staging allocations reused');
 // A real allocator free-list block itself straddles separately backed pages.
 // Alignment must put the entire host span on its second guest page.
 const stageBase=0x32000000,stageDecoy=0x29000000;
 for(const p of [stageBase,stageDecoy,stageBase+4096])assert.equal(e.test_virtual_map_commit(p,4096)>>>0,p);
 const stageBacking=[stageBase,stageDecoy,stageBase+4096].map(wa);
 assert.notEqual(stageBacking[2],stageBacking[0]+4096);
 const stageCanary=Buffer.from(mem.subarray(stageBacking[1],stageBacking[1]+4096));
 const seeded=e.ks_seed_free(stageBase)>>>0;assert.equal(seeded,stageBase+3972);
 const stageLive=e.ks_live();assert.equal(call(h,direct),7);
 assert.equal(pointers.at(-1),wa(stageBase+4096),'sparse staging aligns into second backing page');
 assert.deepEqual(Buffer.from(bytes(direct,256)),syncKeys(byteValues));assert.equal(e.ks_live(),stageLive);
 assert.deepEqual(Buffer.from(mem.subarray(stageBacking[1],stageBacking[1]+4096)),stageCanary,'sparse staging preserves complete decoy');
 // The production host catches a renderer exception after writing a prefix.
 mode='physical';harness.renderer.peekKeyDownState=vk=>{if(vk===3)throw Error('controlled key lookup failure');return table[vk];};
 bytes(direct,256).fill(0x5b);before=hostCalls;assert.equal(call(h,direct),0);assert.equal(hostCalls-before,1);
 assert.deepEqual(Buffer.from(bytes(direct,256)),Buffer.concat([Buffer.from([128,128,0]),Buffer.alloc(253,0x5b)]),'real host partial failure preserves old destination suffix');
 // Exercise the production physical table, stale message table and async latch.
 const r=harness.renderer;r.peekKeyDownState=originalPeek;r.peekAsyncKeyState=originalAsyncPeek;r.getAsyncKeyState=originalAsync;
 r._physicalKeys={65:false,66:true};r._asyncKeys={65:true,66:false};r._asyncPressedKeys={65:true,66:true};
 const savedInput=JSON.stringify([r._physicalKeys,r._asyncKeys,r._asyncPressedKeys,r.inputQueue]);
 mode='physical';for(let i=0;i<3;i++){
  assert.equal(call(h,direct),1);assert.equal(e.guest_read8(direct+65),0);assert.equal(e.guest_read8(direct+66),0);
  assert.equal(JSON.stringify([r._physicalKeys,r._asyncKeys,r._asyncPressedKeys,r.inputQueue]),savedInput,'snapshot preserves physical/message/latch/input state');
 }
 assert.equal(r.getAsyncKeyState(65)&1,1,'released async press still present after snapshots');
 assert.equal(r.getAsyncKeyState(65)&1,0,'async low press bit consumes only on async query');
 r._activeInputEvent={keyStateSnapshot:new Uint32Array([0,0,2,0,0,0,0,0])};
 assert.equal(call(h,direct),1);assert.equal(e.guest_read8(direct+65),0);assert.equal(e.guest_read8(direct+66),0,'renderer event cannot replace this thread\'s queue state');
 r._activeInputEvent=null;
 await concurrent(harness.module,harness.memory);
 await allocationFailure();
 console.log('PASS GetKeyboardState all 255 splits, 256 bytes, full backing, ABI, BOOL/failure, nonconsumption, reentry and concurrent live staging');
}

async function allocationFailure(){
 // Deterministic allocation-failure injection exercises this handler's OOM
 // branch without claiming that the process heap has actually been exhausted.
 const { compileSrcWasm }=require('./compile-src');let injected=0;
 const bytes=compileSrcWasm((file,source)=>{
  if(file==='13-exports.wat')return source+extraWat;
  if(file!=='09a-handlers3-sync.wat')return source;
  const start=source.indexOf('(func $handle_GetKeyboardState'),end=source.indexOf(';; SetKeyboardState',start);
  const handler=source.slice(start,end),needle='(call $heap_alloc (i32.const 511))';
  assert.equal(handler.split(needle).length,2,'exactly one staging allocation');injected++;
  return source.slice(0,start)+handler.replace(needle,'(i32.const 0)')+source.slice(end);
 });assert.equal(injected,1);
 let snapshots=0;
 const harness=await bootRenderHarness({prebuiltModule:new WebAssembly.Module(bytes),fonts:'none',width:16,height:16,
  extraHostOverrides:{get_keyboard_state:()=>{snapshots++;throw Error('OOM must not call host');}}});
 const h=prepare(harness,1,true),p=h.alloc(256);h.bytes(p,256).fill(0x5b);const live=h.e.ks_live();
 assert.equal(call(h,p),0,'OOM returns failure');assert.equal(h.e.test_get_last_error(),8,'OOM ERROR_NOT_ENOUGH_MEMORY');
 assert.equal(h.e.get_esp()>>>0,h.stack+8);assert.equal(snapshots,0);assert.equal(h.e.ks_live(),live);
 assert.ok(h.bytes(p,256).every(v=>v===0x5b),'OOM preserves destination');
 console.log('PASS injected staging-allocation failure: BOOL/error/ESP/no RPC/no output mutation');
}

async function concurrent(module,memory){
 const sync=new SharedArrayBuffer(16*4),state=new Int32Array(sync);
 const workers=[0,1].map(index=>new Worker(__filename,{workerData:{module,memory,sync,index},stdout:true,stderr:true}));
 const results=await Promise.all(workers.map(w=>new Promise((resolve,reject)=>{
  let message,stderr='';w.stdout.resume();w.stderr.on('data',b=>stderr+=b);w.on('message',m=>message=m);
  w.once('error',reject);w.once('exit',code=>code===0&&message?resolve(message):reject(Error('concurrent worker '+code+' '+stderr)));
 })));
 assert.equal(Atomics.load(state,0),2,'both host snapshots overlapped');
 assert.notEqual(results[0].pointer,results[1].pointer,'distinct LIVE shared-memory separate-instance staging');
 for(const r of results){assert.equal(r.calls,1);assert.equal(r.pointer&255,0);assert.equal(r.pointer>>>12,(r.pointer+255)>>>12);assert.equal(r.balanced,true);}
 console.log(JSON.stringify({concurrentWorkers:results}));
}
async function worker(){
 const {module,memory,sync,index}=workerData,state=new Int32Array(sync);
 let calls=0,pointer;
 const h=await bootRenderHarness({prebuiltModule:module,memory,fonts:'none',width:16,height:16,
  extraHostOverrides:{get_keyboard_state:p=>{
   calls++;pointer=p>>>0;new Uint8Array(memory.buffer,pointer,256).fill(index?0xd7:0x39);
   Atomics.store(state,2+index,pointer);Atomics.add(state,0,1);Atomics.notify(state,0);
   const deadline=Date.now()+15000;
   while(Atomics.load(state,0)<2){assert.ok(Date.now()<deadline,'finite overlap wait');Atomics.wait(state,0,1,100);}
   assert.notEqual(Atomics.load(state,2),Atomics.load(state,3));
   assert.ok(new Uint8Array(memory.buffer,pointer,256).every(v=>v===(index?0xd7:0x39)),'other live host RPC preserves snapshot');
   return 1;
  }}});
 const s=prepare(h,index+2,false),out=s.alloc(256),live=s.e.ks_live();
 assert.equal(call(s,out),1);assert.ok(s.bytes(out,256).every((v,vk)=>v===syncByte(index?0xd7:0x39,vk)));
 parentPort.postMessage({pointer,calls,balanced:s.e.ks_live()===live});
}
if(require.main===module)(isMainThread?main():worker()).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={main,extraWat,physical,byteValues};
