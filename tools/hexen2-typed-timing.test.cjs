#!/usr/bin/env node
'use strict';
// Focused synthetic producer, production owning Worker/broker/host imports and
// physical browser render Worker. Delay controls only defer JS message delivery.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {compile}=require('./watx');
const RPC=require('../lib/guest-rpc');
const {startStaticServer}=require('../test/static-server');
const ROOT=path.resolve(__dirname,'..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const probe=`
(import "host" "memory" (memory 8192 8192 shared))
(import "host" "net_frame_peek" (func $net (param i32 i32) (result i32)))
(import "host" "gpu_gl_call" (func $gl (param i32 i32 i32) (result i32)))
(import "host" "check_input" (func $input (result i32)))
(func (export "flush") (param $at i32) (param $bytes i32) (result i32)
 (call $gl (i32.const 65537) (local.get $at) (local.get $bytes)))
(func (export "poll") (result i32) (call $input))
(func (export "get_eip") (result i32) (i32.const 4198400))
(func (export "get_yield_reason") (result i32) (i32.const 0))
(func (export "get_last_run_blocks") (result i32) (i32.const 12))
(func (export "run") (param i32) (local $n i32)
 (drop (call $net (i32.const 0) (i32.const 0)))
 (local.set $n (i32.const 12))
 (loop $loop
  (drop (call $gl (i32.const 65537) (i32.const 4096) (i32.const 40)))
  (local.set $n (i32.sub (local.get $n) (i32.const 1)))
  (br_if $loop (local.get $n)))
 (drop (call $input)))`;

function ringTests(){
 const t=RPC.createTimingRecorder({capacity:2});
 for(let i=1;i<=4;i++)t.record('wait-enter','glBatch',i,-1);
 assert.deepEqual(t.snapshot().records.map(x=>x.id),[3,4]);assert.equal(t.snapshot().dropped,2);
 const reader=RPC.createTimingRecorder({capacity:2,buffer:t.buffer});
 assert.deepEqual(reader.snapshot(),t.snapshot());
 assert.throws(()=>RPC.createTimingRecorder({capacity:4097}));
 assert.equal(RPC.createTimingRecorder(null),null);
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const sigs=require('../lib/host-import-sigs.generated.json').sigs,wire=[];
 const v=RPC.views(memory,0).i32;
 const built=RPC.createWorkerImports(memory,sigs,msg=>{
  wire.push(msg);v[RPC.SLOT.RESULT]=7;Atomics.store(v,RPC.SLOT.STATUS,RPC.STATUS_RESP);
 },{slot:0});
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'performance');
 Object.defineProperty(globalThis,'performance',{configurable:true,value:{
  now(){throw Error('unarmed timing read');},get timeOrigin(){throw Error('unarmed origin read');},
 }});
 try{
  assert.equal(built.imports.host.gpu_gl_call(65537,0,0),7);
  assert.equal(built.imports.host.check_input(),0);
 }finally{Object.defineProperty(globalThis,'performance',descriptor);}
 assert.equal(wire.length,1);assert(!Object.hasOwn(wire[0],'timingId'));
}
function delayedRender(){
 importScripts('/lib/d3d-render-worker.js');
 const consume=self.onmessage;let delivery=Promise.resolve();
 self.onmessage=event=>{
  delivery=delivery.then(async()=>{
   if(event.data.t==='render-message')await new Promise(r=>setTimeout(r,Number(new URL(location.href).searchParams.get('delay'))||0));
   consume(event);
  });
 };
}
function sliceControl(){
 const consume=self.onmessage;
 self.onmessage=event=>{
  if(event.data.t==='slice'&&event.data.sync?.fixtureDelay)
   setTimeout(()=>consume(event),event.data.sync.fixtureDelay);
  else consume(event);
 };
}
async function scenario({probeBytes,options}){
 const {name,renderDelay=0,dispatchDelay=0,sliceDelay=0,enabled=true,queued=false}=options;
 const assert=(v,s)=>{if(!v)throw Error(name+': '+s);};
 const nativeBytes=await(await fetch('/build/wine-assembly.wasm')).arrayBuffer();
 const nativeModuleSha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',nativeBytes)),x=>x.toString(16).padStart(2,'0')).join('');
 const module=await WebAssembly.compile(nativeBytes);
 const sigs=(await(await fetch('/lib/host-import-sigs.generated.json')).json()).sigs;
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const stub={memory};for(const [n,s]of Object.entries(sigs))stub[n]=()=>s.results.length?0:undefined;
 stub.gdi_surface_create=()=>1;stub.gdi_surface_attach=()=>1;
 const native=new WebAssembly.Instance(module,{host:stub});
 native.exports.init_thread(0,0x400000,0,0,0,0,0,0);native.exports.heap_init(0x800000);
 const hwnd=0x10001,e=native.exports;
 e.wnd_table_set(hwnd,0);e.ctrl_set_geom(hwnd,0,0,8,8);
 e.wnd_set_style_export(hwnd,0x10000000);e.test_gdi_client_rect_set(hwnd,0,0,8,8);
 assert(e.test_call_GetDC(hwnd),'native canonical window DC');
 const manager=new RenderWorker.Manager({module,memory,sigs,imageBase:0x400000,
  workerFactory:()=>new Worker('/lib/typed-render-fixture.js?delay='+renderDelay),
  reclaimHeap:head=>native.exports.d3d_render_adopt_free_list(head)});
 let link,closeGL;const wire=[];
 GLRenderHost.configureDiagnostics(enabled?{enabled:true,maxRecords:128}:null);
 try{
  await manager.ready;
  const w=new WineAssembly(),r=new Win98Renderer(document.createElement('canvas'));
  w.memory=memory;w.renderer=r;w.instance=native;w.logToUI=()=>{};
  r.wasm=r.mainWasm=native;r._guestWorkerWasms=new WeakSet([native]);
  r.windows[hwnd]={hwnd,w:8,h:8,visible:true,clientRect:{left:0,top:0,right:8,bottom:8}};
  w._createRenderWorkerEndpoint=o=>manager.createEndpoint(o);
  w.guestWorker={};
  const h=w.getImports().host;
  closeGL=()=>w.hostCtx.closeGLRender();
  const broker=GuestRpc.createMainBroker(memory,h,sigs,{onError:(n,e)=>{throw Error(n+': '+e.stack);}});
  link=new GuestWorkerLink({slot:0,memory,module:await WebAssembly.compile(new Uint8Array(probeBytes)),sigs,broker,
   typedTiming:enabled?{capacity:512}:false,workerUrl:'/lib/typed-producer-fixture.js',log:()=>{}});
  w.guestWorker={broker,link};
  const receive=link._onMessage;
  link._onMessage=function(m){
   if(['rpc','glBatch'].includes(m.t))wire.push({type:m.t,timingId:m.timingId??null,fn:GuestRpc.views(memory,0).i32[GuestRpc.SLOT.FN]});
   if(m.t==='glBatch'&&dispatchDelay)setTimeout(()=>receive.call(this,m),dispatchDelay);
   else receive.call(this,m);
  };
  r._inputPendingPublishers=new Set([(depth,wake)=>broker.publish({inputPending:depth,inputWake:!!wake})]);
  await link.start();
  const data=new DataView(memory.buffer);
  const packet=(name,args=[],aux=0)=>{
   new Uint8Array(memory.buffer,4096,128).fill(0);
   data.setUint32(4096,40,true);data.setUint32(4100,OpenGLCompat.CALL_INDEX[name],true);
   data.setUint32(4104,aux,true);data.setUint32(4108,4+args.length*4,true);
   args.forEach((a,i)=>data.setUint32(4132+i*4,a,true));
  };
  // Empty/query batches use the real bridge and real GL frontend. Queued
  // scalar batches additionally exercise the two-credit admission pipeline.
  if(queued){
   packet('wglCreateContext',[],hwnd);const context=await link.callExport('flush',4096,40);
   assert(context,'context');
   packet('wglMakeCurrent',[0,context],hwnd);
   // wglMakeCurrent needs a 44-byte record for its two stack arguments.
   data.setUint32(4096,44,true);await link.callExport('flush',4096,44);
  }
  packet('glGetError');await link.callExport('flush',4096,40);
  packet(queued?'glClear':'glGetError',queued?[0x4000]:[]);
  const at=()=>performance.timeOrigin+performance.now();
  const start=at();let releaseAt;
  r.handleKeyDown(13,{code:'Enter'});
  // Independent release is armed before waiting on any guest/render result.
  const release=new Promise(resolve=>setTimeout(()=>{releaseAt=at();r.handleKeyUp(13,{code:'Enter'});resolve();},100));
  const result=await link.slice(12,sliceDelay?{fixtureDelay:sliceDelay}:undefined);
  await release;
  const up=await link.callExport('poll');
  const empty=await link.callExport('poll');
  const timing=link.timingSnapshot(),gl=GLRenderHost.diagnosticSnapshot();
  globalThis.__typedBoundary={name,start,releaseAt,result,up,empty,wire,timing,gl,nativeModuleSha256};
  assert(!result.trapped,'slice trap');assert(result.blocks===12,'blocks unchanged');
  assert(up===((13<<16)|257)&&empty===0,'ordinary balanced queue');
  assert(releaseAt-start>=90&&releaseAt-start<190,'100ms independent release');
  const waits=timing.worker?.records.filter(r=>r.atMs>=start&&r.kind==='wait-enter'&&r.type==='glBatch')||[];
  if(enabled){
   assert(waits.length===12,'typed GL waits');
   assert(waits.every(r=>r.detail===-1),'GL never inferred from stale FN');
   const inputId=timing.names.indexOf('check_input');
   const down=timing.worker.records.find(r=>r.kind==='import-return'&&r.detail===inputId&&r.a===((13<<16)|256));
   assert(down,'owning ordinary DOWN');
   if(renderDelay||dispatchDelay||sliceDelay)assert(down.atMs>releaseAt,'late consumption reproduced');
   else assert(down.atMs<releaseAt,'immediate consumption');
   assert(timing.worker.records.some(r=>r.kind==='slice-enter')&&timing.worker.records.some(r=>r.kind==='slice-exit'&&r.a===12),'slice boundaries');
   assert(gl.host.records.some(r=>r.kind==='request-sent'&&r.producer?.endpoint===link.endpointIdentity&&r.requestId>0),'actual request identity');
   assert(gl.render.timeOrigin>0&&gl.render.records.some(r=>r.kind==='batch-enter'),'actual render recorder');
   const host=timing.host.records,worker=timing.worker.records;
   if(dispatchDelay){
    const gaps=waits.map(w=>host.find(h=>h.kind==='message-receive'&&h.type==='glBatch'&&h.id===w.id).atMs-
     worker.find(r=>r.kind==='wait-post'&&r.id===w.id).atMs);
    assert(gaps.every(ms=>ms>=dispatchDelay-2),'dispatch delay separately visible');
   }
   if(sliceDelay)assert(worker.find(r=>r.kind==='slice-enter').atMs-host.find(r=>r.kind==='slice-post').atMs>=sliceDelay-2,'slice dispatch delay separately visible');
   if(renderDelay){
    const sent=gl.host.records.filter(r=>r.kind==='request-sent'&&r.atMs+r.timeOrigin>=start);
    assert(sent.every(r=>{
     const end=gl.host.records.find(e=>e.kind==='request-exit'&&e.requestId===r.requestId);
     return !end||end.atMs-r.atMs>=renderDelay-2;
    }),'render response delay separately visible');
   }
   if(queued){
    const submits=gl.host.records.filter(r=>r.kind==='submission-enter'&&r.producer);
    assert(submits.some(s=>{
     const admitted=gl.host.records.find(r=>r.kind==='admission-enter'&&r.producer?.id===s.producer.id);
     return admitted&&admitted.atMs-s.atMs>=renderDelay-2;
    }),'bounded admission backpressure separately visible');
   }
  }else{
   assert(!timing.enabled,'off snapshot');assert(wire.every(r=>r.timingId===null),'off wire unchanged');assert(!gl.enabled,'render observer off');
  }
  const stale=wire.filter(r=>r.type==='glBatch').slice(-12).every(r=>r.fn===broker.names.indexOf('net_frame_peek'));
  assert(stale,'stale network FN control');
  return {name,start,releaseAt,result,up,empty,wire,timing,gl,nativeModuleSha256};
 }finally{
  if(link)await link.stop();
  if(closeGL)await closeGL();
  await manager.stop();GLRenderHost.configureDiagnostics(null);
 }
}
async function main(){
 ringTests();
 const built=compile(probe,new Map(),{mode:'production'});assert(built.success);
 const output=process.env.TYPED_TIMING_OUTPUT;
 const producer=fs.readFileSync(path.join(ROOT,'lib/guest-worker.js'),'utf8');
 const producerEmitted=producer+'\n('+sliceControl.toString()+')();';
 const renderEmitted='('+delayedRender.toString()+')();';
 const served={};let browser,server;const results=[];
 try{
  server=await startStaticServer({root:ROOT,crossOriginIsolated:true,handleRequest(req,res){
   const route=new URL(req.url,'http://localhost').pathname;
   const body=route==='/lib/typed-producer-fixture.js'?producerEmitted:route==='/lib/typed-render-fixture.js'?renderEmitted:null;
   if(body===null)return false;
   served[route]={size:Buffer.byteLength(body),sha256:sha(body)};
   res.writeHead(200,{'Content-Type':'text/javascript'});res.end(body);return true;
  }});
  browser=await require('puppeteer').launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();page.on('pageerror',e=>console.error(String(e)));
  await page.goto('http://127.0.0.1:'+server.address().port+'/index.html?debug');
  await page.waitForFunction('typeof GuestWorkerLink!=="undefined"&&typeof GLRenderHost!=="undefined"');
  for(const options of [
   {name:'immediate'}, {name:'render-delay',renderDelay:20},
   {name:'dispatch-delay',dispatchDelay:20}, {name:'slice-delay',sliceDelay:240},
   {name:'queue-backpressure',renderDelay:20,queued:true},
   {name:'off-immediate',enabled:false}, {name:'off-render-delay',enabled:false,renderDelay:20},
   {name:'off-queue-backpressure',enabled:false,renderDelay:20,queued:true},
  ]){
   await page.goto('http://127.0.0.1:'+server.address().port+'/index.html?debug');
   await page.waitForFunction('typeof GuestWorkerLink!=="undefined"&&typeof GLRenderHost!=="undefined"');
   let result;
   try{result=await page.evaluate(scenario,{probeBytes:[...built.wasmBinary],options});}
   catch(error){
    if(output)fs.writeFileSync(output,JSON.stringify({results,failedCase:options,
     boundary:await page.evaluate(()=>globalThis.__typedBoundary||null),error:String(error),served},null,2));
    throw error;
   }
   results.push(result);
   if(output)fs.writeFileSync(output,JSON.stringify({results,served,producerBodySha256:sha(producer)},null,2));
  }
  console.log(JSON.stringify({passed:true,cases:results.map(r=>({name:r.name,sliceMs:r.result.ms,releaseMs:r.releaseAt-r.start}))}));
 }finally{
  if(browser)await browser.close();
  if(server)await new Promise(r=>server.close(r));
 }
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={ringTests,scenario,probe,delayedRender,sliceControl};
