'use strict';
// Passive capability observation, never an input adapter or delivery ACK.
// Retain the actual installed import scopes rather than calling getImports
// again (which would create a different host context).
function installNativeRouteObserver(root,Wine=root.WineAssembly) {
  if(root.__gltronNativeRoutes)throw Error('native route observer already installed');
  const routes=root.__gltronNativeRoutes=[];
  const p=Wine.prototype,original=p.getImports;
  p.getImports=function(){const imports=original.apply(this,arguments);
    routes.push({wine:this,ctx:this.hostCtx,host:imports.host});return imports;};
}
function inspectNativeRoute(root,wine) {
  const rows=(root.__gltronNativeRoutes||[]).filter(r=>r.wine===wine);
  return {at:Date.now(),processId:wine.processId,running:!!wine.running,stopped:!!wine._stopped,
    guestWorker:!!wine.guestWorker,scopes:rows.map(r=>({
      currentContext:r.ctx===wine.hostCtx,
      guardedInput:!!r.ctx?.guardedInput,
      nativeInputActor:typeof r.ctx?.nativeInputActor==='function',
      tokenImport:typeof r.host?.check_input_token==='function',
      tokenImportSource:r.host?.check_input_token?.toString()??null,
      consumedImport:typeof r.host?.input_consumed==='function'})),
    nativeInputQualified:false,downEffects:0,
    bridge:wine._browserNativeInput?.snapshot?.()||null,
    reason:'Capability observation cannot establish native API return or physical UP'};
}
function requireNativeRoute(audit,proof) {
  if(!audit.running||audit.stopped||!audit.guestWorker||!audit.scopes.length||
    audit.scopes.some(s=>!s.currentContext||!s.guardedInput||!s.nativeInputActor||!s.tokenImport||!s.consumedImport))
    throw Error('NATIVE_INPUT_UNAVAILABLE: actual browser import scope lacks guarded native actor/token authority; no DOWN permitted');
  // Even an installed capability must pass the actual same-path qualification.
  if(!proof?.consumed||proof.receiptBoundary!=='owner-worker-native-user-return'||
    proof.nativeMessage?.consumption!=='owner-user-return'||!proof.nativeMessage.token)
    throw Error('NATIVE_INPUT_UNQUALIFIED: capability presence is not native API-return/physical-UP proof');
  return proof;
}
// Startup can publish a GL clear before the first native USER poll. Observe
// that poll without calling bind, injecting an event, or entering idle WASM.
function observeAndBindNativeOwner(wine) {
  const guard=wine?._browserNativeInput;
  if(!guard)throw Error('browser native owner bridge missing');
  const state=guard.snapshot();
  // Readiness and bind share this synchronous page task. In particular a
  // screenshot cannot consume the 250ms native-context freshness interval
  // between these two operations. Bind itself rechecks every owner fence.
  if(state.ready&&!state.bound)return {...state,bound:true,binding:guard.bind(),boundAt:Date.now()};
  return state;
}
// A reviewed image may remain valid while the last native poll ages out.
// Wait for a genuinely new owning USER observation; never create an expiring
// ticket from that stale scene, rebind, or drive a guest poll to refresh it.
function observeAndPrepareNativeIntent(wine,intent,notBefore) {
  const guard=wine?._browserNativeInput;
  if(!guard)throw Error('browser native owner bridge missing');
  const state=guard.snapshot();
  if(!state.bound)throw Error('browser native owner is not bound');
  if(!state.healthy||state.terminal)return {...state,ready:false};
  if(!state.ready||state.observedAt<=notBefore)return {...state,ready:false};
  const prepared=guard.prepare(intent);
  return {...state,prepared,preparedAt:Date.now()};
}
async function waitForNativeOwner({observe,deadline,record=()=>{},close=()=>{},
  now=Date.now,wait=ms=>new Promise(r=>setTimeout(r,ms))}) {
  let timer,count=0,closed=false;
  const fail=error=>{if(!closed){closed=true;close();}return error;};
  try{return await Promise.race([
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(fail(Error('NATIVE_OWNER_UNKNOWN startup deadline; permanently closed'))),Math.max(0,deadline-now()));}),
    (async()=>{for(;;){
      if(closed||now()>=deadline)throw fail(Error('NATIVE_OWNER_UNKNOWN startup deadline; permanently closed'));
      const state=await observe();
      if(closed||now()>=deadline)throw fail(Error('NATIVE_OWNER_UNKNOWN late observation discarded'));
      if(count++<256||state.ready||state.terminal||!state.healthy)record({at:now(),state});
      if(state.terminal||!state.healthy)throw fail(Error('NATIVE_OWNER_UNKNOWN retired actor; permanently closed'));
      if(state.ready)return state;
      await wait(25);
    }})(),
  ]);}catch(error){throw fail(error);}finally{clearTimeout(timer);}
}
module.exports={installNativeRouteObserver,inspectNativeRoute,requireNativeRoute,waitForNativeOwner,observeAndBindNativeOwner,observeAndPrepareNativeIntent};

