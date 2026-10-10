#!/usr/bin/env node

'use strict';

// The shared emulator tables, driven from two REAL OS threads at once.
//
// WHY NOT THE COOPERATIVE SCHEDULER
// test-heap-partition.js already proves the allocator partitions correctly with
// two instances interleaved at slice boundaries. That is not what phase 2 does:
// two Workers execute at the same instant, so a scan-then-claim can interleave
// *inside* itself, which no cooperative test can produce. Everything here runs
// in worker_threads over one shared WebAssembly.Memory — the same shape as two
// guest threads in two browser Workers, minus the browser.
//
// WHAT EACH CHECK WOULD CATCH
//   test_lock_bump      a lock that does not exclude → lost updates
//   test_lock_reentrant a non-recursive lock → self-deadlock, seen as a hang
//   test_dx_alloc       unlocked scan-then-claim → two COM objects, one slot
//   test_vsock_alloc    the same, for sockets; also the claim-before-unlock gap
//   test_vsock_alloc_port  a per-instance port cursor → the same ephemeral port
//   test_virtual_reserve_down  a plain read-modify-write → overlapping reserves
//
// Every failure mode here is a race, so a passing run is evidence rather than
// proof. The iteration counts are set so the unlocked versions fail essentially
// every time: with the lock removed from $dx_alloc, this reports duplicate slots
// on the first attempt.

const path = require('path');
const fs = require('fs');
const { Worker, isMainThread, workerData, parentPort } = require('worker_threads');

const RegionMap = require('../lib/region-map.generated.js');

const IMAGE_BASE = 0x400000;
// $TEST_SCRATCH — the harness's OWN cells, from the map in src/00-regions.wat.
// These were 0x07F0CA00/0x07F0CA04, described as "spare bytes past LOCK_TABLE";
// they are in fact inside $LOCK_TABLE, on its unused eighth lock line. The two
// cells here are the same two test-wat-window-tables.js uses, by offset, on
// purpose: the tests run in separate processes, and one named region beats two
// hand-picked holes.
const BUMP_CELL = RegionMap.BASE.TEST_SCRATCH + 0;
const BARRIER = RegionMap.BASE.TEST_SCRATCH + 4;
const INTERLOCKED_CELL = 0x500000;
const EXTRA_WAT = `
  (func (export "test_interlocked_call")
      (param $op i32) (param $ptr i32) (param $value i32) (param $compare i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x900000))
    (if (i32.eqz (local.get $op))
      (then (call $handle_InterlockedIncrement (local.get $ptr)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 1))
      (then (call $handle_InterlockedDecrement (local.get $ptr)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 2))
      (then (call $handle_InterlockedExchange (local.get $ptr) (local.get $value)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 3))
      (then (call $handle_InterlockedCompareExchange (local.get $ptr) (local.get $value)
        (local.get $compare) (i32.const 0) (i32.const 0) (i32.const 0))))
    (if (i32.eq (local.get $op) (i32.const 4))
      (then (call $handle_InterlockedExchangeAdd (local.get $ptr) (local.get $value)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))))
    (i32.load (global.get $reg_base)))
  (func (export "test_interlocked_sp") (result i32)
    (i32.load offset=16 (global.get $reg_base)))
  (func (export "test_interlocked_wa") (param i32) (result i32)
    (call $g2w (local.get 0)))
  (func (export "test_interlocked_watch_version") (param i32) (result i64)
    (i64.load offset=8 (call $page_watch_cell (local.get 0))))
`;

// One instance per OS thread, all over the same memory. createHostImports needs
// a context; nothing here draws, so the stubs are enough.
async function bootInstance(wasmBytes, memory, tid) {
  const { createHostImports } = require('../lib/host-imports');
  const ctx = {
    getMemory: () => memory.buffer,
    resourceJson: { menus: {}, dialogs: {}, strings: {}, bitmaps: {} },
    onExit: () => {},
  };
  const base = createHostImports(ctx);
  base.host.memory = memory;
  for (const stub of ['create_thread', 'exit_thread', 'terminate_thread', 'create_event', 'set_event',
    'reset_event', 'wait_single', 'wait_multiple']) base.host[stub] = () => 0;
  const { instance } = await WebAssembly.instantiate(wasmBytes, base);
  ctx.exports = instance.exports;
  // init_thread is what gives an instance its identity, and identity is what the
  // recursive lock uses to recognise its own holder. Two instances that both
  // think they are thread 1 would each see the other's lock as already theirs —
  // so this call is load-bearing, not boilerplate.
  instance.exports.init_thread(tid, IMAGE_BASE, 0, 0, 0, 0, 0);
  return instance;
}

