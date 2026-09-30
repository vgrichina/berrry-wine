#!/usr/bin/env node
'use strict';
// Does the micro-op tier (--uop, src/07d-uop-engine.wat + 07e-uop-compiler.wat)
// hold up on the real games, and what does it buy there?
//
//   node tools/uop-game-ab.js [--games=h3,sc,...] [--arms=off,uop] [--jobs=N]
//        [--out=DIR] [--extra='--flag ...'] [--ref-wasm=FILE [--ref-region-map=FILE]] [--gl=headless] [--cpu-prof] [--no-build] [--list]
//        [--extend=GAME:N,...]   (N more gameplay batches past the route's end, split there)
//
// Runs each game's own gameplay route (the one its test/test-*-gameplay.js or
// its re-notes use) in two arms and prints, per game: whether the final frames
// are identical, process user CPU, the gameplay phase's guest-slice time from
// --slice-split, and the uop tier's own counters (installs, enters, kills,
// retired-poor, top decline reasons).
//
// BOTH arms run with --branch-clock. A uop A/B is only comparable when both
// arms stop every batch on the same instruction, and the historical block clock
// charges threaded cuts that depend on decode history -- so an off arm on the
// old clock is a different run, not a baseline (docs/uop-tier-design.md).
//
// Frames first, time second: a frame that differs is a correctness bug in the
// tier until shown otherwise, and its time is not worth reading. --jobs>1 is for
// the correctness pass only; CPU numbers from concurrent arms share the box.
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { diffPng } = require('./png-diff');

const ROOT = path.join(__dirname, '..');
const arg = (name, dflt) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};
const flag = name => process.argv.includes(`--${name}`);

const click = (x, y, at) => [`${at}:mousemove:${x}:${y}`, `${at + 40}:mousedown:${x}:${y}`, `${at + 80}:mouseup:${x}:${y}`];
// A shot every 20 batches over [from, to), cycling across the field; a shot is
// a short press, not click()'s 80-batch one.
const shots = (from, to) => {
  const out = [];
  for (let at = from, i = 0; at + 4 < to; at += 20, i++) {
    const x = 80 + (i * 137) % 480, y = 80 + (i * 89) % 300;
    out.push(`${at}:mousemove:${x}:${y}`, `${at + 2}:mousedown:${x}:${y}`, `${at + 4}:mouseup:${x}:${y}`);
  }
  return out;
};
const key = (vk, ch, at) => [`${at}:keydown:${vk}`, `${at + 10}:keypress:${ch}`];

