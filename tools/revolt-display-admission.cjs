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
  assert(now - m.displayedAt < maxAge && now - m.requestedAt < maxAge, 'display/request freshness');
}
module.exports = {PAGE_READ, DISPLAY_READ, createGate, connection, childWorkers, verifyReadback};
