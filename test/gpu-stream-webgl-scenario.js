'use strict';
// tl;dr: the GPU stream v2 WebGL executor pixel scenario, shared by Node
// (test/test-gpu-stream-webgl.js, headless GL = desktop GLSL) and real Chrome
// (test/test-glide-web.js, ESSL1 + ESSL3). It writes Glide-shaped records with
// a producer (test/gpu-stream-fixture.js makeProducer), drains them into the
// executor, and checks pixels via PRESENT (frame.pixels) and READBACK.
//
//   const r = GpuStreamWebGLScenario.run({ GS, makeProducer, Executor, canvas, backend,
//                                          buffer, readSurface });
//   r.failures -> [string], r.checks -> n, r.stats -> executor stats
//
// `buffer` is the producer memory (ArrayBuffer or SharedArrayBuffer, >= 4 MB).
// `readSurface(surface, x, y)` (optional) reads the published present surface.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GpuStreamWebGLScenario = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  const W = 64, H = 64;

  // ── shader IR (src/09a8h-glide.wat $glide_ir_* / $gps_ir_operand format) ──
  const OPC = { MOV: 1, MUL: 5, TEXLD: 66 };
  function irShader(instrs) {
    const bytes = new Uint8Array(32 + instrs.length * 128);
    const dv = new DataView(bytes.buffer);
    const u32 = (o, v) => dv.setUint32(o, v >>> 0, true);
    u32(0, 0x44534952); u32(4, 1); u32(8, 1); u32(12, 0xffff0104);
    u32(16, instrs.length); u32(20, instrs.length + 2); u32(24, bytes.length); u32(28, 1);
    instrs.forEach(([op, ...toks], i) => {
      const p = 32 + i * 128;
      u32(p, op); u32(p + 4, i + 1); u32(p + 8, toks.length); u32(p + 12, 0);
      toks.forEach((tok, j) => {
        const q = p + 16 + j * 16;
        u32(q, (tok >>> 28) & 7); u32(q + 4, tok & 2047);
        if (j === 0) { u32(q + 8, (tok >>> 16) & 15); u32(q + 12, ((tok >>> 20) & 1) | (((tok >>> 24) & 15) << 8)); }
        else { u32(q + 8, (tok >>> 16) & 255); u32(q + 12, (tok >>> 24) & 15); }
      });
    });
    return bytes;
  }
  const R0 = 0x800F0000, R1 = 0x800F0001, R0S = 0x801F0000; // r0, r1, r0_sat (all channels)
  const SRC_R0 = 0x80E40000, SRC_R1 = 0x80E40001, V0 = 0x90E40000, T0DW = 0xBAE40000, T1DW = 0xBAE40001;
  const FLAT_IR = irShader([[OPC.MOV, R0S, V0]]);
  const TEX_IR = irShader([[OPC.TEXLD, R0, T0DW], [OPC.MUL, R0S, SRC_R0, V0]]);
  const TWO_IR = irShader([[OPC.TEXLD, R0, T0DW], [OPC.TEXLD, R1, T1DW], [OPC.MUL, R0S, SRC_R0, SRC_R1]]);

  function run(opts) {
    const { GS, makeProducer, Executor, canvas, backend, buffer, readSurface } = opts;
    const { CONST } = GS;
    const failures = [];
    let checks = 0;
    const check = (name, ok, detail) => {
      checks++;
      if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`);
    };

    let lastFrame = null;
    const ex = new Executor({ canvas, backend, onPresent: (f) => {
      lastFrame = { w: f.width, h: f.height, hwnd: f.hwnd, surface: f.surface, px: f.pixels.slice() };
    } });
    const p = makeProducer({ ringBytes: 1 << 16, arenaBytes: 1 << 20, buffer });
    const ring = p.ring();
    const drain = () => GS.drain([ring], ex);
    const emit = (op, fields, tail) => p.emit(op, fields, tail);
    const arenaPut = (bytes) => {
      const pos = p.arenaAlloc(bytes.length);
      p.arenaView(pos, bytes.length).set(bytes);
      return pos;
    };
    // The fixture never frees arena space; release it once drained.
    const reclaim = () => p.store('arena_tail', p.load('arena_head'));
    const i32s = (...v) => new Uint8Array(new Int32Array(v).buffer);

    const ID = { RT: 1, DS: 2, LAYOUT: 3, FLAT: 4, TEX: 5, SAMP: 6, TEXA: 7, FOG: 8, LUT: 9,
      MIP: 10, SAMPMIP: 11, TWO: 12, TEXB: 13, SAMPWRAP: 14 };

    try {
      emit('CREATE', { id: ID.RT, kind: CONST.KIND_RT, fmt: CONST.FMT_A8B8G8R8, levels: 1, width: W, height: H });
      emit('CREATE', { id: ID.DS, kind: CONST.KIND_DS, fmt: CONST.FMT_D16, levels: 1, width: W, height: H });
      const elems = new Uint8Array(4 * 8);
      const edv = new DataView(elems.buffer);
      [[CONST.USAGE_POSITIONT, 0], [CONST.USAGE_COLOR, 0], [CONST.USAGE_TEXCOORD, 0], [CONST.USAGE_TEXCOORD, 1]]
        .forEach(([usage, index], i) => {
          edv.setUint8(i * 8 + 1, CONST.VTYPE_FLOAT4); edv.setUint8(i * 8 + 2, usage); edv.setUint8(i * 8 + 3, index);
          edv.setUint16(i * 8 + 4, i * 16, true);
        });
      emit('LAYOUT', { id: ID.LAYOUT, count: 4, stride: 64 }, elems);
      emit('SHADER', { id: ID.FLAT, stage: 1, ir_bytes: FLAT_IR.length }, FLAT_IR);
      emit('SHADER', { id: ID.TEX, stage: 1, ir_bytes: TEX_IR.length }, TEX_IR);
      emit('SHADER', { id: ID.TWO, stage: 1, ir_bytes: TWO_IR.length }, TWO_IR);
      emit('SAMPLER', { id: ID.SAMP, address_u: 3, address_v: 3, min: 1, mag: 1, mip: 0, lod_bias: 0 });
      emit('SAMPLER', { id: ID.SAMPWRAP, address_u: 1, address_v: 1, min: 1, mag: 1, mip: 0, lod_bias: 0 });
      emit('SAMPLER', { id: ID.SAMPMIP, address_u: 1, address_v: 1, min: 1, mag: 1, mip: 1, lod_bias: 0 });
      emit('TARGETS', { color: ID.RT, depth: ID.DS });
      const consts = new Float32Array(20); consts.set([1, 1, 1, 1], 4); consts.fill(0.5 / 255, 16, 20);
      emit('CONSTS', { stage: 1, first: 0, count: 5 }, new Uint8Array(consts.buffer));
      drain();
      check('canvas sized from RT CREATE', canvas.width === W && canvas.height === H, `${canvas.width}x${canvas.height}`);

      const BASE_RASTER = {
        depth_mode: 0, zfunc: 8, zwrite: 0, cull: 1, blend: 0, src_rgb: 2, dst_rgb: 1, src_alpha: 2, dst_alpha: 1,
        alpha_func: 8, alpha_ref: 0, colormask: 15, fog_mode: 0, fog_flags: 0, fill: 3, fog_color: 0, fog_table: 0,
        depth_bias: 0, scissor_left: 0, scissor_top: 0, scissor_right: W, scissor_bottom: H,
      };
      const raster = (o) => emit('RASTER', Object.assign({}, BASE_RASTER, o));
      const clear = (rgba, o = {}) =>
        emit('CLEAR', Object.assign({ mask: 3, colormask: 15, rgba, z: 1, left: 0, top: 0, right: W, bottom: H }, o));
      // vertex: [x, y, z, r, g, b, a, s, t, oow, s1, t1]
      const draw = (ps, verts, prim = CONST.PRIM_TRIANGLELIST) => {
        const f = new Float32Array(verts.length * 16);
        verts.forEach((v, i) => {
          const [x, y, z, r, g, b, a, s = 0, t = 0, oow = 1, s1 = 0, t1 = 0] = v;
          f.set([x, y, z, 1, r, g, b, a, s, t, oow, 1, s1, t1, 0, 1], i * 16);
        });
        const voff = arenaPut(new Uint8Array(f.buffer));
        emit('DRAW_UP', { prim, vs: 0, ps, layout: ID.LAYOUT, voff, stride: 64, count: verts.length });
      };
      const present = (gamma = 0, rect = [0, 0, W, H]) => {
        emit('PRESENT', { rt: ID.RT, gamma, x: rect[0], y: rect[1], w: rect[2], h: rect[3], surface: 0x1234 });
        lastFrame = null;
        drain();
        reclaim();
        if (!lastFrame) throw new Error('PRESENT did not call onPresent');
        return lastFrame;
      };
      const px = (f, x, y) => Array.from(f.px.subarray((y * f.w + x) * 4, (y * f.w + x) * 4 + 4));
      const near = (a, b, tol = 2) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= tol);
      const expectPx = (name, f, x, y, want, tol) => {
        const got = px(f, x, y);
        check(`${name} @${x},${y}`, near(got, want, tol), `got ${got} want ${want}`);
      };
      const quad = (z, c, extra = () => []) => {
        const v = (x, y) => [x, y, z, ...c, ...extra(x, y)];
        return [v(0, 0), v(W, 0), v(0, H), v(W, 0), v(W, H), v(0, H)];
      };
      const readback = (x, y, w, h) => {
        const pos = p.arenaAlloc(w * 2 * h);
        emit('READBACK', { rt: ID.RT, x, y, w, h, fmt: CONST.FMT_RGB565, dst: pos, pitch: w * 2, slot: 0 });
        drain();
        const v = p.arenaView(pos, w * 2 * h).slice();
        reclaim();
        return (px2, py) => v[py * w * 2 + px2 * 2] | (v[py * w * 2 + px2 * 2 + 1] << 8);
      };

      // 1. clear + scissored, masked clear
      raster({});
      clear(0xff0000ff); // red (R in the low byte)
      let f = present();
      expectPx('clear red', f, 10, 10, [255, 0, 0, 255]);
      check('present frame hwnd/size', f.hwnd === 0x1234 && f.w === W && f.h === H, `${f.hwnd} ${f.w}x${f.h}`);
      if (readSurface) {
        const got = Array.from(readSurface(f.surface, 10, 10));
        check('published surface', near(got, [255, 0, 0, 255]), `got ${got}`);
      }
      clear(0xff00ff00, { mask: 1, colormask: 2 | 8, left: 0, top: 0, right: 32, bottom: 16 });
      f = present();
      expectPx('masked clear inside', f, 5, 5, [255, 255, 0, 255]);
      expectPx('masked clear outside (below)', f, 5, 40, [255, 0, 0, 255]);
      expectPx('masked clear outside (right)', f, 50, 5, [255, 0, 0, 255]);

      // 2. flat triangle; CLEAR's rect/mask must not leak into the draw
      clear(0xff000000);
      draw(ID.FLAT, [[0, 0, 0.5, 0, 0, 1, 1], [W, 0, 0.5, 0, 0, 1, 1], [0, H, 0.5, 0, 0, 1, 1]]);
      f = present();
      expectPx('flat tri inside', f, 5, 5, [0, 0, 255, 255]);
      expectPx('flat tri outside', f, 60, 60, [0, 0, 0, 255]);

      // 3. textured: 2x2 R,G / B,W point-sampled, modulated by white
      emit('CREATE', { id: ID.TEXA, kind: CONST.KIND_TEX2D, fmt: CONST.FMT_A8B8G8R8, levels: 1, width: 2, height: 2 });
      {
        const t = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]);
        emit('UPLOAD', { id: ID.TEXA, level: 0, x: 0, y: 0, w: 2, h: 2, pitch: 8, src: arenaPut(t), bytes: t.length });
      }
      emit('BIND', { count: 1 }, i32s(0, ID.TEXA, ID.SAMP));
      clear(0xff000000);
      draw(ID.TEX, quad(0.5, [1, 1, 1, 1], (x, y) => [x / W, y / H, 1]));
      f = present();
      expectPx('tex top-left', f, 8, 8, [255, 0, 0, 255]);
      expectPx('tex top-right', f, 56, 8, [0, 255, 0, 255]);
      expectPx('tex bottom-left', f, 8, 56, [0, 0, 255, 255]);
      expectPx('tex bottom-right', f, 56, 56, [255, 255, 255, 255]);

      // 3b. truncated mip chain: 8x8 with 2 real levels, minified hard. The
      //     LOD must clamp to level 1 (white), never the zero tail levels.
      emit('CREATE', { id: ID.MIP, kind: CONST.KIND_TEX2D, fmt: CONST.FMT_A8B8G8R8, levels: 2, width: 8, height: 8 });
      for (const [lvl, n] of [[0, 8], [1, 4]]) {
        const t = new Uint8Array(n * n * 4).fill(255);
        emit('UPLOAD', { id: ID.MIP, level: lvl, x: 0, y: 0, w: n, h: n, pitch: n * 4, src: arenaPut(t), bytes: t.length });
      }
      emit('BIND', { count: 1 }, i32s(0, ID.MIP, ID.SAMPMIP));
      clear(0xff000000);
      draw(ID.TEX, quad(0.5, [1, 1, 1, 1], (x, y) => [x / 4, y / 4, 1]));
      f = present();
      expectPx('truncated mip clamps to last real level', f, 30, 30, [255, 255, 255, 255]);

      // 3c. two texture slots with independent samplers (Glide's two TMUs):
      //     slot 0 yellow (clamp), slot 1 cyan/red stripes (wrap), multiplied.
      emit('CREATE', { id: ID.TEXB, kind: CONST.KIND_TEX2D, fmt: CONST.FMT_A8B8G8R8, levels: 1, width: 2, height: 1 });
      {
        const t = new Uint8Array([0, 255, 255, 255, 255, 0, 0, 255]);
        emit('UPLOAD', { id: ID.TEXB, level: 0, x: 0, y: 0, w: 2, h: 1, pitch: 8, src: arenaPut(t), bytes: t.length });
      }
      emit('BIND', { count: 2 }, i32s(0, ID.TEXA, ID.SAMP, 1, ID.TEXB, ID.SAMPWRAP));
      clear(0xff000000);
      // slot 0 samples texel (1,0) = green everywhere; slot 1 repeats 2 texels over 8 px.
      draw(ID.TWO, quad(0.5, [1, 1, 1, 1], (x, y) => [0.75, 0.25, 1, x / 4, 0.5]));
      f = present();
      expectPx('two slots: green * cyan', f, 1, 30, [0, 255, 0, 255]);
      expectPx('two slots: green * red', f, 3, 30, [0, 0, 0, 255]);
      expectPx('two slots: slot 1 wraps', f, 9, 30, [0, 255, 0, 255]);

      // 4. cull (D3DCULL in RT pixel space): 2 drops screen-clockwise, 3 drops counter-clockwise.
      const cwTri = [[0, 0, 0.5, 1, 1, 0, 1], [W, 0, 0.5, 1, 1, 0, 1], [0, H, 0.5, 1, 1, 0, 1]];
      const ccwTri = [cwTri[0], cwTri[2], cwTri[1]];
      for (const [cull, tri, visible] of [[1, cwTri, true], [1, ccwTri, true], [2, cwTri, false], [3, cwTri, true],
        [2, ccwTri, true], [3, ccwTri, false]]) {
        raster({ cull });
        clear(0xff000000);
        draw(ID.FLAT, tri);
        f = present();
        expectPx(`cull ${cull} ${tri === cwTri ? 'cw' : 'ccw'}`, f, 5, 5, visible ? [255, 255, 0, 255] : [0, 0, 0, 255]);
      }

      // 5. W depth (LESS) both orders, then Z depth.
      raster({ depth_mode: 2, zfunc: 2, zwrite: 1 });
      clear(0xff000000, { z: 1 });
      draw(ID.FLAT, quad(0, [1, 0, 0, 1], () => [0, 0, 0.5]));
      draw(ID.FLAT, quad(0, [0, 1, 0, 1], () => [0, 0, 0.01]));
      f = present();
      expectPx('W depth near wins', f, 32, 32, [255, 0, 0, 255]);
      clear(0xff000000, { z: 1 });
      draw(ID.FLAT, quad(0, [0, 1, 0, 1], () => [0, 0, 0.01]));
      draw(ID.FLAT, quad(0, [1, 0, 0, 1], () => [0, 0, 0.5]));
      f = present();
      expectPx('W depth near overdraws far', f, 32, 32, [255, 0, 0, 255]);
      raster({ depth_mode: 1, zfunc: 2, zwrite: 1 });
      clear(0xff000000, { z: 1 });
      draw(ID.FLAT, quad(0.2, [0, 0, 1, 1]));
      draw(ID.FLAT, quad(0.7, [0, 1, 0, 1]));
      f = present();
      expectPx('Z depth near wins', f, 32, 32, [0, 0, 255, 255]);

      // 6. fog. Table fog: table all 128 -> f = 128/255.
      emit('CREATE', { id: ID.FOG, kind: CONST.KIND_TEX2D, fmt: CONST.FMT_L8, levels: 1, width: 64, height: 1 });
      {
        const t = new Uint8Array(64).fill(128);
        emit('UPLOAD', { id: ID.FOG, level: 0, x: 0, y: 0, w: 64, h: 1, pitch: 64, src: arenaPut(t), bytes: 64 });
      }
      const fq = 128 / 255, tableFog = [Math.round(255 * fq), 0, Math.round(255 * (1 - fq)), 255];
      raster({ fog_mode: 2, fog_table: ID.FOG, fog_color: 0xff0000ff });
      clear(0xff000000);
      draw(ID.FLAT, quad(0, [0, 0, 1, 1], () => [0, 0, 0.5]));
      f = present();
      expectPx('table fog', f, 32, 32, tableFog, 3);
      // W buffering + table fog never consume position z: NaN/huge z change nothing.
      raster({ depth_mode: 2, zfunc: 8, zwrite: 1, fog_mode: 2, fog_table: ID.FOG, fog_color: 0xff0000ff });
      for (const z of [0.5, NaN, Infinity, 2.1e36]) {
        clear(0xff000000, { z: 1 });
        draw(ID.FLAT, quad(z, [0, 0, 1, 1], () => [0, 0, 0.5]));
        f = present();
        expectPx(`W + table fog ignores z=${z}`, f, 32, 32, tableFog, 3);
      }
      // Z fog stays meaningful under W buffering (geometry uses neutral clip z).
      raster({ depth_mode: 2, zfunc: 8, zwrite: 1, fog_mode: 3, fog_color: 0xff0000ff });
      for (const [z, want] of [[0, [0, 0, 255, 255]], [1, [255, 0, 0, 255]]]) {
        clear(0xff000000, { z: 1 });
        draw(ID.FLAT, quad(z, [0, 0, 1, 1], () => [0, 0, 0.5]));
        f = present();
        expectPx(`W mode Z fog z=${z}`, f, 32, 32, want, 2);
      }
      // vertex-alpha fog, no-add flag: c = c*(1-a)
      raster({ fog_mode: 1, fog_flags: 2, fog_color: 0xffffffff });
      clear(0xff000000);
      draw(ID.FLAT, quad(0, [0, 1, 0, 0.25]));
      f = present();
      expectPx('vertex fog no-add', f, 32, 32, [0, Math.round(255 * 0.75), 0, 255], 3);
      // alpha test: GREATER than 128, alpha 0.25 fails
      raster({ alpha_func: 5, alpha_ref: 128 });
      clear(0xff000000);
      draw(ID.FLAT, quad(0, [1, 1, 1, 0.25]));
      f = present();
      expectPx('alpha test discards', f, 32, 32, [0, 0, 0, 255]);

      // 7. READBACK RGB565, top-down rows, slot completion.
      raster({});
      clear(0xff000000);
      draw(ID.FLAT, [[0, 0, 0, 1, 0, 0, 1], [W, 0, 0, 1, 0, 0, 1], [0, 1, 0, 1, 0, 0, 1],
        [W, 0, 0, 1, 0, 0, 1], [W, 1, 0, 1, 0, 0, 1], [0, 1, 0, 1, 0, 0, 1]]);
      {
        const at = readback(0, 0, W, H);
        check('readback row 0 red', at(3, 0) === 0xF800, `0x${at(3, 0).toString(16)}`);
        check('readback row 1 black', at(3, 1) === 0, `0x${at(3, 1).toString(16)}`);
        check('readback slot completed', p.slot(0) !== 0, `slot ${p.slot(0)}`);
      }

      // 8. RT UPLOAD (LFB band) top-down; PRESENT through a gamma LUT, with a
      //    partial LUT update; the LUT never touches the RT or READBACK.
      {
        const band = new Uint8Array(W * 2 * 4);
        for (let i = 0; i < W * 2; i++) band.set([200, 100, 50, 255], i * 4);
        emit('UPLOAD', { id: ID.RT, level: 0, x: 0, y: 10, w: W, h: 2, pitch: W * 4, src: arenaPut(band), bytes: band.length });
        emit('CREATE', { id: ID.LUT, kind: CONST.KIND_TEX2D, fmt: CONST.FMT_A8B8G8R8, levels: 1, width: 256, height: 1 });
        const lut = new Uint8Array(256 * 4);
        for (let i = 0; i < 256; i++) lut.set([255 - i, i >> 1, i, 255], i * 4); // R inverted, G halved, B identity
        emit('UPLOAD', { id: ID.LUT, level: 0, x: 0, y: 0, w: 256, h: 1, pitch: 1024, src: arenaPut(lut), bytes: lut.length });
        f = present(0);
        expectPx('LFB band top-down', f, 7, 10, [200, 100, 50, 255], 0);
        expectPx('LFB band row 11', f, 7, 11, [200, 100, 50, 255], 0);
        expectPx('above band untouched', f, 7, 9, [0, 0, 0, 255], 0);
        f = present(ID.LUT);
        expectPx('gamma LUT exact entries', f, 7, 10, [55, 50, 50, 255], 0);
        expectPx('gamma LUT black', f, 7, 30, [255, 0, 0, 255], 0);
        const at = readback(0, 0, W, H);
        check('gamma LUT leaves RT raw (RGB565)', at(7, 10) === (((200 >> 3) << 11) | ((100 >> 2) << 5) | (50 >> 3)),
          `0x${at(7, 10).toString(16)}`);
        // Partial LUT update: entries 200 only; 100 and 50 keep their values.
        emit('UPLOAD', { id: ID.LUT, level: 0, x: 200, y: 0, w: 1, h: 1, pitch: 4, src: arenaPut(new Uint8Array([9, 8, 7, 255])), bytes: 4 });
        f = present(ID.LUT);
        expectPx('partial LUT upload keeps the tail', f, 7, 10, [9, 50, 50, 255], 0);
        f = present(0, [0, 8, 16, 8]);
        check('present subrect size', f.w === 16 && f.h === 8, `${f.w}x${f.h}`);
        expectPx('present subrect row', f, 3, 2, [200, 100, 50, 255], 0);
        expectPx('present subrect above', f, 3, 1, [0, 0, 0, 255], 0);
      }

      // 9. sticky state: a SHADER change with no new RASTER/CONSTS/BIND keeps them.
      emit('BIND', { count: 1 }, i32s(0, ID.TEXA, ID.SAMP));
      raster({ fog_mode: 1, fog_color: 0xff000000 });
      clear(0xff000000);
      draw(ID.TEX, quad(0, [1, 1, 1, 0.5], (x, y) => [x / W, y / H, 1]));
      draw(ID.FLAT, [[0, 0, 0, 1, 1, 1, 0.5], [W, 0, 0, 1, 1, 1, 0.5], [0, 8, 0, 1, 1, 1, 0.5]]);
      f = present();
      expectPx('sticky: tex with fog', f, 56, 56, [128, 128, 128, 255], 3);
      expectPx('sticky: flat with fog', f, 2, 2, [128, 128, 128, 255], 3);

      // 10. fail fast
      let threw = null;
      try { emit('DRAW_UP', { prim: 4, vs: 0, ps: 99, layout: ID.LAYOUT, voff: 0, stride: 64, count: 3 }); drain(); }
      catch (e) { threw = e; }
      check('unknown ps throws', threw instanceof GS.GpsError, String(threw));
    } catch (e) {
      failures.push(`scenario threw: ${e && e.stack || e}`);
    }
    const stats = ex.stats();
    ex.close();
    return { checks, failures, stats };
  }

  return { run, W, H };
});
