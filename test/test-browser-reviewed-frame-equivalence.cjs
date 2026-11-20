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
(async()=>{
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
  async function fixture(){
   const name='source-'+serial++;
   const identity={target:'real-browser-'+browser.process().pid,owner:'authored-test',generation:1,viewport:'800x600',focus:1,modal:0,capture:0,module:'test',realm:1};
   let mutateOn=0,count=0;const a=createNativeEquivalence({env:display.env,checkpoint:()=>{},context:async()=>{
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
