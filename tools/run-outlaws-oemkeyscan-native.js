'use strict';
// Remote-only, invoked after coordinator grants the sole runtime lane.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const crypto = require('node:crypto'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const evidence = process.env.WA_OEM_EVIDENCE;
const expectedCommit = process.env.WA_OEM_COMMIT;
const fixtureHash = process.env.WA_OEM_FIXTURE_SHA256;
assert(evidence && path.isAbsolute(evidence));
assert.match(expectedCommit || '', /^[a-f0-9]{40}$/);
assert.match(fixtureHash || '', /^[a-f0-9]{64}$/);
const donor = '/home/user/jedi-knight-checkout';
const held = '/home/user/wa-iw-native-validation';
assert(![donor, held].includes(root));
fs.mkdirSync(evidence, { recursive: false });
const git = (...args) => cp.execFileSync('git', args, { cwd: root, maxBuffer: 32 * 1024 * 1024 });
assert.equal(git('rev-parse', 'HEAD').toString().trim(), expectedCommit);
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const hashFile = p => sha(fs.readFileSync(p));
const save = (name, value) => fs.writeFileSync(path.join(evidence, name + '.json'), JSON.stringify(value, null, 2));
const baseline = donor + '/build/wine-assembly.wasm';
const fixtureSource = donor + '/test/binaries/calc.exe';
const fixture = path.join(evidence, 'calc.exe');
const wasm = root + '/build/wine-assembly.wasm';
function preserved() {
  assert.equal(hashFile(baseline), '937466db3545b9d016fb90dfd8a414eb82653b5ebbf7cc2db7c53d8cc87d49eb');
  assert.equal(hashFile(held + '/build/wine-assembly.wasm'), 'a948a826f71c1935c4d00f7054decdaf4d1e8115314d8779727b7e30069f5b48');
  assert.equal(hashFile(fixtureSource), fixtureHash);
  if (fs.existsSync(fixture)) assert.equal(hashFile(fixture), fixtureHash);
}
function sources(label) {
  const records = git('ls-tree', '-r', expectedCommit).toString().trim().split('\n').map(line => {
    const m = line.match(/^\d+ blob ([a-f0-9]+)\t(.+)$/);
    assert(m, line);
    const bytes = fs.readFileSync(path.join(root, m[2]));
    const blob = crypto.createHash('sha1').update(Buffer.from('blob ' + bytes.length + '\0')).update(bytes).digest('hex');
    assert.equal(blob, m[1], 'physical committed source ' + m[2]);
    return { path: m[2], sha256: sha(bytes) };
  });
  preserved();
  save(label + '-sources', { at: new Date().toISOString(), commit: expectedCommit, node: process.version, records,
    moduleSha256: fs.existsSync(wasm) ? hashFile(wasm) : null, fixtureHash });
}
function inventory(label) {
  const all = cp.execFileSync('ps', ['-eo', 'pid,ppid,pgid,comm,args'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  fs.writeFileSync(path.join(evidence, label + '-processes.txt'), all);
  const active = all.split('\n').filter(line => {
    const m = line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/);
    return m && +m[1] !== process.pid && /^(node|MainThread|chrome|chromium|firefox|wat2wasm)$/.test(m[4]);
  });
  assert.deepEqual(active, [], 'sole runtime lane must be idle');
}
function arm(label, seconds, command) {
  const fd = fs.openSync(path.join(evidence, label + '.log'), 'wx');
  const start = Date.now();
  let result;
  try { result = cp.spawnSync('timeout', ['--kill-after=5s', seconds + 's', ...command], {
    cwd: root, stdio: ['ignore', fd, fd], env: process.env,
  }); } finally { fs.closeSync(fd); }
  save(label + '-status', { status: result.status, signal: result.signal, error: result.error?.message, elapsedMs: Date.now() - start });
  inventory(label + '-after');
  preserved();
  assert.equal(result.status, 0, label + ': stop on any unexpected failure');
}
try {
  inventory('preflight'); sources('before');
  fs.copyFileSync(fixtureSource, fixture, fs.constants.COPYFILE_EXCL);
  preserved();
  arm('normal-build', 600, ['bash', 'tools/build.sh']);
  sources('built');
  arm('focused', 90, [process.execPath, 'test/test-oem-key-scan.js']);
  const args = ['test/test-oem-key-scan-candidate.js', '--fixture=' + fixture, '--fixture-sha256=' + fixtureHash];
  arm('candidate', 90, [process.execPath, ...args, '--wasm=' + wasm]);
  arm('baseline-missing', 90, [process.execPath, ...args, '--wasm=' + baseline, '--expect-missing']);
  arm('candidate-restored', 90, [process.execPath, ...args, '--wasm=' + wasm]);
} finally {
  sources('postflight'); inventory('postflight');
}
