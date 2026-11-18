'use strict';
// Finite manual orders. No game interpretation, OCR, private state or solver.
// JS port of the released StarCraft/Barrage policy. The release process is
// armed before DOWN and receives pulse deadlines over a pipe before audit I/O.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { isDeepStrictEqual: equal } = require('node:util');
const c = require('./native-supervisor-common.cjs');
const a = module.exports;
a.R = path.resolve(process.env.STARCRAFT_CONTROL_OUT || __dirname);
a.URL = process.env.STARCRAFT_CONTROL_URL || 'http://127.0.0.1:8507/ctl';
a.now = c.now;
const P = n => path.join(a.R, n), exists = n => fs.existsSync(P(n));
const ok = (v, msg = 'policy assertion') => { if (!v) throw Error(msg); };
const named = n => typeof n === 'string' && /^[A-Za-z0-9][A-Za-z0-9-]*$/.test(n);
const hash = n => c.sha256(fs.readFileSync(P(n)));
a.save = (n, v) => c.save(a.R, n, v);
a.read = n => c.readJSON(P(n));
a.call = async (command, timeout = 10) => {
  const r = await c.postJSON(a.URL, command, timeout);
  ok(r.ok, JSON.stringify(r)); return r.value;
};
a.opened = () => {
  ok(!exists('terminal-input-failure.json'), 'sticky UNKNOWN/closed; no replay');
  ok(!exists('terminal-owner-exited.json') && !exists('native-wait.json'), 'native terminal; no replay');
  ok(a.now() + 2 < a.read('launch.json').deadline, 'immutable runtime deadline');
  const info = a.read('native-pid.json'), url = new URL(a.URL);
  ok(c.token(info.pid) === info.startToken, 'native identity changed');
  ok(url.hostname === '127.0.0.1' && url.pathname === '/ctl' && c.listenerOwnedBy(info.pid, Number(url.port)), 'exclusive native endpoint required');
};
a.fail = (e, name) => {
  if (!exists('terminal-owner-exited.json') && !exists('terminal-input-failure.json'))
    a.save('terminal-input-failure.json', { at: a.now(), name, error: String(e.message || e), noReplay: true });
};
a.cutoff = () => {
  const l = a.read('launch.json'); ok(l.deadline - l.at > 180, 'fixed Quit reserve required');
  return l.deadline - 180;
};
a.reviewed = (scene, maxAge = 30) => {
  ok(named(scene), 'safe scene name required');
  const rr = a.read(scene + '.json'), r = a.read(scene + '-review.json');
  ok(r.submittedScene === true && r.observation?.trim(), 'personal complete scene review required');
  ok([rr, r].every(x => a.now() - x.at >= 0 && a.now() - x.at < maxAge), 'scene review expired');
  ok(r.pngSHA256 === rr.pngSHA256 && rr.pngSHA256 === hash(scene + '.png'), 'review image changed');
  ok(equal(rr.target, a.read('native-pid.json')), 'native identity changed');
  ok(rr.snapshot.mainHwnd !== '0x0' && rr.snapshot.eip !== '0x0', 'live native scene required');
  return [rr, r];
};
a.review = (scene, fields) => {
  ok(named(scene));
  const rr = a.read(scene + '.json');
  a.save(scene + '-review.json', { ...fields, at: a.now(), pngSHA256: rr.pngSHA256 });
};
a.bind = async scene => {
  a.cutoff(); const [rr, r] = a.reviewed(scene);
  ok(r.sceneType === 'bootstrap' && r.nativeTitleOrMenu === true, 'bind only truthful native title/menu');
  try {
    a.opened(); ok(!exists('bind-intent.json') && !exists('input-owner.json'), 'permanent owner; no rebind');
    a.save('bind-intent.json', { at: a.now(), permanent: true });
    a.save('input-owner.json', await a.call({ action: 'guarded-bind' }));
    const s = await a.call({ action: 'snapshot' });
    a.save('lease-snapshot.json', { mainHwnd: s.mainHwnd, screen: s.screen });
    a.save('binding-scene.json', { scene, target: rr.target, at: a.now() });
  } catch (e) { a.fail(e, 'bind'); throw e; }
};
a.lease = async () => {
  try {
  a.opened(); const o = a.read('input-owner.json'), s = await a.call({ action: 'snapshot' });
  ok(!s.quit && s.eip !== '0x0', 'native owner unavailable');
  ok(equal({ mainHwnd: s.mainHwnd, screen: s.screen }, a.read('lease-snapshot.json')), 'window/canvas lease changed');
  const links = fs.readdirSync(a.R).filter(n => n.endsWith('-resolved.json')).map(n => a.read(n));
  const last = links.sort((x, y) => y.at - x.at)[0];
  if (last) for (const nonce of last.nonces) {
    const r = await a.call({ action: 'guarded-status', nonce });
    ok(r.owner === o.owner && r.epoch === o.epoch && ['CONSUMED', 'CANCELLED'].includes(r.state) && r.consumed, 'prior intent unresolved/UNKNOWN');
    ok([null, undefined, 'immutable deadline expired', 'independent release'].includes(r.reason), 'guard owner revoked');
  }
  return [o, s];
  } catch (e) { a.fail(e, 'lease'); throw e; }
};
a.capture = async name => {
  ok(named(name) && !exists(name + '.png') && !exists(name + '.json'), 'capture name collision');
  try {
    a.opened(); const at = a.now(), snapshot = await a.call({ action: 'snapshot' });
    const image = await a.call({ cmd: 'png:' + P(name + '.png') });
    a.save(name + '.json', { at, completedAt: a.now(), snapshot, image, pngSHA256: hash(name + '.png'), target: a.read('native-pid.json') });
    return P(name + '.png');
  } catch (e) { a.fail(e, name); throw e; }
};
function admitReviewedMission(scene) {
  ok(!exists('quit-phase.json'), 'irreversible Quit phase');
  const [rr, r] = a.reviewed(scene, 5);
  ok(r.sceneType === 'mission' && r.unobstructedMission === true && r.visibleMissionDescription?.trim(), 'actual mission review required');
  a.save('mission-admitted.json', { scene, pngSHA256: rr.pngSHA256, target: rr.target, at: a.now() });
}
a.admitMission = async scene => {
  await a.lease(); admitReviewedMission(scene);
};
const GAMEPLAY = ['select', 'command', 'target', 'navigate'];
a.policy = (keys, scene, mode, route = null, beforeArm = false) => {
  ok(['bootstrap', 'menu', 'quit', ...GAMEPLAY].includes(mode));
  const end = a.cutoff();
  if ((mode === 'quit' || a.now() >= end) && !exists('quit-phase.json'))
    a.save('quit-phase.json', { at: a.now(), cutoff: end, reserveSeconds: 180, irreversible: true });
  const [rr, r] = a.reviewed(scene, GAMEPLAY.includes(mode) ? 5 : 30);
  ok(r.mode === mode, 'review mode mismatch');
  const point = /^(?:mousedown|mousemove):([0-9]{1,4}):([0-9]{1,4})$/;
  const group = mode === 'select' && keys.length === 2 && keys[0] === 'keydown:17';
  const drag = mode === 'select' && keys.length === 2 && keys[0].startsWith('mousedown:') && keys[1].startsWith('mousemove:');
  ok(drag || ((keys.length === 1 || group) && /^mousedown:[0-9]{1,4}:[0-9]{1,4}$/.test(keys.at(-1))), 'one left gesture; only selection permits Ctrl/box');
  for (const key of keys.filter(k => k !== 'keydown:17')) {
    const m = point.exec(key); ok(m && +m[1] < 800 && +m[2] < 600, '800x600 whole-scene bounds');
  }
  if (group || drag) ok(r.nativeGroupSelectionSemantics?.trim(), 'review ordinary group selection');
  const g = r.pixelGeometry;
  ok(g?.source === 'current-full-scene' && equal(g.target, a.read('native-pid.json')), 'current whole scene geometry required');
  ok(equal(keys.at(-1).split(':').slice(1).map(Number), g.chosenCenter), 'chosen center mismatch');
  if (drag) ok(equal(keys[0].split(':').slice(1).map(Number), g.dragStart), 'drag start mismatch');
  ok(r.visibleTarget?.trim(), 'visible native target required');
  if (mode === 'quit') {
    ok(['open-menu', 'abort-mission', 'confirm-abort', 'quit-game', 'confirm-quit'].includes(route) && r.quitRoute === route && r.visibleQuitTarget === true, 'review ordinary Quit route');
    if (route.startsWith('confirm-')) ok(r.nativeExitConfirmation === true, 'separate native confirmation required');
  } else {
    ok(!exists('quit-phase.json'), 'irreversible Quit phase');
    ok(a.now() + (beforeArm ? 8 : 0) < end, 'mechanical gameplay cutoff');
    if (mode === 'bootstrap') ok(!exists('mission-admitted.json') && r.sceneType === 'bootstrap' && r.nativeSkipOrStart === true, 'native skip/start before mission only');
    else if (mode === 'menu') ok(['pause', 'resume', 'dismiss-tip'].includes(r.nativeMenuPurpose), 'native menu only');
    else {
      ok(exists('mission-admitted.json') && r.sceneType === 'mission' && r.unobstructedMission === true, 'review actual mission before gameplay');
      if (mode === 'navigate') ok(r.navigationIntent?.trim(), 'finite camera gesture required');
      else if (mode === 'select') ok(r.selectionIntent?.trim(), 'selection intent required');
      else {
        ok(r.selectedUnitsEvidence?.trim(), 'confirm actual selection');
        ok(r.nativeCommandSemantics?.trim(), 'native command semantics required');
        ok(['attack', 'move', 'stop', 'hold'].includes(r.commandKind), 'construction is not a substitute');
        if (r.commandKind === 'attack') ok(r.armedUnitHUD?.trim() && r.visibleAttackCommand?.trim(), 'armed HUD/weapon and visible Attack required');
        if (mode === 'target') {
          ok(r.activeCommandEvidence?.trim() && ['attack', 'move'].includes(r.commandKind), 'active command required');
          if (r.commandKind === 'attack') {
            ok(r.visibleEnemy?.trim() && named(r.attackCommandIntent), 'separate visible enemy target required');
            const order = a.read(r.attackCommandIntent + '-combat-order.json');
            ok(order.mode === 'command' && order.commandKind === 'attack' && equal(order.target, rr.target) && order.at <= rr.at, 'target must follow consumed Attack');
            ok(!fs.readdirSync(a.R).filter(n => n.endsWith('-combat-order.json')).map(n => a.read(n)).some(v => v.mode === 'command' && v.at > order.at), 'another command superseded Attack');
          }
        }
      }
    }
  }
  return end;
};
a.exitedOwner = expected => {
  if (!exists('native-wait.json')) return null;
  const w = a.read('native-wait.json'), info = a.read('native-pid.json');
  if (!['pid', 'startToken'].every(k => w[k] === expected[k] && info[k] === expected[k]) || !expected.startToken) return null;
  return w.actualWait && w.stdoutEOF && w.stderrEOF && w.exit === 0 && equal(w.drainErrors, []) && w.at >= info.at ? w : null;
};
a.positivelyUnsent = (rs, owner, nonces) => rs.length > 0 && rs.length <= nonces.length && rs.every((r, i) =>
  r.owner === owner.owner && r.epoch === owner.epoch && r.nonce === nonces[i] && r.state === 'CANCELLED' && r.queued === false && r.consumed === false && r.consumedAt === null && r.noReplay === true && r.reason === 'immutable deadline expired');
