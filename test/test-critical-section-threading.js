#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { Worker, isMainThread, workerData, parentPort } = require('worker_threads');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');
// $GUEST_BASE, from the map declared in src/00-regions.wat.
const RegionMap = require('../lib/region-map.generated.js');

const IMAGE_BASE = 0x400000;
const CS_GUEST = 0x500000;
const CS_WASM = RegionMap.g2w(CS_GUEST, IMAGE_BASE);

async function instantiate(wasmBytes, memory, tid) {
  const ctx = {
    getMemory: () => memory.buffer,
    resourceJson: { menus: {}, dialogs: {}, strings: {}, bitmaps: {} },
    onExit: () => {},
  };
  const imports = createHostImports(ctx);
  imports.host.memory = memory;
  for (const name of ['create_thread', 'exit_thread', 'terminate_thread', 'create_event',
    'set_event', 'reset_event', 'wait_single', 'wait_multiple']) {
    imports.host[name] = () => 0;
  }
  const { instance } = await WebAssembly.instantiate(wasmBytes, imports);
  ctx.exports = instance.exports;
  instance.exports.init_thread(tid, IMAGE_BASE, 0, 0, 0, 0, 0);
  return instance.exports;
}

async function concurrentWorker() {
  const { wasmBytes, memory, control, tid, cs, tryEnter } = workerData;
  const ex = await instantiate(wasmBytes, memory, tid);
  const cells = new Int32Array(control);
  parentPort.postMessage('ready');
  Atomics.wait(cells, 0, 0);
  const deadline = Date.now() + 20000;
  for (let i = 0; i < 20000;) {
    assert(Date.now() < deadline, 'critical-section worker made no bounded progress');
    const acquired = tryEnter ? ex.test_cs_try_enter(cs) === 1 : ex.test_cs_enter(cs) === 0;
    if (!acquired) continue;
    assert.strictEqual(Atomics.add(cells, 1, 1), 0, 'two workers owned the section simultaneously');
    // Recursion must preserve exclusive ownership too.
    assert.strictEqual(ex.test_cs_try_enter(cs), 1);
    const previous = cells[2];
    for (let delay = 0; delay < 10; delay++) Atomics.load(cells, 0);
    cells[2] = previous + 1;
    ex.test_cs_leave(cs);
    assert.strictEqual(Atomics.sub(cells, 1, 1), 1);
    ex.test_cs_leave(cs);
    i++;
  }
}

async function concurrentChecks(wasmBytes) {
  for (const offset of [0, 1, 2, 3, 5, 6, 7]) {
    for (const tryEnter of [false, true]) {
      const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
      const control = new SharedArrayBuffer(16), cells = new Int32Array(control);
      const cs = CS_GUEST + offset, ex = await instantiate(wasmBytes, memory, 0);
      ex.test_cs_init(cs);
      const other = await instantiate(wasmBytes, memory, 3);
      assert.strictEqual(ex.test_cs_enter(cs), 0);
      other.test_cs_leave(cs);
      assert.strictEqual(other.test_cs_try_enter(cs), 0, 'a non-owner cannot release a packed section');
      assert.strictEqual(ex.release_cs_owned_by(1), 1, 'thread exit releases packed sections');
      assert.strictEqual(other.test_cs_try_enter(cs), 1, 'abandoned section is reusable');
      other.test_cs_leave(cs);
      const workers = []; let ready = 0;
      const timer = setTimeout(() => { for (const w of workers) w.terminate(); }, 25000);
      try {
        await Promise.all([1, 2].map(tid => new Promise((resolve, reject) => {
          const w = new Worker(__filename, { workerData: { wasmBytes, memory, control, tid, cs, tryEnter } });
          workers.push(w);
          w.on('message', msg => {
            if (msg === 'ready' && ++ready === 2) {
              Atomics.store(cells, 0, 1); Atomics.notify(cells, 0);
            }
          });
          w.on('error', reject);
          w.on('exit', code => code ? reject(new Error('worker exit ' + code)) : resolve());
        })));
        assert.strictEqual(cells[2], 40000, 'protected updates must not be lost');
        const dv = new DataView(memory.buffer), wa = RegionMap.g2w(cs, IMAGE_BASE);
        assert.deepStrictEqual([dv.getInt32(wa + 4, true), dv.getInt32(wa + 8, true),
          dv.getInt32(wa + 12, true)], [-1, 0, 0], 'final release must leave the section free');
      } finally {
        clearTimeout(timer); await Promise.all(workers.map(w => w.terminate()));
      }
    }
  }
  console.log('PASS  concurrent aligned/packed Enter/TryEnter, recursion and release');
}

