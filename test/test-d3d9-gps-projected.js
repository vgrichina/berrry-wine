#!/usr/bin/env node
'use strict';
// Decline reason 12, the rest (src/09akg-d3d9-gps.wat, d9pj block):
// D3DTTFF_PROJECTED with COUNT2 and PROJECTED on POSITIONT vertices lower as
// the per-pixel DZ / DW divide the executors already have, with no executor
// feature. Each ring frame equals an equivalent plain draw pixel for pixel:
//   T  fixed T&L, CAMERASPACEPOSITION through a COUNT2 | PROJECTED matrix
//      whose columns are (u, q) == COUNT4 | PROJECTED with (u, 0, 0, q)
//      columns (the divisor is consumed, v is 0) -- the old path's frame;
//   P  POSITIONT FLOAT2 (u, q) under COUNT2 | PROJECTED == FLOAT4
//      (u, 0, 0, q) under COUNT4 | PROJECTED;
//   Q  POSITIONT FLOAT3 (u, v, q) under COUNT3 | PROJECTED == FLOAT4
//      (u, v, 0, q) under COUNT4 | PROJECTED (q varies, so an affine
//      reading would differ: checked against the unprojected frame);
//   S  a guest ps_1_4 ignores PROJECTED (it projects explicitly): ring
//      COUNT4 | PROJECTED == old path COUNT4.
// PROJECTED | COUNT1 (nothing left after the divide) still declines 12.
const assert = require('assert');
const { openD3d9GpsSession } = require('./helpers/d3d9-gps-session');

const SIZE = 16;
// XYZ | NORMAL | DIFFUSE | TEX1, stride 36: four triangles around the centre.
const CORNERS = [[-1, 1], [1, 1], [1, -1], [-1, -1]];
function mesh() {
  const out = [];
  for (let t = 0; t < 4; t++)
    for (const c of [[0, 0], CORNERS[t], CORNERS[(t + 1) % 4]]) out.push([c[0], c[1], 0.5, 0, 0, -1, 0, 0]);
  return out;
}
// Camera position (x, y, 0.5, 1): u = 1.5x + 1.6, q = 0.5x + 1.25.
const PROJ2 = [1.5, 0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1.6, 1.25, 0, 1];
const PROJ2AS4 = [1.5, 0, 0, 0.5, 0, 0, 0, 0, 0, 0, 0, 0, 1.6, 0, 0, 1.25];
const PROJ4 = [0.5, 0, 0, 0.5, 0, -0.5, 0, 0, 0, 0, 0, 0, 0.6, 0.6, 0, 1.25];
// POSITIONT quad (two triangles) over the 16x16 target, rhw varying so the
// rasterizer's perspective weights matter too; per corner (u, v, q).
const TCORNERS = [[0, 0, 0.2, 0.2, 1, 0.5], [16, 0, 3.5, 0.4, 2, 1], [16, 16, 2.2, 3.0, 3, 0.25], [0, 16, 0.3, 1.2, 0.75, 2]];
const TORDER = [0, 1, 2, 0, 2, 3];
// layout: (u,v,q) -> the set's floats.
function tmesh(layout) {
  return TORDER.map(k => { const [x, y, u, v, q, rhw] = TCORNERS[k]; return { pos: [x, y, 0.5, rhw], tc: layout(u, v, q) }; });
}

