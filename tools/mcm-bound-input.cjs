'use strict';
// Native-CDP capture/admission chain. No guest memory, clocks or callbacks are written.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {currentSynchronousSource, ARM_SYNCHRONOUS_SOURCE} = require('./mcm-synchronous-source.cjs');
const menuContext = require('./mcm-menu-reviewed-context.cjs');
const gameplayContext = require('./mcm-gameplay-reviewed-context.cjs');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const wait = ms => new Promise(r => setTimeout(r, ms));
const FIELDS = ['processId', 'processObject', 'pageInstance', 'pageRenderer', 'endpoint', 'endpointObject', 'workerObject',
  'workerTarget', 'workerInstance', 'moduleObject', 'moduleSha256', 'epoch',
  'renderEndpoint', 'renderEndpointObject', 'renderWorkerObject',
  'rendererTarget', 'rendererEpoch', 'rendererModuleSha256', 'renderRole',
  'renderBridge', 'renderPresenter', 'renderWindow', 'renderLayer', 'rendererAdapter',
  'rendererExecutor', 'rendererExecutorRole', 'rendererContext'];
const MAX_AGE_MS = 12000;
// Startup only. A port is published before endpoint.ready settles and before
// the first PRESENT; neither event alone admits a scene or an input.
const READY_READ = `(() => {
  if(typeof runningApps==='undefined'||runningApps.length!==1)return false;
  const w=runningApps[0].wine,b=w?.hostCtx?.getD3dimBridge?.(),p=b?.endpoint,v=b?.presenter;
  return !!(w?.running&&!w._stopped&&w.guestWorker&&p&&!p.closed&&
    p.options?.api==='d3dim-gps'&&w._renderWorkerManager?.ports?.get(p.id)===p&&
    !b.workerAsyncError&&!b.workerClosing&&v?.layer&&v.win&&v.presents&&
    v.win._gpuFrameLayer===v.layer&&!v.layer.stale?.());
})()`;
function same(a, b) {
  for (const field of FIELDS) {
    assert(a?.[field] !== undefined && a[field] !== null && a[field] !== '', 'missing identity ' + field);
    assert.equal(b?.[field], a[field], 'identity changed: ' + field);
  }
}
// Execution slices, RPC counters and presentation samples are observations,
// not owner identity. Keep an explicit projection rather than deleting today's
// known volatile keys: future diagnostics must not silently become authority.
function menuOwner(identity) {
  same(identity, identity);
  const fields=[...FIELDS,'guestEndpoint','slot'];
  const owner=Object.fromEntries(fields.map(field=>{
    assert(identity[field]!==undefined&&identity[field]!==null,'missing MENU owner '+field);
    return [field,identity[field]];
  }));
  assert(identity.sourceArm?.threads&&identity.sourceArm.endpoint===null&&identity.sourceArm.predicates,
    'complete MENU source owner required');
  owner.sourceArm=structuredClone(identity.sourceArm);
  return owner;
}
// Object tokens are scoped to this actual document. Replacing an owner with an
// equal-looking object, or reloading the page, cannot reuse a reviewed token.
const PAGE_READ = `(() => {
  const allowPending=false;
  const gpsPreparation=false;
  const currentSynchronousSource = ${currentSynchronousSource.toString()};
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
    if(gpsPreparation&&w?._d3dimGpsObservation?.state==='CLOSED')throw Error('GPS preparation closed');
    const ports=[...(w?._renderWorkerManager?.ports?.values()||[])].filter(p=>!p.closed);
    const b=w?.hostCtx?.getD3dimBridge?.();
    const owned=ports.filter(p=>p===b?.endpoint&&p.options?.api==='d3dim-gps');
    if(b?.endpoint&&(owned.length!==1||b.workerAsyncError||b.workerClosing))throw Error('D3DIM GPS owner unavailable');
    if(!b?.endpoint&&ports.some(p=>p.options?.api==='d3dim-gps'))throw Error('unbound D3DIM GPS endpoint');
    const p=owned.length===1?owned[0]:null, presenter=b?.presenter, win=presenter?.win;
    let layer=presenter?.layer, synchronous=null;
    // GPS Presenter owns both slots; only a selected CPU layer needs the native-source proof.
    if(p&&win?._dxFrameLayer&&win._dxFrameLayer.kind!=='gpu'&&w?.renderer?._overlayFrameLayer(win)===win._dxFrameLayer) {
      synchronous=currentSynchronousSource(w,win);layer=synchronous.layer;
    }
    // Evaluate the exact refusal predicates once, in this read. Only the
    // pristine production Presenter before its first frame is known pending.
    const reasons=p?{
      missingLayer:!layer,missingWindow:!win,
      gpuAliasMismatch:!!(win&&!synchronous&&win._gpuFrameLayer!==layer),
      staleLayer:!!layer?.stale?.(),zeroPresents:!presenter?.presents,
      nullStamp:presenter?.stamp===null,zeroWriteSeq:!layer?.writeSeq,
      wasmOwnerMismatch:!!win&&win.wasm!==w.instance,
      processMismatch:!!win&&win.processId!==w.processId}:null;
    const pending=!!(p&&presenter&&presenter.layer===null&&presenter.win===null&&
      presenter.presents===0&&presenter.stamp===null&&w?.running&&!w._stopped&&g&&l&&
      w.instance&&w.renderer&&w._renderWorkerManager.worker);
    if(reasons&&Object.values(reasons).some(Boolean)&&!(allowPending&&pending))
      throw Error('current D3DIM GPS publication required '+JSON.stringify(reasons));
    return {name:a.name,running:!!w?.running,stopped:!!w?._stopped,guestWorker:!!g,
      processId:w?.processId,processObject:token(w),endpoint:l?.endpointIdentity,endpointObject:token(l),
      pageInstance:token(w?.instance),pageRenderer:token(w?.renderer),
      renderEndpoint:p?.id??'none',renderEndpointObject:p?token(p):'none',
      renderWorkerObject:token(w?._renderWorkerManager?.worker)??'none',
      renderRole:p?'d3dim-gps':'none',renderBridge:p?token(b):'none',
      renderPresenter:p?token(presenter):'none',
      renderWindow:p&&win?token(win):'none',renderLayer:p&&layer?token(layer):'none',
      readiness:pending?'pending-first-present':'ready',
      publication:synchronous?synchronous.publication:p&&!pending?{stamp:presenter.stamp,writeSeq:layer.writeSeq,presents:presenter.presents}:null,
      guestEndpoint:l?.endpointIdentity,slot:l?.slot,workerObject:token(l?.worker),
      sourceArm:{endpoint:token(gpsPreparation?p:l?._renderLegacyEndpoint),threads:token(w?.threadManager),
        predicates:{missingEndpoint:gpsPreparation?false:!l?._renderLegacyEndpoint,
          closedEndpoint:!!(gpsPreparation?p:l?._renderLegacyEndpoint)?.closed,missingThreads:!w?.threadManager,
          mainOwnerMismatch:!!w?.threadManager&&w.threadManager.mainInstance!==w.instance,
          missingNativeInstance:!w?.instance?.nativeInstance,
          alreadyArmed:!!(w?._d3dimGpsObservation||w?._d3dimPublicationJoin||w?._d3dimPublicationArming)}},
      moduleObject:token(l?.module),epoch:state.epoch,
      slice:w?._workerLastSlice??null,d3dStats:g?.d3dStats??null,
      physical:[37,38,39,40].map(key=>({key,state:w?.renderer?.peekKeyDownState(key)??null}))};
  })};
})()`;
const PENDING_READ = PAGE_READ.replace('const allowPending=false;', 'const allowPending=true;');
const GPS_PAGE_READ = PAGE_READ.replace('const gpsPreparation=false;', 'const gpsPreparation=true;');
const ARM_GPS_SOURCE = `(async () => {
  if(typeof runningApps==='undefined'||runningApps.length!==1)throw Error('one MCM owner required');
  const app=runningApps[0],w=app.wine,g=w?.guestWorker,link=g?.link,r=w?.renderer,
    instance=w?.instance,memory=w?.memory,processId=w?.processId;
  if(app.name!=='mcm'||!w.running||w._stopped||!link||!r||!instance||!memory)
    throw Error('live MCM command owner required');
  const prepared=await w.prepareD3dimGpsPublicationObservation({maxRecords:256,creationTimeoutMs:20000});
  if(runningApps.length!==1||runningApps[0]!==app||w.guestWorker!==g||g.link!==link||
      w.renderer!==r||w.instance!==instance||w.memory!==memory||w.processId!==processId||
      !w.running||w._stopped||w._d3dimGpsObservation!==prepared||
      !['PREPARED','ARMED','PUBLISHED'].includes(prepared.state))throw Error('GPS preparation owner changed');
  return {endpoint:link.endpointIdentity,slot:link.slot,processId,state:prepared.state,
    renderEndpoint:prepared.endpoint?.id??null,qualified:false};
})()`;
const OWNER_FIELDS = FIELDS.filter(f=>!['renderWindow','renderLayer'].includes(f));
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
    const token=o=>{if(!o)return 'none';if(!s.ids.has(o))s.ids.set(o,s.epoch+':'+(++s.next));return s.ids.get(o);};
    const live=e.options?.api==='d3dim-gps'?e.adapter?.identity?.():null;
    return {id,epoch:s.ids.get(e)+'/'+s.ids.get(instance),failed:!!e.failed,
      role:e.options?.api??null,adapter:token(e.adapter),
      executor:token(live?.executor),executorRole:live?.executorRole??null,
      context:token(live?.context),contextLost:live?.contextLost??null,
      closed:live?.closed??null,error:live?.error??null,ring:live?.ring??null,
      glRenderer:live?.glRenderer??null,stats:live?.stats??null,
      control:e.control?{completed:Atomics.load(e.control,1),error:Atomics.load(e.control,2),commands:Atomics.load(e.control,5)}:null};
  });
})()`;

function rendererFields(endpoint) {
  assert(endpoint.role==='d3dim-gps' && !endpoint.failed && !endpoint.control?.error &&
    endpoint.closed===false && endpoint.error===0 && endpoint.ring>0,
    'live D3DIM GPS renderer required');
  assert(endpoint.executor!=='none' && ['webgl','software'].includes(endpoint.executorRole),
    'actual renderer executor required');
  assert(endpoint.executorRole==='webgl' ? endpoint.context!=='none' && endpoint.contextLost===false &&
    typeof endpoint.glRenderer==='string' && endpoint.glRenderer.length>0 : endpoint.context==='none',
    'actual live renderer context required');
  return {rendererAdapter:endpoint.adapter,rendererExecutor:endpoint.executor,
    rendererExecutorRole:endpoint.executorRole,rendererContext:endpoint.context};
}

const MENU_CONTEXT_READ = `(() => {
  const state=globalThis.__mcmPassiveIdentityV1;
  if(!state||runningApps.length!==1)throw Error('MENU document owner unavailable');
  const token=o=>{if(!o)return null;if(!state.ids.has(o))state.ids.set(o,state.epoch+':'+(++state.next));return state.ids.get(o);};
  const a=runningApps[0],w=a.wine,r=w.renderer,screen=document.getElementById('screen');
  const wins=Object.values(r.windows).filter(v=>v.visible&&!v.isChild).sort((a,b)=>b.zOrder-a.zOrder);
  const win=wins[0],modal=r.getActiveModalWindow?.();
  if(a.name!=='mcm'||!w.running||w._stopped||!screen||!win||modal||
    win.wasm!==w.instance||win.processId!==w.processId||
    w._d3dimGpsObservation?.state!=='PREPARED'||w._d3dimGpsObservation.endpoint)
    throw Error('prepared genuine MCM MENU owner required');
  if(!w.memory||!w.instance?.nativeInstance||!w.threadManager||w.threadManager.mainInstance!==w.instance)
    throw Error('live MENU native instance/thread owner required');
  return {hwnd:win.hwnd,generation:token(win),memory:token(w.memory),preparation:token(w._d3dimGpsObservation),
    nativeInstance:token(w.instance.nativeInstance),threads:token(w.threadManager),
    observer:token(globalThis.__mcmNativeObserve)??'none',
    canvas:token(screen),focus:token(document.activeElement),modal:null,
    viewport:{width:innerWidth,height:innerHeight,deviceScaleFactor:devicePixelRatio,
      screen:screen.getBoundingClientRect().toJSON()},
    window:{x:win.x,y:win.y,w:win.w,h:win.h,style:win.style,zOrder:win.zOrder}};
})()`;
function createChain({evaluate, send, workers, pageSession, app = 'mcm', now = Date.now,
  readinessTimeoutMs = 10000, gpsSourcePreparation = false, reviewedMenuContext, reviewedGameplayContext}) {
  assert(reviewedMenuContext===undefined||reviewedMenuContext?.capability===menuContext.CAPABILITY&&
    typeof reviewedMenuContext.evidenceSink==='function'&&gpsSourcePreparation&&app==='mcm',
  'explicit MCM MENU capability and full image sink require GPS preparation');
  assert(reviewedGameplayContext===undefined||reviewedGameplayContext?.capability===gameplayContext.CAPABILITY&&
    typeof reviewedGameplayContext.evidenceSink==='function'&&gpsSourcePreparation&&app==='mcm',
  'explicit MCM GAMEPLAY capability and complete image sink require GPS preparation');
  const currentPageRead=gpsSourcePreparation?GPS_PAGE_READ:PAGE_READ;
  assert(Number.isInteger(readinessTimeoutMs)&&readinessTimeoutMs>0&&readinessTimeoutMs<=10000,
    'bounded first-present readiness timeout');
  let latest = null, busy = false, closed = false, synchronousArmed = false;
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
  async function collectLive(allowPending = false) {
    const pageExpression=allowPending?currentPageRead.replace('const allowPending=false;','const allowPending=true;'):currentPageRead;
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
    const page = await read(pageExpression, undefined, 'page.before');
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
    let actualRenderer={rendererAdapter:'none',rendererExecutor:'none',rendererExecutorRole:'none',rendererContext:'none'};
    if(a.renderEndpoint!=='none') {
      assert.equal(owners.length,1,'unique actual owning renderer required');
      owner=owners[0];const {r,endpoint}=owner;
      assert.equal(endpoint.role,a.renderRole,'renderer role mismatch');
      actualRenderer=rendererFields(endpoint);
      rendererTarget=r.targetId;rendererEpoch=endpoint.epoch;
      renderScripts=modules(r);
      assert.equal(new Set(renderScripts.map(s=>s.sha256)).size,1,'unique actual renderer module required');
    }
    const hashes=await Promise.allSettled([moduleHash(w,scripts,'guest.module'),...(owner?[moduleHash(owner.r,renderScripts,'renderer.module')]:[])]);
    for(const h of hashes)if(h.status==='rejected')throw h.reason;
    const moduleSha256=hashes[0].value;
    if(owner)rendererModuleSha256=hashes[1].value;
    const rendererIdentity={rendererTarget,rendererEpoch,rendererModuleSha256,...actualRenderer};
    const identity = {...a, workerTarget:w.targetId, workerInstance:live.instance, moduleSha256,...rendererIdentity};
    same(identity, identity);
    // Recheck page references after asynchronous Worker reads. Never cache a
    // live object identity, target membership or running/failed status.
    const finalReads=await Promise.allSettled([
      read(pageExpression, undefined, 'page.after'),
      read(WORKER_READ,w.sessionId,'guest.after'),
      ...(owner?[read(RENDER_READ,owner.r.sessionId,'renderer.after')]:[])
    ]);
    for(const r of finalReads)if(r.status==='rejected')throw r.reason;
    const after=finalReads[0].value;
    assert.deepEqual(finalReads[1].value,live,'guest instance changed during identity read');
    if(owner) {
      const endpoints=finalReads[2].value.filter(e=>e.id===a.renderEndpoint);
      assert.equal(endpoints.length,1,'unique owning renderer recheck required');
      assert.equal(endpoints[0].epoch,rendererEpoch,'renderer instance changed during identity read');
      assert.deepEqual(rendererFields(endpoints[0]),actualRenderer,'renderer executor/context changed during identity read');
    }
    assert(after.isolated && after.apps.length === 1 && after.apps[0].name===app && after.apps[0].running && !after.apps[0].stopped);
    const finalIdentity={...after.apps[0], workerTarget:w.targetId, workerInstance:live.instance, moduleSha256,...rendererIdentity};
    if(a.readiness==='pending-first-present'&&after.apps[0].readiness==='ready') {
      for(const f of OWNER_FIELDS)assert.equal(finalIdentity[f],identity[f],'first-present owner changed: '+f);
      Object.assign(identity,finalIdentity);
    } else same(identity,finalIdentity);
    assert.equal(workers.get(w.sessionId),w,'Worker session replaced during identity read');
    assert.deepEqual(modules(w),scripts,'guest module inventory changed');
    if(owner) {
      assert.equal(workers.get(owner.r.sessionId),owner.r,'renderer session replaced during identity read');
      assert.deepEqual(modules(owner.r),renderScripts,'renderer module inventory changed');
    }
    return {identity, page:after, worker:{targetId:w.targetId, sessionId:w.sessionId, ...live},
      renderer:owner?finalReads[2].value.find(e=>e.id===a.renderEndpoint):null,
      timing:{totalMs:performance.now()-started,reads:timings}};
  }
  async function readLive() {
    assert(!closed, 'closed chain');
    try { return await collectLive(); }
    catch(error) { closed = true; throw error; }
  }
  async function readyBeforeCapture() {
    const deadline=performance.now()+readinessTimeoutMs;
    let owner;
    for(;;) {
      const live=await collectLive(true);
      if(owner)for(const f of OWNER_FIELDS)assert.equal(live.identity[f],owner[f],
        'first-present owner changed: '+f);
      if(owner)assert(performance.now()<deadline,'bounded first-present readiness expired');
      if(live.page.apps[0].readiness==='ready')return live;
      owner??=live.identity;
      assert(performance.now()<deadline,'bounded first-present readiness expired');
      await wait(Math.min(50,Math.max(1,deadline-performance.now())));
    }
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
      const before = await readyBeforeCapture();
      // Validation after a screenshot can be slow on a busy renderer. It must
      // not make the reviewed pixels appear younger than their capture.
      const at = new Date(now()).toISOString();
      const shot = await send('Page.captureScreenshot', {format:'png'}, pageSession);
      const after = await readLive(); same(before.identity, after.identity);
      const png = Buffer.from(shot.data, 'base64');
      latest = {label, at, completedAt:new Date(now()).toISOString(), sha256:sha(png), identity:after.identity};
      return {capture:structuredClone(latest), png, before, after};
    } catch(error) { closed = true; throw error; }
    finally { busy = false; }
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
    const page = await evaluate(currentPageRead), a = page.apps[0];
    assert(page.apps.length === 1 && a?.running && !a.stopped);
    for (const f of ['processId','processObject','pageInstance','pageRenderer','endpoint','endpointObject','workerObject','moduleObject','epoch','renderEndpoint','renderEndpointObject','renderWorkerObject','renderRole','renderBridge','renderPresenter','renderWindow','renderLayer'])
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
      const owned=endpoints.filter(e=>e.id===identity.renderEndpoint);
      assert(owned.length===1&&owned[0].epoch===identity.rendererEpoch,'held renderer epoch changed');
      const fields=rendererFields(owned[0]);
      for(const f of Object.keys(fields))assert.equal(fields[f],identity[f],'held renderer changed: '+f);
      assert.equal(worker(identity.rendererTarget,identity.rendererModuleSha256),r,'held renderer replaced');
      // A renderer reply is usable only while its page owner still matches.
      // This read is independent of the page sampling loop.
      const after=await evaluate(currentPageRead);
      assert(after.apps.length===1&&after.apps[0]?.running&&!after.apps[0].stopped);
      for(const f of ['processId','processObject','pageInstance','pageRenderer','endpoint','endpointObject','workerObject','moduleObject','epoch','renderEndpoint','renderEndpointObject','renderWorkerObject','renderRole','renderBridge','renderPresenter','renderWindow','renderLayer'])
        assert.equal(after.apps[0][f],identity[f],'held identity changed: '+f);
      render.push({targetId:r.targetId,endpoints});
    }
    return {stream,at:new Date(now()).toISOString(),render};
  }
  async function armSynchronousSource(menuReview) {
    assert(!closed && !busy && !synchronousArmed && app==='mcm', 'idle unarmed MCM chain required');
    busy=true;
    try {
      if(menuReview) {
        assert(menuReview.stage==='menu-before-start' && latest &&
          menuReview.label===latest.label && menuReview.sha256===latest.sha256 &&
          menuReview.review?.trim(), 'reviewed menu before Start required');
        same(latest.identity,menuReview.identity);fresh(latest);
      }
      const before=await readLive();
      if(menuReview) {
        same(latest.identity,before.identity);fresh(latest);
        const source=before.page.apps[0].sourceArm;
        assert(source && Object.values(source.predicates).every(v=>v===false),
          'menu source arm prerequisites '+JSON.stringify(source??null));
        for(const key of ['endpoint','threads']) {
          assert.equal(before.identity.sourceArm[key],source[key],
            'menu source owner changed during read: '+key);
          assert.equal(latest.identity.sourceArm[key],source[key],
            'reviewed menu source owner changed: '+key);
        }
      }
      const receipt=await evaluate(gpsSourcePreparation?ARM_GPS_SOURCE:ARM_SYNCHRONOUS_SOURCE);
      const after=await readLive();same(before.identity,after.identity);
      if(menuReview)for(const key of ['endpoint','threads'])
        assert.equal(after.page.apps[0].sourceArm[key],before.page.apps[0].sourceArm[key],
          'menu source owner changed: '+key);
      assert.equal(receipt.endpoint,after.identity.endpoint,'armed actual command endpoint');
      assert.equal(receipt.processId,after.identity.processId,'armed actual process');
      synchronousArmed=true;latest=null;
      return receipt;
    } catch(error) {closed=true;throw error;}
    finally {busy=false;}
  }
  // Ordinary startup dialogs use capture/admit. Only a reviewed menu with a
  // real legacy owner may arm; Start follows a fresh post-arm capture.
  const armMenuSource=review=>armSynchronousSource({...review,stage:review?.stage});
  let menu;
  if(reviewedMenuContext)menu=menuContext.createMenuContext({now,evidenceSink:reviewedMenuContext.evidenceSink,
    checkpoint:()=>{assert(!closed&&synchronousArmed,'live post-preparation MENU chain required');
      reviewedMenuContext.checkpoint?.();},
    capture:async()=>Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},pageSession)).data,'base64'),
    identity:async()=>{
      const live=await readLive(),context=await evaluate(MENU_CONTEXT_READ);
      return {session:pageSession,owner:menuOwner(live.identity),process:live.identity.processObject,
        endpoint:live.identity.endpointObject,epoch:live.identity.epoch,module:live.identity.moduleSha256,...context};
    }});
  async function captureMenuContext(){
    assert(menu&&!closed&&!busy,'explicit idle MENU capability required');busy=true;
    try{return await menu.captureReview();}catch(e){closed=true;throw e;}finally{busy=false;}
  }
  function reviewMenuContext(intent){
    assert(menu&&!closed&&!busy,'explicit idle MENU capability required');
    try{return menu.review(intent);}catch(e){closed=true;throw e;}
  }
  async function startMenuContext(handle,intent){
    assert(menu&&!closed&&!busy,'explicit idle MENU capability required');busy=true;
    try{return await menu.start(handle,intent,(edge,proof)=>{
      const base={x:edge.x,y:edge.y,button:'left',clickCount:1};
      // Preserve the ordinary 100ms independent physical release. No capture,
      // source preparation, module transfer or other work follows this fence.
      let release;
      const up=()=>release??=send('Input.dispatchMouseEvent',{type:'mouseReleased',...base},pageSession);
      const timer=setTimeout(()=>{up().catch(()=>{});},edge.holdMs);
      const started=now();
      const down=send('Input.dispatchMouseEvent',{type:'mousePressed',...base},pageSession);
      return (async()=>{try{
        await down;await wait(Math.max(0,edge.holdMs-(now()-started)));
        return {proof,downStartedAt:started,physicalHoldMs:edge.holdMs};
      }finally{clearTimeout(timer);await up();}})();
    });}catch(e){closed=true;throw e;}finally{busy=false;}
  }
  // A separate one-use authority for each personally reviewed gameplay edge.
  // No direct or MENU capture, intent, timestamp or equality is reused here.
  let gameplay;
  async function captureGameplayContext(){
    assert(reviewedGameplayContext&&!closed&&!busy&&(!gameplay||gameplay.closed),
      'explicit idle GAMEPLAY capability required');busy=true;
    try{
      gameplay=gameplayContext.createGameplayContext({now,...reviewedGameplayContext,
        checkpoint:()=>{assert(!closed&&synchronousArmed,'live prepared GAMEPLAY chain required');reviewedGameplayContext.checkpoint?.();},
        capture:async()=>Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},pageSession)).data,'base64'),
        down:edge=>send('Input.dispatchKeyEvent',{type:'keyDown',key:edge.key,code:edge.code,windowsVirtualKeyCode:edge.vk},pageSession),
        identity:async()=>{
          const live=await readLive(),id=live.identity;
          assert(id.renderRole==='d3dim-gps'&&id.renderEndpoint!=='none','actual published GPS GAMEPLAY required');
          const context=await evaluate(GAMEPLAY_CONTEXT_READ);
          same(id,(await readLive()).identity);
          return {session:pageSession,owner:Object.fromEntries(FIELDS.map(k=>[k,id[k]])),
            process:id.processObject,endpoint:id.endpointObject,epoch:id.epoch,module:id.moduleSha256,...context};
        }});
      return await gameplay.captureReview();
    }catch(e){closed=true;throw e;}finally{busy=false;}
  }
  function reviewGameplayContext(intent){
    assert(gameplay&&!closed&&!busy,'idle explicit GAMEPLAY source required');
    try{return gameplay.review(intent);}catch(e){closed=true;throw e;}
  }
  async function dispatchGameplayContext(handle,intent){
    assert(gameplay&&!closed&&!busy,'idle explicit GAMEPLAY source required');busy=true;
    try{return await gameplay.dispatch(handle,intent);}catch(e){closed=true;throw e;}
    finally{gameplay.close();busy=false;}
  }
  return {capture, admit, readLive, progress, armSynchronousSource, armMenuSource,
    captureMenuContext,reviewMenuContext,startMenuContext,
    captureGameplayContext,reviewGameplayContext,dispatchGameplayContext,
    close(){closed=true;menu?.close();gameplay?.close();},get closed(){return closed;}};
}

const GAMEPLAY_CONTEXT_READ = `(() => {
  const state=globalThis.__mcmPassiveIdentityV1;
  if(!state||runningApps.length!==1)throw Error('GAMEPLAY document owner unavailable');
  const token=o=>{if(!o)return null;if(!state.ids.has(o))state.ids.set(o,state.epoch+':'+(++state.next));return state.ids.get(o);};
  const a=runningApps[0],w=a.wine,r=w.renderer,b=w.hostCtx?.getD3dimBridge?.(),win=b?.presenter?.win;
  const screen=document.getElementById('screen'),modal=r.getActiveModalWindow?.();
  if(a.name!=='mcm'||!w.running||w._stopped||!screen||!win||modal||
    !b.endpoint||b.endpoint.closed||b.workerAsyncError||b.workerClosing||
    win.wasm!==w.instance||win.processId!==w.processId||!win.visible||
    !w.memory||!w.instance.nativeInstance||!w.threadManager||w.threadManager.mainInstance!==w.instance||
    w._d3dimGpsObservation?.endpoint!==b.endpoint||w._d3dimGpsObservation?.state!=='PUBLISHED')
    throw Error('genuine live GPS GAMEPLAY owner required');
  return {mode:'GAMEPLAY',gps:true,hwnd:win.hwnd,generation:token(win),memory:token(w.memory),
    preparation:token(w._d3dimGpsObservation),nativeInstance:token(w.instance.nativeInstance),threads:token(w.threadManager),
    observer:token(globalThis.__mcmNativeObserve)??'none',canvas:token(screen),focus:token(document.activeElement),modal:null,
    viewport:{width:innerWidth,height:innerHeight,deviceScaleFactor:devicePixelRatio,screen:screen.getBoundingClientRect().toJSON()},
    window:{x:win.x,y:win.y,w:win.w,h:win.h,style:win.style,zOrder:win.zOrder}};
})()`;

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
module.exports = {createChain, hold, same, menuOwner, sha, FIELDS, MAX_AGE_MS, READY_READ, PAGE_READ, GPS_PAGE_READ, WORKER_READ, RENDER_READ, ARM_SYNCHRONOUS_SOURCE, ARM_GPS_SOURCE, MENU_CONTEXT_READ};
