#!/usr/bin/env node
// TetriNET over the virtual LAN: two copies of the same executable, each in
// its own OS process, joined by the vln/1 frame wire.
//
// test-vlan-match.js does this with Liquid War, which ships a separate server
// binary. TetriNET is one exe that is both ends, so this drives the same
// TETRINET.EXE down two different paths through its own UI -- toolbar to the
// server screen and Start Server on one side, toolbar to the connect screen
// and Connect on the other -- and nothing about the connection is staged on
// either side.
//
// The server refuses to start without a nickname: its handler reads that edit
// first and returns early when it is empty, so the three keystrokes below are
// not decoration. Same on the client.
//
// The binary is a gitignored corpus fixture, so this reports SKIP when it has
// not been fetched.

'use strict';

const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');
const { ProcessHub } = require('../lib/vlan-wire');
const { APPS } = require('../lib/apps');
const { askServing } = require('./lan-serving');

const ROOT = path.join(__dirname, '..');
const EXE = path.join(ROOT, 'test', 'binaries', 'candidates', 'tetrinet', 'TETRINET.EXE');
const HOST_IP = '10.0.0.1';
const PEER_IP = '10.0.0.2';
const SERVER_PNG = process.env.VLAN_SERVER_PNG || '';
const CLIENT_PNG = process.env.VLAN_CLIENT_PNG || '';
// Gameplay A/B on the server's own field: raise the playing fields, focus the
// form, press Left six times, and compare the falling piece's column.
const AB_DIR = process.env.VLAN_AB_DIR || require('os').tmpdir();
const AB_T0 = path.join(AB_DIR, 'tn-ab-t0.png');
const AB_T1 = path.join(AB_DIR, 'tn-ab-t1.png');
// VLAN_AB_VK picks the arm: 37 Left (default, checked), 32 Space, 0 no key.
const AB_VK = +(process.env.VLAN_AB_VK ?? 37);
const GAME = 5300100;                  // Start New Game click on the server
// Field draw call sites (TETRINET.EXE): StretchBlt per cell, InvalidateRect per field.
const COUNT_SITES = ['0x419f7b', '0x41680d'];
// Read at fixed batches inside the live match (the unkeyed server tops out
// near GAME+590), so the rate does not depend on when anything was asked.
const COUNT_A = GAME + 45, COUNT_B = GAME + 345;

let failures = 0;
function check(what, ok = true) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures++;
}

if (!fs.existsSync(EXE)) {
  console.log('test-vlan-tetrinet: SKIP (fetch with '
    + 'node tools/fetch-candidate-corpus.js --id=tetrinet)');
  process.exit(0);
}

const typed = (batch, text, step = 50) =>
  [...text].map((ch, i) => `${batch + i * step}:keypress:${ch.charCodeAt(0)}`);

// Screen coordinates come from the control tree, not from reading pixels:
// `--input=N:dump-windows:label` prints every window with its class, title and
// client rect, which is how the "Start Server" button and the nickname edit
// below were located.
const SERVER_INPUT = [
  '1200:click:319:284',            // dismiss the first-run dialog
  '1700:click:520:455',            // toolbar: the server screen
  '2100:click:253:62',             // the nickname edit
  ...typed(2200, 'bob'),
  '2600:click:407:408',            // Start Server
  '5300000:click:139:455',         // toolbar: Partyline
  '5300050:dump-windows:server-partyline',
  '5300100:click:529:417',         // Start New Game
  ...(SERVER_PNG ? [`5300800:png-pixels:${SERVER_PNG}`] : []),
  `${GAME + 5}:click:40:455`,          // toolbar: Playing Fields
  `${GAME + 12}:click:320:448`,        // focus the fields form
  `${GAME + 19}:png-pixels:${AB_T0}`,
  ...(AB_VK ? [0, 1, 2, 3, 4, 5].flatMap(i => [`${GAME + 22 + 3 * i}:keydown:${AB_VK}`, `${GAME + 23 + 3 * i}:keyup:${AB_VK}`]) : []),
  `${GAME + 41}:png-pixels:${AB_T1}`,
  `${COUNT_A}:hit-counts:a`,
  `${COUNT_B}:hit-counts:b`,
].join(',');

const CLIENT_INPUT = [
  '1200:click:319:284',            // dismiss the first-run dialog
  '1500:click:57:455',             // initialize the lazy playing-fields form
  '1550:click:606:15',             // close it before editing connection data
  '1600:click:450:455',            // toolbar: Client Settings
  '1750:click:455:186',            // the server address field
  ...typed(1800, HOST_IP, 10),
  '1900:click:455:213',            // the nickname field
  ...typed(1920, 'ann', 10),
  '2000:click:437:279',            // Connect
  '4300:click:139:455',            // toolbar: Partyline
  '4400:dump-windows:partyline',
].join(',');

// A run of this length emits far too much to hold in memory, so the full log
// goes to a file and only a short rolling window is kept. Patterns are
// registered before the child starts and tested as the output streams past,
// because by the time anyone waits on one the line may already have scrolled.
const WINDOW_BYTES = 64 * 1024;

