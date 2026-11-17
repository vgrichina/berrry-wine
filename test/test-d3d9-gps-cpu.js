#!/usr/bin/env node
'use strict';
// CPU reshapes on the D3D9 ring (src/09akg-d3d9-gps.wat, "d9cpu"): draws
// and textures the executors cannot take as they are, rewritten in WAT into
// ones they can, so the frame stays a GPU frame with no decline. Each frame
// is compared, pixel for pixel, with a reference the same executor draws
// from data built here, or with the old software path:
//   A flat-shaded POSITIONT triangle strip (16): equals a Gouraud list of the
//     expanded triangles with the provoking vertex's colours copied;
//   B flat-shaded indexed fan, fixed T&L with lighting off, DIFFUSE and
//     SPECULAR (16): the same against its expanded list;
//   C flat shading with lighting on: the VS runs on the CPU (d9fv), no
//     decline (test-d3d9-gps-flat-vs.js checks its pixels);
//   D a POSITIONT stage reading texcoord set 1 of a TEX0 FVF (24): equals the
//     same quad with set 0 = (0, 0) explicitly;
//   E a 35001-triangle DrawPrimitiveUP (2.1 MB of vertices, 20): split into
//     DRAW_UP chunks; equals the visible triangles drawn alone;
//   F an indexed UP draw of 540000 16-bit indices (20): split likewise;
//   G a cube texture (6), POSITIONT with 3D texcoords pointing at every
//     face: equals the old software path;
//   I a Clear of 300 rects (20 past 256 before): equals the old path;
//   H a 4096-wide texture is refused by CreateTexture (MaxTextureWidth
//     2048), which is why reason 25 has no CPU path: it cannot be reached.
// Stats 83 / 84 count expanded draws and their DRAW_UP chunks.
const assert = require('assert');
const { openD3d9GpsSession } = require('./helpers/d3d9-gps-session');

const SIZE = 16;
const bytes = n => new DataView(new ArrayBuffer(n));
const raw = dv => [...new Uint8Array(dv.buffer)];
const COLORS = [0xffff0000, 0xff00ff00, 0xff0000ff, 0xffffff00, 0xffff00ff, 0xff00ffff, 0xffffffff, 0xff808080];
// Screen-space strip: 6 vertices, 4 triangles across the target.
const STRIP = [[0, 0], [0, 16], [5, 0], [6, 16], [11, 0], [16, 16]];

// Expansion order of $d9cpu_seq: odd strip triangles (t, t+2, t+1), fan
// triangles (t+1, t+2, 0).
const stripTri = t => (t & 1 ? [t, t + 2, t + 1] : [t, t + 1, t + 2]);
const fanTri = t => [t + 1, t + 2, 0];

