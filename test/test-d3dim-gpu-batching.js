#!/usr/bin/env node
'use strict';
// D3DIM draws on the GPU route, through the WAT GPU stream producer
// (src/09abg-d3dim-gps.wat): what each accepted draw covers, and the order
// its records reach the executor.
//
//   - Coverage is the dirty rect a later CPU reader reads back: the draw's
//     vertex bounds padded by two pixels and clipped to the target; points
//     their exact 2x2 rects; a line list excludes its unused trailing vertex;
//     a vertex with rhw <= 0 (or non-finite x/y) makes it the whole target;
//     fully clipped geometry and a declined shape add nothing.
//   - Records keep draw order: overlapping transparent draws blend in
//     submission order, a state change gives the next draw its own RASTER,
//     and a clear lands after the draws before it.
//   - A large draw is cut into whole primitives and never changes their
//     total count.
//
// Driven through the real seam: a DirectDraw surface + D3D device built by
// the WAT handlers, $d3dim_worker_try_draw -> $d3dim_gpu_call(0x20000) (the GPU stream
// producer, unconditional), the ring drained into lib/gpu-stream-software.js.
const assert = require('assert');
const GS = require('../lib/gpu-stream');
const { Executor: SoftwareExecutor } = require('../lib/gpu-stream-software');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_seed") (param $ddraw i32) (param $surf i32) (param $dev i32)
    (global.set $DX_VTBL_DDRAW (local.get $ddraw))
    (global.set $DX_VTBL_DDSURF2 (local.get $surf))
    (global.set $DX_VTBL_D3DDEV1 (local.get $dev)))
  (func (export "test_create_surface") (param $desc i32) (param $out i32) (result i32)
    (local $ddraw i32)
    (local.set $ddraw (call $dx_create_com_obj (i32.const 1) (global.get $DX_VTBL_DDRAW)))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDraw_CreateSurface (local.get $ddraw) (local.get $desc) (local.get $out)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_create_device") (param $surface i32) (param $out i32) (result i32)
    (call $d3dim_create_device (i32.const 0) (local.get $surface) (local.get $out) (global.get $DX_VTBL_D3DDEV1))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_dib") (param $surface i32) (result i32)
    (i32.load offset=20 (call $dx_from_this (local.get $surface))))
  (func (export "test_set_rs") (param $device i32) (param $state i32) (param $value i32)
    (call $d3dim_set_render_state (local.get $device) (local.get $state) (local.get $value)))
  (func (export "test_gpu_draw") (param $device i32) (param $prim i32) (param $vtype i32)
      (param $verts i32) (param $count i32) (result i32)
    (call $d3dim_worker_try_draw (local.get $device) (local.get $prim) (local.get $vtype)
      (local.get $verts) (local.get $count))
    (i32.const 1))
  ;; A whole-surface D3DCLEAR_TARGET of $color through the producer's 0x20004.
  (func (export "test_gpu_clear") (param $this i32) (param $color i32) (result i32)
    (local $entry i32) (local $ga i32) (local $d i32) (local $r i32)
    (local.set $entry (call $dx_from_this (local.get $this)))
    (local.set $ga (call $heap_alloc (i32.const 64)))
    (local.set $d (call $g2w (local.get $ga)))
    (memory.fill (local.get $d) (i32.const 0) (i32.const 64))
    (i32.store offset=0 (local.get $d) (local.get $entry))
    (i32.store offset=4 (local.get $d) (i32.const 1))
    (i32.store offset=8 (local.get $d) (local.get $color))
    (i32.store offset=24 (local.get $d) (load.field DxObject width (local.get $entry)))
    (i32.store offset=28 (local.get $d) (load.field DxObject height (local.get $entry)))
    (local.set $r (call $d3dim_gpu_call (i32.const 0x20004) (local.get $d) (i32.const 0)))
    (call $heap_free (local.get $ga))
    (local.get $r))
  (func (export "test_gps_fence") (result i32)
    (call $d3dim_gpu_call (i32.const 0x20001) (i32.const 0) (i32.const 0)))
