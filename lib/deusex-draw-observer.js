'use strict';

// Optional owning-Worker diagnostic. Never accepts register snapshots, module
// identities or checkpoint notifications from the message sender. run(1) is a
// complete basic-block quantum, including any pending decoded continuation.
// No instruction-dispatch changes, breakpoint takeover, guest writes or calls.
(() => {
const BASE = 0x10300000;
const PC = Object.freeze({ entry: 0x1038e9e0, lock: 0x1038ed6e,
  unlock: 0x1038ef7a, tail: 0x1038ef82, epilogue: 0x1038efc9,
  catchTyped: 0x1038efdc, catchAll: 0x1038eff0 });

class OwningDrawObserver {
  constructor(ex, options = {}) {
    this.ex = ex;
    this.thread = ex.get_current_thread_id() >>> 0;
    const bound = (value, fallback, max) => Number.isSafeInteger(value) && value > 0
      ? Math.min(value, max) : fallback;
    this.maxBlocks = this.left = bound(options.maxBlocks, 50000, 2000000);
    this.startedAt = performance.now();
    this.maxMs = bound(options.maxMs, 1000, 15000);
    this.deadline = this.startedAt + this.maxMs;
    this.runCalls = 0;
    this.blocks = 0;
    this.chargedBlocks = 0;
    this.boundaries = 0;
    this.recent = [];
    this.runMs = 0;
    this.events = [];
    this.frame = null;
    this.result = null;
    this.module = this.resolveModule();
    this.exeBase = ex.get_image_base() >>> 0;
    this.opportunity = { originalMainLoopSignature: false, loopCheck: 0, tickReturn: 0 };
    try {
      const pe = this.read(this.exeBase + 0x3c);
      this.opportunity.originalMainLoopSignature = this.read(this.exeBase + pe + 52) === 0x10900000 &&
        (this.read(this.exeBase + 0x14702) & 0xffff) === 0x158b &&
        this.read(this.exeBase + 0x14704) === this.exeBase + 0x57c04;
    } catch (_) { /* Draw-only fixtures need not contain MainLoop. */ }
  }

  read(address) {
    const e = this.ex, a = address >>> 0;
    if (!a || a > 0xfffffffc) throw Error('invalid guest dword');
    const x = e.guest_to_wasm(a) >>> 0, y = e.guest_to_wasm(a + 3) >>> 0;
    if (x === 0xf0 || y !== x + 3 || y >= e.memory.buffer.byteLength)
      throw Error('unmapped guest dword');
    return e.guest_read32(a) >>> 0;
  }

  resolveModule() {
    const e = this.ex, buffer = e.memory.buffer, v = new DataView(buffer);
    const atomic = (a) => Atomics.load(new Int32Array(buffer), a >>> 2) >>> 0;
    const count = e.get_dll_count() >>> 0, table = e.get_dll_table() >>> 0;
    const life = e.get_dll_lifecycle_table() >>> 0, stride = e.get_dll_lifecycle_stride() >>> 0;
    if (count > 256 || stride < 8) throw Error('invalid module table');
    let found = null;
    for (let i = 0; i < count; i++) {
      const row = table + i * 32, state = life + i * stride;
      if (atomic(state) !== 2) continue; // only a fully initialized mapping
      const generation = atomic(state + 4), loadAddr = atomic(row);
      const size = v.getUint32(row + 4, true), exportsRva = v.getUint32(row + 8, true);
      if (!loadAddr || !exportsRva || exportsRva + 40 > size) continue;
      const nameRva = this.read(loadAddr + exportsRva + 12);
      if (!nameRva || nameRva + 16 > size) continue;
      let name = '';
      for (let j = 0; j < 16; j++) {
        const byte = this.read(loadAddr + nameRva + j) & 255;
        if (!byte) break;
        name += String.fromCharCode(byte);
      }
      if (name.toLowerCase() !== 'engine.dll') continue;
      const pe = this.read(loadAddr + 0x3c);
      if (pe > 4096 || this.read(loadAddr + pe) !== 0x4550 ||
          this.read(loadAddr + pe + 52) !== BASE || size <= PC.catchAll - BASE + 16)
        throw Error('unsupported Engine image');
      // Signature of the original Draw prologue. This is a version guard,
      // not a claim that the whole loaded image has a verified file hash.
      if (this.read(loadAddr + PC.entry - BASE) !== 0x6aec8b55)
        throw Error('unsupported Draw prologue');
      if (atomic(state) !== 2 || atomic(state + 4) !== generation || atomic(row) !== loadAddr)
        throw Error('module changed during read');
      if (found) throw Error('ambiguous Engine mapping');
      found = { index: i, loadAddr, generation, size };
    }
    if (!found) throw Error('no live original Engine mapping');
    return found;
  }

  // Capture synchronously before the owning scheduler can run again. A timer
  // terminal is an event boundary, not the last guest execution boundary.
  finish(status, reason = status, boundary = this.inRun ? 'guest-run-boundary' : 'owning-command') {
    if (this.result) return this.result;
    const e = this.ex, now = performance.now();
    let currentModule = null, moduleError = null;
    try { currentModule = this.resolveModule(); } catch (error) { moduleError = String(error.message); }
    const eip = e.get_eip() >>> 0;
    let pcModule = null;
    try {
      const v = new DataView(e.memory.buffer), words = new Int32Array(e.memory.buffer);
      const table = e.get_dll_table() >>> 0, life = e.get_dll_lifecycle_table() >>> 0;
      const stride = e.get_dll_lifecycle_stride() >>> 0, count = e.get_dll_count() >>> 0;
      if (count > 256 || stride < 8) throw Error('invalid module table');
      for (let i = 0; i < count; i++) {
        const row = table + i * 32, state = life + i * stride;
        const generation = Atomics.load(words, (state + 4) >>> 2) >>> 0;
        const loadAddr = Atomics.load(words, row >>> 2) >>> 0;
        const size = v.getUint32(row + 4, true);
        if (Atomics.load(words, state >>> 2) !== 2 || eip < loadAddr || eip - loadAddr >= size) continue;
        if (Atomics.load(words, (state + 4) >>> 2) !== generation ||
            Atomics.load(words, row >>> 2) >>> 0 !== loadAddr) continue;
        const exportsRva = v.getUint32(row + 8, true);
        let name = null;
        if (exportsRva && exportsRva + 40 <= size) {
          const nameRva = this.read(loadAddr + exportsRva + 12);
          if (nameRva && nameRva + 64 <= size) {
            name = '';
            for (let j = 0; j < 64; j++) {
              const byte = this.read(loadAddr + nameRva + j) & 255;
              if (!byte) break;
              name += String.fromCharCode(byte);
            }
          }
        }
        if (Atomics.load(words, state >>> 2) !== 2 ||
            Atomics.load(words, (state + 4) >>> 2) >>> 0 !== generation ||
            Atomics.load(words, row >>> 2) >>> 0 !== loadAddr) continue;
        pcModule = { index: i, name, loadAddr, size, generation, rva: eip - loadAddr };
        break;
      }
      if (!pcModule) {
        const loadAddr = e.get_image_base() >>> 0, pe = this.read(loadAddr + 0x3c);
        const size = this.read(loadAddr + pe + 80);
        if (eip >= loadAddr && eip - loadAddr < size)
          pcModule = { kind: 'exe', loadAddr, size, rva: eip - loadAddr };
      }
    } catch (_) { /* unresolved PC identity is explicit, never guessed */ }
    this.result = { status, thread: this.thread,
      module: this.module, events: this.events.slice(),
      terminal: { reason, boundary, atMs: now, elapsedMs: now - this.startedAt,
        remainingMs: Math.max(0, this.deadline - now), maxMs: this.maxMs,
        maxBlocks: this.maxBlocks, blocks: this.blocks, chargedBlocks: this.chargedBlocks,
        remainingBlocks: Math.max(0, this.left), runCalls: this.runCalls,
        boundaries: this.boundaries, runMs: this.runMs,
        trappingRunUncounted: !!this.trappingRun, diagnosticError: this.diagnosticError || null,
        eip, esp: e.get_esp() >>> 0, ebp: e.get_ebp() >>> 0,
        currentThread: e.get_current_thread_id() >>> 0,
        yieldReason: e.get_yield_reason() >>> 0, halt: e.get_last_run_halt() >>> 0,
        engineModule: currentModule, moduleError, pcModule, opportunity: { ...this.opportunity }, recent: this.recent.slice() },
      observedReturnPair: status === 'render-route-return-candidate-unverified-lifetime',
      engineRender: null, viewportPlayer: null,
      lifetime: 'unknown', viewportToHostSurface: 'unknown' };
    return this.result;
  }

  expire(boundary = 'before-run') {
    const time = performance.now() >= this.deadline, blocks = this.left <= 0;
    if (time || blocks) return this.finish('expired-incomplete',
      time && blocks ? 'block-budget-and-time-limit' : blocks ? 'block-budget' : 'time-limit', boundary);
  }

  checkOwner() {
    const m = this.resolveModule();
    if (m.index !== this.module.index || m.loadAddr !== this.module.loadAddr ||
        m.generation !== this.module.generation || m.size !== this.module.size) {
      this.finish('module-changed'); return null;
    }
    if (this.ex.get_current_thread_id() >>> 0 !== this.thread) {
      this.finish('thread-changed'); return null;
    }
    return m;
  }

  observe() {
    const e = this.ex, r = n => e['get_' + n]() >>> 0;
    const m = this.checkOwner();
    if (!m) return;
    const eip = r('eip'), esp = r('esp'), ebp = r('ebp');
    if (this.opportunity.originalMainLoopSignature) {
      if (eip === this.exeBase + 0x147b9) this.opportunity.loopCheck++;
      if (eip === this.exeBase + 0x1487a) this.opportunity.tickReturn++;
    }
    this.boundaries++;
    this.recent.push({ eip, blocks: this.blocks });
    if (this.recent.length > 16) this.recent.shift();
    const pc = (eip - m.loadAddr + BASE) >>> 0;
    if (pc === PC.catchTyped || pc === PC.catchAll) return this.finish('caught-unwind');
    if (pc === PC.entry) {
      if (this.frame) return this.finish('nested-draw-incomplete');
      this.frame = { engine: r('ecx'), viewport: this.read(esp + 4),
        esp, callerEbp: ebp, savedCaller: this.read(esp), next: 0 };
      if (!this.frame.engine || !this.frame.viewport || !this.frame.savedCaller)
        return this.finish('invalid-entry');
      this.events.push({ point: 'entry', eip, ecx: r('ecx'), esp, ebp,
        savedCaller: this.frame.savedCaller, viewport: this.frame.viewport });
      return;
    }
    const f = this.frame;
    if (!f) return;
    if (eip === f.savedCaller) {
      this.events.push({ point: 'savedCaller', eip, esp, ebp });
      return this.finish(f.next === 4 && esp === f.esp + 20 && ebp === f.callerEbp
        ? 'render-route-return-candidate-unverified-lifetime' : 'incomplete-return');
    }
    const points = ['lock', 'unlock', 'tail', 'epilogue'];
    // A landing alone is insufficient: observe the natural callee entry with
    // that return PC on its own stack, then its return to the Draw frame.
    // Calls end decoder blocks, so run(1) exposes this boundary even for a
    // one-block callee. No shadow stack/debug global needs enabling.
    if (f.next < 3 && !f.pendingCall && (pc < PC.entry || pc > PC.catchAll + 32) &&
        ebp === ((f.esp - 4) >>> 0) && this.read(esp) === m.loadAddr + PC[points[f.next]] - BASE) {
      f.pendingCall = { esp, target: eip };
      this.events.push({ point: points[f.next] + 'Call', eip, esp, ebp,
        savedCaller: this.read(esp) });
    }
    const index = points.findIndex(p => PC[p] === pc);
    if (index >= 0) {
      if (index !== f.next) return this.finish('bypass-or-missing-checkpoint');
      if (index < 3 && (!f.pendingCall || esp < f.pendingCall.esp + 4))
        return this.finish('missing-call-return-observation');
      if (ebp !== ((f.esp - 4) >>> 0) || this.read(ebp + 4) !== f.savedCaller ||
          (index < 3 && r('esi') !== f.viewport)) return this.finish('foreign-draw-frame');
      this.events.push({ point: points[index], eip, esp, ebp, esi: r('esi'), eax: r('eax') });
      if (index === 0 && !r('eax')) return this.finish('failed-lock');
      f.pendingCall = null;
      f.next++;
    } else if (esp >= f.esp + 20) return this.finish('unobserved-unwind-or-return');
  }

  // Called only instead of the owning slice's ordinary run. It does not clear
  // yields, restore registers or consume callback/loader continuations. A yield
  // returns to the normal Worker scheduler with its pending guest state intact.
  run(ex, steps) {
    if (ex !== this.ex) { this.finish('foreign-instance'); return 0; }
    if (ex.get_yield_reason()) return 0;
    this.inRun = true;
    let total = 0;
    for (let i = 0; i < Math.max(0, steps | 0) && !this.result; i++) {
      try {
        this.expire();
        if (!this.result) {
          if (!this.boundaryObserved) this.observe();
          else this.checkOwner();
        }
        if (this.result) break;
      } catch (error) {
        this.diagnosticError = String(error.message || error);
        this.finish('module-changed-or-unobservable'); break;
      }
      try {
        this.boundaryObserved = false;
        const t0 = performance.now();
        this.runCalls++;
        ex.run(1);
        this.runMs += performance.now() - t0;
        const ran = ex.get_last_run_blocks() >>> 0;
        total += ran;
        this.blocks += ran;
        this.chargedBlocks += Math.max(1, ran);
        this.left -= Math.max(1, ran);
      } catch (error) {
        this.trappingRun = true;
        this.diagnosticError = String(error.message || error);
        this.finish('trap-or-unobservable');
        throw error;
      }
      try {
        // Observe the resulting boundary even if the slice budget ends here.
        this.observe();
        this.boundaryObserved = true;
        if (!this.result) this.expire('after-run');
        const halt = ex.get_last_run_halt() >>> 0;
        if (ex.get_yield_reason() || !ex.get_eip() || halt !== 1) break;
      } catch (error) {
        this.diagnosticError = String(error.message || error);
        this.finish('module-changed-or-unobservable'); break;
      }
    }
    this.inRun = false;
    return total;
  }
}

const api = { OwningDrawObserver, PC, BASE };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else self.DeusExDrawObserver = api;
})();
