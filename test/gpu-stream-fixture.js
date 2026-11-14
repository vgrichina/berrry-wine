'use strict';
// tl;dr: a JS GPU-stream PRODUCER that mirrors src/09a8gs-gpu-stream.wat
// ($gps_ring_open / $gps_begin / $gps_end / $gps_arena_alloc) byte for byte,
// over a SharedArrayBuffer, so the consumer runtime (lib/gpu-stream.js) can be
// tested without the wasm. Layout offsets come from the generated mirror.
//
//   const p = makeProducer({ ringBytes: 256, arenaBytes: 256 });
//   p.emit('CREATE', { id: 1, kind: 1, ... });          // returns seq
//   const pos = p.arenaAlloc(64); p.arenaBytes(pos).set(bytes);
//   drain([p.ring()], executor);
//
// It refuses (throws) where the WAT would sync-kick and wait: tests drain
// explicitly.

const GS = require('../lib/gpu-stream');

const { LAYOUTS, OP, OP_LAYOUT, CONST } = GS;
const REC = LAYOUTS.GpsRecord.size;
const off = (layout, name) => LAYOUTS[layout].fields.find((f) => f.name === name).offset;

function writeField(dv, at, type, value) {
  switch (type) {
    case 'u8': case 's8': dv.setUint8(at, value & 0xff); break;
    case 'u16': case 's16': dv.setUint16(at, value & 0xffff, true); break;
    case 'i32': dv.setUint32(at, value >>> 0, true); break;
    case 'f32': dv.setFloat32(at, value, true); break;
    default: throw new Error(`fixture: no writer for ${type}`);
  }
}

// Encode `obj` as layoutName at dv[o]; missing fields are 0.
function encode(layoutName, dv, o, obj) {
  for (const f of LAYOUTS[layoutName].fields) {
    const v = obj[f.name];
    if (f.count > 1) {
      const stride = f.size / f.count;
      for (let i = 0; i < f.count; i++) writeField(dv, o + f.offset + i * stride, f.type, v ? v[i] || 0 : 0);
    } else writeField(dv, o + f.offset, f.type, v || 0);
  }
  for (const k of Object.keys(obj)) {
    if (!LAYOUTS[layoutName].fields.some((f) => f.name === k)) throw new Error(`fixture: ${layoutName} has no field ${k}`);
  }
}

