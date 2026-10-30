'use strict';

// Explicitly constructed by an opt-in host. No timers, listeners or logging.
// Only the WAT return marker establishes guest completion; a fire() result
// establishes admission. Old wasm modules remain useful but incomplete.
function createCallbackLifecycleTrace({ capacity = 128 } = {}) {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 256) {
    throw new RangeError('callback lifecycle capacity must be 1..256');
  }
  const ring = new Array(capacity), owners = new Map(), registrations = new WeakMap();
  let sequence = 0, registrationId = 0, releaseId = 0;
  const record = event => { ring[sequence % capacity] = { sequence: ++sequence, ...event }; };
  const read = (e, name) => typeof e?.[name] === 'function' ? e[name]() >>> 0 : null;
  const context = e => ({ thread: read(e, 'get_current_thread_id'),
    eip: read(e, 'get_eip'), esp: read(e, 'get_esp'), yield: read(e, 'get_yield_reason'),
    wait: read(e, 'get_wait_handle'), timeout: read(e, 'get_wait_timeout'),
    stackBytes: read(e, 'get_wait_stack_bytes'), active: read(e, 'is_mm_timer_callback_active') });
  const owner = e => {
    if (!e || (typeof e !== 'object' && typeof e !== 'function')) return null;
    if (!owners.has(e)) {
      if (owners.size >= 32) return null; // bounded retained instances and pending identities
      const available = typeof e.set_audio_callback_trace === 'function' &&
        typeof e.get_audio_callback_trace === 'function';
      if (available) e.set_audio_callback_trace(1);
      owners.set(e, { id: owners.size + 1, available, pending: null });
    }
    return owners.get(e);
  };
  const marker = (e, n) => e.get_audio_callback_trace(n) >>> 0;
  const observe = e => {
    const o = owner(e), p = o?.pending;
    if (!p || !o.available) return;
    const returned = marker(e, 1);
    if (returned === p.token) {
      record({ event: 'returned', ...p, returned: {
        eip: marker(e, 2), esp: marker(e, 3), yield: marker(e, 4),
        wait: marker(e, 5), timeout: marker(e, 6), stackBytes: marker(e, 7) } });
      o.pending = null;
    } else if (!marker(e, 0)) {
      record({ event: 'incomplete-return', ...p, observedToken: returned,
        reason: 'missing-or-mismatched-WAT-return-token' });
      o.pending = null;
    }
  };
  return {
    before(e) { observe(e); return context(e); },
    observe,
    admission(e, item, result, queueBefore, queueAfter, saved) {
      const o = owner(e), r = item.registration;
      if (r && !registrations.has(r)) registrations.set(r, ++registrationId);
      const activeToken = o?.available ? marker(e, 0) : null;
      const token = result ? activeToken : null;
      const identity = { owner: o?.id ?? null, thread: read(e, 'get_current_thread_id'),
        registration: r ? registrations.get(r) : null, header: item.waveHdrGA >>> 0,
        handle: item.handle >>> 0, submission: item.submission ?? null, token };
      record({ event: result ? 'admitted' : 'busy', ...identity, result: result | 0,
        queueBefore, queueAfter, saved, current: context(e), activeToken,
        completion: token ? 'pending-WAT-return' : 'unavailable' });
      if (result && o) {
        if (o.pending) record({ event: 'incomplete-return', ...o.pending, reason: 'replaced-before-observation' });
        o.pending = token ? identity : null;
      }
    },
    nextRelease() { return ++releaseId; },
    semaphore(event, e) {
      const o = owner(e);
      record({ ...event, owner: o?.id ?? null, context: context(e),
        callbackToken: o?.available ? marker(e, 0) : null });
    },
    snapshot() {
      for (const e of owners.keys()) observe(e);
      const events = [];
      for (let n = Math.max(0, sequence - capacity); n < sequence; n++) events.push(ring[n % capacity]);
      return { capacity, total: sequence, overwritten: Math.max(0, sequence - capacity), events,
        pending: [...owners.values()].filter(o => o.pending).map(o => ({ ...o.pending })) };
    },
  };
}

module.exports = { createCallbackLifecycleTrace };
