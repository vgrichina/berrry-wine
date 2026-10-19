'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const [prior,dest,candidate,controller,plan]=process.argv.slice(2);assert(prior&&dest&&candidate&&controller&&plan&&!fs.existsSync(dest));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
assert.equal(sha(path.join(prior,'transfer-manifest.json')),'b22f8986ce3428e776b34736cb4fe217b373f15511385e090986fc09c6b447a8');
assert.equal(sha(path.join(prior,'runtime/lib/filesystem.js')),'04f5fd5fa989f416826eb19fe38227bf26a9433d11c921f11bc5f95496dc5fbf');
const st=fs.statfsSync(prior);assert(st.bavail*st.bsize>2214592512+2*1024**2,'staging hardfloor margin');
const pins=JSON.parse(fs.readFileSync(path.join(prior,'transfer-manifest.json')));for(const f of pins)assert.equal(sha(path.join(prior,f.path)),f.sha256,f.path);
fs.mkdirSync(dest);let linked=0,allocated=0;
for(const f of pins){if(['runtime/lib/filesystem.js','controller.js','source-identity.json','army-men-directory-validation-plan.js'].includes(f.path))continue;const p=path.join(dest,f.path);fs.mkdirSync(path.dirname(p),{recursive:true});fs.linkSync(path.join(prior,f.path),p);linked++;}
for(const [name,source] of [['runtime/lib/filesystem.js',candidate],['controller.js',controller],['army-men-slash-observation-plan.js',plan]]){const p=path.join(dest,name);fs.copyFileSync(source,p,fs.constants.COPYFILE_EXCL);allocated+=fs.statSync(p).blocks*512;}
const identity={...JSON.parse(fs.readFileSync(path.join(prior,'source-identity.json'))),fullPathCandidate:'28a2e90358b2275bf84f35df360462a2763e5cd5',previousManifestSha256:sha(path.join(prior,'transfer-manifest.json')),filesystemDelta:{before:sha(path.join(prior,'runtime/lib/filesystem.js')),after:sha(candidate),scope:'Prior GetFullPathName fix plus separator normalization before canonical path classification; only scoped JavaScript filesystem changes.'},observation:'Paired historical7c943/7fd runtime plus scoped JS candidate; not currentmain module. Originals/ABI/WASM untouched.'};
const ip=path.join(dest,'source-identity.json');fs.writeFileSync(ip,JSON.stringify(identity,null,2)+'\n',{flag:'wx'});allocated+=fs.statSync(ip).blocks*512;
const manifest=[];function walk(d){for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory())walk(p);else manifest.push({path:path.relative(dest,p),size:fs.statSync(p).size,sha256:sha(p)});}}walk(dest);
const mp=path.join(dest,'transfer-manifest.json');fs.writeFileSync(mp,JSON.stringify(manifest.sort((a,b)=>a.path.localeCompare(b.path)),null,2)+'\n',{flag:'wx'});allocated+=fs.statSync(mp).blocks*512;
for(const f of pins)assert.equal(sha(path.join(prior,f.path)),f.sha256,'prior preserved');
console.log(JSON.stringify({dest,files:manifest.length,linked,addedAllocatedBytes:allocated,manifest:sha(mp),controller:sha(controller),candidate:sha(candidate),guestExecuted:false}));
