'use strict';
const assert=require('node:assert/strict');
const {checkReviewedImage,pinRecoveryIdentity}=require('../tools/gltron-current-review.cjs');
const image={label:'old',completedAt:1000,sha256:'a'.repeat(64)};
const intent={action:'key',review:'Personally inspected complete image',mode:'game',nonce:'old-nonce',imageSHA256:image.sha256,reviewedAt:1100};
const idle={terminal:false,phase:'idle',inflight:0,transport:40,down:2};
assert.equal(checkReviewedImage(intent,image,idle,idle,15999),null);
const refused=checkReviewedImage(intent,image,idle,idle,16000);
assert.equal(refused.outcome,'REFUSED_BEFORE_DISPATCH');assert(refused.zeroTransport);
const fresh={...image,label:'fresh',completedAt:16001};
assert.throws(()=>checkReviewedImage(intent,fresh,idle,idle,16002),/join/);
assert.equal(checkReviewedImage({...intent,nonce:'new',reviewedAt:16002},fresh,idle,idle,16003),null);
assert.equal(checkReviewedImage({...intent,mode:'menu'},image,idle,idle,30999),null);
assert(checkReviewedImage({...intent,mode:'menu'},image,idle,idle,31000));
for(const changes of [null,{terminal:true},{phase:'armed'},{phase:'prepared'},{inflight:1},{transport:41},{down:3}]){
 const after=changes&&{...idle,...changes};
 assert.throws(()=>checkReviewedImage(intent,image,idle,after,16000));
 assert.throws(()=>checkReviewedImage(intent,image,idle,after,2000));
}
for(const changes of [{review:''},{imageSHA256:'b'.repeat(64)},{reviewedAt:999},{reviewedAt:16001},{mode:'other'}])
 assert.throws(()=>checkReviewedImage({...intent,...changes},image,idle,idle,16000));
for(const fault of ['owner','epoch','generation','slot','terminal','health','endpoint','worker','canvas','process','guard']){
 const scene=[1,2,3,3,0,0,9,0,9,0],state={scene,slot:0,healthy:true,bound:true,terminal:false};
 const b={endpoint:{},workerEpoch:1,presenter:{layer:{}}};
 const w={renderer:{windows:{3:{}},canvas:{},inputQueue:[]},hostCtx:{getGlGpsBridge:()=>b},guestWorker:{link:{}},memory:{buffer:{}},_processObject:{},instance:{},_browserNativeInput:{snapshot:()=>state}};
 const verify=pinRecoveryIdentity(w);assert.equal(verify(),true);
 if(fault==='owner')w.instance={};
 if(fault==='epoch')b.workerEpoch++;
 if(fault==='generation')scene[6]++;
 if(fault==='slot')state.slot++;
 if(fault==='terminal')state.terminal=true;
 if(fault==='health')state.healthy=false;
 if(fault==='endpoint')b.endpoint.closed=true;
 if(fault==='worker')w.guestWorker={};
 if(fault==='canvas')w.renderer.canvas={};
 if(fault==='process')w._processObject={};
 if(fault==='guard')w._browserNativeInput={};
 assert.throws(verify,/changed or UNKNOWN/,fault);
}
console.log('PASS local expiry -> fresh capture -> new review; zero transport/arm/inflight/effects proof and identity/epoch/generation/terminal refusals');
