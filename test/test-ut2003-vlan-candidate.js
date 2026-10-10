#!/usr/bin/env node
// Authentic UT2003 demo dedicated server + direct-connect client on one vln/1
// segment. This remains a candidate gate until both sides reach gameplay.

'use strict';

const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');
const { PNG } = require('pngjs');
const { ProcessHub } = require('../lib/vlan-wire');

const ROOT = path.join(__dirname, '..');
const SERVER_IP = '10.0.0.1';
const CLIENT_IP = '10.0.0.2';
const TMP = process.env.TMPDIR || '/private/tmp';
const WINDOW_BYTES = 128 * 1024;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const GUEST_LOGS = `(() => [...ctx.vfs.files]
  .filter(([name]) => /\\.log$/i.test(name))
  .map(([name, entry]) => ({ name, tail: Buffer.from(entry.data).toString('latin1').slice(-16000) })))()`;

function spawn(name, args, watch) {
  const child = fork(path.join(ROOT, 'test', 'run.js'), args,
    { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe', 'ipc'] });
  const logPath = path.join(TMP, `ut2003-vlan-${name}.log`);
  const fd = fs.openSync(logPath, 'w');
  const state = { name, child, watch, hits: new Set(), window: '', exited: false,
    exitCode: null, exitSignal: null, logPath };
  const collect = chunk => {
    fs.writeSync(fd, chunk);
    state.window = (state.window + chunk.toString()).slice(-WINDOW_BYTES);
    for (const re of watch) if (!state.hits.has(re) && re.test(state.window)) state.hits.add(re);
  };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  child.on('exit', (code, signal) => {
    state.exited = true; state.exitCode = code; state.exitSignal = signal; fs.closeSync(fd);
  });
  return state;
}

const exitReason = state => `code=${state.exitCode} signal=${state.exitSignal || 'none'}`;

async function waitFor(state, re, what, timeoutMs = 300000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (state.hits.has(re)) return;
    if (state.exited) throw new Error(`${state.name} exited (${exitReason(state)}) before ${what}; log: ${state.logPath}`);
    await sleep(250);
  }
  throw new Error(`timed out waiting for ${what}; log: ${state.logPath}`);
}

async function waitForGameplayFrame(state, filename, timeoutMs = 300000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    if (state.exited) throw new Error(`${state.name} exited (${exitReason(state)}) before rendering gameplay; log: ${state.logPath}`);
    try { fs.unlinkSync(filename); } catch (err) { if (err.code !== 'ENOENT') throw err; }
    requestPng(state, filename);
    await sleep(2500);
    if (fs.existsSync(filename)) {
      try {
        assertRenderedScene(filename, 'UT2003 client');
        assertGameplayChrome(filename, 'UT2003 client');
        return;
      } catch (err) { lastError = err; }
    }
    await sleep(2500);
  }
  throw new Error(`timed out waiting for a rendered gameplay frame; last check: ${lastError || 'no PNG'}; log: ${state.logPath}`);
}

async function waitForTexturedFirstPerson(state, filename, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    if (state.exited) throw new Error(`${state.name} exited (${exitReason(state)}) before textured first-person gameplay; log: ${state.logPath}`);
    try { fs.unlinkSync(filename); } catch (err) { if (err.code !== 'ENOENT') throw err; }
    requestPng(state, filename);
    await sleep(2500);
    if (fs.existsSync(filename)) {
      try {
        assertRenderedScene(filename, 'UT2003 client after Fire');
        assertGameplayChrome(filename, 'UT2003 client after Fire');
        assertJoinPromptGone(filename, 'UT2003 client after Fire');
        assertTexturedFirstPerson(filename, 'UT2003 client after Fire');
        return;
      } catch (err) { lastError = err; }
    }
    await sleep(2500);
  }
  throw new Error(`timed out waiting for textured first-person gameplay; last check: ${lastError || 'no PNG'}; log: ${state.logPath}`);
}

const common = (ip, maxSeconds, render, batchSize = 20000) => [
  '--app=ut2003_demo', '--vlan-wire', `--vlan-ip=${ip}`,
  ...(render ? ['--headless-gl'] : []),
  '--quiet-api', '--quiet-blocks', '--trace-net',
  '--x87-fusion',
  '--control-stdin', '--vlan-max-waits=100000000',
  '--tick-ms-per-batch=5', `--batch-size=${batchSize}`,
  '--max-batches=100000000', `--max-seconds=${maxSeconds}`,
];

