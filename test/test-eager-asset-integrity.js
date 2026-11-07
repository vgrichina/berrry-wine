'use strict';
// Full production host + VirtualFS. No guest, browser, compilation or network.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { createRequire } = require('module');
const { VirtualFS } = require('../lib/filesystem');
const { APPS } = require('../lib/apps');
const { normalizeLazyFiles } = require('../lib/app-files');
const repo = path.resolve(__dirname, '..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const hostSource = fs.readFileSync(path.join(repo, 'host.js'), 'utf8');
const hashingSource = fs.readFileSync(path.join(repo, 'lib/watx-launcher.js'), 'utf8');
const results = [];

function hostFor(platform) {
  const sandbox = { console: { log() {}, warn() {}, error() {} },
    Uint8Array, ArrayBuffer, AbortController, URL, URLSearchParams,
    TextEncoder, TextDecoder, setTimeout, clearTimeout };
  if (platform === 'node') sandbox.require = createRequire(path.join(repo, 'host.js'));
  else if (platform !== 'unavailable') {
    sandbox.window = {};
    if (platform === 'webcrypto') sandbox.crypto = crypto.webcrypto;
  }
  const context = vm.createContext(sandbox);
  if (sandbox.window) vm.runInContext(hashingSource, context, { filename: 'lib/watx-launcher.js' });
  // No source extraction, transformation or replacement loader.
  vm.runInContext(hostSource, context, { filename: 'host.js' });
  const Host = vm.runInContext('WineAssembly', context);
  const host = Object.create(Host.prototype);
  host._helpCtx = { vfs: new VirtualFS() };
  return { Host, host, vfs: host._helpCtx.vfs };
}

async function synthetic(platform) {
  const { Host, host, vfs } = hostFor(platform);
  const original = Uint8Array.from([1, 2, 3, 4]);
  const file = { url: 'fixture/data.bin', vfsPaths: ['c:\\data.bin', 'd:\\alias.bin'],
    loadMode: 'required', size: original.length, sha256: hash(original) };
  const absent = () => {
    assert(!vfs.files.has('c:\\data.bin'));
    assert(!vfs.files.has('d:\\alias.bin'));
  };
  Host.fetchAssetBytes = async () => Uint8Array.from([9, 2, 3, 4]);
  await assert.rejects(host.loadFiles([file]), /SHA-256 mismatch/); absent();
  Host.fetchAssetBytes = async () => original.subarray(0, 3);
  await assert.rejects(host.loadFiles([file]), /size mismatch/); absent();
  Host.fetchAssetBytes = async () => { throw new Error('HTTP 404'); };
  await assert.rejects(host.loadFiles([file]), /failed to load/); absent();
  Host.fetchAssetBytes = async () => original;
  await host.loadFiles([file]);
  assert.equal(hash(vfs.files.get('c:\\data.bin').data), file.sha256);
  assert.equal(hash(vfs.files.get('d:\\alias.bin').data), file.sha256);
  // Reused URL does not let a second declaration escape validation.
  await assert.rejects(host.loadFiles([file, { ...file, sha256: '0'.repeat(64),
    vfsPaths: ['c:\\bad-alias.bin'] }]), /SHA-256 mismatch/);
  assert(!vfs.files.has('c:\\bad-alias.bin'));
  results.push({ platform, corruptSameSize: 'reject', sizeMismatch: 'reject', missingRequired: 'reject', valid: 'PASS', conflictingHash: 'reject' });
}

async function ordinary() {
  const { Host, host, vfs } = hostFor('unavailable');
  Host.fetchAssetBytes = async () => Uint8Array.from([42]);
  await host.loadFiles(['ordinary.bin', { url: 'other.bin', vfsPath: 'c:\\other.bin' }], { required: true });
  assert.equal(vfs.files.get('c:\\ordinary.bin').data[0], 42);
  assert.equal(vfs.files.get('c:\\other.bin').data[0], 42);
  await assert.rejects(host.loadFiles([{ url: 'pinned.bin', loadMode: 'required', size: 1,
    sha256: hash(Uint8Array.from([42])) }]), /validation unavailable/);
  assert(!vfs.files.has('c:\\pinned.bin'));
  results.push({ ordinaryUnpinnedWithoutHashing: 'PASS', unavailableHashing: 'reject' });
}

async function registeredQuakeControls() {
  // This first-launch file is tracked emulator input, not optional local media.
  // Exercise the stamped registry through the production loader: a stale size
  // used to abort the entire original browser launch before guest execution.
  const file = APPS.quake3_demo.files.find(f => f.url === 'lib/quake3-modern-controls.ini');
  assert(file, 'registered Quake III controls');
  const bytes = new Uint8Array(fs.readFileSync(path.join(repo, file.url)));
  const { Host, host, vfs } = hostFor('node');
  Host.fetchAssetBytes = async () => bytes;
  await host.loadFiles([file], { required: true });
  assert.equal(hash(vfs.files.get(file.vfsPath.toLowerCase()).data), hash(bytes));
  const stale = hostFor('node');
  stale.Host.fetchAssetBytes = async () => bytes;
  await assert.rejects(stale.host.loadFiles([{ ...file, size: 488 }], { required: true }), /size mismatch/);
  assert(!stale.vfs.files.has(file.vfsPath.toLowerCase()));
  results.push({ registeredQuakeControls: 'PASS', bytes: bytes.length, stale488: 'reject' });
}

async function originals(stage) {
  const { Host, host, vfs } = hostFor('node');
  const files = normalizeLazyFiles(APPS.gltron, APPS.gltron.files).files;
  let count = 0, bytes = 0;
  Host.fetchAssetBytes = async url => new Uint8Array(fs.readFileSync(path.join(stage, url.slice('binaries/gltron-0.70/'.length))));
  await host.loadFiles(files, { required: true, concurrency: 1 });
  for (const file of APPS.gltron.files) {
    const mounted = vfs.files.get(file.vfsPath.toLowerCase());
    assert(mounted); assert.equal(mounted.data.length, file.size);
    assert.equal(hash(mounted.data), file.sha256); count++; bytes += mounted.data.length;
  }
  assert.equal(count, 92); assert.equal(bytes, 4968893);
  // Actual registered Lua asset, same-size corruption at the production boundary.
  const chosen = files.find(f => f.url.endsWith('/art/classic/artpack.lua'));
  const fresh = hostFor('node');
  fresh.Host.fetchAssetBytes = async () => {
    const b = new Uint8Array(fs.readFileSync(path.join(stage, 'art/classic/artpack.lua')));
    b[0] ^= 1; return b;
  };
  await assert.rejects(fresh.host.loadFiles([chosen], { required: true }), /SHA-256 mismatch/);
  assert(!fresh.vfs.files.has(chosen.vfsPath.toLowerCase()));
  results.push({ originals: 'PASS', files: count, bytes, registeredCorruption: 'reject' });
}

(async () => {
  for (const platform of ['node', 'webcrypto', 'plain-http']) await synthetic(platform);
  await ordinary();
  await registeredQuakeControls();
  if (process.argv[2]) await originals(path.resolve(process.argv[2]));
  console.log(JSON.stringify({ hostSHA256: hash(hostSource), hashingSHA256: hash(hashingSource), results }, null, 2));
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
