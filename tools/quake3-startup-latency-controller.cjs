'use strict';
// Diagnostic fixtures only. Never launches an original or changes its helper.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const helper = require('./quake3-browser-controller.cjs');
const {createObserver, hash} = require('./quake3-startup-observer.cjs');
const SNAPSHOT = 'globalThis.__gltronObserver?.snapshot?.()??null';
const BINDING = '__q3LatencyEvent';
const phases = new Set(['entry','body-entry','body-complete','complete','exception',
  'task-entry','task-complete','compile-entry','compile-complete','publication','batch-complete']);
const GL_METHODS=['compileShader','linkProgram','getShaderParameter','getProgramParameter','drawArrays','drawElements','getError','clear','flush'];
for(const name of GL_METHODS)
  for(const phase of ['entry','complete','exception'])phases.add('gl-'+name+'-'+phase);
const pause = ms => new Promise(r => setTimeout(r, ms));

// Only explicitly allowed scalar metadata survives the binding. No GL values,
// command buffers, guest memory, script text or exception strings are logged.
function timingEvent(v) {
  assert(v && phases.has(v.phase), 'unknown timing phase');
  assert(Number.isSafeInteger(v.seq) && v.seq >= 0, 'invalid timing sequence');
  assert(Number.isFinite(v.ms) && Number.isFinite(v.epochMs), 'invalid real clock');
  return {phase:v.phase, seq:v.seq, ms:v.ms, epochMs:v.epochMs};
}
function instrumentation({bodyDelayMs = 0} = {}) {
  assert([0, 3400].includes(bodyDelayMs), 'only named bounded fixture delay');
  return `(() => {
    const original=globalThis.__gltronObserver.snapshot;
    let seq=0;
    const mark=(phase,n,ms=performance.now())=>{try{${BINDING}(JSON.stringify({phase,seq:n,ms,epochMs:performance.timeOrigin+ms}));}catch(_){}};
    globalThis.__q3Latency={mark,spin(ms){const end=performance.now()+ms;while(performance.now()<end){};}};
    if(typeof OffscreenCanvas!=='undefined'){
      const get=OffscreenCanvas.prototype.getContext,seen=new WeakSet();let calls=0;
      OffscreenCanvas.prototype.getContext=function(...args){
        const gl=get.apply(this,args);
        if(gl&&/^webgl/.test(args[0])&&!seen.has(gl)){
          seen.add(gl);
          for(const name of ${JSON.stringify(GL_METHODS)}){
            const fn=gl[name];if(typeof fn==='function')gl[name]=function(...a){
              const n=++calls;mark('gl-'+name+'-entry',n);
              try{const value=fn.apply(this,a);mark('gl-'+name+'-complete',n);return value;}
              catch(error){mark('gl-'+name+'-exception',n);throw error;}
            };
          }
        }return gl;
      };
    }
    globalThis.__gltronObserver.snapshot=function(...args){
      const n=++seq;mark('entry',n);
      try {
        // Deliberate fixture cost is outside the original snapshot body.
        if(${bodyDelayMs})globalThis.__q3Latency.spin(${bodyDelayMs});
        const begin=performance.now(),value=original.apply(this,args),end=performance.now();
        // Emit both samples after the call, keeping binding/JSON overhead out
        // of the measured original body. Receipt time is not execution time.
        mark('body-entry',n,begin);mark('body-complete',n,end);
        mark('complete',n);return value;
      } catch(error){mark('exception',n);throw error;}
    };
    return true;
  })()`;
}
function attribute({request, response, events, lifecycle = []}) {
  assert(request?.expression?.sha256 === hash(SNAPSHOT), 'exact snapshot operation required');
  assert(response?.id === request.id, 'response operation changed');
  assert(response.sessionId === request.sessionId && response.targetId === request.targetId && response.sessionMatches,
    'response identity changed');
  assert(!response.expressionException && response.protocolErrorCode === null, 'not a successful snapshot');
  assert.equal(response.resultType,'object','snapshot did not return an object');
  const invalidated = lifecycle.some(v => v.sequence > request.sequence && v.sequence < response.sequence &&
    (v.sessionId === request.sessionId || v.targetId === request.targetId) &&
    /detached|Destroyed|Cleared|Crashed/i.test(v.method));
  assert(!invalidated, 'target or context invalidated while pending');
  const matched = events.filter(e => e.sessionId === request.sessionId);
  const entries = matched.filter(e => e.phase === 'entry');
  if (!entries.length) return {attribution:'unproved', reason:'no in-target entry/completion timestamps',
    elapsedFromSendMs:response.elapsedMs, late:response.afterTerminal, queueMs:null, bodyMs:null};
  assert.equal(entries.length, 1, 'ambiguous operation entry');
  const n=entries[0].seq, one=phase=>{
    const xs=matched.filter(e=>e.seq===n && e.phase===phase);assert.equal(xs.length,1,'missing/duplicate '+phase);return xs[0];
  };
  const entry=one('entry'), begin=one('body-entry'), end=one('body-complete'), complete=one('complete');
  assert(entry.ms<=begin.ms && begin.ms<=end.ms && end.ms<=complete.ms, 'nonmonotonic body');
  const queueMs=entry.epochMs-request.startedAt;
  const completionToResponseMs=response.at-complete.epochMs;
  // Host Date.now() and Worker timeOrigin+now share the epoch but are separately
  // sampled. Keep raw values and an explicit 2ms tolerance, never clamp or shift.
  assert(queueMs>=-2 && completionToResponseMs>=-2, 'clock-domain mismatch');
  return {attribution:'measured fixture only', elapsedFromSendMs:response.elapsedMs,
    queueMs, bodyMs:end.ms-begin.ms, wrapperMs:complete.ms-entry.ms,
    injectedWrapperMs:begin.ms-entry.ms, completionToResponseMs, epochToleranceMs:2,
    entryEpochMs:entry.epochMs, completionEpochMs:complete.epochMs,
    late:response.afterTerminal, identity:{targetId:request.targetId,sessionId:request.sessionId}};
}
function historical(rows, id = 1574) {
  const request=rows.find(r=>r.type==='request' && r.id===id);
  const response=rows.find(r=>r.type==='response' && r.id===id);
  const terminal=rows.find(r=>r.type==='terminal' && r.terminal?.trigger?.id===id);
  assert(request && response && terminal, 'missing original boundary');
  const after=rows.filter(r=>r.type==='request' && r.sequence>terminal.sequence);
  assert.equal(after.length,0,'original route sent after UNKNOWN');
  return {request, response, terminal:terminal.terminal, requestsAfterTerminal:after.length,
    ...attribute({request,response,events:[],lifecycle:rows.filter(r=>r.type==='lifecycle')}),
    elapsedAfterTerminalMs:response.monotonicMs-terminal.terminal.monotonicMs};
}

