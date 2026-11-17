#!/usr/bin/env node
'use strict';
// Indexed (PAL8) textures through the WAT GPU stream producer ($d3g_texture:
// palette words in the texture signature, a palette page watch, decode by
// $d3dim_gpu_decode_texture) into the software executor, with the
// real CreatePalette / SetPalette / SetEntries / SetColorKey handlers:
//   - DDPCAPS_ALPHA peFlags alpha 0/128/255 for draws and textured clears;
//     an ordinary palette with the same bytes stays opaque
//   - an alpha-only SetEntries is seen through the palette watch (re-upload)
//   - detach falls back to grayscale indices
//   - application alpha test / blend / depth over palette alpha
//   - native-index colour key (state 41) with COLORKEYBLENDENABLE (144)
//     writing zero RGBA, FALSE rejecting, filtered taps
//   - the explicit alpha-palette + attached-key + 144 combination traps
// Ported from the deleted WebGL executor's test-d3dim-palette-gpu-web.js.
const assert = require('assert');
const { bootGpsDevice } = require('./helpers/d3dim-gps-device');

const WAT = String.raw`
(func (export "gp_seed") (global.set $DX_VTBL_DDPAL (i32.const 0x54000000)))
(func (export "gp_palette") (param $caps i32) (param $entries i32) (param $out i32) (result i32)
 (local $dd i32)
 (local.set $dd (call $dx_create_com_obj (i32.const 1) (global.get $DX_VTBL_DDRAW)))
 (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
 (call $handle_IDirectDraw_CreatePalette (local.get $dd) (local.get $caps) (local.get $entries) (local.get $out) (i32.const 0) (i32.const 0))
 (i32.load (global.get $reg_base)))
(func (export "gp_attach") (param $s i32) (param $p i32) (result i32)
 (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
 (call $handle_IDirectDrawSurface_SetPalette (local.get $s) (local.get $p) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
 (i32.load (global.get $reg_base)))
(func (export "gp_entries") (param $p i32) (param $start i32) (param $count i32) (param $entries i32) (result i32)
 (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
 (call $handle_IDirectDrawPalette_SetEntries (local.get $p) (i32.const 0) (local.get $start) (local.get $count) (local.get $entries) (i32.const 0))
 (i32.load (global.get $reg_base)))
(func (export "gp_key") (param $s i32) (param $key i32) (result i32)
 (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
 (call $handle_IDirectDrawSurface_SetColorKey (local.get $s) (i32.const 8) (local.get $key) (i32.const 0) (i32.const 0) (i32.const 0))
 (i32.load (global.get $reg_base)))
(func (export "gp_palette_data") (param $p i32) (result i32)
 (load.field DxObject misc1 (call $dx_from_this (local.get $p))))
`;
const RGB = [64, 128, 192];
const ok = (hr, label) => assert.strictEqual(hr >>> 0, 0, label + ' HRESULT');

