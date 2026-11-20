'use strict';
// Executing production Worker and real native PeekMessage return. Images and
// release receipts are authored controls; this is not original-game evidence.
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),{Worker}=require('node:worker_threads');
const {PNG}=require('pngjs'),RPC=require('../lib/guest-rpc');
const {createGameplayContext,CAPABILITY}=require('../tools/mcm-gameplay-reviewed-context.cjs');
const {createChain,sha}=require('../tools/mcm-bound-input.cjs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const out=process.env.MCM_GAMEPLAY_EVIDENCE;
async function run(){
 const extra=`
 (func (export "mcm_context_setup")
   (global.set $image_base (i32.const 0x400000))
   (global.set $current_thread_id (i32.const 1))
   (global.set $msg_phase (i32.const 5))
   (call $wnd_table_set (i32.const 0x3333) (i32.const 0x12345678))
   (global.set $focus_hwnd (i32.const 0x3333)))
 (func (export "mcm_context_poll") (result i32)
   (global.set $yield_flag (i32.const 0)) (global.set $yield_reason (i32.const 0))
   (i32.store offset=16 (global.get $reg_base) (i32.const 0x500100))
   (call $gs32 (i32.const 0x500100) (i32.const 0))
   (call $handle_PeekMessageA (i32.const 0x500000) (i32.const 0)
     (i32.const 0) (i32.const 0) (i32.const 1) (i32.const 0))
   (i32.load (global.get $reg_base)))`;
 const bytes=require('./compile-src').compileSrcWasm((file,text)=>file==='13-exports.wat'?text+extra:text);
 const module=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const sigs=require('../lib/host-import-sigs.generated.json').sigs;
 const w=new Worker(require.resolve('../lib/guest-worker.js')),pending=new Map();let seq=0,event=0,receipt=null,polls=0,down=0;
 const joined=new Promise(resolve=>w.once('exit',resolve));
 const table=Object.fromEntries(Object.keys(sigs).map(k=>[k,()=>0]));
 Object.assign(table,{real_time_ms:()=>Date.now()&0x7fffffff,input_validate:token=>token===0?0x424e49:1,
   check_input:()=>{polls++;const value=event;event=0;return value;},check_input_token:()=>9,
   check_input_hwnd:()=>0x3333,check_input_lparam:()=>1,
   input_consumed:(token,tid,ptr,kind,remove,...scene)=>{
     assert.equal(token,9);assert.equal(tid,1);assert.equal(ptr,0x500000);assert.equal(kind,2);assert.equal(remove,1);
     const d=new DataView(memory.buffer),wa=scene.at(-1),msg=d.getUint32(wa+4,true),vk=d.getUint32(wa+8,true);
     assert.equal(msg,0x100);assert.equal(vk,38);
     receipt={consumed:true,state:'CONSUMED',receiptBoundary:'owner-worker-native-user-return',
       nativeMessage:{consumption:'owner-user-return',token,msg,wParam:vk,apiKind:kind,remove:true}};return 1;
   }});
 const broker=RPC.createMainBroker(memory,table,sigs);
 w.on('message',m=>{if(m.t==='rpc')return broker.serveRpc(m.slot);if(m.t==='calls')return broker.serveCalls(m);
   const p=pending.get(m.seq??0);if(p){pending.delete(m.seq??0);clearTimeout(p.timer);m.t==='error'?p.reject(Error(m.message)):p.resolve(m);}});
 w.on('error',e=>{for(const p of pending.values())p.reject(e);});
 const ask=msg=>new Promise((resolve,reject)=>{const id=msg.t==='init'?0:++seq,timer=setTimeout(()=>reject(Error('Worker UNKNOWN')),5000);
   pending.set(id,{resolve,reject,timer});w.postMessage({...msg,seq:id});});
 const report={route:'authored complete animated frames + production Worker native PeekMessage',moduleSHA256:sha(bytes),controls:[]};
 try{
   await ask({t:'init',module,memory,sigs,slot:0,endpointIdentity:77});await ask({t:'callExport',name:'mcm_context_setup'});
   const identity={mode:'GAMEPLAY',gps:true,modal:null,session:'actual-worker',owner:{thread:w.threadId},process:7,hwnd:0x3333,
     generation:1,endpoint:77,epoch:'actual-worker-epoch',module:sha(bytes),threads:w.threadId,nativeInstance:'native-worker',memory:'shared',viewport:{width:40,height:30}};
   let shots=0;const rows=[];
   let sink=null;if(out){const directory=out+'/worker-frames';fs.mkdirSync(directory);
     sink=require('../tools/mcm-menu-reviewed-context.cjs').createImageSink(directory);}
   const p=new PNG({width:40,height:30});p.data.fill(255);
   const a=createGameplayContext({identity:async()=>{assert((await ask({t:'callExport',name:'get_current_thread_id'})).value===1);return identity;},
     capture:async()=>{p.data[0]=++shots;return PNG.sync.write(p);},evidenceSink:r=>{rows.push({...r,png:undefined});return sink?sink(r):true;},
     native:{prepare:async()=>({prepared:true}),status:async nonce=>{await ask({t:'callExport',name:'mcm_context_poll'});return {...receipt,nonce};}},
     down:()=>{down++;event=(38<<16)|0x100;broker.publish({inputPending:1});},
     release:{arm:async()=>({at:Date.now(),fallback:Date.now()+1750,releaseDue:Date.now()+1750}),due(){},cancel(){},finish:async nonce=>({nonce,trusted:true,down:false,authored:true})}});
   const image=await a.captureReview();
   // Call the unchanged production DIRECT admission with its own retained
   // capture, using actual elapsed wall time. It refuses before any live read.
   const vm=require('node:vm'),tiny=Buffer.from('0061736d01000000','hex');
   const inst={},link={endpointIdentity:7,slot:0,worker:{},module:{}};
   const wine={running:true,processId:3,instance:inst,renderer:{peekKeyDownState:()=>0},guestWorker:{link},threadManager:{mainInstance:inst}};
   const page=vm.createContext({crypto:crypto.webcrypto,crossOriginIsolated:true,runningApps:[{name:'mcm',wine}]});
   const worker=vm.createContext({crypto:crypto.webcrypto,endpointIdentity:7,workerSlot:0,instance:inst});
   const direct=createChain({workers:new Map([['guest',{sessionId:'guest',targetId:'guest',url:'guest-worker.js',scripts:[{scriptId:'1',bytecodeAvailable:true,sha256:sha(tiny)}]}]]),
     evaluate:async(s,target)=>JSON.parse(JSON.stringify(vm.runInContext(s,target==='guest'?worker:page))),
     send:async(method)=>method==='Debugger.getScriptSource'?{bytecode:tiny.toString('base64')}:{data:image.png.toString('base64')}});
   const d=await direct.capture('direct-original-source');
   await wait(12500);
   const age=Date.now()-image.at;assert(age>12000&&age<30000);
   await assert.rejects(direct.admit({...d.capture,review:'Authored original full source'},()=>{down++;}),/stale/);
   assert.equal(down,0);report.controls.push({name:'old DIRECT stale before dispatch',ageMs:Date.now()-Date.parse(d.capture.at),zeroDown:true});
   const intent={capability:CAPABILITY,mode:'GAMEPLAY',kind:'key',key:'ArrowUp',code:'ArrowUp',vk:38,holdMs:100,
     nonce:crypto.randomUUID(),review:'Authored complete animated control, single throttle',reviewedAt:Date.now(),imageSHA256:image.sha256};
   const handle=a.review(intent),result=await a.dispatch(handle,intent);
   assert.equal(down,1);assert(result.proof.consumed);assert.notEqual(rows[0].sha256,rows.at(-1).sha256);
   report.controls.push({name:'explicit accepts genuine elapsed source12to30s and actual CURRENT; native USER return',ageMs:age,result,polls});
   await assert.rejects(a.dispatch(handle,intent));assert.equal(down,1);report.rows=rows;report.pass=true;
 }finally{await w.terminate();report.workerExit=await joined;report.actualJoined=true;for(const p of pending.values())clearTimeout(p.timer);
   if(out)fs.writeFileSync(out+'/production-worker.json',JSON.stringify(report,null,2)+'\n');}
 console.log(JSON.stringify(report));
}
run().catch(e=>{console.error(e.stack);process.exitCode=1;});
