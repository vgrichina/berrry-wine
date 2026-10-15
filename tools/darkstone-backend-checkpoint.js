#!/usr/bin/env node
'use strict';
// Bounded MENU capture, or one reviewed New Game click. Requires runtime grant.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const MODULE = '04ede400070b3acbdcc2ad5f3c033bcf051e3d2da9a4d28a449324d23ab0ba17';
const FIXTURE = '7379dca78b373080febeb6fce4282c284faa234deec8185870041e508cc3f673';

// Observe the actual compiled Module object subsequently owned by wine.
// Hashing finishes before compile returns; no guest exports are invoked.
function installModuleObserver() {
  const modules = new WeakMap();
  const original = WebAssembly.compile;
  WebAssembly.compile = async function (bytes, ...rest) {
    const copy = ArrayBuffer.isView(bytes)
      ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength).slice()
      : new Uint8Array(bytes).slice();
    const digest = await crypto.subtle.digest('SHA-256', copy);
    const hash = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
    const module = await original.call(WebAssembly, bytes, ...rest);
    modules.set(module, { sha256: hash, bytes: copy.length });
    return module;
  };
  globalThis.__darkstoneModuleIdentity = () => modules.get(globalThis.wine?._wasmModule) || null;
}

function fixtureIdentity(root) {
  const dir = path.join(root, 'test/binaries/win98-games-a-d/DarkstoneDemo-D3D/installed');
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, '.wine-assembly-browser.json')));
  const names = [...new Set([...manifest.files.map(f => f.url), 'darkstonedemo.exe', '.wine-assembly-browser.json'])].sort();
  const rows = names.map(name => {
    if (path.isAbsolute(name) || name.split(/[\\/]/).includes('..')) throw new Error('Unsafe fixture URL');
    return sha(fs.readFileSync(path.join(dir, name))) + '  ' + name + '\n';
  }).join('');
  return { paths: names.length, sha256: sha(rows), rows };
}

