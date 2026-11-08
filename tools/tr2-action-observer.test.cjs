'use strict';
// Same serialized observer used by the normal helper. State/call stacks below
// are fixtures, never evidence of an original poll, backend, firing or aiming.
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),vm=require('node:vm');
const {install,workerSource}=require('./tr2-action-observer.cjs');
const rpc=require('../lib/guest-rpc'),pe=require('../lib/pe').readPE('test/binaries/candidates/tomb-raider-2-demo/game/TOMB2.EXE');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const exeSha256=sha(pe.buf);assert.equal(exeSha256,'0811efa84bfab8c458b9e29976088152db4c14601a99ca4910c75a2d009233aa');
const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
const b=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),wa=a=>a-0x400000+0x12000;
// Only immutable instruction windows for static validation; never load/run PE.
for(const [a,n] of [[0x4471fc,16],[0x447233,8],[0x44d2b1,10],[0x44d3bf,48],[0x44d18a,8],[0x44d21d,7]])b.set(pe.buf.subarray(pe.va2off(a),pe.va2off(a)+n),wa(a));
const wr=(a,v)=>dv.setUint32(wa(a),v,true),w16=(a,v)=>dv.setUint16(wa(a),v,true);
let checks=0,boundedShotOrchestration;
function fixture(options={}){
 let clock=0,timer,removedTimer=false,pc=0x440000,esp=0x7401000,eax=0,ebx=0,blocks=0;
 const calls=[],queue=[];
 const e={get_image_base:()=>0x400000,get_current_thread_id:()=>1,get_eip:()=>pc,get_esp:()=>esp,get_eax:()=>eax,get_ebx:()=>ebx,
  get_yield_reason:()=>0,get_last_run_halt:()=>1,get_last_run_blocks:()=>blocks,
  run:n=>{calls.push(n);blocks=n;const row=queue.shift();if(row){({pc,esp=esp,eax=eax,ebx=ebx}=row);}}};
 const original={exports:e};let instance=original;
 const args={getInstance:()=>instance,replaceInstance:v=>{instance=v},memory,rpc,workerSlot:0,endpointIdentity:7,expectedEndpoint:7,exeSha256,
  now:()=>clock,schedule:fn=>{timer=fn;return 1;},cancel:()=>{removedTimer=true;},...options};
 const o=install(args);
 return {o,e,original,calls,args,queue,step(row){queue.push(row);instance.exports.run(1);},
  get instance(){return instance;},expire(){clock=3000;timer();},get cancelled(){return removedTimer;}};
}
function setup(){
 const v=rpc.views(memory,0).pub;v[rpc.SLOT.KEYS_VALID]=1;v[rpc.SLOT.GEN]=4;
 for(let i=0;i<8;i++)v[rpc.SLOT.KEYS+i]=0;
 for(const k of [17,162])v[rpc.SLOT.KEYS+(k>>>5)]|=1<<(k&31);
 w16(0x467f24,0x9d);w16(0x467f08,0x9d);wr(0x51b060,0);
 b[wa(0x51b095)]=128;b[wa(0x51b115)]=128;
 wr(0x7401004,0x44d2bb);wr(0x7401008,0x51b078);
 wr(0x7401008,0x51b078);wr(0x7401004,0x44d2bb);
}
function poll(f,pc=0x447206,hresult=0){f.step({pc,esp:0x7401000,eax:hresult});}
function action(f,result=1,ebx=64){
 f.step({pc:0x44d3c6,esp:0x7401008,eax:result,ebx:0});
 if(result){wr(0x7401004,0x44d3db);wr(0x7401008,9);f.step({pc:0x44d180,esp:0x7401004,ebx});}
 else f.step({pc:0x44d3d4,esp:0x740100c,ebx});
}
for(const mode of ['action','binding','zero','failed','retry','no-poll']){
 setup();const f=fixture();
 if(mode==='zero'){b[wa(0x51b095)]=0;b[wa(0x51b115)]=0;}
 if(mode==='binding'){w16(0x467f24,0x39);wr(0x51b060,1);}
 if(mode!=='no-poll')poll(f,0x447206,mode==='failed'||mode==='retry'?0x8007001e:0);
 if(mode==='retry')poll(f,0x447236,0);
 action(f,mode==='binding'?0:1,mode==='binding'?0:64);
 const r=f.o.finish('removed'),a=r.records.at(-1);
 assert.equal(r.status,'removed',JSON.stringify(r));assert(r.removed&&f.cancelled);assert.equal(f.instance,f.original);
 assert.equal(r.qualified,mode!=='no-poll');
 assert.equal(a.outcome,({action:'action-set-weapon-aim-unqualified',binding:'binding-action-clear',zero:'poll-without-control',failed:'poll-failed',retry:'action-set-weapon-aim-unqualified','no-poll':'no-poll-unqualified'})[mode]);
 if(mode==='binding')assert.deepEqual(a.binding,{configured:57,default:157,conflict:1});
 if(mode!=='no-poll')assert.deepEqual(r.records[0].bitmap.keys,[{vk:17,down:true},{vk:162,down:true},{vk:163,down:false}]);
 checks++;
}
for(const mode of ['overflow','expired','owner-replaced','unpublished','bad-caller','bad-code','pending']){
 setup();const f=fixture(mode==='overflow'?{maxRecords:1}:{});
 if(mode==='expired')f.expire();
 else if(mode==='owner-replaced'){f.args.replaceInstance({exports:f.e});f.expire();}
 else if(mode==='unpublished'){rpc.views(memory,0).pub[rpc.SLOT.KEYS_VALID]=0;poll(f);}
 else if(mode==='bad-caller'){wr(0x7401004,0);poll(f);}
 else if(mode==='bad-code'){b[wa(0x447206)]=0;poll(f);b[wa(0x447206)]=0x85;}
 else if(mode==='pending'){poll(f);f.step({pc:0x44d3c6,esp:0x7401008,eax:1});f.o.finish('removed');}
 else {poll(f);action(f);}
 const r=f.o.status();assert(!r.qualified,JSON.stringify(r));assert.notEqual(r.status,'active',mode);
 if(mode!=='owner-replaced')assert.equal(f.instance,f.original);
 const before=r.records.length;f.step({pc:0x447206});assert.equal(f.o.status().records.length,before,'removed observer cannot append');checks++;
}
setup();assert.throws(()=>fixture({maxMs:2501}));assert.throws(()=>fixture({expectedEndpoint:8}));checks+=2;
// The actual serialized Worker installation uses lexical instance and GuestRpc.
setup();const f=fixture();f.o.finish('removed');
const context={instance:f.original,memory,GuestRpc:rpc,workerSlot:0,endpointIdentity:7,performance:{now:()=>0},setTimeout:()=>1,clearTimeout:()=>{},globalThis:null};context.globalThis=context;
vm.runInNewContext(workerSource({expectedEndpoint:7,exeSha256}),context);
assert.notEqual(context.instance,f.original);context.__tr2Action.finish('removed');assert.equal(context.instance,f.original);checks++;
// Reuse unchanged native executor: a never-finishing observer request cannot
// prevent the independent keyUp. Resolve it only after observing keyUp.
async function independentRelease(){
 const {hold}=require('../scratch/runs/20261108-tr2-dog-encounter-1610/bound-input.cjs');
 let resolveSample,released=false;const events=[];
 const sample=new Promise(resolve=>{resolveSample=resolve;});
 const watchdog=setTimeout(()=>{resolveSample({timeout:true});},1000);
 try{
  const receipt=await hold({keys:['Control'],holdMs:50,session:'page',sample:()=>sample,
   send:async(method,p)=>{events.push(p.type);if(p.type==='keyUp'){released=true;resolveSample({released});}}});
  assert(released);assert.deepEqual(events,['keyDown','keyUp']);assert(receipt.releaseAt-receipt.started<500);checks++;
 }finally{clearTimeout(watchdog);}
}
async function stalledArmRelease(){
 const {observedHold}=require('./tr2-action-observer.cjs');
 const {hold}=require('../scratch/runs/20261108-tr2-dog-encounter-1610/bound-input.cjs');
 setup();const f=fixture();f.o.finish('removed');
 const c={instance:f.original,memory,GuestRpc:rpc,workerSlot:0,endpointIdentity:7,performance:{now:()=>0},setTimeout:()=>1,clearTimeout:()=>{},globalThis:null};c.globalThis=c;
 let unblock,released=false;const gate=new Promise(r=>{unblock=r;});
 const watchdog=setTimeout(()=>unblock(),1000);
 try{
  const result=await observedHold({evaluate:async source=>{
   const value=vm.runInNewContext(source,c);
   if(source==='globalThis.__tr2Action.arm()')await gate;
   return value;
  },workerSession:'cpu',expectedEndpoint:7,exeSha256,
  hold:arm=>hold({keys:['Control'],holdMs:50,session:'page',sample:async()=>{await arm();return {};},
   send:async(method,p)=>{if(p.type==='keyUp'){released=true;unblock();}}}),record:async()=>{}});
  assert(released);assert(result.receipt.releaseAt-result.receipt.started<500);
  assert(!result.qualified);assert.equal(c.instance,f.original);checks++;
 }finally{clearTimeout(watchdog);}
}
setup();{
 const f=fixture({defer:true});f.instance.exports.run(10000);
 assert.deepEqual(f.calls,[10000]);assert.equal(f.o.status().boundaries,0);
 f.expire();assert.throws(()=>f.o.arm(),/cannot arm/);assert.equal(f.instance,f.original);checks++;
}
setup();{
 const f=fixture({stopAfterPair:true});poll(f);action(f);
 assert.equal(f.o.status().status,'witnessed');assert(f.o.status().qualified);
 const count=f.o.status().records.length;
 for(let i=0;i<40;i++)f.step({pc:0x447206});
 assert.equal(f.o.status().records.length,count);assert.equal(f.instance,f.original);checks++;
}
function actualRunAdapter(){
 // Execute a three-byte synthetic INC/JMP loop, using the exact current
 // accepted production CPU module. No PE loader or original guest execution.
 const bytes=fs.readFileSync('build/wine-assembly.wasm');
 assert.equal(sha(bytes),'d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc');
 const m=new WebAssembly.Module(bytes),imports={host:{memory}};
 for(const entry of WebAssembly.Module.imports(m))if(entry.kind==='function')imports.host[entry.name]=()=>0;
 const original=new WebAssembly.Instance(m,imports),e=original.exports;
 e.init_thread(0,0x400000,0x450000,0x450100,0,0,0,0);e.set_esp(0x7401000);e.set_eip(0x450000);e.set_ebx(0);
 b.set([0x43,0xeb,0xfd],wa(0x450000));
 let instance=original;
 const o=install({getInstance:()=>instance,replaceInstance:v=>{instance=v},memory,rpc,workerSlot:0,endpointIdentity:7,expectedEndpoint:7,exeSha256,
  now:(()=>{let ticks=0;return ()=>++ticks<6?0:2500;})(),schedule:()=>1,cancel:()=>{}});
 const ex=instance.exports;ex.run(10);
 assert.equal(e.get_ebx(),10,'bound expiry continues remaining ordinary guest budget');
 assert.equal(ex.get_last_run_blocks(),10,'facade aggregates production run block counts');
 assert.equal(instance,original);assert.equal(o.status().status,'expired');assert(!o.status().qualified);checks++;
}
// A busy ordinary execution epoch is longer than the old lifetime allowance.
// Poll/Action still need to be witnessed afterwards, without a larger quota.
function coverageAfterBusyExecution(installObserver=install){
 setup();
 const bytes=fs.readFileSync('build/wine-assembly.wasm');
 assert.equal(sha(bytes),'d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc');
 const m=new WebAssembly.Module(bytes),imports={host:{memory}};
 for(const entry of WebAssembly.Module.imports(m))if(entry.kind==='function')imports.host[entry.name]=()=>0;
 const original=new WebAssembly.Instance(m,imports),e=original.exports;
 e.init_thread(0,0x400000,0x450000,0x450100,0,0,0,0);e.set_esp(0x7401000);e.set_eip(0x450000);e.set_ebx(0);
 b.set([0x43,0xeb,0xfd],wa(0x450000));
 let instance=original,clock=0;
 const o=installObserver({getInstance:()=>instance,replaceInstance:v=>{instance=v},memory,rpc,workerSlot:0,endpointIdentity:7,expectedEndpoint:7,exeSha256,
  now:()=>clock,schedule:()=>1,cancel:()=>{}});
 // Same CPU, same guest budget, continuous observation across normal calls.
 for(let i=0;i<12;i++){clock=i*10;instance.exports.run(1000);}
 assert.equal(e.get_ebx(),12000);
 const busy=o.status();
 // Authored harness transfer, not a loaded game: execute the immutable poll
 // and Action windows themselves on the exact CPU. No guest Win32 APIs run.
 // Success JGE target bridges the fixture stack to the pinned slot8 return.
 const bridge=[0x83,0xc4,8,0x31,0xdb,0xb8,1,0,0,0,0xe9];
 const rel=(0x44d3c6-(0x447248+bridge.length+4))|0;
 b.set([...bridge,rel&255,(rel>>>8)&255,(rel>>>16)&255,(rel>>>24)&255],wa(0x447248));
 e.set_ebp(0x7402000);e.set_eax(0);e.set_eip(0x447206);
 // Two blocks: poll test/JGE, bridge/JMP; then Action test/JE, OR/CALL.
 instance.exports.run(4);
 const result=o.finish('removed');
 return {busy,result,ebx:e.get_ebx()};
}
const coverage=coverageAfterBusyExecution();
assert.equal(coverage.busy.status,'active');assert(coverage.busy.boundaries>4097);
assert(coverage.result.qualified,JSON.stringify(coverage));
assert.equal(coverage.result.records.at(-1).outcome,'action-set-weapon-aim-unqualified');checks++;
// Overshooting folds and non-progress are part of run's real contract.
for(const mode of ['fold','no-progress','zero-budget','yield-entry']){
 setup();let instance,blocks=0,calls=[],yieldReason=mode==='yield-entry'?1:0;
 const e={get_image_base:()=>0x400000,get_current_thread_id:()=>1,get_eip:()=>0x440000,get_esp:()=>0x7401000,
  get_yield_reason:()=>yieldReason,get_last_run_halt:()=>1,get_last_run_blocks:()=>blocks,
  run:n=>{calls.push(n);blocks=mode==='no-progress'&&calls.length===1?0:mode==='fold'?3:Math.max(0,n);yieldReason=0;}};
 const original={exports:e};instance=original;
 const o=install({getInstance:()=>instance,replaceInstance:v=>{instance=v},memory,rpc,workerSlot:0,endpointIdentity:7,expectedEndpoint:7,exeSha256,
  now:()=>0,schedule:()=>1,cancel:()=>{}});
 const ex=instance.exports;ex.run(mode==='zero-budget'?0:5);
 if(mode==='fold'){assert.deepEqual(calls,[1,1]);assert.equal(ex.get_last_run_blocks(),6);}
 if(mode==='no-progress'){assert.deepEqual(calls,[1,5]);assert.equal(o.status().status,'no-progress');assert.equal(instance,original);}
 if(mode==='zero-budget')assert.deepEqual(calls,[0]);
 if(mode==='yield-entry')assert.equal(ex.get_last_run_blocks(),5);
 o.finish('removed');checks++;
}
async function actualOrchestration(){
 const {observedHold}=require('./tr2-action-observer.cjs');
 const nativeHold=require('../scratch/runs/20261108-tr2-dog-encounter-1610/bound-input.cjs').hold;
 for(const mode of ['good','no-poll','expired','release-failed','outside','no-physical']){
  setup();const f=fixture();f.o.finish('removed');
  const c={instance:f.original,memory,GuestRpc:rpc,workerSlot:0,endpointIdentity:7,performance:{now:()=>0},setTimeout:()=>1,clearTimeout:()=>{},globalThis:null};c.globalThis=c;
  const log=[];let final;
  const work=observedHold({evaluate:async s=>vm.runInNewContext(s,c),workerSession:'cpu',expectedEndpoint:7,exeSha256,
   hold:async arm=>{
    if(mode==='release-failed')throw Error('input release transport failure');
    const step=row=>{f.queue.push(row);c.instance.exports.run(1);};
    let sampled=false;
    const receipt=await nativeHold({keys:['Control'],holdMs:50,session:'page',
     send:async(method,p)=>{
      if(p.type==='keyDown')assert.equal(c.__tr2Action.status().boundaries,0,'no observation before native keyDown');
     },sample:async()=>{
      if(!sampled){sampled=true;await arm();if(mode==='expired')c.__tr2Action.finish('expired');if(mode!=='no-poll')step({pc:0x447206,esp:0x7401000,eax:0});step({pc:0x44d3c6,esp:0x7401008,eax:1,ebx:0});
       wr(0x7401004,0x44d3db);wr(0x7401008,9);step({pc:0x44d180,esp:0x7401004,ebx:64});}
      return {physical:[{key:17,state:mode==='no-physical'?0:0x8000}]};
     }});

    if(mode==='outside')receipt.started=Date.now()+1000;
    return receipt;
   },record:async(k,v)=>{log.push(k);final=v;}});
  if(mode==='release-failed'){await assert.rejects(work,/release transport/);assert.deepEqual(log,['observer']);assert.equal(c.instance,f.original);}
  else {const result=await work;assert.equal(result.qualified,mode==='good');assert.deepEqual(log,['observer','correlation']);assert.equal(final,result);}
  checks++;
 }
}
// Bounded multi-cycle fixtures. Original immutable arm/shot slices execute on
// the production CPU; harness transfers and frame commits remain authored.
// These are causal readiness tests, never original gameplay or shot evidence.
{
 const source=fs.readFileSync(require.resolve('./tr2-action-observer.cjs'),'utf8');
 const copy=(a,n)=>b.set(pe.buf.subarray(pe.va2off(a),pe.va2off(a)+n),wa(a));
 for(const m of source.matchAll(/\[0x([0-9a-f]+),'([0-9a-f]+)'\]/g))copy(parseInt(m[1],16),m[2].length/2);
 copy(0x42d4c0,0x330);copy(0x42f270,0x370);copy(0x466ad0,0x180);
 const bytes=fs.readFileSync('build/wine-assembly.wasm');
 assert.equal(sha(bytes),'d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc');
 const mod=new WebAssembly.Module(bytes),imports={host:{memory}};
 for(const entry of WebAssembly.Module.imports(mod))if(entry.kind==='function')imports.host[entry.name]=()=>0;
 const A=0x7401008,G=0x7400f00,item=0x530000;
 const pub=rpc.views(memory,0).pub;
 function start(options={}){
  setup();wr(0x52173c,item);w16(item+0x22,1000);wr(0x5216e0,0);
  w16(0x521662,4);w16(0x521664,2);w16(0x521700,0);w16(0x521712,0);
  w16(0x52170e,0);w16(0x5216fc,0);wr(0x521720,0);wr(0x51b178,64);b[wa(0x51fd96)]=0;
  return fixture({weapon:true,stopAfterPair:true,untilShot:true,...options});
 }
 function pair(f){
  f.step({pc:0x44d2a0,esp:A});
  wr(0x7401004,0x44d2bb);wr(0x7401008,0x51b078);wr(A+0x68,0x41427f);
  poll(f);action(f);wr(0x51b178,64);f.step({pc:0x41427f,esp:A+0x6c});
 }
 function enter(f){wr(G,0x431757);f.step({pc:0x42e640,esp:G});}
 function aim(f){wr(G-24,0x42e860);wr(G-20,2);f.step({pc:0x42d330,esp:G-24});wr(G-40,0x42d458);wr(G-36,2);f.step({pc:0x42d4c0,esp:G-40});}
 function returned(f){f.step({pc:0x431757,esp:G+4});}
 function slice(f){
  const e=new WebAssembly.Instance(mod,imports).exports;
  e.init_thread(0,0x400000,0x42d4c0,0x42d4c1,0,0,0,0);e.set_esp(G-40);e.set_eip(0x42d4c0);
  let entered=false;
  for(let n=0;n<100;n++){
   e.run(1);const pc=e.get_eip()>>>0;
   f.step({pc,esp:e.get_esp()>>>0,eax:e.get_eax()>>>0,ebx:e.get_ebx()>>>0});
   if(pc===0x42f270)entered=true;
   if(pc===0x42d59a){assert(entered);return {shot:true,result:e.get_eax()>>>0};}
   if(pc===0x42cf00){
    const frame=e.get_esi()&65535;
    // The animation dependency is outside this fixture. Commit the exact
    // branch-computed frame as an explicit harness continuation.
    w16(0x52170e,frame);return {shot:false,frame};
   }
  }
  throw Error('readiness slice failed to reach its bounded stop');
 }
 // Reproduce default first-return removal at the very first native raise.
 {const f=start({untilShot:false});pair(f);enter(f);aim(f);
  assert.deepEqual(slice(f),{shot:false,frame:1});returned(f);
  const r=f.o.status();assert.equal(r.status,'witnessed');assert(r.consumptionQualified);
  assert.equal(r.records.at(-1).state.arms[1].frame,1);assert(!r.shotQualified);
  console.log(JSON.stringify({fixture:'native-first-return',original:false,status:r.status,frame:r.records.at(-1).state.arms[1].frame,shotQualified:r.shotQualified}));checks++;
 }
 // Same causal raise boundaries, four completed updates, then the exact
 // native shot CALL and native zero-ammo RET (type2 fixture, result zero).
 {const f=start();
  for(let frame=1;frame<=4;frame++){
   pair(f);enter(f);aim(f);assert.deepEqual(slice(f),{shot:false,frame});returned(f);
   assert.equal(f.o.status().status,'active');assert.equal(f.o.status().records.length,frame*5);
   Atomics.add(pub,rpc.SLOT.GEN,1); // ordinary later publications are allowed
  }
  pair(f);enter(f);aim(f);assert.deepEqual(slice(f),{shot:true,result:0});
  const r=f.o.status();assert.equal(r.status,'witnessed',JSON.stringify(r));assert(r.shotQualified&&r.consumptionQualified&&r.qualified);
  assert.equal(r.completedCycles,4);assert.equal(r.records.length,26);assert(r.pendingWeapon&&!r.pendingShot);
  const ret=r.records.at(-1),entry=r.records[ret.shotRecord],a=r.records[ret.actionRecord];
  assert.equal(ret.kind,'shot-return');assert.equal(entry.kind,'shot-entry');assert.equal(entry.actionRecord,ret.actionRecord);
  assert.equal(r.records[a.poll].kind,'poll');assert.equal(a.poll,20);assert.equal(ret.result,0);
  console.log(JSON.stringify({fixture:'native-delayed-shot-return',original:false,status:r.status,completedCycles:r.completedCycles,shotQualified:r.shotQualified,
   records:r.records.map(({kind,pc,esp,actionRecord,shotRecord,poll,result,state})=>({kind,pc,esp,actionRecord,shotRecord,poll,result,frames:state?.arms.map(a=>a.frame)}))}));
  assert.equal(f.instance,f.original);const count=r.records.length;returned(f);assert.equal(f.o.status().records.length,count);checks++;
 }
 // Many repeated gate boundaries never consume the later-cycle row budget.
 {const f=start();pair(f);enter(f);aim(f);
  for(let n=0;n<200;n++)f.step({pc:n%2?0x42d54a:0x42d6d7,esp:G-60});
  returned(f);assert.equal(f.o.status().records.length,5);f.o.finish('removed');assert(!f.o.status().qualified);checks++;
 }
 for(const mode of ['crossed-update','crossed-poll','reuse','wrong-caller','wrong-return','wrong-shot-stack','wrong-mask','stale','invalid-publication','pending-action','pending-gun','pending-shot','deadline','overflow','unlinked-return']){
  const f=start(mode==='overflow'?{maxRecords:4}:{});pair(f);
  if(mode==='pending-action'){
   enter(f);returned(f);f.step({pc:0x44d2a0,esp:A});
   wr(0x7401004,0x44d2bb);wr(0x7401008,0x51b078);poll(f);
   f.step({pc:0x44d3c6,esp:A,eax:1});f.o.finish('removed');
  }else if(mode==='wrong-caller'){wr(G,0x450000);f.step({pc:0x42e640,esp:G});}
  else {
   enter(f);aim(f);
   if(mode==='crossed-update')f.step({pc:0x44d2a0,esp:A});
   if(mode==='crossed-poll')poll(f);
   if(mode==='reuse'){returned(f);enter(f);}
   if(mode==='wrong-mask'){wr(0x51b178,0x100040);f.step({pc:0x42d54a,esp:G-60});}
   if(mode==='stale'){Atomics.sub(pub,rpc.SLOT.GEN,1);f.step({pc:0x42d54a,esp:G-60});}
   if(mode==='invalid-publication'){Atomics.store(pub,rpc.SLOT.KEYS_VALID,0);f.step({pc:0x42d54a,esp:G-60});}
   if(['wrong-return','wrong-shot-stack','pending-shot'].includes(mode)){
    wr(G-80,0x42d59a);wr(G-76,2);wr(G-72,0);wr(G-68,item);wr(G-64,G-44);
    f.step({pc:0x42f270,esp:G-80});
    if(mode==='wrong-return')f.step({pc:0x42d724,esp:G-76});
    else if(mode==='wrong-shot-stack')f.step({pc:0x42d59a,esp:G-72});
    else f.o.finish('removed');
   }
   if(mode==='unlinked-return')f.step({pc:0x42d59a,esp:G-76});
   if(mode==='pending-gun')f.o.finish('removed');
   if(mode==='deadline')f.expire();
   if(mode==='overflow')returned(f);
  }
  const r=f.o.status();assert.notEqual(r.status,'active',JSON.stringify({mode,r}));assert(!r.qualified&&!r.shotQualified&&!r.consumptionQualified,JSON.stringify({mode,r}));
  assert(r.records.length<=32);assert.equal(f.instance,f.original);checks++;
 }
 // No shot within capacity must fail closed even after completed good cycles.
 {const f=start();for(let n=0;n<7;n++){pair(f);enter(f);returned(f);}
  const r=f.o.status();assert.equal(r.status,'overflow');assert.equal(r.records.length,32);assert(!r.qualified&&!r.shotQualified);checks++;
 }
 setup();assert.throws(()=>fixture({untilShot:true}),/requires weapon/);assert.throws(()=>fixture({weapon:true,untilShot:'yes'}),/requires weapon/);checks+=2;
 // The serialized public hold helper must require an in-hold shot, rather
 // than accepting a previous completed weapon cycle or an out-of-hold RET.
 boundedShotOrchestration=async()=>{
  const {observedHold}=require('./tr2-action-observer.cjs');
  for(const mode of ['shot','no-shot','outside','no-physical']){
   const f=start();f.o.finish('removed');
   const c={instance:f.original,memory,GuestRpc:rpc,workerSlot:0,endpointIdentity:7,performance:{now:()=>0},setTimeout:()=>1,clearTimeout:()=>{},globalThis:null};c.globalThis=c;
   const result=await observedHold({weapon:true,untilShot:true,expectedEndpoint:7,exeSha256,workerSession:'fixture',
    evaluate:async code=>vm.runInNewContext(code,c),record:async()=>{},hold:async arm=>{
     const started=Date.now()-1;await arm();
     const adapter={step(row){f.queue.push(row);c.instance.exports.run(1);}};
     pair(adapter);enter(adapter);aim(adapter);
     if(mode==='no-shot')returned(adapter);
     else{
      wr(G-80,0x42d59a);wr(G-76,2);wr(G-72,0);wr(G-68,item);wr(G-64,G-44);
      adapter.step({pc:0x42f270,esp:G-80});adapter.step({pc:0x42d59a,esp:G-76,eax:0});
     }
     return {started:mode==='outside'?Date.now()+1000:started,releaseAt:Date.now()+1,
      samples:[{whollyDuringHold:true,physical:[{key:17,state:mode==='no-physical'?0:0x8000}]}]};
    }});
   assert.equal(result.qualified,mode==='shot',JSON.stringify({mode,result}));
   assert.equal(result.shotsDuringHold,mode==='shot'||mode==='no-physical'?1:0);assert.equal(c.instance,f.original);checks++;
  }
 };
}
actualRunAdapter();
(async()=>{await independentRelease();await actualOrchestration();await stalledArmRelease();await boundedShotOrchestration();})().then(()=>console.log(JSON.stringify({passed:true,checks,original:false,backendQualified:false,
 scope:'production serialized observer with fixture CPU states and actual RPC layout; unchanged native independent release; static exact game pins'}))).catch(e=>{console.error(e);process.exitCode=1;});
