'use strict';
// Run this census in a separate Node process. No CDP, guest, or input access.
const fs=require('node:fs'),assert=require('node:assert/strict'),cp=require('node:child_process'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function identity(pid) {
 assert(Number.isSafeInteger(pid)&&pid>0,'PID required');
 const base='/proc/'+pid,raw=fs.readFileSync(base+'/stat','utf8'),fields=raw.slice(raw.lastIndexOf(')')+2).trim().split(/\s+/);
 assert(!['Z','X'].includes(fields[0]),'process must be alive');
 return {pid,startTicks:fields[19],bootId:fs.readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim(),
  namespaces:Object.fromEntries(['net','pid','mnt','time'].map(n=>[n,fs.readlinkSync(base+'/ns/'+n)])),
  exe:fs.readlinkSync(base+'/exe'),argv:fs.readFileSync(base+'/cmdline','utf8').split('\0').filter(Boolean)};
}
// This host's Chrome rewrites /proc cmdline into a single space-separated
// title. Fixed launch paths contain no whitespace; require one exact token,
// never a substring (a different profile suffix must fail).
function hasArgument(p,arg) {assert(!/\s/.test(arg),'unambiguous fixed argument required');return p.argv.flatMap(a=>a.split(/\s+/)).filter(a=>a===arg).length===1;}
function listener(pid,port) {
 assert(Number.isInteger(port)&&port>0&&port<65536,'listener port required');
 const rows=fs.readFileSync('/proc/'+pid+'/net/tcp','utf8').trim().split('\n').slice(1).map(s=>s.trim().split(/\s+/));
 const matches=rows.filter(a=>a[1]==='0100007F:'+port.toString(16).toUpperCase().padStart(4,'0')&&a[3]==='0A');
 assert.equal(matches.length,1,'one loopback listener required');
 const inode=matches[0][9],fds=[];
 for(const fd of fs.readdirSync('/proc/'+pid+'/fd'))try {if(fs.readlinkSync('/proc/'+pid+'/fd/'+fd)==='socket:['+inode+']')fds.push(fd);}catch(e){if(e.code!=='ENOENT')throw e;}
 assert(fds.length,'listener FD must belong to process');return {pid,port,inode,fds};
}
function census(request) {
 const began=Date.now(),mono=process.hrtime.bigint(),observer=identity(process.pid);
 assert(/^[a-f0-9]{64}$/.test(request.challenge),'fresh challenge required');
 assert(Number.isFinite(request.deadline)&&began<request.deadline,'immutable deadline expired');
 assert(request.node.pid!==request.chrome.pid&&request.node.pid!==process.pid&&request.chrome.pid!==process.pid,'independent observer required');
 const processes=[['node',request.node],['chrome',request.chrome]].map(([role,expected])=>{
  const p=identity(expected.pid);assert.equal(p.startTicks,expected.startTicks,'PID start mismatch');
  assert.equal(p.bootId,request.bootId,'boot mismatch');assert.deepEqual(p.namespaces,observer.namespaces,'same host namespaces required');
  assert.equal(p.namespaces.net,expected.netns,'network namespace mismatch');
  if(role==='node')assert.equal(p.exe,observer.exe,'Node executable mismatch');
  else {assert(/\/(?:chrome|chromium)$/.test(p.exe),'Chrome executable required');assert(hasArgument(p,'--user-data-dir='+request.profile),'exact Chrome profile required');assert(hasArgument(p,'--remote-debugging-port=0'),'owned ephemeral DevTools required');}
  return {role,...p};
 });
 assert.equal(fs.realpathSync(request.profile),request.profile,'owned non-symlink profile required');
 const [debugPort,debugPath]=fs.readFileSync(request.profile+'/DevToolsActivePort','utf8').trim().split('\n');
 assert.equal(Number(debugPort),request.debugPort);assert.equal(request.endpoint,'ws://127.0.0.1:'+debugPort+debugPath,'actual profile endpoint required');
 const ownedLoopbackListener=listener(request.chrome.pid,request.debugPort),nodeListener=listener(request.node.pid,request.port);
 // Fence PID reuse/exits during enumeration, including FD inspection.
 for(const p of processes)assert.deepEqual(identity(p.pid),(({role,...rest})=>rest)(p),'process changed during census');
 const ended=Date.now(),elapsed=Number(process.hrtime.bigint()-mono)/1e6;
 assert(Math.abs(ended-began-elapsed)<=3,'observer wall/monotonic clock discontinuity');
 return {version:1,passed:true,moduleSha256:sha(fs.readFileSync(__filename)),challenge:request.challenge,requestSha256:sha(JSON.stringify(request)),observer,processes,
  profile:request.profile,endpoint:request.endpoint,deadline:request.deadline,ownedLoopbackListener:[ownedLoopbackListener],nodeListener,
  chromeFds:ownedLoopbackListener.fds,sameBoot:true,sameNamespace:true,clock:{began,ended,elapsed},scope:'same Linux boot/namespaces and live listener ownership; browser clock separately bracketed by Software gate'};
}
function createVerifier({out,deadline,retain}) {
 assert(typeof retain==='function','durable proof retention required');const moduleSha256=sha(fs.readFileSync(__filename));let sequence=0,unknown;
 return async function verify() {
  if(unknown)throw unknown;
  try {
   const claimed=JSON.parse(fs.readFileSync(out+'/same-host-clock-proof.json')),p=JSON.parse(fs.readFileSync(out+'/process.json')),e=JSON.parse(fs.readFileSync(out+'/endpoint.json'));
   assert.equal(p.pid,process.pid,'current driver required');assert.equal(p.chromePid,claimed.chromeProc.pid);assert.equal(claimed.driverProc.pid,process.pid);
   const request={challenge:crypto.randomBytes(32).toString('hex'),bootId:claimed.bootId,node:claimed.driverProc,chrome:claimed.chromeProc,profile:p.profile,port:p.port,debugPort:e.debugPort,endpoint:claimed.endpoint,deadline};
   assert.equal(request.endpoint,'ws://127.0.0.1:'+e.debugPort+e.browserPath,'exact endpoint required');assert.equal(p.profile,out+'/chrome-profile');
   const began=Date.now(),mono=process.hrtime.bigint();
   const proof=await new Promise((resolve,reject)=>cp.execFile(process.execPath,[__filename,JSON.stringify(request)],{timeout:2000,maxBuffer:1024*1024,env:{PATH:process.env.PATH}},(err,stdout)=>{if(err)reject(err);else try{resolve(JSON.parse(stdout));}catch(e){reject(e);}}));
   const ended=Date.now(),elapsed=Number(process.hrtime.bigint()-mono)/1e6;
   assert.equal(proof.moduleSha256,moduleSha256,'producer bytes changed');assert.equal(proof.requestSha256,sha(JSON.stringify(request)));assert.equal(proof.challenge,request.challenge);assert(proof.passed);
   assert(proof.clock.began>=began&&proof.clock.ended<=ended&&Math.abs(ended-began-elapsed)<=3,'independent OS clock bracket failed');
   assert(ended<deadline,'immutable deadline expired');
   await retain({sequence:++sequence,request,proof,parentClock:{began,ended,elapsed}});return true;
  } catch(error) {unknown=Error('UNKNOWN independent clock/process proof: '+error.message+'; no replay');try{await retain({sequence:++sequence,refused:true,error:unknown.message,at:Date.now()});}catch{}throw unknown;}
 };
}
function createGuardedProbe(verify,probe,{deadline,transitionMs=5000,isClosed=()=>false}) {
 assert(Number.isFinite(deadline)&&transitionMs>0&&transitionMs<=5000,'immutable guarded deadline required');
 let unknown,transitionDue;
 return async function(options={phase:'afterResume'}) {
  if(unknown)throw unknown;
  try {
   const entry=Date.now();if(options.phase==='beforeResume'){assert(!transitionDue,'one baseline');transitionDue=Math.min(deadline,entry+transitionMs);}
   assert(transitionDue&&entry<transitionDue,'immutable transition expired');
   await verify();assert(!isClosed(),'lifecycle retired before probe');const result=await probe(options);await verify();
   const now=Date.now(),fresh=at=>assert(now-at>=0&&now-at<=250,'Software evidence expired after independent clock census');
   fresh(result.at);
   for(const read of result.reads||[]) {fresh(read.software.copyAt);for(const response of read.responses)fresh(response.requestAt);}
   assert(!isClosed(),'lifecycle retired during independent clock census');assert(now<transitionDue,'immutable transition expired');return result;
  }catch(error){unknown=Error('UNKNOWN clock-guarded Software probe: '+error.message+'; no replay');throw unknown;}
 };
}
if(require.main===module)try {process.stdout.write(JSON.stringify(census(JSON.parse(process.argv[2]))));}catch(e){process.stderr.write(e.stack+'\n');process.exitCode=1;}
module.exports={identity,hasArgument,listener,census,createVerifier,createGuardedProbe};
