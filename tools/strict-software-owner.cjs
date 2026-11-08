'use strict';
// Passive, explicit page-software ownership diagnostics. This is deliberately
// NOT an adapter that turns JavaScript sources into render-Worker WASM proof.
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const KEY = '__waStrictSoftwareOwnerV1';

function installInPage(w, key) {
  if (globalThis[key]) throw Error('software observer already installed; no identity reuse');
  const ctx = w?.hostCtx, renderer = w?.renderer, gdi = ctx?.sharedGdi;
  const observation = gdi?.fallbackObservation;
  if (!w?.running || w._stopped || !ctx || !renderer || !w.instance ||
      ctx.instance !== w.instance || ctx.renderer !== renderer ||
      typeof gdi?.presentBestDxOffscreen !== 'function' ||
      typeof renderer._repaintOnce !== 'function' ||
      typeof observation?.current !== 'function' || observation.copy !== null)
    throw Error('unique unoccupied actual software owner observation required');
  const epoch = crypto.randomUUID(), ids = new WeakMap(); let next = 0, latest, unknown;
  const instance = w.instance, exports = ctx.exports, memory = w.memory;
  const currentSurface = observation.current;
  const token = object => {
    if (!object || !['object','function'].includes(typeof object)) throw Error('missing actual owner object');
    if (!ids.has(object)) ids.set(object, epoch + ':' + (++next));
    return ids.get(object);
  };
  const functions = Object.freeze({decoder:gdi.presentBestDxOffscreen, compositor:renderer._repaintOnce});
  const callback = row => {
    // The production hook runs only after the selected native pixel copy.
    // Keep the raw references, not a post-hoc HWND/slot enumeration.
    if (unknown) return;
    if (!row?.copied || row.source !== 'selected-fallback' || row.memory !== memory?.buffer ||
        row.window !== renderer.windows?.[row.hwnd] || !row.layer ||
        row.layer !== row.window?._dxFrameLayer || row.destination !== row.layer.canvas ||
        row.layer.ctx?.canvas !== row.destination || row.window.wasmMemory !== w.memory ||
        row.window.wasm !== w.instance || row.window.processId !== w.processId ||
        !Number.isSafeInteger(row.copyGeneration) || !Number.isSafeInteger(row.allocationGeneration) ||
        !(row.copyGeneration > (latest?.row.copyGeneration || 0)) || !(row.allocationGeneration > 0)) {
      unknown = 'unattestable actual software copy'; return;
    }
    latest = {row, at:Date.now()};
  };
  function read() {
    if (unknown) throw Error('UNKNOWN ' + unknown + '; no replay');
    if (!latest) throw Error('no observed actual software copy');
    const {row,at} = latest, surface = observation.current(row.surface.slot);
    if (!w.running || w._stopped || w.hostCtx !== ctx || w.renderer !== renderer ||
        w.instance !== instance || ctx.instance !== instance || ctx.exports !== exports || w.memory !== memory ||
        ctx.renderer !== renderer || ctx.sharedGdi !== gdi || observation.current !== currentSurface ||
        gdi.fallbackObservation !== observation || observation.copy !== callback ||
        gdi.presentBestDxOffscreen !== functions.decoder || renderer._repaintOnce !== functions.compositor ||
        [...(w._renderWorkerManager?.ports?.values() || [])].some(port => !port.closed) ||
        row.memory !== w.memory?.buffer || row.window !== renderer.windows?.[row.hwnd] ||
        row.window.wasmMemory !== w.memory || row.window.wasm !== w.instance ||
        row.window.processId !== w.processId || row.window._dxFrameLayer !== row.layer ||
        row.layer.canvas !== row.destination || row.layer.ctx?.canvas !== row.destination ||
        !surface || surface.memory !== row.memory || surface.allocationGeneration !== row.allocationGeneration ||
        ['slot','dibWa','w','h','pitch','bpp'].some(field => surface[field] !== row.surface[field]))
      throw Error('actual software route/owner/allocation changed');
    return {route:'page-software',epoch,processId:w.processId,
      owners:[w,ctx,w.instance,ctx.exports,w.memory,renderer,gdi,observation,
        row.window,row.layer,row.destination,row.layer.ctx,functions.decoder,functions.compositor].map(token),
      hwnd:row.hwnd,slot:row.surface.slot,allocationGeneration:row.allocationGeneration,
      copyGeneration:row.copyGeneration,copyAt:at,readAt:Date.now(),
      width:row.destination.width,height:row.destination.height};
  }
  Object.defineProperty(globalThis,key,{value:Object.freeze({read,functions})});
  observation.copy = callback;
  return {route:'page-software',epoch,installed:true,gateEligible:false};
}

