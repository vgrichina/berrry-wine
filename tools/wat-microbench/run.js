#!/usr/bin/env node
'use strict';

// WAT representation microbenchmarks: the harness.
//
//   node tools/wat-microbench/run.js --mods=DIR --out=DIR --check
//       every module on every available engine at a small size; writes
//       DIR/check.json (checksum and status per module x engine) and fails if
//       any variant's checksum differs from its program's control anywhere.
//   node tools/wat-microbench/run.js --mods=DIR --out=DIR [--reps=5]
//       [--target-sec=0.3] [--engines=a,b] [--families=f,g]
//       timing; needs check.json from --check (only combinations that passed
//       are timed). Writes DIR/timing.json, then summary.json.
//   node tools/wat-microbench/run.js --engines-only
//       print which engines were found and their versions.
//
// What is measured: CPU time (user+sys over all the process's threads, from
// wait4 rusage via cpurun.c) of a whole process doing FIXED work: N calls of
// run(k) for a JS shell or wasm2c binary, one call of run(N*k) for a CLI
// runtime. Each repetition times a big N and a small N/5 back to back, and
// ns/op = (cpu(big) - cpu(small)) / ((Nbig - Nsmall) * k * opsPerIter), so
// process start, compile and tier-up costs cancel. N is calibrated per
// (program, engine) on the control, by re-measuring the big/small pair until
// cpu(big)-cpu(small) is about 0.8 * --target-sec (a first 1-vs-5-call
// estimate is taken before tier-up and is not trusted on its own); every
// variant of that program then does the SAME
// work on that engine. Repetitions are interleaved (rep-major, rotated
// variant order), and the summary is the median with min/max over reps.
// `<control>~copy` is a byte-identical module timed as its own row: its
// ratio to the control is the null band.
//
// Engines (each is optional; a missing binary is reported, not fatal):
//   v8-tf        d8 --no-liftoff --no-wasm-lazy-compilation   (TurboFan only)
//   v8-liftoff   d8 --liftoff --no-wasm-tier-up               (baseline only)
//   v8-drumbrake d8 --wasm-jitless                            (interpreter, if built in)
//   node         node default (Liftoff -> TurboFan dynamic tiering)
//   sm-ion       sm --wasm-compiler=ion
//   sm-baseline  sm --wasm-compiler=baseline
//   jsc          jsc default (BBQ -> OMG)
//   jsc-bbq      jsc --useOMGJIT=0
//   jsc-ipint    jsc --useBBQJIT=0 --useOMGJIT=0             (in-place interpreter)
//   wasm3, wasmi (wasmi_cli), wasmtime (Cranelift), wasmtime-pulley,
//   wasmer (Cranelift), wasmer-singlepass, wasm2c (WABT + cc -O2, native)
// Binary locations: $D8 $SM $JSC $WASM3 $WASMI $WASMTIME $WASMER $WABT_DIR
// (WABT_DIR holds bin/wasm2c and wasm2c/ runtime sources), $SIMDE_INC.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');

const HERE = __dirname;
const HOME = os.homedir();
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] ?? true] : [a, true]; }));

