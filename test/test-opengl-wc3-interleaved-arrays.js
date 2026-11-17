#!/usr/bin/env node
// Warcraft III draws everything -- terrain, units and every line of menu text --
// through ONE interleaved client-array layout and glDrawElements. Game.dll's
// batch setter at 0x6f0c1977 is, verbatim:
//
//   glVertexPointer  (3, GL_FLOAT,         36, base+0x00)
//   glNormalPointer  (   GL_FLOAT,         36, base+0x0c)
//   glColorPointer   (4, GL_UNSIGNED_BYTE, 36, base+0x18)
//   glTexCoordPointer(2, GL_FLOAT,         36, base+0x1c)
//   glDrawElements   (mode, count, GL_UNSIGNED_SHORT, indices)
//
// so a 36-byte vertex is pos[3f] | normal[3f] | colour[4ub] | uv[2f]. That
// shape is what this pins: a stride that is NOT the tight size, a colour array
// of normalized unsigned bytes read at a non-zero offset into the vertex, and
// indices that are not 0,1,2 in order.
//
// It also pins the state rule that decides whether text is visible at all.
// Game.dll imports NO glColor* entry point -- glColorPointer is its only source
// of vertex colour -- so when it turns GL_COLOR_ARRAY off, every vertex must
// take the GL default current colour, opaque white. A colour left over from the
// previous array-driven draw would multiply into the glyph texture under
// GL_MODULATE, and an alpha of 0 there is discarded by the alpha test: the text
// is submitted, shaded away, and the menu looks like it has no labels.
'use strict';

const assert = require('assert');
const Stream = require('./helpers/gl-reference-encoder');
const { CALL_INDEX } = require('../lib/gl-command-stream');
const apis = require('../src/api_table.json');

const GL_TRIANGLES = 0x0004, GL_FLOAT = 0x1406, GL_UNSIGNED_BYTE = 0x1401;
const GL_UNSIGNED_SHORT = 0x1403;
const VERTEX_ARRAY = 0x8074, NORMAL_ARRAY = 0x8075;
const COLOR_ARRAY = 0x8076, TEXTURE_COORD_ARRAY = 0x8078;
const STRIDE = 36;

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

// The ABI is position-dependent in three files at once; assert the positions
// this test reasons about rather than trusting the names.
assert.deepStrictEqual([
  CALL_INDEX.glTexCoordPointer, CALL_INDEX.glColorPointer, CALL_INDEX.glDrawElements,
], [100, 101, 102], 'Warcraft III calls append after the SimGolf OpenGL ABI');
for (const [name, nargs] of [['glTexCoordPointer', 4], ['glColorPointer', 4],
  ['glDrawElements', 4]]) {
  const api = apis.find(entry => entry.name === name);
  assert(api && api.nargs === nargs, `${name} must resolve through the generated API table`);
}

const setU32 = values => values.forEach((value, index) =>
  view.setUint32(stack + 4 + index * 4, value >>> 0, true));

// Three vertices in Game.dll's layout. Colours are deliberately NOT white and
// NOT opaque-by-accident: a reader that dropped the alpha byte, or read the
// colour at the wrong offset, would still pass against 0xffffffff.
const base = 0x1000, indices = 0x2000;
const VERTICES = [
  { pos: [1, 2, 3], normal: [1, 0, 0], color: [10, 20, 30, 40], uv: [0.25, 0.5] },
  { pos: [4, 5, 6], normal: [0, 1, 0], color: [50, 60, 70, 255], uv: [0.75, 0.125] },
  { pos: [7, 8, 9], normal: [0, 0, 1], color: [80, 90, 100, 128], uv: [1, 0] },
];
VERTICES.forEach((v, i) => {
  const at = base + i * STRIDE;
  v.pos.forEach((n, c) => view.setFloat32(at + c * 4, n, true));
  v.normal.forEach((n, c) => view.setFloat32(at + 12 + c * 4, n, true));
  v.color.forEach((n, c) => view.setUint8(at + 24 + c, n));
  v.uv.forEach((n, c) => view.setFloat32(at + 28 + c * 4, n, true));
});
// Out of order, so an implementation that walks the arrays sequentially instead
// of through the index buffer fails here rather than silently in a game.
const ORDER = [2, 0, 1];
ORDER.forEach((n, i) => view.setUint16(indices + i * 2, n, true));

