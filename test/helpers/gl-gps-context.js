'use strict';
// A real OpenGL context on the software GL path, with or without the GPU
// stream v2 producer (src/09a8gt-gl-gps.wat) in front of it.
//
//   guest GL call -> real opengl32 resolver/thunk -> WAT encoder
//        -> $gl_sw_consume (09a8g) -> $glg_* (09a8gt) when gps is on
//        -> GPS ring --gpu_stream_kick--> lib/gpu-stream-software.js Executor
//
// The gl-gps tests run one scene on both arms and compare the presented
// front buffers: pixels reach the CPU only through the producer's own
// READBACK records ($glg_front_sync on gl_gps_sync_front).
//
// opts.gps: 1 = producer on; opts.dropCaps: GPS_CAP_* bits the executor
// pretends it lacks (the caps-missing decline paths).
const assert = require('assert');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const req = p => require(path.join(root, p));
const GS = req('lib/gpu-stream');
const { Executor } = req('lib/gpu-stream-software');
const { bootRenderHarness } = req('test/render-helper');
const { OpenGLHostBridge } = req('lib/gl-compat');
const Stream = req('lib/gl-command-stream');
const table = req('src/api_table.json');

const WAT = String.raw`
 (func (export "probe_init")
   (global.set $thunk_guest_base (i32.add (global.get $image_base)
     (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
   (call $update_thunk_end))
 (func (export "probe_regs") (result i32) (global.get $reg_base))
 (func (export "probe_module") (param $name i32) (result i32)
   (call $handle_LoadLibraryA (local.get $name) (i32.const 0) (i32.const 0)
     (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "probe_lookup") (param $module i32) (param $name i32) (result i32)
   (call $handle_GetProcAddress (local.get $module) (local.get $name)
     (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
   (i32.load (global.get $reg_base)))
 (func (export "probe_dc") (param $hwnd i32) (result i32)
   (call $handle_GetDC (i32.const 0) (i32.const 0) (i32.const 0)
     (i32.const 0) (i32.const 0) (i32.const 0))
   (drop (call $gdi_dc_set_field (i32.load (global.get $reg_base)) (i32.const 92) (local.get $hwnd) (i32.const 0)))
   (i32.load (global.get $reg_base)))
 (func (export "probe_invoke") (param $thunk i32) (result i32)
   (call $win32_dispatch (i32.div_u
     (i32.sub (local.get $thunk) (global.get $thunk_guest_base)) (i32.const 8)))
   (i32.load (global.get $reg_base)))`;

const STAT_NAMES = ['draws', 'tris', 'spanQuads', 'clears', 'presents', 'readbacks', 'readbackRows',
  'rtUploads', 'rtUploadRows', 'texUploads', 'gpuFrames', 'swFrames', 'syncs', 'texHits',
  'declines', 'declinedFrames'];

