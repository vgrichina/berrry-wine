'use strict';
// Native-CDP capture/admission chain. No guest memory, clocks or callbacks are written.
const trace=require('./trace.cjs');
const producer=require('./producer-ready.cjs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const wait = ms => new Promise(r => setTimeout(r, ms));
const FIELDS = ['processId', 'processObject', 'endpoint', 'endpointObject', 'workerObject',
  'workerTarget', 'workerInstance', 'moduleObject', 'moduleSha256', 'epoch',
  'renderEndpoint', 'renderEndpointObject', 'renderWorkerObject',
  'rendererContext', 'rendererTarget', 'rendererEpoch', 'rendererModuleSha256', 'pageRendererObject', 'canvasObject'];
const MAX_AGE_MS = 120000;
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
      pageRendererObject:token(w?.renderer),canvasObject:token(document.getElementById('screen')),processId:w?.processId,processObject:token(w),endpoint:l?.endpointIdentity,endpointObject:token(l),
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
    const actual=[...(globalThis.__simgolfGL||[])];for(const b of globalThis.__simgolfBridges||[])for(const [id,c] of b.contexts||[])actual.push({context:c});const contexts=actual.map(c=>{if(!s.ids.has(c.context))s.ids.set(c.context,s.epoch+':'+(++s.next));return s.ids.get(c.context);});
    return {id,options:e.options,contexts,epoch:s.ids.get(e)+'/'+s.ids.get(instance),failed:!!e.failed,
      control:e.control?{completed:Atomics.load(e.control,1),error:Atomics.load(e.control,2),commands:Atomics.load(e.control,5)}:null};
  });
})()`;

function createChain({evaluate, send, workers, pageSession, app = 'nox_demo', expectedModules = null, now = Date.now, useBoundOwner = () => false, backend=process.env.RENDER_BACKEND||'software'}) {
  let latest = null, busy = false, closed = false, binding = null, startupOwner = null;
  async function readLiveImpl(startup = false) {
    assert(!startup || !binding, 'startup sampling forbidden after binding');
    const page = await evaluate(PAGE_READ);
    assert(page.isolated && page.apps.length === 1, 'one isolated registered app required');
    const a = page.apps[0];
    assert(a.name === app && a.running && !a.stopped && a.guestWorker, 'live registered app required');
    if(startup) {
      const fields=['processId','processObject','endpoint','endpointObject','workerObject','moduleObject','epoch','pageRendererObject','canvasObject'];
      if(startupOwner) for(const f of fields) assert.equal(a[f],startupOwner[f],'identity changed: '+f);
      else startupOwner=structuredClone(a);
    }
    if (startup && a.renderEndpoint === 'none') {
      // A guest can be waiting for the renderer callback. Do not enqueue a
      // Worker evaluation until page-side attachment exists.
      const after=await evaluate(PAGE_READ), b=after.apps[0];
      assert(after.isolated && after.apps.length===1 && b?.name===app && b.running && !b.stopped && b.guestWorker);
      for(const field of ['processId','processObject','endpoint','endpointObject','workerObject','moduleObject','epoch','pageRendererObject','canvasObject']) {
        assert(a[field]!==undefined && a[field]!==null && a[field]!=='','missing identity '+field);
        assert.equal(b[field],a[field],'identity changed: '+field);
      }
      return {pending:true,page:after};
    }
    // Once bound, the exact page Worker object, endpoint and target are the
    // owner proof. Scanning unrelated guest threads adds blocking CDP work.
    const selected = binding && useBoundOwner();
    if(selected) for(const f of ['processId','processObject','endpoint','endpointObject','workerObject','moduleObject','epoch','pageRendererObject','canvasObject','renderEndpoint','renderEndpointObject','renderWorkerObject'])
      assert.equal(a[f],binding[f],'identity changed: '+f);
    const candidates=selected?[...workers.values()].filter(w=>w.targetId===binding.workerTarget):[...workers.values()];
    if(selected)assert.equal(candidates.length,1,'unique bound Worker target required');
    trace.log({event:'owner.selection',selected:!!selected,candidates:candidates.map(w=>({targetId:w.targetId,url:w.url,closed:w.closed}))});
    const matches = [];
    for (const w of candidates) {
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
    let glProducer=null;
    let rendererContext='none',rendererTarget='none',rendererEpoch='none',rendererModuleSha256='none';
    if(a.renderEndpoint!=='none') {
      const owners=[];
      for(const r of workers.values())if(!r.closed&&r.url.includes('d3d-render-worker')) {
        const endpoints=await evaluate(RENDER_READ,r.sessionId);
        for(const endpoint of endpoints)if(endpoint.id===a.renderEndpoint)owners.push({r,endpoint});
      }
      assert.equal(owners.length,1,'unique actual owning renderer required');
      const {r,endpoint}=owners[0];
      const glEndpoints=await evaluate(producer.READ,r.sessionId);
      glProducer=producer.select({a,endpoints:glEndpoints,target:r.targetId,backend});
      if(startup&&!glProducer)return {pending:true,page,glEndpoints};
      assert(glProducer,'completed owning GL draw and presentation required');
      assert(!endpoint.failed&&!endpoint.control?.error,'live renderer required');
      if(['legacy','gl'].includes(endpoint.options.api)){if(startup&&!endpoint.contexts.length)return {pending:true,page};assert(endpoint.contexts.length,'actual owning context required');rendererContext=glProducer.context;}else rendererContext=glProducer.context;
      rendererTarget=r.targetId;rendererEpoch=endpoint.epoch;
      const modules=[...new Map(r.scripts.filter(s=>s.sha256&&s.bytecodeAvailable&&!s.error).map(s=>[s.scriptId,s])).values()];
      assert.equal(new Set(modules.map(s=>s.sha256)).size,1,'unique actual renderer module required');
      const bytes=await send('Debugger.getScriptSource',{scriptId:modules[0].scriptId},r.sessionId);
      assert(bytes.bytecode,'actual renderer module bytes required');
      rendererModuleSha256=sha(Buffer.from(bytes.bytecode,'base64'));
      assert.equal(rendererModuleSha256,modules[0].sha256);if(expectedModules)assert(expectedModules.includes(rendererModuleSha256));
    }
    const rendererIdentity={rendererContext,rendererTarget,rendererEpoch,rendererModuleSha256};
    const identity = {...a, workerTarget:w.targetId, workerInstance:live.instance, moduleSha256,...rendererIdentity};
    same(identity, identity);
    // Recheck page references after asynchronous Worker reads.
    const after = await evaluate(PAGE_READ);
    assert(after.apps.length === 1 && after.apps[0].running && !after.apps[0].stopped);
    const rechecked = {...after.apps[0], workerTarget:w.targetId, workerInstance:live.instance, moduleSha256,...rendererIdentity};
    if (startup) {
      // Only an unbound sampler may observe renderer attachment. Process,
      // guest owner, module and document continuity remain exact.
      const renderFields = new Set(['renderEndpoint','renderEndpointObject','renderWorkerObject']);
      for (const field of FIELDS) if (!renderFields.has(field))
        assert.equal(rechecked[field], identity[field], 'identity changed: '+field);
      if (identity.renderEndpoint === 'none' || [...renderFields].some(f=>rechecked[f]!==identity[f]))
        return {pending:true, identity, page:after};
    }
    same(identity, rechecked);
    assert.notEqual(identity.renderEndpoint, 'none', 'actual owning renderer required');
    if (binding) same(binding, identity);
    assert(!w.closed, 'Worker detached during identity read');
    return {identity, producer:glProducer, page:after, worker:{targetId:w.targetId, sessionId:w.sessionId, ...live}};
  }
  async function readLive(startup=false){return trace.span(startup?'owner.startup':'owner.readLive',()=>readLiveImpl(startup));}
  async function establishReady({attempts=120, wait:pause=wait, stableMs=1000}={}) {
    assert(!closed && !busy && !binding, 'readiness requires unbound idle chain');
    let previous=null;
    for(let n=0;n<attempts;n++) {
      const sample=await readLive(true);
      if(sample.pending) previous=null;
      else if(previous) {
        // Two complete readings must have exactly the same owners. A change
        // between attached readings fails rather than choosing another owner.
        same(previous.identity,sample.identity);
        if(!producer.advancing(previous.producer,sample.producer)){await pause(stableMs);continue;}
        binding=structuredClone(sample.identity);
        return {ready:true,attempts:n+1,identity:structuredClone(binding),producerBefore:previous.producer,producerAfter:sample.producer};
      } else previous=sample;
      await pause(previous?stableMs:500);
    }
    throw Error('actual owning renderer readiness timed out');
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
      assert(binding, 'establish readiness before capture');
      const before = await trace.span('binding.before',()=>readLive());
      // Validation after a screenshot can be slow on a busy renderer. It must
      // not make the reviewed pixels appear younger than their capture.
      const at = new Date(now()).toISOString();
      const shot = await trace.span('binding.screenshot',()=>send('Page.captureScreenshot', {format:'png'}, pageSession));
      const after = await trace.span('binding.after',()=>readLive()); same(before.identity, after.identity);
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
  return {capture, admit, readLive, establishReady, progress, get closed(){return closed;}};
}

const KEYS = {ArrowUp:38,ArrowDown:40,ArrowLeft:37,ArrowRight:39,Enter:13,Escape:27,Tab:9,Control:17,Space:32,w:87,p:80,a:65,',':188,'.':190};
async function hold({send, session, keys, holdMs, sample, saveSample = ()=>{}}) {
  assert(Array.isArray(keys) && (keys.length===1 || keys.length===2 && keys[0]==='a' && ['Control','Space'].includes(keys[1])), 'ordinary key or throttle plus steering');
  assert(keys.every(k=>Object.hasOwn(KEYS,k)) && new Set(keys).size===keys.length);
  assert(Number.isInteger(holdMs) && holdMs>=50 && holdMs<=2000, 'bounded physical hold');
  assert(typeof sample==='function', 'passive in-hold sampler required');
  const attempted=[], samples=[]; let error;
  const record = async phase => {
    const started=Date.now(), value=await trace.span('hold.sample',sample);
    const row={phase,started,finished:Date.now(),...value}; samples.push(row); await saveSample(row);
  };
  // The release timer is independent of sampler completion. A slow passive
  // read must never extend a physical hold, and is labelled outside the hold.
  let releasePromise, releaseAt;
  async function release() {
    if (releasePromise) return releasePromise;
    releaseAt=Date.now();
    return releasePromise=trace.span('hold.release',async()=>{for(const base of [...attempted].reverse())try {
      await send('Input.dispatchKeyEvent',{type:'keyUp',...base},session);
    } catch(e){error??=e;}});
  }
  let timer, started;
  try {
    started=Date.now(); timer=setTimeout(()=>{release().catch(e=>{error??=e;});},holdMs);
    for(const key of keys) {
      const base={key:key==='Space'?' ':key,code:({Control:'ControlLeft',a:'KeyA',p:'KeyP',w:'KeyW',',':'Comma','.':'Period'})[key]||key,windowsVirtualKeyCode:KEYS[key]}; attempted.push(base);
      await send('Input.dispatchKeyEvent',{type:'keyDown',...base},session);
      assert(!releasePromise,'input delivery exceeded hold bound');
    }
    while(!releasePromise) {await record('held');if(!releasePromise)await wait(Math.min(100,Math.max(1,holdMs-(Date.now()-started))));}
  } catch(e){error??=e;}
  finally {clearTimeout(timer);await release();}
  for(const s of samples)s.whollyDuringHold=s.started>=started&&s.finished<releaseAt;
  if(error) {error.holdReceipt={started,releaseAt,samples,attempted:attempted.map(k=>k.key)};throw error;}
  return {started,releaseAt,samples,attempted:attempted.map(k=>k.key),meaning:'physical host interval; passive counters do not prove DirectInput polls or simulation steps'};
}
module.exports = {createChain, hold, same, sha, FIELDS, MAX_AGE_MS, PAGE_READ, WORKER_READ, RENDER_READ};
