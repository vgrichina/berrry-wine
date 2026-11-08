'use strict';

// Optional observation transport. The controller owns time and input release;
// the guest Worker only observes its existing import and ordinary run calls.
(() => {
const node = typeof module !== 'undefined' && module.exports;
const adapter = node ? require('./drakan-passive-actor-observer') : self.DrakanActorObserver;
const regions = node ? require('./region-map.generated') : self.RegionMap;
const MODULE_SHA = '4b45bda53a90b665896cf3b85d9a157b7c3703563c88b6666e4ee2e4b346bcc3';
const MEDIA = Object.freeze({
  exe: '29ddccec4b073aaeeb998f0ce83d581ccf3e6a3e28791844f4434d661febecbe',
  rfl: 'b0ede61e43571f9ecead5e7637c585e1e3523ba70d7fd325ec39e99381807b1e',
});
const now = () => performance.timeOrigin + performance.now();

// Read installed PE bytes independently of guest memory, then apply only its
// HIGHLOW relocations. Never obtain expected code from the running instance.
async function installedPins(exe, rfl, base) {
  exe = new Uint8Array(exe); rfl = new Uint8Array(rfl);
  if (await adapter.sha256(exe) !== MEDIA.exe || await adapter.sha256(rfl) !== MEDIA.rfl)
    throw Error('installed media identity');
  function image(b) {
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength), pe = v.getUint32(60, true);
    if (v.getUint16(0, true) !== 0x5a4d || v.getUint32(pe, true) !== 0x4550) throw Error('PE');
    const preferred = v.getUint32(pe + 52, true), n = v.getUint16(pe + 6, true);
    const table = pe + 24 + v.getUint16(pe + 20, true);
    function offset(rva, count) {
      for (let i = 0; i < n; i++) {
        const s = table + i * 40, start = v.getUint32(s + 12, true), size = v.getUint32(s + 16, true);
        if (rva >= start && rva + count <= start + size) {
          const at = v.getUint32(s + 20, true) + rva - start;
          if (at + count <= b.length) return at;
        }
      }
      throw Error('unbacked installed pin');
    }
    return { b, v, pe, preferred, offset };
  }
  const images = { exe: image(exe), rfl: image(rfl) }, pins = {};
  if (images.exe.preferred !== 0x400000 || images.rfl.preferred !== 0x10000000) throw Error('preferred base');
  for (const [name, [start, end]] of Object.entries(adapter.REQUIRED_PINS)) {
    const dll = ['event4', 'actor', 'state1'].includes(name), p = dll ? images.rfl : images.exe;
    const rva = dll ? start : start - p.preferred, at = p.offset(rva, end - start);
    const bytes = p.b.slice(at, at + end - start), out = new DataView(bytes.buffer);
    if (dll) {
      const dir = p.pe + 24 + 96 + 40, size = p.v.getUint32(dir + 4, true);
      const begin = p.offset(p.v.getUint32(dir, true), size), limit = begin + size;
      for (let q = begin; q < limit;) {
        const page = p.v.getUint32(q, true), length = p.v.getUint32(q + 4, true);
        if (length < 8 || q + length > limit || length % 2) throw Error('relocation block');
        for (let i = q + 8; i < q + length; i += 2) {
          const entry = p.v.getUint16(i, true), site = page + (entry & 4095), type = entry >>> 12;
          if (site < rva + bytes.length && site + 4 > rva && type) {
            if (type !== 3 || site < rva || site + 4 > rva + bytes.length) throw Error('relocation pin overlap');
            out.setUint32(site - rva, (out.getUint32(site - rva, true) + base - p.preferred) >>> 0, true);
          }
        }
        q += length;
      }
    }
    pins[name] = { address: dll ? base + start : start, bytes };
  }
  return pins;
}

// Shared seqlock: fresh controller samples are never re-dated in the Worker.
function readControl(buffer, clock = now) {
  if (!(buffer instanceof SharedArrayBuffer) || buffer.byteLength !== 64) throw Error('controller shared sample');
  const w = new Int32Array(buffer), d = new Float64Array(buffer);
  for (let attempt = 0; attempt < 64; attempt++) {
    const first = Atomics.load(w, 0);
    if (first & 1) continue;
    const s = { observedAt: d[4], deadline: d[5], downActive: w[1] === 1,
      timestamp: w[2], unknown: w[3] !== 0, sequence: first };
    if (first === Atomics.load(w, 0)) return { ...s, now: clock() };
  }
  throw Error('controller sample in progress/changed');
}

class Controller {
  constructor({ owner, timestamp, releaseT, maxMs = 1900, clock = now, onStop = () => {}, worker, actionStartedAt }) {
    if (!Number.isInteger(maxMs) || maxMs < 1 || maxMs > 2000 || typeof releaseT !== 'function')
      throw Error('independent release configuration');
    this.owner = Object.freeze({ ...owner }); this.clock = clock; this.releaseT = releaseT; this.onStop = onStop;
    this.buffer = new SharedArrayBuffer(64); this.w = new Int32Array(this.buffer); this.d = new Float64Array(this.buffer);
    this.timestamp = timestamp; this.stopped = false; this.released = false; this.worker = worker;
    try {
      const current = clock();
      if (actionStartedAt === undefined) actionStartedAt = current;
      if (!Number.isFinite(actionStartedAt) || actionStartedAt > current || actionStartedAt + maxMs <= current)
        throw Error('action already expired/future');
      this.deadline = actionStartedAt + maxMs; this.publish(true, false);
    }
    catch (e) { this.stop('initial controller sample error'); throw e; }
    if (worker) {
      this.messageListener = m => this.accept(m.data || m);
      this.errorListener = () => this.stop('Worker error/exit');
      if (worker.on) {
        worker.on('message', this.messageListener); worker.on('error', this.errorListener); worker.on('exit', this.errorListener);
      } else {
        worker.addEventListener('message', this.messageListener); worker.addEventListener('error', this.errorListener);
      }
    }
    // Armed before the caller may dispatch any guest work. Runs outside the
    // guest Worker even when that Worker is blocked in WASM or a host import.
    this.timer = setTimeout(() => this.stop('controller deadline'), Math.max(0, this.deadline - clock()));
    this.heartbeat = setInterval(() => {
      try {
        if (this.stopped) return;
        if (clock() >= this.deadline) this.stop('controller deadline');
        else this.publish(true, false);
      } catch (error) { this.stop('controller sample error'); }
    }, 10);
  }
  publish(down, unknown) {
    Atomics.add(this.w, 0, 1);
    this.w[1] = down ? 1 : 0; this.w[2] = this.timestamp; this.w[3] = unknown ? 1 : 0;
    this.d[4] = this.clock(); this.d[5] = this.deadline;
    Atomics.add(this.w, 0, 1);
  }
  stop(reason = 'stopped') {
    if (this.stopped) return this.releasePromise;
    this.stopped = true; clearTimeout(this.timer); clearInterval(this.heartbeat);
    // Clear down before invoking external code, including a throwing release.
    try { this.publish(false, true); } catch (_) {
      // Even a broken host clock cannot leave the shared action marked down.
      Atomics.store(this.w, 1, 0); Atomics.store(this.w, 3, 1);
    } finally {
      if (!this.released) {
        this.released = true;
        try {
          this.releasePromise = Promise.resolve(this.releaseT()).catch(e => { this.releaseError = String(e); });
        } catch (e) { this.releaseError = String(e); }
      }
      if (this.worker) {
        try { this.worker.postMessage({ t: 'drakanObserver', action: 'stop' }); } catch (_) {}
        if (this.worker.off) {
          this.worker.off('message', this.messageListener); this.worker.off('error', this.errorListener); this.worker.off('exit', this.errorListener);
        } else {
          this.worker.removeEventListener('message', this.messageListener); this.worker.removeEventListener('error', this.errorListener);
        }
      }
      try { this.onStop({ reason, releaseError: this.releaseError || null }); } catch (_) {}
    }
    return this.releasePromise;
  }
  async observe(request, options) {
    try {
      if (options.exe || options.rfl) options = { ...options,
        pins: await installedPins(options.exe, options.rfl, options.base) };
      const { base, object, actor, keyboardDevice, pins } = options;
      const r = await request({ t: 'drakanObserver', action: 'start', base, object, actor, keyboardDevice, pins,
        owner: this.owner, control: this.buffer });
      if (r.result?.status === 'UNKNOWN') this.stop(r.result.reason);
      return r;
    } catch (e) { this.stop('controller command error'); throw e; }
  }
  accept(message) {
    if (message.t === 'error' || message.t === 'drakanObserverUnknown') this.stop('worker error');
    if (message.t !== 'drakanObserverComplete') return false;
    let s;
    try { s = readControl(this.buffer, this.clock); }
    catch (_) { this.stop('controller sample error'); return false; }
    if (this.stopped || s.now >= this.deadline || !s.downActive || s.unknown ||
        message.result?.status !== 'COMPLETE' || message.result?.stage !== 12 ||
        message.result?.timestamp !== this.timestamp || !message.result?.consume ||
        Object.keys(this.owner).some(k => message.result?.owner?.[k] !== this.owner[k])) {
      this.stop('late/wrong completion'); return false;
    }
    if (this.completed) return false;
    this.completed = message.result;
    return true;
  }
}

class WorkerBinding {
  constructor({ getExports, memory, endpoint, slot, moduleBytes, send }) {
    Object.assign(this, { getExports, memory, endpoint, slot, moduleBytes, send });
    this.used = false; this.observer = null;
  }
  read(address, count) {
    const image = this.getExports().get_image_base() >>> 0, at = address - image + regions.BASE.GUEST_BASE;
    if (!Number.isSafeInteger(address) || !Number.isSafeInteger(count) || count < 1 ||
        at < regions.BASE.GUEST_BASE || at + count > regions.BASE.VIRTUAL_BACKING_BASE) throw Error('direct window');
    return new Uint8Array(this.memory.buffer, at, count).slice();
  }
  async start(msg) {
    if (this.used) { this.cancel('rearm'); throw Error('observer already used'); }
    this.used = true;
    const e = this.getExports(), dv = new DataView(this.memory.buffer);
    const u = a => new DataView(this.read(a, 4).buffer).getUint32(0, true);
    const process = Atomics.load(new Int32Array(this.memory.buffer), regions.BASE.SHARED_PROCESS_ID >>> 2) >>> 0;
    const epoch = Number(Atomics.load(new BigUint64Array(this.memory.buffer), (regions.BASE.CALLBACK_OWNERSHIP + 8) >>> 3));
    const owner = { worker: String(this.endpoint), endpoint: this.endpoint, slot: this.slot,
      process, epoch, moduleSha256: MODULE_SHA };
    if (!msg.owner || Object.keys(owner).some(k => owner[k] !== msg.owner[k])) throw Error('actual Worker owner');
    const root = e.null_diag_root(), token = e.null_diag_token(), thread = e.get_current_thread_id();
    const object = u(0x47b700), actor = u(object + 0xa0), base = u(object + 0xa8) - 0x4b320;
    if (base !== msg.base || object !== msg.object || actor !== msg.actor || u(actor + 0x58) !== object ||
        u(actor) !== base + 0x150b20) throw Error('actual actor identity');
    const device = msg.keyboardDevice;
    if (!Number.isInteger(device) || device < regions.BASE.DX_OBJECTS ||
        device >= regions.REGIONS.DX_OBJECTS.end || (device - regions.BASE.DX_OBJECTS) % 32 ||
        dv.getUint32(device, true) !== 7 || dv.getUint32(device + 8, true) !== 1) throw Error('actual keyboard device');
    const control = readControl(msg.control);
    if (control.deadline - control.observedAt > 2000 || control.deadline <= control.now) throw Error('controller deadline');
    const sample = () => {
      const s = readControl(msg.control);
      s.owner = { ...owner, process: Atomics.load(new Int32Array(this.memory.buffer), regions.BASE.SHARED_PROCESS_ID >>> 2) >>> 0 };
      s.owner.epoch = Number(Atomics.load(new BigUint64Array(this.memory.buffer), (regions.BASE.CALLBACK_OWNERSHIP + 8) >>> 3));
      if (e.null_diag_root() !== root || e.null_diag_token() !== token || e.get_current_thread_id() !== thread ||
          s.deadline !== control.deadline) s.unknown = true;
      return s;
    };
    this.observer = await adapter.createVerifiedDrakanActorObserver({ exports: e, moduleBytes: this.moduleBytes,
      expectedSha256: MODULE_SHA, owner, sample, deadline: control.deadline, maxAge: 50,
      readCode: (a, n) => this.read(a, n), pins: msg.pins, base, object, actor,
      timestamp: control.timestamp, keyboardDevice: device });
    this.runObserved = this.observer.wrap(e.run, result => this.send({ t: 'drakanObserverComplete', result }));
    const expiry = () => {
      if (!this.observer) return;
      this.status();
      if (!this.terminal) this.expiry = setTimeout(expiry, 10);
    };
    this.expiry = setTimeout(expiry, 10);
    return this.status();
  }
  status() {
    let result;
    try { result = this.observer?.snapshot() || { status: 'UNKNOWN', reason: 'not armed' }; }
    catch (_) { this.observer?.cancel('controller sample error'); result = { status: 'UNKNOWN', reason: 'controller sample error' }; }
    if (result.status === 'UNKNOWN' && !this.terminal) {
      this.terminal = true; clearTimeout(this.expiry);
      this.send({ t: 'drakanObserverUnknown', result });
    }
    return result;
  }
  cancel(reason) { this.observer?.cancel(reason); this.status(); clearTimeout(this.expiry); }
  wrapKeyboardBuffer(original) {
    const binding = this;
    return function (...args) {
      // A single persistent wrapper retains records between import operations.
      if (binding.observer && !binding.keyboard) binding.keyboard = binding.observer.wrapKeyboardBuffer(original);
      try { return Reflect.apply(binding.keyboard || original, this, args); }
      catch (e) { binding.cancel('import exception'); throw e; }
    };
  }
  run(receiver, ...args) {
    try { return Reflect.apply(this.runObserved || this.getExports().run, receiver, args); }
    finally { if (this.observer) this.status(); }
  }
}
const api = { MODULE_SHA, MEDIA, installedPins, Controller, WorkerBinding, readControl };
if (node) module.exports = api; else self.DrakanObserverWorker = api;
})();
