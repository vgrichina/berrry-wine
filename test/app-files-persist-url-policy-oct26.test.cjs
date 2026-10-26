'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const { normalizeLazyFiles, APP_EAGER_BYTES } = require('../lib/app-files');

const root = path.join(__dirname, '..');
const large = Object.freeze({ url: 'bulk.pak', size: APP_EAGER_BYTES + 1 });
const persisted = Object.freeze({ persistFiles: Object.freeze(['c:\\save.dat']) });
const urls = [
  ['game/save.dat', 'c:\\save.dat', true],
  ['game/SAVE.DAT?v=1', 'c:\\save.dat?v=1', false],
  ['game\\SAVE.DAT#fragment', 'c:\\save.dat#fragment', false],
  ['https://example.invalid/game/save.dat?v=1#fragment', 'c:\\save.dat?v=1#fragment', false],
  ['game/save%2Edat?v=1', 'c:\\save%2edat?v=1', false],
  // Host basename extraction also sees separators inside query/fragment text.
  ['game/save.dat?v=/OTHER.DAT', 'c:\\other.dat', false],
  ['game/save.dat#dir\\OTHER.DAT', 'c:\\other.dat', false],
];

function policy(file, app = persisted, options = {}) {
  const files = Object.freeze([file, large]);
  const before = JSON.stringify({ app, files });
  const result = normalizeLazyFiles(app, files, { sizeOf: () => 1, ...options });
  assert.equal(JSON.stringify({ app, files }), before, 'inputs remain immutable');
  assert.notEqual(result.files, files);
  return result.files[0];
}

test('large app: string/object URLs follow literal mounted basename, without decoding', () => {
  for (const [url, , eager] of urls) {
    for (const file of [url, Object.freeze({ url, size: 1 })]) {
      const out = policy(file);
      if (eager) assert.equal(out, file, url);
      else {
        assert.equal(out.httpRange, true, url);
        assert.equal(out.url, url, 'fetch identity is unchanged');
        assert.equal(out.size, 1);
      }
      assert.equal(policy(file, {}).httpRange, true, 'nonpersisted data streams');
    }
  }
});

test('literal query/fragment guest names can themselves match persistence patterns', () => {
  for (const [url, mounted] of urls) {
    for (const file of [url, Object.freeze({ url, size: 1 })]) {
      assert.equal(policy(file, { persistFiles: [mounted] }), file, mounted);
      const wildcard = policy(file, { persistFiles: ['C:/SAVE.DAT*'] });
      if (mounted.startsWith('c:\\save.dat')) assert.equal(wildcard, file);
      else assert.equal(wildcard.httpRange, true);
    }
  }
});

test('explicit paths own guest identity independently of URL suffixes', () => {
  for (const suffix of ['?v=1', '#fragment', '?v=/other.dat#fragment']) {
    for (const override of [
      { vfsPath: 'C:/SAVE.DAT' },
      { vfsPaths: Object.freeze(['d:/other.dat', 'C:/SAVE.DAT']) },
      { vfsPath: 'c:/other.dat', vfsPaths: Object.freeze(['C:/SAVE.DAT']) },
    ]) {
      const file = Object.freeze({ url: 'game/save.dat' + suffix, size: 1, ...override });
      assert.equal(policy(file), file);
    }
    for (const override of [
      { vfsPath: 'd:/other.dat' },
      { vfsPath: 'C:/SAVE.DAT', vfsPaths: Object.freeze(['d:/other.dat']) },
    ]) assert.equal(policy(Object.freeze({ url: 'save.dat' + suffix, size: 1, ...override })).httpRange, true);
  }
});

test('explicit loading declarations survive persisted URL aliases', () => {
  for (const declaration of [
    { loadMode: 'required' }, { loadMode: 'lazy' }, { loadMode: 'background' },
    { httpRange: true }, { httpRange: false }, { eager: true },
    { preloadRanges: Object.freeze([[0, 1]]) }, { decodeImage: true },
  ]) {
    const file = Object.freeze({ url: 'game/save.dat?v=1', vfsPath: 'c:/save.dat', size: 1, ...declaration });
    assert.equal(policy(file), file);
  }
});

