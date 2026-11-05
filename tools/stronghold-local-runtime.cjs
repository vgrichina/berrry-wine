'use strict';
// Explicit local-process contract for the named connected original attempt.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const observer=require('./stronghold-owning-callback-observer.cjs');
const base=require('./stronghold-preset-driver-attachment.cjs');
const AUTH='stronghold-landed-startup-original-1135 user task';
const ASSIGNMENT=AUTH;
const CHROME='/opt/google/chrome/chrome';
const CUTOFF=Date.parse('2026-11-05T16:57:00Z'),CLEANUP=Date.parse('2026-11-05T17:00:00Z');
const ROOT=path.resolve(__dirname,'..');
const ORIGINAL_PINS='scratch/runs/20261104-stronghold-setup-transition-onward/runtime-pins.json';
const ORIGINAL_PINS_SHA='812aadea4a2b23a899919dc95b40b4d628a3836cedc0ae1e1844c966b284b7ef';
// Run-specific named amendments to published changes only. Every other row
// remains byte-bound to the immutable historical manifest.
const ACCEPTED=Object.freeze({
 "src/09aa-handlers-d3dim.wat": "c673c21b2bb671903d2d78440a24e1a3bca832f513429d6b30081724ffe321b6",
 "src/09ab-handlers-d3dim-core.wat": "283add545fac3497e6c7bf936b1726542c23215d538970eb63a6228132fbce18",
 "build/wine-assembly.wasm": "3859c274df0233659eb10fe4d2784fff7d1553242b4ae2b3bf653e5d2ebdd95b",
 "build/wine-assembly.compat.wasm": "9f042b70d7e43d3947415e1de01e7a540b3c7f7fa6c7fbefabdbea17e9633e95",
 "tools/stronghold-owning-callback-observer.cjs": "8493f2dfd26090b3dc638c44e790822d3c540c90b002594a27133ad32ce32c04",
 "tools/stronghold-native-preset-observer.cjs": "b991df4dc48d3cfe08582002ec51ffa3dcb03fd701fcf9e009aae9ce1f981911"
});
const PROVENANCE=Object.freeze({
 "src/09aa-handlers-d3dim.wat": "f1d62b136d7e3b7d7bb1a108774f5c804533e483",
 "src/09ab-handlers-d3dim-core.wat": "f1d62b136d7e3b7d7bb1a108774f5c804533e483",
 "build/wine-assembly.wasm": "f1d62b136d7e3b7d7bb1a108774f5c804533e483",
 "build/wine-assembly.compat.wasm": "f1d62b136d7e3b7d7bb1a108774f5c804533e483",
 "tools/stronghold-owning-callback-observer.cjs": "89caed5d1deeec73ea1c8538e8eb50f996b29496",
 "tools/stronghold-native-preset-observer.cjs": "89caed5d1deeec73ea1c8538e8eb50f996b29496"
});
function acceptedRuntimePins(original=fs.readFileSync(path.join(ROOT,ORIGINAL_PINS))){
 if(base.hash(original)!==ORIGINAL_PINS_SHA)throw Error('stale original runtime manifest');
 const pins=JSON.parse(original),amendments=[];
 const named={...ACCEPTED,'tools/stronghold-local-runtime.cjs':base.hash(fs.readFileSync(__filename))};
 const seen=new Set();
 pins.files=pins.files.map(row=>{
  if(seen.has(row.path))throw Error('duplicate runtime dependency');seen.add(row.path);
  const bytes=fs.readFileSync(path.join(ROOT,row.path)),actual=base.hash(bytes),expected=named[row.path]||row.sha256;
  if(actual!==expected)throw Error('unknown runtime dependency mismatch '+row.path);
  if(!named[row.path])return row;
  amendments.push({path:row.path,oldSHA256:row.sha256,newSHA256:expected,
   publishedProvenance:PROVENANCE[row.path]||'current authorized run-specific local contract',
   reason:row.path==='tools/stronghold-local-runtime.cjs'?'current assignment, finite host deadlines, exact predecessor FINAL releases and named dependency bindings only; all gameplay/observer guards unchanged':row.path.includes('observer.cjs')?'published passive native control state; pending/hover/activation/application/draw/presentation remain distinct':'published selective D3D7 state-block repair and its corresponding existing module pair'});
  return {...row,bytes:bytes.length,sha256:expected};
 });
 if(pins.files.length!==2429||amendments.length!==7||Object.keys(named).some(p=>!seen.has(p)))throw Error('complete original closure required');
 return {...pins,candidate:'named published D3D7 and passive control-state binding',runtimeBinding:{originalPinsSHA256:ORIGINAL_PINS_SHA,assignment:ASSIGNMENT,amendments}};
}
function verifyAcceptedRuntimePins(pins){
 const expected=acceptedRuntimePins();
 if(JSON.stringify(pins)!==JSON.stringify(expected))throw Error('stale or changed accepted runtime closure');
 return expected;
}
// Separate fresh binding: historical acceptedRuntimePins and original seal stay closed.
const FRESH_ACCEPTED=Object.freeze({
 "host.js": "ade4787cff4c10b5b712c7b5f431357f23d48390960211e5de2403edb6691de6",
 "lib/dll-loader.js": "466ea8225607ce517f6d106ec60d72bcade9412af350caccefd7a87940c76936",
 "lib/host-imports.js": "92fb9ef3a622e43c0dcdb1bebd056e44e6af037a2db1661ebd822fb04b67b523",
 "lib/region-map.generated.js": "04d99fa3c0f4d20b537094e001dc80ad8f04de4ad5b2b218bb4dbe5785409881",
 "lib/renderer.js": "4c24b83889a1ed49d390c5fc86630733eb7167942f26e526ecf35948704624b5",
 "src/00-regions.wat": "e6497e311b55c12fa4c3f5caa98b7f44f1374522d9b890430e9ac7c0afe9a5f6",
 "src/01-header.wat": "7f433425ea8491ef9dbd21e6bef553f802c67cb6edbe6be6076c18530f2e635b",
 "src/02-thread-table.wat": "4da5a4dc095358d9bceef725faa225326c5d25b84a1d2d6a416a1f1b910d218c",
 "src/04-cache.wat": "148195dabbf53b8edde7c1219e3c7ca690dc4e39ae60f3f49a278070d3ad5864",
 "src/05-alu.wat": "8c1ba6bf9a8d5c9905c5f61f131e8f08fa9f40ca27069f8ece4f553534f77e74",
 "src/05b-string-ops.wat": "a35dd675eb51e557efe9984b55dd81b8825a0bda7e706d06e8d1546920853dcb",
 "src/05c-seg16-ops.wat": "c19d454dd56356508c3bf2e7d3dba0a84af72bc62af2c61d94667820874f1361",
 "src/06b-core-handlers.wat": "f61cb5f6ad8f59222a61b702138dbb0cc515037d6325912238dd9b0e452be1dd",
 "src/07-decoder.wat": "7fe48a5f7f695893637b4a50d65e14f5becf7d7e4e3832118f8257a1d83d905c",
 "src/07b-loop-match.wat": "75bc35ce00e283cbdd2bbb1ad7a3c5b7f848255cd50d2116ca69fdceca8de386",
 "src/07c-block-exec.wat": "6b0b8304cf5adc1e3367aa3344b042deb251291d8696203e5cba251298754707",
 "src/07d-uop-engine.wat": "cc98d8e3a8668d0bf49a3efdfd5af3bd5b4e3e4c5082401c18b654a734adb848",
 "src/07e-uop-compiler.wat": "fa9153928ca68a04992f526cab69bdc25626a3c7daf092fad263519e7718f305",
 "src/08-pe-loader.wat": "b398edca212c7466eb46f36981969264a1f21f1337700140fe41094d3ce797df",
 "src/08b-dll-loader.wat": "f44354df5b9ea342e62428e4db3d6211f5eb41a799e3727719fa1a9cb1776694",
 "src/09a-handlers.wat": "5175a9f3c274dd817f7957be8dc9855be804cbe08f1e38599113a1f600bcadf2",
 "src/09a8-handlers-directx.wat": "e888572a429d90c58f61d2d57c5ef9b7c56981f3497ecfcc32df2b4fe1de833d",
 "src/09aa-handlers-d3dim.wat": "927cd022bb8b8408202baed418fe9fb3cfe05a592dbe7704ed7a3ce3e94097c3",
 "src/09ab-handlers-d3dim-core.wat": "cf40f9c84c480dd37103be1584e631eda19ab1edf578731ba952dceea31277e6",
 "src/09b-dispatch.wat": "0dba6b9df2156694052bc41282a7424635ff67cd4ca1a22eb3594bdd1b3c2cdc",
 "src/09b2-dispatch-table.generated.wat": "b1f4335ef6dc76cbb387c3e40b86eff5aa663ec9ad327ebcaff23e60618ae937",
 "src/11-seh.wat": "4fce9b30bc0bcc6e26a551e37a07af22b6c6aa1d2fb2c143a7bde6f279924b51",
 "src/13-exports.wat": "e77681e9ae20eab4e30369ecf94b97eae5d8f976aec4f12b23ab73d6c50dbd81",
 "tools/callback-ownership-census.json": "2087b545eefdeb57931946088676418cb9ca1277deac7f9fe736d02efa43d5c9",
 "build/wine-assembly.wasm": "bc4cabf7745ac4644c3d8cc1f5b70d798277c2a4525e3c665b98d08d6577894b",
 "build/wine-assembly.compat.wasm": "b1f38f1543731c349edaa5d2ae29e4ff0e42b82edd859ce7201de49f1ab278f7",
 "tools/stronghold-owning-callback-observer.cjs": "7216d60ef76932b79d2f82a9de993b2289b05b4646a1098cb6694bc51000453b",
 "tools/stronghold-native-preset-observer.cjs": "b991df4dc48d3cfe08582002ec51ffa3dcb03fd701fcf9e009aae9ce1f981911"
});
const FRESH_PROVENANCE=Object.freeze({
 "host.js": "23d773990dcedcdf2df551f1e105ec39f529a045",
 "lib/dll-loader.js": "dd0f27e878db016965e823ec920dc51ef3434ed6",
 "lib/host-imports.js": "23d773990dcedcdf2df551f1e105ec39f529a045",
 "lib/region-map.generated.js": "9ac81b952558a3bba20761bddc6e7c80df970fa2",
 "lib/renderer.js": "23d773990dcedcdf2df551f1e105ec39f529a045",
 "src/00-regions.wat": "9ac81b952558a3bba20761bddc6e7c80df970fa2",
 "src/01-header.wat": "dd0f27e878db016965e823ec920dc51ef3434ed6",
 "src/02-thread-table.wat": "3a38eed05553086ff39a530501b2962b5bc9bc6c",
 "src/04-cache.wat": "3a38eed05553086ff39a530501b2962b5bc9bc6c",
 "src/05-alu.wat": "3a38eed05553086ff39a530501b2962b5bc9bc6c",
 "src/05b-string-ops.wat": "b786b78da4660f2587a14ee4d68c14467ab8c170",
 "src/05c-seg16-ops.wat": "0265956f9fbb4a69be631594dc1c36da9dace9dd",
 "src/06b-core-handlers.wat": "3a38eed05553086ff39a530501b2962b5bc9bc6c",
 "src/07-decoder.wat": "3a38eed05553086ff39a530501b2962b5bc9bc6c",
 "src/07b-loop-match.wat": "3a38eed05553086ff39a530501b2962b5bc9bc6c",
 "src/07c-block-exec.wat": "3a38eed05553086ff39a530501b2962b5bc9bc6c",
 "src/07d-uop-engine.wat": "0265956f9fbb4a69be631594dc1c36da9dace9dd",
 "src/07e-uop-compiler.wat": "0265956f9fbb4a69be631594dc1c36da9dace9dd",
 "src/08-pe-loader.wat": "9ac81b952558a3bba20761bddc6e7c80df970fa2",
 "src/08b-dll-loader.wat": "e01a20635a7dedd7eedc2089537c63e3f23a013f",
 "src/09a-handlers.wat": "0265956f9fbb4a69be631594dc1c36da9dace9dd",
 "src/09a8-handlers-directx.wat": "03b16e2553ddbe7d879fea8524e9df479a97fa07",
 "src/09aa-handlers-d3dim.wat": "4683c73ca889ff4f84d809e2fb7fd3d06432f7c3",
 "src/09ab-handlers-d3dim-core.wat": "ba2782c125a5b4e497a07274be438709d619632e",
 "src/09b-dispatch.wat": "dd0f27e878db016965e823ec920dc51ef3434ed6",
 "src/09b2-dispatch-table.generated.wat": "dd0f27e878db016965e823ec920dc51ef3434ed6",
 "src/11-seh.wat": "b786b78da4660f2587a14ee4d68c14467ab8c170",
 "src/13-exports.wat": "dd0f27e878db016965e823ec920dc51ef3434ed6",
 "tools/callback-ownership-census.json": "3a38eed05553086ff39a530501b2962b5bc9bc6c",
 "build/wine-assembly.wasm": "current existing full-build module; validate full flock build before original",
 "build/wine-assembly.compat.wasm": "current existing full-build module; validate full flock build before original",
 "tools/stronghold-owning-callback-observer.cjs": "dd0f27e878db016965e823ec920dc51ef3434ed6",
 "tools/stronghold-native-preset-observer.cjs": "89caed5d1deeec73ea1c8538e8eb50f996b29496"
});
const FRESH_NEW_FILES=['test/test-stronghold-connected-runtime-binding.js'];
function freshSourceIdentity(files){
 const cp=require('node:child_process');
 const gitSHA=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();
 const relevant=files.map(r=>r.path).filter(p=>!p.startsWith('test/binaries/'));
 const diff=cp.execFileSync('git',['diff','--binary','HEAD','--',...relevant,...FRESH_NEW_FILES],{cwd:ROOT,maxBuffer:64*1024*1024});
 const ownedNewFilePatches=[];
 for(const file of FRESH_NEW_FILES){
  if(!fs.existsSync(path.join(ROOT,file)))throw Error('missing fresh contract source '+file);
  const tracked=cp.spawnSync('git',['ls-files','--error-unmatch','--',file],{cwd:ROOT,stdio:'pipe'});
  if(tracked.status===0)continue;
  const patch=cp.spawnSync('git',['diff','--no-index','--binary','--','/dev/null',file],{cwd:ROOT,maxBuffer:16*1024*1024});
  if(patch.error||patch.status!==1||!patch.stdout.length)throw Error('owned new-file source patch unavailable '+file);
  ownedNewFilePatches.push({path:file,patchSHA256:base.hash(patch.stdout)});
 }
 return {gitSHA,relevantDiffSHA256:base.hash(diff),ownedNewFilePatches};
}
function freshRuntimePins(){
 const original=fs.readFileSync(path.join(ROOT,ORIGINAL_PINS));
 if(base.hash(original)!==ORIGINAL_PINS_SHA)throw Error('stale original runtime manifest');
 const pins=JSON.parse(original),seen=new Set(),amendments=[];
 const named={...FRESH_ACCEPTED,'tools/stronghold-local-runtime.cjs':base.hash(fs.readFileSync(__filename))};
 pins.files=pins.files.map(row=>{
  if(seen.has(row.path))throw Error('duplicate fresh runtime dependency');seen.add(row.path);
  const bytes=fs.readFileSync(path.join(ROOT,row.path)),expected=named[row.path]||row.sha256;
  if(base.hash(bytes)!==expected)throw Error('unknown fresh runtime dependency mismatch '+row.path);
  if(named[row.path])amendments.push({path:row.path,oldSHA256:row.sha256,newSHA256:expected,
   publishedProvenance:FRESH_PROVENANCE[row.path]||'current authorized run-specific local contract'});
  return {...row,bytes:bytes.length,sha256:expected};
 });
 if(pins.files.length!==2429||Object.keys(named).some(p=>!seen.has(p)))throw Error('complete fresh original closure required');
 const sourceIdentity=freshSourceIdentity(pins.files);
 return {...pins,commit:sourceIdentity.gitSHA,candidate:'named landed-startup connected Stronghold original',
  freshRuntimeBinding:{assignment:AUTH,originalPinsSHA256:ORIGINAL_PINS_SHA,sourceIdentity,amendments}};
}
function verifyFreshRuntimePins(pins){
 if(JSON.stringify(pins)!==JSON.stringify(freshRuntimePins()))throw Error('stale or changed fresh runtime closure');
 return pins;
}
// Offline qualification records the current complete dependency closure. It
// deliberately cannot mint a launch release or amend either historical seal.
function offlineCoveragePins(){
 const original=fs.readFileSync(path.join(ROOT,ORIGINAL_PINS));
 if(base.hash(original)!==ORIGINAL_PINS_SHA)throw Error('stale original runtime manifest');
 const pins=JSON.parse(original),seen=new Set();
 const files=pins.files.map(row=>{
  if(seen.has(row.path))throw Error('duplicate offline dependency');seen.add(row.path);
  const bytes=fs.readFileSync(path.join(ROOT,row.path));
  return {...row,bytes:bytes.length,sha256:base.hash(bytes)};
 });
 if(files.length!==2429)throw Error('complete offline closure required');
 return {...pins,files,offlineCoverageBinding:{version:1,originalPinsSHA256:ORIGINAL_PINS_SHA,
  sourceIdentity:freshSourceIdentity(files),originalExecutionAuthorized:false}};
}
function verifyOfflineCoveragePins(pins){
 if(JSON.stringify(pins)!==JSON.stringify(offlineCoveragePins()))throw Error('stale or changed offline coverage closure');
 return pins;
}
// Image identity brackets the capture; only the complete owning transaction
// can describe setup progress. No screenshot identity grants classification.
function diagnosticScene(bytes,known,observation){
 if(known!=='unknown')return known;
 if(!observation||observation.status!=='proved-setup-in-progress'||
  observation.sha256!==base.hash(bytes)||observation.readinessGranted!==false||
  observation.pixelsAccepted!==false||observation.gameplay!==false)return known;
 const proof=observation.proof;
 if(!proof)return known;
 const joined=observer.joinCaptureTransaction(proof.nativeReport,proof.hostReport,proof.capture);
 if(joined.status!=='proved-setup-in-progress'||joined.sha256!==observation.sha256||
  joined.name!==observation.name||joined.steps!==observation.steps||joined.epoch!==observation.epoch||joined.command!==observation.command)return known;
 return 'setup-transition-observation';
}
const PREDECESSORS=Object.freeze([
 ['cpu-same-block-smc','cpu-same-block-smc-1120','same-block-self-modifying-code'],
 ['return-fire-worker-body-transport','return-fire-worker-body-transport-1020','return-fire-worker-body-transport'],
 ['lords2-recovered-original-gameplay','lords2-recovered-original-gameplay-1105','lords2-recovered-original-gameplay']
]);
function requireRuntimeRelease(board,now=Date.now()){
 const rows=board.split('\n'),dependencies=[];
 for(const [worker,assignment,note] of PREDECESSORS){
  const own=rows.filter(r=>r.split(/\s+/)[1]===worker&&r.split(/\s+/)[2]==='OWN').at(-1);
  const runtimeOwn=rows.filter(r=>r.split(/\s+/)[1]===worker&&(r.split(/\s+/).slice(2,5).join(' ')==='LOCAL HEAVY OWN'||r.includes(' LOCALHEAVY OWN '))).at(-1);
  const fileRelease=rows.filter(r=>{const p=r.split(/\s+/);return p[1]===worker&&p.slice(2,7).join(' ')==='FINAL runtime AND file RELEASE'&&p.includes('docs/re-notes/'+note+'-20261105.md')&&p.includes('ALLBUILDSFINISHED');}).at(-1);
  const ownedAt=Date.parse(own?.split(' ')[0]),runtimeOwnedAt=Date.parse((runtimeOwn||own)?.split(' ')[0]),releasedAt=Date.parse(fileRelease?.split(' ')[0]);
  if(!own||!fileRelease||![now,ownedAt,runtimeOwnedAt,releasedAt].every(Number.isFinite)||runtimeOwnedAt<Date.parse('2026-11-05T11:15:00Z')||releasedAt<ownedAt||releasedAt<runtimeOwnedAt||releasedAt>now||releasedAt>Date.parse('2026-11-05T17:00:00Z')||
     (dependencies.length&&(releasedAt<dependencies.at(-1).releasedAt||runtimeOwnedAt<dependencies.at(-1).releasedAt)))
   throw Error('exact '+assignment+' FINAL runtime and file release after current OWN, all builds finished required');
  dependencies.push({worker,assignment,own,ownedAt,runtimeOwn,runtimeOwnedAt,row:fileRelease,at:releasedAt,fileRelease,releasedAt});
 }
 return {dependencies,row:dependencies[0].row};
}
function requireLocalFlock(lockPath='/tmp/wine-local-runtime.lock'){
 const ancestors=new Set();
 for(let pid=process.pid;pid>1&&!ancestors.has(pid);){ancestors.add(pid);const s=fs.readFileSync('/proc/'+pid+'/stat','utf8');pid=Number(s.slice(s.lastIndexOf(')')+2).split(' ')[1]);}
 const target=fs.statSync(lockPath),dev=BigInt(target.dev),major=((dev>>8n)&0xfffn)|((dev>>32n)&0xfffff000n),minor=(dev&0xffn)|((dev>>12n)&0xffffff00n);
 for(const row of fs.readFileSync('/proc/locks','utf8').trim().split('\n')){
  const p=row.trim().split(/\s+/),d=p[5]?.split(':'),pid=Number(p[4]);
  if(p[1]!=='FLOCK'||p[3]!=='WRITE'||!ancestors.has(pid)||d?.[2]!==String(target.ino)||BigInt('0x'+d[0])!==major||BigInt('0x'+d[1])!==minor)continue;
  for(const fd of fs.readdirSync('/proc/'+pid+'/fd')){try{const held=fs.statSync('/proc/'+pid+'/fd/'+fd);if(held.dev===target.dev&&held.ino===target.ino)return {pid,fd,path:lockPath};}catch{}}
 }
 throw Error('required local flock must be held by this process or its ancestor');
}
function requireBuildReleases(board,now=Date.now()){
 return requireRuntimeRelease(board,now).dependencies;
}
function assertRuntimeOwnership(){const board=fs.readFileSync('messageboard.txt','utf8');return {release:requireRuntimeRelease(board),buildReleases:requireBuildReleases(board),flock:requireLocalFlock()};}
function identity(){
 const stat=fs.readFileSync('/proc/self/stat','utf8');
 return {hostname:os.hostname(),bootId:fs.readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim(),
  pid:process.pid,startTicks:stat.slice(stat.lastIndexOf(')')+2).split(' ')[19],uid:process.getuid(),
  root:fs.realpathSync(process.cwd()),executable:fs.realpathSync(process.execPath)};
}
const lifecycles=new Map();
function install(run){
 run=fs.realpathSync(run);
 if(lifecycles.has(run))throw Error('one installed lifecycle per run');
 const cp=require('node:child_process'),spawn=cp.spawn;
 const file=path.join(run,'chrome-lifecycle.jsonl');fs.writeFileSync(file,'',{flag:'wx'});
 const record=(kind,data={})=>fs.appendFileSync(file,JSON.stringify({at:new Date().toISOString(),kind,...data})+'\n');
 const children=[];
 function observed(command,args,...rest){
  const child=Reflect.apply(spawn,this,[command,args,...rest]);
  if(command!==CHROME||!args?.includes('--user-data-dir='+path.join(run,'chrome-profile')))return child;
  let startTicks=null;try{const s=fs.readFileSync('/proc/'+child.pid+'/stat','utf8');startTicks=s.slice(s.lastIndexOf(')')+2).split(' ')[19];}catch{}
  children.push(child);record('spawn',{pid:child.pid,startTicks,command,args});
  child.once('exit',(code,signal)=>record('actual-exit',{pid:child.pid,startTicks,code,signal}));
  child.once('error',e=>record('spawn-error',{error:String(e)}));return child;
 }
 cp.spawn=observed;
 const tap={record,children,restore(){if(cp.spawn===observed)cp.spawn=spawn;lifecycles.delete(run);record('recorder-restored');}};
 lifecycles.set(run,tap);record('installed',{identity:identity()});return tap;
}
function lifecycleForRun(run){const tap=lifecycles.get(path.resolve(run));if(!tap)throw Error('owned lifecycle recorder not installed');return tap;}
async function launchOwned(puppeteer,tap,options){
 tap.record('launch-request',{executablePath:options.executablePath,profile:options.userDataDir});
 const browser=await puppeteer.launch(options);
 if(tap.children.length!==1||tap.children[0]!==browser.process())throw Error('exactly one owned Chrome child required');
 tap.record('launch-returned',{pid:browser.process().pid});return browser;
}
function binding(run,pins){
 const manifest=JSON.parse(fs.readFileSync(pins));
 if(manifest.offlineCoverageBinding)throw Error('offline coverage closure cannot authorize original execution');
 if(manifest.freshRuntimeBinding)verifyFreshRuntimePins(manifest);
 else if(manifest.runtimeBinding)verifyAcceptedRuntimePins(manifest);
 const modules=['build/wine-assembly.wasm','build/wine-assembly.compat.wasm'].map(file=>{
  const rows=manifest.files.filter(x=>x.path===file);if(rows.length!==1)throw Error('both candidate module pins required');
  const sha256=base.hash(fs.readFileSync(file));if(sha256!==rows[0].sha256||sha256!==(manifest.freshRuntimeBinding?FRESH_ACCEPTED:ACCEPTED)[file])throw Error('candidate module mismatch');return {path:file,sha256};
 });
 return {run:path.resolve(run),pins:path.resolve(pins),pinsSHA256:base.hash(fs.readFileSync(pins)),modules};
}
function validateRelease(release,{run,pins,nonce,now=Date.now()}={}){
 if(release?.version!==1||release.kind!=='local-process'||release.boxId!==undefined||release.expiry!==undefined)
  throw Error('explicit local contract required; no leased box identity');
 if(release.authorization!==AUTH||release.assignment!==ASSIGNMENT||release.freshLocalDiagnosticAuthorized!==true||release.shutdownOwner!=='coordinator')
  throw Error('original and current local authorization required');
 if(!/^[a-f0-9]{64}$/.test(nonce||'')||release.nonce!==nonce)throw Error('fresh exact process nonce required');
 if(JSON.stringify(release.identity)!==JSON.stringify(identity()))throw Error('foreign host/process identity');
 if(JSON.stringify(release.binding)!==JSON.stringify(binding(run,pins)))throw Error('foreign/stale run or candidate binding');
 const {issuedAt,closeBy,expiresAt,chromeCutoff,cleanupBy}=release;
 if(![now,issuedAt,closeBy,expiresAt,chromeCutoff,cleanupBy].every(Number.isFinite)||issuedAt>now||now-issuedAt>60000||
    closeBy<=now||closeBy>issuedAt+720000||expiresAt!==cleanupBy||chromeCutoff>CUTOFF||cleanupBy>CLEANUP||
    issuedAt+720000>chromeCutoff||issuedAt+900000>cleanupBy||closeBy>chromeCutoff||expiresAt<=now)
  throw Error('fresh finite local deadline and cleanup reserve required');
 return release;
}
function createRelease({run,pins,nonce,now=Date.now()}){
 const release={version:1,kind:'local-process',authorization:AUTH,assignment:ASSIGNMENT,
  freshLocalDiagnosticAuthorized:true,shutdownOwner:'coordinator',nonce,identity:identity(),binding:binding(run,pins),
  issuedAt:now,closeBy:now+720000,expiresAt:CLEANUP,chromeCutoff:CUTOFF,cleanupBy:CLEANUP};
 return validateRelease(release,{run,pins,nonce,now});
}
// Request normal Chrome shutdown directly and observe the actual child exit.
// Puppeteer's browser.close may fall back to killing its process; that cannot
// establish normal closure. This helper sends no process signal.
async function normalClose(browser,{timeoutMs=60000,record=()=>{}}={}){
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>180000)throw Error('finite normal closure reserve required');
 const child=browser.process();if(!child)throw Error('owned Chrome process required');
 const stat=fs.readFileSync('/proc/'+child.pid+'/stat','utf8'),startTicks=stat.slice(stat.lastIndexOf(')')+2).split(' ')[19];
 let timer,listener;
 const exit=new Promise((resolve,reject)=>{
  listener=(code,signal)=>resolve({pid:child.pid,code,signal});
  if(child.exitCode!==null||child.signalCode!==null)listener(child.exitCode,child.signalCode);
  else child.once('exit',listener);
  timer=setTimeout(()=>reject(Error('normal Chrome exit deadline; closure unproved')),timeoutMs);
 });
 try{
  record({kind:'normal-close-request',pid:child.pid,startTicks});
  const request=(async()=>{const session=await browser.target().createCDPSession();await session.send('Browser.close');})();
  // Closing the connection may reject the command before the process exits.
  request.catch(error=>record({kind:'normal-close-protocol-result',error:String(error)}));
  const result=await exit;record({kind:'actual-chrome-exit',...result,startTicks});
  if(result.code!==0||result.signal!==null)throw Error('abnormal Chrome exit '+JSON.stringify(result));
  return result;
 }finally{clearTimeout(timer);child.removeListener('exit',listener);browser.disconnect();}
}
// Operator-side status only. A capture/review request is never an acceptance
// receipt. Keep the next command out of the mailbox until the previous ACK;
// in particular title-enter requests both a title and a resulting-menu review.
function mailboxStatus(run,{now=Date.now()}={}){
 const out=path.join(path.resolve(run),'browser'),read=name=>{
  const file=path.join(out,name);return fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):null;
 };
 const indices=fs.readdirSync(path.join(out,'commands')).filter(n=>/^\d+\.json$/.test(n)).map(n=>Number(n.slice(0,-5))).sort((a,b)=>a-b);
 if(indices.some((n,i)=>n!==i))throw Error('contiguous original mailbox required');
 const replies=indices.map(i=>({i,reply:read('reply-'+i+'.json')}));
 const pending=replies.filter(r=>!r.reply).map(r=>r.i),failed=replies.find(r=>r.reply?.ok!==true&&r.reply);
 const request=read('review-required.json');let review=null;
 if(request){
  if(!/^[a-f0-9]{64}$/.test(request.sha256||'')||!/^[a-zA-Z0-9-]+$/.test(request.requestId||''))throw Error('invalid original review request');
  const command=Number.isInteger(request.commandIndex)?read('commands/'+request.commandIndex+'.json'):null;
  // Frozen captures can be byte-identical across commands. Display the newest
  // matching capture, so an earlier startup image cannot hide the title review.
  const capture=fs.readdirSync(out).filter(n=>n.endsWith('.png'))
   .map(name=>({name,mtime:fs.statSync(path.join(out,name)).mtimeMs}))
   .sort((a,b)=>b.mtime-a.mtime||b.name.localeCompare(a.name))
   .find(({name})=>base.hash(fs.readFileSync(path.join(out,name)))===request.sha256)?.name||null;
  review={...request,capture,receiptPresent:fs.existsSync(path.join(run,'reviews',request.requestId+'.json')),
   remainingMs:command?Math.max(0,command.replyDeadline*1000-now):null};
 }
 return {nextIndex:indices.length,pending,review,ready:!!read('ready.json'),
  terminal:read('cleanup.json')||read('bootstrap-failure.json')||failed?.reply||null};
}
function validateCaptureCommand(command,out){
 if(!['observe','shot'].includes(command?.action))return;
 if(typeof command.name!=='string'||!/^[a-z0-9-]+$/.test(command.name)||fs.existsSync(path.join(out,command.name+'.png')))
  throw Error('fresh capture name required before execution');
}
function assertMailboxCommandReady(run,options){
 const status=mailboxStatus(run,options);
 const detail=status.review?'; review '+status.review.scene+' '+(status.review.capture||status.review.sha256)+' receiptPresent='+status.review.receiptPresent:'';
 if(status.terminal||status.pending.length||!status.ready)throw Error('original mailbox not ready: '+
  (status.terminal?'terminal':status.pending.length?'pending command '+status.pending.join(','):'bootstrap')+detail);
 if(options?.command)validateCaptureCommand(options.command,path.join(path.resolve(run),'browser'));
 return status.nextIndex;
}
// Operator plan only: no writes or game controls. A review receipt is not an
// ACK, and a rejected ACK is terminal even if its capture was reviewed.
function nextMailboxAction(status,command){
 if(status.terminal)return {kind:'stop',reason:'terminal'};
 if(status.review&&!status.review.receiptPresent)return {kind:'personally-view-and-review',capture:status.review.capture};
 if(status.pending.length)return {kind:'wait-for-ack',indices:status.pending};
 if(!status.ready)return {kind:'wait-for-bootstrap'};
 return {kind:'submit-existing-command',command};
}
function prepare(options){
 const manifest=JSON.parse(fs.readFileSync(options.pins));
 if(manifest.offlineCoverageBinding)verifyOfflineCoveragePins(manifest);
 else if(manifest.freshRuntimeBinding)verifyFreshRuntimePins(manifest);
 else if(manifest.runtimeBinding)verifyAcceptedRuntimePins(manifest);
 const p=observer.prepare(options),q=JSON.stringify;
 p.source=base.replaceOnce(p.source,'const presetAttachment=attachmentAPI.createAttachment({sessions,save,log,pageState:state,validateAck:assertAck,',
  `const hostPresentation=require(${q(__filename)}).createHostPresentationController({page:()=>page,save,deadline:()=>deadline});\nconst presetAttachment=attachmentAPI.createAttachment({hostPresentation,sessions,save,log,pageState:state,validateAck:assertAck,`);
 p.source=base.replaceOnce(p.source,'const png=Buffer.from(await page.screenshot()),current=await state();',
  'const presentationBefore=await hostPresentation.captureToken();\n  const png=Buffer.from(await page.screenshot()),current=await state();\n  const hostCapture=await hostPresentation.capture(presentationBefore,sha(png),name);');
 p.source=base.replaceOnce(p.source,'await presetAttachment.capture(name,sha(png),current);return {png,state:current};',
  'const nativeObservation=await presetAttachment.capture(name,sha(png),current,hostCapture);return {png,state:current,nativeObservation};');
 // Check the passive page observer before any later command, step or mouse
 // delivery. The synchronous latch also covers reviews and commandLive calls.
 p.source=base.replaceOnce(p.source,'function commandLive(){presetAttachment.assertLive();',
  'function commandLive(){hostPresentation.assertLive();presetAttachment.assertLive();');
 p.source=base.replaceOnce(p.source,'await presetAttachment.begin(c,i);',
  "if(c.action!=='quit')await hostPresentation.check();await presetAttachment.begin(c,i);");
 p.source=base.replaceOnce(p.source,'if(stepping)await presetAttachment.beforeStep();',
  'if(stepping){await hostPresentation.check();await presetAttachment.beforeStep();}');
 p.source=base.replaceOnce(p.source,'p.mouse[action]=async(...args)=>{const result=await original(...args);',
  'p.mouse[action]=async(...args)=>{await hostPresentation.check();const result=await original(...args);');
 p.route=base.replaceOnce(p.route,'scene:scene(c.png)',`scene:require(${q(__filename)}).diagnosticScene(c.png,scene(c.png),c.nativeObservation)`);
 p.route=base.replaceOnce(p.route,"['choose-type-custom-hover','actual-scene20-earlier','actual-scene20-intermediate']",
  "['choose-type-custom-hover','actual-scene20-earlier','actual-scene20-intermediate','setup-transition-observation']");
 p.evidence.setupTransitionDiagnostic={basis:'continuous Stronghold owner/cycle/selected-copy/publication/capture transaction',
  exactPixels:false,observationOnly:true,readinessGranted:false,pixelsAccepted:false,gameplay:false,arrivalAndObserverCapsUnchanged:true};
 p.source=base.replaceOnce(p.source,"  if(c.action==='observe'){",
  `  if(c.action==='observe'){\n    require(${q(__filename)}).validateCaptureCommand(c,OUT);`);
 p.source=base.replaceOnce(p.source,"  if(c.action==='shot'){",
  `  if(c.action==='shot'){\n    require(${q(__filename)}).validateCaptureCommand(c,OUT);`);
 const old="  if(release.authorization!=='stronghold-split-gesture-reviews user task'||release.shutdownOwner!=='coordinator'||!release.boxId||!Number.isFinite(Date.parse(release.expiry))||Date.parse(release.expiry)<Date.now()+600000)throw Error('fresh authorized finite TTL required');\n  if(!Number.isFinite(Date.parse(release.closeBy))||Date.parse(release.closeBy)<=Date.now()||Date.parse(release.closeBy)>Date.parse(release.expiry)-300000)throw Error('fresh bounded closeBy required');";
 const nonce=crypto.randomBytes(32).toString('hex');
 p.source=base.replaceOnce(p.source,old,`  require(${q(__filename)}).validateRelease(release,{run:RUN,pins:${q(options.pins)},nonce:${q(nonce)}});\n  const runtimeOwnership=require(${q(__filename)}).assertRuntimeOwnership();`);
 p.source=base.replaceOnce(p.source,"fs.mkdirSync(OUT);fs.mkdirSync(path.join(OUT,'commands'));",
  `fs.mkdirSync(OUT);fs.mkdirSync(path.join(OUT,'commands'));\n  save('runtime-ownership.json',runtimeOwnership);\n  require(${q(__filename)}).install(RUN);`);
 p.source=base.replaceOnce(p.source,'browser=await puppeteer.launch(',`browser=await require(${q(__filename)}).launchOwned(puppeteer,require(${q(__filename)}).lifecycleForRun(RUN),`);
 p.source=base.replaceOnce(p.source,'Date.parse(release.closeBy)','release.closeBy');
 p.source=base.replaceOnce(p.source,"executablePath:'/usr/bin/google-chrome'",`executablePath:${q(CHROME)}`);
 p.source=base.replaceOnce(p.source,'let browser,page,server,closing=false,halted=false,number=0,timer,deadline;',
  'let browser,page,server,closing=false,halted=false,number=0,timer,deadline,bootstrapTimer;');
 p.source=base.replaceOnce(p.source,'if(closing)return;closing=true;clearTimeout(timer);','if(closing)return;closing=true;clearTimeout(timer);clearTimeout(bootstrapTimer);');
 p.source=base.replaceOnce(p.source,"if(browser)await browser.close().catch(e=>log('cleanup-errors.jsonl',{error:String(e)}));",
  `if(browser)await require(${q(__filename)}).normalClose(browser,{record:r=>log('chrome-normal-closure.jsonl',r)}).catch(e=>log('cleanup-errors.jsonl',{error:String(e)}));`);
 p.source=base.replaceOnce(p.source,'deadline=Math.min(Date.now()+360000,release.closeBy);',
  'deadline=Math.min(Date.now()+720000,release.closeBy);const bootstrapDeadline=Math.min(Date.now()+60000,deadline);');
 p.source=base.replaceOnce(p.source,"  page=await browser.newPage();", "  bootstrapTimer=setTimeout(()=>boundary.close(()=>close('bounded 60s bootstrap deadline')),Math.max(0,bootstrapDeadline-Date.now()));\n  page=await browser.newPage();");
 p.source=base.replaceOnce(p.source,"  save('ready.json',await state());", "  clearTimeout(bootstrapTimer);\n  save('ready.json',await state());");
 p.source=base.replaceOnce(p.source,"  await page.screenshot({path:path.join(OUT,'selector-before-launch.png')});",
  "  const selectorPNG=await page.screenshot({path:path.join(OUT,'selector-before-launch.png')});\n  activeCommand='bootstrap-selector';activeReplyDeadline=Math.min(Date.now()+40000,bootstrapDeadline);\n  await personalReview({sha256:sha(selectorPNG),scene:'registered-selector',state:await state()});");
 p.evidence.bounds.chromeMs=720000;
 p.evidence.localRuntime={kind:'local-process',contractPath:__filename,contractSHA256:base.hash(fs.readFileSync(__filename)),
  navigationAndCommandCapsUnchanged:true,chrome:CHROME,chromeCutoff:CUTOFF,cleanupBy:CLEANUP};
 p.evidence.hostPresentation={passive:true,normalCallsOnly:true,endpointSlot:0,maxRecords:2048,maxBytes:1048576,
  operationToUpload:'unknown without unique cross-realm RPC identity',readinessGranted:false,pixelsAccepted:false};
 p.evidence.compositionSHA256=base.hash(p.source);
 p.evidence.routeCompositionSHA256=base.hash(p.route);
 return {...p,createRelease:()=>createRelease({run:options.run,pins:options.pins,nonce})};
}
function createHostPresentationController({page,save,deadline}){
 let active=false,sequence=0,fatal=null;
 const persist=r=>{save('host-presentation-'+sequence+++'.json',r);return r;};
 const assertLive=()=>{if(fatal)throw fatal;};
 const evaluate=source=>page().evaluate(source);
 function reject(report){
  if(!fatal){fatal=Error('host presentation terminal: '+(report?.fault||report?.status||'missing report'));persist(report||{status:'unsupported-or-unobservable',fault:'missing host presentation report',readinessGranted:false,pixelsAccepted:false});}
  throw fatal;
 }
 function running(report){if(!report||report.status!=='running'||report.fault)reject(report);return report;}
 async function read(source,token=false){
  assertLive();
  try{const value=await evaluate(source);running(token?value.report:value);return value;}
  catch(e){if(fatal)throw fatal;reject({status:'unsupported-or-unobservable',fault:String(e.message||e),history:'unknown; retain last host reports',readinessGranted:false,pixelsAccepted:false});}
 }
 const check=async()=>{assertLive();return active?read('globalThis.__strongholdHostPresentation.check()'):null;};
 const token=async()=>{
  assertLive();if(!active)return null;
  const value=await read('(()=>{const h=globalThis.__strongholdHostPresentation;const token=h.token();return {token,report:h.check()};})()',true);
  return value.token;
 };
 return {
  assertLive,check,token,
  async start(epoch,nativeBinding){
   assertLive();if(active)throw Error('occupied host presentation');
   const source='('+observer.hostPresentationFactory.toString()+')()';
   await read(`(()=>{if(globalThis.__strongholdHostPresentation)throw Error('occupied host presentation');
    globalThis.__strongholdHostPresentation=${source}.attach({getHost:()=>typeof wine==='undefined'?null:wine,
     nativeBinding:${JSON.stringify(nativeBinding)},epoch:${JSON.stringify(epoch)},deadline:performance.now()+${JSON.stringify(deadline())}-Date.now()});return globalThis.__strongholdHostPresentation.check();})()`);
   active=true;
  },
  // Before an ordinary produced frame, screenshots remain unbracketed. The
  // factory still rejects any direct frame-zero capture and every stale token.
  async captureToken(){const before=await token();return before?.frame?before:null;},
  async capture(before,sha256,name){
   assertLive();if(!active)return;
   if(before===null){const report=await check();persist({...report,captureDeferred:true,name,sha256,reason:'no ordinary produced frame before screenshot'});return;}
   return persist(await read(`globalThis.__strongholdHostPresentation.capture(${JSON.stringify(before)},${JSON.stringify(sha256)},${JSON.stringify(name)})`));
  },
  async link(nativeReport,capture){assertLive();if(!active)return null;const host=await check();
   const joined=observer.joinCaptureTransaction(nativeReport,host,capture);
   persist({nativeEpoch:nativeReport?.epoch,host,link:joined});return joined;
  },
  // Cleanup preserves the earliest latched fault. It cannot revive or replace
  // the terminal report, and it must still release any remaining page hooks.
  async finish(reason='terminal'){
   if(!active)return;active=false;let value;
   try{value=await evaluate(`(()=>{const h=globalThis.__strongholdHostPresentation;const before={...h.check()};return {before,report:h.finish(${JSON.stringify(reason)})};})()`);}
   catch(e){if(fatal)throw fatal;reject({status:'unsupported-or-unobservable',fault:String(e.message||e),history:'unknown; retain last host reports',readinessGranted:false,pixelsAccepted:false});}
   if(!fatal)running(value.before);
   persist(value.report);
  }
 };
}
module.exports={offlineCoveragePins,verifyOfflineCoveragePins,freshRuntimePins,verifyFreshRuntimePins,freshSourceIdentity,FRESH_ACCEPTED,FRESH_PROVENANCE,acceptedRuntimePins,verifyAcceptedRuntimePins,ACCEPTED,ORIGINAL_PINS_SHA,identity,install,lifecycleForRun,launchOwned,binding,validateRelease,createRelease,requireRuntimeRelease,requireBuildReleases,requireLocalFlock,assertRuntimeOwnership,validateCaptureCommand,normalClose,mailboxStatus,assertMailboxCommandReady,nextMailboxAction,diagnosticScene,prepare,createHostPresentationController,AUTH,ASSIGNMENT,CUTOFF,CLEANUP};
