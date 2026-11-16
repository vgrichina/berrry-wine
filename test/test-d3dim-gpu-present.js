#!/usr/bin/env node
'use strict';

// D3DIM GPU present (docs/d3dim-gpu-present.md) through the WAT GPU stream
// producer (src/09abg-d3dim-gps.wat $d3g_blt_present / $d3g_park), drained
// into the real software executor (lib/gpu-stream-software.js). A
// Blt(primary <- render target) parks the rect in a GPU park slot and
// PRESENTs it, while the primary's DIB stays as it was. The DIB gets the
// presented pixels only when a CPU reader of those bytes asks: a ranged fence
// that overlaps them. A global fence (length 0) is not such a reader. The
// gamma ramp runs in the present. Park-slot merging is covered by
// test-d3dim-surface-fence.js.

const assert = require('assert');
const GS = require('../lib/gpu-stream');
const { Executor: SoftwareExecutor } = require('../lib/gpu-stream-software');
const { bootRenderHarness } = require('./render-helper');

const extraWat = `
  (func (export "pr_surface") (param $w i32) (param $h i32) (param $bpp i32) (result i32)
    (local $this i32) (local $entry i32) (local $pitch i32)
    (local.set $this (call $dx_create_com_obj (i32.const 2) (global.get $DX_VTBL_DDSURF3)))
    (local.set $entry (call $dx_from_this (local.get $this)))
    (local.set $pitch (i32.mul (local.get $w) (i32.shr_u (local.get $bpp) (i32.const 3))))
    (store.field DxObject width (local.get $entry) (local.get $w))
    (store.field DxObject height (local.get $entry) (local.get $h))
    (store.field DxObject bpp (local.get $entry) (local.get $bpp))
    (store.field DxObject pitch (local.get $entry) (local.get $pitch))
    (store.field DxObject misc1 (local.get $entry)
      (call $g2w (call $heap_alloc (i32.mul (local.get $pitch) (local.get $h)))))
    (call $dx_surf_fmt_set (local.get $entry) (i32.const 1))
    (local.get $this))
  (func (export "pr_dib") (param $this i32) (result i32)
    (load.field DxObject misc1 (call $dx_from_this (local.get $this))))
  ;; A GPU colour clear through the producer's 0x20004 lowering (as
  ;; test-d3dim-surface-fence.js; flag 4 stands in for an earlier draw).
  (func (export "pr_paint") (param $this i32) (param $color i32) (result i32)
    (local $entry i32) (local $pb i32) (local $t i32) (local $ga i32) (local $d i32) (local $r i32)
    (global.set $d3dim_gpu_on (i32.const 1))
    (local.set $entry (call $dx_from_this (local.get $this)))
    (call $lock_acquire (global.get $D3DIM_GPS))
    (local.set $pb (call $d3g_pb))
    (local.set $t (call $d3g_target (local.get $pb) (local.get $entry)
      (load.field DxObject misc1 (local.get $entry)) (load.field DxObject width (local.get $entry))
      (load.field DxObject height (local.get $entry)) (load.field DxObject bpp (local.get $entry))
      (load.field DxObject pitch (local.get $entry)) (call $dx_surf_fmt_get (local.get $entry))))
    (if (local.get $t) (then
      (i32.store offset=32 (local.get $t) (i32.or (i32.load offset=32 (local.get $t)) (i32.const 4)))))
    (call $lock_release (global.get $D3DIM_GPS))
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
  ;; Blt(dst <- src) of (sx, sy, w, h) to (dx, dy) through 0x2000A (DXP3).
  (func (export "pr_present") (param $dst i32) (param $src i32) (param $dx i32) (param $dy i32)
      (param $w i32) (param $h i32) (param $sx i32) (param $sy i32) (result i32)
    (local $ga i32) (local $d i32) (local $r i32)
    (global.set $d3dim_gpu_on (i32.const 1))
    (local.set $ga (call $heap_alloc (i32.const 48)))
    (local.set $d (call $g2w (local.get $ga)))
    (memory.fill (local.get $d) (i32.const 0) (i32.const 48))
    (i32.store offset=0 (local.get $d) (i32.const 0x44585033))
    (i32.store offset=4 (local.get $d) (call $dx_from_this (local.get $dst)))
    (i32.store offset=8 (local.get $d) (call $dx_from_this (local.get $src)))
    (i32.store offset=12 (local.get $d) (local.get $dx))
    (i32.store offset=16 (local.get $d) (local.get $dy))
    (i32.store offset=20 (local.get $d) (local.get $w))
    (i32.store offset=24 (local.get $d) (local.get $h))
    (i32.store offset=28 (local.get $d) (local.get $sx))
    (i32.store offset=32 (local.get $d) (local.get $sy))
    (i32.store offset=36 (local.get $d) (i32.const 0x1234))
    (local.set $r (call $d3dim_gpu_call (i32.const 0x2000A) (local.get $d) (i32.const 48)))
    (call $heap_free (local.get $ga))
    (local.get $r))
  (func (export "pr_fence") (param $wa i32) (param $len i32) (result i32)
    (global.set $d3dim_gpu_on (i32.const 1))
    (call $d3dim_gpu_call (i32.const 0x20001) (local.get $wa) (local.get $len)))
  ;; Final release of a surface's GPU resources, as $dx_free does it.
  (func (export "pr_forget") (param $this i32)
    (global.set $d3dim_gpu_on (i32.const 1))
    (call $d3dim_gps_forget (call $dx_from_this (local.get $this))))
  ;; SetGammaRamp's process-shared publication: ramp guest pointer + generation.
  (func (export "pr_gamma") (param $guest i32) (param $gen i32)
    (i32.atomic.store offset=28 (global.get $SHARED_COUNTERS) (local.get $guest))
    (i32.atomic.store offset=24 (global.get $SHARED_COUNTERS) (local.get $gen)))
  (export "pr_alloc" (func $heap_alloc))
`;

