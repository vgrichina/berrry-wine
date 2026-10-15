'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {advanceHold} = require('../tools/kkrieger-input-progress');
const sample = (ticks, extra = {}) => ({object: 123, ticks, physicalW: true, phase: 0,
  forward: 2, forwardSpeed: 2, focus: 1, mainHwnd: 1, ...extra});

test('completed movement comparison excludes intermediate/zero/duplicate times and rejects bad intervals', () => {
  const {summarizeMovement} = require('../tools/kkrieger-movement-state');
  const row = (time, x, extra = {}) => ({physicalW: true, forward: 2, forwardSpeed: 2,
    movement: {object: 123, phase: 0, updateContext: 0, currentTime: time, completedTime: time,
      position: [x, 1, 0], bodyPosition: [x, 2, 0], bodyCollisionPosition: [x, 3, 0],
      bodyPreviousPosition: [x, 4, 0], cameraPosition: [x, 5, 0], forwardBasis: [2, 0, 0],
      strafeBasis: [0, 0, 1], yaw: 1, pitch: 2, ...extra}});
  const rows = [row(0, 0), row(10, 1), row(10, 2), row(20, 9, {updateContext: 3}), row(30, 4)];
  const s = summarizeMovement({held: rows}).phases.held;
  assert.deepEqual(s.completedTimes, [10, 30]);
  assert.deepEqual(s.deltas.bodyPosition.xyz, [3, 0, 0]);
  assert.equal(s.deltas.bodyPosition.forwardProjectionFirst, 3);
  assert.equal(summarizeMovement({idle: rows.slice(0, 3)}).phases.idle.sufficient, false);
  assert.equal(summarizeMovement({held: [row(1, 0, {phase: 1}), row(2, 1)]}).phases.held.sufficient, false);
  assert.equal(summarizeMovement({release: rows}).phases.release.sufficient, false);
  for (const extra of [{object: 124}, {bodyPosition: [NaN, 0, 0]}, {currentTime: NaN}, {pitch: Infinity}])
    assert.throws(() => summarizeMovement({idle: [row(10, 0), row(20, 1, extra)]}));
  assert.throws(() => summarizeMovement({idle: [row(0xffffffff, 0)], held: [row(1, 1)]}), /wrap\/reset/);
  const zeroBasis = summarizeMovement({idle: [row(1, 0, {forwardBasis: [0, 0, 0]}), row(2, 1)]});
  assert.equal(zeroBasis.phases.idle.deltas.position.forwardProjectionFirst, null);
});

test('accepted key plus two later update transitions, with minimum hold', () => {
  const state = {changes: 0};
  assert.equal(advanceHold(state, sample(10), 10000), false);
  assert.equal(advanceHold(state, sample(10), 12000), false);
  assert.equal(advanceHold(state, sample(20), 14000), false);
  assert.equal(advanceHold(state, sample(30), 16000), true);
  const fast = {changes: 0};
  for (let i = 0; i < 3; i++) assert.equal(advanceHold(fast, sample(i), i * 1000), false);
});
test('host delivery, presentation, wrong focus and released input never count as held progress', () => {
  for (const extra of [{forward: 0}, {physicalW: false}, {focus: 2}, {focus: null},
    {forwardSpeed: NaN}, {forwardSpeed: 0, forward: 0}, {phase: 2}]) {
    const state = {changes: 0};
    for (let i = 0; i < 4; i++) assert.equal(advanceHold(state,
      sample(i, {...extra, presents: 1000 + i}), 10000 + i * 2000), false);
  }
});

test('retained original image independently matches every code pin when supplied', {
  skip: !process.env.WA_KKRIEGER_UNPACKED,
}, () => {
  const fs = require('node:fs'), crypto = require('node:crypto');
  const {codePins} = require('../tools/kkrieger-input-progress');
  const bytes = fs.readFileSync(process.env.WA_KKRIEGER_UNPACKED);
  const sha = b => crypto.createHash('sha256').update(b).digest('hex');
  assert.equal(sha(bytes), '42b8f545db0fce60f8f1b22035386c2a6b87653741bbb5ae4a9d24c2b6df76aa');
  for (const [address, size, expected] of codePins) {
    const segment = bytes.subarray(address - 0x800000, address - 0x800000 + size);
    assert.equal(segment.length, size); assert.equal(sha(segment), expected);
  }
});
test('lost accepted state resets progress; object replacement/counter reset fail', () => {
  const state = {changes: 0};
  advanceHold(state, sample(10), 10000); advanceHold(state, sample(20), 12000);
  advanceHold(state, sample(21, {forward: 0}), 14000);
  assert.equal(advanceHold(state, sample(30), 16000), false);
  assert.equal(advanceHold(state, sample(40), 18000), false);
  assert.throws(() => advanceHold(state, sample(41, {object: 124}), 20000), /object changed/);
  assert.throws(() => advanceHold(state, sample(1), 20000), /counter reset/);
});