// split = the batch gameplay starts at; the phase after it is the number that
// matters, because boot is decode-bound and pays the tier's compile cost.
const GAMES = {
  h2: {
    app: 'heroes2_demo', split: 1200,
    // test-heroes2-scroll-gameplay.js: into a scenario, then scroll the map.
    args: ['--batch-size=20000', '--max-batches=2400', '--repaint-every=50'],
    input: ['400:click:535:225', '700:click:528:68', '1200:click:283:373',
      '1700:click:508:193', '1725:click:425:85', '1745:click:610:379',
      '1755:click:238:239', '1795:click:421:81', '1810:click:146:165',
      '1820:mousemove:410:220', '1830:mousemove:2:240',
      '1845:click:510:190', '1910:click:610:380', '1990:click:308:226',
      '2005:mousemove:430:230', '2009:click:430:230', '2017:click:242:239'],
  },
  h3: {
    app: 'heroes3_demo', split: 4100,
    args: ['--screen=800x600', '--max-batches=5101', '--batch-size=200000', '--thread-slices=1',
      '--tick-ms-per-batch=100', '--stuck-after=1000000', '--repaint-every=50'],
    input: ['700:mousedown:400:300', '702:mouseup:400:300', '1300:mousedown:400:300', '1302:mouseup:400:300',
      '1900:mousedown:400:300', '1902:mouseup:400:300', '2500:mousedown:400:300', '2502:mouseup:400:300',
      '3500:mousedown:650:80', '3502:mouseup:650:80', '4050:mousedown:400:414', '4052:mouseup:400:414',
      '4160:mousemove:5:300', '4310:mousemove:400:300', '4600:mousemove:795:300', '4810:mousemove:400:300'],
  },
  diablo: {
    app: 'diablo_shareware', split: 2900,
    args: ['--batch-size=200000', '--tick-ms-per-batch=50', '--max-batches=4100', '--repaint-every=20'],
    input: [...click(320, 213, 1000), ...click(420, 298, 1300), ...click(348, 446, 1600),
      ...key(71, 103, 1900), ...key(65, 97, 1950), ...key(76, 108, 2000), ...click(348, 446, 2200),
      ...click(450, 230, 3000), ...click(40, 368, 3400), ...click(590, 373, 3700)],
  },
  diablo_demo: {
    // DIABDEMO has no menu to drive; at 10x ops it runs its own clock-paced loop.
    app: 'diablo_demo', split: 1000,
    args: ['--batch-size=100000', '--max-batches=3000'],
    input: [],
  },
  sc: {
    // Terran base on screen by batch 2500 at this batch size (checked by PNG);
    // at the default 1000 blocks/batch Storm is still decompressing the menu
    // art when the clicks land and the title never advances.
    app: 'starcraft_shareware', split: 1750,
    args: ['--no-threads', '--batch-size=20000', '--max-batches=3500'],
    input: ['100:focus-main-window', '120:keydown:27', '125:keyup:27',
      '670:mousemove:320:240', '675:mousedown:320:240', '685:mouseup:320:240',
      '990:mousemove:320:240', '995:mousedown:320:240', '1005:mouseup:320:240',
      '1140:mousemove:545:393', '1145:mousedown:545:393', '1155:mouseup:545:393',
      '1540:mousemove:198:261', '1545:mousedown:198:261', '1555:mouseup:198:261'],
  },
  wc3: {
    // The campaign route is a 25-minute drive (docs/re-notes/warcraft3-demo.md);
    // this is its animated 3D main menu, up by batch 2000 (checked by PNG).
    // --gl-renderer=software, not --headless-gl: GLFW needs an awake display.
    app: 'warcraft3_demo', split: 2000,
    args: ['--no-threads', '--gl-renderer=software', '--batch-size=20000', '--max-batches=3500'],
    input: [],
  },
  wc3g: {
    // Into real Prologue gameplay: recorded interactively 2026-09-28 by
    // stepping a --frozen --control session with tools/ctl.js, each action
    // logged at the batch it was sent. Profile ABC -> Campaign -> Prologue
    // (bullet 433,156) -> map load to PRESS ANY KEY by ~15950 -> Space ->
    // cinematic -> Esc -> HUD at 19170 -> select Thrall, three move orders.
    // The map load needs the uop tier's speed only for wall time: batches
    // are the clock, so both arms replay the same walk.
    app: 'warcraft3_demo', split: 19170,
    args: ['--no-threads', '--gl-renderer=software', '--batch-size=20000', '--max-batches=21530'],
    input: [
      '2000:mousemove:500:300', '2020:mousemove:546:113', '2060:mousedown:546:113', '2100:mouseup:546:113',
      '2300:keypress:65', '2320:keypress:66', '2340:keypress:67',
      '2380:mousemove:203:173', '2420:mousedown:203:173', '2460:mouseup:203:173',
      '2560:mousemove:130:225', '2600:mousedown:130:225', '2640:mouseup:130:225',
      '2740:mousemove:203:314', '2780:mousedown:203:314', '2820:mouseup:203:314',
      '2970:mousemove:546:149', '3010:mousedown:546:149', '3050:mouseup:546:149',
      '3550:mousemove:300:300', '3570:mousemove:433:156', '3610:mousedown:433:156', '3650:mouseup:433:156',
      '15950:mousemove:300:300', '15970:mousemove:320:428', '16010:mousedown:320:428', '16030:mouseup:320:428',
      '16530:keydown:32', '16550:keyup:32', '18350:keydown:27', '18370:keyup:27',
      '19170:mousemove:300:200', '19190:mousemove:230:300', '19230:mousedown:230:300', '19250:mouseup:230:300',
      '19310:mousemove:385:125', '19350:rclick:385:125',
      '20350:mousemove:520:260', '20390:rclick:520:260',
      '20890:mousemove:150:230', '20930:rclick:150:230',
    ],
  },
  sg: {
    // SimGolf demo gameplay, the window docs/uop-tier-design.md section 15's
    // call-form census used: welcome box dismissed with Enter at 2400, the
    // course then runs its own camera; jgl.dll's scaled blitter is ~20% of
    // block entries from 2500 on.
    app: 'simgolf_demo', split: 2500,
    args: ['--gl-renderer=software', '--batch-size=100000', '--max-batches=4000', '--tick-ms-per-batch=37',
      '--stuck-after=100000000'],
    input: ['100:mousemove:400:300', '1500:mousemove:400:300', '1900:mousemove:401:300',
      '2400:keydown:13', '2405:keyup:13'],
  },
  // Moorhuhn: routes from docs/re-notes/moorhuhn.md, then a spread of shots
  // across the field so the round does work (the round is mouse-only).
  mh1: {
    app: 'moorhuhn', split: 550,
    args: ['--batch-size=100000', '--max-batches=900'],
    input: ['330:keydown:32', '340:keyup:32', '420:keypress:65', '425:keypress:66', '430:keypress:67',
      '450:keydown:13', '452:keypress:13', '455:keyup:13', ...shots(560, 880)],
  },
  mh2: {
    // ~500 batches of load; a click held ~10 batches starts the round. Its
    // timer reads 0:01 at 1020 and HIGHSCORE is up by 1030 (checked by PNG).
    app: 'moorhuhn_2', split: 600,
    args: ['--batch-size=100000', '--max-batches=1015'],
    input: ['540:mousemove:320:250', '550:mousedown:320:250', '560:mouseup:320:250', ...shots(610, 1010)],
  },
  mhw: {
    // Load ~1100 batches; a click starts the round, which runs ~1850-2400.
    app: 'moorhuhn_winter', split: 1850,
    args: ['--batch-size=100000', '--max-batches=2350'],
    input: ['1790:mousemove:320:240', '1800:mousedown:320:240', '1810:mouseup:320:240', ...shots(1860, 2330)],
  },
  mh3: {
    // DirectDraw 16bpp; its FPU MP3 synthesis filter (0x43030b) is the hottest
    // gameplay block, so this is also an x87 case (see the fold arms). Play
    // runs 1740 to 0:01 at 2260; the highscore banner slides in at 2280.
    app: 'moorhuhn_3', split: 1740,
    args: ['--batch-size=200000', '--max-batches=2270'],
    input: ['1450:mousedown:320:240', '1453:mouseup:320:240', '1700:mousedown:320:240', '1703:mouseup:320:240',
      '1900:keydown:32', '1903:keyup:32', ...shots(1750, 2265)],
  },
  d2: {
    // Driven by pixel waits over --control-stdin, so it runs its own test.
    app: 'diablo2_demo', test: 'test/test-diablo2-demo-gameplay.js',
    env: { DIABLO2_FULL_ROUTE: '1', DIABLO2_AFTER_WORLD: '1500' },
  },
  mw3: {
    // MechWarrior 3 demo into a mission (the MW3 fold A/B route: menus by
    // relative mouse moves, then a pixel wait for the cockpit). --copy-superops
    // is the app's own registry setting (copySuperops: true), spelled out so
    // an arm cannot lose it.
    app: 'mw3', split: 860,
    args: ['--copy-superops', '--batch-size=200000', '--max-batches=1150', '--dx-slot=5', '--no-threads'],
    input: ['200:relmousemove:-199:0', '203:relmousemove:0:-23', '210:mousedown:65:210', '225:mouseup:65:210',
      '270:keydown:65', '280:keyup:65', '300:keydown:67', '310:keyup:67', '330:keydown:69', '340:keyup:69',
      '370:relmousemove:282:0', '373:relmousemove:0:84', '385:mousedown:423:320', '405:mouseup:423:320',
      '450:relmousemove:-282:0', '453:relmousemove:0:-84', '465:mousedown:65:210', '485:mouseup:65:210',
      '550:relmousemove:67:0', '553:relmousemove:0:-58', '565:mousedown:150:135', '585:mouseup:150:135',
      '620:relmousemove:215:0', '623:relmousemove:0:145', '635:mousedown:423:320', '655:mouseup:423:320',
      '700:wait-canvas-dark-pixels:5000:30000:900', '770:relmousemove:115:0', '773:relmousemove:0:88',
      '790:mousedown:576:432', '820:mouseup:576:432', '830:wait-canvas-dark-pixels:30000:70000:900'],
  },
  q2: {
    // Quake II demo, software renderer, straight into demo1: the level load
    // is where ref_soft's PCX/WAL run expander runs (the retired H462 fold;
    // uop now runs it, its `rep stos` fills as FILL), then the map.
    app: 'quake2_demo', split: 900,
    args: ['--args=+set vid_ref soft +map demo1', '--batch-size=100000', '--max-batches=1400',
      '--stuck-after=1000000'],
    input: [],
  },
  jazz2: {
    // Jazz Jackrabbit 2 shareware, left alone: title, then its animated
    // Darn Ratz attraction (docs/re-notes/jazz2-demo.md). It never reaches
    // the level renderer: its lighting kernel (H431 mode 2) and masked MMX
    // row copy (H419) run 0 times here, so a fold A/B for those uses jazz2g.
    app: 'jazz2_demo', split: 400,
    args: ['--screen=800x600', '--batch-size=100000', '--max-batches=900', '--stuck-after=1000000'],
    input: [],
  },
  jazz2g: {
    // Jazz 2 into its DEMO level: Escape past the title and the Darn Ratz
    // loading screen, then the demo plays itself. The level renderer runs
    // here -- threaded, H431 fired 641,572 times in 3000 batches.
    app: 'jazz2_demo', split: 1000,
    args: ['--screen=800x600', '--batch-size=100000', '--max-batches=3000', '--stuck-after=1000000'],
    input: ['200:keydown:27', '205:keyup:27', '600:keydown:27', '605:keyup:27',
      '1000:keydown:27', '1005:keyup:27'],
  },
  aoe1: {
    // Age of Empires trial: test-aoe-menu.js's startup into a random-map
    // game, a unit selected, then the AI playing -- its pathfinding-grid row
    // fill (H437) and span prefix (H438) run there.
    app: 'aoe1', split: 23000,
    args: ['--batch-size=10000', '--tick-ms-per-batch=2000', '--max-batches=27000', '--repaint-every=10'],
    input: ['150:click:320:200', '260:click:320:190', '330:keypress:65', '331:keypress:79', '332:keypress:69',
      '380:click:240:305', '520:click:190:455', '1200:click:320:190', '3000:keypress:65', '3001:keypress:79',
      '3002:keypress:69', '5000:keydown:13', '5002:keyup:13', '8200:click:190:455', '23000:click:560:465',
      '25700:click:105:150'],
  },
  blobby: {
    // Blobby Volley (Delphi/VCL): test-blobby-volley.js's route into a match,
    // then a rally -- the window docs/uop-tier-design.md section 15.1 measured
    // at 7.2% of block entries ending at a guest vtable / method-pointer call.
    app: 'blobby_volley', split: 700,
    args: ['--batch-size=200000', '--max-batches=1100'],
    input: ['500:mousemove:400:222', '520:mousemove:401:223', '560:mousedown:401:223', '600:mouseup:401:223'],
  },
  rodent: {
    // Rodent's Revenge 2000 (VB6 native): Game > New Game, then level 1
    // (docs/re-notes/rodent2000.md). Section 15.1's census window 3000..4400:
    // 3.7% of entries end at a guest indirect call, mostly COM AddRef/Release.
    app: 'rodent2000', split: 3000,
    args: ['--batch-size=2000', '--max-batches=4400'],
    input: ['2500:mousedown:155:38', '2501:mouseup:155:38', '2700:mousedown:165:58', '2701:mouseup:165:58',
      '3200:keydown:39', '3260:keyup:39', '3400:keydown:40', '3460:keyup:40',
      '3600:keydown:37', '3660:keyup:37', '3800:keydown:38', '3860:keyup:38'],
  },
  c3: {
    // Caesar III demo: test-caesar3-gameplay.js's retry-driven route to the
    // city, then 2000 batches of it simulating -- the RLE sprite blit (H429)
    // and its sixteen-case ladder (H428) are what draws the city.
    app: 'caesar3_demo', test: 'test/test-caesar3-gameplay.js', envPrefix: 'CAESAR3',
    env: { CAESAR3_CITY_BATCHES: '2000', CAESAR3_MAX_SECONDS: '1500' },
  },
};

