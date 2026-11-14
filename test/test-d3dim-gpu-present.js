#!/usr/bin/env node
'use strict';

// D3DIM GPU present (docs/d3dim-gpu-present.md). A Blt(primary <- render
// target) parks the frame on the GPU and hands the host a canvas, while the
// primary's DIB stays as it was. The DIB gets the presented pixels only when
// a CPU reader of those bytes asks: a ranged fence that overlaps them, a
// _prepare that uploads them, or the target's teardown. A global fence (length
// 0) is not such a reader. The gamma ramp runs in the present shader.

const assert = require('assert');
const { D3DIMGpu, OPCODES, PRESENT_MAGIC } = require('../lib/d3dim-gpu');

function fixture({ ramp = null, live = () => true } = {}) {
  const memory = new ArrayBuffer(0x10000), dv = new DataView(memory), u8 = new Uint8Array(memory);
  const dst = 0x1000, src = 0x1040, desc = 0x1100, rampWa = 0x4000;
  const srcDib = 0x2000, dstDib = 0x3000, W = 4, H = 4, pitch = W * 4;
  const entry = (e, dib) => {
    dv.setUint16(e + 12, W, true); dv.setUint16(e + 14, H, true);
    dv.setUint16(e + 16, 32, true); dv.setUint16(e + 18, pitch, true);
    dv.setUint32(e + 20, dib, true);
  };
  entry(dst, dstDib); entry(src, srcDib);
  u8.fill(0x11, srcDib, srcDib + pitch * H);
  u8.fill(0x22, dstDib, dstDib + pitch * H);
  if (ramp) for (let c = 0; c < 3; c++) for (let i = 0; i < 256; i++)
    dv.setUint16(rampWa + c * 512 + i * 2, ramp(i) << 8, true);

  // GPU model: the render target holds `frame` (one RGBA value); a parked
  // colour resource holds what was copied into it when it was parked.
  let frame = [0x40, 0x50, 0x60, 0xff];
  const log = [], resources = new Map(), uniforms = {}, uploads = [];
  let bound = null, created = 0, released = 0;
  const gl = {
    RGBA: 1, UNSIGNED_BYTE: 2, FRAMEBUFFER: 3, ARRAY_BUFFER: 4, NEAREST: 5, CLAMP_TO_EDGE: 6,
    TEXTURE_MIN_FILTER: 7, TEXTURE_MAG_FILTER: 8, TEXTURE_WRAP_S: 9, TEXTURE_WRAP_T: 10,
    DEPTH_TEST: 11, STENCIL_TEST: 12, BLEND: 13, CULL_FACE: 14, SCISSOR_TEST: 15, TRIANGLE_STRIP: 16,
    canvas: { width: W, height: H },
    bindFramebuffer(_, fb) { bound = fb; },
    readPixels(x, y, w, h, fmt, type, out) {
      const r = [...resources.values()].find(v => v.framebuffer === bound);
      assert(r, 'materialize reads a parked resource, never the target');
      log.push(['read', w, h]);
      for (let i = 0; i < out.length; i += 4) out.set(r.content, i);
    },
  };
  const g = {
    gl, _colorResources: resources, _target: { framebuffer: 'target-fbo' },
    createColorResource(id, w, h) { created++; resources.set(id, { w, h, color: { id }, framebuffer: { id }, content: null }); },
    copyColorResource(from, id, srcRect, dstRect) {
      assert.equal(from, null, 'copies from the bound render target');
      resources.get(id).content = frame.slice();
      log.push(['copy', id, srcRect, dstRect]);
    },
    releaseColorResource(id) { released++; resources.delete(id); },
    createProgram() { return { program: true }; }, createBuffer() { return {}; }, updateBuffer() {},
    createTexture() { return { texture: true }; },
    uploadTexture2D(_, spec) { if (spec.pixels) uploads.push(spec.pixels); },
    setTextureParameter() {}, setCapability() {}, setColorMask() {}, bindTexture() {},
    setViewport(...args) { log.push(['viewport', ...args]); },
    setUniform(_, name, type, value) { uniforms[name] = value; },
    draw() { log.push(['present-draw', bound]); },
  };
  let destroyed = false;
  const target = { rt: src, width: W, height: H, bpp: 32, format: 2, dib: srcDib, pitch,
    check: false, textureKeys: new Set(), device: { gpu: g, destroy() { destroyed = true; } } };
  const frames = [];
  const exports = {
    guest_to_wasm: a => a, page_watch_write() {},
    d3dim_gpu_surface_live: live,
    gamma_ramp_wa: () => ramp ? rampWa : 0, gamma_ramp_gen: () => 7,
  };
  const gpu = new D3DIMGpu({ getMemory: () => memory, getExports: () => exports,
    createCanvas: () => null, onPresent: f => frames.push(f) });
  gpu.targets.set(src, target);
  const present = ({ dx = 1, dy = 1, w = 2, h = 2, sx = 0, sy = 0, s = src } = {}) => {
    [PRESENT_MAGIC, dst, s, dx, dy, w, h, sx, sy, 0x1234, 9, 0].forEach((v, i) => dv.setUint32(desc + i * 4, v, true));
    return gpu.call(OPCODES.PRESENT, desc, 48);
  };
  const pixel = (x, y) => Array.from(u8.subarray(dstDib + y * pitch + x * 4, dstDib + y * pitch + x * 4 + 4));
  return { gpu, present, frames, pixel, log, uniforms, uploads, target, dv, dst, src, dstDib, pitch, H,
    setFrame: f => { frame = f; }, counts: () => ({ created, released }), destroyed: () => destroyed };
}

