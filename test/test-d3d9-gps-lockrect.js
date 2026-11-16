#!/usr/bin/env node
'use strict';
// Slice 9.5a: LockRect of the back buffer after a GPU frame reads the
// executor's render target back (readback site 0) into the locked bits, and
// what the CPU writes through a writable lock goes back up on UnlockRect (an
// RT upload): the next ring-presented frame shows it. Checked against a
// zeroed DIB so only executor pixels can satisfy the assertions.
const assert = require('assert');
const { openD3d9GpsSession, triangleXyzrhw, RED, BLUE } = require('./helpers/d3d9-gps-session');
const GREEN = 0xff00ff00;

(async () => {
  const s = await openD3d9GpsSession();
  try {
    assert.strictEqual(await s.call('IDirect3D9_CreateDevice', '[0,0,1,exports.get_main_hwnd(),0,ctx.d9g.pp,ctx.d9g.out]'), 0);
    await s.evaluate('ctx.d9g.device=exports.guest_read32(ctx.d9g.out)>>>0');
    const run = async list => { for (const [name, args] of list) assert.strictEqual(await s.call(name, args), 0, name); };
    await s.evaluate(triangleXyzrhw());
    await run([
      ['IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,137,0]'],
      ['IDirect3DDevice9_SetRenderState', '[ctx.d9g.device,22,1]'],
      ['IDirect3DDevice9_SetFVF', '[ctx.d9g.device,0x44]'],
      ['IDirect3DDevice9_Clear', `[ctx.d9g.device,0,0,1,${BLUE},0x3f800000,0]`],
      ['IDirect3DDevice9_DrawPrimitiveUP', '[ctx.d9g.device,4,1,ctx.d9g.vertices,20]'],
      ['IDirect3DDevice9_Present', '[ctx.d9g.device,0,0,0,0]'],
      ['IDirect3DDevice9_GetBackBuffer', '[ctx.d9g.device,0,0,0,ctx.d9g.surface]'],
    ]);
    await s.evaluate('ctx.d9g.bb=exports.guest_read32(ctx.d9g.surface)>>>0');
    // Writable lock of the whole buffer: executor pixels land in the bits.
    assert.strictEqual(await s.call('IDirect3DSurface9_LockRect', '[ctx.d9g.bb,ctx.d9g.lr,0,0]'), 0);
    let st = await s.stats();
    assert.deepStrictEqual(st.sites, { 0: 1 }, `one LockRect readback ${JSON.stringify(st)}`);
    const px = await s.evaluate(`(()=>{const p=ctx.d9g;p.pitch=exports.guest_read32(p.lr)|0;
      p.bits=exports.guest_read32(p.lr+4)>>>0;const wa=exports.guest_to_wasm(p.bits),v=new DataView(memory.buffer);
      const at=(x,y)=>v.getUint32(wa+y*p.pitch+x*4,true)>>>0;const r={tl:at(1,1),br:at(7,7)};
      v.setUint32(wa+6*p.pitch+6*4,${GREEN},true);return r})()`);
    assert.strictEqual(px.tl >>> 0, RED, `locked bits show the executor frame ${px.tl.toString(16)}`);
    assert.strictEqual(px.br >>> 0, BLUE);
    assert.strictEqual(await s.call('IDirect3DSurface9_UnlockRect', '[ctx.d9g.bb]'), 0);
    st = await s.stats();
    assert.strictEqual(st.rtUploads, 1, 'UnlockRect pushed the CPU write to the executor');
    // A frame with nothing drawn still presents from the ring; read the
    // executor back into a zeroed DIB.
    await run([['IDirect3DDevice9_Present', '[ctx.d9g.device,0,0,0,0]']]);
    const after = await s.evaluate(`(()=>{const p=ctx.d9g,wa=exports.guest_to_wasm(p.bits);
      new Uint8Array(memory.buffer,wa,p.pitch*8).fill(0);exports.d3d9_gps_sync_front();
      const v=new DataView(memory.buffer),at=(x,y)=>v.getUint32(wa+y*p.pitch+x*4,true)>>>0;
      return {green:at(6,6),tl:at(1,1),br:at(7,7)}})()`);
    assert.strictEqual(after.green >>> 0, GREEN, `CPU write reached the executor ${after.green.toString(16)}`);
    assert.strictEqual(after.tl >>> 0, RED);
    assert.strictEqual(after.br >>> 0, BLUE);
    st = await s.stats();
    assert.strictEqual(st.gpuFrames, 2, JSON.stringify(st));
    assert.strictEqual(await s.evaluate('ctx.d9g.ops[0x30002]|0'), 0, 'no old present');
    await s.call('IDirect3DSurface9_Release', '[ctx.d9g.bb]');
    await s.call('IDirect3DDevice9_Release', '[ctx.d9g.device]');
    assert.strictEqual(await s.close(), 0, s.output());
    console.log(`PASS LockRect reads the executor RT back; UnlockRect uploads the CPU write: ${JSON.stringify(st)}`);
  } catch (error) {
    await s.close();
    throw error;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
