#!/usr/bin/env node
'use strict';

// src/09a8g-gl-raster.wat -- GL_SPHERE_MAP texgen on the WAT software path.
//
// The WebGL backend generates s,t from the eye-space reflection vector when
// GL_TEXTURE_GEN_S and _T are both enabled in GL_SPHERE_MAP mode; the
// software path used the vertex's own coordinates regardless, so an
// environment-mapped surface showed one flat texel. The same formula is
// pinned here through the texel it selects:
//
//   eye vector e ~ (0,0,-1) at the centre of an orthographic view, so
//   n = normalize(1,1,1)   -> r = (2/3, 2/3, -1/3) -> s = t ~ 0.79
//   n = normalize(-1,-1,1) ->                         s = t ~ 0.21
//
// and a 2x1 texture, blue below s = 0.5 and yellow above, sampled NEAREST
// with GL_REPLACE, turns that into a colour.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const { CALL_INDEX } = require('../lib/gl-command-stream');

const MODELVIEW = 0x1700, PROJECTION = 0x1701;
const VERT_BYTES = 60, VERT_FLOATS = 15;  // w is the 15th float
const VP = 32;
const GL_TEXTURE_2D = 0x0DE1, GEN_S = 0x0C60, GEN_T = 0x0C61;
const GL_S = 0x2000, GL_T = 0x2001, GEN_MODE = 0x2500;
const SPHERE_MAP = 0x2402, OBJECT_LINEAR = 0x2401;
const BLUE = 0xFF0000FF, YELLOW = 0xFFFFFF00;

