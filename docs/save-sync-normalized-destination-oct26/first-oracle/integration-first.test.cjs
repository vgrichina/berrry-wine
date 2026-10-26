'use strict';

// Offline integration: real SaveSync + SaveBundle + VirtualFS. Transport and
// registry/INI persistence are invocation-local in-memory adapters.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const sync = require('../lib/save-sync');
const save = require('../lib/save-bundle');
const { VirtualFS } = require('../lib/filesystem');
const evidenceDir = path.join(__dirname, '../docs/save-sync-normalized-destination-oct26');
const pins = require('../docs/save-sync-normalized-destination-oct26/pins.json');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const appId = 'independent';
const patterns = ['C:/SAVE/*.SAV', 'D:/SAVE/*.SAV'];
const when = '2026-08-30T12:34:56.000Z';
const earlier = '2026-08-29T12:34:56.000Z';
const later = '2026-08-31T12:34:56.000Z';
const completed = [];
function fixture(name) {
  const bytes = fs.readFileSync(path.join(evidenceDir, 'fixtures', name));
  assert.equal(hash(bytes), pins.fixtures[name].sha256, `immutable ${name}`);
  return bytes;
}
function group(name, body) {
  test(name, async () => {
    await body();
    completed.push(name);
    if (process.env.SAVE_SYNC_EVIDENCE) {
      const dir = process.env.SAVE_SYNC_EVIDENCE;
      fs.mkdirSync(dir, { recursive: true });
      const checkpoint = {
        main: pins.remoteMain, candidate: pins.acceptedCandidate,
        testHash: hash(fs.readFileSync(__filename)),
        sources: Object.fromEntries(Object.keys(pins.testedSource).map(p =>
          [p, hash(fs.readFileSync(path.join(__dirname, '..', p)))])),
        fixtures: pins.fixtures, completed, blockers: [],
      };
      fs.writeFileSync(path.join(dir, 'checkpoint.tmp'), JSON.stringify(checkpoint, null, 2));
      fs.renameSync(path.join(dir, 'checkpoint.tmp'), path.join(dir, 'checkpoint.json'));
    }
  });
}

function transport({ record = null, meta = record !== null } = {}) {
  const calls = [], writes = [];
  let stored = record === null ? null : Uint8Array.from(record);
  return {
    calls, writes,
    get stored() { return stored; },
    async fetchImpl(url, init) {
      assert.equal(init.credentials, 'same-origin');
      assert.ok(init.signal instanceof AbortSignal);
      const method = init.method;
      calls.push({ url, method });
      const isMeta = url.endsWith('/metadata');
      assert.equal(url, '/api/data/wine-saves-independent' + (isMeta ? '/metadata' : ''));
      if (method === 'POST') {
        assert.equal(isMeta, false);
        assert.equal(init.headers['content-type'], 'application/zip');
        stored = Uint8Array.from(init.body);
        writes.push(stored);
        return { status: 200, ok: true };
      }
      assert.equal(method, 'GET');
      assert.equal(init.headers.accept, isMeta ? 'application/json' : 'application/zip');
      if (isMeta) return { status: meta ? 200 : 404, ok: meta,
        text: async () => JSON.stringify({ updatedAt: '2099-01-01T00:00:00.000Z' }) };
      return { status: stored === null ? 404 : 200, ok: stored !== null,
        arrayBuffer: async () => Uint8Array.from(stored).buffer };
    },
  };
}
function device() {
  const vfs = new VirtualFS(), mutations = [];
  vfs.files.set('c:\\save\\old.sav', { data: Uint8Array.of(90), attrs: 0x80 });
  vfs.files.set('c:\\outside\\keep.dat', { data: Uint8Array.of(91), attrs: 0x20 });
  let store = { 'reg:old': { value: 9 }, 'ini:old.ini': { x: 8 } };
  const storageModule = {
    clearStore() { mutations.push('store.clear'); store = {}; },
    importStore(next) { mutations.push('store.import'); Object.assign(store, structuredClone(next)); return Object.keys(next).length; },
    exportStore() { return structuredClone(store); },
  };
  const before = { files: structuredClone([...vfs.files]), dirs: [...vfs.dirs], store: structuredClone(store) };
  for (const [target, methods, label] of [[vfs.files, ['set', 'delete', 'clear'], 'files'], [vfs.dirs, ['add', 'delete', 'clear'], 'dirs']]) {
    for (const method of methods) {
      const original = target[method].bind(target);
      target[method] = (...args) => { mutations.push(`${label}.${method}`); return original(...args); };
    }
  }
  const ensure = vfs.ensureParentDirs.bind(vfs);
  vfs.ensureParentDirs = p => { mutations.push('ensureParentDirs'); return ensure(p); };
  return { vfs, storageModule, mutations,
    untouched() {
      assert.deepEqual(mutations, []);
      assert.deepEqual([...vfs.files], before.files);
      assert.deepEqual([...vfs.dirs], before.dirs);
      assert.deepEqual(store, before.store);
    },
  };
}
function options(t, d, extra = {}) {
  return { appId, patterns, ...d, fetchImpl: t.fetchImpl, timeoutMs: 1000, ...extra };
}
// SaveSync returns bytes; its documented caller contract performs application
// only for a successful pull. This adapter exercises that boundary explicitly.
async function syncAndApply(t, d, extra = {}) {
  const result = await sync.sync(options(t, d, extra));
  if (result.action === 'pulled') {
    result.applied = save.importBundle(result.bytes, options(t, d, extra));
  }
  return result;
}
function writer(createdAt = when, files = true, store = {}) {
  const vfs = new VirtualFS();
  if (files) {
    vfs.files.set('C:/SAVE/Slot.SAV', { data: Uint8Array.of(3, 4, 5), attrs: 0x23,
      creationTime: { lo: 1, hi: 2 }, lastAccessTime: { lo: 3, hi: 4 }, lastWriteTime: { lo: 5, hi: 6 } });
    vfs.files.set('c:\\save\\empty.sav', { data: new Uint8Array(), attrs: 0x80 });
  }
  return save.exportBundle({ appId, patterns, vfs, store, createdAt, commit: 'legacy-fixture' });
}