// Dedicated physical-release participant. Arm before DOWN, then send only UP
// on its immutable deadline, even if the parent stops running. Observe the
// ordinary trusted DOM/renderer UP return through events, never a later query.
async function release(out,file){
  const fs=require('node:fs'),assert=require('node:assert/strict');
  const cfg=JSON.parse(fs.readFileSync(file)),{connection}=require('./gltron-browser-controller.cjs');
  const stat=fs.readFileSync('/proc/'+cfg.pid+'/stat','utf8').split(') ').at(-1).split(' ')[19];assert.equal(stat,cfg.startToken);
  const c=connection(cfg.url);let receipt=null,stdout='';
  try{
    await c.ready;const session=(await c.send('Target.attachToTarget',{targetId:cfg.targetId,flatten:true})).sessionId;
    await c.send('Runtime.enable',{},session);
    c.event=v=>{if(v.sessionId===session&&v.method==='Runtime.consoleAPICalled'&&v.params.args?.[0]?.value==='GLTRON_NATIVE_PHYSICAL_UP'){
      const value=JSON.parse(v.params.args[1].value);if(value.nonce===cfg.nonce)receipt=value;
    }};
    const armed=Date.now(),fallback=armed+1750;let due=fallback,cancelNoDown=false;
    process.stdin.on('data',b=>{stdout+=b;const i=stdout.indexOf('\n');if(i>=0){const v=JSON.parse(stdout.slice(0,i));
      if(v.cancelNoDown===true){cancelNoDown=true;return;}
      assert(v.at>=armed&&v.at<=fallback);due=Math.min(due,v.at);}});
    process.stdout.write(JSON.stringify({armed:true,at:armed,fallback,pid:process.pid})+'\n');
    while(!cancelNoDown&&Date.now()<due)await new Promise(r=>setTimeout(r,Math.min(5,due-Date.now())));
    if(cancelNoDown){fs.writeFileSync(out+'/'+cfg.name+'-up.json',JSON.stringify({armed,fallback,cancelNoDown:true,inputDispatches:0,independent:true})+'\n',{flag:'wx'});return;}
    const fired=Date.now();await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:cfg.key,code:cfg.key,windowsVirtualKeyCode:cfg.code},session);
    const ack=Date.now();while(!receipt&&Date.now()<fallback+500)await new Promise(r=>setTimeout(r,5));
    fs.writeFileSync(out+'/'+cfg.name+'-up.json',JSON.stringify({armed,fallback,due,fired,ack,receipt,independent:true})+'\n',{flag:'wx'});
    assert(receipt?.trusted&&!receipt.down,'independent trusted physical UP missing');
  }finally{c.ws.close();process.stdin.destroy();}
}
if(require.main===module&&process.argv[2]==='release')release(process.argv[3],process.argv[4]).catch(e=>{console.error(e);process.exitCode=1;});

