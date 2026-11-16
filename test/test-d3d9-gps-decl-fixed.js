#!/usr/bin/env node
'use strict';
// Retirement slice S3 (src/09akg-d3d9-gps.wat $d9g_decl_fvf, decline reason
// 2): fixed-function T&L from a vertex DECLARATION lowers on the ring when
// the declaration is exactly an FVF layout -- it runs as that FVF. The
// same lit mesh is drawn through FVF 0x52 and through an equivalent
// declaration (elements listed out of order), then through one whose
// offsets are not an FVF layout, which still declines (2). Every frame
// must equal the old software path's pixels.
const assert = require('assert');
const { openD3d9GpsSession } = require('./helpers/d3d9-gps-session');

const SIZE = 16;
const NORMALS = [[0, 0, -1], [0.6, 0, -0.8], [0, 0.6, -0.8], [-0.6, 0, -0.8], [0, -0.6, -0.8]];
const COLORS = [0xffffffff, 0xffff8080, 0xff80ff80, 0xff8080ff, 0xffffff00];
const CORNERS = [[-1, 1], [1, 1], [1, -1], [-1, -1]];
function mesh() {
  const f = [], u = [];
  for (let t = 0; t < 4; t++)
    for (const [i, xy] of [[0, [0, 0]], [1 + t, CORNERS[t]], [1 + ((t + 1) % 4), CORNERS[(t + 1) % 4]]]) {
      f.push([...xy, 0.5, ...NORMALS[i]]); u.push(COLORS[i]);
    }
  return { f, u };
}
// D3DVERTEXELEMENT9 {stream, offset, type, method, usage, index} as bytes.
const el = (offset, type, usage, index = 0) => [0, 0, offset & 255, offset >> 8, type, 0, usage, index];
const END = [0xff, 0, 0, 0, 17, 0, 0, 0];
const FVF_DECL = [...el(24, 4, 10), ...el(0, 2, 0), ...el(12, 2, 3), ...END];   // = FVF 0x52, out of order
const ODD_DECL = [...el(0, 2, 0), ...el(16, 2, 3), ...el(12, 4, 10), ...END];   // COLOR before NORMAL

async function render(gps) {
  const s = await openD3d9GpsSession({ gps, size: SIZE });
  try {
    assert.strictEqual(await s.call('IDirect3D9_CreateDevice', '[0,0,1,exports.get_main_hwnd(),0,ctx.d9g.pp,ctx.d9g.out]'), 0);
    await s.evaluate('ctx.d9g.device=exports.guest_read32(ctx.d9g.out)>>>0');
    const { f, u } = mesh();
    await s.evaluate(`(()=>{const p=ctx.d9g;p.mesh=exports.guest_alloc(12*28)>>>0;p.light=exports.guest_alloc(104)>>>0;
      p.mat=exports.guest_alloc(68)>>>0;p.els=exports.guest_alloc(64)>>>0;p.dout=exports.guest_alloc(8)>>>0;
      const f=${JSON.stringify(f)},u=${JSON.stringify(u)};
      f.forEach((v,i)=>{p.f32(p.mesh+i*28,v);p.u32(p.mesh+i*28+24,[u[i]]);});return true})()`);
    const ok = async (name, args) => assert.strictEqual(await s.call(name, args), 0, name);
    const decl = async (bytes, k) => {
      await s.evaluate(`(()=>{const v=new Uint8Array(memory.buffer,exports.guest_to_wasm(ctx.d9g.els),64);v.set(${JSON.stringify(bytes)});return true})()`);
      await ok('IDirect3DDevice9_CreateVertexDeclaration', `[ctx.d9g.device,ctx.d9g.els,ctx.d9g.dout+${4 * k}]`);
      return `exports.guest_read32(ctx.d9g.dout+${4 * k})>>>0`;
    };
    const fvfDecl = await decl(FVF_DECL, 0), oddDecl = await decl(ODD_DECL, 1);
    const frames = [];
    const frame = async bind => {
      await bind();
      await ok('IDirect3DDevice9_Clear', '[ctx.d9g.device,0,0,1,0xff000000,0x3f800000,0]');
      await ok('IDirect3DDevice9_DrawPrimitiveUP', '[ctx.d9g.device,4,4,ctx.d9g.mesh,28]');
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
    await ok('IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,22,1]');
    await ok('IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,137,1]');
    await ok('IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,139,0xff202020]');
    await s.evaluate(`ctx.d9g.f32(ctx.d9g.mat,[1,1,1,1, .5,.5,.5,1, 1,1,1,1, .05,0,0,0, 8]);true`);
    await ok('IDirect3DDevice9_SetMaterial', '[ctx.d9g.device,ctx.d9g.mat]');
    await s.evaluate(`ctx.d9g.u32(ctx.d9g.light,[3]);ctx.d9g.f32(ctx.d9g.light+4,[.6,.6,.6,1, 1,1,1,1, .1,.1,.2,1, 0,0,0, .3,-.2,1, 10,1, 1,0,0, 0,0]);true`);
    await ok('IDirect3DDevice9_SetLight', '[ctx.d9g.device,0,ctx.d9g.light]');
    await ok('IDirect3DDevice9_LightEnable', '[ctx.d9g.device,0,1]');
    await frame(() => ok('IDirect3DDevice9_SetFVF', '[ctx.d9g.device,0x52]'));                  // 0 FVF
    await frame(async () => ok('IDirect3DDevice9_SetVertexDeclaration', `[ctx.d9g.device,${fvfDecl}]`)); // 1 equivalent decl
    const before = await s.stats();
    await frame(async () => ok('IDirect3DDevice9_SetVertexDeclaration', `[ctx.d9g.device,${oddDecl}]`)); // 2 declines
    const st = await s.stats();
    await s.call('IDirect3DDevice9_Release', '[ctx.d9g.device]');
    assert.strictEqual(await s.close(), 0, s.output());
    return { frames, before, st };
  } catch (error) { console.error(s.output().slice(-4000)); await s.close(); throw error; }
}

(async () => {
  const old = await render('off');
  const ring = await render('software');
  assert.strictEqual(ring.before.declines, 0, `FVF-layout declaration lowered ${JSON.stringify(ring.before)}`);
  assert.strictEqual(ring.before.draws, 2, `both draws on the ring ${JSON.stringify(ring.before)}`);
  assert.deepStrictEqual(ring.st.reasons, { 2: 1 }, `a non-FVF declaration declines 2 ${JSON.stringify(ring.st)}`);
  for (let i = 0; i < old.frames.length; i++) {
    const a = old.frames[i], b = ring.frames[i];
    const diff = a.findIndex((v, k) => v !== b[k]);
    assert.strictEqual(diff, -1, `frame ${i} pixel ${diff}: old ${(a[diff] >>> 0).toString(16)} ring ${(b[diff] >>> 0).toString(16)}`);
  }
  assert.deepStrictEqual(old.frames[1], old.frames[0], 'the declaration draws what the FVF draws');
  assert(new Set(old.frames[0]).size > 4, 'frame 0 is not flat');
  console.log(`PASS an FVF-layout declaration runs fixed T&L on the ring\n  ring ${JSON.stringify(ring.st)}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
