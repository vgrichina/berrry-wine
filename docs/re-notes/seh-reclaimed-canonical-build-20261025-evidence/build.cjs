'use strict';
// Focused current-Git driver. No compiler/source edits, diagnostics modes,
// names, shake, native constructor, memory or instance. Accepted canonical
// compileClosure, compat source transform and custom-section stamp in place.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),cp=require('child_process');
const O=__dirname,R=path.join(O,'../repo'),S='/home/user/wine-assembly-shadow-man-span-static-canonical-oct23';
const m=JSON.parse(fs.readFileSync(path.join(O,'closure.json'))),expected=JSON.parse(fs.readFileSync(path.join(O,'expected-abi-layout.json')));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const save=(n,d)=>fs.writeFileSync(path.join(O,n),JSON.stringify(d,null,2)+'\n');
// Validate every admitted compiler/full source dependency before loading code.
const bytes=new Map();
for(const row of m.files){
 const b=row.standingMatchesCurrent ? fs.readFileSync(row.standingPath) : cp.execFileSync('git',['-C',R,'show',m.candidate+':'+row.path],{maxBuffer:24*1024*1024});
 assert.equal(b.length,row.bytes,row.path);assert.equal(sha(b),row.sha256,row.path);bytes.set(row.path,b);
}
const {sourceTextFromBytes}=require(path.join(S,'tools/watx.js'));
const {compileClosure}=require(path.join(S,'tools/watx-closure.js'));
const {applyToVfs}=require(path.join(S,'lib/dispatch-trampoline.js'));
const {layoutHash,layoutLines,appendSection}=require(path.join(S,'tools/region-layout-hash.js'));
const vfs=new Map();
for(const p of m.reached){const f=p.slice(4),text=sourceTextFromBytes(bytes.get(p));for(const key of [f,'src/'+f,'./'+f])vfs.set(key,text);}
const closure={source:sourceTextFromBytes(bytes.get('src/main.watx')),vfs,entry:'src/main.watx'};
const compatClosure={...closure,vfs:applyToVfs(new Map(vfs))};
const outputs=[];let stamp=null;
for(const [file,tailCalls,c] of [['wine-assembly.wasm',true,closure],['wine-assembly.compat.wasm',false,compatClosure]]){
 const start=Date.now(),r=compileClosure(c,{tailCalls,regionShake:null});
 if(!r||!r.success||!r.wasmBinary){save('compiler-first-failure.json',{file,tailCalls,error:r&&(r.error||r.message),sourceFile:r&&r.file,line:r&&r.line,col:r&&r.col,compiledCount:outputs.length});throw Error('Canonical compiler failure: '+JSON.stringify(r&&{error:r.error,message:r.message,file:r.file,line:r.line,col:r.col}));}
 const regions=r.regions.regions,serialization=layoutLines(regions).join('\n')+'\n';
 assert.equal(new Set(regions.map(x=>x.name.replace(/^\$/,''))).size,regions.length,'duplicate compiler inventory');
 assert.equal(serialization,expected.serialization,'COMPLETE compiler inventory vs independent source/mirror inventory');
 const h=layoutHash(regions);assert.equal(h,expected.layout);if(stamp===null)stamp=h;assert.equal(h,stamp);
 save(file+'.compiler-layout.json',{regions,serialization,layout:h,tailCalls,elapsedMS:Date.now()-start,diagnostics:r.diagnostics||[]});
 const b=appendSection(Buffer.from(r.wasmBinary),stamp);assert(b.length<=8388608);
 fs.writeFileSync(path.join(O,file),b);outputs.push({file:path.join(O,file),bytes:b.length,sha256:sha(b),tailCalls,layout:h});
 save('outputs.json',outputs);console.log(JSON.stringify({compiled:outputs.length,...outputs.at(-1)}));
}
save('compiler-result.json',{compiledCount:outputs.length,canonical:true,entry:m.entry,closureSHA256:m.closureSHA256,compilerPath:m.compilerPath,compilerSHA256:m.compilerFullSHA256,options:{mode:'production',standardWat:true,runtimeBuiltins:false,strictDeclarations:true,tailCalls:[true,false]},nativeModuleCalls:0,Memory:false,Instance:false});
