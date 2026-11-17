#!/usr/bin/env node
'use strict';
// Fail fast (d3d9-retire S4): the ring is the only D3D9 renderer, so a draw
// it cannot express is not handed to another path. An untransformed XYZ draw
// with lighting off lowers as fixed T&L (09aj cascade VS) and is a GPU frame;
// a D3DBLEND_BLENDFACTOR draw (no executor blend constant) is a counted
// decline (reason 14) and traps the guest ($d9g_decline -> $d9g_fail
// 0x100 + 14): nothing is drawn some other way and nothing is skipped.
const assert = require('assert');
const { openD3d9GpsSession, triangleXyz, RED, BLUE } = require('./helpers/d3d9-gps-session');

(async () => {
  const s = await openD3d9GpsSession();
  try {
    assert.strictEqual(await s.call('IDirect3D9_CreateDevice', '[0,0,1,exports.get_main_hwnd(),0,ctx.d9g.pp,ctx.d9g.out]'), 0);
    await s.evaluate('ctx.d9g.device=exports.guest_read32(ctx.d9g.out)>>>0');
    const run = async list => { for (const [name, args] of list) assert.strictEqual(await s.call(name, args), 0, name); };
    await run([
      ['IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,137,0]'],
      ['IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,22,1]'],
    ]);
    assert.strictEqual(await s.call('IDirect3DDevice9_GetBackBuffer', '[ctx.d9g.device,0,0,0,ctx.d9g.surface]'), 0);
    await s.evaluate('ctx.d9g.bb=exports.guest_read32(ctx.d9g.surface)>>>0');
    // Frame 0: XYZ | DIFFUSE through the identity transforms, lighting off:
    // fixed T&L on the executor, read back by LockRect (site 0).
    await s.evaluate(triangleXyz());
    await run([
      ['IDirect3DDevice9_SetFVF', '[ctx.d9g.device,0x42]'],
      ['IDirect3DDevice9_Clear', `[ctx.d9g.device,0,0,1,${BLUE},0x3f800000,0]`],
      ['IDirect3DDevice9_DrawPrimitiveUP', '[ctx.d9g.device,4,1,ctx.d9g.vertices,16]'],
      ['IDirect3DDevice9_Present', '[ctx.d9g.device,0,0,0,0]'],
    ]);
    const st = await s.stats();
    assert.strictEqual(st.declines, 0, `fixed T&L lowered ${JSON.stringify(st)}`);
    assert.strictEqual(st.gpuFrames, 1);
    assert.strictEqual(await s.call('IDirect3DSurface9_LockRect', '[ctx.d9g.bb,ctx.d9g.lr,0,1<<4]'), 0, 'LockRect');
    const px = await s.evaluate(`(()=>{const p=ctx.d9g,pitch=exports.guest_read32(p.lr)|0,
      wa=exports.guest_to_wasm(exports.guest_read32(p.lr+4)>>>0),v=new DataView(memory.buffer);
      const at=(x,y)=>v.getUint32(wa+y*pitch+x*4,true)>>>0;return {tl:at(1,1),br:at(7,7)}})()`);
    assert.strictEqual(await s.call('IDirect3DSurface9_UnlockRect', '[ctx.d9g.bb]'), 0, 'UnlockRect');
    assert.strictEqual(px.tl >>> 0, RED, `frame 0 executor pixel ${px.tl.toString(16)}`);
    assert.strictEqual(px.br >>> 0, BLUE);
    assert.strictEqual((await s.stats()).sites[0], 1, 'LockRect readback counted at site 0');
    // Frame 1: the same draw blended by BLENDFACTOR -> decline 14, a trap.
    await run([
      ['IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,27,1]'],
      ['IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,19,14]'],
      ['IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,20,1]'],
      ['IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,193,0xffffffff]'],
      ['IDirect3DDevice9_Clear', `[ctx.d9g.device,0,0,1,${BLUE},0x3f800000,0]`],
    ]);
    let trapped = null;
    try {
      const hr = await s.call('IDirect3DDevice9_DrawPrimitiveUP', '[ctx.d9g.device,4,1,ctx.d9g.vertices,16]');
      trapped = `returned ${hr.toString(16)}`;
    } catch (error) { trapped = error; }
    assert(trapped instanceof Error, `the declined draw must trap, it ${trapped}`);
    const code = await s.close();
    assert.notStrictEqual(code, 0, 'the run ends on the trap');
    assert(/unreachable/i.test(s.output()), `a wasm trap, not a silent skip\n${s.output().slice(-2000)}`);
    console.log(`PASS fixed T&L frame on the ring; a BLENDFACTOR decline traps (exit ${code}): ${JSON.stringify(st)}`);
  } catch (error) {
    await s.close();
    throw error;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
