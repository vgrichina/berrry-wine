'use strict';
// D3DIM surface fences.
//
// The WAT GPU stream producer (src/09abg-d3dim-gps.wat)
//      draining into the real software executor (lib/gpu-stream-software.js):
//      the producer lowers fences into READBACK records itself and never calls
//      the host's gpu_gl_call. A GPU clear leaves the DIB stale until a CPU
//      reader of THAT surface fences it; pixels and readback counts are checked
//      against what the clear colour must produce in RGB565. Ranged fences
//      read back only aliasing targets and a global fence flushes the rest
//      (these used to be checked on the deleted JS executor lib/d3dim-gpu.js).
//
// The producer accepts lazy Lock publish (0x20007 -> 1): with lazy sync on, a
// Lock of a page-aligned DIB arms the range and reads nothing; the first
// guest access (this instance or another) lands that target once; an
// untouched Unlock does nothing. Lazy off, a Lock reads back eagerly.
// A CPU-source BltFast onto a GPU target is replayed on the GPU (upload, or a
// keyed alpha-tested blit) instead of reading the target back, and five
// Blt-presents exercise $d3g_park_merge (fits: GPU merge; too wide: land).
const assert = require('assert');
const GS = require('../lib/gpu-stream');
const { Executor: SoftwareExecutor } = require('../lib/gpu-stream-software');
const { bootRenderHarness } = require('./render-helper');

