#!/usr/bin/env node
'use strict';
// A lazily-armed Lock (--d3dim-lazy-sync) of a GPU render target that the
// guest then overwrites whole with REP MOVS / STOS reads nothing back:
// the first-touch readback would be overwritten unread. MechWarrior 3's
// menu copies its 640x480 background into the locked back buffer with one
// `rep movsd` every frame (one full-frame readback per Flip before).
// - whole-range copy or fill: no readback, the Lock disarmed, the GPU's
//   pixels dropped; the next GPU use uploads the whole new DIB (a full
//   readback afterwards shows the CPU's pixels where the GPU had drawn);
// - a partial copy, or a copy whose source is the locked surface itself,
//   still reads back on first touch.
const assert = require('assert');
const { bootGpsDevice } = require('./helpers/d3dim-gps-device');

const WAT = String.raw`
(func (export "lz_lock") (param $s i32)
 (global.set $d3dim_lazy_on (i32.const 1))
 (call $d3dim_lock_fence (call $dx_from_this (local.get $s))))
(func (export "lz_unlock") (param $s i32) (result i32)
 (call $d3dim_lazy_unlock (call $dx_from_this (local.get $s))))
(func (export "lz_armed") (result i32) (local $e i32)
 (local.set $e (call $gps_lazy_find_key (global.get $GPS_API_D3DIM) (i32.const 0)))
 (if (result i32) (local.get $e) (then (i32.atomic.load offset=4 (local.get $e))) (else (i32.const 0))))
(func (export "lz_w2g") (param $wa i32) (result i32) (call $w2g (local.get $wa)))
(func (export "lz_movs") (param $edi i32) (param $esi i32) (param $n i32)
 (call $rep_movs_mem (local.get $edi) (local.get $esi) (local.get $n) (i32.const 4)))
(func (export "lz_stos") (param $edi i32) (param $n i32) (param $v i32)
 (call $rep_stos_mem (local.get $edi) (local.get $n) (i32.const 4) (i64.extend_i32_u (local.get $v))))
`;

(async () => {
  const g = await bootGpsDevice({ extraWat: WAT }), { e, m } = g;
  // VIDEOMEMORY | 3DDEVICE | OFFSCREENPLAIN: a page-aligned DIB-arena surface.
  const W = 64, H = 64, rt = g.surface(W, H, { caps: 0x6040 }), dev = g.device(rt);
  const pitch = g.pitch(rt), bytes = pitch * H;
  assert.strictEqual(pitch, W * 4);
  assert.strictEqual(g.dib(rt) & 4095, 0, 'DIB is page aligned (lazy Locks arm only those)');
  const rs = (r, v) => e.gd_rs(dev, r, v), tss = (t, v) => e.gd_tss(dev, 0, t, v);
  rs(7, 0); rs(22, 1); rs(27, 0); rs(19, 5); rs(20, 6); tss(1, 2); tss(2, 0); tss(4, 2); tss(5, 0);
  const vb = e.guest_alloc(256), src = e.guest_alloc(bytes + 64);
  const srcWa = e.guest_to_wasm(src), dstGa = e.lz_w2g(g.dib(rt));
  const at = (x, y) => m.getUint32(g.dib(rt) + y * pitch + x * 4, true) & 0xffffff;
  const draw = (color, pts, rhw = 1) => {
    g.vertices(vb, pts.map(([x, y]) => [x, y, .5, rhw, color]));
    const before = g.stat(0); e.gd_draw(dev, 4, vb, pts.length);
    assert.strictEqual(g.stat(0), before + 1, 'producer took the draw');
  };
  const lazyReads = () => g.stat(16 + 14);
  const BLUE = 0x0000ff, RED = 0xff0000, GREEN = 0x00ff00;
  for (let i = 0; i < bytes; i += 4) m.setUint32(srcWa + i, 0xff000000 | BLUE, true);

  // 1. Whole-surface REP MOVSD into the armed Lock.
  draw(0xffff0000, [[0, 0], [40, 0], [0, 40]]);
  e.lz_lock(rt);
  assert.strictEqual(e.lz_armed(), bytes, 'Lock armed lazily');
  let rb = g.stat(2), lazy = lazyReads();
  e.lz_movs(dstGa, src, bytes / 4);
  assert.strictEqual(g.stat(2), rb, 'no readback for a whole-surface copy');
  assert.strictEqual(lazyReads(), lazy);
  assert.strictEqual(g.stat(43), 1, 'counted as overwritten');
  assert.strictEqual(e.lz_armed(), 0, 'Lock disarmed');
  assert.strictEqual(at(2, 2), BLUE, 'the CPU copy landed');
  e.lz_unlock(rt);
  // A draw that cannot be bounded (negative w) reads the whole target back:
  // where the GPU had drawn red, the uploaded CPU pixels must show.
  draw(0xff00ff00, [[60, 60], [62, 60], [60, 62]], -1);
  g.fence();
  assert.strictEqual(at(2, 2), BLUE, `the GPU got the whole new DIB ${at(2, 2).toString(16)}`);
  assert.strictEqual(at(50, 50), BLUE);

  // 2. REP STOSD over the whole Lock.
  draw(0xffff0000, [[0, 0], [40, 0], [0, 40]]);
  e.lz_lock(rt);
  rb = g.stat(2);
  e.lz_stos(dstGa, bytes / 4, 0xff00ff00);
  assert.strictEqual(g.stat(2), rb, 'no readback for a whole-surface fill');
  assert.strictEqual(g.stat(43), 2);
  e.lz_unlock(rt);
  draw(0xff0000ff, [[60, 60], [62, 60], [60, 62]], -1);
  g.fence();
  assert.strictEqual(at(2, 2), GREEN, `fill reached the GPU ${at(2, 2).toString(16)}`);

  // 3. Half the surface: the other half must come from the GPU.
  draw(0xffff0000, [[0, 0], [64, 0], [0, 64]]);
  e.lz_lock(rt);
  lazy = lazyReads();
  e.lz_movs(dstGa, src, bytes / 8);
  assert.strictEqual(lazyReads(), lazy + 1, 'a partial copy reads back first');
  assert.strictEqual(g.stat(43), 2);
  assert.strictEqual(at(2, 2), BLUE);
  assert.strictEqual(at(2, 50), RED, 'the untouched half shows the GPU pixels');
  e.lz_unlock(rt);

  // 4. A copy inside the locked surface reads it: read back first.
  draw(0xff00ff00, [[0, 0], [64, 0], [0, 64]]);
  e.lz_lock(rt);
  lazy = lazyReads();
  e.lz_movs(dstGa, dstGa + pitch, (bytes - pitch) / 4);
  assert.strictEqual(lazyReads(), lazy + 1, 'self-overlapping source reads back');
  assert.strictEqual(g.stat(43), 2);
  assert.strictEqual(at(1, 1), GREEN);
  e.lz_unlock(rt);

  assert.deepStrictEqual(g.errors, []);
  console.log(`PASS lazy Lock + whole-surface REP MOVS/STOS reads nothing back: ${JSON.stringify({ overwritten: g.stat(43), readbacks: g.stat(2), lazy: lazyReads() })}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
