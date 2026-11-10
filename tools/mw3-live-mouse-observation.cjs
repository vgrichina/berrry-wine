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

// Install before WASM instantiation. Captured wrappers stay inert until start().
// Dispatch log hooks bracket the *handler*, not just the live button import.
// The caller supplies the already verified standard-mouse decoder and layout.
function attachDispatch(table, {getExports, memory, request, completion, layout,
    capacity = 16384, readCapacity = 1024, depthCapacity = 64} = {}) {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 65536 ||
      !Number.isInteger(readCapacity) || readCapacity < 1 || readCapacity > 8192 ||
      !Number.isInteger(depthCapacity) || depthCapacity < 1 || depthCapacity > 256)
    throw Error('bounded dispatch observation required');
  for (const name of ['log', 'log_i32', 'log_api_exit', 'get_mouse_buttons_live'])
    if (typeof table[name] !== 'function') throw Error('dispatch import required: ' + name);
  if (!memory?.buffer || ![getExports, request, completion].every(f => typeof f === 'function'))
    throw Error('dispatch decoder binding required');
  const originals = new Map(), wrappers = new Map(), names = [];
  const data = new Float64Array(capacity * 6), frames = new Array(depthCapacity);
  let active = false, expires = 0, started = 0, count = 0, drops = 0,
    reads = [], errors = [], depth = 0, marker = -1, priorLog = 0, ex;
  function halt(reason) {
    if (reason && errors.length < 8) errors.push(String(reason));
    if (active) { active = false; try { ex.set_api_log(priorLog); } catch (error) { if (errors.length < 8) errors.push(String(error)); } }
  }
  function enter(args) {
    if (depth === depthCapacity) { drops++; halt('dispatch depth capacity'); return; }
    let target = marker === 1093;
    if (marker < 0 && args[1] === 33) {
      const bytes = new Uint8Array(memory.buffer, args[0], 33);
      target = String.fromCharCode(...bytes) === 'IDirectInputDevice_GetDeviceState';
    }
    marker = -1;
    let r = null;
    if (target) {
      const d = new DataView(memory.buffer), esp = ex.get_esp() >>> 0;
      const u = a => d.getUint32(ex.guest_to_wasm(a) >>> 0, true);
      const slot = u(u(esp + 4) + 4);
      if (slot >= layout.objectsSize / 32) throw Error('dispatch device slot');
      target = d.getUint32(layout.objectsBase + slot * 32 + 8, true) === 2;
    }
    if (target) {
      if (reads.length === readCapacity) { drops++; halt('read capacity'); return; }
      r = request(ex, memory, layout);
      r.requestMono = performance.now();
    }
    frames[depth++] = r;
  }
  for (const name of Object.keys(table)) {
    const original = table[name];
    if (typeof original !== 'function') continue;
    const index = names.push(name) - 1;
    originals.set(name, original);
    function wrapped(...args) {
      if (!active) return original.apply(this, args);
      const begin = performance.now();
      if (begin >= expires) { halt(); return original.apply(this, args); }
      if (count === capacity) { drops++; halt('import capacity'); return original.apply(this, args); }
      const i = count++ * 6;
      data[i] = index; data[i + 1] = Date.now(); data[i + 2] = begin;
      try {
        if (name === 'log_i32' && ((args[0] >>> 16) === 0xc0de)) marker = args[0] & 65535;
        if (name === 'log') enter(args);
      } catch (error) { halt(error); }
      let value;
      try { value = original.apply(this, args); data[i + 4] = typeof value === 'number' ? value : 0; }
      catch (error) { data[i + 5] = 1; halt('original import threw: ' + name); throw error; }
      finally { data[i + 3] = performance.now(); }
      if (active && name === 'log_api_exit') {
        try {
          if (!depth) throw Error('dispatch exit without entry');
          const r = frames[--depth]; frames[depth] = null;
          if (r) reads.push({...completion(ex, memory, r), completionMono: performance.now()});
        } catch (error) { halt(error); }
      }
      return value;
    }
    wrappers.set(name, wrapped); table[name] = wrapped;
  }
  return {
    start({durationMs = 5000, apiLogBefore} = {}) {
      if (active || !Number.isInteger(durationMs) || durationMs < 1 || durationMs > 45000 ||
          ![0, 1].includes(apiLogBefore)) throw Error('bounded start with known prior API log setting required');
      ex = getExports(); if (typeof ex?.set_api_log !== 'function') throw Error('dispatch log export required');
      priorLog = apiLogBefore; count = drops = depth = 0; reads = []; errors = []; marker = -1;
      frames.fill(null); started = performance.now(); expires = started + durationMs;
      ex.set_api_log(1); active = true;
    },
    snapshot() {
      // Expiry is also checked on a passive snapshot when no imports run.
      if (active && performance.now() >= expires) halt();
      return {active, started, expires, drops, errors: errors.slice(), pending: depth,
        reads: reads.slice(), imports: Array.from({length: count}, (_, n) => {
          const i = n * 6; return {name: names[data[i]], at: data[i + 1], begin: data[i + 2],
            end: data[i + 3], value: data[i + 4], threw: !!data[i + 5]};
        }), meaning: 'imports are host intervals; reads are matched completed standard mouse handlers; unobserved gaps are not attributed; gameplay consequences require images'};
    },
    stop() { halt(); return this.snapshot(); },
    restore() {
      halt(); let conflicts = 0;
      for (const [name, original] of originals) {
        if (table[name] === wrappers.get(name)) table[name] = original; else conflicts++;
      }
      return {conflicts, capturedWrappersInert: true};
    },
  };
}
if (typeof module !== 'undefined') module.exports.attachDispatch = attachDispatch;

// Call at reviewed input admission, after arming one recorder. An empty
// startup sample says nothing about a menu that has not appeared yet. Await
// that same passive stream; never restart the recorder or issue guest input.
async function waitForReadStream({read, validate, deadline, wait,
    now = Date.now, maxWaitMs = 5000} = {}) {
  if (![read, validate, wait, now].every(f => typeof f === 'function') ||
      !Number.isInteger(maxWaitMs) || maxWaitMs < 1 || maxWaitMs > 5000 ||
      !Number.isFinite(deadline)) throw Error('bounded passive read admission required');
  const end = Math.min(deadline, now() + maxWaitMs);
  for (;;) {
    if (now() >= end) throw Error('matched mouse read stream deadline; no input');
    const snapshot = await read();
    if (snapshot.drops !== 0 || !Array.isArray(snapshot.errors) || snapshot.errors.length)
      throw Error('mouse read observation failed; no input');
    if (!Array.isArray(snapshot.reads)) throw Error('mouse read stream missing; no input');
    if (now() >= end) throw Error('matched mouse read stream deadline; no input');
    if (snapshot.reads.length) {
      await validate(snapshot);
      if (now() >= end) throw Error('matched mouse read stream deadline; no input');
      return snapshot;
    }
    if (!snapshot.active) throw Error('mouse read recorder inactive; no input');
    await wait(Math.min(100, end - now()));
  }
}
if (typeof module !== 'undefined') module.exports.waitForReadStream = waitForReadStream;
