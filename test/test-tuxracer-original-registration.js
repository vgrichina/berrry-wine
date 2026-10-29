// Static acceptance through the unchanged production CLI asset boundary. No guest runs.
const fs = require('fs'), path = require('path'), vm = require('vm');
const assert = require('assert'), crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const { APPS } = require('../lib/apps');
const entry = APPS.tuxracer_original_061a;
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const runner = fs.readFileSync(path.join(__dirname, 'run.js'), 'utf8');
assert.equal(sha(Buffer.from(runner)), 'f96e9bb924700ee571e2904e097f80742ff55638399898ae1dc32454af05b02d');
const start = runner.indexOf('const getAssetFiles = entry => {');
const end = runner.indexOf('const WASM_PATH =', start);
assert(start >= 0 && end > start);
// Execute the byte-exact production boundary; do not rebuild its logic in the test.
const boundary = runner.slice(start, end);
const load = vm.runInNewContext(boundary + '\ngetAssetFiles', {
  fs, path, require, ASSET_ENTRY_ID: 'tuxracer_original_061a',
  APP_ID: 'tuxracer_original_061a', appAsset: p => path.join(root, p),
});
const inventory = JSON.parse(fs.readFileSync(path.join(root, entry.localManifestIntegrity.inventory)));
const dir = path.dirname(path.join(root, entry.localFileManifest));
const manifestPath = path.join(root, entry.localFileManifest);
const manifestBytes = fs.readFileSync(manifestPath);
const mount = () => {
  const files = load(entry); // Throws before any consumer can mount returned bytes.
  assert.equal(files.length, inventory.files.length - 1);
  const byVfs = new Map(files.map(f => [f.vfsPath.toLowerCase(), f]));
  for (const pin of inventory.files) {
    const vfs = 'c:\\' + pin.path.replace(/\//g, '\\');
    const b = pin.path.endsWith('.exe') ? files.verifiedMedia.exeBytes : byVfs.get(vfs.toLowerCase()).bytes;
    assert.equal(b.length, pin.bytes); assert.equal(sha(b), pin.sha256);
  }
  return files;
};
assert.equal(entry.exeGuestPath.toLowerCase(), 'c:\\tuxracer-win32-0.61a\\tuxracer.exe');
assert.equal(entry.workingDirectory.toLowerCase(), 'c:\\tuxracer-win32-0.61a');
assert(entry.localOnly && entry.requiredFiles);
assert.equal(entry.dlls.length, 3);
for (const dll of entry.dlls) assert(mount().verifiedMedia.byUrl.has(dll));
const passed = ['all 158 original sizes/digests', 'correct executable, DLL and data VFS mappings'];
for (const rel of ['tuxracer.exe', 'TCL83.DLL', 'SDL.dll', 'SDL_mixer.dll', 'tuxracer_init.tcl', 'courses/course_idx.tcl']) {
  const file = path.join(dir, 'game/tuxracer-win32-0.61a', rel);
  const saved = fs.readFileSync(file);
  try {
    fs.renameSync(file, file + '.held');
    assert.throws(() => load(entry));
  } finally { fs.renameSync(file + '.held', file); }
  try {
    const corrupt = Buffer.from(saved); corrupt[0] ^= 1; fs.writeFileSync(file, corrupt);
    assert.throws(() => load(entry), /identity mismatch/);
  } finally { fs.writeFileSync(file, saved); }
  passed.push('missing/corrupt rejected: ' + rel);
}
for (const mutate of [m => { m.files[0].url = '../escape'; },
  m => { m.files[0].vfsPath = 'c:\\..\\escape'; }, m => m.files.pop()]) {
  try {
    const m = JSON.parse(manifestBytes); mutate(m); fs.writeFileSync(manifestPath, JSON.stringify(m));
    assert.throws(() => load(entry), /exact companion mappings/);
  } finally { fs.writeFileSync(manifestPath, manifestBytes); }
}
passed.push('URL escape, VFS escape and omitted required mapping rejected');
mount();
const result = { passed, boundarySha256: sha(Buffer.from(boundary)), source: 'test/run.js:getAssetFiles',
  originalMediaBytes: 13225945, computedTclClosure: 'UNKNOWN', runtime: 'NOT RUN' };
fs.mkdirSync(path.join(root, 'evidence'), { recursive: true });
fs.writeFileSync(path.join(root, 'evidence/acceptance.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
