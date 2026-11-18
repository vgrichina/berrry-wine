#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { ThreadManager } = require('../lib/thread-manager');

function manager(options) {
  const tm = new ThreadManager({}, new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true }),
    { exports: { get_sync_table: () => 0 } }, () => ({ host: {} }), options);
  tm._log = () => {};
  return tm;
}

function cooperativeThread(blocks) {
  return { tid: 1, state: 'active', sleepCount: 0, sleepUntil: 0,
    instance: { exports: {
      get_yield_reason: () => 0, get_eip: () => 0x401000,
      run: () => {}, get_last_run_blocks: () => blocks,
      get_sleep_yielded: () => 0,
    } } };
}

async function glGpsHud() {
  // GL GPS software-fallback readout: polled from the five zero-argument
  // exports at the HUD cadence (never per draw), names from the generated
// decline table, drawn only after a fallback, always in snapshot().
  let clock = 0;
  const box = { performance: { now: () => clock } };
  vm.createContext(box);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../lib/gl-gps-declines.generated.js'), 'utf8'), box);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../lib/perf-hud.js'), 'utf8'), box);
  const gps = box.WinePerf;
  const values = { gl_gps_active: 1, gl_gps_decline_seq: 0, gl_gps_last_decline: 0,
    gl_gps_last_decline_eip: 0, gl_gps_readback_count: 0 };
  let reads = 0;
  const exports = Object.fromEntries(Object.keys(values).map(k => [k, () => { reads++; return values[k]; }]));
  box.wineShell = { runningApps: [{ name: 'q3', wine: { instance: { exports } } }] };
  const texts = [];
  const ctx = new Proxy({}, { get: (o, k) => k === 'fillText' ? (s => texts.push(s))
    : k === 'measureText' ? (s => ({ width: String(s).length * 6 })) : (k in o ? o[k] : () => {}),
    set: (o, k, v) => { o[k] = v; return true; } });
  gps._dom = { canvas: { width: 300, height: 168 }, ctx, root: { style: {} } };
  const settle = () => new Promise(r => setImmediate(r));
  assert.strictEqual(gps.snapshot().glGps, null, 'detailed stats carry glGps (null before a read)');
  gps._sampleGlGps(clock += 1000); await settle();
  assert.strictEqual(reads, 5, 'one read of each export per poll');
  gps._sampleGlGps(clock += 100); await settle();
  assert.strictEqual(reads, 5, 'polls are rate-limited to the HUD cadence');
  gps._draw();
  assert.ok(!texts.some(s => /GL /.test(s)), 'no badge without a fallback');
  assert.deepStrictEqual({ ...gps.snapshot().glGps, lastFallbackAt: null },
    { active: true, declines: 0, reason: 0, reasonName: null, eip: 0, readbacks: 0, fallingBack: false, lastFallbackAt: null });
  Object.assign(values, { gl_gps_decline_seq: 3, gl_gps_last_decline: 3, gl_gps_last_decline_eip: 0x4012ab, gl_gps_readback_count: 7 });
  gps._sampleGlGps(clock += 600); await settle();
  texts.length = 0; gps._draw();
  assert.ok(texts.includes('GL SW: polygon stipple x3 rb 7 @0x004012ab'), JSON.stringify(texts));
  gps._sampleGlGps(clock += 600); await settle();
  texts.length = 0; gps._draw();
  assert.ok(texts.includes('GL was SW: polygon stipple x3 rb 7 @0x004012ab'), 'amber once the count stops moving');
  assert.strictEqual(gps.snapshot().glGps.fallingBack, false);
  Object.assign(values, { gl_gps_active: 0, gl_gps_decline_seq: 4, gl_gps_last_decline: 24 });
  gps._sampleGlGps(clock += 600); await settle();
  texts.length = 0; gps._draw();
  assert.ok(texts.includes("GL SW, arm off: target grew past the executor's device size x4 rb 7 @0x004012ab"), JSON.stringify(texts));
  // A Worker guest is read through its readExports RPC, one at a time.
  let pending = null, rpc = 0;
  box.wineShell.runningApps[0].wine = { guestWorker: { readExports: names => {
    rpc++; assert.deepStrictEqual([...names], Object.keys(values));
    return new Promise(r => { pending = () => r({ ...values, gl_gps_decline_seq: 9 }); }); } } };
  gps._sampleGlGps(clock += 600);
  gps._sampleGlGps(clock += 600);
  assert.strictEqual(rpc, 1, 'never two RPCs in flight');
  pending(); await settle();
  assert.strictEqual(gps.snapshot().glGps.declines, 9);
  console.log('PASS GL GPS HUD readout: rate-limited poll, badge only after a fallback, names, worker RPC');
}

