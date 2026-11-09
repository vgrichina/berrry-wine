'use strict';
// Page-realm adapter for WorkerLink.armQuake2Writer's atomic metadata binding.
// Import/setup does not arm the idle page instance. Boundaries never send RPC.
const {binary}=require('./quake2-frame-writer-witness.cjs');
function attachPage(binding,{maxBoundaries=64,exe=null}={}) {
 const COPIES=['motionFirst.current','motionFirst.published','damageFirst','motionSecond.current','motionSecond.published','damageSecond'];
 const fields=['on','pc','generation','invalid','limit',...['a','b'].flatMap(r=>
 ['lo','hi','epoch','overflow','pc','address','width','host'].map(k=>r+'_'+k))];

 if(!binding||typeof binding.snapshot!=='function')throw Error('owning shared writer unavailable');
 if(!Number.isInteger(maxBoundaries)||maxBoundaries<12||maxBoundaries>1024)throw Error('bounded witness capacity');
 const points=[],intervals=[];
 let invalid=null,step=0;
 const generation=binding.receipt.generation;
 function boundary(copy,edge){
  try{
   if(invalid)return;
   if(points.length>=maxBoundaries)throw Error('boundary capacity exhausted');
   if(copy!==COPIES[Math.floor(step/2)%6]||edge!==(step%2?'after':'before'))throw Error('missing/out-of-order copy boundary');
   step++;
   const values=binding.snapshot();
   if(values.length!==21)throw Error('shared metadata unavailable');
   const raw=Object.fromEntries(fields.map((k,i)=>[k,values[i]>>>0]));
   if(!raw.on||raw.pc||raw.generation!==generation||raw.invalid||raw.a_overflow||raw.b_overflow||
     raw.a_lo!==0xa9ce98||raw.a_hi!==0xa9ce98+240||raw.b_lo!==0xa9cf8c||raw.b_hi!==0xa9cf8c+3840)
    throw Error('reset/rearm/disarm/overflow/range change or execution unsettled');
   const previous=points.at(-1),point={sequence:points.length,copy,edge,raw};
   if(previous){
    const ranges={};
    for(const r of ['a','b']){
     const delta=raw[r+'_epoch']-previous.raw[r+'_epoch'];
     if(delta<0)throw Error('epoch decreased');
     const last=delta?Object.fromEntries(['pc','address','width','host'].map(k=>[k,raw[r+'_'+k]])):null;
     ranges[r==='a'?'current':'publishedRing']={status:delta?'COMPLETED_STORES':'NO_RETAINED_STORE',delta,last,
      nativePC:!!last&&!raw[r+'_host']&&last.pc!==0,history:delta>1?'last completion only; intermediate PCs unavailable':'bounded completion count'};
    }
    intervals.push({from:previous.sequence,to:point.sequence,ranges});
   }
   points.push(point);
  }catch(e){invalid ||= String(e.message);}
 }
 return Object.freeze({boundary,close(){invalid ||= 'observer closed';return binding.close();},snapshot:()=>structuredClone({
  status:invalid?'INVALID':'BOUNDED',reason:invalid,generation,exe,points,intervals,
  completeReaderBoundarySets:Math.floor(points.length/12),pendingBoundarySteps:points.length%12,
  coverage:'actual owning CPU completed gs helpers; atomic shared metadata at existing synchronous copies',
  ordering:'single-pass atomic metadata snapshots; busy/torn/unsettled rejected, no retry; copies remain non-atomic',
  statusScope:'historical retained boundaries only; no current continuity asserted by snapshot',
  limits:{allWriters:'UNKNOWN',aliases:'UNKNOWN',peerCPU:'UNKNOWN',rawHostWrites:'UNKNOWN',hostImports:'UNKNOWN',
   frameABA:'UNKNOWN',parseGeneration:'UNKNOWN',lifetime:'UNKNOWN',boundaryProvenance:'CALLER_SUPPLIED_EXISTING_READER',
   nativeQualification:false},nativeQualification:false})});
}
function attach(binding,options={}){return attachPage(binding,{...options,exe:binary().receipt});}
// Return executable source for the owning page realm. Setup may await the one
// explicit arm command; the installed six-copy observer is entirely synchronous.
function pageSource({globalName,identity,maxBoundaries=64,limit=0,installationToken=null}={}){
 if(typeof globalName!=='string'||!/^[$A-Z_a-z][$\w]{0,127}$/.test(globalName))throw Error('writer witness global name');
 if(!Number.isInteger(maxBoundaries)||maxBoundaries<12||maxBoundaries>1024)throw Error('bounded witness capacity');
 if(!Number.isInteger(limit)||limit<0||limit>2147483647)throw Error('bounded writer limit');
 if(!identity||!Number.isInteger(identity.processId)||!Number.isInteger(identity.endpoint))throw Error('owning page identity');
 if(installationToken!==null&&(typeof installationToken!=='string'||!installationToken))throw Error('installation token');
 const options={maxBoundaries,exe:binary().receipt};
 return `(async()=>{
  const a=runningApps.length===1&&runningApps[0],w=a&&a.wine,identity=${JSON.stringify(identity)};
  if(!w||a.name!=='quake2_demo'||w.processId!==identity.processId||w.guestWorker?.link?.endpointIdentity!==identity.endpoint)
   throw Error('owning page unavailable/replaced');
  const s=globalThis.__mcmPassiveIdentityV1,l=w.guestWorker.link;
  const objects={processObject:w,endpointObject:l,workerObject:l.worker,moduleObject:l.module,pageRendererObject:w.renderer,canvasObject:document.getElementById('screen')};
  if(!s||s.epoch!==identity.epoch||Object.entries(objects).some(([key,value])=>!value||s.ids.get(value)!==identity[key]))throw Error('owning page identity changed');
  if(globalThis[${JSON.stringify(globalName)}])throw Error('writer witness global already bound');
  const key=${JSON.stringify(globalName)},token=${JSON.stringify(installationToken)};
  let cancelled=false,binding,finish;
  const settled=new Promise(resolve=>{finish=resolve;});
  const pending={installationToken:token,close(){cancelled=true;return settled;}};
  globalThis[key]=pending;
  try{
   binding=await w.armQuake2WriterObservation(${JSON.stringify({limit})});
   if(cancelled||globalThis[key]!==pending||runningApps.length!==1||runningApps[0]!==a||a.wine!==w||!w.running||w._stopped||
    w.processId!==identity.processId||w.guestWorker?.link!==l||l.endpointIdentity!==identity.endpoint||
    globalThis.__mcmPassiveIdentityV1!==s||s.epoch!==identity.epoch||
    Object.entries(objects).some(([key,value])=>!value||s.ids.get(value)!==identity[key])||
    l.worker!==objects.workerObject||l.module!==objects.moduleObject||w.renderer!==objects.pageRendererObject||
    document.getElementById('screen')!==objects.canvasObject)throw Error('owning page replaced during arm');
   // Validate the actual host binding before installing any reader callback.
   binding.snapshot();
   const observer=(${attachPage.toString()})(binding,${JSON.stringify(options)});
   globalThis[key]=Object.freeze({...observer,installationToken:token});
   return {status:'ARMED',generation:binding.receipt.generation,nativeQualification:false};
  }catch(e){
   try{await binding?.close();}catch(_){} // Preserve the first setup failure.
   if(globalThis[key]===pending)delete globalThis[key];
   throw e;
  }finally{finish();}
 })()`;
}
module.exports={attach,attachPage,pageSource};
