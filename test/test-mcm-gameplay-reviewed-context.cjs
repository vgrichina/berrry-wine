'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{PNG}=require('pngjs');
const {createGameplayContext,CAPABILITY,POLICY}=require('../tools/mcm-gameplay-reviewed-context.cjs');
const {MAX_AGE_MS,createChain}=require('../tools/mcm-bound-input.cjs');
function fixture(){
  let time=100000,down=0,up=0,cancel=0,shots=0,cancelled=false,finishError=false,consumed=true;
  const retained=[],p=new PNG({width:40,height:30});p.data.fill(255);
  const owner={mode:'GAMEPLAY',gps:true,modal:null,session:'s',owner:{worker:'w',renderer:'r'},process:3,
    hwnd:41,generation:'generation',endpoint:7,epoch:'epoch',module:'module',threads:'threads',nativeInstance:'instance',memory:'memory',
    viewport:{width:40,height:30}};
  const config={identity:async()=>owner,now:()=>time,checkpoint:()=>assert(!cancelled,'cancelled'),
    capture:async()=>{p.data[0]=++shots;return PNG.sync.write(p);},
    evidenceSink:row=>{retained.push(row);return true;},
    native:{prepare:async()=>({prepared:true}),status:async nonce=>({nonce,state:consumed?'CONSUMED':'UNKNOWN',consumed,
      receiptBoundary:'owner-worker-native-user-return',nativeMessage:{consumption:'owner-user-return',token:1,msg:0x100,wParam:38}})},
    release:{alive:true,arm:async()=>({at:time,fallback:time+1750,releaseDue:time+1750}),due:()=>{},cancel:()=>{cancel++;},
      finish:async nonce=>{up++;if(finishError)throw Error('UP failed');return {trusted:true,down:false,nonce};}},down:()=>{down++;}};
  const authority=createGameplayContext(config);
  return {authority,config,owner,retained,get down(){return down;},get up(){return up;},get cancel(){return cancel;},
    get time(){return time;},set time(t){time=t;},set consumed(v){consumed=v;},set finishError(v){finishError=v;},cancelled(){cancelled=true;},
    async prepare(a=authority){const image=await a.captureReview(),intent={capability:CAPABILITY,mode:'GAMEPLAY',kind:'key',key:'ArrowUp',code:'ArrowUp',vk:38,
      holdMs:100,nonce:'one-action',review:'Fixture COMPLETE gameplay frame: one throttle action',imageSHA256:image.sha256,reviewedAt:time};
      return {image,intent,handle:a.review(intent)};}};
}
test('DIRECT12s unchanged; separate explicit animated source30/review15/current5',async()=>{
  assert.equal(MAX_AGE_MS,12000);assert.deepEqual(POLICY,{sourceMs:30000,reviewMs:15000,currentMs:5000,nativeMs:500,maxHoldMs:1500});
  const f=fixture(),p=await f.prepare();f.time+=13000;
  const r=await f.authority.dispatch(p.handle,p.intent);assert.equal(f.down,1);assert.equal(f.up,1);
  assert.equal(r.proof.context.exactWholeRGBA,false);assert.notEqual(r.proof.context.sourceSHA256,r.proof.context.currentSHA256);
  assert.deepEqual(f.retained.map(v=>v.stage),['source','review','current','final']);
  assert(f.retained.filter(v=>v.stage!=='review').every(v=>v.personallyReviewed===false));
  await assert.rejects(f.authority.dispatch(p.handle,p.intent),/single-use/);assert.equal(f.down,1);
});
for(const key of ['owner','process','hwnd','generation','endpoint','epoch','module','threads','nativeInstance','memory','viewport'])
test('replacement '+key+' refuses before DOWN',async()=>{
  const f=fixture(),p=await f.prepare();f.owner[key]='replaced';
  await assert.rejects(f.authority.dispatch(p.handle,p.intent));assert.equal(f.down,0);assert(f.authority.closed);
});
for(const offset of [-1,15000,30000])test('expired or reversed source/review '+offset,async()=>{
  const f=fixture(),p=await f.prepare();f.time+=offset;
  await assert.rejects(f.authority.dispatch(p.handle,p.intent),/clock/);assert.equal(f.down,0);
});
test('new review cannot renew original source',async()=>{
  const f=fixture(),p=await f.prepare();f.time+=30000;p.intent.reviewedAt=f.time;
  assert.throws(()=>f.authority.review(p.intent),/clock/);assert.equal(f.down,0);
});
for(const stage of ['current','final'])test('stale/frozen '+stage+' capture does not acquire a new timestamp',async()=>{
  const f=fixture(),sink=f.config.evidenceSink;
  f.config.evidenceSink=r=>{const ok=sink(r);if(r.stage===stage)f.time+=5000;return ok;};
  const a=createGameplayContext(f.config),p=await f.prepare(a);
  await assert.rejects(a.dispatch(p.handle,p.intent),/clock/);assert.equal(f.down,0);
});
for(const change of [i=>i.mode='MENU',i=>i.kind='mouse',i=>i.key='Enter',i=>i.vk=39,i=>i.holdMs=2000])
test('MENU confusion/unsupported key/encoding/duration refused '+change,async()=>{
  const f=fixture(),image=await f.authority.captureReview(),g=fixture(),p=await g.prepare();
  p.intent.imageSHA256=image.sha256;change(p.intent);
  assert.throws(()=>f.authority.review(p.intent),/allowed exact/);assert.equal(f.down,0);
});
test('changed exact intent and borrowed crossscope handle cannot dispatch',async()=>{
  const f=fixture(),p=await f.prepare(),g=fixture(),q=await g.prepare();
  await assert.rejects(g.authority.dispatch(p.handle,q.intent),/private/);assert.equal(g.down,0);
  p.intent.holdMs++;await assert.rejects(f.authority.dispatch(p.handle,p.intent),/intent changed/);assert.equal(f.down,0);
});
test('no native owner is zero DOWN with independent cancellation',async()=>{
  const f=fixture();f.config.native.prepare=async()=>({prepared:false});const p=await f.prepare();
  await assert.rejects(f.authority.dispatch(p.handle,p.intent),/native keyboard consumption owner/);
  assert.equal(f.down,0);assert.equal(f.cancel,1);assert.equal(f.up,1);
});
test('transport ACK without consumption closes and still performs independent UP',async()=>{
  const f=fixture(),p=await f.prepare();f.consumed=false;
  await assert.rejects(f.authority.dispatch(p.handle,p.intent),/UNKNOWN/);assert.equal(f.down,1);assert.equal(f.up,1);
  const n=f.retained.length;await assert.rejects(f.authority.captureReview(),/closed/);assert.equal(f.retained.length,n);
});
test('untrusted or missing UP cannot be success',async()=>{
  const f=fixture(),p=await f.prepare();f.finishError=true;
  await assert.rejects(f.authority.dispatch(p.handle,p.intent),/UP failed/);assert.equal(f.down,1);assert(f.authority.closed);
});
test('another native nonce cannot qualify the exact edge',async()=>{
  const f=fixture(),status=f.config.native.status;f.config.native.status=async nonce=>({...await status(nonce),nonce:'other'});
  const p=await f.prepare();await assert.rejects(f.authority.dispatch(p.handle,p.intent),/native keyboard API return/);
  assert.equal(f.down,1);assert.equal(f.up,1);assert(f.authority.closed);
});
test('final retention cancellation prevents DOWN and detached sink cannot mutate source',async()=>{
  const f=fixture(),sink=f.config.evidenceSink;
  f.config.evidenceSink=r=>{const ok=sink(r);r.png.fill(0);r.identity.module='forged';if(r.stage==='final')f.cancelled();return ok;};
  const a=createGameplayContext(f.config),p=await f.prepare(a);
  await assert.rejects(a.dispatch(p.handle,p.intent),/cancelled/);assert.equal(f.down,0);assert.equal(f.cancel,1);
});
test('ordinary chain cannot enable GAMEPLAY implicitly or through MENU capability',()=>{
  const c=createChain({});assert.rejects(c.captureGameplayContext(),/explicit/);
  assert.throws(()=>createChain({reviewedGameplayContext:{capability:'mcm-menu-reviewed-context-v1'}}),/explicit MCM GAMEPLAY/);
});