// A small production-transport WebGL workload; shared memory is used only by
// the ordinary GL command stream fixture. No game/process is created.
const SETUP = `(() => {globalThis.fixtureReady=false;globalThis.fixtureFailure=false;
  globalThis.fixturePromise=(async()=>{
    if(!crossOriginIsolated)throw Error('isolated fixture required');
    const module=await WebAssembly.compile(await(await fetch('/build/wine-assembly.wasm')).arrayBuffer());
    const sigs=(await(await fetch('/lib/host-import-sigs.generated.json')).json()).sigs;
    const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),host={memory};
    for(const [name,sig] of Object.entries(sigs))host[name]=sig.results?.length?()=>0:()=>{};
    const e=(await WebAssembly.instantiate(module,{host})).exports;e.d3dim_worker_init(0x400000);
    const manager=new RenderWorker.Manager({module,memory,sigs,imageBase:0x400000,sourceVersion:'q3-latency-fixture',
      reclaimHeap:head=>e.d3d_render_adopt_free_list(head)});
    globalThis.fixture={manager,e,memory,frames:0};await manager.ready;
    const port=manager.createEndpoint({api:'gl',backend:'webgl'});await port.ready;fixture.port=port;
    port.addEventListener('message',ev=>{if(ev.data.t==='frame'){
      const frame=ev.data.frame||ev.data;fixture.frames++;
      const ms=performance.now();${BINDING}(JSON.stringify({phase:'publication',seq:fixture.frames,ms,epochMs:performance.timeOrigin+ms}));
      frame.bitmap?.close();
    }});
    const buffer=e.guest_to_wasm(e.guest_alloc(2048))>>>0;
    const float=x=>{const b=new ArrayBuffer(4);new DataView(b).setFloat32(0,x,true);return new Uint32Array(b)[0];};
    fixture.batch=async records=>{
      let offset=0;const v=new DataView(memory.buffer);
      for(const {name,args=[],aux=0,vertices} of records){
        if(vertices){
          const bytes=32+vertices.length*4,at=buffer+offset;
          new Uint8Array(memory.buffer,at,bytes).fill(0);v.setUint32(at,bytes,true);
          v.setUint32(at+4,GLCommandStream.PACKED_DRAW_OPCODE,true);v.setUint32(at+8,4,true);
          v.setUint32(at+20,vertices.length*4,true);v.setUint32(at+24,offset+32,true);
          v.setUint32(at+28,GLCommandStream.FLAG_POINTER_COPY,true);
          new Float32Array(memory.buffer,at+32,vertices.length).set(vertices);offset+=bytes;continue;
        }
        const stackBytes=(args.length+1)*4,bytes=32+stackBytes,at=buffer+offset;
        new Uint8Array(memory.buffer,at,bytes).fill(0);v.setUint32(at,bytes,true);
        v.setUint32(at+4,OpenGLCompat.CALL_INDEX[name],true);v.setUint32(at+8,aux,true);v.setUint32(at+12,stackBytes,true);
        args.forEach((x,i)=>v.setUint32(at+36+i*4,x,true));offset+=bytes;
      }
      const result=await port.request({t:'gl-batch',memoryOffset:buffer,bytes:offset,owner:0,
        windows:[{hwnd:1,w:16,h:16,clientRect:{w:16,h:16}}],surfaces:[]});
      const ms=performance.now();${BINDING}(JSON.stringify({phase:'batch-complete',seq:fixture.frames,ms,epochMs:performance.timeOrigin+ms}));
      return result;
    };
    const created=await fixture.batch([{name:'wglCreateContext',aux:1}]);if(!created.value)throw Error('WGL context missing');
    await fixture.batch([{name:'wglMakeCurrent',aux:1,args:[1,created.value]},
      {name:'glViewport',args:[0,0,16,16]}, {name:'glClearColor',args:[float(1),0,0,float(1)]},
      {name:'glClear',args:[0x4000]},{name:'gpuPresent'}]);
    const vertices=[[-1,-1],[1,-1],[0,1]].flatMap(([x,y])=>[x,y,0,0,1,0,1,0,0,0,0,1,0,0,1,0,1,0,1]);
    fixture.draw=()=>fixture.batch([{vertices},{name:'gpuPresent'}]);
    if(fixture.frames!==1)throw Error('ordinary publication missing');fixtureReady=true;
  })().catch(()=>{fixtureFailure=true;});return true;
})()`;

