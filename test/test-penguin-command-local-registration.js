#!/usr/bin/env node
'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const { createRequire } = require('module');
const { APPS, LOCAL_CANDIDATE_APPS, DESKTOP_APPS, DEBUG_ONLY_APPS } = require('../lib/apps');
const { buildLaunchArgs } = require('../lib/candidate-cli');
const { expandIncludePatterns } = require('../lib/vfs-host-files');
const { prepare, verify, mappings } = require('../tools/verify-penguin-command');
const pins = require('./candidate-corpus/penguin-command-files.json').files;
const manifest = require('./candidate-corpus/manifest.json');
const candidate = manifest.candidates.find(c => c.id === 'penguin-command-1611');
const app = APPS.penguin_command_1611;
const root = path.resolve(__dirname, '..');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
assert.equal(pins.length, 91);
assert.equal(pins.reduce((n, p) => n + p.bytes, 0), 1778442);
assert.equal(candidate.localOnly, true);
assert.equal(app.localOnly, true);
assert.deepEqual(candidate.packages, []);
assert.equal(manifest.candidates.filter(c => c.id === candidate.id).length, 1);
assert.equal(LOCAL_CANDIDATE_APPS.filter(([id]) => id === 'penguin_command_1611').length, 1);
for (const list of [DESKTOP_APPS, DEBUG_ONLY_APPS]) assert(!list.some(([id]) => id === 'penguin_command_1611'));
assert.deepEqual(candidate.executables, ['game/penguin-command.exe']);
assert.equal(app.exe, manifest.assetRoot + '/' + candidate.id + '/' + candidate.executables[0]);
assert.equal(app.exeGuestPath, 'C:\\penguin-command.exe');
assert.equal(app.workingDirectory, 'C:\\');
assert.equal(app.args, '--windowed --nosound');
assert.equal(app.requiredFiles, true);
assert.deepEqual(app.files, []);
assert.equal(app.localFileManifest, manifest.assetRoot + '/' + candidate.id + '/.wine-assembly-browser.json');
assert.deepEqual(app.localManifestIntegrity, {
  inventory: 'test/candidate-corpus/penguin-command-files.json',
  sha256: hash(fs.readFileSync(path.join(root, 'test/candidate-corpus/penguin-command-files.json'))),
});

