'use strict';
// Offline host-observer fixture only; no Setup, no production module execution.
const assert=require('assert/strict');
const {makeObserver,quotaSink}=require('./observer.cjs');
const memory={buffer:new ArrayBuffer(0x420000)},dv=new DataView(memory.buffer);
let eax=0,eip=0x7500000,esp=0x4200;
const ex={get_eax:()=>eax,get_eip:()=>eip,get_esp:()=>esp,get_ebp:()=>0,get_image_base:()=>0x400000};
const put=(a,v)=>dv.setUint32(a,v,true),rows=[];
const observer=makeObserver({memory,exports:ex,translate:a=>a,emit:r=>rows.push(r),stop:()=>{},findFile:h=>({handle:h,path:'c:/temp/_istmp1.dir/_ins5576._mp',position:0,length:0})});
put(esp,0x404779);[9,0x6000,4096,0x4107e8,0].forEach((v,i)=>put(esp+4+i*4,v));
new Uint8Array(memory.buffer,0x6000,4096).fill(0x53);
put(0x4107e8,123);observer.entry('WriteFile');
// A nested filtered API return must not consume the WriteFile snapshot.
observer.entry('GetTickCount');observer.exit();assert.equal(rows.length,1);
put(0x4107e8,4096);eax=1;observer.exit();
assert.equal(rows[1].actual,4096);assert.equal(rows[1].eax,1);assert.equal(rows[1].caller,0x404779);assert.equal(rows[1].firstMismatch,undefined);
observer.entry('WriteFile');put(0x4107e8,0);eax=0;observer.exit();assert.equal(rows[3].actual,0);assert.equal(rows[3].firstMismatch,true);
observer.entry('ReadFile');put(0x4107e8,3);eax=1;observer.exit();assert.equal(rows[5].buffer.length,3);
assert.equal(rows[5].buffer.sha256,require('crypto').createHash('sha256').update('SSS').digest('hex'));
put(0x4107f4,0xfffffffc);observer.pc(0x40478e);assert.equal(rows[6].status,-4);
const before=rows.length;observer.pc(0x405000);assert.equal(rows.length,before);
let written=[],quota=null;const s=quotaSink(x=>written.push(x),{maxBytes:60,maxEvents:2,onQuota:r=>quota=r});
s.emit({a:1});s.emit({a:2});assert.throws(()=>s.emit({a:3}),/quota/);assert.equal(written.length,2);assert.equal(quota.events,2);
const b=quotaSink(()=>assert.fail('oversized emitted'),{maxBytes:1,maxEvents:100,onQuota:()=>{}});assert.throws(()=>b.emit({a:1}),/quota/);
console.log(JSON.stringify({pass:true,scope:'offline observer only',checks:['post-return count rather than entry stale value','EAX BOOL','caller and args retained','filtered nested call ownership','zero short-write rejecting control','read buffer hash','extractor negative status','irrelevant-PC rejection','event quota rejection','byte quota rejection'],events:rows.length}));
