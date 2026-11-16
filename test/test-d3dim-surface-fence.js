'use strict';
// D3DIM surface fences.
//
//   1. lib/d3dim-gpu.js (the JS WebGL executor) on its own: ranged fences read
//      back only aliasing targets, a global fence flushes the rest.
//   2. $d3dim_gpu_on = 0, the software render Worker: the host owns every
//      fence, and the WAT keeps global ordering (FENCE 0,0).
//   3. $d3dim_gpu_on = 1, the WAT GPU stream producer (src/09abg-d3dim-gps.wat)
//      draining into the real software executor (lib/gpu-stream-software.js):
//      the producer lowers fences into READBACK records itself and never calls
//      the host's gpu_gl_call. A GPU clear leaves the DIB stale until a CPU
//      reader of THAT surface fences it; pixels and readback counts are checked
//      against what the clear colour must produce in RGB565.
//
// The producer declines lazy Lock publish (0x20007 -> 0), so a Lock on a GPU
// surface reads back eagerly, once, and the access hooks have nothing armed.
const assert = require('assert');
const { D3DIMGpu, OPCODES } = require('../lib/d3dim-gpu');
const GS = require('../lib/gpu-stream');
const { Executor: SoftwareExecutor } = require('../lib/gpu-stream-software');
const { bootRenderHarness } = require('./render-helper');

