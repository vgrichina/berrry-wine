'use strict';
// Exercise the actual complete production controller in a Git-free stage.
// DRIVER_PREFLIGHT returns before server/Chrome creation, so the controller's
// ordinary missing-ACK terminal is expected, followed by actual custody joins.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const assert=require('node:assert/strict'),{once}=require('node:events');
const publication=require('./redline-current-publication.cjs');
const startup=require('./redline-current-startup.cjs').version;
const base=path.resolve(process.env.REDLINE_STAGED_FIXTURE_RUN||'');
assert(process.env.REDLINE_STAGED_FIXTURE_RUN,'unique evidence directory required');
fs.mkdirSync(base,{recursive:true});
async function main(){
 if(process.argv.includes('--first-error-controls'))return firstErrorControls();
 if(process.argv.includes('--prebrowser-runner'))return prebrowserRunner(process.argv.at(-1));
 if(process.argv.includes('--prebrowser-controls'))return prebrowserControls();
 const run=base+'/prepared',plan=publication.prepare(run,publication.version,startup);
 // Git-authenticated parent verification, then an independent expected digest.
 const pins=publication.prelaunch(run,publication.version,startup),digest=plan.manifestSHA256;
 const exec=cp.execFileSync;cp.execFileSync=(exe,...args)=>{assert.notEqual(exe,'git','Git forbidden in staged controller');return exec(exe,...args);};
 try{
  assert.deepEqual(publication.stagedPrelaunch(run,publication.version,startup,digest),pins);
  for(const bad of [undefined,'','0'.repeat(64)])assert.throws(()=>publication.stagedPrelaunch(run,publication.version,startup,bad));
  assert.throws(()=>publication.stagedPrelaunch(run,publication.version,'wrong',digest));
  const read=fs.readFileSync;let controls=0;
  for(const target of ['tools/redline-current-publication.cjs','tools/native_publication_launch.py','tools/native_publication_observer.py','tools/native_kernel_custody.py','tools/redline-publication-snapshots.py','lib/redline-current-startup-v1.js','tools/redline-current-startup.cjs','lib/redline-startup-admission.js'])for(const mode of ['missing','changed']){
   fs.readFileSync=function(file,...args){if(path.resolve(String(file))===path.resolve(__dirname,'..',target)){if(mode==='missing')throw Error('missing staged provider');const b=Buffer.from(read.call(this,file));b[b.length-1]^=1;return typeof args[0]==='string'?b.toString():b;}return read.call(this,file,...args);};
   let spawned=false;
   try{assert.throws(()=>publication.stagedLaunch({run,publicationVersion:publication.version,startupVersion:startup,manifestSHA256:digest,deadline:Date.now()+40000,spawn:()=>{spawned=true;}}));assert(!spawned);assert(!fs.existsSync(run+'/publication-custody'));controls++;}finally{fs.readFileSync=read;}
  }
  // Attacker-controlled manifest+seal repinning does not change parent trust.
  const raw=read(run+'/runtime-pins.json'),seal=read(run+'/replacement-pinset-seal.json');
  const forged=JSON.parse(raw);forged.files[0].sha256='0'.repeat(64);const bad=Buffer.from(JSON.stringify(forged));
  fs.readFileSync=function(file,...args){if(String(file)===run+'/runtime-pins.json')return bad;if(String(file)===run+'/replacement-pinset-seal.json')return Buffer.from(JSON.stringify({...JSON.parse(seal),manifestSHA256:publicationHash(bad)}));return read.call(this,file,...args);};
  try{assert.throws(()=>publication.stagedPrelaunch(run,publication.version,startup,digest),/independent prepared manifest SHA mismatch/);}finally{fs.readFileSync=read;}
  fs.writeFileSync(base+'/negative-controls.json',JSON.stringify({passed:true,controls,forgedRepinRefused:true,gitForbidden:true}));
 }finally{cp.execFileSync=exec;}
 const source=publication.fixtureSource(publication.version,startup,digest);
 assert(source.includes('.stagedLaunch({run,publicationVersion:'));assert(source.includes('manifestSHA256:'+JSON.stringify(digest)));
 assert(source.includes("[[',','comma']]"));assert(!source.includes("['.','period']"));
 // Run the real CLI/controller, rather than a helper disconnected from it.
 const bin=base+'/bin';fs.mkdirSync(bin);fs.writeFileSync(bin+'/git','#!/bin/sh\necho forbidden > '+JSON.stringify(base+'/git-invoked')+'\nexit 99\n',{mode:0o755});
 // Offline custody single-steps every validation syscall. Give this test its
 // own initial deadline; no production deadline is changed or renewed.
 const child=cp.spawn(process.execPath,[__dirname+'/redline-current-publication.cjs','--staged-fixture',run,publication.version,startup,digest],{env:{...process.env,PATH:bin+':'+process.env.PATH,REDLINE_RUN:run,REDLINE_NATIVE_TRACE:'1',REDLINE_STARTUP_BOUNDARY:'1',DRIVER_PREFLIGHT:'1',BROWSER_DEADLINE:String(Date.now()+120000)},stdio:['ignore','pipe','pipe']});
 const exit=once(child,'exit'),close=once(child,'close');let stdout='',stderr='',stdoutEOF=false,stderrEOF=false;
 child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);child.stdout.once('end',()=>stdoutEOF=true);child.stderr.once('end',()=>stderrEOF=true);
 const [code,signal]=await exit;await close;assert.equal(code,1);assert.equal(signal,null);assert(stdoutEOF&&stderrEOF);assert(!fs.existsSync(base+'/git-invoked'));
 const joins=JSON.parse(fs.readFileSync(run+'/fixture-process-joins.json'));
 assert.equal(joins.caller.code,0);assert(joins.callerStdoutEOF&&joins.callerStderrEOF&&joins.watchdogStdoutEOF&&joins.watchdogStderrEOF);
 const drain=JSON.parse(fs.readFileSync(run+'/publication-custody/kernel-drain.json'));assert(drain.complete);assert.equal(drain.remaining.length,0);assert.equal(drain.unreaped.length,0);
 for(const p of drain.owned)assert(drain.reaped.some(r=>r.pid===p.pid&&r.start===p.start));
 const retrieval=publicationHash(fs.readFileSync(run+'/publication-custody/kernel-command.log'));assert(!fs.existsSync(run+'/native-fixture/process.json'));
 const snapshot=require('./redline-publication-caller.cjs').retrieve(run+'/publication-custody');assert(snapshot.custodyComplete);assert.equal(snapshot.readiness,'UNKNOWN');
 fs.writeFileSync(base+'/actual-production-controller.json',JSON.stringify({passed:true,code,signal,stdout,stderr,actualWait:true,stdoutEOF,stderrEOF,joins,owned:drain.owned.length,reaped:drain.reaped.length,kernelCommandSHA256:retrieval,noChrome:true,gitForbidden:true},null,2));
 const journal=run+'/publication-custody/publication-syscalls.ndjson',b=fs.readFileSync(journal),z=require('node:zlib').gzipSync(b);fs.writeFileSync(journal+'.gz',z);assert.deepEqual(require('node:zlib').gunzipSync(fs.readFileSync(journal+'.gz')),b);fs.writeFileSync(base+'/journal-recovery.json',JSON.stringify({path:journal,sha256:publicationHash(b),size:b.length,gzipSHA256:publicationHash(z),gzipSize:z.length}));fs.unlinkSync(journal);
 console.log('PASS actual full staged production CLI/controller, independent digest, 16 missing/changed controls, forged repin refusal; no Git/server/Chrome; custody waits/reaps/separate EOF');
}
function publicationHash(b){return require('node:crypto').createHash('sha256').update(b).digest('hex');}
async function firstErrorControls(){
 // Execute the actual generated production controller. Only its custody launch
 // and retrieval services are inert; watchdog, signals, child waits and pipes
 // are real. A synthetic clock crosses the ORIGINAL deadline before ready.
 const vm=require('node:vm');const rows=[];
 for(const mode of ['deadline','caller-exit','retrieval-error']){
  const run=base+'/'+mode;fs.mkdirSync(run);const deadline=Date.now()+40000;
  let crossed=false;const errors=[],proc={env:{...process.env,REDLINE_RUN:run,BROWSER_DEADLINE:String(deadline)},execPath:process.execPath,pid:process.pid};
  class Clock extends Date {static now(){return crossed?deadline+1:Date.now();}}
  const adapter={phases:publication.phases,stagedLaunch(){
   const child=cp.spawn(process.execPath,['-e',mode==='caller-exit'?'process.exit(7)':"const fs=require('fs');process.on('SIGTERM',()=>{fs.writeFileSync(process.argv[1]+'/at-cancellation.json',JSON.stringify({firstErrorPresent:fs.existsSync(process.argv[1]+'/fixture-first-error.json')}));process.exit(0)});console.log('READY');setInterval(()=>{},1000);",run],{detached:true,stdio:['ignore','pipe','pipe']});
   if(mode!=='caller-exit')child.stdout.once('data',()=>crossed=true);return child;
  }};
  const req=n=>{
   if(n==='./redline-current-publication.cjs')return adapter;
   if(n==='./redline-publication-caller.cjs')return {retrieve(){if(mode==='retrieval-error')throw Error('synthetic retrieval failure');return {readiness:'UNKNOWN'};}};
   if(n.endsWith('/transport.cjs'))return {};
   return require(n);
  };
  await vm.runInNewContext(publication.fixtureSource(publication.version,startup,'a'.repeat(64)),{require:req,__dirname,process:proc,Date:Clock,console:{...console,error:e=>errors.push(String(e))},Buffer,setTimeout,clearTimeout});
  const joins=JSON.parse(fs.readFileSync(run+'/fixture-process-joins.json'));
  assert(joins.callerStdoutEOF&&joins.callerStderrEOF&&joins.watchdogStdoutEOF&&joins.watchdogStderrEOF);
  assert.equal(joins.watchdog.code,1);assert.equal(proc.exitCode,1);
  const expected=mode==='caller-exit'?'production caller exited before ACK':'fixture controller deadline';
  fs.writeFileSync(run+'/observed.json',JSON.stringify({errors,joins,expected},null,2));
  assert.match(errors.join('\n'),new RegExp(expected),'first caught error must survive cleanup');
  const first=JSON.parse(fs.readFileSync(run+'/fixture-first-error.json'));
  assert.match(first.error,new RegExp(expected));assert.equal(first.browserDeadline,deadline);
  if(mode!=='caller-exit')assert.equal(JSON.parse(fs.readFileSync(run+'/at-cancellation.json')).firstErrorPresent,true,'first error persisted before cancellation');
  assert(!fs.existsSync(run+'/native-qualification.json'));
  const cleanup=JSON.parse(fs.readFileSync(run+'/fixture-cleanup-errors.json'));
  assert(cleanup.errors.some(e=>e.includes('independent watchdog')));
  if(mode==='retrieval-error')assert(cleanup.errors.some(e=>e.includes('synthetic retrieval failure')));
  rows.push({mode,first,cleanup,joins});
 }
 fs.writeFileSync(base+'/first-error-controls.json',JSON.stringify({passed:true,actualController:true,nativeReady:false,rows},null,2));
 console.log('PASS actual production controller first error survives watchdog/retrieval failures; original deadline, actual waits and separate EOF');
}
function prebrowserRunner(mode){
 const run=process.env.REDLINE_RUN;
 // Inject latency while returning the exact original provider bytes. This
 // measures attribution by phase without changing a pin or validation result.
 const read=fs.readFileSync;let delayed=false;
 fs.readFileSync=function(file,...args){
  if(!delayed&&String(file).endsWith('/host.js')){delayed=true;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,60);}
  return read.call(this,file,...args);
 };
 const spawn=cp.spawn;cp.spawn=function(exe,...args){if(exe==='/usr/bin/google-chrome')throw Error('synthetic browser launch boundary');return spawn.call(this,exe,...args);};
 if(mode==='http-error')global.fetch=async()=>{throw Error('synthetic HTTP validation failure');};
 require(run+'/publication-caller.cjs');
}
async function prebrowserControls(){
 const rows=[];
 for(const mode of ['http-error','browser-boundary']){
  const run=base+'/'+mode;publication.prepare(run,publication.version,startup);
  const deadline=Date.now()+40000;
  // Observable independent sibling armed before this direct offline caller.
  const watchdog=cp.spawn(process.execPath,['-e',"let pid;console.log('ARMED');const timer=setTimeout(()=>{if(pid)try{process.kill(-pid,'SIGKILL')}catch{};process.exit(9)},30000);process.stdin.on('data',b=>{if(b.toString().trim()==='DONE'){clearTimeout(timer);process.exit(0)}pid=Number(b)});"],{stdio:['pipe','pipe','pipe']});
  const wx=once(watchdog,'exit'),wc=once(watchdog,'close');watchdog.stderr.resume();
  assert.match(String((await once(watchdog.stdout,'data'))[0]),/ARMED/);watchdog.stdout.resume();
  const child=cp.spawn(process.execPath,[__filename,'--prebrowser-runner',mode],{detached:true,env:{...process.env,REDLINE_RUN:run,REDLINE_NATIVE_FIXTURE:'1',REDLINE_NATIVE_TRACE:'1',REDLINE_STARTUP_BOUNDARY:'1',BROWSER_DEADLINE:String(deadline)},stdio:['ignore','pipe','pipe']});
  const ex=once(child,'exit'),closed=once(child,'close');let stdout='',stderr='',stdoutEOF=false,stderrEOF=false;
  child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);child.stdout.once('end',()=>stdoutEOF=true);child.stderr.once('end',()=>stderrEOF=true);watchdog.stdin.write(child.pid+'\n');
  const [code,signal]=await ex;await closed;watchdog.stdin.write('DONE\n');const [watchdogCode]=await wx;await wc;
  assert.equal(code,1);assert.equal(signal,null);assert.equal(watchdogCode,0);assert(stdoutEOF&&stderrEOF);
  const phases=fs.readdirSync(run).filter(n=>/^(caller|browser)-phase-/.test(n)).sort().map(n=>JSON.parse(fs.readFileSync(run+'/'+n)));
  const by=name=>phases.find(p=>p.phase===name);
  assert(by('closure-validation-end').elapsedMs-by('closure-validation-begin').elapsedMs>=55,'injected read latency measured in actual validation');
  assert(by('server-acquisition-end'));assert(by('http-pin-begin'));
  const failure=JSON.parse(fs.readFileSync(run+'/native-fixture/first-browser-failure.json'));
  assert.match(failure.error,new RegExp(mode==='http-error'?'synthetic HTTP validation failure':'synthetic browser launch boundary'));
  assert.equal(!!by('browser-launch-begin'),mode==='browser-boundary');
  if(mode==='browser-boundary')assert.equal(phases.filter(p=>p.phase==='http-pin-end').length,4);
  for(const p of phases)assert.equal(p.browserDeadline,deadline);
  assert(!fs.existsSync(run+'/native-fixture/process.json'));assert(!fs.existsSync(run+'/native-fixture/ready.json'));
  rows.push({mode,phases,failure,code,signal,stdout,stderr,stdoutEOF,stderrEOF,watchdogCode,watchdogSeparateEOF:true,noChrome:true});
 }
 fs.writeFileSync(base+'/prebrowser-controls.json',JSON.stringify({passed:true,nativeReadiness:'UNKNOWN',browserEOF:'UNKNOWN',rows},null,2));
 console.log('PASS actual generated owning caller: measured pinned-read delay, real server and HTTP validation, first errors before Chrome; no native browser');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