const collisions = ['000-case-collision.zip', '002-case-collision.zip', '021-duplicate-spec.zip'];
group('conflicting local destinations reject push and sync before any transport or device mutation', async () => {
  for (const name of collisions) for (const method of ['push', 'sync']) {
    const bytes = fixture(name), originalHash = hash(bytes);
    const t = transport({ record: writer() }), oldRemote = hash(t.stored), d = device();
    await assert.rejects(sync[method](options(t, d, { bundle: bytes })), /duplicate normalized guest path/);
    assert.deepEqual(t.calls, []);
    assert.deepEqual(t.writes, []);
    assert.equal(hash(t.stored), oldRemote);
    assert.equal(hash(bytes), originalHash);
    d.untouched();
  }
});

group('conflicting downloads reject pull and sync before application or remote overwrite in both modes', async () => {
  for (const name of collisions) for (const mode of ['merge', 'replace']) {
    for (const method of ['pull', 'sync-no-local', 'sync-newer-local']) {
      const bytes = fixture(name), t = transport({ record: bytes }), d = device();
      const operation = method === 'pull' ? sync.pull(options(t, d, { mode })) :
        syncAndApply(t, d, { mode, ...(method === 'sync-newer-local' ? { bundle: writer(later) } : {}) });
      await assert.rejects(operation, /duplicate normalized guest path/);
      assert.deepEqual(t.calls.map(c => c.method), method === 'pull' ? ['GET'] : ['GET', 'GET']);
      assert.deepEqual(t.writes, []);
      assert.equal(hash(t.stored), hash(bytes));
      d.untouched();
    }
  }
});

group('upload branches carry valid writer ZIPs byte for byte and retain owned caller snapshots', async () => {
  for (const route of ['push', 'no-metadata', 'no-record', 'newer-local']) {
    const bytes = Buffer.from(writer(later)), expected = Buffer.from(bytes), d = device();
    const t = transport({ record: route === 'newer-local' ? writer(earlier) : null, meta: route !== 'no-metadata' });
    const fetchImpl = async (url, init) => {
      // Exercise current owned-upload behavior across both the direct POST
      // and sync's first asynchronous read; mutate the caller, never the body.
      bytes.fill(0);
      return t.fetchImpl(url, init);
    };
    const result = await sync[route === 'push' ? 'push' : 'sync'](options(t, d, { bundle: bytes, fetchImpl }));
    if (route !== 'push') assert.equal(result.action, 'pushed');
    assert.equal(t.writes.length, 1);
    assert.deepEqual(Buffer.from(t.stored), expected);
    assert.deepEqual(t.calls.map(c => c.method), route === 'push' ? ['POST'] :
      route === 'no-metadata' ? ['GET', 'POST'] : ['GET', 'GET', 'POST']);
    d.untouched();
  }
});

