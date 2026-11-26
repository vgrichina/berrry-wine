#!/usr/bin/env node
'use strict';
// Exactness of the --uop-opt passes (07d $uop_opt) on real apps: each arm's
// API call counts, present lines and end frame must equal the control arm's
// (mask 0, the tier as on main -- test-uop-opt-identity.js), under the
// default block clock and under --branch-clock.
//
//   node tools/uop-opt-exact.js --apps=spel,h2 --arms=0,0x1ff [--clocks=block,branch]
//        [--out=DIR] [--extra='--flag ...'] [--list] [--timeout=180]
//
// One run at a time, each bounded by --timeout seconds (wall) and a fixed
// batch count. A headless-GL app gets `caffeinate -u -t 2` before each run (a
// sleeping display has no GLFW surface). Writes OUT/<app>-<clock>-<arm>.log
// and .png, and OUT/exact.json with every run's digests and the ledger line.
// Exit 1 when any arm differs from its control.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const arg = (name, dflt) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};

const APPS = {
  // docs/re-notes/spelunky-classic.md reproduction: loading, intro, Enter
  // into the title room (a Game Maker 8 runner: Delphi).
  spel: { app: 'spelunky_classic', gl: true,
    args: ['--screen=1024x768', '--batch-size=100000', '--stuck-after=0', '--max-batches=23500'],
    input: ['20500:keydown:13', '20510:keyup:13'] },
  // docs/re-notes/spelunky-classic-hd.md: title room, down the rope, walk
  spelhd: { app: 'spelunky_classic_hd', gl: true,
    args: ['--screen=1024x768', '--tick-ms-per-batch=5', '--stuck-after=0', '--max-batches=181000'],
    input: ['112000:keydown:13', '112060:keyup:13', '131000:keydown:37', '166100:keyup:37',
      '166200:keydown:38', '166600:keyup:38'] },
  // docs/re-notes/game-maker-benchmark-attempts.md (Game Maker 7: Delphi):
  // the first room, run right, jump
  metro: { app: 'metrojd_gm7', gl: true,
    args: ['--stuck-after=0', '--max-batches=70000'],
    input: ['62000:keydown:39', '64000:keyup:39', '68500:keydown:38', '69500:keyup:38'] },
  // tools/uop-game-ab.js h2: into a scenario, then scroll the map
  h2: { app: 'heroes2_demo',
    args: ['--batch-size=20000', '--max-batches=2400', '--repaint-every=50'],
    input: ['400:click:535:225', '700:click:528:68', '1200:click:283:373',
      '1700:click:508:193', '1725:click:425:85', '1745:click:610:379',
      '1755:click:238:239', '1795:click:421:81', '1810:click:146:165',
      '1820:mousemove:410:220', '1830:mousemove:2:240',
      '1845:click:510:190', '1910:click:610:380', '1990:click:308:226',
      '2005:mousemove:430:230', '2009:click:430:230', '2017:click:242:239'] },
  // tools/uop-game-ab.js sc: to the Terran base
  sc: { app: 'starcraft_shareware',
    args: ['--no-threads', '--batch-size=20000', '--max-batches=3500'],
    input: ['100:focus-main-window', '120:keydown:27', '125:keyup:27',
      '670:mousemove:320:240', '675:mousedown:320:240', '685:mouseup:320:240',
      '990:mousemove:320:240', '995:mousedown:320:240', '1005:mouseup:320:240',
      '1140:mousemove:545:393', '1145:mousedown:545:393', '1155:mouseup:545:393',
      '1540:mousemove:198:261', '1545:mousedown:198:261', '1555:mouseup:198:261'] },
};

if (process.argv.includes('--list')) {
  for (const [k, g] of Object.entries(APPS)) console.log(`${k.padEnd(7)} ${g.app} ${g.args.join(' ')}`);
  process.exit(0);
}

const apps = arg('apps', Object.keys(APPS).join(',')).split(',');
const arms = arg('arms', '0,0x1ff').split(',').map(s => Number(s) >>> 0);
if (!arms.includes(0)) arms.unshift(0);
const clocks = arg('clocks', 'block,branch').split(',');
const outDir = path.resolve(arg('out', path.join(ROOT, 'scratch', 'uop-opt-exact')));
const extra = (arg('extra', '') || '').split(/\s+/).filter(Boolean);
const timeoutS = +arg('timeout', '180');
fs.mkdirSync(outDir, { recursive: true });

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
function digest(text) {
  const lines = text.split('\n');
  const at = lines.findIndex(l => l.startsWith('API call counts'));
  const api = [];
  // only `count name` rows (and the `(N others)` tail): the block is not
  // always followed by a blank line
  if (at >= 0) {
    for (let k = at + 1; k < lines.length && /^\s*\d+\s+(\S+|\(\d+ others\))\s*$/.test(lines[k]); k++) api.push(lines[k].trim());
  }
  // present counts, with the wall-clock fields (ms, fps, %) dropped
  const pres = lines.filter(l => /present/i.test(l) && !/^\s*\d+\s+\S+$/.test(l))
    .map(l => l.replace(/[\d.]+\s*(ms|fps|%|s\b|us)/g, '#'));
  const ledger = lines.filter(l => l.startsWith('uop opt:') || l.startsWith('uop:'));
  const batches = (text.match(/(\d+) batches/) || [])[1] || null;
  return { api, apiSha: sha(api.join('\n')), apiCalls: api.reduce((s, l) => s + (+l.split(/\s+/)[0] || 0), 0),
    pres, presSha: sha(pres.join('\n')), ledger, batches };
}

