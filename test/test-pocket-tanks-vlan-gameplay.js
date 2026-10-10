#!/usr/bin/env node
// Pocket Tanks: one seat creates a LAN game, a second joins it.
//
//   node test/test-pocket-tanks-vlan-gameplay.js
//
// Two run.js processes on one virtual LAN wire. Pocket Tanks refuses LAN
// play on Windows 98 ("Network games require Windows 2000 or newer"), so both
// seats report Windows 2000. Route on each seat: dismiss the Deluxe offer
// (Maybe Later), Start, LAN GAME, Okay on the firewall notice, Okay on the
// LAN Game Browser note -> "Local Network Games". The host then clicks Create
// Game (and Create Game again on the settings screen); the guest picks the
// listed game and clicks Join Game. Checks: frames cross both ways; captures
// of every step are kept in scratch/ptanks-vlan.
//
// HEAVY: two emulator processes. Run it on a boat sandbox.

'use strict';

const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');
const { ProcessHub } = require('../lib/vlan-wire');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'scratch', 'ptanks-vlan');

let failures = 0;
function check(what, ok, detail) {
  console.log(`${ok ? 'PASS ' : 'FAIL '} ${what}${ok || !detail ? '' : `\n      ${detail}`}`);
  if (!ok) failures++;
  return ok;
}

if (!fs.existsSync(path.join(ROOT, 'test', 'binaries', 'candidates', 'pocket-tanks-installer',
  'installed', 'pockettanks.exe'))) {
  console.log('SKIP  Pocket Tanks not installed');
  process.exit(0);
}
fs.mkdirSync(OUT, { recursive: true });

function spawn(name, ip) {
  const args = [
    '--app=pocket_tanks', '--winver=win2k', '--vlan-wire', `--vlan-ip=${ip}`, '--trace-net',
    '--quiet-api', ...(process.env.PTANKS_VLAN_BATCH_CLOCK ? [] : ['--real-ticks']), '--batch-size=200000', '--stuck-after=100000000',
    '--max-batches=100000000', `--max-seconds=${process.env.PTANKS_VLAN_MAX_SECONDS || 280}`,
    '--control-stdin', '--no-close',
    // PTANKS_VLAN_HOST_EXTRA / PTANKS_VLAN_GUEST_EXTRA: extra run.js flags for one seat.
    ...(process.env[`PTANKS_VLAN_${name.toUpperCase()}_EXTRA`] || '').split(' ').filter(Boolean),
  ];
  const child = fork(path.join(ROOT, 'test', 'run.js'), args,
    { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe', 'ipc'] });
  const fd = fs.openSync(path.join(OUT, `${name}.log`), 'w');
  const state = { name, child, exited: false, rx: 0, tx: 0 };
  child.stdout.on('data', d => {
    fs.writeSync(fd, d);
    const t = d.toString();
    state.rx += (t.match(/\[net\] <- /g) || []).length;
    state.tx += (t.match(/\[net\] -> /g) || []).length;
  });
  child.stderr.on('data', d => fs.writeSync(fd, d));
  child.on('exit', () => { state.exited = true; });
  return state;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const control = (s, cmd) => { if (!s.exited) s.child.stdin.write(JSON.stringify({ cmd }) + '\n'); };
async function click(s, x, y) {
  control(s, `mousemove:${x}:${y}`); control(s, `mousedown:${x}:${y}`);
  // Hold for a while: the game polls GetCursorPos and its buttons act on a
  // press it saw across several of its frames.
  await sleep(Number(process.env.PTANKS_VLAN_HOLD_MS || 6000));
  control(s, `mouseup:${x}:${y}`);
}
async function snap(s, tag) {
  const file = path.join(OUT, `${s.name}-${tag}.png`);
  fs.rmSync(file, { force: true });
  if (!s.exited) s.child.stdin.write(JSON.stringify({ action: 'png', path: file }) + '\n');
  for (let i = 0; i < 100 && !fs.existsSync(file); i++) await sleep(200);
  await sleep(300);
  return fs.existsSync(file) ? file : null;
}

// Offer -> title -> mode menu -> LAN lobby. The offer's buttons ignore clicks
// until it has finished loading, which takes a while on real ticks, so Maybe
// Later is pressed repeatedly; that spot is empty on the title screen.
async function toLobby(s) {
  await sleep(25000);
  if (process.env.PTANKS_VLAN_PROBE) {
    control(s, 'mousemove:500:400'); await sleep(3000);
    control(s, 'dump-mem:0x506f68:16'); await sleep(1000);
  }
  for (let i = 0; i < 3; i++) { await click(s, 507, 418); await sleep(4000); }
  await click(s, 476, 452); await sleep(8000);           // Start
  await click(s, 320, 170); await sleep(10000);          // LAN GAME
  await click(s, 496, 330); await sleep(10000);          // Okay (firewall notice)
  await click(s, 321, 257); await sleep(4000);           // Okay (LAN Game Browser note)
  await snap(s, 'lobby');
}

async function main() {
  const hub = new ProcessHub();
  const host = spawn('host', '10.0.0.1');
  hub.add(host.child);
  let guest = null;
  try {
    await toLobby(host);
    await click(host, 88, 301); await sleep(6000);       // Create Game
    await snap(host, 'create');
    // PTANKS_VLAN_CREATE_AT=X,Y: the settings screen's own Create Game button.
    const [cx, cy] = (process.env.PTANKS_VLAN_CREATE_AT || '').split(',').map(Number);
    if (cx && cy) { await click(host, cx, cy); await sleep(8000); }
    await snap(host, 'waiting');

    guest = spawn('guest', '10.0.0.2');
    hub.add(guest.child);
    await toLobby(guest);
    await sleep(6000);                                   // game list refresh
    await snap(guest, 'list');
    await click(guest, 140, 135); await sleep(2000);     // first listed game
    await click(guest, 216, 301); await sleep(15000);    // Join Game
    await snap(guest, 'joined');
    await snap(host, 'joined');

    check('the seats exchange frames', host.rx > 0 && guest.rx > 0 && host.tx > 0 && guest.tx > 0,
      `host rx ${host.rx} tx ${host.tx}, guest rx ${guest.rx} tx ${guest.tx}`);
    console.log(`wire frames: host rx ${host.rx} tx ${host.tx}, guest rx ${guest.rx} tx ${guest.tx}`);
  } catch (err) {
    check(String(err && err.message || err), false);
  } finally {
    for (const s of [host, guest].filter(Boolean)) if (!s.exited) s.child.stdin.write('{"action":"quit"}\n');
    await sleep(3000);
    for (const s of [host, guest].filter(Boolean)) if (!s.exited) s.child.kill();
  }
  console.log(failures ? `test-pocket-tanks-vlan-gameplay: ${failures} FAILED (logs in ${OUT})`
    : 'test-pocket-tanks-vlan-gameplay: all checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
