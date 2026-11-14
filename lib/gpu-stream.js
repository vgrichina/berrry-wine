// GPU stream v2 consumer runtime (docs/gpu-stream-v2.md).
//
// Every executor (null, software, WebGL, later WebGPU) reads the WAT-written
// byte ring through this file: Ring wraps one GpsRing directory entry in wasm
// memory, drain() executes published records in seq order across one or more
// rings, and the dump writer/reader record and replay a stream offline.
// The wire format itself is generated from src/09a8gs-gpu-stream.wat into
// lib/gpu-stream.generated.js; nothing here restates an offset.
//
// Fail fast: an unknown op, a record whose size disagrees with its layout, an
// arena range that would cross the end, or an executor exception stores
// error_seq/error_code into the ring, stops, and throws. Nothing is skipped.
//
// Node: require('./gpu-stream'); browser/workers: globalThis.GpuStream (load
// gpu-stream.generated.js first).
(function (root, factory) {
  const gen = (typeof module !== 'undefined' && module.exports)
    ? require('./gpu-stream.generated') : root.GpuStreamGenerated;
  if (!gen) throw new Error('gpu-stream.js: load gpu-stream.generated.js first');
  const api = factory(gen);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GpuStream = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (G) {
  'use strict';

  const { CONST, OP, ERR, OP_NAMES, OP_LAYOUT, LAYOUTS, decode } = G;
  const REC = LAYOUTS.GpsRecord.size;
  const ALIGN = CONST.RECORD_ALIGN;
  const pad = (n, a) => (n + (a - 1)) & -a;

  function fieldOffset(layout, name) {
    const f = LAYOUTS[layout].fields.find((x) => x.name === name);
    if (!f) throw new Error(`gpu-stream: ${layout} has no field ${name}`);
    return f.offset;
  }
  // Header word indices (Int32Array units) of the GpsRing fields we touch.
  const H = {};
  for (const n of ['magic', 'ring_bytes', 'arena_bytes', 'write_pos', 'read_pos', 'submit_seq',
    'done_seq', 'arena_head', 'arena_tail', 'error_seq', 'error_code', 'ring_data', 'arena_data',
    'api', 'slots', 'last_present']) {
    const off = fieldOffset('GpsRing', n);
    if (off & 3) throw new Error(`gpu-stream: GpsRing.${n} is not word aligned`);
    H[n] = off >> 2;
  }
  const VERSION_OFF = fieldOffset('GpsRing', 'version');
  const SLOT_COUNT = LAYOUTS.GpsRing.fields.find((f) => f.name === 'slots').count;
  const LAYOUT_ELEM = LAYOUTS.GpsLayoutElem.size;
  const BIND_ENTRY = LAYOUTS.GpsBindEntry.size;
  const CONST_VEC = 16;

  class GpsError extends Error {
    constructor(message, code, seq) {
      super(message);
      this.name = 'GpsError';
      this.gpsCode = code;
      if (seq !== undefined) this.gpsSeq = seq;
    }
  }
  const malformed = (msg, seq) => new GpsError(msg, ERR.MALFORMED, seq);

  // Wrap-safe: true when seq a was issued before seq b.
  function seqBefore(a, b) { return ((a - b) | 0) < 0; }

  function isPow2(n) { return n > 0 && (n & (n - 1)) === 0; }

  // ── Ring ────────────────────────────────────────────────────────────────
  class Ring {
    constructor(getBuffer, headerAddr) {
      if (typeof getBuffer !== 'function') throw new TypeError('Ring(getBuffer, headerAddr): getBuffer must be a function');
      if ((headerAddr >>> 0) !== headerAddr || (headerAddr & 3)) throw new Error(`Ring: bad header address ${headerAddr}`);
      this.getBuffer = getBuffer;
      this.addr = headerAddr;
      this._buf = null;
      this._views();
      const len = this._buf.byteLength;
      if (headerAddr + LAYOUTS.GpsRing.size > len) throw new Error(`Ring: header 0x${headerAddr.toString(16)} outside memory`);
      const magic = Atomics.load(this.i32, this.w + H.magic) >>> 0;
      if (magic !== (CONST.MAGIC >>> 0))
        throw new Error(`Ring: bad magic 0x${magic.toString(16)} at 0x${headerAddr.toString(16)} (want 'GPS2')`);
      const version = this.dv.getUint16(headerAddr + VERSION_OFF, true);
      if (version !== CONST.VERSION) throw new Error(`Ring: version ${version}, this consumer speaks ${CONST.VERSION}`);
      this.ringBytes = this.word('ring_bytes');
      this.arenaBytes = this.word('arena_bytes');
      this.ringData = this.word('ring_data');
      this.arenaData = this.word('arena_data');
      this.api = this.word('api');
      if (!isPow2(this.ringBytes) || !isPow2(this.arenaBytes))
        throw new Error(`Ring: ring_bytes ${this.ringBytes} / arena_bytes ${this.arenaBytes} must be powers of two`);
      if (this.ringData & (ALIGN - 1)) throw new Error(`Ring: ring_data 0x${this.ringData.toString(16)} not ${ALIGN}-aligned`);
      if (this.ringData + this.ringBytes > len) throw new Error('Ring: ring_data range outside memory');
      if (this.arenaData + this.arenaBytes > len) throw new Error('Ring: arena_data range outside memory');
    }
    _views() {
      const b = this.getBuffer();
      if (!b) throw new Error('Ring: getBuffer() returned no buffer');
      if (b !== this._buf) {
        this._buf = b;
        this.i32 = new Int32Array(b);
        this.u8 = new Uint8Array(b);
        this.dv = new DataView(b);
        this.w = this.addr >> 2;
      }
      return b;
    }
    word(name) { return Atomics.load(this.i32, this.w + H[name]) >>> 0; }
    store(name, value) { Atomics.store(this.i32, this.w + H[name], value | 0); }
    notify(name) { return Atomics.notify(this.i32, this.w + H[name]); }
    get writePos() { return this.word('write_pos'); }
    get readPos() { return this.word('read_pos'); }
    get doneSeq() { return this.word('done_seq'); }
    get arenaTail() { return this.word('arena_tail'); }
    get errorSeq() { return this.word('error_seq'); }
    get errorCode() { return this.word('error_code'); }
    slot(i) {
      if (!(i >= 0 && i < SLOT_COUNT)) throw malformed(`slot ${i} out of range 0..${SLOT_COUNT - 1}`);
      return Atomics.load(this.i32, this.w + H.slots + i) >>> 0;
    }
    completeSlot(i, seq) {
      if (!(i >= 0 && i < SLOT_COUNT)) throw malformed(`slot ${i} out of range 0..${SLOT_COUNT - 1}`, seq);
      Atomics.store(this.i32, this.w + H.slots + i, seq | 0);
      Atomics.notify(this.i32, this.w + H.slots + i);
    }
    fail(seq, code) {
      this.store('error_seq', seq);
      this.store('error_code', code);
      this.notify('error_code');
      this.notify('done_seq');
    }
    ringAddr(pos) { return this.ringData + ((pos >>> 0) & (this.ringBytes - 1)); }
    // Uint8Array over arena bytes at position pos; never crosses the end.
    arena(pos, len, seq) {
      const phys = (pos >>> 0) & (this.arenaBytes - 1);
      if (!(len >= 0) || phys + len > this.arenaBytes)
        throw malformed(`arena range pos=${pos >>> 0} len=${len} crosses the end of a ${this.arenaBytes}-byte arena`, seq);
      this._views();
      return new Uint8Array(this._buf, this.arenaData + phys, len);
    }
  }

  // ── records ─────────────────────────────────────────────────────────────

  // Bytes a record needs after its fixed layout, from its decoded fields.
  function tailBytesNeeded(op, f) {
    switch (op) {
      case OP.SHADER: return f.ir_bytes;
      case OP.LAYOUT: return f.count * LAYOUT_ELEM;
      case OP.BIND: return f.count * BIND_ENTRY;
      case OP.CONSTS: return f.count * CONST_VEC;
      default: return 0;
    }
  }

  // Arena ranges a record reads (inputs) or writes (READBACK output).
  function arenaRefs(op, f) {
    switch (op) {
      case OP.UPLOAD: return f.bytes ? [{ pos: f.src, len: f.bytes, input: true }] : [];
      case OP.DRAW_UP: return f.count * f.stride ? [{ pos: f.voff, len: f.count * f.stride, input: true }] : [];
      case OP.READBACK: return f.pitch * f.h ? [{ pos: f.dst, len: f.pitch * f.h, input: false }] : [];
      default: return [];
    }
  }

  // Build the executor-facing record for the bytes at `off` in `buf`.
  // `arena(pos, len)` is supplied by the source (ring or dump).
  function buildRecord(buf, off, arenaFn, ring) {
    const dv = new DataView(buf, off, REC);
    const op = dv.getUint16(0, true);
    const flags = dv.getUint16(2, true);
    const size = dv.getUint32(4, true);
    const seq = dv.getUint32(8, true);
    const name = OP_NAMES[op];
    if (name === undefined || op === OP.WRAP) throw new GpsError(`unknown op ${op} (seq ${seq})`, ERR.UNKNOWN_OP, seq);
    const layoutName = OP_LAYOUT[name];
    if (!layoutName) throw new GpsError(`op ${name} has no payload layout`, ERR.UNKNOWN_OP, seq);
    const fixed = LAYOUTS[layoutName].size;
    if (size < REC + fixed) throw malformed(`${name} seq ${seq}: ${size} bytes < ${REC} + ${layoutName} ${fixed}`, seq);
    const payload = new DataView(buf, off + REC, size - REC);
    const fields = decode[layoutName](payload, 0);
    const tailLen = size - REC - fixed;
    const need = tailBytesNeeded(op, fields);
    if (need > tailLen) throw malformed(`${name} seq ${seq}: needs ${need} trailing bytes, record has ${tailLen}`, seq);
    const tail = new Uint8Array(buf, off + REC + fixed, tailLen);
    const raw = new Uint8Array(buf, off, size);
    const refs = arenaRefs(op, fields);
    return {
      op, name, flags, seq, size, payload, fields, tail, raw, ring: ring || null,
      refs,
      arena: (pos, len) => arenaFn(pos, len, seq, op),
    };
  }

  // ── drain ───────────────────────────────────────────────────────────────

  // Index of the candidate with the lowest seq (wrap-safe), or -1.
  function mergeBySeq(heads) {
    let best = -1;
    for (let i = 0; i < heads.length; i++) {
      const h = heads[i];
      if (!h) continue;
      if (best < 0 || seqBefore(h.seq, heads[best].seq)) best = i;
    }
    return best;
  }

  // Per-ring cursor: next unexecuted record up to the write_pos snapshot.
  class Cursor {
    constructor(ring) {
      this.ring = ring;
      if (ring.errorCode) throw new GpsError(`ring 0x${ring.addr.toString(16)} already failed (error ${ring.errorCode} at seq ${ring.errorSeq})`, ring.errorCode, ring.errorSeq);
      this.pos = ring.readPos;
      this.end = ring.writePos;
      if (((this.end - this.pos) >>> 0) > ring.ringBytes)
        throw malformed(`ring 0x${ring.addr.toString(16)}: write_pos ${this.end} is more than ring_bytes past read_pos ${this.pos}`);
      this.head = null;
    }
    // Header of the next record (skipping WRAPs), or null when caught up.
    peek() {
      if (this.head) return this.head;
      const r = this.ring;
      r._views();
      while (this.pos !== this.end) {
        const phys = this.pos & (r.ringBytes - 1);
        const left = r.ringBytes - phys;
        const avail = (this.end - this.pos) >>> 0;
        if (avail < 8) throw malformed(`ring: ${avail} published bytes is less than a record header`);
        const a = r.ringData + phys;
        const op = r.dv.getUint16(a, true);
        const bytes = r.dv.getUint32(a + 4, true);
        if (op === OP.WRAP) {
          // A WRAP may be as short as 8 bytes (its seq word would be past the
          // end), so only op and bytes are read.
          if (bytes !== left) throw malformed(`WRAP at phys ${phys} says ${bytes} bytes, ${left} remain to the end`);
          if (bytes > avail) throw malformed('WRAP extends past write_pos');
          this.pos = (this.pos + bytes) >>> 0;
          r.store('read_pos', this.pos);
          continue;
        }
        if (bytes < REC) throw malformed(`record at phys ${phys}: ${bytes} bytes < ${REC}-byte header`, r.dv.getUint32(a + 8, true));
        const padded = pad(bytes, ALIGN);
        const seq = r.dv.getUint32(a + 8, true);
        if (padded > left) throw malformed(`record seq ${seq} (${padded} bytes) crosses the end of the ring`, seq);
        if (padded > avail) throw malformed(`record seq ${seq} extends past write_pos`, seq);
        this.head = { op, seq, addr: a, padded };
        return this.head;
      }
      return null;
    }
  }

  function arenaUse(rec) {
    let end = null;
    for (const r of rec.refs) end = (r.pos + r.len) >>> 0;
    return end;
  }

  // Execute every record published when drain started, merging rings by seq.
  // options: { maxRecords } stops early. Returns { records }.
  function drain(rings, executor, options) {
    if (!Array.isArray(rings)) throw new TypeError('drain(rings, executor): rings must be an array of Ring');
    const max = options && options.maxRecords != null ? options.maxRecords : Infinity;
    const cursors = rings.map((r) => new Cursor(r));
    let executed = 0;
    const lastDone = new Map();
    let current = null;
    try {
      while (executed < max) {
        const heads = cursors.map((c) => { current = c; return c.peek(); });
        const i = mergeBySeq(heads);
        if (i < 0) break;
        const c = cursors[i];
        current = c;
        const h = heads[i];
        const r = c.ring;
        const rec = buildRecord(r._buf, h.addr, (pos, len, seq) => r.arena(pos, len, seq), r);
        if (rec.op === OP.FENCE || rec.op === OP.READBACK) {
          if (!(rec.fields.slot < SLOT_COUNT)) throw malformed(`${rec.name} seq ${rec.seq}: slot ${rec.fields.slot} out of range`, rec.seq);
        }
        for (const ref of rec.refs) rec.arena(ref.pos, ref.len); // range check before executing
        executor.execute(rec);
        if (rec.op === OP.FENCE || rec.op === OP.READBACK) r.completeSlot(rec.fields.slot, rec.seq);
        c.pos = (c.pos + h.padded) >>> 0;
        c.head = null;
        r.store('read_pos', c.pos);
        const end = arenaUse(rec);
        if (end !== null) r.store('arena_tail', end);
        r.store('done_seq', rec.seq);
        if (rec.flags & CONST.FLAG_WANT_DONE) r.notify('done_seq');
        lastDone.set(r, true);
        executed++;
      }
    } catch (err) {
      const code = err && err.gpsCode ? err.gpsCode : ERR.EXECUTOR;
      const seq = err && err.gpsSeq !== undefined ? err.gpsSeq
        : current && current.head ? current.head.seq : 0;
      if (err && typeof err === 'object' && err.gpsCode === undefined) { try { err.gpsCode = code; err.gpsSeq = seq; } catch (e) { /* frozen */ } }
      if (current) current.ring.fail(seq, code);
      throw err;
    }
    for (const r of lastDone.keys()) r.notify('done_seq');
    return { records: executed };
  }

  // ── payload helpers for executors ───────────────────────────────────────

  function decodeArray(rec, layoutName, count) {
    const size = LAYOUTS[layoutName].size;
    if (count * size > rec.tail.length) throw malformed(`${rec.name} seq ${rec.seq}: ${count} x ${layoutName} exceeds the record`, rec.seq);
    const dv = new DataView(rec.tail.buffer, rec.tail.byteOffset, count * size);
    const out = new Array(count);
    for (let i = 0; i < count; i++) out[i] = decode[layoutName](dv, i * size);
    return out;
  }
  function expectOp(rec, op, fn) {
    if (rec.op !== op) throw new Error(`${fn}: record is ${rec.name}, not ${OP_NAMES[op]}`);
  }
  function decodeLayoutElems(rec) {
    expectOp(rec, OP.LAYOUT, 'decodeLayoutElems');
    return decodeArray(rec, 'GpsLayoutElem', rec.fields.count);
  }
  function decodeBind(rec) {
    expectOp(rec, OP.BIND, 'decodeBind');
    return decodeArray(rec, 'GpsBindEntry', rec.fields.count);
  }
  // count x vec4 as a fresh Float32Array (little-endian decode).
  function decodeConsts(rec) {
    expectOp(rec, OP.CONSTS, 'decodeConsts');
    const n = rec.fields.count * 4;
    if (n * 4 > rec.tail.length) throw malformed(`CONSTS seq ${rec.seq}: ${rec.fields.count} vectors exceed the record`, rec.seq);
    const dv = new DataView(rec.tail.buffer, rec.tail.byteOffset, n * 4);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = dv.getFloat32(i * 4, true);
    return out;
  }
  function shaderIR(rec) {
    expectOp(rec, OP.SHADER, 'shaderIR');
    const n = rec.fields.ir_bytes;
    if (n > rec.tail.length) throw malformed(`SHADER seq ${rec.seq}: ir_bytes ${n} exceed the record`, rec.seq);
    return rec.tail.subarray(0, n);
  }

  // ── null executor ───────────────────────────────────────────────────────

  const FNV_OFFSET = 0x811c9dc5;
  function fnv1a(h, bytes) {
    for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i], 0x01000193);
    return h >>> 0;
  }

  // Validates resource lifetimes and counts records; READBACK writes zeros.
  class NullExecutor {
    constructor() {
      this.live = new Map(); // id -> kind
      this.filled = new Set(); // ids a SHADER/LAYOUT/SAMPLER record defined
      this.counts = {};
      this.records = 0;
      this.bytes = 0;
      this.hash = FNV_OFFSET;
      this.presents = 0;
      this.draws = 0;
      this.vertices = 0;
    }
    _fail(rec, msg) { throw new GpsError(`null executor: ${rec.name} seq ${rec.seq}: ${msg}`, ERR.EXECUTOR, rec.seq); }
    _need(rec, id, what, kinds) {
      if (id === 0) return;
      const kind = this.live.get(id);
      if (kind === undefined) this._fail(rec, `${what} ${id} was never created or was released`);
      if (kinds && !kinds.includes(kind)) this._fail(rec, `${what} ${id} is kind ${kind}, expected ${kinds.join('/')}`);
    }
    _define(rec, id, kind) {
      if (id === 0) this._fail(rec, 'id 0 is reserved for none');
      const prev = this.live.get(id);
      // SHADER/LAYOUT/SAMPLER may define an id outright or fill one CREATEd
      // with the same kind, once.
      const fills = rec.op !== OP.CREATE && prev === kind && !this.filled.has(id);
      if (prev !== undefined && !fills) this._fail(rec, `id ${id} is already live (kind ${prev})`);
      this.live.set(id, kind);
      if (rec.op !== OP.CREATE) this.filled.add(id);
    }
    execute(rec) {
      const f = rec.fields;
      const K = G.KIND;
      switch (rec.op) {
        case OP.CREATE: this._define(rec, f.id, f.kind); break;
        case OP.RELEASE:
          if (!this.live.has(f.id)) this._fail(rec, `release of id ${f.id} that is not live`);
          this.live.delete(f.id);
          this.filled.delete(f.id);
          break;
        case OP.UPLOAD: this._need(rec, f.id, 'upload target'); if (f.id === 0) this._fail(rec, 'upload to id 0'); break;
        case OP.SHADER: this._define(rec, f.id, K.SHADER); shaderIR(rec); break;
        case OP.LAYOUT: this._define(rec, f.id, K.LAYOUT); decodeLayoutElems(rec); break;
        case OP.SAMPLER: this._define(rec, f.id, K.SAMPLER); break;
        case OP.TARGETS: this._need(rec, f.color, 'color target'); this._need(rec, f.depth, 'depth target'); break;
        case OP.VIEWPORT: break;
        case OP.RASTER: this._need(rec, f.fog_table, 'fog table'); break;
        case OP.BIND:
          for (const e of decodeBind(rec)) {
            this._need(rec, e.texture, `slot ${e.slot} texture`);
            this._need(rec, e.sampler, `slot ${e.slot} sampler`, [K.SAMPLER]);
          }
          break;
        case OP.CONSTS: decodeConsts(rec); break;
        case OP.DRAW:
        case OP.DRAW_UP:
          this._need(rec, f.vs, 'vs', [K.SHADER]);
          this._need(rec, f.ps, 'ps', [K.SHADER]);
          this._need(rec, f.layout, 'layout', [K.LAYOUT]);
          if (rec.op === OP.DRAW) {
            if (f.vbuf === 0) this._fail(rec, 'DRAW without a vertex buffer');
            this._need(rec, f.vbuf, 'vbuf');
          } else if (f.vbuf !== 0) this._fail(rec, `DRAW_UP names vbuf ${f.vbuf} (must be 0)`);
          this._need(rec, f.ibuf, 'ibuf');
          this.draws++;
          this.vertices += f.count;
          break;
        case OP.CLEAR: break;
        case OP.COPY: this._need(rec, f.src, 'copy src'); this._need(rec, f.dst, 'copy dst'); break;
        case OP.FENCE: break;
        case OP.READBACK:
          this._need(rec, f.rt, 'readback rt');
          for (const r of rec.refs) rec.arena(r.pos, r.len).fill(0);
          break;
        case OP.PRESENT:
          this._need(rec, f.rt, 'present rt');
          this._need(rec, f.gamma, 'gamma table');
          this.presents++;
          break;
        case OP.MARK: break;
        default: throw new GpsError(`null executor: unknown op ${rec.op}`, ERR.UNKNOWN_OP, rec.seq);
      }
      this.counts[rec.name] = (this.counts[rec.name] || 0) + 1;
      this.records++;
      this.bytes += rec.size;
      let h = fnv1a(this.hash, rec.raw);
      for (const r of rec.refs) if (r.input) h = fnv1a(h, rec.arena(r.pos, r.len));
      this.hash = h;
    }
    stats() {
      return {
        counts: Object.assign({}, this.counts), records: this.records, bytes: this.bytes,
        hash: this.hash.toString(16).padStart(8, '0'),
        presents: this.presents, draws: this.draws, vertices: this.vertices,
      };
    }
    close() {}
  }

  // ── dump ────────────────────────────────────────────────────────────────
  // 'GPSD' u32 version 1; per record: u32 padded length, record bytes
  // (zero-padded to 8), u32 blob count, per blob u32 pos, u32 len, bytes
  // zero-padded to 4. Blobs are the arena INPUTS a record reads; READBACK
  // output is not recorded (a replay gets zeroed scratch for it).

  const DUMP_MAGIC = 0x44535047; // 'GPSD'
  const DUMP_VERSION = 1;

  class DumpWriter {
    // target: a file path (Node) or a sink(Uint8Array) callback.
    constructor(target) {
      if (typeof target === 'function') { this.sink = target; this.fd = null; }
      else if (typeof target === 'string') {
        const fs = require('fs');
        this.fs = fs;
        this.fd = fs.openSync(target, 'w');
        this.sink = (bytes) => fs.writeSync(this.fd, bytes);
      } else throw new TypeError('DumpWriter(target): path string or sink function');
      const h = new Uint8Array(8);
      const dv = new DataView(h.buffer);
      dv.setUint32(0, DUMP_MAGIC, true);
      dv.setUint32(4, DUMP_VERSION, true);
      this.sink(h);
      this.records = 0;
    }
    writeRecord(rec) {
      const blobs = rec.refs.filter((r) => r.input);
      let total = 4 + pad(rec.size, ALIGN) + 4;
      for (const b of blobs) total += 8 + pad(b.len, 4);
      const out = new Uint8Array(total);
      const dv = new DataView(out.buffer);
      let o = 0;
      dv.setUint32(o, pad(rec.size, ALIGN), true); o += 4;
      out.set(rec.raw, o); o += pad(rec.size, ALIGN);
      dv.setUint32(o, blobs.length, true); o += 4;
      for (const b of blobs) {
        dv.setUint32(o, b.pos >>> 0, true);
        dv.setUint32(o + 4, b.len, true);
        out.set(rec.arena(b.pos, b.len), o + 8);
        o += 8 + pad(b.len, 4);
      }
      this.sink(out);
      this.records++;
    }
    close() {
      if (this.fd !== null && this.fd !== undefined) { this.fs.closeSync(this.fd); this.fd = null; }
    }
  }

  // An executor that dumps each record (with its arena inputs) first.
  function tee(executor, writer) {
    return {
      inner: executor,
      writer,
      execute(rec) { writer.writeRecord(rec); return executor.execute(rec); },
      close() { if (executor.close) executor.close(); writer.close(); },
    };
  }

  class DumpReader {
    constructor(bytes) {
      if (!(bytes instanceof Uint8Array)) throw new TypeError('DumpReader(bytes): Uint8Array');
      // Own aligned copy so DataViews and record views are stable.
      this.bytes = new Uint8Array(bytes.length);
      this.bytes.set(bytes);
      this.dv = new DataView(this.bytes.buffer);
      if (bytes.length < 8 || this.dv.getUint32(0, true) !== DUMP_MAGIC) throw new Error('DumpReader: not a GPSD dump');
      const v = this.dv.getUint32(4, true);
      if (v !== DUMP_VERSION) throw new Error(`DumpReader: dump version ${v}, reader speaks ${DUMP_VERSION}`);
    }
    *records() {
      const { bytes, dv } = this;
      let o = 8;
      const need = (n, what) => { if (o + n > bytes.length) throw malformed(`dump truncated in ${what} at byte ${o}`); };
      while (o < bytes.length) {
        need(4, 'record length');
        const padded = dv.getUint32(o, true); o += 4;
        if (padded < REC || padded & (ALIGN - 1)) throw malformed(`dump: bad record length ${padded} at byte ${o - 4}`);
        need(padded, 'record');
        const recOff = o; o += padded;
        need(4, 'blob count');
        const nblobs = dv.getUint32(o, true); o += 4;
        const blobs = [];
        for (let i = 0; i < nblobs; i++) {
          need(8, 'blob header');
          const pos = dv.getUint32(o, true), len = dv.getUint32(o + 4, true);
          o += 8;
          need(len, 'blob');
          blobs.push({ pos, len, data: bytes.subarray(o, o + len) });
          o += pad(len, 4);
        }
        const size = dv.getUint32(recOff + 4, true);
        if (pad(size, ALIGN) !== padded) throw malformed(`dump: record says ${size} bytes, framed as ${padded}`);
        const scratch = new Map();
        const arenaFn = (pos, len, seq, op) => {
          for (const b of blobs) {
            const d = ((pos - b.pos) >>> 0);
            if (d <= b.len && d + len <= b.len) return b.data.subarray(d, d + len);
          }
          if (op === OP.READBACK) {
            // Writable zeroed scratch, the same one for repeated asks.
            const key = `${pos >>> 0}:${len}`;
            if (!scratch.has(key)) scratch.set(key, new Uint8Array(len));
            return scratch.get(key);
          }
          throw malformed(`dump: seq ${seq} reads arena ${pos >>> 0}+${len}, which the dump did not record`, seq);
        };
        const rec = buildRecord(bytes.buffer, recOff, arenaFn, null);
        rec.blobs = blobs;
        yield rec;
      }
    }
  }

  // Execute every record of a dump. Returns { records }.
  function replay(bytes, executor, options) {
    const max = options && options.maxRecords != null ? options.maxRecords : Infinity;
    let n = 0;
    for (const rec of new DumpReader(bytes).records()) {
      if (n >= max) break;
      for (const ref of rec.refs) rec.arena(ref.pos, ref.len);
      executor.execute(rec);
      n++;
    }
    return { records: n };
  }

  return Object.freeze(Object.assign({}, G, {
    generated: G,
    GpsError, Ring, drain, mergeBySeq, seqBefore, buildRecord, arenaRefs,
    decodeLayoutElems, decodeBind, decodeConsts, shaderIR,
    NullExecutor, fnv1a, DumpWriter, DumpReader, tee, replay,
    DUMP_MAGIC, DUMP_VERSION, SLOT_COUNT,
  }));
});
