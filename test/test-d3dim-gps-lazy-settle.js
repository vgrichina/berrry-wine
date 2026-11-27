#!/usr/bin/env node
'use strict';
// A lazy Lock that leaves the shared table without its owed fence being
// needed -- untouched at Unlock, or discarded by a whole-range REP MOVS --
// also drops the "deferred GPU work" word ($D3DIM_LAZY_SHARED+16). While
// that word stayed set, every pixel-free barrier ($d3dim_gpu_barrier: Flip's
// CPU swap, a render-target switch) read back every dirty target and
// $d3g_cpu_write_ok refused the GPU replay of a CPU Blt / colour fill onto
// the target. GTA2's menu Locks its back buffer twice a frame, never touches
// it, then covers it with two opaque Blts: one readback per frame (gps-d8).
// - untouched Unlock: +16 clear, a barrier reads nothing back, a CPU write
//   onto the target is GPU-replayable again; a ranged fence of the target
//   still reads the GPU pixels (eager $d3dim_worker_pending path);
// - a barrier WHILE the Lock is armed still materializes it (conservative);
// - a whole-range overwrite discards the entry and clears +16 likewise.
const assert = require('assert');
const { bootGpsDevice } = require('./helpers/d3dim-gps-device');

const WAT = String.raw`
(func (export "lz_lock") (param $s i32)
 (global.set $d3dim_lazy_on (i32.const 1))
 (call $d3dim_lock_fence (call $dx_from_this (local.get $s))))
(func (export "lz_unlock") (param $s i32) (result i32)
 (call $d3dim_lazy_unlock (call $dx_from_this (local.get $s))))
(func (export "lz_owed") (result i32) (i32.atomic.load (region.addr $D3DIM_LAZY_SHARED 16)))
(func (export "lz_barrier") (call $d3dim_gpu_barrier))
(func (export "lz_surface_fence") (param $s i32) (call $d3dim_surface_fence (call $dx_from_this (local.get $s))))
(func (export "lz_write_ok") (param $s i32) (result i32) (call $d3g_cpu_write_ok (call $dx_from_this (local.get $s))))
(func (export "lz_w2g") (param $wa i32) (result i32) (call $w2g (local.get $wa)))
(func (export "lz_movs") (param $edi i32) (param $esi i32) (param $n i32)
 (call $rep_movs_mem (local.get $edi) (local.get $esi) (local.get $n) (i32.const 4)))
`;

(async () => {
  const g = await bootGpsDevice({ extraWat: WAT }), { e, m } = g;
  const W = 64, H = 64, rt = g.surface(W, H, { caps: 0x6040 }), dev = g.device(rt);
  const pitch = g.pitch(rt), bytes = pitch * H;
  assert.strictEqual(g.dib(rt) & 4095, 0, 'DIB is page aligned (lazy Locks arm only those)');
  const rs = (r, v) => e.gd_rs(dev, r, v), tss = (t, v) => e.gd_tss(dev, 0, t, v);
  rs(7, 0); rs(22, 1); rs(27, 0); rs(19, 5); rs(20, 6); tss(1, 2); tss(2, 0); tss(4, 2); tss(5, 0);
  const vb = e.guest_alloc(256), src = e.guest_alloc(bytes + 64);
  const srcWa = e.guest_to_wasm(src), dstGa = e.lz_w2g(g.dib(rt));
  const at = (x, y) => m.getUint32(g.dib(rt) + y * pitch + x * 4, true) & 0xffffff;
  const draw = (color, pts) => {
    g.vertices(vb, pts.map(([x, y]) => [x, y, .5, 1, color]));
    const before = g.stat(0); e.gd_draw(dev, 4, vb, pts.length);
    assert.strictEqual(g.stat(0), before + 1, 'producer took the draw');
  };
  const RED = 0xff0000, BLUE = 0x0000ff;
  for (let i = 0; i < bytes; i += 4) m.setUint32(srcWa + i, 0xff000000 | BLUE, true);
  const tri = [[0, 0], [40, 0], [0, 40]];

  // 1. Untouched Lock/Unlock, then a pixel-free barrier.
  draw(0xffff0000, tri);
  e.lz_lock(rt);
  assert.strictEqual(e.lz_owed(), 1, 'the lazy Lock owes its skipped fence');
  assert.strictEqual(e.lz_write_ok(rt), 0, 'armed: no GPU replay of a CPU write');
  assert.strictEqual(e.lz_unlock(rt), 1, 'Unlock found the Lock untouched');
  assert.strictEqual(e.lz_owed(), 0, 'untouched Unlock settles the owed word');
  assert.strictEqual(e.lz_write_ok(rt), 1, 'a CPU Blt onto the target is GPU-replayable again');
  let rb = g.stat(2);
  e.lz_barrier();
  assert.strictEqual(g.stat(2), rb, 'a pixel-free barrier reads nothing back after an untouched Lock');
  // The target is still GPU-dirty: a CPU reader of it still gets the GPU pixels.
  e.lz_surface_fence(rt);
  assert.ok(g.stat(2) > rb, 'a ranged fence of the target still reads back');
  assert.strictEqual(at(2, 2), RED, `ranged fence shows the GPU red ${at(2, 2).toString(16)}`);

  // 2. A barrier while the Lock is still armed materializes it (unchanged).
  draw(0xff0000ff, tri);
  e.lz_lock(rt);
  rb = g.stat(2); const lazy = g.stat(16 + 14);
  e.lz_barrier();
  assert.strictEqual(g.stat(16 + 14), lazy + 1, 'a barrier inside an armed Lock reads back (site lazy)');
  assert.ok(g.stat(2) > rb);
  assert.strictEqual(e.lz_owed(), 0);
  assert.strictEqual(at(2, 2), BLUE);
  e.lz_unlock(rt);

  // 3. Whole-range overwrite: the discard also settles the owed word.
  draw(0xffff0000, tri);
  e.lz_lock(rt);
  assert.strictEqual(e.lz_owed(), 1);
  rb = g.stat(2);
  e.lz_movs(dstGa, src, bytes / 4);
  assert.strictEqual(g.stat(43), 1, 'counted as overwritten');
  assert.strictEqual(e.lz_owed(), 0, 'the discard settles the owed word');
  e.lz_unlock(rt);
  e.lz_barrier();
  assert.strictEqual(g.stat(2), rb, 'no readback for the overwrite nor the barrier after it');
  assert.strictEqual(at(2, 2), BLUE, 'the CPU copy stands');

  assert.deepStrictEqual(g.errors, []);
  console.log(`PASS lazy Lock settle: untouched/overwritten Locks owe no barrier readback ${JSON.stringify({ readbacks: g.stat(2), lazy: g.stat(30), overwritten: g.stat(43) })}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
