'use strict';
// tl;dr: RT-to-RT COPY (D3D9 StretchRect) stays on the GPU in the WebGL
// executor: same-size LINEAR is exact and takes the copyTexSubImage path,
// and a real stretch is a blitFramebuffer where WebGL2 has one. Before, both
// read the source back and resampled it in JS -- 16% of browser CPU in Spelunky
// Classic HD's tutorial, which StretchRects 1024x768 RTs twice a frame with
// D3DTEXF_LINEAR (scratch/runs/20261124-spelunky-hd-perf2). Each case is drawn
// on the WebGL executor (headless GL) and on the software executor (the
// reference) and every pixel compared; the WebGL executor must not read back.
//
//   node test/test-gpu-stream-webgl-copy-stretch.js
//
// Skips (exit 0) when headless GL is unavailable.

const path = require('path');
const ROOT = path.join(__dirname, '..');
const hgl = require(path.join(ROOT, 'lib', 'headless-gl'));
if (!hgl.available()) {
  console.log(`SKIP test-gpu-stream-webgl-copy-stretch: ${hgl.unavailableReason()}`);
  process.exit(0);
}
const GS = require(path.join(ROOT, 'lib', 'gpu-stream'));
const { makeProducer } = require('./gpu-stream-fixture');
const { bootRenderHarness } = require('./render-helper');
const { createCanvas } = require(path.join(ROOT, 'lib', 'canvas-compat'));
const { WebGLBackend } = require(path.join(ROOT, 'lib', 'gpu-backend'));
const WebGL = require(path.join(ROOT, 'lib', 'gpu-stream-webgl'));
const Software = require(path.join(ROOT, 'lib', 'gpu-stream-software'));

