'use strict';
const fs=require('fs'),path=require('path'),Module=require('module'),crypto=require('crypto');
const R=process.env.SHADOW_RUNTIME||path.resolve(__dirname,'../../../runtime'),seen=new Set(),missing=[],dynamic=[],workers=[];
function visit(p){
 if(seen.has(p)||!p.endsWith('.js')&&!p.endsWith('.cjs'))return;seen.add(p);
 const s=fs.readFileSync(p,'utf8'),req=Module.createRequire(p);
 for(const m of s.matchAll(/\brequire\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g)){
  const spec=m[2];if(Module.isBuiltin(spec))continue;
  try{visit(req.resolve(spec));}catch(e){missing.push({from:path.relative(R,p),spec,code:e.code});}
 }
 for(const m of s.matchAll(/\brequire\s*\(\s*(?!['"])([^\n]{0,100})/g))dynamic.push({from:path.relative(R,p),expression:m[0]});
 for(const m of s.matchAll(/(?:new Worker|fork)\([^\n]{0,180}/g))workers.push({from:path.relative(R,p),expression:m[0]});
}
for(const n of ['test/run.js','lib/guest-worker.js','lib/worker-imports.js','lib/thread-manager.js','lib/guest-thread-host.js','lib/render-worker.js','lib/d3d-render-worker.js','lib/d3dim-render-worker.js','lib/d3d9-render-worker.js','lib/gl-render-worker.js','lib/glide-render-worker.js','host.js','tools/ctl.js'])visit(path.join(R,n));
const {PNG}=require(path.join(R,'node_modules/pngjs'));
const pixels=Buffer.from([255,0,0,255,0,255,0,127,0,0,255,64,23,45,67,255]);
const encoded=PNG.sync.write({width:2,height:2,data:pixels}),decoded=PNG.sync.read(encoded);
if(decoded.width!==2||decoded.height!==2||!decoded.data.equals(pixels))throw Error('PNG fixture mismatch');
const out={files:seen.size,visited:[...seen].map(p=>path.relative(R,p)).sort(),missing,dynamic,workers,png:{roundTrip:true,version:require(path.join(R,'node_modules/pngjs/package.json')).version,bytes:encoded.length,sha256:crypto.createHash('sha256').update(encoded).digest('hex')},scope:'Static Node requires plus explicit Worker roots. Conditional missing modules require command-mode exclusion review before guest.'};
fs.writeFileSync(process.env.SHADOW_PREFLIGHT_OUTPUT||path.join(__dirname,'dependency-preflight.json'),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2));
