'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const diagnostic=require('./q3-native-input-cause-diagnostic.cjs');
const composition=require('./q3-native-driver-composition.cjs');
const execution=require('./q3-execution-boundary.cjs');
const wire=require('./q3-input-wire-observation.cjs');
const {installFixtureInput}=require('./q3-fixture-input.cjs');
const {installInputHandlers}=require('../lib/renderer-input.js');

// Real generated listener and production renderer methods, with no browser,
// transport replies, WASM guest, input ACK or timeout replay. Events below are
// explicitly inert unit inputs; trusted:true is never native evidence.
function page(enabled,{sinkFailure=false,longtask=true}={}) {
  const listeners=new Map(),logs=[];let clock=0,performanceCallback;
  const scope={installInputHandlers,performance:{now:()=>++clock,timeOrigin:1000},
    console:{debug(...args){if(sinkFailure)throw Error('inert sink failure');logs.push({session:'page',executionContextId:1,args});}},
    addEventListener(type,fn,capture){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push({fn,capture});},
    PerformanceObserver:longtask?class {constructor(fn){performanceCallback=fn;}observe(options){assert.equal(options.type,'longtask');assert(options.buffered);}}:undefined};
  const renderer={windows:{},peekKeyDownState:()=>0};
  const link={worker:{},module:{},endpointIdentity:1,slot:0};
  const wine={running:true,renderer,guestWorker:{link}};
  const source='('+installFixtureInput.toString()+')';
  vm.runInNewContext(enabled?diagnostic.fixtureSource(source):source)({renderer,wine,link,scope});
  return {renderer,wine,scope,logs,performanceCallback,
    event(type,trusted=true){const e={type,isTrusted:trusted,keyCode:13,key:'Enter',code:'Enter',preventDefault(){this.prevented=true;}};
      for(const {fn} of [...listeners.get(type)].sort((a,b)=>!!b.capture-!!a.capture))fn(e);return e;}};
}
const snapshot=p=>JSON.parse(JSON.stringify({physical:p.renderer.peekKeyDownState(13),queue:p.renderer.inputQueue,
  error:p.scope.__generatedError??null}));
for(const options of [{},{sinkFailure:true},{longtask:false}]) {
  const old=page(false,options),observed=page(true,options);
  for(const [type,trusted] of [['keydown',false],['keydown',true],['keyup',true]]) {
    assert.equal(old.event(type,trusted).prevented,observed.event(type,trusted).prevented);
    assert.deepEqual(snapshot(old),snapshot(observed),'production physical/queue outcomes unchanged');
  }
  assert.equal(observed.renderer.peekKeyDownState(13),0);
  assert.equal(diagnostic.boundaries(old.logs).length,0,'old missing boundary');
  if(!options.sinkFailure) {
    const group=diagnostic.boundaries(observed.logs)[0];
    assert.equal(group.lastProvenBoundary,'synchronous renderer handler returned');
    const events=group.events;
    assert.equal(events.filter(v=>v.phase==='renderer-handler-entry').length,2,'untrusted event never enters fixture handler');
    assert.equal(events.filter(v=>v.phase==='renderer-handler-return').length,2);
    assert.equal(events.filter(v=>v.phase==='dom-capture').length,3);
  }
}
// Observe an actual production-handler exception while preserving the existing
// fixture catch/outcome. No diagnostic can transform it into success.
const old=page(false),observed=page(true);
for(const p of [old,observed]) {
  p.renderer._seedKeyboardFocus=()=>{throw Error('inert synchronous failure');};
  p.event('keydown');
}
assert.deepEqual(snapshot(old),snapshot(observed));
assert.match(snapshot(observed).error,/inert synchronous failure/);
assert.equal(diagnostic.boundaries(observed.logs)[0].lastProvenBoundary,'synchronous renderer handler threw');
// Lifecycle refusal remains before handler entry.
const stale=page(true);stale.wine.running=false;stale.event('keydown');
assert.match(stale.scope.__generatedError,/owner changed/);
assert(!diagnostic.boundaries(stale.logs)[0].events.some(v=>v.phase==='renderer-handler-entry'));
assert.equal(stale.renderer.peekKeyDownState(13),0);
// The passive longtask channel and output are bounded independently of input.
const bounded=page(true);
bounded.performanceCallback({getEntries:()=>[{startTime:3,duration:150,name:'self'}]});
assert(diagnostic.boundaries(bounded.logs)[0].events.some(v=>v.phase==='longtask'&&v.duration===150));
for(let i=0;i<100;i++)bounded.event('keyup');
assert.equal(bounded.logs.length,64);assert.equal(bounded.renderer.peekKeyDownState(13),0);
// Same context number in another session must remain a separate group.
const other=observed.logs.map(v=>({...v,session:'worker'}));
assert.equal(diagnostic.boundaries([...observed.logs,...other]).length,2);
const entered={session:'page',executionContextId:1,args:[diagnostic.MARKER,JSON.stringify({phase:'renderer-handler-entry',type:'keyup'})]};
assert.equal(diagnostic.boundaries([...observed.logs,entered])[0].lastProvenBoundary,'renderer handler entered; return UNKNOWN','earlier callback outcome cannot qualify later callback');
assert.throws(()=>diagnostic.boundaries([{args:[diagnostic.MARKER,'{}']}]),/session\/context/);