function requestDiagnostics(state) {
  if (!state || state.exited) return;
  state.child.stdin.write(`${JSON.stringify({ action: 'eval', code: GUEST_LOGS })}\n`);
  state.child.stdin.write(`${JSON.stringify({
    action: 'png', path: path.join(TMP, `ut2003-vlan-${state.name}.png`),
  })}\n`);
}

function requestPng(state, filename) {
  state.child.stdin.write(`${JSON.stringify({ action: 'png', path: filename })}\n`);
}

async function stopChild(state) {
  if (!state) return;
  if (!state.exited) state.child.kill('SIGTERM');
  if (state.child.connected) state.child.disconnect();
  state.child.stdin.end();
  const deadline = Date.now() + 3000;
  while (!state.exited && Date.now() < deadline) await sleep(50);
  if (!state.exited) {
    // A completed probe must never leave either 512 MiB guest resident.
    state.child.kill('SIGKILL');
    while (!state.exited && Date.now() < deadline + 1000) await sleep(50);
  }
}

function assertRenderedScene(filename, label) {
  const png = PNG.sync.read(fs.readFileSync(filename));
  const colors = new Set();
  // Ignore the title bar and sample the client area. A blank compositor frame
  // has only a handful of colors; a rendered Antalus frame has thousands.
  for (let y = 32; y < png.height; y += 2) for (let x = 0; x < png.width; x += 2) {
    const at = (y * png.width + x) * 4;
    colors.add(`${png.data[at]},${png.data[at + 1]},${png.data[at + 2]},${png.data[at + 3]}`);
    if (colors.size > 128) return;
  }
  throw new Error(`${label} did not publish a rendered gameplay frame (${colors.size} sampled colors): ${filename}`);
}

function assertGameplayChrome(filename, label) {
  const png = PNG.sync.read(fs.readFileSync(filename));
  const bottomColors = new Set();
  let bright = 0, samples = 0;
  // The loading screen is richly coloured too, but its bottom strip is nearly
  // uniform and dark. Gameplay/join frames contain the HUD and prompt here.
  for (let y = Math.max(0, png.height - 50); y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const at = (y * png.width + x) * 4;
      const r = png.data[at], g = png.data[at + 1], b = png.data[at + 2];
      bottomColors.add(`${r},${g},${b}`);
      if (r + g + b > 600) bright++;
      samples++;
    }
  }
  if (bottomColors.size < 512 || bright / samples < 0.01) {
    throw new Error(`${label} still resembles a loading/non-gameplay frame ` +
      `(bottom colors=${bottomColors.size}, bright=${(bright / samples).toFixed(4)}): ${filename}`);
  }
}

function assertTexturedFirstPerson(filename, label) {
  const png = PNG.sync.read(fs.readFileSync(filename));
  let paleGray = 0, samples = 0;
  // The broken D3D8-capability path rendered the entire first-person weapon as
  // flat pale gray. Antalus has no comparably large pale patch in this stable
  // lower-right viewport region once the weapon material is sampled.
  for (let y = 180; y < Math.min(430, png.height); y++) {
    for (let x = 420; x < png.width; x++) {
      const at = (y * png.width + x) * 4;
      const r = png.data[at], g = png.data[at + 1], b = png.data[at + 2];
      if (Math.max(r, g, b) - Math.min(r, g, b) < 8 && r > 180) paleGray++;
      samples++;
    }
  }
  if (paleGray / samples > 0.12) {
    throw new Error(`${label} contains the flat-gray missing-material signature ` +
      `(${(paleGray / samples).toFixed(4)}): ${filename}`);
  }
}

function assertJoinPromptGone(filename, label) {
  const png = PNG.sync.read(fs.readFileSync(filename));
  let bright = 0, samples = 0;
  // Spectator/join mode paints the large white "Press [Fire] to join" text
  // across the bottom centre. Once the pawn is possessed this part of the HUD
  // is transparent; health and ammo remain confined to the two corners.
  for (let y = 440; y < png.height; y++) {
    for (let x = 120; x < Math.min(520, png.width); x++) {
      const at = (y * png.width + x) * 4;
      if (png.data[at] + png.data[at + 1] + png.data[at + 2] > 600) bright++;
      samples++;
    }
  }
  if (bright / samples >= 0.05) {
    throw new Error(`${label} still contains the spectator join-prompt signature ` +
      `(${(bright / samples).toFixed(4)} bright bottom-centre pixels): ${filename}`);
  }
}

