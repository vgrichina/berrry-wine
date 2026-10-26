'use strict';
const assert = require('assert/strict'), fs = require('fs'), vm = require('vm'), crypto = require('crypto');
// Negative control transforms the actual production boundary, never a substitute planner.
if(process.argv.includes('--omit-planning-guard')) {
  const Module=require('module'), file=require.resolve('../tools/civ2-serial-controller');
  const source=fs.readFileSync(file,'utf8'),guard='plan.admit(); // Read-only admission; an impossible plan cannot launch.';
  assert.equal(source.split(guard).length,2);
  const mutant=new Module(file,module);mutant.filename=file;mutant.paths=module.paths;
  mutant._compile(source.replace(guard,'/* deliberately omitted by rejecting control */'),file);
  require.cache[file]=mutant;
}
const {createController, launchController} = require('../tools/civ2-serial-controller');
const {KNOWN_ROUTE} = require('../tools/civ2-capture-plan');
const image = {width:640,height:480,data:Buffer.alloc(640*480*4)};
const intro = {width:640,height:480,data:Buffer.alloc(640*480*4)};
for(let y=181;y<300;y++)for(let x=171;x<460;x++) {
  const i=(y*640+x)*4;intro.data[i]=180;intro.data[i+1]=100;intro.data[i+2]=40;
}
const config = (count=22) => ({outputDir:fs.mkdtempSync(__dirname+'/../test-output/original-'),referenceDir:'/tmp/civ2-offline-fixture-reference',sessionId:'offline-only',plan:{
  allocationId:'synthetic-offline-fixture-NOT-runtime-authorization',totalCaptures:count,perImageBytes:1024,
  retainedBytes:count*1024,totalCaptureBytes:count*1024,width:640,height:480,
  setupMs:1000,acceptanceMs:1000,cleanupMs:1000,totalMs:3000,cutoff:4000,ackTimeoutMs:100}});
