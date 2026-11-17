#!/usr/bin/env node
'use strict';

// The WAT fixed-function GL state (src/09a8f-gl-matrix.wat) -- matrix stacks,
// lights, material and fog -- against the JavaScript it is lifted from
// (lib/gl-compat.js:112-166, :378-393, :450-465, :640-676).
//
// WHY A MIRROR TEST. GL's transform state is the reason the OpenGL command
// stream is a log of calls rather than a backend-neutral descriptor: nothing
// on the WAT side knows what the matrices are, so nothing on that side can
// lower a draw (docs/gl-software-path-design.md). Moving that state into WAT
// is only safe if the two agree to the last bit, because for as long as both
// exist a disagreement shows up as geometry that is subtly wrong in one
// backend and right in the other -- the hardest kind of rendering bug to see.
// So this compares raw f32 bit patterns, not values, for every operation
// whose JS implementation is exported and can serve as a real oracle.
//
// THE ONE EXCEPTION, stated plainly. lib/gl-compat.js exports identity(),
// multiply(), frustum() and ortho(), so those four are checked against the
// actual shipping code. translation(), scale() and rotation() are module-local
// and cannot be imported; the references below are transcribed from them. A
// transcription cannot catch a misreading shared by both copies, so those
// three additionally get a semantic check -- transform a known vector and
// assert where it lands -- which does not depend on either transcription.
//
// The lighting, material and fog half has no exported oracle at all -- all of
// it lives on FixedFunctionGL, which needs a live WebGL program to construct.
// So it is checked against the DEFAULTS read off lib/gl-compat.js:378-393 and
// against behaviour: which field a pname reaches, that GL_AMBIENT_AND_DIFFUSE
// writes two, that the clamps clamp, that an out-of-range light index is
// ignored instead of writing past the array, and that glLightfv(GL_POSITION)
// is transformed by the modelview and not by the selected matrix.
//
// Rotation is compared with a tolerance rather than bitwise. JS normalizes the
// axis with Math.hypot, which is correctly rounded; wasm has no such
// instruction and 09a8f uses sqrt(x*x+y*y+z*z), so a rotation about a non-unit
// axis can differ in the last ulp. Rotations about the unit axes agree exactly
// and are checked that way.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const { identity, multiply, frustum, ortho } = require('./helpers/gl-matrix-reference');

const MODELVIEW = 0x1700, PROJECTION = 0x1701, TEXTURE = 0x1702;
const GL_STACK_OVERFLOW = 0x0503, GL_STACK_UNDERFLOW = 0x0504;

// Transcribed from lib/gl-compat.js:133-166. See the header for why these are
// copies and what backs them up.
function translation(x, y, z) {
  const out = identity(); out[12] = x; out[13] = y; out[14] = z; return out;
}
function scale(x, y, z) {
  const out = identity(); out[0] = x; out[5] = y; out[10] = z; return out;
}
function rotation(angle, x, y, z) {
  const length = Math.hypot(x, y, z) || 1;
  x /= length; y /= length; z /= length;
  const r = angle * Math.PI / 180;
  const c = Math.cos(r), s = Math.sin(r), t = 1 - c;
  return new Float32Array([
    x * x * t + c, y * x * t + z * s, z * x * t - y * s, 0,
    x * y * t - z * s, y * y * t + c, z * y * t + x * s, 0,
    x * z * t + y * s, y * z * t - x * s, z * z * t + c, 0,
    0, 0, 0, 1]);
}

// The JS side of the mirror: the same stack discipline as FixedFunctionGL,
// reduced to the matrix state. The class itself needs a live WebGL program to
// construct (lib/gl-compat.js:338), so it cannot be instantiated headless;
// _stack/_matrix/_replaceMatrix/_multMatrix are reproduced here exactly.
class JsStacks {
  constructor() {
    this.mode = MODELVIEW;
    this.activeTexture = 0;
    this.stacks = [[identity()], [identity()], [identity()], [identity()]];
  }
  sel() {
    if (this.mode === PROJECTION) return 1;
    if (this.mode === TEXTURE) return 2 + (this.activeTexture ? 1 : 0);
    return 0;
  }
  stack() { return this.stacks[this.sel()]; }
  top() { const s = this.stack(); return s[s.length - 1]; }
  replace(v) { const s = this.stack(); s[s.length - 1] = new Float32Array(v); }
  mult(v) { this.replace(multiply(this.top(), v)); }
}

