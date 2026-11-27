#!/usr/bin/env node
'use strict';
// tl;dr: stack-audit corpus sweep, ONE run at a time on a box (refuses to run
// on a non box-node host).
//
//   node sweep.js --out=DIR --reps=N --apps=a,b --arms=m,off,off2,all [--calib=SECONDS] [--dry]
//
// Each run: /usr/bin/time -v perf stat -x, -e instructions:u,cycles:u,branch-misses:u
//   -- taskset -c 1-3 node test/run.js --no-build --branch-clock <app args> <arm flags>
// Fixed work: --max-batches from APPS[app].b (calibrated with --calib, which
// instead runs the 'off' arm once per app with --max-seconds=SECONDS and prints
// the batches it reached). Per round every arm runs once per app, arm order
// rotated by round and reversed on odd rounds. One JSON line per run in
// DIR/results.jsonl (a finished tag is skipped on restart): user/sys CPU,
// perf counters, max RSS, Stats line (API calls, batches), end-PNG sha, the
// uop ledger lines and a startup --cpu-window over the first fifth of the run.
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawnSync, execFileSync } = require('child_process');

if (!/^(box-node-|fast-near-3tb-1$)/.test(os.hostname())) { console.error('not a box: ' + os.hostname()); process.exit(3); }
const arg = (n, d) => { const h = process.argv.find(a => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : d; };
const HOME = os.homedir();
const BASE = arg('base', HOME);
const B = n => path.join(BASE, n);
const out = path.resolve(arg('out', B('sweep')));
fs.mkdirSync(out, { recursive: true });

const ALL = ['--uop-opt=0xffff', '--gm-fold=0x1F', '--uop-sse', '--uop-sse-native', '--uop-retry-ladder=15'];
const without = (drop, add = []) => ALL.filter(f => !drop.some(d => f.startsWith(d))).concat(add);
const ARMS = {
  m: [B('m'), []],                                   // origin/main f60235c94, its defaults
  off: [B('s'), ['--uop-opt=0', '--gm-fold=0', '--no-fpu-direct']],
  off2: [B('s'), ['--uop-opt=0', '--gm-fold=0', '--no-fpu-direct']],
  all: [B('s'), ALL],
  all2: [B('s'), ALL],
  def: [B('s'), []],                                 // branch defaults (gm-fold 0x1F, fpu-direct on, uop-opt 0)
  // leave-one-out from ALL
  lUo: [B('s'), without(['--uop-opt'], ['--uop-opt=0'])],
  lU7: [B('s'), without(['--uop-opt'], ['--uop-opt=0x7fff'])],
  lGm: [B('s'), without(['--gm-fold'], ['--gm-fold=0'])],
  lSse: [B('s'), without(['--uop-sse'])],
  lLad: [B('s'), without(['--uop-retry-ladder'], ['--uop-retry-ladder=7'])],
  lFd: [B('s'), ALL.concat(['--no-fpu-direct'])],
  lDf: [B('s'), ALL.concat(['--no-delphi-fold'])],
  pLazy: [B('s'), ALL.concat(['--uop-reguard-lazy'])],
  // decomposition (coordinator): compiled tier opt mask x Delphi fold x GM fold; fpu-direct and SSE at branch defaults
  dA: [B('s'), ['--uop-opt=0', '--no-delphi-fold', '--gm-fold=0']],
  dA2: [B('s'), ['--uop-opt=0', '--no-delphi-fold', '--gm-fold=0']],
  dB: [B('s'), ['--uop-opt=0', '--gm-fold=0']],
  dC: [B('s'), ['--uop-opt=0', '--no-delphi-fold', '--gm-fold=0x1F']],
  dD: [B('s'), ['--uop-opt=0xffff', '--no-delphi-fold', '--gm-fold=0']],
  dE: [B('s'), ['--uop-opt=0', '--gm-fold=0x1F']],
  dF: [B('s'), ['--uop-opt=0xffff', '--gm-fold=0']],
  dG: [B('s'), ['--uop-opt=0xffff', '--gm-fold=0x1F']],
  dDs: [B('s'), ['--uop-opt=0xffff', '--no-delphi-fold', '--gm-fold=0', '--uop-sse', '--uop-sse-native']],
  dGs: [B('s'), ['--uop-opt=0xffff', '--gm-fold=0x1F', '--uop-sse', '--uop-sse-native']],
  // the compiled tier itself off (interpreter only), without and with the folds
  dZ: [B('s'), ['--no-uop', '--no-delphi-fold', '--gm-fold=0']],
  dZE: [B('s'), ['--no-uop', '--gm-fold=0x1F']],
};
const genClassic = path.join(__dirname, 'gen-input-classic.js');
const SC_INPUT = ['100:focus-main-window', '120:keydown:27', '125:keyup:27', '300:keydown:27', '305:keyup:27',
  '600:keydown:27', '605:keyup:27', '900:keydown:13', '905:keyup:13', '1200:keydown:27', '1205:keyup:27',
  '4400:mousemove:545:393', '4410:mousedown:545:393', '4420:mouseup:545:393',
  '4800:mousemove:198:261', '4810:mousedown:198:261', '4820:mouseup:198:261'].join(',');
const COMMON = ['--quiet-api', '--stuck-after=0', '--no-close'];
// b = fixed batches (calibrated on the box); args = app-specific
const APPS = JSON.parse(fs.readFileSync(path.join(__dirname, 'apps.json'), 'utf8'));
const inputFor = a => a.input === 'classic' ? execFileSync(process.execPath, [genClassic, String(a.cycles || 6)], { encoding: 'utf8' }).trim()
  : a.input === 'spelhd' ? fs.readFileSync(path.join(__dirname, 'spelhd-input.txt'), 'utf8').trim()
  : a.input === 'sc' ? SC_INPUT : a.input || null;

const appList = arg('apps', Object.keys(APPS).join(',')).split(',').filter(Boolean);
const armList = arg('arms', 'm,off,off2,all').split(',').filter(Boolean);
const reps = +arg('reps', '5');
const calib = arg('calib', null);
const shard = arg('shard', null), [shI, shN] = shard ? shard.split('/').map(Number) : [0, 1];
const resFile = path.join(out, calib ? 'calib.jsonl' : shard ? `results-${shI}.jsonl` : 'results.jsonl');
const NOPERF = process.argv.includes('--noperf'), CPUS = arg('cpu', '1-3');
const done = new Set(fs.existsSync(resFile) ? fs.readFileSync(resFile, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l).tag) : []);

