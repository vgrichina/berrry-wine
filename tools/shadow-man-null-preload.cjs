'use strict';
// Dedicated main-process runner only. External watchdog must kill synchronous spins.
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const {isMainThread}=require('node:worker_threads');
const {createCapture,createSelectedSend,SEND_HOOK,PIN}=require('./shadow-man-null-capture.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
if(!isMainThread) throw Error('NULL capture forbids worker threads');
if(process.env.SHADOW_NULL_PID!==String(process.pid)) throw Error('wrong target process PID');
if(process.argv.some(x=>/^--(trace|break|watch|spawned-child)(?:[-=]|$)/.test(x))) throw Error('conflicting diagnostic/child flags');
const runner=path.resolve(__dirname,'../test/run.js');
if(!process.argv[1]||fs.realpathSync(process.argv[1])!==runner||hash(fs.readFileSync(runner))!==process.env.SHADOW_NULL_RUNNER_SHA) throw Error('wrong process/runner identity');
const selection=JSON.parse(process.env.SHADOW_NULL_SELECTION||'null');
const watchdogMs=Number(process.env.SHADOW_NULL_WATCHDOG_MS);
if(!Number.isSafeInteger(watchdogMs)||watchdogMs<1||watchdogMs>300000) throw Error('finite external watchdog contract required (1..300000ms)');
const policy=process.env.SHADOW_NULL_BLOCK_POLICY;
if(!['required','optional'].includes(policy)) throw Error('explicit block policy required');
const out=process.env.SHADOW_NULL_OUTPUT;
if(!out) throw Error('SHADOW_NULL_OUTPUT required');
const wasmArg=process.argv.filter(x=>x.startsWith('--wasm='));
if(wasmArg.length!==1) throw Error('one explicit --wasm required; source compile forbidden');
const moduleBytes=fs.readFileSync(wasmArg[0].slice(7));
const actual={moduleSha256:hash(moduleBytes),moduleBytes:moduleBytes.length};
const mode=process.env.SHADOW_NULL_MODE;
if(!['historical-pre-block','revised-first-zero'].includes(mode)) throw Error('explicit distinct diagnostic mode required');
const untilZero=mode==='revised-first-zero';
const zeroTransferFlag=process.env.SHADOW_NULL_ZERO_TRANSFER;
if(zeroTransferFlag!==undefined&&zeroTransferFlag!=='1') throw Error('invalid SHADOW_NULL_ZERO_TRANSFER');
const zeroTransferProvenance=zeroTransferFlag==='1';
if(zeroTransferProvenance&&!untilZero) throw Error('zero-transfer requires revised-first-zero');
if(process.env.SHADOW_NULL_UNTIL_ZERO!==undefined) throw Error('obsolete eager-arm mode forbidden');
if(!untilZero&&(actual.moduleSha256!==PIN.moduleSha256||actual.moduleBytes!==PIN.moduleBytes)) throw Error('historical module mismatch');
if(untilZero&&(!process.env.SHADOW_NULL_REVISED_SHA||actual.moduleSha256!==process.env.SHADOW_NULL_REVISED_SHA||actual.moduleSha256===PIN.moduleSha256)) throw Error('explicit distinct revised diagnostic module SHA required');
if(globalThis[SEND_HOOK]) throw Error('competing selected-send adapter');
const fd=fs.openSync(out,'wx',0o600);
const write=r=>{fs.writeSync(fd,JSON.stringify(r)+'\n');fs.fsyncSync(fd);};
const die=reason=>{try{write({terminal:true,reason,exit:86});}finally{process.exit(86);}};
let compileCount=0,instanceCount=0,instantiating=false;
const bindings=new WeakSet(),compile=WebAssembly.compile,instantiate=WebAssembly.instantiate;
// Parse section boundaries to forbid a start section before any guest execution.
function noStart(b) {
 let p=8;
 function leb(){let v=0,m=1;for(let n=0;n<5;n++){if(p>=b.length)throw Error('truncated module');const x=b[p++];v+=(x&127)*m;if(!(x&128))return v;m*=128;}throw Error('invalid section size');}
 while(p<b.length){const id=b[p++],n=leb();if(id===8)throw Error('start section forbidden');if(n>b.length-p)throw Error('truncated section');p+=n;}
}
WebAssembly.compile=async function(bytes){
 if(++compileCount!==1) throw Error('second compile/context forbidden');
 const accepted=Buffer.from(bytes instanceof ArrayBuffer?new Uint8Array(bytes):ArrayBuffer.isView(bytes)?new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength):[]);
 if(!accepted.equals(moduleBytes)) throw Error('compile bytes differ from named module');
 noStart(accepted);
 const module=await compile.call(WebAssembly,accepted);bindings.add(module);return module;
};
WebAssembly.instantiate=async function(module,imports){
 if(!(module instanceof WebAssembly.Module)||!bindings.has(module)) throw Error('unbound Module or alternate instantiate form');
 if(++instanceCount!==1||instantiating) throw Error('second instance/context forbidden');
 instantiating=true;
 if(!imports||!imports.host||typeof imports.host.log_eip!=='function') throw Error('invalid observer imports');
 const capture=createCapture({untilZero,zeroTransferProvenance,requireBlock:policy==='required',metadata:{mode,...(zeroTransferProvenance?{zeroTransferProvenance:true}:{}),historicalReference:PIN,actualModule:actual,pid:process.pid,runner,runnerSha256:process.env.SHADOW_NULL_RUNNER_SHA,watchdogMs,externalWatchdog:'required; not enforced by event-loop timer'},retain:write,stop:die});
 const previous=imports.host.log_eip;
 imports.host.log_eip=function(eip){if(instantiating)die('capture-failed: callback during instantiate');if(!capture.log(eip))return previous(eip);};
 const result=await instantiate.call(WebAssembly,module,imports);
 instantiating=false;
 globalThis[SEND_HOOK]=createSelectedSend({instance:result,capture,selection,runner});
 return result; // Remains OFF until the validated actual pre-send boundary.
};
WebAssembly.Instance=new Proxy(WebAssembly.Instance,{construct(){throw Error('Instance constructor context forbidden');}});
WebAssembly.compileStreaming=WebAssembly.instantiateStreaming=async()=>{throw Error('streaming context forbidden');};
process.on('exit',code=>{if(code!==86)write({terminal:false,failure:'missing terminal capture',exit:code});});
