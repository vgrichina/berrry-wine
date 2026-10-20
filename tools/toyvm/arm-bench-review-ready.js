#!/usr/bin/env node
'use strict';
// Review only. No benchmark children or runtime modules can execute.
// Usage: node tools/toyvm/arm-bench-review-ready.js ABSOLUTE_EVIDENCE_DIRECTORY
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const vm = require('vm');
const assert = require('assert/strict');
const { EventEmitter } = require('events');
const crypto = require('crypto');
const target = '9e7d67aae1dcb0a67ba295110f9306b1d54600fe';
const baseline = 'f5b447ebbc2b047451926053a33b367d578b4a36';
const ev = path.resolve(process.argv[2]);
fs.mkdirSync(ev, { recursive: true });
const git = (...args) => cp.execFileSync('git', args, { encoding: 'utf8' });
const source = git('show', `${target}:tools/toyvm/arm-bench.js`);
const old = git('show', `${baseline}:tools/toyvm/arm-bench.js`);
const regression = git('show', `${target}:tools/toyvm/arm-bench.test.js`);
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const record = { target, baseline, node: process.version,
  sourceSHA256: sha(source), baselineSHA256: sha(old), regressionSHA256: sha(regression),
  regressions: {}, independent: [] };
function runRegression(name, text, expectedPass) {
  const file = path.join(ev, `${name}.js`);
  fs.writeFileSync(file, text);
  const r = cp.spawnSync(process.execPath, [path.join(ev, 'regression.js'), file],
    { encoding: 'utf8', timeout: 10000 });
  fs.writeFileSync(path.join(ev, `${name}.log`), r.stdout + r.stderr);
  record.regressions[name] = { status: r.status, signal: r.signal };
  if (expectedPass) assert.equal(r.status, 0, r.stderr);
  else {
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /raw-repeat retention: every repeat must survive selection/);
  }
}
const good = (cpu, tag, dispatched = 1000) => ({
  cpuSecs: cpu, secs: cpu + 1, guestSecs: cpu / 2, buildSecs: 0,
  frame: tag, dispatched, extra: { tag, nested: [null, false, 0, 'raw'] },
});
// Real production JSON.stringify and disk writes. Only child transport,
// load and timers are controlled; the entire source executes unmodified.
async function run(name, text, args, outcomes) {
  const file = path.join(ev, `${name}.json`);
  const calls = [], checkpoints = [], logs = [];
  let error = null;
  const context = {
    __filename: '/controlled/arm-bench.js',
    process: { argv: ['node', '/controlled/arm-bench.js', ...args, `--out=${file}`],
      execPath: process.execPath, env: {}, exit: (code) => { throw Error(`exit ${code}`); } },
    console: { log: (s) => logs.push(s), error: (s) => { error = String(s); } },
    setTimeout: () => 1, clearTimeout: () => {},
    require: (n) => {
      if (n === 'path') return path;
      if (n === 'os') return { loadavg: () => [0, 0, 0] };
      if (n === 'fs') return { writeFileSync: (p, bytes) => {
        assert.equal(p, file);
        assert.equal(typeof bytes, 'string');
        fs.writeFileSync(p, bytes);
        checkpoints.push(JSON.parse(fs.readFileSync(p, 'utf8')));
        fs.writeFileSync(path.join(ev, `${name}.checkpoint-${checkpoints.length}.json`), bytes);
      } };
      assert.equal(n, 'child_process', 'runtime module forbidden');
      return { spawn: (exe, argv) => {
        assert.equal(exe, process.execPath);
        const spec = JSON.parse(argv[1].slice('--child='.length));
        const next = outcomes[calls.length];
        assert.ok(next, 'unexpected child');
        calls.push(spec);
        if (next.abort) throw Error('controlled interruption');
        const child = new EventEmitter();
        child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
        queueMicrotask(() => {
          if (next.failure) child.stderr.emit('data', next.failure);
          else child.stdout.emit('data', `noise\nARMBENCH ${JSON.stringify(next)}\n`);
          child.emit('close', next.failure ? 7 : 0, next.timeout ? 'SIGKILL' : null);
        });
        return child;
      } };
    },
  };
  try { await vm.runInNewContext(text, context); }
  catch (e) { assert.ok(error?.includes('controlled interruption'), e.stack); }
  assert.equal(calls.length, outcomes.length);
  const result = { calls, checkpoints, logs, error };
  fs.writeFileSync(path.join(ev, `${name}.trace.json`), JSON.stringify(result, null, 2));
  return result;
}
function legacy(output) {
  const copy = JSON.parse(JSON.stringify(output));
  delete copy.selectedSummary;
  for (const row of copy.rows) { delete row.repeats; delete row.calibration; }
  return copy;
}
async function compare(name, args, outcomes) {
  const current = await run(name, source, args, outcomes);
  const prior = await run(`${name}-baseline`, old, args, outcomes);
  assert.deepEqual(current.checkpoints.map(legacy), prior.checkpoints);
  assert.deepEqual(current.logs.filter(s => !s.startsWith('Selected/best summaries:')), prior.logs);
  record.independent.push({ name, callsPerVersion: outcomes.length,
    completedPrograms: current.checkpoints.length, legacyJSONAndCLIIdentical: true });
  return current;
}
async function main() {
  fs.writeFileSync(path.join(ev, 'regression.js'), regression);
  runRegression('candidate', source, true);
  runRegression('baseline', old, false);
  // Drop repeats only at the production serialization boundary, preserving
  // in-memory accumulation. The original regression must reject this mutation.
  const needle = 'JSON.stringify({ budget, arms: labels, rows, selectedSummary }, null, 1)';
  assert.equal(source.split(needle).length, 2);
  runRegression('serialization-omission', source.replace(needle,
    "JSON.stringify({ budget, arms: labels, rows, selectedSummary }, (key, value) => key === 'repeats' ? undefined : value, 1)"), false);
  const tied = [good(5, 'first'), good(8, 'first'), good(8, 'later'), good(5, 'later')];
  const ties = await compare('ties', ['--exe=T.EXE', '--arms=l1,uop', '--reps=2'], tied);
  const row = ties.checkpoints[0].rows[0];
  assert.equal(row.arms.l1.frame, 'first');
  assert.equal(row.arms.uop.frame, 'first');
  assert.deepEqual(row.bad, []);
  row.repeats.forEach((r, i) => assert.deepEqual(r, {
    executionOrder: i, arm: ['l1', 'uop', 'uop', 'l1'][i],
    label: ['l1', 'uop', 'uop', 'l1'][i], repeatIndex: Math.floor(i / 2),
    result: { ok: true, ...tied[i] },
  }));
  const failures = await compare('failures', ['--exe=F.EXE', '--arms=l1,uop', '--reps=3'],
    [good(5, 'same'), { failure: 'first' }, good(2, 'same'), good(4, 'same'),
      good(3, 'same'), { failure: 'timeout', timeout: true }]);
  const fr = failures.checkpoints[0].rows[0];
  assert.deepEqual(fr.arms.uop, { ok: false, reason: 'exit 7: first' });
  assert.deepEqual(fr.repeats[5], { executionOrder: 5, arm: 'uop', label: 'uop',
    repeatIndex: 2, result: { ok: false, reason: 'timeout' } });
  assert.equal(fr.repeats[2].result.cpuSecs, 2);
  const cal = await compare('calibration', ['--exe=C.EXE,D.EXE', '--arms=l1',
    '--dispatches=1k', '--l1-seconds=4'],
  [good(2, 'cal', 1000), good(4, 'same', 2000), { failure: 'cal-failed' }, good(3, 'same')]);
  assert.equal(cal.checkpoints[0].rows[0].calibration.executionOrder, 0);
  assert.equal(cal.checkpoints[0].rows[0].repeats[0].executionOrder, 1);
  const cr = cal.checkpoints[1].rows[1];
  assert.deepEqual(cr.calibration, { executionOrder: 2, arm: 'l1', budget: 1000,
    result: { ok: false, reason: 'exit 7: cal-failed' } });
  assert.equal(cr.repeats[0].executionOrder, 3);
  assert.deepEqual(cal.calls.map(c => c.budget), [1000, 2000, 1000, 1000]);
  // Current-program interrupted runs do not survive: existing per-program
  // checkpoint contract, not a claim of durable per-child journaling.
  const interrupted = await compare('interrupted', ['--exe=I.EXE,J.EXE', '--arms=l1', '--reps=2'],
    [good(1, 'same'), good(2, 'same'), good(3, 'same'), { abort: true }]);
  assert.equal(interrupted.checkpoints.length, 1);
  assert.equal(interrupted.checkpoints[0].rows.length, 1);
  assert.equal(interrupted.checkpoints[0].rows[0].repeats.length, 2);
  assert.match(interrupted.error, /controlled interruption/);
  record.verdict = 'ACCEPT';
  fs.writeFileSync(path.join(ev, 'review-tests.json'), JSON.stringify(record, null, 2));
  console.log(JSON.stringify(record, null, 2));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
