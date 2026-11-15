'use strict';
// GPU stream v2 ring consumer (lib/gpu-stream.js drain) against a JS producer
// that mirrors the WAT byte for byte: ordered execution, WRAP records (including
// the 8-byte WRAP at the very end), arena wrap, read_pos/arena_tail/done_seq,
// FENCE/READBACK slots, and the error path (error_seq/error_code, stop).
const assert = require('assert');
const GS = require('../lib/gpu-stream');
const { makeProducer } = require('./gpu-stream-fixture');

const { OP, ERR, KIND, FMT } = GS;

function recorder() {
  const seen = [];
  return { seen, execute(rec) { seen.push({ name: rec.name, seq: rec.seq, fields: rec.fields, rec }); } };
}

// Header validation.
{
  const p = makeProducer({ magic: 0x1234 });
  assert.throws(() => p.ring(), /bad magic/);
  const q = makeProducer({ version: 1 });
  assert.throws(() => q.ring(), /version 1/);
  const r = makeProducer({ ringBytes: 1000 });
  assert.throws(() => r.ring(), /powers of two/);
  const s = makeProducer({ ringData: 65536 - 64, ringBytes: 1024 });
  assert.throws(() => s.ring(), /outside memory/);
}

// In-order execution, read_pos / done_seq, write_pos snapshot.
{
  const p = makeProducer({ ringBytes: 256, arenaBytes: 256 });
  const ring = p.ring();
  const s1 = p.emit('CREATE', { id: 7, kind: KIND.TEX2D, fmt: FMT.A8B8G8R8, levels: 1, width: 4, height: 4, size: 64 });
  const s2 = p.emit('MARK', { frame: 1, tag: 2 });
  const ex = recorder();
  const got = GS.drain([ring], ex);
  assert.strictEqual(got.records, 2);
  assert.deepStrictEqual(ex.seen.map((x) => x.name), ['CREATE', 'MARK']);
  assert.deepStrictEqual(ex.seen.map((x) => x.seq), [s1, s2]);
  assert.strictEqual(ex.seen[0].fields.width, 4);
  assert.strictEqual(ring.readPos, ring.writePos);
  assert.strictEqual(ring.doneSeq, s2);
  // Records published during a drain wait for the next one.
  const ex2 = { n: 0, execute(rec) { this.n++; if (this.n === 1) p.emit('MARK', { frame: 9 }); } };
  p.emit('MARK', { frame: 3 });
  assert.strictEqual(GS.drain([ring], ex2).records, 1);
  assert.strictEqual(GS.drain([ring], recorder()).records, 1);
}

// WRAP: many records through a small ring, including the 8-byte WRAP case
// (phys = ring_bytes - 8). MARK records are 12 + 8 = 20 -> 24 bytes padded.
{
  const p = makeProducer({ ringBytes: 64, arenaBytes: 256 });
  const ring = p.ring();
  const ex = recorder();
  const frames = [];
  let sawShortWrap = false;
  // MARK = 24 bytes, RELEASE = 16: MARK,RELEASE,RELEASE ends at phys 56.
  for (let i = 0; i < 40; i++) {
    const phys = p.load('write_pos') & 63;
    if (i % 3 === 0) {
      if (64 - phys === 8) sawShortWrap = true;
      p.emit('MARK', { frame: i, tag: 100 + i });
    } else p.emit('RELEASE', { id: 1000 + i });
    frames.push(i);
    GS.drain([ring], ex);
  }
  GS.drain([ring], ex);
  assert.deepStrictEqual(ex.seen.map((x) => (x.name === 'MARK' ? x.fields.frame : x.fields.id - 1000)), frames);
  assert.ok(sawShortWrap, 'exercised the 8-byte WRAP at the end of the ring');
  assert.strictEqual(ring.readPos, ring.writePos);
  assert.ok(ring.writePos > 64 * 4, 'positions are monotonic, not masked');
}

