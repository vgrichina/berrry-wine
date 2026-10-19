#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const {ThreadManager} = require('../lib/thread-manager');
const memory = new WebAssembly.Memory({initial: 1, maximum: 1, shared: true});
const manager = new ThreadManager({}, memory, {exports: {get_sync_table: () => 0}}, () => ({}));
manager._log = () => {};
const view = new DataView(memory.buffer), out = 1024;
const capture = (priorityClass = 0x20) => {
  const count = manager.snapshotThreads(out, 16, 42, priorityClass);
  assert(count > 0);
  return Array.from({length: count}, (_, i) => [0, 4, 8]
    .map(offset => view.getInt32(out + i * 12 + offset, true)));
};
assert.deepEqual(capture(), [[1, 42, 8]]);
const handle = manager.createThread(0x401000, 0, 0, 4, 0, 1);
assert(handle);
const pending = manager._pendingThreads[0];
assert.equal(manager.setThreadPriority(handle, 2, 1), 1);
assert.deepEqual(capture(), [[1, 42, 8], [2, 42, 10]], 'pending suspended thread exists');
// The spawn transition may temporarily expose both records. Prefer the live
// record, and never enumerate duplicate handles as duplicate threads.
const active = {...pending, state: 'active', priority: -2};
manager.threads.set(handle, active);
manager._threadHandleAliases.set(0xee000, active);
assert.deepEqual(capture(), [[1, 42, 8], [2, 42, 6]]);
manager._pendingThreads = [];
for (const [cls, expected] of [[0x40, 2], [0x80, 11], [0x100, 22]]) {
  assert.equal(capture(cls)[1][2], expected);
}
for (const [relative, normal, realtime] of [[-15, 1, 16], [15, 15, 31]]) {
  manager.setThreadPriority(handle, relative, 1);
  assert.equal(capture()[1][2], normal);
  assert.equal(capture(0x100)[1][2], realtime);
}
new Uint8Array(memory.buffer, out, 192).fill(0xa5);
assert.equal(manager.snapshotThreads(out, 1, 42, 0x20), -8);
assert.equal(view.getUint32(out, true), 0xa5a5a5a5, 'capacity failure is atomic');
assert.equal(manager.snapshotThreads(65532, 16, 42, 0x20), -87);
assert.equal(manager.snapshotThreads(out, 16, 42, 0x1234), -87);
active.state = 'exited';
assert.deepEqual(capture(), [[1, 42, 8]], 'exited object retained by a handle is absent');
console.log('Toolhelp registry pending/live/aliases/exit/priorities/bounds PASS');
// The same scope predicate is shared by browser parent/children/siblings;
// CLI child callers start excluded before any guest slice or IPC handshake.
const system = {incomplete: false};
const caller = () => new ThreadManager({}, memory, {exports: {get_sync_table: () => 0}},
  () => ({}), {threadSnapshotSystemComplete: () => !system.incomplete});
const parent = caller();
assert.equal(parent.snapshotThreads(out, 16, 42, 0x20), 1);
system.incomplete = true; // launch requested, child not yet initialized
new Uint8Array(memory.buffer, out, 192).fill(0x5a);
for (const manager of [parent, caller(), caller()]) {
  assert.equal(manager.snapshotThreads(out, 16, 42, 0x20), -50);
  assert.equal(view.getUint32(out, true), 0x5a5a5a5a, 'incomplete scope writes nothing');
}
console.log('Toolhelp incomplete parent/pending-child/child/sibling scope fails explicitly PASS');
