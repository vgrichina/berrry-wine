#!/usr/bin/env node
'use strict';
// Retirement slice S3 (src/09akg-d3d9-gps.wat, decline reason 12): fixed
// T&L texture transforms and texture-coordinate generation lower on the
// ring instead of declining. The shader is compiled once per SHAPE (the
// TEXTURETRANSFORMFLAGS and TEXCOORDINDEX generator are in the key), and the
// values -- the D3DTS_TEXTUREn matrix as c16..c39 and a normal texgen's
// normal matrix as c40..c42 -- go out per draw. Every frame's 16x16 back
// buffer must equal the old software path's, pixel for pixel: COUNT2 with
// two matrices (one shape), CAMERASPACEPOSITION, CAMERASPACENORMAL (with a
// rotated view), REFLECTIONVECTOR with NORMALIZENORMALS. A PROJECTED
// transform still declines (12): it is a raster divide the executor lacks.
const assert = require('assert');
const { openD3d9GpsSession } = require('./helpers/d3d9-gps-session');

const SIZE = 16;
// XYZ | NORMAL | DIFFUSE | TEX1, stride 36: four triangles around the centre.
const NORMALS = [[0, 0, -1], [-0.5, 0.5, -0.7], [0.5, 0.5, -0.7], [0.5, -0.5, -0.7], [-0.5, -0.5, -0.7]];
const CORNERS = [[-1, 1, 0, 0], [1, 1, 1, 0], [1, -1, 1, 1], [-1, -1, 0, 1]];
function mesh() {
  const out = [];
  for (let t = 0; t < 4; t++) {
    for (const [i, c] of [[0, [0, 0, 0.5, 0.5]], [1 + t, CORNERS[t]], [1 + ((t + 1) % 4), CORNERS[(t + 1) % 4]]])
      out.push([c[0], c[1], 0.5, ...NORMALS[i], c[2], c[3]]);
  }
  return out;
}
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
// Row-major D3D matrices; a 2D texture transform's translation is _31/_32.
const SCALE2 = [0.5, 0, 0, 0, 0, 0.5, 0, 0, 0.25, 0.25, 1, 0, 0, 0, 0, 1];
const SWAP2 = [0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
// Generated (x, y, z, 1) -> 0.5 * (x, -y) + 0.5.
const GEN = [0.5, 0, 0, 0, 0, -0.5, 0, 0, 0, 0, 1, 0, 0.5, 0.5, 0, 1];
const VIEW = (a => [Math.cos(a), 0, -Math.sin(a), 0, 0, 1, 0, 0, Math.sin(a), 0, Math.cos(a), 0, 0, 0, 0, 1])(0.4);

async function render(gps) {
  const s = await openD3d9GpsSession({ gps, size: SIZE });
  try {
    assert.strictEqual(await s.call('IDirect3D9_CreateDevice', '[0,0,1,exports.get_main_hwnd(),0,ctx.d9g.pp,ctx.d9g.out]'), 0);
    await s.evaluate('ctx.d9g.device=exports.guest_read32(ctx.d9g.out)>>>0');
    const ok = async (name, args) => assert.strictEqual(await s.call(name, args), 0, name);
    await s.evaluate(`(()=>{const p=ctx.d9g;p.mesh=exports.guest_alloc(12*36)>>>0;p.matrix=exports.guest_alloc(64)>>>0;
      p.texout=exports.guest_alloc(4)>>>0;p.tlr=exports.guest_alloc(8)>>>0;
      ${JSON.stringify(mesh())}.forEach((v,i)=>{p.f32(p.mesh+i*36,v.slice(0,6));p.u32(p.mesh+i*36+24,[0xffffffff]);p.f32(p.mesh+i*36+28,v.slice(6));});return true})()`);
    // A 4x4 A8R8G8B8 managed texture, every texel distinct.
    await ok('IDirect3DDevice9_CreateTexture', '[ctx.d9g.device,4,4,1,0,21,1,ctx.d9g.texout,0]');
    await s.evaluate('ctx.d9g.tex=exports.guest_read32(ctx.d9g.texout)>>>0');
    await ok('IDirect3DTexture9_LockRect', '[ctx.d9g.tex,0,ctx.d9g.tlr,0,0]');
    await s.evaluate(`(()=>{const p=ctx.d9g,pitch=exports.guest_read32(p.tlr)|0,bits=exports.guest_read32(p.tlr+4)>>>0;
      for(let y=0;y<4;y++)for(let x=0;x<4;x++)p.u32(bits+y*pitch+x*4,[(0xff000000|((x*60+30)<<16)|((y*60+30)<<8)|((x+y)*30))>>>0]);return true})()`);
    await ok('IDirect3DTexture9_UnlockRect', '[ctx.d9g.tex,0]');
    await ok('IDirect3DDevice9_SetTexture', '[ctx.d9g.device,0,ctx.d9g.tex]');
    const rs = (state, value) => ok('IDirect3DDevice9_SetRenderState', `[ctx.d9g.device,${state},${value}]`);
    const tss = (state, value) => ok('IDirect3DDevice9_SetTextureStageState', `[ctx.d9g.device,0,${state},${value}]`);
    const transform = async (type, m) => {
      await s.evaluate(`ctx.d9g.f32(ctx.d9g.matrix,${JSON.stringify(m)});true`);
      await ok('IDirect3DDevice9_SetTransform', `[ctx.d9g.device,${type},ctx.d9g.matrix]`);
    };
    const frames = [];
    const frame = async () => {
      await ok('IDirect3DDevice9_SetFVF', '[ctx.d9g.device,0x152]');
      await ok('IDirect3DDevice9_Clear', '[ctx.d9g.device,0,0,1,0xff000000,0x3f800000,0]');
      await ok('IDirect3DDevice9_DrawPrimitiveUP', '[ctx.d9g.device,4,4,ctx.d9g.mesh,36]');
      await ok('IDirect3DDevice9_Present', '[ctx.d9g.device,0,0,0,0]');
      assert.strictEqual(await s.call('IDirect3DDevice9_GetBackBuffer', '[ctx.d9g.device,0,0,0,ctx.d9g.surface]'), 0);
      await s.evaluate('ctx.d9g.bb=exports.guest_read32(ctx.d9g.surface)>>>0');
      await ok('IDirect3DSurface9_LockRect', '[ctx.d9g.bb,ctx.d9g.lr,0,1<<4]');
      frames.push(await s.evaluate(`(()=>{const p=ctx.d9g,pitch=exports.guest_read32(p.lr)|0,
        wa=exports.guest_to_wasm(exports.guest_read32(p.lr+4)>>>0),v=new DataView(memory.buffer),out=[];
        for(let y=0;y<${SIZE};y++)for(let x=0;x<${SIZE};x++)out.push(v.getUint32(wa+y*pitch+x*4,true)>>>0);return out})()`));
      await ok('IDirect3DSurface9_UnlockRect', '[ctx.d9g.bb]');
      await s.call('IDirect3DSurface9_Release', '[ctx.d9g.bb]');
    };
    await rs(22, 1);
    await rs(137, 0);
    await frame();                                            // 0 untransformed
    await tss(24, 2); await transform(16, SCALE2);
    await frame();                                            // 1 COUNT2
    await transform(16, SWAP2);
    await frame();                                            // 2 same shape, new matrix
    await tss(11, 0x20000); await transform(16, GEN);
    await frame();                                            // 3 CAMERASPACEPOSITION
    await tss(11, 0x10000);
    await frame();                                            // 4 CAMERASPACENORMAL
    await transform(2, VIEW);
    await frame();                                            // 5 ... rotated view (new c40..c42)
    await tss(11, 0x30000); await rs(143, 1);
    await frame();                                            // 6 REFLECTIONVECTOR, NORMALIZENORMALS
    await transform(2, I); await rs(143, 0); await tss(11, 0); await tss(24, 0);
    await frame();                                            // 7 back to untransformed
    const before = await s.stats();
    await tss(24, 0x103);                                     // COUNT3 | PROJECTED
    await frame();                                            // 8 declines (12)
    const st = await s.stats();
    await s.call('IDirect3DTexture9_Release', '[ctx.d9g.tex]');
    await s.call('IDirect3DDevice9_Release', '[ctx.d9g.device]');
    assert.strictEqual(await s.close(), 0, s.output());
    return { frames, before, st };
  } catch (error) { console.error(s.output().slice(-4000)); await s.close(); throw error; }
}

(async () => {
  const old = await render('off');
  const ring = await render('software');
  assert.strictEqual(ring.before.declines, 0, `no declines before PROJECTED ${JSON.stringify(ring.before)}`);
  assert(ring.before.draws >= 8, `texgen draws on the ring ${JSON.stringify(ring.before)}`);
  assert.deepStrictEqual(ring.st.reasons, { 12: 1 }, `PROJECTED declines 12 ${JSON.stringify(ring.st)}`);
  const lines = [];
  for (let i = 0; i < old.frames.length; i++) {
    const a = old.frames[i], b = ring.frames[i];
    const diff = a.findIndex((v, k) => v !== b[k]);
    assert.strictEqual(diff, -1, `frame ${i} pixel ${diff}: old ${(a[diff] >>> 0).toString(16)} ring ${(b[diff] >>> 0).toString(16)}`);
    assert(new Set(a).size > 3, `frame ${i} is not flat`);
    lines.push(`frame ${i}: ${new Set(a).size} colours, centre ${(a[8 * SIZE + 8] >>> 0).toString(16)}`);
  }
  for (const [i, j] of [[0, 1], [1, 2], [3, 4], [4, 5]])
    assert.notDeepStrictEqual(old.frames[i], old.frames[j], `frames ${i} and ${j} differ`);
  console.log(`PASS texture transforms and texgen on the ring match the old path\n  ${lines.join('\n  ')}\n  ring ${JSON.stringify(ring.st)}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
