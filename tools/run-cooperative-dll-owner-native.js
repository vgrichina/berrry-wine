'use strict';
// Coordinator-granted sole runtime lane. Admitted IW module plus candidate/control/
// restored four-case native lifecycle proof; no game or browser execution.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const crypto = require('node:crypto'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), commit = process.env.WA_COOP_DLL_COMMIT;
const out = process.env.WA_COOP_DLL_EVIDENCE;
assert.match(commit || '', /^[a-f0-9]{40}$/);
assert(out && path.isAbsolute(out) && !out.startsWith(root + '/'));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const hash = p => sha(fs.readFileSync(p));
const git = (...args) => cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();
assert.equal(git('rev-parse', 'HEAD'), commit);
const preserved = [
  ['/home/user/jedi-knight-checkout/build/wine-assembly.wasm', '937466db3545b9d016fb90dfd8a414eb82653b5ebbf7cc2db7c53d8cc87d49eb'],
  ['/home/user/wa-iw-native-validation/build/wine-assembly.wasm', 'a948a826f71c1935c4d00f7054decdaf4d1e8115314d8779727b7e30069f5b48'],
  ['/home/user/wa-outlaws-kernel32-native-attempt4/build/wine-assembly.wasm', '0dbf18930da633aa71c860ecaca2615a0f6562c9ff0a62aba6f063a12b2bf8ab'],
];
for (const [file] of preserved) assert.notEqual(root, path.dirname(path.dirname(file)));
fs.mkdirSync(out, { recursive: false });
const save = (name, data) => fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify(data, null, 2));
const cli = path.join(root, 'test/run.js'), original = fs.readFileSync(cli);
const needle = 'const e = threadManager.cooperativeCallbackExports(thread);';
assert.equal(original.toString().split(needle).length - 1, 2);
const control = Buffer.from(original.toString().split(needle).join('const e = thread.instance.exports;'));
fs.writeFileSync(path.join(out, 'run.original.js'), original, { flag: 'wx' });
fs.writeFileSync(path.join(out, 'run.control.js'), control, { flag: 'wx' });
save('control', { original: sha(original), control: sha(control), changedFile: 'test/run.js', replacements: 2 });
let changed = false, passed = false, moduleSha256 = null;
const wasm = '/home/user/wa-iw-combined-native/build/wine-assembly.wasm', statuses = [];
const admittedModule = '04ede400070b3acbdcc2ad5f3c033bcf051e3d2da9a4d28a449324d23ab0ba17';
const admittedSource = '7405b3f4803855e6d2e25506c74afab0d2184af9';
// Only host, test, documentation and named evidence controllers differ from the
// admitted full build. Everything else, including all WAT, compiler/vendor,
// font data, build gates and region-map bytes, must be identical.
function attestBuild() {
  const delta = git('diff', '--name-only', admittedSource, commit).split('\n').filter(Boolean);
  const allowed = new Set(['host.js', 'lib/thread-manager.js', 'TODOS.md',
    'tools/capture-legacy-render-evidence.js', 'tools/lords2-system-test-rollback.js',
    'tools/prepare-lords2-crash-diagnostic.js', 'tools/run-iw-combined-native.js',
    'tools/run-cooperative-dll-owner-native.js']);
  assert.deepEqual(delta.filter(file => !allowed.has(file) && !/^(docs|ops|test)\//.test(file)), []);
  assert.equal(hash(wasm), admittedModule);
  assert.equal(fs.statSync(wasm).size, 1803941);
  moduleSha256 = admittedModule;
  save('module', { sha256: moduleSha256, admittedSource, delta, buildRun: false,
    regionMapSha256: hash(path.join(root, 'lib/region-map.generated.js')) });
}
function pins() {
  for (const [file, expected] of preserved) assert.equal(hash(file), expected, 'preserved ' + file);
  if (moduleSha256) assert.equal(hash(wasm), moduleSha256, 'one module across all three arms');
}
function inventory(label) {
  const ps = cp.execFileSync('ps', ['-eo', 'pid,ppid,pgid,comm'], { encoding: 'utf8' });
  fs.writeFileSync(path.join(out, label + '-processes.txt'), ps);
  const active = ps.trim().split('\n').filter(line => {
    const m = line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\S+)$/);
    return m && +m[1] !== process.pid && /^(node|MainThread|chrome|chromium|firefox|wat2wasm)$/.test(m[4]);
  });
  assert.deepEqual(active, [], 'sole runtime lane'); pins();
}
function sources(label) {
  assert.equal(git('rev-parse', 'HEAD'), commit);
  const rows = git('ls-tree', '-r', commit).split('\n').map(l => l.match(/^\d+ blob ([a-f0-9]+)\t(.+)$/))
    .filter(Boolean).filter(m => !m[2].includes('/') || /^(?:src|lib|tools|test|docs|fonts)\//.test(m[2]));
  assert(rows.length > 4000);
  const records = rows.map(([, blob, file]) => {
    assert(fs.lstatSync(path.join(root, file)).isFile(), 'regular tracked file ' + file);
    const bytes = fs.readFileSync(path.join(root, file));
    if (changed && file === 'test/run.js') assert(bytes.equals(control));
    else assert.equal(crypto.createHash('sha1').update(Buffer.from('blob ' + bytes.length + '\0')).update(bytes).digest('hex'), blob, file);
    return { path: file, sha256: sha(bytes) };
  });
  save(label + '-sources', { at: new Date().toISOString(), commit, variant: changed ? 'unwrapped-control' : 'candidate', records }); pins();
}
function run(label, seconds, args, extraEnv = {}) {
  sources(label + '-before'); inventory(label + '-before');
  const fd = fs.openSync(path.join(out, label + '.log'), 'wx'), started = Date.now();
  let result;
  try { result = cp.spawnSync('timeout', ['--kill-after=5s', seconds + 's', ...args], {
    cwd: root, env: { ...process.env, ...extraEnv }, stdio: ['ignore', fd, fd],
  }); } finally { fs.closeSync(fd); }
  const status = { label, status: result.status, signal: result.signal, error: result.error?.message, elapsedMs: Date.now() - started };
  statuses.push(status); save(label + '-status', status);
  inventory(label + '-after'); sources(label + '-after');
  return status;
}
function lifecycle(label, negative = false) {
  const artifacts = path.join(out, label);
  const result = run(label, 130, [process.execPath, 'test/test-dll-lifecycle-real-pe.js'], {
    WA_TEST_WASM: wasm, WA_DLL_LIFECYCLE_ARTIFACTS: artifacts, WA_DLL_LIFECYCLE_CASE: '',
    WINE_REGION_MAP: path.join(root, 'lib/region-map.generated.js'),
  });
  assert.equal(hash(path.join(artifacts, 'fixtures.json')), '5f3a72b0da228d535182c928a1bfbd05137ff6c2abb29c2bb1a9f5d0e2a26fa4');
  const cases = JSON.parse(fs.readFileSync(path.join(artifacts, 'results.json')));
  assert.deepEqual(cases.map(c => c.id), ['no-threads-final', 'no-threads-outstanding', 'threads-final', 'threads-outstanding']);
  assert(cases.every(c => c.status === 0 && c.groupAbsent));
  assert.equal(result.status, negative ? 1 : 0);
  for (const item of cases) {
    const fails = negative && item.id.startsWith('no-threads');
    assert.equal(item.passed, !fails, item.id);
    if (fails) {
      const log = fs.readFileSync(path.join(artifacts, item.id + '.log'), 'utf8');
      assert.match(log, /\[Exit\] code=103\b/);
      assert.match(log, /"tid":2[^\n]*"exitCode":0/);
    }
  }
}
try {
  inventory('preflight'); sources('preflight');
  attestBuild();
  assert.equal(run('owner-regression', 30, [process.execPath, 'test/test-cooperative-dll-owner.js']).status, 0);
  assert.equal(run('wait-reservation', 30, [process.execPath, 'test/test-thread-send-wait-reservation.js']).status, 0);
  assert.equal(run('process-send-broker', 30, [process.execPath, 'test/test-process-send-broker.js']).status, 0);
  lifecycle('candidate');
  changed = true; fs.writeFileSync(cli, control);
  try { lifecycle('unwrapped-control', true); }
  finally { fs.writeFileSync(cli, original); changed = false; }
  lifecycle('restored'); passed = true;
} finally {
  if (changed) { fs.writeFileSync(cli, original); changed = false; }
  sources('postflight'); inventory('postflight');
  save('summary', { passed, commit, moduleSha256, statuses, originalGameRun: false, browserRun: false });
}
