#!/usr/bin/env node
'use strict';
// Source-only qualification: distinct OS threads, one instance/slot per owner.
// Process reset and slot replacement are permitted ONLY after all owners park.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { Worker, isMainThread, parentPort, workerData, threadId } = require('worker_threads');
const N = 4, TIMEOUT = 15000, MAX = (1n << 64n) - 1n;
const unsigned = x => BigInt.asUintN(64, x);
function fresh(ids, seen = new Set()) {
  for (const id of ids) {
    assert(id !== 0n && !seen.has(id), `duplicate or zero identity ${id}`);
    seen.add(id);
  }
}
function exhausted(results) {
  assert(results.every(r => r.ids.length === 0 && r.rejected === 1), 'exhaustion rejection');
}

function compile(mode) {
  const { compileClosure } = require('../tools/watx-closure');
  const text = fs.readFileSync(path.join(__dirname, '../src/04-cache.wat'), 'utf8');
  const start = text.indexOf(';; BEGIN CALLBACK INVOCATION OWNERSHIP');
  const end = text.indexOf(';; END CALLBACK INVOCATION OWNERSHIP');
  assert(start >= 0 && end > start, 'production extraction markers');
  let block = text.slice(start, end);
  const replace = (from, to) => {
    assert.strictEqual(block.split(from).length, 2, 'mutation must match exactly once');
    block = block.replace(from, to);
  };
  if (mode === 'lost-update') {
    // A deliberately unsafe load/store allocator. Force every OS thread to
    // read the same old value before any writes, rather than hoping for a race.
    replace('(local.set $old (i64.atomic.load (region.addr $CALLBACK_OWNERSHIP 0)))',
      '(local.set $old (i64.atomic.load (region.addr $CALLBACK_OWNERSHIP 0))) (call $rendezvous)');
    replace(`(i64.atomic.rmw.cmpxchg (region.addr $CALLBACK_OWNERSHIP 0)
          (local.get $old) (local.get $next))`,
      `(block (result i64) (i64.atomic.store (region.addr $CALLBACK_OWNERSHIP 0)
        (local.get $next)) (local.get $old))`);
  }
  if (mode === 'wrap') replace(
    '(if (i64.eq (local.get $old) (i64.const -1)) (then (unreachable)))', '(nop)');
  const source = `(import "host" "memory" (memory 1 1 shared))
    (import "host" "beep_process_begin" (func $host_beep_process_begin (param i32 i32) (result i32)))
    (import "host" "beep_thread_begin" (func $host_beep_thread_begin (param i32 i32 i32 i32 i32) (result i32)))
    ${mode === 'lost-update' ? '(import "test" "rendezvous" (func $rendezvous))' : ''}
    (region.declare-fixed $CALLBACK_OWNERSHIP (base 0) (size 0x2110) (align 16))
    (global $current_thread_id (mut i32) (i32.const 1))
    ${block}
    ${['process_begin','thread_begin','current','enter','leave'].map(name =>
      `(export "${name}" (func $invocation_${name}))`).join('\n')}
    (func (export "setTid") (param i32) (global.set $current_thread_id (local.get 0)))
    (func (export "depth") (result i32) (global.get $invocation_depth))
    (func (export "root") (result i64) (global.get $invocation_root))
    (func (export "epoch") (result i64) (global.get $invocation_epoch))`;
  const result = compileClosure({ source, vfs: new Map() }, { tailCalls: true });
  assert(result.success, result.error);
  return new WebAssembly.Module(result.wasmBinary);
}

function instance(mod, memory, tid, rendezvous = () => {}) {
  // Use the actual host lifecycle imports, as in the existing token test.
  const { createAudioHost } = require('../lib/host-audio');
  const audio = createAudioHost({ getMemory: () => memory.buffer }, {}).imports;
  const x = new WebAssembly.Instance(mod, { host: { memory,
    beep_process_begin: audio.beep_process_begin,
    beep_thread_begin: audio.beep_thread_begin }, test: { rendezvous } }).exports;
  x.setTid(tid); return x;
}

