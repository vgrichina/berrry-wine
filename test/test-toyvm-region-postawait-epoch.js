'use strict';

// Execute the complete production bundle/pipeline/install/carryState methods.
// Only module dependencies are controlled: compilation is explicitly deferred,
// exports use tiny shared memory, and the separate installer records table writes.
// No emitted VM, guest, browser, worker or timing-dependent sleep is involved.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { Extras } = require('../tools/toyvm/extras');
const sourcePath = process.argv[2] || path.join(__dirname, '../tools/toyvm/region-live.js');
const source = fs.readFileSync(sourcePath, 'utf8');

function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

function fixture({ sep = false, paged = false, beforePrepare = false } = {}) {
  const compiling = deferred(), compiled = deferred(), calls = [], logs = [];
  const memory = { buffer: new ArrayBuffer(64) };
  const mem = new Uint8Array(memory.buffer);
  mem[16] = 41;
  const table = ['interpreter'];
  const exports = {
    get_cr0: () => paged ? -1 : 0, get_ax: () => mem[16],
    get_csb: () => 0, get_linmask: () => 0xffff, get_d32: () => 0,
  };
  const nextExports = {
    ...exports,
    set_ax(value) { calls.push('carry'); mem[17] = value; },
    set_rep_fast(value) { calls.push(['rep', value]); },
    set_vga_period(period, lines) { calls.push(['vga', period, lines]); },
  };
  const next = { exports: nextExports };
  const vm = {
    variant: 'fixture', memory, mem, exports, wat: 'controlled declarations',
    raw: name => name === 'ax' ? mem[16] : 0,
    get: () => 0,
    set(name, value) { calls.push(['set', name, value]); },
    rebind(value) {
      assert.equal(value, next);
      calls.push('rebind');
      this.exports = value.exports;
      table.splice(0, table.length, 'replacement', 'region');
    },
  };
  const cache = {
    regions: new Map(), regionAt: new Map([['old', 9]]),
    regionSucc: new Map(), regionBytes: new Map(), byPara: new Map(),
    arenaResets: 0,
    invalidateRange(lo, hi) { calls.push(['invalidate', lo, hi]); },
    entryFor() { throw new Error('no compiled programs to repair'); },
  };
  const session = { cache, vgaPeriod: 100, vgaLines: 10 };
  const extras = new Extras();
  const region = { kind: 'region' }, concurrent = { kind: 'foreground' };
  const guard = [{ lin: 2, bytes: Uint8Array.of(0) }];
  const module = { exports: {} };
  const dependencies = {
    './vm': { makeVm(variant, options) {
      assert.equal(variant, vm.variant);
      assert.equal(options.memory, memory);
      assert.deepEqual(options.bytes, Uint8Array.of(1));
      calls.push('compile');
      compiling.resolve();
      return compiled.promise;
    } },
    './emit': { STATE: ['ax'], MACHINE_STATE: [], FPU_STATE: [] },
    './isa': { RSTACK_BASE: 0 },
    './region-sep': {
      declsFromWat: () => [],
      installRegionModule(target, bytes, picks) {
        assert.equal(target, vm);
        assert.deepEqual(bytes, Uint8Array.of(1));
        assert.equal(picks.length, 1);
        calls.push('separate');
        table.push('region');
      },
    },
  };
  new Function('require', 'module', 'exports', source)(name => {
    assert.ok(Object.hasOwn(dependencies, name), `unexpected dependency ${name}`);
    return dependencies[name];
  }, module, module.exports);
  const { LiveJit } = module.exports;
  const jit = new LiveJit({
    vm, session, extras, sep,
    machine: { setVmExports(value) {
      assert.equal(value, nextExports);
      calls.push('machine');
    } },
    log: line => logs.push(line),
    backend: { name: 'controlled', async prepare(bundle) {
      assert.equal(bundle.extrasEpoch, 0);
      assert.notEqual(bundle.mem, mem);
      if (beforePrepare) extras.commit([concurrent]);
      return {
        sep, extras: [region], extrasEpoch: bundle.extrasEpoch,
        bytes: Uint8Array.of(1), gate: { ratio: 2 },
        picks: [{ idx: 0, key: 'new', headIp: 2, blocks: 1, ops: 4,
          share: 100, succ: [3], guard }],
      };
    } },
  });
  return { jit, vm, exports, nextExports, extras, concurrent, region,
    mem, table, cache, calls, logs, compiling, compiled, next, guard };
}