// No consumer: the opcode declines so WAT keeps its CPU Blt.
{
  const f = fixture();
  f.gpu.onPresent = null;
  assert.equal(f.present(), 0);
  assert.equal(f.gpu.parked.size, 0);
}

// Present parks the frame; the DIB is untouched until a reader of it fences.
{
  const f = fixture();
  assert.equal(f.present(), 1);
  assert.equal(f.frames.length, 1);
  const fr = f.frames[0];
  assert.deepEqual([fr.dst, fr.hwnd, fr.dx, fr.dy, fr.width, fr.height, fr.cpuSeq, fr.exclusive],
    [f.dst, 0x1234, 1, 1, 2, 2, 9, false]);
  assert.equal(fr.canvas, f.target.device.gpu.gl.canvas);
  assert.equal(f.gpu.stats.gpuPresents, 1);
  assert.deepEqual(f.log.find(e => e[0] === 'copy').slice(2),
    [{ x: 0, y: 0, width: 2, height: 2 }, { x: 0, y: 0, width: 2, height: 2 }]);
  assert.deepEqual(f.log.find(e => e[0] === 'viewport'), ['viewport', 0, 2, 2, 2],
    'frame drawn into the canvas top-left');
  assert.deepEqual(f.log.find(e => e[0] === 'present-draw'), ['present-draw', null], 'default framebuffer');
  assert.equal(f.uniforms.gamma, 0, 'identity/no ramp skips the LUT');
  assert.deepEqual(f.pixel(1, 1), [0x22, 0x22, 0x22, 0x22], 'no readback on present');
  assert.equal(f.log.some(e => e[0] === 'read'), false);

  f.gpu.fence(0, 0);
  assert.deepEqual(f.pixel(1, 1), [0x22, 0x22, 0x22, 0x22], 'a global fence does not materialize');
  f.gpu.fence(f.dstDib + f.pitch * f.H, 64);
  assert.equal(f.gpu.parked.size, 1, 'a fence on other bytes does not materialize');

  // A later frame on the GPU must not leak into the parked one.
  f.setFrame([1, 2, 3, 4]);
  f.gpu.fence(f.dstDib + f.pitch, 4);
  assert.equal(f.gpu.parked.size, 0);
  assert.equal(f.gpu.stats.lazyMaterializations, 1);
  // BGRA in the DIB from RGBA 40 50 60; X8R8G8B8 alpha byte 255.
  for (const [x, y] of [[1, 1], [2, 1], [1, 2], [2, 2]]) assert.deepEqual(f.pixel(x, y), [0x60, 0x50, 0x40, 0xff]);
  for (const [x, y] of [[0, 0], [3, 1], [1, 3], [0, 2]]) assert.deepEqual(f.pixel(x, y), [0x22, 0x22, 0x22, 0x22]);
  assert.deepEqual(f.counts(), { created: 1, released: 1 });
}

// Same-size frames reuse one resource; a covering frame drops what it hides.
{
  const f = fixture();
  assert.equal(f.present(), 1); assert.equal(f.present(), 1);
  assert.deepEqual(f.counts(), { created: 1, released: 0 });
  assert.equal(f.present({ dx: 0, dy: 0, w: 4, h: 4 }), 1);
  assert.deepEqual(f.counts(), { created: 2, released: 1 });
  assert.equal(f.gpu.parked.get(f.dst).length, 1);
  f.gpu.fence(f.dstDib, 4);
  assert.equal(f.log.filter(e => e[0] === 'read').length, 1, 'only the visible frame is read back');
}

// _prepare of the primary's bytes (e.g. a draw onto them) materializes first.
{
  const f = fixture();
  f.present();
  f.gpu._prepare({ ...f.target, dib: f.dstDib, check: false }, { dib: f.dstDib, pitch: f.pitch, height: f.H, format: 2 });
  assert.equal(f.gpu.parked.size, 0);
  assert.deepEqual(f.pixel(1, 1), [0x60, 0x50, 0x40, 0xff]);
}

// The owning target's teardown keeps the frame rather than dropping it.
{
  let alive = true;
  const f = fixture({ live: () => alive });
  f.present();
  alive = false;
  f.gpu.fence(0, 0);
  assert(f.destroyed());
  assert.equal(f.gpu.parked.size, 0);
  assert.deepEqual(f.pixel(2, 2), [0x60, 0x50, 0x40, 0xff]);
}

// The gamma ramp is uploaded once per generation and enabled in the shader.
{
  const f = fixture({ ramp: i => 255 - i });
  f.present(); f.present();
  assert.equal(f.uniforms.gamma, 1);
  assert.equal(f.uploads.length, 1);
  assert.deepEqual(Array.from(f.uploads[0].subarray(0, 8)), [255, 255, 255, 255, 254, 254, 254, 255]);
}

// Declines: the caller then performs the ordinary CPU Blt.
{
  const f = fixture();
  assert.equal(f.present({ s: 0x1080 }), 0, 'source is not a GPU target');
  assert.equal(f.present({ sx: 3 }), 0, 'source rect beyond the target');
  f.dv.setUint16(f.dst + 16, 16, true);
  assert.equal(f.present(), 0, 'bpp mismatch');
  assert.equal(f.gpu.stats.gpuPresentDeclines, 3);
  assert.equal(f.frames.length, 0);
  assert.equal(f.gpu.parked.size, 0);
}

console.log('test-d3dim-gpu-present: ok');
