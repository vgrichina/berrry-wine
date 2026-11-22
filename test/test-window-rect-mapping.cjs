#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {bootRenderHarness}=require('./render-helper');
const table=require('../src/api_table.json');
// RECT is four signed LONGs in left, top, right, bottom order.
// Literal independent sixteen-byte oracles, never generated from guest output.
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getwindowrect
// https://learn.microsoft.com/en-us/windows/win32/api/windef/ns-windef-rect
const literals={positive:'1f0000002f0000000c010000ba000000',negative:'e1ffffffd1ffffffce0000005c000000',child:'26000000380000005b00000055000000',desktop:'000000000000000080020000e0010000'};
const extraWat=String.raw`
 (func (export "rect_mapping_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base) (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "rect_mapping_module") (param $p i32) (result i32)
  (call $handle_GetModuleHandleA (local.get $p) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "rect_mapping_resolve") (param $m i32) (param $p i32) (result i32)
  (call $handle_GetProcAddress (local.get $m) (local.get $p) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "rect_mapping_id") (param $p i32) (result i32) (call $lookup_api_id (call $g2w (local.get $p))))
 (func (export "rect_mapping_regs") (result i32) (global.get $reg_base))
 (func (export "rect_mapping_call") (param $p i32)
  (call $win32_dispatch (i32.shr_u (i32.sub (local.get $p) (global.get $thunk_guest_base)) (i32.const 3))))
 (func (export "rect_mapping_error") (param $v i32) (global.set $last_error (local.get $v)))
 (func (export "rect_mapping_register") (param $wc i32) (param $name i32)
  (call $gs32 (i32.add (local.get $wc) (i32.const 4)) (global.get $WNDPROC_BUILTIN))
  (call $gs32 (i32.add (local.get $wc) (i32.const 36)) (local.get $name))
  (call $handle_RegisterClassA (local.get $wc) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
 (func (export "rect_mapping_create") (param $cls i32) (param $style i32) (param $x i32) (param $y i32) (param $w i32) (param $h i32) (param $parent i32) (param $sp i32) (result i32)
  (i32.store offset=16 (global.get $reg_base) (local.get $sp))
  (call $gs32 (local.get $sp) (i32.const 0))
  (call $gs32 (i32.add (local.get $sp) (i32.const 24)) (local.get $y))
  (call $gs32 (i32.add (local.get $sp) (i32.const 28)) (local.get $w))
  (call $gs32 (i32.add (local.get $sp) (i32.const 32)) (local.get $h))
  (call $gs32 (i32.add (local.get $sp) (i32.const 36)) (local.get $parent))
  (call $gs32 (i32.add (local.get $sp) (i32.const 40)) (i32.const 0))
  (call $gs32 (i32.add (local.get $sp) (i32.const 44)) (global.get $image_base))
  (call $gs32 (i32.add (local.get $sp) (i32.const 48)) (i32.const 0))
  (call $handle_CreateWindowExA (i32.const 0) (local.get $cls) (i32.const 0) (local.get $style) (local.get $x) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "rect_mapping_move") (param $h i32)
  (drop (call $move_window_core (local.get $h) (i32.const 0) (i32.const -31) (i32.const -47) (i32.const 237) (i32.const 139) (i32.const 0x1c) (i32.const 0))))
 (func (export "rect_mapping_remove") (param $h i32)
  (call $handle_DestroyWindow (local.get $h) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
`+['saved_cf','guest_span_cursor','windowpos_depth'].map(n=>`(func (export "rect_mapping_${n}") (result i32) (global.get $${n}))`).join('\n');

