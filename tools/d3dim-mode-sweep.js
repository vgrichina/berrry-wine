#!/usr/bin/env node
'use strict';

// Does the D3DIM WebGL executor show the same screen as the WAT software
// rasterizer, app by app?
//
//   node tools/d3dim-mode-sweep.js --apps=dx_boids,jazz2_demo
//   node tools/d3dim-mode-sweep.js --all --control --md=/tmp/sweep.md
//
// Three headless runs per app, each capturing a PNG at the same batch and
// diffed with tools/png-diff.js:
//
//   sw     no GL at all            -- what the app shows today
//   glsw   --headless-gl alone     -- a GL context exists, WAT still rasterizes
//   glgpu  --headless-gl --d3dim-gpu -- the executor draws
//
// **The executor's verdict is glsw vs glgpu, not sw vs glgpu.** Measured on
// dx_twist: the GL arm differed from software by 71.9% of pixels while the
// executor reported draws=0, i.e. the whole difference came from asking for a
// GL context and none of it from the executor. Comparing straight to `sw`
// charges that to the wrong arm. The sw-vs-glsw share is reported beside it as
// its own column, because a big number there is a finding about --headless-gl.
//
// **Pass --control on anything you are going to quote.** One picture per arm
// cannot tell a rendering difference from a frame caught at a different point
// of a clock-paced animation: the same app run twice at the same budget is not
// guaranteed to show the same frame, and without that number there is no scale
// to judge an on-vs-off difference against. --control adds a fourth run (the
// software arm again) and reports its self-difference as the app's null band,
// the way tools/block-exec-sweep.js does.
//
// Read the executor's own counters beside the diff. `fallbacks` counts draws
// the executor handed back to WAT, so a run with more fallbacks than draws is
// mostly software no matter what the picture says, and IDENTICAL there means
// "the GL path barely ran", not "the GL path agrees".

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const RUN = path.join(ROOT, 'test', 'run.js');

// The DX2-7 corpus: what lib/d3dim-gpu.js is a backend for. D3D8/D3D9 titles
// (Morrowind, UT2003/4, Black & White 2, Warcraft III, Pawn, GeneRally, the
// Milkdrop plugin) go through the separate D3D9 bridge and are not in scope;
// neither are the Glide-only routes.
const D3DIM_APPS = [
  'dx_boids', 'dx_twist', 'dx_tunnel', 'dx_globe', 'dx_viewer', 'dx_flip3dtl',
  'mcm', 'mw3', 'jazz2_demo', 'heroes3_demo', 'gta2_demo', 'darkstone_demo',
  'aoe2', 'captain_claw_demo', 'spider', 'pocket_tanks', 'halflife_uplink',
  'deus_ex_demo',
];

