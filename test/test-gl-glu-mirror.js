#!/usr/bin/env node
'use strict';

// gluPerspective / gluLookAt / gluOrtho2D in the WAT GL mirror
// (src/09a8f-gl-matrix.wat). These three used to latch UNTRUSTED, which made
// the mirror refuse to build any descriptor for an app that called them --
// see docs/gl-software-path-design.md, "Shape of the work" step 2.
//
// WHAT THIS TEST IS FOR. GLU functions are not GL entry points: they are
// library code that composes the primitives, so the risk here is not that a
// matrix comes out wrong-looking but that it comes out subtly DIFFERENT from
// what lib/gl-compat.js computes, while the WebGL path keeps using gl-compat's
// answer. Two renderers quietly disagreeing about the camera is the failure,
// so every check below is against the SHIPPING implementation -- which is why
// perspective() and lookAt() are exported from gl-compat at all -- and never
// against a transcription of the formula into this file.
//
// The arguments are delivered through $gl_mtx_observe with a real encoder
// stack, not through a convenience export, so the GLdouble slot offsets are
// under test too. gluLookAt takes nine of them, which is the case where an
// off-by-one slot would otherwise sail through: swap two and you still get a
// plausible camera.
//
// Each is checked as a MULTIPLY into a non-identity current matrix. GL's
// gluPerspective post-multiplies like glFrustum does; against a fresh identity
// a build that replaced the matrix instead would be indistinguishable.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const { CALL_INDEX } = require('../lib/gl-command-stream');
const { identity, multiply, perspective, lookAt, ortho } = require('./helpers/gl-matrix-reference');

const MODELVIEW = 0x1700, PROJECTION = 0x1701;

const bits = values => [...new Uint32Array(Float32Array.from(values).buffer)]
  .map(v => v.toString(16).padStart(8, '0')).join(' ');

// f32 is not associative, so the mirror's f64 accumulation and gl-compat's
// f32 arithmetic can land a few ulp apart on a product of large terms. The
// header of 09a8f says as much; what matters is that nothing is structurally
// different, so this compares with a tolerance and reports the worst element.
function close(actual, expected, what, tolerance = 2e-5) {
  let worst = 0, at = -1;
  for (let i = 0; i < 16; i++) {
    const delta = Math.abs(actual[i] - expected[i]);
    const scale = Math.max(1, Math.abs(expected[i]));
    if (delta / scale > worst) { worst = delta / scale; at = i; }
  }
  assert.ok(worst <= tolerance,
    `${what}: element ${at} differs by ${worst} relative\n`
    + `  actual   ${[...actual].join(', ')}\n  expected ${[...expected].join(', ')}`);
}

