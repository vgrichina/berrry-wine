#!/usr/bin/env node
'use strict';

// The build's own cost is a gate, like any other regression.
//
//   node tools/check-build-budget.js            check build/build-steps.json
//   node tools/check-build-budget.js --update   record it as tools/build-budget.json
//   node tools/check-build-budget.js --self-test
//
// tools/build.sh got slow one reasonable gate at a time: 58 node processes,
// most of them re-reading and re-parsing all of src/, plus a compiler whose
// peak RSS once grew 585 MB in one commit without anyone noticing
// (scratch/runs/20261121-build-profile). Each addition was cheap alone. So the
// budget is held here, against tools/build-budget.json, from the numbers
// tools/build-run-steps.js and the tools/build-read-counter.js preload record:
//
//   HARD  node processes             <= baseline
//   HARD  compiler peak RSS          <= baseline + 10%
//   HARD  src/ read passes           <= baseline + 0.25
//         (bytes of src/ read by every step / bytes of src/ on disk: "how many
//         times did the build read the whole tree". Normalized by tree size
//         because src/ grows every commit and a raw byte cap would fail on any
//         source edit; a new gate that re-reads the tree adds ~1 pass.)
//   HARD  compile CPU, calibration units <= baseline x 1.15 (RATCHET)
//         (compile user+sys CPU / CPU of tools/build-calibrate.js's fixed
//         workload, run in the same build, so a loaded box does not read as a
//         compiler regression. >= 10% better prints the --update command;
//         nothing here writes the baseline unless asked.)
//   WARN  build wall time > baseline x 1.5 (wall is the box, not the build)
//
// Over budget means fix the build, not raise the number: new checks are
// compiler lint rules or read compiler facts, with no source-text rewrite
// before compile. --update exists for the ratchet going DOWN and for a change
// whose cost was reviewed, and says what it changed.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STEPS = path.join(ROOT, 'build', 'build-steps.json');
const CAL = path.join(ROOT, 'build', 'build-calibration.json');
const BASELINE = path.join(__dirname, 'build-budget.json');
const COMPILE_STEP = 'compile';

const RSS_SLACK = 0.10;
const PASSES_SLACK = 0.25;
const CPU_SLACK = 0.15;
const CPU_RATCHET = 0.10;
const WALL_WARN = 1.5;

function measure(report, cal) {
  if (!report || !Array.isArray(report.steps)) throw new Error('build-steps.json has no steps');
  const compile = report.steps.find((s) => s.id === COMPILE_STEP);
  if (!compile) throw new Error(`build-steps.json has no "${COMPILE_STEP}" step`);
  if (!cal || !(cal.cpuMs > 0)) throw new Error('build-calibration.json has no cpuMs');
  return {
    procs: report.totals.procs,
    compilerPeakRssMb: +(compile.maxRssKb / 1024).toFixed(1),
    srcReadPasses: +(report.totals.srcBytes / report.srcTreeBytes).toFixed(3),
    srcBytes: report.totals.srcBytes,
    srcTreeBytes: report.srcTreeBytes,
    compileCpuMs: compile.userMs + compile.sysMs,
    calibrationMs: cal.cpuMs,
    compileCpuUnits: +((compile.userMs + compile.sysMs) / cal.cpuMs).toFixed(2),
    wallMs: report.wallMs,
    compileProcs: compile.procs,
  };
}

