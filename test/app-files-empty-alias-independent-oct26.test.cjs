'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const test = require('node:test');
const root = path.resolve(__dirname, '..');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const source = fs.readFileSync(path.join(root, 'lib/app-files.js'), 'utf8');
assert.equal(sha(source), '4c1ce40b92aa990a4bc689bd98d5c0d92ab3af44dafeb93ca52ccbaf2c6124f7');
const candidate = require('../lib/app-files');
const host = fs.readFileSync(path.join(root, 'host.js'), 'utf8');
assert.equal(sha(host), '03eb8a7ab8dfae1f6e2a16c7943be2ed582a3f463029ae950043f0b2c0569ee4');
const header = '  async loadFiles(urls, options = {}) {';
const start = host.indexOf(header);
const end = host.indexOf('\n  async loadDlls(', start);
assert(start >= 0 && end > start && host.indexOf(header, start + 1) === -1);
const method = host.slice(start, end);
assert.equal(Buffer.byteLength(method), 16464);
assert.equal(sha(method), '5fbb544b0f29130c90f2c14685e979bdfa40caaf43dfeb4d6181a26e62933659');

// Mutations affect only the policy loaded in this VM, never candidate files.
function policyApi(mutation) {
  if (!mutation) return candidate;
  const changes = {
    guard: ['Array.isArray(file.vfsPaths) && file.vfsPaths.length', 'Array.isArray(file.vfsPaths)'],
    priority: ['Array.isArray(file.vfsPaths) && file.vfsPaths.length', 'false'],
    suffix: ["fileUrl(file).replace(/^.*[\\\\/]/, '')", "fileUrl(file).replace(/[?#].*$/, '').replace(/^.*[\\\\/]/, '')"],
  };
  assert(changes[mutation], 'known targeted mutation');
  const [from, to] = changes[mutation];
  assert.equal(source.split(from).length, 2, 'unique mutation target');
  const sandbox = { module: { exports: {} } };
  vm.runInNewContext(source.replace(from, to), sandbox, { timeout: 1000 });
  return sandbox.module.exports;
}
const api = policyApi(process.env.APP_FILES_MUTATION);
function classify(file, patterns, app = {}, options = {}) {
  const input = Object.freeze([file, Object.freeze({ url: 'ballast.pak', size: candidate.APP_EAGER_BYTES })]);
  const before = JSON.stringify(input);
  const out = api.normalizeLazyFiles({ persistFiles: patterns, ...app }, input, options);
  assert.equal(JSON.stringify(input), before, 'policy never mutates declarations');
  return out.files[0];
}

