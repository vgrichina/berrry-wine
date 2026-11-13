'use strict';
const assert=require('assert'),path=require('path'),{Worker}=require('worker_threads'),{compileSrcWasm}=require('./compile-src');
const {Device}=require('../lib/d3d9-software-backend'),{WorkerConsumer,CommandQueue,OPCODES:O}=require('../lib/d3d-command-stream');
const sigs=require('../lib/host-import-sigs.generated.json').sigs,cases=require('./fixtures/d3d9-color-cases');
(async()=>{
 const module=await WebAssembly.compile(compileSrcWasm()),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),host={memory};
 for(const [name,sig]of Object.entries(sigs))host[name]=sig.results?.length?()=>0:()=>{};
 const e=(await WebAssembly.instantiate(module,{host})).exports;e.d3dim_worker_init(0x400000);
 const direct=new Device({getExports:()=>e,getMemory:()=>memory.buffer,width:8,height:8});
 const worker=new Worker(path.join(__dirname,'../lib/d3d-render-worker.js'));
 const consumer=new WorkerConsumer(worker,{module,memory,sigs,imageBase:0x400000,sourceVersion:'color-test',reclaimHeap:head=>e.d3d_render_adopt_free_list(head)});
 try{
  await consumer.ready;
  for(const [name,queue]of[['direct',new CommandQueue({deviceId:1,consumer:{execute:c=>direct.execute(c)}})],['worker',new CommandQueue({deviceId:2,consumer})]]){
   const send=async(op,p)=>{const r=queue.submit(op,p);const value=await r.value;await r.completion;if(value?.error)throw Error(value.error.message||value.error);return value;};
   if(name==='worker')await send(O.RESOURCE_CREATE,{kind:'device',width:8,height:8});
   const api={create:(resource)=>send(O.RESOURCE_CREATE,{kind:'color',resource}),update:(resource,pixels,pitch,rect)=>send(O.RESOURCE_UPDATE,{kind:'color',resource,pixels,pitch,rect}),
    clear:(color,flags,depth,rects,depthAttachment,stencil,colorAttachment)=>send(O.CLEAR,{color,flags,depth,rects,depthAttachment,stencil,colorAttachment}),
    copy:p=>send(O.COPY,p),draw:p=>send(O.DRAW,p),read:resource=>send(O.READBACK,{resource}),present:()=>send(O.PRESENT,{}),release:id=>send(O.RESOURCE_RELEASE,{kind:'color',id})};
   console.log(name+' independent color cases PASS '+await cases.run(api));
   await send(O.RESOURCE_RELEASE,{kind:'device'});
  }
 }finally{direct.destroy();await consumer.cancel();assert.strictEqual(worker.threadId,-1);assert(Number.isInteger(consumer.shutdownInfo.heapAdopted),'worker heap reclaimed after exit');}
})().catch(e=>{console.error(e);process.exitCode=1;});
