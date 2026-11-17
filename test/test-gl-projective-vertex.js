#!/usr/bin/env node
'use strict';

// Projective vertices (glVertex4f/4fv, 4-component position arrays) on the
// software GL path. The packed vertex carries w as its 15th float, and the
// rasterizer clips and divides by the clip w that results.
//
// An orthographic projection passes the vertex w straight to clip w. A 2x1
// texture (red | blue, NEAREST) is mapped s = 0 at the left edge, s = 1 at the
// right, over a quad filling the 32x32 view:
//  - w = 1 everywhere: the red/blue boundary is at mid-screen;
//  - w = 2 everywhere, x,y,z doubled: the same points, so the same pixels;
//  - w = 1 on the left, w = 3 on the right (x,y,z tripled there, so the
//    corners land where they did): perspective-correct interpolation weights
//    the left by 1/w, and s reaches 0.5 three-quarters of the way across.
// Before w was carried it was read as 1 (or not at all), so the third case
// matched the first.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const { CALL_INDEX } = require('../lib/gl-command-stream');
const { VERTEX_FLOATS } = require('../lib/gl-command-stream.js');

const MODELVIEW = 0x1700, PROJECTION = 0x1701;
const VERT_BYTES = VERTEX_FLOATS * 4;
const VP = 32;
const GL_TEXTURE_2D = 0x0DE1;
const RED = 0xFFFF0000, BLUE = 0xFF0000FF;