test('Win16, optout, small app and unknown sizes preserve eager decisions', () => {
  for (const file of ['game/save.dat?v=1', Object.freeze({ url: 'game/save.dat#fragment', size: 1 })]) {
    assert.equal(policy(file, persisted, { isWin16: true }), file);
    assert.equal(policy(file, { ...persisted, lazyFiles: false }), file);
    const small = normalizeLazyFiles(persisted, [file], { sizeOf: () => 1 });
    assert.equal(small.summary.policy, 'eager: small app');
    assert.equal(small.files[0], file);
  }
  for (const file of ['game/save.dat?v=1', Object.freeze({ url: 'game/save.dat#fragment' })]) {
    assert.equal(policy(file, persisted, { sizeOf: () => undefined }), file);
  }
});

test('extension classification strips URL suffixes without changing guest identity', () => {
  for (const url of ['game/CONFIG.INI?v=1', 'game/CONFIG.INI#fragment']) {
    for (const file of [url, Object.freeze({ url, size: 1 })]) assert.equal(policy(file, {}), file);
  }
});

test('actual host loadFiles and filesystem normalization retain suffixes literally', async () => {
  // Execute the production method with byte IO stubbed; no host constructor,
  // wasm arena, network, browser or guest execution is needed.
  const host = fs.readFileSync(path.join(root, 'host.js'), 'utf8');
  const start = host.indexOf('  async loadFiles(urls, options = {}) {');
  const end = host.indexOf('\n  async loadDlls(', start);
  assert(start >= 0 && end > start, 'production method boundaries');
  const filesystem = fs.readFileSync(path.join(root, 'lib/filesystem.js'), 'utf8');
  const normStart = filesystem.indexOf('  _normPath(p) {');
  const normEnd = filesystem.indexOf('\n  _resolvePath(', normStart);
  assert(normStart >= 0 && normEnd > normStart);
  const context = vm.createContext({
    WineAssembly: {
      _throwIfAssetAborted() {}, _transferSeq: 0,
      fetchAssetBytes: async () => new Uint8Array([7]),
      bundleName: () => null, _prefetchBundled: async () => new Map(),
    },
  });
  const mount = vm.runInContext('({' + host.slice(start, end) + '})', context);
  const norm = vm.runInContext('({' + filesystem.slice(normStart, normEnd) + '})', context);
  const shell = fs.readFileSync(path.join(root, 'lib/browser-shell.js'), 'utf8');
  assert(/appFiles\.normalizeLazyFiles\(app, app\.files/.test(shell), 'browser applies policy');
  assert(/wine\.loadFiles\(mountFiles,/.test(shell), 'browser passes mount list to host');
  for (const [url, expected] of urls) {
    for (const file of [url, { url, size: 1 }]) {
      const vfs = { files: new Map(), ensureParentDirs() {} };
      await mount.loadFiles.call({ _helpCtx: { vfs } }, [file], { required: true, concurrency: 1 });
      assert.deepEqual([...vfs.files.keys()], [expected], url);
      assert.equal(norm._normPath(expected), expected, 'filesystem keeps literal suffix');
    }
  }
  for (const paths of [
    { vfsPath: 'C:/SAVE.DAT' },
    { vfsPaths: ['D:/OTHER.DAT', 'C:/SAVE.DAT'] },
    { vfsPath: 'D:/IGNORED.DAT', vfsPaths: ['C:/SAVE.DAT'] },
  ]) {
    const vfs = { files: new Map(), ensureParentDirs() {} };
    const file = { url: 'game/save.dat?v=1#fragment', size: 1, ...paths };
    await mount.loadFiles.call({ _helpCtx: { vfs } }, [file], { required: true, concurrency: 1 });
    const expected = (paths.vfsPaths || [paths.vfsPath]).map(p => p.toLowerCase().replace(/\//g, '\\'));
    assert.deepEqual([...vfs.files.keys()], expected, 'explicit aliases own mount identity');
    assert.equal(policy(Object.freeze(file)), file);
  }
});
