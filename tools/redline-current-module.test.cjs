'use strict';
// Exercise the real preparer. Read substitutions model corruption without
// modifying shared providers, modules or historical evidence on disk.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const crypto=require('node:crypto'),cp=require('node:child_process');
const current=require('./redline-current-module.cjs'),boundary=require('./redline-startup-boundary.cjs');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]);
fs.mkdirSync(out,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const historical=fs.readFileSync(path.join(root,current.historical));
function publishedModule(commit,name){
  const Module=require('node:module'),filename=path.join(__dirname,name),m=new Module(filename,module);
  m.filename=filename;m.paths=module.paths;m._compile(cp.execFileSync('git',['show',commit+':tools/'+name],{cwd:root,encoding:'utf8'}),filename);return m.exports;
}
const oldTrace=publishedModule('14475fc9f','redline-native-trace.cjs'),oldBoundary=publishedModule('14475fc9f','redline-startup-boundary.cjs');
assert.equal(require('./redline-native-trace.cjs').integrate(),oldTrace.integrate(),'runtime caller byte-identical');
assert.equal(boundary.integrate(),oldBoundary.integrate(),'startup diagnostic caller byte-identical');
assert.equal(boundary.fixtureSource(),oldBoundary.fixtureSource(),'single comma fixture byte-identical');
function refuse(label,invoke,pattern){const dest=path.join(out,label);assert(!fs.existsSync(dest));assert.throws(()=>invoke(dest),pattern);assert(!fs.existsSync(dest),'refusal before destination creation');}
refuse('old',dest=>boundary.prepare(dest),/build\/wine-assembly.compat.wasm/);
function tamper(label,name,bytes,pattern){
  const read=fs.readFileSync,target=path.join(root,name);
  fs.readFileSync=function(file,...args){if(path.resolve(String(file))===target){return args[0]==='utf8'?bytes.toString():bytes;}return read.call(this,file,...args);};
  try{refuse(label,dest=>current.prepare(dest),pattern);}finally{fs.readFileSync=read;}
}
tamper('historical-tamper',current.historical,Buffer.concat([historical,Buffer.from(' ')]),/historical pinset integrity/);
const source='src/05b-string-ops.wat';
tamper('source-module-mismatch',source,cp.execFileSync('git',['show','1f3bd16c1^:'+source],{cwd:root}),/published build source/);
const moduleName='build/wine-assembly.wasm',moduleBytes=fs.readFileSync(path.join(root,moduleName));moduleBytes[moduleBytes.length-1]^=1;
tamper('module-source-mismatch',moduleName,moduleBytes,/provider SHA/);
const provider='host.js',providerBytes=Buffer.concat([fs.readFileSync(path.join(root,provider)),Buffer.from('\n')]);
tamper('unexplained-provider',provider,providerBytes,/provider size/);
tamper('unexplained-source','src/05-alu.wat',Buffer.from('unexplained'),/published build source/);
const dest=path.join(out,'new'),plan=current.prepare(dest),pins=JSON.parse(fs.readFileSync(dest+'/runtime-pins.json'));
assert.equal(plan.moduleVersion,current.moduleVersion);assert.equal(pins.explainedDrift.length,3);
assert.equal(sha(fs.readFileSync(dest+'/runtime-pins.json')),plan.manifestSHA256);
assert.equal(fs.statSync(dest+'/runtime-pins.json').mode&0o222,0);
assert.deepEqual(fs.readFileSync(path.join(root,current.historical)),historical);
assert.equal(plan.traceDurationSeconds,10);assert.deepEqual(plan.commands,[{key:',',holdMs:600,waitMs:0},'ordinary joined quit']);
for(const p of pins.files){const b=fs.readFileSync(path.join(root,p.path));assert.equal(b.length,p.size);assert.equal(sha(b),p.sha256);}
for(const p of pins.httpPins){const f=pins.files.find(f=>f.path===p.url.slice(1));assert.equal(p.sha256,f.sha256);assert.equal(p.size,f.size);}
assert.equal(new Set(pins.files.map(p=>p.path)).size,pins.files.length);
refuse('bad-option',dest=>require('./redline-native-trace.cjs').prepare(dest,{skipValidation:true}),/explicit supported/);
assert.throws(()=>current.prepare(dest),/fresh task-owned/);
console.log(JSON.stringify({passed:true,oldRefusal:true,newPrepared:true,negativeControls:7,providers:pins.files.length,historicalUnchanged:true,moduleVersion:plan.moduleVersion}));
