'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {installNativeRouteObserver,inspectNativeRoute,requireNativeRoute}=require('../tools/gltron-current-native-input.cjs');
class Wine {getImports(){this.hostCtx={};return {host:{check_input_token:()=>0,input_consumed:()=>0}};}}
const root={},w=new Wine();w.running=true;w.guestWorker={};w.processId=1;
installNativeRouteObserver(root,Wine);const actual=w.getImports();
assert.equal(root.__gltronNativeRoutes[0].host,actual.host);
const audit=inspectNativeRoute(root,w);assert.equal(audit.scopes[0].guardedInput,false);
assert.equal(audit.scopes[0].nativeInputActor,false);assert.match(audit.scopes[0].tokenImportSource,/=>0/);
assert.throws(()=>requireNativeRoute(audit),/NATIVE_INPUT_UNAVAILABLE/);
const capable={running:true,stopped:false,guestWorker:true,scopes:[{currentContext:true,guardedInput:true,nativeInputActor:true,tokenImport:true,consumedImport:true}]};
assert.throws(()=>requireNativeRoute(capable),/UNQUALIFIED/,'capability is never native proof');
// Execute the real current selector, not a duplicated expected selector.
const source=fs.readFileSync('lib/host-imports.js','utf8');
const start=source.indexOf('  const _glGpsBackend = () => {'),end=source.indexOf('  let _glGpsBridgeObj',start);
assert(start>0&&end>start);
const select=query=>vm.runInNewContext(source.slice(start,end)+';_glGpsBackend()',{
  ctx:{},location:{search:query},URLSearchParams});
assert.equal(select('?gl-renderer=software'),'webgl','legacy selector does not select GPS software');
assert.equal(select('?gl-gps=software'),'software');assert.equal(select('?gl-gps=webgl'),'webgl');
assert.throws(()=>select('?gl-gps=legacy'));
console.log('PASS actual import scope capability refusal and current GPS backend selector (legacy query ignored)');

const {createBrowserNativeInput}=require('../host.js');
function nativeFixture(buffer=new ArrayBuffer(4096),bindImmediately=true){
  let time=1000,mono=0,trust=true;
  const instance={},endpoint={},worker={link:{}},process={};
  const renderer={canvas:{},inputQueue:[],windows:{},
    handleKeyDown(code){this.inputQueue.push({hwnd:0,msg:0x100,wParam:code,lParam:0x12340001});
      if(this.failDown)throw Error('authored handler fault');}};
  renderer.windows[10]={hwnd:10,visible:true,wasm:instance,processId:7};
  const gps={endpoint,workerEpoch:1,device:{},presenter:{layer:{canvas:{}}}};
  const wine={memory:{buffer},renderer,instance,guestWorker:worker,_processObject:process,
    running:true,processId:7,hostCtx:{getGlGpsBridge:()=>gps}};
  const guard=createBrowserNativeInput(wine,{now:()=>time,monotonic:()=>mono,trusted:()=>trust});
  const scene=[1,7,10,10,0,0,1,0,1,0];
  const call=(name,fn,actor=0)=>guard.withActor(actor,name,fn);
  call('check_input',()=>guard.observe(scene));const binding=bindImmediately?guard.bind():null;
  const prepare=(nonce='n')=>guard.prepare({owner:binding.owner,nonce,code:37,reviewed:true,
    reviewedAt:time,imageSHA256:'a'.repeat(64),mode:'game'});
  const down=(code=37)=>{renderer.handleKeyDown(code);const event=renderer.inputQueue.shift();
    const token=call('check_input',()=>guard.dequeued(event));
    const dv=new DataView(buffer);[10,event.msg,event.wParam,event.lParam].forEach((n,i)=>dv.setUint32(32+4*i,n,true));
    return {event,token};};
  return {guard,renderer,wine,scene,call,prepare,down,
    clock:(n,m=n-1000)=>{time=n;mono=m;},trust:v=>trust=v};
}
{
  const f=nativeFixture();f.prepare();const {token}=f.down();
  assert(token>0);assert.equal(f.guard.status('n').consumed,false,'host handler is not consumption');
  assert.equal(f.guard.consumed(token,1,32,2,1,[...f.scene,32]),0,'direct host call has no actor scope');
  const consumed=(scene=f.scene,kind=2,remove=1,actor=0)=>f.call('input_consumed',()=>f.guard.consumed(token,1,32,kind,remove,[...scene,32]),actor);
  assert.equal(consumed(f.scene,2,1,1),0,'wrong actor');
  for(const index of [0,1,2,3,4,5,6,7,8,9]){
    const scene=f.scene.slice();scene[index]++;
    assert.equal(consumed(scene),0,'native context field '+index);
  }
  assert.equal(consumed(f.scene,0),0);assert.equal(consumed(f.scene,1,0),0);
  assert.equal(consumed(),1);assert.equal(f.guard.status('n').consumed,true);
  assert.equal(f.guard.status('n').nativeMessage.slot,0);
  assert.throws(()=>f.prepare(),/refused/,'nonce tombstone');
}
for(const mode of ['late','monotonic','unknown','focus','modal','generation','target','context','closed','fault','untrusted']){
  const f=nativeFixture();f.prepare();
  if(mode==='untrusted'){f.trust(false);f.renderer.handleKeyDown(37);assert.equal(f.renderer.inputQueue.length,0);continue;}
  const {token}=f.down();
  if(mode==='late')f.clock(1500);
  if(mode==='monotonic')f.clock(1000,500);
  if(mode==='unknown')f.guard.close();
  if(mode==='target')f.wine.guestWorker={link:{}};
  if(mode==='context')f.wine.hostCtx.getGlGpsBridge().device={};
  if(mode==='closed')f.wine.hostCtx.getGlGpsBridge().endpoint.closed=true;
  if(mode==='fault')f.wine.hostCtx.getGlGpsBridge().workerAsyncError=Error('authored fault');
  if(['focus','modal','generation'].includes(mode)){
    const s=f.scene.slice();s[{focus:3,modal:4,generation:6}[mode]]++;
    f.call('check_input',()=>f.guard.observe(s));
  }
  assert.equal(f.call('input_consumed',()=>f.guard.consumed(token,1,32,2,1,[...f.scene,32])),0,mode);
  assert.equal(f.guard.status('n').consumed,false,mode);
}
console.log('PASS browser receipt native return, actor/context/target/deadline/UNKNOWN fences and nonce tombstones');
{
  // A context can cross its existing 250ms fence after preparation but
  // before any next native USER poll. Preserve the exact first refusal;
  // later observations must not rewrite that diagnostic or revive its edge.
  const f=nativeFixture();f.clock(1240);f.prepare();f.down();f.clock(1270);
  const refused=f.guard.status('n');assert.equal(refused.state,'CANCELLED');
  assert.equal(refused.fence.sceneAge,270);assert.equal(refused.fence.wallExpired,false);
  assert.equal(refused.fence.monotonicExpired,false);assert.deepEqual(refused.fence.changedRefs,[]);
  assert.equal(refused.fence.sceneMatches,true);assert.equal(refused.fence.slotMatches,true);
  f.call('check_input',()=>f.guard.observe(f.scene));
  assert.deepEqual(f.guard.status('n'),refused);assert.equal(f.renderer.inputQueue.length,0);
}
{
  const f=nativeFixture();f.prepare();f.renderer.failDown=true;
  assert.throws(()=>f.renderer.handleKeyDown(37),/authored handler fault/);
  assert.equal(f.renderer.inputQueue.length,0,'throwing handler cannot leave an unowned DOWN');
  assert.equal(f.guard.status('n').state,'UNKNOWN');
}

