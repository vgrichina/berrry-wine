'use strict';
// Run-specific composition of the retained 1235 caller. No new CDP client,
// DOM listener, input timer, sampler, or request settlement policy.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const crypto=require('node:crypto'),{performance}=require('node:perf_hooks');
const generatedPath='scratch/runs/20261109-redline-distinct-label-training-1235/prepare-caller.cjs';
const generatedSHA='326b2a6fa946c3a5c4a3650285278f742c4ae44e5e1e5190fcedbf633ff8edbc';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const providers=['tools/redline-native-trace.cjs','tools/q3-input-wire-observation.cjs',generatedPath];
function generated(){const source=require(path.resolve(__dirname,'..',generatedPath));assert.equal(hash(source),generatedSHA,'exact actual1235 generated caller');return source;}
function replace(source,before,after){assert.equal(source.split(before).length,2,'one composition site: '+before);return source.replace(before,after);}
function create({write,now=()=>performance.now(),capacity=64,eventCap=512,rawCap=512,byteCap=8192,schedule=setImmediate}){
  assert(Number.isInteger(rawCap)&&rawCap>0&&rawCap<=1024);assert(Number.isInteger(byteCap)&&byteCap>0&&byteCap<=16384);
  let raw=[],total=0,dropped=0,queued=false;const anchor={nodeMonotonicMs:now(),unixMs:Date.now(),timeOriginUnixMs:performance.timeOrigin,nodeHrtimeNs:process.hrtime.bigint().toString()};
  const wire=require('./q3-input-wire-observation.cjs').create({now,capacity,eventCap,schedule:()=>{},
    write:value=>{const batch=raw;raw=[];write({...value,clockAnchor:anchor,raw:batch,rawDropped:dropped,
      clockMapping:'Node performance.now; Chrome trace ts uses its own clock; cross-process offset UNKNOWN unless clock sync retained'});}});
  const defer=()=>{if(!queued){queued=true;schedule(()=>{queued=false;wire.flush();});}};
  function retain(direction,frame,meta,at=now()){try{
    if(total++>=rawCap){dropped++;return;}
    const text=typeof frame==='string'?frame:String(frame),bytes=Buffer.from(text);
    raw.push({direction,nodeMonotonicMs:at,...meta,bytes:bytes.length,truncated:bytes.length>byteCap,
      frame:bytes.subarray(0,byteCap).toString('utf8')});defer();
  }catch{dropped++;}}
  return {...wire,
    send(meta,frame,invoke){retain('send',frame,{requestId:meta.requestId,sessionId:meta.sessionId??null,method:meta.method});return wire.send(meta,invoke);},
    receive(frame,value,pending,receivedAt){retain('receive',frame,{requestId:value.id??null,sessionId:value.sessionId??null,
      pendingPresent:!!pending,expectedSessionId:pending?.sessionId??null,
      sessionMatches:pending?((value.sessionId??null)===(pending.sessionId??null)):null},receivedAt);wire.receive(value,pending);},
    terminal(reason){wire.terminal(reason);defer();},
    status(){return {...wire.status(),rawDropped:dropped};}
  };
}
function launch({spawn,executable,argv,options,out,save,now=()=>performance.now()}){
  const file=path.join(out,'native-startup-trace.json');assert(path.isAbsolute(out));assert(!fs.existsSync(file),'fresh trace path');
  assert(!argv.some(a=>a.startsWith('--trace-')),'one startup trace provider');
  const flags=['--trace-startup=input,latencyInfo,devtools.timeline,toplevel,disabled-by-default-devtools.timeline',
    '--trace-startup-duration=10','--trace-startup-format=json','--trace-startup-file='+file];
  const actual=[...flags,...argv],started=now();
  save('native-trace-launch.json',{executable,argv:actual,traceFile:file,startupDurationSeconds:10,
    nodeMonotonicMs:started,unixMs:Date.now(),timeOriginUnixMs:performance.timeOrigin,nodeHrtimeNs:process.hrtime.bigint().toString(),spawnReturned:false});
  const child=spawn(executable,actual,options);
  save('native-trace-spawn.json',{executable,argv:actual,pid:child.pid,nodeMonotonicMs:now(),spawnCallElapsedMs:now()-started});
  return child;
}
// Filesystem only, after existing actual browser wait + separate stream EOF.
// Never send Tracing.end, read guest state, or extend a failed command.
function retrieve(out,receipt,{maxBytes=64*1024*1024}={}){
  const file=path.join(out,'native-startup-trace.json');
  try{
    assert(receipt.actualBrowserExit&&receipt.streamEOF,'joined no-input cleanup required');
    const stat=fs.lstatSync(file);assert(stat.isFile()&&!stat.isSymbolicLink());assert(stat.size>0&&stat.size<=maxBytes,'bounded flushed trace required');
    const bytes=fs.readFileSync(file),value=JSON.parse(bytes.toString()),events=value.traceEvents;
    assert(Array.isArray(events),'Chrome JSON traceEvents required');
    const dispatch=events.filter(e=>e.name==='EventDispatch'&&['keydown','keyup'].includes(e.args?.data?.type)).map(e=>({pid:e.pid,tid:e.tid,ts:e.ts,dur:e.dur,ph:e.ph,type:e.args.data.type,args:e.args}));
    const clockSync=events.filter(e=>e.ph==='c'||/clock.?sync/i.test(e.name??''));
    return {file,bytes:bytes.length,sha256:hash(bytes),flushedJSON:true,events:events.length,dispatch,clockSync,
      traceClock:'raw Chrome trace microseconds; Node mapping UNKNOWN without clock sync',
      validationScope:'Keyboard dispatch pairs only, including startup preflight; comma event attribution UNKNOWN until raw latency flow/clock/target correlation',
      metadata:value.metadata??null,
      validKeyboardBoundary:dispatch.some(d=>d.type==='keydown'&&d.ph==='X'&&Number.isFinite(d.ts)&&Number.isFinite(d.dur)&&d.dur>=0&&dispatch.some(u=>u.type==='keyup'&&u.ph==='X'&&u.pid===d.pid&&u.tid===d.tid&&Number.isFinite(u.ts)&&u.ts>=d.ts&&Number.isFinite(u.dur)&&u.dur>=0)),
      inputLatencyEvents:events.filter(e=>/input|latency/i.test(e.cat??'')).length,
      taskEvents:events.filter(e=>/RunTask|ThreadController|ThreadPool_RunTask/.test(e.name??'')).length,
      cause:'UNKNOWN: correlate target pid/tid, input latency flow and retained delivery receipt before attribution'};
  }catch(error){return {file,flushedJSON:false,validKeyboardBoundary:false,error:String(error),cause:'UNKNOWN'};}
}
function integrate(source=generated()){
  source=replace(source,'for(const p of pins.files){',`for(const name of ${JSON.stringify(providers)})assert.equal(pins.files.filter(p=>p.path===name).length,1,'trace provider must be pinned: '+name);for(const p of pins.files){`);
  source=replace(source,'const pending=new Map(),workers=new Map(),workerPromises=[];',"const pending=new Map(),workers=new Map(),workerPromises=[];const nativeTrace=require('./redline-native-trace.cjs');const inputWire=nativeTrace.create({write:value=>log('native-input-wire.jsonl',value)});if(process.once)process.once('exit',()=>inputWire.flush());");
  source=replace(source,'pending.set(n,{resolve,reject,timer});','pending.set(n,{resolve,reject,timer,sessionId,method});');
  source=replace(source,'ws.send(JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})}));',"const frame=JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})});inputWire.send({requestId:n,method,sessionId},frame,()=>ws.send(frame));");
  source=replace(source,'const v=JSON.parse(msg.data);if(v.id){const p=pending.get(v.id);','const receivedAt=nativeTrace.monotonic();const v=JSON.parse(msg.data);inputWire.receive(msg.data,v,pending.get(v.id),receivedAt);if(v.id){const p=pending.get(v.id);');
  source=replace(source,"firstFailure??=error;closing=true;","firstFailure??=error;closing=true;inputWire.terminal(firstFailure);");
  source=replace(source,"browser=cp.spawn('/usr/bin/google-chrome',[","browser=nativeTrace.launch({spawn:cp.spawn,executable:'/usr/bin/google-chrome',argv:[");
  source=replace(source,"'about:blank'],{stdio:['ignore','pipe','pipe']});","'about:blank'],options:{stdio:['ignore','pipe','pipe']},out,save});");
  source=replace(source,"fs.readFileSync(run+'/input-observer.js','utf8')","fs.readFileSync(root+'/"+path.dirname(generatedPath)+"/input-observer.js','utf8')");
  source=replace(source,'finalize:receipt=>{ws?.close();',"finalize:receipt=>{inputWire.flush();save('native-trace-retrieval.json',nativeTrace.retrieve(out,receipt));ws?.close();");
  // Observe the existing cleanup Browser.close boundary too, without routing it
  // through send() or changing its independent shutdown callback.
  source=replace(source,'const v=JSON.parse(msg.data);if(v.id===n&&v.error)',
    'const receivedAt=nativeTrace.monotonic();const v=JSON.parse(msg.data);inputWire.receive(msg.data,v,{sessionId:null,method:\'Browser.close\'},receivedAt);if(v.id===n&&v.error)');
  source=replace(source,"ws.send(JSON.stringify({id:n,method:'Browser.close',params:{}}));",
    "const frame=JSON.stringify({id:n,method:'Browser.close',params:{}});inputWire.send({requestId:n,method:'Browser.close'},frame,()=>ws.send(frame));");
  return source;
}
// Materialize small run inputs and provider references only; never copy media,
// modules or source trees. Existing 1235 providers must still match their pins.
function prepare(run){
  run=path.resolve(run);assert(!fs.existsSync(run),'fresh task-owned run required');
  const root=path.resolve(__dirname,'..'),prior=path.dirname(generatedPath);
  const pins=JSON.parse(fs.readFileSync(path.join(root,prior,'runtime-pins.json')));
  for(const p of pins.files){const b=fs.readFileSync(path.join(root,p.path));assert.equal(hash(b),p.sha256,p.path);assert.equal(b.length,p.size,p.path);}
  fs.mkdirSync(run,{recursive:true});
  const inputs=[];
  for(const name of ['bound-input.cjs','ordinary-keys.cjs','native-mouse.cjs','relative-input.cjs','keyboard-bridge.cjs','transport.cjs']){
    const target=path.relative(run,path.join(root,prior,name));
    const file=path.join(run,name);fs.writeFileSync(file,"'use strict';\nmodule.exports=require("+JSON.stringify('./'+target)+");\n",{flag:'wx'});inputs.push(path.relative(root,file));
  }
  const names=new Set([...pins.files.map(p=>p.path),...providers,...inputs]);
  pins.files=[...names].sort().map(file=>{const b=fs.readFileSync(path.join(root,file));return {path:file,size:b.length,sha256:hash(b)};});
  pins.commit=require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  fs.writeFileSync(path.join(run,'runtime-pins.json'),JSON.stringify(pins,null,2),{flag:'wx'});
  const plan={offlinePrepared:true,nativeAttemptAuthorized:false,fixtureOnly:true,commands:[{key:',',holdMs:600,waitMs:0},'ordinary joined quit'],
    argv:[process.execPath,path.join(root,'tools/redline-native-trace.cjs'),'--fixture'],
    env:{REDLINE_RUN:run,REDLINE_NATIVE_TRACE:'1',BROWSER_DEADLINE:'REQUIRED future immutable deadline; existing <30min cap'},
    traceDurationSeconds:10,traceFile:path.join(run,'native-fixture/native-startup-trace.json'),
    prerequisite:'Separate authorization, prearmed independent runtime watchdog and existing custody/readiness gates before ONE future fixture. Existing controller watchdog remains mandatory.',
    retrieval:'Existing no-input cleanup writes native-trace-retrieval.json after actual browser wait and stream EOF; retrieve trace/wire/delivery and SHA-verify before owned runtime shutdown.',
    missingEvents:'Trace may end before first input. Missing key EventDispatch or clock mapping leaves cause UNKNOWN; no retry or extended bound.',
    native:'REVOKED',allwriters:'UNKNOWN',edictABA:'UNKNOWN',providers:pins.files.length,commit:pins.commit};
  fs.writeFileSync(path.join(run,'experiment-plan.json'),JSON.stringify(plan,null,2),{flag:'wx'});return plan;
}
function fixtureSource(){
  let source=fs.readFileSync(path.join(__dirname,'redline-native-fixture.cjs'),'utf8');
  source=replace(source,"[path.join(__dirname,'redline-browser-run.cjs')]","[path.join(__dirname,'redline-native-trace.cjs'),'--caller']");
  source=replace(source,"[[',','comma'],['.','period']]","[[',','comma']]");
  source=replace(source,'commaPeriod:true','commaOnly:true,startupTraceSeconds:10');
  return source;
}
module.exports={create,launch,retrieve,generated,integrate,fixtureSource,generatedPath,generatedSHA,providers,prepare,monotonic:()=>performance.now()};
if(require.main===module){
  const mode=process.argv[2];if(mode==='--prepare'){console.log(JSON.stringify(prepare(process.argv[3])));process.exit(0);}assert(['--check','--caller','--fixture'].includes(mode),'explicit trace mode');
  const source=mode==='--fixture'?fixtureSource():integrate();new(require('node:vm').Script)(source);
  if(mode==='--check')console.log('PASS exact1235 caller + single comma600 fixture composition; no runtime created');
  else {
    assert.equal(process.env.REDLINE_NATIVE_TRACE,'1','explicit future experiment opt-in required');
    if(mode==='--caller')assert.equal(process.env.REDLINE_NATIVE_FIXTURE,'1','fixture only');
    const filename=path.join(__dirname,mode==='--fixture'?'redline-native-fixture.cjs':'redline-browser-run.cjs');
    const Module=require('node:module'),m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(__dirname);m._compile(source,filename);
  }
}
