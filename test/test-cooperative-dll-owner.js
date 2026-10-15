#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { ThreadManager } = require('../lib/thread-manager');
function makeThreadManager() {
  const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
  const manager = new ThreadManager({}, memory, { exports: { get_sync_table: () => 0 } }, () => ({ host: {} }));
  manager._log = () => {};
  return manager;
}

// FreeLibraryAndExitThread finishes through the actual asynchronous DLL service
// after runSlice has cleared its owner. A pending callback gate deliberately
// leaves time for another caller; no global owner may leak across that await.
(async () => {
  const { serviceDllUnloadAsync } = require('../lib/dll-loader');
  const manager = makeThreadManager();
  manager._runningThreadHandle = 0;
  const handleA = 0xe1000, handleB = 0xe1001;
  let kind = 2, yieldReason = 5;
  const gate = new Int32Array(manager.memory.buffer, 64, 2);
  const caller = { state: 'active', instance: { exports: {
    memory: manager.memory,
    take_dll_unload_kind: () => { const value = kind; kind = 0; return value; },
    get_dll_unload_module: () => 0x500000,
    get_dll_unload_exit_code: () => 73,
    get_dll_callback_lock: () => 64,
    get_dll_callback_owner: () => 2,
    get_dll_lifecycle_table: () => 128,
    get_dll_lifecycle_stride: () => 64,
    get_dll_index: () => -1,
    release_synthetic_dll_reference: () => 0,
    get_yield_reason: () => yieldReason,
    exit_thread_after_dll_unload: code => { manager.exitThread(code); yieldReason = 2; },
    fail: () => { throw new Error('callback trap'); },
  } } };
  const other = { state: 'active', instance: { exports: {
    exit: code => manager.exitThread(code),
  } } };
  manager.threads.set(handleA, caller); manager.threads.set(handleB, other);
  const owned = manager.cooperativeCallbackExports(caller);
  const otherOwned = manager.cooperativeCallbackExports(other);
  Atomics.store(gate, 0, 99);
  const pending = serviceDllUnloadAsync({ exports: owned, memoryBuffer: manager.memory.buffer });
  assert.strictEqual(manager._runningThreadHandle, 0, 'await does not retain caller ownership');
  otherOwned.exit(19);
  assert.strictEqual(other.exitCode, 19, 'interleaved exit belongs to its own caller');
  assert.strictEqual(caller.exitCode, undefined);
  const release = setTimeout(() => { Atomics.store(gate, 0, 0); Atomics.notify(gate, 0); }, 5);
  try { assert.deepStrictEqual(await pending, { terminal: true, valid: false }); }
  finally { clearTimeout(release); }
  assert.strictEqual(caller.exitCode, 73, 'actual async loader completion records exit code on its caller');
  assert.strictEqual(other.exitCode, 19);
  assert.strictEqual(manager._runningThreadHandle, 0);
  manager._runningThreadHandle = handleB;
  assert.throws(() => owned.fail(), /callback trap/);
  assert.strictEqual(manager._runningThreadHandle, handleB, 'exception restores prior owner');
  caller.instance.exports.nested = () => {
    assert.strictEqual(manager._runningThreadHandle, handleA);
    otherOwned.exit(23);
    assert.strictEqual(manager._runningThreadHandle, handleA, 'nested call restores outer owner');
  };
  owned.nested();
  assert.strictEqual(manager._runningThreadHandle, handleB);
  const retained = owned.exit_thread_after_dll_unload;
  for (const state of ['exited', 'retiring']) {
    caller.state = state;
    assert.throws(() => retained(99), /caller retired/);
  }
  caller.state = 'active';
  manager.threads.set(handleA, { state: 'active', instance: caller.instance });
  assert.throws(() => retained(99), /caller retired/, 'same handle cannot redirect an old callback');
  manager.threads.set(handleA, caller);
  caller.instance = { exports: caller.instance.exports };
  assert.throws(() => retained(99), /caller retired/, 'replacement instance invalidates old callbacks');
  assert.strictEqual(caller.exitCode, 73);
  assert.strictEqual(manager._runningThreadHandle, handleB);
  // A thread can retire while the host awaits another callback owner. The
  // retained service must reject it before invoking any resumed guest export.
  kind = 2; yieldReason = 5;
  const fresh = manager.cooperativeCallbackExports(caller);
  Atomics.store(gate, 0, 99);
  const retiredPending = serviceDllUnloadAsync({ exports: fresh, memoryBuffer: manager.memory.buffer });
  caller.state = 'exited';
  const releaseRetired = setTimeout(() => { Atomics.store(gate, 0, 0); Atomics.notify(gate, 0); }, 5);
  try { await assert.rejects(retiredPending, /caller retired/); }
  finally { clearTimeout(releaseRetired); }
  assert.strictEqual(caller.exitCode, 73);
  assert.strictEqual(manager._runningThreadHandle, handleB);
  console.log('PASS  ThreadManager async DLL completion owns only synchronous calls and rejects retired callers');
})().catch(error => { console.error(error); process.exitCode = 1; });
