'use strict';
const assert=require('assert/strict');
const {Worker,isMainThread,parentPort,workerData}=require('worker_threads');
const root=require('path').resolve(__dirname,'..'),RPC=require(root+'/lib/guest-rpc');
const sigs={pit_io:require(root+'/lib/host-import-sigs.generated.json').sigs.pit_io};
if(!isMainThread){
  const rpc=RPC.createWorkerImports({buffer:workerData.buffer},sigs,msg=>parentPort.postMessage(msg),{slot:3});
  rpc.imports.host.pit_io(0x42,0x12,1,1); // complete the MAIN's low-byte write
  assert.equal(rpc.imports.host.pit_io(0x42,0,0,1),0x34); // read low byte in worker
  parentPort.postMessage({t:'done',stats:rpc.stats});
}else{
  let tick=0;const memory={buffer:new SharedArrayBuffer(8192*65536)};
  const host=require(root+'/lib/host-imports').createHostImports({getMemory:()=>memory.buffer,pitNowMs:()=>tick?(tick+0.25)*1000/1193182:0}).host;
  host.pit_io(0x43,0xb4,1,1);host.pit_io(0x42,0x34,1,1);
  const raw=host.pit_io;
  host.pit_io=(port,value,write,width)=>{const result=raw(port,value,write,width);if(write&&port===0x42)tick=1;return result;};
  const broker=RPC.createMainBroker(memory,host,sigs),worker=new Worker(__filename,{workerData:{buffer:memory.buffer}});
  let complete=false;const timeout=setTimeout(()=>{console.error('PIT worker timed out');worker.terminate();process.exitCode=1;},10000);
  worker.on('message',msg=>{if(msg.t==='rpc')broker.serveRpc(msg.slot);else if(msg.t==='done'){
    assert.equal(raw(0x42,0,0,1),0x12,'main sees worker consumption of low byte');
    assert.equal(msg.stats.sync,2);assert.equal(msg.stats.local,0);assert.equal(msg.stats.async,0);complete=true;
  }});
  worker.on('error',err=>{console.error(err);process.exitCode=1;});
  worker.on('exit',code=>{clearTimeout(timeout);if(code||!complete)process.exitCode=1;else console.log('PASS PIT real OS Worker synchronous write/read phases shared with main');});
}