async function render(gps, extra = []) {
  const s = await openD3d9GpsSession({ gps, size: SIZE, extra });
  try {
    const ok = async (name, args) => assert.strictEqual(await s.call(name, args), 0, name);
    await ok('IDirect3D9_CreateDevice', '[0,0,1,exports.get_main_hwnd(),0,ctx.d9g.pp,ctx.d9g.out]');
    await s.evaluate(`(()=>{const p=ctx.d9g;p.device=exports.guest_read32(p.out)>>>0;
      p.up=exports.guest_alloc(2200000)>>>0;p.idx=exports.guest_alloc(1100000)>>>0;p.texout=exports.guest_alloc(4)>>>0;
      p.tlr=exports.guest_alloc(8)>>>0;p.texs=[];
      p.put=(ga,b)=>new Uint8Array(memory.buffer).set(b,exports.guest_to_wasm(ga));return true})()`);
    const rs = (id, v) => ok('IDirect3DDevice9_SetRenderState', `[ctx.d9g.device,${id},${v}]`);
    const tss = (st, id, v) => ok('IDirect3DDevice9_SetTextureStageState', `[ctx.d9g.device,${st},${id},${v}]`);
    const samp = (st, id, v) => ok('IDirect3DDevice9_SetSamplerState', `[ctx.d9g.device,${st},${id},${v}]`);
    const fvf = f => ok('IDirect3DDevice9_SetFVF', `[ctx.d9g.device,${f}]`);
    const put = (where, dv) => s.evaluate(`ctx.d9g.put(ctx.d9g.${where},${JSON.stringify(raw(dv))});true`);
    const stat = i => s.evaluate(`exports.d3d9_gps_stat(${i})>>>0`);
    // A texture: $make(level, face) -> [w, h, texel(x, y)].
    const texture = async (cube, w, h, levels, texel) => {
      if (cube) await ok('IDirect3DDevice9_CreateCubeTexture', `[ctx.d9g.device,${w},${levels},0,21,1,ctx.d9g.texout,0]`);
      else await ok('IDirect3DDevice9_CreateTexture', `[ctx.d9g.device,${w},${h},${levels},0,21,1,ctx.d9g.texout,0]`);
      const ref = await s.evaluate('ctx.d9g.texs.push(exports.guest_read32(ctx.d9g.texout)>>>0)-1');
      for (let face = 0; face < (cube ? 6 : 1); face++) {
        for (let l = 0; l < levels; l++) {
          const lw = Math.max(1, w >> l), lh = Math.max(1, h >> l);
          const lock = cube ? `IDirect3DCubeTexture9_LockRect','[ctx.d9g.texs[${ref}],${face},${l},ctx.d9g.tlr,0,0]`
            : `IDirect3DTexture9_LockRect','[ctx.d9g.texs[${ref}],${l},ctx.d9g.tlr,0,0]`;
          const [name, args] = lock.split("','");
          await ok(name, args);
          const px = [];
          for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) px.push(texel(face, l, x, y));
          await s.evaluate(`(()=>{const p=ctx.d9g,pitch=exports.guest_read32(p.tlr)|0,bits=exports.guest_read32(p.tlr+4)>>>0,px=${JSON.stringify(px)};
            for(let y=0;y<${lh};y++)p.u32(bits+y*pitch,px.slice(y*${lw},(y+1)*${lw}));return true})()`);
          if (cube) await ok('IDirect3DCubeTexture9_UnlockRect', `[ctx.d9g.texs[${ref}],${face},${l}]`);
          else await ok('IDirect3DTexture9_UnlockRect', `[ctx.d9g.texs[${ref}],${l}]`);
        }
      }
      return `ctx.d9g.texs[${ref}]`;
    };
    const frames = {}, stats = {};
    const frame = async (name, bind, draws, clear = 0xff000000) => {
      await bind();
      const before = await s.stats(), x0 = [await stat(83), await stat(84)];
      await ok('IDirect3DDevice9_Clear', `[ctx.d9g.device,0,0,1,${clear},0x3f800000,0]`);
      // The old path (gps off) may refuse what the ring draws; its result
      // is recorded, never asserted.
      const hr = [];
      for (const [api, args] of draws) hr.push(gps === 'off' ? await s.call(api, args) : await ok(api, args));
      hr.push(gps === 'off' ? await s.call('IDirect3DDevice9_Present', '[ctx.d9g.device,0,0,0,0]')
        : await ok('IDirect3DDevice9_Present', '[ctx.d9g.device,0,0,0,0]'));
      const after = await s.stats();
      if (hr.some(x => x)) console.log(`${gps} ${name}: HRESULTs ${hr.map(x => x.toString(16))}`);
      stats[name] = { failed: hr.some(x => x), declines: after.declines - before.declines, draws: after.draws - before.draws,
        expanded: (await stat(83)) - x0[0], chunks: (await stat(84)) - x0[1],
        reasons: Object.fromEntries(Object.entries(after.reasons).map(([r, n]) => [r, n - (before.reasons[r] || 0)]).filter(([, n]) => n)) };
      assert.strictEqual(await s.call('IDirect3DDevice9_GetBackBuffer', '[ctx.d9g.device,0,0,0,ctx.d9g.surface]'), 0);
      await s.evaluate('ctx.d9g.bb=exports.guest_read32(ctx.d9g.surface)>>>0');
      await ok('IDirect3DSurface9_LockRect', '[ctx.d9g.bb,ctx.d9g.lr,0,1<<4]');
      frames[name] = await s.evaluate(`(()=>{const p=ctx.d9g,pitch=exports.guest_read32(p.lr)|0,
        wa=exports.guest_to_wasm(exports.guest_read32(p.lr+4)>>>0),v=new DataView(memory.buffer),out=[];
        for(let y=0;y<${SIZE};y++)for(let x=0;x<${SIZE};x++)out.push(v.getUint32(wa+y*pitch+x*4,true)>>>0);return out})()`);
      await ok('IDirect3DSurface9_UnlockRect', '[ctx.d9g.bb]');
      await s.call('IDirect3DSurface9_Release', '[ctx.d9g.bb]');
    };
    // XYZRHW | DIFFUSE vertices (stride 20) from [[x, y], colour].
    const tvert = list => { const v = bytes(list.length * 20);
      list.forEach(([[x, y], c], i) => { v.setFloat32(i * 20, x, true); v.setFloat32(i * 20 + 4, y, true);
        v.setFloat32(i * 20 + 8, 0.5, true); v.setFloat32(i * 20 + 12, 1, true); v.setUint32(i * 20 + 16, c, true); });
      return v; };
    const upDraw = (prim, count, stride) => ['IDirect3DDevice9_DrawPrimitiveUP', `[ctx.d9g.device,${prim},${count},ctx.d9g.up,${stride}]`];

    await rs(137, 0); await rs(22, 1); await rs(7, 0);
    // Two plain ring frames: the ring then leads.
    for (let i = 0; i < 2; i++) {
      await put('up', tvert(STRIP.map((p, k) => [p, COLORS[k]])));
      await frame('warm' + i, () => fvf(0x44), [upDraw(5, 4, 20)]);
    }

    // A: flat strip vs its expanded Gouraud list.
    await put('up', tvert(STRIP.map((p, k) => [p, COLORS[k]])));
    await frame('A', async () => { await fvf(0x44); await rs(9, 1); }, [upDraw(5, 4, 20)]);
    await put('up', tvert([0, 1, 2, 3].flatMap(t => stripTri(t).map(k => [STRIP[k], COLORS[t]]))));
    await frame('Aref', () => rs(9, 2), [upDraw(4, 4, 20)]);

    // B: flat indexed fan, fixed T&L (XYZ | DIFFUSE | SPECULAR), lighting off,
    // SPECULARENABLE; identity transforms map clip x, y to the target.
    const FAN = [[0, 0], [-1, 1], [0, 1], [1, 1], [1, -1], [-1, -1]];
    const xyz = list => { const v = bytes(list.length * 20);
      list.forEach(([[x, y], c, sp], i) => { v.setFloat32(i * 20, x, true); v.setFloat32(i * 20 + 4, y, true);
        v.setFloat32(i * 20 + 8, 0.5, true); v.setUint32(i * 20 + 12, c, true); v.setUint32(i * 20 + 16, sp, true); });
      return v; };
    const spec = k => (0xff000000 | (k * 0x10) << 16) >>> 0;
    const fanIdx = [5, 4, 3, 2, 1, 0], ib = bytes(12);
    fanIdx.forEach((k, i) => ib.setUint16(i * 2, k, true));
    // Vertices stored reversed; index i names vertex 5 - i.
    await put('up', xyz([5, 4, 3, 2, 1, 0].map(k => [FAN[k], COLORS[k], spec(k)])));
    await put('idx', ib);
    await frame('B', async () => { await fvf(0xc2); await rs(29, 1); await rs(9, 1); },
      [['IDirect3DDevice9_DrawIndexedPrimitiveUP', '[ctx.d9g.device,6,0,6,4,ctx.d9g.idx,101,ctx.d9g.up,20]']]);
    await put('up', xyz([0, 1, 2, 3].flatMap(t => fanTri(t).map(k => [FAN[k], COLORS[t + 1], spec(t + 1)]))));
    await frame('Bref', () => rs(9, 2), [upDraw(4, 4, 20)]);

    // C: lit + flat runs the fixed VS on the CPU since d9fv: no decline.
    await frame('C', async () => { await rs(137, 1); await rs(9, 1); }, [upDraw(4, 4, 20)]);
    await rs(137, 0); await rs(9, 2); await rs(29, 0);

    // D: POSITIONT TEX0 reads set 1 -> default (0, 0); a 2x2 point texture.
    const tex2 = await texture(false, 2, 2, 1, (f, l, x, y) => [0xffff8040, 0xff20c0ff, 0xff40ff40, 0xffffffff][y * 2 + x]);
    await ok('IDirect3DDevice9_SetTexture', `[ctx.d9g.device,0,${tex2}]`);
    for (const k of [5, 6, 7]) await samp(0, k, 1);
    const QUAD = [[0, 0], [16, 0], [0, 16], [16, 16]];
    await put('up', tvert(QUAD.map((p, k) => [p, COLORS[k + 4]])));
    await frame('D', async () => { await fvf(0x44); await tss(0, 11, 1); }, [upDraw(5, 2, 20)]);
    {
      const v = bytes(4 * 28);
      QUAD.forEach(([x, y], i) => { [x, y, 0.5, 1].forEach((f, j) => v.setFloat32(i * 28 + j * 4, f, true));
        v.setUint32(i * 28 + 16, COLORS[i + 4], true); v.setFloat32(i * 28 + 20, 0, true); v.setFloat32(i * 28 + 24, 0, true); });
      await put('up', v);
    }
    await frame('Dref', async () => { await fvf(0x144); await tss(0, 11, 0); }, [upDraw(5, 2, 28)]);
    await ok('IDirect3DDevice9_SetTexture', '[ctx.d9g.device,0,0]');

    // E: 35001 triangles, 2.1 MB: every 5000th one visible, the rest
    // degenerate (all three vertices equal).
    const N = 35001, visible = t => t % 5000 === 0;
    const tri = t => { const x = (t / 5000) * 2, c = COLORS[(t / 5000) % 8];
      return [[[x, 0], c], [[x + 2, 0], c], [[x, 16], c]]; };
    {
      const v = bytes(N * 60);
      const list = [];
      for (let t = 0; t < N; t++) list.push(...(visible(t) ? tri(t) : [[[1, 1], 0], [[1, 1], 0], [[1, 1], 0]]));
      const tv = tvert(list);
      new Uint8Array(v.buffer).set(new Uint8Array(tv.buffer));
      await s.evaluate(`ctx.d9g.big=${JSON.stringify([...new Uint8Array(v.buffer)])};true`);
      await s.evaluate('ctx.d9g.put(ctx.d9g.up,ctx.d9g.big);delete ctx.d9g.big;true');
    }
    await frame('E', () => fvf(0x44), [upDraw(4, N, 20)]);
    await put('up', tvert([0, 1, 2, 3, 4, 5, 6, 7].flatMap(i => tri(i * 5000))));
    await frame('Eref', () => fvf(0x44), [upDraw(4, 8, 20)]);

    // F: 180000 indexed triangles over 4 vertices (540000 16-bit indices):
    // two visible (0 1 2 at the start, 1 3 2 at the end), the rest (0 0 0).
    // Ring only: the old path's DrawIndexedPrimitiveUP fails on it and
    // leaves the back buffer unlockable.
    if (gps !== 'off') {
      const T = 180000;
      await s.evaluate(`(()=>{const a=new Uint16Array(${T * 3});a.set([0,1,2],0);a.set([1,3,2],${(T - 1) * 3});
        new Uint16Array(memory.buffer,exports.guest_to_wasm(ctx.d9g.idx),${T * 3}).set(a);return true})()`);
      await put('up', tvert(QUAD.map((p, k) => [p, COLORS[k]])));
      await frame('F', () => fvf(0x44), [['IDirect3DDevice9_DrawIndexedPrimitiveUP', `[ctx.d9g.device,4,0,4,${T},ctx.d9g.idx,101,ctx.d9g.up,20]`]]);
      await put('up', tvert([0, 1, 2, 1, 3, 2].map(k => [QUAD[k], COLORS[k]])));
      await frame('Fref', () => fvf(0x44), [upDraw(4, 2, 20)]);
    }

    // G: a 4x4 cube, every face and texel distinct; corner directions.
    const cube = await texture(true, 4, 4, 1, (f, l, x, y) => (0xff000000 | (f * 40 + 20) << 16 | (x * 60 + 10) << 8 | (y * 60 + 10)) >>> 0);
    await ok('IDirect3DDevice9_SetTexture', `[ctx.d9g.device,0,${cube}]`);
    {
      // A 3x3 grid of quads, each a direction toward a different face mix.
      const DIRS = [[1, 0.3, 0.2], [-1, -0.2, 0.4], [0.3, 1, -0.1], [-0.4, -1, 0.2], [0.2, 0.1, 1], [-0.3, 0.4, -1],
        [0.9, 0.8, 0.1], [-0.7, 0.2, -0.9], [0.1, -0.6, 0.8]];
      const v = bytes(9 * 6 * 32);
      let i = 0;
      DIRS.forEach((d, q) => { const x0 = (q % 3) * 5, y0 = Math.floor(q / 3) * 5;
        for (const [dx, dy] of [[0, 0], [5, 0], [0, 5], [5, 0], [5, 5], [0, 5]]) {
          [x0 + dx, y0 + dy, 0.5, 1].forEach((f, j) => v.setFloat32(i * 32 + j * 4, f, true));
          v.setUint32(i * 32 + 16, 0xffffffff, true);
          // Per-corner jitter so each quad spans part of a face.
          [d[0] + dx * 0.02, d[1] - dy * 0.02, d[2]].forEach((f, j) => v.setFloat32(i * 32 + 20 + j * 4, f, true));
          i++;
        } });
      await put('up', v);
    }
    // TEX1 | TEXCOORDSIZE3(0) = 0x144 | (1 << 16).
    // CLAMP: the old path samples cubes only so (the ring clamps any cube).
    await frame('G', async () => { await fvf(0x10144); await tss(0, 11, 0); for (const k of [1, 2, 3]) await samp(0, k, 3); },
      [upDraw(4, 18, 32)]);
    await ok('IDirect3DDevice9_SetTexture', '[ctx.d9g.device,0,0]');

    // I: a Clear of 300 rects (20 past 256 before): 1x1 rects on a pattern.
    {
      const r = bytes(300 * 16);
      for (let i = 0; i < 300; i++) {
        // The top half only, the last rect (i = 299) at the bottom right.
        const x = i === 299 ? 15 : (i * 7) % 16, y = i === 299 ? 15 : (i * 3 + (i >> 4)) % 8;
        [x, y, x + 1, y + 1].forEach((n, j) => r.setInt32(i * 16 + j * 4, n, true));
      }
      await put('idx', r);
      await frame('I', async () => {}, [['IDirect3DDevice9_Clear', '[ctx.d9g.device,300,ctx.d9g.idx,1,0xff30c050,0x3f800000,0]']]);
    }

    // H: why 25 cannot be reached -- a 4096-wide texture is refused at
    // creation (MaxTextureWidth 2048), so the ring's guard never sees one.
    assert.strictEqual(await s.call('IDirect3DDevice9_CreateTexture', '[ctx.d9g.device,4096,4,1,0,21,1,ctx.d9g.texout,0]'),
      0x8876086c, 'CreateTexture 4096 refused');
    assert.strictEqual(await s.close(), 0, s.output());
    return { frames, stats };
  } catch (error) {
    const all = s.output();
    if (process.env.D9CPU_LOG) require('fs').writeFileSync(process.env.D9CPU_LOG, all);
    const tail = all.slice(-3000);
    await s.close();
    error.message += `\n${gps} session output:\n${tail}`;
    throw error;
  }
}

