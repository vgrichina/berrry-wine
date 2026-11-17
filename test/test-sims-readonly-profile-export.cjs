'use strict';
// Read the genuine pinned media as data only; never execute its programs.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {VirtualFS}=require('../lib/filesystem'),media=require('../lib/media-cli'),{saveVfsToHost,saveCompletedChildState}=require('../lib/vfs-export');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function check(){
 const vfs=new VirtualFS(),m=await media.analyzeMediaPaths(['test/binaries/sims-complete-collection/discs/Disc1'],{exePath:'D:\\Setup\\Setup.exe'});
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sims-readonly-profile-'));
 try{
  await m.plan.mount(vfs);
  const key='d:\\maxis.ini',e=vfs.files.get(key),stock=fs.readFileSync('test/binaries/sims-complete-collection/static/Disc1/maxis.ini');
  assert(e);assert(vfs.readOnlyDrives.has('d'));assert(e.attrs&1);assert.deepEqual(Buffer.from(e.data),stock);
  console.log(JSON.stringify({actualMountedKey:key,bytes:stock.length,sha256:sha(stock),readonlyDrive:true,readonlyAttribute:true,providerRetained:!!e._provider}));
  assert(e._provider,'readonly profile staging/read must retain borrowed source provenance');
  const rows=saveVfsToHost(vfs,path.join(tmp,'parent'));
  assert(!rows.some(r=>r.guestPath.toLowerCase()===key),'readonly source is not writable machine state');
  assert(!fs.existsSync(path.join(tmp,'parent','d:','maxis.ini')));
  vfs.files.set('c:\\real-write.bin',{data:Buffer.from('native consequence'),attrs:0x20});
  saveCompletedChildState(vfs,{exportStore:()=>({})},path.join(tmp,'out'),path.join(tmp,'registry.json'),path.join(tmp,'complete.json'),'fixture-token');
  assert(fs.existsSync(path.join(tmp,'complete.json')));assert.equal(fs.readFileSync(path.join(tmp,'out','real-write.bin'),'utf8'),'native consequence');
  // A writable provider read still becomes resident machine state. Changing a
  // readonly file to writable must likewise stop borrowing its source.
  const {BytesProvider}=require('../lib/byte-provider');
  const c=vfs.setProviderFile('c:\\mutable.bin',{provider:new BytesProvider(Buffer.from('before')),attrs:0x20});
  assert.equal(Buffer.from(c.data).toString(),'before');assert(!c._provider);
  const r=vfs.setProviderFile('c:\\attribute.bin',{provider:new BytesProvider(Buffer.from('ro')),attrs:1});
  assert.equal(Buffer.from(r.data).toString(),'ro');assert(!r._provider,'readonly attribute on writable drive preserves existing export semantics');
  vfs.setDriveReadOnly('f',true);const f=vfs.setProviderFile('f:\\source.ini',{provider:new BytesProvider(Buffer.from('disc')),attrs:1});
  await vfs.materialize('f:\\source.ini');assert(f._provider);assert.equal(Buffer.from(f.data).toString(),'disc');
  const adopted=new VirtualFS();adopted.adoptFrom(vfs);adopted.setDriveReadOnly('f',false);
  assert.equal(Buffer.from(f.data).toString(),'disc');assert(!f._provider,'adopted entry must follow the new active filesystem drive policy');
  // No newly trusted resident/non-C exception: the existing guard still rejects.
  vfs.files.set('d:\\untrusted.bin',{data:Buffer.from('reject'),attrs:1});
  assert.throws(()=>saveCompletedChildState(vfs,{exportStore:()=>({})},path.join(tmp,'bad'),path.join(tmp,'bad-reg'),path.join(tmp,'bad-complete'),'bad'),/unsafe child export path/);
  assert(!fs.existsSync(path.join(tmp,'bad-complete')));
  return {status:'PASS',genuineMediaExecuted:false,readonlyProfileProvenancePreserved:true,writableReadStillResident:true,untrustedResidentGuardUnchanged:true};
 }finally{media.closeMedia(m);fs.rmSync(tmp,{recursive:true,force:true});}
}
module.exports={check};if(require.main===module)check().then(x=>console.log(JSON.stringify(x))).catch(e=>{console.error(e);process.exitCode=1;});
