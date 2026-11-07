#!/usr/bin/env node
'use strict';

// ARB_multitexture in the fixed-function frontend.
//
// Warcraft III's menu text is what makes this load-bearing. game.dll draws
// every string twice over one font atlas -- a black shadow pass and a coloured
// fill pass -- and between them it calls its own per-unit helper at
// game.dll+0xc1330 twice: once with (unit 0, pointer) and once with
// (unit 1, NULL). That helper selects the client active texture and then
// enables or disables GL_TEXTURE_COORD_ARRAY. On a single-unit implementation
// the unit-1 clear is a plain glDisableClientState and it takes unit 0's
// coordinates with it, so the fill pass samples texel (0,0) of the atlas --
// transparent -- and the alpha test discards every fragment. The menu then
// photographs as buttons with no labels while the shadow alone is on screen.

const assert = require('assert');
const Stream = require('./helpers/gl-reference-encoder');
const { CALL_INDEX, FixedFunctionGL, constants: C } = require('../lib/gl-compat');

const GL_TEXTURE0_ARB = 0x84C0;
const GL_TEXTURE1_ARB = 0x84C1;
const GL_TEXTURE_COORD_ARRAY = 0x8078;
const GL_VERTEX_ARRAY = 0x8074;
const GL_FLOAT = 0x1406;

const memory = new ArrayBuffer(64 * 1024);
const view = new DataView(memory);
const stack = 0x100;
const packed = [];
const encoder = new Stream.Encoder({
  getMemory: () => memory,
  guestToWasm: pointer => pointer,
  shared: false,
  submit: batch => Stream.replay(batch, (opcode, mode, capture) => {
    if (opcode === Stream.PACKED_DRAW_OPCODE) {
      packed.push({ mode, vertices: Array.from(new Float32Array(capture.buffer,
        capture.pointerOffset, capture.pointerLength / 4)) });
    }
    return 0;
  }),
});

const setU32 = values => values.forEach((value, index) =>
  view.setUint32(stack + 4 + index * 4, value >>> 0, true));

// Two positions, and one texture-coordinate array per unit.
const positions = 0x400;
const uv0 = 0x500;
const uv1 = 0x600;
[[0, 0, 0], [1, 2, 3]].forEach(([x, y, z], i) => {
  view.setFloat32(positions + i * 12, x, true);
  view.setFloat32(positions + i * 12 + 4, y, true);
  view.setFloat32(positions + i * 12 + 8, z, true);
});
[[0.25, 0.5], [0.75, 1]].forEach(([u, v], i) => {
  view.setFloat32(uv0 + i * 8, u, true);
  view.setFloat32(uv0 + i * 8 + 4, v, true);
});
// Powers of two so a float32 round trip is exact and the assertions read as
// the values written rather than as their nearest representable neighbours.
[[0.125, 0.25], [0.375, 0.5]].forEach(([u, v], i) => {
  view.setFloat32(uv1 + i * 8, u, true);
  view.setFloat32(uv1 + i * 8 + 4, v, true);
});

setU32([3, GL_FLOAT, 0, positions]);
encoder.call(CALL_INDEX.glVertexPointer, stack, 0);
setU32([GL_VERTEX_ARRAY]);
encoder.call(CALL_INDEX.glEnableClientState, stack, 0);

// Unit 0 gets real coordinates.
setU32([GL_TEXTURE0_ARB]);
encoder.call(CALL_INDEX.glClientActiveTextureARB, stack, 0);
setU32([2, GL_FLOAT, 0, uv0]);
encoder.call(CALL_INDEX.glTexCoordPointer, stack, 0);
setU32([GL_TEXTURE_COORD_ARRAY]);
encoder.call(CALL_INDEX.glEnableClientState, stack, 0);

// Unit 1 gets cleared, exactly as Warcraft III does before every text draw.
setU32([GL_TEXTURE1_ARB]);
encoder.call(CALL_INDEX.glClientActiveTextureARB, stack, 0);
setU32([GL_TEXTURE_COORD_ARRAY]);
encoder.call(CALL_INDEX.glDisableClientState, stack, 0);

setU32([C.LINES]);
encoder.call(CALL_INDEX.glBegin, stack, 0);
for (const index of [0, 1]) {
  setU32([index]);
  encoder.call(CALL_INDEX.glArrayElement, stack, 0);
}
encoder.call(CALL_INDEX.glEnd, stack, 0);
encoder.call(CALL_INDEX.glFinish, stack, 0);

assert.strictEqual(packed.length, 1, 'the cleared unit does not suppress the draw');
const stride = Stream.VERTEX_FLOATS;
const component = offset => packed[0].vertices.filter((_v, i) => i % stride === offset);
assert.deepStrictEqual([component(7), component(8)], [[0.25, 0.75], [0.5, 1]],
  'clearing unit 1 leaves unit 0 texture coordinates intact');
assert.deepStrictEqual([component(12), component(13)], [[0, 0], [0, 0]],
  'a disabled unit contributes no coordinates of its own');

