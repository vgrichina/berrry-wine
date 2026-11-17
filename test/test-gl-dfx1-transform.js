#!/usr/bin/env node
'use strict';

// $gl_dfx1_transform (src/09a8f-gl-matrix.wat) -- the first thing on the WAT
// side that PRODUCES a backend-neutral descriptor instead of consuming GL
// calls. See docs/gl-software-path-design.md, "Shape of the work" step 2.
//
// WHAT THIS TEST IS FOR. Every mistake available here is invisible downstream,
// because each one produces a descriptor that is structurally perfect and
// renders a plausible wrong picture:
//
//   - A MISSING TRANSPOSE. GL is column-major, DFX1 is row-major. A
//     transposed transform still projects geometry; it just projects the wrong
//     geometry. Nothing validates it, so every matrix asserted below is one
//     whose transpose differs from itself -- an identity or a pure scale would
//     pass whether or not the transpose happened, which makes them worse than
//     no test at all.
//   - THE WORLD/VIEW SWAP. GL conflates world and view in one modelview
//     stack; DFX1 has both, and geometry cannot tell them apart because it
//     uses the product. The one consumer of the view matrix ALONE is the DLT1
//     light direction (src/09aj-d3d-fixed.wat:681-683), and GL has already
//     baked the modelview into its light positions at glLightfv time. So the
//     modelview belongs in WORLD, with view identity, or every light is
//     transformed twice -- geometry still lands correctly, which is exactly
//     what makes it hard to find.
//   - READING THE SELECTED STACK. The descriptor wants modelview and
//     projection BY NAME. A build that reads "the current matrix" is correct
//     for as long as the app happens to leave GL_MODELVIEW selected, which is
//     most of the time, and wrong immediately after a glMatrixMode that has
//     not been switched back. So the check below runs with PROJECTION
//     selected.
//   - IGNORING THE UNTRUSTED LATCH. A descriptor built from state we know we
//     failed to track is a confident wrong answer. Refusing is the contract,
//     and it is asserted as such.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const { CALL_INDEX } = require('../lib/gl-command-stream');
const { identity, ortho } = require('./helpers/gl-matrix-reference');

const MODELVIEW = 0x1700, PROJECTION = 0x1701;
const DFX1_MAGIC = 0x44465831;

// DFX1 ABI1, from the layout comment at src/09aj-d3d-fixed.wat:1-11.
const OFF = {
  magic: 0, abi: 4, flags: 8,
  viewportX: 68, viewportY: 72, viewportW: 76, viewportH: 80,
  minZ: 84, maxZ: 88, reserved: 92,
  world: 96, view: 160, projection: 224,
};
const DESC_BYTES = 288;

// dst[row*4+col] = src[col*4+row]
function transpose(m) {
  const out = new Float32Array(16);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) out[i * 4 + j] = m[j * 4 + i];
  return out;
}

const bits = values => [...new Uint32Array(Float32Array.from(values).buffer)]
  .map(v => v.toString(16).padStart(8, '0')).join(' ');

