#!/usr/bin/env node
'use strict';

// Run tools/build.sh's declared steps concurrently, bounded by CPU count.
//
//   node tools/build-run-steps.js build/build-steps.list
//
// build.sh does not run its gates itself any more; each `step` line there
// appends one NUL-separated record to the list file:
//
//   @step <id> [after=<id>,<id>] [quiet] [kill] [early] [last] -- <argv...>
//
//   after=  the step starts only once every named step has PASSED. A gate that
//           must report before another (build.sh says why where it matters)
//           is ordered this way; everything else is independent.
//   quiet   stdout+stderr are shown only when the step fails — the old
//           `> /dev/null || { rerun; exit 1; }` shape, without the rerun:
//           the captured output of the failing run IS what the rerun printed.
//   kill    on another step's failure this one is terminated instead of
//           awaited (the WATX compile: nothing a 30 s compile says matters
//           once a gate has already failed the build).
//   early   start this one, and every step it transitively waits for, ahead
//           of other ready steps (the long pole and its prerequisites).
//   last    after= every non-`kill` step declared before it (the calibration
//           workload: it runs beside the compile's tail, once the gates are
//           done, so both see the same box).
//
// Fail-fast: after the first failure nothing new starts; running steps finish
// (or are killed, if `kill`), and EVERY failed step's full output is printed in
// declared order, so the earliest gate in build.sh's order still speaks first.
// A passing non-quiet step's output is printed whole when it finishes, never
// interleaved with another's.
//
// WINE_BUILD_JOBS=N caps concurrency (1 = the old serial order, for A/B and for
// reading a failure in the original sequence). The default is HALF the logical
// CPUs, not all of them: measured on the M1 (4 performance + 4 efficiency
// cores), 4 jobs builds in the same wall time as 8 (the compile is the long
// pole either way) for ~8% less CPU, because 8 puts gates on the efficiency
// cores, where the same work costs more CPU time; on an SMT x86 box half is
// the physical core count.
function defaultJobs() {
  return Math.max(2, Math.ceil(os.availableParallelism() / 2));
}
//
// Per-step accounting: each child gets WINE_BUILD_STEP=<id>; the preload
// tools/build-read-counter.js (NODE_OPTIONS, set by build.sh) appends one
// record per node process to $WINE_BUILD_RECORDS. After the run, this writes
// build/build-steps.json: per-step wall (measured here), user/sys CPU, peak RSS
// and src/ bytes read (summed over the step's processes), for
// tools/check-build-budget.js.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const outArg = process.argv.find((a) => a.startsWith('--out='));
const OUT_JSON = outArg ? path.resolve(outArg.slice(6)) : path.join(ROOT, 'build', 'build-steps.json');

function parseList(buf) {
  const tok = buf.toString('utf8').split('\0');
  if (tok[tok.length - 1] === '') tok.pop();
  const steps = [];
  let i = 0;
  while (i < tok.length) {
    if (tok[i] !== '@step') throw new Error(`build-run-steps: malformed list at token ${i}: ${JSON.stringify(tok[i])}`);
    const step = { id: tok[i + 1], after: [], quiet: false, kill: false, early: false, last: false, argv: [] };
    i += 2;
    while (i < tok.length && tok[i] !== '--') {
      const o = tok[i++];
      if (o.startsWith('after=')) step.after.push(...o.slice(6).split(',').filter(Boolean));
      else if (o === 'quiet' || o === 'kill' || o === 'early' || o === 'last') step[o] = true;
      else throw new Error(`build-run-steps: step ${step.id}: unknown option ${o}`);
    }
    i++; // '--'
    while (i < tok.length && tok[i] !== '@step') step.argv.push(tok[i++]);
    if (!step.argv.length) throw new Error(`build-run-steps: step ${step.id} has no command`);
    if (step.last) {
      for (const s of steps) if (!s.kill && !step.after.includes(s.id)) step.after.push(s.id);
    }
    steps.push(step);
  }
  const ids = new Set();
  for (const s of steps) {
    if (ids.has(s.id)) throw new Error(`build-run-steps: duplicate step id ${s.id}`);
    for (const d of s.after) if (!ids.has(d)) throw new Error(`build-run-steps: step ${s.id} is after ${d}, which is not declared before it`);
    ids.add(s.id);
  }
  return steps;
}

function srcTreeBytes() {
  let total = 0;
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) total += fs.statSync(p).size;
    }
  };
  walk(path.join(ROOT, 'src'));
  return total;
}

function readRecords(file) {
  if (!file || !fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch (_) { return null; }
  }).filter(Boolean);
}

