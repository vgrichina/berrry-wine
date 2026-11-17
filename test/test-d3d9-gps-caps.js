#!/usr/bin/env node
'use strict';
// Retirement slice S2 (src/09akg-d3d9-gps.wat "capabilities"): with the
// ring active, WAT decides what the guest is told -- GetDeviceCaps, the
// shader VM gate, the R5G6B5 back buffer and occlusion-query support --
// from the launch profile and the ring's capability block, without the old
// 0x30005 / 0x30017 / 0x3000a calls. The answers are the old path's,
// byte for byte, for every profile: programmable or not, software renderer
// or no D3D9 GPU at all (where the ring has no executor by default), except
// the vertex-blend caps the ring alone implements (see below).
const assert = require('assert');
const { openD3d9GpsSession } = require('./helpers/d3d9-gps-session');

const create = '[0,0,1,exports.get_main_hwnd(),0,ctx.d9g.pp,ctx.d9g.out]';
const CAP_OPS = [0x30005, 0x30017, 0x3000a];

async function probe({ gps, renderer, programmable }) {
  const s = await openD3d9GpsSession({ gps, renderer, extra: programmable ? ['--d3d9-programmable'] : [] });
  try {
    // 0x30017 aux 24 is the old bridge's world-matrix trace switch, a
    // diagnostic of the old transport itself, not a capability.
    await s.evaluate(`ctx.d9g.caps=exports.guest_alloc(320)>>>0;ctx.d9g.capOps=[];
      ctx.d9g.onCall=(op,a,x)=>{if([${CAP_OPS}].includes(op)&&!(op===0x30017&&x===24))ctx.d9g.capOps.push(op.toString(16)+':'+x);};true`);
    const r = {};
    r.capsHr = await s.call('IDirect3D9_GetDeviceCaps', '[0,0,1,ctx.d9g.caps]');
    r.caps = await s.evaluate(`Array.from(new Uint8Array(memory.buffer,exports.guest_to_wasm(ctx.d9g.caps),304)).join(',')`);
    r.create = await s.call('IDirect3D9_CreateDevice', create);
    if (r.create === 0) {
      await s.evaluate('ctx.d9g.device=exports.guest_read32(ctx.d9g.out)>>>0');
      r.occlusion = await s.call('IDirect3DDevice9_CreateQuery', '[ctx.d9g.device,9,0]');
      r.event = await s.call('IDirect3DDevice9_CreateQuery', '[ctx.d9g.device,8,0]');
      await s.call('IDirect3DDevice9_Release', '[ctx.d9g.device]');
    }
    // An R5G6B5 back buffer is created only where the executor converts it.
    await s.evaluate('exports.guest_write32(ctx.d9g.pp+8,23);true');
    r.create565 = await s.call('IDirect3D9_CreateDevice', create);
    if (r.create565 === 0) {
      await s.evaluate('ctx.d9g.device=exports.guest_read32(ctx.d9g.out)>>>0');
      await s.call('IDirect3DDevice9_Release', '[ctx.d9g.device]');
    }
    r.capOps = await s.evaluate('ctx.d9g.capOps.join()');
    r.stats = await s.stats();
    assert.strictEqual(await s.close(), 0, s.output());
    return r;
  } catch (error) { await s.close(); throw error; }
}

(async () => {
  const lines = [];
  for (const [renderer, programmable] of [['software', true], ['software', false], [null, true]]) {
    const old = await probe({ gps: 'off', renderer, programmable });
    // gps undefined: the run.js default executor for this renderer.
    const ring = await probe({ gps: null, renderer, programmable });
    const label = `renderer=${renderer || 'none'} programmable=${programmable}`;
    // One deliberate difference: fixed-function vertex blending lowers only
    // on the ring (09akg d9ms / d9cpu), so a live ring reports
    // MaxVertexBlendMatrices 4 and MaxVertexBlendMatrixIndex 21 (+168, +172,
    // IDirect3D9 caps: hardware vertex processing) and the old path 0 / 0.
    const blendCaps = c => { const b = c.split(',').map(Number); return [b[168] | b[169] << 8, b[172] | b[173] << 8]; };
    const live = renderer === 'software';
    assert.deepStrictEqual(blendCaps(old.caps), [0, 0], `${label}: old path blend caps`);
    assert.deepStrictEqual(blendCaps(ring.caps), live ? [4, 21] : [0, 0], `${label}: ring blend caps`);
    const unblend = c => c.split(',').map((x, i) => (i >= 168 && i < 176 ? '0' : x)).join(',');
    for (const k of ['capsHr', 'caps', 'create', 'occlusion', 'event', 'create565']) {
      const [a, b] = k === 'caps' ? [unblend(ring[k]), unblend(old[k])] : [ring[k], old[k]];
      assert.deepStrictEqual(a, b, `${label}: ${k} differs (old ${old[k]} ring ${ring[k]})`);
    }
    if (renderer === 'software') {
      assert.strictEqual(ring.stats.dead, 0, `${label}: the ring has an executor`);
      assert.strictEqual(ring.capOps, '', `${label}: no old caps call with the ring active`);
    } else {
      assert.strictEqual(ring.stats.gpuFrames + ring.stats.draws, 0, `${label}: nothing on the ring`);
      assert(ring.stats.opens === 0 || ring.stats.dead === 1, `${label}: no executor by default without a D3D9 GPU ${JSON.stringify(ring.stats)}`);
    }
    const hwRaster = ring.caps.split(',').slice(28, 32).some(Number);
    lines.push(`${label}: create=${ring.create.toString(16)} 565=${ring.create565.toString(16)} occlusion=${(ring.occlusion >>> 0).toString(16)} hwRaster=${hwRaster} oldCapOps=${old.capOps}`);
  }
  console.log('PASS ring caps match the old path\n  ' + lines.join('\n  '));
})().catch(error => { console.error(error); process.exitCode = 1; });
