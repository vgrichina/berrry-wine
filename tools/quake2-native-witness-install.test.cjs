'use strict';
// Offline candidates stay in memory until Q3 releases its pinned providers.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Module=require('node:module');
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const version='publishedf977ebf7c',custody='3448afd4c5ec4ea691c584a6cfde3a61b72f5c9143458189c1035f374c4c6240';
function once(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b);}
function sharedCandidate(s){
 s=once(s,'maxBoundaries=64,limit=0}={})','maxBoundaries=64,limit=0,installationToken=null}={})');
 s=once(s," const options={maxBoundaries,exe:binary().receipt};"," if(installationToken!==null&&(typeof installationToken!=='string'||!installationToken))throw Error('installation token');\n const options={maxBoundaries,exe:binary().receipt};");
 const begin=s.indexOf('  const binding=await w.armQuake2WriterObservation('),end=s.indexOf('\n })()`;',begin);
 assert(begin>0&&end>begin);
 s=s.slice(0,begin)+`  const key=\u0024{JSON.stringify(globalName)},token=\u0024{JSON.stringify(installationToken)};
  let cancelled=false,binding,finish;
  const settled=new Promise(resolve=>{finish=resolve;});
  const pending={installationToken:token,close(){cancelled=true;return settled;}};
  globalThis[key]=pending;
  try{
   binding=await w.armQuake2WriterObservation(\u0024{JSON.stringify({limit})});
   if(cancelled||globalThis[key]!==pending||runningApps.length!==1||runningApps[0]!==a||a.wine!==w||!w.running||w._stopped||
    w.processId!==identity.processId||w.guestWorker?.link!==l||l.endpointIdentity!==identity.endpoint||
    globalThis.__mcmPassiveIdentityV1!==s||s.epoch!==identity.epoch||
    Object.entries(objects).some(([key,value])=>!value||s.ids.get(value)!==identity[key])||
    l.worker!==objects.workerObject||l.module!==objects.moduleObject||w.renderer!==objects.pageRendererObject||
    document.getElementById('screen')!==objects.canvasObject)throw Error('owning page replaced during arm');
   // Validate the actual host binding before installing any reader callback.
   binding.snapshot();
   const observer=(\u0024{attachPage.toString()})(binding,\u0024{JSON.stringify(options)});
   globalThis[key]=Object.freeze({...observer,installationToken:token});
   return {status:'ARMED',generation:binding.receipt.generation,nativeQualification:false};
  }catch(e){
   try{await binding?.close();}catch(_){} // Preserve the first setup failure.
   if(globalThis[key]===pending)delete globalThis[key];
   throw e;
  }finally{finish();}`+s.slice(end);
 return s;
}
const helperSource=`'use strict';
// Explicit actual-caller lifecycle. Admission and the six-copy reader remain
// the retained implementations; setup is outside all synchronous boundaries.
const passive=require('./quake2-passive-attack.cjs'),shared=require('./quake2-shared-writer-witness.cjs');
function createChain(bound,options){
 const enabled=options.writerWitnessSetup===true;
 if(options.writerWitnessSetup!==undefined&&typeof options.writerWitnessSetup!=='boolean')throw Error('boolean writer setup');
 if(!enabled)return passive.createChain(bound,options);
 if(options.writerWitnessGlobal!==undefined)throw Error('actual caller owns writer witness global');
 const globalName='__q2ActualCallerWriter',token=require('node:crypto').randomUUID();
 const chain=passive.createChain(bound,{...options,writerWitnessGlobal:globalName});
 let identity=null,setup=null,stopped=false,failure=null,teardown=null;
 const check=()=>{if(failure)throw failure;if(stopped||chain.closed)throw Error('writer lifetime closed');};
 const remember=e=>{failure??=e;return failure;};
 async function install(admitted){
  check();
  if(identity){
   // Retained same() enforces every admitted Worker/renderer/module token.
   bound.same(identity,admitted);return setup;
  }
  identity=structuredClone(admitted);
  setup=options.evaluate(shared.pageSource({globalName,identity,installationToken:token,maxBoundaries:1024}));
  try{const receipt=await setup;check();return receipt;}catch(e){throw remember(e);}
 }
 return {...chain,get closed(){return stopped||!!failure||chain.closed;},
  admit:(review,dispatch)=>{check();return chain.admit(review,async receipt=>{
   try{await install(receipt.live.identity);check();return await dispatch(receipt);}catch(e){throw remember(e);}
  });},
  capture:async label=>{check();try{return await chain.capture(label);}catch(e){throw remember(e);}},
  progress:async admitted=>{check();try{return await chain.progress(admitted);}catch(e){throw remember(e);}},
  closeWriterWitness(){
   stopped=true;
   return teardown??=Promise.resolve().then(()=>(options.cleanupEvaluate||options.evaluate)(\`(async()=>{
    const key=\u0024{JSON.stringify(globalName)},slot=globalThis[key];
    if(!slot)return {status:'ABSENT'};
    if(slot.installationToken!==\u0024{JSON.stringify(token)})throw Error('writer lifetime replaced');
    // Remove the slot before awaiting close. A pending arm observes cancellation.
    delete globalThis[key];await slot.close();return {status:'CLOSED',nativeQualification:false};
   })()\`));
  }};
}
module.exports={createChain};
`;
function compositionCandidate(s){
 s=once(s,'function compose(){',`function compose({custodyVersion=process.env.QUAKE2_NATIVE_CUSTODY_VERSION}={}){
 assert(custodyVersion===undefined||custodyVersion===${JSON.stringify(version)},'unknown Q2 custody version');
 const selectedCustody=custodyVersion===${JSON.stringify(version)}?${JSON.stringify(custody)}:custodySha256;`);
 s=once(s,"assert.equal(sha256,custodySha256,",'assert.equal(sha256,selectedCustody,');
 s=once(s,"'tools/quake2-passive-attack.cjs','lib/", "'tools/quake2-passive-attack.cjs','tools/quake2-native-witness-install.cjs','tools/quake2-shared-writer-witness.cjs','tools/quake2-frame-writer-witness.cjs','lib/");
 s=once(s,"chain=require(root+'/tools/quake2-passive-attack.cjs').createChain(bound,{evaluate,send,workers,pageSession,", "chain=require(root+'/tools/quake2-native-witness-install.cjs').createChain(bound,{writerWitnessSetup:process.env.QUAKE2_NATIVE_WRITER_WITNESS==='1',cleanupEvaluate:writerCleanup,evaluate,send,workers,pageSession,");
 // The exact cleanup expression gets a single terminal-safe CDP path. All
 // ordinary evaluation/read/capture calls remain barred after first failure.
 s=once(s,'let terminalFailure=null;const terminalAbort=',`let writerTeardownExpression=null;
async function writerCleanup(expression){
 writerTeardownExpression=expression;
 try{return await evaluate(expression);}finally{writerTeardownExpression=null;}
}
let terminalFailure=null;const terminalAbort=`);
 s=once(s,"if(method!=='Browser.close'&&!(method==='Input.dispatchKeyEvent'&&params.type==='keyUp'))checkTerminal();", "if(method!=='Browser.close'&&!(method==='Input.dispatchKeyEvent'&&params.type==='keyUp')&&!(closing&&method==='Runtime.evaluate'&&writerTeardownExpression!==null&&params.expression===writerTeardownExpression))checkTerminal();");
 s=once(s,' let receipt,failure;\n try{\n  if(browser){',' let receipt,failure;\n try{\n  if(chain?.closeWriterWitness)await chain.closeWriterWitness();\n  if(browser){');
 // Teardown failure cannot skip the existing browser retirement path.
 s=once(s,'if(chain?.closeWriterWitness)await chain.closeWriterWitness();',"if(chain?.closeWriterWitness)try{await chain.closeWriterWitness();}catch(e){process.exitCode=1;save('writer-teardown-unknown.json',{error:String(e),noReplay:true});observeTerminal(e);}");
 return s;
}
function load(file,source,overrides={}){
 const m=new Module(path.join(root,file),module);m.filename=path.join(root,file);m.paths=module.paths;
 const original=m.require.bind(m);m.require=n=>Object.hasOwn(overrides,n)?overrides[n]:original(n);m._compile(source,m.filename);return m.exports;
}
function candidates(){
 const sharedSource=sharedCandidate(fs.readFileSync(root+'/tools/quake2-shared-writer-witness.cjs','utf8'));
 const shared=load('tools/quake2-shared-writer-witness.cjs',sharedSource);
 const helper=load('tools/quake2-native-witness-install.cjs',helperSource,{'./quake2-shared-writer-witness.cjs':shared});
 const compositionSource=compositionCandidate(fs.readFileSync(root+'/tools/quake2-native-driver-composition.cjs','utf8'));
 const composition=load('tools/quake2-native-driver-composition.cjs',compositionSource);
 return {shared,helper,composition,sharedSource,compositionSource};
}
module.exports={candidates,helperSource,load,version,custody,hash};

