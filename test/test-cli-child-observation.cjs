'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const {ChildObservation,identity,hash}=require('../lib/cli-child-observation');
function unit(out){
 fs.mkdirSync(out,{recursive:true});const exe=path.join(out,'input.exe');fs.writeFileSync(exe,'authored input');
 const params={moduleBytes:Buffer.from('authored module'),runner:__filename,executable:exe,guestExe:'c:\\parent.exe',port:43101};
 const binding={owner:'owner',epoch:1,identity:'binding'},actor={processId:1,threadId:2};let serial=0;
 const observer=()=>{const o=new ChildObservation(params);o.bind(binding);return o;};
 const command=()=>({...binding,nonce:'one-input',deadline:Date.now()+2900,releaseDeadline:Date.now()+1650,
  guestExe:'c:\\child.exe',executableSHA256:hash(fs.readFileSync(exe)),port:43102,directory:path.join(out,'arm-'+serial++)});
 const arm=(o,c=command())=>o.arm(c,{}, {physicalUp:true,capture:'0x0',focusWindow:actor});
 for(const [field,value]of [['owner','foreign'],['epoch',9],['identity','other'],['deadline',()=>Date.now()-1],['releaseDeadline',()=>Date.now()+2000],['guestExe','relative.exe'],['executableSHA256','bad'],['port',43101]]){
  // Clock-relative values are taken per case: earlier cases spawn ps/sysctl
  // and can consume the 250ms margin on a loaded host.
  const o=observer(),c=command();c[field]=typeof value==='function'?value():value;assert.throws(()=>arm(o,c),/child observation:/,field);
  assert(!fs.existsSync(c.directory));
 }
 for(const [name,change]of [['foreign-exe',()=>['c:\\unrelated.exe',actor]],['wrong-actor',()=>['c:\\child.exe',{...actor,threadId:3}]],
  ['source-mismatch',()=>{fs.writeFileSync(exe,'different');return ['c:\\child.exe',actor];}],
  ['late',o=>{o.armRecord.deadline=Date.now()-1;return ['c:\\child.exe',actor];}]]){
  fs.writeFileSync(exe,'authored input');const o=observer(),a=arm(o);o.begin({...binding,nonce:a.nonce});
  const [guest,who]=change(o);assert.equal(o.prepare(guest,exe,who),null,name);assert(o.failed);
  assert(fs.existsSync(path.join(a.directory,'failure.json')));
  assert.equal(o.prepare('c:\\child.exe',exe,actor),null,'failure cannot reopen');
 }
 fs.writeFileSync(exe,'authored input');const o=observer(),a=arm(o);
 assert.throws(()=>o.begin({...binding,nonce:'other'}),/wrong transition nonce/);
 o.begin({...binding,nonce:a.nonce});assert.throws(()=>o.begin({...binding,nonce:a.nonce}),/repeated/);
 assert.throws(()=>arm(o),/one-shot/);
 const e=o.prepare('c:\\child.exe',exe,actor);assert(e);
 // A real OS child independently validates the parent/start token and its
 // actual loaded module/source bytes, rather than trusting a parent receipt.
 const childCode=`const {ChildObservation}=require('./lib/cli-child-observation');const p=JSON.parse(process.argv[1]);new ChildObservation({...p,moduleBytes:Buffer.from('authored module'),envelope:process.argv[2]});console.log('VALIDATED');`;
 const childParams={...params,guestExe:'c:\\child.exe',port:43102};delete childParams.moduleBytes;
 for(const [name,mutate,success]of [['valid',()=>{},true],['foreign-parent',x=>x.parent.pid++,false],['reused-parent',x=>x.parent.startToken='0',false],
  ['module',x=>x.inputs.moduleSHA256='0'.repeat(64),false],['source',x=>x.inputs.sourceSHA256='0'.repeat(64),false],
  ['exe',x=>x.executableSHA256='0'.repeat(64),false],['expired',x=>x.deadline=Date.now()-1,false]]){
  const envelope=structuredClone(e);envelope.deadline=Date.now()+2900;mutate(envelope);
  const p=cp.spawnSync(process.execPath,['-e',childCode,JSON.stringify(childParams),JSON.stringify(envelope)],{encoding:'utf8',timeout:4000});
  assert.equal(p.status===0,success,name+': '+p.stderr);assert(!p.signal);
 }
 // Concurrent terminal failure publication must preserve the first record and clean temporary files.
 const before=JSON.parse(fs.readFileSync(path.join(a.directory,'armed.json')));
 for(let i=0;i<2;i++)o.fail('concurrent shutdown '+i);
 assert.equal(JSON.parse(fs.readFileSync(path.join(a.directory,'failure.json'))).reason,'concurrent shutdown 0');
 assert(!fs.readdirSync(a.directory).some(n=>n.endsWith('.pending')));
 assert.equal(before.token,a.token);
 const concurrent=path.join(out,'concurrent');fs.mkdirSync(concurrent);
 const racers=String.raw`const cp=require('node:child_process');const code="const {ChildObservation,identity}=require('./lib/cli-child-observation');ChildObservation.prototype.fail.call({armRecord:JSON.parse(process.argv[1]),self:identity()},'parallel terminal failure')";Promise.all(Array.from({length:8},()=>new Promise((resolve,reject)=>{const c=cp.spawn(process.execPath,['-e',code,process.argv[1]],{stdio:'pipe'});let err='';c.stderr.on('data',b=>err+=b);c.on('close',n=>n?reject(Error(err)):resolve());}))).catch(e=>{console.error(e);process.exitCode=1;});`;
 const raced=cp.spawnSync(process.execPath,['-e',racers,JSON.stringify({...a,directory:concurrent})],{encoding:'utf8',timeout:10000});
 assert.equal(raced.status,0,raced.stderr);assert.equal(fs.readdirSync(concurrent).join(','),'failure.json');
 const tcp=cp.spawnSync(process.execPath,[__filename,'--transport',path.join(out,'release-transport')],{encoding:'utf8',timeout:10000});
 assert.equal(tcp.status,0,tcp.stderr);console.log(tcp.stdout.trim());
 console.log('PASS one-shot provenance, actor/nonce/owner/source/foreign-child/late refusal; actual child validates module/source/executable/parent and reused PID');
}
// Fresh controller instance bound to an authored run directory.
function controller(run){
 process.env.NEVERHOOD_CURRENT_RUN=run;process.env.NEVERHOOD_CURRENT_PORT='1';
 const file=require.resolve('../tools/neverhood-original-current-control.js');delete require.cache[file];
 return require(file);
}
// Actual TCP: a server that reads the request, waits, then closes without a reply.
async function transport(root){
 const http=require('node:http');
 fs.mkdirSync(root);const m=controller(root);
 for(const [name,delay,budget]of [['delayed-disconnect',.30,.70],['absolute-deadline',.70,.25]]){
  const sockets=new Set();
  const server=http.createServer((req,res)=>{req.resume();req.on('end',()=>setTimeout(()=>req.socket.destroy(),delay*1000));});
  server.on('connection',s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
   m.R=path.join(root,name);fs.mkdirSync(m.R);m.PORT=server.address().port;
   m.save('launch.json',{rootPort:m.PORT});m.save('native-pid.json',{pid:process.pid,startToken:require('../tools/native-proc.cjs').token(process.pid)});
   const start=Date.now()/1000;let acknowledged=true;
   try{await m.release('release','owner',start,start+budget);}catch{acknowledged=false;}
   assert(!acknowledged,'closed transport cannot acknowledge UP');
   const elapsed=Date.now()/1000-start,record=m.read('release-up.json');assert(!record.physicalUpACK);
   if(name==='delayed-disconnect')assert(.28<=elapsed&&elapsed<.70&&!record.error.includes('timed out'),JSON.stringify([elapsed,record]));
   else assert(.23<=elapsed&&elapsed<.45&&record.error.includes('timed out'),JSON.stringify([elapsed,record]));
   assert.equal(fs.readFileSync(path.join(m.R,'requests.jsonl'),'utf8').split('\n').filter(Boolean).length,1);
   m.save('transport-proof.json',{elapsed,budget,physicalUpACK:false,noRetry:true});
  }finally{for(const s of sockets)s.destroy();await new Promise(r=>server.close(r));}
 }
 console.log('PASS actual TCP delayed disconnect exceeds old 200ms timeout; absolute UP deadline still closes; no synthetic ACK or retry');
}
async function negativeChild(run,out){
 const m=controller(run);fs.mkdirSync(out);
 const original=JSON.parse(fs.readFileSync(path.join(run,'play-child-arm.json'),'utf8')),source=original.directory;
 const names=['armed','spawned','ready','parent-exit'];
 for(const mode of ['valid','foreign-token','unrelated-exe','source-mismatch','dead-pid','reused-pid','wrong-parent','parent-failure','child-failure','late-record','unknown']){
  const d=path.join(out,mode);fs.mkdirSync(d);const arm=structuredClone(original);arm.directory=d;arm.deadline=Date.now()+2900;
  const rows=Object.fromEntries(names.map(n=>[n,JSON.parse(fs.readFileSync(path.join(source,n+'.json'),'utf8'))]));rows.armed=arm;
  if(mode==='foreign-token')rows.ready.token='other';
  if(mode==='unrelated-exe')rows.ready.guestExe='c:\\foreign.exe';
  if(mode==='source-mismatch')rows.ready.inputs.sourceSHA256='0'.repeat(64);
  if(mode==='dead-pid'||mode==='reused-pid')for(const n of ['ready','spawned']){if(mode==='dead-pid')rows[n].child.pid=2147483647;else rows[n].child.startToken='0';}
  if(mode==='wrong-parent')rows.ready.parent.startToken='0';
  if(mode==='parent-failure')rows['parent-exit'].exitCode=7;
  if(mode==='late-record')rows.ready.at=arm.deadline+1;
  for(const [n,v]of Object.entries(rows))fs.writeFileSync(path.join(d,n+'.json'),JSON.stringify(v));
  m.R=d;
  if(mode==='unknown')m.save('PERMANENT-UNKNOWN.json',{});
  if(mode==='child-failure')fs.writeFileSync(path.join(d,'child-wait.json'),'{}');
  const attempts=[],old=m.call;
  m.call=(...a)=>{attempts.push(a);throw new assert.AssertionError({message:'unexpected transport'});};
  try{
   m.child_records(arm);
   assert(mode==='valid',mode);
  }catch(e){
   if(!(e instanceof assert.AssertionError||['ENOENT','ESRCH'].includes(e.code)))throw e;
   assert(mode!=='valid',mode+': '+e.message);
   m.fail(mode,'expected pretransport refusal');
   // Use the real guarded transport after UNKNOWN, including cleanup and a
   // would-be child request. None may even inspect process identity.
   m.call=old;
   for(const cleanup of [false,true]){
    let refused=false;
    try{await m.call({action:'snapshot'},{cleanup,target:rows.ready.child,port:arm.port});}
    catch(e){assert(e.message.includes('permanent UNKNOWN'),e.message);refused=true;}
    assert(refused,'UNKNOWN allowed transport');
   }
  }finally{m.call=old;}
  assert(!attempts.length&&!fs.existsSync(path.join(d,'requests.jsonl')));
 }
 console.log('PASS live child provenance; foreign/unrelated/source/dead/reused/parent-failure/child-failure/late/UNKNOWN all refuse before transport');
}
function negative(run,out){
 const p=cp.spawnSync(process.execPath,[__filename,'--negative',run,out],{encoding:'utf8',timeout:15000});
 fs.writeFileSync(out+'-wait.json',JSON.stringify({exit:p.status,signal:p.signal,actualWait:true,stdoutEOF:true,stderrEOF:true,stdout:p.stdout,stderr:p.stderr})+'\n');
 assert.equal(p.status,0,p.stderr);console.log(p.stdout.trim());
}
module.exports={unit,negative};
if(require.main===module){
 const fail=e=>{console.error(e&&e.stack||e);process.exitCode=1;};
 if(process.argv[2]==='--transport')transport(path.resolve(process.argv[3])).catch(fail);
 else if(process.argv[2]==='--negative')negativeChild(path.resolve(process.argv[3]),path.resolve(process.argv[4])).catch(fail);
 else unit(path.resolve(process.argv[2]||fs.mkdtempSync(path.join(os.tmpdir(),'wa-child-observe-'))));
}
