#!/usr/bin/env node
'use strict';
// Real retained input checks; filesystem/launch planning only, never a guest.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const { createRequire } = require('module');
const { APPS, LOCAL_CANDIDATE_APPS, DESKTOP_APPS, DEBUG_ONLY_APPS } = require('../lib/apps');
const { buildLaunchArgs } = require('../lib/candidate-cli');
const { expandIncludePatterns } = require('../lib/vfs-host-files');
const { prepare, verify } = require('../tools/verify-airstrike-pre6a');
const root = path.resolve(__dirname, '..');
const manifest = require('./candidate-corpus/manifest.json');
const candidate = manifest.candidates.find(c => c.id === 'airstrike-pre6a');
const app = APPS.airstrike_pre6a;
const accepted = require('../docs/re-notes/airstrike-retained-codec-gameplay-20261024/complete-runtime-manifest.json')
  .filter(p => p.dest.startsWith('game/'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
assert.equal(accepted.length, 89);
assert.equal(accepted.reduce((n, p) => n + p.bytes, 0), 4072418);
assert.equal(candidate.localOnly, true);
assert.deepEqual(candidate.packages, []);
assert.equal(manifest.candidates.filter(c => c.id === candidate.id).length, 1);
assert.equal(LOCAL_CANDIDATE_APPS.filter(([id]) => id === 'airstrike_pre6a').length, 1);
for (const list of [DESKTOP_APPS, DEBUG_ONLY_APPS]) assert(!list.some(([id]) => id === 'airstrike_pre6a'));
assert.deepEqual(candidate.executables, ['game/airstrike-pre6a.exe']);
assert.deepEqual(candidate.browser, { fileRoot: 'game', exe: candidate.executables[0] });
assert.equal(app.exe, manifest.assetRoot + '/' + candidate.id + '/' + candidate.executables[0]);
assert.equal(app.localFileManifest, manifest.assetRoot + '/' + candidate.id + '/.wine-assembly-browser.json');
assert.equal(app.exeGuestPath, 'C:\\airstrike-pre6a.exe');
assert.equal(app.workingDirectory, 'C:\\');
assert.equal(app.args, '');
assert.equal(app.requiredFiles, true);
assert.deepEqual(app.files, []);
const original = process.argv[2], zlib = process.argv[3], crt = process.argv[4];
if (!original && !zlib && !crt) {
  console.log('PASS Airstrike local-only registration; SKIP retained input checks: pass ORIGINAL ZLIB CRT for complete acceptance.');
  process.exit(0);
}
assert(original && zlib && crt, 'pass ORIGINAL ZLIB CRT; real input acceptance cannot be skipped');
const parent = path.resolve(__dirname, '../../registration-test-temp');
assert(!fs.existsSync(parent));
fs.mkdirSync(parent);
const fixture = path.join(parent, 'fixture');
try {
  assert.deepEqual(prepare(path.resolve(original), path.resolve(zlib), path.resolve(crt), fixture),
    { files: 89, bytes: 4072418, companions: 88 });
  assert.throws(() => prepare(original, zlib, crt, fixture), /fresh destination/);
  const game = path.join(fixture, 'game');
  const args = buildLaunchArgs(candidate, { runPath: path.join(root, 'test/run.js'),
    fixtureRoot: fixture, executable: path.join(fixture, candidate.executables[0]) });
  assert(args.includes('--exe=' + path.join(game, 'airstrike-pre6a.exe')));
  assert(args.includes('--exe-guest-path=' + app.exeGuestPath));
  assert(args.includes('--cwd=' + app.workingDirectory));
  assert(!args.some(a => a.startsWith('--args=')), 'empty original arguments');
  const seeds = args.filter(a => a.startsWith('--dll-seed=')).map(a => a.slice(11));
  const expectedDLLs = accepted.filter(p => p.dest.endsWith('.dll')).map(p => p.dest.slice(5)).sort();
  assert.deepEqual(seeds.map(p => path.basename(p)).sort(), expectedDLLs);
  assert.deepEqual(app.dlls.map(p => p.slice((manifest.assetRoot + '/' + candidate.id + '/').length)).sort(),
    expectedDLLs.map(p => 'game/' + p));
  const patterns = args.filter(a => a.startsWith('--vfs-include=')).map(a => a.slice(14));
  const closure = expandIncludePatterns(game, patterns);
  assert.equal(closure.length, accepted.length);
  for (const pin of accepted) {
    const relative = pin.dest.slice(5);
    const item = closure.find(p => p.guestPath === relative);
    assert(item, relative);
    const bytes = fs.readFileSync(item.hostPath);
    assert.equal(bytes.length, pin.bytes, relative);
    assert.equal(hash(bytes), pin.sha256, relative);
  }
  assert(expandIncludePatterns(game, ['*.exe']).length < accepted.length);
  // Independently exercise the actual corpus manifest writer, with network and
  // subprocess entrypoints forbidden, rather than trusting the preparer's map.
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
  const mapFile = path.join(fixture, '.wine-assembly-browser.json');
  const mapping = JSON.parse(fs.readFileSync(mapFile));
  for (const pin of accepted.filter(p => !p.dest.endsWith('.exe'))) {
    const row = mapping.files.find(p => p.url === pin.dest);
    assert.deepEqual(row, { url: pin.dest, vfsPath: 'c:\\' + pin.dest.slice(5).replace(/\//g, '\\'), size: pin.bytes });
  }
  for (const pin of accepted) {
    const file = path.join(fixture, pin.dest), held = file + '.held';
    fs.renameSync(file, held);
    try { assert.throws(() => verify(fixture), /exact game closure/); }
    finally { fs.renameSync(held, file); }
  }
  for (const name of ['airstrike-pre6a.exe', 'zlib.dll', 'SDL_image.dll', 'data/bg.png', 'airstrikerc']) {
    const file = path.join(game, name), bytes = fs.readFileSync(file);
    const changed = Buffer.from(bytes); changed[0] ^= 1;
    fs.writeFileSync(file, changed);
    try {
      assert.throws(() => verify(fixture), /identity:/);
      if (name === 'zlib.dll') {
        const rejected = path.join(parent, 'rejected');
        assert.throws(() => prepare(original, file, crt, rejected), /identity: zlib.dll/);
        assert(!fs.existsSync(rejected), 'invalid source must not create destination');
      }
    } finally { fs.writeFileSync(file, bytes); }
  }
  const changed = structuredClone(mapping); changed.files[0].vfsPath = 'c:\\wrong';
  fs.writeFileSync(mapFile, JSON.stringify(changed));
  assert.throws(() => verify(fixture), /exact companion mappings/);
  fs.writeFileSync(mapFile, JSON.stringify(mapping));
  const missing = structuredClone(candidate); missing.cli.dlls = ['game/missing.dll'];
  assert.throws(() => buildLaunchArgs(missing, { runPath: 'test/run.js', fixtureRoot: fixture,
    executable: path.join(game, 'airstrike-pre6a.exe') }), /dlls is missing/);
  verify(fixture);
  console.log('PASS Airstrike: real 89-file/4072418-byte identity, 8 DLL seeds, CLI VFS, 88 exact corpus mappings; 89 missing-file, 5 corrupt-identity, wrong-map/missing-seed/bad-source/overwrite controls. No guest/browser/network.');
} finally { fs.rmSync(parent, { recursive: true, force: true }); }
