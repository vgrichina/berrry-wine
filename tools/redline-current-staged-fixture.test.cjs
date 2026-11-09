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
 const child=cp.spawn(process.execPath,[__dirname+'/redline-current-publication.cjs','--staged-fixture',run,publication.version,startup,digest],{env:{...process.env,PATH:bin+':'+process.env.PATH,REDLINE_RUN:run,REDLINE_NATIVE_TRACE:'1',REDLINE_STARTUP_BOUNDARY:'1',DRIVER_PREFLIGHT:'1',BROWSER_DEADLINE:String(Date.now()+40000)},stdio:['ignore','pipe','pipe']});
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
main().catch(e=>{console.error(e);process.exitCode=1;});
