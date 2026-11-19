#!/usr/bin/env node
'use strict';
// GL fixed-function T&L as a generated vertex shader (src/09a8gv-gl-gps-vs.wat).
// Each scene runs through the real opengl32 thunks on three arms:
//   sw   the CPU rasterizer, no producer (the reference picture)
//   cpu  the producer with gl_gps_vs_enable(0): CPU-transformed screen
//        triangles on the software executor (the path before 09a8gv)
//   vs   the producer with raw vertices + a generated VS on the software
//        executor's WAT shader VM
// and compares the presented front buffers. Unlit scenes must go whole to
// the VS (vs-draws > 0, no VS declines, no CPU-transformed vertices); a lit
// scene is a counted VS decline (reason 1) and draws on the CPU path.
//
// Scenes: perspective + depth + textured (bilinear) quads; a whole mip chain
// (screen-parallel, so the CPU's per-face level is the executor's per-pixel
// one); linear / exp / exp2 fog; a unit 0 texture matrix and projective Q;
// back-face culling under both glFrontFace windings; glPolygonOffset on a
// coplanar pair; a viewport sub-rectangle with glDepthRange; a lit sphere-ish
// fan (declined).
const assert = require('assert');
const { bootGlGps, comparePictures } = require('./helpers/gl-gps-context');
const DECLINES = require('../lib/gl-gps-declines.generated');

const SIZE = 32;
const TEX2D = 0xde1, DEPTH = 0xb71, CULL = 0xb44, FOG = 0xb60, LIGHTING = 0xb50, LIGHT0 = 0x4000;
const OFFSET_FILL = 0x8037, PROJ = 0x1701, MV = 0x1700, TEXM = 0x1702;
const ALL = 0x4000 | 0x100 | 0x400;
const ST = DECLINES.stats;

function dbl(x) {
  const b = new DataView(new ArrayBuffer(8)); b.setFloat64(0, x, true);
  return [b.getUint32(0, true), b.getUint32(4, true)];
}

function vsStats(g) {
  const s = i => g.e.gl_gps_stat(i) >>> 0;
  const reasons = {};
  for (let r = 1; r < 32; r++) if (s(ST.vsReasonBase + r)) reasons[DECLINES.vsName(r)] = s(ST.vsReasonBase + r);
  return { draws: s(ST.vsDraws), tris: s(ST.vsTriangles), verts: s(ST.vsVertices), builds: s(ST.vsBuilds),
    chains: s(ST.mipChains), cpuVerts: s(ST.cpuVertices), reasons };
}

// An RGBA texture, w x h, texel (x, y) from $fn, as level $level of $name.
function texture(g, name, level, w, h, fn) {
  const n = w * h * 4, px = g.e.guest_alloc(n) >>> 0, v = new Uint8Array(g.memory.buffer, g.wa(px), n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) v.set(fn(x, y), (y * w + x) * 4);
  g.call('glBindTexture', [TEX2D, name]);
  g.call('glTexImage2D', [TEX2D, level, 0x1908, w, h, 0, 0x1908, 0x1401, px]);
}

function perspective(g) {
  g.call('glMatrixMode', [PROJ]); g.call('glLoadIdentity');
  g.call('glFrustum', [...dbl(-0.1), ...dbl(0.1), ...dbl(-0.1), ...dbl(0.1), ...dbl(0.1), ...dbl(20)]);
  g.call('glMatrixMode', [MV]); g.call('glLoadIdentity');
}

function quad3(g, pts, color, tcs) {
  if (color) g.call('glColor4f', color.map(g.f));
  g.call('glBegin', [7]);
  pts.forEach((p, i) => {
    if (p.c) g.call('glColor4f', p.c.map(g.f));
    if (tcs) g.call(tcs[i].length > 2 ? 'glTexCoord4f' : 'glTexCoord2f', tcs[i].map(g.f));
    g.call('glVertex3f', p.v.map(g.f));
  });
  g.call('glEnd');
}

const UV = [[0, 0], [1, 0], [1, 1], [0, 1]];
const checker = (x, y) => ((x ^ y) & 1 ? [230, 40, 30, 255] : [20, 90, 220, 255]);

