#!/usr/bin/env node
// host.js loadFiles for an `httpRange` file with `preloadRanges` (Diablo's
// spawn.mpq): the measured ranges are fetched and pinned before the guest
// starts, reported to the launch window with an exact total, and everything
// else stays on the server. A split release asset (name.part000, ...) is read
// by range across its parts. A range list measured on other bytes, or a server
// without ranges, falls back to the whole file.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const byteProvider = require('../lib/byte-provider');

const ROOT = path.join(__dirname, '..');
const FILE = new Uint8Array(70).map((_, i) => (i * 13 + 1) & 0xff);
const calls = [];
let routes = new Map();     // url -> Uint8Array (ranged), or {status}
let ranged = true;

function respond(url, init = {}) {
  calls.push(`${init.method || 'GET'} ${url}${init.headers && init.headers.Range ? ' ' + init.headers.Range : ''}`);
  const body = routes.get(url);
  if (!(body instanceof Uint8Array)) {
    return { status: 404, ok: false, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) };
  }
  const headers = new Map([['content-length', String(body.length)]]);
  if (ranged) headers.set('accept-ranges', 'bytes');
  const get = name => headers.has(name) ? headers.get(name) : null;
  if (init.method === 'HEAD') return { status: 200, ok: true, headers: { get } };
  const m = init.headers && init.headers.Range && /bytes=(\d+)-(\d+)/.exec(init.headers.Range);
  if (m && ranged) {
    const slice = body.slice(Number(m[1]), Number(m[2]) + 1);
    return { status: 206, ok: true, headers: { get }, arrayBuffer: async () => slice.buffer };
  }
  return { status: 200, ok: true, headers: { get }, arrayBuffer: async () => body.slice().buffer };
}

const context = {
  console: { log() {}, warn() {}, error: console.error },
  setTimeout, clearTimeout, URLSearchParams, Uint8Array, Promise, Error,
  fetch: async (url, init) => respond(String(url), init),
};
context.window = { byteProvider };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'host.js'), 'utf8') +
  '\n;globalThis.WineAssembly = WineAssembly;', context);
const WA = context.WineAssembly;
WA.ASSET_PART_SIZE = 32;

function makeWine() {
  const wine = Object.create(WA.prototype);
  const mounted = new Map();
  wine._helpCtx = { vfs: {
    files: new Map(),
    ensureParentDirs() {},
    setProviderFile(p, { provider }) { mounted.set(p, provider); },
    applyFileMetadata() {},
  } };
  return { wine, mounted };
}