(async () => {
  const ring = await render('software');
  const old = await render('off');
  const bad = [];
  const same = (a, b, label) => {
    const k = a.findIndex((v, i) => v !== b[i]);
    if (k >= 0) bad.push(`${label}: pixel ${k} ${(a[k] >>> 0).toString(16)} vs ${(b[k] >>> 0).toString(16)}`);
    const colours = new Set(a).size;
    return colours;
  };
  const st = ring.stats;
  const clean = (name, expanded) => {
    const f = st[name];
    if (f.declines) bad.push(`${name} declined ${JSON.stringify(f)}`);
    if (expanded !== undefined && f.expanded !== expanded) bad.push(`${name} expanded ${f.expanded} != ${expanded}`);
  };
  const lines = [];
  for (const [name, ref, x] of [['A', 'Aref', 1], ['B', 'Bref', 1], ['D', 'Dref', 1], ['E', 'Eref', 1], ['F', 'Fref', 1]]) {
    clean(name, x); clean(ref, 0);
    lines.push(`${name}: ${same(ring.frames[name], ring.frames[ref], `${name} vs ${ref}`)} colours, ${JSON.stringify(st[name])}`);
  }
  // The flat frames must actually differ from Gouraud (the old path ignores
  // SHADEMODE, so its frame A is the Gouraud strip).
  if (ring.frames.A.every((v, i) => v === old.frames.A[i])) bad.push('A: flat equals Gouraud');
  if (st.E.chunks < 3) bad.push(`E: ${st.E.chunks} chunks`);
  if (st.F.chunks < 2) bad.push(`F: ${st.F.chunks} chunks`);
  if (JSON.stringify(st.C.reasons) !== '{}') bad.push(`C reasons ${JSON.stringify(st.C.reasons)}`);
  clean('G');
  lines.push(`G: ${same(ring.frames.G, old.frames.G, 'G vs old path')} colours, ${JSON.stringify(st.G)}`);
  // Off-path agreement where the old path implements the same thing.
  for (const name of ['D', 'E'])
    lines.push(`${name} vs old: ${old.stats[name].failed ? 'old path refused the draw'
      : ring.frames[name].every((v, i) => v === old.frames[name][i]) ? 'same' : 'differs'}`);
  if (old.stats.G.failed) bad.push('G: the old path refused the cube draw');
  clean('I');
  lines.push(`I: ${same(ring.frames.I, old.frames.I, 'I vs old path')} colours, ${JSON.stringify(st.I)}`);
  if (ring.frames.I[255] !== 0xff30c050 || ring.frames.I[128] !== 0xff000000) bad.push('I: rect 299 / bottom half');
  // --webgl (needs a display): each reshaped frame equals its reference on
  // the WebGL executor too, and the cube / clear frames decline nothing.
  if (process.argv.includes('--webgl')) {
    const gl = await render('webgl', ['--headless-gl']);
    for (const [name, ref] of [['A', 'Aref'], ['B', 'Bref'], ['D', 'Dref'], ['E', 'Eref'], ['F', 'Fref']]) {
      if (gl.stats[name].declines || !gl.stats[name].expanded) bad.push(`webgl ${name} ${JSON.stringify(gl.stats[name])}`);
      same(gl.frames[name], gl.frames[ref], `webgl ${name} vs ${ref}`);
    }
    for (const name of ['G', 'I']) if (gl.stats[name].declines) bad.push(`webgl ${name} declined`);
    lines.push(`webgl: A B D E F equal their references; G ${new Set(gl.frames.G).size} colours`);
  }
  assert.deepStrictEqual(bad, [], `\n  ${bad.join('\n  ')}\n  ${lines.join('\n  ')}`);
  console.log(`PASS d9cpu reshapes on the ring\n  ${lines.join('\n  ')}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