function flag(name, fallback) {
  const hit = process.argv.find(a => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : true;
}

const APPS = flag('all', false)
  ? D3DIM_APPS
  : String(flag('apps', 'dx_boids')).split(',').map(s => s.trim()).filter(Boolean);
const BATCHES = Number(flag('batches', 1500));
const SECONDS = Number(flag('seconds', 30));
const CONTROL = !!flag('control', false);
const OUT_DIR = String(flag('out', path.join(ROOT, 'build', 'd3dim-mode-sweep')));
const TOLERANCE = Number(flag('tolerance', 0));

fs.mkdirSync(OUT_DIR, { recursive: true });

// One headless run. Never throws: a crash or a timeout is a result, not an
// error, and the sweep has to report it rather than stop on it.
function runArm(app, label, mode) {
  const png = path.join(OUT_DIR, `${app}-${label}.png`);
  const args = [RUN, `--app=${app}`, '--no-build', '--quiet-api', '--no-close',
    `--max-batches=${BATCHES}`, `--max-seconds=${SECONDS}`, `--png=${png}`];
  if (mode === 'glsw' || mode === 'glgpu') args.push('--headless-gl');
  if (mode === 'glgpu') args.push('--d3dim-gpu');
  let log = '';
  let failed = null;
  const started = Date.now();
  try {
    log = execFileSync(process.execPath, args, {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      // The in-process --max-seconds guard is the real deadline; this only
      // catches a run that never returns from one WASM batch.
      timeout: (SECONDS + 90) * 1000, maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    log = `${error.stdout || ''}${error.stderr || ''}`;
    failed = error.killed ? 'TIMEOUT' : 'EXIT';
  }
  const crash = /\*\*\* CRASH at batch (\d+): ([^\n]*)/.exec(log);
  const stats = /\[d3dim-gpu\] ([^\n]*)/.exec(log);
  const gpuStats = {};
  if (stats) {
    for (const [, k, v] of stats[1].matchAll(/(\w+)=([\d.]+)/g)) gpuStats[k] = Number(v);
  }
  return {
    png: fs.existsSync(png) ? png : null,
    wallMs: Date.now() - started,
    failed, crash: crash ? { batch: Number(crash[1]), reason: crash[2].trim() } : null,
    gpuStats: stats ? gpuStats : null,
    glUnavailable: /--headless-gl requested but (UNAVAILABLE|UNUSABLE)/.test(log),
    messageBox: (/\[MessageBox\] ([^\n]*)/.exec(log) || [])[1] || null,
  };
}

// Share of pixels that differ, via tools/png-diff.js so this tool and every
// other one agree on what "different" means.
function diffShare(a, b) {
  if (!a || !b) return null;
  try {
    const out = execFileSync(process.execPath,
      [path.join(__dirname, 'png-diff.js'), a, b, `--tolerance=${TOLERANCE}`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return Number((/\((\d+\.\d+)%\)/.exec(out) || [])[1] || 0);
  } catch (error) {
    const out = `${error.stdout || ''}`;
    const hit = /\((\d+\.\d+)%\)/.exec(out);
    if (hit) return Number(hit[1]);
    return null;
  }
}

// The verdict is about the executor, so it is glsw (the same run without it)
// against glgpu. NODRAW comes first among the agreeing verdicts: an executor
// that never drew has not been tested by this app, and calling that IDENTICAL
// is how a sweep reports coverage it does not have.
function classify(sw, glsw, glgpu, share, band) {
  if (glsw.glUnavailable || glgpu.glUnavailable) return 'NOGL';
  if (glgpu.crash && !glsw.crash) return 'GL-CRASH';
  if (glgpu.crash && glsw.crash) return 'BOTH-CRASH';
  if (glsw.crash && !glgpu.crash) return 'SW-CRASH';
  if ([sw, glsw, glgpu].some(a => a.failed === 'TIMEOUT')) return 'TIMEOUT';
  if (!glsw.png || !glgpu.png) return 'NOPIC';
  if (share === null) return 'NOPIC';
  const drew = glgpu.gpuStats && (glgpu.gpuStats.draws || 0) > 0;
  if (!drew) return share === 0 ? 'NODRAW' : 'NODRAW-DIFF';
  if (share === 0) return 'IDENTICAL';
  if (band !== null && share <= band) return 'PACING';
  return 'DIFFERENT';
}

const rows = [];
for (const app of APPS) {
  const sw = runArm(app, 'sw', 'sw');
  const glsw = runArm(app, 'glsw', 'glsw');
  const glgpu = runArm(app, 'glgpu', 'glgpu');
  const control = CONTROL ? runArm(app, 'sw2', 'sw') : null;
  const band = control ? diffShare(sw.png, control.png) : null;
  const share = diffShare(glsw.png, glgpu.png);
  const glShare = diffShare(sw.png, glsw.png);
  const verdict = classify(sw, glsw, glgpu, share, band);
  const g = glgpu.gpuStats || {};
  rows.push({ app, verdict, share, glShare, band, sw, glsw, glgpu, gpu: g });
  const drew = glgpu.gpuStats
    ? `draws=${g.draws || 0} fallbacks=${g.fallbacks || 0} errors=${g.errors || 0}`
    : 'no executor stats';
  const pct = v => (v === null ? '-' : `${v.toFixed(4)}%`);
  console.log(`${verdict.padEnd(12)} ${app.padEnd(20)} ` +
    `exec=${pct(share)} gl-ctx=${pct(glShare)}` +
    `${band === null ? '' : ` null=${pct(band)}`}  ${drew}` +
    `${glgpu.crash ? `  gl-crash@${glgpu.crash.batch}: ${glgpu.crash.reason}` : ''}` +
    `${glsw.crash ? `  sw-crash@${glsw.crash.batch}: ${glsw.crash.reason}` : ''}`);
}

const summary = {};
for (const row of rows) summary[row.verdict] = (summary[row.verdict] || 0) + 1;
console.log(`\n${rows.length} app(s): ` +
  Object.entries(summary).map(([k, v]) => `${v} ${k}`).join(', '));
console.log(`captures in ${OUT_DIR}`);

const jsonPath = flag('json', null);
if (jsonPath) {
  fs.writeFileSync(String(jsonPath), `${JSON.stringify({
    batches: BATCHES, seconds: SECONDS, control: CONTROL, rows,
  }, null, 1)}\n`);
  console.log(`json: ${jsonPath}`);
}

const mdPath = flag('md', null);
if (mdPath) {
  const pct = v => (v === null ? '-' : `${v.toFixed(4)}%`);
  const lines = ['| app | verdict | executor diff | GL-context diff | null band | ' +
    'GL draws | fallbacks | note |', '|---|---|---|---|---|---|---|---|'];
  for (const row of rows) {
    const note = row.glgpu.crash
      ? `GL crash @${row.glgpu.crash.batch}: ${row.glgpu.crash.reason}`
      : row.glsw.crash
        ? `software crash @${row.glsw.crash.batch}: ${row.glsw.crash.reason}`
        : row.glgpu.messageBox || '';
    lines.push(`| ${row.app} | ${row.verdict} | ${pct(row.share)} | ` +
      `${pct(row.glShare)} | ${pct(row.band)} | ` +
      `${row.gpu.draws || 0} | ${row.gpu.fallbacks || 0} | ${note} |`);
  }
  fs.writeFileSync(String(mdPath), `${lines.join('\n')}\n`);
  console.log(`markdown: ${mdPath}`);
}

process.exit(rows.some(r => r.verdict === 'GL-CRASH') ? 1 : 0);
