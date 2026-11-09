'use strict';
// Explicit current Q3 closure. Historical manifests and shared admission stay
// immutable. Every exception below names reviewed published bytes or this
// narrow migration; nothing discovers/accepts arbitrary provider drift.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const historical='scratch/runs/20261109-q3-relative-menu-native-progress-1415/runtime-pins.json.gz';
const historicalSHA='a6be3bee6fbf1c218a3982d8e991a44838abddc0a0b80c8bd4f45c3d6effe1dc';
const moduleVersion='q3-1475-published-5c8780318-f977ebf7c-v1';
const cpuCommit='5c8780318afbbe0e5a4e7c64190f2e0abde21cd0';
const custodyCommit='f977ebf7c28977d7d95eb404f43db2209d163dde';
const SELECTED=Object.freeze({sha256:'3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18',bytes:2186068});
const modules={
  'build/wine-assembly.wasm':{size:SELECTED.bytes,sha256:SELECTED.sha256},
  'build/wine-assembly.compat.wasm':{size:2188714,sha256:'ecb45716b1ee7fc5218b1670dd270b19c7664ee30d000b3360a12786a1c21eaf'}
};
const publishedProviders=Object.fromEntries([
  'host.js','lib/guest-thread-host.js','lib/guest-worker.js','lib/region-map.generated.js',
  'src/00-regions.wat','src/03-registers.wat','src/05b-string-ops.wat','src/13-exports.wat'
].map(name=>[name,cpuCommit]));
publishedProviders['tools/native_kernel_custody.py']=custodyCommit;
const migration={
  'tools/q3-startup.cjs':'215181583d550a38264b8ae7854101a5d2e7a71acf25dd487e78a203a5c3c1cb',
  'tools/q3-native-driver-composition.cjs':'61e0bbe3664bb30e28805813f3a9989284db199d9db998419599326d83dbbd30',
  'tools/q3-native-prelaunch.py':'2591af4d8222b727ae226898638ddb3016938474f7069c23e00815b6bf6a4dbc'
};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=n=>fs.readFileSync(path.join(root,n));
const pin=(name,b)=>({path:name,size:b.length,sha256:hash(b)});
const git=args=>cp.execFileSync('git',args,{cwd:root,maxBuffer:32*1024*1024});
function validate(){
  const raw=read(historical);assert.equal(hash(raw),historicalSHA,'historical pinset integrity');
  const prior=JSON.parse(zlib.gunzipSync(raw)),seen=new Set(),explainedDrift=[];
  for(const p of prior.files){assert(!seen.has(p.path),'duplicate historical pin');seen.add(p.path);}
  for(const commit of [cpuCommit,custodyCommit])for(const target of ['HEAD','origin/main'])git(['merge-base','--is-ancestor',commit,target]);
  const sources=git(['ls-tree','-r','--name-only',cpuCommit,'--','src','tools/watx-src','tools/watx.js','tools/watx-closure.js','tools/build-compile-wat.js']).toString().trim().split('\n');
  for(const name of sources)assert.equal(hash(read(name)),hash(git(['show',cpuCommit+':'+name])),'published build source: '+name);
  const expected={...modules};
  for(const [name,commit] of Object.entries(publishedProviders))expected[name]=pin(name,git(['show',commit+':'+name]));
  for(const [name,sha256] of Object.entries(migration)){
    assert.equal(hash(read(name)),sha256,'Q3 migration provider: '+name);expected[name]={sha256,size:read(name).length};
  }
  for(const name of Object.keys(expected))assert(seen.has(name),'replacement requires historical provider');
  const files=prior.files.filter(p=>!p.path.startsWith(path.dirname(historical)+'/')).map(p=>{
    const actual=pin(p.path,read(p.path)),want=expected[p.path]??p;
    assert.equal(actual.size,want.size,'provider size: '+p.path);assert.equal(actual.sha256,want.sha256,'provider SHA: '+p.path);
    if(expected[p.path])explainedDrift.push({before:p,after:actual,reason:modules[p.path]?'Published 5c8780318 CPU mirror build':publishedProviders[p.path]?'Exact published '+publishedProviders[p.path]:'1475 tested Q3 preparer/admission/custody migration'});
    return actual;
  });
  const httpPins=prior.httpPins.map(p=>{
    const before=prior.files.find(f=>f.path===p.url.slice(1)),after=files.find(f=>f.path===p.url.slice(1));
    assert(before&&after,'HTTP provider required');assert.equal(p.size,before.size,'historical HTTP size');assert.equal(p.sha256,before.sha256,'historical HTTP SHA');
    return {...p,size:after.size,sha256:after.sha256};
  });
  files.push(pin('tools/q3-current-module.cjs',read('tools/q3-current-module.cjs')));
  return {files,httpPins,moduleVersion,publishedModuleCommit:cpuCommit,publishedCustodyCommit:custodyCommit,historicalPinset:{path:historical,sha256:historicalSHA,commit:prior.commit},explainedDrift};
}
function prepare(destination,{inputs=[]}={}){
  assert.equal(arguments.length<=2,true);const options=arguments[1]??{};
  assert(Object.keys(options).every(k=>k==='inputs'),'explicit supported preparation options');
  destination=path.resolve(destination);assert(!fs.existsSync(destination),'fresh task-owned destination required');
  const version=validate();
  for(const name of inputs){
    assert(typeof name==='string'&&name.startsWith('scratch/runs/')&&name.endsWith('.py')&&!name.split('/').includes('..'),'small owned Python run input required');
    assert(path.resolve(root,name).startsWith(path.dirname(destination)+path.sep),'input must belong to destination parent');
    const b=read(name);assert(b.length<65536,'small run input only');assert(!version.files.some(p=>p.path===name),'duplicate input');version.files.push(pin(name,b));
  }
  version.files.sort((a,b)=>a.path.localeCompare(b.path));
  const pins={commit:git(['rev-parse','HEAD']).toString().trim(),...version};
  const raw=Buffer.from(JSON.stringify(pins,null,2));
  fs.mkdirSync(destination,{recursive:true});
  fs.writeFileSync(path.join(destination,'runtime-pins.json.gz'),zlib.gzipSync(raw),{flag:'wx',mode:0o444});
  const seal={moduleVersion,manifestSHA256:hash(raw),providers:pins.files.length,publishedModuleCommit:cpuCommit,publishedCustodyCommit:custodyCommit,historicalPinset:version.historicalPinset,explainedDrift:version.explainedDrift};
  fs.writeFileSync(path.join(destination,'replacement-pinset-seal.json'),JSON.stringify(seal,null,2),{flag:'wx',mode:0o444});
  return seal;
}
module.exports={SELECTED,validate,prepare,moduleVersion,historical,historicalSHA,cpuCommit,custodyCommit,migration};
if(require.main===module){assert.equal(process.argv[2],'--prepare','explicit preparation only');console.log(JSON.stringify(prepare(process.argv[3])));}
