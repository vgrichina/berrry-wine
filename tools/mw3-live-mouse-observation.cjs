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
    capacity = 16384, readCapacity = 1024, depthCapacity = 64, importNames = null,
    decision = null, decisionCapacity = 64} = {}) {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 65536 ||
      !Number.isInteger(readCapacity) || readCapacity < 1 || readCapacity > 8192 ||
      !Number.isInteger(depthCapacity) || depthCapacity < 1 || depthCapacity > 256)
    throw Error('bounded dispatch observation required');
  if ((decision !== null && typeof decision !== 'function') ||
      !Number.isInteger(decisionCapacity) || decisionCapacity < 1 || decisionCapacity > 256)
    throw Error('bounded decision observation required');
  for (const name of ['log', 'log_i32', 'log_api_exit', 'get_mouse_buttons_live'])
    if (typeof table[name] !== 'function') throw Error('dispatch import required: ' + name);
  if (!memory?.buffer || ![getExports, request, completion].every(f => typeof f === 'function'))
    throw Error('dispatch decoder binding required');
  if (importNames !== null && (!Array.isArray(importNames) || !importNames.length ||
      importNames.length > 512 || new Set(importNames).size !== importNames.length ||
      importNames.some(name => typeof table[name] !== 'function')))
    throw Error('explicit existing import names required');
  const selectedImports = importNames === null ? null : new Set(importNames);
  const originals = new Map(), wrappers = new Map(), names = [];
  const data = new Float64Array(capacity * 6), frames = new Array(depthCapacity);
  // Aggregate only: storage is bounded by the installed import table and 32
  // dispatch categories, independent of the number of excluded hooks.
  const excludedCounts = [], apiCounts = new Map(), decisions = new Map();
  let diagnostic;
  let active = false, expires = 0, started = 0, count = 0, drops = 0,
    reads = [], errors = [], depth = 0, marker = -1, priorLog = 0, excludedImports = 0, ex;
  function halt(reason) {
    if (reason && errors.length < 8) errors.push(String(reason));
    if (active) { active = false; try { ex.set_api_log(priorLog); } catch (error) { if (errors.length < 8) errors.push(String(error)); } }
  }
  function enter(args) {
    diagnostic.entries++;
    let category = marker >= 0 ? 'com:' + marker : 'unclassified';
    if (marker < 0) {
      try {
        if (Number.isInteger(args[1]) && args[1] > 0 && args[1] <= 96)
          category = 'name:' + String.fromCharCode(...new Uint8Array(memory.buffer, args[0], args[1]));
      } catch (_) { diagnostic.categoryDecodeFailures++; }
    }
    if (apiCounts.has(category)) apiCounts.set(category, apiCounts.get(category) + 1);
    else if (apiCounts.size < 32) apiCounts.set(category, 1);
    else diagnostic.otherCategories++;
    // Optional read-only game gate decoder. Aggregate identical decisions so a
    // busy keyboard pump cannot bury the mouse gate in the category limit.
    // These are API-entry samples, never completion or input-admission proof.
    if (decision) {
      const sample = decision(category, ex, memory, layout);
      if (sample !== null) {
        const key = JSON.stringify(sample);
        if (typeof key !== 'string' || key.length > 2048) throw Error('decision sample size');
        const at = Date.now(), mono = performance.now();
        if (decisions.has(key)) {
          const row = decisions.get(key); row.count++; row.lastAt = at; row.lastMono = mono;
        } else {
          if (decisions.size === decisionCapacity) { drops++; halt('decision capacity'); return; }
          decisions.set(key, {sample: JSON.parse(key), count: 1, firstAt: at, lastAt: at,
            firstMono: mono, lastMono: mono});
        }
      }
    }
    if (depth === depthCapacity) { drops++; halt('dispatch depth capacity'); return; }
    let target = marker === 1093;
    if (marker < 0 && args[1] === 33) {
      const bytes = new Uint8Array(memory.buffer, args[0], 33);
      target = String.fromCharCode(...bytes) === 'IDirectInputDevice_GetDeviceState';
    }
    if (!target) diagnostic.otherApi++;
    marker = -1;
    let r = null;
    if (target) {
      const d = new DataView(memory.buffer), esp = ex.get_esp() >>> 0;
      const u = a => d.getUint32(ex.guest_to_wasm(a) >>> 0, true);
      const slot = u(u(esp + 4) + 4);
      if (slot >= layout.objectsSize / 32) throw Error('dispatch device slot');
      target = d.getUint32(layout.objectsBase + slot * 32 + 8, true) === 2;
      if (!target) diagnostic.nonMouseDevice++;
    }
    if (target) {
      if (reads.length === readCapacity) { drops++; halt('read capacity'); return; }
      r = request(ex, memory, layout);
      diagnostic.mouseRequests++;
      r.requestMono = performance.now();
    }
    frames[depth++] = r;
  }
  for (const name of Object.keys(table)) {
    const original = table[name];
    if (typeof original !== 'function') continue;
    const index = names.push(name) - 1;
    excludedCounts.push(0);
    originals.set(name, original);
    function wrapped(...args) {
      if (!active) return original.apply(this, args);
      const begin = performance.now();
      if (begin >= expires) { halt(); return original.apply(this, args); }
      // Filtering diagnostic rows must never filter the dispatch hooks below:
      // every entry/exit still participates in matching completed mouse reads.
      const record = selectedImports === null || selectedImports.has(name);
      if (record && count === capacity) { drops++; halt('import capacity'); return original.apply(this, args); }
      const i = record ? count++ * 6 : -1;
      if (record) { data[i] = index; data[i + 1] = Date.now(); data[i + 2] = begin; }
      else { excludedImports++; excludedCounts[index]++; }
      try {
        if (name === 'log_i32' && ((args[0] >>> 16) === 0xc0de)) marker = args[0] & 65535;
        if (name === 'log') enter(args);
      } catch (error) { diagnostic.entryFailures++; halt(error); }
      let value;
      try { value = original.apply(this, args); if (record) data[i + 4] = typeof value === 'number' ? value : 0; }
      catch (error) { if (record) data[i + 5] = 1; halt('original import threw: ' + name); throw error; }
      finally { if (record) data[i + 3] = performance.now(); }
      if (active && name === 'log_api_exit') {
        diagnostic.exits++;
        try {
          if (!depth) throw Error('dispatch exit without entry');
          const r = frames[--depth]; frames[depth] = null;
          if (r) { reads.push({...completion(ex, memory, r), completionMono: performance.now()}); diagnostic.mouseCompletions++; }
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
      priorLog = apiLogBefore; count = drops = depth = excludedImports = 0; reads = []; errors = []; marker = -1;
      excludedCounts.fill(0); apiCounts.clear(); decisions.clear();
      diagnostic = {entries: 0, exits: 0, otherApi: 0, nonMouseDevice: 0,
        mouseRequests: 0, mouseCompletions: 0, entryFailures: 0,
        categoryDecodeFailures: 0, otherCategories: 0};
      frames.fill(null); started = performance.now(); expires = started + durationMs;
      ex.set_api_log(1); active = true;
    },
    snapshot() {
      // Expiry is also checked on a passive snapshot when no imports run.
      if (active && performance.now() >= expires) halt();
      const bindingMismatchReasons = [];
      try { if (ex && getExports() !== ex) bindingMismatchReasons.push('exports object changed since start'); }
      catch (_) { bindingMismatchReasons.push('exports object unavailable'); }
      for (const [name, wrapped] of wrappers)
        if (table[name] !== wrapped) bindingMismatchReasons.push('import table wrapper replaced: ' + name);
      return {active, started, expires, drops, errors: errors.slice(), pending: depth,
        importNames: selectedImports === null ? null : [...selectedImports], excludedImports,
        decisions: Array.from(decisions.values(), row => ({...row, sample: {...row.sample}})),
        decisionEnabled: decision !== null,
        decisionMeaning: 'bounded API-entry gate samples only; caller must verify game image and Worker identity; not completed reads or admission',
        diagnostic: {...diagnostic,
          excludedByImport: names.flatMap((name, i) => excludedCounts[i] ? [{name, count: excludedCounts[i]}] : []),
          apiCategories: Array.from(apiCounts, ([category, count]) => ({category, count})),
          bindingMismatchReasons,
          bindingScope: 'local exports/table checks only; owning Worker, instance and module identity require caller verification'},
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
