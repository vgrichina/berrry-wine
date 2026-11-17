#!/usr/bin/env node
'use strict';

// A GPU Flip through the WAT GPU stream producer (src/09abg-d3dim-gps.wat
// $d3g_flip), drained into the real software executor
// (lib/gpu-stream-software.js). The flip chain's DIBs swap, the colour target
// follows its DIB, the new front is PRESENTed from GPU memory, and the drawn
// pixels land in the DIB they were drawn into only when a CPU reader fences
// those bytes. Measured on Deus Ex's D3DDrv: a synchronous readback per
// present was 28 ms of every frame.
//
// The JS WebGL executor's pixel-pack-buffer readback, its fence-sync polling,
// retry-after-exception and context-loss handling (lib/d3dim-gpu.js) are gone
// with it: the producer never reads a flipped frame back at all.

const assert = require('assert');
const GS = require('../lib/gpu-stream');
const { Executor: SoftwareExecutor } = require('../lib/gpu-stream-software');
const { bootRenderHarness } = require('./render-helper');

const extraWat = `
  (func (export "flip_slot") (param $this i32) (result i32)
    (call $dx_slot_of (call $dx_from_this (local.get $this))))
  (func (export "flip_write") (param $this i32) (param $off i32) (param $word i32)
    (call $gs32 (call $w2g (i32.add (load.field DxObject misc1 (call $dx_from_this (local.get $this))) (local.get $off))) (local.get $word)))
  (func (export "flip_release") (param $this i32) (result i32)
    (call $dx_surface_release (local.get $this)))
  (func (export "flip_lock") (param $this i32) (param $flags i32) (result i32)
    (local $ga i32) (local $wa i32) (local $pixels i32)
    (local.set $ga (call $heap_alloc (i32.const 108)))
    (local.set $wa (call $g2w (local.get $ga)))
    (memory.fill (local.get $wa) (i32.const 0) (i32.const 108))
    (i32.store (local.get $wa) (i32.const 108))
    (call $handle_IDirectDrawSurface_Lock (local.get $this) (i32.const 0)
      (local.get $ga) (local.get $flags) (i32.const 0) (i32.const 0))
    (local.set $pixels (i32.load offset=36 (local.get $wa)))
    (call $heap_free (local.get $ga))
    (local.get $pixels))
  (func (export "flip_bind") (param $this i32) (param $dib i32) (param $pitch i32)
    (local $ga i32) (local $wa i32)
    (local.set $ga (call $heap_alloc (i32.const 108)))
    (local.set $wa (call $g2w (local.get $ga)))
    (memory.fill (local.get $wa) (i32.const 0) (i32.const 108))
    (i32.store (local.get $wa) (i32.const 108))
    (i32.store offset=4 (local.get $wa) (i32.const 0x808))
    (i32.store offset=16 (local.get $wa) (local.get $pitch))
    (i32.store offset=36 (local.get $wa) (local.get $dib))
    (call $handle_IDirectDrawSurface3_SetSurfaceDesc (local.get $this) (local.get $ga)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (call $heap_free (local.get $ga)))
  (func (export "flip_surface") (param $w i32) (param $h i32) (result i32)
    (local $this i32) (local $entry i32)
    (local.set $this (call $dx_create_com_obj (i32.const 2) (global.get $DX_VTBL_DDSURF3)))
    (local.set $entry (call $dx_from_this (local.get $this)))
    (store.field DxObject width (local.get $entry) (local.get $w))
    (store.field DxObject height (local.get $entry) (local.get $h))
    (store.field DxObject bpp (local.get $entry) (i32.const 16))
    (store.field DxObject pitch (local.get $entry) (i32.shl (local.get $w) (i32.const 1)))
    (store.field DxObject misc1 (local.get $entry)
      (call $g2w (call $heap_alloc (i32.mul (i32.shl (local.get $w) (i32.const 1)) (local.get $h)))))
    (call $dx_surf_fmt_set (local.get $entry) (i32.const 1))
    (local.get $this))
  (func (export "flip_dib") (param $this i32) (result i32)
    (load.field DxObject misc1 (call $dx_from_this (local.get $this))))
  ;; Exclusive mode on a top-level cooperative window: what $d3g_flip needs.
  (func (export "flip_exclusive") (param $hwnd i32)
    (call $dx_coop_hwnd_set (local.get $hwnd))
    (call $dx_exclusive_set (i32.const 1)))
  ;; A GPU colour clear through the producer's own 0x20004 lowering (as
  ;; test-d3dim-surface-fence.js): the producer clears only a target the GPU
  ;; has drawn on (flag 4, set by a draw); the test marks that instead.
  (func (export "flip_paint") (param $this i32) (param $color i32) (result i32)
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
    (if (local.get $r) (then (global.set $d3dim_worker_pending (i32.const 1))))
    (local.get $r))
  ;; IDirectDrawSurface::Flip's queued path, as the handler takes it.
  (func (export "flip_try") (param $front i32) (param $back i32) (result i32)
    (global.set $d3dim_gpu_on (i32.const 1))
    (global.set $d3dim_worker_pending (i32.const 1))
    (call $d3dim_worker_try_flip (call $dx_from_this (local.get $front)) (call $dx_from_this (local.get $back))))
  (func (export "flip_present_pending") (result i32) (global.get $d3dim_present_pending))
  ;; A raw producer fence (0x20001) over [wa, wa+len); len 0 = global.
  (func (export "flip_fence") (param $wa i32) (param $len i32) (result i32)
    (global.set $d3dim_gpu_on (i32.const 1))
    (call $d3dim_gpu_call (i32.const 0x20001) (local.get $wa) (local.get $len)))
  ;; A CPU reader of one surface (Lock/GetDC/CPU present all fence this way).
  (func (export "flip_reader") (param $this i32)
    (global.set $d3dim_gpu_on (i32.const 1))
    (global.set $d3dim_worker_pending (i32.const 1))
    (call $d3dim_surface_fence (call $dx_from_this (local.get $this))))
`;

