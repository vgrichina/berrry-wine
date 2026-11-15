#!/usr/bin/env node
'use strict';
// End-to-end Glide on GPU stream v2: the real Glide API runs in WAT (dispatched
// by api id with stdcall frames on the guest stack), WAT lowers it into GPS
// records, and a test gpu_stream_kick drains them into the software executor
// (lib/gpu-stream-software.js). Pixels are checked against values derived from
// Glide semantics (SDK headers, the WAT handler comments), never against what
// the executor happens to produce. Inputs are chosen so every expected pixel
// is exact.
//
// Replaces test-glide-software.js, test-glide-backend.js and
// test-glide-readback-stats.js (lib/glide-software.js / lib/glide-backend.js).
//
// A WAT trap or an executor throw poisons the ring (error_code stays set and
// every later kick traps), so each fail-fast case ends its own session:
//   A  Glide 2, double buffered      ... ends with fog_flags (executor throw)
//   B  Glide 2, single buffered      ... ends with a TMU-overflowing grTexSource
//   C  Glide 3, two TMUs             ... ends with a depth-local color combine
const assert = require('assert');
const { compileSrcWasm } = require('./compile-src');
const regions = require('../lib/region-map.generated');
const table = require('../src/api_table.json');
const GS = require('../lib/gpu-stream');
const { Executor } = require('../lib/gpu-stream-software');

const bytes = compileSrcWasm((file, source) => file === '09a8h-glide.wat'
  ? source + '\n(export "glide_test_dispatch" (func $dispatch_api_table))\n' : source);
const module_ = new WebAssembly.Module(bytes);

const f32bits = x => { const b = Buffer.alloc(4); b.writeFloatLE(x); return b.readUInt32LE(); };
const api = name => { const a = table.find(x => x.name === name); assert(a, 'api ' + name); return a; };

// Guest scratch (inside the image window, below the heap at 0x420000).
const G = {
  vtx: 0x410000,     // three 60-byte Glide 2 vertices / Glide 3 vertices
  info: 0x410200,    // GrTexInfo (20 bytes)
  lfb: 0x410240,     // GrLfbInfo
  fog: 0x410280,     // 64-byte fog table
  src: 0x410300,     // LFB write source / read destination
  pal: 0x411000,     // 256 x u32 palette
  tex: 0x412000,     // texel data
  gamma: 0x413000,   // three u32[256] gamma tables
};

function session(name) {
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const imports = { host: { memory } };
  for (const imp of WebAssembly.Module.imports(module_))
    if (imp.kind === 'function') (imports[imp.module] ||= {})[imp.name] = () => 0;
  imports.host.math_pow = Math.pow;
  imports.host.math_pow2 = x => 2 ** x;
  imports.host.get_ticks = () => 0;
  const S = { name, frames: [], ex: null, ring: null, ringAddr: 0, clock: 0, kicks: 0, closedStats: null };
  imports.host.gpu_stream_kick = (ring, mode) => {
    ring >>>= 0;
    S.kicks++;
    if (!S.ex) S.ex = new Executor({
      getExports: () => S.e, getMemory: () => memory.buffer,
      presentPixels: frame => S.frames.push(frame),
      // A deterministic clock: every reading advances 10 ms, so each timed
      // section (one start, one end reading) costs exactly 10 ms.
      nowMs: () => (S.clock += 10),
    });
    if (!S.ring || S.ringAddr !== ring) { S.ring = new GS.Ring(() => memory.buffer, ring); S.ringAddr = ring; }
    GS.drain([S.ring], S.ex);
    if ((mode | 0) === GS.CONST.KICK_CLOSE) {
      S.closedStats = S.ex.stats(); S.ex.close(); S.ex = null; S.ring = null; S.ringAddr = 0;
    }
    return 1;
  };
  const e = S.e = new WebAssembly.Instance(module_, imports).exports;
  e.init_thread(0, 0x400000, 0, 0, 0, 0, 0);
  e.heap_init(0x420000);
  const view = new DataView(memory.buffer);
  const stack = regions.BASE.GUEST_STACK + 0x1000;
  const stackGuest = (stack - regions.BASE.GUEST_BASE + 0x400000) >>> 0;
  const wa = p => e.guest_to_wasm(p) >>> 0;
  S.call = (fn, args = []) => {
    const a = api(fn);
    e.set_esp(stackGuest);
    args.forEach((v, i) => view.setUint32(stack + 4 + i * 4, v >>> 0, true));
    e.glide_test_dispatch(a.id, ...Array.from({ length: 5 }, (_, i) => args[i] || 0), 0);
    assert.strictEqual(e.get_esp() >>> 0, stackGuest + 4 + a.nargs * 4, fn + ' pops its stdcall frame');
    return e.get_eax() >>> 0;
  };
  S.f32 = (p, v) => view.setFloat32(wa(p), v, true);
  S.u32 = (p, v) => view.setUint32(wa(p), v >>> 0, true);
  S.u16 = (p, v) => view.setUint16(wa(p), v, true);
  S.u8 = (p, v) => view.setUint8(wa(p), v);
  S.r16 = p => view.getUint16(wa(p), true);
  S.r32 = p => view.getUint32(wa(p), true);
  S.stats = () => S.ex.stats();
  // Raw RT contents (pre-gamma, real alpha) of the executor's current target.
  S.raw = (x, y, id) => {
    const r = S.ex.res.get(id || S.ex.target.color);
    const img = S.ex.native.readColor(S.ex._colorRes(r));
    const o = y * img.pitch + x * 4;
    return [img.pixels[o + 2], img.pixels[o + 1], img.pixels[o], img.pixels[o + 3]];
  };
  S.rgb = (x, y) => S.raw(x, y).slice(0, 3);
  S.framePx = (frame, x, y) => Array.from(frame.pixels.subarray((y * frame.width + x) * 4, (y * frame.width + x) * 4 + 4));
  S.idle = () => S.call('_grSstIdle@0');
  return S;
}

