'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const PINS=Object.freeze({
 iso:['scratch/media/neverhood-original.iso',651438080,'94de724bb47eb2aa588ac4eff28ddc6fd10edebcf2be4dd131ef76875ef5ffd3'],
 pe:['test/binaries/dlls/comctl32.dll',577808,'28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4'],
 ne:['test/binaries/sims-native-common-controls/kommctrl.dll',155136,'39bbfafa8b759ebfcf6a00ee878fa494581a9144891bbd788bded61441de13f9'],
 setupx:['scratch/runs/20261116-neverhood-original-install-after-setupx/inputs/setupx.dll',745168,'6cd5c194743fdf676112c0808b724a78f8f8650a54059d046a15fe270f5f55f4']
});
function verify(){
 const rows={};for(const [name,[path,size,digest]] of Object.entries(PINS)){
  const b=fs.readFileSync(path);assert.equal(b.length,size,path);assert.equal(sha(b),digest,path);
  rows[name]={path,size,sha256:digest};
 }
 const lib=require('../lib/iso9660'),image=fs.readFileSync(PINS.iso[0]),iso=lib.parseIso(image);
 const files=iso.files.filter(f=>!f.isDirectory);assert.equal(files.length,257);
 const members=[['SETUP95.EXE',202240,'ceae7885f49569fdc1100870286634c36d05eabe6010c228efef214c9444a95e'],
 ['setup/DSETUP6E.DLL',45104,'a3feb8e3a947d8c6b6c594b80b5c0db0c5bd26968f3d749c27781cb60d6c7d7d']];
 for(const [name,size,digest]of members){const entry=lib.findEntry(iso,name);assert(entry,name);const b=lib.readEntry(iso,entry);assert.equal(b.length,size);assert.equal(sha(b),digest);}
 return {inputs:rows,files:files.map(f=>({path:f.path,size:f.length,sha256:sha(lib.readEntry(iso,f))})),members,completeCD:true};
}
// Verify the actual prior install without hydrating, repairing or replaying it.
// Deleted byte-identical CD blobs are recovered in memory from the pinned ISO.
function verifyInstalled(prior='scratch/runs/20261117-neverhood-win16-registry-install'){
 const path=require('node:path'),media=verify(),catalog=JSON.parse(fs.readFileSync(path.join(prior,'artifact-hashes.json')));
 const pins=new Map(catalog.files.map(r=>[r.path,r]));
 const checked=name=>{
  const b=fs.readFileSync(path.join(prior,name)),p=pins.get(name);
  assert(p,'missing original artifact hash: '+name);assert.equal(b.length,p.size,name);assert.equal(sha(b),p.sha256,name);
  return b;
 };
 const installed=JSON.parse(checked('installed-files.json'));
 assert.deepEqual(media,JSON.parse(checked('fresh-media-preflight.json')),'original complete CD and DLL inventory differs');
 const recovery=JSON.parse(checked('overlay-media-references.json'));
 const index=JSON.parse(checked('original/guest-overlay/index.json'));
 const registryBytes=checked('original/guest-registry.json'),registry=JSON.parse(registryBytes);
 assert.equal(index.version,1);assert.equal(index.records.length,installed.overlayRecords);
 const isoLib=require('../lib/iso9660'),iso=isoLib.parseIso(fs.readFileSync(PINS.iso[0]));
 const refs=new Map(recovery.references.map(r=>[r.artifact,r]));
 const rows=[],bodies=new Map();
 for(const record of index.records){
  if(record.kind!=='file')continue;
  assert(/^[a-zA-Z0-9-]+\.bin$/.test(record.blob));
  const name='original/guest-overlay/blobs/'+record.blob,ref=refs.get(name);let b,source;
  if(ref){
   assert.equal(ref.isoPath,PINS.iso[0]);assert.equal(ref.isoSHA256,PINS.iso[2]);
   const entry=isoLib.findEntry(iso,ref.member);assert(entry,ref.member);b=Buffer.from(isoLib.readEntry(iso,entry));
   assert.equal(b.length,ref.size);assert.equal(sha(b),ref.sha256);source={iso:ref.isoPath,member:ref.member};
   if(fs.existsSync(path.join(prior,name)))assert.deepEqual(checked(name),b);
  }else{b=checked(name);assert(recovery.uniqueOutputBlobsRetained.includes(name));source={originalArtifact:name};}
  assert.equal(b.length,record.size,record.path);
  // The final catalog was written after CD deduplication. Its pinned recovery
  // recipe, rather than an absent deleted-blob entry, authenticates that case.
  const original=pins.get(name)||ref;assert(original,name);assert.equal(sha(b),original.sha256,name);assert.equal(b.length,original.size,name);
  rows.push({path:record.path,blob:record.blob,size:b.length,sha256:sha(b),source});bodies.set(record.path,b);
 }
 assert.equal(refs.size,51);assert.equal(rows.length,58);assert.equal(recovery.uniqueOutputBlobsRetained.length,7);
 for(const r of installed.neverhoodRecords){
  const match=index.records.find(x=>x.path===r.path);assert(match,r.path);
  for(const [k,v]of Object.entries(match))assert.deepEqual(r[k],v,r.path+': '+k);
  if(r.kind==='file')assert.equal(sha(bodies.get(r.path)),r.sha256,r.path);
 }
 const linkPath='c:\\windows\\start menu\\programs\\dreamworks\\the neverhood.lnk';
 const link=require('../lib/shell-link').parseShellLink(bodies.get(linkPath));assert(link&&link.target);
 const target=link.target.toLowerCase(),targetBytes=bodies.get(target);assert(targetBytes,'shortcut target not installed');
 const cwd=link.workingDir||target.replace(/\\[^\\]*$/,'')+'\\';
 const installKey='reg:HKLM\\SOFTWARE\\DreamWorks Interactive\\Neverhood';
 const installedKey=JSON.parse(registry[installKey]);assert.equal(installedKey.values.Installed.data,1);
 const equivalentKeys=Object.keys(registry).filter(k=>k.replace(/\\+$/,'').toLowerCase()===installKey.toLowerCase());
 const values=equivalentKeys.flatMap(k=>Object.keys(JSON.parse(registry[k]).values));
 const missing=['Data Drive','Installed Directory','Run File'].filter(n=>!values.some(v=>v.toLowerCase()===n.toLowerCase()));
 const nativeLog=checked('original/native.stdout.log').toString();
 const publicWrites=nativeLog.split('\n').flatMap((line,i)=>
  line.startsWith('[reg] set ')&&['Data Drive','Installed Directory','Run File'].some(n=>line.includes('\\'+n+' ('))
   ?[{line:i+1,text:line}]:[]);
 const pending=JSON.parse(registry['ini:c:/windows/wininit.ini']).sections.rename;
 return {verified:true,prior,originalArtifactCatalogSHA256:sha(fs.readFileSync(path.join(prior,'artifact-hashes.json'))),
  indexSHA256:sha(checked('original/guest-overlay/index.json')),registrySHA256:sha(registryBytes),
  overlayRecords:index.records.length,verifiedBlobs:rows.length,cdRecoverableBlobs:refs.size,uniqueGeneratedBlobs:7,blobs:rows,
  shortcut:{path:linkPath,sha256:sha(bodies.get(linkPath)),...link,effectiveWorkingDirectory:cwd,
   workingDirectorySource:link.workingDir?'shortcut':'published browser-shell.js target-directory fallback',targetSHA256:sha(targetBytes)},
  installedExecutable:rows.find(r=>r.path.endsWith('\\nhc.exe')),installedRegistry:{key:installKey,...installedKey},
  registryCompleteness:{equivalentKeys,missingPersistedValues:missing,originalPublicWriteObservations:publicWrites,
   originalPublicLogSHA256:sha(Buffer.from(nativeLog)),authenticInstalledLaunchReady:missing.length===0,
   boundary:missing.length?'Authentic persisted installation path values are absent; do not synthesize keys from logs or fallback paths.':null,
   lossCause:'UNKNOWN; this check observes the final export and original public API log only',disabledPlayCause:'UNKNOWN'},
  pendingRenameCount:Object.keys(pending).length,pendingRenames:pending,completeCD:media,
  originalReopened:false,originalLaunched:false,inputsModified:false,recoveredMediaWritten:false};
}
module.exports={verify,verifyInstalled,PINS};
if(require.main===module)console.log(JSON.stringify(process.argv.includes('--installed')?verifyInstalled():verify(),null,2));
