#!/usr/bin/env node
'use strict';
// The shared GPU-stream coherence module (src/09a8gv-gps-coherence.wat),
// driven through its D3D9 back-buffer client on the software executor:
// - a CPU read after a GPU write reads the executor back exactly once, at
//   the guest's first translation of the locked bits, not at LockRect;
// - a Lock / Unlock the guest never touches reads nothing and uploads
//   nothing (the lazy entry is disarmed untouched);
// - a CPU write after the lazy arm keeps the GPU's pixels around it.
// Guest accesses go through guest_read32 / guest_write32 ($gl32 / $gs32,
// so $g2w and the DIB-window trap), the way guest x86 reaches the bits.
const assert = require('assert');
const { openD3d9GpsSession, triangleXyzrhw, RED, BLUE } = require('./helpers/d3d9-gps-session');
const GREEN = 0xff00ff00;
const D3D9 = 4;

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
    const counts = async () => JSON.parse(await s.evaluate(`JSON.stringify({
      armed: exports.gps_stat(${D3D9},8)>>>0, touched: exports.gps_stat(${D3D9},9)>>>0,
      untouched: exports.gps_stat(${D3D9},10)>>>0, readbacks: exports.gps_stat(${D3D9},2)>>>0,
      uploads: exports.d3d9_gps_stat(7)>>>0 })`));
    const delta = (a, b) => Object.fromEntries(Object.keys(a).map(k => [k, b[k] - a[k]]));
    const lock = async () => {
      assert.strictEqual(await s.call('IDirect3DSurface9_LockRect', '[ctx.d9g.bb,ctx.d9g.lr,0,0]'), 0);
      await s.evaluate('(()=>{const p=ctx.d9g;p.pitch=exports.guest_read32(p.lr)|0;p.bits=exports.guest_read32(p.lr+4)>>>0;return true})()');
    };
    const unlock = async () => assert.strictEqual(await s.call('IDirect3DSurface9_UnlockRect', '[ctx.d9g.bb]'), 0);
    const read = (x, y) => s.evaluate(`exports.guest_read32(ctx.d9g.bits+${y}*ctx.d9g.pitch+${x}*4)>>>0`);
    const draw = () => run([
      ['IDirect3DDevice9_Clear', `[ctx.d9g.device,0,0,1,${BLUE},0x3f800000,0]`],
      ['IDirect3DDevice9_DrawPrimitiveUP', '[ctx.d9g.device,4,1,ctx.d9g.vertices,20]'],
    ]);

    // 1. GPU write, then a CPU read: one readback, at the first translation.
    await draw();
    let c0 = await counts();
    await lock();
    let d = delta(c0, await counts());
    assert.strictEqual(d.armed, 1, `the Lock arms a lazy entry ${JSON.stringify(d)}`);
    assert.strictEqual(d.readbacks, 0, `nothing is read at LockRect ${JSON.stringify(d)}`);
    assert.strictEqual(await read(1, 1), RED, 'the first CPU read sees the GPU triangle');
    assert.strictEqual(await read(7, 7), BLUE, 'and the GPU clear');
    d = delta(c0, await counts());
    assert.strictEqual(d.readbacks, 1, `exactly one readback for two reads ${JSON.stringify(d)}`);
    assert.strictEqual(d.touched, 1, JSON.stringify(d));
    await unlock();
    assert.strictEqual(delta(c0, await counts()).readbacks, 1);

    // 2. A Lock nothing touches: no readback, no upload.
    await draw();
    c0 = await counts();
    await lock();
    await unlock();
    await run([['IDirect3DDevice9_Present', '[ctx.d9g.device,0,0,0,0]']]);
    d = delta(c0, await counts());
    assert.deepStrictEqual({ armed: d.armed, untouched: d.untouched, readbacks: d.readbacks, uploads: d.uploads },
      { armed: 1, untouched: 1, readbacks: 0, uploads: 0 }, `an untouched Lock costs nothing ${JSON.stringify(d)}`);

    // 3. A CPU write after the arm keeps the GPU's pixels around it.
    await draw();
    c0 = await counts();
    await lock();
    await s.evaluate(`exports.guest_write32(ctx.d9g.bits+2*ctx.d9g.pitch+2*4,${GREEN})`);
    d = delta(c0, await counts());
    assert.strictEqual(d.readbacks, 1, `the write's translation read the GPU pixels back first ${JSON.stringify(d)}`);
    await unlock();
    await run([['IDirect3DDevice9_Present', '[ctx.d9g.device,0,0,0,0]']]);
    const front = JSON.parse(await s.evaluate(`(()=>{const p=ctx.d9g,wa=exports.guest_to_wasm(p.bits);
      new Uint8Array(memory.buffer,wa,p.pitch*8).fill(0);exports.d3d9_gps_sync_front();
      const v=new DataView(memory.buffer),at=(x,y)=>v.getUint32(wa+y*p.pitch+x*4,true)>>>0;
      return JSON.stringify({w:at(2,2),tri:at(1,1),clear:at(7,7)})})()`));
    assert.strictEqual(front.w >>> 0, GREEN, `the CPU write reached the executor ${JSON.stringify(front)}`);
    assert.strictEqual(front.tri >>> 0, RED, `the GPU triangle survived the write ${JSON.stringify(front)}`);
    assert.strictEqual(front.clear >>> 0, BLUE, `the GPU clear survived the write ${JSON.stringify(front)}`);

    await s.call('IDirect3DSurface9_Release', '[ctx.d9g.bb]');
    await s.call('IDirect3DDevice9_Release', '[ctx.d9g.device]');
    assert.strictEqual(await s.close(), 0, s.output());
    console.log(`PASS gps coherence: lazy Lock reads back once on first touch, untouched Lock is free, write keeps GPU pixels ${JSON.stringify(await Promise.resolve(d))}`);
  } catch (error) {
    await s.close();
    throw error;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
