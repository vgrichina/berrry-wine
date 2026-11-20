'use strict';

// This runs on the owning CPU Worker. The SAB is a diagnostic output, never an
// input queue or consumption receipt. Native records precede each import entry,
// so a broker blocked at the first UNKNOWN already has its history retained.
(function(root) {
  const WIDTH = 24, HEADER = 16, NATIVE_FIELDS = 17;
  const ABI = ['native_user_causal_abi', 'native_user_causal_arm',
    'native_user_causal_cancel', 'native_user_causal_status',
    'native_user_causal_get', 'native_user_causal_drain', 'native_user_clock_requested'];
  function configuration(capacity = 8192) {
    if (!Number.isInteger(capacity) || capacity < 8 || capacity > 65536) throw Error('causal capacity');
    return { abi: 1, capacity, buffer: new SharedArrayBuffer((HEADER + WIDTH * capacity) * 4) };
  }
  class Observer {
    constructor(config, getExports, publication, identity) {
      if (config?.abi !== 1 || !(config.buffer instanceof SharedArrayBuffer) ||
          !Number.isInteger(config.capacity) || config.capacity < 8 || config.capacity > 65536 ||
          config.buffer.byteLength !== (HEADER + WIDTH * config.capacity) * 4)
        throw Error('native causal configuration');
      this.view = new Int32Array(config.buffer); this.capacity = config.capacity;
      this.getExports = getExports; this.publication = publication;
      this.identity = identity; this.active = false; this.used = false;
      this.imports = []; this.scope = 0;
    }
    verify() {
      const ex = this.getExports();
      if (!ABI.every(n => typeof ex?.[n] === 'function') || ex.native_user_causal_abi() !== 1)
        throw Error('native USER causal ABI 1 required');
      return ex;
    }
    arm(nonce) {
      if (this.used) throw Error('causal scope is single use');
      if (typeof nonce !== 'string' || !/^[a-f0-9]{16}$/.test(nonce)) throw Error('exact 64-bit causal nonce required');
      const ex = this.verify(); this.used = true;
      this.nonce = nonce;
      this.view.fill(0);
      Atomics.store(this.view, 3, parseInt(nonce.slice(8), 16) | 0);
      Atomics.store(this.view, 4, parseInt(nonce.slice(0, 8), 16) | 0);
      Atomics.store(this.view, 5, this.identity | 0);
      ex.native_user_causal_arm(this.view[3], this.view[4]);
      this.active = true; this.deadline = performance.now() + 30000;
      new Float64Array(this.view.buffer, 32, 1)[0] = performance.timeOrigin + this.deadline;
      Atomics.store(this.view, 1, 1); this.event(100, 0);
    }
    append(kind, detail, native) {
      const v = this.view, count = Atomics.load(v, 0);
      if (count >= this.capacity) {
        Atomics.store(v, 2, 1); this.active = false;
        this.getExports()?.native_user_causal_cancel(); Atomics.store(v, 1, 3);
        return false;
      }
      const at = HEADER + count * WIDTH;
      v[at] = kind; v[at + 1] = (performance.timeOrigin + performance.now()) | 0;
      v[at + 2] = this.scope | 0; v[at + 3] = detail | 0;
      const published = this.publication();
      v[at + 4] = published.pending | 0; v[at + 5] = published.generation | 0;
      if (native) for (let i = 0; i < NATIVE_FIELDS; i++) v[at + 6 + i] = native[i];
      // Last field and header are release publications. A reader accepts only
      // complete records below the published count, even while the CPU blocks.
      Atomics.store(v, at + WIDTH - 1, count + 1);
      Atomics.store(v, 0, count + 1);
      return true;
    }
    drain() {
      if (!this.active) return;
      const ex = this.getExports(), count = ex.native_user_causal_status(3);
      for (let i = 0; i < count && this.active; i++) {
        const row = Array.from({length:NATIVE_FIELDS}, (_, f) => ex.native_user_causal_get(i, f));
        this.append(1, row[1], row);
      }
      if (ex.native_user_causal_status(5)) {
        Atomics.store(this.view, 2, 2); this.active = false;
        Atomics.store(this.view, 1, 3);
      }
      ex.native_user_causal_drain();
    }
    event(kind, detail = 0) {
      if (!this.active) return;
      this.drain(); if (!this.active) return;
      if (performance.now() >= this.deadline) { this.close(109); return; }
      this.append(kind, detail);
    }
    close(reason = 108) {
      if (!this.active) return;
      this.drain();
      if (this.active) this.append(reason, 0);
      this.getExports().native_user_causal_cancel(); this.active = false;
      Atomics.store(this.view, 1, Atomics.load(this.view, 2) ? 3 : 2);
    }
    wrap(host) {
      for (const [name, fn] of Object.entries(host)) {
        if (typeof fn !== 'function') continue;
        if (name === 'real_time_ms') {
          const observer = this;
          host[name] = function(...args) {
            if (observer.active && observer.getExports()?.native_user_clock_requested()) {
              if (performance.now() >= observer.deadline) observer.close(109);
              else observer.drain();
              return (performance.timeOrigin + performance.now()) | 0;
            }
            return fn.apply(this, args);
          };
          continue;
        }
        const id = this.imports.push(name), observer = this;
        host[name] = function(...args) {
          observer.event(103, id);
          try { const result = fn.apply(this, args); observer.event(104, id); return result; }
          catch (error) { observer.event(105, id); throw error; }
        };
      }
    }
  }
  function snapshot(config) {
    const v = new Int32Array(config.buffer), count = Atomics.load(v, 0);
    const records = [];
    for (let i = 0; i < count; i++) {
      const at = HEADER + i * WIDTH;
      if (Atomics.load(v, at + WIDTH - 1) !== i + 1) break;
      records.push(Array.from(v.subarray(at, at + WIDTH)));
    }
    const deadline = new Float64Array(v.buffer, 32, 1)[0];
    return { state: Atomics.load(v, 1), overflow: Atomics.load(v, 2),
      deadline, expired: deadline > 0 && performance.timeOrigin + performance.now() >= deadline,
      nonce: [v[4],v[3]].map(x=>(x>>>0).toString(16).padStart(8,'0')).join(''),
      identity: v[5], records };
  }
  const api = { Observer, configuration, snapshot, ABI, WIDTH, HEADER, NATIVE_FIELDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NativeUserCausalObserver = api;
})(typeof self !== 'undefined' ? self : globalThis);
