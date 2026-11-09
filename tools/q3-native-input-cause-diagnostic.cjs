'use strict';
// Standalone OFFLINE comparison, or explicit opt-in generated-fixture preload.
// Adds no CDP request, timer, input, capture, promise settlement or guest read.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib');
const composition=require('./q3-native-driver-composition.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const MARKER='q3-native-input-cause-v1';

// Installed in the generated document before its genuine fixture handlers.
// Console delivery is asynchronous: absence never proves nonexecution.
function pageDiagnostic(scope, marker) {
  let count=0,observer;
  function emit(phase,details={}) {
    try {
      if(count++>=64)return;
      scope.console.debug(marker,JSON.stringify({phase,sequence:count,eventCap:64,ms:scope.performance.now(),
        timeOrigin:scope.performance.timeOrigin,...details}));
    } catch {} // Diagnostic failure must not change the input outcome.
  }
  function input(phase,event,details={}) {
    emit(phase,{type:event.type,key:event.key,code:event.code,keyCode:event.keyCode,
      trusted:event.isTrusted,...details});
  }
  try {
    for(const type of ['keydown','keyup'])scope.addEventListener(type,
      event=>input('dom-capture',event),true);
  } catch {emit('capture-observer-unavailable');}
  try {
    observer=new scope.PerformanceObserver(list=>{
      for(const entry of list.getEntries())emit('longtask',{
        startTime:entry.startTime,duration:entry.duration,name:entry.name});
    });
    observer.observe({type:'longtask',buffered:true});
    emit('installed',{longtask:true});
  } catch {emit('installed',{longtask:false});}
  // The observer remains reachable through the actual handler closure.
  return {input,observer};
}

function fixtureSource(source) {
  assert(!source.includes(MARKER),'duplicate Q3 cause diagnostic');
  const replace=composition.replaceOnce;
  source=replace(source,'  class FixtureInput {}',
    `  const cause=(${pageDiagnostic.toString()})(scope,${JSON.stringify(MARKER)});\n  class FixtureInput {}`);
  source=replace(source,'      renderer[type === \'keydown\' ? \'handleKeyDown\' : \'handleKeyUp\'](event.keyCode, info);',
    `      cause.input('renderer-handler-entry',event);
      try {
        renderer[type === 'keydown' ? 'handleKeyDown' : 'handleKeyUp'](event.keyCode, info);
      } catch(error) {
        cause.input('renderer-handler-throw',event,{error:String(error)});throw error;
      }
      cause.input('renderer-handler-return',event);`);
  // These markers bracket the synchronous handler only. They cannot prove
  // CDP response production, an actual held interval, or guest input service.
  new vm.Script(require('node:module').wrap(source));
  return source;
}
function consumerSource(source) {
  return composition.replaceOnce(source,
    "session:v.sessionId,type:v.params.type,args:v.params.args.map",
    "session:v.sessionId,executionContextId:v.params.executionContextId,type:v.params.type,args:v.params.args.map");
}
function install() {
  const Module=require('node:module'),root=path.resolve(__dirname,'..');
  assert.equal(path.resolve(process.argv[1]||''),path.join(root,composition.consumerPath));
  assert.equal(process.env.Q3_NATIVE_COMPOSITION,'1');
  const previous=Module._extensions['.cjs'];
  Module._extensions['.cjs']=function(module,filename) {
    const transform=filename===path.join(root,composition.fixturePath)?fixtureSource:
      filename===path.join(root,composition.consumerPath)?consumerSource:null;
    if(!transform)return previous(module,filename);
    const compile=module._compile;
    module._compile=function(source,name){return compile.call(this,transform(source),name);};
    try {return previous(module,filename);} finally {module._compile=compile;}
  };
}

function boundaries(consoleRows) {
  const groups=new Map();
  for(const row of consoleRows) {
    if(row.args?.[0]!==MARKER)continue;
    const value=JSON.parse(row.args[1]);
    // Context IDs are local to a session; never correlate on context ID alone.
    assert(typeof row.session==='string'&&Number.isInteger(row.executionContextId),'diagnostic session/context missing');
    const key=JSON.stringify([row.session,row.executionContextId]);
    if(!groups.has(key))groups.set(key,{sessionId:row.session,executionContextId:row.executionContextId,events:[]});
    groups.get(key).events.push(value);
  }
  return [...groups.values()].map(group=>{
    const phase=[...group.events].reverse().find(v=>['renderer-handler-return','renderer-handler-throw',
      'renderer-handler-entry','dom-capture'].includes(v.phase))?.phase;
    return {...group,lastProvenBoundary:phase==='renderer-handler-return'?'synchronous renderer handler returned':
      phase==='renderer-handler-throw'?'synchronous renderer handler threw':
      phase==='renderer-handler-entry'?'renderer handler entered; return UNKNOWN':
      phase==='dom-capture'?'DOM input capture reached; handler entry UNKNOWN':'installed; input delivery UNKNOWN',
      scope:'Observed events only; no association with a particular CDP request or physical hold inferred'};
  });
}

function retained(directory) {
  const manifest=JSON.parse(z.gunzipSync(fs.readFileSync(path.join(directory,'prepared/native-retrieval.json.gz'))));
  const proofs=[];
  function read(suffix) {
    const matches=manifest.records.filter(v=>(v.logicalPath||v.path).endsWith('/'+suffix));
    assert.equal(matches.length,1,'unique retained artifact: '+suffix);
    const v=matches[0],file=path.resolve(directory,v.local);
    assert(file.startsWith(path.resolve(directory)+path.sep),'retained path escapes run');
    const stored=fs.readFileSync(file);
    assert.equal(stored.length,v.storedSize);assert.equal(sha(stored),v.storedSha256);
    const raw=z.gunzipSync(stored); // validates every gzip member and CRC
    assert.equal(raw.length,v.originalSize);assert.equal(sha(raw),v.originalSha256);
    proofs.push({path:v.logicalPath||v.path,local:v.local,sha256:v.originalSha256,size:raw.length});
    return raw.toString();
  }
  const lines=s=>read(s).trim().split('\n').filter(Boolean).map(JSON.parse);
  const trace=lines('await-trace.jsonl.gz'),wire=lines('input-wire.jsonl.gz');
  const execution=lines('execution-boundary.jsonl.gz');
  const requests=trace.filter(v=>v.event==='entry'&&v.name==='cdp.request');
  const endings=new Map(trace.filter(v=>['exit','error'].includes(v.event)).map(v=>[v.id,v]));
  const first=requests.find(v=>v.method.startsWith('Input.'));assert(first,'actual input entry required');
  const wireEvents=wire.flatMap(v=>v.events);
  assert(wire.every(v=>v.dropped===0&&v.observerErrors===0&&v.sinkFailure===null),'lossy input observation');
  const rows=new Map(execution.flatMap(v=>v.records).map(v=>[JSON.stringify([v.sessionId,v.requestId]),v]));
  const nearby=requests.filter(v=>v.requestId>=first.requestId-12&&v.requestId<=first.requestId+6).map(v=>{
    const end=endings.get(v.id),marker=rows.get(JSON.stringify([v.sessionId,v.requestId]));
    return {requestId:v.requestId,method:v.method,sessionId:v.sessionId,targetId:v.targetId,
      expression:v.expression,started:v.epochMs,end:end?.epochMs??null,
      outcome:end?.event??'UNSETTLED',elapsedMs:end?.elapsedMs??null,
      executionContextId:marker?.entry?.executionContextId??null,
      synchronousJsMs:marker?.synchronousJsMs??null,execution:marker?.execution??'UNOBSERVED'};
  });
  const inputs=nearby.filter(v=>v.method.startsWith('Input.')).map(v=>{
    const events=wireEvents.filter(e=>e.requestId===v.requestId&&e.sessionId===v.sessionId);
    return {...v,events,rawMatchingReplies:events.filter(e=>e.kind==='raw-matching-reply').length};
  });
  const activeAtDown=requests.filter(v=>v.requestId!==first.requestId&&v.epochMs<=first.epochMs&&
    (!endings.has(v.id)||endings.get(v.id).epochMs>first.epochMs)).map(v=>({requestId:v.requestId,method:v.method,sessionId:v.sessionId}));
  const lastPage=[...nearby].reverse().find(v=>v.requestId<first.requestId&&v.sessionId===first.sessionId&&v.method==='Runtime.evaluate');
  const terminal=wire.find(v=>v.firstTerminal)?.firstTerminal??null;
  const lastInput=inputs.at(-1)?.events.find(v=>v.kind==='socket-send-return');
  const consoleRows=lines('console.jsonl.gz');
  const deliveryName=manifest.records.some(v=>(v.logicalPath||v.path).endsWith('/input-positive-webgl-delivery.json'))?
    'input-positive-webgl-delivery.json':'input-positive-webgl-hold.json';
  const delivery=JSON.parse(read(deliveryName));
  const helperReceipt={holdMs:delivery.holdMs,ok:delivery.ok,started:delivery.started,
    releaseAt:delivery.releaseAt,firstFailure:delivery.firstFailure??null,events:delivery.events,
    sampleCount:delivery.samples.length,actualHeldInterval:delivery.actualHeldInterval,guestPolls:delivery.guestPolls};
  const failureAt=delivery.firstFailure?.at;
  const pendingAtHelperFailure=failureAt===undefined?null:requests.filter(v=>v.epochMs<=failureAt&&
    (!endings.has(v.id)||endings.get(v.id).epochMs>failureAt)).map(v=>v.requestId);
  const laterInputCapture=failureAt===undefined?null:requests.filter(v=>v.epochMs>failureAt&&
    (v.method.startsWith('Input.')||v.method==='Page.captureScreenshot')).map(v=>v.requestId);
  return {directory,proofs,firstInput:first.requestId,inputs,nearby,lastPage,activeAtDown,
    helperReceipt,pendingAtHelperFailure,laterInputCapture,
    firstTerminal:terminal,upSocketReturnToTerminalMs:terminal&&lastInput?terminal.nodeMonotonicMs-lastInput.nodeMonotonicMs:null,
    diagnosticBoundaries:boundaries(consoleRows),
    nodeReleaseSubmissionMs:inputs[1]?.events[0]?.nodeMonotonicMs-inputs[0]?.events[0]?.nodeMonotonicMs,
    boundary:'socket-return -> browser receipt / DOM input dispatch / handler return / response production UNKNOWN',
    limits:'Trace exit is caller settlement; console receipt can lag execution. No cross-process clock subtraction. No native qualification.'};
}
function compare(success,failure) {
  const before=retained(success),after=retained(failure);
  const pins=dir=>JSON.parse(z.gunzipSync(fs.readFileSync(path.join(dir,'runtime-pins.json.gz'))));
  const a=pins(success),b=pins(failure),am=new Map(a.files.map(v=>[v.path,v]));
  const changedPins=b.files.filter(v=>am.has(v.path)&&am.get(v.path).sha256!==v.sha256).map(v=>({path:v.path,before:am.get(v.path).sha256,after:v.sha256}));
  // Reconstruct both real generated providers in memory from Git, with every
  // provider pin checked by compose(). No source tree or module copies.
  function flows(pins) {
    assert(/^[a-f0-9]{40}$/.test(pins.commit),'exact Git base required');
    const relative='tools/q3-native-driver-composition.cjs',filename=path.join(__dirname,path.basename(relative));
    const source=require('node:child_process').execFileSync('git',['show',pins.commit+':'+relative]);
    assert.equal(sha(source),pins.files.find(v=>v.path===relative).sha256,'actual composition pin');
    const box={exports:{}};
    vm.runInNewContext(source.toString(),{module:box,require:require('node:module').createRequire(filename),
      __dirname,Buffer,process:{env:{}}},{filename});
    const result=box.exports.compose();
    const start=result.source.indexOf('function send('),end=result.source.indexOf('\nasync function evaluate',start);
    assert(start>=0&&end>start,'actual generated send boundary');
    const messageStart=result.source.indexOf('ws.onmessage=msg=>'),messageEnd=result.source.indexOf("\n save('browser-version",messageStart);
    assert(messageStart>=0&&messageEnd>messageStart,'actual generated receive boundary');
    return {compositionSha256:sha(source),sendSha256:sha(result.source.slice(start,end)),
      receiveSha256:sha(result.source.slice(messageStart,messageEnd)),fixtureSha256:sha(result.fixtureSource),
      controlsSha256:sha(result.controlsSource??fs.readFileSync(path.join(__dirname,'..',
        path.dirname(composition.consumerPath),'local-controls.cjs')))};
  }
  const sourceFlows=[flows(a),flows(b)];
  return {version:1,cause:'UNKNOWN',before,after,gitBases:[a.commit,b.commit],changedPins,sourceFlows,
    nextBoundary:'Use opt-in fixture handler/DOM/longtask markers in existing console stream, correlated by session AND executionContextId; no input retry authorized.',
    native:'REVOKED',allwriters:'UNKNOWN',edictABA:'UNKNOWN',actualBoatcancel:'NOT_PROVEN'};
}
module.exports={pageDiagnostic,fixtureSource,consumerSource,install,retained,compare,boundaries,MARKER};
if(process.env.Q3_NATIVE_INPUT_CAUSE==='1')install();
if(require.main===module) {
  assert.equal(process.argv.length,4,'usage: node tools/q3-native-input-cause-diagnostic.cjs SUCCESS_RUN FAILED_RUN');
  process.stdout.write(JSON.stringify(compare(process.argv[2],process.argv[3]),null,2)+'\n');
}
