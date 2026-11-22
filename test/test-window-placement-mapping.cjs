#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const apis = require('../src/api_table.json');

// Independent historical Win32 ABI: three UINTs, two POINTs, one RECT.
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/ns-winuser-windowplacement
// Existing flags/coordinates/show-state behavior is preserved by this repair.
const extraWat = String.raw`
 (func (export "wp_init")
  (global.set $thunk_guest_base (call $w2g (global.get $THUNK_BASE)))
  (call $update_thunk_end))
 (func (export "wp_module") (param $p i32) (result i32)
  (call $handle_GetModuleHandleA (local.get $p) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "wp_resolve") (param $m i32) (param $p i32) (result i32)
  (call $handle_GetProcAddress (local.get $m) (local.get $p) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "wp_call") (param $thunk i32)
  (global.set $eip (i32.const 0x456789ab))
  (call $win32_dispatch (i32.shr_u (i32.sub (local.get $thunk) (global.get $thunk_guest_base)) (i32.const 3))))
 (func (export "wp_regs") (result i32) (global.get $reg_base))
 (func (export "wp_live_allocations") (result i32)
  (i32.sub (global.get $heap_stat_allocs) (global.get $heap_stat_frees)))
 (func (export "wp_window") (param $h i32) (param $parent i32) (param $style i32)
  (call $wnd_table_set (local.get $h) (i32.const 0))
  (drop (call $wnd_set_style (local.get $h) (local.get $style)))
  (call $wnd_set_parent (local.get $h) (local.get $parent))
  (call $ctrl_geom_set (call $wnd_table_find (local.get $h)) (i32.const 31) (i32.const 47) (i32.const 300) (i32.const 220))
  (call $client_rect_set (local.get $h) (i32.const 0) (i32.const 0) (i32.const 300) (i32.const 220)))
 (func (export "wp_mode") (param $h i32) (param $min i32) (param $max i32)
  (call $wnd_min_set (local.get $h) (local.get $min))
  (call $wnd_max_set (local.get $h) (local.get $max)))
 (func (export "wp_style") (param $h i32) (result i32) (call $wnd_get_style (local.get $h)))
 (func (export "wp_hide") (param $h i32)
  (drop (call $wnd_set_style (local.get $h) (i32.and (call $wnd_get_style (local.get $h)) (i32.const 0xefffffff)))))
 (func (export "wp_proc") (param $h i32) (param $p i32)
  (call $wnd_table_set (local.get $h) (local.get $p)))
` + ['flag_op','flag_a','flag_b','flag_res','flag_sign_shift','saved_cf','current_thread_id','yield_reason','last_error','guest_span_cursor','windowpos_depth','capture_hwnd'].map(n =>
 `(func (export "wp_${n}") (result i32) (global.get $${n}))`).join('\n');

