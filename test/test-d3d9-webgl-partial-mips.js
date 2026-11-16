'use strict';
// Two D3D9 fixed-function shapes the WebGL backend used to refuse outright,
// dropping the whole draw (Morrowind's world rendered as a bare fog clear):
//
// 1. A mip-filtered texture whose chain stops above 1x1. D3D allows any level
//    count and clamps coarser LODs to the last level. WebGL2 clamps with
//    TEXTURE_MAX_LEVEL; WebGL1 cannot, so the backend box-filters the missing
//    levels down from the last real one.
// 2. A lit draw whose declaration has no NORMAL. D3D9 reads the missing
//    element as zero: directional diffuse vanishes, ambient+emissive remain.
const assert = require('assert');
const hgl = require('../lib/headless-gl');
const { createCanvas } = require('../lib/canvas-compat');
const { Device } = require('../lib/d3d9-backend');
const fixtures = require('./fixtures/d3d9-lighting-cases');

if (!hgl.available()) {
  console.log(`SKIP test-d3d9-webgl-partial-mips: ${hgl.unavailableReason()}`);
  process.exit(0);
}

const solid = (w, h, rgba) => { const p = new Uint8Array(w * h * 4); for (let i = 0; i < p.length; i += 4) p.set(rgba, i); return p; };
const RED = [255, 0, 0, 255], GREEN = [0, 255, 0, 255];

// Full-screen triangle with FLOAT3 position and FLOAT2 texcoord; `span` sets
// how many texture repeats cross the 4-pixel target, i.e. which LOD samples.
function texturedDraw(span) {
  const v = new Float32Array([-1, 1, .5, 0, 0, 3, 1, .5, span, 0, -1, -3, .5, 0, span]);
  const d = fixtures.draw(), f = d.fixedFunction;
  d.stride = 20; d.vertices = new Uint8Array(v.buffer);
  d.attributes = [{ register: 0, usage: 0, usageIndex: 0, type: 2, offset: 0 },
    { register: 1, usage: 5, usageIndex: 0, type: 1, offset: 12 }];
  f.lighting = false;
  Object.assign(f.stages[0], { colorArg1: 2, alphaArg1: 2 });
  d.textures = [{ width: 4, height: 4, pixels: solid(4, 4, RED), sampler: { min: 1, mag: 1, mip: 1 },
    levels: [{ width: 4, height: 4, pixels: solid(4, 4, RED) }, { width: 2, height: 2, pixels: solid(2, 2, GREEN) }] }];
  return d;
}

// Fixed function lowers through 09aj WAT (slice 9.2): the GL Device needs
// the native exports, as every production caller passes them.
(async () => {
const { exports: native, memory } = await require('./render-helper').bootRenderHarness({ fonts: 'none' });
const lowering = { getExports: () => native, getMemory: () => memory.buffer };
let ran = 0;
for (const webglVersion of [1, 2]) {
  const canvas = createCanvas(4, 4);
  let device;
  try { device = new Device(canvas, { webglVersion, ...lowering }); } catch (e) {
    if (webglVersion === 2) { console.log(`SKIP WebGL2 arm: ${e.message}`); continue; }
    throw e;
  }
  const gl = device.gpu.gl;
  const pixel = () => [...device.gpu.readPixels(1, 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4))];
  const close = (got, want, label) => assert(got.every((c, i) => Math.abs(c - want[i]) <= 2),
    `WebGL${device.gpu.version} ${label}: got ${got} want ${want}`);
  try {
    device.clear([0, 0, 0, 1], 3);
    device.draw(texturedDraw(0));
    close(pixel(), RED, 'partial chain, LOD 0 samples level 0');
    device.draw(texturedDraw(4000));
    close(pixel(), GREEN, 'partial chain, coarse LOD clamps to the last supplied level');
    assert.strictEqual(device.gpu.getError(), 0);

    const lit = fixtures.cases().find(c => c.name === 'global ambient and emissive');
    lit.draw.attributes = lit.draw.attributes.filter(a => a.usage !== 3);
    device.draw(lit.draw);
    close(pixel(), lit.expected, 'no NORMAL: ambient and emissive survive');
    const dark = fixtures.draw();
    dark.attributes = dark.attributes.filter(a => a.usage !== 3);
    device.draw(dark);
    close(pixel(), [0, 0, 0, 191], 'no NORMAL: directional diffuse is zero');
    ran++;
  } finally { device.destroy(); }
}
assert(ran > 0);
console.log(`PASS D3D9 WebGL partial mip chains and NORMAL-less lighting (${ran} GL version${ran > 1 ? 's' : ''})`);
})().catch(error => { console.error(error); process.exit(1); });
