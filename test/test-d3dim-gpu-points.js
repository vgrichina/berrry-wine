#!/usr/bin/env node
// D3DPT_POINTLIST on the GPU route: the WAT GPU stream producer
// (src/09abg-d3dim-gps.wat, $d3g_points) lowers each point the way
// viewport_fill_rect paints it -- a rounded 2x2 diffuse overwrite, clipped to
// the surface, no texture, blend, fog or alpha test, depth per ZENABLE (NaN
// depth dropped, other depth clamped to [0,1]) -- and keeps every target it
// cannot reproduce exactly (32-bit, 555, 1555, 4444) in software.
//
// Driven through the real seam: DirectDraw surfaces + a D3D device built by
// the WAT handlers, $d3dim_worker_try_draw -> $d3dim_gpu_call(0x20000) with
// $d3dim_gpu_on = 1, the ring drained into lib/gpu-stream-software.js. The
// test reads the DRAW_UP vertices, RASTER/BIND state and READBACK rects the
// executor sees, and the RGB565 pixels the fence lands in the DIB.
'use strict';
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
  (func (export "test_set_fmt") (param $surface i32) (param $fmt i32)
    (call $dx_surf_fmt_set (call $dx_from_this (local.get $surface)) (local.get $fmt)))
  (func (export "test_set_rs") (param $device i32) (param $state i32) (param $value i32)
    (call $d3dim_set_render_state (local.get $device) (local.get $state) (local.get $value)))
  (func (export "test_gpu_draw") (param $device i32) (param $prim i32) (param $vtype i32)
      (param $verts i32) (param $count i32) (result i32)
    (global.set $d3dim_gpu_on (i32.const 1))
    (call $d3dim_worker_try_draw (local.get $device) (local.get $prim) (local.get $vtype)
      (local.get $verts) (local.get $count)))
  (func (export "test_gps_fence") (result i32)
    (global.set $d3dim_gpu_on (i32.const 1))
    (call $d3dim_gpu_call (i32.const 0x20001) (i32.const 0) (i32.const 0)))