function plan({ root, out, origin, backend, checkpoint = 'menu' }) {
  if (!['software', 'webgl'].includes(backend)) throw new Error('backend must be software or webgl');
  if (!['menu', 'new-game'].includes(checkpoint)) throw new Error('checkpoint must be menu or new-game');
  const u = new URL(origin);
  if (!['http:', 'https:'].includes(u.protocol) || u.origin !== origin || !['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname)) throw new Error('Use a private loopback origin without path');
  if (/[;\r\n]/.test(out + root)) throw new Error('Unsafe probe path');
  const steps = [
    'wait:20000', 'keydown:Escape', 'wait:1000', 'keyup:Escape', 'wait:10000',
    `shot:${out}/menu.png`, `evalfile:${root}/tools/capture-legacy-render-evidence.js`,
    `evalfile:${out}/module-readout.js`, 'wait:2000',
    `evalfile:${root}/tools/capture-legacy-render-evidence.js`,
  ];
  if (checkpoint === 'new-game') steps.push('canvasclick:0.5,0.483', 'wait:3000',
    `shot:${out}/new-game.png`, `evalfile:${root}/tools/capture-legacy-render-evidence.js`);
  return [path.join(root, 'tools/web-input-probe.js'), `--url=${origin}`, '--app=darkstone_demo', '--gpu', '--threads',
    `--query=?debug&d3d-renderer=${backend}`, '--launch=30000', '--launcher-wait=30000', '--protocol-timeout=30000',
    `--before-load=@${out}/module-observer.js`, `--console-out=${out}/console.log`, `--steps=${steps.join(';')}`];
}

async function main() {
  const options = Object.fromEntries(process.argv.slice(2).map(arg => {
    const m = /^--(root|out|origin|backend|checkpoint)=(.+)$/.exec(arg);
    if (!m) throw new Error('Expected --root=CHECKOUT --out=NEW_DIRECTORY --origin=http://127.0.0.1:PORT --backend=software|webgl [--checkpoint=menu|new-game]');
    return [m[1], m[2]];
  }));
  for (const k of ['root', 'out', 'origin', 'backend']) if (!options[k]) throw new Error(`Missing ${k}`);
  options.root = fs.realpathSync(options.root);
  options.out = path.resolve(options.out);
  const args = plan(options);
  const before = fixtureIdentity(options.root);
  if (before.paths !== 15 || before.sha256 !== FIXTURE) throw new Error('Fixture pin mismatch');
  const disk = sha(fs.readFileSync(path.join(options.root, 'build/wine-assembly.wasm')));
  if (disk !== MODULE) throw new Error('Canonical module pin mismatch');
  const response = await fetch(options.origin + '/build/wine-assembly.wasm', { signal: AbortSignal.timeout(15000) });
  if (!response.ok || sha(Buffer.from(await response.arrayBuffer())) !== MODULE) throw new Error('HTTP module pin mismatch');
  for (const row of before.rows.trimEnd().split('\n')) {
    const expected = row.slice(0, 64), name = row.slice(66);
    const url = options.origin + '/test/binaries/win98-games-a-d/DarkstoneDemo-D3D/installed/' + name.split('/').map(encodeURIComponent).join('/');
    const file = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!file.ok || sha(Buffer.from(await file.arrayBuffer())) !== expected) throw new Error(`HTTP fixture pin mismatch: ${name}`);
  }
  fs.mkdirSync(options.out); // Existing evidence is never overwritten.
  fs.writeFileSync(path.join(options.out, 'fixture-before.sha256'), before.rows);
  fs.writeFileSync(path.join(options.out, 'module-observer.js'), `(${installModuleObserver.toString()})();`);
  fs.writeFileSync(path.join(options.out, 'module-readout.js'), '({loadedModule:globalThis.__darkstoneModuleIdentity?.() ?? null,userAgent:navigator.userAgent,crossOriginIsolated:globalThis.crossOriginIsolated})');
  fs.writeFileSync(path.join(options.out, 'invocation.json'), JSON.stringify({ startedAt: new Date().toISOString(), executable: process.execPath, args, expectedModule: MODULE, expectedFixture: FIXTURE }, null, 2));
  const fd = fs.openSync(path.join(options.out, 'output.log'), 'wx');
  const run = spawnSync('timeout', ['--signal=TERM', '--kill-after=10s', '180s', process.execPath, ...args], { cwd: options.root, stdio: ['ignore', fd, fd], timeout: 195000 });
  fs.closeSync(fd);
  const after = fixtureIdentity(options.root);
  fs.writeFileSync(path.join(options.out, 'fixture-after.sha256'), after.rows);
  const log = fs.readFileSync(path.join(options.out, 'output.log'), 'utf8');
  const readout = log.split('\n').find(line => line.startsWith(`evalfile ${options.out}/module-readout.js => `));
  const identity = readout ? JSON.parse(readout.slice(readout.indexOf(' => ') + 4)) : null;
  const loadedMatches = identity?.loadedModule?.sha256 === MODULE;
  const summary = { endedAt: new Date().toISOString(), status: run.status, signal: run.signal, error: run.error?.message ?? null,
    fixturesUnchanged: after.sha256 === before.sha256, loadedMatches, identity,
    diskModuleUnchanged: sha(fs.readFileSync(path.join(options.root, 'build/wine-assembly.wasm'))) === MODULE,
    checkpoint: (options.checkpoint || 'menu') + '-unreviewed', backendQualification: 'unknown', gameplayQualification: 'not-attempted',
    cleanup: 'Probe closes its browser in finally; independent process-tree verification still required.' };
  fs.writeFileSync(path.join(options.out, 'summary.json'), JSON.stringify(summary, null, 2));
  if (run.status !== 0 || !summary.fixturesUnchanged || !summary.diskModuleUnchanged || !loadedMatches) process.exitCode = 1;
  console.log(JSON.stringify(summary));
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { plan, fixtureIdentity, installModuleObserver, MODULE, FIXTURE };