async function chromeControls(out) {
  out=path.resolve(out);fs.mkdirSync(out,{recursive:true});
  const watchdog=JSON.parse(fs.readFileSync(out+'/watchdog-armed.json'));
  const heavy=JSON.parse(fs.readFileSync(out+'/heavy-lock.json'));
  assert(watchdog.independent&&Number.isInteger(watchdog.pid)&&fs.existsSync('/proc/'+watchdog.pid)&&watchdog.deadline*1000>Date.now()+10000,
    'live prearmed independent deadline watchdog required');
  assert.equal(heavy.pid,process.ppid,'current supervisor must own the heavy lock');
  const root=path.resolve(__dirname,'..'),write=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
  const log=(n,v)=>fs.appendFileSync(path.join(out,n),JSON.stringify(v)+'\n');
  const scripts=['region-map.generated','render-worker','gl-command-stream','mem-utils','gpu-backend','gl-compat'];
  const html='<!doctype html><title>Q3 latency diagnostic fixture</title>'+scripts.map(s=>'<script src="/lib/'+s+'.js"></script>').join('');
  write('fixture-http-pin.json',{url:'/latency-fixture',bytes:Buffer.byteLength(html),sha256:hash(html),beforeServerStart:true});
  const report={originals:0,productionEdits:false,cases:[],startedAt:new Date().toISOString()};
  const server=await require('../test/static-server.js').startStaticServer({root,crossOriginIsolated:true,
    handleRequest(req,res){if(req.url==='/latency-fixture'){res.setHeader('Content-Type','text/html');res.end(html);return true;}}});
  server.prependListener('request',(req,res)=>{
    const crypto=require('node:crypto'),h=crypto.createHash('sha256');let bytes=0;
    const add=b=>{if(b){b=Buffer.isBuffer(b)?b:Buffer.from(b);h.update(b);bytes+=b.length;}};
    const wr=res.write,en=res.end;res.write=function(b){add(b);return wr.apply(this,arguments);};res.end=function(b){add(b);return en.apply(this,arguments);};
    res.once('finish',()=>log('http.jsonl',{url:req.url,status:res.statusCode,bytes,sha256:h.digest('hex')}));
  });
  const profile=out+'/profile',p=cp.spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--no-first-run',
    '--disable-dev-shm-usage','--enable-unsafe-swiftshader','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','pipe','pipe']});
  const stdout=fs.createWriteStream(out+'/chrome.stdout.log',{flags:'wx'}),stderr=fs.createWriteStream(out+'/chrome.stderr.log',{flags:'wx'});
  p.stdout.pipe(stdout);p.stderr.pipe(stderr);
  const joined=new Promise(r=>p.once('close',(code,signal)=>r({pid:p.pid,code,signal,actualWait:true,stdoutEOF:p.stdout.readableEnded,stderrEOF:p.stderr.readableEnded})));
  write('browser-pid.json',{pid:p.pid,port:server.address().port});
  const connections=[],processes=new Map();
  function observeProcesses(pid=p.pid){
    try{
      const stat=fs.readFileSync('/proc/'+pid+'/stat','utf8');
      processes.set(pid,{pid,startToken:stat.slice(stat.lastIndexOf(')')+2).split(' ')[19]});
      for(const child of fs.readFileSync('/proc/'+pid+'/task/'+pid+'/children','utf8').trim().split(/\s+/).filter(Boolean))observeProcesses(Number(child));
    }catch(error){if(error.code!=='ENOENT'&&error.code!=='ESRCH')throw error;}
  }
  try {
    const active=profile+'/DevToolsActivePort',end=Date.now()+10000;
    while(!fs.existsSync(active)){assert(Date.now()<end&&p.exitCode===null,'Chrome startup');await pause(30);}
    const [port,endpoint]=fs.readFileSync(active,'utf8').trim().split('\n'),url='ws://127.0.0.1:'+port+endpoint;
    for(const spec of [{name:'debugger-source',debug:true},{name:'debugger-off'},
      {name:'first-draw',debug:true,draw:true},{name:'compile',debug:true,compile:true},
      {name:'debugger-burst',debug:true,compile:true,burst:true},{name:'queued-late',queue:true,debug:true},
      {name:'body-late',bodyDelayMs:3400,debug:true},{name:'identity-loss',identityLoss:true}]) {
      report.activeCase=spec.name;
      const rows=[],events=[],workers=new Map(),tasks=[],scriptHashes=[];
      const observer=createObserver({connectionId:spec.name,emit:r=>{rows.push(r);log('operations.jsonl',{case:spec.name,...r});}});
      const c=helper.connection(url,observer);connections.push(c);await c.ready;
      if(!report.browserVersion)report.browserVersion=await c.send('Browser.getVersion');
      const targetId=(await c.send('Target.createTarget',{url:'about:blank'})).targetId;
      const s=(await c.send('Target.attachToTarget',{targetId,flatten:true})).sessionId;
      const ev=async(expression,session=s)=>{const r=await c.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},session);assert(!r.exceptionDetails,'fixture expression exception');return r.result?.value;};
      const eventWait=async predicate=>{const end=Date.now()+10000;while(!events.some(predicate)){assert(Date.now()<end,'bounded passive event');assert(!c.closed,'route closed before expected event');await pause(5);}};
      c.event=v=>{
        if(v.method==='Runtime.bindingCalled'&&v.params.name===BINDING){
          try{const row={...timingEvent(JSON.parse(v.params.payload)),sessionId:v.sessionId,receivedAt:Date.now()};events.push(row);log('timing.jsonl',{case:spec.name,...row});}catch(error){log('invalid-binding.jsonl',{case:spec.name,error:String(error)});}
        } else if(v.method==='Target.attachedToTarget'&&v.params.targetInfo.type==='worker'){
          const w={sessionId:v.params.sessionId,targetId:v.params.targetInfo.targetId,closed:false};workers.set(w.sessionId,w);
          const t=(async()=>{await c.send('Runtime.enable',{},w.sessionId);await c.send('Runtime.addBinding',{name:BINDING},w.sessionId);
            await ev(helper.GL_OBSERVER,w.sessionId);await ev(instrumentation(spec),w.sessionId);
            if(spec.debug)await c.send('Debugger.enable',{},w.sessionId);
            await c.send('Runtime.runIfWaitingForDebugger',{},w.sessionId);})();tasks.push(t);t.catch(()=>{});
        } else if(v.method==='Target.detachedFromTarget'){const w=workers.get(v.params.sessionId);if(w)w.closed=true;
        } else if(v.method==='Debugger.scriptParsed'&&workers.has(v.sessionId)&&!c.closed){
          const t=c.send('Debugger.getScriptSource',{scriptId:v.params.scriptId},v.sessionId).then(r=>{
            const b=Buffer.from(r.bytecode||r.scriptSource||'',r.bytecode?'base64':'utf8');
            scriptHashes.push({scriptId:v.params.scriptId,url:v.params.url?new URL(v.params.url,'http://fixture').pathname:null,
              bytes:b.length,sha256:hash(b),bytecode:!!r.bytecode});
          });tasks.push(t);t.catch(()=>{});
        }
      };
      await c.send('Runtime.enable',{},s);await c.send('Runtime.addBinding',{name:BINDING},s);
      await c.send('Page.enable',{},s);await c.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},s);
      await c.send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/latency-fixture'},s);
      const readyEnd=Date.now()+20000;
      while(!await ev("typeof RenderWorker!=='undefined'&&typeof OpenGLCompat!=='undefined'")){assert(Date.now()<readyEnd);await pause(20);}
      await ev(SETUP);
      while(!await ev('fixtureReady')){assert(!await ev('fixtureFailure'),'production fixture failed');assert(Date.now()<readyEnd);await pause(20);}
      await Promise.all(tasks);
      assert.equal(workers.size,1,'one production render Worker');const w=[...workers.values()][0];
      const row={name:spec.name,identity:w,publication:events.filter(e=>e.phase==='publication'),scriptHashes};
      observeProcesses();
      report.cases.push(row);
      assert.equal(row.publication.length,1,'ordinary WebGL publication required');
      if(spec.draw)await ev('fixture.drawDone=false;fixture.draw().then(()=>{fixture.drawDone=true});true');
      if(spec.queue||spec.compile){
        const kind=spec.compile?'compile':'task';
        const work=spec.burst?"for(let i=0;i<200;i++)new Function('return '+i);":spec.compile?"const text=Array.from({length:40000},(_,i)=>'function f'+i+'(){return '+i+';}').join('');new Function(text);":"Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,3400);";
        await ev(`setTimeout(()=>{__q3Latency.mark('${kind}-entry',0);${work}__q3Latency.mark('${kind}-complete',0);},100);true`,w.sessionId);
        // The binding notification itself may be buffered by inspector work.
        // Send inside the scheduled bounded native wait, then prove overlap
        // from actual in-target samples rather than notification receipt time.
        if(spec.queue)await pause(150);else await eventWait(e=>e.phase===kind+'-entry');
      }
      if(spec.identityLoss){
        const pending=ev('new Promise(()=>{})',w.sessionId).then(()=>null,error=>String(error));
        await ev('fixture.manager.worker.terminate();true');
        row.pendingError=await pending;assert(row.pendingError);row.detached=w.closed;
        row.attribution='target lost; no queue/body claim';assert(row.detached);row.helperTerminal=c.closed;
      } else {
        const first=rows.length;
        let rejected=null;try {const value=await ev(SNAPSHOT,w.sessionId);assert(value?.devices?.length===1,'actual observed WorkerWebGL');row.webgl=value.devices.map(d=>({type:d.type,version:d.version,renderer:d.renderer}));}
        catch(error){rejected=String(error);assert.match(rejected,/UNKNOWN/);}
        if(rejected){assert(c.closed);await pause(1200);}
        const request=rows.slice(first).find(r=>r.type==='request'&&r.expression?.sha256===hash(SNAPSHOT));
        const response=rows.find(r=>r.type==='response'&&r.id===request.id);
        assert(response,'passively received completion required; never query UNKNOWN');
        row.timing=attribute({request,response,events,lifecycle:rows.filter(r=>r.type==='lifecycle')});row.rejected=rejected;
        row.exactExpression={sha256:hash(SNAPSHOT),bytes:Buffer.byteLength(SNAPSHOT)};
        if(spec.queue){
          assert(rejected);assert(row.timing.queueMs>3000,'real queue red control');assert(row.timing.bodyMs<100);
          row.queueFixture={kind:'bounded synthetic native Atomics.wait; no game memory',events:events.filter(e=>e.phase.startsWith('task-'))};
          assert.equal(row.queueFixture.events.length,2);assert(row.queueFixture.events[0].epochMs<request.startedAt&&row.queueFixture.events[1].epochMs>request.startedAt,'actual pending native wait required');
        }
        if(spec.bodyDelayMs){assert(rejected);assert(row.timing.wrapperMs>3400);assert(row.timing.injectedWrapperMs>3300);assert(row.timing.bodyMs<100);}
        if(!spec.queue&&!spec.bodyDelayMs)assert(!rejected);
        if(spec.compile){
          await Promise.all(tasks);
          row.compile=events.filter(e=>e.phase.startsWith('compile-'));
          assert.equal(row.compile.length,2,'complete actual compilation timing');
          row.sourceFetches=rows.filter(r=>r.type==='request'&&r.method==='Debugger.getScriptSource').length;
          if(spec.burst)assert(row.sourceFetches>=200,'real debugger event/source backpressure fixture');
        }
        if(spec.draw){
          while(!await ev('fixture.drawDone')){assert(Date.now()<readyEnd);await pause(20);}
          row.glOperations=events.filter(e=>e.phase.startsWith('gl-'));
          row.publicationsAfterDraw=events.filter(e=>e.phase==='publication');
          assert.equal(row.publicationsAfterDraw.length,2,'first triangle ordinary publication');
          assert(row.glOperations.some(e=>/^gl-draw.*-complete$/.test(e.phase)),'real WebGL draw required');
        }
        // Expression exception is not a transport UNKNOWN. This is a separate
        // nonterminal fixture control, never attempted on an expired route.
        if(!c.closed){const failed=await c.send('Runtime.evaluate',{expression:'throw Error("fixture")'},w.sessionId);assert(failed.exceptionDetails&&!c.closed);row.expressionErrorTransportLive=true;}
      }
      const term=rows.find(r=>r.type==='terminal');
      row.requestsAfterTerminal=term?rows.filter(r=>r.type==='request'&&r.sequence>term.sequence).length:0;assert.equal(row.requestsAfterTerminal,0);
      row.helperTerminal=c.closed;
      if(!c.closed){if(!spec.identityLoss)await ev('fixture.manager.stop().then(()=>true)');await c.send('Target.closeTarget',{targetId});}
      c.ws.close();write(spec.name+'.json',row);
    }
    delete report.activeCase;
    const ids=report.cases.map(r=>r.identity.targetId);assert.equal(new Set(ids).size,ids.length,'replacement target must never inherit identity');
    report.passed=true;
  } finally {
    // Process ownership, not a post-UNKNOWN CDP close/query.
    observeProcesses();write('browser-processes.json',[...processes.values()]);
    for(const c of connections)c.ws.close();if(p.exitCode===null)p.kill('SIGTERM');
    report.chromeWait=await joined;await Promise.all([new Promise(r=>stdout.closed?r():stdout.once('close',r)),new Promise(r=>stderr.closed?r():stderr.once('close',r))]);
    server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(profile,{recursive:true,force:true});
    for(let i=0;i<100&&[...processes.keys()].some(pid=>fs.existsSync('/proc/'+pid));i++)await pause(20);
    report.browserPIDsAbsent=[...processes.keys()].every(pid=>!fs.existsSync('/proc/'+pid));
    report.browserPIDs=[...processes.keys()];
    report.nativeQuit=false;report.hostClose=true;write('report.json',report);
  }
  assert(report.browserPIDsAbsent,'owned browser descendant remains after actual Chrome wait');
  return report;
}
module.exports={SNAPSHOT,BINDING,timingEvent,instrumentation,attribute,historical,chromeControls};
if(require.main===module){
  assert.equal(process.argv[2],'chrome','explicit diagnostic mode required');
  chromeControls(process.argv[3]).catch(error=>{console.error(error);process.exitCode=1;});
}