// A scripted sequence, applied to both sides by the two appliers below. Kept
// as data so the two can never drift into running different programs.
const SCRIPT = [
  ['mode', PROJECTION],
  ['frustum', -1, 1, -0.75, 0.75, 0.1, 4096],
  ['mode', MODELVIEW],
  ['translate', 3.5, -12.25, 0.125],
  ['rotate', 90, 0, 1, 0],
  ['push'],
  ['scale', 2, 2, 2],
  ['translate', 1, 2, 3],
  ['rotate', -33.75, 0, 0, 1],
  ['pop'],
  ['translate', -1, -1, -1],
  ['mode', TEXTURE],
  ['scale', 0.5, 0.5, 1],
  ['texunit', 1],
  ['ortho', 0, 640, 480, 0, -1, 1],
  ['translate', 8, 8, 0],
  ['texunit', 0],
  ['translate', 100, 0, 0],
  ['mode', MODELVIEW],
  ['loadIdentity'],
  ['rotate', 17.5, 0.5773502691896258, 0.5773502691896258, 0.5773502691896258],
  ['translate', 1, 1, 1],
];

// Which script steps are allowed a tolerance rather than a bitwise match, and
// why: see the header. Only a rotation about a non-axis-aligned vector.
const inexact = step => step[0] === 'rotate'
  && [step[2], step[3], step[4]].filter(v => v !== 0).length > 1;

function applyJs(js, step) {
  const [op, ...a] = step;
  switch (op) {
    case 'mode': js.mode = a[0]; break;
    case 'texunit': js.activeTexture = a[0] ? 1 : 0; break;
    case 'loadIdentity': js.replace(identity()); break;
    case 'push': js.stack().push(new Float32Array(js.top())); break;
    case 'pop': { const s = js.stack(); if (s.length > 1) s.pop(); break; }
    case 'translate': js.mult(translation(a[0], a[1], a[2])); break;
    case 'scale': js.mult(scale(a[0], a[1], a[2])); break;
    case 'rotate': js.mult(rotation(a[0], a[1], a[2], a[3])); break;
    case 'frustum': js.mult(frustum(a[0], a[1], a[2], a[3], a[4], a[5])); break;
    case 'ortho': js.mult(ortho(a[0], a[1], a[2], a[3], a[4], a[5])); break;
    default: throw new Error(`unknown op ${op}`);
  }
}

function applyWat(e, step) {
  const [op, ...a] = step;
  switch (op) {
    case 'mode': e.gl_mtx_set_mode(a[0]); break;
    case 'texunit': e.gl_mtx_set_active_texture(a[0]); break;
    case 'loadIdentity': e.gl_mtx_load_identity(); break;
    case 'push': e.gl_mtx_push(); break;
    case 'pop': e.gl_mtx_pop(); break;
    case 'translate': e.gl_mtx_translate(a[0], a[1], a[2]); break;
    case 'scale': e.gl_mtx_scale(a[0], a[1], a[2]); break;
    case 'rotate': e.gl_mtx_rotate(a[0], a[1], a[2], a[3]); break;
    case 'frustum': e.gl_mtx_frustum(a[0], a[1], a[2], a[3], a[4], a[5]); break;
    case 'ortho': e.gl_mtx_ortho(a[0], a[1], a[2], a[3], a[4], a[5]); break;
    default: throw new Error(`unknown op ${op}`);
  }
}

// Column-major matrix times a column vector, for the semantic checks.
function transform(m, x, y, z) {
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  return [
    (m[0] * x + m[4] * y + m[8] * z + m[12]) / (w || 1),
    (m[1] * x + m[5] * y + m[9] * z + m[13]) / (w || 1),
    (m[2] * x + m[6] * y + m[10] * z + m[14]) / (w || 1),
  ];
}