// Exercise the production Worker encoder and page broker as well as the
// guard. The native exports below stand for USER runtime globals, not the
// page's idle WASM instance. MSG translation must happen on this side.
const RPC=require('../lib/guest-rpc');
for(const fault of [null,'actor','focus','modal','generation','late','unknown']){
  const f=nativeFixture(new SharedArrayBuffer(8192*65536));let current=f.scene.slice(),event;
  const sigs={check_input:{params:[],results:['i32']},check_input_token:{params:[],results:['i32']},
    input_validate:{params:['i32'],results:['i32']},input_consumed:{params:Array(5).fill('i32'),results:['i32']}};
  const table={check_input:(...values)=>{f.guard.observe(values);f.guard.sweep();event=f.renderer.inputQueue.shift();
      return event&&f.guard.owns(event)&&f.guard.dequeued(event)!==false?event.msg:0;},
    check_input_token:()=>f.guard.token(event),input_validate:(token,...values)=>f.guard.validate(token,values),
    input_consumed:(token,tid,ptr,kind,remove,...values)=>f.guard.consumed(token,tid,ptr,kind,remove,values)};
  Object.defineProperty(table,'browserInputScope',{value:f.guard});
  const main=RPC.createMainBroker(f.wine.memory,table,sigs);
  const exportsOf=()=>({get_main_hwnd:()=>current[2],get_focus_hwnd:()=>current[3],
    get_current_thread_id:()=>current[0],get_process_id:()=>current[1],modal_dialog_hwnd:()=>current[4],
    get_capture_hwnd:()=>current[5],get_window_thread:()=>current[0],
    wnd_lookup_generation:()=>BigInt(current[6])+(BigInt(current[7])<<32n)});
  const make=slot=>RPC.createWorkerImports(f.wine.memory,sigs,msg=>main.serveRpc(msg.slot),
    {slot,getExports:exportsOf,guestToWasm:ptr=>{assert.equal(ptr,0x400020);return 32;}}).imports.host;
  const worker=make(0);assert.equal(worker.check_input(),0);f.prepare();f.renderer.handleKeyDown(37);
  main.publish({inputPending:1});assert.equal(worker.check_input(),0x100);
  const token=worker.check_input_token();assert(token>0);
  const dv=new DataView(f.wine.memory.buffer);[10,event.msg,event.wParam,event.lParam].forEach((n,i)=>dv.setUint32(32+i*4,n,true));
  if(fault==='focus')current[3]++;
  if(fault==='modal')current[4]=20;
  if(fault==='generation')current[6]++;
  if(fault==='late')f.clock(1500);
  if(fault==='unknown')f.guard.close();
  const consumer=fault==='actor'?make(1):worker;
  assert.equal(consumer.input_consumed(token,1,0x400020,2,1),fault?0:1,String(fault));
  assert.equal(f.guard.status('n').consumed,!fault,String(fault));
}
console.log('PASS production Worker/broker metadata and MSG translation, native return and actor/focus/modal/generation/late/UNKNOWN refusals');
{
  const {observeAndBindNativeOwner}=require('../tools/gltron-current-native-input.cjs');
  const f=nativeFixture(new ArrayBuffer(4096),false);f.wine._browserNativeInput=f.guard;
  assert(f.guard.snapshot().ready);f.clock(1300);
  assert.throws(()=>f.guard.bind(),/unavailable/,'old observe/capture/bind ordering expires the real guard freshness fence');
  assert.equal(observeAndBindNativeOwner(f.wine).ready,false);assert.equal(f.guard.snapshot().bound,false);
  f.call('check_input',()=>f.guard.observe(f.scene));
  const admission=observeAndBindNativeOwner(f.wine);assert(admission.binding.owner);assert(admission.bound);
  f.clock(1600);assert.equal(f.guard.snapshot().ready,false);assert(f.guard.snapshot().bound,
    'a later screenshot does not move the already completed bind across the freshness fence');
  assert(!observeAndBindNativeOwner(f.wine).binding,'never rebind an existing owner');
}
{
  const {observeAndPrepareNativeIntent}=require('../tools/gltron-current-native-input.cjs');
  const f=nativeFixture(new ArrayBuffer(4096),false);f.wine._browserNativeInput=f.guard;
  const binding=f.guard.bind();
  const intent={owner:binding.owner,nonce:'fresh-native-poll',code:13,reviewed:true,
    reviewedAt:1589,imageSHA256:'b'.repeat(64),mode:'menu'};
  f.clock(1589);
  const old=f.guard.prepare({...intent,nonce:'old-order'});
  assert.equal(old.state,'CANCELLED');assert.equal(old.fence.sceneAge,589,
    'exact original software preparation age, with every other predicate valid');
  const pending=observeAndPrepareNativeIntent(f.wine,intent,1500);
  assert.equal(pending.ready,false);assert.equal(pending.prepared,undefined);
  assert.throws(()=>f.guard.status(intent.nonce),/unknown browser native nonce/,
    'stale observation must not create a ticket');
  f.clock(1600);f.call('check_input',()=>f.guard.observe(f.scene));
  const fresh=observeAndPrepareNativeIntent(f.wine,intent,1500);
  assert.equal(fresh.prepared.state,'PREPARED');assert(fresh.observedAt>1500);
  assert.equal(fresh.preparedAt>0,true);assert.equal(f.guard.snapshot().bound,true);
  const {token}=f.down(13);f.clock(1610);
  assert.equal(f.call('input_consumed',()=>f.guard.consumed(token,1,32,2,1,[...f.scene,32])),1);
  assert.equal(f.guard.status(intent.nonce).consumed,true);
  assert.equal(f.guard.status('old-order').state,'CANCELLED','no replay of original refused nonce');
  assert.throws(()=>observeAndPrepareNativeIntent(f.wine,intent,1500),/refused/);
  const idle={...intent,nonce:'no-new-poll'};
  assert.equal(observeAndPrepareNativeIntent(f.wine,idle,1600).ready,false,
    'even a fresh earlier poll cannot stand for the required new native observation');
  console.log('PASS measured 589ms original stale prepare refusal, passive new USER scene and atomic ticket admission without rebind');
}

