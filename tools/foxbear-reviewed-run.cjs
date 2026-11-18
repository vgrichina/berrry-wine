'use strict';
// Manual FoxBear control adapted from the published Donuts finite input helper.
// Original embedded help + WndProc: numpad 2/3/4/5/6/7 and ordinary F12 Quit.
// App-specific JavaScript port; finite native consumption and independent UP.
//
// The fixed Quit reserve is enforced before arm and again before every edge.
// There is no gameplay delivery loop or automatic Quit sequence.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), crypto = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const c = require('./native-supervisor-common.cjs');
const SELF = __filename;

// Mutable like the Python module globals (tests assign m.R / m.URL).
const S = { R: path.resolve(process.env.FOXBEAR_CONTROL_OUT || __dirname), URL: process.env.FOXBEAR_CONTROL_URL || 'http://127.0.0.1:8444/ctl' };
const P = n => path.join(S.R, n);
const now = c.now, mono = () => performance.now() / 1000;
const ok = (cond, message) => { if (!cond) throw Object.assign(Error(typeof message === 'string' ? message : JSON.stringify(message ?? 'assertion failed')), { name: 'AssertionError' }); };
const sha = file => c.sha256(fs.readFileSync(file));
const alnumName = name => /^[A-Za-z0-9]+$/.test(name.replaceAll('-', ''));

function save(n, v) { c.save(S.R, n, v); }
function read(n) { return c.readJSON(P(n)); }
async function call(command, timeout = 10) {
  if (c.exists(P('launch.json')) && read('launch.json').inputPolicy) timeout = Math.min(timeout, 3);
  const r = await c.postJSON(S.URL, command, timeout);
  if (!r.ok) throw Error(JSON.stringify(r));
  return r.value;
}
class ReserveRejected extends Error { constructor(m) { super(m); this.name = 'ReserveRejected'; } }
const QUIT_ROUTES = { 'ordinary-f12': ['keydown:123'] };
const CONTEXT_CONTRACT = 'native-reviewed-context-v1';
const contextContract = () => read('launch.json').bindingContract === CONTEXT_CONTRACT;
function nativeReview(rr, personal) {
  ok(personal.wholeFrame === true && personal.pngSHA256 === rr.pngSHA256, 'complete reviewed image required');
  return { contract: CONTEXT_CONTRACT, captureId: rr.captureId, pngSHA256: rr.pngSHA256,
    reviewed: true, reviewedAt: personal.at * 1000, scope: personal.scene, targetHwnd: personal.targetHwnd };
}

