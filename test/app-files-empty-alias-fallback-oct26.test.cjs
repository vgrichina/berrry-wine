'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const test = require('node:test');
const { normalizeLazyFiles, APP_EAGER_BYTES } = require('../lib/app-files');
const host = fs.readFileSync(path.join(__dirname, '..', 'host.js'), 'utf8');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
// Exact extraction recipe accepted in independent review 2ff9d314.
const start = host.indexOf('  async loadFiles(urls, options = {}) {');
const end = host.indexOf('\n  async loadDlls(', start);
assert(start >= 0 && end > start);
assert.equal(host.indexOf('  async loadFiles(urls, options = {}) {', start + 1), -1);
const excerpt = host.slice(start, end);
assert.equal(sha(host), '03eb8a7ab8dfae1f6e2a16c7943be2ed582a3f463029ae950043f0b2c0569ee4');
assert.equal(Buffer.byteLength(excerpt), 16464);
assert.equal(sha(excerpt), '5fbb544b0f29130c90f2c14685e979bdfa40caaf43dfeb4d6181a26e62933659');
const fetched = [];
const context = vm.createContext({ WineAssembly: {
  _throwIfAssetAborted() {}, _transferSeq: 0,
  fetchAssetBytes: async url => { fetched.push(url); return Uint8Array.of(13); },
  bundleName: () => null, _prefetchBundled: async () => new Map(),
} });
const actualHost = vm.runInContext('({' + excerpt + '})', context);
async function mounted(file) {
  const vfs = { files: new Map(), ensureParentDirs() {} };
  await actualHost.loadFiles.call({ _helpCtx: { vfs } }, [file],
    { required: true, concurrency: 1 });
  for (const entry of vfs.files.values()) assert.deepEqual([...entry.data], [13]);
  assert.equal(fetched.at(-1), typeof file === 'string' ? file : file.url);
  return [...vfs.files.keys()];
}
function policy(file, patterns, appOptions = {}, options = {}, ballast = APP_EAGER_BYTES - 1) {
  const app = Object.freeze({ persistFiles: Object.freeze([...patterns]), ...appOptions });
  // Exactly the threshold with a one-byte target: eager-small-app cannot mask persistence.
  const files = Object.freeze([file, Object.freeze({ url: 'bulk.pak', size: ballast })]);
  const before = JSON.stringify({ app, files });
  const result = normalizeLazyFiles(app, files, { sizeOf: () => 1, ...options });
  assert.equal(JSON.stringify({ app, files }), before);
  assert.notEqual(result.files, files);
  return result;
}
const urls = [
  'Data/Save.bin#part', 'DATA\\SaVe.BIN?rev=9#Part',
  'https://unit.invalid/DATA/SaVe.BIN?rev=9#part',
  'Data/Save.bin?dir=/OTHER.BIN', 'Data/Save.bin#dir\\OTHER.BIN',
  'Data/Save%2EBIN?rev=9', 'Data/Save.bin',
];

test('empty aliases fall back to actual literal URL basename and keep persisted files eager', async () => {
  for (const url of urls) {
    const file = Object.freeze({ url, size: 1, vfsPaths: Object.freeze([]), tag: 'preserved' });
    const names = await mounted(file);
    assert.equal(names.length, 1);
    const out = policy(file, names);
    assert.equal(out.summary.policy, 'lazy');
    assert.equal(out.files[0], file, names[0]);
    assert.equal(policy(file, ['Z:/unrelated.bin']).files[0].httpRange, true);
    if (url === urls[0]) {
      assert.deepEqual(names, ['c:\\save.bin#part']);
      assert.equal(policy(file, ['c:/save.bin']).files[0].httpRange, true);
    }
  }
});

