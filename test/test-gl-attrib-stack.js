#!/usr/bin/env node
'use strict';

// glPushAttrib / glPopAttrib in the WAT GL mirror (src/09a8f-gl-matrix.wat).
// These were the last two families that latched UNTRUSTED, and the latch is
// all-or-nothing: one glPushAttrib anywhere in a run made the mirror refuse to
// build a descriptor for every draw after it. Measured over the corpus by
// tools/gl-name-census.js, 18 of 35 GL-using binaries name them.
//
// FOUR WAYS THIS GOES WRONG, EACH ASSERTED BELOW.
//
// 1. A pop that does nothing looks exactly like a pop that worked. If push
//    never stored and pop never restored, every value is still whatever the
//    app last set -- which is the correct answer at the moment of a pop that
//    changed nothing in between. So the state is always MUTATED between push
//    and pop, and the depth counter is read directly through
//    gl_mtx_attrib_depth for the same reason.
//
// 2. Saving MORE than lib/gl-compat.js saves is a regression, not an
//    improvement. Real GL's GL_LIGHTING_BIT restores the light parameters and
//    the JS does not; if this side restored them the WAT descriptor and the
//    WebGL picture would disagree after a pop, in scenes that push attributes,
//    as lighting that is subtly wrong in one backend only. That is strictly
//    harder to find than the shared gap. The untouched-state assertions here
//    are load-bearing: they fail a well-meaning future patch that closes the
//    gap on one side.
//
// 3. Nesting. One frame is easy; the failure is a stack that restores the
//    wrong LEVEL, which needs two frames with distinct values to see.
//
// 4. Overflow. A dropped push is not a dropped operation -- its matching pop
//    still arrives and restores an outer frame -- so past the cap the mirror
//    must latch UNTRUSTED, not merely set the GL error. Underflow is the
//    opposite case and must NOT latch: nothing is corrupted by it.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const { CALL_INDEX } = require('../lib/gl-command-stream');

const TEXTURE_MODE = 0x1702;
const AMBIENT = 0x1200, DIFFUSE = 0x1201, SHININESS = 0x1601;
// The setter takes the GL enum, not an index: GL_LIGHT0, not 0.
const LIGHT0 = 0x4000, POSITION = 0x1203;
const FOG_DENSITY = 0x0B62;
// GL_LIGHTING_BIT | GL_TEXTURE_BIT -- the bits an app would actually pass for
// the state this mirror holds.
const LIGHTING_BIT = 0x00000040, TEXTURE_BIT = 0x00040000;

