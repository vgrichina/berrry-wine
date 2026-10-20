#!/usr/bin/env node
'use strict';

// Whole programs on each execution ARM, against L1.
//
//   node tools/toyvm/arm-bench.js --exe=A.EXE,B.EXE [--arms=l1,uop,jit,only]
//        [--dispatches=20m] [--reps=1] [--timeout=300] [--out=FILE.json]
//        [--l1-seconds=S]
//
//   l1         threaded x86 alone (the oracle)
//   uop        l1 + the µop loop tier (uop-live.js), shell-bench's schedule
//   uopc       ...with its programs chained in one E1 arena (--uop-chain)
//   jit        l1 + the live region JIT (region-live.js), sweep-dos's schedule
//   jit-early  ...profiled 6M after 6M whatever the run length (the CLI's)
//   jit-r8     ...jit-early carrying up to 8 regions in its install
//   jit-sep    ...jit-early with the region as a separate module, no swap
//   jit-sepw   ...jit-sep prepared on a worker thread
//   jit-sepc   ...jit-sep re-profiling continuously, adding regions as scenes change
//   jit-sepwc  ...jit-sepc prepared on a worker thread
//   only       the µop-only arm (uop-only.js): loop nests and straight lines
//   only-line  ...straight lines only, linked
//   only-bl    only, with straight lines built on the baseline passes
//   only-min   only, every program built with promote + flaglive (promoteLiveRP)
//   only-base  only, every program built on the baseline passes (baselineRP)
//   only-R     only, on resident: true (narrow registers stored in place, allR)
//   only-RF    only, on resident: 'full' (allRF)
//   only-naive only, every program the naive lowering (naiveR): no passes
//   only-nK    tier-up from naiveR: rebuilt on allRP once its loop headers
//              have counted K (only-n1k, only-n100k, ...)
//   only-tK    tier-up: built on promoteLiveRP, rebuilt on allRP once its loop
//              headers have counted K (only-t64, only-t1k, ...)
//
// Any arm name + `@spill` (only-naive@spill) runs it on the E1 engine as it
// was before uop-wasm.js callSafe: the A/B for that change. `@nofuse` runs it
// without the fused `X_s` step µops (TOYVM_STEPFUSE=0), `@nomask` without the
// fused narrow masks (TOYVM_MASKFUSE=0), `@norep` with REP MOVS/STOS on the
// L1 fallback instead of the REP µop (TOYVM_UOPREP=0), `@nofwd` without the
// naive register/mask forwarding (TOYVM_NAIVEFWD=0), `@nok` with a naive
// program's constants back on `movi` (TOYVM_CONSTK=0). They stack:
// only-naive@spill@nofuse.
//
// --l1-seconds=S sizes each program's run instead: an L1 run of --dispatches
// first measures that program's rate, and every arm then runs the count L1
// retires in about S seconds of CPU. One count per program, the same for every
// arm, so the dispatch and frame check still holds. A program that ends before
// its calibration budget keeps the count it ended at. Short runs overweight
// one-time build and compile cost, and can stop inside an intro.
//
// Name an arm twice (--arms=l1,l1,only) to time a second copy of it: that
// pair's spread is this run's null band.
//
// One node process per run, arm order rotated per program. The number quoted
// is the whole run's CPU time (runDos `cpuSecs`: user + system over the run
// loop, builds and handbacks included) -- wall clock on this box measures the
// other agents -- beside the slice-only wasm time (`guestSecs`).
//
// `run` is that CPU time less what the arm spent building, against L1's CPU;
// `build` is that spend as a share of the arm's own CPU. Build time is wall
// time with the guest stopped: µop-only's program builds and tier-ups,
// uop-live's programs, the JIT's whole pipeline (run-dos awaits it between
// slices, so its wait on V8's off-thread compile is in it). On a quiet box
// that is CPU; on a loaded one, a build waiting for a core reads long.
//
// Every arm must retire the same dispatch count and draw the same frame as l1, or its
// row is marked and left out of the summary, never averaged.
//
// Compatibility summaries use the minimum-CPU repeat per arm, unless any run
// failed (the first failure wins). Their checks and across-program percentiles
// describe those selected results, NOT paired repeat distributions. Non-selected
// frame/dispatch disagreements remain in the raw evidence, not summary checks.
// JSON keeps every runOne result in rows[].repeats, in execution order, with
// arm (CLI name), label (distinguishes duplicates), and zero-based repeatIndex.
// executionOrder is zero-based across all programs, including optional
// rows[].calibration runs; calibration is separate from measured repetitions.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const hit = argv.find((a) => a.startsWith(`--${k}=`));
  return hit === undefined ? d : hit.slice(k.length + 3);
};
const count = (s) => {
  const m = /^(\d+(?:\.\d+)?)([kmb]?)$/i.exec(String(s).trim());
  if (!m) throw new Error(`not a count: ${s}`);
  return Math.round(Number(m[1]) * ({ '': 1, k: 1e3, m: 1e6, b: 1e9 })[m[2].toLowerCase()]);
};

