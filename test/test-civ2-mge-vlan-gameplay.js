#!/usr/bin/env node
// Civilization II Multiplayer Gold: one seat hosts a LAN (TCP/IP) game, a
// second joins it.
//
//   node test/test-civ2-mge-vlan-gameplay.js [--keep]
//
// EXPLORATORY: captures both seats' screens; the checks are the wire.
//
// The game checks for its CD only by opening D:\civ2\civ2.exe, so the CD's
// civ2.exe is mounted there (CIV2_CD_EXE) instead of the 451 MB data track.
// XDaemon.dll (its network layer) broadcasts on UDP 4994 and the host listens
// on TCP 4993.

'use strict';

const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');
const { ProcessHub } = require('../lib/vlan-wire');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'scratch', 'civ2-vlan');
const GAME = process.env.CIV2_DIR || path.join(ROOT, 'test', 'binaries', 'candidates',
  'civilization-2-mge-win32', 'installed');
const CD_EXE = process.env.CIV2_CD_EXE || path.join(ROOT, 'test', 'binaries', 'candidates',
  'civilization-2-mge-win32', 'cd', 'Civ2', 'civ2.exe');
const KEEP = process.argv.includes('--keep');

let failures = 0;
function check(what, ok, detail) {
  console.log(`${ok ? 'PASS ' : 'FAIL '} ${what}${ok || !detail ? '' : `\n      ${detail}`}`);
  if (!ok) failures++;
  return ok;
}

if (!fs.existsSync(path.join(GAME, 'civ2.exe')) || !fs.existsSync(CD_EXE)) {
  console.log('SKIP  Civilization II MGE not installed');
  process.exit(0);
}
fs.mkdirSync(OUT, { recursive: true });

const press = (b, x, y) => `${b}:mousemove:${x}:${y},${b + 10}:mousedown:${x}:${y},${b + 30}:mouseup:${x}:${y}`;
// Heralds OK, Multiplayer Game, Network Game, TCP/IP.
const BOOT = [press(700, 322, 327), press(3000, 448, 390), press(3100, 478, 464),
  press(3700, 205, 390), press(3800, 253, 464), press(4500, 264, 280)].join(',');

