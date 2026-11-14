'use strict';
// GPU stream v2 NullExecutor: resource-lifetime validation, per-op counts,
// draw/vertex/present totals, READBACK zero fill, and a hash that is
// deterministic, covers arena inputs, and changes when any byte does.
const assert = require('assert');
const GS = require('../lib/gpu-stream');
const { makeProducer, packLayout } = require('./gpu-stream-fixture');

const { KIND, FMT, ERR, PRIM } = GS;

// A small but complete frame. fill() sets the arena payloads.
function frame(p, fill = 0x11) {
  p.emit('CREATE', { id: 1, kind: KIND.RT, fmt: FMT.A8B8G8R8, levels: 1, width: 4, height: 4, size: 64 });
  p.emit('CREATE', { id: 2, kind: KIND.TEX2D, fmt: FMT.A8B8G8R8, levels: 1, width: 2, height: 2, size: 16 });
  const t = p.arenaAlloc(16);
  p.arenaView(t, 16).fill(fill);
  p.emit('UPLOAD', { id: 2, w: 2, h: 2, pitch: 8, src: t, bytes: 16 });
  p.emit('SAMPLER', { id: 3, address_u: 1, address_v: 1, min: 2, mag: 2 });
  p.emit('SHADER', { id: 4, stage: 1, ir_bytes: 8 }, new Uint8Array(8));
  p.emit('LAYOUT', { id: 5, count: 1, stride: 16 }, packLayout('GpsLayoutElem', { usage: 9, type: 3 }));
  p.emit('TARGETS', { color: 1, depth: 0 });
  p.emit('VIEWPORT', { w: 4, h: 4, zmax: 1 });
  p.emit('RASTER', { cull: 1, colormask: 15 });
  p.emit('BIND', { count: 1 }, packLayout('GpsBindEntry', { slot: 0, texture: 2, sampler: 3 }));
  p.emit('CONSTS', { stage: 1, first: 0, count: 1 }, new Uint8Array(16));
  p.emit('CLEAR', { mask: 1, rgba: 0xff000000, right: 4, bottom: 4 });
  const v = p.arenaAlloc(48);
  p.arenaView(v, 48).fill(fill + 1);
  p.emit('DRAW_UP', { prim: PRIM.TRIANGLELIST, ps: 4, layout: 5, voff: v, stride: 16, count: 3 });
  const d = p.arenaAlloc(64);
  p.arenaView(d, 64).fill(0x77);
  p.emit('READBACK', { rt: 1, w: 4, h: 4, fmt: FMT.A8B8G8R8, dst: d, pitch: 16, slot: 0 });
  p.emit('PRESENT', { rt: 1, w: 4, h: 4, surface: 0x1234 });
  p.emit('MARK', { frame: 1 });
  p.emit('FENCE', { slot: 1 });
  p.emit('RELEASE', { id: 2 });
  return d;
}

function run(fill) {
  const p = makeProducer({ ringBytes: 4096, arenaBytes: 1024 });
  const d = frame(p, fill);
  const ex = new GS.NullExecutor();
  GS.drain([p.ring()], ex);
  return { stats: ex.stats(), p, d };
}

{
  const a = run(0x11);
  const s = a.stats;
  assert.strictEqual(s.records, 18);
  assert.deepStrictEqual(s.counts, {
    CREATE: 2, UPLOAD: 1, SAMPLER: 1, SHADER: 1, LAYOUT: 1, TARGETS: 1, VIEWPORT: 1, RASTER: 1,
    BIND: 1, CONSTS: 1, CLEAR: 1, DRAW_UP: 1, READBACK: 1, PRESENT: 1, MARK: 1, FENCE: 1, RELEASE: 1,
  });
  assert.strictEqual(s.draws, 1);
  assert.strictEqual(s.vertices, 3);
  assert.strictEqual(s.presents, 1);
  assert.match(s.hash, /^[0-9a-f]{8}$/);
  assert.ok(Array.from(a.p.arenaView(a.d, 64)).every((x) => x === 0), 'READBACK zero-filled');
  // Deterministic, and sensitive to arena input bytes.
  assert.strictEqual(run(0x11).stats.hash, s.hash);
  assert.notStrictEqual(run(0x12).stats.hash, s.hash);
}

// Validation failures, each a fresh stream.
function expectFail(build, re) {
  const p = makeProducer({ ringBytes: 4096, arenaBytes: 1024 });
  build(p);
  const ring = p.ring();
  assert.throws(() => GS.drain([ring], new GS.NullExecutor()), (e) => re.test(e.message) && e.gpsCode === ERR.EXECUTOR, String(re));
  assert.strictEqual(ring.errorCode, ERR.EXECUTOR);
}
expectFail((p) => p.emit('PRESENT', { rt: 9 }), /present rt 9 was never created/);
expectFail((p) => p.emit('RELEASE', { id: 4 }), /not live/);
expectFail((p) => { p.emit('CREATE', { id: 1, kind: KIND.RT }); p.emit('CREATE', { id: 1, kind: KIND.RT }); }, /already live/);
expectFail((p) => p.emit('CREATE', { id: 0, kind: KIND.RT }), /id 0 is reserved/);
expectFail((p) => { p.emit('CREATE', { id: 1, kind: KIND.RT }); p.emit('RELEASE', { id: 1 }); p.emit('TARGETS', { color: 1 }); }, /color target 1/);
expectFail((p) => p.emit('DRAW_UP', { ps: 4, count: 3 }), /ps 4 was never created/);
expectFail((p) => { p.emit('CREATE', { id: 4, kind: KIND.TEX2D }); p.emit('DRAW_UP', { ps: 4 }); }, /expected 7/);
expectFail((p) => p.emit('DRAW', { count: 3 }), /without a vertex buffer/);
expectFail((p) => { p.emit('CREATE', { id: 2, kind: KIND.VBUF }); p.emit('DRAW_UP', { vbuf: 2 }); }, /must be 0/);
expectFail((p) => { p.emit('CREATE', { id: 2, kind: KIND.TEX2D }); p.emit('BIND', { count: 1 }, packLayout('GpsBindEntry', { texture: 2, sampler: 8 })); }, /sampler 8/);
expectFail((p) => { p.emit('SHADER', { id: 4 }); p.emit('SHADER', { id: 4 }); }, /already live/);
expectFail((p) => p.emit('UPLOAD', { id: 3 }), /upload target 3/);
// SHADER may fill an id CREATEd as a shader, once.
{
  const p = makeProducer();
  p.emit('CREATE', { id: 4, kind: KIND.SHADER });
  p.emit('SHADER', { id: 4 });
  const ex = new GS.NullExecutor();
  GS.drain([p.ring()], ex);
  assert.strictEqual(ex.stats().records, 2);
}

console.log('test-gpu-stream-null: PASS');
