#!/usr/bin/env node
'use strict';
// Decline reason 16 (src/09akg-d3d9-gps.wat, d9fv block): D3DSHADE_FLAT
// under a guest vertex shader or fixed-function lighting runs the VS on the
// CPU in the shader VM and draws POSITIONT lists with the provoking
// vertex's colours. Every flat frame must equal a Gouraud reference drawn
// on the executor's own vertex path with the provoking colour (or, lit, the
// provoking normal) in all three vertices:
//   V  guest vs_1_1, a list (one triangle at w 2, one at w 4);
//   S  a strip (triangle i takes vertex i's colour);
//   F  a fan (triangle i takes vertex i + 1's colour, as D3D defines it);
//   L  fixed T&L lighting, N.L = 1, 0.75, 0.25 per vertex;
//   C  a triangle wholly in front of the near plane is dropped (stat 125).
// V also differs from its Gouraud picture, so the flat path is not moot.
// Still 16: vertex fog (stat 121) and a triangle that needs clipping (124);
// each traps (fail fast), so each gets its own session.
const assert = require('assert');
const { openD3d9GpsSession } = require('./helpers/d3d9-gps-session');

const SIZE = 16;
const BLACK = 0xff000000, R = 0xffff0000, G = 0xff00ff00, B = 0xff0000ff, Y = 0xffffff00, C = 0xff00ffff, M = 0xffff00ff;
const PROJ = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 10 / 9, 1, 0, 0, -10 / 9, 0]; // zn 1, zf 10
const IDENT = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
// Screen (sx, sy) at camera depth z: x = (sx / 8 - 1) z, y = (1 - sy / 8) z.
const at = (sx, sy, z) => [(sx / 8 - 1) * z, (1 - sy / 8) * z, z];
const TRI_A = [at(0, 0, 2), at(16, 0, 2), at(0, 16, 2)];
const TRI_B = [at(16, 0, 4), at(16, 16, 4), at(0, 16, 4)];
const QUAD = [at(0, 0, 2), at(16, 0, 2), at(0, 16, 2), at(16, 16, 2)];
const FAN = [at(0, 0, 2), at(16, 0, 2), at(16, 16, 2), at(0, 16, 2)];

