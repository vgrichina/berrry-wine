'use strict';
// GPU stream v2 NullExecutor: resource-lifetime validation, per-op counts,
// draw/vertex/present totals, READBACK zero fill, and a hash that is
// deterministic, covers arena inputs, and changes when any byte does.
const assert = require('assert');
const GS = require('../lib/gpu-stream');
const { makeProducer, packLayout } = require('./gpu-stream-fixture');

const { KIND, FMT, ERR, PRIM, CONST } = GS;

// The smallest valid RASTER: no depth, no blend, alpha test ALWAYS, solid.
const RASTER = { zfunc: 8, cull: 1, alpha_func: 8, fill: 3, colormask: 15 };

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
  p.emit('RASTER', RASTER);
  p.emit('BIND', { count: 1 }, packLayout('GpsBindEntry', { slot: 0, texture: 2, sampler: 3 }));
  p.emit('CONSTS', { stage: 1, first: 0, count: 1 }, new Uint8Array(16));
  p.emit('CLEAR', { mask: 1, rgba: 0xff000000, right: 4, bottom: 4 });
  const v = p.arenaAlloc(48);
  p.arenaView(v, 48).fill(fill + 1);
  p.emit('DRAW_UP', { prim: PRIM.TRIANGLELIST, ps: 4, layout: 5, voff: v, stride: 16, count: 3, vcount: 3 });
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
// D1 fields: RASTER stencil/blend_op/bias, LAYOUT, indices, FENCE kinds, READBACK fmt.
const layout = (p, elems, stride) => p.emit('LAYOUT', { id: 5, count: elems.length, stride },
  Buffer.concat(elems.map((e) => packLayout('GpsLayoutElem', e))));
