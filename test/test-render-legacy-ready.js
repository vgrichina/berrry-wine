'use strict';
const assert = require('assert');
const { Worker } = require('worker_threads');
const { CTRL, Encoder } = require('../lib/d3d-command-stream');
const { SharedPacketPool, SubmissionQueue } = require('../lib/render-worker');

function packetOwnership(EncoderClass = Encoder) {
  const messages = [];
  let failPost = false;
  const encoder = new EncoderClass({bufferCount: 2, getImageBase: () => 0x400000,
    workerFactory: () => ({postMessage(message) {
      if (failPost && message.t === 'batch') throw new Error('publication failed');
      messages.push(message);
    }, terminate() {}})});
  Atomics.store(encoder.control, CTRL.READY, 1);
  const [first, second] = encoder.buffers;
  first.used = 32; first.commands = 1; first.bytes[0] = 91;
  const seq1 = encoder.publish();
  assert.equal(Atomics.load(encoder.control, CTRL.COMPLETED), 0,
    'exit publication admits buffered draws without waiting for GPU completion');
  assert.strictEqual(first.lease.buffer, first.buffer, 'pool adopts the existing SAB without copying');
  assert.equal(first.lease.bytes, 32);
  assert.equal(new Uint8Array(first.lease.buffer)[0], 91);
  assert.throws(() => encoder._packetPool.claim(first, 0, 1), /busy/);
  second.used = 32; second.commands = 1;
  const seq2 = encoder._submit();
  assert.equal(seq2, seq1 + 1);
  assert.equal(messages.filter(m => m.t === 'batch').length, 2);
  assert.equal(encoder.publish(), seq2, 'exit publication does not resubmit a rotated stale slot');
  const lease1 = first.lease;
  Atomics.store(encoder.control, CTRL.ERROR, 1);
  assert.equal(encoder._acquire(), null, 'failed incomplete consumer cannot return write storage');
  assert.strictEqual(first.lease, lease1);
  assert.throws(() => encoder._packetPool.unregister(first), /active/);
  Atomics.store(encoder.control, CTRL.ERROR, 0);
  Atomics.store(encoder.control, CTRL.COMPLETED, seq1);
  assert.strictEqual(encoder._acquire(), first);
  assert.equal(first.lease, null);
  assert.equal(first.used, 0);
  assert.throws(() => encoder._packetPool.release(lease1), /stale/);
  assert(second.lease, 'completion of first slot does not release the second');
  first.used = 16; first.commands = 1;
  failPost = true;
  assert.throws(() => encoder._submit(), /publication failed/);
  assert(first.lease, 'publication exception conservatively retains ownership');
  assert.throws(() => encoder._packetPool.claim(first, 0, 1), /busy/);
  Atomics.store(encoder.control, CTRL.COMPLETED, encoder.lastSubmitted);
  encoder._acquire();
  encoder.current = 1;
  encoder._acquire();
  assert.equal(second.lease, null);
}

function browserDependencyOrder() {
  const vm = require('vm'), fs = require('fs');
  const context = vm.createContext({ SharedArrayBuffer, ArrayBuffer, Uint8Array, Int32Array,
    DataView, Atomics, performance });
  vm.runInContext(fs.readFileSync(require.resolve('../lib/d3d-command-stream'), 'utf8'), context);
  assert(context.D3DCommandStream, 'stream module loads before RenderWorker');
  context.RenderWorker = { SharedPacketPool, SubmissionQueue };
  packetOwnership(context.D3DCommandStream.Encoder);
}

// A real parked producer: its event loop cannot deliver render error events.
// The main thread must wake startup and fence waits through shared control.
async function probe(mode) {
  const worker = new Worker(`
    const { parentPort, workerData } = require('worker_threads');
    const { Encoder } = require(workerData.module);
    const encoder = new Encoder({ strictReady: true, explicitFence: true,
      readyTimeoutMs: 2000, workerFactory: () => ({
        postMessage: message => parentPort.postMessage(message), terminate() {}
      }) });
    try {
      const result = encoder.call(0x20002, 0);
      if (workerData.mode === 'fence-error') encoder.fence();
      parentPort.postMessage({ t: 'result', result, fallbacks: encoder.stats.fallbacks });
    } catch (error) { parentPort.postMessage({ t: 'result', error: error.message,
      fallbacks: encoder.stats.fallbacks }); }
  `, { eval: true, workerData: { mode, module: require.resolve('../lib/d3d-command-stream') } });
  let control, released = false, timer;
  try {
    return await new Promise((resolve, reject) => {
      const deadline = setTimeout(() => reject(new Error(mode + ' producer hung')), 4000);
      const finish = (error, result) => {
        clearTimeout(deadline); error ? reject(error) : resolve(result);
      };
      worker.on('error', error => finish(error));
      worker.on('message', message => {
        if (message.t === 'init') {
          control = new Int32Array(message.control);
          timer = setTimeout(() => {
            released = true;
            Atomics.store(control, mode === 'startup-error' ? CTRL.ERROR : CTRL.READY, 1);
            Atomics.notify(control, CTRL.READY);
          }, 40);
        } else if (message.t === 'legacy-fence') {
          Atomics.store(control, CTRL.ERROR, 1);
          Atomics.notify(control, CTRL.COMPLETED);
        } else if (message.t === 'result') {
          if (!released) return finish(new Error('Producer returned local fallback before READY'));
          finish(null, message);
        }
      });
    });
  } finally { clearTimeout(timer); await worker.terminate(); }
}
(async () => {
  packetOwnership();
  browserDependencyOrder();
  const ready = await probe('ready');
  assert.strictEqual(ready.result, 1); assert.strictEqual(ready.fallbacks, 0);
  for (const mode of ['startup-error', 'fence-error']) {
    const failed = await probe(mode);
    assert.match(failed.error, /Shared render worker failed/);
    assert.strictEqual(failed.fallbacks, 0);
  }
  console.log('PASS shared legacy startup and fence waits fail without local fallback');
})().catch(error => { console.error(error); process.exitCode = 1; });
