#!/usr/bin/env node
'use strict';
// d9rt (src/09akg-d3d9-gps.wat "render targets and surfaces"): colour
// surfaces and depth surfaces are ring RT / DS resources, so drawing into a
// render target (reason 4) and sampling a RENDERTARGET texture (reason 5) no
// longer decline. Every frame's 16x16 back buffer, and every guest read of a
// render target, must equal the old software path's pixel for pixel:
//   - render-to-texture sampled the next draw (one-level 2D: BIND the RT)
//   - a mipmapped RENDERTARGET texture (sampled copy, GPS COPY per level)
//   - an RT with its own depth surface (z test against a second triangle)
//   - cube RENDERTARGET faces (ColorFill / Clear per face, then sampled)
//   - ColorFill of an RT and of the back buffer, whole and partial
//   - LockRect of a lockable RT and GetRenderTargetData of an RT
// and frames that read nothing back must issue no READBACK.
const assert = require('assert');
const { openD3d9GpsSession } = require('./helpers/d3d9-gps-session');

const SIZE = 16;
const RED = 0xffff0000, GREEN = 0xff00ff00, BLUE = 0xff0000ff, GREY = 0xff404040;

async function render(gps, extra = []) {
  const s = await openD3d9GpsSession({ gps, size: SIZE, extra });
  try {
    assert.strictEqual(await s.call('IDirect3D9_CreateDevice', '[0,0,1,exports.get_main_hwnd(),0,ctx.d9g.pp,ctx.d9g.out]'), 0);
    await s.evaluate(`(()=>{const p=ctx.d9g,a=n=>exports.guest_alloc(n)>>>0;p.device=exports.guest_read32(p.out)>>>0;
      p.tri=a(64);p.quad=a(128);p.cubeq=a(256);p.zq=a(128);p.r=a(16);p.r2=a(16);return true})()`);
    const ok = async (name, args) => assert.strictEqual(await s.call(name, args), 0, name);
    const out = async () => s.evaluate('exports.guest_read32(ctx.d9g.out)>>>0');
    const rs = (state, value) => ok('IDirect3DDevice9_SetRenderState', `[ctx.d9g.device,${state},${value}]`);
    const fvf = f => ok('IDirect3DDevice9_SetFVF', `[ctx.d9g.device,${f}]`);
    const clear = (flags, color, z = 0x3f800000) => ok('IDirect3DDevice9_Clear', `[ctx.d9g.device,0,0,${flags},${color},${z},0]`);
    const target = surf => ok('IDirect3DDevice9_SetRenderTarget', `[ctx.d9g.device,0,${surf}]`);
    const depth = surf => ok('IDirect3DDevice9_SetDepthStencilSurface', `[ctx.d9g.device,${surf}]`);
    const tex = t => ok('IDirect3DDevice9_SetTexture', `[ctx.d9g.device,0,${t}]`);
    const fill = async (surf, rect, color) => {
      if (rect) await s.evaluate(`ctx.d9g.u32(ctx.d9g.r,${JSON.stringify(rect)});true`);
      await ok('IDirect3DDevice9_ColorFill', `[ctx.d9g.device,${surf},${rect ? 'ctx.d9g.r' : 0},${color}]`);
    };
    // XYZRHW | DIFFUSE triangle (stride 20) with corners in pixels.
    const tri = async (pts, color, z = 0.5) => {
      await s.evaluate(`(()=>{const p=ctx.d9g,v=${JSON.stringify(pts)};v.forEach(([x,y],i)=>{
        p.f32(p.tri+i*20,[x,y,${z},1]);p.u32(p.tri+i*20+16,[${color}]);});return true})()`);
      await fvf(0x44);
      await ok('IDirect3DDevice9_DrawPrimitiveUP', '[ctx.d9g.device,4,1,ctx.d9g.tri,20]');
    };
    // XYZRHW | TEX1 strip over [x0,x1) x [y0,y1), uv 0..1 (stride 24).
    const quad = async (x0, y0, x1, y1) => {
      await s.evaluate(`ctx.d9g.f32(ctx.d9g.quad,[${x0},${y0},.5,1,0,0, ${x1},${y0},.5,1,1,0, ${x0},${y1},.5,1,0,1, ${x1},${y1},.5,1,1,1]);true`);
      await fvf(0x104);
      await ok('IDirect3DDevice9_DrawPrimitiveUP', '[ctx.d9g.device,5,2,ctx.d9g.quad,24]');
    };
    // XYZRHW | TEX1 | TEXCOORDSIZE3(0): a strip sampling the cube along $dir.
    const cubeQuad = async (x0, y0, x1, y1, dir) => {
      const v = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].flatMap(([x, y]) => [x, y, 0.5, 1, ...dir]);
      await s.evaluate(`ctx.d9g.f32(ctx.d9g.cubeq,${JSON.stringify(v)});true`);
      await fvf(0x10104);
      await ok('IDirect3DDevice9_DrawPrimitiveUP', '[ctx.d9g.device,5,2,ctx.d9g.cubeq,28]');
    };
    const readSurface = async (surf, w, h) => {
      await ok('IDirect3DSurface9_LockRect', `[${surf},ctx.d9g.lr,0,1<<4]`);
      const px = await s.evaluate(`(()=>{const p=ctx.d9g,pitch=exports.guest_read32(p.lr)|0,
        wa=exports.guest_to_wasm(exports.guest_read32(p.lr+4)>>>0),v=new DataView(memory.buffer),o=[];
        for(let y=0;y<${h};y++)for(let x=0;x<${w};x++)o.push(v.getUint32(wa+y*pitch+x*4,true)>>>0);return o})()`);
      await ok('IDirect3DSurface9_UnlockRect', `[${surf}]`);
      return px;
    };
    const frames = [];
    const reads = { n: 0 };
    const present = async (read = true) => {
      await ok('IDirect3DDevice9_Present', '[ctx.d9g.device,0,0,0,0]');
      if (!read) return;
      reads.n++;
      frames.push({ what: `bb ${frames.length}`, px: await readSurface('ctx.d9g.bb', SIZE, SIZE) });
    };

    await ok('IDirect3DDevice9_GetBackBuffer', '[ctx.d9g.device,0,0,0,ctx.d9g.out]');
    await s.evaluate('ctx.d9g.bb=exports.guest_read32(ctx.d9g.out)>>>0');
    // A one-level 8x8 RT texture, an RT texture with 2 levels, a lockable
    // 16x16 RT, a 16x16 D24S8 depth surface, a 4x4 one-level cube RT.
    await ok('IDirect3DDevice9_CreateTexture', '[ctx.d9g.device,8,8,1,1,21,0,ctx.d9g.out,0]');
    await s.evaluate('ctx.d9g.t1=exports.guest_read32(ctx.d9g.out)>>>0');
    await ok('IDirect3DTexture9_GetSurfaceLevel', '[ctx.d9g.t1,0,ctx.d9g.out]');
    await s.evaluate('ctx.d9g.t1s=exports.guest_read32(ctx.d9g.out)>>>0');
    await ok('IDirect3DDevice9_CreateTexture', '[ctx.d9g.device,8,8,2,1,22,0,ctx.d9g.out,0]');
    await s.evaluate('ctx.d9g.t2=exports.guest_read32(ctx.d9g.out)>>>0');
    await ok('IDirect3DTexture9_GetSurfaceLevel', '[ctx.d9g.t2,0,ctx.d9g.out]');
    await s.evaluate('ctx.d9g.t2s0=exports.guest_read32(ctx.d9g.out)>>>0');
    await ok('IDirect3DTexture9_GetSurfaceLevel', '[ctx.d9g.t2,1,ctx.d9g.out]');
    await s.evaluate('ctx.d9g.t2s1=exports.guest_read32(ctx.d9g.out)>>>0');
    await ok('IDirect3DDevice9_CreateRenderTarget', '[ctx.d9g.device,16,16,21,0,0,1,ctx.d9g.out,0]');
    await s.evaluate('ctx.d9g.rt=exports.guest_read32(ctx.d9g.out)>>>0');
    await ok('IDirect3DDevice9_CreateDepthStencilSurface', '[ctx.d9g.device,16,16,75,0,0,0,ctx.d9g.out,0]');
    await s.evaluate('ctx.d9g.ds=exports.guest_read32(ctx.d9g.out)>>>0');
    await ok('IDirect3DDevice9_CreateCubeTexture', '[ctx.d9g.device,4,1,1,21,0,ctx.d9g.out,0]');
    await s.evaluate('ctx.d9g.cube=exports.guest_read32(ctx.d9g.out)>>>0');
    for (const f of [0, 1]) {
      await ok('IDirect3DCubeTexture9_GetCubeMapSurface', `[ctx.d9g.cube,${f},0,ctx.d9g.out]`);
      await s.evaluate(`ctx.d9g.face${f}=exports.guest_read32(ctx.d9g.out)>>>0`);
    }
    await ok('IDirect3DDevice9_CreateOffscreenPlainSurface', '[ctx.d9g.device,16,16,21,2,ctx.d9g.out,0]');
    await s.evaluate('ctx.d9g.sys=exports.guest_read32(ctx.d9g.out)>>>0');
    await rs(137, 0); // LIGHTING off
    await rs(22, 1);  // CULL none

    // 1: render-to-texture, sampled the next draw.
    await target('ctx.d9g.t1s');
    await clear(1, BLUE);
    await tri([[0, 0], [8, 0], [0, 8]], RED);
    await target('ctx.d9g.bb');
    await clear(1, GREY);
    await tex('ctx.d9g.t1');
    await quad(0, 0, 16, 16);
    await tex(0);
    await present();

    // 2: the RT drawn again (new contents), sampled into half the screen.
    await target('ctx.d9g.t1s');
    await tri([[8, 8], [8, 0], [0, 8]], GREEN);
    await target('ctx.d9g.bb');
    await clear(1, GREY);
    await tex('ctx.d9g.t1');
    await quad(0, 0, 16, 8);
    await tex(0);
    await present();

    // 3: a mipmapped RT texture: level 0 drawn, level 1 ColorFilled; sampled
    // level 0 (MIPFILTER none), then level 1 (MIPFILTER point, MAXMIPLEVEL 1).
    await target('ctx.d9g.t2s0');
    await clear(1, RED);
    await tri([[0, 0], [8, 0], [0, 8]], BLUE);
    await target('ctx.d9g.bb');
    await fill('ctx.d9g.t2s1', null, GREEN);
    await clear(1, GREY);
    await tex('ctx.d9g.t2');
    await quad(0, 0, 8, 16);
    await ok('IDirect3DDevice9_SetSamplerState', '[ctx.d9g.device,0,7,1]');
    await ok('IDirect3DDevice9_SetSamplerState', '[ctx.d9g.device,0,9,1]');
    await quad(8, 0, 16, 16);
    await ok('IDirect3DDevice9_SetSamplerState', '[ctx.d9g.device,0,9,0]');
    await ok('IDirect3DDevice9_SetSamplerState', '[ctx.d9g.device,0,7,0]');
    await tex(0);
    await present();

    // 4: an RT with its own depth surface: the far triangle drawn after the
    // near one is hidden, a corner is ColorFilled; the guest then reads the
    // RT by LockRect and by GetRenderTargetData.
    await target('ctx.d9g.rt');
    await depth('ctx.d9g.ds');
    await rs(7, 1); await rs(14, 1);
    await clear(3, GREY);
    await tri([[0, 0], [16, 0], [0, 16]], RED, 0.25);
    await tri([[0.25, 0], [16, 0], [16, 15.75]], BLUE, 0.75); // diagonal off pixel centres
    await fill('ctx.d9g.rt', [12, 12, 16, 16], GREEN);
    reads.n++;
    frames.push({ what: 'rt lock', px: await readSurface('ctx.d9g.rt', 16, 16) });
    await ok('IDirect3DDevice9_GetRenderTargetData', '[ctx.d9g.device,ctx.d9g.rt,ctx.d9g.sys]');
    reads.n++;
    frames.push({ what: 'rt data', px: await readSurface('ctx.d9g.sys', 16, 16) });
    await depth(0);
    await rs(7, 0);
    await target('ctx.d9g.bb');
    await clear(1, GREY);
    await present();

    // 5: cube RT faces: +X ColorFilled, -X cleared; sampled per face.
    await fill('ctx.d9g.face0', null, RED);
    await target('ctx.d9g.face1');
    await clear(1, BLUE);
    await target('ctx.d9g.bb');
    await clear(1, GREY);
    await tex('ctx.d9g.cube');
    for (const k of [1, 2, 3]) await ok('IDirect3DDevice9_SetSamplerState', `[ctx.d9g.device,0,${k},3]`);
    await cubeQuad(0, 0, 8, 16, [1, 0, 0]);
    await cubeQuad(8, 0, 16, 16, [-1, 0, 0]);
    await tex(0);
    await present();

    // 6: ColorFill of the back buffer, whole then partial, plus a draw.
    await fill('ctx.d9g.bb', null, BLUE);
    await fill('ctx.d9g.bb', [4, 4, 12, 12], GREEN);
    await tri([[0, 16], [16, 16], [16, 0]], RED);
    await present();

    // 7: StretchRect: the RT (frame 4's picture) shrunk LINEAR into the
    // top-left quarter, the 8x8 RT texture grown POINT into the right half,
    // then the back buffer copied into the RT and read there.
    const stretch = async (src, sr, dst, dr, filter) => {
      await s.evaluate(`ctx.d9g.u32(ctx.d9g.r,${JSON.stringify(sr || [0, 0, 0, 0])});ctx.d9g.u32(ctx.d9g.r2,${JSON.stringify(dr || [0, 0, 0, 0])});true`);
      await ok('IDirect3DDevice9_StretchRect', `[ctx.d9g.device,${src},${sr ? 'ctx.d9g.r' : 0},${dst},${dr ? 'ctx.d9g.r2' : 0},${filter}]`);
    };
    await clear(1, GREY);
    await stretch('ctx.d9g.rt', null, 'ctx.d9g.bb', [0, 0, 8, 8], 2);
    await stretch('ctx.d9g.t1s', [0, 0, 8, 8], 'ctx.d9g.bb', [8, 0, 16, 16], 1);
    await stretch('ctx.d9g.rt', [0, 0, 16, 16], 'ctx.d9g.bb', [0, 8, 8, 16], 1);
    await present();
    await stretch('ctx.d9g.bb', [0, 0, 16, 16], 'ctx.d9g.rt', [2, 2, 14, 14], 2);
    reads.n++;
    frames.push({ what: 'rt after stretch', px: await readSurface('ctx.d9g.rt', 16, 16) });

    // 8: UpdateSurface: the system-memory copy (frame 4's RT) into the RT
    // texture, sampled.
    await s.evaluate('ctx.d9g.u32(ctx.d9g.r,[4,4,12,12]);ctx.d9g.u32(ctx.d9g.r2,[0,0]);true');
    await ok('IDirect3DDevice9_UpdateSurface', '[ctx.d9g.device,ctx.d9g.sys,ctx.d9g.r,ctx.d9g.t1s,ctx.d9g.r2]');
    await clear(1, GREY);
    await tex('ctx.d9g.t1');
    await quad(0, 0, 16, 16);
    await tex(0);
    await present();

    // 9-11: frames nobody reads: no READBACK.
    const before = await s.stats();
    for (let i = 0; i < 3; i++) {
      await target('ctx.d9g.t1s');
      await clear(1, i & 1 ? RED : GREEN);
      await target('ctx.d9g.bb');
      await clear(1, GREY);
      await tex('ctx.d9g.t1');
      await quad(0, 0, 16, 16);
      await tex(0);
      await present(false);
    }
    const after = await s.stats();
    await present();
    const st = await s.stats();
    st.idleReadbacks = after.readbacks - before.readbacks;
    st.rtBinds = await s.evaluate('exports.d3d9_gps_stat(86)>>>0');
    st.rtCopies = await s.evaluate('exports.d3d9_gps_stat(87)>>>0');
    st.rtPulls = await s.evaluate('exports.d3d9_gps_stat(85)>>>0');
    st.reads = reads.n;
    for (const [k, i] of [['site2', 50], ['site4', 52], ['site5', 53], ['handovers', 80], ['leads', 81], ['lead0', 88]])
      st[k] = await s.evaluate(`exports.d3d9_gps_stat(${i})>>>0`);
    await s.call('IDirect3DDevice9_Release', '[ctx.d9g.device]');
    assert.strictEqual(await s.close(), 0, s.output());
    return { frames, st };
  } catch (error) { console.error(s.output().slice(-4000)); await s.close(); throw error; }
}

