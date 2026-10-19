'use strict';
// Native control only when separately granted. No original guest or implicit build.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {makeFixture}=require('./kernel32-native-fixture');
const [runtime,grant]=process.argv.slice(2);
assert(runtime&&path.isAbsolute(runtime)&&grant==='--root-runtime-granted');
const wasm=fs.readFileSync(path.join(runtime,'build/wine-assembly.wasm'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(sha(wasm),'7fd02a77ec01e5e18065d112b1da434886a0dba3fcadd7ff043d1e2ddca41f33');
const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
const ctx={getMemory:()=>memory.buffer};
const host=require(path.join(runtime,'lib/host-imports')).createHostImports(ctx).host;
Object.assign(host,{memory,log:()=>{},log_i32:()=>{}});
const e=ctx.exports=new WebAssembly.Instance(new WebAssembly.Module(wasm),{host}).exports;
const pe=makeFixture();new Uint8Array(memory.buffer).set(pe,e.get_staging());assert(e.load_pe(pe.length));
const stack=e.get_esp(),observations=[];
function program(){
  // mov eax,1; jmp next; [branch entry] add eax,2; [interior] add eax,4; ret.
  const code=[0xb8,1,0,0,0,0xeb,0,0x83,0xc0,2,0x83,0xc0,4,0xc3];
  const p=e.guest_alloc(code.length);code.forEach((b,i)=>e.guest_write8(p+i,b));return p;
}
function start(p){e.clear_bp();e.set_esp(stack);e.clear_yield();e.call_func(p,0,0,0,0);}
const inside=program();start(inside);e.set_bp(inside+10);e.run(1000);
observations.push({case:'interior',eip:e.get_eip(),eax:e.get_eax(),halt:e.get_last_run_halt()});
assert.equal(e.get_eip(),0,'interior address is not exposed as dispatch boundary');assert.equal(e.get_eax(),7);
const branch=program();start(branch);e.set_bp(branch+7);e.run(1000);
assert.equal(e.get_eip(),branch+7);assert.equal(e.get_last_run_halt(),5);assert.equal(e.get_eax(),1);
observations.push({case:'branch-entry',eip:e.get_eip(),eax:e.get_eax(),halt:e.get_last_run_halt()});
// Same set_bp rearm used by --trace-at; resume must not loop on the same stop.
e.set_bp(branch+7);e.run(1000);assert.equal(e.get_eip(),0);assert.equal(e.get_eax(),7);
start(branch);e.set_bp(branch+7);e.run(1000);assert.equal(e.get_eip(),branch+7);assert.equal(e.get_eax(),1);
observations.push({case:'cached-branch-entry',eip:e.get_eip(),eax:e.get_eax(),halt:e.get_last_run_halt()});
console.log(JSON.stringify({result:'PASS',moduleSha:sha(wasm),fixtureSha:sha(pe),observations,scope:'synthetic x86 block-boundary observability only; no original-game execution'}));
