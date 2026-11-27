#!/usr/bin/env node
'use strict';
// GDI BitBlt / StretchBlt onto a DirectDraw DC whose GetDC was deferred
// (09abg $d3dim_gps_getdc_defer: the GPU target is dirty, its DIB stale in
// the GPU-only rect R). Re-Volt StretchBlts a whole 640x480 memory bitmap
// onto its back buffer's DC with SRCCOPY: one full readback per GetDC before.
// - a ROP that reads no destination pixel, unclipped, with its source rect
//   inside the source, writes every pixel of its rect: no readback; the rect
//   is uploaded and R loses what it covers (whole: the target is clean;
//   a full-width top band: R keeps the rest, which the GPU still owns);
// - StretchBlt qualifies the same way;
// - a ROP that reads the destination (SRCAND) lands the target first, as
//   before (one getDC readback), so GDI combines with the GPU's pixels;
// - a SRCCOPY whose source rect leaves the source is held, then landed
//   before the raster runs (stat 51), with the same pixels as the old path.
const assert = require('assert');
const { bootGpsDevice } = require('./helpers/d3dim-gps-device');

const WAT = String.raw`
(func (export "go_getdc") (param $s i32) (result i32)
 (call $d3dim_gps_getdc_defer (call $dx_from_this (local.get $s))))
(func (export "go_releasedc") (param $s i32) (result i32)
 (call $d3dim_gps_releasedc (call $dx_from_this (local.get $s))))
(func (export "go_hdc") (param $s i32) (result i32) (local $hdc i32)
 (local.set $hdc (i32.add (i32.const 0x200000) (call $dx_slot_of (call $dx_from_this (local.get $s)))))
 (drop (call $gdi_dx_dc_bind (local.get $hdc)))
 (local.get $hdc))
;; stdcall stack args beyond the fifth come from [esp+24...]: the caller
;; wrote them at guest $esp.
(func (export "go_bitblt") (param $esp i32) (param $dst i32) (param $x i32) (param $y i32) (param $w i32) (param $h i32)
    (result i32)
 (i32.store offset=16 (global.get $reg_base) (local.get $esp))
 (call $handle_BitBlt (local.get $dst) (local.get $x) (local.get $y) (local.get $w) (local.get $h) (i32.const 0))
 (i32.load (global.get $reg_base)))
(func (export "go_stretchblt") (param $esp i32) (param $dst i32) (param $x i32) (param $y i32) (param $w i32) (param $h i32)
    (result i32)
 (i32.store offset=16 (global.get $reg_base) (local.get $esp))
 (call $handle_StretchBlt (local.get $dst) (local.get $x) (local.get $y) (local.get $w) (local.get $h) (i32.const 0))
 (i32.load (global.get $reg_base)))
`;

