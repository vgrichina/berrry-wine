'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const crypto = require('node:crypto'), {Worker} = require('node:worker_threads');
const RPC = require('../lib/guest-rpc');
const {Observer, configuration, snapshot, ABI} = require('../lib/native-user-causal-observer');
const {compileSrcWasm} = require('./compile-src');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
let frozenSources = null;
if(process.env.NATIVE_USER_CAUSAL_GRAPH) {
  const root=path.resolve(__dirname,'..');
  const files=require('../tools/boids-current-runtime.cjs').gitFiles(process.env.NATIVE_USER_CAUSAL_GRAPH);
  for(const file of ['lib/guest-worker.js','lib/native-user-causal-observer.js'])files.set(file,fs.readFileSync(path.join(root,file)));
  frozenSources=[...files].filter(([file])=>/^lib\/.*\.(js|json)$/.test(file))
    .map(([file,bytes])=>[path.join(root,file),bytes.toString()]);
}
const extraWat = `
  (func (export "test_causal_setup")
    (global.set $image_base (i32.const 0x400000))
    (global.set $current_thread_id (i32.const 1))
    (global.set $msg_phase (i32.const 5))
    (call $wnd_table_set (i32.const 0x3333) (i32.const 0x12345678))
    (global.set $focus_hwnd (i32.const 0x3333)))
  (func $test_causal_call (export "test_causal_call") (param $api i32) (param $min i32) (param $max i32) (param $remove i32) (result i32)
    (global.set $yield_flag (i32.const 0)) (global.set $yield_reason (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x500100))
    (call $gs32 (i32.const 0x500100) (i32.const 0))
    (if (i32.eq (local.get $api) (i32.const 1))
      (then (call $handle_GetMessageA (i32.const 0x500000) (i32.const 0)
        (local.get $min) (local.get $max) (i32.const 0) (i32.const 0)))
      (else (call $handle_PeekMessageA (i32.const 0x500000) (i32.const 0)
        (local.get $min) (local.get $max) (local.get $remove) (i32.const 0))))
    (i32.load (global.get $reg_base)))
  (func (export "test_causal_native_overflow") (local $i i32)
    (loop $loop
      (call $native_user_event (i32.const 90) (local.get $i))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $loop (i32.lt_u (local.get $i) (i32.const 70)))))
  (func (export "test_causal_spin")
    (call $gs16 (i32.const 0x500800) (i32.const 0xfeeb))
    (global.set $code_start (i32.const 0x500800))
    (global.set $code_end (i32.const 0x500802))
    (global.set $eip (i32.const 0x500800)))
  (func (export "test_causal_cache_busy") (local $i i32)
    (drop (call $test_causal_call (i32.const 2) (i32.const 0) (i32.const 0) (i32.const 0)))
    (loop $busy
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $busy (i32.lt_u (local.get $i) (i32.const 300000000)))))
`;

async function run() {
  const bytes = process.env.NATIVE_USER_CAUSAL_MODULE
    ? fs.readFileSync(process.env.NATIVE_USER_CAUSAL_MODULE)
    : compileSrcWasm((file, text) => file === '13-exports.wat' ? text + extraWat : text);
  const module = await WebAssembly.compile(bytes);
  if (process.env.NATIVE_USER_CAUSAL_OUT) fs.writeFileSync(process.env.NATIVE_USER_CAUSAL_OUT, bytes);
  assert(ABI.every(n => WebAssembly.Module.exports(module).some(e => e.name === n)));
  return {bytes,module};
}

