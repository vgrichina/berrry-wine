#!/usr/bin/env node
// SimCity 2000 Network Edition: one server and two clients on the virtual LAN.
//
//   node test/test-simcity2000-net-vlan-gameplay.js [--keep]
//
//   seat 10.0.0.1  2KSERVER.EXE  starts a game (Mayor's server)
//   seat 10.0.0.2  2KCLIENT.EXE  joins 10.0.0.1 as "Mayor"
//   seat 10.0.0.3  2KCLIENT.EXE  joins 10.0.0.1 as "Deputy"
//
// Everything is Winsock TCP (src/09d-winsock.wat) over vln/1 frames. The join
// route is the one in docs/re-notes/simcity-2000-network-edition.md: the
// clients' UI is app-drawn, so the route clicks screen positions and answers
// the join notices and the January budget dialog with dlg-cmd.
//
// HEAVY: three processes for ~7 minutes. Run it on a boat sandbox, not on the
// shared box -- the server overflows its own stack (EIP 0x2e2e) when a client's
// login ack is slow, which is the app's bug surfacing under load.
//
// Checks:
//   1. both clients exchanged TCP data with the server, in both directions;
//   2. the server did not crash (a 0x2e2e crash means "too slow", see re-notes);
//   3. each client draws a city of its own, not the join dialog or a blank MDI;
//   4. the Mayor answers an ordinary control: its own toolbar's rotate-left
//      button turns the map (most of the map rect changes, against a no-input
//      pair of frames taken just before), and zoom-in then changes it again;
//   5. the Mayor's palette-cycling clock ticks: hit counters on the two
//      AnimatePalette return sites (0x46d08d range 0xab, 0x46d107 range 0xe0)
//      agree with the API census, and the Mayor stops itself at batch 320000
//      (= 320 guest-seconds at 1 ms/batch) so the count covers a fixed window.
//      Measured 2026-10-10 on a quiet boat: 667 at 310000, 715 and 761 at
//      320000 (the network route is not deterministic), ~6:1 between sites.

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { PNG } = require('pngjs');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'scratch', 'simcity2000-net-vlan');
const SERVER_EXE = path.join(ROOT, 'test', 'binaries', 'candidates',
  'simcity-2000-network-edition-demo', 'installed');

let failures = 0;
function check(what, ok, detail) {
  console.log(`${ok ? 'PASS ' : 'FAIL '} ${what}${ok || !detail ? '' : `\n      ${detail}`}`);
  if (!ok) failures++;
}

// `[net] -> ... A -> B ...` and `[net] <- ...` frame lines with a payload.
function netLines(log) {
  if (!fs.existsSync(log)) return [];
  return fs.readFileSync(log, 'utf8').split('\n').filter(l => l.startsWith('[net]'));
}

function cityStats(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const colours = new Set();
  let lit = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    if (r + g + b > 60) lit++;
    colours.add((r << 16) | (g << 8) | b);
  }
  return { lit: lit / (png.width * png.height), colours: colours.size, data: png.data };
}

if (!fs.existsSync(SERVER_EXE)) {
  console.log('SKIP  SimCity 2000 Network Edition demo not installed at', SERVER_EXE);
  process.exit(0);
}

fs.mkdirSync(OUT, { recursive: true });
const joinNotices = [];
for (let b = 150000; b <= 420000; b += 3000) joinNotices.push(`${b}:dlg-cmd:1`, `${b + 1500}:dlg-cmd:2`);
const join = (extra) => [
  '50:click:316:276', '7500:click:200:120', '15000:click:315:256',
  '22500:click:265:343', '31000:dlg-set-edit:1014:10.0.0.1', ...extra,
  '31500:click:408:232', ...joinNotices,
].join(',');
// The city is live near client batch 290000. Capture it then, while the
// session is up: a client whose server went away saves-and-exits, and its
// exit frame is an empty canvas.
const LIVE_PNG_BATCH = 300000;
const client = (name, inputs) => [
  '--app=simcity2000_net', '--tick-ms-per-batch=1', '--max-batches=100000000',
  '--no-close', '--stuck-after=100000000', '--quiet-api', '--trace-net',
  '--max-seconds=420',
  `--input=${inputs},${LIVE_PNG_BATCH}:png:${path.join(OUT, `${name}.png`)}`,
];
// The Mayor's toolbar (app-drawn, top of the 640x480 client) has rotate-left,
// rotate-right, zoom-in, zoom-out at x 142/165/189/212, y 56. Press = move,
// down, up at one point. Two frames 300 batches apart with no input give the
// null band; the map rect leaves out the left palette and the bottom toolbar.
const ROTATE_LEFT = [142, 56];
// Zoom-out (212,56) did not change the frame on 2026-10-10 (0.0%); zoom-in does
// the job of a second, independent control.
const ZOOM_IN = [189, 56];
const MAP_RECT = [50, 70, 580, 330];
const MAYOR_STOP_BATCH = 320000;
const shot = (b, n) => `${b}:png:${path.join(OUT, `mayor-${n}.png`)}`;
const press = (b, [x, y]) => [`${b}:mousemove:${x}:${y}`, `${b + 100}:mousedown:${x}:${y}`,
  `${b + 300}:mouseup:${x}:${y}`];
