'use strict';
// Drakan detached receipt owner with an independent watchdog outside the
// native containment group. The native wrapper stops the guest at its sealed
// deadline, retains pipe close, and remains alive until that wait completes.
// App-specific detached receipt owner. Preparation remains in the submitter;
// sealed descriptors cross exec unchanged. The owner survives submitter death,
// retains Linux native-supervise containment, and waits both children itself.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const assert = require('node:assert/strict');
const c = require('./native-supervisor-common.cjs');
const root = path.resolve(__dirname, '..');
function launch({ run, command, env = process.env, fds = [], deadline, cleanupDeadline }) {
  run = path.resolve(run); fs.mkdirSync(run, { recursive: true });
  assert(c.freeBytes() > 1500000000, 'home disk floor');
  assert(command.every(s => typeof s === 'string') && command.length);
  assert(c.now() < deadline && deadline + 25 < cleanupDeadline);
  c.save(run, 'durable-config.json', { command, fds, deadline, cleanupDeadline });
  const out = fs.openSync(path.join(run, 'owner.stdout.log'), 'wx');
  const err = fs.openSync(path.join(run, 'owner.stderr.log'), 'wx');
  // Do not preload the native immutable view into the receipt owner itself.
  const ownerEnv = { ...env, BLOOD2_NATIVE_NODE_OPTIONS: env.NODE_OPTIONS || '' };
  delete ownerEnv.NODE_OPTIONS;
  let child;
  try {
    child = cp.spawn(process.execPath, [__filename, 'owner', run], {
      cwd: root, env: ownerEnv, detached: true,
      stdio: c.stdioWithFds(fds, ['ignore', out, err]),
    });
    child.unref();
    const identity = { pid: child.pid, startToken: c.token(child.pid), at: c.now(), detached: true };
    c.save(run, 'durable-owner.json', identity); return identity;
  } finally { fs.closeSync(out); fs.closeSync(err); }
}
// Write each observed chunk immediately. close, not exit, proves pipe EOF.
function retain(child, run, name) {
  const startToken = c.token(child.pid);
  const out = fs.openSync(path.join(run, name + '.stdout.log'), 'wx');
  const err = fs.openSync(path.join(run, name + '.stderr.log'), 'wx');
  const drainErrors = [];
  child.stdout.on('data', b => fs.writeSync(out, b));
  child.stderr.on('data', b => fs.writeSync(err, b));
  for (const s of [child.stdout, child.stderr]) s.on('error', e => drainErrors.push(String(e)));
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (exit, signal) => {
      fs.fsyncSync(out); fs.fsyncSync(err); fs.closeSync(out); fs.closeSync(err);
      const receipt = { pid: child.pid, startToken, at: c.now(), exit: c.returncode(exit, signal), signal,
        actualWait: true, stdoutEOF: child.stdout.readableEnded, stderrEOF: child.stderr.readableEnded, drainErrors };
      c.save(run, name + '-wait.json', receipt); resolve(receipt);
    });
  });
}
async function watch(run, cfg) {
  c.save(run, 'watchdog-armed.json', { pid: process.pid, at: c.now(), deadline: cfg.deadline + 20 });
  let minFreeBytes = c.freeBytes(), reason;
  for (;;) {
    minFreeBytes = Math.min(minFreeBytes, c.freeBytes());
    if (c.exists(path.join(run, 'native-wait.json'))) { reason = 'actual-native-wait'; break; }
    if (c.now() >= cfg.deadline + 20 || minFreeBytes < 1500000000) {
      reason = minFreeBytes < 1500000000 ? 'disk-floor' : 'deadline';
      const file = path.join(run, 'native-pid.json');
      if (c.exists(file)) {
        const target = c.readJSON(file);
        for (const sig of ['SIGTERM', 'SIGKILL']) {
          try { if (c.token(target.pid) === target.startToken) process.kill(target.pid, sig); } catch (e) { if (!['ENOENT', 'ESRCH'].includes(e.code)) throw e; }
          if (sig === 'SIGTERM') await c.sleep(1000);
        }
      }
      break;
    }
    await c.sleep(25);
  }
  c.save(run, 'watchdog-exit.json', { reason, minFreeBytes, at: c.now() });
}
async function runNative(run, cfg) {
  const env = { ...process.env, NODE_OPTIONS: process.env.BLOOD2_NATIVE_NODE_OPTIONS || '' };
  const p = cp.spawn(cfg.command[0], cfg.command.slice(1), { cwd: root, env, stdio: c.stdioWithFds(cfg.fds) });
  const wait = retain(p, run, 'native');
  c.save(run, 'native-pid.json', { pid: p.pid, startToken: c.token(p.pid), at: c.now() });
  let terminated = false;
  const cancel = setInterval(() => {
    if (!terminated && (c.exists(path.join(run, 'cancel-request.json')) || c.now() >= cfg.deadline)) {
      terminated = true; p.kill('SIGTERM');
      setTimeout(() => { if (p.exitCode === null && p.signalCode === null) p.kill('SIGKILL'); }, 1000).unref();
    }
  }, 25);
  try { await wait; } finally { clearInterval(cancel); }
}
async function main(mode, run) {
  const cfg = c.readJSON(path.join(run, 'durable-config.json'));
  if (mode === 'watch') return watch(run, cfg);
  if (mode === 'native') return runNative(run, cfg);
  assert.equal(mode, 'owner');
  const w = cp.spawn(process.execPath, [__filename, 'watch', run], { detached:true, stdio:['ignore','pipe','pipe'] });
  const ww = retain(w,run,'watchdog');
  while(!c.exists(path.join(run,'watchdog-armed.json')))await c.sleep(5);
  const receipt = await require('./native-supervise.cjs').supervise(path.join(run, 'containment'),
    [process.execPath, __filename, 'native', run], { deadline: cfg.deadline + 25,
      cleanup_deadline: cfg.cleanupDeadline, grace: 1, env: process.env,
      cwd: root, stdio: c.stdioWithFds(cfg.fds, ['ignore', 1, 2]) });
  await ww;
  const waits = ['native', 'watchdog'].map(name => {
    const file = path.join(run, name + '-wait.json');
    return c.exists(file) ? c.readJSON(file) : null;
  });
  const retainedActualWaits = waits.every(w => w?.actualWait && w.stdoutEOF && w.stderrEOF && w.drainErrors.length === 0);
  c.save(run, 'owner-complete.json', { at: c.now(), receipt, retainedActualWaits });
  process.exitCode = require('./native-supervise.cjs').exitStatus(receipt);
}
module.exports = { launch };
if (require.main === module) main(...process.argv.slice(2)).catch(e => { console.error(e); process.exitCode = 1; });
