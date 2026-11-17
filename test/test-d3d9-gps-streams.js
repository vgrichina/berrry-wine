#!/usr/bin/env node
'use strict';
// Decline reasons 27 / 2 (src/09akg-d3d9-gps.wat, the d9ms gather): vertex
// input the executor cannot read in place is gathered per draw into one
// interleaved arena vertex of canonical types. Each frame below used to
// decline; each must now lower with no decline and equal the old software
// path's pixels exactly:
//   A fixed T&L, DrawPrimitive, POSITION on stream 0 and COLOR0 on stream 1
//     (a stream offset, an element offset, a start vertex);
//   B fixed T&L, DrawIndexedPrimitive with BaseVertexIndex 3, MinIndex 1,
//     NumVertices 5: SHORT4N positions on stream 0, UBYTE4N colours on 1;
//   C lit fixed T&L, Draw*UP, a one-stream declaration that is not an FVF
//     layout (NORMAL, POSITION, COLOR0 in that order);
//   D a POSITIONT declaration in non-FVF order (COLOR0 first);
//   E a guest vs_1_1, DrawIndexedPrimitive with a base vertex, SHORT2N
//     positions on stream 0 and FLOAT16_4 colours on stream 1;
//   F an XYZW FVF (w = 2) under fixed T&L;
//   G textured fixed T&L, TEXCOORD1 SHORT2N on stream 1 (set 0 a gap).
const assert = require('assert');
const { openD3d9GpsSession } = require('./helpers/d3d9-gps-session');

const SIZE = 16;
const CORNERS = [[-0.9, 0.9], [0.9, 0.9], [0.9, -0.9], [-0.9, -0.9]];
const COLORS = [0xffffffff, 0xffff4020, 0xff20ff40, 0xff4020ff, 0xffffff00];
// The fan as a triangle list over 5 unique vertices (0 = centre).
const TRIS = [0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1];
const POS = [[0, 0], ...CORNERS];
const NORMALS = [[0, 0, -1], [0.6, 0, -0.8], [0, 0.6, -0.8], [-0.6, 0, -0.8], [0, -0.6, -0.8]];

const bytes = n => new DataView(new ArrayBuffer(n));
const out = dv => [...new Uint8Array(dv.buffer)];
const half = x => x === 1 ? 0x3c00 : x === 0.5 ? 0x3800 : x === 0.25 ? 0x3400 : x === 0.75 ? 0x3a00 : 0;
const rgba = c => [(c >>> 16) & 255, (c >>> 8) & 255, c & 255, c >>> 24];

// D3DVERTEXELEMENT9 {stream, offset, type, method, usage, index} as bytes.
const el = (stream, offset, type, usage, index = 0) => [stream, 0, offset & 255, offset >> 8, type, 0, usage, index];
const END = [0xff, 0, 0, 0, 17, 0, 0, 0];