function main() {
  const listPath = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!listPath) { console.error('usage: build-run-steps.js <steps.list> [--out=build/build-steps.json]'); process.exit(2); }
  const steps = parseList(fs.readFileSync(listPath));
  const jobs = Math.max(1, Number(process.env.WINE_BUILD_JOBS) || defaultJobs());
  const serial = jobs === 1;
  const t0 = process.hrtime.bigint();
  const msSince = () => Number(process.hrtime.bigint() - t0) / 1e6;
  const loadStart = os.loadavg();
  const state = new Map(steps.map((s) => [s.id, 'pending']));
  const running = new Map();
  let failed = false;

  const ready = () => steps.filter((s) => state.get(s.id) === 'pending' &&
    s.after.every((d) => state.get(d) === 'passed'));
  // Priority: `early` steps, then everything an early step transitively waits
  // for (the compile's prerequisites must not queue behind 8 s gates), then
  // declared order.
  const byId = new Map(steps.map((s) => [s.id, s]));
  const feedsEarly = new Set();
  const mark = (s) => { for (const d of s.after) if (!feedsEarly.has(d)) { feedsEarly.add(d); mark(byId.get(d)); } };
  for (const s of steps) if (s.early) mark(s);
  const rank = (s) => (s.early ? 0 : feedsEarly.has(s.id) ? 1 : 2);

  return new Promise((resolve) => {
    const pump = () => {
      if (!failed) {
        let cand = ready();
        if (serial) cand = cand.slice(0, 1);
        else cand.sort((a, b) => (rank(a) - rank(b)) || (steps.indexOf(a) - steps.indexOf(b)));
        // Serial mode keeps build.sh's literal order; a step only starts once
        // everything declared before it has finished.
        if (serial && cand.length && steps.slice(0, steps.indexOf(cand[0])).some((s) => state.get(s.id) !== 'passed')) cand = [];
        for (const s of cand) {
          if (running.size >= jobs) break;
          launch(s);
        }
      }
      if (running.size === 0) {
        const stuck = steps.filter((s) => state.get(s.id) === 'pending');
        if (!failed && stuck.length) {
          console.error(`build-run-steps: unreachable steps (a dependency never passed): ${stuck.map((s) => s.id).join(', ')}`);
          failed = true;
        }
        resolve(finish());
      }
    };

    const launch = (s) => {
      state.set(s.id, 'running');
      s.startMs = msSince();
      s.output = [];
      const child = spawn(s.argv[0], s.argv.slice(1), {
        cwd: ROOT,
        env: Object.assign({}, process.env, { WINE_BUILD_STEP: s.id }),
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      running.set(s.id, child);
      child.stdout.on('data', (c) => s.output.push(c));
      child.stderr.on('data', (c) => s.output.push(c));
      child.on('error', (err) => s.output.push(Buffer.from(`build-run-steps: cannot start ${s.argv[0]}: ${err.message}\n`)));
      child.on('close', (code, signal) => {
        running.delete(s.id);
        s.endMs = msSince();
        s.exit = code;
        s.signal = signal;
        const out = Buffer.concat(s.output);
        s.output = out;
        if (code === 0 && !s.cancelled) {
          state.set(s.id, 'passed');
          if (!s.quiet && out.length) process.stdout.write(out);
        } else if (s.cancelled) {
          state.set(s.id, 'cancelled');
        } else {
          state.set(s.id, 'failed');
          if (!failed) {
            failed = true;
            for (const [id, c] of running) {
              const other = steps.find((x) => x.id === id);
              if (other.kill) { other.cancelled = true; c.kill('SIGTERM'); }
            }
          }
        }
        pump();
      });
    };

    const finish = () => {
      const records = readRecords(process.env.WINE_BUILD_RECORDS);
      const byStep = new Map();
      for (const r of records) {
        if (!r.step) continue;
        if (!byStep.has(r.step)) byStep.set(r.step, []);
        byStep.get(r.step).push(r);
      }
      const rows = steps.map((s) => {
        const recs = byStep.get(s.id) || [];
        const main = recs.filter((r) => r.thread === 'main');
        return {
          id: s.id,
          cmd: s.argv.join(' '),
          after: s.after,
          status: state.get(s.id),
          exit: s.exit === undefined ? null : s.exit,
          startMs: s.startMs === undefined ? null : Math.round(s.startMs),
          wallMs: s.endMs === undefined ? null : Math.round(s.endMs - s.startMs),
          procs: main.length,
          userMs: Math.round(main.reduce((a, r) => a + r.userMs, 0)),
          sysMs: Math.round(main.reduce((a, r) => a + r.sysMs, 0)),
          maxRssKb: main.reduce((a, r) => Math.max(a, r.maxRssKb || 0), 0),
          srcBytes: recs.reduce((a, r) => a + (r.srcBytes || 0), 0),
          srcReads: recs.reduce((a, r) => a + (r.srcReads || 0), 0),
        };
      });
      const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
      const report = {
        format: 1,
        complete: !failed,
        when: new Date().toISOString(),
        platform: `${process.platform}-${process.arch}`,
        node: process.version,
        cpus: os.cpus().length,
        jobs,
        loadavgStart: loadStart.map((x) => +x.toFixed(2)),
        loadavgEnd: os.loadavg().map((x) => +x.toFixed(2)),
        wallMs: Math.round(msSince()),
        srcTreeBytes: srcTreeBytes(),
        totals: { procs: sum('procs'), userMs: sum('userMs'), sysMs: sum('sysMs'), srcBytes: sum('srcBytes') },
        steps: rows,
      };
      try {
        fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
        fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 1) + '\n');
      } catch (err) { console.error(`build-run-steps: cannot write ${OUT_JSON}: ${err.message}`); }

      if (!failed) return 0;
      for (const s of steps) {
        const st = state.get(s.id);
        if (st !== 'failed') continue;
        process.stdout.write(s.output);
        console.error(`\nbuild step FAILED: ${s.id} (exit ${s.exit}${s.signal ? `, ${s.signal}` : ''})\n  ${s.argv.join(' ')}`);
      }
      const cancelled = steps.filter((s) => state.get(s.id) === 'cancelled').map((s) => s.id);
      const skipped = steps.filter((s) => state.get(s.id) === 'pending').map((s) => s.id);
      if (cancelled.length) console.error(`build-run-steps: cancelled after the failure: ${cancelled.join(', ')}`);
      if (skipped.length) console.error(`build-run-steps: not started: ${skipped.length} step(s)`);
      return 1;
    };

    pump();
  });
}

if (require.main === module) {
  main().then((code) => process.exit(code), (err) => { console.error(err.stack || String(err)); process.exit(1); });
}

module.exports = { parseList };
