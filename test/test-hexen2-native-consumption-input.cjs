'use strict';
// JavaScript controls only. Trusted DOM and native execution are deliberately
// NOT claimed by these fixtures. No clocks are replaced or advanced.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=process.env.WINE_BRIDGE_ROOT||path.resolve(__dirname,'..');
const candidate=process.env.HEXEN_BRIDGE_CANDIDATE;
const {createBrowserNativeInput}=require(candidate?candidate+'/browser-native-input.js':ROOT+'/lib/browser-native-input.js');
const bridge=require(candidate?candidate+'/hexen2-native-consumption-input.cjs':ROOT+'/tools/hexen2-native-consumption-input.cjs');
const helpers=require(ROOT+'/tools/gltron-current-native-input.cjs');
// Load the pinned production broker bytes, excluding the foreign shared edit.
const Module=require('node:module'),cp=require('node:child_process');
const rpcFile=ROOT+'/lib/guest-rpc.js',rpcModule=new Module(rpcFile,module);
rpcModule.filename=rpcFile;rpcModule.paths=Module._nodeModulePaths(ROOT+'/lib');
rpcModule._compile(cp.execFileSync('git',['show','34c794d549c4ad71dfe40c1647e4ffd0c7a4f8af:lib/guest-rpc.js'],{cwd:ROOT,encoding:'utf8'}),rpcFile);
const RPC=rpcModule.exports;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const shared=new SharedArrayBuffer(8192*65536);
function fixture(factory=createBrowserNativeInput,{capture=0,bind=true}={}){
  let current=[1,7,10,10,0,capture,1,0,1,0],event,trust=true;
  const renderer={canvas:{},presentationCanvas:{},inputQueue:[],windows:{},buttons:0,
    handleKeyDown(code){this.inputQueue.push({hwnd:10,msg:0x100,wParam:code,lParam:1});},handleKeyUp(){},
    handleMouseDown(x,y,button){this.buttons|=1;this.inputQueue.push({hwnd:10,msg:0x201,wParam:1,lParam:(y<<16)|x});if(this.fail)throw Error('renderer partial fault');},
    handleMouseUp(){this.buttons=0;},peekKeyDownState(){return this.buttons;}};
  const gps={endpoint:{},workerEpoch:1,device:{},presenter:{layer:{canvas:{}}}},instance={};
  const wine={instance,memory:{buffer:shared},_wasmModule:{},_processObject:{},guestWorker:{link:{slot:0,worker:{},endpointIdentity:17}},
    renderer,processId:7,running:true,hostCtx:{getGlGpsBridge:()=>gps}};
  renderer.windows[10]={hwnd:10,visible:true,wasm:instance,processId:7};
  const guard=factory(wine,{trusted:()=>trust});wine._browserNativeInput=guard;
  const table={check_input:(...v)=>{guard.observe(v);guard.sweep();event=renderer.inputQueue.shift();
    return event&&guard.owns(event)&&guard.dequeued(event)!==false?event.msg:0;},check_input_token:()=>guard.token(event),
    input_validate:(token,...v)=>guard.validate(token,v),input_consumed:(token,tid,ptr,kind,remove,...v)=>guard.consumed(token,tid,ptr,kind,remove,v)};
  Object.defineProperty(table,'browserInputScope',{value:guard});
  const signatures={check_input:{params:[],results:['i32']},check_input_token:{params:[],results:['i32']},
    input_validate:{params:['i32'],results:['i32']},input_consumed:{params:Array(5).fill('i32'),results:['i32']}};
  const main=RPC.createMainBroker(wine.memory,table,signatures);
  const exportsOf=()=>({get_main_hwnd:()=>current[2],get_focus_hwnd:()=>current[3],get_current_thread_id:()=>current[0],
    get_process_id:()=>current[1],modal_dialog_hwnd:()=>current[4],get_capture_hwnd:()=>current[5],get_window_thread:()=>current[0],
    wnd_lookup_generation:()=>BigInt(current[6])+(BigInt(current[7])<<32n)});
  const make=slot=>RPC.createWorkerImports(wine.memory,signatures,msg=>main.serveRpc(msg.slot),
    {slot,getExports:exportsOf,guestToWasm:ptr=>{assert.equal(ptr,0x400020);return 32;}}).imports.host;
  const worker=make(0),other=make(1);
  const root={__gltronNativeRoutes:[{wine,ctx:wine.hostCtx,host:table}]};
  wine.hostCtx.guardedInput=guard;wine.hostCtx.nativeInputActor=()=>guard.snapshot();
  worker.check_input();
  const session=bridge.createHexenSession(root,wine,helpers);
  if(bind){const state=session.observe();assert(state.binding);}
  function poll(){main.publish({inputPending:renderer.inputQueue.length?1:0});return worker.check_input();}
  function consume(which=worker){
    const token=worker.check_input_token();const dv=new DataView(shared);
    [10,event.msg,event.wParam,event.lParam].forEach((n,i)=>dv.setUint32(32+4*i,n,true));
    return which.input_consumed(token,1,0x400020,2,1);
  }
  return {guard,renderer,gps,wine,root,session,worker,other,poll,consume,current,trust:v=>trust=v};
}
function intent(kind='mouse'){
  const b=Buffer.from('JS control image '+crypto.randomUUID()),at=Date.now(),sha256=crypto.createHash('sha256').update(b).digest('hex');
  const image={sha256,completedAt:at};
  return {image,intent:{name:'action-0',kind,code:kind==='mouse'?1:65,button:kind==='mouse'?0:undefined,
    x:23,y:45,key:'a',domCode:'KeyA',nonce:crypto.randomUUID(),imageSHA256:sha256,
    reviewedAt:Date.now(),review:'authored JS control only; not personal runtime scene review',mode:'game',ms:50}};
}
async function prepared(f,kind='mouse'){
  const v=intent(kind);await sleep(110);f.poll();
  const state=f.session.prepare({...v.intent,completedAt:v.image.completedAt},v.image.completedAt);assert(state.prepared);return v;
}
const results=[];async function test(name,fn){await fn();results.push(name);console.log('PASS '+name);}
(async()=>{
await test('focused captured owner binds; another native capture owner cannot bind',async()=>{
  const f=fixture(createBrowserNativeInput,{capture:10}),v=await prepared(f);
  f.renderer.handleMouseDown(23,45,0);assert.equal(f.poll(),0x201);assert.equal(f.consume(),1);
  f.renderer.handleMouseUp(23,45,0);assert.equal(f.renderer.buttons,0);
  const other=fixture(createBrowserNativeInput,{capture:11,bind:false});
  assert.equal(other.guard.snapshot().ready,false);assert.throws(()=>other.guard.bind(),/unavailable/);
});
for(const field of ['module','actor-endpoint'])await test('captured ownership requires a present '+field+' identity before binding',async()=>{
  const f=fixture(createBrowserNativeInput,{capture:10,bind:false});
  if(field==='module')delete f.wine._wasmModule;
  else delete f.wine.guestWorker.link.endpointIdentity;
  assert.equal(f.guard.snapshot().ready,false);assert.throws(()=>f.guard.bind(),/unavailable/);
});
for(const field of ['capture-transfer','capture-release','recycled-window','focus-return','modal-return','generation-return','module','context','actor','actor-retired'])
await test('captured binding permanently fences '+field+' and leaves UP usable',async()=>{
  const f=fixture(createBrowserNativeInput,{capture:10}),v=await prepared(f);
  f.renderer.handleMouseDown(23,45,0);f.poll();
  if(field==='capture-transfer')f.current[5]=11;
  if(field==='capture-release')f.current[5]=0;
  if(field==='focus-return')f.current[3]=11;
  if(field==='modal-return')f.current[4]=11;
  if(field==='generation-return')f.current[6]++;
  if(field==='recycled-window')f.renderer.windows[10]={...f.renderer.windows[10]};
  if(field==='module')f.wine._wasmModule={};
  if(field==='context')f.wine.hostCtx={...f.wine.hostCtx};
  if(field==='actor')f.wine.guestWorker.link={};
  if(field==='actor-retired')f.wine.guestWorker.link._retirementComplete=true;
  f.poll();assert.equal(f.guard.snapshot().ready,false);
  f.current.splice(0,10,1,7,10,10,0,10,1,0,1,0);f.poll();
  assert.equal(f.guard.snapshot().ready,false,'restoration cannot revive a binding');
  assert.equal(f.guard.status(v.intent.nonce).consumed,false);
  f.renderer.handleMouseUp(23,45,0);assert.equal(f.renderer.buttons,0);
});
await test('captured owner rejects genuinely aged native context without clock replacement',async()=>{
  const f=fixture(createBrowserNativeInput,{capture:10});await sleep(260);
  assert.equal(f.guard.snapshot().ready,false);
});
await test('current native wait observes capture transfer and cannot renew the old binding',async()=>{
  const f=fixture(createBrowserNativeInput,{capture:10}),v=await prepared(f);
  const observe=c=>f.guard.withActor(0,'input_validate',()=>f.guard.validate(-1,[...c,Date.now(),performance.timeOrigin+performance.now(),17]));
  const other=f.current.slice();other[5]=11;observe(other);
  assert.equal(f.guard.snapshot().scene[5],11);assert.equal(f.guard.snapshot().ready,false);
  observe(f.current);assert.equal(f.guard.snapshot().ready,false);
  f.renderer.handleMouseDown(23,45,0);assert.equal(f.renderer.inputQueue.length,0);
  assert.equal(f.guard.status(v.intent.nonce).state,'CANCELLED');
});
await test('old fail/new pass JavaScript mouse bridge causal control (native runtime UNRUN)',async()=>{
  const legacyModule=new Module(ROOT+'/lib/browser-native-input.js',module);
  legacyModule._compile(cp.execFileSync('git',['show','34c794d549c4ad71dfe40c1647e4ffd0c7a4f8af:lib/browser-native-input.js'],{cwd:ROOT,encoding:'utf8'}),ROOT+'/lib/browser-native-input.js');
  const legacy=legacyModule.exports.createBrowserNativeInput;
  for(const [factory,expected] of [[legacy,0],[createBrowserNativeInput,1]]){
    const f=fixture(factory),v=await prepared(f);f.renderer.handleMouseDown(23,45,0);assert.equal(f.poll(),0x201);
    assert.equal(f.consume(),expected);assert.equal(f.guard.status(v.intent.nonce).consumed,!!expected);
  }
});
await test('Mouse1 exact renderer event -> production Worker/broker MSG; transport alone is pending',async()=>{
  const f=fixture(),v=await prepared(f);f.renderer.handleMouseDown(23,45,0);assert.equal(f.poll(),0x201);
  assert.equal(f.guard.status(v.intent.nonce).consumed,false);
  assert.equal(f.consume(f.other),0,'wrong owning Worker slot');assert.equal(f.consume(),1);
  const p=f.session.status(v.intent.nonce);assert.equal(p.nativeMessage.msg,0x201);assert.equal(p.nativeMessage.lParam,(45<<16)|23);
  assert.equal(p.receiptBoundary,'owner-worker-native-user-return');
  f.renderer.handleMouseUp(23,45,0);assert.equal(f.renderer.buttons,0);
  assert.throws(()=>f.session.prepare({...v.intent,completedAt:v.image.completedAt},v.image.completedAt),/stale review or nonce/);
});
for(const field of ['focus','modal','generation','process','worker','module','memory','context','canvas','source','endpoint','scope'])await test('fail closed and sticky on '+field,async()=>{
  const f=fixture(),v=await prepared(f);f.renderer.handleMouseDown(23,45,0);f.poll();
  if(field==='focus')f.current[3]++;
  if(field==='modal')f.current[4]++;
  if(field==='generation')f.current[6]++;
  if(['focus','modal','generation'].includes(field))f.poll();
  if(field==='process')f.wine._processObject={};
  if(field==='worker')f.wine.guestWorker={link:{}};
  if(field==='module')f.wine._wasmModule={};
  if(field==='memory')f.wine.memory={buffer:shared};
  if(field==='context')f.wine.hostCtx={...f.wine.hostCtx};
  if(field==='canvas')f.renderer.canvas={};
  if(field==='source')f.gps.presenter.layer.canvas={};
  if(field==='endpoint')f.gps.endpoint.closed=true;
  if(field==='scope')f.root.__gltronNativeRoutes=[];
  assert.throws(()=>f.session.status(v.intent.nonce));assert(f.guard.snapshot().terminal);
  assert.throws(()=>f.session.observe(),/permanently closed/);
  assert.equal(f.guard.status(v.intent.nonce).state,'UNKNOWN');
});
await test('untrusted Mouse1 and right button cannot satisfy left-button ticket',async()=>{
  const f=fixture(),v=await prepared(f);f.trust(false);f.renderer.handleMouseDown(23,45,0);assert.equal(f.renderer.inputQueue.length,0);
  f.trust(true);f.renderer.handleMouseDown(23,45,2);assert.equal(f.renderer.inputQueue.length,0);assert.equal(f.guard.status(v.intent.nonce).consumed,false);
});
await test('partial renderer fault purges exact queued Mouse1 and cannot replay',async()=>{
  const f=fixture(),v=await prepared(f);f.renderer.fail=true;
  assert.throws(()=>f.renderer.handleMouseDown(23,45,0),/partial fault/);assert.equal(f.renderer.inputQueue.length,0);
  assert.equal(f.guard.status(v.intent.nonce).state,'UNKNOWN');
});
for(const mode of ['healthy','transport-only','late-ACK','lost-ACK','late-native-reply','up-before-down','focus','native-error-and-up-error'])await test('controller '+mode+' with real elapsed bounds and independent UP completion',async()=>{
  const f=fixture(),v=intent();let queries=0,dispatches=0,closed=0,finished=0,upFired=0,upTimer=null;const rows=[];
  let resolveUp;const up=new Promise(r=>resolveUp=r);
  const release={arm:async()=>{upTimer=setTimeout(()=>{upFired++;f.renderer.handleMouseUp(23,45,0);resolveUp({ok:true});},175);const at=Date.now();return {at,fallback:at+1750,releaseDue:at+1500};},
    due(){},cancel(){clearTimeout(upTimer);resolveUp({cancelNoDown:true});},
    finish:async()=>{finished++;const result=await up;if(mode==='native-error-and-up-error')throw Error('authored UP failure');return result;}};
  const controller=bridge.createController({
    page:async(method,...args)=>{queries++;if(method==='prepare'){await sleep(110);f.poll();}
      const p=f.session[method](...args);if(method==='status'&&mode==='late-native-reply')await sleep(550);return p;},
    dispatch:async()=>{dispatches++;if(mode==='up-before-down')await sleep(220);f.renderer.handleMouseDown(23,45,0);f.poll();
      if(mode==='focus'){f.current[3]++;f.poll();}
      if(['healthy','late-ACK','lost-ACK','late-native-reply'].includes(mode))assert.equal(f.consume(),1);
      if(mode==='late-ACK')await sleep(550);
      if(mode==='lost-ACK')return new Promise(()=>{});
      return {transportACK:true};},release,
    close:()=>{closed++;f.session.close();},record:r=>rows.push(r)});
  const at=performance.now();
  if(mode==='healthy'){const r=await controller.gesture(v.intent,v.image);assert(r.proof.consumed);assert.equal(r.guestAttack,false);assert.equal(closed,0);}
  else{await assert.rejects(controller.gesture(v.intent,v.image));assert(controller.terminal);assert.equal(closed,1);}
  assert.equal(finished,1);assert.equal(upFired,1);assert.equal(dispatches,1);
  if(['late-ACK','lost-ACK'].includes(mode))assert.equal(queries,1,'no status query after late/lost DOWN ACK');
  if(mode==='lost-ACK')assert(performance.now()-at<1000,'lost ACK cannot stall release or terminal return');
  const q=queries;await sleep(mode==='late-ACK'?200:80);assert.equal(queries,q,'no endpoint request after terminal UNKNOWN');
  if(mode==='late-ACK')assert(rows.some(r=>r.method==='DOWN'&&r.late),'already in flight ACK retained honestly');
  if(mode==='native-error-and-up-error')assert.equal(upFired,1);
});
await test('expired independent release deadline refuses all DOWN and cancels unsent edge',async()=>{
 const v=intent();let down=0,cancel=0,finish=0;
 const c=bridge.createController({page:async()=>{throw Error('must not prepare');},dispatch:async()=>down++,
   release:{arm:async()=>{const at=Date.now();return {at,fallback:at+1750,releaseDue:at};},
     cancel:()=>cancel++,finish:async()=>{finish++;return {cancelNoDown:true};}},close:()=>{}});
 await assert.rejects(c.gesture(v.intent,v.image),/release window expired/);
 assert.equal(down,0);assert.equal(cancel,1);assert.equal(finish,1);assert(c.terminal);
});
await test('actual five-second review expiry: local NOT_SENT, fresh distinct intent remains usable',async()=>{
  const v=intent();let operations=0,closed=0;
  await sleep(5010);
  const c=bridge.createController({page:async()=>{operations++;},dispatch:async()=>{operations++;},
    release:{arm:async()=>{operations++;}},close:()=>closed++});
  await assert.rejects(c.gesture(v.intent,v.image),e=>e.code==='HEXEN_NATIVE_NOT_SENT');
  assert.equal(operations,0);assert.equal(closed,0);assert.equal(c.terminal,false);
  const fresh=intent();
  // A fresh request passes preflight and reaches the release participant.
  await assert.rejects(c.gesture(fresh.intent,fresh.image));assert.equal(operations,1);assert.equal(closed,1);
  await assert.rejects(c.gesture(v.intent,v.image),/permanently closed/);assert.equal(operations,1);
});
await test('bootstrap enables actual-scope observer before first getImports',async()=>{
  const vm=require('node:vm');class Wine{getImports(){this.hostCtx={};return {host:{}};}}
  const root={WineAssembly:Wine};vm.runInNewContext(bridge.hostBootstrap(),root);
  assert.equal(root.WINE_BROWSER_NATIVE_INPUT,true);const w=new Wine(),table=w.getImports();
  assert.equal(root.__gltronNativeRoutes[0].host,table.host);assert.equal(root.__gltronNativeRoutes[0].ctx,w.hostCtx);
});
console.log(JSON.stringify({kind:'JS_CONTROLS_ONLY',passed:results.length,tests:results,nativeRuntime:'UNRUN',trustedDOM:'UNRUN',original:'UNRUN'}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
