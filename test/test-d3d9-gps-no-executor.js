#!/usr/bin/env node
'use strict';
// D3D9 runs only on the ring (d3d9-retire S4), so the executor decides
// whether a device exists:
//  1. No executor (--d3d9-gps=none, and the CLI default without
//     --headless-gl or an app's d3d9WithoutGpu): the ring's open kick is
//     answered 0, the arm turns itself off (dead) and CreateDevice fails with
//     D3DERR_NOTAVAILABLE -- the answer games take their own no-3D path on.
//     Nothing renders some other way.
//  2. The null executor: CreateDevice and a whole frame succeed on the ring
//     (a GPU frame with nothing drawn anywhere).
const assert = require('assert');
const { openD3d9GpsSession, triangleXyzrhw, BLUE } = require('./helpers/d3d9-gps-session');

const create = '[0,0,1,exports.get_main_hwnd(),0,ctx.d9g.pp,ctx.d9g.out]';
const D3DERR_NOTAVAILABLE = 0x8876086a;

(async () => {
  const lines = [];
  for (const gps of ['none', null]) {
    const s = await openD3d9GpsSession({ gps });
    try {
      assert.strictEqual(await s.call('IDirect3D9_CreateDevice', create), D3DERR_NOTAVAILABLE, `${gps}: CreateDevice`);
      const st = await s.stats();
      assert.strictEqual(st.opens, 1, `${gps}: the ring was tried ${JSON.stringify(st)}`);
      assert.strictEqual(st.dead, 1, `${gps}: no executor -> arm off`);
      assert.strictEqual(st.gpuFrames + st.draws + st.presents, 0, JSON.stringify(st));
      assert.strictEqual(await s.evaluate('exports.d3d9_gps_active()'), 0);
      // A second CreateDevice does not reopen the ring.
      assert.strictEqual(await s.call('IDirect3D9_CreateDevice', create), D3DERR_NOTAVAILABLE);
      assert.strictEqual((await s.stats()).opens, 1, `${gps}: one open`);
      assert.strictEqual(await s.close(), 0, s.output());
      lines.push(`${gps || 'default'}: NOTAVAILABLE`);
    } catch (error) { await s.close(); throw error; }
  }
  const s = await openD3d9GpsSession({ gps: 'null' });
  try {
    assert.strictEqual(await s.call('IDirect3D9_CreateDevice', create), 0, 'null executor: CreateDevice');
    await s.evaluate('ctx.d9g.device=exports.guest_read32(ctx.d9g.out)>>>0');
    await s.evaluate(triangleXyzrhw());
    for (const [name, args] of [
      ['IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,137,0]'],
      ['IDirect3DDevice9_SetFVF', '[ctx.d9g.device,0x44]'],
      ['IDirect3DDevice9_Clear', `[ctx.d9g.device,0,0,1,${BLUE},0x3f800000,0]`],
      ['IDirect3DDevice9_DrawPrimitiveUP', '[ctx.d9g.device,4,1,ctx.d9g.vertices,20]'],
      ['IDirect3DDevice9_Present', '[ctx.d9g.device,0,0,0,0]'],
    ]) assert.strictEqual(await s.call(name, args), 0, name);
    const st = await s.stats();
    assert.strictEqual(st.dead, 0, 'the null executor drains the ring');
    assert.strictEqual(st.gpuFrames, 1, JSON.stringify(st));
    assert.strictEqual(st.declines, 0, JSON.stringify(st));
    await s.call('IDirect3DDevice9_Release', '[ctx.d9g.device]');
    assert.strictEqual(await s.close(), 0, s.output());
    lines.push(`null: frame ${JSON.stringify(st)}`);
    console.log('PASS no executor -> D3DERR_NOTAVAILABLE; null executor runs the frame\n  ' + lines.join('\n  '));
  } catch (error) { await s.close(); throw error; }
})().catch(error => { console.error(error); process.exitCode = 1; });
