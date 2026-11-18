'use strict';
const assert = require('node:assert/strict');
const {createGate, connection, childWorkers, verifyReadback, workerContexts} = require('../tools/revolt-display-admission.cjs');
class Socket {
  constructor() { this.requests = []; queueMicrotask(() => this.onopen()); }
  close() { this.onclose?.(); }
  send(s) { this.requests.push(JSON.parse(s)); }
  reply(result, error) {
    const q = this.requests.at(-1);
    this.onmessage({data: JSON.stringify({id:q.id, ...(q.sessionId?{sessionId:q.sessionId}:{}), result, error})});
  }
}
(async () => {
  const page = {targetId:'page-1',type:'page',url:'http://localhost/game'};
  const empty = {targetId:'worker-1',type:'worker',parentId:'page-1',url:''};
  const foreign = {...empty,targetId:'foreign',parentId:'other',url:page.url+'/lib/guest-worker.js'};
  assert.deepEqual(childWorkers([empty,foreign,page],page,page),[empty]);
  assert.deepEqual(childWorkers([{...empty,url:'http://localhost/lib/guest-worker.js'}],page,page).map(t=>t.targetId),['worker-1']);
  assert.throws(()=>childWorkers([empty],page,{...page,targetId:'new-page'}));
  assert.throws(()=>childWorkers([empty],page,{...page,url:page.url+'?new'}));
  assert.equal([empty].filter(t=>t.url.startsWith('http://localhost/lib/')).length,0,'old URL admission excludes actual child');
  {
    const gate=createGate(),trace=[],contexts=workerContexts(gate,v=>trace.push(v)),wire=[];
    contexts.attach(empty,page,'session');
    const send=async(method,params,sessionId)=>{wire.push({method,params,sessionId});return {result:{value:{endpoint:7,slot:0}}};};
    assert.equal((await contexts.read('session',send,'1',{ready:true})).ready,false);
    assert.equal(wire.length,0,'attachment is not execution-context readiness');
    contexts.event({sessionId:'foreign',method:'Runtime.executionContextCreated',params:{context:{id:1,uniqueId:'foreign'}}});
    assert.equal((await contexts.read('session',send,'1',{ready:true})).ready,false);
    contexts.event({sessionId:'session',method:'Runtime.executionContextCreated',params:{context:{id:1,uniqueId:'actual-context'}}});
    assert.equal((await contexts.read('session',send,'1',{ready:false,pending:['boot']})).ready,false);
    assert.equal(wire.length,0,'known busy/startup sends no execution request');
    assert.deepEqual((await contexts.read('session',send,'({endpoint:7,slot:0})',{ready:true})).value,{endpoint:7,slot:0});
    assert.equal(wire[0].params.uniqueContextId,'actual-context');
    assert.equal(wire[0].sessionId,'session');
    assert.deepEqual(trace.map(v=>v.boundary),['context-ready','request-start','reply']);
    contexts.event({sessionId:'session',method:'Runtime.executionContextCreated',params:{context:{id:1,uniqueId:'replacement'}}});
    await assert.rejects(contexts.read('session',send,'1',{ready:true}),/context replaced/);
    assert.equal(wire.length,1,'recycled numeric context cannot issue');
    assert.throws(()=>workerContexts(createGate()).attach({...empty,parentId:'foreign'},page,'s'));
  }
  for(const kind of ['exception','transport']){
    const gate=createGate(),contexts=workerContexts(gate);
    contexts.attach(empty,page,'s');contexts.event({sessionId:'s',method:'Runtime.executionContextCreated',params:{context:{id:1,uniqueId:'u'}}});
    await assert.rejects(contexts.read('s',async()=>{if(kind==='transport')throw Error('transport lost');return {exceptionDetails:{text:'actual exception'}};},'1',{ready:true}),/UNKNOWN/);
    assert(gate.closed);
  }
  for (const kind of ['error','timeout','exception','session']) {
    const closed=[], gate=createGate(v=>closed.push(v));
    const startup=connection('fixture',gate,{WebSocketClass:Socket,timeoutMs:25});
    const diagnostic=connection('fixture',gate,{WebSocketClass:Socket,timeoutMs:25});
    const release=connection('fixture',createGate(),{WebSocketClass:Socket,timeoutMs:25});
    await Promise.all([startup.ready,diagnostic.ready,release.ready]);
    const p=diagnostic.send('Runtime.evaluate',{},'diagnostic');
    if(kind==='error')diagnostic.ws.reply(null,{message:'injected query failure'});
    if(kind==='exception')diagnostic.ws.reply({exceptionDetails:{text:'injected'}});
    if(kind==='session')diagnostic.ws.onmessage({data:JSON.stringify({id:1,sessionId:'replacement',result:{}})});
    await assert.rejects(p,/UNKNOWN/);
    for(const c of [startup,diagnostic])for(const m of ['Runtime.evaluate','Target.getTargets','Input.dispatchKeyEvent'])await assert.rejects(c.send(m),/permanently closed/);
    assert.equal(startup.ws.requests.length,0);assert.equal(diagnostic.ws.requests.length,1);assert.equal(closed.length,1);
    assert.throws(()=>connection('fixture',gate,{WebSocketClass:Socket}),/permanently closed/);
    // An already independent matching release is a distinct one-use transport.
    const up=release.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowUp'},'exact-prearmed-session');release.ws.reply({});await up;
    assert.deepEqual(release.ws.requests.map(q=>[q.method,q.params.type,q.sessionId]),[['Input.dispatchKeyEvent','keyUp','exact-prearmed-session']]);
    release.stop();startup.stop();diagnostic.stop();
  }
  const now=Date.now(), owner={windowHwnd:65537,processId:1000};
  const m={observation:'current-display',content:'already-displayed',completion:'canvas2d-readback',publication:1,retainedPublicationPixels:true,captureOwner:{hwnd:65537,processId:1000},composition:{windows:[{hwnd:65537,processId:1000}]},source:{kind:'logical',width:640,height:480},output:{width:640,height:480},displayedAt:now-10,requestedAt:now-5,readbackStartedAt:now-2,readbackCompletedAt:now-1};
  verifyReadback(m,owner,now);
  // A new observation of a static publication is fresh; the publication is
  // not required to be newly painted. Keep the original display timestamp.
  verifyReadback({...m,displayedAt:now-86400000},owner,now);
  verifyReadback({...m,displayedAt:now-30001},owner,now);
  verifyReadback({...m,displayedAt:now-86400000},owner,now);
  verifyReadback({...m,retainedPublicationPixels:false,rendererWorkAtRequest:{writerHeld:false,gdiPaint:false,repainting:false}},owner,now);
  verifyReadback({...m,content:'ordinary-publication-after-request',displayedAt:now-4,retainedPublicationPixels:false,rendererWorkAtRequest:{writerHeld:true,gdiPaint:false,repainting:false}},owner,now);
  const clean = {writerHeld:false,gdiPaint:false,repainting:false};
  const serviced = {...m,retainedPublicationPixels:false,rendererWorkAtRequest:{...clean,writerHeld:true},
    rendererWorkAtReadback:{before:clean,after:clean}};
  verifyReadback(serviced,owner,now);
  for (const side of ['before','after']) for (const k of Object.keys(clean)) {
    for (const bad of [true,undefined]) assert.throws(()=>verifyReadback({...serviced,
      rendererWorkAtReadback:{...serviced.rendererWorkAtReadback,[side]:{...clean,[k]:bad}}},owner,now));
  }
  for (const state of [undefined,{}, {before:clean}, {after:clean}])
    assert.throws(()=>verifyReadback({...serviced,rendererWorkAtReadback:state},owner,now));
  for(const patch of [{retainedPublicationPixels:false},{displayedAt:now-60000,requestedAt:now-30000},{displayedAt:now-60000,requestedAt:now-30001},{displayedAt:now+1},{requestedAt:now+1},{completion:'synthetic'},{captureOwner:{hwnd:2,processId:1000}},{captureOwner:{hwnd:65537,processId:1001}},{source:{kind:'unknown'}},{readbackCompletedAt:now+1}])assert.throws(()=>verifyReadback({...m,...patch},owner,now));
  assert.throws(()=>verifyReadback({...m,content:'ordinary-publication-after-request',displayedAt:now-30001},owner,now),'new-publication claim must follow its request');
  console.log('PASS exact-parent empty/delayed URL, replacement negatives; shared sticky query error/exception/timeout/session closure and independent UP; readback identity/freshness');
})().catch(e=>{console.error(e);process.exitCode=1;});
