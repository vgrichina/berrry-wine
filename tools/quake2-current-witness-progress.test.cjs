'use strict';
// Validate the actual versioned current preparer. Corruption is in-memory;
// no provider, module or retained evidence is altered.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process'),crypto=require('node:crypto');
const current=require('./quake2-current-module.cjs'),root=path.resolve(__dirname,'..');
const read=fs.readFileSync,hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const opts={moduleVersion:current.version},results=[];
assert.throws(()=>current.validate(),/explicit supported Q2 module version/);
assert.throws(()=>current.validate({moduleVersion:'unknown'}),/explicit supported Q2 module version/);
const old=cp.spawnSync('python3',['-B','tools/native-startup-barrier.py','publish',root,path.join(root,current.historical),'/dev/null'],{cwd:root,encoding:'utf8'});
assert.notEqual(old.status,0);assert.match(old.stderr,/startup provider mismatch: build\/wine-assembly.compat.wasm/);
results.push({name:'actual old startup fingerprint',result:'REFUSED current source drift'});
const baseline=read(path.join(root,current.historical));
const positive=current.validate(opts);
assert.equal(positive.nativeQualification,false);assert.equal(positive.version,current.version);
assert(positive.writerDependencies.includes('tools/quake2-owning-load-witness.cjs'));
// Reproduce the actual native packaging failure without a directory copy,
// browser, Worker, guest execution or access to undeclared checkout modules.
const failedPins=positive.files.filter(p=>p.path!=='tools/quake2-owning-load-witness.cjs');
assert.throws(()=>current.writerClosure(failedPins),/undeclared Q2 writer dependency: tools\/quake2-owning-load-witness.cjs/);
assert(current.writerClosure(positive.files).includes('tools/quake2-owning-load-witness.cjs'));
const cwd=process.cwd();
try{process.chdir(path.dirname(root));assert(current.writerClosure(positive.files).includes('tools/quake2-owning-load-witness.cjs'));}finally{process.chdir(cwd);}
assert.throws(()=>current.writerClosure(positive.files.filter(p=>p.path!==require('../lib/quake2-owning-load-core').EXE)),/undeclared Q2 writer file read/);
results.push({name:'actual native missing transitive import',old:'REFUSED',new:'PASS',scope:'in-memory declared-provider loader; setup source compiled, never evaluated'});
assert.equal(new Set(positive.files.map(p=>p.path)).size,positive.files.length);
for(const p of positive.files){const b=read(path.join(root,p.path));assert.equal(p.sha256,hash(b));assert.equal(p.size,b.length);}
for(const p of positive.httpPins){const f=positive.files.find(v=>v.path===p.url.slice(1));assert(f);assert.equal(p.sha256,f.sha256);assert.equal(p.size,f.size);}
assert.equal(hash(read(path.join(root,current.historical))),hash(baseline));
results.push({name:'explicit current published sources/modules/caller',result:'PASS',providers:positive.files.length,changes:positive.changes.map(c=>c.after.path)});
function reject(name,file,bytes,pattern){
 fs.readFileSync=function(p,...args){if(path.resolve(String(p))===path.join(root,file))return args[0]==='utf8'?bytes.toString():bytes;return read.call(this,p,...args);};
 try{assert.throws(()=>current.validate(opts),pattern);results.push({name,result:'REFUSED'});}finally{fs.readFileSync=read;}
}
reject('damaged historical manifest',current.historical,Buffer.concat([baseline,Buffer.from(' ')]),/historical Q2 pinset integrity/);
reject('unexplained WAT source','src/05-alu.wat',Buffer.from('unexplained'),/published Q2 build source/);
const cpu=read(path.join(root,'build/wine-assembly.wasm'));cpu[cpu.length-1]^=1;
reject('module hash mismatch','build/wine-assembly.wasm',cpu,/published Q2 module SHA/);
const compat=read(path.join(root,'build/wine-assembly.compat.wasm'));compat[compat.length-1]^=1;
reject('compat module hash mismatch','build/wine-assembly.compat.wasm',compat,/published Q2 module SHA/);
reject('unpublished owning host drift','host.js',Buffer.concat([read(path.join(root,'host.js')),Buffer.from('\n')]),/published Q2 provider size/);
reject('unknown custody drift','tools/native_kernel_custody.py',Buffer.concat([read(path.join(root,'tools/native_kernel_custody.py')),Buffer.from('\n')]),/published Q2 provider size/);
reject('unknown retained provider drift','tools/native-browser-close.cjs',Buffer.concat([read(path.join(root,'tools/native-browser-close.cjs')),Buffer.from('\n')]),/unexplained Q2 provider size/);
reject('new witness provider drift','tools/quake2-native-witness-install.cjs',Buffer.from('unexplained'),/new published Q2 provider/);
reject('owning load transitive dependency drift','tools/quake2-owning-load-witness.cjs',Buffer.from('unexplained'),/new published Q2 provider/);
assert.deepEqual(read(path.join(root,current.historical)),baseline);
console.log(JSON.stringify({passed:true,version:current.version,results,noNativeRun:true}));

