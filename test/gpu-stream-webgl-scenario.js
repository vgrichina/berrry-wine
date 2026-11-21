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

      // One image may be bound to two slots with independent sampling state.
      // GL1 texture parameters belong to the image, not the texture unit.
      emit('BIND', { count: 2 }, i32s(0, ID.TEXB, ID.SAMP, 1, ID.TEXB, ID.SAMPWRAP));
      clear(0xff000000);
      draw(ID.TWO, quad(0.5, [1, 1, 1, 1], () => [-0.25, 0.5, 1, -0.25, 0.5]));
      f = present();
      expectPx('aliased image: clamp cyan * wrap red', f, 20, 20, [0, 0, 0, 255]);
      emit('BIND', { count: 2 }, i32s(0, ID.TEXB, ID.SAMPWRAP, 1, ID.TEXB, ID.SAMP));
      clear(0xff000000);
      draw(ID.TWO, quad(0.5, [1, 1, 1, 1], () => [-0.25, 0.5, 1, -0.25, 0.5]));
      f = present();
      expectPx('aliased image: reversed slots still independent', f, 20, 20, [0, 0, 0, 255]);
      const aliasDraw = (name, a, b, uv, want, tex = ID.TEXB) => {
        emit('BIND', { count: 2 }, i32s(0, tex, a, 1, tex, b));
        clear(0xff000000);
        draw(ID.TWO, quad(0.5, [1, 1, 1, 1], uv));
        expectPx(name, present(), 20, 20, want);
      };
      emit('SAMPLER', { id: 15, address_u: 3, address_v: 3, min: 2, mag: 2 });
      emit('SAMPLER', { id: 16, address_u: 4, address_v: 3, min: 2, mag: 2, border: 0xff00ffff });
      emit('SAMPLER', { id: 17, address_u: 2, address_v: 3, min: 1, mag: 1 });
      aliasDraw('aliased image: identical samplers', ID.SAMPWRAP, ID.SAMPWRAP,
        () => [-0.25, 0.5, 1, -0.25, 0.5], [255, 0, 0, 255]);
      aliasDraw('aliased image: point * linear', ID.SAMP, 15,
        () => [0.5, 0.5, 1, 0.5, 0.5], [128, 0, 0, 255]);
      aliasDraw('aliased image: linear * point', 15, ID.SAMP,
        () => [0.5, 0.5, 1, 0.5, 0.5], [128, 0, 0, 255]);
      aliasDraw('aliased image: border taps * clamp', 16, ID.SAMP,
        () => [0, 0.5, 1, 0, 0.5], [0, 255, 128, 255]);
      aliasDraw('aliased image: mirror * wrap', 17, ID.SAMPWRAP,
        () => [1.25, 0.5, 1, 1.25, 0.5], [0, 0, 0, 255]);
      aliasDraw('aliased image: one real level excludes zero mip tail', ID.SAMPWRAP, ID.SAMPMIP,
        (x, y) => [x * 4, 0.5, 1, x * 4, 0.5], [0, 255, 255, 255]);
      const redMip = new Uint8Array(8 * 8 * 4);
      for (let i = 0; i < redMip.length; i += 4) redMip.set([255, 0, 0, 255], i);
      emit('UPLOAD', { id: ID.MIP, level: 0, w: 8, h: 8, pitch: 32, src: arenaPut(redMip), bytes: redMip.length });
      aliasDraw('aliased image: no mip * level 1', ID.SAMPWRAP, ID.SAMPMIP,
        (x, y) => [x / 4, y / 4, 1, x / 4, y / 4], [255, 0, 0, 255], ID.MIP);
      aliasDraw('aliased image: level 1 * no mip', ID.SAMPMIP, ID.SAMPWRAP,
        (x, y) => [x / 4, y / 4, 1, x / 4, y / 4], [255, 0, 0, 255], ID.MIP);
      // A later draw's depth rejection still observes the aliased draw's write.
      raster({ depth_mode: 1, zfunc: 2, zwrite: 1 });
      aliasDraw('aliased image: depth write', ID.SAMPWRAP, ID.SAMPWRAP,
        () => [-0.25, 0.5, 1, -0.25, 0.5], [255, 0, 0, 255]);
      draw(ID.FLAT, quad(0.75, [0, 0, 1, 1]));
      expectPx('aliased image: farther draw rejected', present(), 20, 20, [255, 0, 0, 255]);
      const translucent = new Uint8Array([0, 255, 255, 128, 255, 0, 0, 128]);
      emit('UPLOAD', { id: ID.TEXB, w: 2, h: 1, pitch: 8, src: arenaPut(translucent), bytes: 8 });
      raster({ blend: 1, src_rgb: 5, dst_rgb: 6 });
      clear(0xff00ff00);
      emit('BIND', { count: 2 }, i32s(0, ID.TEXB, ID.SAMPWRAP, 1, ID.TEXB, ID.SAMPWRAP));
      draw(ID.TWO, quad(0.5, [1, 1, 1, 1], () => [-0.25, 0.5, 1, -0.25, 0.5]));
      expectPx('aliased image: blend after both samples', present(), 20, 20, [64, 191, 0, 255]);
      check('aliased image: blend RT alpha', near(readback(20, 20, 1, 1)(0, 0), [64, 191, 0, 64], 2));
      raster({});
      // Updates and ID reuse must affect the next draw without cached texels.
      const green = new Uint8Array([0, 255, 0, 255, 0, 255, 0, 255]);
      emit('UPLOAD', { id: ID.TEXB, w: 2, h: 1, pitch: 8, src: arenaPut(green), bytes: 8 });
      aliasDraw('aliased image: updated texels', ID.SAMP, ID.SAMPWRAP,
        () => [-0.25, 0.5, 1, -0.25, 0.5], [0, 255, 0, 255]);
      emit('RELEASE', { id: ID.TEXB });
      emit('CREATE', { id: ID.TEXB, kind: CONST.KIND_TEX2D, fmt: CONST.FMT_A8B8G8R8, levels: 1, width: 2, height: 1 });
      const blue = new Uint8Array([0, 0, 255, 255, 0, 0, 255, 255]);
      emit('UPLOAD', { id: ID.TEXB, w: 2, h: 1, pitch: 8, src: arenaPut(blue), bytes: 8 });
      aliasDraw('aliased image: recreated ID after rebind', ID.SAMP, ID.SAMPWRAP,
        () => [-0.25, 0.5, 1, -0.25, 0.5], [0, 0, 255, 255]);
      emit('CREATE', { id: 18, kind: CONST.KIND_RT, fmt: CONST.FMT_A8B8G8R8, levels: 1, width: 1, height: 2 });
      const rtRows = new Uint8Array([0, 255, 255, 255, 255, 0, 0, 255]);
      emit('UPLOAD', { id: 18, w: 1, h: 2, pitch: 4, src: arenaPut(rtRows), bytes: 8 });
      emit('SAMPLER', { id: 19, address_u: 3, address_v: 1, min: 1, mag: 1 });
      aliasDraw('aliased RT: top-down clamp * wrap', ID.SAMP, 19,
        () => [0.5, -0.25, 1, 0.5, -0.25], [0, 0, 0, 255], 18);

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
    try {
      for (const step of perspectiveMipCases({ GS, p, check })) drain();
    } catch (e) { failures.push(`perspective mip scenario threw: ${e.stack || e}`); }
    try {
      for (const step of viewportCases({ GS, p, check })) drain();
      for (const step of visibilityCases({ GS, p, check })) drain();
      for (const step of linePointCases({ GS, p, check })) drain();
      for (const step of programmedLinePointCases({ GS, p, check })) drain();
    } catch (e) { failures.push(`visibility scenario threw: ${e.stack || e}`); }
    try {
      for (const step of cubeMipCases({ GS, p, check, native: !!(backend && backend.gl) })) drain();
    } catch (e) { failures.push(`cube mip scenario threw: ${e.stack || e}`); }
    try {
      for (const step of blendCases({ GS, p, check })) drain();
    } catch (e) { failures.push(`blend scenario threw: ${e.stack || e}`); }
    try {
      for (const step of fogCases({ GS, p, check, native: !!(backend && backend.gl) })) drain();
    } catch (e) { failures.push(`fog scenario threw: ${e.stack || e}`); }
    try {
      for (const step of cubeSamplerCases({ GS, p, check, negative: !!(backend && backend.gl) })) {
        let error;
        try { drain(); } catch (e) { error = e; }
        if (step.error) check('stale cube binding refused', /texture 103 was released/.test(String(error)), String(error));
        else if (error) throw error;
      }
    } catch (e) { failures.push(`cube sampler scenario threw: ${e.stack || e}`); }
    ex.close();
    return { checks, failures, stats: ex.stats ? ex.stats() : null };
  }

  // Yield after publishing each readback, before examining its bytes. The
  // synchronous executor and the production RenderWorker run identical inputs;
  // the latter awaits its real kick reply at each yield. No scratch dependency.
  function* cubeSamplerCases({ GS, p, check, capture = () => {}, negative = false }) {
    const C = GS.CONST, size = 16, rt = 100, layout = 101, ps = 102, image = 103, copy = 104;
    const emit = (...args) => p.emit(...args);
    const put = (b) => { const at = p.arenaAlloc(b.length); p.arenaView(at, b.length).set(b); return at; };
    const words = (...v) => new Uint8Array(new Uint32Array(v).buffer);
    emit('CREATE', { id: rt, kind: C.KIND_RT, fmt: C.FMT_A8B8G8R8, levels: 1, width: size, height: size });
    emit('TARGETS', { color: rt });
    const elems = new Uint8Array(24), dv = new DataView(elems.buffer);
    [C.USAGE_POSITIONT, C.USAGE_TEXCOORD, C.USAGE_TEXCOORD].forEach((usage, i) => {
      elems[i * 8 + 1] = C.VTYPE_FLOAT4; elems[i * 8 + 2] = usage; elems[i * 8 + 3] = i === 2 ? 1 : 0;
      dv.setUint16(i * 8 + 4, i * 16, true);
    });
    emit('LAYOUT', { id: layout, count: 3, stride: 48 }, elems);
    const ir = irShader([[OPC.TEXLD, R0, 0xB0E40000], [OPC.TEXLD, R1, 0xB0E40001], [OPC.MUL, R0S, SRC_R0, SRC_R1]]);
    emit('SHADER', { id: ps, stage: 1, ir_bytes: ir.length }, ir);
    emit('RASTER', { depth_mode: 0, zfunc: 8, cull: 1, src_rgb: 2, dst_rgb: 1, src_alpha: 2, dst_alpha: 1,
      blend_op: 1, blend_op_alpha: 1, alpha_func: 8, colormask: 15, fill: 3, linear: 1,
      scissor_right: size, scissor_bottom: size });
    const sampler = (id, min, mag, mip = 0) => emit('SAMPLER', { id, address_u: 3, address_v: 3, min, mag, mip });
    sampler(105, 1, 1); sampler(106, 2, 2); sampler(107, 2, 1); sampler(108, 1, 2);
    sampler(109, 1, 1, 1); sampler(110, 2, 2, 2);
    const create = (id, levels = 3) => emit('CREATE', { id, kind: C.KIND_CUBE, fmt: C.FMT_A8B8G8R8, levels, width: 4, height: 4 });
    const upload = (id, green = false, levels = 3) => {
      for (let face = 0; face < 6; face++) for (let level = 0; level < levels; level++) {
        const w = 4 >> level, b = new Uint8Array(w * w * 4);
        for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) b.set(green ? [0, 255, 0, 255]
          : level ? [20 + face * 30, level * 90, 255 - level * 70, 255]
            : (x + y) % 2 ? [0, 255, 255, 255] : [255, 0, 0, 255], (y * w + x) * 4);
        emit('UPLOAD', { id, face, level, w, h: w, pitch: w * 4, bytes: b.length, src: put(b) });
      }
    };
    create(image); create(copy); upload(image); upload(copy);
    const draw = (a, b, distinct, direction, rebind = true) => {
      emit('CLEAR', { mask: 1, colormask: 15, rgba: 0xff223344, right: size, bottom: size });
      if (rebind) emit('BIND', { count: 2 }, words(0, image, a, 1, distinct ? copy : image, b));
      const v = [];
      for (const [x, y] of [[0, 0], [size, 0], [0, size], [size, 0], [size, size], [0, size]]) {
        const d = direction(x, y); v.push(x - 0.5, y - 0.5, 0.5, 1, ...d, 1, ...d, 1);
      }
      emit('DRAW_UP', { prim: C.PRIM_TRIANGLELIST, ps, layout, stride: 48, count: 6, vcount: 6,
        voff: put(new Uint8Array(new Float32Array(v).buffer)) });
    };
    let stamp = 2000;
    function* read(name) {
      const dst = p.arenaAlloc(size * size * 4 + 8); p.arenaView(dst, size * size * 4 + 8).fill(0xa7);
      emit('READBACK', { rt, fmt: C.FMT_A8B8G8R8, w: size, h: size, pitch: size * 4, dst });
      emit('PRESENT', { rt, w: size, h: size, surface: 94, stamp: ++stamp });
      yield { name, stamp, dst, size };
      const pixels = p.arenaView(dst, size * size * 4).slice();
      check(name + ' canary', p.arenaView(dst + pixels.length, 8).every(v => v === 0xa7));
      check(name + ' ring retired', p.load('read_pos') === p.load('write_pos') && p.load('error_code') === 0);
      capture(name, pixels); p.store('arena_tail', p.load('arena_head'));
      return pixels;
    }
    const center = (d) => () => d;
    const cases = [];
    for (const [face, d] of [[0, [1, 0, 0]], [1, [-1, 0, 0]], [2, [0, 1, 0]], [3, [0, -1, 0]], [4, [0, 0, 1]], [5, [0, 0, -1]]]) {
      cases.push([`face-${face}-point-linear`, 105, 106, center(d), [128, 0, 0, 255]]);
    }
    cases.push(['reverse-linear-point', 106, 105, center([1, 0, 0]), [128, 0, 0, 255]],
      ['same-point', 105, 105, center([1, 0, 0]), [255, 0, 0, 255]],
      ['same-linear', 106, 106, center([1, 0, 0]), [64, 64, 64, 255]],
      ['min-mag', 107, 108, (x, y) => [1, (y - 8) * 0.8, (x - 8) * 0.8]],
      ['mip-none-point', 105, 109, (x, y) => [1, (y - 8) * 0.8, (x - 8) * 0.8]],
      ['mip-point-linear', 109, 110, (x, y) => [1, (y - 8) * 0.8, (x - 8) * 0.8]],
      ['mip-linear-none', 110, 105, (x, y) => [1, (y - 8) * 0.8, (x - 8) * 0.8]],
      ['seam-xz', 105, 106, (x, y) => [1, (y - 8) * 0.02, 1 + (x - 8) * 0.02]],
      ['corner-xyz', 106, 105, (x, y) => [1, 1 + (y - 8) * 0.02, 1 + (x - 8) * 0.02]],
      ['scaled-direction', 105, 106, center([7, 0, 0]), [128, 0, 0, 255]]);
    for (const [name, a, b, dir, want] of cases) {
      draw(a, b, true, dir); const reference = yield* read(name + '-distinct');
      draw(a, b, false, dir); const aliased = yield* read(name + '-alias');
      check(name + ' independent slots equal distinct images', aliased.every((v, i) => Math.abs(v - reference[i]) <= 1));
      if (want) check(name + ' independent reference', want.every((v, i) => Math.abs(v - aliased[(8 * size + 8) * 4 + i]) <= 2));
    }
    // Repeated sampler changes, explicit unbind/rebind, mutation and ID reuse
    // exercise cached copies as well as first allocation.
    emit('BIND', { count: 1 }, words(1, 0, 0));
    sampler(111, 2, 2); draw(105, 111, false, center([1, 0, 0]));
    const changed = yield* read('unbind-rebind-new-sampler');
    check('unbind/rebind state', Math.abs(changed[(8 * size + 8) * 4] - 128) <= 2);
    emit('RELEASE', { id: 111 }); sampler(111, 1, 1);
    draw(105, 111, false, center([1, 0, 0])); const reused = yield* read('sampler-id-reuse');
    check('sampler ID reuse state', reused[(8 * size + 8) * 4] === 255);
    // COPY writes must invalidate the same shadow as UPLOAD, including
    // subrects, cube faces/mips and the opaque-alpha conversion path.
    for (const [name, face, level, opaque] of [['copy-subrect', 0, 0, 0], ['copy-opaque-mip', 1, 1, 1]]) {
      emit('CLEAR', { mask: 1, colormask: 15, rgba: 0x4000ff00, right: size, bottom: size });
      for (const dst of [image, copy]) emit('COPY', { src: rt, dst, sw: 2, sh: 2, dx: level ? 0 : 1, dy: level ? 0 : 1,
        dw: 2, dh: 2, filter: 1 | (level << 8) | (face << 16) | (opaque << 24) });
      const direction = level ? (x, y) => [-1, (y - 8) * 0.8, (x - 8) * 0.8] : center([1, 0, 0]);
      draw(105, level ? 110 : 106, true, direction); const reference = yield* read(name + '-distinct');
      draw(105, level ? 110 : 106, false, direction); const aliased = yield* read(name + '-alias');
      check(name + ' refreshes cube alias', aliased.every((v, i) => Math.abs(v - reference[i]) <= 1));
    }
    upload(image, true); upload(copy, true);
    draw(105, 106, false, center([1, 0, 0])); const updated = yield* read('updated-face-levels');
    check('upload refreshes alias', updated[(8 * size + 8) * 4 + 1] === 255 && updated[(8 * size + 8) * 4] === 0);
    emit('RELEASE', { id: image }); create(image); upload(image, true);
    draw(105, 106, false, center([-1, 0, 0])); const replaced = yield* read('image-id-reuse-rebind');
    check('image ID reuse rebind', replaced[(8 * size + 8) * 4 + 1] === 255);
    // A partial real chain still needs the same completeness tail and level
    // limit as the distinct native cube on this GL version.
    for (const id of [image, copy]) { emit('RELEASE', { id }); create(id, 2); upload(id, false, 2); }
    const minified = (x, y) => [1, (y - 8) * 1.5, (x - 8) * 1.5];
    draw(105, 110, true, minified); const truncated = yield* read('truncated-mips-distinct');
    draw(105, 110, false, minified); const aliasTail = yield* read('truncated-mips-alias');
    check('truncated cube mip chain preserved', aliasTail.every((v, i) => Math.abs(v - truncated[i]) <= 1));
    if (negative) {
      emit('RELEASE', { id: image }); create(image);
      draw(105, 106, false, center([1, 0, 0]), false);
      const dst = p.arenaAlloc(8); p.arenaView(dst, 8).fill(0x9b);
      emit('READBACK', { rt, fmt: C.FMT_A8B8G8R8, w: 1, h: 1, pitch: 4, dst });
      emit('PRESENT', { rt, w: size, h: size, surface: 94, stamp: ++stamp });
      yield { name: 'stale-cube-negative', error: true, stamp };
      check('invalid cube draw stops readback', p.arenaView(dst, 8).every(v => v === 0x9b));
      check('invalid cube draw records error', p.load('error_code') !== 0);
      return;
    }
    for (const id of [rt, layout, ps, image, copy, 105, 106, 107, 108, 109, 110, 111]) emit('RELEASE', { id });
    yield { name: 'release-all' };
  }

  // Perspective coordinates are quotients of affine planes. Evaluate those
  // planes independently at pixel centres and at their 2x2 derivative peers;
  // do not use the executor's shader helpers as the sampling oracle.
  function* perspectiveMipCases({ GS, p, check, capture = () => {}, negative = false }) {
    const C = GS.CONST, size = 64, rt = 200, layout = 201, ps = 202, image = 203, copy = 204;
    const emit = (...a) => p.emit(...a);
    const put = b => { const at = p.arenaAlloc(b.length); p.arenaView(at, b.length).set(b); return at; };
    const words = (...v) => new Uint8Array(new Uint32Array(v).buffer);
    emit('CREATE', { id: rt, kind: C.KIND_RT, fmt: C.FMT_A8B8G8R8, levels: 1, width: size, height: size });
    emit('TARGETS', { color: rt });
    const elems = new Uint8Array(24), dv = new DataView(elems.buffer);
    [C.USAGE_POSITIONT, C.USAGE_TEXCOORD, C.USAGE_TEXCOORD].forEach((usage, i) => {
      elems[i * 8 + 1] = C.VTYPE_FLOAT4; elems[i * 8 + 2] = usage; elems[i * 8 + 3] = i === 2 ? 1 : 0;
      dv.setUint16(i * 8 + 4, i * 16, true);
    });
    emit('LAYOUT', { id: layout, count: 3, stride: 48 }, elems);
    emit('SHADER', { id: ps, stage: 1, ir_bytes: TWO_IR.length }, TWO_IR);
    emit('RASTER', { depth_mode: 0, zfunc: 8, cull: 1, src_rgb: 2, dst_rgb: 1, src_alpha: 2, dst_alpha: 1,
      blend_op: 1, blend_op_alpha: 1, alpha_func: 8, colormask: 15, fill: 3, linear: 0,
      scissor_right: size, scissor_bottom: size });
    const q = x => 1 - 0.9 * x / size;
    const uv = (slot, x) => slot ? [0.91 - 0.008 * x / q(x), 0.37] : [-0.23 + 0.023 * x / q(x), 0.61];
    const mod = (n, d) => ((n % d) + d) % d;
    const color = (x, y, l) => [20 + (11 * x + 3 * y + 43 * l) % 190,
      30 + (5 * x + 13 * y + 37 * l) % 180, 40 + (7 * x + 9 * y + 29 * l) % 170, 255];
    const sample = (w, h, levels, s, slot, x) => {
      const coord = uv(slot, x), a = uv(slot, x & ~1), b = uv(slot, (x & ~1) + 1);
      const lod = Math.log2(Math.hypot((b[0] - a[0]) * w, (b[1] - a[1]) * h)) + s.bias;
      const linear = (lod <= 0 ? s.mag : s.min) === 2;
      const L = Math.min(Math.max(lod, s.low), levels - 1);
      const fold = (u, mode) => mode === 1 ? mod(u, 1) : mode === 2 ? 1 - Math.abs(1 - mod(u, 2))
        : mode === 3 ? Math.min(Math.max(u, 0), 1) : Math.min(Math.max(u, -1), 2);
      const atLevel = l => {
        const z = [Math.max(1, w >> l), Math.max(1, h >> l)];
        const c = coord.map((u, i) => fold(u, s.addr[i]) * z[i] - (linear ? 0.5 : 0));
        const at = (x, y) => {
          const taps = [x, y].map((v, i) => s.addr[i] === 1 ? mod(v, z[i]) : s.addr[i] === 2
            ? Math.min(mod(v, 2 * z[i]), 2 * z[i] - 1 - mod(v, 2 * z[i])) : Math.min(Math.max(v, 0), z[i] - 1));
          if ([x, y].some((v, i) => s.addr[i] === 4 && (v < 0 || v >= z[i]))) return s.border;
          return color(taps[0], taps[1], l);
        };
        const ix = Math.floor(c[0]), iy = Math.floor(c[1]);
        if (!linear) return at(ix, iy);
        const fx = c[0] - ix, fy = c[1] - iy, taps = [at(ix, iy), at(ix + 1, iy), at(ix, iy + 1), at(ix + 1, iy + 1)];
        return taps[0].map((_, k) => (taps[0][k] * (1 - fx) + taps[1][k] * fx) * (1 - fy)
          + (taps[2][k] * (1 - fx) + taps[3][k] * fx) * fy);
      };
      const l = s.mip === 1 ? Math.floor(L + 0.5) : s.mip === 2 ? Math.floor(L) : 0;
      const a0 = atLevel(l), r = s.mip === 2 ? L - l : 0;
      return { lod, color: r ? a0.map((v, k) => v * (1 - r) + atLevel(l + 1)[k] * r) : a0 };
    };
    let stamp = 3000;
    const samplers = [
      { min: 1, mag: 2, mip: 1, addr: [1, 2], bias: 0, low: 0, border: [71, 113, 157, 255] },
      { min: 2, mag: 1, mip: 2, addr: [4, 3], bias: 0.25, low: 0, border: [71, 113, 157, 255] },
    ];
    for (const [w, h, levels] of [[16, 8, 5], [16, 8, 2], [15, 7, 4], [15, 7, 2], [9, 5, 1]]) {
      for (const id of [image, copy]) {
        emit('CREATE', { id, kind: C.KIND_TEX2D, fmt: C.FMT_A8B8G8R8, width: w, height: h, levels });
        for (let l = 0; l < levels; l++) {
          const lw = Math.max(1, w >> l), lh = Math.max(1, h >> l), b = new Uint8Array(lw * lh * 4);
          for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) b.set(color(x, y, l), (y * lw + x) * 4);
          emit('UPLOAD', { id, level: l, w: lw, h: lh, pitch: lw * 4, bytes: b.length, src: put(b) });
        }
      }
      for (const mode of ['mixed', 'no-mip', 'max-level', 'point', 'linear', 'point-no-mip', 'linear-no-mip', 'reverse-mirror']) {
        const ss = samplers.map((_, i) => {
          const s = samplers[mode === 'reverse-mirror' ? 1 - i : i];
          return { ...s, min: mode.startsWith('point') ? 1 : mode.startsWith('linear') ? 2 : s.min,
            mag: mode.startsWith('point') ? 1 : mode.startsWith('linear') ? 2 : s.mag,
            addr: mode === 'reverse-mirror' ? [i ? 1 : 2, i ? 4 : 3] : s.addr,
            mip: mode.includes('no-mip') ? 0 : s.mip, low: mode === 'max-level' ? Math.min(1, levels - 1) : 0 };
        });
        ss.forEach((s, i) => emit('SAMPLER', { id: 205 + i, min: s.min, mag: s.mag, mip: s.mip,
          address_u: s.addr[0], address_v: s.addr[1], lod_bias: s.bias, max_level: s.low, border: 0xff9d7147 }));
        let reference;
        for (const distinct of [true, false]) {
          const name = `${w}x${h}-L${levels}-${mode}-${distinct ? 'distinct' : 'alias'}`;
          emit('CLEAR', { mask: 1, colormask: 15, rgba: 0xff223344, right: size, bottom: size });
          emit('BIND', { count: 2 }, words(0, image, 205, 1, distinct ? copy : image, 206));
          const v = [];
          for (const [x, y] of [[0, 0], [size, 0], [0, size], [size, 0], [size, size], [0, size]])
            v.push(x, y, 0.5, q(x), ...uv(0, x), 0, 1, ...uv(1, x), 0, 1);
          emit('DRAW_UP', { prim: C.PRIM_TRIANGLELIST, ps, layout, stride: 48, count: 6, vcount: 6,
            voff: put(new Uint8Array(new Float32Array(v).buffer)) });
          const dst = p.arenaAlloc(size * size * 4 + 8); p.arenaView(dst, size * size * 4 + 8).fill(0xa7);
          emit('READBACK', { rt, fmt: C.FMT_A8B8G8R8, w: size, h: size, pitch: size * 4, dst });
          emit('PRESENT', { rt, w: size, h: size, surface: 95, stamp: ++stamp });
          yield { name, stamp, dst, size };
          const pixels = p.arenaView(dst, size * size * 4).slice();
          capture(name, pixels);
          check(name + ' canary', p.arenaView(dst + pixels.length, 8).every(v => v === 0xa7));
          check(name + ' ring retired', p.load('read_pos') === p.load('write_pos') && p.load('error_code') === 0);
          for (const x of [4, 8, 10, 12, 20, 28, 36, 44, 52, 58, 60]) {
            const samples = ss.map((s, i) => sample(w, h, levels, s, i, x));
            const want = samples[0].color.map((c, k) => Math.round(c * samples[1].color[k] / 255));
            const got = [...pixels.subarray((16 * size + x) * 4, (16 * size + x) * 4 + 4)];
            check(name + ` analytical x=${x}`, got.every((c, k) => Math.abs(c - want[k]) <= 3),
              `got ${got}, expected ${want}, LOD ${samples.map(s => s.lod.toFixed(3))}`);
          }
          if (distinct) reference = pixels;
          else check(name + ' equals distinct images', pixels.every((v, i) => Math.abs(v - reference[i]) <= 1));
          p.store('arena_tail', p.load('arena_head'));
        }
        for (const id of [205, 206]) emit('RELEASE', { id });
      }
      if (w === 15 && levels === 2) {
        const lw = w >> 1, lh = h >> 1;
        for (const id of [205, 206]) emit('SAMPLER', { id, min: 1, mag: 1, mip: 1,
          address_u: 1, address_v: 2, lod_bias: 10, max_level: 1 });
        for (const kind of ['upload-edge', 'copy-edge', 'copy-opaque-edge']) {
          emit('CLEAR', { mask: 1, colormask: 15, rgba: 0x4000ff00, right: size, bottom: size });
          for (const id of [image, copy]) {
            if (kind === 'upload-edge') {
              const b = new Uint8Array([180, 220, 60, 255]);
              emit('UPLOAD', { id, level: 1, x: lw - 1, y: lh - 1, w: 1, h: 1, pitch: 4, bytes: 4, src: put(b) });
            } else emit('COPY', { src: rt, dst: id, sw: 1, sh: 1, dx: lw - 1, dy: lh - 1, dw: 1, dh: 1,
              filter: 1 | (1 << 8) | (kind === 'copy-opaque-edge' ? 1 << 24 : 0) });
          }
          emit('BIND', { count: 2 }, words(0, image, 205, 1, image, 206));
          const v = [];
          for (const [x, y] of [[0, 0], [size, 0], [0, size], [size, 0], [size, size], [0, size]]) {
            const t = [(lw - 0.5) / lw, (lh - 0.5) / lh, 0, 1];
            v.push(x, y, 0.5, q(x), ...t, ...t);
          }
          emit('DRAW_UP', { prim: C.PRIM_TRIANGLELIST, ps, layout, stride: 48, count: 6, vcount: 6,
            voff: put(new Uint8Array(new Float32Array(v).buffer)) });
          const dst = p.arenaAlloc(size * size * 4 + 8); p.arenaView(dst, size * size * 4 + 8).fill(0xa7);
          emit('READBACK', { rt, fmt: C.FMT_A8B8G8R8, w: size, h: size, pitch: size * 4, dst });
          emit('PRESENT', { rt, w: size, h: size, surface: 95, stamp: ++stamp });
          yield { name: kind, stamp, dst, size };
          const pixels = p.arenaView(dst, size * size * 4).slice(), at = (16 * size + 8) * 4;
          const got = [...pixels.subarray(at, at + 4)];
          const want = kind === 'upload-edge' ? [127, 190, 14, 255] : [0, 255, 0, kind === 'copy-edge' ? 16 : 255];
          check(kind + ' last logical texel at mip 1', got.every((c, i) => Math.abs(c - want[i]) <= 1), `got ${got}, expected ${want}`);
          check(kind + ' canary', p.arenaView(dst + pixels.length, 8).every(v => v === 0xa7));
          capture(kind, pixels); p.store('arena_tail', p.load('arena_head'));
        }
        for (const id of [205, 206]) emit('RELEASE', { id });
      }
      for (const id of [image, copy]) emit('RELEASE', { id });
    }
    if (negative) {
      emit('CREATE', { id: image, kind: C.KIND_TEX2D, fmt: C.FMT_A8B8G8R8, width: 9, height: 5, levels: 1 });
      const v = new Float32Array(6 * 12);
      emit('DRAW_UP', { prim: C.PRIM_TRIANGLELIST, ps, layout, stride: 48, count: 6, vcount: 6, voff: put(new Uint8Array(v.buffer)) });
      const dst = p.arenaAlloc(8); p.arenaView(dst, 8).fill(0x9b);
      emit('READBACK', { rt, fmt: C.FMT_A8B8G8R8, w: 1, h: 1, pitch: 4, dst });
      emit('PRESENT', { rt, w: size, h: size, surface: 95, stamp: ++stamp });
      yield { name: 'stale-2d-negative', error: true, stamp };
      check('invalid 2D draw stops readback', p.arenaView(dst, 8).every(v => v === 0x9b));
      check('invalid 2D draw records error', p.load('error_code') !== 0);
      return;
    }
    for (const id of [rt, layout, ps]) emit('RELEASE', { id });
    yield { name: 'release-perspective' };
  }


  // Independent face-interior cube oracle. Constant major-axis directions
  // give an exact isotropic footprint shared by native cube and software LOD.
  // Seams/corners are native controls (alias vs distinct), not software oracles.
  function* cubeMipCases({ GS, p, check, capture = () => {}, negative = false, npot = false, native = false, observe = () => {}, quick = false, manySamplers = false }) {
    const C = GS.CONST, size = 32, rt = 300, layout = 301, ps = 302, image = 303, copy = 304;
    const emit = (...args) => p.emit(...args);
    const put = b => { const at = p.arenaAlloc(b.length); p.arenaView(at, b.length).set(b); return at; };
    const words = (...v) => new Uint8Array(new Uint32Array(v).buffer);
    emit('CREATE', { id: rt, kind: C.KIND_RT, fmt: C.FMT_A8B8G8R8, levels: 1, width: size, height: size });
    emit('TARGETS', { color: rt });
    const elems = new Uint8Array(24), dv = new DataView(elems.buffer);
    [C.USAGE_POSITIONT, C.USAGE_TEXCOORD, C.USAGE_TEXCOORD].forEach((usage, i) => {
      elems[i * 8 + 1] = C.VTYPE_FLOAT4; elems[i * 8 + 2] = usage; elems[i * 8 + 3] = i === 2 ? 1 : 0;
      dv.setUint16(i * 8 + 4, i * 16, true);
    });
    emit('LAYOUT', { id: layout, count: 3, stride: 48 }, elems);
    const ir = irShader([[OPC.TEXLD, R0, 0xB0E40000], [OPC.TEXLD, R1, 0xB0E40001], [OPC.MUL, R0S, SRC_R0, SRC_R1]]);
    emit('SHADER', { id: ps, stage: 1, ir_bytes: ir.length }, ir);
    emit('RASTER', { depth_mode: 0, zfunc: 8, cull: 1, src_rgb: 2, dst_rgb: 1, src_alpha: 2, dst_alpha: 1,
      blend_op: 1, blend_op_alpha: 1, alpha_func: 8, colormask: 15, fill: 3, linear: 1,
      scissor_right: size, scissor_bottom: size });
    const color = (f, l, x, y) => [25 + (31 * x + 7 * y + 43 * l + 19 * f) % 190,
      20 + (11 * x + 29 * y + 37 * l + 23 * f) % 200, 30 + (17 * x + 13 * y + 53 * l + 11 * f) % 180, 255];
    const direction = (face, u, v) => [[1, -v, -u], [-1, -v, u], [u, 1, v], [u, -1, -v], [u, -v, 1], [-u, -v, -1]][face];
    const sample = (w, levels, face, s, raw, slot) => {
      const lod = raw + s.bias, linear = (lod <= 0 ? s.mag : s.min) === 2;
      const L = Math.min(Math.max(lod, s.low), levels - 1);
      const atLevel = l => {
        const n = Math.max(1, w >> l), u = (slot ? 0.3125 : 0.4375) * n - (linear ? 0.5 : 0), x = Math.floor(u), f = u - x;
        const at = (x, y) => color(face, l, Math.max(0, Math.min(n - 1, x)), Math.max(0, Math.min(n - 1, y)));
        if (!linear) return at(x, x);
        const taps = [at(x, x), at(x + 1, x), at(x, x + 1), at(x + 1, x + 1)];
        return taps[0].map((_, k) => (taps[0][k] * (1 - f) + taps[1][k] * f) * (1 - f)
          + (taps[2][k] * (1 - f) + taps[3][k] * f) * f);
      };
      const l = !s.mip ? 0 : s.mip === 1 ? Math.floor(L + 0.5) : Math.floor(L), a = atLevel(l);
      const r = s.mip === 2 ? L - l : 0;
      return r ? a.map((v, k) => v * (1 - r) + atLevel(l + 1)[k] * r) : a;
    };
    let stamp = 4000;
    function* read(name) {
      const dst = p.arenaAlloc(size * size * 4 + 8); p.arenaView(dst, size * size * 4 + 8).fill(0xa7);
      emit('READBACK', { rt, fmt: C.FMT_A8B8G8R8, w: size, h: size, pitch: size * 4, dst });
      emit('PRESENT', { rt, w: size, h: size, surface: 96, stamp: ++stamp });
      yield { name, stamp, dst, size };
      const pixels = p.arenaView(dst, size * size * 4).slice();
      check(name + ' canary', p.arenaView(dst + pixels.length, 8).every(v => v === 0xa7));
      check(name + ' ring retired', p.load('read_pos') === p.load('write_pos') && p.load('error_code') === 0);
      capture(name, pixels); p.store('arena_tail', p.load('arena_head')); return pixels;
    }
    if (manySamplers) {
      // Eight mixed native cube samplers plus fog exercise private native
      // magnification views alongside a reserved texture unit.
      emit('RELEASE', { id: ps });
      const instructions = [[OPC.TEXLD, [0, 0, 15], [3, 0, 0xe4], [10, 0, 0]]];
      for (let n = 1; n < 8; n++) instructions.push([OPC.TEXLD, [0, 1, 15], [3, 0, 0xe4], [10, n, 0]],
        [OPC.MUL, [0, 0, 15], [0, 0, 0xe4], [0, 1, 0xe4]]);
      const many = vsIRShader(instructions), header = new DataView(many.buffer);
      header.setUint32(8, 1, true); header.setUint32(12, 0xffff0200, true);
      emit('SHADER', { id: ps, stage: 1, ir_bytes: many.length }, many);
      emit('CREATE', { id: image, kind: C.KIND_CUBE, fmt: C.FMT_A8B8G8R8, width: 4, height: 4, levels: 2 });
      for (let face = 0; face < 6; face++) for (let level = 0; level < 2; level++) {
        const w = 4 >> level, bytes = new Uint8Array(w * w * 4);
        for (let i = 0; i < bytes.length; i += 4) bytes.set([40, 220, 90, 255], i);
        emit('UPLOAD', { id: image, face, level, w, h: w, pitch: w * 4, bytes: bytes.length, src: put(bytes) });
      }
      emit('CREATE', { id: 307, kind: C.KIND_TEX2D, fmt: C.FMT_A8B8G8R8, width: 64, height: 1, levels: 1 });
      emit('SAMPLER', { id: 305, address_u: 3, address_v: 3, min: 1, mag: 2, mip: 1 });
      emit('BIND', { count: 8 }, words(...Array.from({ length: 8 }, (_, n) => [n, image, 305]).flat()));
      emit('RASTER', { depth_mode: 0, zfunc: 8, cull: 1, src_rgb: 2, dst_rgb: 1, src_alpha: 2, dst_alpha: 1,
        blend_op: 1, blend_op_alpha: 1, alpha_func: 8, colormask: 15, fill: 3, linear: 1,
        fog_mode: C.FOG_TABLE_W, fog_table: 307, scissor_right: size, scissor_bottom: size });
      const vertices = new Float32Array([0, 0, 0.5, 1, 1, 0, 0, 1, 1, 0, 0, 1,
        size, 0, 0.5, 1, 1, 0, 0, 1, 1, 0, 0, 1, 0, size, 0.5, 1, 1, 0, 0, 1, 1, 0, 0, 1]);
      emit('DRAW_UP', { prim: C.PRIM_TRIANGLELIST, ps, layout, stride: 48, count: 3, vcount: 3,
        voff: put(new Uint8Array(vertices.buffer)) });
      const pixels = yield* read('many-cube-samplers-fog');
      const at = (8 * size + 8) * 4;
      const want = [40, 220, 90, 255].map(v => Math.round(255 * (v / 255) ** 8));
      check('many native cube samplers draw', want.every((v, k) => Math.abs(pixels[at + k] - v) <= 2),
        'got ' + [...pixels.subarray(at, at + 4)] + ' expected ' + want);
      for (const id of [rt, layout, ps, image, 305, 307]) emit('RELEASE', { id });
      yield { name: 'release-many-cube-samplers' };
      return;
    }
    if (npot === 'unsupported') {
      emit('CREATE', { id: image, kind: C.KIND_CUBE, fmt: C.FMT_A8B8G8R8, width: 3, height: 3, levels: 2 });
      const dst = p.arenaAlloc(8); p.arenaView(dst, 8).fill(0x9b);
      emit('READBACK', { rt, fmt: C.FMT_A8B8G8R8, w: 1, h: 1, pitch: 4, dst });
      emit('PRESENT', { rt, w: size, h: size, surface: 96, stamp: ++stamp });
      yield { name: 'unsupported-npot-cube-mips', error: true, match: 'WebGL1 NPOT cube mip storage', stamp };
      check('unsupported NPOT stops readback', p.arenaView(dst, 8).every(v => v === 0x9b));
      check('unsupported NPOT records error', p.load('error_code') === GS.ERR.UNSUPPORTED);
      return;
    }
    const configs = [
      { name: 'point', min: 1, mag: 1, mip: 1, bias: 0, low: 0 },
      { name: 'linear', min: 2, mag: 2, mip: 2, bias: 0, low: 0 },
      { name: 'bias', min: 1, mag: 1, mip: 1, bias: 2, low: 0 },
      { name: 'negative-bias', min: 2, mag: 2, mip: 2, bias: -2, low: 0 },
      { name: 'max', min: 1, mag: 1, mip: 1, bias: 0, low: 1 },
      { name: 'mixed-max', min: 1, mag: 2, mip: 1, bias: 0, low: 1 },
      { name: 'reverse-mixed', min: 2, mag: 1, mip: 2, bias: 0.25, low: 0 },
      { name: 'max-past-resident', min: 2, mag: 1, mip: 2, bias: 0, low: 7 },
      { name: 'no-mip', min: 1, mag: 2, mip: 0, bias: 0, low: 0 },
    ];
    for (const [w, levels] of (npot === 'base' ? [[3, 1]] : npot ? [[3, 2]] : quick ? [[8, 2]] : [[8, 4], [8, 2], [8, 1]])) {
      for (const id of [image, copy]) {
        emit('CREATE', { id, kind: C.KIND_CUBE, fmt: C.FMT_A8B8G8R8, width: w, height: w, levels });
        for (let f = 0; f < 6; f++) for (let l = 0; l < levels; l++) {
          const n = Math.max(1, w >> l), bytes = new Uint8Array(n * n * 4);
          for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) bytes.set(color(f, l, x, y), (y * n + x) * 4);
          emit('UPLOAD', { id, face: f, level: l, w: n, h: n, pitch: n * 4, bytes: bytes.length, src: put(bytes) });
        }
      }
      for (const cfg of [configs[8], ...configs.slice(0, 8)].filter(c => !quick || ['no-mip', 'bias', 'mixed-max', 'reverse-mixed'].includes(c.name))) {
        const ss = [cfg, { ...cfg, min: cfg.mag, mag: cfg.min, mip: cfg.mip === 1 ? 2 : cfg.mip, bias: cfg.bias - 0.25 }];
        ss.forEach((s, i) => emit('SAMPLER', { id: 305 + i, min: s.min, mag: s.mag, mip: s.mip,
          address_u: 3, address_v: 3, lod_bias: s.bias, max_level: s.low }));
        for (const face of (quick ? [0] : [0, 1, 2, 3, 4, 5])) for (const raw of (quick ? [-2, -1, -0.125, 0.75, 2.25] : [-2, 0.75, 2.25])) {
          let reference;
          for (const distinct of [true, false]) {
            const name = 'cube-' + w + '-L' + levels + '-' + cfg.name + '-f' + face + '-lod' + raw + (distinct ? '-distinct' : '-alias');
            emit('BIND', { count: 2 }, words(0, image, 305, 1, distinct ? copy : image, 306));
            const v = [], slope = 2 ** raw * 2 / w;
            for (const [x, y] of [[0, 0], [size, 0], [0, size], [size, 0], [size, size], [0, size]]) {
              const d = direction(face, -0.125 + (x - 16) * slope, -0.125 + (y - 16) * slope);
              const other = direction(face, -0.375 + (x - 16) * slope, -0.375 + (y - 16) * slope);
              v.push(x, y, 0.5, 1, ...d, 1, ...other, 1);
            }
            emit('DRAW_UP', { prim: C.PRIM_TRIANGLELIST, ps, layout, stride: 48, count: 6, vcount: 6,
              voff: put(new Uint8Array(new Float32Array(v).buffer)) });
            const pixels = yield* read(name), got = [...pixels.subarray((16 * size + 16) * 4, (16 * size + 16) * 4 + 4)];
            const samples = ss.map((s, slot) => sample(w, levels, face, s, raw, slot));
            const want = samples[0].map((c, k) => Math.round(c * samples[1][k] / 255));
            // Native seamless filtering can mix adjacent 1x1 faces even at
            // an interior direction; software clamps each face. Retain the
            // analytical result as an observation instead of changing it.
            const seam = ss.some(s => {
              const lod = raw + s.bias, linear = (lod <= 0 ? s.mag : s.min) === 2;
              const L = Math.min(Math.max(lod, s.low), levels - 1);
              return linear && s.mip && (w >> (s.mip === 1 ? Math.floor(L + 0.5) : Math.ceil(L))) <= 1;
            });
            const implicitLOD = levels === Math.floor(Math.log2(w)) + 1 && ss.some(s =>
              s.mip === 2 && s.min === s.mag && s.bias === 0 && s.low === 0);
            if (native && (seam || implicitLOD)) observe(name, { got, analytical: want,
              reason: seam ? 'native seamless 1x1 faces; software clamps face taps'
                : 'unconstrained native implicit cube LOD differs from projected software LOD' });
            else check(name + ' analytical', got.every((v, k) => Math.abs(v - want[k]) <= 3), 'got ' + got + ' expected ' + want);
            if (distinct) reference = pixels;
            else check(name + ' equals distinct', pixels.every((v, i) => Math.abs(v - reference[i]) <= 1));
          }
        }
        for (const id of [305, 306]) emit('RELEASE', { id });
      }
      if (w === 8 && levels === 2) {
        const define = () => [0, 1].forEach(i => emit('SAMPLER', { id: 305 + i, min: i ? 2 : 1, mag: i ? 1 : 2,
          mip: i ? 1 : 2, address_u: 3, address_v: 3, lod_bias: -2, max_level: 1 }));
        define();
        for (const mode of ['upload', 'copy', 'copy-opaque', 'sampler-reuse', 'image-reuse']) {
          const c = mode === 'upload' ? [20, 220, 60, 255] : mode === 'image-reuse' ? [190, 30, 100, 255] : [60, 180, 90, mode === 'copy' ? 64 : 255];
          if (mode === 'sampler-reuse') { for (const id of [305, 306]) emit('RELEASE', { id }); define(); }
          for (const id of [image, copy]) {
            if (mode === 'image-reuse') {
              emit('RELEASE', { id });
              emit('CREATE', { id, kind: C.KIND_CUBE, fmt: C.FMT_A8B8G8R8, width: w, height: w, levels });
            }
            if (mode.startsWith('copy')) {
              emit('CLEAR', { mask: 1, colormask: 15, rgba: 0x405ab43c, right: size, bottom: size });
              emit('COPY', { src: rt, dst: id, sw: 4, sh: 4, dw: 4, dh: 4,
                filter: 1 | (1 << 8) | (mode === 'copy-opaque' ? 1 << 24 : 0) });
            } else if (mode !== 'sampler-reuse') {
              const bytes = new Uint8Array(4 * 4 * 4); for (let k = 0; k < bytes.length; k += 4) bytes.set(c, k);
              emit('UPLOAD', { id, level: 1, face: 0, w: 4, h: 4, pitch: 16, bytes: bytes.length, src: put(bytes) });
            }
          }
          let reference;
          for (const distinct of [true, false]) {
            emit('BIND', { count: 2 }, words(0, image, 305, 1, distinct ? copy : image, 306));
            const v = [];
            for (const [x, y] of [[0, 0], [size, 0], [0, size], [size, 0], [size, size], [0, size]])
              v.push(x, y, 0.5, 1, 1, 0, 0, 1, 1, 0, 0, 1);
            emit('DRAW_UP', { prim: C.PRIM_TRIANGLELIST, ps, layout, stride: 48, count: 6, vcount: 6,
              voff: put(new Uint8Array(new Float32Array(v).buffer)) });
            const name = 'cube-mip-' + mode + (distinct ? '-distinct' : '-alias'), pixels = yield* read(name);
            const got = [...pixels.subarray((16 * size + 16) * 4, (16 * size + 16) * 4 + 4)], want = c.map(v => Math.round(v * v / 255));
            check(name + ' independent updated level', got.every((v, k) => Math.abs(v - want[k]) <= 2), 'got ' + got + ' expected ' + want);
            if (distinct) reference = pixels;
            else check(name + ' equals distinct', pixels.every((v, i) => Math.abs(v - reference[i]) <= 1));
          }
        }
        for (const id of [305, 306]) emit('RELEASE', { id });
      }
      for (const id of [image, copy]) emit('RELEASE', { id });
    }
    for (const id of [rt, layout, ps]) emit('RELEASE', { id });
    yield { name: 'release-cube-mips' };
  }

  // Independent visibility probes: a rejected fragment must leave both depth
  // and stencil untouched. Subsequent draws turn those planes into RGB.
  function* visibilityCases({ GS, p, check, capture = () => {} }) {
    const C = GS.CONST, size = 16, rt = 401, ds = 402, layout = 403, ps = 404;
    const emit = (op, f, tail) => p.emit(op, f, tail);
    const put = bytes => { const a = p.arenaAlloc(bytes.length); p.arenaView(a, bytes.length).set(bytes); return a; };
    const base = { depth_mode: 1, zfunc: 2, zwrite: 1, cull: 1, src_rgb: 2, dst_rgb: 1,
      src_alpha: 2, dst_alpha: 1, blend_op: 1, blend_op_alpha: 1, alpha_func: 8, colormask: 15,
      fill: 3, linear: 1, scissor_right: size, scissor_bottom: size };
    const stencil = { stencil_enable: 1, stencil_func: 8, stencil_fail: 1, stencil_zfail: 1,
      stencil_pass: 1, stencil_mask: 255, stencil_wmask: 255 };
    const raster = f => emit('RASTER', { ...base, ...f });
    const clear = (f = {}) => emit('CLEAR', { mask: 7, colormask: 15, rgba: 0xff000000,
      z: 1, stencil: 0, right: size, bottom: size, ...f });
    const quad = (rgba, z = 0.25, reverse = false, bounds = [0, 0, size, size], shader = ps) => {
      const [x0, y0, x1, y1] = bounds, corners = [[x0,y0],[x1,y0],[x0,y1],[x1,y1]];
      const order = reverse ? [0,2,1,1,2,3] : [0,1,2,1,3,2];
      const data = new Float32Array(order.flatMap(i => [...corners[i], z, 1, ...rgba]));
      emit('DRAW_UP', { prim: C.PRIM_TRIANGLELIST, ps: shader, layout, stride: 32, count: 6, vcount: 6,
        voff: put(new Uint8Array(data.buffer)) });
    };
    let stamp = 4000;
    function* read(name, want, color = rt) {
      const dst = p.arenaAlloc(size * size * 4);
      emit('READBACK', { rt: color, fmt: C.FMT_A8B8G8R8, x: 0, y: 0, w: size, h: size, pitch: size * 4, dst });
      emit('PRESENT', { rt: color, w: size, h: size, stamp: ++stamp });
      yield { name, stamp, dst, size };
      const pixels = p.arenaView(dst, size * size * 4).slice();
      for (const [x,y] of [[3,5],[11,5],[3,11],[11,11]]) {
        const got = [...pixels.subarray((y * size + x) * 4, (y * size + x) * 4 + 4)];
        const expected = typeof want === 'function' ? want(x,y) : want;
        check(name + ' analytical @' + x + ',' + y, got.every((v,i) => Math.abs(v-expected[i]) <= 1), 'got '+got+' expected '+expected);
      }
      capture(name, pixels);
      p.store('arena_tail', p.load('arena_head'));
    }
    emit('CREATE', { id: rt, kind: C.KIND_RT, fmt: C.FMT_A8B8G8R8, width: size, height: size, levels: 1 });
    emit('CREATE', { id: ds, kind: C.KIND_DS, fmt: C.FMT_D24S8, width: size, height: size, levels: 1 });
    const elems = new Uint8Array(16), dv = new DataView(elems.buffer);
    [C.USAGE_POSITIONT,C.USAGE_COLOR].forEach((usage,i) => { dv.setUint8(i*8+1,C.VTYPE_FLOAT4); dv.setUint8(i*8+2,usage); dv.setUint16(i*8+4,i*16,true); });
    emit('LAYOUT', { id: layout, stride: 32, count: 2 }, elems);
    emit('SHADER', { id: ps, stage: 1, ir_bytes: FLAT_IR.length }, FLAT_IR);
    emit('TARGETS', { color: rt, depth: ds }); emit('BIND', { count: 0 });
    for (const func of [1,2,3,4,5,6,7,8]) for (const alpha of [0,1]) {
      const pass = [false,false,alpha<1,alpha===1,alpha<=1,alpha>1,alpha!==1,alpha>=1,true][func];
      clear();
      raster({ ...stencil, alpha_func: func, alpha_ref: 255, stencil_pass: 3, stencil_ref: 9, colormask: 0 });
      quad([1,0,0,alpha]);
      raster({ ...stencil, stencil_func: 3, stencil_ref: pass ? 9 : 0, zwrite: 0, depth_mode: 0 });
      quad([0,1,0,1],0.5);
      raster({ zwrite: 0 }); quad([0,0,1,1],0.5);
      yield* read('alpha-'+func+'-'+alpha, pass ? [0,255,0,255] : [0,0,255,255]);
    }
    // Constant shader output avoids interpolation precision becoming an
    // equality oracle. Compare adjacent binary32 values around ref/255.
    const cps = 407, constantIR = irShader([[OPC.MOV,R0S,0xa0e40000]]);
    emit('SHADER',{ id: cps, stage: 1, ir_bytes: constantIR.length },constantIR);
    for (const ref of [0,128,255]) {
      const b = Math.fround(ref/255), bits = new Uint32Array(new Float32Array([b]).buffer)[0];
      // ES highp does not promise binary32 subnormal preservation; zero's
      // neighbors here stay inside its required range. Interior edges are
      // the exact adjacent binary32 values, not an epsilon comparison.
      const edges = ref === 0 ? [-1/65536,0,1/65536]
        : [bits-1,bits,bits+1].map(v => new Float32Array(new Uint32Array([v]).buffer)[0]);
      for (const func of [2,3,4,5,6,7]) for (const [edge,alpha] of edges.entries()) {
        const a = Math.min(1,Math.max(0,alpha));
        const pass = [false,false,a<b,a===b,a<=b,a>b,a!==b,a>=b][func];
        clear();
        emit('CONSTS',{ stage: 1, first: 0, count: 1 },new Uint8Array(new Float32Array([1,0,0,alpha]).buffer));
        raster({ ...stencil, alpha_func: func, alpha_ref: ref, stencil_pass: 3, stencil_ref: 9, colormask: 0 });
        quad([1,0,0,1],0.25,false,undefined,cps);
        raster({ ...stencil, stencil_func: 3, stencil_ref: pass ? 9 : 0, zwrite: 0, depth_mode: 0 });
        quad([0,1,0,1],0.5); raster({ zwrite: 0 }); quad([0,0,1,1],0.5);
        yield* read('alpha-edge-'+ref+'-'+func+'-'+edge,pass ? [0,255,0,255] : [0,0,255,255]);
      }
    }
    emit('RELEASE',{ id: cps });
    for (const mask of [0,15,240,255]) {
      clear({ stencil: 165 });
      raster({ ...stencil, stencil_pass: 3, stencil_ref: 60, stencil_wmask: mask, colormask: 0 });
      quad([1,0,0,1]);
      raster({ ...stencil, depth_mode: 0, stencil_func: 3, stencil_ref: (165 & ~mask) | (60 & mask) });
      quad([0,1,0,1]);
      yield* read('masked-write-'+mask,[0,255,0,255]);
      clear({ mask: 4, stencil: 90, left: 8 });
      raster({ ...stencil, depth_mode: 0, stencil_func: 3, stencil_ref: 90, colormask: 1 });
      quad([1,0,0,1]);
      yield* read('clear-after-mask-'+mask,x => x>=8 ? [255,255,0,255] : [0,255,0,255]);
    }
    for (const reverse of [false,true]) {
      clear(); raster({ ...stencil, two_sided: 1, stencil_pass: 3, stencil_ref: 7,
        ccw_func: 8, ccw_fail: 1, ccw_zfail: 1, ccw_pass: 4, colormask: 0 });
      quad([1,0,0,1],0.25,reverse);
      raster({ ...stencil, depth_mode: 0, stencil_func: 3, stencil_ref: reverse ? 1 : 7 });
      quad([0,1,0,1]); yield* read('two-sided-'+reverse,[0,255,0,255]);
    }
    // D3D ignores CCW stencil state for standalone lines and points.
    // GL treats them as front faces, unlike our clockwise triangles (BACK).
    const nontriangle = (prim, alpha = 1) => {
      const xy = prim === C.PRIM_POINTLIST ? [[3,5],[11,5],[3,11],[11,11]]
        : [[1,5],[15,5],[15,11],[1,11]];
      const data = new Float32Array(xy.flatMap(([x,y]) => [x,y,0.25,1,1,0,0,alpha]));
      emit('DRAW_UP', { prim, ps, layout, stride: 32, count: xy.length, vcount: xy.length,
        voff: put(new Uint8Array(data.buffer)) });
    };
    for (const prim of [C.PRIM_POINTLIST,C.PRIM_LINELIST,C.PRIM_LINESTRIP]) for (const two_sided of [0,1,0,1]) {
      clear();
      raster({ ...stencil, two_sided, stencil_pass: 3, stencil_ref: 7,
        ccw_func: 1, ccw_fail: 1, ccw_zfail: 1, ccw_pass: 1, colormask: 0 });
      nontriangle(prim);
      raster({ ...stencil, depth_mode: 0, stencil_func: 3, stencil_ref: 7 });
      quad([0,1,0,1]);
      yield* read('nontriangle-'+prim+'-two-sided-'+two_sided,[0,255,0,255]);
    }
    // Probe each stencil operation path independently, including partial
    // write masks. CLEAR must override the previous draw's write mask.
    for (const prim of [C.PRIM_POINTLIST,C.PRIM_LINELIST,C.PRIM_LINESTRIP]) {
      for (const path of ['fail','zfail','pass']) for (const mask of [0,15,240,255]) {
        clear({ stencil: 165, z: path === 'zfail' ? 0 : 1 });
        raster({ ...stencil, two_sided: 1, stencil_func: path === 'fail' ? 1 : 8,
          stencil_fail: 6, stencil_zfail: 3, stencil_pass: 2, stencil_ref: 60, stencil_wmask: mask,
          ccw_func: 8, ccw_fail: 1, ccw_zfail: 1, ccw_pass: 1, colormask: 0 });
        nontriangle(prim);
        const result = path === 'fail' ? 90 : path === 'zfail' ? 60 : 0;
        raster({ ...stencil, depth_mode: 0, stencil_func: 3, stencil_ref: (165 & (255 ^ mask)) | (result & mask) });
        quad([0,1,0,1]);
        yield* read('nontriangle-'+prim+'-'+path+'-mask-'+mask,[0,255,0,255]);
      }
      // A single sticky RASTER spans triangle -> point/line -> triangle.
      // The CCW triangles reject; only the standalone primitives mark 7.
      clear();
      raster({ ...stencil, two_sided: 1, stencil_pass: 3, stencil_ref: 7,
        ccw_func: 1, ccw_fail: 1, ccw_zfail: 1, ccw_pass: 1, colormask: 0 });
      quad([1,0,0,1],0.125,true); nontriangle(prim); quad([1,0,0,1],0.125,true);
      raster({ ...stencil, stencil_func: 3, stencil_ref: 7, depth_mode: 0 });
      quad([0,1,0,1]);
      yield* read('sticky-triangle-nontriangle-'+prim,[0,255,0,255]);
      // Rejected alpha must not select FAIL/ZFAIL/PASS or write depth.
      for (const path of ['fail','zfail','pass']) {
        clear({ z: path === 'zfail' ? 0 : 1 });
        raster({ ...stencil, two_sided: 1, stencil_func: path === 'fail' ? 1 : 8,
          stencil_fail: 3, stencil_zfail: 3, stencil_pass: 3, stencil_ref: 7,
          ccw_func: 8, ccw_fail: 3, ccw_zfail: 3, ccw_pass: 3,
          alpha_func: 5, alpha_ref: 255, colormask: 0 });
        nontriangle(prim,1);
        raster({ ...stencil, stencil_func: 3, stencil_ref: 0, depth_mode: 0 });
        quad([0,1,0,1]);
        yield* read('nontriangle-alpha-reject-'+prim+'-'+path,[0,255,0,255]);
      }
      clear();
      raster({ ...stencil, two_sided: 1, stencil_pass: 4, zwrite: 0,
        ccw_func: 1, ccw_fail: 1, ccw_zfail: 1, ccw_pass: 1, colormask: 0,
        scissor_left: 8, scissor_top: 8 });
      nontriangle(prim); nontriangle(prim);
      raster({ ...stencil, stencil_func: 3, stencil_ref: 2, depth_mode: 0 });
      quad([0,1,0,1]);
      yield* read('nontriangle-clipped-overlap-'+prim,(x,y) => x>=8 && y>=8 ? [0,255,0,255] : [0,0,0,255]);
      for (const colormask of [0,1,2,4,8,5,10,15]) {
        clear({ rgba: 0x80402010 });
        raster({ ...stencil, two_sided: 1, stencil_pass: 3, stencil_ref: 7, zwrite: 0, colormask,
          ccw_func: 1, ccw_fail: 1, ccw_zfail: 1, ccw_pass: 1 });
        nontriangle(prim);
        yield* read('nontriangle-color-mask-'+prim+'-'+colormask,
          [16,32,64,128].map((v,i) => colormask & (1<<i) ? [255,0,0,255][i] : v));
        raster({ ...stencil, stencil_func: 3, stencil_ref: 7, zwrite: 0 });
        quad([0,0,1,1],0.5);
        yield* read('nontriangle-zwrite-off-'+prim+'-'+colormask,[0,0,255,255]);
      }
    }
    // The occlusion count pass must use the same primitive-specific state
    // without consuming the real pass's stencil/depth writes.
    clear();
    const countDst = p.arenaAlloc(4);
    emit('FENCE',{ kind: C.FENCEK_OCCLUSION_BEGIN });
    raster({ ...stencil, two_sided: 1, stencil_pass: 3, stencil_ref: 7,
      ccw_func: 1, ccw_fail: 1, ccw_zfail: 1, ccw_pass: 1, colormask: 0 });
    nontriangle(C.PRIM_POINTLIST);
    emit('FENCE',{ kind: C.FENCEK_OCCLUSION_END, dst: countDst });
    raster({ ...stencil, stencil_func: 3, stencil_ref: 7, depth_mode: 0 });
    quad([0,1,0,1]);
    yield* read('nontriangle-occlusion',[0,255,0,255]);
    const count = new DataView(p.arenaView(countDst,4).buffer,p.arenaView(countDst,4).byteOffset,4).getUint32(0,true);
    check('four points pass occlusion independently of color mask',count===4,'got '+count+' expected 4');
    const rt2 = 405, ds2 = 406;
    const createTargets = () => {
      emit('CREATE', { id: rt2, kind: C.KIND_RT, fmt: C.FMT_A8B8G8R8, width: size, height: size, levels: 1 });
      emit('CREATE', { id: ds2, kind: C.KIND_DS, fmt: C.FMT_D24S8, width: size, height: size, levels: 1 });
    };
    createTargets();
    for (const reuse of [false,true]) {
      if (reuse) { for (const id of [rt2,ds2]) emit('RELEASE',{id}); createTargets(); }
      emit('TARGETS', { color: rt, depth: ds }); clear();
      raster({ ...stencil, two_sided: 1, stencil_pass: 3, stencil_ref: 7,
        ccw_func: 1, ccw_fail: 1, ccw_zfail: 1, ccw_pass: 1, colormask: 0 });
      nontriangle(C.PRIM_POINTLIST);
      emit('TARGETS', { color: rt2, depth: ds2 });
      clear({ mask: 1 }); // Fresh DS must start at depth 1, stencil 0.
      nontriangle(C.PRIM_LINELIST);
      raster({ ...stencil, stencil_func: 3, stencil_ref: 7, depth_mode: 0 });
      quad([0,1,0,1]);
      yield* read('target-switch-reuse-'+reuse,[0,255,0,255],rt2);
      emit('TARGETS', { color: rt, depth: ds });
      quad([0,1,0,1]);
      yield* read('target-switch-return-'+reuse,[0,255,0,255]);
    }
    for (const id of [rt2,ds2]) emit('RELEASE',{id});
    for (const id of [rt,ds,layout,ps]) emit('RELEASE',{id});
    yield { name: 'release-visibility' };
  }

