#!/usr/bin/env node
'use strict';
// User clip planes on the ring (src/09akg-d3d9-gps.wat d9cl block, GPS
// CLIP op 15, GPS_CAP_CLIP_PLANES): D3DRS_CLIPPLANEENABLE + SetClipPlane
// lower instead of declining 27. Fixed T&L planes are world space and go
// through inverse(View * Projection) (a translated view and a scaled
// projection here, so a transposed or uninverted matrix lands elsewhere);
// a guest vs_1_1's planes are clip space and pass through; POSITIONT draws
// ignore the planes. Planes 4 and 5 are used too: the WebGL executor carries
// them in a different varying from 0..3. The expected images are analytic
// (one pixel of slack at each clip edge for the rasterizers' centre rules).
// Runs the software executor and, when --webgl is given (needs a display
// for headless GL), the WebGL one too.
const assert = require('assert');
const { openD3d9GpsSession, RED, BLUE } = require('./helpers/d3d9-gps-session');

const SIZE = 16;
// XYZ | DIFFUSE, a full-screen strip (world x, y in -1..1).
const QUAD = `ctx.d9g.f32(ctx.d9g.vertices,[-1,1,.5,0, 1,1,.5,0, -1,-1,.5,0, 1,-1,.5,0]);
  for(let i=0;i<4;i++)ctx.d9g.u32(ctx.d9g.vertices+i*16+12,[${RED}]);true`;
// XYZRHW | DIFFUSE, the whole target.
const QUADT = `ctx.d9g.f32(ctx.d9g.vertices+64,[0,0,.5,1,0, ${SIZE},0,.5,1,0, 0,${SIZE},.5,1,0, ${SIZE},${SIZE},.5,1,0]);
  for(let i=0;i<4;i++)ctx.d9g.u32(ctx.d9g.vertices+64+i*20+16,[${RED}]);true`;
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const VIEW = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0.25, 0, 0, 1];   // x + 0.25
const PROJ = [2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];      // x * 2

// Pixel (x, y) centre in D3D clip space.
const clipX = x => (x + 0.5) * 2 / SIZE - 1, clipY = y => 1 - (y + 0.5) * 2 / SIZE;
const EXPECT = {
  // world x >= 0 under clip x = 2(x + 0.25): clip x >= 0.5.
  fixedX: (x, y) => clipX(x) >= 0.5,
  // planes 4 (world x >= 0) and 5 (world y >= 0).
  fixed45: (x, y) => clipX(x) >= 0.5 && clipY(y) >= 0,
  // clip-space (-1, 0, 0, 0): x <= 0.
  vsX: (x, y) => clipX(x) <= 0,
  // vs plane 1 (0, -1, 0, 0.5): y <= 0.5 and plane 3 (1, 0, 0, 0.25): x >= -0.25.
  vs13: (x, y) => clipY(y) <= 0.5 && clipX(x) >= -0.25,
  all: () => true,
};