async function bootGlGps({ gps = 1, dropCaps = 0, size = 16 } = {}) {
  let memory, bridge, executor = null, ring = null, ringAddr = 0;
  const kicks = { n: 0, records: {} };
  const h = await bootRenderHarness({ fonts: 'none', width: size, height: size, extraWat: WAT,
    extraHostOverrides: {
      gpu_gl_call(op, at, bytes) {
        if (op === Stream.WAT_STREAM_FLUSH_OPCODE) return bridge.replay(Stream.memoryBatch(memory, at, bytes));
        if (op >= 0x20000 && op <= 0x20006) return 0;
        throw Error('unexpected host opcode ' + op);
      },
      gpu_stream_kick(addr, mode) {
        addr >>>= 0; kicks.n++;
        if (!executor) {
          executor = new Executor({ getExports: () => h.exports, getMemory: () => memory.buffer });
          if (dropCaps) {
            const caps = executor.caps.bind(executor);
            executor.caps = () => { const c = caps(); return { ...c, flags: (c.flags & ~dropCaps) >>> 0 }; };
          }
          const run = executor.execute ? 'execute' : null;
          if (run) {
            const orig = executor[run].bind(executor);
            executor[run] = (rec, ...rest) => { kicks.records[rec.op] = (kicks.records[rec.op] || 0) + 1; return orig(rec, ...rest); };
          }
        }
        if (!ring || ringAddr !== addr) { ring = new GS.Ring(() => memory.buffer, addr); ringAddr = addr; }
        GS.drain([ring], executor);
        if ((mode | 0) === GS.CONST.KICK_CLOSE) { executor.close(); executor = null; ring = null; ringAddr = 0; }
        return 1;
      },
    } });
  memory = h.memory;
  const e = h.exports, dv = () => new DataView(memory.buffer), wa = p => e.guest_to_wasm(p) >>> 0;
  e.init_thread(1, 0x400000, 0, 0, 0, 0, 0); e.heap_init(0x800000);
  const renderer = { windows: { 42: { hwnd: 42, w: size, h: size, clientRect: { w: size, h: size } } }, repaint() {} };
  bridge = new OpenGLHostBridge({ backend: 'software', getMemory: () => memory.buffer, exports: e, renderer });
  if (gps) e.gl_gps_enable(1);
  e.probe_init();
  const regs = e.probe_regs(), stack = e.guest_alloc(256) >>> 0, stackWa = wa(stack);
  const str = s => { const p = e.guest_alloc(s.length + 1) >>> 0; new Uint8Array(memory.buffer, wa(p), s.length + 1).set(Buffer.from(s + '\0')); return p; };
  const gl32 = e.probe_module(str('opengl32.dll')) >>> 0; assert(gl32);
  const user32 = e.probe_module(str('user32.dll')) >>> 0; assert(user32);
  const cache = new Map();
  const resolve = name => {
    if (!cache.has(name)) {
      dv().setUint32(regs + 16, stack, true);
      cache.set(name, e.probe_lookup(/^(gl|wgl)/.test(name) ? gl32 : user32, str(name)) >>> 0);
    }
    return cache.get(name);
  };
  function call(name, args = []) {
    const p = resolve(name); assert(p, 'real resolver: ' + name);
    const api = table.find(a => a.name === name); assert.strictEqual(dv().getUint32(wa(p) + 4, true), api.id);
    dv().setUint32(regs + 16, stack, true);
    dv().setUint32(stackWa, 0x12345678, true);
    args.forEach((x, i) => dv().setUint32(stackWa + 4 + i * 4, x >>> 0, true));
    return e.probe_invoke(p) >>> 0;
  }
  const f = x => { const b = new DataView(new ArrayBuffer(4)); b.setFloat32(0, x, true); return b.getUint32(0, true); };
  const dc = e.probe_dc(42) >>> 0; assert(dc);
  const context = call('wglCreateContext', [dc]); assert(context);
  assert.strictEqual(call('wglMakeCurrent', [dc, context]), 1);
  call('glViewport', [0, 0, size, size]);
  const stat = i => e.gl_gps_stat(i) >>> 0;
  const stats = () => {
    const s = Object.fromEntries(STAT_NAMES.map((n, i) => [n, stat(i)]));
    s.reasons = {}; for (let r = 1; r < 32; r++) if (stat(16 + r)) s.reasons[r] = stat(16 + r);
    s.sites = {}; for (let r = 0; r < 16; r++) if (stat(48 + r)) s.sites[r] = stat(48 + r);
    s.frontPresents = stat(64); s.cpuStencil = stat(65); s.canonDeclines = stat(66);
    return s;
  };
  // The presented picture: the front DIB, after the producer has landed its
  // front RT there (a counted readback on the gps arm).
  function front() {
    if (gps) e.gl_gps_sync_front();
    const entry = e.gl_sw_front() >>> 0; assert(entry, 'drawable has a front');
    const d = dv(), dib = d.getUint32(entry + 20, true), pitch = d.getUint16(entry + 18, true);
    const w = d.getUint16(entry + 12, true), hh = d.getUint16(entry + 14, true);
    const px = new Uint32Array(w * hh);
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) px[y * w + x] = d.getUint32(dib + y * pitch + x * 4, true) & 0xffffff;
    return { w, h: hh, px };
  }
  const swap = () => call('wglSwapBuffers', [dc]);
  // Primitive helpers: colour per vertex, clip-space x/y/z.
  function prim(mode, verts, color) {
    if (color) call('glColor4f', color.map(f));
    call('glBegin', [mode]);
    for (const v of verts) {
      if (v.c) call('glColor4f', v.c.map(f));
      if (v.t) call(v.t.length > 2 ? 'glTexCoord4f' : (v.t.length > 1 ? 'glTexCoord2f' : 'glTexCoord1f'), v.t.map(f));
      call('glVertex3f', [f(v.x), f(v.y), f(v.z || 0)]);
    }
    call('glEnd');
  }
  const quad = (x0, y0, x1, y1, color, extra = {}) => prim(7, [
    { x: x0, y: y0, t: extra.t && extra.t[0] }, { x: x1, y: y0, t: extra.t && extra.t[1] },
    { x: x1, y: y1, t: extra.t && extra.t[2] }, { x: x0, y: y1, t: extra.t && extra.t[3] }], color);
  const clear = (rgba, mask = 0x4000) => { call('glClearColor', rgba.map(f)); call('glClear', [mask]); };
  return { e, memory, call, f, stats, front, swap, prim, quad, clear, kicks, wa, size, str };
}

// The two arms' presented pictures: equal within $tol per channel.
function comparePictures(a, b, tol = 1) {
  assert.strictEqual(a.w, b.w); assert.strictEqual(a.h, b.h);
  let worst = 0, differ = 0, at = -1;
  for (let i = 0; i < a.px.length; i++) {
    let m = 0;
    for (let s = 0; s < 24; s += 8) m = Math.max(m, Math.abs((a.px[i] >>> s & 255) - (b.px[i] >>> s & 255)));
    if (m) differ++;
    if (m > worst) { worst = m; at = i; }
  }
  return { worst, differ, at, ok: worst <= tol };
}

// Run $scene on the software path and on the producer; return both.
async function bothArms(scene, opts = {}) {
  const sw = await bootGlGps({ ...opts, gps: 0 });
  const swOut = await scene(sw);
  const swPic = sw.front();
  const gp = await bootGlGps({ ...opts, gps: 1 });
  const gpOut = await scene(gp);
  const gpPic = gp.front();
  return { sw, gp, swPic, gpPic, swOut, gpOut, cmp: comparePictures(swPic, gpPic, opts.tol ?? 1) };
}

module.exports = { bootGlGps, comparePictures, bothArms };
