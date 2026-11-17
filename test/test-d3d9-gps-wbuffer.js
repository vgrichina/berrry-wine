#!/usr/bin/env node
'use strict';
// Decline reason 17 (src/09akg-d3d9-gps.wat, d9wb block): D3DZB_USEW
// lowers as RASTER depth_mode 3 -- depth = w / Wfar per pixel, w = 1 /
// interpolated rhw, Wfar = (m44 - m43) / (m33 - m34) * m34 + m44 of the
// PROJECTION transform (10 here: a zn 1, zf 10 perspective). Every frame is
// checked pixel for pixel against the picture W-buffering defines, worked
// out below on the CPU at both pixel-centre conventions (x and x + 0.5):
//   P  POSITIONT: a far quad (w 6) behind the cleared depth 0.5 (w 5) is
//      hidden; a constant-w quad (w 4.4522) and a quad whose rhw falls
//      across the target (w 2 .. 8, its z 0.99 -- a Z buffer would hide it)
//      cross where 1 / rhw does, at x = 11.75, not where z would;
//   F  fixed T&L: a quad at camera z 6 is hidden, one at z 4 shows (a Z
//      buffer would hide both: z 0.83 / 0.93 > 0.5), a tilted quad (z 2 ..
//      9.5) covers it left of x = 8.75;
//   V  the same scene through a guest vs_1_1 (m4x4 oPos) == F;
//   Z  F with D3DZB_TRUE (all black: everything is behind the clear), so
//      the W frames are not what the Z path draws anyway.
// A DEPTHBIAS under W-buffering still declines 17, which traps (fail fast).
const assert = require('assert');
const { openD3d9GpsSession } = require('./helpers/d3d9-gps-session');

const SIZE = 16;
const BLACK = 0xff000000, RED = 0xffff0000, GREEN = 0xff00ff00, BLUE = 0xff0000ff, YELLOW = 0xffffff00;
const WFAR = 10;
// Row-major D3D perspective: zn 1, zf 10, 90 degrees.
const PROJ = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 10 / 9, 1, 0, 0, -10 / 9, 0];
const IDENT = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// Two triangles over corners [tl, tr, br, bl], each corner [..fields].
const quad = c => [c[0], c[1], c[2], c[0], c[2], c[3]];
// POSITIONT corners [x, y, z, rhw].
const tquad = (rhwL, rhwR, z) => quad([[0, 0, z, rhwL], [16, 0, z, rhwR], [16, 16, z, rhwR], [0, 16, z, rhwL]]);
const RHW_L = 0.5, RHW_R = 0.125, RHW_G = 0.224609375; // rhw of the red quad at x = 11.75
// Camera-space corners [x, y, z] (view and world identity).
const flat = (h, z) => quad([[-h, h, z], [h, h, z], [h, -h, z], [-h, -h, z]]);
const XL = -4, ZL = 2, ZR = 9.5, XR = (0.375 + 4) * (ZR - 2) / 2 - 4; // crosses z 4 at x 0.375 (screen 8.75)
const tilted = () => quad([[XL, 40, ZL], [XR, 40, ZR], [XR, -40, ZR], [XL, -40, ZL]]);

// The pictures W-buffering defines, sampled at x and x + 0.5 of every
// column: both must agree, so the pixel-centre convention is moot.
function expected() {
  const pick = (sample) => {
    const cols = [];
    for (let i = 0; i < SIZE; i++) {
      const v = [i, i + 0.5].map(sample);
      if (!v.every(c => c === v[0])) throw new Error(`expected picture ambiguous at column ${i}`);
      cols.push(v[0]);
    }
    const out = [];
    for (let y = 0; y < SIZE; y++) out.push(...cols);
    return out;
  };
  const P = pick(x => {
    const rhw = RHW_L + (RHW_R - RHW_L) * x / 16;
    return 1 / rhw <= 1 / RHW_G ? RED : GREEN;
  });
  const F = pick(x => {
    // Screen x -> NDC, then where the tilted quad's line X/Z = ndc lies.
    const ndc = 2 * x / 16 - 1, t = (ndc * ZL - XL) / ((XR - XL) - ndc * (ZR - ZL));
    return ZL + (ZR - ZL) * t <= 4 ? GREEN : BLUE;
  });
  return { P, F, Z: new Array(SIZE * SIZE).fill(BLACK) };
}

