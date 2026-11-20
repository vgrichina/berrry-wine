'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createManualPlan}=require('../tools/gltron-manual-plan.cjs');
function fixture(sink=()=>true,fault=null){
 const now=Date.now(),image={sha256:'a'.repeat(64),completedAt:now};
 const choice={startingPause:true,chosenAt:now,review:'Personally reviewed complete paused fixture; resume, left, right, pause.',steps:[]};
 choice.steps=['Space','ArrowLeft','ArrowRight','Space'].map((key,i)=>({nonce:'n'+i,name:'action-'+i,key,domCode:key,code:{Space:32,ArrowLeft:37,ArrowRight:39}[key],kind:'key',ms:50,delayMs:0,mode:'game',review:choice.review,reviewedAt:now,imageSHA256:image.sha256}));
 const events=[],proofs=new WeakMap();let retired=false;
 const plan=createManualPlan({evidenceSink:sink,createNativeManualContext:({evidenceSink})=>({
   key:'b'.repeat(64),capability:'native-manual-context-v1',get closed(){return retired;},close(){retired=true;},
   async captureReview(){return {png:Buffer.from('complete'),...image};},
   async prove(name,intent){evidenceSink({stage:'prove',fresh:{png:Buffer.from('fresh'),personallyReviewed:false}});const h=Object.freeze({payload:JSON.stringify(intent),signature:'c'.repeat(64)});proofs.set(h,JSON.stringify(intent));return h;},
   validate(h,i){assert.equal(proofs.get(h),JSON.stringify(i));if(fault==='stale')throw Error('expired source');},
   async beforeDown(h,i){events.push('fresh');this.validate(h,i);},
   fence(h,i,f,publish){events.push('final');this.validate(h,i);evidenceSink({stage:'final',fresh:{png:Buffer.from('current'),personallyReviewed:false}});if(fault==='identity'||fault==='focus')throw Error(fault);publish();},
   consume(h){assert(proofs.has(h));proofs.delete(h);events.push('consume');},
 })});
 return {plan,image,choice,events};
}
test('explicit plan binds four exact private proofs, order and one use',async()=>{
 const f=fixture(),h=await f.plan.authorize('review',f.choice,f.image),a=f.plan.open(h,f.choice,f.image);
 assert.equal(f.plan.capability,'native-manual-plan-v1');
 for(let i=0;i<4;i++){const p=a.proofs[i],edge=f.choice.steps[i];a.equivalence.validate(p,edge,f.image);await a.equivalence.beforeDown(p,edge,f.image);a.equivalence.fence(p,edge,f.image,()=>f.events.push('DOWN'));a.equivalence.consume(p);}
 assert(f.plan.closed);assert.deepEqual(f.events,Array(4).fill(['fresh','final','DOWN','consume']).flat());
 assert.throws(()=>f.plan.open(h,f.choice,f.image),/closed/);
});
for(const fault of ['forged','mutated','reordered','hold','delay','nonce','source','repeat','cancel','release','wrong-order'])test('private plan zero DOWN '+fault,async()=>{
 const f=fixture(),h=await f.plan.authorize('review',f.choice,f.image);let downs=0;
 if(fault==='forged'){assert.throws(()=>f.plan.open({...h},f.choice,f.image));return;}
 if(['mutated','reordered','hold','delay','nonce','source'].includes(fault)){
  if(fault==='mutated')f.choice.review+=' changed';
  if(fault==='reordered')f.choice.steps.reverse();
  if(fault==='hold')f.choice.steps[0].ms++;
  if(fault==='delay')f.choice.steps[0].delayMs++;
  if(fault==='nonce')f.choice.steps[0].nonce='changed';
  if(fault==='source')f.image.completedAt--;
  assert.throws(()=>f.plan.open(h,f.choice,f.image));return;
 }
 const a=f.plan.open(h,f.choice,f.image);
 if(fault==='repeat')assert.throws(()=>f.plan.open(h,f.choice,f.image));
 if(fault==='cancel'||fault==='release')f.plan.close();
 assert.throws(()=>a.equivalence.fence(a.proofs[fault==='wrong-order'?1:0],f.choice.steps[fault==='wrong-order'?1:0],f.image,()=>downs++));
 assert.equal(downs,0);assert(f.plan.closed);
});
test('requires other turn and immutable synchronously retained complete images',async()=>{
 let captured;
 const f=fixture(e=>{captured=e;assert(Object.isFrozen(e));return true;});
 await f.plan.captureReview('review');assert(Object.isFrozen(captured.source));
 assert.equal(Buffer.from(captured.source.png.data,'base64').toString(),'complete');
 f.choice.steps[2]={...f.choice.steps[2],key:'ArrowLeft',domCode:'ArrowLeft',code:37};
 await assert.rejects(f.plan.authorize('review',f.choice,f.image),/other ordinary turn/);
});
for(const sink of [()=>false,()=>Promise.resolve(true),()=>{throw Error('writer');}])test('sink failure closes before authority/DOWN',async()=>{
 const f=fixture(sink);await assert.rejects(f.plan.captureReview('review'));assert(f.plan.closed);
 await assert.rejects(f.plan.authorize('review',f.choice,f.image));
});
for(const fault of [null,'stale','identity','focus','writer','release-race','fourth-not-ready','cancel'])test('group explicit plan authored native transport '+(fault??'four consumed and independent UP'),async()=>{
 const f=fixture(e=>{if(fault==='writer'&&e.stage==='final')throw Error('writer failed');return true;},fault);
 const handle=await f.plan.authorize('review',f.choice,f.image),arms=[],downs=[],ups=[],cancelled=[];
 let prepared=null,closed=0,group;
 const releases=f.choice.steps.map((s,i)=>({alive:true,async arm(){arms.push(i);const at=Date.now();return {at,fallback:at+1750,releaseDue:at+(fault==='fourth-not-ready'&&i===3?1499:1500)};},due(n,at){assert.equal(n,s.nonce);assert(at>=Date.now()+s.ms-2);},cancel(){cancelled.push(i);},async finish(){ups.push(i);return {ok:true};}}));
 group=require('../tools/gltron-manual-native-gesture.cjs').createGroup({manualPlan:f.plan,releases,fence:async()=>{},close(){closed++;},
  page:async(method,arg)=>{if(method==='prepareEquivalent'){prepared=arg;return {prepared:true};}return {nonce:arg,state:'CONSUMED',consumed:true,receiptBoundary:'owner-worker-native-user-return',nativeMessage:{consumption:'owner-user-return',token:f.choice.steps.findIndex(s=>s.nonce===arg)+1,msg:0x100,wParam:prepared.code}};},
  dispatch:async(edge,publish)=>{assert.equal(arms.length,4);if(fault==='release-race')releases[0].alive=false;if(fault==='cancel')group.close('task stopped');f.plan.fence(edge,f.image,publish);downs.push(edge.code);return {};},
 });
 if(fault){await assert.rejects(group.gesture(f.choice,f.image,handle));assert.equal(downs.length,0);assert.equal(closed,1);assert(f.plan.closed);}
 else{const result=await group.gesture(f.choice,f.image,handle);assert.equal(result.results.length,4);assert.deepEqual(downs,[32,37,39,32]);assert.deepEqual(ups,[0,1,2,3]);assert(f.plan.closed);}
});
