'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const publication=require('./redline-current-publication.cjs');
const source=publication.prebrowserSource(require('./redline-current-startup.cjs').integrate(require('./redline-startup-boundary.cjs').integrate()));
new vm.Script(source);
const execute=source.slice(source.indexOf('async function execute('),source.indexOf('\n(async()=>{',source.indexOf('async function execute(')));
const capture=source.slice(source.indexOf('async function capture('),source.indexOf('\nfunction close(',source.indexOf('async function capture(')));
const root=path.resolve(__dirname,'..'),run=root+'/scratch/runs/20261109-redline-distinct-label-training-1235';
async function lane(test){
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'redline-menu-'));
 fs.mkdirSync(out+'/commands');fs.writeFileSync(out+'/execution-window.json',JSON.stringify({browserStop:new Date(Date.now()+120000).toISOString()}));
 let locked=false,flipCapture=false,transition=false,admissions=0,captures=0;
 const events=[],saved=[];
 const scope={assert,fs,root,run,out,require,Date,JSON,console:{log(){}},deadline:Date.now()+60000,
  latest:null,closing:false,fixture:null,pageSession:'page',cdpMousePoint:{x:430,y:360},
  sha:b=>require('node:crypto').createHash('sha256').update(b).digest('hex'),
  save:(n,v)=>{saved.push(n);fs.writeFileSync(out+'/'+n,JSON.stringify(v));},wait:async()=>{},state:async()=>({}),traceSnapshot:async()=>{},
  evaluate:async expression=>{
   if(expression.includes('events:globalThis.__nativeMouseEvents'))return {events:[],locked};
   if(expression.includes('getBoundingClientRect'))return {left:0,top:34,width:945,height:855};
   assert(expression.includes('pointerLockElement'));return locked;
  },
  send:async(method,p)=>{assert.equal(method,'Input.dispatchMouseEvent');events.push(p);scope.cdpMousePoint={x:p.x,y:p.y};if(transition&&p.type==='mouseReleased')locked=true;return {};},
  chain:{admit:async(review,dispatch)=>{admissions++;return dispatch({live:{identity:{}},ageMs:0});},capture:async label=>{
   captures++;const png=Buffer.from(label);if(flipCapture)locked=!locked;
   return {capture:{label,sha256:scope.sha(png)},png,before:{},after:{}};
  }}
 };
 vm.createContext(scope);vm.runInContext(capture+'\n'+execute,scope);
 const review=()=>{fs.writeFileSync(out+'/'+scope.latest.label+'-review.json',JSON.stringify({...scope.latest,review:'Offline synthetic image control'}));};
 const command=async c=>{let marked=0;await scope.execute({id:'test',waitMs:0,reviewRef:scope.latest.label,label:'next',...c},()=>marked++);return marked;};
 try{await test({scope,events,saved,review,command,setLock:v=>locked=v,setTransition:()=>transition=true,setFlip:()=>flipCapture=true,counts:()=>({admissions,captures})});}
 finally{fs.rmSync(out,{recursive:true,force:true});}
}
(async()=>{
 // Execute the actual generated lane and actual deployed mouse helpers across
 // the menu transition. Only browser observations/screenshots are simulated.
 await lane(async x=>{
  await x.scope.capture('menu');assert.equal(x.scope.latest.pointerLocked,false);x.review();x.setTransition();
  assert.equal(await x.command({action:'click',point:[.5,.5],holdMs:150,label:'levelgrid'}),1);
  assert.equal(x.scope.latest.pointerLocked,true);x.review();x.events.length=0;
  assert.equal(await x.command({action:'relative',dx:3,dy:-2,label:'cursor'}),1);
  assert.equal(x.events.length,1);assert.equal(x.events[0].type,'mouseMoved');assert.equal(x.events[0].x,475.5);assert.equal(x.events[0].y,459.5);
  x.review();x.events.length=0;
  assert.equal(await x.command({action:'click',cursorOnly:true,point:[.5,.5],holdMs:150,label:'selected'}),1);
  assert.deepEqual(x.events.map(p=>p.type),['mouseMoved','mousePressed','mouseReleased']);
  assert(x.events.every(p=>p.x===475.5&&p.y===459.5));
 });
 for(const mode of ['stale-unlocked','stale-locked','locked-absolute','unlocked-cursor','unlocked-relative','missing-capture-lock','unreviewed','stale-review-ref','wrong-review-lock'])await lane(async x=>{
  x.setLock(['stale-locked','locked-absolute'].includes(mode));await x.scope.capture('current');x.review();
  if(mode==='stale-unlocked')x.setLock(true);
  if(mode==='stale-locked')x.setLock(false);
  if(mode==='missing-capture-lock')delete x.scope.latest.pointerLocked;
  if(mode==='unreviewed')fs.unlinkSync(x.scope.out+'/current-review.json');
  if(mode==='wrong-review-lock')fs.writeFileSync(x.scope.out+'/current-review.json',JSON.stringify({...x.scope.latest,pointerLocked:true,review:'wrong metadata'}));
  const c=mode==='unlocked-relative'?{action:'relative',dx:1,dy:1}:{action:'click',point:[.5,.5],holdMs:150,...(mode==='unlocked-cursor'?{cursorOnly:true}:{}),...(mode==='stale-review-ref'?{reviewRef:'preceding-menu'}:{})};
  const before=x.counts();await assert.rejects(x.command(c));assert.equal(x.events.length,0);assert.equal(x.counts().captures,before.captures);
 });
 await lane(async x=>{x.setFlip();await assert.rejects(x.scope.capture('unstable'),/pointer lock changed during capture/);assert.equal(x.scope.latest,null);});
 for(const lockedAbsolute of [false,true])await lane(async x=>{
  const transport=require(run+'/transport.cjs');x.setLock(lockedAbsolute);await x.scope.capture('current');x.review();
  if(!lockedAbsolute)x.setLock(true);
  const command={id:'refused',action:'click',point:[.5,.5],holdMs:150,waitMs:0,reviewRef:'current',label:'never'};
  command.timing=transport.budget(x.scope.out,command);
  fs.writeFileSync(x.scope.out+'/commands/0.json',JSON.stringify(command));
  await assert.rejects(transport.consume(x.scope.out,0,x.scope.execute),lockedAbsolute?/locked absolute/:/lock changed/);
  assert(fs.existsSync(x.scope.out+'/first-failure.json'));assert(!fs.existsSync(x.scope.out+'/reply-0.json'));
  fs.writeFileSync(x.scope.out+'/commands/1.json',JSON.stringify({...command,id:'later',action:'capture'}));
  await assert.rejects(transport.consume(x.scope.out,1,x.scope.execute),/sticky/);
  assert.equal(x.events.length,0);assert.equal(x.counts().captures,1);
 });
 console.log('PASS actual composed capture/execute lane: unlocked menu -> locked grid -> supported relative -> cursorOnly; stale lock both directions, locked absolute, unlocked cursor/relative, missing lock/review and capture transition refuse with zero native input or later capture');
})().catch(e=>{console.error(e);process.exitCode=1;});
