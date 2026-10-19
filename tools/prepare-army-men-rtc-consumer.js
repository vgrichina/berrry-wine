'use strict';
// Source-only immutable staging. Never launches a guest or changes older stages.
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert/strict');
const [old,dest,repo,modulePath,controller]=process.argv.slice(2);
assert(old&&dest&&repo&&modulePath&&controller&&!fs.existsSync(dest));
const head='7c9434f1f202c00044f2edd6c7b3e331740b9960';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),sha=p=>hash(fs.readFileSync(p));
const oldManifest=path.join(old,'transfer-manifest.json');
assert.equal(sha(oldManifest),'8bba6c008ed0234c80dda912d6e5d4cadbe18b0ddba3ace98d347a3f27087bbc');
const prior=JSON.parse(fs.readFileSync(oldManifest));
for(const f of prior){assert.equal(fs.statSync(path.join(old,f.path)).size,f.size);assert.equal(sha(path.join(old,f.path)),f.sha256,f.path);}
assert.equal(sha(modulePath),'7fd02a77ec01e5e18065d112b1da434886a0dba3fcadd7ff043d1e2ddca41f33');
const tree=new Map(cp.execFileSync('git',['ls-tree','-r',head],{cwd:repo,encoding:'utf8',maxBuffer:8*1024**2}).trim().split('\n').map(line=>{const [meta,p]=line.split('\t');return[p,meta.split(' ')[2]]}));
fs.mkdirSync(dest);let copiedBytes=0,linkedFiles=0,sourceFiles=0;
function put(rel,bytes,source){const p=path.join(dest,rel);fs.mkdirSync(path.dirname(p),{recursive:true});if(source&&sha(source)===hash(bytes)){fs.linkSync(source,p);linkedFiles++;}else{fs.writeFileSync(p,bytes,{flag:'wx'});copiedBytes+=bytes.length;}}
for(const f of prior){
 if(['source-identity.json','controller.js'].includes(f.path))continue;
 const source=path.join(old,f.path),rel=f.path.replace(/^runtime\//,'');
 if(f.path==='runtime/build/wine-assembly.wasm'){put(f.path,fs.readFileSync(modulePath));continue;}
 if(f.path.startsWith('runtime/')&&tree.has(rel)){
  const bytes=cp.execFileSync('git',['cat-file','blob',tree.get(rel)],{cwd:repo,maxBuffer:32*1024**2});put(f.path,bytes,source);sourceFiles++;
 }else put(f.path,fs.readFileSync(source),source);
}
put('controller.js',fs.readFileSync(controller));
const identity={rootHead:head,wasmSha256:sha(modulePath),finishClicked:false,priorLicenceAccepted:true,gameLaunched:false,sourceFiles,previousManifestSha256:sha(oldManifest),nativeFixtureFiles:4,copiedBytes,linkedFiles,notes:'Existing original 433-file VFS, registry and native fixture identity retained. New source closure checked separately before runtime.'};
put('source-identity.json',Buffer.from(JSON.stringify(identity,null,2)+'\n'));
const entries=[];function walk(dir){for(const d of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,d.name);if(d.isDirectory())walk(p);else entries.push({path:path.relative(dest,p),size:fs.statSync(p).size,sha256:sha(p)});}}walk(dest);
fs.writeFileSync(path.join(dest,'transfer-manifest.json'),JSON.stringify(entries.sort((a,b)=>a.path.localeCompare(b.path)),null,2)+'\n',{flag:'wx'});
for(const f of prior)assert.equal(sha(path.join(old,f.path)),f.sha256,'old stage preserved: '+f.path);
console.log(JSON.stringify({dest,identity,files:entries.length,manifestSha256:sha(path.join(dest,'transfer-manifest.json')),copiedBytes,linkedFiles}));
