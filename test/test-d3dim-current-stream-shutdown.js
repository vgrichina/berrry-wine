#!/usr/bin/env node
'use strict';
// Current stream-v2 software path, real WAT rasterizer/shared memory/Workers.
// Delayed callbacks below are actual Atomics.waitAsync notifications held at
// the endpoint's supported schedule boundary, not invented async readbacks.
const assert = require('node:assert/strict');
const { Worker } = require('node:worker_threads');
const { once } = require('node:events');
const crypto = require('node:crypto');
const GS = require('../lib/gpu-stream');
const Doorbell = require('../lib/gpu-stream-doorbell');
const Endpoint = require('../lib/gpu-stream-render-worker');
const Adapter = require('../lib/d3dim-render-worker');
const { makeProducer } = require('./gpu-stream-fixture');
const { compileSrcWasm } = require('./compile-src');
const sigs = require('../lib/host-import-sigs.generated.json').sigs;
const regions = require('../lib/region-map.generated');
const { CONST, KIND, FMT } = GS;
const tick = () => new Promise(resolve => setTimeout(resolve, 2));
async function until(predicate, label) {
  const end = performance.now() + 5000;
  while (!predicate()) { assert(performance.now() < end, label); await tick(); }
}
function producer(memory, offset = 0) {
  const base = regions.BASE.GUEST_HEAP_BASE + 0x200000 + offset;
  return makeProducer({ buffer: memory.buffer, headerAddr: base,
    ringData: base + 0x1000, ringBytes: 0x4000,
    arenaData: base + 0x8000, arenaBytes: 0x4000 });
}
function setup(p, id = 1) {
  p.emit('CREATE', { id, kind: KIND.RT, fmt: FMT.A8B8G8R8, levels: 1, width: 2, height: 2 });
  p.emit('TARGETS', { color: id });
}
function paint(p, stamp, id = 1) {
  p.emit('CLEAR', { mask: 1, colormask: 15, rgba: 0xff332211, z: 1, right: 2, bottom: 2 });
  const dst = p.arenaAlloc(32);
  p.arenaView(dst, 32).fill(0x77);
  p.emit('READBACK', { rt: id, fmt: FMT.A8B8G8R8, w: 2, h: 2, pitch: 12, dst });
  p.emit('PRESENT', { rt: id, w: 2, h: 2, surface: 73, stamp });
  return dst;
}
function pixels(p, dst, frames, stamp) {
  const expected = [17, 34, 51, 255];
  for (const row of [0, 12]) {
    assert.deepEqual([...p.arenaView(dst, 32).slice(row, row + 8)], [...expected, ...expected]);
    assert.deepEqual([...p.arenaView(dst, 32).slice(row + 8, row + 12)], [119,119,119,119]);
  }
  assert.deepEqual([...p.arenaView(dst, 32).slice(24)], Array(8).fill(119));
  const frame = frames.find(f => f.stamp === stamp);
  assert(frame, 'ordinary PRESENT delivered');
  assert.equal(frame.api, 'd3dim-gps');
  assert.deepEqual([...frame.pixels], Array(4).fill(expected).flat());
}
async function direct(module) {
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const host = { memory };
  for (const [name, sig] of Object.entries(sigs)) host[name] = sig.results?.length ? () => 0 : () => {};
  Object.assign(host, { math_pow: Math.pow, math_sin: Math.sin, math_cos: Math.cos });
  const instance = await WebAssembly.instantiate(module, { host });
  instance.exports.d3dim_worker_init(0x400000);
  const queue = [], frames = [], errors = [];
  const endpoint = Endpoint.create({ instance, memory, backend: 'software', endpointId: 19,
    options: { api: 'd3dim-gps' }, schedule: fn => queue.push(fn),
    sendFrame: frame => frames.push(frame), send: message => errors.push(message) });
  let p = producer(memory);
  const kick = (mode = CONST.KICK_ASYNC) => endpoint.execute({ t: 'gps-kick', ring: p.header, mode });
  async function queued() { await until(() => queue.length > 0, 'real notification scheduled'); }
  async function flush() { await tick(); while (queue.length) await queue.shift()(); }
  try {
    setup(p); kick();
    let dst = paint(p, 1); Doorbell.ring(p.i32, p.header); await queued();
    assert.equal(p.load('done_seq'), 2, 'withheld callback has pending records');
    assert.equal(frames.length, 0);
    await flush(); pixels(p, dst, frames, 1);
    assert.equal(p.load('done_seq'), p.load('submit_seq'));
    console.log('PASS actual WAT CLEAR/READBACK/PRESENT and shared completion, including pitch canaries');

    // CLOSE drains published work synchronously, then detaches. Its already
    // scheduled notification must not drain the replacement at the same address.
    for (let cycle = 0; cycle < 3; cycle++) {
      dst = paint(p, 10 + cycle); Doorbell.ring(p.i32, p.header); await queued();
      const close = kick(CONST.KICK_CLOSE);
      pixels(p, dst, frames, 10 + cycle);
      assert.equal(close.stats.doorbell, false); assert(!Doorbell.armed(p.i32, p.header));
      p = producer(memory); setup(p); kick();
      const pending = paint(p, 20 + cycle), before = p.arenaView(pending, 32).slice();
      const count = frames.length, done = p.load('done_seq');
      await flush();
      assert.equal(p.load('done_seq'), done, 'retired generation cannot drain replacement');
      assert.equal(frames.length, count, 'no stale frame callback');
      assert.deepEqual(p.arenaView(pending, 32), before, 'no stale readback publication');
      Doorbell.ring(p.i32, p.header); await queued(); await flush();
      pixels(p, pending, frames, 20 + cycle);
    }
    console.log('PASS CLOSE preserves pending completion; three same-address generations reject late callbacks');

    // A different ring address also retires the old subscription.
    Doorbell.ring(p.i32, p.header); await queued();
    const old = p; p = producer(memory, 0x10000); setup(p, 2); kick();
    assert(!Doorbell.armed(old.i32, old.header));
    dst = paint(p, 30, 2); const before = p.arenaView(dst, 32).slice(), count = frames.length;
    await flush(); assert.equal(frames.length, count); assert.deepEqual(p.arenaView(dst, 32), before);
    Doorbell.ring(p.i32, p.header); await queued(); await flush(); pixels(p, dst, frames, 30);
    console.log('PASS ring identity replacement rejects retired callback; new identity completes');

    dst = paint(p, 40, 2); Doorbell.ring(p.i32, p.header); await queued();
    const retired = p.arenaView(dst, 32).slice(), n = frames.length, done = p.load('done_seq');
    const waiter = new Worker(`
      const {parentPort, workerData} = require('node:worker_threads');
      const D = require(workerData.lib);
      const words = D.view(workerData.buffer, workerData.ring);
      parentPort.postMessage({ready:true});
      parentPort.postMessage(D.waitDrained(words, workerData.ring, {stallMs:2000}));
      parentPort.close();`, { eval: true, workerData: {
      lib: require.resolve('../lib/gpu-stream-doorbell'), buffer: memory.buffer, ring: p.header } });
    const waiterExit = once(waiter, 'exit'), notices = [];
    waiter.on('message', m => notices.push(m));
    try {
      await until(() => notices.some(m => m.ready), 'SYNC producer Worker ready');
      endpoint.destroy(); endpoint.destroy();
      await until(() => notices.some(m => m.drained === false), 'detach releases native Atomics.wait producer');
      const [code] = await waiterExit; assert.equal(code, 0);
      console.log('PASS cancelled pending ring releases real SYNC producer Worker; actual exit 0');
    } finally { await waiter.terminate(); }
    assert(!Doorbell.armed(p.i32, p.header));
    await flush(); Doorbell.ring(p.i32, p.header); await flush();
    assert.equal(frames.length, n); assert.equal(p.load('done_seq'), done);
    assert.deepEqual(p.arenaView(dst, 32), retired);
    assert.throws(() => kick(), /closed/); assert.deepEqual(errors, []);
    console.log('PASS destroy cancels pending drain; repeated destroy/late wake cannot publish or callback');
  } finally { endpoint.destroy(); await flush(); }
}
async function workerCases(module) {
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const worker = new Worker(require.resolve('../lib/d3d-render-worker'));
  const messages = [], failures = [];
  worker.on('message', m => messages.push(m)); worker.on('error', e => failures.push(e));
  const exited = once(worker, 'exit');
  const post = m => worker.postMessage(m);
  const wait = async (predicate, label) => { await until(() => { if (failures.length) throw failures[0]; return predicate(); }, label); };
  const open = async id => {
    const n = messages.length;
    post({ t: 'render-open', endpointId: id, options: { api: 'd3dim-gps', backend: 'software' } });
    await wait(() => messages.slice(n).some(m => m.endpointId === id && m.message?.t === 'ready'), 'endpoint ready');
  };
  let request = 0;
  const kick = (p, mode = CONST.KICK_ASYNC) => {
    const requestId = ++request;
    post({ t: 'render-message', endpointId: 7, transportId: 'request-' + requestId,
      message: { t: 'render-request', requestId, message: { t: 'gps-kick', ring: p.header, mode } } });
    return requestId;
  };
  const reply = async id => {
    await wait(() => messages.some(m => m.message?.requestId === id), 'stream reply');
    const r = messages.find(m => m.message?.requestId === id).message;
    assert(!r.error, r.error); return r.value;
  };
  const frames = () => messages.filter(m => m.message?.t === 'frame').map(m => m.message.frame);
  try {
    post({ t: 'render-init', module, memory, sigs, imageBase: 0x400000 });
    await wait(() => messages.some(m => m.t === 'render-ready'), 'Worker initialized');
    await open(7);
    let p = producer(memory); setup(p); await reply(kick(p));
    // Queue CLOSE immediately after a request with real published work. The
    // single production queue must complete that work before its close ACK.
    const dst = paint(p, 100);
    assert.notEqual(p.load('read_pos'), p.load('write_pos'));
    const id = kick(p);
    post({ t: 'render-close', endpointId: 7 });
    await reply(id); await wait(() => messages.some(m => m.t === 'render-closed'), 'CLOSE ACK');
    pixels(p, dst, frames(), 100); assert(!Doorbell.armed(p.i32, p.header));
    const closeAt = messages.findIndex(m => m.t === 'render-closed');
    assert(messages.findIndex(m => m.message?.frame?.stamp === 100) < closeAt);
    // Retired notifications cannot target a new endpoint with the same ID.
    await open(7); p = producer(memory); setup(p); await reply(kick(p));
    const pending = paint(p, 101), work = kick(p);
    post({ t: 'render-stop' });
    await reply(work); await wait(() => messages.some(m => m.t === 'render-stopped'), 'STOP ACK');
    pixels(p, pending, frames(), 101); assert(!Doorbell.armed(p.i32, p.header));
    const count = frames().length;
    Doorbell.ring(p.i32, p.header);
    // A transport round trip after STOP proves its queue has processed the
    // late message; no arbitrary quiet interval stands in for a barrier.
    post({ t: 'render-message', endpointId: 7, transportId: 'after-stop', message: {} });
    await wait(() => messages.some(m => m.t === 'render-done' && m.transportId === 'after-stop'), 'post STOP barrier');
    assert.equal(frames().length, count);
    assert.equal(frames().filter(f => f.stamp === 100).length, 1);
    assert.equal(frames().filter(f => f.stamp === 101).length, 1);
    assert(!messages.slice(messages.findIndex(m => m.t === 'render-stopped') + 1).some(m => m.message?.t === 'frame'));
    assert.equal(failures.length, 0);
    assert.equal(messages.filter(m => m.t === 'error' || m.message?.t === 'error').length, 1, 'only expected post-STOP refusal');
    console.log('PASS real process render Worker: pending request then CLOSE/STOP; replacement ID; ordered frames; zero post-retirement frames');
  } finally {
    // Production render-stop retires the heap but intentionally keeps its port
    // alive. Explicit termination is harness cleanup, distinct from that ACK.
    const code = await worker.terminate(); const [exit] = await exited;
    assert.equal(code, exit); console.log('Worker cleanup: harness-requested terminate, actual exit', exit);
  }
}
function adapterContract() {
  // Routing contract only: scripted exports are deliberately not native proof.
  const memory = { buffer: new SharedArrayBuffer(256) }, calls = [];
  // D3DIM draws/clears no longer reach the adapter (GPU stream v2 only);
  // it replays software OpenGL and the barrier, and refuses the retired ops.
  const adapter = Adapter.create({ memory, instance: { exports: {
    gl_sw_worker_draw: (...args) => { calls.push(args); return 1; },
  } }, backend: 'software' });
  new Uint32Array(memory.buffer).set([1,2,3,4,5,6], 16);
  assert.equal(adapter.execute({ opcode: 0x20005, wa: 64 }), 1);
  assert.deepEqual(calls, [[1,3]]);
  assert.equal(adapter.d3dimSoftwareDrawCallsCompleted, 0);
  assert.equal(adapter.fence(), 1);
  for (const opcode of [0x20000, 0x20003, 0x20004])
    assert.throws(() => adapter.execute({ opcode, wa: 64 }), /retired or unknown/);
  assert.throws(() => adapter.diagnostic(), /stream v2 replaced/);
  adapter.destroy(); adapter.destroy();
  assert.deepEqual(calls, [[1,3]], 'destroy creates no delayed native call');
  console.log('PASS synchronous software adapter routing (scripted exports; no async/native claim)');
}
(async () => {
  assert(Doorbell.supported(), 'actual Atomics.waitAsync required');
  adapterContract();
  const bytes = compileSrcWasm();
  console.log('Canonical independent WAT module sha256', crypto.createHash('sha256').update(bytes).digest('hex'));
  const module = await WebAssembly.compile(bytes);
  await direct(module); await workerCases(module);
  console.log('PASS current D3DIM stream shutdown scope: software WAT; no browser/WebGL/removed asynchronous PBO engine/game/crash-freedom claim');
})().catch(error => { console.error(error); process.exitCode = 1; });
