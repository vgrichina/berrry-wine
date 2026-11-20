'use strict';
(function(){
// Opt-in browser receipt bridge. Physical input still enters through the
// browser and the renderer; only the owning Worker's native USER return can
// confirm its exact edge. No callback runs on the page's idle guest instance.
function createBrowserNativeInput(wine, {now=Date.now, monotonic=()=>performance.now(),
  trusted=()=>typeof window!=='undefined' && window.event?.isTrusted===true}={}) {
  const receipts=new Map(), edges=new WeakMap(), tokens=new Map();
  let serial=0, binding=null, scene=null, sceneAt=0, slot=null, scope=null, terminal=false;
  let sceneMonoAt=0, sceneSource=null, sceneActor=null, sceneActorWorker=null, sceneActorEndpoint=null;
  const absoluteMono=()=>performance.timeOrigin+monotonic();
  const r=wine.renderer, process=wine._processObject;
  let memory=null;
  // Read the actual CPUWorker publication through the shadow instance. A zero
  // GetCapture on this shadow is not proof that another actor owns no capture.
  // Scalars are freshly read on every fence; never retain a mutable window's
  // generation or an actor-local capture getter as authority.
  const captureIdentity=()=>{
    const e=wine.instance?.exports;
    // Legacy callers retain their existing contract. Quake II explicitly
    // requires this publication even when its actor-local scene says zero.
    if(!e?.capture_publication_word)return {captureKnown:!wine._requireAuthoritativeCapture};
    try{
      if(!e.get_authoritative_capture_hwnd||!e.wnd_lookup_live||
        !e.wnd_lookup_generation||!e.get_window_thread)return {captureKnown:false};
      if(!scene||!e.wnd_lookup_live(scene[2])||
        e.wnd_lookup_generation(scene[2])!==BigInt(scene[6])+(BigInt(scene[7])<<32n)||
        (e.get_window_thread(scene[2])>>>0)!==scene[0])return {captureKnown:false};
      const raw=Array.from({length:6},(_,i)=>e.capture_publication_word(i));
      if(!raw.every(Number.isInteger))return {captureKnown:false};
      const words=raw.map(n=>n>>>0);
      const [serial,hwnd,lo,hi,tid,pid]=words;
      const live=e.get_authoritative_capture_hwnd()>>>0;
      const gen=BigInt(lo)+(BigInt(hi)<<32n);
      const owned=hwnd===scene?.[2]&&hwnd===scene?.[5]&&live===hwnd&&
        tid===scene?.[0]&&pid===scene?.[1]&&pid===wine.processId&&
        !!e.wnd_lookup_live(hwnd)&&e.wnd_lookup_generation(hwnd)===gen&&
        (e.get_window_thread(hwnd)>>>0)===tid&&lo===scene?.[6]&&hi===scene?.[7];
      return {captureKnown:!(serial&1)&&serial===(e.capture_publication_word(0)>>>0)&&
        (hwnd?owned:!live&&!scene?.[5]&&!lo&&!hi&&!tid&&!pid),
        captureSerial:serial,captureHwnd:hwnd,captureLo:lo,captureHi:hi,captureTid:tid,capturePid:pid};
    }catch{return {captureKnown:false};}
  };
  const identity=()=>{const gl=wine.hostCtx?.getGlGpsBridge?.(),legacy=wine.hostCtx?.getD3dimBridge?.();
    const gps=gl||legacy,endpoint=gps?.endpoint,manager=legacy&&!gl?endpoint?.manager:null;
    const actor=slot===wine.guestWorker?.link?.slot?wine.guestWorker.link:wine.guestWorker?.threadLinks?.get(slot);
    return {renderer:wine.renderer,context:wine.hostCtx,module:wine._wasmModule,memory:wine.memory,buffer:wine.memory?.buffer,
    process:wine._processObject,instance:wine.instance,worker:wine.guestWorker,
    link:wine.guestWorker?.link,gps,gl,legacy,endpoint,device:gps?.device,
    manager,renderWorker:manager?.worker,renderModule:manager?.options?.module,
    renderMemory:manager?.options?.memory,endpointOptions:manager?endpoint?.options:null,
    endpointId:manager?endpoint?.id:null,endpointApi:manager?endpoint?.options?.api:null,
    epoch:gps?.workerEpoch,layer:gps?.presenter?.layer,source:gps?.presenter?.layer?.canvas,canvas:r.canvas,
    queue:r.inputQueue,window:r.windows[scene?.[2]],actor,actorWorker:actor?.worker,
    actorEndpoint:actor?.endpointIdentity,
    reviewedViewport:wine._requireReviewedFrameEquivalence?JSON.stringify([
      globalThis.innerWidth,globalThis.innerHeight,globalThis.devicePixelRatio,
      globalThis.visualViewport?.width,globalThis.visualViewport?.height,
      globalThis.visualViewport?.offsetLeft,globalThis.visualViewport?.offsetTop,
      r.canvas?.width,r.canvas?.height,r.canvas?.getBoundingClientRect?.().toJSON(),
      globalThis.document?.hasFocus(),globalThis.document?.visibilityState]):null,...captureIdentity()};};
  // Legacy Direct3D uses the same GPU-stream bridge, with its own real render
  // endpoint. Never substitute a GL identity or accept two graphics owners.
  const renderOwnerValid=c=>!c.legacy?true:!c.gl&&c.gps===c.legacy&&
    c.legacy===wine.hostCtx?.d3dimBridge&&c.legacy.api==='d3dim-gps'&&
    c.endpointApi==='d3dim-gps'&&c.manager===wine._renderWorkerManager&&
    !!c.renderWorker&&!c.manager?._retired&&c.manager?.ports?.get(c.endpointId)===c.endpoint&&
    c.renderMemory===wine.memory&&c.renderModule===wine._wasmModule&&
    c.device?.worker===true&&c.gps.presenter?.win===c.window;
  const report=t=>({nonce:t.nonce,state:t.state,consumed:t.state==='CONSUMED',reason:t.reason||null,
    appliedAt:t.appliedAt||null,consumedAt:t.consumedAt||null,token:t.token||0,fence:t.fence||null,
    receiptBoundary:'owner-worker-native-user-return',nativeMessage:t.nativeMessage||null,
    nativeRemoval:t.nativeRemoval||null,noReplay:true});
  const cancel=(t,reason,unknown=false)=>{
    if (t.state==='UNKNOWN') return report(t);
    t.state=unknown?'UNKNOWN':'CANCELLED';t.reason=reason;
    for(let i=r.inputQueue.length-1;i>=0;i--)if(edges.get(r.inputQueue[i])===t)r.inputQueue.splice(i,1);
    return report(t);
  };
  const healthy=()=>!terminal&&wine.running&&!wine._stopped&&!process.exited&&wine._processObject===process&&
    (!memory||wine.memory===memory)&&!!wine.guestWorker;
  const sceneValid=s=>Array.isArray(s)&&s.length===10&&s.every(Number.isInteger)&&
    // Capture is native USER authority: only no capture or this exact focused
    // main window is eligible. Keep it in the immutable scene comparison so
    // release/transfer cannot silently renew an existing binding or ticket.
    s[0]>0&&s[1]===wine.processId&&s[2]>0&&s[3]===s[2]&&!s[4]&&(!s[5]||s[5]===s[2])&&!!(s[6]||s[7])&&
    s[6]===s[8]&&s[7]===s[9];
  const sameScene=(a,b)=>a?.length===10&&b?.length===10&&a.every((n,i)=>(n>>>0)===(b[i]>>>0));
  const fresh=()=>now()-sceneAt>=0&&now()-sceneAt<=250&&
    absoluteMono()-sceneMonoAt>=0&&absoluteMono()-sceneMonoAt<=250;
  const liveSource=current=>!current.actor?._stopped&&!current.actor?._stopping&&!current.actor?._retirementComplete&&
    (sceneSource!=='native_message_wait'||
    (current.actor===sceneActor&&current.actorWorker===sceneActorWorker&&
      current.actorEndpoint===sceneActorEndpoint&&!sceneActor?._stopped&&
      !sceneActor?._stopping&&!sceneActor?._retirementComplete));
  const boundCurrent=current=>{
    if(!binding)return true;
    if(!current.captureKnown||!liveSource(current)||!sameScene(binding.scene,scene)||binding.slot!==slot||
      Object.keys(binding.refs).some(k=>current[k]!==binding.refs[k]))binding.invalid=true;
    return !binding.invalid;
  };
  const ready=()=>{
    const current=identity(),win=current.window;
    return boundCurrent(current)&&current.captureKnown&&healthy()&&sceneValid(scene)&&fresh()&&liveSource(current)&&!!win?.visible&&
      (!scene[5]||(!!current.module&&!!current.actorWorker&&current.actorEndpoint!==undefined))&&
      win.processId===wine.processId&&win.wasm===wine.instance&&!!current.endpoint&&
      !current.endpoint.closed&&!current.gps?.workerAsyncError&&!current.gps?.workerClosing&&renderOwnerValid(current);
  };
  // A nonremoving Peek observes the native cached edge. Its token remains
  // eligible only for that message's later USER return, under the original
  // fences and deadline. This never makes the renderer edge deliverable again.
  const cached=t=>t.state==='CONSUMED'&&t.nativeMessage?.apiKind===2&&
    !t.nativeMessage.remove&&!t.nativeRemoval;
  const valid=(t,continuation=false)=>{
    if(!['PREPARED','DELIVERY_PENDING'].includes(t.state)&&!(continuation&&cached(t)))return false;
    const current=identity(),win=current.window;
    if(!healthy()||!binding||!boundCurrent(current)||!liveSource(current)||!renderOwnerValid(current)||current.endpoint?.closed||current.gps?.workerAsyncError||current.gps?.workerClosing||
      !sceneValid(scene)||!fresh()||Object.keys(binding.refs).some(k=>current[k]!==binding.refs[k])||
      !win?.visible||win.processId!==wine.processId||win.wasm!==wine.instance||
      now()>=t.deadline||monotonic()>=t.until||!sameScene(t.scene,scene)||slot!==t.slot) {
      t.fence={at:now(),sceneAge:now()-sceneAt,healthy:healthy(),bound:!!binding,
        endpointClosed:!!current.endpoint?.closed,gpsFault:!!current.gps?.workerAsyncError,
        gpsClosing:!!current.gps?.workerClosing,sceneValid:sceneValid(scene),
        changedRefs:binding?Object.keys(binding.refs).filter(k=>current[k]!==binding.refs[k]):[],
        visible:!!win?.visible,processMatches:win?.processId===wine.processId,
        instanceMatches:win?.wasm===wine.instance,wallExpired:now()>=t.deadline,
        monotonicExpired:monotonic()>=t.until,sceneMatches:sameScene(t.scene,scene),slotMatches:slot===t.slot};
      cancel(t,'owner/focus/modal/generation/target/deadline fence');return false;
    }
    return true;
  };
  const api={
    withActor(actorSlot,name,fn){
      const previous=scope;scope={slot:actorSlot,name};
      try{return fn();}finally{scope=previous;}
    },
    observe(values){
      if(scope?.name!=='check_input'||values.length!==10)return false;
      scene=values.map(n=>n>>>0);sceneAt=now();sceneMonoAt=absoluteMono();
      sceneSource='check_input';slot=scope.slot;boundCurrent(identity());return true;
    },
    snapshot(){return {scene:scene?.slice(),observedAt:scene?sceneAt:null,
      producerMonoAt:scene?sceneMonoAt:null,source:sceneSource,slot,healthy:healthy(),ready:ready(),bound:!!binding,terminal};},
    sweep(){for(const t of receipts.values())valid(t);},
    owns(event){const t=edges.get(event);return !t||scope?.slot===t.slot;},
    bind(){
      if(binding||terminal||!ready())throw Error('browser native owner unavailable or already bound');
      memory=wine.memory;
      binding={owner:crypto.randomUUID(),refs:identity(),scene:scene.slice(),slot,invalid:false};
      if(!binding.refs.window?.visible||!binding.refs.endpoint||binding.refs.endpoint.closed)
        throw Error('browser native target unavailable');
      return {owner:binding.owner,scene:scene.slice(),slot};
    },
    prepare(intent){
      if(!binding||intent.owner!==binding.owner||intent.reviewed!==true||
        typeof intent.nonce!=='string'||!intent.nonce||receipts.has(intent.nonce)||
        !Number.isInteger(intent.code)||intent.code<1||intent.code>254||
        (intent.kind!==undefined&&!['key','mouse'].includes(intent.kind))||
        (intent.kind==='mouse'&&(intent.code!==1||intent.button!==0))||
        !Number.isSafeInteger(intent.reviewedAt)||now()-intent.reviewedAt<0||
        now()-intent.reviewedAt>(intent.mode==='game'?15000:30000)||
        !/^[a-f0-9]{64}$/.test(intent.imageSHA256||''))throw Error('browser native intent refused');
      const t={...intent,scene:scene.slice(),slot,state:'PREPARED',deadline:now()+500,until:monotonic()+500};
      receipts.set(t.nonce,t);valid(t);return report(t);
    },
    dequeued(event){
      const t=edges.get(event);if(!t)return 0;
      if(scope?.name!=='check_input'||scope.slot!==t.slot||!valid(t))return false;
      if(!t.token){t.token=++serial;tokens.set(t.token,{t,event});}return t.token;
    },
    token:event=>edges.get(event)?.token||0,
    validate(token,values){
      if(scope?.name!=='input_validate')return 0;
      if(token===-1){
        // This is an observation of an already executed native message-wait
        // probe, never an input validation/receipt. Late transport cannot
        // make its scene fresh. Retired/reused actor endpoints cannot renew it.
        if(!healthy()||values.length!==13)return 0;
        const candidate=values.slice(0,10),wall=values[10],mono=values[11],endpoint=values[12];
        const actor=scope.slot===wine.guestWorker?.link?.slot?wine.guestWorker.link:
          wine.guestWorker?.threadLinks?.get(scope.slot);
        if(!candidate.every(Number.isInteger)||!actor?.worker||actor._stopped||actor._stopping||
          actor._retirementComplete||actor.endpointIdentity!==endpoint||
          !Number.isFinite(wall)||!Number.isFinite(mono)||wall<sceneAt||
          now()-wall<0||now()-wall>250||absoluteMono()-mono<0||absoluteMono()-mono>250)return 0;
        scene=candidate.map(n=>n>>>0);sceneAt=wall;sceneMonoAt=mono;
        sceneSource='native_message_wait';slot=scope.slot;
        sceneActor=actor;sceneActorWorker=actor.worker;sceneActorEndpoint=endpoint;boundCurrent(identity());return 0;
      }
      if(token===0)return 0x424e49;
      const entry=tokens.get(token);if(!entry||scope.slot!==entry.t.slot)return 0;
      if(!sameScene(entry.t.scene,values))return +!!cancel(entry.t,'native actor context changed').consumed;
      return +valid(entry.t,true);
    },
    consumed(token,tid,ptr,kind,remove,values){
      const entry=tokens.get(token);if(!entry||scope?.name!=='input_consumed'||scope.slot!==entry.t.slot)return 0;
      const {t,event}=entry;
      if(values.length!==11||!sameScene(t.scene,values.slice(0,10))||tid!==t.scene[0]||![1,2,3].includes(kind)||
        ![0,1].includes(remove)||(kind!==2&&remove!==1)||!valid(t,true))return 0;
      const p=values[10]>>>0,buffer=memory.buffer;
      if(p>buffer.byteLength-16)return 0;
      const dv=new DataView(buffer),message=Object.fromEntries(['hwnd','msg','wParam','lParam'].map((k,i)=>[k,dv.getUint32(p+4*i,true)]));
      if(message.hwnd!==t.scene[2]||['msg','wParam','lParam'].some(k=>message[k]!==event[k]>>>0))return 0;
      const returned={...message,threadId:tid,slot:scope.slot,
        token,apiKind:kind,remove:!!remove,consumption:'owner-user-return'};
      if(t.nativeMessage){
        if(remove)t.nativeRemoval={...returned,at:now()};
      }else{
        t.state='CONSUMED';t.consumedAt=now();t.nativeMessage=returned;
        if(remove)t.nativeRemoval={...returned,at:t.consumedAt};
      }
      return 1;
    },
    status(nonce){const t=receipts.get(nonce);if(!t)throw Error('unknown browser native nonce');valid(t);return report(t);},
    close(reason='transport UNKNOWN'){
      terminal=true;for(const t of receipts.values())if(t.state!=='CONSUMED')cancel(t,reason,true);
    },
  };
  // Both routes retain the real renderer event and require the same native
  // MSG return. Mouse1 is WM_LBUTTONDOWN; it is never a keyboard surrogate.
  const kind=t=>t.kind||'key';
  const exact=(event,t)=>kind(t)==='mouse'?event.msg===0x201&&!!(event.wParam&1):
    [0x100,0x104].includes(event.msg)&&event.wParam===t.code;
  function applyDown(type,code,fn,args){
    if(!binding)return fn.apply(r,args);
    const pending=[...receipts.values()].filter(t=>t.state==='PREPARED');
    const t=pending.length===1&&pending[0];
    if(!t||kind(t)!==type||t.code!==code||!trusted()||!valid(t))return;
    const before=new Set(r.inputQueue);t.state='APPLYING';
    try{
      const result=fn.apply(r,args);t.appliedAt=now();
      const produced=r.inputQueue.filter(e=>!before.has(e)&&exact(e,t));
      if(produced.length!==1){
        for(const event of produced)edges.set(event,t);
        cancel(t,'physical handler did not produce exact DOWN',true);return result;
      }
      edges.set(produced[0],t);t.state='DELIVERY_PENDING';return result;
    }catch(error){
      for(const event of r.inputQueue)if(!before.has(event)&&exact(event,t))edges.set(event,t);
      cancel(t,'physical handler exception: '+error.message,true);throw error;
    }
  }
  function physicalUp(type,code,physical){
    for(const t of receipts.values())if(kind(t)===type&&t.code===code&&!t.physicalUp&&
      (t.appliedAt||['PREPARED','DELIVERY_PENDING'].includes(t.state))){
      // A delayed DOWN must never become held after its independent UP has
      // already returned. Keep the nonce terminal even before any dequeue.
      if(!t.appliedAt)cancel(t,'physical UP preceded DOWN',true);
      t.physicalUp={nonce:t.nonce,code,kind:type,at:now(),trusted:physical,
        down:!!r.peekKeyDownState(code),owner:binding?.owner};
      if(typeof window!=='undefined')console.log('GLTRON_NATIVE_PHYSICAL_UP',JSON.stringify(t.physicalUp));
    }
  }
  const down=r.handleKeyDown,up=r.handleKeyUp;
  r.handleKeyDown=function(code,...args){return applyDown('key',code,down,[code,...args]);};
  r.handleKeyUp=function(code,...args){
    const physical=trusted(),result=up.call(this,code,...args);physicalUp('key',code,physical);return result;
  };
  // Keep renderers without pointer handlers (including CLI/unit fixtures) valid.
  const mouseDown=r.handleMouseDown,mouseUp=r.handleMouseUp;
  if(typeof mouseDown==='function')r.handleMouseDown=function(x,y,button,...args){
    return applyDown('mouse',button===0?1:-1,mouseDown,[x,y,button,...args]);
  };
  if(typeof mouseUp==='function')r.handleMouseUp=function(x,y,button,...args){
    const physical=trusted(),result=mouseUp.call(this,x,y,button,...args);
    if(button===0)physicalUp('mouse',1,physical);return result;
  };
  return api;
}
if (typeof module !== 'undefined' && module.exports) module.exports={createBrowserNativeInput};
else globalThis.createBrowserNativeInput=createBrowserNativeInput;
})();
