'use strict';
// Static registration/host-policy checks only; never starts a guest or server.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { APPS, DESKTOP_APPS, LOCAL_CANDIDATE_APPS, DEBUG_ONLY_APPS } = require('../lib/apps');
const { normalizeLazyFiles } = require('../lib/app-files');
const root = path.resolve(__dirname, '..');
const app = APPS.rune_demo;
const prefix = 'test/binaries/candidates/rune-demo/';
assert(app);
assert.equal(LOCAL_CANDIDATE_APPS.filter(([id]) => id === 'rune_demo').length, 1);
for (const list of [DESKTOP_APPS, DEBUG_ONLY_APPS]) assert(!list.some(([id]) => id === 'rune_demo'));
assert.deepEqual(app, {
  exe: prefix + 'game/System/Rune.exe',
  exeGuestPath: 'c:\\System\\Rune.exe', workingDirectory: 'c:\\System', args: '',
  dlls: ['MSVCRT.dll', 'Core.dll', 'Engine.dll', 'Window.dll'].map(n => prefix + 'game/System/' + n),
  files: [], localFileManifest: prefix + '.wine-assembly-browser.json',
  requiredFiles: true, relativeMouse: true, fileConcurrency: 8,
});

// Evaluate the checked-out page's eligibility and selector expressions.
const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const eligibility = page.match(/const LOCAL_DESKTOP = ([\s\S]*?);/)[1];
const selector = page.match(/const selectorApps = ([\s\S]*?);/)[1];
function eligible(hostname, search) {
  return vm.runInNewContext(`const LOCAL_DESKTOP = ${eligibility}; (${selector})`, {
    location: { hostname, search }, URLSearchParams, DEBUG_MODE: search.includes('debug'),
    DEFAULT_APPS: DESKTOP_APPS, LOCAL_CANDIDATE_APPS, DEBUG_ONLY_APPS,
  }).some(([id]) => id === 'rune_demo');
}
for (const host of ['localhost', '127.0.0.1', '192.168.1.2']) {
  assert(eligible(host, '?candidates&app=rune_demo'));
  assert(eligible(host, '?debug&candidates&app=rune_demo'));
  assert(!eligible(host, '?debug&app=rune_demo'));
  assert(!eligible(host, '?candidates&prod&app=rune_demo'));
}
assert(!eligible('example.com', '?debug&candidates&app=rune_demo'));
console.log('PASS Rune registry lookup, original startup settings and production local/public selector policy');

// Explicit retained-fixture mode keeps ordinary unit runs independent of
// ignored media. A requested fixture check must fail if that media is absent.
if (process.argv.includes('--fixture')) {
  const plan = JSON.parse(fs.readFileSync(path.join(root, prefix, '.host/launch-plan.json')));
  assert.deepEqual(app, plan.entry, 'registered row equals accepted original launch plan');
  const source = fs.readFileSync(path.join(root, 'test/run.js'), 'utf8');
  const start = source.indexOf('const getAssetFiles = entry => {');
  const end = source.indexOf('\nconst WASM_PATH', start);
  assert(start > 0 && end > start);
  const getAssetFiles = vm.runInNewContext(source.slice(start, end) + '\ngetAssetFiles;', {
    fs, path, appAsset: url => path.join(root, url), ASSET_ENTRY_ID: 'rune_demo', APP_ID: 'rune_demo',
    require: name => { assert.equal(name, '../lib/app-files'); return require('../lib/app-files'); },
  });
  const files = getAssetFiles(app);
  assert.equal(files.length, 141);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, app.localFileManifest)));
  const base = new URL(app.localFileManifest, 'http://127.0.0.1:8098/emulator/');
  for (const [i, file] of files.entries()) {
    assert.equal(new URL(manifest.files[i].url, base).pathname, '/emulator/' + file.url);
    assert.equal(fs.statSync(path.join(root, file.url)).size, file.size);
    assert.equal(file.vfsPath, 'c:\\' + file.url.slice((prefix + 'game/').length).replaceAll('/', '\\'));
  }
  assert.equal(files.filter(f => /\.exe$/i.test(f.url)).length, 3);
  const lazy = normalizeLazyFiles(app, files);
  assert.equal(lazy.summary.eagerFiles, 51);
  assert.equal(lazy.summary.lazyFiles, 90);
  assert.equal(lazy.summary.unknownSizes, 0);
  assert.equal(normalizeLazyFiles(app, files, { synchronousFaultReads: true }).summary.eagerFiles, 141);
  console.log('PASS registered entry equals accepted plan; actual CLI manifest resolver, 141 browser-relative URLs/VFS paths/sizes and ordinary loading policy');
}
