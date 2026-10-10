#!/usr/bin/env node
// Jazz Jackrabbit 2 (shareware): one seat runs a server on a multiplayer
// level, a second connects to it, and both play the same level.
//
//   node test/test-jazz2-vlan-gameplay.js [--keep]
//
//   seat 10.0.0.1: jazz2.exe -SERVER Share1.j2l -windowed
//   seat 10.0.0.2: jazz2.exe -CONNECT 10.0.0.1 -windowed
//
// The server binds UDP and TCP 10052 and listens; the client connects over
// TCP, the two trade a short handshake there, and the game then talks UDP.
// Three emulator bugs stood in the way (src/09d-winsock.wat): TCP and UDP
// shared one port space (the server's TCP bind failed: "Could not start
// Server"); the WSAAsyncSelect table was per guest-thread instance (Jazz runs
// its sockets on a network thread, which never heard FD_READ); and the connect
// timeout ran on the guest clock, so the client gave up on its SYN in
// milliseconds of wall time and reset the server's accepted socket.
//
// HEAVY: two emulator processes. Run it on a boat sandbox.
//
// Both seats run on the wall clock (--real-ticks): Jazz retires batches far
// faster than the default batch clock could pace two processes' timeouts.

'use strict';

const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');
const { ProcessHub } = require('../lib/vlan-wire');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'scratch', 'jazz2-vlan');
const EXE = path.join(ROOT, 'test', 'binaries', 'candidates', 'jazz-jackrabbit-2-demo-installer', 'installed', 'jazz2.exe');
const KEEP = process.argv.includes('--keep');

let failures = 0;
function check(what, ok, detail) {
  console.log(`${ok ? 'PASS ' : 'FAIL '} ${what}${ok || !detail ? '' : `\n      ${detail}`}`);
  if (!ok) failures++;
  return ok;
}

if (!fs.existsSync(EXE)) {
  console.log('SKIP  Jazz Jackrabbit 2 demo not installed at', EXE);
  process.exit(0);
}
fs.mkdirSync(OUT, { recursive: true });

function spawn(name, ip, gameArgs) {
  const args = [
    '--app=jazz2_demo', `--args=${gameArgs}`, '--vlan-wire', `--vlan-ip=${ip}`, '--trace-net',
    '--quiet-api', '--real-ticks', '--max-batches=100000000', '--max-seconds=200',
    '--stuck-after=100000000', '--control-stdin', '--no-close',
    ...(process.env.JAZZ2_VLAN_TRACE ? [`--trace-api=${process.env.JAZZ2_VLAN_TRACE}`] : []),
    ...(process.env.JAZZ2_VLAN_EXTRA ? process.env.JAZZ2_VLAN_EXTRA.split(' ') : []),
    ...(process.env[`JAZZ2_VLAN_${name.toUpperCase()}_EXTRA`]
      ? process.env[`JAZZ2_VLAN_${name.toUpperCase()}_EXTRA`].split(' ') : []),
  ];
  const child = fork(path.join(ROOT, 'test', 'run.js'), args,
    { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe', 'ipc'] });
  const fd = fs.openSync(path.join(OUT, `${name}.log`), 'w');
  const state = { name, child, exited: false, text: '', rx: 0, tx: 0, syn: false };
  child.stdout.on('data', d => {
    fs.writeSync(fd, d);
    const t = d.toString();
    state.text = (state.text + t).slice(-65536);
    state.rx += (t.match(/\[net\] <- /g) || []).length;
    state.tx += (t.match(/\[net\] -> /g) || []).length;
    if (/\[net\] <- SYN|\[net\] -> SYN/.test(t)) state.syn = true;
  });
  child.stderr.on('data', d => fs.writeSync(fd, d));
  child.on('exit', () => { state.exited = true; });
  return state;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const control = (s, cmd) => { if (!s.exited) s.child.stdin.write(JSON.stringify(cmd) + '\n'); };
async function snap(s, tag) {
  const file = path.join(OUT, `${s.name}-${tag}.png`);
  fs.rmSync(file, { force: true });
  control(s, { action: 'png', path: file });
  for (let i = 0; i < 100 && !fs.existsSync(file); i++) await sleep(200);
  await sleep(300);
  return fs.existsSync(file) ? file : null;
}

async function main() {
  const hub = new ProcessHub();
  const host = spawn('host', '10.0.0.1', '-SERVER Share1.j2l -windowed');
  hub.add(host.child);
  let guest = null;
  try {
    await sleep(20000);
    await snap(host, 'serving');
    guest = spawn('guest', '10.0.0.2', '-CONNECT 10.0.0.1 -windowed');
    hub.add(guest.child);
    await sleep(60000);
    check('the client connected over TCP', !!(host.syn && guest.syn));
    check('the client never reset its own connect', !/\[net\] -> RST/.test(guest.text));
    // A joined client streams its own UDP state to the server; a dropped one
    // sends a few frames and stops while the server keeps talking.
    check('game traffic flows both ways', host.rx > 50 && guest.rx > 50,
      `host rx ${host.rx} tx ${host.tx}, guest rx ${guest.rx} tx ${guest.tx}`);
    check('the server did not report a network error', !/Could not start Server/i.test(host.text));
    await snap(host, 'game');
    await snap(guest, 'game');
    console.log(`wire frames: host rx ${host.rx} tx ${host.tx}, guest rx ${guest.rx} tx ${guest.tx}`);
  } catch (err) {
    check(String(err && err.message || err), false);
  } finally {
    for (const s of [host, guest].filter(Boolean)) control(s, { action: 'quit' });
    await sleep(3000);
    for (const s of [host, guest].filter(Boolean)) if (!s.exited) s.child.kill();
  }
  if (!KEEP && !failures) {
    for (const f of ['host.log', 'guest.log']) fs.rmSync(path.join(OUT, f), { force: true });
  }
  console.log(failures ? `test-jazz2-vlan-gameplay: ${failures} FAILED (logs in ${OUT})`
    : 'test-jazz2-vlan-gameplay: all checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