(async () => {
  // A split release asset reads across its parts as one file.
  routes = new Map([
    ['big.mpq.part000', FILE.slice(0, 32)],
    ['big.mpq.part001', FILE.slice(32, 64)],
    ['big.mpq.part002', FILE.slice(64)],
  ]);
  calls.length = 0;
  const parted = await WA._openRangeProvider('big.mpq', { fetch: context.fetch }, byteProvider);
  assert.strictEqual(parted.size, 70);
  assert.deepStrictEqual(Array.from(await parted.readRange(30, 36)), Array.from(FILE.slice(30, 66)));
  assert.deepStrictEqual(calls.slice(0, 4), ['GET big.mpq', 'GET big.mpq.part000',
    'GET big.mpq.part001', 'GET big.mpq.part002']);

  // Neither form exists: the original 404 surfaces (loadFiles then falls back).
  routes = new Map();
  await assert.rejects(WA._openRangeProvider('none.mpq', { fetch: context.fetch }, byteProvider), /GET none\.mpq → 404/);

  // Preload: only the listed ranges move before start, with an exact total.
  routes = new Map([['spawn.mpq', FILE]]);
  calls.length = 0;
  const events = [];
  let { wine, mounted } = makeWine();
  await wine.loadFiles([{
    url: 'spawn.mpq', vfsPath: 'c:\\spawn.mpq', httpRange: true,
    preloadRanges: { schemaVersion: 1, size: 70, ranges: [[0, 4], [66, 70]] },
  }], { required: true, transfer: { onTransfer: e => events.push(e) } });
  const cache = mounted.get('c:\\spawn.mpq');
  assert.ok(cache, 'mounted provider-backed');
  // 1MB chunks over a 70-byte file: one chunk, which is the whole file here.
  assert.strictEqual(cache.stats.pinnedChunks, 1);
  assert.ok(cache.tryRead(66, 4), 'pinned range is a synchronous hit');
  const done = events.filter(e => e.kind === 'done');
  assert.strictEqual(done.length, 1);
  assert.strictEqual(done[0].total, 70);
  assert.deepStrictEqual(calls, ['GET spawn.mpq']);

  // With realistic chunking only the chunks the ranges touch are fetched.
  const CHUNK = require('../lib/byte-provider').DEFAULT_CHUNK_SIZE;
  const big = new Uint8Array(3 * CHUNK + 5).map((_, i) => i & 0xff);
  routes = new Map([['huge.mpq', big]]);
  calls.length = 0;
  ({ wine, mounted } = makeWine());
  await wine.loadFiles([{
    url: 'huge.mpq', vfsPath: 'c:\\huge.mpq', httpRange: true,
    preloadRanges: [[10, 20], [3 * CHUNK, 3 * CHUNK + 5]],
  }], { required: true });
  assert.deepStrictEqual(calls, ['GET huge.mpq']);
  assert.ok(mounted.get('c:\\huge.mpq').tryRead(CHUNK + 1, 1),
    'whole source bytes also satisfy unpinned chunks');

  // A list measured on other bytes is not trusted: the whole file loads.
  routes = new Map([['spawn.mpq', FILE]]);
  calls.length = 0;
  ({ wine, mounted } = makeWine());
  await wine.loadFiles([{
    url: 'spawn.mpq', vfsPath: 'c:\\spawn.mpq', httpRange: true,
    preloadRanges: { schemaVersion: 1, size: 71, ranges: [[0, 4]] },
  }], { required: true });
  assert.strictEqual(mounted.size, 0);
  assert.strictEqual(wine._helpCtx.vfs.files.get('c:\\spawn.mpq').data.length, 70);

  // A server without ranges: whole file, as before.
  ranged = false;
  ({ wine, mounted } = makeWine());
  await wine.loadFiles([{
    url: 'spawn.mpq', vfsPath: 'c:\\spawn.mpq', httpRange: true,
    preloadRanges: { schemaVersion: 1, size: 70, ranges: [[0, 4]] },
  }], { required: true });
  assert.strictEqual(mounted.size, 1);
  assert.ok(mounted.get('c:\\spawn.mpq').tryRead(0, 1));

  // A parked read of game data: quiet retries, then Retry/Quit while parked.
  {
    const GameWait = require('../lib/game-wait');
    context.window.GameWait = GameWait;
    const wine = Object.create(WA.prototype);
    wine.running = true;
    wine.logToUI = () => {};
    let stopped = 0;
    wine.stop = () => { stopped++; wine.running = false; };
    let failuresLeft = 3;
    const fills = [];
    const cache = { gameData: true, chunkSize: 262144,
      fill: async (off, len) => { fills.push(off); if (failuresLeft-- > 0) throw new Error('x answered 503, expected 206'); } };
    let vfsFills = 0;
    const vfs = { fillPendingRead: async () => { vfsFills++; return true; } };
    const pending = { provider: cache, path: 'c:\\spawn.mpq', offset: 300000, length: 16 };
    const result = wine._fillParkedRead(vfs, pending);
    // Two quiet retries (250 + 500 ms), then the question.
    for (let i = 0; i < 40 && !(wine._gameWait && wine._gameWait.current && wine._gameWait.current.state === 'error'); i++) {
      await new Promise(r => setTimeout(r, 50));
    }
    assert.strictEqual(wine._gameWait.current.state, 'error');
    assert.strictEqual(wine._gameWait.current.file, 'spawn.mpq');
    assert.strictEqual(vfsFills, 0, 'the guest stays parked while the player decides');
    wine._gameWait.action('retry');
    assert.strictEqual(await result, true);
    assert.deepStrictEqual(fills, [300000, 300000, 300000, 300000]);
    assert.strictEqual(vfsFills, 1);
    assert.strictEqual(stopped, 0);

    failuresLeft = 99;
    const quitting = wine._fillParkedRead(vfs, pending);
    for (let i = 0; i < 40 && !(wine._gameWait.current && wine._gameWait.current.state === 'error'); i++) {
      await new Promise(r => setTimeout(r, 50));
    }
    wine._gameWait.action('quit');
    assert.strictEqual(await quitting, false);
    assert.strictEqual(stopped, 1);
    assert.strictEqual(vfsFills, 1, 'no late commit after Quit');

    // Not game data (a dropped File): the plain VFS contract.
    const plain = { provider: { fill: async () => {} } };
    wine.running = true;
    assert.strictEqual(await wine._fillParkedRead(vfs, plain), true);
    assert.strictEqual(vfsFills, 2);
  }

  console.log('PASS  range preload launch: pinned ranges, split parts, honest fallbacks');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
