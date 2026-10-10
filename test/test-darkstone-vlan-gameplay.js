#!/usr/bin/env node
// Darkstone demo: one seat creates a TCP/IP multiplayer session, a second joins it.
//
//   node test/test-darkstone-vlan-gameplay.js
//
// Two frozen run.js control sessions on one virtual LAN wire (DirectPlay
// TCP/IP). Route on each seat: New Game -> Multiplayer -> create a champion
// and place it -> OK -> Available Services: TCP/IP -> Session. The host clicks
// Create a session, the guest Join a session. Both run with --no-spin-park:
// after Create the host's main thread stamps every object with GetTickCount in
// a tight loop, the clock-spin detector parks it once per object, and the
// host sits on a white menu frame for minutes (see docs/re-notes/darkstone-demo.md).
// Captures of every step are kept in scratch/darkstone-vlan.
//
// What this covers today (2026-10-10): the guest types the host's address,
// lists the session (DirectPlay ENUM over the vlan) and joins it; with
// IDirectPlay4::SendEx accepting ASYNC|NOSENDCOMPLETEMSG game data flows both
// ways. The guest does NOT reach the town yet: after its join request (type
// 0x6c) it waits in WaitForSingleObject at 0x416e4b for a type-0x7f message
// that the host only sends while its wrapper field +0x6720 is clear, and the
// host sets that once it is in the world. Run with DARKSTONE_VLAN_PROBE=1 for
// both seats' thread stacks, wait state and DirectPlay wrapper fields, and
// DARKSTONE_VLAN_PICK='400,330,d' to double-click the listed session.
//
// HEAVY: two emulator processes. Run it on a boat sandbox.

'use strict';

const fs = require('fs');
const path = require('path');
const { ProcessHub } = require('../lib/vlan-wire');
const { startControlSession } = require('./control-session');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'scratch', 'darkstone-vlan');
const GAME = path.join(ROOT, 'test', 'binaries', 'win98-games-a-d', 'DarkstoneDemo-D3D',
  'installed', 'darkstonedemo.exe');

let failures = 0;
function check(what, ok, detail) {
  console.log(`${ok ? 'PASS ' : 'FAIL '} ${what}${ok || !detail ? '' : `\n      ${detail}`}`);
  if (!ok) failures++;
  return ok;
}

if (!fs.existsSync(GAME)) {
  console.log('SKIP  Darkstone installer output is absent; run node tools/install-darkstone-demo.js');
  process.exit(0);
}
fs.mkdirSync(OUT, { recursive: true });

function seat(name, ip) {
  const s = startControlSession([
    path.join(ROOT, 'test', 'run.js'),
    '--app=darkstone_demo', '--screen=800x600', '--vlan-wire', `--vlan-ip=${ip}`, '--trace-net',
    '--batch-size=500000', '--tick-ms-per-batch=250', '--max-batches=100000000',
    `--max-seconds=${process.env.DARKSTONE_VLAN_MAX_SECONDS || 1500}`, '--stuck-after=100000000',
    '--repaint-every=2', '--quiet-api', '--quiet-blocks', '--no-threads', '--no-spin-park',
    '--no-close', '--control-stdin', '--frozen',
    // DARKSTONE_VLAN_HOST_EXTRA / DARKSTONE_VLAN_GUEST_EXTRA: extra run.js flags for one seat.
    ...(process.env[`DARKSTONE_VLAN_${name.toUpperCase()}_EXTRA`] || '').split(' ').filter(Boolean),
  ], { cwd: ROOT, idPrefix: `${name}-`, spawnOptions: { stdio: ['pipe', 'pipe', 'pipe', 'ipc'] } });
  s.name = name;
  return s;
}

const frames = (s, dir) => (s.output().match(dir === 'rx' ? /\[net\] <- /g : /\[net\] -> /g) || []).length;
async function step(s, n) { for (let left = n; left > 0; left -= 20) await s.send({ action: 'step', n: Math.min(20, left) }); }
async function stepBoth(seats, n) { await Promise.all(seats.map(s => step(s, n))); }
async function snap(s, tag) {
  const file = path.join(OUT, `${s.name}-${tag}.png`);
  await s.send({ action: 'png', path: file });
  return file;
}
async function click(s, x, y, settle = 10) {
  await s.send(`mousemove:${x}:${y}`); await step(s, 2);
  await s.send(`mousedown:${x}:${y}`); await step(s, 2);
  await s.send(`mouseup:${x}:${y}`); await step(s, settle);
}
async function type(s, text) {
  for (const ch of text) {
    const vk = ch === '.' ? 190 : ch.charCodeAt(0);       // '.' is VK_OEM_PERIOD
    await s.send(`keydown:${vk}`); await s.send(`di-keydown:${vk}`);
    await s.send(`keypress:${ch.charCodeAt(0)}`); await step(s, 2);
    await s.send(`keyup:${vk}`); await s.send(`di-keyup:${vk}`); await step(s, 2);
  }
}

// Main menu -> Session menu with a new champion called `name`.
async function toSession(s, name) {
  await step(s, 300);                                     // logo and asset load
  await click(s, 400, 260);                               // New Game
  await click(s, 400, 374, 14);                           // Multiplayer
  await click(s, 145, 410, 14);                           // Create a character
  await click(s, 385, 480, 1);                            // name field
  await type(s, name); await step(s, 2);
  await click(s, 425, 570, 14);                           // Create
  await s.send('mousemove:530:225'); await step(s, 2);
  await s.send('click:530:225'); await step(s, 14);       // place the champion
  await s.send('mousemove:425:570'); await step(s, 4);
  await click(s, 425, 570, 20);                           // OK
  await click(s, 400, 374, 20);                           // TCP/IP
  await snap(s, 'session');
}