setU32([3, GL_FLOAT, STRIDE, base]);
encoder.call(CALL_INDEX.glVertexPointer, stack, 0);
setU32([GL_FLOAT, STRIDE, base + 12]);
encoder.call(CALL_INDEX.glNormalPointer, stack, 0);
setU32([4, GL_UNSIGNED_BYTE, STRIDE, base + 24]);
encoder.call(CALL_INDEX.glColorPointer, stack, 0);
setU32([2, GL_FLOAT, STRIDE, base + 28]);
encoder.call(CALL_INDEX.glTexCoordPointer, stack, 0);
for (const array of [VERTEX_ARRAY, NORMAL_ARRAY, COLOR_ARRAY, TEXTURE_COORD_ARRAY]) {
  setU32([array]);
  encoder.call(CALL_INDEX.glEnableClientState, stack, 0);
}

setU32([GL_TRIANGLES, 3, GL_UNSIGNED_SHORT, indices]);
encoder.call(CALL_INDEX.glDrawElements, stack, 0);
// Packed geometry sits in the stream until a barrier or an explicit flush.
encoder.flush();

assert.strictEqual(packed.length, 1, 'glDrawElements compiles into one packed draw');
assert.strictEqual(packed[0].mode, GL_TRIANGLES);
const FLOATS = Stream.VERTEX_FLOATS;
assert.strictEqual(packed[0].vertices.length, 3 * FLOATS, 'three vertices reach the backend');

const near = (actual, expected, what) =>
  assert.ok(Math.abs(actual - expected) < 1e-5,
    `${what}: expected ${expected}, got ${actual}`);

ORDER.forEach((source, slot) => {
  const v = VERTICES[source];
  const at = packed[0].vertices.slice(slot * FLOATS, (slot + 1) * FLOATS);
  v.pos.forEach((n, c) => near(at[c], n, `vertex ${slot} position component ${c}`));
  // Unsigned bytes are normalized by 255, alpha included. Alpha is the one that
  // decides whether Warcraft III's text survives its own alpha test.
  v.color.forEach((n, c) => near(at[3 + c], n / 255, `vertex ${slot} colour component ${c}`));
  v.uv.forEach((n, c) => near(at[7 + c], n, `vertex ${slot} texcoord component ${c}`));
  v.normal.forEach((n, c) => near(at[9 + c], n, `vertex ${slot} normal component ${c}`));
});

// With GL_COLOR_ARRAY off, the current colour applies -- and since Warcraft III
// never calls glColor*, that must be the GL default white, NOT whatever the
// previous indexed draw happened to read out of the colour array.
packed.length = 0;
setU32([COLOR_ARRAY]);
encoder.call(CALL_INDEX.glDisableClientState, stack, 0);
setU32([GL_TRIANGLES, 3, GL_UNSIGNED_SHORT, indices]);
encoder.call(CALL_INDEX.glDrawElements, stack, 0);
encoder.flush();
assert.strictEqual(packed.length, 1, 'a draw with no colour array still reaches the backend');
for (let slot = 0; slot < 3; slot++) {
  const at = packed[0].vertices.slice(slot * FLOATS, (slot + 1) * FLOATS);
  assert.deepStrictEqual(at.slice(3, 7), [1, 1, 1, 1],
    `vertex ${slot} takes the default current colour once COLOR_ARRAY is disabled`);
}

console.log('PASS  Warcraft III interleaved client arrays reach the backend intact');
console.log('PASS  disabling GL_COLOR_ARRAY restores the default opaque-white colour');
