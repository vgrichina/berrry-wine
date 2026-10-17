#!/usr/bin/env node
'use strict';
// Private persistent observation. Ordinary queued input requires scene review.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { preflight, runChild, ROOT, MODULE } = require('./fifa98-remote-startup');
const inventory = require('../docs/fixtures/fifa98-demo-inventory.json');
const OUT = '/home/user/fifa98-browser-evidence-1';
const HELPER = '/home/user/fifa98-browser-helper';
const ORIGIN = 'http://127.0.0.1:8321';
const PROBE_COMMIT = 'fc435473c71e7e5e7890b15482e6ecfe69048535';
const PROBE_HASH = 'f50ddeb743b8596da508c84f1abc0262ee9e1b22317fc106c259d8ac390ca973';
const RENDER_HASH = 'f94500f796d32dbce2053ec117c0963c85c4bd708b662422480f9562e7cc2318';
const RECEIPT = '/home/user/darkstone-menu-evidence-3/preflight.json';
const RECEIPT_HASH = '52d6d80b272fa670ef0a6c781bb4f3e7d8484d333bf0b2199a9ed106178faa30';
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const hash = p => sha(fs.readFileSync(p));
const save = (name, value) => fs.writeFileSync(OUT + '/' + name, JSON.stringify(value, null, 2));
function overlayProbe(source) {
  assert.equal(sha(source), PROBE_HASH);
  const before = "['Enter', 'Escape', 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Backspace', 'Space']";
  const after = "['Enter', 'Escape', 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Backspace', 'Space', 'KeyS', 'KeyD', 'KeyA', 'KeyW', 'Digit1']";
  const text = source.toString(); assert.equal(text.split(before).length, 2);
  return text.replace(before, after);
}
function observer() {
  const modules = new WeakMap(), original = WebAssembly.compile;
  WebAssembly.compile = async function (bytes, ...rest) {
    const copy = ArrayBuffer.isView(bytes)
      ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength).slice()
      : new Uint8Array(bytes).slice();
    const digest = await crypto.subtle.digest('SHA-256', copy);
    const hash = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
    const module = await original.call(WebAssembly, bytes, ...rest);
    modules.set(module, { sha256: hash, bytes: copy.length }); return module;
  };
  globalThis.__fifaModuleIdentity = () => modules.get(globalThis.wine?._wasmModule) || null;
}
function plan() {
  const steps = ['wait:90000', `shot:${OUT}/idle-a.png`, 'wait:3000',
    `shot:${OUT}/idle-b.png`, `evalfile:${OUT}/module-readout.js`];
  return [HELPER + '/tools/web-input-probe.js', '--url=' + ORIGIN,
    '--app=fifa98_demo', '--gpu', '--threads', '--query=?debug', '--launch=30000',
    '--launcher-wait=30000', '--protocol-timeout=30000',
    '--before-load=@' + OUT + '/module-observer.js', '--console-out=' + OUT + '/console.log',
    '--steps=' + steps.join(';'), '--commands=' + OUT + '/commands'];
}
async function httpHash(url, expected) {
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  assert(r.ok, url); assert.equal(sha(Buffer.from(await r.arrayBuffer())), expected, url);
}
async function main() {
  assert(!fs.existsSync(OUT) && !fs.existsSync(HELPER), 'never overwrite prior helpers/evidence');
  const before = preflight();
  assert.equal(hash(RECEIPT), RECEIPT_HASH);
  const browserFiles = JSON.parse(fs.readFileSync(RECEIPT)).browserFiles;
  for (const row of browserFiles) assert.equal(hash(row.path), row.sha256, row.path);
  fs.mkdirSync(OUT); save('preflight.json', { ...before, browserFiles });
  fs.mkdirSync(OUT + '/commands'); fs.mkdirSync(HELPER + '/tools', { recursive: true });
  fs.symlinkSync('/home/user/wa-darkstone-validation/node_modules', HELPER + '/node_modules');
  const show = file => cp.execFileSync('git', ['show', PROBE_COMMIT + ':' + file],
    { cwd: '/home/user/wa-darkstone-validation', timeout: 30000, maxBuffer: 1024 * 1024 });
  const probe = overlayProbe(show('tools/web-input-probe.js'));
  const render = show('tools/capture-legacy-render-evidence.js'); assert.equal(sha(render), RENDER_HASH);
  fs.writeFileSync(HELPER + '/tools/web-input-probe.js', probe, { flag: 'wx' });
  fs.writeFileSync(HELPER + '/tools/capture-legacy-render-evidence.js', render, { flag: 'wx' });
  save('helper-identity.json', { probeSource: PROBE_COMMIT, originalHash: PROBE_HASH,
    overlayHash: sha(probe), rendererHash: RENDER_HASH,
    delta: 'Only queued key whitelist adds KeyS,KeyD,KeyA,KeyW,Digit1; all bounds and validators retained.' });
  fs.writeFileSync(OUT + '/module-observer.js', `(${observer.toString()})();`);
  fs.writeFileSync(OUT + '/module-readout.js', '({loadedModule:globalThis.__fifaModuleIdentity?.()??null,userAgent:navigator.userAgent,crossOriginIsolated:globalThis.crossOriginIsolated})');
  fs.copyFileSync(__filename, OUT + '/browser-controller.js');
  const serverFd = fs.openSync(OUT + '/server.log', 'wx');
  const server = cp.spawn(process.execPath, ['tools/dev-server.js', '--host=127.0.0.1', '--port=8321', '--isolate'],
    { cwd: ROOT, detached: true, stdio: ['ignore', serverFd, serverFd] });
  let serverError = null, interrupted = null, serverKillTimer;
  server.once('error', error => { serverError = error; });
  const signalServer = signal => { if (server.pid) try { process.kill(-server.pid, signal); }
    catch (error) { if (error.code !== 'ESRCH') throw error; } };
  const stopServer = signal => {
    interrupted = signal; signalServer('SIGTERM');
    if (!serverKillTimer) serverKillTimer = setTimeout(() => signalServer('SIGKILL'), 3000);
  };
  const terminate = () => stopServer('SIGTERM'), interrupt = () => stopServer('SIGINT');
  process.on('SIGTERM', terminate); process.on('SIGINT', interrupt);
  save('server-process.json', { controllerPid: process.pid, pid: server.pid, pgid: server.pid });
  let terminal;
  try {
    let ready = false;
    for (let i = 0; i < 50; i++) {
      assert(!serverError && !interrupted, 'server start interrupted or failed');
      try { const r = await fetch(ORIGIN + '/index.html', { signal: AbortSignal.timeout(1000) }); if (r.ok) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(ready, 'private server not ready');
    await httpHash(ORIGIN + '/build/wine-assembly.wasm', MODULE);
    const fixtureUrl = ORIGIN + '/test/binaries/candidates/fifa98-demo/';
    await httpHash(fixtureUrl + '.wine-assembly-browser.json', inventory.manifestSha256);
    // Read-only HTTP verification may run concurrently; no guest is launched yet.
    for (let i = 0; i < inventory.files.length; i += 8) await Promise.all(inventory.files.slice(i, i + 8)
      .map(row => httpHash(fixtureUrl + row.path.split('/').map(encodeURIComponent).join('/'), row.sha256)));
    assert(!interrupted, 'controller interrupted before browser launch');
    const args = plan(); save('invocation.json', { at: new Date().toISOString(), args, initialInput: [],
      queueDeadlineMs: 420000, processLimitMs: 480000, expectedModule: MODULE });
    const fd = fs.openSync(OUT + '/probe.log', 'wx');
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      !key.startsWith('WINE_') && !key.startsWith('WA_') && key !== 'NODE_OPTIONS' && key !== 'NODE_PATH'));
    env.CHROME = '/opt/google/chrome/chrome';
    try { terminal = await runChild(process.execPath, args, { cwd: ROOT, env, stdio: ['ignore', fd, fd] },
      p => save('probe-process.json', p), 480000, 3000); } finally { fs.closeSync(fd); }
    save('terminal.json', terminal);
  } finally {
    signalServer('SIGTERM');
    await new Promise(resolve => {
      if (server.exitCode !== null || server.signalCode !== null) return resolve();
      const timer = setTimeout(() => { signalServer('SIGKILL'); resolve(); }, 3000);
      server.once('exit', () => { clearTimeout(timer); resolve(); });
    });
    clearTimeout(serverKillTimer);
    process.removeListener('SIGTERM', terminate); process.removeListener('SIGINT', interrupt);
    fs.closeSync(serverFd);
  }
  const after = preflight();
  for (const row of browserFiles) assert.equal(hash(row.path), row.sha256, row.path);
  assert.equal(hash(HELPER + '/tools/web-input-probe.js'), sha(probe));
  assert.equal(hash(HELPER + '/tools/capture-legacy-render-evidence.js'), RENDER_HASH);
  save('postflight.json', { ...after, browserFiles });
  const log = fs.readFileSync(OUT + '/probe.log', 'utf8');
  const line = log.split('\n').find(line => line.startsWith('evalfile ' + OUT + '/module-readout.js => '));
  const identity = line ? JSON.parse(line.slice(line.indexOf(' => ') + 4)) : null;
  save('summary.json', { identity, loadedMatches: identity?.loadedModule?.sha256 === MODULE,
    terminal, gameplayQualification: 'unreviewed', initialInput: [] });
  assert.equal(identity?.loadedModule?.sha256, MODULE);
  assert.equal(terminal.status, 0); assert(!terminal.timedOut && !terminal.interrupted);
  assert.equal(terminal.remainingGroupProcesses.length, 0);
}
if (require.main === module) main().catch(error => {
  if (fs.existsSync(OUT)) save('controller-error.json', { error: error.stack });
  console.error(error.stack); process.exitCode = 1;
});
module.exports = { plan, overlayProbe, PROBE_HASH, OUT, HELPER };
