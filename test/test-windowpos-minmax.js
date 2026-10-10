#!/usr/bin/env node
'use strict';
// Real x86 window procedures call real DefWindowProcA/W thunks. The host only
// records committed sizes; it never supplies a fake WM_GETMINMAXINFO response.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const compiler=require('./compile-src'),originalCompile=compiler.compileSrcWasm;
const before=process.env.WINDOWPOS_MINMAX_BASELINE;
compiler.compileSrcWasm=(transform,options)=>originalCompile((file,source)=>{
  if(before&&fs.existsSync(path.join(before,file+'.before')))source=fs.readFileSync(path.join(before,file+'.before'),'utf8');
  // Optional timeout variant changes only the existing sender's bounded
  // budget, so a real non-returning x86 wndproc is tested without 64M blocks.
  if(process.env.WINDOWPOS_MINMAX_TIMEOUT&&file==='09c3a-dialog-runtime.wat')
    source=source.replace('(call $run (i32.const 1000000))','(call $run (i32.const 128))')
      .replace('(i32.ge_u (local.get $sync_rounds) (i32.const 64))','(i32.ge_u (local.get $sync_rounds) (i32.const 1))');
  return transform?transform(file,source):source;
},options);
const {bootRenderHarness}=require('./render-helper');
const apis=require('../src/api_table.json');
const u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255];
function procedure(obs,def,move,{consume=false,loop=false,destroy=0}={}){
  const a=[],labels=new Map(),fix=[];
  const emit=(...v)=>a.push(...v),label=n=>labels.set(n,a.length);
  const branch=(op,n)=>{emit(...op);fix.push([a.length,n]);emit(0,0,0,0);};
  emit(0x55,0x89,0xe5,0x8b,0x45,0x0c,0x83,0xf8,0x24);branch([0x0f,0x84],'minmax');
  emit(0x83,0xf8,0x46);branch([0x0f,0x85],'done');
  emit(0x8b,0x45,0x14,0xa3,...u32(obs+28));
  if(!consume){emit(0xff,0x75,0x14,0xff,0x75,0x10,0xff,0x75,0x0c,0xff,0x75,0x08,0xb8,...u32(def),0xff,0xd0);}
  branch([0xe9],'done');
  label('minmax');
  emit(0xff,0x05,...u32(obs)); // count actual callback
  emit(0x8b,0x4d,0x14,0x89,0x0d,...u32(obs+4));
  if(destroy){emit(0xff,0x75,0x08,0xb8,...u32(destroy),0xff,0xd0);branch([0xe9],'done');}
  if(loop){label('spin');branch([0xe9],'spin');}
  for(const [src,dst]of [[8,24],[12,28],[16,32],[20,36]])emit(0xa1,...u32(obs+src),0x89,0x41,dst);
  // Optional nested MoveWindow on another actual guest window. Keep the outer
  // MINMAXINFO pointer alive; its caller checks it after nested dispatch.
  emit(0xa1,...u32(obs+24),0x85,0xc0);branch([0x0f,0x84],'done');
  emit(0x6a,0,0x6a,0,0x6a,0,0x6a,0,0x6a,0,0x50,0xb8,...u32(move),0xff,0xd0);
  label('done');emit(0x31,0xc0,0x89,0xec,0x5d,0xc2,0x10,0);
  for(const [at,n]of fix){assert(labels.has(n));a.splice(at,4,...u32(labels.get(n)-at-4));}
  return Uint8Array.from(a);
}
const extraWat=String.raw`
  (func (export "mm_map") (param $p i32) (result i32) (call $virtual_map_commit (local.get $p) (i32.const 4096)))
  (func (export "mm_thunk") (param $id i32) (result i32)
    (local $p i32)
    (global.set $thunk_guest_base (call $w2g (global.get $THUNK_BASE)))
    (local.set $p (i32.add (global.get $THUNK_BASE) (i32.mul (global.get $num_thunks) (i32.const 8))))
    (i32.store (local.get $p) (i32.const 0)) (i32.store offset=4 (local.get $p) (local.get $id))
    (global.set $num_thunks (i32.add (global.get $num_thunks) (i32.const 1)))
    (call $update_thunk_end) (call $w2g (local.get $p)))
  (func (export "mm_window") (param $proc i32) (param $style i32) (result i32)
    (local $h i32) (local.set $h (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (local.get $h) (i32.const 1)))
    (call $wnd_table_set (local.get $h) (local.get $proc))
    (drop (call $wnd_set_style (local.get $h) (local.get $style))) (local.get $h))
  (func (export "mm_move") (param $h i32) (param $cx i32) (param $cy i32) (result i32)
    (call $move_window_core (local.get $h) (i32.const 0) (i32.const 13) (i32.const 17)
      (local.get $cx) (local.get $cy) (i32.const 0x1c) (i32.const 0)))
  (func (export "mm_setpos") (param $h i32) (param $cx i32) (param $cy i32) (param $flags i32) (result i32)
    (local $esp i32) (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (call $gs32 (i32.add (local.get $esp) (i32.const 24)) (local.get $cy))
    (call $gs32 (i32.add (local.get $esp) (i32.const 28)) (local.get $flags))
    (call $handle_SetWindowPos (local.get $h) (i32.const 0) (i32.const 13) (i32.const 17) (local.get $cx) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $esp)) (i32.load (global.get $reg_base)))
  (func (export "mm_default") (param $h i32) (param $pos i32) (param $wide i32) (result i32)
    (local $esp i32) (local $delta i32) (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (if (local.get $wide)
      (then (call $handle_DefWindowProcW (local.get $h) (i32.const 0x46) (i32.const 0) (local.get $pos) (i32.const 0) (i32.const 0)))
      (else (call $handle_DefWindowProcA (local.get $h) (i32.const 0x46) (i32.const 0) (local.get $pos) (i32.const 0) (i32.const 0))))
    (local.set $delta (i32.sub (i32.load offset=16 (global.get $reg_base)) (local.get $esp)))
    (i32.store offset=16 (global.get $reg_base) (local.get $esp)) (local.get $delta))
`;
(async()=>{
  const sizes=new Map(),moves=[];
  const harness=await bootRenderHarness({extraWat,fonts:'none',extraHostOverrides:{
    get_window_client_size:h=>sizes.get(h>>>0)||0,
    get_screen_size:()=>1024|(740<<16),
    move_window(h,x,y,cx,cy,flags){h>>>=0;const old=sizes.get(h)||0;if(!(flags&1))sizes.set(h,(cx&65535)|cy<<16);moves.push({h,x,y,cx:flags&1?old&65535:cx,cy:flags&1?old>>>16:cy,flags});}
  }});
  const e=harness.exports,fixture=fs.readFileSync(path.join(__dirname,'binaries/calc.exe'));
  new Uint8Array(harness.memory.buffer).set(fixture,e.get_staging());assert(e.load_pe(fixture.length));e.init_dx_com_thunks();
  const thunk=n=>e.mm_thunk(apis.find(a=>a.name===n).id)>>>0;
  const defA=thunk('DefWindowProcA'),defW=thunk('DefWindowProcW'),move=thunk('MoveWindow'),destroyThunk=thunk('DestroyWindow');
  const put=(p,v)=>e.guest_write32(p,v),get=p=>e.guest_read32(p)>>>0;
  function make({wide=false,style=0x10ca0000,consume=false,loop=false,destroy=false,minX=640,minY=440,maxX=900,maxY=650}={}){
    const obs=e.guest_alloc(64)>>>0,proc=e.guest_alloc(512)>>>0;
    [0,0,minX,minY,maxX,maxY,0,0].forEach((v,i)=>put(obs+i*4,v));
    const code=procedure(obs,wide?defW:defA,move,{consume,loop,destroy:destroy?destroyThunk:0});code.forEach((v,i)=>e.guest_write8(proc+i,v));
    const h=e.mm_window(proc,style)>>>0;sizes.set(h,400|(300<<16));return{obs,proc,h};
  }
  for(const wide of [false,true]){
    const f=make({wide}),esp=e.get_esp();e.set_ebx(0x12345678);e.set_esi(0x23456789);e.set_edi(0x3456789a);
    assert.equal(e.mm_move(f.h,0,0),1);assert.equal(get(f.obs),1,'actual guest minmax callback');
    assert.deepEqual([moves.at(-1).cx,moves.at(-1).cy],[640,440]);assert.equal(e.get_esp(),esp);assert.equal(e.get_ebx()>>>0,0x12345678);assert.equal(e.get_esi()>>>0,0x23456789);assert.equal(e.get_edi()>>>0,0x3456789a);
    e.mm_setpos(f.h,700,500,0x14);assert.deepEqual([moves.at(-1).cx,moves.at(-1).cy],[700,500]);
    e.mm_setpos(f.h,9999,9999,0x14);assert.deepEqual([moves.at(-1).cx,moves.at(-1).cy],[900,650]);
    const count=get(f.obs);e.mm_setpos(f.h,12,15,0x414);assert.equal(get(f.obs),count,'NOSENDCHANGING suppresses query');assert.deepEqual([moves.at(-1).cx,moves.at(-1).cy],[12,15]);
    e.mm_setpos(f.h,0,0,0x15);assert.equal(get(f.obs),count,'NOSIZE suppresses query');
  }
  for(const [style,expected]of [[0x10000000,true],[0x90c00000,true],[0x50040000,true],[0x50000000,false],[0x90000000,false]]){
    const f=make({style});e.mm_move(f.h,0,0);assert.equal(get(f.obs),expected?1:0,'style '+style.toString(16));
  }
  const consuming=make({consume:true});e.mm_move(consuming.h,0,0);assert.equal(get(consuming.obs),0,'consumed changing bypasses defaults');assert.equal(moves.at(-1).cx,0);
  const nested=make({minX:300,minY:200}),outer=make();put(outer.obs+24,nested.h);e.mm_move(outer.h,0,0);assert.equal(get(outer.obs),1);assert.equal(get(nested.obs),1);assert.notEqual(get(outer.obs+4),get(nested.obs+4),'nested scratch is distinct');assert.deepEqual([moves.at(-1).h,moves.at(-1).cx,moves.at(-1).cy],[outer.h,640,440]);
  // A maximum below the minimum is raised to it (USER/Wine): the minimum wins.
  const small=make({minX:900,maxX:100});e.mm_move(small.h,50,60);assert.deepEqual([moves.at(-1).cx,moves.at(-1).cy],[900,440],'max below min is raised to min');
  // A negative minimum is malformed: the proposal is left untouched.
  const bad=make({minX:-5});e.mm_move(bad.h,50,60);assert.deepEqual([moves.at(-1).cx,moves.at(-1).cy],[50,60],'malformed limit rejected');
  const f=make(),pos=e.guest_alloc(36)>>>0;[0xaabbccdd,f.h,0,13,17,0,0,0x14,0x11223344].forEach((v,i)=>put(pos+i*4,v));
  assert.equal(e.mm_default(f.h,pos+4,0),20);assert.equal(get(pos+20),640);assert.equal(get(pos+24),440);assert.equal(get(pos),0xaabbccdd);assert.equal(get(pos+32),0x11223344);
  const count=get(f.obs);for(const invalid of [0,0xfffffff8])assert.equal(e.mm_default(f.h,invalid,1),20);assert.equal(get(f.obs),count,'invalid output pointer does not callback');
  const sparse=0x38000000,neighbor=sparse+0x10000;
  for(const p of [sparse,neighbor,sparse+4096])assert(e.mm_map(p));
  assert.notEqual(e.guest_to_wasm(sparse+4096),e.guest_to_wasm(sparse)+4096);
  for(let i=0;i<128;i++)e.guest_write8(neighbor+i,0xa7);
  const split=sparse+4093;[f.h,0,13,17,0,0,0x14].forEach((v,i)=>put(split+i*4,v));
  assert.equal(e.mm_default(f.h,split,1),20);assert.equal(get(split+16),640);assert.equal(get(split+20),440);
  for(let i=0;i<128;i++)assert.equal(e.guest_read8(neighbor+i),0xa7,'unrelated sparse backing preserved');
  const destroyed=make({destroy:true}),destroyPos=e.guest_alloc(28)>>>0;
  [destroyed.h,0,0,0,50,60,0x14].forEach((v,i)=>put(destroyPos+i*4,v));
  assert.equal(e.mm_default(destroyed.h,destroyPos,0),20);assert.equal(get(destroyed.obs),1);
  assert.deepEqual([get(destroyPos+16),get(destroyPos+20)],[50,60],'destroyed window does not commit stale dimensions');
  if(process.env.WINDOWPOS_MINMAX_TIMEOUT){
    const stuck=make({loop:true}),proposal=e.guest_alloc(28)>>>0;
    [stuck.h,0,0,0,50,60,0x14].forEach((v,i)=>put(proposal+i*4,v));
    const esp=e.get_esp();assert.equal(e.mm_default(stuck.h,proposal,0),20);
    assert.equal(get(stuck.obs),1,'actual non-returning minmax callback entered');
    assert.deepEqual([get(proposal+16),get(proposal+20)],[50,60],'incomplete callback cannot clamp');
    assert.equal(e.get_esp(),esp,'timeout restores owner stack');
  }
  console.log('PASS actual x86 minmax A/W callback, MoveWindow/SetWindowPos, ABI, flags, styles, nested scratch, malformed limits and output canaries');
})().catch(e=>{console.error(e);process.exitCode=1;});