// Glide 2 GrVertex: x y z r g b ooz a oow sow0 tow0 oow0 sow1 tow1 oow1.
function g2vertex(S, p, v) {
  const oow = v.oow === undefined ? 1 : v.oow;
  [v.x, v.y, 0, v.r || 0, v.g || 0, v.b || 0, v.ooz || 0, v.a === undefined ? 255 : v.a, oow,
    v.s0 || 0, v.t0 || 0, v.w0 === undefined ? oow : v.w0, v.s1 || 0, v.t1 || 0, v.w1 === undefined ? oow : v.w1]
    .forEach((f, i) => S.f32(p + i * 4, f));
}
function tri(S, a, b, c) {
  [a, b, c].forEach((v, i) => g2vertex(S, G.vtx + i * 60, v));
  S.call('_grDrawTriangle@12', [G.vtx, G.vtx + 60, G.vtx + 120]);
}
// Right triangle (0,0),(n,0),(0,n) sharing everything but position.
const RT = (n, v, per = [{}, {}, {}]) =>
  [{ x: 0, y: 0 }, { x: n, y: 0 }, { x: 0, y: n }].map((p, i) => Object.assign({}, v, per[i], p));
const RED = { r: 255 }, GREEN = { g: 255 }, BLUE = { b: 255 };

function texinfo(S, small, large, aspect, format, data) {
  [small, large, aspect, format, data].forEach((v, i) => S.u32(G.info + i * 4, v));
}
// Download and select a single-level texture at TMU RAM `start`.
function texture(S, tmu, start, lod, aspect, format, texels) {
  const wide = format >= 8;
  texels.forEach((t, i) => wide ? S.u16(G.tex + i * 2, t) : S.u8(G.tex + i, t));
  texinfo(S, lod, lod, aspect, format, G.tex);
  S.call('_grTexDownloadMipMap@16', [tmu, start, 3, G.info]);
  S.call('_grTexSource@16', [tmu, start, 3, G.info]);
}
function lfbLock(S, type, buffer, origin) {
  assert.strictEqual(S.call('_grLfbLock@24', [type, buffer, 0, origin, 0, G.lfb]), 1, 'grLfbLock');
  return { ptr: S.r32(G.lfb + 4), stride: S.r32(G.lfb + 8), origin: S.r32(G.lfb + 16) };
}
const check = [];
function ok(label, fn) { fn(); check.push(label); }