async function render(gps, extra = [], last = 'fog') {
  const s = await openD3d9GpsSession({ gps, size: SIZE, extra });
  try {
    assert.strictEqual(await s.call('IDirect3D9_CreateDevice', '[0,0,1,exports.get_main_hwnd(),0,ctx.d9g.pp,ctx.d9g.out]'), 0);
    await s.evaluate('ctx.d9g.device=exports.guest_read32(ctx.d9g.out)>>>0');
    const ok = async (name, args) => assert.strictEqual(await s.call(name, args), 0, name);
    await s.evaluate(`(()=>{const p=ctx.d9g;p.vb=exports.guest_alloc(16*32)>>>0;p.matrix=exports.guest_alloc(64)>>>0;
      p.vsb=exports.guest_alloc(64)>>>0;p.mat=exports.guest_alloc(68)>>>0;p.light=exports.guest_alloc(104)>>>0;return true})()`);
    const rs = (state, value) => ok('IDirect3DDevice9_SetRenderState', `[ctx.d9g.device,${state},${value}]`);
    const stat = i => s.evaluate(`exports.d3d9_gps_stat(${i})>>>0`);
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
    // Vertices: [floats..., colour] (colour last, a u32) or [floats...].
    const draw = async (prim, count, verts) => {
      const n = verts[0].length, stride = n * 4;
      await s.evaluate(`(()=>{const p=ctx.d9g;${JSON.stringify(verts)}.forEach((v,i)=>{
        p.f32(p.vb+i*${stride},v.slice(0,${n - 1}));const l=v[${n - 1}];
        if(${JSON.stringify(typeof verts[0][n - 1] === 'string')})p.u32(p.vb+i*${stride}+${(n - 1) * 4},[Number(l)]);
        else p.f32(p.vb+i*${stride}+${(n - 1) * 4},[l]);});return true})()`);
      await ok('IDirect3DDevice9_DrawPrimitiveUP', `[ctx.d9g.device,${prim},${count},ctx.d9g.vb,${stride}]`);
    };
    const col = (pos, colors) => pos.map((p, i) => [...p, String(colors[i] >>> 0)]);
    const clear = () => ok('IDirect3DDevice9_Clear', `[ctx.d9g.device,0,0,1,${BLACK},0x3f800000,0]`);
    const flat = on => rs(9, on ? 1 : 2);
    await rs(22, 1); await rs(137, 0);
    await transform(256, IDENT); await transform(2, IDENT); await transform(3, PROJ);
    // vs_1_1: dcl_position v0, dcl_color v1, m4x4 oPos, v0, c0, mov oD0, v1.
    await s.evaluate(`ctx.d9g.u32(ctx.d9g.vsb,[0xfffe0101, 0x1f,0x80000000,0x900f0000, 0x1f,0x8000000a,0x900f0001,
      0x14,0xc00f0000,0x90e40000,0xa0e40000, 0x1,0xd00f0000,0x90e40001, 0xffff]);
      ctx.d9g.f32(ctx.d9g.matrix,${JSON.stringify([0, 1, 2, 3].flatMap(c => [0, 1, 2, 3].map(r => PROJ[r * 4 + c])))});true`);
    await ok('IDirect3DDevice9_CreateVertexShader', '[ctx.d9g.device,ctx.d9g.vsb,ctx.d9g.out]');
    await s.evaluate('ctx.d9g.shader=exports.guest_read32(ctx.d9g.out)>>>0;true');
    await ok('IDirect3DDevice9_SetFVF', '[ctx.d9g.device,0x42]');
    await ok('IDirect3DDevice9_SetVertexShader', '[ctx.d9g.device,ctx.d9g.shader]');
    await ok('IDirect3DDevice9_SetVertexShaderConstantF', '[ctx.d9g.device,0,ctx.d9g.matrix,4]');
    const frame = async (name, on, body) => { await flat(on); await clear(); await body(); await grab(name); };
    await frame('V', 1, () => draw(4, 2, [...col(TRI_A, [R, G, B]), ...col(TRI_B, [Y, C, M])]));
    await frame('Vref', 0, () => draw(4, 2, [...col(TRI_A, [R, R, R]), ...col(TRI_B, [Y, Y, Y])]));
    await frame('Vg', 0, () => draw(4, 2, [...col(TRI_A, [R, G, B]), ...col(TRI_B, [Y, C, M])]));
    await frame('S', 1, () => draw(5, 2, col(QUAD, [R, G, B, Y])));
    await frame('Sref', 0, () => draw(4, 2, col([QUAD[0], QUAD[1], QUAD[2], QUAD[1], QUAD[2], QUAD[3]], [R, R, R, G, G, G])));
    await frame('F', 1, () => draw(6, 2, col(FAN, [R, G, B, Y])));
    await frame('Fref', 0, () => draw(4, 2, col([FAN[0], FAN[1], FAN[2], FAN[0], FAN[2], FAN[3]], [G, G, G, B, B, B])));
    const near = TRI_B.map(([x, y]) => [x / 8, y / 8, 0.5]);
    const before = await stat(125);
    await frame('C', 1, () => draw(4, 2, [...col(TRI_A, [R, G, B]), ...col(near, [Y, C, M])]));
    const dropped = (await stat(125)) - before;
    await frame('Cref', 0, () => draw(4, 1, col(TRI_A, [R, R, R])));
    // L: fixed T&L, one directional light along +z, material (1, .6, .2).
    await ok('IDirect3DDevice9_SetVertexShader', '[ctx.d9g.device,0]');
    await ok('IDirect3DDevice9_SetFVF', '[ctx.d9g.device,0x12]');
    await s.evaluate(`(()=>{const p=ctx.d9g;p.f32(p.mat,[1,.6,.2,1, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0]);p.u32(p.light,[3]);
      p.f32(p.light+4,[1,1,1,1, 0,0,0,0, 0,0,0,0, 0,0,0, 0,0,1, 100,0, 1,0,0, 0,0]);return true})()`);
    await rs(137, 1); await rs(139, 0);
    await ok('IDirect3DDevice9_SetMaterial', '[ctx.d9g.device,ctx.d9g.mat]');
    await ok('IDirect3DDevice9_SetLight', '[ctx.d9g.device,0,ctx.d9g.light]');
    await ok('IDirect3DDevice9_LightEnable', '[ctx.d9g.device,0,1]');
    const nrm = (pos, a) => pos.map((p, i) => [...p, 0, 0, -a[i]]);
    await frame('L', 1, () => draw(4, 2, [...nrm(TRI_A, [1, 0.75, 0.25]), ...nrm(TRI_B, [0.25, 1, 0.75])]));
    await frame('Lref', 0, () => draw(4, 2, [...nrm(TRI_A, [1, 1, 1]), ...nrm(TRI_B, [0.25, 0.25, 0.25])]));
    const st = await s.stats();
    const cpu = await stat(120);
    // Still 16: vertex fog, then a triangle crossing the near plane.
    await rs(137, 0);
    await ok('IDirect3DDevice9_SetFVF', '[ctx.d9g.device,0x42]');
    await ok('IDirect3DDevice9_SetVertexShader', '[ctx.d9g.device,ctx.d9g.shader]');
    // A VS that writes oFog (mov oFog, c4.x), which the old path takes.
    await s.evaluate(`ctx.d9g.u32(ctx.d9g.vsb,[0xfffe0101, 0x1f,0x80000000,0x900f0000, 0x1f,0x8000000a,0x900f0001,
      0x14,0xc00f0000,0x90e40000,0xa0e40000, 0x1,0xd00f0000,0x90e40001, 0x1,0xc0010001,0xa0000004, 0xffff]);
      ctx.d9g.f32(ctx.d9g.matrix,[1,1,1,1]);true`);
    await ok('IDirect3DDevice9_CreateVertexShader', '[ctx.d9g.device,ctx.d9g.vsb,ctx.d9g.out]');
    await s.evaluate('ctx.d9g.shader2=exports.guest_read32(ctx.d9g.out)>>>0;true');
    await ok('IDirect3DDevice9_SetVertexShader', '[ctx.d9g.device,ctx.d9g.shader2]');
    await ok('IDirect3DDevice9_SetVertexShaderConstantF', '[ctx.d9g.device,4,ctx.d9g.matrix,1]');
    let trapped = false;
    try {
      if (last === 'fog') {
        await rs(28, 1);
        await frame('D1', 1, () => draw(4, 1, col(TRI_A, [R, G, B])));
      } else {
        await ok('IDirect3DDevice9_SetVertexShader', '[ctx.d9g.device,ctx.d9g.shader]');
        await frame('D2', 1, () => draw(4, 1, col([TRI_A[0], TRI_A[1], near[2]], [R, G, B])));
      }
    } catch (_) { trapped = true; }
    const code = await s.close();
    trapped = trapped && code !== 0 && /unreachable/i.test(s.output());
    return { frames, st, cpu, dropped, trapped };
  } catch (error) {
    const out = s.output();
    if (process.env.D9FV_LOG) require('fs').writeFileSync(process.env.D9FV_LOG, out);
    console.error(out.split('\n').filter(l => !l.startsWith('[ctl]') && !/^\[\d+\] EIP/.test(l)).join('\n').slice(-4000));
    await s.close(); throw error;
  }
}

