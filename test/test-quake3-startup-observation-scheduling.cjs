'use strict';
// Independent production-transport fixture. Never starts a game or sends input.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),Module=require('node:module');
const ROOT=path.resolve(__dirname,'..'),pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=15000){const end=performance.now()+ms;while(!fn()){assert(performance.now()<end,'bounded passive fixture wait');await pause(5);}}
function setupSource(){
  const filename=ROOT+'/tools/quake3-startup-latency-controller.cjs',m=new Module(filename,module);m.filename=filename;m.paths=module.paths;
  m._compile(fs.readFileSync(filename,'utf8')+'\nmodule.exports.SETUP=SETUP;',filename);
  let source=m.exports.SETUP;
  // Paint the genuinely transferred bitmap before closing it. No proxy pixels.
  const once=(a,b)=>{assert.equal(source.split(a).length,2,'production fixture anchor: '+a);source=source.replace(a,b);};
  once('frame.bitmap?.close();',`if(frame.bitmap){const c=document.getElementById('output');c.width=frame.width;c.height=frame.height;c.getContext('2d').drawImage(frame.bitmap,0,0);frame.bitmap.close();}`);
  once('globalThis.fixture={manager,e,memory,frames:0};','globalThis.fixture={manager,e,memory,frames:0,transportFrame:0};');
  once("memoryOffset:buffer,bytes:offset,owner:0,","memoryOffset:buffer,bytes:offset,owner:0,frameToken:++fixture.transportFrame,");
  once('fixtureReady=true;','fixtureReady=true;fixture.drawPromise=fixture.draw();fixture.drawPromise.catch(()=>fixtureFailure=true);');
  return source;
}
async function chromeControls(out){
  const api=require('../tools/quake3-startup-observation-scheduling.cjs'),base=require('../tools/quake3-browser-controller.cjs');
  const {createObserver,hash}=require('../tools/quake3-startup-observer.cjs');
  const {createInventory}=require('../tools/cdp-source-inventory.cjs');
  const save=(name,value)=>fs.writeFileSync(out+'/'+name,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
  const scripts=['region-map.generated','render-worker','gl-command-stream','mem-utils','gpu-backend','gl-compat'];
  const html='<!doctype html><title>Startup scheduling control</title><canvas id="output"></canvas>'+scripts.map(s=>'<script src="/lib/'+s+'.js"></script>').join('');
  save('fixture-http-pin.json',{url:'/scheduling-fixture',sha256:hash(html),bytes:Buffer.byteLength(html),beforeServerStart:true});
  const server=await require('./static-server.js').startStaticServer({root:ROOT,crossOriginIsolated:true,handleRequest(req,res){if(req.url==='/scheduling-fixture'){res.setHeader('Content-Type','text/html');res.end(html);return true;}}});
  const report={originals:0,cases:[],historicalDriverCause:'UNPROVED',historicalDiagnosticDelayCause:'UNPROVED'};
  try{for(const arm of ['minimal','instrumented','written-late']){
    const dir=out+'/'+arm;fs.mkdirSync(dir);const profile=dir+'/profile';
    const chrome=cp.spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--no-first-run','--no-default-browser-check','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--window-size=1024,900','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','pipe','pipe']});
    chrome.stdout.pipe(fs.createWriteStream(dir+'/chrome.stdout.log'));chrome.stderr.pipe(fs.createWriteStream(dir+'/chrome.stderr.log'));
    const joined=new Promise(r=>chrome.once('close',(code,signal)=>r({pid:chrome.pid,code,signal,actualWait:true,stdoutEOF:chrome.stdout.readableEnded,stderrEOF:chrome.stderr.readableEnded})));
    fs.writeFileSync(out+'/browser-pid.json',JSON.stringify({pid:chrome.pid})+'\n');
    const operations=[],sources=[],tasks=[],bindings=[],workers=new Map(),row={arm,sources};report.cases.push(row);
    let c,inventory,error;
    try{
      await until(()=>fs.existsSync(profile+'/DevToolsActivePort'),10000);
      const [port,endpoint]=fs.readFileSync(profile+'/DevToolsActivePort','utf8').trim().split('\n');
      c=api.connection('ws://127.0.0.1:'+port+endpoint,null,createObserver({connectionId:'scheduling-'+arm,emit:r=>{operations.push(r);fs.appendFileSync(out+'/operations.jsonl',JSON.stringify(r)+'\n');}}));await c.ready;
      report.browser??=await c.send('Browser.getVersion');
      const targetId=(await c.send('Target.getTargets')).targetInfos.find(t=>t.type==='page').targetId;
      const session=(await c.send('Target.attachToTarget',{targetId,flatten:true})).sessionId;
      inventory=createInventory({send:c.send,terminal:()=>c.closed});
      const ev=async(expression,s=session)=>{if(error)throw error;inventory.noteEvaluation(s,expression);const r=await c.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},s);assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result?.value;};
      c.event=v=>{
        const p=v.params||{};
        if(v.method==='Runtime.bindingCalled')bindings.push({sessionId:v.sessionId,name:p.name,payload:JSON.parse(p.payload),at:Date.now()});
        if(v.method==='Target.attachedToTarget'&&p.targetInfo.type==='worker'){
          const w={sessionId:p.sessionId,targetId:p.targetInfo.targetId};workers.set(w.sessionId,w);inventory.attach(w.sessionId,w.targetId);
          const t=(async()=>{
            await c.send('Runtime.enable',{},w.sessionId);await c.send('Runtime.addBinding',{name:api.BINDING},w.sessionId);await c.send('Runtime.addBinding',{name:'__q3SchedulingFixture'},w.sessionId);
            await ev(base.GL_OBSERVER,w.sessionId);await ev(api.installation(c,w.sessionId),w.sessionId);
            if(arm==='instrumented'){await c.send('Runtime.addBinding',{name:require('../tools/quake3-startup-task-controller.cjs').BINDING},w.sessionId);await ev(require('../tools/quake3-native-snapshot-latency.cjs').instrumentation(),w.sessionId);}
            // A single real synchronous native wait occurs inside the first
            // ordinary shader query. The fixture does not change its result.
            await ev(`(() => {const get=OffscreenCanvas.prototype.getContext;let waited=false;OffscreenCanvas.prototype.getContext=function(...args){const g=get.apply(this,args);if(g&&/^webgl/.test(args[0])){const old=g.getShaderParameter;g.getShaderParameter=function(...a){if(!waited){waited=true;const start=performance.timeOrigin+performance.now();__q3SchedulingFixture(JSON.stringify({phase:'busy',start}));Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,4300);__q3SchedulingFixture(JSON.stringify({phase:'returned',start,end:performance.timeOrigin+performance.now()}));}return old.apply(this,a);};}return g;};return true;})()`,w.sessionId);
            await c.send('Debugger.enable',{},w.sessionId);await c.send('Runtime.runIfWaitingForDebugger',{},w.sessionId);
          })();tasks.push(t);t.catch(e=>{error??=e;});
        }else if(v.method==='Runtime.executionContextCreated')inventory.contextCreated(v.sessionId,p.context);
        else if(v.method==='Runtime.executionContextsCleared')inventory.contextsCleared(v.sessionId);
        else if(v.method==='Runtime.executionContextDestroyed')inventory.contextsCleared(v.sessionId,p.executionContextId);
        else if(v.method==='Target.detachedFromTarget')inventory.detach(p.sessionId);
        else if(v.method==='Debugger.scriptParsed'&&workers.has(v.sessionId)){
          const t=inventory.inspect(v.sessionId,p).then(r=>sources.push(r));tasks.push(t);t.catch(e=>{error??=e;if(!c.closed)c.abort(e);});
        }
      };
      await c.send('Runtime.enable',{},session);await c.send('Runtime.addBinding',{name:'__q3LatencyEvent'},session);await c.send('Page.enable',{},session);await c.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},session);
      await c.send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/scheduling-fixture'},session);
      const loadEnd=Date.now()+10000;
      for(;;){if(await ev("typeof OpenGLCompat!=='undefined'"))break;assert(Date.now()<loadEnd,'bounded fixture load');await pause(10);}
      await ev(setupSource());
      await until(()=>bindings.some(v=>v.name==='__q3SchedulingFixture'&&v.payload.phase==='busy'));
      const w=[...workers.values()][0],busy=bindings.find(v=>v.name==='__q3SchedulingFixture'&&v.payload.phase==='busy');row.worker=w;
      const requestStart=operations.length;
      if(arm==='written-late'){
        const start=performance.now();await assert.rejects(ev('globalThis.__gltronObserver?.snapshot?.()??null',w.sessionId),/UNKNOWN/);
        assert(c.closed);row.deadlineElapsedMs=performance.now()-start;
        await until(()=>bindings.some(v=>v.name==='__q3SchedulingFixture'&&v.payload.phase==='returned'));
        const terminal=operations.find(v=>v.type==='terminal');assert(terminal);
        const sent=operations.find(v=>v.type==='request'&&v.expression?.sha256===hash('globalThis.__gltronObserver?.snapshot?.()??null'));
        await until(()=>operations.some(v=>v.type==='response'&&v.id===sent.id));
        const late=operations.find(v=>v.type==='response'&&v.id===sent.id);assert(late?.afterTerminal&&late.elapsedMs>3000);
        const count=operations.filter(v=>v.type==='request').length;await assert.rejects(c.send('Browser.getVersion'),/UNKNOWN/);assert.equal(operations.filter(v=>v.type==='request').length,count);
        row.terminalUNKNOWN=true;row.lateReply=late;row.requestsAfterTerminal=operations.filter(v=>v.type==='request'&&v.sequence>terminal.sequence).length;assert.equal(row.requestsAfterTerminal,0);
      }else{
        const notReady=c.startupObservation.read(w.sessionId,{endpointId:1,hwnd:1});assert.equal(notReady.status,'NOT_READY');assert.equal(notReady.workerRequests,0);
        await until(()=>bindings.some(v=>v.name==='__q3SchedulingFixture'&&v.payload.phase==='returned'));
        const returned=bindings.find(v=>v.name==='__q3SchedulingFixture'&&v.payload.phase==='returned');assert(returned.payload.end-returned.payload.start>=4200);
        // The clear/present is genuine but lacks a frontend draw. Complete an
        // ordinary production draw before accepting the passive hint.
        await until(()=>c.startupObservation.read(w.sessionId,{endpointId:1,hwnd:1}).status==='READY');
        assert(await ev('fixtureReady'));assert(!await ev('fixtureFailure'));
        await ev('fixture.drawPromise.then(()=>true)');
        let hint=c.startupObservation.read(w.sessionId,{endpointId:1,hwnd:1});assert.equal(hint.status,'READY',JSON.stringify(hint));row.passive=hint;
        assert.equal(operations.slice(requestStart).filter(v=>v.type==='request'&&v.sessionId===w.sessionId&&v.method==='Runtime.evaluate').length,0,'startup did not poll Worker');
        assert(hint.snapshot.draws>0&&hint.snapshot.transfers>0);
        row.busyDurationMs=returned.payload.end-returned.payload.start;
        // Queue race: genuine page transport admission is visible before its
        // completion. A cached ready record cannot grant an observation then.
        const queue=await ev(`(() => {fixture.queuePromise=fixture.port.request({t:'gl-batch',memoryOffset:0,bytes:0,owner:0,frameToken:++fixture.transportFrame,windows:[{hwnd:1,w:16,h:16,clientRect:{w:16,h:16}}],surfaces:[]});fixture.queuePromise.catch(()=>{});return {pending:fixture.manager.pending.size,sequence:fixture.manager.sequence};})()`);
        assert(queue.pending>0&&queue.sequence>hint.transportId,'actual admitted transport must be newer than cached completion');
        assert.equal(c.startupObservation.read(w.sessionId,{endpointId:1,hwnd:1,...queue}).status,'NOT_READY');
        await ev('fixture.queuePromise.then(()=>true)');row.queueRaceRefused=true;row.actualQueuedTransport=queue;
        const stamp=hint.epochMs;await pause(api.MAX_AGE_MS+30);assert.equal(c.startupObservation.read(w.sessionId,{endpointId:1,hwnd:1}).status,'NOT_READY');assert.equal(hint.epochMs,stamp);row.staleRefused=true;
        // A fresh genuine frame can provide a new hint; receipt time does not
        // restamp an old record. Pixel capture is the actual page compositor.
        await ev('fixture.draw().then(()=>true)');await pause(10);assert.equal(c.startupObservation.read(w.sessionId,{endpointId:1,hwnd:1}).status,'READY');
        const shot=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},session);fs.writeFileSync(dir+'/result-native-frame.png',Buffer.from(shot.data,'base64'));
        const snapshot=await ev('globalThis.__gltronObserver?.snapshot?.()??null',w.sessionId);assert(snapshot.devices.length===1);row.eventualValidSnapshot=true;row.capture=true;
        // Bounded paired workload measures actual perturbation, without a
        // claim that this explains the closed original's timeout.
        const samples=[];for(let n=0;n<12;n++){const start=performance.now();await ev('fixture.draw().then(()=>true)');samples.push(performance.now()-start);}row.drawRoundtripMs=samples;
        row.bindings={total:bindings.length,perCall:bindings.filter(v=>v.name==='__q3TaskTiming').length,completion:bindings.filter(v=>v.name===api.BINDING).length};
        if(arm==='minimal')assert.equal(row.bindings.perCall,0);else assert(row.bindings.perCall>0);
        await Promise.all(tasks);assert(sources.some(v=>v.scriptLanguage==='WebAssembly'&&v.actualBytesFetched&&v.sha256===hash(fs.readFileSync(ROOT+'/build/wine-assembly.wasm'))));assert(sources.some(v=>v.url?.includes('d3d-render-worker.js')&&v.actualBytesFetched));row.actualSourceInventory=true;
        if(arm==='minimal'){
          // Genuine WebGL context loss must invalidate future passive records.
          await ev(`(() => {const c=new OffscreenCanvas(2,2),g=c.getContext('webgl');g.getExtension('WEBGL_lose_context').loseContext();return true;})()`,w.sessionId);
          await pause(50);assert.equal(c.startupObservation.read(w.sessionId,{endpointId:1,hwnd:1}).status,'NOT_READY');row.contextLossRefused=true;
        }else{
          const marker='function q3SchedulingReplacementMarker(){return 1;}\n//# sourceURL=http://fixture/scheduling-marker.js';await ev(marker,w.sessionId);await Promise.all(tasks);
          const source=sources.find(v=>v.sha256===hash(marker));assert(source?.actualBytesFetched,'actual replacement source must be inventoried');
          const replacement=marker.replace('return 1','return 2');await ev(replacement,w.sessionId);await Promise.all(tasks);
          assert(sources.some(v=>v.sha256===hash(replacement)&&v.actualBytesFetched&&v.url===source.url),'changed same-URL source must be actually fetched');
          assert.equal(await ev('q3SchedulingReplacementMarker()',w.sessionId),2);
          await pause(20);await ev('fixture.draw().then(()=>true)');await pause(10);
          assert.equal(c.startupObservation.read(w.sessionId,{endpointId:1,hwnd:1}).status,'NOT_READY');row.actualSourceReplacementRefused=true;
        }
        await ev('fixture.manager.worker.terminate();true');await pause(50);assert.equal(c.startupObservation.read(w.sessionId,{endpointId:1,hwnd:1}).status,'NOT_READY');row.retiredSourceRefused=true;
      }
      await Promise.allSettled(tasks);if(error&&!c.closed)throw error;
    }finally{
      fs.writeFileSync(dir+'/bindings.jsonl',bindings.map(v=>JSON.stringify(v)).join('\n')+'\n');
      save(arm+'/partial-state.json',{...row,lastHint:c?.startupObservation.read([...workers.keys()][0],{endpointId:1,hwnd:1})});
      inventory?.close();if(c&&!c.closed)try{await c.send('Browser.close');}catch{}
      if(chrome.exitCode===null)chrome.kill('SIGTERM');const wait=await joined;assert(wait.stdoutEOF&&wait.stderrEOF);save(arm+'/chrome-wait.json',wait);c?.ws.close();fs.rmSync(profile,{recursive:true,force:true});
    }
  }}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
  report.passed=true;save('scheduling-report.json',report);return report;
}
module.exports={chromeControls,setupSource};
if(require.main===module){
  const {test}=require('node:test');
  test('preparation preserves the genuine frame and production transport',()=>{const s=setupSource();assert(s.includes("port.request({t:'gl-batch'"));assert(s.includes("getContext('2d').drawImage(frame.bitmap"));assert(s.includes('frame.bitmap.close()'));});
  test('composition replaces only startup polling and retains the fixed operation connection',()=>{
    const api=require('../tools/quake3-startup-observation-scheduling.cjs');
    const source=fs.readFileSync(ROOT+'/tools/quake3-browser-controller.cjs','utf8'),composed=api.compose(source);
    assert(!composed.includes("renderers.map(w=>evaluate('globalThis.__gltronObserver?.snapshot?.()??null'"));
    assert(composed.includes('c.startupObservation.read('));
    assert(!composed.includes('__q3TaskTiming'),'optional per-native-call bindings are absent');
    const begin=source.indexOf('function connection('),end=source.indexOf('\nasync function release(',begin);
    assert(begin>0&&end>begin);assert(composed.includes(source.slice(begin,end)),'before-send timer and permanent UNKNOWN implementation stays exact');
    for(const guard of ['sourceInventory.noteEvaluation','sourceInventory.inspect','await hostBootstrap(','await chain.prepareStartup(','physicalAll'])assert(composed.includes(guard),guard);
  });
  test('a first initialized frame is never suppressed by the clear-frame throttle',()=>{
    const api=require('../tools/quake3-startup-observation-scheduling.cjs'),vm=require('node:vm'),records=[];
    let ms=10,draws=0;const gl={getShaderParameter(){throw Error('observer must not query GL');}};
    class Canvas {getContext(){return gl;}addEventListener(){}}
    const env={OffscreenCanvas:Canvas,self:{postMessage(){}},performance:{timeOrigin:1000,now:()=>ms},__gltronObserver:{snapshot:()=>({draws,frontendDraws:draws,frontendPresents:1,transfers:1})},[api.BINDING]:s=>records.push(JSON.parse(s))};
    const context=vm.createContext(env);vm.runInContext(api.instrumentation('fixture-nonce'),context);
    vm.runInContext("new OffscreenCanvas().getContext('webgl');self.postMessage({t:'render-event',endpointId:1,message:{t:'frame',frame:{hwnd:1,frameToken:1}}});self.postMessage({t:'render-done',transportId:1});",context);
    ms++;draws++;
    vm.runInContext("self.postMessage({t:'render-event',endpointId:1,message:{t:'frame',frame:{hwnd:1,frameToken:2}}});self.postMessage({t:'render-done',transportId:2});",context);
    assert.deepEqual(records.filter(r=>r.kind==='complete').map(r=>r.snapshot.draws),[0,1]);
  });
  test('passive records cannot survive source, realm, endpoint, queue or clock changes',()=>{
    const {createRegistry,BINDING,MAX_AGE_MS}=require('../tools/quake3-startup-observation-scheduling.cjs');
    let ms=10,epoch=100010;const r=createRegistry({now:()=>ms,epochNow:()=>epoch});
    const event=(method,params,sessionId='session')=>r.observe({method,params,sessionId});
    event('Target.attachedToTarget',{sessionId:'session',targetInfo:{targetId:'target',type:'worker'}});
    event('Runtime.executionContextCreated',{context:{id:7,uniqueId:'realm'}});
    r.install('session','nonce-one');
    const record={nonce:'nonce-one',kind:'complete',sequence:1,transportId:3,endpointId:2,frameToken:4,hwnd:99,generation:1,epochMs:epoch,
      snapshot:{draws:1,transfers:1,frontendDraws:1,frontendPresents:1,contexts:[{id:1,hwnd:99,current:true,deviceObserved:true,software:false}]}};
    const emit=v=>event('Runtime.bindingCalled',{name:BINDING,executionContextId:7,payload:JSON.stringify(v)});
    emit(record);assert.equal(r.read('session',{endpointId:2,hwnd:99,pending:0,sequence:3}).status,'READY');
    for(const changed of [{endpointId:3},{hwnd:98},{pending:1},{sequence:4}]){
      const v=r.read('session',{endpointId:2,hwnd:99,pending:0,sequence:3,...changed});assert.equal(v.status,'NOT_READY');assert.equal(v.workerRequests,0);
    }
    ms+=MAX_AGE_MS+1;epoch+=MAX_AGE_MS+1;assert.equal(r.read('session',{endpointId:2,hwnd:99}).status,'NOT_READY');
    // A late delivery preserves the original producer time, even though it
    // receives a new host receipt timestamp.
    emit({...record,sequence:2,transportId:4});assert.equal(r.read('session',{endpointId:2,hwnd:99}).status,'NOT_READY');
    emit({...record,sequence:3,transportId:5,epochMs:epoch+5000});assert.equal(r.read('session',{endpointId:2,hwnd:99}).status,'NOT_READY');
    event('Runtime.executionContextDestroyed',{executionContextId:7});
    event('Runtime.executionContextCreated',{context:{id:7,uniqueId:'replacement'}});
    assert.equal(r.read('session',{endpointId:2,hwnd:99}).status,'NOT_READY');
    r.install('session','nonce-two');
    emit({...record,sequence:1,epochMs:epoch});assert.equal(r.read('session',{endpointId:2,hwnd:99}).status,'NOT_READY','delayed binding from recycled numeric context must refuse');
    emit({...record,nonce:'nonce-two',sequence:1,epochMs:epoch});assert.equal(r.read('session',{endpointId:2,hwnd:99}).status,'READY');
    event('Debugger.scriptParsed',{url:'http://fixture/lib/d3d-render-worker.js',hash:'old',isLiveEdit:false});
    event('Debugger.scriptParsed',{url:'http://fixture/lib/d3d-render-worker.js',hash:'new',isLiveEdit:true});
    assert.equal(r.read('session',{endpointId:2,hwnd:99}).status,'NOT_READY');
    event('Target.detachedFromTarget',{sessionId:'session'});assert.equal(r.read('session',{endpointId:2,hwnd:99}).status,'NOT_READY');
  });
}
