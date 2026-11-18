'use strict';
const assert = require('node:assert/strict');
const readiness = require('./revolt-startup-readiness.cjs');

// These local refusals contain no transport uncertainty. Only the observation
// that proved a normal wait can create one; callers never catch arbitrary errors.
class CandidateWait extends Error {}
// Passive pre-ticket check. Only already queued ordinary work may be waited
// for. A validator failure is retained and closes the caller; it is not a
// reason to retry a ticket. Use ReVolt's reader (its d3dim endpoint selection
// differs from GL applications).
function displayPreflightExpression(identity) {
  const fields = ['processId','processObject','endpoint','endpointObject','workerObject',
    'moduleObject','epoch','renderEndpoint','renderEndpointObject','renderWorkerObject',
    'renderApi','renderBridgeObject','renderGeneration','pageRendererObject','canvasObject',
    'windowHwnd','windowObject','windowInstance','outputCanvasObject'];
  return `(() => {
    const p=(${require('./revolt-display-admission.cjs').PAGE_READ}),a=p.apps[0],want=${JSON.stringify(identity)};
    const w=runningApps[0]?.wine,r=w?.renderer,rec=r?._currentDisplayRecord;
    const diagnostic={at:Date.now(),publication:r?._immutablePublicationSequence,
      viewport:rec?.viewport,liveViewport:r?._exclusivePresentationViewport,
      source:rec?[rec.sourceWidth,rec.sourceHeight]:null,
      windows:rec?.windows.map(v=>({record:{hwnd:v.hwnd,x:v.x,y:v.y,w:v.w,h:v.h},
        live:(()=>{const q=v.window.deref();return q?{hwnd:q.hwnd,x:q.x,y:q.y,w:q.w,h:q.h}:null;})()}))};
    try {
      if(!p.isolated||p.apps.length!==1||!a.running||a.stopped||!a.outputVisible)throw Error('ReVolt preflight owner/output not live');
      for(const k of ${JSON.stringify(fields)})if(a[k]!==want[k])throw Error('ReVolt preflight identity changed '+k);
      if(rec?.pixelError)throw rec.pixelError;
      const pending=[];
      if(w._dxDirty||w._dxLockDeferred||w._presentFrameDue)pending.push('host surface publication');
      if(r._workerPublicationHeld()||r._workerGdiPaintDepth>0||r._repainting)pending.push('held/in-flight paint');
      if(r._repaintScheduled||r._repaintPending||r._workerRepaintDeferred)pending.push('ordinary damage');
      if(!rec)pending.push('no ordinary complete display');
      if(pending.length)return {ready:false,pending,diagnostic};
      r._validateCurrentDisplayCapture({owner:{hwnd:a.windowHwnd,window:r.windows[a.windowHwnd],processId:w.processId,instance:w.instance}});
      return {ready:true,diagnostic};
    }catch(error){return {ready:false,failed:true,error:String(error),diagnostic};}
  })()`;
}
async function awaitDisplayPreflight({evaluate, identity, deadline, check,
  onObservation=()=>{},now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms))}) {
  assert(Number.isFinite(deadline));
  for (;;) {
    check();assert(now()<deadline,'finite ReVolt display preflight deadline');
    const state=await evaluate(displayPreflightExpression(identity));
    onObservation(state);check();
    assert(!state.failed,state.error);assert(now()<deadline,'finite ReVolt display preflight deadline');
    if(state.ready)return state;
    assert(state.pending?.length,'explicit queued display work required');
    await sleep(Math.min(25,deadline-now()));
  }
}
function createObserver({evaluate, sameOwner, owner, expectedName, check, onObservation}) {
  async function observe() {
    check();
    const s = await evaluate(readiness.READ);
    check();
    assert.equal(s.page?.apps?.[0]?.name, expectedName);
    if (owner()) sameOwner(owner(), s.page.apps[0]);
    readiness.classify(s);
    return s;
  }
  function acceptIdentity(s, candidate = false) {
    check();
    assert.equal(s.page?.apps?.[0]?.name, expectedName);
    if (owner()) sameOwner(owner(), s.page.apps[0]);
    if (readiness.classify(s) === 'waiting') {
      if (candidate) throw new CandidateWait('discard unadmitted loading candidate');
      const e = Error('normal loading; intent NOT_SENT; fresh whole-frame review and new intent required');
      e.code = 'LOCAL_NOT_SENT';
      throw e;
    }
    return s.page;
  }
  async function identity(candidate = false) { return acceptIdentity(await observe(), candidate); }
  async function capture({deadline, candidate, discard}) {
    return readiness.captureReady({observe, sameOwner, deadline, check, onObservation,
      capture: async () => {
        try { return await candidate(); }
        catch (e) { if (!(e instanceof CandidateWait)) throw e; discard(); return null; }
      }});
  }
  return {observe, identity, acceptIdentity, capture};
}

