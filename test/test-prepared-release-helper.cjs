'use strict';
// Real helper processes; pre-arm negatives use a snapshot-only HTTP fixture.
// Actual input/release/Quit qualification is performed against a native PE.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process');
const assert=require('node:assert/strict'),c=require('../tools/native-supervisor-common.cjs');
async function main(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'prepared-release-')),rows=[];
 const owner={owner:'actual-helper-control',epoch:1},lease={nativeProcess:{pid:process.pid,document:'one'},screen:{w:640,h:480}};
 let document=lease,slow=false;const requests=[];
 const server=http.createServer((req,res)=>{let b='';req.on('data',x=>b+=x);req.on('end',()=>{const v=JSON.parse(b);requests.push(v);assert.equal(v.action,'snapshot','no input or fabricated release ACK');setTimeout(()=>res.end(JSON.stringify({ok:true,value:document})),slow?1100:0);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/ctl';
 const preload=path.join(root,'delay.cjs');
 fs.writeFileSync(preload,`if(process.argv[2]==='standby'){Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1300);const w=process.stdout.write.bind(process.stdout);process.stdout.write=function(b){const s=String(b);w(s.slice(0,7));setTimeout(()=>w(s.slice(7)),30);return true;};}`);
 async function prepare(name,env=process.env){const run=path.join(root,name);fs.mkdirSync(run);c.save(run,'native-pid.json',{pid:process.pid,startToken:c.token(process.pid)});c.save(run,'input-owner.json',owner);c.save(run,'lease-snapshot.json',lease);return {run,h:await c.prepareReleaseHelper({run,url,name,standbyUntil:c.now()+10,env})};}
 async function end(name,h){h.cancel();const w=await h.waited;assert(w.actualWait&&w.stdoutEOF&&w.stderrEOF);rows.push({name,...w});return w;}
 try{
  const started=c.now(),{h}=await prepare('delayed',{...process.env,NODE_OPTIONS:'--require='+preload});
  assert(c.now()-started>1.3);assert.equal(h.ready.armed,false);assert.equal(requests.length,0);
  const armAt=c.now(),armed=await h.arm({owner,lease,due:c.now()+3,confirmationMs:2000});assert(armed.armed&&c.now()-armAt<1);await end('delayed-fragmented-ready-and-arm',h);
  for(const kind of ['owner','document','native','cancel','late']){
   document=lease;slow=false;const {run,h}=await prepare(kind);
   if(kind==='owner')fs.writeFileSync(path.join(run,'input-owner.json'),JSON.stringify({...owner,epoch:2}));
   if(kind==='document')document={...lease,nativeProcess:{...lease.nativeProcess,document:'replacement'}};
   if(kind==='native')fs.writeFileSync(path.join(run,'native-pid.json'),JSON.stringify({pid:process.pid,startToken:'replaced'}));
   if(kind==='cancel')c.save(run,'cancel-request.json',{at:c.now()});
   if(kind==='late')slow=true;
   await assert.rejects(h.arm({owner,lease,due:c.now()+3,confirmationMs:2000}));await end(kind,h);
   assert(!fs.existsSync(path.join(run,kind+'-dispatch.json')));assert(!fs.existsSync(path.join(run,kind+'-up.json')));
  }
  document=lease;slow=false;
  // Parent exits normally with an unarmed standby. The real IPC disconnect
  // retires it without an arm, endpoint request, or a leaked Node child.
  const run=path.join(root,'parent-exit');fs.mkdirSync(run);c.save(run,'native-pid.json',{pid:process.pid,startToken:c.token(process.pid)});
  const code=`const c=require(${JSON.stringify(path.resolve(__dirname,'../tools/native-supervisor-common.cjs'))});(async()=>{const h=await c.prepareReleaseHelper({run:${JSON.stringify(run)},url:${JSON.stringify(url)},name:'early',standbyUntil:c.now()+5});process.stdout.write(String(h.child.pid)+'\\n');process.exit(0);})();`;
  const parent=cp.spawn(process.execPath,['-e',code],{stdio:['ignore','pipe','pipe']});const w=await c.communicate(parent);assert.equal(w.returncode,0);const pid=Number(w.stdout.toString().trim());const until=c.now()+3;
  while(c.processExists(pid)){const stat=fs.readFileSync('/proc/'+pid+'/stat','utf8');if(stat.slice(stat.lastIndexOf(')')+2).startsWith('Z'))break;assert(c.now()<until,'unarmed helper survived parent exit');await c.sleep(10);}
  assert(requests.every(x=>x.action==='snapshot'));
  console.log('PASS actual delayed startup, fragmented READY/ARM, one-second arm, owner/document/native replacement, cancellation, late arm, early parent exit; zero DOWN/UP requests');
  if(process.env.PREPARED_HELPER_EVIDENCE)c.save(process.env.PREPARED_HELPER_EVIDENCE,'helper-process-tests.json',{rows,requests,earlyParent:{pid:parent.pid,exit:w.returncode,stdoutEOF:parent.stdout.readableEnded,stderrEOF:parent.stderr.readableEnded,helperPid:pid,helperExited:true}});
 }finally{await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
