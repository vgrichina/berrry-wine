#!/usr/bin/env node
'use strict';
// Pure JS: actual corpus generator, page launcher, shipped ToyVM mount and DOS
// file implementation. No compile, WebAssembly instantiation or guest execution.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { requiredOriginalFiles, mergeSelectedManifest, parseOnly } = require('../tools/toyvm-dos-corpus');
const { titleView } = require('../ops/toyvm-server');
const { createLauncher } = require('../ops/toyvm-live/live');
const root = path.resolve(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'toyvm-dos-corpus/titles.json')));
const title = cfg.titles.find(t => t.id === 'ultima4'), base = path.join(root, title.gameDir);
const expected = ['DNGMAP.SAV', 'MONSTERS.SAV', 'OUTMONST.SAV', 'PARTY.SAV'];
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
async function main() {
  assert.equal(parseOnly([]), null);
  assert.deepEqual(parseOnly(['--only=ultima4']), ['ultima4']);
  for (const arg of ['--only=', '--only', '--only=,', '--only=ultima4,']) assert.throws(() => parseOnly([arg]), /nonempty/);
  const previous = { schemaVersion: 1, metadata: 'retained', titles: cfg.titles.map(t => ({ id: t.id, preserve: t.id })) };
  const replacement = { id: 'ultima4', updated: true };
  const merged = mergeSelectedManifest(previous, { titles: [replacement] }, ['ultima4']);
  assert.equal(merged.titles.length, cfg.titles.length); assert.equal(merged.metadata, 'retained');
  for (const t of previous.titles) assert.equal(merged.titles.find(x => x.id === t.id), t.id === 'ultima4' ? replacement : t);
  assert.throws(() => mergeSelectedManifest(previous, { titles: [] }, ['ultima4']), /unknown selected/);

  const synthetic = fs.mkdtempSync(path.join(os.tmpdir(), 'toyvm-required-synthetic-'));
  try {
    fs.mkdirSync(path.join(synthetic, 'support'));
    fs.writeFileSync(path.join(synthetic, 'support', 'TEST.SAV'), Buffer.from([1, 2, 3]));
    const t = { id: 'fixture', requiredOriginalFiles: [{ path: 'support/TEST.SAV', guestPath: 'TEST.SAV' }] };
    assert.deepEqual(requiredOriginalFiles(t, synthetic, []), ['support/TEST.SAV']);
    assert.throws(() => requiredOriginalFiles(t, synthetic, ['test.sav']), /collision/);
    assert.throws(() => requiredOriginalFiles({ id: 'bad', requiredOriginalFiles: [{ path: '../TEST.SAV', guestPath: 'TEST.SAV' }] }, synthetic, []), /invalid/);
  } finally { fs.rmSync(synthetic, { recursive: true }); }
  if (!fs.existsSync(path.join(base, '__support/save/PARTY.SAV'))) {
    if (process.argv.includes('--negative-control')) throw Error('negative control requires original U4 fixture; refusing to skip');
    console.log('PASS selector/merge/synthetic path contracts; SKIP original U4 payload-dependent mount/write coverage (fixture absent)');
    return;
  }
  const paths = requiredOriginalFiles(title, base, ['ULTIMA.COM', 'PARTY.NEW']);
  assert.deepEqual(paths.map(p => path.posix.basename(p)), expected);
  const before = Object.fromEntries(paths.map(p => [p, hash(fs.readFileSync(path.join(base, p)))]));
  assert.equal(before['__support/save/PARTY.SAV'], 'f647ceab6d0e9dd619335988e0dfd5dfdc5b1d7690f9eac1cf686d32f04a0acb');
  assert.throws(() => requiredOriginalFiles({ id: 'missing', requiredOriginalFiles: [{ path: '__support/save/ABSENT.SAV', guestPath: 'ABSENT.SAV' }] }, base, []), /ENOENT/);
  assert.throws(() => requiredOriginalFiles(title, base, ['party.sav']), /collision/);
  assert.throws(() => requiredOriginalFiles({ id: 'bad', requiredOriginalFiles: [{ path: '../PARTY.SAV', guestPath: 'PARTY.SAV' }] }, base, []), /invalid/);
  assert.throws(() => requiredOriginalFiles({ id: 'bad', requiredOriginalFiles: [{ path: '__support/save/PARTY.SAV', guestPath: 'OTHER.SAV' }] }, base, []), /invalid/);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'toyvm-required-'));
  try {
    fs.symlinkSync(path.join(base, paths[0]), path.join(temporary, 'DNGMAP.SAV'));
    assert.throws(() => requiredOriginalFiles({ id: 'escape', requiredOriginalFiles: [{ path: 'DNGMAP.SAV', guestPath: 'DNGMAP.SAV' }] }, temporary, []), /outside/);
  } finally { fs.rmSync(temporary, { recursive: true }); }

  const fileNames = process.argv.includes('--negative-control') ? ['PARTY.NEW'] : ['PARTY.NEW', ...paths];
  const view = await titleView(root, 'ultima4');
  assert.equal(view.launchable, true);
  const files = view.files.filter(f => fileNames.includes(f.path));
  assert.equal(files.length, fileNames.length);
  assert.deepEqual(view.files.filter(f => f.path.startsWith('__support/')).map(f => f.path), paths);
  assert(!view.files.some(f => /dosbox|cloud_saves|__redist/i.test(f.path)), 'wrapper exclusions remain intact');
  for (const f of files) assert.equal(f.url, '/toyvm/files/ultima4/' + f.path);
  const fetched = [];
  const holder = {};
  // Existing committed browser bundle only exposes modules here. No LiveRun or
  // compile API is called, and the global WebAssembly API is not supplied.
  new Function('self', 'atob', fs.readFileSync(path.join(root, 'docs/dos-corpus/live/toyvm-bundle.js'), 'utf8'))(holder, s => Buffer.from(s, 'base64').toString('binary'));
  const vm = holder.ToyVM, ui = { showDialog() {}, hideDialog() {}, phase() {}, running() {}, cancelled() {}, error(e) { throw e; } };
  let mounted;
  const launcher = createLauncher({ files }, {
    fetch: async url => { const record = files.find(f => f.url === url); assert(record, 'actual manifest URL'); fetched.push(url); const bytes = fs.readFileSync(path.join(base, record.path)); return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }; },
    setTimeout, clearTimeout, now: Date.now, digest: async bytes => crypto.createHash('sha256').update(bytes).digest(),
    loadRuntime: async () => {}, ui,
    start: async map => { mounted = map; for (const [name, bytes] of Object.entries(map)) vm.mount(name, bytes); return { stop() {} }; },
  });
  await launcher.launch(); assert.equal(launcher.state, 'running');
  assert.deepEqual(fetched.sort(), files.map(f => f.url).sort());
  const { Machine } = vm.require('./dos');
  const machine = new Machine(new Uint8Array(16 * 1024 * 1024), { fileRoot: '.', sound: 'none', gus: false });
  for (const name of expected) {
    const h = machine.openFile('C:\\' + name);
    assert(h > 0, 'authentic required original is available to native DOS: ' + name);
    const f = machine.files.get(h), original = fs.readFileSync(path.join(base, '__support/save', name));
    assert.equal(hash(f.buf), hash(original));
    machine.mem.set([0x71, 0x82], 0x10000);
    f.pos = 1; machine.writeFile(f, 0x10000, 2);
    const reopened = machine.files.get(machine.openFile(name));
    assert.deepEqual(Array.from(reopened.buf.subarray(1, 3)), [0x71, 0x82]);
    assert.equal(hash(mounted[name]), hash(original), 'mount bytes unchanged by DOS copy-on-write');
  }
  for (const p of paths) assert.equal(hash(fs.readFileSync(path.join(base, p))), before[p], 'original disk asset unchanged');
  vm.unmountAll();
  console.log('PASS native required original templates: validation, five-title merge, actual page mount and DOS copy-on-write; no guest execution');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