const SCENES = {
  // Two overlapping textured quads in perspective, depth-tested, bilinear.
  textured(g) {
    g.clear([0.1, 0.1, 0.1, 1], ALL);
    perspective(g);
    texture(g, 1, 0, 8, 8, (x, y) => [x * 32, y * 32, ((x ^ y) & 1) * 255, 255]);
    g.call('glTexParameteri', [TEX2D, 0x2801, 0x2601]); g.call('glTexParameteri', [TEX2D, 0x2800, 0x2601]);
    g.call('glEnable', [TEX2D]); g.call('glEnable', [DEPTH]);
    g.call('glTranslatef', [0, 0, -3].map(g.f)); g.call('glRotatef', [35, 0.3, 1, 0].map(g.f));
    quad3(g, [{ v: [-1, -1, 0] }, { v: [1, -1, 0] }, { v: [1, 1, 0] }, { v: [-1, 1, 0] }], [1, 1, 1, 1], UV);
    g.call('glRotatef', [80, 0, 1, 0].map(g.f));
    quad3(g, [{ v: [-0.8, -0.6, 0], c: [1, 0.5, 0.5, 1] }, { v: [0.8, -0.6, 0], c: [0.5, 1, 0.5, 1] },
      { v: [0.8, 0.6, 0], c: [0.5, 0.5, 1, 1] }, { v: [-0.8, 0.6, 0], c: [1, 1, 1, 1] }], null, UV);
    g.call('glDisable', [TEX2D]); g.call('glDisable', [DEPTH]);
    g.swap();
  },
  // 64x64 with a full chain of flat-coloured levels on a 16x16-pixel quad:
  // level 2 everywhere.
  mipmaps(g) {
    g.clear([0, 0, 0, 1], ALL);
    const colors = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0], [0, 255, 255], [255, 0, 255], [255, 255, 255]];
    for (let l = 0, w = 64; w >= 1; l++, w >>= 1) texture(g, 2, l, w, w, () => [...colors[l], 255]);
    g.call('glTexParameteri', [TEX2D, 0x2801, 0x2700]); g.call('glTexParameteri', [TEX2D, 0x2800, 0x2600]);
    g.call('glEnable', [TEX2D]);
    g.quad(-0.5, -0.5, 0.5, 0.5, [1, 1, 1, 1], { t: UV });
    g.call('glDisable', [TEX2D]);
    g.swap();
  },
  fog(g) {
    g.clear([0, 0, 0, 1], ALL);
    perspective(g);
    const col = g.e.guest_alloc(16) >>> 0, dv = new DataView(g.memory.buffer);
    [0.6, 0.7, 0.8, 1].forEach((c, i) => dv.setFloat32(g.wa(col) + i * 4, c, true));
    g.call('glEnable', [FOG]); g.call('glFogfv', [0xb66, col]);
    const strip = (mode, y0, y1) => {
      g.call('glFogi', [0xb65, mode]);
      quad3(g, [{ v: [-1.5, y0, -1], c: [1, 0, 0, 1] }, { v: [1.5, y0, -8] , c: [0, 1, 0, 1] },
        { v: [1.5, y1, -8], c: [0, 0, 1, 1] }, { v: [-1.5, y1, -1], c: [1, 1, 0, 1] }]);
    };
    g.call('glFogf', [0xb63, g.f(1)]); g.call('glFogf', [0xb64, g.f(7)]); g.call('glFogf', [0xb62, g.f(0.35)]);
    g.call('glTranslatef', [0, 0, -1].map(g.f));
    strip(0x2601, 0.4, 1.2);
    strip(0x800, -0.4, 0.4);
    strip(0x801, -1.2, -0.4);
    g.call('glDisable', [FOG]);
    g.swap();
  },
  // A texture matrix (scale, rotate, translate) and projective coordinates.
  texmatrix(g) {
    g.clear([0, 0, 0, 1], ALL);
    texture(g, 3, 0, 8, 8, checker);
    g.call('glTexParameteri', [TEX2D, 0x2801, 0x2600]); g.call('glTexParameteri', [TEX2D, 0x2800, 0x2600]);
    g.call('glEnable', [TEX2D]);
    g.call('glMatrixMode', [TEXM]); g.call('glLoadIdentity');
    g.call('glTranslatef', [0.25, 0.1, 0].map(g.f)); g.call('glRotatef', [20, 0, 0, 1].map(g.f));
    g.call('glScalef', [2, 1.5, 1].map(g.f));
    g.call('glMatrixMode', [MV]);
    g.quad(-1, -1, 0, 1, [1, 1, 1, 1], { t: UV });
    g.call('glMatrixMode', [TEXM]); g.call('glLoadIdentity'); g.call('glMatrixMode', [MV]);
    g.quad(0, -1, 1, 1, [1, 1, 1, 1], { t: [[0, 0, 0, 1], [2, 0, 0, 2], [2, 2, 0, 2], [0, 1, 0, 1]] });
    g.call('glDisable', [TEX2D]);
    g.swap();
  },
  // Four quads, two of each winding, culled under both glFrontFace modes.
  cull(g) {
    g.clear([0, 0, 0, 1], ALL);
    g.call('glEnable', [CULL]); g.call('glCullFace', [0x405]);
    const ccw = (x0, y0, x1, y1, c) => g.prim(7, [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], c);
    const cw = (x0, y0, x1, y1, c) => g.prim(7, [{ x: x0, y: y0 }, { x: x0, y: y1 }, { x: x1, y: y1 }, { x: x1, y: y0 }], c);
    g.call('glFrontFace', [0x901]);
    ccw(-1, -1, 0, 0, [1, 0, 0, 1]); cw(0, -1, 1, 0, [0, 1, 0, 1]);
    g.call('glFrontFace', [0x900]);
    ccw(-1, 0, 0, 1, [0, 0, 1, 1]); cw(0, 0, 1, 1, [1, 1, 0, 1]);
    g.call('glCullFace', [0x404]); g.call('glFrontFace', [0x901]);
    ccw(-0.5, -0.5, 0.5, 0.5, [1, 0, 1, 1]);
    g.call('glDisable', [CULL]);
    g.swap();
  },
  // A tilted quad, then the same plane in another colour: only the offset
  // one wins the depth test.
  polygonOffset(g) {
    g.clear([0, 0, 0, 1], ALL);
    perspective(g);
    g.call('glEnable', [DEPTH]);
    g.call('glTranslatef', [0, 0, -3].map(g.f)); g.call('glRotatef', [50, 1, 0.2, 0].map(g.f));
    const plane = c => quad3(g, [{ v: [-1, -1, 0] }, { v: [1, -1, 0] }, { v: [1, 1, 0] }, { v: [-1, 1, 0] }], c);
    plane([0, 0, 1, 1]);
    g.call('glEnable', [OFFSET_FILL]); g.call('glPolygonOffset', [g.f(-1), g.f(-2)]);
    g.call('glMatrixMode', [MV]);
    quad3(g, [{ v: [-0.5, -1, 0] }, { v: [0.5, -1, 0] }, { v: [0.5, 1, 0] }, { v: [-0.5, 1, 0] }], [1, 1, 0, 1]);
    g.call('glDisable', [OFFSET_FILL]);
    g.call('glDisable', [DEPTH]);
    g.swap();
  },
  // A viewport sub-rectangle and a depth range: the near half of the range
  // keeps the second (farther in z, nearer in window depth) quad in front.
  viewport(g) {
    g.clear([0, 0, 0, 1], ALL);
    g.call('glEnable', [DEPTH]);
    g.call('glViewport', [4, 6, 20, 14]);
    g.call('glDepthRange', [...dbl(0.5), ...dbl(1)]);
    g.prim(4, [{ x: -1, y: -1, z: 0.2 }, { x: 1, y: -1, z: 0.2 }, { x: 0, y: 1, z: 0.2 }], [1, 0, 0, 1]);
    g.call('glDepthRange', [...dbl(0), ...dbl(0.5)]);
    g.prim(4, [{ x: -1, y: 1, z: 0.6 }, { x: 1, y: 1, z: 0.6 }, { x: 0, y: -1, z: 0.6 }], [0, 1, 0, 1]);
    // Reversed (Half-Life's z-trick): z 0.9 lands at window depth 0.05,
    // in front of both.
    g.call('glDepthRange', [...dbl(0.5), ...dbl(0)]);
    g.prim(4, [{ x: -0.3, y: -0.3, z: 0.8 }, { x: 0.3, y: -0.3, z: 0.8 }, { x: 0, y: 0.3, z: 0.8 }], [0, 0, 1, 1]);
    g.call('glDepthRange', [...dbl(0), ...dbl(1)]);
    g.call('glViewport', [0, 0, SIZE, SIZE]);
    g.call('glDisable', [DEPTH]);
    g.swap();
  },
  // GL_FLAT: the encoder (09a8c) hands each triangle its provoking colour
  // on all three vertices, so the VS draws it; a triangle whose colours
  // still differ would be a counted decline (5).
  flat(g) {
    g.clear([0, 0, 0, 1], ALL);
    g.call('glShadeModel', [0x1d00]);
    g.quad(-1, -1, 0, 1, [0.2, 0.8, 0.4, 1]);
    g.prim(4, [{ x: 0, y: -1, c: [1, 0, 0, 1] }, { x: 1, y: -1, c: [0, 1, 0, 1] }, { x: 0.5, y: 1, c: [0, 0, 1, 1] }]);
    g.call('glShadeModel', [0x1d01]);
    g.swap();
  },
  // Vertex arrays with byte colours and glDrawElements (Quake 3's path):
  // 09a8c packs these as exact-colour 112-byte records.
  arrays(g) {
    g.clear([0, 0, 0, 1], ALL);
    perspective(g);
    g.call('glTranslatef', [0, 0, -2.5].map(g.f)); g.call('glRotatef', [25, 1, 0.5, 0].map(g.f));
    texture(g, 4, 0, 8, 8, checker);
    g.call('glTexParameteri', [TEX2D, 0x2801, 0x2601]); g.call('glTexParameteri', [TEX2D, 0x2800, 0x2601]);
    g.call('glEnable', [TEX2D]);
    const P = [[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0], [0, 0, 0.5]];
    const C = [[255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255], [255, 255, 0, 255], [17, 200, 99, 255]];
    const T = [[0, 0], [2, 0], [2, 2], [0, 2], [1, 1]];
    const I = [0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4];
    const put = (n, fill) => { const p = g.e.guest_alloc(n) >>> 0; fill(new DataView(g.memory.buffer), g.wa(p)); return p; };
    const pv = put(60, (d, w) => P.flat().forEach((x, i) => d.setFloat32(w + i * 4, x, true)));
    const pc = put(20, (d, w) => C.flat().forEach((x, i) => d.setUint8(w + i, x)));
    const pt = put(40, (d, w) => T.flat().forEach((x, i) => d.setFloat32(w + i * 4, x, true)));
    const pi = put(48, (d, w) => I.forEach((x, i) => d.setUint32(w + i * 4, x, true)));
    g.call('glEnableClientState', [0x8074]); g.call('glEnableClientState', [0x8076]); g.call('glEnableClientState', [0x8078]);
    g.call('glVertexPointer', [3, 0x1406, 0, pv]);
    g.call('glColorPointer', [4, 0x1401, 0, pc]);
    g.call('glTexCoordPointer', [2, 0x1406, 0, pt]);
    g.call('glDrawElements', [4, I.length, 0x1405, pi]);
    g.call('glDisableClientState', [0x8074]); g.call('glDisableClientState', [0x8076]); g.call('glDisableClientState', [0x8078]);
    g.call('glDisable', [TEX2D]);
    g.swap();
  },
  lit(g) {
    g.clear([0, 0, 0, 1], ALL);
    g.call('glEnable', [LIGHTING]); g.call('glEnable', [LIGHT0]);
    g.call('glNormal3f', [0, 0, 1].map(g.f));
    g.quad(-0.8, -0.8, 0.8, 0.8, [1, 1, 1, 1]);
    g.call('glDisable', [LIGHTING]); g.call('glDisable', [LIGHT0]);
    g.swap();
  },
};

