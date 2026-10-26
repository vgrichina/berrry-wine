#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const {test} = require('node:test');
const {fixture, measure, budget, runCounts} = require('../tools/d3d9-rgba-benchmark');

for (const side of [16,32,64]) test(`RENDER-PERF-GATE ${side}x${side}: actual exported cache path`, async () => {
  const rows = await runCounts(side);
  const hit = rows.find(row => row.scenario === 'same-source');
  assert.equal(hit.sourceReads + hit.snapshotReads, 2*side*side*4);
  assert.equal(hit.sourceCopyBytes, 0);
  assert.equal(rows.length, 14);
});

test('RENDER-PERF-GATE rejects extra actual scans/copies and restores hooks on error', async () => {
  const f = fixture(64), original = Uint8Array, every = original.prototype.every;
  const slice = original.prototype.slice, set = original.prototype.set;
  try {
    assert.equal(f.draw(), 1); await f.drain();
    const extraScan = measure(f, () => f.source().every(() => true));
    assert.throws(() => budget(extraScan, f.bytes, f.bytes, true), /source scan complexity/);
    await f.drain();
    const extraCopy = measure(f, () => f.source().slice());
    assert.throws(() => budget(extraCopy, f.bytes, f.bytes, true), /private source copy/);
    await f.drain();
    const extraAllocation = measure(f, () => new Uint8Array(f.bytes));
    assert.throws(() => budget(extraAllocation, f.bytes, f.bytes, true), /U8 allocation budget/);
    await f.drain();
    assert.throws(() => measure(f, () => { throw new Error('hook restoration canary'); }), /canary/);
    assert.equal(Uint8Array, original);
    assert.equal(original.prototype.every, every);
    assert.equal(original.prototype.slice, slice);
    assert.equal(original.prototype.set, set);
    assert.equal(Object.hasOwn(f.bridge, '_residentLevel'), false);
    assert.equal(Object.hasOwn(f.bridge, '_rememberTexture'), false);
    const normal = measure(f);
    budget(normal, f.bytes, f.bytes, true);
    await f.drain();
  } finally { await f.close(); }
});
