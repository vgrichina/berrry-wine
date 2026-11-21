'use strict';
// Actual production dispatcher/COM/renderer and real OS Worker RPC. Window,
// stack, review, trust and graphics-owner setup are fixtures, not manual play.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
const RPC=require('../lib/guest-rpc');
const sigs=require('../lib/host-import-sigs.generated.json').sigs;
const apis=require('../src/api_table.json');
const bases=require('../lib/region-map.generated').BASE;
const extraWat=String.raw`
(func (export "receipt_scene")
 (global.set $image_base (i32.const 0x400000))
 (global.set $main_hwnd (i32.const 10))
 (global.set $focus_hwnd (i32.const 10))
 (call $wnd_table_set (i32.const 10) (i32.const 0x401000))
 (drop (call $wnd_set_style (i32.const 10) (i32.const 0x90000000)))
 (global.set $DX_VTBL_DINPUT7 (i32.const 0x51000100))
 (global.set $DX_VTBL_DIDEV7 (i32.const 0x51000700)))
(func (export "receipt_root") (result i32)
 (local $root i32)
 (local.set $root (call $dx_create_com_obj (i32.const 6) (global.get $DX_VTBL_DINPUT7)))
 (store.field DxObject misc0 (call $dx_from_this (local.get $root)) (i32.const 0x0700))
 (local.get $root))
(func (export "receipt_call") (param $api i32) (param $stack i32)
 (i32.store (call $thunk_metadata_addr (i32.const 0)) (i32.const 0x80000000))
 (i32.store offset=4 (call $thunk_metadata_addr (i32.const 0)) (local.get $api))
 (i32.store offset=16 (global.get $reg_base) (local.get $stack))
 (global.set $eip (i32.const 0x401000))
 (call $win32_dispatch (i32.const 0)))
(func (export "receipt_focus") (param i32) (global.set $focus_hwnd (local.get 0)))
`;
if(!isMainThread){
  let e;
  const rpc=RPC.createWorkerImports(workerData.memory,sigs,m=>parentPort.postMessage(m),
    {slot:workerData.slot,getExports:()=>e,guestToWasm:p=>p-0x400000+bases.GUEST_BASE});
  const observer=require('../tools/jig-owning-api-observer')({host:rpc.imports.host,apis,
    names:['IDirectInputDevice_GetDeviceData','IDirectInputDevice_Release'],
    getExports:()=>e,getBuffer:()=>workerData.memory.buffer,g2w:p=>p-0x400000+bases.GUEST_BASE,context:'OS Worker'});
  e=new WebAssembly.Instance(workerData.module,rpc.imports).exports;
  e.receipt_scene();observer.bindBaseline();observer.arm();
  parentPort.on('message',({id,method,args})=>{
    try{parentPort.postMessage({id,result:method==='observer'?observer.snapshot():e[method](...args)});}
    catch(error){parentPort.postMessage({id,error:error.stack});}
  });
}else (async()=>{
  const compiled=require('./render-artifact').compileHarness({extraWat,tailCalls:true});
  const evidence=process.env.DI7_EVIDENCE_DIR;
  if(evidence){fs.writeFileSync(evidence+'/fixture.wasm',compiled.bytes);
    fs.writeFileSync(evidence+'/fixture-identity.json',JSON.stringify(compiled.identity,null,2)+'\n');}
  const module=new WebAssembly.Module(compiled.bytes);
  const {createBrowserNativeInput}=require('../lib/browser-native-input');
  const observations=[];
  for(const workerMode of process.env.DI7_MODE==='main'?[false]:process.env.DI7_MODE==='worker'?[true]:[false,true]){
    let e,guard,observer,actor=0,clock=1000;
    const context=()=>{
      const g=e.wnd_lookup_generation(10);
      return [e.get_current_thread_id(),e.get_process_id(),10,e.get_focus_hwnd(),0,0,
        Number(g&0xffffffffn),Number(g>>32n),Number(g&0xffffffffn),Number(g>>32n)];
    };
    const h=await require('./render-helper').bootRenderHarness({prebuiltModule:module,fonts:'none',
      beforeInstantiate(ctx,host){
        if(!workerMode)observer=require('../tools/jig-owning-api-observer')({host,apis,
          names:['IDirectInputDevice_GetDeviceData','IDirectInputDevice_Release'],
          getExports:()=>e,getBuffer:()=>host.memory.buffer,g2w:p=>p-0x400000+bases.GUEST_BASE,
          context:workerMode?'worker':'main',emit:r=>observations.push(r)});
        host.di_mouse_receipt=(...a)=>guard?.withActor(actor,'di_mouse_receipt',()=>
          guard.directInput(...a,[...context(),a[4]?a[4]-0x400000+bases.GUEST_BASE:0]))||0;
      }});
    e=h.exports;e.set_process_id(7);e.receipt_scene();
    if(observer){observer.bindBaseline();observer.arm();}
    h.renderer.processId=7;
    h.renderer.createWindow(10,0x90000000,0,0,320,200,'fixture',0,h.instance,h.memory);
    h.renderer.windows[10].processId=7;
    const rect={left:0,top:0,right:640,bottom:480,width:640,height:480};
    h.canvas.getBoundingClientRect=()=>rect;
    // A fixture graphics identity keeps GPU setup out of input tests.
    const gps={endpoint:{},presenter:{layer:{canvas:{}}}};
    const wine={renderer:h.renderer,instance:h.instance,memory:h.memory,_wasmModule:module,
      _processObject:{},running:true,processId:7,guestWorker:{link:{slot:0,worker:{},endpointIdentity:1}},
      hostCtx:{getGlGpsBridge:()=>gps}};
    guard=createBrowserNativeInput(wine,{now:()=>clock,monotonic:()=>clock-1000,trusted:()=>true});
    let binding;
    const host={...h.host,
      input_validate:(token,...v)=>guard.validate(token,v),
      di_mouse_receipt:(...a)=>guard.directInput(...a.slice(0,5),a.slice(5))};
    Object.defineProperty(host,'browserInputScope',{value:guard});
    const broker=RPC.createMainBroker(h.memory,host,sigs);
    let worker,serial=0;const pending=new Map();
    const ask=(method,...args)=>{
      if(!worker)return Promise.resolve(e[method](...args));
      return new Promise((resolve,reject)=>{
        const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error('native Worker deadline'));},10000);
        pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject});
        worker.postMessage({id,method,args});
      });
    };
    try{
      if(workerMode){
        worker=new Worker(__filename,{workerData:{module,memory:h.memory,slot:0}});
        worker.on('message',m=>{
          if(m.t==='rpc')broker.serveRpc(m.slot);
          else {const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error)):p.resolve(m.result);}}
        });
        worker.on('error',error=>{for(const p of pending.values())p.reject(error);});
      }
      const wr=(p,v)=>e.guest_write32(p,v),rd=p=>e.guest_read32(p)>>>0;
      const root=await ask('receipt_root');
      const guid=0x410000,iid=0x410020,result=0x410040,format=0x411000,objects=0x412000,data=0x413000,count=0x414000;
      [0x6f1d2b60,0x11cfd5a0,0x4544c7bf,0x00005453].forEach((v,i)=>wr(guid+i*4,v));
      [0x57d7c6bc,0x11d32356,0xc0009d8e,0xae44684f].forEach((v,i)=>wr(iid+i*4,v));
      [24,16,2,16,7,objects].forEach((v,i)=>wr(format+i*4,v));
      for(let i=0;i<7;i++)[0,i<3?i*4:i+9,i<3?0xffff03:0xffff0c,0].forEach((v,j)=>wr(objects+i*16+j*4,v));
      async function call(name,args){
        const stack=0x074f0000;wr(stack,0x401004);args.forEach((v,i)=>wr(stack+4+i*4,v));
        await ask('receipt_call',apis.find(a=>a.name===name).id,stack);
        const hr=await ask('get_eax');return hr>>>0;
      }
      async function create(){
        assert.equal(await call('IDirectInput7_CreateDeviceEx',[root,guid,iid,result,0]),0);
        const p=rd(result);assert.equal(rd(p),0x51000700);
        assert.equal(await call('IDirectInputDevice_SetDataFormat',[p,format]),0);
        assert.equal(await call('IDirectInputDevice_Acquire',[p]),0);return p;
      }
      let mouse=await create();
      const poll=async(flags=0,n=16,ptr=data,p=mouse)=>{
        wr(count,n);const hr=await call('IDirectInputDevice_GetDeviceData',[p,16,ptr,count,flags]);
        return {hr,count:rd(count),bytes:ptr?Array.from(new Uint8Array(h.memory.buffer,ptr-0x400000+bases.GUEST_BASE,rd(count)*16)):[]};
      };
      await poll();assert(guard.snapshot().ready,JSON.stringify({native:context(),guard:guard.snapshot()}));binding=guard.bind();
      const prepare=(nonce,kind='mouse',x=70,y=80)=>guard.prepare({owner:binding.owner,nonce,kind,consumer:'directinput-buffered',
        code:1,button:0,x,y,reviewed:true,reviewedAt:clock,imageSHA256:'a'.repeat(64)});
      // Independent UP before native consumption must not retire buffered DOWN.
      prepare('edge');h.renderer.handleMouseDown(70,80,0);h.renderer.handleMouseUp(70,80,0);
      assert.equal(guard.status('edge').state,'DELIVERY_PENDING');
      assert.equal(guard.status('edge').consumed,false);
      const head=()=>Atomics.load(new Int32Array(h.memory.buffer),(bases.DI_MOUSE_INPUT_STATE>>>2)+2)>>>0;
      const before=head();assert.equal((await poll(0,16,0)).count,2);assert.equal(head(),before);
      assert.equal(guard.status('edge').consumed,false,'count-only is not consumption');
      const peek=await poll(1);assert.equal(peek.count,2);assert.equal(head(),before);
      assert.equal(guard.status('edge').consumed,false,'PEEK must not consume');
      assert(guard.status('edge').nativePeek);const read=await poll();assert.deepEqual(read,peek);
      const edge=guard.status('edge');assert(edge.consumed);assert.equal(edge.nativeDirectInput.length,1);
      assert.equal(edge.nativeDirectInput[0].data,128);assert.equal(edge.nativeUp.data,0);
      assert.equal(edge.nativeDirectInput[0].sequence+1,edge.nativeUp.sequence);
      prepare('decoy');h.renderer._queueDirectInputMouseButton(h.memory,1,true);
      await poll();assert.equal(guard.status('decoy').state,'PREPARED','equal native DOWN bytes without physical application have no lineage');
      h.renderer.handleMouseDown(70,80,0);h.renderer.handleMouseUp(70,80,0);await poll();
      assert(guard.status('decoy').consumed);
      // Equal motion totals are irrelevant: real +5/-5 publications have
      // different ring positions and each needs its own native consumption.
      h.renderer.handleMouseMove(70,80);await poll();
      for(const [nonce,x,delta] of [['plus',75,5],['minus',70,-5]]){
        prepare(nonce,'motion',x);h.renderer.handleMouseMove(x,80);
        assert.equal(guard.status(nonce).consumed,false);await poll();
        const receipt=guard.status(nonce);assert(receipt.consumed);assert.equal(receipt.nativeDirectInput[0].data>>>0,delta>>>0);
      }
      prepare('no-motion','motion');h.renderer.handleMouseMove(70,80);await poll();
      assert.equal(guard.status('no-motion').state,'UNKNOWN');
      // Native Unacquire/reacquire and final Release fence queued tickets.
      prepare('unacquire');h.renderer.handleMouseDown(70,80,0);h.renderer.handleMouseUp(70,80,0);
      const oldGeneration=guard.status('unacquire').device.generation;
      assert.equal(await call('IDirectInputDevice_Unacquire',[mouse]),0);
      assert.equal((await poll()).hr,0x8007000c);
      assert.equal(await call('IDirectInputDevice_Acquire',[mouse]),0);await poll();
      assert.equal(guard.status('unacquire').consumed,false);
      prepare('same-pointer-new-acquisition');h.renderer.handleMouseDown(70,80,0);h.renderer.handleMouseUp(70,80,0);await poll();
      assert(guard.status('same-pointer-new-acquisition').consumed);
      assert.notEqual(guard.status('same-pointer-new-acquisition').device.generation,oldGeneration);
      prepare('late');h.renderer.handleMouseDown(70,80,0);h.renderer.handleMouseUp(70,80,0);
      clock+=501;await poll();assert.equal(guard.status('late').consumed,false);
      prepare('release');h.renderer.handleMouseDown(70,80,0);h.renderer.handleMouseUp(70,80,0);
      const old=mouse;assert.equal(await call('IDirectInputDevice_Release',[mouse]),0);
      mouse=await create();
      assert.notEqual(mouse,old,'allocator prefers fresh slots; immediate reuse is not required');
      await poll();assert.equal(guard.status('release').consumed,false);
      prepare('new');h.renderer.handleMouseDown(70,80,0);h.renderer.handleMouseUp(70,80,0);await poll();
      assert(guard.status('new').consumed);assert.notDeepEqual(guard.status('new').device,edge.device);
      const other=await create();await poll(); // restore mouse as last native consumer
      prepare('wrong-device');h.renderer.handleMouseDown(70,80,0);h.renderer.handleMouseUp(70,80,0);
      await poll(0,16,data,other);assert.equal(guard.status('wrong-device').consumed,false);
      await poll();prepare('wrong-actor');h.renderer.handleMouseDown(70,80,0);h.renderer.handleMouseUp(70,80,0);
      if(workerMode)await ask('set_current_thread_id',2);else actor=1;
      assert.equal((await poll()).count,1,'wrong native actor cannot deliver tagged DOWN; independent UP remains deliverable');
      assert.equal(guard.status('wrong-actor').consumed,false);
      const native=workerMode?await ask('observer'):observer.snapshot();
      assert.deepEqual(native.errors,[]);assert(native.records.every(r=>r.completed));
      assert(native.records.length);observations.push(native);
      if(evidence)fs.writeFileSync(evidence+'/'+(workerMode?'worker':'main')+'-native.json',JSON.stringify({native,
        receipts:['edge','decoy','plus','minus','no-motion','unacquire','same-pointer-new-acquisition','late','release','new','wrong-device','wrong-actor'].map(n=>guard.status(n))},null,2)+'\n');
      console.log('PASS native '+(workerMode?'OS Worker/RPC':'main')+' DI7 sequence lineage, PEEK/count-only, independent UP, motion and COM/acquisition lifetime');
    }finally{if(worker)await worker.terminate();}
  }
  assert(observations.length);console.log('PASS native observer boundary '+observations.length+' records');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
