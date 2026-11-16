#!/usr/bin/env node
// A pixel shader may read v1 when nothing writes oD1; it reads zero.
//
// v1 is the specular input, and PS1.1 is entitled to read it. Whether it has a
// VALUE depends on the draw: a COLOR2 vertex attribute, fixed-function specular
// lighting, or a vertex shader writing oD1 all produce one. When none of the
// three is present, v1 is an interpolant with no source, and D3D9 calls that
// UNDEFINED -- the same class of state as sampling a stage with no texture
// bound (test-d3d9-unbound-sampler.js), and the same reason it must not be
// fatal: lib/d3d-command-stream.js makes the queue's error sticky, so one
// refused draw ends rendering for the whole run.
//
// The conservative answer costs nothing to produce. $d3d_shader_vm_context
// memory.fills the entire VM context, and the VM already bounds bank 1 to
// index < 2, so an input register nothing writes reads (0,0,0,0) on every lane.
// The refusal was JavaScript-side only.
//
// What this pins is the boundary, not just the permission: when a producer
// DOES exist, serving zero would be a lie about a real specular colour rather
// than a reading of an undefined one. A vertex shader writing oD1 is served
// for real now (test-d3d9-specular-varying.js owns that linkage); a COLOR2
// vertex attribute has no lowering yet and is still refused. Measured on
// Black & White 2's land pass: 58 of 464 shaded draws read v1, every one of
// them fixed-function with no COLOR2 and specular lighting off.
'use strict';
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const { Device } = require('../lib/d3d9-software-backend');

// ps_1_1: mov r0, v<index>
const readInput = index => new Uint32Array([0xffff0101,
  1, 0x800f0000, 0x90e40000 | index,
  0xffff]);

// One full-viewport triangle. `extra` adds a second colour attribute (COLOR2)
// when the case under test wants a real specular producer.
// Position is FLOAT4 and declared POSITIONT on the fixed-function path, so the
// draw needs no world/view/projection matrices to be about the linkage.
const source = (pixelShader, { color2 = false, vertexShader, fixedFunction } = {}) => {
  const stride = color2 ? 24 : 20;
  const vertices = new Uint8Array(3 * stride), v = new DataView(vertices.buffer);
  // POSITIONT is already in screen pixels; a programmable vertex shader writes
  // clip space. Same covering triangle, two coordinate systems.
  const corners = vertexShader ? [[-1, 1], [3, 1], [-1, -3]] : [[-8, -8], [24, -8], [-8, 24]];
  corners.forEach(([x, y], j) => {
    const at = j * stride;
    [x, y, 0.5, 1].forEach((c, k) => v.setFloat32(at + k * 4, c, true));
    vertices.set([255, 255, 255, 255], at + 16);
    if (color2) vertices.set([64, 128, 192, 255], at + 20);
  });
  const attributes = [{ register: 0, usage: vertexShader ? 0 : 9, usageIndex: 0, type: 3, offset: 0 },
    { register: 1, usage: 10, usageIndex: 0, type: 4, offset: 16 }];
  if (color2) attributes.push({ register: 2, usage: 10, usageIndex: 1, type: 4, offset: 20 });
  // A fixed-function vertex stage still needs its descriptor even when the
  // pixel shader is programmable -- the mixed shape B&W2 actually draws with.
  return { primitive: 4, primitiveCount: 1, stride, vertices, attributes, textures: [],
    vertexShader: vertexShader || null, pixelShader, state: { cull: 1, zenable: false },
    fixedFunction: vertexShader ? undefined : (fixedFunction || FIXED) };
};

const FIXED = { lighting: false, specular: false, fog: false, textureFactor: 0xffffffff,
  stages: [{ colorOp: 2, colorArg1: 0, colorArg2: 1, alphaOp: 2, alphaArg1: 0, alphaArg2: 1,
    constant: 0xffffffff, texCoordIndex: 0, transformFlags: 0 }, { colorOp: 1 }] };

// A programmable vertex shader that writes oD1 -- a real producer, and the one
// case the fixed-function path cannot express.
const vsWritesSpecular = new Uint32Array([0xfffe0101,
  1, 0xc00f0000, 0x90e40000,   // mov oPos, v0
  1, 0xd00f0000, 0x90e40001,   // mov oD0,  v1
  1, 0xd00f0001, 0x90e40001,   // mov oD1,  v1
  0xffff]);