// The existing native/browser operator supplies its unchanged release and
// closure machinery. Exact sites make an incompatible caller a local failure.
function adaptBrowser(source) {
  const replace = (from, to) => {
    assert.equal(source.split(from).length, 2, 'unique capture integration site: ' + from.slice(0, 70));
    source = source.replace(from, to);
  };
  const start = source.indexOf('async function identity(){');
  const end = source.indexOf('\nasync function nativeContext()', start);
  assert(start >= 0 && end > start);
  source = source.slice(0, start) + `async function identity(){assert(!expectedTermination,'ordinary admission permanently closed for final Quit');return observer.identity();}` + source.slice(end);
  replace('async function capture(name){', 'async function captureCandidate(name){');
  replace('const before=await identity();', 'const before=await observer.identity(true);');
  replace('after=await identity();latest={name,', 'after=await observer.identity(true);const candidate={name,');
  replace('return {page:(${PAGE_READ}),stopped:', 'return {observation:(${readiness.READ}),page:(${PAGE_READ}),stopped:');
  replace('same(a,v.page.apps[0]);', 'observer.acceptIdentity(v.observation);same(a,v.page.apps[0]);');
  replace("save(name+'-scene.json',latest);return latest;", "save(name+'-scene.json',candidate);return candidate;");
  replace('const diagnosticsAt=Date.now();ordering.diagnostics(diagnosticsAt);',
    "await integration.awaitDisplayPreflight({evaluate,identity:(await observer.identity(true)).apps[0],deadline:Math.min(Date.now()+90000,launch.deadline-prep.policy.quitReserveMs),check:()=>gate.check(),onObservation:v=>log('passive-display-preflight.jsonl',v)});const diagnosticsAt=Date.now();ordering.diagnostics(diagnosticsAt);");
  replace('const v=await evaluate(admission.DISPLAY_READ);',
    'await observer.identity(true);const v=await evaluate(`(()=>{const s=(${readiness.READ});if(!s.page.apps[0]?.outputVisible)return {loadingSnapshot:s};return (${admission.DISPLAY_READ});})()`);if(v.loadingSnapshot){readiness.classify(v.loadingSnapshot);if(owner)same(owner,v.loadingSnapshot.page.apps[0]);throw new integration.CandidateWait("loading during display proof");}');
  replace("const order=require('./guard.cjs');", `const integration=require(root+'/tools/revolt-capture-integration.cjs'),readiness=require(root+'/tools/revolt-startup-readiness.cjs');
let startupAdmission=true;
const observer=integration.createObserver({evaluate,sameOwner:same,owner:()=>owner,
 expectedName:mode==='original'?'re_volt_demo':'live_input_fixture',check:()=>gate.check(),
 onObservation:v=>log('capture-readiness.jsonl',v)});
async function capture(name){
 latest=null;
 const deadline=Math.min(Date.now()+90000,launch.deadline-5000,
  startupAdmission?launch.at+prep.policy.startupMs:launch.deadline-prep.policy.quitReserveMs);
 let n=0;
 const r=await observer.capture({deadline,candidate:()=>captureCandidate(name+'-candidate-'+(++n)),
  discard:()=>{latest=null;log('discarded-candidates.jsonl',{at:Date.now(),name,candidate:n});}});
 latest=r.candidate;save(name+'-admitted.json',latest);return latest;
}
const order=require('./guard.cjs');`);
  replace('if(a.outputVisible)break;', "if(a.outputVisible)break;\n const ordinaryWait=await evaluate(readiness.READ);if(ordinaryWait.dataWait.visible){assert.equal(readiness.classify(ordinaryWait),'waiting');await sleep(50);continue;}");
  replace("save('ready.json',{at:Date.now(),policy:prep.policy});", "startupAdmission=false;save('ready.json',{at:Date.now(),policy:prep.policy});");
  replace('async function inspect(name){const p=await identity(),state=await evaluate(extra);',
    "async function inspect(name){const observation=await observer.observe(),p=observation.page,state=await evaluate(extra);log('unadmitted-inspections.jsonl',{at:Date.now(),name,state:readiness.classify(observation),inputAdmission:false});");
  replace("if(!downAt&&failure.code==='LOCAL_NOT_SENT'&&!gate.closed){",
    "if(!downAt&&failure.code==='LOCAL_NOT_SENT'&&!gate.closed){if(!child){assert.equal(op.down,0);assert(!op.armed);op.done=true;log('ordering.jsonl',{stage:'local-before-arm-NOT_SENT',name:op.name,at:Date.now()});}");
  return source;
}
module.exports = {createObserver, CandidateWait, adaptBrowser, displayPreflightExpression, awaitDisplayPreflight};
