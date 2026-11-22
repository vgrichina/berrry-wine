#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {bootRenderHarness}=require('./render-helper');
const apiTable=require('../src/api_table.json');

// Valid 28-byte SCROLLINFO, selected fields only:
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/ns-winuser-scrollinfo
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getscrollinfo
// https://learn.microsoft.com/en-us/windows/win32/controls/scroll-bar-control-styles
// SB_CTL reads the actual control orientation. Tracking setup below tests only
// existing emulator compatibility; Windows SetScrollInfo ignores nTrackPos.
const extraWat=String.raw`
 (func (export "si_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base)
   (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "si_module") (param $p i32) (result i32)
  (call $handle_GetModuleHandleA (local.get $p) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "si_resolve") (param $m i32) (param $p i32) (result i32)
  (call $handle_GetProcAddress (local.get $m) (local.get $p) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "si_regs") (result i32) (global.get $reg_base))
 (func (export "si_call") (param $p i32)
  (global.set $eip (i32.const 0x456789ab))
  (call $win32_dispatch (i32.shr_u
   (i32.sub (local.get $p) (global.get $thunk_guest_base)) (i32.const 3))))
 (func (export "si_create") (param $style i32) (param $ctl i32) (result i32)
  (local $h i32)
  (local.set $h (global.get $next_hwnd))
  (global.set $next_hwnd (i32.add (local.get $h) (i32.const 1)))
  (call $wnd_table_set (local.get $h) (global.get $WNDPROC_CTRL_NATIVE))
  (drop (call $wnd_set_style (local.get $h)
   (select (i32.const 0x80000000) (local.get $style) (local.get $ctl))))
  (if (result i32) (local.get $ctl)
   (then (call $ctrl_create_child (local.get $h) (i32.const 7) (i32.const 101)
    (i32.const 0) (i32.const 0) (i32.const 100) (i32.const 100)
    (local.get $style) (i32.const 0)))
   (else (local.get $h))))
 (func (export "si_base") (param $h i32) (param $v i32) (result i32)
  (call $scroll_bar_addr (call $wnd_table_find (local.get $h)) (local.get $v)))
 (func (export "si_aux") (param $h i32) (param $v i32) (result i32)
  (call $scroll_aux_bar_addr (call $wnd_table_find (local.get $h)) (local.get $v)))
 (func (export "si_style") (param $h i32) (result i32) (call $wnd_get_style (local.get $h)))
`+['current_thread_id','yield_reason','last_error','guest_span_cursor','flag_op','flag_a','flag_b','flag_res','flag_sign_shift','capture_hwnd'].map(n=>
 `(func (export "si_${n}") (result i32) (global.get $${n}))`).join('\n');

