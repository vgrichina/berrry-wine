'use strict';
(function(){
// Opt-in browser receipt bridge. Physical input still enters through the
// browser and the renderer; only the owning Worker's native USER return can
// confirm its exact edge. No callback runs on the page's idle guest instance.
function createBrowserNativeInput(wine, {now=Date.now, monotonic=()=>performance.now(),
  trusted=(type,code)=>{
    const event=typeof window!=='undefined' && window.event;
    return event?.isTrusted===true && event.type===type &&
      (type.startsWith('key')?event.keyCode===code:
        type==='mousemove'||event.button===(code===1?0:code===2?2:-1));
  }}={}) {
  const regions=(typeof module!=='undefined'&&module.exports?require('./region-map.generated'):globalThis.RegionMap).BASE;
  const receipts=new Map(), edges=new WeakMap(), tokens=new Map();
  const diDevices=new Map(),diEdges=new Map();
  let diEpoch=0,diPoll=null,diApplying=null;
  let serial=0, binding=null, scene=null, sceneAt=0, slot=null, scope=null, terminal=false;
  let sceneMonoAt=0, sceneSource=null, sceneActor=null, sceneActorWorker=null, sceneActorEndpoint=null;
  let sceneSoftware=null;
  const softwareRefs=['renderer','context','module','memory','buffer','process','instance','worker','link',
    'queue','window','actor','actorWorker','actorEndpoint','actorModule','actorMemory','cpuModule','cpuMemory',
    'hostImports','inputSite','validateSite','consumedSite','diSite','exports','windowMemory','softwareFocus'];
  const absoluteMono=()=>performance.timeOrigin+monotonic();
  const r=wine.renderer, process=wine._processObject;
  let memory=null;
  const generation=(e,h)=>e.wnd_lookup_generation(h);
  // main_hwnd can still name a hidden startup window. Only USER's shared
  // active DialogBox pump authorizes this distinct root/focused-control scene.
  const context=values=>{
    if(!Array.isArray(values)||values.length!==10||!values.every(Number.isInteger))return null;
    const s=values.map(n=>n>>>0),e=wine.instance?.exports,root=e?.dialogbox_hwnd?.()>>>0;
    if(!root)return s;
    try{
      if(s[4]||!e.wnd_lookup_live(s[2])||generation(e,s[2])!==BigInt(s[6])+(BigInt(s[7])<<32n)||
        e.get_window_thread(s[2])!==s[0]||!e.wnd_lookup_live(root)||e.get_window_thread(root)!==s[0]||
        !e.wnd_lookup_live(s[3])||generation(e,s[3])!==BigInt(s[8])+(BigInt(s[9])<<32n)||
        e.get_window_thread(s[3])!==s[0]||e.wnd_top_level(s[3])!==root||
        !e.dialog_get_proc_export(root)||new DataView(wine.memory.buffer).getUint32(regions.SHARED_DLG_ENDED,true))return null;
      const gen=generation(e,root);s[2]=s[4]=root;s[6]=Number(gen&0xffffffffn);s[7]=Number(gen>>32n);
      return s;
    }catch{return null;}
  };
  const modalIdentity=()=>{
    if(!scene?.[4]||scene[4]!==scene[2])return {};
    try{
      const e=wine.instance.exports,owner=e.wnd_get_owner(scene[2])>>>0;
      return {dialogOwner:owner,dialogOwnerGeneration:String(generation(e,owner)),
        dialogProc:e.dialog_get_proc_export(scene[2])>>>0};
    }catch{return {dialogUnavailable:true};}
  };
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
    const cpu=legacy&&!gl?wine.hostCtx?.getD3dimInputPresentation?.():null;
    const actor=slot===wine.guestWorker?.link?.slot?wine.guestWorker.link:wine.guestWorker?.threadLinks?.get(slot);
    return {renderer:wine.renderer,context:wine.hostCtx,module:wine._wasmModule,memory:wine.memory,buffer:wine.memory?.buffer,
    process:wine._processObject,instance:wine.instance,worker:wine.guestWorker,
    link:wine.guestWorker?.link,gps,gl,legacy,endpoint,device:gps?.device,
    manager,renderWorker:manager?.worker,renderModule:manager?.options?.module,
    renderMemory:manager?.options?.memory,endpointOptions:manager?endpoint?.options:null,
    endpointId:manager?endpoint?.id:null,endpointApi:manager?endpoint?.options?.api:null,
    cpuWindow:cpu?.window,cpuLayer:cpu?.layer,cpuSource:cpu?.source,cpuPresentMemory:cpu?.memory,
    cpuInstance:cpu?.instance,cpuBridge:cpu?.bridge,cpuEndpoint:cpu?.endpoint,cpuEpoch:cpu?.epoch,
    epoch:gps?.workerEpoch,layer:gps?.presenter?.layer,source:gps?.presenter?.layer?.canvas,canvas:r.canvas,
    queue:r.inputQueue,window:r.windows[scene?.[2]],actor,actorWorker:actor?.worker,
    actorEndpoint:actor?.endpointIdentity,
    actorModule:actor?.module,actorMemory:actor?.memory,
    cpuModule:wine.guestWorker?.module,cpuMemory:wine.guestWorker?.memory,
    hostImports:wine.guestWorker?.hostImports,
    inputSite:wine.guestWorker?.hostImports?.check_input,
    validateSite:wine.guestWorker?.hostImports?.input_validate,
    consumedSite:wine.guestWorker?.hostImports?.input_consumed,
    diSite:wine.guestWorker?.hostImports?.di_mouse_receipt,
    exports:wine.instance?.exports,
    windowMemory:r.windows[scene?.[2]]?.wasmMemory,
    softwareFocus:gps?null:typeof document==='undefined'||
      document.hasFocus()&&document.visibilityState==='visible',
    reviewedViewport:(wine._requireReviewedFrameEquivalence||wine._requireReviewedManualContext)?JSON.stringify([
      globalThis.innerWidth,globalThis.innerHeight,globalThis.devicePixelRatio,
      globalThis.visualViewport?.width,globalThis.visualViewport?.height,
      globalThis.visualViewport?.offsetLeft,globalThis.visualViewport?.offsetTop,
      r.canvas?.width,r.canvas?.height,r.canvas?.getBoundingClientRect?.().toJSON(),
      globalThis.document?.hasFocus(),globalThis.document?.visibilityState]):null,...captureIdentity(),...modalIdentity()};};
  // Legacy Direct3D uses the same GPU-stream bridge, with its own real render
  // endpoint. Never substitute a GL identity or accept two graphics owners.
  const renderOwnerValid=c=>!c.legacy?true:!c.gl&&c.gps===c.legacy&&
    c.legacy===wine.hostCtx?.d3dimBridge&&c.legacy.api==='d3dim-gps'&&
    c.endpointApi==='d3dim-gps'&&c.manager===wine._renderWorkerManager&&
    !!c.renderWorker&&!c.manager?._retired&&c.manager?.ports?.get(c.endpointId)===c.endpoint&&
    c.renderMemory===wine.memory&&c.renderModule===wine._wasmModule&&
    c.device?.worker===true&&(c.gps.presenter?.win===c.window||
      // CPU primary copies have the same exact presented-window requirement.
      // An open consumer or an arbitrary DX layer is insufficient: this is
      // metadata from the completed host copy, fenced to that endpoint epoch.
      (!!c.cpuLayer&&!!c.cpuSource&&c.cpuWindow===c.window&&
        c.cpuLayer===c.window?._dxFrameLayer&&c.cpuSource===c.cpuLayer.canvas&&
        c.cpuPresentMemory===c.buffer&&c.cpuInstance===wine.instance&&c.windowMemory===wine.memory&&
        c.cpuBridge===c.legacy&&c.cpuEndpoint===c.endpoint&&c.cpuEpoch===c.epoch));
  // SDL's software surface has no graphics stream endpoint. Its authority is
  // the actual CPU link and the host renderer/context sharing that module and
  // memory. Never use this route to excuse a broken or retired 3D endpoint.
  const softwareOwnerValid=c=>{
    if(c.gl||c.legacy||c.gps||c.endpoint)return false;
    if(!sceneSoftware||sceneSoftware.gl||sceneSoftware.legacy||sceneSoftware.gps||sceneSoftware.endpoint||
      softwareRefs.some(k=>c[k]!==sceneSoftware[k]))return false;
    const e=c.exports,h=c.hostImports;
    if(!c.softwareFocus||c.renderer!==r||!c.module||!c.memory||!c.instance||!c.context||
      c.context.instance!==c.instance||c.context.guardedInput!==api||
      r.wasm!==c.instance||r.wasmMemory!==c.memory||c.windowMemory!==c.memory||
      c.cpuModule!==c.module||c.cpuMemory!==c.memory||
      c.actorModule!==c.module||c.actorMemory!==c.memory||c.actor?.slot!==slot||
      c.actor!==sceneActor||c.actorWorker!==sceneActorWorker||c.actorEndpoint!==sceneActorEndpoint||
      !c.actorWorker||!Number.isSafeInteger(c.actorEndpoint)||c.actorEndpoint<=0||
      c.worker?._stopped||c.actor?._transportFailure||c.actor?._writerAmbiguous||
      !h||h.browserInputScope!==api||typeof c.inputSite!=='function'||
      typeof c.validateSite!=='function'||typeof c.consumedSite!=='function'||
      !['wnd_lookup_live','wnd_lookup_generation','get_window_thread'].every(k=>typeof e?.[k]==='function'))return false;
    try{return !!e.wnd_lookup_live(scene[2])&&
      e.wnd_lookup_generation(scene[2])===BigInt(scene[6])+(BigInt(scene[7])<<32n)&&
      (e.get_window_thread(scene[2])>>>0)===scene[0];}catch{return false;}
  };
  const ownerValid=c=>c.gl||c.legacy?
    !!c.endpoint&&!c.endpoint.closed&&!c.gps?.workerAsyncError&&!c.gps?.workerClosing&&renderOwnerValid(c):
    softwareOwnerValid(c);
  const report=t=>({nonce:t.nonce,state:t.state,consumed:t.state==='CONSUMED',reason:t.reason||null,
    menuHandled:t.state==='MENU_HANDLED',menuReceipt:t.menuReceipt||null,
    appliedAt:t.appliedAt||null,consumedAt:t.consumedAt||null,token:t.token||0,fence:t.fence||null,
    receiptBoundary:t.consumer==='menu-tracker'?'synchronous-wat-menu-tracker-return':
      t.di?'owner-native-directinput-buffered-record':t.nativeMessage?.apiKind===7?
      'native-dialog-input-invocation-return':'owner-worker-native-user-return',
    nativeDirectInput:t.diRecords?.map(r=>({...r}))||null,
    nativePeek:t.diPeek?{...t.diPeek}:null,nativeUp:t.diUp?{...t.diUp}:null,
    device:t.di?{entry:t.di.entry,generation:t.di.generation}:null,
    nativeMessage:t.nativeMessage||null,
    nativeRemoval:t.nativeRemoval||null,physicalUp:t.physicalUp||null,
    ownershipCancellation:t.ownershipCancellation||null,noReplay:true});
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
    s[0]>0&&s[1]===wine.processId&&s[2]>0&&(!s[5]||s[5]===s[2])&&!!(s[6]||s[7])&&
    (s[4]===s[2]?modalSceneValid(s):!s[4]&&s[3]===s[2]&&s[6]===s[8]&&s[7]===s[9]);
  const modalSceneValid=s=>{
    const e=wine.instance?.exports;
    try{return e.dialogbox_hwnd()===s[2]&&!new DataView(wine.memory.buffer).getUint32(regions.SHARED_DLG_ENDED,true)&&
      !!e.wnd_lookup_live(s[3])&&generation(e,s[3])===BigInt(s[8])+(BigInt(s[9])<<32n)&&
      e.get_window_thread(s[3])===s[0]&&e.wnd_top_level(s[3])===s[2];}catch{return false;}
  };
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
      win.processId===wine.processId&&win.wasm===wine.instance&&ownerValid(current);
  };
  // Read-only explanation of the same admission predicates. A capture may
  // describe a valid bound owner after its input sample expires; that does not
  // renew the sample or authorize prepare/dequeue/USER return.
  const readiness=()=>{
    const current=identity(),win=current.window,checkedAt=now(),checkedMonoAt=absoluteMono();
    const sceneAge=checkedAt-sceneAt,sceneMonoAge=checkedMonoAt-sceneMonoAt;
    const predicates={boundCurrent:boundCurrent(current),captureKnown:!!current.captureKnown,
      healthy:!!healthy(),sceneValid:!!sceneValid(scene),
      fresh:sceneAge>=0&&sceneAge<=250&&sceneMonoAge>=0&&sceneMonoAge<=250,
      liveSource:!!liveSource(current),visible:!!win?.visible,
      captureActor:!scene?.[5]||!!(current.module&&current.actorWorker&&current.actorEndpoint!==undefined),
      processMatches:win?.processId===wine.processId,instanceMatches:win?.wasm===wine.instance,
      ownerValid:!!ownerValid(current),
      renderErrorFree:!current.gps?.workerAsyncError,renderNotClosing:!current.gps?.workerClosing,
      renderOwnerValid:!!renderOwnerValid(current)};
    return {predicates,route:current.gl||current.legacy?'graphics':'software',
      endpointPresent:!!current.endpoint,endpointOpen:!!current.endpoint&&!current.endpoint.closed,
      checkedAt,checkedMonoAt,sceneAge,sceneMonoAge,
      observationReady:Object.entries(predicates).every(([k,v])=>k==='fresh'||v),
      ready:Object.values(predicates).every(Boolean)};
  };
  // A nonremoving Peek observes the native cached edge. Its token remains
  // eligible only for that message's later USER return, under the original
  // fences and deadline. This never makes the renderer edge deliverable again.
  const cached=t=>t.state==='CONSUMED'&&t.nativeMessage?.apiKind===2&&
    !t.nativeMessage.remove&&!t.nativeRemoval;
  const retainedFields=(a,b)=>a.every((n,i)=>[0,19,20,21,22,31].includes(i)||n===b[i]);
  const frameWords=(f,p)=>{
    try{
      const e=wine.instance.exports,buffer=memory.buffer,base=e.guest_to_wasm(Number(f[11]))>>>0;
      if(f[2]!==f[11]+256n||base>buffer.byteLength-272||p!==base+256)return null;
      const view=new DataView(buffer);
      return Array.from({length:32},(_,i)=>view.getBigUint64(base+i*8,true));
    }catch{return null;}
  };
  const custody=f=>{
    try{
      if(f[3]<1n||f[3]>16n||f[14]>=64n)return false;
      const a=new BigUint64Array(memory.buffer),base=regions.CALLBACK_OWNERSHIP,
        actor=base+16+(Number(f[3])-1)*528;
      return Atomics.load(a,(base+8)/8)===f[23]&&Atomics.load(a,actor/8)===f[13]&&
        Atomics.load(a,(actor+8)/8)===f[11]&&a[(actor+16+Number(f[14])*8)/8]===f[12];
    }catch{return false;}
  };
  const retained=t=>{
    const claim=t.dialogClaim;if(!claim)return false;
    const f=claim.words,current=frameWords(f,claim.p),e=wine.instance.exports;
    // While the callback yields it may replace its page or focused control.
    // Only its still-owned native frame can retain this original ticket.
    return !!current&&[1n,2n].includes(current[0])&&retainedFields(f,current)&&custody(f)&&
      e.dialogbox_hwnd()===Number(f[5])&&!!e.wnd_lookup_live(Number(f[5]))&&
      generation(e,Number(f[5]))===f[6]&&e.get_window_thread(Number(f[5]))===Number(f[3])&&
      (e.wnd_get_owner(Number(f[5]))>>>0)===Number(f[7])&&generation(e,Number(f[7]))===f[8]&&
      (e.dialog_get_proc_export(Number(f[5]))>>>0)===Number(f[29])&&
      !new DataView(memory.buffer).getUint32(regions.SHARED_DLG_ENDED,true);
  };
  const valid=(t,continuation=false)=>{
    if(!['PREPARED','DELIVERY_PENDING'].includes(t.state)&&!(continuation&&cached(t)))return false;
    if(t.di&&diDevices.get(t.di.entry)!==t.di){cancel(t,'DirectInput device lifetime changed');return false;}
    if(continuation&&t.point&&(t.physicalUp||t.rightUpEntered))return false;
    const current=identity(),win=current.window;
    if(!healthy()||!binding||!boundCurrent(current)||!liveSource(current)||!ownerValid(current)||
      !(t.dialogClaim?retained(t):sceneValid(scene)&&fresh())||Object.keys(binding.refs).some(k=>current[k]!==binding.refs[k])||
      !win?.visible||win.processId!==wine.processId||win.wasm!==wine.instance||
      now()>=t.deadline||monotonic()>=t.until||!sameScene(t.scene,scene)||slot!==t.slot||
      (t.point&&t.point.geometry!==pointerGeometry())) {
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
  function dialogConsumed(t,event,token,tid,ptr,kind,remove,values){
    const w=values[11],f=w?.words,e=wine.instance.exports;
    if(values.length!==12||t.state!=='DELIVERY_PENDING'||!t.scene[4]||t.di||remove!==1||
      !Object.isFrozen(w)||!Object.isFrozen(f)||w.version!==1||w.slot!==t.slot||
      w.endpointIdentity!==binding?.refs.actorEndpoint||!Number.isSafeInteger(w.sequence)||w.sequence<=0||
      w.token!==token||w.threadId!==tid||w.ptr!==(ptr>>>0)||w.kind!==kind||w.remove!==remove||
      !Array.isArray(f)||f.length!==32||f.some(n=>typeof n!=='bigint'||n<0n||n>0xffffffffffffffffn)||
      f[0]!==BigInt(kind===6?1:2)||f[27]!==0x44494e50n||f[1]!==BigInt(token)||
      f[2]!==BigInt(ptr>>>0)||f[3]!==BigInt(tid)||tid!==t.scene[0]||f[4]!==BigInt(wine.processId)||
      f[5]!==BigInt(t.scene[2])||f[6]!==BigInt(t.scene[6])+(BigInt(t.scene[7])<<32n)||
      [10,11,12,13,14,23,24,25,29,30].some(i=>!f[i])||
      f[9]!==f[15]||['msg','wParam','lParam'].some((k,i)=>f[16+i]!==BigInt(event[k]>>>0))||
      (event.hwnd&&(event.hwnd>>>0)!==Number(f[9]))||
      (kind===6&&(!sameScene(t.scene,context(values.slice(0,10)))||!valid(t,true)))||
      !custody(f))return 0;
    const p=values[10]>>>0,actual=frameWords(f,p);
    if(!actual||actual.some((n,i)=>n!==f[i]))return 0;
    const dv=new DataView(memory.buffer),message=Object.fromEntries(['hwnd','msg','wParam','lParam'].
      map((k,i)=>[k,dv.getUint32(p+4*i,true)]));
    if(['hwnd','msg','wParam','lParam'].some((k,i)=>f[15+i]!==BigInt(message[k]))||
      (t.point&&!exact(message,t)))return 0;
    if(kind===6){
      if(t.dialogClaim||generation(e,Number(f[7]))!==f[8]||
        (e.wnd_get_owner(Number(f[5]))>>>0)!==Number(f[7])||
        !e.wnd_lookup_live(message.hwnd)||generation(e,message.hwnd)!==f[10]||
        e.get_window_thread(message.hwnd)!==tid||e.wnd_top_level(message.hwnd)!==Number(f[5])||
        (e.wnd_get_proc_export(message.hwnd)>>>0)!==Number(f[30])||
        (e.dialog_get_proc_export(Number(f[5]))>>>0)!==Number(f[29])||
        ((t.kind||'key')==='key'&&message.hwnd!==t.scene[3]))return 0;
      t.dialogClaim={words:f,p,sequence:w.sequence,event};
      if(!retained(t)){t.dialogClaim=null;return 0;}
      return 1;
    }
    const claim=t.dialogClaim;
    if(!claim||claim.event!==event||claim.p!==p||w.sequence<=claim.sequence||!retainedFields(claim.words,f)||
      !valid(t,true)||f[21]!==f[5]||f[22]!==f[6]||f[31]!==f[29]||
      values[0]!==tid||values[1]!==wine.processId||values[3]!==Number(f[19])||
      BigInt(values[8]>>>0)+(BigInt(values[9]>>>0)<<32n)!==f[20]||values[4]||
      generation(e,Number(f[19]))!==f[20]||
      (f[19]&&(!e.wnd_lookup_live(Number(f[19]))||!f[20]||e.get_window_thread(Number(f[19]))!==tid||
        e.wnd_top_level(Number(f[19]))!==Number(f[5]))))return 0;
    const targetGen=generation(e,message.hwnd);
    if((targetGen||e.wnd_lookup_live(message.hwnd))&&targetGen!==f[10])return 0;
    t.dialogClaim=null;t.state='CONSUMED';t.consumedAt=now();
    t.nativeMessage={...message,threadId:tid,slot:t.slot,token,apiKind:7,remove:true,
      consumption:'owner-dialog-input-return',generation:String(f[10]),processId:Number(f[4]),
      dialogHwnd:Number(f[5]),dialogGeneration:String(f[6]),invocation:String(f[12]),root:String(f[13]),
      depth:Number(f[14]),invocationEpoch:String(f[23]),entryStack:Number(f[24]),callback:Number(f[25]),
      focusAfter:Number(f[19]),focusGenerationAfter:String(f[20])};
    t.nativeRemoval={...t.nativeMessage,at:t.consumedAt};return 1;
  }
  const api={
    withActor(actorSlot,name,fn){
      const previous=scope;scope={slot:actorSlot,name};
      try{return fn();}finally{scope=previous;}
    },
    observe(values){
      if(scope?.name!=='check_input'||values.length!==10)return false;
      const candidate=context(values);if(!candidate)return false;
      if([...receipts.values()].some(t=>t.state==='DELIVERY_PENDING'&&t.dialogClaim))return false;
      scene=candidate;sceneAt=now();sceneMonoAt=absoluteMono();
      sceneSource='check_input';slot=scope.slot;
      const current=identity();sceneActor=current.actor;sceneActorWorker=current.actorWorker;
      sceneActorEndpoint=current.actorEndpoint;sceneSoftware=current;boundCurrent(current);return true;
    },
    snapshot(){const diagnostics=readiness();return {scene:scene?.slice(),observedAt:scene?sceneAt:null,
      producerMonoAt:scene?sceneMonoAt:null,source:sceneSource,slot,healthy:healthy(),ready:diagnostics.ready,
      readiness:diagnostics,bound:!!binding,terminal};},
    sweep(){for(const t of receipts.values())valid(t);},
    owns(event){const t=edges.get(event);return !t||scope?.slot===t.slot;},
    bind(){
      if(binding||terminal||!ready())throw Error('browser native owner unavailable or already bound');
      memory=wine.memory;
      binding={owner:crypto.randomUUID(),refs:identity(),scene:scene.slice(),slot,invalid:false};
      if(!binding.refs.window?.visible||!ownerValid(binding.refs))
        throw Error('browser native target unavailable');
      return {owner:binding.owner,scene:scene.slice(),slot};
    },
    prepare(intent){
      if(!binding||intent.owner!==binding.owner||intent.reviewed!==true||
        typeof intent.nonce!=='string'||!intent.nonce||receipts.has(intent.nonce)||
        !Number.isInteger(intent.code)||intent.code<1||intent.code>254||
        (intent.kind!==undefined&&!['key','mouse','motion'].includes(intent.kind))||
        (intent.consumer!==undefined&&!['directinput-buffered','menu-tracker'].includes(intent.consumer))||
        (intent.consumer==='menu-tracker'&&(intent.kind!=='mouse'||intent.code!==1||intent.button!==0||
          !['open','select'].includes(intent.menuAction)||scene[4]||scene[5]||
          (intent.menuAction==='select'&&(!Number.isInteger(intent.commandId)||intent.commandId<1||intent.commandId>65535))))||
        (intent.kind==='motion'&&intent.code!==1)||
        (intent.kind==='mouse'&&!((intent.code===1&&intent.button===0)||(intent.code===2&&intent.button===2)))||
        !Number.isSafeInteger(intent.reviewedAt)||now()-intent.reviewedAt<0||
        now()-intent.reviewedAt>(intent.mode==='game'?15000:30000)||
        !/^[a-f0-9]{64}$/.test(intent.imageSHA256||''))throw Error('browser native intent refused');
      const t={...intent,menuReceipt:null,scene:scene.slice(),slot,state:'PREPARED',deadline:now()+500,until:monotonic()+500};
      if(t.consumer==='menu-tracker'&&typeof wine.instance?.exports.native_menu_pointer_receipt!=='function')
        throw Error('native menu tracker receipt unavailable');
      if(intent.consumer==='directinput-buffered'){
        if(!['mouse','motion'].includes(intent.kind)||!diPoll||diPoll.slot!==slot||
          !sameScene(diPoll.scene,scene)||diDevices.get(diPoll.device.entry)!==diPoll.device||
          now()-diPoll.at<0||now()-diPoll.at>250||!ready())throw Error('native DirectInput owner unavailable');
        t.di=diPoll.device;t.diSequences=[];t.diRecords=[];
      }
      if(t.kind==='motion'||(t.kind==='mouse'&&t.code===2)||t.di||t.consumer==='menu-tracker'){
        // The signed x/y are viewport coordinates. Derive the expected client
        // point ourselves through the same renderer mapping; never accept an
        // independently supplied lParam or a merely matching button mask.
        const rect=r.canvas?.getBoundingClientRect?.();
        if(!rect||!(rect.width>0&&rect.height>0)||!Number.isFinite(t.x)||!Number.isFinite(t.y)||
          t.x<rect.left||t.y<rect.top||t.x>=rect.right||t.y>=rect.bottom||
          typeof r._mapExclusiveInputPoint!=='function'||typeof r._clientOriginScreen!=='function')
          throw Error('browser native mouse coordinates refused');
        const x=Math.floor((t.x-rect.left)*r.canvas.width/rect.width),y=Math.floor((t.y-rect.top)*r.canvas.height/rect.height);
        const mapped=r._mapExclusiveInputPoint(x,y),origin=r._clientOriginScreen(scene[2]);
        const clipped=r._applyCursorClip?.(mapped.x,mapped.y)||mapped;
        const cx=mapped.x-origin.x,cy=mapped.y-origin.y;
        if(mapped.outside||clipped.x!==mapped.x||clipped.y!==mapped.y||
          ![x,y,cx,cy].every(Number.isInteger)||
          (t.consumer!=='menu-tracker'&&(cx<0||cy<0||cx>32767||cy>32767)))
          throw Error('browser native mouse client coordinates refused');
        t.point={x,y,lParam:((cy<<16)|cx)>>>0,geometry:pointerGeometry()};
        if(t.kind==='motion'&&!t.di)t.point.wParam=((r._mouseButtonsMask||0)|
          (r._shiftDown?4:0)|(r._ctrlDown?8:0))>>>0;
      }
      receipts.set(t.nonce,t);valid(t);return report(t);
    },
    dequeued(event){
      const t=edges.get(event);if(!t)return 0;
      if(t.di)return false; // A USER return cannot certify this consumer.
      if(scope?.name!=='check_input'||scope.slot!==t.slot||!valid(t))return false;
      if(!t.token){t.token=++serial;tokens.set(t.token,{t,event});}return t.token;
    },
    token:event=>edges.get(event)?.token||0,
    directInput(entry,phase,sequence,word,ptr,values){
      if(scope?.name!=='di_mouse_receipt')return 0;
      entry>>>=0;sequence>>>=0;word>>>=0;
      if([0,1,6,7].includes(phase)){
        const old=diDevices.get(entry);
        if(old)for(const t of receipts.values())if(t.di===old&&['PREPARED','DELIVERY_PENDING'].includes(t.state))
          cancel(t,'DirectInput release/acquisition generation fence');
        diDevices.delete(entry);if(diPoll?.device===old)diPoll=null;
        if(phase===0||phase===7)diDevices.set(entry,{entry,generation:++diEpoch});
        return 0;
      }
      if(phase===8){
        const edge=diEdges.get(sequence);
        if(edge&&edge.word===word){diEdges.delete(sequence);
          if(!edge.up)cancel(edge.t,'native DirectInput record discarded or omitted by data format');}
        return 0;
      }
      if(values.length!==11){
        if(phase===2)return binding?1:0;
        const edge=diEdges.get(sequence);
        if(phase===3&&edge&&!edge.up){cancel(edge.t,'native DirectInput actor metadata unavailable');return -1;}
        return 0;
      }
      const actorScene=values.slice(0,10),device=diDevices.get(entry);
      if(phase===2){
        // Sample actual native caller globals, through the owning RPC seam.
        if(!device||!sceneValid(actorScene)||!healthy())return binding?1:0;
        scene=actorScene.map(n=>n>>>0);sceneAt=now();sceneMonoAt=absoluteMono();
        sceneSource='directinput';slot=scope.slot;
        const c=identity();sceneActor=c.actor;sceneActorWorker=c.actorWorker;
        sceneActorEndpoint=c.actorEndpoint;sceneSoftware=c;boundCurrent(c);
        diPoll={device,slot,scene:scene.slice(),at:now()};return 1;
      }
      const edge=diEdges.get(sequence);if(!edge)return 0;
      const {t}=edge;
      // Independent UP always reaches the consumer, even after DOWN expires.
      const up=edge.up;
      const eligible=device===t.di&&scope.slot===t.slot&&sameScene(t.scene,actorScene)&&
        edge.word===word&&(up?healthy()&&boundCurrent(identity()):valid(t));
      if(phase===3){
        if(!eligible&&!up)cancel(t,'DirectInput owning consumer/scene/deadline fence');
        return eligible?1:up?0:-1;
      }
      if(![4,5].includes(phase)||!eligible)return 0;
      const p=values[10]>>>0,buffer=memory?.buffer;
      if(!ptr||!buffer||p>buffer.byteLength-16)return 0;
      const dv=new DataView(buffer),record={sequence,word,entry,generation:device.generation,
        threadId:actorScene[0],slot:scope.slot,remove:phase===5,ptr:ptr>>>0,
        offset:dv.getUint32(p,true),data:dv.getUint32(p+4,true),
        timestamp:dv.getUint32(p+8,true),nativeSequence:dv.getUint32(p+12,true)};
      // Native calls here after writing an object selected by its data format.
      // Equal bytes alone cannot create a producer edge or a receipt.
      if(phase===4){t.diPeek=record;return 1;}
      diEdges.delete(sequence);
      if(up){t.diUp=record;return 1;}
      t.diRecords.push(record);
      if(t.diRecords.length===t.diSequences.length){t.state='CONSUMED';t.consumedAt=now();}
      return 1;
    },
    validate(token,values){
      if(scope?.name!=='input_validate')return 0;
      if(token===-1){
        // This is an observation of an already executed native message-wait
        // probe, never an input validation/receipt. Late transport cannot
        // make its scene fresh. Retired/reused actor endpoints cannot renew it.
        if(!healthy()||values.length!==13)return 0;
        const candidate=context(values.slice(0,10)),wall=values[10],mono=values[11],endpoint=values[12];
        const actor=scope.slot===wine.guestWorker?.link?.slot?wine.guestWorker.link:
          wine.guestWorker?.threadLinks?.get(scope.slot);
        if(!candidate||[...receipts.values()].some(t=>t.state==='DELIVERY_PENDING'&&t.dialogClaim)||
          !actor?.worker||actor._stopped||actor._stopping||
          actor._retirementComplete||actor.endpointIdentity!==endpoint||
          !Number.isFinite(wall)||!Number.isFinite(mono)||wall<sceneAt||
          now()-wall<0||now()-wall>250||absoluteMono()-mono<0||absoluteMono()-mono>250)return 0;
        scene=candidate.map(n=>n>>>0);sceneAt=wall;sceneMonoAt=mono;
        sceneSource='native_message_wait';slot=scope.slot;
        sceneActor=actor;sceneActorWorker=actor.worker;sceneActorEndpoint=endpoint;
        const current=identity();sceneSoftware=current;boundCurrent(current);return 0;
      }
      if(token===0)return 0x424e49;
      const entry=tokens.get(token);if(!entry||scope.slot!==entry.t.slot)return 0;
      if(entry.t.dialogClaim)return +valid(entry.t,true);
      if(!sameScene(entry.t.scene,context(values)))return +!!cancel(entry.t,'native actor context changed').consumed;
      return +valid(entry.t,true);
    },
    consumed(token,tid,ptr,kind,remove,values){
      const entry=tokens.get(token);if(!entry||scope?.name!=='input_consumed'||scope.slot!==entry.t.slot)return 0;
      const {t,event}=entry;
      if([6,7].includes(kind))return dialogConsumed(t,event,token,tid,ptr,kind,remove,values);
      if(t.dialogClaim||t.scene[4])return 0;
      if(values.length!==11||!sameScene(t.scene,values.slice(0,10))||tid!==t.scene[0]||![1,2,3].includes(kind)||
        ![0,1].includes(remove)||(kind!==2&&remove!==1)||!valid(t,true))return 0;
      const p=values[10]>>>0,buffer=memory.buffer;
      if(p>buffer.byteLength-16)return 0;
      const dv=new DataView(buffer),message=Object.fromEntries(['hwnd','msg','wParam','lParam'].map((k,i)=>[k,dv.getUint32(p+4*i,true)]));
      if(message.hwnd!==t.scene[2]||['msg','wParam','lParam'].some(k=>message[k]!==event[k]>>>0))return 0;
      if(t.point&&!exact(message,t))return 0;
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
      terminal=true;for(const t of receipts.values())if(!['CONSUMED','MENU_HANDLED'].includes(t.state))cancel(t,reason,true);
    },
  };
  // Both routes retain the real renderer event and require the same native
  // MSG return. DOM 2 / VK_RBUTTON 2 is WM_RBUTTONDOWN, never a surrogate.
  const kind=t=>t.kind||'key';
  function pointerGeometry(){
    const rect=r.canvas?.getBoundingClientRect?.(),origin=r._clientOriginScreen?.(scene?.[2]);
    return JSON.stringify([r.canvas?.width,r.canvas?.height,rect?.left,rect?.top,rect?.width,rect?.height,
      origin?.x,origin?.y,globalThis.innerWidth,globalThis.innerHeight,globalThis.devicePixelRatio,
      globalThis.document?.hasFocus(),globalThis.document?.visibilityState]);
  }
  const exact=(event,t)=>kind(t)==='motion'?
    event.msg===0x200&&event.wParam===t.point.wParam&&(event.lParam>>>0)===t.point.lParam:
    kind(t)==='mouse'?(t.code===2?
    event.msg===0x204&&event.wParam===2&&(event.lParam>>>0)===t.point.lParam:
    event.msg===0x201&&!!(event.wParam&1)):
    [0x100,0x104].includes(event.msg)&&event.wParam===t.code;
  // The compositor instance's existing WAT pointer receipt is distinct from
  // an owning CPUWorker's client MSG return. Never label one as the other.
  function menuResult(t,sequence){
    const e=wine.instance.exports,f=e.native_menu_pointer_receipt;
    const w=Array.from({length:9},(_,i)=>f(i)),open=e.menu_open_hwnd()>>>0;
    if(w.some(n=>typeof n!=='bigint')||w[0]!==sequence+1n||
      w[1]!==BigInt(t.scene[6])+(BigInt(t.scene[7])<<32n)||w[2]!==BigInt(t.scene[2])||
      w[3]!==BigInt(t.scene[1])||w[4]!==BigInt(t.scene[0])||
      w[5]!==BigInt(t.point.x>>>0)||w[6]!==BigInt(t.point.y>>>0)||
      (t.menuAction==='open'?(w[7]!==1n||open!==t.scene[2]):
        (w[7]!==2n||w[8]!==BigInt(t.commandId)||open!==0)))return null;
    return {hwnd:t.scene[2],action:t.menuAction,commandId:t.menuAction==='select'?Number(w[8]):null,
      words:w.map(String),openHwnd:open,x:t.point.x,y:t.point.y,at:now(),
      consumption:'synchronous-menu-tracker-return',nativeClientConsumed:false};
  }
  function applyDown(type,code,fn,args){
    if(!binding)return fn.apply(r,args);
    const pending=[...receipts.values()].filter(t=>t.state==='PREPARED');
    const t=pending.length===1&&pending[0];
    if(!t||kind(t)!==type||t.code!==code||!trusted(type==='key'?'keydown':type==='motion'?'mousemove':'mousedown',code)||!valid(t)||
      (t.point&&(args[0]!==t.point.x||args[1]!==t.point.y)))return;
    const before=new Set(r.inputQueue);t.state='APPLYING';
    if(t.di)diApplying={t,up:false};
    const menuSequence=t.consumer==='menu-tracker'?wine.instance.exports.native_menu_pointer_receipt(0):null;
    try{
      const result=fn.apply(r,args);t.appliedAt=now();
      if(t.ownershipCancellation){
        for(const event of r.inputQueue)if(!before.has(event)&&exact(event,t))edges.set(event,t);
        cancel(t,'browser input ownership cancelled: '+t.ownershipCancellation.reason,true);
        return result;
      }
      if(t.di){
        for(const event of r.inputQueue)if(!before.has(event)&&(type==='motion'?event.msg===0x200:exact(event,t)))edges.set(event,t);
        if(!t.diSequences.length)cancel(t,'physical handler produced no native ring record',true);
        else t.state='DELIVERY_PENDING';
        return result;
      }
      if(t.consumer==='menu-tracker'){
        t.state='DELIVERY_PENDING';
        t.menuReceipt=menuResult(t,menuSequence);
        // A misdirected menu intent must not leave a client edge unguarded.
        // Associate every newly produced edge before any refusal/expiry.
        for(const event of r.inputQueue)if(!before.has(event))edges.set(event,t);
        if(!t.menuReceipt||r.inputQueue.some(e=>!before.has(e)&&exact(e,t)))
          cancel(t,'physical handler did not produce exact menu tracker result',true);
        else if(valid(t)){t.state='MENU_HANDLED';}
        return result;
      }
      const produced=r.inputQueue.filter(e=>!before.has(e)&&exact(e,t));
      if(produced.length!==1){
        for(const event of r.inputQueue)if(!before.has(event)&&(t.point||exact(event,t)))edges.set(event,t);
        cancel(t,'physical handler did not produce exact DOWN',true);return result;
      }
      edges.set(produced[0],t);t.state='DELIVERY_PENDING';return result;
    }catch(error){
      for(const event of r.inputQueue)if(!before.has(event)&&(t.point||exact(event,t)))edges.set(event,t);
      cancel(t,'physical handler exception: '+error.message,true);throw error;
    }finally{diApplying=null;}
  }
  function physicalUp(type,code,physical){
    for(const t of receipts.values())if(kind(t)===type&&t.code===code&&!t.physicalUp&&!t.ownershipCancellation&&
      (t.appliedAt||t.rightUpEntered||['PREPARED','DELIVERY_PENDING'].includes(t.state))){
      // A delayed DOWN must never become held after its independent UP has
      // already returned. Keep the nonce terminal even before any dequeue.
      if(!t.appliedAt)cancel(t,'physical UP preceded DOWN',true);
      else if(!t.di&&t.state==='DELIVERY_PENDING')cancel(t,'physical UP preceded native USER return',true);
      t.physicalUp={nonce:t.nonce,code,kind:type,at:now(),trusted:physical,
        down:!!r.peekKeyDownState(code),owner:binding?.owner};
      if(typeof window!=='undefined')console.log('GLTRON_NATIVE_PHYSICAL_UP',JSON.stringify(t.physicalUp));
    }
  }
  const down=r.handleKeyDown,up=r.handleKeyUp;
  r.handleKeyDown=function(code,...args){return applyDown('key',code,down,[code,...args]);};
  r.handleKeyUp=function(code,...args){
    const reason=args[0]?.browserInputCancellation;
    const physical=!reason&&trusted('keyup',code);
    // Retire receipt ownership before calling the renderer: its wake hooks
    // may reenter input, throw, or establish a newer ownership of this key.
    if(reason){
      for(const t of receipts.values())if(kind(t)==='key'&&t.code===code&&!t.physicalUp&&
        !t.ownershipCancellation&&(t.appliedAt||['PREPARED','APPLYING','DELIVERY_PENDING'].includes(t.state))){
        t.ownershipCancellation={reason,at:now(),code,owner:binding?.owner};
        if(['PREPARED','DELIVERY_PENDING'].includes(t.state))cancel(t,'browser input ownership cancelled: '+reason,true);
      }
    }
    const result=up.call(this,code,...args);
    if(physical)physicalUp('key',code,true);
    return result;
  };
  // Keep renderers without pointer handlers (including CLI/unit fixtures) valid.
  const mouseDown=r.handleMouseDown,mouseUp=r.handleMouseUp;
  const published=r._directInputMousePublished;
  r._directInputMousePublished=function(inputMemory,sequence,word){
    published?.call(this,inputMemory,sequence,word);
    const application=diApplying;if(!application||inputMemory!==memory)return;
    const {t,up}=application,type=word>>>28;
    if(kind(t)==='motion'?![5,6].includes(type):type!==(t.code===1?(up?2:1):(up?4:3)))return;
    const previous=diEdges.get(sequence>>>0);
    if(previous)cancel(previous.t,'DirectInput ring position reused',true);
    diEdges.set(sequence>>>0,{t,up,word:word>>>0});
    if(!up)t.diSequences.push(sequence>>>0);
  };
  const mouseMove=r.handleMouseMove;
  if(typeof mouseMove==='function')r.handleMouseMove=function(x,y,...args){
    if(!binding||![...receipts.values()].some(t=>t.state==='PREPARED'&&kind(t)==='motion'))
      return mouseMove.call(this,x,y,...args);
    return applyDown('motion',1,mouseMove,[x,y,...args]);
  };
  if(typeof mouseDown==='function')r.handleMouseDown=function(x,y,button,...args){
    return applyDown('mouse',button===0?1:button===2?2:-1,mouseDown,[x,y,button,...args]);
  };
  if(typeof mouseUp==='function')r.handleMouseUp=function(x,y,button,...args){
    const physical=trusted('mouseup',button===0?1:button===2?2:-1);
    // An UP handler that throws still retires every pending right DOWN.
    // Receipt emission remains after the real handler and reports held state.
    if(button===2)for(const t of receipts.values())if(t.point&&!t.physicalUp&&
      (t.appliedAt||['PREPARED','DELIVERY_PENDING'].includes(t.state))){
      if(!t.di&&['PREPARED','DELIVERY_PENDING'].includes(t.state))cancel(t,'physical UP preceded native USER return',true);
      t.rightUpEntered=true;
    }
    const upTicket=[...receipts.values()].reverse().find(t=>t.di&&kind(t)==='mouse'&&
      t.code===(button===0?1:button===2?2:-1)&&t.appliedAt&&!t.physicalUp);
    if(upTicket)diApplying={t:upTicket,up:true};
    let result;
    try{result=mouseUp.call(this,x,y,button,...args);}
    finally{diApplying=null;if(button===2)physicalUp('mouse',2,physical);}
    if(button===0)physicalUp('mouse',1,physical);return result;
  };
  return api;
}
if (typeof module !== 'undefined' && module.exports) module.exports={createBrowserNativeInput};
else globalThis.createBrowserNativeInput=createBrowserNativeInput;
})();
