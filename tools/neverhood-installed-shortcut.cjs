'use strict';
// Recover only authenticated normal-installer output, then use the public
// shortcut parser and kept-media entry builder. Never apply WININIT here.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const PRIOR='scratch/runs/20261117-neverhood-visible-startup-normal-install-room';
function resolve(bodies,records,linkPath){
 const link=require('../lib/shell-link').parseShellLink(bodies.get(linkPath));
 assert(link&&link.target,'unresolved authentic shortcut');
 const S=require('../lib/installed-shortcuts');
 const record=S.persistableShortcut({target:link.target,cwd:link.workingDir,args:link.args,label:link.description});
 assert(record);const restored=S.restorable([record],records,'D:');assert.equal(restored.keep.length,1);
 const entry=S.entryFor({id:'authentic-neverhood-installed',name:'neverhood-original.iso'},record,async()=>({root:'D:\\'}));
 assert(bodies.has(entry.exe),'shortcut target absent');
 return {link,record,exe:entry.exe,cwd:entry.workingDirectory,args:entry.args||'',targetSHA256:sha(bodies.get(entry.exe))};
}
function restore(out){
 const catalog=JSON.parse(fs.readFileSync(PRIOR+'/artifact-hashes.json'));
 const pins=new Map(catalog.files.map(r=>[r.path,r]));
 function checked(n){const b=fs.readFileSync(PRIOR+'/'+n),p=pins.get(n);assert(p,n);assert.equal(b.length,p.size,n);assert.equal(sha(b),p.sha256,n);return b;}
 const provenance=JSON.parse(checked('second/installed-provenance.json'));
 const recovery=JSON.parse(checked('second/overlay-media-references.json'));
 const indexBytes=checked('second/original/guest-overlay/index.json'),index=JSON.parse(indexBytes);
 const regBytes=checked('second/original/guest-registry.json');
 assert.equal(sha(indexBytes),provenance.indexSHA256);assert.equal(sha(regBytes),provenance.registrySHA256);
 const media=require('./neverhood-original-current-preflight.cjs').verify();
 assert.deepEqual(media,JSON.parse(checked('second/postclose-media.json')));
 const I=require('../lib/iso9660'),iso=I.parseIso(fs.readFileSync(media.inputs.iso.path));
 const refs=new Map(recovery.references.map(r=>[r.path,r])),expected=new Map(provenance.files.map(r=>[r.path,r]));
 const bodies=new Map(),rows=[];
 fs.mkdirSync(out+'/guest-overlay/blobs',{recursive:true});
 for(const r of index.records){
  if(r.kind!=='file')continue;
  assert(/^[a-z0-9-]+\.bin$/i.test(r.blob));const p=expected.get(r.path),ref=refs.get(r.path);assert(p);
  let b;
  if(ref){assert.equal(ref.isoSHA256,media.inputs.iso.sha256);assert.equal(ref.isoPath,media.inputs.iso.path);b=Buffer.from(I.readEntry(iso,I.findEntry(iso,ref.member)));assert.equal(sha(b),ref.sha256);}
  else b=checked('second/original/'+p.artifact);
  assert.equal(b.length,r.size);assert.equal(sha(b),p.sha256);
  const output=out+'/guest-overlay/blobs/'+r.blob;
  fs.writeFileSync(output,b,{flag:'wx'});assert.equal(sha(fs.readFileSync(output)),p.sha256);
  bodies.set(r.path,b);rows.push({...p,source:ref?{iso:ref.isoPath,member:ref.member}:p.artifact});
 }
 assert.equal(index.records.length,65);assert.equal(rows.length,58);assert.equal(refs.size,51);
 fs.writeFileSync(out+'/guest-overlay/index.json',indexBytes,{flag:'wx'});
 fs.writeFileSync(out+'/installed-registry.json',regBytes,{flag:'wx'});
 const shortcut=resolve(bodies,index.records,provenance.shortcut.path);
 assert.equal(shortcut.exe,provenance.shortcut.target.toLowerCase());
 assert.equal(shortcut.targetSHA256,provenance.shortcut.targetSHA256);
 const exePath=out+'/installed-launcher.exe';fs.writeFileSync(exePath,bodies.get(shortcut.exe),{flag:'wx'});
 const report={verified:true,prior:PRIOR,indexSHA256:sha(indexBytes),registrySHA256:sha(regBytes),files:rows,
  shortcut,exePath,registryPath:out+'/installed-registry.json',overlayPath:out+'/guest-overlay',
  pendingRenamesUnchanged:true,provenanceSHA256:sha(checked('second/installed-provenance.json')),
  resolver:'ShellLink.parseShellLink -> InstalledShortcuts.persistableShortcut/restorable/entryFor',media};
 fs.writeFileSync(out+'/installed-state.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});return report;
}
module.exports={resolve,restore};
if(require.main===module)console.log(JSON.stringify(restore(path.resolve(process.argv[2])),null,2));
