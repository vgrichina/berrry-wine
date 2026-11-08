'use strict';
const assert = require('assert');
const { Bridge } = require('../lib/glide-host');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture(memoryBytes = 4096) {
  const memory = new ArrayBuffer(memoryBytes), calls = [], endpoints = [], copies = [];
  const view = new DataView(memory);
  [7, 2, 2, 0, 0].forEach((v, i) => view.setUint32(i * 4, v, true));
  const win = {}, renderer = { windows: { 7: win }, scheduleRepaint() {} };
  const bridge = new Bridge({ backend: 'webgl', getMemory: () => memory,
    renderer, createCanvas: () => ({ width: 0, height: 0, getContext: () => ({
      drawImage(bitmap) { copies.push(bitmap); },
      createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; },
      putImageData(image) { copies.push(image.data.slice()); },
    }) }), createRenderEndpoint(options) {
      assert.deepStrictEqual(options, { api: 'glide', backend: 'webgl' });
      const endpoint = { ready: Promise.resolve(), listener: null, gate: null, terminated: false,
        addEventListener(type, listener) { assert.strictEqual(type, 'message'); this.listener = listener; },
        request(message) {
          calls.push({ ...message, rawBytes: message.bytes, bytes: message.bytes.slice() });
          if (message.op === 9) {
            // The actual consumer returns the same view, including SAB-backed
            // packets. Readback must finish before its lease can be recycled.
            const bytes = message.bytes; bytes.fill(0xa7, 20);
            return Promise.resolve({ result: 1, bytes });
          }
          if (message.op === 0 && this.gate) return this.gate.promise;
          return Promise.resolve({ result: 1, ...(message.op === 1
            ? { glRenderer: 'ANGLE (test renderer exact string)' } : {}), stats: { draws: calls.length } });
        },
        terminate() { this.terminated = true; return Promise.resolve(); },
        frame(frame) { this.listener({ data: { t: 'frame', frame } }); },
      };
      endpoints.push(endpoint); return endpoint;
    } });
  return { bridge, memory, calls, endpoints, copies, win };
}

