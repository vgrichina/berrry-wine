'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const [prior,dest,controller,plan]=process.argv.slice(2);assert(prior&&dest&&controller&&plan&&!fs.existsSync(dest));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
assert.equal(sha(path.join(prior,'transfer-manifest.json')),'51b8a9d08f1adbe65e2ec728c8bc061c3b3accefeebf8fc6e9124fc01b17f981');
assert.equal(sha(path.join(prior,'runtime/lib/filesystem.js')),'ba7e94aec476e403c6db8802fd2da724a06eab45b16eee8eb7d0be223b3d287d');
const st=fs.statfsSync(prior);assert(st.bavail*st.bsize>2214592512+2*1024**2,'staging hardfloor margin');
const pins=JSON.parse(fs.readFileSync(path.join(prior,'transfer-manifest.json')));for(const f of pins)assert.equal(sha(path.join(prior,f.path)),f.sha256,f.path);
fs.mkdirSync(dest);let linked=0,allocated=0;
for(const f of pins){if(['controller.js','source-identity.json','army-men-render-trace-plan.js'].includes(f.path))continue;const p=path.join(dest,f.path);fs.mkdirSync(path.dirname(p),{recursive:true});fs.linkSync(path.join(prior,f.path),p);linked++;}
for(const [name,source] of [['controller.js',controller],['army-men-scroll-boundary-plan.js',plan]]){const p=path.join(dest,name);fs.copyFileSync(source,p,fs.constants.COPYFILE_EXCL);allocated+=fs.statSync(p).blocks*512;}
const identity={...JSON.parse(fs.readFileSync(path.join(prior,'source-identity.json'))),previousManifestSha256:sha(path.join(prior,'transfer-manifest.json')),observation:'Same V12 pause-patched historical runtime and original state, bounded original407503 scroll-copy boundary trace; no broad API logging; historical7c943/7fd plus scoped JS fixes, not currentmain module.'};
const ip=path.join(dest,'source-identity.json');fs.writeFileSync(ip,JSON.stringify(identity,null,2)+'\n',{flag:'wx'});allocated+=fs.statSync(ip).blocks*512;
const manifest=[];function walk(d){for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory())walk(p);else manifest.push({path:path.relative(dest,p),size:fs.statSync(p).size,sha256:sha(p)});}}walk(dest);
const mp=path.join(dest,'transfer-manifest.json');fs.writeFileSync(mp,JSON.stringify(manifest.sort((a,b)=>a.path.localeCompare(b.path)),null,2)+'\n',{flag:'wx'});allocated+=fs.statSync(mp).blocks*512;
for(const f of pins)assert.equal(sha(path.join(prior,f.path)),f.sha256,'prior preserved');
console.log(JSON.stringify({dest,files:manifest.length,linked,addedAllocatedBytes:allocated,manifest:sha(mp),controller:sha(controller),plan:sha(plan),guestExecuted:false}));