`;

(async () => {
  let ex, mem, sw = null, ring = null, ringAddr = 0, raster = null, bind = null;
  const draws = [], readbacks = [];
  const tee = {
    caps: () => sw.caps(),
    execute(rec) {
      const f = rec.fields;
      if (rec.op === GS.OP.RASTER) raster = { ...f };
      if (rec.op === GS.OP.BIND) bind = GS.decodeBind(rec);
      if (rec.op === GS.OP.READBACK) readbacks.push([f.x, f.y, f.w, f.h]);
      if (rec.op === GS.OP.DRAW_UP) {
        const b = Buffer.from(rec.arena(f.voff, f.count * f.stride));
        draws.push({ prim: f.prim, stride: f.stride, count: f.count, raster, bind,
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

  const DESC = 0x410000, OUT = 0x410100, VERTS = 0x411000, W = 8;
  ex.test_seed(0x51000000, 0x52000000, 0x53000000);
  function surface(bpp, slot) {
    for (let i = 0; i < 128; i += 4) gw(DESC + i, 0);
    const masks = bpp === 16 ? [0xf800, 0x07e0, 0x001f] : [0xff0000, 0xff00, 0xff];
    [[0, 108], [4, 0x1007], [8, W], [12, W], [72, 32], [76, 0x40], [84, bpp],
      [88, masks[0]], [92, masks[1]], [96, masks[2]], [104, 0x40]].forEach(([o, v]) => gw(DESC + o, v));
    assert.strictEqual(ex.test_create_surface(DESC, OUT + slot * 8) >>> 0, 0);
    const s = gr(OUT + slot * 8);
    assert.strictEqual(ex.test_create_device(s, OUT + slot * 8 + 4) >>> 0, 0);
    return { surface: s, device: gr(OUT + slot * 8 + 4) };
  }
  const { surface: rt, device } = surface(16, 0);
  const dib = ex.test_dib(rt) >>> 0;
  const px = (x, y) => new DataView(mem.buffer).getUint16(dib + (y * W + x) * 2, true);
  const clearDib = () => new Uint8Array(mem.buffer, dib, W * W * 2).fill(0);

  // Render states that points must ignore: blend, fog, alpha test, cull.
  ex.test_set_rs(device, 27, 1); ex.test_set_rs(device, 19, 5); ex.test_set_rs(device, 20, 6);
  ex.test_set_rs(device, 28, 1); ex.test_set_rs(device, 15, 1); ex.test_set_rs(device, 25, 7);
  ex.test_set_rs(device, 24, 255); ex.test_set_rs(device, 22, 3);
  const writePoints = (points, prim = 1, base = 0) => points.forEach(([x, y, color = 0x00123456, z = NaN], i) => {
    const o = VERTS + (base + i) * 32;
    gf(o, x); gf(o + 4, y); gf(o + 8, z); gf(o + 12, -1);
    gw(o + 16, color); gw(o + 20, 0); gf(o + 24, 0.25); gf(o + 28, 0.75);
  });
  const draw = (points) => {
    writePoints(points);
    const from = draws.length;
    const r = ex.test_gpu_draw(device, 1, 3, VERTS, points.length);
    return { r, from };
  };
  const quads = list => list.flatMap(d => Array.from({ length: d.count }, (_, i) => {
    const o = i * d.stride;
    return { x: d.dv.getFloat32(o, true), y: d.dv.getFloat32(o + 4, true), z: d.dv.getFloat32(o + 8, true),
      rhw: d.dv.getFloat32(o + 12, true), color: d.dv.getUint32(o + 16, true),
      u: d.dv.getFloat32(o + 24, true), v: d.dv.getFloat32(o + 28, true) };
  }));

  // Rounding, clipping to the surface, a non-finite point dropped.
  clearDib();
  let { r, from } = draw([[0.49, 0.5], [6.4, 6.49], [NaN, Infinity]]);
  assert.strictEqual(r, 1, 'points are taken on the GPU');
  const statPoints = ex.d3dim_gps_stat(12);
  assert.strictEqual(statPoints, 3, 'every submitted point is counted');
  let rb = readbacks.length;
  assert.strictEqual(ex.test_gps_fence(), 1);
  let got = draws.slice(from);
  assert.strictEqual(got.length, 1, 'one DRAW_UP for the call');
  assert.strictEqual(got[0].prim, GS.CONST.PRIM_TRIANGLELIST);
  let v = quads(got);
  assert.deepStrictEqual(v.map(p => [p.x, p.y]),
    [[-.5, .5], [1.5, .5], [-.5, 2.5], [1.5, .5], [1.5, 2.5], [-.5, 2.5],
     [5.5, 5.5], [7.5, 5.5], [5.5, 7.5], [7.5, 5.5], [7.5, 7.5], [5.5, 7.5]],
    'two 2x2 quads at the rounded positions; the Infinity row is off the surface');
  assert(v.every(p => p.z === 0 && p.rhw === 1 && p.color === 0x00123456 && p.u === 0 && p.v === 0),
    'depth off: z 0, rhw 1, raw diffuse, no texture coordinates');
  const ra = got[0].raster;
  assert.deepStrictEqual([ra.depth_mode, ra.zwrite, ra.blend, ra.alpha_func, ra.cull],
    [0, 0, 0, 8, 1], 'no depth, blend, alpha test or culling');
  assert(got[0].bind.every(b => b.texture === 0), 'points bind no texture');
  assert.deepStrictEqual(readbacks.slice(rb), [[0, 1, 8, 7]], 'the fence reads back only the points\' bounds');
  const C = (2 << 11) | (13 << 5) | 10;  // 0x123456 in RGB565
  for (const [x, y] of [[0, 1], [1, 1], [0, 2], [1, 2], [6, 6], [7, 6], [6, 7], [7, 7]])
    assert.strictEqual(px(x, y), C, `point pixel (${x},${y})`);
  for (const [x, y] of [[2, 1], [0, 0], [0, 3], [5, 6], [3, 3]])
    assert.strictEqual(px(x, y), 0, `outside the points (${x},${y})`);

  // A fully clipped point is accepted with nothing drawn; NaN position is 0
  // (WAT saturating conversion).
  ({ r, from } = draw([[Infinity, -Infinity]]));
  assert.strictEqual(r, 1, 'fully clipped operation is accepted without pixels');
  assert.strictEqual(ex.test_gps_fence(), 1);
  assert.strictEqual(draws.length, from, 'and writes no draw');
  rb = readbacks.length;
  ({ r, from } = draw([[NaN, NaN]]));
  assert.strictEqual(r, 1);
  ex.test_gps_fence();
  assert.deepStrictEqual(readbacks.slice(rb), [[0, 0, 2, 2]], 'NaN position rounds to 0');

  // ZENABLE: points are depth-tested and written like triangles. Thief II's
  // sky stars (sz=0.99995, LESSEQUAL, ZWRITE) must not show through walls.
  ex.test_set_rs(device, 7, 1); ex.test_set_rs(device, 23, 4); ex.test_set_rs(device, 14, 1);
  ({ r, from } = draw([[1, 1, 0x00ff0000, 0.99995], [3, 3, 0x0000ff00, NaN],
    [5, 5, 0x000000ff, 2], [6, 1, 0x00ffffff, -1]]));
  assert.strictEqual(r, 1);
  ex.test_gps_fence();
  got = draws.slice(from); v = quads(got);
  assert.strictEqual(v.length, 3 * 6, 'NaN-depth point dropped');
  assert.deepStrictEqual([0, 6, 12].map(n => v[n].z), [Math.fround(0.99995), 1, 0], 'depth clamps to [0,1]');
  assert.deepStrictEqual([got[0].raster.depth_mode !== 0, got[0].raster.zfunc, got[0].raster.zwrite, got[0].raster.blend],
    [true, 4, 1, 0], 'depth tested and written, still no blend');
  ex.test_set_rs(device, 23, 2); ex.test_set_rs(device, 14, 0);
  ({ r, from } = draw([[1, 1, 0x00ff0000, 0.5]]));
  assert.strictEqual(r, 1);
  ex.test_gps_fence();
  assert.deepStrictEqual([draws[from].raster.zfunc, draws[from].raster.zwrite], [2, 0], 'read-only depth');

  // The wall: a z=0.5 triangle, then a star at z=0.99995 behind it.
  ex.test_set_rs(device, 23, 4); ex.test_set_rs(device, 14, 1); ex.test_set_rs(device, 27, 0);
  ex.test_set_rs(device, 15, 0); ex.test_set_rs(device, 22, 1); ex.test_set_rs(device, 28, 0);
  [[-1, -1], [20, -1], [-1, 20]].forEach(([x, y], i) => {
    const o = VERTS + i * 32;
    gf(o, x); gf(o + 4, y); gf(o + 8, 0.5); gf(o + 12, 1); gw(o + 16, 0xff00ff00); gw(o + 20, 0);
    gf(o + 24, 0); gf(o + 28, 0);
  });
  assert.strictEqual(ex.test_gpu_draw(device, 4, 3, VERTS, 3), 1, 'the wall is drawn on the GPU');
  ({ r } = draw([[4, 4, 0x00ff0000, 0.99995]]));
  assert.strictEqual(r, 1);
  ex.test_gps_fence();
  assert.strictEqual(px(4, 4), 0x07e0, 'the star behind the wall fails the depth test');

  // Targets the producer cannot reproduce exactly stay in software.
  ex.test_set_rs(device, 7, 0);
  const statsBefore = ex.d3dim_gps_stat(12);
  for (const fmt of [2, 3, 4]) {
    ex.test_set_fmt(rt, fmt);
    assert.strictEqual(draw([[1, 1]]).r, 0, `16-bit format ${fmt} points stay in software`);
  }
  ex.test_set_fmt(rt, 1);
  const wide = surface(32, 1);
  writePoints([[1, 1, 0xff123456]]);
  assert.strictEqual(ex.test_gpu_draw(wide.device, 1, 3, VERTS, 1), 0, '32-bit points stay in software');
  assert.strictEqual(ex.d3dim_gps_stat(12), statsBefore, 'declined points are not counted as drawn');
  assert.strictEqual(draw([[2, 2]]).r, 1, 'RGB565 is taken again');
  console.log('PASS D3DIM point lowering in the WAT producer: rounding, clipping, depth, state independence, software formats');
})().catch(e => { console.error(e.stack || e); process.exit(1); });
