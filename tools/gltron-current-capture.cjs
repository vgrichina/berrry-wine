'use strict';
// One deadline for the whole observation. Diagnostics are local writes only;
// UNKNOWN never triggers a final endpoint inspection or adopts late pixels.
async function completeCapture({requestTicket,readTicket,captureHost,transportTicket=async shot=>shot,retain,close,record,
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
        // The ticket's immutable publication has already been selected. Its
        // byte transport and the later host screenshot are independent reads;
        // join both under the same original deadline before retaining either.
        live();mark('host-capture');const [host,transported]=await Promise.all([captureHost(),transportTicket(shot)]);live();
        shot={...shot,...transported};
        mark('host-complete');await retain(shot,host);live();mark('complete');return shot;
      })()
    ]);
  }catch(error){terminal(error);throw error;}finally{timers.clear(timer);}
}
// Fixed filter 0 avoids row-filter search on the single 3000ms budget.
// Fast lossless deflate bounds compression effort while avoiding stored-RGBA
// artifact growth. Dimensions and every RGBA byte (including hidden RGB) stay exact.
function encodeCapturePNG(width,height,rgba) {
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0||
    width*height>16777216||rgba.length!==width*height*4)throw Error('invalid complete RGBA capture');
  return require('pngjs').PNG.sync.write({width,height,data:Buffer.from(rgba)},
    {filterType:0,deflateLevel:1,deflateStrategy:0});
}
module.exports={completeCapture,encodeCapturePNG};
