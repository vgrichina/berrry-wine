'use strict';
// Compare the current bounded route against the exact published predecessor.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),Module=require('node:module'),path=require('node:path');
const released=require('../tools/quake3-native-snapshot-latency.cjs');
const BASELINE='b22c360b3c624b40542b4c6dff120f9fd4951e75';
const baselineSource=require('node:child_process').execFileSync('git',['show',BASELINE+':tools/quake3-browser-controller.cjs'],{encoding:'utf8'});
function legacy(){const filename=path.resolve(__dirname,'../tools/quake3-browser-controller.cjs'),m=new Module(filename,module);m.filename=filename;m.paths=module.paths;m._compile(released.compose(baselineSource),filename);return m.exports;}
function identityOperands(identity){
  const out={};
  for(const key of FIELDS){
    const value=identity[key];
    assert(value===undefined||value===null||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value)||typeof value==='string'&&value.length<=256,'bounded identity scalar required: '+key);
    out[key]=value;
  }
  assert(Buffer.byteLength(JSON.stringify(out))<=8192,'bounded identity encoding required');
  return out;
}
function candidateSource(){
  const source=released.compose(baselineSource);
  assert(!source.includes('function identityOperands('));
  const anchor='const MAX_AGE_MS = 30000;';assert.equal(source.split(anchor).length,2);
  return source.replace(anchor,anchor+'\n'+identityOperands.toString()).replaceAll('JSON.stringify(identity)}','JSON.stringify(identityOperands(identity))}');
}
function candidate(){
  const current=fs.readFileSync(path.resolve(__dirname,'../tools/quake3-browser-controller.cjs'),'utf8');
  assert.equal(released.compose(current),candidateSource(),'actual controller differs from prepared serialization-only candidate');
  return require('../tools/quake3-compact-readiness.cjs').controller();
}
function fixture(api){
  const elements=[],rect={left:0,top:0,right:100,bottom:100,width:100,height:100};
  function element(id,tag='DIV',parent=null){const e={id,tagName:tag,isConnected:true,parentElement:parent,childNodes:[],namespaceURI:'http://www.w3.org/1999/xhtml',style:{},
    getBoundingClientRect(){return {...rect,toJSON(){return {...rect};}};},contains(o){for(let p=o;p;p=p.parentElement)if(p===this)return true;return false;}};elements.push(e);return e;}
  const wrap=element('wrap'),canvas=element('screen','CANVAS',wrap),overlay=element('overlay','DIV',wrap),instance={};
  let validations=0;const r={canvas,windows:{7:{hwnd:7,processId:1000,wasm:instance,visible:true,w:100,h:100}},peekKeyDownState:()=>0,_currentDisplayRecord:{},_workerPublicationHeld:()=>false,
    _validateCurrentDisplayCapture(request){validations++;assert.equal(request.owner.window,r.windows[7]);return {displayedAt:123};}};
  const wine={processId:1000,instance,running:true,renderer:r,guestWorker:{link:{endpointIdentity:1,slot:0,worker:{},module:{}}}};
  const c=vm.createContext({Date:{now:()=>1000},crypto:require('node:crypto').webcrypto,crossOriginIsolated:true,innerWidth:100,innerHeight:100,devicePixelRatio:1,
    getComputedStyle:(e,pseudo)=>({display:'block',visibility:'visible',opacity:'1',overflowX:'visible',overflowY:'visible',backgroundColor:'transparent',backgroundImage:'none',boxShadow:'none',backdropFilter:'none',outlineStyle:'none',content:pseudo?'none':undefined,...e.style}),
    document:{visibilityState:'visible',fullscreenElement:wrap,hasFocus:()=>true,querySelector:()=>null,querySelectorAll:q=>q==='*'?elements:[],elementsFromPoint:()=>[canvas,wrap],getElementById:()=>canvas},runningApps:[{name:'quake3_demo',wine}],__q3VisibilityOperands:()=>{}});
  const identity=vm.runInContext(api.PAGE_READ,c).apps[0];
  return {c,r,wine,canvas,overlay,identity,validations:()=>validations};
}
const plain=x=>JSON.parse(JSON.stringify(x));
test('bounded scalar projection removes unconsumed diagnostic data without changing the page guard source',()=>{
  const api=candidate(),old=legacy(),f=fixture(old);
  f.identity.outputVisibility.operands.large='x'.repeat(600000);
  f.identity.slice={nested:'x'.repeat(100000)};
  const full=old.readinessExpression(f.identity),compact=api.readinessExpression(f.identity);
  assert(full.length>700000);assert(compact.length<18000);
  assert.deepEqual(plain(vm.runInContext(compact,f.c)),plain(vm.runInContext(full,f.c)));
  assert.equal(f.validations(),2);
  assert.throws(()=>api.readinessExpression(Object.fromEntries(old.FIELDS.map(k=>[k,'\x00'.repeat(256)]))),/bounded identity encoding/);
  for(const bad of [Infinity,NaN,{},[],()=>{},'x'.repeat(257)])assert.throws(()=>api.readinessExpression({...f.identity,processObject:bad}),/bounded identity scalar/);
});
test('ready, pending publication, held paint, ordinary damage, missing display and validator errors agree',()=>{
  const old=legacy(),api=candidate();
  for(const kind of ['ready','dirty','locked','due','held','gdi','repainting','scheduled','pending','deferred','missing','error'])for(const allowDamage of [false,true]){
    const f=fixture(old);
    if(kind==='dirty')f.wine._dxDirty=true;if(kind==='locked')f.wine._dxLockDeferred=true;if(kind==='due')f.wine._presentFrameDue=true;
    if(kind==='held')f.r._workerPublicationHeld=()=>true;if(kind==='gdi')f.r._workerGdiPaintDepth=1;if(kind==='repainting')f.r._repainting=true;
    if(kind==='scheduled')f.r._repaintScheduled=true;if(kind==='pending')f.r._repaintPending=true;if(kind==='deferred')f.r._workerRepaintDeferred=true;
    if(kind==='missing')f.r._currentDisplayRecord=null;if(kind==='error')f.r._validateCurrentDisplayCapture=()=>{throw Error('receipt error');};
    const invoke=a=>{try{return {value:plain(vm.runInContext(a.readinessExpression(f.identity,false,allowDamage),f.c))};}catch(e){return {error:e.message};}};
    assert.deepEqual(invoke(api),invoke(old),kind+'/'+allowDamage);
  }
});
test('every compared identity, output selection exception, replacement and overlay guard agrees',()=>{
  const old=legacy(),api=candidate();
  const excluded=['workerTarget','workerInstance','moduleSha256','rendererTarget','rendererEpoch','rendererModuleSha256'];
  for(const key of old.FIELDS.filter(k=>!excluded.includes(k))){const f=fixture(old),identity={...f.identity,[key]:'changed'};
    for(const a of [old,api])assert.throws(()=>vm.runInContext(a.readinessExpression(identity),f.c),new RegExp('startup identity changed '+key));
  }
  for(const kind of ['replacement','overlay','hidden','not-isolated','stopped','select-output']){
    const f=fixture(old);if(kind==='replacement')f.c.runningApps[0].wine={...f.wine};if(kind==='overlay')f.overlay.style.backgroundColor='red';
    if(kind==='hidden')f.canvas.isConnected=false;if(kind==='not-isolated')f.c.crossOriginIsolated=false;if(kind==='stopped')f.wine._stopped=true;
    if(kind==='select-output')f.identity.outputCanvasObject='different';
    const invoke=a=>{try{return {value:plain(vm.runInContext(a.readinessExpression(f.identity,kind==='select-output'),f.c))};}catch(e){return {error:e.message};}};
    assert.deepEqual(invoke(api),invoke(old),kind);
  }
});
test('candidate changes serialization only; source checks, capture and finite input admission remain',()=>{
  const source=released.compose(baselineSource),candidate=candidateSource();
  assert.equal(candidate.replace('\n'+identityOperands.toString(),'').replaceAll('JSON.stringify(identityOperands(identity))}','JSON.stringify(identity)}'),source);
  for(const word of ['_validateCurrentDisplayCapture','Debugger.getScriptSource','1750','3000','CAPTURE_PRECONDITION_REFUSED','actual owning renderer','bounded PREBIND startup'])assert(candidate.includes(word));
});
test('capture passive refusal retains no-ticket/no-input behavior with bounded nested operands',async()=>{
  const old=legacy(),api=candidate(),f=fixture(old);f.wine._dxDirty=true;
  f.identity.outputVisibility.operands.large='x'.repeat(600000);
  for(const a of [old,api]){
    const sent=[];let tick=1000,result;
    await assert.rejects(a.captureScene({identity:f.identity,now:()=>tick,evaluate:async expression=>{sent.push(expression);result=vm.runInContext(expression,f.c);tick=4000;return result;}}),/capture passive readiness deadline/);
    assert.equal(sent.length,1);assert.equal(result.state,'NOT_READY');assert.equal(result.requestCalled,false);assert.equal(result.ticketCreated,false);assert.equal(result.inputDispatched,false);
    assert.equal(f.validations(),0);assert.equal(f.c.__gltronCaptureTicketV1,undefined);
    if(a===api)assert(Buffer.byteLength(sent[0])<35000);else assert(Buffer.byteLength(sent[0])>1200000);
  }
});
test('UNKNOWN from readiness evaluation closes startup chain without another readiness request',async()=>{
  // awaitStartupReady itself propagates the terminal error immediately. The
  // controller transport owns irreversible UNKNOWN; its existing tests remain required.
  const api=candidate();let calls=0;
  await assert.rejects(api.awaitStartupReady({identity:{},deadline:Date.now()+1000,evaluate:async()=>{calls++;throw Error('UNKNOWN');}}),/UNKNOWN/);
  assert.equal(calls,1);
});
module.exports={candidate,candidateSource,identityOperands};

test('new route retains closed original destination and requires fresh compact qualification',()=>{
  const api=require('../tools/quake3-compact-readiness.cjs');
  assert.equal(released.RUN,'scratch/runs/20261115-quake3-latency-after-census-repair/');
  assert.equal(api.RUN,'scratch/runs/20261115-quake3-compact-readiness-gameplay/');
  api.legacyController();
  assert.throws(()=>api.assertCompactQualification({}),/fresh bounded readiness qualification/);
  const q=api.qualificationSource(fs.readFileSync(path.resolve(__dirname,'quake3-browser-controller.test.cjs'),'utf8'));
  assert(q.includes('chromeEquivalence({evaluate,cdp,report'));new vm.Script(q);
});
