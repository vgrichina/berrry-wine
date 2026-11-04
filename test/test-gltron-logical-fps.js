'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { BOUNDARY, inspectOriginal, summarizeCounterWindow, probeCompiled,
  installPageCounter } = require('../tools/gltron-logical-fps.cjs');
let passed = 0;
function check(name, fn) { fn(); passed++; console.log('PASS ' + name); }
// Synthetic arithmetic fixtures, never published as gameplay observations.
function samples() {
  return Array.from({ length: 22 }, (_, i) => ({ beforeMs: 100 + i * 250,
    afterMs: 100.1 + i * 250, count: i * 5, owner: 'synthetic-owner',
    endpoint: 'page-main', threadId: 1, generation: 1,
    currentCallbacks: BOUNDARY.callbackTable, marker: BOUNDARY.nonzeroDt,
    pace: 0, tierGuard: 0, chain: 1, uop: 1 }));
}
check('counter delta needs no callback timestamps and brackets the rate', () => {
  const out = summarizeCounterWindow(samples());
  assert.equal(out.frames, 105); assert.equal(out.logicalFPS, 20);
  assert(out.minLogicalFPS < 20 && out.maxLogicalFPS > 20);
});
for (const [name, patch, expected] of [
  ['foreign owner', { owner: 'foreign' }, /owner/],
  ['foreign endpoint', { endpoint: 'worker' }, /owner/],
  ['wrong main thread', { threadId: 0 }, /owner/],
  ['new generation', { generation: 2 }, /generation/],
  ['paused callback table', { currentCallbacks: 0x42a860 }, /scene/],
  ['idle poll marker', { marker: BOUNDARY.idle }, /marker/],
  ['pacing marker', { pace: 1 }, /marker/],
  ['debug tier', { tierGuard: 1 }, /tier/],
  ['chain changed', { chain: 0 }, /tier/],
  ['uop changed', { uop: 0 }, /tier/],
  ['reset', { count: 0 }, /reset/],
  ['negative count', { count: -1 }, /unsigned/],
  ['NaN time', { beforeMs: NaN }, /latency/],
  ['latency', { afterMs: 3200 }, /latency/],
  ['stale poll', { beforeMs: 0, afterMs: 0.1 }, /stale/],
]) check(name + ' fails closed', () => {
  const rows = samples(); Object.assign(rows[10], patch);
  assert.throws(() => summarizeCounterWindow(rows), expected);
});
check('bounded unsigned wrap accepted; ambiguous deltas rejected', () => {
  const rows = samples();
  rows.forEach((r, i) => { r.count = (0xfffffff0 + i * 5) >>> 0; });
  assert.equal(summarizeCounterWindow(rows).frames, 105);
  assert.equal(summarizeCounterWindow(rows).wraps, 1);
  rows[10].count = 1000000;
  assert.throws(() => summarizeCounterWindow(rows), /ambiguous/);
});
check('minimum interval includes uncertainty; zero deltas valid', () => {
  assert.throws(() => summarizeCounterWindow(samples().slice(0, 21)), /interval/);
  const zero = samples(); zero.forEach(r => { r.count = 0; });
  assert.equal(summarizeCounterWindow(zero).logicalFPS, 0);
});
check('observation gaps rejected', () => {
  assert.throws(() => summarizeCounterWindow([samples()[0], samples()[21]]), /stale/);
});
check('exact original hash guards static semantics', () => {
  const bytes = fs.readFileSync('test/binaries/gltron-0.70/gltron.exe');
  assert.equal(inspectOriginal(bytes).runtimeOwnershipVerified, false);
  const wrong = Buffer.from(bytes); wrong[0] ^= 1;
  assert.throws(() => inspectOriginal(wrong), /hash mismatch/);
});
check('actual trace guards differ from production marker', () => {
  const exports = fs.readFileSync('src/13-exports.wat', 'utf8');
  const recompute = exports.slice(exports.indexOf('(func $dbg_recompute'), exports.indexOf('(func (export "get_dbg_tier_guard")'));
  assert.match(recompute, /global\.set \$dbg_chain_guard \(global\.get \$dbg_any\)/);
  assert.match(recompute.slice(recompute.indexOf('global.set $dbg_tier_guard')), /global\.get \$trace_eip_flag/);
  const source = fs.readFileSync('src/09a8-handlers-directx.wat', 'utf8');
  const marker = source.slice(source.indexOf('(func $th_logical_frame'), source.indexOf('(func $th_logical_frame') + 3200);
  assert.match(marker, /global\.set \$logical_frame_count/);
  assert.doesNotMatch(marker, /call \$host_log_eip/);
});

