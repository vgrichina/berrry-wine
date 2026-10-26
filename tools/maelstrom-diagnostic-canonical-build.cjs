'use strict';
// Adapted from driver SHA256 5e017d86566fc64d7e2f4e0357cfb4e8e54e53152995a6c0317f2a5da9d98b3f.
// Explicit accepted helper change 24b0e65c -> 3ea873bc; enable UOP and require six overlays.
// Exact pinned closure, retained compressed on disk and expanded only in memory.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const assert=require('node:assert/strict');
const H=path.resolve(__dirname,'../../ops'),ROOT=process.env.MNE_CANONICAL_ROOT||'/home/user/wine-assembly-shadow-man-span-static-canonical-oct23',STANDING=process.env.MNE_STANDING||'/tmp/maelstrom-errno-api-canonical-native-oct25/ops';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const m=JSON.parse(fs.readFileSync(ROOT+'/docs/re-notes/shadow-man-span-static-canonical-20261023/manifest.json'));
const projection=JSON.parse(fs.readFileSync(STANDING+'/compressed-projection.json'));
assert.equal(m.candidate,'b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a');
assert.equal(m.files.length,140);assert.equal(m.files.reduce((n,r)=>n+r.bytes,0),21207647);
const packed=fs.readFileSync(STANDING+'/sources.json.gz');assert.equal(sha(packed),projection.bundleSHA256);
const originals=Object.fromEntries(Object.entries(JSON.parse(zlib.gunzipSync(packed))).map(([p,b])=>[p,Buffer.from(b,'base64')]));
const inputSeals=m.files.map(row=>{
 const b=row.path.startsWith('src/')?originals[row.path]:fs.readFileSync(ROOT+'/'+row.path);
 assert.equal(b.length,row.bytes,row.path);assert.equal(sha(b),row.sha256,row.path);
 return {...row};
});
assert.equal(Object.keys(originals).length,128);
const hookPath=path.join(__dirname,'maelstrom-native-errno-latch.cjs');
assert.equal(sha(fs.readFileSync(hookPath)),'3ea873bc5c18283fc6045b55d00a2e957eaff46b4372534dd59fba18354a9f6f');
assert.equal(sha(fs.readFileSync(path.join(__dirname,'maelstrom-select-completion-hook.cjs'))),'b7c77c20b12cd582d6fcfbe246e1f0abdcb644266fc3f161bf5d683d93b13930');
assert.equal(sha(fs.readFileSync(path.join(__dirname,'maelstrom-original-errno-adapter.cjs'))),'28c1c3249ef488d4b2df1ccb3d0658cc1b02803ca9163f5a2bb24f945ba00551');
const hook=require(hookPath),{sourceTextFromBytes}=require(ROOT+'/tools/watx.js');
const {compileClosure}=require(ROOT+'/tools/watx-closure.js');
// Same decoding and aliases as unchanged watxSourceClosure. The sole source order is main.watx.
const vfs=new Map();for(const [p,b]of Object.entries(originals)){
 // The compiler decoder may sanitize a Buffer slice in place. Give it a disposable
 // copy, just as canonical readSourceText does with its fresh fs.readFileSync Buffer.
 const f=path.basename(p),text=sourceTextFromBytes(Buffer.from(b));
 for(const k of [f,'src/'+f,'./'+f])vfs.set(k,text);
}
const closure={source:sourceTextFromBytes(Buffer.from(originals['src/main.watx'])),vfs,entry:'src/main.watx'};
const original=Object.fromEntries(Object.keys({...hook.PINS,...hook.UOP_PINS}).map(p=>[p,originals[p].toString('utf8')]));
const binaries=Object.fromEntries(['net','exe','crt'].map(n=>[n,fs.readFileSync(({net:(process.env.MNE_ANCHORS?process.env.MNE_ANCHORS+'/'+'net':'/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/SDL_net.dll'),exe:(process.env.MNE_ANCHORS?process.env.MNE_ANCHORS+'/'+'exe':'/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/Maelstrom.exe'),crt:(process.env.MNE_ANCHORS?process.env.MNE_ANCHORS+'/'+'crt':'/home/user/wine-assembly/test/binaries/dlls/msvcrt.dll')})[n])]));
const crtLoadedBase=0x522000; // EXPLICIT SYNTHETIC mapping. Never loader proof for original game.
const anchors=hook.verifyBinaries(binaries);
const changed=hook.transform(original,{enabled:true,uopNativeBoundaries:true,binaries,crtLoadedBase});
const overlays=[];
for(const [p,text]of Object.entries(changed)){
 if(text===original[p])continue;
 const f=path.basename(p),decoded=sourceTextFromBytes(Buffer.from(text));
 for(const k of [f,'src/'+f,'./'+f])closure.vfs.set(k,decoded);
 overlays.push({path:p,originalSHA256:sha(original[p]),transformedSHA256:sha(text),compilerTextSHA256:sha(decoded),bytes:Buffer.byteLength(text)});
}
assert.deepEqual(overlays.map(x=>x.path).sort(),['src/05-alu.wat','src/06b-core-handlers.wat','src/07d-uop-engine.wat','src/07e-uop-compiler.wat','src/09b-dispatch.wat','src/09d-winsock.wat']);
assert(closure.vfs.get('09d-winsock.wat').includes('(func $mne_complete'));
for(const n of hook.DIAGNOSTIC_FIELDS)assert(closure.vfs.get('09d-winsock.wat').includes('(export \"mne_'+n+'\")'));
assert(closure.vfs.get('06b-core-handlers.wat').includes('(call $mne_call (local.get $op) (local.get $target) (local.get $reg))'));
assert(closure.vfs.get('05-alu.wat').includes('(call $mne_return (local.get $mne_source))'));
const reached=new Set();
function visit(key,text){
 if(reached.has(key))return;reached.add(key);
 for(const hit of text.matchAll(/\(include\s+"([^"]+)"\s*\)/g)){
  assert(closure.vfs.has(hit[1]),'unresolved include '+hit[1]);
  visit('src/'+path.basename(hit[1]),closure.vfs.get(hit[1]));
 }
}
visit(closure.entry,closure.source);
for(const r of overlays)assert(reached.has(r.path));
for(const p of reached)for(const k of [path.basename(p),'src/'+path.basename(p),'./'+path.basename(p)])assert.equal(closure.vfs.get(k),closure.vfs.get(path.basename(p)));
const {applyToVfs}=require(ROOT+'/lib/dispatch-trampoline.js');
const {layoutHash,appendSection}=require(ROOT+'/tools/region-layout-hash.js');
const compat={...closure,vfs:applyToVfs(new Map(closure.vfs))};
const seal={sourceRoot:ROOT,historicalManifestRevision:m.candidate,canonicalScope:'exact sealed historical closure; not current production',acceptedIntegration:'e745cc29a1a3b859625aa0cd335abee0b185da71',uopNativeBoundaries:true,
 entry:closure.entry,inputSeals,overlays,crtLoadedBase,mappingQualification:'explicit controlled synthetic CRT mapping; authentic PE anchors verified; not original loader mapping',anchors,
 binarySeals:Object.entries(binaries).map(([name,b])=>({name,bytes:b.length,sha256:sha(b)})),
 reached:[...reached].map(p=>({path:p,sha256:sha(p===closure.entry?closure.source:closure.vfs.get(path.basename(p)))})),
 compilerDependencies:inputSeals.filter(r=>!r.path.startsWith('src/')),candidate:'e745cc29a1a3b859625aa0cd335abee0b185da71',adapterSHA256:sha(fs.readFileSync(path.join(__dirname,'maelstrom-original-errno-adapter.cjs'))),hookSHA256:sha(fs.readFileSync(hookPath)),compressedSHA256:sha(packed),
 options:{mode:'production',standardWat:true,runtimeBuiltins:false,strictDeclarations:true,tailCalls:[true,false],names:false,shake:false},noMaterializedSources:true};
