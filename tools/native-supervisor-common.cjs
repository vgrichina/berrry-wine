'use strict';
// Shared primitives for the Node ports of the native supervisors/controllers
// (formerly Python). Same on-disk protocol: exclusive *.pending + fsync +
// rename publication, /proc start tokens, process-group signals.
//
// Platform notes. Linux keeps the original /proc identities. macOS has no
// /proc: a process start token is `ps -o lstart=` and a loopback listener is
// attributed with lsof. Node cannot call memfd_create(2); a "sealed" body is
// an unlinked 0400 file with no remaining writable descriptor, so no path or
// writer can change it, which is the property the readers rely on.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const cp = require('node:child_process'), crypto = require('node:crypto'), http = require('node:http');
const assert = require('node:assert/strict');

const now = () => Date.now() / 1000;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const sha256 = body => crypto.createHash('sha256').update(body).digest('hex');
const exists = p => fs.existsSync(p);
const readJSON = p => JSON.parse(fs.readFileSync(p, 'utf8'));

// Python json.dump(indent=2) + '\n', exclusive, fsynced, renamed into place.
function save(dir, name, value) {
  const target = path.join(dir, name);
  assert(!exists(target), target);
  const pending = target + '.pending';
  const fd = fs.openSync(pending, 'wx');
  try { fs.writeSync(fd, JSON.stringify(value, null, 2) + '\n'); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  fs.renameSync(pending, target);
}

// json.dumps(..., sort_keys=True, separators=(',',':'))
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}

function token(pid) {
  if (process.platform === 'linux') {
    const s = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    return s.slice(s.lastIndexOf(')') + 2).split(' ')[19];
  }
  let row;
  try { row = cp.execFileSync('ps', ['-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { const e = Error('no such process ' + pid); e.code = 'ENOENT'; throw e; }
  if (!row) { const e = Error('no such process ' + pid); e.code = 'ENOENT'; throw e; }
  return row;
}
const processExists = pid => process.platform === 'linux' ? exists('/proc/' + pid) : (() => { try { token(pid); return true; } catch { return false; } })();

function killOwned(info, signal) {
  try { if (token(info.pid) === info.startToken) process.kill(-info.pid, signal); }
  catch (e) { if (!['ENOENT', 'ESRCH'].includes(e.code)) throw e; }
}

function freeBytes(dir = '/home') {
  // macOS /home is an autofs placeholder reporting zero space; use the root.
  const s = fs.statfsSync(process.platform === 'linux' && exists(dir) ? dir : '/');
  return s.bavail * s.bsize;
}

// Python's Popen.returncode: exit code, or -signal number.
const returncode = (code, signal) => code !== null && code !== undefined ? code : -(os.constants.signals[signal] || 0);

// A child with piped output, both drained to completion: communicate().
function communicate(child, timeoutMs) {
  const out = [], err = [];
  child.stdout?.on('data', b => out.push(b)); child.stderr?.on('data', b => err.push(b));
  return new Promise((resolve, reject) => {
    let timer;
    if (timeoutMs !== undefined) timer = setTimeout(() => { const e = Error('TimeoutExpired'); e.code = 'TIMEOUT'; reject(e); }, timeoutMs);
    child.once('error', e => { clearTimeout(timer); reject(e); });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ pid: child.pid, returncode: returncode(code, signal), stdout: Buffer.concat(out), stderr: Buffer.concat(err) });
    });
  });
}

// Python pass_fds: the child sees each descriptor at the same number.
function stdioWithFds(fds, base = ['ignore', 'pipe', 'pipe']) {
  const stdio = [...base];
  for (const fd of fds) { while (stdio.length <= fd) stdio.push('ignore'); stdio[fd] = fd; }
  return stdio;
}

