'use strict';
// Observe the actual retained hold helper without changing its timer, sends,
// sampling order or failure semantics. A CDP reply is not a guest held read.
async function observeHold({hold, save, ...options}) {
  const events=[];
  const started=Date.now(), origin=performance.now();
  const at=()=>({at:Date.now(),elapsedMs:performance.now()-origin});
  const send=(method,params,session)=>{
    const event={method,type:params.type,key:params.key,session,dispatch:at()};
    events.push(event);
    try {
      return Promise.resolve(options.send(method,params,session)).then(value=>{
        event.response={...at(),ok:true};return value;
      },error=>{event.response={...at(),ok:false,error:String(error)};throw error;});
    } catch(error) {event.response={...at(),ok:false,error:String(error)};throw error;}
  };
  try {
    const receipt=await hold({...options,send});
    save({started,finished:at(),holdMs:options.holdMs,events,ok:true,receipt});
    return receipt;
  } catch(error) {
    try {
      save({started,finished:at(),holdMs:options.holdMs,events,ok:false,
        error:String(error),receipt:error.holdReceipt??null});
    } catch(evidenceError) {error.deliveryEvidenceError=String(evidenceError);}
    throw error;
  }
}
module.exports={observeHold};