const { CONST } = GS;
const W = 64, H = 64;
const TOL = 3; // per channel: two float bilinear paths over 8-bit texels
const POINT = 1, LINEAR = 2;
let checks = 0;
const failures = [];
const check = (name, ok, detail) => { checks++; if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`); };

const ID = { DST: 1, SRC8: 2, SRC16: 3 };
// Whole-source rects only: GL may filter across a sub-rectangle's edge, D3D
// clamps to it, and the runner that motivated this copies whole RTs.
const CASES = [
  { name: 'same-size LINEAR', src: ID.SRC8, sw: 8, sh: 8, dx: 5, dy: 9, dw: 8, dh: 8, filter: LINEAR, gpu: true },
  { name: 'same-size POINT', src: ID.SRC8, sw: 8, sh: 8, dx: 40, dy: 3, dw: 8, dh: 8, filter: POINT, gpu: true },
  { name: 'grown x4 LINEAR', src: ID.SRC8, sw: 8, sh: 8, dx: 10, dy: 20, dw: 32, dh: 32, filter: LINEAR },
  { name: 'grown x3 POINT', src: ID.SRC8, sw: 8, sh: 8, dx: 30, dy: 30, dw: 24, dh: 24, filter: POINT },
  { name: 'shrunk /2 LINEAR', src: ID.SRC16, sw: 16, sh: 16, dx: 0, dy: 0, dw: 8, dh: 8, filter: LINEAR },
  { name: 'non-uniform LINEAR', src: ID.SRC8, sw: 8, sh: 8, dx: 2, dy: 44, dw: 40, dh: 12, filter: LINEAR },
];

function scene(makeExecutor) {
  const frames = [];
  const ex = makeExecutor((f) => frames.push({ w: f.width, h: f.height, px: Uint8Array.from(f.pixels) }));
  const p = makeProducer({ ringBytes: 1 << 16, arenaBytes: 1 << 20, buffer: new SharedArrayBuffer(1 << 22) });
  const ring = p.ring();
  const emit = (op, fields, tail) => p.emit(op, fields, tail);
  const drain = () => { GS.drain([ring], ex); p.store('arena_tail', p.load('arena_head')); };
  const target = (rt, w, h) => {
    emit('TARGETS', { color: rt, depth: 0 });
    emit('RASTER', { depth_mode: 0, zfunc: 8, zwrite: 0, cull: 1, blend: 0, src_rgb: 2, dst_rgb: 1, src_alpha: 2,
      dst_alpha: 1, blend_op: 1, blend_op_alpha: 1, alpha_func: 8, alpha_ref: 0, colormask: 15, fill: 3, linear: 1,
      scissor_left: 0, scissor_top: 0, scissor_right: w, scissor_bottom: h });
  };
  // A source of distinct 2x2 blocks (n x n texels), so a wrong row order,
  // offset or filter shows.
  const fill = (rt, n) => {
    target(rt, n, n);
    for (let y = 0; y < n; y += 2) for (let x = 0; x < n; x += 2) {
      const h = Math.imul((y * n + x) + 1, 2654435761) ^ Math.imul(n, 40503);
      const rgba = ((h & 0xffffff) | 0xff000000) >>> 0;
      emit('CLEAR', { mask: 1, colormask: 15, rgba, z: 1, left: x, top: y, right: x + 2, bottom: y + 2 });
    }
  };
  try {
    emit('CREATE', { id: ID.DST, kind: CONST.KIND_RT, fmt: CONST.FMT_A8B8G8R8, levels: 1, width: W, height: H });
    emit('CREATE', { id: ID.SRC8, kind: CONST.KIND_RT, fmt: CONST.FMT_A8B8G8R8, levels: 1, width: 8, height: 8 });
    emit('CREATE', { id: ID.SRC16, kind: CONST.KIND_RT, fmt: CONST.FMT_A8B8G8R8, levels: 1, width: 16, height: 16 });
    fill(ID.SRC8, 8); fill(ID.SRC16, 16);
    drain();
    CASES.forEach((c, k) => {
      target(ID.DST, W, H);
      emit('CLEAR', { mask: 1, colormask: 15, rgba: 0xff404040, z: 1, left: 0, top: 0, right: W, bottom: H });
      emit('COPY', { src: c.src, dst: ID.DST, sx: 0, sy: 0, sw: c.sw, sh: c.sh,
        dx: c.dx, dy: c.dy, dw: c.dw, dh: c.dh, filter: c.filter });
      emit('PRESENT', { rt: ID.DST, x: 0, y: 0, w: W, h: H, surface: 0x77, stamp: k + 1 });
      drain();
    });
  } finally {
    if (ex.close && !ex.keepOpen) ex.close();
  }
  return frames;
}

(async () => {
  let gl, soft, glStats = null, canBlit = false;
  try {
    const canvas = createCanvas(W, H);
    const backend = new WebGLBackend(canvas);
    let executor = null;
    const glEx = (onPresent) => {
      executor = new WebGL.Executor({ canvas, backend, onPresent });
      executor.keepOpen = true;
      return executor;
    };
    gl = scene(glEx);
    canBlit = typeof executor.gl.blitFramebuffer === 'function';
    glStats = executor.stats();
    executor.close && executor.close();
  } catch (e) {
    failures.push(`WebGL executor threw: ${e.stack || e}`);
  }
  try {
    const { exports: e, memory } = await bootRenderHarness({ fonts: 'none' });
    soft = scene((onPresent) => new Software.Executor({ getExports: () => e, getMemory: () => memory.buffer, onPresent }));
  } catch (e) {
    failures.push(`software executor threw: ${e.stack || e}`);
  }
  if (gl && soft) {
    check('frame count', gl.length === CASES.length && soft.length === CASES.length, `${gl.length} / ${soft.length}`);
    CASES.forEach((c, k) => {
      const a = gl[k], b = soft[k];
      if (!a || !b) return;
      let bad = 0, worst = 0, where = '';
      for (let i = 0; i < a.px.length; i++) {
        if ((i & 3) === 3) continue;
        const d = Math.abs(a.px[i] - b.px[i]);
        if (d > worst) { worst = d; where = `${(i >> 2) % W},${Math.floor((i >> 2) / W)}`; }
        if (d > TOL) bad++;
      }
      check(`${c.name}: WebGL matches software within ${TOL}`, bad === 0, `${bad} channels differ, worst ${worst} at ${where}`);
    });
  }
  if (glStats) {
    check('no readback for any COPY', !glStats.readbacks, `readbacks ${glStats.readbacks}`);
    const reads = canBlit ? 0 : CASES.filter(c => !c.gpu).length;
    check(`COPY readPixels: ${reads}`, (glStats.copyReads || 0) === reads, `copyReads ${glStats.copyReads}`);
    const stretches = CASES.filter(c => !c.gpu).length;
    if (canBlit) check(`every stretch is a blit (${stretches})`, glStats.copyBlits === stretches, `copyBlits ${glStats.copyBlits}`);
    else console.log('  (no blitFramebuffer in this GL: stretches took the CPU path)');
  }
  for (const f of failures) console.log(`FAIL ${f}`);
  if (failures.length) { console.log(`FAIL test-gpu-stream-webgl-copy-stretch: ${failures.length}/${checks} checks failed`); process.exit(1); }
  console.log(`PASS test-gpu-stream-webgl-copy-stretch: ${checks}/${checks} checks${canBlit ? '' : ' (no blit)'}`);
  process.exit(0);
})();
