'use strict';
// Finite original Sims installer/game UI transport, derived from released TriPeaks.
//
// No original executable changes, serial guesses, game-state reader, replay or rebind.
// SIMS_CONTROL_OUT and SIMS_CONTROL_URL identify one supervised native consumer.
// Personal full-scene reviews establish progress; ACK establishes only consumption.
// Node port of the former sims-install-controller.py: same records, HTTP
// protocol, CLI modes and exit codes. Every transport step goes through the
// mutable `c` object so tests can rebind c.R/c.URL or observe c.call.
const k = require('./native-supervisor-common.cjs');
k.installRequireTiming(); // diagnostic only; reaches the independent release child via env
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const cp = require('node:child_process'), assert = require('node:assert/strict');
const { isDeepStrictEqual } = require('node:util');

const isAlnum = s => /^[A-Za-z0-9]+$/.test(s);
const nonEmpty = v => typeof v === 'string' && v.trim() !== '';
const pick = (o, keys) => Object.fromEntries(keys.map(n => [n, o[n]]));
const fileSha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const glob = (dir, pred) => fs.readdirSync(dir).filter(pred);

const c = {
  R: path.resolve(process.env.SIMS_CONTROL_OUT || __dirname),
  URL: process.env.SIMS_CONTROL_URL || 'http://127.0.0.1:8667/ctl',
  save(n, v) { k.save(c.R, n, v); },
  async call(command, timeout = 10) {
    const r = await k.postJSON(c.URL, command, timeout);
    if (!r.ok) { const e = Error(JSON.stringify(r)); e.name = 'RuntimeError'; throw e; }
    return r.value;
  },
  read(n) { return JSON.parse(fs.readFileSync(path.join(c.R, n), 'utf8')); },
  has(n) { return fs.existsSync(path.join(c.R, n)); },
  endpoint_identity(info) {
    const u = new URL(c.URL);
    assert(u.hostname === '127.0.0.1' && u.pathname === '/ctl', 'direct loopback endpoint only');
    assert(k.listenerOwnedBy(info.pid, Number(u.port)), 'control socket is not exclusively owned by actual native PID');
  },
  opened() {
    assert(!c.has('terminal-input-failure.json'), 'sticky UNKNOWN/closed; no replay');
    assert(!c.has('terminal-owner-exited.json'), 'native owner exited; no replay');
    assert(!c.has('native-wait.json'), 'native terminal');
    assert(k.now() + 2 < c.read('launch.json').deadline, 'immutable runtime deadline');
    const info = c.read('native-pid.json');
    assert.equal(k.token(info.pid), info.startToken, 'native identity changed');
    c.endpoint_identity(info);
  },
  fail(error, name) {
    if (c.has('terminal-owner-exited.json')) return;
    if (!c.has('terminal-input-failure.json'))
      c.save('terminal-input-failure.json', { name, error: String(error?.message ?? error), noReplay: true, at: k.now() });
  },
  async bind(reviewedScene) {
    try {
      c.opened();
      // Reserve before HTTP evaluation: save(name, call(bind)) would rebind
      // first and only then notice that the permanent owner file exists.
      assert(!c.has('input-owner.json'), 'permanent owner already bound; no rebind');
      c.save('bind-intent.json', { at: k.now(), permanent: true });
      const command = { action: 'guarded-bind' };
      if (reviewedScene !== undefined && reviewedScene !== null) command.reviewedScene = reviewedScene;
      c.save('input-owner.json', await c.call(command));
      const s = await c.call({ action: 'snapshot' });
      c.save('lease-snapshot.json', pick(s, ['mainHwnd', 'screen']));
    } catch (e) { c.fail(e, 'bind'); throw e; }
  },
  async lease() {
    c.opened(); const o = c.read('input-owner.json'), s = await c.call({ action: 'snapshot' });
    assert(!s.quit && s.eip !== '0x0', 'native owner unavailable');
    assert(isDeepStrictEqual(pick(s, ['mainHwnd', 'screen']), c.read('lease-snapshot.json')), 'window/canvas lease changed');
    if (c.has('last-intent.json')) {
      for (const n of c.read('last-intent.json').nonces) {
        const r = await c.call({ action: 'guarded-status', nonce: n });
        assert(r.owner === o.owner && r.epoch === o.epoch, 'guard ownership changed');
        assert(r.state !== 'UNKNOWN', 'sticky guard UNKNOWN');
        assert(['CONSUMED', 'CANCELLED'].includes(r.state) && r.consumed, 'prior intent unresolved');
        assert([null, undefined, 'immutable deadline expired', 'independent release'].includes(r.reason), 'guard owner revoked');
      }
    }
    return [o, s];
  },
  async capture(name) {
    try {
      assert(isAlnum(name.replaceAll('-', ''))); c.opened();
      const p = path.join(c.R, name + '.png');
      assert(!fs.existsSync(p) && !c.has(name + '.json'), 'capture name collision before observation');
      for (const intent of glob(c.R, n => n.endsWith('-intent.json'))) {
        if (['bind-intent.json', 'last-intent.json'].includes(intent)) continue;
        const stem = intent.slice(0, -'-intent.json'.length);
        assert(c.has(stem + '-up.json') && c.has(stem + '-completed.json'), 'unresolved physical gesture; no capture');
      }
      const start = k.now(), until = performance.now() / 1000 + 3, left = () => Math.max(.001, until - performance.now() / 1000);
      const s = await c.call({ action: 'snapshot' }, left());
      assert(performance.now() / 1000 < until, 'capture deadline expired after snapshot');
      const im = await c.call({ cmd: 'png:' + p }, left()); const end = k.now();
      assert(performance.now() / 1000 < until, 'capture deadline expired after image');
      c.save(name + '.json', { at: start, completedAt: end, snapshot: s, image: im, pngSHA256: fileSha(p), target: c.read('native-pid.json') });
      return p;
    } catch (e) { c.fail(e, name); throw e; }
  },
  // A successful actual harness wait, not a guest exit-code or physical UP claim.
  exited_owner(expected) {
    let info, wait;
    try { info = c.read('native-pid.json'); wait = c.read('native-wait.json'); } catch { return null; }
    if (['pid', 'startToken'].some(n => info[n] !== expected[n] || wait[n] !== expected[n])) return null;
    if (typeof expected.startToken !== 'string' || !expected.startToken) return null;
    if (!['actualWait', 'stdoutEOF', 'stderrEOF'].every(n => wait[n] === true)) return null;
    if (wait.exit !== 0 || !Array.isArray(wait.drainErrors) || wait.drainErrors.length || (wait.at ?? 0) < info.at) return null;
    return wait;
  },
};

