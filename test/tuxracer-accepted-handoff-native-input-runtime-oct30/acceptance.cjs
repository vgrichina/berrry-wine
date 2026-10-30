'use strict';
const fs=require('fs'),assert=require('assert'),crypto=require('crypto'),Module=require('module');
const source=fs.readFileSync(process.argv[2]),original=process.argv.includes('--original');
assert.equal(crypto.createHash('sha256').update(source).digest('hex'),original?'f4ba190b2dbf5e2cf2dac82398577bedfb13aa26d332fb7480b4d9d7e4ea2f78':'92a5671ad712d9ac943559a009496000e28a7fe98f34e66c2f453ba8fc9bac3d');
let executable=source.toString();
if(process.argv.includes('--mutate-remove-handoff')) {
 const marker='        this.checkMainYield();\n      }\n      this._wakeWaitersSoon();';
 assert.equal(executable.split(marker).length,2);
 executable=executable.replace(marker,'        /* rejecting mutation: omit same-slice handoff */\n      }\n      this._wakeWaitersSoon();');
}
const mod=new Module('/home/user/tuxracer-render/lib/thread-manager.js',module);mod.filename=mod.id;mod.paths=Module._nodeModulePaths('/home/user/tuxracer-render/lib');mod._compile(executable,mod.filename);
const {ThreadManager}=mod.exports;
function fixture(overrides={}) {
 const m=Object.create(ThreadManager.prototype),s={yield:1,handle:0xe0004,ptr:0,stack:12,esp:0x1000,eax:99,eip:77,...overrides};
 m.syncView=new Int32Array([0xe0004,3,2,1,0xe0005,3,0,0]);m._getSyncIdx=h=>h===0xe0004?0:h===0xe0005?1:-1;
 m._issuedAuthorityEvents=new Set();m._renderSendTargets=new Set();m._waitNow=()=>10;m.noteMainSleep=()=>{};m._wakeWaitersSoon=()=>{};
 m._readWaitReturnAddress=e=>{assert.equal(e,m.mainInstance.exports);return 0x1234;};
 m.mainInstance={exports:{get_yield_reason:()=>s.yield,get_wait_handle:()=>s.handle,get_wait_handles_ptr:()=>s.ptr,get_wait_stack_bytes:()=>s.stack,get_wait_timeout:()=>0xffffffff,get_esp:()=>s.esp,clear_yield:()=>{s.yield=0;s.completions=(s.completions||0)+1;},set_eax:v=>s.eax=v,set_esp:v=>s.esp=v,set_eip:v=>s.eip=v}};
 return {m,s};
}
{
 const {m,s}=fixture();assert.equal(m.releaseMutex(0xe0004,2),1);
 if(original){assert.equal(s.completions,undefined);assert.equal(m.waitSingle(0xe0004,0,2),0);assert.equal(m.syncView[2],2);console.log('CONTROL: real release then same-slice reacquire wins before main poll');}
 else {assert.equal(m.syncView[2],1);assert.equal(m.syncView[3],1);assert.equal(s.completions,1);assert.equal(s.yield,0);assert.equal(s.esp,0x100c);assert.equal(s.eip,0x1234);assert.equal(s.eax,0);assert.equal(m.waitSingle(0xe0004,0,2),0x102);console.log('CANDIDATE: actual checkMainYield/_completeWait acquire and resume main once');}
}
for(const cfg of [{yield:0},{handle:0xe0005},{ptr:0x4000},{stack:20}]){const {m,s}=fixture(cfg);const before={...s};assert.equal(m.releaseMutex(0xe0004,2),1);assert.deepEqual(s,before);assert.equal(m.syncView[2],0);assert.equal(m.syncView[6],0);}
{
 const {m,s}=fixture();m.workerBackend={};assert.equal(m.releaseMutex(0xe0004,2),1);assert.equal(s.completions,undefined);assert.equal(m.syncView[2],0);
}
{
 const {m,s}=fixture();m.syncView[3]=2;assert.equal(m.releaseMutex(0xe0004,2),1);assert.equal(m.syncView[3],1);assert.equal(m.syncView[2],2);assert.equal(s.completions,undefined);const before=Array.from(m.syncView);assert.equal(m.releaseMutex(0xe0004,1),0);assert.equal(m.releaseMutex(0xe0099,2),-1);assert.deepEqual(Array.from(m.syncView),before);
}
{
 const {m,s}=fixture({yield:0});m.syncView[2]=0;m.syncView[3]=0;assert.equal(m.waitSingle(0xe0004,0,1),0);assert.equal(m.waitSingle(0xe0004,0,1),0);assert.equal(m.syncView[3],2);assert.equal(m.releaseMutex(0xe0004,1),1);assert.equal(m.syncView[3],1);assert.equal(m.releaseMutex(0xe0004,1),1);assert.equal(m.syncView[2],0);assert.equal(s.completions,undefined);
}
console.log('PASS ordinary, recursive, wrong-owner, invalid, worker-backend, other-handle, other-main-wait; no interpreter recursion');
