'use strict';
const assert = require('node:assert/strict');
const KEYS = {ArrowUp:38,ArrowDown:40,ArrowLeft:37,ArrowRight:39,Enter:13,Escape:27,Tab:9,Control:17,Space:32,w:87,p:80,a:65,',':188,'.':190};

// CDP submissions and replies are observations of this caller only. Neither
// one supplies application time, an actual held interval, or guest polls.
async function hold({send, session, keys, holdMs, sample, saveSample=()=>{},
  record=()=>{}, saveReceipt=()=>{}, onFailure=()=>{}}) {
  assert(Array.isArray(keys) && (keys.length===1 || keys.length===2 && keys[0]==='a' && ['Control','Space'].includes(keys[1])), 'ordinary key or throttle plus steering');
  assert(keys.every(k=>Object.hasOwn(KEYS,k)) && new Set(keys).size===keys.length);
  assert(Number.isInteger(holdMs) && holdMs>=50 && holdMs<=2000, 'bounded physical hold');
  assert.equal(typeof sample,'function','passive in-hold sampler required');
  const samples=[], attempted=[], events=[];
  const receipt={holdMs,state:'ARMED',
    samples,attempted,events,applicationTiming:'UNKNOWN',actualHeldInterval:'UNKNOWN',guestPolls:'UNKNOWN'};
  let started, origin, failure, timer, timerWait, releasePromise, stop;
  const stopped=new Promise((_,reject)=>{stop=reject;});
  // Keep the cancellation race observed even before the first send settles.
  stopped.catch(()=>{});
  const stamp=()=>({at:Date.now(),elapsedMs:performance.now()-origin});
  function persist() {
    try {record(receipt);saveReceipt(receipt);}
    catch(error) {
      receipt.deliveryEvidenceError=String(error);
      if(!failure)fail(error);
    }
  }
  function fail(error) {
    if(failure)return failure;
    failure=error instanceof Error?error:Error(String(error));
    receipt.firstFailure={...stamp(),error:String(failure)};
    failure.holdReceipt=receipt;
    // Release is initiated before terminal admission closes. Each attempted
    // key gets exactly one UP, even if another UP reply never arrives.
    release();
    persist();
    stop(failure);
    onFailure(failure);
    return failure;
  }
  function dispatch(type,base) {
    const event={type,key:base.key,submission:stamp(),reply:null,application:'UNKNOWN'};
    events.push(event);
    let pending;
    try {pending=send('Input.dispatchKeyEvent',{type,...base},session);}
    catch(error) {pending=Promise.reject(error);}
    persist();
    return Promise.resolve(pending).then(value=>{
      event.reply={...stamp(),ok:true,meaning:'matching successful CDP reply; application time UNKNOWN'};
      if(type==='keyDown')receipt.downCompletedAt=event.reply.at;
      else {receipt.upCompletedAt=event.reply.at;receipt.state='ACTUAL_UP_COMPLETED';}
      persist();return value;
    },error=>{event.reply={...stamp(),ok:false,error:String(error),meaning:'send promise rejected; protocol reply and application time UNKNOWN'};persist();throw error;});
  }
  const bases=[];
  function release() {
    if(releasePromise)return releasePromise;
    receipt.releaseAt=receipt.upAttemptedAt=Date.now();
    // Reserve the promise before invoking any possibly synchronous send.
    let settled;
    releasePromise=new Promise(resolve=>{settled=resolve;});
    const releases=[...bases].reverse().map(base=>dispatch('keyUp',base).catch(error=>{fail(error);}));
    Promise.all(releases).then(settled,error=>{fail(error);settled();});
    return releasePromise;
  }
  try {
    // The origin remains before the first DOWN submission, never its reply.
    started=Date.now();origin=performance.now();
    timer=setTimeout(()=>{
      release();
      if(events.some(e=>e.type==='keyDown'&&!e.reply))fail(Error('input delivery exceeded hold bound; DOWN reply UNKNOWN'));
    },holdMs);
    Object.assign(receipt,{started,dueAt:started+holdMs,armedAt:Date.now()});
    persist();
    for(const key of keys) {
      if(releasePromise)throw Error('input delivery exceeded hold bound');
      const base={key:key==='Space'?' ':key,code:({Control:'ControlLeft',a:'KeyA',p:'KeyP',w:'KeyW',',':'Comma','.':'Period'})[key]||key,windowsVirtualKeyCode:KEYS[key]};
      bases.push(base);attempted.push(base.key);
      await Promise.race([dispatch('keyDown',base),stopped]);
      assert(!releasePromise,'input delivery exceeded hold bound');
    }
    while(!releasePromise) {
      const began=Date.now(), value=await Promise.race([Promise.resolve().then(sample),stopped]);
      if(failure)throw failure;
      const row={phase:'held',started:began,finished:Date.now(),...value};
      samples.push(row);await Promise.race([Promise.resolve(saveSample(row)),stopped]);
      if(!releasePromise)await Promise.race([new Promise(resolve=>{
        timerWait=setTimeout(resolve,Math.min(100,Math.max(1,holdMs-(Date.now()-started))));
      }),stopped]);
    }
    await Promise.race([release(),stopped]);
  } catch(error) {fail(error);}
  finally {
    clearTimeout(timer);clearTimeout(timerWait);
    // onFailure synchronously closes the production pending map. Await those
    // actual rejections/replies; never turn them into a successful ACK.
    await release();
    receipt.completionPromiseSettledAt=Date.now();
    for(const s of samples)s.whollyDuringHold=s.started>=started&&s.finished<receipt.releaseAt;
    receipt.ok=!failure;
    persist();
  }
  if(failure)throw failure;
  return receipt;
}
module.exports={hold};
