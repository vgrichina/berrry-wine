#!/usr/bin/env node
'use strict';
// Retirement slice S3 (src/09akg-d3d9-gps.wat "fixed-function lighting"):
// lit fixed-function T&L lowers on the ring instead of declining (reason
// 28). The ring binds the same 09aj DLT1 lighting the old path's
// lib/d3d-shader-ir.js fixedCascade binds, but compiles it once per
// lighting SHAPE and sends the values (normal matrix, material, lights) as
// c40..c95 per draw -- so frames that only move the world matrix or recolour
// a light reuse the shader. Every frame's 16x16 back buffer must equal the
// old software path's, pixel for pixel: directional, point and spot lights,
// SPECULARENABLE, a spot falloff other than 1, no lights at all (ambient from
// the vertex colour), and a mesh
// without normals.
const assert = require('assert');
const { openD3d9GpsSession } = require('./helpers/d3d9-gps-session');

const SIZE = 16;
// XYZ | NORMAL | DIFFUSE, stride 28: four triangles around the centre.
const NORMALS = [[0, 0, -1], [0.6, 0, -0.8], [0, 0.6, -0.8], [-0.6, 0, -0.8], [0, -0.6, -0.8]];
const COLORS = [0xffffffff, 0xffff8080, 0xff80ff80, 0xff8080ff, 0xffffff00];
const CORNERS = [[-1, 1], [1, 1], [1, -1], [-1, -1]];
function mesh() {
  const f = [], u = [];
  for (let t = 0; t < 4; t++) {
    const a = CORNERS[t], b = CORNERS[(t + 1) % 4];
    for (const [i, xy] of [[0, [0, 0]], [1 + t, a], [1 + ((t + 1) % 4), b]]) {
      f.push([...xy, 0.5, ...NORMALS[i]]); u.push(COLORS[i]);
    }
  }
  return { f, u };
}
const rotZ = a => [Math.cos(a), Math.sin(a), 0, 0, -Math.sin(a), Math.cos(a), 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
// D3DLIGHT9: type, diffuse, specular, ambient, position, direction, range,
// falloff, attenuation0..2, theta, phi.
const light = o => [o.type, ...o.diffuse, ...(o.specular || [1, 1, 1, 1]), ...(o.ambient || [0, 0, 0, 0]),
  ...(o.position || [0, 0, 0]), ...(o.direction || [0, 0, 1]), o.range ?? 10, o.falloff ?? 1,
  ...(o.att || [1, 0, 0]), o.theta ?? 0, o.phi ?? 0];
const DIRECTIONAL = { type: 3, diffuse: [0.6, 0.6, 0.6, 1], ambient: [0.1, 0.1, 0.2, 1], direction: [0.3, -0.2, 1] };
const POINT = { type: 1, diffuse: [0, 0.8, 0.2, 1], position: [0.5, 0.5, -0.5], att: [0.5, 0.5, 0], range: 5 };
const SPOT = { type: 2, diffuse: [0.9, 0.3, 0, 1], position: [0, 0, -1], direction: [0, 0, 1], theta: 0.5, phi: 1.2, range: 10 };

async function render(gps) {
  const s = await openD3d9GpsSession({ gps, size: SIZE });
  try {
    assert.strictEqual(await s.call('IDirect3D9_CreateDevice', '[0,0,1,exports.get_main_hwnd(),0,ctx.d9g.pp,ctx.d9g.out]'), 0);
    await s.evaluate('ctx.d9g.device=exports.guest_read32(ctx.d9g.out)>>>0');
    const { f, u } = mesh();
    await s.evaluate(`(()=>{const p=ctx.d9g;p.mesh=exports.guest_alloc(12*28)>>>0;p.light=exports.guest_alloc(104)>>>0;
      p.mat=exports.guest_alloc(68)>>>0;p.matrix=exports.guest_alloc(64)>>>0;
      const f=${JSON.stringify(f)},u=${JSON.stringify(u)};
      f.forEach((v,i)=>{p.f32(p.mesh+i*28,v);p.u32(p.mesh+i*28+24,[u[i]]);});return true})()`);
    const ok = async (name, args) => assert.strictEqual(await s.call(name, args), 0, name);
    const rs = (state, value) => ok('IDirect3DDevice9_SetRenderState', `[ctx.d9g.device,${state},${value}]`);
    const setLight = async (index, o) => {
      const v = light(o);
      await s.evaluate(`ctx.d9g.u32(ctx.d9g.light,[${v[0]}]);ctx.d9g.f32(ctx.d9g.light+4,${JSON.stringify(v.slice(1))});true`);
      await ok('IDirect3DDevice9_SetLight', `[ctx.d9g.device,${index},ctx.d9g.light]`);
      await ok('IDirect3DDevice9_LightEnable', `[ctx.d9g.device,${index},1]`);
    };
    const world = async a => {
      await s.evaluate(`ctx.d9g.f32(ctx.d9g.matrix,${JSON.stringify(rotZ(a))});true`);
      await ok('IDirect3DDevice9_SetTransform', '[ctx.d9g.device,256,ctx.d9g.matrix]');
    };
    const frames = [];
    const frame = async (fvf, stride) => {
      await ok('IDirect3DDevice9_SetFVF', `[ctx.d9g.device,${fvf}]`);
      await ok('IDirect3DDevice9_Clear', '[ctx.d9g.device,0,0,1,0xff000000,0x3f800000,0]');
      await ok('IDirect3DDevice9_DrawPrimitiveUP', `[ctx.d9g.device,4,4,ctx.d9g.mesh,${stride}]`);
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
    await rs(137, 1);
    await rs(139, 0xff202020);
    await s.evaluate(`ctx.d9g.f32(ctx.d9g.mat,[1,1,1,1, .5,.5,.5,1, 1,1,1,1, .05,0,0,0, 8]);true`);
    await ok('IDirect3DDevice9_SetMaterial', '[ctx.d9g.device,ctx.d9g.mat]');
    await setLight(0, DIRECTIONAL);
    await frame(0x52, 28);                                   // directional
    await setLight(1, POINT); await setLight(2, SPOT); await world(Math.PI / 6);
    await frame(0x52, 28);                                   // + point, spot, rotated
    await frame(0x52, 28);
    await setLight(1, { ...POINT, diffuse: [0.7, 0, 0.7, 1] }); await world(Math.PI / 3);
    await frame(0x52, 28);                                   // same shape, new values
    await rs(29, 1);
    await frame(0x52, 28);                                   // SPECULARENABLE (ABI3)
    await setLight(2, { ...SPOT, falloff: 0.5 });
    await frame(0x52, 28);                                   // spot falloff class
    await rs(29, 0);
    for (const i of [0, 1, 2]) await ok('IDirect3DDevice9_LightEnable', `[ctx.d9g.device,${i},0]`);
    await rs(147, 1);                                        // AMBIENTMATERIALSOURCE = COLOR1
    await frame(0x52, 28);                                   // no lights: vertex ambient + emissive
    await setLight(0, DIRECTIONAL);
    await frame(0x42, 28);                                   // no NORMAL (stride keeps the normal bytes unread)
    const st = await s.stats();
    st.canonDecline = (await s.evaluate('exports.d3d_shader_ir_canon_decline_op()>>>0')).toString(16);
    await s.call('IDirect3DDevice9_Release', '[ctx.d9g.device]');
    assert.strictEqual(await s.close(), 0, s.output());
    return { frames, st };
  } catch (error) { console.error(s.output().slice(-4000)); await s.close(); throw error; }
}

(async () => {
  // The old JS D3D9 path was deleted (d3d9-retire S4): `old` is its output for
  // this exact sequence, recorded at 3eea041c5 (test/fixtures/d3d9-old-oracle).
  const old = require('./fixtures/d3d9-old-oracle/lit.json');
  const ring = await render('software');
  assert.strictEqual(ring.st.declines, 0, `no declines ${JSON.stringify(ring.st)}`);
  assert(ring.st.draws >= 8, `lit draws on the ring ${JSON.stringify(ring.st)}`);
  const lines = [];
  for (let i = 0; i < old.frames.length; i++) {
    const a = old.frames[i], b = ring.frames[i];
    const diff = a.findIndex((v, k) => v !== b[k]);
    assert.strictEqual(diff, -1, `frame ${i} pixel ${diff}: old ${(a[diff] >>> 0).toString(16)} ring ${(b[diff] >>> 0).toString(16)}`);
    assert(new Set(a).size > 4, `frame ${i} is not flat`);
    lines.push(`frame ${i}: ${new Set(a).size} colours, centre ${(a[8 * SIZE + 8] >>> 0).toString(16)}`);
  }
  console.log(`PASS lit fixed function on the ring matches the old path\n  ${lines.join('\n  ')}\n  ring ${JSON.stringify(ring.st)}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