function reserve() {
  const launch = read('launch.json');
  const seconds = launch.reserveSeconds ?? 180;
  ok([180, 300].includes(seconds) && launch.gameplayCutoff === launch.deadline - seconds, 'immutable Quit reserve missing');
  ok(launch.at < launch.gameplayCutoff, 'reserve must be recorded before original');
  return launch.gameplayCutoff;
}
function capturePhase() {
  // Captures remain available for personally reviewing the ordinary Quit
  // route, but crossing the cutoff can never reopen gameplay.
  const cutoff = reserve();
  if (now() >= cutoff && !c.exists(P('quit-phase.json'))) save('quit-phase.json', { at: now(), cutoff, irreversible: true });
  return cutoff;
}
function freshness(review) {
  const p = read('launch.json').inputPolicy;
  if (!p) return 30;
  const scene = read(review + '-review.json').scene;
  ok(['game', 'menu'].includes(scene), 'explicit personally reviewed game/menu scene required');
  const seconds = scene === 'game' ? p.gameFreshnessSeconds : p.menuFreshnessSeconds;
  ok(seconds > 0 && seconds <= (scene === 'game' ? (contextContract() ? 15 : 5) : 30), 'finite native review policy');
  return seconds;
}
async function bind(review = null) {
  try {
  opened(); reserve(); ok(!c.exists(P('bind-intent.json')) && !c.exists(P('input-owner.json')), 'permanent attempt/owner; no rebind');
  const command = { action: 'guarded-bind' };
  if (read('launch.json').nativeScene) {
    ok(review, 'original binding requires a personally reviewed complete scene');
    const rr = read(review + '.json'), personal = read(review + '-review.json');
    const limit = contextContract() ? freshness(review) : 30;
    ok(now() - rr.at >= 0 && now() - rr.at < limit && now() - personal.at >= 0 && now() - personal.at < limit, 'binding review expired');
    ok(personal.pngSHA256 === rr.pngSHA256 && rr.pngSHA256 === sha(P(review + '.png')));
    command.reviewedScene = contextContract() ? nativeReview(rr, personal) : { route: 'native-scene-v1', snapshot: rr.snapshot, pngSHA256: rr.pngSHA256 };
  }
  save('bind-intent.json', { at: now(), permanent: true, review });
  save('input-owner.json', await call(command)); const s = await call({ action: 'snapshot' });
  save('lease-snapshot.json', { mainHwnd: s.mainHwnd, screen: s.screen });
  } catch (e) { fail(e, 'bind'); throw e; }
}
function policy(intent, keys, review = null, route = null, operationEnd = null) {
  const cutoff = capturePhase();
  if (now() >= cutoff || intent === 'quit') {
    if (!c.exists(P('quit-phase.json'))) save('quit-phase.json', { at: now(), cutoff, irreversible: true });
  }
  ok(['gameplay', 'quit'].includes(intent), 'explicit gameplay or quit intent required');
  if (intent === 'quit') {
    if (!(route in QUIT_ROUTES) || !(keys.length === 1 && QUIT_ROUTES[route].includes(keys[0])))
      throw new ReserveRejected('only ordinary reviewed FoxBear menu/Quit-route intents');
    if (review !== null && read(review + '-review.json').quitRoute !== route)
      throw new ReserveRejected('fresh personal review must explicitly bind this Quit route');
  } else if (c.exists(P('quit-phase.json')) || (operationEnd !== null && operationEnd >= cutoff))
    throw new ReserveRejected('gameplay cutoff: preserve Quit reserve before arm/DOWN');
  return cutoff;
}
function endpointIdentity(info) {
  const parsed = new URL(S.URL);
  ok(parsed.hostname === '127.0.0.1' && parsed.pathname === '/ctl', 'direct loopback endpoint only');
  ok(c.listenerOwnedBy(info.pid, Number(parsed.port || 80)), 'endpoint must belong to native owner');
}
function opened() {
  ok(!c.exists(P('terminal-input-failure.json')), 'sticky UNKNOWN/closed; no replay');
  ok(!c.exists(P('terminal-owner-exited.json')), 'native owner exited; no replay');
  ok(!c.exists(P('native-wait.json')), 'native terminal');
  ok(now() + 2 < read('launch.json').deadline, 'immutable runtime deadline');
  const info = read('native-pid.json');
  ok(c.token(info.pid) === info.startToken, 'native identity changed');
  endpointIdentity(info);
}
function fail(error, name) {
  if (c.exists(P('terminal-owner-exited.json'))) return;
  if (!c.exists(P('terminal-input-failure.json'))) save('terminal-input-failure.json', { name, error: String(error?.message ?? error), noReplay: true, at: now() });
}
async function lease() {
  opened(); const o = read('input-owner.json'), s = await call({ action: 'snapshot' });
  ok(!s.quit && s.eip !== '0x0', 'native owner unavailable');
  ok(isDeepStrictEqual({ mainHwnd: s.mainHwnd, screen: s.screen }, read('lease-snapshot.json')), 'window/canvas lease changed');
  if (c.exists(P('last-intent.json'))) {
    for (const n of read('last-intent.json').nonces) {
      const r = await call({ action: 'guarded-status', nonce: n });
      ok(r.owner === o.owner && r.epoch === o.epoch, 'guard ownership changed');
      ok(r.state !== 'UNKNOWN', 'sticky guard UNKNOWN');
      ok(['CONSUMED', 'CANCELLED'].includes(r.state) && r.consumed, 'prior intent unresolved');
      ok([null, undefined, 'immutable deadline expired', 'independent release'].includes(r.reason), 'guard owner revoked');
    }
  }
  return [o, s];
}
async function capture(name, operationDeadline = null) {
  try {
    ok(alnumName(name)); capturePhase(); opened();
    const p = P(name + '.png'); ok(!c.exists(p));
    const observe = async command => {
      const remaining = operationDeadline === null ? 10 : operationDeadline - now();
      ok(remaining > 0, '3000ms operation completion exceeded');
      const value = await call(command, remaining);
      if (operationDeadline !== null) ok(now() < operationDeadline, '3000ms operation completion exceeded');
      return value;
    };
    const start = now(); let s, im;
    if (contextContract()) { im = await observe({ action: 'native-reviewed-capture', path: p }); s = im.snapshot; }
    else { s = await observe({ action: 'snapshot' }); capturePhase(); im = await observe({ cmd: 'png:' + p }); }
    const end = now();
    if (read('launch.json').inputPolicy) ok(end - start <= 3, '3000ms observation exceeded');
    if (contextContract()) ok(im.contract === CONTEXT_CONTRACT && im.pngSHA256 === sha(p), 'native encoder provenance mismatch');
    save(name + '.json', { at: start, completedAt: end, snapshot: s, image: im, pngSHA256: sha(p),
      ...(contextContract() ? { captureId: im.captureId, contract: im.contract, nativeStartedAt: im.startedAt, nativeCompletedAt: im.completedAt } : {}) });
    return p;
  } catch (e) { fail(e, name); throw e; }
}
// A successful actual harness wait, not a guest exit-code or physical UP claim.
function exitedOwner(expected) {
  let info, wait;
  try { info = read('native-pid.json'); wait = read('native-wait.json'); } catch { return null; }
  if (['pid', 'startToken'].some(k => !isDeepStrictEqual(info[k], expected[k]) || !isDeepStrictEqual(wait[k], expected[k]))) return null;
  if (typeof expected.startToken !== 'string' || !expected.startToken) return null;
  if (!['actualWait', 'stdoutEOF', 'stderrEOF'].every(k => wait[k] === true)) return null;
  if (wait.exit !== 0 || !isDeepStrictEqual(wait.drainErrors, []) || (wait.at ?? 0) < info.at) return null;
  return wait;
}
function admissionAllowance(ms, strict) {
  // Reserve existing bounds, not the observed latency of the last pulse.
  // The fallback is armed before DOWN; even its latest release needs one
  // confirmation budget. The consumed path needs DOWN ACK + pulse + UP ACK.
  if (!strict) return ms / 1000;
  return Math.max(1.750, .500 + ms / 1000 + .500, 1.650 + .500);
}
function admissionFits(t, deadline, allowance, releaseCap = null, ms = 0) {
  // Equality is refused: the successful ACK must be strictly before deadline.
  return t + allowance < deadline && (releaseCap === null || t + .500 + ms / 1000 < releaseCap);
}
function freshnessFits(t, deadline, strict, nativeConsumptionFenced = false) {
  // Native-scene delivery carries this same immutable expiry to the server's
  // pre-effect and owner USER-return fences. Only consumption targets the
  // reviewed scene; its reply has a separate 500ms delivery-relative bound.
  // Unproved/legacy routes retain the conservative confirmation reserve.
  const nativeDeadline = strict ? Math.trunc(deadline * 1000) / 1000 : deadline;
  return t + (strict && !nativeConsumptionFenced ? .500 : 0) < nativeDeadline;
}