const ARMS = {
  l1: () => ({}),
  uop: (b) => ({ uop: { sampleAfter: Math.floor(b / 10), profileFor: 1e6 } }),
  uopc: (b) => ({ uop: { sampleAfter: Math.floor(b / 10), profileFor: 1e6, chain: true } }),
  jit: (b) => ({ regionJit: { sampleAfter: Math.floor(b / 4), profileFor: Math.floor(b / 4), gateAt: 0 } }),
  // ...on the CLI's fixed schedule (profile 6M after 6M) rather than half the
  // run, which on a long run leaves the first half on L1; and the same carrying
  // up to 8 regions in its one install (the default carries 1, so a program
  // whose time is spread over several loops is mostly left on L1).
  'jit-early': () => ({ regionJit: { sampleAfter: 6e6, profileFor: 6e6, gateAt: 0 } }),
  'jit-r8': () => ({ regionJit: { sampleAfter: 6e6, profileFor: 6e6, gateAt: 0, regions: 8 } }),
  // ...jit-early, but the region is its own small module written into the
  // RUNNING interpreter's table (region-sep.js) instead of a rebuilt
  // interpreter the guest is swapped onto; and the same prepared on a worker
  // thread while the guest keeps running (its CPU still counts: cpuSecs is
  // the whole process).
  'jit-sep': () => ({ regionJit: { sampleAfter: 6e6, profileFor: 6e6, gateAt: 0, sep: true } }),
  'jit-sepw': () => ({ regionJit: { sampleAfter: 6e6, profileFor: 6e6, gateAt: 0, sep: true, worker: true } }),
  // ...and continuously: re-profile every window and add a region whenever a
  // new loop has become the hottest (region-live.js `continuous`). The 5% floor
  // keeps a scene with no dominant loop from paying an audit per window.
  'jit-sepc': () => ({ regionJit: { sampleAfter: 6e6, profileFor: 6e6, gateAt: 0, sep: true,
    continuous: true, minShare: 5 } }),
  'jit-sepwc': () => ({ regionJit: { sampleAfter: 6e6, profileFor: 6e6, gateAt: 0, sep: true,
    worker: true, continuous: true, minShare: 5 } }),
  only: () => ({ uopOnly: { shape: 'loop' } }),
  'only-line': () => ({ uopOnly: { shape: 'straight' } }),
  // ...loops fully optimized, straight lines on the baseline passes
  'only-bl': () => ({ uopOnly: { shape: 'loop', linePasses: 'baselineRP' } }),
  'only-min': () => ({ uopOnly: { shape: 'loop', passes: 'promoteLiveRP', linePasses: 'promoteLiveRP' } }),
  'only-base': () => ({ uopOnly: { shape: 'loop', passes: 'baselineRP', linePasses: 'baselineRP' } }),
  // only, on the other two resident models: narrow registers stored in place
  // (allR) and the same with read-modify-write narrow stores (allRF)
  'only-R': () => ({ uopOnly: { shape: 'loop', passes: 'allR', linePasses: 'allR' } }),
  'only-RF': () => ({ uopOnly: { shape: 'loop', passes: 'allRF', linePasses: 'allRF' } }),
  'only-naive': () => ({ uopOnly: { shape: 'loop', passes: 'naiveR', linePasses: 'naiveR' } }),
};

