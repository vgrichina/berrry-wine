'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {attach}=require('../lib/deusex-ordered-producer-observer');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function fixture(){
 const buffer=new ArrayBuffer(0x101000),bytes=new Uint8Array(buffer),base=0x22000000;
 bytes.set([0x89,0x04,0xfe],0x1000+0x3d5ee); // mov [esi+edi*8],eax
 const regs={eax:0x12345678,ecx:base+0x80000,edx:base+0x81000,ebx:base+0x82000,esp:base+0x83000,ebp:base+0x752f8,esi:base+0x752f0,edi:1};
 let generation=1,calls=0,thread=1,pc=base+0x3d5ee;
 const ex={memory:{buffer},get_current_thread_id:()=>thread,get_eip:()=>pc,guest_to_wasm:a=>a>=base&&a<base+0x100000?a-base+0x1000:0xf0};
 for(const r of Object.keys(regs))ex['get_'+r]=()=>regs[r];
 const owner={ex,frame:{engine:1,viewport:2,esp:3,savedCaller:4},identityModule(name,preferred){assert.equal(name,'softdrv.dll');assert.equal(preferred,0x10d00000);calls++;return {index:7,base,size:0x100000,generation};},observe(...args){return {receiver:this,args};}};
 const previous=owner.observe,handle=attach(owner,{workerSlot:0,moduleSha256:'a'.repeat(64),mmxBase:0,drawId:'run/draw',now:()=>0});
 return {owner,ex,handle,previous,bytes,setGeneration:n=>generation=n,setPC:n=>pc=n,setThread:n=>thread=n,calls:()=>calls};
}
const f=fixture(),before=hash(f.bytes);
let answer=f.owner.observe(73,'x');assert.strictEqual(answer.receiver,f.owner);assert.deepEqual(answer.args,[73,'x']);
assert.equal(f.calls(),1);assert(f.handle.observer.pending);
assert.equal(f.handle.observer.pending.identity.module.generation,1);
assert.equal(f.handle.observer.pending.identity.module.index,7);
f.setGeneration(2);f.owner.observe();assert.equal(f.calls(),2);
assert.equal(f.handle.observer.result.drops.pending,1);assert.equal(f.handle.observer.result.coverage.identityChanges,2);
assert(!f.handle.observer.result.records.some(r=>r.type==='overlapping-store'));
f.owner.frame={...f.owner.frame};f.owner.observe();
assert.equal(f.handle.observer.result.drops.pending,2,'same-valued new invocation rejects old pending store');
assert.equal(f.handle.observer.result.coverage.identityChanges,3);
const other={};answer=f.owner.observe.call(other,94);assert.strictEqual(answer.receiver,other);assert.deepEqual(answer.args,[94]);assert.equal(f.calls(),3);
const replacement=()=>99;f.owner.observe=replacement;f.handle.stop();assert.strictEqual(f.owner.observe,replacement,'stop never overwrites another wrapper');assert.equal(hash(f.bytes),before);
const foreign=fixture();foreign.owner.observe();foreign.owner.ex={...foreign.ex};foreign.owner.observe();assert.equal(foreign.handle.observer.result.status,'observer-error');assert.equal(foreign.handle.observer.result.drops.pending,1);foreign.handle.stop();
const wrong=fixture();wrong.setThread(2);const ret=wrong.owner.observe(12);assert.equal(ret.args[0],12);assert.equal(wrong.handle.observer.result.status,'observer-error');wrong.handle.stop();
const dup=fixture();assert.throws(()=>attach(dup.owner,{workerSlot:0}),/already attached/);dup.handle.stop();assert.strictEqual(dup.owner.observe,dup.previous);
const reattach=attach(dup.owner,{workerSlot:0,moduleSha256:'c'.repeat(64),mmxBase:0,drawId:'new',now:()=>0});dup.handle.stop();assert.throws(()=>attach(dup.owner,{workerSlot:0}),/already attached/,'stale stop cannot unregister a new attachment');reattach.stop();
const failure=fixture(),sentinel=new Error('underlying failure');failure.handle.stop();failure.owner.observe=()=>{throw sentinel;};const failed=attach(failure.owner,{workerSlot:0,moduleSha256:'b'.repeat(64),mmxBase:0,drawId:'failure',now:()=>0});assert.throws(()=>failure.owner.observe(),e=>e===sentinel);assert.equal(failed.observer.result.sequence,0);failed.stop();
console.log('PASS ordered observer fresh module generation, invocation and instance identities; read-only adapter return/throw/restoration controls');