const composed=composition.compose();
const consumer=diagnostic.consumerSource(composed.source),fixture=diagnostic.fixtureSource(composed.fixtureSource);
assert.equal(consumer.replace('executionContextId:v.params.executionContextId,',''),composed.source,'console metadata is the only consumer difference');
assert(fixture.includes("cause.input('renderer-handler-return',event)"));
assert.throws(()=>diagnostic.fixtureSource(fixture),/duplicate/);
assert.throws(()=>diagnostic.consumerSource(consumer),/missing\/nonunique/);
new vm.Script(require('node:module').wrap(consumer));
// Exercise the real preload chain against the actual composed providers.
// The compiler sink captures code instead of executing the browser consumer.
const Module=require('node:module'),extension=Module._extensions['.cjs'];
const argv=process.argv[1],env={...process.env},append=fs.appendFileSync,socket=globalThis.WebSocket;
try {
  process.argv[1]=require('node:path').resolve(composition.consumerPath);
  process.env.Q3_NATIVE_COMPOSITION='1';process.env.Q3_EXECUTION_BOUNDARY_OUT='/offline-only/execution.jsonl.gz';
  composition.install();diagnostic.install();wire.install();
  globalThis.WebSocket=execution.install({WebSocket:socket,trace:{snapshot(){}},write(){}}).WebSocket;
  const outputs=[];
  for(const file of [composition.consumerPath,composition.fixturePath]) {
    Module._extensions['.cjs']({_compile(source,name){outputs.push({source,name});}},require('node:path').resolve(file));
  }
  assert.equal(outputs[0].source,wire.integrate(consumer));assert.equal(outputs[1].source,fixture);
} finally {
  Module._extensions['.cjs']=extension;process.argv[1]=argv;fs.appendFileSync=append;globalThis.WebSocket=socket;
  for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];
  Object.assign(process.env,env);
}

const report=diagnostic.compare('scratch/runs/20261109-q3-observed-input-native-gameplay-1055',
  'scratch/runs/20261109-q3-corrected-controls-native-1130');
assert.equal(report.cause,'UNKNOWN');
assert.equal(report.before.firstInput,109);assert.equal(report.after.firstInput,193);
assert.deepEqual(report.before.inputs.map(v=>v.rawMatchingReplies),[1,1]);
assert.deepEqual(report.after.inputs.map(v=>v.rawMatchingReplies),[0,0]);
assert.equal(report.after.lastPage.requestId,192);assert.equal(report.after.lastPage.elapsedMs,2);
assert.equal(report.after.lastPage.executionContextId,1);
assert(report.after.lastPage.synchronousJsMs<1);
assert.deepEqual(report.after.activeAtDown,[]);
assert.deepEqual(report.after.pendingAtHelperFailure,[193,194]);
assert.deepEqual(report.after.laterInputCapture,[]);
assert.equal(report.after.helperReceipt.holdMs,100);
assert.equal(report.after.helperReceipt.ok,false);
assert.equal(report.before.helperReceipt.ok,true);
assert.equal(report.after.diagnosticBoundaries.length,0,'retained native DOM/handler boundary UNKNOWN');
assert(report.after.nodeReleaseSubmissionMs>=99&&report.after.nodeReleaseSubmissionMs<102);
assert(report.after.upSocketReturnToTerminalMs<5,'UP missing reply is censored by immediate terminal');
assert(report.changedPins.some(v=>v.path==='tools/q3-native-driver-composition.cjs'));
assert(!report.changedPins.some(v=>v.path==='lib/renderer-input.js'||v.path==='tools/q3-input-delivery.cjs'||v.path==='tools/q3-fixture-input.cjs'));
for(const field of ['sendSha256','receiveSha256','fixtureSha256'])assert.equal(report.sourceFlows[0][field],report.sourceFlows[1][field],field+' unchanged actual generated flow');
assert.notEqual(report.sourceFlows[0].controlsSha256,report.sourceFlows[1].controlsSha256);
console.log('PASS offline real-source diagnostic: physical/queue parity, throw/refusal/sink failure, bounded longtask/DOM markers, session/context isolation, actual composed preload, SHA/size/CRC retained 1055 vs 1130; cause UNKNOWN, no native retry');
