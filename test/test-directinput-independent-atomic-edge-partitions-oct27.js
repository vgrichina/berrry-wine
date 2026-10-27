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
let cut=0,activated=false;const trace=[];
const edges=[[13,true],[13,false],[32,true],[32,false]];
function edge([vk,down]){renderer[down?'handleKeyDown':'handleKeyUp'](vk);while(renderer.checkInput()){};broker.publish({});}
const broker=RPC.createMainBroker(memory,{...imports.host,di_keyboard_buffer(device,op,value){
 if(op===10){
  for(const item of edges.slice(0,cut))edge(item);
  trace.push({where:'before activation host call',cut,acquired:!!(rd(e.entry()+28)&0x400)});
 }
 const result=host.di_keyboard_buffer(device,op,value);
 if(op===10){activated=true;trace.push({where:'host call completed; response not yet published',cut,result,acquired:!!(rd(e.entry()+28)&0x400)});}
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
  if(msg.t==='rpc'){
   assert.equal(broker.serveRpc(msg.slot),true);
   if(activated){activated=false;
    trace.push({where:'serveRpc returned; response stored and notified',cut,acquired:!!(rd(e.entry()+28)&0x400)});
    for(const item of edges.slice(cut))edge(item);
   }
  }
  else throw Error('unexpected transport message '+JSON.stringify(msg));
  return;
 }
 const p=pending.get(m.id);if(!p)return;pending.delete(m.id);
 if(m.kind==='error')p.reject(Error(m.error));else p.resolve(m);
});
function request(command){const id=++next;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});worker.postMessage({id,command});});}
const timer=setTimeout(()=>{for(const p of pending.values())p.reject(Error('bounded Worker deadline'));readyReject(Error('Worker startup deadline'));worker.terminate();},15000);
const stream=[[3,128],[3,0],[7,128],[7,0]];
try{
 const identity=await ready;assert.notEqual(identity.threadId,threadId);
 for(cut=0;cut<=4;cut++){
  assert.equal((await request('acquire')).hr,0);
  const r=await request('poll');assert.equal(r.hr,0);assert.equal(r.count,4-cut);
  assert.deepEqual(r.records,stream.slice(cut),'individual-edge activation must retain exact suffix');
  console.log(JSON.stringify({group:'individual-edge Worker activation partition',cut,observed:r,trace:trace.splice(0),main:threadId,worker:identity.threadId,pass:true}));
  await request('unacquire');
 }
}finally{
 clearTimeout(timer);await worker.terminate();host.di_keyboard_buffer(e.entry(),1,0);
 console.log(JSON.stringify({group:'Worker cleanup',terminated:true,pending:pending.size}));
}
})().catch(err=>{console.error(err.stack);process.exitCode=1;});
`);
