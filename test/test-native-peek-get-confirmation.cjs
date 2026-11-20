'use strict';
// Actual guard plus the production RPC encoder/broker and native USER handlers
// running in a real Worker. No game state, generated receipt model or clock shim
// is used by the native regression. NATIVE_CONFIRM_MODULE selects a retained
// coherent module; the default is the repository build.
const assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process');
const {Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
const {createBrowserNativeInput}=require('../lib/browser-native-input.js');
const RPC=require('../lib/guest-rpc.js');
const sigs={check_input:{params:[],results:['i32']},check_input_token:{params:[],results:['i32']},
  check_input_hwnd:{params:[],results:['i32']},check_input_lparam:{params:[],results:['i32']},
  input_validate:{params:['i32'],results:['i32']},input_consumed:{params:Array(5).fill('i32'),results:['i32']}};
function baseImports(memory){
  const ctx={getMemory:()=>memory.buffer,resourceJson:{menus:{},dialogs:{},strings:{},bitmaps:{}}};
  const imports=require('../lib/host-imports.js').createHostImports(ctx);
  Object.assign(imports.host,{memory,log(){},log_i32(){}});return imports;
}
async function nativeWorker(){
  const {memory,module}=workerData;let e;
  const rpc=RPC.createWorkerImports(memory,sigs,m=>parentPort.postMessage(m),
    {slot:0,getExports:()=>e,guestToWasm:p=>e.guest_to_wasm(p)});
  const imports=baseImports(memory);Object.assign(imports.host,rpc.imports.host);
  e=(await WebAssembly.instantiate(module,imports)).exports;
  const dv=new DataView(memory.buffer),wa=p=>e.guest_to_wasm(p)>>>0;
  const api=require('../src/api_table.json'),regions=require('../lib/region-map.generated.js');
  const names=['RegisterClassA','CreateWindowExA','PeekMessageA','GetMessageA','DispatchMessageA','PostQuitMessage'];
  const thunk=0x7500000,stack=0x510000,msg=0x520000,record=0x530000,proc=0x401000;
  e.init_thread(0,0x400000,0x400000,0x600000,thunk,thunk+names.length*8,names.length,0);e.set_process_id(7);
  names.forEach((name,i)=>dv.setUint32(regions.BASE.THUNK_BASE+i*8+4,api.find(a=>a.name===name).id,true));
  const u=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
  // Real x86 wndproc: record only WM_KEYDOWN and return normally.
  new Uint8Array(memory.buffer).set([0x81,0x7c,0x24,8,...u(0x100),0x75,6,0xff,0x05,...u(record),0xb8,1,0,0,0,0xc2,16,0],wa(proc));
  function call(name,args){
    [0,...args].forEach((n,i)=>dv.setUint32(wa(stack)+i*4,n>>>0,true));
    e.clear_yield();e.set_esp(stack);e.set_eip(thunk+names.indexOf(name)*8);e.run(10000);
    return {eax:e.get_eax(),yield:e.get_yield_reason(),eip:e.get_eip(),esp:e.get_esp(),
      message:[0,4,8,12].map(o=>dv.getUint32(wa(msg)+o,true)),dispatchCount:dv.getUint32(wa(record),true)};
  }
  new Uint8Array(memory.buffer).set(Buffer.from('ConfirmFixture\0'),wa(0x540000));
  dv.setUint32(wa(0x540100)+4,proc,true);dv.setUint32(wa(0x540100)+36,0x540000,true);
  call('RegisterClassA',[0x540100]);
  const created=call('CreateWindowExA',[0,0x540000,0x540000,0x10000000,0,0,320,200,0,0,0x400000,0]);
  const h=e.get_main_hwnd();assert(h>0,JSON.stringify(created));e.set_focus_hwnd(h);
  for(let i=0;i<32;i++)if(!call('PeekMessageA',[msg,0,0,0,1]).eax)break;
  const peek=()=>call('PeekMessageA',[msg,0,0x100,0x100,0]);
  // Establish native context through the real Worker import before binding.
  peek();parentPort.postMessage({type:'ready',h});
  parentPort.on('message',m=>{
    if(m.type!=='go')return;
    try{
      const first=peek(),second=call('GetMessageA',[msg,0,0x100,0x100]);
      const before=dv.getUint32(wa(record),true);
      if(second.eax===1)call('DispatchMessageA',[msg]);
      const after=dv.getUint32(wa(record),true),empty=peek();
      call('PostQuitMessage',[23]);const quit=call('GetMessageA',[msg,0,0,0]);
      parentPort.postMessage({type:'result',first,second,before,after,empty,quit});parentPort.close();
    }catch(e){parentPort.postMessage({type:'error',error:e.stack});parentPort.close();}
  });
}
function fixture(){
  let wall=1000,mono=0;
  const scene=[1,7,10,10,0,10,1,0,1,0],words=[2,10,1,0,1,7];let generation=1n;
  const instance={exports:{capture_publication_word:i=>words[i],get_authoritative_capture_hwnd:()=>words[1],
    wnd_lookup_live:()=>1,wnd_lookup_generation:()=>generation,get_window_thread:()=>1}};
  const r={canvas:{},windows:{},inputQueue:[],downs:0,handleKeyDown(code){this.downs++;this.inputQueue.push({hwnd:10,msg:256,wParam:code,lParam:1});},handleKeyUp(){}};
  const gps={endpoint:{},presenter:{layer:{canvas:{}}}},wine={renderer:r,instance,memory:{buffer:new ArrayBuffer(128)},
    running:true,processId:7,_requireAuthoritativeCapture:true,_wasmModule:{},_processObject:{},
    guestWorker:{link:{slot:0,worker:{},endpointIdentity:1}},hostCtx:{getGlGpsBridge:()=>gps}};
  r.windows[10]={visible:true,wasm:instance,processId:7};
  const g=createBrowserNativeInput(wine,{now:()=>wall,monotonic:()=>mono,trusted:()=>true});
  const observe=()=>g.withActor(0,'check_input',()=>g.observe(scene));observe();const b=g.bind();
  g.prepare({owner:b.owner,nonce:'one',code:13,reviewed:true,reviewedAt:wall,imageSHA256:'a'.repeat(64)});
  r.handleKeyDown(13);const event=r.inputQueue.shift(),token=g.withActor(0,'check_input',()=>g.dequeued(event));
  const dv=new DataView(wine.memory.buffer);[10,256,13,1].forEach((n,i)=>dv.setUint32(32+i*4,n,true));
  const ack=(kind=2,remove=0,slot=0,tid=1,values=scene)=>g.withActor(slot,'input_consumed',()=>g.consumed(token,tid,32,kind,remove,[...values,32]));
  const validate=()=>g.withActor(0,'input_validate',()=>g.validate(token,scene));
  return {g,r,wine,gps,scene,words,dv,event,token,ack,validate,observe,
    clock:(w,m=w-1000)=>{wall=w;mono=m;},reuse:()=>generation++};
}
function guards(){
  for(const kind of [1,2,3]){
    const f=fixture();assert.equal(f.ack(),1);const first=f.g.status('one');assert(!first.nativeRemoval);
    assert.equal(f.ack(),1,'repeated nonremoving observation');assert.equal(f.validate(),1);
    assert.equal(f.ack(kind,1),1);const removed=f.g.status('one');
    assert.deepEqual(removed.nativeMessage,first.nativeMessage,'first Peek evidence remains honest');
    assert.equal(removed.nativeMessage.remove,false);assert.equal(removed.nativeRemoval.apiKind,kind);
    assert.equal(removed.nativeRemoval.remove,true);assert.equal(removed.consumedAt,first.consumedAt);
    assert.equal(f.validate(),0);assert.equal(f.ack(kind,1),0);assert.equal(f.ack(),0,'no post-removal replay');
    assert.equal(f.g.withActor(0,'check_input',()=>f.g.dequeued(f.event)),false);
    assert.equal(f.r.downs,1);assert.equal(f.r.inputQueue.length,0);
  }
  for(const fault of ['msg','hwnd','wparam','lparam','slot','tid','endpoint','actor','module','memory','window',
    'generation','focus','stale','deadline','monotonic','unknown','foreign-capture','serial','missing-capture']){
    const f=fixture();assert.equal(f.ack(),1);let slot=0,tid=1;
    if(['hwnd','msg','wparam','lparam'].includes(fault))f.dv.setUint32(32+['hwnd','msg','wparam','lparam'].indexOf(fault)*4,999,true);
    if(fault==='slot')slot=1;if(fault==='tid')tid=2;
    if(fault==='endpoint')f.wine.guestWorker.link.endpointIdentity++;
    if(fault==='actor')f.wine.guestWorker.link.worker={};
    if(fault==='module')f.wine._wasmModule={};
    if(fault==='memory')f.wine.memory={buffer:f.wine.memory.buffer};
    if(fault==='window')f.r.windows[10]={...f.r.windows[10]};
    if(fault==='generation')f.reuse();
    if(fault==='focus'){f.scene[3]++;f.observe();}
    if(fault==='stale')f.clock(1251);
    if(fault==='deadline'){f.clock(1500);f.observe();}
    if(fault==='monotonic'){f.clock(1000,500);f.observe();}
    if(fault==='unknown')f.g.close();
    if(fault==='foreign-capture')f.words[1]++;
    if(fault==='serial')f.words[0]+=2;
    if(fault==='missing-capture')delete f.wine.instance.exports.capture_publication_word;
    assert.equal(f.ack(1,1,slot,tid),0,fault);assert.equal(f.g.status('one').nativeRemoval,null,fault);
    assert.equal(f.r.downs,1);assert.equal(f.r.inputQueue.length,0);
  }
  console.log('PASS exact cached MSG acknowledgements and 21 refusal controls; original lease and one DOWN retained');
}
async function native(factory,module){
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const shadow=await WebAssembly.instantiate(module,baseImports(memory));
  const r={canvas:{},windows:{},inputQueue:[],downs:0,handleKeyDown(code){this.downs++;this.inputQueue.push({hwnd:this.h,msg:256,wParam:code,lParam:1});},handleKeyUp(){}};
  const gps={endpoint:{},presenter:{layer:{canvas:{}}}},wine={memory,instance:shadow,running:true,processId:7,
    _requireAuthoritativeCapture:true,_wasmModule:module,_processObject:{},renderer:r,
    guestWorker:{link:{slot:0,worker:{},endpointIdentity:1}},hostCtx:{getGlGpsBridge:()=>gps}};
  const g=factory(wine,{trusted:()=>true});let event;
  const table={check_input:(...v)=>{g.observe(v);g.sweep();event=r.inputQueue.shift();
      return event&&g.owns(event)&&g.dequeued(event)!==false?(event.wParam<<16)|event.msg:0;},
    check_input_token:()=>g.token(event),check_input_hwnd:()=>event?.hwnd||0,check_input_lparam:()=>event?.lParam||0,
    input_validate:(token,...v)=>g.validate(token,v),input_consumed:(token,tid,ptr,kind,remove,...v)=>g.consumed(token,tid,ptr,kind,remove,v)};
  Object.defineProperty(table,'browserInputScope',{value:g});const broker=RPC.createMainBroker(memory,table,sigs);
  const w=new Worker(__filename,{workerData:{memory,module}});wine.guestWorker.link.worker=w;
  let result;const timer=setTimeout(()=>{void w.terminate();},15000);
  try{
    await new Promise((resolve,reject)=>{
      w.on('error',reject);w.on('exit',code=>{if(!result)reject(Error('Worker exit '+code));else resolve();});
      w.on('message',m=>{try{
        if(m.t==='rpc')broker.serveRpc(m.slot);
        else if(m.type==='ready'){
          r.h=m.h;r.windows[m.h]={visible:true,wasm:shadow,processId:7};const b=g.bind();
          g.prepare({owner:b.owner,nonce:'native',code:13,reviewed:true,reviewedAt:Date.now(),imageSHA256:'b'.repeat(64)});
          r.handleKeyDown(13);broker.publish({inputPending:1});w.postMessage({type:'go'});
        }else if(m.type==='result')result=m;
        else if(m.type==='error')reject(Error(m.error));
      }catch(e){reject(e);}});
    });
    assert.equal(r.downs,1);assert.equal(r.inputQueue.length,0);return {...result,receipt:g.status('native')};
  }finally{clearTimeout(timer);await w.terminate();}
}
if(!isMainThread)nativeWorker().catch(e=>{parentPort.postMessage({type:'error',error:e.stack});parentPort.close();});
else (async()=>{
  guards();if(process.argv.includes('--guard-only'))return;
  const bytes=fs.readFileSync(process.env.NATIVE_CONFIRM_MODULE||'build/wine-assembly.wasm');
  const module=await WebAssembly.compile(bytes),Module=require('node:module'),old=new Module(__filename);
  old._compile(cp.execFileSync('git',['show','3b6b370cc50f5728b7d763315ef3f0641b560111:lib/browser-native-input.js'],{encoding:'utf8'}),__filename);
  const before=await native(old.exports.createBrowserNativeInput,module),after=await native(createBrowserNativeInput,module);
  console.log(JSON.stringify({nativeBefore:before,nativeAfter:after}));
  assert.equal(before.first.eax,1);assert.equal(before.second.eax,0);assert.equal(before.after-before.before,0);
  assert.equal(after.first.eax,1);assert.equal(after.second.eax,1);assert.equal(after.after-after.before,1);
  assert.equal(after.empty.eax,0);assert.equal(after.quit.eax,0);assert.equal(after.quit.message[1],0x12);
  assert.deepEqual(after.quit.message,before.quit.message,'ordinary WM_QUIT semantics unchanged');
  assert.equal(after.receipt.nativeMessage.remove,false);
  assert.equal(after.receipt.nativeRemoval.apiKind,1);assert(after.receipt.nativeRemoval.remove);
  console.log(JSON.stringify({pass:true,moduleSHA256:require('node:crypto').createHash('sha256').update(bytes).digest('hex'),
    actualWorker:true,productionRpc:true,nativeUserHandlers:true,before,after}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
