'use strict';
// Runs as one request. Diagnostic fields are read before bind; catch never
// asks the page or Worker for more state after the first refusal.
function admission({intent,bound=false}={}){
 const w=window.fixtureWine||runningApps.find(a=>a?.name==='mdk2_demo')?.wine,g=w?._browserNativeInput;
 if(!g)return {state:'WAIT',before:null,reason:'bridge not published'};
 const before=g.snapshot(),r=w.renderer,e=w.instance?.exports,s=before.scene;
 const actor=before.slot===w.guestWorker?.link?.slot?w.guestWorker.link:w.guestWorker?.threadLinks?.get(before.slot);
 const win=r.windows[s?.[2]],gl=w.hostCtx?.getGlGpsBridge?.(),legacy=w.hostCtx?.getD3dimBridge?.(),gps=gl||legacy;
 const identity={processId:w.processId,running:w.running,stopped:!!w._stopped,
  native:s?{thread:s[0],pid:s[1],main:s[2],focus:s[3],modal:s[4],capture:s[5],generation:s.slice(6)}:null,
  actor:{slot:actor?.slot,endpoint:actor?.endpointIdentity,workerPresent:!!actor?.worker,stopped:!!actor?._stopped,stopping:!!actor?._stopping,retired:!!actor?._retirementComplete,transportFailure:!!actor?._transportFailure,writerAmbiguous:!!actor?._writerAmbiguous,moduleMatches:actor?.module===w._wasmModule,memoryMatches:actor?.memory===w.memory},
  window:win?{hwnd:win.hwnd,title:win.title,visible:!!win.visible,processMatches:win.processId===w.processId,instanceMatches:win.wasm===w.instance,memoryMatches:win.wasmMemory===w.memory}:null,
  graphics:{gl:!!gl,legacy:!!legacy,endpoint:!!gps?.endpoint,closed:!!gps?.endpoint?.closed,error:!!gps?.workerAsyncError,closing:!!gps?.workerClosing,epoch:gps?.workerEpoch},
  document:{focus:document.hasFocus(),visibility:document.visibilityState},
  capturePublication:typeof e?.capture_publication_word==='function'?Array.from({length:6},(_,i)=>e.capture_publication_word(i)):null};
 const row={before,identity};
 // A false passive readiness sample grants no authority. Wait only for a new
 // ordinary producer observation, within the caller's unchanged 500ms bound.
 if(!before.ready)return {...row,state:'WAIT'};
 let stage='bind';
 try{
  if(bound)g.release(window.__binding.owner,window.__nonce);
  window.__binding=g.bind();
  if(!intent)return {...row,state:'BOUND',binding:{scene:window.__binding.scene,slot:window.__binding.slot}};
  window.__nonce=intent.nonce;
  stage='prepare';
  const prepared=g.prepare({...intent,owner:window.__binding.owner});
  return {...row,state:prepared.state,prepared};
 }catch(e){return {...row,state:'UNKNOWN',error:String(e),stage};}
}
module.exports={admission};