async function render(gps) {
  const s = await openD3d9GpsSession({ gps, size: SIZE });
  try {
    const ok = async (name, args) => assert.strictEqual(await s.call(name, args), 0, name);
    await ok('IDirect3D9_CreateDevice', '[0,0,1,exports.get_main_hwnd(),0,ctx.d9g.pp,ctx.d9g.out]');
    await s.evaluate(`(()=>{const p=ctx.d9g;p.device=exports.guest_read32(p.out)>>>0;p.els=exports.guest_alloc(160)>>>0;
      p.dout=exports.guest_alloc(64)>>>0;p.up=exports.guest_alloc(1024)>>>0;p.vbs=[];
      p.put=(ga,b)=>new Uint8Array(memory.buffer).set(b,exports.guest_to_wasm(ga));return true})()`);
    let ndecl = 0;
    const decl = async b => {
      await s.evaluate(`ctx.d9g.put(ctx.d9g.els,${JSON.stringify(b)});true`);
      const k = ndecl++;
      await ok('IDirect3DDevice9_CreateVertexDeclaration', `[ctx.d9g.device,ctx.d9g.els,ctx.d9g.dout+${4 * k}]`);
      return `exports.guest_read32(ctx.d9g.dout+${4 * k})>>>0`;
    };
    // A MANAGED buffer holding $b; its expression.
    const buffer = async (b, index = false) => {
      const len = Math.max(16, b.length);
      await ok(index ? 'IDirect3DDevice9_CreateIndexBuffer' : 'IDirect3DDevice9_CreateVertexBuffer',
        `[ctx.d9g.device,${len},0,${index ? 101 : 0},1,ctx.d9g.out,0]`);
      const ref = await s.evaluate('ctx.d9g.vbs.push(exports.guest_read32(ctx.d9g.out)>>>0)-1');
      await ok('IDirect3DBuffer9_Lock', `[ctx.d9g.vbs[${ref}],0,0,ctx.d9g.out,0]`);
      await s.evaluate(`ctx.d9g.put(exports.guest_read32(ctx.d9g.out)>>>0,${JSON.stringify(b)});true`);
      await ok('IDirect3DBuffer9_Unlock', `[ctx.d9g.vbs[${ref}]]`);
      return `ctx.d9g.vbs[${ref}]`;
    };
    const frames = [], stats = [];
    const frame = async (bind, draw) => {
      await bind();
      const before = await s.stats();
      await ok('IDirect3DDevice9_Clear', '[ctx.d9g.device,0,0,1,0xff000000,0x3f800000,0]');
      await ok(draw[0], draw[1]);
      await ok('IDirect3DDevice9_Present', '[ctx.d9g.device,0,0,0,0]');
      const after = await s.stats();
      stats.push({ declines: after.declines - before.declines, draws: after.draws - before.draws,
        reasons: Object.fromEntries(Object.entries(after.reasons).map(([r, n]) => [r, n - (before.reasons[r] || 0)]).filter(([, n]) => n)) });
      assert.strictEqual(await s.call('IDirect3DDevice9_GetBackBuffer', '[ctx.d9g.device,0,0,0,ctx.d9g.surface]'), 0);
      await s.evaluate('ctx.d9g.bb=exports.guest_read32(ctx.d9g.surface)>>>0');
      await ok('IDirect3DSurface9_LockRect', '[ctx.d9g.bb,ctx.d9g.lr,0,1<<4]');
      frames.push(await s.evaluate(`(()=>{const p=ctx.d9g,pitch=exports.guest_read32(p.lr)|0,
        wa=exports.guest_to_wasm(exports.guest_read32(p.lr+4)>>>0),v=new DataView(memory.buffer),out=[];
        for(let y=0;y<${SIZE};y++)for(let x=0;x<${SIZE};x++)out.push(v.getUint32(wa+y*pitch+x*4,true)>>>0);return out})()`));
      await ok('IDirect3DSurface9_UnlockRect', '[ctx.d9g.bb]');
      await s.call('IDirect3DSurface9_Release', '[ctx.d9g.bb]');
    };
    await ok('IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,22,1]');
    await ok('IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,137,0]');

    // A: stream 0 FLOAT3 positions (2 leading junk vertices), stream 1
    // colours at stride 8, stream offset 8, element offset 4.
    {
      const p = bytes((2 + 12) * 12), c = bytes(8 + (2 + 12) * 8);
      for (let i = 0; i < 2; i++) { p.setFloat32(i * 12, 7, true); }
      TRIS.forEach((v, i) => {
        p.setFloat32((2 + i) * 12, POS[v][0], true); p.setFloat32((2 + i) * 12 + 4, POS[v][1], true);
        p.setFloat32((2 + i) * 12 + 8, 0.5, true);
        c.setUint32(8 + (2 + i) * 8 + 4, COLORS[v], true);
      });
      const vp = await buffer(out(p)), vc = await buffer(out(c));
      const d = await decl([...el(0, 0, 2, 0), ...el(1, 4, 4, 10), ...END]);
      await frame(async () => {
        await ok('IDirect3DDevice9_SetVertexDeclaration', `[ctx.d9g.device,${d}]`);
        await ok('IDirect3DDevice9_SetStreamSource', `[ctx.d9g.device,0,${vp},0,12]`);
        await ok('IDirect3DDevice9_SetStreamSource', `[ctx.d9g.device,1,${vc},8,8]`);
      }, ['IDirect3DDevice9_DrawPrimitive', '[ctx.d9g.device,4,2,4]']);
    }
    // B: DIP, BaseVertexIndex 3, MinIndex 1, NumVertices 5.
    {
      const N = 3 + 1 + 5, p = bytes(N * 8), c = bytes(N * 4);
      for (let v = 0; v < 5; v++) {
        const at = 3 + 1 + v;
        p.setInt16(at * 8, Math.round(POS[v][0] * 32767), true); p.setInt16(at * 8 + 2, Math.round(POS[v][1] * 32767), true);
        p.setInt16(at * 8 + 4, 16384, true); p.setInt16(at * 8 + 6, 32767, true);
        rgba(COLORS[v]).forEach((b, k) => c.setUint8(at * 4 + k, b));
      }
      const idx = bytes(24);
      TRIS.forEach((v, i) => idx.setUint16(i * 2, 1 + v, true));
      const vp = await buffer(out(p)), vc = await buffer(out(c)), ib = await buffer(out(idx), true);
      const d = await decl([...el(0, 0, 10, 0), ...el(1, 0, 8, 10), ...END]);
      await frame(async () => {
        await ok('IDirect3DDevice9_SetVertexDeclaration', `[ctx.d9g.device,${d}]`);
        await ok('IDirect3DDevice9_SetStreamSource', `[ctx.d9g.device,0,${vp},0,8]`);
        await ok('IDirect3DDevice9_SetStreamSource', `[ctx.d9g.device,1,${vc},0,4]`);
        await ok('IDirect3DDevice9_SetIndices', `[ctx.d9g.device,${ib}]`);
      }, ['IDirect3DDevice9_DrawIndexedPrimitive', '[ctx.d9g.device,4,3,1,5,0,4]']);
    }
    // C: lit fixed T&L, Draw*UP, NORMAL / POSITION / COLOR0 order.
    {
      const v = bytes(12 * 28);
      TRIS.forEach((k, i) => {
        NORMALS[k].forEach((n, j) => v.setFloat32(i * 28 + j * 4, n, true));
        v.setFloat32(i * 28 + 12, POS[k][0], true); v.setFloat32(i * 28 + 16, POS[k][1], true); v.setFloat32(i * 28 + 20, 0.5, true);
        v.setUint32(i * 28 + 24, COLORS[k], true);
      });
      await s.evaluate(`ctx.d9g.put(ctx.d9g.up,${JSON.stringify(out(v))});true`);
      const d = await decl([...el(0, 0, 2, 3), ...el(0, 12, 2, 0), ...el(0, 24, 4, 10), ...END]);
      await s.evaluate(`(()=>{const p=ctx.d9g;p.mat=exports.guest_alloc(68)>>>0;p.light=exports.guest_alloc(104)>>>0;
        p.f32(p.mat,[1,1,1,1, .5,.5,.5,1, 1,1,1,1, .05,0,0,0, 8]);p.u32(p.light,[3]);
        p.f32(p.light+4,[.6,.6,.6,1, 1,1,1,1, .1,.1,.2,1, 0,0,0, .3,-.2,1, 10,1, 1,0,0, 0,0]);return true})()`);
      await frame(async () => {
        await ok('IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,137,1]');
        await ok('IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,139,0xff202020]');
        await ok('IDirect3DDevice9_SetMaterial', '[ctx.d9g.device,ctx.d9g.mat]');
        await ok('IDirect3DDevice9_SetLight', '[ctx.d9g.device,0,ctx.d9g.light]');
        await ok('IDirect3DDevice9_LightEnable', '[ctx.d9g.device,0,1]');
        await ok('IDirect3DDevice9_SetVertexDeclaration', `[ctx.d9g.device,${d}]`);
      }, ['IDirect3DDevice9_DrawPrimitiveUP', '[ctx.d9g.device,4,4,ctx.d9g.up,28]']);
      await ok('IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,137,0]');
    }
    // D: POSITIONT declaration, COLOR0 first.
    {
      const v = bytes(12 * 20);
      const px = [[8, 8], [1, 1], [15, 1], [15, 15], [1, 15]];
      TRIS.forEach((k, i) => {
        v.setUint32(i * 20, COLORS[k], true);
        [px[k][0], px[k][1], 0.5, 1].forEach((n, j) => v.setFloat32(i * 20 + 4 + j * 4, n, true));
      });
      await s.evaluate(`ctx.d9g.put(ctx.d9g.up,${JSON.stringify(out(v))});true`);
      const d = await decl([...el(0, 0, 4, 10), ...el(0, 4, 3, 9), ...END]);
      await frame(() => ok('IDirect3DDevice9_SetVertexDeclaration', `[ctx.d9g.device,${d}]`),
        ['IDirect3DDevice9_DrawPrimitiveUP', '[ctx.d9g.device,4,4,ctx.d9g.up,20]']);
    }
    // E: guest vs_1_1, DIP with a base vertex, SHORT2N + FLOAT16_4 streams.
    {
      const N = 2 + 5, p = bytes(N * 4), c = bytes(N * 8);
      const H = [[1, 1, 1, 1], [1, 0.25, 0, 1], [0.25, 1, 0.5, 1], [0.5, 0.25, 1, 0.75], [1, 1, 0, 1]];
      for (let v = 0; v < 5; v++) {
        p.setInt16((2 + v) * 4, Math.round(POS[v][0] * 32767), true); p.setInt16((2 + v) * 4 + 2, Math.round(POS[v][1] * 32767), true);
        H[v].forEach((x, k) => c.setUint16((2 + v) * 8 + k * 2, half(x), true));
      }
      const idx = bytes(24);
      TRIS.forEach((v, i) => idx.setUint16(i * 2, v, true));
      const vp = await buffer(out(p)), vc = await buffer(out(c)), ib = await buffer(out(idx), true);
      const d = await decl([...el(0, 0, 9, 0), ...el(1, 0, 16, 10), ...END]);
      await s.evaluate(`ctx.d9g.vs=exports.guest_alloc(64)>>>0;ctx.d9g.u32(ctx.d9g.vs,[0xfffe0101,
        0x1f,0x80000000,0x900f0000, 0x1f,0x8000000a,0x900f0001,
        0x1,0xc00f0000,0x90e40000, 0x1,0xd00f0000,0x90e40001, 0xffff]);true`);
      await ok('IDirect3DDevice9_CreateVertexShader', '[ctx.d9g.device,ctx.d9g.vs,ctx.d9g.out]');
      await s.evaluate('ctx.d9g.shader=exports.guest_read32(ctx.d9g.out)>>>0;true');
      await frame(async () => {
        await ok('IDirect3DDevice9_SetVertexDeclaration', `[ctx.d9g.device,${d}]`);
        await ok('IDirect3DDevice9_SetVertexShader', '[ctx.d9g.device,ctx.d9g.shader]');
        await ok('IDirect3DDevice9_SetStreamSource', `[ctx.d9g.device,0,${vp},0,4]`);
        await ok('IDirect3DDevice9_SetStreamSource', `[ctx.d9g.device,1,${vc},0,8]`);
        await ok('IDirect3DDevice9_SetIndices', `[ctx.d9g.device,${ib}]`);
      }, ['IDirect3DDevice9_DrawIndexedPrimitive', '[ctx.d9g.device,4,2,0,5,0,4]']);
      await ok('IDirect3DDevice9_SetVertexShader', '[ctx.d9g.device,0]');
    }
    // F: XYZW FVF (0x4042), w = 2.
    {
      const v = bytes(12 * 20);
      TRIS.forEach((k, i) => {
        [POS[k][0] * 2, POS[k][1] * 2, 1, 2].forEach((n, j) => v.setFloat32(i * 20 + j * 4, n, true));
        v.setUint32(i * 20 + 16, COLORS[k], true);
      });
      await s.evaluate(`ctx.d9g.put(ctx.d9g.up,${JSON.stringify(out(v))});true`);
      await frame(() => ok('IDirect3DDevice9_SetFVF', '[ctx.d9g.device,0x4042]'),
        ['IDirect3DDevice9_DrawPrimitiveUP', '[ctx.d9g.device,4,4,ctx.d9g.up,20]']);
    }
    // G: textured fixed T&L, TEXCOORD1 as SHORT2N on stream 1 (set 0 is a
    // gap), stage 0 reading set 1.
    {
      const p = bytes(12 * 12), t = bytes(12 * 4);
      const UV = [[0.5, 0.5], [0, 0], [1, 0], [1, 1], [0, 1]];
      TRIS.forEach((k, i) => {
        p.setFloat32(i * 12, POS[k][0], true); p.setFloat32(i * 12 + 4, POS[k][1], true); p.setFloat32(i * 12 + 8, 0.5, true);
        t.setInt16(i * 4, Math.round(UV[k][0] * 32767), true); t.setInt16(i * 4 + 2, Math.round(UV[k][1] * 32767), true);
      });
      const vp = await buffer(out(p)), vt = await buffer(out(t));
      const d = await decl([...el(0, 0, 2, 0), ...el(1, 0, 9, 5, 1), ...END]);
      await s.evaluate('ctx.d9g.texout=exports.guest_alloc(4)>>>0;ctx.d9g.tlr=exports.guest_alloc(8)>>>0;true');
      await ok('IDirect3DDevice9_CreateTexture', '[ctx.d9g.device,4,4,1,0,21,1,ctx.d9g.texout,0]');
      await s.evaluate('ctx.d9g.tex=exports.guest_read32(ctx.d9g.texout)>>>0');
      await ok('IDirect3DTexture9_LockRect', '[ctx.d9g.tex,0,ctx.d9g.tlr,0,0]');
      await s.evaluate(`(()=>{const p=ctx.d9g,pitch=exports.guest_read32(p.tlr)|0,bits=exports.guest_read32(p.tlr+4)>>>0;
        for(let y=0;y<4;y++)for(let x=0;x<4;x++)p.u32(bits+y*pitch+x*4,[(0xff000000|((x*60+30)<<16)|((y*60+30)<<8)|((x+y)*30))>>>0]);return true})()`);
      await ok('IDirect3DTexture9_UnlockRect', '[ctx.d9g.tex,0]');
      await frame(async () => {
        await ok('IDirect3DDevice9_SetTexture', '[ctx.d9g.device,0,ctx.d9g.tex]');
        await ok('IDirect3DDevice9_SetTextureStageState', '[ctx.d9g.device,0,11,1]');
        await ok('IDirect3DDevice9_SetVertexDeclaration', `[ctx.d9g.device,${d}]`);
        await ok('IDirect3DDevice9_SetStreamSource', `[ctx.d9g.device,0,${vp},0,12]`);
        await ok('IDirect3DDevice9_SetStreamSource', `[ctx.d9g.device,1,${vt},0,4]`);
      }, ['IDirect3DDevice9_DrawPrimitive', '[ctx.d9g.device,4,0,4]']);
      await ok('IDirect3DDevice9_SetTexture', '[ctx.d9g.device,0,0]');
    }
    const st = await s.stats();
    await s.call('IDirect3DDevice9_Release', '[ctx.d9g.device]');
    assert.strictEqual(await s.close(), 0, s.output());
    return { frames, stats, st };
  } catch (error) { console.error(s.output().slice(-4000)); await s.close(); throw error; }
}