function spawn(name, args, logEnvVar, watch) {
  const child = fork(path.join(ROOT, 'test', 'run.js'), args,
    { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe', 'ipc'] });
  const logPath = process.env[logEnvVar];
  const fd = logPath ? fs.openSync(logPath, 'w') : null;
  const state = {
    name, child, window: '', exited: false, hits: new Set(), matched: new Map(),
    watch: Object.values(watch),
    tail: () => state.window.split('\n').slice(-25).join('\n'),
  };
  const collect = d => {
    if (fd !== null) fs.writeSync(fd, d);
    state.window = (state.window + d.toString()).slice(-WINDOW_BYTES);
    for (const re of state.watch) {
      if (state.hits.has(re)) continue;
      // Keep the text: the rolling window may drop it before it is read.
      const m = state.window.match(re);
      if (m) { state.hits.add(re); state.matched.set(re, m[0]); }
    }
  };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  child.on('exit', () => { state.exited = true; });
  return state;
}

const NET_TRACE = process.env.VLAN_TRACE_NET ? ['--trace-net'] : [];
const extra = v => (v ? v.split(' ').filter(Boolean) : []);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitFor(state, pattern, what, timeoutMs = 300000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (state.hits.has(pattern)) return true;
    if (state.exited) throw new Error(`${state.name} exited before ${what}\n${state.tail()}`);
    await sleep(100);
  }
  throw new Error(`timed out waiting for ${what} on ${state.name}\n${state.tail()}`);
}

const SERVER_SIGNS = {
  listen: /listen\(s=0x[0-9a-f]+, backlog=/,
  accept: /accept\(/,
  recv: /recv\(/,
  send: /send\(/,
  start: /send\(s=0x[0-9a-f]+, buf=0x[0-9a-f]+, len=229, flags=0\)/,
  png: /\[input\] png-pixels .* at batch /,
  abT1: /\[input\] png-pixels .*tn-ab-t1\.png .* at batch /,
  countsA: /\[input\] hit-counts:a: .* at batch \d+\r?\n/,
  countsB: /\[input\] hit-counts:b: .* at batch \d+\r?\n/,
};
const CLIENT_SIGNS = {
  connect: /connect\(s=/,
  recv: /recv\(/,
  start: /send\(s=0x[0-9a-f]+, buf=0x[0-9a-f]+, len=5, flags=0\)/,
  fields: /\[input\] click 40,455 at batch /,
  gameplay: /\[input\] window:client-gameplay .*visible=true.*title="TetriNET Playing Fields"/,
  repaint: /\[ctl\] \{"ok":true,"id":"gameplay-repaint"/,
  png: /\[input\] png-pixels .* at batch /,
};

const COMMON = [
  '--vlan-wire',
  '--quiet-api',
  '--quiet-blocks',
  '--batch-size=25000',
  '--repaint-every=1000',
  // Both ends spend most of their life idle in their message pump waiting on
  // the other, which is exactly what the default stuck-run guard is built to
  // stop. Here it is the expected shape of a working session.
  '--vlan-max-waits=100000000',
  '--stuck-after=10000000',
  '--max-batches=100000000',
  ...NET_TRACE,
];

async function main() {
  const server = spawn('server', [
    `--exe=${EXE}`, `--vlan-ip=${HOST_IP}`, `--input=${SERVER_INPUT}`,
    '--max-seconds=300',
    // Asked whether it is serving, the way the page's host probe asks.
    '--control-stdin',
    '--trace-api=socket,bind,listen,accept,recv,send,closesocket',
    `--count=${COUNT_SITES.join(',')}`,
    ...COMMON, ...extra(process.env.VLAN_SERVER_ARGS),
  ], 'VLAN_SERVER_LOG', SERVER_SIGNS);

  const hub = new ProcessHub();
  hub.add(server.child);

  let client = null;
  try {
    // The client is held back until the listener exists. Both ends drive their
    // own UI at their own speed, so starting them together would make the
    // connect land before the accept could answer it -- a race that would look
    // like a wire fault rather than a scheduling accident.
    await waitFor(server, SERVER_SIGNS.listen, 'the server to listen');
    check('TETRINET.EXE listens on the room address');

    // What marks the owner's room as hosting, so others are offered it: the
    // registry's hostProbe, answered from the server's own socket table.
    const probe = APPS.tetrinet.lan.hostProbe;
    check(`the server reads as serving on ${probe.listen} (lib/apps.js hostProbe)`,
      await askServing(server.child, probe));

    client = spawn('client', [
      `--exe=${EXE}`, `--vlan-ip=${PEER_IP}`, `--input=${CLIENT_INPUT}`,
      '--max-seconds=300',
      '--control-stdin',
      '--trace-api=socket,connect,send,recv,closesocket',
      // Slow the client's guest clock so its untouched pieces do not top out
      // and end the match before the server's A/B window.
      '--tick-ms-per-batch=20',
      ...COMMON, ...extra(process.env.VLAN_CLIENT_ARGS),
    ], 'VLAN_CLIENT_LOG', CLIENT_SIGNS);
    hub.add(client.child);

    await waitFor(client, CLIENT_SIGNS.connect, 'the client to connect');
    check('the client drives its own UI to a connect');
    check('a connected client does not read as serving',
      !(await askServing(client.child, probe)));

    await waitFor(server, SERVER_SIGNS.accept, 'the server to accept');
    check('the server accepts the client across the wire');

    await waitFor(server, SERVER_SIGNS.recv, 'the server to read the client');
    check('the server reads the client protocol stream');

    // Bytes crossing the wire once only proves the transport. The session is
    // real when the server acts on what it read and the client hears the
    // answer: TetriNET's server replies to a login with the player number it
    // assigned, then the team and player-join lines that put that player in
    // the room.
    await waitFor(server, SERVER_SIGNS.send, 'the server to answer the login');
    check('the server answers the login it just read');

    await waitFor(client, CLIENT_SIGNS.recv, 'the client to read the answer');
    check('the client reads the answer, closing the round trip');

    await waitFor(server, SERVER_SIGNS.start, 'the server to start a game');
    check('the server emits the TetriNET start-game packet');

    // The two guests run at very different batch rates. A fixed client batch
    // here used to capture its connect screen millions of server batches
    // before the game began. The client answers the start payload with a
    // five-byte protocol acknowledgement after constructing its game view,
    // so use that causal marker and ask the running CLI for a screenshot.
    await waitFor(client, CLIENT_SIGNS.start, 'the client to process the start-game packet');
    check('the client processes the start-game packet');

    client.child.stdin.write('click:40:455\n');
    await waitFor(client, CLIENT_SIGNS.fields, 'the client to raise its playing fields');
    client.child.stdin.write('dump-windows:client-gameplay\n');
    await waitFor(client, CLIENT_SIGNS.gameplay, 'the visible playing-fields window');
    check('the client opens the populated playing-fields window');

    if (CLIENT_PNG) {
      client.child.stdin.write(JSON.stringify({
        id: 'gameplay-repaint', action: 'eval', code: 'renderer.repaint()',
      }) + '\n');
      await waitFor(client, CLIENT_SIGNS.repaint, 'the remote gameplay repaint');
      client.child.stdin.write(`png-pixels:${CLIENT_PNG}\n`);
      await waitFor(client, CLIENT_SIGNS.png, 'the client session screenshot', 120000);
      check('the client gameplay screenshot is captured after game start');
    }
    if (SERVER_PNG) {
      await waitFor(server, SERVER_SIGNS.png, 'the server session screenshot', 120000);
      check('the server session screenshot is captured');
    }

    await waitFor(server, SERVER_SIGNS.abT1, 'the server A/B captures', 240000);
    const col = file => {
      const { PNG } = require('pngjs');
      const png = PNG.sync.read(fs.readFileSync(file));
      let x0 = Infinity, y0 = Infinity, y1 = -1;
      for (let y = 47; y <= 398; y++) for (let x = 21; x <= 212; x++) {
        const i = (y * png.width + x) * 4;
        const d = png.data;
        if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 60) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      }
      console.log(`${path.basename(file)}: coloured box x0=${x0} rows ${y0}..${y1}`);
      return Number.isFinite(x0) ? Math.floor((x0 - 21) / 16) : -1;
    };
    const c0 = col(AB_T0), c1 = col(AB_T1);
    console.log(`server falling piece: column ${c0} before, ${c1} after six presses of VK ${AB_VK}`);
    check('a falling piece is on the server field', c0 >= 0);
    if (AB_VK === 37) check('Left moves the falling piece left (unkeyed stays in its column)', c1 >= 0 && c1 <= c0 - 2);

    await waitFor(server, SERVER_SIGNS.countsB, 'the pinned hit counters', 120000);
    const counts = label => {
      const line = server.matched.get(label === 'a' ? SERVER_SIGNS.countsA : SERVER_SIGNS.countsB) || '';
      const m = line.match(/hit-counts:\w+: (.*) at batch (\d+)/);
      const v = Object.fromEntries(m[1].split(' ').map(kv => kv.split('=')).map(([k, n]) => [k, +n]));
      return [+m[2], v[COUNT_SITES[0]] | 0, v[COUNT_SITES[1]] | 0];
    };
    const a = counts('a'), b = counts('b');
    const gs = (b[0] - a[0]) * 0.2;
    console.log(`field draw counter, batches ${a[0]}..${b[0]} (${gs.toFixed(0)} guest-s): StretchBlt cells ${b[1] - a[1]} = ${((b[1] - a[1]) / gs).toFixed(2)}/guest-s, InvalidateRect ${b[2] - a[2]}`);
    check('the field draw counter ticks during the match', b[1] > a[1] || b[2] > a[2]);
  } finally {
    for (const s of [server, client]) if (s && !s.exited) s.child.kill('SIGTERM');
  }

  console.log(failures
    ? `test-vlan-tetrinet: ${failures} FAILED`
    : 'test-vlan-tetrinet: all checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch(err => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
