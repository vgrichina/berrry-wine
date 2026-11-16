#!/usr/bin/env node
'use strict';
// Fixed-function vertex blending and tweening on the ring (src/09akg-d3d9-gps.wat,
// "d9ms: vertex blending / tweening"). Until it lowered, any draw with
// D3DRS_VERTEXBLEND (151) or INDEXEDVERTEXBLENDENABLE (167) declined 27. The
// old path ignores both, so it cannot be the oracle: each blended frame is
// compared with the same mesh blended on the CPU here (dyadic weights and
// matrices, so every sum is exact) and drawn unblended under an identity
// world. The reference frame must match on both paths, and the ring's
// blended frame must equal it pixel for pixel with no decline:
//   H 1WEIGHTS, XYZB1 FVF, Draw*UP (world 0 and 1);
//   I 3WEIGHTS (four matrices), a BLENDWEIGHT FLOAT3 declaration, a VB DIP;
//   J indexed 1WEIGHTS, XYZB2 | LASTBETA_UBYTE4 (palette entries 5, 9, 21);
//   K indexed 0WEIGHTS, XYZB1 | LASTBETA_D3DCOLOR (index = byte 2);
//   L lit 2WEIGHTS with NORMAL (blended through the inverse transposes);
//   M TWEENING: POSITION1 on stream 1, TWEENFACTOR 0.25, world 0 applied.
//   N indexed 0WEIGHTS naming entry 30, past the shader's 22-entry palette:
//     blended on the CPU in WAT (09akg "d9cpu");
//   O lit indexed 2WEIGHTS + NORMAL, UBYTE4 entries 40 / 128 / 255, VB DIP
//     (CPU path, normals through the inverse transposes).
// P: a FLOAT1 index of 300 (not a D3D palette entry) still declines 27.
// Caps: MaxVertexBlendMatrices 4, MaxVertexBlendMatrixIndex 21 for hardware
// vertex processing and 255 for software (a MIXED device switched).
const assert = require('assert');
const { openD3d9GpsSession } = require('./helpers/d3d9-gps-session');

