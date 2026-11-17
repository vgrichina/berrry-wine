'use strict';
// Diagnostic-only composition of the released original controller.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),Module=require('node:module');
const {hash}=require('./quake3-startup-observer.cjs');
const latency=require('./quake3-startup-latency-controller.cjs');
const ROOT=path.resolve(__dirname,'..'),RUN='scratch/runs/20261115-quake3-original-startup-task/';
const BINDING='__q3TaskTiming',LIMIT=30000;
const GL=['compileShader','linkProgram','getShaderParameter','getProgramParameter','drawArrays','drawElements',
  'drawArraysInstanced','drawElementsInstanced','getError','clear','flush','finish','readPixels',
  'shaderSource','bufferData','texImage2D','texSubImage2D','copyTexSubImage2D','renderbufferStorage',
  'generateMipmap','checkFramebufferStatus','getProgramInfoLog','getShaderInfoLog','getUniformLocation',
  'getAttribLocation','getParameter','getRenderbufferParameter','getExtension','getContextAttributes',
  'createShader','createProgram','createBuffer','createTexture','createFramebuffer','createRenderbuffer',
  'deleteShader','deleteProgram','deleteBuffer','deleteTexture','deleteFramebuffer','deleteRenderbuffer',
  'bindFramebuffer','framebufferTexture2D','framebufferRenderbuffer','drawBuffers','readBuffer',
  'beginTransformFeedback','endTransformFeedback','transformFeedbackVaryings',
  'activeTexture','attachShader','bindBuffer','bindBufferBase','bindRenderbuffer','bindTexture',
  'bindTransformFeedback','bindVertexArray','blendFunc','clearColor','clearDepth','clearStencil',
  'colorMask','createTransformFeedback','createVertexArray','cullFace','deleteTransformFeedback',
  'deleteVertexArray','depthFunc','depthMask','depthRange','disable','disableVertexAttribArray',
  'enable','enableVertexAttribArray','frontFace','isEnabled','lineWidth','pixelStorei','polygonOffset',
  'scissor','stencilFunc','stencilFuncSeparate','stencilMask','stencilMaskSeparate','stencilOp',
  'stencilOpSeparate','texParameteri','uniform1f','uniform1i','uniform4fv','uniform4iv',
  'uniformMatrix4fv','useProgram','vertexAttribDivisor','vertexAttribPointer','viewport'];
const KINDS=new Set(['limit','snapshot','worker-script','message','publication','native-init','context','import','calibration',
  'publication-transfer',
  ...['compile','compileStreaming','instantiate','instantiateStreaming'].flatMap(k=>['wasm-'+k,'wasm-dispatch-'+k]),...GL.map(k=>'gl-'+k)]);
