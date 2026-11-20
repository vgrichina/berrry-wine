'use strict';
const fs = require('node:fs');

class StartupCancelled extends Error {
  constructor(reason, phase) {
    super(`startup cancelled (${reason}) at ${phase}`);
    this.name = 'StartupCancelled'; this.reason = reason; this.phase = phase;
  }
}

// Gates work at dispatch, not only at an outer polling loop. In-flight work is
// joined and recorded truthfully before cancellation propagates. In particular,
// acquire must retain a newly created resource BEFORE the post-await gate.
class Lifecycle {
  constructor({cancelFile, deadline, floor = 1500000000, diskPath = '/home', record = () => {}}) {
    if (!cancelFile || !Number.isFinite(deadline)) throw Error('cancelFile and finite deadline required');
    Object.assign(this, {cancelFile, deadline, floor, diskPath, record});
    this.reason = null; this.closed = false; this.pending = new Set(); this.serial = 0;
  }
  note(kind, details = {}) { this.record({at: Date.now(), kind, ...details}); }
  checkpoint(phase) {
    if (!this.reason) {
      if (fs.existsSync(this.cancelFile)) this.reason = fs.readFileSync(this.cancelFile, 'utf8') || 'cancel file';
      else if (Date.now() >= this.deadline) this.reason = 'finite-deadline';
      else if (this.floor !== null) {
        const s = fs.statfsSync(this.diskPath), free = Number(s.bavail) * Number(s.bsize);
        if (free <= this.floor) this.reason = `disk-floor:${free}`;
      }
      if (this.reason) this.note('cancel-observed', {reason: this.reason, phase});
    }
    if (this.reason || this.closed) throw new StartupCancelled(this.reason || 'closed', phase);
  }
  async run(phase, operation, adopt) {
    this.checkpoint('before:' + phase);
    const id = ++this.serial;
    this.note('begin', {id, phase});
    let value;
    try {
      // No Promise.race: an owned launch must never finish unadopted, nor an
      // in-flight reply be silently thrown away to claim no post-cancel work.
      value = await operation();
      if (adopt) adopt(value);
      this.note('completed', {id, phase});
    } catch (e) {
      this.note('failed', {id, phase, error: String(e)});
      throw e;
    }
    this.checkpoint('after:' + phase);
    return value;
  }
  track(promise) {
    this.pending.add(promise);
    // Attach the rejection handler immediately, including event-driven tasks.
    promise.then(() => this.pending.delete(promise), () => this.pending.delete(promise));
    return promise;
  }
  wrapConnection(connection) {
    const send = connection.send.bind(connection);
    connection.send = (method, ...args) => this.track(this.run('CDP:' + method, async () => {
      try {
        const result = await send(method, ...args);
        this.note('reply', {method, result});
        return result;
      } catch (e) {
        this.reason ||= 'request-failed:' + method;
        this.note('request-failed', {method, error: String(e)});
        throw e;
      }
    }));
    return connection;
  }
  async drain() {
    this.closed = true;
    // Children of tracked work may themselves have been registered during await.
    while (this.pending.size) await Promise.allSettled([...this.pending]);
    this.note('drained');
  }
}

