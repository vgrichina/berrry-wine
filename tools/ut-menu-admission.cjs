'use strict';
// Serialize this function into the task's single page request. Observations
// confer no input authority; the production guard alone releases/binds/prepares.
function admission({intent,bound=false,wait=true}={}) {
 const w=window.fixtureWine||window.__hosts?.find(w=>w.running),g=w?._browserNativeInput;
 if(!g)return {state:'WAIT',stage:'publication',bound,observations:[]};
 const observations=[];
 function sample(stage){
  const guard=g.snapshot(),e=w.instance?.exports,r=w.renderer,s=guard.scene;
  const actor=guard.slot===w.guestWorker?.link?.slot?w.guestWorker.link:w.guestWorker?.threadLinks?.get(guard.slot);
  const gl=w.hostCtx?.getGlGpsBridge?.(),legacy=w.hostCtx?.getD3dimBridge?.(),gps=gl||legacy;
  const refs=window.__utAdmissionRefs||(window.__utAdmissionRefs={map:new WeakMap(),next:1});
  const id=v=>{if(v===null||v===undefined)return null;if(typeof v!=='object'&&typeof v!=='function')return v;
   if(!refs.map.has(v))refs.map.set(v,refs.next++);return refs.map.get(v);};
  const native=h=>{if(!h)return null;return {hwnd:h,live:!!e?.wnd_lookup_live?.(h),
   generation:String(e?.wnd_lookup_generation?.(h)),thread:e?.get_window_thread?.(h),
   parent:e?.wnd_get_parent?.(h),owner:e?.wnd_get_owner?.(h),top:e?.wnd_top_level?.(h)};};
  const win=r?.windows[s?.[2]],hi=w.guestWorker?.hostImports;
  const row={stage,guard,at:Date.now(),monoAt:performance.timeOrigin+performance.now(),
   caller:{bound,binding:window.__binding?{owner:window.__binding.owner,scene:window.__binding.scene,slot:window.__binding.slot}:null,
    lastNonce:window.__lastNonce||null},
   identities:Object.fromEntries(Object.entries({renderer:r,context:w.hostCtx,module:w._wasmModule,memory:w.memory,
    buffer:w.memory?.buffer,process:w._processObject,instance:w.instance,worker:w.guestWorker,link:w.guestWorker?.link,
    actor,actorWorker:actor?.worker,actorModule:actor?.module,actorMemory:actor?.memory,hostImports:hi,
    inputSite:hi?.check_input,validateSite:hi?.input_validate,consumedSite:hi?.input_consumed,
    window:win,windowInstance:win?.wasm,windowMemory:win?.wasmMemory,gps,gl,legacy,endpoint:gps?.endpoint}).map(([k,v])=>[k,id(v)])),
   process:{pid:w.processId,running:w.running,stopped:!!w._stopped,exited:!!w._processObject?.exited},
   actor:{slot:actor?.slot,endpoint:actor?.endpointIdentity,stopped:!!actor?._stopped,stopping:!!actor?._stopping,
    retired:!!actor?._retirementComplete,transportFailure:!!actor?._transportFailure,writerAmbiguous:!!actor?._writerAmbiguous},
   native:{scene:s?.slice(),main:native(s?.[2]),focus:native(s?.[3]),capture:native(s?.[5]),
    lastInvocation:window.__lastNativeReceipt||null,
    shadowFocus:e?.get_focus_hwnd?.(),dialog:e?.dialogbox_hwnd?.(),
    capturePublication:typeof e?.capture_publication_word==='function'?Array.from({length:6},(_,i)=>e.capture_publication_word(i)):null},
   graphics:{closed:!!gps?.endpoint?.closed,error:!!gps?.workerAsyncError,closing:!!gps?.workerClosing,epoch:gps?.workerEpoch},
   document:{focus:document.hasFocus(),visibility:document.visibilityState}};
  observations.push(row);return guard;
 }
 let stage='release';
 try{
  let before=sample(bound?'before-release':'before-bind');
  if(bound){window.__retired=g.release(window.__binding.owner,window.__lastNonce);bound=false;before=sample('before-bind');}
  // Wait for an ordinary new producer sample. No bind attempt on false ready.
  // Already-bound and terminal are refusals, never readiness retries.
  if(wait&&!before.ready&&!before.bound&&!before.terminal)return {state:'WAIT',stage:'readiness',bound,observations};
  stage='bind';window.__binding=g.bind();bound=true;
  if(!intent)return {state:'BOUND',bound,observations,binding:window.__binding};
  stage='prepare';sample('before-prepare');window.__lastNonce=intent.nonce;
  const prepared=g.prepare({...intent,owner:window.__binding.owner});
  return {state:prepared.state,bound,observations,prepared};
 }catch(e){
  // Do not query guard, native exports, or endpoints after the first refusal.
  return {state:'UNKNOWN',stage,bound,observations,error:String(e)};
 }
}
module.exports={admission};