function cutoff() {
  const launch = c.read('launch.json');
  assert(launch.deadline - launch.at > 180);
  return launch.deadline - 180;
}

function reviewed(scene, age) {
  assert(isAlnum(scene.replaceAll('-', '')), 'local scene name only');
  const rr = c.read(scene + '.json'), r = c.read(scene + '-review.json');
  assert(r.submittedScene === true && nonEmpty(r.observation ?? ''), 'personal complete scene review required');
  assert([rr, r].every(v => 0 <= k.now() - v.at && k.now() - v.at < age), 'scene review expired');
  assert(r.pngSHA256 === rr.pngSHA256 && rr.pngSHA256 === fileSha(path.join(c.R, scene + '.png')));
  assert(isDeepStrictEqual(rr.target, c.read('native-pid.json')), 'native identity changed');
  assert(rr.snapshot.mainHwnd !== '0x0' && rr.snapshot.eip !== '0x0');
  assert(r.rawCompleteScene === true, 'raw complete scene required');
  return [rr, r];
}

const zeroGeneration = g => [null, undefined, 0, '0'].includes(g);
async function bind(scene) {
  cutoff(); const [rr, r] = reviewed(scene, 30);
  assert(['installer', 'startup'].includes(r.sceneType), 'complete original bootstrap required');
  assert(r.exactReleaseReviewed === true && r.completeBootstrapReviewed === true);
  const s = rr.snapshot;
  const mains = (s.windows || []).filter(w => w.hwnd === s.mainHwnd);
  assert.equal(mains.length, 1);
  const main = mains[0];
  assert(main.visible === true && !main.isChild && main.title === r.nativeTitle);
  let expected = null;
  if (!r.nativeTitle.trim()) {
    const nullOwner = !('reviewedOwnedModal' in r) && 'reviewedNativeMessageBox' in r;
    const modal = nullOwner ? r.reviewedNativeMessageBox : r.reviewedOwnedModal;
    assert(s.windows.some(w => isDeepStrictEqual(w, modal)) && modal.hwnd !== main.hwnd);
    assert(modal.visible === true && !modal.isChild && nonEmpty(modal.title ?? ''));
    assert(main.processId && !zeroGeneration(main.generation));
    assert(!zeroGeneration(modal.generation) && main.live === true && modal.live === true);
    assert(modal.processId === main.processId);
    if (nullOwner) {
      const box = s.nativeMessageBox;
      assert(modal.owner === '0x0' && box.controlClass === 16);
      assert(box.hwnd === modal.hwnd && box.generation === modal.generation);
      assert(box.processId === main.processId && box.threadId > 0);
      assert(box.threadId === main.threadId && main.threadId === modal.threadId && modal.threadId === s.focusWindow.threadId);
    } else assert(modal.owner === main.hwnd);
    assert(s.modalHwnd === modal.hwnd);
    assert(s.focusTopLevel === modal.hwnd && s.capture === '0x0' && s.physicalUp === true);
    const focus = s.focusWindow;
    assert(focus.hwnd === s.focus && focus.live === true);
    assert(!zeroGeneration(focus.generation) && focus.processId === main.processId);
    assert(s.nativeProcess.pid === rr.target.pid && s.nativeProcess.executable);
    expected = { main, modal, nativeProcess: s.nativeProcess, screen: s.screen, focus: s.focus, focusWindow: focus, pngSHA256: rr.pngSHA256 };
    if (nullOwner) Object.assign(expected, { modalRoute: 'null-owner-message-box', nativeMessageBox: s.nativeMessageBox });
  }
  if (expected) await c.bind(expected); else await c.bind();
  assert(isDeepStrictEqual(c.read('lease-snapshot.json'), pick(rr.snapshot, ['mainHwnd', 'screen'])));
  c.save('binding-scene.json', { scene, nativeTitle: r.nativeTitle, target: rr.target, mainHwnd: rr.snapshot.mainHwnd, at: k.now() });
}

