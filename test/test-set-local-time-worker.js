'use strict';
// Real OS Worker / synchronous broker control, only under runtime allocation.
const assert = require('node:assert/strict');
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');
const RPC = require('../lib/guest-rpc');
const { sigs: allSigs } = require('../lib/host-import-sigs.generated.json');
const sigs = { wall_clock: allSigs.wall_clock };
if (!isMainThread) {
  const rpc = RPC.createWorkerImports({ buffer: workerData.buffer }, sigs,
    message => parentPort.postMessage(message), { slot: 3 });
  assert.equal(rpc.imports.host.wall_clock(256, 4), 1);
  assert.equal(rpc.imports.host.wall_clock(512, 0), 1);
  parentPort.postMessage({ t: 'done', stats: rpc.stats });
} else {
  process.env.TZ = 'UTC';
  const { createHostImports } = require('../lib/host-imports');
  const memory = { buffer: new SharedArrayBuffer(8192 * 65536) };
  const dv = new DataView(memory.buffer);
  [2000, 2, 65535, 29, 12, 34, 56, 789].forEach((v, i) => dv.setUint16(256 + i * 2, v, true));
  const now = Date.UTC(2024, 0, 1);
  const ctx = { getMemory: () => memory.buffer, wallNowMs: () => now };
  const host = createHostImports(ctx).host;
  const broker = RPC.createMainBroker(memory, host, sigs);
  const worker = new Worker(__filename, { workerData: { buffer: memory.buffer } });
  const timer = setTimeout(() => { console.error('SetLocalTime Worker timed out'); worker.terminate(); process.exitCode = 1; }, 10000);
  let complete = false;
  worker.on('message', message => {
    if (message.t === 'rpc') broker.serveRpc(message.slot);
    else if (message.t === 'done') {
      assert.equal(message.stats.sync, 2); assert.equal(message.stats.local, 0); assert.equal(message.stats.async, 0);
      assert.equal(ctx.calendarClock.now(), Date.UTC(2000, 1, 29, 12, 34, 56, 789));
      assert.equal(host.wall_clock(768, 0), 1);
      assert.deepEqual(new Uint8Array(memory.buffer, 512, 16), new Uint8Array(memory.buffer, 768, 16));
      host.cmos_io(0x70, 0, 1); assert.equal(host.cmos_io(0x71, 0, 0), 0x56);
      complete = true;
    }
  });
  worker.on('error', error => { console.error(error); process.exitCode = 1; });
  worker.on('exit', code => {
    clearTimeout(timer);
    if (code !== 0 || !complete) process.exitCode = 1;
    else console.log('SetLocalTime real OS Worker synchronous calendar/CMOS PASS');
  });
}
