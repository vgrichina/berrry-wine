'use strict';
// Offline controls execute the complete emitted command caller. No native game.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Module=require('node:module'),crypto=require('node:crypto'),cp=require('node:child_process');
const h=require('./simgolf-native-hole-driver.cjs'),root=path.resolve(__dirname,'..'),run=path.resolve(process.argv[2]);
const source=fs.readFileSync(run+'/browser.cjs','utf8');assert.equal(source,h.compose(root));
assert(!source.includes('localStorage.setItem'),'ordinary default configuration');
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
 const registrations=[];
 const worker={WebAssembly,selectedModule:mod,built:{imports},instance:null,endpointIdentity:7,workerSlot:0,crypto,
  cpuClock:null,memory,GuestRpc:require('../lib/guest-rpc.js'),writerView:null,writerCpu:null,writerRowIndex:null,
  send:v=>registrations.push(v),IS_WEB_WORKER:true};vm.createContext(worker);
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
 // A changing shell clock cannot freshen identical guest pixels. Full decode
 // also rejects corrupt, out-of-frame and uniform/unusable guest images.
 const {PNG}=require('pngjs'),image=new PNG({width:8,height:8});image.data.fill(255);
 image.data[(4*8+4)*4]=10;const rect={left:2,top:2,width:4,height:4};
 const beforePNG=PNG.sync.write(image),guest=h.guestPixels(beforePNG,rect);
 image.data[0]=0;const clockPNG=PNG.sync.write(image);assert.notEqual(h.sha(beforePNG),h.sha(clockPNG));assert.equal(h.guestPixels(clockPNG,rect).sha256,guest.sha256);
 image.data[(4*8+4)*4]=20;assert.notEqual(h.guestPixels(PNG.sync.write(image),rect).sha256,guest.sha256);
 assert.throws(()=>h.guestPixels(Buffer.from('broken PNG'),rect));assert.throws(()=>h.guestPixels(beforePNG,{...rect,width:20}));
 image.data.fill(0);assert.throws(()=>h.guestPixels(PNG.sync.write(image),rect),/unusable uniform/);checks++;
 let unchangedCancels=0;const unchanged=h.terminalGuard({cancel(){unchangedCancels++;},save(){}});
 const unchangedScope={assert,guard:unchanged,fail:e=>unchanged.fail(e),Date,deadline:Date.now()+10000,wait:async()=>{},latest:{sha256:h.sha(beforePNG),guestPixels:guest},capture:async()=>{unchangedScope.latest={sha256:h.sha(clockPNG),guestPixels:guest};}};
 vm.createContext(unchangedScope);vm.runInContext(source.slice(start,end)+';globalThis.execute=execute;',unchangedScope);
 await assert.rejects(unchangedScope.execute({action:'capture',label:'unchanged-clock',waitMs:0},()=>{}),/unchanged expected/);assert.equal(unchangedCancels,1);checks++;
 if(fs.existsSync(run+'/review/webgl/championship-course.png')){
  const retained=run+'/review/webgl/',a=fs.readFileSync(retained+'course-loading.png'),b=fs.readFileSync(retained+'championship-course.png'),rect=JSON.parse(fs.readFileSync(retained+'championship-course-state.json')).canvas.rect;
  assert.notEqual(h.sha(a),h.sha(b));assert.equal(h.guestPixels(a,rect).sha256,h.guestPixels(b,rect).sha256);
  unchangedScope.latest={sha256:h.sha(a),guestPixels:h.guestPixels(a,rect)};unchangedScope.capture=async()=>{unchangedScope.latest={sha256:h.sha(b),guestPixels:h.guestPixels(b,rect)};};
  const nativeGuard=h.terminalGuard({cancel(){unchangedCancels++;},save(){}});unchangedScope.guard=nativeGuard;unchangedScope.fail=e=>nativeGuard.fail(e);
  await assert.rejects(unchangedScope.execute({action:'capture',label:'retained-native-unchanged',waitMs:0},()=>{}),/unchanged expected/);assert.equal(unchangedCancels,2);checks++;
 }
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
  let effects=0;await assert.rejects(transport.consume(dir,1,async()=>effects++),/terminal notification/);assert.equal(effects,0);
  clientCases.push({kind,clientStickyClosed:true,consumerRejectsAbsentNextCommand:true});checks++;
 }
 const parentCases=[];
 for(const kind of ['wrong-id','stale-id','missing','delayed','refusal','malformed','success','delayed-read']){
  const dir=fs.mkdtempSync(run+'/parent-'+kind+'-');
  const child=cp.spawn(process.execPath,[__filename,run,'parent',dir,kind],{stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
  const cap=setTimeout(()=>child.kill('SIGKILL'),kind==='delayed-read'?30000:5000);
  const code=await new Promise(r=>child.once('close',r));clearTimeout(cap);
  assert.equal(code,0,stderr);const result=JSON.parse(stdout);assert.equal(result.signals,['success','delayed-read'].includes(kind)?0:1);assert(result.childWait&&result.stdoutEOF&&result.stderrEOF);parentCases.push(result);checks++;
 }
 const custodyCases=[];
 for(const kind of ['wrong-id','missing','delayed','success']){
  const dir=fs.mkdtempSync(run+'/custody-'+kind+'-');fs.mkdirSync(dir+'/commands');
  fs.writeFileSync(dir+'/lifecycle.json',JSON.stringify({browserDeadline:Date.now()+8000}));
  // The executed shim preserves the actual kernel-custodian parent across exec.
  const shim=dir+'/consumer-shim.cjs';fs.writeFileSync(shim,`process.env.SIMGOLF_OWNER_IDENTITY=JSON.stringify(require(${JSON.stringify(root+'/tools/native-clock-process-proof.cjs')}).identity(process.ppid));process.argv=${JSON.stringify([process.execPath,__filename,run,'consumer',dir,kind])};require(${JSON.stringify(__filename)});`);
  const gate="import os,sys;assert sys.stdin.readline()=='go\\n';os.execvp(sys.argv[1],sys.argv[1:])";
  const child=cp.spawn('python3',['-c',gate,'python3',root+'/tools/simgolf-native-hole-launch.py',dir,process.execPath,shim],{stdio:['pipe','pipe','pipe']});
  let stdout='',stderr='',stdoutEOF=false,stderrEOF=false;child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);child.stdout.on('end',()=>stdoutEOF=true);child.stderr.on('end',()=>stderrEOF=true);
  const done=new Promise(r=>child.once('close',r));
  // Independent of the consumer/custodian event loops; never relax the launch cap.
  const watchdog=cp.spawn(process.execPath,['-e',`console.log('armed');setTimeout(()=>{try{process.kill(${child.pid},'SIGTERM')}catch{}},9000);`],{stdio:['ignore','pipe','pipe']});
  let watchStdoutEOF=false,watchStderrEOF=false;watchdog.stdout.on('end',()=>watchStdoutEOF=true);watchdog.stderr.on('end',()=>watchStderrEOF=true);watchdog.stderr.resume();
  await new Promise(r=>watchdog.stdout.once('data',r));
  child.stdin.end('go\n');
  try{
   for(let n=0;n<1000&&!fs.existsSync(dir+'/consumer-ready');n++)await delay(2);
   assert(fs.existsSync(dir+'/consumer-ready'));
   if(kind==='success')await transport.request(dir,'current',{action:'capture'},1000);else await assert.rejects(transport.request(dir,'current',{action:'capture'},70));
   const code=await done;assert.equal(code,kind==='success'?0:1,stderr);assert(stdoutEOF&&stderrEOF);
   const drain=JSON.parse(fs.readFileSync(dir+'/kernel-drain.json'));assert(drain.complete);assert.deepEqual(drain.remaining,[]);assert.deepEqual(drain.unreaped,[]);assert(drain.commandLog.eof&&drain.commandLog.closed);
   for(const pin of [drain.journal,drain.commandLog]){const b=require('node:zlib').gunzipSync(fs.readFileSync(dir+'/'+pin.path));assert.equal(b.length,pin.originalBytes);assert.equal(h.sha(b),pin.originalSha256);}
   if(kind!=='success'){assert(fs.existsSync(dir+'/terminal-error.json'));assert(!fs.existsSync(dir+'/reply-1.json'));}
   custodyCases.push({kind,actualOwningParent:child.pid,parentWait:code,stdoutEOF,stderrEOF,complete:drain.complete,commandEOF:drain.commandLog.eof,owned:drain.owned.length,reaped:drain.reaped.length});checks++;
  }finally{
   watchdog.kill('SIGTERM');const watcherCode=await new Promise(r=>watchdog.once('close',(code,signal)=>r({code,signal})));
   assert(watchStdoutEOF&&watchStderrEOF);
   fs.writeFileSync(dir+'/outer-parent-waits.json',JSON.stringify({actualParentWait:child.exitCode,parentStdoutEOF:stdoutEOF,parentStderrEOF:stderrEOF,independentWatchdogWait:watcherCode,separateWatchdogStdoutEOF:watchStdoutEOF,separateWatchdogStderrEOF:watchStderrEOF}));
   if(child.exitCode===null&&child.signalCode===null)child.kill('SIGTERM');
  }
 }
 const report={passed:true,checks,originalFailureCleanupProtocol:oldWire.length,fullEmittedCaller:true,currentInstalledWorker:true,joinedCallerInstalledWorkerOrdinaryClick:true,workerSha256:h.sha(workerSource),moduleSha256:h.sha(bytes),independentRelease:true,zeroLaterProtocol:true,results,ACK:cases,requestClientRepair:clientCases,actualParentCases:parentCases,currentCustodyCases:custodyCases,nativeLaunches:0};
 fs.writeFileSync(run+'/focused-tests.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
async function parentControl(dir,kind){
 fs.mkdirSync(dir+'/commands');let signals=0;
 const handler=()=>{signals++;};process.on('SIGTERM',handler);
 const identity=require('./native-clock-process-proof.cjs').identity(process.pid);
 const child=cp.spawn(process.execPath,[__filename,run,'consumer',dir,kind],{env:{...process.env,SIMGOLF_OWNER_IDENTITY:JSON.stringify(identity)},stdio:['ignore','pipe','pipe']});
 let stdout='',stderr='',stdoutEOF=false,stderrEOF=false;
 child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
 child.stdout.on('end',()=>stdoutEOF=true);child.stderr.on('end',()=>stderrEOF=true);
 const done=new Promise(r=>child.once('close',r));
 for(let n=0;n<500&&!fs.existsSync(dir+'/consumer-ready');n++)await delay(2);
 assert(fs.existsSync(dir+'/consumer-ready'));
 const positive=['success','delayed-read'].includes(kind);
 const began=Date.now();
 const request=transport.request(dir,'current',{action:'capture'},kind==='delayed-read'?28000:positive?1000:70);
 if(positive)assert.equal((await request).id,'current');else await assert.rejects(request);
 const code=await done;assert.equal(code,0,stderr);assert(stdoutEOF&&stderrEOF);
 assert.equal(fs.readdirSync(dir+'/commands').length,1,'one publication; no replay');
 if(positive){assert(!fs.existsSync(dir+'/transport-closed.json'));assert.equal(JSON.parse(fs.readFileSync(dir+'/reply-0.json')).id,'current');}
 if(kind==='delayed-read')assert(Date.now()-began>=21000,'same read retained past ordinary observation window');
 const result=JSON.parse(stdout);assert.equal(result.owner,process.pid);assert.equal(result.laterProtocol,0);assert.equal(result.laterEffects,0);
 process.removeListener('SIGTERM',handler);
 console.log(JSON.stringify({kind,signals,childWait:true,stdoutEOF,stderrEOF,onePublication:true,elapsedMs:Date.now()-began,...result}));
}
async function consumerControl(dir,kind){
 let protocol=0;const initStart=source.indexOf("const simgolf=require("),initEnd=source.indexOf('\nasync function send(',initStart);
 const scope={assert,process,fs,Buffer,JSON,Error,setTimeout,clearTimeout,out:dir,t:transport,
  require:n=>n==='../../../tools/simgolf-native-hole-driver.cjs'?h:require(n),save:(name,value)=>fs.writeFileSync(dir+'/'+name,JSON.stringify(value))};
 vm.createContext(scope);vm.runInContext(source.slice(initStart,initEnd)+';globalThis.guard=guard;globalThis.stopWatch=()=>stopTerminalWatch();',scope);
 const sendStart=source.indexOf('async function send('),sendEnd=source.indexOf('\nasync function evaluate(',sendStart);
 vm.runInContext(source.slice(sendStart,sendEnd)+';globalThis.send=send;ws={send(){globalThis.protocol++;}};',scope);scope.protocol=0;
 fs.writeFileSync(dir+'/consumer-ready','ready');let consumed=false;
 try{
  while(!consumed){consumed=await transport.consume(dir,0,async()=>{
   if(kind==='delayed-read'){await delay(21000);return;}
   if(kind==='success')return;
   if(['wrong-id','stale-id','refusal','malformed'].includes(kind))fs.writeFileSync(dir+'/reply-0.json',kind==='malformed'?'broken':JSON.stringify({ok:true,id:kind==='refusal'?'current':kind,status:kind==='refusal'?'refused-before-dispatch':undefined}));
   // Pending and delayed commands must observe notification before returning an ACK.
   while(!scope.guard.error)await delay(2);
   if(kind==='delayed')await delay(20);
  });if(!consumed)await delay(2);}
 }catch(e){scope.guard.fail(e);}
 if(!['success','delayed-read'].includes(kind)){
  while(!scope.guard.error)await delay(2);
  for(const m of ['Runtime.evaluate','Input.dispatchMouseEvent','Page.captureScreenshot','Browser.close'])await assert.rejects(scope.send(m));
  let effects=0;await assert.rejects(transport.consume(dir,1,async()=>effects++));assert.equal(effects,0);
  assert(!fs.existsSync(dir+'/reply-0.json')||kind!=='missing'&&kind!=='delayed');
  scope.guard.fail(Error('later failure'));
 }
 scope.stopWatch();console.log(JSON.stringify({owner:process.ppid,laterProtocol:scope.protocol,laterEffects:0,terminalExitCode:process.exitCode??0}));process.exitCode=0;
}
(process.argv[3]==='parent'?parentControl(process.argv[4],process.argv[5]):process.argv[3]==='consumer'?consumerControl(process.argv[4],process.argv[5]):main()).catch(e=>{console.error(e);process.exitCode=1;});
