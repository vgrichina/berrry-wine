'use strict';
// Offline synthetic state/stack fixtures plus exact original instruction slices.
// No PE loader, game loop, input driver, original gameplay or backend claim.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),Module=require('node:module'),crypto=require('node:crypto');
const file=require.resolve('./tr2-action-observer.test.cjs');
const prefix=fs.readFileSync(file,'utf8').split("for(const mode of ['action','binding'")[0];
const context={require:Module.createRequire(file),module:{exports:{}},WebAssembly,DataView,Uint8Array,Atomics};
vm.runInNewContext(prefix+'\nmodule.exports={fixture,setup,poll,action,memory,b,dv,wa,wr,w16,pe,exeSha256};',context);
const {fixture,setup,poll,action,memory,b,dv,wa,wr,w16,pe}=context.module.exports;
const observer=require('./tr2-action-observer.cjs');
const source=fs.readFileSync(require.resolve('./tr2-action-observer.cjs'),'utf8');
let checks=0;
function copy(a,n){b.set(pe.buf.subarray(pe.va2off(a),pe.va2off(a)+n),wa(a));}
// Every literal instruction pin is independently checked against exact media.
for(const m of source.matchAll(/\[0x([0-9a-f]+),'([0-9a-f]+)'\]/g)){
 const a=parseInt(m[1],16),hex=m[2];assert.equal(pe.buf.subarray(pe.va2off(a),pe.va2off(a)+hex.length/2).toString('hex'),hex);copy(a,hex.length/2);checks++;
}
const A=0x7401008,G=0x7400f00,item=0x530000,target=0x530100;
function initial(){setup();wr(0x52173c,item);w16(item+0x22,1000);w16(0x521662,4);w16(0x521664,1);wr(0x5216e0,0);w16(0x521700,0);w16(0x521712,0);w16(0x5216fc,4);w16(0x52170e,4);wr(0x51b178,64);wr(0x52171c,500);}
function pair(f,value=1){wr(A+0x68,0x41427f);poll(f);action(f,value,value?64:0);wr(0x51b178,value?64:0);f.step({pc:0x41427f,esp:A+0x6c});}
function enter(f,caller=0x431757){wr(G,caller);f.step({pc:0x42e640,esp:G});}
function aim(f){wr(G-24,0x42e860);wr(G-20,1);f.step({pc:0x42d330,esp:G-24});wr(G-40,0x42d458);f.step({pc:0x42d4c0,esp:G-40});}
function fire(f,caller=0x42d59a,result=-1){wr(G-80,caller);wr(G-76,1);wr(G-72,target);wr(G-68,item);wr(G-64,G-44);w16(G-44,123);w16(G-42,456);f.step({pc:0x42f270,esp:G-80});f.step({pc:caller,esp:G-76,eax:result});}
const snapshot=()=>[b.slice(wa(0x400000),wa(0x540000)),b.slice(wa(G-512),wa(A+512)),b.slice(0x1000,0x12000)];
for(const mode of ['shot-both','clear','status0','frame0','locked','target-unlocked']){
 initial();const f=fixture({weapon:true,stopAfterPair:true});pair(f,mode==='clear'?0:1);
 if(mode==='status0')w16(0x521662,0);
 if(mode==='frame0')w16(0x52170e,0);
 if(mode==='locked'){wr(0x5216e0,target);w16(target+0x22,10);w16(0x521712,1);}
 if(mode==='target-unlocked')wr(0x5216e0,target);
 enter(f);
 if(mode!=='status0'){
  f.step({pc:0x42e775,esp:G-16});aim(f);
  const gate=mode==='clear'||mode==='target-unlocked'?0x42d502:0x42d54a;
  f.step({pc:gate,esp:G-60});
 }
 if(mode==='shot-both'){fire(f);fire(f,0x42d724);}
 // Fixture side effects are outside observation. The observer itself must
 // preserve direct-window guest state, stack, published RPC and original API.
 const before=snapshot();f.step({pc:0x431757,esp:G+4});const after=snapshot();
 before.forEach((v,i)=>assert.deepEqual(after[i],v));
 const r=f.o.status();assert.equal(r.status,'witnessed',JSON.stringify(r));assert.equal(r.consumptionQualified,mode!=='clear');assert(r.removed);assert.equal(f.instance,f.original);
 assert.equal(r.records.filter(x=>x.kind==='shot-entry').length,mode==='shot-both'?2:0);
 assert.equal(r.records.filter(x=>x.kind==='shot-return').length,mode==='shot-both'?2:0);
 assert.equal(r.records.find(x=>x.kind==='weapon-entry').state.input,mode==='clear'?0:64);
 const n=r.records.length;f.step({pc:0x42f270,esp:G-80});assert.equal(f.o.status().records.length,n);checks++;
}
for(const mode of ['deadline','overflow','code','caller','input','stack','shot-without-aim','pending','superseded','unmapped-target','removal']){
 initial();const f=fixture({weapon:true,stopAfterPair:true,maxRecords:mode==='overflow'?3:32});pair(f);
 if(mode==='code')b[wa(0x42e775)]^=1;
 if(mode==='input')wr(0x51b178,0);
 if(mode==='unmapped-target')wr(0x5216e0,0x100);
 if(mode==='deadline')f.expire();
 else if(mode==='superseded')f.step({pc:0x44d2a0,esp:G});
 else if(mode==='removal')f.o.finish('removed');
 else {enter(f,mode==='caller'?0:0x431757);
  if(mode==='stack')f.step({pc:0x431757,esp:G+8});
  if(mode==='shot-without-aim'){wr(G-80,0x42d59a);f.step({pc:0x42f270,esp:G-80});}
  if(mode==='pending')f.o.finish('removed');
 }
 if(mode==='code')copy(0x42e775,24);
 const r=f.o.status();assert(!r.consumptionQualified,JSON.stringify({mode,r}));assert.notEqual(r.status,'active',mode);assert(r.records.length<=32);assert.equal(f.instance,f.original);checks++;
}
initial();assert.throws(()=>fixture({weapon:'yes'}),/option/);checks++;
// Run immutable original slices using accepted production CPU d8fac. Only
// fixture stack/data are authored; calls into animation, shot/RNG stop the
// slice. This is causal branch evidence, not an original game run.
const bytes=fs.readFileSync('build/wine-assembly.wasm');assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc');
const mod=new WebAssembly.Module(bytes),imports={host:{memory}};
for(const i of WebAssembly.Module.imports(mod))if(i.kind==='function')imports.host[i.name]=()=>0;
function cpu(pc,esp=G){const e=new WebAssembly.Instance(mod,imports).exports;e.init_thread(0,0x400000,pc,pc+1,0,0,0,0);e.set_esp(esp);e.set_eip(pc);return e;}
function until(e,ends){for(let n=0;n<40;n++){e.run(1);if(ends.includes(e.get_eip()>>>0))return e.get_eip()>>>0;}throw Error('slice did not reach stop '+e.get_eip().toString(16));}
copy(0x42d4c0,0x330);copy(0x42f270,0x370);copy(0x466ad0,0x180);
for(const [mask,lock,tgt,frame,shot,finalFrame] of [[64,0,0,4,true,4],[64,1,target,4,true,4],[64,0,target,4,false,3],[0,0,0,4,false,3],[0,1,target,4,false,4],[64,0,0,0,false,1],[64,0,0,24,false,25]]){
 initial();wr(0x51b178,mask);wr(0x5216e0,tgt);w16(0x521712,lock);w16(0x52170e,frame);wr(G+4,1);
 const e=cpu(0x42d4c0),end=until(e,[0x42f270,0x42cf00]);assert.equal(end,shot?0x42f270:0x42cf00);
 if(shot){assert.equal(e.get_esp()>>>0,G-40);assert.equal(dv.getUint32(wa(G-40),true),0x42d59a);}
 else assert.equal(e.get_esi()&65535,finalFrame);checks++;
}
// The left-arm successor uses the same shot-stack displacement and its own
// exact return PC. Enter immediately after right-arm animation's return.
for(const [mask,lock,tgt,frame,shot,finalFrame] of [[64,0,0,4,true,4],[64,1,target,4,true,4],[64,0,target,4,false,3],[0,0,0,4,false,3],[64,0,0,0,false,1]]){
 initial();wr(0x51b178,mask);wr(0x5216e0,tgt);w16(0x521700,lock);w16(0x5216fc,frame);
 const e=cpu(0x42d674,G-68);e.set_ebx(1);e.set_edi(0x466afe);e.set_ebp(0);const end=until(e,[0x42f270,0x42cf00]);assert.equal(end,shot?0x42f270:0x42cf00);
 if(shot){assert.equal(e.get_esp()>>>0,G-80);assert.equal(dv.getUint32(wa(G-80),true),0x42d724);}
 else assert.equal(e.get_esi()&65535,finalFrame);checks++;
}
for(const [type,ammo,want,returnZero] of [[1,0,999,false],[2,0,0,true],[2,5,4,false],[3,0,0,true],[3,5,4,false]]){
 initial();wr(0x521720,ammo);wr(0x521724,ammo);b[wa(0x51fd96)]=0;wr(G,0x450000);wr(G+4,type);wr(G+8,0);wr(G+12,item);wr(G+16,G+100);
 const e=cpu(0x42f270),end=until(e,[0x450000,0x44c220]);assert.equal(end,returnZero?0x450000:0x44c220);
 assert.equal(dv.getUint32(wa(0x52171c+(type-1)*4),true),want);if(returnZero)assert.equal(e.get_eax(),0);checks++;
}
// Dispatch types1..3 to paired-arm function; type4 differs.
copy(0x42e68d,0x30);copy(0x42eb28,24);copy(0x42e83c,0x38);copy(0x42eb98,20);
for(const [type,end] of [[1,0x42d330],[2,0x42d330],[3,0x42d330],[4,0x42bc70]]){
 initial();w16(0x521664,type);const e=cpu(0x42e83c);e.set_ecx(type);assert.equal(until(e,[0x42d330,0x42bc70]),end);checks++;
}
// Numeric status dispatch itself, stopping at exact table destinations.
for(const [status,dest] of [[0,0x42e876],[1,0x42e8e7],[2,0x42e6a4],[3,0x42e719],[4,0x42e775],[5,0x42e76b]]){
 initial();w16(0x521662,status);const e=cpu(0x42e68d);assert.equal(until(e,[dest]),dest);checks++;
}
copy(0x42ed30,0x194);
initial();wr(G,0x450000);w16(0x521700,1);w16(0x521712,1);
{const e=cpu(0x42ed30);assert.equal(until(e,[0x450000]),0x450000);assert.equal(dv.getUint16(wa(0x521700),true),0);assert.equal(dv.getUint16(wa(0x521712),true),0);checks++;}
// Post-LOS success inside primary window sets both locks; LOS zero clears
// both; yaw outside primary window can retain one arm. Geometry/LOS are inputs.
for(const [los,yaw,want] of [[1,0,[1,1]],[0,0,[0,0]],[1,30000,[0,1]]]){
 initial();const info=0x466afe; // type1 * 46 + base
 w16(0x521700,1);w16(0x521712,1);
 // At 42edec, ESP is entry-48 (36 local+4 saved ESI+8 args).
 const S=G-48;wr(G,0x450000);wr(G+4,info);w16(S+12,yaw);w16(S+14,0);
 const e=cpu(0x42edec,S);e.set_eax(los);e.set_esi(0);assert.equal(until(e,[0x450000]),0x450000);
 assert.equal(dv.getUint16(wa(0x521700),true),want[0],JSON.stringify({los,yaw}));assert.equal(dv.getUint16(wa(0x521712),true),want[1],JSON.stringify({los,yaw}));checks++;
}
// Ready-state ammo gate precedes the default/pistol shot reset. Empty
// type1 cannot reach that reset from this route; Action clear still animates.
copy(0x42e7ba,0xbc);copy(0x42eb80,24);
for(const [mask,ammo,end] of [[64,0,0x43f370],[64,1,0x42d330],[0,0,0x42d330]]){
 initial();wr(0x51b178,mask);wr(0x52171c,ammo);const e=cpu(0x42e7ba,G-16);e.set_edx(64);e.set_ecx(1);e.set_esi(0);e.set_edi(3);
 assert.equal(until(e,[0x43f370,0x42d330]),end);checks++;
}
// Damage primitive: exact guest subtraction and kill-counter gate, with
// authored HP/damage and no blood/AI/scene execution (position argument null).
copy(0x42f5e0,0x96);
for(const [health,damage,want,kills] of [[5,1,4,0],[3,3,0,1],[0,1,-1,0]]){
 initial();w16(target+0x22,health);w16(target+0xc,0);w16(0x51fd90,0);wr(G,0x450000);wr(G+4,target);wr(G+8,0);wr(G+12,damage);wr(0x4d8768,0);
 const e=cpu(0x42f5e0);assert.equal(until(e,[0x450000]),0x450000);assert.equal(dv.getInt16(wa(target+0x22),true),want);assert.equal(dv.getUint16(wa(0x51fd90),true),kills);checks++;
}
// Exact epilogue establishes the Action-to-caller stack displacement.
copy(0x44dd55,25);wr(A+0x18,64);wr(A+0x68,0x41427f);
{const e=cpu(0x44dd55,A+4);assert.equal(until(e,[0x41427f]),0x41427f);assert.equal(e.get_esp()>>>0,A+0x6c);assert.equal(dv.getUint32(wa(0x51b178),true),64);checks++;}
// Exact call sites establish the two observer stack links, without invoking
// target acquisition/aiming or any game-loop dependency.
{const e=cpu(0x42e85a,G-16);e.set_eax(1);assert.equal(until(e,[0x42d330]),0x42d330);assert.equal(e.get_esp()>>>0,G-24);assert.equal(dv.getUint32(wa(G-24),true),0x42e860);checks++;}
copy(0x42d452,6);
{const e=cpu(0x42d452,G-32);e.set_edi(1);assert.equal(until(e,[0x42d4c0]),0x42d4c0);assert.equal(e.get_esp()>>>0,G-40);assert.equal(dv.getUint32(wa(G-40),true),0x42d458);checks++;}
// Causal mapping fixtures use the exact production allocator and x86 load.
// Fixture setup can write memory; the observer is checked independently for
// zero writes and must never invoke a translator/materializer or setter.
const regions=require('../lib/region-map.generated');
const mapCpu=cpu(0x450000),sparse=0x12000000,sparseTarget=0x13000000;
assert(mapCpu.test_virtual_map_commit(sparse,0x3000));
assert(mapCpu.test_virtual_map_commit(sparseTarget,0x1000));
const dib=mapCpu.test_dib_alloc(0x1000)>>>0;assert(dib>=0x50000000&&dib<0x53f00000);
const physical=a=>mapCpu.guest_to_wasm(a)>>>0; // setup/oracle ONLY
const put16=(a,v)=>dv.setUint16(physical(a),v,true);
function body(a,hp){if(!a)return;for(const [off,v] of [[0x22,hp],[0x14,7],[0x16,11],[0xe,2],[0x42,-123]])put16(a+off,v);}
function noEffects(f){
 for(const name of ['guest_to_wasm','test_g2w_slow','guest_write16','set_eip','set_esp','d3dim_lazy_enable'])
  f.e[name]=()=>{throw Error('observer invoked forbidden '+name);};
}
function memoryHash(){return crypto.createHash('sha256').update(b).digest('hex');}
const lazy=regions.BASE.D3DIM_LAZY_SHARED;
function clearLazy(){b.fill(0,lazy,lazy+32);}
clearLazy();
copy(0x42e666,0x19);
for(const [name,bodyPointer,targetPointer] of [
 ['direct',item,target],['direct+sparse',item,sparseTarget],['sparse+direct',sparse,target],
 ['sparse+null',sparse,0],['sparse+sparse',sparse,sparseTarget],['DIB+null',dib,0],
 ['direct+DIB',item,dib],['null+null',0,0]]){
 initial();wr(0x52173c,bodyPointer);wr(0x5216e0,targetPointer);body(bodyPointer,777);body(targetPointer,33);
 // Original 42e666..42e679 loads item and compares signed HP to zero.
 // Null is an observed pointer value, not a claim of valid Lara/game state.
 if(bodyPointer){const e=cpu(0x42e666);e.set_esi(0);assert.equal(until(e,[0x42e949,0x42e67f]),0x42e949,name);assert.equal(e.get_eax()>>>0,bodyPointer);}
 const f=fixture({weapon:true,stopAfterPair:true});noEffects(f);
 pair(f);enter(f);f.step({pc:0x431757,esp:G+4});
 // pair/enter are fixture writers, so verify observation separately below.
 const r=f.o.status();assert.equal(r.status,'witnessed',JSON.stringify({name,r}));assert(r.consumptionQualified);
 const snap=r.records.find(r=>r.kind==='input-published').state;
 assert.equal(snap.item,bodyPointer);assert.equal(snap.target,targetPointer);
 assert.equal(snap.itemState?.health??null,bodyPointer?777:null);assert.equal(snap.targetHealth,targetPointer?33:null);
 assert.equal(r.records.filter(r=>r.kind==='weapon-return').length,1);
 const endHash=memoryHash();f.step({pc:0x42e640,esp:G});assert.equal(memoryHash(),endHash,'removed observer cannot write');
 checks++;
}
// Hold fixtures' stack writes constant: full 512MB before/after hash proves
// the active reader leaves every guest/private/PTE/DIB/RPC byte unchanged.
initial();wr(0x52173c,sparse);wr(0x5216e0,sparseTarget);body(sparse,777);body(sparseTarget,33);
wr(A+0x68,0x41427f);wr(G,0x431757);
{const f=fixture({weapon:true,stopAfterPair:true});noEffects(f);poll(f);action(f);wr(0x51b178,64);
 const before=memoryHash();f.step({pc:0x41427f,esp:A+0x6c});f.step({pc:0x42e640,esp:G});f.step({pc:0x431757,esp:G+4});
 assert.equal(f.o.status().status,'witnessed');assert.equal(memoryHash(),before);checks++;}
