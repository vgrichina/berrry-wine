'use strict';
// Native-CDP capture/admission chain. No guest memory, clocks or callbacks are written.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const wait = ms => new Promise(r => setTimeout(r, ms));
const FIELDS = ['processId', 'processObject', 'endpoint', 'endpointObject', 'workerObject',
  'workerTarget', 'workerInstance', 'moduleObject', 'moduleSha256', 'epoch',
  'renderEndpoint', 'renderEndpointObject', 'renderWorkerObject',
  'rendererTarget', 'rendererEpoch', 'rendererModuleSha256'];
const MAX_AGE_MS = 12000;
function same(a, b) {
  for (const field of FIELDS) {
    assert(a?.[field] !== undefined && a[field] !== null && a[field] !== '', 'missing identity ' + field);
    assert.equal(b?.[field], a[field], 'identity changed: ' + field);
  }
}
// Object tokens are scoped to this actual document. Replacing an owner with an
// equal-looking object, or reloading the page, cannot reuse a reviewed token.
const PAGE_READ = `(() => {
  const k = '__mcmPassiveIdentityV1';
  if (!globalThis[k]) Object.defineProperty(globalThis, k, {value:{
    epoch:crypto.randomUUID(), ids:new WeakMap(), next:0}});
  const state=globalThis[k], token=o=>{
    if (!o || !['object','function'].includes(typeof o)) return null;
    if (!state.ids.has(o)) state.ids.set(o, state.epoch+':'+(++state.next));
    return state.ids.get(o);
  };
  return {isolated:crossOriginIsolated, apps:(typeof runningApps==='undefined'?[]:runningApps).map(a=>{
    const w=a.wine, g=w?.guestWorker, l=g?.link;
    const ports=[...(w?._renderWorkerManager?.ports?.values()||[])].filter(p=>!p.closed);
    const owned=ports.filter(p=>p.id===g?.d3dStats?.renderEndpointId);
    const p=owned.length===1?owned[0]:ports.length===1?ports[0]:null;
    return {name:a.name,running:!!w?.running,stopped:!!w?._stopped,guestWorker:!!g,
      processId:w?.processId,processObject:token(w),endpoint:l?.endpointIdentity,endpointObject:token(l),
      renderEndpoint:p?.id??'none',renderEndpointObject:p?token(p):'none',
      renderWorkerObject:token(w?._renderWorkerManager?.worker)??'none',
      guestEndpoint:l?.endpointIdentity,slot:l?.slot,workerObject:token(l?.worker),
      moduleObject:token(l?.module),epoch:state.epoch,
      slice:w?._workerLastSlice??null,d3dStats:g?.d3dStats??null,
      physical:[37,38,39,40].map(key=>({key,state:w?.renderer?.peekKeyDownState(key)??null}))};
  })};
})()`;
const WORKER_READ = `(() => {
  if (typeof endpointIdentity==='undefined'||typeof workerSlot==='undefined'||typeof instance==='undefined'||!instance) return null;
  if (!globalThis.__mcmPassiveInstanceV1) Object.defineProperty(globalThis,'__mcmPassiveInstanceV1',
    {value:{ids:new WeakMap(),epoch:crypto.randomUUID(),next:0}});
  const s=globalThis.__mcmPassiveInstanceV1;
  if(!s.ids.has(instance))s.ids.set(instance,s.epoch+':'+(++s.next));
  return {endpointIdentity,slot:workerSlot,instance:s.ids.get(instance)};
})()`;
const RENDER_READ = `(() => {
  if(typeof endpoints==='undefined')return [];
  if(!globalThis.__mcmPassiveRenderV1)Object.defineProperty(globalThis,'__mcmPassiveRenderV1',
    {value:{ids:new WeakMap(),epoch:crypto.randomUUID(),next:0}});
  const s=globalThis.__mcmPassiveRenderV1;
  return Array.from(endpoints,([id,e])=>{
    if(!s.ids.has(e))s.ids.set(e,s.epoch+':'+(++s.next));
    if(typeof instance==='undefined'||!instance)throw Error('renderer instance unavailable');
    if(!s.ids.has(instance))s.ids.set(instance,s.epoch+':'+(++s.next));
    return {id,epoch:s.ids.get(e)+'/'+s.ids.get(instance),failed:!!e.failed,
      control:e.control?{completed:Atomics.load(e.control,1),error:Atomics.load(e.control,2),commands:Atomics.load(e.control,5)}:null};
  });
})()`;

