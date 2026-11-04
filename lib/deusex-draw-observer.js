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
    this.left = bound(options.maxBlocks, 50000, 100000);
    this.deadline = performance.now() + bound(options.maxMs, 1000, 2000);
    this.events = [];
    this.frame = null;
    this.result = null;
    this.module = this.resolveModule();
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

  finish(status) {
    if (!this.result) this.result = { status, thread: this.thread,
      module: this.module, events: this.events.slice(),
      observedReturnPair: status === 'render-route-return-candidate-unverified-lifetime',
      engineRender: null, viewportPlayer: null,
      lifetime: 'unknown', viewportToHostSurface: 'unknown' };
    return this.result;
  }

  observe() {
    const e = this.ex, r = n => e['get_' + n]() >>> 0;
    if (performance.now() >= this.deadline || this.left <= 0) return this.finish('expired-incomplete');
    const m = this.resolveModule();
    if (m.index !== this.module.index || m.loadAddr !== this.module.loadAddr ||
        m.generation !== this.module.generation || m.size !== this.module.size)
      return this.finish('module-changed');
    if (r('current_thread_id') !== this.thread) return this.finish('thread-changed');
    const eip = r('eip'), esp = r('esp'), ebp = r('ebp');
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
    let total = 0;
    for (let i = 0; i < Math.max(0, steps | 0) && !this.result; i++) {
      try {
        if (performance.now() >= this.deadline || this.left <= 0) this.finish('expired-incomplete');
        if (!this.boundaryObserved && !this.result) this.observe();
        if (this.result) break;
      } catch (_) { this.finish('module-changed-or-unobservable'); break; }
      try {
        this.boundaryObserved = false;
        ex.run(1);
        const ran = ex.get_last_run_blocks() >>> 0;
        total += ran;
        this.left -= Math.max(1, ran);
      } catch (error) {
        this.finish('trap-or-unobservable');
        throw error;
      }
      try {
        // Observe the resulting boundary even if the slice budget ends here.
        this.observe();
        this.boundaryObserved = true;
        const halt = ex.get_last_run_halt() >>> 0;
        if (ex.get_yield_reason() || !ex.get_eip() || halt !== 1) break;
      } catch (_) { this.finish('module-changed-or-unobservable'); break; }
    }
    return total;
  }
}

const api = { OwningDrawObserver, PC, BASE };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else self.DeusExDrawObserver = api;
})();
