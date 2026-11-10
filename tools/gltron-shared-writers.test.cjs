'use strict';
// Shipped CPU and unchanged production Worker entry point. Pinned media is
// loaded as data; no startup, DllMain, guest instruction patches or game run.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {Worker}=require('node:worker_threads');
const api=require('./gltron-native-decode-ring.cjs'),RPC=require('../lib/guest-rpc');
const ROOT=path.resolve(__dirname,'..'),sigs=require('../lib/host-import-sigs.generated.json').sigs;
const bytes=fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm'));
const files=api.MEDIA.map(m=>fs.readFileSync(path.join(ROOT,m.path)));api.pinMedia(files);
const names=['eip','esp','ebp','eax','ebx','ecx','edx','esi','edi','flag_op','flag_a','flag_b','flag_res',
  'flag_sign_shift','yield_reason','fpu_top','fpu_sw','fpu_tags','sreg_ds','sreg_es','sreg_ss','sreg_cs','fs_base'];
const stops=[],watchdogs=[];
async function run(mode) {
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),workers=[],blocks=[];
  const broker=RPC.createMainBroker(memory,new Proxy({}, {get:(_,name)=>(...args)=>{
    if(!['log','log_i32','log_eip','log_block','beep_process_begin','beep_thread_begin','resolve_ordinal','debug_break'].includes(name))
      throw Error('unexpected import '+name);
    if(name==='log_block')blocks.push(args);
    return 0;
  }}),sigs);
  const guard={mode,armed:true,expired:false,cleared:false};watchdogs.push(guard);
  // Independent parent deadline is observable and armed before CPU/Worker init.
  console.log('watchdog armed '+mode);
  const deadline=setTimeout(()=>{guard.expired=true;for(const x of workers)x.worker.terminate();},60000);
  const module=await WebAssembly.compile(bytes);
  async function start(slot) {
    const worker=new Worker(path.join(ROOT,'lib/guest-worker.js')),pending=new Map();let sequence=0;
    const x={worker,slot,stopped:false};workers.push(x);broker.watchWriter(worker,slot);
    worker.on('message',m=>{
      if(m.t==='rpc')return broker.serveRpc(m.slot,m.waitEntry);
      if(m.t==='call')return broker.serveCall(m);
      if(m.t==='calls')return broker.serveCalls(m);
      if(m.t==='writerRegistered'){x.registration=m;return;}
      if(m.t==='error'){for(const p of pending.values())p.reject(Error(JSON.stringify(m)));pending.clear();return;}
      const id=m.t==='ready'?[...pending].find(([,p])=>p.type==='ready')?.[0]:m.seq;
      const p=pending.get(id);if(p&&p.type===m.t){pending.delete(id);p.resolve(m);}
    });
    const fail=e=>{for(const p of pending.values())p.reject(e);pending.clear();};
    worker.on('error',fail);worker.on('exit',code=>fail(Error('Worker exit '+code)));
    x.request=(type,msg)=>new Promise((resolve,reject)=>{
      const seq=++sequence;pending.set(seq,{resolve,reject,type});worker.postMessage({...msg,seq});
    });
    x.call=async(name,...args)=>{const r=await x.request('exportResult',{t:'callExport',name,args});assert(!r.missing,name);return r.value>>>0;};
    x.observe=async(action,options={})=>(await x.request('writerObservationResult',{t:'writerObservation',action,...options})).observation;
    x.callback=async action=>(await x.request('callbackObservationResult',{t:'callbackObservation',action})).observation;
    x.full=async()=>(await x.request('exportsRead',{t:'readExports',names:names.map(k=>'get_'+k)})).values;
    x.slice=async()=>{const r=await x.request('sliceDone',{t:'slice',steps:1});assert(!r.trapped,JSON.stringify(r));};
    x.stop=async()=>{
      if(x.stopped)return;x.stopped=true;
      const threadId=worker.threadId;broker.detachWriter(slot,worker);
      const exit=await worker.terminate();stops.push({mode,slot,threadId,exit,awaited:true});
    };
    await x.request('ready',{t:'init',module,memory,sigs,slot,endpointIdentity:1600+slot,forwardGuestLogs:true});
    assert.equal(x.registration.transport,worker.threadId,'actual owning Node Worker verified');
    assert.equal(x.registration.cpu,await x.call('writer_cpu_id'));
    return x;
  }
  try {
    const main=await start(0);
    new Uint8Array(memory.buffer).set(files[0],await main.call('get_staging'));
    assert(await main.call('load_pe',files[0].length));await main.call('set_api_log',0);
    new Uint8Array(memory.buffer).set(files[1],await main.call('get_staging'));await main.call('load_dll',files[1].length,0x765000);
    const object=await main.call('guest_alloc',128),stack=await main.call('guest_alloc',8192)+4096;
    await main.call('guest_write32',object+0x30,0);
    const other=await start(1);
    const init={t:'initGuestThread',tid:1,imageBase:await main.call('get_image_base'),
      codeStart:await main.call('get_code_start'),codeEnd:await main.call('get_code_end'),
      thunkBase:await main.call('get_thunk_base'),thunkEnd:await main.call('get_thunk_end'),
      numThunks:await main.call('get_num_thunks'),startAddr:0x413258,param:0,stackSize:8192,loadedDlls:[]};
    const thread=await other.request('threadReady',init);assert.equal(thread.eip,0x413258);
    await main.call('set_eip',0x413258);await main.call('set_esp',stack);await main.call('set_ecx',object);
    await main.call('set_instruction_watchpoint',object+0x70);
    await main.call('set_trace_esp',1,0,0);
    // Original DLL RET 20, as in the published callback-transition test.
    const dll=files[1],pe=dll.readUInt32LE(60),sections=pe+24+dll.readUInt16LE(pe+20);let callback;
    for(let i=0;i<dll.readUInt16LE(pe+6)&&!callback;i++){
      const s=sections+i*40;if(!(dll.readUInt32LE(s+36)&0x20000000))continue;
      const raw=dll.readUInt32LE(s+20),n=dll.readUInt32LE(s+16),rva=dll.readUInt32LE(s+12);
      const j=dll.subarray(raw,raw+n).indexOf(Buffer.from([0xc2,20,0]));if(j>=0)callback=0x765000+rva+j;
    }
    assert(callback);
    let direct;const capacityCPUs=[];
    if(mode==='unenrolled-cpu') {
      const ctx={getMemory:()=>memory.buffer},imports=require('../lib/host-imports').createHostImports(ctx);
      imports.host.memory=memory;direct=(await WebAssembly.instantiate(module,imports)).exports;ctx.exports=direct;
      direct.init_thread(2,init.imageBase,init.codeStart,init.codeEnd,init.thunkBase,init.thunkEnd,init.numThunks);
    }
    if(mode==='registry-overflow') {
      const ctx={getMemory:()=>memory.buffer},imports=require('../lib/host-imports').createHostImports(ctx);imports.host.memory=memory;
      for(let i=0;i<63;i++) {
        const e=(await WebAssembly.instantiate(module,imports)).exports;capacityCPUs.push(e);
        const id=e.writer_cpu_register(17,9900+i);
        assert.equal(id,i===62?0:i+3);
      }
      direct=capacityCPUs.at(-1);ctx.exports=direct;
      direct.init_thread(2,init.imageBase,init.codeStart,init.codeEnd,init.thunkBase,init.thunkEnd,init.numThunks);
      direct.guest_write32(object+0x30,11);assert.equal(await main.call('guest_read32',object+0x30),11);
      direct.guest_write32(object+0x30,0);assert.equal(await main.call('guest_read32',object+0x30),0);
    }
    const ranges=[object,object+128,stack-4,stack],v=RPC.writerSessionView(memory),trace=[];
    let armed;
    if(mode==='off') {
      // Match instruction granularity and cache clears with both store feeds off.
      await main.call('set_instruction_watchpoint',object+0x70);
      await other.call('set_instruction_watchpoint',object+0x70);
      assert.equal(await main.call('native_store_get',0),0);assert.equal(await other.call('native_store_get',0),0);
    } else {
      armed=await main.observe('start',{ranges,limit:mode==='overflow'?1:64});
      assert(!armed.ready);
      if(mode==='registry-overflow')assert.match(armed.invalid,/registry overflow/);
      else assert(!armed.invalid,JSON.stringify(armed));
      if(!['unenrolled-worker','registry-overflow'].includes(mode))await other.observe('enroll');
      if(!['unenrolled-worker','registry-overflow'].includes(mode)){
        armed=await main.observe('commit');assert(armed.ready);assert(!armed.invalid,JSON.stringify(armed));
      }
    }
    const full=async()=>trace.push([await main.full(),await other.full()]);
    if(['off','on'].includes(mode)) {
      await main.slice();await full(); // Actual original PUSH EBP, through gs32.
      const receipt=async()=>{const a=[];for(let i=0;i<21;i++)a.push(await main.call('native_store_get',i));return a;};
      const before=await receipt();
      await other.call('guest_write32',object+0x30,11);await full();
      assert.equal(await main.call('guest_read32',object+0x30),11);
      assert.deepEqual(await receipt(),before,'legacy producer receipt remains instance-local');
      let first=mode==='on'?await main.observe('status'):null;
      if(first){assert.equal(first.records.length,2);assert.equal(first.records[1].value,11);}
      await other.call('guest_write32',object+0x30,0);await full();
      assert.equal(await main.call('guest_read32',object+0x30),0);
      assert.deepEqual(await receipt(),before);
      await main.call('guest_write32',object+0x34,9);await full();
      // Two distinct issuing CPUs contend; sequence is issued by WAT under
      // the shared command lock, never assigned to incoming JS logs.
      await Promise.all([main.call('guest_write32',object+0x34,9),other.call('guest_write32',object+0x30,0)]);await full();
      if(mode==='on')await main.callback('start');
      assert.equal(await main.call('fire_wave_out_callback_bound',17,19,callback,456),1);await full();
      await main.slice();await full();await main.slice();await full();
      const cb=mode==='on'?await main.callback('status'):null;
      if(cb){assert(!cb.invalid,JSON.stringify(cb));assert.deepEqual(cb.records.map(r=>r.kind),['suspend','admit','ret','restore']);}
      if(mode==='on')await main.callback('stop');
      const observation=mode==='on'?await main.observe('status'):null;
      if(observation){
        assert(!observation.invalid,JSON.stringify(observation));assert.equal(observation.sequence,6);
        assert.deepEqual(observation.records.map(r=>r.sequence),[1,2,3,4,5,6]);
        assert.deepEqual(observation.records[0],{session:1,sequence:1,cpu:1,slot:0,pc:0x413258,address:stack-4,width:4,value:0,identity:1600});
        assert.deepEqual(observation.records.slice(1,4).map(r=>[r.cpu,r.slot,r.address,r.width,r.value]),
          [[2,1,object+0x30,4,11],[2,1,object+0x30,4,0],[1,0,object+0x34,4,9]]);
        assert.equal(observation.records[1].identity,1601);
      }
      let ownershipChange;
      if(mode==='on') {
        await main.observe('stop');
        await other.observe('start',{ranges,limit:64});await main.observe('enroll');
        ownershipChange=await other.observe('commit');assert(!ownershipChange.invalid);assert(ownershipChange.ready);
        assert.equal(ownershipChange.session,observation.session,'distinct owning CPUs may have equal local arm serials');
        assert.notEqual(ownershipChange.owner,observation.owner,'actual CPU identity distinguishes sessions');
      } else {
        await main.call('set_instruction_watchpoint',object+0x70);
        await other.call('set_instruction_watchpoint',object+0x70);await main.call('set_instruction_watchpoint',object+0x70);
      }
      await main.call('guest_write32',object+0x34,9);await other.call('guest_write32',object+0x30,0);await full();
      if(mode==='on') {
        ownershipChange=await other.observe('status');assert(!ownershipChange.invalid);
        assert.deepEqual(ownershipChange.records.map(r=>[r.sequence,r.cpu]),[[1,1],[2,2]]);
        await other.observe('stop');await main.observe('leave');
      } else {
        await other.call('set_instruction_watchpoint',0);await main.call('set_instruction_watchpoint',object+0x70);
        assert.equal(await main.call('native_store_get',0),0);assert.equal(await other.call('native_store_get',0),0);
      }
      const cpu=[await main.full(),await other.full()];
      await main.stop();await other.stop();
      return {mode,trace,cpu,memoryHash:api.hash(new Uint8Array(memory.buffer)),observation,ownershipChange,callback:cb,object,registrations:workers.map(w=>w.registration)};
    }
    if(mode!=='unenrolled-worker')await main.callback('start');
    if(mode==='unenrolled-worker')await other.call('guest_write32',object+0x30,11);
    if(mode==='unenrolled-cpu')direct.guest_write32(object+0x30,11);
    if(mode==='detach')await other.stop();
    if(mode==='retiring-writer')broker.detachWriter(1,other.worker);
    if(mode==='abrupt-detach') {
      const threadId=other.worker.threadId,exit=await other.worker.terminate();other.stopped=true;
      stops.push({mode,slot:1,threadId,exit,awaited:true,abrupt:true});
    }
    if(mode==='late-worker')await start(17); // Transport slots are not CPU partition/lifetime identities.
    if(mode==='unsupported')await main.call('set_eax',123);
    if(mode==='unsupported-cpu'){
      // Original refill's seventh instruction (CMP imm) is outside admission.
      for(let i=0;i<7;i++)await main.slice();
      assert.equal(blocks.length,6,'unsupported opcode invalidates before its block event');
    }
    if(mode==='loss'||mode==='overflow') {
      await other.call('guest_write32',object+0x30,11);
      if(mode==='overflow')await other.call('guest_write32',object+0x30,0);
      else Atomics.store(v,RPC.WRITER.RECORD,0); // Simulated missing actual CPU record.
    }
    const observation=await main.observe('status');assert(observation.invalid,mode);assert.deepEqual(observation.records,[]);
    assert.match(observation.invalid,{'loss':/loss/,'overflow':/overflow/,'detach':/detach/,
      'unenrolled-worker':/unenrolled/,'unenrolled-cpu':/unenrolled/,'late-worker':/unenrolled/,'abrupt-detach':/detach/,
      'retiring-writer':/detach/,
      'unsupported':/unsupported/,'unsupported-cpu':/unsupported/,'registry-overflow':/registry overflow/}[mode]);
    if(mode==='unenrolled-worker')await main.callback('start');
    // No callback validator events may follow shared writer invalidation.
    assert.equal(await main.call('fire_wave_out_callback_bound',17,19,callback,456),1);
    const blockCount=blocks.length;await main.slice();await main.slice();
    assert.equal(blocks.length,blockCount,'no more block events after invalidation');
    const cb=await main.callback('status');assert(cb.invalid);assert.deepEqual(cb.records,[]);
    await main.observe('stop');if(!other.stopped)await other.observe('leave');
    if(mode==='registry-overflow'){
      assert.match((await main.observe('start',{ranges})).invalid,/registry overflow/,'registry loss survives stop/rearm');
      await main.observe('stop');
    }
    if(mode==='retiring-writer'){
      await main.observe('start',{ranges});
      const retry=await main.observe('commit');assert.match(retry.invalid,/unenrolled/);
      assert(retry.members.some(m=>m.cpu===2),'retirement request cannot erase a still live CPU');
      await main.observe('stop');
    }
    return {mode,observation,callback:cb};
  } finally {
    for(const w of workers)if(!w.stopped)await w.stop();
    clearTimeout(deadline);guard.cleared=true;assert(!guard.expired);console.log('watchdog cleared '+mode);
  }
}
(async()=>{
  const off=await run('off'),on=await run('on');
  assert.deepEqual(on.trace,off.trace,'every queued architectural CPU state in both real CPUs');
  assert.deepEqual(on.cpu,off.cpu,'complete final architectural CPU parity');
  assert.equal(on.memoryHash,off.memoryHash,'entire shared memory parity, after normal observation cleanup');
  const negatives=[];
  for(const mode of ['unenrolled-worker','unenrolled-cpu','late-worker','loss','detach','abrupt-detach','retiring-writer','overflow','unsupported','unsupported-cpu','registry-overflow'])negatives.push(await run(mode));
  const result={pass:true,scope:'shared writer enrollment; authenticated object lifetime OPEN',wasm:{sha256:api.hash(bytes),size:bytes.length},
    media:api.MEDIA,on,off,negatives,stops,watchdogs,box:{id:null,state:'NOT_CREATED',expiry:null,stopReceipt:null}};
  if(process.env.GLTRON_WRITERS_RESULT)fs.writeFileSync(process.env.GLTRON_WRITERS_RESULT,JSON.stringify(result,null,2)+'\n');
  console.log('PASS real two-Worker write11/restore0, CPU-issued ordering, owner changes, callback transitions, eleven invalidations, complete CPU/memory parity');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