async function main(){
 const h=await bootRenderHarness({extraWat,fonts:'none',width:64,height:64});
 const e=h.exports,m=new Uint8Array(h.memory.buffer),d=new DataView(h.memory.buffer);
 e.init_thread(1,0x400000,0,0,0,0,0);e.heap_init(0x800000);e.si_init();
 const wa=p=>e.guest_to_wasm(p)>>>0,alloc=n=>e.guest_alloc(n)>>>0;
 const read=(p,n)=>Buffer.from(Array.from({length:n},(_,i)=>e.guest_read8(p+i)));
 const put=(p,b)=>b.forEach((v,i)=>e.guest_write8(p+i,v));
 const text=s=>{const p=alloc(s.length+1);put(p,Buffer.from(s+'\0'));return p;};
 const stackArea=alloc(256),stack=stackArea+64,other=alloc(256),direct=alloc(12288),setup=alloc(28),regs=e.si_regs()>>>0;
 m.fill(0x6b,wa(other),wa(other)+256);
 d.setUint32(regs+16,stack,true);const mod=e.si_module(text('USER32.DLL'))>>>0;assert.ok(mod);
 const thunks={};for(const name of ['SetScrollInfo','GetScrollInfo']){
  d.setUint32(regs+16,stack,true);thunks[name]=e.si_resolve(mod,text(name))>>>0;assert.ok(thunks[name]);
  const api=apiTable.find(v=>v.name===name);assert.equal(api.convention,'stdcall');
  assert.equal(api.nargs,name==='SetScrollInfo'?4:3);assert.equal(d.getUint32(wa(thunks[name])+4,true),api.id);
 }
 // Independent literal SCROLLINFO expectations, authored before execution.
 // Last field is seeded through the existing SetScrollInfo SIF_TRACKPOS
 // compatibility path. This is explicitly not Windows setter behavior.
 const literals=[Buffer.from('1c00000017000000efffffff7b0000000d00000027000000eb110100','hex'),
  Buffer.from('1c00000017000000e3ffffffc80100001f00000054000000e186ffff','hex')];
 const values=[[-17,123,13,39,70123],[-29,456,31,84,-31007]];
 literals.forEach((b,v)=>{assert.equal(b.length,28);assert.deepEqual(Array.from({length:5},(_,i)=>b.readInt32LE(8+i*4)),values[v]);});
 const kinds=[{name:'horizontal SCROLLBAR',bar:2,vert:0,ctl:1},{name:'vertical SCROLLBAR',bar:2,vert:1,ctl:1},
  {name:'standard SB_HORZ',bar:0,vert:0,ctl:0},{name:'standard SB_VERT',bar:1,vert:1,ctl:0}];
 for(const k of kinds){k.style=k.ctl?0x40000000|k.vert:0x80300000;k.hwnd=e.si_create(k.style,k.ctl)>>>0;assert.ok(k.hwnd);}
 const globals=['current_thread_id','yield_reason','last_error','guest_span_cursor','flag_op','flag_a','flag_b','flag_res','flag_sign_shift','capture_hwnd'];
 let calls=0,getCalls=0,controls=0;const failures=[];
 function mismatch(label,kind,actual,expected){if(JSON.stringify(actual)!==JSON.stringify(expected))failures.push({label,kind,actual,expected});}
 function records(k){return [0,1].map(v=>{const b=e.si_base(k.hwnd,v)>>>0,a=e.si_aux(k.hwnd,v)>>>0;
  return [d.getInt32(b+4,true),d.getInt32(b+8,true),d.getUint32(a,true),d.getInt32(b,true),d.getInt32(a+4,true)];});}
 function call(name,args,wanted,label){
  const esp=stack+(calls%2)*4;m.fill(0x5a,wa(stackArea),wa(stackArea)+256);
  e.guest_write32(esp,0x12345678);args.forEach((v,i)=>e.guest_write32(esp+4+i*4,v));
  const beforeStack=read(stackArea,256),beforeOther=read(other,256),beforeGlobals=globals.map(n=>e['si_'+n]());
  const seed=[0xa0123456,0x11223344,0x22334455,0x33445566,esp,0x44556677,0x55667788,0x66778899];
  seed.forEach((v,i)=>d.setUint32(regs+i*4,v,true));e.si_call(thunks[name]);
  assert.equal(d.getInt32(regs,true),wanted,label+' return');
  assert.equal(e.get_esp()>>>0,esp+4+args.length*4,label+' ESP');assert.equal(e.get_eip()>>>0,0x456789ab,label+' EIP');
  for(const i of [1,2,3,5,6,7])assert.equal(d.getUint32(regs+i*4,true),seed[i],label+' reg '+i);
  assert.deepEqual(read(stackArea,256),beforeStack,label+' stack');assert.deepEqual(read(other,256),beforeOther,label+' unrelated');
  assert.deepEqual(globals.map(n=>e['si_'+n]()),beforeGlobals,label+' flags/thread/state');calls++;
 }
 for(const k of kinds){
  // Seed the opposite axis first, then set the actual control through SB_CTL.
  // Different auxiliary canaries on the same HWND catch a wrong-axis read.
  for(const v of [1-k.vert,k.vert]){
   put(setup,literals[v]);const input=read(setup,28);
   call('SetScrollInfo',[k.hwnd,k.ctl&&v===k.vert?2:v,setup,0],values[v][3],k.name+' setup '+v);
   assert.deepEqual(read(setup,28),input,'setter input preserved');
  }
  assert.deepEqual(records(k),values,k.name+' distinct public setter records');
  k.style=e.si_style(k.hwnd)>>>0; // Preserve the post-setup style across Get calls.
 }
 const regions=[[wa(direct),12288]];
 // Direct buffers cover aligned, unaligned, and ordinary page-edge positions.
 for(const k of kinds)for(let mask=0;mask<32;mask++)for(const offset of [0,1,4095,4096]){
  const p=direct+offset;
  const label=k.name+' mask='+mask+' offset='+offset;
  regions.forEach(([s,n],i)=>m.fill(0xa5+i,s,s+n));
  const input=Buffer.alloc(28,0x93);input.writeUInt32LE(28);input.writeUInt32LE(mask,4);put(p,input);
  const expected=Buffer.from(input),literal=literals[k.vert];
  for(const [bit,offsets] of [[1,[8,12]],[2,[16]],[4,[20]],[16,[24]]])if(mask&bit)for(const offset of offsets)literal.copy(expected,offset,offset,offset+4);
  const backing=regions.map(([s,n])=>Buffer.from(m.subarray(s,s+n)));
  for(let i=0;i<28;i++){const phys=wa(p+i);for(let r=0;r<regions.length;r++)if(phys>=regions[r][0]&&phys<regions[r][0]+regions[r][1])backing[r][phys-regions[r][0]]=expected[i];}
  for(let repeat=0;repeat<2;repeat++){
   // No state reset between reads: selected results and unselected sentinels
   // must remain identical on a repeated call.
   // Success for masks 0 and 8 also preserves current emulator behavior.
   call('GetScrollInfo',[k.hwnd,k.bar,p],1,label+' repeat='+repeat);
   mismatch(label,'complete struct',read(p,28).toString('hex'),expected.toString('hex'));
   mismatch(label,'both axis records',records(k),values);
   mismatch(label,'style',e.si_style(k.hwnd)>>>0,k.style>>>0);
   regions.forEach(([s,n],i)=>mismatch(label,'full backing '+i,Buffer.from(m.subarray(s,s+n)).equals(backing[i]),true));
   getCalls++;controls++;
  }
 }
 const horizontalFailures=failures.filter(f=>f.label.startsWith('horizontal SCROLLBAR'));
 const controlFailures=failures.filter(f=>!f.label.startsWith('horizontal SCROLLBAR'));
 console.log(JSON.stringify({publicAPI:['USER32.SetScrollInfo','USER32.GetScrollInfo'],calls,getCalls,controls,failures:failures.length,horizontalFailures:horizontalFailures.length,controlFailures:controlFailures.length,firstFailures:failures.slice(0,8),all32Masks:true,literalAxisExpectations:true,tracking:'emulator setter compatibility only',fullBackingCanaries:true,ABI:true}));
 assert.equal(controlFailures.length,0,'vertical SCROLLBAR and ordinary SB_HORZ/SB_VERT controls');
 assert.equal(failures.length,0,'SCROLLBAR GetScrollInfo auxiliary axis must match actual control orientation');
 console.log('PASS GetScrollInfo control axis, literal page/range/position, tracking compatibility, masks, repeats, backing and ABI');
}
main().catch(e=>{console.error(e);process.exitCode=1;});

