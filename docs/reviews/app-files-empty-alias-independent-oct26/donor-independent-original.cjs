'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const test = require('node:test');
const root = path.resolve(__dirname, '..');
const host = fs.readFileSync(path.join(root, 'host.js'), 'utf8');
const source = fs.readFileSync(path.join(root, 'lib/app-files.js'), 'utf8');
const { normalizeLazyFiles, APP_EAGER_BYTES } = require('../lib/app-files');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const start = host.indexOf('  async loadFiles(urls, options = {}) {');
const end = host.indexOf('\n  async loadDlls(', start);
assert(start >= 0 && end > start);
const excerpt = host.slice(start, end);
const context = vm.createContext({ WineAssembly: {
  _throwIfAssetAborted() {}, _transferSeq: 0,
  fetchAssetBytes: async () => Uint8Array.of(13),
  bundleName: () => null, _prefetchBundled: async () => new Map(),
} });
const actualHost = vm.runInContext('({' + excerpt + '})', context);

// Every naming oracle below executes production loadFiles. Only byte transport
// is stubbed: no independently rewritten URL-to-guest-name rule is used.
async function mounted(file) {
  const vfs = { files: new Map(), ensureParentDirs() {} };
  await actualHost.loadFiles.call({ _helpCtx: { vfs } }, [file],
    { required: true, concurrency: 1 });
  return [...vfs.files.keys()];
}
function classify(file, patterns, normalize = normalizeLazyFiles, options = {}, ballast = APP_EAGER_BYTES + 1) {
  const snapshot = JSON.stringify(file);
  const out = normalize({ persistFiles: patterns }, [file, { url: 'bulk.pak', size: ballast }],
    { sizeOf: () => 1, ...options }).files[0];
  assert.equal(JSON.stringify(file), snapshot);
  return out;
}
const urls = [
  'https://unit.invalid/DATA/SaVe.BIN?rev=9#part',
  'DATA\\SaVe.BIN#Part',
  'DATA/SaVe.BIN?dir=/OTHER.BIN',
  'DATA/SaVe.BIN#dir\\OTHER.BIN',
  'DATA/SaVe%2EBIN?rev=9',
  'DATA/SaVe.BIN',
];

test('exact pinned host and policy; executable excerpt has finite unique boundaries', () => {
  assert.equal(sha(host), '03eb8a7ab8dfae1f6e2a16c7943be2ed582a3f463029ae950043f0b2c0569ee4');
  assert.equal(sha(source), 'b360f892416309bc0f492ff77da5f939ee93af0c53585a7629c035eb8b7ecfc3');
  assert.equal(host.indexOf('  async loadFiles(urls, options = {}) {', start + 1), -1);
  assert(excerpt.length < 30000);
  console.log(JSON.stringify({ excerptBytes: Buffer.byteLength(excerpt), excerptSha256: sha(excerpt) }));
});

test('string and object URLs: persistence follows real host keys across suffixes/separators/case', async () => {
  for (const url of urls) for (const file of [url, Object.freeze({ url, size: 1 })]) {
    const names = await mounted(file);
    assert.equal(names.length, 1);
    assert.equal(classify(file, names), file, 'actual mounted identity must stay eager: ' + url);
    assert.equal(classify(file, ['C:/UNRELATED.BIN']).httpRange, true);
    if (url.includes('?rev=9#part')) {
      assert.equal(names[0], 'c:\\save.bin?rev=9#part');
      assert.equal(classify(file, ['c:\\save.bin']).httpRange, true);
    }
  }
});

test('explicit nonempty aliases and precedence use actual mount identities', async () => {
  for (const override of [
    { vfsPath: '/SaVe.BIN' },
    { vfsPath: 'D:/SAVE.BIN' },
    { vfsPaths: ['D:/Other.BIN', 'c:\\SaVe.BIN'] },
    { vfsPath: 'c:/ignored.bin', vfsPaths: ['D:/SAVE.BIN'] },
  ]) {
    const file = Object.freeze({ url: 'DATA/remote.bin?v=/other.bin#x', size: 1, ...override });
    const names = await mounted(file);
    for (const name of names) assert.equal(classify(file, [name]), file);
    assert.equal(classify(file, ['c:/remote.bin']).httpRange, true);
    if (override.vfsPaths && override.vfsPath)
      assert.equal(classify(file, [override.vfsPath]).httpRange, true);
  }
});

test('anchored persistence glob boundaries do not become URL parsing', async () => {
  const file = Object.freeze({ url: 'Data/Save.bin#X', size: 1 });
  assert.deepEqual(await mounted(file), ['c:\\save.bin#x']);
  for (const pattern of ['C:/SAVE.BIN*', 'c:/save.bin#?', 'c:/save.bin#x'])
    assert.equal(classify(file, [pattern]), file);
  for (const pattern of ['c:/save.bin', 'c:/save.bin#', 'd:/save.bin*', 'c:/save.bin#??'])
    assert.equal(classify(file, [pattern]).httpRange, true);
});

test('classification boundaries: extension suffix handling, total threshold and unknown sizes', () => {
  for (const url of ['Data/CONFIG.INI?dir=/save.bin', 'Data/CONFIG.INI#save.bin']) {
    const file = Object.freeze({ url, size: 1 });
    assert.equal(classify(file, []), file, 'INI classification strips suffix before extracting extension');
  }
  const file = Object.freeze({ url: 'Data/save.bin?rev=1', size: 1 });
  assert.equal(classify(file, [], normalizeLazyFiles, {}, APP_EAGER_BYTES - 2), file);
  assert.equal(classify(file, [], normalizeLazyFiles, {}, APP_EAGER_BYTES - 1).httpRange, true);
  assert.equal(classify(file, [], normalizeLazyFiles, { isWin16: true }), file);
  const unknown = Object.freeze({ url: file.url });
  assert.equal(classify(unknown, [], normalizeLazyFiles, { sizeOf: () => undefined }), unknown);
});

test('suffix stripping mutant disagrees with actual mounted identity and is rejected', async () => {
  const needle = "fileUrl(file).replace(/^.*[\\\\/]/, '').toLowerCase()";
  assert.equal(source.split(needle).length, 2, 'one bounded object-default mutation site');
  const mutant = source.replace(needle,
    "fileUrl(file).replace(/[?#].*$/, '').replace(/^.*[\\\\/]/, '').toLowerCase()");
  const module = { exports: {} };
  vm.runInNewContext(mutant, { module, exports: module.exports });
  for (const suffix of ['?v=2', '#part']) {
    const file = { url: 'Data/Save.bin' + suffix, size: 1 };
    const names = await mounted(file);
    assert.equal(classify(file, names), file);
    assert.equal(classify(file, ['c:/save.bin']).httpRange, true);
    assert.equal(classify(file, names, module.exports.normalizeLazyFiles).httpRange, true);
    assert.equal(classify(file, ['c:/save.bin'], module.exports.normalizeLazyFiles), file);
    const stripped = { ...file, url: file.url.replace(/[?#].*$/, '') };
    assert.notDeepEqual(await mounted(stripped), names, 'stripping really changes production mount identity');
  }
});

test('pre-existing boundary: empty vfsPaths host fallback differs from policy (outside new assertions)', async () => {
  for (const override of [{ vfsPaths: [] }, { vfsPaths: [], vfsPath: 'D:/Save.bin' }]) {
    const file = { url: 'Data/Save.bin#part', size: 1, ...override };
    const names = await mounted(file);
    assert.equal(names.length, 1, 'host falls back from an empty alias list');
    assert.equal(classify(file, names).httpRange, true, 'existing policy treats [] as no paths');
  }
});
