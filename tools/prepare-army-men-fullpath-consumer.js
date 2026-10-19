'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const [prior,dest,candidate,controller]=process.argv.slice(2);assert(prior&&dest&&candidate&&controller&&!fs.existsSync(dest));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
assert.equal(sha(path.join(prior,'transfer-manifest.json')),'11dfd4910afd5eae286220b1aa6de77c8326541a37e793619f5cfb61428ae88a');
assert.equal(sha(path.join(prior,'runtime/lib/filesystem.js')),'ca27bf7eeccf819d58cf6a8fc3e438065802649a777ed79c596de59d476fc8c3');
const st=fs.statfsSync(prior);assert(st.bavail*st.bsize>2214592512+2*1024**2,'staging hardfloor margin');
const pins=JSON.parse(fs.readFileSync(path.join(prior,'transfer-manifest.json')));for(const f of pins)assert.equal(sha(path.join(prior,f.path)),f.sha256,f.path);
fs.mkdirSync(dest);let linked=0,allocated=0;
for(const f of pins){if(['runtime/lib/filesystem.js','controller.js','source-identity.json'].includes(f.path))continue;const p=path.join(dest,f.path);fs.mkdirSync(path.dirname(p),{recursive:true});fs.linkSync(path.join(prior,f.path),p);linked++;}
for(const [name,source] of [['runtime/lib/filesystem.js',candidate],['controller.js',controller]]){const p=path.join(dest,name);fs.copyFileSync(source,p,fs.constants.COPYFILE_EXCL);allocated+=fs.statSync(p).blocks*512;}
const identity={...JSON.parse(fs.readFileSync(path.join(prior,'source-identity.json'))),fullPathCandidate:'afeabfd0e06f70b03ab1c8627abacaf76cb1dd66',previousManifestSha256:sha(path.join(prior,'transfer-manifest.json')),filesystemDelta:{before:sha(path.join(prior,'runtime/lib/filesystem.js')),after:sha(candidate),scope:'Only GetFullPathName result separators, buffer capacity and filePart semantics; same source file base in maincdc48 and historical7c943.'},observation:'Paired historical7c943/7fd runtime plus scoped JS candidate; not currentmain module. Originals/ABI/WASM untouched.'};
const ip=path.join(dest,'source-identity.json');fs.writeFileSync(ip,JSON.stringify(identity,null,2)+'\n',{flag:'wx'});allocated+=fs.statSync(ip).blocks*512;
const manifest=[];function walk(d){for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory())walk(p);else manifest.push({path:path.relative(dest,p),size:fs.statSync(p).size,sha256:sha(p)});}}walk(dest);
const mp=path.join(dest,'transfer-manifest.json');fs.writeFileSync(mp,JSON.stringify(manifest.sort((a,b)=>a.path.localeCompare(b.path)),null,2)+'\n',{flag:'wx'});allocated+=fs.statSync(mp).blocks*512;
for(const f of pins)assert.equal(sha(path.join(prior,f.path)),f.sha256,'prior preserved');
console.log(JSON.stringify({dest,files:manifest.length,linked,addedAllocatedBytes:allocated,manifest:sha(mp),controller:sha(controller),candidate:sha(candidate),guestExecuted:false}));
