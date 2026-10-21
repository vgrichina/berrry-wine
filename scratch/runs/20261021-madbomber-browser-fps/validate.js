'use strict';
// Task-specific evidence validator. Authentication of original code and owner is
// a separate live preflight; no Hype addresses, swap counts or display FPS.
function validate(samples,owner,authenticatedOwner=owner){
 const reasons=[];const bad=s=>{if(!reasons.includes(s))reasons.push(s)};
 if(owner!==authenticatedOwner)bad('wrong emitting owner');
 if(!Array.isArray(samples)||samples.length<2)return {accepted:false,fps:null,reasons:['insufficient samples']};
 let prior=null;const first=samples[0],firstRow=first.rows.find(x=>x.owner===owner);
 for(const s of samples){const r=s.rows.find(x=>x.owner===owner);
  if(!r){bad('owner absent');continue;}
  if(s.origin!==first.origin||!Number.isFinite(s.origin))bad('clock origin changed');
  if(!Number.isFinite(r.hostMs)||r.hostMs<0)bad('invalid timestamp');
  if(!Number.isSafeInteger(r.count)||r.count<0)bad('invalid count');
  if(r.addr!==0x403d01||r.pace!==0||r.paced!==0)bad('counter disabled or paced');
  if(!r.sameInstance||r.thread!==firstRow?.thread)bad('owner identity changed');
  if(!s.codeMatches)bad('live code mismatch');
  if(s.events!==0||s.ownerCount!==first.ownerCount)bad('lifecycle or counter mutation');
  if(!s.running||s.active!==1)bad('inactive gameplay');
  if(prior&&(r.hostMs<=prior.hostMs||r.count<prior.count))bad('nonmonotonic count/time');prior=r;
 }
 const last=samples.at(-1).rows.find(x=>x.owner===owner),delta=last?.count-firstRow?.count,ms=last?.hostMs-firstRow?.hostMs;
 if(!(delta>0)||!(ms>0))bad('owner did not emit valid positive delta');
 return {accepted:!reasons.length,reasons,fps:reasons.length?null:1000*delta/ms,logicalFrames:reasons.length?null:delta,durationMs:reasons.length?null:ms,displayFps:null,owner,samples:samples.length};
}
module.exports={validate};