function runArm(game, name, armArgs, outDir, extra) {
  const g = GAMES[game];
  const tag = `${game}-${name}`;
  const log = path.join(outDir, `${tag}.log`);
  const png = path.join(outDir, `${tag}.png`);
  let argv, env = Object.assign({}, process.env);
  // --ref-region-map=FILE: the ref arms' module was built from a different
  // memory map (a region added or resized), so run.js must read that build's
  // own lib/region-map.generated.js, not the tree's. Save it with
  // `git show REF:lib/region-map.generated.js > FILE`.
  const refMap = arg('ref-region-map', '');
  if (refMap && name.startsWith('ref')) env.WINE_REGION_MAP = path.resolve(refMap);
  if (g.test) {
    argv = [g.test];
    const pre = g.envPrefix || 'DIABLO2';
    Object.assign(env, g.env || {}, {
      [`${pre}_EXTRA_ARGS`]: ['--quiet-api', ...armArgs, ...extra].join(' '),
      [`${pre}_SCREENSHOT_DIR`]: path.join(outDir, tag),
      [`${pre}_LOG`]: `${log}.run`,
    });
  } else {
    const input = g.input;
    // --gl=headless: the GL games on @node-3d/webgl instead of the software
    // rasterizer (needs an awake display; run.js prints the display count).
    let gargs = arg('gl', '') === 'headless'
      ? g.args.map(a => a === '--gl-renderer=software' ? '--headless-gl' : a) : g.args;
    // --extend=GAME:N[,GAME:N]: run N batches of gameplay past the route's
    // own end, and split there too, so the gameplay phase is most of the run
    // and the route's original window is still reported on its own. The
    // input list is unchanged: the extra batches are the game idling in the
    // state the route left it in (a town, an adventure map, a HUD).
    const ext = +((arg('extend', '').split(',').find(s => s.startsWith(`${game}:`)) || ':0').split(':')[1]);
    let splits = g.split ? [g.split] : [];
    if (ext > 0) {
      const mb = gargs.find(a => a.startsWith('--max-batches='));
      const end = +mb.split('=')[1];
      gargs = gargs.map(a => a === mb ? `--max-batches=${end + ext}` : a);
      splits = [...splits, end];
    }
    argv = ['test/run.js', `--app=${g.app}`, '--no-build', '--quiet-api', '--quiet-blocks', '--no-close',
      ...gargs, ...(splits.length ? [`--slice-split=${splits.join(',')}`] : []), ...armArgs, ...extra,
      `--png=${png}`, ...(input.length ? [`--input=${input.join(',')}`] : [])];
  }
  return new Promise(resolve => {
    const fd = fs.openSync(log, 'w');
    const t0 = Date.now();
    // /usr/bin/time -p: user CPU is the number, wall is load.
    // --cpu-prof: a V8 profile per arm in OUT/<game>-<arm>.cpuprofile/ (read
    // it with tools/cpuprof-top.js; name wasm-function[N] with func-index.js).
    const prof = flag('cpu-prof') ? ['--cpu-prof', `--cpu-prof-dir=${path.join(outDir, `${tag}.cpuprofile`)}`] : [];
    const child = spawn('/usr/bin/time', ['-p', process.execPath, ...prof, ...argv],
      { cwd: ROOT, env, stdio: ['ignore', fd, fd] });
    child.on('exit', code => {
      fs.closeSync(fd);
      resolve({ game, name, log, png, code, wall: (Date.now() - t0) / 1000 });
    });
  });
}

