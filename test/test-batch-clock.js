#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { createBatchClock } = require('../lib/batch-clock');

const clock = createBatchClock(200, 1);
clock.state.batch = 500;
assert.deepStrictEqual(
  [clock.getTicks(), clock.getTicks(), clock.getTicks(), clock.getTicks()],
  [100000, 100001, 100002, 100003],
  'calls within one batch advance deterministic guest time');

// This is the sequence that trapped SDL 1.2 in its Win32 message pump: its
// 100ms timer was armed on the fourth tick call, then the next headless batch
// reset callsInBatch while retaining the same batch number. Returning 100000
// after 100003 makes unsigned elapsed-time arithmetic report a huge interval.
clock.state.callsInBatch = 0;
assert.strictEqual(clock.getTicks(), 100003,
  'resetting a batch call counter cannot move guest time backwards');
assert.strictEqual(clock.getTicks(), 100003,
  'the clock remains clamped until the deterministic batch timeline catches up');
assert.strictEqual(clock.getTicks(), 100003);
assert.strictEqual(clock.getTicks(), 100003);
assert.strictEqual(clock.getTicks(), 100004,
  'intra-batch ticking resumes after catching the previous high-water mark');

for (let i = 0; i < 300; i++) clock.getTicks();
assert.strictEqual(clock.getTicks(), 100199,
  'calls cannot advance beyond the next deterministic batch boundary');

clock.state.batch = 501;
clock.state.callsInBatch = 0;
assert.strictEqual(clock.getTicks(), 100200,
  'a later batch advances to its deterministic base time');

assert.strictEqual(clock.setTickMsPerBatch(40), 40);
assert.strictEqual(clock.batchTicks(), 100200,
  'changing cadence rebases without moving the current guest time');
clock.state.batch = 502;
clock.state.callsInBatch = 0;
assert.strictEqual(clock.getTicks(), 100240,
  'the next batch advances using the new cadence');
assert.strictEqual(clock.getTickMsPerBatch(), 40);
assert.strictEqual(clock.getTicks(), 100241);
clock.setTickMsPerBatch(20);
assert.strictEqual(clock.batchTicks(), 100241,
  'rebasing also preserves an intra-batch tick already observed by the guest');

// The ceiling must use the rebased epoch too. Keep callsInBatch across the
// slope change, just as the scheduled tick-ms input does in the runner.
for (const row of [
  { pause: 0, initial: 30, reads: [31, 31, 31], nextBase: 32,
    nextReads: [32, 33, 33], siblingReads: [31, 32, 33], siblingNext: [40, 41, 42] },
  { pause: 17, initial: 47, reads: [48, 48, 48], nextBase: 49,
    nextReads: [49, 50, 50], siblingReads: [48, 49, 50], siblingNext: [57, 58, 59] },
]) {
  const rebased = createBatchClock(10), sibling = createBatchClock(10);
  for (const c of [rebased, sibling]) {
    c.state.batch = 3;
    c.state.pausedMs = row.pause;
    assert.strictEqual(c.getTicks(), row.initial);
  }
  const siblingBefore = { ...sibling.state };
  assert.strictEqual(rebased.setTickMsPerBatch(2), 2);
  assert.strictEqual(rebased.batchTicks(), row.initial);
  assert.strictEqual(rebased.state.callsInBatch, 1, 'setter retains spent calls');
  assert.strictEqual(rebased.getTickMsPerBatch(), 2);
  assert.deepStrictEqual([rebased.getTicks(), rebased.getTicks(), rebased.getTicks()],
    row.reads, 'rebased reads stop before the next batch base');
  assert.deepStrictEqual(sibling.state, siblingBefore, 'rebasing leaves sibling state alone');
  const rebasedBefore = { ...rebased.state };
  assert.strictEqual(sibling.getTickMsPerBatch(), 10);
  assert.deepStrictEqual([sibling.getTicks(), sibling.getTicks(), sibling.getTicks()],
    row.siblingReads, 'unchanged sibling keeps its original cadence');
  assert.deepStrictEqual(rebased.state, rebasedBefore, 'sibling reads leave rebased state alone');
  for (const c of [rebased, sibling]) {
    c.state.batch = 4;
    c.state.callsInBatch = 0;
  }
  assert.strictEqual(rebased.batchTicks(), row.nextBase);
  assert.deepStrictEqual([rebased.getTicks(), rebased.getTicks(), rebased.getTicks()],
    row.nextReads, 'next batch starts at its base without manufactured time');
  assert.deepStrictEqual([sibling.getTicks(), sibling.getTicks(), sibling.getTicks()],
    row.siblingNext);
  rebased.state.pausedMs += 7;
  assert.strictEqual(rebased.batchTicks(), row.nextBase + 7);
  assert.strictEqual(rebased.getTicks(), row.nextReads[2] + 7,
    'a later pause shifts both the base and saturated ceiling');
}

// A slope increase also gets exactly its new allowance, and a larger call
// step must saturate rather than overshoot. Pauses shift the ordinary ceiling.
for (const [slope, callStep, pause, expected] of [
  [20, 1, 0, 49], [2, 5, 0, 31], [2, 5, 17, 48],
]) {
  const c = createBatchClock(10, callStep);
  c.state.batch = 3;
  c.state.pausedMs = pause;
  c.getTicks();
  c.setTickMsPerBatch(slope);
  for (let i = 0; i < 30; i++) c.getTicks();
  assert.strictEqual(c.getTicks(), expected, 'new slope bounds repeated calls');
}
const paused = createBatchClock(10);
paused.state.batch = 3;
paused.state.pausedMs = 17;
assert.strictEqual(paused.getTicks(), 47);
for (let i = 0; i < 30; i++) paused.getTicks();
assert.strictEqual(paused.getTicks(), 56, 'ordinary paused clock saturates');
paused.state.batch = 4;
paused.state.callsInBatch = 0;
assert.strictEqual(paused.getTicks(), 57);

console.log('PASS  headless batch clock is monotonic across resets and cadence changes');
