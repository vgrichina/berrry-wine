#!/usr/bin/env node
// The --control-stdin live channel end to end. This keeps the CLI run
// self-bounded with --max-seconds and talks only over stdin/stdout:
// ping, poll snapshot until Notepad is visible, type into the edit control,
// capture a PNG, and quit cleanly.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { startControlSession } = require('./control-session');

const ROOT = path.join(__dirname, '..');
const RUN = path.join(__dirname, 'run.js');
const EXE = path.join(__dirname, 'binaries', 'notepad.exe');

if (!fs.existsSync(EXE)) {
  console.log('SKIP  notepad.exe not found at', EXE);
  process.exit(0);
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'control-stdin-cli-'));
const pngPath = path.join(tmpDir, 'frame.png');

let failed = false;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (${detail})`}`);
  if (!ok) failed = true;
};

const privateClients = fs.readdirSync(__dirname)
  .filter(name => /^test-.*\.js$/.test(name))
  .filter(name => {
    const source = fs.readFileSync(path.join(__dirname, name), 'utf8');
    return source.includes('--control-stdin') &&
      /pending\s*=\s*new Map\s*\(\)/.test(source) &&
      /\\?\[ctl\\?\]/.test(source);
  });
check('control tests share one reply parser', privateClients.length === 0,
  privateClients.join(', '));

// --no-build on every spawn, the same as the rest of the CLI tests: this file
// starts run.js twice, and the build gate costs about ten seconds of CPU
// per invocation even when the wasm is already current. That is thirty times
// the work the test itself does (one batch of notepad, 0.3s), and on a loaded
// box it pushed the bounded run below past the 15s budget its check allows --
// which reads as "run.js hung" when nothing hung at all.
const session = startControlSession([
  RUN,
  `--exe=${EXE}`,
  '--no-build',
  '--control-stdin',
  '--max-seconds=45',
  '--quiet-api',
  '--quiet-blocks',
], { cwd: ROOT, idPrefix: 's' });
const { child, exited: childExit, send } = session;

async function typeText(text) {
  for (const ch of text) {
    const vk = /^[a-zA-Z0-9 ]$/.test(ch) ? ch.toUpperCase().charCodeAt(0) : null;
    if (vk !== null) await send(`keydown:${vk}`);
    await send(`keypress:${ch.charCodeAt(0)}`);
    if (vk !== null) await send(`keyup:${vk}`);
  }
}

async function waitFor(what, probe, ms = 45000) {
  const deadline = Date.now() + ms;
  let last;
  while (Date.now() < deadline) {
    last = await probe();
    if (last) return last;
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`timed out waiting for ${what}; last=${JSON.stringify(last)}\n--- child output tail ---\n${session.output().slice(-2000)}`);
}

