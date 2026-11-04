'use strict';
// Original PE fragments with synthetic caller/data, actual shipped OS Worker.
// No browser/game route, real DOM input, gameplay or natural callback claim.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Worker,MessageChannel,isMainThread,parentPort,workerData}=require('node:worker_threads');
const api=require('../tools/stronghold-native-preset-observer.cjs');
const ROOT=path.resolve(__dirname,'..'),H=b=>crypto.createHash('sha256').update(b).digest('hex');
const MEDIA='test/binaries/candidates/stronghold-crusader-demo/installed/App_Executables/Stronghold Crusader multiplayer demo.exe';
const exe=fs.readFileSync(path.join(ROOT,MEDIA));assert.equal(H(exe),api.EXE_SHA256);
const pe=exe.readUInt32LE(60),opt=pe+24,sections=opt+exe.readUInt16LE(pe+20);
function original(pc,n){for(let i=0;i<exe.readUInt16LE(pe+6);i++){const p=sections+i*40,va=exe.readUInt32LE(p+12)+0x400000;
  if(pc>=va&&pc+n<=va+exe.readUInt32LE(p+16))return exe.subarray(exe.readUInt32LE(p+20)+pc-va,exe.readUInt32LE(p+20)+pc-va+n);}throw Error('unmapped PE');}