(async () => {
  const published=fixture();await published.bridge.submit(1,0,20);
  const owned=new Uint8Array([0,0,61,62,63,64,0]);
  assert.strictEqual(await published.bridge.submitOwned(owned.subarray(2,6)),1);
  owned.fill(99);await new Promise(resolve=>setImmediate(resolve));
  assert.deepStrictEqual([...published.calls[1].bytes],[61,62,63,64],
    'published Glide input uses its owned buffer and offset, not WASM memory');
  await published.bridge.close();
  const f = fixture();
  assert.strictEqual(await f.bridge.submit(1, 0, 20), 1);
  assert.strictEqual(f.bridge.device.glRenderer, 'ANGLE (test renderer exact string)');
  const endpoint = f.endpoints[0];
  const bytes = new Uint8Array(f.memory); bytes.set([11, 22, 33, 44], 100);
  endpoint.gate = deferred();
  const command = f.bridge.submit(0, 100, 4);
  bytes.fill(99, 100, 104);
  // Close immediately, before the command's Promise has posted to the port.
  // It must drain that owned packet before sending close, not invalidate it.
  const closing = f.bridge.close();
  assert.strictEqual(f.bridge.close(), closing);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepStrictEqual(f.calls.map(c => c.op), [1, 0]);
  assert.deepStrictEqual(Array.from(f.calls[1].bytes), [11, 22, 33, 44]);
  assert(f.calls[1].rawBytes.buffer instanceof SharedArrayBuffer,
    'draw packets share pooled storage across the worker boundary');
  assert.strictEqual(endpoint.terminated, false);
  endpoint.gate.resolve({ result: 1 });
  assert.strictEqual(await command, 1); await closing;
  assert.deepStrictEqual(f.calls.map(c => c.op), [1, 0, 2]);
  assert.strictEqual(endpoint.terminated, true);

  await f.bridge.submit(1, 0, 20);
  const live = f.endpoints[1];
  bytes.fill(0, 200, 228);
  assert.strictEqual(await f.bridge.submit(9, 200, 28), 1);
  assert.strictEqual(f.bridge.device.glRenderer, 'ANGLE (test renderer exact string)',
    'later replies must retain the renderer queried at open');
  assert.deepStrictEqual(Array.from(bytes.slice(220, 228)), Array(8).fill(0xa7));
  let closed = 0;
  const bitmap = { close() { closed++; } };
  live.frame({ hwnd: 7, width: 2, height: 2, bitmap });
  assert.strictEqual(closed, 1);
  assert.strictEqual(f.copies[0], bitmap);
  assert(f.win._gpuFrameLayer);
  const pixels = new Uint8ClampedArray(16).fill(17);
  live.frame({ hwnd: 7, width: 2, height: 2, pixels }); pixels.fill(99);
  assert.deepStrictEqual(Array.from(f.copies[1]), Array(16).fill(17));
  await f.bridge.close();
  assert.strictEqual(f.win._gpuFrameLayer, null);
  live.frame({ hwnd: 7, width: 2, height: 2, bitmap });
  assert.strictEqual(closed, 2, 'late transferred bitmap must be released');

  // Swaps are pipelined one frame deep: the first answers at once, the next
  // waits only for the previous swap, never for its own.
  const piped = fixture(); await piped.bridge.submit(1, 0, 20);
  const pipe = piped.endpoints[0];
  pipe.gate = deferred(); const firstGate = pipe.gate;
  assert.strictEqual(piped.bridge.submit(0, 100, 4), 1, 'a draw batch answers before it is drawn');
  assert.strictEqual(piped.bridge.submit(4, 100, 4), 1, 'the first swap answers before it is drawn');
  const second = piped.bridge.submit(4, 100, 4);
  assert(second && typeof second.then === 'function', 'the second swap waits for the first');
  let secondDone = false; second.then(() => { secondDone = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.strictEqual(secondDone, false);
  pipe.gate = null; firstGate.resolve({ result: 1 });
  assert.strictEqual(await second, 1);
  await piped.bridge.close();

  // Admission reserves before snapshot: a fourth packet waits while three
  // immutable snapshots occupy the pool, even though only one reached the port.
  const bounded = fixture(); await bounded.bridge.submit(1, 0, 20);
  const boundedEndpoint = bounded.endpoints[0], source = new Uint8Array(bounded.memory);
  boundedEndpoint.gate = deferred(); const gate = boundedEndpoint.gate;
  const firstPool = bounded.bridge.workerPacketBuffer;
  for (let i = 0; i < 3; i++) {
    source.fill(i + 1, 100 + i * 4, 104 + i * 4);
    assert.strictEqual(bounded.bridge.submit(i === 2 ? 10 : 0, 100 + i * 4, 4), 1);
    source.fill(99, 100 + i * 4, 104 + i * 4);
  }
  source.fill(4, 112, 116);
  let admitted = false;
  const fourth = bounded.bridge.submit(0, 112, 4).then(value => { admitted = true; return value; });
  await new Promise(resolve => setImmediate(resolve));
  assert.strictEqual(admitted, false);
  assert.strictEqual(bounded.bridge.workerPacketFree.length, 0);
  assert.strictEqual(bounded.bridge.workerSubmissions.waiters.length, 1);
  assert.strictEqual(bounded.calls.length, 2, 'only open and first serialized draw reached the endpoint');
  assert.deepStrictEqual(Array.from(bounded.calls[1].rawBytes), [1, 1, 1, 1]);
  const drain = bounded.bridge.close();
  assert.throws(() => bounded.bridge.submit(0, 112, 4), /without an open context|closing/);
  boundedEndpoint.gate = null; gate.resolve({ result: 1 });
  assert.strictEqual(await fourth, 1);
  await drain;
  assert.deepStrictEqual(bounded.calls.map(c => c.op), [1, 0, 0, 10, 0, 2], 'close drains waiting admissions before destruction');
  assert.deepStrictEqual(bounded.calls.slice(1, 5).map(c => Array.from(c.bytes)),
    [[1, 1, 1, 1], [2, 2, 2, 2], [3, 3, 3, 3], [4, 4, 4, 4]]);
  await bounded.bridge.submit(1, 0, 20);
  assert.notStrictEqual(bounded.bridge.workerPacketBuffer, firstPool, 'new context gets a fresh canonical SAB owner');
  await bounded.bridge.close();

  // Oversized LFB data cannot build a second unbounded queue. It reserves all
  // credits and acknowledges only after execution, keeping its own bytes alive.
  const large = fixture(2 * 1024 * 1024); await large.bridge.submit(1, 0, 20);
  const largeEndpoint = large.endpoints[0]; largeEndpoint.gate = deferred();
  const largeGate = largeEndpoint.gate, length = 1024 * 1024 + 4;
  new Uint8Array(large.memory, 100, length).fill(0x37);
  let largeDone = false;
  const largeCall = large.bridge.submit(0, 100, length).then(value => { largeDone = true; return value; });
  await new Promise(resolve => setImmediate(resolve));
  assert.strictEqual(largeDone, false);
  assert.strictEqual(large.bridge.workerPacketFree.length, 0);
  assert(large.calls[1].rawBytes.buffer instanceof ArrayBuffer, 'oversized fallback is an owned synchronous packet');
  new Uint8Array(large.memory, 100, length).fill(0x99);
  assert(large.calls[1].rawBytes.every(value => value === 0x37));
  largeEndpoint.gate = null; largeGate.resolve({ result: 1 });
  assert.strictEqual(await largeCall, 1);
  await large.bridge.close();

  // A pipelined batch that fails poisons the context: the next call and the
  // close both raise it.
  const failed = fixture(); await failed.bridge.submit(1, 0, 20);
  failed.endpoints[0].gate = deferred();
  assert.strictEqual(failed.bridge.submit(0, 100, 4), 1);
  assert.strictEqual(failed.bridge.submit(0, 104, 4), 1);
  assert.strictEqual(failed.bridge.submit(0, 108, 4), 1);
  const rejectedAdmission = assert.rejects(failed.bridge.submit(0, 112, 4), /native raster failure/);
  failed.endpoints[0].gate.reject(new Error('native raster failure'));
  await rejectedAdmission;
  await new Promise(resolve => setImmediate(resolve));
  assert.strictEqual(failed.bridge.workerPacketFree.length, 0, 'failed consumers quarantine every reserved slot');
  assert.throws(() => failed.bridge.submit(0, 100, 4), /native raster failure/);
  await assert.rejects(failed.bridge.close(), /native raster failure/);
  assert.strictEqual(failed.endpoints[0].terminated, true);
  assert.strictEqual(failed.bridge.workerPacketPool, null, 'quarantine retires only after endpoint termination');
  console.log('PASS Glide shared render endpoint ownership, ordering, readback and teardown');
})().catch(error => { console.error(error); process.exitCode = 1; });
