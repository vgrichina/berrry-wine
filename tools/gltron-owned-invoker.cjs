'use strict';
// Direct-child custody for the GLTron invoker. No borrowed descendant waits.
const fs = require('node:fs');
const cp = require('node:child_process');
const os = require('node:os');
function identity(pid = process.pid) {
  const f = fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ').at(-1).split(' ');
  return {pid, token: f[19], ppid: Number(f[1])};
}
function status(wait) {
  return wait.signal ? 128 + os.constants.signals[wait.signal] : (wait.code ?? 1);
}
function child(command, {name, out, stdin = 'ignore', note = () => {}}) {
  const p = cp.spawn(command[0], command.slice(1), {stdio: [stdin, 'pipe', 'pipe']});
  let stdout = '', stderr = '', error = null, id = null;
  try { id = identity(p.pid); } catch {}
  note('spawn', {name, command, identity: id, stdio: [stdin, 'pipe', 'pipe']});
  p.stdout.on('data', b => { stdout += b; });
  p.stderr.on('data', b => { stderr += b; });
  p.once('error', e => { error = String(e); });
  const joined = new Promise(resolve => p.once('close', (code, signal) => {
    const wait = {pid: p.pid ?? null, identity: id, code, signal, error, actualWait: true,
      stdio: [stdin, 'pipe', 'pipe'], stdoutEOF: p.stdout.readableEnded,
      stderrEOF: p.stderr.readableEnded, stdout, stderr};
    fs.writeFileSync(`${out}/${name}-wait.json`, JSON.stringify(wait));
    note('close', {name, code, signal, stdoutEOF: wait.stdoutEOF, stderrEOF: wait.stderrEOF});
    resolve(wait);
  }));
  return {p, joined, signal(sig) {
    if (p.exitCode !== null || p.signalCode !== null || !id) return;
    try { if (identity(p.pid).token !== id.token) return; } catch { return; }
    note('signal-call', {name, identity: id, signal: sig}); p.kill(sig);
  }};
}
function requireSuccess(wait, required = []) {
  if (status(wait) !== 0 || wait.error || !wait.stdoutEOF || !wait.stderrEOF)
    throw Error('owned child failed: ' + JSON.stringify(wait));
  for (const file of required) if (!fs.existsSync(file) || fs.statSync(file).size === 0)
    throw Error('required child output missing: ' + file);
  return wait;
}
async function custodize({out, command, closeScope, required = []}) {
  const note = (kind, data = {}) => fs.appendFileSync(out + '/custodian-events.jsonl',
    JSON.stringify({at: Date.now(), kind, ...data}) + '\n');
  note('parent', {identity: identity(), parent: identity(process.ppid)});
  const runtime = child(command, {out, name: 'actual-child', note});
  let cancellation = null, closure = Promise.resolve();
  const listeners = ['SIGTERM', 'SIGINT', 'SIGHUP'].map(sig => {
    const fn = () => {
      cancellation ??= sig; note('received', {signal: sig, sender: null});
      closure = closure.then(() => closeScope('custodian ' + sig))
        .catch(e => note('closure-error', {error: String(e)})).then(() => runtime.signal(sig));
    };
    process.on(sig, fn); return [sig, fn];
  });
  try {
    const wait = await runtime.joined; await closure;
    if (!cancellation && status(wait) === 0) requireSuccess(wait, required);
    return cancellation ? 128 + os.constants.signals[cancellation] : status(wait);
  } finally { for (const [sig, fn] of listeners) process.removeListener(sig, fn); }
}
async function invoke({out, command, watchdog, deadline, cleanupDeadline, closeScope,
  finishWatchdog, required = []}) {
  if (!(Date.now() < deadline && deadline < cleanupDeadline)) throw Error('finite deadlines required');
  const note = (kind, data = {}) => fs.appendFileSync(out + '/invoker-events.jsonl',
    JSON.stringify({at: Date.now(), kind, ...data}) + '\n');
  note('parent', {identity: identity(), parent: identity(process.ppid)});
  let runtime, monitor, cancellation = null, closure = Promise.resolve();
  const cancel = sig => {
    note('received', {signal: sig, sender: null});
    cancellation ??= sig;
    closure = closure.then(() => closeScope('invoker ' + sig)).catch(e => note('closure-error', {error: String(e)}))
      .then(() => runtime?.signal(sig === 'deadline' ? 'SIGTERM' : sig));
  };
  const listeners = ['SIGTERM', 'SIGINT', 'SIGHUP'].map(sig => {
    const fn = () => cancel(sig); process.on(sig, fn); return [sig, fn];
  });
  const timer = setTimeout(() => cancel('deadline'), deadline - Date.now());
  const hard = setTimeout(() => {
    note('cleanup-deadline'); runtime?.signal('SIGKILL'); monitor?.signal('SIGKILL');
  }, cleanupDeadline - Date.now());
  try {
    monitor = child(watchdog, {name: 'watchdog', out, note});
    runtime = child(command, {name: 'native-supervisor', out, note});
    const wait = await runtime.joined;
    await closure;
    await finishWatchdog();
    const monitorWait = await monitor.joined;
    const code = cancellation ? (cancellation === 'deadline' ? 124 : 128 + os.constants.signals[cancellation])
      : status(wait) || status(monitorWait);
    const result = {code, cancellation, wait, monitorWait};
    fs.writeFileSync(out + '/invoker-wait.json', JSON.stringify(result));
    if (!code) { requireSuccess(wait, required); requireSuccess(monitorWait); }
    return result;
  } catch (e) {
    // A failed receipt/finish write must not abandon either acquired child.
    await closeScope('invoker failure ' + e).catch(error => note('closure-error', {error: String(error)}));
    runtime?.signal('SIGTERM'); monitor?.signal('SIGTERM');
    await Promise.all([runtime?.joined, monitor?.joined]);
    throw e;
  } finally {
    clearTimeout(timer); clearTimeout(hard);
    for (const [sig, fn] of listeners) process.removeListener(sig, fn);
  }
}
module.exports = {identity, status, child, requireSuccess, custodize, invoke};
