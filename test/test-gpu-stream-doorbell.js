'use strict';
// tl;dr: the GPU stream v2 doorbell (lib/gpu-stream-doorbell.js) between a
// producer and the real API-neutral render-Worker endpoint
// (lib/gpu-stream-render-worker.js), with no request message per kick:
//   1. the first gps-kick request drains and arms the ring (GpsRing.consumer);
//   2. an ASYNC kick is one Atomics.notify: the endpoint drains and presents
//      on its own (doorbellDrains counts it, kicks does not move);
//   3. a SYNC kick from another thread (worker_threads, as a guest Worker)
//      blocks in waitDrained until read_pos reaches write_pos, while this
//      thread's endpoint drains;
//   4. a CLOSE request disarms the ring, so producers fall back to the bridge;
//   5. a ring that never had a consumer reports drained:false, not a hang.
// Node has no OffscreenCanvas, so the endpoint runs the software executor.
const assert = require('assert');
const { Worker } = require('worker_threads');
const GS = require('../lib/gpu-stream');
const Doorbell = require('../lib/gpu-stream-doorbell');
const Endpoint = require('../lib/gpu-stream-render-worker');
const regions = require('../lib/region-map.generated');
const { makeProducer } = require('./gpu-stream-fixture');
const { bootRenderHarness } = require('./render-helper');

const { KIND, FMT, CONST } = GS;
const W = 16, H = 8;
const until = async (cond, label, ms = 5000) => {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error('timed out: ' + label);
    await new Promise(resolve => setTimeout(resolve, 5));
  }
};

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none' });
  const base = regions.BASE.GUEST_HEAP_BASE + 0x200000;
  const p = makeProducer({ buffer: memory.buffer, headerAddr: base,
    ringData: base + 0x1000, ringBytes: 0x4000, arenaData: base + 0x8000, arenaBytes: 0x4000 });
  const i32 = Doorbell.view(memory.buffer, base);
  assert(i32, 'the fixture ring is a GpsRing header');
  assert.strictEqual(Doorbell.armed(i32, base), false, 'a fresh ring has no doorbell consumer');

  const frames = [], events = [];
  const warn = console.warn; console.warn = () => {};
  let scheduled = 0;
  const endpoint = Endpoint.create({ instance: { exports: e }, memory, backend: 'webgl', endpointId: 5,
    options: { api: 'glide' }, sendFrame(frame) { frames.push(frame); },
    send(message) { events.push(message); },
    schedule(fn) { scheduled++; return Promise.resolve().then(fn); } });
  const clear = rgba => p.emit('CLEAR', { mask: 1, colormask: 15, rgba, z: 1, left: 0, top: 0, right: W, bottom: H });
  const present = () => p.emit('PRESENT', { rt: 1, gamma: 0, x: 0, y: 0, w: W, h: H, surface: 3 });
  try {
    // 1. Open by request; the endpoint arms the doorbell.
    p.emit('CREATE', { id: 1, kind: KIND.RT, fmt: FMT.A8B8G8R8, levels: 1, width: W, height: H });
    p.emit('TARGETS', { color: 1, depth: 0 });
    clear(0xff0000ff);
    let reply = endpoint.execute({ t: 'gps-kick', ring: base, mode: CONST.KICK_SYNC });
    assert.strictEqual(reply.result, 1);
    assert.strictEqual(reply.stats.doorbell, true, 'the reply says the doorbell is armed');
    assert.strictEqual(Doorbell.armed(i32, base), true, 'GpsRing.consumer is set');
    assert.strictEqual(Atomics.load(i32, (base >> 2) + Doorbell.W.consumer), 5, 'the token is the endpoint id');

    // 2. ASYNC: one notify, no request.
    clear(0xff00ff00); present();
    assert(!Doorbell.idle(i32, base));
    Doorbell.ring(i32, base);
    await until(() => frames.length === 1, 'doorbell drain presents');
    assert(Doorbell.idle(i32, base), 'the doorbell drain reached write_pos');
    assert.deepStrictEqual(Array.from(frames[0].pixels.subarray(0, 4)), [0, 0xff, 0, 0xff], 'green frame');
    assert.strictEqual(frames[0].kind, 'gps');
    assert.strictEqual(frames[0].api, 'glide', 'frames carry the endpoint api label');
    assert(scheduled >= 1, 'doorbell drains run through the Worker message chain');
    // Several ASYNC kicks coalesce into whatever drains reach write_pos.
    for (const rgba of [0xffff0000, 0xff0000ff, 0xffffffff]) { clear(rgba); present(); Doorbell.ring(i32, base); }
    await until(() => frames.length === 4, 'three more frames');
    assert.deepStrictEqual(Array.from(frames[3].pixels.subarray(0, 4)), [0xff, 0xff, 0xff, 0xff]);

    // 3. SYNC from another thread while this one keeps serving the endpoint.
    clear(0xff336699); present();
    const worker = new Worker(`
      const { parentPort, workerData } = require('worker_threads');
      const Doorbell = require(workerData.lib);
      const i32 = Doorbell.view(workerData.memory.buffer, workerData.ring);
      parentPort.postMessage(Doorbell.waitDrained(i32, workerData.ring));`,
    { eval: true, workerData: { memory, ring: base, lib: require.resolve('../lib/gpu-stream-doorbell') } });
    const result = await new Promise((resolve, reject) => { worker.once('message', resolve); worker.once('error', reject); });
    await worker.terminate();
    assert.strictEqual(result.drained, true, 'SYNC through the doorbell completes');
    assert(Doorbell.idle(i32, base), 'every record published before the SYNC executed');
    await until(() => frames.length === 5, 'SYNC frame delivered');
    assert.deepStrictEqual(Array.from(frames[4].pixels.subarray(0, 4)), [0x99, 0x66, 0x33, 0xff]);
    const s = endpoint.execute({ t: 'gps-kick', ring: base, mode: CONST.KICK_ASYNC }).stats;
    assert.strictEqual(s.kicks, 2, 'only the two requests counted as kicks');
    assert(s.doorbellDrains >= 3, 'doorbell drains did the rest: ' + s.doorbellDrains);
    assert.strictEqual(s.readbacks || 0, 0, 'no readback anywhere: frames are presented, not read');

    // 4. CLOSE disarms; producers then use the bridge.
    reply = endpoint.execute({ t: 'gps-kick', ring: base, mode: CONST.KICK_CLOSE });
    assert.strictEqual(reply.result, 1);
    assert.strictEqual(Doorbell.armed(i32, base), false, 'CLOSE clears GpsRing.consumer');
    assert.deepStrictEqual(events, [], 'no doorbell drain failed');

    // 5. No consumer: a SYNC waiter returns at once instead of hanging.
    clear(0xff000000);
    const lone = Doorbell.waitDrained(i32, base);
    assert.strictEqual(lone.drained, false, 'an unarmed ring falls back');
  } finally { console.warn = warn; endpoint.destroy(); }
  console.log('PASS GPU stream doorbell: request arms, ASYNC notify drains + presents, cross-thread SYNC waits, CLOSE disarms');
})().catch(error => { console.error(error); process.exitCode = 1; });
