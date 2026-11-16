'use strict';
// D3DIM device fixture over the WAT GPU stream producer (src/09abg-d3dim-gps.wat).
//
//   real CreateSurface / d3dim_create_device / d3dim_draw_primitive handlers
//        |  $d3dim_gpu_on = 1 (or 0: the WAT software rasterizer)
//        v
//   GPS ring  --gpu_stream_kick-->  lib/gpu-stream-software.js Executor
//
// Replaces the deleted lib/d3dim-gpu.js executor in tests: pixels come back
// only through the producer's own READBACK records (a fence, or a CPU access
// site). The executor's device is sized by the first render target it sees,
// so create the largest target first.
const GS = require('../../lib/gpu-stream');
const { Executor } = require('../../lib/gpu-stream-software');
const { bootRenderHarness } = require('../render-helper');

const WAT = String.raw`
(func (export "gd_seed")
 (global.set $DX_VTBL_DDRAW (i32.const 0x51000000))
 (global.set $DX_VTBL_DDSURF2 (i32.const 0x52000000)))
(func (export "gd_surface") (param $desc i32) (param $out i32) (result i32)
 (local $dd i32)
 (local.set $dd (call $dx_create_com_obj (i32.const 1) (global.get $DX_VTBL_DDRAW)))
 (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
 (call $handle_IDirectDraw_CreateSurface (local.get $dd) (local.get $desc) (local.get $out) (i32.const 0) (i32.const 0) (i32.const 0))
 (i32.load (global.get $reg_base)))
(func (export "gd_device") (param $rt i32) (param $out i32) (result i32)
 (call $d3dim_create_device (i32.const 0) (local.get $rt) (local.get $out) (i32.const 0x53000000))
 (i32.load (global.get $reg_base)))
(export "gd_tss" (func $d3dim_set_tss))
(export "gd_rs" (func $d3dim_set_render_state))
(export "gd_bind" (func $d3dim_set_texture))
(export "gd_caps" (func $d3dim_fill_device_desc7))
(func (export "gd_format") (param $s i32) (param $fmt i32)
 (call $dx_surf_fmt_set (call $dx_from_this (local.get $s)) (local.get $fmt)))
(func (export "gd_flags") (param $s i32) (param $caps i32)
 (i32.store (call $dx_surf_meta_ptr (call $dx_from_this (local.get $s))) (local.get $caps)))
(func (export "gd_gpu") (param $on i32) (global.set $d3dim_gpu_on (local.get $on)))
(func (export "gd_entry") (param $s i32) (result i32) (call $dx_from_this (local.get $s)))
(func (export "gd_next") (param $s i32) (result i32)
 (load.field DxObject misc0 (call $dx_from_this (local.get $s))))
(func (export "gd_draw") (param $dev i32) (param $prim i32) (param $v i32) (param $n i32)
 (call $d3dim_draw_primitive (local.get $dev) (local.get $prim) (i32.const 3) (local.get $v) (local.get $n)))
;; The device's viewport rect (D3DVIEWPORT x/y/w/h), which draws clip to.
(func (export "gd_vprect") (param $dev i32) (param $x i32) (param $y i32) (param $w i32) (param $h i32)
 (local $s i32)
 (local.set $s (i32.add (call $g2w (call $d3ddev_state (local.get $dev))) (global.get $D3DIM_OFF_VP_RECT)))
 (i32.store (local.get $s) (local.get $x)) (i32.store offset=4 (local.get $s) (local.get $y))
 (i32.store offset=8 (local.get $s) (local.get $w)) (i32.store offset=12 (local.get $s) (local.get $h)))
;; The viewport Clear's GPU attempt (1 = taken by the producer); $tex is a
;; background-image surface (this pointer) or 0.
(func (export "gd_clear") (param $s i32) (param $flags i32) (param $color i32) (param $z f32)
    (param $x i32) (param $y i32) (param $w i32) (param $h i32) (param $tex i32) (result i32)
 (call $d3dim_gpu_try_clear (call $dx_from_this (local.get $s)) (local.get $flags) (local.get $color) (local.get $z)
   (local.get $x) (local.get $y) (local.get $w) (local.get $h)
   (if (result i32) (local.get $tex) (then (call $dx_from_this (local.get $tex))) (else (i32.const 0)))))
;; The software viewport fill of the same rect: colour, or the texture stretched.
(func (export "gd_fill") (param $s i32) (param $color i32) (param $x i32) (param $y i32) (param $w i32) (param $h i32) (param $tex i32)
 (if (local.get $tex)
   (then (call $viewport_fill_rect_texture (call $dx_from_this (local.get $s)) (local.get $x) (local.get $y)
     (local.get $w) (local.get $h) (call $dx_from_this (local.get $tex))))
   (else (call $viewport_fill_rect (call $dx_from_this (local.get $s)) (local.get $x) (local.get $y)
     (local.get $w) (local.get $h) (local.get $color)))))
;; IDirectDrawSurface::SetColorKey(DDCKEY_SRCBLT, {lo, hi}) at guest $key.
(func (export "gd_key") (param $s i32) (param $key i32) (result i32)
 (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
 (call $handle_IDirectDrawSurface_SetColorKey (local.get $s) (i32.const 8) (local.get $key) (i32.const 0) (i32.const 0) (i32.const 0))
 (i32.load (global.get $reg_base)))
;; The producer's raw fence (0x20001) over [wa, wa+len); len 0 = every target.
(func (export "gd_fence") (param $wa i32) (param $len i32) (result i32)
 (call $d3dim_gpu_call (i32.const 0x20001) (local.get $wa) (local.get $len)))
`;