function injected({page,binding,limit,glMethods}){
  if(globalThis.__q3Task)throw Error('timing already installed');
  let sequence=0,emitted=0,dropped=0,overheadMs=0;
  const counts=Object.create(null),starts=Object.create(null),maxima=Object.create(null),now=()=>performance.now();
  const emit=row=>{const a=now();try{
    if(emitted<limit-1){++emitted;globalThis[binding](JSON.stringify(row));}
    else if(emitted===limit-1){++emitted;++dropped;const ms=now();globalThis[binding](JSON.stringify({kind:'limit',phase:'overflow',seq:row.seq,ms,
      epochMs:performance.timeOrigin+ms,endpoint:null,owner:null,droppedAtLeast:1}));}
    else ++dropped;
  }catch(_){}overheadMs+=now()-a;};
  const begin=(kind,endpoint=null,owner=null,announce=true)=>{
    const s={kind,seq:++sequence,ms:now(),endpoint,owner};
    const n=starts[kind]=(starts[kind]||0)+1;
    if(announce&&kind!=='snapshot'&&n<=16){s.announced=true;emit({...s,phase:'begin',epochMs:performance.timeOrigin+s.ms});}
    return s;
  };
  const end=(s,exception=false,force=false,ms=now())=>{const duration=ms-s.ms;
    const n=counts[s.kind]=(counts[s.kind]||0)+1;maxima[s.kind]=Math.max(maxima[s.kind]||0,duration);
    if(force||s.announced||n<=16||duration>=5){if(!s.announced)emit({...s,phase:'begin',epochMs:performance.timeOrigin+s.ms});
      emit({...s,phase:'end',ms,epochMs:performance.timeOrigin+ms,exception});}
  };
  const call=(kind,fn,self,args)=>{const s=begin(kind,null,null,false);let value;
    // No binding emission between these native-call clock samples.
    s.ms=now();try{value=Reflect.apply(fn,self,args);}catch(e){const ms=now();end(s,true,false,ms);throw e;}
    const ms=now();end(s,false,false,ms);return value;};
  globalThis.__q3Task={begin,end,call,emit,stats:()=>({emitted,dropped,overheadMs,counts:{...counts},maxima:{...maxima}})};
  for(const name of ['compile','compileStreaming','instantiate','instantiateStreaming']){
    // Dispatch only: observing promise settlement here would suppress ordinary
    // unhandled-rejection behavior. Existing await sites are timed in source.
    const fn=WebAssembly[name];if(fn)WebAssembly[name]=function(...args){return call('wasm-dispatch-'+name,fn,this,args);};
  }
  if(typeof importScripts==='function'){
    const fn=globalThis.importScripts;globalThis.importScripts=function(...args){return call('import',fn,this,args);};
  }
  if(typeof OffscreenCanvas!=='undefined'){
    const get=OffscreenCanvas.prototype.getContext,seen=new WeakSet();
    OffscreenCanvas.prototype.getContext=function(...args){
      const device=call('context',get,this,args);
      if(device&&/^webgl/.test(args[0])&&!seen.has(device)){seen.add(device);
        for(const name of glMethods){const fn=device[name];if(typeof fn==='function')device[name]=function(...a){return call('gl-'+name,fn,this,a);};}
      }return device;
    };
    const transfer=OffscreenCanvas.prototype.transferToImageBitmap;
    if(transfer)OffscreenCanvas.prototype.transferToImageBitmap=function(...args){return call('publication-transfer',transfer,this,args);};
  }
  if(!page){
    const original=globalThis.__gltronObserver.snapshot;
    globalThis.__gltronObserver.snapshot=function(...args){
      const s=begin('snapshot');emit({...s,phase:'entry',epochMs:performance.timeOrigin+s.ms});
      const a=now();let value;
      try{value=Reflect.apply(original,this,args);}catch(e){
        const b=now();emit({...s,phase:'body-entry',ms:a,epochMs:performance.timeOrigin+a});
        emit({...s,phase:'body-exception',ms:b,epochMs:performance.timeOrigin+b});end(s,true,true);throw e;
      }
      const b=now();emit({...s,phase:'body-entry',ms:a,epochMs:performance.timeOrigin+a});
      emit({...s,phase:'body-complete',ms:b,epochMs:performance.timeOrigin+b});end(s,false,true);
      const ms=now();emit({...s,phase:'stats',ms,epochMs:performance.timeOrigin+ms,stats:globalThis.__q3Task.stats()});return value;
    };
  }
  return true;
}
function instrumentation({page=false}={}){
  return '('+injected.toString()+')('+JSON.stringify({page,binding:BINDING,limit:LIMIT,glMethods:GL})+')';
}
function replaceOnce(source,needle,replacement){
  assert.equal(source.split(needle).length,2,'diagnostic anchor changed: '+needle.slice(0,80));return source.replace(needle,replacement);
}
function workerSource(source){
  let value=replaceOnce(source,'messageChain = messageChain.then(async () => {',
    "messageChain = messageChain.then(async () => {\n    const __q3Span=globalThis.__q3Task.begin('message',Number.isSafeInteger(msg.endpointId)?msg.endpointId:null,Number.isSafeInteger(msg.message?.owner)?msg.message.owner:null);");
  value=replaceOnce(value,'instance?.exports.d3d_render_reset_transients?.();',
    'try { instance?.exports.d3d_render_reset_transients?.(); } finally { globalThis.__q3Task.end(__q3Span,__q3Span.exception===true); }');
  value=replaceOnce(value,'try { await processMessage(msg); }',
    'try { await processMessage(msg); } catch(error) { __q3Span.exception=true; throw error; }');
  value=replaceOnce(value,"send({ t: 'render-event', endpointId: id, message }, transferables(message));",
    "const __q3Publication=message.t==='frame'?globalThis.__q3Task.begin('publication',id):null;\n  try { send({ t: 'render-event', endpointId: id, message }, transferables(message)); } finally { if(__q3Publication)globalThis.__q3Task.end(__q3Publication); }");
  assert.equal(value.split('instance.exports.d3dim_worker_init(msg.imageBase);').length,3,'native-init anchors changed');
  value=value.replaceAll('instance.exports.d3dim_worker_init(msg.imageBase);',
    "globalThis.__q3Task.call('native-init',instance.exports.d3dim_worker_init,instance.exports,[msg.imageBase]);");
  const awaited='const result = await WebAssembly.instantiate(msg.module, inertImports(msg.sigs));';
  assert.equal(value.split(awaited).length,3,'instantiate anchors changed');
  value=value.replaceAll(awaited,timedDeclaration(awaited,'result','instantiate'));
  return "globalThis.__q3ScriptSpan=globalThis.__q3Task.begin('worker-script');\n"+value+
    '\nglobalThis.__q3Task.end(globalThis.__q3ScriptSpan);\n';
}
function timedDeclaration(statement,name,kind){
  const prefix='const '+name+' = ';assert(statement.startsWith(prefix)&&statement.endsWith(';'));
  return "const __q3AwaitSpan=globalThis.__q3Task.begin('wasm-"+kind+"'); let "+name+"; try { "+name+' = '+
    statement.slice(prefix.length)+" } catch(error) { __q3AwaitSpan.exception=true; throw error; } finally { globalThis.__q3Task.end(__q3AwaitSpan,__q3AwaitSpan.exception===true); }";
}
function hostSource(source){
  let value=source;
  for(const [input,spaces] of [['bytes',14],['built.bytes',12]]){
    const indent=' '.repeat(spaces);
    const statement="const module = typeof window !== 'undefined' && window.WINE_REDLINE_STARTUP\n"+indent+
      '? await window.WINE_REDLINE_STARTUP.compile('+input+')\n'+indent+': await WebAssembly.compile(observerBytes || '+input+');';
    value=replaceOnce(value,statement,timedDeclaration(statement,'module','compile'));
  }
  return value;
}
function metadata(raw){
  assert(raw&&['begin','end','entry','body-entry','body-complete','body-exception','stats','overflow'].includes(raw.phase));
  assert(KINDS.has(raw.kind));
  assert(Number.isSafeInteger(raw.seq)&&raw.seq>0&&Number.isFinite(raw.ms)&&Number.isFinite(raw.epochMs));
  const row={kind:raw.kind,seq:raw.seq,phase:raw.phase,ms:raw.ms,epochMs:raw.epochMs};
  for(const k of ['endpoint','owner']){assert(raw[k]===null||Number.isSafeInteger(raw[k]));row[k]=raw[k];}
  if(raw.phase==='end')row.exception=raw.exception===true;
  if(raw.phase==='overflow'){assert(raw.kind==='limit'&&raw.droppedAtLeast===1);row.droppedAtLeast=1;row.totalLaterDrops=null;}
  if(raw.phase==='stats'){
    const s=raw.stats;assert(Number.isSafeInteger(s.emitted)&&s.emitted<=LIMIT&&Number.isSafeInteger(s.dropped)&&s.dropped>=0&&Number.isFinite(s.overheadMs));
    row.stats={emitted:s.emitted,dropped:s.dropped,overheadMs:s.overheadMs,counts:{},maxima:{}};
    for(const k of Object.keys(s.counts)){assert(KINDS.has(k)&&Number.isSafeInteger(s.counts[k])&&Number.isFinite(s.maxima[k]));row.stats.counts[k]=s.counts[k];row.stats.maxima[k]=s.maxima[k];}
  }return row;
}
function attribute({request,response,events,lifecycle=[]}){
  const own=events.filter(v=>v.sessionId===request.sessionId&&v.targetId===request.targetId);
  const entries=own.filter(v=>v.kind==='snapshot'&&v.phase==='entry'&&v.epochMs>=request.startedAt-2&&v.epochMs<=response.at+2);
  if(entries.length!==1)return {queueMs:null,bodyMs:null,reason:'missing or ambiguous exact-owner snapshot entry',entries:entries.length};
  const n=entries[0].seq;
  const converted=own.filter(v=>v.kind==='snapshot'&&v.seq===n).map(v=>({...v,phase:v.phase==='end'?'complete':v.phase}))
    .filter(v=>['entry','body-entry','body-complete','complete'].includes(v.phase));
  let result;try{result=latency.attribute({request,response,events:converted,lifecycle});}
  catch(error){return {queueMs:null,bodyMs:null,reason:error.message};}
  const spans=[];
  for(const begin of own.filter(v=>v.phase==='begin'&&v.kind!=='snapshot')){
    const ends=own.filter(v=>v.phase==='end'&&v.seq===begin.seq&&v.kind===begin.kind);
    if(ends.length===1&&begin.epochMs<=request.startedAt+2&&ends[0].epochMs>=request.startedAt-2)
      spans.push({kind:begin.kind,seq:begin.seq,endpoint:begin.endpoint,owner:begin.owner,startEpochMs:begin.epochMs,
        endEpochMs:ends[0].epochMs,durationMs:ends[0].ms-begin.ms,
        definitelyEnclosesSend:begin.epochMs<=request.startedAt-2&&ends[0].epochMs>=request.startedAt+2,
        possibleOverlapUsesEpochToleranceMs:2,
        asynchronousEnvelope:begin.kind==='message'||(begin.kind.startsWith('wasm-')&&!begin.kind.startsWith('wasm-dispatch-')),exception:ends[0].exception});
  }
  return {...result,attribution:'measured current diagnostic only; never historical request 1574',enclosingSendSpans:spans,inspectorDispatchMs:null,
    limitation:'pre-entry includes transport/inspector; async message/wasm envelope is not continuous native occupancy; first 16 and >=5ms calls retained; 2ms epoch tolerance'};
}
function compose(source){
  let result=replaceOnce(source,"'scratch/runs/20261115-quake3-startup-operation-cause/']",
    "'scratch/runs/20261115-quake3-startup-operation-cause/','"+RUN+"']");
  result=replaceOnce(result,"await c.send('Runtime.evaluate',{expression:GL_OBSERVER},sessionId);",
    "await c.send('Runtime.addBinding',{name:'"+BINDING+"'},sessionId);await c.send('Runtime.evaluate',{expression:GL_OBSERVER},sessionId);await c.send('Runtime.evaluate',{expression:require('./quake3-startup-task-controller.cjs').instrumentation()},sessionId);");
  result=replaceOnce(result,"c.event=v=>{\n      if(v.method==='Target.attachedToTarget'",
    "c.event=v=>{\n      if(v.method==='Runtime.bindingCalled'&&v.params.name==='"+BINDING+"'){require('./quake3-startup-task-controller.cjs').recordBinding(out,v,workers);return;}\n      if(v.method==='Target.attachedToTarget'");
  result=replaceOnce(result,'    // Registered cooperative 10000 scheduling is unchanged.',
    "    await c.send('Runtime.addBinding',{name:'"+BINDING+"'},session);\n    await c.send('Page.addScriptToEvaluateOnNewDocument',{source:require('./quake3-startup-task-controller.cjs').instrumentation({page:true})},session);\n    // Registered cooperative 10000 scheduling is unchanged.");
  return result+'\nmodule.exports.browser=browser;\n';
}
function recordBinding(out,v,workers,pageTarget=null){
  const w=workers.get(v.sessionId);
  try{const row=metadata(JSON.parse(v.params.payload));fs.appendFileSync(out+'/task-timing.jsonl',
    JSON.stringify({...row,sessionId:v.sessionId,targetId:w?.targetId??pageTarget,receivedAt:Date.now()})+'\n');}
  catch(error){fs.appendFileSync(out+'/invalid-task-binding.jsonl',JSON.stringify({sessionId:v.sessionId,error:String(error)})+'\n');}
}
function compositionPin(out,name,filename,source){
  if(out)fs.writeFileSync(out+'/'+name+'-composition-pin.json',JSON.stringify({filename:path.relative(ROOT,filename),
    originalSha256:hash(fs.readFileSync(filename)),composedSha256:hash(source),composedBytes:Buffer.byteLength(source),
    transformation:'tools/quake3-startup-task-controller.cjs',sourceCopy:false})+'\n',{flag:'wx'});
}
function controller(out=null){
  const filename=path.join(__dirname,'quake3-browser-controller.cjs'),m=new Module(filename,module);
  const source=compose(fs.readFileSync(filename,'utf8'));compositionPin(out,'original-controller',filename,source);
  m.filename=filename;m.paths=module.paths;m._compile(source,filename);return m.exports;
}
function installServer(out,{hashHTTP=false}={}){
  const api=require('../test/static-server.js'),start=api.startStaticServer;
  const original=fs.readFileSync(ROOT+'/lib/d3d-render-worker.js','utf8'),changed=workerSource(original);
  const originalHost=fs.readFileSync(ROOT+'/host.js','utf8'),changedHost=hostSource(originalHost);
  fs.writeFileSync(out+'/diagnostic-host-pin.json',JSON.stringify({path:'host.js',originalSha256:hash(originalHost),
    servedSha256:hash(changedHost),servedBytes:Buffer.byteLength(changedHost),transformation:'hostSource in tools/quake3-startup-task-controller.cjs',noSourceCopy:true})+'\n',{flag:'wx'});
  fs.writeFileSync(out+'/diagnostic-source-pin.json',JSON.stringify({path:'lib/d3d-render-worker.js',originalSha256:hash(original),
    servedSha256:hash(changed),servedBytes:Buffer.byteLength(changed),transformation:'workerSource in tools/quake3-startup-task-controller.cjs',noSourceCopy:true})+'\n',{flag:'wx'});
  api.startStaticServer=async function(options){
    const prior=options.handleRequest;
    const server=await start.call(this,{...options,handleRequest(req,res){
      if(req.url.split('?')[0]==='/lib/d3d-render-worker.js'){
        res.setHeader('Content-Type','application/javascript');res.end(changed);return true;
      }
      if(req.url.split('?')[0]==='/host.js'){
        res.setHeader('Content-Type','application/javascript');res.end(changedHost);return true;
      }return prior?.(req,res);
    }});
    if(hashHTTP)server.prependListener('request',(req,res)=>{
      const h=require('node:crypto').createHash('sha256');let bytes=0;
      const add=b=>{if(b){b=Buffer.isBuffer(b)?b:Buffer.from(b);h.update(b);bytes+=b.length;}};
      const wr=res.write,en=res.end;res.write=function(b){add(b);return wr.apply(this,arguments);};
      res.end=function(b){add(b);return en.apply(this,arguments);};
      res.once('finish',()=>fs.appendFileSync(out+'/http.jsonl',JSON.stringify({url:req.url,status:res.statusCode,bytes,sha256:h.digest('hex')})+'\n'));
    });
    return server;
  };
}
function loadVirtual(filename,source){
  const m=new Module(filename,module);m.filename=filename;m.paths=module.paths;m._compile(source,filename);return m.exports;
}
async function chromeControls(out){
  installServer(out);
  const filename=path.join(__dirname,'quake3-startup-latency-controller.cjs');
  let source=fs.readFileSync(filename,'utf8');
  source=replaceOnce(source,"await ev(instrumentation(spec),w.sessionId);",
    "await ev(instrumentation(spec),w.sessionId);await c.send('Runtime.addBinding',{name:'"+BINDING+"'},w.sessionId);await ev(require('./quake3-startup-task-controller.cjs').instrumentation(),w.sessionId);");
  source=replaceOnce(source,"c.event=v=>{","c.event=v=>{if(v.method==='Runtime.bindingCalled'&&v.params.name==='"+BINDING+"'){require('./quake3-startup-task-controller.cjs').recordBinding(out,v,workers,v.sessionId===s?targetId:null);return;}");
  source=replaceOnce(source,"await c.send('Page.enable',{},s);await c.send('Target.setAutoAttach'",
    "await c.send('Runtime.addBinding',{name:'"+BINDING+"'},s);await c.send('Page.addScriptToEvaluateOnNewDocument',{source:require('./quake3-startup-task-controller.cjs').instrumentation({page:true})},s);await c.send('Page.enable',{},s);await c.send('Target.setAutoAttach'");
  source=replaceOnce(source,'Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,3400);',
    "__q3Task.call('calibration',Atomics.wait,Atomics,[new Int32Array(new SharedArrayBuffer(4)),0,0,3400]);");
  source=replaceOnce(source,'report.cases.push(row);',
    "row.taskObserverCost=await ev(\"(()=>{const n=20000,fn=()=>7;let sum=0,a=performance.now();for(let i=0;i<n;i++)sum+=fn();const directMs=performance.now()-a;a=performance.now();for(let i=0;i<n;i++)sum+=__q3Task.call('calibration',fn,null,[]);const observedMs=performance.now()-a;return {n,sum,directMs,observedMs,incrementalPerCallMs:(observedMs-directMs)/n};})()\",w.sessionId);report.cases.push(row);");
  source=replaceOnce(source,"const term=rows.find(r=>r.type==='terminal');",
    "if(spec.name==='debugger-source'){const start=Date.now();let maxQueryWallMs=0;for(let i=0;i<40;i++){await ev('fixture.draw()');const before=performance.now();await ev(SNAPSHOT,w.sessionId);maxQueryWallMs=Math.max(maxQueryWallMs,performance.now()-before);await pause(25);}row.repeatedPolling={count:40,elapsedMs:Date.now()-start,maxQueryWallMs,publications:events.filter(e=>e.phase==='publication').length};assert.equal(row.repeatedPolling.publications,41);}\n      const term=rows.find(r=>r.type==='terminal');");
  compositionPin(out,'timing-controls',filename,source);
  const report=await loadVirtual(filename,source).chromeControls(out);
  const read=n=>fs.readFileSync(out+'/'+n,'utf8').trim().split('\n').filter(Boolean).map(s=>JSON.parse(s));
  const operations=read('operations.jsonl'),events=read('task-timing.jsonl'),results=[];
  for(const request of operations.filter(v=>v.type==='request'&&v.expression?.sha256===hash(latency.SNAPSHOT))){
    const response=operations.find(v=>v.type==='response'&&v.id===request.id&&v.case===request.case);
    assert(response,'passive response missing');
    const r=attribute({request,response,events,lifecycle:operations.filter(v=>v.type==='lifecycle'&&v.case===request.case)});
    assert(r.bodyMs!==null,'new route must measure exact owner body');
    results.push({case:request.case,requestId:request.id,...r});
  }
  for(const kind of ['worker-script','message','native-init','publication','import','wasm-instantiate','gl-drawArrays'])
    assert(events.some(v=>v.kind===kind&&v.phase==='end'),'missing production boundary '+kind);
  assert(results.find(v=>v.case==='queued-late').queueMs>3000);
  assert(results.find(v=>v.case==='queued-late').enclosingSendSpans.some(v=>v.kind==='calibration'&&v.durationMs>3000&&!v.asynchronousEnvelope&&v.definitelyEnclosesSend),
    'actual timed native wait must enclose request send');
  assert(results.find(v=>v.case==='body-late').bodyMs>3000,'named slow diagnostic wrapper is inside outer measured body');
  assert(!fs.existsSync(out+'/invalid-task-binding.jsonl'),'invalid timing evidence');
  for(const r of report.cases)assert(r.taskObserverCost.incrementalPerCallMs<0.1,'observer overhead exceeds bounded fixture limit');
  const moduleSha256=hash(fs.readFileSync(ROOT+'/build/wine-assembly.wasm'));
  const receipts=report.cases.flatMap(r=>r.scriptHashes.filter(s=>s.bytecode).map(s=>({case:r.name,...s})));
  assert(receipts.length>0&&receipts.every(r=>r.sha256===moduleSha256),'actual current module receipts required');
  const sourcePin=JSON.parse(fs.readFileSync(out+'/diagnostic-source-pin.json'));
  const sourceReceipts=report.cases.flatMap(r=>r.scriptHashes.filter(s=>s.url==='/lib/d3d-render-worker.js'));
  assert(sourceReceipts.length>0&&sourceReceipts.every(r=>r.sha256===sourcePin.servedSha256),'actual instrumented production Worker receipts required');
  const value={passed:report.passed,currentModule:true,moduleSha256,moduleReceipts:receipts,sourceReceipts,
    results,eventCount:events.length,inspectorDispatchMs:null,
    repeatedPolling:report.cases.find(r=>r.name==='debugger-source').repeatedPolling,
    observerCost:report.cases.map(r=>({case:r.name,...r.taskObserverCost})),
    overhead:events.filter(v=>v.phase==='stats').map(v=>({targetId:v.targetId,...v.stats}))};
  fs.writeFileSync(out+'/task-report.json',JSON.stringify(value,null,2)+'\n',{flag:'wx'});return value;
}
function qualified(out){
  installServer(out,{hashHTTP:true});
  const filename=ROOT+'/test/quake3-browser-controller.test.cjs';
  let source=fs.readFileSync(filename,'utf8');
  source=replaceOnce(source,"await c.send('Runtime.enable',{},sessionId);await c.send('Debugger.enable',{},sessionId);",
    "await c.send('Runtime.enable',{},sessionId);await c.send('Runtime.addBinding',{name:'"+BINDING+"'},sessionId);await c.send('Runtime.evaluate',{expression:controller.GL_OBSERVER},sessionId);await c.send('Runtime.evaluate',{expression:require('../tools/quake3-startup-task-controller.cjs').instrumentation()},sessionId);await c.send('Debugger.enable',{},sessionId);");
  source=replaceOnce(source,"c.event=v=>{","c.event=v=>{if(v.method==='Runtime.bindingCalled'&&v.params.name==='"+BINDING+"'){require('../tools/quake3-startup-task-controller.cjs').recordBinding(root,v,workers,v.sessionId===session?target[0].targetId:null);return;}");
  source=replaceOnce(source,"await cdp.send('Runtime.enable',{});await cdp.send('Page.enable',{});",
    "await cdp.send('Runtime.addBinding',{name:'"+BINDING+"'});await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:require('../tools/quake3-startup-task-controller.cjs').instrumentation({page:true})});await cdp.send('Runtime.enable',{});await cdp.send('Page.enable',{});");
  source=replaceOnce(source,'report.setup=await evaluate(',
    "await evaluate('WineAssembly.getWasmModule().then(()=>true)');report.taskProductionCompile=true;report.setup=await evaluate(");
  compositionPin(out,'qualified-controls',filename,source);loadVirtual(filename,source);
}
function assertTaskQualification(pins){
  const q=pins.taskQualification;assert(q,'current task route qualification required');
  const read=p=>{assert(p.path.startsWith(RUN+'chrome-controls/')&&!p.path.includes('..'));
    const b=fs.readFileSync(ROOT+'/'+p.path);assert.equal(hash(b),p.sha256);return JSON.parse(b);};
  const report=read(q.report),tested=read(q.pins);assert(report.passed&&report.currentModule);
  assert.equal(report.repeatedPolling.count,40);assert.equal(report.repeatedPolling.publications,41);
  const full=pins.qualification?.report;assert(full?.path.startsWith(RUN+'chrome-qualified/')&&!full.path.includes('..'));
  const fullBytes=fs.readFileSync(ROOT+'/'+full.path);assert.equal(hash(fullBytes),full.sha256);
  assert(JSON.parse(fullBytes).taskProductionCompile,'production compile-await control required');
  for(const name of ['tools/quake3-startup-task-controller.cjs','test/quake3-startup-task-controller.test.cjs','tools/quake3-startup-latency-controller.cjs',
    'tools/quake3-browser-controller.cjs','host.js','lib/d3d-render-worker.js','lib/render-worker.js','build/wine-assembly.wasm']){
    const p=tested.files.find(v=>v.path===name);assert(p,name);assert.equal(hash(fs.readFileSync(ROOT+'/'+name)),p.sha256,'task qualified dependency drift: '+name);
    assert.equal(pins.files.find(v=>v.path===name)?.sha256,p.sha256);
  }
  const dir=path.dirname(ROOT+'/'+q.report.path);
  assert.equal(report.moduleSha256,tested.module.sha256);
  for(const name of ['native-wait.json','watchdog-wait.json','outer-child-wait.json']){
    const w=JSON.parse(fs.readFileSync(dir+'/'+name));assert.equal(w.exit,0);assert(w.actualWait&&w.stdoutEOF&&w.stderrEOF);assert(!fs.existsSync('/proc/'+w.pid));
  }
  const released=JSON.parse(fs.readFileSync(dir+'/supervisor-complete.json'));assert(released.heavyReleased&&released.bothEOF&&released.actualChildWaits);
  for(const folder of [dir,path.dirname(ROOT+'/'+full.path)]){
    const dependencies=JSON.parse(fs.readFileSync(folder+'/native-dependencies.json'));
    assert(dependencies.nativeFiles.length>0&&dependencies.nativeFiles.every(v=>v.prelaunchPinned),'native prelaunch dependency closure required');
    assert(JSON.parse(fs.readFileSync(folder+'/native-process-absence.json')).allAbsent,'qualification processes remain');
    const post=JSON.parse(fs.readFileSync(folder+'/postflight.json'));
    assert(!post.pinDrift.length&&!post.unPinned.length&&!post.mismatches.length&&post.profileAbsent,'complete qualification postflight required');
  }
  return true;
}
module.exports={BINDING,LIMIT,GL,instrumentation,replaceOnce,workerSource,hostSource,metadata,attribute,compose,controller,recordBinding,installServer,chromeControls,qualified,assertTaskQualification};
if(require.main===module){
  const [mode,out]=process.argv.slice(2);assert(['original','chrome','qualified'].includes(mode));assert(path.resolve(out).startsWith(ROOT+'/'+RUN));
  const watchdog=JSON.parse(fs.readFileSync(out+'/watchdog-armed.json'));
  assert(watchdog.independent&&fs.existsSync('/proc/'+watchdog.pid)&&watchdog.deadline*1000>Date.now());
  assert.equal(JSON.parse(fs.readFileSync(out+'/heavy-lock.json')).pid,process.ppid,'actual supervisor must own heavy runtime');
  if(mode==='original')assert.equal(path.resolve(out),ROOT+'/'+RUN+'original','one fixed original destination');
  if(mode==='qualified')qualified(out);else (mode==='chrome'?chromeControls(out):
    (assertTaskQualification(JSON.parse(fs.readFileSync(out+'/pins.json'))),installServer(out),controller(out).browser(out,'webgl'))).catch(error=>{console.error(error);process.exitCode=1;});
}