async function render(gps, extra) {
  const s = await openD3d9GpsSession({ gps, size: SIZE, extra });
  try {
    const ok = async (name, args) => assert.strictEqual(await s.call(name, args), 0, name);
    const stat = i => s.evaluate(`exports.d3d9_gps_stat(${i})>>>0`);
    assert.strictEqual(await s.call('IDirect3D9_CreateDevice', '[0,0,1,exports.get_main_hwnd(),0,ctx.d9g.pp,ctx.d9g.out]'), 0);
    await s.evaluate('ctx.d9g.device=exports.guest_read32(ctx.d9g.out)>>>0;ctx.d9g.m=exports.guest_alloc(64)>>>0;true');
    await s.evaluate(QUAD);
    await s.evaluate(QUADT);
    const rs = (state, value) => ok('IDirect3DDevice9_SetRenderState', `[ctx.d9g.device,${state},${value}]`);
    const transform = async (type, m) => {
      await s.evaluate(`ctx.d9g.f32(ctx.d9g.m,${JSON.stringify(m)});true`);
      await ok('IDirect3DDevice9_SetTransform', `[ctx.d9g.device,${type},ctx.d9g.m]`);
    };
    const plane = async (i, p) => {
      await s.evaluate(`ctx.d9g.f32(ctx.d9g.m,${JSON.stringify(p)});true`);
      await ok('IDirect3DDevice9_SetClipPlane', `[ctx.d9g.device,${i},ctx.d9g.m]`);
    };
    // The back buffer's bits (locked before any lowering: no readback).
    // Frames are then read with d3d9_gps_sync_front, executor pixels only,
    // which (unlike a LockRect) leaves the ring leading.
    await ok('IDirect3DDevice9_GetBackBuffer', '[ctx.d9g.device,0,0,0,ctx.d9g.surface]');
    await s.evaluate('ctx.d9g.bb=exports.guest_read32(ctx.d9g.surface)>>>0');
    await ok('IDirect3DSurface9_LockRect', '[ctx.d9g.bb,ctx.d9g.lr,0,0]');
    await s.evaluate('ctx.d9g.pitch=exports.guest_read32(ctx.d9g.lr)|0;ctx.d9g.bits=exports.guest_read32(ctx.d9g.lr+4)>>>0');
    await ok('IDirect3DSurface9_UnlockRect', '[ctx.d9g.bb]');
    const frames = {};
    const frame = async (name, draw) => {
      await ok('IDirect3DDevice9_Clear', `[ctx.d9g.device,0,0,1,${BLUE},0x3f800000,0]`);
      await ok(...draw);
      await ok('IDirect3DDevice9_Present', '[ctx.d9g.device,0,0,0,0]');
      frames[name] = await s.evaluate(`(()=>{const p=ctx.d9g,wa=exports.guest_to_wasm(p.bits);
        new Uint8Array(memory.buffer,wa,p.pitch*${SIZE}).fill(0);exports.d3d9_gps_sync_front();
        const v=new DataView(memory.buffer),out=[];
        for(let y=0;y<${SIZE};y++)for(let x=0;x<${SIZE};x++)out.push(v.getUint32(wa+y*p.pitch+x*4,true)>>>0);return out})()`);
    };
    const fixed = ['IDirect3DDevice9_DrawPrimitiveUP', '[ctx.d9g.device,5,2,ctx.d9g.vertices,16]'];
    await rs(137, 0);  // LIGHTING off
    await rs(22, 1);   // CULL none
    // Two plain frames: the ring leads from then on, so the old path (which
    // refuses world-space planes) never sees the clipped draws.
    await ok('IDirect3DDevice9_SetFVF', '[ctx.d9g.device,0x44]');
    const quadT = ['IDirect3DDevice9_DrawPrimitiveUP', '[ctx.d9g.device,5,2,ctx.d9g.vertices+64,20]'];
    await frame('warm0', quadT);
    await frame('warm1', quadT);
    assert(await stat(81) >= 1, 'the ring leads');
    await ok('IDirect3DDevice9_SetFVF', '[ctx.d9g.device,0x42]');
    await transform(2, VIEW);
    await transform(3, PROJ);
    await plane(0, [1, 0, 0, 0]);
    await plane(4, [1, 0, 0, 0]);
    await plane(5, [0, 1, 0, 0]);
    await rs(152, 1);
    await frame('fixedX', fixed);
    await rs(152, 0x30);
    await frame('fixed45', fixed);
    // POSITIONT ignores the planes (mask 0x30 still enabled).
    await ok('IDirect3DDevice9_SetFVF', '[ctx.d9g.device,0x44]');
    const clips0 = await stat(75);
    await frame('positionT', quadT);
    assert.strictEqual(await stat(75), clips0, 'a POSITIONT draw sends no CLIP');
    // Guest vs_1_1: dcl_position v0, dcl_color v1, mov oPos v0, mov oD0 v1.
    await s.evaluate(`ctx.d9g.vs=exports.guest_alloc(64)>>>0;ctx.d9g.u32(ctx.d9g.vs,[0xfffe0101,
      0x1f,0x80000000,0x900f0000, 0x1f,0x8000000a,0x900f0001,
      0x1,0xc00f0000,0x90e40000, 0x1,0xd00f0000,0x90e40001, 0xffff]);true`);
    await ok('IDirect3DDevice9_CreateVertexShader', '[ctx.d9g.device,ctx.d9g.vs,ctx.d9g.out]');
    await s.evaluate('ctx.d9g.shader=exports.guest_read32(ctx.d9g.out)>>>0;true');
    await ok('IDirect3DDevice9_SetFVF', '[ctx.d9g.device,0x42]');
    await ok('IDirect3DDevice9_SetVertexShader', '[ctx.d9g.device,ctx.d9g.shader]');
    await plane(2, [-1, 0, 0, 0]);
    await rs(152, 4);
    await frame('vsX', fixed);
    await plane(1, [0, -1, 0, 0.5]);
    await plane(3, [1, 0, 0, 0.25]);
    await rs(152, 0xa);
    await frame('vs13', fixed);
    await rs(152, 0);
    await frame('vsNone', fixed);
    await ok('IDirect3DDevice9_SetVertexShader', '[ctx.d9g.device,0]');
    await frame('fixedNone', fixed);
    const st = await s.stats();
    assert.strictEqual(await stat(80), 0, 'never handed back to the old path');
    await s.call('IDirect3DSurface9_Release', '[ctx.d9g.bb]');
    const clips = await stat(75);
    await s.call('IDirect3DDevice9_Release', '[ctx.d9g.device]');
    assert.strictEqual(await s.close(), 0, s.output());
    return { frames, st, clips };
  } catch (error) { console.error(s.output().slice(-4000)); await s.close(); throw error; }
}