// Immutable transient body; see the header. Returns a read-only descriptor.
function seal(label, body) {
  const dir = fs.mkdtempSync(path.join(process.platform === 'linux' && exists('/dev/shm') ? '/dev/shm' : os.tmpdir(), 'sealed-'));
  const file = path.join(dir, label.replace(/[^a-zA-Z0-9_.-]/g, '_'));
  const w = fs.openSync(file, 'wx', 0o400);
  try { fs.writeSync(w, body); fs.fsyncSync(w); } finally { fs.closeSync(w); }
  const fd = fs.openSync(file, 'r');
  if (process.platform !== 'linux') {
    // macOS: opening /dev/fd/N dup()s the descriptor and shares its offset,
    // so a second read of the same path returns nothing. Keep the read-only
    // file at a private path instead and remove it when this process exits.
    fs.chmodSync(dir, 0o500);
    sealedPaths.set(fd, file);
    if (sealedPaths.size === 1) process.once('exit', () => {
      for (const f of sealedPaths.values()) try { fs.chmodSync(path.dirname(f), 0o700); fs.rmSync(path.dirname(f), { recursive: true, force: true }); } catch {}
    });
    return fd;
  }
  fs.unlinkSync(file); fs.rmdirSync(dir);
  return fd;
}
const sealedPaths = new Map();
const SEALS = 15;
// A descriptor path readable by this process and by children given the fd at
// the same number (stdioWithFds). On Linux /proc/PID/fd also works for any
// same-user reader while PID holds the descriptor. On macOS a sealed body is
// named by its private read-only file (see seal()).
const fdPath = (fd, pid = process.pid) => process.platform === 'linux' ? `/proc/${pid}/fd/${fd}` : (sealedPaths.get(fd) || `/dev/fd/${fd}`);
const fdPathPattern = pid => process.platform === 'linux' ? new RegExp(`^/proc/${pid}/fd/[0-9]+$`) : /^(?:\/dev\/fd\/[0-9]+|.*\/sealed-[^/]+\/[^/]+)$/;
// Cross-process holder: macOS cannot open another process's descriptor, so a
// holder there publishes a private read-only file it removes on close.
function holdBody(label, body) {
  if (process.platform === 'linux') { const fd = seal(label, body); return { fd, path: fdPath(fd), close: () => fs.closeSync(fd) }; }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'held-'));
  const file = path.join(dir, label.replace(/[^a-zA-Z0-9_.-]/g, '_'));
  fs.writeFileSync(file, body, { flag: 'wx', mode: 0o400 });
  const fd = fs.openSync(file, 'r');
  return { fd, path: file, close: () => { fs.closeSync(fd); fs.rmSync(dir, { recursive: true, force: true }); } };
}
const holderPathAllowed = (pid, p) => fdPathPattern(pid).test(p) || (process.platform !== 'linux' && /\/held-[^/]+\/[^/]+$/.test(p));
function readDescriptor(p) {
  const fd = fs.openSync(p, 'r');
  try { const st = fs.fstatSync(fd); assert(!(st.mode & 0o222) || process.platform === 'linux', 'holder body is writable'); return fs.readFileSync(fd); }
  finally { fs.closeSync(fd); }
}

