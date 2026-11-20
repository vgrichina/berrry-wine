'use strict';
// Production session and native-input guard with controlled owner observations.
// No browser, guest execution or native consumption qualification is claimed.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const adapter=require('../tools/hexen2-native-consumption-input.cjs');
const common=require('../tools/gltron-current-native-input.cjs');
const {verifyPageEquivalence}=require('../lib/browser-reviewed-frame-equivalence.cjs');
const {createBrowserNativeInput}=require('../lib/browser-native-input.js');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fixture(){
 const scene=[1,1000,65537,65537,0,65537,7,0,7,0],words=[2,65537,7,0,1,1000];
 const instance={exports:{capture_publication_word:i=>words[i],get_authoritative_capture_hwnd:()=>65537,
  wnd_lookup_live:()=>1,wnd_lookup_generation:()=>7n,get_window_thread:()=>1}};
 const gps={endpoint:{},presenter:{layer:{canvas:{}}}};
 const renderer={canvas:{},inputQueue:[],windows:{65537:{visible:true,processId:1000,wasm:instance}},
  handleKeyDown(){},handleKeyUp(){},handleMouseDown(){},handleMouseUp(){},peekKeyDownState:()=>0};
 const wine={instance,renderer,processId:1000,running:true,_processObject:{},_wasmModule:{},memory:{buffer:new ArrayBuffer(64)},
  hostCtx:{getGlGpsBridge:()=>gps},guestWorker:{link:{slot:0,worker:{},endpointIdentity:1}}};
 const guard=createBrowserNativeInput(wine,{trusted:()=>true});wine._browserNativeInput=guard;
 const root={document:{hasFocus:()=>true,visibilityState:'visible'}};
 const observe=()=>guard.withActor(0,'check_input',()=>guard.observe(scene));
 const key=crypto.randomBytes(32).toString('hex');
 const helpers={...common,verifyPageEquivalence,inspectNativeRoute:()=>({running:true,guestWorker:true,
  scopes:[{currentContext:true,guardedInput:true,nativeInputActor:true,tokenImport:true,consumedImport:true}],bridge:guard.snapshot()})};
 const session=adapter.createHexenSession(root,wine,helpers,{manualContextKey:key});
 const sourceAt=Date.now();observe();session.observe();const native=session.context();
 await sleep(2);const freshAt=Date.now();await sleep(2);const completedAt=Date.now();
 const intent={kind:'key',code:65,key:'a',domCode:'KeyA',nonce:crypto.randomUUID(),name:'action-0',ms:80,
  mode:'menu',review:'explicit authored fixture context',reviewedAt:sourceAt,imageSHA256:'a'.repeat(64),completedAt:sourceAt};
 const digest=i=>JSON.stringify([i.nonce,i.name,i.kind,i.code,i.button??null,i.x??null,i.y??null,i.key??null,i.domCode??null,
  i.ms,i.mode,i.review,i.reviewedAt,i.imageSHA256]);
 const shape={width:800,height:600,orientation:'top-left-row-major-RGBA8'};
 const body={version:'native-manual-context-v1',id:crypto.randomUUID(),intent:digest(intent),
  source:{...shape,rgbaSHA256:'b'.repeat(64),sha256:intent.imageSHA256,at:sourceAt,completedAt:sourceAt,reviewedAt:sourceAt},
  fresh:{...shape,rgbaSHA256:'c'.repeat(64),at:freshAt,completedAt,personallyReviewed:false},identity:{native}};
 const sign=(value=body,secret=key)=>{const payload=JSON.stringify(value);return {payload,
  signature:crypto.createHmac('sha256',Buffer.from(secret,'hex')).update(payload).digest('hex')};};
 return {wine,gps,guard,root,scene,session,observe,key,intent,body,sign,sourceAt};
}
(async()=>{
 let tests=0;
 for(const variant of ['pre-fresh','equal-fresh','post-fresh','stricter-caller']){
  const f=await fixture();let bound=f.sourceAt-1;
  if(variant==='equal-fresh')f.body.fresh.at=f.body.fresh.completedAt=f.guard.snapshot().observedAt;
  if(variant==='post-fresh'){await sleep(2);f.observe();}
  if(variant==='stricter-caller'){await sleep(2);f.observe();bound=Date.now()+100;}
  const value=await f.session.prepareEquivalent(f.intent,bound,f.sign());
  assert.equal(!!value.prepared,variant==='post-fresh');
  if(value.prepared)assert.equal(value.prepared.state,'PREPARED');
  f.session.close('fixture complete');console.log('PASS manual signed fresh USER '+variant);tests++;
 }
 const cases={
  forged:f=>({signature:'0'.repeat(64)}),
  borrowed:f=>({envelope:f.sign(f.body,'d'.repeat(64))}),
  wrongkind:f=>{f.body.version='native-whole-frame-equivalence-v1';},
  stale:f=>{f.body.fresh.at-=6000;},
  reviewedCurrent:f=>{f.body.fresh.personallyReviewed=true;},
  oldSource:f=>{f.body.source.at-=30000;},
  oldReview:f=>{f.body.source.reviewedAt-=16000;f.intent.reviewedAt-=16000;},
  changedIntent:f=>{f.intent.code=66;},
  changedOwner:f=>{f.body.identity.native.owner='alien';},
  module:f=>{f.wine._wasmModule={};},
  memory:f=>{f.wine.memory={buffer:new ArrayBuffer(64)};},
  endpoint:f=>{f.wine.guestWorker.link.endpointIdentity++;},
  focus:f=>{f.root.document.hasFocus=()=>false;},
  modal:f=>{f.scene[4]=65538;f.observe();},
  retire:f=>{f.gps.endpoint.closed=true;},
  cancel:f=>{f.session.close('cancelled');},
  error:f=>{f.root.document.hasFocus=()=>{throw Error('observer failure');};},
  mutability:f=>({envelope:{...f.sign(),payload:f.sign().payload.replace('manual-context','mutated-context')}}),
 };
 for(const [name,mutate]of Object.entries(cases)){
  const f=await fixture();await sleep(2);f.observe();const change=mutate(f)||{};
  const envelope=change.envelope||{...f.sign(),...change};let down=0;
  await assert.rejects(async()=>{await f.session.prepareEquivalent(f.intent,f.sourceAt,envelope);down++;});
  assert.equal(down,0);assert(f.guard.snapshot().terminal||!f.guard.snapshot().healthy);
  console.log('PASS '+name+' zeroDOWN session closes');tests++;
 }
 {
  const f=await fixture();await sleep(2);f.observe();const p=f.sign();
  assert((await f.session.prepareEquivalent(f.intent,f.sourceAt,p)).prepared);
  await assert.rejects(f.session.prepareEquivalent(f.intent,f.sourceAt,p),/nonce reused/);tests++;
 }
 assert.throws(()=>adapter.createController({equivalence:{capability:'native-manual-context-v1'}}),/explicit manualContext/);
 assert.throws(()=>adapter.createHexenSession({}, {}, {}, {manualContextKey:''}),/manual-context key/);
 assert.throws(()=>adapter.createHexenSession({}, {}, {}, {manualContextKey:'a'.repeat(64),equivalenceKey:'b'.repeat(64)}),/choose one/);
 console.log('PASS '+tests+' manual session controls; explicit-option/key/ambiguity guards');
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