async function main() {
  await glGpsHud();
  const tm = manager();
  const thread = cooperativeThread(3);
  tm.threads.set(0xe1000, thread);
  const stats = tm.runSlice(1000);
  assert.strictEqual(stats.steps, 1000, 'scheduler retains its requested-budget accounting');
  assert.strictEqual(stats.blocks, 3, 'measured throughput counts only retired blocks');
  thread.instance.exports.get_last_run_blocks = () => 0;
  assert.strictEqual(tm.runSlice(1000).blocks, 0, 'zero-work yields do not report the budget');
  delete thread.instance.exports.get_last_run_blocks;
  assert.strictEqual(tm.runSlice(1000).blocks, 0, 'missing measurement does not invent work');
  thread.suspendCount = 1;
  assert.strictEqual(tm.runSlice(1000).blocks, 0, 'a parked worker contributes no blocks');
  thread.suspendCount = 0;
  thread.instance.exports.get_last_run_blocks = () => 123;
  thread.instance.exports.run = () => { throw new Error('trap'); };
  assert.strictEqual(tm.runSlice(1000).blocks, 0, 'traps cannot reuse the previous completed run counter');

  const wakeTm = manager();
  wakeTm.threads.set(1, { state: 'active', instance: { exports: { get_yield_reason: () => 0 } } });
  wakeTm._cooperativeWakeTargets = new Map([[1, 2]]);
  let wakeCalls = 0;
  wakeTm.runSlice = () => ++wakeCalls <= 2
    ? { steps: 100000, blocks: 4, threadsRun: 1 } : { steps: 0, blocks: 0, threadsRun: 0 };
  assert.deepStrictEqual(await wakeTm.drainCooperativeWakes({ maxTotalSteps: 200000 }),
    { steps: 200000, blocks: 8, threadsRun: 2 });
  assert.strictEqual((await wakeTm.drainCooperativeWakes()).blocks, 0, 'empty wake turns reset work');

  for (const serialSlices of [false, true]) {
    const workerTm = manager({ workerBackend: { dropThread() {} }, serialSlices });
    const replies = [7, 0];
    for (let i = 0; i < replies.length; i++) {
      workerTm.threads.set(i + 1, { tid: i + 1, state: 'active',
        link: { slice: async () => ({ eip: 0x401000, yield: 0, blocks: replies[i] }) } });
    }
    assert.strictEqual(await workerTm.runWorkerSlices(50000), 2, 'worker API still returns runnable count');
    assert.strictEqual(workerTm.lastWorkerSliceBlocks, 7, 'serial and parallel slices sum actual results');
    replies[0] = 0;
    await workerTm.runWorkerSlices(50000);
    assert.strictEqual(workerTm.lastWorkerSliceBlocks, 0, 'a new turn cannot inherit prior work');
    const first = workerTm.threads.get(1);
    first.link.slice = async () => ({ eip: 0x401000, trapped: 'trap', blocks: 999 });
    await workerTm.runWorkerSlices(50000);
    assert.strictEqual(first.lastRunBlocks, 0, 'trapped worker replies are not completed counters');
    workerTm.threads.get(2).link.slice = async () => null;
    await workerTm.runWorkerSlices(50000);
    assert.strictEqual(workerTm.lastWorkerSliceBlocks, 0, 'missing replies report no work');
    workerTm.threads.get(2).suspendCount = 1;
    assert.strictEqual(await workerTm.runWorkerSlices(50000), 0);
    assert.strictEqual(workerTm.lastWorkerSliceBlocks, 0, 'no runnable workers clears the aggregate');
  }

  let time = 100;
  const sandbox = { performance: { now: () => time } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../lib/perf-hud.js'), 'utf8'), sandbox);
  const hud = sandbox.WinePerf;
  hud.countBlocks(99);
  assert.strictEqual(hud.guestBlocks.length, 0, 'disabled HUD has no throughput overhead');
  hud.enabled = true;
  hud.countBlocks(0);
  time = 200;
  hud.countBlocks(5);
  time = 300;
  hud.countBlocks(0);
  assert.strictEqual(hud.snapshot().blocksPerSec, 25, 'rate includes idle time and actual blocks');
  assert.strictEqual(hud.snapshot().stepsPerSec, 25, 'deprecated field aliases the same measured unit');
  hud.stepBegin();
  hud.markThrottled(true);
  hud.markThrottled(false);
  hud.stepEnd();
  assert.strictEqual(hud.snapshot().throttledPct, 100, 'later phases cannot erase a deadline hit');
  hud.stepBegin();
  hud.markThrottled(false);
  hud.stepEnd();
  assert.strictEqual(hud.snapshot().throttledPct, 50, 'throttling is scoped to the current step');
  hud.guestFrame();
  hud.inputMove(false);
  hud.inputTake(100);
  hud.reset();
  assert.strictEqual(hud.snapshot().blocksPerSec, 0);
  assert.strictEqual(hud.guestFrames.length, 0);
  assert.strictEqual(hud.inputMoves.length, 0);
  assert.strictEqual(hud.inputTaken.length, 0);
  hud.countBlocks(0);
  time += 100;
  hud.countBlocks(0);
  assert.strictEqual(hud.snapshot().blocksPerSec, 0, 'idle execution remains zero after reset');
  for (let i = 0; i < 500; i++) hud.countBlocks(1);
  assert(hud.guestBlocks.length <= 240, 'throughput history is bounded');
  hud.reset();
  hud.countBlocks(100);
  time += 1000;
  hud.countBlocks(100);
  assert.strictEqual(hud.snapshot().blocksPerSec, 100, 'the first sample is a boundary, not interval work');
  hud.reset();
  for (let i = 0; i < 300; i++) { time += 1; hud.countBlocks(10); }
  assert.strictEqual(hud.snapshot().blocksPerSec, 10000, 'ring eviction preserves numerator/time boundaries');
  time += 1000;
  hud.countBlocks(0);
  assert(hud.snapshot().blocksPerSec < 2500, 'idle slices extend the rate interval');
  time += 2001;
  assert.strictEqual(hud.snapshot().blocksPerSec, 0, 'stale samples do not claim continued execution');
  console.log('PASS actual block accounting: cooperative, worker, wake, idle, traps, HUD reset/throttle');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
