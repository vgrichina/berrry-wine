'use strict';
// Compare actual emitted installers using the exact retained native modules.
// This test launches Node Workers only; it never starts Chromium or Nox.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {Worker}=require('node:worker_threads'),q=require('./nox-passive-consumption.cjs');
const root=path.resolve(__dirname,'..'),[generated,canonicalPath,output]=process.argv.slice(2).map(p=>path.resolve(p));
assert(generated&&canonicalPath&&output.startsWith(root+'/scratch/runs/'));fs.mkdirSync(output,{recursive:false});
const source=fs.readFileSync(generated+'/browser-run.cjs','utf8');
const match=source.match(/await evaluate\(("(?:[^"\\]|\\.)*"),sessionId\);await send\('Runtime.runIfWaitingForDebugger'/);assert(match);
const retained=JSON.parse(match[1]),config=JSON.parse(retained.match(/\}\)\((\{[^\n]+\}),function recorder\(/)[1]);
const canonical=fs.readFileSync(canonicalPath),bytes=fs.readFileSync(generated+'/nox-consumption.wasm');
const manifest=JSON.parse(fs.readFileSync(generated+'/runtime-pins.json'));
assert.equal(q.sha(canonical),manifest.modules.find(m=>m.tailCalls).sha256);assert.equal(q.sha(bytes),config.sha256);assert.equal(bytes.length,config.size);
const repaired=q.workerSource(config);fs.writeFileSync(output+'/repaired-installer.js',repaired);
async function run(installer){
 const worker=new Worker(`
 const {parentPort,workerData:d}=require('node:worker_threads'),vm=require('node:vm'),fs=require('node:fs');
 const {createHostImports}=require(d.root+'/lib/host-imports');
 (async()=>{
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),ctx={exports:null,getMemory:()=>memory.buffer};
  const host=createHostImports(ctx).host;Object.assign(host,{memory,log(){},log_i32(){},exit(){}});
  const bytes=fs.readFileSync(d.generated+'/nox-consumption.wasm');globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>bytes});globalThis.crypto=require('node:crypto').webcrypto;
  let emitted=0,lastSequence=0;console.debug=message=>{const r=JSON.parse(message.slice(16));if(r.sequence!==lastSequence+1)throw Error('sink sequence');lastSequence=r.sequence;emitted++;};
  globalThis.endpointIdentity=1;globalThis.workerSlot=0;vm.runInThisContext(d.installer);
  const canonical=await WebAssembly.compile(fs.readFileSync(d.canonicalPath));globalThis.instance=await WebAssembly.instantiate(canonical,{host});const e=ctx.exports=instance.exports;
  globalThis.__mcmPassiveInstanceV1={ids:new WeakMap([[instance,'retained-instance']])};
  const fields='processId processObject endpoint endpointObject workerObject workerTarget workerInstance moduleObject moduleSha256 epoch renderEndpoint renderEndpointObject renderWorkerObject rendererTarget rendererEpoch rendererModuleSha256 pageRendererObject canvasObject'.split(' ');
  const identity=Object.fromEntries(fields.map(k=>[k,'retained-'+k]));Object.assign(identity,{endpoint:1,moduleSha256:d.config.sha256,workerInstance:'retained-instance'});
  const mem=new Uint8Array(memory.buffer),exe=fs.readFileSync(d.root+'/test/binaries/notepad.exe');mem.set(exe,e.get_staging());e.load_pe(exe.length);e.set_api_log(0);e.init_dx_com_thunks();
  const wa=a=>a-0x400000+0x12000,d32=v=>[v&255,v>>>8&255,v>>>16&255,v>>>24&255];
  function put(a,b){mem.set(b,wa(a));e.invalidate_code_range(a,b.length);}
  put(0x42b325,[0xe8,...d32(0x42b980-0x42b32a),0xeb,0xfe]);put(0x42b980,[0xb8,...d32(123),0xc3]);
  const o=__noxConsumption,owner=o.owner();let last,commands=0,firstDeadline;
  for(let i=0;i<3001;i++){
   const id='complete-call-'+i,b={id,label:id,previous:{label:'before',sha256:'a'.repeat(64),identity}};
   const armed=o.begin(b,identity);if(!armed.active){last=o.finish(identity);break;}
   e.set_esp(0x74ff000);e.set_eip(0x42b325);e.run(10);last=o.finish(identity);if(last.reason)break;
   if(last.records.length!==4||last.frames.length||last.pendingApi||last.records.some(r=>r.binding.id!==id))throw Error('complete interval');
   if(last.records.map(r=>r.kind).join(',')!=='command-begin,guest-call,guest-entry,guest-return')throw Error('complete caller');
   if(last.records.at(-1).result!==123||last.firstRecordIndex!==i*4)throw Error('return/global index');
   if(firstDeadline===undefined)firstDeadline=last.deadline;if(last.deadline!==firstDeadline)throw Error('deadline renewed');commands++;
  }
  if(last.totalRecords!==emitted||emitted!==lastSequence)throw Error('sink loses completed history');
  parentPort.postMessage({commands,totalRecords:last.totalRecords,retainedRows:o.snapshot(identity).records.length,reason:last.reason,emitted,lastSequence,installed:owner,deadlineUnchanged:last.deadline===firstDeadline,completeCaller:true});
 })().catch(e=>{throw e;});`,{eval:true,workerData:{root,generated,canonicalPath,installer,config}});
 try{return await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.once('exit',code=>{if(code)reject(Error('Worker exit '+code));});});}
 finally{await worker.terminate();}
}
(async()=>{
 const before=await run(retained),after=await run(repaired);
 assert.equal(before.commands,3000);assert.equal(before.reason,'record-limit');assert.equal(before.totalRecords,12000);assert.equal(before.retainedRows,12000);
 assert.equal(after.commands,3001);assert.equal(after.reason,null);assert.equal(after.totalRecords,12004);assert.equal(after.retainedRows,4);assert(after.deadlineUnchanged&&after.completeCaller);
 assert.deepEqual(after.installed,before.installed);
 const result={passed:true,retainedNativeModules:true,actualNodeWorkers:true,actualEmittedOldInstaller:true,actualRepairedInstaller:true,oldInstallerSha256:q.sha(Buffer.from(retained)),repairedInstallerSha256:q.sha(Buffer.from(repaired)),canonicalSha256:q.sha(canonical),observationSha256:q.sha(bytes),before,after,nativeBrowser:false};
 fs.writeFileSync(output+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1;});