(async () => {
  // The old JS D3D9 path was deleted (d3d9-retire S4): `old` is its output for
  // this exact sequence, recorded at 3eea041c5 (test/fixtures/d3d9-old-oracle).
  const old = require('./fixtures/d3d9-old-oracle/streams.json');
  const ring = await render('software');
  const names = 'ABCDEFG';
  const bad = [];
  ring.stats.forEach((f, i) => { if (f.declines || f.draws !== 1) bad.push(`${names[i]} ${JSON.stringify(f)}`); });
  for (let i = 0; i < old.frames.length; i++) {
    const a = old.frames[i], b = ring.frames[i];
    assert(new Set(a).size > 3, `frame ${names[i]} is not flat (old path drew it)`);
    const diff = a.findIndex((v, k) => v !== b[k]);
    if (diff >= 0) bad.push(`${names[i]} pixel ${diff}: old ${(a[diff] >>> 0).toString(16)} ring ${(b[diff] >>> 0).toString(16)}`);
  }
  assert.deepStrictEqual(bad, [], `frames that declined or differ:\n  ${bad.join('\n  ')}`);
  console.log(`PASS multi-stream / converted / non-FVF vertex input gathered on the ring, ${old.frames.length} frames pixel-exact\n  ring ${JSON.stringify(ring.st)}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
