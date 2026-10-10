#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { BytesProvider, ConcatProvider, ChunkCache } = require('../lib/byte-provider');

function part(size, returnedLength) {
  return {
    size,
    readRangeSync: () => new Uint8Array(returnedLength).fill(7),
    readRange: async () => new Uint8Array(returnedLength).fill(7),
  };
}

(async () => {
  // A short first part used to shift the second part left and zero-pad the
  // tail. The result had the requested length and passed ChunkCache's guard.
  for (const returnedLength of [0, 1, 3]) {
    for (const badIndex of [0, 1]) {
      const parts = [part(2, 2), part(2, 2)];
      parts[badIndex] = part(2, returnedLength);
      const provider = new ConcatProvider(parts);
      assert.throws(() => provider.readRangeSync(0, 4), /ConcatProvider:.*returned.*expected/);
      await assert.rejects(provider.readRange(0, 4), /ConcatProvider:.*returned.*expected/);
      // Single-piece reads must enforce the same contract.
      assert.throws(() => provider.readRangeSync(badIndex * 2, 2), /ConcatProvider:/);
      await assert.rejects(provider.readRange(badIndex * 2, 2), /ConcatProvider:/);
    }
  }

  const truncated = new ConcatProvider([part(2, 1), part(2, 2)]);
  const cache = new ChunkCache(truncated, { chunkSize: 4, prefetch: 0 });
  await assert.rejects(cache.fill(0, 4), /ConcatProvider:/);
  assert.strictEqual(cache._chunks.size, 0, 'corrupt joined bytes must never enter the cache');

  const provider = new ConcatProvider([
    new BytesProvider(Uint8Array.of(1, 2)),
    new BytesProvider(new Uint8Array(0)),
    new BytesProvider(Uint8Array.of(3, 4, 5)),
  ]);
  for (const [offset, length, expected] of [
    [0, 5, [1, 2, 3, 4, 5]], [1, 3, [2, 3, 4]], [3, 9, [4, 5]],
    [5, 1, []], [0, 0, []], [-1, 2, [1, 2]],
  ]) {
    assert.deepStrictEqual([...provider.readRangeSync(offset, length)], expected);
    assert.deepStrictEqual([...await provider.readRange(offset, length)], expected);
  }
  const asyncOnly = new ConcatProvider([{ size: 2, readRange: async () => Uint8Array.of(8, 9) }]);
  assert.strictEqual(asyncOnly.readRangeSync(0, 2), null, 'a missing sync path remains a cache miss');
  assert.deepStrictEqual([...await asyncOnly.readRange(0, 2)], [8, 9]);
  const unavailable = new ConcatProvider([{ size: 2, readRangeSync: () => null }]);
  assert.strictEqual(unavailable.readRangeSync(0, 2), null);

  assert.throws(() => new ConcatProvider([
    { size: Number.MAX_SAFE_INTEGER }, { size: 1 },
  ]), /safe integer/, 'combined size must remain representable exactly');
  console.log('PASS ConcatProvider: exact part lengths, cache rejection, boundaries and safe total size');
})().catch(error => { console.error(error); process.exitCode = 1; });
