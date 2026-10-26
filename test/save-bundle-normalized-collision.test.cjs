'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const bundle = require('../lib/save-bundle');
const zip = require('../lib/zip-mount');
const { VirtualFS } = require('../lib/filesystem');
const { makeRawZip } = require('./fixtures/make-test-zip');

const patterns = ['c:\\save\\*.sav'];
const createdAt = '2026-08-30T12:34:56.000Z';
const hash = data => createHash('sha256').update(data).digest('hex');
const json = value => Buffer.from(JSON.stringify(value));

// Independent ZIP builder and Node SHA-256: do not mock the bundle reader or
// construct a raw-name duplicate that its catalog check already rejects.
function fixture(names, pathMode = 'absent', repeatSpec = false) {
  const registry = json({ 'reg:HKCU\\Save': { slot: 2 } });
  const ini = json({ 'ini:game.ini': { Video: { Mode: '640x480' } } });
  const members = names.map((name, i) => ({ name, data: Buffer.from([i + 1]) }));
  const files = members.map(({ name, data }) => ({
    name, size: data.length, sha256: hash(data), attrs: 0x21,
    ...(pathMode === 'absent' ? {} : {
      path: pathMode === 'lower' ? bundle.normalizePath(bundle.memberToGuestPath(name))
        : bundle.memberToGuestPath(name),
    }),
  }));
  if (repeatSpec) files.push({ ...files[0] });
  const state = (name, data) => ({ name, size: data.length, sha256: hash(data) });
  const manifest = { version: 1, appId: 'collision-test', createdAt, files,
    patterns, state: { registry: state('registry.json', registry), ini: state('ini.json', ini) } };
  return makeRawZip([{ name: 'manifest.json', data: json(manifest) },
    { name: 'registry.json', data: registry }, { name: 'ini.json', data: ini }, ...members]);
}

function target() {
  const vfs = new VirtualFS();
  vfs.files.set('c:\\save\\old.sav', { data: Uint8Array.of(99), attrs: 0x20 });
  vfs.files.set('c:\\other\\keep.txt', { data: Uint8Array.of(88), attrs: 0x80 });
  const calls = [];
  for (const op of ['set', 'delete', 'clear']) {
    const original = vfs.files[op].bind(vfs.files);
    vfs.files[op] = (...args) => { calls.push(op); return original(...args); };
  }
  const ensure = vfs.ensureParentDirs.bind(vfs);
  vfs.ensureParentDirs = path => { calls.push('dirs'); return ensure(path); };
  const storageModule = { clearStore() { calls.push('clearStore'); },
    importStore() { calls.push('importStore'); return 1; } };
  return { vfs, calls, storageModule };
}

test('hashed ZIP with distinct raw names refuses normalized guest aliases before mutation', () => {
  const pairs = [ ['vfs/c/save/A.sav', 'vfs/c/save/a.sav'],
    ['vfs/c/Save/slot.sav', 'vfs/c/save/slot.sav'] ];
  for (const names of pairs) for (const ordered of [names, names.slice().reverse()]) {
    for (const pathMode of ['absent', 'lower', 'member']) {
      const bytes = fixture(ordered, pathMode);
      const catalog = zip.readCatalogSync(bytes);
      assert.equal(new Set(catalog.map(e => e.name)).size, catalog.length);
      // Prove every file and state hash is genuine, with CRC extraction too.
      const data = new Map(catalog.map(e => [e.name, zip.extractSync(bytes, e)]));
      const manifest = JSON.parse(Buffer.from(data.get('manifest.json')));
      for (const spec of [...manifest.files, ...Object.values(manifest.state)]) {
        assert.equal(hash(data.get(spec.name)), spec.sha256);
      }
      if (process.env.SAVE_BUNDLE_REPRO_OUT && pathMode === 'absent') {
        fs.writeFileSync(process.env.SAVE_BUNDLE_REPRO_OUT, bytes);
      }
      assert.throws(() => bundle.readBundle(bytes), /duplicate normalized guest path/i);
      for (const mode of ['merge', 'replace']) {
        const { vfs, calls, storageModule } = target();
        const before = structuredClone([...vfs.files]);
        const dirs = [...vfs.dirs];
        assert.throws(() => bundle.importBundle(bytes, { vfs, storageModule, patterns, mode }),
          /duplicate normalized guest path/i);
        assert.deepEqual(calls, []);
        assert.deepEqual([...vfs.files], before);
        assert.deepEqual([...vfs.dirs], dirs);
      }
    }
  }
});

test('repeated manifest specs also refuse the same normalized destination', () => {
  assert.throws(() => bundle.readBundle(fixture(['vfs/c/save/a.sav'], 'lower', true)),
    /duplicate normalized guest path/i);
});

test('legal uppercase member and manifest paths normalize to the same destination', () => {
  for (const pathMode of ['absent', 'lower', 'member']) {
    const bytes = fixture(['vfs/c/Save/A.sav'], pathMode);
    const { vfs, storageModule } = target();
    bundle.importBundle(bytes, { vfs, storageModule, patterns });
    assert.deepEqual([...vfs.files.get('c:\\save\\a.sav').data], [1]);
  }
});

test('distinct normalized paths, empty files, all metadata and deterministic round trip', () => {
  const vfs = new VirtualFS();
  const meta = { attrs: 0x21, creationTime: { lo: 1, hi: 2 },
    lastAccessTime: { lo: 3, hi: 4 }, lastWriteTime: { lo: 5, hi: 6 } };
  for (const [path, data] of [['c:\\save\\a.sav', Uint8Array.of(7)],
    ['c:\\save\\other\\a.sav', new Uint8Array(0)], ['c:\\save\\ab.sav', Uint8Array.of(8)]]) {
    vfs.files.set(path, { ...meta, data });
  }
  vfs.files.set('c:\\other\\excluded.sav', { data: Uint8Array.of(0), attrs: 0x80 });
  const store = { 'reg:HKCU\\Save': { slot: 2 }, 'ini:game.ini': { Video: { Mode: '640x480' } } };
  const options = { appId: 'collision-test', patterns, createdAt, commit: 'pinned-test', store };
  const bytes = bundle.exportBundle({ ...options, vfs });
  assert.deepEqual(bundle.exportBundle({ ...options, vfs }), bytes);
  const parsed = bundle.readBundle(bytes);
  assert.equal(parsed.files.length, 3);
  assert.equal(parsed.files.find(f => f.path.includes('other')).data.length, 0);
  for (const file of parsed.files) for (const key of Object.keys(meta)) {
    assert.deepEqual(file[key], meta[key]);
  }
  for (const mode of ['merge', 'replace']) {
    const targetVfs = new VirtualFS();
    let restored;
    const storageModule = { clearStore() {}, importStore(s) { restored = s; return 2; } };
    bundle.importBundle(bytes, { vfs: targetVfs, storageModule, patterns, mode });
    assert.deepEqual(restored, store);
    assert.deepEqual(bundle.exportBundle({ ...options, store: restored, vfs: targetVfs }), bytes);
  }
});

test('normalized names still obey the running app persistence globs', () => {
  const bytes = fixture(['vfs/c/Other/A.sav']);
  for (const mode of ['merge', 'replace']) {
    const { vfs, calls, storageModule } = target();
    assert.throws(() => bundle.importBundle(bytes, { vfs, storageModule, patterns, mode }),
      /outside the app's persistFiles globs/);
    assert.deepEqual(calls, []);
  }
});