function makeProducer(opts = {}) {
  const ringBytes = opts.ringBytes || 1024;
  const arenaBytes = opts.arenaBytes || 1024;
  const header = opts.headerAddr || 64;
  const memBytes = opts.memBytes || 65536;
  const buffer = opts.buffer || new SharedArrayBuffer(memBytes);
  const dv = new DataView(buffer);
  const i32 = new Int32Array(buffer);
  const u8 = new Uint8Array(buffer);
  const ringData = opts.ringData || 4096;
  const arenaData = opts.arenaData || (ringData + ringBytes + 4096);
  const seqAddr = opts.seqAddr || (header + off('GpsRing', 'seq_storage'));
  const H = (n) => (header + off('GpsRing', n)) >> 2;

  u8.fill(0, header, header + LAYOUTS.GpsRing.size);
  dv.setUint16(header + off('GpsRing', 'version'), opts.version === undefined ? CONST.VERSION : opts.version, true);
  dv.setUint32(header + off('GpsRing', 'ring_bytes'), ringBytes, true);
  dv.setUint32(header + off('GpsRing', 'arena_bytes'), arenaBytes, true);
  dv.setUint32(header + off('GpsRing', 'ring_data'), ringData, true);
  dv.setUint32(header + off('GpsRing', 'arena_data'), arenaData, true);
  dv.setUint32(header + off('GpsRing', 'seq_counter'), seqAddr, true);
  Atomics.store(i32, H('magic'), opts.magic === undefined ? CONST.MAGIC : opts.magic);

  const load = (n) => Atomics.load(i32, H(n)) >>> 0;
  const store = (n, v) => Atomics.store(i32, H(n), v | 0);

  // $gps_begin: reserve, WRAP when the record would cross the end.
  function begin(op, payload) {
    const size = REC + payload;
    const total = (size + 7) & -8;
    if (total > ringBytes >>> 1) throw new Error('fixture: record larger than half the ring');
    let wp = load('write_pos');
    let phys = wp & (ringBytes - 1);
    let skip = 0;
    if (phys + total > ringBytes) skip = ringBytes - phys;
    if (skip + total + ((wp - load('read_pos')) >>> 0) > ringBytes) throw new Error('fixture: ring full (WAT would sync)');
    if (skip) {
      const p = ringData + phys;
      dv.setUint16(p, OP.WRAP, true);
      dv.setUint16(p + 2, 0, true);
      dv.setUint32(p + 4, skip, true);
      // The WAT also stores seq=0 at +8, which is past the ring when skip is
      // 8; the fixture only does so when it fits.
      if (skip >= REC) dv.setUint32(p + 8, 0, true);
      wp = (wp + skip) >>> 0;
      store('write_pos', wp);
      phys = 0;
    }
    const p = ringData + phys;
    dv.setUint16(p, op, true);
    dv.setUint16(p + 2, 0, true);
    dv.setUint32(p + 4, size, true);
    return p + REC;
  }

  // $gps_end: assign seq, publish.
  function end(payloadPtr, flags = 0) {
    const p = payloadPtr - REC;
    const seq = (Atomics.add(i32, seqAddr >> 2, 1) + 1) >>> 0;
    dv.setUint16(p + 2, flags, true);
    dv.setUint32(p + 8, seq, true);
    const size = (dv.getUint32(p + 4, true) + 7) & -8;
    store('submit_seq', seq);
    store('write_pos', (load('write_pos') + size) >>> 0);
    return seq;
  }

  // One record: op name, fixed fields, optional trailing bytes.
  function emit(opName, fields = {}, tail = null, flags = 0) {
    const op = OP[opName];
    if (op === undefined) throw new Error(`fixture: unknown op ${opName}`);
    const layout = OP_LAYOUT[opName];
    const fixed = LAYOUTS[layout].size;
    const t = tail ? tail.length : 0;
    const p = begin(op, fixed + t);
    encode(layout, dv, p, fields);
    if (tail) u8.set(tail, p + fixed);
    return end(p, flags);
  }

  // A raw record with an arbitrary op/size (malformed-input tests).
  function emitRaw(op, payloadBytes, declaredSize) {
    const p = begin(op, payloadBytes.length);
    u8.set(payloadBytes, p);
    if (declaredSize !== undefined) dv.setUint32(p - REC + 4, declaredSize, true);
    return end(p);
  }

  // $gps_arena_alloc: 16-aligned, never split across the end.
  function arenaAlloc(n) {
    n = (n + 15) & -16;
    if (n > arenaBytes >>> 1) throw new Error('fixture: arena alloc larger than half the arena');
    let head = load('arena_head');
    const phys = head & (arenaBytes - 1);
    const skip = phys + n > arenaBytes ? arenaBytes - phys : 0;
    if (skip + n + ((head - load('arena_tail')) >>> 0) > arenaBytes) throw new Error('fixture: arena full (WAT would sync)');
    head = (head + skip) >>> 0;
    store('arena_head', (head + n) >>> 0);
    return head;
  }
  const arenaView = (pos, len) => new Uint8Array(buffer, arenaData + (pos & (arenaBytes - 1)), len);

  return {
    buffer, dv, i32, u8, header, ringData, arenaData, ringBytes, arenaBytes,
    begin, end, emit, emitRaw, arenaAlloc, arenaView, load, store,
    ring: () => new GS.Ring(() => buffer, header),
    slot: (i) => Atomics.load(i32, H('slots') + i) >>> 0,
  };
}

// Pack an object as layoutName into a fresh Uint8Array.
function packLayout(layoutName, obj) {
  const out = new Uint8Array(LAYOUTS[layoutName].size);
  encode(layoutName, new DataView(out.buffer), 0, obj);
  return out;
}

module.exports = { makeProducer, encode, packLayout };
