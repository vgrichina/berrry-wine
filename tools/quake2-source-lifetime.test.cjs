'use strict';
// Reuse the retained full loader driver's verified media/module inputs. Only
// cvar and file-read hooks remain fixture boundaries. The allocator/release
// bodies and resolved Win32 heap handlers execute without register edits.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {Worker}=require('node:worker_threads');
const {hash}=require('./quake2-owning-load-witness.cjs');
const ROOT=path.resolve(__dirname,'..');
const driver='scratch/runs/20261108-quake2-native-cmodel-binding-2205/native-load-use.cjs';
const original=fs.readFileSync(path.join(ROOT,driver),'utf8');
assert.equal(hash(original),'e6fde32e696e4b544eb188fef2380372f5884a3f68a07754a7e6fe7e0446c186');
const Module=require('node:module'),inputModule=new Module(path.join(ROOT,driver),module);
inputModule.filename=path.join(ROOT,driver);inputModule.paths=module.paths;
inputModule._compile(original.slice(0,original.indexOf('const memory='))+'\nmodule.exports={exe,bsp};',inputModule.filename);
const {exe,bsp}=inputModule.exports;
const cpu=fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm'));
const sigs=require('../lib/host-import-sigs.generated.json').sigs;
const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n>>>0);return [...b];};
// New controls use original FS_FreeFile, Z_Free, Z_TagMalloc, CRT malloc/free
// and the shipped Win32 heap handlers. Only cvar/file reads are fixture I/O.
async function fixture(enabled,scenario) {
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),wa=a=>a-0x400000+0x12000;
  const put=(a,v)=>dv.setUint32(wa(a),v>>>0,true),get=a=>dv.getUint32(wa(a),true);
  const copy=(a,b)=>mem.set(b,wa(a));
  const sp=0x7408000,input=0xc00000,name=0x1000000,out=name+0x100,cv=name+0x200;
  const sourceSlot=name+0x300,recycled=sourceSlot+4,caller=0x1004000,stop=0x1100000;
  const w=new Worker(path.join(ROOT,'lib/guest-worker.js'));
  let seq=0,pending,failure;
  const lifecycle={deadlineArmedBeforeInit:true};
  const deadline=setTimeout(()=>{failure=Error('native lifetime Worker deadline');pending?.reject(failure);void w.terminate();},60000);
  const broker=require('../lib/guest-rpc').createMainBroker(memory,new Proxy({}, {get:(_,name)=>()=>{if(String(name).startsWith('beep_'))return 0;throw Error('unexpected fixture broker import '+String(name));}}),sigs);
  w.on('message',m=>{
    if(m.t==='rpc')return broker.serveRpc(m.slot,m.waitEntry);
    if(m.t==='call')return broker.serveCall(m);
    if(m.t==='calls')return broker.serveCalls(m);
    if(pending&&(m.seq===pending.seq||m.t==='ready')){const p=pending;pending=null;m.t==='error'?p.reject(Error(JSON.stringify(m))):p.resolve(m);}
  });
  w.on('error',e=>{failure=e;pending?.reject(e);});
  const command=m=>new Promise((resolve,reject)=>{if(failure)return reject(failure);assert(!pending);pending={resolve,reject,seq:++seq};w.postMessage({...m,seq});});
  const exported=(name,...args)=>command({t:'callExport',name,args});
  const snapshot=async()=>(await command({t:'quake2LoadObservation'})).observation;
  const state=async(final=false)=>(await command({t:'readExports',names:['get_eip','get_esp','get_eax','get_ebx','get_ecx','get_edx','get_esi','get_edi','get_ebp','get_yield_reason',...(final?['get_flag_op','get_flag_a','get_flag_b','get_flag_res']:[])]})).values;
  let result;
  try {
    await command({t:'init',module:await WebAssembly.compile(cpu),memory,sigs,slot:0,endpointIdentity:2335,quake2LoadObservation:enabled});
    await exported('init_thread',0,0x400000,caller,caller+0x1000,0,0,0,0);
    const staging=(await exported('get_staging')).value;mem.set(exe.buf,staging);
    await exported('load_pe',exe.buf.length);
    copy(input,bsp);copy(name,Buffer.from('maps/demo1.bsp\0'));
    copy(stop,[0xeb,0xfe]);copy(0x4137a0,[0x0f,0x0b]);
    copy(0x416310,[0xb8,...u32(cv),0xc3]);
    copy(0x4161b0,[0x6a,0,0xd9,0x04,0x24,0x83,0xc4,4,0xc3]);
    // Fixture CRT startup state, not executed original process startup. Large
    // allocation bypasses small-block heap; original CRT free scans empty list.
    put(0x450204,0);put(0x44e1e0,0x44e1e0);
    put(0x4e1b60,0x4e1b60);put(0x4e1b64,0x4e1b60);
    let code=[],at=caller;
    const emit=(...v)=>code.push(...v);
    const call=target=>emit(0xe8,...u32(target-(at+code.length+5)));
    // Create a real heap through the original resolved HeapCreate IAT.
    emit(0x6a,0,0x68,...u32(4096),0x6a,0,0xff,0x15,...u32(0x4420e8));
    emit(0xa3,...u32(0xb100cc));
    emit(0x68,...u32(cv+0x20),0xff,0x15,...u32(0x442138));
    emit(0xc7,0x05,...u32(0x44dbb0+9*4),...u32(cv+0x20));
    emit(0x68,...u32(bsp.length));call(0x4149e0);emit(0x83,0xc4,4,0xa3,...u32(sourceSlot));
    call(0x423350);
    emit(0x68,...u32(out),0x6a,0,0x68,...u32(name));call(0x4117b0);emit(0x83,0xc4,12);
    if(scenario.startsWith('reuse')) {
      emit(0x68,...u32(bsp.length));call(0x4149e0);emit(0x83,0xc4,4,0xa3,...u32(recycled));
      if(scenario==='reuseSame')emit(0x8b,0xf8,0xbe,...u32(input),0xb9,...u32(bsp.length),0xf3,0xa4);
    }
    emit(0xe9,...u32(stop-(at+code.length+5)));copy(at,code);
    // Fixture file I/O copies into the genuinely allocated source. Allocation
    // runs before loader entry, so no host import gap can stale acquisition.
    code=[];at=0x1005000;
    emit(0x56,0x57,0xa1,...u32(sourceSlot),0x8b,0x54,0x24,16,0x89,0x02);
    emit(0x8b,0xf8,0xbe,...u32(input),0xb9,...u32(bsp.length),0xf3,0xa4);
    emit(0xb8,...u32(bsp.length),0x5f,0x5e,0xc3);copy(at,code);
    copy(0x416e70,[0xe9,...u32(at-0x416e70-5)]);
    for(const [pc,size] of [[0x416ef0,14],[0x414890,0x55],[0x414950,0x8b],
      [0x4149e0,16],[0x432c10,0x68],[0x432c80,0x65],[0x432cf0,0x55],
      [0x438c70,0x59],[0x434d30,0x76],[0x434db0,0x16]]) {
      assert.equal(hash(mem.subarray(wa(pc),wa(pc)+size)),hash(exe.buf.subarray(exe.va2off(pc),exe.va2off(pc)+size)),'original native allocator/free body '+pc.toString(16));
    }
    if(scenario==='badHeader') {
      // Corrupt the allocated header after file copy, before genuine Z_Free.
      const tail=[0x8b,0x15,...u32(sourceSlot),0x66,0xc7,0x42,0xf8,0,0,0xb8,...u32(bsp.length),0x5f,0x5e,0xc3];
      copy(at+code.length-8,tail);
    }
    await exported('set_esp',sp);await exported('set_eip',caller);put(sp,stop);
    await exported('set_trace_esp',1,0x4117b0,stop-1);
    let current,iterations=0,runError=null;
    do {
      try {await exported('run',scenario==='resetPending'?1000:100000);}catch(error){if(scenario!=='badHeader')throw error;runError=error.message;break;}
      current=await state();assert(++iterations<10000,JSON.stringify(current));
      if(scenario==='resetPending' && current.get_eip>=0x419a30 && current.get_eip<0x41a2a0)break;
    }while(current.get_eip!==stop);
    const before=await snapshot();
    if(scenario==='reset' || scenario==='resetPending')await exported('init_thread',0,0x400000,caller,caller+0x1000,0,0,0,0);
    const observation=await snapshot(),source=get(sourceSlot),reuse=get(recycled);
    const sourceW=(await exported('guest_to_wasm',source)).value>>>0;
    assert(sourceW!==0xf0);
    assert(source && source!==input,'actual allocated source');
    if(scenario==='badHeader')assert(runError,'genuine native header error must trap');
    else if(scenario!=='resetPending') {
      assert.equal(get(0x4e1b50),scenario.startsWith('reuse')?1:0);
      assert.equal(get(0x4e1b78),scenario.startsWith('reuse')?bsp.length+16:0);
      assert.equal(get(out),0xbfd75753);assert.equal(get(0xa23f8c),35);
      const bytes=mem,rd=get,count=get(0xa23f8c),mo=bsp.readUInt32LE(8+13*8);
      const begin=original.indexOf('for(let i=0;i<count;i++)'),end=original.indexOf('const pins=');
      eval(original.slice(begin,end));
      if(scenario.startsWith('reuse')) {assert.equal(reuse,source,'actual native allocation must recycle source');if(scenario==='reuseSame')assert.equal(hash(mem.subarray(sourceW,sourceW+bsp.length)),hash(bsp));else assert.notEqual(hash(mem.subarray(sourceW,sourceW+bsp.length)),hash(bsp));}
    }
    if(enabled) {
      const acquisition=observation.records.findIndex(r=>r.kind==='ACQUIRED_SOURCE');
      assert(acquisition>=0,JSON.stringify(observation));assert.equal(observation.records[acquisition].sha256,hash(bsp));
      const lifetime=observation.sourceLifetime;
      assert.equal(lifetime.currentIdentity,'UNKNOWN');assert.equal(lifetime.laterBytesCertified,false);
      assert.equal(lifetime.sources[0].state,'REVOKED');
      if(scenario==='resetPending') {
        assert.equal(before.sourceLifetime.sources[0].state,'ACQUIRED_POINT');
        assert.equal(lifetime.sources[0].revokedAt,null);
        assert.equal(lifetime.events[0].reason,'export: init_thread');
      } else {
        assert.equal(lifetime.sources[0].revokedAt,0x416ef0);
        assert.equal(lifetime.events[0].reason,'native release entered');
      }
      assert.equal(observation.coverage.allWriters,'UNKNOWN');assert.equal(observation.exactIdentity,'UNKNOWN');
      if(scenario==='reset' || scenario==='resetPending')assert.equal(observation.validPointObservations,false);
    }else assert.equal(observation,null);
    const sourceMemoryHash=hash(mem.subarray(sourceW-16,sourceW+bsp.length));
    result={scenario,sourceMemoryHash,observation,before,source,reuse,runError,state:await state(true),guestHash:hash(mem.subarray(0x12000,0x8000000)),iterations,lifecycle};return result;
  } finally {clearTimeout(deadline);lifecycle.deadlineCleared=true;lifecycle.terminationCode=await w.terminate();lifecycle.terminationAwaited=true;lifecycle.threadIdAfter=w.threadId;}
}
(async()=>{
  const results=[];
  for(const scenario of (process.argv.slice(2).length?process.argv.slice(2):['free','reuse','reuseSame','reset','resetPending','badHeader'])) {
    const off=await fixture(false,scenario),on=await fixture(true,scenario);
    assert.deepEqual(on.state,off.state);assert.equal(on.guestHash,off.guestHash);assert.equal(on.sourceMemoryHash,off.sourceMemoryHash);assert.equal(on.source,off.source);assert.equal(on.reuse,off.reuse);assert.equal(!!on.runError,!!off.runError);
    results.push({scenario,off,on});
  }
  console.log(JSON.stringify({pass:true,driver:{path:driver,sha256:hash(original)},cpu:{path:'build/wine-assembly.wasm',sha256:hash(cpu)},results}));
})().catch(e=>{console.error(e);process.exitCode=1;});