// Register immediately after spawn, before awaiting readiness. `close` is the
// actual child wait plus EOF on both pipes, not just a PID disappearance probe.
function ownChild(child) {
  let stdout = '', stderr = '';
  child.stdout?.on('data', b => { stdout += b; });
  child.stderr?.on('data', b => { stderr += b; });
  let error = null;
  child.once('error', e => { error = String(e); });
  const waited = new Promise(resolve => child.once('close', (code, signal) => resolve({
    pid: child.pid ?? null, code, signal, error, actualWait: true,
    stdoutEOF: child.stdout?.readableEnded ?? null, stderrEOF: child.stderr?.readableEnded ?? null,
    stdout, stderr,
  })));
  return {
    child, waited,
    async stop(graceMs = 3000) {
      let timer;
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGTERM');
        timer = setTimeout(() => child.kill('SIGKILL'), graceMs);
      }
      try { return await waited; } finally { clearTimeout(timer); }
    },
  };
}
async function launchChrome(lifecycle, {directory, env, executablePath = '/opt/google/chrome/chrome', args = [], adopt}) {
  lifecycle.checkpoint('chrome:spawn');
  const child = require('node:child_process').spawn(executablePath, [
    '--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader',
    '--remote-debugging-port=0', '--user-data-dir=' + directory,
    '--no-first-run', '--no-default-browser-check', ...args, 'about:blank',
  ], {env, stdio: ['ignore', 'pipe', 'pipe']});
  const owned = ownChild(child);
  // Adoption cannot be postponed until endpoint readiness: cancellation there
  // still owns this real process and must join it.
  adopt(owned);
  const endpointFile = directory + '/DevToolsActivePort';
  const end = Math.min(Date.now() + 30000, lifecycle.deadline);
  while (!fs.existsSync(endpointFile)) {
    lifecycle.checkpoint('chrome:endpoint-wait');
    if (child.exitCode !== null || child.signalCode !== null || Date.now() >= end) throw Error('Chrome endpoint startup failed');
    await lifecycle.run('chrome:endpoint-sleep', () => new Promise(r => setTimeout(r, 20)));
  }
  lifecycle.checkpoint('chrome:endpoint-read');
  const [port, socketPath] = fs.readFileSync(endpointFile, 'utf8').trim().split('\n');
  if (!/^\d+$/.test(port) || !socketPath.startsWith('/devtools/browser/')) throw Error('invalid owned Chrome endpoint');
  owned.url = 'ws://127.0.0.1:' + port + socketPath;
  return owned;
}

function connect(lifecycle, url) {
  lifecycle.checkpoint('CDP:connect');
  const ws = new WebSocket(url), pending = new Map(); let id = 0, terminal = null;
  const fail = e => {
    terminal ||= e;
    if (!lifecycle.closed) lifecycle.reason ||= String(terminal);
    for (const p of pending.values()) { clearTimeout(p.timer); p.reject(terminal); }
    pending.clear();
  };
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { const e=Error('UNKNOWN CDP connect fixed15000ms'); fail(e); reject(e); ws.close(); }, 15000);
    const settle = fn => value => { clearTimeout(timer); fn(value); };
    ws.addEventListener('open', settle(resolve), {once: true});
    ws.addEventListener('error', settle(() => reject(Error('UNKNOWN CDP connect error'))), {once: true});
    ws.addEventListener('close', settle(() => reject(Error('UNKNOWN CDP connect closed'))), {once: true});
  });
  // Register now: an early cancellation must not leave an unhandled open error.
  lifecycle.track(ready);
  const closed = new Promise(resolve => ws.addEventListener('close', resolve, {once: true}));
  const api = {ws, ready, event: () => {}, get closed() { return !!terminal; },
    async close() { ws.close(); await closed; },
    send(method, params = {}, sessionId) {
      if (terminal) return Promise.reject(terminal);
      return new Promise((resolve, reject) => {
        const n = ++id, timer = setTimeout(() => fail(Error('UNKNOWN ' + method + ' fixed15000ms; no replay')), 15000);
        pending.set(n, {resolve, reject, timer, sessionId});
        try { ws.send(JSON.stringify({id:n, method, params, ...(sessionId ? {sessionId} : {})})); }
        catch (e) { fail(e); }
      });
    },
  };
  ws.addEventListener('close', () => fail(Error('UNKNOWN CDP closed; no replay')));
  ws.addEventListener('error', () => fail(Error('UNKNOWN CDP error; no replay')));
  ws.addEventListener('message', msg => {
    let v;
    try { v = JSON.parse(msg.data); } catch (e) { fail(e); return; }
    if (!v.id) { api.event(v); return; }
    const p = pending.get(v.id); if (!p) return;
    if (v.sessionId !== p.sessionId) { fail(Error('UNKNOWN CDP session changed')); return; }
    clearTimeout(p.timer); pending.delete(v.id);
    if (v.error) p.reject(Object.assign(Error(JSON.stringify(v.error)), {cdpError:v.error}));
    else p.resolve(v.result);
  });
  return lifecycle.wrapConnection(api);
}
module.exports = {Lifecycle, StartupCancelled, ownChild, launchChrome, connect};
