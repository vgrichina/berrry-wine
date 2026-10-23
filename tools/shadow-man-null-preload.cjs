'use strict';
// Use only in a separately authorized, dedicated main-process diagnostic run.
// Exits the OS process synchronously; no guest recovery/resume is supported.
const fs=require('node:fs'),crypto=require('node:crypto');
const {isMainThread}=require('node:worker_threads');
const {createCapture,PIN}=require('./shadow-man-null-capture.cjs');
if(!isMainThread) throw Error('NULL capture forbids worker threads');
const out=process.env.SHADOW_NULL_OUTPUT;
if(!out) throw Error('SHADOW_NULL_OUTPUT required');
if(process.argv.some(x=>/^--(trace-at|break|trace-eip|spawned-child)(=|$)/.test(x))) throw Error('conflicting diagnostic/child flags');
const wasmArg=process.argv.find(x=>x.startsWith('--wasm='));
if(!wasmArg) throw Error('explicit --wasm required; source compile forbidden');
const moduleBytes=fs.readFileSync(wasmArg.slice(7));
const actual={moduleSha256:crypto.createHash('sha256').update(moduleBytes).digest('hex'),moduleBytes:moduleBytes.length};
const untilZero=process.env.SHADOW_NULL_UNTIL_ZERO==='1';
if(!untilZero&&(actual.moduleSha256!==PIN.moduleSha256||actual.moduleBytes!==PIN.moduleBytes)) throw Error('historical module mismatch');
if(untilZero&&(!process.env.SHADOW_NULL_REVISED_SHA||actual.moduleSha256!==process.env.SHADOW_NULL_REVISED_SHA)) throw Error('explicit revised diagnostic module SHA required');
const fd=fs.openSync(out,'wx',0o600);let count=0;
const write=r=>{fs.writeSync(fd,JSON.stringify(r)+'\n');fs.fsyncSync(fd);};
const original=WebAssembly.instantiate;
WebAssembly.instantiate=async function(module,imports){
 if(++count!==1) { write({failure:'second instance forbidden'});process.exit(87); }
 const capture=createCapture({untilZero,metadata:{historicalReference:PIN,actualModule:actual,pid:process.pid},retain:write,stop:reason=>{try{write({terminal:true,reason,exit:86});}finally{process.exit(86);}}});
 const previous=imports.host.log_eip;
 imports.host.log_eip=function(eip){if(!capture.log(eip)&&previous) return previous(eip);};
 const result=await original.call(WebAssembly,module,imports);
 capture.arm(result.exports||result.instance.exports);
 return result;
};
process.on('exit',code=>{if(code!==86)write({terminal:false,failure:'missing terminal capture',exit:code});});
