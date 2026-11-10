'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Module=require('node:module');
const q=require('./nox-passive-consumption.cjs'),{createHostImports}=require('../lib/host-imports');
const root=path.resolve(__dirname,'..'),out=process.env.NOX_CONSUMPTION_TEST_OUT;
assert(out&&path.resolve(out).startsWith(root+'/scratch/runs/'));fs.mkdirSync(out,{recursive:true});
const fields='processId processObject endpoint endpointObject workerObject workerTarget workerInstance moduleObject moduleSha256 epoch renderEndpoint renderEndpointObject renderWorkerObject rendererTarget rendererEpoch rendererModuleSha256 pageRendererObject canvasObject'.split(' ');
const owner=Object.fromEntries(fields.map(k=>[k,'offline-'+k])),image={label:'startup',sha256:'a'.repeat(64),identity:owner},binding={id:'move',label:'after',previous:image};
const bytes=q.compile(),config=q.configuration(bytes,'/offline.wasm');fs.writeFileSync(out+'/module.wasm',bytes);assert(WebAssembly.validate(bytes));
// Compose the actual current driver, without starting a browser.
const current=require('./nox-current-driver.cjs');
const plain=current.pointerObservations(current.captureLabels(current.terminalCleanup(current.startupDiagnostics(fs.readFileSync(current.HISTORY+'/browser-run.cjs','utf8')))));
assert.equal(q.compose(plain),plain);const generated=process.env.NOX_CONSUMPTION_GENERATED?fs.readFileSync(process.env.NOX_CONSUMPTION_GENERATED+'/browser-run.cjs','utf8'):q.compose(plain,config);new vm.Script(Module.wrap(generated));
if(process.env.NOX_CONSUMPTION_GENERATED)assert.equal(q.sha(fs.readFileSync(process.env.NOX_CONSUMPTION_GENERATED+'/nox-consumption.wasm')),config.sha256,'actual emitted compiled module');
async function consumer(mode,action='move'){
 const memory=new ArrayBuffer(0x8000000),e={nox_consumption_arm(){},get_eax:()=>7,get_esp:()=>0x401004};
 const o=q.recorder({getExports:()=>e,getMemory:()=>memory,bases:{DI_MOUSE_INPUT_STATE:0},sites:q.sites,api:{}});
 if(mode==='wrongbinding')o.begin(binding,owner);
 if(mode==='incomplete'){o.begin(binding,owner);o.event(1,0x42b980,0x42b32a,0x401000);}
 const latest=mode==='wrongbinding'?{...image,identity:{...owner,epoch:'wrong'}}:image;
 let marked=0,sent=0,captured=0,terminal=null;
 const begin=generated.indexOf('async function execute('),end=generated.indexOf('\n(async()=>{',begin);assert(begin>0&&end>begin);
 const context={assert,deadline:Date.now()+60000,latest,out:'/offline',root,terminalError:null,pageSession:'page',pointerObserverInstalled:false,
  workers:new Map([['worker',{targetId:owner.workerTarget,sessionId:'worker'}]]),
  validCaptureLabel(){},fs:{existsSync:()=>false,readFileSync:f=>f.endsWith('-review.json')?JSON.stringify({...latest,review:'offline model review'}):'image'},sha:()=>image.sha256,
  evaluate:async(expression,session)=>session==='worker'?vm.runInNewContext(expression,{globalThis:{__noxConsumption:o}}):expression==='window.noxPointerObserver.snapshot().state'?{reference:mode==='unprimed'?null:mode==='desynchronized'?{x:351,y:295}:{x:0,y:0}}:{left:0,top:0,width:640,height:480},
  save(){},wait:async()=>{},capture:async()=>{captured++;},
  chain:{admit:async(_,f)=>f({live:{identity:latest.identity}})},
  send:async()=>{assert(!terminal);sent++;if(mode==='firstfailure')throw Error('first native failure');return {};},
  require:n=>n==='./native-mouse.cjs'?require(root+'/'+current.HISTORY+'/native-mouse.cjs'):require(n)};
 vm.createContext(context);vm.runInContext(generated.slice(begin,end)+';globalThis.run=execute',context);
 const run=async c=>{if(terminal)throw terminal;try{return await context.run(c,()=>marked++);}catch(e){terminal=e;context.terminalError=e;o.stop('firstfailure');throw e;}};
 const c={id:'move',action,point:[.46,.427],waitMs:0,reviewRef:'startup',label:'after'};
 if(mode==='success'){await run(c);assert.equal(marked,1);assert.equal(sent,action==='click'?3:1);assert.equal(captured,1);}
 else {await assert.rejects(run(c));await assert.rejects(run({...c,id:'later'}));assert.equal(captured,0);assert.equal(sent,mode==='firstfailure'?1:0);assert.equal(marked,mode==='firstfailure'?1:0);}
 return {mode,action,marked,sent,captured,terminal:!!terminal};
}
async function compiled(){
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),ctx={exports:null,getMemory:()=>memory.buffer};
 const host=createHostImports(ctx).host;Object.assign(host,{memory,log(){},log_i32(){},exit(){}});
 const scope={WebAssembly:{instantiate:WebAssembly.instantiate,compile:WebAssembly.compile},fetch:async()=>({ok:true,arrayBuffer:async()=>bytes}),crypto:require('node:crypto').webcrypto,performance,console:{debug(){}},endpointIdentity:1,workerSlot:0};
 vm.createContext(scope);vm.runInContext(q.workerSource(config),scope);
 const instance=await scope.WebAssembly.instantiate(await WebAssembly.compile(bytes),{host}),e=ctx.exports=instance.exports;
 scope.instance=instance;scope.__mcmPassiveInstanceV1={ids:new WeakMap([[instance,'fixture-instance']])};
 const o=scope.__noxConsumption,live={...owner,moduleSha256:config.sha256,endpoint:1,workerInstance:'fixture-instance'},b={...binding,previous:{...image,identity:live}};
 const mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),exe=fs.readFileSync(root+'/test/binaries/notepad.exe');mem.set(exe,e.get_staging());e.load_pe(exe.length);e.set_api_log(0);e.init_dx_com_thunks();
 const wa=a=>a-0x400000+0x12000,d32=v=>[v&255,v>>>8&255,v>>>16&255,v>>>24&255],put=(a,b)=>{mem.set(b,wa(a));e.invalidate_code_range(a,b.length);},w=(a,v)=>dv.setUint32(wa(a),v>>>0,true),ww=(a,v)=>dv.setUint32(a,v>>>0,true);
 // Synthetic fixture calls enter through natural compiled x86 CALL/RET only.
 put(0x42b325,[0xe8,...d32(0x42b980-0x42b32a),0xeb,0xfe]);put(0x42b980,[0xb8,...d32(123),0xc3]);
 e.set_esp(0x74ff000);e.set_eip(0x42b325);e.run(10);assert.equal(o.snapshot(live).records.length,0,'default inert');
 e.set_eip(0x42b325);o.begin(b,live);e.run(10);let s=o.snapshot(live);assert.equal(s.reason,null);assert.equal(s.frames.length,0);
 assert.deepEqual(Array.from(s.records.filter(r=>r.kind.startsWith('guest-')),r=>r.kind),['guest-call','guest-entry','guest-return']);assert.equal(s.records.at(-1).result,123);
 const device=0x402000,count=0x402100,output=0x402200,bases=config.bases;w(device+4,0);ww(bases.DX_OBJECTS,7);ww(bases.DX_OBJECTS+8,2);ww(bases.DX_OBJECTS+12,64);ww(bases.DX_OBJECTS+20,16);ww(bases.DX_OBJECTS+28,0x500);
 function thunk(id){for(let a=e.get_thunk_base();a<e.get_thunk_end();a+=8)if(e.thunk_word(a,1)===id)return a;throw Error('missing thunk '+id);}
 const fifo=bases.DI_MOUSE_INPUT_STATE;ww(fifo+8,0);ww(fifo+12,2);ww(fifo+16,0x5fffffe6);ww(fifo+20,0x6fffffd6);
 function callApi(id,args){let code=[];for(const a of [...args].reverse())code.push(0x68,...d32(a));const at=0x401000+code.length;code.push(0xe8,...d32(thunk(id)-at-5),0xeb,0xfe);put(0x401000,code);e.set_esp(0x74ff000);e.set_eip(0x401000);e.run(100);}
 w(count,2);callApi(1094,[device,16,output,count,0]);s=o.snapshot(live);assert.equal(s.reason,null);const r=s.records.find(r=>r.kind==='di-return');assert(r,'real compiled API return');assert.equal(r.hresult,0);assert.equal(r.requested,2);assert.equal(r.returnedCount,2);assert.equal(r.device.acquired,true);assert.equal(r.device.axisMode,'relative');assert.equal(r.fifo.head,2);
 const data=Buffer.from(r.returnedBytes);assert.equal(data.readInt32LE(4),-26);assert.equal(data.readInt32LE(20),-42);
 ww(fifo,19);ww(fifo+4,-7);callApi(1093,[device,16,output]);s=o.snapshot(live);assert.equal(s.reason,null);const state=s.records.filter(r=>r.kind==='di-return').at(-1);assert.equal(state.api,'GetDeviceState');assert.equal(state.hresult,0);assert.equal(Buffer.from(state.returnedBytes).readInt32LE(0),19);assert.equal(Buffer.from(state.returnedBytes).readInt32LE(4),-7);
 const before=Buffer.from(mem.subarray(wa(output),wa(output)+256));o.finish(live);assert.deepEqual(Buffer.from(mem.subarray(wa(output),wa(output)+256)),before);
 const completed=o.snapshot(live).records.length;e.set_eip(0x42b325);e.run(10);assert.equal(o.snapshot(live).records.length,completed,'capture disarms until next command');
 o.begin({...b,id:'second'},live);e.set_eip(0x42b325);e.run(10);assert(o.finish(live).records.length>completed);
 let clock=0;const bounded=q.recorder({getExports:()=>e,getMemory:()=>memory.buffer,bases,sites:q.sites,api:config.api,now:()=>clock,durationMs:1});bounded.begin(binding,owner);clock=1;assert.equal(bounded.snapshot(owner).reason,'deadline');assert.throws(()=>bounded.begin(binding,owner),/terminal/);
 for(const field of fields){const r=q.recorder({getExports:()=>e,getMemory:()=>memory.buffer,bases,sites:q.sites,api:config.api});assert.throws(()=>r.begin(binding,{...owner,[field]:'wrong'}),/binding/);assert.throws(()=>r.begin(binding,owner),/terminal/);}
 // Reproduce the recovered native refusal with BOTH real compiled modules.
 // The repair must authenticate the installed instance before selecting its
 // immutable bytecode. Merely compiling a module does not establish use.
 const original=fs.readFileSync(root+'/'+current.HISTORY+'/bound-input.cjs','utf8'),canonical=fs.readFileSync(root+'/build/wine-assembly.wasm');
 function load(text){const file=root+'/'+current.HISTORY+'/bound-input.cjs',m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(text,file);return m.exports;}
 const adapted=process.env.NOX_CONSUMPTION_GENERATED?fs.readFileSync(process.env.NOX_CONSUMPTION_GENERATED+'/bound-input.cjs','utf8'):q.boundSource(original,config);assert.equal(adapted,q.boundSource(original,config),'actual emitted admission adapter');
 const old=load(original),bound=load(adapted),scripts=[{scriptId:'canonical',bytecodeAvailable:true,sha256:q.sha(canonical)},{scriptId:'observation',bytecodeAvailable:true,sha256:config.sha256}];
 let receipt=o.owner(),changed=false;
 const page={isolated:true,apps:[{...live,name:'nox_demo',running:true,stopped:false,guestWorker:true,guestEndpoint:1,slot:0,renderEndpoint:'none'}]};
 const workerRecord={targetId:live.workerTarget,url:'guest-worker.js',sessionId:'worker',closed:false,scripts};
 const options={workers:new Map([['worker',workerRecord]]),expectedModules:[q.sha(canonical),config.sha256],pageSession:'page',
  evaluate:async expression=>expression===bound.PAGE_READ?structuredClone(page):expression===bound.WORKER_READ?{endpointIdentity:1,slot:0,instance:'fixture-instance'}:receipt,
  send:async(method,{scriptId})=>({bytecode:(changed?Buffer.from('changed'):scriptId==='canonical'?canonical:bytes).toString('base64')})};
 await assert.rejects(old.createChain(options).readLive(),/unique recovered live Worker module/);
 const authenticated=await bound.createChain(options).readLive();assert.equal(authenticated.identity.moduleSha256,config.sha256);
 for(const [key,value] of [['sha256','0'.repeat(64)],['size',0],['endpointIdentity',2],['slot',1],['workerInstance','foreign']]){
  receipt={...o.owner(),[key]:value};await assert.rejects(bound.createChain(options).readLive(),/Nox/);
 }
 receipt=o.owner();changed=true;await assert.rejects(bound.createChain(options).readLive(),/live module bytes changed/);changed=false;
 workerRecord.scripts=[scripts[0]];await assert.rejects(bound.createChain(options).readLive(),/unique recovered/);
 workerRecord.scripts=[...scripts,{scriptId:'foreign',bytecodeAvailable:true,sha256:'f'.repeat(64)}];await assert.rejects(bound.createChain(options).readLive(),/foreign compiled/);
 workerRecord.scripts=[...scripts,{...scripts[1],scriptId:'duplicate'}];await assert.rejects(bound.createChain(options).readLive(),/unique recovered/);workerRecord.scripts=scripts;
 scope.instance={};assert.throws(()=>o.owner(),/instantiated Worker owner changed/);scope.instance=instance;
 assert.equal(o.owner().workerInstance,'fixture-instance');
 fs.writeFileSync(out+'/instantiated-admission.json',JSON.stringify({passed:true,reproducedNativeTwoModuleRefusal:true,actualCompiledModules:true,authenticatedActualInstance:true,wrongBindings:5,changedBytes:true,missingDuplicateForeign:true,noLiveRetry:true},null,2));
 fs.writeFileSync(out+'/compiled-records.json',JSON.stringify(s,null,2));return {moduleHash:config.sha256,size:bytes.length,naturalCompiledCallEntryReturn:true,compiledDataAndStateReturns:true,defaultInert:true,fields:fields.length};
}
async function workerTransport(){
 const {Worker}=require('node:worker_threads');
 // Execute the emitted installer in a real isolated Worker, with both modules
 // compiled and the canonical launch argument intercepted by that installer.
 const emitted=process.env.NOX_CONSUMPTION_GENERATED;
 assert(emitted,'real Worker controls require the emitted original driver');
 const source=fs.readFileSync(emitted+'/browser-run.cjs','utf8');
 const installer=source.match(/await evaluate\(("(?:[^"\\]|\\.)*"),sessionId\);await send\('Runtime.runIfWaitingForDebugger'/);
 assert(installer,'actual emitted newborn Worker installer');
 const worker=new Worker(`
 const {parentPort,workerData}=require('node:worker_threads'),vm=require('node:vm'),fs=require('node:fs');
 const {createHostImports}=require(workerData.root+'/lib/host-imports');
 (async()=>{
  const bytes=fs.readFileSync(workerData.emitted+'/nox-consumption.wasm');
  const canonical=await WebAssembly.compile(fs.readFileSync(workerData.root+'/build/wine-assembly.wasm'));
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),ctx={exports:null,getMemory:()=>memory.buffer};
  const host=createHostImports(ctx).host;Object.assign(host,{memory,log(){},log_i32(){},exit(){}});
  globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>bytes});globalThis.crypto=require('node:crypto').webcrypto;
  globalThis.endpointIdentity=1;globalThis.workerSlot=0;
  globalThis.launch=async()=>{globalThis.instance=await WebAssembly.instantiate(canonical,{host});ctx.exports=instance.exports;globalThis.__mcmPassiveInstanceV1={ids:new WeakMap([[instance,'transport-instance']])};return true;};
  parentPort.on('message',async({id,expression})=>{try{parentPort.postMessage({id,value:await vm.runInThisContext(expression)});}catch(e){parentPort.postMessage({id,error:e.message});}});
  parentPort.postMessage({ready:true});
 })().catch(e=>{throw e;});`,{eval:true,workerData:{root,emitted,installer:JSON.parse(installer[1])}});
 let serial=0;const pending=new Map();
 worker.on('message',r=>{if(r.ready)return;const p=pending.get(r.id);pending.delete(r.id);r.error?p.reject(Error(r.error)):p.resolve(r.value);});
 await new Promise((resolve,reject)=>{worker.once('message',r=>r.ready?resolve():reject(Error('Worker readiness')));worker.once('error',reject);});
 const rpc=expression=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});worker.postMessage({id,expression});});
 try{
  const begin=source.indexOf('async function event(v)'),end=source.indexOf('\nasync function ',begin+1);
  const workerPromises=[],workers=new Map(),wire=[];
  const eventScope={workers,workerPromises,fs,Date,run:out,sha:q.sha,terminalError:null,log(){},save(){},observeTerminal:e=>{throw e;},
   send:async(method,params,sessionId)=>{wire.push(JSON.parse(JSON.stringify({method,params,sessionId})));return {};},
   evaluate:async(expression,sessionId)=>{const frame=JSON.parse(JSON.stringify({method:'Runtime.evaluate',params:{expression},sessionId}));wire.push(frame);return rpc(frame.params.expression);}};
  vm.createContext(eventScope);vm.runInContext(source.slice(begin,end)+';globalThis.onEvent=event;',eventScope);
  await eventScope.onEvent({method:'Target.attachedToTarget',params:{sessionId:'worker',targetInfo:{type:'worker',targetId:'transport-worker',url:'/lib/guest-worker.js'}}});await Promise.all(workerPromises);
  const launchLine=source.split('\n').find(l=>l.includes("const url='http://127.0.0.1:'"));assert(launchLine);
  const url=vm.runInNewContext(launchLine+';url',{port:1234,process:{env:{RENDER_BACKEND:'webgl'}},selectedApp:'nox_demo'});
  assert.equal(url,'http://127.0.0.1:1234/index.html?candidates&no-log&threads&app=nox_demo&gl-renderer=webgl');
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const pageScope={console:{log(){},warn(){},debug(){}},ArrayBuffer,Uint8Array,Int32Array,DataView,TextDecoder,URL,URLSearchParams,setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto,crossOriginIsolated:true,WINE_THREADS:true,
   location:{search:new URL(url).search},document:{getElementById:()=>null,createElement:()=>({}),body:{append(){}}},
   WebAssembly:{Module:WebAssembly.Module,compile:WebAssembly.compile,Memory:class{constructor(){return memory;}},instantiate:async()=>({exports:{set_lock_atomic_mode(){}}})},
   RenderWorker:{observeInstance:i=>i,Manager:class{constructor(){this.ready=Promise.resolve();}async stop(){}}},ThreadManager:class{recordInheritedWasmGlobal(){}},runningApps:[],createHostImports:()=>({host:{}}),GLRenderHost:{Bridge:class{}},GuestRpc:{createMainBroker:()=>({})},
   fetch:async url=>url.includes('host-import-sigs')?{ok:true,json:async()=>({sigs:{}})}:url.includes('api_table')?{ok:true,json:async()=>[]}:{ok:true,arrayBuffer:async()=>Uint8Array.from(fs.readFileSync(root+'/build/wine-assembly.wasm')).buffer}};
  pageScope.window=pageScope;
  pageScope.GuestThreadHost=class{constructor(opts){Object.assign(this,opts);}async start(){await rpc('launch()');this.link={...this,worker:{},slot:0,endpointIdentity:1};}async callExport(){}async stop(){}};
  vm.createContext(pageScope);vm.runInContext(fs.readFileSync(root+'/host.js','utf8')+'\nglobalThis.WineAssembly=WineAssembly;',pageScope);
  const Wine=pageScope.WineAssembly;Wine.supportsWasmTailCalls=()=>true;Wine.versionedUrl=x=>x;
  const wine=Object.create(Wine.prototype);Object.assign(wine,{_processObject:{exited:false},renderer:{},processId:1,ensureUiFontsReady:async()=>{},loadFiles:async()=>{},loadSubstituteFonts:async()=>{},getImports:()=>({host:{}}),logToUI(){},_installProcessSendBroker(){},_schedArm:()=>false});await wine.init(null);
  const receipt=await rpc('__noxConsumption.owner()');assert.equal(receipt.sha256,config.sha256);assert.equal(receipt.size,bytes.length);assert.equal(receipt.workerInstance,'transport-instance');
  const live={...owner,moduleSha256:config.sha256,endpoint:1,workerInstance:'transport-instance'},b={...binding,previous:{...image,identity:live}};
  await rpc('__noxConsumption.begin('+JSON.stringify(b)+','+JSON.stringify(live)+');true');
  assert.equal((await rpc('__noxConsumption.finish('+JSON.stringify(live)+')')).reason,null);
  await assert.rejects(rpc('__noxConsumption.begin('+JSON.stringify(b)+','+JSON.stringify({...live,workerInstance:'foreign'})+');true'),/live Worker owner/);
  await assert.rejects(rpc('__noxConsumption.begin('+JSON.stringify(b)+','+JSON.stringify(live)+');true'),/terminal/);
  const result={passed:true,actualWorkerTransport:true,emittedOriginalInstaller:true,emittedWorkerHandler:true,actualHostInit:true,originalLaunchUrl:url,transportFrames:wire.length,canonicalLaunchModule:true,actualInstalledObservationInstance:receipt,firstFailureSticky:true};
  fs.writeFileSync(out+'/worker-transport.json',JSON.stringify(result,null,2));return result;
 }finally{await worker.terminate();}
}
(async()=>{const controls=[];for(const action of ['move','click'])for(const m of ['wrongbinding','incomplete','success','firstfailure'])controls.push(await consumer(m,action));for(const m of ['unprimed','desynchronized'])controls.push(await consumer(m,'click'));const native=await compiled();const transport=process.env.NOX_CONSUMPTION_GENERATED?await workerTransport():null;const result={passed:true,controls,native,transport};fs.writeFileSync(out+'/controls.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));})().catch(e=>{console.error(e);process.exitCode=1;});