test('controller preserves timeout and unobserved release as explicit failures', async () => {
  const {captureProgressHold, installProgressReader} = require('../tools/kkrieger-input-progress');
  let now = 0, down = false, restored = false;
  const originalNow = Date.now, writes = {}, keys = [];
  Date.now = () => now;
  try {
    const result = await captureProgressHold({
      page: {evaluate: async fn => {
        if (fn === installProgressReader) return sample(1);
        if (String(fn).includes('delete window')) { restored = true; return; }
        return sample(1, {physicalW: down}); // Frozen guest: never accept progress or released guest state.
      }, keyboard: {down: async key => { down = true; keys.push('down:' + key); },
        up: async key => { down = false; keys.push('up:' + key); }}},
      shot: async () => {}, event: () => {}, write: (name, value) => { writes[name] = structuredClone(value); },
      assertDelivery: async () => {}, admit: ms => assert.equal(ms, 160000),
      delay: async ms => { now += ms; },
    });
    assert.equal(result.acceptedProgress, false);
    assert.equal(result.releaseObserved, false);
    assert.match(result.holdOutcome, /without-accepted-progress/);
    assert.match(result.releaseOutcome, /without-observed-clear/);
    assert.equal(result.gameplayVerified, false);
    assert.equal(now, 140000);
    assert.deepEqual(keys, ['down:w', 'up:w', 'up:w']); assert.equal(restored, true);
    assert.equal(writes['progress-forward-observation'].releaseObserved, false);
  } finally { Date.now = originalNow; }
});

test('movement reader original pins, distinct positions, completion guard and fail-closed reads', {
  skip: !process.env.WA_KKRIEGER_UNPACKED,
}, async () => {
  const fs = require('node:fs'), crypto = require('node:crypto'), vm = require('node:vm');
  const {movementPins, installMovementReader} = require('../tools/kkrieger-movement-state');
  const original = fs.readFileSync(process.env.WA_KKRIEGER_UNPACKED);
  const sha = b => crypto.createHash('sha256').update(b).digest('hex');
  assert.equal(sha(original), '42b8f545db0fce60f8f1b22035386c2a6b87653741bbb5ae4a9d24c2b6df76aa');
  for (const [address, size, hash] of movementPins)
    assert.equal(sha(original.subarray(address - 0x800000, address - 0x800000 + size)), hash);
  const memory = new Uint8Array(0x1600000), view = new DataView(memory.buffer), object = 0x1000000;
  memory.set(original, 0x800000);
  const u = (a, n) => view.setUint32(a, n, true);
  const f = (a, n) => view.setFloat32(a, n, true);
  u(0x14a0998, object); u(0x15289b8, 400); u(0x15289b0, 390); u(object, 42);
  u(object + 0x15540, 410);
  for (const [offset, value] of [[0x14948, 1], [0x14a3c, 2], [0x14a4c, 3],
    [0x14a5c, 4], [0x15380, 5], [0x15328, 6], [0x15308, 7]]) f(object + offset, value);
  let unmapped = -1;
  const wine = {running: true, memory, renderer: {_physicalKeys: {87: true}},
    instance: {exports: {guest_to_wasm: a => a === unmapped ? 0xf0 : a}}};
  const context = {window: {wineShell: {currentWine: wine}}, performance: {now: () => 123},
    crypto: crypto.webcrypto, pins: movementPins};
  const install = () => vm.runInNewContext('(' + installMovementReader.toString() + ')(pins)', context);
  const before = sha(memory);
  const initial = await install(), read = context.window.__kkriegerMovementRead;
  assert.equal(sha(memory), before, 'installation and reads do not mutate guest memory');
  assert.equal(initial.betweenUpdates, false); assert.equal(initial.requestedSteps, 410);
  assert.equal(initial.position[0], 1); assert.equal(initial.bodyPosition[0], 2);
  assert.equal(initial.bodyCollisionPosition[0], 3); assert.equal(initial.bodyPreviousPosition[0], 4);
  assert.equal(initial.cameraPosition[0], 5); assert.equal(initial.forwardBasis[0], 6);
  assert.equal(initial.strafeBasis[0], 7);
  u(object, 0); assert.equal(read().betweenUpdates, false, 'clear context alone is insufficient');
  u(0x15289b0, 400); assert.equal(read().betweenUpdates, true);
  u(object, 42); assert.equal(read().betweenUpdates, false, 'matching times alone are insufficient');
  u(object, 0);
  u(0x15289b8, 0); u(0x15289b0, 0);
  assert.equal(read().betweenUpdates, false, 'initialized zero clocks do not establish completion');
  u(0x15289b8, 400); u(0x15289b0, 400);
  for (const offset of [0x14948, 0x14a3c, 0x14a4c, 0x14a5c, 0x15380, 0x15328, 0x15308]) {
    const saved = view.getFloat32(object + offset, true);
    for (const value of [NaN, Infinity, -Infinity]) {
      f(object + offset, value); assert.throws(read, /Nonfinite/);
    }
    f(object + offset, saved);
  }
  unmapped = object + 0x14949; assert.throws(read, /Unmapped/); unmapped = -1;
  u(0x14a0998, object + 16); assert.throws(read, /replaced/); u(0x14a0998, object);
  wine.guestWorker = {}; assert.throws(read, /cooperative/); delete wine.guestWorker;
  await assert.rejects(install, /already installed/);
  delete context.window.__kkriegerMovementRead;
  memory[0x81e3c6] ^= 1;
  await assert.rejects(install, /code mismatch/);
  assert.equal(context.window.__kkriegerMovementRead, undefined);
});
