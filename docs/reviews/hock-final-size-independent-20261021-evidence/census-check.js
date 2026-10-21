'use strict';
const fs=require('fs'),cp=require('child_process'),path=require('path'),Module=require('module'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.join(__dirname,'repo');
const git=(...args)=>cp.execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024});
const read=p=>fs.existsSync(path.join(root,p))?fs.readFileSync(path.join(root,p),'utf8'):git('show','HEAD:'+p);
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
for(const p of ['tools/watx.js',...['compiler-parser.js','compiler-stages.js','compiler-codegen.js','compiler.js'].map(n=>'tools/watx-src/'+n)])
 assert.equal(sha(git('show','HEAD:'+p)),sha(fs.readFileSync(path.join(root,p))),'compiler exact candidate '+p);
const m=new Module(path.join(root,'tools/census-fixture.js'),module);
m.filename=path.join(root,'tools/census-fixture.js');m.paths=module.paths;
m._compile(read('tools/callback-ownership-census.js'),m.filename);
const files=git('ls-tree','-r','--name-only','HEAD').trim().split('\n').filter(p=>/^src\/[^/]+\.watx?$/.test(p)||/^[^/]+\.js$/.test(p)||/^lib\/.*\.js$/.test(p));
const sources=files.map(file=>({file,src:read(file)}));
const entries=m.exports.scanSources(sources),census=JSON.parse(read('tools/callback-ownership-census.json'));
const before=m.exports.check(entries,census),updates=[];
if(process.argv.includes('--correct-reviewed')){
 for(const entry of entries){
  const old=census.entries.find(x=>x.file===entry.file&&x.name===entry.name);
  assert(old,'no new boundary '+entry.name);
  if(JSON.stringify({...old,kind:undefined,reason:undefined,ownership:undefined})!==JSON.stringify(entry)){
   // Compare the actual pinned fields; property order is irrelevant.
   const changed=Object.keys(entry).filter(k=>JSON.stringify(old[k])!==JSON.stringify(entry[k]));
   if(!changed.length)continue;
   assert(['src/08-pe-loader.wat','src/09b-dispatch.wat','src/13-exports.wat'].includes(entry.file),'unrelated census change');
   updates.push({file:entry.file,name:entry.name,fields:changed,oldSha:old.sha256,newSha:entry.sha256});
   Object.assign(old,entry);
   old.reason='Final SIZE lifetime correction 2026-10-21: allocate and synchronize CACA003D; retain target/destruction-result cells until final WM_SIZE returns, then validate the invocation target and release once. ShowWindow retains prior visibility; placement/implicit creation select zero on destruction. Exact dispatcher source-slice fixture passes 156 cases and rejects baseline plus four mutants. Maintained actual-guest extensions and full runtime qualification are UNEXECUTED; other mixed-dispatch/private invocation-token lifetimes remain pending.';
  }
 }
 const show=census.entries.find(x=>x.file==='src/09a5-handlers-window.wat'&&x.reason.startsWith('Show-return correction'));
 assert(show);show.reason='Show-return frame construction unchanged. Prior visibility is captured for both ShowWindow results; placement/implicit creation use zero on destruction. Final WM_SIZE now returns through CACA003D before releasing the owned cells (2026-10-21 source-slice evidence; fresh actual-guest/runtime qualification pending). Other mixed-dispatch lifetimes and private invocation-token ownership remain pending.';
 fs.writeFileSync(path.join(root,'tools/callback-ownership-census.json'),JSON.stringify(census,null,2)+'\n');
}
const errors=m.exports.check(entries,census).concat(m.exports.checkNonlocalAPIs(sources,JSON.parse(read('src/api_table.json'))));
const result={files:files.length,boundaries:entries.length,before,updates,errors,sourceHashes:Object.fromEntries(sources.map(s=>[s.file,sha(s.src)]))};
fs.writeFileSync(path.join(__dirname,process.argv.includes('--correct-reviewed')?'census-correction.json':'census-validation.json'),JSON.stringify(result,null,2)+'\n');
assert.deepEqual(errors,[]);console.log(JSON.stringify({files:files.length,boundaries:entries.length,updates,errors},null,2));