// The loopback listener belongs to exactly this pid.
function listenerOwnedBy(pid, port) {
  if (process.platform === 'linux') {
    const sockets = new Set();
    for (const n of fs.readdirSync(`/proc/${pid}/fd`)) {
      try { const t = fs.readlinkSync(`/proc/${pid}/fd/${n}`); if (t.startsWith('socket:')) sockets.add(t); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
    const rows = fs.readFileSync('/proc/net/tcp', 'utf8').split('\n').slice(1).filter(Boolean).map(r => r.trim().split(/\s+/));
    const local = '0100007F:' + port.toString(16).toUpperCase().padStart(4, '0');
    const inodes = rows.filter(r => r[1] === local && r[3] === '0A').map(r => r[9]);
    return inodes.length === 1 && sockets.has('socket:[' + inodes[0] + ']');
  }
  let text = '';
  try { text = cp.execFileSync('lsof', ['-nP', '-iTCP@127.0.0.1:' + port, '-sTCP:LISTEN', '-Fp'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch {}
  const pids = text.split('\n').filter(l => l.startsWith('p')).map(l => Number(l.slice(1)));
  return pids.length === 1 && pids[0] === Number(pid);
}

// urllib.request.urlopen(POST json, timeout) -> parsed reply.
function postJSON(url, body, timeoutSec) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(body));
    const req = http.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length } }, res => {
      const chunks = []; res.on('data', c => chunks.push(c));
      res.on('end', () => { clearTimeout(timer); try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch (e) { reject(e); } });
      res.on('error', e => { clearTimeout(timer); reject(e); });
    });
    const timer = setTimeout(() => req.destroy(Object.assign(Error('timed out'), { code: 'ETIMEDOUT' })), Math.max(1, timeoutSec * 1000));
    req.on('error', e => { clearTimeout(timer); reject(e); });
    req.end(data);
  });
}

// fcntl.flock-compatible exclusive lock, held by a flock(1) helper so it
// excludes every other flock user of the same file. release() unlocks.
async function flockExclusive(file, { blocking = true } = {}) {
  const child = cp.spawn('flock', [...(blocking ? [] : ['-n']), '-x', file, 'sh', '-c', 'echo locked; exec cat >/dev/null'],
    { stdio: ['pipe', 'pipe', 'ignore'] });
  const locked = await new Promise((resolve, reject) => {
    let text = '';
    child.once('error', e => reject(Object.assign(Error('flock(1) is required for heavy recipes: ' + e.message), { code: e.code })));
    child.stdout.on('data', b => { text += b; if (text.includes('locked')) resolve(true); });
    child.once('close', () => resolve(false));
  });
  if (!locked) return null;
  return { release: () => new Promise(resolve => { child.once('close', resolve); child.stdin.end(); }) };
}