async function release(name, owner, deadline, final = false) {
  const target = read('native-pid.json');
  process.stdout.write(JSON.stringify({ armed: true, pid: process.pid, deadline, owner, target, at: now() }) + '\n');
  // Already armed at the immutable fallback. A consumed ACK can only shorten it.
  let due = deadline, source = 'fallback';
  while (now() < due) {
    if (c.exists(P(name + '-disarm.json'))) {
      save(name + '-release-skipped.json', { state: 'NOT_SENT', at: now(), reason: 'disarmed before DOWN' }); return;
    }
    if (c.exists(P(name + '-release-at.json'))) { due = Math.min(due, read(name + '-release-at.json').at); source = 'consumed-pulse'; }
    await c.sleep(Math.min(5, Math.max(0, (due - now()) * 1000)));
  }
  if (!c.exists(P(name + '-dispatch.json'))) {
    save(name + '-release-skipped.json', { state: 'NOT_SENT', at: now(), reason: 'no DOWN dispatch authorized' }); return;
  }
  save(name + '-release-fired.json', { at: now(), due, source, fallback: deadline });
  try {
    const strict = read('launch.json').inputPolicy, start = now();
    const reply = await call({ action: 'guarded-release', owner }, strict ? .5 : 10);
    if (strict) ok(now() - start <= .5, '500ms release confirmation exceeded');
    save(name + '-up.json', { state: 'ACK', reply, at: now() });
  } catch (e) {
    // A reviewed final choice can retire the native before the finite UP.
    // Port closure alone never proves that. Preserve failed/signal waits
    // and unresolved DOWN as UNKNOWN, without replay or a fabricated ACK.
    if (final && c.exists(P(name + '-down.json'))) {
      const down = read(name + '-down.json');
      if (down && down.length && down.every(r => r.state === 'CONSUMED' && r.consumed && r.owner === owner)) {
        while (now() < deadline) {
          const wait = exitedOwner(target);
          if (wait !== null) {
            save(name + '-up.json', { state: 'OWNER_EXITED', physicalUpACK: false, nativeWait: wait, target, error: String(e.message ?? e), at: now() });
            return;
          }
          await c.sleep(10);
        }
      }
    }
    save(name + '-up.json', { state: 'UNKNOWN', error: String(e.message ?? e), at: now() }); throw e;
  }
}

