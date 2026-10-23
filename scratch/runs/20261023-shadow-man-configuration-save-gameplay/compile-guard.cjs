'use strict';
// Diagnostic fail-closed input guard, inherited by Node children and Workers.
const fs=require('fs'),crypto=require('crypto'),Module=require('module'),wt=require('worker_threads');
const EXPECTED='ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553';
const CANONICAL='/home/user/shadow-man-launcher-configuration-capture-oct23/immutable/runtime/build/wine-assembly.wasm';
const SELFTEST=process.argv.includes('--guard-selftest');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const originalLoad=Module._load;
Module._load=function(spec,parent,isMain){
 if(/(?:watx-closure|build-compile-wat|watx-compiler|compile-wat|(?:^|\/)region-layout\.js|wat2wasm|wabt)/.test(spec))throw Error('compile-guard: forbidden source compiler '+spec);
 return originalLoad.apply(this,arguments);
};
const known=new WeakSet(),compile=WebAssembly.compile,instantiate=WebAssembly.instantiate;
function check(bytes){if(sha(Buffer.from(bytes))!==EXPECTED)throw Error('compile-guard: noncanonical Wasm input');}
function emit(r){if(!SELFTEST)fs.appendFileSync('/home/user/shadow-man-launcher-configuration-capture-oct23/fixed/module-consumption.jsonl',JSON.stringify({pid:process.pid,isMainThread:wt.isMainThread,...r})+'\n');}
WebAssembly.compile=async function(bytes){check(bytes);const m=await compile.call(this,bytes);known.add(m);emit({event:'canonical-input-consumed',bytes:bytes.byteLength,sha256:EXPECTED});return m;};
WebAssembly.instantiate=async function(m,imports){
 if(m instanceof WebAssembly.Module){
  if(wt.isMainThread&&!known.has(m))throw Error('compile-guard: unknown main-thread module');
  emit({event:'instantiate',provenance:known.has(m)?'same-process-verified-compile':'verified-parent-structured-clone; bytes not rehashed in Worker'});
 }else check(m);
 return instantiate.apply(this,arguments);
};
if(wt.isMainThread&&!SELFTEST){
 if(!process.argv.includes('--no-build')||!process.argv.includes('--wasm='+CANONICAL))throw Error('compile-guard: explicit canonical command required');
 const b=fs.readFileSync(CANONICAL);if(b.length!==1879387||sha(b)!==EXPECTED)throw Error('compile-guard: preserved file identity mismatch');
 emit({event:'command-file-verified',path:CANONICAL,bytes:b.length,sha256:EXPECTED});
}
module.exports={check};
