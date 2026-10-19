'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const [prior,dest,controller,plan]=process.argv.slice(2);assert(prior&&dest&&controller&&plan&&!fs.existsSync(dest));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
assert.equal(sha(path.join(prior,'transfer-manifest.json')),'16b731e683d2033c597de880fa8afeb38425705003a61a37d6133bd30713d8ac');
assert.equal(sha(path.join(prior,'runtime/lib/filesystem.js')),'ba7e94aec476e403c6db8802fd2da724a06eab45b16eee8eb7d0be223b3d287d');
const st=fs.statfsSync(prior);assert(st.bavail*st.bsize>2214592512+2*1024**2,'staging hardfloor margin');
const pins=JSON.parse(fs.readFileSync(path.join(prior,'transfer-manifest.json')));for(const f of pins)assert.equal(sha(path.join(prior,f.path)),f.sha256,f.path);
fs.mkdirSync(dest);let linked=0,allocated=0;
for(const f of pins){if(['controller.js','source-identity.json','army-men-render-trace-plan.js','runtime/test/run.js'].includes(f.path))continue;const p=path.join(dest,f.path);fs.mkdirSync(path.dirname(p),{recursive:true});fs.linkSync(path.join(prior,f.path),p);linked++;}
for(const [name,source] of [['controller.js',controller],['army-men-render-trace-plan.js',plan]]){const p=path.join(dest,name);fs.copyFileSync(source,p,fs.constants.COPYFILE_EXCL);allocated+=fs.statSync(p).blocks*512;}
const oldRunner=fs.readFileSync(path.join(prior,'runtime/test/run.js'),'utf8');
assert.equal(sha(path.join(prior,'runtime/test/run.js')),'903d9d56573ea5865678f8c769a89410f80db039ec554666ca957d521ee1e512');
const needle='    !TRACE_API_MEM.length;';
const replacement='    // Memory dumps accompany a paused API trace; they must not force its\n    // dispatch logger on before the explicit trace-api control command.\n    // Without --trace-api, memory-only tracing retains its existing behavior.\n    (!TRACE_API_MEM.length || (TRACE_API && TRACE_API_PAUSED));';
assert.equal(oldRunner.split(needle).length,2);
const rp=path.join(dest,'runtime/test/run.js');fs.writeFileSync(rp,oldRunner.replace(needle,replacement),{flag:'wx'});allocated+=fs.statSync(rp).blocks*512;
assert.equal(sha(rp),'4437133d79e8b13ea660b78cfcdbf59d7c4f7c7de19ad9f1fd04e21110c66bd0');
const identity={...JSON.parse(fs.readFileSync(path.join(prior,'source-identity.json'))),runnerPatchCommit:'e253f0f901fbfb992a2277ee0939f698a711367d',runnerPatchScope:'Only initial API memory pause predicate and explanatory comment on historical903d runner; original WASM/source baseline unchanged.',previousManifestSha256:sha(path.join(prior,'transfer-manifest.json')),observation:'Historical V11 runtime with reviewed runner pause-only patch and original state, selected paused API turn trace controller/plan; entry rectangles only, no returned pitch claim; historical7c943/7fd plus scoped JS fixes, not currentmain module.'};
const ip=path.join(dest,'source-identity.json');fs.writeFileSync(ip,JSON.stringify(identity,null,2)+'\n',{flag:'wx'});allocated+=fs.statSync(ip).blocks*512;
const manifest=[];function walk(d){for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory())walk(p);else manifest.push({path:path.relative(dest,p),size:fs.statSync(p).size,sha256:sha(p)});}}walk(dest);
const mp=path.join(dest,'transfer-manifest.json');fs.writeFileSync(mp,JSON.stringify(manifest.sort((a,b)=>a.path.localeCompare(b.path)),null,2)+'\n',{flag:'wx'});allocated+=fs.statSync(mp).blocks*512;
for(const f of pins)assert.equal(sha(path.join(prior,f.path)),f.sha256,'prior preserved');
console.log(JSON.stringify({dest,files:manifest.length,linked,addedAllocatedBytes:allocated,manifest:sha(mp),controller:sha(controller),plan:sha(plan),guestExecuted:false}));
