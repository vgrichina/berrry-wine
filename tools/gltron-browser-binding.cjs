'use strict';
// Native-CDP capture/admission chain. No guest memory, clocks or callbacks are written.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const wait = ms => new Promise(r => setTimeout(r, ms));
const FIELDS = ['processId', 'processObject', 'endpoint', 'endpointObject', 'workerObject',
  'workerTarget', 'workerInstance', 'moduleObject', 'moduleSha256', 'epoch',
  'renderEndpoint', 'renderEndpointObject', 'renderWorkerObject',
  'rendererTarget', 'rendererEpoch', 'rendererModuleSha256', 'pageRendererObject', 'canvasObject',
  'windowHwnd','windowObject','windowInstance','outputCanvasObject'];
const MAX_AGE_MS = 30000;
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
  const visible=c=>{
    if(!c||!c.isConnected||document.visibilityState!=='visible')return false;
    const b=c.getBoundingClientRect();
    if(!(b.width>0&&b.height>0&&b.left>=0&&b.top>=0&&b.right<=innerWidth&&b.bottom<=innerHeight))return false;
    for(let e=c;e;e=e.parentElement){
      const s=getComputedStyle(e),r=e.getBoundingClientRect();
      if(s.display==='none'||s.visibility!=='visible'||Number(s.opacity)!==1)return false;
      if(e!==c&&((/(hidden|clip|scroll|auto)/.test(s.overflowX)&&(b.left<r.left||b.right>r.right))||(/(hidden|clip|scroll|auto)/.test(s.overflowY)&&(b.top<r.top||b.bottom>r.bottom))))return false;
    }
    return true;
  };
  return {isolated:crossOriginIsolated, apps:(typeof runningApps==='undefined'?[]:runningApps).map(a=>{
    const w=a.wine, g=w?.guestWorker, l=g?.link;
    const ports=[...(w?._renderWorkerManager?.ports?.values()||[])].filter(p=>!p.closed);
    const owned=ports.filter(p=>p.options?.api==='gl');
    if(owned.length>1)throw Error('ambiguous actual GL endpoints');
    const p=owned.length===1?owned[0]:null;
    const windows=Object.values(w?.renderer?.windows||{}).filter(v=>v.visible&&!v.isChild&&v.w>0&&v.h>0&&v.processId===w.processId&&v.wasm===w.instance);
    const win=windows.length===1?windows[0]:null;
    const output=w?.renderer&&(!w.renderer.presentationFilter||w.renderer._directPresentation?w.renderer.canvas:w.renderer.presentationCanvas||w.renderer.canvas);
    return {name:a.name,running:!!w?.running,stopped:!!w?._stopped,guestWorker:!!g,
      windowHwnd:win?.hwnd,windowObject:token(win),windowInstance:token(win?.wasm),
      outputVisible:visible(output),
      outputCanvasObject:token(w?.renderer&&(!w.renderer.presentationFilter||w.renderer._directPresentation?w.renderer.canvas:w.renderer.presentationCanvas||w.renderer.canvas)),publication:w?.renderer?._immutablePublicationSequence||0,
      pageRendererObject:token(w?.renderer),canvasObject:token(document.getElementById('screen')),processId:w?.processId,processObject:token(w),endpoint:l?.endpointIdentity,endpointObject:token(l),
      renderEndpoint:p?.id??'none',renderEndpointObject:p?token(p):'none',
      renderWorkerObject:token(w?._renderWorkerManager?.worker)??'none',
      guestEndpoint:l?.endpointIdentity,slot:l?.slot,workerObject:token(l?.worker),
      moduleObject:token(l?.module),epoch:state.epoch,
      slice:w?._workerLastSlice??null,d3dStats:g?.d3dStats??null,
      physical:[1,17,32,37,38,39,40].map(key=>({key,state:w?.renderer?.peekKeyDownState(key)??null}))};
  })};
})()`;

// Public current-display ticket: existing complete output, or ordinary pending
// damage publication. Request time measures observation age, never render age.
// Original publication/display timestamps remain separately attached to bytes.
async function captureScene({evaluate, identity, now=Date.now}) {
  const nonce=crypto.randomUUID(),key='__gltronCaptureTicketV1',at=now(),stages={};
  let result,armed=false;
  try {
    const arm=await evaluate(`(() => {
      const p=(${PAGE_READ}),a=p.apps[0],want=${JSON.stringify(identity)};
      if(!p.isolated||p.apps.length!==1||!a.running||a.stopped||!a.outputVisible)throw Error('capture owner/output not live and fully visible');
      for(const k of ['processId','processObject','pageRendererObject','canvasObject','windowHwnd','windowObject','windowInstance','outputCanvasObject'])if(a[k]!==want[k])throw Error('capture identity changed '+k);
      if(globalThis.${key})throw Error('capture already armed');
      const w=runningApps[0].wine,r=w.renderer,t=w.requestCurrentDisplayCapture({hwnd:a.windowHwnd});
      const h={nonce:${JSON.stringify(nonce)},ticket:t,publication:a.publication,renderer:r};
      globalThis.${key}=h;
      return {at:Date.now(),publication:a.publication};
    })()`);
    armed=true;stages.armMs=now()-at;stages.arm=arm;
    while(now()-at<3000) {
      result=await evaluate(`(() => {
        const h=globalThis.${key};if(!h||h.nonce!==${JSON.stringify(nonce)})throw Error('capture ticket replaced');
        const t=h.ticket;if(t.status==='failed')throw Error(t.error);
        if(t.status==='cancelled')throw Error('capture cancelled; no replay');
        if(t.status!=='complete')return null;
        const readStart=performance.now(),r=t.read(),m=r.metadata;
        const p=(${PAGE_READ}),a=p.apps[0],want=${JSON.stringify(identity)};
        if(p.apps.length!==1||!a.running||a.stopped||!a.outputVisible)throw Error('capture owner/output hidden or clipped');
        for(const k of ['processId','processObject','pageRendererObject','canvasObject','windowHwnd','windowObject','windowInstance','outputCanvasObject'])if(a[k]!==want[k])throw Error('capture identity changed '+k);
        if(m.observation!=='current-display'||m.publication<h.publication)throw Error('capture display/publication binding changed');
        if(!Number.isFinite(m.displayedAt)||m.displayedAt>m.readbackCompletedAt||m.requestedAt>m.readbackStartedAt)throw Error('capture display timing invalid');
        const c=document.createElement('canvas');c.width=m.output.width;c.height=m.output.height;
        const start=performance.now();c.getContext('2d').putImageData(new ImageData(r.outputRGBA,c.width,c.height),0,0);
        const data=c.toDataURL('image/png');
        return {metadata:m,data,publishedAt:m.publicationAt,encodedAt:Date.now(),readAndCopyMs:start-readStart,encodeMs:performance.now()-start};
      })()`);
      if(result)break;
      await wait(10);
    }
    assert(result,'current complete-scene capture deadline; no retry');
    assert(now()-at<3000,'late complete-scene capture refused');
    const m=result.metadata;
    assert.equal(m.completion,'canvas2d-readback');
    assert.equal(m.observation,'current-display');
    assert(['already-displayed','ordinary-publication-after-request'].includes(m.content));
    assert.equal(m.captureOwner.hwnd,identity.windowHwnd);
    assert.equal(m.captureOwner.processId,identity.processId);
    assert(m.composition.windows.some(w=>w.hwnd===identity.windowHwnd&&w.processId===identity.processId));
    assert(/^data:image\/png;base64,/.test(result.data));
    stages.readAndEncodeMs=now()-at;stages.encodeMs=result.encodeMs;stages.readAndCopyMs=result.readAndCopyMs;stages.publishedAt=result.publishedAt;
    return {png:Buffer.from(result.data.split(',')[1],'base64'),metadata:m,at:new Date(at).toISOString(),stages,nonce};
  } finally {
    // A terminal transport refuses this cleanup too. In that case the whole
    // document is destroyed by host teardown, never reused or rebound.
    if(armed)await evaluate(`(() => {const h=globalThis.${key};if(!h||h.nonce!==${JSON.stringify(nonce)})throw Error('capture cancellation identity changed');const status=h.ticket.status;h.ticket.cancel();delete globalThis.${key};return {status};})()`);
    if(result)assert(now()-at<3000,'late complete-scene capture cleanup refused');
  }
}
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

function createChain({evaluate, send, workers, pageSession, app = 'heretic2_demo', expectedModules = null, now = Date.now}) {
  let latest = null, pinnedIdentity = null, busy = false, closed = false;
  const consumed = new Set();
  async function readLive() {
    assert(!closed,'closed chain');
    const page = await evaluate(PAGE_READ);
    assert(page.isolated && page.apps.length === 1, 'one isolated registered app required');
    const a = page.apps[0];
    assert(a.name === app && a.running && !a.stopped && a.guestWorker && a.outputVisible, 'live fully visible registered app required');
    const matches = [];
    for (const w of workers.values()) {
      if (w.closed || !w.url.includes('guest-worker')) continue;
      const live = await evaluate(WORKER_READ, w.sessionId);
      if (live?.endpointIdentity === a.guestEndpoint && live.slot === a.slot) matches.push({w, live});
    }
    assert.equal(matches.length, 1, 'unique actual guest Worker target required');
    const {w, live} = matches[0];
    const scripts = [...new Map(w.scripts.filter(s => s.bytecodeAvailable && s.sha256 && !s.error).map(s=>[s.scriptId,s])).values()];
    assert.equal(scripts.length, 1, 'unique recovered live Worker module required');
    const source = await send('Debugger.getScriptSource', {scriptId:scripts[0].scriptId}, w.sessionId);
    assert(source.bytecode, 'live module bytecode required');
    const moduleSha256 = sha(Buffer.from(source.bytecode, 'base64'));
    assert.equal(moduleSha256, scripts[0].sha256, 'live module bytes changed');if(expectedModules)assert(expectedModules.includes(moduleSha256),'immutable staged module required');
    let rendererTarget='none',rendererEpoch='none',rendererModuleSha256='none';
    if(a.renderEndpoint!=='none') {
      const owners=[];
      for(const r of workers.values())if(!r.closed&&r.url.includes('d3d-render-worker')) {
        const endpoints=await evaluate(RENDER_READ,r.sessionId);
        for(const endpoint of endpoints)if(endpoint.id===a.renderEndpoint)owners.push({r,endpoint});
      }
      assert.equal(owners.length,1,'unique actual owning renderer required');
      const {r,endpoint}=owners[0];assert(!endpoint.failed&&!endpoint.control?.error,'live renderer required');
      rendererTarget=r.targetId;rendererEpoch=endpoint.epoch;
      const modules=[...new Map(r.scripts.filter(s=>s.sha256&&s.bytecodeAvailable&&!s.error).map(s=>[s.scriptId,s])).values()];
      assert.equal(new Set(modules.map(s=>s.sha256)).size,1,'unique actual renderer module required');
      const bytes=await send('Debugger.getScriptSource',{scriptId:modules[0].scriptId},r.sessionId);
      assert(bytes.bytecode,'actual renderer module bytes required');
      rendererModuleSha256=sha(Buffer.from(bytes.bytecode,'base64'));
      assert.equal(rendererModuleSha256,modules[0].sha256);
    }
    const rendererIdentity={rendererTarget,rendererEpoch,rendererModuleSha256};
    const identity = {...a, workerTarget:w.targetId, workerInstance:live.instance, moduleSha256,...rendererIdentity};
    same(identity, identity);
    if (pinnedIdentity) same(pinnedIdentity, identity);
    else pinnedIdentity = {...identity};
    // Recheck page references after asynchronous Worker reads.
    const after = await evaluate(PAGE_READ);
    assert(after.apps.length === 1 && after.apps[0].running && !after.apps[0].stopped &&
      after.apps[0].outputVisible, 'owner/output hidden or clipped during identity validation');
    same(identity, {...after.apps[0], workerTarget:w.targetId, workerInstance:live.instance, moduleSha256,...rendererIdentity});
    assert(!w.closed, 'Worker detached during identity read');
    return {identity, page:after, worker:{targetId:w.targetId, sessionId:w.sessionId, ...live}};
  }
  function fresh(capture, maxAgeMs=MAX_AGE_MS) {
    const age = now() - Date.parse(capture?.at);
    if (!(Number.isFinite(age) && age >= 0 && age < maxAgeMs)) {
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
      const shot = await captureScene({evaluate,identity:before.identity,now});
      const after = await readLive(); same(before.identity, after.identity);
      assert(shot.metadata.publication<=after.identity.publication,'publication regressed');
      const png = shot.png;
      latest = {label, at:shot.at, completedAt:new Date(now()).toISOString(), sha256:sha(png), identity:after.identity,metadata:shot.metadata,stages:shot.stages,nonce:shot.nonce};
      return {capture:structuredClone(latest), png, before, after};
    } catch(e) {closed=true;throw e;} finally { busy = false; }
  }
  async function admit(review, dispatch) {
    assert(!closed && !busy, 'closed or concurrent chain'); busy = true;
    let effects = false;
    try {
      assert(latest && review?.label === latest.label && review.sha256 === latest.sha256 && review.review?.trim(), 'current reviewed capture required');
      assert(!consumed.has(latest.nonce), 'capture nonce already consumed; no replay');
      const maxAgeMs=review.maxAgeMs??MAX_AGE_MS;
      assert([5000,30000].includes(maxAgeMs),'unchanged precision/menu freshness required');
      same(latest.identity, review.identity); fresh(latest,maxAgeMs);
      const live = await readLive(); same(latest.identity, live.identity); const ageMs = fresh(latest,maxAgeMs);
      consumed.add(latest.nonce);
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
  async function progress(identity) {
    const page = await evaluate(PAGE_READ), a = page.apps[0];
    assert(page.apps.length === 1 && a?.running && !a.stopped);
    for (const f of ['processId','processObject','endpoint','endpointObject','workerObject','moduleObject','epoch','renderEndpoint','renderEndpointObject','renderWorkerObject'])
      assert.equal(a[f], identity[f], 'held identity changed: '+f);
    const w = [...workers.values()].find(w=>w.targetId===identity.workerTarget&&!w.closed);
    assert(w, 'held Worker retired');
    // Do not enqueue guest export commands: the existing page slice and
    // shared render controls are passive and remain observable while blocked.
    const render = [];
    for (const r of workers.values()) if (!r.closed && r.url.includes('d3d-render-worker')) {
      const endpoints=await evaluate(RENDER_READ,r.sessionId);
      if(r.targetId===identity.rendererTarget)assert(endpoints.some(e=>e.id===identity.renderEndpoint&&e.epoch===identity.rendererEpoch&&!e.failed&&!e.control?.error),'held renderer epoch changed');
      render.push({targetId:r.targetId,endpoints});
    }
    return {at:new Date(now()).toISOString(), slice:a.slice, d3dStats:a.d3dStats, physical:a.physical, render};
  }
  return {capture, admit, readLive, progress, get closed(){return closed;}};
}

module.exports={createChain,captureScene,same,sha,FIELDS,MAX_AGE_MS,PAGE_READ,WORKER_READ,RENDER_READ};
