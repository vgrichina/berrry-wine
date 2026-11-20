'use strict';
// Real native root pixels and signed page verification. No game outcome claim.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createNativeEquivalence,createNativeManualContext,verifyPageEquivalence}=require('../lib/browser-reviewed-frame-equivalence.cjs');
const adapter=require('../tools/hexen2-native-consumption-input.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hex-manual-context-'));
 const transient=require('../tools/browser-transients.cjs').create();let display,browser,wait;
 const checkpoint=()=>{const s=fs.statfsSync('/home');assert(Number(s.bavail)*Number(s.bsize)>1500000000,'actual /home floor');};
 try{
  checkpoint();display=await require('../tools/gltron-headful-display.cjs').start(dir);
  browser=await require('puppeteer').launch({executablePath:'/opt/google/chrome/chrome',headless:false,
   env:transient.env(display.env),userDataDir:transient.profile,defaultViewport:{width:800,height:600},
   args:[...transient.args,'--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-component-update']});
  wait=transient.watch(browser.process());const page=(await browser.pages())[0];
  await page.setContent('<body style="background:#246"><div id="marker" style="width:30px;height:30px;background:red"></div></body>');await sleep(300);
  const identity={target:browser.process().pid,owner:'authored',generation:1,viewport:'800x600',focus:1,modal:0,capture:0,module:'authored',realm:1};
  async function fixture(factory=createNativeManualContext){
   const rows=[],a=factory({env:display.env,checkpoint,context:async()=>identity,evidenceSink:r=>{rows.push(r);return true;}});
   const shot=await a.captureReview('context');const image={sha256:shot.sha256,completedAt:shot.at};
   const intent={kind:'key',code:65,key:'a',domCode:'KeyA',nonce:crypto.randomUUID(),name:'action-1',ms:80,
    mode:'menu',review:'explicit authored marker context',reviewedAt:Date.now(),imageSHA256:shot.sha256};
   return {a,shot,image,intent,rows};
  }
  const strict=await fixture(createNativeEquivalence),manual=await fixture();
  await page.evaluate(()=>document.getElementById('marker').style.background='lime');await sleep(300);
  await assert.rejects(strict.a.prove('context',strict.intent,strict.image),/RGBA differs/);assert(strict.a.closed);
  const proof=await manual.a.prove('context',manual.intent,manual.image),i={...manual.intent,completedAt:manual.image.completedAt};
  assert.equal(manual.rows[0].equal,false);assert.equal(manual.rows[0].accepted,true);
  await assert.rejects(verifyPageEquivalence(manual.a.key,proof,i),/mismatched/);
  const p=await verifyPageEquivalence(manual.a.key,proof,i,'native-manual-context-v1');
  assert.notEqual(p.source.rgbaSHA256,p.fresh.rgbaSHA256);assert.equal(p.fresh.personallyReviewed,false);
  await manual.a.beforeDown(proof,manual.intent,manual.image);manual.a.fence(proof,manual.intent,manual.image);
  await assert.rejects(verifyPageEquivalence(manual.a.key,proof,{...i,code:66},'native-manual-context-v1'),/mismatched/);
  await assert.rejects(verifyPageEquivalence(manual.a.key,{...proof,signature:'0'.repeat(64)},i,'native-manual-context-v1'),/forged/);
  manual.a.consume(proof);assert.throws(()=>manual.a.validate(proof,manual.intent,manual.image),/used/);
  console.log('PASS changing real native pixels: strict rejects, explicit manual-context passes three capture fences; cross-capability/intent/forgery/replay refuse');
  for(const field of Object.keys(identity)){
   const f=await fixture(),old=identity[field];identity[field]='changed';
   await assert.rejects(f.a.prove('context',f.intent,f.image),/identity changed/);assert(f.a.closed);identity[field]=old;
  }
  for(const field of ['imageSHA256','reviewedAt']){
   const f=await fixture();f.intent[field]=field==='reviewedAt'?Date.now()-16000:'0'.repeat(64);
   await assert.rejects(f.a.prove('context',f.intent,f.image));assert(f.a.closed);
  }
  assert.throws(()=>adapter.createController({manualContext:{capability:'native-whole-frame-equivalence-v1'}}),/explicit/);
  assert.throws(()=>adapter.createController({manualContext:{capability:'native-manual-context-v1'},equivalence:{}}),/explicit/);
  console.log('PASS all identity fields, review age/hash and ambiguous capability refuse');
 }finally{
  if(browser)await browser.close();if(wait)await wait;if(display)await display.close();
  await transient.cleanup(dir);fs.rmSync(dir,{recursive:true,force:true});
 }
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
