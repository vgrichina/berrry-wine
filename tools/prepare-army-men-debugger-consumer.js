'use strict';
// Immutable runner-only debugger delta; all original files are hardlinked unchanged.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const [prior,dest,runner,controller,helper]=process.argv.slice(2);assert(prior&&dest&&runner&&controller&&helper&&!fs.existsSync(dest));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
assert.equal(sha(path.join(prior,'transfer-manifest.json')),'3b8314c8c4195c8c4c1e4b7a82fb0d42f3b81ebce718d58e1a12bbd3da42b0d9');
assert.equal(sha(path.join(prior,'runtime/test/run.js')),'903d9d56573ea5865678f8c769a89410f80db039ec554666ca957d521ee1e512');
assert.equal(sha(runner),'527d845ca17212367b6467d45d3b1f168f5d82b848fce6faf52d1947eada81ce');
const pins=JSON.parse(fs.readFileSync(path.join(prior,'transfer-manifest.json')));
for(const f of pins)assert.equal(sha(path.join(prior,f.path)),f.sha256,f.path);
fs.mkdirSync(dest);let linked=0,copied=0;
for(const f of pins){if(['runtime/test/run.js','controller.js','source-identity.json'].includes(f.path))continue;const p=path.join(dest,f.path);fs.mkdirSync(path.dirname(p),{recursive:true});fs.linkSync(path.join(prior,f.path),p);linked++;}
for(const [name,source] of [['runtime/test/run.js',runner],['controller.js',controller],['army-men-debugger-handoff.js',helper]]){const p=path.join(dest,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.copyFileSync(source,p,fs.constants.COPYFILE_EXCL);copied+=fs.statSync(p).blocks*512;}
const identity={...JSON.parse(fs.readFileSync(path.join(prior,'source-identity.json'))),debuggerSourceCommit:'21d473f999e170d5e97c39291fb2975f448b6697',previousManifestSha256:sha(path.join(prior,'transfer-manifest.json')),runnerOnlyDelta:{before:'903d9d56573ea5865678f8c769a89410f80db039ec554666ca957d521ee1e512',after:sha(runner),description:'Interactive w uses existing activateWatchpoint; no emulator/wasm or original asset changes'},notes:'Immutable debugger consumer; original v4 remains intact. Module7fd and all installed state unchanged.'};
fs.writeFileSync(path.join(dest,'source-identity.json'),JSON.stringify(identity,null,2)+'\n',{flag:'wx'});
const manifest=[];function walk(dir){for(const d of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,d.name);if(d.isDirectory())walk(p);else manifest.push({path:path.relative(dest,p),size:fs.statSync(p).size,sha256:sha(p)});}}walk(dest);
fs.writeFileSync(path.join(dest,'transfer-manifest.json'),JSON.stringify(manifest.sort((a,b)=>a.path.localeCompare(b.path)),null,2)+'\n',{flag:'wx'});
for(const f of pins)assert.equal(sha(path.join(prior,f.path)),f.sha256,'prior stage preserved');
console.log(JSON.stringify({dest,linked,copiedAllocatedBytes:copied,files:manifest.length,manifestSha256:sha(path.join(dest,'transfer-manifest.json')),runnerSha256:sha(runner),guestExecuted:false}));