// opts.gpu: 1 producer (default), 0 the WAT software rasterizer.
async function bootGpsDevice({ extraWat = '', gpu = 1 } = {}) {
  let ex, memory, executor = null, ring = null, ringAddr = 0;
  const errors = [], kicks = { n: 0 }, hostCalls = [];
  const h = await bootRenderHarness({ fonts: 'none', extraWat: WAT + extraWat,
    extraHostOverrides: {
      // Only $d3dim_gpu_on = 0 reaches the host (the software render Worker
      // seam); 0 = not taken, so the WAT rasterizes.
      gpu_gl_call: (...args) => { hostCalls.push(args); return 0; },
      gpu_stream_kick: (addr, mode) => {
        addr >>>= 0; kicks.n++;
        if (!executor) executor = new Executor({ getExports: () => ex, getMemory: () => memory.buffer });
        if (!ring || ringAddr !== addr) { ring = new GS.Ring(() => memory.buffer, addr); ringAddr = addr; }
        GS.drain([ring], executor);
        if ((mode | 0) === GS.CONST.KICK_CLOSE) { executor.close(); executor = null; ring = null; ringAddr = 0; }
        return 1;
      },
    } });
  ex = h.exports; memory = h.memory;
  const e = ex, m = new DataView(memory.buffer);
  e.gd_seed(); e.gd_gpu(gpu);
  const scratch = e.guest_alloc(0x1000), out = scratch + 0x200;
  const w32 = (a, v) => e.guest_write32(a, v >>> 0);
  const fbits = v => { const b = new DataView(new ArrayBuffer(4)); b.setFloat32(0, v, true); return b.getUint32(0, true); };
  const f32 = (a, v) => w32(a, fbits(v));
  // Pixel formats: [flags, bits, r, g, b, a] at DDPIXELFORMAT +4.
  const PF = { rgb32: [0x40, 32, 0xff0000, 0xff00, 0xff, 0], argb32: [0x41, 32, 0xff0000, 0xff00, 0xff, 0xff000000],
    rgb565: [0x40, 16, 0xf800, 0x7e0, 31, 0], x1: [0x40, 16, 0x7c00, 0x3e0, 31, 0],
    a1: [0x41, 16, 0x7c00, 0x3e0, 31, 0x8000], a4: [0x41, 16, 0xf00, 0xf0, 15, 0xf000] };
  function surface(w, hgt, { caps = 0x40, count = 0, pf = PF.rgb32 } = {}) {
    for (let i = 0; i < 128; i += 4) w32(scratch + i, 0);
    for (const [off, v] of [[0, 108], [4, 0x1007 | (count ? 0x20000 : 0)], [8, hgt], [12, w], [24, count], [72, 32],
      [104, caps], ...pf.map((v, i) => [[76, 84, 88, 92, 96, 100][i], v])]) w32(scratch + off, v);
    const hr = e.gd_surface(scratch, out) >>> 0;
    if (hr !== 0) throw new Error('CreateSurface ' + hr.toString(16));
    return e.guest_read32(out) >>> 0;
  }
  function device(rt) {
    const hr = e.gd_device(rt, out) >>> 0;
    if (hr !== 0) throw new Error('CreateDevice ' + hr.toString(16));
    return e.guest_read32(out) >>> 0;
  }
  const entry = s => e.gd_entry(s) >>> 0;
  const dib = s => m.getUint32(entry(s) + 20, true), pitch = s => m.getUint16(entry(s) + 18, true);
  const width = s => m.getUint16(entry(s) + 12, true), height = s => m.getUint16(entry(s) + 14, true);
  // CPU write of a surface, published the way a guest store would be.
  function cpuWrote(s) { e.page_watch_write(dib(s), pitch(s) * height(s)); }
  function fill32(s, c) {
    for (let y = 0; y < height(s); y++) for (let x = 0; x < width(s); x++) m.setUint32(dib(s) + y * pitch(s) + 4 * x, c >>> 0, true);
    cpuWrote(s);
  }
  let gpuOn = gpu;
  const setGpu = on => { gpuOn = on ? 1 : 0; e.gd_gpu(gpuOn); };
  const fence = () => { if (!gpuOn) return 1; const r = e.gd_fence(0, 0); if (r !== 1 && r !== 2) throw new Error('fence ' + r); return r; };
  // TL vertices: [x, y, z, rhw, diffuse, specular, u, v].
  function vertices(addr, list) {
    list.forEach((v, i) => { const a = addr + i * 32;
      f32(a, v[0]); f32(a + 4, v[1]); f32(a + 8, v[2] ?? 0.5); f32(a + 12, v[3] ?? 1);
      w32(a + 16, v[4] ?? 0xffffffff); w32(a + 20, v[5] ?? 0); f32(a + 24, v[6] ?? 0); f32(a + 28, v[7] ?? 0); });
  }
  const stat = i => e.d3dim_gps_stat(i) >>> 0;
  const stats = () => ({ draws: stat(0), fallbacks: stat(1), readbacks: stat(2), readbackRows: stat(3),
    uploads: stat(4), syncs: stat(7), textureUploads: stat(8), clears: stat(9), points: stat(12),
    fences: stat(13), declined: stat(14), primitives: stat(15), readbackBytes: stat(34),
    declines: Array.from({ length: 8 }, (_, i) => stat(35 + i)) });
  return { h, e, m, memory: () => memory, PF, surface, device, entry, dib, pitch, width, height, cpuWrote, fill32,
    fence, setGpu, vertices, w32, f32, fbits, stat, stats, kicks, errors, hostCalls,
    executor: () => executor };
}

module.exports = { bootGpsDevice };