for(const p of api.PINS)assert.equal(original(p.pc,p.hex.length/2).toString('hex'),p.hex);
assert.equal(exe.readUInt32LE(opt+136),0);assert.equal(exe.readUInt32LE(opt+140),0); // No relocations: reject another base.
const le=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255];
async function physical(){
  const {e,memory,host}=globalThis.fixtureAccess,bytes=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer);
  const wa=a=>{const w=e.guest_to_wasm(a)>>>0;assert.notEqual(w,0xf0);return w;};
  const put=(a,b)=>bytes.set(b,wa(a)),u32=(a,v)=>dv.setUint32(wa(a),v>>>0,true),get=a=>e.guest_read32(a)>>>0;
  bytes.set(exe,e.get_staging());assert(e.load_pe(exe.length));e.set_api_log(0);
  const options={host,getExports:()=>e,workerSlot:0,exeSha256:api.EXE_SHA256,wasmSha256:workerData.wasmHash,
    workerURL:'lib/guest-worker.js?v=fixture',expectedWorkerURL:'lib/guest-worker.js?v=fixture',deadline:performance.now()+10000};
  const h=workerData.observed?globalThis.fixturePreload.entries[0].observer:null;
  // Diagnostic arming is deliberately outside the passive helper. The control
  // has neither helper nor trace; normal Worker slice commands are identical.
  if(h){assert.equal(globalThis.fixturePreload.entries[0].installedBeforeInstantiation,true);
    assert.equal(globalThis.fixturePreload.start().status,'running',JSON.stringify(h.report));}
  if(h||workerData.traceControl)e.set_trace_esp(1,0,0);
  let pending;
  const slice=n=>new Promise((resolve,reject)=>{pending={resolve,reject};parentPort.postMessage({t:'fixtureSliceRequest',steps:n});});
  workerData.port.on('message',m=>{if(m.t==='slice'){const r=pending;pending=null;m.message.trapped?r.reject(Error(m.message.trapped)):r.resolve(m.message.blocks);}});
  const state=()=>Object.fromEntries(['eip','esp','ebp','eax','ebx','ecx','edx','esi','edi','flag_op','flag_a','flag_b','flag_res','flag_sign_shift','yield_reason','last_run_blocks','last_run_halt'].map(n=>[n,e['get_'+n]()>>>0]));
  const caller=0x580000,stop=caller+64,stack=0x7408000,segments=[];
  const memoryState=()=>({memoryHash:H(bytes),guestHash:H(bytes.subarray(e.guest_to_wasm(0x400000)>>>0,(e.guest_to_wasm(0x400000)>>>0)+0x3c00000)),
    pageHashes:Array.from({length:bytes.length/65536},(_,i)=>H(bytes.subarray(i*65536,(i+1)*65536)))});
  put(stop,[0xeb,0xfe]);put(stop+16,[0x0f,0x0b]);e.invalidate_code_range(stop,18);
  async function execute(name,target,arg,setup,check=true){
    setup();const code=[0x68,...le(arg),0xb8,...le(target),0xff,0xd0,0x83,0xc4,4,0xe9,...le(stop-(caller+20))];
    assert.equal(code.length,20);put(caller,code);e.invalidate_code_range(caller,20);e.set_esp(stack);e.set_eip(caller);
    const returns=[];do{returns.push(await slice(64));}while(e.get_eip()>>>0!==stop&&returns.length<32);
    assert.equal(e.get_eip()>>>0,stop,name+' '+JSON.stringify(state()));const returned=returns;
    if(h&&check)assert.equal(h.report.status,'running',JSON.stringify(h.report));
    segments.push({name,returned,state:state(),...memoryState()});
  }
  h?.annotate({command:19,kind:'begin'});h?.annotate({command:19,kind:'DOWN-enqueued'});
  await execute('hover-mode-rejected',api.CUTS.hover,1,()=>u32(0x1681318,0));
  await execute('hover-description-only',api.CUTS.hover,1,()=>{u32(0x1681318,99);u32(0x995674,1);u32(0x995678,0);u32(0x657abc,0);});
  assert.equal(get(0x69332c),1);
  await execute('activation-mode-rejected',api.CUTS.activate,1,()=>u32(0x1681318,0));
  await execute('activation-pending-rejected',api.CUTS.activate,1,()=>{u32(0x1681318,99);u32(0x69165c,2);});
  h?.annotate({command:19,kind:'DOWN-consumed',source:'synthetic host annotation; not actual DOM consumption'});
  h?.annotate({command:19,kind:'UP-enqueued'});
  await execute('updater-no-edge',api.CUTS.update,0,()=>{u32(0x69165c,1);u32(0x1bd26a4,0);u32(0x691bd0,0);});
  h?.annotate({command:19,kind:'UP-consumed',source:'synthetic host annotation; not actual DOM consumption'});
  // Original updater calls original helper and rejected-choice application;
  // synthetic pending 4 avoids resetting/adding real gameplay configuration.
  await execute('updater-application-return',api.CUTS.update,0,()=>{u32(0x69165c,4);u32(0x1bd26a4,1);u32(0x691bd0,0);u32(0xfb4620,0);u32(0xdbbd30,0);u32(0xfb464c,0);u32(0xfb4638,0);});
  assert.equal(get(0x69165c),0);
  for(const prior of [0,1]){
    u32(0x1bd26b0,1);u32(0x1bd26bc,prior);u32(0x1bd26a4,99);
    e.set_esi(0x1bd2670);e.set_edi(0);e.set_ebx(1);e.set_ebp(0);e.set_esp(stack);e.set_eip(api.CUTS.mouseBefore);
    const returned=[];while(e.get_eip()>>>0!==api.CUTS.mouseAfter&&returned.length<8)returned.push(await slice(1));
    assert.equal(e.get_eip()>>>0,api.CUTS.mouseAfter);returned.push(await slice(1));assert.equal(get(0x1bd26a4),prior?0:1);
    segments.push({name:prior?'original-mouse-held-no-edge-fragment':'original-mouse-new-edge-fragment',returned,state:state(),...memoryState()});
  }
  // Full original choice-1 entry/reset/queue path, stopped before its UI text
  // helper requires uninitialized gameplay assets. No return/edge-clear claim.
  u32(0x1681318,99);u32(0x69165c,0);u32(0x1bd26a4,1);
  put(caller,[0x68,...le(1),0xb8,...le(api.CUTS.activate),0xff,0xd0,0xeb,0xfe]);e.invalidate_code_range(caller,14);e.set_esp(stack);e.set_eip(caller);
  const queueReturns=[];while(e.get_eip()>>>0!==api.CUTS.queueAfter&&queueReturns.length<4096)queueReturns.push(await slice(1));
  assert.equal(e.get_eip()>>>0,api.CUTS.queueAfter);queueReturns.push(await slice(1));
  assert.equal(get(0x69165c),1);assert.equal(get(0x690f7c),1);
  segments.push({name:'choice1-entry-reset-queue-partial',returned:queueReturns,state:state(),...memoryState()});
  h?.annotate({command:19,kind:'ACK',steps:64});h?.annotate({command:19,kind:'capture',sha256:'a'.repeat(64),source:'synthetic digest control'});
  h?.annotate({command:19,kind:'failed',reason:'fixture command failure'});
  if(h){assert.equal(h.report.status,'command-failed');assert.equal(h.report.coverage.applications,1);assert.equal(h.report.pending.length,1);
    assert(h.report.records.some(r=>r.kind==='native-edge-decision'&&r.edge===0));
    assert(h.report.records.some(r=>r.kind==='native-edge-accepted'));
    assert(h.report.records.some(r=>r.kind==='native-return'&&r.name==='application'));
    assert(h.report.records.some(r=>r.kind==='native-block'&&r.label==='mouseAfter'&&r.state.mouse34===1));
    assert(h.report.records.some(r=>r.kind==='native-block'&&r.label==='mouseAfter'&&r.state.mouse34===0));
    assert.equal(h.report.coverage.queues,1);assert.throws(()=>h.start(),/terminal/);}
  if(h||workerData.traceControl)e.set_trace_esp(0,0,0);
  const paritySegments=segments.length,beforeTrap={state:state(),...memoryState()};e.set_eip(stop+16);
  let trapped;try{await slice(64);}catch(error){trapped=String(error);}assert(trapped);
  const afterTrap={state:state(),...memoryState(),trapped};
  // Negative controls inspect real exports/imports after parity snapshots.
  e.clear_yield();e.set_eip(stop);const negatives={};
  function fresh(extra={}){return api.attach({...options,deadline:performance.now()+10000,...extra});}
  function rejected(name,setup,pattern){const x=fresh();setup(x);x.start();assert.match(x.report.error,pattern,JSON.stringify(x.report));negatives[name]=x.report.error;return x;}
  rejected('wrongThread',()=>e.set_current_thread_id(2),/thread/);e.set_current_thread_id(1);
  const header=get(0x40014c);rejected('wrongLoader',()=>u32(0x40014c,0x500000),/header/);u32(0x40014c,header);
  const saved=get(api.CUTS.hover);rejected('wrongBytes',()=>u32(api.CUTS.hover,0),/bytes/);u32(api.CUTS.hover,saved);
  assert.throws(()=>fresh({workerSlot:1}),/identity/);assert.throws(()=>fresh({exeSha256:'0'.repeat(64)}),/identity/);
  assert.throws(()=>fresh({workerURL:'foreign'}),/identity/);assert.throws(()=>fresh({deadline:0}),/deadline/);
  let clock=0,x=fresh({now:()=>clock,deadline:10});x.start();clock=10;x.check();assert.equal(x.report.status,'deadline-expired');negatives.deadline=x.report.status;
  x=fresh();x.start();x.check();assert.match(x.report.error,/trace delivery missing/);negatives.noHistory=x.report.error;
  let changed=false;x=fresh({getExports:()=>changed?{...e}:e});x.start();changed=true;x.check();assert.match(x.report.error,/instance/);negatives.instance=x.report.error;
  x=fresh();x.start();x.annotate({command:2,kind:'UP-consumed'});assert.match(x.report.error,/history/);negatives.command=x.report.error;
  x=fresh({maxMs:5});x.start();await new Promise(resolve=>setTimeout(resolve,20));assert.equal(x.report.status,'deadline-expired');negatives.idleDeadline=x.report.status;
  x=fresh({maxRecords:1});x.start();e.set_trace_esp(1,0,0);await execute('record-cap',api.CUTS.hover,1,()=>u32(0x1681318,0),false);
  assert.equal(x.report.status,'record-limit');negatives.records=x.report.status;e.set_trace_esp(0,0,0);
  x=fresh({maxBoundaries:1});x.start();e.set_trace_esp(1,0,0);await execute('boundary-cap',api.CUTS.hover,1,()=>u32(0x1681318,0),false);
  assert.equal(x.report.status,'boundary-limit');negatives.boundaries=x.report.status;e.set_trace_esp(0,0,0);
  // Real original application reached without updater history must stop. No
  // hand-called log_block or reconstructed native callback is used anywhere.
  x=fresh();x.start();e.set_trace_esp(1,0,0);
  await execute('missing-application-history',api.CUTS.apply,4,()=>{},false);
  assert.match(x.report.error,/history missing/);negatives.application=x.report.error;e.set_trace_esp(0,0,0);
  parentPort.postMessage({pass:true,segments:segments.slice(0,paritySegments),beforeTrap,afterTrap,observation:h?.report||null,negatives,
    media:{path:MEDIA,sha256:api.EXE_SHA256},wasm:workerData.wasmHash,workerSourceSHA:globalThis.fixtureWorkerSourceSHA});
}
if(!isMainThread){
  if(workerData.observed)globalThis.fixturePreload=api.installPreload({realmURL:'lib/guest-worker.js?v=fixture',expectedWorkerURL:'lib/guest-worker.js?v=fixture',
    exeSha256:api.EXE_SHA256,wasmSha256:workerData.wasmHash,deadlineEpochMs:Date.now()+15000,
    listen:fn=>parentPort.on('message',data=>fn({data}))});
  const instantiate=WebAssembly.instantiate;
  WebAssembly.instantiate=async function(module,imports,...rest){
    // Stable test-only import router permits fresh negative observers after
    // the parity arm. Both arms use it; every callback comes from real WASM.
    // The original-run recipe instead installs once BEFORE instantiation.
    const host={...imports.host};imports.host.log_block=(...args)=>host.log_block(...args);
    const result=await Reflect.apply(instantiate,this,[module,imports,...rest]);
    globalThis.fixtureAccess={e:(result.instance||result).exports,memory:imports.host.memory,host};return result;};
  const filename=path.join(ROOT,'lib/guest-worker.js'),workerSource=fs.readFileSync(filename),Module=require('node:module'),entry=new Module(filename,module);
  globalThis.fixtureWorkerSourceSHA=H(workerSource);entry.filename=filename;entry.paths=module.paths;entry._compile(workerSource.toString(),filename);
  workerData.port.once('message',()=>physical().catch(error=>parentPort.postMessage({t:'fixtureFailure',error:error.stack})));
}else{
  async function one(observed,variant,traceControl=false){
    const wasmBytes=fs.readFileSync(path.join(ROOT,'build',variant)),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),{port1,port2}=new MessageChannel();
    const sigs=require('../lib/host-import-sigs.generated.json').sigs;
    let diagnosticImports=0;
    const broker=require('../lib/guest-rpc').createMainBroker(memory,Object.fromEntries(Object.keys(sigs).map(n=>[n,()=>{
      if(n==='log_block'){diagnosticImports++;return;}if(!['log','log_i32','beep_process_begin','beep_thread_begin','midi_stream_service'].includes(n))throw Error('unexpected broker '+n);return 0;
    }])),sigs);
    const module=await WebAssembly.compile(wasmBytes),w=new Worker(__filename,{workerData:{port:port2,observed,traceControl,variant,wasmHash:H(wasmBytes)},transferList:[port2]});
    return new Promise((resolve,reject)=>{let seq=0;const commands=[];
      const finish=async(error,value)=>{clearTimeout(timer);await w.terminate();port1.close();error?reject(error):resolve(value);};
      const timer=setTimeout(()=>finish(Error('Worker timeout')),45000);w.on('error',error=>finish(error));
      w.on('message',m=>{if(m.t==='ready')port1.postMessage({t:'start'});else if(m.t==='rpc')broker.serveRpc(m.slot,m.waitEntry);
        else if(m.t==='call')broker.serveCall(m);else if(m.t==='calls')broker.serveCalls(m);
        else if(m.t==='fixtureSliceRequest'){const c={t:'slice',seq:++seq,steps:m.steps};commands.push(c);w.postMessage(c);}
        else if(m.t==='sliceDone')port1.postMessage({t:'slice',message:m});
        else if(m.t==='fixtureFailure'||m.t==='error')finish(Error(JSON.stringify(m)));
        else if(m.pass)finish(null,{...m,diagnosticImports,commands});});
      w.postMessage({t:'init',seq:0,module,memory,sigs,slot:0,endpointIdentity:1,forwardGuestLogs:true});
    });
  }
  (async()=>{const results=[];for(const variant of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
    const control=await one(false,variant),traceControl=await one(false,variant,true),observed=await one(true,variant);
    assert.equal(observed.workerSourceSHA,control.workerSourceSHA,'Worker source stable across controls');assert.equal(observed.workerSourceSHA,traceControl.workerSourceSHA);
    const differences=[];
    for(const [label,a,b]of [...observed.segments.map((v,i)=>[v.name,v,control.segments[i]]),['beforeTrap',observed.beforeTrap,control.beforeTrap],['afterTrap',observed.afterTrap,control.afterTrap]]){
      assert.deepEqual(a.state,b.state,label+' registers/flags');assert.equal(a.guestHash,b.guestHash,label+' guest memory');assert.deepEqual(a.returned,b.returned);assert.equal(a.trapped,b.trapped);
      const pages=a.pageHashes.flatMap((v,i)=>v!==b.pageHashes[i]?[i*65536]:[]);
      assert.deepEqual(pages,[require('../lib/region-map.generated').BASE.THREAD_RPC],label+' only diagnostic RPC mailbox differs');
      differences.push({label,pages});
    }
    assert.deepEqual(observed.commands,control.commands);console.log('private page differences',JSON.stringify(differences));
    for(const key of ['segments','beforeTrap','afterTrap','commands'])assert.deepEqual(observed[key],traceControl[key],'trace-armed no-observer full-memory '+key);
    for(const arm of [control,traceControl,observed])for(const snapshot of [...arm.segments,arm.beforeTrap,arm.afterTrap])delete snapshot.pageHashes;
    assert(observed.diagnosticImports>control.diagnosticImports);results.push({variant,control,traceControl,observed,ordinaryPrivateDifferences:differences});
    console.log('PASS original Stronghold fragments: shipped Worker trace-armed no-observer full-memory parity; ordinary untraced all pages except RPC/registers/flags/returns/slice commands/trap parity',variant);
  }if(process.env.STRONGHOLD_OBSERVER_RESULT)fs.writeFileSync(process.env.STRONGHOLD_OBSERVER_RESULT,JSON.stringify({pass:true,fixtureOnly:true,results},null,2));
  })().catch(error=>{console.error(error);process.exitCode=1;});
}