async function workerCase(module, sigs, mode) {
  const memory = new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const config = configuration(mode === 'output-overflow' ? 8 : 8192);
  const entry=path.resolve(__dirname,'../lib/guest-worker.js');
  const w = frozenSources ? new Worker(`
    const {workerData}=require('node:worker_threads'),Module=require('node:module');
    const sources=new Map(workerData.sources);
    for(const ext of ['.js','.json']) {
      const old=Module._extensions[ext];
      Module._extensions[ext]=(module,file)=>{
        if(!sources.has(file))return old(module,file);
        if(ext==='.json')module.exports=JSON.parse(sources.get(file));
        else module._compile(sources.get(file),file);
      };
    }
    require(workerData.entry);
  `,{eval:true,workerData:{sources:frozenSources,entry}}) : new Worker(entry);
  let seq = 0, requests = 0, polls = 0, token = 0, pendingBlock = null;
  const pending = new Map(), queue = [], calls = [];
  const table = Object.fromEntries(Object.keys(sigs).map(n => [n,()=>0]));
  Object.assign(table, {
    real_time_ms:()=>Date.now() & 0x7fffffff, get_ticks:()=>100,
    process_ctl:()=>0,
    input_validate:n=>n === 0 ? 0x424e49 : 1,
    input_consumed:()=>1,
    check_input:()=>{ polls++; const v=queue.shift() || 0; token=v?token+1:0; return v; },
    check_input_token:()=>token, check_input_hwnd:()=>0x3333, check_input_lparam:()=>1,
  });
  const broker = RPC.createMainBroker(memory,table,sigs);
  w.on('message', m=>{
    if (m.t === 'rpc') {
      requests++;
      const v=RPC.views(memory,m.slot),name=Object.keys(sigs).sort()[Atomics.load(v.i32,RPC.SLOT.FN)];
      calls.push(name);
      if (mode === 'blocking' && name === 'check_input' && !pendingBlock) {pendingBlock=m;return;}
      broker.serveRpc(m.slot);
    } else if (m.t === 'calls') broker.serveCalls(m);
    else {const p=pending.get(m.seq ?? 0);if(p){pending.delete(m.seq??0);m.t==='error'?p.reject(Error(m.message||m.error)):p.resolve(m);}}
  });
  w.on('error', e=>{for(const p of pending.values())p.reject(e);});
  const ask = msg => new Promise((resolve,reject)=>{
    const id = msg.t === 'init' ? 0 : ++seq;
    const timer=setTimeout(()=>reject(Error('Worker response timeout '+JSON.stringify(msg))),10000);
    pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});
    w.postMessage({...msg,seq:id});
  });
  const call = (name,args=[])=>ask({t:'callExport',name,args});
  try {
    await ask({t:'init',module,memory,sigs,slot:0,endpointIdentity:77,
      ...(mode === 'default-off' ? {} : {nativeUserCausal:config})});
    await call('test_causal_setup');
    if (!['default-off','native-overflow'].includes(mode)) await ask({t:'nativeUserCausal',action:'arm',endpointIdentity:77,nonce:'0123456789abcdef'});
    if (mode === 'native-overflow') {
      await call('native_user_causal_arm',[0x89abcdef,0x01234567]);
      await call('test_causal_native_overflow');
      assert.equal((await call('native_user_causal_status',[5])).value,1);
      assert.equal((await call('native_user_causal_status',[3])).value,64);
      assert.equal((await call('native_user_causal_status',[0])).value,0);
      return {mode,pass:true};
    }
    if(mode === 'expiry') {
      const first=snapshot(config);
      assert(first.deadline > performance.timeOrigin+performance.now());
      await new Promise(resolve=>setTimeout(resolve,30040));
      const expired=snapshot(config);
      assert(expired.expired);assert.equal(expired.state,2);
      assert(expired.records.some(r=>r[0]===109),'fixed real30s expiry retained without endpoint request');
      assert.equal(expired.deadline,first.deadline,'deadline never renews');
      return {mode,pass:true,sourceMs:30000};
    }
    if(mode === 'busy') {
      await call('test_causal_spin');
      const busy=await ask({t:'slice',steps:2000000});
      assert(busy.blocks>0,'actual x86 interpreter retired busy-loop blocks');
      assert.equal(busy.yield,0);assert.equal(busy.eip,0x500800);
      const trace=snapshot(config);
      assert(trace.records.some(r=>r[0]===101),'owning slice entry retained');
      assert(trace.records.some(r=>r[0]===102),'owning slice exit retained');
      await ask({t:'nativeUserCausal',action:'cancel',endpointIdentity:77});
      return {mode,pass:true,blocks:busy.blocks,ms:busy.ms};
    }
    queue.push((13<<16)|0x100); broker.publish({inputPending:1});
    const first = call('test_causal_call',[2,0,0,0]);
    if (mode === 'blocking') {
      const deadline=Date.now()+3000;
      while (!pendingBlock && Date.now()<deadline) await new Promise(r=>setTimeout(r,5));
      assert(pendingBlock,'actual USER broker request blocked');
      const before=snapshot(config), last=before.records.at(-1);
      assert.equal(last[0],103); assert(before.records.some(r=>r[0]===1&&r[7]===3));
      const fence=requests;
      // The trace is already available without issuing another Worker command.
      for(let i=0;i<3;i++) assert.deepEqual(snapshot(config),before);
      assert.equal(requests,fence);
      broker.serveRpc(pendingBlock.slot);
    }
    assert.equal((await first).value,1,'PM_NOREMOVE returns key');
    if(mode === 'cache-busy') {
      const before=snapshot(config).records.length;
      let complete=false;
      const busy=call('test_causal_cache_busy').then(r=>{complete=true;return r;});
      const until=Date.now()+2000;
      let retained=[];
      while(Date.now()<until && !complete) {
        retained=snapshot(config).records.slice(before).filter(r=>r[0]===1);
        const cache=retained.find(r=>r[7]===5);
        if(cache && retained.some(r=>r[7]===2&&r[6]>cache[6]))break;
        await new Promise(r=>setTimeout(r,1));
      }
      assert(!complete,'CPU remains in actual native busy loop');
      assert(retained.some(r=>r[7]===5),'cache hit retained before native busy call returns');
      const cache=retained.find(r=>r[7]===5);
      assert(retained.some(r=>r[7]===2&&r[6]>cache[6]),'same native USER end retained before busy call returns');
      const fence=requests;
      for(let i=0;i<4;i++)snapshot(config);
      assert.equal(requests,fence,'shared trace reads issue zero later endpoint requests');
      await busy;
    }
    assert.equal((await call('test_causal_call',[2,0,0,0])).value,1,'cache repeated peek');
    assert.equal(polls,1,'cache does not repoll');
    assert.equal((await call('test_causal_call',[2,0,0,1])).value,1,'PM_REMOVE returns same key');
    queue.push((14<<16)|0x100); broker.publish({inputPending:1});
    assert.equal((await call('test_causal_call',[2,0x201,0x201,1])).value,0,'filter excludes key');
    assert.equal((await call('test_causal_call',[2,0,0,1])).value,1,'filtered key retained');
    queue.push((15<<16)|0x100); broker.publish({inputPending:1});
    assert.equal((await call('test_causal_call',[1,0,0,1])).value,1,'GetMessage removes key');
    const outcome = {polls};
    if(mode === 'default-off') {
      assert.equal((await call('native_user_causal_status',[3])).value,0);
      assert.equal(snapshot(config).records.length,0);
    } else {
      if(mode === 'retire') await ask({t:'retireScopedLoaders',endpointIdentity:77});
      else if(mode === 'reinit') await ask({t:'init',module,memory,sigs,slot:0,endpointIdentity:78});
      else await ask({t:'nativeUserCausal',action:'cancel',endpointIdentity:77});
      const s=snapshot(config), native=s.records.filter(r=>r[0]===1).map(r=>r.slice(6,23));
      if(mode === 'output-overflow') {assert.equal(s.overflow,1);return {mode,pass:true};}
      assert.equal(s.nonce,'0123456789abcdef');assert.equal(s.identity,77);assert.equal(s.overflow,0);
      assert(native.some(r=>r[1]===5),'real cached native path');
      assert(native.some(r=>r[1]===7),'real native filter rejection');
      assert(native.some(r=>r[1]===6&&r[7]===0),'no-remove admission');
      assert(native.some(r=>r[1]===8&&r[7]===1),'actual cache removal');
      assert(native.some(r=>r[1]===2&&r[2]===1&&r[7]===1),'GetMessage native return');
      assert(native.every((r,i)=>!i||r[0]===native[i-1][0]+1),'ordered native sequence');
      const stopped=s.records.length;
      if(mode === 'retire') await assert.rejects(call('test_causal_call',[2,0,0,0]),/retired/);
      else await call('test_causal_call',[2,0,0,0]);
      assert.equal(snapshot(config).records.length,stopped);
      outcome.records=native.length;
    }
    return {mode,pass:true,...outcome};
  } finally {await w.terminate(); assert(w.threadId === -1,'actual Worker joined');}
}

if(require.main === module) (async()=>{
  const {bytes,module}=await run();
  const sigs=require('../lib/host-import-sigs.generated.json').sigs;
  const results=[];
  for(const mode of ['default-off','enabled','blocking','native-overflow','output-overflow','retire','reinit','busy','cache-busy','expiry'])results.push(await workerCase(module,sigs,mode));
  console.log(JSON.stringify({moduleSHA256:sha(bytes),bytes:bytes.length,
    workerSHA256:sha(fs.readFileSync(path.resolve(__dirname,'../lib/guest-worker.js'))),
    observerSHA256:sha(fs.readFileSync(path.resolve(__dirname,'../lib/native-user-causal-observer.js'))),
    sourceGraph:process.env.NATIVE_USER_CAUSAL_GRAPH||null,
    frozenSources:frozenSources?.map(([file,source])=>({path:path.relative(path.resolve(__dirname,'..'),file),sha256:sha(Buffer.from(source))})),
    results},null,2));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={extraWat,workerCase};