(async()=>{
  const {waitForNativeOwner}=require('../tools/gltron-current-native-input.cjs');
  let clock=0,observed=0,closed=0;
  const states=[{healthy:true,ready:false},{healthy:true,ready:false},{healthy:true,ready:true}];
  const ready=await waitForNativeOwner({observe:async()=>states[observed++],deadline:1000,
    now:()=>clock,wait:async ms=>{clock+=ms;},close:()=>closed++});
  assert(ready.ready);assert.equal(observed,3);assert.equal(closed,0);
  observed=0;clock=0;
  await assert.rejects(waitForNativeOwner({observe:async()=>{observed++;return {healthy:true,ready:false};},
    deadline:50,now:()=>clock,wait:async ms=>{clock+=ms;},close:()=>closed++}),/startup deadline/);
  assert.equal(observed,2);assert.equal(closed,1,'terminal deadline closes once without a bind or later observation');
  await assert.rejects(waitForNativeOwner({observe:async()=>({healthy:false,ready:false}),
    deadline:Date.now()+1000,close:()=>closed++}),/retired actor/);
  assert.equal(closed,2);
  console.log('PASS passive pre-USER startup readiness, no early bind/input and terminal deadline/retirement closure');
})().catch(error=>{console.error(error);process.exitCode=1;});