// Independent blend-factor arithmetic and masked-write lifetime controls.
  function* blendCases({ GS, p, check, capture = () => {} }) {
    const C = GS.CONST, size = 16, rt = 401, ds = 402, layout = 403, ps = 404;
    const emit = (op, f, tail) => p.emit(op, f, tail);
    const put = bytes => { const a = p.arenaAlloc(bytes.length); p.arenaView(a, bytes.length).set(bytes); return a; };
    const base = { depth_mode: 1, zfunc: 2, zwrite: 1, cull: 1, src_rgb: 2, dst_rgb: 1,
      src_alpha: 2, dst_alpha: 1, blend_op: 1, blend_op_alpha: 1, alpha_func: 8, colormask: 15,
      fill: 3, linear: 1, scissor_right: size, scissor_bottom: size };
    const raster = f => emit('RASTER', { ...base, ...f });
    const clear = (f = {}) => emit('CLEAR', { mask: 7, colormask: 15, rgba: 0xff000000,
      z: 1, stencil: 0, right: size, bottom: size, ...f });
    const quad = (rgba, z = 0.25, reverse = false, bounds = [0, 0, size, size], shader = ps) => {
      const [x0, y0, x1, y1] = bounds, corners = [[x0,y0],[x1,y0],[x0,y1],[x1,y1]];
      const order = reverse ? [0,2,1,1,2,3] : [0,1,2,1,3,2];
      const data = new Float32Array(order.flatMap(i => [...corners[i], z, 1, ...rgba]));
      emit('DRAW_UP', { prim: C.PRIM_TRIANGLELIST, ps: shader, layout, stride: 32, count: 6, vcount: 6,
        voff: put(new Uint8Array(data.buffer)) });
    };
    let stamp = 5000;
    function* read(name, want, color = rt) {
      const dst = p.arenaAlloc(size * size * 4);
      emit('READBACK', { rt: color, fmt: C.FMT_A8B8G8R8, x: 0, y: 0, w: size, h: size, pitch: size * 4, dst });
      emit('PRESENT', { rt: color, w: size, h: size, stamp: ++stamp });
      yield { name, stamp, dst, size };
      const pixels = p.arenaView(dst, size * size * 4).slice();
      for (const [x,y] of [[3,5],[11,5],[3,11],[11,11]]) {
        const got = [...pixels.subarray((y * size + x) * 4, (y * size + x) * 4 + 4)];
        const expected = typeof want === 'function' ? want(x,y) : want;
        check(name + ' analytical @' + x + ',' + y, got.every((v,i) => Math.abs(v-expected[i]) <= 1), 'got '+got+' expected '+expected);
      }
      capture(name, pixels);
      p.store('arena_tail', p.load('arena_head'));
    }
    emit('CREATE', { id: rt, kind: C.KIND_RT, fmt: C.FMT_A8B8G8R8, width: size, height: size, levels: 1 });
    emit('CREATE', { id: ds, kind: C.KIND_DS, fmt: C.FMT_D24S8, width: size, height: size, levels: 1 });
    const elems = new Uint8Array(16), dv = new DataView(elems.buffer);
    [C.USAGE_POSITIONT,C.USAGE_COLOR].forEach((usage,i) => { dv.setUint8(i*8+1,C.VTYPE_FLOAT4); dv.setUint8(i*8+2,usage); dv.setUint16(i*8+4,i*16,true); });
    emit('LAYOUT', { id: layout, stride: 32, count: 2 }, elems);
    emit('SHADER', { id: ps, stage: 1, ir_bytes: FLAT_IR.length }, FLAT_IR);
    emit('TARGETS', { color: rt, depth: ds }); emit('BIND', { count: 0 });

    const S=[0.8,0.4,0.2,0.6], D=[51,102,153,77], d=D.map(v=>v/255);
    const factor=(n)=>[null,[0,0,0,0],[1,1,1,1],S,S.map(v=>1-v),Array(4).fill(S[3]),Array(4).fill(1-S[3]),Array(4).fill(d[3]),Array(4).fill(1-d[3]),d,d.map(v=>1-v),[...Array(3).fill(Math.min(S[3],1-d[3])),1]][n];
    for(let a=1;a<=11;a++) for(let b=1;b<=10;b++) {
      clear({rgba:0x4d996633});raster({depth_mode:0,blend:1,src_rgb:a,dst_rgb:b,src_alpha:a,dst_alpha:b});quad(S);
      const A=factor(a),B=factor(b),want=S.map((v,i)=>Math.round(255*Math.min(1,Math.max(0,v*A[i]+d[i]*B[i]))));
      yield* read('factors-'+a+'-'+b,want);
    }

    for(let mask=0;mask<16;mask++) {
      clear({rgba:0x4d996633});raster({depth_mode:0,blend:0,colormask:mask});quad([1,0,1,0]);
      yield* read('mask-'+mask,[255,0,255,0].map((v,i)=>mask&(1<<i)?v:D[i]));
      clear({mask:1,colormask:15,rgba:0x4d996633});raster({depth_mode:0,blend:1,src_rgb:7,dst_rgb:8,src_alpha:2,dst_alpha:1});quad(S);
      yield* read('reenable-'+mask,S.map((v,i)=>Math.round(255*(i===3?v:v*d[3]+d[i]*(1-d[3])))));
    }
    const tex=410,samp=411,tps=412,tl=413;
    emit('CREATE',{id:tex,kind:C.KIND_TEX2D,fmt:C.FMT_A8B8G8R8,width:1,height:1,levels:1});
    const texel=new Uint8Array([200,80,40,128]);emit('UPLOAD',{id:tex,w:1,h:1,pitch:4,bytes:4,src:put(texel)});
    emit('SAMPLER',{id:samp,address_u:3,address_v:3,min:1,mag:1});emit('SHADER',{id:tps,stage:1,ir_bytes:TEX_IR.length},TEX_IR);
    const te=new Uint8Array(24),td=new DataView(te.buffer);[C.USAGE_POSITIONT,C.USAGE_COLOR,C.USAGE_TEXCOORD].forEach((u,i)=>{td.setUint8(i*8+1,C.VTYPE_FLOAT4);td.setUint8(i*8+2,u);td.setUint16(i*8+4,i*16,true)});emit('LAYOUT',{id:tl,stride:48,count:3},te);
    // Keep the query rectangle inside the target: native edge coverage at
    // the framebuffer boundary differs from the software pixel-centre rule.
    const tv=new Float32Array([[2,2],[14,2],[2,14],[14,2],[14,14],[2,14]].flatMap(([x,y])=>[x,y,0.25,1,1,1,1,1,0.5,0.5,0,1]));
    // Source-alpha RGB blend over D, separate alpha = source alpha:
    // round([200,80,40] * 128/255 + D.rgb * 127/255), alpha 128.
    const blended=[126,91,96,128];

    const rt2=414,ds2=415;
    const createPair=()=>{emit('CREATE',{id:rt2,kind:C.KIND_RT,fmt:C.FMT_A8B8G8R8,width:size,height:size,levels:1});emit('CREATE',{id:ds2,kind:C.KIND_DS,fmt:C.FMT_D24S8,width:size,height:size,levels:1});};
    createPair();
    for(const reuse of [false,true]) {
      if(reuse){
        for(const id of [rt2,ds2])emit('RELEASE',{id});createPair();
        emit('RELEASE',{id:tex});
        emit('CREATE',{id:tex,kind:C.KIND_TEX2D,fmt:C.FMT_A8B8G8R8,width:1,height:1,levels:1});
        emit('UPLOAD',{id:tex,w:1,h:1,pitch:4,bytes:4,src:put(texel)});
      }
      for(const target of [rt,rt2,rt])for(const queried of [false,true])for(const mask of [15,7,8,0]) {
        emit('TARGETS',{color:target,depth:target===rt?ds:ds2});
        clear({rgba:0x4d996633});raster({depth_mode:1,blend:1,src_rgb:5,dst_rgb:6,src_alpha:2,dst_alpha:1,colormask:mask,
          stencil_enable:1,stencil_func:8,stencil_fail:1,stencil_zfail:1,stencil_pass:3,stencil_ref:7,stencil_mask:255,stencil_wmask:255});
        emit('BIND',{count:1},new Uint8Array(new Uint32Array([0,tex,samp]).buffer));
        const dst=p.arenaAlloc(4);if(queried)emit('FENCE',{kind:C.FENCEK_OCCLUSION_BEGIN});
        emit('DRAW_UP',{prim:C.PRIM_TRIANGLELIST,ps:tps,layout:tl,stride:48,count:6,vcount:6,voff:put(new Uint8Array(tv.buffer))});
        if(queried)emit('FENCE',{kind:C.FENCEK_OCCLUSION_END,dst});
        yield* read('textured-query-'+reuse+'-'+target+'-'+queried+'-'+mask,blended.map((v,i)=>mask&(1<<i)?v:D[i]),target);
        if(queried){const count=new DataView(p.arenaView(dst,4).slice().buffer).getUint32(0,true);check('textured query count ignores color mask '+mask,count===144,'got '+count+' expected 144');}
        // A COPY must preserve the resulting alpha and ignore the last draw mask.
        const copyTo=target===rt?rt2:rt;
        emit('COPY',{src:target,dst:copyTo,sw:size,sh:size,dw:size,dh:size,filter:1});
        yield* read('copy-query-'+reuse+'-'+target+'-'+queried+'-'+mask,blended.map((v,i)=>mask&(1<<i)?v:D[i]),copyTo);
        // The counting pass must leave depth/stencil for the real pass;
        // color masking must not suppress the real pass's writes to them.
        emit('BIND',{count:0});
        raster({depth_mode:1,zfunc:3,zwrite:0,stencil_enable:1,stencil_func:3,stencil_ref:7,
          stencil_fail:1,stencil_zfail:1,stencil_pass:1,stencil_mask:255,stencil_wmask:0});
        quad([0,1,0,1]);
        yield* read('depth-stencil-query-'+reuse+'-'+target+'-'+queried+'-'+mask,[0,255,0,255],target);
      }
    }
    // Both a newly allocated count target and a reused one must preserve
    // sampler bindings as a single query switches between color targets.
    const switchedCount=p.arenaAlloc(4);
    emit('FENCE',{kind:C.FENCEK_OCCLUSION_BEGIN});
    for(const target of [rt,rt2,rt]) {
      emit('TARGETS',{color:target,depth:target===rt?ds:ds2});clear({rgba:0x4d996633});
      raster({depth_mode:0,blend:1,src_rgb:5,dst_rgb:6,src_alpha:2,dst_alpha:1});
      emit('BIND',{count:1},new Uint8Array(new Uint32Array([0,tex,samp]).buffer));
      emit('DRAW_UP',{prim:C.PRIM_TRIANGLELIST,ps:tps,layout:tl,stride:48,count:6,vcount:6,voff:put(new Uint8Array(tv.buffer))});
      yield* read('single-query-target-'+target,blended,target);
    }
    emit('FENCE',{kind:C.FENCEK_OCCLUSION_END,dst:switchedCount});
    yield {name:'single-query-end'};
    check('single query accumulates across targets',new DataView(p.arenaView(switchedCount,4).slice().buffer).getUint32(0,true)===432);
    emit('TARGETS',{color:rt,depth:ds});clear({rgba:0x4d996633});
    raster({alpha_func:5,alpha_ref:128,stencil_enable:1,stencil_func:8,stencil_ref:7,
      stencil_fail:3,stencil_zfail:3,stencil_pass:3,stencil_mask:255,stencil_wmask:255});
    emit('BIND',{count:1},new Uint8Array(new Uint32Array([0,tex,samp]).buffer));
    const rejectedCount=p.arenaAlloc(4);
    emit('FENCE',{kind:C.FENCEK_OCCLUSION_BEGIN});
    emit('DRAW_UP',{prim:C.PRIM_TRIANGLELIST,ps:tps,layout:tl,stride:48,count:6,vcount:6,voff:put(new Uint8Array(tv.buffer))});
    emit('FENCE',{kind:C.FENCEK_OCCLUSION_END,dst:rejectedCount});
    yield* read('textured-alpha-equality-rejected',D);
    check('alpha rejection counts zero',new DataView(p.arenaView(rejectedCount,4).slice().buffer).getUint32(0,true)===0);
    emit('BIND',{count:0});
    raster({zfunc:3,zwrite:0,stencil_enable:1,stencil_func:3,stencil_ref:0,
      stencil_fail:1,stencil_zfail:1,stencil_pass:1,stencil_mask:255,stencil_wmask:0});
    quad([0,0,1,1],1);
    yield* read('alpha-reject-keeps-depth-stencil',[0,0,255,255]);
    for(const id of [rt2,ds2])emit('RELEASE',{id});
    for(const id of [tex,samp,tps,tl])emit('RELEASE',{id});
    for(const id of [rt,ds,layout,ps])emit('RELEASE',{id});yield {name:'release-blend'};
  }

  function* fogCases({ GS, p, check, native = false, capture = () => {} }) {
      // Stream v2: table R is the fog blend, independent of BIND's sampler;
      // fog changes RGB after shader output, preserving that output's alpha.
      const C = GS.CONST, size = 16, rt = 501, ds = 502, layout = 503, ps = 504;
      const fog = 505, tps = 506, other = 507, copy = 508;
      const emit = (op, f, tail) => p.emit(op, f, tail);
      const put = bytes => { const a = p.arenaAlloc(bytes.length); p.arenaView(a, bytes.length).set(bytes); return a; };
      const base = { depth_mode: 0, zfunc: 2, zwrite: 1, cull: 1, src_rgb: 2, dst_rgb: 1,
        src_alpha: 2, dst_alpha: 1, blend_op: 1, blend_op_alpha: 1, alpha_func: 8, colormask: 15,
        fill: 3, linear: 1, scissor_right: size, scissor_bottom: size };
      const raster = f => emit('RASTER', { ...base, ...f });
      const clear = (f = {}) => emit('CLEAR', { mask: 7, colormask: 15, rgba: 0x4d996633,
        z: 1, stencil: 0, right: size, bottom: size, ...f });
      const create = (id, kind, width = size, height = size, levels = 1) => emit('CREATE',
        { id, kind, fmt: kind === C.KIND_DS ? C.FMT_D24S8 : C.FMT_A8B8G8R8, width, height, levels });
      const bind = (id, sampler) => emit('BIND', { count: id ? 1 : 0 },
        id ? new Uint8Array(new Uint32Array([0, id, sampler]).buffer) : undefined);
      const quad = ({ u = 1 / 64, q = 1, z = 0.25, rgba = [1, 1, 1, 1], shader = tps } = {}) => {
        const data = new Float32Array([[2,2],[14,2],[2,14],[14,2],[14,14],[2,14]]
          .flatMap(([x,y]) => [x,y,z,q,...rgba,u,0.5,0,1]));
        emit('DRAW_UP', { prim: C.PRIM_TRIANGLELIST, ps: shader, layout, stride: 48, count: 6, vcount: 6,
          voff: put(new Uint8Array(data.buffer)) });
      };
      let stamp = 6000;
      function* read(name, want, color = rt) {
        const dst = p.arenaAlloc(size * size * 4);
        emit('READBACK', { rt: color, fmt: C.FMT_A8B8G8R8, w: size, h: size, pitch: size * 4, dst });
        emit('PRESENT', { rt: color, w: size, h: size, stamp: ++stamp });
        yield { name, stamp, dst, size };
        const pixels = p.arenaView(dst, size * size * 4).slice();
        // Stay inside the authored rectangle; native framebuffer boundaries
        // and shared diagonal coverage retain their existing precision rules.
        for (let y = 3; y < 14; y++) for (let x = 3; x < 14; x++) {
          const got = [...pixels.subarray((y * size + x) * 4, (y * size + x) * 4 + 4)];
          check(name + ' analytical @' + x + ',' + y, got.every((v,i) => Math.abs(v-want[i]) <= 1),
            'got ' + got + ' expected ' + want);
        }
        capture(name, pixels);
        p.store('arena_tail', p.load('arena_head'));
      }
      create(rt, C.KIND_RT); create(ds, C.KIND_DS); create(other, C.KIND_RT); create(copy, C.KIND_RT);
      const elems = new Uint8Array(24), dv = new DataView(elems.buffer);
      [C.USAGE_POSITIONT,C.USAGE_COLOR,C.USAGE_TEXCOORD].forEach((usage,i) => {
        dv.setUint8(i*8+1,C.VTYPE_FLOAT4); dv.setUint8(i*8+2,usage); dv.setUint16(i*8+4,i*16,true);
      });
      emit('LAYOUT', { id: layout, stride: 48, count: 3 }, elems);
      emit('SHADER', { id: ps, stage: 1, ir_bytes: FLAT_IR.length }, FLAT_IR);
      emit('SHADER', { id: tps, stage: 1, ir_bytes: TEX_IR.length }, TEX_IR);
      create(fog, C.KIND_TEX2D, 64, 1, 7);
      const table = new Uint8Array(256);
      for (let i = 0; i < 64; i++) table.set(i % 2 ? [255,200,80,128] : [0,40,240,64], i*4);
      emit('UPLOAD', { id: fog, w: 64, h: 1, pitch: 256, bytes: 256, src: put(table) });
      const mip = new Uint8Array(128); for (let i = 0; i < 32; i++) mip.set([50,100,150,200], i*4);
      emit('UPLOAD', { id: fog, level: 1, w: 32, h: 1, pitch: 128, bytes: 128, src: put(mip) });
      const samplers = [510,511,512,513];
      for (let i = 0; i < samplers.length; i++) emit('SAMPLER', { id: samplers[i], address_u: 1, address_v: 3,
        min: i === 1 ? 2 : 1, mag: i === 1 ? 2 : 1, mip: i < 2 ? 0 : i-1, max_level: i < 2 ? 0 : 1 });
      emit('TARGETS', { color: rt, depth: ds }); bind(fog, samplers[0]);
      const source = [255,200,80,128], fogRGB = [20,60,100];
      const mixed = (s, a, flags = 0) => s.map((v,i) => i === 3 ? v : Math.round(
        (flags & 1 ? 0 : v*(1-a)) + (flags & 2 ? 0 : fogRGB[i]*a)));
      const fogState = { fog_mode: 2, fog_table: fog, fog_color: 0x00643c14 };
      // q=1 gives W=0: table[0].r=0, so table fog must leave RGBA alone.
      // Point at u=1/64 selects texel 1; LINEAR would blend texels 0 and 1.
      for (const mode of [0,1,2,3,0,2]) {
        clear(); raster({ ...fogState, fog_mode: mode }); quad();
        yield* read('fog-mode-' + mode, mixed(source, mode === 1 ? 1 : mode === 3 ? 0.25 : 0));
      }
    // Software's negative wrap at an exact texel boundary can round below
    // that boundary during interpolation. Keep that native precision case,
    // and use a quarter-texel interior for the shared software contract.
    for (const u of [1/64,1+1/64,-1+1.25/64,...(native ? [-1+1/64] : [])]) {
        clear(); raster(fogState); quad({ u }); yield* read('shared-fog-wrap-' + u, source);
      }
      // W=0 + depth_bias gives exact table indices 0, 1/4, 1/2, 1.
      for (const bias of [0,256,512,1024,65535]) for (const alpha of [0,255]) {
        const a = bias === 65535 ? 1 : bias/1024;
        clear(); raster({ ...fogState, depth_bias: bias, fog_color: (alpha << 24) | 0x00643c14 }); quad();
        yield* read('fog-factor-' + bias + '-color-alpha-' + alpha, mixed(source,a));
      }
      for (let i = 0; i < samplers.length; i++) {
        bind(fog, samplers[i]);
        const s = i === 0 ? source : i === 1 ? [127.5,120,160,96] : [50,100,150,200];
        clear(); raster({ ...fogState, depth_bias: 512 }); quad();
        yield* read('shared-fog-filter-' + i, mixed(s,0.5));
      }
      bind(fog, samplers[0]);
      // Output alpha is texture alpha times vertex alpha; vertex fog uses
      // vertex alpha itself, independent of the shader result's alpha.
      for (const a of [0,0.25,0.5,1]) {
        clear(); raster({ ...fogState, fog_mode: 1 }); quad({ rgba: [1,1,1,a] });
        yield* read('fog-shader-alpha-' + a, mixed([255,200,80,128*a],a));
      }
      if (native) for (const flags of [1,2,3]) {
        clear(); raster({ ...fogState, depth_bias: 512, fog_flags: flags }); quad();
        yield* read('fog-flags-' + flags, mixed(source,0.5,flags));
      }
      // A nonalias draw changes the image back to native LINEAR fog lookup;
      // returning to the shared draw must restore exact colour fetches.
      bind(0); clear(); raster({ ...fogState, depth_bias: 512 }); quad({ shader: ps, rgba: [1,0,0,0.4] });
      yield* read('fog-nonalias-interpolation', mixed([255,0,0,102],0.5));
      bind(fog, samplers[0]); clear(); raster({ ...fogState, depth_bias: 512 }); quad();
      yield* read('fog-alias-after-nonalias', mixed(source,0.5));
      const stencil = { stencil_enable: 1, stencil_func: 8, stencil_mask: 255, stencil_wmask: 255,
        stencil_fail: 1, stencil_zfail: 1, stencil_pass: 3, stencil_ref: 5 };
      clear(); raster({ ...fogState, ...stencil, depth_mode: 1, alpha_func: 5, alpha_ref: 100 }); quad();
      raster({ ...fogState, ...stencil, depth_mode: 1, stencil_ref: 9 }); quad({ z: 0.75 });
      raster({ ...fogState, ...stencil, depth_mode: 1, stencil_ref: 9, alpha_func: 5, alpha_ref: 128 });
      quad({ z: 0.1, rgba: [1,1,1,0] });
      yield* read('fog-depth-alpha-rejections',source);
      bind(0); raster({ ...stencil, stencil_func: 3, stencil_pass: 1, depth_mode: 1, zfunc: 5 });
      quad({ z: 0.5, shader: ps, rgba: [0,1,0,0.6] });
      yield* read('fog-depth-stencil-stored',[0,255,0,153]);
      bind(fog,samplers[0]);
      for (const target of [other,rt]) {
        emit('TARGETS',{ color: target, depth: ds }); clear(); raster({ ...fogState, depth_bias: 512 }); quad();
        yield* read('fog-target-' + target,mixed(source,0.5),target);
        raster({ colormask: 0 }); clear({ mask: 1, rgba: 0x80503010 });
        yield* read('fog-clear-' + target,[16,48,80,128],target);
        raster({ ...fogState, depth_bias: 512 }); quad();
        emit('COPY',{ src: target, dst: copy, sw:size,sh:size,dw:size,dh:size,filter:1 });
        yield* read('fog-copy-' + target,mixed(source,0.5),copy);
      }
      emit('RELEASE',{ id: other }); create(other,C.KIND_RT); emit('TARGETS',{color:other,depth:ds});
      clear(); raster(fogState); quad(); yield* read('fog-target-reuse',source,other);
      // COPY and partial UPLOAD change the same live table/image; no stale
      // shadow or shader variant may preserve the old texels or fog factors.
      emit('TARGETS',{color:rt,depth:ds}); clear({rgba:0xa0605040});
      emit('COPY',{src:rt,dst:fog,sw:16,sh:1,dw:16,dh:1,filter:1});
      clear(); raster(fogState); quad(); yield* read('fog-table-copy',mixed([64,80,96,160],64/255));
      emit('UPLOAD',{id:fog,w:1,h:1,pitch:4,bytes:4,src:put(new Uint8Array([192,100,120,140]))});
      clear(); raster(fogState); quad(); yield* read('fog-table-partial-upload',mixed([64,80,96,160],192/255));
      bind(0); emit('RELEASE',{id:fog}); create(fog,C.KIND_TEX2D,64,1);
      for(let i=0;i<64;i++)table.set([0,180,40,200],i*4);
      emit('UPLOAD',{id:fog,w:64,h:1,pitch:256,bytes:256,src:put(table)});
      bind(fog,samplers[0]); clear(); raster(fogState); quad(); yield* read('fog-table-reuse',[0,180,40,200]);
      for (const id of [fog,tps,other,copy,...samplers,rt,ds,layout,ps]) emit('RELEASE',{id});
      yield {name:'fog-release'};
    }

  // Integer top-left coverage at a viewport/scissor boundary, including the
  // depth and stencil writes later draws observe, and copied color pixels.
  function* viewportCases({GS,p,check,capture = () => {}}) {
 const C=GS.CONST,S=16,rt=601,ds=602,other=605,ds2=606,layout=603,ps=604;
 const emit=(op,f,tail)=>p.emit(op,f,tail), put=b=>{const a=p.arenaAlloc(b.length);p.arenaView(a,b.length).set(b);return a;};
 const base={depth_mode:1,zfunc:2,zwrite:1,cull:1,src_rgb:2,dst_rgb:1,src_alpha:2,dst_alpha:1,blend_op:1,blend_op_alpha:1,alpha_func:8,colormask:15,fill:3,linear:1,scissor_right:S,scissor_bottom:S};
 const raster=f=>emit('RASTER',{...base,...f}), clear=(f={})=>emit('CLEAR',{mask:7,colormask:15,rgba:0xff000000,z:1,stencil:0,right:S,bottom:S,...f});
 const target=(color=rt,depth=ds)=>emit('TARGETS',{color,depth}),vp=(x,y,w,h)=>emit('VIEWPORT',{x,y,w,h,zmin:0,zmax:1});
 const quad=(rgba,z=.25)=>{const data=new Float32Array([[-1,-1],[S+1,-1],[-1,S+1],[S+1,-1],[S+1,S+1],[-1,S+1]].flatMap(x=>[...x,z,1,...rgba]));emit('DRAW_UP',{prim:C.PRIM_TRIANGLELIST,ps,layout,stride:32,count:6,vcount:6,voff:put(new Uint8Array(data.buffer))});};
 let stamp=6000;
 function* read(name,want,color=rt){const dst=p.arenaAlloc(S*S*4);emit('READBACK',{rt:color,fmt:C.FMT_A8B8G8R8,w:S,h:S,pitch:S*4,dst});emit('PRESENT',{rt:color,w:S,h:S,stamp:++stamp});yield{name,stamp,dst,size:S};const px=p.arenaView(dst,S*S*4).slice();for(let y=0;y<S;y++)for(let x=0;x<S;x++){const exp=typeof want==='function'?want(x,y):want,got=[...px.slice((y*S+x)*4,(y*S+x+1)*4)];check(name+' analytical '+x+','+y,got.every((v,i)=>Math.abs(v-exp[i])<=1),'got '+got+' expected '+exp);}capture(name,px);p.store('arena_tail',p.load('arena_head'));}
 const create=(id,kind)=>emit('CREATE',{id,kind,fmt:kind===C.KIND_DS?C.FMT_D24S8:C.FMT_A8B8G8R8,width:S,height:S,levels:1});
 for(const [id,k]of[[rt,C.KIND_RT],[ds,C.KIND_DS],[other,C.KIND_RT],[ds2,C.KIND_DS]])create(id,k);
 const elems=new Uint8Array(16),dv=new DataView(elems.buffer);[C.USAGE_POSITIONT,C.USAGE_COLOR].forEach((u,i)=>{dv.setUint8(i*8+1,C.VTYPE_FLOAT4);dv.setUint8(i*8+2,u);dv.setUint16(i*8+4,i*16,true);});emit('LAYOUT',{id:layout,stride:32,count:2},elems);
 const ir=irShader([[1,0x801F0000,0x90E40000]]);emit('SHADER',{id:ps,stage:1,ir_bytes:ir.length},ir);emit('BIND',{count:0});target();
 const inside=(x,y,a,b,c,d)=>x>=a&&y>=b&&x<c&&y<d;
 const st={stencil_enable:1,stencil_func:8,stencil_fail:1,stencil_zfail:1,stencil_pass:3,stencil_ref:9,stencil_mask:255,stencil_wmask:255};
 // All expectations are integer rectangle intersections and constant depth tests.
 for(const rect of [[6,1,14,10],[0,0,2,2],[4,3,12,13],[12,13,16,16]]){
  target();clear();vp(4,3,8,10);raster({...st,scissor_left:rect[0],scissor_top:rect[1],scissor_right:rect[2],scissor_bottom:rect[3]});quad([1,0,0,1]);
  const covered=(x,y)=>inside(x,y,4,3,12,13)&&inside(x,y,...rect);
  yield*read('viewport-intersection-'+rect, (x,y)=>covered(x,y)?[255,0,0,255]:[0,0,0,255]);
  target();raster({...st,stencil_func:3,stencil_pass:1,zwrite:0,depth_mode:0});quad([0,1,0,1],.5);
  yield*read('stencil-sentinel-'+rect,(x,y)=>covered(x,y)?[0,255,0,255]:[0,0,0,255]);
  raster({zwrite:0});quad([0,0,1,1],.5);
  yield*read('depth-sentinel-'+rect,(x,y)=>covered(x,y)?[0,255,0,255]:[0,0,255,255]);
 }
 target();clear();vp(4,3,8,10);raster({scissor_left:6,scissor_top:1,scissor_right:14,scissor_bottom:10,colormask:0,zwrite:0});quad([1,0,0,1]);clear({rgba:0xff302010,left:1,top:2,right:15,bottom:14,z:.125,stencil:7});
 yield*read('clear-own-rectangle',(x,y)=>inside(x,y,1,2,15,14)?[16,32,48,255]:[0,0,0,255]);
 target();raster({zwrite:0});quad([0,0,1,1],.5);yield*read('clear-depth-sentinel',(x,y)=>inside(x,y,1,2,15,14)?[16,32,48,255]:[0,0,255,255]);
 raster({...st,depth_mode:0,zwrite:0,stencil_func:3,stencil_pass:1,stencil_ref:7});quad([0,1,0,1]);yield*read('clear-stencil-sentinel',(x,y)=>inside(x,y,1,2,15,14)?[0,255,0,255]:[0,0,255,255]);
 // COPY must not leave its source framebuffer selected for the next CLEAR.
 target(other,ds2);clear({rgba:0xff0000ff});vp(2,2,3,3);raster({scissor_right:4,scissor_bottom:4});quad([1,1,0,1]);
 emit('COPY',{src:rt,dst:other,sw:S,sh:S,dw:S,dh:S,filter:1});clear({mask:1,rgba:0xffff00ff,left:8,right:16});
 yield*read('copy-then-clear-target',(x,y)=>x>=8?[255,0,255,255]:inside(x,y,1,2,15,14)?[0,255,0,255]:[0,0,255,255],other);
 target(other,ds2);clear();raster({depth_mode:0});quad([1,0,0,1]);yield*read('target-resets-viewport',[255,0,0,255],other);

 for(const linear of [0,1])for(const sc of [[0,0,16,16],[6,4,10,12]]){
  target();clear();vp(4,4,8,8);raster({...st,linear,scissor_left:sc[0],scissor_top:sc[1],scissor_right:sc[2],scissor_bottom:sc[3]});
  const data=new Float32Array([[4,4],[12,4],[4,12],[12,4],[12,12],[4,12]].flatMap(x=>[...x,.25,1,1,0,0,1]));
  emit('DRAW_UP',{prim:C.PRIM_TRIANGLELIST,ps,layout,stride:32,count:6,vcount:6,voff:put(new Uint8Array(data.buffer))});
  const covered=(x,y)=>inside(x,y,4,4,12,12)&&inside(x,y,...sc);
  yield*read('edge-color-'+linear+'-'+sc,(x,y)=>covered(x,y)?[255,0,0,255]:[0,0,0,255]);
  emit('COPY',{src:rt,dst:other,sw:S,sh:S,dw:S,dh:S,filter:1});yield*read('edge-copy-'+linear+'-'+sc,(x,y)=>covered(x,y)?[255,0,0,255]:[0,0,0,255],other);
  target();raster({...st,depth_mode:0,zwrite:0,stencil_func:3,stencil_pass:1});quad([0,1,0,1]);
  yield*read('edge-stencil-'+linear+'-'+sc,(x,y)=>covered(x,y)?[0,255,0,255]:[0,0,0,255]);
  raster({zwrite:0});quad([0,0,1,1],.5);yield*read('edge-depth-'+linear+'-'+sc,(x,y)=>covered(x,y)?[0,255,0,255]:[0,0,255,255]);
 }
 // The coverage lift must not move the sample along an affine color or
 // depth plane. These expectations use the original integer pixel centre.
 target();clear();vp(4,4,8,8);raster({linear:1});
 const gradient=new Float32Array([[4,4],[12,4],[4,12],[12,4],[12,12],[4,12]].flatMap(([x,y])=>
  [x,y,.125+(y-4)/16,1,(y-4)/8,0,0,1]));
 emit('DRAW_UP',{prim:C.PRIM_TRIANGLELIST,ps,layout,stride:32,count:6,vcount:6,voff:put(new Uint8Array(gradient.buffer))});
 const covered=(x,y)=>inside(x,y,4,4,12,12);
 yield*read('linear-integer-color-plane',(x,y)=>covered(x,y)?[Math.round(255*(y-4)/8),0,0,255]:[0,0,0,255]);
 // At y=8, stored z=.375. A coverage-only lift stores .37890625,
 // incorrectly admitting the blue LESS sentinel at .376953125.
 raster({linear:1,zwrite:0});quad([0,0,1,1],.376953125);
 yield*read('linear-integer-depth-plane',(x,y)=>!covered(x,y)?[0,0,0,255]:y>=9?[0,0,255,255]:[Math.round(255*(y-4)/8),0,0,255]);
 // Shared strip vertices belong to two different color planes. Resolve
 // both index widths and the strip's alternating winding before correcting.
 for(const index_size of [0,2,4]){
  target();clear();vp(4,4,8,8);raster({linear:1,depth_mode:0});
  let verts=[[4,4,0],[12,4,.25],[4,12,.75],[12,12,.5]];
  if(index_size)verts=verts.slice().reverse();
  const data=new Float32Array(verts.flatMap(([x,y,c])=>[x,y,.25,1,c,0,0,1]));
  const ib=index_size===2?new Uint16Array([3,2,1,0]):new Uint32Array([3,2,1,0]);
  emit('DRAW_UP',{prim:C.PRIM_TRIANGLESTRIP,ps,layout,stride:32,count:4,vcount:4,index_size,
   voff:put(new Uint8Array(data.buffer)),ioff:index_size?put(new Uint8Array(ib.buffer)):0});
  yield*read('linear-shared-strip-'+index_size,(x,y)=>{
   if(!covered(x,y))return[0,0,0,255];
   const u=(x-4)/8,v=(y-4)/8,c=u+v<=1?.25*u+.75*v:.5-.25*u+.25*v;
   return[Math.round(255*c),0,0,255];
  });
 }
 for(const id of[rt,ds,other,ds2,layout,ps])emit('RELEASE',{id});yield{name:'release'};
  }

  // Integer point centres and axis-aligned line interiors, with no endpoint,
  // shared-junction or diagonal tie assertions. The software backend's stable
  // one-pixel squares/quads and the documented interpolation equation agree
  // here; no OpenGL edge rule is used as a D3D reference.
  function* linePointCases({ GS, p, check, capture = () => {}, programmed = false }) {
    const C = GS.CONST, size = 16, rt = 901, ds = 902, layout = 903, ps = 904, vs = 905;
    let vp = { x: 0, y: 0, w: size, h: size };
    const emit = (op, fields, tail) => {
      if (op === 'VIEWPORT') vp = fields;
      return p.emit(op, fields, tail);
    };
    const put = bytes => {
      const pos = p.arenaAlloc(bytes.length);
      p.arenaView(pos, bytes.length).set(bytes);
      return pos;
    };
    const base = { depth_mode: 1, zfunc: 2, zwrite: 1, cull: 1, src_rgb: 2, dst_rgb: 1,
      src_alpha: 2, dst_alpha: 1, blend_op: 1, blend_op_alpha: 1, alpha_func: 8,
      colormask: 15, fill: 3, scissor_right: size, scissor_bottom: size };
    const stencil = { stencil_enable: 1, stencil_func: 8, stencil_fail: 3, stencil_zfail: 3,
      stencil_pass: 3, stencil_ref: 7, stencil_mask: 255, stencil_wmask: 255,
      two_sided: 1, ccw_func: 1, ccw_fail: 1, ccw_zfail: 1, ccw_pass: 1 };
    const raster = fields => emit('RASTER', { ...base, ...fields });
    const clear = () => emit('CLEAR', { mask: 7, colormask: 15, rgba: 0xff000000,
      z: 0.5, stencil: 0, right: size, bottom: size });
    const draw = (prim, vertices, indices) => {
      // Invert the D3D viewport independently of the WebGL epilogue:
      // x=vx+(X/W+1)*vw/2, y=vy+(1-Y/W)*vh/2, z=Z/W, q=1/W.
      // Powers of two keep all authored clip coordinates exact in FLOAT4.
      const input = programmed ? vertices.map(([x,y,z,q,...color]) =>
        [(2*(x-vp.x)/vp.w-1)/q,(1-2*(y-vp.y)/vp.h)/q,z/q,1/q,...color]) : vertices;
      emit('DRAW_UP', { prim, vs: programmed ? vs : 0, ps, layout, stride: 32, count: indices ? indices.length : vertices.length,
        vcount: vertices.length, voff: put(new Uint8Array(new Float32Array(input.flat()).buffer)),
        ...(indices ? { index_size: 2, ioff: put(new Uint8Array(new Uint16Array(indices).buffer)) } : {}) });
    };
    const quad = (color, z = 0.375) => draw(C.PRIM_TRIANGLELIST,
      [[-1,-1],[17,-1],[-1,17],[17,-1],[17,17],[-1,17]].map(([x,y]) => [x,y,z,1,...color]));
    let stamp = 9000;
    function* read(name, want, samples) {
      const dst = p.arenaAlloc(size * size * 4);
      emit('READBACK', { rt, fmt: C.FMT_A8B8G8R8, x: 0, y: 0, w: size, h: size, pitch: size * 4, dst });
      emit('PRESENT', { rt, w: size, h: size, stamp: ++stamp });
      yield { name, stamp, dst, size };
      const pixels = p.arenaView(dst, size * size * 4).slice();
      for (const [x,y] of samples) {
        const got = [...pixels.slice((y * size + x) * 4, (y * size + x) * 4 + 4)], expected = want(x,y);
        check(name + ' @' + x + ',' + y, got.every((v,i) => Math.abs(v - expected[i]) <= 1),
          'got ' + got + ' expected ' + expected);
      }
      capture(name, pixels);
      p.store('arena_tail', p.load('arena_head'));
    }
    emit('CREATE', { id: rt, kind: C.KIND_RT, fmt: C.FMT_A8B8G8R8, width: size, height: size, levels: 1 });
    emit('CREATE', { id: ds, kind: C.KIND_DS, fmt: C.FMT_D24S8, width: size, height: size, levels: 1 });
    const elems = new Uint8Array(16), dv = new DataView(elems.buffer);
    [programmed ? C.USAGE_POSITION : C.USAGE_POSITIONT,C.USAGE_COLOR].forEach((usage,i) => {
      dv.setUint8(i * 8 + 1, C.VTYPE_FLOAT4); dv.setUint8(i * 8 + 2, usage); dv.setUint16(i * 8 + 4, i * 16, true);
    });
    emit('LAYOUT', { id: layout, stride: 32, count: 2 }, elems);
    emit('SHADER', { id: ps, stage: 1, ir_bytes: FLAT_IR.length }, FLAT_IR);
    if (programmed) emit('SHADER', { id: vs, stage: 0, ir_bytes: PASS_VS.length }, PASS_VS);
    emit('TARGETS', { color: rt, depth: ds }); emit('BIND', { count: 0 });
    // Prime the perspective triangle program before any point/line. Its
    // coverage lift must not leak through the program cache into lines.
    raster({ linear: 0 }); quad([0,0,0,1]); clear();
    for (const prim of [C.PRIM_POINTLIST,C.PRIM_LINELIST,C.PRIM_LINESTRIP]) {
      for (const indexed of [0,1]) for (const linear of (programmed ? [0] : [0,1])) for (const clipped of [0,1]) {
        const points = prim === C.PRIM_POINTLIST ? [[4,6],[8,6],[12,6],[8,10]]
          : [[4,6],[12,6],[12,12], ...(prim === C.PRIM_LINESTRIP ? [[4,12]] : [])];
        const order = prim === C.PRIM_LINELIST ? [0,1,1,2] : points.map((_,i) => i);
        const segments = prim === C.PRIM_POINTLIST ? [] : order.slice(1).flatMap((b,i) =>
          prim === C.PRIM_LINELIST && i % 2 ? [] : [[order[i],b]]);
        const onSegment = (x, y, [ia,ib]) => {
          const a = points[ia], b = points[ib], dx = b[0] - a[0], dy = b[1] - a[1];
          const t = ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy);
          return t > 0 && t < 1 && Math.abs((x - a[0]) * dy - (y - a[1]) * dx) < 0.5 * Math.hypot(dx,dy);
        };
        const inClip = (x,y) => !clipped || (x >= 6 && x < 10 && y >= 4 && y < 12);
        const covered = (x,y) => prim === C.PRIM_POINTLIST ? points.some(a => x === a[0] && y === a[1])
          : segments.some(s => onSegment(x,y,s));
        const hit = (x,y) => covered(x,y) && inClip(x,y);
        const samples = prim === C.PRIM_POINTLIST ? [...points,[0,0],[5,6]]
          : [[6,6],[8,6],[10,6],[12,8],[12,10],
            ...(prim === C.PRIM_LINESTRIP ? [[6,12],[8,12],[10,12]] : []),[0,0],[7,7]];
        const state = { linear, ...(clipped ? { scissor_left: 6, scissor_top: 4, scissor_right: 10, scissor_bottom: 12 } : {}) };
        const name = (programmed ? 'programmed-' : '') + 'line-point-' + prim + '-' + indexed + '-' + linear + '-' + clipped;
        emit('VIEWPORT', { x: clipped ? 4 : 0, y: clipped ? 4 : 0, w: clipped ? 8 : size,
          h: clipped ? 8 : size, zmin: 0, zmax: 1 });
        const send = (z, gradient = false, varyingDepth = false) => {
          const vertices = points.map(([x,y],i) => [x,y,varyingDepth ? (i % 2 ? 0.75 : 0.125) : z,i % 2 ? 2 : 0.5,
            ...(gradient ? [i % 2,0,0,1] : [1,0,0,1])]);
          // Lists share vertex 1; strips share every interior vertex. The
          // repeated point checks indexed reuse without ambiguous junctions.
          if (indexed) draw(prim, vertices, prim === C.PRIM_POINTLIST ? [...order,0] : order);
          else draw(prim, order.map(i => vertices[i]));
        };
        for (const path of ['pass','zfail','fail','mask']) {
          clear();
          const ref = path === 'zfail' ? 9 : path === 'fail' ? 11 : 7;
          raster({ ...state, ...stencil, stencil_func: path === 'fail' ? 1 : 8,
            stencil_ref: ref, colormask: path === 'mask' ? 0 : 15 });
          send(path === 'zfail' ? 0.75 : 0.25);
          yield* read(name + '-' + path + '-color', (x,y) => hit(x,y) && path === 'pass'
            ? [255,0,0,255] : [0,0,0,255], samples);
          // A quad at .375 passes clear depth .5 but fails stored depth .25.
          raster({ ...state, zwrite: 0 }); quad([0,0,1,1]);
          yield* read(name + '-' + path + '-depth', (x,y) => {
            if (hit(x,y) && (path === 'pass' || path === 'mask')) return path === 'pass' ? [255,0,0,255] : [0,0,0,255];
            return inClip(x,y) ? [0,0,255,255] : [0,0,0,255];
          }, samples);
          emit('CLEAR', { mask: 1, colormask: 15, rgba: 0xff000000, right: size, bottom: size });
          raster({ ...state, ...stencil, depth_mode: 0, zwrite: 0, stencil_func: 3,
            stencil_ref: ref, stencil_fail: 1, stencil_zfail: 1, stencil_pass: 1, two_sided: 0 });
          quad([0,1,0,1]);
          yield* read(name + '-' + path + '-stencil', (x,y) => hit(x,y) ? [0,255,0,255] : [0,0,0,255], samples);
        }
        if (prim !== C.PRIM_POINTLIST) {
          clear(); raster(state); send(0.25,true);
          const gradientSamples = samples.filter(([x,y]) => covered(x,y));
          yield* read(name + '-gradient-color', (x,y) => {
            if (!hit(x,y)) return [0,0,0,255];
            const [ia,ib] = segments.find(s => onSegment(x,y,s)), a = points[ia], b = points[ib];
            const dx = b[0] - a[0], dy = b[1] - a[1];
            const t = ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy);
            const ca = ia % 2, cb = ib % 2, qa = ca ? 2 : 0.5, qb = cb ? 2 : 0.5;
            const value = linear ? (1 - t) * ca + t * cb
              : ((1 - t) * qa * ca + t * qb * cb) / ((1 - t) * qa + t * qb);
            return [Math.round(255 * value),0,0,255];
          }, gradientSamples);
          if (programmed) {
            clear(); raster(state); send(0, false, true);
            raster({ ...state, zwrite: 0 }); quad([0,0,1,1]);
            // Clip Z/W interpolates affinely in projected t, unlike color.
            // The .375 overlay separates the .125/.75 endpoints with a
            // strict margin at these samples; no equality/tie assertion.
            yield* read(name + '-varying-depth', (x,y) => {
              if (!inClip(x,y)) return [0,0,0,255];
              if (!hit(x,y)) return [0,0,255,255];
              const [ia,ib] = segments.find(s => onSegment(x,y,s)), a = points[ia], b = points[ib];
              const t = ((x-a[0])*(b[0]-a[0])+(y-a[1])*(b[1]-a[1])) /
                ((b[0]-a[0])**2+(b[1]-a[1])**2);
              const z = (1-t)*(ia % 2 ? 0.75 : 0.125)+t*(ib % 2 ? 0.75 : 0.125);
              return z < 0.375 ? [255,0,0,255] : [0,0,255,255];
            }, samples);
          }
        }
      }
    }
    for (const id of [rt,ds,layout,ps]) emit('RELEASE', { id });
    if (programmed) emit('RELEASE', { id: vs });
  }

  function* programmedLinePointCases(options) {
    yield* linePointCases({ ...options, programmed: true });
  }

  return { run, runD1, run94a, cubeSamplerCases, perspectiveMipCases, cubeMipCases, visibilityCases, blendCases, fogCases, viewportCases, linePointCases, programmedLinePointCases, W, H, irShader, TEX_IR };
});
