'use strict';
// Actual Node OS Worker RPC using the production broker and worker imports.
require('./helpers/directinput-independent-accept-oct27')(String.raw`
(async()=>{
const {Worker,threadId}=require('worker_threads');
const RPC=require('../lib/guest-rpc');
const sigs=require('../lib/host-import-sigs.generated.json').sigs;
const selected=Object.fromEntries(WebAssembly.Module.imports(module_).filter(x=>x.kind==='function').map(x=>[x.name,sigs[x.name]]));
e.unacquire(obj);
const property=0x23000,format=0x24000,objects=0x25000;
[20,16,0,0,9].forEach((v,i)=>wr(e.g2w(property)+i*4,v));e.setBufferSize(obj,property);assert.equal(rd(e.reg()),0);
[24,16,2,16,2,objects].forEach((v,i)=>wr(e.g2w(format)+i*4,v));
[[28,3],[57,7]].forEach(([dik,ofs],i)=>[0,ofs,(dik<<8)|12,0].forEach((v,j)=>wr(e.g2w(objects)+i*16+j*4,v)));
e.setFormat(obj,format);assert.equal(rd(e.reg()),0);
let phase='none',injected=false;const operations=[];
function tap(vk){renderer.handleKeyDown(vk);renderer.handleKeyUp(vk);while(renderer.checkInput()){};broker.publish({});}
function input(){tap(13);tap(32);}
const broker=RPC.createMainBroker(memory,{...imports.host,di_keyboard_buffer(device,op,value){
 const result=host.di_keyboard_buffer(device,op,value);
 if(op===8||op===9)operations.push({phase,device,op,value,result,acquired:!!(rd(e.entry()+28)&0x400)});
 if(phase==='partial'&&!injected&&op===9&&value===13){
  injected=true;input();
  console.log(JSON.stringify({group:'input interleaved after first selection RPC response',phase,
   acquired:!!(rd(e.entry()+28)&0x400),input:['Return down','Return up','Space down','Space up'],
   selectedSoFar:operations.filter(x=>x.phase===phase&&x.op===9).map(x=>x.value)}));
 }
 return result;
}},selected,{});
const code=fs.readFileSync(path.join(ROOT,'test/helpers/directinput-independent-os-worker-oct27.js'),'utf8');
let next=0;const pending=new Map();let readyResolve,readyReject;
const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
const worker=new Worker(code,{eval:true,execArgv:[],resourceLimits:{maxOldGenerationSizeMb:512},workerData:{rpc:path.join(ROOT,'lib/guest-rpc.js'),selected,module:module_,memory,obj,count,buf}});
worker.on('error',err=>{readyReject(err);for(const p of pending.values())p.reject(err);});
worker.on('message',m=>{
 if(m.kind==='ready'){readyResolve(m);return;}
 if(m.kind==='rpc'){
  const msg=m.message;
  if(msg.t==='rpc')assert.equal(broker.serveRpc(msg.slot),true);
  else throw Error('unexpected transport message '+JSON.stringify(msg));
  return;
 }
 const p=pending.get(m.id);if(!p)return;pending.delete(m.id);
 if(m.kind==='error')p.reject(Error(m.error));else p.resolve(m);
});
function request(command){const id=++next;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});worker.postMessage({id,command});});}
const timer=setTimeout(()=>{for(const p of pending.values())p.reject(Error('bounded Worker deadline'));readyReject(Error('Worker startup deadline'));worker.terminate();},15000);
const stream=[[3,128],[3,0],[7,128],[7,0]];
function atomicOracle(r){assert.equal(r.hr,0);assert.equal(r.count,r.records.length);
 assert(stream.some((_,i)=>JSON.stringify(stream.slice(i))===JSON.stringify(r.records))||r.count===0,'one acquisition boundary must retain a suffix of ordered selected input, never an earlier key while losing a later selected key');}
try{
 const identity=await ready;assert.notEqual(identity.threadId,threadId);
 console.log(JSON.stringify({group:'actual OS Worker identity',main:threadId,worker:identity.threadId,rpcSHA256:sha(fs.readFileSync(path.join(ROOT,'lib/guest-rpc.js'))),selected}));
 phase='before';input();assert.equal((await request('acquire')).hr,0);
 const before=await request('poll');assert.equal(before.count,0);atomicOracle(before);await request('unacquire');
 phase='after';assert.equal((await request('acquire')).hr,0);input();
 const after=await request('poll');atomicOracle(after);assert.deepEqual(after.records,stream);await request('unacquire');
 const rejected=[];
 for(const [name,result] of [['lost later selected key',{hr:0,count:2,records:stream.slice(0,2)}],['reordered edges',{hr:0,count:4,records:[...stream].reverse()}],['false overflow',{...after,hr:1}]]){
  assert.throws(()=>atomicOracle(result),assert.AssertionError);rejected.push(name);
 }
 console.log(JSON.stringify({group:'acquisition atomicity controls',before,after,rejected,pass:true}));
 phase='partial';assert.equal((await request('acquire')).hr,0);assert(injected);
 const observed=await request('poll');
 console.log(JSON.stringify({group:'partially initialized acquired filter',observed,operations,
  expected:'single acquisition boundary: empty or suffix of Return down/up then Space down/up; never Return-only',
  fullModule:false,actualOSWorker:true,gameplay:false}));
 atomicOracle(observed);
}finally{
 clearTimeout(timer);phase='cleanup';await worker.terminate();host.di_keyboard_buffer(e.entry(),1,0);
 console.log(JSON.stringify({group:'Worker cleanup',terminated:true,pending:pending.size}));
}
})().catch(err=>{console.error(err.stack);process.exitCode=1;});
`);
