'use strict';
const assert=require('node:assert/strict'),{test}=require('node:test');
const {createBrowserNativeInput}=require('../lib/browser-native-input.js');
const adapter=require('../tools/native-mouse-consumption-input.cjs');
const {createReleaseState}=require('../tools/native-mouse-release.cjs');
test('manual command requires the actual review field before proof creation and binds the current source',()=>{
  const C=require('../tools/warcraft3-current-controller.cjs'),source={at:1000,sha256:'a'.repeat(64)};
  const command={action:'gesture',intent:{kind:'mouse',button:2,code:2,x:400,y:320,ms:300,mode:'game',observation:'whole frame inspected'}};
  assert.throws(()=>C.manualIntent(command,2,source,1100),/intent.review/);
  command.intent.review='Personally reviewed whole frame; right destination400,320.';
  const i=C.manualIntent(command,2,source,1100);
  assert.equal(i.review,command.intent.review);assert.equal(i.imageSHA256,source.sha256);assert.equal(i.reviewedAt,1100);
  assert.equal(i.name,'action-2');assert.notEqual(C.manualIntent(command,2,source,1100).nonce,i.nonce);
  assert.throws(()=>C.manualIntent(command,2,source,31000),/expired/);
  assert.throws(()=>C.manualIntent(command,2,source,999),/expired/);
  command.intent.code=1;assert.throws(()=>C.manualIntent(command,2,source,1100),/exact mouse/);
});
test('independent key release preserves the exact DOM code and cancellation emits no edge',()=>{
  const intent={kind:'key',name:'action-1',nonce:'exact-enter',mode:'menu',ms:90,code:13,key:'Enter',domCode:'Enter'};
  const release=createReleaseState(intent);
  assert.deepEqual(release.params(),{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
  const cancelled=createReleaseState({...intent,nonce:'cancel'});
  cancelled.command({command:'cancel',nonce:'cancel'});assert.throws(()=>cancelled.params(),/cancelled/);
  const letter=createReleaseState({...intent,nonce:'letter',code:65,key:'a',domCode:'KeyA'});
  assert.equal(letter.params().code,'KeyA');
});
test('status starts only after genuine socket send and can precede slow ACK; all tasks join',async()=>{
  const C=require('../tools/warcraft3-current-controller.cjs'),ws=new EventTarget();
  ws.readyState=1;let sent=false,ack=false,status=false;
  ws.send=body=>{sent=true;const v=JSON.parse(body);setTimeout(()=>{ack=true;
    ws.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({id:v.id,sessionId:v.sessionId,result:{}})}));},80);};
  const proof=await adapter.waitForPublishedConsumption({deadline:Date.now()+500,close(){},
    dispatch:published=>C.sendPublished({ws,closed:false},'Input.dispatchMouseEvent',{button:'right'},'s',()=>{assert(!sent);assert(!status);},published),
    observe:async()=>{assert(sent);assert(!ack);status=true;return {state:'CONSUMED',token:17};}});
  assert.equal(proof.token,17);assert(ack&&status);
});
test('ACK without publication, capture failure and send failure never start observer; primary error retained',async()=>{
  for(const mode of ['no-signal','capture','send']){
    let observed=0,closed=0;const original=Error(mode);
    const task=adapter.waitForPublishedConsumption({deadline:Date.now()+500,close(){closed++;},
      dispatch:async()=>{if(mode!=='no-signal')throw original;},observe:async()=>{observed++;}});
    await assert.rejects(task,e=>mode==='no-signal'?/omitted socket/.test(e.message):e===original);
    assert.equal(observed,0);assert.equal(closed,1);
  }
});
test('delayed final capture retains fixed expiry; late STATUS and slow ACK are joined without post-close queries',async()=>{
  for(const mode of ['capture','status','ack','nonconsumer']){
    let wall=1000,mono=0,queries=0,closed=0,joined=false;
    const task=adapter.waitForPublishedConsumption({deadline:1500,now:()=>wall,monotonic:()=>mono,close(){closed++;},
      dispatch:async published=>{
        if(mode==='capture'){wall+=501;mono+=501;published();return;}
        published();if(mode==='ack'){await new Promise(r=>setTimeout(r,15));mono=501;}
        joined=true;
      },
      observe:async()=>{queries++;if(mode==='status')mono=501;
        if(mode==='nonconsumer')return {state:'UNKNOWN',reason:'not consumed'};
        return {state:'CONSUMED'};}});
    await assert.rejects(task,/deadline|refused/);const n=queries;
    await new Promise(r=>setTimeout(r,10));assert.equal(queries,n);assert.equal(closed,1);
    assert.equal(queries,mode==='capture'?0:1);if(mode!=='capture')assert(joined);
  }
});
test('actual bootstrap call sites cannot create or observe until qualified trusted host focus',async()=>{
  const cp=require('node:child_process'),Module=require('node:module'),m=new Module(__filename,module);
  m._compile(cp.execFileSync('git',['show','5465c599d:tools/hexen2-native-host-focus.cjs'],{encoding:'utf8'}),__filename);
  const order=m.exports.createFocusOrder(),calls=[];
  const bootstrap=()=>adapter.bootstrapNative({focusOrder:order,createSession:async()=>calls.push('create'),
    observe:async()=>{calls.push('observe');return {healthy:true,ready:true,binding:{owner:'actual'}};},deadline:Date.now()+1000});
  await assert.rejects(bootstrap,/must precede/);assert.deepEqual(calls,[]);
  order.complete({focused:true,visibility:'visible',fullscreen:true,event:{type:'click',trusted:true,target:'BUTTON',at:100}},99);
  assert.equal((await bootstrap()).binding.owner,'actual');assert.deepEqual(calls,['create','observe']);
  for(const bad of ['focused','visibility','fullscreen','trusted']){
    const o=m.exports.createFocusOrder(),v={focused:true,visibility:'visible',fullscreen:true,event:{type:'click',trusted:true,target:'BUTTON',at:100}};
    if(bad==='trusted')v.event.trusted=false;else v[bad]=bad==='visibility'?'hidden':false;
    assert.throws(()=>o.complete(v,99));
    await assert.rejects(()=>adapter.bootstrapNative({focusOrder:o,createSession:async()=>calls.push('BAD'),observe:async()=>calls.push('BAD'),deadline:Date.now()+1000}));
    assert(!calls.includes('BAD'));
  }
});
test('first composite failure retains same-read scalars before closing; no later observation',()=>{
  let reads=0,focusReads=0,closed=0;
  const root={document:{hasFocus(){focusReads++;return false;},visibilityState:'hidden'}};
  const wine={_browserNativeInput:{close(){closed++;}}};
  const helpers={inspectNativeRoute(){reads++;return {running:true,stopped:false,guestWorker:true,
    scopes:[{currentContext:false,guardedInput:true,nativeInputActor:true,tokenImport:true,consumedImport:false}],
    bridge:{healthy:true,terminal:false,ready:false,bound:false,slot:0,scene:[1,2,3,4],observedAt:123,source:'check_input'}};}};
  const session=adapter.createMouseSession(root,wine,helpers,{key:'a'.repeat(64)});
  let message;try{session.observe();}catch(e){message=e.message;}
  const facts=JSON.parse(message.slice(message.indexOf('{')));
  assert.equal(facts.focused,false);assert.equal(facts.visibility,'hidden');assert.equal(facts.scopes[0].currentContext,false);
  assert.equal(facts.scopes[0].consumedImport,false);assert.equal(facts.bridge.observedAt,123);assert.deepEqual(facts.bridge.scene,[1,2,3,4]);
  assert.equal(facts.owner,null);assert.equal(reads,1);assert.equal(focusReads,1);assert.equal(closed,1);
  assert.throws(()=>session.observe(),/permanently closed/);assert.equal(reads,1);assert.equal(focusReads,1);
});
// JS guard/controller controls. These do not claim trusted DOM or guest execution.
function fixture({code=2,button=2,clock={},configure=()=>{}}={}){
  let trust=true;
  const rect={left:0,top:0,right:320,bottom:200,width:320,height:200,toJSON(){return {...this,toJSON:undefined};}};
  const r={canvas:{width:320,height:200,getBoundingClientRect:()=>rect},inputQueue:[],windows:{},buttons:0,downs:0,
    _mapExclusiveInputPoint:(x,y)=>({x,y,outside:false}),_clientOriginScreen:()=>({x:10,y:20}),
    handleMouseDown(x,y,b){this.downs++;this.buttons|=b===2?2:1;this.inputQueue.push({hwnd:10,msg:b===2?0x204:0x201,wParam:b===2?2:1,lParam:((y-20)<<16)|(x-10)});},
    handleMouseUp(x,y,b){this.buttons&=~(b===2?2:1);},peekKeyDownState(c){return !!(this.buttons&c);},
    handleKeyDown(c){this.inputQueue.push({hwnd:10,msg:0x100,wParam:c,lParam:1});},handleKeyUp(){}};
  const scene=[1,7,10,10,0,0,1,0,1,0],instance={},gps={endpoint:{},presenter:{layer:{canvas:{}}}};
  const wine={renderer:r,instance,memory:{buffer:new ArrayBuffer(128)},_wasmModule:{},_processObject:{},running:true,processId:7,
    guestWorker:{link:{slot:0,worker:{},endpointIdentity:17}},hostCtx:{getGlGpsBridge:()=>gps}};
  r.windows[10]={visible:true,wasm:instance,processId:7};
  configure(wine);
  const g=createBrowserNativeInput(wine,{trusted:()=>trust,...clock}),observe=()=>g.withActor(0,'check_input',()=>g.observe(scene));
  observe();const b=g.bind();
  const intent={owner:b.owner,nonce:'one',kind:'mouse',code,button,x:50,y:70,reviewed:true,reviewedAt:Date.now(),imageSHA256:'a'.repeat(64)};
  const prepare=()=>g.prepare(intent);
  const down=()=>r.handleMouseDown(50,70,button);
  const dequeue=()=>{const event=r.inputQueue.shift(),token=g.withActor(0,'check_input',()=>g.dequeued(event));return {event,token};};
  function consume(edge,kind=2,remove=0){
    const v=new DataView(wine.memory.buffer);['hwnd','msg','wParam','lParam'].forEach((k,i)=>v.setUint32(32+i*4,edge.event[k]>>>0,true));
    return g.withActor(0,'input_consumed',()=>g.consumed(edge.token,1,32,kind,remove,[...scene,32]));
  }
  return {r,g,wine,gps,scene,rect,intent,prepare,down,dequeue,consume,observe,trust:v=>trust=v};
}
test('typed DOM2/VK2 exact right MSG and truthful nonremoving/removing returns',()=>{
  const f=fixture();assert.equal(f.prepare().state,'PREPARED');f.down();const edge=f.dequeue();
  assert(edge.token>0);assert.equal(edge.event.msg,0x204);assert.equal(edge.event.wParam,2);
  assert.equal(edge.event.lParam,(50<<16)|40);assert.equal(f.consume(edge),1);
  const first=f.g.status('one');assert(first.consumed);assert.equal(first.nativeMessage.remove,false);assert.equal(first.nativeRemoval,null);
  assert.equal(f.consume(edge,1,1),1);const last=f.g.status('one');assert.deepEqual(last.nativeMessage,first.nativeMessage);
  assert(last.nativeRemoval.remove);assert.equal(f.consume(edge,1,1),0);
  assert.throws(f.prepare,/refused/);f.down();assert.equal(f.r.downs,1);
});
test('capture context can observe a stale scene without preparing input or refreshing its timestamp',async()=>{
  let wall=Date.now(),mono=performance.now();
  const f=fixture({clock:{now:()=>wall,monotonic:()=>mono},configure(wine){
    wine._requireAuthoritativeCapture=true;wine._requireReviewedFrameEquivalence=true;
    wine.instance.exports={capture_publication_word:()=>0,get_authoritative_capture_hwnd:()=>0,
      wnd_lookup_live:()=>1,wnd_lookup_generation:()=>1n,get_window_thread:()=>1};
  }});
  const root={innerWidth:320,innerHeight:200,devicePixelRatio:1,
    document:{hasFocus:()=>true,visibilityState:'visible'}};
  const helpers={inspectNativeRoute:()=>({running:true,stopped:false,guestWorker:true,
    scopes:[{currentContext:true,guardedInput:true,nativeInputActor:true,tokenImport:true,consumedImport:true}],bridge:f.g.snapshot()}),
    observeAndBindNativeOwner:()=>({...f.g.snapshot(),binding:{owner:f.intent.owner,scene:f.scene.slice(),slot:0}}),exactInput:adapter.exactInput,
    verifyPageEquivalence:async()=>({identity:{native:s.context()},fresh:{completedAt:sampled}}),
    observeAndPrepareNativeIntent:require('../tools/warcraft3-current-controller.cjs').qualifiedLoader().load('tools/gltron-current-native-input.cjs').observeAndPrepareNativeIntent};
  f.wine._browserNativeInput=f.g;
  const s=adapter.createMouseSession(root,f.wine,helpers,{key:'a'.repeat(64)});
  s.observe();const sampled=f.g.snapshot().observedAt;wall+=261;mono+=261;
  assert.equal(f.g.snapshot().ready,false);
  assert.equal(s.context().owner,f.intent.owner);
  assert.equal(s.diagnostics().admitting,false);
  assert.equal(f.g.snapshot().observedAt,sampled);assert.equal(f.r.downs,0);
  const waiting=await s.prepareEquivalent({...f.intent,name:'action-1',mode:'game',ms:90},sampled,{});
  assert.equal(waiting.ready,false);assert.equal(waiting.prepared,undefined);
  assert.equal(s.diagnostics().admitting,false);assert.equal(f.g.snapshot().observedAt,sampled);
  assert.equal(f.prepare().state,'CANCELLED');f.down();assert.equal(f.r.downs,0);
});
test('preparation samples new native producer values each attempt while identity and intent stay frozen',async()=>{
  for(const mode of ['new','frozen','stale','replaced','late','changedScene']){
    let wall=Date.now(),mono=performance.now(),reads=0,verified=0;
    const f=fixture({clock:{now:()=>wall,monotonic:()=>mono},configure(wine){
      wine._requireAuthoritativeCapture=true;wine._requireReviewedFrameEquivalence=true;
      wine.instance.exports={capture_publication_word:()=>0,get_authoritative_capture_hwnd:()=>0,
        wnd_lookup_live:()=>1,wnd_lookup_generation:()=>1n,get_window_thread:()=>1};
    }});f.wine._browserNativeInput=f.g;
    const root={document:{hasFocus:()=>true,visibilityState:'visible'}};
    const native=require('../tools/warcraft3-current-controller.cjs').qualifiedLoader().load('tools/gltron-current-native-input.cjs');
    const helpers={inspectNativeRoute(){reads++;return {running:true,stopped:false,guestWorker:true,
      scopes:[{currentContext:true,guardedInput:true,nativeInputActor:true,tokenImport:true,consumedImport:true}],bridge:f.g.snapshot()};},
      observeAndBindNativeOwner:()=>({...f.g.snapshot(),binding:{owner:f.intent.owner,scene:f.scene.slice(),slot:0}}),
      exactInput:adapter.exactInput,observeAndPrepareNativeIntent:native.observeAndPrepareNativeIntent,
      verifyPageEquivalence:async()=>{verified++;return {identity:{native:identity},fresh:{completedAt:first}};}};
    const s=adapter.createMouseSession(root,f.wine,helpers,{key:'a'.repeat(64)});
    s.observe();const identity=s.context(),first=f.g.snapshot().observedAt;
    const intent={...f.intent,name:'action-1',mode:'game',ms:90},frozen=structuredClone(intent);
    wall+=261;mono+=261;
    assert.equal((await s.prepareEquivalent(intent,first,{})).prepared,undefined);
    const firstCheck=s.diagnostics().bridge.readiness.checkedAt;
    wall+=5;mono+=5;
    if(mode==='new'||mode==='stale'||mode==='late'||mode==='changedScene'){
      // The producer path, with its actual actor and endpoint, supplies the
      // timestamps. No prepare/check code creates or refreshes an observation.
      const values=[...f.scene,wall,performance.timeOrigin+mono,17];
      if(mode==='changedScene')values[3]++;
      f.g.withActor(0,'input_validate',()=>f.g.validate(-1,values));
    }
    if(mode==='stale'){wall+=251;mono+=251;}
    if(mode==='late'){wall+=501;mono+=501;}
    if(mode==='replaced')f.gps.endpoint={};
    if(mode==='replaced'||mode==='changedScene'){
      await assert.rejects(s.prepareEquivalent(intent,first,{}),/NATIVE_MOUSE_UNKNOWN/);
      const n=reads;await assert.rejects(s.prepareEquivalent(intent,first,{}),/permanently closed/);assert.equal(reads,n);
    }else{
      const next=await s.prepareEquivalent(intent,first,{});
      assert.equal(next.prepared?.state,mode==='new'?'PREPARED':undefined,mode);
      assert(s.diagnostics().bridge.readiness.checkedAt>firstCheck,mode);
      if(mode==='new'){assert(next.observedAt>first);assert.equal(next.source,'native_message_wait');}
      else assert.equal(next.ready,false,mode);
    }
    assert.deepEqual(intent,frozen);assert(verified>=1);assert.equal(f.r.downs,0);
  }
});
test('readiness diagnoses every structural failure even with an expired scene; default input stays closed',()=>{
  const cases={
    owner:f=>{f.wine._processObject={};},
    focus:f=>{f.scene[3]++;f.observe();},modal:f=>{f.scene[4]=99;f.observe();},
    capture:f=>{f.scene[5]=99;f.observe();},
    slot:f=>f.g.withActor(1,'check_input',()=>f.g.observe(f.scene)),
    replaced:f=>{f.gps.endpoint={};},retired:f=>{f.wine.guestWorker.link._stopped=true;},
    invisible:f=>{f.r.windows[10].visible=false;},
    process:f=>{f.r.windows[10].processId++;},instance:f=>{f.r.windows[10].wasm={};},
    endpoint:f=>{f.gps.endpoint.closed=true;},renderError:f=>{f.gps.workerAsyncError=Error('real failure');},
    renderClosing:f=>{f.gps.workerClosing=true;},queue:f=>{f.r.inputQueue=[];},
  };
  for(const [name,mutate] of Object.entries(cases)){
    let wall=Date.now(),mono=performance.now();
    const f=fixture({clock:{now:()=>wall,monotonic:()=>mono}});mutate(f);wall+=261;mono+=261;
    const before=f.g.snapshot(),d=before.readiness;
    assert.equal(d.predicates.fresh,false,name);assert.equal(d.observationReady,false,name);
    assert.equal(before.ready,false,name);assert(Object.entries(d.predicates).some(([k,v])=>k!=='fresh'&&!v),name);
    assert.equal(f.prepare().state,'CANCELLED',name);f.down();assert.equal(f.r.downs,0,name);
    assert.equal(f.g.snapshot().observedAt,before.observedAt,name);
  }
});
test('released 7bca bridge rejects actual right intent before renderer application',()=>{
  const cp=require('node:child_process'),Module=require('node:module'),m=new Module(__filename,module);
  m._compile(cp.execFileSync('git',['show','7bca66241:lib/browser-native-input.js'],{encoding:'utf8'}),__filename);
  const f=fixture(),old=m.exports.createBrowserNativeInput(f.wine,{trusted:()=>true});
  old.withActor(0,'check_input',()=>old.observe(f.scene));const b=old.bind();
  assert.throws(()=>old.prepare({...f.intent,owner:b.owner}),/intent refused/);assert.equal(f.r.downs,0);
});
test('mutable renderer edge cannot forge different native coordinates or button',()=>{
  for(const key of ['msg','wParam','lParam']){
    const f=fixture();f.prepare();f.down();const edge=f.dequeue();edge.event[key]++;
    assert.equal(f.consume(edge,1,1),0,key);assert.equal(f.g.status('one').consumed,false);
  }
});
test('left mouse and default key behavior retained',()=>{
  const f=fixture({code:1,button:0});f.prepare();f.down();assert.equal(f.consume(f.dequeue(),1,1),1);
  const k=fixture();Object.assign(k.intent,{kind:undefined,code:13});k.prepare();k.r.handleKeyDown(13);
  assert.equal(k.consume(k.dequeue(),1,1),1);
});
test('wrong button/coordinate/untrusted input never calls renderer',()=>{
  for(const bad of ['button','coordinate','untrusted']){
    const f=fixture();f.prepare();if(bad==='untrusted')f.trust(false);
    f.r.handleMouseDown(bad==='coordinate'?51:50,70,bad==='button'?0:2);
    assert.equal(f.r.downs,0,bad);assert.equal(f.r.inputQueue.length,0);
  }
});
test('wrong native coordinates/button cannot leak an unguarded edge',()=>{
  for(const bad of ['coordinates','button']){
    const f=fixture();f.prepare();
    // Change the renderer's mapping after preparation, without touching the intent.
    if(bad==='coordinates')f.r._mapExclusiveInputPoint=(x,y)=>({x:x+1,y,outside:false});
    // Handler output is intentionally corrupted inside the original closure.
    const push=f.r.inputQueue.push;f.r.inputQueue.push=function(e){if(bad==='button')e.msg=0x201;else e.lParam++;return push.call(this,e);};
    f.down();assert.equal(f.g.status('one').state,'UNKNOWN');assert.equal(f.r.inputQueue.length,0);
  }
});
test('owner/focus/modal/capture/retire/viewport changes fence right DOWN',()=>{
  for(const bad of ['owner','focus','modal','capture','retire','viewport']){
    const f=fixture();f.prepare();
    if(bad==='owner')f.wine._processObject={};if(bad==='focus')f.scene[3]++;
    if(bad==='modal')f.scene[4]=99;if(bad==='capture')f.scene[5]=99;
    if(bad==='retire')f.wine.guestWorker.link._stopped=true;if(bad==='viewport')f.rect.width++;
    f.observe();f.down();assert.equal(f.r.downs,0,bad);assert.equal(f.g.status('one').state,'CANCELLED');
  }
});
test('independent UP precedes DOWN or native removal: never delivers another DOWN',()=>{
  for(const phase of ['prepared','pending','cached']){
    const f=fixture();f.prepare();let edge;
    if(phase!=='prepared'){f.down();if(phase==='cached'){edge=f.dequeue();assert.equal(f.consume(edge),1);}}
    f.r.handleMouseUp(50,70,2);f.down();assert.equal(f.r.downs,phase==='prepared'?0:1);
    assert.equal(f.r.buttons,0);assert(f.g.status('one').physicalUp.trusted);
    if(edge)assert.equal(f.consume(edge,1,1),0);else assert.equal(f.r.inputQueue.length,0);
  }
});
test('retained post-capture stale timeline denies DOWN and cannot presume a renderer UP receipt',()=>{
 let wall=Date.now(),mono=performance.now();const f=fixture({code:1,button:0,clock:{now:()=>wall,monotonic:()=>mono}});
 wall+=36;mono+=36;assert.equal(f.prepare().state,'PREPARED');
 // Retained sample age36 at prepare,216ms final capture and35ms transport.
 wall+=271;mono+=271;assert.equal(f.g.snapshot().readiness.sceneAge,307);
 f.down();assert.equal(f.r.downs,0);assert.equal(f.r.inputQueue.length,0);
 assert.equal(f.g.status('one').state,'CANCELLED');
 f.g.close('stale sample UNKNOWN');f.r.handleMouseUp(50,70,0);
 assert.equal(f.g.status('one').physicalUp,null);
 // A transport UP ACK cannot stand in for that absent renderer receipt.
});
test('no consumer, stale observation, deadline, terminal cancel',async()=>{
  for(const mode of ['stale','deadline','cancel']){
    const f=fixture();f.prepare();f.down();assert.equal(f.g.status('one').consumed,false);
    if(mode==='cancel')f.g.close('cancel');else await new Promise(r=>setTimeout(r,mode==='stale'?260:510));
    f.g.sweep();assert.equal(f.r.inputQueue.length,0);f.down();assert.equal(f.r.downs,1);
  }
});
test('release state emits exact right UP, shrinks due, burns cancellation and fired state',()=>{
  const i={kind:'mouse',code:2,button:2,x:50,y:70,ms:80,mode:'game',nonce:'release',name:'action-1'};
  const r=createReleaseState(i);const old=r.state.due;r.command({command:'due',nonce:i.nonce,at:Date.now()+80});assert(r.state.due<old);
  assert.deepEqual(r.params(),{type:'mouseReleased',button:'right',buttons:0,x:50,y:70,clickCount:1});assert.throws(()=>r.params());
  const c=createReleaseState(i);c.command({command:'cancel',nonce:i.nonce});assert.throws(()=>c.params());
  assert.throws(()=>c.command({command:'due',nonce:i.nonce,at:Date.now()+80}));
  assert.throws(()=>adapter.exactMouse({...i,button:0}));assert.throws(()=>adapter.exactMouse({...i,code:1}));
});
test('controller preserves final socket publication/release order and stops all later requests after UNKNOWN',async()=>{
  const i={kind:'mouse',code:2,button:2,x:50,y:70,ms:80,mode:'game',nonce:'release',name:'action-1'};
  for(const bad of [false,true]){
    const order=[];let calls=0;
    const a={capability:'native-manual-context-v1',validate(){},beforeDown:async()=>order.push('capture'),consume(){order.push('consume');}};
    const c=adapter.createController({authority:a,close:()=>order.push('closed'),
      page:async method=>{calls++;if(method==='prepareEquivalent')return {prepared:{state:'PREPARED'}};
        return {nonce:i.nonce,state:'CONSUMED',consumed:true,receiptBoundary:'owner-worker-native-user-return',nativeMessage:{consumption:'owner-user-return',token:1,msg:bad?0x201:0x204,wParam:2}};},
      dispatch:async(i,publish,onPublished)=>{order.push('final-capture');publish();order.push('DOWN');onPublished();},
      release:{arm:async()=>{order.push('arm');const at=Date.now();return {at,releaseDue:at+1500,fallback:at+1750};},
        due:()=>order.push('due'),cancel:()=>order.push('cancel'),finish:async()=>{order.push('UP');return {ok:true};}}});
    if(bad){await assert.rejects(c.gesture(i,{},{}),/native mouse/);const n=calls;await assert.rejects(c.gesture({...i,nonce:'new'},{},{}),/permanently closed/);assert.equal(calls,n);}
    else{await c.gesture(i,{},{});assert(order.indexOf('final-capture')<order.indexOf('due'));assert(order.indexOf('due')<order.indexOf('DOWN'));assert(order.includes('UP'));}
  }
});
