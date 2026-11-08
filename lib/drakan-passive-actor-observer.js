'use strict';

// Offline-qualified adapter for the production-Wasm observer. The caller supplies
// existing identity/time samples; this adapter never polls clocks or input.
// Code pins must be derived from the installed PE/RFL, relocated to this owner.
const { createHash } = require('crypto');
const REQUIRED_PINS = Object.freeze({
  drain: [0x405770, 0x4059b0],
  frame: [0x407a95, 0x407abf],
  simulation: [0x40a090, 0x40a19a],
  event4: [0x4b320, 0x4b383],
  actor: [0x4c310, 0x4c510],
  state1: [0x4da10, 0x4e6f5],
});
const OWNER_KEYS = ['worker', 'process', 'endpoint', 'slot', 'epoch', 'moduleSha256'];
function sameOwner(a, b) {
  return a && b && OWNER_KEYS.every(k => a[k] !== undefined && a[k] === b[k]);
}

function createDrakanActorObserver({ exports: e, moduleBytes, expectedSha256, owner: suppliedOwner,
  readCode, sample, pins: suppliedPins, base, object, actor, timestamp, budget = 100000,
  maxAge = 1000, deadline, keyboardDevice }) {
  const owner = Object.freeze({ ...suppliedOwner });
  const pins = Object.fromEntries(Object.entries(suppliedPins || {}).map(([name, pin]) =>
    [name, { address: pin.address, bytes: Buffer.from(pin.bytes) }]));
  let unknown = null, armed = false, delivered = false;
  let consumed = null, bufferCalls = 0;
  const records = new Map();
  const sha = createHash('sha256').update(moduleBytes).digest('hex');
  function fail(reason) {
    if (!unknown) unknown = reason;
    if (armed) e.drakan_actor_observer_cancel();
    return false;
  }
  function valid() {
    if (unknown) return false;
    const s = sample(); // already collected owner/action sample, no new host polls
    if (!sameOwner(owner, s.owner)) return fail('owner');
    if (!Number.isFinite(s.now) || !Number.isFinite(s.observedAt) ||
        s.now < s.observedAt || s.now - s.observedAt > maxAge ||
        !Number.isFinite(deadline) || s.now >= deadline) return fail('freshness/deadline');
    if (s.unknown) return fail('upstream UNKNOWN');
    if (s.downActive !== true || s.timestamp !== timestamp) return fail('down inactive');
    return true;
  }
  if (!sameOwner(owner, owner) || typeof owner.worker !== 'string' || !owner.worker ||
      ![owner.process, owner.endpoint, owner.epoch].every(v => Number.isInteger(v) && v > 0) ||
      !Number.isInteger(owner.slot) || owner.slot < 0 || sha !== expectedSha256 ||
      owner.moduleSha256 !== sha || e.drakan_actor_observer_version?.() !== 1) fail('module/owner');
  if (!unknown && (!Number.isInteger(maxAge) || maxAge < 0 || maxAge > 1000 ||
      !Number.isInteger(timestamp) || timestamp <= 0 ||
      ![base, object, actor, keyboardDevice].every(v => Number.isInteger(v) && v > 0))) fail('configuration');
  function codeMatches() {
    try {
      for (const [name, [start, end]] of Object.entries(REQUIRED_PINS)) {
        const p = pins?.[name];
        // RFL entries in this table are RVAs, EXE entries are preferred VAs.
        const va = name === 'event4' || name === 'actor' || name === 'state1' ? base + start : start;
        if (!p || p.address !== va || p.bytes.length !== end - start ||
            !Buffer.from(readCode(va, end - start)).equals(Buffer.from(p.bytes))) return fail('code pin ' + name);
      }
    } catch (_) { return fail('code read'); }
    return true;
  }
  if (!unknown && valid() && codeMatches()) {
    armed = true;
    if (e.drakan_actor_observer_arm(base, object, actor, timestamp, budget) !== 1) fail('native arm');
  }
  function snapshot() {
    if (!valid() || !codeMatches()) return { status: 'UNKNOWN', reason: unknown };
    const stage = e.drakan_actor_observer_get(0), reason = e.drakan_actor_observer_get(1);
    if (stage < 0 || reason) {
      fail('native ' + reason);
      return { status: 'UNKNOWN', reason: unknown };
    }
    if (stage === 12 && (!consumed ||
        consumed.drainEsp !== e.drakan_actor_observer_get(3))) {
      fail('missing exact drain consume');
      return { status: 'UNKNOWN', reason: unknown };
    }
    return { status: stage === 12 ? 'COMPLETE' : 'PENDING', stage,
      transfers: e.drakan_actor_observer_get(2), timestamp,
      consume: consumed && { ...consumed },
      owner: { ...owner }, moduleSha256: sha };
  }
  return {
    snapshot,
    // Install on this instance's existing host import. The original is always
    // forwarded once, even after UNKNOWN. No GetDeviceData or host poll is added.
    wrapKeyboardBuffer(fn) {
      return function (...args) {
        let result;
        try { result = Reflect.apply(fn, this, args); }
        catch (error) { fail('buffer exception'); throw error; }
        try {
          if (unknown) return result;
          const [device, op, value] = args;
          if (device !== keyboardDevice) return result;
          if (++bufferCalls > 20000) { fail('buffer bound'); return result; }
          const stage = e.drakan_actor_observer_get(0);
          if (op === 3) {
            if (value < 0 || value >= 64) fail('record bound');
            else records.set(value, { event: result, stage, drainEsp: e.drakan_actor_observer_get(3) });
            if (result === 0x54 && consumed) fail('release before completion');
          }
          if ((op === 4 || op === 5) && records.has(value))
            records.get(value)[op === 4 ? 'timestamp' : 'sequence'] = result;
          if (op === 7 && result) fail('buffer overflow');
          if (op === 6 && value) {
            if (!Number.isInteger(value) || value < 0 || value > 64 || result !== 0)
              fail('consume result');
            for (const [index, row] of records) if (index < value) {
              if (row.event === 0x54) fail('same drain release');
              if (row.event === 0x154) {
                if (stage !== 2 || row.stage !== 2 ||
                    row.drainEsp !== e.drakan_actor_observer_get(3) ||
                    consumed || row.timestamp !== timestamp ||
                    !Number.isInteger(row.sequence) || row.sequence <= 0) fail('unbound consume');
                else consumed = { timestamp, sequence: row.sequence, device,
                  call: bufferCalls, count: value, drainEsp: e.drakan_actor_observer_get(3) };
              }
            }
            records.clear();
          }
        } catch (_) { fail('buffer observer exception'); }
        return result;
      };
    },
    // Observer failures cannot suppress, retry, or replace an ordinary call.
    // Snapshot errors become sticky UNKNOWN; the original exception is rethrown.
    wrap(fn, onComplete = () => {}) {
      return function (...args) {
        try { snapshot(); } catch (_) { fail('sample exception'); }
        let result;
        try { result = Reflect.apply(fn, this, args); }
        catch (error) { fail('execution exception'); throw error; }
        try {
          const s = snapshot();
          if (s.status === 'COMPLETE' && !delivered) {
            delivered = true;
            onComplete(s);
          }
        } catch (_) { fail('observer exception'); }
        return result;
      };
    },
  };
}
module.exports = { createDrakanActorObserver, REQUIRED_PINS };