const POS = { usage: CONST.USAGE_POSITIONT, type: CONST.VTYPE_FLOAT4, offset: 0 };
expectFail((p) => p.emit('RASTER', Object.assign({}, RASTER, { blend: 1, src_rgb: 2, dst_rgb: 1, src_alpha: 2, dst_alpha: 1 })), /blend_op 0/);
expectFail((p) => p.emit('RASTER', Object.assign({}, RASTER, { stencil_enable: 1, stencil_func: 9, stencil_fail: 1, stencil_zfail: 1, stencil_pass: 1 })), /stencil_func 9/);
expectFail((p) => p.emit('RASTER', Object.assign({}, RASTER, { two_sided: 1 })), /two_sided without stencil_enable/);
expectFail((p) => p.emit('RASTER', Object.assign({}, RASTER, { stencil_enable: 1, two_sided: 1, stencil_func: 8, stencil_fail: 1, stencil_zfail: 1, stencil_pass: 1, ccw_func: 0 })), /ccw_func 0/);
expectFail((p) => p.emit('RASTER', Object.assign({}, RASTER, { depth_mode: 2, z_bias: 1 })), /depth_mode 1 only/);
expectFail((p) => p.emit('RASTER', Object.assign({}, RASTER, { reserved: [0, 0, 1] })), /reserved/);
expectFail((p) => layout(p, [{ usage: CONST.USAGE_COLOR, type: CONST.VTYPE_D3DCOLOR }], 4), /no POSITIONT/);
expectFail((p) => layout(p, [POS, { usage: CONST.USAGE_TEXCOORD, type: 1, offset: 16 }, { usage: CONST.USAGE_TEXCOORD, type: 1, offset: 24 }], 32), /declared twice/);
expectFail((p) => layout(p, [POS, { usage: CONST.USAGE_COLOR, type: CONST.VTYPE_D3DCOLOR, offset: 18 }], 24), /outside|unaligned/);
expectFail((p) => layout(p, [POS], 16) && p.emit('DRAW_UP', { prim: PRIM.TRIANGLELIST, layout: 5, count: 3, vcount: 2 }), /vcount 2 differs/);
expectFail((p) => {
  layout(p, [POS], 16);
  const i = p.arenaAlloc(8);
  new DataView(p.buffer).setUint16(p.arenaData + i + 2, 7, true);
  p.emit('DRAW_UP', { prim: PRIM.TRIANGLELIST, layout: 5, index_size: 2, ioff: i, count: 3, vcount: 4, stride: 16 });
}, /index 7 at 1 >= vcount 4/);
expectFail((p) => layout(p, [POS], 16) && p.emit('DRAW_UP', { prim: 6, layout: 5, count: 3, vcount: 3, stride: 16 }), /prim 6/);
expectFail((p) => p.emit('FENCE', { kind: CONST.FENCEK_OCCLUSION_END, dst: 0 }), /END without a BEGIN/);
expectFail((p) => { p.emit('FENCE', { kind: 1 }); p.emit('FENCE', { kind: 1 }); }, /BEGIN while one is open/);
expectFail((p) => { p.emit('CREATE', { id: 1, kind: KIND.RT }); p.emit('READBACK', { rt: 1, w: 1, h: 1, fmt: FMT.RGB565, pitch: 2 }); }, /only A8B8G8R8/);
// Indexed strips, occlusion END zero-fill, BIND of an RT, and the caps block.
{
  const p = makeProducer({ ringBytes: 4096, arenaBytes: 1024 });
  layout(p, [POS, { usage: CONST.USAGE_COLOR, type: CONST.VTYPE_D3DCOLOR, offset: 16 }], 20);
  const i = p.arenaAlloc(16);
  const idx = new DataView(p.buffer, p.arenaData + i, 16);
  [0, 1, 2, 3].forEach((v, k) => idx.setUint32(k * 4, v, true));
  const v = p.arenaAlloc(80);
  p.emit('DRAW_UP', { prim: PRIM.TRIANGLESTRIP, layout: 5, index_size: 4, ioff: i, voff: v, count: 4, vcount: 4, stride: 20 });
  p.emit('CREATE', { id: 6, kind: KIND.RT, fmt: FMT.A8B8G8R8, levels: 1, width: 2, height: 2 });
  p.emit('SAMPLER', { id: 7, address_u: CONST.ADDR_MIRROR, address_v: CONST.ADDR_BORDER, min: 1, mag: 1, border: 0xff00ff00 });
  p.emit('BIND', { count: 1 }, packLayout('GpsBindEntry', { slot: 0, texture: 6, sampler: 7 }));
  const d = p.arenaAlloc(16);
  p.arenaView(d, 16).fill(0x55);
  p.emit('FENCE', { kind: CONST.FENCEK_OCCLUSION_BEGIN, slot: 2 });
  p.emit('FENCE', { kind: CONST.FENCEK_OCCLUSION_END, slot: 3, dst: d });
  const ring = p.ring();
  const ex = new GS.NullExecutor();
  GS.drain([ring], ex);
  assert.strictEqual(ex.stats().draws, 1);
  assert.deepStrictEqual(Array.from(p.arenaView(d, 4)), [0, 0, 0, 0], 'occlusion END writes its count');
  assert.deepStrictEqual(Array.from(p.arenaView(d + 4, 4)), [0x55, 0x55, 0x55, 0x55], 'and nothing past it');
  const caps = ring.caps();
  assert.ok(caps.flags & CONST.CAP_VALID, 'drain published the caps');
  assert.ok(caps.flags & CONST.CAP_STENCIL);
  assert.strictEqual(caps.formats, (1 << FMT.A8B8G8R8) | (1 << FMT.D16) | (1 << FMT.D24S8));
}
// SHADER may fill an id CREATEd as a shader, once.
{
  const p = makeProducer();
  p.emit('CREATE', { id: 4, kind: KIND.SHADER });
  p.emit('SHADER', { id: 4 });
  const ex = new GS.NullExecutor();
  GS.drain([p.ring()], ex);
  assert.strictEqual(ex.stats().records, 2);
}
// The page Presenter (the PRESENT sink): an older stamp is dropped, equal
// and newer stamps are shown (with u32 wrap), and a nonzero dst is refused
// until D2 implements window-relative presents.
{
  const { Presenter } = require('../lib/gpu-stream-host');
  const shown = [];
  const pr = new Presenter({ api: 'test', renderer: null, onPresent: (layer, f) => shown.push(f.stamp) });
  const surface = { width: 1, height: 1 };
  for (const stamp of [5, 6, 4, 6, 0xfffffff0]) pr.present({ surface, hwnd: 1, stamp });
  pr.stamp = 0xfffffffe; pr.present({ surface, hwnd: 1, stamp: 1 });
  assert.deepStrictEqual(shown, [5, 6, 6, 1]);
  assert.strictEqual(pr.stale, 2, 'stamps 4 and 0xfffffff0 after 6 were dropped');
  assert.throws(() => pr.present({ surface, hwnd: 1, stamp: 7, dstX: 2, dstY: 0 }), /dst offset/);
  assert.throws(() => pr.present({ surface, hwnd: 1, stamp: 7, dstX: 0, dstY: 3 }), /dst offset/);
}

console.log('test-gpu-stream-null: PASS');
