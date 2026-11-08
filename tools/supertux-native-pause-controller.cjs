'use strict';

const assert = require('node:assert/strict');
const MAX_AGE_MS = 12000;
const allowed = new Set(['ArrowRight', 'ArrowLeft', 'Space', 'Control']);

// Inject the retained, hash-checked native pulse/key and bound-input helpers.
// This composes their actual CDP transport; it never supplies a guest clock or
// claims a transport ACK observes Pause, grounding, input polls, or survival.
function create({chain, send, session, deadline, input, binding, identity,
  ackMs = 1200, save = () => {}}) {
  assert(chain && typeof chain.readLive === 'function');
  assert(input && typeof input.pulse === 'function' && typeof input.key === 'function');
  assert(binding && typeof binding.same === 'function');
  assert(session && Number.isFinite(deadline));
  assert(Number.isInteger(ackMs) && ackMs > 0 && ackMs <= 5000);
  const pins = structuredClone(identity);
  binding.same(pins, pins);
  let unknown = false, busy = false, nativePaused = 'UNKNOWN', grounded = 'UNKNOWN';
  let serial = 0;
  const commands = [], used = new Set(), pending = new Set();
  function stop() { unknown = true; nativePaused = grounded = 'UNKNOWN'; }
  function record(row) {
    // Persistence failures close admission but must never disarm an UP.
    try { save(structuredClone(row)); } catch { stop(); }
  }
  function open() {
    assert(!unknown && !chain.closed && Date.now() < deadline, 'UNKNOWN/closed/expired; no replay');
  }
  function fresh(at) {
    const age = Date.now() - Date.parse(at);
    assert(Number.isFinite(age) && age >= 0 && age <= MAX_AGE_MS, 'missing/stale observation');
  }
  // Keep the real promise even after the accepted pulse's bounded ACK expires.
  function dispatch(base, type, phase) {
    if (type === 'keyDown') open();
    const row = {number: ++serial, phase, type, code: base.code, commandAt: Date.now(), status: 'pending'};
    let actual;
    try { actual = Promise.resolve(send('Input.dispatchKeyEvent', {type, ...base}, session)); }
    catch (error) { actual = Promise.reject(error); }
    const entry = {row, promise: actual};
    commands.push(entry); pending.add(actual); record(row);
    actual.then(() => {
      row.completedAt = Date.now(); row.status = 'fulfilled'; pending.delete(actual); record(row);
    }, error => {
      row.completedAt = Date.now(); row.status = 'rejected'; row.error = String(error);
      pending.delete(actual); stop(); record(row);
    });
    return actual;
  }
  async function press(keys, holdMs, phase, capture) {
    open(); fresh(capture.at);
    const live = await chain.readLive();
    binding.same(pins, live.identity); open(); fresh(capture.at);
    assert(pending.size === 0, 'prior actual transport still pending');
    const bases = keys.map(input.key);
    const batch = async type => {
      const list = type === 'keyUp' ? [...bases].reverse() : bases;
      const outcomes = await Promise.allSettled(list.map(base => {
        if (type === 'keyDown') { open(); nativePaused = grounded = 'UNKNOWN'; }
        return dispatch(base, type, phase);
      }));
      const failed = outcomes.find(r => r.status === 'rejected');
      if (failed) throw failed.reason;
    };
    await input.pulse({deadline, holdMs, ackMs,
      down: () => batch('keyDown'), up: () => batch('keyUp'),
      save: receipt => record({phase, receipt})});
    open();
    assert(pending.size === 0, 'prior actual transport still pending');
  }
  return {
    cancel() { stop(); },
    get closed() { return unknown; },
    get state() { return {unknown, busy, nativePaused, grounded}; },
    // The promises are intentionally not replaced with timeout receipts.
    get commands() { return commands.map(e => ({...e.row, promise: e.promise})); },
    get pending() { return [...pending]; },
    async settle() { await Promise.allSettled([...pending]); },
    async run({id, review, observation, keys, holdMs, markDispatch = () => {}}) {
      try {
        open(); assert(!busy, 'concurrent controller');
        assert(typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id) && !used.has('id:' + id), 'replayed command');
        assert(Array.isArray(keys) && keys.length > 0 && keys.length <= 3 &&
          new Set(keys).size === keys.length && keys.every(k => allowed.has(k)), 'ordinary action keys');
        assert(!(keys.includes('ArrowLeft') && keys.includes('ArrowRight')), 'opposed directions');
        assert(Number.isInteger(holdMs) && holdMs >= 50 && holdMs <= 1000, 'bounded action');
        assert(Date.now() + holdMs + 200 + 6 * ackMs < deadline, 'insufficient immutable deadline');
        busy = true; used.add('id:' + id);
        return await chain.admit(review, async admission => {
          const capture = admission.capture;
          open(); fresh(capture.at); binding.same(pins, capture.identity);
          binding.same(pins, admission.live.identity);
          assert(observation?.nativePaused === true && observation.review?.trim(), 'actual reviewed paused observation required');
          assert(observation.label === capture.label && observation.sha256 === capture.sha256 &&
            observation.at === capture.at, 'observation must support this exact capture');
          binding.same(pins, observation.identity); fresh(observation.at);
          const token = capture.label + ':' + capture.sha256;
          assert(!used.has(token), 'reviewed capture already used; no replay'); used.add(token);
          nativePaused = true;
          grounded = typeof observation.grounded === 'boolean' ? observation.grounded : 'UNKNOWN';
          record({phase: 'admission', id, admission, observation}); open(); markDispatch();
          await press(['Escape'], 100, 'native-resume', capture);
          await press(keys, holdMs, 'action', capture);
          await press(['Escape'], 100, 'native-pause', capture);
          return {transportCompleted: true, nativePaused, grounded,
            requiresVisiblePauseAndTimerReview: true, preventsDeath: 'UNKNOWN'};
        });
      } catch (error) {
        stop(); record({phase: 'UNKNOWN', id, at: Date.now(), error: String(error), noReplay: true});
        throw error;
      } finally { busy = false; }
    }
  };
}

module.exports = {create, MAX_AGE_MS};