// `ARM@spill` runs ARM on the E1 engine without uop-wasm.js callSafe
// (TOYVM_CALLSAFE=0): Ion keeps $pc and the machine params on the stack.
// `ARM@nofuse` runs it without step fusion (TOYVM_STEPFUSE=0), `ARM@nomask`
// without mask fusion (TOYVM_MASKFUSE=0).
const KNOBS = { '@spill': 'TOYVM_CALLSAFE', '@nofuse': 'TOYVM_STEPFUSE', '@nomask': 'TOYVM_MASKFUSE', '@norep': 'TOYVM_UOPREP',
  '@nofwd': 'TOYVM_NAIVEFWD', '@nok': 'TOYVM_CONSTK' };
const armOf = (a) => {
  for (const k of Object.keys(KNOBS)) if (a.endsWith(k)) return armOf(a.slice(0, -k.length));
  const t = /^only-t(\d+[km]?)$/i.exec(a);
  const nv = /^only-n(\d+[km]?)$/i.exec(a);
  if (nv) {
    const after = count(nv[1]);
    return () => ({ uopOnly: { shape: 'loop', passes: 'naiveR', linePasses: 'naiveR', tier: { passes: 'allRP', after } } });
  }
  if (t) {
    const after = count(t[1]);
    return () => ({ uopOnly: { shape: 'loop', passes: 'promoteLiveRP', linePasses: 'promoteLiveRP', tier: { passes: 'allRP', after } } });
  }
  return ARMS[a];
};

// --child: one run, printed as one JSON line.
async function child(spec) {
  const { exe, budget, arm } = JSON.parse(spec);
  const { runDos } = require('./run-dos');
  const r = await runDos({ exe, variant: 'tailcall', budget, cpu: 386, autoKey: true, log: () => {},
    ...armOf(arm)(budget) });
  const u = r.uop;
  console.log('ARMBENCH ' + JSON.stringify({
    secs: r.secs, cpuSecs: r.cpuSecs, guestSecs: r.guestSecs, dispatched: r.dispatched, frame: r.frame,
    // What the arm spent building (µop programs, tier-ups, the JIT pipeline),
    // on the main thread; the rest of cpuSecs is running (buildOf).
    buildSecs: u && u.fallbacks ? u.buildSecs + (u.tierSecs || 0)
      : u ? (u.buildMs || 0) / 1000 : r.jit ? (r.jit.buildMs || 0) / 1000 : 0,
    handbacks: r.session ? r.session.handbacks : undefined,
    only: u && u.fallbacks ? { share: u.uopShare, builds: u.builds, fbSites: u.fbSites, fbEntries: u.fbEntries,
      fbSteps: u.fbSteps, entries: u.entries, chains: u.chains, buildSecs: u.buildSecs, invalidated: u.invalidated,
      tierUps: u.tierUps, tierSecs: u.tierSecs, tierFails: u.tierFails,
      top: u.fallbacks.slice(0, 5).map((f) => `${f.why}:${f.steps}`) } : null,
    uop: u && !u.fallbacks ? { steps: u.steps, installs: u.installs } : null,
    jit: r.jit ? { phase: r.jit.phase, installs: r.jit.installs } : null,
  }));
}

