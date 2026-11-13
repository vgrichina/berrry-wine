'use strict';

const { randomUUID } = require('crypto');
const { performance } = require('perf_hooks');

// Opt-in CLI protocol. References stay in this process; only opaque identity
// and receipts cross the wire. A receipt means handler consumption, not guest
// dispatch or a rendered frame. Nonce tombstones live until process exit.
function createGuardedInput({ snapshot, cleanup, now = Date.now, monotonic = () => performance.now() }) {
  const receipts = new Map();
  let binding = null, epoch = 0;
  const publicReceipt = t => ({ owner: t.owner, epoch: t.epoch, nonce: t.nonce,
    deadline: t.deadline, state: t.state, queued: t.state === 'QUEUED',
    consumed: t.consumed, consumedAt: t.consumedAt || null,
    reason: t.reason || null, noReplay: true });
  const same = b => {
    const s = snapshot();
    return s.healthy && Object.keys(b.refs).length === Object.keys(s.refs).length &&
      Object.keys(b.refs).every(k => Object.is(b.refs[k], s.refs[k]));
  };
  const purge = t => {
    // Remove only this intent's queued effects; independent UP is untagged.
    const q = t.binding.refs.queue;
    for (let i = q.length - 1; i >= 0; i--) if (t.events.has(q[i])) q.splice(i, 1);
    t.events.clear();
  };
  const cancel = (t, reason, unknown = false) => {
    clearTimeout(t.timer);
    purge(t);
    if (t.state !== 'UNKNOWN') t.state = unknown ? 'UNKNOWN' : 'CANCELLED';
    t.reason = reason;
    // Release is deliberately independent of freshness/owner/expiry. Use the
    // original bound renderer, not a replacement that failed the predicate.
    if (t.needsRelease) {
      t.needsRelease = false;
      try { cleanup(t.binding.refs, t.event); }
      catch (error) { t.state = 'UNKNOWN'; t.reason += '; cleanup: ' + error.message; }
    }
    if (t.resolve) { t.resolve(publicReceipt(t)); t.resolve = null; }
    return publicReceipt(t);
  };
  const valid = t => {
    if (t.state === 'UNKNOWN' || t.state === 'CANCELLED') return false;
    try {
      if (binding !== t.binding || !same(t.binding)) {
        cancel(t, 'owner/epoch/queue/device/window changed'); return false;
      }
    } catch (error) {
      cancel(t, 'owner inspection error: ' + error.message, true); return false;
    }
    if (now() >= t.deadline || monotonic() >= t.until) {
      cancel(t, 'immutable deadline expired'); return false;
    }
    return true;
  };
  function release(owner, reason = 'independent release') {
    let found = false;
    for (const t of receipts.values()) if (t.owner === owner) {
      found = true;
      if (t.state === 'QUEUED' || t.needsRelease || t.events.size) cancel(t, reason);
    }
    if (!found && binding?.owner !== owner) throw new Error('unknown guarded owner');
    return { released: true, owner, noReplay: true };
  }
  return {
    bind() {
      if (binding) release(binding.owner, 'owner epoch replaced');
      const s = snapshot();
      if (!s.healthy || !s.refs.queue) throw new Error('guarded input owner is unavailable');
      binding = { owner: randomUUID(), epoch: ++epoch, identity: randomUUID(), refs: Object.freeze({ ...s.refs }) };
      return { owner: binding.owner, epoch, identity: binding.identity, actor: 'CLI Node main thread' };
    },
    prepare(envelope, event) {
      const g = envelope || {};
      if (typeof g.nonce !== 'string' || !g.nonce || g.nonce.length > 256) throw new Error('guarded input requires nonce');
      if (receipts.has(g.nonce)) throw new Error('guarded nonce already used; inspect status, never replay');
      if (!binding || g.owner !== binding.owner || g.epoch !== binding.epoch || g.identity !== binding.identity)
        throw new Error('guarded owner/epoch/identity mismatch');
      if (g.reviewed !== true) throw new Error('guarded input requires reviewed intent');
      if (!Number.isSafeInteger(g.deadline) || g.deadline - now() > 2147483647)
        throw new Error('guarded input requires finite absolute deadline within timer range');
      const t = { owner: g.owner, epoch: g.epoch, nonce: g.nonce, deadline: g.deadline,
        until: monotonic() + Math.max(0, g.deadline - now()), binding,
        event: Object.freeze({ ...event }), state: 'QUEUED', consumed: false,
        events: new Set(), needsRelease: false };
      receipts.set(t.nonce, t);
      if (valid(t)) {
        t.timer = setTimeout(() => cancel(t, 'immutable deadline expired'), Math.max(0, t.deadline - now()));
        t.timer.unref();
      }
      return t;
    },
    receipt: publicReceipt,
    wait(t) {
      const p = new Promise(resolve => {
        if (t.state !== 'QUEUED') resolve(publicReceipt(t)); else t.resolve = resolve;
      });
      p.cancel = reason => cancel(t, reason || 'transport UNKNOWN', true);
      return p;
    },
    consume(t, effect) {
      if (t.state !== 'QUEUED' || !valid(t)) return publicReceipt(t);
      // Claim before invoking anything capable of a physical/native effect.
      t.state = 'CONSUMING';
      const q = t.binding.refs.queue, previous = new Set(q);
      t.needsRelease = /^(keydown|mousedown)$/.test(t.event.action);
      try {
        effect(t.event);
        t.consumed = true;
        t.consumedAt = now();
        t.state = 'CONSUMED';
      } catch (error) {
        // A throwing handler may already have effected input: UNKNOWN stays
        // terminal even if a later cleanup succeeds.
        for (const e of q) if (!previous.has(e) && ![0x101, 0x105, 0x202, 0x205, 0x208].includes(e.msg)) t.events.add(e);
        return cancel(t, 'effect error: ' + error.message, true);
      }
      for (const e of q) if (!previous.has(e) && ![0x101, 0x105, 0x202, 0x205, 0x208].includes(e.msg)) t.events.add(e);
      if (t.resolve) { t.resolve(publicReceipt(t)); t.resolve = null; }
      return publicReceipt(t);
    },
    sweep() {
      for (const t of receipts.values()) if (t.state === 'QUEUED' || t.needsRelease || t.events.size) valid(t);
    },
    status(nonce) {
      const t = receipts.get(nonce);
      if (!t) throw new Error('unknown guarded nonce');
      if (t.state === 'QUEUED' || t.needsRelease || t.events.size) valid(t);
      return publicReceipt(t);
    },
    release,
    abandon(reason) {
      // A retained native fault allows host teardown only, never renderer
      // callbacks. The fault latch clears physical/device maps separately.
      for (const t of receipts.values()) {
        t.needsRelease = false;
        if (t.state === 'QUEUED' || t.events.size) cancel(t, reason, true);
        clearTimeout(t.timer);
      }
    },
    close() { if (binding) release(binding.owner, 'CLI shutdown'); },
  };
}

module.exports = { createGuardedInput };