const SIZE = 16;
const POS = [[0, 0], [-0.875, 0.875], [0.875, 0.875], [0.875, -0.875], [-0.875, -0.875]];
const COLORS = [0xffffffff, 0xffff4020, 0xff20ff40, 0xff4020ff, 0xffffff00];
const TRIS = [0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1];
const NORMALS = [[0, 0, -1], [0.5, 0, -0.75], [0, 0.5, -0.75], [-0.5, 0, -0.75], [0, -0.5, -0.75]];
const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
// Row-major D3DMATRIX; p' = p . M. Each keeps z and w.
const MATS = [
  [0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 1, 0, 0.25, 0, 0, 1],
  [0, 0.5, 0, 0, -0.5, 0, 0, 0, 0, 0, 1, 0, -0.25, 0.25, 0, 1],
  [1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  [0.75, 0, 0, 0, 0, 0.75, 0, 0, 0, 0, 1, 0, 0, -0.125, 0, 1],
];

const bytes = n => new DataView(new ArrayBuffer(n));
const out = dv => [...new Uint8Array(dv.buffer)];
const el = (stream, offset, type, usage, index = 0) => [stream, 0, offset & 255, offset >> 8, type, 0, usage, index];
const END = [0xff, 0, 0, 0, 17, 0, 0, 0];

const xform = (p, M) => [0, 1, 2].map(j => p[0] * M[j] + p[1] * M[4 + j] + p[2] * M[8 + j] + M[12 + j]);
// n . (M^-1)^T for the upper 3x3 of M.
function nxform(n, M) {
  const a = (r, c) => M[r * 4 + c];
  const cof = (r, c) => a((r + 1) % 3, (c + 1) % 3) * a((r + 2) % 3, (c + 2) % 3) - a((r + 1) % 3, (c + 2) % 3) * a((r + 2) % 3, (c + 1) % 3);
  const det = a(0, 0) * cof(0, 0) + a(0, 1) * cof(0, 1) + a(0, 2) * cof(0, 2);
  return [0, 1, 2].map(j => (n[0] * cof(0, j) + n[1] * cof(1, j) + n[2] * cof(2, j)) / det);
}
// Weighted sum of f over (weight, matrix) pairs.
const blend = (pairs, f) => pairs.reduce((acc, [w, M]) => f(M).map((x, k) => acc[k] + w * x), [0, 0, 0]);
// The full weight list of n matrices from n - 1 stored weights.
const weights = (stored, n) => { const w = stored.slice(0, n - 1); w.push(1 - w.reduce((s, x) => s + x, 0)); return w; };
const f32ok = x => Math.fround(x) === x;

async function render(gps, extra = []) {
  const s = await openD3d9GpsSession({ gps, size: SIZE, extra });
  try {
    const ok = async (name, args) => assert.strictEqual(await s.call(name, args), 0, name);
    // A MIXED_VERTEXPROCESSING device: the caps check below switches it.
    await ok('IDirect3D9_CreateDevice', '[0,0,1,exports.get_main_hwnd(),0x80,ctx.d9g.pp,ctx.d9g.out]');
    await s.evaluate(`(()=>{const p=ctx.d9g;p.device=exports.guest_read32(p.out)>>>0;p.els=exports.guest_alloc(160)>>>0;
      p.dout=exports.guest_alloc(64)>>>0;p.up=exports.guest_alloc(1024)>>>0;p.m=exports.guest_alloc(64)>>>0;p.vbs=[];
      p.caps=exports.guest_alloc(304)>>>0;
      p.put=(ga,b)=>new Uint8Array(memory.buffer).set(b,exports.guest_to_wasm(ga));return true})()`);
    // Caps: MaxVertexBlendMatrices (+168), MaxVertexBlendMatrixIndex (+172)
    // from IDirect3D9 (hardware: 21), the device in hardware mode (21) and
    // in software mode (255, the D3D9 software limit).
    const caps = {};
    const blendCaps = async () => s.evaluate('[exports.guest_read32(ctx.d9g.caps+168)>>>0,exports.guest_read32(ctx.d9g.caps+172)>>>0]');
    await ok('IDirect3D9_GetDeviceCaps', '[0,0,1,ctx.d9g.caps]');
    caps.d3d9 = await blendCaps();
    await ok('IDirect3DDevice9_GetDeviceCaps', '[ctx.d9g.device,ctx.d9g.caps]');
    caps.hw = await blendCaps();
    await ok('IDirect3DDevice9_SetSoftwareVertexProcessing', '[ctx.d9g.device,1]');
    caps.swGet = await s.call('IDirect3DDevice9_GetSoftwareVertexProcessing', '[ctx.d9g.device]');
    await ok('IDirect3DDevice9_GetDeviceCaps', '[ctx.d9g.device,ctx.d9g.caps]');
    caps.sw = await blendCaps();
    await ok('IDirect3DDevice9_SetSoftwareVertexProcessing', '[ctx.d9g.device,0]');
    let ndecl = 0;
    const decl = async b => {
      await s.evaluate(`ctx.d9g.put(ctx.d9g.els,${JSON.stringify(b)});true`);
      const k = ndecl++;
      await ok('IDirect3DDevice9_CreateVertexDeclaration', `[ctx.d9g.device,ctx.d9g.els,ctx.d9g.dout+${4 * k}]`);
      return `exports.guest_read32(ctx.d9g.dout+${4 * k})>>>0`;
    };
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
    const world = async (k, M) => {
      await s.evaluate(`ctx.d9g.f32(ctx.d9g.m,${JSON.stringify(M)});true`);
      await ok('IDirect3DDevice9_SetTransform', `[ctx.d9g.device,${256 + k},ctx.d9g.m]`);
    };
    const rs = (id, v) => ok('IDirect3DDevice9_SetRenderState', `[ctx.d9g.device,${id},${v}]`);
    const up = v => s.evaluate(`ctx.d9g.put(ctx.d9g.up,${JSON.stringify(out(v))});true`);
    const frames = [], stats = [];
    // $mayFail: the old path refuses XYZBn FVFs (D3DERR_INVALIDCALL), so a
    // blended draw it runs may fail; its pixels are never compared (the
    // ring's are, with its decline count).
    const frame = async (bind, draw, mayFail = false) => {
      await bind();
      const before = await s.stats();
      const cpu0 = await s.evaluate('exports.d3d9_gps_stat(82)>>>0');
      await ok('IDirect3DDevice9_Clear', '[ctx.d9g.device,0,0,1,0xff000000,0x3f800000,0]');
      if (mayFail) await s.call(draw[0], draw[1]); else await ok(draw[0], draw[1]);
      await ok('IDirect3DDevice9_Present', '[ctx.d9g.device,0,0,0,0]');
      const after = await s.stats();
      stats.push({ declines: after.declines - before.declines, draws: after.draws - before.draws,
        cpu: (await s.evaluate('exports.d3d9_gps_stat(82)>>>0')) - cpu0,
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
    // The reference: positions (and normals) already blended, FVF XYZ |
    // [NORMAL] | DIFFUSE, identity world (or $W), no blend state.
    const reference = async (pos, nrm, W = I4) => {
      const stride = nrm ? 28 : 16, v = bytes(12 * stride);
      TRIS.forEach((k, i) => {
        pos[k].forEach((x, j) => { assert(f32ok(x), `inexact reference ${x}`); v.setFloat32(i * stride + j * 4, x, true); });
        if (nrm) nrm[k].forEach((x, j) => { assert(f32ok(x), `inexact reference ${x}`); v.setFloat32(i * stride + 12 + j * 4, x, true); });
        v.setUint32(i * stride + stride - 4, COLORS[k], true);
      });
      await up(v);
      await frame(async () => {
        await rs(151, 0); await rs(167, 0); await world(0, W);
        await ok('IDirect3DDevice9_SetVertexDeclaration', '[ctx.d9g.device,0]');
        await ok('IDirect3DDevice9_SetFVF', `[ctx.d9g.device,${nrm ? 0x52 : 0x42}]`);
      }, ['IDirect3DDevice9_DrawPrimitiveUP', `[ctx.d9g.device,4,4,ctx.d9g.up,${stride}]`]);
    };
    const P3 = k => [POS[k][0], POS[k][1], 0.5];
    await rs(22, 1);
    await rs(137, 0);
    for (let k = 0; k < 4; k++) await world(k, MATS[k]);
    // Two ring-presented frames first: the ring then leads ($d9g_lead) and
    // the old path no longer runs ahead of it.
    for (let i = 0; i < 2; i++) await reference(POS.map((_, k) => P3(k)));
    const plain = frames[0];
    frames.length = 0; stats.length = 0;

    // H: 1WEIGHTS, XYZB1 | DIFFUSE.
    {
      const W = [1, 0.75, 0.5, 0.25, 0], v = bytes(12 * 20);
      TRIS.forEach((k, i) => {
        [...P3(k), W[k]].forEach((x, j) => v.setFloat32(i * 20 + j * 4, x, true));
        v.setUint32(i * 20 + 16, COLORS[k], true);
      });
      await up(v);
      await frame(async () => {
        for (let k = 0; k < 2; k++) await world(k, MATS[k]);
        await rs(151, 1);
        await ok('IDirect3DDevice9_SetFVF', '[ctx.d9g.device,0x46]');
      }, ['IDirect3DDevice9_DrawPrimitiveUP', '[ctx.d9g.device,4,4,ctx.d9g.up,20]'], true);
      await reference(POS.map((_, k) => blend(weights([W[k]], 2).map((w, i) => [w, MATS[i]]), M => xform(P3(k), M))));
    }
    // I: 3WEIGHTS, declaration POSITION / BLENDWEIGHT FLOAT3 / COLOR, VB DIP.
    {
      const W = [[0.25, 0.25, 0.25], [0.5, 0.25, 0], [0, 0.5, 0.25], [0.125, 0.125, 0.5], [1, 0, 0]];
      const v = bytes(5 * 28), idx = bytes(24);
      for (let k = 0; k < 5; k++) {
        [...P3(k), ...W[k]].forEach((x, j) => v.setFloat32(k * 28 + j * 4, x, true));
        v.setUint32(k * 28 + 24, COLORS[k], true);
      }
      TRIS.forEach((k, i) => idx.setUint16(i * 2, k, true));
      const vb = await buffer(out(v)), ib = await buffer(out(idx), true);
      const d = await decl([...el(0, 0, 2, 0), ...el(0, 12, 2, 1), ...el(0, 24, 4, 10), ...END]);
      await frame(async () => {
        for (let k = 0; k < 4; k++) await world(k, MATS[k]);
        await rs(151, 3);
        await ok('IDirect3DDevice9_SetVertexDeclaration', `[ctx.d9g.device,${d}]`);
        await ok('IDirect3DDevice9_SetStreamSource', `[ctx.d9g.device,0,${vb},0,28]`);
        await ok('IDirect3DDevice9_SetIndices', `[ctx.d9g.device,${ib}]`);
      }, ['IDirect3DDevice9_DrawIndexedPrimitive', '[ctx.d9g.device,4,0,0,5,0,4]'], true);
      await reference(POS.map((_, k) => blend(weights(W[k], 4).map((w, i) => [w, MATS[i]]), M => xform(P3(k), M))));
    }
    // J: indexed 1WEIGHTS, XYZB2 | LASTBETA_UBYTE4 | DIFFUSE.
    {
      const W = [0.5, 0.25, 1, 0.75, 0], IX = [[5, 9], [9, 21], [21, 5], [5, 5], [21, 9]];
      const PAL = { 5: MATS[1], 9: MATS[3], 21: MATS[2] };
      const v = bytes(12 * 24);
      TRIS.forEach((k, i) => {
        [...P3(k), W[k]].forEach((x, j) => v.setFloat32(i * 24 + j * 4, x, true));
        v.setUint8(i * 24 + 16, IX[k][0]); v.setUint8(i * 24 + 17, IX[k][1]); v.setUint8(i * 24 + 18, 3); v.setUint8(i * 24 + 19, 200);
        v.setUint32(i * 24 + 20, COLORS[k], true);
      });
      await up(v);
      await frame(async () => {
        for (const k of [5, 9, 21]) await world(k, PAL[k]);
        await rs(151, 1); await rs(167, 1);
        await ok('IDirect3DDevice9_SetFVF', '[ctx.d9g.device,0x1048]');
      }, ['IDirect3DDevice9_DrawPrimitiveUP', '[ctx.d9g.device,4,4,ctx.d9g.up,24]'], true);
      await reference(POS.map((_, k) => blend(weights([W[k]], 2).map((w, i) => [w, PAL[IX[k][i]]]), M => xform(P3(k), M))));
    }
    // K: indexed 0WEIGHTS, XYZB1 | LASTBETA_D3DCOLOR: the index is byte 2.
    {
      const IX = [5, 9, 21, 9, 5];
      const PAL = { 5: MATS[1], 9: MATS[3], 21: MATS[0] };
      const v = bytes(12 * 20);
      TRIS.forEach((k, i) => {
        P3(k).forEach((x, j) => v.setFloat32(i * 20 + j * 4, x, true));
        v.setUint32(i * 20 + 12, (0xc8000000 | (IX[k] << 16) | 0xfafa) >>> 0, true);
        v.setUint32(i * 20 + 16, COLORS[k], true);
      });
      await up(v);
      await frame(async () => {
        for (const k of [5, 9, 21]) await world(k, PAL[k]);
        await rs(151, 256); await rs(167, 1);
        await ok('IDirect3DDevice9_SetFVF', '[ctx.d9g.device,0x8046]');
      }, ['IDirect3DDevice9_DrawPrimitiveUP', '[ctx.d9g.device,4,4,ctx.d9g.up,20]'], true);
      await reference(POS.map((_, k) => xform(P3(k), PAL[IX[k]])));
    }
    // L: lit 2WEIGHTS with NORMAL (matrices 0..2 have dyadic inverses).
    {
      const W = [[0.5, 0.25], [0.25, 0.25], [0, 0.5], [0.5, 0], [0.25, 0.5]];
      const v = bytes(12 * 36);
      TRIS.forEach((k, i) => {
        [...P3(k), ...W[k], ...NORMALS[k]].forEach((x, j) => v.setFloat32(i * 36 + j * 4, x, true));
        v.setUint32(i * 36 + 32, COLORS[k], true);
      });
      await s.evaluate(`(()=>{const p=ctx.d9g;p.mat=exports.guest_alloc(68)>>>0;p.light=exports.guest_alloc(104)>>>0;
        p.f32(p.mat,[1,1,1,1, .5,.5,.5,1, 1,1,1,1, .0625,0,0,0, 8]);p.u32(p.light,[3]);
        p.f32(p.light+4,[.5,.5,.5,1, 1,1,1,1, .125,.125,.25,1, 0,0,0, .25,-.25,1, 10,1, 1,0,0, 0,0]);return true})()`);
      const d = await decl([...el(0, 0, 2, 0), ...el(0, 12, 1, 1), ...el(0, 20, 2, 3), ...el(0, 32, 4, 10), ...END]);
      const lit = async () => {
        await rs(137, 1); await rs(139, 0xff202020);
        await ok('IDirect3DDevice9_SetMaterial', '[ctx.d9g.device,ctx.d9g.mat]');
        await ok('IDirect3DDevice9_SetLight', '[ctx.d9g.device,0,ctx.d9g.light]');
        await ok('IDirect3DDevice9_LightEnable', '[ctx.d9g.device,0,1]');
      };
      await up(v);
      await frame(async () => {
        await lit();
        for (let k = 0; k < 3; k++) await world(k, MATS[k]);
        await rs(151, 2);
        await ok('IDirect3DDevice9_SetVertexDeclaration', `[ctx.d9g.device,${d}]`);
      }, ['IDirect3DDevice9_DrawPrimitiveUP', '[ctx.d9g.device,4,4,ctx.d9g.up,36]'], true);
      const pairs = k => weights(W[k], 3).map((w, i) => [w, MATS[i]]);
      await reference(POS.map((_, k) => blend(pairs(k), M => xform(P3(k), M))),
        POS.map((_, k) => blend(pairs(k), M => nxform(NORMALS[k], M))));
      await rs(137, 0);
    }
    // M: TWEENING, POSITION1 on stream 1, TWEENFACTOR 0.25, world 0 = MATS[0].
    {
      const P1 = k => [POS[k][1] * 0.5, -POS[k][0], 0.5];
      const v0 = bytes(5 * 16), v1 = bytes(5 * 12), idx = bytes(24);
      for (let k = 0; k < 5; k++) {
        P3(k).forEach((x, j) => v0.setFloat32(k * 16 + j * 4, x, true));
        v0.setUint32(k * 16 + 12, COLORS[k], true);
        P1(k).forEach((x, j) => v1.setFloat32(k * 12 + j * 4, x, true));
      }
      TRIS.forEach((k, i) => idx.setUint16(i * 2, k, true));
      const b0 = await buffer(out(v0)), b1 = await buffer(out(v1)), ib = await buffer(out(idx), true);
      const d = await decl([...el(0, 0, 2, 0), ...el(0, 12, 4, 10), ...el(1, 0, 2, 0, 1), ...END]);
      await frame(async () => {
        await world(0, MATS[0]);
        await rs(151, 255); await rs(170, 0x3e800000);
        await ok('IDirect3DDevice9_SetVertexDeclaration', `[ctx.d9g.device,${d}]`);
        await ok('IDirect3DDevice9_SetStreamSource', `[ctx.d9g.device,0,${b0},0,16]`);
        await ok('IDirect3DDevice9_SetStreamSource', `[ctx.d9g.device,1,${b1},0,12]`);
        await ok('IDirect3DDevice9_SetIndices', `[ctx.d9g.device,${ib}]`);
      }, ['IDirect3DDevice9_DrawIndexedPrimitive', '[ctx.d9g.device,4,0,0,5,0,4]'], true);
      await reference(POS.map((_, k) => P3(k).map((x, j) => x + (P1(k)[j] - x) * 0.25)), null, MATS[0]);
    }
    // N: an indexed blend naming palette entry 30 (past the shader's 22):
    // blended on the CPU (d9cpu).
    {
      const v = bytes(12 * 20);
      TRIS.forEach((k, i) => {
        P3(k).forEach((x, j) => v.setFloat32(i * 20 + j * 4, x, true));
        v.setUint32(i * 20 + 12, k === 2 ? 30 : 5, true);
        v.setUint32(i * 20 + 16, COLORS[k], true);
      });
      await up(v);
      await frame(async () => {
        await world(5, MATS[1]); await world(30, MATS[2]);
        await rs(151, 256); await rs(167, 1);
        await ok('IDirect3DDevice9_SetFVF', '[ctx.d9g.device,0x1046]');
      }, ['IDirect3DDevice9_DrawPrimitiveUP', '[ctx.d9g.device,4,4,ctx.d9g.up,20]'], true);
      await reference(POS.map((_, k) => xform(P3(k), k === 2 ? MATS[2] : MATS[1])));
    }
    // O: lit indexed 2WEIGHTS with NORMAL, a declaration with UBYTE4 indices
    // 40 / 128 / 255 and a VB DIP: positions and normals blended on the CPU.
    {
      const W = [[0.5, 0.25], [0.25, 0.25], [0, 0.5], [0.5, 0], [0.25, 0.5]];
      const IX = [[40, 128, 255], [255, 40, 128], [128, 255, 40], [40, 255, 128], [255, 128, 40]];
      const PAL = { 40: MATS[0], 128: MATS[1], 255: MATS[2] };
      const v = bytes(5 * 40), idx = bytes(24);
      for (let k = 0; k < 5; k++) {
        [...P3(k), ...W[k]].forEach((x, j) => v.setFloat32(k * 40 + j * 4, x, true));
        IX[k].forEach((n, j) => v.setUint8(k * 40 + 20 + j, n)); v.setUint8(k * 40 + 23, 7);
        NORMALS[k].forEach((x, j) => v.setFloat32(k * 40 + 24 + j * 4, x, true));
        v.setUint32(k * 40 + 36, COLORS[k], true);
      }
      TRIS.forEach((k, i) => idx.setUint16(i * 2, k, true));
      const vb = await buffer(out(v)), ib = await buffer(out(idx), true);
      const d = await decl([...el(0, 0, 2, 0), ...el(0, 12, 1, 1), ...el(0, 20, 5, 2), ...el(0, 24, 2, 3), ...el(0, 36, 4, 10), ...END]);
      const lit = async () => {
        await rs(137, 1); await rs(139, 0xff202020);
        await ok('IDirect3DDevice9_SetMaterial', '[ctx.d9g.device,ctx.d9g.mat]');
        await ok('IDirect3DDevice9_SetLight', '[ctx.d9g.device,0,ctx.d9g.light]');
        await ok('IDirect3DDevice9_LightEnable', '[ctx.d9g.device,0,1]');
      };
      await frame(async () => {
        await lit();
        for (const k of [40, 128, 255]) await world(k, PAL[k]);
        await rs(151, 2); await rs(167, 1);
        await ok('IDirect3DDevice9_SetVertexDeclaration', `[ctx.d9g.device,${d}]`);
        await ok('IDirect3DDevice9_SetStreamSource', `[ctx.d9g.device,0,${vb},0,40]`);
        await ok('IDirect3DDevice9_SetIndices', `[ctx.d9g.device,${ib}]`);
      }, ['IDirect3DDevice9_DrawIndexedPrimitive', '[ctx.d9g.device,4,0,0,5,0,4]'], true);
      const pairs = k => weights(W[k], 3).map((w, i) => [w, PAL[IX[k][i]]]);
      await rs(167, 0);
      await reference(POS.map((_, k) => blend(pairs(k), M => xform(P3(k), M))),
        POS.map((_, k) => blend(pairs(k), M => nxform(NORMALS[k], M))));
      await rs(137, 0);
    }
    // P: a FLOAT1 index of 300 (past D3D's 255) still declines 27.
    {
      const v = bytes(12 * 20);
      TRIS.forEach((k, i) => {
        P3(k).forEach((x, j) => v.setFloat32(i * 20 + j * 4, x, true));
        v.setFloat32(i * 20 + 12, k === 2 ? 300 : 5, true);
        v.setUint32(i * 20 + 16, COLORS[k], true);
      });
      const d = await decl([...el(0, 0, 2, 0), ...el(0, 12, 0, 2), ...el(0, 16, 4, 10), ...END]);
      await up(v);
      await frame(async () => {
        await rs(151, 256); await rs(167, 1);
        await ok('IDirect3DDevice9_SetVertexDeclaration', `[ctx.d9g.device,${d}]`);
      }, ['IDirect3DDevice9_DrawPrimitiveUP', '[ctx.d9g.device,4,4,ctx.d9g.up,20]'], true);
    }
    const st = await s.stats();
    st.cpuBlends = await s.evaluate('exports.d3d9_gps_stat(82)>>>0');
    await s.call('IDirect3DDevice9_Release', '[ctx.d9g.device]');
    assert.strictEqual(await s.close(), 0, s.output());
    return { frames, stats, st, plain, caps };
  } catch (error) { console.error(s.output().slice(-4000)); await s.close(); throw error; }
}

(async () => {
  const old = await render('off');
  const ring = await render('software');
  const names = 'HIJKLMNO';
  const bad = [];
  names.split('').forEach((name, i) => {
    const blended = 2 * i, ref = 2 * i + 1;
    const fb = ring.stats[blended], fr = ring.stats[ref];
    if (fb.declines || fb.draws !== 1) bad.push(`${name} blended ${JSON.stringify(fb)}`);
    if (fr.declines || fr.draws !== 1) bad.push(`${name} reference ${JSON.stringify(fr)}`);
    const want = old.frames[ref];
    assert(new Set(want).size > 3, `reference ${name} is flat`);
    // The blend moved the mesh (the unblended mesh would not pass).
    assert(want.some((v, k) => v !== old.plain[k]), `reference ${name} equals the unblended mesh`);
    for (const [label, got] of [['reference', ring.frames[ref]], ['blended', ring.frames[blended]]]) {
      const diff = want.findIndex((v, k) => v !== got[k]);
      if (diff >= 0) bad.push(`${name} ${label} pixel ${diff}: want ${(want[diff] >>> 0).toString(16)} ring ${(got[diff] >>> 0).toString(16)}`);
    }
  });
  // N and O blend on the CPU (palette entries past 21); J and K do not.
  const cpu = ring.stats.map(f => f.cpu).join('');
  if (cpu !== '00000000000010100') bad.push(`CPU-blended draws per frame ${cpu}, want N and O blended only`);
  const last = ring.stats[ring.stats.length - 1];
  if (last.declines !== 1 || last.reasons[27] !== 1) bad.push(`P (FLOAT1 index 300) ${JSON.stringify(last)}`);
  assert.deepStrictEqual(ring.caps, { d3d9: [4, 21], hw: [4, 21], swGet: 1, sw: [4, 255] }, 'vertex blend caps');
  // --webgl (needs a display): on the WebGL executor every blended frame
  // must equal its own reference frame there (rasterization differs from
  // the software path, the blend must not).
  if (process.argv.includes('--webgl')) {
    const gl = await render('webgl', ['--headless-gl']);
    names.split('').forEach((name, i) => {
      const fb = gl.stats[2 * i], want = gl.frames[2 * i + 1], got = gl.frames[2 * i];
      if (fb.declines || fb.draws !== 1) bad.push(`webgl ${name} blended ${JSON.stringify(fb)}`);
      const diff = want.findIndex((v, k) => v !== got[k]);
      if (diff >= 0) bad.push(`webgl ${name} pixel ${diff}: reference ${(want[diff] >>> 0).toString(16)} blended ${(got[diff] >>> 0).toString(16)}`);
    });
    if (gl.stats.map(f => f.cpu).join('') !== '00000000000010100') bad.push('webgl CPU-blended draws per frame');
  }
  assert.deepStrictEqual(bad, [], `frames that declined or differ:\n  ${bad.join('\n  ')}`);
  console.log(`PASS fixed-function vertex blending / tweening on the ring, ${names.length} blends pixel-exact against CPU-blended references (N, O on the WAT CPU path), caps ${JSON.stringify(ring.caps)}\n  ring ${JSON.stringify(ring.st)}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
