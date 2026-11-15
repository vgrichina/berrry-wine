'use strict';
// tl;dr: a freshly CREATEd depth target starts at depth 1.0 (far) and
// stencil 0 in every GPU stream v2 executor (docs/gpu-stream-v2.md, Formats):
// a draw with depth test LESS before any depth CLEAR must write its pixels.
// For D16 and D24S8 the same record stream (CREATE RT+DS, TARGETS, a
// colour-only CLEAR, a z=0.5 LESS/zwrite quad, a z=0.75 quad that must lose,
// PRESENT) runs on the software executor, on the WebGL executor (headless GL;
// skipped when unavailable) and on the NullExecutor (validation only).
//
//   node test/test-gpu-stream-fresh-depth.js
const assert = require('assert');
const path = require('path');
const GS = require('../lib/gpu-stream');
const { makeProducer, packLayout } = require('./gpu-stream-fixture');
const { bootRenderHarness } = require('./render-helper');
const Software = require('../lib/gpu-stream-software');

const { KIND, FMT } = GS;
const W = 16, H = 16;
const RT = 1, DS = 2, LAYOUT = 3, FLAT = 4;

// mov r0, v0 (src/09af-d3d-shader-ir.wat ABI 1)
function flatIr() {
  const bytes = new Uint8Array(32 + 128), u = new Uint32Array(bytes.buffer);
  u.set([0x44534952, 1, 1, 0xffff0104, 1, 3, bytes.length, 1]);
  u.set([1, 1, 2, 0], 8);
  u.set([0, 0, 15, 0], 12);
  u.set([1, 0, 228, 0], 16);
  return bytes;
}

// Records one scenario into a fresh producer; returns the ring.
function record(dsFmt) {
  const p = makeProducer({ ringBytes: 16384, arenaBytes: 65536, memBytes: 1 << 20 });
  const arena = (bytes) => { const pos = p.arenaAlloc(bytes.length); p.arenaView(pos, bytes.length).set(bytes); return pos; };
  p.emit('CREATE', { id: RT, kind: KIND.RT, fmt: FMT.A8B8G8R8, levels: 1, width: W, height: H });
  p.emit('CREATE', { id: DS, kind: KIND.DS, fmt: dsFmt, levels: 1, width: W, height: H });
  const tail = new Uint8Array(16);
  tail.set(packLayout('GpsLayoutElem', { slot: 0, type: 3, usage: 9, index: 0, offset: 0 }), 0);   // POSITIONT FLOAT4
  tail.set(packLayout('GpsLayoutElem', { slot: 0, type: 3, usage: 10, index: 0, offset: 16 }), 8); // COLOR0 FLOAT4
  p.emit('LAYOUT', { id: LAYOUT, count: 2, stride: 32 }, tail);
  const ir = flatIr();
  p.emit('SHADER', { id: FLAT, stage: 1, ir_bytes: ir.length }, ir);
  p.emit('TARGETS', { color: RT, depth: DS });
  // Colour only: the depth target keeps what CREATE gave it.
  p.emit('CLEAR', { mask: 1, colormask: 15, rgba: 0xff000000, z: 0, left: 0, top: 0, right: W, bottom: H });
  p.emit('RASTER', {
    depth_mode: 1, zfunc: 2 /* LESS */, zwrite: 1, cull: 1, blend: 0,
    src_rgb: 2, dst_rgb: 1, src_alpha: 2, dst_alpha: 1, blend_op: 1, blend_op_alpha: 1, linear: 1,
    alpha_func: 8, alpha_ref: 0, colormask: 15, fog_mode: 0, fog_flags: 0, fill: 3,
    fog_color: 0, fog_table: 0, depth_bias: 0,
    scissor_left: 0, scissor_top: 0, scissor_right: W, scissor_bottom: H,
  });
  p.emit('BIND', { count: 0 });
  const quad = (z, rgba, x0, x1) => {
    const v = (x, y) => [x, y, z, 1, ...rgba];
    const f = new Float32Array([v(x0, 0), v(x1, 0), v(x0, H), v(x1, 0), v(x1, H), v(x0, H)].flat());
    p.emit('DRAW_UP', { prim: 4, vs: 0, ps: FLAT, layout: LAYOUT, vbuf: 0, voff: arena(new Uint8Array(f.buffer)),
      stride: 32, ibuf: 0, ioff: 0, count: 6, vcount: 6 });
  };
  quad(0.5, [0, 1, 0, 1], 0, W);       // green over the whole target: passes LESS against 1.0
  quad(0.75, [0, 0, 1, 1], 0, W / 2);  // blue on the left half: behind the green, must fail
  p.emit('PRESENT', { rt: RT, gamma: 0, x: 0, y: 0, w: W, h: H, surface: 0x1234 });
  return p.ring();
}

function checkFrame(label, frame) {
  assert.ok(frame, `${label}: PRESENT produced a frame`);
  const px = (x, y) => Array.from(frame.pixels.subarray((y * W + x) * 4, (y * W + x) * 4 + 4));
  for (const [x, y] of [[2, 2], [12, 8], [3, 13]])
    assert.deepStrictEqual(px(x, y), [0, 255, 0, 255], `${label}: LESS draw before any depth clear wrote @${x},${y}`);
}

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none' });
  const canvas = () => ({ width: 0, height: 0, getContext: () => ({
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) });
  let webgl = null;
  const hgl = require(path.join(__dirname, '..', 'lib', 'headless-gl'));
  if (hgl.available()) {
    const { createCanvas } = require('../lib/canvas-compat');
    const { WebGLBackend } = require('../lib/gpu-backend');
    const glCanvas = createCanvas(W, H);
    webgl = { Executor: require('../lib/gpu-stream-webgl').Executor, canvas: glCanvas, backend: new WebGLBackend(glCanvas) };
  } else console.log(`note: WebGL executor skipped (${hgl.unavailableReason()})`);
  let checks = 0;
  for (const [name, fmt] of [['D16', FMT.D16], ['D24S8', FMT.D24S8]]) {
    let frame = null;
    GS.drain([record(fmt)], new Software.Executor({ canvas: canvas(), getExports: () => e,
      getMemory: () => memory.buffer, onPresent: (f) => { frame = f; } }));
    checkFrame(`software ${name}`, frame); checks++;
    if (webgl) {
      frame = null;
      const ex = new webgl.Executor({ canvas: webgl.canvas, backend: webgl.backend,
        onPresent: (f) => { frame = { pixels: f.pixels.slice() }; } });
      GS.drain([record(fmt)], ex);
      checkFrame(`webgl ${name}`, frame); checks++;
      if (ex.close) ex.close();
    }
    const nul = new GS.NullExecutor();
    const r = GS.drain([record(fmt)], nul);
    assert.ok(r.records >= 10, `null ${name}: validated the stream (${r.records} records)`); checks++;
  }
  console.log(`PASS test-gpu-stream-fresh-depth: ${checks} executor runs`);
})().catch((error) => { console.error(error); process.exit(1); });