`;

(async () => {
  let ex, mem, sw = null, ring = null, ringAddr = 0, raster = null;
  const ops = [], draws = [], readbacks = [];
  const tee = {
    caps: () => sw.caps(),
    execute(rec) {
      const f = rec.fields;
      ops.push(rec.name);
      if (rec.op === GS.OP.RASTER) raster = { ...f };
      if (rec.op === GS.OP.READBACK) readbacks.push([f.x, f.y, f.w, f.h]);
      if (rec.op === GS.OP.DRAW_UP) {
        const b = Buffer.from(rec.arena(f.voff, f.count * f.stride));
        draws.push({ prim: f.prim, stride: f.stride, count: f.count, raster, seq: rec.seq,
          dv: new DataView(b.buffer, b.byteOffset, b.length) });
      }
      sw.execute(rec);
    },
  };
  const harness = await bootRenderHarness({ fonts: 'none', extraWat, extraHostOverrides: {
    gpu_stream_kick: (addr, mode) => {
      addr >>>= 0;
      if (!sw) sw = new SoftwareExecutor({ getExports: () => ex, getMemory: () => mem.buffer });
      if (!ring || ringAddr !== addr) { ring = new GS.Ring(() => mem.buffer, addr); ringAddr = addr; }
      GS.drain([ring], tee);
      if ((mode | 0) === GS.CONST.KICK_CLOSE) { sw.close(); sw = null; ring = null; ringAddr = 0; }
      return 1;
    },
  } });
  ex = harness.exports; mem = harness.memory;
  const gw = (a, v) => ex.guest_write32(a, v >>> 0), gr = a => ex.guest_read32(a) >>> 0;
  const f32 = new DataView(new ArrayBuffer(4));
  const gf = (a, v) => { f32.setFloat32(0, v, true); gw(a, f32.getUint32(0, true)); };

  const DESC = 0x410000, OUT = 0x410100, VERTS = 0x420000, W = 32;
  ex.test_seed(0x51000000, 0x52000000, 0x53000000);
  for (let i = 0; i < 128; i += 4) gw(DESC + i, 0);
  [[0, 108], [4, 0x1007], [8, W], [12, W], [72, 32], [76, 0x40], [84, 16],
    [88, 0xf800], [92, 0x07e0], [96, 0x001f], [104, 0x40]].forEach(([o, v]) => gw(DESC + o, v));
  assert.strictEqual(ex.test_create_surface(DESC, OUT) >>> 0, 0);
  const rt = gr(OUT);
  assert.strictEqual(ex.test_create_device(rt, OUT + 4) >>> 0, 0);
  const device = gr(OUT + 4);
  const dib = ex.test_dib(rt) >>> 0;
  const px = (x, y) => new DataView(mem.buffer).getUint16(dib + (y * W + x) * 2, true);
  ex.test_set_rs(device, 22, 1);  // no culling: winding is not under test

  // vertices: [x, y, color = opaque white, rhw = 1]
  const put = (verts) => verts.forEach(([x, y, color = 0xffffffff, rhw = 1], i) => {
    const o = VERTS + i * 32;
    gf(o, x); gf(o + 4, y); gf(o + 8, 0.5); gf(o + 12, rhw);
    gw(o + 16, color); gw(o + 20, 0); gf(o + 24, 0); gf(o + 28, 0);
  });
  const draw = (prim, verts, count = verts.length) => { put(verts); return ex.test_gpu_draw(device, prim, 3, VERTS, count); };
  // Draw, fence, and return the rects the fence read back.
  const covered = (prim, verts, count) => {
    const rb = readbacks.length, d = draws.length;
    const r = draw(prim, verts, count);
    assert.strictEqual(ex.test_gps_fence(), 1);
    return { r, rects: readbacks.slice(rb), draws: draws.slice(d) };
  };
  const tri = (x, y, color) => [[x, y, color], [x + 2, y + 1, color], [x + 1, y + 2, color]];

  // ---- Coverage ----
  let c = covered(4, tri(10, 10));
  assert.strictEqual(c.r, 1);
  assert.deepStrictEqual(c.rects, [[8, 8, 6, 6]], 'triangle bounds padded by two pixels');
  c = covered(4, tri(0, 29));
  assert.deepStrictEqual(c.rects, [[0, 27, 4, 5]], 'clipped to the target');
  c = covered(1, [[3, 4], [20.4, 6.6]]);
  // (3,4) -> [3,5)x[4,6); (20.4,6.6) rounds to (20,7) -> [20,22)x[7,9).
  assert.deepStrictEqual(c.rects, [[3, 4, 19, 5]], 'points publish their exact rects (union)');
  c = covered(2, [[4, 4], [6, 6], [30, 30]]);
  assert.strictEqual(c.r, 1);
  assert.strictEqual(c.draws[0].count, 2, 'line list draws one segment');
  assert.deepStrictEqual(c.rects, [[2, 2, 6, 6]], 'line list excludes the unused trailing vertex');
  c = covered(4, [[10, 10], [12, 11, 0xffffffff, -1], [11, 12]]);
  assert.deepStrictEqual(c.rects, [[0, 0, W, W]], 'rhw <= 0 uses the whole target');
  c = covered(4, [[10, 10], [NaN, 11], [11, 12]]);
  assert.deepStrictEqual(c.rects, [[0, 0, W, W]], 'non-finite position uses the whole target');
  c = covered(4, tri(100, 100));
  assert.strictEqual(c.r, 1, 'fully clipped geometry is accepted');
  assert.deepStrictEqual(c.rects, [], 'and adds no coverage');
  c = covered(4, tri(10, 10), 2);
  assert.deepStrictEqual([c.rects, c.draws], [[], []], 'an incomplete triangle draws nothing: no records or coverage');
  // With no dirty pixels the fences above had nothing to read back, so the
  // clipped draw's record is still queued; the next readback drains it, in
  // order, ahead of the draw that dirtied the target.
  c = covered(4, tri(10, 10));
  assert.deepStrictEqual(c.draws.map(d => d.dv.getFloat32(0, true)), [100, 10], 'queued clipped draw, then this one');
  assert.deepStrictEqual(c.rects, [[8, 8, 6, 6]]);

  // ---- Order ----
  // Transparent draws keep submission order: half red, then half green
  // over black leaves more green than red at the overlap.
  ex.test_set_rs(device, 27, 1); ex.test_set_rs(device, 19, 5); ex.test_set_rs(device, 20, 6);
  new Uint8Array(mem.buffer, dib, W * W * 2).fill(0);
  const big = (color) => [[0, 0, color], [W, 0, color], [0, W, color]];
  let d0 = draws.length;
  assert.strictEqual(draw(4, big(0x80ff0000)), 1);
  assert.strictEqual(draw(4, big(0x8000ff00)), 1);
  ex.test_set_rs(device, 27, 0);
  assert.strictEqual(draw(4, tri(20, 2, 0xff0000ff)), 1);
  ex.test_gps_fence();
  const seq = draws.slice(d0);
  assert.strictEqual(seq.length, 3, 'one DRAW_UP per draw');
  assert(seq[0].seq < seq[1].seq && seq[1].seq < seq[2].seq, 'records in submission order');
  assert.deepStrictEqual(seq.map(d => d.raster.blend), [1, 1, 0], 'a state change gives the next draw its own RASTER');
  const p = px(4, 4), r5 = p >> 11, g6 = (p >> 5) & 63;
  assert(r5 > 0 && g6 > 0 && g6 / 63 > r5 / 31, `green blended over red, not the reverse (0x${p.toString(16)})`);
  // A clear after draws lands after them.
  let o0 = ops.length;
  assert.strictEqual(draw(4, tri(4, 4, 0xffff0000)), 1);
  assert.strictEqual(ex.test_gpu_clear(rt, 0xff0000ff), 1, 'a target the GPU drew on clears on the GPU');
  ex.test_gps_fence();
  const order = ops.slice(o0).filter(n => n === 'DRAW_UP' || n === 'CLEAR');
  assert.deepStrictEqual(order, ['DRAW_UP', 'CLEAR'], 'the clear follows the draw before it');
  assert.strictEqual(px(5, 5), 0x001f, 'the clear wins');

  // ---- A large draw keeps every primitive ----
  const N = 1400, prims = ex.d3dim_gps_stat(15);
  const many = [];
  for (let i = 0; i < N; i++) many.push(...tri(i % 28, (i * 7) % 28, 0xff00ff00));
  d0 = draws.length;
  assert.strictEqual(draw(4, many), 1);
  ex.test_gps_fence();
  assert.strictEqual(ex.d3dim_gps_stat(15) - prims, N, 'primitive counter');
  assert.strictEqual(draws.slice(d0).reduce((n, d) => n + d.count, 0), 3 * N, 'every vertex reaches the executor');
  assert(draws.slice(d0).every(d => d.count % 3 === 0), 'cut on whole triangles');
  console.log('PASS D3DIM GPU producer: coverage rects, point/line/rhw/clip bounds, record order, state, clear order, primitive count');
})().catch(e => { console.error(e.stack || e); process.exit(1); });