// ============================================================================
// Session A: Glide 2, 320x240, upper-left origin, double buffered.
// ============================================================================
{
  const S = session('A');
  const { call } = S;
  call('_grGlideInit@0');
  assert.strictEqual(call('_grSstWinOpen@28', [0, 1, 0, 0, 0, 2, 1]), 1, 'grSstWinOpen 320x240 2 buffers');
  assert.strictEqual(call('_grSstScreenWidth@0'), 320);
  assert.strictEqual(call('_grSstScreenHeight@0'), 240);
  const clear = (color = 0, alpha = 255, depth = 65535) => call('_grBufferClear@12', [color, alpha, depth]);

  ok('half-open pixel-centre coverage', () => {
    clear();
    tri(S, ...RT(2.25, RED));
    S.idle();
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++)
      assert.deepStrictEqual(S.rgb(x, y), x + y <= 1 ? [255, 0, 0] : [0, 0, 0], `coverage ${x},${y}`);
  });

  ok('vertex color interpolation', () => {
    clear();
    tri(S, ...RT(4, {}, [{}, { r: 128 }, {}]));
    S.idle();
    // Pixel centre (1.5,1.5): barycentric weight of (4,0) is 1.5/4 = .375 -> 48.
    assert.deepStrictEqual(S.rgb(1, 1), [48, 0, 0]);
  });

  ok('Z buffer: D16 quantization, LEQUAL and LESS', () => {
    call('_grDepthBufferMode@4', [1]);
    call('_grDepthBufferFunction@4', [3]);       // GR_CMP_LEQUAL
    clear();
    tri(S, ...RT(16, { r: 255, ooz: 16384.2 }));
    tri(S, ...RT(16, { g: 255, ooz: 16384.4 }));  // same D16 value -> passes LEQUAL
    S.idle();
    assert.deepStrictEqual(S.rgb(2, 2), [0, 255, 0], 'equal D16 passes LEQUAL');
    tri(S, ...RT(16, { b: 255, ooz: 16385.2 }));
    S.idle();
    assert.deepStrictEqual(S.rgb(2, 2), [0, 255, 0], 'farther D16 fails LEQUAL');
    call('_grDepthBufferFunction@4', [1]);       // GR_CMP_LESS
    clear();
    tri(S, ...RT(16, { r: 255, ooz: 16384.4 }));
    tri(S, ...RT(16, { g: 255, ooz: 16384.2 }));
    S.idle();
    assert.deepStrictEqual(S.rgb(2, 2), [255, 0, 0], 'equal D16 fails LESS');
    clear();
    tri(S, ...RT(16, { r: 255, ooz: 1000 }));
    tri(S, ...RT(16, { g: 255, ooz: 2000 }));
    S.idle();
    assert.deepStrictEqual(S.rgb(2, 2), [255, 0, 0], 'farther Z rejected');
    tri(S, ...RT(16, { b: 255, ooz: 500 }));
    S.idle();
    assert.deepStrictEqual(S.rgb(2, 2), [0, 0, 255], 'nearer Z wins');
  });

  ok('SCALE_OTHER x ONE passes iterated color exactly', () => {
    call('_grDepthBufferMode@4', [0]);
    call('_grColorCombine@20', [3, 8, 0, 0, 0]);
    clear();
    tri(S, ...RT(16, { r: 128, g: 64, b: 32 }));
    S.idle();
    assert.deepStrictEqual(S.rgb(2, 2), [128, 64, 32]);
    call('_grColorCombine@20', [1, 0, 0, 0, 0]);
  });

  ok('W buffer from oow', () => {
    call('_grDepthBufferMode@4', [2]);
    call('_grDepthBufferFunction@4', [1]);
    clear();
    tri(S, ...RT(16, { r: 255, oow: 0.5 }));
    tri(S, ...RT(16, { g: 255, oow: 0.25 }));    // w=4, farther than w=2
    S.idle();
    assert.deepStrictEqual(S.rgb(2, 2), [255, 0, 0], 'farther W rejected');
    tri(S, ...RT(16, { b: 255, oow: 0.75 }));
    S.idle();
    assert.deepStrictEqual(S.rgb(2, 2), [0, 0, 255], 'nearer W wins');
    // With the W_DIFF_TMU0 hint, oow0 drives texturing only; depth stays oow.
    call('_grHints@8', [0, 2]);
    clear();
    tri(S, ...RT(16, { r: 255, w0: 0.25 }, [{ oow: 1 }, { oow: 0.25 }, { oow: 0.25 }]));
    tri(S, ...RT(16, { g: 255, oow: 0.65, w0: 0.65 }));
    S.idle();
    // (3.5,3.5): oow = 9/16*1 + 7/16*.25 = .671875 > .65 -> green is farther.
    assert.deepStrictEqual(S.rgb(3, 3), [255, 0, 0], 'interpolated oow depth, not oow0');
    // (12.5,1.5): oow = .125 + .875*.25 = .34375 < .65 -> green is nearer.
    assert.deepStrictEqual(S.rgb(12, 1), [0, 255, 0], 'green wins where it is nearer');
    call('_grHints@8', [0, 0]);
  });

  ok('table fog indexed by w', () => {
    call('_grDepthBufferMode@4', [0]);
    for (let i = 0; i < 64; i++) S.u8(G.fog + i, i === 4 ? 255 : 0);
    call('_grFogTable@4', [G.fog]);
    call('_grFogColorValue@4', [0x000000FF]);
    call('_grFogMode@4', [2]);
    clear();
    // Entry 4 is w = 2^(3+1)/(8-0) = 2, i.e. oow .5: full fog.
    tri(S, ...RT(16, { r: 255, oow: 0.5 }));
    S.idle();
    assert.deepStrictEqual(S.rgb(2, 2), [0, 0, 255]);
    call('_grFogMode@4', [0]);
  });

  ok('iterated-Z fog', () => {
    call('_grDepthBufferMode@4', [2]);
    call('_grDepthBufferFunction@4', [7]);
    call('_grFogMode@4', [3]);
    clear();
    tri(S, ...RT(16, { r: 255, ooz: 65535 }));
    S.idle();
    assert.deepStrictEqual(S.rgb(2, 2), [0, 0, 255], 'z 65535 -> fog 255');
    tri(S, ...RT(16, { r: 255, ooz: 0 }));
    S.idle();
    assert.deepStrictEqual(S.rgb(2, 2), [255, 0, 0], 'z 0 -> no fog');
    call('_grFogMode@4', [0]);
    call('_grDepthBufferMode@4', [0]);
    call('_grDepthBufferFunction@4', [1]);
  });

  // Texture output: color and alpha are the texel (SCALE_OTHER x ONE, other
  // = texture). TMU0 defaults to LOCAL.
  const textured = () => {
    call('_grColorCombine@20', [3, 8, 1, 1, 0]);
    call('_grAlphaCombine@20', [3, 8, 1, 1, 0]);
  };
  const untextured = () => {
    call('_grColorCombine@20', [1, 0, 0, 0, 0]);
    call('_grAlphaCombine@20', [1, 0, 0, 0, 0]);
  };

  ok('P8 palette and palette replacement', () => {
    textured();
    for (let i = 0; i < 256; i++) S.u32(G.pal + i * 4, 0);
    S.u32(G.pal + 7 * 4, 0x00ff0000);
    call('_grTexDownloadTable@12', [0, 2, G.pal]);
    texture(S, 0, 0, 5, 3, 5, new Array(64).fill(7));
    clear();
    tri(S, ...RT(16, {}));
    S.idle();
    assert.deepStrictEqual(S.raw(2, 2), [255, 0, 0, 255], 'palette entry 7 red');
    S.u32(G.pal + 7 * 4, 0x0000ff00);
    call('_grTexDownloadTable@12', [0, 2, G.pal]);
    tri(S, ...RT(16, {}));
    S.idle();
    assert.deepStrictEqual(S.raw(2, 2), [0, 255, 0, 255], 'replaced palette re-decodes P8');
  });

  ok('chroma key compares RGB OTHER', () => {
    untextured();
    clear(0x000000FF);
    call('_grChromakeyValue@4', [0x0000FF00]);
    call('_grChromakeyMode@4', [1]);
    tri(S, ...RT(16, GREEN));
    S.idle();
    assert.deepStrictEqual(S.rgb(2, 2), [0, 0, 255], 'keyed green rejected');
    tri(S, ...RT(16, RED));
    S.idle();
    assert.deepStrictEqual(S.rgb(2, 2), [255, 0, 0], 'unkeyed red drawn');
    call('_grChromakeyMode@4', [0]);
  });

  ok('texture formats decode', () => {
    textured();
    // [format, texel, expected r,g,b,a]; channels expand as round(v*255/max).
    const cases = [
      [0, 0xA9, [182, 73, 85, 255]],      // RGB332 101 010 01
      [3, 0x40, [64, 64, 64, 255]],       // INTENSITY8
      [4, 0x5A, [170, 170, 170, 85]],     // AI44
      [5, 0x07, [0, 255, 0, 255]],        // P8 (palette[7] green)
      [8, 0x80A9, [182, 73, 85, 128]],    // ARGB8332
      [10, 0x07E0, [0, 255, 0, 255]],     // RGB565
      [10, 0x8410, [132, 130, 132, 255]], // RGB565 mid grey
      [11, 0x7C00, [255, 0, 0, 0]],       // ARGB1555, alpha bit clear
      [11, 0x83E0, [0, 255, 0, 255]],     // ARGB1555, alpha bit set
      [12, 0x5A3C, [170, 51, 204, 85]],   // ARGB4444
      [13, 0x40C0, [192, 192, 192, 64]],  // AI88
      [14, 0x4007, [0, 255, 0, 64]],      // AP88 (palette[7] green)
    ];
    for (const [format, texel, want] of cases) {
      texture(S, 0, 0, 5, 3, format, new Array(64).fill(texel));  // same start: invalidation
      clear(0, 0);
      tri(S, ...RT(16, {}));
      S.idle();
      assert.deepStrictEqual(S.raw(2, 2), want, `format ${format} texel 0x${texel.toString(16)}`);
    }
    // ALPHA8: alpha is the texel. (RGB is not asserted: WAT decodes it as
    // 255, MAME's Voodoo replicates the texel; the SDK leaves it open.)
    texture(S, 0, 0, 5, 3, 2, new Array(64).fill(0x40));
    clear(0, 0);
    tri(S, ...RT(16, {}));
    S.idle();
    assert.strictEqual(S.raw(2, 2)[3], 64, 'ALPHA8 alpha');
  });

  ok('nominal texel addressing and TMU RAM overwrite', () => {
    textured();
    const texels = [0xF800, 0x07E0, 0x001F, 0xFFFF];   // 2x2: red green / blue white
    texture(S, 0, 0, 7, 3, 10, texels);
    clear();
    // s 192/256 * 2 = 1.5 -> column 1; t 32/256 * 2 = .25 -> row 0.
    tri(S, ...RT(16, { s0: 192, t0: 32 }));
    S.idle();
    assert.deepStrictEqual(S.rgb(2, 2), [0, 255, 0], 'texel (1,0)');
    texels[1] = 0x001F;
    texture(S, 0, 0, 7, 3, 10, texels);
    tri(S, ...RT(16, { s0: 192, t0: 32 }));
    S.idle();
    assert.deepStrictEqual(S.rgb(2, 2), [0, 0, 255], 'rewritten TMU RAM re-decodes');
  });

  ok('perspective-correct texturing', () => {
    textured();
    texture(S, 0, 0, 7, 2, 10, [0xF800, 0x07E0]);       // 2x1: red green
    clear();
    tri(S, ...RT(16, {}, [{ oow: 1 }, { oow: 0.25, s0: 64 }, { oow: 0.25 }]));
    S.idle();
    // (10.5,2.5): s/w = .65625*.25 = .1640625, 1/w = .1875 + .8125*.25 = .390625,
    // s = .42 -> texel 0 (red). Affine s would be .65625 -> texel 1 (green).
    assert.deepStrictEqual(S.rgb(10, 2), [255, 0, 0]);
    untextured();
  });

  ok('lines, points and degenerate lines', () => {
    clear();
    g2vertex(S, G.vtx, { x: 0, y: 3.5, r: 255 });
    g2vertex(S, G.vtx + 60, { x: 16, y: 3.5, r: 255 });
    call('_grDrawLine@8', [G.vtx, G.vtx + 60]);
    S.idle();
    assert.deepStrictEqual(S.rgb(3, 3), [255, 0, 0], 'line row');
    assert.deepStrictEqual(S.rgb(3, 2), [0, 0, 0], 'line is one pixel thick (above)');
    assert.deepStrictEqual(S.rgb(3, 4), [0, 0, 0], 'line is one pixel thick (below)');
    clear();
    g2vertex(S, G.vtx, { x: 3.5, y: 3.5, g: 255 });
    call('_grDrawPoint@4', [G.vtx]);
    S.idle();
    assert.deepStrictEqual(S.rgb(3, 3), [0, 255, 0], 'point pixel');
    for (const [x, y] of [[2, 3], [4, 3], [3, 2], [3, 4]])
      assert.deepStrictEqual(S.rgb(x, y), [0, 0, 0], `point is one pixel (${x},${y})`);
    const before = S.stats().degenerateLines;
    clear();
    g2vertex(S, G.vtx, { x: 5.5, y: 5.5, b: 255 });
    g2vertex(S, G.vtx + 60, { x: 5.5, y: 5.5, b: 255 });
    call('_grDrawLine@8', [G.vtx, G.vtx + 60]);
    S.idle();
    assert.strictEqual(S.stats().degenerateLines, before + 1, 'zero-length line counted');
    assert.deepStrictEqual(S.rgb(5, 5), [0, 0, 0], 'zero-length line draws nothing');
  });

  ok('cull mode on raw vertex area, independent of origin', () => {
    // Glide's area of (0,0),(16,0),(0,16) is positive; reversed it is negative.
    const pos = RT(16, RED), neg = [pos[0], pos[2], pos[1]];
    for (const origin of [0, 1]) {
      call('_grSstOrigin@4', [origin]);
      const y = origin ? 240 - 1 - 2 : 2;     // raw y 2 on screen
      for (const [mode, vs, drawn] of [[1, pos, true], [1, neg, false], [2, pos, false], [2, neg, true], [0, neg, true]]) {
        call('_grCullMode@4', [mode]);
        clear();
        tri(S, ...vs);
        S.idle();
        assert.deepStrictEqual(S.rgb(2, y), drawn ? [255, 0, 0] : [0, 0, 0],
          `origin ${origin} cull ${mode} ${vs === pos ? 'positive' : 'negative'} area`);
      }
    }
    call('_grCullMode@4', [0]);
    call('_grSstOrigin@4', [0]);
  });

  ok('masked clears inside the clip window', () => {
    clear(0x336699, 204, 65535);
    call('_grClipWindow@16', [2, 2, 6, 6]);
    call('_grDepthMask@4', [0]);
    call('_grColorMask@8', [1, 0]);
    clear(0x112233, 55, 0);
    S.idle();
    assert.deepStrictEqual(S.raw(3, 3), [0x11, 0x22, 0x33, 204], 'rgb-only clear keeps alpha');
    assert.deepStrictEqual(S.raw(5, 5), [0x11, 0x22, 0x33, 204], 'clip max is exclusive (inside)');
    assert.deepStrictEqual(S.raw(6, 6), [0x33, 0x66, 0x99, 204], 'clip max is exclusive (outside)');
    assert.deepStrictEqual(S.raw(0, 0), [0x33, 0x66, 0x99, 204], 'outside the clip window');
    call('_grColorMask@8', [0, 1]);
    clear(0, 77, 0);
    S.idle();
    assert.deepStrictEqual(S.raw(3, 3), [0x11, 0x22, 0x33, 77], 'alpha-only clear');
    call('_grColorMask@8', [0, 0]);
    call('_grDepthMask@4', [1]);
    clear(0xFFFFFF, 0, 32768);
    S.idle();
    assert.deepStrictEqual(S.raw(3, 3), [0x11, 0x22, 0x33, 77], 'depth-only clear keeps color');
    call('_grClipWindow@16', [0, 0, 320, 240]);
    call('_grColorMask@8', [1, 1]);
    call('_grDepthBufferMode@4', [1]);
    tri(S, ...RT(16, { r: 255, ooz: 40000 }));
    S.idle();
    assert.deepStrictEqual(S.rgb(3, 3), [0x11, 0x22, 0x33], 'cleared depth 32768 rejects 40000');
    assert.deepStrictEqual(S.rgb(0, 0), [255, 0, 0], 'uncleared depth 65535 accepts 40000');
    call('_grDepthBufferMode@4', [0]);
  });

  ok('RASTER/CONSTS/BIND are sticky', () => {
    tri(S, ...RT(16, RED));
    S.idle();
    const c0 = S.stats().counts;
    for (let i = 0; i < 3; i++) tri(S, ...RT(16, RED));
    S.idle();
    const c1 = S.stats().counts;
    for (const op of ['RASTER', 'CONSTS', 'BIND', 'SHADER', 'TARGETS'])
      assert.strictEqual(c1[op] || 0, c0[op] || 0, `unchanged state re-emits no ${op}`);
    call('_grConstantColorValue@4', [0xFF123456]);
    tri(S, ...RT(16, RED));
    S.idle();
    const c2 = S.stats().counts;
    assert.strictEqual(c2.CONSTS, (c1.CONSTS || 0) + 1, 'constant color re-emits CONSTS');
    assert.strictEqual(c2.RASTER || 0, c1.RASTER || 0, 'constant color does not re-emit RASTER');
    call('_grDepthMask@4', [0]);
    tri(S, ...RT(16, RED));
    S.idle();
    const c3 = S.stats().counts;
    assert.strictEqual(c3.RASTER, (c2.RASTER || 0) + 1, 'depth mask re-emits RASTER');
    assert.strictEqual(c3.CONSTS, c2.CONSTS, 'depth mask does not re-emit CONSTS');
    call('_grDepthMask@4', [1]);
  });

  ok('swap presents the back buffer', () => {
    clear(0x00FF0000);
    const n = S.frames.length;
    call('_grBufferSwap@4', [0]);
    assert.strictEqual(S.frames.length, n + 1, 'one PRESENT per swap');
    const f = S.frames[n];
    assert.strictEqual(f.width, 320); assert.strictEqual(f.height, 240); assert.strictEqual(f.hwnd, 0);
    assert.deepStrictEqual(S.framePx(f, 0, 0), [255, 0, 0, 255]);
    assert.strictEqual(S.stats().presents, n + 1);
    // The presented buffer is now the front: LFB-read it.
    const lock = lfbLock(S, 0, 0, 0);
    assert.strictEqual(S.r16(lock.ptr), 0xF800, 'front buffer holds the swapped frame');
    call('_grLfbUnlock@8', [0, 0]);
  });

  ok('LFB read/write regions, locks and readback stats', () => {
    clear(0);                                       // back buffer, now the target
    const s0 = S.stats();
    S.u16(G.src, 0x07E0);
    assert.strictEqual(call('_grLfbWriteRegion@32', [1, 3, 3, 0, 1, 1, 2, G.src]), 1, 'grLfbWriteRegion');
    S.idle();
    assert.deepStrictEqual(S.raw(3, 3), [0, 255, 0, 255], 'written RGB565 expands, A=255');
    let lock = lfbLock(S, 0, 1, 0);
    assert.strictEqual(lock.stride, 640);
    assert.strictEqual(lock.origin, 0);
    assert.strictEqual(S.r16(lock.ptr + 3 * 640 + 6), 0x07E0, 'read lock, upper-left');
    assert.strictEqual(S.r16(lock.ptr), 0, 'read lock, background');
    call('_grLfbUnlock@8', [0, 1]);
    lock = lfbLock(S, 0, 1, 1);
    assert.strictEqual(S.r16(lock.ptr + (240 - 1 - 3) * 640 + 6), 0x07E0, 'read lock, lower-left rows reversed');
    call('_grLfbUnlock@8', [0, 1]);
    lock = lfbLock(S, 1, 1, 0);
    S.u16(lock.ptr + 5 * 640 + 10, 0xF800);
    assert.strictEqual(call('_grLfbUnlock@8', [1, 1]), 1);
    S.idle();
    assert.deepStrictEqual(S.raw(5, 5), [255, 0, 0, 255], 'write lock uploads on unlock');
    assert.deepStrictEqual(S.raw(3, 3), [0, 255, 0, 255], 'write lock keeps other pixels');
    assert.strictEqual(call('_grLfbReadRegion@28', [1, 3, 3, 3, 3, 6, G.src]), 1, 'grLfbReadRegion');
    const region = Array.from({ length: 9 }, (_, i) => S.r16(G.src + i * 2));
    assert.deepStrictEqual(region, [0x07E0, 0, 0, 0, 0, 0, 0, 0, 0xF800], 'read region');
    const s1 = S.stats();
    // Five whole-buffer READBACKs (write region, three locks, read region).
    assert.strictEqual(s1.readbacks - s0.readbacks, 5, 'readbacks');
    // A8B8G8R8 readbacks (RGB565 conversion is in the WAT).
    assert.strictEqual(s1.readbackBytes - s0.readbackBytes, 5 * 320 * 240 * 4, 'readback bytes');
    assert.strictEqual(s1.readbackCpuMs - s0.readbackCpuMs, 5 * 10, 'readback cpu ms');
    assert.strictEqual(s1.counts.READBACK - (s0.counts.READBACK || 0), 5, 'READBACK records');
  });

  ok('front buffer rendering, activation and gamma', () => {
    call('_grRenderBuffer@4', [0]);
    clear(0x404040);
    let n = S.frames.length;
    S.idle();
    assert.strictEqual(S.frames.length, n + 1, 'front clear presented at flush without a swap');
    assert.deepStrictEqual(S.framePx(S.frames[n], 0, 0), [64, 64, 64, 255]);
    call('_grGammaCorrectionValue@4', [f32bits(2.0)]);
    n = S.frames.length;
    S.idle();
    assert.strictEqual(S.frames.length, n + 1, 'gamma change re-presents');
    // floor(255 * (64/255)^(1/2) + .5) = 128
    assert.deepStrictEqual(S.framePx(S.frames[n], 0, 0), [128, 128, 128, 255], 'gamma 2.0 display');
    assert.deepStrictEqual(S.rgb(0, 0), [64, 64, 64], 'gamma does not touch the buffer');
    call('_grSstControl@4', [2]);
    n = S.frames.length;
    tri(S, ...RT(16, { r: 64, g: 64, b: 64, a: 0 }));
    S.idle();
    assert.strictEqual(S.frames.length, n, 'inactive board does not present');
    call('_grSstControl@4', [1]);
    S.idle();
    assert.strictEqual(S.frames.length, n + 1, 'reactivation presents pending front work');
    assert.strictEqual(S.raw(2, 2)[3], 0, 'buffer alpha 0');
    assert.strictEqual(S.framePx(S.frames[n], 2, 2)[3], 255, 'display alpha forced opaque');
    // A 200-grey patch away from the origin.
    tri(S, { x: 20, y: 0, r: 200, g: 200, b: 200 }, { x: 40, y: 0, r: 200, g: 200, b: 200 }, { x: 20, y: 20, r: 200, g: 200, b: 200 });
    call('_guGammaCorrectionRGB@12', [f32bits(2), f32bits(1), f32bits(0.5)]);
    n = S.frames.length;
    S.idle();
    // 64 -> [128, 64, floor(255*(64/255)^2+.5)=16]; 200 -> [226, 200, 157].
    assert.deepStrictEqual(S.framePx(S.frames[n], 0, 0), [128, 64, 16, 255], 'per-channel gamma at 64');
    assert.deepStrictEqual(S.framePx(S.frames[n], 21, 1), [226, 200, 157, 255], 'per-channel gamma at 200');
    for (let i = 0; i < 65; i++) {
      S.u32(G.gamma + i * 4, i === 64 ? 7 : i);
      S.u32(G.gamma + 1024 + i * 4, i === 64 ? 8 : i);
      S.u32(G.gamma + 2048 + i * 4, i === 64 ? 9 : i);
    }
    call('_grLoadGammaTable@16', [65, G.gamma, G.gamma + 1024, G.gamma + 2048]);
    n = S.frames.length;
    S.idle();
    assert.deepStrictEqual(S.framePx(S.frames[n], 0, 0), [7, 8, 9, 255], 'loaded table entry 64');
    assert.deepStrictEqual(S.framePx(S.frames[n], 21, 1), [226, 200, 157, 255], 'entries past n keep the ramp');
    const lock = lfbLock(S, 0, 0, 0);
    assert.strictEqual(S.r16(lock.ptr), 0x4208, 'LFB reads the pre-gamma buffer');
    call('_grLfbUnlock@8', [0, 0]);
    call('_grRenderBuffer@4', [1]);
  });

  ok('fog_flags fail fast in the executor', () => {
    call('_grFogMode@4', [2 | 0x100]);
    tri(S, ...RT(16, RED));
    assert.throws(() => S.idle(), /fog_flags/);
  });
  console.log(`session A: ${S.frames.length} presents, ${S.kicks} kicks`);
}

