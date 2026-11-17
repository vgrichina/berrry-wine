'use strict';
const assert=require('node:assert/strict');
// This result exists only at the synchronous local review fence, before arm,
// prepare or transport. Every other failure belongs to terminal UNKNOWN.
function checkReviewedImage(intent,image,before,current,now=Date.now()) {
 assert(image&&intent.action==='key'&&intent.review?.trim());
 assert(['menu','game'].includes(intent.mode));
 assert(typeof intent.nonce==='string'&&intent.nonce);
 assert(intent.imageSHA256===image.sha256&&Number.isSafeInteger(intent.reviewedAt)&&
   intent.reviewedAt>=image.completedAt&&intent.reviewedAt<=now&&now>=image.completedAt,
   'complete image and personal review join missing');
 for(const state of [before,current])assert(state&&state.terminal===false&&state.phase==='idle'&&
   state.inflight===0&&Number.isSafeInteger(state.transport)&&Number.isSafeInteger(state.down),
   'local zero-dispatch proof missing or unsafe');
 assert.deepEqual(current,before,'operation had transport or side effects');
 const age=now-image.completedAt;
 if(age<(intent.mode==='game'?15000:30000))return null;
 return {outcome:'REFUSED_BEFORE_DISPATCH',reason:'LOCAL_IMAGE_EXPIRED',at:now,
   image:{...image},imageAgeMs:age,invalidatedNonce:intent.nonce,reviewInvalidated:true,
   zeroTransport:true,zeroArmPrepareDown:true,proof:{...current},
   recovery:'explicit fresh complete capture then new whole-image personal review only'};
}
// Executed in the page at complete capture. Recovery cannot silently select a
// replacement owner, generation, worker epoch or host surface.
function pinRecoveryIdentity(wine) {
 const guard=wine._browserNativeInput,r=wine.renderer,b=wine.hostCtx.getGlGpsBridge();
 const state=guard.snapshot(),scene=state.scene?.slice(),slot=state.slot;
 const refs=[wine.instance,wine.memory,wine.memory?.buffer,wine._processObject,wine.guestWorker,
   wine.guestWorker?.link,r,r.canvas,r.presentationCanvas,r.inputQueue,
   r.windows[scene?.[2]],b,b.endpoint,b.workerEpoch,b.device,b.presenter.layer];
 return ()=>{
   const s=guard.snapshot(),rr=wine.renderer,bb=wine.hostCtx.getGlGpsBridge();
   const current=[wine.instance,wine.memory,wine.memory?.buffer,wine._processObject,wine.guestWorker,
     wine.guestWorker?.link,rr,rr.canvas,rr.presentationCanvas,rr.inputQueue,
     rr.windows[s.scene?.[2]],bb,bb.endpoint,bb.workerEpoch,bb.device,bb.presenter.layer];
   if(wine._browserNativeInput!==guard||!s.healthy||s.terminal||!s.bound||wine._stopped||
     bb.endpoint.closed||bb.workerAsyncError||bb.workerClosing||s.slot!==slot||
     !scene||!s.scene||scene.length!==s.scene.length||scene.some((v,i)=>v!==s.scene[i])||
     refs.some((v,i)=>v!==current[i]))throw Error('recovery native owner/epoch/generation changed or UNKNOWN');
   return true;
 };
}
module.exports={checkReviewedImage,pinRecoveryIdentity};
