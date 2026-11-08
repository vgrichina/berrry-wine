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
let checks=0;
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
for(const mode of ['overflow','expired','boundary-limit','owner-replaced','unpublished','bad-caller','bad-code','pending']){
 setup();const f=fixture(mode==='overflow'?{maxRecords:1}:mode==='boundary-limit'?{maxBoundaries:1}:{});
 if(mode==='expired')f.expire();
 else if(mode==='boundary-limit')f.step({pc:0x440001});
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
 const o=install({getInstance:()=>instance,replaceInstance:v=>{instance=v},memory,rpc,workerSlot:0,endpointIdentity:7,expectedEndpoint:7,exeSha256,maxBoundaries:4,
  now:()=>0,schedule:()=>1,cancel:()=>{}});
 const ex=instance.exports;ex.run(10);
 assert.equal(e.get_ebx(),10,'bound expiry continues remaining ordinary guest budget');
 assert.equal(ex.get_last_run_blocks(),10,'facade aggregates production run block counts');
 assert.equal(instance,original);assert.equal(o.status().status,'boundary-limit');assert(!o.status().qualified);checks++;
}
async function actualOrchestration(){
 const {observedHold}=require('./tr2-action-observer.cjs');
 const nativeHold=require('../scratch/runs/20261108-tr2-dog-encounter-1610/bound-input.cjs').hold;
 for(const mode of ['good','no-poll','expired','release-failed','outside','no-physical']){
  setup();const f=fixture();f.o.finish('removed');
  const c={instance:f.original,memory,GuestRpc:rpc,workerSlot:0,endpointIdentity:7,performance:{now:()=>0},setTimeout:()=>1,clearTimeout:()=>{},globalThis:null};c.globalThis=c;
  const log=[];let final;
  const work=observedHold({evaluate:async s=>vm.runInNewContext(s,c),workerSession:'cpu',expectedEndpoint:7,exeSha256,
   hold:async()=>{
    if(mode==='release-failed')throw Error('input release transport failure');
    const step=row=>{f.queue.push(row);c.instance.exports.run(1);};
    let sampled=false;
    const receipt=await nativeHold({keys:['Control'],holdMs:50,session:'page',
     send:async(method,p)=>{
      if(p.type==='keyDown'&&mode!=='no-poll')step({pc:0x447206,esp:0x7401000,eax:0});
     },sample:async()=>{
      if(!sampled){sampled=true;step({pc:0x44d3c6,esp:0x7401008,eax:1,ebx:0});
       wr(0x7401004,0x44d3db);wr(0x7401008,9);step({pc:0x44d180,esp:0x7401004,ebx:64});}
      return {physical:[{key:17,state:mode==='no-physical'?0:0x8000}]};
     }});
    if(mode==='expired')c.__tr2Action.finish('expired');
    if(mode==='outside')receipt.started=Date.now()+1000;
    return receipt;
   },record:async(k,v)=>{log.push(k);final=v;}});
  if(mode==='release-failed'){await assert.rejects(work,/release transport/);assert.deepEqual(log,['observer']);assert.equal(c.instance,f.original);}
  else {const result=await work;assert.equal(result.qualified,mode==='good');assert.deepEqual(log,['observer','correlation']);assert.equal(final,result);}
  checks++;
 }
}
actualRunAdapter();
Promise.all([independentRelease(),actualOrchestration()]).then(()=>console.log(JSON.stringify({passed:true,checks,original:false,backendQualified:false,
 scope:'production serialized observer with fixture CPU states and actual RPC layout; unchanged native independent release; static exact game pins'}))).catch(e=>{console.error(e);process.exitCode=1;});
