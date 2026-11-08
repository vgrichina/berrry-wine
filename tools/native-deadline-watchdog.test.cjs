'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {planLifecycle,arm,requireArmed,bind,alive}=require('./native-deadline-watchdog.cjs'),{identity}=require('./native-clock-process-proof.cjs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const base=path.resolve(process.env.RECOIL_PROOF_TEST_DIR);
 if(process.argv[2]==='target') {
  const profile=base+'/chrome-profile',deadline=Number(process.argv[3]);
  const chrome=cp.spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--no-first-run','--disable-dev-shm-usage','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
  for(let n=0;n<100&&!fs.existsSync(profile+'/DevToolsActivePort');n++)await wait(20);
  bind(base,deadline,chrome.pid,profile);fs.writeFileSync(base+'/eventloop-blocked.json',JSON.stringify({node:identity(process.pid),chrome:identity(chrome.pid)}));
  // An in-process setTimeout cannot fire while this loop is running.
  const end=Date.now()+15000;while(Date.now()<end){};throw Error('independent watchdog failed to stop blocked driver');
 }
 fs.mkdirSync(base,{recursive:true});let cases=0;
 const planDir=base+'/plan-only-no-box';fs.mkdirSync(planDir);const createdAt=Date.now()-10000;
 const allocation={boxId:'bx_unit_no_allocation',createdAt,expiresAt:createdAt+30*60000};
 const plan=planLifecycle(planDir,allocation);assert.equal(plan.watchdogDeadline,createdAt+25*60000);assert.equal(plan.browserDeadline,plan.watchdogDeadline-90000);assert.throws(()=>planLifecycle(planDir,allocation),/EEXIST/);
 await assert.rejects(()=>arm(planDir,{browserDeadline:Date.now()+1000,watchdogDeadline:Date.now()+2000,profile:planDir+'/chrome-profile'}));assert(!fs.existsSync(planDir+'/watchdog-ready.json'),'mismatched allocation plan cannot arm');
 assert.throws(()=>planLifecycle(planDir,{...allocation,createdAt:createdAt-30*60000,expiresAt:createdAt-60000}),/insufficient/);

 assert(['deadline','mutation'].includes(process.env.RECOIL_WATCHDOG_CASE),'one kernel-supervised case per invocation');
 for(const mutate of [process.env.RECOIL_WATCHDOG_CASE==='mutation']) {
  const out=base+'/'+(mutate?'mutation':'deadline');fs.mkdirSync(out);const browserDeadline=Date.now()+3500,watchdogDeadline=browserDeadline+6500;
  const ready=await arm(out,{browserDeadline,watchdogDeadline,profile:out+'/chrome-profile'});assert(alive(ready));assert.notEqual(ready.pid,process.pid);requireArmed(out,browserDeadline);
  assert.throws(()=>requireArmed(out,browserDeadline+1),/deadline mismatch/);assert(!alive({...identity(process.pid),startTicks:'0'}));
  const child=cp.spawn(process.execPath,[__filename,'target',String(browserDeadline)],{env:{...process.env,RECOIL_PROOF_TEST_DIR:out},stdio:['ignore',fs.openSync(out+'/target.stdout','wx'),fs.openSync(out+'/target.stderr','wx')]});
  try {
   for(let n=0;n<100&&!fs.existsSync(out+'/eventloop-blocked.json');n++)await wait(20);
   assert(fs.existsSync(out+'/eventloop-blocked.json'),'target bound before eventloop block');
   if(mutate){const p=out+'/watchdog-deadlines.json',c=JSON.parse(fs.readFileSync(p));c.browserDeadline+=600000;c.watchdogDeadline+=600000;fs.writeFileSync(p,JSON.stringify(c));assert.throws(()=>requireArmed(out,c.browserDeadline),/config changed/);}
   await Promise.race([new Promise(r=>child.once('exit',r)),wait(10000).then(()=>{throw Error('watchdog did not terminate blocked process');})]);
   assert.equal(child.signalCode,'SIGTERM');
   const bound=JSON.parse(fs.readFileSync(out+'/eventloop-blocked.json'));
   for(let n=0;n<80&&alive(bound.chrome);n++)await wait(100);assert(!alive(bound.chrome),'owned Chrome stopped');
   fs.rmSync(out+'/chrome-profile',{recursive:true,force:true});
   for(let n=0;n<100&&!fs.existsSync(out+'/watchdog-terminal.json');n++)await wait(20);
   const terminal=JSON.parse(fs.readFileSync(out+'/watchdog-terminal.json'));assert(terminal.deadlineFired);
   const events=fs.readFileSync(out+'/watchdog-events.jsonl','utf8').trim().split('\n').map(s=>JSON.parse(s));
   assert.equal(events.find(e=>e.type==='deadline-term').deadline,browserDeadline);assert.equal(events.filter(e=>e.type==='bound').length,1);
   if(mutate)assert(events.some(e=>e.type==='immutable-config-mutation-refused'));
   assert(events.filter(e=>e.type==='signal').every(e=>[bound.node.pid,bound.chrome.pid].includes(e.pid)));
   assert.throws(()=>requireArmed(out,browserDeadline));cases++;
  }finally {if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');}
 }
 fs.writeFileSync(base+'/result.json',JSON.stringify({passed:true,cases,realChrome:true,original:false,independentBlockedEventloopDeadline:true,immutableMutationRefused:true,exactPidStartSignals:true,observableHeartbeats:true,allocationBoundImmutablePlan:true,profileAndTargetsDrained:true}));console.log(fs.readFileSync(base+'/result.json','utf8'));
})().catch(e=>{console.error(e);process.exitCode=1;});
