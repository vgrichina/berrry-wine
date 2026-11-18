'use strict';
// Passive browser admission for both GPS-presented and CPU/readback D3DIM output.
const assert = require('node:assert/strict');
const base = require('./gltron-browser-binding.cjs');
const PAGE_READ = base.PAGE_READ
  .replace("['gl','gl-gps']", "['gl','gl-gps','d3dim','d3dim-gps']")
  .replace('const gps=w?.hostCtx?.getGlGpsBridge?.();', 'const gps=p?.options.api==="d3dim-gps"?w?.hostCtx?.d3dimBridge:w?.hostCtx?.getGlGpsBridge?.();')
  .replaceAll("p?.options.api==='gl-gps'", "['gl-gps','d3dim-gps'].includes(p?.options.api)");

function createGate(onClose = () => {}) {
  let failure = null;
  const listeners = new Set();
  return {
    get closed() { return failure !== null; },
    check() { if (failure) throw failure; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    seal(reason) {
      if (failure) return failure;
      failure = Error('UNKNOWN ' + reason + '; permanently closed; no replay');
      onClose({at: Date.now(), reason: String(reason), laterOrdinaryRequestsAllowed: 0});
      for (const fn of listeners) fn(failure);
      return failure;
    },
  };
}

function connection(url, gate, {timeoutMs = 3000, WebSocketClass = WebSocket} = {}) {
  gate.check();
  const ws = new WebSocketClass(url), pending = new Map();
  let id = 0, stopped = false, resolveReady, rejectReady;
  const ready = new Promise((r, j) => { resolveReady = r; rejectReady = j; });
  const fail = error => {
    clearTimeout(openTimer); rejectReady(error);
    for (const p of pending.values()) { clearTimeout(p.timer); p.reject(error); }
    pending.clear(); ws.close();
  };
  const unsubscribe = gate.subscribe(fail);
  const openTimer = setTimeout(() => gate.seal('connection timeout'), timeoutMs);
  const api = {ws, ready, event: () => {}, get closed() { return stopped || gate.closed; },
    stop() { stopped = true; unsubscribe(); fail(Error('host teardown')); },
    send(method, params = {}, sessionId) {
      try { gate.check(); assert(!stopped, 'transport stopped'); } catch (e) { return Promise.reject(e); }
      return new Promise((resolve, reject) => {
        const n = ++id, timer = setTimeout(() => gate.seal(method + ' timeout'), timeoutMs);
        pending.set(n, {resolve, reject, timer, sessionId});
        try { gate.check(); ws.send(JSON.stringify({id: n, method, params, ...(sessionId ? {sessionId} : {})})); }
        catch (e) { gate.seal(method + ' send: ' + e); }
      });
    },
  };
  ws.onopen = () => { clearTimeout(openTimer); resolveReady(); };
  ws.onerror = () => { if (!stopped) gate.seal('transport error'); };
  ws.onclose = () => { if (!stopped) gate.seal('transport closed'); };
  ws.onmessage = msg => {
    if (gate.closed || stopped) return;
    try {
      const v = JSON.parse(msg.data);
      if (!v.id) { api.event(v); return; }
      const p = pending.get(v.id); if (!p) return;
      if (v.sessionId !== p.sessionId) throw Error('reply session changed');
      // Keep the pending request until failure sealing rejects all consumers.
      if (v.error || v.result?.exceptionDetails) throw Error(JSON.stringify(v.error || v.result.exceptionDetails));
      clearTimeout(p.timer); pending.delete(v.id); p.resolve(v.result);
    } catch (e) { gate.seal(e); }
  };
  return api;
}

function childWorkers(targets, parent, livePage) {
  assert.equal(livePage.targetId, parent.targetId, 'page target replaced');
  assert.equal(livePage.type, 'page');
  assert.equal(livePage.url, parent.url, 'page navigated');
  // URL is descriptive metadata, never Worker identity. Empty/delayed URLs
  // are normal CDP observations. Never fall back to origin or guessed roles.
  return targets.filter(t => t.type === 'worker' && t.parentId === parent.targetId);
}

// Production validator checks retained pixels, complete publication, exact
// window/instance/geometry, source/output and visibility. GPS presenter state
// is deliberately not a prerequisite for the native readback route.
const DISPLAY_READ = `(() => {
  const page=(${PAGE_READ}),a=page.apps[0];
  if(!page.isolated||page.apps.length!==1||!a.running||a.stopped||!a.guestWorker||!a.outputVisible)throw Error('live visible isolated owner required');
  if(a.renderApi!=='d3dim-gps')throw Error('actual D3DIM GPS endpoint required');
  const w=runningApps[0].wine,r=w.renderer,win=r.windows[a.windowHwnd];
  if(r._repainting||!r._currentDisplayRecord||(!r._currentDisplayRecord.pixels&&(r._workerPublicationHeld()||r._workerGdiPaintDepth>0)))
    return {ready:false,pending:'ordinary display transaction',page,at:Date.now()};
  const rec=r._validateCurrentDisplayCapture({owner:{hwnd:a.windowHwnd,window:win,processId:w.processId,instance:w.instance}});
  if(!(a.publication>0)||!Number.isFinite(rec.displayedAt)||rec.displayedAt>Date.now())throw Error('completed display publication required');
  return {ready:true,page,publication:a.publication,displayedAt:rec.displayedAt,at:Date.now(),
    backend:rec.display.backend,source:rec.display.source===r.canvas?'logical':'exclusive',
    retainedPixels:!!rec.pixels,window:win.hwnd,presenterPresents:w.hostCtx.d3dimBridge.presenter?.presents??0};
})()`;

function verifyReadback(m, owner, now = Date.now(), maxAge = 30000) {
  assert.equal(m.observation, 'current-display');
  assert.equal(m.completion, 'canvas2d-readback');
  assert(['already-displayed','ordinary-publication-after-request'].includes(m.content), 'ordinary display content');
  assert(m.content === 'ordinary-publication-after-request' || m.retainedPublicationPixels ||
    (m.rendererWorkAtRequest && Object.values(m.rendererWorkAtRequest).every(v => v === false)),
  'ordinary publication completion, retained pixels or unheld display readback');
  assert.equal(m.captureOwner.hwnd, owner.windowHwnd);
  assert.equal(m.captureOwner.processId, owner.processId);
  assert(m.composition.windows.some(w => w.hwnd === owner.windowHwnd && w.processId === owner.processId));
  assert(Number.isSafeInteger(m.publication) && m.publication > 0, 'ordinary publication sequence');
  assert(m.source.width > 0 && m.source.height > 0 && m.output.width > 0 && m.output.height > 0, 'whole source/output dimensions');
  assert(['logical','exclusive'].includes(m.source.kind));
  for (const k of ['displayedAt','requestedAt','readbackStartedAt','readbackCompletedAt']) assert(Number.isFinite(m[k]), k);
  assert(m.displayedAt <= m.readbackStartedAt && m.requestedAt <= m.readbackStartedAt && m.readbackStartedAt <= m.readbackCompletedAt && m.readbackCompletedAt <= now);
  if (m.content === 'ordinary-publication-after-request') assert(m.displayedAt >= m.requestedAt, 'ordinary completion follows request');
  // displayedAt is the age of the ordinary publication, not this observation.
  // A static window can remain current indefinitely. The renderer validates
  // that publication/owner/output around the request-local pixel readback;
  // callers must still pin the live document, canvas and owner around capture.
  // Never accept an old request merely because its pixels completed recently.
  assert(now - m.requestedAt < maxAge, 'request freshness');
}
// A display publication can precede completion of boot/first-device work.
// Observe the existing scheduler, without waking a Worker or changing its work.
const CLASSIFICATION_READY_READ = `(() => {
  const page=(${PAGE_READ});
  if(page.apps.length!==1) return {ready:false,pending:['app startup'],page};
  const w=runningApps[0].wine,g=w?.guestWorker,m=w?._renderWorkerManager;
  const links=[...new Set([g?.link,...(g?.threadLinks?.values()||[]),...(g?._startingLinks||[])].filter(Boolean))];
  const pending=[];
  for(const l of links){
    if(l._stopped||l._stopping||l._writerAmbiguous)throw Error('guest endpoint retired or ambiguous');
    if(l._readyPromise)pending.push({endpoint:l.endpointIdentity,slot:l.slot,stage:'init'});
    for(const [seq,p] of l._pending)pending.push({endpoint:l.endpointIdentity,slot:l.slot,seq,stage:p.command});
  }
  if(m?.stopped)throw Error('render manager retired');
  if(m?.pending.size)pending.push({stage:'render',requests:m.pending.size,bytes:m.queuedBytes});
  if(!g?.link||!m)pending.push({stage:'owner startup'});
  return {ready:pending.length===0,pending,page,at:Date.now()};
})()`;

// Context readiness is independent of target attachment and scheduler readiness.
// Pin Chrome's unique context ID, never a recycled numeric executionContextId.
// A NOT_READY result issues no Worker request. Once issued, uncertainty seals
// the shared gate; a later context or late reply cannot retry that scope.
function workerContexts(gate, onBoundary = () => {}) {
  const sessions = new Map();
  function attach(target, parent, sessionId) {
    assert.equal(target.type, 'worker'); assert.equal(target.parentId, parent.targetId);
    assert(!sessions.has(sessionId), 'duplicate Worker session');
    assert(![...sessions.values()].some(s => s.targetId === target.targetId), 'duplicate Worker target');
    sessions.set(sessionId, {targetId:target.targetId,parentId:parent.targetId,sessionId,context:null,issued:false});
  }
  function event(v) {
    if(v.method==='Target.detachedFromTarget'&&sessions.has(v.params.sessionId)){
      const s=sessions.get(v.params.sessionId);
      onBoundary({boundary:'target-retired',at:Date.now(),...s});
      gate.seal('Worker target retired');return;
    }
    const s=sessions.get(v.sessionId); if(!s)return;
    const emit=(boundary,extra={})=>onBoundary({boundary,at:Date.now(),...s,...extra});
    if(v.method==='Runtime.executionContextCreated'){
      const context=v.params.context;
      if(context.auxData?.isDefault===false)return;
      if(!context.uniqueId){gate.seal('Worker unique context missing');return;}
      if(s.context&&s.context.uniqueId!==context.uniqueId){gate.seal('Worker context replaced');return;}
      s.context=context;emit('context-ready');
    }else if(v.method==='Runtime.executionContextsCleared'||
      v.method==='Runtime.executionContextDestroyed'&&
      (v.params.executionContextUniqueId===s.context?.uniqueId||v.params.executionContextId===s.context?.id)){
      emit('context-retired');gate.seal('Worker context retired');
    }else if(v.method==='Runtime.consoleAPICalled'){
      const args=v.params.args?.map(a=>a.value);
      if(args?.[0]==='REVOLT_WORKER_BOUNDARY')emit(args[2],{nonce:args[1]});
    }
  }
  async function read(sessionId, send, expression, readiness) {
    gate.check();const s=sessions.get(sessionId);assert(s,'unowned Worker session');
    if(!s.context||!readiness?.ready)return {ready:false,pending:!s.context?'context startup':readiness.pending};
    const nonce=require('node:crypto').randomUUID(),context=s.context.uniqueId;
    const emit=(boundary,extra={})=>onBoundary({boundary,at:Date.now(),targetId:s.targetId,sessionId,context,nonce,...extra});
    const body=`(()=>{console.debug('REVOLT_WORKER_BOUNDARY',${JSON.stringify(nonce)},'body-entry');try{return (${expression});}finally{console.debug('REVOLT_WORKER_BOUNDARY',${JSON.stringify(nonce)},'body-end');}})()`;
    s.issued=true;emit('request-start');
    try{
      const reply=await send('Runtime.evaluate',{expression:body,uniqueContextId:context,returnByValue:true},sessionId);
      gate.check();assert.equal(s.context.uniqueId,context,'Worker context replaced during read');
      if(reply.exceptionDetails)throw Error('Worker exception '+JSON.stringify(reply.exceptionDetails));
      emit('reply');return {ready:true,value:reply.result.value,context,targetId:s.targetId};
    }catch(e){emit('request-failed',{error:String(e)});throw gate.seal('Worker read '+s.targetId+': '+e);}
  }
  return {attach,event,read};
}
module.exports = {PAGE_READ, DISPLAY_READ, CLASSIFICATION_READY_READ, workerContexts, createGate, connection, childWorkers, verifyReadback};
