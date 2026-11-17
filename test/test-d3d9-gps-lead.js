#!/usr/bin/env node
'use strict';
// Retirement slice S1 (src/09akg-d3d9-gps.wat "Lead mode"): after two whole
// frames on the ring the ring leads -- Clear and Draw* no longer call the
// old path (0x30003 / 0x30001) at all. A decline while leading hands the
// executor's picture to the old path first (readback site 4 into the back
// buffer DIB, then one old 0x30015 upload), so the old path finishes the
// frame on top of what the ring drew: a pixel only the ring cleared this
// frame (GREEN) survives into the old-path frame, where without the
// handover the old target would still hold frame 1's BLUE.
const assert = require('assert');
const { openD3d9GpsSession, triangleXyzrhw, RED, BLUE } = require('./helpers/d3d9-gps-session');

const GREEN = 0xff00ff00;

(async () => {
  const s = await openD3d9GpsSession();
  try {
    assert.strictEqual(await s.call('IDirect3D9_CreateDevice', '[0,0,1,exports.get_main_hwnd(),0,ctx.d9g.pp,ctx.d9g.out]'), 0);
    await s.evaluate('ctx.d9g.device=exports.guest_read32(ctx.d9g.out)>>>0');
    const run = async list => { for (const [name, args] of list) assert.strictEqual(await s.call(name, args), 0, name); };
    const ops = op => s.evaluate(`ctx.d9g.ops[${op}]|0`);
    const stat = i => s.evaluate(`exports.d3d9_gps_stat(${i})>>>0`);
    assert.strictEqual(await s.call('IDirect3DDevice9_GetBackBuffer', '[ctx.d9g.device,0,0,0,ctx.d9g.surface]'), 0);
    await s.evaluate('ctx.d9g.bb=exports.guest_read32(ctx.d9g.surface)>>>0');
    const lockRead = async () => {
      assert.strictEqual(await s.call('IDirect3DSurface9_LockRect', '[ctx.d9g.bb,ctx.d9g.lr,0,1<<4]'), 0, 'LockRect');
      const px = await s.evaluate(`(()=>{const p=ctx.d9g,pitch=exports.guest_read32(p.lr)|0,
        wa=exports.guest_to_wasm(exports.guest_read32(p.lr+4)>>>0),v=new DataView(memory.buffer);
        const at=(x,y)=>v.getUint32(wa+y*pitch+x*4,true)>>>0;return {tl:at(1,1),mid:at(5,4),br:at(7,7)}})()`);
      assert.strictEqual(await s.call('IDirect3DSurface9_UnlockRect', '[ctx.d9g.bb]'), 0, 'UnlockRect');
      return px;
    };
    await s.evaluate(triangleXyzrhw());
    // An untransformed XYZ | DIFFUSE triangle in the bottom-right corner
    // (screen (4,8) (8,8) (8,4)), blended by a white BLENDFACTOR (the
    // source colour, unchanged): decline 14.
    await s.evaluate(`ctx.d9g.lit=ctx.d9g.vertices+128;
      ctx.d9g.f32(ctx.d9g.lit,[0,-1,.5,0, 1,-1,.5,0, 1,0,.5,0]);
      [12,28,44].forEach(o=>ctx.d9g.u32(ctx.d9g.lit+o,[${RED}]));true`);
    const frame = color => [
      ['IDirect3DDevice9_SetFVF', '[ctx.d9g.device,0x44]'],
      ['IDirect3DDevice9_Clear', `[ctx.d9g.device,0,0,1,${color},0x3f800000,0]`],
      ['IDirect3DDevice9_DrawPrimitiveUP', '[ctx.d9g.device,4,1,ctx.d9g.vertices,20]'],
    ];
    const present = ['IDirect3DDevice9_Present', '[ctx.d9g.device,0,0,0,0]'];
    await run([['IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,137,0]'],
      ['IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,22,1]']]);
    // Frames 0 and 1: the ring leads from its first call (d9rt lead0): only
    // that first Clear ran on the old path, no draw did.
    await run([...frame(BLUE), present, ...frame(BLUE), present]);
    assert.strictEqual(await stat(81), 1, 'lead from frame 0');
    assert.strictEqual(await stat(88), 1, 'lead0 entry');
    assert.strictEqual(await ops(0x30001), 0, 'no draw ran on the old path');
    assert.strictEqual(await ops(0x30003), 1, 'only the first Clear ran on the old path');
    // Frame 2: leading, the old path is not called for Clear or Draw.
    const draws = await ops(0x30001), clears = await ops(0x30003);
    await run([...frame(BLUE), present]);
    assert.strictEqual(await ops(0x30001), draws, 'lead draw skipped the old path');
    assert.strictEqual(await ops(0x30003), clears, 'lead clear skipped the old path');
    assert.strictEqual(await ops(0x30002), 0, 'ring presented');
    let px = await lockRead();
    assert.strictEqual(px.tl >>> 0, RED);
    assert.strictEqual(px.br >>> 0, BLUE);
    // Frame 3: GREEN clear and the red triangle on the ring, then a BLENDFACTOR draw
    // the ring declines: handover, the old path draws it and presents.
    const uploads = await ops(0x30015);
    await run([...frame(GREEN),
      ['IDirect3DDevice9_SetFVF', '[ctx.d9g.device,0x42]'],
      ['IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,27,1]'],
      ['IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,19,14]'],
      ['IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,20,1]'],
      ['IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,193,0xffffffff]'],
      ['IDirect3DDevice9_DrawPrimitiveUP', '[ctx.d9g.device,4,1,ctx.d9g.lit,16]'],
      ['IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,27,0]'],
      present]);
    const st = await s.stats();
    assert.deepStrictEqual(st.reasons, { 14: 1 }, `one decline ${JSON.stringify(st)}`);
    assert.strictEqual(await stat(80), 1, 'one handover');
    assert.strictEqual(await stat(52), 1, 'handover readback at site 4');
    assert.strictEqual(await ops(0x30015), uploads + 1, 'one old upload of the executor picture');
    assert.strictEqual(await ops(0x30001), draws + 1, 'only the declined draw ran on the old path');
    assert.strictEqual(await ops(0x30002), 1, 'the old path presented the declined frame');
    px = await lockRead();
    assert.strictEqual(px.tl >>> 0, RED, `ring triangle handed over ${px.tl.toString(16)}`);
    assert.strictEqual(px.mid >>> 0, GREEN, `ring clear handed over ${px.mid.toString(16)}`);
    // The old path's blended red triangle on top of the handed-over picture.
    assert.strictEqual(px.br >>> 0, RED, `old-path BLENDFACTOR draw ${px.br.toString(16)}`);
    // Back in shadow mode, with the bar for leading again doubled to 4.
    await run([...frame(BLUE), present, ...frame(BLUE), present, ...frame(BLUE), present]);
    assert.strictEqual(await stat(81), 1, 'three frames are not enough after a handover');
    await run([...frame(BLUE), present]);
    assert.strictEqual(await stat(81), 2, 'four ring frames -> lead again');
    await s.call('IDirect3DSurface9_Release', '[ctx.d9g.bb]');
    await s.call('IDirect3DDevice9_Release', '[ctx.d9g.device]');
    assert.strictEqual(await s.close(), 0, s.output());
    console.log(`PASS lead mode skips the old path, a decline hands the frame over: ${JSON.stringify(st)}`);
  } catch (error) {
    await s.close();
    throw error;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
