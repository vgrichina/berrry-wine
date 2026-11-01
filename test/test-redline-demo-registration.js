'use strict';
// Static route and retained original media checks; no guest or server starts.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { APPS, DESKTOP_APPS, LOCAL_CANDIDATE_APPS, DEBUG_ONLY_APPS } = require('../lib/apps');
const { normalizeLazyFiles, mergeLocalManifestFiles } = require('../lib/app-files');
const root = path.resolve(__dirname, '..');
const prefix = 'test/binaries/candidates/redline-demo/';
const app = APPS.redline_demo;
assert.deepEqual(app, {
  exe: prefix + 'original/MAINDIR/Redline.exe',
  exeGuestPath: 'c:\\MAINDIR\\Redline.exe', workingDirectory: 'c:\\MAINDIR', args: '',
  dlls: [prefix + 'original/MAINDIR/IFORCE2.DLL'], files: [],
  localFileManifest: prefix + '.wine-assembly-browser.json', requiredFiles: true,
});
assert.equal(LOCAL_CANDIDATE_APPS.filter(([id]) => id === 'redline_demo').length, 1);
for (const list of [DESKTOP_APPS, DEBUG_ONLY_APPS]) assert(!list.some(([id]) => id === 'redline_demo'));
const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const eligibility = page.match(/const LOCAL_DESKTOP = ([\s\S]*?);/)[1];
const selector = page.match(/const selectorApps = ([\s\S]*?);/)[1];
function eligible(hostname, search) {
  return vm.runInNewContext(`const LOCAL_DESKTOP = ${eligibility}; (${selector})`, {
    location: { hostname, search }, URLSearchParams, DEBUG_MODE: search.includes('debug'),
    DEFAULT_APPS: DESKTOP_APPS, LOCAL_CANDIDATE_APPS, DEBUG_ONLY_APPS,
  }).some(([id]) => id === 'redline_demo');
}
for (const host of ['localhost', '127.0.0.1', '192.168.1.2']) {
  assert(eligible(host, '?candidates&app=redline_demo'));
  assert(eligible(host, '?debug&candidates&app=redline_demo'));
  for (const query of ['', '?app=redline_demo', '?debug&app=redline_demo', '?candidates&prod&app=redline_demo']) {
    assert(!eligible(host, query));
  }
}
assert(!eligible('example.com', '?debug&candidates&app=redline_demo'));
console.log('PASS Redline exact original launch entry and checked-out local/public selector policy');

