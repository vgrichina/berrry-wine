'use strict';
// GPU stream v2 dump round trip: drain through tee(NullExecutor, DumpWriter)
// -> dump bytes -> DumpReader/replay through a fresh NullExecutor gives the
// same stats and hash; file-path writer and tools/gpu-stream.js list/stats
// read the same file; truncated or foreign dumps are refused.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const GS = require('../lib/gpu-stream');
const { makeProducer, packLayout } = require('./gpu-stream-fixture');

const { KIND, FMT } = GS;

function produce(p, frames) {
  p.emit('CREATE', { id: 1, kind: KIND.RT, fmt: FMT.A8B8G8R8, levels: 1, width: 8, height: 8, size: 256 });
  p.emit('CREATE', { id: 2, kind: KIND.TEX2D, fmt: FMT.A8B8G8R8, levels: 1, width: 4, height: 4, size: 64 });
  p.emit('SHADER', { id: 3, stage: 1, ir_bytes: 16 }, Uint8Array.from({ length: 16 }, (_, i) => i));
  p.emit('LAYOUT', { id: 4, count: 1, stride: 32 }, packLayout('GpsLayoutElem', { usage: 9, type: 3 }));
  p.emit('SAMPLER', { id: 5, min: 2, mag: 2 });
  for (let f = 0; f < frames; f++) {
    const t = p.arenaAlloc(64);
    p.arenaView(t, 64).fill(f + 1);
    p.emit('UPLOAD', { id: 2, w: 4, h: 4, pitch: 16, src: t, bytes: 64 });
    p.emit('BIND', { count: 1 }, packLayout('GpsBindEntry', { texture: 2, sampler: 5 }));
    const v = p.arenaAlloc(96);
    p.arenaView(v, 96).fill(0x80 + f);
    p.emit('DRAW_UP', { prim: 4, ps: 3, layout: 4, voff: v, stride: 32, count: 3 });
    if (f === 1) {
      const d = p.arenaAlloc(32);
      p.emit('READBACK', { rt: 1, w: 2, h: 2, dst: d, pitch: 8, slot: 2, fmt: FMT.A8B8G8R8 });
    }
    p.emit('PRESENT', { rt: 1, w: 8, h: 8 });
    p.emit('MARK', { frame: f });
  }
}

// Drain in several batches so ring and arena both wrap.
const chunks = [];
const writer = new GS.DumpWriter((bytes) => chunks.push(Uint8Array.from(bytes)));
const live = new GS.NullExecutor();
const p = makeProducer({ ringBytes: 512, arenaBytes: 512 });
const ring = p.ring();
const ex = GS.tee(live, writer);
const FR = 12;
produce(p, 0);
GS.drain([ring], ex);
for (let f = 0; f < FR; f++) {
  // One frame at a time (the fixture refuses a full ring/arena).
  const before = p.load('write_pos');
  produceFrame(f);
  GS.drain([ring], ex);
  assert.ok(p.load('write_pos') !== before);
}
function produceFrame(f) {
  const t = p.arenaAlloc(64);
  p.arenaView(t, 64).fill(f + 1);
  p.emit('UPLOAD', { id: 2, w: 4, h: 4, pitch: 16, src: t, bytes: 64 });
  const v = p.arenaAlloc(96);
  p.arenaView(v, 96).fill(0x80 + f);
  p.emit('DRAW_UP', { prim: 4, ps: 0, layout: 0, voff: v, stride: 32, count: 3 });
  p.emit('PRESENT', { rt: 0, w: 8, h: 8 });
  p.emit('MARK', { frame: f });
}
assert.ok(ring.writePos > 512 && ring.arenaTail > 512, 'ring and arena wrapped');
ex.close();
const dump = concat(chunks);
assert.strictEqual(new DataView(dump.buffer).getUint32(0, true), GS.DUMP_MAGIC);

const replayed = new GS.NullExecutor();
const r = GS.replay(dump, replayed);
assert.strictEqual(r.records, live.stats().records);
assert.deepStrictEqual(replayed.stats(), live.stats());

// Reader records look like drain's.
const recs = Array.from(new GS.DumpReader(dump).records());
assert.strictEqual(recs.length, live.stats().records);
const up = recs.find((x) => x.name === 'UPLOAD');
assert.ok(up.payload instanceof DataView && up.tail instanceof Uint8Array && typeof up.arena === 'function');
assert.ok(Array.from(up.arena(up.fields.src, 64)).every((x) => x === 1));
assert.throws(() => up.arena(up.fields.src + 1000, 4), /did not record/);

// A full multi-frame stream (with READBACK) through a file-path writer and the CLI.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gps-dump-'));
try {
  const file = path.join(dir, 'stream.gpsd');
  const q = makeProducer({ ringBytes: 8192, arenaBytes: 4096 });
  const fw = new GS.DumpWriter(file);
  const qn = new GS.NullExecutor();
  produce(q, 3);
  GS.drain([q.ring()], GS.tee(qn, fw));
  fw.close();
  const bytes = new Uint8Array(fs.readFileSync(file));
  const again = new GS.NullExecutor();
  GS.replay(bytes, again);
  assert.deepStrictEqual(again.stats(), qn.stats());
  assert.strictEqual(qn.stats().counts.READBACK, 1);

  const tool = path.join(__dirname, '..', 'tools', 'gpu-stream.js');
  const stats = JSON.parse(execFileSync(process.execPath, [tool, 'stats', file, '--json'], { encoding: 'utf8', timeout: 30000 }));
  assert.deepStrictEqual(stats.counts, qn.stats().counts);
  assert.strictEqual(stats.hash, qn.stats().hash);
  const list = execFileSync(process.execPath, [tool, 'list', file], { encoding: 'utf8', timeout: 30000 }).trim().split('\n');
  assert.strictEqual(list.length, qn.stats().records);
  assert.match(list[0], /CREATE/);
  const rep = execFileSync(process.execPath, [tool, 'replay', file, '--executor=null'], { encoding: 'utf8', timeout: 30000 });
  assert.match(rep, new RegExp(qn.stats().hash));

  // Truncated and foreign dumps.
  assert.throws(() => GS.replay(bytes.subarray(0, bytes.length - 3), new GS.NullExecutor()), /truncated/);
  assert.throws(() => new GS.DumpReader(new Uint8Array(16)), /not a GPSD dump/);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

function concat(parts) {
  const out = new Uint8Array(parts.reduce((n, x) => n + x.length, 0));
  let o = 0;
  for (const x of parts) { out.set(x, o); o += x.length; }
  return out;
}

console.log('test-gpu-stream-dump: PASS');