async function main() {
 let nested = null, stagePointers = [], inside = false;
 const h = await bootRenderHarness({extraWat, fonts:'none', width:32, height:32,
  beforeInstantiate(ctx, host) {
   const get = host.get_window_rect;
   host.get_window_rect = (hwnd, ptr) => {
    get(hwnd, ptr);
    if (nested) {
     assert.equal(ptr & 15, 0, 'host RECT slot is aligned16');
     assert.equal(ptr >>> 12, (ptr + 15) >>> 12, 'host RECT stays within one backing page');
    }
    if (nested && !inside) {
     inside = true;
     stagePointers.push(ptr);
     const before = Buffer.from(new Uint8Array(ctx.getMemory(),ptr,16));
     nested();
     assert.deepEqual(Buffer.from(new Uint8Array(ctx.getMemory(),ptr,16)),before,'outer host rectangle survives nested placement');
     inside = false;
    } else if (inside) stagePointers.push(ptr);
   };
  }});
 const e=h.exports, bytes=new Uint8Array(h.memory.buffer), dv=new DataView(h.memory.buffer);
 e.init_thread(1,0x400000,0,0,0,0,0); e.heap_init(0x800000); e.wp_init();
 const wa=p=>e.guest_to_wasm(p)>>>0, alloc=n=>e.guest_alloc(n)>>>0, regs=e.wp_regs()>>>0;
 const read=(p,n)=>Buffer.from(Array.from({length:n},(_,i)=>e.guest_read8(p+i)));
 const write=(p,b)=>b.forEach((v,i)=>e.guest_write8(p+i,v));
 const words=v=>{const b=Buffer.alloc(v.length*4);v.forEach((n,i)=>b.writeInt32LE(n|0,i*4));return b;};
 const text=s=>{const b=Buffer.from(s+'\0'),p=alloc(b.length);write(p,b);return p;};
 const stackArea=alloc(4096),stack=stackArea+3072,other=alloc(256),direct=alloc(12288),nestedOut=alloc(44);
 dv.setUint32(regs+16,stack,true);const mod=e.wp_module(text('USER32.DLL'))>>>0;assert.ok(mod);
 const thunks={};for(const name of ['GetWindowPlacement','SetWindowPlacement']){
  dv.setUint32(regs+16,stack,true);const thunk=e.wp_resolve(mod,text(name))>>>0;assert.ok(thunk);
  const row=apis.find(a=>a.name===name);assert.equal(row.nargs,2);assert.equal(row.convention,'stdcall');
  assert.equal(dv.getUint32(wa(thunk)+4,true),row.id);thunks[name]=thunk;
 }
 const page=0x30000000,spacer=0x28000000;
 for(const p of [page,spacer,page+4096])assert.equal(e.test_virtual_map_commit(p,4096)>>>0,p);
 const backing=[page,spacer,page+4096].map(wa);
 assert.equal(backing[1],backing[0]+4096);assert.notEqual(backing[2],backing[0]+4096);
 const regions=[[wa(direct),12288],...backing.map(p=>[p,4096])];
 const failures=[];let calls=0,splitCalls=0,controls=0;
 const eq=(actual,expected,label)=>{
  if(Buffer.isBuffer(actual)) {
   if(!actual.equals(expected))failures.push({label,bytes:actual.length,differences:Array.from(actual,(v,i)=>v!==expected[i]?[i,v,expected[i]]:null).filter(Boolean).slice(0,8)});
  } else if(JSON.stringify(actual)!==JSON.stringify(expected))failures.push({label,actual,expected});
 };
 function window(hwnd,child=false) {
  const style=child?0x50000000:0x90000000;
  e.wp_window(hwnd,child?0x10010:0,style);
  h.renderer.createWindow(hwnd,style,31,47,300,220,'placement mapping',child?0x10010:0,h.instance,h.memory);
 }
 window(0x10010);window(0x10011,true);window(0x10012);
 const globals=['flag_op','flag_a','flag_b','flag_res','flag_sign_shift','saved_cf','current_thread_id','yield_reason','last_error','guest_span_cursor','windowpos_depth','capture_hwnd'];
 function invoke(name,hwnd,p,label,checkState=true) {
  const esp=stack+(calls%2)*4;
  // Position callbacks may use stack below ESP. The ABI must preserve the call
  // frame and bytes above it; other direct allocations have separate canaries.
  bytes.fill(0x5a,wa(esp),wa(esp)+256);
  e.guest_write32(esp,0x12345678);e.guest_write32(esp+4,hwnd);e.guest_write32(esp+8,p);
  const saved=read(esp,256),otherBefore=read(other,256);
  const seed=[0xa0123456,0x11223344,0x22334455,0x33445566,esp,0x44556677,0x55667788,0x66778899];
  seed.forEach((v,i)=>dv.setUint32(regs+i*4,v,true));
  const state=globals.map(n=>e['wp_'+n]());
  const live=e.wp_live_allocations();
  e.wp_call(thunks[name]);
  eq(dv.getUint32(regs,true),1,label+' BOOL');
  assert.equal(e.get_esp()>>>0,esp+12,label+' ESP');assert.equal(e.get_eip()>>>0,0x456789ab,label+' EIP');
  for(const i of [1,2,3,5,6,7])assert.equal(dv.getUint32(regs+i*4,true),seed[i],label+' register '+i);
  assert.deepEqual(read(esp,256),saved,label+' full argument/upper-stack canaries');
  assert.deepEqual(read(other,256),otherBefore,label+' unrelated allocation');
  if(checkState)assert.deepEqual(globals.map(n=>e['wp_'+n]()),state,label+' flags/thread/yield/error/span/position/capture');
  else assert.deepEqual(globals.slice(6).map(n=>e['wp_'+n]()),state.slice(6),label+' thread/yield/error/span/position/capture after guest instructions');
  if(name==='GetWindowPlacement')assert.equal(e.wp_live_allocations(),live,label+' all invocation-owned host storage released');
  calls++;
 }
 const modes=[[0,0,0,1],[0,1,0,3],[1,0,0,2],[1,1,2,2]];
 for(let repeat=0;repeat<2;repeat++)for(const child of [false,true])for(const split of Array.from({length:45},(_,i)=>i)) {
  const p=page+4096-split,hwnd=child?0x10011:0x10010,label=`${child?'child':'top'} split=${split} repeat=${repeat}`;
  // Every output byte, including each possible crossing inside a DWORD.
  for(const [min,max,flags,show] of modes) {
   window(hwnd,child);e.wp_mode(hwnd,min,max);
   regions.forEach(([a,n],i)=>bytes.fill(0x80+i,a,a+n));
   const expected=regions.map(([a,n])=>Buffer.from(bytes.subarray(a,a+n)));
   const literal=words([44,flags,show,0,0,-1,-1,31,47,331,267]);
   literal.forEach((v,i)=>{const a=wa(p+i);const r=regions.findIndex(([s,n])=>a>=s&&a<s+n);expected[r][a-regions[r][0]]=v;});
   invoke('GetWindowPlacement',hwnd,p,label+' get '+min+max);
   eq(read(p,44),literal,label+' all44 output bytes');
   regions.forEach(([a,n],i)=>eq(Buffer.from(bytes.subarray(a,a+n)),expected[i],label+' full output backing '+i));
  }
  window(hwnd,child);e.wp_mode(hwnd,0,0);e.wp_hide(hwnd);h.renderer.windows[hwnd].visible=false;
  regions.forEach(([a,n],i)=>bytes.fill(0,a,a+n));
  const values=repeat?[44,0,4,101,-203,307,-409,-59,-61,228,132]:[44,0,4,-101,203,-307,409,31,47,331,267];
  const input=words(values);write(p,input);
  const before=regions.map(([a,n])=>Buffer.from(bytes.subarray(a,a+n)));
  invoke('SetWindowPlacement',hwnd,p,label+' set');
  const win=h.renderer.windows[hwnd];
  eq(!!(e.wp_style(hwnd)&0x10000000),true,label+' consumed showCmd shows hidden window');
  eq(win.visible,true,label+' host visible');
  eq([win.x,win.y,win.w,win.h], [values[7],values[8],values[9]-values[7],values[10]-values[8]],label+' consumed rectangle');
  eq(read(p,44),input,label+' all44 input unchanged');
  regions.forEach(([a,n],i)=>eq(Buffer.from(bytes.subarray(a,a+n)),before[i],label+' full input backing '+i));
  if(split>0&&split<44)splitCalls+=5;else controls+=5;
 }
 // Direct-window controls use the same independent literal, not an A/B oracle.
 for(const skew of [0,1,4053,4054,4095]){
  window(0x10010);e.wp_mode(0x10010,0,0);
  invoke('GetWindowPlacement',0x10010,direct+skew,'direct '+skew);
  eq(read(direct+skew,44),words([44,0,1,0,0,-1,-1,31,47,331,267]),'direct literal '+skew);controls++;
 }
 // A real x86 wndproc changes all consumed fields and nests the public Set
 // call in CHANGING. The outer show command must still be its entry value.
 const counter=alloc(4),proc=alloc(256),nestedInput=alloc(44);
 const u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255];
 for(const split of [9,10,11,29,30,31,33,34,35,37,38,39,41,42,43]) {
  const p=page+4096-split,code=[],jumps=[];
  const emit=(...v)=>code.push(...v),branch=()=>{emit(0x0f,0x85);jumps.push(code.length);emit(0,0,0,0);};
  emit(0x81,0x7c,0x24,0x08,...u32(0x46));branch();
  emit(0x83,0x3d,...u32(counter),0);branch();
  emit(0xc7,0x05,...u32(counter),...u32(1));
  for(const [off,value] of [[8,2],[28,901],[32,903],[36,1101],[40,1103]])emit(0xc7,0x05,...u32(p+off),...u32(value));
  emit(0x68,...u32(nestedInput),0x68,...u32(0x10012),0xb8,...u32(thunks.SetWindowPlacement),0xff,0xd0);
  const done=code.length;emit(0x31,0xc0,0xc2,0x10,0);
  for(const at of jumps)code.splice(at,4,...u32(done-at-4));
  write(proc,Buffer.from(code));e.guest_write32(counter,0);
  window(0x10010);window(0x10012);e.wp_mode(0x10010,0,0);e.wp_proc(0x10010,proc);
  write(p,words([44,0,4,0,0,0,0,31,47,331,267]));
  write(nestedInput,words([44,0,4,0,0,0,0,59,61,346,254]));
  // The x86 callback executes CMP/XOR; arithmetic flags are caller volatile.
  // The no-callback cases above require exact lazy-flag preservation.
  invoke('SetWindowPlacement',0x10010,p,'guest snapshot/nested split '+split,false);
  assert.equal(e.guest_read32(counter),1,'guest CHANGING actually executed');
  const outer=h.renderer.windows[0x10010],inner=h.renderer.windows[0x10012];
  eq([outer.x,outer.y,outer.w,outer.h],[31,47,300,220],'snapshot outer rectangle '+split);
  eq([inner.x,inner.y,inner.w,inner.h],[59,61,287,193],'nested rectangle '+split);
  // Reading the public output separately also checks that a late showCmd
  // reload would have minimized the outer window.
  invoke('GetWindowPlacement',0x10010,direct+64,'snapshot state '+split);
  eq(e.guest_read32(direct+72),1,'entry showCmd survives guest overwrite '+split);
 }
 window(0x10010);e.wp_mode(0x10010,0,0);
 // Reenter the actual public API while its host import retains the outer
 // destination. A shared RECT (even with a restored cursor) loses this value.
 const nestedStack=alloc(128)+64;
 nested=()=>{
  const registers=Buffer.from(bytes.subarray(regs,regs+32)),oldEip=e.get_eip();
  e.guest_write32(nestedStack,0);e.guest_write32(nestedStack+4,0x10012);e.guest_write32(nestedStack+8,nestedOut);
  dv.setUint32(regs+16,nestedStack,true);e.wp_call(thunks.GetWindowPlacement);
  assert.equal(e.get_esp()>>>0,nestedStack+12);bytes.set(registers,regs);e.set_eip(oldEip);
 };
 h.renderer.windows[0x10012].x=91;
 for(let i=0;i<20;i++)invoke('GetWindowPlacement',0x10010,direct+64,'host reentrancy '+i);
 assert.equal(stagePointers.length,40);
 for(let i=0;i<stagePointers.length;i+=2)assert.notEqual(stagePointers[i],stagePointers[i+1],'nested host buffers have disjoint ownership');
 const controlFailures=failures.filter(f=>/^(?:direct |(?:child|top) split=(?:0|44)\b)/.test(f.label));
 const callbackFailures=failures.filter(f=>/snapshot|nested rectangle/.test(f.label));
 console.log(JSON.stringify({publicAPIs:Object.keys(thunks),module:mod,thunks,backing,calls,splitCalls,controls,failures:failures.length,controlFailures:controlFailures.length,callbackFailures:callbackFailures.length,firstFailures:failures.slice(0,12),firstControlFailures:controlFailures.slice(0,4),all44Bytes:true,all43Boundaries:true,repeated:true,childAndTop:true,fullBackingCanaries:true,hostReentrancy:true,ABI:true}));
 assert.equal(failures.length,0,'public USER32 placement valid nonaffine structures match literal44-byte expectations');
 console.log('PASS placement mapping: all44 bytes/43 splits, modes, child/top, complete backing canaries, host reentrancy, repeats and ABI');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