(async () => {
  const old = await render('off');
  const runs = [['software', []]];
  if (process.argv.includes('--webgl')) runs.push(['webgl', ['--headless-gl']]);
  const lines = [];
  for (const [gps, extra] of runs) {
    const ring = await render(gps, extra);
    assert.strictEqual(old.frames.length, ring.frames.length);
    for (let i = 0; i < old.frames.length; i++) {
      const a = old.frames[i].px, b = ring.frames[i].px;
      const diff = a.findIndex((v, k) => v !== b[k]);
      assert.strictEqual(diff, -1, `${gps} ${old.frames[i].what} pixel ${diff}: old ${(a[diff] >>> 0).toString(16)} ring ${(b[diff] >>> 0).toString(16)}`);
      lines.push(`${gps} ${old.frames[i].what}: ${new Set(a).size} colours, [0] ${(a[0] >>> 0).toString(16)} [last] ${(a[a.length - 1] >>> 0).toString(16)}`);
    }
    assert(new Set(old.frames[0].px).size >= 2, 'frame 0 shows the RT');
    assert.strictEqual(ring.st.declines, 0, `${gps}: no declines ${JSON.stringify(ring.st)}`);
    assert(!ring.st.reasons[4] && !ring.st.reasons[5], `${gps}: no reason 4/5 ${JSON.stringify(ring.st)}`);
    assert.strictEqual(ring.st.lead0, 1, `${gps}: the ring leads from frame 0 ${JSON.stringify(ring.st)}`);
    assert.strictEqual(ring.st.handovers, 0, `${gps}: no handover to the old path ${JSON.stringify(ring.st)}`);
    assert(ring.st.rtBinds > 0 && ring.st.rtCopies > 0, `${gps}: RT sampling on the ring ${JSON.stringify(ring.st)}`);
    assert.strictEqual(ring.st.idleReadbacks, 0, `${gps}: no READBACK unless the guest reads ${JSON.stringify(ring.st)}`);
    assert(ring.st.readbacks <= ring.st.reads, `${gps}: READBACKs (${ring.st.readbacks}) only for guest reads (${ring.st.reads})`);
    lines.push(`${gps} ${JSON.stringify(ring.st)}`);
  }
  console.log(`PASS D3D9 render targets on the ring match the old path\n  ${lines.join('\n  ')}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
