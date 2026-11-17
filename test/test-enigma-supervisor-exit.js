'use strict';
// Offline source tests only; no historical guest/watchdog launch.
//
// The retained supervisor under review (original-supervise.py.gz) is a
// historical Python program. The repository no longer runs Python, so the
// former subprocess oracles (test-enigma-supervisor-denial-*.py and
// test-enigma-supervisor-exit.py, which executed the transformed supervisor's
// polling loop and finalization against fake child/clock interfaces) are
// retired. What remains is checked here in Node: the exact evidence identities,
// the transformation's source-level contract (single terminal exit guard,
// unchanged TERM/KILL/reaping with the shorter grace, receipt validation equal
// to the retained old oracle apart from the allowlisted single-frame branch,
// and the previously rejected candidate lacking the guard), and the actual
// composition review.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const Module = require('node:module');
const { spawnSync } = require('node:child_process');
const repo = path.resolve(__dirname, '..');
const evidence = path.join(repo, 'docs/re-notes/enigma-supervisor-exit-repair-20261024');
const old = path.join(repo, 'docs/re-notes/enigma-runner-repairs-independent-20261024');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const loadFrom = (source, filename) => { const m = new Module(filename); m.filename = filename; m.paths = Module._nodeModulePaths(path.dirname(filename)); m._compile(source, filename); return m.exports; };
const between = (s, from, to) => { const a = s.indexOf(from); assert(a >= 0, from); const b = s.indexOf(to, a); assert(b >= 0, to); return s.slice(a, b); };

const original = zlib.gunzipSync(fs.readFileSync(path.join(evidence, 'original-supervise.py.gz'))).toString();
assert.equal(sha(original), '73be15954cedc19340779ff6bda2397cb94927ca702d2baebdccd5e763cf7b73');
const transformed = require('../tools/enigma-terminal-capture-guard.cjs').transformSupervisor(original);
const originalStop = between(original, 'def stop(p):', 'def limits():');
assert(transformed.includes(originalStop.replace('monotonic()+5', 'monotonic()+1')), 'cleanup must retain TERM/KILL/reaping with a shorter grace');
const exitGuard = 'if capture_terminal is not None:raise SystemExit(1)\n';
assert.equal(transformed.split(exitGuard).length - 1, 1);
const reverted = transformed.replace(exitGuard, '');
// The meaningful mutant is the exact previously rejected transformation.
const oldAdapter = zlib.gunzipSync(fs.readFileSync(path.join(old, 'candidate-terminal.cjs.gz'))).toString();
const oldTransformed = loadFrom(oldAdapter, path.join(old, 'candidate-terminal.cjs')).transformSupervisor(original);
const newValidation = ` assert record.get('code')=='ERR_ASSERTION'
 assert record.get('profile') in (None,'default','single-frame')
 if record.get('profile')=='single-frame':
  assert record.get('message') in ('capture byte limit','capture frame limit','capture cumulative byte limit')
 else:
  assert record.get('message')=='capture byte limit'`;
const oldValidation = " assert record.get('code')=='ERR_ASSERTION' and record.get('message')=='capture byte limit'";
assert.equal(reverted.split(newValidation).length - 1, 1);
const receiptHelper = s => s.slice(s.indexOf('def terminal_capture():'),
  s.includes('# Retained-output transport') ? s.indexOf('# Retained-output transport') : s.indexOf('H=pathlib.Path')).trimEnd();
assert.equal(receiptHelper(reverted).replace(newValidation, oldValidation), receiptHelper(oldTransformed));
assert(!reverted.includes(exitGuard) && transformed.includes(exitGuard));
// Former denial oracle: the rejected candidate finalizes without a terminal exit.
assert(!oldTransformed.includes(exitGuard), 'previously rejected candidate must lack the terminal exit guard');
assert(transformed.indexOf(exitGuard) > transformed.indexOf("why='natural'"), 'exit guard follows the polling loop');

assert.deepEqual(zlib.gunzipSync(fs.readFileSync(path.join(evidence, 'candidate-terminal.cjs.gz'))),
  fs.readFileSync(path.join(repo, 'tools/enigma-terminal-capture-guard.cjs')));
assert.deepEqual(fs.readFileSync(path.join(__dirname, 'enigma-supervisor-exit-composition.cjs')),
  zlib.gunzipSync(fs.readFileSync(path.join(old, 'composition-review.js.gz'))));
const memAvailable = () => fs.existsSync('/proc/meminfo')
  ? Number(/^MemAvailable:\s+(\d+)/m.exec(fs.readFileSync('/proc/meminfo', 'utf8'))[1]) * 1024 : os.freemem();
const results = [];
for (const args of [[process.execPath, '--max-old-space-size=256', 'test/enigma-supervisor-exit-composition.cjs']]) {
  const available = memAvailable();
  assert(available >= 805306368, 'fresh memory admission');
  const p = spawnSync(args[0], args.slice(1), { cwd: repo, encoding: 'utf8', timeout: 60000,
    maxBuffer: 1048576, env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=256' } });
  assert.ifError(p.error);
  assert.equal(p.status, 0, p.stderr);
  results.push({ command: args, status: p.status, memAvailable: available, outputBytes: Buffer.byteLength(p.stdout) });
}
assert.equal(require('../tools/test-tiers').classifyTest('test-enigma-supervisor-exit.js'), 'unit');
console.log(JSON.stringify({ pass: true, sourceContract: true, pythonOraclesRetired: true, fixtureIdentityOnly: true, results }));