// Separate personal observations; transport receipts establish no game state.
async function checkpoint(kind, scene) {
  assert(['loading', 'household', 'selection', 'result'].includes(kind));
  await c.lease(); const [rr, r] = reviewed(scene, kind !== 'loading' ? 5 : 30);
  assert(r.sceneType === kind && nonEmpty(r.checkpointEvidence ?? ''));
  const prior = { household: 'loading', selection: 'household', result: 'selection' }[kind];
  if (prior) {
    assert(c.has(prior + '-reviewed.json'), 'prior scene separately reviewed');
    assert(rr.at > c.read(prior + '-reviewed.json').at, 'distinct later scene required');
  }
  if (kind === 'household') assert(r.liveHousehold === true && nonEmpty(r.visibleHouseholdName ?? ''));
  if (kind === 'selection') assert(nonEmpty(r.visibleSelectedSim ?? '') && r.selectionVisible === true);
  if (kind === 'result') {
    const intent = c.read('chosen-action.json');
    assert(rr.at > c.read(intent.name + '-up.json').at, 'post-UP result required');
    assert(nonEmpty(r.visibleActionResult ?? ''));
    assert(r.actionEvidenceSeparateFromACK === true);
  }
  c.save(kind + '-reviewed.json', { scene, at: rr.at, review: r, target: rr.target });
}