// Record SIGTERM/SIGINT/SIGHUP numbers instead of dying (Python handlers).
function recordSignals(list) {
  for (const s of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(s, () => list.push(os.constants.signals[s]));
  return list;
}

// Node stand-in for PYTHONPROFILEIMPORTTIME: with WINE_PREARM_REQUIRE_TIMING=1
// every later require() prints "require time: self [us] | cumulative | name"
// to stderr, nested names indented like Python's report. Modules loaded
// before the call (this file's own built-ins) are not covered.
function installRequireTiming(env = process.env) {
  if (env.WINE_PREARM_REQUIRE_TIMING !== '1') return false;
  const Module = require('node:module'), load = Module._load;
  if (load.name === 'timedLoad') return true; // already installed in this process
  let depth = 0; const children = [0];
  process.stderr.write('require time: self [us] | cumulative | imported module\n');
  Module._load = function timedLoad(request, ...rest) {
    const start = process.hrtime.bigint(); depth++; children.push(0);
    try { return load.call(this, request, ...rest); }
    finally {
      const total = Number(process.hrtime.bigint() - start) / 1000, inner = children.pop(); depth--;
      children[children.length - 1] += total;
      process.stderr.write(`require time: ${Math.round(total - inner).toString().padStart(9)} | ${Math.round(total).toString().padStart(10)} | ${'  '.repeat(depth)}${request}\n`);
    }
  };
  return true;
}

// Parse complete records, not pipe chunks. Subscribe before the child can
// publish READY, and retain records arriving before the next waiter.
function jsonLines(child) {
  let pending = '', ended = false; const rows = [], waiters = [];
  function finish(error) { ended = true; for (const w of waiters.splice(0)) w.reject(error); }
  child.stdout.on('data', b => {
    pending += b;
    if (pending.length > 65536) return finish(Error('helper stdout record too large'));
    let i;
    while ((i = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, i); pending = pending.slice(i + 1);
      try { const row = JSON.parse(line), w = waiters.shift(); if (w) w.resolve(row); else rows.push(row); }
      catch (e) { finish(e); }
    }
  });
  child.once('error', finish);
  child.stdout.once('end', () => finish(Error('helper stdout EOF before record')));
  return ms => new Promise((resolve, reject) => {
    if (rows.length) return resolve(rows.shift());
    if (ended) return reject(Error('helper stdout already ended'));
    const w = { resolve: row => { clearTimeout(t); resolve(row); }, reject: e => { clearTimeout(t); reject(e); } };
    const t = setTimeout(() => { const i = waiters.indexOf(w); if (i >= 0) waiters.splice(i, 1); reject(Error('helper record deadline')); }, ms);
    waiters.push(w);
  });
}

// Startup is a separate finite preparation phase. READY confers no release
// authority. Call before capture/review and before starting an action clock.
async function prepareReleaseHelper({ run, url, name, standbyUntil, startupMs = 10000, env = process.env }) {
  assert(/^[a-zA-Z0-9-]+$/.test(name));
  assert(Number.isFinite(standbyUntil) && standbyUntil > now());
  const target = readJSON(path.join(run, 'native-pid.json'));
  const spawnedAt = now();
  const child = cp.spawn(process.execPath, [path.join(__dirname, 'drakan-menu-input.cjs'), 'standby', run, url, name,
    String(standbyUntil)], { env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  const next = jsonLines(child); let stdout = '', stderr = ''; const ipcErrors = [];
  child.stdout.on('data', b => stdout += b); child.stderr.on('data', b => stderr += b);
  const waited = new Promise(resolve => child.once('close', (code, signal) => resolve({ pid: child.pid, code, signal,
    actualWait: true, stdoutEOF: child.stdout.readableEnded, stderrEOF: child.stderr.readableEnded, stdout, stderr, ipcErrors })));
  // connected can race actual peer EOF. A cancellation is best-effort local
  // retirement; its EPIPE must never crash the parent or mask the real wait.
  const send = message => { if (child.connected) child.send(message, e => { if (e) ipcErrors.push(String(e)); }); };
  const cancel = () => send({ cancel: true });
  try {
    const ready = await next(Math.min(startupMs, (standbyUntil - now()) * 1000));
    assert.equal(ready.state, 'READY'); assert.equal(ready.armed, false);
    assert.equal(canonical(ready.target), canonical(target));
    save(run, name + '-standby.json', { ...ready, spawnedAt, receivedAt: now(), startupMilliseconds: (now() - spawnedAt) * 1000 });
    return { child, waited, ready, cancel, async arm({ owner, due, confirmationMs, lease }) {
      const requestedAt = now(), armBy = requestedAt + 1;
      try {
        assert(child.connected, 'standby disconnected');
        send({ arm: true, owner, due, confirmationMs, lease, armBy });
        const armed = await next(1000);
        assert(now() < armBy, 'one-second arm deadline');
        assert.equal(armed.armed, true); assert.equal(armed.state, 'ARMED');
        assert.equal(canonical(armed.target), canonical(target));
        assert.equal(canonical(armed.owner), canonical(owner));
        assert.equal(armed.due, due); assert.equal(armed.confirmationMs, confirmationMs);
        return { ...armed, requestedAt, receivedAt: now(), armBy };
      } catch (e) {
        if (!exists(path.join(run, name + '-disarm.json'))) save(run, name + '-disarm.json', { at: now(), reason: 'arm failed before DOWN' });
        cancel(); throw e;
      }
    } };
  } catch (e) { cancel(); await waited; throw e; }
}

module.exports = { now, sleep, sha256, exists, readJSON, save, canonical, token, processExists, killOwned, freeBytes,
  returncode, communicate, stdioWithFds, seal, SEALS, fdPath, fdPathPattern, holdBody, holderPathAllowed, readDescriptor,
  listenerOwnedBy, postJSON, flockExclusive, recordSignals, installRequireTiming, jsonLines, prepareReleaseHelper };
