#!/usr/bin/env node
// Which registry apps crash on launch, and on what?
//
// One short headless run per lib/apps.js id, strictly one at a time, each
// classified from run.js's own output into a crash *signature*:
//
//   unimpl:<API>      an API handler hit $crash_unimplemented
//   trap:<message>    a WASM trap / JS exception escaped a batch (*** CRASH)
//   error:<message>   run.js died before or outside the batch loop
//   timeout           the run outlived --seconds + grace (a batch never returned)
//   exit:<code>       the guest called ExitProcess before the deadline
//   stuck             run.js's idle detector ended the run (waiting on input)
//   missing-files     the registry names files this checkout does not have
//   missing-dep:<pkg> run.js needs an uninstalled devDependency for this app
//   ok                still running at the deadline
//
// The summary ranks signatures by how many apps share them, which is the work
// list: one missing API that stops nine apps is worth more than nine bespoke
// traps. startup-modal-sweep.js answers a different question (what is behind
// the first message box) and runs each app twice; this runs each once.
//
// Results are appended to --jsonl as each run finishes, so an interrupted
// sweep resumes where it stopped (id+mode pairs already in the file are
// skipped).
//
// DUAL MODE. Every game must work under the cooperative scheduler AND with
// real guest threads, and the two break differently (a Worker that traps, a
// repaint that only one scheduler delivers, a sound thread starved in one).
// --modes=coop,threads runs each app once per mode (run.js --no-threads /
// --threads) and records, beside the signature, two signals no signature
// can see:
//   frame   the final screen (--png at exit): `content` when it has more than
//           a handful of colours and no one colour covers >98% of it, else
//           `blank`
//   audio   the raw waveOut PCM (--audio-out): `sound` when any byte differs
//           from the format's silence, `silent` when PCM arrived but was all
//           silence, `none` when nothing was written
// --compare then lists every app whose two modes disagree on any of the
// three, worst first (a crash beats a blank frame beats a missing sound), and
// --gate exits 1 when that list is non-empty: the repeatable check to run
// after a large merge.
//
// Usage:
//   node tools/crash-sweep.js --all --jsonl=out.jsonl [--seconds=20]
//   node tools/crash-sweep.js --apps=a,b --jsonl=out.jsonl
//   node tools/crash-sweep.js --all --modes=coop,threads --jobs=2 --jsonl=dual.jsonl
//   node tools/crash-sweep.js --summary --jsonl=out.jsonl [--md] [--mode=threads]
//   node tools/crash-sweep.js --compare --jsonl=dual.jsonl [--md] [--gate]
//
// Options:
//   --seconds=N      run.js --max-seconds (default 20); the external kill is N+90
//   --modes=a,b      coop and/or threads (default coop: run.js's own default)
//   --stuck-after=N  pass run.js --stuck-after (0: never end a run as stuck)
//   --min-free-mb=N  wait before each run until /proc/meminfo MemAvailable >= N MB
//   --feed=URL       fetch each app's files from tools/app-files-feed.js serve first
//                    (a boat fork has no test/binaries)
//   --jobs=N         runs at once (default 1). Each run holds a 512 MB guest;
//                    keep N small, and run long sweeps on a separate box
//   --rerun          ignore results already in --jsonl
//   --no-build       reuse build/wine-assembly.wasm (the sweep builds once first otherwise)
//   --md             print the summary / comparison as a Markdown table
//   --against=FILE   with --compare: this --jsonl (candidate build) against FILE
//                    (control build), same app and mode, instead of coop vs threads
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const RUN = path.join(ROOT, 'test', 'run.js');

const argv = process.argv.slice(2);
const flag = name => argv.includes('--' + name);
const opt = (name, dflt) => {
  const hit = argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : dflt;
};

