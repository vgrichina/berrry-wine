'use strict';
// Explicit optional diagnostic for a newly built USER producer. Input policy,
// native receipt validation and physical release remain in the input controller.
const native = require('../lib/native-user-causal-observer');
const POLICY = Object.freeze({nativeMs:500,sourceMs:30000,reviewMs:15000,
  freshFrameMs:5000,maxHoldMs:1500,completeFrame:true,privateIdentity:true,physicalUp:true});
function startObserved(link, {workerPrototype, module, memory, workerSHA256, verifiedWorkerSHA256, capacity=8192}) {
  if (!link || link.worker || link.slot !== 0 || link.module !== module || link.memory !== memory ||
      !/^[a-f0-9]{64}$/.test(workerSHA256 || '') || workerSHA256 !== verifiedWorkerSHA256)
    throw Error('exact qualified Worker/module/memory required before start');
  if (!native.ABI.every(n=>WebAssembly.Module.exports(module).some(e=>e.name===n)))
    throw Error('new native USER causal ABI required; historical module cannot qualify');
  const config=native.configuration(capacity), post=workerPrototype.postMessage;
  let matches=0, worker=null, endpoint=null, used=false, closed=false, armReceipt=null;
  const interceptor=function(message,...rest) {
    if(this===link.worker && message?.t==='init' && message.module===module &&
        message.memory===memory && message.slot===0 && message.endpointIdentity===link.endpointIdentity) {
      if(++matches!==1) throw Error('duplicate owning Worker initialization');
      worker=this;endpoint=message.endpointIdentity;
      return post.call(this,{...message,nativeUserCausal:config},...rest);
    }
    return post.call(this,message,...rest);
  };
  if(typeof post!=='function')throw Error('Worker transport required');
  let ready;
  workerPrototype.postMessage=interceptor;
  try {ready=link.start();}
  finally {if(workerPrototype.postMessage===interceptor)workerPrototype.postMessage=post;}
  if(matches!==1)throw Error('owning Worker init not intercepted');
  const same=()=>link.worker===worker&&link.module===module&&link.memory===memory&&
    link.endpointIdentity===endpoint&&!link._stopped&&!link._stopping&&!link._transportFailure;
  return {config,ready,policy:POLICY,
    async prearm(nonce) {
      if(closed||used||!same())throw Error('closed/replaced native causal owner');
      if(!/^[a-f0-9]{16}$/.test(nonce || ''))throw Error('exact 64-bit native input nonce required');
      used=true;await ready;
      if(!same())throw Error('native causal owner replaced before arm');
      armReceipt=await link._ask({t:'nativeUserCausal',action:'arm',nonce,endpointIdentity:endpoint});
      if(!same()||!armReceipt.armed||armReceipt.endpointIdentity!==endpoint)throw Error('native causal arm refused');
      return {nonce,endpointIdentity:endpoint,workerSHA256,imports:armReceipt.imports};
    },
    // Local reads are sufficient while the CPU is busy/blocked. This function
    // never calls a page, Worker, socket, native export, or input endpoint.
    retained() {return {...native.snapshot(config),imports:armReceipt?.imports || null};},
    firstUnknown(reason) {closed=true;return {reason,closed:true,laterRequests:0,
      trace:native.snapshot(config),imports:armReceipt?.imports || null};},
  };
}
module.exports={POLICY,startObserved};
