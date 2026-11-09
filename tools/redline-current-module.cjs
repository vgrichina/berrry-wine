'use strict';
// Explicit new module version. Historical pins remain immutable and authoritative
// for every provider except the three enumerated, published REP build changes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const assert=require('node:assert/strict'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const historical='scratch/runs/20261109-redline-distinct-label-training-1235/runtime-pins.json';
const historicalSHA='f9b83cc89a0dd470f3d3f97846dfcf39b498fcb779e1a46de1a345006076f3ff';
const published='1f3bd16c1';
const moduleVersion='redline-1395-published-rep-1f3bd16c1-v1';
const replacements={
  'src/05b-string-ops.wat':{size:41208,sha256:'bc5e1c338a7a3aacc49d4d52bf4357bc9e2e71e3bbd5457b7093a91d01c80edb'},
  'build/wine-assembly.compat.wasm':{size:2188292,sha256:'a5d7569b2315787832b7e1e720aca05e4de8012c809ac7a7e7896a29452d057f'},
  'build/wine-assembly.wasm':{size:2185646,sha256:'d5dd33faadee5a0f77ac35347ecf0e4efe5efc86d92b03ef45ffe5adee83aea0'}
};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const pin=(name,b)=>({path:name,size:b.length,sha256:hash(b)});
const read=name=>fs.readFileSync(path.join(root,name));
const git=args=>cp.execFileSync('git',args,{cwd:root,maxBuffer:32*1024*1024});
function validate(){
  // Authenticate the complete retained manifest before consulting replacements.
  const raw=read(historical);assert.equal(hash(raw),historicalSHA,'historical pinset integrity');
  const pins=JSON.parse(raw),seen=new Set(),explainedDrift=[];
  for(const p of pins.files){assert(!seen.has(p.path),'duplicate historical pin');seen.add(p.path);}
  for(const name of Object.keys(replacements))assert(seen.has(name),'replacement must have historical pin');
  const commit=git(['rev-parse',published+'^{commit}']).toString().trim();
  git(['merge-base','--is-ancestor',commit,'HEAD']);
  git(['merge-base','--is-ancestor',commit,'origin/main']);
  // All published module sources and compiler inputs must match the build's
  // declared version, including files outside the old runtime manifest.
  const sources=git(['ls-tree','-r','--name-only',commit,'--','src','tools/watx-src','tools/watx.js','tools/watx-closure.js','tools/build-compile-wat.js']).toString().trim().split('\n');
  for(const name of sources)assert.equal(hash(read(name)),hash(git(['show',commit+':'+name])),'published build source: '+name);
  const files=pins.files.map(p=>{
    const actual=pin(p.path,read(p.path)),expected=replacements[p.path]??p;
    assert.equal(actual.size,expected.size,'provider size: '+p.path);
    assert.equal(actual.sha256,expected.sha256,'provider SHA: '+p.path);
    if(replacements[p.path])explainedDrift.push({before:p,after:actual,reason:'Published 1f3bd16c1 REP MOVS/STOS observer repair; fresh declared module version'});
    return actual;
  });
  const httpPins=pins.httpPins.map(p=>{
    const name=p.url.slice(1),before=pins.files.find(f=>f.path===name),after=files.find(f=>f.path===name);
    assert(before&&after,'HTTP pin must name validated provider');
    assert.equal(p.sha256,before.sha256,'historical HTTP/file SHA coherence');assert.equal(p.size,before.size,'historical HTTP/file size coherence');
    return {...p,size:after.size,sha256:after.sha256};
  });
  return {files,httpPins,moduleVersion,historicalPinset:{path:historical,sha256:historicalSHA,commit:pins.commit},explainedDrift,publishedCommit:commit};
}
function prepare(run){
  // Validate before the underlying preparer creates any destination inputs.
  const version=validate(),plan=require('./redline-startup-boundary.cjs').prepare(run,{currentPublishedModules:true});
  const file=path.join(path.resolve(run),'runtime-pins.json'),pins=JSON.parse(fs.readFileSync(file));
  pins.files.push(pin('tools/redline-current-module.cjs',read('tools/redline-current-module.cjs')));
  pins.files.sort((a,b)=>a.path.localeCompare(b.path));
  pins.publishedModuleCommit=version.publishedCommit;
  fs.writeFileSync(file,JSON.stringify(pins,null,2));
  fs.chmodSync(file,0o444);
  const seal={moduleVersion,publishedModuleCommit:version.publishedCommit,historicalPinset:version.historicalPinset,explainedDrift:version.explainedDrift,manifestSHA256:hash(fs.readFileSync(file)),providers:pins.files.length};
  fs.writeFileSync(path.join(run,'replacement-pinset-seal.json'),JSON.stringify(seal,null,2),{flag:'wx',mode:0o444});
  plan.moduleVersion=moduleVersion;plan.manifestSHA256=seal.manifestSHA256;plan.providers=pins.files.length;
  fs.writeFileSync(path.join(run,'experiment-plan.json'),JSON.stringify(plan,null,2));return plan;
}
module.exports={validate,prepare,moduleVersion,historical,historicalSHA};
if(require.main===module){assert.equal(process.argv[2],'--prepare','explicit new-version preparation only');console.log(JSON.stringify(prepare(process.argv[3])));}
