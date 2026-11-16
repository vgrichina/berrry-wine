#!/usr/bin/env node
'use strict';
// Slice 9.5a: a fixed-function D3D9 frame (full Clear + POSITIONT
// DrawPrimitiveUP + Present) lowers onto GPU stream v2 and is PRESENTed from
// the executor: the old present (0x30002, the software RT -> DIB copy) is not
// issued, and the executor's own pixels (read back into a zeroed DIB by
// d3d9_gps_sync_front) are the D3D9 answer.
const assert = require('assert');
const { openD3d9GpsSession, triangleXyzrhw, RED, BLUE } = require('./helpers/d3d9-gps-session');

(async () => {
  const s = await openD3d9GpsSession();
  try {
    assert.strictEqual(await s.call('IDirect3D9_CreateDevice', '[0,0,1,exports.get_main_hwnd(),0,ctx.d9g.pp,ctx.d9g.out]'), 0, 'CreateDevice');
    await s.evaluate('ctx.d9g.device=exports.guest_read32(ctx.d9g.out)>>>0');
    // Learn the back buffer's bits (lock before any lowering: no readback).
    assert.strictEqual(await s.call('IDirect3DDevice9_GetBackBuffer', '[ctx.d9g.device,0,0,0,ctx.d9g.surface]'), 0);
    await s.evaluate('ctx.d9g.bb=exports.guest_read32(ctx.d9g.surface)>>>0');
    assert.strictEqual(await s.call('IDirect3DSurface9_LockRect', '[ctx.d9g.bb,ctx.d9g.lr,0,0]'), 0, 'LockRect');
    await s.evaluate('ctx.d9g.pitch=exports.guest_read32(ctx.d9g.lr)|0;ctx.d9g.bits=exports.guest_read32(ctx.d9g.lr+4)>>>0');
    assert.strictEqual(await s.call('IDirect3DSurface9_UnlockRect', '[ctx.d9g.bb]'), 0, 'UnlockRect');
    await s.evaluate(triangleXyzrhw());
    for (const [name, args] of [
      ['IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,137,0]'],
      ['IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,22,1]'],
      ['IDirect3DDevice9_SetFVF', '[ctx.d9g.device,0x44]'],
      ['IDirect3DDevice9_Clear', `[ctx.d9g.device,0,0,1,${BLUE},0x3f800000,0]`],
      ['IDirect3DDevice9_DrawPrimitiveUP', '[ctx.d9g.device,4,1,ctx.d9g.vertices,20]'],
      ['IDirect3DDevice9_Present', '[ctx.d9g.device,0,0,0,0]'],
    ]) assert.strictEqual(await s.call(name, args), 0, name);
    const st = await s.stats();
    assert.strictEqual(st.dead, 0, 'an executor exists');
    assert.strictEqual(st.gpuFrames, 1, `one GPU frame ${JSON.stringify(st)}`);
    assert.strictEqual(st.oldFrames, 0);
    assert.strictEqual(st.draws, 1);
    assert.strictEqual(st.clears, 1);
    assert.strictEqual(st.presents, 1);
    assert.strictEqual(st.declines, 0, JSON.stringify(st.reasons));
    assert(st.shaders >= 1, 'fixed PS lowered through 09aj + canonicalizer');
    assert.strictEqual(await s.evaluate('ctx.d9g.ops[0x30002]|0'), 0, 'old present skipped');
    // Executor pixels only: zero the DIB, read the ring back into it.
    const px = await s.evaluate(`(()=>{const p=ctx.d9g,wa=exports.guest_to_wasm(p.bits);
      new Uint8Array(memory.buffer,wa,p.pitch*8).fill(0);exports.d3d9_gps_sync_front();
      const v=new DataView(memory.buffer),at=(x,y)=>v.getUint32(wa+y*p.pitch+x*4,true)>>>0;
      return {tl:at(1,1),br:at(7,7),edge:at(3,3)}})()`);
    assert.strictEqual(px.tl >>> 0, RED, `inside the triangle ${px.tl.toString(16)}`);
    assert.strictEqual(px.br >>> 0, BLUE, `cleared outside ${px.br.toString(16)}`);
    assert.strictEqual((await s.stats()).sites[3], 1, 'capture readback counted at site 3');
    await s.call('IDirect3DSurface9_Release', '[ctx.d9g.bb]');
    await s.call('IDirect3DDevice9_Release', '[ctx.d9g.device]');
    const code = await s.close();
    assert.strictEqual(code, 0, s.output());
    console.log(`PASS fixed-function frame on the v2 executor: ${JSON.stringify(st)}`);
  } catch (error) {
    await s.close();
    throw error;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
