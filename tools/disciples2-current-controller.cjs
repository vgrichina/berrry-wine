'use strict';
// Manual Disciples II control, recovered from tested helper 54508b765ea1499c.
// Node port of the former disciples2-current-controller.py (same CLI, records, protocol).
//
// The fixed Quit reserve is enforced before arm and again before every edge.
// There is no gameplay delivery loop or automatic Quit sequence.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), crypto = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const c = require('./native-supervisor-common.cjs');
const SELF = __filename;

// Mutable like the Python module globals (tests assign m.R / m.URL).
const S = { R: path.resolve(process.env.DISCIPLES2_CONTROL_OUT || __dirname), URL: process.env.DISCIPLES2_CONTROL_URL || 'http://127.0.0.1:8444/ctl' };
const P = n => path.join(S.R, n);
const now = c.now;
const ok = (cond, message) => { if (!cond) throw Object.assign(Error(typeof message === 'string' ? message : JSON.stringify(message ?? 'assertion failed')), { name: 'AssertionError' }); };
const sha = file => c.sha256(fs.readFileSync(file));
const alnumName = name => /^[A-Za-z0-9]+$/.test(name.replaceAll('-', ''));

function save(n, v) { c.save(S.R, n, v); }
function read(n) { return c.readJSON(P(n)); }
async function call(command, timeout = 3) {
  const r = await c.postJSON(S.URL, command, timeout);
  if (!r.ok) throw Error(JSON.stringify(r));
  return r.value;
}
class ReserveRejected extends Error { constructor(m) { super(m); this.name = 'ReserveRejected'; } }
const CONTEXT_CONTRACT = 'native-reviewed-context-v1';
const contextContract = () => read('launch.json').bindingContract === CONTEXT_CONTRACT;
function reviewLimit(personal) {
  if (!contextContract()) return 30;
  const limit = { game: 5, menu: 30 }[personal.scope];
  if (limit === undefined) throw Error('KeyError: ' + JSON.stringify(personal.scope));
  return limit;
}
function nativeReview(rr, personal) {
  ok(personal.pngSHA256 === rr.pngSHA256);
  return { contract: CONTEXT_CONTRACT, captureId: rr.captureId, pngSHA256: rr.pngSHA256,
    reviewed: true, reviewedAt: personal.at * 1000, scope: personal.scope, targetHwnd: personal.targetHwnd };
}
function confirmReceipt(receipt, guard, reviewDeadline) {
  ok(receipt.state === 'CONSUMED' && receipt.consumed, receipt);
  ok(receipt.receiptBoundary === 'native-input-return' && receipt.nativeMessage, 'host admission is not native delivery');
  ok(['owner', 'epoch', 'nonce', 'deadline'].every(k => isDeepStrictEqual(receipt[k], guard[k])), 'input receipt identity changed');
  const consumed = receipt.consumedAt;
  ok(typeof consumed === 'number' && consumed > 0 && consumed < Math.min(guard.deadline, reviewDeadline * 1000), 'native consumption crossed immutable target freshness/deadline');
}
const QUIT_ROUTES = { options: 'keydown:27', 'leave-quest': null, 'confirm-leave': null, 'main-quit': null, 'confirm-quit': null };