async function main(){
 let h,nested=null,depth=0,geometryReentries=0;const hostCalls=[],live=[];
 h=await bootRenderHarness({extraWat,fonts:'none',beforeInstantiate(ctx,host){
  const original=host.get_window_rect;
  host.get_window_rect=(hwnd,p)=>{
   const call={hwnd:hwnd>>>0,p:p>>>0,depth};hostCalls.push(call);live.push(call);depth++;
   try {original(hwnd,p);if(nested&&depth===1)nested(call);}
   finally{depth--;live.pop();}
  };
 }});
 const {exports:e,memory,renderer,hostCtx}=h;
 e.init_thread(1,0x400000,0,0,0,0,0);e.heap_init(0x800000);e.rect_mapping_init();e.set_api_log(0);
 const mem=new Uint8Array(memory.buffer),view=new DataView(memory.buffer),wa=p=>e.guest_to_wasm(p)>>>0,alloc=n=>{const p=e.guest_alloc(n)>>>0;assert.ok(p);return p;};
 const regs=e.rect_mapping_regs()>>>0,stackArea=alloc(512),stack=stackArea+128,direct=alloc(128),unrelated=alloc(256);
 const bytes=(p,n)=>mem.subarray(wa(p),wa(p)+n),text=s=>{const p=alloc(s.length+1);bytes(p,s.length+1).set(Buffer.from(s+'\0'));return p;};
 view.setUint32(regs+16,stack,true);
 const user32=e.rect_mapping_module(text('USER32.DLL'))>>>0;assert.ok(user32);
 const name=text('GetWindowRect'),row=table.find(r=>r.name==='GetWindowRect');assert.equal(row.nargs,2);assert.equal(e.rect_mapping_id(name),row.id);
 view.setUint32(regs+16,stack,true);const thunk=e.rect_mapping_resolve(user32,name)>>>0;assert.ok(thunk);assert.equal(view.getUint32(wa(thunk)+4,true),row.id);
 const cls=text('RectMapping'),wc=alloc(40);bytes(wc,40).fill(0);e.rect_mapping_register(wc,cls);assert.ok(e.get_eax());
 const top=e.rect_mapping_create(cls,0x10000000,31,47,237,139,0,stack)>>>0;assert.ok(top);
 const child=e.rect_mapping_create(cls,0x50000000,7,9,53,29,top,stack)>>>0;assert.ok(child);
 const negative=e.rect_mapping_create(cls,0x10000000,31,47,237,139,0,stack)>>>0;assert.ok(negative);e.rect_mapping_move(negative);
 // A renderer-owned window is a separate existing valid-handle domain.
 const foreign=0x70001;renderer.windows[foreign]={x:-31,y:-47,w:237,h:139,isChild:false};
 const realExports=hostCtx.exports;
 hostCtx.exports={...realExports,wnd_window_screen_x:(...args)=>{geometryReentries++;return realExports.wnd_window_screen_x(...args);}};
 // Two adjacent guest pages deliberately separated by a physical decoy page.
 const base=0x30000000,decoy=0x28000000,contiguous=0x31000000;
 for(const p of [base,decoy,base+4096])assert.equal(e.test_virtual_map_commit(p,4096)>>>0,p);
 assert.equal(e.test_virtual_map_commit(contiguous,8192)>>>0,contiguous);
 const backing=[wa(base),wa(decoy),wa(base+4096)];assert.equal(backing[1],backing[0]+4096);assert.notEqual(backing[2],backing[0]+4096);assert.equal(wa(contiguous+4096),wa(contiguous)+4096);
 const spans=[[wa(direct),128],...backing.map(p=>[p,4096]),[wa(contiguous),8192],[wa(unrelated),256]];
 const seed=()=>{for(const [p,n] of spans)mem.fill(0xa5,p,p+n);};
 const snap=()=>spans.map(([p,n])=>Buffer.from(mem.subarray(p,p+n)));
 const failures=[];let calls=0,splitChecks=0,controlChecks=0;
 function equal(a,b,label,mapping){if(Buffer.isBuffer(a)){const describe=v=>v.length<=16?v.toString('hex'):crypto.createHash('sha256').update(v).digest('hex');a=describe(a);b=describe(b);}if(JSON.stringify(a)!==JSON.stringify(b))failures.push({label,mapping,actual:a,expected:b});if(mapping==='split')splitChecks++;else controlChecks++;}
 const state=()=>[e.get_flag_op(),e.get_flag_a(),e.get_flag_b(),e.get_flag_res(),e.get_flag_sign_shift(),e.get_capture_hwnd(),e.get_cursor(),e.get_cursor_display_count(),e.get_current_thread_id(),e.get_yield_reason(),e.get_yield_flag(),e.get_quit_flag(),e.rect_mapping_saved_cf(),e.rect_mapping_guest_span_cursor(),e.rect_mapping_windowpos_depth()];
 function invoke(hwnd,p,valid=true,oom=false){
  bytes(stackArea,512).fill(0xcc);for(let i=0;i<8;i++)view.setUint32(regs+4*i,0x41320000+i,true);
  view.setUint32(regs+16,stack,true);view.setUint32(wa(stack),0x12345678,true);view.setUint32(wa(stack)+4,hwnd,true);view.setUint32(wa(stack)+8,p,true);
  e.rect_mapping_error(0x5b);const beforeStack=Buffer.from(bytes(stackArea,512)),beforeState=state(),eip=e.get_eip(),handler=e.get_handler_set_eip(),beforeCalls=hostCalls.length;
  e.rect_mapping_call(thunk);calls++;
  assert.equal(e.get_eax(),valid&&!oom?1:0,'BOOL');assert.equal(view.getUint32(regs+16,true),stack+12,'stdcall ESP');
  for(const i of [1,2,3,5,6,7])assert.equal(view.getUint32(regs+i*4,true),0x41320000+i,'register '+i);
  assert.deepEqual(Buffer.from(bytes(stackArea,512)),beforeStack,'complete stack frame');assert.deepEqual(state(),beforeState,'flags/thread/capture/cursor/yield');assert.equal(e.get_eip(),eip);assert.equal(e.get_handler_set_eip(),handler);assert.equal(e.test_get_last_error(),valid?(oom?8:0x5b):1400);
  assert.equal(hostCalls.slice(beforeCalls).filter(c=>c.depth===0).length,valid&&!oom?1:0,'one handler host call or early exit (child geometry may reenter)');
 }
 function query(hwnd,p,hex,label,mapping,valid=true){
  seed();const before=snap(),expected=before.map(b=>Buffer.from(b));const want=hex&&Buffer.from(hex,'hex');
  if(valid)for(let i=0;i<16;i++){const physical=wa(p+i),j=spans.findIndex(([s,n])=>physical>=s&&physical<s+n);assert.ok(j>=0);expected[j][physical-spans[j][0]]=want[i];}
  invoke(hwnd,p,valid);
  if(valid)equal(Buffer.from(Array.from({length:16},(_,i)=>mem[wa(p+i)])),want,label+' literal16bytes',mapping);
  snap().forEach((b,i)=>equal(b,expected[i],label+' complete backing/canary '+i,mapping));
 }
 const cases=[[top,literals.positive,'top'],[negative,literals.negative,'negative'],[child,literals.child,'child'],[0x10000,literals.desktop,'desktop'],[foreign,literals.negative,'renderer-owned']];
 for(let repeat=0;repeat<2;repeat++)for(const [hwnd,hex,label] of cases){
  query(hwnd,direct+16,hex,label+' direct '+repeat,'control');
  for(let n=1;n<=15;n++){
   query(hwnd,contiguous+4096-n,hex,label+' adjacent '+n+' '+repeat,'control');
   query(hwnd,base+4096-n,hex,label+' split '+n+' '+repeat,'split');
  }
 }
 for(const invalid of [0,0xdeadbeef,0xffffffff])for(const p of [direct+16,base+4091])query(invalid,p,null,'invalid '+invalid,'control',false);
 e.rect_mapping_remove(negative);query(negative,base+4091,null,'destroyed','control',false);
 assert.ok(geometryReentries>0,'real host child geometry reenters Wasm exports');
 const controlFailures=failures.filter(f=>f.mapping!=='split');
 console.log(JSON.stringify({phase:'mapping',calls,splitChecks,controlChecks,geometryReentries,failures:failures.slice(0,12),failureCount:failures.length,controlFailureCount:controlFailures.length}));
 assert.equal(controlFailures.length,0,'all contiguous and negative controls pass');
 assert.equal(failures.length,0,'split outputs and complete backing must match independent literal oracle');
 // Invocation-owned staging: inspect live allocator accounting and keep an
 // outer result live across a nested public USER32 call through the real host.
 const nestedOut=alloc(32),nestedStack=alloc(128),beforeStats=[e.heap_stat(0),e.heap_stat(1)];
 let nestedCalls=0;
 nested=outer=>{
  assert.equal(outer.p&15,0,'host stage aligned16');assert.ok((outer.p&4095)<=4080,'stage inside one physical page');
  const outerBytes=Buffer.from(mem.subarray(outer.p,outer.p+16)),savedRegs=Buffer.from(mem.subarray(regs,regs+32));
  const activeStats=[e.heap_stat(0),e.heap_stat(1)];assert.equal(activeStats[0]-activeStats[1],beforeStats[0]-beforeStats[1]+1n,'outer allocation remains live');
  view.setUint32(regs+16,nestedStack,true);view.setUint32(wa(nestedStack),0x24681357,true);view.setUint32(wa(nestedStack)+4,foreign,true);view.setUint32(wa(nestedStack)+8,nestedOut,true);
  try{e.rect_mapping_call(thunk);assert.equal(e.get_eax(),1);assert.equal(e.get_esp()>>>0,nestedStack+12);assert.equal(live.length,1);const inner=hostCalls.at(-1);assert.equal(inner.depth,1);assert.notEqual(inner.p,outer.p,'distinct live invocation stages');assert.ok(inner.p+16<=outer.p||outer.p+16<=inner.p,'live stages disjoint');assert.deepEqual(Buffer.from(bytes(nestedOut,16)),Buffer.from(literals.negative,'hex'));assert.deepEqual(Buffer.from(mem.subarray(outer.p,outer.p+16)),outerBytes,'nested query preserves outer stage');nestedCalls++;}
  finally{mem.set(savedRegs,regs);}
 };
 seed();const start=hostCalls.length;view.setUint32(regs+16,stack,true);view.setUint32(wa(stack),0x12345678,true);view.setUint32(wa(stack)+4,child,true);view.setUint32(wa(stack)+8,base+4091,true);
 e.rect_mapping_call(thunk);nested=null;assert.equal(e.get_eax(),1);assert.equal(hostCalls.slice(start).filter(c=>c.hwnd===child||c.hwnd===foreign).length,2);assert.equal(nestedCalls,1);assert.deepEqual(Buffer.from(Array.from({length:16},(_,i)=>mem[wa(base+4091+i)])),Buffer.from(literals.child,'hex'));
 const afterStats=[e.heap_stat(0),e.heap_stat(1)];assert.equal(afterStats[0]-beforeStats[0],2n);assert.equal(afterStats[1]-beforeStats[1],2n,'both invocation allocations freed');
 e.guest_free(nestedOut);e.guest_free(nestedStack);hostCtx.exports=realExports;
 // Exhaust the actual allocator without replacing it or changing its globals.
 // Large requests drain backing; page and small requests consume remaining
 // low-arena space, tails and recycled small blocks. All loops are bounded.
 const exhausted=[];
 for(const [size,limit] of [[8<<20,128],[4096,32768],[31,32768]]){
  let count=0,failed=false;for(;count<limit;count++){if(!(e.guest_alloc(size)>>>0)){failed=true;break;}}
  assert.ok(failed,'bounded real allocator exhaustion for size '+size);exhausted.push({size,count});
 }
 assert.equal(e.guest_alloc(31)>>>0,0,'31-byte staging allocation really fails');
 seed();const oomBefore=snap(),beforeOOMCalls=hostCalls.length;
 invoke(top,base+4091,true,true);
 assert.equal(hostCalls.length,beforeOOMCalls,'OOM never calls host');
 snap().forEach((b,i)=>assert.deepEqual(b,oomBefore[i],'OOM preserves full backing '+i));
 // Handle validation still wins over allocation failure.
 invoke(0xdeadbeef,base+4091,false);assert.equal(hostCalls.length,beforeOOMCalls);
 console.log(JSON.stringify({status:'PASS',calls:calls+2,splitChecks,controlChecks,nestedCalls,geometryReentries,allocationDelta:2,freeDelta:2,exhausted,actualOOM:true}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
