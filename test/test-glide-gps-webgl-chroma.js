#!/usr/bin/env node
'use strict';
// tl;dr: Glide chroma key on the WEBGL GPU stream executor, end to end.
//
//   node test/test-glide-gps-webgl-chroma.js
//
//   real Glide API (WAT 09a8h)  --SHADER/DRAW_UP-->  lib/gpu-stream-webgl.js
//        grChromakeyMode(1)          ring               headless GL
//
// The Glide producer declares its pixel IR ps_1_4. ps_1_4 has no min/max, and
// the WebGL compiler (lib/d3d9-shader.js) rejects them, so a chroma-key shader
// that used max threw "invalid IR instruction" the moment a game enabled
// chroma keying (NFS II SE and Diablo II Glide demos: black screen). This
// drives the real WAT and checks two things:
//   1. every SHADER the Glide producer emits for a spread of combine and
//      chroma states compiles with the WebGL compiler (no headless GL needed);
//   2. on headless GL, a keyed colour is rejected and an unkeyed one drawn,
//      including a colour one 8-bit step from the key in a single channel.
// The software executor's semantics are covered by test-glide-gps-software.js.
const assert = require('assert');
const path = require('path');
const { compileSrcWasm } = require('./compile-src');
const regions = require('../lib/region-map.generated');
const table = require('../src/api_table.json');
const GS = require('../lib/gpu-stream');
const SH = require('../lib/d3d9-shader');
const hgl = require('../lib/headless-gl');

const bytes = compileSrcWasm((file, source) => file === '09a8h-glide.wat'
  ? source + '\n(export "glide_test_dispatch" (func $dispatch_api_table))\n' : source);
const module_ = new WebAssembly.Module(bytes);
const api = name => { const a = table.find(x => x.name === name); assert(a, 'api ' + name); return a; };
const VTX = 0x410000;

// kick(ring, mode, memory) drains the ring however the caller wants.
function session(kick) {
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const imports = { host: { memory } };
  for (const imp of WebAssembly.Module.imports(module_))
    if (imp.kind === 'function') (imports[imp.module] ||= {})[imp.name] = () => 0;
  imports.host.math_pow = Math.pow;
  imports.host.math_pow2 = x => 2 ** x;
  imports.host.get_ticks = () => 0;
  imports.host.gpu_stream_kick = (ring, mode) => kick(ring >>> 0, mode | 0, memory, e);
  const e = new WebAssembly.Instance(module_, imports).exports;
  e.init_thread(0, 0x400000, 0, 0, 0, 0, 0);
  e.heap_init(0x420000);
  const view = new DataView(memory.buffer);
  const stack = regions.BASE.GUEST_STACK + 0x1000;
  const stackGuest = (stack - regions.BASE.GUEST_BASE + 0x400000) >>> 0;
  const wa = p => e.guest_to_wasm(p) >>> 0;
  const call = (fn, args = []) => {
    const a = api(fn);
    e.set_esp(stackGuest);
    args.forEach((v, i) => view.setUint32(stack + 4 + i * 4, v >>> 0, true));
    try { e.glide_test_dispatch(a.id, ...Array.from({ length: 5 }, (_, i) => args[i] || 0), 0); }
    catch (err) { err.message = `${fn}(${args.join(', ')}): ${err.message}`; throw err; }
    assert.strictEqual(e.get_esp() >>> 0, stackGuest + 4 + a.nargs * 4, fn + ' pops its stdcall frame');
    return e.get_eax() >>> 0;
  };
  // Glide 2 GrVertex: x y z r g b ooz a oow sow0 tow0 oow0 sow1 tow1 oow1.
  const tri = (n, c) => {
    [[0, 0], [n, 0], [0, n]].forEach(([x, y], i) =>
      [x, y, 0, c[0], c[1], c[2], 0, 255, 1, 0, 0, 1, 0, 0, 1]
        .forEach((f, k) => view.setFloat32(wa(VTX + i * 60 + k * 4), f, true)));
    call('_grDrawTriangle@12', [VTX, VTX + 60, VTX + 120]);
  };
  call('_grGlideInit@0');
  assert.strictEqual(call('_grSstWinOpen@28', [0, 1, 0, 0, 0, 2, 1]), 1, 'grSstWinOpen 320x240 2 buffers');
  return { call, tri, e };
}

