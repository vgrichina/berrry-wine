'use strict';
// Actual OS Worker, host/RPC only. No guest PE or wasm build. Run separately
// under the runtime allocation; the ordinary host test only simulates its pump.
const assert = require('assert');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const RPC = require('../lib/guest-rpc');
const { sigs: allSigs } = require('../lib/host-import-sigs.generated.json');
const sigs = { cmos_io: allSigs.cmos_io };
if (!isMainThread) {
  const rpc = RPC.createWorkerImports({ buffer: workerData.buffer }, sigs,
    message => parentPort.postMessage(message), { slot: 3 });
  const io = rpc.imports.host.cmos_io;
  io(0x70, 0x80, 1);
  assert.strictEqual(io(0x71, 0, 0), 0x56);
  io(0x70, 0x0b, 1); io(0x71, 0x06, 1);
  io(0x70, 0, 1);
  assert.strictEqual(io(0x71, 0, 0), 57);
  parentPort.postMessage({ t: 'done', stats: rpc.stats });
} else {
  process.env.TZ = 'UTC';
  const { createHostImports } = require('../lib/host-imports');
  const memory = { buffer: new SharedArrayBuffer(8192 * 65536) };
  let now = Date.UTC(2000, 0, 1, 12, 34, 56), writes = 0;
  const host = createHostImports({ getMemory: () => memory.buffer, wallNowMs: () => now }).host;
  const raw = host.cmos_io;
  host.cmos_io = (port, value, write) => {
    const result = raw(port, value, write);
    if (port === 0x71 && write) { writes++; now += 1000; }
    return result;
  };
  const broker = RPC.createMainBroker(memory, host, sigs);
  const worker = new Worker(__filename, { workerData: { buffer: memory.buffer } });
  const timer = setTimeout(() => { console.error('CMOS Worker timed out'); worker.terminate(); process.exitCode = 1; }, 10000);
  let complete = false;
  worker.on('message', message => {
    if (message.t === 'rpc') broker.serveRpc(message.slot);
    else if (message.t === 'done') {
      assert.strictEqual(writes, 1);
      assert.strictEqual(message.stats.sync, 6);
      assert.strictEqual(message.stats.local, 0);
      assert.strictEqual(message.stats.async, 0);
      raw(0x70, 0x0b, 1); assert.strictEqual(raw(0x71, 0, 0), 6);
      complete = true;
    }
  });
  worker.on('error', error => { console.error(error); process.exitCode = 1; });
  worker.on('exit', code => {
    clearTimeout(timer);
    if (code !== 0 || !complete) process.exitCode = 1;
    else console.log('CMOS real OS Worker synchronous shared device PASS');
  });
}
