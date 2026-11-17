#!/usr/bin/env node
'use strict';
// 16-bit render targets on the GPU route (WAT GPU stream producer,
// src/09abg-d3dim-gps.wat). Every 16bpp target is an A8B8G8R8 GPU target:
// the DIB is widened on upload ($d3g_row_to_rgba: 1- and 4-bit alpha to 8
// bits, 565 to opaque) and narrowed on readback ($d3g_rgba_to_row), so an
// ordinary draw is one DRAW_UP with no per-primitive storage pass. That
// includes destination-alpha blending on A1R5G5B5 (format 3) and A4R4G4B4
// (format 4): the blend reads the alpha the DIB had, and the result is
// narrowed back into the DIB's alpha bits. On RGB565 there is no stored
// alpha, so DESTALPHA reads 1.
//
// Driven through the real seam: a DirectDraw surface + D3D device built by
// the WAT handlers, $d3dim_worker_try_draw -> $d3dim_gpu_call(0x20000) (the GPU stream
// producer, unconditional), the ring drained into lib/gpu-stream-software.js.
const assert = require('assert/strict');
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
    (call $d3dim_worker_try_draw (local.get $device) (local.get $prim) (local.get $vtype)
      (local.get $verts) (local.get $count))
    (i32.const 1))
  (func (export "test_gps_fence") (result i32)
    (call $d3dim_gpu_call (i32.const 0x20001) (i32.const 0) (i32.const 0)))
`;

(async () => {
  let ex, mem, sw = null, ring = null, ringAddr = 0, raster = null;
  const draws = [];
  const tee = {
    caps: () => sw.caps(),
    execute(rec) {
      if (rec.op === GS.OP.RASTER) raster = { ...rec.fields };
      if (rec.op === GS.OP.DRAW_UP) draws.push({ count: rec.fields.count, raster });
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
  // One surface per format: a GPU target is keyed by its DIB and format.
  const make = (fmt, slot) => {
    for (let i = 0; i < 128; i += 4) gw(DESC + i, 0);
    [[0, 108], [4, 0x1007], [8, W], [12, W], [72, 32], [76, 0x40], [84, 16],
      [88, 0xf800], [92, 0x07e0], [96, 0x001f], [104, 0x40]].forEach(([o, v]) => gw(DESC + o, v));
    assert.equal(ex.test_create_surface(DESC, OUT + slot * 8) >>> 0, 0);
    const s = gr(OUT + slot * 8);
    ex.test_set_fmt(s, fmt);
    assert.equal(ex.test_create_device(s, OUT + slot * 8 + 4) >>> 0, 0);
    const device = gr(OUT + slot * 8 + 4);
    ex.test_set_rs(device, 22, 1);  // no culling
    return { s, device, dib: ex.test_dib(s) >>> 0 };
  };
  // count opaque-red triangles covering the whole target, in one draw.
  const putTris = (count, color) => {
    for (let t = 0; t < count; t++) [[-1, -1], [2 * W, -1], [-1, 2 * W]].forEach(([x, y], i) => {
      const o = VERTS + (t * 3 + i) * 32;
      gf(o, x); gf(o + 4, y); gf(o + 8, 0.5); gf(o + 12, 1); gw(o + 16, color); gw(o + 20, 0);
      gf(o + 24, 0); gf(o + 28, 0);
    });
  };
  function run({ fmt, blend, left, right, count = 5, slot }) {
    const { device, dib } = make(fmt, slot);
    const dv = new DataView(mem.buffer);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++)
      dv.setUint16(dib + (y * W + x) * 2, x < W / 2 ? left : right, true);
    ex.test_set_rs(device, 27, blend ? 1 : 0);
    if (blend) { ex.test_set_rs(device, 19, blend[0]); ex.test_set_rs(device, 20, blend[1]); }
    putTris(count, 0xffff0000);
    const d0 = draws.length;
    assert.equal(ex.test_gpu_draw(device, 4, 3, VERTS, count * 3), 1, `format ${fmt} draw is taken on the GPU`);
    assert.equal(ex.test_gps_fence(), 1);
    const got = draws.slice(d0);
    return { draws: got.length, vertices: got.reduce((n, d) => n + d.count, 0), blend: got[0].raster.blend,
      left: dv.getUint16(dib + (1 * W + 1) * 2, true), right: dv.getUint16(dib + (1 * W + W - 2) * 2, true) };
  }

  const opaque = null;
  const alphaBlend = [5, 6];   // SRCALPHA / INVSRCALPHA
  const destAlpha = [7, 8];    // DESTALPHA / INVDESTALPHA
  let slot = 0;
  // Full colour, one draw for all five triangles, no storage pass.
  const RED = { 1: 0xf800, 2: 0x7c00, 3: 0xfc00, 4: 0xff00 };
  for (const fmt of [1, 2, 3, 4]) {
    for (const blend of [opaque, alphaBlend]) {
      const r = run({ fmt, blend, left: 0, right: 0, slot: slot++ });
      assert.deepEqual([r.draws, r.vertices], [1, 15], `format ${fmt} ${JSON.stringify(blend)}: one draw`);
      if (!blend) assert.equal(r.left, RED[fmt], `format ${fmt}: opaque red lands narrowed`);
    }
  }
  // Destination alpha on RGB565: no stored alpha, DESTALPHA reads 1.
  let r = run({ fmt: 1, blend: destAlpha, left: 0, right: 0, slot: slot++ });
  assert.deepEqual([r.draws, r.left, r.right], [1, 0xf800, 0xf800], 'RGB565 DESTALPHA reads opaque');
  // A1R5G5B5 / A4R4G4B4: the blend reads the DIB's own alpha (left half set,
  // right half clear) and writes it back narrowed.
  r = run({ fmt: 3, blend: destAlpha, left: 0x8000, right: 0x0000, slot: slot++ });
  assert.deepEqual([r.draws, r.vertices, r.blend], [1, 15, 1], 'A1R5G5B5 DESTALPHA stays on the GPU in one draw');
  assert.equal(r.left, 0xfc00, 'A1 set: source red, alpha kept');
  assert.equal(r.right, 0x0000, 'A1 clear: destination kept');
  r = run({ fmt: 4, blend: destAlpha, left: 0xf000, right: 0x0000, slot: slot++ });
  assert.deepEqual([r.draws, r.vertices, r.blend], [1, 15, 1], 'A4R4G4B4 DESTALPHA stays on the GPU in one draw');
  assert.equal(r.left, 0xff00, 'A4 opaque: source red, alpha kept');
  assert.equal(r.right, 0x0000, 'A4 clear: destination kept');
  console.log('PASS 16-bit GPU targets: one draw per call, alpha widened on upload and narrowed on readback, DESTALPHA on A1/A4');
})().catch(e => { console.error(e.stack || e); process.exit(1); });