async function main() {
  const { exports: e, memory } = await bootRenderHarness();
  const toHost = guest => (e.get_guest_base() >>> 0) + (guest >>> 0)
    - (e.get_image_base() >>> 0);

  const sp = toHost(e.guest_alloc(128));
  const vec = toHost(e.guest_alloc(32));

  const observe = (op, args = []) => {
    new Uint8Array(memory.buffer, sp, 128).fill(0);
    const view = new DataView(memory.buffer);
    args.forEach((v, i) => view.setUint32(sp + 4 + i * 4, v >>> 0, true));
    e.gl_mtx_observe(op, sp);
  };
  const push = mask => observe(CALL_INDEX.glPushAttrib, [mask]);
  const pop = () => observe(CALL_INDEX.glPopAttrib);

  // Hand four floats to a setter that takes a pointer.
  const four = values => {
    new Float32Array(memory.buffer, vec, 4).set(values);
    return vec;
  };
  const read4 = ptr => [...new Float32Array(memory.buffer, ptr >>> 0, 4)];

  const ambient = () => read4(e.gl_mtx_light_model_ambient_ptr());
  const matDiffuse = () => read4(e.gl_mtx_material_ptr(1));
  const light0Pos = () => read4(e.gl_mtx_light_ptr(0, 0));
  // Texture mode selects stack 2 or 3 by the active unit, so the selected
  // stack index IS the active texture unit, readably.
  const activeUnit = () => {
    e.gl_mtx_set_mode(TEXTURE_MODE);
    return e.gl_mtx_selected() - 2;
  };

  // --- one round trip ----------------------------------------------------
  e.gl_mtx_set_material(DIFFUSE, four([0.11, 0.22, 0.33, 1]));
  e.gl_mtx_set_material(SHININESS, four([12, 0, 0, 0]));
  e.gl_mtx_set_light_model_ambient(four([0.9, 0.8, 0.7, 1]));
  e.gl_mtx_set_active_texture(1);
  e.gl_mtx_set_light(LIGHT0, POSITION, four([5, 6, 7, 1]));
  e.gl_mtx_set_fog(FOG_DENSITY, four([0.25, 0, 0, 0]));

  const savedDiffuse = matDiffuse();
  const savedShininess = e.gl_mtx_shininess();
  const savedAmbient = ambient();
  const savedUnit = activeUnit();
  const lightBeforePush = light0Pos();

  push(LIGHTING_BIT | TEXTURE_BIT);
  assert.strictEqual(e.gl_mtx_untrusted(), 0,
    'glPushAttrib must no longer latch UNTRUSTED');
  assert.strictEqual(e.gl_mtx_attrib_depth(), 1, 'push deepens the stack');

  // Change every saved field, so a no-op pop cannot pass.
  e.gl_mtx_set_material(DIFFUSE, four([-1, -2, -3, -4]));
  e.gl_mtx_set_material(SHININESS, four([99, 0, 0, 0]));
  e.gl_mtx_set_light_model_ambient(four([0, 0, 0, 0]));
  e.gl_mtx_set_active_texture(0);
  assert.notDeepStrictEqual(matDiffuse(), savedDiffuse, 'the mutation landed');

  // And change two fields that are deliberately NOT saved.
  e.gl_mtx_set_light(LIGHT0, POSITION, four([-8, -9, -10, 0]));
  e.gl_mtx_set_fog(FOG_DENSITY, four([0.75, 0, 0, 0]));

  pop();
  assert.strictEqual(e.gl_mtx_attrib_depth(), 0, 'pop shallows the stack');
  assert.deepStrictEqual(matDiffuse(), savedDiffuse, 'material diffuse restored');
  assert.strictEqual(e.gl_mtx_shininess(), savedShininess, 'shininess restored');
  assert.deepStrictEqual(ambient(), savedAmbient, 'light model ambient restored');
  assert.strictEqual(activeUnit(), savedUnit, 'active texture unit restored');

  // The deliberate gap, asserted as a gap. See note 2 in the header.
  assert.deepStrictEqual(light0Pos(), [-8, -9, -10, 0],
    'light parameters are NOT restored, because lib/gl-compat.js does not'
    + ' restore them either -- closing this on one side only would make the two'
    + ' backends disagree');
  assert.notDeepStrictEqual(light0Pos(), lightBeforePush,
    'the light really was left at its post-push value');
  assert.strictEqual(e.gl_mtx_fog_density(), 0.75, 'fog is NOT restored either');

  // --- nesting -----------------------------------------------------------
  //
  // Two frames carrying different values. A stack that restores the newest
  // frame twice, or the oldest frame twice, passes a single-level test.
  e.gl_mtx_set_light_model_ambient(four([1, 0, 0, 1]));
  push(LIGHTING_BIT);                                   // outer holds red
  e.gl_mtx_set_light_model_ambient(four([0, 1, 0, 1]));
  push(LIGHTING_BIT);                                   // inner holds green
  e.gl_mtx_set_light_model_ambient(four([0, 0, 1, 1]));
  assert.strictEqual(e.gl_mtx_attrib_depth(), 2, 'two frames deep');

  pop();
  assert.deepStrictEqual(ambient(), [0, 1, 0, 1], 'inner pop restores green');
  pop();
  assert.deepStrictEqual(ambient(), [1, 0, 0, 1], 'outer pop restores red');
  assert.strictEqual(e.gl_mtx_attrib_depth(), 0, 'both frames consumed');

  // --- underflow ---------------------------------------------------------
  //
  // lib/gl-compat.js:724-725 returns silently on an empty stack. Nothing is
  // corrupted, so the GL error is set but the mirror stays TRUSTED.
  e.gl_mtx_clear_error();
  const beforeUnderflow = ambient();
  pop();
  assert.strictEqual(e.gl_mtx_error(), 0x0504, 'empty pop is GL_STACK_UNDERFLOW');
  assert.strictEqual(e.gl_mtx_untrusted(), 0,
    'an underflow corrupts nothing, so it must not latch UNTRUSTED');
  assert.deepStrictEqual(ambient(), beforeUnderflow, 'empty pop changes nothing');
  assert.strictEqual(e.gl_mtx_attrib_depth(), 0, 'depth cannot go negative');

  // --- overflow ----------------------------------------------------------
  e.gl_mtx_clear_error();
  for (let i = 0; i < 16; i++) push(LIGHTING_BIT);
  assert.strictEqual(e.gl_mtx_attrib_depth(), 16, 'the cap is GL\'s minimum, 16');
  assert.strictEqual(e.gl_mtx_error(), 0, 'sixteen pushes are all legal');
  assert.strictEqual(e.gl_mtx_untrusted(), 0, 'and none of them latch');

  push(LIGHTING_BIT);
  assert.strictEqual(e.gl_mtx_error(), 0x0503, 'the 17th is GL_STACK_OVERFLOW');
  assert.strictEqual(e.gl_mtx_attrib_depth(), 16, 'and it stores nothing');
  assert.strictEqual(e.gl_mtx_untrusted(), CALL_INDEX.glPushAttrib,
    'a dropped push desynchronizes every later pop, so it MUST latch');

  console.log('PASS test-gl-attrib-stack');
}

main().catch(err => { console.error(err); process.exit(1); });
