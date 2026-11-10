'use strict';
// Explicit current Q3 closure. Historical manifests and shared admission stay
// immutable. Every exception below names reviewed published bytes or this
// narrow migration; nothing discovers/accepts arbitrary provider drift.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const historical='scratch/runs/20261109-q3-relative-menu-native-progress-1415/runtime-pins.json.gz';
const historicalSHA='a6be3bee6fbf1c218a3982d8e991a44838abddc0a0b80c8bd4f45c3d6effe1dc';
const moduleVersion='q3-published-crt-e7e0312bd-f977ebf7c-v1';
const cpuCommit='e7e0312bd9a932ab2d3f0381e117e8158f2ee685';
const custodyCommit='f977ebf7c28977d7d95eb404f43db2209d163dde';
const checkpointObserverVersion='q3-checkpoint-b993419a5-v1';
const checkpointCommit='b993419a54d732a67696851d8f2dc50b574b625b';
const checkpointCallerSHA='5b52e6438e2ec3f9676d11584dd52c5a435b1b17412c4ac2d5c1dec33301bb1e';
const checkpointPrelaunchSHA='649c689aba21e8fca8325435a08be1f7181dd6380cfe843d64ce9f840c9dec1a';
const foreignPrelaunchSHA='37d2cff7ce6f18eb19ff95bd5a94a234527353c902d6d1336bdbfca789eb20e8';
const checkpointDependencies=['tools/q3-checkpoint-observer.py','tools/q3-cancellation-stream-eof.py','tools/q3-native-launch-client.py'];
const SELECTED=Object.freeze({sha256:'4f2c69a1528e01a9ab5127201d5e8a222da2a35236377a1351f444f55fa5a7d9',bytes:2186099});
const modules={
  'build/wine-assembly.wasm':{size:SELECTED.bytes,sha256:SELECTED.sha256},
  'build/wine-assembly.compat.wasm':{size:2188745,sha256:'5bf29fae3d0c6918df98973ef29297a77a81df0e0b0a917b8adac8bec256df69'}
};
const publishedProviders=Object.fromEntries([
  'host.js','lib/guest-thread-host.js','lib/guest-worker.js','lib/region-map.generated.js',
  'src/00-regions.wat','src/03-registers.wat','src/05b-string-ops.wat','src/09a6-handlers-crt.wat','src/13-exports.wat'
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
    if(expected[p.path])explainedDrift.push({before:p,after:actual,reason:foreign&&foreignRoute.authorities[p.path]?'Exact published '+foreignRoute.authorities[p.path][0]:modules[p.path]?'Published '+cpuCommit+' CPU mirror build':publishedProviders[p.path]?'Exact published '+publishedProviders[p.path]:(checkpoint||foreign)&&p.path==='tools/q3-native-prelaunch.py'?'1535 explicit checkpoint caller/prelaunch migration':'1475 tested Q3 preparer/admission/custody migration'});
    return actual;
  });
  const httpPins=prior.httpPins.map(p=>{
    const before=prior.files.find(f=>f.path===p.url.slice(1)),after=files.find(f=>f.path===p.url.slice(1));
    assert(before&&after,'HTTP provider required');assert.equal(p.size,before.size,'historical HTTP size');assert.equal(p.sha256,before.sha256,'historical HTTP SHA');
    return {...p,size:after.size,sha256:after.sha256};
  });
  files.push(pin('tools/q3-current-module.cjs',read('tools/q3-current-module.cjs')));
  files.push(pin('tools/q3-input-phase-service.cjs',read('tools/q3-input-phase-service.cjs')));
  files.push(pin('lib/q3-input-observer.js',read('lib/q3-input-observer.js')));
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
// Reserved readiness lane: unrelated startup traffic cannot exhaust it. Public
// receipt is Node's MessageEvent entry, never proof of browser execution.
function createReadinessDiagnostics({socket,write,now=monotonicNs,enabled=process.env.Q3_READINESS_WIRE==='1'}){
 const requests=new Map(),ingress=new WeakMap();let rows=0,wireRows=0,passive=0,progress=0,errors=0,closed=!enabled;
 const producerRead=enabled?require('../scratch/runs/20261108-q3-gl-readiness-gameplay/producer-ready.cjs').READ:null;
 let replies=0,consoleRows=0;
 const safe=fn=>{try{return fn();}catch{}};
 const emit=(phase,fields={})=>safe(()=>{
  if(closed)return;
  if(!['passive-event','producer-reply','startup-console'].includes(phase)&&wireRows++>=2048)return;
  write({version:1,observation:'readiness',sequence:++rows,monotonicNs:now(),phase,...fields,
   ...(phase!=='passive-event'&&wireRows===2048?{recordLimitReached:true}:{})});
 });
 const raw=event=>safe(()=>{
  if(closed||!requests.size)return;
  const at=now(),fields=protocolMetadata(event.data);
  if(!requests.has(fields.requestId))return;
  ingress.set(event,at);emit('public-message',{...fields,monotonicNs:at});
 });
 const dispose=()=>{emit('observation-stop',{pending:[...requests.keys()],completion:'UNKNOWN unless settled'});closed=true;requests.clear();safe(()=>socket.removeEventListener('message',raw));safe(()=>socket.removeEventListener('close',dispose));};
 if(enabled){socket.addEventListener('message',raw);socket.addEventListener('close',dispose);}
 return {
  request(meta,params){safe(()=>{
   if(closed||requests.size>=32||meta.method!=='Runtime.evaluate')return;
   const expression=params.expression;
   if(typeof expression!=='string'||!(expression===producerRead||/runningApps.*guestWorker/.test(expression)||['WINE_REDLINE_STARTUP','__q3StartupInstance','__generatedError','__q3Launch'].some(token=>expression.includes(token))))return;
   requests.set(meta.requestId,{requestId:meta.requestId,sessionId:metadataToken(meta.sessionId),targetId:metadataToken(meta.targetId),
    stage:expression===producerRead?'renderer-producer':expression.includes('__q3StartupInstance')?'worker-identity':expression.includes('WINE_REDLINE_STARTUP')?'startup-admission':'guest-readiness',expressionSHA256:hash(Buffer.from(expression))});
   emit('request',requests.get(meta.requestId));
  });},
  send(phase,data){safe(()=>{if(closed||!requests.size)return;const fields=protocolMetadata(data);if(requests.has(fields.requestId))emit(phase,fields);});},
  receive(event,value,pending){safe(()=>{
   if(closed)return;
   const request=requests.get(value.id);
   if(request?.stage==='renderer-producer'&&replies++<64)emit('producer-reply',{
    ...request,responseSessionId:metadataToken(value.sessionId),routePending:!!pending,
    routeSessionMatches:request.sessionId===metadataToken(value.sessionId),
    reply:boundedDiagnosticValue(value.result),protocolError:boundedDiagnosticValue(value.error),
    recordLimitReached:replies===64});
   if(value.method==='Runtime.consoleAPICalled'&&value.params?.args?.[0]?.value==='Q3_STARTUP_CONSOLE'&&consoleRows++<64)
    emit('startup-console',{sessionId:metadataToken(value.sessionId),detail:boundedDiagnosticValue(value.params),recordLimitReached:consoleRows===64});
   if(requests.has(value.id))emit('consumer-delivery',{...requests.get(value.id),responseSessionId:metadataToken(value.sessionId),publicMonotonicNs:ingress.get(event)??null,routePending:!!pending,errorCode:value.error?.code??null,exception:!!value.result?.exceptionDetails,resultPhase:metadataToken(value.result?.result?.value?.phase),value:typeof value.result?.result?.value==='boolean'?value.result.result.value:null});
   // Existing Runtime events only: no evaluate, polling or post-failure probe.
   if(['Runtime.consoleAPICalled','Runtime.exceptionThrown','Target.attachedToTarget','Target.detachedFromTarget'].includes(value.method)){
    const isProgress=value.params?.args?.some(a=>a.value==='Q3_READINESS_PASSIVE');
    const isError=value.method==='Runtime.exceptionThrown'||value.params?.type==='error';
    if(isProgress?progress++>=240:isError?errors++>=64:passive++>=256)return;
    const text=JSON.stringify(value.params);emit('passive-event',{method:value.method,sessionId:metadataToken(value.sessionId),detail:text.length<=8192?text:text.slice(0,8192),truncated:text.length>8192});
   }
  });},
  settlement(meta,outcome){safe(()=>{if(requests.has(meta.requestId)){emit('settlement',{...requests.get(meta.requestId),outcome});requests.delete(meta.requestId);}});},
  dispose
 };
}
// Already parsed CDP JSON only. Do not stringify or clone unbounded replies.
// Limits cover keys, values, depth and string characters, with explicit loss.
function boundedDiagnosticValue(value){
 let nodes=1024,chars=16384,truncated=false;
 const text=s=>{const n=Math.min(s.length,2048,chars);chars-=n;if(n<s.length)truncated=true;return s.slice(0,n);};
 const visit=(v,depth)=>{
  if(--nodes<0||depth>12){truncated=true;return null;}
  if(typeof v==='string')return text(v);
  if(v===null||typeof v==='number'||typeof v==='boolean')return v;
  if(typeof v!=='object')return null;
  const a=Array.isArray(v),out=a?[]:Object.create(null);let count=0;
  for(const key in v){
   if(!Object.prototype.hasOwnProperty.call(v,key))continue;
   if(nodes<=0||chars<=0||count++>=128){truncated=true;break;}
   const name=text(key),item=visit(v[key],depth+1);if(a)out.push(item);else out[name]=item;
  }
  return out;
 };
 return {value:visit(value,0),truncated};
}
function installTransportDiagnostics({WebSocket,write,now=monotonicNs,schedule=setTimeout,cancel=clearTimeout}){
 // Native revocation is authoritative even after diagnostic recording caps.
 // Check at the last synchronous boundary before ANY protocol send, including
 // automatic startup/capture and cleanup. The native reaper still owns exit.
 const cancellationFile=process.env.Q3_NATIVE_PHASE===undefined?null:
  path.join(path.dirname(process.env.Q3_EXECUTION_BOUNDARY_OUT),'caller-cancelled.json');
 // WHATWG has no send callback. Wrap an existing callback only when the caller
 // supplied one; never infer callback support from function arity or inject one.
 return class TransportSocket extends WebSocket{
  constructor(...args){
   super(...args);
   this.q3Readiness=createReadinessDiagnostics({socket:this,write,now});
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
   assert(!cancellationFile||!fs.existsSync(cancellationFile),'native owner cancelled; no later protocol');
   const capture=this.q3Capture;
   capture.send('pre-send',data);
   this.q3Readiness.send('pre-send',data);
   const observer=this.q3Transport;
   if(!observer.active){
    try{const result=super.send(data,...args);capture.send('send-return',data);this.q3Readiness.send('send-return',data);return result;}
    catch(error){capture.send('send-throw',data);this.q3Readiness.send('send-throw',data);throw error;}
   }
   const fields=protocolMetadata(data);
   observer.arm();observer.record('pre-send',fields);
   const forwarded=args.map(arg=>typeof arg!=='function'?arg:function(...values){
    observer.record('send-callback',{...fields,error:!!values[0]});return Reflect.apply(arg,this,values);
   });
   try{const result=super.send(data,...forwarded);observer.record('send-return',fields);capture.send('send-return',data);this.q3Readiness.send('send-return',data);return result;}
   catch(error){observer.record('send-throw',fields);capture.send('send-throw',data);this.q3Readiness.send('send-throw',data);throw error;}
  }
  close(...args){try{return super.close(...args);}finally{this.q3Transport.stop('socket close invoked');this.q3Capture.dispose();this.q3Readiness.dispose();}}
 };
}
// Instrument the authenticated consumer after its existing transforms. Keep
// protocol routing, debugger policy, terminal propagation and timers intact.
// Explicit fixture usability contract; shared render providers stay unchanged.
function readableFixtureHTML(source){
 const once=(before,after)=>{assert.equal(source.split(before).length,2,'readable fixture seam: '+before);source=source.replace(before,after);};
 once('new Int32Array(memory.buffer,rect,4).set([0,0,8,8])','new Int32Array(memory.buffer,rect,4).set([0,0,320,200])');
 once("'ctrl_set_geom',hwnd,0,0,8,8","'ctrl_set_geom',hwnd,0,0,320,200");
 once("'test_gdi_client_rect_set',hwnd,0,0,8,8","'test_gdi_client_rect_set',hwnd,0,0,320,200");
 once('hwnd,w:8,h:8,clientRect:{w:8,h:8}','hwnd,w:320,h:200,clientRect:{w:320,h:200}');
 once("'glViewport',[0,0,8,8]","'glViewport',[0,0,320,200]");
 once("onPresent:layer=>canvas.getContext('2d').drawImage(layer.canvas,0,0,320,200)","onPresent:layer=>{const ctx=canvas.getContext('2d',{alpha:false});ctx.imageSmoothingEnabled=false;ctx.drawImage(layer.canvas,0,0,320,200)}");
 once(' globalThis.__draw=async()=>{',` let shifted=false;
 const inputOwner={worker:link.worker,module:link.module,endpoint:link.endpointIdentity};
 const sameInputOwner=()=>{check(!globalThis.__generatedError&&wine.running&&!wine._stopped&&wine.renderer===renderer&&wine.guestWorker.link===link&&!link._stopping&&link.worker===inputOwner.worker&&link.module===inputOwner.module&&link.endpointIdentity===inputOwner.endpoint&&link.slot===0,'readable fixture input owner changed');};
 addEventListener('keydown',event=>{if(event.isTrusted&&event.keyCode===13&&!event.repeat){try{sameInputOwner();shifted=true;}catch(e){globalThis.__generatedError=String(e);}}});
 globalThis.__draw=async()=>{`);
 once("  await invoke('glViewport'",`  sameInputOwner();await invoke('glViewport'`);
 once("  await invoke('glColor4f'",`  await invoke('glMatrixMode',[0x1700]);await invoke('glLoadIdentity');
  await invoke('glTranslatef',[shifted?.5:0,0,0].map(f));
  await invoke('glColor4f'`);
 return source;
}
function readableFixtureHandler(generated){
 return (req,res)=>generated.handle(req,new Proxy(res,{get(target,key){
  if(key==='end')return html=>target.end(readableFixtureHTML(html));
  const value=target[key];return typeof value==='function'?value.bind(target):value;
 }}));
}
async function readableFixtureControls(controls,options){
 const transport=require(root+'/scratch/runs/20261108-q3-gl-readiness-gameplay/transport.cjs');
 return require('./q3-input-phase-service.cjs').run({run:async o=>{
  const {evaluate,workers,wait,chain,save,capture,execute,out}=o;
  const moduleHash=[...workers.values()].filter(w=>w.url.includes('guest-worker')&&!w.closed).flatMap(w=>w.scripts).find(s=>s.sha256)?.sha256;
  assert(moduleHash,'actual instantiated module');
  const draw=()=>evaluate('__draw()');await draw();
  const ready=await chain.establishReady({stableMs:10,wait:async()=>{await draw();await wait(10)}});
  save('renderer-readiness.json',ready);await capture('fixture-startup');
  const c=JSON.parse(fs.readFileSync(out+'/fixture-startup-capture.json'));
  transport.publish(out+'/fixture-startup-review.json',{...c,review:'Separately reviewed readable fixture.'});
  const request=transport.request(out,'positive-'+process.env.RENDER_BACKEND,{action:'key',key:'Enter',holdMs:100,waitMs:0,label:'positive',reviewRef:'fixture-startup'},50000);
  request.catch(()=>{});
  while(!fs.existsSync(out+'/commands/0.json'))await wait(5);
  await transport.consume(out,0,execute);assert((await request).ok);
  const shot=JSON.parse(fs.readFileSync(out+'/positive-capture.json'));
  const parent=path.dirname(process.env.Q3_EXECUTION_BOUNDARY_OUT);
  fs.writeFileSync(parent+'/readable-input-review-ready.json',JSON.stringify({capture:shot,image:out+'/positive.png'}),{flag:'wx'});
  const due=Date.now()+55000;
  while(!fs.existsSync(parent+'/readable-input-model-review.json')){
   assert(!fs.existsSync(parent+'/caller-cancelled.json'),'terminal owner');
   assert(Date.now()<due,'separate input image review unavailable');await wait(20);
  }
  const review=JSON.parse(fs.readFileSync(parent+'/readable-input-model-review.json'));
  assert.equal(review.sha256,shot.sha256);assert.deepEqual(review.identity,shot.identity);
  assert.equal(review.clear,true);assert.equal(review.distinct,true);assert(review.review?.trim());
  save('positive-control.json',{passed:true,actualProductionWorkers:true,ready,exactObserverAdmissionTransport:true});
  save('local-controls.json',{passed:true,positive:true,rows:[],originalLaunches:0,independentCPUAndRenderModule:moduleHash,budgetsUnchanged:true});
 }},options);
}
function prearmInputObservation() {
 let attempts=0,done=false;
 const timer=setInterval(()=>{
  if(done)return;
  if(++attempts>6000){done=true;clearInterval(timer);console.debug('Q3_BOUND_INPUT',JSON.stringify({kind:'arm-timeout'}));return;}
  const apps=typeof runningApps==='undefined'?[]:runningApps;
  const app=apps.find(a=>a.name==='quake3_demo'),w=app?.wine,r=w?.renderer,c=document.getElementById('screen');
  if(!w?.guestWorker?.link || !w.memory?.buffer || !r || r.canvas!==c || typeof RegionMap==='undefined')return;
  done=true;clearInterval(timer);
  try {
   const link=w.guestWorker.link,module=link.module,worker=link.worker,memory=w.memory;
   globalThis.__q3BoundInput=globalThis.Q3InputObserver.install({enabled:true,renderer:r,canvas:c,document,memory,
    diBase:RegionMap.BASE.DI_MOUSE_INPUT_STATE,relative:()=>app.relativeMouse===true,
    owner:()=>w.running&&!w._stopped&&w.renderer===r&&w.memory===memory&&w.guestWorker?.link===link&&link.module===module&&link.worker===worker&&!link._stopping,
    emit:row=>console.debug('Q3_BOUND_INPUT',JSON.stringify(row))});
   addEventListener('pagehide',()=>globalThis.__q3BoundInput.stop('pagehide'),{once:true});
  }catch(error){console.debug('Q3_BOUND_INPUT',JSON.stringify({kind:'arm-error',error:String(error)}));}
 },10);
 addEventListener('pagehide',()=>{done=true;clearInterval(timer);},{once:true});
}
function inputObservationPageSource(){
 return read('lib/q3-input-observer.js').toString()+'\n('+prearmInputObservation.toString()+')();\n';
}
function composeInputObservation(source){
 if(process.env.Q3_BOUND_INPUT_OBSERVATION!=='1')return source;
 const once=(before,after)=>{assert.equal(source.split(before).length,2,'unique Q3 bound input seam: '+before);source=source.replace(before,after);};
 once("Object.defineProperty(globalThis,'GLRenderHost'",
  "${require(root+'/tools/q3-current-module.cjs').inputObservationPageSource()}Object.defineProperty(globalThis,'GLRenderHost'");
 once(' const dispatch=async receipt=>{\n markDispatch();',
  ` const dispatch=async receipt=>{
 const observerBegin=await evaluate('globalThis.__q3BoundInput.begin('+JSON.stringify({id:c.id,label:c.label,previous:latest})+')');
 assert.equal(observerBegin?.active,true,'original observer prearmed');save('input-'+c.id+'-observer-begin.json',observerBegin);
 markDispatch();`);
 once("save('latest.json',latest);console.log('CAPTURE '+label);",
  `save('latest.json',latest);
 const observed=await evaluate('globalThis.__q3BoundInput.image('+JSON.stringify(latest)+')');
 assert.equal(observed?.active,true,'original observer image binding');save(label+'-observer.json',observed);
 console.log('CAPTURE '+label);`);
 return source;
}
function composeStartupDiagnostics(source){
  source=composeTerminalCleanup(source);
  const once=(before,after)=>{
    assert.equal(source.split(before).length,2,'unique startup diagnostic seam: '+before);
    source=source.replace(before,after);
  };
  // This script runs in the existing pre-navigation init script. It observes
  // page-owned progress and errors from launch without diagnostic requests.
  if(process.env.Q3_READINESS_WIRE==='1')once("Object.defineProperty(globalThis,'GLRenderHost'",`(()=>{
 let count=0;const report=(kind,detail)=>{if(count++<240)try{console.debug('Q3_READINESS_PASSIVE',JSON.stringify({kind,pageNow:performance.now(),detail}));}catch{}};
 addEventListener('error',e=>report('error',String(e.message).slice(0,1024)));
 addEventListener('unhandledrejection',e=>report('rejection',String(e.reason).slice(0,1024)));
 const timer=setInterval(()=>{try{report('progress',{generatedReady:globalThis.__generatedReady===true,generatedError:globalThis.__generatedError==null?null:String(globalThis.__generatedError).slice(0,2048),apps:(typeof runningApps==='undefined'?[]:runningApps).slice(0,4).map(a=>({name:a.name,running:a.wine?.running,stopped:a.wine?._stopped,guestWorker:!!a.wine?.guestWorker,slice:a.wine?._workerLastSlice})),log:document.getElementById('log')?.textContent?.slice(-2048)});}catch(e){report('observer-error',String(e));}if(count>=240)clearInterval(timer);},250);
 addEventListener('pagehide',()=>clearInterval(timer),{once:true});
})();Object.defineProperty(globalThis,'GLRenderHost'`);
  if(process.env.Q3_INPUT_SERVICE_REVIEW==='1')once("await require('./local-controls.cjs').run(",
    "await require(root+'/tools/q3-current-module.cjs').readableFixtureControls(require('./local-controls.cjs'),");
  once("require('./generated.cjs').handle","require(root+'/tools/q3-current-module.cjs').readableFixtureHandler(require('./generated.cjs'))");
  once("await capture(c.label);","if(process.env.LOCAL_PRODUCTION_FIXTURE)await evaluate('__draw()');await capture(c.label);");
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
 ws?.q3Readiness?.settlement(meta,outcome);
 if(!startupRecording)return;
 startupRecord('settlement',{requestId:meta.requestId,method:meta.method,sessionId:meta.sessionId,outcome});
 if(meta.method==='Page.navigate'&&outcome==='resolve'){startupRecording=false;startupRequests.clear();startupTargets.clear();ws?.q3Transport?.stop('navigation settled');}
}
function send(method,params={},sessionId,captureProbe=null)`);
  once('new Promise((resolve,reject)=>{const timer=setTimeout',
    "new Promise((resolvePromise,rejectPromise)=>{let settled=false;const settle=(outcome,fn,value)=>{if(!settled){settled=true;startupSettlement(meta,outcome);}return fn(value);};const resolve=value=>settle('resolve',resolvePromise,value),reject=error=>settle('reject',rejectPromise,error);const timer=setTimeout");
  once('screenshotCompletion.request(meta,params);try{',
    "startupOutbound(meta,params);screenshotCompletion.request(meta,params);ws?.q3Readiness?.request(meta,params);ws?.q3Capture?.request(meta,params);try{");
  once('const v=JSON.parse(msg.data);screenshotCompletion.receive(v,pending.get(v.id));',
    'startupInbound(msg.data);const v=JSON.parse(msg.data);screenshotCompletion.receive(v,pending.get(v.id));ws?.q3Capture?.receive(msg,v,pending.get(v.id));ws?.q3Readiness?.receive(msg,v,pending.get(v.id));');
  once("screenshotCompletion.deadline(meta);pending.delete(n);",
    "screenshotCompletion.deadline(meta);ws?.q3Capture?.deadline(meta);if(startupRecording)startupRecord('deadline',{requestId:n,method:meta.method,sessionId:meta.sessionId});pending.delete(n);");
  once("screenshotCompletion.transport(event);if(!closing)",
    "screenshotCompletion.transport(event);if(startupRecording)startupRecord('transport',{event});if(!closing)");
  once('screenshotCompletion.sendFailed(meta,error);observeTerminal(error);',
    "if(startupRecording)startupRecord('send-error',{requestId:meta.requestId,method:meta.method,sessionId:meta.sessionId});screenshotCompletion.sendFailed(meta,error);observeTerminal(error);");
  source=composeInputObservation(source);
  if(process.env.Q3_MENU_CONSUMPTION_CONFIG){
    assert.equal(process.env.Q3_BOUND_INPUT_OBSERVATION,'1','menu observation requires bound input');
    const config=JSON.parse(fs.readFileSync(process.env.Q3_MENU_CONSUMPTION_CONFIG));
    assert.equal(config.version,require('./q3-menu-consumption.cjs').version);
    source=require('./q3-menu-consumption.cjs').compose(source,config);
  }
  return source;
}
// Q3 owns this policy; shared lifecycle providers only perform bounded kernel
// containment and observe child exit plus stdio closure. Cancellation is an
// explicit owner action, and can never reclassify an earlier runtime failure.
function composeTerminalCleanup(source){
 const once=(before,after)=>{assert.equal(source.split(before).length,2,'unique Q3 terminal cleanup seam: '+before);source=source.replace(before,after);};
 once('let terminalFailure=null,commandWorkEnd=null;',
  'let terminalFailure=null,commandWorkEnd=null,plannedCancellation=false;');
 once("terminalFailure=Error('Q3 terminal UNKNOWN; no replay: '+reason);",
  "plannedCancellation=reason==='owning launch transport cancelled'&&process.env.Q3_NATIVE_PHASE===undefined;\n terminalFailure=Error('Q3 terminal UNKNOWN; no replay: '+reason);");
 once("if(method!=='Browser.close')checkTerminal();",
  "if(method!=='Browser.close'||!plannedCancellation)checkTerminal();");
 once("requestClose:()=>ws?.readyState===1?send('Browser.close'):Promise.reject(Error('endpoint unavailable'))",
  "requestClose:()=>{if(terminalFailure&&!plannedCancellation)throw terminalFailure;return ws?.readyState===1?send('Browser.close'):Promise.reject(Error('endpoint unavailable'));}");
 once("})().catch(async e=>{save('first-browser-failure.json'",
  "})().catch(async e=>{observeTerminal(e);save('first-browser-failure.json'");
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
function composeFixtureObserverCaller(source){
  // Extend the authenticated generated caller, keeping the retained source
  // immutable and every existing checkpoint/lifecycle transform in force.
  const seam="   ready=helper['observe_checkpoint'](task,session,session.remote);save('cancellation-native-checkpoint',ready)";
  assert.equal(source.split(seam).length,2,'owning fixture observer seam');
  const observation=`   observer=runpy.run_path(str(ROOT/'tools/q3-phase-observer.py'))
   code=observer['remote_wrapper'](ROOT,R,'cancellation')
   save('fixture-actual-wrapper',dict(code=code,sha256=H(code.encode()),cwd='/home/user'))
   v=json.loads(session.remote('fixture-first-image-observation',code,60))
   save('fixture-first-image',v)
   data=gzip.decompress(c.download(v['download']))
   assert len(data)==v['size'] and H(data)==v['sha256'],'downloaded fixture SHA'
   (BASE/'fixture-startup.png').write_bytes(data)
   print('FIXTURE_REVIEW_READY',flush=True)
   due=time.monotonic()+55
   while not (R/'fixture-separate-model-review.json.gz').exists():
    session.check();assert time.monotonic()<due,'separate fixture model review unavailable';time.sleep(.02)
   review=load('fixture-separate-model-review')
   session.check()
   code=observer['remote_wrapper'](ROOT,R,'cancellation','publish_review',review)
   save('fixture-reviewed-publication',json.loads(session.remote('fixture-model-review-publication',code,10)))
   plan=observer['layout'](ROOT,R,'cancellation')
   code="from pathlib import Path\\nimport time,json,gzip,hashlib\\np=Path("+repr(str(plan['prepared']))+");due=time.monotonic()+55\\nwhile not (p/'readable-input-review-ready.json').exists():\\n assert time.monotonic()<due,'input image unavailable'\\n assert not (p/'caller-cancelled.json').exists(),'cancelled'\\n assert not (p/'runtime/first-browser-failure.json').exists(),'native failure'\\n time.sleep(.02)\\nv=json.loads((p/'readable-input-review-ready.json').read_bytes());data=Path(v['image']).read_bytes();assert hashlib.sha256(data).hexdigest()==v['capture']['sha256'];q=p/'readable-input.png.review.gz';q.write_bytes(gzip.compress(data,mtime=0));print(json.dumps(dict(ready=v,download=str(q),size=len(data),sha256=hashlib.sha256(data).hexdigest())))"
   v=json.loads(session.remote('readable-input-image-observation',code,60));save('readable-input-image',v)
   data=gzip.decompress(c.download(v['download']));assert len(data)==v['size'] and H(data)==v['sha256']
   (BASE/'fixture-input.png').write_bytes(data);print('INPUT_REVIEW_READY',flush=True)
   due=time.monotonic()+50
   while not (R/'input-separate-model-review.json.gz').exists():
    session.check();assert time.monotonic()<due,'separate input model review unavailable';time.sleep(.02)
   review=load('input-separate-model-review');session.check()
   assert review['sha256']==v['sha256'] and review['identity']==v['ready']['capture']['identity'] and review['clear'] and review['distinct']
   code="from pathlib import Path\\nimport json\\np=Path("+repr(str(plan['prepared']))+");assert not (p/'caller-cancelled.json').exists();assert not (p/'runtime/first-browser-failure.json').exists();v=json.loads((p/'readable-input-review-ready.json').read_bytes());review="+repr(review)+";assert review['sha256']==v['capture']['sha256'] and review['identity']==v['capture']['identity'];(p/'readable-input-model-review.json').write_text(json.dumps(review));print(json.dumps(dict(published=True)))"
   save('readable-input-reviewed-publication',json.loads(session.remote('readable-input-review-publication',code,10)))
