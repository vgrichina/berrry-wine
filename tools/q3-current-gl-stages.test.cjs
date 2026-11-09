'use strict';
// Offline production generator/preload and shared-ring integration. Device
// error query is a controlled stub; no browser, GPU, game or native attribution.
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const cp=require('node:child_process'),crypto=require('node:crypto'),path=require('node:path');
const Module=require('node:module'),{Worker}=require('node:worker_threads');
const current=require('./q3-current-module.cjs'),route=require('./q3-current-foreign-closure-v1.cjs');
const Host=require('../lib/gl-render-host');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]);
assert(out.startsWith(root+'/scratch/runs/'),'owned evidence directory required');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const options={foreignClosureVersion:route.version,checkpointObserverVersion:current.checkpointObserverVersion};
const glCommit='c6094c4edf87dcd7b80c4caa4225857bc3a5eb00';
function preload(source){
 const marker="'Page.addScriptToEvaluateOnNewDocument',{source:`";
 const begin=source.indexOf(marker)+marker.length,finish=source.indexOf('`}',begin);
 assert(begin>=marker.length&&finish>begin,'actual consumer preload seam');
 const script=source.slice(begin,finish);assert(!script.includes('${'));
 return script;
}
function page(script,{timerFailure=false,logFailure=false}={}){
 let next=0;const timers=new Map(),all=[],rows=[],listeners=new Map();
 const scope={performance:{now:()=>123},console:{debug(...args){if(logFailure&&args[0]==='Q3_GL_INDEPENDENT_PARTIAL')throw Error('log observer');rows.push(args);}},
  setInterval(fn,delay){assert.equal(delay,500);if(timerFailure)throw Error('timer observer');const id=++next;timers.set(id,fn);all.push(fn);return id;},
  clearInterval(id){assert(timers.delete(id),'clear each live timer once');},
  addEventListener(event,fn,opts){if(event==='pagehide'){assert.equal(opts.once,true);listeners.set(event,fn);}},
  fetch(){assert.fail('no fetch');},postMessage(){assert.fail('no RPC');}};
 vm.runInNewContext(script,scope);
 assert.equal(timers.size,0,'diagnostic timer only starts on host assignment');
 return {scope,timers,all,rows,hide:()=>listeners.get('pagehide')(),
  tick(){for(const fn of [...timers.values()])fn();},
  snapshots(){return rows.filter(r=>r[0]==='Q3_GL_INDEPENDENT_PARTIAL').map(r=>JSON.parse(r[1]));}};
}
function syntheticHost({fail=false}={}){
 let armed=false,reads=0;
 return {configureDiagnostics(o){assert.equal(o.enabled,true);assert.equal(o.maxRecords,64);armed=true;},
  diagnosticSnapshot(){assert(armed);reads++;if(fail)throw Error('snapshot observer');return {status:'UNKNOWN',render:{records:[]}};},
  get reads(){return reads;},get armed(){return armed;}};
}
function timerControls(script){
 for(const fail of [false,true])for(const logFailure of [false,true]){
  const p=page(script,{logFailure}),host=syntheticHost({fail});p.scope.GLRenderHost=host;
  assert(host.armed,'configure before ordinary host imports');assert.equal(host.reads,0);
  const callback=p.all[0];for(let n=0;n<1024;n++)p.tick();
  assert.equal(host.reads,1024,'failed reads/logging consume sample budget');assert.equal(p.timers.size,0);
  callback();assert.equal(host.reads,1024,'queued callback after stop is inert');
  if(!fail&&!logFailure){assert.equal(p.snapshots().length,1024);assert.equal(p.snapshots().at(-1).sample,1024);}
  p.hide();p.scope.GLRenderHost=syntheticHost();assert.equal(p.timers.size,0,'pagehide prevents rearming');
 }
 const p=page(script),first=syntheticHost(),second=syntheticHost();
 p.scope.GLRenderHost=first;p.tick();const stale=p.all[0];p.scope.GLRenderHost=second;
 assert.equal(p.timers.size,1,'replacement retains one owner timer');stale();p.tick();
 assert.equal(first.reads,1);assert.equal(second.reads,1);p.hide();p.tick();
 assert.equal(p.timers.size,0);assert.equal(second.reads,1);
 const unavailable=page(script,{timerFailure:true}),host=syntheticHost();
 unavailable.scope.GLRenderHost=host;assert(host.armed);assert.equal(unavailable.timers.size,0);unavailable.hide();
}
// Genuine adapter/Stream/bridge opcode12, held inside the controlled backend
// on a Node test thread. The page VM reads only Host.diagnosticSnapshot while
// render-owner JS cannot run. This is plumbing evidence, never GPU evidence.
const stalledRenderer=`
const {workerData:d}=require('node:worker_threads'),vm=require('node:vm'),fs=require('node:fs');
const GL=require(d.gl),Stream=require(d.stream),gate=new Int32Array(d.gate);
let bridge;
class ControlledBridge extends GL.OpenGLHostBridge{
 constructor(o){super(o);bridge=this;}
 _activateWebgl(){}
}
const context={OpenGLCompat:{...GL,OpenGLHostBridge:ControlledBridge},GLCommandStream:Stream,
 SharedArrayBuffer,Atomics,Int32Array,Float64Array,performance};
vm.runInNewContext(fs.readFileSync(d.adapter,'utf8'),context);
const adapter=context.GLRenderWorker.create({instance:{exports:{}},memory:{buffer:d.memory},
 backend:'webgl',endpointId:31,options:{glBatchDiagnostics:{buffer:d.ring}},sendFrame(){throw Error('no frame expected');}});
const frontend={lastError:0,flushPendingDraw(){},gl:{},backend:{getError(){
 Atomics.add(gate,2,1);Atomics.store(gate,0,1);
 if(Atomics.wait(gate,1,0,15000)==='timed-out')throw Error('control deadline');return 0x501;
}}};
bridge.contexts.set(9,{handle:9,hwnd:8,drawable:{},software:false,frontend,backend:frontend.backend});
bridge.currentByOwner.set(7,9);
try{
 const result=adapter.execute({memoryOffset:128,bytes:36,owner:7,frameToken:73,windows:[{hwnd:8,w:1,h:1}]});
 if(result.value!==0x501)throw Error('changed query result');Atomics.store(gate,3,1);
}finally{bridge.contexts.clear();adapter.destroy();}
`;
async function ringIntegration(script){
 Host.configureDiagnostics({enabled:false});
 assert.equal(new Host.Bridge({renderer:{}}).diagnosticSnapshot().enabled,false,'ordinary host remains opt-in');
 const p=page(script);p.scope.GLRenderHost=Host;
 const host=new Host.Bridge({renderer:{}}),gate=new Int32Array(new SharedArrayBuffer(16));
 assert.equal(host.batchDiagnostics.capacity,64,'real module assignment arms normal constructor');
 const memory=new SharedArrayBuffer(4096),view=new DataView(memory);
 view.setUint32(128,36,true);view.setUint32(132,12,true);view.setUint32(136,123,true);view.setUint32(140,4,true);
 const worker=new Worker(stalledRenderer,{eval:true,workerData:{memory,gate:gate.buffer,ring:host.batchDiagnostics.buffer,
  gl:require.resolve('../lib/gl-compat'),stream:require.resolve('../lib/gl-command-stream'),adapter:require.resolve('../lib/gl-render-worker')}});
 let workerError;worker.on('error',e=>{workerError=e;});
 const exited=new Promise(resolve=>worker.once('exit',resolve));
 const watchdog=setTimeout(()=>worker.terminate(),25000);
 try{
  const deadline=Date.now()+10000;
  while(!Atomics.load(gate,0)){if(workerError)throw workerError;assert(Date.now()<deadline,'render gate entry');await new Promise(r=>setTimeout(r,5));}
  for(let n=0;n<4;n++)p.tick();
  assert.equal(Atomics.load(gate,2),1,'sampling issues no additional GL operation');
  assert.equal(Atomics.load(gate,3),0,'snapshot does not settle stalled operation');
  const samples=p.snapshots();assert.equal(samples.length,4);
  for(const sample of samples){
   const snap=sample.snapshot,last=snap.render.records.at(-1);
   assert.equal(snap.status,'UNKNOWN');assert.equal(last.kind,'get-error-backend-enter');
   for(const [key,value] of Object.entries({opcode:12,endpointId:31,frameToken:73,owner:7,context:9,memoryOffset:128,bytes:36,aux:123}))assert.equal(last[key],value,key);
   assert.equal(last.beginSequence,null);assert.equal(last.durationMs,null);
   assert.equal(snap.render.sequence,samples[0].snapshot.render.sequence,'reads do not mutate ring');
  }
  p.hide();assert.equal(p.timers.size,0);
  Atomics.store(gate,1,1);Atomics.notify(gate,1);
  assert.equal(await exited,0);if(workerError)throw workerError;
  assert.equal(Atomics.load(gate,3),1);assert.equal(Atomics.load(gate,2),1);
  assert.equal(host.diagnosticSnapshot().status,'UNKNOWN','exit is not native progress attribution');
 }finally{
  p.hide();Host.configureDiagnostics({enabled:false});clearTimeout(watchdog);await host.close();
  Atomics.store(gate,1,1);Atomics.notify(gate,1);await worker.terminate();await exited;
 }
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const pins=current.validate(options);
 for(const name of ['lib/gl-compat.js','lib/gl-render-host.js','lib/gl-render-worker.js']){
  const published=cp.execFileSync('git',['show',glCommit+':'+name]);
  assert.equal(pins.files.find(p=>p.path===name).sha256,hash(published));
  for(const sameSize of [false,true]){
   const read=fs.readFileSync,dest=path.join(out,'refuse-'+path.basename(name)+'-'+sameSize);
   fs.readFileSync=function(file,...args){
    if(path.resolve(String(file))===path.join(root,name)){
     const bytes=Buffer.from(read.call(this,file));
     if(sameSize){bytes[bytes.length-1]^=1;return bytes;}return Buffer.concat([bytes,Buffer.from('\n')]);
    }return read.call(this,file,...args);
   };
   try{assert.throws(()=>current.prepare(dest,{foreignClosureVersion:route.version}),/provider size|provider SHA/);assert(!fs.existsSync(dest));}
   finally{fs.readFileSync=read;}
  }
 }
 // Invoke the actual current generator and authenticate its sealed closure.
 const prepared=path.join(out,'prepared'),seal=current.prepare(prepared,{foreignClosureVersion:route.version});
 route.staged(prepared,route.version,seal.manifestSHA256);
 const generated=route.composition(route.version,prepared).compose();new vm.Script(generated.source);
 const script=preload(generated.source);
 // Compare to the published stdin-fixed consumer: only page preload changes.
 const filename=path.join(__dirname,'q3-current-module.cjs'),prior=new Module(filename,module);
 prior.filename=filename;prior.paths=module.paths;
 prior._compile(cp.execFileSync('git',['show','2b945315a:tools/q3-current-module.cjs'],{encoding:'utf8'}),filename);
 assert.equal(current.composeCheckpointCaller.toString(),prior.exports.composeCheckpointCaller.toString(),'published stdin/deadline/ownership transform exact');
 const compose=current.composeStartupDiagnostics;let baseline;
 try{current.composeStartupDiagnostics=prior.exports.composeStartupDiagnostics;baseline=route.composition(route.version,prepared).compose();}
 finally{current.composeStartupDiagnostics=compose;}
 assert.equal(generated.source.replace(script,preload(baseline.source)),baseline.source,'all protocol, deadlines, terminal and ownership code unchanged');
 assert.equal(generated.fixtureSource,baseline.fixtureSource);assert.equal(generated.controlsSource,baseline.controlsSource);
 timerControls(script);await ringIntegration(script);
 console.log(JSON.stringify({passed:true,publishedGLProviders:3,driftRefusals:6,actualCurrentGenerator:true,authenticatedStagedClosure:true,
  boundedSamples:1024,hostReplacementAndPagehide:true,independentStalledRing:true,noNewRPCOrGL:true,stdinFixExact:true,missingExit:'UNKNOWN',browserStarted:false}));
})().catch(error=>{console.error(error);process.exitCode=1;});
