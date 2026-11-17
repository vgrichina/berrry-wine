#!/usr/bin/env node
'use strict';
// Real process route tests, including transient parent return and parent death.
//
// Port notes (CONVENTIONS item 10): Node has no pidfd, prctl(PR_SET_CHILD_SUBREAPER)
// or waitpid() of a non-child. Pins are start tokens polled through
// tools/native-proc.cjs; the reparented owner and its orphans cannot be reaped
// here, so their end is OBSERVED (token gone) and recorded with actualWait:false
// instead of claiming a wait that did not happen. The JS supervisor ports poll
// tokens rather than holding pidfds, so the /proc/<pid>/fdinfo pidfd census of
// the original cannot be reproduced and is recorded as an empty list.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const assert=require('node:assert/strict');
const NP=require('../tools/native-proc.cjs');
const ROOT=path.resolve(__dirname,'..');
const OWNER=path.join(ROOT,'tools/caesar3-persistent-owner.js');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function until(fn,seconds=15){
 const end=NP.monotonic()+seconds;
 while(!fn()){assert(NP.monotonic()<end,'condition deadline');await NP.sleep(10);}
}
const token=pid=>NP.token(pid);
const gone=(pid,t)=>{try{return NP.token(pid)!==t||!NP.alive(pid);}catch{return true;}};
async function outer(out,seconds){
 // Lazy: another group ports the GL supervisor (CONVENTIONS 10).
 const m=require('../tools/gltron-current-supervise.js');
 return await new m.ParentProcessSupervisor(out,[process.execPath,__filename,'fixture-native',out,seconds],
  {preparation:10,runtime:15,preparation_watchdog:12,runtime_watchdog:17}).run();
}
// Replaces the original's inline `python -c` fixture native.
async function fixtureNative(out,seconds){
 fs.writeFileSync(path.join(out,'prepared.json'),'{}');await NP.sleep(Number(seconds)*1000);console.log('fixture native completion');
}
// Transient launcher: starts the owner in its own session and returns only after
// the safe handover. (The original also set PDEATHSIG=SIGTERM on the owner,
// which the owner immediately cleared; Node can set neither.)
async function launcher(marker,args){
 const p=cp.spawn(args[0],args.slice(1),{stdio:'ignore',detached:true});
 let exited=false;p.once('exit',()=>{exited=true;});
 const end=NP.monotonic()+5;
 while(!fs.existsSync(marker)){assert(!exited&&NP.monotonic()<end);await NP.sleep(5);}
 console.log(p.pid);p.unref();process.exit(0);
}
async function run(out,native_mode=false){
 fs.mkdirSync(out);
 const adapter_hash=sha(fs.readFileSync(path.join(ROOT,'tools/caesar3-current-native.js')));
 const owner_hash=sha(fs.readFileSync(OWNER));
 if(native_mode){
  const route=require(OWNER);
  const worker=Number(process.env.CAESAR3_WORKER_PID);const [,,anchoridentity]=route.anchor(worker,token(worker));
  fs.writeFileSync(path.join(out,'witness-worker-pin.json'),JSON.stringify(anchoridentity));
 }
 // prctl(PR_SET_CHILD_SUBREAPER) has no Node API: orphans are observed, not reaped.
 const results=[];
 const cases=[['healthy',native_mode?'8':'2'],['owner-death',native_mode?'100':'10']];
 if(!native_mode)cases.push(['deadline','20']);
 for(const [mode,seconds] of cases){
  const r=path.join(out,mode);fs.mkdirSync(r);const o=path.join(r,'owner');const native=native_mode?path.join(r,'outer-fixture/outer'):path.join(r,'outer');
  const log=fs.openSync(path.join(r,'launcher.log'),'w');
  const worker=native_mode?Number(process.env.CAESAR3_WORKER_PID):process.pid;
  const command=native_mode?[process.execPath,'tools/caesar3-current-native.js','supervised','--outer-fixture']:[process.execPath,__filename,'outer',native,seconds];
  if(native_mode&&process.env.CAESAR3_WORKING==='1')command.push('--working-qualification');
  const args=[process.execPath,OWNER,'owner',o,String(worker),token(worker),native_mode?'1000':mode==='deadline'?'10':'25',...command];
  const env={...process.env,CAESAR3_RUN:path.join(r,'outer-fixture'),CAESAR3_FIXTURE_SECONDS:seconds};
  const launched=cp.spawnSync(process.execPath,[__filename,'launcher',path.join(o,'worker-owner-armed.json'),...args],{cwd:ROOT,env,timeout:10000,encoding:'utf8'});
  assert.equal(launched.status,0,launched.stderr);
  const pid=Number(launched.stdout);const ownerToken=token(pid);
  await until(()=>fs.existsSync(path.join(native,'runtime-start.json')),120);
  if(native_mode)await until(()=>{const p=path.join(r,'outer-fixture/native.stdout.log');return fs.existsSync(p)&&fs.readFileSync(p,'utf8').includes('[CreateWindow]');},20);
  const armed=read(path.join(path.dirname(native),'outer-parent-process-armed.json')),identity=read(path.join(o,'worker-owner-armed.json'));
  assert(armed.pid===pid&&armed.startToken===token(pid));
  // launcher is actually waited/reaped; healthy dedicated parent still alive.
  assert(!gone(pid,ownerToken));process.kill(pid,0);
  const pidfds=[]; // see header: no pidfd census for token-polling supervisors
  fs.writeFileSync(path.join(r,'tool-return-proof.json'),JSON.stringify({launcherActualWait:true,launcherExit:launched.status,ownerAlive:true,ownerPid:pid,ownerStartToken:token(pid),actualOuterParent:armed,actualParentPidfds:pidfds,worker:identity}));
  if(mode==='owner-death'){assert(!gone(pid,ownerToken));process.kill(pid,'SIGKILL');}
  await until(()=>gone(pid,ownerToken),mode==='owner-death'?15:120);
  const adopted=[];
  if(mode==='owner-death'){
   await until(()=>fs.existsSync(path.join(native,'wait.json')));
   await until(()=>fs.existsSync(path.join(o,'owner-watchdog-result.json')));
   for(const child of [read(path.join(o,'outer-child.json')),read(path.join(o,'owner-watchdog-armed.json'))]){
    const t=child.startToken??null;await until(()=>t===null?!NP.exists(child.pid)||!NP.alive(child.pid):gone(child.pid,t));
    adopted.push({pid:child.pid,actualWait:false,observedExit:true,exit:null});
   }
  }
  const w=read(path.join(native,'wait.json'));
  assert(w.actualWait&&w.stdoutEOF&&w.stderrEOF&&!(w.remainingAfterRuntime&&w.remainingAfterRuntime.length));
  assert(w.watchdogs.every(x=>x.actualWait&&x.stdoutEOF&&x.stderrEOF&&x.returncode===0));
  if(native_mode){
   const nw=read(path.join(r,'outer-fixture/native-wait.json')),release=read(path.join(r,'outer-fixture/runtime-release.json'));
   assert.equal(read(path.join(r,'outer-fixture/runtime-inputs.json')).sources['tools/caesar3-current-native.js'],adapter_hash);
   assert(nw.actualWait&&nw.stdoutEOF&&nw.stderrEOF);
   const watchdog=read(path.join(r,'outer-fixture/watchdog-wait.json'));assert(watchdog.actualWait&&watchdog.stdoutEOF&&watchdog.stderrEOF);
   assert(release.descriptorsClosed);
   if(mode==='owner-death')assert(nw.hostCleanup&&[0,-15].includes(nw.exit)&&!(nw.nativeQuit??false));
  }
  const parent=read(path.join(native,'parent-process-owner.json'));
  assert.equal(parent.parentDeathObserved,mode==='owner-death');
  if(mode==='healthy'){
   const ow=read(path.join(o,'owner-outer-wait.json'));assert(ow.actualWait&&ow.stdoutEOF&&ow.stderrEOF&&ow.returncode===0);
   assert(read(path.join(o,'owner-watchdog-wait.json')).actualWait);
  }
  if(mode==='deadline'){
   assert(read(path.join(o,'owner-watchdog-result.json')).fired);
   assert(read(path.join(o,'owner-outer-wait.json')).actualWait&&w.supervisorExitCode===143);
  }
  // The reparented owner is not our child: its end is observed, its status unknown.
  results.push({mode,ownerActualWait:false,ownerObservedExit:true,ownerExit:null,adoptedActualWaits:adopted,parent,outer:w});
  fs.closeSync(log);
 }
 fs.writeFileSync(path.join(out,'proof.json'),JSON.stringify({passed:true,realNative:native_mode,componentGit:process.env.CAESAR3_COMPONENT_REVISION??null,adapterSHA256:adapter_hash,ownerSHA256:owner_hash,transientLauncherActuallyReturned:true,unchangedActualParentSupervisor:true,results},null,2));
 console.log('PASS dedicated waiting owner survives transient launcher; actual parent death cancels and joins child and watchdogs with both EOF');
}
module.exports={run,outer};
if(require.main===module){
 const a=process.argv.slice(2);
 (a[0]==='outer'?outer(a[1],a[2]).then(rc=>{process.exitCode=rc&255;})
  :a[0]==='fixture-native'?fixtureNative(a[1],a[2])
  :a[0]==='launcher'?launcher(a[1],a.slice(2))
  :run(a[0]==='--native'?a[1]:a[0],a[0]==='--native')).catch(e=>{console.error(e&&e.stack||e);process.exitCode=1;});
}