const CONTROLS = [
  shot(300500, 'idle-a'), shot(300800, 'idle-b'),
  ...press(301000, ROTATE_LEFT), shot(304000, 'rotated'), shot(306000, 'rotated-later'),
  ...press(307000, ZOOM_IN), shot(310000, 'zoomed'),
  `${MAYOR_STOP_BATCH}:stop`,
];
// AnimatePalette's call sites in 2KCLIENT.EXE (return addresses; the image is
// at its preferred base). 0x457c7f is a third static site that never fired.
const PALETTE_SITES = ['0x46d08d', '0x46d107', '0x457c7f'];

// Share of pixels that differ inside a rect between two same-size PNGs.
function rectDiff(a, b, [x0, y0, w, h]) {
  const pa = PNG.sync.read(fs.readFileSync(a));
  const pb = PNG.sync.read(fs.readFileSync(b));
  if (pa.width !== pb.width || pa.height !== pb.height) return 1;
  let changed = 0;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const i = (y * pa.width + x) * 4;
      if (pa.data[i] !== pb.data[i] || pa.data[i + 1] !== pb.data[i + 1] ||
          pa.data[i + 2] !== pb.data[i + 2]) changed++;
    }
  }
  return changed / (w * h);
}

try {
  execFileSync('node', [
    path.join(ROOT, 'tools', 'vlan-pair.js'), `--log-dir=${OUT}`, '--stagger-ms=12000',
    // Bounded by time only: on a fast machine a batch cap ran out in 72 s and
    // the exiting server cut both clients off ("Connection to the server has
    // been lost") before they were photographed.
    '--', '--app=simcity2000_net_server', '--batch-size=100000', '--max-batches=1000000000',
    '--max-seconds=450', '--no-close', '--stuck-after=100000000', '--quiet-api', '--trace-net',
    '--input=100:post-cmd:57600,1400:click:180:313,2900:click:231:288',
    '--', ...client('mayor', join(CONTROLS)), `--count=${PALETTE_SITES.join(',')}`,
    '--trace-api-counts', '--api-counts-top=250',
    '--', ...client('deputy', join(['31200:dlg-set-edit:1015:Deputy'])),
  ], { cwd: ROOT, encoding: 'utf8', timeout: 540000, stdio: ['ignore', 'pipe', 'pipe'] });
} catch (err) {
  if (err.code === 'ETIMEDOUT') {
    console.log(`FAIL  the three seats did not finish inside 540s; logs in ${OUT}`);
    process.exit(1);
  }
}

const serverLog = path.join(OUT, 'seat-1.log');
const serverText = fs.existsSync(serverLog) ? fs.readFileSync(serverLog, 'utf8') : '';
check('the server did not crash', !/\*\*\* CRASH/.test(serverText),
  /0x00002e2e|EIP=0x2e2e/i.test(serverText)
    ? 'server overflowed its login-ack stack buffer: the box was too slow (see re-notes)'
    : 'see seat-1.log');

for (const [n, name] of [[2, 'mayor'], [3, 'deputy']]) {
  const lines = netLines(path.join(OUT, `seat-${n}.log`));
  const out = lines.filter(l => l.includes('->') && l.includes('10.0.0.1') && /len=([1-9]\d*)/.test(l));
  const back = lines.filter(l => l.includes('<-') && l.includes('10.0.0.1') && /len=([1-9]\d*)/.test(l));
  check(`${name} talks to the server (${out.length} sent, ${back.length} received with payload)`,
    out.length >= 20 && back.length >= 20);
}