(async () => {
  const { exports: e, memory } = await bootRenderHarness();
  const read = ptr => new Float32Array(memory.buffer.slice(ptr, ptr + 64));
  const top = () => read(e.gl_mtx_top_ptr() >>> 0);
  const stackAt = (s, i) => read(e.gl_mtx_stack_ptr(s, i) >>> 0);

  const bits = m => {
    const u = new Uint32Array(m.buffer.slice(0));
    return [...u].map(v => v.toString(16).padStart(8, '0')).join(' ');
  };
  const compare = (label, watM, jsM, tolerance) => {
    if (!tolerance) {
      assert.strictEqual(bits(watM), bits(jsM),
        `${label}: WAT and JS matrices differ bit for bit\n`
        + `  wat ${[...watM].join(', ')}\n  js  ${[...jsM].join(', ')}`);
      return;
    }
    for (let i = 0; i < 16; i++) {
      assert.ok(Math.abs(watM[i] - jsM[i]) <= tolerance,
        `${label}: element ${i} differs by more than ${tolerance}:`
        + ` wat ${watM[i]} vs js ${jsM[i]}`);
    }
  };

  // Every stack starts one deep holding identity, as GL requires.
  for (let s = 0; s < 4; s++) {
    assert.strictEqual(e.gl_mtx_depth(s), 0, `stack ${s} starts one entry deep`);
  }
  assert.strictEqual(e.gl_mtx_selected(), 0, 'GL_MODELVIEW is the initial mode');
  compare('initial modelview', top(), identity());

  // The script, checked after EVERY step rather than only at the end, so a
  // disagreement names the operation that introduced it instead of the one
  // that happened to be last.
  const js = new JsStacks();
  let tolerated = 0;
  for (const [n, step] of SCRIPT.entries()) {
    applyJs(js, step);
    applyWat(e, step);
    const label = `step ${n} (${step.join(' ')})`;
    assert.strictEqual(e.gl_mtx_selected(), js.sel(), `${label}: selected stack`);
    assert.strictEqual(e.gl_mtx_depth(js.sel()), js.stack().length - 1,
      `${label}: stack depth`);
    // A tolerated step poisons every later comparison on that stack, so from
    // the first one on, that stack is compared loosely too.
    if (inexact(step)) tolerated++;
    compare(label, top(), js.top(), tolerated ? 1e-6 : 0);
  }
  assert.strictEqual(tolerated, 1,
    'exactly one script step should need a tolerance; if this changed, the'
    + ' comment about Math.hypot needs revisiting');

  // Every stack, not just the selected one, matches -- a stack the script left
  // alone must have been left alone.
  for (let s = 0; s < 4; s++) {
    for (let i = 0; i < js.stacks[s].length; i++) {
      compare(`stack ${s} entry ${i}`, stackAt(s, i), js.stacks[s][i], 1e-6);
    }
  }

  // Semantic checks, which depend on neither transcription.
  e.gl_mtx_set_mode(MODELVIEW);
  e.gl_mtx_load_identity();
  e.gl_mtx_translate(10, 20, 30);
  assert.deepStrictEqual(transform(top(), 1, 2, 3), [11, 22, 33],
    'translate moves a point by the offset');
  e.gl_mtx_load_identity();
  e.gl_mtx_scale(2, 3, 4);
  assert.deepStrictEqual(transform(top(), 1, 1, 1), [2, 3, 4],
    'scale multiplies each axis');
  // GL composes right-to-left: the translate is applied to the point first,
  // then the rotation, which is what makes the order observable.
  e.gl_mtx_load_identity();
  e.gl_mtx_rotate(90, 0, 0, 1);
  e.gl_mtx_translate(1, 0, 0);
  {
    const p = transform(top(), 0, 0, 0);
    assert.ok(Math.abs(p[0]) < 1e-6 && Math.abs(p[1] - 1) < 1e-6
      && Math.abs(p[2]) < 1e-6,
      `90 degrees about +Z takes (1,0,0) to (0,1,0), got ${p.join(', ')}`);
  }
  // Rotations about a unit axis need no tolerance in the comparison itself.
  e.gl_mtx_load_identity();
  e.gl_mtx_rotate(37.5, 1, 0, 0);
  compare('unit-axis rotation is exact', top(),
    multiply(identity(), rotation(37.5, 1, 0, 0)));

  // Ortho maps its box corners onto the NDC cube, which is the whole point of
  // it and is independent of how the matrix is spelled.
  e.gl_mtx_load_identity();
  e.gl_mtx_ortho(0, 640, 480, 0, -1, 1);
  {
    const tl = transform(top(), 0, 0, 0);
    const br = transform(top(), 640, 480, 0);
    assert.ok(Math.abs(tl[0] + 1) < 1e-6 && Math.abs(tl[1] - 1) < 1e-6,
      `ortho maps (0,0) to the top-left of NDC, got ${tl.join(', ')}`);
    assert.ok(Math.abs(br[0] - 1) < 1e-6 && Math.abs(br[1] + 1) < 1e-6,
      `ortho maps (640,480) to the bottom-right of NDC, got ${br.join(', ')}`);
    // Depth as well as x and y. Without this the z row is only ever checked
    // against the transcribed reference, and a wrong scale there survives:
    // an injected -2 -> -2.0000001 in the WAT was invisible, because this
    // box's near/far make that difference vanish when the result is rounded
    // to f32. GL maps near to -1 and far to +1, and a z row that is wrong by
    // any visible amount fails here whatever the reference says.
    // glOrtho's near and far are DISTANCES along -z, so the near plane is the
    // eye-space point z = -near, not z = +near. With this call's near = -1 the
    // near plane is therefore at z = +1. Writing the two literally the first
    // time asserted the exact opposite of GL and failed against correct WAT.
    const nearZ = transform(top(), 0, 0, -(-1))[2];
    const farZ = transform(top(), 0, 0, -(1))[2];
    assert.ok(Math.abs(nearZ + 1) < 1e-6,
      `ortho maps the near plane to -1, got ${nearZ}`);
    assert.ok(Math.abs(farZ - 1) < 1e-6,
      `ortho maps the far plane to +1, got ${farZ}`);
  }

  // The same for frustum: a point on the near plane lands on -1, one on the
  // far plane on +1, after the perspective divide.
  e.gl_mtx_load_identity();
  e.gl_mtx_frustum(-1, 1, -0.75, 0.75, 0.1, 4096);
  {
    const near = transform(top(), 0, 0, -0.1);
    const far = transform(top(), 0, 0, -4096);
    assert.ok(Math.abs(near[2] + 1) < 1e-5,
      `frustum maps the near plane to -1, got ${near[2]}`);
    assert.ok(Math.abs(far[2] - 1) < 1e-5,
      `frustum maps the far plane to +1, got ${far[2]}`);
  }

  // load/mult through the staging slot, the entry points the encoder will use.
  {
    const staging = e.gl_mtx_staging_ptr() >>> 0;
    const view = new Float32Array(memory.buffer, staging, 16);
    const m = scale(5, 6, 7);
    view.set(m);
    e.gl_mtx_load_identity();
    e.gl_mtx_load_src();
    compare('load_src installs the staged matrix', top(), m);
    view.set(translation(1, 1, 1));
    e.gl_mtx_mult_src();
    compare('mult_src post-multiplies the staged matrix', top(),
      multiply(m, translation(1, 1, 1)));
  }

  // Stack limits. GL raises rather than growing, and refuses to empty a stack.
  e.gl_mtx_clear_error();
  assert.strictEqual(e.gl_mtx_error(), 0, 'no error latched so far');
  e.gl_mtx_set_mode(PROJECTION);
  while (e.gl_mtx_depth(1) > 0) e.gl_mtx_pop();
  e.gl_mtx_pop();
  assert.strictEqual(e.gl_mtx_error(), GL_STACK_UNDERFLOW,
    'popping a one-deep stack raises GL_STACK_UNDERFLOW');
  assert.strictEqual(e.gl_mtx_depth(1), 0, 'and leaves the stack one deep');
  e.gl_mtx_clear_error();
  e.gl_mtx_load_identity();
  e.gl_mtx_translate(1, 2, 3);
  const marker = top();
  for (let i = 0; i < 31; i++) e.gl_mtx_push();
  assert.strictEqual(e.gl_mtx_depth(1), 31, 'the stack holds 32 entries');
  assert.strictEqual(e.gl_mtx_error(), 0, 'filling the stack is not an error');
  e.gl_mtx_push();
  assert.strictEqual(e.gl_mtx_error(), GL_STACK_OVERFLOW,
    'pushing past 32 entries raises GL_STACK_OVERFLOW');
  assert.strictEqual(e.gl_mtx_depth(1), 31, 'and does not grow the stack');
  compare('an overflowing push leaves the top untouched', top(), marker);

  // The two texture stacks are independent, which is the whole reason
  // glActiveTextureARB selects between them.
  e.gl_mtx_clear_error();
  e.gl_mtx_set_mode(TEXTURE);
  e.gl_mtx_set_active_texture(0);
  e.gl_mtx_load_identity();
  e.gl_mtx_scale(9, 9, 9);
  e.gl_mtx_set_active_texture(1);
  e.gl_mtx_load_identity();
  compare('unit 1 is identity after unit 0 was scaled', top(), identity());
  e.gl_mtx_set_active_texture(0);
  compare('unit 0 kept its own matrix', top(), scale(9, 9, 9));

  // An unrecognized mode is ignored rather than selecting a fifth stack.
  const before = e.gl_mtx_selected();
  e.gl_mtx_set_mode(0x1234);
  assert.strictEqual(e.gl_mtx_selected(), before,
    'an unknown glMatrixMode argument leaves the mode alone');

  // ---- lighting, material and fog ----------------------------------------
  //
  // These are pure state, so the interesting content is the DEFAULTS and the
  // one operation with arithmetic in it. A zeroed block is not a legal GL
  // state: an app that enables lighting without setting anything must still
  // get a white light 0 and the material's 0.8 grey diffuse, or everything it
  // draws comes out black. The values below are read off lib/gl-compat.js:378.
  const LIGHT0 = 0x4000;
  const POSITION = 0x1203, AMBIENT = 0x1200, DIFFUSE = 0x1201, SPECULAR = 0x1202;
  const EMISSION = 0x1600, SHININESS = 0x1601, AMBIENT_AND_DIFFUSE = 0x1602;
  const FOG_DENSITY = 0x0B62, FOG_START = 0x0B63, FOG_END = 0x0B64;
  const FOG_COLOR = 0x0B66, FOG_EXP = 0x0800, FOG_LINEAR = 0x2601;
  // Field order inside a light and inside the material, as 09a8f lays them out.
  const F_POSITION = 0, F_AMBIENT = 1, F_DIFFUSE = 2, F_SPECULAR = 3;
  const M_AMBIENT = 0, M_DIFFUSE = 1, M_SPECULAR = 2, M_EMISSION = 3;

  // Expected vectors go through Math.fround, because the block stores f32 and
  // most of GL's defaults (0.2, 0.8) have no exact f32 form -- comparing them
  // against the JS literal fails on correct data.
  const f32v = (...values) => values.map(Math.fround);
  const vec4 = ptr => [...new Float32Array(memory.buffer.slice(ptr, ptr + 16))];
  const light = (i, f) => vec4(e.gl_mtx_light_ptr(i, f) >>> 0);
  const material = f => vec4(e.gl_mtx_material_ptr(f) >>> 0);
  // Every setter takes a pointer to four f32; the staging slot is the scratch
  // a caller fills first, and is not otherwise live between calls.
  const stage = (...values) => {
    const ptr = e.gl_mtx_staging_ptr() >>> 0;
    new Float32Array(memory.buffer, ptr, 4).set(
      Float32Array.from(values.concat([0, 0, 0, 0]).slice(0, 4)));
    return ptr;
  };

  assert.deepStrictEqual(vec4(e.gl_mtx_light_model_ambient_ptr() >>> 0),
    f32v(0.2, 0.2, 0.2, 1), 'the default light model ambient is a dim grey');
  assert.deepStrictEqual(light(0, F_DIFFUSE), [1, 1, 1, 1],
    'light 0 is white by default');
  assert.deepStrictEqual(light(0, F_SPECULAR), [1, 1, 1, 1],
    'light 0 is specular-white by default');
  for (let i = 1; i < 8; i++) {
    assert.deepStrictEqual(light(i, F_DIFFUSE), [0, 0, 0, 1],
      `light ${i} contributes nothing until the app gives it a colour`);
    assert.deepStrictEqual(light(i, F_SPECULAR), [0, 0, 0, 1],
      `light ${i} has no default specular`);
  }
  for (let i = 0; i < 8; i++) {
    assert.deepStrictEqual(light(i, F_POSITION), [0, 0, 1, 0],
      `light ${i} defaults to the directional light down -z`);
    assert.deepStrictEqual(light(i, F_AMBIENT), [0, 0, 0, 1],
      `light ${i} has no default ambient`);
  }
  assert.deepStrictEqual(material(M_AMBIENT), f32v(0.2, 0.2, 0.2, 1),
    'default material ambient');
  assert.deepStrictEqual(material(M_DIFFUSE), f32v(0.8, 0.8, 0.8, 1),
    'default material diffuse');
  assert.deepStrictEqual(material(M_SPECULAR), [0, 0, 0, 1],
    'default material specular');
  assert.deepStrictEqual(material(M_EMISSION), [0, 0, 0, 1],
    'default material emission');
  assert.strictEqual(e.gl_mtx_shininess(), 0, 'default shininess');
  assert.strictEqual(e.gl_mtx_fog_mode(), FOG_EXP, 'fog defaults to GL_EXP');
  assert.strictEqual(e.gl_mtx_fog_density(), 1, 'default fog density');
  assert.strictEqual(e.gl_mtx_fog_start(), 0, 'default fog start');
  assert.strictEqual(e.gl_mtx_fog_end(), 1, 'default fog end');
  assert.deepStrictEqual(vec4(e.gl_mtx_fog_color_ptr() >>> 0), [0, 0, 0, 0],
    'default fog colour is transparent black');

  // The one operation with arithmetic in it: glLightfv(GL_POSITION) is
  // transformed by the MODELVIEW matrix at the time of the call -- and by the
  // modelview specifically, NOT by whichever stack glMatrixMode has selected.
  // A mirror that used the selected stack would place every light wrongly in
  // an app that sets a light while a texture matrix is current, which is why
  // this is checked with a texture matrix deliberately selected and scaled.
  e.gl_mtx_set_mode(MODELVIEW);
  e.gl_mtx_load_identity();
  e.gl_mtx_translate(5, 0, 0);
  e.gl_mtx_set_mode(TEXTURE);
  e.gl_mtx_set_active_texture(0);
  e.gl_mtx_load_identity();
  e.gl_mtx_scale(100, 100, 100);
  e.gl_mtx_set_light(LIGHT0, POSITION, stage(1, 2, 3, 1));
  assert.deepStrictEqual(light(0, F_POSITION), [6, 2, 3, 1],
    'a positional light is transformed by the MODELVIEW, not by the selected'
    + ' matrix -- [6,2,3,1] is the translate applied; [100,200,300,1] would be'
    + ' the texture matrix having been used by mistake');
  // A directional light has w = 0, so the translation must not reach it.
  e.gl_mtx_set_light(LIGHT0, POSITION, stage(0, 1, 0, 0));
  assert.deepStrictEqual(light(0, F_POSITION), [0, 1, 0, 0],
    'a directional light (w=0) is unaffected by the translation');

  e.gl_mtx_set_mode(MODELVIEW);
  e.gl_mtx_set_light(LIGHT0 + 3, DIFFUSE, stage(0.25, 0.5, 0.75, 1));
  assert.deepStrictEqual(light(3, F_DIFFUSE), f32v(0.25, 0.5, 0.75, 1),
    'glLightfv reaches the light it names');
  assert.deepStrictEqual(light(2, F_DIFFUSE), [0, 0, 0, 1],
    'and only that one');
  e.gl_mtx_set_light(LIGHT0 + 5, AMBIENT, stage(1, 0, 0, 1));
  assert.deepStrictEqual(light(5, F_AMBIENT), [1, 0, 0, 1], 'GL_AMBIENT');
  e.gl_mtx_set_light(LIGHT0 + 5, SPECULAR, stage(0, 1, 0, 1));
  assert.deepStrictEqual(light(5, F_SPECULAR), [0, 1, 0, 1], 'GL_SPECULAR');
  // Out of range is ignored rather than corrupting the block behind it.
  const before8 = light(7, F_DIFFUSE);
  e.gl_mtx_set_light(LIGHT0 + 8, DIFFUSE, stage(9, 9, 9, 9));
  e.gl_mtx_set_light(LIGHT0 - 1, DIFFUSE, stage(9, 9, 9, 9));
  assert.deepStrictEqual(light(7, F_DIFFUSE), before8,
    'a light index past GL_LIGHT7 is ignored, not written past the array');
  assert.strictEqual(e.gl_mtx_shininess(), 0,
    'and does not scribble into the material that follows the lights');

  e.gl_mtx_set_light_model_ambient(stage(0.5, 0.5, 0.5, 1));
  assert.deepStrictEqual(vec4(e.gl_mtx_light_model_ambient_ptr() >>> 0),
    f32v(0.5, 0.5, 0.5, 1), 'glLightModelfv(GL_LIGHT_MODEL_AMBIENT)');

  // GL_AMBIENT_AND_DIFFUSE writes BOTH, which is the one material case that
  // is not a straight assignment.
  e.gl_mtx_set_material(AMBIENT_AND_DIFFUSE, stage(0.1, 0.2, 0.3, 1));
  assert.deepStrictEqual(material(M_AMBIENT),
    f32v(0.1, 0.2, 0.3, 1),
    'GL_AMBIENT_AND_DIFFUSE writes the ambient');
  assert.deepStrictEqual(material(M_DIFFUSE),
    f32v(0.1, 0.2, 0.3, 1),
    'GL_AMBIENT_AND_DIFFUSE writes the diffuse too');
  e.gl_mtx_set_material(SPECULAR, stage(1, 1, 1, 1));
  assert.deepStrictEqual(material(M_SPECULAR), [1, 1, 1, 1], 'GL_SPECULAR');
  e.gl_mtx_set_material(EMISSION, stage(0, 0, 1, 1));
  assert.deepStrictEqual(material(M_EMISSION), [0, 0, 1, 1], 'GL_EMISSION');
  e.gl_mtx_set_material(AMBIENT, stage(1, 0, 0, 1));
  assert.deepStrictEqual(material(M_AMBIENT), [1, 0, 0, 1],
    'GL_AMBIENT alone writes only the ambient');
  assert.deepStrictEqual(material(M_DIFFUSE),
    f32v(0.1, 0.2, 0.3, 1),
    'and leaves the diffuse where GL_AMBIENT_AND_DIFFUSE put it');

  // Shininess is clamped to [0, 128], as lib/gl-compat.js:660 does.
  e.gl_mtx_set_material(SHININESS, stage(64));
  assert.strictEqual(e.gl_mtx_shininess(), 64, 'shininess in range');
  e.gl_mtx_set_material(SHININESS, stage(500));
  assert.strictEqual(e.gl_mtx_shininess(), 128, 'shininess clamps at 128');
  e.gl_mtx_set_material(SHININESS, stage(-5));
  assert.strictEqual(e.gl_mtx_shininess(), 0, 'shininess clamps at 0');

  e.gl_mtx_set_fog_mode(FOG_LINEAR);
  assert.strictEqual(e.gl_mtx_fog_mode(), FOG_LINEAR, 'glFog*(GL_FOG_MODE)');
  e.gl_mtx_set_fog(FOG_START, stage(16));
  e.gl_mtx_set_fog(FOG_END, stage(4096));
  assert.strictEqual(e.gl_mtx_fog_start(), 16, 'fog start');
  assert.strictEqual(e.gl_mtx_fog_end(), 4096, 'fog end');
  e.gl_mtx_set_fog(FOG_DENSITY, stage(0.75));
  assert.strictEqual(e.gl_mtx_fog_density(), Math.fround(0.75), 'fog density');
  // Density is clamped at 0 the same way, and start/end are NOT -- a negative
  // fog start is legal and means the fog begins behind the eye.
  e.gl_mtx_set_fog(FOG_DENSITY, stage(-1));
  assert.strictEqual(e.gl_mtx_fog_density(), 0, 'fog density clamps at 0');
  e.gl_mtx_set_fog(FOG_START, stage(-10));
  assert.strictEqual(e.gl_mtx_fog_start(), -10,
    'a negative fog start is left alone');
  e.gl_mtx_set_fog(FOG_COLOR, stage(0.2, 0.3, 0.4, 1));
  assert.deepStrictEqual(vec4(e.gl_mtx_fog_color_ptr() >>> 0),
    f32v(0.2, 0.3, 0.4, 1), 'fog colour');

  // None of the lighting work may have disturbed the matrices, which share the
  // block with it -- an offset typo in either direction lands in the other.
  e.gl_mtx_set_mode(MODELVIEW);
  e.gl_mtx_load_identity();
  e.gl_mtx_translate(7, 8, 9);
  assert.deepStrictEqual(transform(top(), 0, 0, 0), [7, 8, 9],
    'the matrix stacks still work after the lighting block was written');

  console.log('PASS  WAT GL matrix, lighting, material and fog state'
    + ' mirrors lib/gl-compat.js');
})().catch(error => { console.error(error); process.exit(1); });
