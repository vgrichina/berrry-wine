#!/usr/bin/env node
'use strict';

// No benchmark subprocesses: execute the actual CLI, runOne parser,
// aggregation and JSON writer with a controlled child-process transport.
// Optional source path supports running this same regression against a baseline.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const os = require('os');
const { spawnSync } = require('child_process');
const { EventEmitter } = require('events');
const sourcePath = process.argv[2] || path.join(__dirname, 'arm-bench.js');
const source = fs.readFileSync(sourcePath, 'utf8');
let traceSerial = 0;
function evidence(name, value) {
  if (process.env.ARM_BENCH_EVIDENCE) fs.writeFileSync(
    path.join(process.env.ARM_BENCH_EVIDENCE, name), JSON.stringify(value, null, 2));
}
const good = (cpuSecs, frame = 'same', dispatched = 1000) => ({
  ok: true, cpuSecs, secs: cpuSecs + 1, guestSecs: cpuSecs / 2,
  frame, dispatched, buildSecs: 0, jit: { installs: 2 }, extra: { retained: [1, 2] },
});

async function run(args, outcomes, options = {}) {
  const calls = [], writes = [], logs = [];
  const dir = options.dir || fs.mkdtempSync(path.join(os.tmpdir(), 'arm-checkpoint-'));
  const file = path.join(dir, 'result.json');
  const snapshot = () => writes.push(JSON.parse(fs.readFileSync(file, 'utf8')));
  let error;
  const context = {
    __filename: sourcePath,
    process: { argv: ['node', sourcePath, ...args, `--out=${file}`], pid: process.pid,
      execPath: process.execPath, env: {}, exit: (code) => { throw Error(`exit ${code}`); } },
    console: { log: (s) => logs.push(s), error: (s) => { error = String(s); } },
    setTimeout: () => 1, clearTimeout: () => {},
    require: (name) => {
      if (name === 'fs') return { ...fs,
        writeFileSync: (target, json) => {
          if (options.killWrite && writes.length === options.killWrite) {
            fs.writeFileSync(target, json.slice(0, 17));
            process.kill(process.pid, 'SIGKILL');
          }
          fs.writeFileSync(target, json);
          if (target === file) snapshot(); // Also exercise the prior writer.
        },
        renameSync: (from, to) => {
          assert.equal(to, file);
          fs.renameSync(from, to);
          snapshot();
        },
      };
      if (name === 'os') return { loadavg: () => [0, 0, 0] };
      if (name === 'path') return path;
      assert.equal(name, 'child_process', 'runtime modules must never load');
      return { spawn: (exe, argv) => {
        assert.equal(exe, process.execPath);
        const spec = JSON.parse(argv[1].slice('--child='.length));
        const killInFlight = options.killAfter === calls.length;
        if (options.abortAfter === calls.length) throw Error('controlled interruption');
        const result = outcomes[calls.length];
        assert.ok(result, 'unexpected runOne call');
        calls.push(spec);
        const child = new EventEmitter();
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        queueMicrotask(() => {
          if (killInFlight) process.kill(process.pid, 'SIGKILL');
          if (result.ok) child.stdout.emit('data', `ARMBENCH ${JSON.stringify(result)}\n`);
          else child.stderr.emit('data', result.reason);
          child.emit('close', result.ok ? 0 : 7, null);
        });
        return child;
      } };
    },
  };
  try {
    await vm.runInNewContext(options.source || source, context, { filename: sourcePath });
  } catch (e) {
    assert.match(error || '', /controlled interruption/);
  }
  if (options.abortAfter === undefined) assert.equal(calls.length, outcomes.length);
  else assert.equal(calls.length, options.abortAfter);
  const result = { calls, writes, logs, error, output: writes.at(-1) };
  evidence(`trace-${traceSerial++}.json`, result);
  if (!options.dir) fs.rmSync(dir, { recursive: true, force: true });
  return result;
}

const interruptArgs = ['--exe=A.EXE,B.EXE', '--arms=l1,l1,uop', '--reps=2',
  '--dispatches=1k', '--l1-seconds=4'];
const interruptOutcomes = Array.from({ length: 14 }, (_, i) => good(i + 2));
function assertPartial(output, completed) {
  assert.ok(output, 'per-attempt checkpoint must exist before program completion');
  assert.equal(output.complete, false, 'unfinished suite must be explicit');
  const attempts = output.rows.flatMap(r => [r.calibration, ...r.repeats].filter(Boolean));
  assert.equal(attempts.length, completed, 'exact completed attempts; no in-flight result');
  assert.deepEqual(attempts.map(a => a.executionOrder), Array.from({ length: completed }, (_, i) => i));
  attempts.forEach((a, i) => assert.deepEqual(a.result, interruptOutcomes[i]));
  const row = output.rows.at(-1);
  assert.equal(row.complete, false);
  assert.deepEqual(row.arms, {}, 'incomplete rows have no selected summary');
  assert.equal(row.bad, undefined);
  assert.equal(row.failed, undefined);
  if (completed > 7) {
    assert.equal(output.rows[0].complete, true);
    assert.equal(output.rows[0].repeats.length, 6);
  }
}