// ============================================================================
// Session B: Glide 2, single buffered.
// ============================================================================
{
  const S = session('B');
  const { call } = S;
  call('_grGlideInit@0');
  assert.strictEqual(call('_grSstWinOpen@28', [0, 1, 0, 0, 0, 3, 1]), 0, 'triple buffering is refused');
  assert.strictEqual(call('_grSstWinOpen@28', [0, 1, 0, 0, 0, 1, 1]), 1, 'single-buffered open');
  ok('single buffer: never-written TMU RAM reads 0, swap only presents', () => {
    call('_grBufferClear@12', [0x000000FF, 255, 65535]);
    call('_grColorCombine@20', [3, 8, 1, 1, 0]);
    texinfo(S, 5, 5, 3, 10, G.tex);
    call('_grTexSource@16', [0, 0x100, 3, G.info]);
    tri(S, ...RT(16, {}));
    S.idle();
    assert.deepStrictEqual(S.raw(2, 2), [0, 0, 0, 255], 'unwritten TMU RAM is black');
    assert.deepStrictEqual(S.raw(100, 100), [0, 0, 255, 255]);
    const target = S.ex.target.color;
    call('_grBufferSwap@4', [0]);
    const f = S.frames[S.frames.length - 1];
    assert.deepStrictEqual(S.framePx(f, 2, 2), [0, 0, 0, 255]);
    assert.deepStrictEqual(S.framePx(f, 100, 100), [0, 0, 255, 255]);
    tri(S, ...RT(16, {}).map(v => Object.assign(v, { x: v.x + 50 })));
    S.idle();
    assert.strictEqual(S.ex.target.color, target, 'single buffer: one render target');
    assert.deepStrictEqual(S.raw(100, 100), [0, 0, 255, 255], 'swap keeps the buffer');
    assert.deepStrictEqual(S.raw(52, 2), [0, 0, 0, 255], 'draws after swap land on the same buffer');
  });
  ok('grTexSource past 4 MiB traps', () => {
    texinfo(S, 0, 0, 3, 10, G.tex);             // 256x256 RGB565 = 128 KiB
    assert.throws(() => call('_grTexSource@16', [0, 0x3F0000, 3, G.info]), WebAssembly.RuntimeError);
  });
}