async function main() {
  const hub = new ProcessHub();
  const host = seat('host', '10.0.0.1');
  const guest = seat('guest', '10.0.0.2');
  hub.add(host.child);
  hub.add(guest.child);
  try {
    await Promise.all([toSession(host, 'HOST'), toSession(guest, 'GUEST')]);
    await click(host, 400, 324, 20);                      // Create a session
    await stepBoth([host, guest], 100);
    await snap(host, 'created');
    await click(guest, 400, 424, 20);                     // Join a session
    await click(guest, 400, 372, 2);                      // "Enter IP address, or Name of Host"
    await type(guest, '10.0.0.1'); await step(guest, 2);
    await snap(guest, 'address');
    await click(guest, 400, 420, 20);                     // OK
    await stepBoth([host, guest], 40);
    await snap(guest, 'join');
    // DARKSTONE_VLAN_PICK=X,Y[,d];...: guest clicks after the session list
    // appears; a trailing ",d" makes it a double click.
    for (const xy of (process.env.DARKSTONE_VLAN_PICK || '').split(';').filter(Boolean)) {
      const [x, y, d] = xy.split(',');
      if (d === 'd') {
        await guest.send(`mousemove:${x}:${y}`); await step(guest, 2);
        for (let i = 0; i < 2; i++) {
          await guest.send(`mousedown:${x}:${y}`); await step(guest, 1);
          await guest.send(`mouseup:${x}:${y}`); await step(guest, 1);
        }
        await step(guest, 20);
      } else {
        await click(guest, Number(x), Number(y), 20);
      }
      await stepBoth([host, guest], 40);
    }
    await stepBoth([host, guest], 100);
    await snap(guest, 'joined');
    await snap(host, 'joined');
    // DARKSTONE_VLAN_PROBE=1: print every guest thread's EIP and the code
    // addresses on its stack, for a seat that stops making progress.
    if (process.env.DARKSTONE_VLAN_PROBE) {
      const code = 'var tm=ctx.threadManager; var dv=new DataView(memory.buffer); var out=[];'
        + 'function one(tag,e){var esp=e.get_esp()>>>0; var w=[]; for(var i=0;i<300;i++){var v=dv.getUint32(g2w(esp+i*4),true)>>>0; if(v>0x401000&&v<0x500000) w.push(v.toString(16))} out.push(tag+" eip="+(e.get_eip()>>>0).toString(16)+" stack="+w.slice(0,14).join(","))}'
        + 'one("main",tm.mainInstance.exports); tm.threads.forEach(function(t){if(t.instance) one("T"+t.tid+"@"+(t.startAddr>>>0).toString(16)+" waitPolls="+t.waitPolls,t.instance.exports)});'
        + 'var m=tm.mainInstance.exports; out.push("main wait: handle=0x"+((m.get_wait_handle?m.get_wait_handle():0)>>>0).toString(16)+" timeout="+(m.get_wait_timeout?m.get_wait_timeout():"na")+" all="+(m.get_wait_all?m.get_wait_all():"na")+" yield="+(m.get_yield_reason?m.get_yield_reason():"na")+" ev[0x647ee0]=0x"+(dv.getUint32(g2w(0x647ee0),true)>>>0).toString(16)+" mainState="+JSON.stringify(tm._mainThreadState&&{state:tm._mainThreadState.state,waitH:tm._mainThreadState.waitH,sleepUntil:tm._mainThreadState.sleepUntil,waitStartedAt:tm._mainThreadState.waitStartedAt}));'
        + 'var f=[]; for(var o=0x6700;o<0x6760;o+=4) f.push((dv.getUint32(g2w(0x8a9f00+o),true)>>>0).toString(16)); out.push("dp wrapper +0x6700: "+f.join(" "));'
        + 'out.join("\\n")';
      for (const s of [host, guest]) console.log(`probe ${s.name}:\n${await s.send({ action: 'eval', code })}`);
    }
    const hr = frames(host, 'rx'), ht = frames(host, 'tx'), gr = frames(guest, 'rx'), gt = frames(guest, 'tx');
    check('the seats exchange frames', hr > 0 && ht > 0 && gr > 0 && gt > 0,
      `host rx ${hr} tx ${ht}, guest rx ${gr} tx ${gt}`);
    console.log(`wire frames: host rx ${hr} tx ${ht}, guest rx ${gr} tx ${gt}`);
    check('no unimplemented API', !/UNIMPLEMENTED API:|\*\*\* CRASH/.test(host.output() + guest.output()));
  } catch (err) {
    check(String(err && err.message || err), false);
  } finally {
    for (const s of [host, guest]) {
      fs.writeFileSync(path.join(OUT, `${s.name}.log`), s.output());
      await s.quit({ ignoreReplyError: true }).catch(() => {});
    }
  }
  console.log(failures ? `test-darkstone-vlan-gameplay: ${failures} FAILED (logs in ${OUT})`
    : 'test-darkstone-vlan-gameplay: all checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
