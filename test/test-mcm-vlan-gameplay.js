#!/usr/bin/env node
// Motocross Madness trial: one seat hosts a DirectPlay TCP/IP LAN session, a
// second finds it and joins.
//
//   node test/test-mcm-vlan-gameplay.js
//
// Two run.js processes on one virtual LAN wire. Each boots through the
// headless route in docs/re-notes/motocross-madness-demo.md (video-memory
// box, Enter Name, OK); then Multiplayer Event -> TCP/IP LAN -> Next ->
// Host (session name, OK) on the host, and Multiplayer Event -> TCP/IP LAN
// -> Next -> pick the listed session -> Join on the guest. The check is
// frames in both directions; screenshots of both lobbies are kept.

'use strict';

const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');
const { ProcessHub } = require('../lib/vlan-wire');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'scratch', 'mcm-vlan');

let failures = 0;
function check(what, ok, detail) {
  console.log(`${ok ? 'PASS ' : 'FAIL '} ${what}${ok || !detail ? '' : `\n      ${detail}`}`);
  if (!ok) failures++;
  return ok;
}

if (!fs.existsSync(path.join(ROOT, 'test', 'binaries', 'shareware', 'mcm', 'mcm_ex', 'MCM.EXE'))) {
  console.log('SKIP  Motocross Madness trial not installed');
  process.exit(0);
}
fs.mkdirSync(OUT, { recursive: true });

// Video-memory MessageBox, a one-letter rider name, OK.
const typeKey = (b, code, ch) => `${b}:keydown:${code},${b + 2}:keypress:${ch},${b + 4}:keyup:${code}`;
const press = (b, x, y) => `${b}:mousemove:${x}:${y},${b + 20}:mousedown:${x}:${y},${b + 60}:mouseup:${x}:${y}`;
// Each seat's rider gets its own one-letter name (A host, B guest) so the
// lobby rosters can be told apart.
const boot = letter => ['200:dlg-cmd:1', typeKey(10000, letter.charCodeAt(0), letter.charCodeAt(0)),
  press(10300, 221, 236)].join(',');

function spawn(name, ip, letter) {
  const args = [
    '--app=mcm', '--vlan-wire', `--vlan-ip=${ip}`, '--trace-net', '--quiet-api',
    '--stuck-after=100000000', '--max-batches=100000000',
    `--max-seconds=${process.env.MCM_VLAN_MAX_SECONDS || 280}`,
    '--control-stdin', '--no-close', `--input=${boot(letter)}`,
    // MCM_VLAN_HOST_EXTRA / MCM_VLAN_GUEST_EXTRA: extra run.js flags for one seat.
    ...(process.env[`MCM_VLAN_${name.toUpperCase()}_EXTRA`] || '').split(' ').filter(Boolean),
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
  await sleep(700);
  control(s, `mouseup:${x}:${y}`);
}
function type(s, text) {
  for (const ch of text) {
    const up = ch.toUpperCase().charCodeAt(0);
    control(s, `keydown:${up}`); control(s, `keypress:${ch.charCodeAt(0)}`); control(s, `keyup:${up}`);
  }
}
async function snap(s, tag) {
  const file = path.join(OUT, `${s.name}-${tag}.png`);
  fs.rmSync(file, { force: true });
  if (!s.exited) s.child.stdin.write(JSON.stringify({ action: 'png', path: file }) + '\n');
  for (let i = 0; i < 100 && !fs.existsSync(file); i++) await sleep(200);
  await sleep(300);
  return fs.existsSync(file) ? file : null;
}

// Multiplayer Event, then Next on "TCP/IP LAN (8 players)" (selected by default).
async function toHostOrJoin(s) {
  await click(s, 540, 95); await sleep(8000);
  await click(s, 338, 442); await sleep(10000);
}

async function main() {
  const hub = new ProcessHub();
  const host = spawn('host', '10.0.0.1', 'A');
  hub.add(host.child);
  let guest = null;
  try {
    await sleep(40000);                                      // boot to the main menu
    await toHostOrJoin(host);
    await click(host, 80, 173); await sleep(5000);           // Host
    type(host, 'Ann'); await sleep(2000);                    // session name
    await click(host, 318, 189); await sleep(15000);         // OK -> race lobby
    await snap(host, 'lobby');

    guest = spawn('guest', '10.0.0.2', 'B');
    hub.add(guest.child);
    await sleep(40000);
    await toHostOrJoin(guest);
    await sleep(8000);                                       // session enumeration
    await snap(guest, 'sessions');
    await click(guest, 280, 160); await sleep(2000);         // the listed session
    control(guest, 'dblclick:280:160'); await sleep(8000);
    await snap(guest, 'after-dblclick');
    // Join: press and release inside one frame. MCM re-enables JoinBut on
    // every frame while sessions are listed, which drops a press that spans
    // frames (HostBut is not touched per frame, so a slow click works there).
    control(guest, 'mousemove:80:238'); control(guest, 'mousedown:80:238'); control(guest, 'mouseup:80:238');
    await sleep(20000);
    await snap(guest, 'lobby');
    await snap(host, 'lobby-joined');
    await sleep(15000);
    await snap(guest, 'lobby-2'); await snap(host, 'lobby-2');

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
  console.log(failures ? `test-mcm-vlan-gameplay: ${failures} FAILED (logs in ${OUT})`
    : 'test-mcm-vlan-gameplay: all checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
