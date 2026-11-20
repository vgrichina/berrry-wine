'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createController}=require('../tools/hexen2-native-consumption-input.cjs');
const old=require('../tools/quake2-native-consumption-input.cjs');
const {createBrowserNativeInput}=require('../lib/browser-native-input.js');
const block=ms=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);
function fixture({beforeMs=0,finalMs=0,writer=false,cancel=false,omit=false,adapter=createController}={}){
  let closed=false,down=0,preparedAt=null,dueAt=null,cancelled=0,consumed=0;
  const events=[];
  const a={capability:'native-manual-context-v1',validate(){if(closed)throw Error('cancelled');},
    async beforeDown(){events.push('capture');block(beforeMs);},consume(){consumed++;}};
  const intent={nonce:'one',name:'action-1',kind:'key',code:67,key:'C',domCode:'KeyC',ms:120,mode:'menu',
    review:'fixture',reviewedAt:Date.now(),imageSHA256:'a'.repeat(64)};
  const release={alive:true,async arm(){events.push('arm');const at=Date.now();return {at,fallback:at+1750,releaseDue:at+1500};},
    due(n,at){dueAt=at;events.push('due');},cancel(){cancelled++;},async finish(){return {independent:true};}};
  const options={page:async method=>{events.push(method);if(method==='prepareEquivalent'){preparedAt=Date.now();return {prepared:{state:'PREPARED'}};}
    return {state:'CONSUMED',consumed:true,receiptBoundary:'owner-worker-native-user-return',
      nativeMessage:{consumption:'owner-user-return',token:1,msg:0x100,wParam:67}};},release,
    close(){closed=true;},dispatch:async(i,publish)=>{block(finalMs);if(writer)throw Error('writer failed');
      if(cancel)closed=true;if(!omit)publish?.();down++;events.push('socket');return {};},record:()=>{}};
  const controller=adapter===old.createController?adapter({...options,equivalence:a}):adapter({...options,manualContext:a});
  return {controller,intent,image:{sha256:intent.imageSHA256,completedAt:Date.now()},
    facts:()=>({events,closed,down,preparedAt,dueAt,cancelled,consumed})};
}
test('retained 325ms preDown +200ms final capture: old expires, new fits fixed500ms',async()=>{
  const previous=fixture({beforeMs:325,finalMs:200,adapter:old.createController});
  await assert.rejects(previous.controller.gesture(previous.intent,previous.image,{}),/UNKNOWN/);
  const f=fixture({beforeMs:325,finalMs:200});await f.controller.gesture(f.intent,f.image,{});
  const s=f.facts();assert(s.events.indexOf('capture')<s.events.indexOf('prepareEquivalent'));
  assert(s.events.indexOf('arm')<s.events.indexOf('prepareEquivalent'));assert.equal(s.down,1);
  assert(s.dueAt>=s.preparedAt+200+120);assert.equal(s.consumed,1);
});
for(const [name,options,pattern]of [
  ['slow final capture',{finalMs:520},/500ms/],
  ['failed final writer',{writer:true},/writer failed/],
  ['cancel during final capture',{cancel:true},/cancelled/],
])test(name+' refuses before socket: zero DOWN, cancellation, sticky scope',async()=>{
  const f=fixture(options);await assert.rejects(f.controller.gesture(f.intent,f.image,{}),pattern);
  assert.equal(f.facts().down,0);assert.equal(f.facts().cancelled,1);assert.equal(f.facts().consumed,1);
  await assert.rejects(f.controller.gesture({...f.intent,nonce:'two'},f.image,{}),/permanently closed/);
  assert.equal(f.facts().down,0);
});
test('transport omitting publication hook cannot claim consumption',async()=>{
  const f=fixture({omit:true});await assert.rejects(f.controller.gesture(f.intent,f.image,{}),/omitted/);
  assert(!f.facts().events.includes('status'));
});
for(const beforeDown of [true,false])test('independent UP tombstones '+(beforeDown?'prepared':'queued')+' DOWN',()=>{
  const scene=[1,1000,65537,65537,0,0,7,0,7,0];let held=false;
  const instance={},renderer={canvas:{},inputQueue:[],windows:{65537:{visible:true,processId:1000,wasm:instance}},
    handleKeyDown(code){held=true;this.inputQueue.push({hwnd:65537,msg:0x100,wParam:code,lParam:0});},
    handleKeyUp(){held=false;},peekKeyDownState:()=>held};
  const wine={renderer,instance,running:true,processId:1000,_processObject:{},memory:{buffer:new ArrayBuffer(64)},
    guestWorker:{link:{slot:0,worker:{},endpointIdentity:1}},hostCtx:{getGlGpsBridge:()=>({})}};
  const gps={endpoint:{}};wine.hostCtx.getGlGpsBridge=()=>gps;
  const g=createBrowserNativeInput(wine,{trusted:()=>true});
  g.withActor(0,'check_input',()=>g.observe(scene));const owner=g.bind().owner;
  g.prepare({nonce:'up',owner,code:67,reviewed:true,reviewedAt:Date.now(),imageSHA256:'a'.repeat(64)});
  if(!beforeDown)renderer.handleKeyDown(67);
  renderer.handleKeyUp(67);renderer.handleKeyDown(67);
  assert.equal(held,false);assert.equal(renderer.inputQueue.length,0);assert.equal(g.status('up').state,'UNKNOWN');
});