if (!isMainThread) {
  (async () => {
    const { wasmBytes, memory, tid, job, iterations, workers } = workerData;
    const instance = await bootInstance(wasmBytes, memory, tid);
    const ex = instance.exports;
    const i32 = new Int32Array(memory.buffer);

    // Start together. Without a barrier the first worker can finish before the
    // second is instantiated, and then nothing was ever concurrent.
    Atomics.add(i32, BARRIER / 4, 1);
    while (Atomics.load(i32, BARRIER / 4) < workers) Atomics.wait(i32, BARRIER / 4, workers - 1, 50);

    const out = [];
    if (job === 'bump') {
      ex.test_lock_bump(ex.test_lock_addr(0), BUMP_CELL, iterations);
    } else if (job === 'bump-unlocked') {
      ex.test_bump_unlocked(BUMP_CELL, iterations);
    } else if (job === 'dx') {
      for (let i = 0; i < iterations; i++) out.push(ex.test_dx_alloc(1) >>> 0);
    } else if (job === 'sock') {
      for (let i = 0; i < iterations; i++) out.push(ex.test_vsock_alloc() | 0);
    } else if (job === 'port') {
      for (let i = 0; i < iterations; i++) out.push(ex.test_vsock_alloc_port() | 0);
    } else if (job === 'reserve') {
      for (let i = 0; i < iterations; i++) out.push(ex.test_virtual_reserve_down(0x10000) >>> 0);
    } else if (job === 'reentrant') {
      out.push(ex.test_lock_reentrant(ex.test_lock_addr(1)) | 0);
    } else if (job === 'interlocked') {
      let sum = 0, xor = 0;
      for (let i = 0; i < iterations; i++) {
        ex.test_interlocked_call(4, INTERLOCKED_CELL + 16, 3, 0);
        ex.test_interlocked_call(0, INTERLOCKED_CELL, 0, 0);
        ex.test_interlocked_call(1, INTERLOCKED_CELL + 4, 0, 0);
        let seen;
        do {
          seen = ex.guest_read32(INTERLOCKED_CELL + 8);
        } while (ex.test_interlocked_call(3, INTERLOCKED_CELL + 8, seen + 1, seen) !== seen);
        const token = (tid - 1) * iterations + i + 1;
        const old = ex.test_interlocked_call(2, INTERLOCKED_CELL + 12, token, 0);
        sum += old;
        xor ^= old;
      }
      out.push({ sum, xor });
    }
    parentPort.postMessage({ tid, out });
  })().catch(err => parentPort.postMessage({ error: String(err && err.stack || err) }));
  return;
}

