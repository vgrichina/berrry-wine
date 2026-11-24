#!/usr/bin/env node
'use strict';
// IDirect3DDevice9/8::Present(pSourceRect, pDestRect) on a windowed device
// (src/09akg-d3d9-gps.wat $d9g_present). Windows clips the source rect to
// the back buffer, takes a NULL destination as the whole client area of the
// device window, and stretches when the two sizes differ. GameMaker 8
// (Spelunky Classic) keeps a 640x480 back buffer and, once its settings
// scale the window to 960x720, presents (0,0,960,720) -> (0,0,960,720):
// without the stretch the game filled only the top-left of its window.
//   1. NULL source, 16x16 destination: the 8x8 picture doubled (COPY into
//      the present target, stat 88), red triangle / blue clear in place.
//   2. 4x4 source onto a 4x4 destination: no COPY, the sub-rect as it is.
//   3. NULL / NULL: the frame is the window's client size.
// Run with --webgl to repeat on the headless-GL executor (layer size and
// stats only: its frame is a GL surface).
const assert = require('assert');
const { openD3d9GpsSession, triangleXyzrhw, BLUE } = require('./helpers/d3d9-gps-session');

async function run(gps, extra) {
  const s = await openD3d9GpsSession({ gps, size: 8, extra });
  try {
    const ok = async (name, args) => assert.strictEqual(await s.call(name, args), 0, name);
    await ok('IDirect3D9_CreateDevice', '[0,0,1,exports.get_main_hwnd(),0,ctx.d9g.pp,ctx.d9g.out]');
    await s.evaluate('ctx.d9g.device=exports.guest_read32(ctx.d9g.out)>>>0;ctx.d9g.r2=exports.guest_alloc(16)>>>0;true');
    await s.evaluate(triangleXyzrhw());
    await ok('IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,137,0]');
    await ok('IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,22,1]');
    await ok('IDirect3DDevice9_SetFVF', '[ctx.d9g.device,0x44]');
    await ok('IDirect3DDevice9_Clear', `[ctx.d9g.device,0,0,1,${BLUE},0x3f800000,0]`);
    await ok('IDirect3DDevice9_DrawPrimitiveUP', '[ctx.d9g.device,4,1,ctx.d9g.vertices,20]');
    // The presented layer of the device window: size, and RGBA at points.
    const layer = pts => s.evaluate(`(()=>{const w=renderer.windows[exports.get_main_hwnd()];
      const l=w&&w._gpuFrameLayer;if(!l||!l.canvas)return null;const c=l.canvas,o={w:c.width,h:c.height,px:[]};
      const g=${gps === 'software'}&&c.getContext&&c.getContext('2d');
      if(g)for(const [x,y] of ${JSON.stringify(pts)}){const d=g.getImageData(x,y,1,1).data;o.px.push([d[0],d[1],d[2],d[3]]);}
      return o})()`);
    const stretched = () => s.evaluate('exports.d3d9_gps_stat(88)>>>0');
    const RED_RGBA = [255, 0, 0, 255], BLUE_RGBA = [0, 0, 255, 255];
    const lines = [];

    // 1: NULL source onto (0,0,16,16).
    await s.evaluate('ctx.d9g.u32(ctx.d9g.rect,[0,0,16,16]);true');
    await ok('IDirect3DDevice9_Present', '[ctx.d9g.device,0,ctx.d9g.rect,0,0]');
    let l = await layer([[2, 2], [14, 14], [10, 10]]);
    assert(l, `${gps}: a frame reached the window`);
    assert.deepStrictEqual([l.w, l.h], [16, 16], `${gps}: 8x8 stretched to 16x16`);
    assert.strictEqual(await stretched(), 1, `${gps}: one stretched present`);
    if (l.px.length) {
      assert.deepStrictEqual(l.px[0], RED_RGBA, `${gps}: (2,2) inside the triangle`);
      assert.deepStrictEqual(l.px[1], BLUE_RGBA, `${gps}: (14,14) cleared`);
      assert.deepStrictEqual(l.px[2], BLUE_RGBA, `${gps}: (10,10) past the diagonal`);
    }
    lines.push(`${gps} 16x16 ${JSON.stringify(l)}`);

    // 2: a 4x4 source onto a 4x4 destination needs no stretch.
    await s.evaluate('ctx.d9g.u32(ctx.d9g.rect,[0,0,4,4]);ctx.d9g.u32(ctx.d9g.r2,[0,0,4,4]);true');
    await ok('IDirect3DDevice9_Present', '[ctx.d9g.device,ctx.d9g.rect,ctx.d9g.r2,0,0]');
    l = await layer([[1, 1]]);
    // (WebGL's frame surface is its drawable, which a partial present does
    // not resize: only the software layer is the frame's own size.)
    if (gps === 'software') assert.deepStrictEqual([l.w, l.h], [4, 4], `${gps}: the 4x4 sub-rect`);
    assert.strictEqual(await stretched(), 1, `${gps}: same-size present is not stretched`);
    if (l.px.length) assert.deepStrictEqual(l.px[0], RED_RGBA, `${gps}: sub-rect pixel`);

    // 3: NULL / NULL fills the client area.
    // calc's main window is still unsized while the test owns its thread:
    // give it a 40x30 client area in the WAT window manager.
    const client = await s.evaluate(`(()=>{const h=exports.get_main_hwnd();
      exports.test_gdi_client_rect_set(h,0,0,40,30);const p=exports.get_client_rect_wh(h)>>>0;
      return [p&0xffff,p>>>16]})()`);
    assert.deepStrictEqual(client, [40, 30], 'client area set');
    assert(client[0] > 8 && client[1] > 8, `client area ${client}`);
    await ok('IDirect3DDevice9_Present', '[ctx.d9g.device,0,0,0,0]');
    l = await layer([]);
    assert.deepStrictEqual([l.w, l.h], client, `${gps}: NULL destination is the client area`);
    assert.strictEqual(await stretched(), 2, `${gps}: stretched onto the client area`);
    lines.push(`${gps} client ${client.join('x')}`);

    // 4: the same COPY lowering through StretchRect(LINEAR) into a lockable
    // 16x16 RT, read back: the executors must agree pixel for pixel (WebGL
    // draws the stretch on the GPU, software in JS).
    await ok('IDirect3DDevice9_GetBackBuffer', '[ctx.d9g.device,0,0,0,ctx.d9g.out]');
    await s.evaluate('ctx.d9g.bb=exports.guest_read32(ctx.d9g.out)>>>0;true');
    await ok('IDirect3DDevice9_CreateRenderTarget', '[ctx.d9g.device,16,16,22,0,0,1,ctx.d9g.out,0]');
    await s.evaluate('ctx.d9g.big=exports.guest_read32(ctx.d9g.out)>>>0;true');
    await ok('IDirect3DDevice9_StretchRect', '[ctx.d9g.device,ctx.d9g.bb,0,ctx.d9g.big,0,2]');
    await ok('IDirect3DSurface9_LockRect', '[ctx.d9g.big,ctx.d9g.lr,0,1<<4]');
    const big = await s.evaluate(`(()=>{const p=ctx.d9g,pitch=exports.guest_read32(p.lr)|0,
      wa=exports.guest_to_wasm(exports.guest_read32(p.lr+4)>>>0),v=new DataView(memory.buffer),o=[];
      for(let y=0;y<16;y++)for(let x=0;x<16;x++)o.push(v.getUint32(wa+y*pitch+x*4,true)&0xffffff);return o})()`);
    await ok('IDirect3DSurface9_UnlockRect', '[ctx.d9g.big]');
    assert.strictEqual(big[2 * 16 + 2], 0xff0000, `${gps}: stretched RT (2,2) red`);
    assert.strictEqual(big[14 * 16 + 14], 0x0000ff, `${gps}: stretched RT (14,14) blue`);
    assert(new Set(big).size > 2, `${gps}: linear filtering blends the diagonal`);
    await s.call('IDirect3DSurface9_Release', '[ctx.d9g.big]');
    await s.call('IDirect3DSurface9_Release', '[ctx.d9g.bb]');

    const st = await s.stats();
    assert.strictEqual(st.declines, 0, JSON.stringify(st.reasons));
    assert.strictEqual(st.presents, 3, JSON.stringify(st));
    await s.call('IDirect3DDevice9_Release', '[ctx.d9g.device]');
    assert.strictEqual(await s.close(), 0, s.output());
    return { lines, big };
  } catch (error) { console.error(s.output().slice(-4000)); await s.close(); throw error; }
}

(async () => {
  const runs = [['software', []]];
  if (process.argv.includes('--webgl')) runs.push(['webgl', ['--headless-gl']]);
  const lines = [], bigs = [];
  for (const [gps, extra] of runs) {
    const r = await run(gps, extra);
    lines.push(...r.lines);
    bigs.push(r.big);
  }
  if (bigs.length > 1) {
    // Linear weights round in different places (GL fixed point vs JS
    // float): allow one step per channel.
    const off = bigs[1].findIndex((v, k) => [0, 8, 16].some(sh =>
      Math.abs(((v >>> sh) & 255) - ((bigs[0][k] >>> sh) & 255)) > 1));
    assert.strictEqual(off, -1, `webgl StretchRect pixel ${off}: ${(bigs[1][off] >>> 0).toString(16)} vs software ${(bigs[0][off] >>> 0).toString(16)}`);
    lines.push('webgl StretchRect(LINEAR) matches software');
  }
  console.log(`PASS windowed Present stretches source rect onto destination\n  ${lines.join('\n  ')}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
