'use strict';
const Module=require('module'),path=require('path'),crypto=require('crypto'),fs=require('fs'),assert=require('assert');
const resource=require('./positiont-complete-resource.cjs'),{root,evidence}=resource;
const entry=process.argv[1]||'',rel=path.relative(root,entry);
console.error('READINESS_ARGV '+JSON.stringify({pid:process.pid,argv:process.argv}));
process.on('exit',exit=>console.error('READINESS_EXIT '+JSON.stringify({pid:process.pid,exit})));
if(rel==='tools/toyvm/bundle-browser.js')resource.phase('bundle');
if(rel==='tools/concat-wat.js')resource.phase('concat');
resource.admit(rel);
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const blob=b=>crypto.createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(evidence,'manifest.json'))),pins=new Map(manifest.map(r=>[r[0],r[1]]));
const toy=rel==='tools/toyvm/decode-diff.js'&&JSON.stringify(process.argv.slice(2))==='["--random=20000","--seed=12345"]';
if(toy){
 for(const [f,h] of manifest)if(f.endsWith('.js')&&(f.startsWith('tools/toyvm/')||f==='lib/compile-wat.js'))assert.equal(blob(fs.readFileSync(path.join(root,f))),h);
 assert(process.execArgv.length===0,'exact decoder flags');
 assert(process.env.NODE_OPTIONS.includes('--max-old-space-size=512'));
 console.error('READINESS_DECODER_PLAN '+JSON.stringify({makeVmCalls:1,simultaneouslyLiveArenas:1,pagesEach:676,aggregateBytes:44302336,heapMiB:512,timeoutSeconds:600,cpuSeconds:600,fileLimitBytes:524288,sourceBlob:pins.get(rel),memAvailable:fs.readFileSync('/proc/meminfo','utf8').match(/^MemAvailable:.*$/m)[0]}));
}
const originalLoad=Module._load,forbidden=/(?:^|\/)(?:build-compile-wat\.js|compile-src(?:\.js)?|render-helper(?:\.js)?|positiont-com-module(?:\.js)?)$/;
if(forbidden.test(entry))throw Error('READINESS: forbidden compilation/runtime entry');
let allowedBytes=null,compiled=null,memory=null,compileCount=0,memoryCount=0,instanceCount=0;
Module._load=function(request,parent,main){
 const resolved=Module._resolveFilename(request,parent,main);
 if(forbidden.test(resolved))throw Error('READINESS: forbidden compilation/runtime import');
 if(resolved.startsWith(root+'/')&&pins.has(path.relative(root,resolved)))assert.equal(blob(fs.readFileSync(resolved)),pins.get(path.relative(root,resolved)),'loaded source identity');
 const value=originalLoad.apply(this,arguments);
 if(resolved===path.join(root,'lib/compile-wat.js')&&!value.readinessGuard){
  const compile=value.compileWat;
  value.compileWat=async function(read,opts){
   assert(toy,'READINESS: full/default compilation forbidden');
   assert.deepEqual(opts,{files:['toyvm-tailcall.wat'],cacheKey:'toyvm:tailcall'});
   assert.equal(parent.filename,path.join(root,'tools/toyvm/vm.js'));
   assert.equal(allowedBytes,null);const source=read('toyvm-tailcall.wat');assert(source.length<8*1048576);
   const b=await compile.call(this,f=>{assert.equal(f,'toyvm-tailcall.wat');return source;},opts);
   assert(b.byteLength<8*1048576);allowedBytes=digest(b);
   console.error('READINESS_DECODER_MODULE '+JSON.stringify({sourceSha256:digest(source),moduleSha256:allowedBytes,moduleBytes:b.byteLength}));return b;
  };value.compileWatSnapshot=()=>{throw Error('READINESS: snapshot compilation forbidden');};value.readinessGuard=true;
 }
 if(resolved.endsWith('/tools/watx.js')&&!value.readinessGuard){
  const compile=value.compile;
  value.compile=function(source,vfs,options){
   if(typeof source!=='string'||source.length>262144||vfs.size!==0||!source.startsWith('(memory 8192 8192)\n')||source.includes('(include ')||(source.match(/\(func\s/g)||[]).length!==1||!source.endsWith('(func $noop (effects heap) (nop))\n(wasm-export "noop" $noop)\n'))throw Error('READINESS: full/unknown WATX compilation forbidden');
   const result=compile.apply(this,arguments);assert(result.wasmBinary.length<=8388608);
   console.error('READINESS_REGION_FRAGMENT '+JSON.stringify({sourceSha256:digest(source),moduleSha256:digest(result.wasmBinary),moduleBytes:result.wasmBinary.length,instantiated:false}));return result;
  };value.compileAsync=()=>{throw Error('READINESS: asynchronous compilation forbidden');};value.readinessGuard=true;
 }
 return value;
};
const native={};for(const k of ['Module','Instance','Memory','compile','compileStreaming','instantiate','instantiateStreaming']){native[k]=WebAssembly[k];WebAssembly[k]=function(){throw Error('READINESS: WebAssembly execution/allocation forbidden: '+k);};}
if(toy){
 WebAssembly.compile=async function(bytes){assert(allowedBytes&&digest(bytes)===allowedBytes,'READINESS: unknown module');assert.equal(++compileCount,1);compiled=await native.compile(bytes);return compiled;};
 WebAssembly.Memory=function(opts){assert(compiled);assert.deepEqual(opts,{initial:676,maximum:676});assert.equal(++memoryCount,1);memory=new native.Memory(opts);assert.equal(memory.buffer.byteLength,44302336);console.error('READINESS_DECODER_LIVE '+JSON.stringify({liveCount:memoryCount,aggregateBytes:memory.buffer.byteLength,processMemory:process.memoryUsage()}));return memory;};
 WebAssembly.instantiate=async function(mod,imports){assert.equal(mod,compiled);assert.equal(imports.host.memory,memory);assert.equal(++instanceCount,1);return native.instantiate(mod,imports);};
 process.on('exit',()=>console.error('READINESS_DECODER_COUNTS '+JSON.stringify({compileCount,memoryCount,instanceCount,aggregateBytes:memory?.buffer.byteLength||0})));
}
// Writes of combined.wat are checked before their materialized growth.
const open=fs.openSync,write=fs.writeSync,descriptors=new Set();
fs.openSync=function(file,flags,...args){const fd=open.call(this,file,flags,...args);if(typeof file==='string'&&file.startsWith(root+'/build/'))descriptors.add(fd);return fd;};
fs.writeSync=function(fd,data,...args){if(descriptors.has(fd))resource.admit('generated-write',(typeof data==='string'?Buffer.byteLength(data):data.byteLength)+786432);return write.call(this,fd,data,...args);};