async function main() {
  const { exports: e, memory } = await bootRenderHarness();
  const u8 = () => new Uint8Array(memory.buffer);
  const f32At = ptr => new Float32Array(memory.buffer.slice(ptr, ptr + 64));
  const i32At = ptr => new Int32Array(memory.buffer.slice(ptr, ptr + 4))[0];
  const f32One = ptr => new Float32Array(memory.buffer.slice(ptr, ptr + 4))[0];

  // A guest buffer for the descriptor, with a guard byte either side so an
  // overrun past 288 is caught rather than silently landing in the heap.
  const guestDesc = e.guest_alloc(DESC_BYTES + 2) >>> 0;
  const desc = (e.get_guest_base() >>> 0)
    + guestDesc - (e.get_image_base() >>> 0) + 1;
  u8()[desc - 1] = 0xAB;
  u8()[desc + DESC_BYTES] = 0xCD;

  // --- a GL state worth transposing -------------------------------------
  //
  // The modelview gets a translate+rotate so that no row equals its column,
  // and the projection an off-centre ortho, whose transpose also differs from
  // itself (its translation row is the giveaway).
  e.gl_mtx_set_mode(MODELVIEW);
  e.gl_mtx_load_identity();
  e.gl_mtx_translate(2, 3, 4);
  e.gl_mtx_rotate(30, 0, 0, 1);
  const modelview = f32At(e.gl_mtx_top_ptr() >>> 0);
  assert.notStrictEqual(bits(modelview), bits(transpose(modelview)),
    'the modelview chosen for this test must not be its own transpose,'
    + ' or a missing transpose would pass');

  e.gl_mtx_set_mode(PROJECTION);
  e.gl_mtx_load_identity();
  e.gl_mtx_ortho(-1, 3, -2, 5, 0.5, 40);
  const projection = f32At(e.gl_mtx_top_ptr() >>> 0);
  assert.notStrictEqual(bits(projection), bits(transpose(projection)),
    'the projection chosen for this test must not be its own transpose');
  // The oracle for the projection is the shipping ortho(), not a transcription.
  assert.strictEqual(bits(projection), bits(ortho(-1, 3, -2, 5, 0.5, 40)),
    'projection stack does not hold what lib/gl-compat.js ortho() computes');

  // Viewport and depth range arrive through the observer, exactly as the
  // encoder delivers them, so the argument offsets are under test too.
  const glViewport = CALL_INDEX.glViewport, glDepthRange = CALL_INDEX.glDepthRange;
  assert.strictEqual(typeof glViewport, 'number', 'glViewport is in CALLS');
  assert.strictEqual(typeof glDepthRange, 'number', 'glDepthRange is in CALLS');

  const guestStack = e.guest_alloc(64) >>> 0;
  const sp = (e.get_guest_base() >>> 0) + guestStack - (e.get_image_base() >>> 0);
  const words = () => new Int32Array(memory.buffer, sp, 16);

  words().fill(0);
  words().set([0, 12, 34, 640, 480], 0); // argument i lives at offset 4 + i*4
  e.gl_mtx_observe(glViewport, sp);

  // glDepthRange takes two GLclampd, so its arguments are f64 at byte 4 and
  // byte 12 -- neither 8-aligned, which is why this goes through a DataView
  // rather than a Float64Array over the same region.
  words().fill(0);
  const view = new DataView(memory.buffer);
  view.setFloat64(sp + 4, 0.25, true);
  view.setFloat64(sp + 12, 0.75, true);
  e.gl_mtx_observe(glDepthRange, sp);

  // --- with PROJECTION still selected, build the descriptor --------------
  assert.strictEqual(e.gl_mtx_selected(), 1,
    'the test means to build while PROJECTION is the selected stack');
  assert.strictEqual(e.gl_mtx_untrusted(), 0, 'mirror is trusted before the build');
  assert.strictEqual(e.gl_dfx1_transform(desc), 1, 'build reports success');

  assert.strictEqual(i32At(desc + OFF.magic), DFX1_MAGIC, "magic is 'DFX1'");
  assert.strictEqual(i32At(desc + OFF.abi), 1, 'ABI 1');
  assert.strictEqual(i32At(desc + OFF.flags), 0,
    'flags stay zero -- this block does not know the vertex format');
  assert.strictEqual(i32At(desc + OFF.reserved), 0, 'reserved0 stays zero');

  assert.strictEqual(i32At(desc + OFF.viewportX), 12, 'viewport x');
  assert.strictEqual(i32At(desc + OFF.viewportY), 34, 'viewport y');
  assert.strictEqual(i32At(desc + OFF.viewportW), 640, 'viewport width');
  assert.strictEqual(i32At(desc + OFF.viewportH), 480, 'viewport height');
  assert.strictEqual(f32One(desc + OFF.minZ), 0.25, 'depth range near');
  assert.strictEqual(f32One(desc + OFF.maxZ), 0.75, 'depth range far');

  assert.strictEqual(bits(f32At(desc + OFF.world)), bits(transpose(modelview)),
    'world is the TRANSPOSED modelview (GL column-major -> DFX1 row-major)');
  assert.strictEqual(bits(f32At(desc + OFF.view)), bits(identity()),
    'view is identity -- GL lights are already in eye space, see DLT1');
  assert.strictEqual(bits(f32At(desc + OFF.projection)), bits(transpose(projection)),
    'projection is the TRANSPOSED projection stack top');

  // The swap this test exists to catch would put the modelview here.
  assert.notStrictEqual(bits(f32At(desc + OFF.view)), bits(transpose(modelview)),
    'the modelview must not have landed in the view slot');

  assert.strictEqual(u8()[desc - 1], 0xAB, 'no write before the descriptor');
  assert.strictEqual(u8()[desc + DESC_BYTES], 0xCD, 'no write past 288 bytes');

  // --- the contract that makes the latch worth having --------------------
  //
  // The mirror's attribute stack is capped at GL's required minimum of 16, and
  // a push past it is dropped -- which desynchronizes every later pop, since
  // the pop that matched the dropped push restores an outer frame instead.
  // That is a state the mirror cannot reproduce, so after it the descriptor
  // must not be built at all: not from stale state, and not from a guess.
  const before = memory.buffer.slice(desc, desc + DESC_BYTES);
  words().fill(0);
  for (let i = 0; i < 17; i++) e.gl_mtx_observe(CALL_INDEX.glPushAttrib, sp);
  assert.strictEqual(e.gl_mtx_untrusted(), CALL_INDEX.glPushAttrib,
    'a push past the cap latches UNTRUSTED');
  assert.strictEqual(e.gl_dfx1_transform(desc), 0,
    'an untrusted mirror must refuse to build a descriptor');
  assert.deepStrictEqual(Buffer.from(memory.buffer.slice(desc, desc + DESC_BYTES)),
    Buffer.from(before), 'a refused build writes nothing at all');

  e.gl_mtx_clear_untrusted();
  assert.strictEqual(e.gl_dfx1_transform(desc), 1, 'building resumes once cleared');
  assert.strictEqual(e.gl_dfx1_transform(0), 0, 'a null destination is refused');

  console.log('test-gl-dfx1-transform: PASS');
}

main().catch(err => { console.error(err); process.exit(1); });