async function main() {
  assert.strictEqual(VERTEX_FLOATS, 19, 'w is the 15th float of a packed vertex, r/q of both units follow');
  const { exports: e, memory } = await bootRenderHarness();
  const guestBase = e.get_guest_base() >>> 0, imageBase = e.get_image_base() >>> 0;
  const toWasm = guest => guestBase + (guest >>> 0) - imageBase;
  const verts = toWasm(e.guest_alloc(VERT_BYTES * 3));
  const stack = toWasm(e.guest_alloc(64));
  const glCall = (op, ...args) => {
    const words = new Int32Array(memory.buffer, stack, 16);
    words.fill(0);
    args.forEach((v, i) => { words[1 + i] = v; });
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

  // 2x1 RGB texture: red, blue.
  const texels = e.guest_alloc(8) >>> 0;
  new Uint8Array(memory.buffer, toWasm(texels), 6).set([255, 0, 0, 0, 0, 255]);
  glCall(CALL_INDEX.glBindTexture, GL_TEXTURE_2D, 7);
  glCall(CALL_INDEX.glPixelStorei, 0x0CF5, 1);
  glCall(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2800, 0x2600);  // MAG NEAREST
  glCall(CALL_INDEX.glTexParameteri, GL_TEXTURE_2D, 0x2801, 0x2600);  // MIN NEAREST
  glCall(CALL_INDEX.glTexImage2D, GL_TEXTURE_2D, 0, 0x1907, 2, 1, 0, 0x1907, 0x1401, texels);
  glCall(CALL_INDEX.glEnable, GL_TEXTURE_2D);

  // One quad, its left corners at w = wl and its right corners at w = wr.
  const quad = (wl, wr, bottomZ = 0) => {
    const tri = pts => {
      pts.forEach(([x, y], i) => {
        const w = x < 0 ? wl : wr;
        const f = new Float32Array(memory.buffer, verts + i * VERT_BYTES, VERTEX_FLOATS);
        f.fill(0);
        f.set([x * w, y * w, (y < 0 ? bottomZ * w : 0), 1, 1, 1, 1, (x + 1) / 2, 0.5]);
        f[12] = (x + 1) / 2; f[13] = 0.5;
        f[14] = w;
        f[16] = 1; f[18] = 1;  // q of both units
      });
      e.gl_sw_emit_packed19(verts, 3, 4);
    };
    tri([[-1, -1], [1, -1], [1, 1]]);
    tri([[-1, -1], [1, 1], [-1, 1]]);
  };
  const row = () => {
    const entry = e.gl_sw_entry() >>> 0;
    const u16 = o => new Uint16Array(memory.buffer.slice(entry + o, entry + o + 2))[0];
    const dib = new Int32Array(memory.buffer.slice(entry + 20, entry + 24))[0] >>> 0;
    const pixels = new Uint32Array(memory.buffer.slice(dib, dib + u16(18) * u16(14)));
    const y = VP / 2, stride = u16(18) / 4;
    return Array.from({ length: VP }, (_, x) => pixels[y * stride + x] >>> 0);
  };
  const boundary = r => r.findIndex(p => p === BLUE);

  quad(1, 1);
  const flat = row();
  assert.ok(flat.every(p => p === RED || p === BLUE), 'every pixel of the row is textured');
  const mid = boundary(flat);
  assert.ok(Math.abs(mid - VP / 2) <= 1, `w = 1: the boundary is at mid-screen (column ${mid})`);

  quad(2, 2);
  assert.deepStrictEqual(row(), flat, 'w = 2 with x,y,z doubled draws exactly the w = 1 pixels');

  quad(1, 3);
  const proj = row();
  const edge = boundary(proj);
  assert.ok(Math.abs(edge - VP * 0.75) <= 1,
    `w = 1 | 3: perspective-correct s reaches 0.5 at three quarters (column ${edge}, affine would be ${mid})`);
  assert.strictEqual(proj[Math.round(VP * 0.6)], RED, '60% across is still red under w = 1 | 3');

  // Each texture unit Q is independent of position w. Keep the ordinary
  // position controls above so a renderer cannot fix Q by changing clip w.
  for(const unit of [0,1]) {
  glCall(CALL_INDEX.glActiveTextureARB, 0x84C0+1-unit);
  glCall(CALL_INDEX.glDisable, GL_TEXTURE_2D);
  glCall(CALL_INDEX.glActiveTextureARB, 0x84C0+unit);
  e.gl_mtx_observe(CALL_INDEX.glActiveTextureARB, stack);
  glCall(CALL_INDEX.glBindTexture, GL_TEXTURE_2D, 7);
  glCall(CALL_INDEX.glEnable, GL_TEXTURE_2D);
  e.gl_mtx_set_mode(0x1702);
  const matrixGuest=e.guest_alloc(64) >>> 0;
  const matrix=new Float32Array(memory.buffer,toWasm(matrixGuest),16);
  matrix.set([3,0,0,2, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
  words.fill(0); words[1]=matrixGuest;
  e.gl_mtx_observe(CALL_INDEX.glLoadMatrixf,stack);
  quad(1,1);
  const textureEdge=boundary(row());
  assert.ok(Math.abs(textureEdge-VP/4)<=1,
    'unit'+unit+' texture Q must cross at one quarter, got '+textureEdge);
  for(const z of [-1.5,1.5]) {
    quad(1,1,z);
    const clipped=row();
    assert.ok(clipped.every(p=>p===RED||p===BLUE),'clipped row stays textured');
    assert.ok(Math.abs(boundary(clipped)-VP/4)<=1,
      'near/far clipping preserves texture Q within raster rounding, z='+z);
  }
  quad(1,3);
  const combinedEdge=boundary(row());
  assert.ok(Math.abs(combinedEdge-VP/2)<=1,
    'unit'+unit+' texture Q and position w must be independent, got '+combinedEdge);
  e.gl_mtx_load_identity();
  quad(1,1);
  assert.strictEqual(boundary(row()),mid,'identity texture matrix restores Q=1');
  console.log('PASS unit'+unit+' homogeneous texture matrix: '+textureEdge+', combined '+combinedEdge);
  }

  console.log(`PASS  software GL divides by the vertex w: boundary ${mid} -> ${edge} of ${VP}`);
}

main().catch(err => { console.error(err); process.exit(1); });