async function arm(gpu) {
  const label = gpu ? 'GPS' : 'WAT software';
  const g = await bootGpsDevice({ extraWat: WAT, gpu }), { e, m } = g;
  e.gp_seed();
  const PAL8 = [0x60, 8, 0, 0, 0, 0];
  const rt = g.surface(4, 4, { caps: 0x2040, pf: g.PF.argb32 }), dev = g.device(rt);
  const texture = g.surface(4, 4, { caps: 0x1000, pf: PAL8 });
  const entries = e.guest_alloc(1024), out = e.guest_alloc(16), vertices = e.guest_alloc(256);
  const entry = a => (RGB[0] | RGB[1] << 8 | RGB[2] << 16 | a << 24) >>> 0;
  for (let i = 0; i < 256; i++) g.w32(entries + i * 4, entry(255));
  [0, 128, 255].forEach((a, i) => g.w32(entries + (7 + i) * 4, entry(a)));
  const palette = caps => { ok(e.gp_palette(caps, entries, out), 'CreatePalette'); return e.guest_read32(out) >>> 0; };
  const alpha = palette(0x404), ordinary = palette(4);
  const paletteBytes = p => Array.from(new Uint8Array(g.memory().buffer, e.gp_palette_data(p), 1024));
  assert.deepStrictEqual(paletteBytes(alpha), paletteBytes(ordinary), 'equal-byte palettes');
  const indexFill = (s, f) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) m.setUint8(g.dib(s) + y * g.pitch(s) + x, f(x)); g.cpuWrote(s); };
  indexFill(texture, x => 7 + Math.min(x, 2));
  const rs = (id, v) => e.gd_rs(dev, id, v), tss = (id, v) => e.gd_tss(dev, 0, id, v);
  for (const [id, v] of [[7, 0], [14, 0], [15, 0], [22, 1], [27, 0], [28, 0], [41, 0]]) rs(id, v);
  // SELECTARG1(TEXTURE) for colour and alpha, clamp, point sampling.
  for (const [id, v] of [[1, 2], [2, 2], [4, 2], [5, 2], [13, 3], [14, 3], [16, 1], [17, 1]]) tss(id, v);
  e.gd_tss(dev, 1, 1, 1);
  e.gd_bind(dev, 0, texture); ok(e.gp_attach(texture, alpha), 'SetPalette');
  const draw = (z = .5, color = 0xffffffff, uv = null) => {
    g.vertices(vertices, [[-.5, -.5, 0, 0], [3.5, -.5, 1, 0], [-.5, 3.5, 0, 1], [3.5, -.5, 1, 0], [3.5, 3.5, 1, 1], [-.5, 3.5, 0, 1]]
      .map(([x, y, u, v]) => [x, y, z, 1, color, 0, uv ? uv[0] : u, uv ? uv[1] : v]));
    const before = g.stat(0);
    e.gd_draw(dev, 4, vertices, 6);
    if (gpu) assert.strictEqual(g.stat(0), before + 1, 'draw lowered by the producer');
  };
  // Rows are identical; read row 1, columns 0..2 (indices 7, 8, 9).
  const read = () => { g.fence(); return [0, 1, 2].map(x => { const v = m.getUint32(g.dib(rt) + g.pitch(rt) + x * 4, true);
    return [v >>> 16 & 255, v >>> 8 & 255, v & 255, v >>> 24]; }); };
  const observations = [];
  const record = (name, expected, tol = 0) => {
    const actual = read(); observations.push({ name, actual });
    const bad = actual.some((p, i) => p.some((c, j) => Math.abs(c - expected[i][j]) > tol));
    const message = `${label} ${name}: actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`;
    assert(!bad, message);
  };
  const rgba = (a, colors = [RGB, RGB, RGB]) => a.map((v, i) => [...colors[i], v]);
  const uniform = c => [c, c, c];
  const clear = (tex, color = 0xff000000) => {
    if (gpu) assert.strictEqual(e.gd_clear(rt, 1, color, 1, 0, 0, 4, 4, tex), 1, 'producer takes the clear');
    else e.gd_fill(rt, color, 0, 0, 4, 4, tex);
  };
  const matrix = (name, alphas, colors) => {
    rs(15, 0); rs(27, 0); draw(); record(`${name} draw RGBA`, rgba(alphas, colors));
    clear(texture); record(`${name} textured clear RGBA`, rgba(alphas, colors));
  };
  matrix('alpha 0/128/255', [0, 128, 255]);
  const setFlags = (pal, values) => {
    const before = paletteBytes(pal);
    values.forEach((a, i) => g.w32(entries + i * 4, entry(a)));
    ok(e.gp_entries(pal, 7, 3, entries), 'SetEntries');
    assert.deepStrictEqual(before.flatMap((v, i) => v === paletteBytes(pal)[i] ? [] : [i]), [31, 35, 39], 'alpha-only mutation');
  };
  const uploads0 = g.stat(8);
  setFlags(alpha, [255, 0, 128]); matrix('watched alpha edit', [255, 0, 128]);
  if (gpu) assert(g.stat(8) > uploads0, 'alpha-only SetEntries re-uploads the texture');
  setFlags(alpha, [0, 128, 255]); matrix('watched alpha restore', [0, 128, 255]);
  ok(e.gp_attach(texture, ordinary), 'ordinary attach'); matrix('ordinary peFlags opaque', [255, 255, 255]);
  ok(e.gp_attach(texture, alpha), 'alpha reattach'); matrix('alpha reattach', [0, 128, 255]);
  ok(e.gp_attach(texture, 0), 'detach');
  matrix('detach grayscale', [255, 255, 255], [[7, 7, 7], [8, 8, 8], [9, 9, 9]]);
  ok(e.gp_attach(texture, ordinary), 'ordinary reattach');
  setFlags(ordinary, [255, 0, 128]); matrix('ordinary watched flags ignored', [255, 255, 255]);
  ok(e.gp_attach(texture, alpha), 'alpha for application tests');
  clear(0); rs(15, 1); rs(24, 127); rs(25, 5); // GREATER than 127/255
  draw(); record('application alpha test', [[0, 0, 0, 255], [...RGB, 128], [...RGB, 255]]);
  rs(15, 0); clear(0); rs(27, 1); rs(19, 5); rs(20, 6); // SRCALPHA / INVSRCALPHA
  draw(); record('application alpha blend', [[0, 0, 0, 255], [32, 64, 96, 191], [...RGB, 255]], 1);
  rs(27, 0);
  if (gpu) {
    // Depth (the producer's per-target depth buffer).
    rs(7, 1); rs(14, 1); rs(23, 2); rs(15, 1);
    assert.strictEqual(e.gd_clear(rt, 3, 0xff000000, 1, 0, 0, 4, 4, 0), 1, 'color/depth clear');
    draw(.1); // An alpha-zero fragment writes neither colour nor near depth.
    rs(15, 0); e.gd_bind(dev, 0, 0); draw(.5, 0xff00ff00);
    record('alpha rejection preserves depth', [[0, 255, 0, 255], [...RGB, 128], [...RGB, 255]]);
    rs(7, 0); rs(14, 0); e.gd_bind(dev, 0, texture);
  }
  // DX7 key blending, ordinary palette. Duplicate RGB entries 7/8/9 make
  // native index membership differ from comparing expanded colours.
  ok(e.gp_attach(texture, ordinary), 'key ordinary attach');
  g.w32(out, 7); g.w32(out + 4, 7); ok(e.gp_key(texture, out), 'SetColorKey native index 7');
  rs(15, 0); rs(27, 0); rs(41, 1); rs(144, 1);
  clear(0); draw(); record('explicit key writes zero RGBA', [[0, 0, 0, 0], [...RGB, 255], [...RGB, 255]]);
  rs(144, 0); clear(0); draw(); record('FALSE legacy key rejection', [[0, 0, 0, 255], [...RGB, 255], [...RGB, 255]]);
  rs(144, 1); clear(0); draw(); record('TRUE restored with same palette and bytes', [[0, 0, 0, 0], [...RGB, 255], [...RGB, 255]]);
  rs(41, 0); clear(0); draw(); record('state144 alone unkeyed', rgba([255, 255, 255]));
  rs(41, 1);
  for (const filter of [1, 2]) {
    tss(16, filter); tss(17, filter);
    clear(0); draw(.5, 0xffffffff, [.125, .5]); record(`filter${filter} all-key zero`, uniform([0, 0, 0, 0]));
    clear(0); draw(.5, 0xffffffff, [.375, .5]); record(`filter${filter} duplicate nonkey zero-weight key`, uniform([...RGB, 255]));
  }
  // Software fixed-point filtering truncates the half-coverage alpha to 127.
  clear(0); draw(.5, 0xffffffff, [.25, .5]); record('mixed taps zero RGB before linear filtering', uniform([32, 64, 96, 128]), 1);
  rs(15, 1); rs(25, 5); rs(24, 126); clear(0); draw(.5, 0xffffffff, [.25, .5]);
  record('mixed app alpha pass', uniform([32, 64, 96, 128]), 1);
  rs(24, 128); clear(0); draw(.5, 0xffffffff, [.25, .5]); record('mixed app alpha reject', uniform([0, 0, 0, 255]));
  rs(15, 0); rs(27, 1); rs(19, 5); rs(20, 6); clear(0); draw(.5, 0xffffffff, [.125, .5]);
  record('key app blend preserves destination', uniform([0, 0, 0, 255]));
  rs(27, 0); rs(15, 1); rs(24, 0); tss(4, 3); tss(6, 0); // alpha SELECTARG2(DIFFUSE)
  clear(0); draw(.5, 0xffffffff, [.125, .5]);
  record('opaque diffuse alpha passes application test', uniform([0, 0, 0, 255]));
  rs(15, 0); tss(4, 2);
  const noKey = g.surface(4, 4, { caps: 0x1000, pf: PAL8 });
  ok(e.gp_attach(noKey, alpha), 'alpha palette on surface without key');
  indexFill(noKey, () => 8); e.gd_bind(dev, 0, noKey);
  clear(0); draw(.5, 0xffffffff, [.375, .5]); record('alpha palette state144 TRUE without attached key', uniform([...RGB, 128]), 1);
  e.gd_bind(dev, 0, texture); ok(e.gp_attach(texture, alpha), 'unknown key alpha attach');
  rs(41, 0); clear(0); draw(.5, 0xffffffff, [.375, .5]); record('alpha palette state144 TRUE with COLORKEYENABLE FALSE', uniform([...RGB, 128]), 1);
  const s = g.stats();
  if (gpu) { assert.strictEqual(s.fallbacks, 0, 'no software fallback'); assert.strictEqual(s.declined, 0, 'no declines'); }
  // The unresolved combination fails visibly rather than picking a precedence.
  rs(41, 1);
  let trapped = false;
  try { draw(.5, 0xffffffff, [.125, .5]); } catch (error) { trapped = error instanceof WebAssembly.RuntimeError; }
  assert(trapped, `${label}: explicit alpha palette + attached key + state 144 traps`);
  return { label, n: observations.length, s, observations };
}

(async () => {
  const gps = await arm(1);
  console.log(`PASS GPS producer PAL8 textures: ${gps.n} GPS pixel observations; ` +
    `GPS draws=${gps.s.draws} textureUploads=${gps.s.textureUploads} clears=${gps.s.clears}`);
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
