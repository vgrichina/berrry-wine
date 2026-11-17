#!/usr/bin/env node
'use strict';

// $gl_dlt1_lighting (src/09a8f-gl-matrix.wat) -- the second descriptor the WAT
// mirror produces, after $gl_dfx1_transform. See
// docs/gl-software-path-design.md, "Shape of the work" step 2.
//
// WHAT THIS TEST IS FOR. DLT1 is a lossy target for GL lighting, and every one
// of the losses renders something. A build that quietly drops a light, or lights
// it from the opposite side, produces a scene that looks lit -- so the failures
// below cannot be caught downstream and are asserted here instead:
//
//   - THE DIRECTION SIGN. GL's GL_POSITION with w == 0 points TOWARD the
//     light; D3D's direction points away from it, and the lowering negates
//     what it reads (src/09aj-d3d-fixed.wat:684). Get this wrong and the scene
//     is lit from behind: still lit, still plausible, wrong.
//   - THE EYE-SPACE CONTRACT. GL bakes the modelview into the light position
//     at glLightfv time, so the row is in eye space, and it only survives the
//     lowering's view multiply because $gl_dfx1_transform leaves the view
//     matrix identity. The two functions must agree; this test asserts the
//     mirror applied the modelview, and test-gl-dfx1-transform.js asserts the
//     other half.
//   - SILENT DROPS. A positional light and a live specular term have no
//     representation in DLT1. Refusing is the contract, and a refusal must
//     leave the caller's buffer untouched rather than half-built -- asserted
//     byte for byte, not merely by the return value.
//   - THE SPECULAR PREDICATE'S PRECISION. Refusing on any nonzero light
//     specular would refuse nearly every app, because GL's default light 0
//     specular is white. What is refused is a specular that can reach the
//     picture, which needs a nonzero MATERIAL specular too. Both halves are
//     checked, or the predicate could collapse to either constant and pass.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const { CALL_INDEX } = require('../lib/gl-command-stream');

const MODELVIEW = 0x1700;
const GL_LIGHT0 = 0x4000;
const GL_AMBIENT = 0x1200, GL_DIFFUSE = 0x1201, GL_SPECULAR = 0x1202,
  GL_POSITION = 0x1203;
const DLT1_MAGIC = 0x444c5431;

// DLT1 ABI1, from the layout comment at src/09aj-d3d-fixed.wat:582-586.
const HDR = {
  magic: 0, version: 4, count: 8, normalReg: 12,
  diffuseReg: 16, specularReg: 20, normalize: 24, colorVertex: 28,
  diffuseSource: 32, ambientSource: 36, emissiveSource: 40, reserved44: 44,
  ambientARGB: 48,
  materialDiffuse: 64, materialAmbient: 80, materialEmissive: 96,
};
const ROW = { type: 0, diffuse: 4, ambient: 20, direction: 36 };
const HEADER_BYTES = 128, ROW_BYTES = 64, BUFFER_BYTES = HEADER_BYTES + 8 * ROW_BYTES;

const bits = values => [...new Uint32Array(Float32Array.from(values).buffer)]
  .map(v => v.toString(16).padStart(8, '0')).join(' ');

