#!/usr/bin/env node
'use strict';
// Back-buffer LockRect / UnlockRect pay for pixels only when the guest can
// see a change. Alien Shooter's frame is Clear, then three whole-buffer
// LockRect / UnlockRect pairs (sprites drawn by the CPU, quads between
// some), then Present: one readback and one 1.2 MB upload per pair before.
// Now:
// - a Lock right after a full Clear fills the bits with the clear colour
//   on the CPU (no readback);
// - an Unlock's upload is held until the executor next uses its RT (draw,
//   clear, Present, GetRenderTargetData, capture), and a Lock while it is
//   held needs no readback: the bits are already the newest pixels;
// - a Lock after a GPU draw still reads the executor back (site 0);
// - the old path's readback (0x30016) is skipped whenever the stream
//   supplies the pixels.
// Checked against zeroed DIBs so only executor pixels satisfy the asserts.
const assert = require('assert');
const { openD3d9GpsSession, triangleXyzrhw, RED, BLUE } = require('./helpers/d3d9-gps-session');
const GREEN = 0xff00ff00, WHITE = 0xffffffff, GREY = 0xff404040;

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
      ['IDirect3DDevice9_GetBackBuffer', '[ctx.d9g.device,0,0,0,ctx.d9g.surface]'],
    ]);
    await s.evaluate('ctx.d9g.bb=exports.guest_read32(ctx.d9g.surface)>>>0');
    const extra = async () => ({
      current: await s.evaluate('exports.d3d9_gps_stat(76)>>>0'),
      fills: await s.evaluate('exports.d3d9_gps_stat(77)>>>0'),
      oldReadbacks: await s.evaluate('ctx.d9g.ops[0x30016]|0'),
    });
    // Lock the whole buffer; read two pixels, write one.
    const lock = async (write, color) => {
      assert.strictEqual(await s.call('IDirect3DSurface9_LockRect', '[ctx.d9g.bb,ctx.d9g.lr,0,0]'), 0);
      const px = await s.evaluate(`(()=>{const p=ctx.d9g;p.pitch=exports.guest_read32(p.lr)|0;
        p.bits=exports.guest_read32(p.lr+4)>>>0;const wa=exports.guest_to_wasm(p.bits),v=new DataView(memory.buffer);
        const at=(x,y)=>v.getUint32(wa+y*p.pitch+x*4,true)>>>0;const r={tl:at(1,1),br:at(7,7),w:at(6,6),g:at(2,6)};
        v.setUint32(wa+${write[1]}*p.pitch+${write[0]}*4,${color},true);return r})()`);
      assert.strictEqual(await s.call('IDirect3DSurface9_UnlockRect', '[ctx.d9g.bb]'), 0);
      return px;
    };
    const front = () => s.evaluate(`(()=>{const p=ctx.d9g,wa=exports.guest_to_wasm(p.bits);
      new Uint8Array(memory.buffer,wa,p.pitch*8).fill(0);exports.d3d9_gps_sync_front();
      const v=new DataView(memory.buffer),at=(x,y)=>v.getUint32(wa+y*p.pitch+x*4,true)>>>0;
      return {tl:at(1,1),br:at(7,7),w:at(6,6),g:at(2,6)}})()`);

    // Frame 1: Clear, three Lock / Unlock pairs, Present.
    await run([['IDirect3DDevice9_Clear', `[ctx.d9g.device,0,0,1,${BLUE},0x3f800000,0]`]]);
    let px = await lock([6, 6], WHITE);
    assert.strictEqual(px.tl >>> 0, BLUE, `Lock after a full Clear sees the clear colour ${px.tl.toString(16)}`);
    assert.strictEqual(px.br >>> 0, BLUE);
    px = await lock([2, 6], GREEN);
    assert.strictEqual(px.w >>> 0, WHITE, 'second Lock sees the first one\'s CPU write');
    px = await lock([3, 3], GREY);
    assert.strictEqual(px.g >>> 0, GREEN, 'third Lock sees the second one\'s CPU write');
    let st = await s.stats(), ex = await extra();
    assert.deepStrictEqual(st.sites, {}, `no readback for a cleared frame ${JSON.stringify(st)}`);
    assert.strictEqual(st.readbacks, 0);
    assert.strictEqual(ex.fills, 1, JSON.stringify(ex));
    assert.strictEqual(ex.current, 2, JSON.stringify(ex));
    assert.strictEqual(ex.oldReadbacks, 0, 'old path never read its RT back');
    assert.strictEqual(st.rtUploads, 0, 'Unlock uploads are held until the executor needs the RT');
    await run([['IDirect3DDevice9_Present', '[ctx.d9g.device,0,0,0,0]']]);
    st = await s.stats();
    assert.strictEqual(st.rtUploads, 1, `Present sent the three Unlocks as one upload ${JSON.stringify(st)}`);
    let f = await front();
    assert.strictEqual(f.w >>> 0, WHITE, `CPU writes reached the executor ${f.w.toString(16)}`);
    assert.strictEqual(f.g >>> 0, GREEN);
    assert.strictEqual(f.br >>> 0, BLUE);

    // Frame 2: Clear, Lock / Unlock, draw, Lock / Unlock, Lock / Unlock, Present.
    await run([['IDirect3DDevice9_Clear', `[ctx.d9g.device,0,0,1,${BLUE},0x3f800000,0]`]]);
    px = await lock([6, 6], WHITE);
    assert.strictEqual(px.tl >>> 0, BLUE);
    await run([['IDirect3DDevice9_DrawPrimitiveUP', '[ctx.d9g.device,4,1,ctx.d9g.vertices,20]']]);
    st = await s.stats();
    assert.strictEqual(st.rtUploads, 2, 'the held upload went up before the draw');
    px = await lock([2, 6], GREEN);
    assert.strictEqual(px.tl >>> 0, RED, `Lock after a draw reads the executor back ${px.tl.toString(16)}`);
    assert.strictEqual(px.w >>> 0, WHITE, 'and still sees the CPU write under the draw');
    px = await lock([3, 3], GREY);
    assert.strictEqual(px.g >>> 0, GREEN);
    st = await s.stats();
    // Site 3 is this test's own capture of frame 1 (front()).
    assert.deepStrictEqual(st.sites, { 0: 1, 3: 1 }, `one Lock readback: the one after the draw ${JSON.stringify(st)}`);
    await run([['IDirect3DDevice9_Present', '[ctx.d9g.device,0,0,0,0]']]);
    st = await s.stats(); ex = await extra();
    assert.strictEqual(st.rtUploads, 3, JSON.stringify(st));
    assert.strictEqual(ex.oldReadbacks, 0, 'old path never read its RT back');
    f = await front();
    assert.strictEqual(f.tl >>> 0, RED);
    assert.strictEqual(f.g >>> 0, GREEN);
    assert.strictEqual(f.br >>> 0, BLUE);
    assert.strictEqual(st.gpuFrames, 2, JSON.stringify(st));
    assert.strictEqual(await s.evaluate('ctx.d9g.ops[0x30002]|0'), 0, 'no old present');
    await s.call('IDirect3DSurface9_Release', '[ctx.d9g.bb]');
    await s.call('IDirect3DDevice9_Release', '[ctx.d9g.device]');
    assert.strictEqual(await s.close(), 0, s.output());
    console.log(`PASS back-buffer locks read back only after GPU work; unlocks fold into one upload: ${JSON.stringify({ st, ex })}`);
  } catch (error) {
    await s.close();
    throw error;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
