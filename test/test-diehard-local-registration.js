'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const {APPS,LOCAL_CANDIDATE_APPS,DESKTOP_APPS}=require('../lib/apps');
const id='diehard_nakatomi_demo',app=APPS[id];
assert(app);assert(LOCAL_CANDIDATE_APPS.some(row=>row[0]===id));assert(!DESKTOP_APPS.some(row=>row[0]===id));
assert(app.exe.endsWith('/lithtech.exe'));assert.equal(app.args,'-rez engine.rez -rez nakatomi.rez');
assert.equal(app.workingDirectory,'c:\\program files\\fox\\die hard nakatomi plaza demo');
assert.equal(app.exeGuestPath,app.workingDirectory+'\\lithtech.exe');assert(app.requiredFiles);assert.equal(app.dlls.length,4);
const generator=path.join(__dirname,'../tools/gen-win98-games-a-d-manifests.js'),source=fs.readFileSync(generator,'utf8'),writes=[];
function generate(selected,corpusPresent=true){vm.runInNewContext(source,{require:name=>name==='fs'?{...fs,existsSync:p=>corpusPresent?fs.existsSync(p):false,writeFileSync:(file,bytes)=>writes.push({file,bytes})}:require(name),__dirname:path.dirname(generator),process:{argv:['node',generator,'--only='+selected]},console:{log(){}}},{filename:generator});}
assert.throws(()=>generate('',false),/nonempty game id/);assert.equal(writes.length,0);
// Unknown selection must fail even on machines with no private corpus.
assert.throws(()=>generate('not-a-game',false),/unknown --only/);assert.equal(writes.length,0);
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
assert(html.includes('<option value="diehard_nakatomi_demo">Die Hard: Nakatomi Plaza Demo</option>'));
// Membership, not position: other demos are added to the same list.
assert(/\['shooters', 'Shooters', \[[^\]]*'diehard_nakatomi_demo'/.test(
  fs.readFileSync(path.join(__dirname,'../ops/corpus-categories.js'),'utf8')));
const resolve=file=>path.resolve(__dirname,'..',file.startsWith('test/')?file:'test/'+file);
if(!fs.existsSync(resolve(app.exe))){
  console.log('PASS structural/local-only/selector-negative checks; SKIP real DieHard fixture closure (private payload absent)');
}else{
  for(const file of [app.exe,...app.dlls])assert(fs.statSync(resolve(file)).isFile(),file);
  generate(id);assert.equal(writes.length,1,'selector must not write unrelated manifests');
  const manifest=JSON.parse(writes[0].bytes);assert.equal(manifest.schemaVersion,1);
  assert(manifest.files.some(f=>f.url==='nakatomi.rez'));assert(manifest.files.some(f=>f.url==='engine.rez'));assert(!manifest.files.some(f=>f.url==='lithtech.exe'));
  const folder=path.dirname(writes[0].file);
  for(const file of manifest.files){assert.equal(file.vfsPath,app.workingDirectory+'\\'+file.url.replaceAll('/','\\'));assert.equal(file.size,fs.statSync(path.join(folder,file.url)).size);}
  console.log('PASS local-only registration, original dependency closure and selected manifest '+manifest.files.length+' assets');
}
