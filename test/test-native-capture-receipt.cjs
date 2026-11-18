'use strict';
const assert=require('node:assert/strict');
const {createCaptureReceipts}=require('../lib/cli-native-capture-receipt');
const main={hwnd:'0x1',generation:'1',processId:1,threadId:1,visible:true,live:true,isChild:false,title:'Animated fixture',owner:'0x0',parent:'0x0'};
function snapshot(){return {mainHwnd:'0x1',windows:[{...main}],modalHwnd:'0x0',focus:'0x1',focusTopLevel:'0x1',focusWindow:{...main},capture:'0x0',physicalUp:true,nativeProcess:{pid:123,executable:'fixture.exe'},screen:{w:800,h:600},eip:'0x402000',quit:false};}
let wall=1000,mono=0,s=snapshot(),pixels=Buffer.from('whole encoder image A'),written,queue=[];
const registry=createCaptureReceipts({now:()=>wall,monotonic:()=>mono,authority:()=>({healthy:true,refs:{queue}})});
const r=registry.capture(()=>structuredClone(s),()=>pixels,b=>written=Buffer.from(b));
const expected={...r,pngSHA256:r.receipt.pngSHA256};
assert.deepEqual(written,pixels);
pixels=Buffer.from('whole encoder image B');wall+=100;mono+=100;
assert(registry.verify(s,expected),'animation changes encoder bytes without replacing the issued image');
for(const change of [v=>v.receipt.captureId='unissued',v=>v.pngSHA256='bad',v=>v.receipt.pngSHA256='bad',v=>v.receipt.expiresAt++,v=>v.snapshot.nativeProcess.pid++,v=>v.snapshot.windows[0].generation='2']) {
 const bad=structuredClone(expected);change(bad);assert.throws(()=>registry.verify(s,bad),/unissued|mismatched/);
}
const second=registry.capture(()=>structuredClone(s),()=>pixels,()=>{});
assert.throws(()=>registry.verify(s,{...expected,receipt:second.receipt}),/mismatched/,'genuine second image cannot be substituted');
const oldQueue=queue;queue=[];assert.throws(()=>registry.verify(s,expected),/scene changed/,'same public scene cannot rebind replacement authority');queue=oldQueue;
for(const change of [v=>v.nativeProcess.pid++,v=>v.windows[0].generation='2',v=>v.focus='0x0',v=>v.focusWindow.threadId++,v=>v.modalHwnd='0x2',v=>v.capture='0x2',v=>v.physicalUp=false,v=>v.screen.w++,v=>v.quit=true]) {
 const bad=snapshot();change(bad);assert.throws(()=>registry.verify(bad,expected),/scene changed/);
}
wall=31000;mono=30000;assert.throws(()=>registry.verify(s,expected),/stale/);
wall=1100;assert.throws(()=>registry.verify(s,expected),/stale/,'monotonic expiry survives wall rollback');
const changed=createCaptureReceipts({now:()=>1000,monotonic:()=>0});let reads=0;
assert.throws(()=>changed.capture(()=>{const v=snapshot();if(reads++)v.focus='0x0';return v;},()=>pixels,()=>assert.fail('write after context change')),/context changed/);
console.log('PASS issued whole bytes/hash, genuine mismatch, finite dual-clock expiry, native authority negatives, atomic capture');
