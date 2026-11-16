#!/usr/bin/env node
'use strict';
// Slice 9.5a: the ring never decides whether a device exists.
//  1. No D3D9 GPU (no --d3d9-renderer, no --headless-gl): CreateDevice and
//     a frame return the same HRESULTs with and without --d3d9-gps, and no
//     frame reaches the executor.
//  2. A D3D9 renderer but no ring executor (--d3d9-gps=none, the kick
//     answers 0): CreateDevice succeeds, the arm turns itself off (dead),
//     and the frame is drawn and presented by the old path, correctly.
const assert = require('assert');
const { openD3d9GpsSession, triangleXyzrhw, RED, BLUE } = require('./helpers/d3d9-gps-session');

const create = '[0,0,1,exports.get_main_hwnd(),0,ctx.d9g.pp,ctx.d9g.out]';

(async () => {
  // Every HRESULT of CreateDevice + a frame is the same with and without the
  // arm when the D3D9 renderer has no GPU; the ring is only ever fed after
  // the old path reported success.
  const hr = {};
  let armStats = null;
  for (const gps of [null, 'software']) {
    const s = await openD3d9GpsSession({ gps, renderer: null });
    try {
      const seq = [await s.call('IDirect3D9_CreateDevice', create)];
      if (seq[0] === 0) {
        await s.evaluate('ctx.d9g.device=exports.guest_read32(ctx.d9g.out)>>>0');
        await s.evaluate(triangleXyzrhw());
        for (const [name, args] of [
          ['IDirect3DDevice9_SetFVF', '[ctx.d9g.device,0x44]'],
          ['IDirect3DDevice9_Clear', `[ctx.d9g.device,0,0,1,${BLUE},0x3f800000,0]`],
          ['IDirect3DDevice9_DrawPrimitiveUP', '[ctx.d9g.device,4,1,ctx.d9g.vertices,20]'],
          ['IDirect3DDevice9_Present', '[ctx.d9g.device,0,0,0,0]'],
        ]) seq.push(await s.call(name, args));
      }
      hr[gps || 'off'] = seq.map(n => (n >>> 0).toString(16)).join(',');
      if (gps) armStats = await s.stats();
      assert.strictEqual(await s.close(), 0, s.output());
    } catch (error) { await s.close(); throw error; }
  }
  assert.strictEqual(hr.software, hr.off, `same HRESULTs with the arm on (${hr.off} vs ${hr.software})`);
  assert.strictEqual(armStats.gpuFrames, 0, `no GPU frame without a D3D9 GPU ${JSON.stringify(armStats)}`);

  const s = await openD3d9GpsSession({ gps: 'none' });
  try {
    assert.strictEqual(await s.call('IDirect3D9_CreateDevice', create), 0, 'CreateDevice with no ring executor');
    await s.evaluate('ctx.d9g.device=exports.guest_read32(ctx.d9g.out)>>>0');
    await s.evaluate(triangleXyzrhw());
    for (const [name, args] of [
      ['IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,137,0]'],
      ['IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,22,1]'],
      ['IDirect3DDevice9_SetFVF', '[ctx.d9g.device,0x44]'],
      ['IDirect3DDevice9_Clear', `[ctx.d9g.device,0,0,1,${BLUE},0x3f800000,0]`],
      ['IDirect3DDevice9_DrawPrimitiveUP', '[ctx.d9g.device,4,1,ctx.d9g.vertices,20]'],
      ['IDirect3DDevice9_Present', '[ctx.d9g.device,0,0,0,0]'],
      ['IDirect3DDevice9_GetBackBuffer', '[ctx.d9g.device,0,0,0,ctx.d9g.surface]'],
    ]) assert.strictEqual(await s.call(name, args), 0, name);
    const st = await s.stats();
    assert.strictEqual(st.opens, 1);
    assert.strictEqual(st.dead, 1, 'no executor: arm off');
    assert.strictEqual(st.gpuFrames + st.draws + st.presents, 0, JSON.stringify(st));
    assert.strictEqual(await s.evaluate('exports.d3d9_gps_active()'), 0);
    assert.strictEqual(await s.evaluate('ctx.d9g.ops[0x30002]|0'), 1, 'old path presented');
    await s.evaluate('ctx.d9g.bb=exports.guest_read32(ctx.d9g.surface)>>>0');
    assert.strictEqual(await s.call('IDirect3DSurface9_LockRect', '[ctx.d9g.bb,ctx.d9g.lr,0,16]'), 0);
    const px = await s.evaluate(`(()=>{const p=ctx.d9g,pitch=exports.guest_read32(p.lr)|0,
      wa=exports.guest_to_wasm(exports.guest_read32(p.lr+4)>>>0),v=new DataView(memory.buffer);
      const at=(x,y)=>v.getUint32(wa+y*pitch+x*4,true)>>>0;return {tl:at(1,1),br:at(7,7)}})()`);
    assert.strictEqual(px.tl >>> 0, RED);
    assert.strictEqual(px.br >>> 0, BLUE);
    await s.call('IDirect3DSurface9_UnlockRect', '[ctx.d9g.bb]');
    await s.call('IDirect3DSurface9_Release', '[ctx.d9g.bb]');
    await s.call('IDirect3DDevice9_Release', '[ctx.d9g.device]');
    assert.strictEqual(await s.close(), 0, s.output());
    console.log(`PASS no-GPU HRESULTs unchanged (${hr.off}; arm ${JSON.stringify(armStats)}); no executor -> arm off, old path frame correct`);
  } catch (error) { await s.close(); throw error; }
})().catch(error => { console.error(error); process.exitCode = 1; });
