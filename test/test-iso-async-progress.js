'use strict';

const assert = require('assert');
const Iso = require('../lib/iso9660');
const BP = require('../lib/byte-provider');
const Media = require('../lib/media-import');
const { VirtualFS } = require('../lib/filesystem');

const SECTOR = 2048, CHUNK = 65536, SIZE = 8 * 1024 * 1024;
const ROOT = 64, DIRS = 12, FAR = 3500;
function both32(b, o, n) { b.writeUInt32LE(n, o); b.writeUInt32BE(n, o + 4); }
function both16(b, o, n) { b.writeUInt16LE(n, o); b.writeUInt16BE(n, o + 2); }
function record(lba, length, name, flags = 0) {
  const id = typeof name === 'string' ? Buffer.from(name) : Buffer.from([name]);
  const b = Buffer.alloc(33 + id.length + (id.length % 2 === 0 ? 1 : 0));
  b[0] = b.length; both32(b, 2, lba); both32(b, 10, length);
  b[25] = flags; both16(b, 28, 1); b[32] = id.length; id.copy(b, 33);
  return b;
}
function fixture() {
  const b = Buffer.alloc(SIZE), pvd = b.subarray(16 * SECTOR, 17 * SECTOR);
  pvd[0] = 1; pvd.write('CD001', 1); pvd[6] = 1;
  pvd.write('CACHE_PROGRESS', 40); both32(pvd, 80, SIZE / SECTOR);
  both16(pvd, 128, SECTOR); record(ROOT, SECTOR, 0, 2).copy(pvd, 156);
  b.set([255, 67, 68, 48, 48, 49, 1], 17 * SECTOR);
  let off = ROOT * SECTOR;
  for (let i = 0; i < DIRS; i++) {
    const lba = 128 + i * 64, r = record(lba, SECTOR * 2, 'DIR' + i, 2);
    r.copy(b, off); off += r.length;
    record(lba, SECTOR * 2, 0, 2).copy(b, lba * SECTOR);
    // Second block ensures a suspended directory walk retains its position.
    record(FAR, 4096, 'FAR.BIN;1').copy(b, (lba + 1) * SECTOR);
  }
  for (let i = 0; i < 4096; i++) b[FAR * SECTOR + i] = (i * 31 + 17) & 255;
  return b;
}
function ranged(b) {
  const reads = [];
  const provider = new BP.HttpByteRangeProvider('https://fixture.invalid/disc.iso', b.length, {
    fetch: async (url, init) => {
      const range = new Headers(init.headers).get('Range');
      const m = /^bytes=(\d+)-(\d+)$/.exec(range);
      assert(m, 'every request must be a bounded HTTP range');
      const a = +m[1], z = +m[2];
      assert(z - a + 1 <= CHUNK, 'never fetch the whole image');
      reads.push([a, z + 1]);
      return new Response(b.subarray(a, z + 1), { status: 206,
        headers: { 'Content-Range': `bytes ${a}-${z}/${b.length}` } });
    },
  });
  const cache = new BP.ChunkCache(provider, { chunkSize: CHUNK, maxChunks: 3,
    readAhead: 1, prefetch: 1 });
  return { provider, cache, reads };
}
async function drained(cache) {
  while (cache._inflight.size) await Promise.all([...cache._inflight.values()]);
  assert(cache._chunks.size <= 3, 'LRU stays bounded');
  assert.equal(cache._pinned.size, 0, 'metadata must not be pinned outside the LRU');
}
async function main() {
  const b = fixture(), { provider, cache, reads } = ranged(b);
  try {
    const plan = await Media.analyze({ name: 'disc.iso', source: cache });
    assert.equal(plan.kind, 'iso'); assert.equal(plan.entryCount, DIRS);
    await drained(cache);
    assert(cache.stats.prefetches > 0, 'exercise actual background prefetch');
    assert(reads.every(([a, z]) => z <= FAR * SECTOR), 'file data stays lazy during analysis');
    const vfs = new VirtualFS(); await plan.mount(vfs);
    assert.equal(vfs.dirs.has('d:\\dir11'), true);
    const got = await vfs.materialize('D:\\DIR11\\FAR.BIN');
    assert.deepStrictEqual(Buffer.from(got), b.subarray(FAR * SECTOR, FAR * SECTOR + 4096));
    await drained(cache);
    assert.equal(provider._whole, null);
    assert(reads.length <= 64, `metadata traversal must progress, got ${reads.length} reads`);
    assert(reads.reduce((n, [a, z]) => n + z - a, 0) < SIZE / 2);
    console.log('PASS bounded async ISO progress:', JSON.stringify({ reads: reads.length,
      bytes: cache.stats.bytesFetched, chunks: cache._chunks.size, prefetches: cache.stats.prefetches }));
  } finally {
    await drained(cache); provider.close();
    console.log('HTTP/cache totals:', JSON.stringify({ requests: reads.length,
      unique: new Set(reads.map(r => r.join(':'))).size, ...cache.stats }));
  }

  for (const [mutate, pattern] of [
    [b => { b[(128 + 11 * 64 + 1) * SECTOR] = 33; }, /malformed directory record length/],
    [b => { record(FAR, 1, '..\\BAD;1').copy(b, (128 + 11 * 64 + 1) * SECTOR); }, /unsafe directory identifier/],
    [b => { both32(b, ROOT * SECTOR + 2, SIZE / SECTOR); }, /directory .* extent is outside/],
    [b => { b[16 * SECTOR + 80 + 4] ^= 1; }, /disagrees/],
  ]) {
    const broken = fixture(); mutate(broken);
    assert.throws(() => Iso.parseIso(broken), pattern);
    const r = ranged(broken);
    try { await assert.rejects(Iso.parseIsoAsync(r.cache), pattern); }
    finally { await drained(r.cache); r.provider.close(); }
    assert(r.reads.length <= 64, 'malformed metadata must fail without rewalking');
  }
  const badCache = { size: SIZE, tryRead: () => null, fill: async () => {} };
  await assert.rejects(Iso.parseIsoAsync(badCache), /not caching|did not satisfy/);
  console.log('PASS async malformed metadata, unsafe paths, extents and failed cache');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