// Genuine-input acceptance is mandatory: no silent fixture skip.
const [original, crt, adapterPath] = process.argv.slice(2);
assert(original && crt, 'pass ORIGINAL CRT; real input acceptance cannot be skipped');
const parent = path.resolve(__dirname, '../../penguin-registration-test-temp');
assert(!fs.existsSync(parent));
fs.mkdirSync(parent);
const fixture = path.join(parent, 'fixture');
try {
  assert.deepEqual(prepare(path.resolve(original), path.resolve(crt), fixture),
    { files: 91, bytes: 1778442, companions: 90 });
  const mapFile = path.join(fixture, '.wine-assembly-browser.json');
  const mapBytes = fs.readFileSync(mapFile);
  // Optional explicit shared-adapter qualification. Without its pending change,
  // accepted main does not implement this API; never pretend the standalone
  // preparer establishes ordinary loader acceptance.
  const adapter = adapterPath && require(path.resolve(adapterPath));
  const reads = [];
  const io = {
    read: url => { reads.push(url); return fs.readFileSync(path.isAbsolute(url) ? url : path.join(root, url)); },
    resolve: url => path.join(fixture, url), sha256: hash,
  };
  function validateAdapter() {
    if (!adapter) return;
    reads.length = 0;
    const result = adapter.validateLocalManifestSync(app, JSON.parse(fs.readFileSync(mapFile)), io);
    assert.equal(result.files.length, 90);
    assert.equal(hash(result.exeBytes), pins.find(p => p.path.endsWith('.exe')).sha256);
    for (const pin of pins.filter(p => !p.path.endsWith('.exe'))) {
      const entry = result.files.find(p => p.url === path.join(fixture, 'game', pin.path));
      assert(entry && entry.loadMode === 'required');
      assert.equal(hash(entry.bytes), pin.sha256);
      assert.equal(entry.vfsPath, 'c:\\' + pin.path.replace(/\//g, '\\'));
    }
  }
  validateAdapter();
  if (adapter) {
    reads.length = 0;
    const wrongInventory = structuredClone(app); wrongInventory.localManifestIntegrity.sha256 = '0'.repeat(64);
    assert.throws(() => adapter.validateLocalManifestSync(wrongInventory,
      JSON.parse(mapBytes), io), /identity mismatch/);
    assert.deepEqual(reads, [app.localManifestIntegrity.inventory], 'inventory rejection precedes game reads');
  }
  assert.throws(() => prepare(original, crt, fixture), /fresh destination/);
  assert.deepEqual(fs.readFileSync(mapFile), mapBytes, 'overwrite rejection preserves existing bytes');
  const game = path.join(fixture, 'game');
  const args = buildLaunchArgs(candidate, { runPath: path.join(root, 'test/run.js'),
    fixtureRoot: fixture, executable: path.join(fixture, candidate.executables[0]) });
  assert(args.includes('--exe=' + path.join(game, 'penguin-command.exe')));
  assert(args.includes('--exe-guest-path=' + app.exeGuestPath));
  assert(args.includes('--cwd=' + app.workingDirectory));
  assert(args.includes('--args=' + app.args));
  const dlls = pins.filter(p => p.path.endsWith('.dll')).map(p => p.path).sort();
  assert.equal(dlls.length, 7);
  assert.deepEqual(args.filter(a => a.startsWith('--dll-seed=')).map(a => path.basename(a.slice(11))).sort(), dlls);
  assert.deepEqual(app.dlls.map(p => p.slice((manifest.assetRoot + '/' + candidate.id + '/game/').length)).sort(), dlls);
  const patterns = args.filter(a => a.startsWith('--vfs-include=')).map(a => a.slice(14));
  const closure = expandIncludePatterns(game, patterns);
  assert.equal(closure.length, pins.length);
  for (const pin of pins) {
    const item = closure.find(p => p.guestPath === pin.path);
    assert(item, pin.path);
    const bytes = fs.readFileSync(item.hostPath);
    assert.equal(bytes.length, pin.bytes); assert.equal(hash(bytes), pin.sha256);
  }
  // Run the production corpus writer, forbidding network and subprocess use.
  const filename = path.join(root, 'tools/fetch-candidate-corpus.js');
  const source = fs.readFileSync(filename, 'utf8').split('\n(async () => {')[0];
  const realRequire = createRequire(filename);
  const context = vm.createContext({ __dirname: path.dirname(filename), Buffer, console,
    process: { argv: ['node', filename] }, require(name) {
      if (['http', 'https', 'child_process'].includes(name))
        return new Proxy({}, { get() { return () => { throw Error('Forbidden network/subprocess'); }; } });
      return realRequire(name);
    } });
  vm.runInContext(source + '\nthis.writeManifest = writeBrowserManifest;', context);
  context.writeManifest(candidate, fixture);
  verify(fixture);
  assert.deepEqual(JSON.parse(fs.readFileSync(mapFile)), { schemaVersion: 1, files: mappings() });
  for (const pin of pins) {
    const file = path.join(game, pin.path), held = file + '.held';
    fs.renameSync(file, held);
    try {
      assert.throws(() => verify(fixture), /exact game closure/);
      if (adapter) assert.throws(validateAdapter, /ENOENT/);
    }
    finally { fs.renameSync(held, file); }
  }
  // Mutate every EXE/DLL and one asset; no authentic input is changed.
  for (const pin of pins.filter(p => /\.(exe|dll)$/.test(p.path)).concat(pins.find(p => p.path.endsWith('.png')))) {
    const file = path.join(game, pin.path), bytes = fs.readFileSync(file);
    const changed = Buffer.from(bytes); changed[0] ^= 1; fs.writeFileSync(file, changed);
    try {
      assert.throws(() => verify(fixture), /identity:/);
      if (adapter) assert.throws(validateAdapter, /identity mismatch/);
      const rejected = path.join(parent, 'rejected');
      assert.throws(() => prepare(game, path.join(game, 'msvcrt.dll'), rejected), /identity:/);
      assert(!fs.existsSync(rejected), 'source rejection precedes mkdir');
    } finally { fs.writeFileSync(file, bytes); }
  }
  for (const mutate of [m => { m.files[0].vfsPath = 'c:\\wrong'; },
    m => { m.files[0].url = '../outside'; }, m => { m.files.push(m.files[0]); },
    m => { m.schemaVersion = 2; }, m => { m.files[0].size++; }]) {
    const changed = { schemaVersion: 1, files: mappings() }; mutate(changed);
    fs.writeFileSync(mapFile, JSON.stringify(changed));
    const before = fs.readFileSync(mapFile);
    assert.throws(() => verify(fixture), /exact companion mappings/);
    if (adapter) {
      assert.throws(validateAdapter, /exact companion mappings/);
      assert.deepEqual(reads, [app.localManifestIntegrity.inventory], 'bad mapping rejection precedes game reads');
    }
    assert.deepEqual(fs.readFileSync(mapFile), before, 'verification is read-only');
  }
  fs.writeFileSync(mapFile, mapBytes);
  const missing = structuredClone(candidate); missing.cli.dlls = ['game/missing.dll'];
  assert.throws(() => buildLaunchArgs(missing, { runPath: 'test/run.js', fixtureRoot: fixture,
    executable: path.join(game, 'penguin-command.exe') }), /dlls is missing/);
  verify(fixture);
  validateAdapter();
  if (adapter) console.log('PASS explicit pending shared adapter: genuine identity/mappings and all rejection controls; module SHA256 ' + hash(fs.readFileSync(adapterPath)) + '. Ordinary host wiring/guest acceptance is not asserted.');
  console.log('PASS Penguin: genuine 91 files/1778442 bytes, 7 DLLs, real buildLaunchArgs/VFS/corpus writer; 91 missing, 9 mutated EXE/DLL/asset, 5 invalid maps, bad source/overwrite/missing seed controls. Ordinary loader adapter acceptance is separate; no guest/browser/network.');
} finally { fs.rmSync(parent, { recursive: true, force: true }); }