function evaluate(m, base) {
  const errors = [];
  const warnings = [];
  const hints = [];
  if (!(m.procs > 0) || !(m.compileProcs > 0)) {
    errors.push('no per-process records: tools/build-read-counter.js was not preloaded (NODE_OPTIONS in build.sh), so nothing below can be judged');
    return { errors, warnings, hints };
  }
  if (m.procs > base.procs) {
    errors.push(`node processes ${m.procs} > budget ${base.procs}. A new gate is a new process that re-parses src/; ` +
      'make it a compiler lint rule or fold it into a process that already has the facts.');
  } else if (m.procs < base.procs) hints.push(`node processes ${m.procs} < budget ${base.procs}`);

  const rssCap = base.compilerPeakRssMb * (1 + RSS_SLACK);
  if (m.compilerPeakRssMb > rssCap) {
    errors.push(`compiler peak RSS ${m.compilerPeakRssMb} MB > budget ${base.compilerPeakRssMb} MB + ${RSS_SLACK * 100}% (${rssCap.toFixed(1)} MB)`);
  }

  const passCap = base.srcReadPasses + PASSES_SLACK;
  if (m.srcReadPasses > passCap) {
    errors.push(`src/ read ${m.srcReadPasses} times over (${m.srcBytes} bytes of a ${m.srcTreeBytes}-byte tree) > budget ` +
      `${base.srcReadPasses} + ${PASSES_SLACK}. Some step started re-reading the tree; read compiler facts instead.`);
  } else if (m.srcReadPasses < base.srcReadPasses - 1) {
    hints.push(`src/ read passes ${m.srcReadPasses} < budget ${base.srcReadPasses}`);
  }

  const cpuCap = base.compileCpuUnits * (1 + CPU_SLACK);
  if (m.compileCpuUnits > cpuCap) {
    errors.push(`compile CPU ${m.compileCpuUnits} calibration units (${(m.compileCpuMs / 1000).toFixed(1)} s / ${m.calibrationMs} ms) ` +
      `> budget ${base.compileCpuUnits} x ${1 + CPU_SLACK} (${cpuCap.toFixed(2)})`);
  } else if (m.compileCpuUnits <= base.compileCpuUnits * (1 - CPU_RATCHET)) {
    hints.push(`compile CPU ${m.compileCpuUnits} units is >= ${CPU_RATCHET * 100}% under budget ${base.compileCpuUnits}`);
  }

  if (base.wallMs && m.wallMs > base.wallMs * WALL_WARN) {
    warnings.push(`build wall ${(m.wallMs / 1000).toFixed(1)} s > ${WALL_WARN} x budget ${(base.wallMs / 1000).toFixed(1)} s ` +
      '(warning only: wall time measures the box as much as the build)');
  }
  return { errors, warnings, hints };
}

function baselineFrom(m, report) {
  return {
    note: 'Build budget ratchet, checked by tools/check-build-budget.js after every tools/build.sh. ' +
      'Over budget = fix the build, do not raise these. Lower them with: node tools/check-build-budget.js --update',
    procs: m.procs,
    compilerPeakRssMb: m.compilerPeakRssMb,
    srcReadPasses: m.srcReadPasses,
    compileCpuUnits: m.compileCpuUnits,
    wallMs: m.wallMs,
    recorded: {
      when: report.when, platform: report.platform, node: report.node, cpus: report.cpus, jobs: report.jobs,
      loadavgStart: report.loadavgStart, compileCpuMs: m.compileCpuMs, calibrationMs: m.calibrationMs,
      srcBytes: m.srcBytes, srcTreeBytes: m.srcTreeBytes,
    },
  };
}