(async () => {
  if (!isMainThread) return concurrentWorker();
  const src = path.join(__dirname, '..', 'src');
  const wasmBytes = compileSrcWasm();
  const memory = new WebAssembly.Memory({
    initial: 8192, maximum: 8192, shared: true,
  });
  const main = await instantiate(wasmBytes, memory, 0);   // thread id 1
  const worker = await instantiate(wasmBytes, memory, 1); // thread id 2
  const dv = new DataView(memory.buffer);
  const state = () => ({
    lock: dv.getInt32(CS_WASM + 4, true),
    recursion: dv.getInt32(CS_WASM + 8, true),
    owner: dv.getUint32(CS_WASM + 12, true),
  });

  main.test_cs_init(CS_GUEST);
  assert.deepStrictEqual(state(), { lock: -1, recursion: 0, owner: 0 });

  assert.strictEqual(worker.test_cs_park_retry(CS_GUEST), 31,
    'a parked inline EnterCriticalSection resumes at its thunk, completes once, and restores auto-pop');
  assert.deepStrictEqual(state(), { lock: 0, recursion: 1, owner: 2 },
    'the retry owns the section exactly once');
  assert.strictEqual(main.test_cs_enter(CS_GUEST), 7,
    'thread 1 parks instead of stealing a section from even-numbered owner 2');
  assert.deepStrictEqual(state(), { lock: 0, recursion: 1, owner: 2 },
    'an even-numbered owner remains intact while thread 1 is parked');
  worker.test_cs_leave(CS_GUEST);
  assert.deepStrictEqual(state(), { lock: -1, recursion: 0, owner: 0 });

  assert.strictEqual(main.test_cs_enter(CS_GUEST), 0,
    'the main identity acquires a free section without parking');
  assert.deepStrictEqual(state(), { lock: 0, recursion: 1, owner: 1 });
  assert.strictEqual(main.test_cs_enter(CS_GUEST), 0,
    'the owner can recursively enter');
  assert.deepStrictEqual(state(), { lock: 1, recursion: 2, owner: 1 });

  assert.strictEqual(worker.test_cs_enter(CS_GUEST), 7,
    'a contender parks, preserves ESP, and suppresses thunk auto-pop');
  assert.deepStrictEqual(state(), { lock: 1, recursion: 2, owner: 1 },
    'a parked contender cannot mutate the owner state');

  main.test_cs_leave(CS_GUEST);
  assert.deepStrictEqual(state(), { lock: 0, recursion: 1, owner: 1 },
    'one Leave preserves a recursive acquisition');
  main.test_cs_leave(CS_GUEST);
  assert.deepStrictEqual(state(), { lock: -1, recursion: 0, owner: 0 },
    'the final Leave publishes the section as free');

  assert.strictEqual(worker.test_cs_enter(CS_GUEST), 0,
    'the waiter acquires on its retry after release');
  assert.deepStrictEqual(state(), { lock: 0, recursion: 1, owner: 2 });
  main.test_cs_leave(CS_GUEST);
  assert.deepStrictEqual(state(), { lock: 0, recursion: 1, owner: 2 },
    'a non-owner Leave cannot release another thread\'s section');
  worker.test_cs_leave(CS_GUEST);
  assert.deepStrictEqual(state(), { lock: -1, recursion: 0, owner: 0 });
  assert.strictEqual(worker.test_cs_enter(CS_GUEST), 0,
    'the section remains reusable after the owner releases it');
  worker.test_cs_leave(CS_GUEST);
  assert.deepStrictEqual(state(), { lock: -1, recursion: 0, owner: 0 });

  main.test_cs_leave(CS_GUEST);
  assert.deepStrictEqual(state(), { lock: -1, recursion: 0, owner: 0 },
    'an unmatched Leave cannot drive counters below the initialized state');

  console.log('PASS  cooperative CRITICAL_SECTION ownership, recursion, and parking');
  await concurrentChecks(wasmBytes);
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