const mayor = path.join(OUT, 'mayor.png');
const deputy = path.join(OUT, 'deputy.png');
if (fs.existsSync(mayor) && fs.existsSync(deputy)) {
  const m = cityStats(mayor);
  const d = cityStats(deputy);
  // A client still at "Could Not Connect" or the join form is a grey dialog on
  // a dark frame; a live city view is a lit, many-coloured terrain map.
  check(`mayor draws a city (${(m.lit * 100).toFixed(0)}% lit, ${m.colours} colours)`,
    m.lit > 0.5 && m.colours > 64);
  check(`deputy draws a city (${(d.lit * 100).toFixed(0)}% lit, ${d.colours} colours)`,
    d.lit > 0.5 && d.colours > 64);
  check('the two clients are separate players (frames differ)',
    m.data.length !== d.data.length || !m.data.equals(d.data));
} else {
  check('both clients wrote a frame', false, `missing ${mayor} or ${deputy}`);
}

// 4. Toolbar controls. The PNG captures do not show the palette cycling, so the
// idle pair is near 0; a rotated or zoomed map redraws most of the rect.
const frames = ['idle-a', 'idle-b', 'rotated', 'rotated-later', 'zoomed']
  .map(n => path.join(OUT, `mayor-${n}.png`));
const missing = frames.filter(f => !fs.existsSync(f));
if (!missing.length) {
  const [idleA, idleB, rotated, rotatedLater, zoomed] = frames;
  const pct = v => `${(v * 100).toFixed(1)}%`;
  const idle = rectDiff(idleA, idleB, MAP_RECT);
  const rot = rectDiff(idleB, rotated, MAP_RECT);
  const settled = rectDiff(rotated, rotatedLater, MAP_RECT);
  const zoom = rectDiff(rotatedLater, zoomed, MAP_RECT);
  const answered = v => v > 0.2 && v > 4 * idle;
  check(`Mayor's map rect holds still without input (${pct(idle)} changed)`, idle < 0.05);
  check(`rotate-left turns the Mayor's map (${pct(rot)} changed vs ${pct(idle)} idle)`, answered(rot));
  check(`the rotated view sticks (${pct(settled)} changed 2000 batches later)`, settled < 0.05);
  check(`zoom-in then changes it again (${pct(zoom)} changed)`, answered(zoom));
} else {
  check('the Mayor wrote its control frames', false, `missing ${missing.join(', ')}`);
}

// 5. Palette clock. `Hit counts:` and the census are printed at the Mayor's exit.
const mayorLog = path.join(OUT, 'seat-2.log');
const mayorText = fs.existsSync(mayorLog) ? fs.readFileSync(mayorLog, 'utf8') : '';
const hits = PALETTE_SITES.map(a => {
  const m = mayorText.match(new RegExp(`0x00${a.slice(2)} = (\\d+)`));
  return m ? +m[1] : -1;
});
const census = (mayorText.match(/^ +(\d+) {2}AnimatePalette$/m) || [])[1];
const stopped = mayorText.includes(`[input] stop at batch ${MAYOR_STOP_BATCH}`);
const ticks = hits[0] + hits[1];
check(`the Mayor stopped at batch ${MAYOR_STOP_BATCH} (fixed counter window)`, stopped);
check(`AnimatePalette ticks on both ranges (0xab ${hits[0]}, 0xe0 ${hits[1]}, unused site ${hits[2]})`,
  hits[0] > 0 && hits[1] > 0 && hits[2] === 0);
check(`the hit counters agree with the API census (${ticks} vs ${census})`,
  census !== undefined && ticks === +census);
// Measured 667-761 by 310-320 guest-seconds; half of the lowest is the floor,
// and the ceiling catches a counter that counts something else.
check(`palette clock rate over ${MAYOR_STOP_BATCH / 1000} guest-s ` +
  `(${(ticks / (MAYOR_STOP_BATCH / 1000)).toFixed(2)} calls/guest-s)`, ticks >= 330 && ticks <= 3000);

if (!process.argv.includes('--keep') && !failures) {
  for (const f of ['seat-1.log', 'seat-2.log', 'seat-3.log']) fs.rmSync(path.join(OUT, f), { force: true });
}
console.log(failures ? `test-simcity2000-net-vlan-gameplay: ${failures} FAILED`
  : 'test-simcity2000-net-vlan-gameplay: all checks passed');
process.exit(failures ? 1 : 0);
