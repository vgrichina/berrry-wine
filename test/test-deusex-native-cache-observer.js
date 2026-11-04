'use strict';
// Offline original Core byte fixtures through the shipped queued Worker/WASM.
// Synthetic cache/stack/Engine objects and caller; no game or lifetime callbacks.
const assert=require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const {Worker,MessageChannel,isMainThread,parentPort,workerData}=require('node:worker_threads');
const {CORE_SHA256,CONTRACTS,attach}=require('../lib/deusex-native-cache-observer');
const ROOT=path.resolve(__dirname,'..'), H=b=>crypto.createHash('sha256').update(b).digest('hex');
const media='test/binaries/candidates/deus-ex-demo/installed/system/core.dll';
const core=fs.readFileSync(path.join(ROOT,media));
assert.equal(H(core),CORE_SHA256);
const pe=core.readUInt32LE(60),opt=pe+24, sections=opt+core.readUInt16LE(pe+20);
function original(rva,n) {
  for(let i=0;i<core.readUInt16LE(pe+6);i++) {
    const s=sections+i*40,va=core.readUInt32LE(s+12),len=core.readUInt32LE(s+16);
    if(rva>=va&&rva+n<=va+len) return core.subarray(core.readUInt32LE(s+20)+rva-va,core.readUInt32LE(s+20)+rva-va+n);
  }
  throw Error('unmapped original bytes');
}
for(const c of CONTRACTS) assert.equal(original(c.rva,c.signature.length/2).toString('hex'),c.signature,c.name);
// Seal the instructions that distinguish lock release, identity and inline eviction.
for(const [rva,hex] of [[0x168a0,'814110000000ffc3'],[0x168c0,'8b018b5104c3'],
  [0x168e0,'8b4108c3'],[0x16900,'8b41148b51088b40082bc2c3'],
  [0x2570d,'8b411c8906eb19'],[0x25792,'8b411c8902eb19'],
  [0x257da,'8907894f04895710'],[0x24ca3,'8b4618893e3bc7897e04897e10']])
  assert.equal(original(rva,hex.length/2).toString('hex'),hex);
const le=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255];

