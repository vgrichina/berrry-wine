'use strict';
// Only authored stacks/data and immutable original slices; no original run.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),Module=require('node:module'),crypto=require('node:crypto');
const file=require.resolve('./tr2-weapon-consumption.test.cjs');
const prefix=fs.readFileSync(file,'utf8').split("for(const mode of ['shot-both'")[0];
const c={require:Module.createRequire(file),module:{exports:{}},WebAssembly,DataView,Uint8Array,Atomics};
vm.runInNewContext(prefix+'\nmodule.exports={initial,copy,memory,b,dv,wa,wr,w16,pe};',c);
const {initial,copy,memory,b,dv,wa,wr,w16,pe}=c.module.exports;
const observer=require('./tr2-action-observer.cjs'),rpc=require('../lib/guest-rpc');
const modulePath='scratch/runs/20261108-tr2-presenter-getter-native/modules/wine-assembly-d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc.wasm';
const bytes=fs.readFileSync(modulePath),sha=v=>crypto.createHash('sha256').update(v).digest('hex');
assert.equal(sha(bytes),'d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc');
const mod=new WebAssembly.Module(bytes),imports={host:{memory}};
for(const i of WebAssembly.Module.imports(mod))if(i.kind==='function')imports.host[i.name]=()=>0;
const A=0x7401008,G=0x7400f00,S=G-80,H=S-0x264,target=0x530100,item=0x530000;
copy(0x42f4f0,0x186);copy(0x466ad0,0x180);
// Blood dependency is an explicitly authored RET. Geometry/RNG/AI never run.
b[wa(0x41c470)]=0xc3;
let checks=0;
function fixture(opts={}){
 initial();wr(0x5216e0,opts.nullTarget?0:target);w16(target+0xc,7);w16(target+0x22,10);
 const native=new WebAssembly.Instance(mod,imports).exports;
 native.init_thread(0,0x400000,0x42f4f0,0x42f676,0,0,0,0);
 let real=false,pc=0x440000,esp=G,eax=0,ebx=0,blocks=0,clock=0;
 const e={};for(const n of ['get_eip','get_esp','get_eax','get_ebx'])e[n]=()=>real?native[n]():({get_eip:pc,get_esp:esp,get_eax:eax,get_ebx:ebx}[n]);
 Object.assign(e,{get_image_base:()=>0x400000,get_current_thread_id:()=>1,get_yield_reason:()=>real?native.get_yield_reason():0,
  get_last_run_halt:()=>real?native.get_last_run_halt():1,get_last_run_blocks:()=>real?native.get_last_run_blocks():blocks,
  run:n=>{if(real)native.run(n);else blocks=n;}});
 const original={exports:e};let instance=original;
 const o=observer.install({getInstance:()=>instance,replaceInstance:v=>{instance=v},memory,rpc,workerSlot:0,endpointIdentity:7,expectedEndpoint:7,
  exeSha256:sha(pe.buf),weapon:true,untilShot:true,maxRecords:opts.maxRecords??32,now:()=>clock,schedule:()=>1,cancel:()=>{}});
 function step(p,s=esp,a=eax,x=ebx){pc=p;esp=s;eax=a;ebx=x;instance.exports.run(1);}
 wr(A+0x68,0x41427f);step(0x447206,0x7401000,0);
 step(0x44d3c6,A,1,0);wr(A-4,0x44d3db);wr(A,9);step(0x44d180,A-4,1,64);
 wr(0x51b178,64);step(0x41427f,A+0x6c);wr(G,0x431757);step(0x42e640,G);
 wr(G-24,0x42e860);step(0x42d330,G-24);wr(G-40,0x42d458);step(0x42d4c0,G-40);
 wr(S,opts.wrongShotCaller?0x450000:0x42d59a);wr(S+4,1);wr(S+8,opts.nullTarget?0:target);wr(S+12,item);wr(S+16,S+100);
 step(0x42f270,S);
 return {o,e,native,step,get instance(){return instance;},original,
  expire(){clock=3000;step(0x440000);},
  runTail({amount=3,health=10,object=7,entry=0x42f4f0}={}){
   w16(target+0x22,health);w16(target+0xc,object);wr(H+0x14,0x466afe);wr(0x466afe+0x20,amount);wr(0x4d8768,1);
   // Restore callee-saved slots consumed by the exact shot epilogue.
   for(let a=H;a<H+16;a+=4)wr(a,0);
   native.set_eip(entry);native.set_esp(H);real=true;
   for(let n=0;n<200&&o.status().status==='active';n++)instance.exports.run(1);
   assert.notEqual(o.status().status,'active','native slice must terminate observation');real=false;
  }};
}
for(const [name,args,want] of [
 ['damage',{amount:3},true],['zero',{amount:0},false],['heal',{amount:-2},false],
 ['health-cross-zero',{health:2,amount:3},true],['stale-object',{object:8},false]]){
 const f=fixture();f.runTail(args);const r=f.o.status(),row=r.records.at(-1),d=row.damage;
 assert.equal(r.status,'witnessed',JSON.stringify(r));assert(r.shotQualified);assert.equal(row.result,1);
 assert(d.returned);assert.equal(d.esp,S-0x274);assert.equal(d.caller,0x42f50a);
 assert.equal(d.positiveDamageObserved,want,name);assert.equal(row.entryTarget.health,10);
 assert.equal(row.targetHealthDelta, name==='stale-object'?null:10-((args.health??10)-(args.amount??3)));
 assert.equal(r.records.length,6,'damage adds no records');assert(r.records.length<=32);
 assert.equal(f.instance,f.original);checks++;
}
// Native miss/reject epilogues return -1/0 exactly, without a damage call.
for(const [entry,result] of [[0x42f5b3,0xffffffff],[0x42f5c1,0]]){
 const f=fixture({nullTarget:true});f.native.set_eax(0x52171c);f.native.set_ebx(0);
 f.runTail({entry});const row=f.o.status().records.at(-1);
 assert.equal(row.result,result);assert.equal(row.target,0);assert.equal(row.entryTarget,null);assert.equal(row.returnTarget,null);assert.equal(row.damage,null);assert.equal(row.targetHealthDelta,null);checks++;
}
for(const mode of ['wrong-damage-target','wrong-damage-caller','wrong-damage-stack','unlinked-damage-return','wrong-shot-return-stack','pending-damage','stale-generation','wrong-owner','delta-without-call']){
 const f=fixture();
 if(mode==='wrong-owner')f.e.get_current_thread_id=()=>2; // facade retains function? observer reads original e.
 if(mode==='stale-generation')rpc.views(memory,0).pub[rpc.SLOT.GEN]=3;
 if(mode.startsWith('wrong-damage')||mode==='pending-damage'){
  const D=S-0x274;wr(D,mode==='wrong-damage-caller'?0x450000:0x42f50a);wr(D+4,mode==='wrong-damage-target'?item:target);wr(D+12,3);
  f.step(0x42f5e0,D+(mode==='wrong-damage-stack'?4:0));
  if(mode==='pending-damage')f.step(0x42d59a,S+4,-1);
 }else if(mode==='unlinked-damage-return')f.step(0x42f50a,S-0x270);
 else if(mode==='wrong-shot-return-stack')f.step(0x42d59a,S+8,-1);
 else if(mode==='delta-without-call'){w16(target+0x22,5);f.step(0x42d59a,S+4,-1);}
 else f.step(0x440000);
 const r=f.o.status();
 if(mode==='delta-without-call'){assert(r.shotQualified);assert.equal(r.records.at(-1).targetHealthDelta,5);assert.equal(r.records.at(-1).damage,null);}
 else {assert(!r.shotQualified);assert.notEqual(r.status,'active');}
 assert(r.records.length<=32);assert.equal(f.instance,f.original);checks++;
}
// Passive observation snapshots all 512MB; fixture writes happen before hash.
{const f=fixture();const before=sha(b);f.step(0x440000);assert.equal(sha(b),before);f.expire();assert.equal(f.o.status().status,'expired');checks++;}
{const f=fixture(),D=S-0x274;wr(D,0x42f50a);wr(D+4,target);wr(D+12,3);
 const before=sha(b);f.step(0x42f5e0,D);assert.equal(sha(b),before);
 w16(target+0x22,7);const after=sha(b);f.step(0x42f50a,D+4);f.step(0x42d59a,S+4,1);
 assert.equal(sha(b),after);assert(f.o.status().records.at(-1).damage.positiveDamageObserved);checks++;}
{const f=fixture({maxRecords:5});f.runTail();const r=f.o.status();assert.equal(r.status,'overflow');assert.equal(r.records.length,5);assert(!r.shotQualified);checks++;}
{const f=fixture({wrongShotCaller:true});assert.equal(f.o.status().status,'unobservable');assert(!f.o.status().shotQualified);checks++;}
console.log(JSON.stringify({passed:true,checks,modulePath,cpuSha256:sha(bytes),original:false,scope:'real x86 shot-call/damage/return slices with authored blood RET; no geometry, aim, game, kill or backend qualification'}));
