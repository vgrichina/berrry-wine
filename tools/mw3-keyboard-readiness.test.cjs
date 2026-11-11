'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'), crypto=require('node:crypto'), vm=require('node:vm');
const {BASE,SIZE}=require('../lib/region-map.generated');
const {attach}=require('./mw3-keyboard-readiness.cjs');
const {sample}=require('./mw3-menu-poll-decision.cjs');
const {readCompletion}=require('./mw3-keyboard-completion');

test('authentic one-record drain and sequence boundary with compiled production keyboard',t=>{
  const pe=require('../lib/pe').readPE('test/binaries/shareware/mw3/ex/Program_Files/mech3demo.exe');
  assert.equal(crypto.createHash('sha256').update(pe.buf).digest('hex'),
    'df457ee6973f6f9d557c57aa3fc14258303486ec8b8742fd37b4369c1f37dbdc');
  const wasm=fs.readFileSync(process.env.MW3_READINESS_WASM||'build/wine-assembly.wasm');
  t.diagnostic('module SHA256 '+crypto.createHash('sha256').update(wasm).digest('hex'));
  const mod=new WebAssembly.Module(wasm);
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const {Win98Renderer}=require('../lib/renderer');
  const renderer=Object.create(Win98Renderer.prototype);
  Object.assign(renderer,{inputQueue:[],windows:{},_stepWakeHooks:new Set(),
    wasm:{exports:{},_runsInGuestWorker:true}});
  renderer.wasm._guestWorker=true;
  renderer._guestWorkerWasms=new WeakSet([renderer.wasm]);
  const host=require('../lib/host-window').createWindowHost({renderer,getMemory:()=>memory.buffer},{}).imports;
  const table={}; let ticks=1000,ex;
  for(const i of WebAssembly.Module.imports(mod)) table[i.name]=i.kind==='memory'?memory:
    ()=>{throw Error('unexpected import '+i.name);};
  table.di_keyboard_buffer=host.di_keyboard_buffer;
  table.get_ticks=()=>ticks;
  for(const n of ['beep_process_begin','beep_thread_begin','midi_stream_service',
    'log','log_i32','log_api_exit'])table[n]=()=>{};
  const install=vm.runInNewContext('('+attach+')',{DataView,Uint8Array,Date,performance,JSON,Map});
  const decision=vm.runInNewContext('('+sample+')',{DataView,Uint8Array});
  const decode=vm.runInNewContext('('+readCompletion+')',{DataView});
  const opts={getExports:()=>ex,memory,sample:decision,readCompletion:decode,
    layout:{objectsBase:BASE.DX_OBJECTS,objectsSize:SIZE.DX_OBJECTS}};
  let observer=install(table,opts);
  ex=new WebAssembly.Instance(mod,{host:table}).exports;
  ex.init_thread(0,0x400000,0x400000,0x600000,0x7500000,0x7500020,4);
  const d=new DataView(memory.buffer),g=a=>ex.guest_to_wasm(a)>>>0;
  const put=(a,v)=>d.setUint32(g(a),v>>>0,true), u=a=>d.getUint32(g(a),true);
  const bytes=(a,b)=>new Uint8Array(memory.buffer,g(a),b.length).set(b);
  const slices=[[0x4f7610,0x4f7690],[0x4f7aa0,0x4f7c30],[0x4fa160,0x4fa17b],
    [0x5633f0,0x563477],[0x5634c0,0x5634f4],[0x563c50,0x563c80]];
  for(const [a,end] of slices)bytes(a,pe.buf.subarray(pe.va2off(a),pe.va2off(end)));
  const apis=JSON.parse(fs.readFileSync('src/api_table.json'));
  const thunk=(i,name)=>{
    const id=apis.findIndex(r=>(typeof r==='string'?r:r.name)===name);assert(id>=0);
    d.setUint32(BASE.THUNK_BASE+i*8,0x80000000,true);d.setUint32(BASE.THUNK_BASE+i*8+4,id,true);
    return 0x7500000+i*8;
  };
  put(0x520028,thunk(0,'IDirectInputDevice_GetDeviceData'));
  put(0x52001c,thunk(1,'IDirectInputDevice_Acquire'));
  put(0x58671c,thunk(2,'timeGetTime'));
  put(0x520100,0x520000);put(0x520104,0);
  [7,0,1,128,0x700,256,0,0x100].forEach((v,i)=>d.setUint32(BASE.DX_OBJECTS+i*4,v,true));
  put(0x5fc90c,0x520100);put(0x5fc910,0x530000);
  bytes(0x5fc8fc,[1,0,1]);put(0x5fc900,1);put(0x5fc904,2);put(0x600f84,1);
  // Synthetic caller/objects/callbacks only; original function slices unchanged.
  bytes(0x401000,[0xeb,0xfe]);
  const invoke=(address,ecx=0,args=[],budget=8000)=>{
    ex.set_eip(address);ex.set_esp(0x510000);ex.set_ecx(ecx);ex.clear_yield();
    [0x401000,...args].forEach((v,i)=>put(0x510000+i*4,v));ex.run(budget);
    return ex.get_eax()>>>0;
  };
  const edge=(vk,code,down)=>renderer[down?'handleKeyDown':'handleKeyUp'](vk,{code});
  invoke(0x7500008,0,[0x520100]);
  observer.start({durationMs:45000,apiLogBefore:0});
  assert.equal(invoke(0x4f7aa0),0);assert.equal(ex.get_eip()>>>0,0x401000);
  // Empty nonblocking calls return instead of reaching any mouse API.
  for(let i=0;i<100;i++)assert.equal(invoke(0x4f7aa0),0);
  edge(65,'KeyA',true);assert.equal(invoke(0x4f7aa0),0x1e);
  edge(65,'KeyA',false);assert.equal(invoke(0x4f7aa0),0);
  edge(16,'ShiftLeft',true);assert.equal(invoke(0x4f7aa0),0);
  edge(66,'KeyB',true);assert.equal(invoke(0x4f7aa0),0x430,'modifier packed into returned key');
  edge(66,'KeyB',false);invoke(0x4f7aa0);
  edge(16,'ShiftLeft',false);invoke(0x4f7aa0);
  // A blocking empty call reuses the now-zero in/out count. Bound execution,
  // retain requests proving that a subsequently queued key cannot be read.
  invoke(0x4f7aa0,1,[],400);
  assert.notEqual(ex.get_eip()>>>0,0x401000);
  edge(67,'KeyC',true);ex.run(1000);
  assert.notEqual(ex.get_eip()>>>0,0x401000);
  const blocking=observer.snapshot();
  assert(blocking.rows.some(r=>r.last.request.blocking===1&&r.last.request.requested===0));
  // Reset only the synthetic caller after bounded execution, not an original.
  assert.equal(invoke(0x4f7aa0),0x2e);
  edge(67,'KeyC',false);invoke(0x4f7aa0);
  observer.stop();observer.restore();

  // Authentic sequence pump, synthetic node update/cleanup. The node's update
  // returns a controlled active bit; it is explicitly not original rendering.
  put(0x540018,0x540100);put(0x540100,0x540200);put(0x540104,0);
  put(0x540204,0x402000);put(0x54020c,0x402020);
  bytes(0x402000,[0xff,0x05,0,0x03,0x54,0,0xa1,4,3,0x54,0,0xc2,8,0]);
  bytes(0x402020,[0xff,0x05,8,3,0x54,0,0xc3]);
  put(0x540304,1);
  d.setFloat64(g(0x540008),0.5,true);
  d.setFloat32(g(0x599cf0),pe.buf.readFloatLE(pe.va2off(0x599cf0)),true);
  observer=install(table,opts); // Reinstantiate to capture the replacement imports.
  const state=new Uint8Array(memory.buffer).slice(g(0x400000),g(0x600000));
  ex=new WebAssembly.Instance(mod,{host:table}).exports;
  ex.init_thread(0,0x400000,0x400000,0x600000,0x7500000,0x7500020,4);
  new Uint8Array(memory.buffer,g(0x400000),state.length).set(state);
  observer.start({durationMs:45000,apiLogBefore:0});
  assert.equal(invoke(0x5634c0,0x540000)&255,1);
  assert.equal(u(0x540300),1);assert.equal(u(0x540018),0x540100);
  const first=observer.snapshot().rows[0].first.request;
  assert.equal(first.outerCaller,0x56340b);assert.equal(first.blocking,0);
  assert.equal(first.sequence.owner,0x540000);assert.equal(first.sequence.step,0x402000);
  assert.equal(first.sequence.wrapperCaller,0x5634ef);
  assert.equal(first.sequence.controllerCaller,0x401000);
  assert.equal(first.sequence.tickWords[0],1000);
  assert(Math.abs(new DataView(Uint32Array.from(first.sequence.nowWords).buffer).getFloat64(0,true)-1)<1e-6);
  // A node finishing advances to NULL; pump returns active for that iteration,
  // then inactive on the next call, which issues no keyboard read.
  put(0x540304,0);ticks=2000;
  assert.equal(invoke(0x5634c0,0x540000)&255,1);assert.equal(u(0x540018),0);
  assert.equal(invoke(0x5634c0,0x540000)&255,0);assert.equal(u(0x540308),1);
  const snapshot=observer.stop();
  assert.deepEqual(Array.from(snapshot.errors),[]);assert.equal(snapshot.drops,0);
  assert.equal(snapshot.pending,0);assert.equal(snapshot.entries,snapshot.exits);
  assert(snapshot.rows.every(r=>r.first.decoded.count===0));
  t.diagnostic(JSON.stringify({slices,blocking,sequence:snapshot}));
  const before=JSON.stringify(snapshot.rows);invoke(0x4f7aa0);
  assert.equal(JSON.stringify(observer.snapshot().rows),before,'stopped captured wrappers inert');
  assert.throws(()=>observer.start({apiLogBefore:0}),/single bounded/);
  assert.equal(observer.restore().conflicts.length,0);

  const rebind=(extra={},start={})=>{
    observer=install(table,{...opts,...extra});
    const saved=new Uint8Array(memory.buffer).slice(g(0x400000),g(0x600000));
    ex=new WebAssembly.Instance(mod,{host:table}).exports;
    ex.init_thread(0,0x400000,0x400000,0x600000,0x7500000,0x7500020,4);
    new Uint8Array(memory.buffer,g(0x400000),saved.length).set(saved);
    observer.start({durationMs:45000,apiLogBefore:0,...start});
  };
  rebind();
  // Authentic WAIT node: start stores its supplied time as float, step keeps
  // the node active only while current time < start + duration.
  put(0x540018,0x540100);put(0x540204,0x563c60);
  d.setFloat64(g(0x540008),0,true);
  d.setFloat32(g(0x540108),1,true);
  invoke(0x563c50,0x540100,[0,0x3fe00000]); // node start = 0.5 seconds
  ticks=1499;assert.equal(invoke(0x5634c0,0x540000)&255,1);
  assert.equal(u(0x540018),0x540100);
  ticks=1500;assert.equal(invoke(0x5634c0,0x540000)&255,1);
  assert.equal(u(0x540018),0);
  assert.equal(invoke(0x5634c0,0x540000)&255,0);
  const timed=observer.stop();
  assert(timed.rows.some(r=>r.first.request.sequence.step===0x563c60));
  assert.equal(timed.errors.length,0);observer.restore();

  rebind();
  put(0x540018,0x540100);put(0x540304,1);put(0x540300,0);
  put(0x540204,0x402000);
  edge(68,'KeyD',true);
  // Synthetic unrelated sound cleanup dependencies reached only on skip.
  bytes(0x53a330,[0x31,0xc0,0xc3]);bytes(0x53a6c0,[0xc3]);
  assert.equal(invoke(0x5634c0,0x540000)&255,0);
  assert.equal(u(0x540018),0,'keypress ends sequence');
  assert.equal(u(0x540300),0,'keypress bypasses sequence update');
  observer.stop();observer.restore();
  edge(68,'KeyD',false);invoke(0x4f7aa0);

  rebind({capacity:1});invoke(0x4f7aa0);
  edge(69,'KeyE',true);invoke(0x4f7aa0);
  const overflow=observer.snapshot();
  assert.equal(overflow.active,false);assert.equal(overflow.drops,1);
  assert.match(overflow.errors.join(),/capacity/);observer.restore();
  edge(69,'KeyE',false);invoke(0x4f7aa0);

  rebind();
  d.setUint32(BASE.DX_OBJECTS+28,0x100,true); // Actual compiled failed HRESULT.
  bytes(0x4fa810,[0xc2,4,0]); // Synthetic diagnostic-report dependency.
  invoke(0x4f7aa0);
  const failed=observer.snapshot();
  assert.equal(failed.active,false);assert.equal(failed.rows[0].first.eax,0x8007000c);
  assert.match(failed.errors.join(),/successful lossless/);observer.restore();
  d.setUint32(BASE.DX_OBJECTS+28,0x500,true);

  rebind();bytes(0x4f7ab3,[0x31,0xf6]);invoke(0x4f7aa0);
  const mismatch=observer.snapshot();
  assert.equal(mismatch.active,false);assert.match(mismatch.errors.join(),/code mismatch/);
  observer.restore();
  bytes(0x4f7ab3,[0x33,0xf6]);
  rebind({}, {durationMs:1});
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,3);
  const expired=observer.snapshot();assert.equal(expired.active,false);
  invoke(0x4f7aa0);assert.equal(observer.snapshot().rows.length,0);
  observer.restore();
  rebind();const actual=table.log;table.log=()=>{};
  assert(observer.snapshot().conflicts.includes('log'));
  assert(observer.restore().conflicts.includes('log'));table.log=actual;
  t.diagnostic(JSON.stringify({timed,overflow,failed,mismatch,expired}));
});