async function physical() {
  const {e,memory}=globalThis.nativeFixtureAccess.get(),bytes=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer);
  const wa=a=>{const w=e.guest_to_wasm(a)>>>0;assert.notEqual(w,0xf0);return w;};
  const put=(a,b)=>bytes.set(b,wa(a)), u32=(a,v)=>dv.setUint32(wa(a),v>>>0,true),get=a=>e.guest_read32(a)>>>0;
  const exe=fs.readFileSync(path.join(ROOT,'test/binaries/notepad.exe'));
  bytes.set(exe,e.get_staging());assert(e.load_pe(exe.length));e.set_api_log(0);
  bytes.set(core,e.get_staging());e.load_dll(core.length,workerData.relocated?0x1100000:0x900000);
  const idx=e.get_last_loaded_dll_index(),table=e.get_dll_table(),life=e.get_dll_lifecycle_table(),stride=e.get_dll_lifecycle_stride();
  const base=dv.getUint32(table+idx*32,true);
  assert(e.complete_dll_initialize(idx,dv.getUint32(life+idx*stride+4,true),3));
  const soft=fs.readFileSync(path.join(ROOT,'test/binaries/candidates/deus-ex-demo/installed/system/softdrv.dll'));
  const softHash='25d14f3b6cca27053aa05b191424f4c0c0dffe0837406b44eb606cb9d8aeae18';
  assert.equal(H(soft),softHash);bytes.set(soft,e.get_staging());e.load_dll(soft.length,0x1400000);
  const si=e.get_last_loaded_dll_index();assert(e.complete_dll_initialize(si,dv.getUint32(life+si*stride+4,true),3));
  // Synthetic initialized Engine row lets the actual Draw collector own slices.
  const engine=0x600000,ei=e.get_dll_count();
  u32(engine+60,0x80);u32(engine+0x80,0x4550);u32(engine+0x80+52,0x10300000);
  u32(engine+0x10c,0x200);put(engine+0x200,Buffer.from('Engine.dll\0'));put(engine+0x8e9e0,[0x55,0x8b,0xec,0x6a,0xff]);
  dv.setUint32(table+ei*32,engine,true);dv.setUint32(table+ei*32+4,0x100000,true);dv.setUint32(table+ei*32+8,0x100,true);
  dv.setUint32(life+ei*stride,2,true);dv.setUint32(life+ei*stride+4,123,true);e.set_dll_count(ei+1);
  // Fully original Core mapping, loader-relocated; no code replacement.
  const cache=0x1800000,item=cache+0x11000,sentinel=item+32,payload=item+0x1000,out=cache+0x13000,stack=cache+0x14000;
  u32(cache,1);u32(cache+4,1);u32(cache+24,item);u32(cache+28,sentinel);
  u32(item+8,payload);u32(item+20,sentinel);u32(sentinel+8,payload+64);u32(sentinel+24,item);
  put(sentinel+14,[1]); // Init gives the terminal free-space sentinel a distinct segment.
  // Timing-disabled path is the original data default, never an observer write.
  assert.equal(get(base+0xe5468),0);
  const caller=0x401400,callerStart=0x401100;
  const route=[];
  function call(name,thisPointer,args) {
    for(const a of args.slice().reverse()) route.push(0x68,...le(a));
    route.push(0xb9,...le(thisPointer),0xb8,...le(base+CONTRACTS.find(c=>c.name===name).rva),0xff,0xd0);
  }
  // Same item/address reused for a different 64-bit ID without malloc/free.
  call('Create',cache,[0x11223344,0x55667788,out,64,1,0]);
  call('Get',cache,[0x11223344,0x55667788,out,1]);
  call('Get',cache,[0x10203040,0x50607080,out,1]); // Miss leaves the out-slot stale.
  call('Unlock',item,[]);call('Unlock',item,[]);
  call('Flush',cache,[0x11223344,0x55667788,0xffffffff,0]);
  call('Create',cache,[0xabcdef01,0x12345678,out,64,1,0]);
  call('Unlock',item,[]);
  // The next Create evicts the unlocked item inline. No FlushItem call occurs.
  call('Create',cache,[0x98765432,0x87654321,out,64,1,0]);
  route.push(0xe9,...le(caller-(callerStart+route.length)-5));
  assert(route.length<0x300);put(callerStart,route);put(caller,[0x0f,0x0b]);
  e.invalidate_code_range(callerStart,0x302);e.set_esp(stack);e.set_eip(callerStart);
  if(workerData.mode==='instruction') e.set_instruction_watchpoint(stack+0x100);
  const {OwningDrawObserver}=require('../lib/deusex-draw-observer');
  const owner=new OwningDrawObserver(e,{maxBlocks:10000,maxMs:15000});globalThis.nativeFixtureAccess.setOwner(owner);
  const handle=workerData.observed?attach(owner,{workerSlot:0,coreSha256:CORE_SHA256,limits:{boundaries:10000,records:128,milliseconds:10000}}):null;
  const mmxBase=require('../lib/region-map.generated').BASE.UOP_CSCRATCH+0x139800;
  assert(fs.readFileSync(path.join(ROOT,'src/01-header.wat'),'utf8').includes('(global $MMX_FILE i32 (region.addr $UOP_CSCRATCH 0x139800))'));
  const ordered=workerData.observed?require('../lib/deusex-ordered-producer-observer').attach(owner,{
    workerSlot:0,moduleSha256:softHash,mmxBase,drawId:'native-composition',preDraw:true,
    limits:{boundaries:10000,records:128,milliseconds:10000}}):null;
  let release;
  const slice=()=>new Promise((resolve,reject)=>{release={resolve,reject};parentPort.postMessage({t:'fixtureSliceRequest'});});
  workerData.port.on('message',m=>{if(m.t==='slice'){const r=release;release=null;m.message.trapped?r.reject(Error(m.message.trapped)):r.resolve(m.message.blocks);}});
  const state=()=>Object.fromEntries(['eip','esp','ebp','eax','ebx','ecx','edx','esi','edi',
    'flag_op','flag_a','flag_b','flag_res','flag_sign_shift',
    'yield_reason','last_run_blocks','last_run_halt'].map(n=>[n,e['get_'+n]()>>>0]));
  const trace=[];
  for(let i=0;i<4000&&e.get_eip()>>>0!==caller;i++) {
    const returned=await slice();trace.push({returned,...state()});
  }
  assert.equal(e.get_eip()>>>0,caller,JSON.stringify({state:state(),result:handle?.result,tail:trace.slice(-20),item:Array.from(bytes.slice(wa(item),wa(item)+64)),cache:Array.from(bytes.slice(wa(cache),wa(cache)+40))}));
  assert.equal(get(out),item);assert.equal(get(item),0x98765432);assert.equal(get(item+4),0x87654321);assert.equal(get(item+16),0x1000040);
  const before=H(bytes),beforeState=state();owner.observe();owner.observe();
  assert.equal(H(bytes),before);assert.deepEqual(state(),beforeState);
  const orderedResult=ordered?.stop('fixture-end')||null;
  const observation=handle?.stop('fixture-end')||null;
  if(orderedResult) {assert.equal(orderedResult.status,'fixture-end',JSON.stringify(orderedResult));assert(orderedResult.coverage.preDrawBoundaries>0);}
  if(observation) {
    assert.equal(observation.status,'fixture-end',JSON.stringify(observation));
    assert.equal(observation.pendingAtStop,0);
    const entries=observation.records.filter(r=>r.type==='native-entry'),returns=observation.records.filter(r=>r.type==='native-return');
    assert.equal(entries.length,10);assert.equal(returns.length,10);
    assert.equal(entries.filter(r=>r.name==='FlushItem').length,1);
    const creates=returns.filter(r=>r.name==='Create');assert.equal(creates.length,3);
    const gets=returns.filter(r=>r.name==='Get');assert.equal(gets.length,2);assert.equal(gets[0].item.address,item);assert.equal(gets[1].eax,0);assert.equal(gets[1].item,null);
    assert(creates.every(r=>r.item.address===item&&r.eax===payload&&r.allocationLifetime==='unknown'));
    assert.deepEqual(creates.map(r=>r.item.id.slice(0,4)),[le(0x11223344),le(0xabcdef01),le(0x98765432)]);
    const unlocks=returns.filter(r=>r.name==='Unlock');assert.deepEqual(unlocks.map(r=>r.item.cost),[0x1000040,0x40,0x40]);
    assert(observation.coverage.duplicateBoundaries>0);
    assert.match(observation.gaps.eviction,/inline/);
  }
  let trapped=false;try{await slice();}catch(_){trapped=true;}assert(trapped);
  const afterTrap={hash:H(bytes),state:state()};
  // Failure controls read actual owning exports; fixture mutations happen only
  // after recording the parity arm. They are not native event execution proof.
  const negatives={};
  const start=options=>attach(owner,{workerSlot:0,coreSha256:CORE_SHA256,...options});
  assert.throws(()=>attach(owner,{workerSlot:1,coreSha256:CORE_SHA256}),/identity/);
  assert.throws(()=>attach(owner,{workerSlot:0,coreSha256:'0'.repeat(64)}),/identity/);
  assert.throws(()=>start({limits:{records:257}}),/records/);
  let h=start({limits:{boundaries:1}});h.boundary();h.boundary();negatives.boundary=h.stop().status;assert.equal(negatives.boundary,'boundary-limit');
  let clock=0;h=start({now:()=>clock,limits:{milliseconds:1}});clock=1;h.boundary();negatives.time=h.stop().status;assert.equal(negatives.time,'time-limit');
  h=start();assert.throws(()=>start(),/already/);h.boundary();dv.setUint32(life+idx*stride+4,777,true);h.boundary();
  negatives.generation=h.stop().status;assert.equal(negatives.generation,'module-changed');
  e.set_eip(base+0x168a0);e.set_ecx(item);e.set_esp(stack);u32(stack,caller);
  const oldObserve=owner.observe;h=start();owner.observe();owner.observe();
  assert.equal(h.result.coverage.entries,1);assert.equal(h.result.coverage.duplicateBoundaries,1);
  h.stop('incomplete-control');assert.equal(h.result.pendingAtStop,1);assert.equal(owner.observe,oldObserve);
  h=start();h.boundary();e.set_eip(caller);e.set_esp(stack+8);h.boundary();negatives.stack=h.stop().status;assert.equal(negatives.stack,'unsupported-or-unobservable');
  e.set_eip(base+0x168a0);e.set_esp(stack);
  h=start({limits:{records:1}});h.boundary();e.set_eip(caller);e.set_esp(stack+4);h.boundary();negatives.records=h.stop().status;assert.equal(negatives.records,'record-limit');assert.equal(h.result.records.length,1);
  e.set_eip(base+0x168a0);e.set_esp(stack);u32(stack-4,caller);
  h=start({limits:{pending:1}});h.boundary();e.set_esp(stack-4);h.boundary();negatives.pending=h.stop().status;assert.equal(negatives.pending,'pending-limit');
  e.set_eip(base+0x168a0);e.set_esp(stack);put(base+0x168a0,[0x90]);
  h=start();h.boundary();negatives.signature=h.stop().status;assert.equal(negatives.signature,'unsupported-or-unobservable');
  const foreign={...owner.ex};h=start();owner.ex=foreign;h.boundary();owner.ex=e;negatives.instance=h.stop().status;assert.equal(negatives.instance,'unsupported-or-unobservable');
  h=start();e.set_current_thread_id(2);h.boundary();e.set_current_thread_id(1);negatives.thread=h.stop().status;assert.equal(negatives.thread,'unsupported-or-unobservable');
  h=start();dv.setUint32(life+idx*stride,0,true);h.boundary();dv.setUint32(life+idx*stride,2,true);negatives.absent=h.stop().status;assert.equal(negatives.absent,'unsupported-or-unobservable');
  put(base+0x168a0,[0x81]);e.set_esp(0);h=start();h.boundary();negatives.read=h.stop().status;assert.equal(negatives.read,'unsupported-or-unobservable');
  const previous=owner.observe;
  owner.observe=function(){return 17;};h=start();assert.equal(owner.observe(),17);h.stop();
  const failure=Error('original observe failure');owner.observe=function(){throw failure;};h=start();assert.throws(()=>owner.observe(),error=>error===failure);assert.equal(h.result.sequence,0);h.stop();owner.observe=previous;
  parentPort.postMessage({pass:true,mode:workerData.mode,base,trace,memoryHash:before,state:beforeState,afterTrap,observation,orderedResult,negatives,media:{path:media,sha256:CORE_SHA256},wasm:H(fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm')))});
}

if(!isMainThread) {
  const filename=path.join(ROOT,'lib/guest-worker.js'),Module=require('node:module'),entry=new Module(filename,module);
  entry.filename=filename;entry.paths=module.paths;
  entry._compile(fs.readFileSync(filename,'utf8')+'\n;globalThis.nativeFixtureAccess={get:()=>({e:instance.exports,memory}),setOwner:o=>{drawObserver=o;}};',filename);
  workerData.port.once('message',()=>physical().catch(error=>parentPort.postMessage({t:'fixtureFailure',error:error.stack})));
} else {
  async function one(observed,mode,relocated) {
    const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),{port1,port2}=new MessageChannel();
    const sigs=require('../lib/host-import-sigs.generated.json').sigs;
    const broker=require('../lib/guest-rpc').createMainBroker(memory,Object.fromEntries(Object.keys(sigs).map(n=>[n,()=>{
      if(!['log','log_i32','beep_process_begin','beep_thread_begin'].includes(n))throw Error('unexpected broker '+n);return 0;
    }])),sigs);
    const wasm=await WebAssembly.compile(fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm')));
    const w=new Worker(__filename,{workerData:{port:port2,observed,mode,relocated},transferList:[port2]});
    return new Promise((resolve,reject)=>{
      let seq=0;const commands=[];
      const finish=async(error,value)=>{clearTimeout(timer);await w.terminate();port1.close();error?reject(error):resolve(value);};
      const timer=setTimeout(()=>finish(Error('native transport timeout')),45000);
      w.on('error',error=>finish(error));
      w.on('message',m=>{
        if(m.t==='ready')port1.postMessage({t:'start'});
        else if(m.t==='rpc')broker.serveRpc(m.slot,m.waitEntry);
        else if(m.t==='call')broker.serveCall(m);
        else if(m.t==='calls')broker.serveCalls(m);
        else if(m.t==='fixtureSliceRequest') {const c={t:'slice',seq:++seq,steps:1};commands.push(c);w.postMessage(c);}
        else if(m.t==='sliceDone')port1.postMessage({t:'slice',message:m});
        else if(m.t==='fixtureFailure'||m.t==='error')finish(Error(JSON.stringify(m)));
        else if(m.pass)finish(null,{...m,commands});
      });
      w.postMessage({t:'init',seq:0,module:wasm,memory,sigs,slot:0,endpointIdentity:1});
    });
  }
  (async()=>{
    const results=[];
    for(const mode of ['block','instruction'])for(const relocated of [false,true]) {
      const control=await one(false,mode,relocated),observed=await one(true,mode,relocated);
      assert.deepEqual(observed.trace,control.trace);assert.equal(observed.memoryHash,control.memoryHash);
      assert.deepEqual(observed.state,control.state);assert.deepEqual(observed.afterTrap,control.afterTrap);
      assert.deepEqual(observed.commands,control.commands);
      results.push({control,observed});console.log('PASS original Core native calls, queued shipped Worker, whole-memory/state/return/trap parity',mode,observed.base.toString(16));
    }
    if(process.env.DEUSEX_NATIVE_RESULT)fs.writeFileSync(process.env.DEUSEX_NATIVE_RESULT,JSON.stringify({pass:true,fixtureOnly:true,results},null,2));
  })().catch(error=>{console.error(error);process.exitCode=1;});
}