async function render(gps, ring, extra = []) {
  const s = await openD3d9GpsSession({ gps, size: SIZE, extra });
  try {
    assert.strictEqual(await s.call('IDirect3D9_CreateDevice', '[0,0,1,exports.get_main_hwnd(),0,ctx.d9g.pp,ctx.d9g.out]'), 0);
    await s.evaluate('ctx.d9g.device=exports.guest_read32(ctx.d9g.out)>>>0');
    const ok = async (name, args) => assert.strictEqual(await s.call(name, args), 0, name);
    await s.evaluate(`(()=>{const p=ctx.d9g;p.mesh=exports.guest_alloc(12*36)>>>0;p.matrix=exports.guest_alloc(64)>>>0;
      p.texout=exports.guest_alloc(4)>>>0;p.tlr=exports.guest_alloc(8)>>>0;p.tm=exports.guest_alloc(6*48)>>>0;
      p.psb=exports.guest_alloc(64)>>>0;
      ${JSON.stringify(mesh())}.forEach((v,i)=>{p.f32(p.mesh+i*36,v.slice(0,6));p.u32(p.mesh+i*36+24,[0xffffffff]);p.f32(p.mesh+i*36+28,v.slice(6));});return true})()`);
    // A 4x4 A8R8G8B8 managed texture, every texel distinct, WRAP.
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
    const frames = {};
    const status = {};
    const grab = async name => {
      await ok('IDirect3DDevice9_Present', '[ctx.d9g.device,0,0,0,0]');
      assert.strictEqual(await s.call('IDirect3DDevice9_GetBackBuffer', '[ctx.d9g.device,0,0,0,ctx.d9g.surface]'), 0);
      await s.evaluate('ctx.d9g.bb=exports.guest_read32(ctx.d9g.surface)>>>0');
      await ok('IDirect3DSurface9_LockRect', '[ctx.d9g.bb,ctx.d9g.lr,0,1<<4]');
      frames[name] = await s.evaluate(`(()=>{const p=ctx.d9g,pitch=exports.guest_read32(p.lr)|0,
        wa=exports.guest_to_wasm(exports.guest_read32(p.lr+4)>>>0),v=new DataView(memory.buffer),out=[];
        for(let y=0;y<${SIZE};y++)for(let x=0;x<${SIZE};x++)out.push(v.getUint32(wa+y*pitch+x*4,true)>>>0);return out})()`);
      await ok('IDirect3DSurface9_UnlockRect', '[ctx.d9g.bb]');
      await s.call('IDirect3DSurface9_Release', '[ctx.d9g.bb]');
    };
    const draw = async (name, fvf, args) => {
      await ok('IDirect3DDevice9_SetFVF', `[ctx.d9g.device,${fvf}]`);
      await ok('IDirect3DDevice9_Clear', '[ctx.d9g.device,0,0,1,0xff000000,0x3f800000,0]');
      status[name] = await s.call('IDirect3DDevice9_DrawPrimitiveUP', args);
      await grab(name);
    };
    const tl = name => draw(name, 0x152, '[ctx.d9g.device,4,4,ctx.d9g.mesh,36]');
    // XYZRHW | DIFFUSE | TEX1 with TEXCOORDSIZEn(0).
    const pt = async (name, n, layout) => {
      const stride = 20 + 4 * n;
      await s.evaluate(`(()=>{const p=ctx.d9g;${JSON.stringify(tmesh(layout))}.forEach((v,i)=>{
        p.f32(p.tm+i*${stride},v.pos);p.u32(p.tm+i*${stride}+16,[0xffffffff]);p.f32(p.tm+i*${stride}+20,v.tc);});return true})()`);
      const size = { 1: 3, 2: 0, 3: 1, 4: 2 }[n];
      await draw(name, 0x144 | (size << 16), `[ctx.d9g.device,4,2,ctx.d9g.tm,${stride}]`);
    };
    await rs(22, 1);
    await rs(137, 0);
    // COUNT1 | PROJECTED (ring === 'count1'): the draw alone in its own
    // session -- the old path refuses the flags, and a refused draw leaves
    // its device failing every later call.
    if (ring === 'count1') {
      await tss(11, 0x20000); await tss(24, 0x101);
      await ok('IDirect3DDevice9_SetFVF', '[ctx.d9g.device,0x152]');
      await ok('IDirect3DDevice9_Clear', '[ctx.d9g.device,0,0,1,0xff000000,0x3f800000,0]');
      await s.call('IDirect3DDevice9_DrawPrimitiveUP', '[ctx.d9g.device,4,4,ctx.d9g.mesh,36]');
      const st = await s.stats();
      await s.close();
      return { st };
    }
    // Fixed T&L.
    await tss(11, 0x20000);
    await transform(16, PROJ2AS4); await tss(24, 0x104);
    await tl('Tref');
    if (ring) { await transform(16, PROJ2); await tss(24, 0x102); await tl('T'); }
    await tss(11, 0);
    // POSITIONT: ring only (the old path refuses any transform flags on
    // POSITIONT, "unsupported fixed texture transform flags").
    if (ring) {
    await tss(24, 0x104);
    await pt('Pref', 4, (u, v, q) => [u, 0, 0, q]);
    await tss(24, 0x102);
    await pt('P', 2, (u, v, q) => [u, q]);
    await tss(24, 0x103);
    await pt('Q', 3, (u, v, q) => [u, v, q]);
    await tss(24, 0x104);
    await pt('Qref', 4, (u, v, q) => [u, v, 0, q]);
    await tss(24, 0);
    await pt('Qaffine', 2, (u, v, q) => [u / q, v / q]);
    }
    // ps_1_4: texld r0, t0.
    await tss(11, 0x20000); await transform(16, PROJ4);
    await s.evaluate(`ctx.d9g.u32(ctx.d9g.psb,${JSON.stringify([0xffff0104, 0x42, 0x800f0000, 0xb0e40000, 0xffff])});true`);
    await ok('IDirect3DDevice9_CreatePixelShader', '[ctx.d9g.device,ctx.d9g.psb,ctx.d9g.texout]');
    await ok('IDirect3DDevice9_SetPixelShader', '[ctx.d9g.device,exports.guest_read32(ctx.d9g.texout)>>>0]');
    await tss(24, 4);
    await tl('Sref');
    if (ring) { await tss(24, 0x104); await tl('S'); }
    await ok('IDirect3DDevice9_SetPixelShader', '[ctx.d9g.device,0]');
    const st = await s.stats();
    await s.call('IDirect3DTexture9_Release', '[ctx.d9g.tex]');
    await s.call('IDirect3DDevice9_Release', '[ctx.d9g.device]');
    assert.strictEqual(await s.close(), 0, s.output());
    return { frames, status, st };
  } catch (error) {
    const out = s.output();
    if (process.env.D9PJ_LOG) require('fs').writeFileSync(process.env.D9PJ_LOG, out);
    console.error(out.split('\n').filter(l => !l.startsWith('[ctl]') && !/^\[\d+\] EIP/.test(l)).join('\n').slice(-4000));
    await s.close(); throw error;
  }
}

