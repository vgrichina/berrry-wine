'use strict';

// Install on the owning Worker's host imports BEFORE instantiation. Call start
// only after the caller verifies the live Worker/epoch/module and known prior
// API-log setting. This observes real dispatcher entry/exit, not a host queue
// consume or a DOM ACK. It never sends input or writes guest memory.
function attach(table, {getExports, memory, readCompletion, objectsBase, objectsSize,
    caller = 0x4f76c8, capacity = 2048} = {}) {
  if (![getExports, readCompletion].every(f => typeof f === 'function') ||
      !memory?.buffer || !Number.isInteger(objectsBase) || objectsBase < 0 ||
      !Number.isInteger(objectsSize) || objectsSize < 32 || objectsSize % 32 ||
      !Number.isInteger(capacity) || capacity < 1 || capacity > 8192)
    throw Error('bounded keyboard observer binding required');
  const names = ['log_i32', 'log', 'log_api_exit'];
  for (const name of names) if (typeof table[name] !== 'function') throw Error('missing ' + name);
  const originals = new Map(), wrappers = new Map();
  let active = false, used = false, ex, prior, expires, marker = -1;
  let frames = [], records = [], errors = [], drops = 0;
  const halt = error => {
    if (error && errors.length < 8) errors.push(String(error));
    if (active) { active = false; ex.set_api_log(prior); }
  };
  const u = address => {
    if (!Number.isInteger(address) || address <= 0 || address > 0xfffffffc)
      throw Error('invalid guest address');
    const wa = ex.guest_to_wasm(address) >>> 0;
    if (wa <= 0xf0 || wa + 4 > memory.buffer.byteLength) throw Error('unmapped guest read');
    return new DataView(memory.buffer).getUint32(wa, true);
  };
  for (const name of names) {
    const original = table[name]; originals.set(name, original);
    const wrapped = function(...args) {
      if (active && performance.now() >= expires) halt();
      if (active) try {
        if (getExports() !== ex) throw Error('exports replaced');
        if (name === 'log_i32' && (args[0] >>> 16) === 0xc0de) marker = args[0] & 65535;
        if (name === 'log') {
          if (frames.length >= 64) throw Error('dispatch depth bound');
          let target = marker === 1094;
          if (marker < 0 && args[1] === 31) target =
            String.fromCharCode(...new Uint8Array(memory.buffer, args[0], 31)) ===
            'IDirectInputDevice_GetDeviceData';
          marker = -1;
          let request = null;
          if (target) {
            const esp = ex.get_esp() >>> 0, thisPtr = u(esp + 4), slot = u(thisPtr + 4);
            if (slot >= objectsSize / 32) throw Error('device slot');
            const d = new DataView(memory.buffer), entry = objectsBase + slot * 32;
            if (entry + 32 > d.byteLength) throw Error('device table bounds');
            if (d.getUint32(entry + 8, true) === 1 && u(esp) === caller) {
              if (records.length === capacity) { drops++; throw Error('completion capacity'); }
              request = {api: 'IDirectInputDevice_GetDeviceData', requestAt: Date.now(),
                requestEsp: esp, returnAddress: u(esp), thisPtr, stride: u(esp + 8),
                buffer: u(esp + 12), countPtr: u(esp + 16), flags: u(esp + 20),
                requested: u(u(esp + 16)), objectsBase, objectsSize};
            }
          }
          frames.push(request);
        }
      } catch (error) { halt(error); }
      let value;
      try { value = original.apply(this, args); }
      catch (error) { halt('original import threw: ' + name); throw error; }
      if (active && name === 'log_api_exit') try {
        if (!frames.length) throw Error('exit without request');
        const request = frames.pop();
        if (request) {
          // Keep the first unsuccessful/invalid return as raw evidence too.
          const raw = {...request, at: Date.now(), eax: ex.get_eax() >>> 0,
            completionEsp: ex.get_esp() >>> 0, count: u(request.countPtr)};
          records.push(raw);
          raw.decoded = readCompletion(ex, memory, request);
        }
      } catch (error) { halt(error); }
      return value;
    };
    table[name] = wrapped; wrappers.set(name, wrapped);
  }
  return {
    start({durationMs = 10000, apiLogBefore} = {}) {
      if (used || ![0, 1].includes(apiLogBefore) || !Number.isInteger(durationMs) ||
          durationMs < 1 || durationMs > 45000) throw Error('single bounded start required');
      ex = getExports();
      if (typeof ex?.set_api_log !== 'function') throw Error('API log export required');
      used = true; prior = apiLogBefore; expires = performance.now() + durationMs;
      ex.set_api_log(1); active = true;
    },
    snapshot() {
      if (active && performance.now() >= expires) halt();
      const conflicts = names.filter(name => table[name] !== wrappers.get(name));
      if (ex && getExports() !== ex) conflicts.push('exports');
      return {active, drops, errors: errors.slice(), pending: frames.length, conflicts,
        records: structuredClone(records),
        meaning: 'matched compiled keyboard returns; game action and chassis speed require separate observation'};
    },
    stop() { halt(); return this.snapshot(); },
    restore() {
      halt(); const conflicts = [];
      for (const name of names) {
        if (table[name] === wrappers.get(name)) table[name] = originals.get(name);
        else conflicts.push(name);
      }
      return {conflicts, capturedWrappersInert: true};
    },
  };
}