function reserve() {
  const launch = read('launch.json');
  const seconds = launch.reserveSeconds ?? 180;
  ok([180, 300].includes(seconds) && launch.gameplayCutoff === launch.deadline - seconds, 'immutable Quit reserve missing');
  if (launch.completionSession) ok(seconds === 300, 'original requires 300-second Quit reserve');
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
async function bind(review = null) {
  try {
    opened(); reserve(); ok(!c.exists(P('bind-intent.json')), 'permanent binding attempt; no rebind');
    ok(!c.exists(P('input-owner.json')), 'permanent owner; no rebind');
    const command = { action: 'guarded-bind' };
    if (read('launch.json').nativeScene) {
      ok(review, 'original binding requires a personally reviewed complete scene');
      const rr = read(review + '.json'), personal = read(review + '-review.json');
      const limit = reviewLimit(personal);
      ok(now() - rr.at >= 0 && now() - rr.at < limit && now() - personal.at >= 0 && now() - personal.at < limit, 'binding review expired');
      ok(personal.pngSHA256 === rr.pngSHA256 && rr.pngSHA256 === sha(P(review + '.png')));
      command.reviewedScene = contextContract() ? nativeReview(rr, personal) : { route: 'native-scene-v1', snapshot: rr.snapshot, pngSHA256: rr.pngSHA256 };
    }
    save('bind-intent.json', { at: now(), permanent: true, review, contract: read('launch.json').bindingContract ?? 'native-scene-v1' });
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
    if (!(route in QUIT_ROUTES) || (QUIT_ROUTES[route] !== null && !isDeepStrictEqual(keys, [QUIT_ROUTES[route]])))
      throw new ReserveRejected('only personally reviewed ordinary native Quit-route intents');
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
async function capture(name) {
  try {
    ok(alnumName(name)); capturePhase(); opened();
    const p = P(name + '.png'); ok(!c.exists(p));
    const start = now(); let im, s;
    if (contextContract()) { im = await call({ action: 'native-reviewed-capture', path: p }, 3); s = im.snapshot; }
    else { s = await call({ action: 'snapshot' }, 3); capturePhase(); im = await call({ cmd: 'png:' + p }, Math.max(.01, 3 - (now() - start))); }
    const end = now();
    ok(end - start <= 3, '3000ms whole-scene observation exceeded');
    const record = { at: start, completedAt: end, snapshot: s, image: im, pngSHA256: sha(p) };
    if (contextContract()) Object.assign(record, { captureId: im.captureId, contract: im.contract, nativeStartedAt: im.startedAt, nativeCompletedAt: im.completedAt });
    save(name + '.json', record);
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

async function release(name, owner, deadline, final = false) {
  const target = read('native-pid.json');
  process.stdout.write(JSON.stringify({ armed: true, pid: process.pid, deadline, owner, target, at: now() }) + '\n');
  // Already armed at the immutable fallback. A consumed ACK can only shorten it.
  let due = deadline, source = 'fallback';
  while (now() < due) {
    if (c.exists(P(name + '-release-at.json'))) { due = Math.min(due, read(name + '-release-at.json').at); source = 'consumed-pulse'; }
    await c.sleep(Math.min(5, Math.max(0, (due - now()) * 1000)));
  }
  save(name + '-release-fired.json', { at: now(), due, source, fallback: deadline });
  try { save(name + '-up.json', { state: 'ACK', reply: await call({ action: 'guarded-release', owner }, .25), at: now() }); }
  catch (e) {
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

function firstLine(child, ms) {
  return new Promise((resolve, reject) => {
    let text = '';
    const timer = setTimeout(() => reject(Error('independent release child arm deadline')), ms);
    child.stdout.on('data', b => { text += b; const i = text.indexOf('\n'); if (i >= 0) { clearTimeout(timer); resolve(text.slice(0, i)); } });
  });
}

async function pulse(name, keys, ms, review, description, final = false, intent = 'gameplay', route = null) {
  ok(alnumName(name) && ms >= 40 && ms <= 1000);
  ok(keys.length === 1 && /^(?:keydown:(?:13|27|32|37|38|39|40|78|89)|(?:mousedown|mousemove):[0-9]{1,4}:[0-9]{1,4})$/.test(keys[0]));
  if (keys[0].startsWith('mousedown:') || keys[0].startsWith('mousemove:')) {
    const [, x, y] = keys[0].split(':'); ok(Number(x) >= 0 && Number(x) < 1024 && Number(y) >= 0 && Number(y) < 712);
  }
  ok(description.trim(), 'personal scene review required');
  policy(intent, keys, review, route);
  try {
    const [owner, before] = await lease(); const rr = read(review + '.json'), reviewed = read(review + '-review.json');
    const limit = reviewLimit(reviewed);
    const native = read('launch.json').nativeScene ?? false;
    if (native) {
      ok(before.physicalUp && before.capture === '0x0', 'native physical UP required before intention');
      ok(rr.snapshot.physicalUp && rr.snapshot.capture === '0x0', 'review must precede any held input');
    }
    ok(now() - reviewed.at >= 0 && now() - reviewed.at < limit, 'personal review age expired');
    ok(reviewed.pngSHA256 === rr.pngSHA256, 'review binding changed');
    ok(sha(P(review + '.png')) === rr.pngSHA256, 'review image changed');
    ok(!fs.readdirSync(S.R).some(f => f.startsWith(review + '-used-by-')), 'capture already reserved; fresh review required');
    const nonces = keys.map(() => crypto.randomUUID());
    const record = { name, keys, ms, review, reviewSHA256: rr.pngSHA256, description, nonces, createdAt: now(), intent, quitRoute: route,
      contract: read('launch.json').bindingContract ?? 'native-scene-v1' };
    save(name + '-intent.json', record); save(review + '-used-by-' + name, { intent: name });
    const age = now() - rr.at;
    if (!(age >= 0 && age < limit)) {
      save(name + '-rejection.json', { state: 'NOT_SENT', lease: 'VALID', reason: 'review expired before DOWN/arm', age, nonces, at: now() });
      return 'NOT_SENT: review expired; fresh capture + review + NEW intent required';
    }
    const deadline = Math.min(now() + 3.0, rr.at + limit);
    save(name + '-operation.json', { deadline, pulseMilliseconds: ms, operationWindowSeconds: 3.0, confirmMilliseconds: 500, physicalUpMilliseconds: 1750 });
    ok(deadline + 2 < read('launch.json').deadline, 'operation exceeds fixed runtime');
    policy(intent, keys, review, route, deadline);
    const releaseCap = now() + 1.5;
    save(name + '-release-cap.json', { at: releaseCap, beforeFirstDown: true });
    const child = cp.spawn(process.execPath, [SELF, 'release', name, owner.owner, String(releaseCap), ...(final ? ['final'] : [])],
      { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, DISCIPLES2_CONTROL_OUT: S.R, DISCIPLES2_CONTROL_URL: S.URL } });
    const childOut = [], childErr = [];
    child.stderr.on('data', b => childErr.push(b));
    const closed = new Promise(resolve => child.once('close', (code, signal) => resolve(c.returncode(code, signal))));
    let armed, sentAt, returnedAt; const receipts = [];
    let failure = null;
    try {
      const line = await firstLine(child, 1500);
      childOut.push(Buffer.from(line + '\n'));
      armed = JSON.parse(line); ok(armed.armed); save(name + '-armed.json', armed);
      child.stdout.on('data', b => childOut.push(b));
      ok(now() < deadline, 'operation deadline before DOWN');
      if (now() - rr.at >= limit || now() - reviewed.at >= limit) {
        save(name + '-rejection.json', { state: 'NOT_SENT', lease: 'VALID', reason: 'review expired after arm before DOWN', nonces, at: now() });
        return 'NOT_SENT: review expired after arm; fresh capture + NEW intent required';
      }
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i], nonce = nonces[i];
        ok(now() - rr.at < limit && now() - reviewed.at < limit, 'capture/review expired before edge');
        const cutoff = policy(intent, keys, review, route);
        const guard = { ...owner, nonce, reviewed: true, deadline: Math.trunc(Math.min(deadline, releaseCap, intent === 'gameplay' ? cutoff : deadline) * 1000) };
        if (native) guard.intent = contextContract() ? { review: nativeReview(rr, reviewed) } : rr.snapshot;
        sentAt = now();
        const receipt = await call({ action: 'guarded-input', cmd: key, guard }, .5);
        returnedAt = now();
        ok(returnedAt - sentAt <= .5, '500ms confirmation exceeded');
        receipts.push(receipt);
        if (receipt.consumedAt) save(name + '-release-at.json', { at: receipt.consumedAt / 1000 + ms / 1000, immutableOperationDeadline: deadline });
        save(name + '-receipt.json', receipt);
        confirmReceipt(receipt, guard, rr.at + limit);
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
      ok(up.at < deadline && receipts.every(r => up.at - r.consumedAt / 1000 <= 1.75), 'terminal evidence exceeded two-second bound');
      save('terminal-owner-exited.json', { name, owner, nonces, target: armed.target, nativeWait: up.nativeWait, physicalUpACK: false,
        nativeQuitClaim: false, noReplay: true, at: now() });
      save(name + '-final-choice.json', { nativeQuitClaim: false, ownerExited: true, physicalUpACK: false });
      return 'Native owner exited with actual wait and both EOFs; physical UP unacknowledged';
    }
    ok(up.state === 'ACK' && up.at < deadline, 'independent UP not acknowledged in window');
    ok(receipts.every(r => up.at - r.consumedAt / 1000 <= 1.75), '1750ms physical UP exceeded');
    // Append-only link instead of overwriting old intent records.
    if (c.exists(P('last-intent.json'))) fs.unlinkSync(P('last-intent.json'));
    save('last-intent.json', { nonces });
    if (final) {
      save(name + '-final-choice.json', { nativeQuitClaim: false, awaitActualNativeWait: true });
      return 'Final reviewed choice submitted; await actual native wait';
    }
    save(name + '-complete.json', { at: now(), confirmationMs: (returnedAt - sentAt) * 1000,
      physicalUpMs: Math.max(...receipts.map(r => up.at - r.consumedAt / 1000)) * 1000, observationBoundMs: 3000, contract: record.contract });
    return 'CONSUMED with independent physical UP; take a fresh complete capture for next intent';
  } catch (e) {
    if (e instanceof ReserveRejected) throw e;
    fail(e, name); throw e;
  }
}

async function main(argv) {
  if (argv[0] === 'review') {
    const rr = read(argv[1] + '.json');
    const personal = { at: now(), pngSHA256: rr.pngSHA256, observation: argv[2], quitRoute: argv.length > 3 ? argv[3] : null };
    if (contextContract()) {
      ok(argv.length > 5 && ['game', 'menu'].includes(argv[4]), 'explicit reviewed scope and native target required');
      Object.assign(personal, { scope: argv[4], targetHwnd: argv[5], contract: CONTEXT_CONTRACT });
    }
    save(argv[1] + '-review.json', personal); console.log('personal review recorded');
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

module.exports = { save, read, call, CONTEXT_CONTRACT, contextContract, reviewLimit, nativeReview, confirmReceipt, reserve, capturePhase, bind, policy,
  endpointIdentity, opened, fail, lease, capture, exitedOwner, release, pulse, ReserveRejected, QUIT_ROUTES, main };
for (const k of ['R', 'URL']) Object.defineProperty(module.exports, k, { get: () => S[k], set: v => { S[k] = k === 'R' ? path.resolve(String(v)) : v; }, enumerable: true });