// First stdout line from the release child, within a deadline (select()).
function firstLine(child, ms) {
  return new Promise((resolve, reject) => {
    let text = '';
    const timer = setTimeout(() => reject(Error('independent release child arm deadline')), ms);
    child.stdout.on('data', b => { text += b; const i = text.indexOf('\n'); if (i >= 0) { clearTimeout(timer); resolve(text.slice(0, i)); } });
  });
}

async function pulse(name, keys, ms, review, description, final = false, intent = 'gameplay', route = null) {
  const startedAt = now(), startedMono = mono();
  ok(alnumName(name) && ms >= 40 && ms <= 1000);
  ok(keys.length === 1 && /^keydown:(?:98|99|100|101|102|103|123)$/.test(keys[0]), 'one ordinary FoxBear keyboard gesture');
  ok(description.trim(), 'personal scene review required');
  policy(intent, keys, review, route);
  try {
    const [owner, before] = await lease(); const rr = read(review + '.json'), reviewed = read(review + '-review.json');
    const native = read('launch.json').nativeScene ?? false;
    if (native) {
      ok(before.physicalUp && before.capture === '0x0', 'native physical UP required before intention');
      ok(rr.snapshot.physicalUp && rr.snapshot.capture === '0x0', 'review must precede any held input');
    }
    const fresh = freshness(review);
    ok(now() - reviewed.at >= 0 && now() - reviewed.at < fresh, 'personal review age expired');
    ok(reviewed.pngSHA256 === rr.pngSHA256, 'review binding changed');
    ok(sha(P(review + '.png')) === rr.pngSHA256, 'review image changed');
    ok(!fs.readdirSync(S.R).some(f => f.startsWith(review + '-used-by-')), 'capture already reserved; fresh review required');
    const nonces = keys.map(() => crypto.randomUUID());
    const record = { name, keys, ms, review, reviewSHA256: rr.pngSHA256, description, nonces, createdAt: now(), intent, quitRoute: route };
    save(name + '-intent.json', record); save(review + '-used-by-' + name, { intent: name });
    const age = now() - rr.at;
    if (!(age >= 0 && age < fresh)) {
      save(name + '-rejection.json', { state: 'NOT_SENT', lease: 'VALID', reason: 'review expired before DOWN/arm', age, nonces, at: now() });
      return 'NOT_SENT: review expired; fresh capture + review + NEW intent required';
    }
    const strict = read('launch.json').inputPolicy;
    const window = strict ? 3.0 : 6.0;
    const deadline = startedAt + window;
    const targetingDeadline = Math.min(rr.at + fresh, reviewed.at + fresh);
    const allowance = admissionAllowance(ms, strict);
    save(name + '-operation.json', { startedAt, deadline, targetingDeadline, pulseMilliseconds: ms, operationWindowSeconds: window,
      admissionAllowanceSeconds: allowance, confirmationSeconds: strict ? .500 : null,
      targetingConfirmationReserveSeconds: strict && !native ? .500 : 0, nativeConsumptionFenced: native });
    const reject = (stage, reason = 'insufficient remaining finite-intent budget', targeting = false) => {
      save(name + '-rejection.json', { state: 'NOT_SENT', lease: 'VALID', reason, stage, domain: targeting ? 'targeting' : 'completion',
        deadline: targeting ? targetingDeadline : deadline, requiredSeconds: targeting ? (strict && !native ? .500 : 0) : allowance, nonces, at: now(), effects: false });
      return 'NOT_SENT: insufficient remaining budget; fresh capture + review + NEW intent required';
    };
    if (!freshnessFits(now(), targetingDeadline, strict, native)) return reject('before-prearm', 'targeting admission expired', true);
    if (!admissionFits(now(), deadline, allowance)) return reject('before-prearm');
    ok(deadline + 2 < read('launch.json').deadline, 'operation exceeds fixed runtime');
    policy(intent, keys, review, route, deadline);
    const releaseCap = now() + (strict ? 1.65 : 2.0);
    save(name + '-release-cap.json', { at: releaseCap, beforeFirstDown: true });
    const child = cp.spawn(process.execPath, [SELF, 'release', name, owner.owner, String(releaseCap), ...(final ? ['final'] : [])],
      { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, FOXBEAR_CONTROL_OUT: S.R, FOXBEAR_CONTROL_URL: S.URL } });
    const childOut = [], childErr = [];
    child.stderr.on('data', b => childErr.push(b));
    const closed = new Promise(resolve => child.once('close', (code, signal) => resolve(c.returncode(code, signal))));
    let armed, deliveryAt, returnedAt; const receipts = [];
    let failure = null;
    try {
      const line = await firstLine(child, 1500);
      childOut.push(Buffer.from(line + '\n'));
      armed = JSON.parse(line); ok(armed.armed); save(name + '-armed.json', armed);
      child.stdout.on('data', b => childOut.push(b));
      if (!freshnessFits(now(), targetingDeadline, strict, native)) {
        save(name + '-disarm.json', { at: now(), beforeDown: true });
        return reject('after-prearm', 'targeting admission expired', true);
      }
      if (!admissionFits(now(), deadline, allowance, strict ? releaseCap : null, ms)) {
        save(name + '-disarm.json', { at: now(), beforeDown: true });
        return reject('after-prearm');
      }
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i], nonce = nonces[i];
        const cutoff = policy(intent, keys, review, route);
        // Only DOWN targets the reviewed scene. Expiry still fences
        // actual native consumption, independently of completion/UP.
        const guard = { ...owner, nonce, reviewed: true,
          deadline: Math.trunc(Math.min(targetingDeadline, deadline, releaseCap, intent === 'gameplay' ? cutoff : deadline) * 1000) };
        if (native) guard.intent = contextContract() ? { review: nativeReview(rr, reviewed) } : rr.snapshot;
        deliveryAt = now();
        if (!freshnessFits(deliveryAt, targetingDeadline, strict, native)) {
          save(name + '-disarm.json', { at: deliveryAt, beforeDown: true });
          return reject('before-dispatch', 'targeting admission expired', true);
        }
        if (!admissionFits(deliveryAt, deadline, allowance, strict ? releaseCap : null, ms)) {
          save(name + '-disarm.json', { at: deliveryAt, beforeDown: true });
          return reject('before-dispatch');
        }
        save(name + '-dispatch.json', { at: deliveryAt, nonce, mayHaveEffects: true });
        const receipt = await call({ action: 'guarded-input', cmd: key, guard }, strict ? .5 : 10);
        returnedAt = now();
        if (strict) ok(returnedAt - deliveryAt <= .5, '500ms confirmation exceeded');
        receipts.push(receipt);
        if (receipt.consumedAt) save(name + '-release-at.json', { at: receipt.consumedAt / 1000 + ms / 1000, immutableOperationDeadline: deadline });
        save(name + '-receipt.json', receipt);
        ok(receipt.state === 'CONSUMED' && receipt.consumed, receipt);
        ok(receipt.owner === owner.owner && receipt.epoch === owner.epoch && receipt.nonce === nonce && receipt.deadline === guard.deadline, 'native receipt identity changed');
        if (native) ok(receipt.receiptBoundary === 'native-input-return' && receipt.nativeMessage?.consumption === 'owner-user-return', 'native consumption proof required');
        // The native pre-effect check can pass just before expiry and
        // publish consumption after it. Do not accept that receipt or
        // reopen the context; the prearmed release remains mandatory.
        ok(Math.trunc(deliveryAt * 1000) <= receipt.consumedAt && receipt.consumedAt < guard.deadline, 'consumption exceeded targeting/admission deadline');
      }
      save(name + '-down.json', receipts);
      const releaseAt = Math.max(...receipts.map(x => x.consumedAt)) / 1000 + ms / 1000;
      ok(releaseAt < deadline, 'finite pulse cannot fit original operation deadline');
      ok(returnedAt < releaseAt, 'late ACK; independent UP retained; no replay');
    } catch (e) { failure = e; }
    finally {
      if (!armed) child.stdout.on('data', b => childOut.push(b));
      const rc = await Promise.race([closed, c.sleep(15000).then(() => { throw Error('TimeoutExpired: release child'); })]);
      save(name + '-release-wait.json', { pid: child.pid, exit: rc, actualWait: true, stdoutEOF: true, stderrEOF: true,
        stdout: Buffer.concat(childOut).toString(), stderr: Buffer.concat(childErr).toString() });
      if (failure) throw failure;
      ok(rc === 0, 'independent release failed; stop');
    }
    const up = read(name + '-up.json');
    if (final && up.state === 'OWNER_EXITED') {
      ok(isDeepStrictEqual(up.target, armed.target) && isDeepStrictEqual(armed.target, read('native-pid.json')), 'terminal native identity changed');
      ok(isDeepStrictEqual(up.nativeWait, exitedOwner(armed.target)), 'actual normal native wait/EOF required');
      ok(up.at < deadline && receipts.every(r => up.at - r.consumedAt / 1000 <= 2.0), 'terminal evidence exceeded two-second bound');
      save('terminal-owner-exited.json', { name, owner, nonces, target: armed.target, nativeWait: up.nativeWait, physicalUpACK: false,
        nativeQuitClaim: false, noReplay: true, at: now() });
      save(name + '-final-choice.json', { nativeQuitClaim: false, ownerExited: true, physicalUpACK: false });
      return 'Native owner exited with actual wait and both EOFs; physical UP unacknowledged';
    }
    ok(up.state === 'ACK' && up.at < deadline, 'independent UP not acknowledged in window');
    if (strict) ok(up.at - deliveryAt <= 1.75, '1750ms independent physical UP exceeded');
    // Append-only link instead of overwriting old intent records.
    if (c.exists(P('last-intent.json'))) fs.unlinkSync(P('last-intent.json'));
    save('last-intent.json', { nonces });
    save(name + '-workflow.json', {captureAt:rr.at,captureCompletedAt:rr.completedAt,reviewedAt:reviewed.at,dispatchCompletedAt:returnedAt,releasedAt:up.at,captureToDispatchSeconds:returnedAt-rr.at,captureToUPSeconds:up.at-rr.at});
    if (final) {
      save(name + '-final-choice.json', { nativeQuitClaim: false, awaitActualNativeWait: true });
      return 'Final reviewed choice submitted; await actual native wait';
    }
    const observationAt = mono();
    const end = strict ? startedMono + window : observationAt + 10;
    const observe = async () => {
      const remaining = end - mono();
      ok(remaining > 0, '3000ms operation completion exceeded');
      const value = await call({ action: 'snapshot' }, remaining);
      ok(mono() < end, '3000ms operation completion exceeded');
      return value;
    };
    const b = await observe(); let a, progressed = false;
    while (mono() < end) {
      a = await observe();
      if (a.batch > b.batch) { progressed = true; break; }
      await c.sleep(20);
    }
    if (!progressed) throw Error('no postrelease progress');
    save(name + '-progress.json', { before, afterRelease: b, postProgress: a, at: now() });
    // UP has been acknowledged and a later native batch has completed.
    // The ordinary queued PNG action forces dirty presentation, composites,
    // encodes and writes before its HTTP completion. A fixed delay adds no
    // completion evidence; keep the original operation deadline for capture.
    if (strict) ok(mono() < end, '3000ms operation completion exceeded');
    const result = strict ? await capture(name, deadline) : await capture(name);
    if (strict) ok(mono() < end, '3000ms operation completion exceeded');
    return result;
  } catch (e) {
    if (e instanceof ReserveRejected) throw e;
    fail(e, name); throw e;
  }
}