// Do not turn a consumed DOWN/UP pair into a claim of held game state. A short
// pulse can be drained in one poll after UP. Pair by exact device/buffer/caller
// and exact native sequences, and report its relation to the trusted edges.
// A poll may enter before DOWN and finish after it: consumption is established
// at completion, not request entry. Worker/epoch/module verification remains
// the caller's responsibility, as it is for attach/start.
function correlate(snapshot, {code, downAt, upAt, downSequence, upSequence} = {}) {
  const offset = {ArrowUp: 0xc8, Digit0: 0x0b}[code];
  if (offset === undefined || !Number.isFinite(downAt) || !Number.isFinite(upAt) || upAt <= downAt)
    throw Error('trusted throttle edge interval required');
  if (![downSequence, upSequence].every(n => Number.isInteger(n) && n >= 0 && n <= 0xffffffff) ||
      !((upSequence - downSequence) >>> 0) || ((upSequence - downSequence) >>> 0) >= 0x80000000)
    throw Error('exact native edge buffer sequences required');
  if (snapshot.drops || snapshot.errors.length || snapshot.pending || snapshot.conflicts.length)
    throw Error('incomplete keyboard observation');
  const presses = [], releases = [];
  for (const raw of snapshot.records) {
    const c = raw.decoded;
    if (!c || c.eax !== 0 || c.flags !== 0) continue;
    if (!Number.isFinite(raw.requestAt) || !Number.isFinite(raw.at) || raw.at < raw.requestAt)
      throw Error('invalid keyboard completion time');
    if (raw.at < downAt) continue;
    const owner = [c.thisPtr, c.buffer, c.countPtr, c.returnAddress].join(':');
    for (const r of c.records) {
      if (r.offset !== offset) continue;
      if ((r.data & 0x80) && r.sequence === downSequence)
        presses.push({record: r, at: raw.at, owner});
      else if (!(r.data & 0x80) && r.sequence === upSequence)
        releases.push({record: r, at: raw.at, owner, followsPress: presses.length === 1});
    }
  }
  // Inspect the whole trace before accepting: even a duplicate after a valid
  // pair is ambiguous. Peeks above never count as consumption.
  if (presses.length !== 1 || releases.length !== 1)
    throw Error('matching consumed press/release missing or duplicate');
  const press = presses[0], {followsPress, ...release} = releases[0];
  if (!followsPress || press.owner !== release.owner || release.at < upAt || release.at < press.at)
    throw Error('matching consumed press/release missing');
  return {
    code, offset, press, release,
    consumedDuringHold: press.at < upAt,
    meaning: 'buffered consumption only; released neutral is not proof of absent earlier press',
  };
}

module.exports = {attach, correlate};