`;
  source=source.replace(seam,observation+seam);
  cp.execFileSync('python3',['-B','-c',"import ast,sys;compile(ast.parse(sys.stdin.read()),'<q3-fixture-observer-caller>','exec')"],{input:source});
  return source;
}
function prepare(destination,{inputs=[]}={}){
  assert.equal(arguments.length<=2,true);const options=arguments[1]??{};
  assert(Object.keys(options).every(k=>['inputs','checkpointObserverVersion','caller','foreignClosureVersion','nativeLifecycleVersion','inputObservationVersion','menuConsumptionVersion'].includes(k)),'explicit supported preparation options');
  const checkpoint=options.checkpointObserverVersion!==undefined;
  assert(checkpoint||options.caller===undefined,'caller requires explicit checkpoint observer version');
  destination=path.resolve(destination);assert(!fs.existsSync(destination),'fresh task-owned destination required');
  const validation={};
  if(checkpoint)validation.checkpointObserverVersion=options.checkpointObserverVersion;
  if(options.foreignClosureVersion!==undefined)validation.foreignClosureVersion=options.foreignClosureVersion;
  const version=validate(validation);
  const lifecycle=options.nativeLifecycleVersion===undefined?undefined:require('./q3-versioned-native-lifecycle.cjs');
  if(options.inputObservationVersion!==undefined){
    assert.equal(options.inputObservationVersion,'q3-bound-input-v1','explicit Q3 observation version');
    assert(lifecycle,'input observation requires owning native lifecycle');
    version.inputObservationVersion=options.inputObservationVersion;
  }
  let generated=[];
  let menuConfigPath;
  if(options.menuConsumptionVersion!==undefined){
    const menu=require('./q3-menu-consumption.cjs');
    assert.equal(options.menuConsumptionVersion,menu.version,'explicit passive menu observation');
    assert.equal(options.inputObservationVersion,'q3-bound-input-v1','passive menu command/image binding');
    const bytes=menu.compile(),base=path.dirname(destination);
    const file=path.join(base,'passive-menu.wasm');menuConfigPath=path.join(base,'passive-menu.json');
    assert(!fs.existsSync(file)&&!fs.existsSync(menuConfigPath),'fresh observation artifacts');
    // Decode the installed canonical UI member in place; retain offsets only.
    const qvmSites=JSON.parse(cp.execFileSync('python3',['-B','-c',`import zipfile,struct,json,hashlib
