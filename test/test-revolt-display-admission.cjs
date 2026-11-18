'use strict';
const assert = require('node:assert/strict');
const {createGate, connection, childWorkers, verifyReadback} = require('../tools/revolt-display-admission.cjs');
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
  verifyReadback({...m,retainedPublicationPixels:false,rendererWorkAtRequest:{writerHeld:false,gdiPaint:false,repainting:false}},owner,now);
  verifyReadback({...m,content:'ordinary-publication-after-request',displayedAt:now-4,retainedPublicationPixels:false,rendererWorkAtRequest:{writerHeld:true,gdiPaint:false,repainting:false}},owner,now);
  for(const patch of [{retainedPublicationPixels:false},{displayedAt:now-30001},{completion:'synthetic'},{captureOwner:{hwnd:2,processId:1000}},{source:{kind:'unknown'}},{readbackCompletedAt:now+1}])assert.throws(()=>verifyReadback({...m,...patch},owner,now));
  console.log('PASS exact-parent empty/delayed URL, replacement negatives; shared sticky query error/exception/timeout/session closure and independent UP; readback identity/freshness');
})().catch(e=>{console.error(e);process.exitCode=1;});
