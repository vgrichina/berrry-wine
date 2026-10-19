'use strict';
// Immutable source-only staging: prior inputs hardlinked, controller/plan copied.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const [prior,dest,controller,plan]=process.argv.slice(2);
assert(prior&&dest&&controller&&plan&&!fs.existsSync(dest));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const free=()=>{const s=fs.statfsSync(prior);return s.bavail*s.bsize;};
assert(free()>2214592512+2*1024**2,'source staging must preserve hard floor plus measured staging margin');
assert.equal(sha(path.join(prior,'transfer-manifest.json')),'3b8314c8c4195c8c4c1e4b7a82fb0d42f3b81ebce718d58e1a12bbd3da42b0d9');
const pins=JSON.parse(fs.readFileSync(path.join(prior,'transfer-manifest.json')));
for(const f of pins)assert.equal(sha(path.join(prior,f.path)),f.sha256,f.path);
fs.mkdirSync(dest);let linked=0,added=0;
for(const f of pins){if(['controller.js','source-identity.json'].includes(f.path))continue;const p=path.join(dest,f.path);fs.mkdirSync(path.dirname(p),{recursive:true});fs.linkSync(path.join(prior,f.path),p);linked++;}
for(const [name,source] of [['controller.js',controller],['army-men-directory-validation-plan.js',plan]]){const p=path.join(dest,name);fs.copyFileSync(source,p,fs.constants.COPYFILE_EXCL);added+=fs.statSync(p).blocks*512;}
const identity={...JSON.parse(fs.readFileSync(path.join(prior,'source-identity.json'))),previousManifestSha256:sha(path.join(prior,'transfer-manifest.json')),observation:'Original directory validation API returns and pre-SetAt object/bytes/arguments; unchanged v4 runner/module/assets; no debugger breakpoint.'};
const identityPath=path.join(dest,'source-identity.json');fs.writeFileSync(identityPath,JSON.stringify(identity,null,2)+'\n',{flag:'wx'});added+=fs.statSync(identityPath).blocks*512;
const manifest=[];function walk(d){for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory())walk(p);else manifest.push({path:path.relative(dest,p),size:fs.statSync(p).size,sha256:sha(p)});}}walk(dest);
const mp=path.join(dest,'transfer-manifest.json');fs.writeFileSync(mp,JSON.stringify(manifest.sort((a,b)=>a.path.localeCompare(b.path)),null,2)+'\n',{flag:'wx'});added+=fs.statSync(mp).blocks*512;
for(const f of pins)assert.equal(sha(path.join(prior,f.path)),f.sha256,'prior unchanged');
console.log(JSON.stringify({dest,files:manifest.length,linked,addedAllocatedBytes:added,manifest:sha(mp),controller:sha(controller),plan:sha(plan),freeBytes:free(),guestExecuted:false}));
