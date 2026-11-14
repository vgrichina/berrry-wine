'use strict';
const assert = require('node:assert/strict');
const {ThreadManager} = require('../lib/thread-manager');

// Exercise the production slot allocator and retirement methods without a
// module or Worker: the free result is the native lifetime boundary.
for (const worker of [false, true]) {
  const memory = {buffer: new SharedArrayBuffer(64 * 1024)};
  const manager = new ThreadManager(null, memory,
    {exports: {get_sync_table: () => 0}}, null);
  let busy = true, frees = 0, drops = 0;
  manager.mainInstance = {exports: {guest_map_free(base) {
    assert.equal(base, 0x31000000); frees++; return busy ? 0 : 1;
  }}};
  manager.workerBackend = worker ? {dropThread() { drops++; }} : null;
  manager._maxWorkerThreads = 1;
  manager._pendingThreads = [];
  const thread = {tid: 1, state: 'active', stackAlloc: 0x31000000,
    link: worker ? {_retirementComplete: false} : null};
  manager.threads = new Map([[99, thread]]);
  const alias = manager.duplicateCurrentThread(2);
  assert(alias, 'duplicate names the real thread record');
  manager._dropExitedSlotHandles(1);
  assert.equal(manager._allocWorkerSlot(), 0, 'active thread owns its slot');
  assert.equal(frees, 0, 'active stack cannot be freed');
  assert.equal(drops, 0, 'active Worker cannot be retired by allocation');
  thread.state = 'exited';
  if (worker) {
    assert.equal(manager._allocWorkerSlot(), 0, 'unretired Worker still owns its slot');
    assert.equal(drops, 1); assert.equal(frees, 0);
    assert.throws(() => manager._dropExitedSlotHandles(1), /still retiring/);
    thread.link._retirementComplete = true;
  }
  manager._dropExitedSlotHandles(1);
  assert.equal(manager.threads.get(99), thread, 'busy free retains signaled handle');
  assert.equal(thread.stackAlloc, 0x31000000, 'busy free retains backing ownership');
  assert.equal(manager.closeSyncHandle(alias), true, 'close duplicate handle');
  assert.equal(manager.threads.get(99), thread, 'handle close retains scheduler ownership');
  assert.equal(manager._allocWorkerSlot(), 0, 'busy stack excludes slot reuse');
  busy = false;
  assert.equal(manager._allocWorkerSlot(), 1, 'later retry releases slot');
  assert.equal(thread.stackAlloc, 0);
  assert.equal(manager.threads.size, 0);
  const completedFrees = frees;
  manager._dropExitedSlotHandles(1);
  assert.equal(frees, completedFrees, 'successful free is not repeated');
}
console.log('PASS retired cooperative/Worker stack ownership survives busy free and retries');