test('empty aliases prefer explicit fallback paths including case and separators', async () => {
  for (const vfsPath of ['D:/Save.bin', 'd:\\SAVE.BIN', '/SaVe.bin#Part', 'Save.bin?rev=9']) {
    const file = Object.freeze({ url: 'Data/Remote.bin#part', size: 1, vfsPaths: Object.freeze([]), vfsPath });
    const names = await mounted(file);
    assert.equal(names.length, 1);
    assert.equal(policy(file, names).files[0], file);
    assert.equal(policy(file, ['Z:/unrelated.bin']).files[0].httpRange, true);
    assert.equal(policy(file, ['c:/remote.bin#part']).files[0].httpRange, true);
  }
});

test('nonempty aliases retain precedence over explicit fallback and URL', async () => {
  const file = Object.freeze({ url: urls[0], size: 1, vfsPath: 'D:/fallback.bin',
    vfsPaths: Object.freeze(['E:/Save.bin', '/Alias.bin#Part']) });
  const names = await mounted(file);
  assert.equal(names.length, 2);
  for (const name of names) assert.equal(policy(file, [name]).files[0], file);
  for (const name of ['D:/fallback.bin', 'c:/save.bin#part'])
    assert.equal(policy(file, [name]).files[0].httpRange, true);
});

test('explicit loading declarations remain authoritative with empty aliases', async () => {
  for (const decl of [{ loadMode: 'required' }, { loadMode: 'lazy' }, { loadMode: 'background' },
    { httpRange: true }, { httpRange: false }, { eager: true },
    { preloadRanges: Object.freeze([[0, 1]]) }, { decodeImage: true }]) {
    const file = Object.freeze({ url: urls[0], size: 1, vfsPaths: Object.freeze([]), ...decl });
    // Mount naming is obtained without invoking intentional transport/decode declarations.
    const names = await mounted({ url: file.url, vfsPaths: [] });
    assert.equal(policy(file, names).files[0], file);
    assert.equal(policy(file, ['Z:/unrelated.bin']).files[0], file);
  }
});

test('whole-app eager gates, unknown sizes and eager extensions remain unchanged', () => {
  const file = Object.freeze({ url: urls[0], size: 1, vfsPaths: Object.freeze([]) });
  assert.equal(policy(file, [], { lazyFiles: false }).files[0], file);
  assert.equal(policy(file, [], {}, { isWin16: true }).files[0], file);
  const small = policy(file, [], {}, {}, APP_EAGER_BYTES - 2);
  assert.equal(small.summary.policy, 'eager: small app');
  assert.equal(small.files[0], file);
  assert.equal(policy(file, []).files[0].httpRange, true, 'exact threshold streams nonmatches');
  const unknown = Object.freeze({ url: urls[0], vfsPaths: Object.freeze([]) });
  assert.equal(policy(unknown, [], {}, { sizeOf: () => undefined }).files[0], unknown);
  for (const url of ['Data/CONFIG.INI?dir=/save.bin', 'Data/CONFIG.INI#part']) {
    const ini = Object.freeze({ url, size: 1, vfsPaths: Object.freeze([]) });
    assert.equal(policy(ini, []).files[0], ini);
  }
});

test('strings and ordinary objects retain literal identities and nonmutation behavior', async () => {
  for (const url of urls) for (const file of [url, Object.freeze({ url, size: 1, metadata: { id: 7 } })]) {
    const names = await mounted(file);
    assert.equal(policy(file, names).files[0], file);
    const lazy = policy(file, []).files[0];
    assert.equal(lazy.httpRange, true);
    assert.equal(lazy.url, url);
    assert.equal(lazy.size, 1);
    if (typeof file === 'object') assert.equal(lazy.metadata, file.metadata);
  }
});

test('empty-alias nonmatching lazy copy preserves metadata and alias array identity', () => {
  const file = Object.freeze({ url: urls[0], size: 1, vfsPaths: Object.freeze([]),
    metadata: Object.freeze({ id: 9 }) });
  const lazy = policy(file, ['D:/unrelated.bin']).files[0];
  assert.notEqual(lazy, file);
  assert.equal(lazy.httpRange, true);
  assert.equal(lazy.vfsPaths, file.vfsPaths);
  assert.equal(lazy.metadata, file.metadata);
});
