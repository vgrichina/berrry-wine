'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),zlib=require('node:zlib');
// The current native composition stages only a launcher and exact provider pins.
// Git + small patches recover source; existing media/module paths are referenced.
if(process.argv[2]==='--native'){
 const [manifest,destination]=process.argv.slice(3),root=path.resolve(__dirname,'../..');
 if(!manifest||!destination||fs.existsSync(destination))throw Error('prior manifest and fresh native run directory required');
 const original=JSON.parse(fs.readFileSync(manifest)),files=new Map();
 for(const p of original.files){
  // Resolve symlinks as well as lexical paths before reading any provider.
  require('./staging').provider(root,p.path);
  if(p.path.startsWith('scratch/')&&!p.path.startsWith('scratch/runs/20261108-browser-journal-remote-service/'))continue;
  const b=fs.readFileSync(path.join(root,p.path)),digest=crypto.createHash('sha256').update(b).digest('hex');
  if(p.path.startsWith('test/binaries/')&&digest!==p.sha256)throw Error('original media drift '+p.path);
  files.set(p.path,{path:p.path,size:b.length,sha256:digest});
 }
 for(const n of ['startup.js','native-composition.js','renderer-identity.js','staging.js']){
  const rel='tools/warcraft3-prologue/'+n,b=fs.readFileSync(path.join(root,rel));files.set(rel,{path:rel,size:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')});
 }
 // Keep the published lineage/EXEC providers; pin the reviewed cancellation
 // scheduling repair separately so existing prepared runtimes stay immutable.
 const custodyCommit='4341b87723a7d56bc98223215cca4cdc878fcae2';
 const custodySha256='5ec810c4d4704ff86afc367b38f7335edf1214e3450ebb98a62ce3df6386b5fe';
 for(const rel of ['tools/native_kernel_custody.py','tools/native_custody_reaper.py','tools/native-startup-barrier.py']){
  const b=fs.readFileSync(path.join(root,rel)),published=cp.execFileSync('git',['show',custodyCommit+':'+rel],{cwd:root});
  if(rel==='tools/native_kernel_custody.py'?crypto.createHash('sha256').update(b).digest('hex')!==custodySha256:!b.equals(published))throw Error('published native custody drift '+rel);
  files.set(rel,{path:rel,size:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')});
 }
 new (require('node:vm').Script)(require('./native-composition').compose({root}));
 fs.mkdirSync(destination,{recursive:true});
 fs.writeFileSync(path.join(destination,'compose.cjs'),"require("+JSON.stringify(path.join(root,'tools/warcraft3-prologue/native-composition.js'))+").run(__dirname);\n",{flag:'wx'});
 const pins={...original,commit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),custodyCommit,custodySha256,files:[...files.values()]};
 pins.httpPins=(original.httpPins||[]).map(p=>{const row=files.get(p.url.slice(1));if(!row)throw Error('missing HTTP provider '+p.url);return {...p,size:row.size,sha256:row.sha256}});
 require('./staging').validate(root,pins.files);
 fs.writeFileSync(path.join(destination,'runtime-pins.json'),JSON.stringify(pins,null,2),{flag:'wx'});
 console.log(JSON.stringify({native:true,providers:files.size,sourceArchive:false,mediaCopied:false,destination}));
 process.exit(0);
}
const [prior,media,out,acceptedSource]=process.argv.slice(2);
if(!prior||!media||!out||!acceptedSource||fs.existsSync(out))throw Error('prior immutable runtime, original media, fresh output required');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const archive=path.join(prior,'baseline-runtime.tar.gz');
if(sha(fs.readFileSync(archive))!=='d5b52fc3829fbbc8e3ec2f085bdd55b074eda4bc55a7da6152577683f1b656c5')throw Error('accepted archive drift');
const b=zlib.gunzipSync(fs.readFileSync(archive)),base=new Map();
for(let at=0;at+512<=b.length;){const h=b.subarray(at,at+512);if(!h.some(Boolean))break;const str=(a,n)=>h.subarray(a,a+n).toString().replace(/\0.*$/s,'');const name=str(0,100).replace(/^\.\//,''),size=parseInt(str(124,12).trim()||'0',8);if(!Number.isSafeInteger(size))throw Error('tar size');if(str(156,1)==='0'||!str(156,1))base.set(name,b.subarray(at+512,at+512+size));at+=512+Math.ceil(size/512)*512;}
const pins=JSON.parse(base.get('browser-pins.json')),plan=JSON.parse(base.get('serve-plan.json'));
if(pins.referenceCommit!=='f62ab3c9f1223ab47cf623470f6343d508257878'||pins.module!=='4dc5ac2c477c71c64a42530562e4cf51e145bd966232e15330acfc01753d54de')throw Error('reference closure mismatch');
fs.mkdirSync(out,{recursive:true});const overlay=path.join(out,'overlay');fs.mkdirSync(overlay);
function write(root,n,data){const p=path.join(root,n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,data,{flag:'wx'});}
for(const f of pins.files){const data=base.get('source/'+f.path);if(!data||sha(data)!==f.sha256)throw Error('baseline pin '+f.path);const dest=path.join(out,'source',f.path),original=path.join(acceptedSource,f.path);fs.mkdirSync(path.dirname(dest),{recursive:true});if(!fs.existsSync(original)||sha(fs.readFileSync(original))!==f.sha256)throw Error('immutable hardlink source mismatch '+f.path);fs.linkSync(original,dest);}
const registry=base.get('source/lib/apps.js');const authenticated=cp.execFileSync('git',['show',pins.referenceCommit+':lib/apps.js']);if(!registry.equals(authenticated))throw Error('registry source mismatch');
const fixture='test/binaries/candidates/warcraft3-demo/';
const names=['War3Demo.exe','Game.dll','Storm.dll','Mss32.dll','ijl15.dll','war3.mpq','Maps/(4)Deadlock.w3m',...['Mssfast.m3d','Mssdolby.m3d','Msseax2.m3d','Mp3dec.asi','Reverb3.flt'].map(n=>'redist/miles/'+n)];
const expected={'War3Demo.exe': '4bfa825510527235c2a14f7682dba1d4b339664f312f85206f01206e98d8000a', 'Game.dll': '286823c37a1083e91f07d040e46a9df7af4c4952e01fcbba460589bd4e297654', 'Storm.dll': '99974ea6dab31eff68a6c22d259dd6d8abcab0b2947417b3b41ebf01ab366e61', 'war3.mpq': '9e19d7ffb65054e4bdd3add7e26d70e16f063cdc20fa5b57639f3b9b7a196f9c'};
const paths=names.map(n=>fixture+n),missing=paths.filter(n=>!fs.existsSync(path.join(media,n)));
if(missing.length)throw Error('Missing exact registered fixture paths: '+JSON.stringify(missing));
for(const n of paths){const original=path.join(media,n),data=fs.readFileSync(original),digest=sha(data);if(expected[n.slice(fixture.length)]&&expected[n.slice(fixture.length)]!==digest)throw Error('original media drift '+n);for(const root of [out,overlay]){const dest=path.join(root,'source',n);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.linkSync(original,dest);}pins.files.push({path:n,bytes:data.length,sha256:digest});plan.paths[n]='./source/'+n;plan.sourceHashes[n]=digest;}
for(const n of ['browser.js','backend.js','controls.js','assets.js','cleanup.js','lifecycle.js','renderer-identity.js','native-clock-process-proof.cjs','preflight.js','prepare.js']){const data=fs.readFileSync(path.join(__dirname,n==='native-clock-process-proof.cjs'?'../'+n:n));write(out,n,data);write(overlay,n,data);}
for(const [n,obj] of [['browser-pins.json',pins],['serve-plan.json',plan]])for(const root of [out,overlay])write(root,n,Buffer.from(JSON.stringify(obj,null,2)));
const identity={referenceCommit:pins.referenceCommit,module:pins.module,sourceImmutable:true,harness:Object.fromEntries(['browser.js','backend.js','controls.js','assets.js','cleanup.js','lifecycle.js','renderer-identity.js','native-clock-process-proof.cjs','preflight.js','prepare.js'].map(n=>[n,sha(fs.readFileSync(path.join(out,n)))])),scope:'Original accepted guest Worker; Warcraft III harness overlay only'};
for(const root of [out,overlay])write(root,'runtime-overlay.json',Buffer.from(JSON.stringify(identity,null,2)));
fs.linkSync(archive,path.join(out,'baseline-runtime.tar.gz'));
cp.execFileSync(process.execPath,[path.join(out,'preflight.js'),out],{stdio:'inherit'});
cp.execFileSync('tar',['czf',path.join(out,'observer-overlay.tar.gz'),'-C',overlay,'.']);
write(out,'prepared-identity.json',Buffer.from(JSON.stringify({reference:pins.referenceCommit,module:pins.module,pins:pins.files.length,originalExe:plan.sourceHashes[fixture+'War3Demo.exe'],media:Object.fromEntries(paths.map(n=>[n,plan.sourceHashes[n]])),baselineSha:sha(fs.readFileSync(archive)),overlaySha:sha(fs.readFileSync(path.join(out,'observer-overlay.tar.gz'))),scope:'Accepted unmodified baseline source/host/module; original registered Warcraft III fixture; scoped ordinary input harness; no passive exit overlay or production patch'},null,2)));