function workerMain() {
  const { mod, memory, control, slot } = workerData;
  const c = new Int32Array(control);
  const rendezvous = () => {
    if (!Atomics.load(c, 2)) return;
    if (Atomics.add(c, 3, 1) === N - 1) {
      Atomics.store(c, 4, 1); Atomics.notify(c, 4);
    }
    while (!Atomics.load(c, 4)) assert.notStrictEqual(Atomics.wait(c, 4, 0, TIMEOUT), 'timed-out');
  };
  let x = instance(mod, memory, slot + 1, rendezvous), stack = [];
  const state = who => ({ depth: who.depth(), root: who.root(), epoch: who.epoch(),
    bytes: Buffer.from(new Uint8Array(memory.buffer, 16 + slot * 528, 528)) });
  const reject = (who, fn) => {
    const before = state(who);
    assert.throws(fn, WebAssembly.RuntimeError);
    assert.deepStrictEqual(state(who), before, 'rejected call changed owner state');
  };
  parentPort.on('message', ({ generation, op, count }) => {
    try {
      parentPort.postMessage({ ready: generation });
      while (Atomics.load(c, 0) < generation)
        assert.notStrictEqual(Atomics.wait(c, 0, generation - 1, TIMEOUT), 'timed-out');
      const ids = []; let rejected = 0;
      if (op === 'init') { x.thread_begin(slot); ids.push(unsigned(x.current())); }
      if (op === 'enter' || op === 'exhaust') for (let i = 0; i < count; i++) {
        const before = state(x);
        try { const id = x.enter(); stack.push(id); ids.push(unsigned(id)); }
        catch (e) {
          if (op !== 'exhaust' || !(e instanceof WebAssembly.RuntimeError)) throw e;
          assert.deepStrictEqual(state(x), before); rejected++;
        }
      }
      if (op === 'overflow') reject(x, () => x.enter());
      if (op === 'mismatch') reject(x, () => x.leave(x.root()));
      if (op === 'drain') { while (stack.length) x.leave(stack.pop()); assert.strictEqual(x.current(), x.root()); }
      if (op === 'replace') {
        assert.strictEqual(stack.length, 0);
        const old = x; x = instance(mod, memory, slot + 1, rendezvous);
        x.thread_begin(slot); ids.push(unsigned(x.current()));
        reject(old, () => old.enter());
      }
      if (op === 'stale') reject(x, () => x.enter());
      parentPort.postMessage({ done: generation, ids, rejected, epoch: unsigned(x.epoch()),
        root: unsigned(x.root()), depth: x.depth(), threadId });
    } catch (e) { throw e; }
  });
}

async function pool(mode, body) {
  const mod = compile(mode), memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
  assert(memory.buffer instanceof SharedArrayBuffer);
  const control = new SharedArrayBuffer(32), c = new Int32Array(control);
  const workers = Array.from({ length: N }, (_, i) => new Worker(__filename,
    { workerData: { mod, memory, control, slot: i + 1 } }));
  let generation = 0, pending, fatal;
  const fail = e => { fatal = e; if (pending) pending.reject(e); };
  workers.forEach(w => {
    w.on('error', fail);
    w.on('exit', code => { if (pending) fail(new Error(`premature worker exit ${code}`)); });
    w.on('message', msg => {
      if (!pending) return fail(new Error('unsolicited worker message'));
      if (msg.ready === generation) {
        if (++pending.ready === N) { Atomics.store(c, 0, generation); Atomics.notify(c, 0); }
      } else if (msg.done === generation) {
        pending.results.push(msg);
        if (pending.results.length === N) pending.resolve(pending.results);
      } else fail(new Error('wrong barrier generation'));
    });
  });
  const round = async (op, count = 1) => {
    if (fatal) throw fatal;
    generation++;
    let timer;
    try {
      return await new Promise((resolve, reject) => {
        pending = { resolve, reject, ready: 0, results: [] };
        timer = setTimeout(() => reject(new Error(`barrier timeout: ${op}`)), TIMEOUT);
        workers.forEach(w => w.postMessage({ generation, op, count }));
      });
    } finally { clearTimeout(timer); pending = null; }
  };
  try { await body({ round, memory, c, main: instance(mod, memory, 1) }); }
  finally {
    // terminate() interrupts even a worker trapped in synchronous WASM/Atomics.
    let timer;
    try { await Promise.race([Promise.all(workers.map(w => w.terminate())),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('termination timeout')), TIMEOUT); })]); }
    finally { clearTimeout(timer); }
  }
}