async function main() {
  const { exports: e, memory } = await bootRenderHarness();
  const u8 = () => new Uint8Array(memory.buffer);
  const i32At = p => new Int32Array(memory.buffer.slice(p, p + 4))[0];
  const f32s = (p, n) => new Float32Array(memory.buffer.slice(p, p + n * 4));

  const toHost = guest => (e.get_guest_base() >>> 0) + (guest >>> 0)
    - (e.get_image_base() >>> 0);

  // Guard bytes either side, so a write past the declared size is caught
  // rather than landing silently in the heap.
  const dst = toHost(e.guest_alloc(BUFFER_BYTES + 2)) + 1;
  u8()[dst - 1] = 0xAB;
  u8()[dst + BUFFER_BYTES] = 0xCD;

  // A scratch vector for the glLightfv/glMaterialfv setters, which take a
  // pointer to four f32 exactly as the GL entry points do.
  const vec = toHost(e.guest_alloc(16));
  const setVec = (x, y, z, w) => {
    new Float32Array(memory.buffer, vec, 4).set([x, y, z, w]);
    return vec;
  };
  const light = (n, pname, x, y, z, w) =>
    e.gl_mtx_set_light(GL_LIGHT0 + n, pname, setVec(x, y, z, w));
  const material = (pname, x, y, z, w) =>
    e.gl_mtx_set_material(pname, setVec(x, y, z, w));

  const snapshot = () => Buffer.from(memory.buffer.slice(dst, dst + BUFFER_BYTES));
  const refuses = (mask, why) => {
    const before = snapshot();
    assert.strictEqual(e.gl_dlt1_lighting(dst, mask), 0, why);
    assert.deepStrictEqual(snapshot(), before,
      `a refused build (${why}) must write nothing at all`);
  };

  // --- the default GL state, light 0 only --------------------------------
  //
  // This is the case a strict specular test would wrongly refuse: GL's default
  // light 0 specular is white, and its default material specular is black, so
  // the term is provably zero and the build must succeed.
  assert.strictEqual(e.gl_mtx_untrusted(), 0, 'mirror is trusted to begin with');
  assert.strictEqual(e.gl_dlt1_lighting(dst, 0b1), HEADER_BYTES + ROW_BYTES,
    'one light: 128 header + 64 row');

  assert.strictEqual(i32At(dst + HDR.magic), DLT1_MAGIC, "magic is 'DLT1'");
  assert.strictEqual(i32At(dst + HDR.version), 1, 'ABI 1');
  assert.strictEqual(i32At(dst + HDR.count), 1, 'one light');
  assert.strictEqual(i32At(dst + HDR.normalReg), 0,
    'normalReg is a placeholder the caller completes');
  assert.strictEqual(i32At(dst + HDR.diffuseReg), 16, 'no vertex diffuse (16 = absent)');
  assert.strictEqual(i32At(dst + HDR.specularReg), 16, 'no vertex specular');
  assert.strictEqual(i32At(dst + HDR.normalize), 0, 'normalize off');
  assert.strictEqual(i32At(dst + HDR.colorVertex), 0, 'COLORVERTEX off');
  for (const k of ['diffuseSource', 'ambientSource', 'emissiveSource']) {
    assert.strictEqual(i32At(dst + HDR[k]), 0, `${k} is the material`);
  }
  assert.strictEqual(i32At(dst + HDR.reserved44), 0, 'reserved word stays zero');

  // GL's default light model ambient is 0.2 grey, which survives DLT1's 8-bit
  // ARGB field exactly: 0.2 * 255 = 51 = 0x33.
  assert.strictEqual(i32At(dst + HDR.ambientARGB) >>> 0, 0xff333333,
    'global ambient packed as ARGB');

  assert.strictEqual(bits(f32s(dst + HDR.materialDiffuse, 4)), bits([0.8, 0.8, 0.8, 1]),
    "material diffuse is GL's default 0.8 grey");
  assert.strictEqual(bits(f32s(dst + HDR.materialAmbient, 4)), bits([0.2, 0.2, 0.2, 1]),
    'material ambient');
  assert.strictEqual(bits(f32s(dst + HDR.materialEmissive, 4)), bits([0, 0, 0, 1]),
    'material emissive');

  const row0 = dst + HEADER_BYTES;
  assert.strictEqual(i32At(row0 + ROW.type), 3,
    'type 3 -- the only one $d3d_fixed_bind_lighting accepts');
  assert.strictEqual(bits(f32s(row0 + ROW.diffuse, 4)), bits([1, 1, 1, 1]),
    'light 0 diffuse is white by default');
  assert.strictEqual(bits(f32s(row0 + ROW.ambient, 4)), bits([0, 0, 0, 1]),
    'light ambient is black by default');
  // GL's default position is (0, 0, 1, 0) -- pointing toward the light -- so
  // the row, which points away from it, is its negation.
  assert.strictEqual(bits(f32s(row0 + ROW.direction, 3)), bits([-0, -0, -1]),
    'direction is the NEGATED GL position');

  // Every reserved word in the row must be zero or the lowering rejects the
  // whole block (09aj:649-651).
  assert.strictEqual(bits(f32s(row0 + 48, 4)), bits([0, 0, 0, 0]), 'row reserved 48..63');

  assert.strictEqual(u8()[dst - 1], 0xAB, 'no write before the buffer');
  assert.strictEqual(u8()[dst + BUFFER_BYTES], 0xCD, 'no write past the last row');

  // --- the modelview is applied, and only to the position ----------------
  //
  // A rotation, not a translation: GL_POSITION with w == 0 is a direction and
  // a translation leaves it alone, so a translate-only test would pass even if
  // the mirror ignored the modelview entirely.
  e.gl_mtx_set_mode(MODELVIEW);
  e.gl_mtx_load_identity();
  e.gl_mtx_rotate(90, 0, 1, 0); // +Z -> +X
  light(0, GL_POSITION, 0, 0, 1, 0);
  // gl_mtx_light_ptr(index, field) hands back a linear address already.
  const rotated = f32s(e.gl_mtx_light_ptr(0, 0) >>> 0, 4);
  assert.ok(Math.abs(rotated[0] - 1) < 1e-6 && Math.abs(rotated[2]) < 1e-6,
    `glLightfv(GL_POSITION) must be transformed by the modelview, got ${rotated}`);
  assert.strictEqual(e.gl_dlt1_lighting(dst, 0b1), HEADER_BYTES + ROW_BYTES,
    'still builds after moving the light');
  assert.strictEqual(bits(f32s(row0 + ROW.direction, 3)),
    bits([-rotated[0], -rotated[1], -rotated[2]]),
    'the row carries the negated EYE-SPACE position');
  e.gl_mtx_load_identity();
  light(0, GL_POSITION, 0, 0, 1, 0);

  // --- several lights, packed in index order ------------------------------
  light(1, GL_DIFFUSE, 0.25, 0.5, 0.75, 1);
  light(1, GL_AMBIENT, 0.125, 0, 0, 1);
  light(1, GL_POSITION, 1, 0, 0, 0);
  light(2, GL_DIFFUSE, 0, 1, 0, 1);
  light(2, GL_POSITION, 0, -1, 0, 0);

  assert.strictEqual(e.gl_dlt1_lighting(dst, 0b110), HEADER_BYTES + 2 * ROW_BYTES,
    'two lights: 128 + 2 * 64');
  assert.strictEqual(i32At(dst + HDR.count), 2, 'count is the enabled lights, not 8');
  const row1 = dst + HEADER_BYTES, row2 = row1 + ROW_BYTES;
  assert.strictEqual(bits(f32s(row1 + ROW.diffuse, 4)), bits([0.25, 0.5, 0.75, 1]),
    'light 1 lands in the FIRST row -- rows are packed, not indexed by GL number');
  assert.strictEqual(bits(f32s(row1 + ROW.ambient, 4)), bits([0.125, 0, 0, 1]),
    'light 1 ambient');
  assert.strictEqual(bits(f32s(row1 + ROW.direction, 3)), bits([-1, -0, -0]),
    'light 1 direction');
  assert.strictEqual(bits(f32s(row2 + ROW.diffuse, 4)), bits([0, 1, 0, 1]),
    'light 2 in the second row');
  assert.strictEqual(bits(f32s(row2 + ROW.direction, 3)), bits([-0, 1, -0]),
    'light 2 direction');
  assert.strictEqual(u8()[dst + BUFFER_BYTES], 0xCD, 'guard survives a two-row build');

  // An empty mask is a legal, lightless block, not a refusal: an app may have
  // lighting enabled with no light on.
  assert.strictEqual(e.gl_dlt1_lighting(dst, 0), HEADER_BYTES, 'no lights: header only');
  assert.strictEqual(i32At(dst + HDR.count), 0, 'count zero');

  // --- the refusals -------------------------------------------------------
  //
  // Specular needs BOTH halves live. With a white light specular and a black
  // material the build succeeds; the material alone flips it.
  assert.strictEqual(e.gl_dlt1_lighting(dst, 0b1), HEADER_BYTES + ROW_BYTES,
    'white light specular against a black material still builds');
  material(GL_SPECULAR, 1, 1, 1, 1);
  refuses(0b1, 'a specular term that can reach the picture');
  // ...and the light's half alone flips it back, with the material still lit.
  light(0, GL_SPECULAR, 0, 0, 0, 1);
  assert.strictEqual(e.gl_dlt1_lighting(dst, 0b1), HEADER_BYTES + ROW_BYTES,
    'a black light specular builds even against a lit material');
  // A light that is not enabled cannot cause a refusal.
  light(0, GL_SPECULAR, 1, 1, 1, 1);
  assert.strictEqual(e.gl_dlt1_lighting(dst, 0b10), HEADER_BYTES + ROW_BYTES,
    'the specular of a light outside the mask is not consulted');
  refuses(0b11, 'the same light inside the mask is');
  material(GL_SPECULAR, 0, 0, 0, 1);

  // A positional light has no row type in DLT1.
  light(3, GL_POSITION, 1, 2, 3, 1);
  refuses(0b1000, 'a positional light (w != 0)');
  assert.strictEqual(e.gl_dlt1_lighting(dst, 0b1), HEADER_BYTES + ROW_BYTES,
    'the positional light only refuses while it is enabled');

  refuses(0x100, 'a mask beyond the eight lights DLT1 can carry');
  assert.strictEqual(e.gl_dlt1_lighting(0, 0b1), 0, 'a null destination is refused');

  // --- the untrusted latch ------------------------------------------------
  //
  // glPushAttrib is mirrored now (test-gl-attrib-stack.js), so the trigger is
  // the one thing that mirror cannot represent: a push past its 16-deep cap,
  // after which the matching pop restores the wrong nesting level.
  const stack = toHost(e.guest_alloc(64));
  new Int32Array(memory.buffer, stack, 16).fill(0);
  for (let i = 0; i < 17; i++) e.gl_mtx_observe(CALL_INDEX.glPushAttrib, stack);
  assert.strictEqual(e.gl_mtx_untrusted(), CALL_INDEX.glPushAttrib,
    'a push past the attribute-stack cap latches UNTRUSTED');
  refuses(0b1, 'an untrusted mirror');
  e.gl_mtx_clear_untrusted();
  assert.strictEqual(e.gl_dlt1_lighting(dst, 0b1), HEADER_BYTES + ROW_BYTES,
    'building resumes once the latch is cleared');

  assert.strictEqual(u8()[dst - 1], 0xAB, 'guard below intact at the end');
  assert.strictEqual(u8()[dst + BUFFER_BYTES], 0xCD, 'guard above intact at the end');

  console.log('test-gl-dlt1-lighting: PASS');
}

main().catch(err => { console.error(err); process.exit(1); });
