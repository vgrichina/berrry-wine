'use strict';
// Explicit typed pointer extension. Existing key/left controllers keep their
// contracts. Review authority and actual import observation are reused in place.
const supported=require('./warcraft3-current-controller.cjs').qualifiedLoader().load('tools/gltron-current-native-input.cjs');
const {verifyPageEquivalence}=require('../lib/browser-reviewed-frame-equivalence.cjs');
const POLICY=Object.freeze({sourceMs:30000,reviewMs:15000,freshMs:5000,nativeMs:500,holdMs:1500});
function exactMouse(i){
  if(i?.kind!=='mouse'||!((i.button===0&&i.code===1)||(i.button===2&&i.code===2))||
    !Number.isFinite(i.x)||!Number.isFinite(i.y)||i.x<0||i.y<0||
    !Number.isInteger(i.ms)||i.ms<50||i.ms>1500||!['menu','game'].includes(i.mode)||
    typeof i.nonce!=='string'||!i.nonce||!/^action-\d+$/.test(i.name))throw Error('unsupported exact mouse edge');
}
function exactInput(i){
  if(i?.kind==='mouse')return exactMouse(i);
  if(i?.kind!=='key'||!Number.isInteger(i.code)||i.code<1||i.code>254||
    typeof i.key!=='string'||!i.key||typeof i.domCode!=='string'||!i.domCode||
    !Number.isInteger(i.ms)||i.ms<50||i.ms>1500||!['menu','game'].includes(i.mode)||
    typeof i.nonce!=='string'||!i.nonce||!/^action-\d+$/.test(i.name))throw Error('unsupported exact key edge');
}
function createMouseSession(root,wine,helpers,{key,capability='native-whole-frame-equivalence-v1'}={}){
  if(!/^[a-f0-9]{64}$/.test(key||'')||!['native-whole-frame-equivalence-v1','native-manual-context-v1'].includes(capability))
    throw Error('explicit private review authority required');
  wine._requireAuthoritativeCapture=true;wine._requireReviewedFrameEquivalence=true;
  const seen=new Set();let terminal=false,binding=null,lastCheck=null;
  const close=why=>{terminal=true;wine._browserNativeInput.close(why);};
  const check=(admitting=true)=>{
    if(terminal)throw Error('NATIVE_MOUSE_UNKNOWN permanently closed');
    const a=helpers.inspectNativeRoute(root,wine),s=a.bridge;
    // Retain predicates from this read, before close mutates bridge state.
    const focused=root.document?.hasFocus()===true,visibility=root.document?.visibilityState??null;
    const facts={running:a.running,stopped:a.stopped,guestWorker:a.guestWorker,
      scopes:a.scopes.map(v=>({currentContext:v.currentContext,guardedInput:v.guardedInput,
        nativeInputActor:v.nativeInputActor,tokenImport:v.tokenImport,consumedImport:v.consumedImport})),
      bridge:s?{healthy:s.healthy,terminal:s.terminal,ready:s.ready,bound:s.bound,slot:s.slot,
        scene:s.scene,observedAt:s.observedAt,source:s.source,readiness:s.readiness}:null,
      owner:binding?.owner??null,focused,visibility,admitting,checkedAt:Date.now()};
    lastCheck=facts;
    if(!a.running||a.stopped||!a.guestWorker||!a.scopes.length||
      a.scopes.some(s=>!s.currentContext||!s.guardedInput||!s.nativeInputActor||!s.tokenImport||!s.consumedImport)||
      !s?.healthy||s.terminal||!focused||visibility!=='visible')
      throw Error('NATIVE_MOUSE_UNKNOWN actual import/owner/focus unavailable '+JSON.stringify(facts));
    // Capturing context admits no input. Only the bridge can distinguish an
    // expired sample from invalid ownership; absent diagnostics fail closed.
    const eligible=admitting?s.ready:(s.readiness?.observationReady??s.ready);
    if(binding&&(!eligible||!s.bound||s.slot!==binding.slot||s.scene.some((v,i)=>v!==binding.scene[i])))
      throw Error('NATIVE_MOUSE_UNKNOWN owner/focus/modal/capture/viewport changed '+JSON.stringify(facts));
    return s;
  };
  const guarded=fn=>{try{return fn();}catch(e){close(e.message);throw e;}};
  return {
    diagnostics(){return structuredClone(lastCheck);},
    observe(){return guarded(()=>{check();if(binding)return wine._browserNativeInput.snapshot();
      const s=helpers.observeAndBindNativeOwner(wine);if(s.binding)binding=s.binding;return s;});},
    context(){return guarded(()=>{check(false);if(!binding)throw Error('native mouse unbound');
      const r=wine.renderer;
      const viewport=JSON.stringify([root.innerWidth,root.innerHeight,root.devicePixelRatio,
        root.visualViewport?.width,root.visualViewport?.height,root.visualViewport?.offsetLeft,root.visualViewport?.offsetTop,
        r.canvas.width,r.canvas.height,r.canvas.getBoundingClientRect().toJSON(),root.document.hasFocus(),root.document.visibilityState]);
      return {scene:binding.scene.slice(),slot:binding.slot,owner:binding.owner,viewport};});},
    async prepareEquivalent(intent,notBefore,envelope){try{
      // Identity remains frozen, but freshness belongs to this attempt's live
      // producer sample. An expired sample may wait; a structural failure may
      // never wait or reopen the session. The bridge still admits preparation
      // only on a genuinely new, <=250ms owning native USER observation.
      check(false);helpers.exactInput(intent);if(!binding||seen.has(intent.nonce))throw Error('native mouse unbound/replayed nonce');
      const proof=await helpers.verifyPageEquivalence(key,envelope,intent,capability);check(false);
      if(JSON.stringify(proof.identity.native)!==JSON.stringify(this.context()))throw Error('native mouse review identity changed');
      if(!Number.isSafeInteger(notBefore))throw Error('native mouse invalid observation bound');
      const state=helpers.observeAndPrepareNativeIntent(wine,{...intent,owner:binding.owner,reviewed:true},Math.max(notBefore,proof.fresh.completedAt));
      if(state.prepared){seen.add(intent.nonce);if(state.prepared.state!=='PREPARED')throw Error('native mouse preparation refused');}
      return state;
    }catch(e){close(e.message);throw e;}},
    status(nonce){return guarded(()=>{check();if(!seen.has(nonce))throw Error('native mouse unknown nonce');
      const s=wine._browserNativeInput.status(nonce);if(['UNKNOWN','CANCELLED'].includes(s.state))close(s.reason);return s;});},close,
  };
}
function hostBootstrap(){return `\n;globalThis.WINE_BROWSER_NATIVE_INPUT=true;\n${supported.installNativeRouteObserver}\n${supported.inspectNativeRoute}\n${supported.observeAndBindNativeOwner}\n${supported.observeAndPrepareNativeIntent}\n${verifyPageEquivalence}\n${exactMouse}\n${exactInput}\n${createMouseSession}\ninstallNativeRouteObserver(globalThis,WineAssembly);\nglobalThis.createNativeMouseSession=(w,o)=>createMouseSession(globalThis,w,{inspectNativeRoute,observeAndBindNativeOwner,observeAndPrepareNativeIntent,verifyPageEquivalence,exactInput},o);\n`;}
// Publication and ACK are separate transport facts. Only the transport's
// synchronous post-send callback releases the status observer. Both operations
// must finish inside the original wall/monotonic window, and are always joined.
async function waitForPublishedConsumption({dispatch,observe,deadline,monotonicDeadline,close,record=()=>{},
  now=Date.now,monotonic=()=>performance.now(),wait=ms=>new Promise(r=>setTimeout(r,ms))}){
  const until=monotonicDeadline??(monotonic()+Math.max(0,deadline-now()));
  let closed=false,timer,published=false,signal;
  const publication=new Promise(resolve=>{signal=resolve;});
  const fail=message=>Error('NATIVE_INPUT_UNKNOWN '+message+'; permanently closed');
  const gate=()=>{if(closed||now()>=deadline||monotonic()>=until)throw fail('500ms delivery deadline');};
  const tasks=[];
  try{
    gate();
    tasks.push(Promise.resolve().then(()=>dispatch(()=>{
      gate();if(published)throw fail('duplicate socket publication');published=true;
      record({phase:'socket-published',at:now(),monotonic:monotonic()});signal();
    })).then(value=>{gate();if(!published)throw fail('transport omitted socket publication');
      record({phase:'dispatch-ack',at:now(),monotonic:monotonic()});return value;}));
    tasks.push((async()=>{await publication;gate();for(;;){
      gate();const proof=await observe(),receivedAt=now(),receivedMonotonic=monotonic();
      const late=closed||receivedAt>=deadline||receivedMonotonic>=until;
      record({receivedAt,receivedMonotonic,late,proof});gate();
      if(proof.state==='CONSUMED')return proof;
      if(!['DELIVERY_PENDING','PREPARED'].includes(proof.state))throw Error('native input refused: '+JSON.stringify(proof));
      await wait(5);
    }})());
    const values=await Promise.race([Promise.all(tasks),new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(fail('500ms delivery deadline')),Math.max(0,deadline-now()));
    })]);return values[1];
  }catch(error){closed=true;close(error.message);throw error;}
  finally{closed=true;clearTimeout(timer);signal();await Promise.allSettled(tasks);}
}
function createController({page,dispatch,release,close,authority:a,record=()=>{}}){
  if(!['native-whole-frame-equivalence-v1','native-manual-context-v1'].includes(a?.capability))throw Error('explicit review authority required');
  let terminal=false,active=false;const seen=new Set();
  const stop=why=>{if(!terminal){terminal=true;close(why);}};
  const gate=()=>{if(terminal)throw Error('NATIVE_MOUSE_UNKNOWN permanently closed');};
  const call=async(method,...args)=>{gate();try{const v=await page(method,...args);gate();return v;}catch(e){stop(e.message);throw e;}};
  return {get terminal(){return terminal;},close:stop,
    bind:deadline=>supported.waitForNativeOwner({deadline,observe:()=>call('observe'),close:()=>stop('native owner UNKNOWN'),record}),
    async gesture(input,image,handle){
      gate();const intent=structuredClone(input);let armed=false,started=false,publishing=false,published=false,error,proof,up;
      const check=()=>{gate();exactInput(intent);a.validate(handle,intent,image);};
      const phase=name=>record({phase:name,at:Date.now(),monotonic:performance.now(),nonce:intent.nonce});
      try{
        if(active||seen.has(intent.nonce))throw Error('concurrent/replayed mouse intent');
        check();active=true;seen.add(intent.nonce);phase('pre-down-capture-start');await a.beforeDown(handle,intent,image);check();phase('pre-down-capture-retained');
        const arm=await release.arm(intent);armed=true;check();
        const releaseGate=()=>{check();if(release.alive===false||!Number.isSafeInteger(arm?.at)||
          arm.releaseDue-arm.at!==1500||arm.fallback-arm.at!==1750||Date.now()+intent.ms>=arm.releaseDue)
          throw Error('independent mouse release window expired');};
        let state,start,startMono;const until=Date.now()+500;
        do{releaseGate();start=Date.now();startMono=performance.now();phase('prepare-start');state=await call('prepareEquivalent',{...intent,completedAt:image.completedAt},image.completedAt,handle);phase('prepare-return');
          if(!state.prepared)await new Promise(r=>setTimeout(r,5));
        }while(!state.prepared&&Date.now()<until);
        if(state.prepared?.state!=='PREPARED')throw Error('no fresh native mouse observation');
        const deadline=start+500;
        const publish=()=>{if(!publishing||published)throw Error('missing/duplicate mouse socket boundary');
          releaseGate();if(Date.now()>=deadline||performance.now()>=startMono+500)throw Error('mouse native 500ms expired');
          release.due(intent.nonce,Date.now()+intent.ms);started=true;published=true;};
        proof=await waitForPublishedConsumption({deadline,monotonicDeadline:startMono+500,close:()=>stop('mouse native 500ms UNKNOWN'),record,
          dispatch:async onPublished=>{releaseGate();publishing=true;try{const v=await dispatch(intent,publish,onPublished);
            if(!published)throw Error('mouse transport omitted socket publication');return v;}finally{publishing=false;}},
          observe:()=>{if(!published)throw Error('unpublished mouse DOWN');return call('status',intent.nonce);}});
        const m=proof.nativeMessage;
        if(!proof.consumed||proof.nonce!==intent.nonce||proof.receiptBoundary!=='owner-worker-native-user-return'||
          m?.consumption!=='owner-user-return'||!m.token||
          (intent.kind==='mouse'?m.msg!==(intent.code===2?0x204:0x201):![0x100,0x104].includes(m.msg))||
          m.wParam!==intent.code)throw Error('exact native mouse USER return missing');
      }catch(e){error=e;stop(e.message);}
      finally{
        if(armed){if(!started)try{release.cancel(intent.nonce);}catch(e){error??=e;stop(e.message);}
          try{up=await supported.finishNativeRelease(release,intent.nonce,error);
            if(started&&(!up?.ok||up.cancelNoDown))throw Error('issued mouse DOWN missing independent UP');
          }catch(e){error=e;stop(e.message);}}
        active=false;try{a.consume(handle);}catch(e){error??=e;stop(e.message);}
      }
      if(error)throw error;return {proof,up};
    },
  };
}
// Creation itself belongs after the reviewed trusted host click and its UP.
// The caller must use the qualified focus-order receipt, never page.focus().
async function bootstrapNative({focusOrder,createSession,observe,deadline,close,record}){
  focusOrder.beforeBind();
  await createSession();
  return supported.waitForNativeOwner({observe,deadline,close,record});
}
module.exports={POLICY,exactMouse,exactInput,createMouseSession,hostBootstrap,createController,bootstrapNative,waitForPublishedConsumption};
