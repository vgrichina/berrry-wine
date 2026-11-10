'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Module=require('node:module');
const q=require('./q3-menu-consumption.cjs'),current=require('./q3-current-module.cjs'),route=require('./q3-current-foreign-closure-v1.cjs');
const observer=require('../lib/q3-input-observer.js'),{createHostImports}=require('../lib/host-imports');
const root=path.resolve(__dirname,'..'),out=process.env.Q3_MENU_TEST_OUT;
assert(out&&path.resolve(out).startsWith(root+'/scratch/runs/'));fs.mkdirSync(out,{recursive:true});
const owner=Object.fromEntries(observer.ownerFields.map(k=>[k,'offline-'+k]));
const image={label:'startup',sha256:'a'.repeat(64),identity:owner};
const binding={id:'enter',label:'after',previous:image};
const bytes=q.compile();fs.writeFileSync(out+'/module.wasm',bytes);
assert(WebAssembly.validate(bytes));
const moduleHash=q.sha(bytes),config={version:q.version,url:'/offline.wasm',size:bytes.length,sha256:moduleHash};
const plain=route.composition(route.version).compose().source;assert.equal(q.compose(plain),plain);
process.env.Q3_BOUND_INPUT_OBSERVATION='1';
const generated=q.compose(route.composition(route.version).compose().source,config);
delete process.env.Q3_BOUND_INPUT_OBSERVATION;new vm.Script(Module.wrap(generated));
// Extract the actual emitted command body via the retained exact harness.
const filename=path.join(__dirname,'q3-input-observer.test.cjs');
const harness=fs.readFileSync(filename,'utf8').split('\n(async()=>{')[0];
const h=new Module(filename,module);h.filename=filename;h.paths=module.paths;
h._compile(harness+'\nmodule.exports={harness:m.exports};',filename);
async function consumer(mode){
 const memory=new ArrayBuffer(0x20000),e={get_eax:()=>7,get_esp:()=>0x401004};
 const o=q.recorder({getExports:()=>e,getMemory:()=>memory});let sent=0,marked=0,captured=0,cancelled=0;
 const p=h.exports.harness.page(false);
 p.scope.__q3BoundInput={begin:()=>({active:true})};
 const evaluate=async(expression,session)=>{
  if(session==='worker')return vm.runInNewContext(expression,{globalThis:{__q3MenuConsumption:o}});
  return p.evaluate(expression);
 };
 if(mode==='wrong-owner')o.begin(binding,owner);
 if(mode==='incomplete'){
  o.begin(binding,owner);o.event(1,0x40aa70,0x401010,0x401000);
 }
 const latest=mode==='wrong-owner'?{...image,identity:{...owner,epoch:'wrong'}}:image;
 const context={assert,root,deadline:Date.now()+60000,latest,out:'/offline',pageSession:'page',workers:new Map([['worker',{targetId:owner.workerTarget,sessionId:'worker'}]]),
  process:{env:{}},checkTerminal(){if(cancelled)throw Error('firstfailure');},observeTerminal(e){cancelled++;throw e;},
  fs:{readFileSync:f=>f.endsWith('-review.json')?JSON.stringify({...latest,review:'offline reviewed'}):'image'},sha:()=>image.sha256,
  save(){},log(){},send:async()=>{if(cancelled)throw Error('terminal before protocol');sent++;if(mode==='firstfailure'){cancelled++;throw Error('first native failure');}return {};},evaluate,wait:async()=>{},trace:{span:(_,f)=>f()},
  bound:require('./q3-input-delivery.cjs'),chain:{admit:async(_,f)=>f({live:{identity:latest.identity}}),progress:async()=>({physical:[{key:13,state:0}]})},
  capture:async()=>{captured++;},require:n=>n==='./ordinary-keys.cjs'?require('../scratch/runs/20261108-q3-gl-readiness-gameplay/ordinary-keys.cjs'):require(n)};
 const run=h.exports.harness.body(generated,context);
 const command={id:'enter',action:'key',key:'Enter',holdMs:50,waitMs:0,reviewRef:'startup',label:'after'};
 if(mode==='success'){await run(command,()=>marked++);assert.equal(marked,1);assert.equal(sent,2);assert.equal(captured,1);}
 else {
  await assert.rejects(run(command,()=>marked++));
  assert.equal(captured,0);
  if(mode==='firstfailure'){assert.equal(marked,1);assert.equal(sent,1);o.stop('firstfailure');const count=o.snapshot(owner).records.length;o.event(1,0x40aa70,0x401010,0x401000);assert.equal(o.snapshot(owner).records.length,count);}
  else {assert.equal(marked,0);assert.equal(sent,0);}
 }
 return {mode,sent,marked,captured};
}
async function compiled(){
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),ctx={exports:null,getMemory:()=>memory.buffer};
 const host=createHostImports(ctx).host;Object.assign(host,{memory,log(){},log_i32(){},exit(){}});
 const scope={WebAssembly:{instantiate:WebAssembly.instantiate,compile:WebAssembly.compile},
  fetch:async()=>({ok:true,arrayBuffer:async()=>bytes}),crypto:require('node:crypto').webcrypto,performance,console:{debug(){}},memory,
  endpointIdentity:1,workerSlot:0};
 vm.createContext(scope);vm.runInContext(q.workerSource(config),scope);
 const instance=await scope.WebAssembly.instantiate(await WebAssembly.compile(bytes),{host}),e=ctx.exports=instance.exports;
 scope.instance=instance;scope.__mcmPassiveInstanceV1={ids:new WeakMap([[instance,'actual-fixture-instance']])};
 const o=scope.__q3MenuConsumption,live={...owner,moduleSha256:moduleHash,endpoint:1,workerInstance:'actual-fixture-instance'};
 const liveBinding={...binding,previous:{...image,identity:live}};
 const mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),exe=fs.readFileSync(root+'/test/binaries/notepad.exe');
 mem.set(exe,e.get_staging());e.load_pe(exe.length);e.set_api_log(0);
 const wa=a=>a-0x400000+0x12000,put=(a,b)=>{mem.set(b,wa(a));e.invalidate_code_range(a,b.length);};
 const d32=v=>[v&255,v>>>8&255,v>>>16&255,v>>>24&255];
 put(0x401000,[0xe8,...d32(0x40aa70-0x401005),0xeb,0xfe]);
 put(0x40aa70,[0xb8,...d32(123),0xc3]);
 e.set_esp(0x74ff000);e.set_eip(0x401000);
 // This is a synthetic x86 fixture, never an original-game handler call.
 // Natural CALL/RET in the real generated module must supply the evidence.
 const before=Buffer.from(memory.buffer.slice(wa(0x401000),wa(0x401010)));
 o.begin(liveBinding,live);e.run(10);
 const s=o.snapshot(live);assert.equal(s.reason,null);assert.equal(s.pendingFrames,0);
 assert.deepEqual(Array.from(s.records.filter(r=>r.kind.startsWith('guest-')),r=>r.kind),['guest-call','guest-entry','guest-return']);
 assert.equal(s.records.find(r=>r.kind==='guest-return').result,123);
 assert.equal(e.get_eax(),123);assert.equal(e.get_esp(),0x74ff000);
 assert.deepEqual(Buffer.from(memory.buffer.slice(wa(0x401000),wa(0x401010))),before);
 // All nineteen fields refuse independently, and an observation cannot revive.
 for(const field of observer.ownerFields){const r=q.recorder({getExports:()=>e,getMemory:()=>memory.buffer});assert.throws(()=>r.begin(binding,{...owner,[field]:'wrong'}),/binding/);assert.throws(()=>r.begin(binding,owner),/terminal/);}
 let calls=0;const original=function(x){calls++;assert.equal(this,host);return x;};
 assert.equal(o.wrap('check_input',original).call(host,0x000d0100),0x000d0100);assert.equal(calls,1);
 const sentinel=Error('original import');assert.throws(()=>o.wrap('check_input',()=>{throw sentinel;})(),x=>x===sentinel);assert.equal(o.snapshot(live).reason,'production-import-failure');
 return {moduleHash,size:bytes.length,realGeneratedWasm:true,naturalCallEntryReturn:true};
}
(async()=>{
 const controls=[];for(const mode of ['wrong-owner','incomplete','success','firstfailure'])controls.push(await consumer(mode));
 const native=await compiled();const result={passed:true,controls,native,defaultInert:true};
 fs.writeFileSync(out+'/controls.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1;});
