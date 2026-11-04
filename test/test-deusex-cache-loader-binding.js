'use strict';
// Offline original-media fragments through the production loader and queued
// owning Worker. Test access only reads exports/report; it installs no observer.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Worker,MessageChannel,isMainThread,parentPort,workerData}=require('node:worker_threads');
const {CacheLoaderBinding,sha256}=require('../lib/deusex-cache-loader-binding');
const ROOT=path.resolve(__dirname,'..'),H=b=>crypto.createHash('sha256').update(b).digest('hex');
const le=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255];
const media=['core.dll','softdrv.dll'].map(n=>path.join(ROOT,'test/binaries/candidates/deus-ex-demo/installed/system',n));
const pins=['2de35e0b4cf498e3587c76c0d0d332e5c29e1915986a79fa1521d8124a4c6167','25d14f3b6cca27053aa05b191424f4c0c0dffe0837406b44eb606cb9d8aeae18'];
const originals=media.map((p,i)=>{const b=fs.readFileSync(p);assert.equal(H(b),pins[i]);return b;});

async function physical() {
  const {e,memory,binding,workerSourceSha}=globalThis.cacheFixtureAccess(),bytes=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer);
  assert.equal(!!binding,workerData.observed,'production opt-in must install the binding');
  let release;
  const request=command=>new Promise(resolve=>{release={resolve};parentPort.postMessage({t:'fixtureCommand',command});});
  workerData.port.on('message',m=>{const r=release;release=null;r.resolve(m);});
  const wa=a=>{const w=e.guest_to_wasm(a)>>>0;assert.notEqual(w,0xf0);return w;};
  const put=(a,b)=>bytes.set(b,wa(a)),u32=(a,v)=>dv.setUint32(wa(a),v>>>0,true);
  const exe=fs.readFileSync(path.join(ROOT,'test/binaries/notepad.exe'));
  bytes.set(exe,e.get_staging());assert(e.load_pe(exe.length));e.set_api_log(0);
  const loader=require('../lib/dll-loader');
  const core=loader.loadDll(e,memory.buffer,originals[0],'C:\\fixture\\core.dll');
  const soft=loader.loadDll(e,memory.buffer,originals[1],'C:\\fixture\\softdrv.dll');
  assert.equal(core.existing,undefined);assert.equal(soft.existing,undefined);
  const cache=0x1800000,item=cache+0x11000,payload=item+0x1000,stack=cache+0x14000;
  const allocator=cache+0x15000,stub=0x401900,entry=0x401100,caller=0x401800;
  u32(core.loadAddr+0xa7c44,allocator);u32(allocator,allocator+32);u32(allocator+32,stub);
  put(stub,[0xb8,...le(item),0xc2,8,0]);
  // Synthetic external DllMain driver CALLs original Core Init. This is the
  // actual loader callback generator, not original DllMain/game startup.
  const route=[];
  for(const a of [0,payload,8,256])route.push(0x68,...le(a));
  route.push(0xb9,...le(cache),0xb8,...le(core.loadAddr+0x24a00),0xff,0xd0,0xb8,1,0,0,0,0xc2,12,0);
  put(entry,route);put(caller,[0xeb,0xfe]);put(caller+16,[0x0f,0x0b]);
  e.invalidate_code_range(entry,0x900);e.set_esp(stack);e.set_eip(caller);
  const {pe}=require('./test-dll-lifecycle-real-pe');
  const driver=pe([[0x1000,route]],true);
  const outcome=await request({t:'loadDlls',exeBytes:exe,configs:[{name:'cache-fixture.dll',bytes:driver}]});
  assert.equal(outcome.t,'dllsLoaded');assert.equal(outcome.results.length,1);
  assert.equal(e.guest_read32(cache),1);
  const state=()=>Object.fromEntries(['eip','esp','ebp','eax','ebx','ecx','edx','esi','edi','flag_op','flag_a','flag_b','flag_res','flag_sign_shift','yield_reason','last_run_blocks','last_run_halt'].map(n=>[n,e['get_'+n]()>>>0]));
  const initialization={memoryHash:H(bytes),state:state(),outcome};
  if(binding) {
    assert.equal(binding.report.sources.length,2,JSON.stringify(binding.report));
    const r=binding.report.sources[0].report;
    assert.equal(r.coverage.initEntries,1,JSON.stringify(r));assert.equal(r.coverage.initReturns,1,JSON.stringify(r));
    assert.equal(r.records.find(r=>r.name==='Init').initializedBefore,0);
  }
  // Production loader reuse returns the existing generation, never resets or
  // splices its observer. SoftDrv is marked LIVE without executing its DllMain.
  e.complete_dll_initialize(soft.index,soft.generation,3);
  const reuse=loader.loadDll(e,memory.buffer,originals[1],'C:\\fixture\\softdrv.dll');
  assert.equal(reuse.existing,true);assert.equal(reuse.generation,soft.generation);
  if(binding)assert.equal(binding.report.sources.length,2);
  // A minimal independent SoftDrv palette fragment; no release matrix rerun.
  const client=cache+0x16000,selected=cache+0x17000,sentinel=selected+32,frame=cache+0x18000;
  u32(client+4,17);u32(client+8,0x11223344);u32(client+12,0x55667788);u32(client+16,selected);
  u32(selected,0x11223344);u32(selected+4,0x55667788);u32(selected+8,payload);u32(selected+16,64);
  u32(selected+20,sentinel);u32(sentinel+8,payload+2048);u32(sentinel+24,selected);
  e.set_ebp(frame);e.set_esp(frame-64);e.set_ecx(client);e.set_edx(0x11223344);e.set_edi(0x55667788);e.set_ebx(8);e.set_eax(0x11223344);
  e.set_eip(soft.loadAddr+0x26506);
  const trace=[];
  while(e.get_eip()>>>0!==soft.loadAddr+0x26594&&trace.length<10) {
    const reply=await request({t:'slice',steps:1});assert.equal(reply.trapped,null);trace.push({blocks:reply.blocks,trapped:reply.trapped,state:state()});
  }
  assert.equal(e.get_eip()>>>0,soft.loadAddr+0x26594);assert.equal(e.guest_read32(selected+16)>>>0,0x1000040);
  const status=await request({t:'cacheObservation',action:'status'});
  assert.equal(!!status.result,!!binding);
  if(binding)assert.equal(status.result.sources[1].report.coverage.acquisitions,1,JSON.stringify(status));
  const final={memoryHash:H(bytes),state:state()};
  e.set_eip(caller);
  const batching=await request({t:'slice',steps:7});assert.equal(batching.blocks,7);
  assert.equal(e.get_last_run_blocks(),7);
  // One completed block then a real trap: the facade must retain the prior
  // public run count just as a trapping unsplit run does.
  put(caller+32,[0xeb,0,0x0f,0x0b]);e.invalidate_code_range(caller+32,4);e.set_eip(caller+32);
  const trap=await request({t:'slice',steps:3});assert.match(trap.trapped,/unreachable/i);
  const {ms:trapMs,...trapState}=trap;
  const afterTrap={memoryHash:H(bytes),state:state(),trap:trapState};
  const terminalReport=binding?.snapshot()||null;
  if(binding) {
    assert.equal(terminalReport.status,'guest-trap');
    assert(terminalReport.sources.every(s=>s.report.status==='guest-trap'));
  }
  // Isolated controls after all parity snapshots. They never certify history.
  const controls=[];
  function make() {return new CacheLoaderBinding(e,{workerSlot:0,endpointIdentity:1,limits:{maxMs:10000}});}
  function hidePriorClients() {
    for(let i=1;i<e.get_dll_count();i++)dv.setUint32(e.get_dll_lifecycle_table()+i*e.get_dll_lifecycle_stride(),0,true);
  }
  const late=make();assert.equal(late.report.events[0].type,'late-attachment');assert.equal(late.report.sources.length,0);late.exports.run(0);controls.push('late-attachment-no-adoption');
  const wrong=Buffer.from(originals[1]);wrong[wrong.length-1]^=1;
  const bad=make();bytes.set(wrong,e.get_staging());bad.exports.load_dll(wrong.length,0x2000000);
  assert.equal(bad.report.sources.length,0);assert(bad.report.events.some(r=>r.type==='unverified-media'));controls.push('wrong-media');
  assert.throws(()=>new CacheLoaderBinding(e,{workerSlot:1,endpointIdentity:1}),/owner/);controls.push('wrong-worker');
  if(binding) {
    hidePriorClients();
    const reload=make(),rx=reload.exports;
    const first=loader.loadDll(rx,memory.buffer,originals[1],'C:\\fixture\\reload-softdrv.dll');
    assert.equal(reload.report.sources.length,1);
    // No original DllMain was executed: outcome 3 means no callback attached.
    loader.finishDllInitialization(rx,memory.buffer,{...first,dllMain:0},null);
    assert.equal(loader.drainDllUnload({exports:rx,memoryBuffer:memory.buffer},first.loadAddr),true);
    reload.snapshot();assert.equal(reload.report.sources[0].report.status,'binding-lost');
    const second=loader.loadDll(rx,memory.buffer,originals[1],'C:\\fixture\\reload-softdrv.dll');
    assert.notEqual(second.generation,first.generation);assert.equal(reload.report.sources.length,2);
    assert(reload.report.sources.every(s=>s.history==='unknown'));controls.push('production-unload-reload-no-history-join');
    // Fresh verified generations, then independently lose each ownership fact.
    for(const [name,mutate] of [
      ['unload',(row,life)=>dv.setUint32(life,0,true)],
      ['stale-generation',(row,life)=>dv.setUint32(life+4,dv.getUint32(life+4,true)+1,true)],
      ['wrong-base',row=>dv.setUint32(row,dv.getUint32(row,true)+4096,true)],
      ['wrong-thread',()=>e.set_current_thread_id(2)]
    ]) {
      // Isolate generation controls from earlier deliberately duplicated raw
      // mappings; these mutations occur strictly after the parity snapshots.
      hidePriorClients();
      const b=make();bytes.set(originals[1],e.get_staging());b.exports.load_dll(originals[1].length,0x2400000+controls.length*0x100000);
      const s=b.active.at(-1);assert(s,JSON.stringify(b.report));
      const row=e.get_dll_table()+s.token.index*32,life=e.get_dll_lifecycle_table()+s.token.index*e.get_dll_lifecycle_stride();
      const savedRow=bytes.slice(row,row+32),savedLife=bytes.slice(life,life+e.get_dll_lifecycle_stride());
      mutate(row,life);b.snapshot();assert.equal(s.source.result.status,'binding-lost');
      bytes.set(savedRow,row);bytes.set(savedLife,life);e.set_current_thread_id(1);controls.push(name);
    }
  }
  parentPort.postMessage({pass:true,workerSourceSha,initialization,trace,final,afterTrap,controls,report:status.result,terminalReport});
}

