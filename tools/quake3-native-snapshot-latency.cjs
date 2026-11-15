"use strict";
// Passive causal diagnostics, composed over the released helper and observers.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),Module=require('node:module'),cp=require('node:child_process');
const base=require('./quake3-browser-controller.cjs'),task=require('./quake3-startup-task-controller.cjs'),latency=require('./quake3-startup-latency-controller.cjs'),vis=require('./quake3-visibility-controller.cjs');
const {hash,createObserver}=require('./quake3-startup-observer.cjs');
const ROOT=path.resolve(__dirname,'..'),RUN='scratch/runs/20261115-quake3-latency-after-census-repair/',FILE='./quake3-native-snapshot-latency.cjs';
const once=task.replaceOnce,pause=ms=>new Promise(r=>setTimeout(r,ms));let nextConnection=0;
function instrumentation(){
  let s=task.instrumentation();
  s=once(s,"announce&&kind!=='snapshot'&&n<=16","announce&&kind!=='snapshot'");
  s=once(s,'const s=begin(kind,null,null,false);','const s=begin(kind,null,null,true);');
  s=once(s,"emit({...s,phase:'end',ms,epochMs:performance.timeOrigin+ms,exception});",
    "emit({...s,phase:'end',ms,epochMs:performance.timeOrigin+ms,exception,nativeStartMs:s.ms});");
  s=once(s,"const ms=now();emit({...s,phase:'stats',ms,epochMs:performance.timeOrigin+ms,stats:globalThis.__q3Task.stats()});return value;",'return value;');
  return s;
}
function metadata(raw){
  const row=task.metadata(raw);
  if(raw.phase==='end'){assert(Number.isFinite(raw.nativeStartMs)&&raw.nativeStartMs<=raw.ms,'invalid native start');row.nativeStartMs=raw.nativeStartMs;}
  return row;
}
function connection(url,out,externalObserver){
  if(!out)return base.connection(url,externalObserver);
  const connectionId=process.pid+':native-latency:'+(++nextConnection),rows=[],sessions=new Map(),contexts=new Map(),ordinals=new Map(),pending=new Set(),unsafe=new Set();
  const write=row=>{const v={connectionId,hostMs:performance.now(),hostEpochMs:performance.timeOrigin+performance.now(),...row};rows.push(v);try{fs.appendFileSync(out+'/latency.jsonl',JSON.stringify(v)+'\n');}catch{};};
  const observer=externalObserver||createObserver({connectionId,emit:v=>fs.appendFileSync(out+'/operations.jsonl',JSON.stringify(v)+'\n')});
  const c=base.connection(url,observer),send=c.send,wire=c.ws.send;let invocation=null;
  const identity=(sessionId,contextId)=>{const cs=contexts.get(sessionId),context=contextId===undefined&&cs?.size===1?[...cs.values()][0]:cs?.get(contextId);return {sessionId:sessionId??null,targetId:sessions.get(sessionId)??null,contextId:context?.id??null,contextUniqueId:context?.uniqueId??null};};
  c.ws.send=function(data){
    const beforeSendMs=performance.now(),beforeSendEpochMs=performance.timeOrigin+beforeSendMs;
    let result;try{result=Reflect.apply(wire,this,[data]);}finally{
      const afterSendMs=performance.now(),v=JSON.parse(data);
      if(v.method==='Runtime.evaluate'&&typeof v.params?.expression==='string'&&v.params.expression.includes(latency.SNAPSHOT)){
        const id=identity(v.sessionId),ordinal=(ordinals.get(v.sessionId)||0)+1;ordinals.set(v.sessionId,ordinal);
        const overlap=pending.has(v.sessionId);pending.add(v.sessionId);if(v.params.expression!==latency.SNAPSHOT||overlap)unsafe.add(v.sessionId);
        write({kind:'helper-send',...id,requestId:v.id,ordinal,overlap,correlationUnsafe:unsafe.has(v.sessionId),enqueueMs:invocation?.ms??null,enqueueEpochMs:invocation?.epochMs??null,beforeSendMs,beforeSendEpochMs,afterSendMs,expressionSha256:hash(v.params.expression),exactSnapshot:v.params.expression===latency.SNAPSHOT});
      }
    }return result;
  };
  c.send=function(...args){const prior=invocation,ms=performance.now();invocation={ms,epochMs:performance.timeOrigin+ms};try{return Reflect.apply(send,c,args);}finally{invocation=prior;}};
  const originalHandler=c.ws.onmessage;c.ws.onmessage=null;
  const seen=new WeakSet(),receive=event=>{
    if(seen.has(event))return;seen.add(event);const hostMs=performance.now();let v;try{v=JSON.parse(event.data);}catch{return;}
    const p=v.params||{};
    if(v.method==='Target.attachedToTarget')sessions.set(p.sessionId,p.targetInfo.targetId);
    if(v.method==='Runtime.executionContextCreated'){
      const cs=contexts.get(v.sessionId)||new Map();cs.set(p.context.id,{id:p.context.id,uniqueId:p.context.uniqueId});contexts.set(v.sessionId,cs);
    }
    if(v.method==='Runtime.executionContextDestroyed')contexts.get(v.sessionId)?.delete(p.executionContextId);
    if(v.method==='Runtime.executionContextsCleared')contexts.delete(v.sessionId);
    if(v.method==='Runtime.bindingCalled'&&p.name===task.BINDING){
      try{write({kind:'worker',...identity(v.sessionId,p.executionContextId),sample:metadata(JSON.parse(p.payload)),receivedMs:hostMs});}
      catch(error){write({kind:'invalid-binding',sessionId:v.sessionId,error:String(error)});}
    }
    if(v.method==='Debugger.paused'||v.method==='Debugger.resumed')write({kind:'inspector',...identity(v.sessionId),method:v.method,receivedMs:hostMs});
    if(Number.isInteger(v.id)){
      const q=rows.findLast(r=>r.kind==='helper-send'&&r.requestId===v.id);
      if(q){write({kind:'wire-response',...identity(v.sessionId),requestId:v.id,receivedMs:hostMs,receivedEpochMs:performance.timeOrigin+hostMs,afterTerminal:c.closed});}
    }
  };
  c.ws.addEventListener('message',receive);c.ws.onmessage=function(event){receive(event);try{return Reflect.apply(originalHandler,this,[event]);}finally{let v;try{v=JSON.parse(event.data);}catch{}if(Number.isInteger(v?.id)){const q=rows.findLast(r=>r.kind==='helper-send'&&r.requestId===v.id);if(q)pending.delete(q.sessionId);}}};
  c.latencyRows=rows;return c;
}
function attribute(operations,rows){
  const results=[],groups=new Map(),requests=new Map(),responses=new Map(),lifecycles=new Map(),wires=new Map();
  const key=v=>JSON.stringify([v.connectionId,v.sessionId,v.targetId,v.contextUniqueId]),opKey=v=>v.connectionId+':'+(v.requestId??v.id);
  for(const v of operations){if(v.type==='request')requests.set(opKey(v),v);if(v.type==='response')responses.set(opKey(v),v);if(v.type==='lifecycle'){const a=lifecycles.get(v.connectionId)||[];a.push(v);lifecycles.set(v.connectionId,a);}}
  for(const v of rows){
    if(v.kind==='wire-response')wires.set(opKey(v),v);
    if(v.kind!=='worker')continue;
    const k=key(v),g=groups.get(k)||{own:[],entries:[],snapshots:new Map(),pairs:new Map(),spans:[],invalid:false,overflow:false};groups.set(k,g);g.own.push(v);
    const p=v.sample;
    if(p.phase==='overflow')g.overflow=true;
    if(p.kind==='snapshot'){
      if(p.phase==='entry')g.entries.push(v);
      const a=g.snapshots.get(p.seq)||[];a.push({...p,targetId:v.targetId,sessionId:v.sessionId});g.snapshots.set(p.seq,a);
    }else if(p.phase==='begin'||p.phase==='end'){
      const k=p.kind+':'+p.seq,pair=g.pairs.get(k)||{begins:[],ends:[],phases:[]};pair.phases.push(p.phase);pair[p.phase==='begin'?'begins':'ends'].push(p);g.pairs.set(k,pair);
    }
  }
  for(const g of groups.values())for(const pair of g.pairs.values()){
    if(pair.begins.length!==1||pair.ends.length>1||(pair.ends.length&&pair.phases.join(',')!=='begin,end')){g.invalid=true;continue;}
    const begin=pair.begins[0];
    if(!pair.ends.length){g.spans.push({kind:begin.kind,seq:begin.seq,announcedEpochMs:begin.epochMs,nativeStartEpochMs:null,endEpochMs:null,nativeDurationMs:null,completion:'UNKNOWN'});continue;}
    const end=pair.ends[0],origin=end.epochMs-end.ms;
    if(!Number.isFinite(end.nativeStartMs)||end.nativeStartMs<begin.ms||end.nativeStartMs>end.ms||Math.abs((begin.epochMs-begin.ms)-origin)>.001){g.invalid=true;continue;}
    g.spans.push({kind:begin.kind,seq:begin.seq,announcedEpochMs:begin.epochMs,nativeStartEpochMs:origin+end.nativeStartMs,endEpochMs:end.epochMs,nativeDurationMs:end.ms-end.nativeStartMs,entryEmissionMs:end.nativeStartMs-begin.ms,exception:end.exception,completion:'returned'});
  }
  for(const q of rows.filter(v=>v.kind==='helper-send')){
    const request=requests.get(opKey(q)),response=responses.get(opKey(q)),g=groups.get(key(q)),entry=g?.entries[q.ordinal-1],spans=g?.spans||[];
    const result={requestId:q.requestId,connectionId:q.connectionId,sessionId:q.sessionId,targetId:q.targetId,contextUniqueId:q.contextUniqueId,ordinal:q.ordinal,helperMs:Number.isFinite(q.enqueueMs)&&Number.isFinite(q.beforeSendMs)?q.beforeSendMs-q.enqueueMs:null,wireSendMs:q.afterSendMs-q.beforeSendMs,preEntryMs:null,bodyMs:null,deliveryMs:null,nativeOccupiedMs:null,inspectorDispatchMs:null,reason:null};results.push(result);
    result.pendingNative=spans.filter(v=>v.completion==='UNKNOWN'&&v.announcedEpochMs<=q.beforeSendEpochMs+2);
    if(!request||!response||!entry||q.overlap||q.correlationUnsafe||!q.contextUniqueId||![q.enqueueMs,q.beforeSendMs,q.afterSendMs,q.beforeSendEpochMs].every(Number.isFinite)||q.enqueueMs>q.beforeSendMs||q.beforeSendMs>q.afterSendMs||request.sessionId!==q.sessionId||request.targetId!==q.targetId||g.invalid||g.overflow||rows.some(v=>v.kind==='invalid-binding')){result.reason='missing/ambiguous/overflow/invalid identity or incomplete response';continue;}
    const parts=g.snapshots.get(entry.sample.seq);
    if(parts.map(v=>v.phase).join(',')!=='entry,body-entry,body-complete,begin,end'){result.reason='missing/duplicate/out-of-order snapshot samples';continue;}
    const r=task.attribute({request,response,events:parts,lifecycle:lifecycles.get(q.connectionId)||[]});
    if(r.bodyMs===null){result.reason=r.reason;continue;}
    if(entry.sample.epochMs-q.beforeSendEpochMs < -2){result.reason='cross-clock pre-entry ordering exceeds 2ms tolerance';continue;}
    result.preEntryMs=entry.sample.epochMs-q.beforeSendEpochMs;result.bodyMs=r.bodyMs;result.wrapperMs=r.wrapperMs;result.deliveryMs=r.completionToResponseMs;result.epochToleranceMs=2;
    const wire=wires.get(opKey(q));result.wireArrivalToHelperMs=wire?response.monotonicMs-wire.receivedMs:null;result.elapsedMs=response.elapsedMs;result.afterTerminal=response.afterTerminal;result.reason='measured same live context; pre-entry includes inspector and transport';
    const start=q.beforeSendEpochMs,end=entry.sample.epochMs;
    result.nativeSpans=spans.filter(v=>v.completion==='returned'&&v.nativeStartEpochMs<=end+2&&v.endEpochMs>=start-2).map(v=>({...v,definitelyEnclosesSend:v.nativeStartEpochMs<=start-2&&v.endEpochMs>=start+2}));
    const intervals=result.nativeSpans.filter(v=>v.kind.startsWith('gl-')).map(v=>[Math.max(start,v.nativeStartEpochMs),Math.min(end,v.endEpochMs)]).filter(v=>v[1]>v[0]).sort((a,b)=>a[0]-b[0]);
    let total=0,last=-Infinity;for(const [a,b] of intervals){total+=Math.max(0,b-Math.max(a,last));last=Math.max(last,b);}result.nativeOccupiedMs=total;
    result.limitation='Observed synchronous WebGL intervals only, with 2ms cross-clock uncertainty; no GPU execution or driver-internal root-cause claim. Post-exit-marker time includes final binding emission, inspector, transport and host dispatch; not pure wire time. Async WASM envelopes are not continuous native occupancy.';
  }return results;
}
function compose(source){
  let s=vis.compose(source);
  s=once(s,"'scratch/runs/20261115-quake3-source-inventory/']","'scratch/runs/20261115-quake3-source-inventory/','"+RUN+"']");
  s=once(s,'c=connection(url);await c.ready;',"c=require('"+FILE+"').connection(url,out);await c.ready;");
  s=once(s,"await c.send('Runtime.evaluate',{expression:GL_OBSERVER},sessionId);", "await c.send('Runtime.evaluate',{expression:GL_OBSERVER},sessionId);await c.send('Runtime.addBinding',{name:'"+task.BINDING+"'},sessionId);{const expr=require('"+FILE+"').instrumentation();sourceInventory.noteEvaluation(sessionId,expr);await c.send('Runtime.evaluate',{expression:expr},sessionId);}");
  return s+"\nmodule.exports.connection=(url)=>require('"+FILE+"').connection(url,process.env.QUAKE3_TEST_OUT);\n";
}
function load(filename,source){const m=new Module(filename,module);m.filename=filename;m.paths=module.paths;m._compile(source,filename);return m.exports;}
function controller(){const filename=ROOT+'/tools/quake3-browser-controller.cjs';return load(filename,compose(fs.readFileSync(filename,'utf8')));}
function qualificationSource(source){
  let s=vis.qualificationSource(source);
  s=once(s,"const controller=require('../tools/quake3-visibility-controller.cjs').controller();","const controller=require('../tools/quake3-native-snapshot-latency.cjs').controller();");
  s=once(s,"await c.send('Runtime.enable',{},sessionId);await c.send('Debugger.enable',{},sessionId);", "await c.send('Runtime.enable',{},sessionId);await c.send('Runtime.addBinding',{name:'"+task.BINDING+"'},sessionId);for(const expression of [controller.GL_OBSERVER,require('../tools/quake3-native-snapshot-latency.cjs').instrumentation()]){sourceInventory.noteEvaluation(sessionId,expression);await c.send('Runtime.evaluate',{expression},sessionId);}await c.send('Debugger.enable',{},sessionId);");
  return s;
}
function visibility(){
  const file=ROOT+'/tools/quake3-visibility-controller.cjs';let s=fs.readFileSync(file,'utf8');
  s=once(s,"const ORIGINAL_RUN='scratch/runs/20261115-quake3-source-inventory/';","const ORIGINAL_RUN='"+RUN+"';");
  for(const name of ['controller','compose','qualificationSource'])s=once(s,vis[name].toString(),'function '+name+'(...args){return require("'+FILE+'").'+name+'(...args);}');
  s=once(s,'const pins=JSON.parse(fs.readFileSync(out+\'/pins.json\'));assertPublicQualification(pins);', 'const pins=JSON.parse(fs.readFileSync(out+\'/pins.json\'));assertPublicQualification(pins);require("'+FILE+'").assertCausalQualification(pins);');
  s=once(s,"authorization:'20261115 published causal source-inventory correction; one registered original',productionCorrection:true", "authorization:'20261115 materially changed causal diagnostics; one fresh registered original',productionCorrection:false,materiallyChangedCausalDiagnostics:true");
  return load(file,s);
}
function readRows(file){return fs.existsSync(file)?fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];}
function assertCausalQualification(pins){
  const q=pins.latencyQualification;assert(q,'causal qualification missing');
  const read=p=>{assert(p.path.startsWith(RUN+'causal-chrome/')&&!p.path.includes('..'));const b=fs.readFileSync(ROOT+'/'+p.path);assert.equal(hash(b),p.sha256);return JSON.parse(b);};
  const report=read(q.report),tested=read(q.pins),post=read(q.postflight);
  assert(report.passed&&report.originals===0&&report.meaningfulCausalEvidence&&report.currentNativeGL&&report.inspectorPauseControl&&report.delayedQueue&&report.slowBody&&report.delayedDelivery);
  for(const p of tested.files){assert.equal(hash(fs.readFileSync(ROOT+'/'+p.path)),p.sha256);assert(pins.files.some(v=>v.path===p.path&&v.sha256===p.sha256));}
  for(const p of tested.hostFiles){assert.equal(hash(fs.readFileSync(p.path)),p.sha256);assert(pins.hostFiles.some(v=>v.path===p.path&&v.sha256===p.sha256));}
  assert(!post.pinDrift.length&&!post.httpMismatches.length&&post.requestsAfterTerminal===0&&post.allPIDsAbsent&&post.profileAbsent);
  const folder=ROOT+'/'+RUN+'causal-chrome';for(const name of ['native-wait.json','watchdog-wait.json','outer-child-wait.json']){const w=JSON.parse(fs.readFileSync(folder+'/'+name));assert(w.exit===0&&w.actualWait&&w.stdoutEOF&&w.stderrEOF);assert(!fs.existsSync('/proc/'+w.pid));}
  const released=JSON.parse(fs.readFileSync(folder+'/supervisor-complete.json'));assert(released.heavyReleased&&released.bothEOF&&released.actualChildWaits);
  const native=JSON.parse(fs.readFileSync(folder+'/native-dependencies.json'));assert(native.nativeFiles.length&&native.nativeFiles.every(v=>v.prelaunchPinned)&&native.processes.every(v=>!fs.existsSync('/proc/'+v.pid)));
  return true;
}
module.exports={RUN,instrumentation,metadata,connection,attribute,compose,controller,qualificationSource,visibility,assertCausalQualification,readRows};

