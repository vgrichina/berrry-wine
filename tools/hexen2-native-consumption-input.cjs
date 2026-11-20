'use strict';
const path=require('node:path');
const ROOT=process.env.WINE_BRIDGE_ROOT||path.resolve(__dirname,'..');
const supported=require(ROOT+'/tools/gltron-current-native-input.cjs');
// The opt-in path uses the qualified adapter unchanged. Keep the legacy Hexen
// five-second path below, including its local NOT_SENT behavior.
const qualified=require(ROOT+'/tools/quake2-native-consumption-input.cjs');
const {verifyPageEquivalence}=require(ROOT+'/lib/browser-reviewed-frame-equivalence.cjs');
const POLICY=Object.freeze({reviewMs:5000,nativeMs:500,releaseFallbackMs:1750,maxHoldMs:1500});
// Installed at the end of the served host.js, before any shell launch. The
// existing observer retains getImports' actual host table and captured context.
function hostBootstrap(){
  return `\n;globalThis.WINE_BROWSER_NATIVE_INPUT=true;\n${supported.installNativeRouteObserver.toString()}\n${supported.inspectNativeRoute.toString()}\n${supported.observeAndBindNativeOwner.toString()}\n${supported.observeAndPrepareNativeIntent.toString()}\n${verifyPageEquivalence.toString()}\n${qualified.createQuake2Session.toString()}\n${createHexenSession.toString()}\ninstallNativeRouteObserver(globalThis,WineAssembly);\nglobalThis.createHexenNativeSession=(w,options)=>createHexenSession(globalThis,w,{inspectNativeRoute,observeAndBindNativeOwner,observeAndPrepareNativeIntent,verifyPageEquivalence,createQualifiedSession:createQuake2Session},options);\n`;
}
// Page-local object identities are never serialized into authority. Numeric
// HWND/generation metadata is additional to process/module/memory/Worker refs.
function createHexenSession(root,wine,helpers,options={}){
  if(Object.hasOwn(options,'manualContextKey')&&!/^[a-f0-9]{64}$/.test(options.manualContextKey||''))
    throw Error('invalid explicit manual-context key');
  if(options.manualContextKey&&options.equivalenceKey)throw Error('choose one explicit review capability');
  if(options.manualContextKey||options.equivalenceKey){
    const manual=!!options.manualContextKey,verify=helpers.verifyPageEquivalence||verifyPageEquivalence;
    if(manual)wine._requireReviewedManualContext=true;
    return (helpers.createQualifiedSession||qualified.createQuake2Session)(root,wine,
      {...helpers,verifyPageEquivalence:(key,envelope,intent)=>verify(key,envelope,intent,
        manual?'native-manual-context-v1':'native-whole-frame-equivalence-v1')},
      {...options,equivalenceKey:options.manualContextKey||options.equivalenceKey});
  }
  let terminal=false,binding=null,refs=null,scene=null,slot=null;
  const nonces=new Set();
  const current=()=>{
    const r=wine.renderer,g=wine.hostCtx?.getGlGpsBridge?.();
    const s=wine._browserNativeInput?.snapshot();
    return [wine.hostCtx,wine.instance,wine._wasmModule,wine.memory,wine.memory?.buffer,
      wine._processObject,wine.guestWorker,wine.guestWorker?.link,r,r?.canvas,r?.presentationCanvas,
      r?.inputQueue,r?.windows[s?.scene?.[2]],g,g?.endpoint,g?.workerEpoch,g?.device,
      g?.presenter?.layer,g?.presenter?.layer?.canvas];
  };
  const close=reason=>{terminal=true;wine._browserNativeInput?.close(reason);};
  function check(){
    if(terminal)throw Error('HEXEN_NATIVE_UNKNOWN permanently closed');
    const audit=helpers.inspectNativeRoute(root,wine),s=audit.bridge;
    const rows=(root.__gltronNativeRoutes||[]).filter(r=>r.wine===wine);
    if(rows.some(r=>r.ctx!==wine.hostCtx||r.ctx.guardedInput!==wine._browserNativeInput||
      r.host.browserInputScope!==wine._browserNativeInput))throw Error('HEXEN_NATIVE_UNKNOWN import authority changed');
    const g=wine.hostCtx?.getGlGpsBridge?.();
    if(binding&&(!g?.endpoint||g.endpoint.closed||g.workerAsyncError||g.workerClosing))
      throw Error('HEXEN_NATIVE_UNKNOWN render endpoint retired');
    if(!audit.running||audit.stopped||!audit.guestWorker||!audit.scopes.length||
      audit.scopes.some(v=>!v.currentContext||!v.guardedInput||!v.nativeInputActor||!v.tokenImport||!v.consumedImport)||
      !s?.healthy||s.terminal)throw Error('HEXEN_NATIVE_UNAVAILABLE actual imports/owning Worker');
    if(refs&&(current().some((v,i)=>v!==refs[i])||s.slot!==slot||
      !s.scene||s.scene.some((v,i)=>v!==scene[i])))throw Error('HEXEN_NATIVE_UNKNOWN owner/focus/modal/source/context changed '+JSON.stringify({
        changedRefs:current().flatMap((v,i)=>v!==refs[i]?[i]:[]),boundScene:scene,currentScene:s.scene,boundSlot:slot,currentSlot:s.slot}));
    return s;
  }
  function guarded(fn){try{return fn();}catch(e){close(e.message);throw e;}}
  return {
    observe(){return guarded(()=>{const s=check();if(binding)return s;
      const state=helpers.observeAndBindNativeOwner(wine);
      if(state.binding){binding=state.binding;refs=current();scene=state.scene.slice();slot=state.slot;}
      return state;});},
    prepare(intent,notBefore){return guarded(()=>{
      check();if(!binding)throw Error('HEXEN_NATIVE_UNAVAILABLE unbound');
      const now=Date.now();
      if(!intent.review?.trim()||!Number.isSafeInteger(intent.completedAt)||!Number.isSafeInteger(intent.reviewedAt)||
        intent.completedAt>intent.reviewedAt||intent.reviewedAt>now||now-intent.completedAt>=5000||
        nonces.has(intent.nonce))throw Error('HEXEN_NATIVE_UNKNOWN stale review or nonce');
      const state=helpers.observeAndPrepareNativeIntent(wine,{...intent,owner:binding.owner,reviewed:true},notBefore);
      if(state.prepared){nonces.add(intent.nonce);if(state.prepared.state!=='PREPARED')throw Error('HEXEN_NATIVE_UNKNOWN refused prepare '+JSON.stringify(state.prepared));}
      return state;
    });},
    status(nonce){return guarded(()=>{check();if(!nonces.has(nonce))throw Error('HEXEN_NATIVE_UNKNOWN unprepared nonce');
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
    throw Error('HEXEN_NATIVE_UNKNOWN complete image review expired/mismatched');
  if(!['key','mouse'].includes(intent.kind)||!Number.isInteger(intent.code)||intent.code<1||intent.code>254||
    (intent.kind==='mouse'&&(intent.code!==1||intent.button!==0||!Number.isFinite(intent.x)||!Number.isFinite(intent.y)))||
    !Number.isInteger(intent.ms)||intent.ms<50||intent.ms>POLICY.maxHoldMs||
    typeof intent.nonce!=='string'||!intent.nonce||!/^action-\d+$/.test(intent.name)||
    (intent.kind==='key'&&(typeof intent.key!=='string'||typeof intent.domCode!=='string'))||!['menu','game'].includes(intent.mode))
    throw Error('HEXEN_NATIVE_UNKNOWN unsupported exact edge');
}
// One runtime scope, explicit per-edge personal review, no retries. Close is
// controller-local and synchronous: it must retire transport, not query it.
function createController({page,dispatch,release,close,record=()=>{},equivalence,manualContext}){
  if(equivalence?.capability==='native-manual-context-v1')throw Error('manual context requires explicit manualContext option');
  if(manualContext){
    if(equivalence||manualContext.capability!=='native-manual-context-v1')throw Error('explicit manual-context capability required');
    return createManualController({page,dispatch,release,close,record,manualContext});
  }
  if(equivalence)return qualified.createController({page,dispatch,release,close,record,equivalence});
  let terminal=false,active=false;const nonces=new Set();
  const stop=reason=>{if(!terminal){terminal=true;close(reason);}};
  const gate=()=>{if(terminal)throw Error('HEXEN_NATIVE_UNKNOWN permanently closed');};
  async function call(method,...args){gate();const at=Date.now();
    try{const result=await page(method,...args);record({method,at,receivedAt:Date.now(),late:terminal,result});gate();return result;}
    catch(e){stop(e.message);throw e;}}
  return {get terminal(){return terminal;},close:stop,
    async bind(deadline){gate();try{return await supported.waitForNativeOwner({deadline,
      observe:()=>call('observe'),close:()=>stop('native owner UNKNOWN'),record});}
      catch(e){stop(e.message);throw e;}},
    async gesture(intent,image){
      gate();let armed=false,armReceipt=null,downStarted=false,nativeError=null,proof=null,up=null;
      // A local refusal has no runtime ambiguity. Burn its nonce, but keep the
      // unarmed scope available for a distinct, freshly reviewed intent.
      if(!active&&!nonces.has(intent.nonce)){
        try{reviewed(intent,image);}catch(cause){
          nonces.add(intent.nonce);
          const error=Object.assign(Error('HEXEN_NATIVE_NOT_SENT '+cause.message),{code:'HEXEN_NATIVE_NOT_SENT'});
          record({method:'preflight',at:Date.now(),state:'NOT_SENT',nonce:intent.nonce,error:error.message});
          throw error;
        }
      }
      try{
        if(active||nonces.has(intent.nonce))throw Error('HEXEN_NATIVE_UNKNOWN concurrent/stale nonce');
        reviewed(intent,image);active=true;nonces.add(intent.nonce);
        armReceipt=await release.arm(intent);armed=true;gate();reviewed(intent,image);
        const releaseGate=()=>{
          if(!Number.isSafeInteger(armReceipt?.at)||!Number.isSafeInteger(armReceipt?.fallback)||
            !Number.isSafeInteger(armReceipt?.releaseDue)||armReceipt.fallback-armReceipt.at!==1750||
            Date.now()>=armReceipt.releaseDue||Date.now()+intent.ms>=armReceipt.fallback||release.alive===false)
            throw Error('HEXEN_NATIVE_UNKNOWN independent release window expired/unavailable');
        };
        releaseGate();
        let state,start;
        const until=image.completedAt+POLICY.reviewMs;
        do{
          gate();reviewed(intent,image);releaseGate();start=Date.now();
          state=await call('prepare',{...intent,completedAt:image.completedAt},image.completedAt);
          if(!state.prepared)await new Promise(r=>setTimeout(r,5));
        }while(!state.prepared&&Date.now()<until);
        if(!state.prepared)throw Error('HEXEN_NATIVE_UNKNOWN no new native USER observation');
        gate();reviewed(intent,image);
        // The controller bound starts before prepare, including its transport;
        // the guard independently starts 500ms at its actual prepare call.
        proof=await supported.waitForNativeConsumption({deadline:start+POLICY.nativeMs,
          close:()=>stop('DOWN/native 500ms UNKNOWN'),record,
          dispatch:async()=>{gate();reviewed(intent,image);releaseGate();release.due(intent.nonce,Date.now()+intent.ms);
            downStarted=true;const at=Date.now();
            try{const ack=await dispatch(intent);record({method:'DOWN',at,receivedAt:Date.now(),late:terminal,transportACK:ack});}
            catch(e){record({method:'DOWN',at,error:e.message,late:terminal});throw e;}},
          observe:()=>call('status',intent.nonce)});
        if(!proof.consumed||proof.receiptBoundary!=='owner-worker-native-user-return'||
          proof.nativeMessage?.consumption!=='owner-user-return'||!proof.nativeMessage.token||
          (intent.kind==='mouse'?proof.nativeMessage.msg!==0x201:
            ![0x100,0x104].includes(proof.nativeMessage.msg)||proof.nativeMessage.wParam!==intent.code))
          throw Error('HEXEN_NATIVE_UNKNOWN invalid native USER return; transport is not proof');
      }catch(e){nativeError=e;stop(e.message);}
      finally{
        if(armed){
          // Once dispatch begins, no cancellation can claim DOWN was not sent.
          if(!downStarted)try{release.cancel(intent.nonce);}catch(e){nativeError??=e;stop(e.message);}
          try{up=await supported.finishNativeRelease(release,intent.nonce,nativeError);}catch(e){nativeError=e;stop(e.message);}
        }
        active=false;
      }
      if(nativeError)throw nativeError;
      return {proof,up,guestAttack:false,enemyConsequence:false};
    },
  };
}
// The manual path keeps expensive context/capture/retention outside the native
// ticket. Its final capture still runs at the actual socket boundary. Dispatch
// must invoke publish synchronously AFTER that capture, immediately before send.
function createManualController({page,dispatch,release,close,record,manualContext:a}){
  let terminal=false,active=false;const nonces=new Set();
  const stop=reason=>{if(!terminal){terminal=true;close(reason);}};
  const gate=()=>{if(terminal)throw Error('HEXEN_NATIVE_UNKNOWN permanently closed');};
  async function call(method,...args){gate();const at=Date.now();
    try{const result=await page(method,...args);record({method,at,receivedAt:Date.now(),late:terminal,result});gate();return result;}
    catch(e){stop(e.message);throw e;}}
  return {get terminal(){return terminal;},close:stop,
    async bind(deadline){gate();try{return await supported.waitForNativeOwner({deadline,
      observe:()=>call('observe'),close:()=>stop('native owner UNKNOWN'),record});}catch(e){stop(e.message);throw e;}},
    async gesture(intent,image,handle){
      gate();let armed=false,downStarted=false,error=null,proof=null,up=null;
      const check=()=>{gate();qualified.exactEdge(intent);a.validate(handle,intent,image);};
      try{
        if(active||nonces.has(intent.nonce))throw Error('HEXEN_NATIVE_UNKNOWN concurrent/stale nonce');
        check();active=true;nonces.add(intent.nonce);
        // Includes identity queries, whole capture and synchronous retention.
        // None of these starts or renews a native ticket or release deadline.
        await a.beforeDown(handle,intent,image);check();
        const arm=await release.arm(intent);armed=true;check();
        const releaseGate=()=>{
          if(!Number.isSafeInteger(arm?.at)||!Number.isSafeInteger(arm?.fallback)||
            !Number.isSafeInteger(arm?.releaseDue)||arm.fallback-arm.at!==1750||
            Date.now()+intent.ms>=arm.releaseDue||Date.now()+intent.ms>=arm.fallback||release.alive===false)
            throw Error('HEXEN_NATIVE_UNKNOWN independent release window expired/unavailable');
        };
        let state,start;const until=Date.now()+POLICY.nativeMs;
        do{
          check();releaseGate();start=Date.now();
          state=await call('prepareEquivalent',{...intent,completedAt:image.completedAt},image.completedAt,handle);
          if(!state.prepared)await new Promise(r=>setTimeout(r,5));
        }while(!state.prepared&&Date.now()<until);
        if(!state.prepared)throw Error('HEXEN_NATIVE_UNKNOWN no new native USER observation');
        const deadline=start+POLICY.nativeMs;let published=false,dispatching=false;
        // Invoked by the transport inside authority.fence, after final capture
        // and writer completion. No earlier callback can start the hold clock.
        const publish=()=>{
          if(!dispatching||published)throw Error('HEXEN_NATIVE_UNKNOWN missing/duplicate socket boundary');
          check();releaseGate();
          if(Date.now()>=deadline)throw Error('HEXEN_NATIVE_UNKNOWN final socket native 500ms expired');
          release.due(intent.nonce,Date.now()+intent.ms);
          published=true;downStarted=true;
        };
        proof=await supported.waitForNativeConsumption({deadline,
          close:()=>stop('DOWN/native 500ms UNKNOWN'),record,
          dispatch:async()=>{check();releaseGate();const at=Date.now();dispatching=true;
            try{const ack=await dispatch(intent,publish);
              if(!published)throw Error('HEXEN_NATIVE_UNKNOWN transport omitted final socket boundary');
              record({method:'DOWN',at,receivedAt:Date.now(),late:terminal,transportACK:ack});
            }finally{dispatching=false;}},
          observe:()=>{if(!published)throw Error('HEXEN_NATIVE_UNKNOWN unpublished DOWN');return call('status',intent.nonce);}});
        if(!proof.consumed||proof.receiptBoundary!=='owner-worker-native-user-return'||
          proof.nativeMessage?.consumption!=='owner-user-return'||!proof.nativeMessage.token||
          (intent.kind==='mouse'?proof.nativeMessage.msg!==0x201:
            ![0x100,0x104].includes(proof.nativeMessage.msg)||proof.nativeMessage.wParam!==intent.code))
          throw Error('HEXEN_NATIVE_UNKNOWN invalid native USER return; transport is not proof');
      }catch(e){error=e;stop(e.message);}
      finally{
        if(armed){
          if(!downStarted)try{release.cancel(intent.nonce);}catch(e){error??=e;stop(e.message);}
          try{up=await supported.finishNativeRelease(release,intent.nonce,error);}catch(e){error??=e;stop(e.message);}
        }
        active=false;
        try{a.consume(handle);}catch(e){error??=e;stop(e.message);}
      }
      if(error)throw error;
      return {proof,up,guestAttack:false,enemyConsequence:false};
    },
  };
}
module.exports={POLICY,hostBootstrap,createHexenSession,reviewed,createController};
