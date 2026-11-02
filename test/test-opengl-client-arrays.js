#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Stream = require('./helpers/gl-reference-encoder');
const { CALL_INDEX } = require('../lib/gl-compat');
const apis = require('../src/api_table.json');

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

assert.deepStrictEqual([
  CALL_INDEX.glEnableClientState, CALL_INDEX.glArrayElement,
  CALL_INDEX.glVertexPointer, CALL_INDEX.glNormalPointer,
  CALL_INDEX.glRotated, CALL_INDEX.glVertex2fv, CALL_INDEX.glMateriali,
  CALL_INDEX.glFlush, CALL_INDEX.glLineWidth, CALL_INDEX.glTexCoord2fv,
  CALL_INDEX.glTexParameteri, CALL_INDEX.glVertex2i, CALL_INDEX.gluBuild1DMipmaps,
], [86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98],
  'SimGolf calls append after the established OpenGL command ABI');

const required = new Map([
  ['glEnableClientState', 1], ['glArrayElement', 1], ['glVertexPointer', 4],
  ['glNormalPointer', 3], ['glRotated', 8], ['glVertex2fv', 1], ['glMateriali', 3],
  ['glFlush', 0], ['glLineWidth', 1], ['glTexCoord2fv', 1],
  ['glTexParameteri', 3], ['glVertex2i', 2], ['gluBuild1DMipmaps', 6],
]);
for (const [name, nargs] of required) {
  const api = apis.find(entry => entry.name === name);
  assert(api && api.nargs === nargs, `${name} must resolve through the generated API table`);
}

const setU32 = values => values.forEach((value, index) =>
  view.setUint32(stack + 4 + index * 4, value >>> 0, true));
const vertices = 0x1000, normals = 0x1100;
[[1, 2, 3], [4, 5, 6], [7, 8, 9]].forEach((vertex, index) => {
  vertex.forEach((value, component) =>
    view.setFloat32(vertices + index * 16 + component * 4, value, true));
});
[[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((normal, index) => {
  normal.forEach((value, component) =>
    view.setFloat32(normals + (index * 3 + component) * 4, value, true));
});

setU32([3, 0x1406, 16, vertices]);
encoder.call(CALL_INDEX.glVertexPointer, stack, 0);
setU32([0x1406, 0, normals]);
encoder.call(CALL_INDEX.glNormalPointer, stack, 0);
for (const array of [0x8074, 0x8075]) {
  setU32([array]);
  encoder.call(CALL_INDEX.glEnableClientState, stack, 0);
}
setU32([0x0004]);
encoder.call(CALL_INDEX.glBegin, stack, 0);
for (const index of [2, 0, 1]) {
  setU32([index]);
  encoder.call(CALL_INDEX.glArrayElement, stack, 0);
}
encoder.call(CALL_INDEX.glEnd, stack, 0);
encoder.call(CALL_INDEX.glFinish, stack, 0);

assert.strictEqual(packed.length, 1, 'one client-array triangle becomes one packed draw');
assert.strictEqual(packed[0].mode, 0x0004);
const components = offset => packed[0].vertices.filter(
  (_value, index) => index % Stream.VERTEX_FLOATS === offset);
assert.deepStrictEqual([components(0), components(1), components(2)],
  [[7, 1, 4], [8, 2, 5], [9, 3, 6]],
  'glArrayElement reads the configured vertex pointer and byte stride at call time');
assert.deepStrictEqual([components(9), components(10), components(11)],
  [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
  'enabled normal arrays update the normal attached to each emitted vertex');

console.log('opengl client arrays: PASS');