// Arena: UPLOAD and DRAW_UP set arena_tail to the end of the data they used;
// allocations wrap without splitting.
{
  const p = makeProducer({ ringBytes: 1024, arenaBytes: 128 });
  const ring = p.ring();
  p.emit('CREATE', { id: 1, kind: KIND.TEX2D, fmt: FMT.A8B8G8R8, levels: 1, width: 4, height: 4, size: 64 });
  const execs = [];
  const ex = { execute(rec) {
    if (rec.name === 'UPLOAD') execs.push(Array.from(rec.arena(rec.fields.src, rec.fields.bytes)));
    if (rec.name === 'DRAW_UP') execs.push(Array.from(rec.arena(rec.fields.voff, rec.fields.count * rec.fields.stride)));
  } };
  const a = p.arenaAlloc(40); // 48 reserved
  p.arenaView(a, 40).fill(0xA1);
  p.emit('UPLOAD', { id: 1, w: 4, h: 4, pitch: 16, src: a, bytes: 40 });
  GS.drain([ring], ex);
  assert.strictEqual(ring.arenaTail, a + 40);
  const b = p.arenaAlloc(48); // 48..96
  p.arenaView(b, 48).fill(0xB2);
  p.emit('DRAW_UP', { prim: 4, count: 3, vcount: 3, stride: 16, voff: b });
  GS.drain([ring], ex);
  assert.strictEqual(ring.arenaTail, b + 48);
  const c = p.arenaAlloc(48); // 96+48 > 128 -> skips to 128
  assert.strictEqual(c, 128);
  p.arenaView(c, 48).fill(0xC3);
  p.emit('UPLOAD', { id: 1, w: 4, h: 3, pitch: 16, src: c, bytes: 48 });
  p.emit('MARK', { frame: 1 }); // no arena use: tail stays
  GS.drain([ring], ex);
  assert.strictEqual(ring.arenaTail, c + 48);
  assert.deepStrictEqual(execs.map((x) => x[0]), [0xA1, 0xB2, 0xC3]);
  assert.ok(execs.every((x) => x.every((v) => v === x[0])));
  // An arena range that crosses the end is refused before execution.
  p.emit('UPLOAD', { id: 1, w: 4, h: 4, pitch: 16, src: 120, bytes: 64 });
  let ran = false;
  assert.throws(() => GS.drain([ring], { execute() { ran = true; } }),
    (e) => e.gpsCode === ERR.MALFORMED && /crosses the end/.test(e.message));
  assert.strictEqual(ran, false);
  assert.strictEqual(ring.errorCode, ERR.MALFORMED);
}

// FENCE and READBACK complete their slots; READBACK output lands in the arena.
{
  const p = makeProducer({ ringBytes: 512, arenaBytes: 256 });
  const ring = p.ring();
  p.emit('CREATE', { id: 2, kind: KIND.RT, fmt: FMT.A8B8G8R8, levels: 1, width: 2, height: 2, size: 16 });
  const f = p.emit('FENCE', { slot: 3 });
  const dst = p.arenaAlloc(16);
  p.arenaView(dst, 16).fill(0xEE);
  const rb = p.emit('READBACK', { rt: 2, w: 2, h: 2, fmt: FMT.A8B8G8R8, dst, pitch: 8, slot: 5 });
  const ex = { execute(rec) { if (rec.name === 'READBACK') rec.arena(rec.fields.dst, 16).fill(0x42); } };
  GS.drain([ring], ex);
  assert.strictEqual(p.slot(3), f);
  assert.strictEqual(p.slot(5), rb);
  assert.ok(Array.from(p.arenaView(dst, 16)).every((v) => v === 0x42));
  assert.strictEqual(ring.arenaTail, dst + 16);
  p.emit('FENCE', { slot: 16 });
  assert.throws(() => GS.drain([ring], ex), (e) => e.gpsCode === ERR.MALFORMED);
}

// Executor exception: error_seq/error_code set, later records not run, rethrown.
{
  const p = makeProducer({ ringBytes: 512, arenaBytes: 256 });
  const ring = p.ring();
  p.emit('MARK', { frame: 1 });
  const bad = p.emit('MARK', { frame: 2 });
  p.emit('MARK', { frame: 3 });
  const seen = [];
  const boom = new Error('boom');
  assert.throws(() => GS.drain([ring], { execute(rec) { seen.push(rec.fields.frame); if (rec.fields.frame === 2) throw boom; } }),
    (e) => e === boom && e.gpsCode === ERR.EXECUTOR && e.gpsSeq === bad);
  assert.deepStrictEqual(seen, [1, 2]);
  assert.strictEqual(ring.errorSeq, bad);
  assert.strictEqual(ring.errorCode, ERR.EXECUTOR);
  assert.strictEqual(ring.doneSeq, bad - 1);
  // A failed ring refuses further drains.
  assert.throws(() => GS.drain([ring], recorder()), /already failed/);
  // An executor's own code wins.
  const q = makeProducer();
  const qs = q.emit('MARK', {});
  const qr = q.ring();
  assert.throws(() => GS.drain([qr], { execute() { throw new GS.GpsError('nope', ERR.UNSUPPORTED); } }));
  assert.strictEqual(qr.errorCode, ERR.UNSUPPORTED);
  assert.strictEqual(qr.errorSeq, qs);
}

// Unknown op: UNKNOWN_OP, nothing executed.
{
  const p = makeProducer();
  const ring = p.ring();
  const s = p.emitRaw(99, new Uint8Array(8));
  let ran = false;
  assert.throws(() => GS.drain([ring], { execute() { ran = true; } }), (e) => e.gpsCode === ERR.UNKNOWN_OP);
  assert.strictEqual(ran, false);
  assert.strictEqual(ring.errorCode, ERR.UNKNOWN_OP);
  assert.strictEqual(ring.errorSeq, s);
}

console.log('test-gpu-stream-ring: PASS');