function createChain({evaluate, send, workers, pageSession, app = 'mcm', now = Date.now}) {
  let latest = null, busy = false, closed = false;
  // CDP WebAssembly scripts are immutable within their actual Worker/session.
  // Cache only bytes we recovered and hashed ourselves. Each use still reads
  // current page/Worker/instance/renderer identities and the full script set.
  const moduleCache = new WeakMap();
  function modules(w) {
    assert(!w.closed, 'Worker detached during identity read');
    assert(w.scripts.length && w.scripts.every(s=>s.bytecodeAvailable && s.sha256 && !s.error),
      'complete recovered live module inventory required');
    return [...new Map(w.scripts.map(s=>[s.scriptId,s])).values()];
  }
  async function readLive() {
    const started = performance.now(), timings = [];
    async function measured(operation, task) {
      const at = performance.now();
      const value = await task();
      timings.push({operation, ms:performance.now()-at});
      return value;
    }
    const read = (expression, session, label) => measured(label, ()=>evaluate(expression, session));
    async function moduleHash(w, scripts, label) {
      const signature = JSON.stringify([w.sessionId,w.targetId,scripts.map(s=>[s.scriptId,s.sha256])]);
      const cached = moduleCache.get(w);
      if(cached?.signature===signature) {
        timings.push({operation:label,ms:0,cached:true,bytes:cached.bytes});
        return cached.sha256;
      }
      const source = await measured(label+'.transfer', ()=>send('Debugger.getScriptSource', {scriptId:scripts[0].scriptId}, w.sessionId));
      assert(source.bytecode, 'live module bytecode required');
      const at=performance.now(), bytes=Buffer.from(source.bytecode,'base64'), digest=sha(bytes);
      timings.push({operation:label+'.hash',ms:performance.now()-at,bytes:bytes.length,cached:false});
      assert.equal(digest,scripts[0].sha256,'live module bytes changed');
      assert.equal(JSON.stringify([w.sessionId,w.targetId,modules(w).map(s=>[s.scriptId,s.sha256])]),signature,'module inventory changed during retrieval');
      moduleCache.set(w,{signature,sha256:digest,bytes:bytes.length});
      return digest;
    }
    const page = await read(PAGE_READ, undefined, 'page.before');
    assert(page.isolated && page.apps.length === 1, 'one isolated registered app required');
    const a = page.apps[0];
    assert(a.name === app && a.running && !a.stopped && a.guestWorker, 'live registered app required');
    const candidates=[...workers.values()].filter(w=>!w.closed);
    // Different Worker targets and renderer reads have no dependency on each
    // other. Await all results, so failures cannot leave unobserved reads.
    const results=await Promise.allSettled(candidates.filter(w=>w.url.includes('guest-worker') || a.renderEndpoint!=='none'&&w.url.includes('d3d-render-worker')).map(async w=>{
      const guest=w.url.includes('guest-worker');
      return {w,guest,value:await read(guest?WORKER_READ:RENDER_READ,w.sessionId,(guest?'guest:':'renderer:')+w.targetId)};
    }));
    for(const r of results)if(r.status==='rejected')throw r.reason;
    const observations=results.map(r=>r.value);
    const matches=observations.filter(o=>o.guest&&o.value?.endpointIdentity===a.guestEndpoint&&o.value.slot===a.slot);
    assert.equal(matches.length,1,'unique actual guest Worker target required');
    const {w,value:live}=matches[0],scripts=modules(w);
    assert.equal(scripts.length,1,'unique recovered live Worker module required');
    const owners=observations.filter(o=>!o.guest).flatMap(o=>o.value.filter(e=>e.id===a.renderEndpoint).map(endpoint=>({r:o.w,endpoint})));
    let rendererTarget='none',rendererEpoch='none',rendererModuleSha256='none',owner,renderScripts;
    if(a.renderEndpoint!=='none') {
      assert.equal(owners.length,1,'unique actual owning renderer required');
      owner=owners[0];const {r,endpoint}=owner;
      assert(!endpoint.failed&&!endpoint.control?.error,'live renderer required');
      rendererTarget=r.targetId;rendererEpoch=endpoint.epoch;
      renderScripts=modules(r);
      assert.equal(new Set(renderScripts.map(s=>s.sha256)).size,1,'unique actual renderer module required');
    }
    const hashes=await Promise.allSettled([moduleHash(w,scripts,'guest.module'),...(owner?[moduleHash(owner.r,renderScripts,'renderer.module')]:[])]);
    for(const h of hashes)if(h.status==='rejected')throw h.reason;
    const moduleSha256=hashes[0].value;
    if(owner)rendererModuleSha256=hashes[1].value;
    const rendererIdentity={rendererTarget,rendererEpoch,rendererModuleSha256};
    const identity = {...a, workerTarget:w.targetId, workerInstance:live.instance, moduleSha256,...rendererIdentity};
    same(identity, identity);
    // Recheck page references after asynchronous Worker reads. Never cache a
    // live object identity, target membership or running/failed status.
    const finalReads=await Promise.allSettled([
      read(PAGE_READ, undefined, 'page.after'),
      read(WORKER_READ,w.sessionId,'guest.after'),
      ...(owner?[read(RENDER_READ,owner.r.sessionId,'renderer.after')]:[])
    ]);
    for(const r of finalReads)if(r.status==='rejected')throw r.reason;
    const after=finalReads[0].value;
    assert.deepEqual(finalReads[1].value,live,'guest instance changed during identity read');
    if(owner)assert(finalReads[2].value.some(e=>e.id===a.renderEndpoint&&e.epoch===rendererEpoch&&!e.failed&&!e.control?.error),'renderer instance changed during identity read');
    assert(after.isolated && after.apps.length === 1 && after.apps[0].name===app && after.apps[0].running && !after.apps[0].stopped);
    same(identity, {...after.apps[0], workerTarget:w.targetId, workerInstance:live.instance, moduleSha256,...rendererIdentity});
    assert.equal(workers.get(w.sessionId),w,'Worker session replaced during identity read');
    assert.deepEqual(modules(w),scripts,'guest module inventory changed');
    if(owner) {
      assert.equal(workers.get(owner.r.sessionId),owner.r,'renderer session replaced during identity read');
      assert.deepEqual(modules(owner.r),renderScripts,'renderer module inventory changed');
    }
    return {identity, page:after, worker:{targetId:w.targetId, sessionId:w.sessionId, ...live},timing:{totalMs:performance.now()-started,reads:timings}};
  }
  function fresh(capture) {
    const age = now() - Date.parse(capture?.at);
    if (!(Number.isFinite(age) && age >= 0 && age <= MAX_AGE_MS)) {
      const e = Error('stale scene refused'); e.code = 'STALE_SCENE_BEFORE_DISPATCH'; throw e;
    }
    return age;
  }
  async function capture(label) {
    assert(!closed && !busy, 'closed or concurrent chain'); busy = true;
    try {
      const before = await readLive();
      // Validation after a screenshot can be slow on a busy renderer. It must
      // not make the reviewed pixels appear younger than their capture.
      const at = new Date(now()).toISOString();
      const shot = await send('Page.captureScreenshot', {format:'png'}, pageSession);
      const after = await readLive(); same(before.identity, after.identity);
      const png = Buffer.from(shot.data, 'base64');
      latest = {label, at, completedAt:new Date(now()).toISOString(), sha256:sha(png), identity:after.identity};
      return {capture:structuredClone(latest), png, before, after};
    } finally { busy = false; }
  }
  async function admit(review, dispatch) {
    assert(!closed && !busy, 'closed or concurrent chain'); busy = true;
    let effects = false;
    try {
      assert(latest && review?.label === latest.label && review.sha256 === latest.sha256 && review.review?.trim(), 'current reviewed capture required');
      same(latest.identity, review.identity); fresh(latest);
      const live = await readLive(); same(latest.identity, live.identity); const ageMs = fresh(latest);
      effects = true;
      return await dispatch({ageMs, capture:structuredClone(latest), live});
    } catch (e) {
      // Identity/partial/UNKNOWN failures close this chain. Only a provably
      // pre-effect stale refusal permits a new capture through the transport.
      if (effects || e.code !== 'STALE_SCENE_BEFORE_DISPATCH') closed = true;
      throw e;
    } finally { busy = false; }
  }
  // Bounded passive reads only. These are execution observations, never a
  // logical frame/keyboard-poll or simulation-step assertion.
  async function progress(identity, stream = 'page') {
    assert(['page','renderer'].includes(stream), 'known passive progress stream');
    const page = await evaluate(PAGE_READ), a = page.apps[0];
    assert(page.apps.length === 1 && a?.running && !a.stopped);
    for (const f of ['processId','processObject','endpoint','endpointObject','workerObject','moduleObject','epoch','renderEndpoint','renderEndpointObject','renderWorkerObject'])
      assert.equal(a[f], identity[f], 'held identity changed: '+f);
    function worker(target, digest) {
      const matches=[...workers.values()].filter(w=>w.targetId===target&&!w.closed);
      assert.equal(matches.length,1,'held Worker retired or ambiguous');
      const w=matches[0];
      assert.equal(workers.get(w.sessionId),w,'held Worker session replaced');
      assert(modules(w).every(s=>s.sha256===digest),'held module inventory changed');
      return w;
    }
    worker(identity.workerTarget,identity.moduleSha256);
    // Do not enqueue guest export commands: the existing page slice and
    // shared render controls are passive and remain observable while blocked.
    if(stream==='page')return {stream,at:new Date(now()).toISOString(),slice:a.slice,d3dStats:a.d3dStats,physical:a.physical};
    const render=[];
    if(identity.rendererTarget!=='none') {
      const r=worker(identity.rendererTarget,identity.rendererModuleSha256);
      const endpoints=await evaluate(RENDER_READ,r.sessionId);
      assert(endpoints.filter(e=>e.id===identity.renderEndpoint).length===1 && endpoints.some(e=>e.id===identity.renderEndpoint&&e.epoch===identity.rendererEpoch&&!e.failed&&!e.control?.error),'held renderer epoch changed');
      assert.equal(worker(identity.rendererTarget,identity.rendererModuleSha256),r,'held renderer replaced');
      // A renderer reply is usable only while its page owner still matches.
      // This read is independent of the page sampling loop.
      const after=await evaluate(PAGE_READ);
      assert(after.apps.length===1&&after.apps[0]?.running&&!after.apps[0].stopped);
      for(const f of ['processId','processObject','endpoint','endpointObject','workerObject','moduleObject','epoch','renderEndpoint','renderEndpointObject','renderWorkerObject'])
        assert.equal(after.apps[0][f],identity[f],'held identity changed: '+f);
      render.push({targetId:r.targetId,endpoints});
    }
    return {stream,at:new Date(now()).toISOString(),render};
  }
  return {capture, admit, readLive, progress, get closed(){return closed;}};
}