// Real Worker harness. Its only extra signal is a deterministic completion flag
// outside production boundaries; this is an authored interleaving, not gameplay.
const wt=require('node:worker_threads');
if(!wt.isMainThread){
 let memory;const runs=new Set(),post=wt.parentPort.postMessage.bind(wt.parentPort);
 wt.parentPort.on('message',m=>{if(m.t==='init')memory=m.memory;if(m.t==='callExport'&&m.name==='run')runs.add(m.seq);});
 wt.parentPort.postMessage=(m,...args)=>{post(m,...args);if(runs.delete(m.seq)&&memory)Atomics.store(new Int32Array(memory.buffer,require('../lib/region-map.generated').BASE.NATIVE_STORE_SHARED+124,1),0,m.seq);};
 require('../lib/guest-worker');
}else if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});

async function main(){
 const current=process.env.Q2_INSTALL_CURRENT==='1'||fs.existsSync(root+'/tools/quake2-native-witness-install.cjs');
 const c=current?{
  shared:require('./quake2-shared-writer-witness.cjs'),helper:require('./quake2-native-witness-install.cjs'),composition:require('./quake2-native-driver-composition.cjs')}:candidates();
 const virtual=new Map();
 if(c.compositionSource){
  virtual.set(root+'/tools/quake2-native-witness-install.cjs',helperSource);
  virtual.set(root+'/tools/quake2-shared-writer-witness.cjs',c.sharedSource);
  virtual.set(root+'/tools/quake2-native-driver-composition.cjs',c.compositionSource);
 }
 const originalRead=fs.readFileSync;
 const read=(file,...args)=>virtual.has(String(file))?(args[0]==='utf8'?virtual.get(String(file)):Buffer.from(virtual.get(String(file)))):originalRead(file,...args);
 const compose=opts=>{fs.readFileSync=read;try{return c.composition.compose(opts);}finally{fs.readFileSync=originalRead;}};
 delete process.env.QUAKE2_NATIVE_CUSTODY_VERSION;
 assert.throws(()=>compose(),/tested Q2 custody provider required/,'default SHA refusal preserved');
 assert.throws(()=>compose({custodyVersion:'anything'}),/unknown Q2 custody version/);
 const generated=compose({custodyVersion:version});
 process.env.QUAKE2_NATIVE_CUSTODY_VERSION=version;
 assert.equal(compose().source,generated.source,'explicit environment and API versions generate byte-identical runtime');
 delete process.env.QUAKE2_NATIVE_CUSTODY_VERSION;
 const damaged=Buffer.from(originalRead(root+'/tools/native_kernel_custody.py'));damaged[0]^=1;
 virtual.set(root+'/tools/native_kernel_custody.py',damaged);
 assert.throws(()=>compose({custodyVersion:version}),/tested Q2 custody provider required/,'unexplained drift rejected');
 virtual.delete(root+'/tools/native_kernel_custody.py');
 // Exact published provider only; no historical source injection or blanket pin.
 const published=require('node:child_process').execFileSync('git',['show','f977ebf7c:tools/native_kernel_custody.py']);
 assert.equal(hash(published),custody);assert.equal(hash(originalRead(root+'/tools/native_kernel_custody.py')),custody);
 // Version selection changes reference metadata only, never runtime semantics.
 const originalCompose=c.composition.compose;
 c.composition.compose=()=>compose({custodyVersion:version});
 // Load the exact retained health transform against the new generated source.
 const healthPath=root+'/scratch/runs/20261109-quake2-observed-autoattach-native-1205/health-preload.cjs';
 const argv=process.argv[1];process.argv[1]=root+'/'+c.composition.consumerPath;
 // Avoid recursion: preload's original() calls this fixed generated result.
 c.composition.compose=()=>generated;
 load(path.relative(root,healthPath),originalRead(healthPath,'utf8'),{[root+'/tools/quake2-native-driver-composition.cjs']:c.composition});
 process.argv[1]=argv;const healthGenerated=c.composition.compose();c.composition.compose=originalCompose;
 const passive=require('./quake2-passive-attack.cjs'),bound=require(root+'/'+path.dirname(c.composition.consumerPath)+'/bound-input.cjs');
 const {fixture}=require('./quake2-passive-attack.test.cjs');
 const writer=require('./quake2-frame-writer-witness.cjs'),{GuestThreadHost}=require('../lib/guest-thread-host');
 const cpuBytes=originalRead(process.env.Q2_WITNESS_CPU||root+'/build/wine-assembly.wasm'),cpu=new WebAssembly.Module(cpuBytes);
 const hostSource=originalRead(root+'/host.js','utf8'),start=hostSource.indexOf('  async armQuake2WriterObservation('),end=hostSource.indexOf('  async armD3dimPublicationObservation',start);
 const arm=vm.runInNewContext('(class { '+hostSource.slice(start,end)+' }).prototype.armQuake2WriterObservation');
 const offset=va=>va-0x400000+0x12000,results=[];
 function generatedControl(evaluate,send,workers,enabled){
  const cpuPath=path.relative(root,path.resolve(process.env.Q2_WITNESS_CPU||root+'/build/wine-assembly.wasm'));
  const saved=[],logs=[],fakeFS={...fs,readFileSync:(file,...args)=>file==='/offline-only/runtime-pins.json'?JSON.stringify({files:[...generated.references,{path:cpuPath,sha256:hash(cpuBytes),size:cpuBytes.length}]}):read(file,...args),mkdirSync:()=>{},existsSync:()=>false,rmSync:()=>{}};
  const fakeRequire=n=>{
   if(n==='node:fs')return fakeFS;
   if(n==='node:child_process')return {spawn:()=>{throw Error('OFFLINE forbidden spawn');}};
   if(n.endsWith('/tools/quake2-native-witness-install.cjs'))return c.helper;
   if(n.endsWith('/tools/quake2-native-transport.cjs'))return {publish:(p,row)=>saved.push({p,row}),closed:()=>{}};
   if(n.endsWith('/tools/native-command-log.cjs'))return {createLogs:()=>({append:(p,row)=>logs.push({p,row:JSON.parse(row)}),close:()=>{}})};
   if(n==='./bound-input.cjs')return bound;
   return require(n);
  };
  const startup=healthGenerated.source.indexOf('(async()=>{\n checkTerminal();\n server=');assert(startup>0);
  const chainLine=healthGenerated.source.split('\n').find(l=>l.trim().startsWith("chain=require(root+'/tools/quake2-native-witness-install.cjs')"));assert(chainLine);
  let source=healthGenerated.source.slice(0,startup);
  source+=`for(const [k,v] of testWorkers)workers.set(k,v);pageSession='authored-page';
ws={readyState:1,close(){},send(serialized){
 const message=JSON.parse(serialized);
 Promise.resolve().then(()=>testRoute(message)).then(value=>{const p=pending.get(message.id);if(p){pending.delete(message.id);clearTimeout(p.timer);p.resolve(value);}},error=>{const p=pending.get(message.id);if(p){pending.delete(message.id);clearTimeout(p.timer);p.reject(error);}});
}};
${chainLine}
globalThis.control={chain,retainHealth,passiveHealthTick,close,observeTerminal,failure:()=>terminalFailure,setLatest:i=>{latest={identity:i};},ordinaryEvaluate:evaluate};`;
  const context=vm.createContext({require:fakeRequire,process:{env:{QUAKE2_NATIVE_RUN:'/offline-only',BROWSER_DEADLINE:String(Date.now()+60000),QUAKE2_NATIVE_WRITER_WITNESS:enabled?'1':'0'},once:()=>{}},
   __dirname:path.dirname(root+'/'+c.composition.consumerPath),Buffer,AbortController,structuredClone,testWorkers:workers,
   testRoute:async message=>message.method==='Runtime.evaluate'?{result:{value:JSON.parse(JSON.stringify(await evaluate(message.params.expression,message.sessionId)))}}:send(message.method,message.params,message.sessionId),
   console:{log:()=>{},error:()=>{}},setTimeout:()=>1,clearTimeout:()=>{},clearInterval:()=>{},setImmediate});
  new vm.Script(source).runInContext(context);return {control:context.control,saved,logs};
 }
 async function run(name,enabled){
  const f=fixture(true),host=new GuestThreadHost({module:cpu,memory:f.memory,sigs:require('../lib/host-import-sigs.generated.json').sigs,
   hostImports:new Proxy({},{get:(_,n)=>()=>{if(!String(n).startsWith('beep_'))throw Error('unexpected import '+String(n));return 0;}}),workerUrl:__filename,clockIntervalMs:0,tickMs:()=>0});
  let worker;
  try{
   await host.start();const link=host.link;worker=link.worker;f.wine.guestWorker=host;
   // Authored CDP envelopes around actual owning Worker/module/endpoint.
   const workerInstance='authored-instance',workers=new Map([['guest',{targetId:'authored-worker',sessionId:'guest',url:'guest-worker',closed:false,scripts:[{scriptId:'cpu',bytecodeAvailable:true,sha256:hash(cpuBytes)}]}]]);
   f.context.structuredClone=structuredClone;f.context.crypto=crypto;
   let arms=0,reads=0,gateResolve,armed;
   const gate=name==='pendingClose'?new Promise(r=>gateResolve=r):null;
   f.wine.armQuake2WriterObservation=async options=>{
    arms++;if(name==='setupFailure')throw Error('authored setup failure');
    armed=await arm.call(f.wine,options);
    if(name==='replaceDuringSetup')f.wine.renderer={};
    if(gate)await gate;
    return armed;
   };
   const evaluate=async(source,session)=>{
    if(session==='guest'){assert.equal(source,bound.WORKER_READ);return {endpointIdentity:link.endpointIdentity,slot:link.slot,instance:workerInstance};}
    if(source.startsWith('('+passive.readPage.toString()+')'))reads++;
    return vm.runInContext(source,f.context);
   };
   const send=async(method)=>{
    if(method==='Debugger.getScriptSource')return {bytecode:cpuBytes.toString('base64')};
    if(method==='Page.captureScreenshot')return {data:Buffer.from('authored pixels; not native capture').toString('base64')};
    throw Error('unexpected CDP '+method);
   };
   const call=(n,...a)=>link.callExport(n,...a);
   await call('init_thread',0,0x400000,0x403527,0x7409000,0,0,0,0);await call('set_esp',0x7408000);
   // Primary and compat execute the original publication REP, not a toy store.
   new Uint8Array(f.memory.buffer,offset(0x403527),2).set(writer.binary().instruction(0x403527,2));
   await call('invalidate_code_range',0x403527,2);await call('set_instruction_watchpoint',0x403529);
   f.view.setInt16(offset(writer.FRAME)+0xaa,100,true);
   new Uint8Array(f.memory.buffer,offset(writer.RING+240),240).set(new Uint8Array(f.memory.buffer,offset(writer.FRAME),240));
   const h=generatedControl(evaluate,send,workers,enabled),chain=h.control.chain;
   const shot=await chain.capture('authored');assert.equal(arms,0,'capture before admission never arms');
   assert.equal(shot.after.attackInput.frameWriterWitness?.status,enabled?'UNAVAILABLE':undefined);
   const identity=shot.capture.identity,review={...shot.capture,review:'authored offline review'};
   h.control.setLatest(identity);h.control.retainHealth(shot.after,'capture-after');
   let dispatches=0;
   if(name==='staleIdentity')f.wine.processId++;
   if(['setupFailure','staleIdentity','replaceDuringSetup'].includes(name)){
    let first;
    await assert.rejects(()=>chain.admit(review,async()=>{dispatches++;}),e=>{first=e;return true;});assert.equal(dispatches,0);
    assert.equal(f.context.__q2ActualCallerWriter,undefined);
    if(armed)assert.equal(await call('native_store_get',0),0,'failed setup retired its binding');
    const before=reads;await assert.rejects(()=>chain.progress(identity),e=>name==='staleIdentity'||e===first);assert.equal(reads,before);
   }else if(name==='pendingClose'){
    const admission=chain.admit(review,()=>{dispatches++;});
    while(!armed)await new Promise(r=>setImmediate(r));
    await assert.rejects(()=>evaluate(c.shared.pageSource({globalName:'__q2ActualCallerWriter',identity})),/already bound/);
    const closed=chain.closeWriterWitness();
    const rejected=assert.rejects(()=>admission);gateResolve();await closed;await rejected;assert.equal(dispatches,0);
    assert.equal(await call('native_store_get',0),0,'cancelled pending arm disarmed');
   }else{
    await chain.admit(review,async receipt=>{bound.same(receipt.live.identity,identity);dispatches++;});
    if(enabled){
     assert.equal(arms,1);const again=await chain.capture('again');
     await chain.admit({...again.capture,review:'same lifetime'},async()=>dispatches++);assert.equal(arms,1,'repeated admission reuses exact lifetime');
     await assert.rejects(()=>evaluate(c.shared.pageSource({globalName:'__q2ActualCallerWriter',identity})),/already bound/);
     assert.equal(arms,1);
     const foreign=c.helper.createChain(bound,{evaluate,writerWitnessSetup:true});
     await assert.rejects(()=>foreign.closeWriterWitness(),/lifetime replaced/);
     assert.equal(await call('native_store_get',0),1,'another caller cannot close this lifetime');
    }
    let pending,executed=false;
    if(name!=='stable'){
     f.view.setInt16(offset(writer.FRAME)+0xaa,name==='loss'?98:name==='death'?-1:100,true);
     if(name==='unknown')f.put(0xa86a60,3);
     await call('set_eip',0x403527);await call('set_esi',writer.FRAME);await call('set_edi',writer.RING+240);await call('set_ecx',60);
     f.renderer.peekKeyDownState=()=>{
      if(!executed){executed=true;pending=call('run',1);const signal=new Int32Array(f.memory.buffer,require('../lib/region-map.generated').BASE.NATIVE_STORE_SHARED+124,1),seq=link._seq,deadline=Date.now()+10000;
       while(Atomics.load(signal,0)!==seq)if(Date.now()>deadline)throw Error('authored schedule deadline');}
      return 0;
     };
    }
    vm.runInContext(`globalThis.__trace=[];
     globalThis.DataView=class extends DataView{
      getUint8(...a){if(this.buffer instanceof SharedArrayBuffer)__trace.push(['u8',...a]);return super.getUint8(...a);}
      getUint32(...a){if(this.buffer instanceof SharedArrayBuffer)__trace.push(['u32',...a]);return super.getUint32(...a);}};
     globalThis.Uint8Array=class extends Uint8Array{*[Symbol.iterator](){for(let i=0;i<this.length;i++){if(this.buffer instanceof SharedArrayBuffer)__trace.push(['byte',this.byteOffset+i]);yield this[i];}}};`,f.context);
    const sample=await chain.progress(identity);if(pending)await pending;
    const row=JSON.parse(JSON.stringify(sample.attackInput)),w=row.frameWriterWitness;
    const trace=JSON.parse(JSON.stringify(f.context.__trace));
    if(enabled){assert.equal(w.status,'BOUNDED');assert.equal(w.nativeQualification,false);assert.equal(w.limits.allWriters,'UNKNOWN');
     if(name!=='stable')assert(w.intervals.some(i=>i.ranges.publishedRing.delta===60));}
    else assert.equal(w,undefined,'absent install old FAIL: default has no witness');
    if(['loss','death','unknown'].includes(name)){
     const events=[];let first,caught;
     try{await require('./quake2-native-input.cjs').hold({keys:['ArrowRight'],holdMs:50,session:'authored',
      send:async(m,p)=>{events.push(p.type);if(process.env.Q2_INSTALL_UP_FAIL==='1'&&p.type==='keyUp')throw Error('later UP failure');},sample:async()=>sample,
      checkSample:r=>{try{h.control.retainHealth(r,'during-action');}catch(e){first=e;throw e;}},saveSample:()=>{throw Error('later sink forbidden');}});}catch(e){caught=e;}
     assert.equal(first,caught);assert.equal(first,h.control.failure());assert.deepEqual(events,['keyDown','keyUp']);
     assert.equal(caught.holdReceipt.physicalRelease,process.env.Q2_INSTALL_UP_FAIL==='1'?'UNKNOWN':'ACK');
     const before=reads;await h.control.passiveHealthTick();assert.equal(reads,before,'terminal no later reader');
     await assert.rejects(()=>h.control.ordinaryEvaluate('throw Error("ordinary terminal evaluation reached page")'),/Q2 terminal UNKNOWN/);
     assert.equal(h.logs.at(-1).row.attackInput.frameWriterWitness?.status,w?.status);
    }
    results.push({name,enabled,traceSHA:hash(JSON.stringify(trace)),guestReads:trace.length,row,arms,reads});
   }
   await h.control.close('offline test completion');
   if(enabled){assert.equal(await call('native_store_get',0),0);assert.equal(chain.closeWriterWitness(),chain.closeWriterWitness(),'idempotent teardown');const before=reads;await assert.rejects(()=>chain.progress(identity));assert.equal(reads,before);}
   return results.at(-1);
  }finally{await host.stop();assert(!worker||worker.threadId===-1,'actual Worker joined');}
 }
 for(const name of ['stable','loss','death','unknown']){
  const off=await run(name,false),on=await run(name,true);
  const strip=r=>{r=structuredClone(r);delete r.at;delete r.identity;delete r.frameWriterWitness;delete r.memoryIdentity;return r;};
  assert.deepEqual(strip(on.row),strip(off.row),name+' unchanged acceptance/health');assert.equal(on.traceSHA,off.traceSHA,name+' exact guest reads/order');
 }
 for(const name of ['setupFailure','staleIdentity','replaceDuringSetup','pendingClose'])await run(name,true);
 console.log(JSON.stringify({pass:true,cpuSHA:hash(cpuBytes),mode:current?'current':'in-memory',custodyVersion:version,
  generatedSHA:hash(healthGenerated.source),nativeExperiment:false,authoredCDP:true,oldAbsentInstallFAIL:true,actualComposedNewPASS:true,
  setupFailure:true,staleIdentity:true,repeatedAdmission:true,repeatedInstallRefused:true,pendingClose:true,terminalNoLaterReads:true,
  results:results.map(({row,...r})=>({...r,frameWriterWitness:row.frameWriterWitness,status:row.status,health:row.damageFeedback?.current?.health}))}));
}