function policy(command, scene, mode, route = null) {
  assert(['install', 'menu', 'household', 'select', 'action', 'hover', 'quit'].includes(mode));
  const end = cutoff();
  if (mode === 'quit' || k.now() >= end) {
    if (!c.has('quit-phase.json')) c.save('quit-phase.json', { at: k.now(), reserveSeconds: 180, irreversible: true });
  }
  const age = 3; // Every physical choice uses a freshly reviewed complete image.
  const [rr, r] = reviewed(scene, age);
  assert(r.mode === mode);
  const verb = mode === 'hover' ? 'mousemove' : 'mousedown';
  assert(new RegExp('^' + verb + ':[0-9]{1,4}:[0-9]{1,4}$').test(command), 'one finite pointer action only');
  assert(nonEmpty(r.visibleLabel ?? ''), 'personally read visible target required');
  assert(r.ordinaryNativeUI === true, 'ordinary original UI required');
  if (mode !== 'quit') {
    assert(!c.has('quit-phase.json'), 'irreversible Quit phase');
    assert(k.now() + 3 < end, 'gameplay cutoff');
  }
  if (mode === 'install') {
    assert(r.sceneType === 'installer');
    assert(['next', 'accept-license', 'default-path', 'install', 'disc-prompt', 'finish'].includes(r.installRoute));
    assert(route === r.installRoute, 'reviewed installer route required');
    assert(r.serialRequired === false, 'serial boundary; no guessed key or bypass');
    assert(r.mediaCheckBypassed === false);
  } else if (mode === 'menu') {
    assert(['startup', 'neighborhood', 'menu'].includes(r.sceneType));
    assert(['dismiss-intro', 'start', 'choose-neighborhood', 'dismiss-menu'].includes(route));
    assert(r.menuRoute === route);
  } else if (mode === 'household') {
    assert(c.has('loading-reviewed.json'), 'loading separately reviewed');
    assert(r.sceneType === 'neighborhood' && nonEmpty(r.chosenHousehold ?? ''));
  } else if (mode === 'select') {
    assert(c.has('household-reviewed.json'), 'household separately reviewed');
    assert(r.sceneType === 'household' && nonEmpty(r.chosenSim ?? ''));
  } else if (mode === 'action' || mode === 'hover') {
    assert(c.has('selection-reviewed.json'), 'selection separately reviewed');
    assert(['household', 'action-menu'].includes(r.sceneType));
    assert(nonEmpty(r.personallyChosenAction ?? ''));
    assert(r.visibleSelectedSim === c.read('selection-reviewed.json').review.visibleSelectedSim);
    assert(r.liveHousehold === true);
    assert(!c.has('chosen-action.json'), 'one visible action only');
    if (mode === 'hover') assert(r.hoverOnly === true);
  } else {
    assert(['open-game-menu', 'select-exit', 'titlebar-close', 'confirm-exit', 'cancel-installer'].includes(route));
    assert(r.quitRoute === route && r.visibleQuitTarget === true);
    if (route === 'confirm-exit') assert(r.nativeExitConfirmation === true);
  }
  const g = r.pixelGeometry;
  assert(g.source === 'current-full-scene' && isDeepStrictEqual(g.target, rr.target));
  const point = command.split(':').slice(1).map(v => parseInt(v, 10));
  assert(isDeepStrictEqual(point, g.chosenCenter), 'pointer differs from reviewed pixels');
  assert(0 <= point[0] && point[0] < rr.snapshot.screen.w && 0 <= point[1] && point[1] < rr.snapshot.screen.h);
  assert(!glob(c.R, n => n.startsWith(scene + '-used-by-')).length, 'fresh scene required; no replay');
  return [rr, r, Math.min(rr.at + age, mode === 'quit' ? c.read('launch.json').deadline : end)];
}

function consumed(r, owner, nonce) {
  return r.state === 'CONSUMED' && r.consumed === true && r.owner === owner.owner && r.epoch === owner.epoch &&
    r.nonce === nonce && typeof r.consumedAt === 'number';
}

