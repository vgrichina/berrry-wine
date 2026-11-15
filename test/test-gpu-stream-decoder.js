'use strict';
// GPU stream v2 generated decoders (lib/gpu-stream.generated.js): every op
// layout round-trips through the ring; unknown ops and short records fail with
// the right error code; two rings sharing one seq counter merge by seq; and the
// generated mirror is fresh (tools/gen-gpu-stream.js --check).
const assert = require('assert');
const path = require('path');
const { execFileSync } = require('child_process');
const GS = require('../lib/gpu-stream');
const { makeProducer, packLayout } = require('./gpu-stream-fixture');

const { OP, ERR, LAYOUTS, OP_LAYOUT, OP_NAMES, decode } = GS;

// Freshness of the mirror and the op-id baseline.
execFileSync(process.execPath, [path.join(__dirname, '..', 'tools', 'gen-gpu-stream.js'), '--check'],
  { stdio: 'pipe', timeout: 30000 });

// Deterministic field values that fit each type.
function sample(layoutName, salt) {
  const obj = {};
  let k = salt * 131 + 7;
  const next = () => (k = (Math.imul(k, 1103515245) + 12345) >>> 0);
  for (const f of LAYOUTS[layoutName].fields) {
    const one = () => {
      switch (f.type) {
        case 'u8': return next() & 0xff;
        case 'u16': return next() & 0xffff;
        case 'i32': return next() >>> 0;
        case 'f32': return Math.fround((next() & 0xffff) / 64 - 300);
        default: throw new Error(`no sample for ${f.type}`);
      }
    };
    obj[f.name] = f.count > 1 ? Array.from({ length: f.count }, one) : one();
  }
  return obj;
}

// Every op except WRAP has a layout; WRAP has none.
assert.strictEqual(OP_LAYOUT.WRAP, undefined);
for (const name of Object.values(OP_NAMES)) if (name !== 'WRAP') assert.ok(LAYOUTS[OP_LAYOUT[name]], name);
assert.strictEqual(OP_LAYOUT.DRAW_UP, 'GpsDraw');

// Round-trip every layout directly.
for (const name of Object.keys(LAYOUTS)) {
  const obj = sample(name, name.length);
  const bytes = packLayout(name, obj);
  const back = decode[name](new DataView(bytes.buffer), 0);
  assert.deepStrictEqual(back, obj, `${name} round trip`);
}

// Round-trip every op through a ring (counts zeroed so no tail is required).
{
  const p = makeProducer({ ringBytes: 4096, arenaBytes: 256 });
  const ring = p.ring();
  const want = [];
  for (const name of Object.values(OP_NAMES)) {
    if (name === 'WRAP') continue;
    const f = sample(OP_LAYOUT[name], OP[name]);
    if ('count' in f && ['LAYOUT', 'BIND', 'CONSTS'].includes(name)) f.count = 0;
    if (name === 'SHADER') f.ir_bytes = 0;
    if (name === 'UPLOAD') f.bytes = 0;
    if (name === 'DRAW_UP' || name === 'DRAW') { f.count = 0; f.vcount = 0; }
    if (name === 'FENCE') f.kind = 0;
    if (name === 'READBACK') f.pitch = 0;
    if (name === 'FENCE' || name === 'READBACK') f.slot = 1;
    want.push({ name, f, seq: p.emit(name, f) });
  }
  const got = [];
  GS.drain([ring], { execute(rec) { got.push({ name: rec.name, f: rec.fields, seq: rec.seq }); } });
  assert.deepStrictEqual(got, want);
}

