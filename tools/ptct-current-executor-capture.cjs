'use strict';
// Capture-only integration over immutable current source. No product fallback,
// GL state, chooser policy, clock or scheduling changes. Native qualification
// of these diagnostic wrappers is required before any original launch.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function installExecutorObserver(root) {
  if(root.__ptctExecutorObserver)throw Error('PTCT observer already installed');
  const ids=new WeakMap(),runs=new WeakMap();let next=0,binding=null;
  const epoch=root.crypto.randomUUID(),token=o=>{
    if(!o||!['object','function'].includes(typeof o))return null;
    if(!ids.has(o))ids.set(o,epoch+':'+(++next));return ids.get(o);
  };
  const api={bind(module,instance,memory,role){
    binding={module,instance,memory,role,generation:(binding?.generation||0)+1};
  },track(executor,opcodes){
    if(runs.has(executor))return;
    const state={completed:0,failed:0,draws:0,presents:0,records:[]};runs.set(executor,state);
    const execute=executor.execute;
    executor.execute=function(record,...args){
      let value;
      try {value=execute.call(this,record,...args);}catch(error){state.failed++;throw error;}
      try {state.completed++;
        if(opcodes&&(record.op===opcodes.OP_DRAW||record.op===opcodes.OP_DRAW_UP))state.draws++;
        if(opcodes&&record.op===opcodes.OP_PRESENT)state.presents++;
        state.records.push({op:record.op,seq:record.seq,at:root.performance.now()});
        if(state.records.length>64)state.records.shift();
      }catch(error){state.observationError=true;}
      return value;
    };
  },observe({executor,backend,closed,ringAddr,options,SoftwareExec,WebGLExec}){
    if(!binding||binding.role!=='render'||!executor||closed||executor.closed||
      binding.instance!==options.instance||binding.memory!==options.memory||
      !(binding.module instanceof root.WebAssembly.Module)||!(binding.instance instanceof root.WebAssembly.Instance))
      throw Error('capture refused: live render module/instance/memory/executor required');
    const sw=executor instanceof SoftwareExec.Executor,webgl=executor instanceof WebGLExec.Executor;
    if(sw===webgl)throw Error('capture refused: unknown/ambiguous executor class');
    const gl=webgl?executor.gl:null;
    if(webgl&&(!gl||executor.backend!==backend||backend.gl!==gl||gl.isContextLost()))
      throw Error('capture refused: actual WebGL context lost or substituted');
    const state=runs.get(executor);if(!state||state.observationError)throw Error('capture refused: executor completion observation unavailable');
    return {role:binding.role,epoch,moduleObject:token(binding.module),instanceObject:token(binding.instance),
      memoryObject:token(binding.memory),moduleGeneration:binding.generation,executorObject:token(executor),
      backendObject:token(backend),contextObject:token(gl),ringAddr,
      requestedBackend:options.backend,actualExecutor:sw?'software':'webgl',
      fallback:options.backend==='webgl'&&sw,contextLost:gl?gl.isContextLost():null,
      renderer:gl?gl.getParameter(gl.RENDERER):null,version:gl?gl.getParameter(gl.VERSION):null,
      completed:state.completed,completedDraws:state.draws,completedPresents:state.presents,failed:state.failed,records:state.records.map(r=>({...r}))};
  },moduleBinding(){return binding;},identity(){
    if(!binding||!(binding.module instanceof root.WebAssembly.Module)||!(binding.instance instanceof root.WebAssembly.Instance))throw Error('actual module binding required');
    return {role:binding.role,epoch,moduleObject:token(binding.module),instanceObject:token(binding.instance),memoryObject:token(binding.memory),moduleGeneration:binding.generation};
  }};
  Object.defineProperty(root,'__ptctExecutorObserver',{value:api});return api;
}
function replaceOnce(source,from,to) {
  assert.equal(source.split(from).length,2,'exact immutable source integration anchor');
  return source.replace(from,to);
}
// The caller supplies its pinned immutable bytes, never a fresh mutable import.
function overlay(files,pins) {
  const out=new Map(files),changes=[];
  const edit=(name,fn)=>{const bytes=files.get(name);assert(bytes&&pins[name]===sha(bytes),'immutable pin '+name);
    const text=fn(bytes.toString());out.set(name,Buffer.from(text));changes.push({name,before:sha(bytes),after:sha(Buffer.from(text))});};
  const install='\n;('+installExecutorObserver.toString()+')(globalThis);\n';
  edit('lib/d3d-render-worker.js',s=>replaceOnce(replaceOnce(s,"'use strict';","'use strict';"+install),
    '    instance = result.exports ? result : result.instance;',
    '    instance = result.exports ? result : result.instance;\n    __ptctExecutorObserver.bind(msg.module,instance,memory,"render");'));
  edit('lib/guest-worker.js',s=>replaceOnce(replaceOnce(s,"'use strict';","'use strict';"+install),
    '      instance = result.exports ? result : (result.instance || result);',
    '      instance = result.exports ? result : (result.instance || result);\n      __ptctExecutorObserver.bind(selectedModule,instance,memory,"guest");'));
  edit('lib/gpu-stream-render-worker.js',s=>replaceOnce(replaceOnce(s,
    '      if (!executor) executor = open();',
    '      if (!executor) { executor = open(); globalThis.__ptctExecutorObserver.track(executor,GpuStream.CONST); }'),
    '    return { execute, destroy() { closed = true; destroy(); } };',
    '    return { execute, captureObservation() { return globalThis.__ptctExecutorObserver.observe({executor,backend,closed,ringAddr,options,SoftwareExec,WebGLExec}); }, destroy() { closed = true; destroy(); } };'));
  // Observe the unchanged ordinary automatic route; never add manual input.
  edit('lib/browser-shell.js',s=>replaceOnce(s,
    "            Promise.resolve(wine.callGuest(\n              'send_message', dlg.hwnd | 0, 0x0111, cfg.command || 1, 0)).catch(() => {});",
    "            const ptctCall = wine.callGuest(\n              'send_message', dlg.hwnd | 0, 0x0111, cfg.command || 1, 0);\n"+
    "            if (app === apps.ptct) {\n"+
    "              const rows = globalThis.__ptctChooserCalls ||= [];\n"+
    "              const row = {route:'scheduleStartupDialogDismiss/send_message',hwnd:dlg.hwnd|0,message:0x0111,command:cfg.command||1,at:Date.now(),status:'pending'};\n"+
    "              Object.defineProperty(row,'owner',{value:wine});\n"+
    "              rows.push(row);\n"+
    "              Promise.resolve(ptctCall).then(value=>{row.status='complete';row.value=value;row.completedAt=Date.now();},()=>{row.status='failed';});\n"+
    "            }\n"+
    "            Promise.resolve(ptctCall).catch(() => {});"));
  return {files:out,changes};
}
// Executed on an already attached Worker target, not selected by its URL.
const EXECUTOR_READ=`(() => {
  if(typeof endpoints==='undefined'||typeof stopping==='undefined'||stopping)throw Error('live render role required');
  const rows=[];
  for(const [id,e] of endpoints)if(e.options?.api==='gl-gps'){
    if(e.failed||!e.adapter?.captureObservation)throw Error('actual GPS observation unavailable');
    rows.push({id,generation:e.generation,api:e.options.api,...e.adapter.captureObservation()});
  }
  if(rows.length!==1)throw Error('unique actual GPS endpoint required');return rows[0];
})()`;
function qualifyExecutor(row,{endpoint,generation,requestedSelector,expectedExecutor,role='render',moduleProof}){
  assert.equal(role,'render','render Worker role required');assert.equal(row.role,role);
  assert.equal(row.api,'gl-gps');assert.equal(row.id,endpoint);assert.equal(row.generation,generation);
  assert(Number.isSafeInteger(row.generation)&&row.generation>0,'actual endpoint generation required');
  assert.equal(row.requestedBackend,requestedSelector,'requested selector differs from actual endpoint');
  assert(['software','webgl'].includes(expectedExecutor));
  // Retain the caller's row before calling: fallback is evidence, never a pass
  // for a requested WebGL qualification. Software fallback remains operational.
  assert.equal(row.actualExecutor,expectedExecutor,'actual executor mismatch (including legitimate fallback)');
  assert.equal(row.fallback,requestedSelector==='webgl'&&row.actualExecutor==='software');
  for(const key of ['epoch','moduleObject','instanceObject','memoryObject','executorObject'])assert(row[key],'missing actual object '+key);
  assert(Number.isSafeInteger(row.moduleGeneration)&&row.moduleGeneration>0);
  assert(row.completed>0&&row.failed===0&&row.records.length,'completed execution required');
  if(expectedExecutor==='webgl')assert(row.contextObject&&row.backendObject&&row.contextLost===false);
  assert(moduleProof?.object===row.moduleObject&&moduleProof.instance===row.instanceObject&&
    moduleProof.targetId&&moduleProof.role===role&&/^[a-f0-9]{64}$/.test(moduleProof.sha256)&&
    moduleProof.exportFunctionScriptId,'actual instance export/module bytecode join required');
  return {...row,targetId:moduleProof.targetId,moduleSha256:moduleProof.sha256,scope:'executor identity only; native qualification and motion unproved'};
}
function sameExecutor(a,b){
  for(const k of ['id','generation','api','role','epoch','moduleObject','instanceObject','memoryObject',
    'moduleGeneration','executorObject','backendObject','contextObject','requestedBackend','actualExecutor','fallback','targetId','moduleSha256'])
    assert.equal(b[k],a[k],'executor lifetime changed '+k);
}
function chooserComplete(rows){
  assert.equal(rows.length,1,'exactly one ordinary chooser call required');const r=rows[0];
  assert.equal(r.route,'scheduleStartupDialogDismiss/send_message');assert.equal(r.message,0x111);
  assert.equal(r.command,1);assert(r.hwnd>0);assert.equal(r.status,'complete');
  assert(Number.isFinite(r.completedAt)&&r.completedAt>=r.at);return {...r};
}
// The shared GLTron host-consent helper deliberately pins its own app name.
// PTCT uses the same ordinary host UI, with its own complete owner pin. A
// browser-fullscreen consent is host input, never a guest chooser command.
function sameHostOwner(binding,want,observed){
  assert(observed.page.isolated&&observed.page.apps.length===1,'one isolated PTCT host owner');
  const a=observed.page.apps[0];
  assert(a.name==='ptct'&&a.running&&!a.stopped&&a.guestWorker,'live PTCT host owner');
  for(const key of binding.HOST_FIELDS){
    assert(want[key]!==undefined&&want[key]!==null,'missing host identity '+key);
    assert.equal(a[key],want[key],'PTCT host owner changed '+key);
  }
}
function reviewHostConsent(binding,scene,review,live,now=Date.now()){
  assert(review?.sha256===scene.sha256&&review.observation?.trim()&&review.hostOnly===true,
    'personal whole-browser host review required');
  assert(now-scene.at>=0&&now-scene.at<30000,'fresh host geometry review');
  sameHostOwner(binding,scene.observation.page.apps[0],live);
  binding.consentButton(scene.observation);binding.consentButton(live);
  for(const key of ['object','label','x','y'])assert.equal(live.button[key],scene.observation.button[key],'consent button changed '+key);
  assert.deepEqual(live.button.box,scene.observation.button.box,'consent geometry changed');
  assert.equal(live.wrap,scene.observation.wrap);assert.equal(live.strip.object,scene.observation.strip.object);
  assert.deepEqual(live.viewport,scene.observation.viewport,'host viewport changed');
  return {x:live.button.x,y:live.button.y};
}
// Join the instantiated module object to a Wasm export's actual debugger
// script, then retrieve those bytes. A target inventory hash alone is not a
// module-object join. Unsupported V8 introspection refuses qualification.
async function attestModule({send,sessionId,targetId,role,expectedSha256}){
  const call=(method,params)=>send(method,params,sessionId);
  const identity=await call('Runtime.evaluate',{expression:'__ptctExecutorObserver.identity()',returnByValue:true});
  assert(!identity.exceptionDetails);const pin=identity.result.value;assert.equal(pin.role,role);
  const fn=await call('Runtime.evaluate',{expression:'Object.values(__ptctExecutorObserver.moduleBinding().instance.exports).find(x=>typeof x==="function")',returnByValue:false});
  assert(!fn.exceptionDetails&&fn.result?.objectId,'actual instance export required');
  {
    const props=await call('Runtime.getProperties',{objectId:fn.result.objectId,ownProperties:false});
    const locations=(props.internalProperties||[]).filter(p=>p.name==='[[FunctionLocation]]');
    assert.equal(locations.length,1,'actual Wasm export function location required');
    const scriptId=locations[0].value?.value?.scriptId;assert(scriptId,'actual Wasm script required');
    const source=await call('Debugger.getScriptSource',{scriptId});assert(source.bytecode,'actual Wasm bytecode required');
    const bytes=Buffer.from(source.bytecode,'base64'),hash=sha(bytes);assert.equal(hash,expectedSha256,'instantiated module bytes mismatch');
    const after=await call('Runtime.evaluate',{expression:'__ptctExecutorObserver.identity()',returnByValue:true});
    assert(!after.exceptionDetails);assert.deepEqual(after.result.value,pin,'module binding changed during bytecode recovery');
    await call('Runtime.releaseObject',{objectId:fn.result.objectId});
    return {object:pin.moduleObject,instance:pin.instanceObject,role,targetId,sha256:hash,exportFunctionScriptId:scriptId,identity:pin};
  }
}
async function attestGuest({binding,evaluate,send,worker,pageIdentity,expectedSha256}){
  assert(!worker.closed&&worker.sessionId&&worker.targetId,'attached live guest Worker required');
  const before=await evaluate(binding.WORKER_READ,worker.sessionId);
  assert(before&&before.endpointIdentity===pageIdentity.guestEndpoint&&before.slot===pageIdentity.slot,'actual guest endpoint/slot required');
  const proof=await attestModule({send,sessionId:worker.sessionId,targetId:worker.targetId,role:'guest',expectedSha256});
  assert.deepEqual(await evaluate(binding.WORKER_READ,worker.sessionId),before,'guest lifetime changed');
  assert(!worker.closed,'guest Worker detached');return {...proof,endpoint:before.endpointIdentity,slot:before.slot,workerInstance:before.instance};
}
const CHOOSER_READ=`(() => {
  if(typeof runningApps==='undefined'||runningApps.length!==1||runningApps[0].name!=='ptct')throw Error('one actual PTCT host owner required');
  const rows=globalThis.__ptctChooserCalls||[];
  if(rows.some(r=>r.owner!==runningApps[0].wine))throw Error('chooser owner changed');
  return rows.map(r=>({...r}));
})()`;
async function attestExecutingEndpoint({binding,evaluate,send,worker,pageIdentity,requestedSelector,expectedExecutor,expectedSha256,onObservation=()=>{}}){
  assert(!worker.closed&&worker.sessionId&&worker.targetId,'attached live Worker required');
  const endpoints=await evaluate(binding.RENDER_READ,worker.sessionId);
  const existing=endpoints.filter(e=>e.id===pageIdentity.renderEndpoint&&e.api==='gl-gps'&&!e.failed&&!e.control?.error);
  assert.equal(existing.length,1,'existing binding owning endpoint join required');
  const row=await evaluate(EXECUTOR_READ,worker.sessionId);onObservation(row);
  const moduleProof=await attestModule({send,sessionId:worker.sessionId,targetId:worker.targetId,role:'render',expectedSha256});
  const qualified=qualifyExecutor(row,{endpoint:pageIdentity.renderEndpoint,generation:row.generation,requestedSelector,expectedExecutor,moduleProof});
  const after=await evaluate(EXECUTOR_READ,worker.sessionId);
  sameExecutor(qualified,{...after,targetId:worker.targetId,moduleSha256:moduleProof.sha256});
  const endpointAfter=await evaluate(binding.RENDER_READ,worker.sessionId);
  assert(endpointAfter.some(e=>e.id===existing[0].id&&e.epoch===existing[0].epoch&&!e.failed&&!e.control?.error));
  assert(!worker.closed,'Worker detached during attestation');return qualified;
}
// Reuse the accepted whole current-display ticket, publication checks and
// module/Worker binding. No new readPixels path or generic input controller.
function createCapture({binding,evaluate,send,workers,pageSession,expectedSha256,requestedSelector,expectedExecutor,onObservation=()=>{}}){
  assert(/^[a-f0-9]{64}$/.test(expectedSha256));
  const chain=binding.createChain({evaluate,send,workers,pageSession,app:'ptct',expectedModules:[expectedSha256]});
  let closed=false,pin=null;
  async function attest(){
    assert(!closed&&!chain.closed,'closed PTCT capture');
    const live=await chain.readLive(),a=live.identity;
    const guest=[...workers.values()].find(w=>!w.closed&&w.targetId===a.workerTarget);
    const render=[...workers.values()].find(w=>!w.closed&&w.targetId===a.rendererTarget);
    assert(guest&&render&&guest.targetId!==render.targetId,'distinct actual guest and render Workers required');
    const guestProof=await attestGuest({binding,evaluate,send,worker:guest,pageIdentity:a,expectedSha256});
    const executor=await attestExecutingEndpoint({binding,evaluate,send,worker:render,pageIdentity:a,expectedSha256,requestedSelector,expectedExecutor,onObservation});
    assert(executor.completedDraws>0&&executor.completedPresents>0,'actual completed DRAW and PRESENT required before capture');
    // installInitializedObserver is the existing passive compositor observer
    // from gltron-current-native-capture.cjs; install it before launching.
    const initialized=await evaluate('globalThis.__nativeInitialized?.receipts?.at(-1) || null');
    assert(initialized&&initialized.api==='gl-gps'&&initialized.endpoint===a.renderEndpoint&&initialized.epoch===a.renderGeneration,
      'existing initialized GPU publication join required; initial GDI desktop refuses');
    const chooser=chooserComplete(await evaluate(CHOOSER_READ));
    if(pin){sameExecutor(pin.executor,executor);assert.deepEqual(pin.guestProof,guestProof);assert.deepEqual(pin.chooser,chooser);}
    else pin={executor,guestProof,chooser};
    return {identity:a,executor,guestProof,chooser,initialized};
  }
  return {async prepareStartup(deadline,onObservation){
    assert(!closed,'closed PTCT capture');
    // Keep the binding's fixed PREBIND deadline and nonce-bound NOT_READY
    // handling. This cannot reopen a refused ticket or a closed chain.
    try{return await chain.prepareStartup(deadline,onObservation);}
    catch(error){closed=true;throw error;}
  },async capture(name){
    assert(!closed,'closed PTCT capture');
    try{const before=await attest();const shot=await chain.capture(name);const after=await attest();
      binding.same(before.identity,after.identity);
      assert(shot.capture.metadata.publication>=before.initialized.publication,'capture predates initialized GPU publication');
      return {...shot,ptct:{before,after}};
    }catch(error){closed=true;throw error;}
  },get closed(){return closed||chain.closed;}};
}
module.exports={createCapture,attestGuest,CHOOSER_READ,attestModule,attestExecutingEndpoint,installExecutorObserver,overlay,EXECUTOR_READ,qualifyExecutor,sameExecutor,chooserComplete,sameHostOwner,reviewHostConsent,sha};