(async () => {
  let ex, wasmMemory, gps = null, ring = null, ringAddr = 0, kicks = 0;
  const frames = [], calls = [];
  const harness = await bootRenderHarness({ fonts: 'none', extraWat,
    extraHostOverrides: {
      gpu_gl_call: (...args) => { calls.push(args); return 0; },
      gpu_stream_kick: (r, mode) => {
        r >>>= 0; kicks++;
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
  ex.flip_exclusive(0x1234);

  const W = 4, H = 4, PITCH = W * 2, LEN = PITCH * H;
  const readbacks = () => ex.d3dim_gps_stat(2), flips = () => ex.d3dim_gps_stat(10);
  const bytes = (dib, n = LEN) => Array.from(new Uint8Array(wasmMemory.buffer, dib, n));
  const fill = (dib, v) => new Uint8Array(wasmMemory.buffer, dib, LEN).fill(v);
  // RGB565 bytes the clear colours must land as.
  const RED = 0xffff0000, GREEN = 0xff00ff00;
  const red = Array(W * H).fill([0x00, 0xf8]).flat(), green = Array(W * H).fill([0xe0, 0x07]).flat();

  const front = ex.flip_surface(W, H), back = ex.flip_surface(W, H);
  const dibA = ex.flip_dib(back) >>> 0, dibB = ex.flip_dib(front) >>> 0;
  fill(dibA, 0x11); fill(dibB, 0x22);
  assert.strictEqual(ex.flip_paint(back, RED), 1, 'the producer takes the clear of the back buffer');

  // The flip: DIBs swap, nothing reads back, nothing is owed.
  let r = readbacks(), f0 = flips(), p0 = frames.length;
  assert.strictEqual(ex.flip_try(front, back), 1, 'a GPU back buffer flips on the GPU');
  assert.strictEqual(ex.flip_present_pending(), 0, 'the producer PRESENTed the new front itself');
  assert.strictEqual(flips(), f0 + 1);
  assert.strictEqual(ex.flip_dib(front) >>> 0, dibA, 'the drawn DIB is the front now');
  assert.strictEqual(ex.flip_dib(back) >>> 0, dibB);
  assert.strictEqual(readbacks(), r, 'no readback on Flip');
  assert.strictEqual(ex.d3dim_gps_dib_is_derived(ex.flip_slot(front), dibA), 1, 'exact GPU Flip front is derived');
  assert.strictEqual(ex.d3dim_gps_dib_is_derived(ex.flip_slot(back), dibA), 0, 'same DIB with wrong surface is refused');
  assert.strictEqual(ex.d3dim_gps_dib_is_derived(ex.flip_slot(front), dibB), 0, 'old allocation of same front is refused');
  assert.deepStrictEqual(bytes(dibA), Array(LEN).fill(0x11), 'the pixels are not in the DIB until something fences it');
  assert.strictEqual(frames.length, p0 + 1, 'the executor received the presented frame');
  const fr = frames.at(-1);
  assert.strictEqual(ex.d3dim_gps_window_present(0x1234, fr.rt), fr.presentSeq, 'actual native RT and PRESENT record identify the primary');
  assert.strictEqual(ex.d3dim_gps_window_present(0x1234, fr.rt + 100), 0, 'different source RT cannot impersonate a present');
  ex.flip_exclusive(0x5678);
  assert.strictEqual(ex.d3dim_gps_window_present(0x1234, fr.rt), 0, 'cooperative window switch revokes old publication owner');
  ex.flip_exclusive(0x1234);
  assert.deepStrictEqual([fr.width, fr.height, fr.hwnd], [W, H, 0x1234]);
  assert.deepStrictEqual(Array.from(fr.pixels.subarray(0, 4)), [255, 0, 0, 255], 'presented from GPU memory');

  // A fence on unrelated bytes leaves the target GPU-only and reports it.
  assert.strictEqual(ex.flip_fence(dibA + 4096, 64), 2, 'other targets still hold GPU-only pixels');
  assert.strictEqual(readbacks(), r);

  // Presenting the front (a CPU reader of its DIB) lands it, once.
  ex.flip_reader(front);
  assert.strictEqual(readbacks(), r + 1);
  assert.deepStrictEqual(bytes(dibA), red, 'every pixel arrived in the DIB it was drawn into');
  assert.strictEqual(ex.d3dim_gps_dib_is_derived(ex.flip_slot(front), dibA), 1, 'read-only materialization does not author a CPU frame');
  assert.deepStrictEqual(bytes(dibB), Array(LEN).fill(0x22), 'the new back buffer is untouched');
  assert.strictEqual(ex.flip_fence(0, 0), 1, 'nothing GPU-only remains');
  assert.strictEqual(readbacks(), r + 1, 'nothing is read back twice');

  // A back buffer the GPU does not own: the CPU swap (0 = not queued).
  assert.strictEqual(ex.flip_try(front, back), 0, 'an undrawn back buffer takes the synchronous Flip');
  assert.strictEqual(ex.flip_dib(front) >>> 0, dibA, 'and the producer did not swap it');

  // Two frames in a row: the second Flip must not disturb the first frame.
  assert.strictEqual(ex.flip_paint(back, GREEN), 1);
  r = readbacks();
  assert.strictEqual(ex.flip_try(front, back), 1);
  assert.strictEqual(ex.flip_dib(front) >>> 0, dibB);
  assert.strictEqual(readbacks(), r, 'the second Flip reads nothing back either');
  assert.deepStrictEqual(bytes(dibA), red, 'first frame bytes survive the second Flip');
  assert.deepStrictEqual(Array.from(frames.at(-1).pixels.subarray(0, 4)), [0, 255, 0, 255]);
  ex.flip_reader(front);
  assert.strictEqual(readbacks(), r + 1);
  assert.deepStrictEqual(bytes(dibB), green);
  assert.deepStrictEqual(bytes(dibA), red);

  // A front of another size cannot take the GPU's back buffer.
  const odd = ex.flip_surface(W, H - 1);
  assert.strictEqual(ex.flip_paint(back, RED), 1);
  const oddDib = ex.flip_dib(odd) >>> 0;
  assert.strictEqual(ex.flip_try(odd, back), 0, 'size mismatch declines');
  assert.strictEqual(ex.flip_dib(odd) >>> 0, oddDib);

  const generation = ex.d3dim_gps_dib_cpu_generation(ex.flip_slot(front), dibB);
  ex.flip_write(front, 4, 0xf800f800);
  assert.strictEqual(ex.d3dim_gps_dib_is_derived(ex.flip_slot(front), dibB), 0, 'later retained native CPU pointer write takes ownership');
  assert.notStrictEqual(ex.d3dim_gps_dib_cpu_generation(ex.flip_slot(front), dibB), generation);
  const cpuGreen = green.slice(); cpuGreen.splice(4, 4, 0, 0xf8, 0, 0xf8);
  assert.deepStrictEqual(bytes(dibB), cpuGreen, 'all literal pixels including the later native two-pixel CPU write');

  // Public SetSurfaceDesc supplies the exact same client allocation to two
  // successive native surface lifetimes. Retirement must erase GPU ownership.
  const allocation = ex.guest_alloc(4096), first = ex.flip_surface(W, H);
  ex.flip_bind(first, allocation, PITCH);
  const sharedDib = ex.flip_dib(first) >>> 0, reusedSlot = ex.flip_slot(first);
  assert.strictEqual(ex.flip_paint(first, RED), 1);
  assert.strictEqual(ex.d3dim_gps_dib_is_derived(reusedSlot, sharedDib), 1);
  assert.strictEqual(ex.flip_release(first), 0);
  assert.strictEqual(ex.d3dim_gps_dib_is_derived(reusedSlot, sharedDib), 0, 'retirement erases exact allocation owner');
  const second = ex.flip_surface(W, H);ex.flip_bind(second, allocation, PITCH);
  const secondSlot = ex.flip_slot(second);
  assert.notStrictEqual(secondSlot, reusedSlot, 'native allocator initially retires COM slots');
  assert.strictEqual(ex.flip_dib(second) >>> 0, sharedDib, 'actual same-address client allocation reused');
  assert.strictEqual(ex.d3dim_gps_dib_is_derived(secondSlot, sharedDib), 0, 'new lifetime does not inherit old GPU pixels');
  assert.strictEqual(ex.flip_paint(second, GREEN), 1);ex.flip_reader(second);
  assert.deepStrictEqual(bytes(sharedDib), green, 'complete new-lifetime literal pixels');

  // A later public native CPU Lock fences a still GPU-dirty allocation
  // before changing two pixels; untouched pixels come from the GPU.
  assert.strictEqual(ex.flip_paint(front, GREEN), 1);
  assert.strictEqual(ex.guest_to_wasm(ex.flip_lock(front, 0)) >>> 0, dibB);
  ex.flip_write(front, 4, 0xf800f800);
  assert.strictEqual(ex.d3dim_gps_dib_is_derived(ex.flip_slot(front), dibB), 0);
  assert.deepStrictEqual(bytes(dibB), cpuGreen, 'later native Lock/read/write preserves all untouched GPU pixels');
  const lastFrame = frames.at(-1);
  assert.strictEqual(ex.d3dim_gps_window_present(0x1234, fr.rt), 0, 'previous actual RT cannot impersonate the later Flip');
  assert.strictEqual(ex.d3dim_gps_window_present(0x1234, lastFrame.rt), lastFrame.presentSeq);
  assert.strictEqual(ex.flip_release(front), 0);
  assert.strictEqual(ex.d3dim_gps_window_present(0x1234, lastFrame.rt), 0, 'retired primary revokes its actual PRESENT');

  assert.deepStrictEqual(calls, [], 'the WAT producer never calls the host gpu_gl_call');
  assert(kicks > 0, 'records went through the GPU stream consumer');
  console.log('PASS D3DIM GPU Flip: DIB swap, GPU present, readback only for the front reader, two-frame order, declines');
})().catch(e => { console.error(e); process.exitCode = 1; });