// ============================================================================
// Session C: Glide 3, two TMUs.
// ============================================================================
{
  const S = session('C');
  const { call } = S;
  call('glide3_grGlideInit');
  assert.notStrictEqual(call('_grSstWinOpen@28', [0, 1, 0, 0, 0, 2, 1]), 0, 'Glide 3 open');
  // XY Q RGB A ST0 Q0 ST1 Q1, 52-byte window-coordinate vertex.
  for (const [param, offset] of [[1, 0], [4, 8], [32, 12], [16, 24], [64, 28], [80, 36], [65, 40], [81, 48]])
    call('_grVertexLayout@12', [param, offset, 1]);
  const vert = (p, v) => [v.x, v.y, 1, 255, 255, 255, 255, v.s0, 0, v.q0, v.s1, 0, v.q1]
    .forEach((f, i) => S.f32(p + i * 4, f));
  const draw = (s0, q0, s1, q1) => {
    [[0, 0], [16, 0], [0, 16]].forEach(([x, y], i) => vert(G.vtx + i * 64, { x, y, s0, q0, s1, q1 }));
    call('_grDrawTriangle@12', [G.vtx, G.vtx + 64, G.vtx + 128]);
  };
  // Glide 3 enums: 2x2 is LOD_LOG2_2 (1), ASPECT_LOG2_1x1 (0).
  const upload = (tmu, texels, start = 0) => {
    texels.forEach((t, i) => S.u16(G.tex + i * 2, t));
    texinfo(S, 1, 1, 0, 10, G.tex);
    call('_grTexDownloadMipMap@16', [tmu, start, 3, G.info]);
    call('_grTexSource@16', [tmu, start, 3, G.info]);
  };
  const sample = (s0 = 0, q0 = 1, s1 = 192, q1 = 1) => {
    call('_grBufferClear@12', [0, 255, 65535]);
    draw(s0, q0, s1, q1);
    S.idle();
    return S.rgb(2, 2);
  };
  call('_grColorCombine@20', [3, 8, 0, 1, 0]);      // output = texture
  call('_grAlphaCombine@20', [1, 0, 0, 0, 0]);
  call('_grTexCombine@28', [0, 3, 1, 3, 1, 0, 0]);  // TMU0 = TMU1 * local
  call('_grTexCombine@28', [1, 1, 0, 1, 0, 0, 0]);  // TMU1 = local
  ok('two-TMU multiply', () => {
    upload(0, [0xFFE0, 0, 0, 0]);                   // yellow at s 0
    upload(1, [0xF800, 0x07FF, 0, 0]);              // cyan at s .75
    assert.deepStrictEqual(sample(), [0, 255, 0], 'yellow * cyan');
  });
  ok('TMU1 upload leaves TMU0 alone', () => {
    upload(1, [0xF800, 0xF81F, 0, 0]);
    assert.deepStrictEqual(sample(), [255, 0, 0], 'yellow * magenta');
  });
  ok('TMU0 SCALE_OTHER x ONE passes TMU1 through', () => {
    call('_grTexCombine@28', [0, 3, 8, 3, 8, 0, 0]);
    texinfo(S, 1, 1, 0, 10, G.tex);
    call('_grTexSource@16', [0, 4096, 3, G.info]);  // never downloaded, never sampled
    assert.deepStrictEqual(sample(), [255, 0, 255], 'magenta passthrough');
  });
  ok('TMU0 SCALE_OTHER_ADD_LOCAL saturates', () => {
    upload(0, [0xFFE0, 0, 0, 0]);
    call('_grTexCombine@28', [0, 4, 8, 1, 0, 0, 0]);
    assert.deepStrictEqual(sample(), [255, 255, 255], 'yellow + magenta');
  });
  ok('independent Q0 and Q1', () => {
    call('_grTexCombine@28', [0, 3, 1, 1, 0, 0, 0]);
    upload(0, [0, 0xFFE0, 0, 0]);
    upload(1, [0x07FF, 0xF81F, 0, 0]);
    // S0/Q0 = (96/256)/.5 = .75 -> yellow; S1/Q1 = (192/256)/2 = .375 -> cyan.
    assert.deepStrictEqual(sample(96, 0.5, 192, 2), [0, 255, 0], 'yellow * cyan via distinct Q');
  });
  ok('TMU1 clamps before invert', () => {
    upload(0, [0x8410, 0x8410, 0x8410, 0x8410]);
    upload(1, [0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF]);
    // TMU1: (0 - local) * local clamps to 0, inverted to 1; TMU0: 1 * 0x8410.
    call('_grTexCombine@28', [1, 6, 1, 1, 0, 1, 0]);
    call('_grTexCombine@28', [0, 3, 1, 1, 0, 0, 0]);
    assert.deepStrictEqual(sample(), [132, 130, 132]);
  });
  ok('depth-local color combine fails fast', () => {
    call('_grColorCombine@20', [1, 0, 2, 0, 0]);
    assert.throws(() => { draw(0, 1, 192, 1); S.idle(); }, WebAssembly.RuntimeError);
  });
}

console.log(`PASS test-glide-gps-software: ${check.length} checks`);
for (const c of check) console.log('  ok ' + c);
