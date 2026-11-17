'use strict';
// Authored media and real parent/OS-child APIs; no game files or input.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {VirtualFS}=require('../lib/filesystem'),context=require('../lib/readonly-media-context');
const fixture=require('./test-sims-inherited-readonly-media-child-context.cjs');
async function host(out){
 fs.mkdirSync(out,{recursive:true});const file=path.join(out,'control.iso');fs.writeFileSync(file,fixture.tinyIso());
 const parent=new VirtualFS(),mounted=context.mountIso(parent,file,{drive:'E',prefer:'primary'});
 const child=new VirtualFS();let opened=[];
 try{
  const snapshot=JSON.parse(JSON.stringify(context.capture(parent)));
  assert.equal(snapshot[0].recipe.kind,'iso9660');assert.equal(snapshot[0].recipe.drive,'e');
  opened=await context.restore(child,snapshot);assert.deepEqual(context.tree(child,['e']),context.tree(parent,['e']));
  assert.equal(Buffer.from(child.files.get('e:\\maxis.ini').data).toString(),'[fixture]\r\nvalue=CONTROL\r\n');
  assert.equal(child.createFile('E:\\new',0x40000000,2),0);
  assert(context.capture(child).length);
  // A fresh independent full digest can overlap CPU/import preparation, but
  // only its one-shot context capability can authorize the subsequent mount.
  const preparedChild=new VirtualFS(),ticket=context.prepareRestore(snapshot);
  const prepared=await context.restore(preparedChild,snapshot,ticket);
  try {
    assert.deepEqual(context.tree(preparedChild,['e']),context.tree(parent,['e']));
    assert.equal(preparedChild.createFile('E:\\new',0x40000000,2),0);
    await assert.rejects(context.restore(new VirtualFS(),snapshot,ticket),/preparation context mismatch/);
  } finally {for(const m of prepared)require('../lib/media-cli').closeMedia(m);}
  await assert.rejects(context.restore(new VirtualFS(),snapshot,{}),/preparation context mismatch/);
  const changed=structuredClone(snapshot);changed[0].sources[0].sha256='0'.repeat(64);
  const refused=new VirtualFS();
  await assert.rejects(context.restore(refused,changed,context.prepareRestore(changed)),/source pin mismatch/);
  assert.equal(refused.files.size,0);assert.equal(refused.readOnlyDrives.size,0);
  // Changing the transfer while its worker hashes cannot change the ticket.
  const altered=structuredClone(snapshot),alteredTicket=context.prepareRestore(altered);
  altered[0].recipe.drive='d';
  await assert.rejects(context.restore(new VirtualFS(),altered,alteredTicket),/preparation context mismatch/);
  await alteredTicket.cancel();
  const bad=structuredClone(snapshot);bad[0].recipe.drive='d';await assert.rejects(context.restore(new VirtualFS(),bad),/identity mismatch|drive became writable/);
  // A real remount must hash all source bytes once, through its held provider,
  // and compare the resulting digest/identity before adopting any guest files.
  // Count full-source reads, rather than asserting a particular call sequence.
  const read=fs.readSync,size=fs.statSync(file).size;let scanned=0;
  fs.readSync=function(fd,buffer,offset,length,position){
   const n=Reflect.apply(read,this,arguments);
   if(length===1024*1024&&position===null)scanned+=n;
   return n;
  };
  let once=[];
  try{once=await context.restore(new VirtualFS(),snapshot);assert.equal(scanned,size,'one complete source digest');}
  finally{fs.readSync=read;for(const m of once)require('../lib/media-cli').closeMedia(m);}
  for(const change of [r=>r.sources[0].sha256='0'.repeat(64),r=>r.sources[0].identity[1]='0']){
   const corrupt=structuredClone(snapshot),untouched=new VirtualFS();change(corrupt[0]);
   await assert.rejects(context.restore(untouched,corrupt),/source pin mismatch/);
   assert.equal(untouched.files.size,0,'refused staged media must not enter the child');
   assert.equal(untouched.readOnlyDrives.size,0);
  }
  // A source changed after preparation must still fail before adoption.
  const replacement=path.join(out,'replacement.iso');fs.writeFileSync(replacement,fixture.tinyIso());
  const replacementParent=new VirtualFS(),replacementMount=context.mountIso(replacementParent,replacement,{drive:'E',prefer:'primary'});
  try {
    const transfer=context.capture(replacementParent),pending=context.prepareRestore(transfer);
    // A separate preparation and restore proves readiness; this ticket must
    // still reject a replaced inode even if its own read finished already.
    const once=await context.restore(new VirtualFS(),transfer,context.prepareRestore(transfer));
    for(const m of once)require('../lib/media-cli').closeMedia(m);
    fs.renameSync(replacement,replacement+'.old');fs.writeFileSync(replacement,fixture.tinyIso());
    const empty=new VirtualFS();
    await assert.rejects(context.restore(empty,transfer,pending),/source pin mismatch|prepared source changed/);
    assert.equal(empty.files.size,0);assert.equal(empty.readOnlyDrives.size,0);
  } finally {require('../lib/media-cli').closeMedia(replacementMount.media);}
  mounted.media.parts[0].source.close();assert.throws(()=>context.capture(parent),/ownership revoked|replaced/);
  opened[0].parts[0].source.close();assert.throws(()=>context.capture(child),/ownership revoked|replaced/);
 }finally{require('../lib/media-cli').closeMedia(mounted.media);for(const m of opened)require('../lib/media-cli').closeMedia(m);}
 console.log('PASS owned explicit ISO nondefault drive/options remount, bytes/metadata/readonly, mismatch and revoked source refusal');
}
function native(out,repro){
 fs.mkdirSync(out,{recursive:true});fixture.prepareNative(out+'/inputs');
 const args=['test/run.js','--exe='+out+'/inputs/setup.exe','--iso='+out+'/inputs/control.iso','--iso-drive=D',
  '--no-build','--spawn-processes','--threads','--real-ticks','--max-seconds=20','--max-batches=1000000000','--stuck-after=0','--quiet-api','--quiet-blocks','--dll-seed='+out+'/inputs/guard.dll'];
 if(process.env.NEVERHOOD_TEST_MODULE)args.push('--wasm='+process.env.NEVERHOOD_TEST_MODULE);
 let command=args;
 if(repro){
  const revision=cp.execFileSync('git',['rev-parse','e16a4713b'],{encoding:'utf8'}).trim();
  fs.writeFileSync(out+'/repro-source.json',JSON.stringify({gitSHA:revision,path:'test/run.js',sourceArchive:'Git',originalExecuted:false})+'\n');
  const loader=`const M=require('module'),p=require('path'),c=require('child_process');const file=p.resolve('test/run.js'),m=new M(file);m.filename=file;m.paths=M._nodeModulePaths(p.dirname(file));m._compile(c.execFileSync('git',['show','${revision}:test/run.js']).toString(),file);`;
  command=['-e',loader,...args];
 }
 const p=cp.spawnSync(process.execPath,command,{encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});
 fs.writeFileSync(out+'/native.stdout.log',p.stdout||'');fs.writeFileSync(out+'/native.stderr.log',p.stderr||'');
 fs.writeFileSync(out+'/native-wait.json',JSON.stringify({args,exit:p.status,signal:p.signal,actualWait:true,stdoutEOF:true,stderrEOF:true,error:p.error?.message})+'\n');
 assert(!p.error,p.error?.message);
 if(repro){assert.match(p.stdout,/readonly media drive has no source ownership: d/);assert.match(p.stdout,/\[Exit\] code=23/);console.log('PASS faithful explicit ISO parent CreateProcess refusal reproduced');}
 else{
  assert.equal(p.status,0,p.stderr);
  assert.match(p.stdout,/CreateProcess .*cwd d:\\empty/);
  assert.match(p.stdout,/\[child [^\]]+\] Calling DllMain/);
  assert.match(p.stdout,/\[child [^\]]+\] \[vfs\] working directory: d:\\empty/);
  assert.match(p.stdout,/child state merged: 1 file\(s\) written, 0 deleted, \d+ registry\/INI key\(s\)/);
  assert.equal((p.stdout.match(/\[Exit\] code=0/g)||[]).length,2);
  assert.doesNotMatch(p.stdout,/could not be exported|context refused|merging .* failed|working directory is not present|\[max-seconds\]/);
  console.log('PASS real explicit ISO parent/child, early DllMain reads, inherited D cwd/volume/readonly, parent verifies merged file/registry, both native exits zero');
 }
}
if(require.main===module){const out=path.resolve(process.argv[3]);
 if(process.argv[2]==='--host')host(out).catch(e=>{console.error(e);process.exitCode=1;});
 else native(out,process.argv[2]==='--repro');
}
