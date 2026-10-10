#!/usr/bin/env node
'use strict';
// Did anything in the registry start crashing? One bounded launch per
// lib/apps.js id, executor default arm, compared with a previous sweep's
// matching run (default: docs/block-executor-design/sweep-2026-09-15.json,
// its off@300 arm) so each row says NEW CRASH, STILL CRASH, FIXED or OK.
//
// It is the cheap sibling of tools/block-exec-sweep.js: one run per app
// instead of four, with the same run.js flags and the same crash test, so
// its result is comparable to that sweep's off arm at the same budget.
//
// Usage:
//   node tools/registry-crash-sweep.js --out=DIR [--apps=a,b] [--skip=a,b]
//     [--budget=300] [--batch-size=20000] [--seconds=90] [--timeout=150]
//     [--baseline=FILE] [--limit=N]
//
// Resumable: an app whose DIR/<id>.log already exists is not run again, so a
// long sweep can be done in bounded chunks (--limit=N runs at most N apps).
// Writes DIR/result.json (machine-readable) and DIR/table.md.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { APPS } = require('../lib/apps');

const ROOT = path.resolve(__dirname, '..');
const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const OUT = path.resolve(arg('out', ''));
if (!arg('out', '')) { console.error('usage: --out=DIR is required'); process.exit(2); }
const BUDGET = Number(arg('budget', 300));
const BATCH_SIZE = Number(arg('batch-size', 20000));
const SECONDS = Number(arg('seconds', 90));
const TIMEOUT = Number(arg('timeout', 150));
const LIMIT = Number(arg('limit', Infinity));
const BASELINE = path.resolve(ROOT, arg('baseline', 'docs/block-executor-design/sweep-2026-09-15.json'));
// Same non-starters block-exec-sweep.js leaves out, plus the bigMemory apps:
// a launch of those asks for a 2 GB memory and is a heavy run, not a check.
const SKIP = {
  mshearts16: 'LAN app, needs a peer process',
  liquid_war: 'LAN app, needs a peer process',
  liquid_war_server: 'LAN app, needs a peer process',
  tetrinet: 'LAN app, needs a peer process',
  ut2003_demo_server: 'listen server, needs a peer process',
  explorer98: 'SHELL32 QT_Thunk path, no NE thunk binding',
};
for (const [id, app] of Object.entries(APPS)) if (app && app.bigMemory) SKIP[id] = 'bigMemory app (heavy run)';
for (const id of arg('skip', '').split(',').filter(Boolean)) SKIP[id] = 'skipped on the command line';
const CRASH = /UNIMPLEMENTED API|unreachable|RuntimeError|\bCRASH\b/;

const only = arg('apps', '').split(',').filter(Boolean);
const ids = (only.length ? only : Object.keys(APPS)).filter(id => !SKIP[id]);
let baseline = new Map();
try {
  for (const r of JSON.parse(fs.readFileSync(BASELINE, 'utf8')).results) {
    const run = r.runs && (r.runs[`off${BUDGET}`] || r.runs.off300);
    if (run) baseline.set(r.id, { crash: !!run.crash, crashLine: run.crashLine || null, painted: !!run.painted });
  }
} catch (_) { baseline = new Map(); }

function runOne(id) {
  const png = path.join(OUT, `${id}.png`), log = path.join(OUT, `${id}.log`);
  const args = [String(TIMEOUT), 'node', 'test/run.js', `--app=${id}`, '--no-build',
    `--batch-size=${BATCH_SIZE}`, `--max-batches=${BUDGET}`, `--max-seconds=${SECONDS}`,
    '--stuck-after=1000000', '--quiet-api', '--quiet-blocks', '--no-close', `--png=${png}`];
  return new Promise(resolve => {
    execFile('timeout', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }, (err, stdout, stderr) => {
      const out = String(stdout || '') + String(stderr || '');
      fs.writeFileSync(log, out + `\n[sweep] exit=${err ? (err.code == null ? -1 : err.code) : 0}\n`);
      resolve();
    });
  });
}

function readResult(id) {
  const log = path.join(OUT, `${id}.log`);
  const out = fs.readFileSync(log, 'utf8');
  const code = Number((/\[sweep\] exit=(-?\d+)/.exec(out) || [])[1]);
  const crashLine = (out.split('\n').find(l => CRASH.test(l)) || '').trim().slice(0, 240) || null;
  let reached = null;
  for (const m of out.matchAll(/(\d+) batches in /g)) reached = Number(m[1]);
  const before = baseline.get(id) || null;
  const crash = !!crashLine;
  const timedOut = code === 124 || code === 137;
  // A launch that never reached a batch because an app file is absent on
  // this machine is a fixture gap, not a verdict about the emulator.
  const noFixture = reached === null && /ENOENT/.test(out);
  const status = crash ? (before ? (before.crash ? 'STILL CRASH' : 'NEW CRASH') : 'CRASH (no baseline)')
    : noFixture ? 'NO FIXTURE'
    : timedOut ? 'TIMEOUT'
    : before && before.crash ? 'FIXED' : 'OK';
  return { id, status, code, reached, painted: fs.existsSync(path.join(OUT, `${id}.png`)),
    crashLine, baseline: before };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  let ran = 0;
  for (const id of ids) {
    if (fs.existsSync(path.join(OUT, `${id}.log`))) continue;
    if (ran >= LIMIT) break;
    process.stdout.write(`[${ids.indexOf(id) + 1}/${ids.length}] ${id} ... `);
    await runOne(id); ran++;
    const r = readResult(id);
    console.log(`${r.status}${r.crashLine ? ' -- ' + r.crashLine.slice(0, 120) : ''}`);
  }
  const results = ids.filter(id => fs.existsSync(path.join(OUT, `${id}.log`))).map(readResult);
  const counts = {};
  for (const r of results) counts[r.status] = (counts[r.status] || 0) + 1;
  const pending = ids.length - results.length;
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({
    generated: new Date().toISOString(), budget: BUDGET, batchSize: BATCH_SIZE, seconds: SECONDS,
    baseline: path.relative(ROOT, BASELINE), counts, pending,
    skipped: Object.entries(SKIP).filter(([id]) => APPS[id]).map(([id, why]) => ({ id, why })), results }, null, 1));
  const order = ['NEW CRASH', 'CRASH (no baseline)', 'TIMEOUT', 'STILL CRASH', 'NO FIXTURE', 'FIXED', 'OK'];
  const rows = results.slice().sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || a.id.localeCompare(b.id));
  const md = [`# Registry crash sweep`, '',
    `${results.length} of ${ids.length} apps run (${pending} pending), ${BUDGET} batches at --batch-size=${BATCH_SIZE}, ` +
    `--max-seconds=${SECONDS}. Baseline: ${path.relative(ROOT, BASELINE)} (off@${BUDGET}).`, '',
    Object.entries(counts).map(([k, v]) => `**${v}** ${k}`).join(' · '), '',
    '| app | status | exit | batches | crash line |', '|---|---|---|---|---|',
    ...rows.map(r => `| ${r.id} | ${r.status} | ${r.code} | ${r.reached ?? '-'} | ${r.crashLine ? '`' + r.crashLine.replace(/\|/g, '\\|') + '`' : ''} |`)];
  fs.writeFileSync(path.join(OUT, 'table.md'), md.join('\n') + '\n');
  console.log(`counts ${JSON.stringify(counts)} pending ${pending}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