a.release = async (name, owner, deadline, final) => {
  const target = a.read('native-pid.json');
  let due = deadline, source = 'fallback', pending = '', down = [];
  process.stdin.setEncoding('utf8'); process.stdin.on('data', b => {
    pending += b; let i;
    while ((i = pending.indexOf('\n')) >= 0) {
      const v = JSON.parse(pending.slice(0, i)); pending = pending.slice(i + 1);
      due = Math.min(due, v.at); source = 'consumed-pulse'; down.push(v.receipt);
    }
  });
  process.stdout.write(JSON.stringify({ armed: true, pid: process.pid, deadline, owner, target, at: a.now() }) + '\n');
  while (a.now() < due) {
    if (exists(name + '-release-cap.json')) due = Math.min(due, a.read(name + '-release-cap.json').at);
    await c.sleep(Math.min(5, Math.max(0, (due - a.now()) * 1000)));
  }
  const fired = { at: a.now(), due, source, fallback: deadline };
  let up;
  try { up = { state: 'ACK', reply: await a.call({ action: 'guarded-release', owner }), at: a.now() }; }
  catch (e) {
    if (final && down.length && down.every(r => r.state === 'CONSUMED' && r.consumed && r.owner === owner)) {
      const end = Math.min(deadline, exists(name + '-release-cap.json') ? a.read(name + '-release-cap.json').at : deadline);
      while (a.now() < end && !up) {
        const wait = a.exitedOwner(target);
        if (wait) up = { state: 'OWNER_EXITED', physicalUpACK: false, nativeWait: wait, target, at: a.now() };
        else await c.sleep(10);
      }
    }
    if (!up) up = { state: 'UNKNOWN', error: String(e.message), at: a.now() };
  }
  process.stdin.destroy();
  a.save(name + '-release-fired.json', fired); a.save(name + '-up.json', up);
  ok(up.state !== 'UNKNOWN', 'independent UP UNKNOWN');
};
function armLine(child) {
  return new Promise((resolve, reject) => {
    let b = ''; const timer = setTimeout(() => reject(Error('independent arm deadline')), 1500);
    child.once('error', e => { clearTimeout(timer); reject(e); });
    child.once('close', () => { clearTimeout(timer); if (!b.includes('\n')) reject(Error('release child exited before arm')); });
    child.stdout.on('data', v => { b += v; if (b.includes('\n')) { clearTimeout(timer); resolve(JSON.parse(b.slice(0, b.indexOf('\n')))); } });
  });
}
a.pulse = async (name, keys, ms, scene, mode, route = null, admit = false) => {
  ok(named(name) && ms >= 40 && ms <= 1500, 'finite named pulse required');
  // Combined manual submit performs the same admission lease once, before
  // policy/arm, and reuses that exact in-memory lease for this single pulse.
  // No HTTP or human-review step intervenes; standalone callers still lease.
  let admittedLease;
  if (admit) {
    ok(GAMEPLAY.includes(mode), 'mission admission requires gameplay scene');
    admittedLease = await a.lease(); admitReviewedMission(scene);
  }
  a.policy(keys, scene, mode, route, true); // Local refusal has no endpoint effect.
  for (const suffix of ['.json', '.png', '-intent.json', '-up.json']) ok(!exists(name + suffix), 'output name collision');
  ok(!fs.readdirSync(a.R).some(n => n.startsWith(scene + '-used-by-')), 'scene already used');
  const final = mode === 'quit' && ['confirm-abort', 'quit-game', 'confirm-quit'].includes(route);
  try {
    const [owner, before] = admittedLease || await a.lease();
    let rr, review;
    try { [rr, review] = a.reviewed(scene, GAMEPLAY.includes(mode) ? 5 : 30); }
    catch (e) {
      if (!/expired/.test(e.message)) throw e;
      a.save(name + '-rejection.json', { state: 'NOT_SENT', effects: false, reason: e.message, at: a.now() });
      return 'NOT_SENT: local expiry before arm';
    }
    ok(before.physicalUp && before.capture === '0x0' && rr.snapshot.physicalUp && rr.snapshot.capture === '0x0', 'physical UP before intention required');
    const nonces = keys.map(() => randomUUID());
    a.save(name + '-intent.json', { name, keys, ms, scene, nonces, review, at: a.now() });
    a.save(scene + '-used-by-' + name, { name });
    const startedAt = a.now(), deadline = Math.min(startedAt + 6, rr.at + 30);
    const required = .5 + keys.length + ms / 1000 + .25;
    a.save(name + '-operation.json', { startedAt, deadline, operationWindowSeconds: 6, sceneDeadline: rr.at + (GAMEPLAY.includes(mode) ? 5 : 30), required });
    ok(deadline - a.now() >= required && deadline + 2 < a.read('launch.json').deadline, 'complete finite operation window');
    const child = cp.spawn(process.execPath, [__filename, 'release', name, owner.owner, String(deadline), ...(final ? ['final'] : [])],
      { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, STARCRAFT_CONTROL_OUT: a.R, STARCRAFT_CONTROL_URL: a.URL } });
    let stdout = '', stderr = ''; child.stdout.on('data', b => { stdout += b; }); child.stderr.on('data', b => { stderr += b; });
    child.stdin.on('error', () => {});
    const closed = new Promise(resolve => child.once('close', (code, signal) => resolve(c.returncode(code, signal))));
    const receipts = [], timings = []; let unsent = false, local = false;
    try {
      const armed = await armLine(child); ok(armed.armed); a.save(name + '-armed.json', armed);
      // Check the complete policy after arm, before any edge; local expiry can
      // safely stop here. The independent release is already finite.
      try { a.policy(keys, scene, mode, route); } catch (e) {
        if (!/expired/.test(e.message)) throw e;
        local = true; a.save(name + '-rejection.json', { state: 'NOT_SENT', effects: false, reason: e.message, at: a.now() });
      }
      if (!local) {
        ok(deadline - a.now() >= keys.length + ms / 1000 + .25, 'complete window after arm');
        const capAt = a.now() + 1.750;
        a.save(name + '-release-cap.json', { at: capAt, beforeFirstDown: true, fallbackMilliseconds: 1750, maximumHoldMilliseconds: 2000 });
        for (let i = 0; i < keys.length; i++) {
          const end = a.policy(keys, scene, mode, route);
          ok(a.now() < capAt, 'pre-DOWN cap expired');
          const guardDeadline = Math.min(deadline, capAt, rr.at + (GAMEPLAY.includes(mode) ? 5 : 30), mode === 'quit' ? Infinity : end);
          const r = await a.call({ action: 'guarded-input', cmd: keys[i], guard: { ...owner, nonce: nonces[i], reviewed: true, deadline: Math.trunc(guardDeadline * 1000) } }, 1);
          receipts.push(r); const returnedAt = a.now(); timings.push({ returnedAt, consumedAt: r.consumedAt });
          if (r.state !== 'CONSUMED' || !r.consumed) {
            ok(a.positivelyUnsent(receipts, owner, nonces), JSON.stringify(r)); unsent = true;
          }
          const schedule = { at: unsent ? a.now() : r.consumedAt / 1000 + ms / 1000, receipt: r };
          const payload = JSON.stringify(schedule) + '\n'; ok(Buffer.byteLength(payload) <= 4096, 'finite atomic pipe message');
          await new Promise((resolve, reject) => child.stdin.write(payload, e => e ? reject(e) : resolve()));
          if (unsent) break;
        }
        if (!unsent) {
          const releaseAt = Math.min(...receipts.map(r => r.consumedAt / 1000)) + ms / 1000;
          ok(Math.max(...receipts.map(r => r.consumedAt / 1000)) + ms / 1000 < capAt && releaseAt + .25 < deadline, 'complete pulse before fallback');
          ok(timings.every(t => t.returnedAt < releaseAt), 'ACK arrived too late for complete pulse');
        }
      }
    } finally {
      child.stdin.end();
      // The already armed release has a finite deadline. Its HTTP timeout is
      // finite as well; do not terminate it before it can perform physical UP.
      const code = await closed;
      receipts.forEach((r, i) => a.save(name + '-receipt-' + i + '.json', r));
      a.save(name + '-down.json', receipts); a.save(name + '-ack-timing.json', timings);
      a.save(name + '-release-wait.json', { pid: child.pid, exit: code, actualWait: true, stdoutEOF: true, stderrEOF: true, stdout, stderr });
      ok(code === 0, 'independent release failed');
    }
    const up = a.read(name + '-up.json');
    if (local) return 'NOT_SENT: local expiry';
    if (final && up.state === 'OWNER_EXITED') {
      ok(equal(up.target, a.read('native-pid.json')) && up.at < deadline && receipts.every(r => up.at - r.consumedAt / 1000 <= 2), 'bounded actual native exit required');
      a.save('terminal-owner-exited.json', { name, ...up, noReplay: true }); return 'OWNER_EXITED: actual wait; physical UP unacknowledged';
    }
    ok(up.state === 'ACK' && up.reply.released === true && up.reply.owner === owner.owner && up.at < deadline, 'finite owner UP ACK required');
    if (unsent) {
      const status = [];
      for (const r of receipts) status.push(await a.call({ action: 'guarded-status', nonce: r.nonce }));
      ok(equal(status, receipts) && a.positivelyUnsent(status, owner, nonces), 'positive refusal unresolved');
      a.save(name + '-rejection.json', { state: 'NOT_SENT', positivelyUnsent: true, at: a.now() }); return 'NOT_SENT: positive cancellation';
    }
    ok(receipts.every(r => up.at - r.consumedAt / 1000 <= 2), 'physical release exceeded two seconds');
    a.save(name + '-resolved.json', { nonces, at: a.now() });
    if (['command', 'target'].includes(mode)) a.save(name + '-combat-order.json', { mode, commandKind: review.commandKind, scene, review, target: rr.target, at: Math.max(...receipts.map(r => r.consumedAt)) / 1000 });
    a.save(name + '-workflow.json', { captureAt: rr.at, captureCompletedAt: rr.completedAt, reviewedAt: review.at, dispatchCompletedAt: timings.at(-1).returnedAt, releasedAt: up.at, captureToDispatchSeconds: timings.at(-1).returnedAt - rr.at });
    if (final) return 'Final reviewed choice submitted; await actual native wait';
    const s = await a.call({ action: 'snapshot' }); ok(s.physicalUp && s.capture === '0x0', 'physical UP state required');
    const end = a.now() + 10;
    for (;;) {
      const next = await a.call({ action: 'snapshot' });
      if (next.batch > s.batch) break;
      ok(a.now() < end, 'no postrelease progress'); await c.sleep(20);
    }
    return await a.capture(name);
  } catch (e) { a.fail(e, name); throw e; }
};
a.recordResult = async (name, scene, attack) => {
  await a.lease(); const [rr, r] = a.reviewed(scene, 5), order = a.read(attack + '-combat-order.json');
  ok(r.sceneType === 'mission' && r.unobstructedMission === true && order.mode === 'target' && order.commandKind === 'attack' && equal(order.target, rr.target) && order.at < rr.at);
  ok(r.settledSceneEvidence?.trim() && r.consequenceEvidence?.trim(), 'settled visible consequence review required');
  ok(['damage', 'destruction', 'unproven'].includes(r.enemyConsequence) && ['selected-unit', 'ambiguous', 'unproven'].includes(r.attribution));
  ok(!r.otherUnitsFiring || r.attribution === 'ambiguous', 'other shooters make attribution ambiguous');
  ok(r.enemyConsequence === 'unproven' || r.persistentConsequenceEvidence?.trim(), 'fire/movement alone is partial');
  a.save(name + '-combat-result.json', { scene, attack, review: r, target: rr.target, at: a.now(), objectiveProven: r.enemyConsequence !== 'unproven' && r.attribution === 'selected-unit', missionWinClaim: false });
};
a.main = async args => {
  const [action, ...v] = args;
  if (action === 'release') return a.release(v[0], v[1], +v[2], v[3] === 'final');
  if (action === 'capture') return console.log(await a.capture(v[0]));
  if (action === 'bind') return a.bind(v[0]);
  if (action === 'admit-mission') return a.admitMission(v[0]);
  if (action === 'result') return a.recordResult(...v);
  // A caller submits its personal whole-image review and exactly one manual
  // gesture together. No capture polling, automatic decision or action loop.
  if (action === 'submit') {
    const request = JSON.parse(fs.readFileSync(0, 'utf8'));
    a.review(request.scene, request.review);
    if (request.bind) await a.bind(request.scene);
    if (request.admit && !request.keys) await a.admitMission(request.scene);
    if (request.keys) console.log(await a.pulse(request.name, request.keys, request.ms, request.scene, request.review.mode, request.route, !!request.admit));
    return;
  }
  throw Error('expected capture, bind, admit-mission, result or submit');
};
if (require.main === module) a.main(process.argv.slice(2)).catch(e => { console.error(e); process.exitCode = 1; });
