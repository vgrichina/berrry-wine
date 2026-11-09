'use strict';
// Offline deterministic scheduling of the actual composed driver, retained
// numbered client/consumer, and bound-input screenshot continuation. No socket,
// browser, process launch, guest, or changed production timeout.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const vm=require('node:vm'),Module=require('node:module'),cp=require('node:child_process');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),base=path.join(root,'scratch/runs/20261108-q3-gl-readiness-gameplay');
const out=process.env.Q3_ARENA_TEST_OUT;assert(out&&path.resolve(out).startsWith(root+'/scratch/runs/'));
fs.mkdirSync(out,{recursive:true});
const baseCommit='8b91cbbc0836843d541e66da29549eaf6b5b91ab';
const git=name=>cp.execFileSync('git',['show',baseCommit+':'+name],{cwd:root});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const foreignVersion=process.env.Q3_FOREIGN_CLOSURE_TEST_VERSION;
// Another worker owns Redline admission. Authenticate the unchanged Q3 fixture
// dependency from this test's recorded Git base; never accept its working drift
// as a Q3 migration or alter its file. No fixture/native result is claimed.
const redline=git('lib/redline-startup-admission.js');
assert.equal(hash(redline),'afcb3bae5807a0b08e8d49262af33c1c64ecfa601717173b630658198de185e2');
function compose(old){
 if(!old&&foreignVersion)return require('./q3-current-foreign-closure-v1.cjs').composition(foreignVersion).compose().source;
 const name=path.join(root,'tools/q3-native-driver-composition.cjs');
 const m=new Module(name,module);m.filename=name;m.paths=module.paths;
 m._compile(old?git('tools/q3-native-driver-composition.cjs').toString():fs.readFileSync(name,'utf8'),name);
 const read=fs.readFileSync;
 fs.readFileSync=function(file,...args){
  if(String(file)===path.join(root,'lib/redline-startup-admission.js'))return typeof args[0]==='string'?redline.toString(args[0]):redline;
  return read.call(this,file,...args);
 };
 try{return m.exports.compose().source;}finally{fs.readFileSync=read;}
}
const old=compose(true),fixed=compose(false);
const current=require('./q3-current-module.cjs');
assert.equal(current.migration['tools/q3-native-driver-composition.cjs'],hash(fs.readFileSync(path.join(root,'tools/q3-native-driver-composition.cjs'))),'versioned production selector authenticates the correction');
assert.equal(current.checkpointObserverVersion,'q3-checkpoint-b993419a5-v1');
// Exercise the real versioned selector with only the two concurrently owned
// foreign files read from Git, never by widening production acceptance.
{
 const read=fs.readFileSync,foreign=new Map((foreignVersion?[]:['lib/redline-startup-admission.js','lib/quake2-browser-load-observer.js']).map(n=>[path.join(root,n),git(n)]));
 const options={checkpointObserverVersion:current.checkpointObserverVersion,...foreignVersion?{foreignClosureVersion:foreignVersion}:{}};
 let corrupt=false;
 fs.readFileSync=function(file,...args){
  let b=foreign.get(String(file));
  if(corrupt&&String(file)===path.join(root,'tools/q3-native-driver-composition.cjs'))b=Buffer.concat([read.call(this,file),Buffer.from('\n')]);
  return b?(typeof args[0]==='string'?b.toString(args[0]):b):read.call(this,file,...args);
 };
 try{
  const pins=current.validate(options);
  assert.equal(pins.files.find(p=>p.path==='tools/q3-native-driver-composition.cjs').sha256,current.migration['tools/q3-native-driver-composition.cjs']);
  corrupt=true;assert.throws(()=>current.validate(options),/Q3 migration provider/);
  assert.throws(()=>current.validate({checkpointObserverVersion:'unknown'}),/explicit checkpoint observer version/);
  fs.writeFileSync(out+'/selector.json',JSON.stringify({passed:true,moduleVersion:pins.moduleVersion,compositionSHA256:current.migration['tools/q3-native-driver-composition.cjs'],foreignReads:[...foreign].map(([file,b])=>({path:path.relative(root,file),source:baseCommit,sha256:hash(b)})),corruptCompositionRefused:true,unknownVersionRefused:true}));
 }finally{fs.readFileSync=read;}
}
const transportSource=fs.readFileSync(base+'/transport.cjs','utf8');
const boundSource=fs.readFileSync(base+'/bound-input.cjs','utf8');
function slice(source,a,b){const i=source.indexOf(a),j=source.indexOf(b,i);assert(i>=0&&j>i,a);return source.slice(i,j);}
const flush=async()=>{for(let n=0;n<100;n++)await Promise.resolve();};
async function scenario(source,label,{replyAt=31000,afterReplyAt=replyAt,fireDeadline=true,error=false,untimed=false}={}){
 const dir=path.join(out,label);fs.mkdirSync(dir);fs.mkdirSync(dir+'/commands');
 const epoch=1794235934520-30000;let clock=epoch,serial=0,closed=0;
 const timers=new Map(),wire=[],records=[],snapshots=[];
 class Clock extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}}
 const set=(fn,ms)=>{const id=++serial;timers.set(id,{fn,due:clock+ms,ms});return id;};
 const clear=id=>timers.delete(id);
 const trace={span:async(_,fn)=>fn(),expression:()=>({kind:'inert.owner'}),snapshot:(...v)=>snapshots.push(v)};
 const ack={exports:{}},mouse={exports:{}};
 const scheduling={Date:Clock,setTimeout:set,clearTimeout:clear};
 vm.runInNewContext(fs.readFileSync(base+'/ack-client.cjs','utf8'),{module:ack,require,...scheduling});
 vm.runInNewContext(fs.readFileSync(base+'/native-mouse.cjs','utf8'),{module:mouse,require,...scheduling});
 const transport={exports:{}};
 vm.runInNewContext(transportSource,{module:transport,exports:transport.exports,require:n=>n==='./trace.cjs'?trace:n==='./ack-client.cjs'?ack.exports:n==='./native-mouse.cjs'?mouse.exports:require(n.startsWith('./')?base+'/'+n.slice(2):n),...scheduling,console});
 const t=transport.exports,runEnd=epoch+180000;
 fs.writeFileSync(dir+'/execution-window.json',JSON.stringify({browserStop:new Date(runEnd).toISOString()}));
 // The real client calculates the unchanged 10s settle + 20s work and 2s ACK.
 const command={id:'start-arena',action:'click',point:[.9,.86],holdMs:150,reviewRef:'reviewed',label:'arena',waitMs:10000};
 command.timing=t.budget(dir,command,1,clock);
 assert.equal(command.timing.workEnd,epoch+30000);assert.equal(command.timing.ackEnd,epoch+32000);
 assert.equal(command.timing.cleanupReserveMs,30000);assert.equal(command.timing.workMs,20000);
 const reviewBytes=Buffer.from('offline reviewed capture fixture'),latest={label:'reviewed',sha256:hash(reviewBytes)};
 fs.writeFileSync(dir+'/reviewed.png',reviewBytes);fs.writeFileSync(dir+'/reviewed-review.json',JSON.stringify({...latest,review:'inert offline command admission only'}));
 let clientStatus='not-requested';
 const client=untimed?Promise.resolve():t.request(dir,'start-arena',command,1).then(()=>{clientStatus='ok';},()=>{clientStatus='failed';});
 const pending=new Map(),diagnostic={request(){},submitted(){},receive(){},deadline(){},sendFailed(){}};
 const context=vm.createContext({require:n=>n==='./transport.cjs'?t:n==='./native-mouse.cjs'?mouse.exports:require(n),fs,path,root,out:dir,
  assert,Date:Clock,Buffer,structuredClone,AbortController,setTimeout:set,clearTimeout:clear,
  setInterval:()=>({unref(){}}),clearInterval(){},process:{env:{Q3_EXECUTION_BOUNDARY_OUT:dir+'/boundary.jsonl.gz'}},
  trace,pending,workers:new Map(),pageSession:'page',id:0,closing:false,latest,deadline:runEnd,
  save:(n,v)=>fs.writeFileSync(dir+'/'+n,JSON.stringify(v)),log:(n,v)=>records.push({n,v}),
  close:async()=>{closed++;},event:async()=>{},screenshotCompletion:diagnostic,
  sha:hash,ws:{send:text=>{const r=JSON.parse(text);wire.push(r);if(r.method==='Input.dispatchMouseEvent')queueMicrotask(()=>context.receive({data:JSON.stringify({id:r.id,sessionId:r.sessionId,result:{}})}));}}});
 const terminal=slice(source,'let terminalFailure=',"\nlet browser,server");
 // Keep the complete generated send prelude, including versioned observer
 // state/functions. Extracting only `function send` silently loses its lexical
 // dependencies when the authenticated composition gains instrumentation.
 const send=slice(source,source.includes('const startupDiagnostics=')?'const startupDiagnostics=':'function send(','\nasync function evaluate');
 const receive=slice(source,'ws.onmessage=','\n save(\'browser-version.json\'').slice(13);
 const capture=slice(source,'async function captureImpl(','\nlet closePromise;');
 const execute=slice(source,'async function executeImpl(','\n(async()=>{');
 const bindingCapture=slice(boundSource,'  async function capture(label)','  async function admit(');
 // Exact production capture continuation, with only owner replies made inert.
 // Its post-screenshot read goes through the composed send/checkTerminal path.
 vm.runInContext(terminal+'\n'+send+'\nglobalThis.receive='+receive+`
 async function wait(ms){return new Promise(r=>setTimeout(r,ms));}
 async function state(){await wait(${untimed?6640:6490});return {scope:'inert state scheduling'};}
 async function evaluate(){return {left:0,top:0,width:640,height:480};}
 const chain=(()=>{let closed=false,busy=false,binding=true,latest;
 const now=()=>Date.now();
 async function readLive(){await send('Runtime.evaluate',{expression:'inert owner'},pageSession);return {identity:{owner:1}};}
 const same=(a,b)=>assert.equal(a.owner,b.owner);
 ${bindingCapture}
 return {capture,admit:async(_,dispatch)=>dispatch({live:{identity:{owner:1}}})};})();
 ${capture}
 ${execute}
 const t=${slice(source,',t=','\n\nconst sha').slice(3)}
 globalThis.consume=(number=0)=>t.consume(out,number,execute);
 globalThis.runUntimed=()=>execute({action:'capture',label:'untimed',waitMs:0},()=>{});
 globalThis.input=()=>send('Input.dispatchMouseEvent',{type:'mousePressed'},pageSession);
 globalThis.failure=()=>terminalFailure;
 `,context);
 let status='pending',failure;
 const operation=(untimed?context.runUntimed():context.consume()).then(()=>{status='ok';},e=>{status='failed';failure=String(e);});
 async function advance(ms,fire=true){
  clock=epoch+ms;
  if(fire){let entry;while((entry=[...timers].filter(([,v])=>v.due<=clock).sort((a,b)=>a[1].due-b[1].due)[0])){timers.delete(entry[0]);entry[1].fn();await flush();}}
  await flush();
 }
 function respond(request,result){context.receive({data:JSON.stringify({id:request.id,sessionId:request.sessionId,...(error&&request.method==='Page.captureScreenshot'?{error:{code:-32000,message:'first screenshot failure'}}:{result})})});}
 await advance(0);if(!untimed)await advance(150);
 await advance(untimed?0:10150);await advance(untimed?6640:16640);
 const owner=wire.at(-1);assert(owner,`${label}: no owner request; status=${status}; failure=${failure}`);assert.equal(owner.method,'Runtime.evaluate');respond(owner,{result:{value:{}}});await flush();
 const shot=wire.at(-1);assert.equal(shot.method,'Page.captureScreenshot');assert.equal(shot.sessionId,'page');assert.deepEqual(shot.params,{format:'png'});
 assert([...timers.values()].some(v=>v.ms===20000),'unchanged actual CDP timeout');
 if(fireDeadline&&!untimed)await advance(30000);
 await advance(replyAt,false);respond(shot,{data:Buffer.from('offline-png').toString('base64')});await flush();
 // Baseline resumes the owner read during cleanup; the corrected driver has
 // already rejected pending work, or detects an overdue clock before sending.
 const after=wire.filter(r=>r.id>shot.id);
 await advance(afterReplyAt,false);
 for(const r of after)respond(r,{result:{value:{}}});await flush();await operation;
 await advance(afterReplyAt+10);await client;
 const firstFailure=fs.existsSync(dir+'/first-failure.json')?JSON.parse(fs.readFileSync(dir+'/first-failure.json')):null;
 if(!untimed&&context.failure()){
  await assert.rejects(context.consume(),/terminal UNKNOWN/);
  fs.writeFileSync(dir+'/commands/1.json',JSON.stringify({...command,id:'later-input',action:'click'}));
  await assert.rejects(context.consume(1),/terminal UNKNOWN/);
  assert.deepEqual(JSON.parse(fs.readFileSync(dir+'/first-failure.json')),firstFailure,'first failure survives subsequent command refusal');
 }
 const first=context.failure();
 if(first){await assert.rejects(context.input(),/terminal UNKNOWN/);assert.equal(context.failure(),first,'first terminal immutable');}
 if(source.includes('const startupDiagnostics=')){
  const diagnosticRows=records.filter(r=>r.n==='cdp-startup.jsonl').map(r=>r.v);
  for(const request of wire){
   const outbound=diagnosticRows.filter(r=>r.direction==='outbound'&&r.requestId===request.id);
   assert.equal(outbound.length,1,'one actual diagnostic outbound per command request');
   assert.equal(outbound[0].method,request.method);assert.equal(outbound[0].sessionId,request.sessionId??null);
   assert.equal(outbound[0].sha256,hash(Buffer.from(JSON.stringify(request))),'actual command envelope identity');
   const settled=diagnosticRows.filter(r=>r.direction==='settlement'&&r.requestId===request.id);
   assert.equal(settled.length,1,'actual generated promise settles once');
   assert.equal(settled[0].method,request.method);
  }
  fs.writeFileSync(dir+'/startup-diagnostics.json',JSON.stringify(diagnosticRows,null,2));
 }
 const result={status,clientStatus,failure:failure??null,terminal:first?String(first):null,closed,
  afterScreenshot:after.map(r=>r.method),requests:wire.map(r=>({method:r.method,id:r.id})),
  png:fs.existsSync(dir+'/'+(untimed?'untimed':'arena')+'.png'),ack:fs.existsSync(dir+'/reply-0.json'),
  firstFailure,
  timing:command.timing,pending:pending.size};
 fs.writeFileSync(dir+'/observed.json',JSON.stringify(result,null,2));
 if(!untimed)assert.deepEqual(wire.filter(r=>r.method==='Input.dispatchMouseEvent').map(r=>r.params.type),['mouseMoved','mousePressed','mouseReleased'],'actual native mouse dispatch exactly once, none after terminal');
 timers.clear();return result;
}
(async()=>{
 const baseline=await scenario(old,'baseline-late');
 assert.equal(baseline.status,'failed');assert.equal(baseline.terminal,null);
 assert.equal(baseline.png,true,'counterexample: losing screenshot continuation publishes after work timeout');
 assert.deepEqual(baseline.afterScreenshot,['Runtime.evaluate']);assert.equal(baseline.ack,false);
 const repaired=await scenario(fixed,'fixed-late');
 assert.equal(repaired.status,'failed');assert.match(repaired.terminal,/command work deadline/);
 assert.equal(repaired.png,false);assert.equal(repaired.ack,false);assert.equal(repaired.pending,0);
 assert.deepEqual(repaired.afterScreenshot,[]);assert.equal(repaired.closed,1);
 assert.equal(repaired.firstFailure.at,baseline.firstFailure.at);assert.equal(repaired.firstFailure.error,baseline.firstFailure.error);
 const overdue=await scenario(fixed,'fixed-overdue-response',{fireDeadline:false,replyAt:30001});
 assert.equal(overdue.status,'failed');assert.equal(overdue.png,false);assert.equal(overdue.ack,false);assert.deepEqual(overdue.afterScreenshot,[]);
 const lateOwner=await scenario(fixed,'fixed-overdue-owner',{fireDeadline:false,replyAt:29990,afterReplyAt:30001});
 assert.equal(lateOwner.status,'failed');assert.equal(lateOwner.png,false);assert.equal(lateOwner.ack,false);assert.match(lateOwner.terminal,/command work deadline/);
 const success=await scenario(fixed,'fixed-before-deadline',{fireDeadline:false,replyAt:29999});
 assert.equal(success.status,'ok');assert.equal(success.clientStatus,'ok');assert.equal(success.png,true);assert.equal(success.ack,true);assert.equal(success.terminal,null);
 const protocol=await scenario(fixed,'fixed-protocol-error',{fireDeadline:false,replyAt:17000,error:true});
 assert.equal(protocol.status,'failed');assert.match(protocol.terminal,/first screenshot failure/);assert.equal(protocol.png,false);assert.equal(protocol.ack,false);
 const fixture=await scenario(fixed,'fixed-untimed-fixture',{fireDeadline:false,replyAt:8000,untimed:true});
 assert.equal(fixture.status,'ok');assert.equal(fixture.png,true);assert.equal(fixture.terminal,null);
 fs.writeFileSync(out+'/summary.json',JSON.stringify({passed:true,baseCommit,cases:7,baselineCounterexample:true,
  redlineDependency:{source:'Git base (concurrently owned working file excluded)',sha256:hash(redline)},
  boundary:'actual composed execute/capture/send/receive + retained numbered transport and bound screenshot continuation',
  browserStarted:false,nativeQualified:false,rootCauseOf1585ScreenshotStall:'UNKNOWN'},null,2));
 console.log('PASS seven actual composed command/screenshot clock cases; baseline late continuation reproduced, fixed abort/no resend/no late input; no runtime');
})().catch(e=>{console.error(e);process.exitCode=1;});