async function main() {
  const serverReady = /\[SetWindowText\] "Unreal Tournament 2003 \(Running\)"/;
  const serverReceive = /arrived DGRAM 10\.77\.0\.2:/;
  const clientSend = /\[net\] -> DGRAM 10\.77\.0\.2:\d+ -> 10\.77\.0\.1:7777 len=46/;
  const clientReady = /\[SetWindowText\] "Unreal Tournament 2003 \(Running\)"/;
  // A network client deliberately retains the generic UT2003 window caption,
  // and its in-memory log can stop mid-line while the world is already live.
  // Treat the presented HUD/world pixels as the gameplay readiness signal.
  const server = spawn('server', [
    ...common(SERVER_IP, 700, false),
    // The dedicated guest advances far faster than the D3D client while the
    // latter precaches Antalus. An ordinary 20-minute limit can therefore
    // expire before the client presents its first frame, producing the
    // post-match "view a different player" prompt instead of live gameplay.
    '--args=server DM-Antalus?game=XGame.XDeathmatch?TimeLimit=0?GoalScore=0 -server -nosound',
  ], [serverReady, serverReceive]);
  const hub = new ProcessHub();
  hub.add(server.child);
  let client;
  try {
    await waitFor(server, serverReady, 'the listen server to enter Antalus gameplay');
    // The graphical listen server consumed a second native GL context and
    // repeatedly starved the client during its level GC. UT2003's own server
    // commandlet keeps the same game/net code without a rendered world. Keep
    // full slices: tiny slices advance its per-batch clock too quickly and
    // can manufacture a keepalive flood while the client is still loading.
    console.log('ok  UT2003 dedicated server entered Antalus gameplay');
    client = spawn('client', [
      // 100k retires 18.5% more guest blocks per fixed minute than 20k during
      // this CPU-bound precache, and matches the browser's normal run slice.
      ...common(CLIENT_IP, 480, true, 100000),
      '--args=10.0.0.1 -d3d -window -nosound',
    ], [clientSend, clientReady]);
    hub.add(client.child);
    await waitFor(client, clientSend, 'the client to send a datagram');
    console.log('ok  UT2003 client sent its native UDP protocol datagram');
    await waitFor(server, serverReceive, 'the server to receive the client datagram');
    console.log('ok  UT2003 server received the client datagram across vln/1');
    // Capturing before this point asks the canvas for a 2D context before the
    // guest creates D3D. Native canvases cannot then be converted to WebGL.
    await waitFor(client, clientReady, 'the client to create its D3D viewport');
    console.log('ok  UT2003 client created its D3D viewport');
    const readyPng = path.join(TMP, 'ut2003-vlan-client-ready.png');
    await waitForGameplayFrame(client, readyPng);
    console.log('ok  UT2003 client published a rendered Antalus frame');
    // The replicated client arrives as a spectator and asks for its configured
    // Fire action before spawning. Drive the renderer's real pointer path: it
    // focuses/hit-tests the viewport, queues WM_LBUTTONDOWN/UP, and updates the
    // DirectInput mouse device exactly as a browser click does.
    let joined = false;
    try { assertJoinPromptGone(readyPng, 'UT2003 client'); joined = true; } catch (_) {}
    for (let attempt = 0; !joined && attempt < 12; attempt++) {
      client.child.stdin.write(`${JSON.stringify({ cmd: 'mousedown:320:240' })}\n`);
      await sleep(1000);
      client.child.stdin.write(`${JSON.stringify({ cmd: 'mouseup:320:240' })}\n`);
      await sleep(4650);
      const probePng = path.join(TMP, 'ut2003-vlan-client.png');
      requestPng(client, probePng);
      await sleep(1500);
      try {
        assertJoinPromptGone(probePng, 'UT2003 client after Fire');
        joined = true;
      } catch (err) {
        if (attempt === 11) throw err;
      }
    }
    client.child.stdin.write(`${JSON.stringify({ action: 'eval', code: GUEST_LOGS })}\n`);
    const clientPng = path.join(TMP, 'ut2003-vlan-client.png');
    await waitForTexturedFirstPerson(client, clientPng);
    console.log('ok  UT2003 client retained textured first-person gameplay after Fire');
    server.child.stdin.write(`${JSON.stringify({ action: 'quit' })}\n`);
    client.child.stdin.write(`${JSON.stringify({ action: 'quit' })}\n`);
    await sleep(1000);
  } catch (err) {
    requestDiagnostics(server);
    requestDiagnostics(client);
    await sleep(3000);
    throw err;
  } finally {
    await Promise.all([stopChild(client), stopChild(server)]);
  }
  console.log('test-ut2003-vlan-candidate: network client gameplay observed');
}

main().catch(err => { console.error(err.stack || err); process.exitCode = 1; });