const SECONDS = parseFloat(opt('seconds', '20')) || 20;
const JSONL = opt('jsonl', null);
if (!JSONL) {
  console.error('crash-sweep: --jsonl=FILE is required');
  process.exit(2);
}
const MODES = (opt('modes', 'coop') || 'coop').split(',').filter(Boolean);
for (const m of MODES) {
  if (m !== 'coop' && m !== 'threads') {
    console.error(`crash-sweep: unknown mode ${m} (coop, threads)`);
    process.exit(2);
  }
}
const JOBS = Math.max(1, parseInt(opt('jobs', '1'), 10) || 1);
const MODE_ARGS = { coop: '--no-threads', threads: '--threads' };
// run.js ends a run as STUCK after N batches at one EIP (default 10). A loader
// whose main thread waits on worker threads sits still that long in 0.2 s,
// so a mode comparison wants --stuck-after=0: run the full --seconds.
const STUCK_AFTER = opt('stuck-after', null);
// A boat fork has no test/binaries. --feed=URL fetches each app's registry
// files from tools/app-files-feed.js serve (reverse-forwarded into the fork)
// just before that app's first run, so the sweep needs no 30 GB copy.
const FEED = opt('feed', null);
// On a shared box, hold the next run while the machine is short of memory
// (MemAvailable below N MB): a 512 MB guest started into that gets the box,
// or this sweep, killed. Linux only; elsewhere the check never holds.
const MIN_FREE_MB = parseInt(opt('min-free-mb', '0'), 10) || 0;
function memAvailableMb() {
  try {
    const m = /MemAvailable:\s+(\d+) kB/.exec(fs.readFileSync('/proc/meminfo', 'utf8'));
    return m ? (+m[1] / 1024) | 0 : Infinity;
  } catch (_) { return Infinity; }
}
async function waitForMemory() {
  if (!MIN_FREE_MB) return;
  let said = false;
  while (memAvailableMb() < MIN_FREE_MB) {
    if (!said) { console.log(`[sweep] holding: MemAvailable ${memAvailableMb()} MB < ${MIN_FREE_MB} MB`); said = true; }
    await new Promise(r => setTimeout(r, 30000));
  }
}
const fed = new Set();
function feedApp(id) {
  if (!FEED || fed.has(id)) return;
  fed.add(id);
  const r = require('child_process').spawnSync(process.execPath,
    [path.join(ROOT, 'tools', 'app-files-feed.js'), 'fetch', `--base=${FEED}`, `--apps=${id}`],
    { cwd: ROOT, encoding: 'utf8' });
  const line = (r.stdout || '').split('\n').find(l => l.startsWith('app-files-feed:'));
  if (line) console.log(`${id} [feed]  ${line.slice('app-files-feed: '.length)}`);
}

// The last line for an id+mode wins, so a --rerun supersedes earlier results.
// Lines written before modes existed are cooperative runs.
function readResults(file = JSONL) {
  if (!fs.existsSync(file)) return [];
  const byKey = new Map();
  for (const l of fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
    const r = JSON.parse(l);
    if (!r.mode) r.mode = 'coop';
    byKey.set(`${r.id}|${r.mode}`, r);
  }
  return [...byKey.values()];
}

// Pull the signature out of a run's combined output. Order matters: an
// unimplemented API traps with `unreachable` too, and the API name is the
// useful half of that pair.
function classify(log, status, timedOut) {
  const unimpl = /=== UNIMPLEMENTED API: (.+?) ===/.exec(log);
  if (unimpl) {
    const ord = /ordinal import: (.+)/.exec(log);
    return { sig: `unimpl:${unimpl[1]}${ord ? ' ' + ord[1].trim() : ''}` };
  }
  const crash = /\*\*\* CRASH at batch (\d+): (.+)/.exec(log);
  if (crash) {
    const eip = /EIP before batch: (.+)/.exec(log);
    return {
      sig: `trap:${crash[2].trim().slice(0, 80)}`,
      batch: +crash[1],
      eip: eip ? eip[1].trim().slice(0, 80) : null,
    };
  }
  // A registry entry whose files are not on this box is an environment gap,
  // not a crash, and run.js reports it with exit status 0.
  // Only when the run never started: an app without requiredFiles that lacks
  // an optional file prints the same line and then runs normally (notepad).
  const missing = /file\(s\) not found|exe not found|code: 'ENOENT'/.exec(log);
  if (missing && !/\d+ batches in /.test(log)) return { sig: 'missing-files' };
  const dep = /require devDependency (\S+)/.exec(log);
  if (dep) return { sig: `missing-dep:${dep[1]}` };
  if (timedOut) return { sig: 'timeout' };
  const stuck = /STUCK at EIP=(0x[0-9a-f]+) after (\d+) batches/.exec(log);
  if (stuck) return { sig: 'stuck', eip: stuck[1] };
  const exit = /\[Exit\] code=(\S+)/.exec(log);
  if (exit) return { sig: `exit:${exit[1]}` };
  if (status !== 0) {
    const err = /^(?:\w*Error|Error)[: ].*$/m.exec(log) || /^.*(?:ENOENT|Cannot find|not found).*$/m.exec(log);
    return { sig: `error:${(err ? err[0] : `status ${status}`).trim().slice(0, 100)}` };
  }
  return { sig: 'ok' };
}