async function main() {
  const { exports: e, memory } = await bootRenderHarness();
  const guestBase = e.get_guest_base() >>> 0, imageBase = e.get_image_base() >>> 0;
  const toWasm = guest => guestBase + (guest >>> 0) - imageBase;
  const verts = toWasm(e.guest_alloc(VERT_BYTES * 3));
  const stack = toWasm(e.guest_alloc(64));

  const glCall = (op, ...args) => {
    const words = new Int32Array(memory.buffer, stack, 16);
    const floats = new Float32Array(memory.buffer, stack, 16);
    words.fill(0);
    args.forEach((v, i) => {
      if (typeof v === 'object') floats[1 + i] = v.f; else words[1 + i] = v;
    });
    e.gl_sw_observe(op, stack);
  };

  const words = new Int32Array(memory.buffer, stack, 16);
  words.fill(0);
  words.set([0, 0, 0, VP, VP], 0);
  e.gl_mtx_observe(CALL_INDEX.glViewport, stack);
  e.gl_mtx_set_mode(MODELVIEW);
  e.gl_mtx_load_identity();
  e.gl_mtx_set_mode(PROJECTION);
  e.gl_mtx_load_identity();
  e.gl_mtx_ortho(-1, 1, -1, 1, -1, 1);
  e.gl_sw_set_enabled(1);

  // A quad around the view axis at eye z = -0.5 whose own texture coordinate is
  // s = 0.9 (yellow), with every normal set to $n.
  const quad = n => {
    const tri = pts => {
      pts.forEach(([x, y], i) => {
        const f = new Float32Array(memory.buffer, verts + i * VERT_BYTES, VERT_FLOATS);
        f.fill(0);
        f[14] = 1;
        f.set([x, y, -0.5, 1, 1, 1, 1, 0.9, 0.5, ...n]);
      });
      e.gl_sw_emit_triangles(verts, 3);
    };
    // Kept to +-0.25 so every corner's eye vector stays near the axis: the
    // generated s is 0.56-0.90 for (1,1,1) and 0.10-0.44 for (-1,-1,1).
    tri([[-0.25, -0.25], [0.25, -0.25], [0.25, 0.25]]);
    tri([[-0.25, -0.25], [0.25, 0.25], [-0.25, 0.25]]);
  };

  // 2x1 RGB texture: blue, yellow.
  const texels = e.guest_alloc(8) >>> 0;
  new Uint8Array(memory.buffer, toWasm(texels), 6).set([0, 0, 255, 255, 255, 0]);
  glCall(CALL_INDEX.glBindTexture, GL_TEXTURE_2D, 3);
  glCall(CALL_INDEX.glPixelStorei, 0x0CF5, 1);
  glCall(CALL_INDEX.glTexImage2D, GL_TEXTURE_2D, 0, 0x1907, 2, 1, 0, 0x1907, 0x1401, texels);
  glCall(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2800, 0x2600);  // MAG_FILTER NEAREST
  glCall(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2801, 0x2600);  // MIN_FILTER NEAREST
  glCall(CALL_INDEX.glTexEnvi, 0x2300, 0x2200, 0x1E01);                // REPLACE
  glCall(CALL_INDEX.glEnable, GL_TEXTURE_2D);

  const centre = () => {
    const entry = e.gl_sw_entry() >>> 0;
    const u16 = o => new Uint16Array(memory.buffer.slice(entry + o, entry + o + 2))[0];
    const dib = new Int32Array(memory.buffer.slice(entry + 20, entry + 24))[0] >>> 0;
    return new Uint32Array(memory.buffer.slice(dib, dib + u16(18) * u16(14)))[
      (VP / 2) * (u16(18) / 4) + VP / 2] >>> 0;
  };
  const hex = v => `0x${v.toString(16)}`;
  const TILT_UP = [0.577, 0.577, 0.577], TILT_DOWN = [-0.577, -0.577, 0.577];

  quad(TILT_DOWN);
  assert.strictEqual(centre(), YELLOW, `no texgen: the vertex's s = 0.9 samples yellow, got ${hex(centre())}`);

  glCall(CALL_INDEX.glTexGeni, GL_S, GEN_MODE, SPHERE_MAP);
  glCall(CALL_INDEX.glTexGeni, GL_T, GEN_MODE, SPHERE_MAP);
  glCall(CALL_INDEX.glEnable, GEN_S);
  quad(TILT_DOWN);
  assert.strictEqual(centre(), YELLOW, `only S enabled: WebGL generates nothing, nor does this; got ${hex(centre())}`);

  glCall(CALL_INDEX.glEnable, GEN_T);
  quad(TILT_DOWN);
  assert.strictEqual(centre(), BLUE, `sphere map, normal (-1,-1,1): s ~ 0.21 samples blue, got ${hex(centre())}`);
  quad(TILT_UP);
  assert.strictEqual(centre(), YELLOW, `sphere map, normal (1,1,1): s ~ 0.79 samples yellow, got ${hex(centre())}`);

  // glTexGenf and glTexGenfv set the same mode.
  glCall(CALL_INDEX.glTexGenf, GL_S, GEN_MODE, { f: OBJECT_LINEAR });
  quad(TILT_DOWN);
  assert.strictEqual(centre(), YELLOW, `glTexGenf(OBJECT_LINEAR) on S stops the sphere map, got ${hex(centre())}`);
  const param = e.guest_alloc(4) >>> 0;
  new Float32Array(memory.buffer, toWasm(param), 1)[0] = SPHERE_MAP;
  glCall(CALL_INDEX.glTexGenfv, GL_S, GEN_MODE, param);
  quad(TILT_DOWN);
  assert.strictEqual(centre(), BLUE, `glTexGenfv(SPHERE_MAP) restores it, got ${hex(centre())}`);

  // GL_TEXTURE_BIT carries the texgen enables and modes.
  glCall(CALL_INDEX.glPushAttrib, 0x40000);
  glCall(CALL_INDEX.glDisable, GEN_T);
  glCall(CALL_INDEX.glTexGeni, GL_S, GEN_MODE, OBJECT_LINEAR);
  quad(TILT_DOWN);
  assert.strictEqual(centre(), YELLOW, 'inside the push the sphere map is off');
  glCall(CALL_INDEX.glPopAttrib);
  quad(TILT_DOWN);
  assert.strictEqual(centre(), BLUE, `glPopAttrib(GL_TEXTURE_BIT) restored the enable and mode, got ${hex(centre())}`);

  // Texgen is per unit: unit 1 turning its own off does not touch unit 0.
  glCall(CALL_INDEX.glActiveTextureARB, 0x84C1);
  glCall(CALL_INDEX.glDisable, GEN_S);
  glCall(CALL_INDEX.glTexGeni, GL_T, GEN_MODE, OBJECT_LINEAR);
  glCall(CALL_INDEX.glActiveTextureARB, 0x84C0);
  quad(TILT_DOWN);
  assert.strictEqual(centre(), BLUE, `unit 1's texgen state is not unit 0's, got ${hex(centre())}`);

  console.log('PASS test-gl-software-texgen');
}

main().catch(err => { console.error(err); process.exit(1); });
