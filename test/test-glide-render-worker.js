'use strict';
// tl;dr: the Glide bridge's render-Worker route (lib/gpu-stream-host.js, api 'glide') against a
// fake endpoint. With GPU stream v2 the guest's records already sit in the
// shared ring, so the bridge only posts {t:'gps-kick', ring, mode}: ASYNC
// kicks answer at once, SYNC kicks resolve after every earlier kick ran, kicks
// stay in order, the renderer string from the first reply is retained, worker
// frames reach the window layer (bitmaps released, pixels copied), close
// drains queued kicks before terminating, a CLOSE kick retires the Worker and
// the next kick opens a fresh one, and a failed kick poisons the context.
const assert = require('assert');
// Glide's endpoint is the API-neutral GPU stream bridge under api 'glide'.
const GpuStreamHost = require('../lib/gpu-stream-host');
class Bridge extends GpuStreamHost.Bridge { constructor(options = {}) { super({ ...options, api: 'glide' }); } }

const ASYNC = 0, SYNC = 1, CLOSE = 2, RING = 0x1000;
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const calls = [], endpoints = [], copies = [];
  const win = {}, renderer = { windows: { 7: win }, scheduleRepaint() {} };
  const bridge = new Bridge({ backend: 'webgl', getMemory: () => new SharedArrayBuffer(16),
    renderer, createCanvas: () => ({ width: 0, height: 0, getContext: () => ({
      drawImage(bitmap) { copies.push(bitmap); },
      createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; },
      putImageData(image) { copies.push(image.data.slice()); },
    }) }), createRenderEndpoint(options) {
      assert.deepStrictEqual(options, { api: 'glide', backend: 'webgl' });
      const endpoint = { ready: Promise.resolve(), listener: null, gate: null, terminated: false, first: true,
        addEventListener(type, listener) { assert.strictEqual(type, 'message'); this.listener = listener; },
        request(message) {
          calls.push(message);
          if (this.gate) return this.gate.promise;
          const reply = { result: 1, stats: { kicks: calls.length } };
          if (this.first) { this.first = false; reply.glRenderer = 'ANGLE (test renderer exact string)'; }
          return Promise.resolve(reply);
        },
        terminate() { this.terminated = true; return Promise.resolve(); },
        frame(frame) { this.listener({ data: { t: 'frame', frame } }); },
      };
      endpoints.push(endpoint); return endpoint;
    } });
  return { bridge, calls, endpoints, copies, win };
}

(async () => {
  // Ordering, renderer string, SYNC waits for earlier ASYNC kicks.
  const f = fixture();
  assert.strictEqual(f.bridge.kick(RING, ASYNC), 1, 'an ASYNC kick answers before the Worker exists');
  assert.strictEqual(await f.bridge.kick(RING, SYNC), 1);
  assert.deepStrictEqual(f.calls, [{ t: 'gps-kick', ring: RING, mode: ASYNC }, { t: 'gps-kick', ring: RING, mode: SYNC }]);
  assert.strictEqual(f.bridge.device.glRenderer, 'ANGLE (test renderer exact string)');
  assert.strictEqual(f.bridge.kick(RING, ASYNC), 1);
  await f.bridge.kick(RING, SYNC);
  assert.strictEqual(f.bridge.device.glRenderer, 'ANGLE (test renderer exact string)',
    'later replies retain the renderer queried at open');
  const endpoint = f.endpoints[0];
  endpoint.gate = deferred();
  assert.strictEqual(f.bridge.kick(RING, ASYNC), 1, 'ASYNC never waits for the Worker');
  let syncDone = false;
  const sync = f.bridge.kick(RING, SYNC).then(v => { syncDone = true; return v; });
  await tick();
  assert.strictEqual(syncDone, false, 'SYNC waits for the gated earlier kick');
  assert.strictEqual(f.calls.length, 5, 'kicks are serialized: the SYNC one is not posted yet');
  const gate = endpoint.gate; endpoint.gate = null; gate.resolve({ result: 1 });
  assert.strictEqual(await sync, 1);
  assert.deepStrictEqual(f.calls.map(c => c.mode), [ASYNC, SYNC, ASYNC, SYNC, ASYNC, SYNC]);

  // Worker frames.
  let closed = 0;
  const bitmap = { close() { closed++; } };
  endpoint.frame({ hwnd: 7, width: 2, height: 2, bitmap });
  assert.strictEqual(closed, 1, 'a transferred bitmap is released after the copy');
  assert.strictEqual(f.copies[0], bitmap);
  assert(f.win._gpuFrameLayer);
  const pixels = new Uint8ClampedArray(16).fill(17);
  endpoint.frame({ hwnd: 7, width: 2, height: 2, pixels }); pixels.fill(99);
  assert.deepStrictEqual(Array.from(f.copies[1]), Array(16).fill(17));

  // Teardown drains queued kicks first; close is idempotent.
  endpoint.gate = deferred();
  f.bridge.kick(RING, ASYNC);
  const closing = f.bridge.close();
  await tick();
  assert.strictEqual(endpoint.terminated, false, 'close waits for the queued kick');
  const g2 = endpoint.gate; endpoint.gate = null; g2.resolve({ result: 1 });
  await closing;
  assert.strictEqual(endpoint.terminated, true);
  assert.strictEqual(f.win._gpuFrameLayer, null);
  endpoint.frame({ hwnd: 7, width: 2, height: 2, bitmap });
  assert.strictEqual(closed, 2, 'a late transferred bitmap is still released');

  // A guest CLOSE kick retires the Worker; the next kick opens a new one.
  const c = fixture();
  await c.bridge.kick(RING, SYNC);
  assert.strictEqual(await c.bridge.kick(RING, CLOSE), 1);
  assert.strictEqual(c.endpoints[0].terminated, true);
  await c.bridge.kick(RING, SYNC);
  assert.strictEqual(c.endpoints.length, 2, 'reopen creates a fresh Worker endpoint');
  await c.bridge.close();

  // A failed kick poisons the context.
  const x = fixture();
  await x.bridge.kick(RING, SYNC);
  x.endpoints[0].gate = deferred();
  assert.strictEqual(x.bridge.kick(RING, ASYNC), 1);
  x.endpoints[0].gate.reject(new Error('native raster failure'));
  await tick(); await tick();
  assert.throws(() => x.bridge.kick(RING, ASYNC), /native raster failure/);
  await x.bridge.close();
  assert.strictEqual(x.endpoints[0].terminated, true, 'a poisoned context still terminates its Worker');
  const bad = fixture();
  await bad.bridge.kick(RING, SYNC);
  bad.endpoints[0].frame({ hwnd: 7, width: 0, height: 2, pixels: new Uint8ClampedArray(0) });
  assert.throws(() => bad.bridge.kick(RING, ASYNC), /dimensions/, 'a malformed Worker frame fails the next kick');
  await bad.bridge.close();
  console.log('PASS Glide render-Worker route: kick ordering, SYNC completion, frames, close, reopen, poison');
})().catch(error => { console.error(error); process.exitCode = 1; });
