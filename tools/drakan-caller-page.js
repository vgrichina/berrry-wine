'use strict';
// Installed before any compile. Observes native DOM delivery; never sends input.
window.WINE_DRAKAN_OBSERVER=true;
(() => {
 const s=window.__drakanCaller={events:[],used:false};
 let started;
 addEventListener('keydown',e=>{if(e.code==='KeyT'&&e.isTrusted&&!e.repeat)started=performance.timeOrigin+performance.now();},true);
 s.bridge=(token)=>new Promise((resolve,reject)=>{s.pending={token,resolve,reject};__drakanReleaseRequest(JSON.stringify({token}));});
 s.ack=(token,error,receipt)=>{if(s.pending?.token!==token)throw Error('release ownership mismatch');const p=s.pending;s.pending=null;if(error)p.reject(Error(error));else p.resolve(receipt);};
 for(const type of ['keydown','keyup'])addEventListener(type,e=>{
  const row={type:e.type,key:e.key,code:e.code,trusted:e.isTrusted,domTimestamp:e.timeStamp,at:performance.timeOrigin+performance.now()};s.events.push(row);
  if(e.code!=='KeyT'||e.type!=='keydown'||!s.armed)return;
  if(s.used)throw Error('second original T refused');s.used=true;
  s.outcome=(async()=>{
   try {
    if(!e.isTrusted||e.repeat||!Number.isFinite(started))throw Error('actual trusted original down required');
    const a=runningApps[0],w=a.wine,r=w.renderer,events=[];
    for(const ref of r._diKeyboardClients||[])for(const [device,b] of ref.deref()||[]){if(!b.active)continue;for(let n=0;n<b.length;n++){const x=b.events[(b.head+n)%b.capacity];if(x.key===0x154)events.push({device,...x});}}
    if(events.length!==1||events[0].device!==s.armed.keyboardDevice)throw Error('unique actual T down timestamp absent');
    s.down={...row,actionStartedAt:started,record:events[0]};
    const result=await w.observeDrakanActor({...s.armed,timestamp:events[0].stamp,actionStartedAt:started,releaseT:()=>s.bridge(s.armed.token)});
    return {ok:true,result,down:s.down,events:s.events};
   }catch(error){return {ok:false,error:String(error),releaseError:error.releaseError??null,down:s.down,events:s.events};}
  })();
 },false);
})();
