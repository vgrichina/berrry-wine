'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
// Applied only to the finite passive-consumption caller. Native input helpers,
// lifetime guards and transport deadlines remain the generator's originals.
function apply(s){
 const x=(a,b)=>{assert.equal(s.split(a).length,2,'unique run-local anchor '+a);s=s.replace(a,b);};
 x('async function execute(c,markDispatch){',`async function execute(c,markDispatch){
 if(terminalError)throw terminalError;
 try{return await executePassiveMenu(c,markDispatch);}catch(error){throw terminal(error);}
}
async function executePassiveMenu(c,markDispatch){`);
 x("['settle-menu','transition'].includes(c.flow)","['observe-menu','settle-menu','transition'].includes(c.flow)");
 x(" assert(c.flow!=='settle-menu'||c.action==='capture','settling is passive only');",` assert(!['observe-menu','settle-menu'].includes(c.flow)||c.action==='capture','admission observation is passive only');
 if(c.action==='capture'){
  assert(c.flow==='observe-menu'||c.flow==='settle-menu','explicit passive observation required');
  assert(latest&&c.reviewRef===latest.label,'passive current image required');
  await chain.admit(JSON.parse(fs.readFileSync(out+'/'+latest.label+'-review.json')),async()=>{});
 }`);
 x("  assert(review.settledMenu===true,'full settled image model review required');",`  assert(review.settledMenu===true&&review.scene==='menu','personally reviewed settled menu required');
  assert(settledMenu.stateRect&&settledMenu.stateSha256,'reviewed menu and modal area required');`);
 x(" const dispatch=async receipt=>{",` const dispatch=async receipt=>{
 const admittedMenu=settledMenu;
 if(c.action!=='capture'){
  const sceneReview=JSON.parse(fs.readFileSync(out+'/'+latest.label+'-review.json'));
  assert(['menu','game'].includes(sceneReview.scene),'title or missing menu forbids input; no Escape');
  if(sceneReview.scene==='menu')assert(c.menuTarget||c.menuAdmission,'menu input requires settled pixel admission');
  if(c.menuAdmission)assert(c.action==='move'&&c.anchorOriginalCursor&&admittedMenu?.stateRect,'only ordinary anchor move under settled menu admission');
 }
 if(c.menuTarget||c.menuAdmission)assert.equal(await menuRegion(admittedMenu.stateRect),admittedMenu.stateSha256,'reviewed menu or modal changed during review');`);
 x(' markDispatch();',` if(c.menuTarget||c.menuAdmission){
  assert.equal(await menuRegion(admittedMenu.stateRect),admittedMenu.stateSha256,'menu or modal changed before dispatch');
  const actual=await chain.readLive();bound.sameIdentity(latest.identity,actual.identity);
  assert(!terminalError&&Date.now()<deadline&&Date.now()-Date.parse(latest.at)<=bound.MAX_AGE_MS,'dispatch deadline/freshness');
  save('input-'+c.id+'-menu-state-at-dispatch.json',{at:new Date().toISOString(),reviewed:latest,rect:admittedMenu.stateRect,sha256:admittedMenu.stateSha256,actual,ordinaryInputOnly:true});
 }
 markDispatch();`);
 // bound.sameIdentity is not exported: readLive uses exact owner guard through admit again.
 x('const actual=await chain.readLive();bound.sameIdentity(latest.identity,actual.identity);',`const actual=await chain.readLive();bound.same(latest.identity,actual.identity);`);
 x("  const first=await menuRegion(c.settleTarget);await wait(250);",`  assert(c.settleStateRect,'current reviewed menu and modal rectangle required');
  const firstState=await menuRegion(c.settleStateRect);
  const first=await menuRegion(c.settleTarget);await wait(250);`);
 x("  settlement={label:c.label,rect:c.settleTarget,sha256:second};",`  const secondState=await menuRegion(c.settleStateRect);
  assert.equal(firstState,secondState,'menu or modal area moving while settling');
  settlement={label:c.label,rect:c.settleTarget,sha256:second,stateRect:c.settleStateRect,stateSha256:secondState};`);
 x(" if(c.flow!=='settle-menu')assert.notEqual", " if(c.action!=='capture'&&!c.anchorOriginalCursor)assert.notEqual");
 x("  assert.equal(await menuRegion(settlement.rect),settlement.sha256,'menu moved during settled capture');",`  assert.equal(await menuRegion(settlement.rect),settlement.sha256,'menu moved during settled capture');\n  assert.equal(await menuRegion(settlement.stateRect),settlement.stateSha256,'menu or modal moved during settled capture');`);
 // Replace broad hash equality with visible text and coarse button geometry.
 x('let settledMenu=null;',`let settledMenu=null;
 const menuState=require(root+'/tools/nox-menu-state.cjs');
 async function visibleMenu(spec){
  menuState.validate(spec);
  return evaluate('('+function(spec,describe){
   const c=document.getElementById('screen');
   if(!c||c.width!==640||c.height!==480)throw Error('original Nox canvas required');
   const r=c.getBoundingClientRect();
   return {...describe(c.getContext('2d').getImageData(0,0,640,480).data,spec),canvasRect:{left:r.left,top:r.top,width:r.width,height:r.height}};
  }.toString()+')('+JSON.stringify(spec)+','+menuState.describe.toString()+')');
 }
 function reviewedMenu(spec){
  const state=JSON.parse(fs.readFileSync(out+'/'+latest.label+'-state.json'));
  return menuState.reviewed(fs.readFileSync(out+'/'+latest.label+'.png'),state.canvas,spec);
 }
 async function admitVisibleMenu(admitted){
  return menuState.compare(admitted.reference,await visibleMenu(admitted.spec));
 }`);
 x("assert(settledMenu.stateRect&&settledMenu.stateSha256,'reviewed menu and modal area required');", "assert(settledMenu.spec&&settledMenu.reference,'reviewed menu discriminator required');");
 x("admittedMenu?.stateRect", "admittedMenu?.spec");
 x("if(c.menuTarget||c.menuAdmission)assert.equal(await menuRegion(admittedMenu.stateRect),admittedMenu.stateSha256,'reviewed menu or modal changed during review');", "if(c.menuTarget||c.menuAdmission)await admitVisibleMenu(admittedMenu);");
 x("  assert.equal(await menuRegion(c.menuTarget),settledMenu.sha256,'moving menu target refused before input');", "  await admitVisibleMenu(admittedMenu);");
 x("  assert.equal(await menuRegion(admittedMenu.stateRect),admittedMenu.stateSha256,'menu or modal changed before dispatch');", "  const discriminator=await admitVisibleMenu(admittedMenu);");
 x("rect:admittedMenu.stateRect,sha256:admittedMenu.stateSha256,actual", "spec:admittedMenu.spec,discriminator,actual");
 const begin=s.indexOf("  assert(c.settleStateRect,'current reviewed menu and modal rectangle required');");
 const end=s.indexOf("\n }\n assert(!terminalError&&Date.now()<deadline,'caller cancelled or late before capture');",begin);
 assert(begin>0&&end>begin,'unique settle discriminator boundary');
 s=s.slice(0,begin)+`  const spec=c.menuState;menuState.validate(spec);
  const target=c.settleTarget;assert(Array.isArray(target)&&target.length===4&&target.every(Number.isInteger),'explicit menu target geometry');
  assert(spec.labels.some(([,r])=>r[0]>=target[0]&&r[1]>=target[1]&&r[0]+r[2]<=target[0]+target[2]&&r[1]+r[3]<=target[1]+target[3]),'target contains visible reviewed menu text');
  const review=JSON.parse(fs.readFileSync(out+'/'+latest.label+'-review.json'));
  assert(review.scene==='menu','personally reviewed visible menu required');
  const reference=reviewedMenu(spec);
  const first=await visibleMenu(spec);menuState.compare(reference,first);
  await wait(250);assert(!terminalError&&Date.now()<deadline,'settling cancelled or late');
  const second=await visibleMenu(spec);menuState.compare(reference,second);
  settlement={label:c.label,rect:c.settleTarget,spec,reference};`+s.slice(end);
 x("  assert.equal(await menuRegion(settlement.rect),settlement.sha256,'menu moved during settled capture');\n  assert.equal(await menuRegion(settlement.stateRect),settlement.stateSha256,'menu or modal moved during settled capture');", `  await admitVisibleMenu(settlement);
  menuState.compare(settlement.reference,reviewedMenu(settlement.spec));`);
 x(' const previousImage=latest;', ' let menuDispatchGeometry=null;\n const previousImage=latest;');
 x("  const discriminator=await admitVisibleMenu(admittedMenu);\n  const actual=await chain.readLive();bound.same(latest.identity,actual.identity);", `  const actual=await chain.readLive();bound.same(latest.identity,actual.identity);
  const observed=await visibleMenu(admittedMenu.spec);
  const discriminator=menuState.compare(admittedMenu.reference,observed);
  menuDispatchGeometry=observed.canvasRect;`);
 x('const geometry=await evaluate(`(()=>{const r=document.getElementById(\'screen\').getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height}})()`);', 'const geometry=menuDispatchGeometry??await evaluate(`(()=>{const r=document.getElementById(\'screen\').getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height}})()`);');
 // The old hash helper has no callers after semantic admission is composed.
 const hashBegin=s.indexOf('async function menuRegion(rect){'),hashEnd=s.indexOf('async function execute(c,markDispatch){',hashBegin);
 assert(hashBegin>0&&hashEnd>hashBegin);s=s.slice(0,hashBegin)+s.slice(hashEnd);
 return s;
}
module.exports={apply};
