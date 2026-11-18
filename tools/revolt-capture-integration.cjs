'use strict';
const assert = require('node:assert/strict');
const readiness = require('./revolt-startup-readiness.cjs');

// These local refusals contain no transport uncertainty. Only the observation
// that proved a normal wait can create one; callers never catch arbitrary errors.
class CandidateWait extends Error {}
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
  async function identity(candidate = false) {
    const s = await observe();
    if (readiness.classify(s) === 'waiting') {
      if (candidate) throw new CandidateWait('discard unadmitted loading candidate');
      const e = Error('normal loading; intent NOT_SENT; fresh whole-frame review and new intent required');
      e.code = 'LOCAL_NOT_SENT';
      throw e;
    }
    return s.page;
  }
  async function capture({deadline, candidate, discard}) {
    return readiness.captureReady({observe, sameOwner, deadline, check, onObservation,
      capture: async () => {
        try { return await candidate(); }
        catch (e) { if (!(e instanceof CandidateWait)) throw e; discard(); return null; }
      }});
  }
  return {observe, identity, capture};
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
  replace("save(name+'-scene.json',latest);return latest;", "save(name+'-scene.json',candidate);return candidate;");
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
  replace("if(!downAt&&failure.code==='LOCAL_NOT_SENT'&&!gate.closed){",
    "if(!downAt&&failure.code==='LOCAL_NOT_SENT'&&!gate.closed){if(!child){assert.equal(op.down,0);assert(!op.armed);op.done=true;log('ordering.jsonl',{stage:'local-before-arm-NOT_SENT',name:op.name,at:Date.now()});}");
  return source;
}
module.exports = {createObserver, CandidateWait, adaptBrowser};