async function main() {
  const calls = [];
  let ex, wasmMemory, gps = null, gpsRing = null, gpsRingAddr = 0, kicks = 0;
  const harness = await bootRenderHarness({ fonts: 'none',
    extraHostOverrides: {
      // D3DIM never reaches the host draw seam; asserted empty at the end.
      gpu_gl_call: (...args) => { calls.push(args); return 2; },
      // The GPU stream consumer: drain the WAT-written ring into the software
      // executor, as lib/gpu-stream-host.js does with --d3dim-gpu.
      gpu_stream_kick: (ring, mode) => {
        ring >>>= 0; kicks++;
        if (!gps) gps = new SoftwareExecutor({ getExports: () => ex, getMemory: () => wasmMemory.buffer });
        if (!gpsRing || gpsRingAddr !== ring) { gpsRing = new GS.Ring(() => wasmMemory.buffer, ring); gpsRingAddr = ring; }
        GS.drain([gpsRing], gps);
        if ((mode | 0) === GS.CONST.KICK_CLOSE) { gps.close(); gps = null; gpsRing = null; gpsRingAddr = 0; }
        return 1;
      },
    },
    extraWat: `
      (func (export "test_lazy_replace") (param $this i32) (param $dib i32) (param $pitch i32) (param $size i32)
        (local $ga i32) (local $wa i32)
        (local.set $ga (call $heap_alloc (i32.const 108)))
        (local.set $wa (call $g2w (local.get $ga)))
        (memory.fill (local.get $wa) (i32.const 0) (i32.const 108))
        (i32.store (local.get $wa) (local.get $size))
        (i32.store offset=4 (local.get $wa) (i32.const 0x808))
        (i32.store offset=16 (local.get $wa) (local.get $pitch))
        (i32.store offset=36 (local.get $wa) (call $w2g (local.get $dib)))
        (call $handle_IDirectDrawSurface3_SetSurfaceDesc (local.get $this) (local.get $ga)
          (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
      (func (export "test_lazy_surface") (param $this i32) (result i32)
        (local $entry i32) (local $dib i32)
        (local.set $entry (call $dx_from_this (local.get $this)))
        (local.set $dib (i32.add (global.get $DIB_BACKING_BASE) (i32.const 4096)))
        (store.field DxObject misc1 (local.get $entry) (local.get $dib))
        (store.field DxObject flags (local.get $entry) (i32.const 0))
        (local.get $dib))
      (func (export "test_lazy_surface_at") (param $this i32) (param $off i32) (result i32)
        (local $entry i32) (local $dib i32)
        (local.set $entry (call $dx_from_this (local.get $this)))
        (local.set $dib (i32.add (global.get $DIB_BACKING_BASE) (local.get $off)))
        (store.field DxObject misc1 (local.get $entry) (local.get $dib))
        (store.field DxObject flags (local.get $entry) (i32.const 0))
        (local.get $dib))
      (func (export "test_lazy_epoch") (result i32) (i32.atomic.load (global.get $UOP_WIN_EPOCH)))
      (func (export "test_lazy_float") (param $wa i32) (param $pipeline i32) (result i32)
        (if (local.get $pipeline) (then
          (return (i32.reinterpret_f32 (f32.demote_f64
            (call $x87_pipeline_load (call $w2g (local.get $wa)) (i32.const 0)))))))
        (call $fpu_exec_mem (i32.const 1) (i32.const 0) (call $w2g (local.get $wa)))
        (i32.reinterpret_f32 (f32.demote_f64 (call $fpu_pop))))
      (func (export "test_lazy_wide") (param $wa i32) (param $pipeline i32) (result i64)
        (if (local.get $pipeline) (then
          (return (i64.reinterpret_f64 (call $x87_pipeline_load (call $w2g (local.get $wa)) (i32.const 1))))))
        (call $fpu_exec_mem (i32.const 5) (i32.const 0) (call $w2g (local.get $wa)))
        (i64.reinterpret_f64 (call $fpu_pop)))
      (func (export "test_lazy_arm") (param $this i32) (param $on i32)
        (global.set $d3dim_lazy_on (local.get $on))
        (global.set $d3dim_worker_pending (i32.const 1))
        (call $d3dim_lock_fence (call $dx_from_this (local.get $this))))
      (func (export "test_lazy_unlock") (param $this i32) (result i32)
        (call $d3dim_lazy_unlock (call $dx_from_this (local.get $this))))
      (func (export "test_lazy_scope") (param $this i32) (param $gpu i32) (param $pending i32) (result i32)
        (global.set $d3dim_worker_pending (local.get $pending))
        (call $d3dim_surface_fence (call $dx_from_this (local.get $this)))
        (global.get $d3dim_worker_pending))
      (func (export "test_lazy_access") (param $wa i32) (param $kind i32) (result i32)
        (local $ga i32)
        (local.set $ga (call $w2g (local.get $wa)))
        (if (i32.eq (local.get $kind) (i32.const 1)) (then
          (call $gs16 (local.get $ga) (i32.const 0x1234)) (return (i32.const 0))))
        (if (i32.eq (local.get $kind) (i32.const 2)) (then
          (return (i32.load16_u (call $g2w_affine_span (local.get $ga) (i32.const 4))))))
        (call $gl16 (local.get $ga)))
      (func (export "test_surface_fence") (param $gpu i32) (param $pending i32) (result i32)
        (global.set $d3dim_worker_pending (local.get $pending))
        (store.field DxObject misc1 (global.get $DX_OBJECTS) (i32.const 4096))
        (store.field DxObject pitch (global.get $DX_OBJECTS) (i32.const 1280))
        (store.field DxObject height (global.get $DX_OBJECTS) (i32.const 480))
        (call $d3dim_surface_fence (global.get $DX_OBJECTS))
        (global.get $d3dim_worker_pending))
      (func (export "test_global_fence") (result i32)
        (call $d3dim_worker_fence) (global.get $d3dim_worker_pending))
      (func (export "test_fence_surface") (result i32)
        (local $this i32) (local $entry i32)
        (local.set $this (call $dx_create_com_obj (i32.const 2) (global.get $DX_VTBL_DDSURF3)))
        (local.set $entry (call $dx_from_this (local.get $this)))
        (store.field DxObject width (local.get $entry) (i32.const 2))
        (store.field DxObject height (local.get $entry) (i32.const 1))
        (store.field DxObject bpp (local.get $entry) (i32.const 16))
        (store.field DxObject pitch (local.get $entry) (i32.const 4))
        (store.field DxObject misc1 (local.get $entry) (call $g2w (call $heap_alloc (i32.const 4))))
        (call $dx_surf_fmt_set (local.get $entry) (i32.const 1))
        (local.get $this))
      (func (export "test_fence_dib") (param $this i32) (result i32)
        (load.field DxObject misc1 (call $dx_from_this (local.get $this))))
      (func (export "test_fence_pitch") (param $this i32) (result i32)
        (load.field DxObject pitch (call $dx_from_this (local.get $this))))
      (func (export "test_fence_load") (param $dst i32) (param $src i32)
        (global.set $d3dim_worker_pending (i32.const 1))
        (call $d3dim_texture_load (local.get $dst) (local.get $src)))
      (func (export "test_fence_release") (param $this i32) (param $gpu i32) (param $refs i32) (result i32)
        (global.set $d3dim_worker_pending (i32.const 1))
        (store.field DxObject refcount (call $dx_from_this (local.get $this)) (local.get $refs))
        (call $d3dim_texture_view_release (local.get $this))
        (i32.load (global.get $reg_base)))
      ;; A GPU colour clear of the whole surface through the producer's own
      ;; 0x20004 lowering. The producer clears only a target the GPU has drawn
      ;; on (flag 4, set by a draw); the test marks that instead of drawing.
      (func (export "test_gps_paint") (param $this i32) (param $color i32) (result i32)
        (local $entry i32) (local $pb i32) (local $t i32) (local $ga i32) (local $d i32) (local $r i32)
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
      (func (export "test_fence_surface_w") (param $w i32) (result i32)
        (local $this i32) (local $entry i32)
        (local.set $this (call $dx_create_com_obj (i32.const 2) (global.get $DX_VTBL_DDSURF3)))
        (local.set $entry (call $dx_from_this (local.get $this)))
        (store.field DxObject width (local.get $entry) (local.get $w))
        (store.field DxObject height (local.get $entry) (i32.const 1))
        (store.field DxObject bpp (local.get $entry) (i32.const 16))
        (store.field DxObject pitch (local.get $entry) (i32.shl (local.get $w) (i32.const 1)))
        (store.field DxObject misc1 (local.get $entry)
          (call $g2w (call $heap_alloc (i32.shl (local.get $w) (i32.const 1)))))
        (call $dx_surf_fmt_set (local.get $entry) (i32.const 1))
        (local.get $this))
      (func (export "test_fence_flags") (param $this i32) (param $flags i32)
        (store.field DxObject flags (call $dx_from_this (local.get $this)) (local.get $flags)))
      (func (export "test_fence_key") (param $this i32) (param $key i32)
        (store.field DxObject misc2 (call $dx_from_this (local.get $this)) (local.get $key)))
      ;; BltFast(dst <- src) of a whole w x 1 surface as the handler does it:
      ;; the fence, the CPU copy, then the GPU replay. Returns 1 when the
      ;; destination stayed on the GPU.
      (func (export "test_gps_bltfast") (param $dst i32) (param $src i32) (param $trans i32) (result i32)
        (local $d i32) (local $s i32) (local $gpu i32) (local $w i32)
        (global.set $d3dim_worker_pending (i32.const 1))
        (local.set $d (call $dx_from_this (local.get $dst)))
        (local.set $s (call $dx_from_this (local.get $src)))
        (local.set $w (load.field DxObject width (local.get $s)))
        (local.set $gpu (call $d3dim_blt_fast_fence (local.get $d) (local.get $s) (local.get $trans)))
        (if (i32.and (local.get $trans) (i32.const 1))
          (then (call $dx_ckey_copy_rect
            (load.field DxObject misc1 (local.get $d)) (load.field DxObject pitch (local.get $d)) (i32.const 0) (i32.const 0)
            (load.field DxObject misc1 (local.get $s)) (load.field DxObject pitch (local.get $s)) (i32.const 0) (i32.const 0)
            (local.get $w) (i32.const 1) (i32.const 2) (load.field DxObject misc2 (local.get $s))))
          (else (memory.copy (load.field DxObject misc1 (local.get $d)) (load.field DxObject misc1 (local.get $s))
            (i32.shl (local.get $w) (i32.const 1)))))
        (if (local.get $gpu) (then (call $d3dim_gps_blt_end (local.get $d) (local.get $s)
          (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (local.get $w) (i32.const 1) (local.get $trans))))
        (local.get $gpu))
      ;; Blt(primary <- GPU target) of the 1x1 rect at x through the
      ;; producer's 0x2000A lowering (window 0: screen-relative).
      (func (export "test_gps_blt_present") (param $dst i32) (param $src i32) (param $x i32) (param $sx i32) (result i32)
        (local $ga i32) (local $d i32) (local $r i32)
        (local.set $ga (call $heap_alloc (i32.const 48)))
        (local.set $d (call $g2w (local.get $ga)))
        (memory.fill (local.get $d) (i32.const 0) (i32.const 48))
        (i32.store offset=0 (local.get $d) (i32.const 0x44585033))
        (i32.store offset=4 (local.get $d) (call $dx_from_this (local.get $dst)))
        (i32.store offset=8 (local.get $d) (call $dx_from_this (local.get $src)))
        (i32.store offset=12 (local.get $d) (local.get $x))
        (i32.store offset=20 (local.get $d) (i32.const 1))
        (i32.store offset=24 (local.get $d) (i32.const 1))
        (i32.store offset=28 (local.get $d) (local.get $sx))
        (local.set $r (call $d3dim_gpu_call (i32.const 0x2000A) (local.get $d) (i32.const 48)))
        (call $heap_free (local.get $ga))
        (local.get $r))
      ;; A raw producer fence (0x20001) over [wa, wa+len); len 0 = global.
      (func (export "test_gps_fence") (param $wa i32) (param $len i32) (result i32)
        (call $d3dim_gpu_call (i32.const 0x20001) (local.get $wa) (local.get $len)))
    ` });
  ex = harness.exports; wasmMemory = harness.memory;
  // A zero vtable with uninitialized native tables accidentally compares equal
  // to Surface4/7. Initialize COM and explicitly select Surface3 (108-byte ABI).
  const pe = require('fs').readFileSync(require('path').join(__dirname, 'binaries/calc.exe'));
  new Uint8Array(wasmMemory.buffer).set(pe, ex.get_staging());
  assert(ex.load_pe(pe.length));
  ex.init_dx_com_thunks();
  const other = (await WebAssembly.instantiate(harness.module, { host: harness.host, gdi: harness.gdi })).exports;


  const A = ex.test_fence_surface(), B = ex.test_fence_surface();
  const C = ex.test_fence_surface(), D = ex.test_fence_surface();
  const far = ex.test_fence_surface(), farDib = ex.test_lazy_surface(far);
  const dib = s => ex.test_fence_dib(s);
  const px = s => Array.from(new Uint8Array(wasmMemory.buffer, dib(s), 4));
  const zero = (...ss) => ss.forEach(s => new Uint8Array(wasmMemory.buffer, dib(s), 4).fill(0));


  // ---- WAT GPU stream producer ----
  // Clear colours (D3DCOLOR) and the RGB565 bytes they must land as.
  const RED = 0xffff0000, GREEN = 0xff00ff00, BLUE = 0xff0000ff;
  const red = [0x00, 0xf8, 0x00, 0xf8], green = [0xe0, 0x07, 0xe0, 0x07], blue = [0x1f, 0x00, 0x1f, 0x00];
  const readbacks = () => ex.d3dim_gps_stat(2), fences = () => ex.d3dim_gps_stat(13);
  const paint = (s, color) => assert.strictEqual(ex.test_gps_paint(s, color), 1, 'producer takes the clear');

  // Scoped fences: only the surface asked for reads back.
  zero(A, B);
  paint(A, RED); paint(B, GREEN);
  assert.deepStrictEqual(px(A), [0, 0, 0, 0], 'a GPU clear leaves the DIB alone until a CPU reader asks');
  let r = readbacks();
  assert.strictEqual(ex.test_lazy_scope(far, 1, 1), 1, 'scoped fence preserves global pending state');
  assert.strictEqual(readbacks(), r, 'unrelated surface leaves GPU targets alone');
  assert.strictEqual(ex.test_lazy_scope(A, 1, 1), 1, 'other target keeps pending state');
  assert.strictEqual(readbacks(), r + 1, 'scoped fence reads its own target back once');
  assert.deepStrictEqual(px(A), red, 'scoped fence lands the GPU pixels');
  assert.deepStrictEqual(px(B), [0, 0, 0, 0], 'only the requested surface is synchronized');
  assert.strictEqual(ex.test_lazy_scope(A, 1, 1), 1);
  assert.strictEqual(readbacks(), r + 1, 'a clean target needs no second readback');
  assert.strictEqual(ex.test_lazy_scope(B, 1, 1), 0, 'all targets clean clears pending');
  assert.strictEqual(readbacks(), r + 2);
  assert.deepStrictEqual(px(B), green);
  let f = fences();
  assert.strictEqual(ex.test_global_fence(), 0);
  assert.strictEqual(fences(), f, 'no redundant global barrier after full synchronization');

  // Nothing outstanding: no producer fence at all.
  paint(A, BLUE); zero(A);
  f = fences(); r = readbacks();
  assert.strictEqual(ex.test_lazy_scope(A, 1, 0), 0);
  assert.strictEqual(fences(), f, 'no outstanding GPU work means no producer fence');
  assert.strictEqual(ex.test_global_fence(), 0);
  assert.strictEqual(ex.test_gps_fence(0, 0), 1, 'a global producer barrier flushes the clear');
  assert.strictEqual(readbacks(), r + 1);
  assert.deepStrictEqual(px(A), blue);

  // Range aliasing at the producer boundary.
  paint(A, RED); paint(B, GREEN); zero(A, B); r = readbacks();
  assert.strictEqual(ex.test_gps_fence(dib(A) + 2, 1), 2, 'B is still GPU-only');
  assert.strictEqual(readbacks(), r + 1, 'partial backing alias synchronizes its target');
  assert.deepStrictEqual(px(A), red);
  assert.strictEqual(ex.test_gps_fence(dib(B) - 4, 4), 2);
  assert.strictEqual(readbacks(), r + 1, 'touching but nonoverlapping range is not an alias');
  assert.deepStrictEqual(px(B), [0, 0, 0, 0]);
  assert.strictEqual(ex.test_gps_fence(0, 0), 1);
  assert.strictEqual(readbacks(), r + 2, 'global barrier still flushes the remaining target');
  assert.deepStrictEqual(px(B), green);
  assert.strictEqual(ex.test_gps_fence(0, 0), 1);
  assert.strictEqual(readbacks(), r + 2, 'clean targets need no readback');

  // Lock with lazy sync off (or an unaligned heap DIB): eager, one readback.
  paint(A, GREEN); zero(A); r = readbacks();
  ex.test_lazy_arm(A, 0);
  assert.strictEqual(readbacks(), r + 1, 'option off keeps the eager Lock');
  assert.deepStrictEqual(px(A), green);
  assert.strictEqual(ex.test_lazy_unlock(A), 0, 'nothing armed to drop');

  // Lazy Lock through the producer's 0x20007: Lock arms the page-aligned
  // DIB and reads nothing; the first real access lands exactly that target,
  // once (readback site 14); an untouched Unlock does nothing.
  const L = ex.test_fence_surface(), lDib = ex.test_lazy_surface_at(L, 16384);
  const lpx = () => Array.from(new Uint8Array(wasmMemory.buffer, lDib, 4));
  const lzero = () => new Uint8Array(wasmMemory.buffer, lDib - 4, 12).fill(0);
  const cnt = () => [ex.get_d3dim_lazy_armed(), ex.get_d3dim_lazy_touched(), ex.get_d3dim_lazy_untouched()];
  const lazyRb = () => ex.d3dim_gps_stat(16 + 14);
  const arm = () => { paint(L, RED); lzero(); r = readbacks(); ex.test_lazy_arm(L, 1); };
  let c0 = cnt(), lr = lazyRb();
  const epoch = ex.test_lazy_epoch();
  arm();
  assert.notStrictEqual(ex.test_lazy_epoch(), epoch, 'arm invalidates cached native read windows');
  assert.deepStrictEqual(cnt(), [c0[0] + 1, c0[1], c0[2]], 'Lock arms one lazy range');
  assert.strictEqual(readbacks(), r, 'Lock defers the readback');
  assert.strictEqual(ex.test_lazy_unlock(L), 1, 'untouched Unlock drops only the access barrier');
  assert.deepStrictEqual(cnt(), [c0[0] + 1, c0[1], c0[2] + 1]);
  assert.strictEqual(readbacks(), r, 'untouched Lock cycle reads nothing back');
  assert.deepStrictEqual(lpx(), [0, 0, 0, 0], 'GPU pixels stay on the GPU');

  arm(); c0 = cnt();
  ex.test_lazy_access(lDib + 4096, 0);
  assert.strictEqual(readbacks(), r, 'an unrelated DIB read does not synchronize');
  assert.strictEqual(ex.test_lazy_access(lDib, 0), 0xf800, 'first read sees fresh GPU pixels');
  assert.strictEqual(readbacks(), r + 1, 'exactly one readback');
  assert.strictEqual(lazyRb(), lr + 1, 'charged to the lazy site');
  assert.deepStrictEqual(cnt(), [c0[0], c0[1] + 1, c0[2]], 'one touch counted');
  ex.test_lazy_access(lDib + 2, 0);
  assert.strictEqual(readbacks(), r + 1, 'later accesses need no barrier');
  assert.strictEqual(ex.test_lazy_unlock(L), 0, 'a touched Unlock has nothing armed');

  arm();
  ex.test_lazy_access(lDib, 1);
  assert.deepStrictEqual(lpx(), [0x34, 0x12, 0x00, 0xf8],
    'partial write happens AFTER readback and preserves untouched GPU pixels');
  assert.strictEqual(readbacks(), r + 1);
  assert.strictEqual(ex.test_gps_fence(0, 0), 1);
  assert.deepStrictEqual(lpx(), [0x34, 0x12, 0x00, 0xf8], 'later fences preserve the CPU write');
  ex.test_lazy_unlock(L);

  arm();
  assert.strictEqual(ex.test_lazy_access(lDib, 2), 0xf800, 'native span proof synchronizes too');
  assert.strictEqual(readbacks(), r + 1);
  ex.test_lazy_unlock(L);

  arm();
  assert.strictEqual(ex.test_global_fence(), 0);
  assert.strictEqual(readbacks(), r + 1, 'a global barrier lands the deferred target');
  assert.strictEqual(ex.test_lazy_unlock(L), 0, 'and disarms the stale range');

  for (const pipeline of [0, 1]) {
    arm();
    assert.strictEqual(ex.test_lazy_float(lDib - 2, pipeline) >>> 0, 0xf8000000,
      'baseline and folded float32 reads synchronize across the surface start');
    assert.strictEqual(readbacks(), r + 1);
    ex.test_lazy_unlock(L);
    arm();
    assert.strictEqual(BigInt.asUintN(64, ex.test_lazy_wide(lDib - 4, pipeline)), 0xf800f80000000000n,
      'baseline and folded wide reads synchronize before crossing an aligned surface start');
    assert.strictEqual(readbacks(), r + 1);
    ex.test_lazy_unlock(L);
  }

  // Cross-thread: another instance on the same memory touches the range.
  for (const kind of [0, 1, 2]) {
    arm();
    const value = other.test_lazy_access(lDib, kind);
    if (kind !== 1) assert.strictEqual(value, 0xf800, 'foreign instance sees fresh pixels');
    assert.strictEqual(readbacks(), r + 1, 'foreign touch reads back once');
    assert.strictEqual(ex.test_lazy_unlock(L), 0, 'foreign touch is visible to the locking thread');
    ex.test_global_fence();
    assert.strictEqual(new Uint16Array(wasmMemory.buffer, lDib, 1)[0], kind === 1 ? 0x1234 : 0xf800,
      'a later owner fence preserves foreign writes');
  }
  ex.test_lazy_arm(L, 0);

  // Another wasm instance on the same memory drives the same shared producer.
  paint(A, BLUE); zero(A); r = readbacks();
  assert.strictEqual(other.test_lazy_scope(A, 1, 1), 0);
  assert.strictEqual(readbacks(), r + 1, 'foreign instance fence reads back through the shared producer');
  assert.deepStrictEqual(px(A), blue);

  // Texture::Load fences both ends before the CPU copy.
  paint(C, RED); paint(D, GREEN); zero(C, D); r = readbacks();
  ex.test_fence_load(D, C);
  assert.strictEqual(readbacks(), r + 2, 'Texture::Load synchronizes both source and destination backing');
  assert.deepStrictEqual(px(C), red);
  assert.deepStrictEqual(px(D), red, 'texture copy consumes fresh GPU pixels rather than stale CPU source');

  // SetSurfaceDesc fences the original backing before replacing it.
  const E = ex.test_fence_surface(), eDib = ex.test_lazy_surface(E);
  const ePixels = new Uint8Array(wasmMemory.buffer, eDib, 4);
  ePixels.fill(0); paint(E, RED); r = readbacks();
  for (const size of [0, 124]) {
    ex.test_lazy_replace(E, eDib + 4096, 8, size);
    assert.equal(ex.get_eax() >>> 0, 0x80070057, 'invalid Surface3 descriptor size is rejected');
    assert.strictEqual(readbacks(), r, 'invalid descriptor does not consume pending work');
    assert.equal(ex.test_fence_dib(E), eDib);
    assert.equal(ex.test_fence_pitch(E), 4);
    assert.deepStrictEqual(Array.from(ePixels), [0, 0, 0, 0]);
  }
  const replacement = new Uint8Array(wasmMemory.buffer, eDib + 4096, 8);
  replacement.set([0x1f, 0, 0xff, 0xff, 0xa5, 0xa5, 0xa5, 0xa5]);
  ex.test_lazy_replace(E, eDib + 4096, 8, 108);
  assert.equal(ex.get_eax() >>> 0, 0, 'valid Surface3 descriptor succeeds');
  assert.strictEqual(readbacks(), r + 1, 'replacement fences the original backing before changing it');
  assert.deepStrictEqual(Array.from(ePixels), red, 'detached backing contains completed GPU pixels');
  assert.equal(ex.test_fence_dib(E), eDib + 4096);
  assert.equal(ex.test_fence_pitch(E), 8);
  assert.deepStrictEqual(Array.from(replacement), [0x1f, 0, 0xff, 0xff, 0xa5, 0xa5, 0xa5, 0xa5],
    'replacement preserves caller pixels and padded pitch');
  ePixels.fill(0x34);
  assert.strictEqual(ex.test_gps_fence(0, 0), 1);
  assert.deepStrictEqual(Array.from(ePixels), [0x34, 0x34, 0x34, 0x34],
    'later fence cannot overwrite the detached allocation after reuse');

  // Texture view release: a nonfinal drop reads nothing; the final one lands it.
  paint(C, BLUE); zero(C); r = readbacks();
  assert.strictEqual(ex.test_fence_release(C, 1, 2), 1);
  assert.strictEqual(readbacks(), r, 'nonfinal GPU texture view release needs no readback');
  assert.deepStrictEqual(px(C), [0, 0, 0, 0]);
  assert.strictEqual(ex.test_fence_release(C, 1, 1), 0);
  assert.strictEqual(readbacks(), r, 'final release of storage it frees reads nothing back');
  // Client memory (DDSD_LPSURFACE, flag 0x200) outlives the surface: the
  // guest can still read it, so the final release lands the GPU pixels.
  const M = ex.test_fence_surface();
  ex.test_fence_flags(M, 0x200);
  paint(M, GREEN); zero(M); r = readbacks();
  const mDib = dib(M);
  assert.strictEqual(ex.test_fence_release(M, 1, 1), 0);
  assert.strictEqual(readbacks(), r + 1, 'final release of client memory reads it back');
  assert.deepStrictEqual(Array.from(new Uint8Array(wasmMemory.buffer, mDib, 4)), green,
    'client memory holds the GPU pixels after Release');

  // BltFast(GPU target <- CPU surface) replays on the GPU: no readback.
  const G = ex.test_fence_surface(), S = ex.test_fence_surface();
  const setPx = (s, b) => new Uint8Array(wasmMemory.buffer, dib(s), b.length).set(b);
  paint(G, RED); zero(G); setPx(S, [0x1f, 0x00, 0xe0, 0x07]); r = readbacks();
  let up = ex.d3dim_gps_stat(33), keyed = ex.d3dim_gps_stat(32);  assert.strictEqual(ex.test_gps_bltfast(G, S, 0), 1, 'unkeyed CPU-source BltFast stays on the GPU');
  assert.strictEqual(readbacks(), r, 'no readback of the GPU destination');
  assert.strictEqual(ex.d3dim_gps_stat(33), up + 1);
  ex.test_lazy_scope(G, 1, 1);
  assert.strictEqual(readbacks(), r + 1, 'the reader fences it once');
  assert.deepStrictEqual(px(G), [0x1f, 0x00, 0xe0, 0x07], 'the GPU copy holds the uploaded pixels');
  paint(G, RED); zero(G); ex.test_fence_key(S, 0x001f); r = readbacks();
  assert.strictEqual(ex.test_gps_bltfast(G, S, 1), 1, 'source-keyed BltFast onto a drawn target stays on the GPU');
  assert.strictEqual(readbacks(), r, 'keyed copy needs no readback either');
  assert.strictEqual(ex.d3dim_gps_stat(32), keyed + 1);
  ex.test_lazy_scope(G, 1, 1);
  assert.deepStrictEqual(px(G), [0x00, 0xf8, 0xe0, 0x07], 'keyed texel keeps the GPU pixel, the other lands');
  paint(G, RED); r = readbacks();
  assert.strictEqual(ex.test_gps_bltfast(G, S, 2), 0, 'DESTCOLORKEY stays a CPU copy');
  assert.strictEqual(readbacks(), r + 1, 'so the destination reads back first');

  // $d3g_park_merge: five non-covering Blt-present rects fill the four park
  // slots; the fifth merges the two oldest on the GPU (union seeded from the
  // primary's DIB). Nothing reads back until a CPU reader fences the primary.
  // Source targets stay 2x1: the software executor's device is that size.
  const T = ex.test_fence_surface_w(2), P = ex.test_fence_surface_w(8);
  const pxs = (s, n) => Array.from(new Uint8Array(wasmMemory.buffer, dib(s), n));
  paint(T, RED);
  new Uint8Array(wasmMemory.buffer, dib(P), 16).fill(0xa5);
  r = readbacks();
  let land = ex.d3dim_gps_stat(16 + 9);
  for (const x of [0, 1, 4, 6, 7])
    assert.strictEqual(ex.test_gps_blt_present(P, T, x, x & 1), 1, `Blt-present at ${x} is taken`);
  assert.strictEqual(readbacks(), r, 'parking and the GPU merge read nothing back');
  assert.strictEqual(ex.d3dim_gps_stat(16 + 9), land, 'merge of a union that fits lands nothing');
  assert.deepStrictEqual(pxs(P, 16), Array(16).fill(0xa5), 'primary DIB untouched while parked');
  ex.test_lazy_scope(P, 1, 1);
  const R5 = [0x00, 0xf8], K = [0xa5, 0xa5];
  assert.deepStrictEqual(pxs(P, 16), [R5, R5, K, K, R5, K, R5, R5].flat(),
    'landing writes every parked rect, the merged pair included');
  // A union wider than the source target cannot merge: the oldest lands.
  const T2 = ex.test_fence_surface_w(2), P2 = ex.test_fence_surface_w(16);
  paint(T2, GREEN);
  new Uint8Array(wasmMemory.buffer, dib(P2), 32).fill(0xa5);
  for (const x of [0, 12, 4, 8]) assert.strictEqual(ex.test_gps_blt_present(P2, T2, x, x & 1), 1);
  r = readbacks(); land = ex.d3dim_gps_stat(16 + 9);
  assert.strictEqual(ex.test_gps_blt_present(P2, T2, 15, 1), 1);
  assert.strictEqual(ex.d3dim_gps_stat(16 + 9), land + 1, 'too-wide union lands the oldest slot');
  assert.strictEqual(readbacks(), r + 1, 'with one readback');
  assert.deepStrictEqual(pxs(P2, 2), [0xe0, 0x07], 'the oldest rect reached the DIB');
  ex.test_lazy_scope(P2, 1, 1);
  const G5 = [0xe0, 0x07], K2 = [0xa5, 0xa5];
  assert.deepStrictEqual(pxs(P2, 32), [...G5, K2, K2, K2, G5, K2, K2, K2, G5, K2, K2, K2, G5, K2, K2, G5].flat(),
    'every rect lands once the primary is fenced');

  assert.deepStrictEqual(calls, [], 'the WAT producer never calls the host gpu_gl_call');
  assert(kicks > 0 && gps, 'records went through the GPU stream consumer');
  assert.strictEqual(farDib, ex.test_fence_dib(far));
  console.log('PASS surface fences: aliases, pixels, dirty state, global/software ordering, WAT producer');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