// Variable tails: SHADER IR, LAYOUT elems, BIND entries, CONSTS floats.
{
  const p = makeProducer({ ringBytes: 4096, arenaBytes: 256 });
  const ring = p.ring();
  const ir = Uint8Array.from({ length: 40 }, (_, i) => i * 3);
  p.emit('SHADER', { id: 5, stage: 1, ir_bytes: 40 }, ir);
  const elems = [{ slot: 0, type: 3, usage: 9, index: 0, offset: 0 }, { slot: 0, type: 3, usage: 10, index: 0, offset: 16 }];
  p.emit('LAYOUT', { id: 6, count: 2, stride: 32 }, concat(elems.map((e) => packLayout('GpsLayoutElem', e))));
  const binds = [{ slot: 0, texture: 9, sampler: 10 }, { slot: 1, texture: 0, sampler: 0 }];
  p.emit('BIND', { count: 2 }, concat(binds.map((e) => packLayout('GpsBindEntry', e))));
  const floats = Float32Array.from([1, 2.5, -3, 4, 0.25, 6, 7, 8]);
  p.emit('CONSTS', { stage: 0, first: 4, count: 2 }, new Uint8Array(floats.buffer));
  const out = {};
  GS.drain([ring], { execute(rec) {
    if (rec.name === 'SHADER') out.ir = Array.from(GS.shaderIR(rec));
    if (rec.name === 'LAYOUT') out.elems = GS.decodeLayoutElems(rec).map((e) => ({ slot: e.slot, type: e.type, usage: e.usage, index: e.index, offset: e.offset }));
    if (rec.name === 'BIND') out.binds = GS.decodeBind(rec);
    if (rec.name === 'CONSTS') out.consts = Array.from(GS.decodeConsts(rec));
  } });
  assert.deepStrictEqual(out.ir, Array.from(ir));
  assert.deepStrictEqual(out.elems, elems);
  assert.deepStrictEqual(out.binds, binds);
  assert.deepStrictEqual(out.consts, Array.from(floats));
  // A count larger than the tail is MALFORMED before the executor runs.
  const q = makeProducer();
  q.emit('BIND', { count: 3 }, packLayout('GpsBindEntry', {}));
  let ran = false;
  const qr = q.ring();
  assert.throws(() => GS.drain([qr], { execute() { ran = true; } }), (e) => e.gpsCode === ERR.MALFORMED);
  assert.strictEqual(ran, false);
  assert.strictEqual(qr.errorCode, ERR.MALFORMED);
}

function concat(parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// Unknown op -> UNKNOWN_OP; a record shorter than 12 + its layout -> MALFORMED.
{
  const p = makeProducer();
  const ring = p.ring();
  p.emitRaw(7, new Uint8Array(4));
  assert.throws(() => GS.drain([ring], { execute() {} }), (e) => e.gpsCode === ERR.UNKNOWN_OP);
  assert.strictEqual(ring.errorCode, ERR.UNKNOWN_OP);

  const q = makeProducer();
  const qr = q.ring();
  // CREATE needs 12 + 20 bytes; declare 12 + 16.
  const s = q.emitRaw(OP.CREATE, new Uint8Array(24), 12 + 16);
  assert.throws(() => GS.drain([qr], { execute() {} }), (e) => e.gpsCode === ERR.MALFORMED);
  assert.strictEqual(qr.errorCode, ERR.MALFORMED);
  assert.strictEqual(qr.errorSeq, s);

  // A record header shorter than 12 bytes.
  const r = makeProducer();
  const rr = r.ring();
  r.emitRaw(OP.MARK, new Uint8Array(8), 8);
  assert.throws(() => GS.drain([rr], { execute() {} }), (e) => e.gpsCode === ERR.MALFORMED);
}

// mergeBySeq / seqBefore.
assert.strictEqual(GS.seqBefore(1, 2), true);
assert.strictEqual(GS.seqBefore(0xfffffffe, 1), true, 'wrap-safe');
assert.strictEqual(GS.seqBefore(1, 0xfffffffe), false);
assert.strictEqual(GS.mergeBySeq([null, { seq: 5 }, { seq: 3 }]), 2);
assert.strictEqual(GS.mergeBySeq([{ seq: 0xffffffff }, { seq: 2 }]), 0);
assert.strictEqual(GS.mergeBySeq([null, null]), -1);

// Two rings, one device seq counter: drain executes in global seq order.
{
  const buffer = new SharedArrayBuffer(1 << 17);
  const a = makeProducer({ buffer, headerAddr: 64, ringData: 4096, arenaData: 8192, ringBytes: 1024, arenaBytes: 256 });
  const seqAddr = 64 + LAYOUTS.GpsRing.fields.find((f) => f.name === 'seq_storage').offset;
  const b = makeProducer({ buffer, headerAddr: 512, ringData: 16384, arenaData: 20480, ringBytes: 1024, arenaBytes: 256, seqAddr });
  const order = [];
  for (let i = 0; i < 12; i++) {
    const which = (i * 7) % 3 === 0 ? b : a;
    order.push({ ring: which === a ? 'a' : 'b', frame: i, seq: which.emit('MARK', { frame: i }) });
  }
  const ra = a.ring(), rb = b.ring();
  const got = [];
  GS.drain([ra, rb], { execute(rec) { got.push({ ring: rec.ring === ra ? 'a' : 'b', frame: rec.fields.frame, seq: rec.seq }); } });
  assert.deepStrictEqual(got, order);
  assert.strictEqual(ra.readPos, ra.writePos);
  assert.strictEqual(rb.readPos, rb.writePos);
  assert.strictEqual(Math.max(ra.doneSeq, rb.doneSeq), order[order.length - 1].seq);
}

console.log('test-gpu-stream-decoder: PASS');
