'use strict';
// Wire metadata only. Never issues a CDP command or inspects response payloads.
const crypto = require('node:crypto');
const fs = require('node:fs');
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
function expressionMetadata(expression, labels = new Map()) {
  const sha256 = hash(expression);
  const known = expression === 'globalThis.__gltronObserver?.snapshot?.()??null' ? 'startup-gl-snapshot'
    : expression.startsWith("typeof runningApps==='undefined'?null:runningApps.map") ? 'startup-worker-readiness'
    : 'unclassified-expression';
  return {label: labels.get(sha256) || known, sha256,
    length: expression.length, bytes: Buffer.byteLength(expression)};
}
function createObserver({emit, connectionId = 'standalone', now = () => performance.now(), wall = Date.now,
  deadlineMs = 3000, labels = new Map()} = {}) {
  const requests = new Map(), sessions = new Map(), targets = new Map();
  let sequence = 0, terminal = null;
  // A broken evidence sink must not change transport behavior.
  function record(type, fields = {}) {
    try { emit({connectionId, sequence: ++sequence, type, at: wall(), monotonicMs: now(), ...fields}); } catch {}
  }
  function identity(sessionId, targetId) {
    targetId ??= sessions.get(sessionId);
    return {sessionId: sessionId ?? null, targetId: targetId ?? null,
      targetType: targets.get(targetId)?.type ?? null};
  }
  function sent(data, timing = {}) {
    let v; try { v = JSON.parse(data); } catch { record('non-json-send'); return; }
    if (!Number.isInteger(v.id) || typeof v.method !== 'string') return;
    const start = timing.start ?? now(), row = {id:v.id, method:v.method,
      ...identity(v.sessionId, v.params?.targetId), start, startedAt:timing.startedAt ?? wall(),
      sessionPresent:Object.hasOwn(v,'sessionId'),
      deadline:timing.deadline ?? start + deadlineMs, deadlineMs,
      deadlineOrigin:timing.deadline === undefined ? 'wire-send (helper timer registered immediately before send)' : 'helper-operation-start',
      scriptId:v.method === 'Debugger.getScriptSource' ? v.params?.scriptId ?? null : null,
      expression: v.method === 'Runtime.evaluate' && typeof v.params?.expression === 'string'
        ? expressionMetadata(v.params.expression, labels) : null};
    requests.set(v.id, row); record('request', row);
  }
  function received(data) {
    let v; try { v = JSON.parse(data); } catch { record('non-json-receive'); return; }
    if (Number.isInteger(v.id)) {
      const r = requests.get(v.id);
      if (!r) { record('unmatched-response', {id:v.id, ...identity(v.sessionId)}); return; }
      if (r.method === 'Target.getTargets') for (const t of v.result?.targetInfos || []) targets.set(t.targetId,{type:t.type});
      if (r.method === 'Target.attachToTarget' && v.result?.sessionId) sessions.set(v.result.sessionId,r.targetId);
      const elapsedMs = now() - r.start;
      const script=r.method === 'Debugger.getScriptSource' && v.result
        ? (v.result.bytecode ? Buffer.from(v.result.bytecode,'base64') : Buffer.from(v.result.scriptSource || '')) : null;
      record('response', {id:r.id, method:r.method, ...identity(v.sessionId, r.targetId),
        expectedSessionId:r.sessionId, sessionMatches:Object.hasOwn(v,'sessionId') === r.sessionPresent && (v.sessionId ?? null) === r.sessionId,
        elapsedMs, deadline:r.deadline, afterDeadline:now() >= r.deadline,
        afterTerminal:terminal !== null, terminal,
        protocolErrorCode: v.error?.code ?? null,
        expressionException:!!v.result?.exceptionDetails,
        resultType:v.result?.result?.type ?? null, duplicate:!!r.responded,
        scriptId:r.scriptId, scriptSha256:script ? hash(script) : null,
        scriptBytes:script?.length ?? null, bytecode:!!v.result?.bytecode});
      r.responded = true; return;
    }
    const p = v.params || {};
    if (v.method === 'Target.attachedToTarget') {
      sessions.set(p.sessionId,p.targetInfo?.targetId);
      targets.set(p.targetInfo?.targetId,{type:p.targetInfo?.type});
    }
    if (v.method === 'Target.targetCreated' || v.method === 'Target.targetInfoChanged') targets.set(p.targetInfo?.targetId,{type:p.targetInfo?.type});
    // Keep identity after detach/destroy so outstanding replies remain attributable.
    if (/^(Target\.(attachedToTarget|detachedFromTarget|targetCreated|targetDestroyed|targetInfoChanged|targetCrashed)|Inspector\.(detached|targetCrashed)|Runtime\.(executionContextCreated|executionContextDestroyed|executionContextsCleared|exceptionThrown)|Debugger\.scriptParsed|Page\.(frameNavigated|loadEventFired|domContentEventFired|lifecycleEvent))$/.test(v.method)) {
      record('lifecycle', {method:v.method, ...identity(p.sessionId ?? v.sessionId,p.targetId ?? p.targetInfo?.targetId),
        targetUrlSha256:typeof p.targetInfo?.url === 'string' ? hash(p.targetInfo.url) : null,
        targetUrlLength:p.targetInfo?.url?.length ?? null,
        scriptId:p.scriptId ?? null, scriptLanguage:p.scriptLanguage ?? null,
        scriptUrlSha256:typeof p.url === 'string' ? hash(p.url) : null,
        contextId:p.executionContextId ?? p.context?.id ?? null,
        contextUniqueId:p.executionContextUniqueId ?? p.context?.uniqueId ?? null,
        frameId:p.frameId ?? p.frame?.id ?? null,
        lifecycleName:p.name ?? null});
    }
  }
  function markTerminal(reason, trigger = null) {
    terminal ??= {reason, trigger, at:wall(), monotonicMs:now()};
    record('terminal', {terminal, outstanding:[...requests.values()].filter(r=>!r.responded)});
  }
  return {sent, received, markTerminal,
    socketEvent:(event)=>record('socket', {event}),
    snapshot:()=>({terminal, outstanding:[...requests.values()].filter(r=>!r.responded).map(r=>({...r,elapsedMs:now()-r.start,afterDeadline:now()>=r.deadline}))})};
}
function install({WebSocket: Native = globalThis.WebSocket, emit, labels, deadlineMs} = {}) {
  const observers = [];
  class ObservedWebSocket extends Native {
    constructor(...args) {
      super(...args);
      const observer = createObserver({emit, labels, deadlineMs,connectionId:process.pid+':'+(observers.length+1)});
      observers.push(observer);
      this.addEventListener('message', e=>observer.received(e.data));
      for (const event of ['open','close','error']) this.addEventListener(event,()=>observer.socketEvent(event));
      Object.defineProperty(this,'startupObserver',{value:observer});
    }
    send(data) { this.startupObserver.sent(data); return super.send(data); }
  }
  globalThis.WebSocket = ObservedWebSocket;
  return {observers, restore() { if(globalThis.WebSocket === ObservedWebSocket) globalThis.WebSocket = Native; }};
}
function fromEnvironment(expressions = {}) {
  if (!process.env.QUAKE3_STARTUP_OPERATION_LOG) return null;
  const labels=new Map(Object.entries(expressions).filter(([,v])=>typeof v==='string').map(([k,v])=>[hash(v),k]));
  const file=process.env.QUAKE3_STARTUP_OPERATION_LOG;
  return createObserver({connectionId:process.pid+':'+(++fromEnvironment.next),labels,
    emit:v=>fs.appendFileSync(file,JSON.stringify({pid:process.pid,...v})+'\n')});
}
fromEnvironment.next=0;
module.exports = {hash, expressionMetadata, createObserver, install, fromEnvironment};
if (process.env.QUAKE3_STARTUP_PRELOAD === '1' && process.env.QUAKE3_STARTUP_OPERATION_LOG) {
  const fd=fs.openSync(process.env.QUAKE3_STARTUP_OPERATION_LOG,'ax');
  const helper=require('./quake3-browser-controller.cjs');
  const labels=new Map(['PAGE_READ','HOST_READ','GL_OBSERVER'].filter(k=>typeof helper[k]==='string').map(k=>[hash(helper[k]),k]));
  const installed=install({labels,emit:v=>fs.writeSync(fd,JSON.stringify({pid:process.pid,...v})+'\n')});
  process.once('exit',code=>{for(const o of installed.observers)o.markTerminal('process-exit-'+code);fs.closeSync(fd);});
}