async function release(name) {
  const p = c.read(name + '-intent.json'); let due = p.fallbackAt, pending = Buffer.alloc(0), ack = null, reason = 'fallback';
  process.stdout.write(JSON.stringify({ armed: true, pid: process.pid, target: p.target, fallbackAt: due }) + '\n');
  const chunks = []; let eof = false, wake = null;
  process.stdin.on('data', b => { chunks.push(b); wake?.(); });
  process.stdin.on('end', () => { eof = true; wake?.(); });
  try {
    while (k.now() < due) {
      if (!chunks.length && !eof) {
        await new Promise(resolve => { wake = resolve; setTimeout(resolve, Math.min(5, Math.max(0, (due - k.now()) * 1000))); });
        wake = null;
      }
      if (chunks.length) {
        pending = Buffer.concat([pending, ...chunks.splice(0)]);
        const i = pending.indexOf(10);
        if (i >= 0) {
          const line = pending.subarray(0, i); pending = pending.subarray(i + 1);
          assert(ack === null && !pending.length, 'one schedule only');
          const v = JSON.parse(line); ack = v.receipt;
          assert(consumed(ack, p.owner, p.nonce));
          assert(v.at === ack.consumedAt / 1000 + p.milliseconds / 1000);
          assert(v.at <= p.gestureDeadline);
          due = v.at; reason = 'consumed pulse';
        }
      } else if (eof) { reason = 'parent EOF'; break; }
    }
  } finally {
    process.stdin.destroy();
    const fired = k.now(); let up;
    try {
      const reply = await c.call({ action: 'guarded-release', owner: p.owner.owner }, .5);
      assert(reply.released === true && reply.owner === p.owner.owner);
      up = { state: 'ACK', reply, at: k.now() };
    } catch (e) {
      const wait = p.final && ack !== null ? c.exited_owner(p.target) : null;
      up = wait ? { state: 'OWNER_EXITED', physicalUpACK: false, nativeWait: wait, at: k.now() }
        : { state: 'UNKNOWN', error: String(e.message ?? e), at: k.now() };
    }
    c.save(name + '-up.json', { ...up, firedAt: fired, reason });
    if (up.state === 'UNKNOWN' || reason !== 'consumed pulse') c.fail('independent release unresolved: ' + reason, name);
  }
}

// Child stdout/stderr retained from spawn; the armed line is consumed like readline().
function track(child) {
  const t = { out: [], err: [], line: null, closed: false, waiters: [] };
  const notify = () => { for (const w of t.waiters.splice(0)) w(); };
  child.stdout.on('data', b => { t.out.push(b); notify(); });
  child.stderr.on('data', b => t.err.push(b));
  t.done = new Promise(resolve => child.once('close', (code, signal) => { t.closed = true; t.returncode = k.returncode(code, signal); notify(); resolve(); }));
  child.once('error', () => {});
  t.readable = ms => new Promise(resolve => {
    if (Buffer.concat(t.out).length || t.closed) return resolve(true);
    const timer = setTimeout(() => resolve(false), ms); t.waiters.push(() => { clearTimeout(timer); resolve(true); });
  });
  t.readline = async () => {
    for (;;) {
      const all = Buffer.concat(t.out), i = all.indexOf(10);
      if (i >= 0) { t.out = [all.subarray(i + 1)]; return all.subarray(0, i + 1).toString(); }
      if (t.closed) { t.out = []; return all.toString(); }
      await new Promise(resolve => t.waiters.push(resolve));
    }
  };
  t.wait = ms => Promise.race([t.done, new Promise((_, reject) => setTimeout(() => reject(Error('TimeoutExpired')), ms))]);
  return t;
}

