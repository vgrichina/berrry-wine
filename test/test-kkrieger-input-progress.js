'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {advanceHold} = require('../tools/kkrieger-input-progress');
const sample = (ticks, extra = {}) => ({object: 123, ticks, physicalW: true, phase: 0,
  forward: 2, forwardSpeed: 2, focus: 1, mainHwnd: 1, ...extra});

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
    assert.deepEqual(keys, ['down:w', 'up:w']); assert.equal(restored, true);
    assert.equal(writes['progress-forward-observation'].releaseObserved, false);
  } finally { Date.now = originalNow; }
});
