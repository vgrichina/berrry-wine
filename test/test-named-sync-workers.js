'use strict';
const assert = require('node:assert/strict');
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');
const RPC = require('../lib/guest-rpc');
if (!isMainThread) {
  const gate = new Int32Array(workerData.gate);
  parentPort.postMessage({ ready: true });
  Atomics.wait(gate, 0, 0);
  parentPort.postMessage({ result: RPC.waitSharedSyncObjects(workerData.memory,
    workerData.handles, workerData.all, 500, workerData.named) });
} else {
  const { ThreadManager } = require('../lib/thread-manager');
  const { NamedSyncNamespace } = require('../lib/named-sync-namespace');
  const namespace = new NamedSyncNamespace();
  function make() {
    const pages = Math.ceil((RPC.SYNC_TABLE + RPC.SYNC_OBJECTS * 16) / 65536);
    const memory = new WebAssembly.Memory({ initial: pages, maximum: pages, shared: true });
    const tm = new ThreadManager({}, memory, { exports: {
      get_sync_table: () => RPC.SYNC_TABLE, get_heap_ptr: () => 0, set_heap_ptr() {},
    } }, () => ({ host: {} }), { syncNamespace: namespace });
    tm._log = () => {};
    return tm;
  }
  async function race(specs) {
    const gate = new SharedArrayBuffer(4), workers = [];
    try {
      const pending = specs.map(spec => {
        const worker = new Worker(__filename, { workerData: {
          ...spec, memory: spec.tm.memory, tm: undefined, gate, named: namespace.buffer,
        } });
        workers.push(worker);
        let readyResolve, resultResolve, rejectBoth;
        const ready = new Promise((resolve, reject) => { readyResolve = resolve; rejectBoth = reject; });
        const result = new Promise((resolve, reject) => {
          resultResolve = resolve;
          const rejectReady = rejectBoth;
          rejectBoth = error => { rejectReady(error); reject(error); };
        });
        worker.on('error', rejectBoth);
        worker.on('message', message => {
          if (message.ready) readyResolve();
          else resultResolve(message.result);
        });
        return { ready, result };
      });
      await Promise.all(pending.map(p => p.ready));
      Atomics.store(new Int32Array(gate), 0, 1);
      Atomics.notify(new Int32Array(gate), 0);
      return await Promise.all(pending.map(p => p.result));
    } finally {
      await Promise.all(workers.map(worker => worker.terminate()));
    }
  }
  (async () => {
    const a = make(), b = make();
    const ha = a.createEvent(false, true, 'auto');
    const hb = b.openEvent('auto');
    assert.equal(RPC.waitSharedSyncObjects(a.memory, [ha], false, 0), null,
      'old/no-buffer worker falls back rather than consuming a proxy as local state');
    assert.deepEqual((await race([{ tm: a, handles: [ha] }, { tm: b, handles: [hb] }])).sort(),
      [0, 0x102], 'two processes compete for one atomic auto-reset signal');
    const ma = a.createEvent(true, true, 'manual'), mb = b.openEvent('manual');
    assert.deepEqual(await race([{ tm: a, handles: [ma] }, { tm: b, handles: [mb] }]), [0, 0]);
    const la = a.createEvent(false, true), lb = b.createEvent(false, true);
    a.setEvent(ha);
    const mixed = await race([
      { tm: a, handles: [la, ha], all: true },
      { tm: b, handles: [lb, hb], all: true },
    ]);
    assert.deepEqual([...mixed].sort(), [0, 0x102]);
    const loser = mixed[0] === 0x102 ? [a, la] : [b, lb];
    assert.equal(loser[0].waitSingle(loser[1], 0), 0,
      'losing mixed wait-all preserves or restores its private event token');
    assert.equal(a.waitSingle(ha, 0), 0x102);
    a.detachSyncNamespace(); b.detachSyncNamespace();
    assert.equal(namespace.objects.size, 0);
    console.log('PASS real workers across separate guest memories: shared auto/manual reset, mixed wait-all and fallback');
  })().catch(error => { console.error(error); process.exitCode = 1; });
}
