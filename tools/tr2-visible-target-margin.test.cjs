'use strict';
// Offline controls of the emitted caller and its actual Worker installation.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),Module=require('node:module'),crypto=require('node:crypto');
const helper=require('./tr2-visible-target-margin.cjs'),observer=require('./tr2-action-observer.cjs');
const root=path.resolve(__dirname,'..'),source=helper.compose(root),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const generated=process.argv[2];if(generated)assert.equal(fs.readFileSync(generated,'utf8'),source);
let checks=0;
for(const holdMs of [0,301,400]){assert.throws(()=>helper.guard().validate({action:'key',key:'ArrowLeft',holdMs}));checks++;}
for(const ms of [300,400,401]){const g=helper.guard(),c={action:'key',key:'ArrowLeft',holdMs:300};g.validate(c);if(ms<=400)g.hold(c,{started:100,releaseAt:400,releaseCompletedAt:100+ms});else assert.throws(()=>g.hold(c,{started:100,releaseAt:400,releaseCompletedAt:501}));checks++;}
assert.throws(()=>helper.guard().validate({action:'key',key:'Control',holdMs:1900}));checks++;
// Run the complete generated execute function, including admission, actual
// independent key release, post-hold guard and image check.
(async()=>{
 const start=source.indexOf('async function execute(c,markDispatch)'),end=source.indexOf('\n(async()=>{',start);
 for(const mode of ['changed','overrun','unchanged','stale']){
  const margin=helper.guard(),wire=[],files=new Map(),latest={label:'before',sha256:'a'.repeat(64)};
  const command={id:'navigation',action:'key',key:'ArrowLeft',holdMs:300,waitMs:0,label:'after',reviewRef:'before'};
  const fakeBound={hold:async o=>{wire.push('down');await o.sample();wire.push('up');return {started:100,releaseAt:400,releaseCompletedAt:mode==='overrun'?501:400};}};
  const scope={require:n=>n==='../../../tools/png-diff.js'?{diffPng:()=>({changed:1})}:n==='./ordinary-keys.cjs'?{validate(){}}:n==='./shot-options.cjs'?{validate(){}}:require(n),assert,margin,bound:fakeBound,actionObserverUsed:false,
   Date:class extends Date{static now(){return 100;}},deadline:2000,latest,fs:{readFileSync:()=>JSON.stringify({...latest,canvas:{rect:{left:0,top:0,width:10,height:10}},review:'fresh visible scene'})},sha:()=>latest.sha256,
   out:'.',pageSession:'page',send:async m=>wire.push(m),save:(n,v)=>files.set(n,v),log(){},wait:async()=>{},
   chain:{nativeMode:false,admit:async(r,f)=>{if(mode==='stale')throw Error('stale scene refused');return f({live:{identity:{}}});},progress:async()=>({})},
   capture:async()=>{scope.latest={...latest,label:'after',sha256:mode==='unchanged'?latest.sha256:'b'.repeat(64)};wire.push('capture');}};
  vm.createContext(scope);vm.runInContext(source.slice(start,end)+';globalThis.execute=execute;',scope);
  if(mode==='changed')await scope.execute(command,()=>{});else await assert.rejects(scope.execute(command,()=>{}),mode==='stale'?/stale/:mode==='overrun'?/actual navigation/:/unchanged/);
  assert.deepEqual(wire,mode==='stale'?[]:mode==='overrun'?['down','up']:['down','up','capture']);checks++;
 }
 // Exact generated failure and send bodies: cancellation latches before any
 // subsequent Evaluate, release, screenshot, close, or event can send.
 const a=source.indexOf('let terminalError=null;'),b=source.indexOf('\nasync function event(v)',a);
 let kills=0;const wire=[],scope={margin:helper.guard(),Error,Date,Map,clearTimeout(){},clearInterval(){},setTimeout:()=>1,
  save(){},process:{ppid:123,kill:(pid,s)=>{assert.equal(pid,123);assert.equal(s,'SIGTERM');kills++;}},ws:{send:v=>wire.push(v)}};
 vm.createContext(scope);vm.runInContext(source.slice(a,b)+';globalThis.api={fail,send,evaluate};',scope);
 scope.api.fail(Error('first failure'));
 for(const m of ['Runtime.evaluate','Input.dispatchKeyEvent','Page.captureScreenshot','Browser.close'])await assert.rejects(scope.api.send(m),/first failure/);
 scope.api.fail(Error('later failure'));assert.equal(kills,1);assert.equal(wire.length,0);checks++;
 // Install a real current compiled instance through the exact production
 // Worker assignment, then execute the exact serialized TR2 observer caller.
 const bytes=fs.readFileSync('build/wine-assembly.wasm'),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const mod=new WebAssembly.Module(bytes),imports={host:{memory}};
 for(const i of WebAssembly.Module.imports(mod))if(i.kind==='function')imports.host[i.name]=()=>0;
 const worker={WebAssembly,selectedModule:mod,built:{imports},instance:null,memory,GuestRpc:require('../lib/guest-rpc'),workerSlot:0,endpointIdentity:7,performance:{now:()=>0},setTimeout:()=>1,clearTimeout(){}};
 vm.createContext(worker);const original=fs.readFileSync('lib/guest-worker.js','utf8');
 const installation=original.slice(original.indexOf('const result = await WebAssembly.instantiate(selectedModule, built.imports);'),original.indexOf('if (quake2LoadObservation) instance ='));
 assert(installation.includes('instance = result.exports ? result : (result.instance || result)'));await vm.runInContext('(async()=>{'+installation+'})()',worker);
 const e=worker.instance.exports,pe=require('../lib/pe').readPE('test/binaries/candidates/tomb-raider-2-demo/game/TOMB2.EXE');
 new Uint8Array(memory.buffer).set(pe.buf,e.get_staging());assert(e.load_pe(pe.buf.length));
 const installed=worker.instance;
 const r=vm.runInContext(observer.workerSource({expectedEndpoint:7,exeSha256:sha(pe.buf),defer:true,weapon:true,untilShot:true}),worker);assert.equal(r.status,'active');assert.notEqual(worker.instance,installed);
 vm.runInContext('globalThis.__tr2Action.arm();globalThis.__tr2Action.finish("offline-control")',worker);assert.equal(worker.instance,installed);checks++;
 // Current module replaces the historical CPU input in the existing exact
 // shot-call/damage/return suite. No native fixture/browser is run.
 let test=fs.readFileSync('tools/tr2-target-damage.test.cjs','utf8');
 test=test.replace("'scratch/runs/20261108-tr2-presenter-getter-native/modules/wine-assembly-d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc.wasm'","'build/wine-assembly.wasm'").replace("assert.equal(sha(bytes),'d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc');",'assert.equal(sha(bytes),'+JSON.stringify(sha(bytes))+');');
 const m=new Module(path.join(root,'tools/tr2-target-damage-current-control.cjs'));m.filename=path.join(root,'tools/tr2-target-damage-current-control.cjs');m.paths=module.paths;m._compile(test,m.filename);checks++;
 console.log(JSON.stringify({passed:true,checks,fullGeneratedCaller:true,actualInstalledWorker:true,cpuSha256:sha(bytes),nativeFixtureRepeated:false,browser:false}));
})().catch(e=>{console.error(e);process.exitCode=1;});