(async () => {
  const ping = await waitFor('ping', async () => {
    try { return await send({ action: 'ping' }); } catch (_) { return null; }
  });
  check('ping answers over stdin', ping.pong === true && /notepad/i.test(ping.app || ''), JSON.stringify(ping));

  const snap = await waitFor('a visible main window', async () => {
    const s = await send({ action: 'snapshot' });
    const main = (s.windows || []).find(w => !w.isChild && w.visible);
    return main ? s : null;
  });
  const main = snap.windows.find(w => !w.isChild && w.visible);
  check('snapshot streams over stdin', /notepad/i.test(main.title), JSON.stringify(main));

  await typeText('ok');
  const dump = await waitFor('typed text in the edit', async () => {
    const out = await send('dump-main-edit');
    const text = JSON.stringify(out);
    return /text=\\"ok\\"/.test(text) ? out : null;
  });
  check('typed text landed through stdin control', /text=\\"ok\\"/.test(JSON.stringify(dump)), JSON.stringify(dump));

  const pngOut = await send(`png:${pngPath}`);
  const pngOk = fs.existsSync(pngPath) && fs.statSync(pngPath).size > 1000;
  check('png command wrote a real file', pngOk, `${JSON.stringify(pngOut)} size=${fs.existsSync(pngPath) ? fs.statSync(pngPath).size : 0}`);

  await send({ action: 'quit' });
  child.stdin.end();
  const code = await Promise.race([
    childExit,
    new Promise(r => setTimeout(() => r('timeout'), 15000)),
  ]);
  check('quit ends the self-bounded run cleanly', code === 0, `exit=${code}`);

  const preload = path.join(tmpDir, 'stdin-without-unref.js');
  fs.writeFileSync(preload,
    "Object.defineProperty(process.stdin, 'unref', { value: undefined, configurable: true });\n");
  const bounded = spawn('node', [
    '-r', preload,
    RUN,
    `--exe=${EXE}`,
    '--no-build',
    '--control-stdin',
    '--max-seconds=0.05',
    '--max-batches=100000',
    '--quiet-api',
    '--quiet-blocks',
  ], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  let boundedOutput = '';
  bounded.stdout.on('data', data => { boundedOutput += data; });
  bounded.stderr.on('data', data => { boundedOutput += data; });
  const boundedCode = await Promise.race([
    new Promise(resolve => bounded.on('exit', resolve)),
    new Promise(resolve => setTimeout(() => resolve('timeout'), 15000)),
  ]);
  check('internal timeout closes stdin without requiring unref',
    boundedCode === 0 && !/TypeError|stdin\.unref/.test(boundedOutput),
    `exit=${boundedCode} output=${boundedOutput.slice(-1000)}`);

  const abandoned = startControlSession([
    '-e', 'process.stdin.once("data", () => process.exit(7))',
  ], { cwd: ROOT, idPrefix: 'drop' });
  const abandonedResult = abandoned.send({ action: 'ping' }).then(
    value => ({ value }),
    error => ({ error }),
  );
  const abandonedCode = await abandoned.exited;
  const abandonedReply = await abandonedResult;
  check('child exit rejects every pending control request',
    abandonedCode === 7 && abandonedReply.error instanceof Error &&
      /run\.js exited before replying to drop1 \(exit 7\)/
        .test(abandonedReply.error.message),
    `exit=${abandonedCode} reply=${JSON.stringify(abandonedReply)}`);

  // A trace window controls diagnostics, never the request/reply protocol.
  // Keep the window closed throughout this actual production-harness run.
  for (const traceWindow of ['--trace-from=1000000000', '--trace-to=0']) {
    const windowed = startControlSession([
      RUN, `--exe=${EXE}`, '--no-build', '--control-stdin',
      '--max-seconds=3', '--quiet-api', '--quiet-blocks',
      traceWindow,
    ], { cwd: ROOT, idPrefix: 'window-' });
    let windowReply, windowError;
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      windowReply = await windowed.send({ action: 'ping' });
      const bad = await windowed.send({ action: 'eval', code: 'throw new Error("window-error")' })
        .then(() => null, error => error);
      check('error ACK survives a closed trace window', /window-error/.test(String(bad)), String(bad));
      const snapshot = await windowed.send({ action: 'snapshot' });
      check('observation ACK survives a closed trace window', Number.isInteger(snapshot.batch), JSON.stringify(snapshot));
      await windowed.send('keydown:13');
      await windowed.send('keyup:13');
      check('ordinary input ACKs survive a closed trace window', true);
      await windowed.quit();
    } catch (error) {
      windowError = error;
      await windowed.exited;
    }
    check('success ACK survives a closed trace window', windowReply?.pong === true && !windowError,
      `${traceWindow}: ${String(windowError || JSON.stringify(windowReply))}`);
  }
})().catch(error => {
  console.log('FAIL  ' + (error.stack || error.message));
  failed = true;
}).finally(async () => {
  try {
    if (child.exitCode === null) {
      child.stdin.end();
      child.kill('SIGTERM');
    }
  } catch (_) {}
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  console.log(failed ? 'TEST FAILED' : 'TEST PASSED');
  process.exit(failed ? 1 : 0);
});