(async () => {
  const bad = [], lines = [];
  const hex = n => (n >>> 0).toString(16);
  const same = (a, b, label) => {
    const k = a.findIndex((v, i) => v !== b[i]);
    if (k >= 0) bad.push(`${label}: pixel ${k} ${hex(a[k])} vs ${hex(b[k])}`);
    lines.push(`${label}: ${k < 0 ? 'same' : 'DIFFERS'}, ${new Set(a).size} colours`);
  };
  const check = (r, name) => {
    const f = r.frames;
    if (r.st.declines) bad.push(`${name} declines ${JSON.stringify(r.st)}`);
    if (r.st.gpuFrames !== 11) bad.push(`${name} gpu frames ${JSON.stringify(r.st)}`);
    if (r.cpu !== 5) bad.push(`${name} ${r.cpu} draws ran the VS on the CPU, want 5`);
    if (r.dropped < 1) bad.push(`${name} near-plane triangle not dropped`);
    same(f.V, f.Vref, `${name} V (flat, guest VS list) vs Gouraud provoking colours`);
    if (f.V.every((v, i) => v === f.Vg[i])) bad.push(`${name} V equals its Gouraud picture`);
    same(f.S, f.Sref, `${name} S (flat strip) vs reference`);
    same(f.F, f.Fref, `${name} F (flat fan) vs reference`);
    same(f.C, f.Cref, `${name} C (near-plane triangle dropped) vs reference`);
    same(f.L, f.Lref, `${name} L (flat, fixed lighting) vs provoking normals`);
    if (new Set(f.L).size !== 2) bad.push(`${name} L has ${new Set(f.L).size} colours`);
    if (!r.trapped) bad.push(`${name} vertex fog under flat shading did not trap`);
  };
  check(await render('software'), 'software');
  if (!(await render('software', [], 'clip')).trapped) bad.push('software clipped flat triangle did not trap');
  if (process.argv.includes('--webgl')) check(await render('webgl', ['--headless-gl']), 'webgl');
  assert.deepStrictEqual(bad, [], `\n  ${bad.join('\n  ')}\n  ${lines.join('\n  ')}`);
  console.log(`PASS flat shading with a vertex stage on the CPU\n  ${lines.join('\n  ')}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
