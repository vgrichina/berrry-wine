#!/usr/bin/env node
'use strict';

// No benchmark subprocesses: execute the actual CLI, runOne parser,
// aggregation and JSON writer with a controlled child-process transport.
// Optional source path supports running this same regression against a baseline.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { EventEmitter } = require('events');
const sourcePath = process.argv[2] || path.join(__dirname, 'arm-bench.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const good = (cpuSecs, frame = 'same', dispatched = 1000) => ({
  ok: true, cpuSecs, secs: cpuSecs + 1, guestSecs: cpuSecs / 2,
  frame, dispatched, buildSecs: 0, jit: { installs: 2 }, extra: { retained: [1, 2] },
});

async function run(args, outcomes) {
  const calls = [], writes = [], logs = [];
  const context = {
    __filename: sourcePath,
    process: { argv: ['node', sourcePath, ...args, '--out=result.json'],
      execPath: process.execPath, env: {}, exit: (code) => { throw Error(`exit ${code}`); } },
    console: { log: (s) => logs.push(s), error: (s) => { throw Error(s); } },
    setTimeout: () => 1, clearTimeout: () => {},
    require: (name) => {
      if (name === 'fs') return { writeFileSync: (file, json) => {
        assert.equal(file, 'result.json');
        writes.push(JSON.parse(json));
      } };
      if (name === 'os') return { loadavg: () => [0, 0, 0] };
      if (name === 'path') return path;
      assert.equal(name, 'child_process', 'runtime modules must never load');
      return { spawn: (exe, argv) => {
        assert.equal(exe, process.execPath);
        const spec = JSON.parse(argv[1].slice('--child='.length));
        const result = outcomes[calls.length];
        assert.ok(result, 'unexpected runOne call');
        calls.push(spec);
        const child = new EventEmitter();
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        queueMicrotask(() => {
          if (result.ok) child.stdout.emit('data', `ARMBENCH ${JSON.stringify(result)}\n`);
          else child.stderr.emit('data', result.reason);
          child.emit('close', result.ok ? 0 : 7, null);
        });
        return child;
      } };
    },
  };
  await vm.runInNewContext(source, context, { filename: sourcePath });
  assert.equal(calls.length, outcomes.length);
  return { calls, writes, logs, output: writes.at(-1) };
}

async function test() {
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
  assert.equal(result.writes.length, 2, 'existing per-program checkpoint writes');
  assert.deepEqual(result.writes[0].rows, [output.rows[0]]);
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
  console.log('PASS arm-bench: raw repeats, rotation, duplicate labels, failures, mismatches, ties, selected summaries, calibration and JSON checkpoints (28 controlled calls; no runtime)');
}

test().catch((error) => { console.error(error); process.exitCode = 1; });
