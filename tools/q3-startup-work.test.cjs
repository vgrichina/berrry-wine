'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {install}=require('./q3-startup-work.cjs');
const menu=require('./q3-menu-consumption.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const os=require('node:os'),path=require('node:path'),zlib=require('node:zlib');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'q3-lifecycle-seal-'));
 try{
  const raw=Buffer.from('{"files":[]}'),digest=sha(raw);
  fs.writeFileSync(path.join(dir,'runtime-pins.json.gz'),zlib.gzipSync(raw));
  fs.writeFileSync(path.join(dir,'replacement-pinset-seal.json'),JSON.stringify({manifestSHA256:digest}));
  const life=Object.freeze({immutable:true,overallDeadline:1794312000.125,box:'exact-box',manifestSHA256:'0'.repeat(64)});
  const pair=require('./q3-current-module.cjs').lifecycleSeal;
  assert.deepEqual(pair(dir,life),{...life,manifestSHA256:digest});
  assert.equal(life.manifestSHA256,'0'.repeat(64));
  // The launch check remains mandatory, and rejects the copied parent SHA.
  const staged=require('./q3-current-foreign-closure-v1.cjs');
  assert.throws(()=>staged.staged(dir,staged.version,life.manifestSHA256),/independent prepared manifest SHA/);
  fs.writeFileSync(path.join(dir,'replacement-pinset-seal.json'),JSON.stringify({manifestSHA256:life.manifestSHA256}));
  assert.throws(()=>pair(dir,life),/own prepared manifest SHA/);
  assert.throws(()=>pair(dir,{...life,immutable:false}),/immutable lifecycle/);
 }finally{fs.rmSync(dir,{recursive:true});}
 let clock=0,rows=[],calls=0;
 const sentinel=Error('original failure'),host={
  normal(n){assert.equal(this,host);calls++;clock+=3;return n+1;},
  slow(){calls++;clock+=800;return 7;},
  failure(){clock+=20;throw sentinel;},q3_menu_event(){calls++;}
 };
 const work=install(host,{now:()=>clock,emit:r=>rows.push(r),intervalMs:500,maxReports:2});
 assert.equal(host.normal(3),4);assert.equal(host.slow(),7);assert.throws(()=>host.failure(),e=>e===sentinel);
 const message={t:'sliceDone',seq:1,eip:0x4374e6,ms:830,yield:0};assert.equal(work.slice(message),message);
 assert.equal(rows.length,1);assert.equal(rows[0].calls,3);assert.equal(rows[0].importMs,823);assert.equal(rows[0].sliceMs,830);assert.equal(rows[0].top[0].name,'slow');
 clock+=1000;host.normal(5);work.slice({...message,seq:2,ms:4});assert.equal(rows.length,2);assert.equal(rows[1].slices,2);assert.equal(rows[1].sliceMs,834);
 const capped=rows[1].calls;host.slow();work.slice(message);assert.equal(rows.length,2);assert.equal(rows[1].calls,capped);assert.equal(calls,4);
 let attempted=0;const h={f:()=>99};const broken=install(h,{now:()=>0,emit(){attempted++;throw Error('sink');}});assert.equal(h.f(),99);broken.slice(message);assert.equal(h.f(),99);broken.slice(message);assert.equal(attempted,1);
 // Execute the serialized installer through a real WebAssembly instance.
 // Small module: import host.check_input -> i32, export run returning its result.
 const bytes=Buffer.from('0061736d010000000105016000017f02140104686f73740b636865636b5f696e7075740000030201000707010372756e00010a0601040010000b','hex');
 assert(WebAssembly.validate(bytes));let time=0,out=[];const instance=await WebAssembly.instantiate(bytes,{host:{check_input:()=>123}});assert.equal(instance.instance.exports.run(),123);
 const scope={WebAssembly:{instantiate:WebAssembly.instantiate,compile:WebAssembly.compile},fetch:async()=>({ok:true,arrayBuffer:async()=>bytes}),crypto:crypto.webcrypto,performance:{now:()=>time},console:{debug:(marker,value)=>out.push({marker,value:JSON.parse(value)})},postMessage:m=>out.push(m)};
 vm.createContext(scope);vm.runInContext(menu.workerSource({url:'/fixture',sha256:sha(bytes),size:bytes.length,startupWork:true}),scope);
 const table={check_input(){time+=800;return 123;}};
 // The installer compiles the replacement once and invokes original imports once.
 const actual=await scope.WebAssembly.instantiate(await WebAssembly.compile(bytes),{host:table});assert.equal(actual.exports.run(),123);
 const sent={t:'sliceDone',seq:3,eip:1,ms:805,yield:0};scope.postMessage(sent);
 assert.equal(out.filter(r=>r.marker==='Q3_STARTUP_WORK').length,1);
 const record=out.find(r=>r.marker==='Q3_STARTUP_WORK').value;assert.equal(record.importMs,800);assert.equal(record.top[0].name,'check_input');assert.equal(out.at(-1),sent);
 const plainOut=[],plain={...scope,WebAssembly:{instantiate:WebAssembly.instantiate,compile:WebAssembly.compile},postMessage:m=>plainOut.push(m),console:{debug:()=>{throw Error('default observer emitted');}}};
 vm.createContext(plain);vm.runInContext(menu.workerSource({url:'/fixture',sha256:sha(bytes),size:bytes.length}),plain);
 const plainHost={check_input:()=>321};
 const plainInstance=await plain.WebAssembly.instantiate(await WebAssembly.compile(bytes),{host:plainHost});assert.equal(plainInstance.exports.run(),321);
 plain.postMessage(sent);assert.deepEqual(plainOut,[sent]);
 console.log(JSON.stringify({passed:true,originalReturnThisAndException:true,observerCap:true,sinkFailureContained:true,serializedRealWasm:true,blockedImportDiscriminated:true,guestWrites:false,extraRPCs:false}));
})().catch(e=>{console.error(e);process.exitCode=1;});
