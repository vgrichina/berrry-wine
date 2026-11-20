'use strict';
const assert=require('node:assert/strict');
const {Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
// Two real instances, one of them in a CPU Worker, over the same process memory.
// No scene snapshots or host writes to capture state participate.
const extraWat=`
 (func (export "capture_test_set") (param $h i32) (result i32)
   (local $sp i32)
   (local.set $sp (i32.load offset=16 (global.get $reg_base)))
   (call $handle_SetCapture (local.get $h) (i32.const 0) (i32.const 0)
     (i32.const 0) (i32.const 0) (i32.const 0))
   (i32.store offset=16 (global.get $reg_base) (local.get $sp))
   (i32.load (global.get $reg_base)))
 (func (export "capture_test_release") (result i32)
   (local $sp i32)
   (local.set $sp (i32.load offset=16 (global.get $reg_base)))
   (call $handle_ReleaseCapture (i32.const 0) (i32.const 0) (i32.const 0)
     (i32.const 0) (i32.const 0) (i32.const 0))
   (i32.store offset=16 (global.get $reg_base) (local.get $sp))
   (i32.load (global.get $reg_base)))
 (func (export "capture_test_remove") (param $h i32) (call $wnd_table_remove (local.get $h)))
`;
if(!isMainThread){
 const host={memory:workerData.memory};
 for(const i of WebAssembly.Module.imports(workerData.module))if(i.kind==='function')host[i.name]=()=>0;
 const e=new WebAssembly.Instance(workerData.module,{host}).exports;e.set_current_thread_id(1);
 parentPort.on('message',({id,action,h})=>{try{let value;
 if(action==='create'){e.test_wnd_table_set(h,0);value=e.wnd_lookup_generation(h).toString();}
 if(action==='set')value=e.capture_test_set(h);
 if(action==='release')value=e.capture_test_release();
 if(action==='retire')value=e.wnd_lookup_retire(h);
 if(action==='remove')value=e.capture_test_remove(h);
 if(action==='reset')value=e.reset_thread_message_queue(h);
 parentPort.postMessage({id,value});}catch(e){parentPort.postMessage({id,error:e.stack});}});
}else (async()=>{
 const {bootRenderHarness}=require('./render-helper');
 const h=await bootRenderHarness({extraWat,fonts:'none'}),e=h.exports;
 const worker=new Worker(__filename,{workerData:{module:h.module,memory:h.memory}});
 let id=0;const ask=(action,h)=>new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>reject(Error('Worker response deadline')),5000);worker.once('message',r=>{clearTimeout(timer);assert.equal(r.id,n);r.error?reject(Error(r.error)):resolve(r.value)});worker.postMessage({id:n,action,h});});
 try{
 const gen=await ask('create',65537);await ask('create',65538);
 assert.equal(await ask('set',65537),0);
 assert.equal(e.get_capture_hwnd(),0,'legacy actor-local export reproduces old failure');
 assert.equal(e.get_authoritative_capture_hwnd(),65537,'shadow reads actual Worker publication');
 assert.equal(e.capture_publication_word(4),1,'actor identity');
 assert.equal(BigInt(e.capture_publication_word(2)>>>0)|(BigInt(e.capture_publication_word(3)>>>0)<<32n),BigInt(gen));
 assert.equal(await ask('set',65538),65537,'transfer returns old capture');
 assert.equal(e.get_authoritative_capture_hwnd(),65538);
 e.set_current_thread_id(2);assert.equal(e.capture_test_set(65537),0,'wrong actor cannot steal capture');
 assert.equal(e.capture_test_release(),0,'wrong actor cannot release');
 assert.equal(e.get_authoritative_capture_hwnd(),65538);
 assert.equal(await ask('release'),1);assert.equal(e.get_authoritative_capture_hwnd(),0);
 await ask('set',65537);await ask('retire',65537);assert.equal(e.get_authoritative_capture_hwnd(),0,'retirement invalidates immediately');
 await ask('remove',65537);await ask('create',65537);assert.equal(e.get_authoritative_capture_hwnd(),0,'numeric reuse cannot inherit generation');
 await ask('set',65537);await ask('reset',1);assert.equal(e.get_authoritative_capture_hwnd(),0,'actor slot retirement releases');
 console.log('PASS authoritative Worker capture, transfer, wrong actor, release, retirement and reuse');
 }finally{await worker.terminate();}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