function firstExisting(env, cands) {
  if (process.env[env]) return process.env[env];
  for (const c of cands) if (c && fs.existsSync(c)) return c;
  return null;
}
function which(name) {
  const r = spawnSync('sh', ['-c', `command -v ${name}`], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

const BIN = {
  d8: firstExisting('D8', [path.join(HOME, '.jsvu/bin/v8')]),
  sm: firstExisting('SM', [path.join(HOME, '.jsvu/bin/sm')]),
  jsc: firstExisting('JSC', [path.join(HOME, '.jsvu/bin/jsc')]),
  node: process.execPath,
  wasm3: firstExisting('WASM3', [path.join(HOME, 'opt/wasm3/build/wasm3'), which('wasm3')]),
  wasmi: firstExisting('WASMI', [path.join(HOME, '.cargo/bin/wasmi'), path.join(HOME, '.cargo/bin/wasmi_cli'), which('wasmi_cli')]),
  wasmtime: firstExisting('WASMTIME', [path.join(HOME, 'opt/wasmtime-v39.0.0-x86_64-linux/wasmtime'), which('wasmtime')]),
  wasmer: firstExisting('WASMER', [path.join(HOME, 'opt/wasmer/bin/wasmer'), which('wasmer')]),
  wabt: firstExisting('WABT_DIR', [path.join(HOME, 'opt/wabt-1.0.37')]),
};

const JS_SHELL_ENGINES = {
  'v8-tf': { bin: 'd8', flags: ['--no-liftoff', '--no-wasm-lazy-compilation'], dashdash: true },
  'v8-liftoff': { bin: 'd8', flags: ['--liftoff', '--no-wasm-tier-up'], dashdash: true },
  'v8-drumbrake': { bin: 'd8', flags: ['--wasm-jitless'], dashdash: true },
  node: { bin: 'node', flags: [] },
  'sm-ion': { bin: 'sm', flags: ['--wasm-compiler=ion'] },
  'sm-baseline': { bin: 'sm', flags: ['--wasm-compiler=baseline'] },
  jsc: { bin: 'jsc', flags: ['--useWebAssemblyTailCalls=true'], dashdash: true },
  'jsc-bbq': { bin: 'jsc', flags: ['--useWebAssemblyTailCalls=true', '--useOMGJIT=0'], dashdash: true },
  'jsc-ipint': { bin: 'jsc', flags: ['--useWebAssemblyTailCalls=true', '--useBBQJIT=0', '--useOMGJIT=0'], dashdash: true },
};
// CLI runtimes: one invocation, run(total) once.
// Feature flags are passed per module (only what it uses): Pulley refuses
// threads=y outright, and wasmer's backends refuse a module when a flag
// enables a feature they lack, even an unused one.
const WT_FEAT = { 'tail-call': 'tail-call=y', 'shared-memory': 'threads=y', atomics: 'threads=y', 'multi-memory': 'multi-memory=y', memory64: 'memory64=y', simd: 'simd=y' };
const WR_FEAT = { 'tail-call': '--enable-tail-call', 'shared-memory': '--enable-threads', atomics: '--enable-threads', 'multi-memory': '--enable-multi-memory', memory64: '--enable-memory64', simd: '--enable-simd' };
const wtFlags = (m) => { const f = [...new Set(m.features.map((x) => WT_FEAT[x]))]; return f.length ? ['-W', f.join(',')] : []; };
const wrFlags = (m) => [...new Set(m.features.map((x) => WR_FEAT[x]))];
const CLI_ENGINES = {
  wasm3: { bin: 'wasm3', argv: (w, n) => ['--func', 'run', w, String(n)] },
  wasmi: { bin: 'wasmi', argv: (w, n) => ['run', '--invoke', 'run', w, String(n)] },
  wasmtime: { bin: 'wasmtime', argv: (w, n, m) => ['run', ...wtFlags(m), '--invoke', 'run', w, String(n)] },
  'wasmtime-pulley': { bin: 'wasmtime', argv: (w, n, m) => ['run', '--target', 'pulley64', ...wtFlags(m), '--invoke', 'run', w, String(n)] },
  wasmer: { bin: 'wasmer', argv: (w, n, m) => ['run', '--cranelift', ...wrFlags(m), '--invoke', 'run', w, String(n)] },
  'wasmer-singlepass': { bin: 'wasmer', argv: (w, n, m) => ['run', '--singlepass', ...wrFlags(m), '--invoke', 'run', w, String(n)] },
};
const ALL_ENGINES = [...Object.keys(JS_SHELL_ENGINES), ...Object.keys(CLI_ENGINES), 'wasm2c'];

function engineAvailable(e) {
  if (JS_SHELL_ENGINES[e]) return !!BIN[JS_SHELL_ENGINES[e].bin];
  if (CLI_ENGINES[e]) return !!BIN[CLI_ENGINES[e].bin];
  if (e === 'wasm2c') return !!BIN.wabt && fs.existsSync(path.join(BIN.wabt, 'bin/wasm2c'));
  return false;
}

function versionOf(e) {
  const tryRun = (bin, a) => { const r = spawnSync(bin, a, { encoding: 'utf8', timeout: 20000 }); return ((r.stdout || '') + (r.stderr || '')).trim().split('\n')[0]; };
  try {
    if (e.startsWith('v8')) return 'd8 ' + tryRun(BIN.d8, ['-e', 'print(version())']);
    if (e === 'node') return 'node ' + process.version + ' (V8 ' + process.versions.v8 + ')';
    if (e.startsWith('sm')) return 'sm ' + tryRun(BIN.sm, ['--version']);
    if (e.startsWith('jsc')) {
      const st = path.join(HOME, '.jsvu/status.json');
      return 'jsc ' + (fs.existsSync(st) ? (JSON.parse(fs.readFileSync(st, 'utf8')).javascriptcore || '?') : '?');
    }
    if (e === 'wasm3') return tryRun(BIN.wasm3, ['--version']);
    if (e === 'wasmi') return tryRun(BIN.wasmi, ['--version']);
    if (e.startsWith('wasmtime')) return tryRun(BIN.wasmtime, ['--version']);
    if (e.startsWith('wasmer')) return tryRun(BIN.wasmer, ['--version']);
    if (e === 'wasm2c') return 'wasm2c ' + tryRun(path.join(BIN.wabt, 'bin/wasm2c'), ['--version']) + ' + ' + tryRun(process.env.CC || 'cc', ['--version']);
  } catch (err) { return 'unknown: ' + err.message; }
  return '?';
}

// ---------------------------------------------------------------------------

function cpurunPath(work) {
  const exe = path.join(work, 'cpurun');
  if (!fs.existsSync(exe)) execFileSync('cc', ['-O2', '-o', exe, path.join(HERE, 'cpurun.c')]);
  return exe;
}

const W2C_FLAGS = { 'tail-call': '--enable-tail-call', simd: null, 'shared-memory': '--enable-threads', atomics: '--enable-threads', 'multi-memory': '--enable-multi-memory', memory64: '--enable-memory64' };
function buildWasm2c(mod, modsDir, work) {
  const dir = path.join(work, 'w2c');
  fs.mkdirSync(dir, { recursive: true });
  const exe = path.join(dir, mod.id);
  if (fs.existsSync(exe)) return { exe };
  const c = path.join(dir, mod.id + '.c');
  const flags = [...new Set(mod.features.map((f) => W2C_FLAGS[f]).filter(Boolean))];
  const log = (r) => ((r.stdout || '') + (r.stderr || '')).trim().split('\n').slice(0, 3).join(' | ');
  let r = spawnSync(path.join(BIN.wabt, 'bin/wasm2c'), [...flags, '-n', 'bench', path.join(modsDir, mod.id + '.wasm'), '-o', c], { encoding: 'utf8' });
  if (r.status !== 0) return { error: 'wasm2c: ' + log(r) };
  const main = path.join(dir, mod.id + '.main.c');
  fs.writeFileSync(main, `#include <stdio.h>
#include <stdlib.h>
#include "${mod.id}.h"
int main(int argc, char **argv) {
  int calls = atoi(argv[1]), k = atoi(argv[2]);
  wasm_rt_init();
  w2c_bench inst;
  wasm2c_bench_instantiate(&inst);
  u32 r = 0;
  for (int i = 0; i < calls; i++) r = w2c_bench_run(&inst, (u32)k);
  printf("CHECKSUM %u\\n", r);
  wasm2c_bench_free(&inst);
  wasm_rt_free();
  return 0;
}
`);
  // a source checkout has wasm2c/; a release tarball has share/wabt/wasm2c/
  // for the runtime and include/ for its headers
  const rt = [path.join(BIN.wabt, 'wasm2c'), path.join(BIN.wabt, 'share/wabt/wasm2c')].find((d) => fs.existsSync(path.join(d, 'wasm-rt-impl.c')));
  if (!rt) return { error: 'wasm2c runtime sources not found under ' + BIN.wabt };
  const srcs = ['wasm-rt-impl.c', 'wasm-rt-mem-impl.c'].map((f) => path.join(rt, f)).filter((f) => fs.existsSync(f));
  const inc = ['-I', rt, '-I', path.join(BIN.wabt, 'include'), '-I', dir];
  if (process.env.SIMDE_INC) inc.push('-I', process.env.SIMDE_INC);
  r = spawnSync(process.env.CC || 'cc', ['-O2', ...inc, main, c, ...srcs, '-o', exe, '-lm', '-lpthread'], { encoding: 'utf8' });
  if (r.status !== 0) return { error: 'cc: ' + log(r) };
  return { exe };
}

// One measurement: returns { cpuUs, checksum, error }.
function measure(engine, mod, modsDir, work, calls, k) {
  const wasm = path.join(modsDir, mod.id + '.wasm');
  let cmd;
  if (JS_SHELL_ENGINES[engine]) {
    const E = JS_SHELL_ENGINES[engine];
    cmd = [BIN[E.bin], ...E.flags, path.join(HERE, 'driver.js'), ...(E.dashdash ? ['--'] : []), wasm, String(calls), String(k)];
  } else if (CLI_ENGINES[engine]) {
    cmd = [BIN[CLI_ENGINES[engine].bin], ...CLI_ENGINES[engine].argv(wasm, calls * k, mod)];
  } else if (engine === 'wasm2c') {
    const b = buildWasm2c(mod, modsDir, work);
    if (b.error) return { error: b.error };
    cmd = [b.exe, String(calls), String(k)];
  }
  const r = spawnSync(cpurunPath(work), cmd, { encoding: 'utf8', maxBuffer: 1 << 24, timeout: 600000 });
  const err = r.stderr || '';
  const m = /CPURUN (\d+) (\d+) (\d+)\s*$/.exec(err);
  if (!m) return { error: 'no CPURUN line: ' + err.slice(-300) };
  const status = +m[3];
  const outText = (r.stdout || '');
  let checksum = null;
  const cm = /CHECKSUM (\d+)/.exec(outText);
  const wm = /Result:\s*(-?\d+)/.exec(outText + err);   // wasm3 prints to stderr
  if (cm) checksum = +cm[1];
  else if (wm && status === 0) checksum = Number(BigInt.asUintN(32, BigInt(wm[1])));
  else {
    // CLI runtimes print the i32 result in their own format; take the last
    // integer on stdout and normalise to u32.
    const nums = outText.match(/-?\d+/g);
    if (nums && status === 0) checksum = Number(BigInt.asUintN(32, BigInt(nums[nums.length - 1])));
  }
  if (status !== 0 || checksum === null) {
    const why = (err.replace(/CPURUN.*$/, '') + outText).trim().split('\n').filter(Boolean);
    return { error: `exit ${status}: ` + (why.slice(-3).join(' | ') || '?').slice(0, 400) };
  }
  return { cpuUs: +m[1] + +m[2], checksum };
}

function loadManifest(modsDir) {
  let mods = JSON.parse(fs.readFileSync(path.join(modsDir, 'manifest.json'), 'utf8'));
  if (args.families) { const f = String(args.families).split(','); mods = mods.filter((m) => f.includes(m.family)); }
  if (args.programs) { const f = String(args.programs).split(','); mods = mods.filter((m) => f.includes(`${m.family}.${m.program}`)); }
  return mods;
}
function selectedEngines() {
  const want = args.engines ? String(args.engines).split(',') : ALL_ENGINES;
  return want.filter((e) => {
    if (!ALL_ENGINES.includes(e)) { console.error(`unknown engine ${e}`); process.exit(1); }
    if (!engineAvailable(e)) { console.error(`engine ${e}: not found, skipped`); return false; }
    return true;
  });
}
const progKey = (m) => `${m.family}.${m.program}`;
const median = (a) => { const s = a.slice().sort((x, y) => x - y); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };

function check(modsDir, outDir, work) {
  const mods = loadManifest(modsDir);
  const sel = selectedEngines();
  // --merge: re-check only the selected engines, keep the others' results
  const prevPath = path.join(outDir, 'check.json');
  const res = args.merge && fs.existsSync(prevPath) ? JSON.parse(fs.readFileSync(prevPath, 'utf8')) : { engines: {}, results: {} };
  for (const e of sel) res.engines[e] = versionOf(e);
  for (const r of Object.values(res.results)) if (r.error && /^WRONG RESULT/.test(r.error)) { delete r.error; }
  const engines = Object.keys(res.engines);
  for (const e of sel) {
    for (const m of mods) {
      const r = measure(e, m, modsDir, work, 3, Math.max(1, Math.round(m.kPerCall / 16)));
      res.results[`${m.id}|${e}`] = r;
      process.stdout.write(`${e.padEnd(18)} ${m.id.padEnd(40)} ${r.error ? 'ERR ' + r.error.slice(0, 120) : r.checksum}\n`);
    }
  }
  // Agreement: within a program every variant on every engine must return
  // the same checksum. The value most (variant, engine) pairs return is the
  // reference; a pair that differs is a WRONG RESULT -- recorded as an error
  // (so it is never timed) and listed in check.json `mismatches`. With
  // --strict any mismatch also fails the run. A disagreement among many
  // engines points at the generator; one engine alone points at that engine.
  const bad = [];
  const byProg = {};
  for (const m of mods) (byProg[progKey(m)] ||= []).push(m);
  for (const [pk, ms] of Object.entries(byProg)) {
    const counts = new Map();
    for (const m of ms) for (const e of engines) {
      const r = res.results[`${m.id}|${e}`];
      if (r && !r.error) counts.set(r.checksum, (counts.get(r.checksum) || 0) + 1);
    }
    const ref = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!ref) continue;
    for (const m of ms) for (const e of engines) {
      const r = res.results[`${m.id}|${e}`];
      if (r && !r.error && r.checksum !== ref[0]) {
        bad.push({ program: pk, id: m.id, engine: e, got: r.checksum, reference: ref[0], referenceVotes: ref[1] });
        r.error = `WRONG RESULT: checksum ${r.checksum}, reference ${ref[0]}`;
      }
    }
  }
  res.mismatches = bad;
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'check.json'), JSON.stringify(res, null, 1));
  if (bad.length) console.error('CHECKSUM MISMATCH:\n' + JSON.stringify(bad, null, 1));
  console.log(`${Object.keys(byProg).length} programs x ${engines.length} engines; ${bad.length} wrong results`);
  if (bad.length && args.strict) process.exit(1);
}

