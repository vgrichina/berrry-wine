#!/usr/bin/env node
'use strict';

// The encoder's observer: does a real GL call, in its real stack layout,
// reach the right field of the WAT state block?
//
// test-gl-matrix-stacks.js checks the state machine through its own entry
// points, which says nothing about the wiring. This drives $gl_mtx_observe
// with the same (opcode, stack image) pair $gl_wat_encode_call hands it, so
// an argument read at the wrong offset, a GLdouble mistaken for a GLfloat, or
// an opcode off by one fails here. Those are exactly the mistakes a unit test
// of the state machine cannot see.
//
// Opcodes are the CALLS index from lib/gl-compat.js, taken from CALL_INDEX
// rather than written down, so this test also pins the numbers the WAT has
// hard-coded: if CALLS is ever reordered, these assertions fail rather than
// the mirror quietly reading the wrong argument.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const { CALL_INDEX } = require('../lib/gl-command-stream');
const { identity, multiply, ortho } = require('./helpers/gl-matrix-reference');

const MODELVIEW = 0x1700, PROJECTION = 0x1701, TEXTURE = 0x1702;
const LIGHT0 = 0x4000, POSITION = 0x1203, DIFFUSE = 0x1201;
const SHININESS = 0x1601, AMBIENT_AND_DIFFUSE = 0x1602;
const FOG_MODE = 0x0B65, FOG_START = 0x0B63, FOG_COLOR = 0x0B66;
const FOG_LINEAR = 0x2601, FOG_EXP2 = 0x0801;
const TEXTURE0_ARB = 0x84C0;

// A GL call's stack image as the encoder sees it: a return address in slot 0,
// then the arguments. Writers are typed because getting this wrong is the
// bug the test exists to catch -- glRotatef takes four GLfloats where
// glRotated takes four GLdoubles, and the two are indistinguishable from the
// opcode alone.
class Stack {
  constructor(memory, base) {
    this.view = new DataView(memory.buffer);
    this.base = base;
    this.offset = 4; // slot 0 is the return address
  }
  reset() { this.offset = 4; return this; }
  i32(v) { this.view.setInt32(this.base + this.offset, v, true); this.offset += 4; return this; }
  f32(v) { this.view.setFloat32(this.base + this.offset, v, true); this.offset += 4; return this; }
  f64(v) { this.view.setFloat64(this.base + this.offset, v, true); this.offset += 8; return this; }
}

