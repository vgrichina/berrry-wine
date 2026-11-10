'use strict';

// Decodes a standard relative DIMOUSESTATE only at a verified handler entry
// and completion. The caller owns module/body/location and Worker identity
// checks. No guest state or input is written by this decoder.
function request(ex, memory, layout) {
  const check = (ok, why) => { if (!ok) throw Error(why); };
  const d = new DataView(memory.buffer);
  const p = a => {
    check(Number.isInteger(a) && a > 0 && a <= 0xfffffffc, 'guest address');
    const w = ex.guest_to_wasm(a) >>> 0;
    check(w > 0xf0 && w + 4 <= d.byteLength, 'guest translation');
    return w;
  };
  const u = a => d.getUint32(p(a), true), esp = ex.get_esp() >>> 0;
  const r = {requestAt: Date.now(), esp, returnAddress: u(esp), thisPtr: u(esp + 4),
    size: u(esp + 8), buffer: u(esp + 12)};
  const slot = u(r.thisPtr + 4);
  check(Number.isInteger(layout.objectsBase) && Number.isInteger(layout.objectsSize) &&
    slot < layout.objectsSize / 32, 'device slot');
  check(Number.isInteger(layout.stateBase) && layout.stateBase >= 0 &&
    layout.stateBase + slot * 32 + 4 <= d.byteLength, 'device format state');
  const entry = layout.objectsBase + slot * 32;
  check(entry >= 0 && entry + 32 <= d.byteLength, 'device entry');
  Object.assign(r, {entry, type: d.getUint32(entry, true),
    deviceType: d.getUint32(entry + 8, true), formatState: layout.stateBase + slot * 32,
    formatMap: d.getUint32(layout.stateBase + slot * 32, true),
    formatSize: d.getUint32(entry + 20, true), deviceFlags: d.getUint32(entry + 28, true)});
  check(r.type === 7 && r.deviceType === 2, 'mouse device');
  check(r.size === 16 && r.formatSize === 16 && r.formatMap === 0, 'standard mouse format');
  check((r.deviceFlags & 0x400) !== 0 && (r.deviceFlags & 0x800) === 0, 'acquired relative mouse');
  check(r.buffer !== 0 && p(r.buffer) + 16 <= d.byteLength, 'mouse buffer');
  return r;
}

function completion(ex, memory, r) {
  const check = (ok, why) => { if (!ok) throw Error(why); };
  const d = new DataView(memory.buffer), esp = ex.get_esp() >>> 0;
  const u = a => {
    const w = ex.guest_to_wasm(a) >>> 0;
    check(w > 0xf0 && w + 4 <= d.byteLength, 'completion translation');
    return d.getUint32(w, true);
  };
  check(esp === r.esp + 16, 'completion stack');
  for (const [i, k] of ['returnAddress', 'thisPtr', 'size', 'buffer'].entries())
    check(u(r.esp + i * 4) === r[k], 'completion request ' + k);
  check(d.getUint32(r.entry, true) === r.type &&
    d.getUint32(r.entry + 8, true) === r.deviceType &&
    d.getUint32(r.formatState, true) === r.formatMap &&
    d.getUint32(r.entry + 20, true) === r.formatSize &&
    d.getUint32(r.entry + 28, true) === r.deviceFlags, 'completion device changed');
  const eax = ex.get_eax() >>> 0, at = Date.now();
  check(at >= r.requestAt, 'completion time');
  if (eax !== 0) return {...r, at, eax, completionEsp: esp, state: null};
  const w = ex.guest_to_wasm(r.buffer) >>> 0;
  check(w > 0xf0 && w + 16 <= d.byteLength, 'completion buffer');
  return {...r, at, eax, completionEsp: esp,
    state: Array.from(new Uint8Array(memory.buffer, w, 16)),
    dx: d.getInt32(w, true), dy: d.getInt32(w + 4, true)};
}

// Delivery and consumption remain separate. In particular, an ACK or a
// renderer coordinate change cannot stand in for a completed guest read.
function correlate({motion, events, records}) {
  const assert = require('node:assert/strict');
  assert(motion.steps.length > 0 && motion.steps.length <= 32, 'bounded motion');
  assert(motion.steps.every(s => Number.isFinite(s.attemptedAt) && Number.isFinite(s.ackAt)), 'known motion acknowledgements');
  const start = motion.steps[0].attemptedAt, end = motion.completedAt;
  const delivered = events.filter(e => e.type === 'mousemove' && e.at >= start && e.at <= end);
  assert(delivered.length && delivered.every(e => e.trusted === true &&
    Number.isInteger(e.movementX) && Number.isInteger(e.movementY)), 'trusted relative delivery');
  const sum = (xs, x, y) => xs.reduce((s, v) => [s[0] + v[x], s[1] + v[y]], [0, 0]);
  const attemptedDelta = sum(motion.steps, 'dx', 'dy');
  const deliveredDelta = sum(delivered, 'movementX', 'movementY');
  assert.deepEqual(deliveredDelta, attemptedDelta, 'trusted delta differs from command path');
  const reads = records.filter(r => r.requestAt >= start && r.eax === 0 &&
    r.state?.length === 16 && r.at >= r.requestAt);
  const devices = new Set(reads.map(r => [r.thisPtr, r.buffer, r.returnAddress, r.deviceFlags].join(':')));
  assert(devices.size <= 1, 'ambiguous consuming device');
  return {attemptedDelta, deliveredDelta, successfulReads: reads.length,
    consumedDelta: sum(reads, 'dx', 'dy'), reads,
    meaning: 'complete successful relative mouse reads; cursor/gameplay consequence requires a separate observation',
    ackIsNotConsumption: true};
}

module.exports = {request, completion, correlate};