function runOne(exe, budget, arm, timeoutS) {
  return new Promise((resolve) => {
    const env = { ...process.env };
    for (const [k, v] of Object.entries(KNOBS)) if (arm.split('@').includes(k.slice(1))) env[v] = '0';
    const p = spawn(process.execPath, [__filename, `--child=${JSON.stringify({ exe, budget, arm })}`],
      { stdio: ['ignore', 'pipe', 'pipe'], env });
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    const kill = setTimeout(() => p.kill('SIGKILL'), timeoutS * 1000);
    p.on('close', (code, sig) => {
      clearTimeout(kill);
      const m = /^ARMBENCH (.*)$/m.exec(out);
      if (m) return resolve({ ok: true, ...JSON.parse(m[1]) });
      resolve({ ok: false, reason: sig === 'SIGKILL' ? 'timeout'
        : `exit ${code}: ${(err || out).trim().split('\n').slice(-2).join(' | ')}` });
    });
  });
}

const OVERSHOOT = 64;
const geomean = (xs) => Math.exp(xs.reduce((s, x) => s + Math.log(x), 0) / xs.length);

async function main() {
  const spec = arg('child');
  if (spec) return child(spec);
  const arms = arg('arms', 'l1,uop,jit,only').split(',').filter(Boolean);
  for (const a of arms) if (!armOf(a)) throw new Error(`unknown arm ${a} (known: ${Object.keys(ARMS).join(',')})`);
  if (arms[0] !== 'l1') throw new Error('the first arm is the oracle: l1');
  const budget = count(arg('dispatches', '20m'));
  const l1Secs = arg('l1-seconds', null) === null ? 0 : Number(arg('l1-seconds'));
  const reps = Number(arg('reps', 1));
  const timeoutS = Number(arg('timeout', 300));
  const outFile = arg('out', null);
  const progs = arg('exe', '').split(',').filter(Boolean);
  if (!progs.length) throw new Error('--exe=A.EXE,B.EXE');
  // Arms named twice are timed twice, and labelled apart.
  const labels = arms.map((a, i) => (arms.indexOf(a) === i ? a : `${a}#${arms.slice(0, i).filter((x) => x === a).length + 1}`));
  console.log(`arm-bench: ${progs.length} program(s), ${l1Secs ? `~${l1Secs}s of L1 each (calibrated at ${budget})` : `${budget} dispatches`}, arms ${labels.join(',')}, reps ${reps},`
    + ` loadavg ${os.loadavg().map((x) => x.toFixed(2)).join(' ')}`);
  const rows = [];
  let executionOrder = 0;
  const selectedSummary = {
    selection: 'minimum-cpuSecs',
    failurePolicy: 'first-failure-wins',
    distribution: 'across-program-selected-ratios-not-paired-repeats',
    checks: 'selected-results-only',
  };
  console.log('Selected/best summaries: minimum CPU per arm; first failure wins. Checks use selected results; percentiles are across programs, not paired repeats.');
  for (let pi = 0; pi < progs.length; pi++) {
    const exe = progs[pi];
    const row = { exe, name: path.basename(exe), arms: {}, budget, repeats: [] };
    if (l1Secs) {
      const c = await runOne(exe, budget, 'l1', timeoutS);
      row.calibration = { executionOrder: executionOrder++, arm: 'l1', budget, result: c };
      if (c.ok && c.dispatched >= budget) row.budget = Math.round(c.dispatched / c.cpuSecs * l1Secs);
      console.log(`      ${row.name}: calibration ${c.ok ? `${c.dispatched} in ${c.cpuSecs.toFixed(2)}s` : c.reason}`
        + ` -> ${row.budget} dispatches`);
    }
    for (let rep = 0; rep < reps; rep++) {
      for (let i = 0; i < arms.length; i++) {
        const k = (i + pi + rep) % arms.length;
        const r = await runOne(exe, row.budget, arms[k], timeoutS);
        row.repeats.push({ executionOrder: executionOrder++, arm: arms[k], label: labels[k],
          repeatIndex: rep, result: r });
        const prev = row.arms[labels[k]];
        // Best of the reps, by CPU time; a failure anywhere marks the arm.
        if (!prev || (prev.ok && (!r.ok || r.cpuSecs < prev.cpuSecs))) row.arms[labels[k]] = r;
      }
    }
    const ref = row.arms.l1;
    // The last slice overshoots its budget by however many ops the arm's last
    // block or fold billed at once (L1's port-poll spin charges a run of turns
    // together), so the totals may differ by that much with the same frame.
    row.bad = labels.filter((l) => row.arms[l].ok && ref.ok
      && (Math.abs(row.arms[l].dispatched - ref.dispatched) > OVERSHOOT || row.arms[l].frame !== ref.frame));
    row.failed = labels.filter((l) => !row.arms[l].ok);
    rows.push(row);
    const cell = (l) => {
      const r = row.arms[l];
      if (!r.ok) return `${l} FAIL(${r.reason.slice(0, 50)})`;
      const x = ref.ok ? ` x${(r.cpuSecs / ref.cpuSecs).toFixed(2)}` : '';
      const eb = ref.ok && r.buildSecs ? ` (run x${((r.cpuSecs - r.buildSecs) / ref.cpuSecs).toFixed(2)}`
        + ` + build ${r.buildSecs.toFixed(2)}s)` : '';
      return `${l} ${r.cpuSecs.toFixed(2)}s${x}${eb}`
        + (r.only ? ` [${(100 * r.only.share).toFixed(0)}% µop, fb ${r.only.fbEntries}, build ${r.only.buildSecs.toFixed(2)}s`
          + (r.only.tierUps !== undefined && (r.only.tierUps || r.only.tierFails.length) ? `, up ${r.only.tierUps} ${r.only.tierSecs.toFixed(2)}s` : '') + ']' : '');
    };
    console.log(`[${pi + 1}/${progs.length}] ${row.name.padEnd(14)} ${labels.map(cell).join('  ')}`
      + (row.bad.length ? `  DISAGREE ${row.bad.map((l) => `${l} ${row.arms[l].dispatched}/${row.arms[l].frame} vs ${ref.dispatched}/${ref.frame}`).join(', ')}` : '')
      + `  load ${os.loadavg()[0].toFixed(1)}`);
    for (const l of labels) {
      const o = row.arms[l].only;
      if (o) console.log(`      ${l}: fallback ${o.top.join(' ')}`);
    }
    if (outFile) fs.writeFileSync(outFile, JSON.stringify({ budget, arms: labels, rows, selectedSummary }, null, 1));
  }
  const clean = rows.filter((r) => !r.failed.length && !r.bad.length);
  console.log(`\n${clean.length} of ${rows.length} program(s) clean in every arm`);
  for (const l of labels) {
    if (!clean.length) break;
    const cpu = clean.map((r) => r.arms[l].cpuSecs / r.arms.l1.cpuSecs).sort((a, b) => a - b);
    const g = clean.map((r) => r.arms[l].guestSecs / r.arms.l1.guestSecs);
    const q = (f) => cpu[Math.min(cpu.length - 1, Math.floor(f * cpu.length))];
    // The same CPU time split: running (cpu less build) against L1's, and the
    // share of the arm's own CPU its builds took.
    const run = clean.map((r) => (r.arms[l].cpuSecs - (r.arms[l].buildSecs || 0)) / r.arms.l1.cpuSecs);
    const bshare = clean.reduce((s, r) => s + (r.arms[l].buildSecs || 0) / r.arms[l].cpuSecs, 0) / clean.length;
    console.log(`  ${l.padEnd(10)} cpu vs l1: geomean x${geomean(cpu).toFixed(3)}  p10 x${q(0.1).toFixed(2)}`
      + `  p50 x${q(0.5).toFixed(2)}  p90 x${q(0.9).toFixed(2)}  | run x${geomean(run).toFixed(3)}`
      + `  build ${(100 * bshare).toFixed(1)}% of its cpu  | slice time geomean x${geomean(g).toFixed(3)}`);
  }
  for (const r of rows) {
    if (r.failed.length) console.log(`  FAIL ${r.name}: ${r.failed.map((l) => `${l}: ${r.arms[l].reason}`).join('; ')}`);
    if (r.bad.length) console.log(`  DISAGREE ${r.name}: ${r.bad.join(',')}`);
  }
}

main().catch((e) => { console.error(e.stack || String(e)); process.exit(1); });
