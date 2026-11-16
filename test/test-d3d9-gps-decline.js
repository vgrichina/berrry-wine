#!/usr/bin/env node
'use strict';
// Slice 9.5a/9.5b: an untransformed XYZ draw with lighting off lowers as
// fixed T&L (09aj cascade VS) and is a GPU frame with the old path's
// pixels. A draw the ring cannot express yet (lighting on: DLT1 is not
// lowered) is a counted decline (reason 28) and the frame stays on the old
// path, which presents it (0x30002) with the right pixels. The executor target is stale until a
// full Clear: the next frame clears, draws POSITIONT, and is a GPU frame.
const assert = require('assert');
const { openD3d9GpsSession, triangleXyzrhw, triangleXyz, RED, BLUE } = require('./helpers/d3d9-gps-session');

(async () => {
  const s = await openD3d9GpsSession();
  try {
    assert.strictEqual(await s.call('IDirect3D9_CreateDevice', '[0,0,1,exports.get_main_hwnd(),0,ctx.d9g.pp,ctx.d9g.out]'), 0);
    await s.evaluate('ctx.d9g.device=exports.guest_read32(ctx.d9g.out)>>>0');
    const run = async list => { for (const [name, args] of list) assert.strictEqual(await s.call(name, args), 0, name); };
    const ops = () => s.evaluate('ctx.d9g.ops[0x30002]|0');
    await run([
      ['IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,137,0]'],
      ['IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,22,1]'],
    ]);
    assert.strictEqual(await s.call('IDirect3DDevice9_GetBackBuffer', '[ctx.d9g.device,0,0,0,ctx.d9g.surface]'), 0);
    await s.evaluate('ctx.d9g.bb=exports.guest_read32(ctx.d9g.surface)>>>0');
    const lockRead = async () => {
      assert.strictEqual(await s.call('IDirect3DSurface9_LockRect', '[ctx.d9g.bb,ctx.d9g.lr,0,1<<4]'), 0, 'LockRect');
      const px = await s.evaluate(`(()=>{const p=ctx.d9g,pitch=exports.guest_read32(p.lr)|0,
        wa=exports.guest_to_wasm(exports.guest_read32(p.lr+4)>>>0),v=new DataView(memory.buffer);
        const at=(x,y)=>v.getUint32(wa+y*pitch+x*4,true)>>>0;return {tl:at(1,1),br:at(7,7)}})()`);
      assert.strictEqual(await s.call('IDirect3DSurface9_UnlockRect', '[ctx.d9g.bb]'), 0, 'UnlockRect');
      return px;
    };
    // Frame 0: XYZ | DIFFUSE through the identity transforms, lighting off:
    // fixed T&L on the executor (a GPU frame), read back by LockRect.
    await s.evaluate(triangleXyz());
    await run([
      ['IDirect3DDevice9_SetFVF', '[ctx.d9g.device,0x42]'],
      ['IDirect3DDevice9_Clear', `[ctx.d9g.device,0,0,1,${BLUE},0x3f800000,0]`],
      ['IDirect3DDevice9_DrawPrimitiveUP', '[ctx.d9g.device,4,1,ctx.d9g.vertices,16]'],
      ['IDirect3DDevice9_Present', '[ctx.d9g.device,0,0,0,0]'],
    ]);
    let st = await s.stats();
    assert.strictEqual(st.declines, 0, `fixed T&L lowered ${JSON.stringify(st)}`);
    assert.strictEqual(st.gpuFrames, 1);
    assert.strictEqual(await ops(), 0, 'frame 0 not presented by the old path');
    let px = await lockRead();
    assert.strictEqual(px.tl >>> 0, RED, `frame 0 executor pixel ${px.tl.toString(16)}`);
    assert.strictEqual(px.br >>> 0, BLUE);
    // Frame 1: the same draw lit -> decline 28, the old path presents it.
    await run([
      ['IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,137,1]'],
      ['IDirect3DDevice9_Clear', `[ctx.d9g.device,0,0,1,${BLUE},0x3f800000,0]`],
      ['IDirect3DDevice9_DrawPrimitiveUP', '[ctx.d9g.device,4,1,ctx.d9g.vertices,16]'],
      ['IDirect3DDevice9_Present', '[ctx.d9g.device,0,0,0,0]'],
      ['IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,137,0]'],
    ]);
    st = await s.stats();
    assert.deepStrictEqual(st.reasons, { 28: 1 }, `one decline, reason 28 ${JSON.stringify(st)}`);
    assert.strictEqual(st.declines, 1);
    assert.strictEqual(st.oldFrames, 1);
    assert.strictEqual(st.gpuFrames, 1);
    assert.deepStrictEqual(st.oldPresent, { 1: 1 }, 'old present because the frame declined');
    assert.strictEqual(await ops(), 1, 'the old path presented frame 1');
    const sites0 = st.sites[0] | 0;
    px = await lockRead();
    // Lit with the default (zero) material and no lights: black.
    assert.strictEqual(px.tl >>> 0, 0xff000000, `frame 1 old-path pixel ${px.tl.toString(16)}`);
    assert.strictEqual(px.br >>> 0, BLUE);
    st = await s.stats();
    assert.strictEqual(st.sites[0] | 0, sites0, 'a stale executor is never read back');
    // Frame 2: a POSITIONT draw without a Clear is refused (stale, 13).
    await s.evaluate(triangleXyzrhw());
    await run([
      ['IDirect3DDevice9_SetFVF', '[ctx.d9g.device,0x44]'],
      ['IDirect3DDevice9_DrawPrimitiveUP', '[ctx.d9g.device,4,1,ctx.d9g.vertices,20]'],
      ['IDirect3DDevice9_Present', '[ctx.d9g.device,0,0,0,0]'],
    ]);
    st = await s.stats();
    assert.strictEqual(st.reasons[13], 1, `stale target refused ${JSON.stringify(st.reasons)}`);
    assert.strictEqual(await ops(), 2);
    // Frame 3: full Clear makes the target coherent; GPU frame again.
    await run([
      ['IDirect3DDevice9_Clear', `[ctx.d9g.device,0,0,1,${BLUE},0x3f800000,0]`],
      ['IDirect3DDevice9_DrawPrimitiveUP', '[ctx.d9g.device,4,1,ctx.d9g.vertices,20]'],
      ['IDirect3DDevice9_Present', '[ctx.d9g.device,0,0,0,0]'],
    ]);
    st = await s.stats();
    assert.strictEqual(st.gpuFrames, 2, `frame 3 on the executor ${JSON.stringify(st)}`);
    assert.strictEqual(await ops(), 2, 'frame 3 not presented by the old path');
    px = await lockRead();
    assert.strictEqual(px.tl >>> 0, RED);
    assert.strictEqual(px.br >>> 0, BLUE);
    assert.strictEqual((await s.stats()).sites[0], sites0 + 1, 'LockRect readback counted at site 0');
    await s.call('IDirect3DSurface9_Release', '[ctx.d9g.bb]');
    await s.call('IDirect3DDevice9_Release', '[ctx.d9g.device]');
    assert.strictEqual(await s.close(), 0, s.output());
    console.log(`PASS decline -> old path frame, stale until a full Clear, then GPU: ${JSON.stringify(st)}`);
  } catch (error) {
    await s.close();
    throw error;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