function timing(modsDir, outDir, work) {
  const mods = loadManifest(modsDir);
  const engines = selectedEngines();
  const chk = JSON.parse(fs.readFileSync(path.join(outDir, 'check.json'), 'utf8'));
  const ok = (m, e) => { const r = chk.results[`${m.id}|${e}`]; return r && !r.error; };
  const reps = +(args.reps || 5), target = +(args['target-sec'] || 0.3);
  const byProg = {};
  for (const m of mods) (byProg[progKey(m)] ||= []).push(m);
  const timingPath = path.join(outDir, 'timing.json');
  const T = fs.existsSync(timingPath) && !args.fresh ? JSON.parse(fs.readFileSync(timingPath, 'utf8')) : { calib: {}, samples: {}, started: new Date().toISOString(), host: hostInfo() };
  const save = () => fs.writeFileSync(timingPath, JSON.stringify(T));
  // calibration on the control
  for (const [pk, ms] of Object.entries(byProg)) {
    const ctl = ms.find((m) => m.control);
    for (const e of engines) {
      const ck = `${pk}|${e}`;
      if (T.calib[ck] || !ok(ctl, e)) continue;
      const k = ctl.kPerCall;
      const a = measure(e, ctl, modsDir, work, 1, k), b = measure(e, ctl, modsDir, work, 5, k);
      if (a.error || b.error) { T.calib[ck] = { error: a.error || b.error }; continue; }
      let per = (b.cpuUs - a.cpuUs) / 4 / 1e6;
      if (!(per > 0)) per = b.cpuUs / 5 / 1e6;
      // A 1-vs-5-call estimate runs before an engine tiers up (JSC BBQ->OMG,
      // node Liftoff->TurboFan), so it can be 100x too slow and give a
      // big-small difference lost in process-start noise. Re-measure the
      // actual big/small pair and rescale until cpu(big)-cpu(small) is close
      // to 0.8*target. run(n)'s n is an i32, so calls*k stays below 2^31.
      const maxCalls = Math.min(1000000, Math.floor(0x7fffffff / k));
      const clamp = (n) => Math.min(maxCalls, Math.max(5, Math.round(n)));
      let big = clamp(target / per), diff = 0;
      const want = 0.8 * target;
      for (let it = 0; it < 5; it++) {
        const sm = Math.max(1, Math.round(big / 5));
        const B = measure(e, ctl, modsDir, work, big, k), Sm = measure(e, ctl, modsDir, work, sm, k);
        if (B.error || Sm.error) break;
        diff = (B.cpuUs - Sm.cpuUs) / 1e6;
        if (diff >= 0.6 * want && diff <= 2 * want) break;
        const nb = clamp(diff > 0.002 ? big * want / diff : big * 8);
        if (nb === big) break;
        big = nb;
      }
      T.calib[ck] = { k, big, small: Math.max(1, Math.round(big / 5)), perCallSec: per, calibDiffSec: diff };
      console.log(`calib ${ck}: ${(per * 1e3).toFixed(2)} ms/call (1v5) -> big ${big}, big-small ${diff.toFixed(3)} s`);
      save();
    }
  }
  for (let rep = 0; rep < reps; rep++) {
    console.log(`rep ${rep + 1}/${reps}  load ${os.loadavg().map((x) => x.toFixed(2)).join(' ')}`);
    for (const [pk, ms] of Object.entries(byProg)) {
      for (const e of engines) {
        const cal = T.calib[`${pk}|${e}`];
        if (!cal || cal.error) continue;
        const rot = ms.map((_, i) => ms[(i + rep) % ms.length]);
        for (const m of rot) {
          if (!ok(m, e)) continue;
          const sk = `${m.id}|${e}`;
          const arr = (T.samples[sk] ||= []);
          if (arr.length > rep) continue;
          const order = rep % 2 ? ['small', 'big'] : ['big', 'small'];
          const got = {};
          for (const which of order) got[which] = measure(e, m, modsDir, work, cal[which], cal.k);
          if (got.big.error || got.small.error) { arr.push({ error: got.big.error || got.small.error }); continue; }
          const ops = (cal.big - cal.small) * cal.k * m.opsPerIter;
          arr.push({ big: got.big.cpuUs, small: got.small.cpuUs, nsPerOp: (got.big.cpuUs - got.small.cpuUs) * 1000 / ops, checksum: got.big.checksum });
        }
        save();
      }
    }
  }
  T.finished = new Date().toISOString();
  save();
  summarize(mods, engines, T, outDir);
}

