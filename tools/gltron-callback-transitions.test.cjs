'use strict';
// Shipped CPU, unmodified production Worker, pinned media, no startup/DllMain,
// no guest instruction writes. Fixtures use public queued exports and data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {Worker}=require('node:worker_threads');
const api=require('./gltron-native-decode-ring.cjs');
const ROOT=path.resolve(__dirname,'..'),sigs=require('../lib/host-import-sigs.generated.json').sigs;
const files=api.MEDIA.map(m=>fs.readFileSync(path.join(ROOT,m.path)));
api.pinMedia(files);
const bytes=fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm'));
const workerStops=[];
const names=['eip','esp','ebp','eax','ebx','ecx','edx','esi','edi','flag_op','flag_a','flag_b','flag_res',
  'flag_sign_shift','yield_reason','fpu_top','fpu_sw','fpu_tags'];
async function run(observed,limit=64) {
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const w=new Worker(path.join(ROOT,'lib/guest-worker.js')),pending=new Map();
  let seq=0,stopped=false;
  // Independent parent watchdog armed before initialization; termination awaited.
  const deadline=setTimeout(()=>{w.terminate();for(const p of pending.values())p.reject(Error('independent 60s deadline'));},60000);
  const broker=require('../lib/guest-rpc').createMainBroker(memory,new Proxy({}, {get:(_,n)=>()=>{
    if(!['log','log_i32','log_eip','log_block','beep_process_begin','beep_thread_begin','resolve_ordinal'].includes(n))
      throw Error('unexpected fixture import '+n);
    return 0;
  }}),sigs);
  w.on('message',m=>{
    if(m.t==='rpc')return broker.serveRpc(m.slot,m.waitEntry);
    if(m.t==='call')return broker.serveCall(m);
    if(m.t==='calls')return broker.serveCalls(m);
    if(m.t==='error'){for(const p of pending.values())p.reject(Error(JSON.stringify(m)));pending.clear();return;}
    const id=m.t==='ready'?[...pending].find(([,p])=>p.type==='ready')?.[0]:m.seq;
    const p=pending.get(id);if(p&&p.type===m.t){pending.delete(id);p.resolve(m);}
  });
  w.on('error',e=>{for(const p of pending.values())p.reject(e);pending.clear();});
  const request=(type,msg)=>new Promise((resolve,reject)=>{
    const id=++seq;pending.set(id,{resolve,reject,type});w.postMessage({...msg,seq:id});
  });
  const call=async(name,...args)=>{const r=await request('exportResult',{t:'callExport',name,args});assert(!r.missing,name);return r.value>>>0;};
  const observe=async action=>(await request('callbackObservationResult',{t:'callbackObservation',action,limit})).observation;
  const full=async()=>(await request('exportsRead',{t:'readExports',names:names.map(k=>'get_'+k)})).values;
  const cpu=async()=>{
    const r=await full(),s=Object.fromEntries(['eip','esp','ebp','eax','ecx','edx'].map(k=>[k==='eip'?'pc':k,r['get_'+k]]));
    s.saved=await call('guest_read32',s.esp);return s;
  };
  const slice=async()=>{const r=await request('sliceDone',{t:'slice',steps:1});assert(!r.trapped,JSON.stringify(r));return r.blocks;};
  try {
    await request('ready',{t:'init',module:await WebAssembly.compile(bytes),memory,sigs,slot:0,endpointIdentity:1520});
    new Uint8Array(memory.buffer).set(files[0],await call('get_staging'));assert(await call('load_pe',files[0].length));
    await call('set_api_log',0);
    new Uint8Array(memory.buffer).set(files[1],await call('get_staging'));await call('load_dll',files[1].length,0x765000);
    const object=await call('guest_alloc',128),stack=(await call('guest_alloc',8192))+4096;
    const dll=files[1],pe=dll.readUInt32LE(60),sections=pe+24+dll.readUInt16LE(pe+20);
    let callback;
    for(let i=0;i<dll.readUInt16LE(pe+6)&&!callback;i++){
      const s=sections+i*40;if(!(dll.readUInt32LE(s+36)&0x20000000))continue;
      const raw=dll.readUInt32LE(s+20),n=dll.readUInt32LE(s+16),rva=dll.readUInt32LE(s+12);
      const j=dll.subarray(raw,raw+n).indexOf(Buffer.from([0xc2,20,0]));if(j>=0)callback=0x765000+rva+j;
    }
    assert(callback);assert.equal((await call('guest_read32',callback))&0xffffff,0x0014c2);
    const ring={sample:object+64,threshold:4,capacity:16,read:0,write:0};
    for(const [k,o]of [['sample',0x20],['threshold',0x24],['capacity',0x2c],['read',0x30],['write',0x34]])
      await call('guest_write32',object+o,ring[k]);
    await call('set_eip',0x413258);await call('set_esp',stack);await call('set_ecx',object);
    await call('set_instruction_watchpoint',object+0x70);
    const mappings=[];
    for(const [a,n]of [[0x413258,0x186],[0x423f22,6],[0x766b6b,0xce],[0x76992a,0x56]])
      mappings.push({a,n,w:await call('guest_to_wasm',a)});
    const verify=api.loadedPins(files,0x765000,(a,n)=>{
      const m=mappings.find(m=>a===m.a&&n===m.n);assert(m);return Buffer.from(new Uint8Array(memory.buffer,m.w,n));
    });
    const owner={},epoch={},lifetime={};
    const armed=observed?await observe('start'):null;
    const binding=armed?{session:armed.session,endpointIdentity:1520,slot:0,root:armed.root}:null;
    const make=()=>api.createValidator({owner,epoch,lifetime,verify,callbackSession:binding});
    const v=observed?make():null,trace=[],events=[];
    const b=await cpu();await slice();const a=await cpu();trace.push(await full());
    const first={owner,epoch,lifetime,object,ring,ringAfter:ring,sequence:1,missed:0,granularity:'instruction',
      before:b,after:a,opcode:'55',callbackSequence:0};
    if(v)assert.equal(v.step(first).status,'running');events.push(first);
    const rounds=[];
    for(let i=0;i<2;i++) {
      assert.equal(await call('fire_wave_out_callback_bound',17,19,callback,456),1);trace.push(await full());
      const admission=observed?await observe('status'):null;
      // Real nested asynchronous admission must be rejected, with no new event.
      assert.equal(await call('fire_wave_out_callback_bound',17,19,callback,456),0);
      if(observed)assert.deepEqual(await observe('status'),admission);
      await slice();trace.push(await full());const returned=observed?await observe('status'):null;
      await slice();trace.push(await full());const restored=observed?await observe('status'):null;
      assert.deepEqual(await cpu(),a,'interrupted refill restored exactly');
      if(observed&&limit===64){
        assert.deepEqual(restored.records.slice(i*4).map(r=>r.kind),['suspend','admit','ret','restore']);
        for(const r of restored.records.slice(i*4))assert.equal(v.transition(r,restored).status,'running');
      }
      rounds.push({admission,returned,restored});
    }
    const nextBefore=await cpu();await slice();const nextAfter=await cpu();trace.push(await full());
    const observation=observed?await observe('status'):null;
    const second={...first,sequence:2,before:nextBefore,after:nextAfter,opcode:'89',callbackSequence:8};
    events.push(second);
    const final={cpu:await full(),memoryHash:api.hash(new Uint8Array(memory.buffer))};
    const negatives={};
    let result;
    if(observed&&limit===64){
      assert.equal(v.step(second).status,'running');result=v.finish(observation);assert.notEqual(result.status,'INVALID');
      const records=observation.records;
      const reject=(label,alter,final=observation)=>{
        const x=make();x.step(first);
        for(const r of alter(structuredClone(records)))x.transition(r,final);
        x.step(second);const out=x.finish(final);assert.equal(out.status,'INVALID',label);assert.equal(out.classification,'UNKNOWN');
        negatives[label]=out.error;
      };
      reject('missing-admission',r=>r.filter((_,i)=>i!==1));
      reject('missing-ret',r=>r.filter((_,i)=>i!==2));
      reject('missing-restoration',r=>r.filter((_,i)=>i!==3));
      reject('reordered',r=>{[r[1],r[2]]=[r[2],r[1]];return r;});
      reject('overflow',r=>r,{...observation,invalid:'CPU transition overflow'});
      reject('session',r=>{r[0].session++;return r;});
      reject('context',r=>{r[2].context[0]++;return r;});
      reject('root',r=>{r[2].root[0]++;return r;});
      reject('depth',r=>{r[2].depth++;return r;});
      reject('restore-cpu',r=>{r[3].cpu.esp++;return r;});
      reject('all-events-omitted',()=>[]);
      reject('reordered-renumbered',r=>{[r[1],r[2]]=[r[2],r[1]];return r.map((x,i)=>({...x,sequence:i+1}));});
      const incomplete=make();incomplete.step(first);for(const r of records.slice(0,3))incomplete.transition(r,observation);
      assert.equal(incomplete.finish({...observation,sequence:3}).status,'INVALID');
      negatives['incomplete-at-bound']='callback restoration missing at bound';
      for(const [label,final]of [['missing-final-snapshot',undefined],['final-overflow',{...observation,invalid:'overflow'}],
        ['final-endpoint',{...observation,endpointIdentity:1521}]]){
        const x=make();x.step(first);for(const r of records)x.transition(r,observation);
        assert.equal(x.finish(final).status,'INVALID',label);negatives[label]=x.finish(final).error;
      }
      await observe('stop');
      const fresh=await observe('start');assert.equal(fresh.session,armed.session+1);assert.equal(fresh.sequence,0);
      await call('set_eax',123);assert.match((await observe('status')).invalid,/unsupported command/);
      await observe('stop');
    } else if(observed)assert.match(observation.invalid,/overflow/);
    return {trace,final,rounds,result,negatives,callback,object,events:events.map(e=>({...e,owner:undefined,epoch:undefined,lifetime:undefined})),observation};
  } finally {
    const threadId=w.threadId;
    const exitCode=await w.terminate();stopped=true;clearTimeout(deadline);
    workerStops.push({threadId,exitCode,terminated:true,awaited:true,deadlineCleared:true});
    assert(stopped);console.log('Worker stopped and awaited exit='+exitCode);
  }
}
async function cpuOverflow(observed) {
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const ctx={getMemory:()=>memory.buffer},imports=require('../lib/host-imports').createHostImports(ctx);
  Object.assign(imports.host,{memory,log:()=>{},log_i32:()=>{}});
  const e=(await WebAssembly.instantiate(bytes,imports)).instance.exports;ctx.exports=e;
  new Uint8Array(memory.buffer).set(files[0],e.get_staging());assert(e.load_pe(files[0].length));e.set_api_log(0);
  new Uint8Array(memory.buffer).set(files[1],e.get_staging());e.load_dll(files[1].length,0x765000);
  const stack=e.guest_alloc(8192)+4096;
  e.set_eip(0x413258);e.set_esp(stack);
  // Same pinned original RET 20 as the production Worker fixture above.
  const dll=files[1],pe=dll.readUInt32LE(60),sections=pe+24+dll.readUInt16LE(pe+20);
  let callback;
  for(let i=0;i<dll.readUInt16LE(pe+6)&&!callback;i++){
    const s=sections+i*40;if(!(dll.readUInt32LE(s+36)&0x20000000))continue;
    const raw=dll.readUInt32LE(s+20),n=dll.readUInt32LE(s+16),rva=dll.readUInt32LE(s+12);
    const j=dll.subarray(raw,raw+n).indexOf(Buffer.from([0xc2,20,0]));if(j>=0)callback=0x765000+rva+j;
  }
  assert(callback);
  if(observed)assert.equal(e.callback_feed_arm(1),1);
  const trace=[];
  for(let i=0;i<2;i++){
    assert.equal(e.fire_wave_out_callback_bound(17,19,callback,456),1);
    e.run(1);e.run(1);
    trace.push(Object.fromEntries(names.map(k=>[k,e['get_'+k]()>>>0])));
  }
  if(observed){
    assert.equal(e.callback_feed_count(),4);assert.equal(e.callback_feed_invalid(),1);
    e.callback_feed_drain();assert.equal(e.callback_feed_invalid(),1,'draining retains CPU loss');
  }else assert.equal(e.callback_feed_count(),0);
  return {trace,memoryHash:api.hash(new Uint8Array(memory.buffer))};
}
(async()=>{
  const off=await run(false),on=await run(true);
  assert.deepEqual(on.trace,off.trace,'all queued architectural CPU states equal');
  assert.deepEqual(on.final,off.final,'final CPU and entire shared memory parity');
  const overflow=await run(true,3);assert.match(overflow.observation.invalid,/overflow/);
  assert.deepEqual(await cpuOverflow(true),await cpuOverflow(false),'shipped CPU overflow preserves full CPU/memory parity');
  const result={pass:true,fixtureOnly:true,scope:'callback context feed ONLY; writer enrollment and authenticated lifetime OPEN',
    wasm:{sha256:api.hash(bytes),size:bytes.length},media:api.MEDIA,workerStops,on,overflow:overflow.observation};
  if(process.env.GLTRON_CALLBACK_RESULT)fs.writeFileSync(process.env.GLTRON_CALLBACK_RESULT,JSON.stringify(result,null,2)+'\n');
  console.log('PASS production callback suspend/admit/native RET/restore, interrupted refill, nested async rejection, session/loss controls, CPU+whole-memory parity');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
