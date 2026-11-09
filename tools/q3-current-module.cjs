'use strict';
// Explicit current Q3 closure. Historical manifests and shared admission stay
// immutable. Every exception below names reviewed published bytes or this
// narrow migration; nothing discovers/accepts arbitrary provider drift.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const historical='scratch/runs/20261109-q3-relative-menu-native-progress-1415/runtime-pins.json.gz';
const historicalSHA='a6be3bee6fbf1c218a3982d8e991a44838abddc0a0b80c8bd4f45c3d6effe1dc';
const moduleVersion='q3-1475-published-5c8780318-f977ebf7c-v1';
const cpuCommit='5c8780318afbbe0e5a4e7c64190f2e0abde21cd0';
const custodyCommit='f977ebf7c28977d7d95eb404f43db2209d163dde';
const checkpointObserverVersion='q3-checkpoint-b993419a5-v1';
const checkpointCommit='b993419a54d732a67696851d8f2dc50b574b625b';
const checkpointCallerSHA='5b52e6438e2ec3f9676d11584dd52c5a435b1b17412c4ac2d5c1dec33301bb1e';
const checkpointPrelaunchSHA='649c689aba21e8fca8325435a08be1f7181dd6380cfe843d64ce9f840c9dec1a';
const foreignPrelaunchSHA='37d2cff7ce6f18eb19ff95bd5a94a234527353c902d6d1336bdbfca789eb20e8';
const checkpointDependencies=['tools/q3-checkpoint-observer.py','tools/q3-cancellation-stream-eof.py','tools/q3-native-launch-client.py'];
const SELECTED=Object.freeze({sha256:'3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18',bytes:2186068});
const modules={
  'build/wine-assembly.wasm':{size:SELECTED.bytes,sha256:SELECTED.sha256},
  'build/wine-assembly.compat.wasm':{size:2188714,sha256:'ecb45716b1ee7fc5218b1670dd270b19c7664ee30d000b3360a12786a1c21eaf'}
};
const publishedProviders=Object.fromEntries([
  'host.js','lib/guest-thread-host.js','lib/guest-worker.js','lib/region-map.generated.js',
  'src/00-regions.wat','src/03-registers.wat','src/05b-string-ops.wat','src/13-exports.wat'
].map(name=>[name,cpuCommit]));
publishedProviders['tools/native_kernel_custody.py']=custodyCommit;
// Exact published opt-in stage recorder; never accept arbitrary GL drift.
const glStageCommit='c6094c4edf87dcd7b80c4caa4225857bc3a5eb00';
for(const name of ['lib/gl-compat.js','lib/gl-render-host.js','lib/gl-render-worker.js'])
  publishedProviders[name]=glStageCommit;