function summarize(mods, engines, T, outDir) {
  const rows = [];
  for (const m of mods) {
    for (const e of engines) {
      const s = (T.samples[`${m.id}|${e}`] || []).filter((x) => !x.error);
      if (!s.length) continue;
      const ns = s.map((x) => x.nsPerOp);
      rows.push({ id: m.id, family: m.family, program: m.program, variant: m.variant, control: m.control, copyOf: m.copyOf, engine: e, n: ns.length, median: median(ns), min: Math.min(...ns), max: Math.max(...ns) });
    }
  }
  for (const r of rows) {
    const ctl = rows.find((x) => x.family === r.family && x.program === r.program && x.control && x.engine === r.engine);
    if (ctl) { r.ratio = r.median / ctl.median; r.ratioMin = r.min / ctl.median; r.ratioMax = r.max / ctl.median; }
  }
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify({ host: T.host, rows }, null, 1));
  console.log(`summary: ${rows.length} rows -> ${path.join(outDir, 'summary.json')}`);
}

function hostInfo() {
  return { hostname: os.hostname(), arch: process.arch, cpus: os.cpus()[0] && os.cpus()[0].model, ncpu: os.cpus().length, platform: process.platform, release: os.release() };
}

function main() {
  if (args['engines-only']) {
    for (const e of ALL_ENGINES) console.log(`${e.padEnd(18)} ${engineAvailable(e) ? versionOf(e) : 'NOT FOUND'}`);
    return;
  }
  const modsDir = path.resolve(args.mods || 'scratch/wat-microbench/mods');
  const outDir = path.resolve(args.out || path.join(modsDir, '..', 'results'));
  const work = path.resolve(args.work || path.join(outDir, 'work'));
  fs.mkdirSync(work, { recursive: true });
  if (args.check) return check(modsDir, outDir, work);
  if (args.summarize) {
    const T = JSON.parse(fs.readFileSync(path.join(outDir, 'timing.json'), 'utf8'));
    // engines come from the recorded samples, so a summary can be made on a
    // machine that lacks the engines that produced them
    const recorded = [...new Set(Object.keys(T.samples).map((k) => k.split('|')[1]))];
    const want = args.engines ? String(args.engines).split(',') : ALL_ENGINES;
    return summarize(loadManifest(modsDir), want.filter((e) => recorded.includes(e)), T, outDir);
  }
  return timing(modsDir, outDir, work);
}

main();