async function action(name, command, scene, mode, milliseconds = 400, route = null) {
  assert(isAlnum(name.replaceAll('-', '')));
  // A 40 ms pulse cannot satisfy the strict >40 ms scheduling margin below.
  // Reject it locally rather than dispatching an inevitably terminal gesture.
  assert(Number.isInteger(milliseconds) && 80 <= milliseconds && milliseconds <= 1400);
  for (const suffix of ['-intent.json', '-up.json', '-receipt.json', '-completed.json', '.png', '.json'])
    assert(!c.has(name + suffix), 'name already reserved');
  // A local policy refusal before reservation/transport has no input effect.
  const [rr, , sceneEnd] = policy(command, scene, mode, route);
  assert(k.now() + milliseconds / 1000 + .7 < sceneEnd, 'insufficient fresh scene window; not sent');
  let child = null, t = null, receipt = null, error = null, armed = null, p, owner, before;
  try {
    [owner, before] = await c.lease();
    const now = k.now();
    p = { name, mode, command, scene, pngSHA256: rr.pngSHA256, target: rr.target, owner,
      nonce: crypto.randomUUID(), noReplay: true, milliseconds, createdAt: now,
      gestureDeadline: now + 1.500, fallbackAt: now + 1.750,
      final: mode === 'quit' && ['select-exit', 'titlebar-close', 'confirm-exit', 'cancel-installer'].includes(route), sceneDeadline: sceneEnd };
    c.save(name + '-intent.json', p); c.save(scene + '-used-by-' + name, { name });
    child = cp.spawn(process.execPath, [__filename, 'release', name], { stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, SIMS_CONTROL_OUT: c.R, SIMS_CONTROL_URL: c.URL } });
    t = track(child);
    assert(await t.readable(500), 'independent UP not armed');
    armed = JSON.parse(await t.readline());
    assert(armed.armed && isDeepStrictEqual(armed.target, p.target) && armed.fallbackAt === p.fallbackAt);
    assert(child.exitCode === null && child.signalCode === null, 'independent UP child died before DOWN');
    assert(k.now() + milliseconds / 1000 + .15 < p.gestureDeadline, 'hold cannot fit before DOWN');
    assert(k.now() < sceneEnd, 'scene expired before DOWN');
    receipt = await c.call({ action: 'guarded-input', cmd: command,
      guard: { ...owner, nonce: p.nonce, reviewed: true, deadline: Math.trunc(Math.min(sceneEnd, p.gestureDeadline) * 1000) } }, .5);
    assert(consumed(receipt, owner, p.nonce), 'input unresolved; no replay');
    const due = receipt.consumedAt / 1000 + milliseconds / 1000;
    const payload = Buffer.from(JSON.stringify({ at: due, receipt }) + '\n');
    assert(payload.length < 4096 && child.stdin.write(payload) !== undefined);
    assert(k.now() + .04 < due && due <= p.gestureDeadline, 'late ACK; closed after independent UP');
    // No capture, model call or persistence until independent physical UP.
    await t.wait(3000);
  } catch (e) { error = e; }
  finally {
    if (child !== null) {
      try { child.stdin.end(); } catch {}
      await Promise.race([t.done, k.sleep(5000)]);
      if (!t.closed) throw Error('TimeoutExpired: independent release child');
      c.save(name + '-release-wait.json', { pid: child.pid, exit: t.returncode, actualWait: true, stdoutEOF: true, stderrEOF: true,
        stdout: Buffer.concat(t.out).toString(), stderr: Buffer.concat(t.err).toString() });
    }
    if (armed !== null) c.save(name + '-armed.json', armed);
    if (receipt !== null) c.save(name + '-receipt.json', receipt);
  }
  try {
    if (error) throw error;
    assert(t.returncode === 0, 'independent UP child failed');
    const up = c.read(name + '-up.json');
    assert(['ACK', 'OWNER_EXITED'].includes(up.state) && up.reason === 'consumed pulse');
    assert(up.firedAt <= p.fallbackAt && up.at - receipt.consumedAt / 1000 <= 1.500, 'release exceeded bound');
    if (up.state === 'OWNER_EXITED') {
      assert(p.final && isDeepStrictEqual(c.exited_owner(p.target), up.nativeWait));
      c.save('terminal-owner-exited.json', { name, physicalUpACK: false, nativeQuitClaim: false, noReplay: true });
    } else {
      if (c.has('last-intent.json')) fs.unlinkSync(path.join(c.R, 'last-intent.json'));
      c.save('last-intent.json', { nonces: [p.nonce] });
    }
    c.save(name + '-completed.json', { at: k.now(), actualGameplayClaim: false, nativeQuitClaim: false, before });
    if (mode === 'action') c.save('chosen-action.json', { name, scene, at: k.now() });
    return p.final ? 'Final choice; await actual native wait' : await c.capture(name);
  } catch (e) { c.fail(e, name); throw e; }
}

module.exports = { c, cutoff, reviewed, bind, checkpoint, policy, consumed, release, action };

if (require.main === module) {
  const argv = process.argv.slice(2);
  (async () => {
    if (argv[0] === 'release') await release(argv[1]);
    else if (argv[0] === 'capture') console.log(await c.capture(argv[1]));
    else if (argv[0] === 'bind') await bind(argv[1]);
    else if (argv[0] === 'checkpoint') await checkpoint(argv[1], argv[2]);
    else {
      const [mode, name, command, scene, ms, route] = argv;
      console.log(await action(name, command, scene, mode, parseInt(ms, 10), route ?? null));
    }
  })().catch(e => { console.error(e); process.exitCode = 1; });
}