p='test/binaries/candidates/quake-3-arena-demo-installer/installed/demoq3/pak0.pk3'
with zipfile.ZipFile(p) as z:b=z.read('vm/ui.qvm')
assert hashlib.sha256(b).hexdigest()=='6903548472c2d95898c71c979304e07fbe966e9db2d22db5d9c1ee4f8ddeb88f'
o=32;sites={};active=False
for pc in range(74762):
 op=b[o];start=o-32;o+=1
 if op==3:active=pc in [4375,34954,34912,13938,45971]
 if pc in [4375,34954,34912,13938,45971,35444] or active and op==4:sites[start]={'pc':pc,'op':op}
 if op in [3,4,8,9,34] or 11<=op<=26:o+=4
 elif op==33:o+=1
print(json.dumps(sites))`],{cwd:root}).toString());
    const config={version:menu.version,url:'/'+path.relative(root,file),sha256:hash(bytes),size:bytes.length,qvmSites,
      ...(process.env.Q3_STARTUP_CONSOLE==='1'?{startupConsole:true}:{})};
    fs.writeFileSync(file,bytes,{flag:'wx',mode:0o444});fs.writeFileSync(menuConfigPath,JSON.stringify(config),{flag:'wx',mode:0o444});
    for(const name of ['tools/q3-menu-consumption.cjs',path.relative(root,file),path.relative(root,menuConfigPath)])version.files.push(pin(name,read(name)));
    version.menuConsumptionVersion=menu.version;
  }
  if(lifecycle){
    assert(checkpoint&&options.foreignClosureVersion!==undefined,'native lifecycle requires explicit checkpoint and foreign versions');
    assert.equal(options.nativeLifecycleVersion,lifecycle.version,'explicit native lifecycle version');
    assert.equal(path.basename(destination),'prepared','owning lifecycle prepared directory');
    generated=lifecycle.generate(destination,options.nativeLifecycleVersion);
    // Q3 alone batches the authenticated custody journal at its existing
    // durable executable-CONT barriers. Shared providers remain immutable.
    const custodyAdapter='tools/q3-startup-custody.py';
    version.files.push(pin(custodyAdapter,read(custodyAdapter)));
    version.files.push(pin('tools/q3-provider-upload.py',read('tools/q3-provider-upload.py')));
    version.files.push(pin('tools/q3-phase-observer.py',read('tools/q3-phase-observer.py')));
    generated=generated.map(file=>{
      const before='from native_kernel_custody import supervise,identity';
      assert.equal(file.source.split(before).length,2,'unique Q3 native custody import');
      let source=file.source.replace(before,
        "from native_kernel_custody import identity\nimport runpy\nsupervise=runpy.run_path(str(root/'tools/q3-startup-custody.py'))['supervise']");
      if(options.inputObservationVersion!==undefined&&file.path.endsWith('/original/runtime.py')){
        assert.equal(source.split('os.environ.update(').length,2,'original observer environment seam');
        source=source.replace('os.environ.update(',"os.environ.update(Q3_BOUND_INPUT_OBSERVATION='1',");
        if(menuConfigPath)source=source.replace('os.environ.update(',"os.environ.update(Q3_MENU_CONSUMPTION_CONFIG="+JSON.stringify(menuConfigPath)+",");
        if(menuConfigPath&&process.env.Q3_STARTUP_CONSOLE==='1')source=source.replace('os.environ.update(',"os.environ.update(Q3_READINESS_WIRE='1',");
      }
      if(file.path.endsWith('/cancellation/runtime.py')){
        assert.equal(source.split('os.environ.update(').length,2,'fixture service review environment seam');
        source=source.replace('os.environ.update(',"os.environ.update(Q3_INPUT_SERVICE_REVIEW='1',Q3_READINESS_WIRE='1',");
      }
      return {...file,source};
    });
    version.nativeLifecycleVersion=lifecycle.version;
    // Match the generated runtime boundary and the current staged consumer.
    // Observers consume this sealed layout instead of historical CASE_TAG paths.
    version.phaseLayout=Object.fromEntries(['cancellation','original'].map(phase=>{
      const prepared=path.join(path.dirname(destination),phase,'prepared');
      const runtime=generated.find(file=>file.path===path.relative(root,path.join(prepared,'../runtime.py')));
      assert(runtime?.source.includes("Q3_EXECUTION_BOUNDARY_OUT=str(R/'execution-boundary.jsonl.gz')"),'generated boundary layout');
      return [phase,{prepared:path.relative(root,prepared),output:path.relative(root,path.join(prepared,'runtime')),
        boundary:path.relative(root,path.join(prepared,'execution-boundary.jsonl.gz'))}];
    }));
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
    if(lifecycle)source=composeFixtureObserverCaller(lifecycle.caller(source));
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
  const seal={moduleVersion:version.moduleVersion,...(version.phaseLayout?{phaseLayout:version.phaseLayout}:{}),...(caller?{caller:version.checkpointCaller}:{}),...(runtimeCaller?{runtimeCaller:version.runtimeCaller,foreignClosureVersion:version.foreignClosureVersion,offlinePrepared:true,nativeReady:false}:{}),manifestSHA256:hash(raw),providers:pins.files.length,publishedModuleCommit:cpuCommit,publishedCustodyCommit:custodyCommit,historicalPinset:version.historicalPinset,explainedDrift:version.explainedDrift};
  fs.writeFileSync(path.join(destination,'replacement-pinset-seal.json'),JSON.stringify(seal,null,2),{flag:'wx',mode:0o444});
  return seal;
}
module.exports={composeInputObservation,inputObservationPageSource,prearmInputObservation,readableFixtureHTML,readableFixtureHandler,readableFixtureControls,createReadinessDiagnostics,composeTerminalCleanup,createCaptureDiagnostics,metadataToken,monotonicNs,protocolMetadata,installTransportDiagnostics,SELECTED,validate,prepare,moduleVersion,historical,historicalSHA,cpuCommit,custodyCommit,migration,checkpointObserverVersion,composeCheckpointCaller,composeStartupDiagnostics};
if(require.main===module){
  const args=process.argv.slice(2);assert.equal(args.shift(),'--prepare','explicit preparation only');
  const destination=args.shift(),options={inputs:[]};
  while(args.length){
    const flag=args.shift(),value=args.shift();assert(value,'option value required');
    if(flag==='--input')options.inputs.push(value);
    else if(flag==='--caller'){assert(!options.caller,'duplicate caller');options.caller=value;}
    else if(flag==='--checkpoint-observer-version'){assert(!options.checkpointObserverVersion,'duplicate checkpoint version');options.checkpointObserverVersion=value;}
    else if(flag==='--menu-consumption-version'){assert(!options.menuConsumptionVersion,'duplicate menu version');options.menuConsumptionVersion=value;}
    else if(flag==='--foreign-closure-version'){assert(!options.foreignClosureVersion,'duplicate foreign closure version');options.foreignClosureVersion=value;}
    else if(flag==='--native-lifecycle-version'){assert(!options.nativeLifecycleVersion,'duplicate native lifecycle version');options.nativeLifecycleVersion=value;}
    else if(flag==='--input-observation-version'){assert(!options.inputObservationVersion,'duplicate observation version');options.inputObservationVersion=value;}
    else assert.fail('unsupported preparation flag: '+flag);
  }
  console.log(JSON.stringify(prepare(destination,options)));
}