async function render(gps, extra = []) {
  const s = await openD3d9GpsSession({ gps, size: SIZE, extra });
  try {
    // A D16 auto depth-stencil surface.
    await s.evaluate('exports.guest_write32(ctx.d9g.pp+36,1);exports.guest_write32(ctx.d9g.pp+40,80);true');
    assert.strictEqual(await s.call('IDirect3D9_CreateDevice', '[0,0,1,exports.get_main_hwnd(),0,ctx.d9g.pp,ctx.d9g.out]'), 0);
    await s.evaluate('ctx.d9g.device=exports.guest_read32(ctx.d9g.out)>>>0');
    const ok = async (name, args) => assert.strictEqual(await s.call(name, args), 0, name);
    await s.evaluate('(()=>{const p=ctx.d9g;p.vb=exports.guest_alloc(6*20)>>>0;p.matrix=exports.guest_alloc(64)>>>0;p.vsb=exports.guest_alloc(64)>>>0;return true})()');
    const rs = (state, value) => ok('IDirect3DDevice9_SetRenderState', `[ctx.d9g.device,${state},${value}]`);
    const transform = async (type, m) => {
      await s.evaluate(`ctx.d9g.f32(ctx.d9g.matrix,${JSON.stringify(m)});true`);
      await ok('IDirect3DDevice9_SetTransform', `[ctx.d9g.device,${type},ctx.d9g.matrix]`);
    };
    const frames = {};
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
    // One quad: corners with floats + a DIFFUSE after them.
    const draw = async (verts, color) => {
      const n = verts[0].length, stride = n * 4 + 4;
      await s.evaluate(`(()=>{const p=ctx.d9g;${JSON.stringify(verts)}.forEach((v,i)=>{p.f32(p.vb+i*${stride},v);p.u32(p.vb+i*${stride}+${n * 4},[${color}]);});return true})()`);
      await ok('IDirect3DDevice9_DrawPrimitiveUP', `[ctx.d9g.device,4,2,ctx.d9g.vb,${stride}]`);
    };
    const clear = () => ok('IDirect3DDevice9_Clear', `[ctx.d9g.device,0,0,3,${BLACK},0x3f000000,0]`);
    await rs(22, 1);
    await rs(137, 0);
    await transform(256, IDENT); await transform(2, IDENT); await transform(3, PROJ);
    await rs(7, 2);
    // P: POSITIONT.
    await ok('IDirect3DDevice9_SetFVF', '[ctx.d9g.device,0x44]');
    await clear();
    await draw(tquad(1 / 6, 1 / 6, 0.05), BLUE);
    await draw(tquad(RHW_G, RHW_G, 0.95), GREEN);
    await draw(tquad(RHW_L, RHW_R, 0.99), RED);
    await grab('P');
    // F / Z: fixed T&L; V: guest VS.
    const scene = async (name) => {
      await ok('IDirect3DDevice9_SetFVF', '[ctx.d9g.device,0x42]');
      await clear();
      await draw(flat(10, 6), YELLOW);
      await draw(flat(6, 4), BLUE);
      await draw(tilted(), GREEN);
      await grab(name);
    };
    await scene('F');
    // vs_1_1: dcl_position v0, dcl_color v1, m4x4 oPos, v0, c0, mov oD0, v1.
    await s.evaluate(`ctx.d9g.u32(ctx.d9g.vsb,[0xfffe0101, 0x1f,0x80000000,0x900f0000, 0x1f,0x8000000a,0x900f0001,
      0x14,0xc00f0000,0x90e40000,0xa0e40000, 0x1,0xd00f0000,0x90e40001, 0xffff]);
      ctx.d9g.f32(ctx.d9g.matrix,${JSON.stringify([0, 1, 2, 3].flatMap(c => [0, 1, 2, 3].map(r => PROJ[r * 4 + c])))});true`);
    await ok('IDirect3DDevice9_CreateVertexShader', '[ctx.d9g.device,ctx.d9g.vsb,ctx.d9g.out]');
    await s.evaluate('ctx.d9g.shader=exports.guest_read32(ctx.d9g.out)>>>0;true');
    await ok('IDirect3DDevice9_SetVertexShader', '[ctx.d9g.device,ctx.d9g.shader]');
    await ok('IDirect3DDevice9_SetVertexShaderConstantF', '[ctx.d9g.device,0,ctx.d9g.matrix,4]');
    await scene('V');
    await ok('IDirect3DDevice9_SetVertexShader', '[ctx.d9g.device,0]');
    await rs(7, 1);
    await scene('Z');
    const st = await s.stats();
    // A depth bias under W-buffering: still 17, a trap.
    await rs(7, 2);
    await rs(195, 0x3a83126f); // 0.001f
    await ok('IDirect3DDevice9_SetFVF', '[ctx.d9g.device,0x42]');
    await clear();
    let biasTrapped = false;
    try { await draw(flat(6, 4), BLUE); } catch (_) { biasTrapped = true; }
    const code = await s.close();
    biasTrapped = biasTrapped && code !== 0 && /unreachable/i.test(s.output());
    return { frames, st, biasTrapped };
  } catch (error) {
    const out = s.output();
    if (process.env.D9WB_LOG) require('fs').writeFileSync(process.env.D9WB_LOG, out);
    console.error(out.split('\n').filter(l => !l.startsWith('[ctl]') && !/^\[\d+\] EIP/.test(l)).join('\n').slice(-4000));
    await s.close(); throw error;
  }
}

(async () => {
  const want = expected();
  const bad = [], lines = [];
  const hex = n => (n >>> 0).toString(16);
  const same = (a, b, label) => {
    const k = a.findIndex((v, i) => v !== b[i]);
    if (k >= 0) bad.push(`${label}: pixel ${k} ${hex(a[k])} vs ${hex(b[k])}`);
    lines.push(`${label}: ${k < 0 ? 'same' : 'DIFFERS'}, ${new Set(a).size} colours`);
  };
  const check = (r, name) => {
    if (r.st.declines) bad.push(`${name} declines ${JSON.stringify(r.st)}`);
    if (r.st.gpuFrames !== 4) bad.push(`${name} gpu frames ${JSON.stringify(r.st)}`);
    same(r.frames.P, want.P, `${name} P (POSITIONT, rhw across x) vs W picture`);
    same(r.frames.F, want.F, `${name} F (fixed T&L) vs W picture`);
    same(r.frames.V, want.F, `${name} V (guest VS) vs W picture`);
    same(r.frames.Z, want.Z, `${name} Z (D3DZB_TRUE) vs Z picture`);
    if (!r.biasTrapped) bad.push(`${name} DEPTHBIAS under W did not trap`);
  };
  check(await render('software'), 'software');
  // --webgl (needs a display): the same pictures on the WebGL executor.
  if (process.argv.includes('--webgl')) check(await render('webgl', ['--headless-gl']), 'webgl');
  assert.deepStrictEqual(bad, [], `\n  ${bad.join('\n  ')}\n  ${lines.join('\n  ')}`);
  console.log(`PASS W-buffer (D3DZB_USEW) on the ring\n  ${lines.join('\n  ')}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
