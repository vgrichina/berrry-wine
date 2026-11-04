'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { BOUNDARY, inspectOriginal, summarizeCounterWindow, probeCompiled,
  installPageCounter, readLiveState } = require('../tools/gltron-logical-fps.cjs');
let passed = 0;
function check(name, fn) { fn(); passed++; console.log('PASS ' + name); }
// Synthetic arithmetic fixtures, never published as gameplay observations.
function samples() {
  return Array.from({ length: 22 }, (_, i) => ({ beforeMs: 100 + i * 250,
    afterMs: 100.1 + i * 250, count: i * 5, owner: 'synthetic-owner',
    endpoint: 'page-main', threadId: 1, generation: 1,
    currentCallbacks: BOUNDARY.callbackTable, marker: BOUNDARY.nonzeroDt,
    pace: 0, tierGuard: 0, chain: 1, uop: 1, live: { live: true, game: 900, data: 1000 } }));
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
async function pageFixture({ installNow = true } = {}) {
  const memory = new WebAssembly.Memory({ initial: 1 });
  const view = new DataView(memory.buffer), addr = new Map([
    [BOUNDARY.currentCallbacks, 256], [BOUNDARY.game2Pointer, 260], [0x800030, 264] ]);
  view.setUint32(256, BOUNDARY.callbackTable, true);
  view.setUint32(260, 0x800000, true); view.setUint32(264, 0, true);
  for (const [va, offset, value] of [[BOUNDARY.gamePointer, 300, 0x900000],
    [0x900000, 304, 0x910000], [0x900004, 308, 4], [0x900008, 312, 0xffffffff],
    [0x90000c, 316, 1], [0x910004, 320, 0x920000], [0x920008, 324, 0x41080000],
    [0x920000, 328, 0], [0x920020, 332, 0x930000], [0x920024, 336, 0]]) {
    addr.set(va, offset); view.setUint32(offset, value, true);
  }
  let marker = 0, pace = 0, tier = 0, frozen = false;
  const e = { memory, get_current_thread_id: () => 1, get_image_base: () => 0x400000,
    get_logical_frame_addr: () => marker, get_logical_frame_pace: () => pace,
    get_logical_frame_count: () => 123, guest_to_wasm: va => addr.get(va) || 0,
    get_block_chain: () => 1, get_uop: () => 1, get_dbg_tier_guard: () => tier };
  const instance = { exports: e }, threadManager = { threads: new Map() };
  const wine = { instance, running: true, threadManager,
    _setLogicalFrame: async (a, p) => { marker = a; pace = p; } };
  const window = { wine, __gltronReadLiveState: readLiveState, WineFrozen: { status: () => ({ frozen }) },
    __gltronGameplayReview: { name: 'fixture', capturedAtMs: 100, callbacks: BOUNDARY.callbackTable, generation: 1 },
    __gltronModuleObservation: { instances: [{ instance, generation: 1 }] } };
  let now = 100;
  const document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
  const context = vm.createContext({ window, document, performance: { now: () => now += 0.01 },
    setInterval: () => 1, clearInterval() {}, DataView });
  const install = vm.runInContext('(' + installPageCounter.toString() + ')', context);
  if (installNow) await install(BOUNDARY, 'fixture', 'fixture');
  return { window, wine, e, instance, view, state: window.__gltronCounter,
    install,
    setTier: v => { tier = v; }, setFrozen: v => { frozen = v; } };
}
async function main() {
  for (const [offset, bits] of [[324, 0xbf800000], [324, 0], [324, 0x7fc00000], [316, 2], [312, 1]]) {
    const f = await pageFixture({ installNow: false }); f.view.setUint32(offset, bits, true);
    await assert.rejects(f.install(BOUNDARY, 'dead-fixture', 'fixture'), /live player/);
    check('actual producer refuses dead/finished player despite exact gameCallbacks ' + offset + ':' + bits, () => {
      assert.equal(f.e.get_logical_frame_addr(), 0);
      assert.equal(f.window.__gltronCounterRejection.live.live, false);
    });
  }
  const deadInterval = await pageFixture(); deadInterval.view.setUint32(324, 0xbf800000, true);
  assert.throws(() => deadInterval.state.read(), /live player/);
  check('exact callback match cannot hide a player-one crash during interval', () => {
    const out = deadInterval.state.finish();
    assert.equal(out.rejection.live.translations.speed.bits, 0xbf800000);
    assert.equal(out.rejection.currentCallbacks, BOUNDARY.callbackTable);
    assert.equal(deadInterval.e.get_logical_frame_addr(), 0);
  });
  check('summary rejects missing liveness and replaced round', () => {
    for (const live of [undefined, { live: false }, { live: true, game: 901, data: 1000 }]) {
      const rows = samples(); rows[10].live = live;
      assert.throws(() => summarizeCounterWindow(rows), /live player/);
    }
  });
  for (const patch of [{ capturedAtMs: -5000 }, { capturedAtMs: 200 }, { generation: 2 }, { callbacks: 0x42a860 }, { name: 'other' }]) {
    const f = await pageFixture({ installNow: false });
    Object.assign(f.window.__gltronGameplayReview, patch);
    await assert.rejects(f.install(BOUNDARY, 'fixture', 'fixture'), /fresh reviewed gameplay/);
    check('actual arming rejects stale or mismatched review ' + JSON.stringify(patch), () => {
      assert.equal(f.e.get_logical_frame_addr(), 0);
      assert.equal(f.window.__gltronCounterRejection.callbacks.value, BOUNDARY.callbackTable);
    });
  }
  const changed = await pageFixture();
  changed.view.setUint32(256, 0x42a860, true);
  assert.throws(() => changed.state.read(), /scene/);
  check('actual interval rejection preserves first exact translation before cleanup', () => {
    const out = changed.state.finish();
    assert.equal(out.rejection.translations.callbacks.value, 0x42a860);
    assert.equal(out.rejection.translations.callbacks.offset, 256);
    assert.equal(out.rejection.marker, BOUNDARY.nonzeroDt);
    assert.equal(changed.e.get_logical_frame_addr(), 0);
  });
  for (const rejectedCallbacks of [0, 0x42a860, 0x42a204]) {
    const f = await pageFixture({ installNow: false });
    f.view.setUint32(256, rejectedCallbacks, true);
    await assert.rejects(f.install(BOUNDARY, 'review-to-arm-fixture', 'fixture'), /not active gameCallbacks; observed 0x/);
    check('pre-arm scene change retains translated rejection ' + rejectedCallbacks.toString(16), () => {
      const r = f.window.__gltronCounterRejection;
      assert.equal(r.callbacks.va, BOUNDARY.currentCallbacks);
      assert.equal(r.callbacks.offset, 256); assert.equal(r.callbacks.value, rejectedCallbacks);
      assert.equal(r.expectedCallbacks, BOUNDARY.callbackTable);
      assert.equal(r.generation, 1); assert.equal(r.threadId, 1);
      assert.equal(r.marker, 0); assert.equal(r.pace, 0); assert.equal(r.tierGuard, 0);
      assert.equal(f.e.get_logical_frame_addr(), 0); assert.equal(f.e.get_logical_frame_count(), 123);
      assert.equal(f.window.__gltronCounter, undefined);
    });
  }
  const unreadable = await pageFixture();
  unreadable.view.setUint32(256, 0x42a860, true);
  unreadable.view.setUint32(260, 0, true);
  assert.throws(() => unreadable.state.read(), /untranslated/);
  check('changed scene retains exact callback even when its game pointer cannot translate', () => {
    assert.equal(unreadable.state.finish().rejection.translations.callbacks.value, 0x42a860);
  });
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
  const { captureForReview, shotCommand, commandAck, steeringSample, chooseSteering, balancedKey, requireReleases, normalClose, requiredShellPaths, validateShellPins, bootInputs, validateRequiredPins, validateHistory, validateHttpPaths, within } = require('../tools/gltron-logical-fps-local.cjs');
  const localCandidate = require('../tools/gltron-logical-fps-local.cjs');
  assert.equal(typeof localCandidate.requireHandoffProbe, 'function', 'actual runner must gate Chrome on the complete VIEW-to-reviewed-action rehearsal');
  check('ordinary steering chooses clear front or safer native A/S turn', () => {
    const sample = { live: { live: true, direction: 0 }, callbacks: BOUNDARY.callbackTable,
      position: [50, 50], segments: [[0, 0, 100, 0], [0, 100, 100, 0], [0, 0, 0, 100], [100, 0, 0, 100]] };
    assert.equal(chooseSteering(sample).key, 'a');
    sample.segments.push([60, 0, 0, 100]); assert.equal(chooseSteering(sample).key, 's');
    sample.segments.pop(); sample.segments.push([40, 0, 0, 100]); assert.equal(chooseSteering(sample).key, 'a');
    sample.position = [50, 95]; sample.segments = [[0, 0, 100, 0]]; assert.equal(chooseSteering(sample).key, null);
    sample.live.live = false; assert.throws(() => chooseSteering(sample), /live player/);
  });
  check('observed original turn permits narrow-corridor escape that old 300ms cooldown suppressed', () => {
    const { steeringDecision } = localCandidate;
    // Actual last live sample at 20:39:25.121Z, before the next sample died.
    const sample = { live: { live: true, direction: 2, trailOffset: 7 },
      callbacks: BOUNDARY.callbackTable, position: [259.23211669921875, 570.8626956939697],
      segments: [[540, 576.0936279296875, -366.80322265625, 0],
        [173.19677734375, 576.0936279296875, 0, -88.39434051513672],
        [540, 360, 0, 216.09359741210938]] };
    const pending = { direction: 1, trailOffset: 6 };
    assert(45192.669999837875 - 44919.09999990463 < 300);
    assert.equal(chooseSteering(sample).key, 's');
    assert.equal(steeringDecision(sample, pending).key, 's');
    assert.equal(steeringDecision(sample, sample.live).key, null);
    assert.equal(steeringDecision(sample, sample.live).awaitingTurn, true);
    sample.live.live = false;
    assert.throws(() => steeringDecision(sample, pending), /live player/);
  });
  check('partial original direction/trail changes cannot acknowledge pending native turn; old producer fails', () => {
    const current = localCandidate.steeringDecision;
    const old = vm.runInNewContext('(' + current.toString().replace(
      'sample.live.direction === pendingTurn.direction ||', 'sample.live.direction === pendingTurn.direction &&') + ')', { chooseSteering });
    const sample = { live: { live: true, direction: 2, trailOffset: 7 },
      callbacks: BOUNDARY.callbackTable, position: [50, 50],
      segments: [[0, 0, 100, 0], [0, 100, 100, 0], [0, 0, 0, 100], [100, 0, 0, 100]] };
    for (const pending of [{ direction: 1, trailOffset: 7 }, { direction: 2, trailOffset: 6 }]) {
      assert(old(sample, pending).key, 'old producer sends a second turn on a partial ACK');
      assert.equal(current(sample, pending).key, null);
      assert.equal(current(sample, pending).awaitingTurn, true);
    }
    assert(current(sample, { direction: 1, trailOffset: 6 }).key);
    sample.live.live = false;
    assert.throws(() => current(sample, sample.live), /live player/);
  });
  for (const reject of [false, true]) {
    const calls = [], held = new Set(), page = { keyboard: { down: async key => calls.push('down:' + key), up: async key => calls.push('up:' + key) } };
    const result = balancedKey(page, 'a', held, async () => { if (reject) throw Error('input fixture'); });
    if (reject) await assert.rejects(result, /input fixture/); else await result;
    check('native steering is balanced even on wait failure ' + reject, () => {
      assert.deepEqual(calls, ['down:a', 'up:a']); assert.equal(held.size, 0);
    });
  }
  const steerFixture = await pageFixture({ installNow: false });
  // A true memory-backed read of the browser sampler rejects dead state before
  // trying any trail geometry. Same translated speed used by counter guards.
  steerFixture.view.setUint32(324, 0xbf800000, true);
  steerFixture.e.guest_to_wasm = va => va === BOUNDARY.currentCallbacks ? 256 : ({
    [BOUNDARY.gamePointer]: 300, 0x900000: 304, 0x900004: 308, 0x900008: 312,
    0x90000c: 316, 0x910004: 320, 0x920008: 324, 0x920000: 328, 0x920020: 332, 0x920024: 336 }[va] || 0);
  const sampled = vm.runInContext('(' + steeringSample.toString() + ')', vm.createContext({ window: steerFixture.window, DataView, performance })).call(null, BOUNDARY);
  assert.throws(() => chooseSteering(sampled), /live player/);
  check('actual browser sampler refuses crash with matching callback before steering', () => assert.equal(sampled.live.live, false));
  const captureDir = fs.mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'gltron-capture-fixture-'));
  try {
    const calls = [];
    let rect = { x: 10, y: 185, width: 800, height: 600, right: 810, bottom: 785 };
    const page = { evaluate: async (fn, name) => {
      calls.push('capture-start');
      return vm.runInNewContext('(' + fn.toString() + ')', {
        window: {}, performance: { now: () => 100 }, innerWidth: 1200, innerHeight: 900,
        document: { querySelector: () => ({ getBoundingClientRect: () => rect }) },
      })(name);
    }, screenshot: async ({ path, clip, type, optimizeForSpeed }) => {
      assert.deepEqual(JSON.parse(JSON.stringify(clip)), { x: 10, y: 185, width: 800, height: 600 });
      assert.equal(type, 'png'); assert.equal(optimizeForSpeed, true);
      await new Promise(resolve => setTimeout(resolve, 20));
      calls.push('pixels'); fs.writeFileSync(path, 'offline fixture only');
    } };
    const capture = await captureForReview(page, captureDir, 'fresh');
    // The tool caller can capture and VIEW the returned exact path in a single
    // invocation, eliminating the ACK -> new model turn -> image-path handoff.
    const view = file => { calls.push('view'); assert.equal(fs.readFileSync(file, 'utf8'), 'offline fixture only'); };
    view(capture.path);
    check('actual shot producer returns exact pixels and capture epoch for one-invocation VIEW relay', () => {
      assert.deepEqual(calls, ['capture-start', 'pixels', 'view']);
      assert.equal(capture.name, 'fresh'); assert.equal(capture.capturedAtMs, 100);
      assert(capture.captureCompletedAtEpochMs - capture.capturedAtEpochMs >= 20);
      assert.equal(capture.sha256, require('../tools/gltron-logical-fps.cjs').sha256(Buffer.from('offline fixture only')));
    });
    await assert.rejects(captureForReview(page, captureDir, 'fresh'), /fresh capture/);
    await assert.rejects(captureForReview(page, captureDir, '../foreign'), /fresh capture/);
    check('capture relay refuses overwrite and foreign capture paths', () => {});
    rect = { ...rect, bottom: 901 };
    await assert.rejects(captureForReview(page, captureDir, 'outside'), /visible complete game canvas/);
    assert(!fs.existsSync(require('node:path').join(captureDir, 'outside.png')));
    check('real capture callback reads complete canvas bounds and rejects clipping before screenshot', () => {});
  } finally { fs.rmSync(captureDir, { recursive: true }); }
  const queueDir = fs.mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'gltron-command-fixture-'));
  try {
    fs.mkdirSync(require('node:path').join(queueDir, 'commands'));
    const page = { evaluate: async (fn, name) => name ? { name, capturedAtMs: 100, generation: 1, callbacks: BOUNDARY.callbackTable } : {},
      screenshot: async ({ path }) => fs.writeFileSync(path, 'ACK fixture, not screenshot evidence') };
    const pending = commandAck(queueDir, { action: 'shot', name: 'actual-shot' }, 1000);
    const command = JSON.parse(fs.readFileSync(require('node:path').join(queueDir, 'commands/0.json')));
    const capture = await shotCommand(page, queueDir, command.name);
    fs.writeFileSync(require('node:path').join(queueDir, 'reply-0.json'), JSON.stringify({ ok: true, capture }));
    const ack = await pending;
    check('actual command queue/shot producer/ACK client compose with exact capture', () => assert.equal(ack.capture.sha256, capture.sha256));
    const { reviewedCapture, requireHandoffProbe } = localCandidate;
    const epoch = capture.capturedAtEpochMs;
    for (const now of [epoch - 1, epoch + 5001, NaN]) assert.throws(() => reviewedCapture(queueDir, 'actual-shot', now), /five seconds/);
    assert.equal(reviewedCapture(queueDir, 'actual-shot', epoch + 5000).ageMs, 5000);
    const replay = require('node:path').join(queueDir, 'offline-relay'); fs.mkdirSync(replay);
    fs.mkdirSync(require('node:path').join(replay, 'commands'));
    const replayPending = commandAck(replay, { action: 'shot', name: 'actual-shot' }, 1000);
    const replayCapture = await shotCommand(page, replay, 'actual-shot');
    const replayReply = require('node:path').join(replay, 'reply-0.json');
    const replayAck = { ok: true, capture: replayCapture };
    fs.writeFileSync(replayReply, JSON.stringify(replayAck));
    await replayPending;
    const proof = await commandAck(replay, { action: 'review-only', review: 'actual-shot' }, 100);
    assert(requireHandoffProbe(queueDir, proof.review.reviewedAtEpochMs).ok);
    for (const patch of [{ ok: false }, { capture: { ...replayCapture, path: '/foreign' } },
      { capture: { ...replayCapture, sha256: 'wrong' } },
      { capture: { ...replayCapture, capturedAtEpochMs: replayCapture.capturedAtEpochMs - 1 } }]) {
      fs.writeFileSync(replayReply, JSON.stringify({ ...replayAck, ...patch }));
      assert.throws(() => requireHandoffProbe(queueDir), /shot ACK/);
      await assert.rejects(commandAck(replay, { action: 'review-only', review: 'actual-shot' }), /shot ACK/);
      fs.writeFileSync(replayReply, JSON.stringify(replayAck));
      fs.writeFileSync(require('node:path').join(replay, 'review-handoff.json'), JSON.stringify(proof));
    }
    check('actual review client and pre-Chrome gate reject failed/path/hash/epoch shot ACKs', () => {});
    const replayMetadata = require('node:path').join(replay, 'actual-shot-capture-start.json');
    for (const patch of [{ path: '/foreign' }, { sha256: 'wrong' }, { capturedAtEpochMs: NaN }]) {
      fs.writeFileSync(replayMetadata, JSON.stringify({ ...replayCapture, ...patch }));
      assert.throws(() => requireHandoffProbe(queueDir), /capture|five seconds/);
    }
    fs.writeFileSync(replayMetadata, JSON.stringify(replayCapture));
    check('actual pre-Chrome gate rechecks named capture path hash and capture epoch', () => {});
    check('actual rehearsal client and pre-Chrome gate require full exact review within unchanged five seconds', () => {
      assert.throws(() => requireHandoffProbe(queueDir, proof.review.reviewedAtEpochMs + 300001), /fresh offline/);
      const failed = { ...proof, ok: false }; fs.writeFileSync(require('node:path').join(replay, 'review-handoff.json'), JSON.stringify(failed));
      assert.throws(() => requireHandoffProbe(queueDir), /rehearsal/);
    });
    replayCapture.capturedAtEpochMs = Date.now() - 10000;
    fs.writeFileSync(require('node:path').join(replay, 'actual-shot-capture-start.json'), JSON.stringify(replayCapture));
    await assert.rejects(commandAck(replay, { action: 'review-only', review: 'actual-shot' }, 100), /five seconds/);
    assert.equal(JSON.parse(fs.readFileSync(require('node:path').join(replay, 'review-handoff.json'))).ok, false);
    await assert.rejects(commandAck(replay, { action: 'measure', review: 'actual-shot' }, 100), /five seconds/);
    check('stale reviewed-action rejects before any live command or Chrome, preserving rejection', () => {
      assert.deepEqual(fs.readdirSync(require('node:path').join(replay, 'commands')), ['0.json']);
      assert.equal(JSON.parse(fs.readFileSync(require('node:path').join(replay, 'commands/0.json'))).action, 'shot');
      assert.throws(() => requireHandoffProbe(queueDir), /rehearsal/);
    });
    const firstClientFault = fs.readFileSync(require('node:path').join(replay, 'client-first-failure.json'), 'utf8');
    assert.equal(JSON.parse(firstClientFault).queued, false);
    assert.match(JSON.parse(firstClientFault).error, /five seconds/);
    await assert.rejects(commandAck(replay, { action: 'measure', review: 'actual-shot' }, 100), /prior client first fault/);
    await assert.rejects(commandAck(replay, { action: 'shot', name: 'retry' }, 100), /prior client first fault/);
    check('prequeue first fault persists atomically and forbids subsequent gameplay or capture commands', () => {
      assert.equal(fs.readFileSync(require('node:path').join(replay, 'client-first-failure.json'), 'utf8'), firstClientFault);
      assert.deepEqual(fs.readdirSync(require('node:path').join(replay, 'commands')), ['0.json']);
      assert(!fs.existsSync(require('node:path').join(replay, 'client-first-failure.json.tmp')));
    });
    fs.writeFileSync(require('node:path').join(queueDir, 'reply-1.json'), JSON.stringify({ ok: true, capture: { ...capture, path: '/foreign' } }));
    await assert.rejects(commandAck(queueDir, { action: 'shot', name: 'actual-shot' }, 100), /exact capture/);
    check('actual ACK client refuses foreign capture even after successful command', () => {});
    fs.writeFileSync(require('node:path').join(queueDir, 'reply-1.json'), JSON.stringify({ ok: false }));
    await assert.rejects(commandAck(queueDir, { action: 'shot', name: 'more' }, 100), /prior ACK failed/);
    check('actual command client never progresses past unsuccessful ACK', () => {});
  } finally { fs.rmSync(queueDir, { recursive: true }); }
  check('shell pin preflight rejects omitted fonts/manifest before Chrome', () => {
    const { sha256 } = require('../tools/gltron-logical-fps.cjs');
    const pins = requiredShellPaths().map(path => { const b = fs.readFileSync(path); return { path, bytes: b.length, sha256: sha256(b) }; });
    validateShellPins(pins);
    for (let i = 0; i < pins.length; i++) assert.throws(() => validateShellPins(pins.filter((_, n) => n !== i)), /shell pin/);
    const bad = pins.map(p => ({ ...p })); bad[0].sha256 = 'bad';
    assert.throws(() => validateShellPins(bad), /shell pin/);
  });
  const boot = await bootInputs();
  const productionPins = boot.paths.map(path => { const b = fs.readFileSync(path); return { path, bytes: b.length, sha256: require('../tools/gltron-logical-fps.cjs').sha256(b) }; });
  check('actual production boot graph includes original media, both modules and shared CRT', () => {
    validateRequiredPins(productionPins, boot.paths);
    assert(boot.dlls.some(d => d.path === 'test/binaries/dlls/msvcrt.dll'));
    assert(boot.paths.includes('lib/process-boot.js'));
    for (const p of productionPins) {
      assert.throws(() => validateRequiredPins(productionPins.filter(r => r !== p), boot.paths), /production pin/);
      assert.throws(() => validateRequiredPins(productionPins.map(r => r === p ? { ...r, sha256: 'stale' } : r), boot.paths), /production pin/);
    }
  });
  check('historical HTTP validation rejects unknown paths, stale hashes and sizes', () => {
    assert(validateHistory(productionPins, productionPins).pass);
    for (const patch of [{ path: 'missing' }, { sha256: 'stale' }, { bytes: -1 }])
      assert.throws(() => validateHistory(productionPins, [{ ...productionPins[0], ...patch }]), /prior HTTP pin/);
  });
  check('exact repaired-entry Stronghold assignment release required for sole WebGL entry', () => {
    const owned = '2026-11-04T21:27:19Z stronghold-repaired-entry OWN tools/stronghold-local-runtime.cjs docs/re-notes/stronghold-repaired-entry-original-gameplay-20261104.md\n';
    const released = '2026-11-04T21:30:00+00:00 stronghold-repaired-entry LOCAL HEAVY RELEASE';
    const valid = owned + released;
    assert(requireReleases(valid));
    for (const line of [
      valid.replace('stronghold-repaired-entry LOCAL', 'mdk2-installed-original LOCAL'),
      valid.replace('stronghold-repaired-entry LOCAL', 'stronghold-fresh-complete LOCAL'),
      valid.replace('21:30:00', '21:27:18'), valid.replace('2026-', '2027-'),
      valid.replace(' LOCAL HEAVY RELEASE', ' RELEASE'),
      valid.replace('stronghold-repaired-entry-original-gameplay-20261104.md', 'other-assignment.md'),
      owned + released.replace('stronghold-repaired-entry LOCAL', 'stronghold-repaired-entry-other LOCAL'),
      released, released + '\n' + owned,
      owned.replace('21:27:19', '21:27:18') + released,
      owned + '2026-11-04T21:28:00Z stronghold-repaired-entry OWN other-assignment\n' + released,
      owned + '2026-11-04T21:30:00Z coordinator quotes ' + released,
      valid.replace('2026-11-04T21:30:00+00:00 ', '')])
      assert.throws(() => requireReleases(line), /stronghold-repaired-entry/);
    const producer = fs.readFileSync(require.resolve('../tools/gltron-logical-fps-local.cjs'), 'utf8');
    assert.match(producer, /for \(const backend of \['webgl'\]\)/);
    assert(!producer.includes("for (const backend of ['software', 'webgl'])"));
  });
  const { spawnSync } = require('node:child_process');
  // Execute the actual CLI entry point with every process/server/browser path
  // trapped. A missing lock check can fail this test, never launch Chrome.
  async function unflockedCli(source, argv = ['--run', '/missing-gltron-unflocked-fixture']) {
    const filename = require.resolve('../tools/gltron-logical-fps-local.cjs');
    const entry = { exports: {} }, errors = [], traps = [];
    const trap = name => () => { traps.push(name); throw Error('SPAWN TRAP ' + name); };
    const load = require('node:module').createRequire(filename);
    const mockedRequire = name => {
      if (name === 'node:child_process') return new Proxy({}, { get: (_, key) => trap('child_process.' + String(key)) });
      if (name === 'puppeteer') return { launch: trap('Chrome') };
      if (name === '../test/static-server.js') return { startStaticServer: trap('server') };
      return load(name);
    };
    mockedRequire.main = entry;
    const childProcess = { pid: process.pid, argv: [process.execPath, filename, ...argv], exitCode: 0 };
    vm.runInNewContext(source, { require: mockedRequire, module: entry, exports: entry.exports,
      __dirname: require('node:path').dirname(filename), process: childProcess,
      console: { error: error => errors.push(String(error)), log: trap('unexpected stdout') },
      Buffer, setTimeout, clearTimeout }, { filename });
    await new Promise(resolve => setImmediate(resolve));
    return { errors, traps, exitCode: childProcess.exitCode };
  }
  const cliSource = fs.readFileSync(require.resolve('../tools/gltron-logical-fps-local.cjs'), 'utf8');
  const oldCli = await unflockedCli(cliSource.replace('const localFlock = requireLocalFlock();', 'const localFlock = null;'));
  assert(!oldCli.errors.some(error => /required local flock/.test(error)), 'old producer must fail the lock contract');
  const guardedCli = await unflockedCli(cliSource);
  check('actual unflocked --run rejects before proof/server/Chrome with all spawn paths trapped; old producer fails', () => {
    assert.equal(oldCli.exitCode, 1);
    assert.equal(oldCli.errors.length, 1);
    assert.match(oldCli.errors[0], /ENOENT.*review-handoff\.json/);
    assert.equal(guardedCli.exitCode, 1);
    assert.equal(guardedCli.errors.length, 1);
    assert.match(guardedCli.errors[0], /required local flock/);
    assert.deepEqual(guardedCli.traps, []);
    assert.deepEqual(oldCli.traps, []);
  });
  const atomicDir = fs.mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'gltron-atomic-review-'));
  try {
    const relay = require('node:path').join(atomicDir, 'offline-relay');
    fs.mkdirSync(relay);
    fs.writeFileSync(require('node:path').join(relay, 'stale.png'), 'offline atomic fixture');
    fs.writeFileSync(require('node:path').join(relay, 'stale-capture-start.json'), JSON.stringify({
      name: 'stale', path: require('node:path').join(relay, 'stale.png'),
      sha256: require('../tools/gltron-logical-fps.cjs').sha256(Buffer.from('offline atomic fixture')),
      capturedAtEpochMs: Date.now() - 10000 }));
    const guarded = await unflockedCli(cliSource, ['--review-run', atomicDir, 'stale']);
    const fallthrough = cliSource.replace(
      "await commandAck(path.join(path.resolve(run), 'offline-relay'), { action: 'review-only', review: process.argv[4] });",
      "await commandAck(path.join(path.resolve(run), 'offline-relay'), { action: 'review-only', review: process.argv[4] }).catch(() => {});");
    assert.notEqual(fallthrough, cliSource);
    const old = await unflockedCli(fallthrough, ['--review-run', atomicDir, 'stale']);
    check('actual atomic review/run CLI never enters runtime after failed offline review; old fallthrough fails', () => {
      assert.equal(guarded.exitCode, 1); assert.equal(old.exitCode, 1);
      assert.match(guarded.errors[0], /five seconds/);
      assert.match(old.errors[0], /required local flock/);
      assert.deepEqual(guarded.traps, []); assert.deepEqual(old.traps, []);
    });
  } finally { fs.rmSync(atomicDir, { recursive: true }); }
  async function publicationFixture(writerSource) {
    const dir = fs.mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'gltron-ack-publish-'));
    fs.mkdirSync(require('node:path').join(dir, 'commands'));
    const script = `
      const fs = require('node:fs'), path = require('node:path');
      const out = process.argv[1], original = fs.writeFileSync;
      const write = (${writerSource});
      fs.writeFileSync = (file, data, ...args) => {
        original(file, '');
        original(path.join(out, 'publication-window.json'), JSON.stringify({ path: file, emptyForMs: 250 }));
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
        original(file, data, ...args);
      };
      const timer = setInterval(() => {
        if (!fs.existsSync(path.join(out, 'commands', '0.json'))) return;
        clearInterval(timer); write(path.join(out, 'reply-0.json'), { ok: true });
      }, 5);
    `;
    const child = require('node:child_process').spawn(process.execPath, ['-e', script, dir], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = ''; child.stderr.on('data', b => { stderr += b; });
    const exited = new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', (code, signal) => resolve({ code, signal })); });
    try {
      let ack, error;
      try { ack = await commandAck(dir, { action: 'key', key: 'Enter' }, 2500); }
      catch (e) { error = { name: e.name, message: e.message }; }
      assert.deepEqual(await exited, { code: 0, signal: null }, stderr);
      return { ack, error, window: JSON.parse(fs.readFileSync(require('node:path').join(dir, 'publication-window.json'))) };
    } finally { fs.rmSync(dir, { recursive: true }); }
  }
  const producerSource = localCandidate.writeJson.toString();
  const oldProducerSource = producerSource.replace("  const temp = file + '.tmp';", '')
    .replace('fs.writeFileSync(temp,', 'fs.writeFileSync(file,').replace('  fs.renameSync(temp, file);', '');
  const partialOld = await publicationFixture(oldProducerSource);
  const partialNew = await publicationFixture(producerSource);
  check('actual ACK writer/client old partial-file race fails; atomic producer waits and accepts complete ACK', () => {
    assert.equal(partialOld.error.name, 'SyntaxError');
    assert.match(partialOld.error.message, /Unexpected end of JSON input/);
    assert(partialOld.window.path.endsWith('reply-0.json'));
    assert.equal(partialNew.error, undefined); assert.equal(partialNew.ack.ok, true);
    assert(partialNew.window.path.endsWith('reply-0.json.tmp'));
  });
  const lockDir = fs.mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'gltron-lock-fixture-'));
  try {
    const lock = require('node:path').join(lockDir, 'runtime.lock');
    fs.writeFileSync(lock, '');
    const modulePath = require.resolve('../tools/gltron-logical-fps-local.cjs');
    const script = `console.log(JSON.stringify(require(${JSON.stringify(modulePath)}).requireLocalFlock(process.argv[1])))`;
    const without = spawnSync(process.execPath, ['-e', script, lock], { encoding: 'utf8' });
    assert.notEqual(without.status, 0); assert.match(without.stderr, /required local flock/);
    const held = spawnSync('flock', ['-n', lock, process.execPath, '-e', script, lock], { encoding: 'utf8' });
    assert.equal(held.status, 0, held.stderr); assert.equal(JSON.parse(held.stdout).path, lock);
    const other = require('node:path').join(lockDir, 'other.lock'); fs.writeFileSync(other, '');
    const foreign = spawnSync('flock', ['-n', other, process.execPath, '-e', script, lock], { encoding: 'utf8' });
    assert.notEqual(foreign.status, 0); assert.match(foreign.stderr, /required local flock/);
    const holder = require('node:child_process').spawn('flock', ['-n', lock, process.execPath, '-e',
      "process.stdout.write('held'); process.stdin.resume(); process.stdin.on('end', () => process.exit(0));"]);
    const exited = new Promise(resolve => holder.once('exit', (code, signal) => resolve({ code, signal })));
    try {
      await within(() => new Promise((resolve, reject) => { holder.stdout.once('data', resolve); holder.once('error', reject); }), 3000, 'fixture flock');
      const unrelated = spawnSync(process.execPath, ['-e', script, lock], { encoding: 'utf8' });
      assert.notEqual(unrelated.status, 0); assert.match(unrelated.stderr, /required local flock/);
    } finally { holder.stdin.end(); assert.deepEqual(await within(() => exited, 3000, 'fixture closure'), { code: 0, signal: null }); }
    check('actual inherited flock required; absent other-file and unrelated same-file holders reject', () => {});
  } finally { fs.rmSync(lockDir, { recursive: true }); }
  assert((await validateHttpPaths(productionPins, ['/binaries/gltron-0.70/gltron.exe', '/build/wine-assembly.compat.wasm'])).pass);
  await assert.rejects(validateHttpPaths(productionPins, ['/missing-gltron-asset']), /route failed/);
  await assert.rejects(validateHttpPaths([], ['/binaries/gltron-0.70/gltron.exe']), /pin mismatch/);
  check('actual offline HTTP rewrite rejects a missing asset and an unpinned response', () => {});
  assert.equal(await within(async () => 7, 100, 'fixture'), 7);
  await assert.rejects(within(() => new Promise(() => {}), 5, 'fixture'), /fixture deadline/);
  check('bounded operation preserves success and rejects an unresolved operation', () => {});
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
  for (const outcome of ['abnormal', 'deadline']) {
    const c = new EventEmitter(); Object.assign(c, { pid: 124, exitCode: null, signalCode: null });
    const rows = [];
    const b = { process: () => c, disconnect() {}, target: () => ({ createCDPSession: async () => ({ send: async () => {
      if (outcome === 'abnormal') queueMicrotask(() => { c.signalCode = 'SIGKILL'; c.emit('exit', null, 'SIGKILL'); });
    } }) }) };
    await assert.rejects(normalClose(b, r => rows.push(r), 10), outcome === 'abnormal' ? /abnormal/ : /deadline/);
    check('closure preserves ' + outcome + ' instead of claiming normal exit', () => {
      assert(!rows.some(r => r.event === 'actual-owned-exit' && r.code === 0));
      if (outcome === 'abnormal') assert(rows.some(r => r.signal === 'SIGKILL'));
    });
  }
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
