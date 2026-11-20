'use strict';
const assert = require('node:assert/strict');
const readiness = require('./revolt-startup-readiness.cjs');

// These local refusals contain no transport uncertainty. Only the observation
// that proved a normal wait can create one; callers never catch arbitrary errors.
class CandidateWait extends Error {}
// All structural/owner checks still run. Only the validator's exact local age
// refusal can be NOT_SENT, and only while no DOWN has reached the transport.
function verifyReviewedReadback(metadata, owner, now, maxAge, down) {
  try {
    require('./revolt-display-admission.cjs').verifyReadback(metadata, owner, now, maxAge);
  } catch (error) {
    if (down === 0 && error instanceof assert.AssertionError &&
        error.message === 'request freshness') {
      const refusal = Error('NOT_SENT native capture request expired before DOWN');
      refusal.code = 'LOCAL_NOT_SENT';
      refusal.cause = error;
      throw refusal;
    }
    throw error;
  }
}
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
// Imports finish before the preparation marker. No connection, arm, DOWN or
// release timer exists until the personally chosen operation publishes cfg.
function adaptRelease(source) {
  const from="const [out,file]=process.argv.slice(2),cfg=JSON.parse(fs.readFileSync(file));\n(async()=>{";
  assert.equal(source.split(from).length,2,'unique independent release preparation site');
  return source.replace(from,`const [out,file]=process.argv.slice(2);
(async()=>{
const importWait=Number(process.env?.REVOLT_IMPORT_WAIT_MS||120000);assert(importWait>=120000&&importWait<=1820000,'bounded import wait');
const preparationDeadline=Date.now()+importWait;
fs.writeFileSync(file+'.prepared',JSON.stringify({at:Date.now(),pid:process.pid,importsReady:true,armed:false}),{flag:'wx'});
while(!fs.existsSync(file)){assert(Date.now()<preparationDeadline,'finite release preparation deadline');await sleep(5);}
const cfg=JSON.parse(fs.readFileSync(file));`);
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
  replace('async function gesture(cmd){', `const standby=require(root+'/tools/revolt-release-standby.cjs').create({out,script:__dirname+'/release.cjs',check:()=>gate.check(),save});
async function prepareRelease(){return standby.prepare();}
async function gesture(cmd){`);
  replace('let child,joined,failure=null,downAt=null,armed=null;', 'let child,joined,preparedRelease,failure=null,downAt=null,armed=null;');
  for (const ownerExpression of ['owner', 'current.page.apps[0]']) {
    const from = `admission.verifyReadback(latest.metadata,${ownerExpression},Date.now(),age);`;
    const occurrences = source.split(from).length - 1;
    assert.equal(occurrences, ownerExpression === 'owner' ? 2 : 1, 'gesture freshness sites');
    source = source.replaceAll(from,
      `integration.verifyReviewedReadback(latest.metadata,${ownerExpression},Date.now(),age,op.down);`);
  }
  replace('ordering.arm(op,armed);',
    'integration.verifyReviewedReadback(latest.metadata,owner,Date.now(),age,op.down);ordering.arm(op,armed);');
  replace("const cfg={url:browser.wsEndpoint", "preparedRelease=standby.consume(cmd.name);child=preparedRelease.child;joined=preparedRelease.joined;const cfg={url:browser.wsEndpoint");
  replace("child=cp.spawn(process.execPath,[__dirname+'/release.cjs',out,out+'/'+cmd.name+'-release-config.json'],{stdio:['pipe','pipe','pipe']});", "require(root+'/tools/atomic-command-publication.js').publishJSON(preparedRelease.file,cfg);");
  replace("\n joined=new Promise(r=>child.once('close'", "\n joined=preparedRelease?.joined||new Promise(r=>child.once('close'");
  replace("if(cmd.action==='capture')await capture(cmd.name);", "if(cmd.action==='prepare-release')await prepareRelease(cmd.name);else if(cmd.action==='capture')await capture(cmd.name);");
  replace('if(child){child.stdin.end();', "if(child){if(!fs.existsSync(preparedRelease.file))child.kill('SIGTERM');child.stdin.end();");
  replace("if(wait.code!==0)failure??=Error('independent UP failed');", "if(wait.code!==0)failure=Object.assign(Error('independent UP failed; scope must close'),{cause:failure});");
  replace("save('wire.json',wire);", "await standby.close();save('wire.json',wire);");
  replace("const envelope=JSON.parse(fs.readFileSync(out+'/envelope.json'));", "const initialStandby=await prepareRelease();save('prebudget-standby-ready.json',{at:Date.now(),pid:initialStandby.child.pid,importsReady:true,armed:false});const setupEnd=Date.now()+20000;while(!fs.existsSync(out+'/envelope.json')){gate.check();assert(Date.now()<setupEnd,'finite envelope handoff');await sleep(10);}const envelope=JSON.parse(fs.readFileSync(out+'/envelope.json'));assert(JSON.parse(fs.readFileSync(out+'/prebudget-standby-ready.json')).at<=envelope.at,'actual import-only child before runtime budget');");
  replace('const v=await evaluate(admission.DISPLAY_READ);',
    'await observer.identity(true);const v=await evaluate(`(()=>{const s=(${readiness.READ});if(!s.page.apps[0]?.outputVisible)return {loadingSnapshot:s};return (${admission.DISPLAY_READ});})()`);if(v.loadingSnapshot){readiness.classify(v.loadingSnapshot);if(owner)same(owner,v.loadingSnapshot.page.apps[0]);throw new integration.CandidateWait("loading during display proof");}');
  replace("const order=require('./guard.cjs');", `const integration=require(root+'/tools/revolt-capture-integration.cjs'),readiness=require(root+'/tools/revolt-startup-readiness.cjs');
let startupAdmission=true;
const observer=integration.createObserver({evaluate,sameOwner:same,owner:()=>owner,
 expectedName:mode==='original'?'re_volt_demo':'live_input_fixture',check:()=>gate.check(),
 onObservation:v=>log('capture-readiness.jsonl',v)});
async function capture(name){
 await prepareRelease();
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
module.exports = {createObserver, CandidateWait, adaptBrowser, adaptRelease, displayPreflightExpression, awaitDisplayPreflight, verifyReviewedReadback};
