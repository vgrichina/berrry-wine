#!/usr/bin/env node
// Two Quake III Arena demo processes play one free-for-all over the virtual LAN.
//
//   node test/test-quake3-vlan-gameplay.js [--keep]
//
//   seat 10.0.0.1  +set sv_maxclients 4 +map q3dm1        (listen server)
//   seat 10.0.0.2  +connect 10.0.0.1                      (client)
//        │                                                     │
//        │  <- getchallenge (16)         challengeResponse ->  │  repeats while the
//        │  <- connect + userinfo        connectResponse ->    │  server loads q3dm1
//        │  <- usercmds, every frame     snapshots, every frame│  <- "in the game"
//
// All UDP on port 27960 (socket/bind/sendto/recvfrom, src/09d-winsock.wat).
// Both seats use the software GL rasterizer (no display needed). Checks read
// --trace-net and each seat's last frame:
//
//   1. the handshake completes: the client sent getchallenge and then STOPPED
//      (a refused or unanswered client keeps retrying getchallenge), and both
//      directions carry a sustained stream afterwards;
//   2. the client renders a lit world of its own, not a console, loading
//      plaque or a copy of the server's frame.
//
// Each seat loads q3dm1 in ~8000 batches at --batch-size=200000 on the
// software rasterizer, so the run is long. HEAVY: run it on a boat.
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { PNG } = require('pngjs');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'scratch', 'quake3-vlan');
const EXE = path.join(ROOT, 'test', 'binaries', 'candidates', 'quake-3-arena-demo-installer',
  'installed', 'quake3.exe');
const GETCHALLENGE_LEN = 16;   // "\xff\xff\xff\xffgetchallenge"
const SECONDS = Number(process.env.Q3_VLAN_SECONDS || 640);

let failures = 0;
function check(what, ok, detail) {
  console.log(`${ok ? 'PASS ' : 'FAIL '} ${what}${ok || !detail ? '' : `\n      ${detail}`}`);
  if (!ok) failures++;
}
// Sends as `[net] -> ... len=N`, in order.
function sends(log) {
  return fs.readFileSync(log, 'utf8').split('\n')
    .filter(l => l.startsWith('[net] ->'))
    .map(l => Number((/len=(\d+)/.exec(l) || [])[1]));
}
function sceneStats(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const colours = new Set();
  let lit = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const [r, g, b] = [png.data[i], png.data[i + 1], png.data[i + 2]];
    if (r + g + b > 60) lit++;
    colours.add((r << 16) | (g << 8) | b);
  }
  return { lit: lit / (png.width * png.height), colours: colours.size, data: png.data };
}

if (!fs.existsSync(EXE)) {
  console.log('SKIP  Quake III Arena demo not installed at', EXE);
  process.exit(0);
}
fs.mkdirSync(OUT, { recursive: true });

// The server outlives the client by 30 s: with equal limits it exits first and
// the client's last frame carries Quake's "Connection Interrupted" banner.
const seat = (args, png, seconds) => [
  '--app=quake3_demo', `--args=${args}`, '--gl-renderer=software',
  '--quiet-api', '--quiet-blocks', '--trace-net', '--real-ticks',
  // Deliver every 8 batches, not run.js's default 64: at ~21 batches/s the
  // default is ~3 s of latency and the client shows "Connection Interrupted"
  // (64+ unacknowledged commands) even though both directions keep flowing.
  '--vlan-pump-every=8',
  '--batch-size=200000', '--max-batches=100000000', `--max-seconds=${seconds}`,
  '--stuck-after=100000000', '--no-close', `--png=${path.join(OUT, png)}`,
];
try {
  execFileSync('node', [
    path.join(ROOT, 'tools', 'vlan-pair.js'), `--log-dir=${OUT}`,
    '--', ...seat('+set sv_maxclients 4 +map q3dm1', 'server.png', SECONDS + 30),
    '--', ...seat('+connect 10.0.0.1', 'client.png', SECONDS),
  ], { cwd: ROOT, encoding: 'utf8', timeout: (SECONDS + 150) * 1000, stdio: ['ignore', 'pipe', 'pipe'] });
} catch (err) {
  if (err.code === 'ETIMEDOUT') {
    console.log(`FAIL  the pair did not finish inside ${SECONDS + 150}s; logs in ${OUT}`);
    process.exit(1);
  }
}

const client = sends(path.join(OUT, 'seat-2.log'));
const server = sends(path.join(OUT, 'seat-1.log'));
const lastChallenge = client.lastIndexOf(GETCHALLENGE_LEN);
check('the client asked the server for a challenge', lastChallenge >= 0,
  `client sizes: ${[...new Set(client)].slice(0, 20).join(',')}`);
const after = client.slice(lastChallenge + 1);
check(`the client stopped asking and kept talking (${after.length} packets after the last getchallenge)`,
  after.length >= 200, 'a client still sending getchallenge never had its connect accepted');
check(`the server answered all along (${server.length} packets)`, server.length >= 200);

const clientPng = path.join(OUT, 'client.png');
const serverPng = path.join(OUT, 'server.png');
if (fs.existsSync(clientPng) && fs.existsSync(serverPng)) {
  const c = sceneStats(clientPng);
  const s = sceneStats(serverPng);
  check(`the client renders a lit world (${(c.lit * 100).toFixed(0)}% lit, ${c.colours} colours)`,
    c.lit > 0.3 && c.colours > 200);
  const differ = c.data.length !== s.data.length || !c.data.equals(s.data);
  check('the client is its own player, not a copy of the server\'s view', differ);
} else {
  check('both seats wrote a frame', false, `missing ${clientPng} or ${serverPng}`);
}

if (!process.argv.includes('--keep') && !failures) {
  for (const f of ['seat-1.log', 'seat-2.log']) fs.rmSync(path.join(OUT, f), { force: true });
}
console.log(failures ? `test-quake3-vlan-gameplay: ${failures} FAILED`
  : 'test-quake3-vlan-gameplay: all checks passed');
process.exit(failures ? 1 : 0);
