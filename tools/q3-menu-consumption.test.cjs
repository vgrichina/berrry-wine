'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Module=require('node:module');
const q=require('./q3-menu-consumption.cjs'),current=require('./q3-current-module.cjs'),route=require('./q3-current-foreign-closure-v1.cjs');
const observer=require('../lib/q3-input-observer.js'),{createHostImports}=require('../lib/host-imports');
const boundary=require('./q3-execution-boundary.cjs');
const root=path.resolve(__dirname,'..'),out=process.env.Q3_MENU_TEST_OUT;
assert(out&&path.resolve(out).startsWith(root+'/scratch/runs/'));fs.mkdirSync(out,{recursive:true});
const owner=Object.fromEntries(observer.ownerFields.map(k=>[k,'offline-'+k]));
const image={label:'startup',sha256:'a'.repeat(64),identity:owner};
const binding={id:'enter',label:'after',previous:image};
const bytes=q.compile();fs.writeFileSync(out+'/module.wasm',bytes);
assert(WebAssembly.validate(bytes));
const moduleHash=q.sha(bytes),config={version:q.version,url:'/offline.wasm',size:bytes.length,sha256:moduleHash};
const plain=route.composition(route.version).compose().source;assert.equal(q.compose(plain),plain);
process.env.Q3_BOUND_INPUT_OBSERVATION='1';
const generated=q.compose(route.composition(route.version).compose().source,config);
delete process.env.Q3_BOUND_INPUT_OBSERVATION;new vm.Script(Module.wrap(generated));
// Extract the actual emitted command body via the retained exact harness.
const filename=path.join(__dirname,'q3-input-observer.test.cjs');
const harness=fs.readFileSync(filename,'utf8').split('\n(async()=>{')[0];
const h=new Module(filename,module);h.filename=filename;h.paths=module.paths;
h._compile(harness+'\nmodule.exports={harness:m.exports};',filename);
async function consumer(mode){
 const memory=new ArrayBuffer(0x20000),e={get_eax:()=>7,get_esp:()=>0x401004};
 const o=q.recorder({getExports:()=>e,getMemory:()=>memory});let sent=0,marked=0,captured=0,cancelled=0;
 const p=h.exports.harness.page(false);
 p.scope.__q3BoundInput={begin:()=>({active:true})};
 const evaluate=async(expression,session)=>{
  if(session==='worker')return vm.runInNewContext(expression,{globalThis:{__q3MenuConsumption:o}});
  return p.evaluate(expression);
 };
 if(mode==='wrong-owner')o.begin(binding,owner);
 if(mode==='incomplete'){
  o.begin(binding,owner);o.event(1,0x40aa70,0x401010,0x401000);
 }
 const latest=mode==='wrong-owner'?{...image,identity:{...owner,epoch:'wrong'}}:image;
 const context={assert,root,deadline:Date.now()+60000,latest,out:'/offline',pageSession:'page',workers:new Map([['worker',{targetId:owner.workerTarget,sessionId:'worker'}]]),
  process:{env:{}},checkTerminal(){if(cancelled)throw Error('firstfailure');},observeTerminal(e){cancelled++;throw e;},
  fs:{readFileSync:f=>f.endsWith('-review.json')?JSON.stringify({...latest,review:'offline reviewed'}):'image'},sha:()=>image.sha256,
  save(){},log(){},send:async()=>{if(cancelled)throw Error('terminal before protocol');sent++;if(mode==='firstfailure'){cancelled++;throw Error('first native failure');}return {};},evaluate,wait:async()=>{},trace:{span:(_,f)=>f()},
  bound:require('./q3-input-delivery.cjs'),chain:{admit:async(_,f)=>f({live:{identity:latest.identity}}),progress:async()=>({physical:[{key:13,state:0}]})},
  capture:async()=>{captured++;},require:n=>n==='./ordinary-keys.cjs'?require('../scratch/runs/20261108-q3-gl-readiness-gameplay/ordinary-keys.cjs'):require(n)};
 const run=h.exports.harness.body(generated,context);
 const command={id:'enter',action:'key',key:'Enter',holdMs:50,waitMs:0,reviewRef:'startup',label:'after'};
 if(mode==='success'){await run(command,()=>marked++);assert.equal(marked,1);assert.equal(sent,2);assert.equal(captured,1);}
 else {
  await assert.rejects(run(command,()=>marked++));
  assert.equal(captured,0);
  if(mode==='firstfailure'){assert.equal(marked,1);assert.equal(sent,1);o.stop('firstfailure');const count=o.snapshot(owner).records.length;o.event(1,0x40aa70,0x401010,0x401000);assert.equal(o.snapshot(owner).records.length,count);}
  else {assert.equal(marked,0);assert.equal(sent,0);}
 }
 return {mode,sent,marked,captured};
}
async function compiled(){
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),ctx={exports:null,getMemory:()=>memory.buffer};
 const host=createHostImports(ctx).host;Object.assign(host,{memory,log(){},log_i32(){},exit(){}});
 const scope={WebAssembly:{instantiate:WebAssembly.instantiate,compile:WebAssembly.compile},
  fetch:async()=>({ok:true,arrayBuffer:async()=>bytes}),crypto:require('node:crypto').webcrypto,performance,console:{debug(){}},memory,
  endpointIdentity:1,workerSlot:0};
 // Execute the emitted installer through the real transport decorator. The
 // first native attempt exposed its expression nesting, absent in a raw VM.
 let outgoing;class Socket{addEventListener(){}send(data){outgoing=JSON.parse(data);}}
 const transport=boundary.install({WebSocket:Socket,trace:{snapshot(){}},write(){}}),socket=new transport.WebSocket();
 socket.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:q.workerSource(config)+';'}}));
 assert.throws(()=>new vm.Script(outgoing.params.expression),/Unexpected token/,'retained native parser failure reproduced');
 socket.send(JSON.stringify({id:2,method:'Runtime.evaluate',params:{expression:q.workerSource(config)}}));
 vm.createContext(scope);vm.runInContext(outgoing.params.expression,scope);
 const instance=await scope.WebAssembly.instantiate(await WebAssembly.compile(bytes),{host}),e=ctx.exports=instance.exports;
 scope.instance=instance;scope.__mcmPassiveInstanceV1={ids:new WeakMap([[instance,'actual-fixture-instance']])};
 const o=scope.__q3MenuConsumption,live={...owner,moduleSha256:moduleHash,endpoint:1,workerInstance:'actual-fixture-instance'};
 const liveBinding={...binding,previous:{...image,identity:live}};
 const mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),exe=fs.readFileSync(root+'/test/binaries/notepad.exe');
 mem.set(exe,e.get_staging());e.load_pe(exe.length);e.set_api_log(0);
 const wa=a=>a-0x400000+0x12000,put=(a,b)=>{mem.set(b,wa(a));e.invalidate_code_range(a,b.length);};
 const d32=v=>[v&255,v>>>8&255,v>>>16&255,v>>>24&255];
 put(0x401000,[0xe8,...d32(0x40aa70-0x401005),0xeb,0xfe]);
 put(0x40aa70,[0xb8,...d32(123),0xc3]);
 e.set_esp(0x74ff000);e.set_eip(0x401000);
 // This is a synthetic x86 fixture, never an original-game handler call.
 // Natural CALL/RET in the real generated module must supply the evidence.
 const before=Buffer.from(memory.buffer.slice(wa(0x401000),wa(0x401010)));
 o.begin(liveBinding,live);e.run(10);
 const s=o.snapshot(live);assert.equal(s.reason,null);assert.equal(s.pendingFrames,0);
 assert.deepEqual(Array.from(s.records.filter(r=>r.kind.startsWith('guest-')),r=>r.kind),['guest-call','guest-entry','guest-return']);
 assert.equal(s.records.find(r=>r.kind==='guest-return').result,123);
 assert.equal(e.get_eax(),123);assert.equal(e.get_esp(),0x74ff000);
 assert.deepEqual(Buffer.from(memory.buffer.slice(wa(0x401000),wa(0x401010))),before);
 // All nineteen fields refuse independently, and an observation cannot revive.
 for(const field of observer.ownerFields){const r=q.recorder({getExports:()=>e,getMemory:()=>memory.buffer});assert.throws(()=>r.begin(binding,{...owner,[field]:'wrong'}),/binding/);assert.throws(()=>r.begin(binding,owner),/terminal/);}
 let calls=0;const original=function(x){calls++;assert.equal(this,host);return x;};
 assert.equal(o.wrap('check_input',original).call(host,0x000d0100),0x000d0100);assert.equal(calls,1);
 const sentinel=Error('original import');assert.throws(()=>o.wrap('check_input',()=>{throw sentinel;})(),x=>x===sentinel);assert.equal(o.snapshot(live).reason,'production-import-failure');
 return {moduleHash,size:bytes.length,realGeneratedWasm:true,naturalCallEntryReturn:true};
}
async function startupControl(){
 const selected=current.SELECTED,live={endpoint:1,slot:0,instance:'startup-instance',gpu:false};
 const status={phase:'parked',selected,flags:{threads:true,isolated:true,shared:true,gpu:false},endpoint:1,slot:0,token:'parked-token'};
 const workers=new Map([['worker',{url:'/lib/guest-worker.js',targetId:'worker',sessionId:'worker',scripts:[{scriptId:'module'}]}]]);
 const saved={};let releases=0;
 const options={fixture:true,deadline:Date.now()+60000,workers,pageSession:'page',save:(n,v)=>saved[n]=v,
  evaluate:async expression=>{
   if(expression==='typeof WINE_REDLINE_STARTUP===\'undefined\'?null:WINE_REDLINE_STARTUP.status()'||expression==='WINE_REDLINE_STARTUP.status()')return status;
   if(expression===require('./q3-startup.cjs').WORKER_READ)return live;
   if(expression.startsWith('WINE_REDLINE_STARTUP.release(')){releases++;const proof=JSON.parse(expression.slice(29,-1));assert.equal(proof.sha256,selected.sha256);assert.equal(proof.bytes,selected.bytes);return {phase:'released',...proof};}
   if(expression.includes('abort('))return {phase:'refused'};
   throw Error('unexpected startup evaluation '+expression);
  },send:async(method)=>{assert.equal(method,'Debugger.getScriptSource');return {bytecode:bytes.toString('base64')};}};
 await assert.rejects(require('./q3-startup.cjs').launch(options),/live selected CPU SHA/);
 assert.equal(releases,0);
 const result=await q.startup(config).launch(options);assert.equal(releases,1);
 assert.deepEqual(result.observationModule,{sha256:moduleHash,bytes:bytes.length});
 assert.equal(saved['startup-admission.json'].receipt.observationModule.sha256,moduleHash);
 return {canonicalAdmissionPreserved:true,actualObservationModuleVerified:true,deadlinesUnchanged:true};
}
async function workerFailure(){
 const start=generated.indexOf('async function event(v)'),end=generated.indexOf('\nasync function ',start+1);
 assert(start>0&&end>start);const wire=[],workerPromises=[];let terminal=0;
 const context={workers:new Map(),workerPromises,fs,run:'/offline',Date,
  send:async method=>{assert.equal(terminal,0);wire.push(method);return {};},evaluate:async()=>{throw Error('first Worker installer failure');},
  observeTerminal:()=>{terminal++;},log(){}};
 vm.createContext(context);vm.runInContext(generated.slice(start,end)+'\nglobalThis.onEvent=event;',context);
 await context.onEvent({method:'Target.attachedToTarget',params:{sessionId:'worker',targetInfo:{type:'worker',targetId:'owner',url:'/lib/guest-worker.js'}}});
 await Promise.allSettled(workerPromises);await Promise.resolve();
 assert.equal(terminal,1);assert.deepEqual(wire,['Debugger.enable','Runtime.enable']);
 return {firstWorkerFailureTerminal:true,noResumeInputCaptureRetry:true};
}
(async()=>{
 const controls=[];for(const mode of ['wrong-owner','incomplete','success','firstfailure'])controls.push(await consumer(mode));
 const native=await compiled(),startup=await startupControl(),workerTerminal=await workerFailure();const result={passed:true,controls,native,startup,workerTerminal,defaultInert:true};
 fs.writeFileSync(out+'/controls.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1;});