async function test() {
  // Stop after actual production runOne parsings, before the next child returns.
  // Include calibration-only and a completed prior program.
  for (const n of [1, 4, 10]) {
    const stopped = await run(interruptArgs, interruptOutcomes, { abortAfter: n });
    assert.match(stopped.error, /controlled interruption/);
    assertPartial(stopped.output, n);
    assert.ok(!stopped.logs.some(s => s.includes('cpu vs l1:')), 'no incomplete aggregate');
  }
  // OS termination of the harness while the next attempt is in flight, and
  // during a partial temp-file write. No benchmark process/runtime is launched.
  for (const mode of ['inflight', 'write']) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arm-kill-'));
    try {
      const killed = spawnSync(process.execPath, [__filename, sourcePath, '--kill-case', mode, dir],
        { encoding: 'utf8', timeout: 10000 });
      assert.equal(killed.signal, 'SIGKILL', killed.stderr);
      const saved = JSON.parse(fs.readFileSync(path.join(dir, 'result.json'), 'utf8'));
      assertPartial(saved, 4);
      evidence(`killed-${mode}.json`, { signal: killed.signal, saved });
      if (mode === 'write') {
        const temp = fs.readdirSync(dir).find(n => n.includes('.tmp-'));
        assert.ok(temp, 'interrupted write leaves only an unreferenced temp');
        assert.throws(() => JSON.parse(fs.readFileSync(path.join(dir, temp), 'utf8')));
      }
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  // Duplicate L1 labels, rotation by both program and repetition, CPU ties,
  // and mismatches hidden by the historical minimum selection.
  const outcomes = [
    good(8), good(9, 'discarded-frame', 777), good(10),
    good(4), good(5), good(6),
    good(5, 'tied-frame', 888), good(3), good(4),
    good(9), good(10), good(8),
    good(5), good(6), good(4),
    good(3), good(4), good(5),
  ];
  const result = await run(['--exe=A.EXE,B.EXE', '--arms=l1,l1,uop', '--reps=3',
    '--dispatches=1k'], outcomes);
  const { output, calls } = result;
  assert.equal(output.rows[0].repeats?.length, 9, 'raw-repeat retention: every repeat must survive selection');
  assert.equal(output.rows[1].repeats.length, 9);
  const labels = ['l1', 'l1#2', 'uop'];
  const orders = [[0, 1, 2, 1, 2, 0, 2, 0, 1], [1, 2, 0, 2, 0, 1, 0, 1, 2]];
  for (let pi = 0; pi < 2; pi++) {
    const row = output.rows[pi];
    row.repeats.forEach((sample, i) => {
      const order = pi * 9 + i, k = orders[pi][i];
      assert.deepEqual(sample, { executionOrder: order, arm: k === 2 ? 'uop' : 'l1',
        label: labels[k], repeatIndex: Math.floor(i / 3), result: outcomes[order] });
      assert.equal(calls[order].arm, sample.arm);
      assert.equal(calls[order].exe, row.exe);
      assert.equal(calls[order].budget, 1000);
    });
    // Stable legacy fields, including selected-only mismatch classification.
    assert.deepEqual(row.arms, { l1: good(3), 'l1#2': good(4), uop: good(5) });
    assert.deepEqual(row.bad, []);
    assert.deepEqual(row.failed, []);
    assert.equal(row.budget, 1000);
    assert.equal(row.name, pi ? 'B.EXE' : 'A.EXE');
  }
  assert.equal(output.budget, 1000);
  assert.deepEqual(output.arms, labels);
  assert.equal(result.writes.length, 20, 'each attempt plus each completed program');
  assert.deepEqual(result.writes[9].rows, [output.rows[0]]);
  assert.equal(output.complete, true);
  assert.ok(output.rows.every(r => r.complete));
  assert.equal(output.selectedSummary.selection, 'minimum-cpuSecs');
  assert.equal(output.selectedSummary.failurePolicy, 'first-failure-wins');
  assert.match(output.selectedSummary.distribution, /not-paired-repeats/);
  assert.ok(result.logs.some((s) => s.includes('Selected/best summaries')));
  assert.ok(result.logs.some((s) => s.includes('l1#2       cpu vs l1: geomean x1.333')));

  // A failure is retained even if later successes are faster; subsequent
  // failures and successes remain available in their original order.
  const failed = await run(['--exe=F.EXE', '--arms=l1,uop', '--reps=3'], [
    good(8), { ok: false, reason: 'first failure' },
    good(2), good(6),
    good(4), { ok: false, reason: 'second failure' },
  ]);
  const fr = failed.output.rows[0];
  assert.equal(fr.repeats.length, 6);
  assert.deepEqual(fr.arms.uop, { ok: false, reason: 'exit 7: first failure' });
  assert.deepEqual(fr.repeats[1].result, fr.arms.uop);
  assert.deepEqual(fr.repeats[2].result, good(2));
  assert.deepEqual(fr.repeats[5].result, { ok: false, reason: 'exit 7: second failure' });
  assert.deepEqual(fr.failed, ['uop']);
  assert.deepEqual(fr.bad, []);
  assert.ok(failed.logs.some((s) => s === '\n0 of 1 program(s) clean in every arm'));

  // Calibration is separately identified and participates in global execution
  // order, without being mistaken for a repeat or changing selected summaries.
  const calibrated = await run(['--exe=C.EXE,D.EXE', '--arms=l1', '--reps=1',
    '--dispatches=1k', '--l1-seconds=4'], [
    good(2), good(4, 'same', 2000), { ok: false, reason: 'calibration failed' }, good(3),
  ]);
  const [c, d] = calibrated.output.rows;
  assert.deepEqual(c.calibration, { executionOrder: 0, arm: 'l1', budget: 1000, result: good(2) });
  assert.equal(c.repeats[0].executionOrder, 1);
  assert.equal(c.budget, 2000);
  assert.equal(calibrated.calls[1].budget, 2000);
  assert.deepEqual(d.calibration, { executionOrder: 2, arm: 'l1', budget: 1000,
    result: { ok: false, reason: 'exit 7: calibration failed' } });
  assert.equal(d.repeats[0].executionOrder, 3);
  assert.equal(d.budget, 1000);
  assert.deepEqual(d.failed, [], 'calibration failure does not change legacy summary policy');
  // All successful and failed results are checkpointed, before final selection.
  assert.equal(failed.writes.length, 7);
  assert.equal(failed.output.complete, true, 'completion is not success');
  assert.equal(calibrated.writes.length, 6);
  assert.equal(calibrated.writes[0].rows[0].budget, 2000);
  assert.equal(calibrated.writes[3].rows[1].calibration.result.ok, false);
  if (process.env.ARM_BENCH_PRIOR) {
    const prior = fs.readFileSync(process.env.ARM_BENCH_PRIOR, 'utf8');
    // Differential check against the accepted implementation: remove only
    // completion metadata; every original final field and CLI line must match.
    const project = output => JSON.parse(JSON.stringify(output, (k, v) => k === 'complete' ? undefined : v));
    const scenarios = [
      { args: ['--exe=A.EXE,B.EXE', '--arms=l1,l1,uop', '--reps=3', '--dispatches=1k'], outcomes, current: result },
      { args: ['--exe=F.EXE', '--arms=l1,uop', '--reps=3'],
        outcomes: [good(8), { ok: false, reason: 'first failure' }, good(2), good(6),
          good(4), { ok: false, reason: 'second failure' }], current: failed },
      { args: ['--exe=C.EXE,D.EXE', '--arms=l1', '--reps=1', '--dispatches=1k', '--l1-seconds=4'],
        outcomes: [good(2), good(4, 'same', 2000), { ok: false, reason: 'calibration failed' }, good(3)],
        current: calibrated },
    ];
    for (const s of scenarios) {
      const old = await run(s.args, s.outcomes, { source: prior });
      assert.deepEqual(project(s.current.output), old.output);
      assert.deepEqual(s.current.logs, old.logs);
    }
    console.log('PASS accepted-candidate differential: final JSON and CLI identical except completion metadata (28 calls/version)');
  }
  console.log('PASS arm-bench: raw repeats, rotation, duplicate labels, failures, mismatches, ties, selected summaries, calibration and JSON checkpoints (28 controlled calls; no runtime)');
  console.log('PASS per-attempt checkpoints: calibration-only, 4/10 resolved attempts, incomplete summary exclusion, real SIGKILL in-flight and during temp write');
}

const action = process.argv[3] === '--kill-case'
  ? () => run(interruptArgs, interruptOutcomes, {
    dir: process.argv[5], ...(process.argv[4] === 'write' ? { killWrite: 4 } : { killAfter: 4 }),
  }) : test;
action().catch((error) => { console.error(error); process.exitCode = 1; });