// Record the caller's actual whole-frame review and one finite gesture in
// one invocation. This does not automate review or prove human turnaround.
async function submit(request) {
  ok(request && typeof request.observation === 'string' && request.observation.trim(), 'personal whole-frame observation required');
  ok(['game','menu'].includes(request.scene), 'explicit game/menu review required');
  const rr=read(request.review+'.json');
  save(request.review+'-review.json',{at:now(),pngSHA256:rr.pngSHA256,scene:request.scene,observation:request.observation,quitRoute:request.route||null,wholeFrame:true,targetHwnd:rr.snapshot.focus});
  if(request.bind) await bind(request.review);
  if(request.key!==undefined) return pulse(request.name,['keydown:'+request.key],request.ms,request.review,request.observation,!!request.final,request.route?'quit':'gameplay',request.route||null);
}
async function main(argv) {
  if (argv[0] === 'submit') return console.log(await submit(JSON.parse(fs.readFileSync(0,'utf8'))));
  if (argv[0] === 'review') {
    const rr = read(argv[1] + '.json');
    save(argv[1] + '-review.json', { at: now(), pngSHA256: rr.pngSHA256, observation: argv[2], quitRoute: argv.length > 3 ? argv[3] : null });
    console.log('personal review recorded');
  } else if (argv[0] === 'capture') console.log(await capture(argv[1]));
  else if (argv[0] === 'bind') await bind(argv.length > 1 ? argv[1] : null);
  else if (argv[0] === 'release') await release(argv[1], argv[2], Number(argv[3]), argv.length > 4 && argv[4] === 'final');
  else if (argv[0] === 'pulse' || argv[0] === 'quit-pulse') {
    const quitIntent = argv[0] === 'quit-pulse';
    console.log(await pulse(argv[1], [argv[2]], Number.parseInt(argv[3], 10), argv[4], argv[5], argv.length > 7 && argv[7] === 'final',
      quitIntent ? 'quit' : 'gameplay', quitIntent ? argv[6] : null));
  }
}
if (require.main === module) main(process.argv.slice(2)).catch(e => { console.error(e); process.exitCode = 1; });

module.exports = { save, read, call, reserve, capturePhase, freshness, bind, policy, endpointIdentity, opened, fail, lease, capture,
  exitedOwner, admissionAllowance, admissionFits, freshnessFits, release, pulse, submit, ReserveRejected, QUIT_ROUTES, main };
for (const k of ['R', 'URL']) Object.defineProperty(module.exports, k, { get: () => S[k], set: v => { S[k] = k === 'R' ? path.resolve(String(v)) : v; }, enumerable: true });