const LOG_DIR = fs.mkdtempSync(path.join(require('os').tmpdir(), 'crash-sweep-'));

function headTail(file, n) {
  const size = fs.statSync(file).size;
  const fd = fs.openSync(file, 'r');
  const read = (pos, len) => {
    const b = Buffer.alloc(len);
    fs.readSync(fd, b, 0, len, pos);
    return b.toString('utf8');
  };
  const out = size <= 2 * n ? read(0, size) : read(0, n) + '\n' + read(size - n, n);
  fs.closeSync(fd);
  return out;
}

// The final screen: `content` or `blank` (see the header), with the numbers.
function frameSignal(file) {
  if (!fs.existsSync(file)) return { frame: 'none' };
  let png;
  try { png = require('pngjs').PNG.sync.read(fs.readFileSync(file)); }
  catch (_) { return { frame: 'none' }; }
  const counts = new Map();
  const d = png.data;
  for (let i = 0; i < d.length; i += 4) {
    const k = (d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | (d[i + 2] >> 3);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const pixels = d.length / 4;
  const top = Math.max(...counts.values());
  const dominant = top / pixels;
  return {
    frame: counts.size > 8 && dominant <= 0.98 ? 'content' : 'blank',
    colors: counts.size,
    dominant: +dominant.toFixed(3),
  };
}

// The waveOut PCM: `sound`, `silent` or `none`. Formats differ (8-bit
// silence is 0x80, 16-bit is 0), so any byte that is neither is sound.
function audioSignal(file) {
  if (!fs.existsSync(file)) return { audio: 'none', audioBytes: 0 };
  const size = fs.statSync(file).size;
  if (!size) return { audio: 'none', audioBytes: 0 };
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(1 << 20);
  let pos = 0, loud = false;
  while (pos < size && !loud) {
    const n = fs.readSync(fd, buf, 0, buf.length, pos);
    if (!n) break;
    for (let i = 0; i < n; i++) {
      if (buf[i] !== 0 && buf[i] !== 0x80 && buf[i] !== 0x7f && buf[i] !== 0xff) { loud = true; break; }
    }
    pos += n;
  }
  fs.closeSync(fd);
  return { audio: loud ? 'sound' : 'silent', audioBytes: size };
}

function runOne(id, mode) {
  const tag = `${id}.${mode}`;
  const pngFile = path.join(LOG_DIR, `${tag}.png`);
  const pcmFile = path.join(LOG_DIR, `${tag}.pcm`);
  const args = [RUN, `--app=${id}`, MODE_ARGS[mode], '--no-build', '--quiet-api',
    `--max-seconds=${SECONDS}`, '--max-batches=1000000000',
    '--no-close', `--png=${pngFile}`, `--audio-out=${pcmFile}`,
    // A few MB answers "sound or silent"; the batch clock can render thousands
    // of guest seconds of PCM per wall second (Tile World: 2.9 GB in a 15 s
    // coop run, which filled the disk and cost the run its PNG).
    `--audio-out-max=${4 << 20}`];
  if (STUCK_AFTER !== null) args.push(`--stuck-after=${STUCK_AFTER}`);
  // run.js prints a register line per batch, so a healthy 20 s run is ~100 MB:
  // send it to a file and read back only the head and tail, which is where
  // every line classify() looks for lives.
  const logFile = path.join(LOG_DIR, `${tag}.log`);
  const fd = fs.openSync(logFile, 'w');
  const t0 = Date.now();
  return new Promise(resolve => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', fd, fd] });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, (SECONDS + 90) * 1000);
    child.on('exit', status => {
      clearTimeout(timer);
      fs.closeSync(fd);
      const log = headTail(logFile, 256 * 1024);
      const out = {
        id, mode, ...classify(log, timedOut ? null : status, timedOut),
        secs: +((Date.now() - t0) / 1000).toFixed(1),
        ...frameSignal(pngFile), ...audioSignal(pcmFile),
      };
      const batches = [...log.matchAll(/(\d+) batches in /g)].pop();
      if (batches) out.batches = +batches[1];
      const apis = /Stats: (\d+) API calls/.exec(log);
      if (apis) out.apis = +apis[1];
      for (const f of [logFile, pngFile, pcmFile]) fs.rmSync(f, { force: true });
      resolve(out);
    });
  });
}

// A signature that ends the run early, as opposed to one that just names how
// a still-healthy run stopped.
const FATAL = sig => /^(unimpl|trap|error|timeout|exit)/.test(sig);

// Disagreements between an app's two modes, worst first: a crash only one
// mode has, then a picture only one mode reached, then sound only one made.
// How two runs of one app disagree, worst first: crash, then early stop, then
// picture, then sound. `la`/`lb` name the two arms in the messages.
function diffPair(a, b, la, lb) {
    const issues = [];
    if (FATAL(a.sig) !== FATAL(b.sig) || (FATAL(a.sig) && a.sig !== b.sig)) {
      issues.push({ rank: 0, what: `crash: ${la} ${a.sig} / ${lb} ${b.sig}` });
    }
    if ((a.sig === 'stuck') !== (b.sig === 'stuck')) {
      issues.push({ rank: 1, what: `progress: ${la} ${a.sig} ${a.secs}s / ${lb} ${b.sig} ${b.secs}s` });
    }
    if (a.frame !== b.frame && (a.frame === 'content' || b.frame === 'content')) {
      // Both arms get the same wall-clock seconds, not the same work: coop and
      // --threads retire different batch counts in that time, so a blank arm is
      // often just one caught earlier in its boot. Print both counts; re-run the
      // pair at one --max-batches before calling it a bug (2026-10-06: icy_tower,
      // deus_ex_demo, dungeons_of_dredmor_release are byte-identical that way).
      const b2 = x => x.batches != null ? ` b=${x.batches}` : '';
      issues.push({ rank: 1, what: `frame: ${la} ${a.frame}${b2(a)} / ${lb} ${b.frame}${b2(b)}` });
    }
    if (a.audio !== b.audio && (a.audio === 'sound' || b.audio === 'sound')) {
      issues.push({ rank: 2, what: `audio: ${la} ${a.audio} / ${lb} ${b.audio}` });
    }
    return issues;
}

const rankRows = rows => rows.sort((x, y) => x.rank - y.rank || x.id.localeCompare(y.id));

// coop vs threads within one results file.
function compare(results) {
  const byId = new Map();
  for (const r of results) {
    if (!byId.has(r.id)) byId.set(r.id, {});
    byId.get(r.id)[r.mode] = r;
  }
  const rows = [];
  for (const [id, m] of byId) {
    const a = m.coop, b = m.threads;
    if (!a || !b || a.sig === 'missing-files' || b.sig === 'missing-files') continue;
    const issues = diffPair(a, b, 'coop', 'threads');
    if (issues.length) rows.push({ id, rank: Math.min(...issues.map(i => i.rank)), issues, a, b });
  }
  return rankRows(rows);
}

// One build against another (--against=CONTROL.jsonl): the same app in the
// same mode, control first. This is the check for a change that touches every
// app at once -- a memory-map change, say -- where coop vs threads is not the
// question but "did anything that used to work stop working".
function compareBuilds(control, candidate) {
  const ctl = new Map(control.map(r => [`${r.id}|${r.mode}`, r]));
  const rows = [];
  let pairs = 0;
  for (const b of candidate) {
    const a = ctl.get(`${b.id}|${b.mode}`);
    if (!a || a.sig === 'missing-files' || b.sig === 'missing-files') continue;
    pairs++;
    const issues = diffPair(a, b, 'control', 'candidate');
    if (issues.length) rows.push({ id: `${b.id} [${b.mode}]`, rank: Math.min(...issues.map(i => i.rank)), issues, a, b });
  }
  return { rows: rankRows(rows), pairs };
}

function summary(results, md) {
  const bySig = new Map();
  const only = opt('mode', null);
  for (const r of results) {
    if (only && r.mode !== only) continue;
    const key = r.sig.startsWith('exit:') ? r.sig : r.sig;
    if (!bySig.has(key)) bySig.set(key, []);
    bySig.get(key).push(r.id);
  }
  const rows = [...bySig].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  if (md) {
    console.log('| # | signature | apps |');
    console.log('|---:|---|---|');
    for (const [sig, ids] of rows) console.log(`| ${ids.length} | \`${sig.replace(/\|/g, '\\|')}\` | ${ids.join(', ')} |`);
  } else {
    for (const [sig, ids] of rows) console.log(`${String(ids.length).padStart(4)}  ${sig}\n      ${ids.join(' ')}`);
  }
}

if (flag('summary')) {
  summary(readResults(), flag('md'));
  process.exit(0);
}

if (flag('compare')) {
  const results = readResults();
  const against = opt('against', null);
  let rows, pairs, heads = ['coop', 'threads'];
  if (against) {
    ({ rows, pairs } = compareBuilds(readResults(against), results));
    heads = ['control', 'candidate'];
  } else {
    rows = compare(results);
    const both = new Set(results.filter(r => r.mode === 'threads').map(r => r.id));
    pairs = results.filter(r => r.mode === 'coop' && both.has(r.id)).length;
  }
  if (flag('md')) {
    console.log(`| app | divergence | ${heads[0]} | ${heads[1]} |`);
    console.log('|---|---|---|---|');
    for (const r of rows) {
      const cell = x => `${x.sig} / ${x.frame} / ${x.audio}${x.batches != null ? ` / b=${x.batches}` : ''}`.replace(/\|/g, '\\|');
      console.log(`| ${r.id} | ${r.issues.map(i => i.what.split(':')[0]).join(', ')} | ${cell(r.a)} | ${cell(r.b)} |`);
    }
  } else {
    for (const r of rows) console.log(`${r.id}\n  ${r.issues.map(i => i.what).join('\n  ')}`);
  }
  console.log(against ? `\n${rows.length} of ${pairs} app/mode runs differ from the control (${against})`
    : `\n${rows.length} of ${pairs} apps run in both modes disagree`);
  process.exit(flag('gate') && rows.length ? 1 : 0);
}

const { APPS } = require('../lib/apps');
let ids = flag('all') ? Object.keys(APPS)
  : (opt('apps', '') || '').split(',').filter(Boolean);
const unknown = ids.filter(id => !APPS[id]);
if (unknown.length) {
  console.error(`crash-sweep: unknown app id(s): ${unknown.join(', ')}`);
  process.exit(2);
}
let work = [];
for (const id of ids) for (const mode of MODES) work.push({ id, mode });
if (!flag('rerun')) {
  const done = new Set(readResults().map(r => `${r.id}|${r.mode}`));
  work = work.filter(w => !done.has(`${w.id}|${w.mode}`));
}
if (!flag('no-build')) execFileSync('bash', [path.join(ROOT, 'tools', 'build.sh')], { cwd: ROOT, stdio: 'ignore' });

(async () => {
  let next = 0;
  const worker = async () => {
    while (next < work.length) {
      const { id, mode } = work[next++];
      await waitForMemory();
      feedApp(id);
      const r = await runOne(id, mode);
      fs.appendFileSync(JSONL, JSON.stringify(r) + '\n');
      console.log(`${id} [${mode}]  ${r.sig}  ${r.frame}/${r.audio}  ${r.secs}s` +
        `${r.batches != null ? '  b=' + r.batches : ''}`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(JOBS, work.length) }, worker));
  fs.rmSync(LOG_DIR, { recursive: true, force: true });
})();