function parse(r) {
  // A test-driven arm writes the inner run.js session to <log>.run.
  const text = fs.readFileSync(r.log, 'utf8')
    + (fs.existsSync(`${r.log}.run`) ? fs.readFileSync(`${r.log}.run`, 'utf8') : '');
  const user = +(text.match(/^user\s+([\d.]+)/m) || [])[1];
  const phases = [...text.matchAll(/batches (\d+)\.\.(\d+)\s+\d+ batches\s+guest ([\d.]+)s/g)]
    .map(m => ({ lo: +m[1], hi: +m[2], s: +m[3] }));
  const uop = (text.match(/^uop: .*$/m) || [''])[0];
  // Secondary tier lines (`uop hot:`, `uop nobump:`), printed as they came.
  const hot = [...text.matchAll(/^(?:uop (?:hot|nobump|widen|ladder): .*|  guard-fail sites: .*)$/mg)].map(m => m[0].trim()).join('\n       ');
  const declines = (text.match(/^\s+declines: (.*)$/m) || [, ''])[1];
  const threads = [...text.matchAll(/^uop\[thread [^\]]+\]: .*$/mg)].map(m => m[0]);
  const crash = (text.match(/(RuntimeError|unreachable|CRASH|crash_unimplemented)[^\n]*/) || [''])[0];
  const stats = (text.match(/^Stats: .*$/m) || [''])[0];
  return Object.assign(r, { user, phases, uop, hot, declines, threads, crash, stats });
}

