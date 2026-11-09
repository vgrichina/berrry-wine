'use strict';
// The full generated caller retains byte hashing even after syscall observation
// exhausts. These direct negative controls never create a browser or server.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const publication=require('./redline-current-publication.cjs'),startup=require('./redline-current-startup.cjs').version;
const base=path.resolve(process.env.REDLINE_VALIDATION_RUN),root=path.resolve(__dirname,'..');
if(process.argv[2]==='--runner'){
 const read=fs.readFileSync,target=process.argv[3];
 fs.readFileSync=function(file,...args){
  const bytes=read.call(this,file,...args);
  if(path.resolve(String(file))===path.join(root,target)){
   const corrupt=Buffer.from(bytes);corrupt[corrupt.length-1]^=1;return corrupt;
  }
  return bytes;
 };
 require(process.argv[4]+'/publication-caller.cjs');
 assert.fail('corrupt caller passed');
}
assert(process.env.REDLINE_VALIDATION_RUN,'fresh evidence directory required');fs.mkdirSync(base,{recursive:true});
const run=base+'/prepared',plan=publication.prepare(run,publication.version,startup);
publication.stagedPrelaunch(run,publication.version,startup,plan.manifestSHA256);
const raw=JSON.parse(fs.readFileSync(run+'/runtime-pins.json'));
assert.equal(raw.files.filter(p=>p.path==='tools/redline-bounded-custody.py').length,1);
let controls=0;
for(const target of ['host.js','build/wine-assembly.wasm','build/wine-assembly.compat.wasm','tools/redline-bounded-custody.py']){
 const child=require('node:child_process').spawnSync(process.execPath,[__filename,'--runner',target,run],{encoding:'utf8',timeout:20000});
 assert.equal(child.status,1,child.stderr);assert.equal(child.signal,null);assert(child.stderr.includes('actual caller pinned bytes: '+target),child.stderr);controls++;
}
assert(!fs.existsSync(run+'/publication-custody'));assert(!fs.existsSync(run+'/native-fixture'));
fs.writeFileSync(base+'/result.json',JSON.stringify({passed:true,controls,generatedCaller:true,manifestSHA256:plan.manifestSHA256,noChrome:true,authenticCPUChecks:true}));
console.log('PASS generated caller rejects actual CPU/host/custody corruption; new adapter authenticated in full closure');