// The VS arm is held to the CPU arm (the same executor, so only the T&L
// differs): per channel within TOL, with SLACK pixels allowed past it. The
// executor rasterizes the same continuous window positions with the same
// top-left rule; what differs is float order. The half-pixel centre shift
// is folded into c0/c1 as 1/viewport, inexact for most viewport sizes, so a
// pixel centre exactly on an edge can fall the other way (viewport: (6,22)
// lies exactly on the red triangle's left edge in a 20-wide viewport).
// Against the no-producer software reference the VS arm must do no worse
// than the CPU arm does (fog and bilinear edges differ there already: the
// executor interpolates the per-vertex fog factor and filters in floats).
const TOL = 1;
const SLACK = { viewport: 1 };

(async () => {
  const rows = [];
  for (const [name, scene] of Object.entries(SCENES)) {
    const arm = async (gps, vs) => {
      const g = await bootGlGps({ gps, size: SIZE });
      if (gps) g.e.gl_gps_vs_enable(vs);
      scene(g);
      return { g, pic: g.front(), st: gps ? g.stats() : null, vs: gps ? vsStats(g) : null };
    };
    const sw = await arm(0, 0), cpu = await arm(1, 0), vs = await arm(1, 1);
    const vsRef = comparePictures(sw.pic, vs.pic, TOL);
    const vsCpu = comparePictures(cpu.pic, vs.pic, TOL);
    const cpuRef = comparePictures(sw.pic, cpu.pic, 1);
    const lit = name === 'lit';
    const over = (a, b) => {
      let n = 0;
      for (let i = 0; i < a.px.length; i++) {
        let m = 0;
        for (let s = 0; s < 24; s += 8) m = Math.max(m, Math.abs((a.px[i] >>> s & 255) - (b.px[i] >>> s & 255)));
        if (m > TOL) n++;
      }
      return n;
    };
    const overRef = over(sw.pic, vs.pic), overCpu = over(cpu.pic, vs.pic), overCpuRef = over(sw.pic, cpu.pic);
    rows.push({ name, vsDraws: vs.vs.draws, vsTris: vs.vs.tris, cpuVerts: vs.vs.cpuVerts, cpuArmCpuVerts: cpu.vs.cpuVerts,
      reasons: vs.vs.reasons, worstRef: vsRef.worst, differRef: vsRef.differ, overRef, worstCpu: vsCpu.worst, differCpu: vsCpu.differ,
      cpuArmWorst: cpuRef.worst });
    assert.ok(new Set(sw.pic.px).size > 1, `${name}: the scene draws something`);
    assert.strictEqual(cpu.vs.draws, 0, `${name}: gl_gps_vs_enable(0) keeps every draw on the CPU path`);
    assert.strictEqual(vs.st.declines, 0, `${name}: no frame declines: ${JSON.stringify(vs.st.reasons)}`);
    if (lit) {
      assert.strictEqual(vs.vs.draws, 0, 'lit: no VS draw');
      assert.ok(vs.vs.reasons.lighting >= 1, `lit: a counted lighting decline: ${JSON.stringify(vs.vs.reasons)}`);
      assert.ok(vs.vs.cpuVerts > 0, 'lit: the CPU path transformed its vertices');
    } else {
      assert.ok(vs.vs.draws > 0, `${name}: the VS path took the draws: ${JSON.stringify(vs.vs)}`);
      assert.deepStrictEqual(vs.vs.reasons, {}, `${name}: no VS declines`);
      assert.strictEqual(vs.vs.cpuVerts, 0, `${name}: no CPU-transformed vertex`);
    }
    if (!process.env.GL_GPS_VS_REPORT) {
      assert.ok(overCpu <= (SLACK[name] || 0),
        `${name}: VS arm matches the CPU arm within ${TOL} (${overCpu} pixels over, slack ${SLACK[name] || 0}): ${JSON.stringify(vsCpu)}`);
      assert.ok(overRef <= overCpuRef + (SLACK[name] || 0) && vsRef.worst <= Math.max(cpuRef.worst, TOL) + (SLACK[name] ? 255 : 0),
        `${name}: VS arm no further from software than the CPU arm (${overRef} vs ${overCpuRef} pixels over ${TOL}): ${JSON.stringify(vsRef)}`);
    }
    if (name === 'mipmaps') {
      assert.ok(vs.vs.chains >= 1, 'mipmaps: a whole chain was uploaded');
      assert.ok(vs.pic.px.includes(0x0000ff), 'mipmaps: level 2 (blue) is what is sampled');
    }
    console.log(`PASS ${name}: vs-draws=${vs.vs.draws} tris=${vs.vs.tris} vs-vs-software worst=${vsRef.worst} differ=${vsRef.differ}` +
      ` over=${overRef} vs-vs-cpu-arm worst=${vsCpu.worst} differ=${vsCpu.differ} cpu-arm-vs-software worst=${cpuRef.worst} differ=${cpuRef.differ}` +
      (lit ? ` declines=${JSON.stringify(vs.vs.reasons)}` : '') +
      (vsRef.at >= 0 && process.env.GL_GPS_VS_REPORT ? ` first-worst at (${vsRef.at % SIZE},${(vsRef.at / SIZE) | 0}) sw=${sw.pic.px[vsRef.at].toString(16)} vs=${vs.pic.px[vsRef.at].toString(16)}` : ''));
  }
  if (process.env.GL_GPS_VS_JSON) require('fs').writeFileSync(process.env.GL_GPS_VS_JSON, JSON.stringify(rows, null, 2) + '\n');
})().catch(e => { console.error(e.stack || e); process.exitCode = 1; });
