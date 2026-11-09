'use strict';
const assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {createRendererIdentity,attributeTerminal}=require('./renderer-identity');
const {createLifecycle}=require('./lifecycle');
const copy=v=>JSON.parse(JSON.stringify(v));
function fixture(options={}){
 const frame={id:'FRAME-A',loaderId:'LOADER-A',url:'http://fixture/normal',securityOrigin:'http://fixture',mimeType:'text/html'};
 const info={targetId:'TARGET-A',type:'page',url:frame.url,attached:true};
 const row={frame:frame.id,url:frame.url,processId:202,isOutermostMainFrame:true};
 const events=[{name:'TracingStartedInBrowser',ts:100,args:{data:{frames:[row]}}}];
 const records=[],calls=[],identities=new Map([101,202].map(pid=>[pid,{pid,startTicks:String(pid+999),bootId:'BOOT',namespaces:{pid:'pid:[1]'},exe:'/opt/google/chrome/chrome',argv:pid===202?['--type=renderer']:['--type=browser']}]));
 const b=new EventEmitter(),p=new EventEmitter();p.id=()=> 'SESSION-A';let reads=0;
 const context={frame,info,row,events,records,calls,identities,b,p};options.setup?.(context);
 b.send=async(method)=>{calls.push(method);if(method==='Target.getTargets')return{targetInfos:options.targets||[info]};if(method==='SystemInfo.getProcessInfo')return{processInfo:options.processes||[{id:101,type:'browser'},{id:202,type:'renderer'}]};return{}};
 p.send=async(method)=>{calls.push(method);
  if(method==='Target.getTargetInfo')return{targetInfo:copy(info)};
  if(method==='Page.getFrameTree'){if(++reads===2)options.afterFrame?.(context);return{frameTree:{frame:copy(frame)}};}
  if(method==='Tracing.start'){options.onStart?.(context);if(options.hangStart)return new Promise(()=>{});}
  if(method==='Tracing.end'&&!options.noCompletion)queueMicrotask(()=>p.emit('Tracing.tracingComplete',{stream:'TRACE',dataLossOccurred:!!options.loss}));
  if(method==='IO.read')return{data:JSON.stringify({traceEvents:events}),eof:true};return{};
 };
 const guard=createRendererIdentity({browserSession:b,pageSession:p,chromePid:101,deadline:Date.now()+3000,collectionMs:options.timeout||500,
  maxTraceBytes:options.byteCap||4096,readIdentity:pid=>copy(identities.get(pid)),retain:r=>records.push(copy(r))});
 return {...context,guard};
}
(async()=>{
 let passed=0;
 async function test(name,fn){await fn();passed++;console.log('PASS '+name)}
 await test('real helper qualification, page-scoped trace, lifecycle optional/guarded cleanup',async()=>{
  const f=fixture();let clean=0;const life=createLifecycle(async()=>++clean);await life.acquire(async()=>({}));
  const proof=await f.guard.qualify();life.watch(()=>f.guard.check());life.check();assert.equal(proof.renderer.pid,202);
  proof.renderer.pid=999;assert.equal(f.guard.check().renderer.pid,202);assert(f.calls.includes('IO.close'));
  f.p.emit('Page.frameNavigated',{frame:{...f.frame,loaderId:'REPLACED'}});assert.throws(()=>life.check(),/UNKNOWN/);
  const first=f.guard.snapshot().unknown;f.p.emit('Inspector.targetCrashed',{});assert.equal(f.guard.snapshot().unknown,first);
  await assert.rejects(()=>f.guard.qualify(),/UNKNOWN/);assert.equal(f.guard.snapshot().terminalProof,null);
  assert.equal(await life.finish('stop'),1);assert.equal(await life.finish('again'),1);f.guard.dispose();assert.equal(f.p.listenerCount('Page.frameNavigated'),0);
 });
 for(const [name,opts] of [
  ['missing metadata',{setup:f=>f.events.length=0}],
  ['wrong frame',{setup:f=>f.row.frame='OTHER'}],
  ['duplicate frame mapping',{setup:f=>f.events[0].args.data.frames.push({...f.row})}],
  ['missing process start',{setup:f=>delete f.identities.get(202).startTicks}],
  ['missing boot identity',{setup:f=>{delete f.identities.get(101).bootId;delete f.identities.get(202).bootId}}],
  ['missing PID',{setup:f=>delete f.row.processId}],
  ['string PID',{setup:f=>f.row.processId='202'}],
  ['stale URL',{setup:f=>f.row.url='http://old/'}],
  ['subframe mapping',{setup:f=>f.row.parent='PARENT'}],
  ['ambiguous target',{targets:[{targetId:'TARGET-A',type:'page'},{targetId:'TARGET-A',type:'page'}]}],
  ['target absent',{targets:[]}],
  ['renderer absent',{processes:[]}],
  ['nonrenderer OS process',{setup:f=>f.identities.get(202).argv=['--type=gpu-process']}],
  ['PID reused within collection',{onStart:f=>f.identities.get(202).startTicks='REUSED'}],
  ['boot mismatch',{setup:f=>f.identities.get(202).bootId='OTHER'}],
  ['namespace mismatch',{setup:f=>f.identities.get(202).namespaces.pid='other'}],
  ['loader replaced within collection',{afterFrame:f=>f.frame.loaderId='NEW'}],
  ['trace frame committed',{setup:f=>f.events.push({name:'FrameCommittedInBrowser',args:{data:{frame:f.frame.id}}})}],
  ['trace loss',{loss:true}],
  ['non-primary main frame',{setup:f=>f.row.isInPrimaryMainFrame=false}],
  ['wrong CDP browser PID',{processes:[{id:999,type:'browser'},{id:202,type:'renderer'}]}],
  ['bounded trace bytes',{byteCap:1}],
  ['detach during trace',{onStart:f=>f.p.emit('Inspector.detached',{reason:'replaced'})}],
  ['completion timeout',{noCompletion:true,timeout:15}],
  ['start timeout',{hangStart:true,timeout:15}]
 ])await test(name,async()=>{const f=fixture(opts);try{await assert.rejects(()=>f.guard.qualify(),/UNKNOWN/);assert(!f.guard.snapshot().proof);assert.throws(()=>f.guard.check(),/UNKNOWN/)}finally{f.guard.dispose()}});
 for(const name of ['Page.frameDetached','Page.frameStartedLoading','Page.navigatedWithinDocument','Target.targetDestroyed','Target.detachedFromTarget','CDPSession.Disconnected'])await test('armed invalidation '+name,async()=>{
  const f=fixture();try{await f.guard.qualify();const session=name.startsWith('Target')?f.b:f.p;
   session.emit(name,{frameId:f.frame.id,targetId:f.info.targetId,sessionId:'SESSION-A'});assert.throws(()=>f.guard.check(),/UNKNOWN/);
  }finally{f.guard.dispose()}
 });
 await test('same-ID target creation after qualification is not a continuation',async()=>{const f=fixture();try{await f.guard.qualify();f.b.emit('Target.targetCreated',{targetInfo:{...f.info}});assert.throws(()=>f.guard.check(),/recreated/);f.p.emit('Inspector.targetCrashed',{});assert.equal(f.guard.snapshot().terminalProof,null)}finally{f.guard.dispose()}});
 await test('armed PID reuse is sticky, unrelated target/subframe are harmless',async()=>{const f=fixture();try{await f.guard.qualify();
  f.b.emit('Target.targetCrashed',{targetId:'OTHER'});f.p.emit('Page.frameDetached',{frameId:'CHILD'});f.guard.check();
  f.identities.get(202).startTicks='REUSED';assert.throws(()=>f.guard.check(),/UNKNOWN/);f.identities.get(202).startTicks='1201';assert.throws(()=>f.guard.check(),/UNKNOWN/);
 }finally{f.guard.dispose()}});
 await test('actual guard crash capture + independent terminal join and negative diagnostics',async()=>{const f=fixture();try{
  const p=await f.guard.qualify();f.p.emit('Inspector.targetCrashed',{});f.b.emit('Target.targetCrashed',{targetId:p.targetId,status:'crashed',errorCode:134});
  const snapshot=f.guard.snapshot(),d={source:'kernel-waitpid',pid:202,startTicks:p.renderer.startTicks,bootId:p.renderer.bootId,observerPid:303,beforeWaitAt:Date.now(),waitAt:Date.now(),status:6};
  assert.equal(attributeTerminal(snapshot,d).termination.signal,6);
  for(const change of [{pid:999},{startTicks:'REUSED'},{bootId:'other'},{source:'process-absent'},{status:4991},{beforeWaitAt:0},{observerPid:101},{observerPid:undefined},{observerPid:0}])assert.throws(()=>attributeTerminal(snapshot,{...d,...change}));
  assert.throws(()=>attributeTerminal({...snapshot,terminalProof:null},d));assert.throws(()=>attributeTerminal({...snapshot,crashEvents:[]},d));
 }finally{f.guard.dispose()}});
 await test('late successful trace start after timeout is ended without rearming',async()=>{
  const f=fixture({timeout:15});let resolveStart;const original=f.p.send;
  f.p.send=(method,params)=>method==='Tracing.start'?new Promise(r=>resolveStart=r):original(method,params);
  try{await assert.rejects(()=>f.guard.qualify(),/timeout/);resolveStart({});await new Promise(r=>setImmediate(r));assert(f.calls.includes('Tracing.end'));assert(!f.guard.snapshot().proof);assert.throws(()=>f.guard.check(),/UNKNOWN/)}finally{f.guard.dispose()}
 });
 await test('durable evidence failure refuses qualification',async()=>{
  const f=fixture();const g=createRendererIdentity({browserSession:f.b,pageSession:f.p,chromePid:101,deadline:Date.now()+2000,
   readIdentity:pid=>copy(f.identities.get(pid)),retain:()=>{throw Error('durable sink refused')}});
  try{await assert.rejects(()=>g.qualify(),/durable sink refused/);assert(!g.snapshot().proof);assert.throws(()=>g.check(),/UNKNOWN/)}finally{g.dispose();f.guard.dispose()}
 });
 await test('ordinary lifecycle has no identity requirement',async()=>{const life=createLifecycle(async({owned})=>owned);const v={normal:true};assert.equal(await life.acquire(()=>v),v);life.check();assert.equal(await life.finish('ordinary'),v)});
 console.log(passed+' helper/integration controls PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