function spawn(name, ip, input) {
  const args = [
    `--exe=${path.join(GAME, 'civ2.exe')}`, `--dlls=${path.join(GAME, 'XDaemon.dll')}`,
    '--vfs-include=**', `--vfs-mount=${CD_EXE}=D:\\civ2\\civ2.exe`,
    '--vlan-wire', `--vlan-ip=${ip}`, '--trace-net', '--quiet-api',
    `--trace-api=${process.env.CIV2_VLAN_TRACE_API ||
      'socket,bind,listen,accept,connect,sendto,recvfrom,send,recv,closesocket'}`,
    '--batch-size=100000', '--tick-ms-per-batch=20', '--max-batches=100000000', `--max-seconds=${process.env.CIV2_VLAN_MAX_SECONDS || 290}`,
    '--repaint-every=20', '--stuck-after=100000000', '--control-stdin', '--no-close', `--input=${input}`,
    // CIV2_VLAN_HOST_EXTRA / CIV2_VLAN_GUEST_EXTRA: extra run.js flags for one seat.
    ...(process.env[`CIV2_VLAN_${name.toUpperCase()}_EXTRA`] || '').split(' ').filter(Boolean),
  ];
  const child = fork(path.join(ROOT, 'test', 'run.js'), args,
    { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe', 'ipc'] });
  const fd = fs.openSync(path.join(OUT, `${name}.log`), 'w');
  const state = { name, child, exited: false, text: '', rx: 0, tx: 0 };
  child.stdout.on('data', d => {
    fs.writeSync(fd, d);
    const t = d.toString();
    state.text = (state.text + t).slice(-131072);
    state.rx += (t.match(/\[net\] <- /g) || []).length;
    state.tx += (t.match(/\[net\] -> /g) || []).length;
  });
  child.stderr.on('data', d => fs.writeSync(fd, d));
  child.on('exit', () => { state.exited = true; });
  return state;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const control = (s, cmd) => { if (!s.exited) s.child.stdin.write(JSON.stringify({ cmd }) + '\n'); };
const enter = s => { control(s, 'keydown:13'); control(s, 'keyup:13'); };
const click = (s, x, y) => { control(s, `mousemove:${x}:${y}`); control(s, `mousedown:${x}:${y}`); control(s, `mouseup:${x}:${y}`); };
async function snap(s, tag) {
  const file = path.join(OUT, `${s.name}-${tag}.png`);
  fs.rmSync(file, { force: true });
  if (!s.exited) s.child.stdin.write(JSON.stringify({ action: 'png', path: file }) + '\n');
  for (let i = 0; i < 100 && !fs.existsSync(file); i++) await sleep(200);
  await sleep(300);
  return fs.existsSync(file) ? file : null;
}

async function main() {
  const hub = new ProcessHub();
  // Host: Start a New Multiplayer Game.
  const host = spawn('host', '10.0.0.1', `${BOOT},${press(5200, 436, 464)}`);
  hub.add(host.child);
  let guest = null;
  try {
    await sleep(35000);
    click(host, 180, 390); enter(host); await sleep(8000);   // Small world
    enter(host); await sleep(8000);                          // Chieftain
    click(host, 330, 434); enter(host); await sleep(8000);   // 2 civilizations
    enter(host); await sleep(8000);                          // barbarians
    enter(host); await sleep(8000);                          // standard rules
    click(host, 30, 324); enter(host); await sleep(8000);    // Open Game, OK
    enter(host); await sleep(8000);                          // unlimited turn time
    // Net name: empty is refused, so type one (the field is a real EDIT since
    // da6a67bd; before that it swallowed keys and Enter left it empty anyway).
    await sleep(6000);
    for (const ch of 'Ann') control(host, `keypress:${ch.charCodeAt(0)}`);
    await sleep(3000);
    await snap(host, 'netname');
    // Enter in these name fields moves focus to OK instead of accepting, so
    // press OK itself.
    click(host, 213, 292); await sleep(15000);               // net name: OK
    for (const ch of 'Rome') control(host, `keypress:${ch.charCodeAt(0)}`);
    await sleep(3000);
    await snap(host, 'gamename');
    click(host, 209, 292); await sleep(15000);               // game name: OK -> lobby
    await snap(host, 'lobby');
    // CIV2_VLAN_HOST_ONLY=1: stop at the host's lobby (one seat, for probes
    // of what the lobby itself runs).
    if (process.env.CIV2_VLAN_HOST_ONLY) {
      // CIV2_VLAN_LOBBY_DUMP=ADDR:LEN,... dumps guest memory once the lobby is up.
      for (const d of (process.env.CIV2_VLAN_LOBBY_DUMP || '').split(',').filter(Boolean)) control(host, `dump-mem:${d}`);
      await sleep(20000);
      throw new Error('host-only run: stopped at the lobby');
    }

    // Guest: Join a Multiplayer Game.
    guest = spawn('guest', '10.0.0.2', `${BOOT},${press(5200, 392, 434)},${press(5300, 436, 464)}`);
    hub.add(guest.child);
    await sleep(40000);
    // Net name, then whatever the join flow shows next; Enter on a game list
    // picks its first game, which is the one we want.
    // The guest's net name starts empty and the dialog refuses an empty one.
    for (const ch of 'Bob') control(guest, `keypress:${ch.charCodeAt(0)}`);
    await sleep(3000);
    await snap(guest, 'netname');
    click(guest, 213, 292); await sleep(10000);              // net name: OK
    await snap(guest, 'join-step0');
    for (let i = 1; i < 3; i++) {
      enter(guest); await sleep(10000);
      await snap(guest, `join-step${i}`);
    }
    await snap(guest, 'join-1');
    await snap(host, 'lobby-1');
    await sleep(20000);
    await snap(guest, 'join-2');
    await snap(host, 'lobby-2');
    // The host answers the guest's discovery only once its lobby is up and
    // pumping the network, and the guest is listed there once the TCP join
    // completes; frames in both directions are the wire half of that.
    check('the seats exchange frames', host.rx > 0 && guest.rx > 0 && host.tx > 0 && guest.tx > 0,
      `host rx ${host.rx} tx ${host.tx}, guest rx ${guest.rx} tx ${guest.tx}`);
    console.log(`wire frames: host rx ${host.rx} tx ${host.tx}, guest rx ${guest.rx} tx ${guest.tx}`);
    // CIV2_VLAN_START=1: the host presses Start Game (exploratory; past the
    // join this outruns the runner's 300s cap).
    if (process.env.CIV2_VLAN_START) {
      const before = { hrx: host.rx, grx: guest.rx };
      click(host, 323, 318); await sleep(30000);
      await snap(host, 'start-1'); await snap(guest, 'start-1');
      await sleep(30000);
      await snap(host, 'start-2'); await snap(guest, 'start-2');
      console.log(`after Start Game: host rx +${host.rx - before.hrx}, guest rx +${guest.rx - before.grx}`);
      // CIV2_VLAN_SETUP_ENTERS=N: accept N per-player setup screens (gender,
      // tribe, ...) on both seats, photographing each step.
      for (let i = 1; i <= Number(process.env.CIV2_VLAN_SETUP_ENTERS || 0); i++) {
        enter(host); enter(guest); await sleep(10000);
        await snap(host, `setup-${i}`); await snap(guest, `setup-${i}`);
      }
      console.log(`after setup: host rx ${host.rx} tx ${host.tx}, guest rx ${guest.rx} tx ${guest.tx}`);
    }
  } catch (err) {
    check(String(err && err.message || err), false);
  } finally {
    for (const s of [host, guest].filter(Boolean)) if (!s.exited) s.child.stdin.write('{"action":"quit"}\n');
    await sleep(3000);
    for (const s of [host, guest].filter(Boolean)) if (!s.exited) s.child.kill();
  }
  console.log(failures ? `test-civ2-mge-vlan-gameplay: ${failures} FAILED (logs in ${OUT})`
    : 'test-civ2-mge-vlan-gameplay: all checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