// The former exact direct-window guard rejects this actually mapped HP read.
// This reproduces a causal observer defect; it does NOT recover the old run's
// lost address/pointer. Same pointers and bytes succeed above after repair.
{const a=sparse+0x22,p=a-0x400000+0x12000;assert(p+2>0x08000000);assert.equal(dv.getInt16(physical(a),true),777);checks++;}
for(const [name,ptr,field,reason,address] of [
 ['low-target',0x100,'targetHealth','pte-not-present',0x122],
 ['unmapped-target',0x14000000,'targetHealth','pte-not-present',0x14000022],
 ['wrapped-target',0xffffffff,'targetHealth','invalid-span',0x100000021],
 ['cross-page-hole',sparse+0x2fdd,'targetHealth','pte-not-present',sparse+0x2fff],
 ['bad-item',0x14000000,'itemState.health','pte-not-present',0x14000022],
 ['DIB-pending',dib,'targetHealth','dib-pending',dib+0x22],
 ['invalid-PTE',0x14000000,'targetHealth','invalid-pte-backing',0x14000022],
 ['PTE-out-of-memory',0x14000000,'targetHealth','backing-out-of-bounds',0x14000022]]){
 initial();clearLazy();const cell=regions.BASE.GUEST_PAGE_TABLE+(0x14000000>>>12)*4;
 dv.setUint32(cell,0,true);
 wr(name==='bad-item'?0x52173c:0x5216e0,ptr);
 if(name==='DIB-pending')dv.setUint32(lazy+4,4096,true);
 if(name==='invalid-PTE')dv.setUint32(cell,0x12000|0x800,true);
 if(name==='PTE-out-of-memory')dv.setUint32(cell,0x20000000|0x800,true);
 const f=fixture({weapon:true,stopAfterPair:true});noEffects(f);wr(A+0x68,0x41427f);poll(f);action(f);wr(0x51b178,64);
 const before=memoryHash();f.step({pc:0x41427f,esp:A+0x6c});const r=f.o.status();
 assert.equal(r.status,'unobservable',JSON.stringify({name,r}));assert(!r.qualified&&!r.consumptionQualified);assert(r.removed);
 assert.equal(r.records.length,2,'no fabricated or partial input/weapon row');
 assert.deepEqual(r.readFailure,{address,length:2,field,reason,kind:'input-published',pc:0x41427f,esp:A+0x6c,boundary:r.boundaries});
 assert.equal(memoryHash(),before);assert.equal(f.instance,f.original);checks++;
 dv.setUint32(cell,0,true);clearLazy();
}
// Boundary-spanning reads follow each actual PTE rather than assuming affine
// backing. Allocate the next page after an intervening allocation.
assert(mapCpu.test_virtual_map_commit(sparse+0x3000,0x1000));
assert.notEqual(physical(sparse+0x3000),physical(sparse+0x2000)+4096);
initial();wr(0x5216e0,sparse+0x2fdd);
b[physical(sparse+0x2fff)]=0x34;b[physical(sparse+0x3000)]=0x12;
{const f=fixture({weapon:true,stopAfterPair:true});pair(f);enter(f);f.step({pc:0x431757,esp:G+4});
 const r=f.o.status();assert.equal(r.status,'witnessed');assert.equal(r.records[2].state.targetHealth,0x1234);checks++;}
