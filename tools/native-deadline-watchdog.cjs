'use strict';
// Independent of the browser event loop. Does not replace kernel custody/drain.
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {identity,hasArgument}=require('./native-clock-process-proof.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),wait=ms=>new Promise(r=>setTimeout(r,ms));
function write(file,value) {const fd=fs.openSync(file,'wx');try{fs.writeSync(fd,JSON.stringify(value)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
function append(file,value) {const fd=fs.openSync(file,'a');try{fs.writeSync(fd,JSON.stringify(value)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
function alive(p) {try{const current=identity(p.pid);return current.startTicks===p.startTicks&&current.bootId===p.bootId;}catch(e){if(['ENOENT','ESRCH'].includes(e.code)||/must be alive/.test(e.message))return false;throw e;}}
function planLifecycle(directory,{boxId,createdAt,expiresAt}) {
 assert(/^bx_[a-z0-9_]+$/.test(boxId),'explicit newly allocated box ID required');
 assert(Number.isFinite(createdAt)&&Number.isFinite(expiresAt)&&createdAt<=Date.now()&&expiresAt>createdAt,'allocation timestamps required');
 const watchdogDeadline=Math.min(createdAt+25*60000,expiresAt);
 const browserDeadline=watchdogDeadline-90000;
 assert(Date.now()<browserDeadline,'insufficient immutable allocation window');
 const value={boxId,createdAt,expiresAt,browserDeadline,watchdogDeadline,finalDeadline:new Date(watchdogDeadline).toISOString(),shutdownDelegated:true,immutable:true};
 write(directory+'/lifecycle.json',value);return value;
}
async function arm(directory,{browserDeadline,watchdogDeadline,profile}) {
 const now=Date.now();assert(now<browserDeadline&&browserDeadline<watchdogDeadline&&watchdogDeadline-now<=25*60000,'immutable <=25 minute deadlines required');
 let allocation;
 if(fs.existsSync(directory+'/lifecycle.json')) {
  allocation=JSON.parse(fs.readFileSync(directory+'/lifecycle.json'));
  assert(allocation.immutable&&allocation.boxId&&allocation.watchdogDeadline===Math.min(allocation.createdAt+25*60000,allocation.expiresAt),'immutable allocation plan required');
  assert.equal(allocation.browserDeadline,allocation.watchdogDeadline-90000);assert.equal(browserDeadline,allocation.browserDeadline);assert.equal(watchdogDeadline,allocation.watchdogDeadline);
 }
 const config={version:1,id:crypto.randomUUID(),armedAt:now,browserDeadline,watchdogDeadline,profile,...(allocation?{allocation}:{})};
 write(directory+'/watchdog-deadlines.json',config);
 const fd=fs.openSync(directory+'/watchdog.stdout','wx');
 const child=cp.spawn(process.execPath,[__filename,'run',directory],{detached:true,stdio:['ignore',fd,fd],env:{PATH:process.env.PATH}});child.unref();fs.closeSync(fd);
 for(let n=0;n<100;n++) {if(fs.existsSync(directory+'/watchdog-ready.json')) {const ready=requireArmed(directory,browserDeadline);assert.equal(ready.pid,child.pid);return ready;}await wait(20);}
 throw Error('independent watchdog did not become observable');
}
function requireArmed(directory,deadline) {
 const raw=fs.readFileSync(directory+'/watchdog-deadlines.json'),c=JSON.parse(raw),r=JSON.parse(fs.readFileSync(directory+'/watchdog-ready.json'));
 assert.equal(c.browserDeadline,deadline,'immutable launch deadline mismatch');assert.equal(r.configSha256,sha(raw),'immutable watchdog config changed');assert(alive(r),'watchdog PID/start absent');assert(Date.now()<deadline);
 const rows=fs.readFileSync(directory+'/watchdog-heartbeat.jsonl','utf8').trim().split('\n'),last=JSON.parse(rows.at(-1));
 assert.equal(last.id,c.id);assert(Date.now()-last.at>=0&&Date.now()-last.at<=2000,'observable watchdog heartbeat stale');
 assert(!fs.existsSync(directory+'/watchdog-terminal.json'),'watchdog terminal');return r;
}
function bind(directory,deadline,chromePid,profile) {
 requireArmed(directory,deadline);const c=JSON.parse(fs.readFileSync(directory+'/watchdog-deadlines.json'));assert.equal(c.profile,profile);
 write(directory+'/watchdog-targets.json',{id:c.id,profile,targets:[identity(process.pid),identity(chromePid)]});
}
async function run(directory) {
 const raw=fs.readFileSync(directory+'/watchdog-deadlines.json'),c=JSON.parse(raw),digest=sha(raw),self=identity(process.pid);
 assert(c.armedAt<=Date.now()&&Date.now()<c.browserDeadline&&c.browserDeadline<c.watchdogDeadline&&c.watchdogDeadline-c.armedAt<=25*60000);
 const origin=process.hrtime.bigint(),wall=Date.now(),monoNow=()=>wall+Number(process.hrtime.bigint()-origin)/1e6;
 const event=(type,extra={})=>append(directory+'/watchdog-events.jsonl',{id:c.id,type,at:Date.now(),monotonicWall:monoNow(),...extra});
 let targets,targetsRaw,term=false,killed=false,mutation=false;
 append(directory+'/watchdog-heartbeat.jsonl',{id:c.id,at:Date.now(),monotonicWall:monoNow()});
 write(directory+'/watchdog-ready.json',{...self,id:c.id,configSha256:digest,browserDeadline:c.browserDeadline,watchdogDeadline:c.watchdogDeadline});
 event('prearmed');
 for(;;) {
  if(sha(fs.readFileSync(directory+'/watchdog-deadlines.json'))!==digest&&!mutation){mutation=true;event('immutable-config-mutation-refused');}
  if(!targets&&fs.existsSync(directory+'/watchdog-targets.json')) {
   targetsRaw=fs.readFileSync(directory+'/watchdog-targets.json','utf8');const binding=JSON.parse(targetsRaw);
   assert.equal(binding.id,c.id);assert.equal(binding.profile,c.profile);assert.equal(binding.targets.length,2);
   assert.notEqual(binding.targets[0].pid,binding.targets[1].pid);
   for(const p of binding.targets) {assert.notEqual(p.pid,process.pid);assert(alive(p));assert.deepEqual(identity(p.pid),p,'binding must match independent process census');assert.deepEqual(p.namespaces,self.namespaces);}
   assert.equal(binding.targets[0].exe,self.exe,'owned Node required');assert(/\/(?:chrome|chromium)$/.test(binding.targets[1].exe),'owned Chrome required');
   assert(hasArgument(binding.targets[1],'--user-data-dir='+c.profile),'exact owned Chrome profile required');
   targets=binding.targets;event('bound',{targets});
  }
  if(targets&&fs.readFileSync(directory+'/watchdog-targets.json','utf8')!==targetsRaw&&!mutation){mutation=true;event('immutable-binding-mutation-refused');}
  // Either clock reaching the frozen deadline fires it; wall-clock rollback
  // cannot postpone it. A mutated file never changes the in-memory deadlines.
  const due=Math.max(Date.now(),monoNow());
  if((mutation||due>=c.browserDeadline)&&!term) {
   term=true;event('deadline-term',{deadline:c.browserDeadline});
   for(const p of targets||[])if(alive(p))try {process.kill(p.pid,'SIGTERM');event('signal',{pid:p.pid,startTicks:p.startTicks,signal:'SIGTERM'});}catch(e){if(e.code!=='ESRCH')throw e;}
  }
  if(due>=c.browserDeadline+5000&&!killed) {
   killed=true;for(const p of targets||[])if(alive(p))try {process.kill(p.pid,'SIGKILL');event('signal',{pid:p.pid,startTicks:p.startTicks,signal:'SIGKILL'});}catch(e){if(e.code!=='ESRCH')throw e;}
  }
  if(targets&&targets.every(p=>!alive(p))&&!fs.existsSync(c.profile)) {
   write(directory+'/watchdog-terminal.json',{id:c.id,at:Date.now(),reason:'bound processes absent and profile removed',deadlineFired:term,scope:'driver and Chrome only; descendants/endpoints/held input require kernel custodian drain'});return;
  }
  if(due>=c.watchdogDeadline) {
   write(directory+'/watchdog-terminal.json',{id:c.id,at:Date.now(),reason:'immutable watchdog cap',targetsAbsent:targets?targets.every(p=>!alive(p)):null,profileAbsent:!fs.existsSync(c.profile),scope:'not a descendant or box shutdown receipt'});return;
  }
  append(directory+'/watchdog-heartbeat.jsonl',{id:c.id,at:Date.now(),monotonicWall:monoNow(),bound:!!targets,term,killed});await wait(100);
 }
}
if(require.main===module) (async()=>{if(process.argv[2]==='plan')process.stdout.write(JSON.stringify(planLifecycle(process.argv[3],JSON.parse(process.argv[4]))));else if(process.argv[2]==='arm')process.stdout.write(JSON.stringify(await arm(process.argv[3],JSON.parse(process.argv[4]))));else {assert.equal(process.argv[2],'run');await run(process.argv[3]);}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={planLifecycle,arm,requireArmed,bind,alive};