function fixture(cfg=config()) {
  let clock=0,mode='',n=0;const requests=[],outputs=new Map();
  const deps={now:()=>clock,put:(name,v)=>outputs.set(name,JSON.parse(JSON.stringify(v))),
    readFile:p=>Buffer.from(p.split('/').at(-1)),decode:b=>b.toString()==='intro.png'?intro:image,
    request:async req=>{
      requests.push(req);n++;
      if(mode==='throw')throw Error('capture transport failure');
      if(mode==='hang')return new Promise(()=>{});
      const value=req.action==='step'?{ran:mode==='partial'?req.n-1:req.n,frozen:true}:
        req.action==='snapshot'?{frozen:{frozen:true,credits:mode==='credits'?1:0},windows:[{visible:true,isChild:false,w:640,h:480}]}:{};
      return {id:mode==='stale'?'other-session':req.id,ok:mode!=='failed',value};
    }};
  const c=createController(cfg,deps);
  return {c,deps,requests,outputs,setClock:x=>clock=x,setMode:x=>mode=x};
}
fs.mkdirSync(__dirname+'/../test-output',{recursive:true});
const checks=[];
let group=0;
const from=Number((process.argv.find(a=>a.startsWith('--from='))||'--from=1').split('=')[1]);
const through=Number((process.argv.find(a=>a.startsWith('--through='))||'--through=999').split('=')[1]);
async function test(name,fn){
  if(++group<from || group>through)return;
  await fn();checks.push(name);console.log('PASS '+name);
  const dir=__dirname+'/../docs/reviews/civ2-atomic-controller-ownership-repair-oct26/original-groups';
  fs.mkdirSync(dir,{recursive:true});
  const file=dir+'/checkpoint-'+group+'.json';
  const sources=['tools/civ2-capture-plan.js','tools/civ2-serial-controller.js','test/test-civ2-capture-plan.js','test/fixtures/civ2-controller/predecessor-controller.js'];
  const hashes=Object.fromEntries(sources.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(__dirname+'/../'+p)).digest('hex')]));
  fs.writeFileSync(file+'.tmp',JSON.stringify({group,name,hashes,passed:true,syntheticOnly:true,remaining:'unexecuted subsequent groups and publication; gameplay productionUI/quit unverified'},null,2)+'\n');fs.renameSync(file+'.tmp',file);
}
async function originalExhaustion() {
  const source=fs.readFileSync(__dirname+'/fixtures/civ2-controller/predecessor-controller.js','utf8');
  assert.equal(crypto.createHash('sha256').update(source).digest('hex'),'2f0f8784099332d7ba75539f5b484d1b6180a211ed3186c3d51b149df609edea');
  const captures=[],acks=[],files=new Map();
  const decisions=[{cmds:['click:211:52'],step:100,capture:'city-name'},
    {cmds:['click:210:272'],step:150,capture:'city-founded-ui'},
    {cmds:['click:320:347'],step:150,capture:'rome-city-screen'},
    {cmds:['click:320:162'],step:100}, {capture:'production-screen'}];
  const fake={appendFileSync:(p,text)=>{const req=JSON.parse(text);let value={};
    if(req.action==='png')captures.push(req.path.split('/').at(-1));
    if(req.action==='step')value={ran:req.n,frozen:true};
    if(req.action==='snapshot')value={frozen:{frozen:true,credits:0},windows:[{visible:true,isChild:false,w:640,h:480}]};
    acks.push('[ctl] '+JSON.stringify({id:req.id,ok:true,value}));},
    existsSync:()=>true,readdirSync:()=>captures,
    readFileSync:p=>p.endsWith('guest.log')?acks.join('\n'): /decision-\d+\.json$/.test(p)?JSON.stringify(decisions[Number(p.match(/decision-(\d+)/)[1])-1]):Buffer.from(p.split('/').at(-1)),
    writeFileSync:(p,v)=>files.set(p,v),renameSync:(a,b)=>{files.set(b,files.get(a));files.delete(a);}};
  vm.runInNewContext(source,{require:id=>id==='fs'?fake:id.endsWith('pngjs')?{PNG:{sync:{read:b=>b.toString()==='intro.png'?intro:image}}}:require(id),
    Buffer,Date,setTimeout,process:{argv:[]},console:{log(){},error(){}}},{filename:'pinned-predecessor-controller.js'});
  let error;
  for(let i=0;i<300;i++){await new Promise(setImmediate);error=[...files.entries()].find(([p])=>p.endsWith('controller-error.json'));if(error)break;}
  assert(error,'original production main must reach failure');assert.equal(JSON.parse(error[1]).message,'capture cap');
  assert.equal(captures.length,20);assert.equal(captures.at(-1),'rome-city-screen.png');
  assert(!captures.includes('production-screen.png'));
  return {captures:captures.length,lastCapture:captures.at(-1),error:JSON.parse(error[1]).message};
}
(async()=>{
  // FIRST behavioral boundary: real exported production launch/run, no guest execution.
  await test('production guard rejects unchanged 20-image allocation before launch or first step',async()=>{
    const f=fixture(config(20));let launches=0;
    await assert.rejects(launchController(config(20),{...f.deps,launch:async()=>launches++}),/minimum 22 captures/);
    await assert.rejects(f.c.run(),/minimum 22 captures/);
    assert.equal(launches,0);assert.equal(f.requests.length,0);
  });
  await test('byte-exact original main reproduces twentieth tutorial capture exhaustion',async()=>{
    console.log(JSON.stringify(await originalExhaustion()));
  });
  await test('actual predecessor setup wiring retains all sixteen pixel checks and serial zero ownership',async()=>{
    const f=fixture();f.c.start();await f.c.setup();
    assert.equal(f.c.snapshot().attempts,17);assert.equal(f.c.snapshot().stage,'orders-menu');
    assert.deepEqual(f.c.snapshot().reservedStages,['city-name','city-founded-ui','first-city-tutorial','production-screen','quit-confirmation']);
    assert.equal(f.outputs.get('pixel-checkpoints.json').checks.length,15); // intro has its separate signature check.
    for(let i=0;i<f.requests.length;i++)if(f.requests[i].cmd)assert.equal(f.requests[i-1].action,'snapshot');
    assert.equal(new Set(f.requests.map(r=>r.id)).size,f.requests.length);
  });
  await test('explicit sufficient plan preserves acceptance/tutorial/production/confirmation and counters',async()=>{
    const f=fixture();f.c.start();
    for(const stage of KNOWN_ROUTE){const im=await f.c.capture(stage);f.c.match(stage,im,[[0,0,1,1]]);await f.c.input('click:0:0');}
    const s=f.c.snapshot();assert.equal(s.attempts,22);assert.equal(s.successes,22);
    assert.equal(s.chargedBytes,s.retainedBytes);assert.equal(s.retainedBytes,s.records.reduce((a,r)=>a+r.retainedBytes,0));
    assert.deepEqual(s.reservedStages,[]);assert.equal(f.requests.filter(r=>r.action==='png').length,22);
    assert.equal(f.outputs.get('capture-plan.json').attempts,22);
    await assert.rejects(f.c.capture('extra'),/unknown\/out-of-order/);assert.equal(f.c.snapshot().attempts,22);
  });
  await test('extra tutorial needs explicit additional route/count/byte allocation; unknown dialog cannot confirm',async()=>{
    const cfg=config(23);cfg.plan.route=[...KNOWN_ROUTE];cfg.plan.route.splice(20,0,'extra-tutorial');
    const f=fixture(cfg);f.c.start();for(const stage of cfg.plan.route)await f.c.capture(stage);
    assert.equal(f.c.snapshot().attempts,23);
    const tooSmall=structuredClone(cfg);tooSmall.plan.totalCaptures=22;assert.throws(()=>fixture(tooSmall).c.start(),/minimum 23/);
    const unknown=fixture();unknown.c.start();await unknown.c.capture('language');
    await assert.rejects(unknown.c.capture('unknown-dialog'),/unknown\/out-of-order/);assert.equal(unknown.requests.filter(r=>r.action==='png').length,1);
    await assert.rejects(unknown.c.input('click:215:262'),/stopped/);
  });
  await test('failed capture and uncertain/failed ACK retain charges and prohibit replay',async()=>{
    for(const mode of ['throw','stale','failed','hang']){
      const f=fixture();f.c.start();f.setMode(mode);await assert.rejects(f.c.capture('language'));
      const s=f.c.snapshot();assert.equal(s.attempts,1);assert.equal(s.successes,0);assert.equal(s.chargedBytes,1024);assert.equal(s.retainedBytes,0);
      assert.equal(s.uncertainRetainedCaptures,1);assert.equal(s.stopped,true);const n=f.requests.length;await assert.rejects(f.c.capture('language'));assert.equal(f.requests.length,n);
    }
    const partial=fixture();partial.c.start();partial.setMode('partial');await assert.rejects(partial.c.step(10),/incomplete/);
    await assert.rejects(partial.c.step(10),/inactive/);
  });
  await test('deadline reserve refuses setup overrun and impossible cutoff before any request',async()=>{
    const cfg=config();cfg.plan.totalMs=2999;await assert.rejects(fixture(cfg).c.run(),/time plan requires 3000ms/);
    const f=fixture();f.c.start();f.setClock(901);await assert.rejects(f.c.capture('language'),/deadline reserve: setup/);assert.equal(f.requests.length,0);
    const a=fixture();a.c.start();for(const stage of KNOWN_ROUTE.slice(0,16))await a.c.capture(stage);
    a.setClock(1901);await assert.rejects(a.c.capture('orders-menu'),/deadline reserve: acceptance/);
    const cutoff=config();cutoff.plan.cutoff=2000;assert.throws(()=>fixture(cutoff).c.start(),/time plan requires/);
  });
  await test('count/byte saturation rejects preflight; failed output keeps conservative allocation',async()=>{
    for(const key of ['retainedBytes','totalCaptureBytes']){const cfg=config();cfg.plan[key]--;assert.throws(()=>fixture(cfg).c.start(),/bytes allocation/);}
    const f=fixture();f.deps.readFile=()=>Buffer.alloc(1025); // dependencies are captured at call sites.
    f.c.start();await assert.rejects(f.c.capture('language'),/bytes\/dimensions/);
    assert.equal(f.c.snapshot().attempts,1);assert.equal(f.c.snapshot().chargedBytes,1025);assert.equal(f.c.snapshot().retainedBytes,1025);assert.equal(f.c.snapshot().successes,0);
    const huge=config(Number.MAX_SAFE_INTEGER);assert.throws(()=>fixture(huge).c.start(),/invalid explicit allocation/);
  });
  await test('no input without current matching pixels or frozen zero; no serial overlap',async()=>{
    const f=fixture();f.c.start();await f.c.capture('language');await assert.rejects(f.c.input('click:0:0'),/pixel verification/);assert.equal(f.requests.filter(r=>r.cmd).length,0);
    const z=fixture();z.c.start();await z.c.capture('language');z.c.match('language',image,[[0,0,1,1]]);z.setMode('credits');await assert.rejects(z.c.input('click:0:0'),/frozen zero/);assert.equal(z.requests.filter(r=>r.cmd).length,0);
    const q=fixture();q.c.start();q.setMode('hang');const pending=q.c.step(1);await assert.rejects(q.c.step(1),/busy/);await assert.rejects(pending,/unacknowledged/);assert.equal(q.requests.length,1);
    const stale=fixture();stale.c.start();const old=await stale.c.capture('language');await stale.c.step(1);assert.throws(()=>stale.c.match('language',old,[[0,0,1,1]]),/current presented/);
  });
  await test('a fresh controller cannot reset an existing task ledger or replay its control stream',async()=>{
    const dir=fs.mkdtempSync(__dirname+'/fixtures/civ2-controller/metadata-only-');
    try {
      const cfg=config();cfg.outputDir=dir;
      createController(cfg,{now:()=>0}).start();
      const before=fs.readFileSync(dir+'/capture-plan.json');
      assert.throws(()=>createController(cfg,{now:()=>0}).start(),/no allowance reset/);
      assert(fs.readFileSync(dir+'/capture-plan.json').equals(before));
      // No captures were created; this removes only synthetic test metadata.
    } finally {fs.rmSync(dir,{recursive:true});}
  });
  console.log(JSON.stringify({passed:checks.length,checks,syntheticOnly:true,guestExecution:false}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