(async () => {
  const old = await render('off');
  const ring = await render('software', true);
  const bad = [], lines = [];
  const hex = n => (n >>> 0).toString(16);
  const same = (a, b, label) => {
    const k = a.findIndex((v, i) => v !== b[i]);
    if (k >= 0) bad.push(`${label}: pixel ${k} ${hex(a[k])} vs ${hex(b[k])}`);
    if (new Set(a).size < 4) bad.push(`${label}: only ${new Set(a).size} colours`);
    lines.push(`${label}: ${k < 0 ? 'same' : 'DIFFERS'}, ${new Set(a).size} colours`);
  };
  if (ring.st.declines) bad.push(`declines ${JSON.stringify(ring.st)}`);
  same(ring.frames.T, old.frames.Tref, 'T (COUNT2|PROJECTED, fixed T&L) vs old COUNT4 equivalent');
  same(ring.frames.T, ring.frames.Tref, 'T vs ring COUNT4 equivalent');
  same(ring.frames.Tref, old.frames.Tref, 'Tref ring vs old');
  same(ring.frames.P, ring.frames.Pref, 'P (POSITIONT COUNT2|PROJECTED) vs FLOAT4 (u,0,0,q)');
  same(ring.frames.Q, ring.frames.Qref, 'Q (POSITIONT COUNT3|PROJECTED) vs FLOAT4 (u,v,0,q)');
  if (ring.frames.Q.every((v, i) => v === ring.frames.Qaffine[i])) bad.push('Q equals the affine (u/q, v/q) frame');
  same(ring.frames.S, old.frames.Sref, 'S (ps_1_4 under PROJECTED) vs old non-projected');
  const count1 = await render('software', 'count1');
  if (JSON.stringify(count1.st.reasons) !== '{"12":1}') bad.push(`COUNT1|PROJECTED reasons ${JSON.stringify(count1.st)}`);
  // --webgl (needs a display): the same equalities on the WebGL executor.
  if (process.argv.includes('--webgl')) {
    const gl = await render('webgl', true, ['--headless-gl']);
    if (gl.st.declines) bad.push(`webgl declines ${JSON.stringify(gl.st)}`);
    for (const [a, b] of [['T', 'Tref'], ['P', 'Pref'], ['Q', 'Qref'], ['S', 'S']])
      same(gl.frames[a], (a === 'S' ? ring : gl).frames[b], `webgl ${a} vs ${a === 'S' ? 'software ring S' : b}`);
  }
  assert.deepStrictEqual(bad, [], `\n  ${bad.join('\n  ')}\n  ${lines.join('\n  ')}`);
  console.log(`PASS projected texcoords (COUNT2, POSITIONT, ps_1_4) on the ring\n  ${lines.join('\n  ')}\n  ring ${JSON.stringify(ring.st)}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