async function main() {
  let issued = 0;
  await pool('production', async ({ round, memory, main }) => {
    const seen = new Set(), view = new BigUint64Array(memory.buffer);
    const accept = results => {
      assert.strictEqual(new Set(results.map(r => r.threadId)).size, N, 'distinct OS workers');
      const ids = results.flatMap(r => r.ids);
      fresh(ids, seen); issued += ids.length;
    };
    // Bootstrap races only in distinct vacant slots; all must join one epoch.
    let results = await round('init'); accept(results);
    console.log(`production worker threadIds: ${results.map(r => r.threadId).sort((a, b) => a - b).join(',')}`);
    assert.strictEqual(new Set(results.map(r => r.epoch)).size, 1);
    const epoch = results[0].epoch;
    assert(epoch > 0n && !seen.has(epoch)); seen.add(epoch);
    for (let wave = 0; wave < 8; wave++) {
      accept(await round('enter', 63)); // keep every child live until the barrier
      const before = Buffer.from(memory.buffer);
      await round('overflow'); await round('mismatch');
      assert.deepStrictEqual(Buffer.from(memory.buffer), before, 'all-rejection phase changed shared state');
      await round('drain');
    }
    accept(await round('replace')); // each old owner is parked before replacement
    const oldEpoch = Atomics.load(view, 1);
    main.process_begin(); // every worker is parked, not concurrently executing
    assert(main.epoch() > oldEpoch);
    for (const id of [unsigned(main.epoch()), unsigned(main.root())]) {
      assert(!seen.has(id)); seen.add(id);
    }
    const before = Buffer.from(memory.buffer);
    await round('stale');
    assert.deepStrictEqual(Buffer.from(memory.buffer), before);
    accept(await round('replace'));
    // Fixture-only boundary injection, with all owners quiescent. There are
    // exactly seven legal serials remaining across all four OS workers.
    Atomics.store(view, 0, MAX - 7n);
    results = await round('exhaust', 8); accept(results);
    assert.strictEqual(results.reduce((n, r) => n + r.ids.length, 0), 7, 'terminal capacity');
    assert.strictEqual(results.reduce((n, r) => n + r.rejected, 0), N * 8 - 7);
    console.log(`terminal contention: ${results.map(r => `${r.ids.length} allocated/${r.rejected} rejected`).join('; ')}`);
    assert.strictEqual(Atomics.load(view, 0), MAX);
    const terminalBytes = Buffer.from(memory.buffer);
    results = await round('exhaust', 1);
    exhausted(results);
    assert.deepStrictEqual(Buffer.from(memory.buffer), terminalBytes);
    await round('drain'); // leaving live tokens remains legal at exhaustion
    results = await round('exhaust', 1);
    exhausted(results); // retirement cannot recycle serials
  });
  await pool('lost-update', async ({ round, c }) => {
    await round('init');
    Atomics.store(c, 2, 1);
    const ids = (await round('enter')).flatMap(r => r.ids);
    assert.throws(() => fresh(ids), /duplicate or zero identity/);
    assert.strictEqual(new Set(ids).size, 1, 'forced read/read/write/write interleaving');
    console.log('REJECTED control: unsafe load/store allocator duplicates all four live identities');
  });
  await pool('wrap', async ({ round, memory }) => {
    await round('init'); Atomics.store(new BigUint64Array(memory.buffer), 0, MAX);
    const results = await round('exhaust');
    assert.throws(() => exhausted(results), /exhaustion rejection/);
    assert(results.some(r => r.ids.includes(0n)), 'wrap control reaches forbidden zero');
    console.log('REJECTED control: missing exhaustion guard wraps through zero');
  });
  console.log(`callback invocation concurrency PASS: ${N} OS workers, ${issued} unique roots/children, 8 x 63 live-depth waves, quiescent retirement, terminal contention, 2 rejecting controls`);
}

if (isMainThread) main().catch(e => { console.error(e); process.exitCode = 1; });
else workerMain();
