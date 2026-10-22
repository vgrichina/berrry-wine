'use strict';
const fs=require('fs'),path=require('path'),Module=require('module'),crypto=require('crypto'),cp=require('child_process');
const R=process.cwd(), E=path.join(R,'evidence-pinned-dependency-qualification');
const tests=['directx-setup','directx-ordinals','dsetup-loading','dll-lifecycle-real-pe','dll-import-graph-lifecycle','dll-import-no-ilt','dll-lifecycle-races','scoped-dll-native','scoped-dll-lifecycle'].map(n=>'test/test-'+n+'.js');
const seen=new Set(),external=[],missing=[],dynamic=[],runtime=[];
function visit(p){
 if(seen.has(p)||!fs.existsSync(p)||!(/\.(?:[cm]?js)$/.test(p)))return;seen.add(p);
 const s=fs.readFileSync(p,'utf8'), req=Module.createRequire(p);
 const re=/(?:\brequire\s*\(|\bimport\s*\()\s*(['"])([^'"\n]+)\1\s*\)/g;
 for(const m of s.matchAll(re)){
  const spec=m[2];if(Module.isBuiltin(spec))continue;
  try{const resolved=req.resolve(spec);if(!spec.startsWith('.')&&!path.isAbsolute(spec))external.push({from:path.relative(R,p),spec,resolved:path.relative(R,resolved)});visit(resolved);}
  catch(e){missing.push({from:path.relative(R,p),spec,code:e.code,context:s.slice(Math.max(0,m.index-160),m.index+200)});}
 }
 for(const m of s.matchAll(/\brequire\s*\(\s*(?!['"])([^\n]{0,100})/g))dynamic.push({from:path.relative(R,p),expression:m[0]});
 for(const m of s.matchAll(/(?:spawnSync|spawn|execFileSync|execSync|new Worker)\s*\([^\n]{0,150}/g))runtime.push({from:path.relative(R,p),expression:m[0]});
}
// Explicit child runner/worker and compiler entry points used by these nine commands.
for(const p of [...tests,'test/run.js','test/thread-worker.js','test/compile-src.js','tools/build-compile-wat.js'])if(fs.existsSync(path.join(R,p)))visit(path.join(R,p));
const {PNG}=require(path.join(R,'node_modules/pngjs'));const pixels=Buffer.from([255,0,0,255,0,255,0,127,0,0,255,64,23,45,67,255]);
const encoded=PNG.sync.write({width:2,height:2,data:pixels}),decoded=PNG.sync.read(encoded);
if(decoded.width!==2||decoded.height!==2||!decoded.data.equals(pixels))throw Error('PNG round trip failed');
function readU(b,c){let v=0,s=0,x;do{x=b[c.i++];v|=(x&127)<<s;s+=7;}while(x&128);return v>>>0;}
const b=fs.readFileSync('build/wine-assembly.wasm'),wasmExports=[];let c={i:8};while(c.i<b.length){const id=b[c.i++],n=readU(b,c),end=c.i+n;if(id===7){const count=readU(b,c);for(let i=0;i<count;i++){const l=readU(b,c),name=b.subarray(c.i,c.i+l).toString();c.i+=l;const kind=b[c.i++],index=readU(b,c);wasmExports.push({name,kind,index});}}c.i=end;}
const out={tests,recursiveFiles:seen.size,visited:[...seen].map(p=>path.relative(R,p)).sort(),external,missing,dynamic,runtime,node:process.version,tools:{node:process.execPath,python3:cp.spawnSync('python3',['--version'],{encoding:'utf8'}).stdout.trim(),bash:cp.spawnSync('bash',['--version'],{encoding:'utf8'}).stdout.split('\n')[0]},png:{package:require(path.join(R,'node_modules/pngjs/package.json')).version,width:2,height:2,bytes:encoded.length,sha256:crypto.createHash('sha256').update(encoded).digest('hex'),roundTrip:true},canonicalExports:wasmExports,extraCompileReason:{directxSetup:'existing test requires test_directx_setup export; render-helper has no file-input option',hasTestDirectxSetup:wasmExports.some(x=>x.name==='test_directx_setup')}};
fs.writeFileSync(path.join(E,'preflight.json'),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2));