async function changedDuringCompile() {
  const f = fixture();
  const pending = f.jit.runPipeline();
  await f.compiling.promise; // the pre-await check has already passed
  f.extras.commit([f.concurrent]);
  f.table.push('foreground');
  f.mem[16] = 73; // guest progress while native compilation is pending
  const memoryBefore = f.mem.slice(), tableBefore = [...f.table];
  const maps = [f.cache.regionAt, f.cache.regionSucc, f.cache.regionBytes];
  const entries = maps.map(m => [...m]);
  f.compiled.resolve(f.next);
  let error;
  try { await pending; } catch (e) { error = e; }
  // Check writes BEFORE the outcome: a late decline/Extras.commit error must
  // not hide an already-carried register or rebound stale table.
  assert.deepEqual(f.calls, ['compile'], 'POST_AWAIT_MUST_DECLINE_BEFORE_STATE_OR_TABLE_MUTATION');
  assert.deepEqual(f.mem, memoryBefore);
  assert.deepEqual(f.table, tableBefore);
  assert.equal(f.vm.exports, f.exports);
  maps.forEach((m, i) => {
    assert.equal([f.cache.regionAt, f.cache.regionSucc, f.cache.regionBytes][i], m);
    assert.deepEqual([...m], entries[i]);
  });
  assert.ifError(error);
  assert.deepEqual(f.extras.handlers, [f.concurrent]);
  assert.equal(f.extras.epoch, 1);
  assert.equal(f.jit.phase, 'profiling');
  assert.match(f.jit.declined, /handler table grew.*compiled/);
  assert.equal(f.jit.installs, 0);
  assert.equal(f.jit.installedAt, null);
  assert.equal(f.jit.guards, null);
  assert.equal(f.logs.some(s => s.startsWith('[jit] installed')), false);
}

async function unchangedEpoch() {
  const f = fixture();
  const pending = f.jit.runPipeline();
  await f.compiling.promise;
  assert.deepEqual(f.calls, ['compile']);
  f.mem[16] = 73;
  f.compiled.resolve(f.next);
  await pending;
  assert.equal(f.mem[17], 73, 'carry current state after await, not preparation snapshot');
  assert.equal(f.vm.exports, f.nextExports);
  assert.deepEqual(f.calls, ['compile', 'carry', 'rebind', 'machine',
    ['rep', 1], ['vga', 100, 10], ['invalidate', 2, 2], ['set', 'rtop', 0]]);
  assert.deepEqual(f.table, ['replacement', 'region']);
  assert.deepEqual(f.extras.handlers, [f.region]);
  assert.equal(f.extras.epoch, 1);
  assert.equal(f.cache.regionAt.get('new'), 0);
  assert.deepEqual(f.cache.regionBytes.get('new'), f.guard);
  assert.deepEqual(f.jit.guards, f.guard);
  assert.deepEqual(f.jit.installedAt, [2]);
  assert.equal(f.jit.phase, 'installed');
  assert.equal(f.jit.installs, 1);
}

async function existingGuardsAndSeparatePath() {
  for (const sep of [false, true]) {
    const f = fixture({ sep, beforePrepare: true });
    await f.jit.runPipeline();
    assert.deepEqual(f.calls, []);
    assert.equal(f.jit.installs, 0);
    assert.match(f.jit.declined, /handler table grew.*prepared/);
    assert.equal(f.vm.exports, f.exports);
  }
  const paged = fixture({ paged: true });
  await paged.jit.runPipeline();
  assert.deepEqual(paged.calls, []);
  assert.match(paged.jit.declined, /paged execution/);
  const separate = fixture({ sep: true });
  await separate.jit.runPipeline();
  assert.deepEqual(separate.calls, ['separate', ['invalidate', 2, 2], ['set', 'rtop', 0]]);
  assert.equal(separate.vm.exports, separate.exports);
  assert.deepEqual(separate.table, ['interpreter', 'region']);
  assert.deepEqual(separate.extras.handlers, [separate.region]);
  assert.equal(separate.jit.installs, 1);
}

(async () => {
  await changedDuringCompile();
  await unchangedEpoch();
  await existingGuardsAndSeparatePath();
  console.log('PASS 6 ToyVM post-await epoch cases: deferred decline, current-state success, pre-await replacement/separate decline, paging guard, separate success');
})().catch(error => { console.error(error); process.exitCode = 1; });
