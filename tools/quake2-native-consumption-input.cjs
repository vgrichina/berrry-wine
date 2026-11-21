'use strict';
const path=require('node:path');
const ROOT=process.env.WINE_BRIDGE_ROOT||path.resolve(__dirname,'..');
const supported=require(ROOT+'/tools/gltron-current-native-input.cjs');
const {verifyPageEquivalence}=require(ROOT+'/lib/browser-reviewed-frame-equivalence.cjs');
const POLICY=Object.freeze({reviewMs:5000,nativeMs:500,releaseFallbackMs:1750,maxHoldMs:1500});
// Derived from the released Hexen bridge candidate, with Quake II scope.
// Installed at the end of the served host.js, before any shell launch. The
// existing observer retains getImports' actual host table and captured context.
function hostBootstrap(){
  return `\n;globalThis.WINE_BROWSER_NATIVE_INPUT=true;\n${supported.installNativeRouteObserver.toString()}\n${supported.inspectNativeRoute.toString()}\n${supported.observeAndBindNativeOwner.toString()}\n${supported.observeAndPrepareNativeIntent.toString()}\n${verifyPageEquivalence.toString()}\n${createQuake2Session.toString()}\ninstallNativeRouteObserver(globalThis,WineAssembly);\nglobalThis.createQuake2NativeSession=(w,options)=>createQuake2Session(globalThis,w,{inspectNativeRoute,observeAndBindNativeOwner,observeAndPrepareNativeIntent,verifyPageEquivalence},options);\n`;
}
// Page-local object identities are never serialized into authority. Numeric
// HWND/generation metadata is additional to process/module/memory/Worker refs.
function createQuake2Session(root,wine,helpers,{equivalenceKey}={}){
  wine._requireAuthoritativeCapture=true;
  if(equivalenceKey)wine._requireReviewedFrameEquivalence=true;
  let terminal=false,binding=null,refs=null,scene=null,slot=null;
  const nonces=new Set();
  let viewport=null;
  const geometry=()=>JSON.stringify([root.innerWidth,root.innerHeight,root.devicePixelRatio,
    root.visualViewport?.width,root.visualViewport?.height,root.visualViewport?.offsetLeft,root.visualViewport?.offsetTop,
    wine.renderer?.canvas?.width,wine.renderer?.canvas?.height,
    wine.renderer?.canvas?.getBoundingClientRect?.().toJSON(),root.document?.hasFocus(),root.document?.visibilityState]);
  const current=()=>{
    const r=wine.renderer,g=wine.hostCtx?.getGlGpsBridge?.();
    const s=wine._browserNativeInput?.snapshot();
    return [wine.hostCtx,wine.instance,wine._wasmModule,wine.memory,wine.memory?.buffer,
      wine._processObject,wine.guestWorker,wine.guestWorker?.link,r,r?.canvas,r?.presentationCanvas,
      r?.inputQueue,r?.windows[s?.scene?.[2]],g,g?.endpoint,g?.workerEpoch,g?.device,
      g?.presenter?.layer,g?.presenter?.layer?.canvas];
  };
  const close=reason=>{terminal=true;wine._browserNativeInput?.close(reason);};
  function check(admitting=true){
    if(terminal)throw Error('QUAKE2_NATIVE_UNKNOWN permanently closed');
    if(equivalenceKey&&(root.document?.hasFocus?.()!==true||root.document?.visibilityState!=='visible'))
      throw Error('QUAKE2_NATIVE_UNKNOWN reviewed document not focused/visible');
    if(equivalenceKey&&viewport!==null&&geometry()!==viewport)throw Error('QUAKE2_NATIVE_UNKNOWN viewport/focus changed');
    const e=wine.instance?.exports;
    if(!e?.capture_publication_word||!e.get_authoritative_capture_hwnd||
      !e.wnd_lookup_live||!e.wnd_lookup_generation||!e.get_window_thread)
      throw Error('QUAKE2_NATIVE_UNKNOWN authoritative capture exports unavailable');
    const audit=helpers.inspectNativeRoute(root,wine),s=audit.bridge;
    const rows=(root.__gltronNativeRoutes||[]).filter(r=>r.wine===wine);
    if(rows.some(r=>r.ctx!==wine.hostCtx||r.ctx.guardedInput!==wine._browserNativeInput||
      r.host.browserInputScope!==wine._browserNativeInput))throw Error('QUAKE2_NATIVE_UNKNOWN import authority changed');
    const g=wine.hostCtx?.getGlGpsBridge?.();
    if(binding&&(!g?.endpoint||g.endpoint.closed||g.workerAsyncError||g.workerClosing))
      throw Error('QUAKE2_NATIVE_UNKNOWN render endpoint retired');
    if(!audit.running||audit.stopped||!audit.guestWorker||!audit.scopes.length||
      audit.scopes.some(v=>!v.currentContext||!v.guardedInput||!v.nativeInputActor||!v.tokenImport||!v.consumedImport)||
      !s?.healthy||s.terminal)throw Error('QUAKE2_NATIVE_UNAVAILABLE actual imports/owning Worker');
    // Context describes the bound owner without admitting input. Reuse the
    // bridge's exact structural predicates; older bridges remain strict.
    const eligible=admitting?s.ready:(s.readiness?.observationReady??s.ready);
    if(binding&&!eligible)throw Error('QUAKE2_NATIVE_UNKNOWN authoritative owner no longer ready');
    if(refs&&(current().some((v,i)=>v!==refs[i])||s.slot!==slot||
      !s.scene||s.scene.some((v,i)=>v!==scene[i])))throw Error('QUAKE2_NATIVE_UNKNOWN owner/focus/modal/source/context changed');
    return s;
  }
  function guarded(fn){try{return fn();}catch(e){close(e.message);throw e;}}
  return {
    observe(){return guarded(()=>{const s=check();if(binding)return s;
      const state=helpers.observeAndBindNativeOwner(wine);
      if(state.binding){binding=state.binding;refs=current();scene=state.scene.slice();slot=state.slot;
        if(equivalenceKey){viewport=geometry();for(const type of ['blur','resize','pagehide'])root.addEventListener?.(type,()=>close('review context '+type),{once:true});}}
      return state;});},
    // Page closure owns the HMAC key, native owner refs and nonce tombstones.
    // This is a new targeting invocation, never a restart of an old ticket.
    async prepareEquivalent(intent,notBefore,envelope){try{
      check();if(!binding||!equivalenceKey)throw Error('equivalence not explicitly enabled/bound');
      const proof=await helpers.verifyPageEquivalence(equivalenceKey,envelope,intent);check();
      if(JSON.stringify(proof.identity.native)!==JSON.stringify({scene:scene.slice(),slot,viewport:geometry(),owner:binding.owner}))
        throw Error('equivalence native context mismatched');
      if(nonces.has(intent.nonce))throw Error('equivalence nonce reused');
      if(!Number.isSafeInteger(notBefore))throw Error('equivalence invalid USER observation bound');
      // Only this opt-in path requires a USER observation strictly after the
      // authenticated fresh capture completed. A caller can tighten this
      // boundary, never weaken it to the old reviewed source timestamp.
      const state=helpers.observeAndPrepareNativeIntent(wine,{...intent,owner:binding.owner,reviewed:true},
        Math.max(notBefore,proof.fresh.completedAt));
      if(state.prepared){nonces.add(intent.nonce);if(state.prepared.state!=='PREPARED')throw Error('equivalence native prepare refused');
        state.reviewEquivalence={source:proof.source,fresh:proof.fresh,id:proof.id};}
      return state;
    }catch(e){close(e.message);throw e;}},
    context(){return guarded(()=>{const s=check(false);if(!binding)throw Error('unbound review context');
      return {scene:s.scene,slot:s.slot,viewport:geometry(),owner:binding.owner};});},
    prepare(intent,notBefore){return guarded(()=>{
      check();if(!binding)throw Error('QUAKE2_NATIVE_UNAVAILABLE unbound');
      const now=Date.now();
      if(!intent.review?.trim()||!Number.isSafeInteger(intent.completedAt)||!Number.isSafeInteger(intent.reviewedAt)||
        intent.completedAt>intent.reviewedAt||intent.reviewedAt>now||now-intent.completedAt>=5000||
        nonces.has(intent.nonce))throw Error('QUAKE2_NATIVE_UNKNOWN stale review or nonce');
      const state=helpers.observeAndPrepareNativeIntent(wine,{...intent,owner:binding.owner,reviewed:true},notBefore);
      if(state.prepared){nonces.add(intent.nonce);if(state.prepared.state!=='PREPARED')throw Error('QUAKE2_NATIVE_UNKNOWN refused prepare '+JSON.stringify(state.prepared));}
      return state;
    });},
    status(nonce){return guarded(()=>{check();if(!nonces.has(nonce))throw Error('QUAKE2_NATIVE_UNKNOWN unprepared nonce');
      const proof=wine._browserNativeInput.status(nonce);
      if(['CANCELLED','UNKNOWN'].includes(proof.state))close('native input refused: '+JSON.stringify(proof));
      return proof;});},close,
  };
}
function reviewed(intent,image){
  const now=Date.now();
  if(!image||!intent.review?.trim()||intent.imageSHA256!==image.sha256||
    !/^[a-f0-9]{64}$/.test(image.sha256)||!Number.isSafeInteger(image.completedAt)||
    !Number.isSafeInteger(intent.reviewedAt)||intent.reviewedAt<image.completedAt||intent.reviewedAt>now||
    now-image.completedAt<0||now-image.completedAt>=POLICY.reviewMs)
    throw Error('QUAKE2_NATIVE_UNKNOWN complete image review expired/mismatched');
  exactEdge(intent);
}
function exactEdge(intent){
  if(!['key','mouse'].includes(intent.kind)||!Number.isInteger(intent.code)||intent.code<1||intent.code>254||
    (intent.kind==='mouse'&&(intent.code!==1||intent.button!==0||!Number.isFinite(intent.x)||!Number.isFinite(intent.y)))||
    !Number.isInteger(intent.ms)||intent.ms<50||intent.ms>POLICY.maxHoldMs||
    typeof intent.nonce!=='string'||!intent.nonce||!/^action-\d+$/.test(intent.name)||
    (intent.kind==='key'&&(typeof intent.key!=='string'||typeof intent.domCode!=='string'))||!['menu','game'].includes(intent.mode))
    throw Error('QUAKE2_NATIVE_UNKNOWN unsupported exact edge');
}
// One runtime scope, explicit per-edge personal review, no retries. Close is
// controller-local and synchronous: it must retire transport, not query it.
function createController({page,dispatch,release,close,record=()=>{},equivalence}){
  let terminal=false,active=false;const nonces=new Set();
  const stop=reason=>{if(!terminal){terminal=true;close(reason);}};
  const gate=()=>{if(terminal)throw Error('QUAKE2_NATIVE_UNKNOWN permanently closed');};
  async function call(method,...args){gate();const at=Date.now();
    try{const result=await page(method,...args);record({method,at,receivedAt:Date.now(),late:terminal,result});gate();return result;}
    catch(e){stop(e.message);throw e;}}
  return {get terminal(){return terminal;},close:stop,
    async bind(deadline){gate();try{return await supported.waitForNativeOwner({deadline,
      observe:()=>call('observe'),close:()=>stop('native owner UNKNOWN'),record});}
      catch(e){stop(e.message);throw e;}},
    async gesture(intent,image,proofHandle){
      gate();let armed=false,armReceipt=null,downStarted=false,nativeError=null,proof=null,up=null;
      const equivalent=proofHandle!==undefined;
      const reviewCheck=()=>{exactEdge(intent);if(equivalent){if(!equivalence)throw Error('equivalence unavailable');
        equivalence.validate(proofHandle,intent,image);}else reviewed(intent,image);};
      try{
        if(active||nonces.has(intent.nonce))throw Error('QUAKE2_NATIVE_UNKNOWN concurrent/stale nonce');
        reviewCheck();active=true;nonces.add(intent.nonce);
        armReceipt=await release.arm(intent);armed=true;gate();reviewCheck();
        const releaseGate=()=>{
          if(!Number.isSafeInteger(armReceipt?.at)||!Number.isSafeInteger(armReceipt?.fallback)||
            !Number.isSafeInteger(armReceipt?.releaseDue)||armReceipt.fallback-armReceipt.at!==1750||
            Date.now()>=armReceipt.releaseDue||Date.now()+intent.ms>=armReceipt.fallback||release.alive===false)
            throw Error('QUAKE2_NATIVE_UNKNOWN independent release window expired/unavailable');
        };
        releaseGate();
        let state,start;
        const until=equivalent?Date.now()+POLICY.nativeMs:image.completedAt+POLICY.reviewMs;
        do{
          gate();reviewCheck();releaseGate();start=Date.now();
          state=equivalent?await call('prepareEquivalent',{...intent,completedAt:image.completedAt},image.completedAt,proofHandle):
            await call('prepare',{...intent,completedAt:image.completedAt},image.completedAt);
          if(!state.prepared)await new Promise(r=>setTimeout(r,5));
        }while(!state.prepared&&Date.now()<until);
        if(!state.prepared)throw Error('QUAKE2_NATIVE_UNKNOWN no new native USER observation');
        gate();reviewCheck();
        // The controller bound starts before prepare, including its transport;
        // the guard independently starts 500ms at its actual prepare call.
        proof=await supported.waitForNativeConsumption({deadline:start+POLICY.nativeMs,
          close:()=>stop('DOWN/native 500ms UNKNOWN'),record,
          dispatch:async()=>{gate();reviewCheck();releaseGate();
            if(equivalent){await equivalence.beforeDown(proofHandle,intent,image);gate();reviewCheck();releaseGate();}
            downStarted=true;const at=Date.now();
            try{const ack=await dispatch(intent);record({method:'DOWN',at,receivedAt:Date.now(),late:terminal,transportACK:ack});}
            catch(e){record({method:'DOWN',at,error:e.message,late:terminal});throw e;}},
          observe:()=>call('status',intent.nonce)});
        if(!proof.consumed||proof.receiptBoundary!=='owner-worker-native-user-return'||
          proof.nativeMessage?.consumption!=='owner-user-return'||!proof.nativeMessage.token||
          (intent.kind==='mouse'?proof.nativeMessage.msg!==0x201:
            ![0x100,0x104].includes(proof.nativeMessage.msg)||proof.nativeMessage.wParam!==intent.code))
          throw Error('QUAKE2_NATIVE_UNKNOWN invalid native USER return; transport is not proof');
        // A normal guest may consume DOWN later than its browser dispatch ACK.
        // Start the short hold only after that genuine native return. The
        // independently armed releaseDue/fallback remains finite on failure.
        release.due(intent.nonce,Math.min(armReceipt.releaseDue,Date.now()+intent.ms));
      }catch(e){nativeError=e;stop(e.message);}
      finally{
        if(armed){
          // Once dispatch begins, no cancellation can claim DOWN was not sent.
          if(!downStarted)try{release.cancel(intent.nonce);}catch(e){nativeError??=e;stop(e.message);}
          try{up=await supported.finishNativeRelease(release,intent.nonce,nativeError);}catch(e){nativeError=e;stop(e.message);}
        }
        active=false;
        if(equivalent&&equivalence){try{equivalence.consume(proofHandle);}catch(e){nativeError??=e;stop(e.message);}}
      }
      if(nativeError)throw nativeError;
      return {proof,up,guestAttack:false,enemyConsequence:false};
    },
  };
}
module.exports={POLICY,hostBootstrap,createQuake2Session,reviewed,exactEdge,createController};