function selfTest() {
  const base = { procs: 50, compilerPeakRssMb: 900, srcReadPasses: 20, compileCpuUnits: 100, wallMs: 40000 };
  const good = { procs: 50, compileProcs: 1, compilerPeakRssMb: 950, srcReadPasses: 20.1, srcBytes: 1, srcTreeBytes: 1,
    compileCpuMs: 30000, calibrationMs: 300, compileCpuUnits: 100, wallMs: 50000 };
  const cases = [
    ['clean', {}, 0, 0, 0],
    ['one more process', { procs: 51 }, 1, 0, 0],
    ['compiler RSS +11%', { compilerPeakRssMb: 1000 }, 1, 0, 0],
    ['src read +0.3 passes', { srcReadPasses: 20.31 }, 1, 0, 0],
    ['compile CPU x1.2', { compileCpuUnits: 120 }, 1, 0, 0],
    ['compile CPU x1.14 tolerated', { compileCpuUnits: 114 }, 0, 0, 0],
    ['compile CPU 10% better', { compileCpuUnits: 90 }, 0, 0, 1],
    ['wall x2 warns only', { wallMs: 80000 }, 0, 1, 0],
    ['no preload records', { procs: 0, compileProcs: 0 }, 1, 0, 0],
  ];
  let bad = 0;
  for (const [name, patch, e, w, h] of cases) {
    const r = evaluate(Object.assign({}, good, patch), base);
    const ok = r.errors.length === e && r.warnings.length === w && r.hints.length === h;
    if (!ok) {
      bad++;
      console.error(`check-build-budget --self-test: "${name}" gave ${r.errors.length} errors / ${r.warnings.length} warnings / ` +
        `${r.hints.length} hints, expected ${e}/${w}/${h}`);
    }
  }
  const report = { steps: [{ id: COMPILE_STEP, maxRssKb: 1024 * 900, userMs: 29000, sysMs: 1000, procs: 1 }],
    totals: { procs: 50, srcBytes: 2000 }, srcTreeBytes: 100, wallMs: 40000 };
  const m = measure(report, { cpuMs: 300 });
  if (m.compileCpuUnits !== 100 || m.srcReadPasses !== 20 || m.compilerPeakRssMb !== 900) {
    bad++;
    console.error(`check-build-budget --self-test: measure() gave ${JSON.stringify(m)}`);
  }
  if (bad) process.exit(1);
  return cases.length + 1;
}

function main() {
  const planted = selfTest();
  if (process.argv.includes('--self-test')) {
    console.log(`check-build-budget --self-test: OK (${planted} planted cases)`);
    return;
  }
  for (const f of [STEPS, CAL]) {
    if (!fs.existsSync(f)) {
      console.error(`check-build-budget: ${path.relative(ROOT, f)} missing; run bash tools/build.sh`);
      process.exit(1);
    }
  }
  const report = JSON.parse(fs.readFileSync(STEPS, 'utf8'));
  if (!report.complete) {
    console.error('check-build-budget: build/build-steps.json is from a FAILED build; nothing to judge');
    process.exit(1);
  }
  const m = measure(report, JSON.parse(fs.readFileSync(CAL, 'utf8')));
  const line = `${m.procs} procs, compiler ${m.compilerPeakRssMb} MB, src read x${m.srcReadPasses}, ` +
    `compile ${m.compileCpuUnits} units (${(m.compileCpuMs / 1000).toFixed(1)} s / ${m.calibrationMs} ms), ` +
    `wall ${(m.wallMs / 1000).toFixed(1)} s, load ${report.loadavgStart.join(' ')}`;

  if (process.argv.includes('--update')) {
    const old = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : null;
    const next = baselineFrom(m, report);
    if (old && old.basis) next.basis = old.basis;
    fs.writeFileSync(BASELINE, JSON.stringify(next, null, 2) + '\n');
    console.log(`check-build-budget: wrote ${path.relative(ROOT, BASELINE)}: ${line}`);
    if (old) {
      for (const k of ['procs', 'compilerPeakRssMb', 'srcReadPasses', 'compileCpuUnits', 'wallMs']) {
        if (old[k] !== next[k]) console.log(`  ${k}: ${old[k]} -> ${next[k]}`);
      }
    }
    return;
  }

  if (!fs.existsSync(BASELINE)) {
    console.error(`check-build-budget: ${path.relative(ROOT, BASELINE)} missing; record one with --update (measured: ${line})`);
    process.exit(1);
  }
  const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const r = evaluate(m, base);
  for (const w of r.warnings) console.warn(`check-build-budget: WARNING ${w}`);
  if (r.errors.length) {
    console.error('check-build-budget: OVER BUDGET (fix the build; do not raise tools/build-budget.json):');
    for (const e of r.errors) console.error(`  ${e}`);
    console.error(`  measured: ${line}`);
    console.error('  per-step numbers: build/build-steps.json');
    process.exit(1);
  }
  console.log(`check-build-budget: OK (${line})`);
  if (r.hints.length) {
    console.log(`check-build-budget: under budget (${r.hints.join('; ')}); lower the ratchet with:`);
    console.log('  node tools/check-build-budget.js --update');
  }
}

if (require.main === module) main();

module.exports = { measure, evaluate };
