'use strict';
// Offline original host/Worker installation control. No browser or native run.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),run=process.argv[2];assert(run,'generated run directory required');
const generated=fs.readFileSync(run+'/browser-corrected.cjs','utf8');
const {createHostImports}=require('../lib/host-imports'),loader=require('../lib/dll-loader');
const bound=require(path.resolve(run,'bound-input.cjs'));
(async()=>{
 const bytes=fs.readFileSync(root+'/build/wine-assembly.wasm'),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const ctx={getMemory:()=>memory.buffer},host=createHostImports(ctx).host;Object.assign(host,{memory,log(){},log_i32(){},exit(){}});
 const worker={WebAssembly:{instantiate:WebAssembly.instantiate},crypto:require('node:crypto').webcrypto,console:{log(){}},setTimeout,clearTimeout,Date,DataView,Uint8Array,
  requestAnimationFrame:f=>queueMicrotask(f),endpointIdentity:'original-endpoint',workerSlot:0,instance:null,fetch:async url=>({arrayBuffer:async()=>fs.readFileSync(root+'/test'+url)})};
 vm.createContext(worker);worker.importScripts=p=>vm.runInContext(fs.readFileSync(root+p,'utf8'),worker);
 const workers=new Map(),workerPromises=[],wire=[];
 const events={workers,workerPromises,fs,run,log(){},Date,sha:bound.sha,out:run,
  send:async(method)=>{wire.push(method);return {};},evaluate:async s=>{wire.push('Runtime.evaluate');return vm.runInContext(s,worker);},fail:e=>{throw e;}};
 vm.createContext(events);const start=generated.indexOf('async function event(v)'),end=generated.indexOf('\nasync function state()',start);
 vm.runInContext(generated.slice(start,end)+'\nglobalThis.onEvent=event;',events);
 await events.onEvent({method:'Target.attachedToTarget',params:{sessionId:'owner',targetInfo:{type:'worker',targetId:'original-worker',url:'/lib/guest-worker.js'}}});await Promise.all(workerPromises);
 assert.equal(typeof worker.__lbArm,'function');
 let hostInitialized=false;
 const scope={console:{log(){},warn(){},debug(){}},ArrayBuffer,Uint8Array,Int32Array,DataView,TextDecoder,URL,URLSearchParams,setTimeout,clearTimeout,
  crypto:require('node:crypto').webcrypto,crossOriginIsolated:true,WINE_THREADS:true,location:{search:'?candidates&no-log&threads'},
  document:{getElementById:()=>null,createElement:()=>({}),body:{append(){}}},
  WebAssembly:{Module:WebAssembly.Module,compile:WebAssembly.compile,Memory:class{constructor(){return memory;}},instantiate:async()=>({exports:{set_lock_atomic_mode(){}}})},
  RenderWorker:{observeInstance:i=>i,Manager:class{constructor(){this.ready=Promise.resolve();}async stop(){}}},ThreadManager:class{recordInheritedWasmGlobal(){}},
  runningApps:[],createHostImports:()=>({host:{}}),GLRenderHost:{Bridge:class{}},GuestRpc:{createMainBroker:()=>({})},
  fetch:async url=>url.includes('host-import-sigs')?{ok:true,json:async()=>({sigs:{}})}:url.includes('api_table')?{ok:true,json:async()=>[]}:{ok:true,arrayBuffer:async()=>bytes}};
 scope.window=scope;
 scope.GuestThreadHost=class{
  constructor(o){Object.assign(this,o);}
  async start(){
   worker.selectedModule=await WebAssembly.compile(bytes);worker.built={imports:{host}};
   const original=fs.readFileSync(root+'/lib/guest-worker.js','utf8');
   const installation=original.slice(original.indexOf('const result = await WebAssembly.instantiate(selectedModule, built.imports);'),original.indexOf('if (quake2LoadObservation) instance ='));
   assert(installation.includes('instance = result.exports ? result : (result.instance || result)'));
   await vm.runInContext('(async()=>{'+installation+'})()',worker);ctx.exports=worker.instance.exports;
   this.link={...this,worker:{},slot:0,endpointIdentity:worker.endpointIdentity};hostInitialized=true;
  }
  async callExport(){}async stop(){}
 };
 vm.createContext(scope);vm.runInContext(fs.readFileSync(root+'/host.js','utf8')+'\nglobalThis.WineAssembly=WineAssembly;',scope);
 const Wine=scope.WineAssembly;Wine.supportsWasmTailCalls=()=>true;Wine.versionedUrl=x=>x;
 const wine=Object.create(Wine.prototype);Object.assign(wine,{_processObject:{exited:false},renderer:{},processId:1,ensureUiFontsReady:async()=>{},loadFiles:async()=>{},loadSubstituteFonts:async()=>{},getImports:()=>({host:{}}),logToUI(){},_installProcessSendBroker(){},_schedArm:()=>false});
 await wine.init(null);assert(hostInitialized);assert.equal(worker.__lbNative.instance,worker.instance);
 const e=worker.instance.exports,pe=fs.readFileSync(root+'/test/binaries/candidates/lbreakout2-251/game/LBREAKOUT/lbreakout2.exe'),dll=fs.readFileSync(root+'/test/binaries/candidates/lbreakout2-251/game/LBREAKOUT/SDL.dll');
 new Uint8Array(memory.buffer).set(pe,e.get_staging());assert(e.load_pe(pe.length));
 const loaded=loader.loadDlls(e,memory.buffer,pe,[{name:'SDL.dll',bytes:dll},{name:'msvcrt.dll',bytes:fs.readFileSync(root+'/test/binaries/dlls/msvcrt.dll')}],()=>{});
 // Explicit isolated menu objects are only for offline arming validation.
 const v=new DataView(memory.buffer),w=(p,n)=>v.setUint32(e.guest_to_wasm(p),n,true),menu=e.guest_alloc(64),item=e.guest_alloc(128),target=e.guest_alloc(64);
 w(0x477150,menu);w(menu+28,item);w(item+4,6);w(item+72,target);
 if(typeof worker.installStartupCompletion==='function'){
  const startup=await worker.__lbArm({token:'startup-control',phase:'startup',expected:0});
  assert(startup.active);assert.equal(e.get_bp_addr(),0x426026,'one original SDL display return target');
  worker.__lbObserver.stop('offline startup arm control');
 }
 const owner=JSON.parse(JSON.stringify(vm.runInContext(bound.WORKER_READ,worker)));
 let terminal=false,reads=0,startupReceipt=null,clock=Date.now(),startupMode=false,startupSuccess=false;
 const caller={assert,bound,workers,latest:{label:'main-menu',sha256:'a'.repeat(64)},deadline:Date.now()+2000,Date,
  owningWorker:async()=> 'owner',save:(name,value)=>{
   if(startupSuccess){assert(['completion-startup-original-startup.json','presentation-startup-original-startup.json'].includes(name));fs.writeFileSync(run+'/installed-'+name,JSON.stringify(value,null,2));}
   else if(startupMode){assert.equal(name,'completion-failure-startup-cause-startup.json');startupReceipt=value;fs.writeFileSync(run+'/installed-startup-failure.json',JSON.stringify(value,null,2));}
   else {assert.equal(name,'completion-failure-menu-control-menu.json');assert.equal(value.lastObservation,null);}
  },wait:async()=>{if(startupMode)clock=caller.deadline;},
  evaluate:async expression=>{assert(!terminal,'terminal: no later protocol');reads++;const value=await vm.runInContext(expression,worker);return vm.runInContext('JSON.parse('+JSON.stringify(JSON.stringify(value))+')',caller);},
  fail:()=>{terminal=true;caller.terminal=true;},terminal:false};
 vm.createContext(caller);
 const armStart=generated.indexOf('async function armObservation(c)'),armEnd=generated.indexOf('async function bindReady()',armStart);
 vm.runInContext(generated.slice(armStart,armEnd)+'\nglobalThis.arm=armObservation;globalThis.finish=completion;',caller);
 if(typeof worker.installStartupCompletion==='function'){
  // Original SDL allocates and fills the isolated surface. The complete
  // generated caller reads the actual installed Worker, not a snapshot stub.
  const stack=e.guest_alloc(65536)+65000;
  const call=(pc,args)=>{e.set_esp(stack);e.call_func(pc,...args.slice(0,4));const esp=e.get_esp()>>>0;for(let i=4;i<args.length;i++)w(esp+4+i*4,args[i]);for(let n=0;e.get_eip();n++){assert(n<20000);e.run(100);assert.equal(e.get_yield_reason(),0);}return e.get_eax()>>>0;};
  const sdl=loaded[0].loadAddr,addr=name=>loader._test.findDllExport(e,memory.buffer,sdl,name);
  const screen=call(addr('SDL_CreateRGBSurface'),[0,640,480,32,0xff0000,0xff00,0xff,0]);assert(screen);w(0x452464,screen);
  startupMode=true;caller.Date={now:()=>clock};caller.deadline=clock+2000;
  const startup=await caller.arm({id:'startup-cause',phase:'startup',expected:0});caller.deadline=startup.deadline;
  e.set_esp(stack);e.call_func(addr('SDL_FillRect'),screen,0,0,0);
  e.set_bp(sdl+0x208fa);e.run(1000);assert.equal(e.get_eip()>>>0,sdl+0x208fa);
  const beforeReads=reads;await assert.rejects(caller.finish(startup),/guest completion deadline/);assert(terminal);
  const sample=startupReceipt.lastObservation.lastSample;
  assert.equal(sample.pc,sdl+0x208fa);assert.equal(sample.fillSurface.width,640);assert.equal(sample.fillRect.height,480);assert.equal(sample.stack.words.length,24);assert(!sample.error);
  assert.equal(reads-beforeReads,2,'one owner and one existing snapshot, zero post-deadline requests');
  const first=JSON.stringify(startupReceipt),atFailure=reads;
  await assert.rejects(caller.finish(startup),/terminal/);assert.equal(reads,atFailure);assert.equal(JSON.stringify(startupReceipt),first);
  // Retire the control's held original block before clearing its skip-once.
  e.run(1);worker.__lbObserver.stop('offline startup retention');e.clear_bp();e.clear_yield();
  startupMode=false;terminal=false;caller.terminal=false;caller.Date=Date;caller.deadline=Date.now()+2000;
  startupSuccess=true;
  const full=await caller.arm({id:'startup-original',phase:'startup',expected:0});
  w(0x452468,200);e.set_esp(stack);e.call_func(0x41083f,0,0,0,0);
  for(let n=0;worker.__lbObserver.snapshot().active;n++){assert(n<2000);e.run(1);assert.equal(e.get_yield_reason(),0,JSON.stringify({pc:e.get_eip()>>>0,bp:e.get_bp_addr(),observation:worker.__lbObserver.snapshot()}));}
  assert.equal(worker.__lbObserver.snapshot().reason,'complete');
  await caller.finish(full);assert(!terminal,'actual original SDL and manager returns satisfy the complete generated caller');
  e.clear_yield();e.run(1);e.clear_yield();startupSuccess=false;
 }
 const a=await caller.arm({id:'menu-control',phase:'menu',expected:13});
 assert.equal(a.token,'menu-control-menu');assert.equal(a.owner.instance,owner.instance);
 assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext(bound.WORKER_READ,worker))),owner);
 worker.instance={exports:e};assert.notEqual(vm.runInContext(bound.WORKER_READ,worker).instance,owner.instance,'equal exports cannot reuse installed instance identity');
 await assert.rejects(caller.finish(a),/completion owner binding/);assert(terminal);
 const count=reads;await assert.rejects(caller.finish(a),/terminal/);assert.equal(reads,count);worker.__lbObserver.stop('offline complete');
 console.log(JSON.stringify({passed:true,actualGeneratedAttachedWorker:true,actualHostInit:true,originalWorkerInstallation:true,realWasm:true,originalExeAndSDL:true,originalStartupCompleteCaller:true,originalFillTimeoutRetainedWithoutLaterProtocol:true,menuArm:true,installedInstanceReplacementRefused:true,wire}));
})().catch(e=>{console.error(e);process.exitCode=1;});