group('mixed-case accepted download applies normalized destinations, state and metadata in merge and replace', async () => {
  for (const name of ['045-glob-positive.zip', '044-distinct.zip']) for (const mode of ['merge', 'replace']) {
    const bytes = fixture(name), t = transport({ record: bytes }), d = device();
    const result = await syncAndApply(t, d, { mode, bundle: writer(earlier) });
    assert.equal(result.action, 'pulled');
    assert.equal(hash(result.bytes), hash(bytes));
    assert.deepEqual(t.calls.map(c => c.method), ['GET', 'GET']);
    assert.equal(t.writes.length, 0);
    const expected = name.startsWith('045') ? ['c:\\save\\slot.sav', 'c:\\save\\nested\\a.sav'] :
      ['c:\\save\\a.sav', 'c:\\save\\sub\\a.sav', 'c:\\save\\ab.sav', 'd:\\save\\a.sav', 'c:\\save\\a+.sav'];
    assert.deepEqual(result.applied.files, expected);
    expected.forEach((p, i) => {
      const entry = d.vfs.files.get(p);
      assert.deepEqual([...entry.data], name.startsWith('044') && i === 1 ? [] : [17 + i]);
      assert.equal(entry.attrs, 0x23);
      assert.deepEqual(entry.creationTime, { lo: 1, hi: 2 });
      assert.deepEqual(entry.lastAccessTime, { lo: 3, hi: 4 });
      assert.deepEqual(entry.lastWriteTime, { lo: 5, hi: 6 });
      assert.ok(d.vfs.dirs.has(p.slice(0, p.lastIndexOf('\\'))));
      assert.equal(d.vfs.getFileAttributes(p.toUpperCase()), 0x23);
    });
    assert.equal(d.vfs.files.has('c:\\save\\old.sav'), mode === 'merge');
    assert.deepEqual([...d.vfs.files.get('c:\\outside\\keep.dat').data], [91]);
    const state = d.storageModule.exportStore();
    assert.deepEqual(state['reg:HKCU\\independent'], { slot: 3 });
    assert.deepEqual(state['ini:test.ini'], { Save: { Value: 'yes' } });
    assert.equal(Object.hasOwn(state, 'reg:old'), mode === 'merge');
    assert.equal(d.mutations.filter(x => x === 'store.import').length, 1);
    assert.equal(d.mutations.filter(x => x === 'store.clear').length, mode === 'replace' ? 1 : 0);
  }
});

group('legacy writer upload/download/application/export is byte-identical including zero-byte save and state', async () => {
  const bytes = fixture('legacy-writer.zip'), remote = transport({ meta: false }), source = device();
  assert.equal((await sync.sync(options(remote, source, { bundle: bytes }))).action, 'pushed');
  source.untouched();
  const dest = device(), download = transport({ record: remote.stored });
  const result = await syncAndApply(download, dest, { mode: 'replace' });
  assert.equal(result.action, 'pulled');
  assert.equal(dest.vfs.files.get('c:\\save\\empty.sav').data.length, 0);
  const exported = save.exportBundle({ appId, patterns, vfs: dest.vfs,
    store: dest.storageModule.exportStore(), createdAt: when, commit: 'legacy-fixture' });
  assert.deepEqual(Buffer.from(exported), bytes);
});

group('empty writer bundle is uploaded and applies replace; equal timestamps and missing records do not apply', async () => {
  const empty = writer(when, false), first = transport({ meta: false }), d = device();
  assert.equal((await sync.sync(options(first, d, { bundle: empty }))).action, 'pushed');
  d.untouched();
  const dest = device();
  const result = await syncAndApply(transport({ record: first.stored }), dest, { mode: 'replace' });
  assert.deepEqual(result.applied.files, []);
  assert.equal(dest.vfs.files.has('c:\\save\\old.sav'), false);
  assert.ok(dest.vfs.files.has('c:\\outside\\keep.dat'));
  assert.deepEqual(dest.storageModule.exportStore(), {});
  for (const [record, local, action] of [[empty, empty, 'in-sync'], [null, undefined, 'none'], [new Uint8Array(), undefined, 'none']]) {
    const clean = device(), t = transport({ record });
    assert.equal((await syncAndApply(t, clean, { bundle: local })).action, action);
    assert.equal(t.writes.length, 0);
    clean.untouched();
  }
});

group('download application enforces the running app allow-list before clearing or writing', async () => {
  const bytes = fixture('045-glob-positive.zip'), t = transport({ record: bytes }), d = device();
  await assert.rejects(syncAndApply(t, d, { patterns: ['C:/OTHER/*.SAV'], mode: 'replace' }), /outside the app's persistFiles globs/);
  assert.equal(t.writes.length, 0);
  d.untouched();
});

group('actual CLI text and JSON present normalized paths while extraction retains original member spelling', () => {
  const filename = path.join(evidenceDir, 'fixtures/046-api-case-delta.zip');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'save-sync-cli-'));
  function cli(...args) {
    const result = spawnSync(process.execPath, ['--max-old-space-size=192', path.join(__dirname, '../tools/save-bundle.js'), filename, ...args],
      { encoding: 'utf8', timeout: 5000, maxBuffer: 8192 });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  }
  try {
    assert.match(cli(), /c:\\save\\slot\.sav\s+1 B/);
    const summary = JSON.parse(cli('--json'));
    assert.deepEqual(summary.files, [{ path: 'c:\\save\\slot.sav', member: 'vfs/c/Save/Slot.sav', size: 1 }]);
    cli(`--extract=${temp}`);
    assert.deepEqual([...fs.readFileSync(path.join(temp, 'vfs/c/Save/Slot.sav'))], [17]);
    assert.equal(fs.existsSync(path.join(temp, 'vfs/c/save/slot.sav')), false);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