// u0xMASK: the full stack with --uop-opt=MASK (per-bit bisect of the opt mask)
const armFor = n => ARMS[n] || (/^u0x[0-9a-f]+$/i.test(n) ? [B('s'), without(['--uop-opt'], [`--uop-opt=${n.slice(1)}`])] : null);
function runOne(app, armName, rep) {
  const tag = `${app}-${armName}-r${rep}`;
  if (done.has(tag)) return;
  const a = APPS[app]; const [root, extra] = armFor(armName);
  const d = path.join(out, app); fs.mkdirSync(d, { recursive: true });
  const log = path.join(d, `${armName}-r${rep}.log`), png = path.join(d, `${armName}-r${rep}.png`), pf = path.join(d, `${armName}-r${rep}.perf`);
  const input = inputFor(a);
  const work = calib ? [`--max-seconds=${calib}`, '--max-batches=1000000000'] : [`--max-batches=${a.b}`, `--cpu-window=${a.win || '0:' + Math.max(1, Math.floor(a.b / 5))}`];
  const runArgs = ['test/run.js', '--no-build', ...a.args, ...COMMON, ...work, ...(a.noBranchClock ? [] : ['--branch-clock']), ...extra,
    ...(input ? [`--input=${input}`] : []), `--png=${png}`];
  const argv = ['-v', ...(NOPERF ? [] : ['perf', 'stat', '-x,', '-o', pf, '-e', 'instructions:u,cycles:u,branch-misses:u', '--']),
    'taskset', '-c', CPUS, process.execPath, ...runArgs];
  if (process.argv.includes('--dry')) { console.log(root, runArgs.join(' ').slice(0, 400)); return; }
  const load0 = os.loadavg()[0], t0 = Date.now();
  const p = spawnSync('/usr/bin/time', argv, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 30, timeout: (+arg('timeout', '1500')) * 1000 });
  const text = (p.stdout || '') + (p.stderr || '');
  fs.writeFileSync(log, `argv: ${runArgs.join(' ')}\nexit: ${p.status} ${p.signal}\n` + text);
  const num = re => { const m = text.match(re); return m ? +m[1] : null; };
  const perf = {};
  try {
    for (const l of fs.readFileSync(pf, 'utf8').split('\n')) {
      const c = l.split(','); if (c.length > 3 && /^\d+$/.test(c[0])) perf[c[2].replace(/:u$/, '')] = +c[0];
    }
  } catch (_) {}
  const stats = (text.match(/^Stats: (\d+) API calls, (\d+) batches/m) || []);
  const win = text.match(/\[cpu-window\] batches (\d+)\.\.(\d+|run end[^:]*): user ([\d.]+)s/);
  const wins = [...text.matchAll(/\[cpu-window\] batches (\d+)\.\.(\d+|run end[^:]*): user ([\d.]+)s sys ([\d.]+)s/g)].map(m => ({ start: +m[1], end: m[2], user: +m[3], sys: +m[4] }));
  const pick = re => (text.match(re) || [''])[0];
  const crash = pick(/^(UNIMPLEMENTED|.*unreachable|RuntimeError.*|.*\bTRAP\b.*|\[crash\].*)$/m);
  const rec = {
    tag, app, arm: armName, rep, root, extra, cpus: CPUS, host: os.hostname(), code: p.status, signal: p.signal,
    wall: (Date.now() - t0) / 1000, load0, load1: os.loadavg()[0],
    user: num(/User time \(seconds\): ([\d.]+)/), sys: num(/System time \(seconds\): ([\d.]+)/),
    rssKB: num(/Maximum resident set size \(kbytes\): (\d+)/),
    ins: perf.instructions ?? null, cyc: perf.cycles ?? null, bmiss: perf['branch-misses'] ?? null,
    api: stats[1] ? +stats[1] : null, batches: stats[2] ? +stats[2] : null,
    startUser: win ? +win[3] : null,
    sha: fs.existsSync(png) ? crypto.createHash('sha256').update(fs.readFileSync(png)).digest('hex').slice(0, 16) : null,
    uop: pick(/^uop: .*$/m), opt: pick(/^uop opt: .*$/m), ladder: pick(/^uop ladder: .*$/m),
    declines: pick(/^ {2}declines: .*$/m), gm: pick(/^GM fold[^\n]*$/m), delphi: pick(/^Delphi fold[^\n]*$/m), wins, crash,
  };
  fs.appendFileSync(resFile, JSON.stringify(rec) + '\n');
  try { execFileSync('gzip', ['-f', log]); } catch (_) {}
  console.log(`${tag.padEnd(34)} rc=${rec.code} user=${rec.user} ins=${rec.ins} api=${rec.api} b=${rec.batches} sha=${rec.sha} load=${load0.toFixed(2)} wall=${rec.wall.toFixed(0)}`);
}

if (calib) { for (const app of appList) runOne(app, 'off', 0); console.log('ALLDONE'); process.exit(0); }
for (let r = 0; r < reps; r++) {
  if (r % shN !== shI) continue;
  for (const app of appList) {
    const order = armList.map((_, i) => armList[(i + r) % armList.length]);
    if (r % 2) order.reverse();
    for (const a of order) runOne(app, a, r);
  }
}
console.log('ALLDONE');
