#!/usr/bin/env node
'use strict';

// glTexCoord4f/4fv and glMultiTexCoord4fARB/4fvARB: projective texture
// coordinates on the software GL path, driven through the production WAT
// encoder (gl_wat_encoder_call) -- current state, packed 19-float vertex,
// software raster -- the way Oni's New Game draws.
//
// A 2x1 texture, red | blue with NEAREST, so u < 0.5 is red. Across a quad
// filling the 32x32 view the left edge has (s, q) = (0, 1) and the right edge
// (3, 3): u = s/q runs 0 .. 1, but projectively, s(x) = 3x and q(x) = 1 + 2x
// give u = 0.5 at x = 1/4 -- column 8. Dividing at the vertices and then
// interpolating u affinely puts the boundary at column 16 instead.
//
// Each case below names what the implementation before glTexCoord4f got
// wrong: the API trapped (no opcode), lines divided at their ends, and lines
// and points never sampled texture unit 1 at all.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const { CALL_INDEX } = require('../lib/gl-command-stream');
const { VERTEX_FLOATS } = require('../lib/gl-command-stream.js');

const MODELVIEW = 0x1700, PROJECTION = 0x1701, TEXTURE = 0x1702;
const VP = 32;
const GL_TEXTURE_2D = 0x0DE1, GL_TEXTURE0 = 0x84C0, GL_TEXTURE1 = 0x84C1;
const GL_POINTS = 0, GL_LINES = 1, GL_QUADS = 7;
const RED = 0xFFFF0000, BLUE = 0xFF0000FF;
const QUARTER = VP / 4, HALF = VP / 2;