if(!isMainThread) {
  const filename=path.join(ROOT,'lib/guest-worker.js'),Module=require('node:module'),entry=new Module(filename,module);
  entry.filename=filename;entry.paths=module.paths;
  let source=fs.readFileSync(filename,'utf8');
  if(process.env.DEUSEX_BINDING_BASELINE) {
    assert(source.includes('instance = { exports: cacheLoaderBinding.exports };'));
    source=source.replace('instance = { exports: cacheLoaderBinding.exports };','/* retained integration-gap control: ordinary raw exports */');
  }
  entry._compile(source+'\n;globalThis.cacheFixtureAccess=()=>({e:instance.exports,memory,binding:cacheLoaderBinding,workerSourceSha:'+JSON.stringify(H(source))+'});',filename);
  workerData.port.once('message',()=>physical().catch(error=>parentPort.postMessage({t:'fixtureFailure',error:error.stack})));
} else {
  // Exercise the browser synchronous SHA implementation against crypto, without
  // browser/game/runtime access or copied media.
  const vm=require('node:vm'),context={self:{DeusExStartupCacheObserver:require('../lib/deusex-startup-cache-observer'),DeusExInlineEvictionObserver:require('../lib/deusex-inline-eviction-observer'),DeusExSoftDrvCacheObserver:require('../lib/deusex-softdrv-cache-observer')}};
  vm.runInNewContext(fs.readFileSync(path.join(ROOT,'lib/deusex-cache-loader-binding.js'),'utf8'),context);
  for(const b of [Buffer.alloc(0),Buffer.from('abc'),...originals])assert.equal(context.self.DeusExCacheLoaderBinding.sha256(b),H(b));
  assert.equal(sha256(originals[0]),pins[0]);
  async function one(observed,variant) {
    const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),{port1,port2}=new MessageChannel();
    const sigs=require('../lib/host-import-sigs.generated.json').sigs;
    const broker=require('../lib/guest-rpc').createMainBroker(memory,Object.fromEntries(Object.keys(sigs).map(n=>[n,()=>{
      if(!['log','log_i32','beep_process_begin','beep_thread_begin'].includes(n))throw Error('unexpected broker '+n);return 0;
    }])),sigs);
    const wasmBytes=fs.readFileSync(path.join(ROOT,'build',variant)),wasmHash=H(wasmBytes);
    const wasm=await WebAssembly.compile(wasmBytes);
    const w=new Worker(__filename,{workerData:{port:port2,observed},transferList:[port2]});
    return new Promise((resolve,reject)=>{
      let seq=0;const commands=[];
      const finish=async(error,value)=>{clearTimeout(timer);await w.terminate();port1.close();error?reject(error):resolve(value);};
      const timer=setTimeout(()=>finish(Error('loader binding transport timeout')),60000);
      w.on('error',error=>finish(error));
      w.on('message',m=>{
        if(m.t==='ready')port1.postMessage({t:'start'});
        else if(m.t==='rpc')broker.serveRpc(m.slot,m.waitEntry);
        else if(m.t==='call')broker.serveCall(m);
        else if(m.t==='calls')broker.serveCalls(m);
        else if(m.t==='fixtureCommand'){const c={...m.command,seq:++seq};commands.push(c);w.postMessage(c);}
        else if(m.t==='sliceDone'||m.t==='cacheObservationResult'||m.t==='dllsLoaded')port1.postMessage(m);
        else if(m.t==='fixtureFailure'||m.t==='error')finish(Error(JSON.stringify(m)));
        else if(m.pass)finish(null,{...m,wasmHash,commands});
      });
      w.postMessage({t:'init',seq:0,module:wasm,memory,sigs,slot:0,endpointIdentity:1,
        cacheObservation:observed?{limits:{maxBoundaries:1000000,maxRecords:256,maxMs:10000}}:undefined});
    });
  }
  (async()=>{
    const results=[];
    for(const variant of ['wine-assembly.wasm','wine-assembly.compat.wasm']) {
      const control=await one(false,variant),observed=await one(true,variant);
      for(const key of ['initialization','trace','final','afterTrap','commands','wasmHash','workerSourceSha'])assert.deepEqual(observed[key],control[key],key);
      results.push({variant,control,observed});console.log('PASS production media loader + initialization + queued Worker whole-state/command/trap parity',variant);
    }
    if(process.env.DEUSEX_BINDING_RESULT)fs.writeFileSync(process.env.DEUSEX_BINDING_RESULT,JSON.stringify({pass:true,fixtureOnly:true,media:media.map((p,i)=>({path:p,sha256:pins[i]})),results},null,2));
  })().catch(error=>{console.error(error);process.exitCode=1;});
}
