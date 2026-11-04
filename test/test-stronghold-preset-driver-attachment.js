'use strict';
// Offline attachment/driver integration. Synthetic transport and caller state
// are explicitly fixtures, with native callbacks delivered by the shipped Worker.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {Worker,MessageChannel,isMainThread,parentPort,workerData}=require('node:worker_threads');
const a=require('../tools/stronghold-preset-driver-attachment.cjs'),Module=require('node:module');
const ROOT=path.resolve(__dirname,'..'),URL='http://fixture/lib/guest-worker.js?v=attachment';
const OBS=path.join(ROOT,'scratch/runs/20261104-stronghold-explicit-idle-input/observe-browser.js');
function moduleFrom(source,filename){const m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));m._compile(source,filename);return m.exports;}
if(!isMainThread){
 globalThis.location={href:URL};
 globalThis.addEventListener=(name,fn)=>{if(name==='message')parentPort.on('message',data=>fn({data}));};
 vm.runInThisContext(a.workerSource({observeSource:fs.readFileSync(OBS,'utf8'),observerSource:fs.readFileSync(path.join(ROOT,'tools/stronghold-native-preset-observer.cjs'),'utf8'),
   options:{expectedWorkerURL:URL,targetId:'target0',sessionId:'session0',exeSha256:a.EXE_SHA256,wasmSha256:workerData.wasmHash,deadlineEpochMs:Date.now()+30000,maxMs:workerData.idle?50:10000}}));
 const instantiate=WebAssembly.instantiate;let e;
 WebAssembly.instantiate=async function(...args){const r=await Reflect.apply(instantiate,this,args);e=(r.instance||r).exports;return r;};
 const filename=path.join(ROOT,'lib/guest-worker.js'),workerSource=fs.readFileSync(filename);moduleFrom(workerSource.toString(),filename);
 const le=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255];
 const caller=0x580000,stop=caller+64,stack=0x7408000;
 parentPort.on('message',async m=>{if(m.t!=='attachmentTest')return;
  try{let result;
   if(m.action==='setup'){
    const bytes=fs.readFileSync(path.join(ROOT,a.MEDIA)),memory=new Uint8Array(e.memory.buffer),dv=new DataView(e.memory.buffer);
    memory.set(bytes,e.get_staging());assert(e.load_pe(bytes.length));e.set_api_log(0);
    const put=(p,b)=>memory.set(b,e.guest_to_wasm(p)),u32=(p,v)=>dv.setUint32(e.guest_to_wasm(p),v,true);
    put(caller,[0x68,...le(1),0xb8,...le(0x42d850),0xff,0xd0,0x83,0xc4,4,0xe9,...le(stop-(caller+20))]);
    put(stop,[0xeb,0xfe]);e.invalidate_code_range(caller,66);u32(0x1681318,0);e.set_eip(caller);e.set_esp(stack);
    result={workerSourceSHA256:a.hash(workerSource),media:{path:a.MEDIA,sha256:a.hash(bytes)}};
   }else if(m.action==='pendingEntry'){
    new DataView(e.memory.buffer).setUint32(e.guest_to_wasm(stack),stop,true);e.set_eip(0x42d850);e.set_esp(stack);result=true;
   }else if(m.action==='wrongThread'){e.set_current_thread_id(2);result=true;}
   else if(m.action==='replace'){const mod=await WebAssembly.compile(workerData.wasmBytes);parentPort.emit('message',{t:'init',module:mod,slot:1});result=true;}
   else if(m.action==='eval')result=vm.runInThisContext(m.expression);
   else result=globalThis.__strongholdPresetAttachment.invoke(m.action,m.row);
   parentPort.postMessage({t:'attachmentReply',id:m.id,result});
  }catch(error){parentPort.postMessage({t:'attachmentReply',id:m.id,error:error.stack});}
 });
}else{
 const output={fixtureOnly:true,acceptedParityCommit:a.OBSERVER_COMMIT,controls:[],native:[]};
 const ack=steps=>({requested:64,ran:64,steps,frozen:true,hosts:1,tickMs:16,guests:[{requested:64,ran:64,running:true,frozen:true,steps,tickMs:16}]});
 async function actualWorker(variant,idle=false){
  const bytes=fs.readFileSync(path.join(ROOT,'build',variant)),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),sigs=require('../lib/host-import-sigs.generated.json').sigs;
  const broker=require('../lib/guest-rpc').createMainBroker(memory,Object.fromEntries(Object.keys(sigs).map(n=>[n,()=>0])),sigs);
  const w=new Worker(__filename,{workerData:{wasmHash:a.hash(bytes),wasmBytes:bytes,idle}}),pending=new Map();let id=0,seq=0,readyResolve;
  const ready=new Promise(r=>readyResolve=r),slices=[];
  w.on('message',m=>{
   if(m.t==='ready')readyResolve();else if(m.t==='rpc')broker.serveRpc(m.slot,m.waitEntry);else if(m.t==='call')broker.serveCall(m);else if(m.t==='calls')broker.serveCalls(m);
   else if(m.t==='attachmentReply'){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error)):p.resolve(m.result);}
   else if(m.t==='sliceDone'){const p=slices.shift();m.trapped?p.reject(Error(m.trapped)):p.resolve(m);}
  });
  const timer=setTimeout(()=>{for(const p of pending.values())p.reject(Error('test Worker deadline'));w.terminate();},20000);
  w.on('error',error=>{for(const p of pending.values())p.reject(error);readyResolve(Promise.reject(error));});
  const call=(action,row,expression)=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});w.postMessage({t:'attachmentTest',id,action,row,expression});});
  const close=async()=>{clearTimeout(timer);await w.terminate();};
  w.postMessage({t:'init',seq:0,module:await WebAssembly.compile(bytes),memory,sigs,slot:0,endpointIdentity:1});await ready;
  return {call,close,wasmHash:a.hash(bytes),slice:(steps=64)=>new Promise((resolve,reject)=>{slices.push({resolve,reject});w.postMessage({t:'slice',seq:++seq,steps});})};
 }
 function host(w,{pageEvents,reportEdit,candidates=1}={}){
  const saved=[],events=pageEvents||[{kind:'compiled',sha256:w.wasmHash},{kind:'sent-module',sha256:w.wasmHash,workerURL:URL,slot:0,type:'init'}];
  const entry={sessionId:'session0',info:{url:URL},expectedWorkerURL:URL,preloadVerified:true,session:{async send(method,params){
    const result=await w.call('eval',null,params.expression);let value=JSON.parse(result);if(reportEdit)value=reportEdit(value);return {result:{value:JSON.stringify(value)}};
  }}};
  const sessions=new Map(candidates?Array.from({length:candidates},(_,i)=>['target'+i,entry]):[]);
  const h=a.createAttachment({sessions,save:(n,r)=>saved.push({name:n,value:r}),log:()=>{},pageState:async()=>({main:{observation:{events}}}),wasmSha256:w.wasmHash});
  return {h,saved,sessions,entry};
 }
 async function native(){
  for(const variant of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
   const w=await actualWorker(variant);try{
    const setup=await w.call('setup'),{h,saved}=host(w);
    await h.begin({action:'route-press-preset'},19);
    await h.event('DOWN-enqueued',{main:{tick:{steps:0},inputQueue:[{msg:0x201}]}});
    await w.slice();
    await h.ack(ack(64),64,0);
    await h.event('DOWN-consumed',{main:{tick:{steps:64},inputQueue:[]}});
    await h.event('UP-enqueued',{main:{tick:{steps:64},inputQueue:[{msg:0x202}]}});
    await w.slice();await h.ack(ack(128),64,64);
    await h.event('UP-consumed',{main:{tick:{steps:128},inputQueue:[]}});
    await h.capture('existing-sealed-capture','a'.repeat(64),{main:{tick:{steps:128}}});
    await h.success({action:'route-press-preset'});
    const final=await w.call('report');assert(final.terminal);assert(!final.traced);assert.equal(final.report.status,'command-succeeded');
    const returned=final.report.records.find(r=>r.kind==='native-return');assert(returned);assert.equal(returned.pc,0x58000c,'dynamic saved return delivered outside preset static range');
    assert.equal(final.report.pending.length,0);assert(final.report.records.some(r=>r.annotation?.kind==='capture'));
    await assert.rejects(()=>h.begin({action:'route-press-preset'},20),/terminal/);
    await h.begin({action:'quit'},20);await h.begin({action:'route-handoff'},20);
    output.native.push({variant,wasmSha256:w.wasmHash,...setup,final,reports:saved.length});
   }finally{await w.close();}
  }
  for(const control of ['failed','idle','ambiguous','ambiguousModule','wrongSlot','wrongHash','wrongSession','wrongThread','wrongURL','replacedModule','lost','detached','late','noTrace','pending']){
   const w=await actualWorker('wine-assembly.wasm',control==='idle');try{
    await w.call('setup');
    let opts={};if(control==='ambiguous')opts.candidates=2;
    if(control==='wrongHash')opts.pageEvents=[{kind:'compiled',sha256:w.wasmHash},{kind:'sent-module',sha256:'b'.repeat(64),workerURL:URL,slot:0,type:'init'}];
    if(control==='ambiguousModule')opts.pageEvents=[{kind:'compiled',sha256:w.wasmHash},{kind:'compiled',sha256:w.wasmHash},{kind:'sent-module',sha256:w.wasmHash,workerURL:URL,slot:0,type:'init'}];
    if(control==='wrongSlot')opts.pageEvents=[{kind:'compiled',sha256:w.wasmHash},{kind:'sent-module',sha256:w.wasmHash,workerURL:URL,slot:1,type:'init'}];
    if(control==='wrongSession')opts.reportEdit=r=>({...r,sessionId:'foreign'});
    const {h,saved,sessions}=host(w,opts);
    if(control==='wrongThread')await w.call('wrongThread');
    if(['ambiguous','ambiguousModule','wrongSlot','wrongHash','wrongSession','wrongThread'].includes(control))await assert.rejects(()=>h.begin({action:'route-press-preset'},1),/prerequisite|ambiguous|foreign|thread/);
    else if(control==='late')await assert.rejects(()=>w.call('eval',null,'('+a.installWorker.toString()+')({expectedWorkerURL:"'+URL+'"})'),/competing or late/);
    else if(control==='wrongURL')await assert.rejects(()=>w.call('eval',null,'('+a.installWorker.toString()+')({expectedWorkerURL:"http://fixture/wrong.js"})'),/wrong owning Worker URL/);
    else {
     await h.begin({action:'route-press-preset'},1);
     if(control==='pending'){
      // One ordinary single-block fixture slice, not a driver grant change:
      // starting directly at an entry leaves an actual native frame pending.
      await w.call('pendingEntry');await w.slice(1);await h.failed('fixture command failed');
      const r=await w.call('report');assert.equal(r.report.status,'command-failed');assert.equal(r.report.pending.length,1);assert(!r.traced);
     }else if(control==='replacedModule'){
      await w.call('replace');await new Promise(r=>setTimeout(r,20));const r=await w.call('report');assert.equal(r.report.status,'module-replaced');assert(!r.traced);await h.failed('replaced Module');
     }else if(control==='idle'){
      await new Promise(r=>setTimeout(r,100));const report=await w.call('report');assert.equal(report.report.status,'deadline-expired');assert(!report.traced);
     }else if(control==='lost'){
      sessions.clear();await assert.rejects(()=>h.ack(ack(64),64,0),/lost/);await h.failed('lost instance');
     }else if(control==='detached'){
      h.retire({sessionId:'session0'});assert.throws(()=>h.assertLive(),/detached/);await assert.rejects(()=>h.begin({action:'route-arrival'},2),/detached/);await h.begin({action:'quit'},2);
     }else if(control==='noTrace')await assert.rejects(()=>h.ack(ack(64),64,0),/mandatory trace|terminal/);
     else await h.failed('first failed command');
     await h.finish('cleanup');
    }
    output.controls.push({control,reports:saved.length,final:await w.call('report')});
   }finally{await w.close();}
  }
 }
 async function driver(){
  const driverFile=path.join(ROOT,a.ORIGINAL),original=fs.readFileSync(driverFile,'utf8'),routeFile=path.join(path.dirname(driverFile),'route-driver.cjs'),routeOriginal=fs.readFileSync(routeFile,'utf8');
  assert.equal(a.hash(original),a.DRIVER_SHA);assert.equal(a.hash(routeOriginal),a.ROUTE_SHA);
  assert.throws(()=>a.composeDriver(original+' ',{}),/hash/);assert.throws(()=>a.composeRoute(routeOriginal+' '),/hash/);
  const opts={run:path.join(ROOT,'scratch/runs/20261104-stronghold-preset-driver-attachment'),pins:'/not-used-offline',wasmSha256:'a'.repeat(64)};
  const compiled=a.composeDriver(original,opts),off=a.composeDriver(original,{...opts,enabled:false});new vm.Script(compiled);new vm.Script(off);
  assert(!compiled.includes('observerCommand'));assert(!compiled.includes('callbackPreload'));assert(!compiled.includes('observer-control.cjs'));
  assert.equal((compiled.match(/Runtime.runIfWaitingForDebugger/g)||[]).length,2);
  // Compile in its original filename so every original require resolves there.
  const tail=original.slice(original.lastIndexOf('main().catch'));
  const testSource=a.replaceOnce(compiled,tail,"module.exports={installTransportEvidence,setPage:p=>page=p,setDeadlines:()=>{deadline=Date.now()+30000;activeReplyDeadline=deadline;},setObserver:h=>{Object.assign(presetAttachment,h);},mailboxDispatch};");
  const d=a.compileClosure(testSource,driverFile,a.composeRoute(routeOriginal));
  assert.equal(typeof d.mailboxDispatch,'function');d.setDeadlines();
  await assert.rejects(()=>d.mailboxDispatch({action:'install-native'},1),/before Start/);
  const mailboxBody=compiled.slice(compiled.indexOf('const i=number++;'),compiled.indexOf('\n  }\n  if(!closing)'));
  const mailboxOrders=[];
  for(const failure of [null,'dispatch','begin']){
   const order=[],ctx={number:0,activeCommand:null,activeReplyDeadline:0,halted:false,file:'fixture-command',Date,
    fs:{readFileSync:()=>JSON.stringify({action:'route-press-preset',replyDeadline:(Date.now()+30000)/1000})},
    log:()=>{},save:(name,value)=>order.push(value.ok===undefined?'save':value.ok?'reply-ok':'reply-failed'),
    commandLive:()=>order.push('live'),close:async()=>order.push('close'),boundary:{close:fn=>fn()},
    presetAttachment:{begin:async()=>{order.push('begin');if(failure==='begin')throw Error('binding missing');},success:async()=>order.push('success'),failed:async()=>order.push('failed')},
    mailboxDispatch:async()=>{order.push('dispatch');if(failure==='dispatch')throw Error('command failed');}};
   await vm.runInNewContext('(async()=>{'+mailboxBody+'})()',ctx);
   assert.deepEqual(order,failure==='begin'?['begin','failed','reply-failed','close']:failure?['begin','dispatch','failed','reply-failed','close']:['begin','dispatch','success','live','reply-ok']);
   assert.equal(ctx.halted,!!failure);mailboxOrders.push({failure,order});
  }
  // Exercise the shipped PhysicalRoute event method, including original exact
  // queue recognizer and drain loop. Only the IO is synthetic; hooks cannot
  // announce consumption until the existing mask/queue checks accept it.
  const routes=[moduleFrom(routeOriginal+'\nmodule.exports.PhysicalRoute=PhysicalRoute;',routeFile),moduleFrom(a.composeRoute(routeOriginal)+'\nmodule.exports.PhysicalRoute=PhysicalRoute;',routeFile),moduleFrom(a.composeRoute(routeOriginal)+'\nmodule.exports.PhysicalRoute=PhysicalRoute;',routeFile)];
  const fixtureFile=path.join(ROOT,'scratch/runs/20261104-stronghold-balanced-menu-route/fixture.cjs');
  const fixtureSource=a.replaceOnce(fs.readFileSync(fixtureFile,'utf8'),'fs.readFileSync(path.join(root,p))',`require(${JSON.stringify(require.resolve('../tools/stronghold-preset-driver-attachment.cjs'))}).retained(path.join(root,p))`);
  const {setup}=moduleFrom(fixtureSource,fixtureFile),orders=[],arms=[];
  for(const [index,r]of routes.entries()){
   const f=setup(),order=[],hook={event:async(kind,s)=>{order.push(kind);assert.equal(s.main.inputQueue.length,kind.endsWith('enqueued')?(kind.startsWith('DOWN')?2:1):0);}};
   const io={...f.io,step:async n=>{order.push('ACK');return f.io.step(n);}};
   const disabled=a.createAttachment({enabled:false,sessions:new Map(),save:()=>{throw Error('OFF evidence call');},log:()=>{},pageState:()=>{throw Error('OFF state call');}});
   const physical=new r.PhysicalRoute(io,{maxSteps:4096,review:f.review,live:()=>{},presetAttachment:index===1?hook:index===2?disabled:undefined});
   const point={x:84,y:733},plan={x:67,y:491};await physical.event('move',point,0x200,0,65537,plan);
   await physical.event('down',point,0x201,1,65537,plan);await physical.event('up',point,0x202,0,65537,plan);
   arms.push({events:f.events.map(({queuedAt,...e})=>e),acks:f.acks,steps:physical.used,shots:f.shots});orders.push(order);
  }
  assert.deepEqual(arms[0],arms[1],'observer OFF/ON leaves actual renderer inputs, ACKs, steps and capture count unchanged');
  assert.deepEqual(arms[0],arms[2],'explicit observer OFF preserves original renderer commands and bounds');assert.deepEqual(orders[0],orders[2]);
  assert.deepEqual(orders[1],['ACK','DOWN-enqueued','ACK','ACK','DOWN-consumed','UP-enqueued','ACK','UP-consumed']);
  assert.equal(arms[1].steps,256);assert.equal(arms[1].shots.length,0);
  const hookOrder=[],png=Buffer.from('synthetic capture bytes; no image/game claim'),capState={main:{tick:{steps:64}}};
  const capContext={Buffer,path,OUT:'/fixture',fs:{existsSync:()=>false,writeFileSync:()=>hookOrder.push('PNG-written'),renameSync:()=>hookOrder.push('PNG-sealed')},page:{screenshot:async()=>png},state:async()=>capState,sha:a.hash,save:()=>hookOrder.push('digest-state-sealed'),presetAttachment:{capture:async(name,digest,s)=>{assert.equal(name,'fixture');assert.equal(digest,a.hash(png));assert.equal(s,capState);hookOrder.push('capture-hook');}}};
  await vm.runInNewContext(compiled.slice(compiled.indexOf('async function freshShot('),compiled.indexOf('function operatorLive()'))+'freshShot("fixture")',capContext);
  assert.deepEqual(hookOrder,['PNG-written','PNG-sealed','digest-state-sealed','capture-hook']);
  let steps=0;const transportOrder=[],p={evaluate:async(fn,n)=>{transportOrder.push('original-step');steps+=n;return ack(steps);},mouse:Object.fromEntries(['move','down','up'].map(n=>[n,async()=>{}]))};
  const transport={navigationSteps:0,commandLive:()=>{},state:async()=>({main:{tick:{steps}}}),log:()=>{},presetAttachment:{active:true,ack:async(result,n,before)=>{assert.equal(before,0);assert.equal(n,64);assert.equal(result.steps,64);transportOrder.push('ACK-hook');}}};
  vm.runInNewContext(compiled.slice(compiled.indexOf('function installTransportEvidence('),compiled.indexOf('async function main()'))+'globalThis.install=installTransportEvidence;',transport);transport.install(p);await p.evaluate(n=>WineFrozen.step(n),64);
  assert.equal(transport.navigationSteps,64);assert.deepEqual(transportOrder,['original-step','ACK-hook']);
  output.composition={driverSHA256:a.hash(compiled),offSHA256:a.hash(off),routeSHA256:a.hash(a.composeRoute(routeOriginal)),closureCompiled:true,mailboxOrders,orders,arms,hookOrder,transportOrder,retainedClosure:a.closureHashes(driverFile)};
 }
 (async()=>{await driver();await native();console.log('PASS Stronghold attachment: sealed driver composition, shipped Worker native dynamic returns, binding/command/idle/cleanup controls; fixture only');
  if(process.env.STRONGHOLD_ATTACHMENT_RESULT)fs.writeFileSync(process.env.STRONGHOLD_ATTACHMENT_RESULT,JSON.stringify(output,null,2)+'\n');
 })().catch(error=>{console.error(error);process.exitCode=1;});
}
