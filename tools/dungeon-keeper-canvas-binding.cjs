'use strict';
// Page-owned Canvas2D variant of the retained original native-CDP chain.
// Only the production owner-scoped immutable capture endpoint can supply pixels.
// No D3D endpoint is invented; guest/module/document continuity remains exact.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const wait = ms => new Promise(r => setTimeout(r, ms));
const FIELDS = ['processId', 'processObject', 'endpoint', 'endpointObject', 'workerObject',
  'workerTarget', 'workerInstance', 'moduleObject', 'moduleSha256', 'epoch',
  'renderEndpoint', 'renderEndpointObject', 'renderWorkerObject',
  'rendererTarget', 'rendererEpoch', 'rendererModuleSha256', 'pageRendererObject', 'canvasObject',
  'windowInstance', 'outputCanvasObject', 'contextObject', 'presentationKind'];
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
    const renderer=w?.renderer;
    const owners=Object.values(renderer?.windows||{}).filter(v=>v.visible&&!v.isChild&&v.w>0&&v.h>0&&v.processId===w.processId&&v.wasm===w.instance);
    const win=owners.length===1?owners[0]:null;
    const output=renderer?.presentationCanvas||renderer?.canvas;
    const software=renderer?.ctx?.canvas===renderer?.canvas && renderer.canvas===document.getElementById('screen') && typeof w?.requestImmutableCapture==='function' && ![...(w?._renderWorkerManager?.ports?.values()||[])].some(p=>!p.closed);
    return {name:a.name,running:!!w?.running,stopped:!!w?._stopped,guestWorker:!!g,
      pageRendererObject:token(w?.renderer),canvasObject:token(document.getElementById('screen')),processId:w?.processId,processObject:token(w),endpoint:l?.endpointIdentity,endpointObject:token(l),
      renderEndpoint:software&&win?win.hwnd:'none',renderEndpointObject:software?token(win):'none',
      renderWorkerObject:software?token(win?.wasm):'none',
      windowInstance:token(win?.wasm),outputCanvasObject:token(output),contextObject:token(renderer?.ctx),
      presentationKind:software?'page-canvas2d':'unsupported',publication:renderer?._immutablePublicationSequence??0,
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

function createChain({evaluate, send, workers, pageSession, app = 'dungeon_keeper_demo', expectedModules = null, now = Date.now}) {
  assert(Array.isArray(expectedModules)&&expectedModules.length>0&&expectedModules.every(h=>typeof h==='string'), 'immutable staged module pins required');
  let latest = null, busy = false, closed = false, binding = null;
  async function readLive(startup = false) {
    assert(!closed, 'closed chain');
    assert(!startup || !binding, 'startup sampling forbidden after binding');
    const page = await evaluate(PAGE_READ);
    assert(page.isolated && page.apps.length === 1, 'one isolated registered app required');
    const a = page.apps[0];
    assert(a.name === app && a.running && !a.stopped && a.guestWorker, 'live registered app required');
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
    assert.equal(a.presentationKind,'page-canvas2d','actual page Canvas2D owner required');
    const pageOwner=workers.get(pageSession);
    assert(pageOwner&&!pageOwner.closed,'actual page target required');
    const modules=[...new Map(pageOwner.scripts.filter(s=>s.sha256&&s.bytecodeAvailable&&!s.error).map(s=>[s.scriptId,s])).values()];
    assert.equal(new Set(modules.map(s=>s.sha256)).size,1,'unique actual page renderer module required');
    const bytes=await send('Debugger.getScriptSource',{scriptId:modules[0].scriptId},pageSession);
    assert(bytes.bytecode,'actual page module bytes required');
    const rendererModuleSha256=sha(Buffer.from(bytes.bytecode,'base64'));
    assert.equal(rendererModuleSha256,modules[0].sha256,'page module bytes changed');
    assert.equal(rendererModuleSha256,moduleSha256,'page/guest executing module mismatch');
    if(expectedModules)assert(expectedModules.includes(rendererModuleSha256),'immutable page module required');
    const rendererTarget=pageOwner.targetId,rendererEpoch=a.epoch+'/'+a.renderEndpointObject+'/'+a.windowInstance;
    const rendererIdentity={rendererTarget,rendererEpoch,rendererModuleSha256};
    const identity = {...a, workerTarget:w.targetId, workerInstance:live.instance, moduleSha256,...rendererIdentity};
    same(identity, identity);
    // Recheck page references after asynchronous Worker reads.
    const after = await evaluate(PAGE_READ);
    assert(after.apps.length === 1 && after.apps[0].running && !after.apps[0].stopped);
    const rechecked = {...after.apps[0], workerTarget:w.targetId, workerInstance:live.instance, moduleSha256,...rendererIdentity};
    if (startup) {
      // Only an unbound sampler may observe renderer attachment. Process,
      // guest owner, module and document continuity remain exact.
      const renderFields = new Set(['renderEndpoint','renderEndpointObject','renderWorkerObject','windowInstance']);
      for (const field of FIELDS) if (!renderFields.has(field))
        assert.equal(rechecked[field], identity[field], 'identity changed: '+field);
      if (identity.renderEndpoint === 'none' || [...renderFields].some(f=>rechecked[f]!==identity[f]))
        return {pending:true, identity, page:after};
    }
    same(identity, rechecked);
    assert.notEqual(identity.renderEndpoint, 'none', 'actual owning renderer required');
    if (binding) {
      same(binding, identity);
      assert(identity.publication>=binding.publication,'bound publication regressed');
    }
    assert(!w.closed, 'Worker detached during identity read');
    return {identity, page:after, worker:{targetId:w.targetId, sessionId:w.sessionId, ...live}};
  }
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
        assert(sample.identity.publication>previous.identity.publication,'live Canvas2D publication progress required');
        binding=structuredClone(sample.identity);
        return {ready:true,attempts:n+1,identity:structuredClone(binding)};
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
      const before = await readLive();
      // Validation after a screenshot can be slow on a busy renderer. It must
      // not make the reviewed pixels appear younger than their capture.
      const at = new Date(now()).toISOString();
      const key='__dkCanvasCaptureV1';
      await evaluate(`(() => {
        const w=runningApps[0].wine;
        if(globalThis.${key})throw Error('capture already pending');
        globalThis.${key}=w.requestImmutableCapture({hwnd:${before.identity.renderEndpoint}});
        return true;
      })()`);
      let result;
      try {
        for(let n=0;n<200;n++) {
          result=await evaluate(`(() => {
            const t=globalThis.${key};
            if(t.status==='failed')throw Error(t.error);
            if(t.status!=='complete')return null;
            const r=t.read();return {metadata:r.metadata,rgba:Array.from(r.outputRGBA)};
          })()`);
          if(result)break;
          await wait(25);
        }
        assert(result,'natural owner-scoped Canvas2D publication timed out');
      } finally {
        await evaluate(`(() => {globalThis.${key}?.cancel();delete globalThis.${key};return true;})()`);
      }
      const after = await readLive(); same(before.identity, after.identity);
      const metadata=result.metadata;
      assert.equal(metadata.completion,'canvas2d-readback');
      assert.equal(metadata.captureOwner.hwnd,before.identity.renderEndpoint);
      assert.equal(metadata.captureOwner.processId,before.identity.processId);
      assert(metadata.composition.windows.some(w=>w.hwnd===metadata.captureOwner.hwnd&&w.processId===metadata.captureOwner.processId));
      assert(metadata.publication>before.identity.publication,'new natural publication required');
      assert(metadata.publication<=after.identity.publication,'publication sequence regressed');
      const {PNG}=require('pngjs');
      const png=PNG.sync.write({width:metadata.output.width,height:metadata.output.height,data:Buffer.from(result.rgba)});
      latest = {label, at, completedAt:new Date(now()).toISOString(), sha256:sha(png), metadata, identity:after.identity};
      return {capture:structuredClone(latest), png, before, after};
    } catch(e) { closed=true; throw e; }
    finally { busy = false; }
  }
  async function admit(review, dispatch) {
    assert(!closed && !busy, 'closed or concurrent chain'); busy = true;
    let effects = false;
    try {
      assert(latest && review?.label === latest.label && review.sha256 === latest.sha256 && review.review?.trim(), 'current reviewed capture required');
      same(latest.identity, review.identity); fresh(latest);
      const live = await readLive(); same(latest.identity, live.identity);
      assert(live.identity.publication>=latest.metadata.publication,'reviewed publication regressed');
      const ageMs = fresh(latest);
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
    for (const f of FIELDS.filter(f=>!['workerTarget','workerInstance','moduleSha256','rendererTarget','rendererEpoch','rendererModuleSha256'].includes(f)))
      assert.equal(a[f], identity[f], 'held identity changed: '+f);
    const w = [...workers.values()].find(w=>w.targetId===identity.workerTarget&&!w.closed);
    assert(w, 'held Worker retired');
    const p=workers.get(pageSession);
    assert(p&&!p.closed&&p.targetId===identity.rendererTarget,'held page retired');
    assert(a.publication>=identity.publication,'held publication regressed');
    return {at:new Date(now()).toISOString(), slice:a.slice, publication:a.publication, physical:a.physical, render:[]};
  }

  return {capture, admit, readLive, establishReady, progress, get closed(){return closed;}};
}

const native=require('../ops/browser-native-input.cjs');
const hold=native.hold,mouse=native.mouse;
module.exports = {createChain, hold, mouse, same, sha, FIELDS, MAX_AGE_MS, PAGE_READ, WORKER_READ};
