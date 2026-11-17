'use strict';
// Detached owner of native+watchdog waits. No pipe to the invoking tool.
// Node port of the former forsaken-supervisor.py; same CLI and records:
//   node tools/forsaken-supervisor.cjs watchdog|run|outerwait|detach OUT [...]
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const c = require('./native-supervisor-common.cjs');
const assert = require('node:assert/strict');
const SELF = __filename;
const save = (out, name, value) => c.save(out, name, value);

async function watchdog(out, deadline) {
  save(out, 'watchdog-armed.json', { pid: process.pid, deadline, at: c.now(), independent: true });
  while (c.now() < deadline) {
    if (c.exists(path.join(out, 'native-wait.json'))) {
      save(out, 'watchdog-exit.json', { reason: 'actual-native-wait', at: c.now() }); return;
    }
    if (c.freeBytes('/home') < 1500000000) break;
    await c.sleep(50);
  }
  const signals = [], p = path.join(out, 'native-pid.json');
  if (c.exists(p)) {
    const info = c.readJSON(p); c.killOwned(info, 'SIGTERM'); signals.push('TERM');
    await c.sleep(3000); c.killOwned(info, 'SIGKILL'); signals.push('KILL-if-still-owned');
  }
  save(out, 'watchdog-exit.json', { reason: 'deadline-or-disk', at: c.now(), signals });
}

// Drain one pipe to native.<name>.log (opened exclusively), recording EOF.
function drain(stream, file, name, eof, errors) {
  return new Promise(resolve => {
    let fd;
    try { fd = fs.openSync(file, 'wx'); } catch (e) { errors.push(String(e)); stream.resume(); stream.once('close', resolve); return; }
    stream.on('data', chunk => { try { fs.writeSync(fd, chunk); } catch (e) { errors.push(String(e)); } });
    stream.once('error', e => errors.push(String(e)));
    stream.once('end', () => { eof[name] = true; });
    stream.once('close', () => { fs.closeSync(fd); resolve(); });
  });
}