const migration={
  'tools/q3-startup.cjs':'215181583d550a38264b8ae7854101a5d2e7a71acf25dd487e78a203a5c3c1cb',
  'tools/q3-native-driver-composition.cjs':'841098edb5be7cb43ac7a6b2e22bfbc79efe1f2ecff1d2963216c3b97ca762f7',
  'tools/q3-native-prelaunch.py':'2591af4d8222b727ae226898638ddb3016938474f7069c23e00815b6bf6a4dbc'
};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=n=>fs.readFileSync(path.join(root,n));
const pin=(name,b)=>({path:name,size:b.length,sha256:hash(b)});
const git=args=>cp.execFileSync('git',args,{cwd:root,maxBuffer:32*1024*1024});
function validate(options={}){
  assert(Object.keys(options).every(k=>['checkpointObserverVersion','foreignClosureVersion'].includes(k)),'explicit supported validation options');
  const foreign=options.foreignClosureVersion!==undefined;
  const foreignRoute=foreign?require('./q3-current-foreign-closure-v1.cjs'):undefined;
  if(foreign)foreignRoute.optin(options.foreignClosureVersion);
  const checkpoint=options.checkpointObserverVersion!==undefined;
  if(checkpoint)assert.equal(options.checkpointObserverVersion,checkpointObserverVersion,'explicit checkpoint observer version');
  const raw=read(historical);assert.equal(hash(raw),historicalSHA,'historical pinset integrity');
  const prior=JSON.parse(zlib.gunzipSync(raw)),seen=new Set(),explainedDrift=[];
  for(const p of prior.files){assert(!seen.has(p.path),'duplicate historical pin');seen.add(p.path);}
  for(const commit of [cpuCommit,custodyCommit,glStageCommit])for(const target of ['HEAD','origin/main'])git(['merge-base','--is-ancestor',commit,target]);
  const sources=git(['ls-tree','-r','--name-only',cpuCommit,'--','src','tools/watx-src','tools/watx.js','tools/watx-closure.js','tools/build-compile-wat.js']).toString().trim().split('\n');
  for(const name of sources)assert.equal(hash(read(name)),hash(git(['show',cpuCommit+':'+name])),'published build source: '+name);
  const expected={...modules};
  if(foreign)Object.assign(expected,foreignRoute.providerPins());
  for(const [name,commit] of Object.entries(publishedProviders))expected[name]=pin(name,git(['show',commit+':'+name]));
  const selectedMigration={...migration};
  if(checkpoint||foreign)selectedMigration['tools/q3-native-prelaunch.py']=checkpointPrelaunchSHA;
  if(foreign)selectedMigration['tools/q3-native-prelaunch.py']=foreignPrelaunchSHA;
  for(const [name,sha256] of Object.entries(selectedMigration)){
    assert.equal(hash(read(name)),sha256,'Q3 migration provider: '+name);expected[name]={sha256,size:read(name).length};
  }
  for(const name of Object.keys(expected))assert(seen.has(name)||foreign&&foreignRoute.dependencies.includes(name),'replacement requires historical provider');
  const files=prior.files.filter(p=>!p.path.startsWith(path.dirname(historical)+'/')).map(p=>{
    const actual=pin(p.path,read(p.path)),want=expected[p.path]??p;
    assert.equal(actual.size,want.size,'provider size: '+p.path);assert.equal(actual.sha256,want.sha256,'provider SHA: '+p.path);
    if(expected[p.path])explainedDrift.push({before:p,after:actual,reason:foreign&&foreignRoute.authorities[p.path]?'Exact published '+foreignRoute.authorities[p.path][0]:modules[p.path]?'Published 5c8780318 CPU mirror build':publishedProviders[p.path]?'Exact published '+publishedProviders[p.path]:(checkpoint||foreign)&&p.path==='tools/q3-native-prelaunch.py'?'1535 explicit checkpoint caller/prelaunch migration':'1475 tested Q3 preparer/admission/custody migration'});
    return actual;
  });
  const httpPins=prior.httpPins.map(p=>{
    const before=prior.files.find(f=>f.path===p.url.slice(1)),after=files.find(f=>f.path===p.url.slice(1));
    assert(before&&after,'HTTP provider required');assert.equal(p.size,before.size,'historical HTTP size');assert.equal(p.sha256,before.sha256,'historical HTTP SHA');
    return {...p,size:after.size,sha256:after.sha256};
  });
  files.push(pin('tools/q3-current-module.cjs',read('tools/q3-current-module.cjs')));
  if(foreign){
    for(const name of foreignRoute.dependencies){
      const actual=pin(name,read(name));assert.deepEqual(actual,expected[name],'published foreign dependency: '+name);files.push(actual);
      httpPins.push({url:'/'+name,size:actual.size,sha256:actual.sha256});
    }
    files.push(pin('tools/q3-current-foreign-closure-v1.cjs',read('tools/q3-current-foreign-closure-v1.cjs')));
  }
  if(checkpoint||foreign){
    for(const target of ['HEAD','origin/main'])git(['merge-base','--is-ancestor',checkpointCommit,target]);
    for(const name of checkpointDependencies){
      const authenticated=pin(name,git(['show',checkpointCommit+':'+name]));
      assert.deepEqual(pin(name,read(name)),authenticated,'published checkpoint dependency: '+name);
      const existing=files.find(p=>p.path===name);
      if(existing)assert.deepEqual(existing,authenticated,'checkpoint transitive pin: '+name);
      else files.push(authenticated);
    }
  }
  return {files,httpPins,moduleVersion:foreign?options.foreignClosureVersion:checkpoint?checkpointObserverVersion:moduleVersion,
    ...(foreign?{foreignClosureVersion:options.foreignClosureVersion,publishedForeignProviders:foreignRoute.authorities}:{}),
    ...(checkpoint?{checkpointObserverVersion,publishedCheckpointCommit:checkpointCommit}:{}),
    publishedModuleCommit:cpuCommit,publishedCustodyCommit:custodyCommit,historicalPinset:{path:historical,sha256:historicalSHA,commit:prior.commit},explainedDrift};
}
// One Node monotonic clock across transport and consumer. No browser clock subtraction.
const monotonicNs=()=>process.hrtime.bigint().toString();
const metadataToken=x=>typeof x==='string'?(x.length<=256?x:'sha256:'+hash(Buffer.from(x))):null;
function protocolMetadata(data){
 const bytes=typeof data==='string'?Buffer.from(data):Buffer.isBuffer(data)?data:
  ArrayBuffer.isView(data)?Buffer.from(data.buffer,data.byteOffset,data.byteLength):data instanceof ArrayBuffer?Buffer.from(data):null;
 if(!bytes)return {bytes:null,sha256:null,unavailable:true};
 const fields={bytes:bytes.length,sha256:hash(bytes)};
 if(bytes.length>65536)return {...fields,parseSkipped:true};
 try{
  const v=JSON.parse(bytes.toString()),token=metadataToken;
  return {...fields,requestId:Number.isSafeInteger(v.id)?v.id:null,method:token(v.method),sessionId:token(v.sessionId),
   errorCode:Number.isSafeInteger(v.error?.code)?v.error.code:null};
 }catch{return {...fields,parseError:true};}
}
// Capture observation has its own lifetime; startup still stops at navigation.
// Public event entry is not a network-stack/compositor timestamp. Large frames
// are linked by the actual MessageEvent object, never reparsed for diagnostics.
function createCaptureDiagnostics({socket,write,now=monotonicNs,schedule=setTimeout,cancel=clearTimeout}){
 const shots=new Map(),ingress=new WeakMap(),attachments=new Map(),targets=new Map();let sequence=0,messages=0,closed=false;
 const safe=fn=>{try{return fn();}catch{/* Never replace a protocol failure. */}};
 const retain=(map,key,value)=>{if(!map.has(key)&&map.size>=64)map.delete(map.keys().next().value);map.set(key,value);};
 const emit=(shot,phase,fields={})=>{
  if(closed||!shots.has(shot.requestId)||shot.rows>=128||sequence>=4096)return;
  safe(()=>write({version:1,observation:'capture',sequence:++sequence,monotonicNs:now(),
   phase,requestId:shot.requestId,sessionId:shot.sessionId,targetId:shot.targetId,requestTargetId:shot.requestTargetId,...fields}));
  ++shot.rows;
  if(shot.rows>=128)stop(shot,'capture record limit');
  if(sequence>=4096){for(const active of [...shots.values()])stop(active,'global record limit');dispose();}
 };
 const stop=(shot,reason)=>{
  if(!shots.delete(shot.requestId))return;
  safe(()=>cancel(shot.timer));shot.timer=null;
  // UNKNOWN describes completion unless the consumer actually delivered it.
  safe(()=>write({version:1,observation:'capture',sequence:++sequence,monotonicNs:now(),phase:'observation-stop',
   requestId:shot.requestId,sessionId:shot.sessionId,targetId:shot.targetId,requestTargetId:shot.requestTargetId,reason,
   completion:shot.delivered?'consumer delivered':'UNKNOWN'}));
 };
 const raw=event=>safe(()=>{
  if(!shots.size)return;
  const at=now(),message=++messages,fields=protocolMetadata(event.data);
  ingress.set(event,{message,monotonicNs:at});
  for(const shot of [...shots.values()])emit(shot,'public-message',{
   ...fields,wireRequestId:fields.requestId??null,wireSessionId:fields.sessionId??null,
   // Keep the observed capture identity separate from untrusted wire identity.
   requestId:shot.requestId,sessionId:shot.sessionId,message,monotonicNs:at});
 });
 const dispose=()=>{
  for(const shot of [...shots.values()])stop(shot,'socket close');closed=true;attachments.clear();targets.clear();
  safe(()=>socket.removeEventListener('message',raw));safe(()=>socket.removeEventListener('close',dispose));
 };
 safe(()=>socket.addEventListener('message',raw));safe(()=>socket.addEventListener('close',dispose));
 return {
  request(meta,params={}){safe(()=>{
   if(closed)return;
   if(meta.method==='Target.attachToTarget')retain(attachments,meta.requestId,metadataToken(params.targetId));
   if(sequence>=4096||meta.method!=='Page.captureScreenshot')return;
   if(shots.size>=32)stop(shots.values().next().value,'capture capacity');
   if(sequence>=4096){dispose();return;}
   const shot={requestId:meta.requestId,sessionId:metadataToken(meta.sessionId),targetId:targets.get(metadataToken(meta.sessionId))??null,requestTargetId:metadataToken(meta.targetId),rows:0,timer:null,delivered:false};
   shots.set(shot.requestId,shot);emit(shot,'request');
   if(shots.has(shot.requestId)){
    // Independent observation cap only. The consumer's existing 20000ms CDP
    // timer, command work deadline and cancellation remain authoritative.
    try{shot.timer=schedule(()=>stop(shot,'observation cap'),20000);shot.timer?.unref?.();}
    catch{stop(shot,'observation timer unavailable');}
   }
  });},
  send(phase,data){safe(()=>{
   if(!shots.size)return;
   const at=now(),fields=protocolMetadata(data),shot=shots.get(fields.requestId);
   if(!shot)return;
   if(phase==='pre-send')shot.sending=true;
   emit(shot,phase,{...fields,wireSessionId:fields.sessionId,sessionId:shot.sessionId,monotonicNs:at});
   if(phase==='send-return'||phase==='send-throw'){
    shot.sending=false;if(shot.settled)stop(shot,shot.settled);
   }
  });},
  receive(event,value,pending){safe(()=>{
   if(closed)return;const at=now();
   // Observe existing authenticated caller associations; never invent a page
   // target from the consumer's symbolic 'page' metadata or affect routing.
   if(attachments.has(value.id)){
    const target=attachments.get(value.id);attachments.delete(value.id);
    if(pending&&!value.error&&typeof value.result?.sessionId==='string')retain(targets,metadataToken(value.result.sessionId),target);
   }
   if(value.method==='Target.attachedToTarget'&&typeof value.params?.sessionId==='string')
    retain(targets,metadataToken(value.params.sessionId),metadataToken(value.params.targetInfo?.targetId));
   if(value.method==='Target.detachedFromTarget')targets.delete(metadataToken(value.params?.sessionId));
   if(value.method==='Target.targetDestroyed')for(const [session,target] of targets)
    if(target===metadataToken(value.params?.targetId))targets.delete(session);
   const shot=shots.get(value.id);if(!shot)return;
   const entry=ingress.get(event);shot.delivered=true;
   emit(shot,'consumer-delivery',{monotonicNs:at,message:entry?.message??null,publicMonotonicNs:entry?.monotonicNs??null,
    responseSessionId:metadataToken(value.sessionId),routePending:!!pending,
    routeSessionMatches:shot.sessionId===metadataToken(value.sessionId),errorCode:Number.isSafeInteger(value.error?.code)?value.error.code:null});
  });},
  settlement(meta,outcome){safe(()=>{attachments.delete(meta.requestId);const shot=shots.get(meta.requestId);if(shot){shot.settled=outcome;emit(shot,'settlement',{outcome});if(!shot.sending)stop(shot,outcome);}});},
  deadline(meta){safe(()=>{const shot=shots.get(meta.requestId);if(shot){emit(shot,'deadline');stop(shot,'CDP deadline');}});},
  dispose,
  get active(){return shots.size;}
 };
}
function installTransportDiagnostics({WebSocket,write,now=monotonicNs,schedule=setTimeout,cancel=clearTimeout}){
 // WHATWG has no send callback. Wrap an existing callback only when the caller
 // supplied one; never infer callback support from function arity or inject one.
 return class TransportSocket extends WebSocket{
  constructor(...args){
   super(...args);
   this.q3Capture=createCaptureDiagnostics({socket:this,write,now,schedule,cancel});
   let rows=0,samples=0,active=true,timer=null,armed=false;
   const record=(phase,fields={})=>{if(!active||rows>=512)return;try{
    write({version:1,sequence:++rows,monotonicNs:now(),phase,...fields,...rows===512?{recordLimitReached:true}:{}});
   }catch{/* Observation must not replace the first protocol/transport error. */}
    if(rows===512){active=false;if(timer!==null)cancel(timer);}
   };
   const stop=reason=>{record('observation-stop',{reason});active=false;if(timer!==null)cancel(timer);};
   const tick=()=>{
    if(!active||samples>=96)return;
    const armedNs=now();
    timer=schedule(()=>{timer=null;record('node-scheduling',{sample:++samples,armedNs,expectedDelayMs:250,
     delayMs:Math.max(0,Number(BigInt(now())-BigInt(armedNs))/1e6-250)});tick();},250);
    timer?.unref?.();
   };
   this.q3Transport={record,stop,get active(){return active;},arm:()=>{if(!armed){armed=true;tick();}}};
   this.addEventListener('message',event=>{
    if(!active)return;
    const monotonicNs=now(); // Public event entry, before hashing or JSON work.
    record('raw-message',{...protocolMetadata(event.data),monotonicNs});
   });
   for(const event of ['error','close'])this.addEventListener(event,()=>record('transport-event',{event}));
  }
  send(data,...args){
   const capture=this.q3Capture;
   capture.send('pre-send',data);
   const observer=this.q3Transport;
   if(!observer.active){
    try{const result=super.send(data,...args);capture.send('send-return',data);return result;}
    catch(error){capture.send('send-throw',data);throw error;}
   }
   const fields=protocolMetadata(data);
   observer.arm();observer.record('pre-send',fields);
   const forwarded=args.map(arg=>typeof arg!=='function'?arg:function(...values){
    observer.record('send-callback',{...fields,error:!!values[0]});return Reflect.apply(arg,this,values);
   });
   try{const result=super.send(data,...forwarded);observer.record('send-return',fields);capture.send('send-return',data);return result;}
   catch(error){observer.record('send-throw',fields);capture.send('send-throw',data);throw error;}
  }
  close(...args){try{return super.close(...args);}finally{this.q3Transport.stop('socket close invoked');this.q3Capture.dispose();}}
 };
}
// Instrument the authenticated consumer after its existing transforms. Keep
// protocol routing, debugger policy, terminal propagation and timers intact.
function composeStartupDiagnostics(source){
  const once=(before,after)=>{
    assert.equal(source.split(before).length,2,'unique startup diagnostic seam: '+before);
    source=source.replace(before,after);
  };
  // Only this authenticated diagnostic consumer arms the host. The page owner
  // reads the existing shared ring even when renderer JS cannot service RPC.
  // Missing exits remain UNKNOWN; these samples perform no GL/protocol work.
  once("Object.defineProperty(globalThis,'GLRenderHost'",`let q3PartialStop=()=>{},q3PageHidden=false;
addEventListener('pagehide',()=>{q3PageHidden=true;q3PartialStop();},{once:true});
Object.defineProperty(globalThis,'GLRenderHost'`);
  once('value.configureDiagnostics({enabled:true,maxRecords:64});this.__q3GLHost=value;',
    `value.configureDiagnostics({enabled:true,maxRecords:64});this.__q3GLHost=value;
q3PartialStop();
if(!q3PageHidden){
 let samples=0,active=true;
 try{
  const timer=setInterval(()=>{
   if(!active)return;
   ++samples;
   try{console.debug('Q3_GL_INDEPENDENT_PARTIAL',JSON.stringify({version:1,sample:samples,pageNow:performance.now(),snapshot:value.diagnosticSnapshot()}));}catch{}
   if(samples>=1024)q3PartialStop();
  },500);
  q3PartialStop=()=>{if(active){active=false;clearInterval(timer);}q3PartialStop=()=>{};};
 }catch{/* Observation setup cannot prevent ordinary host imports. */}
}`);
  once('function send(method,params={},sessionId,captureProbe=null)',`const startupDiagnostics=require(root+'/tools/q3-current-module.cjs');
const startupRequests=new Map(),startupTargets=new Map();let startupRecording=true,startupRows=0;
function startupRecord(direction,fields){
 if(startupRows++>=512)return;
 try{
 const row={direction,...fields};
 for(const key of ['sessionId','requestSessionId','method'])if(key in row)row[key]=startupDiagnostics.metadataToken(row[key]);
 log('cdp-startup.jsonl',{monotonicNs:startupDiagnostics.monotonicNs(),...row});
 ws?.q3Transport?.record('consumer',row);
 }catch{/* Diagnostic failure cannot replace the original failure. */}
}
function startupOutbound(meta,params){
 if(!startupRecording)return;
 if(startupRequests.size<64)startupRequests.set(meta.requestId,{requestId:meta.requestId,method:meta.method,sessionId:meta.sessionId});
 startupRecord('outbound',{requestId:meta.requestId,method:meta.method,sessionId:meta.sessionId,
  ...startupDiagnostics.protocolMetadata(JSON.stringify({id:meta.requestId,method:meta.method,params,...(meta.sessionId?{sessionId:meta.sessionId}:{})})),target:startupTargets.get(meta.sessionId)??null});
}
function startupInbound(raw){
 if(!startupRecording)return;
 const fields=startupDiagnostics.protocolMetadata(raw),request=startupRequests.get(fields.requestId),matched=pending.has(fields.requestId);
 if(fields.parseSkipped||fields.unavailable){startupRecord('inbound',fields);return;}
 let v;try{v=JSON.parse(raw);}catch{startupRecord('inbound',fields);return;}
 if(v.method==='Target.attachedToTarget'&&startupTargets.size<64)startupTargets.set(v.params?.sessionId,{
  targetId:startupDiagnostics.metadataToken(v.params?.targetInfo?.targetId),type:startupDiagnostics.metadataToken(v.params?.targetInfo?.type),waitingForDebugger:!!v.params?.waitingForDebugger});
 startupRecord('inbound',{...fields,method:fields.method??request?.method??null,
  requestSessionId:request?.sessionId??null,matched,knownRequest:!!request,
  target:v.method==='Target.attachedToTarget'?startupTargets.get(v.params?.sessionId):startupTargets.get(v.sessionId)??null});
}
function startupSettlement(meta,outcome){
 ws?.q3Capture?.settlement(meta,outcome);
 if(!startupRecording)return;
 startupRecord('settlement',{requestId:meta.requestId,method:meta.method,sessionId:meta.sessionId,outcome});
 if(meta.method==='Page.navigate'&&outcome==='resolve'){startupRecording=false;startupRequests.clear();startupTargets.clear();ws?.q3Transport?.stop('navigation settled');}
}
function send(method,params={},sessionId,captureProbe=null)`);
  once('new Promise((resolve,reject)=>{const timer=setTimeout',
    "new Promise((resolvePromise,rejectPromise)=>{let settled=false;const settle=(outcome,fn,value)=>{if(!settled){settled=true;startupSettlement(meta,outcome);}return fn(value);};const resolve=value=>settle('resolve',resolvePromise,value),reject=error=>settle('reject',rejectPromise,error);const timer=setTimeout");
  once('screenshotCompletion.request(meta,params);try{',
    "startupOutbound(meta,params);screenshotCompletion.request(meta,params);ws?.q3Capture?.request(meta,params);try{");
  once('const v=JSON.parse(msg.data);screenshotCompletion.receive(v,pending.get(v.id));',
    'startupInbound(msg.data);const v=JSON.parse(msg.data);screenshotCompletion.receive(v,pending.get(v.id));ws?.q3Capture?.receive(msg,v,pending.get(v.id));');
  once("screenshotCompletion.deadline(meta);pending.delete(n);",
    "screenshotCompletion.deadline(meta);ws?.q3Capture?.deadline(meta);if(startupRecording)startupRecord('deadline',{requestId:n,method:meta.method,sessionId:meta.sessionId});pending.delete(n);");
  once("screenshotCompletion.transport(event);if(!closing)",
    "screenshotCompletion.transport(event);if(startupRecording)startupRecord('transport',{event});if(!closing)");
  once('screenshotCompletion.sendFailed(meta,error);observeTerminal(error);',
    "if(startupRecording)startupRecord('send-error',{requestId:meta.requestId,method:meta.method,sessionId:meta.sessionId});screenshotCompletion.sendFailed(meta,error);observeTerminal(error);");
  return source;
}
function composeCheckpointCaller(source,version){
  assert.equal(version,checkpointObserverVersion,'explicit checkpoint observer version');
  assert.equal(hash(Buffer.from(source)),checkpointCallerSHA,'authenticated retained1475 caller');
  const binder="helper=runpy.run_path(str(ROOT/'tools/q3-cancellation-stream-eof.py'))";
  assert.equal(source.split(binder).length,2,'owning binder seam');
  source=source.replace(binder,"helper=runpy.run_path(str(ROOT/'tools/q3-checkpoint-observer.py'))");
  const branch=source.indexOf("  elif phase=='cancellation':\n");
  const begin=source.indexOf('   code=',branch),end=source.indexOf("   save('cancellation-commanded-physical-gate'",begin);
  assert(branch>0&&begin>branch&&end>begin,'owning observation seam');
  source=source.slice(0,begin)+"   while not session.started.wait(.01):session.check()\n"+
    "   ready=helper['observe_checkpoint'](task,session,session.remote);save('cancellation-native-checkpoint',ready)\n"+source.slice(end);
  // A recorded controller failure used to fall through after a successful
  // read-only join, making the actual caller exit zero. Preserve that first
  // exception through the join without changing planned cancellation.
  const once=(before,after)=>{
    assert.equal(source.split(before).length,2,'owning terminal propagation seam');
    source=source.replace(before,after);
  };
  once(' launcher=threading.Thread(target=owned_launch);launcher.start()',
    ' controllerError=None\n launcher=threading.Thread(target=owned_launch);launcher.start()');
  // select() observes the kernel pipe, not TextIOWrapper's read-ahead buffer.
  // Two prepared lines in one write used to strand the second until a third
  // write arrived. Retain complete byte lines ourselves; never wait for more
  // bytes when a complete line is pending, and observe EOF before admission.
  once("   while not session.completed:\n    session.check()\n    import select\n    if not select.select([sys.stdin],[],[],.05)[0]:continue\n    line=sys.stdin.readline()\n    if not line:raise session.fail('original controller stdin EOF')\n    value=json.loads(line);command=value['command']",
    `   import select
   inputPoll=select.poll();inputPoll.register(sys.stdin,select.POLLIN|select.POLLHUP|select.POLLERR)
   inputPending=b''
   while not session.completed:
    session.check()
    events=inputPoll.poll(0 if b'\\n' in inputPending else 50)
    if any(mask&(select.POLLHUP|select.POLLERR|select.POLLNVAL) for _,mask in events):
     raise session.fail('original controller stdin EOF')
    if events:
     chunk=os.read(sys.stdin.fileno(),65536)
     if not chunk:raise session.fail('original controller stdin EOF')
     inputPending+=chunk
    if b'\\n' not in inputPending:continue
    line,inputPending=inputPending.split(b'\\n',1)
    session.check()
    value=json.loads(line);command=value['command']`);
  once(" except BaseException as e:\n  if not (R/'actual-first-terminal.json.gz').exists():",
    " except BaseException as e:\n  controllerError=e\n  if not (R/'actual-first-terminal.json.gz').exists():");
  once(" proof=json.loads(remote(phase+'-independent-join',code,60));save(phase+'-proof',proof)\n print(json.dumps(proof),flush=True)",
    " try:\n  proof=json.loads(remote(phase+'-independent-join',code,60));save(phase+'-proof',proof)\n  print(json.dumps(proof),flush=True)\n except BaseException as joinError:\n  if controllerError is None:raise\n  save(phase+'-join-error',dict(error=str(joinError)))\n if controllerError is not None:raise controllerError");
  // Compile the actual generated caller, not a duplicated observer snippet.
  cp.execFileSync('python3',['-B','-c',"import ast,sys;compile(ast.parse(sys.stdin.read()),'<q3-checkpoint-caller>','exec')"],{input:source});
  return source;
}
function prepare(destination,{inputs=[]}={}){
  assert.equal(arguments.length<=2,true);const options=arguments[1]??{};
  assert(Object.keys(options).every(k=>['inputs','checkpointObserverVersion','caller','foreignClosureVersion','nativeLifecycleVersion'].includes(k)),'explicit supported preparation options');
  const checkpoint=options.checkpointObserverVersion!==undefined;
  assert(checkpoint||options.caller===undefined,'caller requires explicit checkpoint observer version');
  destination=path.resolve(destination);assert(!fs.existsSync(destination),'fresh task-owned destination required');
  const validation={};
  if(checkpoint)validation.checkpointObserverVersion=options.checkpointObserverVersion;
  if(options.foreignClosureVersion!==undefined)validation.foreignClosureVersion=options.foreignClosureVersion;
  const version=validate(validation);
  const lifecycle=options.nativeLifecycleVersion===undefined?undefined:require('./q3-versioned-native-lifecycle.cjs');
  let generated=[];
  if(lifecycle){
    assert(checkpoint&&options.foreignClosureVersion!==undefined,'native lifecycle requires explicit checkpoint and foreign versions');
    assert.equal(options.nativeLifecycleVersion,lifecycle.version,'explicit native lifecycle version');
    assert.equal(path.basename(destination),'prepared','owning lifecycle prepared directory');
    generated=lifecycle.generate(destination,options.nativeLifecycleVersion);
    version.nativeLifecycleVersion=lifecycle.version;
    version.files.push(pin('tools/q3-versioned-native-lifecycle.cjs',read('tools/q3-versioned-native-lifecycle.cjs')));
    for(const file of generated)version.files.push(pin(file.path,Buffer.from(file.source)));
  }
  for(const name of inputs){
    assert(typeof name==='string'&&name.startsWith('scratch/runs/')&&name.endsWith('.py')&&!name.split('/').includes('..'),'small owned Python run input required');
    assert(path.resolve(root,name).startsWith(path.dirname(destination)+path.sep),'input must belong to destination parent');
    const b=read(name);assert(b.length<65536,'small run input only');assert(!version.files.some(p=>p.path===name),'duplicate input');version.files.push(pin(name,b));
  }
  let caller;
  if(checkpoint){
    assert(inputs.includes(options.caller),'caller must be an explicit small owned input');
    for(const name of ['control.py','physical_gate.py','cancellation_gate.py']){
      const dependency=path.relative(root,path.join(path.dirname(destination),name));
      assert(inputs.includes(dependency),'missing caller transitive input: '+name);
    }
    let source=composeCheckpointCaller(read(options.caller).toString(),options.checkpointObserverVersion);
    if(lifecycle)source=lifecycle.caller(source);
    caller=path.join(path.dirname(destination),'q3-checkpoint-caller.py');
    assert(!fs.existsSync(caller),'fresh generated caller required');
    version.checkpointCaller=path.relative(root,caller);
    version.files.push(pin(version.checkpointCaller,Buffer.from(source)));
    // All refusal checks precede either output. This file stays beside the
    // run's control.py/physical_gate.py/cancellation_gate.py, like retained1475.
    fs.writeFileSync(caller,source,{flag:'wx',mode:0o444});
  }
  version.files.sort((a,b)=>a.path.localeCompare(b.path));
  let runtimeCaller,runtimeSource;
  if(options.foreignClosureVersion!==undefined){
    const route=require('./q3-current-foreign-closure-v1.cjs');
    runtimeCaller=path.join(destination,'q3-runtime-caller.cjs');
    runtimeSource=route.callerSource(destination,route.closureSHA(version.files));
    version.runtimeCaller=path.relative(root,runtimeCaller);
    version.files.push(pin(version.runtimeCaller,Buffer.from(runtimeSource)));
    version.files.sort((a,b)=>a.path.localeCompare(b.path));
  }
  const pins={commit:git(['rev-parse','HEAD']).toString().trim(),...version};
  const raw=Buffer.from(JSON.stringify(pins,null,2));
  fs.mkdirSync(destination,{recursive:true});
  for(const file of generated){fs.mkdirSync(path.dirname(path.join(root,file.path)),{recursive:true});fs.writeFileSync(path.join(root,file.path),file.source,{flag:'wx',mode:0o444});}
  if(runtimeCaller)fs.writeFileSync(runtimeCaller,runtimeSource,{flag:'wx',mode:0o444});
  fs.writeFileSync(path.join(destination,'runtime-pins.json.gz'),zlib.gzipSync(raw),{flag:'wx',mode:0o444});
  const seal={moduleVersion:version.moduleVersion,...(caller?{caller:version.checkpointCaller}:{}),...(runtimeCaller?{runtimeCaller:version.runtimeCaller,foreignClosureVersion:version.foreignClosureVersion,offlinePrepared:true,nativeReady:false}:{}),manifestSHA256:hash(raw),providers:pins.files.length,publishedModuleCommit:cpuCommit,publishedCustodyCommit:custodyCommit,historicalPinset:version.historicalPinset,explainedDrift:version.explainedDrift};
  fs.writeFileSync(path.join(destination,'replacement-pinset-seal.json'),JSON.stringify(seal,null,2),{flag:'wx',mode:0o444});
  return seal;
}
module.exports={createCaptureDiagnostics,metadataToken,monotonicNs,protocolMetadata,installTransportDiagnostics,SELECTED,validate,prepare,moduleVersion,historical,historicalSHA,cpuCommit,custodyCommit,migration,checkpointObserverVersion,composeCheckpointCaller,composeStartupDiagnostics};
if(require.main===module){
  const args=process.argv.slice(2);assert.equal(args.shift(),'--prepare','explicit preparation only');
  const destination=args.shift(),options={inputs:[]};
  while(args.length){
    const flag=args.shift(),value=args.shift();assert(value,'option value required');
    if(flag==='--input')options.inputs.push(value);
    else if(flag==='--caller'){assert(!options.caller,'duplicate caller');options.caller=value;}
    else if(flag==='--checkpoint-observer-version'){assert(!options.checkpointObserverVersion,'duplicate checkpoint version');options.checkpointObserverVersion=value;}
    else if(flag==='--foreign-closure-version'){assert(!options.foreignClosureVersion,'duplicate foreign closure version');options.foreignClosureVersion=value;}
    else if(flag==='--native-lifecycle-version'){assert(!options.nativeLifecycleVersion,'duplicate native lifecycle version');options.nativeLifecycleVersion=value;}
    else assert.fail('unsupported preparation flag: '+flag);
  }
  console.log(JSON.stringify(prepare(destination,options)));
}