(async () => {
  const g = await bootGpsDevice({ extraWat: WAT }), { e, m } = g;
  const W = 64, H = 64;
  const rt = g.surface(W, H, { caps: 0x6040 }), dev = g.device(rt);
  const src = g.surface(W, H, { caps: 0x840 }); // SYSTEMMEMORY | OFFSCREENPLAIN
  const pitch = g.pitch(rt);
  const rs = (r, v) => e.gd_rs(dev, r, v), tss = (t, v) => e.gd_tss(dev, 0, t, v);
  rs(7, 0); rs(22, 1); rs(27, 0); rs(19, 5); rs(20, 6); tss(1, 2); tss(2, 0); tss(4, 2); tss(5, 0);
  const vb = e.guest_alloc(256), stack = e.guest_alloc(256);
  const at = (x, y) => m.getUint32(g.dib(rt) + y * pitch + x * 4, true) & 0xffffff;
  const draw = (color, pts) => {
    g.vertices(vb, pts.map(([x, y]) => [x, y, .5, 1, color]));
    const before = g.stat(0); e.gd_draw(dev, 4, vb, pts.length);
    assert.strictEqual(g.stat(0), before + 1, 'producer took the draw');
  };
  const BLUE = 0x0000ff, RED = 0xff0000, GREEN = 0x00ff00;
  g.fill32(src, 0xff000000 | BLUE);
  g.fill32(rt, 0xff000000 | GREEN);
  g.cpuWrote(rt);
  const hdc = e.go_hdc(rt), hsrc = e.go_hdc(src);
  const args = (...v) => v.forEach((x, i) => g.w32(stack + 24 + 4 * i, x));
  const blt = (x, y, w, h, sx, sy, rop) => { args(hsrc, sx, sy, rop); return e.go_bitblt(stack, hdc, x, y, w, h); };
  const stretch = (x, y, w, h, sx, sy, sw, sh, rop) => {
    args(hsrc, sx, sy, sw, sh, rop); return e.go_stretchblt(stack, hdc, x, y, w, h);
  };
  const SRCCOPY = 0x00CC0020, SRCAND = 0x008800C6;
  const getDC = () => g.stat(16 + 1);

  // 1. Whole-surface SRCCOPY over a deferred DC: nothing read back.
  draw(0xffff0000, [[0, 0], [40, 0], [0, 40]]);
  assert.strictEqual(e.go_getdc(rt), 1, 'GetDC deferred');
  let rb = g.stat(2);
  assert.strictEqual(blt(0, 0, W, H, 0, 0, SRCCOPY), 1);
  assert.strictEqual(g.stat(2), rb, 'no readback for an opaque whole-surface BitBlt');
  assert.strictEqual(g.stat(50), 1, 'counted as kept on the GPU');
  assert.strictEqual(at(2, 2), BLUE, 'GDI wrote the DIB');
  assert.strictEqual(e.go_releasedc(rt), 1, 'ReleaseDC closes the deferral');
  g.fence();
  assert.strictEqual(g.stat(2), rb, 'the target was left clean: the fence reads nothing');
  assert.strictEqual(at(2, 2), BLUE);

  // 2. A full-width top band [0, 20): R keeps rows 20.. on the GPU.
  draw(0xffff0000, [[0, 0], [40, 0], [0, 40]]);
  assert.strictEqual(e.go_getdc(rt), 1);
  rb = g.stat(2);
  g.fill32(src, 0xff000000 | GREEN);
  assert.strictEqual(blt(0, 0, W, 20, 0, 0, SRCCOPY), 1);
  assert.strictEqual(g.stat(2), rb, 'no readback for an opaque band');
  assert.strictEqual(g.stat(50), 2);
  assert.strictEqual(e.go_releasedc(rt), 1);
  g.fence();
  assert.strictEqual(g.stat(2), rb + 1, 'the rest of R is still GPU-owned and read back by the fence');
  assert.strictEqual(at(2, 2), GREEN, 'band from GDI');
  assert.strictEqual(at(2, 30), RED, `below the band the GPU's triangle survives (${at(2, 30).toString(16)})`);
  assert.strictEqual(at(50, 50), BLUE, 'outside R the old DIB');

  // 3. StretchBlt 32x32 -> whole surface.
  draw(0xff0000ff, [[0, 0], [40, 0], [0, 40]]);
  assert.strictEqual(e.go_getdc(rt), 1);
  rb = g.stat(2);
  g.fill32(src, 0xff000000 | RED);
  assert.strictEqual(stretch(0, 0, W, H, 0, 0, 32, 32, SRCCOPY), 1);
  assert.strictEqual(g.stat(2), rb, 'no readback for an opaque StretchBlt');
  assert.strictEqual(g.stat(50), 3);
  e.go_releasedc(rt);
  g.fence();
  assert.strictEqual(g.stat(2), rb);
  assert.strictEqual(at(2, 2), RED);

  // 4. SRCAND reads the destination: the target lands first (old path).
  draw(0xff00ff00, [[0, 0], [40, 0], [0, 40]]);
  assert.strictEqual(e.go_getdc(rt), 1);
  rb = g.stat(2); let gd = getDC();
  g.fill32(src, 0xff000000 | 0x00ffff);
  assert.strictEqual(blt(0, 0, W, H, 0, 0, SRCAND), 1);
  assert.strictEqual(g.stat(2), rb + 1, 'SRCAND reads the GPU pixels back');
  assert.strictEqual(getDC(), gd + 1, 'charged to getDC');
  assert.strictEqual(g.stat(50), 3, 'not an opaque blit');
  assert.strictEqual(at(2, 2), GREEN & 0x00ffff, 'GPU green AND cyan');
  assert.strictEqual(at(50, 50), RED & 0x00ffff, 'old DIB red AND cyan');
  e.go_releasedc(rt);

  // 5. SRCCOPY whose source rect leaves the source: held, then landed.
  draw(0xffff0000, [[0, 0], [40, 0], [0, 40]]);
  assert.strictEqual(e.go_getdc(rt), 1);
  rb = g.stat(2);
  g.fill32(src, 0xff000000 | BLUE);
  assert.strictEqual(blt(0, 0, W, H, 32, 0, SRCCOPY), 1);
  assert.strictEqual(g.stat(2), rb + 1, 'landed before the raster');
  assert.strictEqual(g.stat(51), 1, 'counted as a held blit landed');
  assert.strictEqual(g.stat(50), 3);
  assert.strictEqual(at(2, 2), BLUE, 'the copied half');
  assert.strictEqual(at(60, 30), 0, `beyond the source: what the old path writes (${at(60, 30).toString(16)})`);
  e.go_releasedc(rt);

  assert.deepStrictEqual(g.errors, []);
  console.log('PASS test-d3dim-gps-gdi-opaque');
})().catch((err) => { console.error(err); process.exit(1); });
