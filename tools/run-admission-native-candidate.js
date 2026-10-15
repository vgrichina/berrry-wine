'use strict';
// Execute only after root grants the sole runtime lane. All writes stay inside
// the dedicated candidate checkout and evidence directory; donor is read-only.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const donor = '/home/user/wa-iw-native-validation';
const wasm = path.join(donor, 'build/wine-assembly.wasm');
const evidence = process.env.WA_ADMISSION_EVIDENCE;
assert(evidence && path.isAbsolute(evidence));
fs.mkdirSync(evidence, { recursive: false });
const git = (...args) => cp.execFileSync('git', args, { cwd: root, maxBuffer: 16 * 1024 * 1024 });
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const runtime = git('ls-files', 'host.js', 'src', 'lib').toString().trim().split('\n');
const old = 'cd5ba2e132249cd050f84cd00a55bbcdefe8bd37';
const candidate = '9226756b3762edd5b175226f642f5d8e4de3af37';
const changed = ['lib/process-send-broker.js'];
const originals = changed.map(file => fs.readFileSync(path.join(root, file)));
const fixtures = ['test/test-admission-native-candidate.js',
  'test/test-scoped-dll-endpoints-candidate.js', 'test/test-dll-lifecycle-real-pe.js',
  'tools/run-admission-native-candidate.js'];
function snapshot(label, control = false) {
  const records = [];
  for (const file of fixtures) {
    const actual = sha(fs.readFileSync(path.join(root,file)));
    assert.equal(actual,sha(git('show',`HEAD:${file}`)),`fixture physical bytes ${file}`);
    records.push({file,candidate:actual});
  }
  for (const file of runtime) {
    const actual = fs.readFileSync(path.join(root, file));
    const expected = git('show', `${control && changed.includes(file) ? old : candidate}:${file}`);
    assert.equal(sha(actual), sha(expected), `candidate physical bytes ${file}`);
    const retained = fs.existsSync(path.join(donor,file)) ? fs.readFileSync(path.join(donor, file)) : Buffer.alloc(0);
    // Native endpoint baseline differs from candidate only in the held fix.
    const donorExists = cp.spawnSync('git', ['cat-file','-e',`a2fb032a191ec84882dd5d1ed6cfc4e878438903:${file}`], {cwd:root}).status === 0;
    if (donorExists) assert.equal(sha(retained), sha(git('show', `a2fb032a191ec84882dd5d1ed6cfc4e878438903:${file}`)), `donor bytes ${file}`);
    records.push({ file, candidate: sha(actual), donor: sha(retained) });
  }
  const moduleHash = sha(fs.readFileSync(wasm));
  assert.equal(moduleHash, 'a948a826f71c1935c4d00f7054decdaf4d1e8115314d8779727b7e30069f5b48');
  fs.writeFileSync(path.join(evidence, label + '-sources.json'), JSON.stringify({
    time: new Date().toISOString(), node: process.version, commit: git('rev-parse', 'HEAD').toString().trim(), moduleHash, records,
  }, null, 2));
}
function inventory(label) {
  const all = cp.execFileSync('ps', ['-eo', 'pid,ppid,pgid,stat,comm']).toString();
  fs.writeFileSync(path.join(evidence, label + '-processes.txt'), all);
  const active = all.split('\n').filter(line => {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\S+)$/);
    return match && +match[1] !== process.pid && !match[4].startsWith('Z') && /^(node|MainThread|chrome|chromium|firefox|wat2wasm)$/.test(match[5]);
  });
  assert.deepEqual(active, [], 'independent runtime inventory must be empty');
}
function arm(label, expected, control) {
  snapshot(label + '-before', control);
  const log = fs.openSync(path.join(evidence, label + '.log'), 'wx');
  const start = Date.now();
  let result;
  try {
    result = cp.spawnSync('timeout', ['--kill-after=5s', '90s', process.execPath,
      'test/test-admission-native-candidate.js'], { cwd: root, stdio: ['ignore', log, log],
      env: { ...process.env, WA_TEST_WASM: wasm } });
  } finally { fs.closeSync(log); }
  fs.writeFileSync(path.join(evidence, label + '-status.json'), JSON.stringify({
    status: result.status, signal: result.signal, elapsedMs: Date.now() - start, error: result.error?.message,
  }, null, 2));
  inventory(label + '-after'); snapshot(label + '-after', control);
  assert.equal(result.status, expected, label);
  if (control) assert.match(fs.readFileSync(path.join(evidence, label + '.log'), 'utf8'),
    /AssertionError[^]*Missing expected rejection/, 'negative control must fail retired sender exclusion');
}
try {
  inventory('preflight');
  arm('positive', 0, false);
  for (const file of changed) fs.writeFileSync(path.join(root, file), git('show', `${old}:${file}`));
  arm('old-sender-control', 1, true);
  changed.forEach((file, i) => fs.writeFileSync(path.join(root, file), originals[i]));
  arm('restored', 0, false);
} finally {
  changed.forEach((file, i) => fs.writeFileSync(path.join(root, file), originals[i]));
  snapshot('final-restored'); inventory('final');
}
