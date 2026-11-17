#!/usr/bin/env node
// A TL vertex's sz is only a depth value. With ZENABLE and ZWRITEENABLE both
// off it decides nothing, and the software rasterizer ignores it; a GPU still
// clips anything outside [0,1]. The DX SDK Flip3DTL sample draws its cube at
// sz=300 with the z buffer off, so on the GPU route every triangle vanished
// while the software arm drew it. The WAT GPU stream producer
// (src/09abg-d3dim-gps.wat, $d3g_draw) clamps sz into range when depth is
// off and leaves it alone when a depth test is in play.
//
// Driven through the real seam: a DirectDraw surface + D3D device built by
// the WAT handlers, $d3dim_worker_try_draw -> $d3dim_gpu_call(0x20000) (the GPU stream
// producer, unconditional), the ring drained into lib/gpu-stream-software.js. The
// DRAW_UP vertices are read from the ring arena as the executor sees them.
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
  let ex, mem, sw = null, ring = null, ringAddr = 0;
  const records = [];
  const tee = {
    caps: () => sw.caps(),
    execute(rec) {
      if (rec.op === GS.OP.DRAW_UP) {
        const f = rec.fields, bytes = Buffer.from(rec.arena(f.voff, f.count * f.stride));
        records.push({ prim: f.prim, stride: f.stride, count: f.count, dv: new DataView(bytes.buffer, bytes.byteOffset, bytes.length) });
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

  const DESC = 0x410000, OUT = 0x410100, VERTS = 0x411000, W = 64;
  ex.test_seed(0x51000000, 0x52000000, 0x53000000);
  for (let i = 0; i < 128; i += 4) gw(DESC + i, 0);
  [[0, 108], [4, 0x1007], [8, W], [12, W], [72, 32], [76, 0x40], [84, 16],
    [88, 0xf800], [92, 0x07e0], [96, 0x001f], [104, 0x40]].forEach(([o, v]) => gw(DESC + o, v));
  assert.strictEqual(ex.test_create_surface(DESC, OUT) >>> 0, 0);
  const rt = gr(OUT);
  assert.strictEqual(ex.test_create_device(rt, OUT + 4) >>> 0, 0);
  const device = gr(OUT + 4);

  // ZENABLE (7), ZWRITEENABLE (14) and a vertex list; returns sz per vertex.
  function run(zenable, zwrite, zs, primitive = 4, vertexType = 3) {
    ex.test_set_rs(device, 7, zenable);
    ex.test_set_rs(device, 14, zwrite);
    zs.forEach((z, i) => {
      const o = VERTS + i * 32;
      gf(o, 10 * i); gf(o + 4, 20 + i); gf(o + 8, z); gf(o + 12, 1);
      gw(o + 16, [0xffff0000, 0xff00ff00, 0xff0000ff, 0xffffffff][i % 4]);
      gw(o + 20, 0); gf(o + 24, 0); gf(o + 28, 0);
    });
    const from = records.length;
    const accepted = ex.test_gpu_draw(device, primitive, vertexType, VERTS, zs.length);
    assert.strictEqual(ex.test_gps_fence(), 1, 'the fence drains the draw');
    const draws = records.slice(from);
    if (!accepted || !draws.length) return { accepted, draws };
    assert.strictEqual(draws.length, 1, 'one DRAW_UP per accepted draw');
    const d = draws[0], n = d.count;
    const at = (i, off) => d.dv.getFloat32(i * d.stride + off, true);
    return { accepted, draw: d,
      depths: Array.from({ length: n }, (_, i) => at(i, 8)),
      xs: Array.from({ length: n }, (_, i) => at(i, 0)),
      colors: Array.from({ length: n }, (_, i) => d.dv.getUint32(i * d.stride + 16, true)) };
  }

  // Depth off: sz = 300 (Flip3DTL), negative and in-range values all land in [0,1].
  const off = run(0, 0, [300, -2, 0.25]);
  assert.strictEqual(off.draw.prim, GS.CONST.PRIM_TRIANGLELIST);
  assert.deepStrictEqual(off.depths, [1, 0, 0.25], `depth-off sz clamps into range: ${off.depths}`);

  // Prepared supplied-projection geometry (vertex type 4) is untransformed at
  // the public API: near/far clipping must survive depth-off.
  assert.deepStrictEqual(run(0, 0, [-0.5, 1.5, 0.25], 4, 4).depths,
    [-0.5, 1.5, 0.25], 'type 4 preserves geometric clip Z with depth disabled');

  // Depth test on: sz is the depth value and is passed through untouched.
  const on = run(1, 1, [300, -2, 0.25]).depths;
  assert.deepStrictEqual(on, [300, -2, 0.25], `depth-on sz is unchanged: ${on}`);
  // ZENABLE with no write is still a depth test.
  assert.deepStrictEqual(run(1, 0, [1.5, 0.5, 0.75]).depths, [1.5, 0.5, 0.75], 'z test without write keeps sz');

  // NFS III submits two-vertex line strips. Longer strips must also preserve
  // every adjacent segment and use each segment's first colour, not
  // interpolate colours or connect the end of a line list to the next line.
  const R = 0xffff0000, G = 0xff00ff00, B = 0xff0000ff;
  for (const [primitive, count, expectedX, expectedColor] of [
    [3, 2, [0, 10], [R, R]],
    [3, 4, [0, 10, 10, 20, 20, 30], [R, R, G, G, B, B]],
    [2, 3, [0, 10], [R, R]],
  ]) {
    const result = run(1, 1, Array(count).fill(NaN), primitive);
    assert.strictEqual(result.accepted, 1, `line primitive ${primitive} x${count} is taken`);
    assert.strictEqual(result.draw.prim, GS.CONST.PRIM_LINELIST);
    assert.strictEqual(result.draw.count, expectedX.length);
    assert.deepStrictEqual(result.xs, expectedX);
    assert.deepStrictEqual(result.colors, expectedColor);
    assert(result.depths.every(Number.isFinite), 'unused line Z must not clip the segment');
  }
  for (const count of [0, 1]) {
    const result = run(0, 0, Array(count).fill(0), 3);
    assert.strictEqual(result.draws.length, 0, 'an incomplete strip draws nothing and writes no draw record');
  }
  console.log('test-d3dim-gpu-depthless-z: OK');
})().catch(e => { console.error(e.stack || e); process.exit(1); });