async function evaluate(send, session, expression, byValue = true) {
  const response = await send('Runtime.evaluate',{expression,returnByValue:byValue},session);
  assert(!response.exceptionDetails,
    response.exceptionDetails?.exception?.description || response.exceptionDetails?.text || 'target evaluation failed');
  return byValue ? response.result.value : response.result;
}
async function install({send,session,ownerExpression}) {
  assert(typeof ownerExpression === 'string' && ownerExpression.length, 'explicit actual owner expression required');
  return evaluate(send,session,`(${installInPage})(${ownerExpression},${JSON.stringify(KEY)})`);
}
const stable = value => JSON.stringify({route:value.route,epoch:value.epoch,processId:value.processId,
  owners:value.owners,hwnd:value.hwnd,slot:value.slot,allocationGeneration:value.allocationGeneration,
  width:value.width,height:value.height});

async function read({send,session,scripts,expected,now=Date.now,maxAgeMs=250,sameHostClock=false,record=()=>{}}) {
  assert(sameHostClock === true,'independently verified same-host clock required');
  assert(Number.isFinite(maxAgeMs) && maxAgeMs > 0 && maxAgeMs <= 250, 'software proof age <=250ms');
  const expression = `globalThis[${JSON.stringify(KEY)}].read()`;
  const before = await evaluate(send,session,expression);
  async function source(role) {
    const requestAt = now(); let object;
    try {
      object = await evaluate(send,session,`globalThis[${JSON.stringify(KEY)}].functions.${role}`,false);
      assert(object.type === 'function' && object.objectId, 'actual function object required');
      const properties = await send('Runtime.getProperties',{objectId:object.objectId},session);
      const location = properties.internalProperties?.find(p=>p.name==='[[FunctionLocation]]')?.value?.value;
      assert(location?.scriptId, 'actual function script location required');
      const current = scripts.get(location.scriptId), script = current && {...current}, pin = expected[role];
      assert(script && script.scriptLanguage === 'JavaScript' && script.url === pin?.url &&
        Number.isInteger(script.executionContextId), 'actual owner script/context mismatch');
      const response = await send('Debugger.getScriptSource',{scriptId:location.scriptId},session);
      assert(typeof response.scriptSource === 'string' && response.scriptSource.length, 'complete uncached JavaScript source required');
      const hash = sha(Buffer.from(response.scriptSource,'utf8'));
      assert.equal(hash,pin.sha256,'actual owner module bytes changed');
      assert(['url','executionContextId','scriptLanguage'].every(field=>
        scripts.get(location.scriptId)?.[field] === script[field]),'actual owner script retired or changed during response');
      const proof = {role,kind:'JavaScript',session,scriptId:location.scriptId,
        executionContextId:script.executionContextId,url:script.url,sha256:hash,
        bytes:Buffer.byteLength(response.scriptSource),requestAt,responseAt:now(),uncached:true};
      await record(proof); return proof;
    } finally {
      if (object?.objectId) await send('Runtime.releaseObject',{objectId:object.objectId},session);
    }
  }
  // Independent actual owners, drained even when one lane fails.
  const lanes = await Promise.allSettled(['decoder','compositor'].map(source));
  for (const lane of lanes) if (lane.status === 'rejected') throw lane.reason;
  const after = await evaluate(send,session,expression);
  assert.equal(stable(after),stable(before),'software owner changed during uncached reads');
  assert(lanes[0].value.executionContextId === lanes[1].value.executionContextId,'software owners in different contexts');
  assert(after.copyGeneration >= before.copyGeneration,'copy generation regressed');
  const age = now()-after.copyAt;
  assert(Number.isFinite(age) && age >= 0 && age <= maxAgeMs,'stale actual software copy');
  return {owner:after,responses:lanes.map(lane=>lane.value),gateEligible:false,
    refusal:'JavaScript software ownership proof does not satisfy the existing four guest/render WASM response contract'};
}
function createAttestor(options) {
  let closed = false, owner = null, generation = 0;
  return {
    get closed() { return closed; },
    async read() {
      assert(!closed,'UNKNOWN software attestor closed; no replay');
      try {
        const proof = await read(options), current = stable(proof.owner);
        if (owner !== null) assert.equal(current,owner,'software owner epoch changed between reads');
        assert(proof.owner.copyGeneration >= generation,'software copy generation regressed between reads');
        owner = current; generation = proof.owner.copyGeneration;
        return proof;
      } catch (error) { closed = true; throw error; }
    },
  };
}
module.exports = {install,read,createAttestor,installInPage,KEY,stable};
