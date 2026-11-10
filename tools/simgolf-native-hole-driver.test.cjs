'use strict';
// Offline controls execute the complete emitted command caller. No native game.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Module=require('node:module'),crypto=require('node:crypto');
const h=require('./simgolf-native-hole-driver.cjs'),root=path.resolve(__dirname,'..'),run=path.resolve(process.argv[2]);
const source=fs.readFileSync(run+'/browser.cjs','utf8');assert.equal(source,h.compose(root));
function load(name){const m=new Module(run+'/'+name,module);m.filename=run+'/'+name;m.paths=Module._nodeModulePaths(run);m.require=n=>require(n.startsWith('../../../')?path.join(root,n.slice(9)):n.startsWith('./')?path.join(run,n):n);m._compile(fs.readFileSync(m.filename,'utf8'),m.filename);return m.exports;}
const bound=load('bound-input.cjs'),input=load('input.cjs'),transport=load('transport.cjs');
const delay=ms=>new Promise(r=>setTimeout(r,ms));let checks=0;
async function main(){
 // Reproduce the causal problem from the original complete close function.
 const old=fs.readFileSync(root+'/'+h.PRIOR+'/browser.cjs','utf8'),a=old.indexOf('async function close(reason)'),b=old.indexOf('\nasync function execute(',a),oldWire=[];
 const oldScope={closing:false,clearTimeout(){},timer:0,pending:new Map(),save(){},evaluate:async s=>{oldWire.push(s);return [];},sha:h.sha,fs,Buffer,out:run,ws:{readyState:1,close(){}},send:async m=>oldWire.push(m),browser:null,server:null,t:{closed(){}},console:{log(){}}};
 vm.createContext(oldScope);vm.runInContext(old.slice(a,b)+';globalThis.close=close;',oldScope);
 await oldScope.close('first terminal failure');assert.equal(oldWire.length,3);assert.equal(oldWire[2],'Browser.close');checks++;
 // Install the current compiled module using the current Worker's actual seam.
 const bytes=fs.readFileSync(root+'/build/wine-assembly.wasm'),mod=new WebAssembly.Module(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={host:{memory}};
 for(const i of WebAssembly.Module.imports(mod))if(i.kind==='function')imports.host[i.name]=()=>0;
 const worker={WebAssembly,selectedModule:mod,built:{imports},instance:null,endpointIdentity:7,workerSlot:0,crypto};vm.createContext(worker);
 const workerSource=fs.readFileSync(root+'/lib/guest-worker.js','utf8'),wa=workerSource.indexOf('const result = await WebAssembly.instantiate(selectedModule, built.imports);'),wb=workerSource.indexOf('if (quake2LoadObservation) instance =',wa);assert(wa>=0&&wb>wa);
 await vm.runInContext('(async()=>{'+workerSource.slice(wa,wb)+'})()',worker);assert(worker.instance instanceof WebAssembly.Instance);
 const wine={processId:1000,running:true,_stopped:false,renderer:{peekKeyDownState:()=>0},guestWorker:{link:{module:mod,worker:{},endpointIdentity:7,slot:0}}};
 const page={runningApps:[{name:'simgolf_demo',wine}],crossOriginIsolated:true,document:{getElementById:()=>canvas},crypto},canvas={};vm.createContext(page);
 const workers=new Map([['worker',{targetId:'worker',sessionId:'worker',url:'guest-worker.js',scripts:[{scriptId:'live',bytecodeAvailable:true,sha256:h.sha(bytes)}]}]]);
 let clock=1000;const wire=[];
 const chain=bound.createChain({app:'simgolf_demo',evaluate:async(s,id)=>vm.runInContext(s,id==='worker'?worker:page),send:async m=>{wire.push(m);return m==='Debugger.getScriptSource'?{bytecode:bytes.toString('base64')}:{data:Buffer.from('offline authored pixels').toString('base64')};},workers,pageSession:'page',expectedModules:[h.sha(bytes)],now:()=>clock});
 const shot=await chain.capture('offline');let effects=0;await chain.admit({...shot.capture,review:'OFFLINE authored image control'},()=>effects++);assert.equal(effects,1);checks++;
 clock+=bound.MAX_AGE_MS+1;await assert.rejects(chain.admit({...shot.capture,review:'OFFLINE stale control'},()=>effects++),/stale/);assert(chain.closed);const before=wire.length;await assert.rejects(chain.capture('forbidden'),/closed/);assert.equal(wire.length,before);checks++;
 // Complete emitted execute function, ordinary DOWN/UP, and post-failure gate.
 const start=source.indexOf('async function execute(c,markDispatch)'),end=source.indexOf('\n(async()=>{',start);assert(start>=0&&end>start);
 // Join the full caller to the actual serialized chain and installed Worker.
 const joinedWire=[];const joined=bound.createChain({app:'simgolf_demo',evaluate:async(s,id)=>vm.runInContext(s,id==='worker'?worker:page),send:async m=>m==='Debugger.getScriptSource'?{bytecode:bytes.toString('base64')}:{data:Buffer.from('offline pixels').toString('base64')},workers,pageSession:'page',expectedModules:[h.sha(bytes)]});
 const joinedShot=await joined.capture('joined-before');let joinedCancelled=0;
 const jg=h.terminalGuard({cancel(){joinedCancelled++;},save(){}});
 const joinedScope={assert,guard:jg,fail:e=>jg.fail(e),Date,deadline:Date.now()+10000,latest:joinedShot.capture,out:run,pageSession:'page',Buffer,
  fs:{readFileSync:()=>JSON.stringify({...joinedShot.capture,review:'OFFLINE joined caller control'})},sha:()=>joinedShot.capture.sha256,save(){},wait:async()=>{},require:n=>n==='./input.cjs'?input:require(n),pulse:input.pulse,
  evaluate:async()=>({left:0,top:0,width:800,height:600}),send:async(m,p)=>joinedWire.push(p.type),chain:joined,
  capture:async()=>{joinedWire.push('capture');joinedScope.latest={...joinedShot.capture,sha256:'b'.repeat(64)};}};
 vm.createContext(joinedScope);vm.runInContext(source.slice(start,end)+';globalThis.execute=execute;',joinedScope);
 await joinedScope.execute({action:'click',point:[.5,.5],holdMs:5,waitMs:0,id:'joined',label:'joined-after',reviewRef:'joined-before'},()=>{});
 assert.deepEqual(joinedWire,['mouseMoved','mousePressed','mouseReleased','capture']);assert.equal(joinedCancelled,0);checks++;
 const modes=['success','stale','identity','down-rejected','down-pending','up-rejected','up-pending','unchanged','capture-failed'];
 const results=[];
 for(const mode of modes){
  const events=[];let cancels=0;const g=h.terminalGuard({cancel(){cancels++;},save(){}});
  const latest={label:'before',sha256:'a'.repeat(64)};
  const scope={assert,guard:g,fail:e=>g.fail(e),Date,deadline:Date.now()+10000,latest,out:run,pageSession:'page',Buffer,
   fs:{existsSync:()=>false,readFileSync:()=>JSON.stringify({...latest,review:'OFFLINE authored control'})},sha:()=>latest.sha256,save(){},wait:async()=>{},
   require:n=>n==='./input.cjs'?input:require(n),pulse:o=>input.pulse({...o,ackMs:40}),evaluate:async()=>({left:0,top:0,width:800,height:600}),
   send:async(m,p)=>{g.check();events.push(p.type);if((mode==='down-rejected'&&p.type==='mousePressed')||(mode==='up-rejected'&&p.type==='mouseReleased'))throw g.fail(Error('injected rejected ACK'));if((mode==='down-pending'&&p.type==='mousePressed')||(mode==='up-pending'&&p.type==='mouseReleased'))await new Promise(()=>{});},
   chain:{admit:async(r,f)=>{if(mode==='stale'||mode==='identity')throw Error(mode+' refused');await f({});}},
   capture:async()=>{g.check();events.push('capture');if(mode==='capture-failed')throw Error('unusable image');scope.latest={...latest,sha256:mode==='unchanged'?latest.sha256:'b'.repeat(64)};}};
  vm.createContext(scope);vm.runInContext(source.slice(start,end)+';globalThis.execute=execute;',scope);
  const c={action:'click',point:[.5,.5],holdMs:5,waitMs:0,id:'control',label:'after',reviewRef:'before'};
  if(mode==='success')await scope.execute(c,()=>{});else await assert.rejects(scope.execute(c,()=>{}));
  assert.equal(cancels,mode==='success'?0:1);const count=events.length;
  if(mode!=='success'){await assert.rejects(scope.execute({...c,action:'capture'},()=>{}));assert.equal(events.length,count);g.fail(Error('second'));assert.equal(cancels,1);}
  assert.deepEqual(events,mode==='stale'||mode==='identity'?[]:mode==='down-rejected'?['mouseMoved','mousePressed']:mode.includes('down-')||mode.includes('up-')?['mouseMoved','mousePressed','mouseReleased']:['mouseMoved','mousePressed','mouseReleased','capture']);
  results.push({mode,events,cancels});checks++;
 }
 // The terminal send guard must reject before even the screenshot layout read.
 const ss=source.indexOf('async function send('),se=source.indexOf('\nasync function evaluate(',ss);let protocol=0;
 const failed=h.terminalGuard({cancel(){},save(){}});failed.fail(Error('first failure'));
 const sendScope={guard:failed,fail:e=>failed.fail(e),ws:{send(){protocol++;}},pending:new Map(),id:0,setTimeout,clearTimeout,JSON,Error};vm.createContext(sendScope);vm.runInContext(source.slice(ss,se)+';globalThis.send=send;',sendScope);
 for(const method of ['Page.captureScreenshot','Runtime.evaluate','Input.dispatchMouseEvent','Browser.close'])await assert.rejects(sendScope.send(method),/first failure/);assert.equal(protocol,0);checks++;
 const closeStart=source.indexOf('async function close(reason)'),closeEnd=source.indexOf('\nasync function execute(',closeStart);
 vm.runInContext(source.slice(closeStart,closeEnd)+';globalThis.close=close;',sendScope);await assert.rejects(sendScope.close('first terminal failure'),/first failure/);assert.equal(protocol,0);checks++;
 // Actual emitted event and state functions stop on asynchronous guest death.
 for(const mode of ['runtime-exception','guest-stopped']){
  let cancels=0,reads=0;const g=h.terminalGuard({cancel(){cancels++;},save(){}});
  const scope={guard:g,fail:e=>g.fail(e),Date,log(){},workers:new Map(),workerPromises:[],evaluate:async()=>{g.check();reads++;return {apps:[{stopped:true,running:false}]};}};vm.createContext(scope);
  const es=source.indexOf('async function event(v)'),ee=source.indexOf('\nasync function state()',es),st=ee+1,en=source.indexOf('\nasync function capture(',st);
  vm.runInContext(source.slice(es,ee)+';globalThis.event=event;'+source.slice(st,en)+';globalThis.state=state;',scope);
  if(mode==='runtime-exception')await scope.event({method:'Runtime.exceptionThrown',params:{exceptionDetails:{text:'offline exception'}},sessionId:'worker'});else await assert.rejects(scope.state(),/guest stopped/);
  assert.equal(cancels,1);const count=reads;await assert.rejects(scope.state());assert.equal(reads,count);checks++;
 }
 // Real independently armed release completes before a late DOWN acknowledgement.
 const order=[];const receipt=await input.pulse({deadline:Date.now()+1000,holdMs:10,ackMs:100,down:async()=>{order.push('down');await delay(40);order.push('down-ack');},up:async()=>order.push('up')});assert.deepEqual(order,['down','up','down-ack']);assert(receipt.up.at<receipt.down.at);checks++;
 // Exact numbered transport rejects wrong/stale ACK and stale refusal without replay.
 const cases=[];
 for(const kind of ['wrong-id','stale-id','refusal']){
  const dir=fs.mkdtempSync(run+'/ack-'+kind+'-');fs.mkdirSync(dir+'/commands');
  const command={id:'old',action:'click'};fs.writeFileSync(dir+'/commands/0.json',JSON.stringify(command));
  fs.writeFileSync(dir+'/reply-0.json',JSON.stringify(kind==='refusal'?{ok:true,id:'old',status:'refused-before-dispatch',effects:0,refreshRequired:true}:{ok:true,id:kind}));
  let called=0;fs.writeFileSync(dir+'/commands/1.json',JSON.stringify({id:'new',action:'capture'}));
  await assert.rejects(transport.consume(dir,1,async()=>called++));assert.equal(called,0);assert(fs.existsSync(dir+'/first-failure.json'));cases.push(kind);checks++;
 }
 const clientCases=[];
 for(const kind of ['wrong-current-id','missing-current-ack']){
  const dir=fs.mkdtempSync(run+'/client-'+kind+'-');fs.mkdirSync(dir+'/commands');
  const timer=kind==='wrong-current-id'?setInterval(()=>{if(fs.existsSync(dir+'/commands/0.json')){clearInterval(timer);fs.writeFileSync(dir+'/reply-0.json',JSON.stringify({ok:true,id:'stale'}));}},1):null;
  await assert.rejects(transport.request(dir,'current',{action:'capture'},40));clearInterval(timer);
  assert(fs.existsSync(dir+'/transport-closed.json'));assert(!fs.existsSync(dir+'/first-failure.json'));
  let effects=0;assert.equal(await transport.consume(dir,1,async()=>effects++),false);assert.equal(effects,0);
  clientCases.push({kind,clientStickyClosed:true,consumerStillIdle:true,ownerCancellationNotWired:true});checks++;
 }
 const report={passed:true,checks,originalFailureCleanupProtocol:oldWire.length,fullEmittedCaller:true,currentInstalledWorker:true,joinedCallerInstalledWorkerOrdinaryClick:true,workerSha256:h.sha(workerSource),moduleSha256:h.sha(bytes),independentRelease:true,zeroLaterProtocol:true,results,ACK:cases,requestClientBlocker:clientCases,nativeLaunches:0};
 fs.writeFileSync(run+'/focused-tests.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
