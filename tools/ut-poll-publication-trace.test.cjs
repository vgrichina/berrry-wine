'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {workerBootstrap,decode,verifyTrace,fields}=require('./ut-poll-publication-trace.cjs');
const {verifyWorkers}=require('./ut-observer-scope.cjs');
test('bounded module/code reads reject unmapped, stale and ambiguous identities without translation calls',()=>{
 const {captureBoundary}=require('./ut-poll-publication-trace.cjs');
 const memory=new WebAssembly.Memory({initial:2,maximum:2,shared:true}),d=new DataView(memory.buffer);
 const ex={get_eip:()=>4096,get_esp:()=>0,get_ebp:()=>0x50600000,get_image_base:()=>0x400000,get_exe_size_of_image:()=>512,
 get_dll_table:()=>1024,get_dll_count:()=>1,get_dll_lifecycle_table:()=>2048,get_dll_lifecycle_stride:()=>64,guest_to_wasm:()=>{throw Error('must not translate');}};
 const map={g2w:p=>p,BASE:{VIRTUAL_BACKING_BASE:65536,GUEST_PAGE_TABLE:65536}};
 d.setUint32(1024,4096,true);d.setUint32(1028,4096,true);d.setUint32(2048,2,true);d.setUint32(2052,9,true);new Uint8Array(memory.buffer,4096,64).fill(0x90);
 const before=Buffer.from(memory.buffer).toString('hex'),r=captureBoundary(ex,memory,map);
 assert.equal(r.module.base,4096);assert.equal(r.module.generation,9);assert.equal(r.module.stable,true);assert.equal(r.code.length,64);assert.equal(r.registers.esp,0);assert.equal(r.registers.ebp,0x50600000);assert.equal(Buffer.from(memory.buffer).toString('hex'),before);
 ex.get_eip=()=>0x90000000;assert.equal(captureBoundary(ex,memory,map).code,null);assert.equal(captureBoundary(ex,memory,map).module,null);
 ex.get_eip=()=>4096;d.setUint32(2048,0,true);assert.equal(captureBoundary(ex,memory,map).module.stable,false);
 d.setUint32(2048,2,true);ex.get_dll_count=()=>129;assert.equal(captureBoundary(ex,memory,map).inventoryComplete,false);
 ex.get_dll_count=()=>1;ex.get_image_base=()=>4096;assert.equal(captureBoundary(ex,memory,map).ambiguous,true);
 ex.get_dll_count=()=>0;ex.get_exe_size_of_image=()=>0;d.setUint16(4096,0x5a4d,true);d.setUint32(4096+60,128,true);d.setUint32(4096+128,0x4550,true);d.setUint32(4096+128+80,4096,true);
 const worker=captureBoundary(ex,memory,map);assert.equal(worker.module.index,-1);assert.equal(worker.module.size,4096);assert.equal(worker.mainSizeSource,'mapped PE header');
});
test('code classification requires exact loaded file, lifetime, worker and byte identity',()=>{
 const {verifyCodeIdentity}=require('./ut-poll-publication-trace.cjs');
 const code=Array(64).fill(0x90),boundary={complete:true,sequence:1,slot:0,endpoint:7,inventoryComplete:true,ambiguous:false,codeInModule:true,code,registers:{eip:4100},module:{index:2,base:4096,size:4096,generation:9,stable:true}};
 const image={loader:'load_dll',sha256:'exact',index:2,base:4096,size:4096,generation:9},identity={slot:0,endpoint:7,sha256:'exact'};
 assert.equal(verifyCodeIdentity(boundary,image,code,identity).rva,4);
 for(const patch of [{complete:false},{sequence:0},{endpoint:8},{slot:1},{inventoryComplete:false},{ambiguous:true},{code:null},{codeInModule:false},{module:{...boundary.module,stable:false}},{code:[1,...code.slice(1)]}])assert.throws(()=>verifyCodeIdentity({...boundary,...patch},image,code,identity));
 for(const patch of [{sha256:'wrong'},{base:8192},{generation:10},{index:3},{size:8192},{error:'unavailable'}])assert.throws(()=>verifyCodeIdentity(boundary,{...image,...patch},code,identity));
});
test('page atomic boundary reader refuses incomplete publication and observes internal native wait',()=>{
 const {installPage}=require('./ut-poll-publication-trace.cjs'),workers=[];
 class Worker{constructor(){workers.push(this);}postMessage(m){this.init=m;}addEventListener(){}}
 const context={window:null,Worker,URL,location:{href:'http://test/'},SharedArrayBuffer,Int32Array,Atomics,Date,performance,setInterval:()=>0,console:{info(){}}};context.window=context;
 vm.runInNewContext('('+installPage+')()',context);
 const w=new context.Worker('/lib/guest-worker.js');w.postMessage({t:'init',slot:0,endpointIdentity:1});
 const details=new Int32Array(w.init.utPollPublication.details),a=8192+8,body=JSON.stringify({sequence:1,slot:0,endpoint:1});details[0]=details[a]=1;details[a+1]=body.length;for(let i=0;i<body.length;i++)details[a+2+i]=body.charCodeAt(i);
 assert.equal(context.__utPoll.snapshot().rings[0].detail.complete,false);details[a+8191]=1;assert.equal(context.__utPoll.snapshot().rings[0].detail.complete,true);
 let calls=0;context.createBrowserNativeInput=()=>({observe:()=>true,status:()=>({state:'IDLE'}),validate:()=>{calls++;return 0;},snapshot:()=>({source:'native_message_wait'})});
 context.createBrowserNativeInput().validate(-1,Array(13).fill(0));assert.equal(calls,1);
});
test('stack/import trace preserves results, errors, memory and registers, and honors OFF',async()=>{
 const listeners=[],rows=new Int32Array(new SharedArrayBuffer((8+8192*48)*4)),control=new Int32Array(new SharedArrayBuffer(8));control[0]=1;
 const memory=new WebAssembly.Memory({initial:1,maximum:1,shared:true}),bytes=Buffer.from(memory.buffer);bytes.writeUInt32LE(0x401234,1024);
 const expected=Buffer.from(bytes),error=Error('same'),ex={get_eip:()=>0x401000,get_current_thread_id:()=>7,get_eax:()=>11,get_esp:()=>1024,guest_to_wasm:()=>{throw Error('unsafe translation called');},run:x=>x+1};let imports,names;
 const context={addEventListener:(t,f)=>listeners.push(f),postMessage:m=>{if(m.t==='utPollNames')names=m.names;},Atomics:Object.create(Atomics),SharedArrayBuffer,Int32Array,DataView,performance,WebAssembly:{instantiate:async(m,i)=>{imports=i;return {exports:ex};},Instance:class{}}};
 context.RegionMap={g2w:p=>p,BASE:{VIRTUAL_BACKING_BASE:65536,GUEST_PAGE_TABLE:32768}};
 vm.runInNewContext('('+workerBootstrap+')()',context);
 listeners[0]({data:{t:'init',slot:3,endpointIdentity:17,utPollPublication:{rows:rows.buffer,control:control.buffer}}});
 const result=await context.WebAssembly.instantiate({}, {host:{memory,check_input:()=>123,input_consumed:()=>{throw error;}}});
 assert.equal(imports.host.check_input(),123);assert.throws(()=>imports.host.input_consumed(),e=>e===error);assert.equal(result.exports.run(10),11);assert(bytes.equals(expected));assert.equal(ex.get_eax(),11);
 const raw=Array.from({length:rows[0]},(_,i)=>Array.from(rows.subarray(8+i*48,8+(i+1)*48))),records=raw.map(r=>decode(r,names));
 assert.equal(fields.length,48);assert(records.some(r=>r.kind==='import-entry'&&r.import==='check_input'&&r.thread===7&&r.eip===0x401000&&r.stack0===0x401234&&r.stackMask===65535));
 assert(records.some(r=>r.kind==='import-return'&&r.result===123));assert(records.some(r=>r.kind==='error'));assert(records.some(r=>r.kind==='run-return'));
 assert(verifyTrace([{slot:3,endpoint:17,names,rows:raw}],[],{armed:true}).complete);
 control[0]=0;const n=rows[0];imports.host.check_input();assert.equal(rows[0],n);
});
test('incomplete, foreign and unarmed trace cannot support causal classification',()=>{
 const row=Array(48).fill(0);row[0]=row[47]=1;row[8]=0;row[9]=2;const b={slot:0,endpoint:2,names:['check_input'],rows:[row]};
 assert(verifyTrace([b],[],{armed:true}).complete);
 for(const kind of ['LOST','TORN','worker-error'])assert.throws(()=>verifyTrace([b],[{kind}],{armed:true}));
 assert.throws(()=>verifyTrace([b],[]));assert.throws(()=>verifyTrace([],[],{armed:true}));
 const torn=row.slice();torn[47]=0;assert.throws(()=>verifyTrace([{...b,rows:[torn]}],[],{armed:true}));
 const dropped=row.slice();dropped[0]=dropped[47]=3;assert.throws(()=>verifyTrace([{...b,rows:[row,dropped]}],[],{armed:true}));
 assert.throws(()=>verifyTrace([{...b,endpoint:3}],[],{armed:true}));
 for(const rows of [[],[{sources:[],modules:[{match:true}]}],[{sources:[{match:false}],modules:[{match:true}]}],[{sources:[{match:true}],modules:[{match:false}]}],[{sources:[{match:true}],modules:[{match:true}],error:'retired collector'}]])assert.throws(()=>verifyWorkers(rows));
});