async function main() {
  const { exports: e, memory } = await bootRenderHarness();
  const toHost = guest => (e.get_guest_base() >>> 0) + (guest >>> 0)
    - (e.get_image_base() >>> 0);

  const sp = toHost(e.guest_alloc(128));
  const top = () => new Float32Array(memory.buffer.slice(
    e.gl_mtx_top_ptr() >>> 0, (e.gl_mtx_top_ptr() >>> 0) + 64));

  // A GLdouble argument occupies two stack slots, so argument i of a
  // double-taking call starts at byte 4 + i*8.
  const observe = (op, doubles) => {
    new Uint8Array(memory.buffer, sp, 128).fill(0);
    const view = new DataView(memory.buffer);
    doubles.forEach((v, i) => view.setFloat64(sp + 4 + i * 8, v, true));
    e.gl_mtx_observe(op, sp);
  };

  // Something with no symmetry to hide a transposed or swapped result.
  const seed = () => {
    e.gl_mtx_load_identity();
    e.gl_mtx_translate(2, -3, 5);
    e.gl_mtx_rotate(37, 0.3, 0.8, -0.5);
    return top();
  };

  // --- gluPerspective ----------------------------------------------------
  e.gl_mtx_set_mode(PROJECTION);
  let before = seed();
  observe(CALL_INDEX.gluPerspective, [55, 1.3333333333333333, 0.5, 4000]);
  assert.strictEqual(e.gl_mtx_untrusted(), 0,
    'gluPerspective must no longer latch UNTRUSTED');
  close(top(), multiply(before, perspective(55, 1.3333333333333333, 0.5, 4000)),
    'gluPerspective post-multiplied into the projection stack');

  // A far plane at 4000 against a near of 0.5 puts the depth terms near the
  // edge of f32; this is the element the tolerance above is really for.
  assert.notStrictEqual(bits(top()), bits(before),
    'gluPerspective must have changed the matrix at all');

  // --- gluOrtho2D --------------------------------------------------------
  before = seed();
  observe(CALL_INDEX.gluOrtho2D, [0, 640, 480, 0]); // a typical y-down 2D setup
  assert.strictEqual(e.gl_mtx_untrusted(), 0, 'gluOrtho2D does not latch');
  // Exact, not close: this is ortho() itself with GL's default depth range,
  // so anything but a bit-for-bit match means the -1..1 was not passed on.
  assert.strictEqual(bits(top()), bits(multiply(before, ortho(0, 640, 480, 0, -1, 1))),
    'gluOrtho2D is ortho() with the default -1..1 depth range');

  // --- gluLookAt ---------------------------------------------------------
  //
  // Nine arguments, none of them interchangeable: the eye and centre are
  // distinct points and the up vector is deliberately neither axis-aligned nor
  // perpendicular to the view direction, so the re-orthogonalization runs.
  const camera = [12, 34, -56, 1, 2, 3, 0.1, 0.9, 0.2];
  e.gl_mtx_set_mode(MODELVIEW);
  before = seed();
  observe(CALL_INDEX.gluLookAt, camera);
  assert.strictEqual(e.gl_mtx_untrusted(), 0, 'gluLookAt does not latch');
  close(top(), multiply(before, lookAt(...camera)),
    'gluLookAt post-multiplied into the modelview stack');

  // The translation column is the part a slot mix-up destroys while leaving a
  // valid-looking rotation behind, so it is asserted on its own.
  const expected = lookAt(...camera);
  close(top(), multiply(before, expected), 'gluLookAt basis');
  assert.ok(Math.abs(expected[12]) + Math.abs(expected[13]) + Math.abs(expected[14]) > 1,
    'the camera chosen here must have a real translation, or the check is empty');

  // A degenerate camera must not fill the stack with NaN: `|| 1` in the JS.
  // A NaN here is not a local wrong answer -- it poisons every later multiply,
  // so the damage shows up arbitrarily far from the call that caused it.
  e.gl_mtx_load_identity();
  observe(CALL_INDEX.gluLookAt, [1, 1, 1, 1, 1, 1, 0, 1, 0]); // eye == centre
  assert.ok([...top()].every(Number.isFinite),
    `a degenerate gluLookAt must not produce NaN, got ${[...top()]}`);

  // --- the latch still works ---------------------------------------------
  //
  // The point of clearing a family is that the refusal machinery behind it
  // still fires; a latch nothing can trip is not a safety net. glPushAttrib
  // has a mirror now (test-gl-attrib-stack.js), so the trigger here is the one
  // condition that mirror cannot represent: a push past the cap, whose
  // matching pop then restores the wrong nesting level.
  e.gl_mtx_set_mode(MODELVIEW);
  e.gl_mtx_load_identity();
  for (let i = 0; i < 16; i++) observe(CALL_INDEX.glPushAttrib, []);
  assert.strictEqual(e.gl_mtx_untrusted(), 0,
    'sixteen pushes are legal and must not latch');
  observe(CALL_INDEX.glPushAttrib, []);
  assert.strictEqual(e.gl_mtx_untrusted(), CALL_INDEX.glPushAttrib,
    'a push past the cap must latch UNTRUSTED');
  e.gl_mtx_clear_untrusted();
  for (let i = 0; i < 16; i++) observe(CALL_INDEX.glPopAttrib, []);

  // And a descriptor can now be built for a program that used GLU, which is
  // the whole point of the change.
  const desc = toHost(e.guest_alloc(288));
  e.gl_mtx_set_mode(PROJECTION);
  e.gl_mtx_load_identity();
  observe(CALL_INDEX.gluPerspective, [60, 1.5, 1, 1000]);
  assert.strictEqual(e.gl_dfx1_transform(desc), 1,
    'a DFX1 can now be built from a gluPerspective projection');
  const projection = new Float32Array(memory.buffer.slice(desc + 224, desc + 288));
  assert.ok(projection.some(v => v !== 0 && Number.isFinite(v)),
    'the descriptor carries the GLU-built projection');

  console.log('test-gl-glu-mirror: PASS');
}

main().catch(err => { console.error(err); process.exit(1); });