const results = [];
let diffs = 0;
for (const key of apps) {
  const g = APPS[key];
  if (!g) throw new Error(`unknown app ${key} (--list)`);
  for (const clock of clocks) {
    let control = null;
    for (const mask of arms) {
      const tag = `${key}-${clock}-0x${mask.toString(16)}`;
      const log = path.join(outDir, `${tag}.log`), png = path.join(outDir, `${tag}.png`);
      const argv = ['test/run.js', `--app=${g.app}`, '--no-build', '--quiet-api', '--no-close',
        '--trace-api-counts', '--api-counts-top=100000', ...(g.gl ? ['--headless-gl'] : []),
        ...g.args, ...(clock === 'branch' ? ['--branch-clock'] : []),
        `--uop-opt=0x${mask.toString(16)}`, ...extra, `--max-seconds=${timeoutS - 10}`,
        `--png=${png}`, ...(g.input && g.input.length ? [`--input=${g.input.join(',')}`] : [])];
      // a GL run holds the display awake for its whole length (a display that
      // sleeps mid-sweep leaves GLFW with zero displays: a different renderer,
      // so a different frame); one retry if it still came up unusable
      const once = () => {
        if (!g.gl) return spawnSync(process.execPath, argv, { cwd: ROOT, encoding: 'utf8', timeout: timeoutS * 1000, maxBuffer: 1 << 28 });
        spawnSync('caffeinate', ['-u', '-t', '2']);
        return spawnSync('caffeinate', ['-d', '-i', process.execPath, ...argv], { cwd: ROOT, encoding: 'utf8', timeout: timeoutS * 1000, maxBuffer: 1 << 28 });
      };
      const t0 = Date.now();
      let r = once();
      const unusable = (x) => /headless-gl requested but UNUSABLE/.test((x.stdout || '') + (x.stderr || ''));
      if (g.gl && unusable(r)) r = once();
      const wall = (Date.now() - t0) / 1000;
      fs.writeFileSync(log, (r.stdout || '') + (r.stderr || ''));
      const d = digest((r.stdout || '') + (r.stderr || ''));
      const pngSha = fs.existsSync(png) ? sha(fs.readFileSync(png)) : null;
      const row = { app: key, appId: g.app, clock, mask: `0x${mask.toString(16)}`, status: r.status, signal: r.signal,
        wall, batches: d.batches, apiCalls: d.apiCalls, apiSha: d.apiSha, presSha: d.presSha, pngSha,
        presents: d.pres, ledger: d.ledger, log: path.relative(ROOT, log) };
      if (mask === 0) control = row;
      const bad = [];
      if (r.status !== 0) bad.push(`exit ${r.status}${r.signal ? ' ' + r.signal : ''}`);
      if (!pngSha) bad.push('no png');
      if (g.gl && unusable(r)) bad.push('GL unusable (display asleep)');
      if (control && row !== control) {
        if (row.apiSha !== control.apiSha) bad.push(`api ${row.apiCalls} vs ${control.apiCalls}`);
        if (row.presSha !== control.presSha) bad.push('presents');
        if (row.pngSha !== control.pngSha) bad.push('frame');
      }
      row.verdict = bad.length ? bad.join(', ') : (row === control ? 'control' : 'identical');
      if (bad.length) diffs++;
      results.push(row);
      console.log(`${tag.padEnd(26)} ${row.verdict.padEnd(12)} wall=${wall.toFixed(0)}s api=${d.apiCalls} ` +
        `png=${(pngSha || '-').slice(0, 12)}\n  ${(d.ledger.find(l => l.startsWith('uop opt:')) || '').slice(0, 400)}`);
      fs.writeFileSync(path.join(outDir, 'exact.json'), JSON.stringify(results, null, 1));
    }
  }
}
console.log(diffs ? `DIFFERS: ${diffs} arm(s)` : 'all arms identical to control');
process.exit(diffs ? 1 : 0);