// Execute the exact browser adapter in a page-shaped VM: lifecycle and pointer
// checks only. The separate compiled probe executes original machine code.
async function pageFixture() {
  const memory = new WebAssembly.Memory({ initial: 1 });
  const view = new DataView(memory.buffer), addr = new Map([
    [BOUNDARY.currentCallbacks, 256], [BOUNDARY.game2Pointer, 260], [0x800030, 264] ]);
  view.setUint32(256, BOUNDARY.callbackTable, true);
  view.setUint32(260, 0x800000, true); view.setUint32(264, 0, true);
  let marker = 0, pace = 0, tier = 0, frozen = false;
  const e = { memory, get_current_thread_id: () => 1, get_image_base: () => 0x400000,
    get_logical_frame_addr: () => marker, get_logical_frame_pace: () => pace,
    get_logical_frame_count: () => 123, guest_to_wasm: va => addr.get(va) || 0,
    get_block_chain: () => 1, get_uop: () => 1, get_dbg_tier_guard: () => tier };
  const instance = { exports: e }, threadManager = { threads: new Map() };
  const wine = { instance, running: true, threadManager,
    _setLogicalFrame: async (a, p) => { marker = a; pace = p; } };
  const window = { wine, WineFrozen: { status: () => ({ frozen }) },
    __gltronModuleObservation: { instances: [{ instance, generation: 1 }] } };
  let now = 100;
  const document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
  const context = vm.createContext({ window, document, performance: { now: () => now += 0.01 },
    setInterval: () => 1, clearInterval() {}, DataView });
  const install = vm.runInContext('(' + installPageCounter.toString() + ')', context);
  await install(BOUNDARY, 'fixture');
  return { window, wine, e, instance, view, state: window.__gltronCounter,
    setTier: v => { tier = v; }, setFrozen: v => { frozen = v; } };
}
async function main() {
  for (const [name, mutate, message] of [
    ['owner replacement', f => { f.window.wine = {}; }, /runtime changed/],
    ['instance replacement', f => { f.wine.instance = { exports: f.e }; }, /runtime changed/],
    ['worker added', f => { f.wine.guestWorker = {}; }, /runtime changed/],
    ['stale module generation', f => { f.window.__gltronModuleObservation.instances[0].generation++; }, /generation/],
    ['child gameplay counter', f => { f.wine.threadManager.threads.set(7, { instance: f.instance }); }, /foreign thread/],
    ['callbacks changed', f => f.view.setUint32(256, 0, true), /scene/],
    ['debug tier armed', f => f.setTier(1), /tier/],
    ['frozen clock', f => f.setFrozen(true), /frozen/],
  ]) {
    const f = await pageFixture(); mutate(f);
    check('actual adapter rejects ' + name, () => {
      assert.throws(() => f.state.read(), message);
      assert.throws(() => f.state.read(), message);
    });
  }
  const f = await pageFixture();
  check('adapter translates guest pointers; dt0 observation is valid', () => {
    const row = f.state.read(); assert.equal(row.translations.dt.value, 0);
    assert.equal(row.translations.dt.offset, 264); assert.equal(row.threadId, 1);
    assert.equal(row.count, 123); assert.equal(row.pace, 0);
  });
  f.state.finish();
  check('release marker preserves lifetime counter', () => {
    assert.equal(f.e.get_logical_frame_addr(), 0); assert.equal(f.e.get_logical_frame_count(), 123);
  });
  const bounded = await pageFixture();
  check('actual adapter bounds storage and retains failed raw reads', () => {
    for (let i = 0; i < 63; i++) bounded.state.read();
    assert.throws(() => bounded.state.read(), /capacity/);
    const out = bounded.state.finish();
    assert.equal(out.rows.length, 64); assert.match(out.invalid, /capacity/);
    assert.equal(bounded.e.get_logical_frame_addr(), 0);
  });
  const { requireReleases, normalClose, requiredShellPaths, validateShellPins } = require('../tools/gltron-logical-fps-local.cjs');
  check('shell pin preflight rejects omitted fonts/manifest before Chrome', () => {
    const { sha256 } = require('../tools/gltron-logical-fps.cjs');
    const pins = requiredShellPaths().map(path => { const b = fs.readFileSync(path); return { path, bytes: b.length, sha256: sha256(b) }; });
    validateShellPins(pins);
    for (let i = 0; i < pins.length; i++) assert.throws(() => validateShellPins(pins.filter((_, n) => n !== i)), /shell pin/);
    const bad = pins.map(p => ({ ...p })); bad[0].sha256 = 'bad';
    assert.throws(() => validateShellPins(bad), /shell pin/);
  });
  check('both named resource releases are required', () => {
    assert.throws(() => requireReleases('mdk2-poll-repair LOCAL HEAVY RELEASE'), /requires/);
    assert.throws(() => requireReleases('stronghold-route-handoff LOCAL HEAVY RELEASE'), /requires/);
    assert(requireReleases('mdk2-poll-repair LOCAL HEAVY RELEASE\nstronghold-current-hover LOCAL HEAVY RELEASE'));
  });
  const { EventEmitter } = require('node:events');
  const child = new EventEmitter(); Object.assign(child, { pid: 123, exitCode: null, signalCode: null });
  const records = [], calls = [];
  const browser = { process: () => child, disconnect: () => calls.push('disconnect'),
    target: () => ({ createCDPSession: async () => ({ send: async method => {
      calls.push(method); queueMicrotask(() => { child.exitCode = 0; child.emit('exit', 0, null); });
    } }) }) };
  await normalClose(browser, row => records.push(row), 1000);
  check('direct Chrome-only normal close waits for actual owned exit', () => {
    assert.deepEqual(calls, ['Browser.close', 'disconnect']);
    assert(records.some(r => r.event === 'actual-owned-exit' && r.code === 0));
  });
  for (const modulePath of process.argv.slice(2).length ? process.argv.slice(2) :
    ['build/wine-assembly.wasm', 'build/wine-assembly.compat.wasm']) {
    const out = await probeCompiled(modulePath);
    check('production host + original branch in ' + modulePath, () => {
      assert.equal(out.rows.length, 20);
      assert(out.rows.filter(r => r.dt === 0).every(r => r.delta === 0));
    });
    console.log(JSON.stringify(out));
  }
  console.log(`${passed} checks passed; offline fixtures are not gameplay FPS`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