// Execute the complete actual source method. Only byte transport and provider
// construction are bounded local seams; path selection/normalization are host code.
async function mount(file, { missing = false } = {}) {
  const events = [];
  class Provider {
    constructor(url, size) { this.url = url; this.size = size; events.push(['provider', url, size]); }
  }
  const vfs = {
    files: new Map(),
    ensureParentDirs(p) { events.push(['parent', p]); },
    setProviderFile(p, entry) {
      events.push(['lazy', p]);
      this.files.set(p.toLowerCase().replace(/\//g, '\\'), entry);
    },
  };
  const context = {
    console: { log: s => events.push(['log', s]), warn: s => events.push(['warn', s]) },
    window: { WINE_HTTP_RANGES: true, byteProvider: {
      HttpByteRangeProvider: Provider, HttpRangeProvider: Provider, cached: p => p,
    } },
    WineAssembly: {
      _transferSeq: 0, _throwIfAssetAborted() {}, bundleName: () => null,
      _prefetchBundled: async () => new Map(), _downloadReason: e => String(e),
      fetchAssetBytes: async url => {
        events.push(['fetch', url]);
        if (missing) throw new Error('HTTP 404');
        return Uint8Array.of(42);
      },
    },
  };
  const actual = vm.runInNewContext('({' + method + '})', context, { timeout: 1000 });
  await actual.loadFiles.call({ _helpCtx: { vfs } }, [file], { concurrency: 1, required: true });
  return { names: [...vfs.files.keys()], entries: [...vfs.files.values()], events };
}
function frozen(row) {
  if (Array.isArray(row.vfsPaths)) Object.freeze(row.vfsPaths);
  return Object.freeze({ size: 1, ...row });
}
async function assertPersistence(file, expectedNames, excluded = []) {
  const original = await mount(file);
  assert.deepEqual(original.names, expectedNames, 'independent explicit guest identity');
  for (const name of expectedNames) {
    const normalized = classify(file, [name]);
    assert.equal(normalized, file, 'matching mounted path must stay eager: ' + name);
    const loaded = await mount(normalized);
    assert.deepEqual(loaded.names, expectedNames);
    assert.equal(loaded.events.filter(e => e[0] === 'fetch').length, 1);
    assert.equal(loaded.events.filter(e => e[0] === 'provider').length, 0);
    for (const entry of loaded.entries) assert.deepEqual([...entry.data], [42]);
  }
  for (const name of ['z:/absent.bin', ...excluded]) {
    const normalized = classify(file, [name]);
    assert.equal(normalized.httpRange, true, 'nonmatching identity stays lazy: ' + name);
    const loaded = await mount(normalized);
    assert.deepEqual(loaded.names, expectedNames);
    assert.equal(loaded.events.filter(e => e[0] === 'fetch').length, 0);
    assert.equal(loaded.events.filter(e => e[0] === 'provider').length, 1);
  }
}

test('independent empty-list URL fallbacks preserve literal suffixes and comma names', async () => {
  const rows = [
    ['dir/Save.bin#Tail', 'c:\\save.bin#tail', 'c:/save.bin'],
    ['dir/Save.bin?Rev=2', 'c:\\save.bin?rev=2', 'c:/save.bin'],
    ['https://unit.invalid/Save.bin?dir=/Other.bin', 'c:\\other.bin', 'c:/save.bin'],
    ['dir/Save.bin#dir\\Other.bin', 'c:\\other.bin', 'c:/save.bin'],
    ['dir/Save%2Ebin#Tail', 'c:\\save%2ebin#tail', 'c:/save.bin#tail'],
    ['dir/Save,One.bin', 'c:\\save,one.bin', 'c:/save.bin'],
  ];
  for (const [url, name, wrong] of rows)
    await assertPersistence(frozen({ url, vfsPaths: [] }), [name], [wrong]);
});

test('independent empty-list explicit paths normalize exactly as actual host', async () => {
  const rows = [
    ['D:/SaVe/One.bin#Tail', 'd:\\save\\one.bin#tail'],
    ['\\\\SaVe\\One.bin', 'c:\\save\\one.bin'],
    ['SaVe/One.bin', 'c:\\save\\one.bin'],
    ['D:One.bin', 'd:one.bin'],
    ['E:/SaVe.bin?Rev=2', 'e:\\save.bin?rev=2'],
  ];
  for (const [vfsPath, name] of rows)
    await assertPersistence(frozen({ url: 'dir/remote.bin#tail', vfsPaths: [], vfsPath }), [name], ['c:/remote.bin#tail']);
});

test('nonempty aliases suppress both fallbacks, retain alias order and shared fetch/provider', async () => {
  const file = frozen({ url: 'dir/remote.bin#tail', vfsPath: 'D:/fallback.bin',
    vfsPaths: ['E:/One.bin', '/Two.bin#Tail', 'F:/Three,Four.bin'] });
  await assertPersistence(file, ['e:\\one.bin', 'c:\\two.bin#tail', 'f:\\three,four.bin'],
    ['d:/fallback.bin', 'c:/remote.bin#tail']);
});

test('absent/non-array aliases and falsy explicit paths follow host fallback', async () => {
  for (const vfsPaths of [undefined, null, 'ignored', []])
    for (const vfsPath of [undefined, null, '']) {
      await assertPersistence(frozen({ url: 'dir/default.bin#tail', vfsPaths, vfsPath }), ['c:\\default.bin#tail']);
    }
});

test('persist globs and case/slashes match while unmatched paths keep lazy policy', async () => {
  const file = frozen({ url: 'dir/remote.bin', vfsPath: '/Save/Slot7.bin#Tail', vfsPaths: [] });
  for (const pattern of ['C:/SAVE/*.BIN#TAIL', '/save/slot?.bin#tail', '*slot7.bin#tail']) {
    assert.equal(classify(file, [pattern]), file);
    const loaded = await mount(classify(file, [pattern]));
    assert.deepEqual(loaded.names, ['c:\\save\\slot7.bin#tail']);
    assert.equal(loaded.events.filter(e => e[0] === 'fetch').length, 1);
  }
  for (const pattern of ['D:/save/*', 'C:/save/*.bin', 'C:/save/slot8*'])
    assert.equal(classify(file, [pattern]).httpRange, true);
});

test('optional persisted presence stays eager; absence remains optional and does not create a mount', async () => {
  const file = frozen({ url: 'dir/optional.bin#tail', optional: true, vfsPaths: [] });
  await assertPersistence(file, ['c:\\optional.bin#tail']);
  const out = await mount(classify(file, ['c:/optional.bin#tail']), { missing: true });
  assert.deepEqual(out.names, []);
  assert.equal(out.events.filter(e => e[0] === 'fetch').length, 1, '404 is not retried');
  assert.equal(out.events.filter(e => e[0] === 'log').length, 1);
});

test('explicit httpRange and loadMode declarations remain authoritative, including persisted matches', async () => {
  for (const declaration of [{ httpRange: true }, { httpRange: false }, { loadMode: 'required' }]) {
    const file = frozen({ url: 'dir/save.bin#tail', vfsPaths: [], ...declaration });
    assert.equal(classify(file, ['c:/save.bin#tail']), file);
    const out = await mount(file);
    assert.deepEqual(out.names, ['c:\\save.bin#tail']);
    assert.equal(out.events.filter(e => e[0] === 'fetch').length, declaration.httpRange === true ? 0 : 1);
  }
});

test('optional nonmatching declarations remain lazy and preserve frozen metadata', async () => {
  const metadata = Object.freeze({ id: 1 });
  const file = frozen({ url: 'dir/optional.bin', optional: true, vfsPaths: [], metadata });
  const out = classify(file, []);
  assert.equal(out.optional, true);
  assert.equal(out.vfsPaths, file.vfsPaths);
  assert.equal(out.metadata, metadata);
  assert.equal(out.httpRange, true);
  const loaded = await mount(out);
  assert.equal(loaded.events.filter(e => e[0] === 'provider').length, 1);
  assert.equal(loaded.events.filter(e => e[0] === 'fetch').length, 0);
});
