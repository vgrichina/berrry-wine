'use strict';
// Independent full production source acceptance; no guest, browser or compilation.
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),assert=require('assert');
const {createRequire}=require('module');
const repo=path.resolve(__dirname,'../..'),task=path.dirname(repo),out=path.join(task,'evidence');
const {VirtualFS}=require(path.join(repo,'lib/filesystem'));
const {APPS}=require(path.join(repo,'lib/apps'));
const {normalizeLazyFiles}=require(path.join(repo,'lib/app-files'));
const {stageGltron}=require(path.join(repo,'tools/stage-gltron-original'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const source=fs.readFileSync(path.join(repo,'host.js'),'utf8'),hashSource=fs.readFileSync(path.join(repo,'lib/watx-launcher.js'),'utf8');
const pins=JSON.parse(fs.readFileSync(path.join(out,'input-pins.json')));
assert.equal(hash(source),pins.sourcePins['host.js'].sha256);
assert.equal(hash(hashSource),pins.sourcePins['lib/watx-launcher.js'].sha256);
const receipt={candidate:pins.candidate,sourceSHA256:hash(source),hashSourceSHA256:hash(hashSource),groups:[],outcome:'RUNNING',runtime:false};
const save=()=>fs.writeFileSync(path.join(out,'independent-tests.json'),JSON.stringify(receipt,null,2)+'\n');
function hostFor(platform,options={}){
 const sandbox={console:{log(){},warn(){},error(){}},Uint8Array,ArrayBuffer,AbortController,URL,URLSearchParams,TextEncoder,TextDecoder,setTimeout,clearTimeout};
 if(platform==='node')sandbox.require=createRequire(path.join(repo,'host.js'));
 else {sandbox.window={};if(platform==='webcrypto')sandbox.crypto=options.crypto||crypto.webcrypto;}
 const context=vm.createContext(sandbox);
 if(sandbox.window)vm.runInContext(hashSource,context,{filename:'lib/watx-launcher.js'});
 vm.runInContext(source,context,{filename:'host.js'});
 const Host=vm.runInContext('WineAssembly',context),host=Object.create(Host.prototype);host._helpCtx={vfs:new VirtualFS()};
 return {Host,host,vfs:host._helpCtx.vfs};
}
function group(name,details={}){receipt.groups.push({name,result:'PASS',...details});save();}
const files=normalizeLazyFiles(APPS.gltron,APPS.gltron.files).files;
const original=f=>new Uint8Array(fs.readFileSync(path.join(task,'stage',f.url.slice('binaries/gltron-0.70/'.length))));
async function reject(platform,file,bytes,re){
 const {Host,host,vfs}=hostFor(platform);Host.fetchAssetBytes=async()=>{if(bytes instanceof Error)throw bytes;return bytes;};
 await assert.rejects(host.loadFiles([file],{required:true,concurrency:1}),re);
 assert(!vfs.files.has(file.vfsPath.toLowerCase()),'corrupt file mounted');
}
async function main(){
 // Same original 92-file inventory and same-size corrupt Lua oracle, unchanged bytes.
 assert.equal(files.length,92);assert.equal(files.reduce((n,f)=>n+f.size,0),4968893);
 const staged=stageGltron('/home/user/wine-assembly/scratch/usage-watch/gltron-original-win32-recovery-oct28/payload/extracted/app',path.join(task,'stage'));
 assert.equal(staged.files,92);assert.equal(staged.bytes,4968893);
 for(const platform of ['node','webcrypto','plain-http']){
  const {Host,host,vfs}=hostFor(platform);Host.fetchAssetBytes=async url=>original(files.find(f=>f.url===url));
  await host.loadFiles(files,{required:true,concurrency:1});
  for(const f of files){const mounted=vfs.files.get(f.vfsPath.toLowerCase());assert(mounted);assert.equal(hash(mounted.data),f.sha256);assert.equal(mounted.data.byteLength,f.size);}
  group(platform+':valid-originals',{files:92,bytes:4968893});
  for(const suffix of ['/gltron.exe','.dll','/art/classic/artpack.lua']){
   const f=files.find(f=>f.url.endsWith(suffix));assert(f,suffix);const bytes=original(f);bytes[0]^=1;
   await reject(platform,f,bytes,/SHA-256 mismatch/);group(platform+':corrupt:'+suffix);
  }
  const f=files.find(f=>f.url.endsWith('/art/classic/artpack.lua')),bytes=original(f);
  await reject(platform,f,bytes.subarray(0,bytes.length-1),/size mismatch/);
  const extended=new Uint8Array(bytes.length+1);extended.set(bytes);await reject(platform,f,extended,/size mismatch/);
  await reject(platform,f,new Error('HTTP 404'),/failed to load/);group(platform+':length-and-missing');
  for(const size of [-1,1.5,'1',NaN,Infinity,null])await reject(platform,{...f,size},bytes,/Invalid manifest size/);
  for(const sha256 of ['',null,123,'x'.repeat(64),'f'.repeat(63)])await reject(platform,{...f,sha256},bytes,/Invalid asset SHA-256/);
  group(platform+':malformed-declarations');
  for(const kind of ['Buffer','Uint8Array','subarray','ArrayBuffer']){
   const h=hostFor(platform);let data;
   if(kind==='Buffer')data=Buffer.from(bytes);
   if(kind==='Uint8Array')data=new Uint8Array(bytes);
   if(kind==='ArrayBuffer')data=bytes.slice().buffer;
   if(kind==='subarray'){const padded=new Uint8Array(bytes.length+16);padded.fill(253);padded.set(bytes,7);data=padded.subarray(7,7+bytes.length);}
   h.Host.fetchAssetBytes=async()=>data;await h.host.loadFiles([f],{required:true});
   const mounted=h.vfs.files.get(f.vfsPath.toLowerCase());assert(mounted);assert.equal(hash(new Uint8Array(mounted.data.buffer||mounted.data,mounted.data.byteOffset||0,mounted.data.byteLength)),f.sha256);
  }
  group(platform+':supported-byte-representations');
  const legacy=hostFor(platform);legacy.Host.fetchAssetBytes=async url=>{if(url==='absent')throw new Error('HTTP 404');return Uint8Array.from([42]);};
  await legacy.host.loadFiles(['legacy.bin',{url:'optional.bin',optional:true},{url:'absent',optional:true}],{required:true});
  assert.equal(legacy.vfs.files.get('c:\\legacy.bin').data[0],42);
  // Optional failures are swallowed by contract; independently assert bytes never mount.
  const opt=hostFor(platform);opt.Host.fetchAssetBytes=async()=>{const b=bytes.slice();b[0]^=1;return b;};
  await opt.host.loadFiles([{...f,loadMode:undefined,optional:true}],{required:true});assert(!opt.vfs.files.has(f.vfsPath.toLowerCase()));
  group(platform+':legacy-and-optional');
 }
 // Real WebCrypto snapshots bytes asynchronously. Mutate fetch-owned backing
 // bytes only while the actual production hashing promise remains pending.
 const f=files.find(f=>f.url.endsWith('/art/classic/artpack.lua')),bytes=original(f);let digestStarted=false,mutated=false;
 const native=crypto.webcrypto.subtle;
 const wrapped={subtle:{async digest(algorithm,input){digestStarted=true;const pending=native.digest(algorithm,input);input[0]^=1;mutated=true;return pending;}}};
 const h=hostFor('webcrypto',{crypto:wrapped});h.Host.fetchAssetBytes=async()=>bytes;
 let error=null;try{await h.host.loadFiles([f],{required:true});}catch(e){error=e.message;}
 const mounted=h.vfs.files.get(f.vfsPath.toLowerCase());
 receipt.asyncProbe={digestStarted,mutated,error,mounted:!!mounted,expectedSHA256:f.sha256,actualSHA256:hash(bytes),mountedSHA256:mounted?hash(mounted.data):null};save();
 assert(!mounted||hash(mounted.data)===f.sha256,'DEFECT: async hash verified snapshot then mounted changed corrupt bytes');
 group('async-verification-mount-ordering');receipt.outcome='PASS';save();
}
main().catch(e=>{receipt.outcome='REJECT';receipt.error=e.stack;save();console.error(e.stack);process.exitCode=1;});