// Connect once before the reviewed input interval. Per-edge arming is local
// IPC, independent of Node startup, WebSocket negotiation and Runtime.enable.
// No key is armed by connection readiness; every edge gets its own 1750ms
// deadline, nonce, cancellation and actual trusted renderer-UP receipt.
async function releaseParticipant(out,file){
  const fs=require('node:fs'),assert=require('node:assert/strict');
  const cfg=JSON.parse(fs.readFileSync(file)),{connection}=require('./gltron-browser-controller.cjs');
  const phase=(name,extra={})=>fs.appendFileSync(out+'/release-phases.jsonl',JSON.stringify({name,at:Date.now(),...extra})+'\n');
  const identity=()=>assert.equal(fs.readFileSync('/proc/'+cfg.pid+'/stat','utf8').split(') ').at(-1).split(' ')[19],cfg.startToken,'release browser identity changed');
  const emit=v=>process.stdout.write(JSON.stringify(v)+'\n');
  let active=null,ended=false,task=null;const nonces=new Set();
  phase('started',{processStartedAt:Date.now()-process.uptime()*1000});identity();const c=connection(cfg.url);
  try{
    await c.ready;phase('websocket-ready');
    const session=(await c.send('Target.attachToTarget',{targetId:cfg.targetId,flatten:true})).sessionId;phase('target-attached');
    await c.send('Runtime.enable',{},session);phase('runtime-enabled');
    c.event=v=>{if(v.sessionId===session&&v.method==='Runtime.consoleAPICalled'&&v.params.args?.[0]?.value==='GLTRON_NATIVE_PHYSICAL_UP'){
      const receipt=JSON.parse(v.params.args[1].value);if(active&&receipt.nonce===active.nonce)active.receipt=receipt;
    }};
    const done=new Promise((resolve,reject)=>{
      const finish=()=>{if(ended&&!task)resolve();};
      let buffer='';
      process.stdin.on('end',()=>{ended=true;finish();});
      process.stdin.on('data',b=>{buffer+=b;let i;try{while((i=buffer.indexOf('\n'))>=0){
        const v=JSON.parse(buffer.slice(0,i));buffer=buffer.slice(i+1);
        identity();assert(!c.closed,'release connection retired');
        if(v.command==='arm'){
          assert(!active&&!nonces.has(v.nonce)&&typeof v.nonce==='string');
          assert(/^action-\d+$/.test(v.name)&&Number.isInteger(v.code)&&v.code>0&&typeof v.key==='string');
          nonces.add(v.nonce);const armed=Date.now();active={...v,armed,fallback:armed+1750,due:armed+1500,receipt:null};
          const a=active;phase('armed',{nonce:a.nonce});emit({event:'armed',nonce:a.nonce,armed:true,at:armed,fallback:a.fallback,releaseDue:a.due,pid:process.pid});
          task=(async()=>{
            while(!a.cancelNoDown&&Date.now()<a.due)await new Promise(r=>setTimeout(r,Math.max(1,Math.min(5,a.due-Date.now()))));
            if(a.cancelNoDown){
              fs.writeFileSync(out+'/'+a.name+'-up.json',JSON.stringify({armed:a.armed,fallback:a.fallback,cancelNoDown:true,inputDispatches:0,independent:true})+'\n',{flag:'wx'});
            }else{
              identity();assert(!c.closed);a.fired=Date.now();
              await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:a.key,code:a.key,windowsVirtualKeyCode:a.code},session);a.ack=Date.now();
              while(!a.receipt&&Date.now()<a.fallback+500)await new Promise(r=>setTimeout(r,5));
              fs.writeFileSync(out+'/'+a.name+'-up.json',JSON.stringify({...a,independent:true})+'\n',{flag:'wx'});
              assert(a.fired<=a.fallback+50&&a.receipt?.trusted&&!a.receipt.down,'independent trusted physical UP missing or late');
            }
            active=null;phase('done',{nonce:a.nonce});emit({event:'done',nonce:a.nonce,ok:true,cancelNoDown:!!a.cancelNoDown});
          })().then(()=>{task=null;finish();},reject);
        }else{
          assert(active&&active.nonce===v.nonce,'release nonce is stale');
          if(v.command==='cancel')active.cancelNoDown=true;
          else{assert(v.command==='due'&&v.at>=active.armed&&v.at<=active.fallback);active.due=Math.min(active.due,v.at);}
        }
      }}catch(e){reject(e);}});
      emit({event:'ready',pid:process.pid,at:Date.now(),inputDispatches:0});
    });
    await done;
  }finally{c.ws.close();process.stdin.destroy();phase('closed');}
}
async function createReleaseParticipant(out,cfg){
  const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path');
  const file=out+'/release-participant.json';fs.writeFileSync(file,JSON.stringify(cfg)+'\n',{flag:'wx'});
  const child=cp.spawn(process.execPath,[__filename,'participant',out,file],{stdio:['pipe','pipe','pipe']});
  let stdout='',stderr='',lines='',failure=null,closed=false;const messages=[],waiters=new Set();
  const notify=()=>{for(const f of waiters)f();};
  child.stdin.on('error',error=>{failure??=error;notify();});
  child.on('error',error=>{failure??=error;notify();});
  child.stdout.on('data',b=>{stdout+=b;lines+=b;let i;while((i=lines.indexOf('\n'))>=0){messages.push(JSON.parse(lines.slice(0,i)));lines=lines.slice(i+1);}notify();});
  child.stderr.on('data',b=>stderr+=b);
  const joined=new Promise(resolve=>child.once('close',(code,signal)=>{failure=Error('independent release participant closed '+code+' '+stderr);notify();
    const receipt={pid:child.pid,code,signal,actualWait:true,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,stdout,stderr};
    fs.writeFileSync(path.join(out,'release-participant-wait.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});resolve(receipt);
  }));
  const receive=(event,nonce,ms)=>new Promise((resolve,reject)=>{
    let timer;const check=()=>{const found=messages.find(v=>v.event===event&&(nonce===undefined||v.nonce===nonce));
      if(!found&&!failure)return;clearTimeout(timer);waiters.delete(check);found?resolve(found):reject(failure);};
    timer=setTimeout(()=>{waiters.delete(check);reject(Error('independent physical UP '+event+' deadline'));},ms);waiters.add(check);check();
  });
  const send=v=>{if(failure)throw failure;child.stdin.write(JSON.stringify(v)+'\n');};
  const nonces=new Set();
  const api={get alive(){return !failure;},
    async arm(v){if(nonces.has(v.nonce))throw Error('independent release nonce is stale');nonces.add(v.nonce);
      const at=Date.now();send({...v,command:'arm'});const result=await receive('armed',v.nonce,1000);return {...result,requestedAt:at,latencyMs:Date.now()-at};},
    due:(nonce,at)=>send({command:'due',nonce,at}),cancel:nonce=>send({command:'cancel',nonce}),
    finish:nonce=>receive('done',nonce,3000),
    async close(){if(!closed){closed=true;child.stdin.end();}return joined;},
  };
  try{await receive('ready',undefined,1000);return api;}catch(e){child.stdin.end();await joined;throw e;}
}
module.exports.createReleaseParticipant=createReleaseParticipant;
if(require.main===module&&process.argv[2]==='participant')releaseParticipant(process.argv[3],process.argv[4]).catch(e=>{console.error(e);process.exitCode=1;});

// UP must finish even after native refusal. Retain the first failure and the
// independent release failure together: a null UP receipt cannot explain why
// the native DOWN was refused, nor replace its authoritative status.
async function finishNativeRelease(participant,nonce,nativeError){
  try{return await participant.finish(nonce);}catch(releaseError){
    if(nativeError)throw new AggregateError([nativeError,releaseError],
      'native input failed: '+nativeError.message+'; independent physical release failed: '+releaseError.message,
      {cause:nativeError});
    throw releaseError;
  }
}
module.exports.finishNativeRelease=finishNativeRelease;

// The 500ms delivery deadline covers DOWN and the native status reply. A loop
// condition alone cannot reject a CONSUMED reply that arrives after its final
// await, or prevent a later status query following a stalled DOWN callback.
async function waitForNativeConsumption({dispatch,observe,deadline,close,record=()=>{},
  now=Date.now,monotonic=()=>performance.now(),wait=ms=>new Promise(r=>setTimeout(r,ms))}){
  let timer,closed=false;const until=monotonic()+Math.max(0,deadline-now());
  const fail=message=>{if(!closed){closed=true;close();}return Error('NATIVE_INPUT_UNKNOWN '+message+'; permanently closed');};
  const expired=()=>closed||now()>=deadline||monotonic()>=until;
  try{return await Promise.race([
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(fail('500ms delivery deadline')),Math.max(0,deadline-now()));}),
    (async()=>{
      if(expired())throw fail('500ms delivery deadline before DOWN');
      await dispatch();
      for(;;){
        if(expired())throw fail('late DOWN/status boundary');
        const proof=await observe(),receivedAt=now(),receivedMonotonic=monotonic();
        const late=closed||receivedAt>=deadline||receivedMonotonic>=until;
        record({receivedAt,receivedMonotonic,late,proof});
        if(late)throw fail('late native status reply discarded');
        if(proof.state==='CONSUMED')return proof;
        if(!['DELIVERY_PENDING','PREPARED'].includes(proof.state))
          throw Error('native input refused: '+JSON.stringify(proof));
        await wait(5);
      }
    })(),
  ]);}finally{clearTimeout(timer);}
}
module.exports.waitForNativeConsumption=waitForNativeConsumption;
