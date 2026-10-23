'use strict';
// Mandatory native toy exception only; all full/source compiler routes denied.
const M=require('module'),fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process'),assert=require('assert');
const H=__dirname,R=path.resolve(H,'../../..');
const manifest=JSON.parse(fs.readFileSync(path.join(H,'phase-manifest.json')));
const pins=new Map(manifest.rows.map(r=>[r.path,r]));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const rel=path.relative(R,process.argv[1]||'');
function deny(x){throw Error('READINESS FORBIDDEN '+x);}
function py(...args){cp.execFileSync('/usr/bin/python3',[path.join(H,'readiness.py'),...args],{stdio:['ignore','inherit','inherit'],env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});}
const forbidden=/(?:^|\/)(?:build-compile-wat|compile-src|render-helper)(?:\.js)?$/;
if(forbidden.test(rel))deny('full compiler entrypoint');
if(rel==='tools/toyvm/bundle-browser.js')py('--phase','bundle');
if(rel==='tools/esp-epilogue.js')py('--phase','late');
py('--admit',rel);
console.error('READINESS_ARGV '+JSON.stringify(process.argv));
process.on('exit',code=>console.error('READINESS_EXIT '+JSON.stringify({argv:process.argv,code})));
const toy=rel==='tools/toyvm/decode-diff.js'&&JSON.stringify(process.argv.slice(2))==='["--random=20000","--seed=12345"]';
const originalLoad=M._load;
let permittedBytes=null,compiled=null,memory=null,compileCount=0,memoryCount=0,instanceCount=0;
M._load=function(request,parent,main){
 const resolved=M._resolveFilename(request,parent,main);
 if(forbidden.test(resolved))deny('full compiler import');
 if(resolved.startsWith(R+'/')){
  const row=pins.get(path.relative(R,resolved));
  if(row)assert.equal(hash(fs.readFileSync(resolved)),row.sha256,'loaded source pin');
 }
 const value=originalLoad.apply(this,arguments);
 if(resolved===path.join(R,'lib/compile-wat.js')&&!value.shadowGuard){
  const compile=value.compileWat;
  value.compileWat=async function(read,options){
   if(!toy)deny('default/source compileWat');
   assert.equal(parent.filename,path.join(R,'tools/toyvm/vm.js'));
   assert.deepEqual(options,{files:['toyvm-tailcall.wat'],cacheKey:'toyvm:tailcall'});
   assert.equal(permittedBytes,null);
   const source=read('toyvm-tailcall.wat');assert(source.length<=8388608);
   const result=await compile.call(this,f=>{assert.equal(f,'toyvm-tailcall.wat');return source;},options);
   assert(result.byteLength<=8388608);permittedBytes=hash(result);
   console.error('READINESS_TOY_MODULE '+JSON.stringify({sourceSha256:hash(source),moduleSha256:permittedBytes,bytes:result.byteLength}));
   return result;
  };
  value.compileWatSnapshot=()=>deny('snapshot compiler');value.shadowGuard=true;
 }
 if(resolved===path.join(R,'tools/watx.js')&&!value.shadowGuard){
  const compile=value.compile;
  value.compile=function(source,vfs,options){
   // Only the existing declaration-only region-layout recipe may emit bytes.
   const layout=require(path.join(R,'tools/region-layout.js'));
   const decl=fs.readFileSync(path.join(R,'src/00-regions.wat'),'utf8');
   // Match fixed recipe and exact declarations; no include or function body may enter.
   if(typeof source!=='string'||source.length>262144||vfs.size!==0||!source.startsWith('(memory 8192 8192)\n')||!source.endsWith(decl+'\n(func $noop (effects heap) (nop))\n(wasm-export "noop" $noop)\n')||source.includes('(include ')||(source.match(/\(func\s/g)||[]).length!==1)deny('full/unknown WATX source');
   assert.equal(options.mode,'production');assert.equal(options.runtimeBuiltins,false);assert.equal(options.standardWat,true);
   const result=compile.apply(this,arguments);
   if(result.success){assert(result.wasmBinary.byteLength<=8388608);console.error('READINESS_REGION_FRAGMENT '+JSON.stringify({sourceSha256:hash(source),moduleSha256:hash(result.wasmBinary),bytes:result.wasmBinary.byteLength,instantiated:false}));}
   return result;
  };
  value.compileAsync=()=>deny('async compiler');value.shadowGuard=true;
 }
 return value;
};
const native={};
for(const k of ['Module','Instance','Memory','compile','compileStreaming','instantiate','instantiateStreaming']){
 native[k]=WebAssembly[k];WebAssembly[k]=function(){deny('WebAssembly.'+k);};
}
if(toy){
 assert(process.env.NODE_OPTIONS.includes('--max-old-space-size=512'));
 console.error('READINESS_TOY_LIMITS '+JSON.stringify({heapMiB:512,timeoutSeconds:600,cpuSeconds:600,arenaCount:1,pages:676,aggregateBytes:44302336,memAvailable:fs.readFileSync('/proc/meminfo','utf8').match(/^MemAvailable:.*$/m)[0]}));
 WebAssembly.compile=async function(bytes){assert(permittedBytes&&hash(bytes)===permittedBytes,'unknown native module');assert.equal(++compileCount,1);compiled=await native.compile(bytes);return compiled;};
 WebAssembly.Memory=function(options){assert(compiled);assert.deepEqual(options,{initial:676,maximum:676});assert.equal(++memoryCount,1);memory=new native.Memory(options);assert.equal(memory.buffer.byteLength,44302336);console.error('READINESS_TOY_LIVE '+JSON.stringify({count:memoryCount,aggregateBytes:memory.buffer.byteLength,process:process.memoryUsage()}));return memory;};
 WebAssembly.instantiate=async function(module,imports){assert.equal(module,compiled);assert.equal(imports.host.memory,memory);assert.equal(++instanceCount,1);return native.instantiate(module,imports);};
 process.on('exit',()=>console.error('READINESS_TOY_COUNTS '+JSON.stringify({compileCount,memoryCount,instanceCount,aggregateBytes:memory?.buffer.byteLength||0})));
}