let passed = 0, failed = 0;
function check(ok, label, detail) {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? `  ${detail}` : ''}`);
  ok ? passed++ : failed++;
}

// Each job gets a fresh memory: these tables have no free-everything call, and a
// socket table left full by one job would make the next one look broken.
async function runJob(wasmBytes, job, iterations, workers) {
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const i32 = new Int32Array(memory.buffer);
  Atomics.store(i32, BARRIER / 4, 0);
  Atomics.store(i32, BUMP_CELL / 4, 0);
  const results = await Promise.all(Array.from({ length: workers }, (_, k) =>
    new Promise((resolve, reject) => {
      const w = new Worker(__filename, {
        workerData: { wasmBytes, memory, tid: k + 1, job, iterations, workers },
      });
      w.on('message', m => (m.error ? reject(new Error(m.error)) : resolve(m)));
      w.on('error', reject);
    })));
  return { results, cell: Atomics.load(i32, BUMP_CELL / 4), memory };
}

function duplicates(values) {
  const seen = new Set(), dup = [];
  for (const v of values) {
    if (seen.has(v)) dup.push(v);
    seen.add(v);
  }
  return dup;
}

(async () => {
  console.log('WAT cross-instance locks, two OS threads\n');
  const { compileSrcWasm } = require('./compile-src');
  const SRC = path.join(__dirname, '..', 'src');
  const wasmBytes = compileSrcWasm((file, source) =>
    file === '13-exports.wat' ? source + EXTRA_WAT : source);

  {
    const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
    const ex = (await bootInstance(wasmBytes, memory, 0)).exports;
    const addresses = [INTERLOCKED_CELL, INTERLOCKED_CELL + 1,
      INTERLOCKED_CELL + 2, INTERLOCKED_CELL + 3];
    // Interleave another commit: neighboring guest pages must not happen to
    // have neighboring backing, or a raw unaligned atomic could pass the test.
    ex.test_virtual_map_commit(0x30000000, 0x1000);
    ex.test_virtual_map_commit(0x28000000, 0x3000);
    ex.test_virtual_map_commit(0x30001000, 0x1000);
    check(ex.test_interlocked_wa(0x30000fff) + 1 !== ex.test_interlocked_wa(0x30001000),
      'Interlocked sparse-boundary fixture has discontiguous backing');
    addresses.push(0x30000ffc, 0x30000ffd, 0x30000ffe, 0x30000fff);
    let valuesOK = true, stackOK = true;
    for (const ptr of addresses) {
      ex.guest_write32(ptr, 0x7fffffff);
      valuesOK &&= ex.test_interlocked_call(0, ptr, 0, 0) === -2147483648;
      valuesOK &&= (ex.guest_read32(ptr) >>> 0) === 0x80000000;
      stackOK &&= ex.test_interlocked_sp() === 0x900008;
      valuesOK &&= ex.test_interlocked_call(1, ptr, 0, 0) === 2147483647;
      stackOK &&= ex.test_interlocked_sp() === 0x900008;
      valuesOK &&= ex.test_interlocked_call(2, ptr, 23, 0) === 2147483647;
      stackOK &&= ex.test_interlocked_sp() === 0x90000c;
      valuesOK &&= ex.test_interlocked_call(3, ptr, 61, 99) === 23;
      valuesOK &&= ex.guest_read32(ptr) === 23;
      valuesOK &&= ex.test_interlocked_call(3, ptr, 61, 23) === 23;
      valuesOK &&= ex.guest_read32(ptr) === 61;
      stackOK &&= ex.test_interlocked_sp() === 0x900010;
      valuesOK &&= ex.test_interlocked_call(4, ptr, -62, 0) === 61;
      valuesOK &&= (ex.guest_read32(ptr) | 0) === -1;
      valuesOK &&= ex.test_interlocked_call(4, ptr, 2, 0) === -1;
      valuesOK &&= ex.guest_read32(ptr) === 1;
      stackOK &&= ex.test_interlocked_sp() === 0x90000c;
    }
    check(valuesOK, 'all Interlocked return/value semantics, overflow and unaligned sparse edges');
    check(stackOK, 'all five Interlocked handlers retain stdcall stack cleanup');

    const ptr = INTERLOCKED_CELL, wa = ex.test_interlocked_wa(ptr);
    ex.guest_write32(ptr, 7);
    ex.page_watch_acquire(wa, 4);
    const before = ex.test_interlocked_watch_version(wa);
    ex.test_interlocked_call(3, ptr, 19, 99);
    check(ex.test_interlocked_watch_version(wa) === before,
      'failed compare/exchange does not publish a watched-page write');
    ex.test_interlocked_call(3, ptr, 19, 7);
    check(ex.test_interlocked_watch_version(wa) === before + 1n,
      'successful compare/exchange publishes exactly one watched-page write');
    ex.page_watch_release(wa, 4);
  }

  {
    const iterations = 100000, workers = 2, total = iterations * workers;
    const { memory, results } = await runJob(wasmBytes, 'interlocked', iterations, workers);
    const ex = (await bootInstance(wasmBytes, memory, 0)).exports;
    check(ex.guest_read32(INTERLOCKED_CELL) === total,
      'InterlockedIncrement loses no updates across two real Workers');
    check((ex.guest_read32(INTERLOCKED_CELL + 4) | 0) === -total,
      'InterlockedDecrement loses no updates across two real Workers');
    check(ex.guest_read32(INTERLOCKED_CELL + 8) === total,
      'InterlockedCompareExchange implements a contended compare/exchange counter');
    check(ex.guest_read32(INTERLOCKED_CELL + 16) === total * 3,
      'InterlockedExchangeAdd loses no updates across two real Workers');
    const final = ex.guest_read32(INTERLOCKED_CELL + 12);
    const sum = results.reduce((n, r) => n + r.out[0].sum, final);
    const xor = results.reduce((n, r) => n ^ r.out[0].xor, final);
    let expectedXor = 0;
    for (let i = 1; i <= total; i++) expectedXor ^= i;
    check(sum === total * (total + 1) / 2 && xor === expectedXor,
      'InterlockedExchange returns each contended token exactly once');
  }

  if (process.argv.includes('--interlocked-only')) {
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
  }

  {
    // Long enough to swamp the barrier's wake skew. At 20,000 iterations each
    // thread finished its whole loop inside the tens of microseconds it takes
    // the other to come out of Atomics.wait, so the two never overlapped and
    // even the UNLOCKED control came out exact — a green run that tested
    // nothing. Sizing this by how long the work takes, not by how many
    // iterations look like a lot, is the whole trick.
    const ITER = 1000000;
    const { cell } = await runJob(wasmBytes, 'bump', ITER, 2);
    check(cell === ITER * 2, 'the mutex excludes: no lost updates in a locked RMW',
      `${cell} of ${ITER * 2}`);
  }

  {
    // The negative control. The same loop without the lock must LOSE updates —
    // if it does not, the two instances are not actually running at the same
    // time and nothing else in this file is testing what it claims to.
    const ITER = 1000000;
    const { cell } = await runJob(wasmBytes, 'bump-unlocked', ITER, 2);
    check(cell < ITER * 2, 'without the mutex the same loop loses updates (control)',
      `${cell} of ${ITER * 2} — ${ITER * 2 - cell} lost`);
  }

  {
    const { results } = await runJob(wasmBytes, 'reentrant', 1, 2);
    const ok = results.every(r => r.out[0] === 1);
    check(ok, 'the mutex is recursive, and fully released at depth 0',
      results.map(r => r.out[0]).join(','));
  }

  {
    // 1024 DX slots, so 300 each leaves headroom and still overlaps heavily.
    const { results } = await runJob(wasmBytes, 'dx', 300, 2);
    const all = results.flatMap(r => r.out).filter(v => v !== 0);
    const dup = duplicates(all);
    check(dup.length === 0, '$dx_alloc never hands the same slot to two threads',
      dup.length ? `${dup.length} duplicate(s), e.g. 0x${dup[0].toString(16)}` : `${all.length} slots`);
    check(all.length === 600, 'and every request got a slot', `${all.length} of 600`);
  }

  {
    // 64 records total, so ask for exactly that between the two threads: the
    // table must end up fully allocated with no index handed out twice.
    const { results } = await runJob(wasmBytes, 'sock', 32, 2);
    const all = results.flatMap(r => r.out).filter(v => v >= 0);
    const dup = duplicates(all);
    check(dup.length === 0, '$vsock_alloc never hands the same record to two threads',
      dup.length ? `${dup.length} duplicate(s), e.g. ${dup[0]}` : `${all.length} records`);
    check(all.length === 64, 'and all 64 records were allocated', `${all.length}`);
  }

  {
    const { results } = await runJob(wasmBytes, 'port', 200, 2);
    const all = results.flatMap(r => r.out).filter(v => v !== 0);
    const dup = duplicates(all);
    check(dup.length === 0, 'ephemeral ports are unique across threads',
      dup.length ? `${dup.length} duplicate(s), e.g. ${dup[0]}` : `${all.length} ports`);
  }

  {
    const { results } = await runJob(wasmBytes, 'reserve', 200, 2);
    const all = results.flatMap(r => r.out).filter(v => v !== 0);
    const dup = duplicates(all);
    check(dup.length === 0, '$virtual_reserve_down never returns one range twice',
      dup.length ? `${dup.length} duplicate(s), e.g. 0x${dup[0].toString(16)}` : `${all.length} reserves`);
    // Reservations are 64KB-aligned and carved downward, so a correct run is a
    // strictly descending ladder with no gap smaller than the request.
    const sorted = [...all].sort((a, b) => b - a);
    let tooClose = 0;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i - 1] - sorted[i] < 0x10000) tooClose++;
    }
    check(tooClose === 0, 'and every reserved range is a full 64KB clear of the next',
      tooClose ? `${tooClose} overlapping pair(s)` : `${sorted.length} ranges`);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(err => { console.error('test-wat-locks failed:', err); process.exit(1); });