async function run(out, recipe) {
  const stop = c.recordSignals([]);
  let lock = null;
  if (recipe.heavy) {
    const queueEnd = performance.now() / 1000 + 2500;
    const prior = (recipe.fairAfter || []).map(n => path.join(path.dirname(out), n));
    save(out, 'heavy-queue.json', { at: c.now(), fairAfter: prior, boundedQueueSeconds: 2500 });
    while (!prior.every(p => c.exists(path.join(p, 'supervisor-complete.json')) || c.exists(path.join(p, 'preflight-blocker.json')))) {
      assert(performance.now() / 1000 < queueEnd && !stop.length, 'bounded fair queue ended without launch');
      await c.sleep(250);
    }
    while (true) {
      assert(performance.now() / 1000 < queueEnd && !stop.length, 'bounded lock queue ended without launch');
      lock = await c.flockExclusive('/tmp/wine-heavy-runtime.lock', { blocking: false });
      if (lock) break;
      await c.sleep(250);
    }
    save(out, 'heavy-lock.json', { pid: process.pid, at: c.now() });
  }
  if (recipe.preflight) {
    const pre = cp.spawnSync(recipe.preflight[0], recipe.preflight.slice(1), { cwd: recipe.cwd, maxBuffer: 1 << 30 });
    const exit = c.returncode(pre.status, pre.signal);
    save(out, 'preflight-wait.json', { exit, actualWait: true, stdoutEOF: true, stderrEOF: true, stdout: String(pre.stdout), stderr: String(pre.stderr), at: c.now() });
    if (exit) { save(out, 'preflight-blocker.json', { exit, originalLaunched: false, at: c.now() }); return; }
  }
  const deadline = c.now() + recipe.seconds;
  const watchdogDeadline = deadline + (recipe.watchdogGrace || 0);
  const w = cp.spawn(process.execPath, [SELF, 'watchdog', out, String(watchdogDeadline)], { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  const wWait = c.communicate(w);
  let wExited = false; w.once('exit', () => { wExited = true; });
  while (!c.exists(path.join(out, 'watchdog-armed.json'))) { assert(!wExited, 'watchdog died before arm'); await c.sleep(10); }
  assert(!stop.length, 'supervisor cancelled before native launch');
  save(out, 'launch.json', { args: recipe.args, deadline, at: c.now(), supervisor: process.pid, clock: recipe.clock ?? null });
  const env = { ...process.env, ...(recipe.env || {}) };
  const p = cp.spawn(recipe.args[0], recipe.args.slice(1), { cwd: recipe.cwd, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let exitInfo = null; p.once('exit', (code, signal) => { exitInfo = { code, signal }; });
  await new Promise((resolve, reject) => { p.once('spawn', resolve); p.once('error', reject); });
  const info = { pid: p.pid, startToken: c.token(p.pid), at: c.now() }; save(out, 'native-pid.json', info);
  const eof = {}, errors = [];
  const drains = [drain(p.stdout, path.join(out, 'native.stdout.log'), 'stdout', eof, errors),
    drain(p.stderr, path.join(out, 'native.stderr.log'), 'stderr', eof, errors)];
  let sent = false;
  while (!exitInfo) {
    const requested = c.exists(path.join(out, 'cancel-request.json'));
    if ((stop.length || requested) && !sent) {
      c.killOwned(info, 'SIGTERM'); sent = true;
      save(out, 'cancellation.json', { at: c.now(), signals: stop, requestFile: c.exists(path.join(out, 'cancel-request.json')), nativeQuit: false });
    }
    await c.sleep(20);
  }
  await Promise.all(drains);
  const rc = c.returncode(exitInfo.code, exitInfo.signal);
  save(out, 'native-wait.json', { pid: p.pid, startToken: info.startToken, exit: rc, actualWait: true, stdoutEOF: eof.stdout || false, stderrEOF: eof.stderr || false, drainErrors: errors, at: c.now() });
  const wr = await wWait;
  save(out, 'watchdog-wait.json', { pid: w.pid, exit: wr.returncode, actualWait: true, stdoutEOF: true, stderrEOF: true, stdout: wr.stdout.toString(), stderr: wr.stderr.toString(), at: c.now() });
  if (lock) await lock.release();
  save(out, 'supervisor-complete.json', { pid: process.pid, nativeWait: rc, watchdogWait: wr.returncode, heavyReleased: !!lock, actualChildWaits: true, bothEOF: eof.stdout === true && eof.stderr === true, at: c.now() });
}

async function main() {
  const mode = process.argv[2], out = path.resolve(process.argv[3]);
  if (mode === 'watchdog') await watchdog(out, Number(process.argv[4]));
  else if (mode === 'run') await run(out, c.readJSON(path.join(out, 'recipe.json')));
  else if (mode === 'outerwait') {
    const p = cp.spawn(process.execPath, [SELF, 'run', out], { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    const waited = c.communicate(p);
    await new Promise((resolve, reject) => { p.once('spawn', resolve); p.once('error', reject); });
    save(out, 'detached-parent.json', { pid: p.pid, startToken: c.token(p.pid), outerPid: process.pid, at: c.now() });
    const r = await waited;
    fs.writeFileSync(path.join(out, 'supervisor.stdout.log'), r.stdout); fs.writeFileSync(path.join(out, 'supervisor.stderr.log'), r.stderr);
    save(out, 'outer-child-wait.json', { pid: p.pid, exit: r.returncode, actualWait: true, stdoutEOF: true, stderrEOF: true, at: c.now() });
    process.exitCode = r.returncode & 255;
  } else if (mode === 'detach') {
    const a = fs.openSync(path.join(out, 'supervisor.stdout.log'), 'wx'), b = fs.openSync(path.join(out, 'supervisor.stderr.log'), 'wx');
    const p = cp.spawn(process.execPath, [SELF, 'run', out], { stdio: ['ignore', a, b], detached: true });
    fs.closeSync(a); fs.closeSync(b);
    await new Promise((resolve, reject) => { p.once('spawn', resolve); p.once('error', reject); });
    p.unref();
    save(out, 'detached-parent.json', { pid: p.pid, startToken: c.token(p.pid), launcherPid: process.pid, at: c.now(), stdio: 'devnull/files; no outer tool pipe' });
    console.log(JSON.stringify({ detachedSupervisor: p.pid }));
    if (process.argv.length > 4) await c.sleep(30000); // control-only: invoking launcher killed by test
  } else throw Error('unknown mode ' + mode);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { watchdog, run, drain };
