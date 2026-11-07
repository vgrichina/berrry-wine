#!/usr/bin/env node
'use strict';
// Real process-owner scheduler, replay, adapter and GPU; only native exports
// and the driver are controlled. Holding a fence must not release the batch.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const negative = process.argv.find(a=>a.startsWith('--negative-control='))?.split('=')[1];
function source(file) {
  let s=fs.readFileSync(path.join(root,'lib',file),'utf8');
  if(negative==='no-await' && file==='d3d-render-worker.js')
    s=s.replace('await adapter.fenceFlip()', 'adapter.fenceFlip()');
  if(negative==='no-identity' && file==='d3dim-gpu.js')
    s=s.replace("throw new Error('Flip readback target replaced or retired');", 'void 0;');
  return s;
}
const Module = require('node:module'), gpuModule = new Module(path.join(root,'lib/d3dim-gpu.js'),module);
gpuModule.filename=path.join(root,'lib/d3dim-gpu.js');gpuModule.paths=Module._nodeModulePaths(path.join(root,'lib'));
gpuModule._compile(source('d3dim-gpu.js'),gpuModule.filename);
const {D3DIMGpu}=gpuModule.exports;
const tick = () => new Promise(resolve => setTimeout(resolve, 5));
async function fixture({version = 2, peers = 1, waitFailure = false} = {}) {
  const memory = {buffer:new SharedArrayBuffer(6 * 1024 * 1024)}, events = [], owners = [], messages = [];
  const u8 = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
  const dib = 0x500000, other = dib + 64, front = 512, back = 576;
  dv.setUint32(front + 20, other, true); dv.setUint32(back + 20, dib, true);
  u8.fill(0x77, dib, other + 64);
  let allocation = 4096, signaled = false, live = true, snapshot = 0;
  const draws=[];
  const ex = {d3dim_worker_init(){}, guest_to_wasm:p=>p,
    guest_alloc(n){const p=allocation; allocation+=n; return p;},
    d3d_render_retire_heap(){return 0;},
    d3d_render_reset_transients(){events.push('reset');},
    d3dim_gpu_surface_live(){return live;},
    d3dim_worker_draw(){events.push('draw');},
    d3dim_gpu_state_override(p){snapshot=p;},
    page_watch_write(){events.push('write');},
    d3dim_worker_flip(f,b){
      events.push('flip'); const a=dv.getUint32(f+20,true);
      dv.setUint32(f+20,dv.getUint32(b+20,true),true);dv.setUint32(b+20,a,true);
    }};
  let bound = null;
  const gl = {RGBA:1,UNSIGNED_BYTE:2,PIXEL_PACK_BUFFER:3,STREAM_READ:4,SYNC_GPU_COMMANDS_COMPLETE:5,
    TIMEOUT_EXPIRED:6,ALREADY_SIGNALED:7,CONDITION_SATISFIED:8,WAIT_FAILED:9,
    createBuffer(){events.push('pbo');return {};},deleteBuffer(){events.push('delete-buffer');},
    bindBuffer(_,b){bound=b;},bufferData(){assert(bound);},
    readPixels(x,y,w,h,f,t,out){
      if(typeof out==='number'){assert(bound);events.push('issue');}
      else {events.push('sync-read');out.set([1,2,3,255,4,5,6,255,7,8,9,255,10,11,12,255]);}
    },
    fenceSync(){events.push('sync');return {};},deleteSync(){events.push('delete-sync');},flush(){events.push('flush');},
    getExtension(){return null;},getParameter(){return version===2?'WebGL 2.0 fixture':'WebGL 1.0 fixture';},
    clientWaitSync(sync,flags,timeout){assert.equal(flags,0);assert.equal(timeout,0);events.push('poll');
      return waitFailure?9:signaled?7:6;},
    getBufferSubData(_,offset,out){assert(signaled,'collection must follow signaled fence');assert(bound);
      events.push('collect');out.set([1,2,3,255,4,5,6,255,7,8,9,255,10,11,12,255]);},
  };
  const context = vm.createContext({console,performance,ArrayBuffer,SharedArrayBuffer,Uint8Array,Int32Array,DataView,Atomics,
    setTimeout,clearTimeout,WebAssembly:{Memory:WebAssembly.Memory,Module:WebAssembly.Module,instantiate:async()=>({exports:ex})},
    postMessage:m=>messages.push(m),importScripts(){},
    D3DIMGpu:{D3DIMGpu:class extends D3DIMGpu {constructor(options){super(options);owners.push(this);
      this.targets.set(back,{rt:back,dib,width:2,height:2,pitch:8,bpp:32,format:0,dirty:true,
        device:{gpu:{version,gl,bindImplicitTarget(){}},destroy(){events.push('destroy');}},
        watch:{capture(){events.push('capture');},release(){events.push('release');}}});
    }
    _draw(wa){draws.push([dv.getUint32(snapshot,true),dv.getUint32(dv.getUint32(wa+12,true),true)]);return 1;}
    }}});
  context.self=context;
  vm.runInContext(source('d3dim-render-worker.js'),context);
  vm.runInContext(source('d3d-render-worker.js')+
    '\nglobalThis.drain=()=>messageChain;',context);
  const send=m=>context.onmessage({data:m});
  send({t:'render-init',imageBase:0x400000,memory,module:{}});await context.drain();
  const controls=[],buffers=[];
  for(let id=1;id<=peers;id++){
    send({t:'render-open',endpointId:id,options:{api:'legacy',backend:'webgl'}});await context.drain();
    controls[id]=new Int32Array(new SharedArrayBuffer(64));buffers[id]=new SharedArrayBuffer(16384);
    send({t:'render-message',endpointId:id,message:{t:'init',control:controls[id].buffer,buffers:[buffers[id]]}});await context.drain();
  }
  events.length=0;
  function batch(seq=1,withDraws=false){const d=new DataView(buffers[1]);let offset=0;
    function draw(value){
      [4224,back,4,3,3,4096,96,0].forEach((v,i)=>d.setUint32(offset+i*4,v,true));
      d.setUint32(offset+32,value,true);d.setUint32(offset+4128,value+1,true);offset+=4224;
    }
    if(withDraws)draw(0x1122);
    [32,front,back,0,0,0,0,1].forEach((v,i)=>d.setUint32(offset+i*4,v,true));offset+=32;
    if(withDraws)draw(0x3344);
    send({t:'render-message',endpointId:1,message:{t:'batch',index:0,bytes:offset,commands:withDraws?3:1,seq,imageBase:0x400000}});
  }
  return {batch,send,events,owners,controls,u8,dib,other,ex,messages,context,draws,
    signal(){signaled=true;},die(){live=false;},gl};
}
(async()=>{
  {
    const f=await fixture();f.batch(1,true);await tick();
    assert(f.events.includes('poll'),'production queued Flip must poll pending readback');
    assert.equal(f.controls[1][1],0,'snapshot/batch is still owned');
    assert(!f.events.includes('flip'));assert(!f.events.includes('reset'),'scratch survives the await');
    assert.deepEqual(f.draws,[[0x1122,0x1123]],'later snapshot cannot overwrite scratch while readback is pending');
    assert.deepEqual([...f.u8.slice(f.dib,f.dib+16)],Array(16).fill(0x77));
    // A queued teardown cannot overtake this read, but a passive timer can run.
    f.send({t:'render-message',endpointId:1,message:{t:'legacy-fence',seq:2,address:f.dib,length:16}});
    f.send({t:'render-close',endpointId:1});await tick();
    assert(!f.events.includes('destroy'));assert.equal(f.controls[1][1],0);
    f.signal();await f.context.drain();
    assert.equal(f.controls[1][1],2);assert.equal(f.controls[1][2],0);
    assert.equal(f.controls[1][4],1);assert.equal(f.controls[1][5],3);
    assert.equal(f.controls[1][11],1,'ordinary CPU read barrier succeeds after the owning Flip');
    assert(!f.events.includes('sync-read'),'CPU fence sees the completed DIB without another readback');
    assert.deepEqual(f.draws,[[0x1122,0x1123],[0x3344,0x3345]],'replay resumes with the next owning snapshot');
    assert.deepEqual([...f.u8.slice(f.dib,f.dib+16)],[9,8,7,255,12,11,10,255,3,2,1,255,6,5,4,255]);
    assert.deepEqual([...f.u8.slice(f.other,f.other+16)],Array(16).fill(0x77));
    for(const [a,b] of [['collect','write'],['write','capture'],['capture','flip'],['flip','reset'],['reset','destroy']])
      assert(f.events.indexOf(a)<f.events.indexOf(b),`${a} before ${b}`);
    assert.equal(f.events.filter(x=>x==='delete-sync').length,1);
    assert.equal(f.events.filter(x=>x==='delete-buffer').length,1);
  }
  for(const cancel of ['dead','replacement','device','dib','wait-failed']){
    const f=await fixture({waitFailure:cancel==='wait-failed'});f.batch();await tick();
    if(cancel==='dead')f.die();
    if(cancel==='replacement')f.owners[0].targets.set(576,{...f.owners[0].targets.get(576)});
    if(cancel==='device')f.owners[0].targets.get(576).device={...f.owners[0].targets.get(576).device};
    if(cancel==='dib')f.owners[0].targets.get(576).dib=f.other;
    f.signal();await f.context.drain();
    assert.equal(f.controls[1][1],0,`${cancel}: no early COMPLETED`);
    assert.equal(f.controls[1][2],1,`${cancel}: endpoint reports failure`);
    assert(!f.events.includes('collect'));assert(!f.events.includes('flip'));
    assert.equal(f.events.filter(x=>x==='delete-sync').length,1);
    assert.equal(f.events.filter(x=>x==='delete-buffer').length,1);
    assert.deepEqual([...f.u8.slice(f.dib,f.dib+16)],Array(16).fill(0x77));
  }
  for(const options of [{version:1},{peers:2}]){
    const f=await fixture(options);f.batch();await f.context.drain();
    assert(f.events.includes('sync-read'));assert(!f.events.includes('pbo'));
    assert.equal(f.controls[1][1],1);assert(f.events.includes('flip'));
  }
  console.log('PASS production Flip yields with DIB/snapshot/scratch retained; bytes/order, teardown, cancellation, replacement, WebGL1 and multi-owner controls');
})().catch(e=>{console.error(e);process.exit(1);});