function check(label, got, expect) {
  let bad = 0;
  const rows = [];
  for (let y = 0; y < SIZE; y++) {
    let row = '';
    for (let x = 0; x < SIZE; x++) {
      const v = got[y * SIZE + x] >>> 0;
      row += v === RED ? 'R' : v === BLUE ? '.' : '?';
      // One pixel of slack at an edge: a neighbour that expects the other colour.
      const near = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => {
        const nx = x + dx, ny = y + dy;
        return nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && expect(nx, ny) !== expect(x, y);
      });
      if (!near && v !== (expect(x, y) ? RED : BLUE)) bad++;
    }
    rows.push(row);
  }
  assert.strictEqual(bad, 0, `${label}: ${bad} pixels off\n${rows.join('\n')}`);
  return rows;
}

(async () => {
  const runs = [['software', []]];
  if (process.argv.includes('--webgl')) runs.push(['webgl', ['--headless-gl']]);
  const out = [];
  for (const [gps, extra] of runs) {
    const r = await render(gps, extra);
    assert.strictEqual(r.st.declines, 0, `${gps}: no declines ${JSON.stringify(r.st)}`);
    assert(r.st.gpuFrames >= 9, `${gps}: every frame on the ring ${JSON.stringify(r.st)}`);
    // fixedX, fixed45, vsX, vs13, vsNone (mask 0 after a nonzero one); the
    // last fixed frame has mask 0 too and sends nothing new.
    assert.strictEqual(r.clips, 5, `${gps}: CLIP records ${r.clips}`);
    const expect = { fixedX: EXPECT.fixedX, fixed45: EXPECT.fixed45, positionT: EXPECT.all, vsX: EXPECT.vsX,
      vs13: EXPECT.vs13, vsNone: EXPECT.all, fixedNone: EXPECT.all };
    for (const name of Object.keys(expect)) {
      const rows = check(`${gps} ${name}`, r.frames[name], expect[name]);
      out.push(`${gps} ${name}: ${rows[0]} / ${rows[SIZE - 1]}`);
    }
  }
  console.log(`PASS user clip planes on the ring\n  ${out.join('\n  ')}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
