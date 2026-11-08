'use strict';
// Explicit Software gate. Passive only; never substitutes JS for renderer WASM.
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const software = require('./strict-software-owner.cjs');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const KEY = '__waStrictSoftwareGateV1';
const CONTRACT = 'Software:guest-WASM+actual-decoder-JS+actual-compositor-JS/v1';

function installInPage(w, installOwner, ownerKey, gateKey) {
  if (globalThis[gateKey]) throw Error('Software gate already installed; no replay');
  // Both bindings receive the very same actual WineAssembly object in one call.
  installOwner(w, ownerKey);
  const observer = globalThis[ownerKey], ids = new WeakMap(), epoch = crypto.randomUUID();
  let next = 0;
  const token = object => {
    if (!object || !['object','function'].includes(typeof object)) throw Error('missing guest owner');
    if (!ids.has(object)) ids.set(object, epoch + ':' + (++next));
    return ids.get(object);
  };
  function read(pixels) {
    if (!crossOriginIsolated || !w.running || w._stopped || globalThis[ownerKey] !== observer)
      throw Error('live isolated Software owner required');
    const guest = w.guestWorker, link = guest?.link;
    // WorkerLink.stop() fences admission synchronously, before asynchronous
    // loader/Worker drain clears the reference or CDP emits target detach.
    // Stable object identities during that interval do not mean a live owner.
    if (guest?._stopped || link?._stopping || link?._stopped ||
        link?._transportFailure || link?._loaderRetirementFault || link?._retirementComplete)
      throw Error('actual guest owner retiring or stopped; no replay');
    if (!link || !Number.isSafeInteger(link.endpointIdentity) || !Number.isSafeInteger(link.slot))
      throw Error('actual guest Worker endpoint required');
    const result = {software:observer.read(), guest:{processId:w.processId,
      owners:[w,guest,link,link.worker,link.module].map(token), epoch,
      endpoint:link.endpointIdentity,slot:link.slot}};
    if (pixels) {
      // Owner references and actual pixels are synchronous and colocated.
      result.pixelAt = Date.now();
      const screen = w.renderer?.canvas;
      if (!screen || typeof screen.toDataURL !== 'function') throw Error('actual screen required');
      result.png = screen.toDataURL('image/png');
    }
    return result;
  }
  Object.defineProperty(globalThis,gateKey,{value:Object.freeze({read})});
  return {contract:'Software:guest-WASM+actual-decoder-JS+actual-compositor-JS/v1',installed:true};
}
async function evaluate(send, session, expression) {
  const response = await send('Runtime.evaluate',{expression,returnByValue:true},session);
  assert(!response.exceptionDetails,response.exceptionDetails?.exception?.description || 'Software evaluation failed');
  return response.result.value;
}
async function install({send,pageSession,ownerExpression}) {
  assert(typeof ownerExpression === 'string' && ownerExpression.length,'explicit actual owner required');
  return evaluate(send,pageSession,`(${installInPage})(${ownerExpression},${software.installInPage},${JSON.stringify(software.KEY)},${JSON.stringify(KEY)})`);
}
// Worker instance tokens are local to its actual execution context, never a page
// claim about which instance happened to instantiate a same-looking module.
const WORKER_READ = `(()=>{
 if(typeof endpointIdentity==='undefined'||typeof workerSlot==='undefined'||typeof instance==='undefined'||!instance)throw Error('actual guest instance required');
 if(typeof scopedRetiring!=='undefined'&&scopedRetiring)throw Error('actual guest instance retiring; no replay');
 const key='__waStrictSoftwareGuestV1';
 if(!globalThis[key])Object.defineProperty(globalThis,key,{value:{epoch:crypto.randomUUID(),ids:new WeakMap(),next:0}});
 const s=globalThis[key];if(!s.ids.has(instance))s.ids.set(instance,s.epoch+':'+(++s.next));
 return {endpoint:endpointIdentity,slot:workerSlot,instance:s.ids.get(instance),epoch:s.epoch};
})()`;
const same = (a,b,message) => assert.equal(JSON.stringify(a),JSON.stringify(b),message);
function createSoftwareGate({send,pageSession,workers,scripts,expected,sameHostClock=false,
  now=Date.now,monotonic=()=>performance.now(),deadline,transitionMs=5000,inspect,save,record=()=>{}}) {
  assert(sameHostClock === true,'independently verified same-host OS clock required');
  assert(Number.isFinite(deadline)&&deadline>now(),'immutable Software deadline required');
  assert(Number.isInteger(transitionMs)&&transitionMs>=50&&transitionMs<=5000,'bounded Software transition window required');
  assert(typeof inspect === 'function' && typeof save === 'function','pixel inspection and phase evidence sinks required');
  assert(/^[a-f0-9]{64}$/.test(expected?.guestSha256),'explicit guest WASM pin required');
  const evidenceRecord = proof => record(structuredClone(proof));
  const sink = (row, png) => save(structuredClone(row), png && Buffer.from(png));
  const attestor = software.createAttestor({send,session:pageSession,scripts,expected,now,sameHostClock,record:evidenceRecord});
  let closed=false,busy=false,baseline=null,priorTimer=null,identity=null,transitionDue=null;
  const snapshot = pixels => evaluate(send,pageSession,`globalThis[${JSON.stringify(KEY)}].read(${pixels})`);
  const guestModule = w => {
    const modules = [...new Map(w.scripts.filter(s=>s.bytecodeAvailable&&!s.error&&s.sha256).map(s=>[s.scriptId,s])).values()];
    assert.equal(modules.length,1,'unique actual guest WASM script required');
    assert.equal(modules[0].sha256,expected.guestSha256,'guest pin mismatch');
    return modules[0];
  };
  async function guestRead(page) {
    const matches=[];
    for(const w of workers.values()) {
      if(w.closed || !w.url.includes('guest-worker'))continue;
      const live=await evaluate(send,w.sessionId,WORKER_READ);
      if(live.endpoint===page.endpoint&&live.slot===page.slot)matches.push({w,live});
    }
    assert.equal(matches.length,1,'unique actual guest Worker required');
    const {w,live}=matches[0];
    const module={...guestModule(w)}, requestAt=now();
    const response=await send('Debugger.getScriptSource',{scriptId:module.scriptId},w.sessionId);
    assert(typeof response.bytecode==='string' && response.bytecode.length,'complete uncached guest WASM response required');
    const bytes=Buffer.from(response.bytecode,'base64');
    assert(bytes.subarray(0,8).equals(Buffer.from([0,97,115,109,1,0,0,0])),'actual WASM bytes required');
    assert.equal(sha(bytes),expected.guestSha256,'actual guest WASM changed');
    assert(!w.closed,'guest retired during byte transport');
    same(guestModule(w),module,'guest script retired during transport');
    const after=await evaluate(send,w.sessionId,WORKER_READ);same(live,after,'guest instance changed during transport');
    const proof={kind:'WebAssembly',role:'guest',targetId:w.targetId,session:w.sessionId,
      scriptId:module.scriptId,sha256:sha(bytes),bytes:bytes.length,requestAt,responseAt:now(),uncached:true,...live};
    await evidenceRecord(proof);
    return {w,live,module,proof};
  }
  function fresh(at) {
    const age=now()-at;assert(Number.isFinite(age)&&age>=0&&age<=250,'Software evidence expired (<=250ms required)');
  }
  async function read(pixels) {
    const before=await snapshot(false);
    const lanes=await Promise.allSettled([guestRead(before.guest),attestor.read()]);
    for(const lane of lanes)if(lane.status==='rejected')throw lane.reason;
    const guest=lanes[0].value,sw=lanes[1].value;
    const after=await snapshot(pixels);
    same(before.guest,after.guest,'guest page owner changed');
    assert.equal(software.stable(before.software),software.stable(after.software),'Software owner changed');
    assert.equal(software.stable(sw.owner),software.stable(after.software),'final Software owner differs from source owner');
    assert(after.software.copyGeneration>=sw.owner.copyGeneration,'Software copy regressed');
    const live=await evaluate(send,guest.w.sessionId,WORKER_READ);
    same(guest.live,live,'guest instance changed before final pixels');
    assert(!guest.w.closed,'guest retired before final pixels');same(guestModule(guest.w),guest.module,'guest script retired before final pixels');
    for(const response of sw.responses) {
      const current=scripts.get(response.scriptId);
      assert(current&&current.executionContextId===response.executionContextId&&current.url===response.url&&current.scriptLanguage==='JavaScript','Software script retired before final pixels');
    }
    const bound={guestPage:after.guest,guest:guest.live,target:guest.w.targetId,
      guestModule:guest.module.scriptId,software:software.stable(after.software),
      scripts:sw.responses.map(r=>[r.role,r.session,r.scriptId,r.executionContextId,r.sha256])};
    const serial=JSON.stringify(bound);
    if(identity!==null)assert.equal(serial,identity,'Software gate owner/epoch changed');
    identity=serial;
    fresh(after.software.copyAt);
    for(const response of [guest.proof,...sw.responses])fresh(response.requestAt);
    return {owner:bound,software:after.software,responses:[guest.proof,...sw.responses],
      ...(pixels?{png:after.png,at:after.pixelAt}:{})};
  }
  return {
    contract:CONTRACT,
    get closed(){return closed;},
    async probe({phase='afterResume'}={}) {
      assert(!closed,'UNKNOWN Software gate closed; no replay');
      if(busy){closed=true;throw Error('UNKNOWN concurrent Software probe; no replay');}
      busy=true;
      try {
        assert(['beforeResume','afterResume'].includes(phase),'explicit Software phase required');
        assert(now()<Math.min(deadline,transitionDue??deadline),'Software transition deadline expired');
        assert(phase==='beforeResume'?baseline===null:baseline!==null,'one baseline before Resume; no replay');
        await sink({phase:'entry',probePhase:phase,at:now(),contract:CONTRACT});
        const clockStart=now(),mono=monotonic();
        const target=await evaluate(send,pageSession,'Date.now()');const clockEnd=now();
        assert(Number.isFinite(target)&&target>=clockStart&&target<=clockEnd&&Math.abs((clockEnd-clockStart)-(monotonic()-mono))<=3,'same-host clock bracket failed');
        const first=await read(false);await sink({phase:'owner',probePhase:phase,read:1,proof:first});
        const final=await read(true);same(first.owner,final.owner,'owners changed across two reads');
        await sink({phase:'owner',probePhase:phase,read:2,proof:final});
        assert(typeof final.png==='string'&&final.png.startsWith('data:image/png;base64,'),'complete actual PNG required');
        const png=Buffer.from(final.png.slice('data:image/png;base64,'.length),'base64');
        assert(png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'PNG signature required');
        const inspection=await inspect(png);assert(typeof inspection.living==='boolean','explicit living HUD result required');
        const hash=sha(png);let qualified=false;
        if(phase==='beforeResume') {
          assert(!inspection.living,'baseline already has living HUD');baseline=hash;priorTimer=null;
          transitionDue=Math.min(deadline,now()+transitionMs);
        } else if(inspection.living) {
          assert(/^[a-f0-9]{64}$/.test(inspection.timerSha256),'actual timer region hash required');
          qualified=priorTimer!==null&&priorTimer!==inspection.timerSha256&&hash!==baseline;
          priorTimer=inspection.timerSha256;
        } else priorTimer=null;
        const result={contract:CONTRACT,phase,qualified,at:final.at,checkedAt:now(),pngSha256:hash,
          timerSha256:inspection.timerSha256??null,owner:final.owner,reads:[first,final],hardwareGateEligible:false};
        await sink({phase:'pixels',probePhase:phase,result},png);
        await sink({phase:'return',probePhase:phase,result});
        // Evidence sinks are asynchronous: retirement during a save must not
        // escape as a current certificate, even when pixels are still young.
        const current=await snapshot(false);
        same(current.guest,final.owner.guestPage,'guest owner retired during evidence save');
        assert.equal(software.stable(current.software),final.owner.software,'Software owner retired during evidence save');
        const guest=[...workers.values()].find(w=>w.targetId===final.owner.target&&!w.closed);
        assert(guest,'guest retired during evidence save');
        same(await evaluate(send,guest.sessionId,WORKER_READ),final.owner.guest,'guest instance retired during evidence save');
        assert.equal(guestModule(guest).scriptId,final.owner.guestModule,'guest module retired during evidence save');
        for(const response of final.responses.filter(r=>r.kind==='JavaScript')) {
          const script=scripts.get(response.scriptId);
          assert(script&&script.executionContextId===response.executionContextId&&script.url===response.url&&script.scriptLanguage==='JavaScript','Software script retired during evidence save');
        }
        // Saving and decoding count against freshness, as do all six complete
        // responses and both native copies. A late sink cannot admit a DOWN.
        fresh(final.at);
        for(const proof of [first,final]) {
          fresh(proof.software.copyAt);
          for(const response of proof.responses)fresh(response.requestAt);
        }
        assert(now()<Math.min(deadline,transitionDue),'Software transition deadline expired');
        assert(!closed,'UNKNOWN concurrent Software probe; no replay');
        result.checkedAt=now();return result;
      } catch(error) {closed=true;throw error;}
      finally {busy=false;}
    },
  };
}
module.exports={install,installInPage,createSoftwareGate,CONTRACT,KEY,WORKER_READ};
