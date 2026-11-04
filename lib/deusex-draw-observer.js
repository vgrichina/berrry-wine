'use strict';

// Optional owning-Worker diagnostic. Never accepts register snapshots, module
// identities or checkpoint notifications from the message sender. run(1) is a
// complete basic-block quantum, including any pending decoded continuation.
// No instruction-dispatch changes, breakpoint takeover, guest writes or calls.
(() => {
const regions = typeof require !== 'undefined' ? require('./region-map.generated') : self.RegionMap;
const BASE = 0x10300000;
const PC = Object.freeze({ entry: 0x1038e9e0, lock: 0x1038ed6e,
  unlock: 0x1038ef7a, tail: 0x1038ef82, epilogue: 0x1038efc9,
  catchTyped: 0x1038efdc, catchAll: 0x1038eff0 });

// Original Render.dll SHA256 9f405de68112266bbd72cb4e37c39b3b9712052c49fcd2f7cd9f2654b443773b.
// Exact save/data-pointer/restore loop, through its post-restore conditional
// branch. Only the six PE HIGHLOW operands below change with relocation.
const ALIAS_BYTES = '8925088ab310892d004ab3108b55dc8b75188b7d1c8b5de48b65f433c98b2d409eb4108d34968d3c978d241433d24d8a140c74238d9b000000008b048e8b149303c233d2a980808080752f8a540c0189048f413bcd72e38b048e8b149303c2a980808080754489048feb5f8da424000000008da42400000000908bd081e2808080808beac1ea07257f7f7f7f2bea33d20bc58b2d409eb41089048f8a540c014d413bcd7295ebb08d49008bd081e2808080808beac1ea07257f7f7f7f2bea0bc589048f8da424000000008b2d004ab3108b25088ab3108b45088b55f88b7d188b751c8b48388b403003d1c1e0028955f88b551403f803f08b45f08b4a4040897d183bc189751c8945f00f8c78fdffff';
const ALIAS_EDGES = Object.freeze({
  0x3246: [0x327a, 0x329d], 0x327a: [0x3280, 0x3291, 0x32c0],
  0x3280: [0x3291, 0x32c0], 0x3291: [0x3280, 0x329d],
  0x329d: [0x32ac, 0x32f0], 0x32ac: [0x3310],
  0x32c0: [0x3280, 0x32eb], 0x32eb: [0x329d],
  0x32f0: [0x3310, 0x30cd, 0x3355], 0x3310: [0x30cd, 0x3355]
});

// The larger ceiling requires an explicit profile on the actual Worker start
// options. Omitted limits retain the same defaults in either profile. Validate
// before consulting guest state: malformed bounds must never become defaults.
const LIMITS = Object.freeze({
  standard: Object.freeze({ maxBlocks: 2000000, maxMs: 15000 }),
  extended: Object.freeze({ maxBlocks: 10000000, maxMs: 120000 })
});
function validateLimits(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options))
    throw new TypeError('Draw observer options must be an object');
  const has = key => Object.prototype.hasOwnProperty.call(options, key);
  const limitProfile = has('limitProfile') ? options.limitProfile : 'standard';
  if (limitProfile !== 'standard' && limitProfile !== 'extended')
    throw new RangeError('unsupported Draw observer limitProfile');
  const bounds = { limitProfile };
  for (const [key, fallback] of [['maxBlocks', 50000], ['maxMs', 1000]]) {
    const value = has(key) ? options[key] : fallback;
    if (!Number.isSafeInteger(value) || value <= 0 || value > LIMITS[limitProfile][key])
      throw new RangeError(`Draw observer ${key} must be a positive safe integer <= ${LIMITS[limitProfile][key]} (${limitProfile})`);
    bounds[key] = value;
  }
  return bounds;
}

