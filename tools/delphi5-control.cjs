#!/usr/bin/env node
'use strict';
// Personal complete-scene reviews and single finite ordinary UI intents.
// Node port of the former tools/delphi5-control.py (same CLI, records, protocol).
//
// One permanent binding. UNKNOWN closes all later requests. An independently
// prearmed release may finish its original cleanup. No replay, rebind or solver.
//
// Every internal call goes through the exported object `m`, as the Python
// module globals did, so a test may replace m.R, m.read or m.identity.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), crypto = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const c = require('./native-supervisor-common.cjs');
const SELF = __filename, ROOT = path.resolve(__dirname, '..');
const now = c.now;
const ok = (cond, message) => { if (!cond) throw Object.assign(Error(typeof message === 'string' ? message : JSON.stringify(message ?? 'assertion failed')), { name: 'AssertionError' }); };
const sha = file => c.sha256(fs.readFileSync(file));
const pick = (o, keys) => Object.fromEntries(keys.map(k => [k, o[k]]));

const m = module.exports = {};
m.R = path.resolve(process.env.DELPHI5_RUN || path.join(ROOT, 'scratch/runs/20261116-delphi5-trial-after-desktop-repair'));
m.PORT = Number.parseInt(process.env.DELPHI5_PORT || '45761', 10);
const P = n => path.join(m.R, n);

