#!/usr/bin/env node
'use strict';
// Slice 9.5b: D3D9 draws from vertex/index buffers become GPS DRAWs from
// executor VBUF/IBUF copies of the 09ae buffers (no DRAW_UP range copy),
// and the vertex stage is lowered: fixed-function T&L (09aj cascade VS) of
// an untransformed FVF, and a guest vs_1_1 through the core VS IR. Each
// frame is a GPU frame whose executor pixels (LockRect readback) match what
// D3D9 draws: the clip-space triangle in RED over BLUE. A buffer relocked
// between draws is re-sent (its dirty range), an unchanged one is not.
const assert = require('assert');
const { openD3d9GpsSession, triangleXyz, RED, BLUE } = require('./helpers/d3d9-gps-session');

(async () => {
  const s = await openD3d9GpsSession();
  try {
    const run = async list => { for (const [name, args] of list) assert.strictEqual(await s.call(name, args), 0, name); };
    const stat = i => s.evaluate(`exports.d3d9_gps_stat(${i})>>>0`);
    await run([['IDirect3D9_CreateDevice', '[0,0,1,exports.get_main_hwnd(),0,ctx.d9g.pp,ctx.d9g.out]']]);
    await s.evaluate('ctx.d9g.device=exports.guest_read32(ctx.d9g.out)>>>0');
    await run([
      ['IDirect3DDevice9_GetBackBuffer', '[ctx.d9g.device,0,0,0,ctx.d9g.surface]'],
      ['IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,137,0]'],
      ['IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,22,1]'],
      ['IDirect3DDevice9_SetFVF', '[ctx.d9g.device,0x42]'],
    ]);
    await s.evaluate('ctx.d9g.bb=exports.guest_read32(ctx.d9g.surface)>>>0');
    const lockRead = async () => {
      assert.strictEqual(await s.call('IDirect3DSurface9_LockRect', '[ctx.d9g.bb,ctx.d9g.lr,0,1<<4]'), 0, 'LockRect');
      const px = await s.evaluate(`(()=>{const p=ctx.d9g,pitch=exports.guest_read32(p.lr)|0,
        wa=exports.guest_to_wasm(exports.guest_read32(p.lr+4)>>>0),v=new DataView(memory.buffer);
        const at=(x,y)=>v.getUint32(wa+y*pitch+x*4,true)>>>0;return {tl:at(1,1),br:at(7,7)}})()`);
      assert.strictEqual(await s.call('IDirect3DSurface9_UnlockRect', '[ctx.d9g.bb]'), 0, 'UnlockRect');
      return px;
    };
    const frame = async (label, draw) => {
      const before = await s.stats();
      await run([['IDirect3DDevice9_Clear', `[ctx.d9g.device,0,0,1,${BLUE},0x3f800000,0]`], draw,
        ['IDirect3DDevice9_Present', '[ctx.d9g.device,0,0,0,0]']]);
      const st = await s.stats();
      assert.strictEqual(st.declines, 0, `${label}: no decline ${JSON.stringify(st.reasons)}`);
      assert.strictEqual(st.gpuFrames, before.gpuFrames + 1, `${label}: a GPU frame ${JSON.stringify(st)}`);
      const px = await lockRead();
      assert.strictEqual(px.tl >>> 0, RED, `${label}: executor pixel ${px.tl.toString(16)}`);
      assert.strictEqual(px.br >>> 0, BLUE, `${label}: background ${px.br.toString(16)}`);
      return st;
    };
    // Vertex buffer (MANAGED, XYZ | DIFFUSE) filled through Lock.
    await s.evaluate(triangleXyz());
    await run([['IDirect3DDevice9_CreateVertexBuffer', '[ctx.d9g.device,64,0,0x42,1,ctx.d9g.out,0]']]);
    await s.evaluate('ctx.d9g.vb=exports.guest_read32(ctx.d9g.out)>>>0;true');
    const fill = async (buffer, bytes, at = 0) => {
      await run([[ 'IDirect3DBuffer9_Lock', `[ctx.d9g.${buffer},${at},${bytes},ctx.d9g.out,0]`]]);
      await s.evaluate(`(()=>{const e=exports,dst=e.guest_to_wasm(e.guest_read32(ctx.d9g.out)>>>0);
        const src=e.guest_to_wasm(ctx.d9g.vertices+${at});new Uint8Array(memory.buffer).copyWithin(dst,src,src+${bytes});return true})()`);
      await run([['IDirect3DBuffer9_Unlock', `[ctx.d9g.${buffer}]`]]);
    };
    await fill('vb', 48);
    await run([['IDirect3DDevice9_SetStreamSource', '[ctx.d9g.device,0,ctx.d9g.vb,0,16]']]);
    const up0 = await stat(72);
    let st = await frame('fixed T&L DrawPrimitive', ['IDirect3DDevice9_DrawPrimitive', '[ctx.d9g.device,4,0,1]']);
    assert.strictEqual(await stat(74), 1, 'one DRAW from a VBUF');
    assert.strictEqual(st.draws, 0, 'no DRAW_UP');
    assert.strictEqual(await stat(72) - up0, 1, 'the buffer uploaded once');
    // Index buffer: 16-bit [0, 1, 2]; the vertex buffer is unchanged.
    await run([['IDirect3DDevice9_CreateIndexBuffer', '[ctx.d9g.device,16,0,101,1,ctx.d9g.out,0]']]);
    await s.evaluate('ctx.d9g.ib=exports.guest_read32(ctx.d9g.out)>>>0;true');
    await run([['IDirect3DBuffer9_Lock', '[ctx.d9g.ib,0,0,ctx.d9g.out,0]']]);
    await s.evaluate(`(()=>{const e=exports,wa=e.guest_to_wasm(e.guest_read32(ctx.d9g.out)>>>0);
      new Uint16Array(memory.buffer,wa,3).set([0,1,2]);return true})()`);
    await run([['IDirect3DBuffer9_Unlock', '[ctx.d9g.ib]'], ['IDirect3DDevice9_SetIndices', '[ctx.d9g.device,ctx.d9g.ib]']]);
    st = await frame('fixed T&L DrawIndexedPrimitive', ['IDirect3DDevice9_DrawIndexedPrimitive', '[ctx.d9g.device,4,0,0,3,0,1]']);
    assert.strictEqual(await stat(74), 2, 'indexed DRAW from VBUF + IBUF');
    assert.strictEqual(await stat(72) - up0, 2, 'only the new index buffer uploaded');
    assert(await stat(73) >= 1, 'the vertex buffer was a cache hit');
    // Guest vs_1_1: dcl_position v0, dcl_color v1, mov oPos v0, mov oD0 v1.
    await s.evaluate(`ctx.d9g.vs=exports.guest_alloc(64)>>>0;ctx.d9g.u32(ctx.d9g.vs,[0xfffe0101,
      0x1f,0x80000000,0x900f0000, 0x1f,0x8000000a,0x900f0001,
      0x1,0xc00f0000,0x90e40000, 0x1,0xd00f0000,0x90e40001, 0xffff]);true`);
    await run([['IDirect3DDevice9_CreateVertexShader', '[ctx.d9g.device,ctx.d9g.vs,ctx.d9g.out]']]);
    await s.evaluate('ctx.d9g.shader=exports.guest_read32(ctx.d9g.out)>>>0;true');
    await run([['IDirect3DDevice9_SetVertexShader', '[ctx.d9g.device,ctx.d9g.shader]']]);
    // Relock the vertex buffer (same bytes): the dirty range is re-sent.
    await fill('vb', 16, 16);
    st = await frame('guest vs_1_1 DrawIndexedPrimitive', ['IDirect3DDevice9_DrawIndexedPrimitive', '[ctx.d9g.device,4,0,0,3,0,1]']);
    assert.strictEqual(await stat(74), 3);
    assert.strictEqual(await stat(72) - up0, 3, 'the relocked vertex buffer re-sent');
    // DrawPrimitiveUP through the guest VS (arena copy, programmable layout).
    st = await frame('guest vs_1_1 DrawPrimitiveUP', ['IDirect3DDevice9_DrawPrimitiveUP', '[ctx.d9g.device,4,1,ctx.d9g.vertices,16]']);
    assert.strictEqual(st.draws, 1, 'one DRAW_UP');
    assert.strictEqual(st.dead, 0);
    await run([['IDirect3DDevice9_SetVertexShader', '[ctx.d9g.device,0]']]);
    st = await s.stats();
    assert.deepStrictEqual(st.reasons, {}, 'nothing declined');
    for (const name of ['shader', 'ib', 'vb']) await s.call(name === 'shader' ? 'IDirect3DShader9_Release' : 'IDirect3DBuffer9_Release', `[ctx.d9g.${name}]`);
    await s.call('IDirect3DSurface9_Release', '[ctx.d9g.bb]');
    await s.call('IDirect3DDevice9_Release', '[ctx.d9g.device]');
    assert.strictEqual(await s.close(), 0, s.output());
    console.log(`PASS VB/IB DRAWs, fixed T&L and guest VS on the v2 executor: ${JSON.stringify(st)}`);
  } catch (e) {
    console.error(s.output().slice(-4000));
    await s.close();
    throw e;
  }
})().catch(e => { console.error(e); process.exit(1); });
