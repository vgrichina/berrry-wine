#!/usr/bin/env node
'use strict';

// GL fog on the software path uses the eye-space distance |z_e|, not clip w.
// Under a perspective projection they are the same number, which is why the
// existing fog tests never told them apart; under glOrtho clip w is 1 for
// every vertex. Oni's main menu draws with glOrtho and leaves linear fog on
// (start 0.975, end 1, color 0.25 gray): at w = 1 the factor is 0 and the
// whole menu came out fog-gray, while WebGL (|eye z|) drew it clear.
//
// Through the production encoder: a red quad at eye z = 0 must stay red, and
// one at eye z = -0.9875 -- half-way between start and end -- must be the
// half-way mix of red and the fog color.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const { CALL_INDEX } = require('../lib/gl-command-stream');

const VP = 32;
const GL_FOG = 0x0B60, GL_QUADS = 7;

async function main() {
  const { exports: e, memory } = await bootRenderHarness();
  const guestBase = e.get_guest_base() >>> 0, imageBase = e.get_image_base() >>> 0;
  const toWasm = guest => guestBase + (guest >>> 0) - imageBase;
  const stack = toWasm(e.guest_alloc(96) >>> 0);
  const f32bits = v => new Int32Array(new Float32Array([v]).buffer)[0];
  const put = list => {
    const words = new Int32Array(memory.buffer, stack, 24);
    words.fill(0);
    list.forEach((v, i) => { words[1 + i] = (v && v.f !== undefined) ? f32bits(v.f) : v; });
  };
  const f = v => ({ f: v });
  const gl = (name, ...list) => { put(list); return e.gl_wat_encoder_call(CALL_INDEX[name], stack, 0); };

  put([0, 0, VP, VP]);
  e.gl_mtx_observe(CALL_INDEX.glViewport, stack);
  e.gl_mtx_set_mode(0x1700); e.gl_mtx_load_identity();
  e.gl_mtx_set_mode(0x1701); e.gl_mtx_load_identity();
  e.gl_mtx_ortho(-1, 1, -1, 1, -1, 1);
  e.gl_sw_set_enabled(1);

  const fogColor = e.guest_alloc(16) >>> 0;
  new Float32Array(memory.buffer, toWasm(fogColor), 4).set([0.25, 0.25, 0.25, 0]);
  gl('glFogi', 0x0B65, 0x2601);           // GL_FOG_MODE, GL_LINEAR
  gl('glFogf', 0x0B63, f(0.975));         // GL_FOG_START
  gl('glFogf', 0x0B64, f(1));             // GL_FOG_END
  gl('glFogfv', 0x0B66, fogColor);        // GL_FOG_COLOR
  gl('glEnable', GL_FOG);

  const center = () => {
    const entry = e.gl_sw_entry() >>> 0;
    const u16 = o => new Uint16Array(memory.buffer.slice(entry + o, entry + o + 2))[0];
    const dib = new Int32Array(memory.buffer.slice(entry + 20, entry + 24))[0] >>> 0;
    const pixels = new Uint32Array(memory.buffer.slice(dib, dib + u16(18) * u16(14)));
    return pixels[(VP / 2) * (u16(18) / 4) + VP / 2] >>> 0;
  };
  const quad = z => {
    gl('glColor3f', f(1), f(0), f(0));
    gl('glBegin', GL_QUADS);
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) gl('glVertex3f', f(x), f(y), f(z));
    gl('glEnd');
    return center();
  };
  const rgb = p => [(p >>> 16) & 255, (p >>> 8) & 255, p & 255];

  const near = rgb(quad(0));
  assert.deepStrictEqual(near, [255, 0, 0],
    `eye z = 0 is nearer than the fog start: unfogged red, got ${near} (clip w = 1 fogs it to gray)`);

  const half = rgb(quad(-0.9875));
  const want = [Math.round((255 + 64) / 2), 32, 32];
  half.forEach((c, i) => assert.ok(Math.abs(c - want[i]) <= 3,
    `eye z = -0.9875 is half-way into the fog: ${half}, expected about ${want}`));

  console.log(`PASS  software GL fog under glOrtho uses eye |z|: z=0 ${near}, z=-0.9875 ${half}`);
}

main().catch(err => { console.error(err); process.exit(1); });
