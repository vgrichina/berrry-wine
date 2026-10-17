'use strict';
// Admitted canonical native regression: fault injection only at transport,
// generation metadata, and termination completion. All guest exports are real.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { CANONICAL, context, dispatch, finish, latch } = require('./test-scoped-dll-endpoints-candidate');
const { BASE } = require('./test-dll-lifecycle-real-pe');

async function scenario(module, fault) {
  const c = await context(module, true), { a: link, host, manager, ex } = c;
  const thread = manager.threads.get(0x7001);
  thread.stackAlloc = link.stackMapped >>> 0;
  assert(thread.stackAlloc, 'actual spawnThread allocated a native stack');
  const stack = thread.stackAlloc;
  manager._maxWorkerThreads = 2;
  manager._log = () => {};
  let frees = 0, terminations = 0, generationAddress, generation;
  // Observe and forward actual guest_map_free; no Wasm export is mocked.
  manager.mainInstance = { exports: { ...ex, guest_map_free(value) {
    assert.equal(value >>> 0, stack); frees++; return ex.guest_map_free(value);
  } } };
  const originalMessage = link._onMessage.bind(link);
  const worker = link.worker, terminate = worker.terminate.bind(worker);
  const entered = latch(), release = latch();
  link._loaderRetireTimeout = 100;
  try {
    if (fault === 'pin') {
      const result = await finish(c, link, await dispatch(link, 601));
      assert(result); assert.equal(c.count(4), 1); assert.equal(c.count(0x24), 1);
      // A fresh missing name forces native LoadLibrary lookup while LIVE
      // providers are pinned, instead of taking the existing-module fast path.
      new Uint8Array(c.memory.buffer, ex.guest_to_wasm(BASE + 0x1500), 11)
        .set(Buffer.from('absent.dll\0'));
      generationAddress = ex.get_dll_lifecycle_table() + 4;
      generation = c.view.getUint32(generationAddress, true);
      assert(generation);
    }
    const pending = await dispatch(link, 602);
    assert.equal(pending.yield, 5, 'real WndProc reaches native LoadLibrary lookup');
    assert((await link.scopedThreadSendLoader(pending)).ready);
    const held = c.gate(); assert(held[0]); assert.equal(held[1], 1);
    if (fault === 'pin') {
      assert.equal(c.view.getUint32(generationAddress + 8, true), 1);
      c.view.setUint32(generationAddress, generation + 1, true);
    } else link._onMessage = msg => { if (msg.t !== 'scopedLoadersRetired') originalMessage(msg); };
    link.slice = async () => { throw new Error('injected scheduler slice transport failure'); };
    await manager._runWorkerThread(0x7001, thread, 1, {});
    assert.equal(thread.state, 'exited');
    const failure = fault === 'pin' ? /generation pin/ : /did not answer retireScopedLoaders/;
    await assert.rejects(link.stop(), failure);
    assert(host._retirementLinks?.has(link), 'scheduler drop retains failed owner');
    assert.equal(manager._allocWorkerSlot(), 0, 'unconfirmed native owner reserves tid');
    assert.throws(() => manager._dropExitedSlotHandles(1), /still retiring/);
    assert.equal(frees, 0); assert.equal(thread.stackAlloc, stack);
    await assert.rejects(host.stop(), failure);
    await assert.rejects(host.stop(), failure);
    assert(host._retirementLinks.has(link)); assert.equal(link.worker, worker);
    if (fault === 'pin') {
      assert.deepEqual(c.gate(), held);
      assert.equal(c.view.getUint32(generationAddress + 8, true), 1);
      c.view.setUint32(generationAddress, generation, true);
    }
    link._onMessage = originalMessage;
    worker.terminate = async () => { terminations++; entered.release(); await release.promise; return terminate(); };
    const stopping = host.stop();
    await entered.promise;
    assert(link._loaderRetirementReceipt.retired);
    assert.equal(manager._allocWorkerSlot(), 0, 'receipt cannot release native tid before termination');
    assert.throws(() => manager._dropExitedSlotHandles(1), /still retiring/);
    assert.equal(frees, 0); assert.equal(link.worker, worker);
    release.release(); await stopping;
    assert.deepEqual(c.gate(), [0, 0]);
    if (fault === 'pin') assert.equal(c.view.getUint32(generationAddress + 8, true), 0);
    assert.equal(link.worker, null); assert.equal(terminations, 1);
    assert.equal(manager._allocWorkerSlot(), 1);
    manager._dropExitedSlotHandles(1); manager._dropExitedSlotHandles(1);
    await host.stop(); await host.dropThread(link);
    assert.equal(frees, 1); assert.equal(terminations, 1);
    console.log(`PASS canonical native scheduler retirement ${fault}: reserved tid/stack, retry, exact-once release`);
  } finally {
    link._onMessage = originalMessage;
    if (generationAddress) c.view.setUint32(generationAddress, generation, true);
    release.release(); worker.terminate = terminate;
    // Independently retain the exact link even under the old-drop control,
    // whose inventory deliberately loses it. Cleanup never hides assertions.
    await link.stop(); await host.stop();
  }
}

async function main() {
  assert(process.env.WA_TEST_WASM);
  const bytes = fs.readFileSync(process.env.WA_TEST_WASM);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), CANONICAL);
  const module = await WebAssembly.compile(bytes);
  for (const fault of ['timeout', 'pin']) await scenario(module, fault);
}
const deadline = setTimeout(() => { console.error('Native retirement exceeded 60 seconds'); process.exit(2); }, 60000);
deadline.unref();
main().then(() => clearTimeout(deadline), error => { console.error(error); process.exitCode = 1; });
