#!/usr/bin/env node
//
// The scheduling census has to separate "a thread did no work" from "a thread
// was given no chance", because the scheduler divides its block budget by the
// number of ACTIVE threads and a thread parked forever on a wait handle counts
// as active. Measured on a real iPhone running StarCraft: three guest threads,
// one of them permanently on waitHandle 0xe0001, and NOTHING in any aggregate
// could show it — the handler histogram is a single array in shared linear
// memory, so all three threads accumulate into the same counters.
//
// So this builds that exact shape with stub instances: two threads that retire
// blocks and one that always reports yieldReason 1 (waiting), then asserts the
// census attributes budget and work to the right threads.

'use strict';

const assert = require('assert');
const { ThreadManager } = require('../lib/thread-manager');

let checks = 0;
const ok = (cond, label) => {
  assert.ok(cond, label);
  console.log(`  ok   ${label}`);
  checks++;
};

function makeManager() {
  const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
  const mainInstance = {
    exports: {
      get_sync_table: () => 0,
      get_heap_ptr: () => 0,
      set_heap_ptr: () => {},
    },
  };
  const tm = new ThreadManager({}, memory, mainInstance, () => ({ host: {} }), {});
  tm._log = () => {};
  // 0xFFFF is the manager's own "still waiting" result. Without this the stub
  // handle looks signalled on its first poll and the thread resumes, which is
  // the opposite of the case under test.
  tm.waitSingle = () => 0xFFFF;
  tm.waitMultiple = () => 0xFFFF;
  return tm;
}

// A stub guest instance. `blocksPerRun` 0 models a thread that enters run()
// and comes straight back out; `alwaysWaiting` models one parked on a wait.
function makeThread(tid, { blocksPerRun = 1000, alwaysWaiting = false } = {}) {
  let lastBlocks = 0;
  const exports = {
    get_yield_reason: () => (alwaysWaiting ? 1 : 0),
    get_wait_handle: () => 0xe0001,
    get_wait_handles_ptr: () => 0,
    get_wait_all: () => 0,
    get_wait_timeout: () => 0xFFFFFFFF,
    get_wait_stack_bytes: () => 12,
    get_current_thread_id: () => tid,
    get_eip: () => 0x493ac0,
    set_eip: () => {},
    clear_yield: () => {},
    get_esp: () => 0x7000,
    guest_read32: () => 0,
    run: () => { lastBlocks = blocksPerRun; },
    get_last_run_blocks: () => lastBlocks,
  };
  return {
    instance: { exports },
    state: 'active',
    tid,
    suspendCount: 0,
    sleepCount: 0,
    sleepUntil: 0,
    waitPolls: 0,
    waitStartedAt: 0,
  };
}

const tm = makeManager();
// Place threads directly: createThread would need a real wasm module, and the
// scheduler only ever reads this.threads.
tm.threads.set(0xE1001, makeThread(1, { alwaysWaiting: true }));
tm.threads.set(0xE1002, makeThread(2, { blocksPerRun: 4000 }));
tm.threads.set(0xE1003, makeThread(3, { blocksPerRun: 1000 }));

tm.resetSchedulerStats();
tm.runSlice(90000, { quantumSteps: 30000 });

const stats = tm.schedulerStats();
const byTid = {};
for (const row of stats.threads) byTid[row.tid] = row;

console.log('thread scheduling census');

ok(stats.threads.length === 3, 'every thread appears in the census');

const blocked = byTid[1];
const busy = byTid[2];
const light = byTid[3];

ok(blocked.blocks === 0, 'the parked thread retired no blocks');
ok(blocked.run === 0, 'the parked thread never entered run()');
ok(blocked.offered > 0, `the parked thread was still offered slices (${blocked.offered})`);
ok(blocked.parked === blocked.offered,
  'every offer to the parked thread ended parked, not skipped');
ok(blocked.parkShare === 1, 'parkShare is 1.0 for a permanently waiting thread');

ok(busy.blocks > 0 && light.blocks > 0, 'both runnable threads retired blocks');
ok(busy.blocks > light.blocks,
  `the heavier thread retired more (${busy.blocks} > ${light.blocks})`);
ok(busy.blockShare > light.blockShare, 'block share tracks retired work, not offers');

// The headline claim: budget granted and work returned are separable.
ok(blocked.budget === 0 && blocked.budgetShare === 0,
  'a thread that never runs consumes no GRANTED budget (it parks before run())');
ok(Math.abs(busy.blockShare + light.blockShare - 1) < 1e-9,
  'the two runnable threads account for all retired work');

ok(stats.totalBlocks === busy.blocks + light.blocks,
  'totalBlocks is the sum of per-thread retired blocks');
ok(stats.utilisation > 0 && stats.utilisation <= 1,
  `overall utilisation is a real ratio (${stats.utilisation.toFixed(3)})`);

// An empty run is distinct from a parked offer: the thread DID enter run().
const tm2 = makeManager();
tm2.threads.set(0xE2001, makeThread(7, { blocksPerRun: 0 }));
tm2.resetSchedulerStats();
tm2.runSlice(60000, { quantumSteps: 20000 });
const idle = tm2.schedulerStats().threads[0];
ok(idle.run > 0, 'a thread returning zero blocks still counts as having run');
ok(idle.emptyRun === idle.run, 'every such run is counted as empty');
ok(idle.emptyRunShare === 1, 'emptyRunShare separates "ran and did nothing" from "never ran"');
ok(idle.budget > 0 && idle.blocks === 0,
  'budget was granted to a thread that retired nothing — the waste this tool names');

// resetSchedulerStats must not disturb scheduling state.
tm.resetSchedulerStats();
const cleared = tm.schedulerStats();
ok(cleared.totalBlocks === 0, 'reset clears the census');
ok(tm.threads.size === 3, 'reset leaves the threads themselves alone');

console.log(`\n${checks}/${checks} checks passed`);