(async () => {
  const { exports: e, memory } = await bootRenderHarness();
  const imageBase = e.get_image_base() >>> 0;
  const guestBase = e.get_guest_base() >>> 0;
  const wa = guest => (guest - imageBase + guestBase) >>> 0;

  // Somewhere to build stack images and out-of-line argument vectors. Both
  // must be guest-addressable, because the WAT converts pointer arguments
  // with g2w exactly as it would for a real guest call.
  const stackGuest = e.guest_alloc(256) >>> 0;
  const argsGuest = e.guest_alloc(256) >>> 0;
  const stack = new Stack(memory, wa(stackGuest));
  const argsWa = wa(argsGuest);
  const floats = new Float32Array(memory.buffer, argsWa, 16);

  const call = (name, build) => {
    const op = CALL_INDEX[name];
    assert.notStrictEqual(op, undefined, `${name} is not in CALLS`);
    build(stack.reset());
    e.gl_mtx_observe(op, wa(stackGuest));
  };
  const read = ptr => new Float32Array(memory.buffer.slice(ptr, ptr + 64));
  const top = () => read(e.gl_mtx_top_ptr() >>> 0);
  const vec4 = ptr => [...new Float32Array(memory.buffer.slice(ptr, ptr + 16))];
  const f32v = (...values) => values.map(Math.fround);
  const transform = (m, x, y, z) => {
    const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
    return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
      (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
      (m[2] * x + m[6] * y + m[10] * z + m[14]) / w];
  };

  assert.strictEqual(e.gl_mtx_untrusted(), 0, 'a fresh block is trusted');

  // ---- matrix mode and the stack ops -------------------------------------
  call('glMatrixMode', s => s.i32(PROJECTION));
  assert.strictEqual(e.gl_mtx_selected(), 1, 'glMatrixMode(GL_PROJECTION)');
  call('glMatrixMode', s => s.i32(TEXTURE));
  assert.strictEqual(e.gl_mtx_selected(), 2, 'glMatrixMode(GL_TEXTURE)');
  // glActiveTextureARB selects the texture matrix stack, not just the binding.
  call('glActiveTextureARB', s => s.i32(TEXTURE0_ARB + 1));
  assert.strictEqual(e.gl_mtx_selected(), 3, 'unit 1 selects the second stack');
  call('glActiveTextureARB', s => s.i32(TEXTURE0_ARB));
  assert.strictEqual(e.gl_mtx_selected(), 2, 'and back to the first');
  call('glMatrixMode', s => s.i32(MODELVIEW));
  assert.strictEqual(e.gl_mtx_selected(), 0, 'glMatrixMode(GL_MODELVIEW)');

  call('glLoadIdentity', s => s);
  assert.strictEqual(e.gl_mtx_depth(0), 0, 'stack starts one deep');
  call('glPushMatrix', s => s);
  assert.strictEqual(e.gl_mtx_depth(0), 1, 'glPushMatrix');
  call('glPopMatrix', s => s);
  assert.strictEqual(e.gl_mtx_depth(0), 0, 'glPopMatrix');

  // ---- GLfloat arguments --------------------------------------------------
  call('glLoadIdentity', s => s);
  call('glTranslatef', s => s.f32(3).f32(4).f32(5));
  assert.deepStrictEqual(transform(top(), 0, 0, 0), [3, 4, 5],
    'glTranslatef reads three GLfloats starting at argument 0');
  call('glScalef', s => s.f32(2).f32(2).f32(2));
  assert.deepStrictEqual(transform(top(), 1, 1, 1), [5, 6, 7],
    'glScalef composes after the translate, not before');

  // glRotatef takes GLfloats; reading them as GLdoubles gives garbage, and
  // 90 degrees about +Z is the cheapest arrangement where that is obvious.
  call('glLoadIdentity', s => s);
  call('glRotatef', s => s.f32(90).f32(0).f32(0).f32(1));
  {
    const p = transform(top(), 1, 0, 0);
    assert.ok(Math.abs(p[0]) < 1e-6 && Math.abs(p[1] - 1) < 1e-6,
      `glRotatef(90,0,0,1) takes (1,0,0) to (0,1,0), got ${p.join(', ')}`);
  }

  // ---- GLdouble arguments -------------------------------------------------
  // glRotated is the same operation with doubles. If the WAT read these as
  // floats it would see the low half of the first double as the angle.
  call('glLoadIdentity', s => s);
  call('glRotated', s => s.f64(90).f64(0).f64(0).f64(1));
  {
    const p = transform(top(), 1, 0, 0);
    assert.ok(Math.abs(p[0]) < 1e-6 && Math.abs(p[1] - 1) < 1e-6,
      `glRotated(90,0,0,1) takes (1,0,0) to (0,1,0), got ${p.join(', ')}`);
  }

  // glOrtho's six GLdoubles, checked against gl-compat's own ortho().
  call('glMatrixMode', s => s.i32(PROJECTION));
  call('glLoadIdentity', s => s);
  call('glOrtho', s => s.f64(0).f64(640).f64(480).f64(0).f64(-1).f64(1));
  assert.deepStrictEqual([...top()],
    [...multiply(identity(), ortho(0, 640, 480, 0, -1, 1))],
    'glOrtho reads six GLdoubles and composes them like gl-compat');

  // glFrustum, by its defining property rather than by a reference matrix.
  call('glLoadIdentity', s => s);
  call('glFrustum', s => s.f64(-1).f64(1).f64(-0.75).f64(0.75).f64(0.1).f64(4096));
  {
    const near = transform(top(), 0, 0, -0.1);
    const far = transform(top(), 0, 0, -4096);
    assert.ok(Math.abs(near[2] + 1) < 1e-5 && Math.abs(far[2] - 1) < 1e-5,
      `glFrustum maps its near/far planes to -1 and +1, got ${near[2]} ${far[2]}`);
  }

  // ---- pointer arguments --------------------------------------------------
  call('glMatrixMode', s => s.i32(MODELVIEW));
  call('glLoadIdentity', s => s);
  floats.set([2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1]);
  call('glLoadMatrixf', s => s.i32(argsGuest));
  assert.deepStrictEqual(transform(top(), 1, 1, 1), [2, 2, 2],
    'glLoadMatrixf follows its guest pointer');
  // glMultMatrixf (op 109, appended after the observer's old upper bound):
  // multiplies onto the top, scale(2) * translate(1,2,3).
  floats.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1]);
  call('glMultMatrixf', s => s.i32(argsGuest));
  assert.deepStrictEqual(transform(top(), 1, 1, 1), [4, 6, 8],
    'glMultMatrixf multiplies its guest matrix onto the top');
  floats.set([2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1]);
  call('glLoadMatrixf', s => s.i32(argsGuest));
  assert.strictEqual(e.gl_mtx_untrusted(), 0, 'and the mirror stays trusted');

  // glLightfv(GL_POSITION) is transformed by the modelview at the time of the
  // call, so this also proves the observer did not reorder the two.
  call('glLoadIdentity', s => s);
  call('glTranslatef', s => s.f32(5).f32(0).f32(0));
  floats.set([1, 2, 3, 1]);
  call('glLightfv', s => s.i32(LIGHT0).i32(POSITION).i32(argsGuest));
  assert.deepStrictEqual(vec4(e.gl_mtx_light_ptr(0, 0) >>> 0), [6, 2, 3, 1],
    'glLightfv(GL_POSITION) is transformed by the current modelview');

  floats.set([0.25, 0.5, 0.75, 1]);
  call('glLightfv', s => s.i32(LIGHT0 + 2).i32(DIFFUSE).i32(argsGuest));
  assert.deepStrictEqual(vec4(e.gl_mtx_light_ptr(2, 2) >>> 0),
    f32v(0.25, 0.5, 0.75, 1), 'glLightfv reaches the light it names');

  // glMaterialfv's pname is argument 1, not argument 0 -- argument 0 is the
  // face. An observer that read argument 0 would see GL_FRONT_AND_BACK and
  // write nothing at all, which is silent.
  floats.set([0.1, 0.2, 0.3, 1]);
  call('glMaterialfv', s => s.i32(0x0408).i32(AMBIENT_AND_DIFFUSE).i32(argsGuest));
  assert.deepStrictEqual(vec4(e.gl_mtx_material_ptr(0) >>> 0), f32v(0.1, 0.2, 0.3, 1),
    'glMaterialfv takes its pname from argument 1, after the face');
  assert.deepStrictEqual(vec4(e.gl_mtx_material_ptr(1) >>> 0), f32v(0.1, 0.2, 0.3, 1),
    'and GL_AMBIENT_AND_DIFFUSE wrote both');

  floats.set([0.5, 0.5, 0.5, 1]);
  call('glLightModelfv', s => s.i32(0x0B53).i32(argsGuest));
  assert.deepStrictEqual(vec4(e.gl_mtx_light_model_ambient_ptr() >>> 0),
    f32v(0.5, 0.5, 0.5, 1), 'glLightModelfv(GL_LIGHT_MODEL_AMBIENT)');

  // ---- scalar setters -----------------------------------------------------
  call('glMaterialf', s => s.i32(0x0408).i32(SHININESS).f32(32));
  assert.strictEqual(e.gl_mtx_shininess(), 32, 'glMaterialf(GL_SHININESS)');

  call('glFogf', s => s.i32(FOG_START).f32(16));
  assert.strictEqual(e.gl_mtx_fog_start(), 16, 'glFogf(GL_FOG_START)');

  // The fog mode is the one argument whose meaning depends on the spelling
  // used to set it: glFogf passes the enum as a float, glFogi as an int.
  // Reading either the wrong way gives a garbage mode, not a wrong-looking
  // one, which is why the WAT routes them separately.
  call('glFogf', s => s.i32(FOG_MODE).f32(FOG_LINEAR));
  assert.strictEqual(e.gl_mtx_fog_mode(), FOG_LINEAR,
    'glFogf(GL_FOG_MODE) carries the enum as a float');
  call('glFogi', s => s.i32(FOG_MODE).i32(FOG_EXP2));
  assert.strictEqual(e.gl_mtx_fog_mode(), FOG_EXP2,
    'glFogi(GL_FOG_MODE) carries it as an int');

  floats.set([0.2, 0.3, 0.4, 1]);
  call('glFogfv', s => s.i32(FOG_COLOR).i32(argsGuest));
  assert.deepStrictEqual(vec4(e.gl_mtx_fog_color_ptr() >>> 0),
    f32v(0.2, 0.3, 0.4, 1), 'glFogfv(GL_FOG_COLOR)');

  // ---- the families that used to latch UNTRUSTED ---------------------------
  // gluPerspective/gluLookAt/gluOrtho2D (0401f9b4) and glPushAttrib/
  // glPopAttrib (1a892cf0) are mirrored now, so they must NOT mark the block
  // untrusted -- a latch here would make every software-GL draw after them
  // refuse. What they compute is pinned by test-gl-glu-mirror.js and
  // test-gl-attrib-stack.js.
  assert.strictEqual(e.gl_mtx_untrusted(), 0,
    'nothing so far should have marked the block untrusted');
  call('gluPerspective', s => s.f64(90).f64(1.333).f64(1).f64(4096));
  call('gluLookAt', s => s.f64(0).f64(0).f64(5).f64(0).f64(0).f64(0).f64(0).f64(1).f64(0));
  call('gluOrtho2D', s => s.f64(0).f64(640).f64(0).f64(480));
  call('glPushAttrib', s => s.i32(0x1000));
  call('glPopAttrib', s => s);
  assert.strictEqual(e.gl_mtx_untrusted(), 0,
    'the mirrored GLU and attrib-stack calls leave the block trusted');

  // A call the observer has no business touching must leave everything alone,
  // including the untrusted latch -- a too-broad opcode range would show up
  // here as a spurious mark or a trampled matrix.
  const before = [...top()];
  call('glVertex3f', s => s.f32(1).f32(2).f32(3));
  call('glBindTexture', s => s.i32(0x0DE1).i32(7));
  call('glClear', s => s.i32(0x4000));
  call('glEnable', s => s.i32(0x0B71));
  assert.deepStrictEqual([...top()], before,
    'an unrelated GL call does not disturb the matrices');
  assert.strictEqual(e.gl_mtx_untrusted(), 0,
    'and does not mark the block untrusted');

  console.log('PASS  the GL encoder observer wires real call stacks into WAT state');
})().catch(error => { console.error(error); process.exit(1); });
