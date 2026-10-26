'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const save = require('../lib/save-bundle');
const zip = require('../lib/zip-mount');
const { VirtualFS } = require('../lib/filesystem');
const candidate = 'ef3fdad258660c3b838e0836aff32b3ef4a4f8b3';
const digest = b => createHash('sha256').update(b).digest('hex');
const json = o => Buffer.from(JSON.stringify(o));
const when = '2026-08-30T12:34:56.000Z';
const evidence = process.env.SAVE_ACCEPT_EVIDENCE;
const fixtures = [], completed = [];
const sourceHash = digest(fs.readFileSync(require.resolve('../lib/save-bundle')));
assert.equal(sourceHash, '4ac22b490b0c201d5c4d7ee0047882522eeb4690d93b095e4eb755d84590f3ee');

// Independent stored ZIP construction: no save-bundle writer or shared fixture
// helper. CRC is bit-at-a-time; SHA-256 is Node crypto, not save-bundle.sha256.
function crc(bytes) {
  let v = 0xffffffff;
  for (const byte of bytes) {
    v ^= byte;
    for (let bit = 0; bit < 8; bit++) v = (v >>> 1) ^ ((v & 1) ? 0xedb88320 : 0);
  }
  return (v ^ 0xffffffff) >>> 0;
}
function archive(members) {
  const locals = [], central = [];
  let offset = 0;
  for (const { name, data } of members) {
    const n = Buffer.from(name, 'utf8'), c = crc(data);
    const l = Buffer.alloc(30);
    l.writeUInt32LE(0x04034b50); l.writeUInt16LE(20, 4); l.writeUInt16LE(0x800, 6);
    l.writeUInt32LE(c, 14); l.writeUInt32LE(data.length, 18); l.writeUInt32LE(data.length, 22); l.writeUInt16LE(n.length, 26);
    locals.push(l, n, data);
    const d = Buffer.alloc(46);
    d.writeUInt32LE(0x02014b50); d.writeUInt16LE(20, 4); d.writeUInt16LE(20, 6); d.writeUInt16LE(0x800, 8);
    d.writeUInt32LE(c, 16); d.writeUInt32LE(data.length, 20); d.writeUInt32LE(data.length, 24); d.writeUInt16LE(n.length, 28); d.writeUInt32LE(offset, 42);
    central.push(d, n); offset += l.length + n.length + data.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(members.length, 8); end.writeUInt16LE(members.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
const metadata = { attrs: 0x23, creationTime: { lo: 1, hi: 2 }, lastAccessTime: { lo: 3, hi: 4 }, lastWriteTime: { lo: 5, hi: 6 } };
function fixture(label, specs, edit = () => {}, extra = []) {
  const payload = specs.map((s, i) => ({ name: s.name, data: s.data === undefined ? Buffer.from([17 + i]) : Buffer.from(s.data) }));
  const registry = json({ 'reg:HKCU\\independent': { slot: 3 } });
  const ini = json({ 'ini:test.ini': { Save: { Value: 'yes' } } });
  const state = (name, data) => ({ name, size: data.length, sha256: digest(data) });
  const manifest = { version: 1, appId: 'independent', createdAt: when, patterns: ['c:\\*'],
    files: specs.map((s, i) => ({ ...metadata, ...state(s.name, payload[i].data), ...(s.path === undefined ? {} : { path: s.path }) })),
    state: { registry: state('registry.json', registry), ini: state('ini.json', ini) } };
  edit(manifest);
  const bytes = archive([{ name: 'manifest.json', data: json(manifest) }, { name: 'registry.json', data: registry }, { name: 'ini.json', data: ini }, ...payload, ...extra]);
  // Real catalog + extraction verify CRCs. All adversaries except explicit
  // size/hash corruptions retain true payload SHA-256s.
  const catalog = zip.readCatalogSync(bytes);
  const extracted = catalog.map(entry => [entry.name, zip.extractSync(bytes, entry)]);
  for (const { name, data } of payload) assert.equal(digest(extracted.find(e => e[0] === name)[1]), digest(data));
  const filename = `${String(fixtures.length).padStart(3, '0')}-${label}.zip`;
  fixtures.push({ filename, bytes: bytes.length, sha256: digest(bytes), manifestHash: digest(json(manifest)), uniqueRawNames: new Set(catalog.map(e => e.name)).size === catalog.length });
  if (evidence) { fs.mkdirSync(evidence, { recursive: true }); fs.writeFileSync(path.join(evidence, filename), bytes); }
  return bytes;
}
function sentinel() {
  const vfs = new VirtualFS(), calls = [];
  vfs.files.set('c:\\save\\old.sav', { data: Uint8Array.of(99), attrs: 0x80 });
  vfs.files.set('c:\\outside\\keep.dat', { data: Uint8Array.of(88), attrs: 0x20 });
  const before = structuredClone([...vfs.files]), dirs = [...vfs.dirs];
  for (const [target, methods, label] of [[vfs.files, ['set', 'delete', 'clear'], 'files'], [vfs.dirs, ['add', 'delete', 'clear'], 'dirs']]) {
    for (const method of methods) {
      const original = target[method].bind(target);
      target[method] = (...args) => { calls.push(`${label}.${method}`); return original(...args); };
    }
  }
  const ensure = vfs.ensureParentDirs.bind(vfs);
  vfs.ensureParentDirs = p => { calls.push('ensureParentDirs'); return ensure(p); };
  const storageModule = { clearStore() { calls.push('clearStore'); }, importStore() { calls.push('importStore'); return 2; } };
  return { vfs, storageModule, calls, untouched() { assert.deepEqual(calls, []); assert.deepEqual([...vfs.files], before); assert.deepEqual([...vfs.dirs], dirs); } };
}
function refuses(bytes, error) {
  assert.throws(() => save.readBundle(bytes), error);
  for (const mode of ['merge', 'replace']) {
    const s = sentinel();
    assert.throws(() => save.importBundle(bytes, { ...s, appId: 'independent', patterns: ['C:/SAVE/*.SAV'], mode }), error);
    s.untouched();
  }
}
function group(name, body) {
  if (name.startsWith('explicit public API') && !process.env.SAVE_ACCEPT_BASELINE) {
    test(name, { skip: 'Set SAVE_ACCEPT_BASELINE to the pinned ancestor source; see review recovery notes' }, () => {});
    return;
  }
  test(name, () => {
    body(); completed.push(name);
    if (evidence) {
      const checkpoint = { candidate, sourceHash, testHash: digest(fs.readFileSync(__filename)), completed, fixtures, remaining: 'remaining node:test groups until final TAP summary', blockers: [] };
      fs.writeFileSync(path.join(evidence, 'checkpoint.json.tmp'), JSON.stringify(checkpoint, null, 2));
      fs.renameSync(path.join(evidence, 'checkpoint.json.tmp'), path.join(evidence, 'checkpoint.json'));
    }
  });
}

group('distinct raw ZIP names collide under guest case folding before all mutations', () => {
  const pairs = [['vfs/c/save/Slot.sav', 'vfs/c/save/slot.sav'], ['vfs/c/SAVE/a.sav', 'vfs/c/save/A.sav'], ['vfs/c/save/Ä.sav', 'vfs/c/save/ä.sav']];
  for (const pair of pairs) for (const names of [pair, [...pair].reverse()]) {
    for (const usePaths of [false, true]) {
      const specs = names.map(name => ({ name, ...(usePaths ? { path: 'C:/' + name.slice(6) } : {}) }));
      refuses(fixture('case-collision', specs), /duplicate normalized guest path/);
      assert.equal(fixtures.at(-1).uniqueRawNames, true);
    }
  }
});

group('slash and path aliases are rejected as unsafe before normalization can merge them', () => {
  const aliases = ['vfs/c/save\\a.sav', 'vfs/c/save//a.sav', 'vfs/c/save/./a.sav', 'vfs/c/save/x/../a.sav'];
  for (const alias of aliases) for (const reverse of [false, true]) {
    const specs = [{ name: 'vfs/c/save/a.sav' }, { name: alias }];
    refuses(fixture('slash-alias', reverse ? specs.reverse() : specs), /backslash|unsafe path segment/);
  }
});

group('raw duplicate members and repeated specs have separate rejection coverage', () => {
  refuses(fixture('raw-duplicate', [{ name: 'vfs/c/save/a.sav', data: [1] }, { name: 'vfs/c/save/a.sav', data: [1] }]), /duplicate entry/);
  assert.equal(fixtures.at(-1).uniqueRawNames, false);
  refuses(fixture('duplicate-spec', [{ name: 'vfs/c/save/a.sav' }], m => m.files.push({ ...m.files[0], path: 'C:/SAVE/A.SAV' })), /duplicate normalized guest path/);
  assert.equal(fixtures.at(-1).uniqueRawNames, true);
});

group('unsafe guest members cannot reach VFS or either storage mode', () => {
  for (const name of ['vfs/c/../save/a.sav', 'vfs/c/./save/a.sav', 'vfs/c//save/a.sav', '/vfs/c/save/a.sav', 'vfs//c/save/a.sav', 'vfs/C/save/a.sav', 'vfs/c/save/d:a.sav', 'vfs/c/save/NUL.sav', 'vfs/c/save/com1.sav', 'vfs/c/save/a\0.sav', 'vfs/c/save/a\n.sav']) {
    refuses(fixture('unsafe', [{ name }]), /outside vfs|absolute entry|drive must|unsafe path segment|drive marker|reserved device|control character/);
  }
});

group('manifest path agreement accepts case/slash spelling but refuses different destinations', () => {
  for (const claimed of ['c:\\save\\other.sav', 'd:/save/a.sav', 'c:/save/../a.sav', 'c:/save//a.sav', '/c/save/a.sav']) {
    refuses(fixture('path-mismatch', [{ name: 'vfs/c/save/a.sav', path: claimed }]), /claims guest path/);
  }
  for (const claimed of [undefined, 'C:/SAVE/A.SAV', 'c:\\save\\a.sav']) {
    const bytes = fixture('path-agrees', [{ name: 'vfs/c/Save/A.sav', path: claimed }]);
    const read = save.readBundle(bytes);
    assert.equal(read.files[0].path, 'c:\\save\\a.sav'); assert.equal(read.files[0].member, 'vfs/c/Save/A.sav');
    assert.deepEqual([...read.files[0].data], [17]);
    for (const key of Object.keys(metadata)) assert.deepEqual(read.files[0][key], metadata[key]);
    const s = sentinel();
    const imported = save.importBundle(bytes, { ...s, patterns: ['C:/SAVE/?.SAV'] });
    assert.deepEqual(imported.files, ['c:\\save\\a.sav']); assert.equal(s.vfs.files.get('c:\\save\\a.sav').attrs, 0x23);
  }
});

group('late hash/size/state failures still reject before replace deletes or store clears', () => {
  const specs = [{ name: 'vfs/c/save/first.sav' }, { name: 'vfs/c/save/second.sav' }];
  refuses(fixture('late-size', specs, m => { m.files[1].size++; }), /manifest declares/);
  refuses(fixture('late-hash', specs, m => { m.files[1].sha256 = '0'.repeat(64); }), /hash mismatch/);
  refuses(fixture('state-hash', specs, m => { m.state.ini.sha256 = '0'.repeat(64); }), /hash mismatch/);
});

group('supported distinct paths, empty files, metadata and deterministic export/import', () => {
  const names = ['vfs/c/save/a.sav', 'vfs/c/save/sub/a.sav', 'vfs/c/save/ab.sav', 'vfs/d/save/a.sav', 'vfs/c/save/a+.sav'];
  const bytes = fixture('distinct', names.map((name, i) => ({ name, data: i === 1 ? [] : [i] })));
  assert.equal(save.readBundle(bytes).files.length, 5);
  const store = { 'reg:HKCU\\independent': { slot: 3 }, 'ini:test.ini': { Save: { Value: 'yes' } } };
  for (const mode of ['merge', 'replace']) {
    const vfs = new VirtualFS(); let restored;
    save.importBundle(bytes, { vfs, storageModule: { clearStore() {}, importStore(s) { restored = s; return 2; } }, patterns: ['C:/SAVE/*.SAV', 'd:/save/*.sav'], mode });
    assert.deepEqual(restored, store); assert.equal(vfs.files.get('c:\\save\\sub\\a.sav').data.length, 0);
    const opts = { vfs, patterns: ['C:/SAVE/*.SAV', 'd:/save/*.sav'], appId: 'independent', createdAt: when, commit: 'independent', store: restored };
    const first = save.exportBundle(opts); assert.deepEqual(save.exportBundle(opts), first);
    const secondVfs = new VirtualFS();
    save.importBundle(first, { vfs: secondVfs, patterns: opts.patterns, applyStore: false });
    assert.deepEqual(save.exportBundle({ ...opts, vfs: secondVfs }), first);
    for (const f of save.readBundle(first).files) for (const key of Object.keys(metadata)) assert.deepEqual(f[key], metadata[key]);
  }
});

group('legacy glob behavior and actual VFS case-insensitive lookup remain compatible', () => {
  const bytes = fixture('glob-positive', [{ name: 'vfs/c/Save/Slot.sav' }, { name: 'vfs/c/save/nested/a.sav' }]);
  const vfs = new VirtualFS();
  save.importBundle(bytes, { vfs, patterns: ['C:/SAVE/*.SAV'], applyStore: false });
  assert.equal(vfs.files.size, 2); // Existing * crosses directory boundaries.
  assert.equal(vfs.files.get(vfs._normPath('C:/SAVE/./Slot.sav')).data[0], 17);
  for (const patterns of [[], ['c:/save/?.sav'], ['c:/elsewhere/*'], ['c:/save/*.dat']]) for (const mode of ['merge', 'replace']) {
    const s = sentinel(); assert.throws(() => save.importBundle(bytes, { ...s, patterns, mode }), /no persistFiles globs|outside the app's persistFiles globs/); s.untouched();
  }
  assert.equal(save.memberToGuestPath('vfs/c/Save/Slot.sav'), 'c:\\Save\\Slot.sav');
  assert.equal(save.guestPathToMember('C:/Save/Slot.sav'), 'vfs/c/save/slot.sav');
});

group('explicit public API case-preservation challenge against unchanged ancestor source', () => {
  const source = fs.readFileSync(process.env.SAVE_ACCEPT_BASELINE, 'utf8');
  const baseline = new Module(path.join(__dirname, '../lib/review-baseline.js'), module);
  baseline.filename = path.join(__dirname, '../lib/review-baseline.js'); baseline.paths = module.paths;
  baseline._compile(source, baseline.filename);
  const bytes = fixture('api-case-delta', [{ name: 'vfs/c/Save/Slot.sav' }]);
  assert.equal(baseline.exports.readBundle(bytes).files[0].path, 'c:\\Save\\Slot.sav');
  assert.equal(baseline.exports.inspectBundle(bytes).files[0].path, 'c:\\Save\\Slot.sav');
  assert.equal(save.readBundle(bytes).files[0].path, 'c:\\save\\slot.sav');
  assert.equal(save.inspectBundle(bytes).files[0].path, 'c:\\save\\slot.sav');
  assert.equal(save.readBundle(bytes).files[0].member, 'vfs/c/Save/Slot.sav');
  const s = sentinel();
  assert.throws(() => baseline.exports.importBundle(bytes, { ...s, patterns: ['c:\\save\\*.sav'] }), /outside the app's persistFiles globs/); s.untouched();
  // Normal writer-produced legacy bundles already contain canonical lowercase.
  const vfs = new VirtualFS(); vfs.files.set('c:\\save\\slot.sav', { ...metadata, data: Uint8Array.of(7) });
  const options = { vfs, appId: 'independent', patterns: ['C:/SAVE/*.SAV'], createdAt: when, commit: 'unchanged', store: {} };
  const legacy = baseline.exports.exportBundle(options);
  assert.deepEqual(save.exportBundle(options), legacy);
  assert.deepEqual(save.readBundle(legacy), baseline.exports.readBundle(legacy));
});
