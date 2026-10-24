'use strict';
// Filesystem-only extraction of the actual CLI media resolver. No guest, build,
// browser, network, or reads from the rejected target are performed.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const repo = path.resolve(process.argv[2]);
const base = path.resolve(process.argv[3]);
const { prepare, verify } = require(path.join(repo, 'tools/verify-airstrike-pre6a.js'));
const { APPS } = require(path.join(repo, 'lib/apps.js'));
const fixture = path.join(base, 'gap-fixture');
const source = fs.readFileSync(path.join(repo, 'test/run.js'), 'utf8');
const start = source.indexOf('const getAssetFiles = entry => {');
const end = source.indexOf('\nconst WASM_PATH =', start);
assert(start >= 0 && end > start);
const resolver = source.slice(start, end);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
assert(!fs.existsSync(fixture), 'reproduction requires an absent task-owned destination');
try {
  prepare(...process.argv.slice(4, 7).map(p => path.resolve(p)), fixture);
  const manifestPath = path.join(fixture, '.wine-assembly-browser.json');
  const entry = { ...APPS.airstrike_pre6a, localFileManifest: manifestPath };
  const context = vm.createContext({ fs, path, appAsset: p => p,
    ASSET_ENTRY_ID: 'airstrike_pre6a', APP_ID: 'airstrike_pre6a',
    require: name => {
      assert.equal(name, '../lib/app-files');
      return require(path.join(repo, 'lib/app-files.js'));
    } });
  vm.runInContext(resolver + '\nthis.getAssetFiles = getAssetFiles;', context);
  assert.equal(context.getAssetFiles(entry).length, 88);
  const good = fs.readFileSync(manifestPath);
  const results = [];
  for (const changed of [
    { url: '../outside-fixture.dll', vfsPath: 'c:\\outside.dll' },
    { url: 'game/SDL.dll', vfsPath: 'c:\\unvalidated\\replacement.dll' },
  ]) {
    const manifest = JSON.parse(good);
    manifest.files[0] = { ...manifest.files[0], ...changed };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    assert.throws(() => verify(fixture), /exact companion mappings/);
    const actual = context.getAssetFiles(entry).find(p => p.vfsPath === changed.vfsPath);
    assert(actual, 'ordinary loader accepted changed mapping');
    assert.equal(actual.url, path.join(fixture, changed.url));
    results.push({ changed, verifierRejected: true, ordinaryLoaderAccepted: true,
      actual: { url: actual.url, vfsPath: actual.vfsPath },
      outsideFixture: path.relative(fixture, actual.url).startsWith('..') });
  }
  console.log(JSON.stringify({ verdict: 'REJECT: ordinary loader bypasses pinned mapping verification',
    resolverSha256: hash(resolver), sourceSha256: hash(source), results,
    scope: 'actual extracted getAssetFiles + real mergeLocalManifestFiles; no target file read or guest/browser execution' }, null, 2));
} finally { fs.rmSync(fixture, { recursive: true, force: true }); }