// With unit 1 enabled as well, both pairs reach the vertex.
packed.length = 0;
setU32([GL_TEXTURE1_ARB]);
encoder.call(CALL_INDEX.glClientActiveTextureARB, stack, 0);
setU32([2, GL_FLOAT, 0, uv1]);
encoder.call(CALL_INDEX.glTexCoordPointer, stack, 0);
setU32([GL_TEXTURE_COORD_ARRAY]);
encoder.call(CALL_INDEX.glEnableClientState, stack, 0);
setU32([C.LINES]);
encoder.call(CALL_INDEX.glBegin, stack, 0);
for (const index of [0, 1]) {
  setU32([index]);
  encoder.call(CALL_INDEX.glArrayElement, stack, 0);
}
encoder.call(CALL_INDEX.glEnd, stack, 0);
encoder.call(CALL_INDEX.glFinish, stack, 0);
assert.strictEqual(packed.length, 1);
const second = offset => packed[0].vertices.filter((_v, i) => i % stride === offset);
assert.deepStrictEqual([second(7), second(8)], [[0.25, 0.75], [0.5, 1]],
  'unit 0 keeps its own array when unit 1 is enabled');
assert.deepStrictEqual([second(12), second(13)], [[0.125, 0.375], [0.25, 0.5]],
  'unit 1 reads its own client array');

// glMultiTexCoord2fARB writes the addressed unit's current coordinate.
packed.length = 0;
setU32([GL_TEXTURE1_ARB]);
encoder.call(CALL_INDEX.glClientActiveTextureARB, stack, 0);
setU32([GL_TEXTURE_COORD_ARRAY]);
encoder.call(CALL_INDEX.glDisableClientState, stack, 0);
view.setUint32(stack + 4, GL_TEXTURE1_ARB, true);
view.setFloat32(stack + 8, 0.625, true);
view.setFloat32(stack + 12, 0.75, true);
encoder.call(CALL_INDEX.glMultiTexCoord2fARB, stack, 0);
setU32([C.LINES]);
encoder.call(CALL_INDEX.glBegin, stack, 0);
for (const index of [0, 1]) {
  setU32([index]);
  encoder.call(CALL_INDEX.glArrayElement, stack, 0);
}
encoder.call(CALL_INDEX.glEnd, stack, 0);
encoder.call(CALL_INDEX.glFinish, stack, 0);
const third = offset => packed[0].vertices.filter((_v, i) => i % stride === offset);
assert.deepStrictEqual([third(12), third(13)], [[0.625, 0.625], [0.75, 0.75]],
  'glMultiTexCoord2fARB sets the current coordinate of the unit it names');

// Server-side state: bindings, enables and texture environments are per-unit.
class FakeBackend {
  constructor() {
    this.binds = [];
    this.uniforms = new Map();
    this.gl = { TEXTURE_2D: 0x0DE1, TEXTURE_MIN_FILTER: 1, TEXTURE_MAG_FILTER: 2,
      TEXTURE_WRAP_S: 3, TEXTURE_WRAP_T: 4, NEAREST_MIPMAP_LINEAR: 5, LINEAR: 6,
      REPEAT: 7, ARRAY_BUFFER: 8, STREAM_DRAW: 9 };
  }
  createProgram() { return { handle: {}, attributes: {}, uniforms: {} }; }
  createBuffer() { return {}; }
  createTexture() { return { id: this.binds.length + 1 }; }
  deleteTexture() {}
  bindTexture(texture, unit) { this.binds.push([unit, texture]); }
  setTextureParameter() {}
  setCapability() {}
  setUniform(_program, name, _type, value) { this.uniforms.set(name, value); }
  useProgram() {}
  updateBuffer() {}
  draw() {}
}

const backend = new FakeBackend();
const frontend = new FixedFunctionGL(backend);
frontend.setActiveTexture(GL_TEXTURE1_ARB);
frontend.bindTexture(9);
frontend.setEnabled(C.TEXTURE_2D, true);
frontend.setTextureMode(C.REPLACE);
frontend.setActiveTexture(GL_TEXTURE0_ARB);
frontend.bindTexture(4);
assert.deepStrictEqual(frontend.boundTextureNames, [4, 9],
  'each unit keeps its own texture binding');
assert.deepStrictEqual(frontend.textureUnitEnabled, [false, true],
  'GL_TEXTURE_2D is per-unit state, not context state');
assert.deepStrictEqual(frontend.textureModes, [C.MODULATE, C.REPLACE],
  'the texture environment belongs to the active unit');

frontend._applyUniforms();
assert.strictEqual(backend.uniforms.get('uTexture'), 0);
assert.strictEqual(backend.uniforms.get('uTexture1'), 1);
assert.strictEqual(backend.uniforms.get('uTextureEnabled'), 0);
assert.strictEqual(backend.uniforms.get('uTexture1Enabled'), 0,
  'an enabled unit with no defined image does not apply a texture');
assert.strictEqual(backend.uniforms.get('uTexture1Mode'), 1,
  'unit 1 reports its own GL_REPLACE environment to the shader');

// The texture matrix stack is per-unit too: Warcraft III sets one while a
// non-zero unit is active and must not disturb unit 0's.
frontend.setActiveTexture(GL_TEXTURE1_ARB);
frontend.matrixMode = C.TEXTURE;
frontend._replaceMatrix(new Float32Array([2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]));
frontend.setActiveTexture(GL_TEXTURE0_ARB);
assert.strictEqual(frontend._matrix()[0], 1, 'unit 0 keeps its identity texture matrix');
assert.strictEqual(frontend.textureMatrices[1][0][0], 2, 'unit 1 owns the matrix it was given');

const apis = require('../src/api_table.json');
for (const name of ['glActiveTextureARB', 'glClientActiveTextureARB', 'glMultiTexCoord2fARB']) {
  assert(apis.some(api => api.name === name),
    `${name} is resolvable through wglGetProcAddress`);
}

console.log('opengl multitexture: PASS');