async function main() {
  const memory = new ArrayBuffer(65536), bytes = new Uint8Array(memory);
  const reads = [], writes = [];
  const gpu = new D3DIMGpu({ getMemory: () => memory,
    getExports: () => ({ page_watch_write: (a, n) => writes.push([a, n]) }),
    createCanvas: () => { throw Error('unexpected allocation'); } });
  function target(id, dib) {
    const t = { rt: id, dib, width: 2, height: 1, pitch: 4, bpp: 16,
      format: 1, dirty: true, device: { gpu: { bindImplicitTarget() {}, gl: {
        RGBA: 1, UNSIGNED_BYTE: 2,
        readPixels(x, y, w, h, f, ty, out) {
          reads.push(id); out.set([255, 0, 0, 255, 0, 255, 0, 255]);
        },
      } } } };
    gpu.targets.set(id, t); return t;
  }
  const a = target(1, 4096), b = target(2, 8192);
  assert.strictEqual(gpu.call(OPCODES.FENCE, 16384, 4), 2);
  assert.deepStrictEqual(reads, [], 'unrelated surface leaves GPU targets alone');
  assert(a.dirty && b.dirty);
  assert.strictEqual(gpu.call(OPCODES.FENCE, 4098, 1), 2);
  assert.deepStrictEqual(reads, [1], 'partial backing alias synchronizes its target');
  assert(!a.dirty && b.dirty, 'other target remains pending');
  assert.deepStrictEqual(Array.from(bytes.slice(4096, 4100)), [0, 248, 224, 7]);
  assert.deepStrictEqual(writes, [[4096, 4]], 'readback marks changed backing bytes');
  gpu.call(OPCODES.FENCE, 8188, 4);
  assert(b.dirty, 'touching but nonoverlapping range is not an alias');
  assert.strictEqual(gpu.call(OPCODES.FENCE, 0, 0), 1);
  assert.deepStrictEqual(reads, [1, 2], 'global barrier still flushes remaining target');
  gpu.call(OPCODES.FENCE, 0, 0);
  assert.strictEqual(reads.length, 2, 'clean targets need no readback');

  const calls = [];
  let ex, wasmMemory, gps = null, gpsRing = null, gpsRingAddr = 0, kicks = 0;
  const harness = await bootRenderHarness({ fonts: 'none',
    extraHostOverrides: {
      // Only the software render Worker ($d3dim_gpu_on = 0) may reach this.
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
      (func (export "test_lazy_arm") (param $this i32) (param $on i32)
        (global.set $d3dim_lazy_on (local.get $on))
        (global.set $d3dim_gpu_on (i32.const 1))
        (global.set $d3dim_worker_pending (i32.const 1))
        (call $d3dim_lock_fence (call $dx_from_this (local.get $this))))
      (func (export "test_lazy_unlock") (param $this i32) (result i32)
        (call $d3dim_lazy_unlock (call $dx_from_this (local.get $this))))
      (func (export "test_lazy_scope") (param $this i32) (param $gpu i32) (param $pending i32) (result i32)
        (global.set $d3dim_gpu_on (local.get $gpu))
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
        (global.set $d3dim_gpu_on (local.get $gpu))
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
        (global.set $d3dim_gpu_on (i32.const 1))
        (global.set $d3dim_worker_pending (i32.const 1))
        (call $d3dim_texture_load (local.get $dst) (local.get $src)))
      (func (export "test_fence_release") (param $this i32) (param $gpu i32) (param $refs i32) (result i32)
        (global.set $d3dim_gpu_on (local.get $gpu))
        (global.set $d3dim_worker_pending (i32.const 1))
        (store.field DxObject refcount (call $dx_from_this (local.get $this)) (local.get $refs))
        (call $d3dim_texture_view_release (local.get $this))
        (i32.load (global.get $reg_base)))
      ;; A GPU colour clear of the whole surface through the producer's own
      ;; 0x20004 lowering. The producer clears only a target the GPU has drawn
      ;; on (flag 4, set by a draw); the test marks that instead of drawing.
      (func (export "test_gps_paint") (param $this i32) (param $color i32) (result i32)
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
      ;; A raw producer fence (0x20001) over [wa, wa+len); len 0 = global.
      (func (export "test_gps_fence") (param $wa i32) (param $len i32) (result i32)
        (global.set $d3dim_gpu_on (i32.const 1))
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

  // ---- 2. Software render Worker ($d3dim_gpu_on = 0): global ordering ----
  assert.strictEqual(ex.test_surface_fence(0, 1), 0, 'software Worker keeps global fence');
  assert.deepStrictEqual(calls.splice(0), [[OPCODES.FENCE, 0, 0]]);
  assert.strictEqual(ex.test_surface_fence(0, 0), 0);
  assert.deepStrictEqual(calls, [], 'no outstanding Worker work means no host call');
  assert.strictEqual(ex.test_global_fence(), 0);
  assert.deepStrictEqual(calls, [], 'no redundant global barrier once the Worker drained');

  const A = ex.test_fence_surface(), B = ex.test_fence_surface();
  const C = ex.test_fence_surface(), D = ex.test_fence_surface();
  const far = ex.test_fence_surface(), farDib = ex.test_lazy_surface(far);
  const dib = s => ex.test_fence_dib(s);
  const px = s => Array.from(new Uint8Array(wasmMemory.buffer, dib(s), 4));
  const zero = (...ss) => ss.forEach(s => new Uint8Array(wasmMemory.buffer, dib(s), 4).fill(0));

  assert.strictEqual(ex.test_fence_release(C, 0, 2), 1);
  assert.deepStrictEqual(calls.splice(0), [[OPCODES.FENCE, 0, 0]], 'software release still drains queued work');
  assert.strictEqual(ex.test_lazy_scope(C, 0, 1), 0, 'software path still completes its global barrier');
  assert.deepStrictEqual(calls.splice(0), [[OPCODES.FENCE, 0, 0]], 'software fallback synchronizes all targets');

  // ---- 3. WAT GPU stream producer ($d3dim_gpu_on = 1) ----
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

  // Lock/Unlock: the producer declines lazy publish, so Lock is the reader.
  const armed = ex.get_d3dim_lazy_armed();
  paint(A, RED); zero(A); r = readbacks();
  ex.test_lazy_arm(A, 1);
  assert.strictEqual(ex.get_d3dim_lazy_armed(), armed, 'WAT producer declines 0x20007: no lazy range is armed');
  assert.strictEqual(readbacks(), r + 1, 'Lock synchronizes its surface once');
  assert.deepStrictEqual(px(A), red, 'locked bytes hold the GPU pixels');
  assert.strictEqual(ex.test_lazy_unlock(A), 0, 'Unlock has no armed range to drop');
  assert.strictEqual(readbacks(), r + 1, 'untouched Unlock needs no readback');
  assert.strictEqual(ex.test_lazy_access(dib(A), 0), 0xf800, 'first read sees fresh GPU pixels');
  assert.strictEqual(ex.test_lazy_access(dib(A) + 2, 2), 0xf800, 'native span read sees them too');
  assert.strictEqual(readbacks(), r + 1, 'reads after Lock need no further barrier');
  paint(A, RED); zero(A); r = readbacks();
  ex.test_lazy_arm(A, 1);
  ex.test_lazy_access(dib(A), 1);
  assert.deepStrictEqual(px(A), [0x34, 0x12, 0x00, 0xf8],
    'partial write happens AFTER readback and preserves untouched GPU pixels');
  assert.strictEqual(readbacks(), r + 1);
  assert.strictEqual(ex.test_global_fence(), 0);
  assert.strictEqual(ex.test_gps_fence(0, 0), 1);
  assert.deepStrictEqual(px(A), [0x34, 0x12, 0x00, 0xf8], 'later fences preserve the CPU write');
  assert.strictEqual(readbacks(), r + 1);
  paint(A, GREEN); zero(A); r = readbacks();
  ex.test_lazy_arm(A, 0);
  assert.strictEqual(readbacks(), r + 1, 'option off keeps the same eager Lock');
  assert.deepStrictEqual(px(A), green);

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
  assert.strictEqual(readbacks(), r + 1, 'final release retains the global lifetime barrier');

  assert.deepStrictEqual(calls, [], 'the WAT producer never calls the host gpu_gl_call');
  assert(kicks > 0 && gps, 'records went through the GPU stream consumer');
  assert.strictEqual(farDib, ex.test_fence_dib(far));
  console.log('PASS surface fences: aliases, pixels, dirty state, global/software ordering, WAT producer');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
