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
module.exports={installNativeRouteObserver,inspectNativeRoute,requireNativeRoute,waitForNativeOwner};

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
    const armed=Date.now(),fallback=armed+1750;let due=fallback;
    process.stdin.on('data',b=>{stdout+=b;const i=stdout.indexOf('\n');if(i>=0){const v=JSON.parse(stdout.slice(0,i));assert(v.at>=armed&&v.at<=fallback);due=Math.min(due,v.at);}});
    process.stdout.write(JSON.stringify({armed:true,at:armed,fallback,pid:process.pid})+'\n');
    while(Date.now()<due)await new Promise(r=>setTimeout(r,Math.min(5,due-Date.now())));
    const fired=Date.now();await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:cfg.key,code:cfg.key,windowsVirtualKeyCode:cfg.code},session);
    const ack=Date.now();while(!receipt&&Date.now()<fallback+500)await new Promise(r=>setTimeout(r,5));
    fs.writeFileSync(out+'/'+cfg.name+'-up.json',JSON.stringify({armed,fallback,due,fired,ack,receipt,independent:true})+'\n',{flag:'wx'});
    assert(receipt?.trusted&&!receipt.down,'independent trusted physical UP missing');
  }finally{c.ws.close();process.stdin.destroy();}
}
if(require.main===module&&process.argv[2]==='release')release(process.argv[3],process.argv[4]).catch(e=>{console.error(e);process.exitCode=1;});
