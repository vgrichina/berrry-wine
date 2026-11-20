'use strict';
// Real browser + native root capture; no retained-run dependencies. The page is
// authored static content, not a game or a native USER consumption claim.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {PNG}=require('pngjs');
const {createNativeEquivalence,verifyPageEquivalence}=require('../lib/browser-reviewed-frame-equivalence.cjs');
const {reviewed,createController}=require('../tools/quake2-native-consumption-input.cjs');
const {captureWhole,create}=require('../tools/browser-transients.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// Model only native owner state here; real full-root capture/equality is tested
// below. Use the actual guard, common USER helper and signed page verifier.
async function freshUserControls(){
 const {createBrowserNativeInput}=require('../lib/browser-native-input.js');
 const common=require('../tools/gltron-current-native-input.cjs');
 let factory=require('../tools/quake2-native-consumption-input.cjs').createQuake2Session;
 if(process.env.QUAKE2_EQUIVALENCE_BASELINE){
  const Module=require('node:module'),m=new Module(__filename,module);
  m.filename=path.resolve(__dirname,'../tools/quake2-native-consumption-input.cjs');m.paths=module.paths;
  m._compile(cp.execFileSync('git',['show','ccdd47c986193c42d56f216619ba4a6834d239f9:tools/quake2-native-consumption-input.cjs'],{encoding:'utf8'}),m.filename);
  factory=m.exports.createQuake2Session;
 }
 for(const variant of ['pre-fresh','equal-fresh','post-fresh','stricter-caller','invalid-caller']){
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
  const session=factory(root,wine,helpers,{equivalenceKey:key});
  const sourceAt=Date.now();observe();session.observe();const native=session.context();
  const observedAt=guard.snapshot().observedAt;assert(guard.snapshot().ready);
  await sleep(2);const freshAt=Date.now();await sleep(2);const completedAt=Date.now();
  const intent={kind:'key',code:65,key:'a',domCode:'KeyA',nonce:crypto.randomUUID(),name:'action-0',ms:80,
   mode:'menu',review:'explicit fixture intent',reviewedAt:sourceAt,imageSHA256:'a'.repeat(64),completedAt:sourceAt};
  const digest=JSON.stringify([intent.nonce,intent.name,intent.kind,intent.code,null,null,null,intent.key,intent.domCode,
   intent.ms,intent.mode,intent.review,intent.reviewedAt,intent.imageSHA256]);
  const shape={rgbaSHA256:'b'.repeat(64),width:800,height:600,orientation:'top-left-row-major-RGBA8'};
  const body={version:'native-whole-frame-equivalence-v1',id:crypto.randomUUID(),intent:digest,
   source:{...shape,sha256:intent.imageSHA256,at:sourceAt,completedAt:sourceAt,reviewedAt:sourceAt},
   fresh:{...shape,at:freshAt,completedAt,personallyReviewed:false},identity:{native}};
  if(variant==='equal-fresh')body.fresh.completedAt=observedAt,body.fresh.at=observedAt;
  if(variant==='post-fresh'){await sleep(2);observe();assert(guard.snapshot().observedAt>completedAt);}
  const payload=JSON.stringify(body),envelope={payload,signature:crypto.createHmac('sha256',Buffer.from(key,'hex')).update(payload).digest('hex')};
  let bound=sourceAt-1;
  if(variant==='stricter-caller'){await sleep(2);observe();bound=Date.now()+100;}
  if(variant==='invalid-caller')bound=NaN;
  let downs=0;const dispatch=()=>downs++;
  if(variant==='invalid-caller')await assert.rejects(session.prepareEquivalent(intent,bound,envelope),/bound/);
  else{
   const state=await session.prepareEquivalent(intent,bound,envelope);
   if(state.prepared)dispatch();
   assert.equal(downs,variant==='post-fresh'?1:0,variant+' must enforce signed fresh completion and caller bound');
   if(variant==='post-fresh')assert.equal(state.prepared.state,'PREPARED');
   else{assert(guard.snapshot().ready,'negative remains meaningfully current-ready');assert(!state.prepared);}
  }
  session.close('fixture complete');console.log('PASS signed fresh USER boundary '+variant+' DOWN='+downs);
 }
}
(async()=>{
 await freshUserControls();
 if(process.env.QUAKE2_EQUIVALENCE_USER_ONLY)return;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'review-equivalence-')),transient=create();
 let display,browser;const results=[];
 try{
  display=await require('../tools/gltron-headful-display.cjs').start(dir);
  browser=await require('puppeteer').launch({executablePath:'/opt/google/chrome/chrome',headless:false,
    env:transient.env(display.env),userDataDir:transient.profile,defaultViewport:{width:800,height:600},
    args:[...transient.args,'--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-component-update']});
  const browserWait=transient.watch(browser.process());
  const page=(await browser.pages())[0];await page.setContent('<body style="margin:0;background:#234"><canvas width="800" height="600"></canvas>');
  await page.evaluate(()=>{const c=document.querySelector('canvas'),x=c.getContext('2d');x.fillStyle='#336699';x.fillRect(0,0,800,600);});await sleep(300);
  let serial=0;
  async function fixture(evidenceSink){
   const name='source-'+serial++;
   const identity={target:'real-browser-'+browser.process().pid,owner:'authored-test',generation:1,viewport:'800x600',focus:1,modal:0,capture:0,module:'test',realm:1};
   let mutateOn=0,count=0;const a=createNativeEquivalence({env:display.env,checkpoint:()=>{},evidenceSink,context:async()=>{
    count++;if(mutateOn&&count===mutateOn)identity.generation++;return structuredClone(identity);}});
   const shot=await a.captureReview(name),png=shot.png;
   const image={sha256:shot.sha256,completedAt:shot.at};
   const intent={kind:'key',code:65,key:'a',domCode:'KeyA',nonce:crypto.randomUUID(),name:'action-0',ms:80,
     mode:'menu',review:'authored fixture explicit manual-intent declaration',reviewedAt:Date.now(),imageSHA256:shot.sha256};
   return {a,image,intent,name,identity,png,race(){mutateOn=count+2;}};
  }
  const success=await fixture();await sleep(5100);
  assert.throws(()=>reviewed(success.intent,success.image),/expired/);
  const proof=await success.a.prove(success.name,success.intent,success.image);
  const verified=await verifyPageEquivalence(success.a.key,proof,{...success.intent,completedAt:success.image.completedAt});
  assert.equal(verified.source.at,success.image.completedAt);assert.equal(verified.fresh.personallyReviewed,false);
  await success.a.beforeDown(proof,success.intent,success.image);success.a.fence(proof,success.intent,success.image);
  assert.throws(()=>success.a.validate({...proof},success.intent,success.image),/forged/);assert(success.a.closed);
  results.push('old5s rejects / actual native whole-host + realBrowser equality passes at real5100ms; forged handle closes');
  for(const field of ['target','owner','generation','viewport','focus','modal','capture','module','realm']){
   const f=await fixture();f.identity[field]='changed';await assert.rejects(f.a.prove(f.name,f.intent,f.image),/identity changed/);assert(f.a.closed);
   results.push(field+' refuses zeroDOWN');
  }
  {const f=await fixture();f.race();await assert.rejects(f.a.prove(f.name,f.intent,f.image),/identity changed/);assert(f.a.closed);results.push('capture identity race refuses');}
  {const f=await fixture();const p=PNG.sync.read(f.png);p.data[0]^=1;const changed=PNG.sync.write(p);
   await assert.rejects(f.a.prove(f.name,{...f.intent,imageSHA256:crypto.createHash('sha256').update(changed).digest('hex')},f.image));assert(f.a.closed);results.push('forged onepixel review source refuses');}
  {const f=await fixture();await page.evaluate(()=>{const x=document.querySelector('canvas').getContext('2d');x.fillStyle='#ff0000';x.fillRect(10,10,1,1);});await sleep(500);
   await assert.rejects(f.a.prove(f.name,f.intent,f.image),/RGBA differs/);assert(f.a.closed);results.push('actual changed presentation refuses');}
  {const rows=[],f=await fixture(row=>{rows.push(row);return true;});
   // Caller-owned review PNG cannot mutate the private capture.
   f.png.fill(0);const proof=await f.a.prove(f.name,f.intent,f.image);
   const row=rows[0];assert.equal(row.source.sha256,f.image.sha256);assert.equal(row.equal,true);
   row.source.png.fill(0);row.fresh.png.fill(0);row.source.identity.generation=999;row.fresh.identity.generation=999;
   await f.a.beforeDown(proof,f.intent,f.image);f.a.fence(proof,f.intent,f.image);
   assert.deepEqual(rows.map(r=>r.stage),['prove','pre-down-equivalent','socket-equivalent']);
   assert.equal(rows[1].source.identity.generation,1);assert.equal(rows[1].source.at,f.image.completedAt);
   results.push('public PNG and evidence copies cannot mutate private proof images or identity');}
  {const rows=[],f=await fixture(row=>{rows.push(row);return true;});
   await page.evaluate(()=>{document.body.style.background='#b52';document.querySelector('canvas').style.visibility='hidden';});await sleep(300);
   let downs=0;const controller=createController({page:async()=>{throw Error('must not authorize');},dispatch:()=>downs++,release:{},close:()=>{},equivalence:f.a});
   await assert.rejects(f.a.prove(f.name,f.intent,f.image),/RGBA differs/);assert(f.a.closed);assert.equal(rows.length,1);
   const r=rows[0];assert.equal(r.authoritative,false);assert.equal(r.refusal,'whole-frame RGBA differs');assert.equal(r.equal,false);
   for(const image of [r.source,r.fresh]){const p=PNG.sync.read(image.png);assert.equal(p.width,image.width);assert.equal(p.height,image.height);
    assert.equal(crypto.createHash('sha256').update(image.png).digest('hex'),image.sha256);
    assert.equal(crypto.createHash('sha256').update(p.data).digest('hex'),image.rgbaSHA256);
    assert.equal(image.orientation,'top-left-row-major-RGBA8');assert.equal(image.personallyReviewed,false);}
   assert(!PNG.sync.read(r.source.png).data.equals(PNG.sync.read(r.fresh.png).data));
   const {png:sp,...sm}=r.source,{png:fp,...fm}=r.fresh;
   const metadata={...r,source:sm,fresh:fm};const serialized=JSON.stringify(metadata);
   for(const privateValue of [f.a.key,f.intent.nonce])assert(!serialized.includes(privateValue));
   assert(!('payload' in r)&&!('signature' in r));assert.equal(r.source.review.reviewedAt,f.intent.reviewedAt);
   await assert.rejects(controller.gesture(f.intent,f.image,r));assert.equal(downs,0);
   if(process.env.EQUIVALENCE_EVIDENCE_DIRECTORY){const d=path.resolve(process.env.EQUIVALENCE_EVIDENCE_DIRECTORY);fs.mkdirSync(d,{recursive:true});
    for(const [n,b] of [['source.png',sp],['fresh.png',fp],['mismatch.json',JSON.stringify({...metadata,downs},null,2)]]){
     fs.writeFileSync(path.join(d,n),b,{flag:'wx'});assert.deepEqual(fs.readFileSync(path.join(d,n)),Buffer.from(b));}}
   results.push('real native browser mismatch retains complete source/fresh with hash readback, refusal and zeroDOWN');}
  for(const sink of [()=>{throw Error('disk failure');},()=>false,async()=>true]){
   const f=await fixture(sink);let downs=0;const controller=createController({page:async()=>{throw Error('must not authorize');},dispatch:()=>downs++,release:{},close:()=>{},equivalence:f.a});
   await assert.rejects(f.a.prove(f.name,f.intent,f.image),/evidence sink/);assert(f.a.closed);
   await assert.rejects(controller.gesture(f.intent,f.image,{}));assert.equal(downs,0);results.push('failed or asynchronous evidence sink closes zeroDOWN');}
  {const f=await fixture();f.intent.reviewedAt=Date.now()-16000;await assert.rejects(f.a.prove(f.name,f.intent,f.image),/age expired/);results.push('review age refuses');}
  {const f=await fixture();const p=await f.a.prove(f.name,f.intent,f.image),i={...f.intent,completedAt:f.image.completedAt};
   await assert.rejects(verifyPageEquivalence(f.a.key,{...p,signature:'0'.repeat(64)},i),/forged/);
   await assert.rejects(verifyPageEquivalence(f.a.key,p,{...i,code:66}),/mismatched/);
   const b=JSON.parse(p.payload);b.fresh.at-=6000;const payload=JSON.stringify(b),signature=crypto.createHmac('sha256',Buffer.from(f.a.key,'hex')).update(payload).digest('hex');
   await assert.rejects(verifyPageEquivalence(f.a.key,{payload,signature},i),/expired/);
   f.a.consume(p);assert.throws(()=>f.a.validate(p,f.intent,f.image),/used/);results.push('signature, intent, fresh age, replay refuse');}
  {const f=await fixture();let downs=0;
   const c=createController({page:async()=>{throw Error('must not call page');},dispatch:()=>downs++,release:{},close:()=>{},equivalence:f.a});
   await assert.rejects(c.gesture(f.intent,f.image,{payload:'{}',signature:'0'.repeat(64)}));assert.equal(downs,0);assert(c.terminal);results.push('forged controller proof zeroDOWN permanent close');}
  await browser.close();browser=null;await browserWait;
  for(const r of results)console.log('PASS '+r);
 }finally{if(browser)await browser.close();if(display)await display.close();await transient.cleanup(dir);fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
