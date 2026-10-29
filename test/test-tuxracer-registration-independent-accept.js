'use strict';
// Offline production-boundary acceptance. Never executes guest or Tcl code.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const pins={
 'test/run.js':'f96e9bb924700ee571e2904e097f80742ff55638399898ae1dc32454af05b02d',
 'lib/app-files.js':'4c1ce40b92aa990a4bc689bd98d5c0d92ab3af44dafeb93ca52ccbaf2c6124f7',
 'lib/apps.js':'ccd6feeb360ed289f5b6dce729e988e10157722fc11d43fc3363bdfc6e0c8f6a'};
for(const [f,h] of Object.entries(pins))assert.equal(sha(fs.readFileSync(path.join(root,f))),h,f);
const runner=fs.readFileSync(path.join(root,'test/run.js'),'utf8');
const a=runner.indexOf('const getAssetFiles = entry => {'),z=runner.indexOf('const WASM_PATH =',a);
assert(a>=0&&z>a);const slice=runner.slice(a,z);
const entry=require('../lib/apps').APPS.tuxracer_original_061a;
function boundary(code=slice){return vm.runInNewContext(code+'\ngetAssetFiles',{
 fs,path,require,APP_ID:'tuxracer_original_061a',ASSET_ENTRY_ID:'tuxracer_original_061a',appAsset:p=>path.join(root,p)});}
