#!/usr/bin/env node
'use strict';
const assert=require('assert'),path=require('path');
const {Worker}=require('worker_threads');
const {bootRenderHarness}=require('./render-helper');
const {Bridge}=require('../lib/d3d9-host');
const {WorkerConsumer}=require('../lib/d3d-command-stream');
const sigs=require('../lib/host-import-sigs.generated.json').sigs;
(async()=>{
 let bridge;const moves=[];
 const {exports:e,memory,module}=await bootRenderHarness({fonts:'none',extraHostOverrides:{gpu_gl_call:(o,p,a)=>bridge.call(o,p,a),
  move_window:(...args)=>moves.push(args),get_window_client_size:()=>12|(10<<16)},extraWat:`
  (func (export "create") (param $pp i32) (param $out i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (local.get $pp))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (local.get $out))
    (call $handle_IDirect3D9_CreateDevice (i32.const 0) (i32.const 0) (i32.const 1) (i32.const 1) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
  (func (export "reset") (param $d i32) (param $pp i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
    (call $handle_IDirect3DDevice9_Reset (local.get $d) (local.get $pp) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
  (func (export "release") (param $d i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
    (call $handle_IDirect3DDevice9_Release (local.get $d) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
  (func (export "clear") (param $d i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (i32.const 0x3f800000))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (i32.const 0))
    (call $handle_IDirect3DDevice9_Clear (local.get $d) (i32.const 0) (i32.const 0) (i32.const 1) (i32.const -65536) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
  (func (export "present") (param $d i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
    (call $handle_IDirect3DDevice9_Present (local.get $d) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
  (func (export "target") (param $d i32) (result i32) (call $d3ddev_rt_entry (local.get $d)))
  (func (export "texture") (param $d i32) (param $out i32) (result i32)
    (call $d3d9_texture_create (local.get $d) (i32.const 1) (i32.const 1)
      (i32.const 1) (i32.const 0) (i32.const 21) (i32.const 1) (local.get $out)) (i32.load offset=0 (global.get $reg_base)))
  (func (export "bindTexture") (param $d i32) (param $stage i32) (param $t i32) (result i32)
    (call $d3d9_texture_binding (local.get $d) (local.get $stage) (local.get $t) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
  (func (export "sampler") (param $d i32) (param $stage i32) (param $value i32) (result i32)
    (call $d3d9_sampler_state (local.get $d) (local.get $stage) (i32.const 1) (local.get $value) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
  (func (export "program") (param $d i32) (result i32) (call $d3d9_program_state (local.get $d)))
  (func (export "scissor") (param $d i32) (param $p i32) (param $get i32) (result i32)
    (call $d3d9_scissor (local.get $d) (local.get $p) (local.get $get)) (i32.load offset=0 (global.get $reg_base)))
  ;; $heap_bins_flush first, exactly as the shipped "get_free_list" export
  ;; does. $heap_free_impl sends every block <= $HEAP_BIN_MAX (256) to a
  ;; per-size bin and returns before it ever reaches $free_list, so a raw
  ;; (global.get $free_list) cannot see a freed small block at all -- and a
  ;; light node is small.
  (func (export "free_head") (result i32) (call $heap_bins_flush) (global.get $free_list))
  (func (export "light") (param $d i32) (result i32)
    (call $d3d9_light (local.get $d) (i32.const 123456) (i32.const 1) (i32.const 2)) (i32.load offset=0 (global.get $reg_base)))
  (func (export "material") (param $d i32) (param $p i32) (result i32)
    (call $d3d9_material (local.get $d) (local.get $p) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
  (func (export "releaseTexture") (param $t i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
    (call $handle_IDirect3DTexture9_Release (local.get $t) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
  (func (export "desktop") (result i32) (i32.or (call $dx_display_w_get) (i32.shl (call $dx_display_h_get) (i32.const 16))))
  (func (export "size") (param $d i32) (result i32)
    (i32.or (load.field DxObject width (call $d3ddev_rt_entry (local.get $d)))
      (i32.shl (load.field DxObject height (call $d3ddev_rt_entry (local.get $d))) (i32.const 16))))`});
 e.d3dim_worker_init(0x400000);e.init_dx_com_thunks();
 const pp=e.guest_alloc(64),out=e.guest_alloc(4),wa=p=>e.guest_to_wasm(p)>>>0;
 const params=(overrides={})=>{const words=[8,8,21,1,0,0,1,1,1,0,0,0,0,0x80000000];
  for(const [index,value]of Object.entries(overrides))words[index]=value;
  new Uint8Array(memory.buffer,wa(pp),64).fill(0);words.forEach((v,i)=>e.guest_write32(pp+i*4,v));};
 for(const async of [false,true]){
  bridge=new Bridge({backend:'software',enableProgrammable:true,getExports:()=>e,getMemory:()=>memory.buffer,guestToWasm:wa,
   ...(async?{createSoftwareWorker:()=>new WorkerConsumer(new Worker(path.join(__dirname,'../lib/d3d-render-worker.js')),
    {module,memory,sigs,imageBase:e.get_image_base()>>>0,reclaimHeap:h=>e.d3d_render_adopt_free_list(h)})}:{})});
  const invoke=async(fn,...args)=>{let v=fn(...args);while(e.get_d3d_render_token()){await bridge.wait(e.get_d3d_render_token());v=fn(...args);}return v>>>0;};
  try{
   const originalDesktop=e.desktop();
   params({0:3,1:2,2:23,11:1});assert.strictEqual(e.create(pp,out),0);const packed=e.guest_read32(out)>>>0;
   assert.strictEqual(await invoke(e.clear,packed),0,'initialize565 executor');
   const originalTarget=e.target(packed),originalProgram=e.program(packed),submit=bridge._submit;
   bridge._submit=function(entry,opcode,payload){
    if(payload?.kind==='reset')throw new Error('injected backend Reset allocation failure');
    return submit.call(this,entry,opcode,payload);
   };
   params({0:3,1:2,2:22,11:1});
   assert.strictEqual(await invoke(e.reset,packed,pp),0x88760868);
   assert.strictEqual(e.target(packed),originalTarget,'failed backend Reset preserves packed allocation');
   assert.strictEqual(e.program(packed),originalProgram,'failed backend Reset preserves device state');
   assert.strictEqual(e.guest_read32(originalProgram+25600),23,'failed Reset preserves565 format');
   bridge._submit=submit;
   for(const format of [22,23,22]){
    params({0:3,1:2,2:format,11:1});assert.strictEqual(await invoke(e.reset,packed,pp),0);
    assert.strictEqual(e.guest_read32(e.program(packed)+25600),format);
    assert.strictEqual(await invoke(e.clear,packed),0);assert.strictEqual(await invoke(e.present,packed),0);
   }
   assert.strictEqual(await invoke(e.release,packed),0);
   params({0:640,1:480,2:23,8:0,12:60});assert.strictEqual(e.create(pp,out),0);
   const fullscreen565=e.guest_read32(out)>>>0;
   assert.strictEqual(e.guest_read32(e.program(fullscreen565)+20660),23,'CMR3 fullscreen CreateDevice retains display565');
   assert.strictEqual(new DataView(memory.buffer).getUint16(e.target(fullscreen565)+16,true),16,'fullscreen device allocates16bpp');
   assert.strictEqual(await invoke(e.clear,fullscreen565),0);assert.strictEqual(await invoke(e.present,fullscreen565),0);
   params({2:22});assert.strictEqual(await invoke(e.reset,fullscreen565,pp),0);
   assert.strictEqual(await invoke(e.release,fullscreen565),0);
   params({13:0});assert.strictEqual(e.create(pp,out),0);const d=e.guest_read32(out)>>>0;
   assert.strictEqual(await invoke(e.clear,d),0,'create real backend before Reset');
   e.present(d);assert(e.get_d3d_render_token()<=-2,'DEFAULT waits for display boundary even for direct software');
   await bridge.wait(e.get_d3d_render_token());assert.strictEqual(await invoke(e.present,d),0);
   const extraTextures=[4,5].map(stage=>{
    assert.strictEqual(e.texture(d,out),0);const t=e.guest_read32(out)>>>0;
    assert.strictEqual(e.bindTexture(d,stage,t),0);assert.strictEqual(e.sampler(d,stage,3),0);return t;
   });
   const mat=e.guest_alloc(68);new Float32Array(memory.buffer,wa(mat),17).fill(.5);
   assert.strictEqual(e.material(d,mat),0);assert.strictEqual(e.light(d),0);
   const lightHead=e.guest_read32(e.program(d)+21996)>>>0;assert(lightHead);
   const rect=e.guest_alloc(16);[1,2,6,7].forEach((v,i)=>e.guest_write32(rect+i*4,v));
   assert.strictEqual(e.scissor(d,rect,0),0);
   // Word 11 is Flags. D3DPRESENTFLAG_LOCKABLE_BACKBUFFER (1) is admissible --
   // e2b6135f admitted it on purpose, because it is what D3D9 GetDC on the back
   // buffer requires, and Pawn 3 draws its whole board that way. Any OTHER flag
   // bit is still refused, so {11:2} keeps that half of the coverage; the
   // successful Reset below carries Flags=1 to pin the admission itself.
   for(const overrides of [{6:0},{6:2},{6:4},{11:2},{12:60},{13:2},{3:2},{4:2},{5:1},{8:0},{8:0,0:640,1:480,12:75}]){
    params(overrides);const target=e.target(d),before=moves.length;
    assert.strictEqual(await invoke(e.reset,d,pp),0x8876086c,JSON.stringify(overrides));
    assert.strictEqual(e.target(d),target);assert.strictEqual(moves.length,before,'invalid mode does not resize host');
    extraTextures.forEach(t=>assert.strictEqual(e.guest_read32(t+20),1,'failed Reset preserves appended bindings'));
    assert.strictEqual(e.guest_read32(e.program(d)+21996)>>>0,lightHead,'failed Reset retains light nodes');
    assert.strictEqual(new Float32Array(memory.buffer,wa(e.program(d))+21928,1)[0],.5);
    assert.strictEqual(e.scissor(d,rect,1),0);
    assert.deepStrictEqual(Array.from(new Uint32Array(memory.buffer,wa(rect),4)),[1,2,6,7]);
   }
   params({0:0,1:0,2:0,6:3,11:1});assert.strictEqual(await invoke(e.reset,d,pp),0,
    'Reset admits D3DPRESENTFLAG_LOCKABLE_BACKBUFFER');
   assert.strictEqual(e.guest_read32(e.program(d)+21996),0,'successful Reset clears light list');
   assert.strictEqual(e.scissor(d,rect,1),0);
   assert.deepStrictEqual(Array.from(new Uint32Array(memory.buffer,wa(rect),4)),[0,0,12,10],
     'successful Reset restores resized full-target scissor');
   e.guest_free(rect);
   assert(new Uint8Array(memory.buffer,wa(e.program(d))+21928,68).every(v=>v===0),'successful Reset restores zero material');
   // KNOWN FAILING, and it is NOT the Flags staleness fixed above -- it fails
   // identically with and without that change; it was simply masked, because
   // the Flags assertion aborted this test long before reaching here.
   // What is established: $d3d9_lights_free does heap_free every node, and the
   // "clears light list" assertion above passes, so there is no dangling
   // pointer. What this asserts instead is that one specific address is still
   // visible as a free-list entry, which a coalescing free or an immediate
   // reuse by Reset's own state/shared allocations would legitimately break.
   // Deciding it needs someone to say whether Reset leaks or the allocator
   // merged the block -- do not "fix" it by deleting the assertion.
   let free=e.free_head()>>>0,lightFreed=false;
   for(let i=0;free&&i<1000;i++,free=e.guest_read32(free+4)>>>0)if(free===lightHead-4)lightFreed=true;
   assert(lightFreed,'successful Reset retires old light allocation');
   e.guest_free(mat);
   extraTextures.forEach((t,i)=>{
    assert.strictEqual(e.guest_read32(t+20),0,'successful Reset unbinds appended texture');
    assert.strictEqual(e.guest_read32(e.program(d)+21792+i*4),0);
    assert.strictEqual(e.guest_read32(e.program(d)+21800+i*64+4),1,'appended sampler resets to default');
    assert.strictEqual(e.releaseTexture(t),0);
   });
   assert.strictEqual(e.size(d),12|(10<<16),'windowed zero dimensions use client');
   params({0:800,1:600,8:0,12:60});const before=moves.length;
   let result=e.reset(d,pp);
   if(async){assert(e.get_d3d_render_token()<=-2);assert.strictEqual(moves.length,before,'pending Reset does not resize window');}
   while(e.get_d3d_render_token()){await bridge.wait(e.get_d3d_render_token());result=e.reset(d,pp);}
   assert.strictEqual(result,0);assert.strictEqual(e.size(d),800|(600<<16));
   assert.strictEqual(e.desktop(),800|(600<<16),'fullscreen publishes virtual display mode');
   assert.deepStrictEqual(moves.at(-1),[1,0,0,800,600,0]);assert.strictEqual(moves.length,before+1);
   params();const fullscreenMoves=moves.length;assert.strictEqual(await invoke(e.reset,d,pp),0);
   assert.strictEqual(moves.length,fullscreenMoves,'windowed Reset does not force host position or dimensions');
   assert.strictEqual(e.desktop(),originalDesktop,'windowed transition restores desktop dimensions');
   const retiredTextures=[4,5].map(stage=>{
    assert.strictEqual(e.texture(d,out),0);const texture=e.guest_read32(out)>>>0;
    const pixels=e.guest_read32(texture+80)>>>0;
    assert.strictEqual(e.bindTexture(d,stage,texture),0);
    assert.strictEqual(e.releaseTexture(texture),0,'bound texture survives external release');
    assert.strictEqual(e.guest_read32(texture+20),1);
    return {texture,pixels};
   });
   assert.strictEqual(await invoke(e.release,d),0);
   // Verify actual heap retirement, not only reference counters on stale bytes.
   await bridge.close();
   const freed=p=>{
    const seen=new Set();let at=e.get_free_list()>>>0;
    while(at){
     assert(!seen.has(at)&&seen.size<100000,'bounded acyclic native free list');seen.add(at);
     const size=e.guest_read32(at)>>>0;
     if(p>=at+4&&p<at+size)return true;
     at=e.guest_read32(at+4)>>>0;
    }
    return false;
   };
   for(const {texture,pixels}of retiredTextures){
    assert(freed(texture),'device destruction retires appended-stage texture object');
    assert(freed(pixels),'device destruction retires appended-stage texture pixels');
   }
  }finally{await bridge.close();}
 }
 console.log('PASS Reset presentation validation, windowed dimensions, fullscreen deferred resize and direct/worker transaction parity');
})().catch(e=>{console.error(e);process.exitCode=1;});
