'use strict';
(function(){
// Opt-in browser receipt bridge. Physical input still enters through the
// browser and the renderer; only the owning Worker's native USER return can
// confirm its exact edge. No callback runs on the page's idle guest instance.
function createBrowserNativeInput(wine, {now=Date.now, monotonic=()=>performance.now(),
  trusted=()=>typeof window!=='undefined' && window.event?.isTrusted===true}={}) {
  const receipts=new Map(), edges=new WeakMap(), tokens=new Map();
  let serial=0, binding=null, scene=null, sceneAt=0, slot=null, scope=null, terminal=false;
  const r=wine.renderer, process=wine._processObject;
  let memory=null;
  const identity=()=>{const gl=wine.hostCtx?.getGlGpsBridge?.(),legacy=wine.hostCtx?.getD3dimBridge?.();
    const gps=gl||legacy,endpoint=gps?.endpoint,manager=legacy&&!gl?endpoint?.manager:null;
    return {renderer:wine.renderer,memory:wine.memory,buffer:wine.memory?.buffer,
    process:wine._processObject,instance:wine.instance,worker:wine.guestWorker,
    link:wine.guestWorker?.link,gps,gl,legacy,endpoint,device:gps?.device,
    manager,renderWorker:manager?.worker,renderModule:manager?.options?.module,
    renderMemory:manager?.options?.memory,endpointOptions:manager?endpoint?.options:null,
    endpointId:manager?endpoint?.id:null,endpointApi:manager?endpoint?.options?.api:null,
    epoch:gps?.workerEpoch,layer:gps?.presenter?.layer,source:gps?.presenter?.layer?.canvas,canvas:r.canvas,
    queue:r.inputQueue,window:r.windows[scene?.[2]]};};
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
    receiptBoundary:'owner-worker-native-user-return',nativeMessage:t.nativeMessage||null,noReplay:true});
  const cancel=(t,reason,unknown=false)=>{
    if (t.state==='UNKNOWN') return report(t);
    t.state=unknown?'UNKNOWN':'CANCELLED';t.reason=reason;
    for(let i=r.inputQueue.length-1;i>=0;i--)if(edges.get(r.inputQueue[i])===t)r.inputQueue.splice(i,1);
    return report(t);
  };
  const healthy=()=>!terminal&&wine.running&&!wine._stopped&&!process.exited&&wine._processObject===process&&
    (!memory||wine.memory===memory)&&!!wine.guestWorker;
  const sceneValid=s=>Array.isArray(s)&&s.length===10&&s.every(Number.isInteger)&&
    s[0]>0&&s[1]===wine.processId&&s[2]>0&&s[3]===s[2]&&!s[4]&&!s[5]&&!!(s[6]||s[7])&&
    s[6]===s[8]&&s[7]===s[9];
  const sameScene=(a,b)=>a?.length===10&&b?.length===10&&a.every((n,i)=>(n>>>0)===(b[i]>>>0));
  const ready=()=>{
    const current=identity(),win=current.window;
    return healthy()&&sceneValid(scene)&&now()-sceneAt<=250&&!!win?.visible&&
      win.processId===wine.processId&&win.wasm===wine.instance&&!!current.endpoint&&
      !current.endpoint.closed&&!current.gps?.workerAsyncError&&!current.gps?.workerClosing&&renderOwnerValid(current);
  };
  const valid=t=>{
    if(!['PREPARED','DELIVERY_PENDING'].includes(t.state))return false;
    const current=identity(),win=current.window;
    if(!healthy()||!binding||!renderOwnerValid(current)||current.endpoint?.closed||current.gps?.workerAsyncError||current.gps?.workerClosing||
      !sceneValid(scene)||now()-sceneAt>250||Object.keys(binding.refs).some(k=>current[k]!==binding.refs[k])||
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
      scene=values.map(n=>n>>>0);sceneAt=now();slot=scope.slot;return true;
    },
    snapshot(){return {scene:scene?.slice(),observedAt:scene?sceneAt:null,slot,healthy:healthy(),ready:ready(),bound:!!binding,terminal};},
    sweep(){for(const t of receipts.values())valid(t);},
    owns(event){const t=edges.get(event);return !t||scope?.slot===t.slot;},
    bind(){
      if(binding||terminal||!ready())throw Error('browser native owner unavailable or already bound');
      memory=wine.memory;
      binding={owner:crypto.randomUUID(),refs:identity()};
      if(!binding.refs.window?.visible||!binding.refs.endpoint||binding.refs.endpoint.closed)
        throw Error('browser native target unavailable');
      return {owner:binding.owner,scene:scene.slice(),slot};
    },
    prepare(intent){
      if(!binding||intent.owner!==binding.owner||intent.reviewed!==true||
        typeof intent.nonce!=='string'||!intent.nonce||receipts.has(intent.nonce)||
        !Number.isInteger(intent.code)||intent.code<1||intent.code>254||
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
      if(token===0)return 0x424e49;
      const entry=tokens.get(token);if(!entry||scope.slot!==entry.t.slot)return 0;
      if(!sameScene(entry.t.scene,values))return +!!cancel(entry.t,'native actor context changed').consumed;
      if(entry.t.state==='CONSUMED')return +!!(healthy()&&binding&&sameScene(scene,values));
      return +valid(entry.t);
    },
    consumed(token,tid,ptr,kind,remove,values){
      const entry=tokens.get(token);if(!entry||scope?.name!=='input_consumed'||scope.slot!==entry.t.slot)return 0;
      const {t,event}=entry;
      if(values.length!==11||!sameScene(t.scene,values.slice(0,10))||tid!==t.scene[0]||![1,2,3].includes(kind)||
        ![0,1].includes(remove)||(kind!==2&&remove!==1)||!valid(t))return 0;
      const p=values[10]>>>0,buffer=memory.buffer;
      if(p>buffer.byteLength-16)return 0;
      const dv=new DataView(buffer),message=Object.fromEntries(['hwnd','msg','wParam','lParam'].map((k,i)=>[k,dv.getUint32(p+4*i,true)]));
      if(message.hwnd!==t.scene[2]||['msg','wParam','lParam'].some(k=>message[k]!==event[k]>>>0))return 0;
      t.state='CONSUMED';t.consumedAt=now();t.nativeMessage={...message,threadId:tid,slot:scope.slot,
        token,apiKind:kind,remove:!!remove,consumption:'owner-user-return'};return 1;
    },
    status(nonce){const t=receipts.get(nonce);if(!t)throw Error('unknown browser native nonce');valid(t);return report(t);},
    close(reason='transport UNKNOWN'){
      terminal=true;for(const t of receipts.values())if(t.state!=='CONSUMED')cancel(t,reason,true);
    },
  };
  const down=r.handleKeyDown;
  const up=r.handleKeyUp;
  r.handleKeyUp=function(code,...args){
    const physical=trusted();const result=up.call(this,code,...args);
    for(const t of receipts.values())if(t.code===code&&t.appliedAt&&!t.physicalUp){
      t.physicalUp={nonce:t.nonce,code,at:now(),trusted:physical,
        down:!!r.peekKeyDownState(code),owner:binding?.owner};
      if(typeof window!=='undefined')console.log('GLTRON_NATIVE_PHYSICAL_UP',JSON.stringify(t.physicalUp));
    }
    return result;
  };
  r.handleKeyDown=function(code,...args){
    const pending=[...receipts.values()].filter(t=>t.state==='PREPARED');
    if(!binding)return down.call(this,code,...args);
    const t=pending.length===1&&pending[0];
    if(!t||code!==t.code||!trusted()||!valid(t))return;
    const before=new Set(r.inputQueue);t.state='APPLYING';
    try{
      down.call(this,code,...args);t.appliedAt=now();
      const produced=r.inputQueue.filter(e=>!before.has(e)&&[0x100,0x104].includes(e.msg)&&e.wParam===code);
      if(produced.length!==1){cancel(t,'physical handler did not produce exact DOWN',true);return;}
      edges.set(produced[0],t);t.state='DELIVERY_PENDING';
    }catch(error){
      // A handler can enqueue its DOWN before throwing. Tag it before closing
      // so cancellation removes that edge instead of leaking an unowned key.
      for(const event of r.inputQueue)if(!before.has(event)&&[0x100,0x104].includes(event.msg)&&event.wParam===code)edges.set(event,t);
      cancel(t,'physical handler exception: '+error.message,true);throw error;
    }
  };
  return api;
}
if (typeof module !== 'undefined' && module.exports) module.exports={createBrowserNativeInput};
else globalThis.createBrowserNativeInput=createBrowserNativeInput;
})();
