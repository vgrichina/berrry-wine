'use strict';
// One deadline for the whole observation. Diagnostics are local writes only;
// UNKNOWN never triggers a final endpoint inspection or adopts late pixels.
async function completeCapture({requestTicket,readTicket,captureHost,retain,close,record,
  wait=ms=>new Promise(r=>setTimeout(r,ms)),now=Date.now,
  timers={set:setTimeout,clear:clearTimeout}}) {
  const started=now();let closed=false,phase='request-ticket',timer;
  const live=()=>{if(closed||now()-started>=3000)throw Error('DISPLAY_UNKNOWN complete 3000ms deadline; permanently closed');};
  const mark=(next,details={})=>{phase=next;record({phase,at:now(),elapsedMs:now()-started,...details});};
  const terminal=error=>{if(!closed){closed=true;mark('UNKNOWN',{pendingPhase:phase,error:String(error)});close();}};
  try {
    return await Promise.race([
      new Promise((_,reject)=>{timer=timers.set(()=>{const error=Error('DISPLAY_UNKNOWN complete 3000ms deadline; permanently closed');terminal(error);reject(error);},3000);}),
      (async()=>{
        live();mark('request-ticket');await requestTicket();live();mark('read-ticket');
        let shot;
        for(;;){live();shot=await readTicket();live();
          if(shot.status==='complete')break;
          if(shot.status!=='pending')throw Error('DISPLAY_UNKNOWN ticket '+shot.status+': '+shot.error);
          await wait(10);
        }
        mark('ticket-complete',{metadata:shot.metadata,receipt:shot.receipt});
        live();mark('host-capture');const host=await captureHost();live();
        mark('host-complete');await retain(shot,host);live();mark('complete');return shot;
      })()
    ]);
  }catch(error){terminal(error);throw error;}finally{timers.clear(timer);}
}
module.exports={completeCapture};