async function causalChrome(out){
  fs.mkdirSync(out,{recursive:true});vis.installServer(out);
  const file=ROOT+'/tools/quake3-startup-latency-controller.cjs',fixture=load(file,fs.readFileSync(file,'utf8')+'\nmodule.exports.SETUP=SETUP;');
  const scripts=['region-map.generated','render-worker','gl-command-stream','mem-utils','gpu-backend','gl-compat'];
  const html='<!doctype html><title>Q3 causal latency fixture</title>'+scripts.map(s=>'<script src="/lib/'+s+'.js"></script>').join('');
  fs.writeFileSync(out+'/fixture-http-pin.json',JSON.stringify({url:'/latency-fixture',bytes:Buffer.byteLength(html),sha256:hash(html),beforeServerStart:true})+'\n',{flag:'wx'});
  const server=await require('../test/static-server.js').startStaticServer({root:ROOT,crossOriginIsolated:true,handleRequest(req,res){if(req.url==='/latency-fixture'){res.setHeader('Content-Type','text/html');res.end(html);return true;}}});
  const report={originals:0,cases:[],meaningfulCausalEvidence:false,passed:false};
  try{for(const name of ['ordinary-native-gl','queued-native-wait','slow-body','delayed-delivery','inspector-paused']){
    const dir=out+'/'+name;fs.mkdirSync(dir);const profile=dir+'/profile';
    const chrome=cp.spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--no-first-run','--no-default-browser-check','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--window-size=1024,900','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','pipe','pipe']});
    chrome.stdout.pipe(fs.createWriteStream(dir+'/chrome.stdout.log',{flags:'wx'}));chrome.stderr.pipe(fs.createWriteStream(dir+'/chrome.stderr.log',{flags:'wx'}));
    const joined=new Promise(r=>chrome.once('close',(code,signal)=>r({pid:chrome.pid,code,signal,actualWait:true,stdoutEOF:chrome.stdout.readableEnded,stderrEOF:chrome.stderr.readableEnded})));
    fs.writeFileSync(out+'/browser-pid.json',JSON.stringify({pid:chrome.pid})+'\n');
    let c,inventory;const tasks=[],inventoryRows=[],row={name,scriptSources:inventoryRows};report.cases.push(row);
    try{
      const active=profile+'/DevToolsActivePort';await until(()=>fs.existsSync(active),10000);
      const [port,endpoint]=fs.readFileSync(active,'utf8').trim().split('\n');c=connection('ws://127.0.0.1:'+port+endpoint,out);await c.ready;
      row.browser=await c.send('Browser.getVersion');const workers=new Map(),publications=[];let loaded=false;
      inventory=require('./cdp-source-inventory.cjs').createInventory({send:c.send,terminal:()=>c.closed});
      const targetId=(await c.send('Target.createTarget',{url:'about:blank'})).targetId,session=(await c.send('Target.attachToTarget',{targetId,flatten:true})).sessionId;
      const ev=async(expression,s=session)=>{inventory.noteEvaluation(s,expression);const r=await c.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},s);assert(!r.exceptionDetails,'fixture expression exception');return r.result?.value;};
      c.event=v=>{
        const p=v.params||{};
        if(v.method==='Page.loadEventFired'&&v.sessionId===session)loaded=true;
        if(v.method==='Runtime.bindingCalled'&&p.name===latency.BINDING)publications.push({sessionId:v.sessionId,...JSON.parse(p.payload)});
        if(v.method==='Target.attachedToTarget'&&p.targetInfo.type==='worker'){
          const w={sessionId:p.sessionId,targetId:p.targetInfo.targetId};workers.set(w.sessionId,w);inventory.attach(w.sessionId,w.targetId);
          const t=(async()=>{await c.send('Runtime.enable',{},w.sessionId);await c.send('Runtime.addBinding',{name:task.BINDING},w.sessionId);await ev(base.GL_OBSERVER,w.sessionId);
            if(name==='slow-body')await ev("(()=>{const old=__gltronObserver.snapshot;__gltronObserver.snapshot=function(...args){Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,3400);return Reflect.apply(old,this,args);};return true;})()",w.sessionId);
            await ev(instrumentation(),w.sessionId);await c.send('Debugger.enable',{},w.sessionId);await c.send('Runtime.runIfWaitingForDebugger',{},w.sessionId);})();tasks.push(t);t.catch(()=>{});
        }else if(v.method==='Runtime.executionContextCreated')inventory.contextCreated(v.sessionId,p.context);
        else if(v.method==='Runtime.executionContextsCleared')inventory.contextsCleared(v.sessionId);
        else if(v.method==='Runtime.executionContextDestroyed')inventory.contextsCleared(v.sessionId,p.executionContextId);
        else if(v.method==='Target.detachedFromTarget')inventory.detach(p.sessionId);
        else if(v.method==='Debugger.scriptParsed'&&workers.has(v.sessionId)){
          const t=inventory.inspect(v.sessionId,p).then(r=>{inventoryRows.push(r);});tasks.push(t);t.catch(()=>{});
        }
      };
      await c.send('Runtime.enable',{},session);await c.send('Runtime.addBinding',{name:latency.BINDING},session);await c.send('Page.enable',{},session);
      await c.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},session);
      await c.send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/latency-fixture'},session);await until(()=>loaded,10000);
      const setup=once(fixture.SETUP,'})().catch(()=>{fixtureFailure=true;});return true;',"})().catch(()=>{fixtureFailure=true;});return fixturePromise.then(()=>{if(fixtureFailure)throw Error('fixture setup failed');return true;});");
      await ev(setup);await Promise.allSettled(tasks);assert.equal(workers.size,1);const w=[...workers.values()][0];row.identity=w;
      assert(publications.some(v=>v.phase==='publication'),'ordinary frame missing');
      if(name==='ordinary-native-gl'){const before=c.latencyRows.filter(v=>v.kind==='worker'&&v.sample.kind.startsWith('gl-')&&v.sample.phase==='begin').length;await ev('fixture.draw().catch(()=>{});true');await until(()=>c.latencyRows.filter(v=>v.kind==='worker'&&v.sample.kind.startsWith('gl-')&&v.sample.phase==='begin').length>before,1000);}else{await ev('fixture.draw().catch(()=>{});true');await until(()=>publications.filter(v=>v.phase==='publication').length>=2,10000);}
      if(name==='queued-native-wait'){
        await ev("setTimeout(()=>__q3Task.call('calibration',Atomics.wait,Atomics,[new Int32Array(new SharedArrayBuffer(4)),0,0,3400]),0);true",w.sessionId);
        await until(()=>c.latencyRows.some(v=>v.kind==='worker'&&v.sessionId===w.sessionId&&v.sample.kind==='calibration'&&v.sample.phase==='begin'),1000);
      }
      if(name==='delayed-delivery'){
        const receive=c.ws.onmessage;c.ws.onmessage=function(event){const v=JSON.parse(event.data);const q=c.latencyRows.find(r=>r.kind==='helper-send'&&r.requestId===v.id&&r.exactSnapshot);if(q)setTimeout(()=>receive.call(this,event),3400);else receive.call(this,event);};
      }
      // An idle Worker pauses on its next task; submit the single snapshot before
      // waiting for the passive paused event, then resume that same request.
      if(name==='inspector-paused')await c.send('Debugger.pause',{},w.sessionId);
      const response=ev(latency.SNAPSHOT,w.sessionId).then(value=>({value}),error=>({error:String(error)}));
      if(name==='inspector-paused'){
        await until(()=>c.latencyRows.some(v=>v.kind==='inspector'&&v.method==='Debugger.paused'),1000);
        await pause(150);await c.send('Debugger.resume',{},w.sessionId);
      }
      const outcome=await response;if(name==='ordinary-native-gl'&&!c.closed)await until(()=>publications.filter(v=>v.phase==='publication').length>=2,10000);row.terminal=c.closed;row.error=outcome.error??null;
      if(['queued-native-wait','slow-body','delayed-delivery'].includes(name)){assert(c.closed&&outcome.error?.includes('UNKNOWN'));await pause(700);}
      else{assert(!c.closed&&!outcome.error);row.publicGL=outcome.value.devices;}
      await Promise.allSettled(tasks);
      const ops=readRows(out+'/operations.jsonl');row.results=attribute(ops,c.latencyRows);row.samples=c.latencyRows.filter(v=>v.kind==='worker').length;
      assert.equal(row.results.length,1,'one exact snapshot, no evaluation polling loop');assert.notEqual(row.results[0].bodyMs,null);
      const r=row.results[0];
      if(name==='queued-native-wait'){assert(r.preEntryMs>3000&&r.bodyMs<100);assert(r.nativeSpans.some(v=>v.kind==='calibration'&&v.nativeDurationMs>3000));report.delayedQueue=true;}
      if(name==='slow-body'){assert(r.bodyMs>3000&&r.preEntryMs<100);report.slowBody=true;}
      if(name==='delayed-delivery'){assert(r.deliveryMs>3000&&r.bodyMs<100&&r.preEntryMs<100);row.wireResponse=c.latencyRows.find(v=>v.kind==='wire-response');assert(row.wireResponse.receivedMs<c.latencyRows.find(v=>v.kind==='helper-send').beforeSendMs+100);report.delayedDelivery=true;}
      if(name==='inspector-paused'){assert(c.latencyRows.some(v=>v.kind==='inspector'&&v.method==='Debugger.resumed'));const resume=ops.find(v=>v.type==='request'&&v.connectionId===r.connectionId&&v.method==='Debugger.resume');assert(resume);const entry=c.latencyRows.find(v=>v.kind==='worker'&&v.sample.kind==='snapshot'&&v.sample.phase==='entry');row.inspectorScheduling={preEntryMs:r.preEntryMs,entryBeforeResume:entry.sample.epochMs<resume.startedAt-2,entryAfterResume:entry.sample.epochMs>resume.startedAt+2,internalDispatchMs:null};report.inspectorPauseControl=true;}
      if(name==='ordinary-native-gl'){
        assert(r.wireArrivalToHelperMs>=0&&r.wireArrivalToHelperMs<100,'passive wire ingress must precede helper dispatch');
        const gl=c.latencyRows.filter(v=>v.kind==='worker'&&v.sample.kind==='gl-getShaderParameter'&&v.sample.phase==='end');assert(gl.length>=2);
        const begins=new Map(c.latencyRows.filter(v=>v.kind==='worker'&&v.sample.phase==='begin').map(v=>[v.sample.seq,v.sample]));const emission=c.latencyRows.filter(v=>v.kind==='worker'&&v.sample.phase==='end'&&begins.has(v.sample.seq)).map(v=>v.sample.nativeStartMs-begins.get(v.sample.seq).ms);row.entryEmissionCost={intervals:emission.length,totalMs:emission.reduce((a,b)=>a+b,0),maximumMs:Math.max(0,...emission),limitation:'Actual entry-emission intervals only; not an upper bound on inspector or host perturbation.'};
        row.nativeGL=gl.map(v=>({kind:v.sample.kind,nativeDurationMs:v.sample.ms-v.sample.nativeStartMs}));row.currentGLScheduling={preEntryMs:r.preEntryMs,observedNativeOverlapMs:r.nativeOccupiedMs,overlapSpans:r.nativeSpans.filter(v=>v.kind.startsWith('gl-')),continuousDriverInternalMs:null};
        assert(inventoryRows.some(v=>v.scriptLanguage==='WebAssembly'&&v.actualBytesFetched&&v.sha256===hash(fs.readFileSync(ROOT+'/build/wine-assembly.wasm'))));
        assert(inventoryRows.some(v=>v.url?.includes('/lib/d3d-render-worker.js')&&v.actualBytesFetched&&v.sha256===hash(fs.readFileSync(ROOT+'/lib/d3d-render-worker.js'))));
        report.currentNativeGL=true;
      }
    }finally{
      inventory?.close();if(c&&!c.closed)try{await c.send('Browser.close');}catch{}
      if(chrome.exitCode===null)chrome.kill('SIGTERM');const wait=await joined;row.chromeWait=wait;assert(wait.actualWait&&wait.stdoutEOF&&wait.stderrEOF);
      fs.writeFileSync(dir+'/chrome-wait.json',JSON.stringify(wait)+'\n',{flag:'wx'});c?.ws.close();fs.rmSync(profile,{recursive:true,force:true});
    }
  }}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
  report.meaningfulCausalEvidence=report.currentNativeGL&&report.inspectorPauseControl&&report.delayedQueue&&report.slowBody&&report.delayedDelivery;
  report.passed=!!report.meaningfulCausalEvidence;fs.writeFileSync(out+'/causal-report.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});return report;
}
async function until(predicate,ms){const deadline=performance.now()+ms;while(!predicate()){assert(performance.now()<deadline,'bounded passive event wait');await pause(5);}}
module.exports.causalChrome=causalChrome;
if(require.main===module){
  const [mode,out]=process.argv.slice(2);assert(['causal-chrome','qualified','original'].includes(mode));assert(path.resolve(out).startsWith(ROOT+'/'+RUN));
  const watchdog=JSON.parse(fs.readFileSync(out+'/watchdog-armed.json'));assert(watchdog.independent&&fs.existsSync('/proc/'+watchdog.pid)&&watchdog.deadline*1000>Date.now());
  assert.equal(JSON.parse(fs.readFileSync(out+'/heavy-lock.json')).pid,process.ppid,'actual independent supervisor must own runtime');
  Promise.resolve(mode==='causal-chrome'?causalChrome(out):mode==='qualified'?visibility().qualified(out):visibility().original(out)).catch(error=>{console.error(error);process.exitCode=1;});
}
