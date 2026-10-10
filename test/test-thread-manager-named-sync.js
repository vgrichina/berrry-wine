'use strict';
const assert = require('node:assert/strict');
const { ThreadManager } = require('../lib/thread-manager');
const { NamedSyncNamespace } = require('../lib/named-sync-namespace');
const namespace = new NamedSyncNamespace();
function make() {
  const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
  const manager = new ThreadManager({}, memory, { exports: {
    get_sync_table: () => 0, get_heap_ptr: () => 0, set_heap_ptr() {},
  } }, () => ({ host: {} }), { syncNamespace: namespace });
  manager._log = () => {};
  return manager;
}
const a = make(), b = make();
const h = a.createEvent(false, false, 'Ion Game Mutex');
const opened = b.openEvent('Ion Game Mutex');
assert.notEqual(opened, 0);
const created = b.createEvent(true, true, 'Ion Game Mutex');
assert.ok(created >>> 31, 'existing event supplies ALREADY_EXISTS tag');
const second = created & 0x7fffffff;
assert.notEqual(opened, second, 'each open gets its own process handle');
assert.equal(b.waitSingle(second, 0), 0x102);
assert.equal(a.syncView[a._getSyncIdx(h) * 4 + 1], 4,
  'broker proxy is not a worker-consumable local event');
assert.equal(b.createMutex(false, 'Ion Game Mutex'), 0x80000000);
b.setEvent(opened);
assert.equal(a.waitSingle(h, 0), 0);
assert.equal(b.waitSingle(second, 0), 0x102);
assert.equal(b.waitSingle(second, 100), 0xffff, 'blocking wait yields until shared signal');

// Mixed wait-all must not consume the shared event when the local event is
// not ready. This is a serialized control, not a concurrent worker proof.
const local = a.createEvent(false, false, null);
const handlesWA = 65520;
const handles = new Uint32Array(a.memory.buffer, handlesWA, 2);
handles.set([h, local]);
b.setEvent(second);
assert.equal(a.waitMultiple(2, handlesWA, 1, 0), 0x102);
assert.equal(namespace.ready(a, a._sharedSyncObjects.get(a._getSyncIdx(h))), true);
a.setEvent(local);
assert.equal(a.waitMultiple(2, handlesWA, 1, 0), 0);
assert.equal(b.waitSingle(second, 0), 0x102);
assert.equal(a.waitSingle(local, 0), 0x102);
assert.equal(b.closeSyncHandle(opened), true);
b.setEvent(second);
assert.equal(a.waitSingle(h, 0), 0, 'closing one alias leaves the other live');
a.detachSyncNamespace();
assert.equal(b.setEvent(second), 1, 'event survives creator process cleanup');
assert.equal(b.waitSingle(second, 0), 0);
b.detachSyncNamespace();
assert.equal(namespace.objects.size, 0);

const m = a.createMutex(true, 'mutex', 1), mb = b.openMutex('mutex');
assert.equal(b.waitSingle(mb, 0, 1), 0x102);
assert.equal(b.releaseMutex(mb, 1), 0, 'process identity distinguishes identical thread IDs');
a.detachSyncNamespace();
assert.equal(b.waitSingle(mb, 0, 1), 0x80);
assert.equal(b.releaseMutex(mb, 1), 1);
const s = a.createSemaphore(0, 2, 'semaphore'), sb = b.openSemaphore('semaphore');
assert.equal(b.releaseSemaphore(sb, 3, 0), 0);
assert.equal(b.releaseSemaphore(sb, 2, 65528), 1);
assert.equal(new Uint32Array(b.memory.buffer)[65528 / 4], 0);
assert.equal(a.waitSingle(s, 0), 0);
assert.equal(b.waitSingle(sb, 0), 0);
assert.equal(a.waitSingle(s, 0), 0x102);
a.detachSyncNamespace(); b.detachSyncNamespace();
assert.equal(namespace.objects.size, 0);
console.log('PASS two ThreadManagers share named objects through process-local broker handles');
console.log('Pending: concurrent mixed waits, browser lifecycle wiring, CLI transport, original game');