fs.writeFileSync(H+'/build-inputs.json',JSON.stringify(seal,null,2));
if(process.argv.includes('--preflight')){console.log(JSON.stringify({status:'PASS',reached:reached.size,overlays}));return;}
const outputs=[];
for(const tailCalls of [true,false]){
 console.log(JSON.stringify({beginCompile:{tailCalls,entry:closure.entry}}));
 const r=compileClosure(tailCalls?closure:compat,{tailCalls,regionShake:null});
 if(!r||!r.success||!r.wasmBinary){
  const failure={tailCalls,error:r&&(r.error||r.message),file:r&&r.file,line:r&&r.line,col:r&&r.col,diagnostics:r&&r.diagnostics};
  fs.writeFileSync(H+'/compiler-failure.json',JSON.stringify(failure,null,2));throw Error('Canonical diagnostic compiler rejected: '+JSON.stringify(failure));
 }
 const computed=layoutHash(r.regions.regions);assert.equal(computed,'9a3bc9149d58209c');
 const bytes=appendSection(Buffer.from(r.wasmBinary),computed);assert(bytes.length<=2097152,'stricter task output projection');
 const filename=H+(tailCalls?'/errno-latch.wasm':'/errno-latch.compat.wasm');fs.writeFileSync(filename,bytes);
 const row={path:filename,bytes:bytes.length,sha256:sha(bytes),tailCalls,layout:computed,regions:r.regions.regions};
 outputs.push(row);fs.writeFileSync(H+'/build-outputs.json',JSON.stringify(outputs,null,2));
 // Exact unchanged historical guard preloaded; synchronous fixed Buffer only.
 new WebAssembly.Module(bytes);
 console.log(JSON.stringify({compiled:{bytes:row.bytes,sha256:row.sha256,layout:computed,tailCalls}}));
}
assert.equal(sha(fs.readFileSync(STANDING+'/sources.json.gz')),projection.bundleSHA256);
for(const r of inputSeals.filter(r=>!r.path.startsWith('src/')))assert.equal(sha(fs.readFileSync(ROOT+'/'+r.path)),r.sha256);
console.log(JSON.stringify({status:'PASS',compiled:outputs.length,nativeInstances:0}));