// 1. Every SHADER compiles with the WebGL compiler.
{
  const shaders = [];
  // The software executor (it publishes a caps block, which the producer
  // needs) runs the records; SHADER records are copied on the way in.
  const { Executor } = require('../lib/gpu-stream-software');
  let ring = null, at = 0, ex = null;
  const S = session((addr, mode, memory, exports) => {
    if (!ex) {
      ex = new Executor({ getExports: () => exports, getMemory: () => memory.buffer, presentPixels: () => {} });
      const inner = ex.execute.bind(ex);
      ex.execute = rec => { if (rec.name === 'SHADER') shaders.push(GS.shaderIR(rec).slice()); return inner(rec); };
    }
    if (!ring || at !== addr) { ring = new GS.Ring(() => memory.buffer, addr); at = addr; }
    GS.drain([ring], ex);
    return 1;
  });
  // Untextured colour combines, each with chroma off and on; OTHER (what
  // chroma compares) is iterated in the first two and constant in the last.
  // A textured OTHER needs a texture source; the game runs cover it.
  // grColorCombine(function, factor, local, other, invert): local 1 is
  // constant (2 is depth, which fails fast); other 2 is constant.
  const combines = [[1, 0, 0, 0, 0], [3, 8, 0, 0, 0], [1, 0, 1, 0, 0], [3, 8, 0, 2, 0]];
  S.call('_grConstantColorValue@4', [0xFF123456]);
  for (const cc of combines) for (const chroma of [0, 1]) {
    S.call('_grColorCombine@20', cc);
    S.call('_grAlphaCombine@20', [1, 0, 0, 0, 0]);
    S.call('_grChromakeyValue@4', [0x0000FF00]);
    S.call('_grChromakeyMode@4', [chroma]);
    S.call('_grBufferClear@12', [0, 255, 65535]);
    try { S.tri(16, [0, 255, 0]); } catch (err) { err.message = `combine ${cc} chroma ${chroma}: ${err.message}`; throw err; }
    S.call('_grSstIdle@0');
  }
  assert(shaders.length >= 4, `expected several SHADER records, got ${shaders.length}`);
  let chromaShaders = 0;
  for (const ir of shaders) {
    const words = new Uint32Array(ir.buffer, ir.byteOffset, ir.byteLength >> 2);
    if (Array.from({ length: words[4] }, (_, i) => words[8 + i * 32]).includes(65)) chromaShaders++;
    SH.compileNativeIR({ irVersion: 1, nativeBytes: ir });
  }
  assert(chromaShaders >= 1, 'no chroma-key (texkill) shader was emitted');
  console.log(`ok - ${shaders.length} Glide shaders (${chromaShaders} chroma) compile for WebGL`);
}

// 2. Pixels on headless GL.
if (!hgl.available()) {
  console.log(`SKIP pixel half: ${hgl.unavailableReason()}`);
} else {
  const { createCanvas } = require('../lib/canvas-compat');
  const { WebGLBackend } = require('../lib/gpu-backend');
  const { Executor } = require('../lib/gpu-stream-webgl');
  const canvas = createCanvas(640, 480);
  const backend = new WebGLBackend(canvas);
  let ex = null, ring = null, at = 0, frame = null;
  const S = session((addr, mode, memory) => {
    if (!ex) ex = new Executor({ canvas, backend, onPresent: f => {
      const px = f.pixels;
      frame = { w: f.width, px: px.slice() };
    } });
    if (!ring || at !== addr) { ring = new GS.Ring(() => memory.buffer, addr); at = addr; }
    GS.drain([ring], ex);
    if (mode === GS.CONST.KICK_CLOSE) { ex.close(); ex = null; ring = null; at = 0; }
    return 1;
  });
  const rgb = (x, y) => Array.from(frame.px.subarray((y * frame.w + x) * 4, (y * frame.w + x) * 4 + 3));
  // Clear to ARGB blue, draw a 16-pixel triangle at the origin, swap; (2,2)
  // is inside the triangle and (40,40) is clear colour.
  const draw = colour => {
    S.call('_grBufferClear@12', [0x000000FF, 255, 65535]);
    S.tri(16, colour);
    S.call('_grBufferSwap@4', [0]);
    return rgb(2, 2);
  };
  S.call('_grColorCombine@20', [1, 0, 0, 0, 0]);
  S.call('_grAlphaCombine@20', [1, 0, 0, 0, 0]);
  S.call('_grChromakeyValue@4', [0x0000FF00]);
  S.call('_grChromakeyMode@4', [1]);
  const keyed = draw([0, 255, 0]);
  assert.deepStrictEqual(rgb(40, 40), [0, 0, 255], 'clear colour is blue');
  assert.deepStrictEqual(keyed, [0, 0, 255], 'keyed green rejected');
  assert.deepStrictEqual(draw([255, 0, 0]), [255, 0, 0], 'unkeyed red drawn');
  assert.deepStrictEqual(draw([0, 254, 0]), [0, 254, 0], 'one step from the key in G is drawn');
  assert.deepStrictEqual(draw([1, 255, 0]), [1, 255, 0], 'one step from the key in R is drawn');
  assert.deepStrictEqual(draw([0, 255, 1]), [0, 255, 1], 'one step from the key in B is drawn');
  S.call('_grChromakeyMode@4', [0]);
  assert.deepStrictEqual(draw([0, 255, 0]), [0, 255, 0], 'chroma off draws green');
  console.log('ok - WebGL executor: chroma key rejects only the exact key colour');
}
console.log('test-glide-gps-webgl-chroma: PASS');
