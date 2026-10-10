#!/usr/bin/env node
// Little Fighter 2: one seat waits for an opponent, the second connects to it.
//
//   node test/test-lf2-vlan-gameplay.js
//
// Two run.js processes on one virtual LAN wire. LF2's network game is a
// direct WinSock TCP connection by address: on the title screen both seats
// pick "network game"; the host picks "Waiting for Opponent", the guest picks
// "Connect to Opponent", types the host's address and clicks ok; both then
// join VS mode with no computer players and start a fight. The address
// box takes WM_KEYDOWN through TranslateMessage, so keys are sent as
// keydown/keyup virtual keys ('.' is VK_OEM_PERIOD). Checks: frames cross
// both ways; captures of every step are kept in scratch/lf2-vlan.
//
// HEAVY: two emulator processes. Run it on a boat sandbox.

'use strict';

const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');
const { ProcessHub } = require('../lib/vlan-wire');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'scratch', 'lf2-vlan');

let failures = 0;
function check(what, ok, detail) {
  console.log(`${ok ? 'PASS ' : 'FAIL '} ${what}${ok || !detail ? '' : `\n      ${detail}`}`);
  if (!ok) failures++;
  return ok;
}

if (!fs.existsSync(path.join(ROOT, 'test', 'binaries', 'candidates', 'little-fighter-2-installer',
  'installed', 'lf2.exe'))) {
  console.log('SKIP  Little Fighter 2 not installed');
  process.exit(0);
}
fs.mkdirSync(OUT, { recursive: true });

function spawn(name, ip) {
  const args = [
    '--app=little_fighter_2', '--screen=800x600', '--vlan-wire', `--vlan-ip=${ip}`, '--trace-net',
    '--quiet-api', '--quiet-blocks', ...(process.env.LF2_VLAN_BATCH_CLOCK ? [] : ['--real-ticks']),
    '--batch-size=100000', '--stuck-after=100000000', '--max-batches=100000000',
    `--max-seconds=${process.env.LF2_VLAN_MAX_SECONDS || 240}`,
    '--repaint-every=50', '--control-stdin', '--no-close',
    // LF2_VLAN_HOST_EXTRA / LF2_VLAN_GUEST_EXTRA: extra run.js flags for one seat.
    ...(process.env[`LF2_VLAN_${name.toUpperCase()}_EXTRA`] || '').split(' ').filter(Boolean),
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
// LF2 samples hover state, so the pointer moves onto a button before pressing.
async function click(s, x, y) {
  control(s, `mousemove:${x}:${y}`); await sleep(500);
  control(s, `mousedown:${x}:${y}`); await sleep(300);
  control(s, `mouseup:${x}:${y}`);
}
async function type(s, text) {
  for (const ch of text) {
    const vk = ch === '.' ? 190 : ch.charCodeAt(0);
    control(s, `keydown:${vk}`); await sleep(150);
    control(s, `keyup:${vk}`); await sleep(150);
  }
}
async function pulse(s, vk) {
  control(s, `keydown:${vk}`); await sleep(300);
  control(s, `keyup:${vk}`); await sleep(1200);
}
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
  const host = spawn('host', '10.0.0.1');
  hub.add(host.child);
  const guest = spawn('guest', '10.0.0.2');
  hub.add(guest.child);
  try {
    await sleep(15000);                                   // title screen
    for (const s of [host, guest]) await click(s, 400, 341);   // network game
    await sleep(3000);
    await snap(host, 'menu');
    await click(host, 400, 342); await sleep(3000);       // Waiting for Opponent
    await snap(host, 'waiting');
    await click(guest, 400, 373); await sleep(3000);      // Connect to Opponent
    await type(guest, '10.0.0.1'); await sleep(1000);
    await snap(guest, 'address');
    await click(guest, 337, 411); await sleep(15000);     // ok
    await snap(guest, 'connected');
    await snap(host, 'connected');
    await sleep(10000);
    await snap(guest, 'later');
    await snap(host, 'later');

    // Carry on into VS mode (LF2_VLAN_MENU_ONLY=1 stops at the mode menu).
    // Each seat drives its own player with the P3 keys (Enter = attack/confirm,
    // arrows); the session is lockstep, so both seats draw the same screen.
    let joinedSame = null;
    if (!process.env.LF2_VLAN_MENU_ONLY) {
      await pulse(host, 13); await sleep(3000);            // VS mode
      await snap(host, 'select'); await snap(guest, 'select');
      for (let i = 0; i < 3; i++) await pulse(host, 13);  // host: join, fighter, team
      for (let i = 0; i < 3; i++) await pulse(guest, 13); // guest: join, fighter, team
      await sleep(6000);
      const hj = await snap(host, 'joined'), gj = await snap(guest, 'joined');
      joinedSame = !!(hj && gj) && fs.readFileSync(hj).equals(fs.readFileSync(gj));
      await pulse(host, 13); await sleep(2000);            // no computer players
      await snap(host, 'cpu'); await snap(guest, 'cpu');
      await pulse(host, 38); await pulse(host, 38); await pulse(host, 13);  // up to Fight
      await sleep(15000);
      await snap(host, 'fight'); await snap(guest, 'fight');
      control(guest, 'keydown:39'); await sleep(1500); control(guest, 'keyup:39');
      control(host, 'keydown:37'); await sleep(1500); control(host, 'keyup:37');
      await sleep(3000);
      await snap(host, 'fight2'); await snap(guest, 'fight2');
    }

    check('the seats exchange frames', host.rx > 0 && guest.rx > 0 && host.tx > 0 && guest.tx > 0,
      `host rx ${host.rx} tx ${host.tx}, guest rx ${guest.rx} tx ${guest.tx}`);
    if (joinedSame !== null)
      check('both seats draw the same character selection', joinedSame,
        'host-joined.png and guest-joined.png differ');
    console.log(`wire frames: host rx ${host.rx} tx ${host.tx}, guest rx ${guest.rx} tx ${guest.tx}`);
  } catch (err) {
    check(String(err && err.message || err), false);
  } finally {
    for (const s of [host, guest]) if (!s.exited) s.child.stdin.write('{"action":"quit"}\n');
    await sleep(3000);
    for (const s of [host, guest]) if (!s.exited) s.child.kill();
  }
  console.log(failures ? `test-lf2-vlan-gameplay: ${failures} FAILED (logs in ${OUT})`
    : 'test-lf2-vlan-gameplay: all checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