(async () => {
  let ex, wasmMemory, gps = null, ring = null, ringAddr = 0;
  const frames = [], calls = [];
  const harness = await bootRenderHarness({ fonts: 'none', extraWat,
    extraHostOverrides: {
      gpu_gl_call: (...args) => { calls.push(args); return 0; },
      gpu_stream_kick: (r, mode) => {
        r >>>= 0;
        if (!gps) gps = new SoftwareExecutor({ getExports: () => ex, getMemory: () => wasmMemory.buffer,
          onPresent: f => frames.push(f) });
        if (!ring || ringAddr !== r) { ring = new GS.Ring(() => wasmMemory.buffer, r); ringAddr = r; }
        GS.drain([ring], gps);
        if ((mode | 0) === GS.CONST.KICK_CLOSE) { gps.close(); gps = null; ring = null; ringAddr = 0; }
        return 1;
      },
    } });
  ex = harness.exports; wasmMemory = harness.memory;
  const pe = require('fs').readFileSync(require('path').join(__dirname, 'binaries/calc.exe'));
  new Uint8Array(wasmMemory.buffer).set(pe, ex.get_staging());
  assert(ex.load_pe(pe.length));
  ex.init_dx_com_thunks();

  const W = 4, H = 4, PITCH = W * 2;
  const RED = 0xffff0000, GREEN = 0xff00ff00, BLUE = 0xff0000ff;
  const R5 = [0x00, 0xf8], G5 = [0xe0, 0x07], K = [0x22, 0x22];
  const readbacks = () => ex.d3dim_gps_stat(2);
  // The first GPU target sets the software executor's device size: 4x4.
  const S = ex.pr_surface(W, H, 16), P = ex.pr_surface(W, H, 16);
  assert.strictEqual(ex.pr_paint(S, RED), 1);
  const dib = ex.pr_dib(P) >>> 0;
  const reset = () => new Uint8Array(wasmMemory.buffer, dib, PITCH * H).fill(0x22);
  const pixel = (x, y) => Array.from(new Uint8Array(wasmMemory.buffer, dib + y * PITCH + x * 2, 2));
  const inRect = (x, y, rx, ry, rw, rh) => x >= rx && x < rx + rw && y >= ry && y < ry + rh;
  const expectDib = (rect, color, what) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      assert.deepStrictEqual(pixel(x, y), rect && inRect(x, y, ...rect) ? color : K, `${what} at ${x},${y}`);
  };
  const framePixel = (f, x, y) => Array.from(f.pixels.subarray((y * f.width + x) * 4, (y * f.width + x) * 4 + 4));

  // Present parks the frame; the DIB is untouched until a reader of it fences.
  {
    reset();
    let r = readbacks(), presents = ex.d3dim_gps_stat(6), blts = ex.d3dim_gps_stat(11), n = frames.length;
    assert.strictEqual(ex.pr_present(P, S, 1, 1, 2, 2, 0, 0), 1, 'the producer takes the Blt-present');
    assert.strictEqual(ex.d3dim_gps_stat(6), presents + 1);
    assert.strictEqual(ex.d3dim_gps_stat(11), blts + 1);
    assert.strictEqual(frames.length, n + 1, 'the host gets a frame');
    const fr = frames.at(-1);
    assert.deepStrictEqual([fr.width, fr.height, fr.hwnd], [2, 2, 0x1234]);
    for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]])
      assert.deepStrictEqual(framePixel(fr, x, y), [255, 0, 0, 255], 'presented from GPU memory');
    assert.strictEqual(readbacks(), r, 'no readback on present');
    expectDib(null, null, 'DIB untouched by the present');

    assert.strictEqual(ex.pr_fence(0, 0), 1, 'a global fence lands every GPU target');
    assert.strictEqual(readbacks(), r + 1, 'the source target, not the parked primary');
    expectDib(null, null, 'a global fence does not materialize');
    r = readbacks();
    ex.pr_fence(dib + PITCH * H, 64);
    expectDib(null, null, 'a fence on other bytes does not materialize');
    assert.strictEqual(readbacks(), r);

    // A later frame on the GPU must not leak into the parked one.
    assert.strictEqual(ex.pr_paint(S, GREEN), 1);
    ex.pr_fence(dib + PITCH, 4);
    assert.strictEqual(readbacks(), r + 1, 'one readback for the one parked rect');
    expectDib([1, 1, 2, 2], R5, 'the parked frame lands, and only its rect');
    ex.pr_fence(dib, PITCH * H);
    assert.strictEqual(readbacks(), r + 1, 'a landed frame is not read back again');
  }

  // A covering frame supersedes what it hides: one readback, not two.
  {
    reset();
    assert.strictEqual(ex.pr_present(P, S, 1, 1, 2, 2, 0, 0), 1);
    assert.strictEqual(ex.pr_present(P, S, 0, 0, W, H, 0, 0), 1);
    const r = readbacks();
    ex.pr_fence(dib, 4);
    assert.strictEqual(readbacks(), r + 1, 'only the visible frame is read back');
    expectDib([0, 0, W, H], G5, 'the covering frame');
  }

  // The source target's teardown does not take the parked frame with it;
  // the primary's does (its DIB is gone).
  {
    reset();
    const T = ex.pr_surface(W, H, 16);
    assert.strictEqual(ex.pr_paint(T, BLUE), 1);
    assert.strictEqual(ex.pr_present(P, T, 0, 0, 2, 1, 0, 0), 1);
    ex.pr_forget(T);
    let r = readbacks();
    ex.pr_fence(dib, 4);
    assert.strictEqual(readbacks(), r + 1);
    expectDib([0, 0, 2, 1], [0x1f, 0x00], 'the park slot outlives its source target');
    reset();
    assert.strictEqual(ex.pr_present(P, S, 0, 0, 2, 1, 0, 0), 1);
    ex.pr_forget(P);
    r = readbacks();
    ex.pr_fence(dib, PITCH * H);
    assert.strictEqual(readbacks(), r, 'a released primary drops its parked frame');
    expectDib(null, null, 'nothing lands in a freed primary');
  }

  // The gamma ramp is applied by the present, uploaded once per generation.
  {
    const P2 = ex.pr_surface(W, H, 16);
    const ramp = ex.pr_alloc(1536) >>> 0;
    for (let c = 0; c < 3; c++) for (let i = 0; i < 256; i++)
      ex.guest_write16(ramp + c * 512 + i * 2, (255 - i) << 8);
    ex.pr_gamma(ramp, 7);
    const up0 = gps.stats().uploads;
    assert.strictEqual(ex.pr_present(P2, S, 0, 0, 1, 1, 0, 0), 1);
    const up1 = gps.stats().uploads;
    assert.deepStrictEqual(framePixel(frames.at(-1), 0, 0), [255, 0, 255, 255], 'inverted green through the LUT');
    assert(up1 > up0, 'the ramp is uploaded');
    assert.strictEqual(ex.pr_present(P2, S, 0, 0, 1, 1, 0, 0), 1);
    assert.strictEqual(gps.stats().uploads, up1, 'an unchanged generation uploads nothing');
    assert.deepStrictEqual(framePixel(frames.at(-1), 0, 0), [255, 0, 255, 255]);
    for (let c = 0; c < 3; c++) for (let i = 0; i < 256; i++) ex.guest_write16(ramp + c * 512 + i * 2, i << 8);
    ex.pr_gamma(ramp, 8);
    assert.strictEqual(ex.pr_present(P2, S, 0, 0, 1, 1, 0, 0), 1);
    assert.deepStrictEqual(framePixel(frames.at(-1), 0, 0), [0, 255, 0, 255], 'an identity ramp skips the LUT');
    ex.pr_gamma(0, 9);
    ex.pr_forget(P2);
  }

  // Declines: the caller then performs the ordinary CPU Blt.
  {
    const U = ex.pr_surface(W, H, 16), P32 = ex.pr_surface(W, H, 32);
    const blts = ex.d3dim_gps_stat(11), n = frames.length;
    assert.strictEqual(ex.pr_present(P, U, 0, 0, 2, 2, 0, 0), 0, 'source is not a GPU target');
    assert.strictEqual(ex.pr_present(P, S, 0, 0, 2, 2, 3, 0), 0, 'source rect beyond the target');
    assert.strictEqual(ex.pr_present(P, S, 3, 0, 2, 2, 0, 0), 0, 'destination rect beyond the primary');
    assert.strictEqual(ex.pr_present(P32, S, 0, 0, 2, 2, 0, 0), 0, 'bpp mismatch');
    const T = ex.pr_surface(W, H, 16);
    assert.strictEqual(ex.pr_paint(T, RED), 1);
    assert.strictEqual(ex.pr_present(T, S, 0, 0, 2, 2, 0, 0), 0, 'a GPU target is not a primary');
    assert.strictEqual(ex.d3dim_gps_stat(11), blts);
    assert.strictEqual(frames.length, n, 'no frame for a declined present');
  }

  assert.deepStrictEqual(calls, [], 'the WAT producer never calls the host gpu_gl_call');
  console.log('test-d3dim-gpu-present: ok');
})().catch(e => { console.error(e); process.exitCode = 1; });
