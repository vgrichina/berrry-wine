'use strict';

// Opt-in, bounded import entry/return observation. This is NOT a complete
// GetDeviceState witness: the caller must observe its guest/game consequence.
// No debugger, guest memory access, I/O, CDP or callback runs in the wrapper.
function attach(table, {capacity = 8192, durationMs = 5000} = {}) {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 16384 ||
      !Number.isInteger(durationMs) || durationMs < 1 || durationMs > 45000)
    throw Error('bounded observation required');
  const name = 'get_mouse_buttons_live', original = table[name];
  if (typeof original !== 'function') throw Error('live mouse import required');
  const data = new Float64Array(capacity * 4);
  const started = performance.now(), expires = started + durationMs;
  let count = 0, drops = 0, active = true, restoreConflict = false;
  function restore() {
    active = false;
    if (table[name] === wrapped) table[name] = original;
    else restoreConflict = true;
  }
  function wrapped(...args) {
    const begin = performance.now();
    if (!active || begin >= expires) {
      if (active) restore();
      return original.apply(this, args);
    }
    if (count === capacity) {
      drops++; restore();
      return original.apply(this, args);
    }
    const i = count++ * 4;
    data[i] = Date.now(); data[i + 1] = begin;
    try {
      const value = original.apply(this, args);
      data[i + 3] = value;
      return value;
    } catch (e) { data[i + 3] = NaN; throw e; }
    finally { data[i + 2] = performance.now(); }
  }
  table[name] = wrapped;
  return {
    stop() { if (active) restore(); return this.snapshot(); },
    snapshot() {
      return {started, expires, active, drops, restoreConflict,
        records: Array.from({length: count}, (_, i) => ({
          at: data[i * 4], begin: data[i * 4 + 1], end: data[i * 4 + 2],
          value: Number.isNaN(data[i * 4 + 3]) ? null : data[i * 4 + 3],
        })), meaning: 'live mouse import entry/return only; neither ACK nor complete guest read'};
    },
  };
}

if (typeof module !== 'undefined') module.exports = {attach};
