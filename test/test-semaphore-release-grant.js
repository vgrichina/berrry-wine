#!/usr/bin/env node
// Windows satisfies a parked wait AT ReleaseSemaphore: the released unit goes
// to the waiter, so the releaser's own next wait blocks. The cooperative
// scheduler polls parked waiters only later, and a releaser that waited again
// in the same slice used to take the unit straight back every time. Dungeon
// Keeper's render thread does exactly that each frame around its cursor lock;
// its window thread's WaitForSingleObject(lock, 5) always timed out and the
// page cursor never moved.

const assert = require('assert');
const { ThreadManager } = require('../lib/thread-manager');

function makeTm() {
  const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
  const mainInstance = { exports: { get_sync_table: () => 0, get_heap_ptr: () => 0, set_heap_ptr: () => {} } };
  const tm = new ThreadManager({}, memory, mainInstance, () => ({ host: {} }), {});
  tm._log = () => {};
  return tm;
}

// A worker parked in WaitForSingleObject(handle, timeout) (yield reason 1,
// 12 stack bytes, no handle array), recording how its wait completed.
function parkedWorker(tm, threadHandle, tid, waitHandle, timeout, completions) {
  let yieldReason = 1;
  const thread = {
    tid, state: 'active', sleepCount: 0, sleepUntil: 0, waitPolls: 0, waitStartedAt: 0,
    instance: { exports: {
      get_yield_reason: () => yieldReason,
      clear_yield: () => { yieldReason = 0; },
      get_wait_handle: () => waitHandle,
      get_wait_handles_ptr: () => 0,
      get_wait_stack_bytes: () => 12,
      get_wait_timeout: () => timeout,
      get_current_thread_id: () => tid,
      get_eip: () => 0x401000, get_bp_addr: () => 0, get_sleep_yielded: () => 0,
      get_heap_ptr: () => 0, set_heap_ptr: () => {}, get_free_list: () => 0, set_free_list: () => {},
      run: () => {},
    } },
  };
  tm.threads.set(threadHandle, thread);
  return { thread, completions };
}

const tm = makeTm();
const completions = [];
tm._completeWait = (e, result) => { completions.push(result); e.clear_yield(); return 0x402000; };
const lock = tm.createSemaphore(0, 1);
parkedWorker(tm, 0xe1000, 2, lock, 5, completions);

// The holder releases and immediately waits again, inside one slice.
assert.strictEqual(tm.releaseSemaphore(lock, 1, 0), 1, 'release succeeds');
assert.strictEqual(tm.waitSingle(lock, 0, 1), 0x102,
  'the releaser cannot take the unit back: it already belongs to the parked waiter');
tm.runSlice(100);
assert.deepStrictEqual(completions, [0], 'the parked waiter completes with WAIT_OBJECT_0');
assert.strictEqual(tm.waitSingle(lock, 0, 1), 0x102, 'the granted unit was consumed exactly once');
console.log('PASS  a release goes to the parked waiter before the releaser can wait again');

// No waiter: the count rises as before and the releaser can take it.
const tm2 = makeTm();
const sem = tm2.createSemaphore(0, 2);
assert.strictEqual(tm2.releaseSemaphore(sem, 1, 0), 1);
assert.strictEqual(tm2.waitSingle(sem, 0, 1), 0, 'with nobody parked the releaser takes the unit');
console.log('PASS  with no parked waiter the released count is available as before');

// A release of N grants at most N waiters; the rest keep waiting.
const tm3 = makeTm();
const done3 = [];
tm3._completeWait = (e, result) => { done3.push(result); e.clear_yield(); return 0x402000; };
const pool = tm3.createSemaphore(0, 4);
parkedWorker(tm3, 0xe1000, 2, pool, 0xFFFFFFFF, done3);
parkedWorker(tm3, 0xe1004, 3, pool, 0xFFFFFFFF, done3);
assert.strictEqual(tm3.releaseSemaphore(pool, 1, 0), 1);
tm3.runSlice(100);
assert.deepStrictEqual(done3, [0], 'one unit wakes exactly one of two waiters');
assert.strictEqual(tm3.waitSingle(pool, 0, 1), 0x102, 'and leaves no count behind');
console.log('PASS  a release of one unit satisfies exactly one waiter');
