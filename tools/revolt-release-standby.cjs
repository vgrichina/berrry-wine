'use strict';
const fs = require('node:fs');
const cp = require('node:child_process');
const assert = require('node:assert/strict');

// A standby has no operation identity and no endpoint until consumed. Captures
// may share it; a real operation consumes it exactly once, before publishing cfg.
function create({out, script, check, save, spawn = cp.spawn, now = Date.now,
  sleep = ms => new Promise(r => setTimeout(r, ms))}) {
  let pending = null, sequence = 0, closed = false;
  const used = new Set();
  function live(p) {
    check(); assert(!closed, 'standby lifecycle closed');
    assert(p && p.child.exitCode === null && p.child.signalCode === null, 'standby child live');
    assert(!p.child.stdin.destroyed && p.stdout === '' && p.stderr === '', 'unarmed standby has no output');
    assert(!fs.existsSync(p.file), 'standby config unpublished');
    const marker = JSON.parse(fs.readFileSync(p.file + '.prepared'));
    assert.equal(marker.pid, p.child.pid, 'standby marker PID');
    assert.equal(marker.importsReady, true); assert.equal(marker.armed, false);
    assert(Number.isFinite(marker.at) && marker.at <= now(), 'standby marker time');
    return p;
  }
  async function prepare() {
    check(); assert(!closed, 'standby lifecycle closed');
    if (pending) return live(pending);
    const name = 'standby-' + sequence++, file = out + '/' + name + '-release-config.json';
    assert(!fs.existsSync(file) && !fs.existsSync(file + '.prepared'), 'fresh standby path');
    const child = spawn(process.execPath, [script, out, file], {
      stdio: ['pipe', 'pipe', 'pipe'], env: {...process.env, REVOLT_IMPORT_WAIT_MS: '1820000'},
    });
    const p = pending = {name, file, child, stdout: '', stderr: '', ready: false};
    child.stdout.on('data', b => { p.stdout += b; });
    child.stderr.on('data', b => { p.stderr += b; });
    child.on('error', e => { p.error = e; });
    p.joined = new Promise(resolve => child.once('close', (code, signal) => resolve({
      pid: child.pid, code, signal, actualWait: true, stdoutEOF: child.stdout.readableEnded,
      stderrEOF: child.stderr.readableEnded, stdout: p.stdout, stderr: p.stderr,
    })));
    const deadline = now() + 20000;
    while (!fs.existsSync(file + '.prepared')) {
      check(); if (p.error) throw p.error;
      assert(child.exitCode === null && child.signalCode === null, 'standby setup child exited');
      assert(now() < deadline, 'finite standby setup'); await sleep(10);
    }
    // Let buffered child status/output events run before accepting its marker.
    await sleep(10); live(p); p.ready = true;
    save(name + '-release-imports.json', JSON.parse(fs.readFileSync(file + '.prepared')));
    return p;
  }
  function consume(name) {
    assert(/^[a-z0-9-]+$/.test(name) && !used.has(name), 'fresh release operation identity');
    const p = live(pending); assert(p.ready);
    used.add(name); pending = null; p.operation = name; return p;
  }
  async function close() {
    closed = true;
    if (!pending) return;
    const p = pending; pending = null;
    // Never publish cfg or guest input when retiring an unused import-only child.
    p.child.kill('SIGTERM'); const timer = setTimeout(() => p.child.kill('SIGKILL'), 3000);
    try { save(p.name + '-unused-release-wait.json', await p.joined); }
    finally { clearTimeout(timer); }
  }
  return {prepare, consume, close};
}
// This setup bound is separate from the immutable operator runtime envelope.
// The native supervisor owns the browser and its import-only child throughout.
async function supervise(out, browserScript, label, root) {
  const setupAt = Date.now(), setupDeadline = setupAt + 20000;
  const duration = label.startsWith('calibration') ? 300000 : 1800000;
  const save = (n, v) => fs.writeFileSync(out + '/' + n, JSON.stringify(v, null, 2), {flag:'wx'});
  const p = cp.spawn(process.execPath, [root + '/tools/native-supervise.cjs', out + '/supervision',
    String((setupDeadline + duration) / 1000), String((setupDeadline + duration + 20000) / 1000),
    '--grace=3', '--', process.execPath, browserScript, label], {stdio:['ignore','pipe','pipe']});
  let stdout = '', stderr = '';
  p.stdout.on('data', b => { stdout += b; }); p.stderr.on('data', b => { stderr += b; });
  const joined = new Promise(resolve => p.once('close', (code, signal) => resolve({
    pid:p.pid, code, signal, actualWait:true, stdoutEOF:p.stdout.readableEnded,
    stderrEOF:p.stderr.readableEnded, stdout, stderr,
  })));
  let setupFailed = false;
  try {
    while (!fs.existsSync(out + '/prebudget-standby-ready.json')) {
      assert(p.exitCode === null && p.signalCode === null, 'operator setup still live');
      assert(Date.now() < setupDeadline, 'finite prebudget operator setup');
      await new Promise(r => setTimeout(r, 10));
    }
    const ready = JSON.parse(fs.readFileSync(out + '/prebudget-standby-ready.json'));
    assert(ready.importsReady && ready.armed === false && ready.pid > 0);
    process.kill(ready.pid, 0);
    const at = Date.now(); assert(ready.at <= at && at < setupDeadline);
    save('envelope.json', {at, deadline:at + duration, cleanupDeadline:at + duration + 20000,
      setupAt, setupDeadline, actualImportOnlyChildReadyBeforeBudget:true, standbyPid:ready.pid});
  } catch (e) {
    setupFailed = true; save('prebudget-failure.json', {at:Date.now(), error:e.stack}); p.kill('SIGTERM');
  }
  const wait = await joined; save('supervisor-wait.json', wait);
  return setupFailed ? 1 : wait.code || (wait.signal ? 1 : 0);
}
module.exports = {create, supervise};
