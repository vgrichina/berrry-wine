'use strict';
// Real versioned preparation; corruption is read substitution, never a shared
// source/module edit. No browser, guest, box or native retry is involved.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const cp=require('node:child_process'),Module=require('node:module'),zlib=require('node:zlib'),crypto=require('node:crypto');
const current=require('./q3-current-module.cjs'),root=path.resolve(__dirname,'..');
const out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const historical=fs.readFileSync(path.join(root,current.historical));
let count=0;
function refuses(label,invoke,pattern){const dest=path.join(out,label);assert(!fs.existsSync(dest));assert.throws(()=>invoke(dest),pattern);assert(!fs.existsSync(dest),'refuse before destination creation');count++;}
refuses('old-1395',dest=>require('./redline-current-module.cjs').prepare(dest),/published build source/);
const name=path.join(__dirname,'q3-native-driver-composition.cjs'),old=new Module(name,module);old.filename=name;old.paths=module.paths;
old._compile(cp.execFileSync('git',['show','bae02f6a1:tools/q3-native-driver-composition.cjs'],{cwd:root,encoding:'utf8'}),name);
assert.throws(()=>old.exports.compose(),/Q3 provider changed: tools\/q3-startup.cjs|Q3 provider changed: tools\/native_kernel_custody.py/);
function tamper(label,name,bytes,pattern){
  const read=fs.readFileSync,target=path.join(root,name);
  fs.readFileSync=function(file,...args){if(path.resolve(String(file))===target)return args[0]==='utf8'?bytes.toString():bytes;return read.call(this,file,...args);};
  try{refuses(label,dest=>current.prepare(dest),pattern);}finally{fs.readFileSync=read;}
}
tamper('historical-tamper',current.historical,Buffer.concat([historical,Buffer.from(' ')]),/historical pinset integrity/);
tamper('old-source-new-module','src/03-registers.wat',cp.execFileSync('git',['show','5c8780318^:src/03-registers.wat'],{cwd:root}),/published build source/);
tamper('unexpected-source','src/05-alu.wat',Buffer.from('changed'),/published build source/);
for(const name of ['build/wine-assembly.wasm','build/wine-assembly.compat.wasm']){
  const bytes=Buffer.from(fs.readFileSync(path.join(root,name)));bytes[bytes.length-1]^=1;
  tamper('tampered-'+path.basename(name),name,bytes,/provider SHA/);
}
for(const name of ['host.js','tools/native_kernel_custody.py','tools/q3-startup.cjs','tools/q3-native-driver-composition.cjs','lib/browser-input.js']){
  tamper('provider-'+path.basename(name),name,Buffer.concat([fs.readFileSync(path.join(root,name)),Buffer.from('\n')]),/provider size|Q3 migration provider/);
}
refuses('unknown-option',dest=>current.prepare(dest,{skipValidation:true}),/explicit supported/);
refuses('foreign-input',dest=>current.prepare(dest,{inputs:['tools/q3-native-prelaunch.py']}),/owned Python/);
const dest=path.join(out,'new'),seal=current.prepare(dest),raw=zlib.gunzipSync(fs.readFileSync(dest+'/runtime-pins.json.gz')),pins=JSON.parse(raw);
assert.equal(seal.manifestSHA256,hash(raw));assert.equal(seal.moduleVersion,current.moduleVersion);
assert.equal(pins.explainedDrift.length,14);assert.equal(fs.statSync(dest+'/runtime-pins.json.gz').mode&0o222,0);
assert.deepEqual(fs.readFileSync(path.join(root,current.historical)),historical);
assert(!pins.files.some(p=>p.path.startsWith(path.dirname(current.historical)+'/')),'retired runtime omitted');
for(const p of pins.files){const bytes=fs.readFileSync(path.join(root,p.path));assert.equal(bytes.length,p.size);assert.equal(hash(bytes),p.sha256);}
for(const p of pins.httpPins){const f=pins.files.find(f=>f.path===p.url.slice(1));assert.equal(p.sha256,f.sha256);assert.equal(p.size,f.size);}
assert.equal(pins.files.length,new Set(pins.files.map(p=>p.path)).size);
assert.throws(()=>current.prepare(dest),/fresh task-owned/);
const source=require('./q3-startup.cjs').admissionSource();
const shared=fs.readFileSync(path.join(root,'lib/redline-startup-admission.js'),'utf8');
assert(shared.includes('a320d4c85156644f'));assert(source.includes(current.SELECTED.sha256));
const composed=require('./q3-native-driver-composition.cjs').compose(),oldProviders=old.exports.providers;
for(const [file,sha] of Object.entries(oldProviders))if(!['tools/q3-startup.cjs','tools/native_kernel_custody.py'].includes(file))assert.equal(require('./q3-native-driver-composition.cjs').providers[file],sha);
// Migrating validation pins does not alter generated transport/control source.
const read=fs.readFileSync;
fs.readFileSync=function(file,...args){
  const relative=path.relative(root,String(file));
  if(['tools/q3-startup.cjs','tools/native_kernel_custody.py'].includes(relative))return cp.execFileSync('git',['show','bae02f6a1:'+relative],{cwd:root,encoding:args[0]==='utf8'?'utf8':undefined});
  return read.call(this,file,...args);
};
try{const prior=old.exports.compose();assert.equal(prior.source,composed.source);assert.equal(prior.controlsSource,composed.controlsSource);}finally{fs.readFileSync=read;}
console.log(JSON.stringify({passed:true,oldPreparerFAIL:true,oldCompositionFAIL:true,newPASS:true,negativeControls:count,providers:pins.files.length,explainedDrift:pins.explainedDrift.length,historicalUnchanged:true,generatedControlByteIdentical:true}));