m.read = n => c.readJSON(P(n));
m.save = (n, v) => {
  const target = P(n), pending = target + '.' + process.pid + '.pending';
  const fd = fs.openSync(pending, 'wx');
  try { fs.writeSync(fd, JSON.stringify(v, null, 2) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  // Publish a complete file without overwriting any earlier record.
  fs.linkSync(pending, target); fs.unlinkSync(pending);
};
m.fail = (name, e) => {
  if (!c.exists(P('PERMANENT-UNKNOWN.json'))) m.save('PERMANENT-UNKNOWN.json', { name, error: String(e?.message ?? e), at: now(), noLaterRequests: true });
};
m.sourcecheck = () => {
  const pins = m.read('runtime-inputs.json').sources;
  // Executed core is sealed; only mutable owned helpers need fresh IO.
  for (const n of ['tools/delphi5-control.cjs', 'test/test-delphi5-after-desktop.cjs'])
    ok(sha(path.join(ROOT, n)) === pins[n], 'owned source changed: ' + n);
};
m.reserve = (quit = false) => {
  m.sourcecheck();
  const launch = m.read('launch.json'); ok(launch.gameplayCutoff === launch.deadline - 180);
  if (now() >= launch.gameplayCutoff || quit) {
    if (!c.exists(P('quit-phase.json'))) m.save('quit-phase.json', { at: now(), irreversible: true });
  }
  ok(now() + 3 < launch.deadline);
  return launch;
};
m.identity = () => {
  let info = m.read('native-pid.json');
  if (m.PORT !== (m.read('launch.json').rootPort ?? 45761)) {
    const dir = P('children');
    let rows = (c.exists(dir) ? fs.readdirSync(dir) : []).filter(f => f.endsWith('-wait.json')).map(f => c.readJSON(path.join(dir, f)));
    rows = rows.filter(row => row.pid === Number.parseInt(process.env.DELPHI5_CHILD_PID, 10));
    ok(rows.length === 1 && !rows[0].actualWait); info = { pid: rows[0].pid, startToken: process.env.DELPHI5_CHILD_TOKEN };
  }
  ok(c.token(info.pid) === info.startToken);
  ok(c.listenerOwnedBy(info.pid, m.PORT));
  return info;
};
m.call = async (command, timeout = 1, cleanup = false) => {
  ok(!c.exists(P('PERMANENT-UNKNOWN.json')), 'permanent UNKNOWN; no later requests');
  m.identity();
  fs.appendFileSync(P('requests.jsonl'), JSON.stringify({ at: now(), action: command.action ?? null, cleanup }) + '\n');
  const r = await c.postJSON(`http://127.0.0.1:${m.PORT}/ctl`, command, timeout);
  ok(r.ok, r);
  return r.value;
};
m.context = s => pick(s, ['mainHwnd', 'windows', 'modalHwnd', 'focus', 'focusTopLevel', 'focusWindow',
  'capture', 'physicalUp', 'nativeProcess', 'nativeMessageBox', 'screen']);
m.capture = async name => {
  try {
    m.reserve(); const target = m.identity(), at = now();
    const s = await m.call({ action: 'snapshot' }); m.reserve();
    const p = P(name + '.png'); ok(!c.exists(p));
    const reply = await m.call({ action: 'png', path: p });
    const after = await m.call({ action: 'snapshot' });
    ok(isDeepStrictEqual(m.context(s), m.context(after)), 'native scene changed during capture');
    m.save(name + '.json', { at, target, port: m.PORT, snapshot: s, image: reply, pngSHA256: sha(p) });
    console.log(p);
  } catch (e) { m.fail(name, e); throw e; }
};
m.review = (scene, description, label, kind) => {
  const rr = m.read(scene + '.json');
  ok(sha(P(scene + '.png')) === rr.pngSHA256);
  m.save(scene + '-review.json', { at: now(), rawCompleteScene: true, observation: description, visibleLabel: label, kind, pngSHA256: rr.pngSHA256 });
};
m.reviewed = scene => {
  const rr = m.read(scene + '.json'), r = m.read(scene + '-review.json');
  const freshness = r.kind === 'game' ? 5 : 30;
  ok(now() - rr.at >= 0 && now() - rr.at < freshness && now() - r.at >= 0 && now() - r.at < freshness);
  ok(isDeepStrictEqual(rr.target, m.identity()) && rr.port === m.PORT && r.rawCompleteScene && r.observation && r.visibleLabel);
  ok(r.pngSHA256 === rr.pngSHA256 && rr.pngSHA256 === sha(P(scene + '.png')));
  return [rr, r];
};
m.bind = async scene => {
  try {
    m.reserve(); ok(!c.exists(P('input-owner.json')));
    const [rr] = m.reviewed(scene);
    m.save('bind-intent.json', { scene, at: now(), permanent: true });
    const reply = await m.call({ action: 'guarded-bind', reviewedScene: { route: 'native-scene-v1', snapshot: rr.snapshot, pngSHA256: rr.pngSHA256 } });
    m.save('input-owner.json', reply);
  } catch (e) { m.fail('bind', e); throw e; }
};
m.release = async (name, owner, due) => {
  process.stdout.write(JSON.stringify({ armed: true, pid: process.pid, due }) + '\n');
  while (now() < due) {
    if (c.exists(P(name + '-up-at.json'))) {
      try { due = Math.min(due, m.read(name + '-up-at.json').at ?? Infinity); } catch {} // Original finite fallback remains armed.
    }
    await c.sleep(Math.min(3, Math.max(0, (due - now()) * 1000)));
  }
  let sent;
  try {
    sent = now(); const reply = await m.call({ action: 'guarded-release', owner }, .2, true);
    m.save(name + '-up.json', { at: now(), sentAt: sent, reply, physicalUpACK: reply?.released === true });
  } catch (e) { m.save(name + '-up.json', { at: now(), error: String(e?.message ?? e), physicalUpACK: false }); throw e; }
};

// Independent release process with actual join and pipe EOF evidence, at the
// same absolute deadlines. (Python forked here; Node spawns a fresh process.)
class ArmedRelease {
  constructor(name, owner, due) {
    this.process = cp.spawn(process.execPath, [SELF, 'release', name, owner, String(due)],
      { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, DELPHI5_RUN: m.R, DELPHI5_PORT: String(m.PORT) } });
    this.pid = this.process.pid; this.returncode = null; this.result = null;
    this.out = []; this.err = []; this.lineWaiters = []; this.text = '';
    this.process.stdout.on('data', b => { this.out.push(b); this.text += b; this.lineWaiters.splice(0).forEach(f => f()); });
    this.process.stderr.on('data', b => this.err.push(b));
    this.closed = new Promise(resolve => this.process.once('close', (code, signal) => { this.returncode = c.returncode(code, signal); resolve(); }));
  }
  // select() + readline() on the armed line; leaves the rest in the pipe record.
  async readline(ms) {
    const end = Date.now() + ms;
    while (!this.text.includes('\n')) {
      const left = end - Date.now(); if (left <= 0) return null;
      await new Promise(resolve => { const t = setTimeout(resolve, left); this.lineWaiters.push(() => { clearTimeout(t); resolve(); }); });
    }
    const i = this.text.indexOf('\n'), line = this.text.slice(0, i); this.text = this.text.slice(i + 1); return line;
  }
  async communicate(timeout) {
    if (this.result !== null) return this.result;
    const done = await Promise.race([this.closed.then(() => true), c.sleep(timeout * 1000).then(() => false)]);
    if (!done) throw Object.assign(Error('TimeoutExpired: independent physical release'), { code: 'TIMEOUT' });
    this.result = [Buffer.concat(this.out), Buffer.concat(this.err)];
    return this.result;
  }
  kill() { this.process.kill('SIGKILL'); }
}

m.intent = async (name, scene, x, y, kind) => {
  let child = null;
  try {
    const launch = m.reserve(kind === 'quit'); const [rr, r] = m.reviewed(scene);
    ok(['install', 'game', 'quit'].includes(kind) && r.kind === kind);
    if (kind !== 'quit') ok(!c.exists(P('quit-phase.json')) && now() + 3 < launch.gameplayCutoff);
    ok(!c.exists(P('PERMANENT-UNKNOWN.json')));
    const owner = m.read('input-owner.json'), nonce = crypto.randomUUID(), start = now();
    // Every intent, including later modal generations, needs the same
    // complete paint that was reviewed. Bind alone checks only scene zero.
    const check = P(name + '-preinput.png'); ok(!c.exists(check));
    await m.call({ action: 'png', path: check });
    ok(sha(check) === rr.pngSHA256, 'reviewed native paint changed');
    m.save(name + '-intent.json', { scene, x, y, kind, owner, nonce, at: start, confirmationDeadline: start + .5, physicalUpDeadline: start + 1.75, observationDeadline: start + 3 });
    child = new ArmedRelease(name, owner.owner, start + 1.4);
    const line = await child.readline(150); ok(line !== null, 'release was not prearmed');
    const arm = JSON.parse(line); m.save(name + '-release-arm.json', arm); ok(arm.armed);
    m.reserve(kind === 'quit'); ok(now() < start + .5);
    const receipt = await m.call({ action: 'guarded-input', cmd: `mousedown:${x}:${y}`, guard: { ...owner, nonce,
      reviewed: true, intent: { ...rr.snapshot, pngSHA256: rr.pngSHA256 },
      deadline: Math.trunc(Math.min(start + .5, Math.min(rr.at, r.at) + (kind === 'game' ? 5 : 30)) * 1000) } }, Math.max(.001, start + .5 - now()));
    m.save(name + '-down.json', { at: now(), receipt });
    ok(now() < start + .5 && receipt.state === 'CONSUMED' && receipt.consumed, 'confirmation UNKNOWN');
    m.save(name + '-up-at.json', { at: receipt.consumedAt / 1000 + .1 });
    const [out, err] = await child.communicate(Math.max(.001, start + 1.75 - now()));
    m.save(name + '-release-wait.json', { pid: child.pid, exit: child.returncode, actualWait: true, stdoutEOF: true, stderrEOF: true, stdout: out.toString(), stderr: err.toString() });
    const up = m.read(name + '-up.json'); ok(child.returncode === 0 && up.physicalUpACK && up.at < start + 1.75);
    // Acknowledgement proves input consumption only. Observe a later scene.
    // Observe the actual transition immediately. There is no minimum
    // completion delay: 3000ms bounds the entire intent and its evidence.
    while (true) {
      ok(now() < start + 3, 'aggregate observation UNKNOWN');
      if (c.exists(P('native-wait.json'))) {
        const native = m.read('native-wait.json'); ok(kind === 'quit' && native.actualWait && native.exit === 0);
        m.save(name + '-observation.json', { at: now(), nativeWait: native, noPostExitRequest: true });
        break;
      }
      if (kind === 'quit') { await c.sleep(5); continue; } // Quit is proved by parent wait, never a request to a retiring endpoint.
      if (!c.processExists(m.read('native-pid.json').pid)) { await c.sleep(5); continue; } // Parent still drains pipes/publishes its actual wait.
      const after = await m.call({ action: 'snapshot' }, Math.max(.001, start + 3 - now()));
      if (kind !== 'quit' && after.physicalUp && !isDeepStrictEqual(m.context(after), m.context(rr.snapshot))) {
        m.save(name + '-observation.json', { at: now(), snapshot: after }); break;
      }
      await c.sleep(5);
    }
    ok(now() < start + 3);
    m.save(name + '-completion.json', { at: now(), elapsedMs: (now() - start) * 1000, limitsMs: { confirmation: 500, physicalUp: 1750, aggregate: 3000 } });
    ok(now() < start + 3);
    console.log(JSON.stringify({ completedAt: now(), elapsedMs: (now() - start) * 1000, durableEvidencePublished: true, aggregateGuardPassed: true }));
    ok(now() < start + 3);
  } catch (e) {
    try {
      if (child) {
        let out, err;
        try { [out, err] = await child.communicate(2); }
        catch (t) { if (t.code !== 'TIMEOUT') throw t; child.kill(); await child.closed; [out, err] = await child.communicate(0); }
        if (!c.exists(P(name + '-release-wait.json'))) m.save(name + '-release-wait.json', { pid: child.pid, exit: child.returncode, actualWait: true, stdoutEOF: true, stderrEOF: true, stdout: out.toString(), stderr: err.toString() });
      }
    } finally {
      // Drain the prearmed finite physical release BEFORE publishing the
      // terminal latch. Once UNKNOWN is visible even cleanup cannot request.
      m.fail(name, e);
    }
    throw e;
  }
};

m.main = async argv => {
  const mode = argv[0];
  if (mode === 'capture') await m.capture(argv[1]);
  else if (mode === 'review') m.review(...argv.slice(1, 5));
  else if (mode === 'bind') await m.bind(argv[1]);
  else if (mode === 'intent') await m.intent(argv[1], argv[2], Number.parseInt(argv[3], 10), Number.parseInt(argv[4], 10), argv[5]);
  else if (mode === 'release') await m.release(argv[1], argv[2], Number(argv[3]));
};
m.ArmedRelease = ArmedRelease;
if (require.main === module) m.main(process.argv.slice(2)).catch(e => { console.error(e); process.exitCode = 1; });