const KEYS = {ArrowUp:38,ArrowDown:40,ArrowLeft:37,ArrowRight:39,Enter:13,Escape:27};
async function hold({send, session, keys, holdMs, sample, renderSample, saveSample = ()=>{}}) {
  assert(Array.isArray(keys) && (keys.length===1 || keys.length===2 && keys[0]==='ArrowUp' && ['ArrowLeft','ArrowRight'].includes(keys[1])), 'ordinary key or throttle plus steering');
  assert(keys.every(k=>Object.hasOwn(KEYS,k)) && new Set(keys).size===keys.length);
  assert(Number.isInteger(holdMs) && holdMs>=50 && holdMs<=2000, 'bounded physical hold');
  assert(typeof sample==='function', 'passive in-hold sampler required');
  const attempted=[], samples=[]; let error;
  assert(renderSample===undefined||typeof renderSample==='function');
  const record = async (reader,stream) => {
    const began=Date.now(), value=await reader(), finished=Date.now();
    const row={...value,phase:'held',stream,started:began,finished,
      whollyDuringHold:began>=started&&finished<(releaseAt??Infinity)};
    samples.push(row); await saveSample(row);
  };
  // The release timer is independent of sampler completion. A slow passive
  // read must never extend a physical hold, and is labelled outside the hold.
  let releasePromise, releaseAt;
  async function release() {
    if (releasePromise) return releasePromise;
    releaseAt=Date.now();
    return releasePromise=(async()=>{for(const base of [...attempted].reverse())try {
      await send('Input.dispatchKeyEvent',{type:'keyUp',...base},session);
    } catch(e){error??=e;}})();
  }
  let timer, started;
  try {
    started=Date.now(); timer=setTimeout(()=>{release().catch(e=>{error??=e;});},holdMs);
    for(const key of keys) {
      const base={key,code:key,windowsVirtualKeyCode:KEYS[key]}; attempted.push(base);
      await send('Input.dispatchKeyEvent',{type:'keyDown',...base},session);
      assert(!releasePromise,'input delivery exceeded hold bound');
    }
    // Each stream has at most one outstanding read. A blocked renderer cannot
    // delay page observations or the independent physical release timer.
    const loop=async(reader,stream)=>{
      try {while(!releasePromise) {
        await record(reader,stream);
        if(!releasePromise)await wait(Math.min(100,Math.max(1,holdMs-(Date.now()-started))));
      }}catch(e){error??=e;await release();}
    };
    await Promise.all([loop(sample,'page'),...(renderSample?[loop(renderSample,'renderer')]:[])]);
  } catch(e){error??=e;}
  finally {clearTimeout(timer);await release();}
  for(const s of samples)s.whollyDuringHold=s.started>=started&&s.finished<releaseAt;
  if(error) {error.holdReceipt={started,releaseAt,samples,attempted:attempted.map(k=>k.key)};throw error;}
  return {started,releaseAt,samples,attempted:attempted.map(k=>k.key),meaning:'physical host interval; passive counters do not prove DirectInput polls or simulation steps'};
}
module.exports = {createChain, hold, same, sha, FIELDS, MAX_AGE_MS, PAGE_READ, WORKER_READ, RENDER_READ};