const vsNoSpecular = new Uint32Array([0xfffe0101,
  1, 0xc00f0000, 0x90e40000,
  1, 0xd00f0000, 0x90e40001,
  0xffff]);

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none' });
  const d = new Device({ width: 8, height: 8, getExports: () => e, getMemory: () => memory.buffer });
  const centre = pixels => Array.from(pixels.slice((4 * 8 + 4) * 4, (4 * 8 + 5) * 4));
  try {
    // The control: v0 is the diffuse input and has always worked. Texels and
    // present() disagree on channel order, so this also fixes which order the
    // later readings are in -- white is symmetric, so read it off v0 first.
    d.clear([0, 0, 0, 1], 1);
    d.draw(source(readInput(0)));
    assert.deepStrictEqual(centre(d.present().pixels), [255, 255, 255, 255],
      'v0 reads the diffuse colour');

    // The case B&W2 hits: read v1 with nothing writing oD1. It must draw, and
    // the undefined interpolant must read as zero rather than as stale data
    // from whatever used that context before.
    d.clear([0, 0, 0, 1], 1);
    assert.doesNotThrow(() => d.draw(source(readInput(1))),
      'reading an unwritten v1 must not fail the draw');
    assert.deepStrictEqual(centre(d.present().pixels), [0, 0, 0, 0],
      'an unwritten specular input reads zero');

    // Same with a programmable vertex shader that does not write oD1 -- the
    // producer test must look at what the shader writes, not merely at whether
    // a shader is bound.
    d.clear([0, 0, 0, 1], 1);
    assert.doesNotThrow(() => d.draw(source(readInput(1), { vertexShader: vsNoSpecular })),
      'a vertex shader that does not write oD1 leaves v1 undefined, not refused');
    assert.deepStrictEqual(centre(d.present().pixels), [0, 0, 0, 0],
      'v1 still reads zero behind a programmable vertex shader');

    // And the boundary. A COLOR2 attribute is a real specular producer, so
    // answering zero would be a lie rather than a reading of undefined. Since
    // GPU stream v2 slice 9.2 the fixed vertex stage (09aj cascade6) writes
    // oD1 from COLOR2, so the producer is SERVED: v1 reads the vertex colour
    // (present() is BGRA, hence the reversed channels).
    d.clear([0, 0, 0, 1], 1);
    assert.doesNotThrow(() => d.draw(source(readInput(1), { color2: true })),
      'a COLOR2 attribute is a real producer and is served');
    assert.deepStrictEqual(centre(d.present().pixels), [192, 128, 64, 255],
      'v1 reads the COLOR2 vertex colour, not the undefined zero');

    // A vertex shader that writes oD1 is the other side of the same boundary,
    // and it is no longer a refusal: the second colour varying is carried end
    // to end now, so the producer is SERVED rather than rejected. What matters
    // here is only that the two cases stay distinguishable -- an unwritten v1
    // reads zero (above), and a written one reads what was written. The
    // interpolation itself is pinned by test-d3d9-specular-varying.js.
    d.clear([0, 0, 0, 1], 1);
    assert.doesNotThrow(() => d.draw(source(readInput(1), { vertexShader: vsWritesSpecular })),
      'a vertex shader writing oD1 is a real producer and is served');
    assert.deepStrictEqual(centre(d.present().pixels), [255, 255, 255, 255],
      'a written specular input reads the colour, not the undefined zero');

    // v2 and up do not exist in PS1.1 at all, and the native VM bounds bank 1
    // to index < 2. Relaxing v1 must not read as "stop checking inputs".
    assert.throws(() => d.draw(source(readInput(2))), /./,
      'an input register beyond v1 is still an error');

    // The device survives all of it -- the property the sticky queue makes
    // load-bearing. A draw that works in isolation proves nothing.
    d.clear([0, 0, 0, 1], 1);
    d.draw(source(readInput(1)));
    d.draw(source(readInput(0)));
    assert.deepStrictEqual(centre(d.present().pixels), [255, 255, 255, 255],
      'an ordinary draw still works after an undefined-v1 one');
  } finally { d.destroy(); assert.strictEqual(d.bytes, 0); }

  console.log('PASS test-d3d9-unwritten-specular');
})().catch(error => { console.error(error); process.exit(1); });