const load=boundary(),manifestPath=path.join(root,entry.localFileManifest),dir=path.dirname(manifestPath);
let successes=0;const results=[];
function consumer(loader=load){const files=loader(entry);successes++;return files;}
function reject(label,change,restore,loader=load){
 const before=successes;let error;
 try{change();try{consumer(loader);}catch(e){error=e;}assert(error,label+': usable registration escaped');assert.equal(successes,before);results.push({label,error:String(error.message)});}
 finally{restore();}
}
if(process.argv.includes('--first-boundary')){
 assert(!fs.existsSync(manifestPath));reject('missing manifest before registration',()=>{},()=>{});
 fs.writeFileSync(path.join(root,'evidence/first-boundary.json'),JSON.stringify({sliceSha256:sha(slice),pins,results,successes}));
 console.log('production boundary rejected absent manifest before registration');process.exit(0);
}
const rows=JSON.parse(fs.readFileSync(path.join(root,entry.localManifestIntegrity.inventory))).files;
assert.equal(rows.length,158);assert.equal(rows.reduce((n,r)=>n+r.bytes,0),13225945);
assert.equal(entry.exeGuestPath,'C:\\tuxracer-win32-0.61a\\tuxracer.exe');
assert.equal(entry.workingDirectory,'C:\\tuxracer-win32-0.61a');
assert.equal(entry.localOnly,true);assert.equal(entry.requiredFiles,true);
function positive(){
 const files=consumer();assert.equal(files.length,157);assert.equal(files.verifiedMedia.byUrl.size,158);
 const vfs=new Map(files.map(f=>[f.vfsPath,f]));
 for(const r of rows){const exe=/\.exe$/i.test(r.path);const f=exe?null:vfs.get('c:\\'+r.path.replace(/\//g,'\\'));
  const b=exe?files.verifiedMedia.exeBytes:f.bytes;assert.equal(b.length,r.bytes);assert.equal(sha(b),r.sha256);
  if(f){assert.equal(f.loadMode,'required');assert.equal(f.size,r.bytes);}
 }
 assert.equal(entry.dlls.length,3);assert.deepEqual(entry.dlls.map(p=>path.basename(p)).sort(),['SDL.dll','SDL_mixer.dll','TCL83.DLL'].sort());
 for(const dll of entry.dlls)assert(files.verifiedMedia.byUrl.has(dll));
 return files;
}
positive();
// Independent physical inventory, including exact staged bytes, executable and manifest.
function walk(p){return fs.readdirSync(p,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(path.join(p,d.name)):[path.relative(dir,path.join(p,d.name)).replace(/\\/g,'/')]);}
assert.deepEqual(walk(dir).sort(),['.wine-assembly-browser.json',...rows.map(r=>'game/'+r.path)].sort());
for(const rel of ['tuxracer.exe','TCL83.DLL','SDL.dll','SDL_mixer.dll','tuxracer_init.tcl','courses/course_idx.tcl','textures/checkmark.rgb']){
 const f=path.join(dir,'game/tuxracer-win32-0.61a',rel),saved=fs.readFileSync(f);
 reject('missing '+rel,()=>fs.renameSync(f,f+'.held'),()=>fs.renameSync(f+'.held',f));
 reject('same-size wrong hash '+rel,()=>{const b=Buffer.from(saved);b[0]^=1;fs.writeFileSync(f,b);},()=>fs.writeFileSync(f,saved));
 reject('wrong size '+rel,()=>fs.writeFileSync(f,saved.subarray(1)),()=>fs.writeFileSync(f,saved));
}
const mb=fs.readFileSync(manifestPath);
for(const [label,mutate] of [
 ['URL escape',m=>m.files[0].url='../outside'],['absolute URL',m=>m.files[0].url='/tmp/outside'],
 ['guest escape',m=>m.files[0].vfsPath='c:\\..\\escape'],['missing mapping',m=>m.files.pop()],
 ['duplicate mapping',m=>m.files[1]={...m.files[0]}],['untrusted extra key',m=>m.files[0].bytes=[1]],
 ['wrong manifest size',m=>m.files[0].size++],['schema',m=>m.schemaVersion=2]]){
 reject(label,()=>{const m=JSON.parse(mb);mutate(m);fs.writeFileSync(manifestPath,JSON.stringify(m));},()=>fs.writeFileSync(manifestPath,mb));
}
reject('invalid manifest JSON',()=>fs.writeFileSync(manifestPath,'{'),()=>fs.writeFileSync(manifestPath,mb));
const ip=path.join(root,entry.localManifestIntegrity.inventory),ib=fs.readFileSync(ip);
reject('inventory digest tamper',()=>fs.writeFileSync(ip,Buffer.concat([ib,Buffer.from(' ')])),()=>fs.writeFileSync(ip,ib));
reject('missing inventory',()=>fs.renameSync(ip,ip+'.held'),()=>fs.renameSync(ip+'.held',ip));
// Mutation test: remove only eager integrity dispatch in a disposable source string.
// The same new rejection oracle MUST detect that required corrupt bytes escape.
const mutant=slice.replace('if (entry.localManifestIntegrity) {','if (false) {');assert.notEqual(mutant,slice);
const f=path.join(dir,'game/tuxracer-win32-0.61a/tuxracer_init.tcl'),saved=fs.readFileSync(f);
let detected=false;
try{reject('MUTANT eager-validation bypass',()=>{const b=Buffer.from(saved);b[0]^=1;fs.writeFileSync(f,b);},()=>fs.writeFileSync(f,saved),boundary(mutant));}
catch(e){assert.match(e.message,/usable registration escaped/);detected=true;}
assert(detected);positive();
// Eager validated buffers survive later owned-disk mutation unchanged.
const pinned=positive(),url=path.relative(root,f),original=pinned.verifiedMedia.byUrl.get(url);
try{fs.writeFileSync(f,Buffer.from('changed after validation'));assert.equal(sha(pinned.verifiedMedia.byUrl.get(url)),sha(saved));}
finally{fs.writeFileSync(f,saved);}
positive();
const result={candidate:'4bbc6434443094239579ec07ec91a84e3a0958b9',pins,sliceSha256:sha(slice),sliceBytes:Buffer.byteLength(slice),results,mutationBypassDetected:detected,assetCount:158,stagedPayloadBytes:13225945,stagedInventoryExact:true,originalMediaWrites:0,computedTclClosure:'UNKNOWN',fullMediaStaticClosure:'UNKNOWN',runtime:'NOT RUN'};
fs.writeFileSync(path.join(root,'evidence/independent-boundary.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({rejections:results.length,assets:158,mutationBypassDetected:detected,passed:true}));