async function main() {
  assert.strictEqual(VERTEX_FLOATS, 19, 'r0, q0, r1, q1 follow w in the packed vertex');
  for (const name of ['glTexCoord4f', 'glTexCoord4fv', 'glMultiTexCoord4fARB', 'glMultiTexCoord4fvARB']) {
    assert.ok(Number.isInteger(CALL_INDEX[name]), `${name} has a GL opcode`);
  }
  const { exports: e, memory } = await bootRenderHarness();
  const guestBase = e.get_guest_base() >>> 0, imageBase = e.get_image_base() >>> 0;
  const toWasm = guest => guestBase + (guest >>> 0) - imageBase;
  const stackGuest = e.guest_alloc(96) >>> 0, stack = toWasm(stackGuest);
  const vecGuest = e.guest_alloc(256) >>> 0;
  const f32bits = v => new Int32Array(new Float32Array([v]).buffer)[0];
  const args = list => {
    const words = new Int32Array(memory.buffer, stack, 24);
    words.fill(0);
    list.forEach((v, i) => { words[1 + i] = typeof v === 'number' && !Number.isInteger(v) ? f32bits(v) : v; });
  };
  // GL state set up the way the existing software tests do it, then the
  // draws through the encoder proper.
  const observe = (op, ...list) => { args(list); e.gl_sw_observe(op, stack); };
  const gl = (name, ...list) => { args(list); return e.gl_wat_encoder_call(CALL_INDEX[name], stack, 0); };
  const f = v => ({ f: v });
  const glf = (name, ...list) => {
    const words = new Int32Array(memory.buffer, stack, 24);
    words.fill(0);
    list.forEach((v, i) => { words[1 + i] = (v && v.f !== undefined) ? f32bits(v.f) : v; });
    return e.gl_wat_encoder_call(CALL_INDEX[name], stack, 0);
  };
  const vec = (offset, values) => {
    new Float32Array(memory.buffer, toWasm(vecGuest) + offset, values.length).set(values);
    return vecGuest + offset;
  };

  args([0, 0, VP, VP]);
  e.gl_mtx_observe(CALL_INDEX.glViewport, stack);
  e.gl_mtx_set_mode(MODELVIEW); e.gl_mtx_load_identity();
  e.gl_mtx_set_mode(PROJECTION); e.gl_mtx_load_identity();
  e.gl_mtx_ortho(-1, 1, -1, 1, -1, 1);
  e.gl_sw_set_enabled(1);

  const texels = e.guest_alloc(8) >>> 0;
  new Uint8Array(memory.buffer, toWasm(texels), 6).set([255, 0, 0, 0, 0, 255]);
  const bindUnit = unit => {
    observe(CALL_INDEX.glActiveTextureARB, GL_TEXTURE0 + unit);
    args([GL_TEXTURE0 + unit]); e.gl_mtx_observe(CALL_INDEX.glActiveTextureARB, stack);
    observe(CALL_INDEX.glBindTexture, GL_TEXTURE_2D, 7 + unit);
    observe(CALL_INDEX.glPixelStorei, 0x0CF5, 1);
    observe(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2800, 0x2600);
    observe(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2801, 0x2600);
    observe(CALL_INDEX.glTexImage2D, GL_TEXTURE_2D, 0, 0x1907, 2, 1, 0, 0x1907, 0x1401, texels);
  };
  bindUnit(1);
  bindUnit(0);
  // Only one unit textures at a time, so each case reads one unit's sample.
  const useUnit = unit => {
    observe(CALL_INDEX.glActiveTextureARB, GL_TEXTURE0 + 1 - unit);
    observe(CALL_INDEX.glDisable, GL_TEXTURE_2D);
    observe(CALL_INDEX.glActiveTextureARB, GL_TEXTURE0 + unit);
    observe(CALL_INDEX.glEnable, GL_TEXTURE_2D);
    args([GL_TEXTURE0 + unit]); e.gl_mtx_observe(CALL_INDEX.glActiveTextureARB, stack);
  };
  useUnit(0);

  const surface = () => {
    const entry = e.gl_sw_entry() >>> 0;
    const u16 = o => new Uint16Array(memory.buffer.slice(entry + o, entry + o + 2))[0];
    const dib = new Int32Array(memory.buffer.slice(entry + 20, entry + 24))[0] >>> 0;
    const stride = u16(18) / 4;
    const pixels = new Uint32Array(memory.buffer.slice(dib, dib + u16(18) * u16(14)));
    return y => Array.from({ length: VP }, (_, x) => pixels[y * stride + x] >>> 0);
  };
  const midRow = () => surface()(HALF);
  // The row a horizontal line landed on: the one with the most textured pixels.
  const lineRow = () => {
    const at = surface();
    let best = [], bestCount = -1;
    for (let y = 0; y < VP; y++) {
      const r = at(y), n = r.filter(p => p === RED || p === BLUE).length;
      if (n > bestCount) { best = r; bestCount = n; }
    }
    return best;
  };
  const boundary = r => r.findIndex(p => p === BLUE);
  const clear = () => {
    observe(CALL_INDEX.glClearColor, 0, 0, 0, 0);
    observe(CALL_INDEX.glClear, 0x4000);
  };

  // A full-view quad: per corner, the texture call for that corner's u side.
  const quad = (texLeft, texRight) => {
    glf('glBegin', GL_QUADS);
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      (x < 0 ? texLeft : texRight)();
      glf('glVertex2f', f(x), f(y));
    }
    glf('glEnd');
  };
  const near = (got, want, what) =>
    assert.ok(Math.abs(got - want) <= 1, `${what}: boundary at column ${got}, expected ${want}`);

  // 1. glTexCoord4f, scalar.
  quad(() => glf('glTexCoord4f', f(0), f(0.5), f(0), f(1)),
       () => glf('glTexCoord4f', f(3), f(0.5), f(0), f(3)));
  const scalar = midRow();
  assert.ok(scalar.every(p => p === RED || p === BLUE), 'glTexCoord4f quad is textured');
  near(boundary(scalar), QUARTER, 'glTexCoord4f (s,q) 0,1 | 3,3 is projective');

  // 2. glTexCoord4fv, the vector form: the same pixels.
  quad(() => gl('glTexCoord4fv', vec(0, [0, 0.5, 0, 1])),
       () => gl('glTexCoord4fv', vec(16, [3, 0.5, 0, 3])));
  assert.deepStrictEqual(midRow(), scalar, 'glTexCoord4fv draws what glTexCoord4f does');

  // 3. glTexCoord2f puts q back to 1: the affine half-way boundary.
  quad(() => glf('glTexCoord2f', f(0), f(0.5)), () => glf('glTexCoord2f', f(1), f(0.5)));
  near(boundary(midRow()), HALF, 'glTexCoord2f after glTexCoord4f resets q = 1');
  // ...and so does glTexCoord2fv.
  glf('glTexCoord4f', f(0), f(0), f(0), f(5));
  quad(() => gl('glTexCoord2fv', vec(32, [0, 0.5])), () => gl('glTexCoord2fv', vec(40, [1, 0.5])));
  near(boundary(midRow()), HALF, 'glTexCoord2fv resets q = 1');

  // 4. r is real: a texture matrix that adds r to s. Left (s, r, q) = (0, 0, 1),
  //    right (0, 3, 3): s' = 3 there, so the quarter boundary again; dropping r
  //    would leave s' = 0 and the whole row red.
  e.gl_mtx_set_mode(TEXTURE);
  const m = vec(64, [1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1]);
  args([m]); e.gl_mtx_observe(CALL_INDEX.glLoadMatrixf, stack);
  quad(() => glf('glTexCoord4f', f(0), f(0.5), f(0), f(1)),
       () => glf('glTexCoord4f', f(0), f(0.5), f(3), f(3)));
  near(boundary(midRow()), QUARTER, 'r through the texture matrix');
  e.gl_mtx_load_identity();

  // 5. Texture unit 1 through glMultiTexCoord4fARB and its vector form.
  useUnit(1);
  quad(() => glf('glMultiTexCoord4fARB', GL_TEXTURE1, f(0), f(0.5), f(0), f(1)),
       () => glf('glMultiTexCoord4fARB', GL_TEXTURE1, f(3), f(0.5), f(0), f(3)));
  near(boundary(midRow()), QUARTER, 'glMultiTexCoord4fARB on unit 1');
  quad(() => gl('glMultiTexCoord4fvARB', GL_TEXTURE1, vec(80, [0, 0.5, 0, 1])),
       () => gl('glMultiTexCoord4fvARB', GL_TEXTURE1, vec(96, [3, 0.5, 0, 3])));
  near(boundary(midRow()), QUARTER, 'glMultiTexCoord4fvARB on unit 1');
  useUnit(0);

  // 6. Client arrays: 4-component texture coordinates, glDrawArrays.
  const pos = vec(128, [-1, -1, 1, -1, 1, 1, -1, 1]);
  const tex = vec(160, [0, 0.5, 0, 1, 3, 0.5, 0, 3, 3, 0.5, 0, 3, 0, 0.5, 0, 1]);
  gl('glVertexPointer', 2, 0x1406, 0, pos);
  gl('glTexCoordPointer', 4, 0x1406, 0, tex);
  gl('glEnableClientState', 0x8074);
  gl('glEnableClientState', 0x8078);
  gl('glDrawArrays', GL_QUADS, 0, 4);
  near(boundary(midRow()), QUARTER, '4-component glTexCoordPointer');
  // A 2-component array of the same s leaves q = 1.
  const tex2 = vec(224, [0, 0.5, 1, 0.5, 1, 0.5, 0, 0.5]);
  gl('glTexCoordPointer', 2, 0x1406, 0, tex2);
  gl('glDrawArrays', GL_QUADS, 0, 4);
  near(boundary(midRow()), HALF, '2-component glTexCoordPointer keeps q = 1');
  gl('glDisableClientState', 0x8074);
  gl('glDisableClientState', 0x8078);

  // 7. A projective line: interpolated S/w and Q/w along it, not a divide at
  //    its ends (which puts the boundary half-way).
  const line = (texLeft, texRight) => {
    clear();
    glf('glBegin', GL_LINES);
    texLeft(); glf('glVertex2f', f(-1), f(0));
    texRight(); glf('glVertex2f', f(1), f(0));
    glf('glEnd');
    return lineRow();
  };
  near(boundary(line(() => glf('glTexCoord4f', f(0), f(0.5), f(0), f(1)),
                     () => glf('glTexCoord4f', f(3), f(0.5), f(0), f(3)))),
    QUARTER, 'projective line, unit 0');
  near(boundary(line(() => glf('glTexCoord2f', f(0), f(0.5)),
                     () => glf('glTexCoord2f', f(1), f(0.5)))),
    HALF, 'affine line control, unit 0');

  // 8. Texture unit 1 on a line: sampled at all, and projectively.
  useUnit(1);
  const l1 = line(() => glf('glMultiTexCoord4fARB', GL_TEXTURE1, f(0), f(0.5), f(0), f(1)),
                  () => glf('glMultiTexCoord4fARB', GL_TEXTURE1, f(3), f(0.5), f(0), f(3)));
  assert.ok(l1.some(p => p === RED) && l1.some(p => p === BLUE), 'unit 1 textures a line');
  near(boundary(l1), QUARTER, 'projective line, unit 1');

  // 9. Points: unit 1 sampled, and unit 0's u = s/q. (s, q) = (3, 4) is 0.75,
  //    blue; s alone wraps to 0, red.
  const point = tc => {
    clear();
    glf('glBegin', GL_POINTS); tc(); glf('glVertex2f', f(0), f(0)); glf('glEnd');
    return lineRow().filter(p => p === RED || p === BLUE);
  };
  assert.deepStrictEqual(point(() => glf('glMultiTexCoord4fARB', GL_TEXTURE1, f(3), f(0.5), f(0), f(4))),
    [BLUE], 'unit 1 samples a point at s/q');
  useUnit(0);
  assert.deepStrictEqual(point(() => glf('glTexCoord4f', f(3), f(0.5), f(0), f(4))),
    [BLUE], 'unit 0 samples a point at s/q');

  console.log(`PASS  glTexCoord4f/4fv, glMultiTexCoord4fARB/4fvARB, 4-component arrays, `
    + `projective lines and unit-1 lines/points on the software path (boundary ${QUARTER} of ${VP})`);
}

main().catch(err => { console.error(err); process.exit(1); });
