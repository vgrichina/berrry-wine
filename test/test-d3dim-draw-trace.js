#!/usr/bin/env node
'use strict';
// Execute the production worker dispatcher, with native exports supplied by
// the fixture. No Wasm build, browser, or game execution is involved.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
async function fixture(backend = 'software') {
  const messages = [], calls = [], timers = new Map(), imports = [];
  const memory = { buffer: new SharedArrayBuffer(5 * 1024 * 1024) };
  let allocation = 4096, nextTimer = 0, failure = null;
  const exports = {
    d3dim_worker_init() {}, d3d_render_reset_transients() {}, d3d_render_retire_heap() {},
    guest_alloc(n) { const p = allocation; allocation += n; return p; },
    guest_to_wasm: p => p,
    d3dim_worker_draw(...args) { calls.push(args); if (failure) throw failure; return 91; },
    d3dim_worker_flip(...args) { calls.push(['flip', ...args]); },
  };
  const context = vm.createContext({ console, performance, ArrayBuffer, SharedArrayBuffer,
    Uint8Array, Int32Array, DataView, Atomics,
    setTimeout(fn) { const id = ++nextTimer; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
    WebAssembly: { instantiate: async () => ({ exports }) },
    postMessage(m) { messages.push(structuredClone(m)); },
    importScripts(url) {
      imports.push(url);
      if (!url.startsWith('d3dim-draw-trace')) return;
      assert.match(url, /^d3dim-draw-trace\.js/);
      vm.runInContext(fs.readFileSync(path.join(root, 'lib/d3dim-draw-trace.js'), 'utf8'), context);
    },
  });
  context.self = context;
  context.D3DIMRenderWorker = { create() { return {
    execute(message) {
      calls.push(['gpu', message.opcode, message.stateGuest]);
      if (failure) throw failure;
      return 91;
    }, destroy() {},
  }; } };
  vm.runInContext(fs.readFileSync(path.join(root, 'lib/d3d-render-worker.js'), 'utf8') +
    '\nglobalThis.dispatch = sharedMessage;', context);
  await context.dispatch({ t: 'render-init', imageBase: 0x400000, memory, module: {}, sourceVersion: 'trace-test' });
  const buffers = [], controls = [];
  for (const endpointId of [1, 2]) {
    await context.dispatch({ t: 'render-open', endpointId, options: { api: 'legacy', backend } });
    buffers[endpointId] = new SharedArrayBuffer(8192);
    controls[endpointId] = new SharedArrayBuffer(64);
    await context.dispatch({ t: 'render-message', endpointId,
      message: { t: 'init', control: controls[endpointId], buffers: [buffers[endpointId]] } });
  }
  const send = (endpointId, message) => context.dispatch({ t: 'render-message', endpointId, message });
  async function trace(action, options, endpointId = 1) {
    await send(endpointId, { t: 'legacy-draw-trace', action, options, requestId: 'test' });
    return messages.at(-1).message;
  }
  function record(endpointId = 1, change = {}) {
    const bytes = new Uint8Array(buffers[endpointId]); bytes.fill(0);
    const d = new DataView(bytes.buffer);
    [4224, 0x1234, 4, 3, 3, 4096, 96, 0].forEach((n, i) => d.setUint32(i * 4, n, true));
    d.setUint32(32, 0x87654321, true);
    // Preserve unusual float payload bits, not a JSON number approximation.
    d.setUint32(4128, 0x7fc01234, true); d.setUint32(4132, 0x80000000, true);
    for (const [offset, value] of Object.entries(change)) d.setUint32(+offset, value, true);
    return bytes;
  }
  const batch = (endpointId = 1, bytes = 4224) => send(endpointId,
    { t: 'batch', index: 0, bytes, commands: 1, seq: 7, imageBase: 0x400000 });
  return { calls, imports, timers, controls, trace, record, batch,
    fail(e) { failure = e; }, send };
}
(async () => {
  const f = await fixture();
  f.record(); await f.batch();
  assert.strictEqual(f.calls.length, 1);
  assert.strictEqual(f.imports.length, 0, 'disabled path must not load recorder');
  assert.strictEqual((await f.trace('read')).receipt, null);
  assert.strictEqual(f.timers.size, 0);

  assert.match((await f.trace('arm', { maxBytes: 0 })).error, /maxBytes/);
  assert.match((await f.trace('arm', { maxBytes: 4194305 })).error, /maxBytes/);
  assert.match((await f.trace('arm', { maxCommands: 257 })).error, /maxCommands/);
  assert.match((await f.trace('arm', { timeoutMs: 5001 })).error, /timeoutMs/);
  assert.strictEqual(new Int32Array(f.controls[1])[2], 0, 'invalid diagnostic must not poison renderer');
  await f.trace('arm', { maxCommands: 2 });
  assert.match((await f.trace('arm')).error, /already armed/);
  f.record(2); await f.batch(2);
  assert.strictEqual((await f.trace('read')).receipt.commands, 0, 'endpoint isolation');
  const bytes = f.record(); await f.batch(); bytes.fill(255);
  let receipt = (await f.trace('read')).receipt;
  assert.strictEqual(receipt.replayable, false); assert.strictEqual(receipt.complete, false);
  assert.strictEqual(receipt.bytes, 4224);
  assert.strictEqual(new DataView(receipt.records[0].vertices.buffer).getUint32(0, true), 0x7fc01234);
  assert.strictEqual(new DataView(receipt.records[0].vertices.buffer).getUint32(4, true), 0x80000000);
  assert.strictEqual(new DataView(receipt.records[0].state.buffer).getUint32(0, true), 0x87654321);
  receipt.records[0].state.fill(0);
  assert.strictEqual((await f.trace('read')).receipt.records[0].state[0], 0x21);
  f.record(); await f.batch(); await f.batch();
  receipt = (await f.trace('read')).receipt;
  assert.strictEqual(receipt.commands, 2); assert.strictEqual(receipt.reason, 'command-limit');
  assert.strictEqual(f.calls.length, 5, 'bounds must not stop native draws');
  assert.strictEqual(f.timers.size, 0);

  await f.trace('arm', { maxBytes: 4223 }); f.record(); await f.batch();
  receipt = (await f.trace('read')).receipt;
  assert.strictEqual(receipt.reason, 'byte-limit'); assert.strictEqual(receipt.bytes, 0);
  await f.trace('arm', { maxBytes: 4224 }); f.record(); await f.batch(); await f.batch();
  receipt = (await f.trace('read')).receipt;
  assert.strictEqual(receipt.reason, 'byte-limit'); assert.strictEqual(receipt.bytes, 4224);
  assert.strictEqual(receipt.commands, 1);
  await f.trace('arm'); f.record(1, { 0: 32, 28: 1 }); await f.batch(1, 32);
  assert.strictEqual((await f.trace('read')).receipt.reason, 'unsupported-record-1');
  assert.strictEqual(f.calls.at(-1)[0], 'flip', 'unsupported trace does not suppress rendering');

  await f.trace('arm'); f.record(1, { 20: 4095 });
  await assert.rejects(f.batch(), /invalid D3D command record/);
  assert.strictEqual((await f.trace('read')).receipt.reason, 'malformed-record');
  await f.trace('arm'); f.record();
  await assert.rejects(f.batch(1, 8), /truncated D3D command header/);
  assert.strictEqual((await f.trace('read')).receipt.reason, 'malformed-record');

  await f.trace('arm'); f.record();
  const failure = new Error('real native failure'); f.fail(failure);
  await assert.rejects(f.batch(), e => e === failure);
  assert.strictEqual((await f.trace('read')).receipt.reason, 'renderer-error');
  f.fail(null);
  await f.trace('arm'); for (const fire of [...f.timers.values()]) fire();
  assert.strictEqual((await f.trace('read')).receipt.reason, 'deadline');
  await f.trace('arm'); assert.strictEqual((await f.trace('stop')).receipt.reason, 'requested');
  assert.strictEqual(f.timers.size, 0);
  assert.strictEqual(f.imports.length, 1, 'load once with inherited version');
  assert.strictEqual(f.imports[0], 'd3dim-draw-trace.js?v=trace-test');

  const gpu = await fixture('webgl');
  await gpu.trace('arm'); gpu.record(); await gpu.batch();
  assert.strictEqual(gpu.calls.at(-1)[0], 'gpu');
  assert.strictEqual((await gpu.trace('read')).receipt.commands, 1);
  await gpu.send(1, { t: 'legacy-call', opcode: 0x20004, wa: 128, seq: 8 });
  assert.strictEqual(new Int32Array(gpu.controls[1])[11], 91, 'diagnostic preserves adapter return');
  assert.strictEqual((await gpu.trace('read')).receipt.reason, 'unsupported-legacy-call');
  await gpu.trace('arm'); gpu.record(); gpu.fail(failure);
  await assert.rejects(gpu.batch(), e => e === failure);
  assert.strictEqual((await gpu.trace('read')).receipt.reason, 'renderer-error');
  gpu.fail(null);
  await gpu.trace('arm');
  await gpu.send(1, { t: 'legacy-close' });
  assert.strictEqual(gpu.timers.size, 0, 'endpoint shutdown cancels deadline');

  // The observer owns only bounded values; neither a receipt nor a failed
  // observation can mutate source bytes or change renderer completion.
  const {createGround}=require('../lib/d3dim-draw-trace');
  assert.throws(()=>createGround({endpointId:1,x:-1,y:2}),/diagnostic x/);
  const native=new Uint8Array([3,2,1,255]),rgba=new Uint8Array([1,2,3,255]);
  const cache={key:'unit',width:1,height:1,bpp:32,format:0,pitch:4,dib:0,pixels:rgba};
  const owner={u8:native,textures:new Map([[1,cache]])};
  let output=[10,20,30,255],reads=0;
  const target={rt:7,dib:8,width:8,height:8,bpp:32,format:0,device:{gpu:{gl:{RGBA:1,UNSIGNED_BYTE:2},
    readPixels(x,y,w,h,f,t,p){assert.deepStrictEqual([x,y,w,h],[2,5,1,1]);p.set(output);reads++;}}}};
  const vertices=new Uint8Array(96),dv=new DataView(vertices.buffer);
  [[-8,-8],[24,-8],[-8,24]].forEach(([x,y],i)=>{
    const p=i*32;dv.setFloat32(p,x,true);dv.setFloat32(p+4,y,true);dv.setFloat32(p+8,.5,true);
    dv.setFloat32(p+12,1,true);dv.setUint32(p+16,0xffffffff,true);});
  const source={command:{sequence:3,ordinal:4},description:{texture:1,addressU:1,addressV:1}};
  const draw={primitive:4,primitiveCount:1,stride:32,vertices,legacySource:source,state:{blend:false},fixedFunction:{},scissor:null,textures:[]};
  const observer=createGround({endpointId:1,x:2,y:2,maxRecords:1});
  const observed=observer.before(owner,target,draw);assert(observed);assert.strictEqual(reads,1);
  output=[90,80,70,255];observer.after(target,observed);
  let capture=observer.receipt();assert.strictEqual(capture.reason,'record-limit');assert.strictEqual(reads,2);
  assert.deepStrictEqual(capture.records[0].before,[10,20,30,255]);
  assert.deepStrictEqual(capture.records[0].after,output);assert.strictEqual(capture.records[0].completed,true);
  assert.deepStrictEqual(capture.records[0].texture.samples[0].native,Array.from(native));
  assert.deepStrictEqual(capture.records[0].texture.samples[0].decoded,Array.from(rgba));
  capture.records[0].after.fill(0);assert.deepStrictEqual(observer.receipt().records[0].after,output);
  assert.strictEqual(observer.before(owner,target,draw),null);assert.strictEqual(reads,2,'hard bound');
  const missed=createGround({endpointId:1,x:7,y:7});
  assert.strictEqual(missed.before(owner,target,{...draw,scissor:{enabled:true,left:0,top:0,right:1,bottom:1}}),null);
  assert.strictEqual(reads,2,'clipped point does not read GPU');missed.stop('test-finished');
  const broken=createGround({endpointId:1,x:2,y:2});
  assert.strictEqual(broken.before({get textures(){throw Error('diagnostic-only failure');}},target,draw),null);
  assert.match(broken.receipt().reason,/observation-error.*diagnostic-only failure/);
  const renderFailure=new Error('real renderer failure');
  const failingObserver=createGround({endpointId:1,x:2,y:2,maxRecords:1});
  const backend=new (require('../lib/d3dim-gpu').D3DIMGpu)({getMemory:()=>new ArrayBuffer(4),getExports:()=>({}),
    onError:message=>{assert.match(message,/real renderer failure/);throw renderFailure;}});
  backend.drawObserver=failingObserver;target.device.draw=()=>{throw renderFailure;};
  assert.throws(()=>backend._submitImmediate(target,draw),e=>e===renderFailure,'active observer preserves render failure');
  assert.strictEqual(backend.stats.errors,1);assert.strictEqual(failingObserver.receipt().records[0].completed,false);
  console.log('PASS bounded owning D3DIM trace and completed-target ground observer');
})().catch(error => { console.error(error); process.exitCode = 1; });
