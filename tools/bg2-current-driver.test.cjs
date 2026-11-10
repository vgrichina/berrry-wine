'use strict';
// Offline authored controls: exact emitted caller, current installed Worker,
// real helper release scheduling, numbered ACKs, and terminal refusal.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),cp=require('node:child_process');
const helper=require('./bg2-current-driver.cjs');
const root=path.resolve(__dirname,'..'),run=path.resolve(process.argv[2]),source=helper.compose(root);
assert.equal(fs.readFileSync(path.join(run,'browser-run.cjs'),'utf8'),source);
const bound=require(path.join(run,'bound-input.cjs'));
// Fixtures may be nested below a native run to preserve its launched bytes.
// Compile the exact emitted CommonJS bytes, resolving repository dependencies
// at their production location without rewriting the fixture's source.
const Module=require('node:module'),transportModule=new Module(path.join(run,'transport.cjs'),module);
transportModule.filename=path.join(run,'transport.cjs');transportModule.paths=Module._nodeModulePaths(run);
transportModule.require=n=>require(n.startsWith('../../../tools/')?path.join(root,'tools',n.slice('../../../tools/'.length)):n.startsWith('./')?path.join(run,n):n);
transportModule._compile(fs.readFileSync(transportModule.filename,'utf8'),transportModule.filename);
const transport=transportModule.exports;
let checks=0;
async function main(){
 for(const text of ['a','','A1','ABCDEFGHIJKLM']){assert.throws(()=>helper.validate({action:'type',text,waitMs:0}),/uppercase/);checks++;}
 helper.validate({action:'type',text:'A',waitMs:0});
 // Actual current compiled module installed with the exact Worker assignment.
 const bytes=fs.readFileSync(path.join(root,'build/wine-assembly.wasm')),mod=new WebAssembly.Module(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={host:{memory}};
 for(const i of WebAssembly.Module.imports(mod))if(i.kind==='function')imports.host[i.name]=()=>0;
 const worker={WebAssembly,selectedModule:mod,built:{imports},instance:null,endpointIdentity:7,workerSlot:0,crypto};vm.createContext(worker);
 const workerSource=fs.readFileSync(path.join(root,'lib/guest-worker.js'),'utf8');
 const a=workerSource.indexOf('const result = await WebAssembly.instantiate(selectedModule, built.imports);'),b=workerSource.indexOf('if (quake2LoadObservation) instance =',a);
 assert(a>=0&&b>a);await vm.runInContext('(async()=>{'+workerSource.slice(a,b)+'})()',worker);
 assert(worker.instance instanceof WebAssembly.Instance);
 const canvas={},link={module:mod,worker:{},endpointIdentity:7,slot:0};
 const wine={processId:1000,running:true,_stopped:false,renderer:{peekKeyDownState:()=>0},guestWorker:{link}};
 const page={runningApps:[{name:'baldurs_gate2_demo',wine}],crossOriginIsolated:true,document:{getElementById:()=>canvas},crypto};vm.createContext(page);
 const workers=new Map([['worker',{targetId:'worker',sessionId:'worker',url:'guest-worker.js',scripts:[{scriptId:'live',bytecodeAvailable:true,sha256:helper.sha(bytes)}]}]]);
 let clock=1000,dispatches=0,protocol=[];
 const chain=bound.createChain({evaluate:async(s,id)=>vm.runInContext(s,id==='worker'?worker:page),send:async m=>{protocol.push(m);return m==='Debugger.getScriptSource'?{bytecode:bytes.toString('base64')}:{data:Buffer.from('offline authored pixels').toString('base64')};},workers,pageSession:'page',expectedModules:[helper.sha(bytes)],now:()=>clock});
 const shot=await chain.capture('offline');await chain.admit({...shot.capture,review:'OFFLINE authored control'},()=>dispatches++);assert.equal(dispatches,1);checks++;
 clock+=bound.MAX_AGE_MS+1;await assert.rejects(chain.admit({...shot.capture,review:'OFFLINE stale control'},()=>dispatches++),/stale/);assert(chain.closed);const count=protocol.length;await assert.rejects(chain.capture('forbidden'),/closed/);assert.equal(protocol.length,count);assert.equal(dispatches,1);checks++;
 // Identity replacement closes the actual serialized chain before dispatch.
 const second=bound.createChain({evaluate:async(s,id)=>vm.runInContext(s,id==='worker'?worker:page),send:async m=>m==='Debugger.getScriptSource'?{bytecode:bytes.toString('base64')}:{data:'AA=='},workers,pageSession:'page',now:()=>clock});
 const shot2=await second.capture('identity');worker.instance=await WebAssembly.instantiate(mod,imports);
 await assert.rejects(second.admit({...shot2.capture,review:'OFFLINE replaced instance'},()=>dispatches++),/identity changed/);assert(second.closed);assert.equal(dispatches,1);checks++;
 // Independent physical release completes while passive sampling is blocked.
 const wire=[];let resolveSample;const pendingSample=new Promise(r=>resolveSample=r);
 const held=bound.hold({send:async(m,p)=>wire.push(p.type),session:'page',keys:['Space'],holdMs:50,sample:()=>pendingSample});
 await new Promise(r=>setTimeout(r,90));assert.deepEqual(wire,['keyDown','keyUp']);resolveSample({});const receipt=await held;assert.equal(receipt.samples[0].whollyDuringHold,false);checks++;
 const mouse=require(path.join(run,'native-mouse.cjs')),mouseWire=[];
 await mouse.perform({send:async(m,p)=>{mouseWire.push(p.type);},session:'page',geometry:{left:0,top:0,width:640,height:480},command:{action:'click',point:[.5,.5],holdMs:100}});
 assert.deepEqual(mouseWire,['mouseMoved','mousePressed','mouseReleased']);checks++;
 const delayedMouse=[];await assert.rejects(mouse.perform({send:async(m,p)=>{delayedMouse.push(p.type);if(p.type==='mousePressed')await new Promise(r=>setTimeout(r,160));},session:'page',geometry:{left:0,top:0,width:640,height:480},command:{action:'click',point:[.5,.5],holdMs:100}}),/delivery exceeded hold bound/);
 assert.deepEqual(delayedMouse,['mouseMoved','mousePressed','mouseReleased']);checks++;
 const typeWire=[];const keyboard=require(path.join(run,'keyboard-bridge.cjs'));await assert.rejects(keyboard.type(async()=>typeWire.push(1),'page','a'),/uppercase/);assert.equal(typeWire.length,0);await keyboard.type(async(m,p)=>typeWire.push(p.type),'page','A');assert.deepEqual(typeWire,['keyDown','keyUp']);checks++;
 // Exact complete generated execute function, including ordinary helpers.
 const start=source.indexOf('async function execute(c,markDispatch)'),end=source.indexOf('\n(async()=>{',start);assert(start>=0&&end>start);
 for(const mode of ['changed','unchanged','refused','type-invalid']){
  const events=[],latest={label:'before',sha256:'a'.repeat(64)},scope={assert,bg2:helper,guard:{check(){}},Date,deadline:Date.now()+100000,latest,out:run,pageSession:'page',require:n=>n==='../../../tools/png-diff.js'?{diffPng:()=>({changed:1})}:require(path.join(run,n)),
   bound,fs:{readFileSync:()=>JSON.stringify({...latest,review:'OFFLINE authored control',canvas:{rect:{left:0,top:0,width:640,height:480}}})},sha:()=>latest.sha256,save(){},log(){},wait:async()=>{},send:async(m,p)=>events.push(p.type),
   chain:{admit:async(r,f)=>{if(mode==='refused')throw Error('stale scene refused');await f({live:{identity:{}}});},progress:async()=>({})},
   capture:async()=>{events.push('capture');scope.latest={...latest,sha256:mode==='unchanged'?latest.sha256:'b'.repeat(64)};}};
  vm.createContext(scope);vm.runInContext(source.slice(start,end)+';globalThis.execute=execute;',scope);
  const c={id:'control',label:'after',reviewRef:'before',action:mode==='type-invalid'?'type':'key',text:'a',key:'Space',holdMs:50,waitMs:0};
  if(mode==='changed')await scope.execute(c,()=>{});else await assert.rejects(scope.execute(c,()=>{}),mode==='unchanged'?/unchanged/:mode==='refused'?/stale/:/uppercase/);
  assert.deepEqual(events,['changed','unchanged'].includes(mode)?['keyDown','keyUp','capture']:[]);checks++;
 }
 // A pressed menu button can change pixels without leaving the menu. Execute
 // the complete emitted caller against actual PNG comparison, then its terminal
 // guard. Optional retained native captures exercise the same control offline.
 const png=require('pngjs').PNG,diff=require('./png-diff.js').diffPng;
 const authoredBefore=new png({width:640,height:480}),button=new png({width:640,height:480});
 button.data[(200*640+100)*4]=255;
 const world=new png({width:640,height:480});world.data[(200*640+400)*4]=255;
 for(const r of [[0,0,0,1],[-.1,0,1,1],[0,0,2,1],[0,0,1,NaN]])assert.throws(()=>helper.validate({action:'click',waitMs:0,transitionRegion:r}),/transition region/);checks++;
 const retained=process.argv[3]&&path.resolve(process.argv[3]),pairs=[{before:authoredBefore,after:button,rect:{left:0,top:0,width:640,height:480},region:[.5,0,.5,1]}];
 pairs.push({before:authoredBefore,after:world,rect:{left:0,top:0,width:640,height:480},region:[.5,0,.5,1],transition:true});
 if(retained){
  const read=n=>JSON.parse(fs.readFileSync(path.join(retained,n)));
  pairs.push({before:path.join(retained,'single-player.png'),after:path.join(retained,'new-game.png'),rect:read('new-game-state.json').canvas.rect,region:[.43,.05,.5,.85]});
 }
 for(const pair of pairs)for(const scoped of [false,true]){
  const events=[];let cancellations=0;
  const g=helper.terminalGuard({save(){},cancel(){cancellations++;}});
  const c={id:'region',label:'after',reviewRef:'before',action:'click',point:[.235,.414],holdMs:100,waitMs:0,...(scoped?{transitionRegion:pair.region}:{})};
  const scope={assert,bg2:helper,guard:g,Date,deadline:Date.now()+100000,latest:{label:'before',sha256:'a'},out:run,pageSession:'page',
   fs:{readFileSync:n=>JSON.stringify(n.endsWith('-state.json')?{canvas:{rect:pair.rect}}:{sha256:'a',review:'OFFLINE image control'})},sha:()=> 'a',
   save(){},log(){},wait:async()=>{},evaluate:async()=>pair.rect,send:async(m,p)=>{g.check();events.push(p.type);},
   chain:{admit:async(r,f)=>f({live:{identity:{}}})},
   require:n=>n==='../../../tools/png-diff.js'?{diffPng:(a,b,options)=>diff(pair.before,pair.after,options)}:require(path.join(run,n)),
   capture:async()=>{events.push('capture');scope.latest={label:'after',sha256:'b'};}};
  vm.createContext(scope);vm.runInContext(source.slice(start,end)+';globalThis.execute=execute;',scope);
  if(scoped&&!pair.transition){await assert.rejects(scope.execute(c,()=>{}).catch(e=>{g.fail(e);throw e;}),/unchanged expected transition region/);assert.equal(cancellations,1);await assert.rejects(scope.execute({...c,id:'later'},()=>{}),/unchanged expected transition region/);}
  else {await scope.execute(c,()=>{});assert.equal(cancellations,0);}
  assert.deepEqual(events,['mouseMoved','mousePressed','mouseReleased','capture']);checks++;
 }
 // Sticky cancellation gates the exact emitted send body, including releases.
 const sendStart=source.indexOf('function send('),sendEnd=source.indexOf('\nasync function event(',sendStart);let cancelled=0;const after=[];
 const g=helper.terminalGuard({save(){},cancel(){cancelled++;}}),scope={guard:g,fail:e=>g.fail(e),Map,Error,JSON,setTimeout,clearTimeout,ws:{send:s=>after.push(s)},pageSession:'page'};
 vm.createContext(scope);vm.runInContext('let id=0;const pending=new Map();'+source.slice(sendStart,sendEnd)+';globalThis.send=send;',scope);
 g.fail(Error('first failure'));for(const m of ['Runtime.evaluate','Input.dispatchKeyEvent','Input.dispatchMouseEvent','Page.captureScreenshot','Browser.close'])await assert.rejects(scope.send(m),/first failure/);g.fail(Error('second'));assert.equal(cancelled,1);assert.equal(after.length,0);checks++;
 let failedSaveCancel=0;const badSave=helper.terminalGuard({save(){throw Error('evidence write failed');},cancel(){failedSaveCancel++;}});
 assert.throws(()=>badSave.fail(Error('original failure')),/evidence write failed/);assert.equal(failedSaveCancel,1);assert.throws(()=>badSave.check(),/original failure/);checks++;
 // Actual numbered command publisher/consumer. Refusal writes failure, never
 // an OK/refusal that could license a new capture.
 const out=fs.mkdtempSync(path.join(run,'offline-transport-'));fs.mkdirSync(path.join(out,'commands'));
 const command={id:'one',label:'one',action:'capture',waitMs:0};
 const promise=transport.request(out,'one',command,1000);await new Promise(r=>setTimeout(r,20));await transport.consume(out,0,async()=>{});assert.equal((await promise).id,'one');checks++;
 await assert.rejects(transport.request(out,'lower',{id:'lower',action:'type',text:'a',waitMs:0},100),/uppercase/);assert(!fs.existsSync(path.join(out,'id-lower')));checks++;
 fs.writeFileSync(path.join(out,'commands/1.json'),JSON.stringify({...command,id:'refused'}));
 await assert.rejects(transport.consume(out,1,async()=>{const e=Error('stale');e.code='STALE_SCENE_BEFORE_DISPATCH';throw e;}),/stale/);
 assert(fs.existsSync(path.join(out,'first-failure.json')));assert(!fs.existsSync(path.join(out,'reply-1.json')));
 await assert.rejects(transport.request(out,'later',{...command,id:'later'},100),/sticky/);assert(!fs.existsSync(path.join(out,'commands/2.json')));checks++;
 const wrong=fs.mkdtempSync(path.join(run,'offline-wrong-ack-'));fs.mkdirSync(path.join(wrong,'commands'));
 const wrongPromise=assert.rejects(transport.request(wrong,'exact',command,1000),/exact ACK ID/);await new Promise(r=>setTimeout(r,20));transport.publish(path.join(wrong,'reply-0.json'),{ok:true,id:'wrong'});await wrongPromise;
 assert(fs.existsSync(path.join(wrong,'transport-closed.json')));await assert.rejects(transport.request(wrong,'later',{...command,id:'later'},1000),/sticky/);assert(!fs.existsSync(path.join(wrong,'commands/1.json')));checks++;
 // Reproduce the observed launcher FileNotFoundError with the exact emitted
 // Python entrypoint. Test its repaired publication closure without a box,
 // browser, subprocess game launch, or native guest execution.
 const fixture=fs.mkdtempSync(path.join(run,'offline-lease-')),owned=path.join(fixture,'scratch/runs/control');fs.mkdirSync(owned,{recursive:true});
 const put=(n,v)=>fs.writeFileSync(path.join(owned,n),JSON.stringify(v));
 const deadline={uuid:'offline-uuid',deadlineEpoch:2000000000},allocation={uuid:deadline.uuid,boxId:'bx_offline'};
 put('deadline.json',deadline);put('allocation.json',allocation);put('boat-created.json',{idempotencyKey:deadline.uuid,shutdownDelegated:true,box:{id:allocation.boxId}});
 put('watchdog-ready.json',{sha256:helper.sha(fs.readFileSync(path.join(owned,'deadline.json')))});
 const launcher=fs.readFileSync(path.join(run,'launch.py'));fs.writeFileSync(path.join(owned,'launch.py'),launcher);
 const launcherPin={path:path.relative(root,path.join(owned,'launch.py')),size:launcher.length,sha256:helper.sha(launcher)};
 put('runtime-pins.json',{files:[launcherPin],httpPins:[]});
 assert.throws(()=>helper.sealLease(root,owned),/ENOENT/);checks++;
 const probe=String.raw`import sys,types,runpy,json,os
m=types.ModuleType('native_kernel_custody');calls=[]
m.identity=lambda pid:dict(pid=pid,offline=True)
m.supervise=lambda *a,**k:calls.append(dict(command=a[1],deadline=k['deadline'],cleanup_deadline=k['cleanup_deadline']))
sys.modules['native_kernel_custody']=m
f=types.ModuleType('fcntl');f.LOCK_EX=1;f.LOCK_NB=2;f.LOCK_UN=4;f.flock=lambda *a:None;sys.modules['fcntl']=f
script=sys.argv[1];sys.argv=[script]
try:
 runpy.run_path(script,run_name='__main__')
except FileNotFoundError as e:
 assert e.filename.endswith('/lifecycle.json');assert not calls
 print(json.dumps(dict(missingLifecycle=True,dispatches=0)));raise SystemExit(0)
assert len(calls)==1
print(json.dumps(dict(passed=True,calls=calls,browserStarted=False)))`;
 const before=JSON.parse(cp.execFileSync('python3',['-c',probe,path.join(owned,'launch.py')],{encoding:'utf8'}));assert(before.missingLifecycle&&before.dispatches===0);checks++;
 const life={box:allocation.boxId,shutdownDelegated:true,browserDeadline:Math.trunc((deadline.deadlineEpoch-120)*1000)};put('lifecycle.json',life);
 const lease=helper.sealLease(root,owned),pins=JSON.parse(fs.readFileSync(path.join(owned,'runtime-pins.json')));
 assert.equal(pins.files.length,2);assert.deepEqual(pins.files.find(p=>p.path.endsWith('lifecycle.json')),lease);
 // The same pin-driven staging/publication selects the missing JSON now.
 const published=path.join(fixture,'published');
 for(const p of pins.files){const b=fs.readFileSync(path.join(root,p.path));assert.equal(helper.sha(b),p.sha256);const target=path.join(published,p.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,b);}
 // The unchanged kernel helper was already part of the production pin set.
 // Supply this single required dependency to the tiny offline staging control.
 const publishedLaunch=path.join(published,launcherPin.path),kernelPath=path.resolve(path.dirname(publishedLaunch),'../../..','tools/native_kernel_custody.py');
 fs.mkdirSync(path.dirname(kernelPath),{recursive:true});fs.writeFileSync(kernelPath,fs.readFileSync(path.join(root,'tools/native_kernel_custody.py')));
 const afterLease=JSON.parse(cp.execFileSync('python3',['-c',probe,publishedLaunch],{encoding:'utf8'}));
 assert(afterLease.passed&&!afterLease.browserStarted);assert.equal(afterLease.calls[0].deadline,life.browserDeadline/1000);assert.equal(afterLease.calls[0].cleanup_deadline,life.browserDeadline/1000+30);checks++;
 assert.throws(()=>helper.sealLease(root,owned),/already sealed/);checks++;
 put('lifecycle.json',{...life,browserDeadline:life.browserDeadline+1});assert.throws(()=>helper.leaseInput(root,owned),/original browser deadline/);checks++;
 put('lifecycle.json',{...life,box:'bx_wrong'});assert.throws(()=>helper.leaseInput(root,owned),/launcher box/);checks++;
 put('lifecycle.json',life);put('deadline.json',{...deadline,deadlineEpoch:deadline.deadlineEpoch+1});assert.throws(()=>helper.leaseInput(root,owned),/original browser deadline/);checks++;
 put('staging-window.json',{});assert.throws(()=>helper.sealLease(root,owned),/precede staging/);checks++;
 for(const temporary of [fixture,out,wrong])fs.rmSync(temporary,{recursive:true,force:true});
 console.log(JSON.stringify({passed:true,checks,fullGeneratedCaller:true,actualInstalledWorker:true,cpuSha256:helper.sha(bytes),workerSha256:helper.sha(workerSource),independentRelease:true,stickyRefusal:true,transitionRegion:true,retainedNativeImageControl:!!retained,leaseFailureReproduced:before,leaseRepairVerified:afterLease,originalLaunches:0,browser:false}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