// Mapped memory cannot weaken saved-caller, stack or published-input causality.
for(const mode of ['saved-caller','saved-stack','changed-mask','wrong-weapon-caller']){
 initial();wr(0x52173c,sparse);wr(0x5216e0,sparseTarget);
 const f=fixture({weapon:true,stopAfterPair:true});
 if(mode==='saved-caller'){wr(A+0x68,0x450000);poll(f);action(f);}
 else if(mode==='saved-stack'){wr(A+0x68,0x41427f);poll(f);action(f);f.step({pc:0x41427f,esp:A+0x70});}
 else{pair(f);if(mode==='changed-mask')wr(0x51b178,0);enter(f,mode==='wrong-weapon-caller'?0x450000:0x431757);}
 const r=f.o.status();assert.equal(r.status,'unobservable');assert(!r.consumptionQualified);assert.equal(f.instance,f.original);checks++;
}
console.log(JSON.stringify({passed:true,checks,original:false,cpuSha256:crypto.createHash('sha256').update(bytes).digest('hex'),scope:'exact-byte offline branch slices and bounded observer state fixtures; no gameplay/backend/aim/hit claim'}));
// Exercise opt-in serialization in the real native hold orchestration; the
// stalled Worker request must still release Control on its independent timer.
(async()=>{
 const nativeHold=require('../scratch/runs/20261108-tr2-dog-encounter-1610/bound-input.cjs').hold;
 for(const mode of ['linked','mapped-linked','stalled-arm']){
  initial();if(mode==='mapped-linked'){wr(0x52173c,sparse);wr(0x5216e0,sparseTarget);body(sparse,777);body(sparseTarget,33);}
  const f=fixture();f.o.finish('removed');
  const c={instance:f.original,memory,GuestRpc:require('../lib/guest-rpc'),workerSlot:0,endpointIdentity:7,performance:{now:()=>0},setTimeout,clearTimeout,globalThis:null};c.globalThis=c;
  let unblock,released=false;const gate=new Promise(r=>{unblock=r;}),events=[];
  const watchdog=setTimeout(()=>unblock(),1000);
  try{
   const result=await observer.observedHold({weapon:true,exeSha256:context.module.exports.exeSha256,expectedEndpoint:7,workerSession:'fixture',
    evaluate:async code=>{const value=vm.runInNewContext(code,c);if(mode==='stalled-arm'&&code==='globalThis.__tr2Action.arm()')await gate;return value;},
    hold:arm=>nativeHold({keys:['Control'],holdMs:50,session:'fixture',send:async(method,p)=>{
     events.push(p.type);if(p.type==='keyDown')assert.equal(c.__tr2Action.status().boundaries,0);
     if(p.type==='keyUp'){released=true;unblock();}
    },sample:async()=>{
     await arm();
     if(mode!=='stalled-arm'){
      const adapter={step(row){f.queue.push(row);c.instance.exports.run(1);}};
      pair(adapter);enter(adapter);aim(adapter);fire(adapter);adapter.step({pc:0x431757,esp:G+4});
     }
     return {physical:[{key:17,state:0x8000}]};
    }}),record:async()=>{}});
   assert(released);assert.deepEqual(events,['keyDown','keyUp']);assert(result.receipt.releaseAt-result.receipt.started<500);
   assert.equal(result.qualified,mode!=='stalled-arm');
   if(mode==='mapped-linked')assert.equal(result.report.records.find(r=>r.kind==='input-published').state.itemState.health,777);assert.equal(c.instance,f.original);checks++;
  }finally{clearTimeout(watchdog);}
 }
 console.log(JSON.stringify({passed:true,orchestration:true,totalChecks:checks,activationAfterNativeKeydown:true,independentRelease:true,original:false}));
})().catch(e=>{console.error(e);process.exitCode=1;});
