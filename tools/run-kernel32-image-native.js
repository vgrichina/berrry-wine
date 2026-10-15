'use strict';
// Coordinator-granted runtime lane only. Source preparation never invokes it.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const crypto = require('node:crypto'), assert = require('node:assert/strict');
const { makeFixture } = require('./kernel32-native-fixture');
const root = path.resolve(__dirname, '..');
const commit = process.env.WA_KERNEL32_COMMIT, out = process.env.WA_KERNEL32_EVIDENCE;
const baseline = process.env.WA_KERNEL32_BASELINE, baselineSha = process.env.WA_KERNEL32_BASELINE_SHA256;
assert.match(commit || '', /^[a-f0-9]{40}$/);
assert(out && path.isAbsolute(out)); assert(baseline && path.isAbsolute(baseline));
assert.match(baselineSha || '', /^[a-f0-9]{64}$/);
assert(!baseline.startsWith(root + '/'), 'baseline must live outside candidate checkout');
assert(!out.startsWith(root + '/build/'));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const hashFile = p => sha(fs.readFileSync(p));
const git = (...args) => cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
assert.equal(git('rev-parse', 'HEAD').trim(), commit);
fs.mkdirSync(out, { recursive: false });
const save = (name, value) => fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify(value, null, 2));
const wasm = path.join(root, 'build/wine-assembly.wasm');
const fixture = path.join(out, 'kernel32-fixture.exe'), fixtureBytes = makeFixture(), fixtureSha = sha(fixtureBytes);
// Additional immutable inputs (for example a held IW build) are supplied from
// coordinator's preflight as [{path,sha256}]. Never discover/copy other games.
const preserve = JSON.parse(process.env.WA_KERNEL32_PRESERVE_JSON || '[]');
assert(Array.isArray(preserve));
preserve.push(
  { path: '/home/user/jedi-knight-checkout/build/wine-assembly.wasm', sha256: '937466db3545b9d016fb90dfd8a414eb82653b5ebbf7cc2db7c53d8cc87d49eb' },
  { path: '/home/user/wa-iw-native-validation/build/wine-assembly.wasm', sha256: 'a948a826f71c1935c4d00f7054decdaf4d1e8115314d8779727b7e30069f5b48' });
for (const item of preserve) { assert(path.isAbsolute(item.path)); assert.match(item.sha256, /^[a-f0-9]{64}$/); }
for (const item of preserve) assert.notEqual(root, path.dirname(path.dirname(item.path)), 'never build in a preserved checkout');
function preserved() {
  assert.equal(hashFile(baseline), baselineSha, 'baseline unchanged');
  for (const item of preserve) assert.equal(hashFile(item.path), item.sha256, 'preserved input ' + item.path);
  if (fs.existsSync(fixture)) assert.equal(hashFile(fixture), fixtureSha);
}
function sources(label) {
  assert.equal(git('rev-parse', 'HEAD').trim(), commit);
  // Include every tracked byte in the sparse build closure: binary fonts and
  // fixtures, committed browser bundles, compiler provenance, and root pages.
  // Extension filters silently omitted Terminal.fon in the first staging run.
  const rows = git('ls-tree', '-r', commit).trim().split('\n')
    .map(line => line.match(/^\d+ blob ([a-f0-9]+)\t(.+)$/)).filter(Boolean)
    .filter(m => !m[2].includes('/') || /^(?:src|lib|tools|test|docs|fonts)\//.test(m[2]));
  assert(rows.length > 1000, 'source inventory must cover compiler/runtime/tests');
  const records = rows.map(([, blob, file]) => {
    const bytes = fs.readFileSync(path.join(root, file));
    const actual = crypto.createHash('sha1').update(Buffer.from('blob ' + bytes.length + '\0')).update(bytes).digest('hex');
    assert.equal(actual, blob, 'physical source ' + file);
    return { path: file, sha256: sha(bytes) };
  });
  preserved(); save(label + '-sources', { at: new Date().toISOString(), commit, node: process.version,
    moduleSha256: fs.existsSync(wasm) ? hashFile(wasm) : null, records });
}
function inventory(label) {
  // Command arguments may contain credentials. Process names/IDs suffice for
  // sole-lane occupancy and are the only process evidence retained here.
  const output = cp.execFileSync('ps', ['-eo', 'pid,ppid,pgid,comm'], { encoding: 'utf8' });
  fs.writeFileSync(path.join(out, label + '-processes.txt'), output);
  const active = output.trim().split('\n').filter(line => {
    const m = line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\S+)$/);
    return m && +m[1] !== process.pid && /^(node|MainThread|chrome|chromium|firefox|wat2wasm)$/.test(m[4]);
  });
  assert.deepEqual(active, [], 'runtime lane must be idle');
}
const statuses = [];
function arm(label, seconds, args, extraEnv = {}) {
  const fd = fs.openSync(path.join(out, label + '.log'), 'wx'), started = Date.now();
  let result;
  try { result = cp.spawnSync('timeout', ['--kill-after=5s', seconds + 's', ...args], {
    cwd: root, env: { ...process.env, ...extraEnv }, stdio: ['ignore', fd, fd],
  }); } finally { fs.closeSync(fd); }
  const row = { label, status: result.status, signal: result.signal, error: result.error?.message,
    elapsedMs: Date.now() - started };
  statuses.push(row); save(label + '-status', row);
  inventory(label + '-after'); preserved();
  assert.equal(result.status, 0, label + ': stop after any failure');
}
let passed = false;
try {
  inventory('preflight'); sources('before');
  fs.writeFileSync(fixture, fixtureBytes, { flag: 'wx' });
  save('fixture', { kind: 'generated synthetic PE, no original game', sha256: fixtureSha, size: fixtureBytes.length });
  arm('normal-build', 600, ['bash', 'tools/build.sh']); sources('built');
  arm('tiny-direct', 30, [process.execPath, 'test/test-kernel32-image.js']);
  arm('tiny-sparse', 30, [process.execPath, 'test/test-kernel32-image.js', '--sparse']);
  const common = ['test/test-kernel32-image-candidate.js', '--fixture=' + fixture, '--fixture-sha256=' + fixtureSha];
  arm('baseline-alias', 90, [process.execPath, ...common, '--wasm=' + baseline, '--expect-old-identity']);
  arm('native-direct', 90, [process.execPath, ...common, '--wasm=' + wasm]);
  arm('native-sparse', 90, [process.execPath, ...common, '--wasm=' + wasm, '--sparse']);
  arm('process-memory-hooks', 180, [process.execPath, 'test/test-process-memory-hooks.js']);
  // Four existing real PE scenarios: cooperative/Worker × final/outstanding
  // roots; includes dynamic DLL attach/detach, rollback, TLS and stale handles.
  arm('dll-lifecycle', 130, [process.execPath, 'test/test-dll-lifecycle-real-pe.js'], {
    WA_TEST_WASM: wasm, WA_DLL_LIFECYCLE_ARTIFACTS: path.join(out, 'dll-lifecycle'), WA_DLL_LIFECYCLE_CASE: '',
  });
  passed = true;
} finally {
  sources('postflight'); inventory('postflight');
  save('summary', { passed, commit, moduleSha256: fs.existsSync(wasm) ? hashFile(wasm) : null,
    fixtureSha256: fixtureSha, baselineSha256: baselineSha, statuses, originalGameRun: false });
}