class OwningDrawObserver {
  constructor(ex, options = {}) {
    const limits = validateLimits(options);
    this.ex = ex;
    this.thread = ex.get_current_thread_id() >>> 0;
    this.limitProfile = limits.limitProfile;
    this.maxBlocks = this.left = limits.maxBlocks;
    this.startedAt = performance.now();
    this.maxMs = limits.maxMs;
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

  // Versioned, read-only evidence at the already observed natural boundaries.
  // Failure here must not change execution or the Draw/ESP acceptance contract.
  signature(base, rva, hex) {
    const bytes = hex.match(/../g).map(x => parseInt(x, 16));
    for (let i = 0; i < bytes.length; i++)
      if ((this.read(base + rva + i) & 255) !== bytes[i]) throw Error('identity instruction mismatch');
  }

  identityModule(name, preferred) {
    const e = this.ex, v = new DataView(e.memory.buffer), w = new Int32Array(e.memory.buffer);
    const table = e.get_dll_table() >>> 0, life = e.get_dll_lifecycle_table() >>> 0;
    const stride = e.get_dll_lifecycle_stride() >>> 0, count = e.get_dll_count() >>> 0;
    if (count > 256 || stride < 8) throw Error('invalid identity module table');
    let found = null;
    for (let i = 0; i < count; i++) {
      const row = table + i * 32, state = life + i * stride;
      if (Atomics.load(w, state >>> 2) !== 2) continue;
      const generation = Atomics.load(w, (state + 4) >>> 2) >>> 0;
      const base = Atomics.load(w, row >>> 2) >>> 0, size = v.getUint32(row + 4, true);
      const er = v.getUint32(row + 8, true);
      if (!base || !er || er + 40 > size) continue;
      const nr = this.read(base + er + 12);
      if (!nr || nr + name.length + 1 > size) continue;
      let text = '';
      for (let j = 0; j <= name.length; j++) text += String.fromCharCode(this.read(base + nr + j) & 255);
      if (text.toLowerCase() !== name + '\0') continue;
      const pe = this.read(base + 0x3c);
      if (pe > 4096 || this.read(base + pe) !== 0x4550 || this.read(base + pe + 52) !== preferred)
        throw Error('unsupported identity module');
      if (Atomics.load(w, state >>> 2) !== 2 || Atomics.load(w, (state + 4) >>> 2) >>> 0 !== generation ||
          Atomics.load(w, row >>> 2) >>> 0 !== base) throw Error('identity module changed');
      if (found) throw Error('ambiguous identity module');
      found = { index: i, base, size, generation };
    }
    if (!found) throw Error('identity module absent: ' + name);
    return found;
  }

  captureIdentity(point) {
    const f = this.frame, s = { point, eip: this.ex.get_eip() >>> 0,
      lifetime: 'unknown', viewportToHostSurface: 'unknown', errors: [] };
    (this.identities ||= []).push(s);
    const attempt = (key, fn) => { try { s[key] = fn(); } catch (error) { s.errors.push(key + ': ' + error.message); } };
    if (point === 'lockCall' || point === 'unlockCall') attempt('callContext', () => ({
      thisPointer: this.ex.get_ecx() >>> 0,
      viewportThisMatches: (this.ex.get_ecx() >>> 0) === f.viewport,
      ...(point === 'unlockCall' ? { presentationArgument: this.read((this.ex.get_esp() >>> 0) + 4) } : {})
    }));
    attempt('fields', () => {
      // Original Engine Draw loads: mov edi,[esi+30]; mov ecx,[edi+48].
      this.signature(this.module.loadAddr, 0x8ea2e, '8b7e30');
      this.signature(this.module.loadAddr, 0x8ed86, '8b4f48');
      return { engine: f.engine, viewport: f.viewport, engineRender: this.read(f.engine + 0x48),
        viewportPlayer: this.read(f.viewport + 0x30) };
    });
    attempt('objects', () => {
      if (!s.fields) throw Error('unguarded fields');
      const core = this.identityModule('core.dll', 0x10100000), b = core.base;
      // Original exported GetIndex/GetFlags/GetClass jump targets. IsValid's
      // array load independently identifies the exported GObjObjects TArray.
      this.signature(b, 0xaca0, '8b4104c3');
      this.signature(b, 0xabd0, '8b411cc3');
      this.signature(b, 0xabb0, '8b4124c3');
      this.signature(b, 0x4fafb, '8b0d');
      if (this.read(b + 0x4fafd) !== b + 0x19e4f8) throw Error('object array instruction changed');
      const array = b + 0x19e4f8, data = this.read(array), count = this.read(array + 4), cap = this.read(array + 8);
      if (!data || count > 100000 || count > cap || cap > 200000) throw Error('object array bounds');
      const objects = {};
      for (const key of ['engine', 'viewport', 'engineRender', 'viewportPlayer']) {
        const address = s.fields[key];
        if (!address) { objects[key] = { address, membership: 'null' }; continue; }
        const index = this.read(address + 4), flags = this.read(address + 0x1c), cls = this.read(address + 0x24);
        const slotValue = index < count ? this.read(data + index * 4) : null;
        objects[key] = { address, index, flags, class: cls, vtable: this.read(address), slotValue,
          membership: slotValue === address ? 'reciprocal-at-boundary' : 'absent-or-reused' };
        const prior = this.identities[0]?.objects?.objects[key];
        objects[key].changedSinceEntry = prior ? ['address', 'index', 'flags', 'class', 'vtable', 'slotValue']
          .some(k => objects[key][k] !== prior[k]) : null;
      }
      return { core, array, data, count, cap, objects };
    });
    attempt('surface', () => {
      const win = this.identityModule('windrv.dll', 0x11100000), b = win.base;
      // Original UWindowsViewport Lock's ScreenPointer assignment and
      // Unlock's route test/SelectObject/BitBlt operand loads.
      this.signature(b, 0xcb60, '8b863001000085c08986b0000000');
      this.signature(b, 0xcd9b, '8b8680010000a808');
      this.signature(b, 0xceb0, '8b96f800000052');
      this.signature(b, 0xce6c, '8b8ef00000008b5104');
      this.signature(b, 0x1145, 'e966b80000');
      this.signature(b, 0x11ea, 'e931bb0000');
      const vp = f.viewport, vt = this.read(vp);
      const lock = this.read(vt + 0x60), unlock = this.read(vt + 0x68);
      if (![b + 0x1145, b + 0xc9b0].includes(lock) || ![b + 0x11ea, b + 0xcd20].includes(unlock))
        throw Error('viewport does not select original WinDrv Lock/Unlock');
      const flags = this.read(vp + 0x180), wrapper = this.read(vp + 0xf0);
      const pixels = this.read(vp + 0xb0), pixelsWa = pixels ? this.ex.guest_to_wasm(pixels) >>> 0 : null;
      const out = { win, vtable: vt, lock, unlock, flags, route: flags & 8 ? 'directdraw' : flags & 4 ? 'dib-bitblt' : 'other',
        pixels, pixelsWa, width: this.read(vp + 0x70), height: this.read(vp + 0x74),
        colorBytes: this.read(vp + 0x78), stridePixels: this.read(vp + 0xb4),
        hwnd: wrapper ? this.read(wrapper + 4) : null, bitmap: this.read(vp + 0xf8),
        primary: this.read(vp + 0x104), lockedSurface: this.read(vp + 0x108),
        presentHwnd: this.ex.get_dx_present_hwnd() >>> 0, candidates: [], windowSurfaces: [] };
      const v = new DataView(this.ex.memory.buffer), r = regions.REGIONS.GDI_OBJECT_TABLE;
      const windows = regions.REGIONS.GDI_WINDOW_SURFACE_TABLE;
      // Canonical destination descriptors, not the page's derived canvas map.
      for (let a = windows.base; out.hwnd && a + 32 <= windows.end; a += 32) {
        if (v.getUint32(a, true) !== out.hwnd) continue;
        out.windowSurfaces.push({ recordWa: a, id: v.getUint32(a + 4, true),
          width: v.getUint32(a + 8, true), height: v.getUint32(a + 12, true),
          bitsWa: v.getUint32(a + 16, true), stride: v.getUint32(a + 20, true),
          bpp: v.getUint32(a + 24, true) });
      }
      // Enumerate only the declared table. Exact handle AND pixel storage are
      // required; dimensions/blackness alone never select a binding.
      if (out.route === 'dib-bitblt') for (let a = r.base; a + 48 <= r.end; a += 48) {
        if (v.getUint32(a, true) !== out.bitmap || v.getUint32(a + 4, true) !== 3 || !out.bitmap) continue;
        const bitsWa = v.getUint32(a + 24, true);
        out.candidates.push({ recordWa: a, bitsWa, width: v.getUint32(a + 8, true),
          height: v.getUint32(a + 12, true), bpp: v.getUint32(a + 16, true),
          stride: v.getUint32(a + 28, true), pixelStorageMatches: !!pixels && pixelsWa !== 0xf0 && bitsWa === pixelsWa });
      }
      if (out.route === 'directdraw' && out.lockedSurface) {
        const wa = this.ex.guest_to_wasm(out.lockedSurface) >>> 0;
        const pools = [regions.REGIONS.COM_WRAPPERS, regions.REGIONS.COM_WRAPPERS_AUX];
        if (!pools.some(p => wa >= p.base && wa + 8 <= p.end && (wa - p.base) % 8 === 0))
          throw Error('surface wrapper outside declared pools');
        const slot = this.read(out.lockedSurface + 4), table = regions.REGIONS.DX_OBJECTS;
        if (slot >= table.size / 32) throw Error('surface slot out of bounds');
        const a = table.base + slot * 32, type = v.getUint32(a, true), bitsWa = v.getUint32(a + 20, true);
        out.candidates.push({ slot, type, bitsWa, width: v.getUint16(a + 12, true),
          height: v.getUint16(a + 14, true), bpp: v.getUint16(a + 16, true),
          stride: v.getUint16(a + 18, true), flags: v.getUint32(a + 28, true),
          pixelStorageMatches: type === 2 && !!pixels && pixelsWa !== 0xf0 && bitsWa === pixelsWa });
      }
      return out;
    });
    // Recheck module lifecycles after all reads. Membership is evidence only:
    // no allocation serial exists here; identical-address ABA remains unknown.
    attempt('modulesStable', () => {
      const engine = this.resolveModule();
      if (Object.keys(this.module).some(k => engine[k] !== this.module[k]))
        throw Error('Engine module changed during capture');
      for (const [name, preferred, before] of [['core.dll', 0x10100000, s.objects?.core],
        ['windrv.dll', 0x11100000, s.surface?.win]]) {
        if (before && JSON.stringify(this.identityModule(name, preferred)) !== JSON.stringify(before))
          throw Error('identity module changed during capture');
      }
      return true;
    });
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
        limitProfile: this.limitProfile,
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
      identityObservations: this.identities || [],
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
    if (this.alias) this.validateAlias();
    return m;
  }

  renderModule(eip) {
    const e = this.ex, v = new DataView(e.memory.buffer);
    const words = new Int32Array(e.memory.buffer), table = e.get_dll_table() >>> 0;
    const life = e.get_dll_lifecycle_table() >>> 0, stride = e.get_dll_lifecycle_stride() >>> 0;
    const count = e.get_dll_count() >>> 0;
    if (count > 256 || stride < 8) throw Error('invalid Render module table');
    for (let i = 0; i < count; i++) {
      const row = table + i * 32, state = life + i * stride;
      const generation = Atomics.load(words, (state + 4) >>> 2) >>> 0;
      const loadAddr = Atomics.load(words, row >>> 2) >>> 0;
      const size = v.getUint32(row + 4, true);
      if (Atomics.load(words, state >>> 2) !== 2 || eip < loadAddr || eip - loadAddr >= size) continue;
      const exportsRva = v.getUint32(row + 8, true);
      if (!exportsRva || exportsRva + 40 > size) return null;
      const name = this.read(loadAddr + exportsRva + 12);
      if (!name || name + 12 > size) return null;
      let text = '';
      for (let j = 0; j < 11; j++) text += String.fromCharCode(this.read(loadAddr + name + j) & 255);
      const pe = this.read(loadAddr + 0x3c);
      if (text.toLowerCase() !== 'render.dll\0' || pe > 4096 ||
          this.read(loadAddr + pe) !== 0x4550 || this.read(loadAddr + pe + 52) !== 0x10b00000 ||
          size < 0x49e44) return null;
      if (Atomics.load(words, state >>> 2) !== 2 ||
          Atomics.load(words, (state + 4) >>> 2) >>> 0 !== generation ||
          Atomics.load(words, row >>> 2) >>> 0 !== loadAddr) throw Error('Render module changed');
      return { index: i, loadAddr, size, generation };
    }
    return null;
  }

  validateAlias() {
    const a = this.alias, f = this.frame, m = this.renderModule(a.module.loadAddr + 0x3246);
    if (!m || Object.keys(m).some(k => m[k] !== a.module[k])) throw Error('Render alias module changed');
    // Recheck the entire executable sequence, including branch operands and
    // restore loads. An address alone never exempts an ESP observation.
    const bytes = ALIAS_BYTES.match(/../g).map(b => parseInt(b, 16));
    for (const rva of [0x3248, 0x324e, 0x3265, 0x32da, 0x3312, 0x3318]) {
      const i = rva - 0x3246;
      const value = ((bytes[i] | bytes[i+1] << 8 | bytes[i+2] << 16 | bytes[i+3] << 24) +
        m.loadAddr - 0x10b00000) >>> 0;
      for (let j = 0; j < 4; j++) bytes[i+j] = value >>> (j * 8) & 255;
    }
    for (let i = 0; i < bytes.length; i++)
      if ((this.read(m.loadAddr + 0x3246 + i) & 255) !== bytes[i]) throw Error('Render alias code changed');
    if (this.read(f.esp) !== f.savedCaller || this.read(f.esp - 4) !== f.callerEbp)
      throw Error('Render alias Draw frame changed');
    if (a.pc !== 0x3246 && (this.read(m.loadAddr + 0x38a08) !== a.esp ||
        this.read(m.loadAddr + 0x34a00) !== a.ebp)) throw Error('Render alias saved registers changed');
  }

  observeAlias(eip, esp, ebp) {
    const f = this.frame;
    if (!this.alias) {
      if (f.next !== 1 || f.pendingCall) return false;
      const m = this.renderModule(eip);
      if (!m || eip - m.loadAddr !== 0x3246) return false;
      if (!(esp <= ebp && ebp < f.esp - 4)) throw Error('invalid Render alias stack');
      this.alias = { module: m, esp, ebp, pc: 0x3246 };
      this.validateAlias();
      this.events.push({ point: 'renderEspSave', eip, esp, ebp, module: m });
      return true;
    }
    const a = this.alias, pc = eip - a.module.loadAddr;
    if (!ALIAS_EDGES[a.pc]?.includes(pc)) throw Error('unobserved Render alias edge');
    // At these two edges the exact checked block has executed both restores.
    if (pc === 0x30cd || pc === 0x3355) {
      if (esp !== a.esp || ebp !== a.ebp) throw Error('Render alias restoration mismatch');
      this.events.push({ point: 'renderEspRestored', eip, esp, ebp });
      this.alias = null;
      return false;
    }
    a.pc = pc;
    this.validateAlias();
    return true;
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
      this.captureIdentity('entry');
      return;
    }
    const f = this.frame;
    if (!f) return;
    // The exception is invocation-scoped and requires an observed save block,
    // exact live code/edges, unchanged saved slots and the original Draw pair.
    if (this.observeAlias(eip, esp, ebp)) return;
    if (eip === f.savedCaller) {
      this.events.push({ point: 'savedCaller', eip, esp, ebp });
      this.captureIdentity('savedCaller');
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
      this.captureIdentity(points[f.next] + 'Call');
    }
    const index = points.findIndex(p => PC[p] === pc);
    if (index >= 0) {
      if (index !== f.next) return this.finish('bypass-or-missing-checkpoint');
      if (index < 3 && (!f.pendingCall || esp < f.pendingCall.esp + 4))
        return this.finish('missing-call-return-observation');
      if (ebp !== ((f.esp - 4) >>> 0) || this.read(ebp + 4) !== f.savedCaller ||
          (index < 3 && r('esi') !== f.viewport)) return this.finish('foreign-draw-frame');
      this.events.push({ point: points[index], eip, esp, ebp, esi: r('esi'), eax: r('eax') });
      this.captureIdentity(points[index]);
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

const api = { OwningDrawObserver, validateLimits, LIMITS, PC, BASE };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else self.DeusExDrawObserver = api;
})();
