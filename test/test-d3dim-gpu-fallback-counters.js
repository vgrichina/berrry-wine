#!/usr/bin/env node
'use strict';
// D3DIM GPU-route fallback accounting in the WAT GPU stream producer
// (src/09abg-d3dim-gps.wat). Every 0x20000 draw the producer hands back to
// the software rasterizer counts once in d3dim_gps_stat 14 (declined draws);
// a draw or clear whose SHAPE was fine but whose STATE the GPU cannot
// reproduce also counts once in stat 1 (fallbacks), by reason
// (d3dim_gps_stat 35 + why, $d3g_decline). Shape rejections (primitive,
// vertex type, count) stop before describe and count only as declined. An
// accepted draw counts in stat 0 and never as a fallback; a clear of a
// target the GPU never drew on is declined without counting as a fallback.
//
// Driven through the real seam: DirectDraw surfaces + D3D devices built by
// the WAT handlers, $d3dim_worker_try_draw -> $d3dim_gpu_call(0x20000) with
// $d3dim_gpu_on = 1, the ring drained into lib/gpu-stream-software.js.
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
  (func (export "test_get_handle") (param $api i32) (param $texture i32) (param $device i32) (param $out i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $dispatch_api_table (local.get $api) (local.get $texture) (local.get $device)
      (local.get $out) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_dib") (param $surface i32) (result i32)
    (i32.load offset=20 (call $dx_from_this (local.get $surface))))
  (func (export "test_set_rs") (param $device i32) (param $state i32) (param $value i32)
    (call $d3dim_set_render_state (local.get $device) (local.get $state) (local.get $value)))
  (func (export "test_set_tss") (param $device i32) (param $type i32) (param $value i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirect3DDevice3_SetTextureStageState (local.get $device) (i32.const 0)
      (local.get $type) (local.get $value) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_gpu_draw") (param $device i32) (param $prim i32) (param $vtype i32)
      (param $verts i32) (param $count i32) (result i32)
    (global.set $d3dim_gpu_on (i32.const 1))
    (call $d3dim_worker_try_draw (local.get $device) (local.get $prim) (local.get $vtype)
      (local.get $verts) (local.get $count)))
  ;; A whole-surface D3DCLEAR_TARGET through the producer's 0x20004; with
  ;; $bg, a background-image clear whose texture words (+32..+52) are
  ;; $tex, 0, 0, 0.
  (func (export "test_gpu_clear") (param $this i32) (param $bg i32) (param $tex i32) (result i32)
    (local $entry i32) (local $ga i32) (local $d i32) (local $r i32)
    (global.set $d3dim_gpu_on (i32.const 1))
    (local.set $entry (call $dx_from_this (local.get $this)))
    (local.set $ga (call $heap_alloc (i32.const 64)))
    (local.set $d (call $g2w (local.get $ga)))
    (memory.fill (local.get $d) (i32.const 0) (i32.const 64))
    (i32.store offset=0 (local.get $d) (local.get $entry))
    (i32.store offset=4 (local.get $d) (i32.const 1))
    (i32.store offset=8 (local.get $d) (i32.const 0xff0000ff))
    (i32.store offset=24 (local.get $d) (load.field DxObject width (local.get $entry)))
    (i32.store offset=28 (local.get $d) (load.field DxObject height (local.get $entry)))
    (if (local.get $bg) (then (i32.store offset=32 (local.get $d) (local.get $tex))))
    (local.set $r (call $d3dim_gpu_call (i32.const 0x20004) (local.get $d) (i32.const 0)))
    (call $heap_free (local.get $ga))
    (local.get $r))
  (func (export "test_gps_fence") (result i32)
    (global.set $d3dim_gpu_on (i32.const 1))
    (call $d3dim_gpu_call (i32.const 0x20001) (i32.const 0) (i32.const 0)))
`;

(async () => {
  let ex, mem, sw = null, ring = null, ringAddr = 0, draws = 0;
  const tee = {
    caps: () => sw.caps(),
    execute(rec) { if (rec.op === GS.OP.DRAW_UP) draws++; sw.execute(rec); },
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

  const DESC = 0x410000, OUT = 0x410100, VERTS = 0x411000, W = 16;
  ex.test_seed(0x51000000, 0x52000000, 0x53000000);
  let slot = 0;
  function surface(w, h, bpp, masks, pfFlags = 0x40) {
    for (let i = 0; i < 128; i += 4) gw(DESC + i, 0);
    [[0, 108], [4, 0x1007], [8, h], [12, w], [72, 32], [76, pfFlags], [84, bpp],
      [88, masks[0]], [92, masks[1]], [96, masks[2]], [104, 0x40]].forEach(([o, v]) => gw(DESC + o, v));
    const out = OUT + 4 * slot++;
    assert.strictEqual(ex.test_create_surface(DESC, out) >>> 0, 0);
    return gr(out);
  }
  function device(rt) {
    const out = OUT + 4 * slot++;
    assert.strictEqual(ex.test_create_device(rt, out) >>> 0, 0);
    return gr(out);
  }
  const RGB565 = [0xf800, 0x07e0, 0x001f];
  const rt = surface(W, W, 16, RGB565), dev = device(rt);
  for (let i = 0; i < 6; i++) {
    const o = VERTS + i * 40;
    gf(o, (i % 3) * 6); gf(o + 4, i % 3 === 2 ? 8 : 1); gf(o + 8, 0.5); gf(o + 12, 1);
    gw(o + 16, 0xffffffff); gw(o + 20, 0); gf(o + 24, 0); gf(o + 28, 0); gf(o + 32, 0); gf(o + 36, 1);
  }
  ex.test_set_rs(dev, 22, 1);  // no culling: winding is not under test

  // The first accepted draw opens the producer (its counters live there).
  assert.strictEqual(ex.test_gpu_draw(dev, 4, 3, VERTS, 3), 1);
  ex.test_gps_fence();
  // Decline reasons are d3dim_gps_stat 35..42 (eight words).
  const REASONS = 8, N = 35 + REASONS, stat = i => ex.d3dim_gps_stat(i) >>> 0;
  const snap = () => Array.from({ length: N }, (_, i) => stat(i));
  function expect(before, { drawn = 0, declined = 0, fallback = 0, why = null, clears = 0 }, label) {
    const after = snap(), d = i => after[i] - before[i];
    assert.strictEqual(d(0), drawn, `${label}: drawn`);
    assert.strictEqual(d(14), declined, `${label}: declined draws`);
    assert.strictEqual(d(1), fallback, `${label}: fallbacks`);
    assert.strictEqual(d(9), clears, `${label}: clears`);
    for (let k = 0; k < REASONS; k++)
      assert.strictEqual(d(35 + k), k === why ? fallback : 0, `${label}: reason ${k}`);
    assert.strictEqual(Array.from({ length: REASONS }, (_, k) => d(35 + k)).reduce((a, b) => a + b, 0),
      d(1), `${label}: reasons sum to the fallbacks`);
  }
  const draw = (label, prim, vtype, count, counts, device = dev, verts = VERTS) => {
    const before = snap(), d0 = draws;
    const r = ex.test_gpu_draw(device, prim, vtype, verts, count);
    ex.test_gps_fence();
    assert.strictEqual(r, counts.drawn ? 1 : 0, `${label}: result`);
    assert.strictEqual(draws - d0, counts.drawn ? 1 : 0, `${label}: DRAW_UP records`);
    expect(before, counts, label);
  };

  // Shape predicates: declined before describe, never a state fallback.
  for (const [prim, vtype, count] of [[4, 2, 3], [2, 3, 1], [3, 3, 0], [0, 3, 3], [7, 3, 3],
    [4, 3, 2], [0, 2, 0], [6, 3, 2], [4, 7, 3], [0xffffffff, 0xffffffff, 0xffffffff]])
    draw(`shape ${prim}/${vtype}/${count}`, prim, vtype, count, { declined: 1 });
  // Accepted minimum for each primitive, and every vertex type.
  for (const prim of [2, 3, 4, 5, 6])
    draw(`primitive ${prim}`, prim, 3, prim <= 3 ? 2 : 3, { drawn: 1 });
  for (const vtype of [4, 5, 6]) draw(`vertex type ${vtype}`, 4, vtype, 3, { drawn: 1 });

  // A render target the GPU cannot hold (8-bit indexed): declined, not a
  // state fallback.
  const indexed = surface(W, W, 8, [0, 0, 0], 0x60);
  draw('8-bit render target', 4, 3, 3, { declined: 1 }, device(indexed));

  // State the GPU cannot reproduce: one fallback each, with its reason.
  ex.test_set_rs(dev, 7, 1); ex.test_set_rs(dev, 23, 9);  // ZFUNC out of range
  draw('ZFUNC 9', 4, 3, 3, { declined: 1, fallback: 1, why: 2 });
  ex.test_set_rs(dev, 23, 4);
  draw('ZFUNC LESSEQUAL', 4, 3, 3, { drawn: 1 });
  ex.test_set_rs(dev, 7, 0);
  ex.test_set_rs(dev, 27, 1); ex.test_set_rs(dev, 19, 14);  // SRCBLEND out of range
  draw('SRCBLEND 14', 4, 3, 3, { declined: 1, fallback: 1, why: 3 });
  for (const sb of [12, 13]) {  // BOTHSRCALPHA / BOTHINVSRCALPHA are rewritten
    ex.test_set_rs(dev, 19, sb);
    draw(`SRCBLEND ${sb}`, 4, 3, 3, { drawn: 1 });
  }
  ex.test_set_rs(dev, 27, 0);
  draw('SRCBLEND ignored with blending off', 4, 3, 3, { drawn: 1 });

  // Textured. Stage-0 operands follow the software rasterizer's rule
  // (any selector, SPECULAR included, gets its approximation), so they never
  // decline; a texture the GPU cannot upload -- here the render target
  // itself -- is a counted fallback.
  const api = require('../src/api_table.json').find(e => e.name === 'IDirect3DTexture2_GetHandle');
  const handle = (s, at) => { assert.strictEqual(ex.test_get_handle(api.id, s, dev, at) >>> 0, 0); return gr(at); };
  const texture = surface(4, 4, 16, RGB565);
  ex.test_set_rs(dev, 1, handle(texture, OUT + 0x80));
  draw('textured', 4, 3, 3, { drawn: 1 });
  assert.strictEqual(ex.test_set_tss(dev, 2, 4) >>> 0, 0);  // COLORARG1 = SPECULAR
  draw('COLORARG1 SPECULAR', 4, 3, 3, { drawn: 1 });
  assert.strictEqual(ex.test_set_tss(dev, 2, 2) >>> 0, 0);
  // COLORARG2 = TFACTOR (giants): ARG2 is the texture only for TEXTURE,
  // diffuse otherwise, as $d3dim_stage_operation reads it. Same pixels as
  // COLORARG2 = DIFFUSE, drawn on the GPU with no fallback.
  {
    // A fresh texture, filled before its first upload (raw stores bump no
    // page-watch generation, so a cached texture would not see them).
    const grey = surface(4, 4, 16, RGB565);
    const texDib = ex.test_dib(grey) >>> 0, rtDib = ex.test_dib(rt) >>> 0, v = new DataView(mem.buffer);
    for (let i = 0; i < 16; i++) v.setUint16(texDib + i * 2, 0x7bef, true);  // mid grey texels
    ex.test_set_rs(dev, 1, handle(grey, OUT + 0x88));
    // A whole-target TL triangle (32-byte vertices), diffuse half red.
    const TRI = VERTS + 0x1000;
    [[-1, -1], [2 * W, -1], [-1, 2 * W]].forEach(([x, y], i) => {
      const o = TRI + i * 32;
      gf(o, x); gf(o + 4, y); gf(o + 8, 0.5); gf(o + 12, 1); gw(o + 16, 0xff800000); gw(o + 20, 0);
      gf(o + 24, 0.5); gf(o + 28, 0.5);
    });
    const vary = [];
    for (const [label, arg2] of [['COLORARG2 DIFFUSE', 0], ['COLORARG2 TFACTOR', 3], ['COLORARG2 TEXTURE', 2]]) {
      assert.strictEqual(ex.test_set_tss(dev, 3, arg2) >>> 0, 0);
      draw(label, 4, 3, 3, { drawn: 1 }, dev, TRI);
      vary.push(v.getUint16(rtDib + (4 * W + 4) * 2, true));
    }
    assert.notStrictEqual(vary[0], 0, 'the probe pixel is covered');
    assert.strictEqual(vary[1], vary[0], `TFACTOR as ARG2 reads diffuse (0x${vary[1].toString(16)} vs 0x${vary[0].toString(16)})`);
    assert.notStrictEqual(vary[2], vary[0], 'TEXTURE as ARG2 reads the texture (the probe tells them apart)');
    assert.strictEqual(ex.test_set_tss(dev, 3, 0) >>> 0, 0);
  }
  ex.test_set_rs(dev, 1, handle(rt, OUT + 0x84));
  draw('render target as its own texture', 4, 3, 3, { declined: 1, fallback: 1, why: 1 });
  draw('lines ignore the texture', 2, 3, 2, { drawn: 1 });
  ex.test_set_rs(dev, 1, 0);

  // Clears: a target the GPU never drew on stays in software uncounted; a
  // drawn one is cleared on the GPU; a background clear without its texture
  // words is a counted fallback.
  const fresh = surface(W, W, 16, RGB565);
  let before = snap();
  assert.strictEqual(ex.test_gpu_clear(fresh, 0, 0), 0, 'undrawn target clear declines');
  expect(before, {}, 'undrawn clear');
  before = snap();
  assert.strictEqual(ex.test_gpu_clear(rt, 0, 0), 1, 'drawn target clears on the GPU');
  expect(before, { clears: 1 }, 'GPU clear');
  before = snap();
  assert.strictEqual(ex.test_gpu_clear(rt, 1, 1), 0, 'background clear without texture words declines');
  expect(before, { fallback: 1, why: 6 }, 'background clear');
  assert(draws > 0, 'records went through the GPU stream consumer');

  console.log('test-d3dim-gpu-fallback-counters: OK');
})().catch(e => { console.error(e.stack || e); process.exit(1); });
