#!/usr/bin/env node
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const {Worker}=require('worker_threads');
const {bootRenderHarness}=require('./render-helper');
const {Bridge}=require('../lib/d3d9-host');
const {WorkerConsumer}=require('../lib/d3d-command-stream');
const sigs=require('../lib/host-import-sigs.generated.json').sigs;
const apis=require('../src/api_table.json');
const u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255];
(async()=>{
  let bridge,worker,consumer,waits=0;
  const submissions=new Map();
  const {exports:e,memory,module}=await bootRenderHarness({fonts:'none',
    extraHostOverrides:{gpu_gl_call(op,p,a){
      submissions.set(op,(submissions.get(op)||0)+1);return bridge.call(op,p,a);
    }},extraWat:`
    (func (export "api_thunk") (param $id i32) (result i32)
      (call $gl32 (call $init_com_vtable (local.get $id) (i32.const 1))))
    (func (export "start_inline") (param $code i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x07000000))
      (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0))
      (global.set $eip (local.get $code)))
    (func (export "target_bits") (param $d i32) (result i32)
      (load.field DxObject misc1 (call $d3ddev_rt_entry (local.get $d))))
    (func (export "state_guard_held") (result i32)
      (i32.atomic.load offset=36 (global.get $DX_PROCESS_STATE)))
  `});
  const pe=fs.readFileSync(path.join(__dirname,'binaries/calc.exe'));
  new Uint8Array(memory.buffer).set(pe,e.get_staging());assert.ok(e.load_pe(pe.length));
  e.init_dx_com_thunks();
  bridge=new Bridge({backend:'software',enableProgrammable:true,softwareQuadBudget:1,
    getExports:()=>e,getMemory:()=>memory.buffer,guestToWasm:p=>e.guest_to_wasm(p)>>>0,
    createSoftwareWorker(){
      worker=new Worker(path.join(__dirname,'../lib/d3d-render-worker.js'));
      consumer=new WorkerConsumer(worker,{module,memory,sigs,imageBase:e.get_image_base()>>>0,
        sourceVersion:'guest-render-worker-test',reclaimHeap(head){
          assert.strictEqual(worker.threadId,-1);return e.d3d_render_adopt_free_list(head);
        }});return consumer;
    }});
  const alloc=n=>e.guest_alloc(n)>>>0,wa=p=>e.guest_to_wasm(p)>>>0;
  const read=p=>e.guest_read32(p)>>>0,marker=alloc(4),out=alloc(4);
  const callers=[]; // Keep executable bytes alive; do not recycle decoded code addresses.
  async function call(name,args,onPending=()=>{}) {
    const code=alloc(128),id=apis.find(a=>a.name===name).id;
    callers.push(code);
    new Uint8Array(memory.buffer).set([
      ...args.slice().reverse().flatMap(v=>[0x68,...u32(v)]),
      0xb8,...u32(e.api_thunk(id)),0xff,0xd0,0xa3,...u32(marker),0xc3,
    ],wa(code));
    e.guest_write32(marker,0xdeadbeef);e.clear_yield();e.start_inline(code);
    for(let slices=0;e.get_eip();slices++) {
      assert(slices<100,'bounded guest continuation');e.run(1000);
      assert.strictEqual(e.state_guard_held(),0,'native guard released before render waits and guest continuation');
      if(e.get_yield_reason()===16) {
        const token=e.get_d3d_render_token();assert(token<=-2);
        assert.strictEqual(read(marker),0xdeadbeef,'guest cannot return early');
        waits++;onPending();await bridge.wait(token);e.clear_yield();
      }
    }
    assert.strictEqual(e.get_esp()>>>0,0x07000004,name);
    assert.strictEqual(read(marker),0,`${name}: ${bridge.lastError||''}`);
  }
  try {
    const pp=alloc(64);new Uint8Array(memory.buffer,wa(pp),64).fill(0);
    [8,8,21,1,0,0,1,1].forEach((v,i)=>e.guest_write32(pp+i*4,v));
    await call('IDirect3D9_CreateDevice',[0,0,1,1,0,pp,out]);const device=read(out);
    for(const [state,value] of [[137,0],[7,0],[22,1]])
      await call('IDirect3DDevice9_SetRenderState',[device,state,value]);
    await call('IDirect3DDevice9_SetFVF',[device,0x44]);
    const vertices=alloc(60),v=new DataView(memory.buffer);
    [[0,0,.5,1],[8,0,.5,.5],[0,8,.5,.25]].forEach((p,i)=>{
      p.forEach((n,j)=>v.setFloat32(wa(vertices)+20*i+4*j,n,true));
      v.setUint32(wa(vertices)+20*i+16,0xff00ff00,true);
    });
    const pixels=new Uint32Array(memory.buffer,e.target_bits(device)>>>0,64);
    pixels.fill(0xff123456);
    await call('IDirect3DDevice9_DrawPrimitiveUP',[device,4,1,vertices,20],()=>{
      new Uint8Array(memory.buffer,wa(vertices),60).fill(0);
      assert(pixels.every(p=>p===0xff123456),'draw completion is not Present');
    });
    await call('IDirect3DDevice9_Present',[device,0,0,0,0],()=>{
      assert(pixels.every(p=>p===0xff123456),'canonical pixels wait for Present poll');
    });
    for(let y=0;y<8;y++)for(let x=0;x<8;x++)
      assert.strictEqual(pixels[y*8+x],x+y<8?0xff00ff00:0,`pixel ${x},${y}`);
    assert.strictEqual(submissions.get(0x30001),1,'native retry submits once');
    assert.strictEqual(submissions.get(0x30002),1,'Present retry submits once');
    // Actual game-sized UP draw, beyond both per-batch triangle and vertex
    // limits. All batches remain one COM call and one queue completion.
    const count=2950,large=alloc(count*60),oldPixels=pixels.slice();
    for(let i=0;i<count;i++)for(let j=0;j<3;j++){
      const at=wa(large)+i*60+j*20;
      [j===1?8:0,j===2?8:0,.5,1].forEach((n,k)=>v.setFloat32(at+k*4,n,true));
      v.setUint32(at+16,i&1?0xffff0000:0xff0000ff,true);
    }
    const entry=bridge.devices.get(device),beforeSubmitted=entry.queue.submitted;
    await call('IDirect3DDevice9_DrawPrimitiveUP',[device,4,count,large,20],()=>{
      new Uint8Array(memory.buffer,wa(large),count*60).fill(0);
      assert.deepStrictEqual(pixels,oldPixels,'intermediate batches cannot publish canonical pixels');
    });
    assert.strictEqual(entry.queue.submitted,beforeSubmitted+1,'large draw is one ordered command');
    // The draw is deferred: the guest is back before its batches retire, and
    // it is the Present that waits for them.
    assert.strictEqual(submissions.get(0x30001),2,'large native retry still submits only once');
    // Present is pipelined one frame deep: this second Present returns at
    // once with its frame in flight, and the third parks on it and publishes.
    await call('IDirect3DDevice9_Present',[device,0,0,0,0]);
    assert.deepStrictEqual(pixels,oldPixels,'the frame in flight is not published by its own Present');
    await call('IDirect3DDevice9_Present',[device,0,0,0,0],()=>{
      assert.deepStrictEqual(pixels,oldPixels,'large completed draw remains hidden until Present poll');
    });
    for(let y=0;y<8;y++)for(let x=0;x<8;x++)
      assert.strictEqual(pixels[y*8+x],x+y<8?0xffff0000:0,`large pixel ${x},${y}`);
    assert.strictEqual(submissions.get(0x30002),3);
    e.guest_free(large);
    await call('IDirect3DDevice9_Release',[device]);
    assert.strictEqual(submissions.get(0x30004),1);
    assert(waits>=3,'actual asynchronous guest draw, Present and Release');
  } finally {await bridge.close();for(const code of callers)e.guest_free(code);}
  assert.strictEqual(worker.threadId,-1);
  assert(consumer.shutdownInfo.heapAdopted>0,'worker native heap returned after exit');
  console.log('PASS real x86 COM -> async Bridge -> production WAT worker -> canonical Present and retirement');
})().catch(error=>{console.error(error);process.exitCode=1;});
