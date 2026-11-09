'use strict';
// Pre-release control: an in-memory declared-provider candidate, never pins.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict'),vm=require('node:vm'),Module=require('node:module');
const root=path.resolve(__dirname,'..'),current=require('./quake2-current-module.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=n=>fs.readFileSync(path.join(root,n));
const retained='scratch/runs/20261109-quake2-current-witness-guard-progress-1495/runtime-pins.json';
const before=read(retained);
assert.equal(hash(before),'c12b7a4488e5340eff268e83f5fef318d52c230d7c380b9d93b5c10e604018c6','retained runtime manifest integrity');
const candidate=JSON.parse(before).files.map(p=>({...p}));
const name='tools/quake2-owning-load-witness.cjs',bytes=read(name);
assert.equal(hash(bytes),hash(cp.execFileSync('git',['show','e65895936:'+name],{cwd:root})));
if(!candidate.some(p=>p.path===name))candidate.push({path:name,size:bytes.length,sha256:hash(bytes)});
const loaded=current.writerClosure(candidate);
assert(loaded.includes(name));
const refusals=[];
for(const n of loaded){
 assert.throws(()=>current.writerClosure(candidate.filter(p=>p.path!==n)),/undeclared Q2 writer dependency/);
 const damaged=candidate.map(p=>p.path===n?{...p,sha256:'0'.repeat(64)}:p);
 assert.throws(()=>current.writerClosure(damaged),/writer closure provider SHA/);
 refusals.push(n);
}
const exe=require('../lib/quake2-owning-load-core').EXE;
assert.throws(()=>current.writerClosure(candidate.filter(p=>p.path!==exe)),/undeclared Q2 writer file read/);
const composition=require('./quake2-native-driver-composition.cjs');
assert.throws(()=>composition.compose(),/tested Q2 custody provider required/);
assert.throws(()=>composition.compose({custodyVersion:'unknown'}),/unknown Q2 custody version/);
const generated=composition.compose({custodyVersion:'publishedf977ebf7c'});
new vm.Script(Module.wrap(generated.source));
assert(generated.source.includes("writerWitnessSetup:process.env.QUAKE2_NATIVE_WRITER_WITNESS==='1'"));
assert(generated.source.includes('startup'));
assert.deepEqual(read(retained),before);
console.log(JSON.stringify({pass:true,loaded,missingAndDamagedRefusals:refusals,undeclaredEXERefused:true,generatedSHA:hash(generated.source),memoryOnly:true,pinsetWritten:false,nativeQualification:false}));