// Optional ignored media must never silently skip an explicitly requested check.
if (process.argv.includes('--fixture')) {
  const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
  const read = p => fs.readFileSync(path.join(root, p));
  const doc = read('docs/re-notes/redline-demo.md').toString();
  const rows = [...doc.matchAll(/^\| `([^`]+)` \| (\d+) \| `([0-9a-f]{64})` \|$/gm)]
    .map(m => ({ path: m[1], bytes: Number(m[2]), sha256: m[3] }))
    .sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  assert.equal(rows.length, 65);
  const canonical = rows.map(x => `${x.sha256}  ${x.bytes}  ${x.path}\n`).join('');
  assert.equal(sha(canonical), '08c55c1a9054ec7f0d8ceb717aa308d7bd338e7a542d3ffbde56965b353d82df');
  const archive = 'scratch/runs/20261031T2348Z-redline-original-recovery/';
  function walk(dir) {
    return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(e => {
      const p = dir + '/' + e.name;
      assert(!e.isSymbolicLink(), p);
      return e.isDirectory() ? walk(p) : [p];
    });
  }
  assert.deepEqual(walk(prefix + 'original').map(p => p.slice((prefix + 'original/').length)).sort(), rows.map(x => x.path));
  for (const row of rows) {
    const candidate = prefix + 'original/' + row.path;
    const original = archive + 'extracted/' + row.path;
    for (const p of [candidate, original]) {
      const bytes = read(p);
      assert.equal(bytes.length, row.bytes, p);
      assert.equal(sha(bytes), row.sha256, p);
    }
    const a = fs.statSync(path.join(root, candidate));
    const b = fs.statSync(path.join(root, original));
    assert(a.dev !== b.dev || a.ino !== b.ino, 'candidate cannot share archival inode: ' + row.path);
  }
  const pkg = read(archive + 'RLSPDEMO.EXE');
  assert.equal(pkg.length, 48229213);
  assert.equal(sha(pkg), 'e9998c385851b7ef394a412a257a58c179711e4842df3a601ced545e0e8e3f7c');
  assert.equal(read(prefix + '.host/inventory.sha256').toString(), canonical);
  assert.deepEqual(JSON.parse(read(prefix + '.host/package-reference.json')), {
    path: archive + 'RLSPDEMO.EXE', bytes: 48229213,
    sha256: 'e9998c385851b7ef394a412a257a58c179711e4842df3a601ced545e0e8e3f7c', copied: false,
  });
  const { detectRequiredDlls } = require('../lib/dll-loader');
  const imported = detectRequiredDlls(read(app.exe));
  assert.deepEqual(imported, ['shell32.dll', 'ddraw.dll', 'dinput.dll', 'dsound.dll',
    'winmm.dll', 'user32.dll', 'gdi32.dll', 'ole32.dll', 'wsock32.dll', 'iforce2.dll',
    'advapi32.dll', 'kernel32.dll']);
  assert.deepEqual(detectRequiredDlls(read(app.dlls[0])), ['kernel32.dll', 'ole32.dll']);
  assert.deepEqual(app.dlls.map(p => path.basename(p).toLowerCase()),
    imported.filter(n => rows.some(x => x.path === 'MAINDIR/' + n.toUpperCase())));
  const game = rows.filter(x => x.path.startsWith('MAINDIR/'));
  assert.equal(game.length, 60);
  assert.equal(game.reduce((n, x) => n + x.bytes, 0), 91406857);
  const expected = { schemaVersion: 1, files: game.filter(x => x.path !== 'MAINDIR/Redline.exe').map(x => ({
    url: 'original/' + x.path, vfsPath: 'c:\\' + x.path.replaceAll('/', '\\'), size: x.bytes,
  })) };
  const manifest = JSON.parse(read(app.localFileManifest));
  assert.deepEqual(manifest, expected, 'ordinary schema1 manifest contains exactly all 59 companions');
  const source = read('test/run.js').toString();
  const start = source.indexOf('const getAssetFiles = entry => {');
  const end = source.indexOf('\nconst WASM_PATH', start);
  assert(start > 0 && end > start);
  const getAssetFiles = vm.runInNewContext(source.slice(start, end) + '\ngetAssetFiles;', {
    fs, path, appAsset: url => path.join(root, url), ASSET_ENTRY_ID: 'redline_demo', APP_ID: 'redline_demo',
    require: name => { assert.equal(name, '../lib/app-files'); return require('../lib/app-files'); },
  });
  const files = getAssetFiles(app);
  assert.equal(files.length, 59);
  const base = new URL(app.localFileManifest, 'http://127.0.0.1:8098/emulator/');
  const browserFiles = mergeLocalManifestFiles(app.files, manifest.files.map(f => ({ ...f, url: new URL(f.url, base).href })));
  for (const [i, file] of files.entries()) {
    assert.equal(new URL(browserFiles[i].url).pathname, '/emulator/' + file.url);
    assert.equal(file.vfsPath, expected.files[i].vfsPath);
    assert.equal(file.size, expected.files[i].size);
  }
  const policy = normalizeLazyFiles(app, files);
  assert.equal(policy.summary.unknownSizes, 0);
  assert.equal(policy.summary.eagerFiles, 8);
  assert.equal(policy.summary.lazyFiles, 51);
  assert.equal(normalizeLazyFiles(app, files, { synchronousFaultReads: true }).summary.eagerFiles, 59);
  assert(!fs.existsSync(path.join(root, prefix, 'original/MAINDIR/Redline.CFG')));
  console.log('PASS package/full 65-file pins, archival preservation/independent inodes, exact 59-companion manifest, actual CLI and browser URL/VFS resolution');
  console.log(JSON.stringify(policy.summary));
}
