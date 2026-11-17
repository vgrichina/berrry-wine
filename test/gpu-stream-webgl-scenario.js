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
  const OPC = { MOV: 1, MUL: 5, LRP: 18, TEXLD: 66 };
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
  // Core vertex IR (stage 0, 0xfffe0200, flag 8; src/09af1 $vc_publish):
  // [op, ...operands], each operand [bank, index, selector, modifier].
  function vsIRShader(instrs) {
    const bytes = new Uint8Array(32 + instrs.length * 128);
    const dv = new DataView(bytes.buffer);
    const u32 = (o, v) => dv.setUint32(o, v >>> 0, true);
    u32(0, 0x44534952); u32(4, 1); u32(8, 0); u32(12, 0xfffe0200);
    u32(16, instrs.length); u32(20, instrs.length * 3 + 2); u32(24, bytes.length); u32(28, 8);
    instrs.forEach(([op, ...ops], i) => {
      const at = 32 + i * 128;
      u32(at, op); u32(at + 4, i + 1); u32(at + 8, ops.length); u32(at + 12, 0);
      ops.forEach(([bank, index, selector = 0, modifier = 0], j) => {
        const q = at + 16 + j * 16;
        u32(q, bank); u32(q + 4, index); u32(q + 8, selector); u32(q + 12, modifier);
      });
    });
    return bytes;
  }
  // dcl_position v0, dcl_color v1, mov oPos v0, mov oD0 v1.
  const PASS_VS = vsIRShader([[31, [254, 0, 0], [1, 0, 15]], [31, [254, 10, 0], [1, 1, 15]],
    [1, [4, 0, 15], [1, 0, 0xe4]], [1, [5, 0, 15], [1, 1, 0xe4]]]);
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
        blend_op: 1, blend_op_alpha: 1, linear: 1,
      };
      const raster = (o) => emit('RASTER', Object.assign({}, BASE_RASTER, o));
      const clear = (rgba, o = {}) =>
        emit('CLEAR', Object.assign({ mask: 3, colormask: 15, rgba, z: 1, left: 0, top: 0, right: W, bottom: H }, o));
      // vertex: [x, y, z, r, g, b, a, s, t, oow, s1, t1] in Glide's half-integer
      // pixel centres; written as the contract's integer ones with rhw = oow.
      const draw = (ps, verts, prim = CONST.PRIM_TRIANGLELIST) => {
        const f = new Float32Array(verts.length * 16);
        verts.forEach((v, i) => {
          const [x, y, z, r, g, b, a, s = 0, t = 0, oow = 1, s1 = 0, t1 = 0] = v;
          f.set([x - 0.5, y - 0.5, z, oow, r, g, b, a, s, t, oow, 1, s1, t1, 0, 1], i * 16);
        });
        const voff = arenaPut(new Uint8Array(f.buffer));
        emit('DRAW_UP', { prim, vs: 0, ps, layout: ID.LAYOUT, voff, stride: 64, count: verts.length, vcount: verts.length });
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
        const pos = p.arenaAlloc(w * 4 * h);
        emit('READBACK', { rt: ID.RT, x, y, w, h, fmt: CONST.FMT_A8B8G8R8, dst: pos, pitch: w * 4, slot: 0 });
        drain();
        const v = p.arenaView(pos, w * 4 * h).slice();
        reclaim();
        return (px2, py) => Array.from(v.subarray((py * w + px2) * 4, (py * w + px2) * 4 + 4));
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
      emit('CREATE', { id: ID.FOG, kind: CONST.KIND_TEX2D, fmt: CONST.FMT_A8B8G8R8, levels: 1, width: 64, height: 1 });
      {
        const t = new Uint8Array(256);
        for (let i = 0; i < 64; i++) t.set([128, 128, 128, 255], i * 4);
        emit('UPLOAD', { id: ID.FOG, level: 0, x: 0, y: 0, w: 64, h: 1, pitch: 256, src: arenaPut(t), bytes: 256 });
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
        check('readback row 0 red', near(at(3, 0), [255, 0, 0, 255], 0), `${at(3, 0)}`);
        check('readback row 1 black', near(at(3, 1), [0, 0, 0, 255], 0), `${at(3, 1)}`);
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
        check('gamma LUT leaves RT raw', near(at(7, 10), [200, 100, 50, 255], 0), `${at(7, 10)}`);
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
      try { emit('DRAW_UP', { prim: 4, vs: 0, ps: 99, layout: ID.LAYOUT, voff: 0, stride: 64, count: 3, vcount: 3 }); drain(); }
      catch (e) { threw = e; }
      check('unknown ps throws', threw instanceof GS.GpsError, String(threw));
    } catch (e) {
      failures.push(`scenario threw: ${e && e.stack || e}`);
    }
    const stats = ex.stats();
    ex.close();
    // The D1 contract cases on a fresh executor over the same backend.
    const d1 = runD1(opts);
    return { checks: checks + d1.checks, failures: failures.concat(d1.failures.map((f) => `D1 ${f}`)), stats };
  }

  // ── D1 executor contract cases (docs/gpu-stream-v2.md "Core executor
  // contract"), executor-agnostic: opts.makeExecutor(onPresent) builds the
  // executor (default: new Executor({canvas, backend, onPresent})). Covers
  // LAYOUT offsets + D3DCOLOR + a defaulted COLOR0, integer pixel centres,
  // non-blend draws, index_size 2/4, strips, VIEWPORT (and its TARGETS
  // reset), D24S8 stencil (one- and two-sided), z_bias, blend_op MIN and
  // REVSUBTRACT, BIND of an RT, MIRROR/BORDER addressing, perspective vs
  // linear varyings, PRESENT stamp/dst, the caps block, and refusals.
  function runD1(opts) {
    const { GS, makeProducer, Executor, canvas, backend, buffer } = opts;
    const { CONST } = GS;
    const failures = [];
    let checks = 0;
    const check = (name, ok, detail) => {
      checks++;
      if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`);
    };
    const make = (onPresent) => (opts.makeExecutor ? opts.makeExecutor(onPresent) : new Executor({ canvas, backend, onPresent }));
    let lastFrame = null;
    const ex = make((f) => {
      lastFrame = { w: f.width, h: f.height, stamp: f.stamp, dstX: f.dstX, dstY: f.dstY, px: Uint8Array.from(f.pixels) };
    });
    const p = makeProducer({ ringBytes: 1 << 16, arenaBytes: 1 << 20, buffer });
    const ring = p.ring();
    const drain = () => GS.drain([ring], ex);
    const emit = (op, fields, tail) => p.emit(op, fields, tail);
    const arenaPut = (bytes) => {
      const pos = p.arenaAlloc(bytes.length);
      p.arenaView(pos, bytes.length).set(bytes);
      return pos;
    };
    const reclaim = () => p.store('arena_tail', p.load('arena_head'));
    const i32s = (...v) => new Uint8Array(new Int32Array(v).buffer);
    const elems = (list) => {
      const out = new Uint8Array(list.length * 8), dv = new DataView(out.buffer);
      list.forEach(([usage, index, type, offset], i) => {
        dv.setUint8(i * 8 + 1, type); dv.setUint8(i * 8 + 2, usage); dv.setUint8(i * 8 + 3, index); dv.setUint16(i * 8 + 4, offset, true);
      });
      return out;
    };
    const ID = { RT: 1, DS: 2, RT2: 3, COMPACT: 10, POS: 11, FLAT: 12, TEX: 13, SAMP: 14, MIRROR: 15, BORDER: 16, TEX2: 17, BLIN: 18, PVS: 19, PL: 20 };
    const S = 28; // COMPACT stride: POSITIONT f4 @0, COLOR0 D3DCOLOR @16, TEXCOORD0 f2 @20
    // vertex [x, y, z, rhw, argb, s, t] in the COMPACT layout
    const pack = (verts) => {
      const out = new Uint8Array(verts.length * S), dv = new DataView(out.buffer);
      verts.forEach(([x, y, z, rhw, argb, s = 0, t = 0], i) => {
        const o = i * S;
        dv.setFloat32(o, x, true); dv.setFloat32(o + 4, y, true); dv.setFloat32(o + 8, z, true); dv.setFloat32(o + 12, rhw, true);
        dv.setUint32(o + 16, argb >>> 0, true); dv.setFloat32(o + 20, s, true); dv.setFloat32(o + 24, t, true);
      });
      return out;
    };
    const idx = (size, list) => {
      const out = new Uint8Array(list.length * size), dv = new DataView(out.buffer);
      list.forEach((v, i) => (size === 2 ? dv.setUint16(i * 2, v, true) : dv.setUint32(i * 4, v, true)));
      return out;
    };
    const draw = (ps, prim, verts, { index_size = 0, indices = null, layout = ID.COMPACT } = {}) => {
      const voff = arenaPut(layout === ID.POS ? new Uint8Array(new Float32Array(verts.flatMap((v) => v.slice(0, 4))).buffer) : pack(verts));
      const ioff = indices ? arenaPut(idx(index_size, indices)) : 0;
      emit('DRAW_UP', { prim, vs: 0, ps, layout, voff, stride: layout === ID.POS ? 16 : S, index_size, ioff,
        count: indices ? indices.length : verts.length, vcount: verts.length });
    };
    // A quad (x0,y0)-(x1,y1) as 4 vertices TL, TR, BL, BR with per-corner [argb, s, t, rhw].
    const corners = (x0, y0, x1, y1, z, at) => [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([x, y]) => {
      const [argb, s, t, rhw = 1] = at(x, y);
      return [x, y, z, rhw, argb, s, t];
    });
    const QUAD = [0, 1, 2, 1, 3, 2]; // two clockwise (y down) triangles
    const QUAD_CCW = [0, 2, 1, 1, 2, 3];
    const BASE = {
      depth_mode: 0, zfunc: 8, zwrite: 0, cull: 1, blend: 0, src_rgb: 2, dst_rgb: 1, src_alpha: 2, dst_alpha: 1,
      blend_op: 1, blend_op_alpha: 1, alpha_func: 8, alpha_ref: 0, colormask: 15, fill: 3, linear: 0,
      scissor_left: 0, scissor_top: 0, scissor_right: W, scissor_bottom: H,
    };
    const raster = (o) => emit('RASTER', Object.assign({}, BASE, o));
    const STENCIL = (o) => Object.assign({ stencil_enable: 1, stencil_func: 8, stencil_fail: 1, stencil_zfail: 1, stencil_pass: 1,
      stencil_ref: 0, stencil_mask: 255, stencil_wmask: 255 }, o);
    let stamp = 100;
    const present = () => {
      emit('PRESENT', { rt: ID.RT, x: 0, y: 0, w: W, h: H, surface: 0x77, stamp: ++stamp });
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
    const BLACK = [0, 0, 0, 255];

    try {
      emit('CREATE', { id: ID.RT, kind: CONST.KIND_RT, fmt: CONST.FMT_A8B8G8R8, levels: 1, width: W, height: H });
      emit('CREATE', { id: ID.DS, kind: CONST.KIND_DS, fmt: CONST.FMT_D24S8, levels: 1, width: W, height: H });
      emit('CREATE', { id: ID.RT2, kind: CONST.KIND_RT, fmt: CONST.FMT_A8B8G8R8, levels: 1, width: 16, height: 16 });
      emit('LAYOUT', { id: ID.COMPACT, count: 3, stride: S }, elems([[CONST.USAGE_POSITIONT, 0, CONST.VTYPE_FLOAT4, 0],
        [CONST.USAGE_COLOR, 0, CONST.VTYPE_D3DCOLOR, 16], [CONST.USAGE_TEXCOORD, 0, CONST.VTYPE_FLOAT2, 20]]));
      emit('LAYOUT', { id: ID.POS, count: 1, stride: 16 }, elems([[CONST.USAGE_POSITIONT, 0, CONST.VTYPE_FLOAT4, 0]]));
      emit('SHADER', { id: ID.FLAT, stage: 1, ir_bytes: FLAT_IR.length }, FLAT_IR);
      emit('SHADER', { id: ID.TEX, stage: 1, ir_bytes: TEX_IR.length }, TEX_IR);
      emit('SAMPLER', { id: ID.SAMP, address_u: 3, address_v: 3, min: 1, mag: 1 });
      emit('SAMPLER', { id: ID.MIRROR, address_u: CONST.ADDR_MIRROR, address_v: 3, min: 1, mag: 1 });
      emit('SAMPLER', { id: ID.BORDER, address_u: CONST.ADDR_BORDER, address_v: CONST.ADDR_BORDER, min: 1, mag: 1, border: 0xff00ffff });
      emit('CREATE', { id: ID.TEX2, kind: CONST.KIND_TEX2D, fmt: CONST.FMT_A8B8G8R8, levels: 1, width: 2, height: 1 });
      {
        const t = new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255]); // red, blue
        emit('UPLOAD', { id: ID.TEX2, level: 0, x: 0, y: 0, w: 2, h: 1, pitch: 8, src: arenaPut(t), bytes: t.length });
      }
      emit('TARGETS', { color: ID.RT, depth: ID.DS });
      drain();
      const caps = ring.caps();
      check('caps block published', (caps.flags & CONST.CAP_VALID) !== 0, `flags ${caps.flags}`);
      check('caps formats', caps.formats === ((1 << CONST.FMT_A8B8G8R8) | (1 << CONST.FMT_D16) | (1 << CONST.FMT_D24S8)), `${caps.formats}`);
      check('caps stencil', (caps.flags & CONST.CAP_STENCIL) !== 0, `flags ${caps.flags}`);
      check('caps limits', caps.maxSamplers >= 2 && caps.maxTexture >= 64 && caps.maxAniso >= 1, JSON.stringify(caps));

      // 1. LAYOUT offsets, D3DCOLOR order, index_size 2, integer pixel
      //    centres: (0,0)-(8,8) covers pixels 0..7.
      raster({});
      emit('CLEAR', { mask: 7, colormask: 15, rgba: 0xff000000, z: 1, stencil: 0, left: 0, top: 0, right: W, bottom: H });
      draw(ID.FLAT, CONST.PRIM_TRIANGLELIST, corners(0, 0, 8, 8, 0, () => [0xff336699]), { index_size: 2, indices: QUAD });
      // A position-only layout gets the default white diffuse.
      draw(ID.FLAT, CONST.PRIM_TRIANGLELIST, corners(8, 0, 16, 8, 0, () => [0]), { layout: ID.POS, index_size: 2, indices: QUAD });
      // 2. strips: indexed (u32) and direct, under cull 3 (drop CCW): a
      //    strip keeps one winding, so both triangles survive.
      raster({ cull: 3 });
      draw(ID.FLAT, CONST.PRIM_TRIANGLESTRIP, corners(16, 0, 32, 8, 0, () => [0xff00ff00]), { index_size: 4, indices: [0, 1, 2, 3] });
      draw(ID.FLAT, CONST.PRIM_TRIANGLESTRIP, corners(32, 0, 40, 8, 0, () => [0xffff0000]));
      raster({});
      // 3. VIEWPORT clips a pretransformed draw; TARGETS resets it.
      emit('VIEWPORT', { x: 40, y: 0, w: 8, h: 8, zmin: 0, zmax: 1 });
      draw(ID.FLAT, CONST.PRIM_TRIANGLELIST, corners(0, 0, W, H, 0, () => [0xff0000ff]), { index_size: 2, indices: QUAD });
      emit('TARGETS', { color: ID.RT, depth: ID.DS });
      draw(ID.FLAT, CONST.PRIM_TRIANGLELIST, corners(56, 0, 64, 8, 0, () => [0xffffff00]), { index_size: 2, indices: QUAD });
      let f = present();
      check('PRESENT stamp', f.stamp === stamp, `${f.stamp} vs ${stamp}`);
      check('PRESENT dst', f.dstX === 0 && f.dstY === 0, `${f.dstX},${f.dstY}`);
      expectPx('D3DCOLOR layout', f, 4, 4, [0x33, 0x66, 0x99, 255], 0);
      expectPx('integer centres: last covered pixel', f, 7, 7, [0x33, 0x66, 0x99, 255], 0);
      expectPx('integer centres: first uncovered row', f, 4, 8, BLACK, 0);
      expectPx('default COLOR0 is white', f, 12, 4, [255, 255, 255, 255], 0);
      expectPx('indexed u32 strip, first triangle', f, 17, 6, [0, 255, 0, 255], 0);
      expectPx('indexed u32 strip, second triangle', f, 30, 1, [0, 255, 0, 255], 0);
      expectPx('direct strip', f, 39, 1, [255, 0, 0, 255], 0);
      expectPx('viewport inside', f, 44, 4, [0, 0, 255, 255], 0);
      expectPx('viewport clips right', f, 50, 4, BLACK, 0);
      expectPx('viewport clips below', f, 44, 12, BLACK, 0);
      expectPx('TARGETS resets the viewport', f, 60, 4, [255, 255, 0, 255], 0);

      // 4. D24S8 stencil: mark the left half, then draw only where marked.
      raster(STENCIL({ stencil_pass: 3, stencil_ref: 1, colormask: 0 }));
      draw(ID.FLAT, CONST.PRIM_TRIANGLELIST, corners(0, 16, 8, 32, 0, () => [0xffffffff]), { index_size: 2, indices: QUAD });
      raster(STENCIL({ stencil_func: 3, stencil_ref: 1 }));
      draw(ID.FLAT, CONST.PRIM_TRIANGLELIST, corners(0, 16, 16, 32, 0, () => [0xffff0000]), { index_size: 2, indices: QUAD });
      // 5. two-sided: counter-clockwise faces increment, clockwise keep.
      raster(STENCIL({ two_sided: 1, ccw_func: 8, ccw_fail: 1, ccw_zfail: 1, ccw_pass: 4, colormask: 0 }));
      draw(ID.FLAT, CONST.PRIM_TRIANGLELIST, corners(16, 16, 24, 32, 0, () => [0xffffffff]), { index_size: 2, indices: QUAD_CCW });
      draw(ID.FLAT, CONST.PRIM_TRIANGLELIST, corners(24, 16, 32, 32, 0, () => [0xffffffff]), { index_size: 2, indices: QUAD });
      raster(STENCIL({ stencil_func: 3, stencil_ref: 1 }));
      draw(ID.FLAT, CONST.PRIM_TRIANGLELIST, corners(16, 16, 32, 32, 0, () => [0xff0000ff]), { index_size: 2, indices: QUAD });
      // 6. z_bias under depth_mode 1 (LESS): equal z with a negative bias wins,
      //    a positive one loses.
      raster({ depth_mode: 1, zfunc: 2, zwrite: 1 });
      draw(ID.FLAT, CONST.PRIM_TRIANGLELIST, corners(32, 16, 48, 32, 0.5, () => [0xff0000ff]), { index_size: 2, indices: QUAD });
      raster({ depth_mode: 1, zfunc: 2, zwrite: 1, z_bias: -0.01 });
      draw(ID.FLAT, CONST.PRIM_TRIANGLELIST, corners(32, 16, 40, 32, 0.5, () => [0xffffff00]), { index_size: 2, indices: QUAD });
      raster({ depth_mode: 1, zfunc: 2, zwrite: 1, z_bias: 0.01 });
      draw(ID.FLAT, CONST.PRIM_TRIANGLELIST, corners(40, 16, 48, 32, 0.5, () => [0xffff0000]), { index_size: 2, indices: QUAD });
      // 7. blend ops: MIN and REVSUBTRACT (dst - src) over red.
      raster({});
      draw(ID.FLAT, CONST.PRIM_TRIANGLELIST, corners(48, 16, 64, 32, 0, () => [0xffff0000]), { index_size: 2, indices: QUAD });
      raster({ blend: 1, src_rgb: 2, dst_rgb: 2, src_alpha: 2, dst_alpha: 2, blend_op: 4, blend_op_alpha: 4 });
      draw(ID.FLAT, CONST.PRIM_TRIANGLELIST, corners(48, 16, 56, 32, 0, () => [0xff808080]), { index_size: 2, indices: QUAD });
      raster({ blend: 1, src_rgb: 2, dst_rgb: 2, src_alpha: 2, dst_alpha: 2, blend_op: 3, blend_op_alpha: 1 });
      draw(ID.FLAT, CONST.PRIM_TRIANGLELIST, corners(56, 16, 64, 32, 0, () => [0x00400000]), { index_size: 2, indices: QUAD });
      f = present();
      expectPx('stencil EQUAL inside the mark', f, 4, 20, [255, 0, 0, 255], 0);
      expectPx('stencil EQUAL outside the mark', f, 12, 20, BLACK, 0);
      expectPx('two-sided: ccw set incremented', f, 20, 20, [0, 0, 255, 255], 0);
      expectPx('two-sided: cw set kept', f, 28, 20, BLACK, 0);
      expectPx('z_bias -0.01 wins at equal z', f, 36, 20, [255, 255, 0, 255], 0);
      expectPx('z_bias +0.01 loses at equal z', f, 44, 20, [0, 0, 255, 255], 0);
      expectPx('blend_op MIN', f, 52, 20, [128, 0, 0, 255], 1);
      expectPx('blend_op REVSUBTRACT', f, 60, 20, [191, 0, 0, 255], 1);

      // 8. BIND an RT: clear the 16x16 RT2 green, sample it into RT.
      emit('TARGETS', { color: ID.RT2, depth: 0 });
      // Top half green, bottom half red: sampling keeps RT rows top-down.
      emit('CLEAR', { mask: 1, colormask: 15, rgba: 0xff00ff00, z: 1, left: 0, top: 0, right: 16, bottom: 8 });
      emit('CLEAR', { mask: 1, colormask: 15, rgba: 0xff0000ff, z: 1, left: 0, top: 8, right: 16, bottom: 16 });
      emit('TARGETS', { color: ID.RT, depth: ID.DS });
      raster({});
      emit('BIND', { count: 1 }, i32s(0, ID.RT2, ID.SAMP));
      draw(ID.TEX, CONST.PRIM_TRIANGLELIST, corners(0, 48, 16, 64, 0, (x, y) => [0xffffffff, x / 16, (y - 48) / 16]),
        { index_size: 2, indices: QUAD });
      // 9. MIRROR: u 0..2 over 16 px of [red, blue] -> red blue | blue red.
      emit('BIND', { count: 1 }, i32s(0, ID.TEX2, ID.MIRROR));
      draw(ID.TEX, CONST.PRIM_TRIANGLELIST, corners(16, 48, 32, 56, 0, (x) => [0xffffffff, (x - 16) / 8, 0.5]),
        { index_size: 2, indices: QUAD });
      // 10. BORDER (point): u -1..1 -> border yellow, then the texture.
      emit('BIND', { count: 1 }, i32s(0, ID.TEX2, ID.BORDER));
      draw(ID.TEX, CONST.PRIM_TRIANGLELIST, corners(32, 48, 48, 56, 0, (x) => [0xffffffff, (x - 40) / 8, 0.5]),
        { index_size: 2, indices: QUAD });
      // 11. perspective (linear 0) vs screen-linear (linear 1): black at rhw
      //     1 to white at rhw 0.25; the middle pixel is 0.2 vs 0.5 white.
      raster({ linear: 0 });
      draw(ID.FLAT, CONST.PRIM_TRIANGLELIST, corners(48, 48, 64, 56, 0, (x) => (x === 48 ? [0xff000000, 0, 0, 1] : [0xffffffff, 0, 0, 0.25])),
        { index_size: 2, indices: QUAD });
      raster({ linear: 1 });
      draw(ID.FLAT, CONST.PRIM_TRIANGLELIST, corners(48, 56, 64, 64, 0, (x) => (x === 48 ? [0xff000000, 0, 0, 1] : [0xffffffff, 0, 0, 0.25])),
        { index_size: 2, indices: QUAD });
      f = present();
      expectPx('BIND RT samples its top rows at t 0', f, 8, 50, [0, 255, 0, 255], 0);
      expectPx('BIND RT samples its bottom rows at t 1', f, 8, 62, [255, 0, 0, 255], 0);
      expectPx('MIRROR first texel', f, 18, 50, [255, 0, 0, 255], 0);
      expectPx('MIRROR second texel', f, 22, 50, [0, 0, 255, 255], 0);
      expectPx('MIRROR mirrored second texel', f, 26, 50, [0, 0, 255, 255], 0);
      expectPx('MIRROR mirrored first texel', f, 30, 50, [255, 0, 0, 255], 0);
      expectPx('BORDER outside', f, 34, 50, [255, 255, 0, 255], 0);
      expectPx('BORDER inside', f, 46, 50, [0, 0, 255, 255], 0);
      const mid = (56 - 48) / 16, persp = Math.round(255 * (mid * 0.25) / ((1 - mid) + mid * 0.25));
      expectPx('perspective-correct varying', f, 56, 52, [persp, persp, persp, 255], 4);
      expectPx('screen-linear varying', f, 56, 60, [128, 128, 128, 255], 4);

      // 12. BORDER with linear filtering (GPS_CAP_BORDER_LINEAR; GL_CLAMP +
      //     GL_LINEAR). [red, blue] at u = (x - 16) / 32: texel coordinate
      //     (x - 16) / 16 - 0.5, so every 8 px is a half texel, blending
      //     into the yellow border on both sides.
      check('caps border linear', (ring.caps().flags & CONST.CAP_BORDER_LINEAR) !== 0, `flags ${ring.caps().flags}`);
      emit('SAMPLER', { id: ID.BLIN, address_u: CONST.ADDR_BORDER, address_v: CONST.ADDR_BORDER, min: 2, mag: 2, border: 0xff00ffff });
      emit('CLEAR', { mask: 1, colormask: 15, rgba: 0xff000000, z: 1, left: 0, top: 0, right: W, bottom: H });
      emit('BIND', { count: 1 }, i32s(0, ID.TEX2, ID.BLIN));
      draw(ID.TEX, CONST.PRIM_TRIANGLELIST, corners(0, 0, 64, 8, 0, (x) => [0xffffffff, (x - 16) / 32, 0.5]),
        { index_size: 2, indices: QUAD });
      f = present();
      [[0, [255, 255, 0]], [8, [255, 255, 0]], [16, [255, 128, 0]], [24, [255, 0, 0]], [32, [128, 0, 128]],
        [40, [0, 0, 255]], [48, [128, 128, 128]], [56, [255, 255, 0]]]
        .forEach(([x, rgb]) => expectPx('BORDER linear', f, x, 4, [...rgb, 255], 2));

      // 13. User clip planes (CLIP, GPS_CAP_CLIP_PLANES) apply to vs != 0
      //     draws on the output position (D3D clip space). A pass-through
      //     core VS draws a clip-space quad; plane 0 (x >= 0) and plane 5
      //     (y >= 0; WebGL carries 4-5 in another varying than 0-3) leave the
      //     top-right quadrant. A vs 0 draw ignores the planes; mask 0 lifts
      //     them. Executors without a vertex stage cannot advertise CLIP.
      const cflags = ring.caps().flags;
      check('caps clip planes need a vertex stage', !(cflags & CONST.CAP_CLIP_PLANES) || !!(cflags & CONST.CAP_VS_IR), `flags ${cflags}`);
      if (cflags & CONST.CAP_CLIP_PLANES) {
        const WHITE = [255, 255, 255, 255];
        emit('SHADER', { id: ID.PVS, stage: 0, ir_bytes: PASS_VS.length }, PASS_VS);
        emit('LAYOUT', { id: ID.PL, count: 2, stride: 20 }, elems([[0, 0, CONST.VTYPE_FLOAT4, 0], [CONST.USAGE_COLOR, 0, CONST.VTYPE_D3DCOLOR, 16]]));
        emit('TARGETS', { color: ID.RT, depth: 0 });
        emit('VIEWPORT', { x: 0, y: 0, w: W, h: H, zmin: 0, zmax: 1 });
        raster({});
        const clipQuad = () => {
          const v = new Uint8Array(80), dv = new DataView(v.buffer);
          [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([x, y], i) => {
            dv.setFloat32(i * 20, x, true); dv.setFloat32(i * 20 + 4, y, true); dv.setFloat32(i * 20 + 8, 0.5, true);
            dv.setFloat32(i * 20 + 12, 1, true); dv.setUint32(i * 20 + 16, 0xffffffff, true);
          });
          emit('DRAW_UP', { prim: CONST.PRIM_TRIANGLELIST, vs: ID.PVS, ps: ID.FLAT, layout: ID.PL, voff: arenaPut(v), stride: 20,
            index_size: 2, ioff: arenaPut(idx(2, QUAD)), count: 6, vcount: 4 });
        };
        const planes = new Float32Array(24);
        planes.set([1, 0, 0, 0], 0); planes.set([0, 1, 0, 0], 20);
        emit('CLIP', { mask: 0x21, planes: Array.from(planes) });
        emit('CLEAR', { mask: 1, colormask: 15, rgba: 0xff000000, z: 1, left: 0, top: 0, right: W, bottom: H });
        clipQuad();
        f = present();
        expectPx('clip planes 0+5 keep', f, 48, 16, WHITE, 2);
        for (const [x, y] of [[16, 16], [16, 48], [48, 48]]) expectPx('clip planes 0+5 drop', f, x, y, BLACK, 2);
        emit('CLEAR', { mask: 1, colormask: 15, rgba: 0xff000000, z: 1, left: 0, top: 0, right: W, bottom: H });
        draw(ID.FLAT, CONST.PRIM_TRIANGLELIST, corners(0, 0, W, H, 0.5, () => [0xffffffff, 0, 0]), { index_size: 2, indices: QUAD });
        f = present();
        expectPx('clip planes ignored by vs 0', f, 16, 48, WHITE, 2);
        emit('CLIP', { mask: 0, planes: Array.from(new Float32Array(24)) });
        emit('CLEAR', { mask: 1, colormask: 15, rgba: 0xff000000, z: 1, left: 0, top: 0, right: W, bottom: H });
        clipQuad();
        f = present();
        expectPx('clip mask 0', f, 16, 48, WHITE, 2);
      }

      // 14. D3D W-buffer (depth_mode 3, GPS_CAP_WBUFFER): depth = w / w_far
      //     with w = 1 / interpolated rhw; z is ignored. Cleared to 0.5
      //     (w 5 of w_far 10): w 6 is hidden whatever its z, w 4 shows with
      //     z 0.99, and w 3 (z 0.01) covers the left half of it.
      if (cflags & CONST.CAP_WBUFFER) {
        emit('TARGETS', { color: ID.RT, depth: ID.DS });
        emit('VIEWPORT', { x: 0, y: 0, w: W, h: H, zmin: 0, zmax: 1 });
        emit('CLEAR', { mask: 3, colormask: 15, rgba: 0xff000000, z: 0.5, left: 0, top: 0, right: W, bottom: H });
        raster({ depth_mode: 3, zfunc: 4, zwrite: 1, w_far: 10 });
        const wq = (x0, x1, z, rhw, argb) => draw(ID.FLAT, CONST.PRIM_TRIANGLELIST,
          corners(x0, 0, x1, H, z, () => [argb, 0, 0, rhw]), { index_size: 2, indices: QUAD });
        wq(0, W, 0.01, 1 / 6, 0xffff0000);
        wq(0, W, 0.99, 0.25, 0xff00ff00);
        wq(0, W / 2, 0.01, 1 / 3, 0xff0000ff);
        wq(0, W, 0.5, 0.25 / 1.01, 0xffffffff);
        f = present();
        expectPx('W-buffer: nearer w shows', f, W / 2 + 8, 16, [0, 255, 0, 255], 0);
        expectPx('W-buffer: nearest w wins', f, 8, 16, [0, 0, 255, 255], 0);
        raster({});
      }
    } catch (e) {
      failures.push(`scenario threw: ${e && e.stack || e}`);
    }
    ex.close();

    // Refusals, each on a fresh stream and executor.
    const refuse = (name, build, re) => {
      const q = makeProducer({ ringBytes: 1 << 14, arenaBytes: 1 << 14, buffer });
      const x = make(() => {});
      let err = null;
      try { build(q); GS.drain([q.ring()], x); } catch (e) { err = e; } finally { x.close(); }
      check(`refuses ${name}`, !!err && re.test(err.message), err ? err.message : 'no error');
    };
    const setup = (q, ds = CONST.FMT_D24S8) => {
      q.emit('CREATE', { id: 1, kind: CONST.KIND_RT, fmt: CONST.FMT_A8B8G8R8, levels: 1, width: 16, height: 16 });
      q.emit('CREATE', { id: 2, kind: CONST.KIND_DS, fmt: ds, levels: 1, width: 16, height: 16 });
      q.emit('TARGETS', { color: 1, depth: 2 });
      q.emit('LAYOUT', { id: 3, count: 1, stride: 16 }, elems([[CONST.USAGE_POSITIONT, 0, CONST.VTYPE_FLOAT4, 0]]));
      q.emit('SHADER', { id: 4, stage: 1, ir_bytes: TEX_IR.length }, TEX_IR);
      q.emit('SAMPLER', { id: 5, address_u: 3, address_v: 3, min: 1, mag: 1 });
      const v = new Float32Array([0, 0, 0, 1, 8, 0, 0, 1, 0, 8, 0, 1]);
      const pos = q.arenaAlloc(v.byteLength); q.arenaView(pos, v.byteLength).set(new Uint8Array(v.buffer));
      return pos;
    };
    refuse('sampling the bound color target', (q) => {
      const v = setup(q);
      q.emit('RASTER', BASE);
      q.emit('BIND', { count: 1 }, i32s(0, 1, 5));
      q.emit('DRAW_UP', { prim: 4, ps: 4, layout: 3, voff: v, stride: 16, count: 3, vcount: 3 });
    }, /bound color target/);
    refuse('stencil on a D16 target', (q) => {
      const v = setup(q, CONST.FMT_D16);
      q.emit('RASTER', Object.assign({}, BASE, STENCIL({})));
      q.emit('SHADER', { id: 6, stage: 1, ir_bytes: FLAT_IR.length }, FLAT_IR);
      q.emit('DRAW_UP', { prim: 4, ps: 6, layout: 3, voff: v, stride: 16, count: 3, vcount: 3 });
    }, /D24S8/);
    refuse('logic_op with blending on', (q) => { setup(q); q.emit('RASTER', Object.assign({}, BASE, { logic_op: 7, blend: 1 })); }, /logic_op/);
    refuse('logic_op out of range', (q) => { setup(q); q.emit('RASTER', Object.assign({}, BASE, { logic_op: 17 })); }, /logic_op/);
    refuse('W-buffer without w_far', (q) => { setup(q); q.emit('RASTER', Object.assign({}, BASE, { depth_mode: 3, zfunc: 4 })); }, /w_far/);
    refuse('a non-A8B8G8R8 texture', (q) => q.emit('CREATE', { id: 9, kind: CONST.KIND_TEX2D, fmt: CONST.FMT_L8, levels: 1, width: 4, height: 4 }), /fmt/);
    refuse('a non-A8B8G8R8 readback', (q) => {
      setup(q);
      q.emit('READBACK', { rt: 1, w: 1, h: 1, fmt: CONST.FMT_RGB565, dst: q.arenaAlloc(16), pitch: 4 });
    }, /only A8B8G8R8/);
    return { checks, failures };
  }


  // ── slice 9.4a: the executor features D3D9/D3D8 and OpenGL need ──
  // Partial colour masks, logic ops (every one of the 16, including runs of
  // overlapping primitives in one draw and stale destinations), CUBE
  // textures, occlusion counts, projected texcoords (t0_dz) and the vertex
  // fog LRP. Every executor must produce the exact expected bytes (tol 1).
  const LOGIC_NAMES = ['CLEAR', 'AND', 'AND_REVERSE', 'COPY', 'AND_INVERTED', 'NOOP', 'XOR', 'OR', 'NOR', 'EQUIV',
    'INVERT', 'OR_REVERSE', 'COPY_INVERTED', 'OR_INVERTED', 'NAND', 'SET'];
  function logicByte(op, s, d) {
    const n = op - 1;
    return ((n & 1 ? s & d : 0) | (n & 2 ? s & ~d : 0) | (n & 4 ? ~s & d : 0) | (n & 8 ? ~s & ~d : 0)) & 255;
  }
  // GL/D3D cube face selection: dir -> [face, s, t].
  function cubeLookup([x, y, z]) {
    const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
    let face, sc, tc, ma;
    if (ax >= ay && ax >= az) { face = x > 0 ? 0 : 1; sc = x > 0 ? -z : z; tc = -y; ma = ax; }
    else if (ay >= az) { face = y > 0 ? 2 : 3; sc = x; tc = y > 0 ? z : -z; ma = ay; }
    else { face = z > 0 ? 4 : 5; sc = z > 0 ? x : -x; tc = -y; ma = az; }
    return [face, (sc / ma + 1) / 2, (tc / ma + 1) / 2];
  }

  function run94a(opts) {
    const { GS, makeProducer, Executor, canvas, backend, buffer } = opts;
    const { CONST } = GS;
    const failures = [];
    let checks = 0;
    const check = (name, ok, detail) => {
      checks++;
      if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`);
    };
    const make = (onPresent) => (opts.makeExecutor ? opts.makeExecutor(onPresent) : new Executor({ canvas, backend, onPresent }));
    let lastFrame = null;
    const ex = make((f) => { lastFrame = { w: f.width, h: f.height, px: Uint8Array.from(f.pixels) }; });
    const p = makeProducer({ ringBytes: 1 << 16, arenaBytes: 1 << 20, buffer });
    const ring = p.ring();
    const drain = () => GS.drain([ring], ex);
    const emit = (op, fields, tail) => p.emit(op, fields, tail);
    const arenaPut = (bytes) => {
      const pos = p.arenaAlloc(bytes.length);
      p.arenaView(pos, bytes.length).set(bytes);
      return pos;
    };
    const i32s = (...v) => new Uint8Array(new Int32Array(v).buffer);
    const elems = (list) => {
      const out = new Uint8Array(list.length * 8), dv = new DataView(out.buffer);
      list.forEach(([usage, index, type, offset], i) => {
        dv.setUint8(i * 8 + 1, type); dv.setUint8(i * 8 + 2, usage); dv.setUint8(i * 8 + 3, index); dv.setUint16(i * 8 + 4, offset, true);
      });
      return out;
    };
    // L: POSITIONT f4 @0, COLOR0 D3DCOLOR @16, COLOR1 D3DCOLOR @20, TEXCOORD0 f3 @24.
    const ID = { RT: 1, DS: 2, L: 3, FLAT: 4, TEX: 5, CUBEPS: 6, PROJ: 7, FOG: 8, SAMP: 9, CUBE: 10, TEX4: 11 };
    const S = 36;
    // vertex [x, y, z, rhw, argb, spec, s, t, q]
    const pack = (verts) => {
      const out = new Uint8Array(verts.length * S), dv = new DataView(out.buffer);
      verts.forEach(([x, y, z, rhw, argb, spec = 0, s = 0, t = 0, q = 0], i) => {
        const o = i * S;
        [x, y, z, rhw].forEach((v, k) => dv.setFloat32(o + k * 4, v, true));
        dv.setUint32(o + 16, argb >>> 0, true); dv.setUint32(o + 20, spec >>> 0, true);
        [s, t, q].forEach((v, k) => dv.setFloat32(o + 24 + k * 4, v, true));
      });
      return out;
    };
    const QUAD = [0, 1, 2, 1, 3, 2];
    // Quads as [x0, y0, x1, y1, at(x, y) -> [argb, spec, s, t, q]], drawn as one indexed list.
    const quads = (ps, list) => {
      const verts = [], indices = [];
      for (const [x0, y0, x1, y1, at] of list) {
        const b = verts.length;
        for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) verts.push([x, y, 0.5, 1, ...at(x, y)]);
        indices.push(...QUAD.map((i) => i + b));
      }
      const voff = arenaPut(pack(verts));
      const bytes = new Uint8Array(new Uint16Array(indices).buffer);
      emit('DRAW_UP', { prim: CONST.PRIM_TRIANGLELIST, vs: 0, ps, layout: ID.L, voff, stride: S, index_size: 2, ioff: arenaPut(bytes),
        count: indices.length, vcount: verts.length });
    };
    const quad = (ps, x0, y0, x1, y1, argb, rest = []) => quads(ps, [[x0, y0, x1, y1, () => [argb, ...rest]]]);
    const BASE = {
      depth_mode: 0, zfunc: 8, zwrite: 0, cull: 1, blend: 0, src_rgb: 2, dst_rgb: 1, src_alpha: 2, dst_alpha: 1,
      blend_op: 1, blend_op_alpha: 1, alpha_func: 8, alpha_ref: 0, colormask: 15, fill: 3, linear: 0,
      scissor_left: 0, scissor_top: 0, scissor_right: W, scissor_bottom: H,
    };
    const raster = (o) => emit('RASTER', Object.assign({}, BASE, o));
    const clearRect = (rgba, x0, y0, x1, y1, o = {}) =>
      emit('CLEAR', Object.assign({ mask: 1, colormask: 15, rgba, z: 1, left: x0, top: y0, right: x1, bottom: y1 }, o));
    const present = () => {
      emit('PRESENT', { rt: ID.RT, x: 0, y: 0, w: W, h: H, surface: 0x94 });
      lastFrame = null;
      drain();
      p.store('arena_tail', p.load('arena_head'));
      if (!lastFrame) throw new Error('PRESENT did not call onPresent');
      return lastFrame;
    };
    const px = (f, x, y) => Array.from(f.px.subarray((y * f.w + x) * 4, (y * f.w + x) * 4 + 4));
    // PRESENT shows RGB (alpha is forced opaque); READBACK checks alpha.
    const expectPx = (name, f, x, y, want, tol = 1) => {
      const got = px(f, x, y).slice(0, 3);
      check(`${name} @${x},${y}`, got.every((v, i) => Math.abs(v - want[i]) <= tol), `got ${got} want ${want.slice(0, 3)}`);
    };
    const readRow = (y) => {
      const dst = p.arenaAlloc(W * 4);
      emit('READBACK', { rt: ID.RT, x: 0, y, w: W, h: 1, fmt: CONST.FMT_A8B8G8R8, dst, pitch: W * 4 });
      drain();
      return p.arenaView(dst, W * 4).slice();
    };
    // D3DCOLOR argb -> [r, g, b, a]; CLEAR rgba is r | g << 8 | b << 16 | a << 24.
    const rgbaOf = (argb) => [(argb >>> 16) & 255, (argb >>> 8) & 255, argb & 255, argb >>> 24];
    const clearOf = ([r, g, b, a]) => (r | (g << 8) | (b << 16) | (a << 24)) >>> 0;
    const DST = [0x5a, 0xc3, 0x0f, 0xff], SRC = 0x8033f0aa, SRCB = rgbaOf(SRC);
    const lop = (op, s, d) => s.map((v, i) => logicByte(op, v, d[i]));

    // IR tokens (bank << 28 | modifier << 24 | swizzle/mask << 16 | index).
    const R0 = 0x800F0000, R0S = 0x801F0000, R0RGB = 0x80070000, SRC_R0 = 0x80E40000;
    const V0 = 0x90E40000, V1A = 0x90FF0001, C1 = 0xA0E40001, T0 = 0xB0E40000, T0DZ = 0xB9E40000;
    const CUBE_IR = irShader([[OPC.TEXLD, R0, T0], [OPC.MUL, R0S, SRC_R0, V0]]);
    const PROJ_IR = irShader([[OPC.TEXLD, R0, T0DZ], [OPC.MUL, R0S, SRC_R0, V0]]);
    const FOG_IR = irShader([[OPC.MOV, R0, V0], [OPC.LRP, R0RGB, V1A, SRC_R0, C1]]);

    try {
      emit('CREATE', { id: ID.RT, kind: CONST.KIND_RT, fmt: CONST.FMT_A8B8G8R8, levels: 1, width: W, height: H });
      emit('CREATE', { id: ID.DS, kind: CONST.KIND_DS, fmt: CONST.FMT_D24S8, levels: 1, width: W, height: H });
      emit('LAYOUT', { id: ID.L, count: 4, stride: S }, elems([[CONST.USAGE_POSITIONT, 0, CONST.VTYPE_FLOAT4, 0],
        [CONST.USAGE_COLOR, 0, CONST.VTYPE_D3DCOLOR, 16], [CONST.USAGE_COLOR, 1, CONST.VTYPE_D3DCOLOR, 20],
        [CONST.USAGE_TEXCOORD, 0, CONST.VTYPE_FLOAT3, 24]]));
      emit('SHADER', { id: ID.FLAT, stage: 1, ir_bytes: FLAT_IR.length }, FLAT_IR);
      emit('SHADER', { id: ID.CUBEPS, stage: 1, ir_bytes: CUBE_IR.length }, CUBE_IR);
      emit('SHADER', { id: ID.PROJ, stage: 1, ir_bytes: PROJ_IR.length }, PROJ_IR);
      emit('SHADER', { id: ID.FOG, stage: 1, ir_bytes: FOG_IR.length }, FOG_IR);
      emit('SAMPLER', { id: ID.SAMP, address_u: 3, address_v: 3, min: 1, mag: 1 });
      emit('TARGETS', { color: ID.RT, depth: ID.DS });
      drain();
      const caps = ring.caps();
      check('caps logic op', (caps.flags & CONST.CAP_LOGIC_OP) !== 0, `flags ${caps.flags}`);
      check('caps occlusion', (caps.flags & CONST.CAP_OCCLUSION) !== 0, `flags ${caps.flags}`);
      emit('CLEAR', { mask: 7, colormask: 15, rgba: 0xff000000, z: 1, stencil: 0, left: 0, top: 0, right: W, bottom: H });

      // 1. All 16 logic ops, 4 px each, over DST on rows 0..8.
      clearRect(clearOf(DST), 0, 0, W, 8);
      for (let op = 1; op <= 16; op++) {
        raster({ logic_op: op });
        quad(ID.FLAT, (op - 1) * 4, 0, op * 4, 8, SRC);
      }
      // 2. Runs. Rows 8..16 over DST:
      //    a. XOR of two identical quads in ONE draw -> DST (the second reads the first's output);
      //    b. XOR of one quad (two triangles sharing the diagonal) -> SRC ^ DST everywhere;
      //    c. XOR in two draws on the same pixels -> DST;
      //    d. XOR, a plain draw, XOR again on the same pixels -> green ^ SRC (stale copy);
      //    e. XOR of 300 one-pixel-apart quads... kept small: 20 2x2 quads, one draw, half overlapped twice.
      clearRect(clearOf(DST), 0, 8, W, 16);
      raster({ logic_op: 7 });
      quads(ID.FLAT, [[0, 8, 8, 16, () => [SRC]], [0, 8, 8, 16, () => [SRC]]]);
      quad(ID.FLAT, 8, 8, 16, 16, SRC);
      quad(ID.FLAT, 16, 8, 24, 16, SRC);
      quad(ID.FLAT, 16, 8, 24, 16, SRC);
      raster({});
      quad(ID.FLAT, 24, 8, 32, 16, 0xff00ff00);
      raster({ logic_op: 7 });
      quad(ID.FLAT, 24, 8, 32, 16, SRC);
      {
        const list = [];
        for (let i = 0; i < 8; i++) list.push([32 + i * 4, 8, 34 + i * 4, 10, () => [SRC]]);
        for (let i = 0; i < 4; i++) list.push([32 + i * 8, 8, 34 + i * 8, 10, () => [SRC]]); // second hit on even quads
        quads(ID.FLAT, list);
      }
      // 3. Partial colour masks, rows 16..24 over DST.
      clearRect(clearOf(DST), 0, 16, W, 24);
      raster({ colormask: 5 });
      quad(ID.FLAT, 0, 16, 8, 24, 0xffffffff);
      raster({ colormask: 7 });
      quad(ID.FLAT, 8, 16, 16, 24, 0x00ffffff);
      raster({ colormask: 2 });
      quad(ID.FLAT, 16, 16, 24, 24, 0x00000000);
      clearRect(0xffffffff, 24, 16, 32, 24, { colormask: 10 });
      raster({ colormask: 1, logic_op: 7 });
      quad(ID.FLAT, 32, 16, 40, 24, SRC);
      raster({ colormask: 0, logic_op: 7 });
      quad(ID.FLAT, 40, 16, 48, 24, SRC);
      const row4 = readRow(4), row20 = readRow(20);
      let f = present();
      for (let op = 1; op <= 16; op++) {
        const want = lop(op, SRCB, DST), x = (op - 1) * 4 + 1;
        expectPx(`logic ${LOGIC_NAMES[op - 1]}`, f, x, 4, want);
        check(`logic ${LOGIC_NAMES[op - 1]} alpha (READBACK)`, Math.abs(row4[x * 4 + 3] - want[3]) <= 1, `got ${row4[x * 4 + 3]} want ${want[3]}`);
      }
      check('colormask R|B keeps alpha (READBACK)', row20[4 * 4 + 3] === DST[3], `${row20[4 * 4 + 3]}`);
      check('colormask RGB keeps alpha 0xff under a 0x00 source (READBACK)', row20[12 * 4 + 3] === DST[3], `${row20[12 * 4 + 3]}`);
      check('colormask R with XOR keeps alpha (READBACK)', row20[36 * 4 + 3] === DST[3], `${row20[36 * 4 + 3]}`);
      const xor = lop(7, SRCB, DST);
      expectPx('logic XOR twice in one draw', f, 4, 12, DST);
      expectPx('logic XOR one quad, first triangle', f, 9, 9, xor);
      expectPx('logic XOR one quad, second triangle', f, 14, 14, xor);
      expectPx('logic XOR one quad, on the diagonal', f, 12, 12, xor);
      expectPx('logic XOR in two draws', f, 20, 12, DST);
      expectPx('logic XOR after a plain draw', f, 28, 12, lop(7, SRCB, [0, 255, 0, 255]));
      expectPx('logic XOR small quads, hit twice', f, 33, 9, DST);
      expectPx('logic XOR small quads, hit once', f, 37, 9, xor);
      expectPx('logic XOR small quads, gap', f, 35, 9, DST);
      expectPx('colormask R|B', f, 4, 20, [255, DST[1], 255, DST[3]]);
      expectPx('colormask RGB keeps alpha', f, 12, 20, [255, 255, 255, DST[3]]);
      expectPx('colormask G only', f, 20, 20, [DST[0], 0, DST[2], DST[3]]);
      expectPx('clear colormask G|A', f, 28, 20, [DST[0], 255, DST[2], 255]);
      expectPx('colormask R with XOR', f, 36, 20, [xor[0], DST[1], DST[2], DST[3]]);
      expectPx('colormask 0 with XOR', f, 44, 20, DST);

      // 4. CUBE 2x2: face f texel (i, j) = [40f + 20, 60(i + 2j) + 10, 0x80, 255].
      emit('CREATE', { id: ID.CUBE, kind: CONST.KIND_CUBE, fmt: CONST.FMT_A8B8G8R8, levels: 1, width: 2, height: 2 });
      const texel = (face, i, j) => [40 * face + 20, 60 * (i + 2 * j) + 10, 0x80, 255];
      for (let face = 0; face < 6; face++) {
        const t = new Uint8Array(16);
        for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) t.set(texel(face, i, j), (j * 2 + i) * 4);
        emit('UPLOAD', { id: ID.CUBE, face, level: 0, x: 0, y: 0, w: 2, h: 2, pitch: 8, src: arenaPut(t), bytes: 16 });
      }
      emit('BIND', { count: 1 }, i32s(0, ID.CUBE, ID.SAMP));
      raster({});
      const dirs = [[1, 0.5, 0.5], [1, -0.5, 0.5], [-1, 0.5, -0.5], [0.5, 1, 0.5], [-0.5, -1, 0.5],
        [0.5, -0.5, 1], [-0.5, 0.5, -1], [1, -0.5, -0.5]];
      dirs.forEach((d, k) => quad(ID.CUBEPS, k * 8, 24, k * 8 + 8, 32, 0xffffffff, [0, ...d]));
      // 5. Projected texcoords (texld t0_dz): (s, t, q) = (1.5, 0.5, 2) samples
      //    texel (0.75, 0.25) of a 2x2; unprojected it would clamp to (1, 0.5).
      emit('CREATE', { id: ID.TEX4, kind: CONST.KIND_TEX2D, fmt: CONST.FMT_A8B8G8R8, levels: 1, width: 4, height: 4 });
      {
        const t = new Uint8Array(64);
        for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) t.set([i * 60 + 10, j * 60 + 10, 0x40, 255], (j * 4 + i) * 4);
        emit('UPLOAD', { id: ID.TEX4, face: 0, level: 0, x: 0, y: 0, w: 4, h: 4, pitch: 16, src: arenaPut(t), bytes: 64 });
      }
      emit('BIND', { count: 1 }, i32s(0, ID.TEX4, ID.SAMP));
      quad(ID.PROJ, 0, 32, 8, 40, 0xffffffff, [0, 1.25, 0.25, 2]);
      quad(ID.PROJ, 8, 32, 16, 40, 0xffffffff, [0, 0.25, 1.25, 2]);
      // 6. Vertex fog / specular linkage: LRP r0.rgb, v1.a, v0, c1.
      const consts = new Float32Array(8); consts.set([0, 0, 1, 1], 4); // c1 = blue fog
      emit('CONSTS', { stage: 1, first: 0, count: 2 }, new Uint8Array(consts.buffer));
      quad(ID.FOG, 16, 32, 24, 40, 0xffff0000, [0x33000000]);
      quad(ID.FOG, 24, 32, 32, 40, 0xffff0000, [0xff000000]);
      f = present();
      dirs.forEach((d, k) => {
        const [face, s, t] = cubeLookup(d);
        expectPx(`cube dir ${d} face ${face}`, f, k * 8 + 4, 28, texel(face, Math.floor(s * 2), Math.floor(t * 2)));
      });
      expectPx('projected t0_dz (0.625, 0.125)', f, 4, 36, [2 * 60 + 10, 10, 0x40, 255]);
      expectPx('projected t0_dz (0.125, 0.625)', f, 12, 36, [10, 2 * 60 + 10, 0x40, 255]);
      const fogA = 0x33 / 255;
      expectPx('vertex fog lrp, fog 0x33', f, 20, 36, [Math.round(255 * fogA), 0, Math.round(255 * (1 - fogA)), 255], 2);
      expectPx('vertex fog lrp, no fog', f, 28, 36, [255, 0, 0, 255]);

      // 7. Occlusion: counts pixels passing depth/stencil, colour mask aside.
      const dsts = [];
      const query = (body) => {
        const dst = p.arenaAlloc(4);
        emit('FENCE', { kind: CONST.FENCEK_OCCLUSION_BEGIN, slot: 1 });
        body();
        emit('FENCE', { kind: CONST.FENCEK_OCCLUSION_END, slot: 2, dst });
        dsts.push(dst);
      };
      emit('CLEAR', { mask: 2, colormask: 15, rgba: 0, z: 1, left: 0, top: 0, right: W, bottom: H });
      raster({ depth_mode: 1, zfunc: 2, zwrite: 1 });
      query(() => quad(ID.FLAT, 0, 40, 8, 48, 0xffffffff));                         // 64
      query(() => quads(ID.FLAT, [[0, 40, 16, 48, () => [0xff00ff00]]]));           // 64 at z 0.5 vs 0.5: LESS fails left half
      raster({ depth_mode: 1, zfunc: 2, zwrite: 1, colormask: 0 });
      // 64 + 0: the second copy in the same draw fails LESS.
      query(() => quads(ID.FLAT, [[16, 40, 24, 48, () => [0xffffffff]], [16, 40, 24, 48, () => [0xffffffff]]]));
      raster({ depth_mode: 0, logic_op: 7 });
      query(() => quads(ID.FLAT, [[24, 40, 28, 44, () => [SRC]], [24, 40, 28, 44, () => [SRC]], [32, 40, 36, 44, () => [SRC]]])); // 48
      query(() => {});                                                               // 0
      f = present();
      const counts = dsts.map((d) => new DataView(p.arenaView(d, 4).slice().buffer).getUint32(0, true));
      check('occlusion counts', JSON.stringify(counts) === JSON.stringify([64, 64, 64, 48, 0]), `got ${counts}`);
      expectPx('occlusion: colour drawn after the count pass', f, 4, 44, [255, 255, 255, 255]);
      expectPx('occlusion: right half drawn', f, 12, 44, [0, 255, 0, 255]);
      expectPx('occlusion: logic XOR twice under a query', f, 25, 41, [0, 0, 0, 255]);
      expectPx('occlusion: logic XOR once under a query', f, 33, 41, lop(7, SRCB, [0, 0, 0, 255]));
    } catch (e) {
      failures.push(`scenario threw: ${e && e.stack || e}`);
    }
    ex.close();
    return { checks, failures, stats: ex.stats ? ex.stats() : null };
  }

  return { run, runD1, run94a, W, H, irShader, TEX_IR };
});
