'use strict';
const {parentPort,workerData,threadId}=require('worker_threads');
const RPC=require(workerData.rpc);
const rpc=RPC.createWorkerImports(workerData.memory,workerData.selected,m=>parentPort.postMessage({kind:'rpc',message:m}),{slot:1});
const e=new WebAssembly.Instance(workerData.module,{host:{memory:workerData.memory,...rpc.imports.host}}).exports;
const dv=new DataView(workerData.memory.buffer);const rd=a=>dv.getUint32(a,true),wr=(a,v)=>dv.setUint32(a,v,true);
parentPort.on('message',({id,command})=>{
 try{
  if(command==='acquire')e.acquire(workerData.obj);
  else if(command==='unacquire')e.unacquire(workerData.obj);
  else if(command==='poll'){
   wr(e.g2w(workerData.count),16);wr(e.reg()+16,0x30000);
   e.getData(workerData.obj,16,workerData.buf,workerData.count,0);
   const count=rd(e.g2w(workerData.count)),records=[];
   for(let i=0;i<count;i++)records.push([rd(e.g2w(workerData.buf)+16*i),rd(e.g2w(workerData.buf)+16*i+4)]);
   parentPort.postMessage({kind:'result',id,hr:rd(e.reg()),count,records,threadId});return;
  }
  parentPort.postMessage({kind:'result',id,hr:rd(e.reg()),threadId});
 }catch(err){parentPort.postMessage({kind:'error',id,error:String(err.stack)});}
});
parentPort.postMessage({kind:'ready',threadId});