function frameVerdict(a, b) {
  if (!fs.existsSync(a.png) || !fs.existsSync(b.png)) return 'NOPIC';
  const d = diffPng(a.png, b.png);
  if (d.sizeMismatch) return `SIZE ${d.a.width}x${d.a.height} vs ${d.b.width}x${d.b.height}`;
  return d.changed ? `DIFF ${d.changed}px (${(100 * d.share).toFixed(2)}%)` : 'IDENTICAL';
}

// For the pixel-driven D2 route: every screenshot the test took, pairwise.
function shotVerdict(outDir, game, arms) {
  const dirs = arms.map(a => path.join(outDir, `${game}-${a}`));
  if (!dirs.every(d => fs.existsSync(d))) return 'NOPIC';
  const names = fs.readdirSync(dirs[0]).filter(f => f.endsWith('.png'));
  const bad = names.filter(n => {
    const other = path.join(dirs[1], n);
    if (!fs.existsSync(other)) return true;
    const d = diffPng(path.join(dirs[0], n), other);
    return d.sizeMismatch || d.changed;
  });
  return bad.length ? `DIFF in ${bad.join(',')}` : `IDENTICAL (${names.length} shots)`;
}

async function main() {
  if (flag('list')) {
    for (const [k, g] of Object.entries(GAMES)) console.log(`${k.padEnd(12)} ${g.app}`);
    return;
  }
  const games = (arg('games', Object.keys(GAMES).join(','))).split(',').filter(Boolean);
  for (const g of games) if (!GAMES[g]) throw new Error(`unknown game ${g}; --list`);
  // The tier is on by default since 2026-09-28, so "off" has to say so.
  const ARMS = { off: ['--branch-clock', '--no-uop'], uop: ['--branch-clock', '--uop'], base: ['--no-uop'] };
  // nofold / uopnofold: the same two arms with the semantic x87 folds off.
  // The folds are on by default, so off/uop already carry them; these are the
  // x87 A/B partners. The uop tier does not lower x87, and Heroes III keeps
  // its x87 on a guest thread the tier barely touches, so the fold is the x87
  // lever to A/B there. (Arm names lose trailing digits to the off2/uop2
  // null-band convention, so not "x87".) fold / uopfold are kept as explicit
  // aliases of off / uop for old command lines.
  ARMS.nofold = [...ARMS.off, '--no-x87-fusion'];
  ARMS.uopnofold = [...ARMS.uop, '--no-x87-fusion'];
  ARMS.fold = [...ARMS.off, '--x87-fusion'];
  ARMS.uopfold = [...ARMS.uop, '--x87-fusion'];
  // nostk: the uop arm with the exact stack-run fusion (472-475) off -- its
  // A/B partner is uop. aggr: the uop arm plus the opt-in --aggressive-stack
  // elision tier.
  ARMS.nostk = [...ARMS.uop, '--no-stack-fusion'];
  ARMS.aggr = [...ARMS.uop, '--aggressive-stack'];
  // nojt: the uop arm with the switch jump-table primitive (threaded handler
  // 498, uop kind 28 / engine op 81) off -- its partner is uop. nojtoff is the
  // same flag on the off arm, the threaded-tier-only half of the A/B.
  ARMS.nojt = [...ARMS.uop, '--no-jump-table'];
  ARMS.nojtoff = [...ARMS.off, '--no-jump-table'];
  // nopre: the uop arm with the H451 x87 island run by the old per-op walk
  // ($x87_island_generic) instead of the predecoded body -- its partner is uop.
  ARMS.nopre = [...ARMS.uop, '--no-x87-island-predecode'];
  // trace: the uop arm plus --uop-trace-heads (07e $uc_form_trace). The hot
  // threshold is an arm too, so a K sweep runs in one interleaved sweep:
  // uopkN / tracekN add --block-exec-walk-k=N (a name, not trailing digits,
  // so they are not read as repeats; tracek16x2 is a repeat of tracek16).
  // Trace heads are the default since 2026-09-28, so uop and trace are now
  // the same configuration; notrace is the arm without them.
  ARMS.trace = [...ARMS.uop, '--uop-trace-heads'];
  ARMS.notrace = [...ARMS.uop, '--no-uop-trace-heads'];
  // noage: sticky hot slots without the time decay (section 22), i.e. the
  // section-21.5 gate; nosticky: the pre-21.5 reset-on-sight gate.
  ARMS.noage = [...ARMS.uop, '--uop-hot-age=0'];
  ARMS.nosticky = [...ARMS.uop, '--no-uop-hot-sticky'];
  const armFor = (a) => {
    const k = /^(uop|trace|off)k(\d+)(?:x\d+)?$/.exec(a);
    if (k) return [...ARMS[k[1]], `--block-exec-walk-k=${k[2]}`];
    return ARMS[a] || ARMS[a.replace(/\d+$/, '')];
  };
  // narrow: the uop arm with re-guards proving one page again instead of
  // widening to the 64KB-aligned affine block -- its partner is uop.
  ARMS.narrow = [...ARMS.uop, '--uop-reguard-span=4096'];
  // muldiv / icall / iat: the uop arm plus one opt-in widening each (07e
  // kinds 25/26, FF /2 inline cache, IAT call [abs]); widen is all three.
  // Their partner is uop.
  ARMS.muldiv = [...ARMS.uop, '--uop-muldiv'];
  ARMS.icall = [...ARMS.uop, '--uop-icall'];
  // icallpoly: icall with the megamorphic-site rule off (07d $uop_icg_mega,
  // docs/uop-tier-design.md section 23) -- every guard kept however it fails.
  ARMS.icallpoly = [...ARMS.icall, '--uop-icg-mega=0'];
  ARMS.iat = [...ARMS.uop, '--uop-iat'];
  // Retry ladder (07e $uc_lower_head, docs/uop-tier-design.md section 24):
  // ladder / noladder force it on (mask 7) / off (the pre-24 order) whatever
  // the build's default; icladder / icnoladder are the same over --uop-icall.
  // ladhalve / ladhead / ladicut are one rung each (masks 2 / 4 / 1).
  ARMS.ladder = [...ARMS.uop, '--uop-retry-ladder=7'];
  ARMS.noladder = [...ARMS.uop, '--no-uop-retry-ladder'];
  ARMS.icladder = [...ARMS.icall, '--uop-retry-ladder=7'];
  ARMS.icnoladder = [...ARMS.icall, '--no-uop-retry-ladder'];
  ARMS.ladhalve = [...ARMS.uop, '--uop-retry-ladder=2'];
  ARMS.ladhead = [...ARMS.uop, '--uop-retry-ladder=4'];
  ARMS.ladicut = [...ARMS.icall, '--uop-retry-ladder=1'];
  ARMS.widen = [...ARMS.uop, '--uop-muldiv', '--uop-icall', '--uop-iat'];
  // --ref-wasm=FILE adds arms refoff / refuop: the same two arms on another
  // prebuilt module, so an engine change is measured against its predecessor
  // in one sweep on one box.
  const refWasm = arg('ref-wasm', '');
  if (refWasm) {
    ARMS.refoff = [...ARMS.off, `--wasm=${path.resolve(refWasm)}`, '--no-build'];
    ARMS.refuop = [...ARMS.uop, `--wasm=${path.resolve(refWasm)}`, '--no-build'];
  }
  // --arm=NAME=FLAGS (repeatable): a custom arm, the uop arm plus FLAGS
  // (space-separated), e.g. --arm='ht2k=--uop-hot-table=2048,1'. A NAME
  // that is itself an arm is looked up whole before a trailing repeat digit
  // is stripped, so ht2k2 is a repeat of ht2k.
  for (const a of process.argv.filter(s => s.startsWith('--arm='))) {
    const spec = a.slice(6), eq = spec.indexOf('=');
    if (eq <= 0) throw new Error(`bad ${a}`);
    ARMS[spec.slice(0, eq)] = [...ARMS.uop, ...spec.slice(eq + 1).split(/\s+/).filter(Boolean)];
  }
  // --arm-off=NAME=FLAGS: the same on the off (--no-uop) arm, e.g. the
  // fold-off control of a fold A/B: --arm-off='norleoff=--no-fold=rle-run'.
  for (const a of process.argv.filter(s => s.startsWith('--arm-off='))) {
    const spec = a.slice(10), eq = spec.indexOf('=');
    if (eq <= 0) throw new Error(`bad ${a}`);
    ARMS[spec.slice(0, eq)] = [...ARMS.off, ...spec.slice(eq + 1).split(/\s+/).filter(Boolean)];
  }
  const arms = arg('arms', 'off,uop').split(',');
  const jobs = Math.max(1, +arg('jobs', '1'));
  const outDir = path.resolve(arg('out', path.join(ROOT, 'build', 'uop-game-ab')));
  const extra = (arg('extra', '') || '').split(/\s+/).filter(Boolean);
  fs.mkdirSync(outDir, { recursive: true });
  if (!flag('no-build')) execFileSync('bash', ['tools/build.sh'], { cwd: ROOT, stdio: 'ignore' });

  const load = () => require('os').loadavg().map(x => x.toFixed(1)).join(' ');
  console.log(`load ${load()}  jobs=${jobs}  out=${outDir}`);
  const queue = [];
  for (const g of games) for (const a of arms) queue.push([g, a]);
  const results = [];
  const worker = async () => {
    while (queue.length) {
      const [g, a] = queue.shift();
      // off2 / uop2: a repeat of that arm, so a frame difference can be told
      // apart from an app that does not reproduce itself (the control).
      const armArgs = armFor(a);
      if (!armArgs) throw new Error(`unknown arm ${a}`);
      const r = parse(await runArm(g, a, armArgs, outDir, extra));
      console.log(`  done ${g}/${a} rc=${r.code} user=${r.user}s wall=${r.wall.toFixed(0)}s`);
      results.push(r);
    }
  };
  await Promise.all(Array.from({ length: jobs }, worker));
  console.log(`load ${load()}\n`);

  for (const g of games) {
    const rs = arms.map(a => results.find(r => r.game === g && r.name === a));
    const pairs = [];
    for (let i = 1; i < rs.length; i++) {
      const v = GAMES[g].test ? shotVerdict(outDir, g, [arms[0], arms[i]]) : frameVerdict(rs[0], rs[i]);
      pairs.push(`${arms[0]}~${arms[i]} ${v}`);
    }
    console.log(`== ${g} (${GAMES[g].app})  frames: ${pairs.join(' | ')}`);
    for (const r of rs) {
      console.log(`  ${r.name.padEnd(4)} rc=${r.code} user=${r.user}s`
        + (r.phases.length ? `  phases ${r.phases.map(p => `${p.lo}..${p.hi}=${p.s}s`).join(' ')}` : '')
        + (r.crash ? `  CRASH: ${r.crash.slice(0, 120)}` : ''));
      if (r.uop) console.log(`       ${r.uop}`);
      if (r.hot) console.log(`       ${r.hot}`);
      if (r.declines) console.log(`       declines: ${r.declines}`);
      for (const t of r.threads) console.log(`       ${t}`);
    }
    const [a, b] = rs;
    if (a && b && a.phases.length > 1 && b.phases.length > 1) {
      const pa = a.phases[a.phases.length - 1].s, pb = b.phases[b.phases.length - 1].s;
      console.log(`  gameplay phase ${b.name}/${a.name}: ${pa ? ((pb / pa - 1) * 100).toFixed(1) : '?'}%`
        + `   whole-run user: ${a.user ? ((b.user / a.user - 1) * 100).toFixed(1) : '?'}%`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
