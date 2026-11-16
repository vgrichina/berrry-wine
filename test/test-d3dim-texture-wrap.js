#!/usr/bin/env node
'use strict';

// D3D texture wrapping (D3DRENDERSTATE_WRAPU/WRAPV, and WRAP0's D3DWRAP_U/V
// bits) on the software rasterizer, the state the GPU arm reads, and the GPU
// arm's per-triangle coordinate fix-up -- done by the WAT GPU stream producer
// (src/09abg-d3dim-gps.wat, $d3g_draw) and read here from the DRAW_UP
// vertices it hands the software GPU stream executor.
//
// With WRAPU on, a triangle whose u values are more than half a texture apart
// interpolates the short way, across the seam. A sphere's texture seam
// (DX SDK Globe; nine of thirteen small D3DIM apps set WRAPU or WRAPV) otherwise
// draws one strip of triangles holding the whole map, squeezed and backwards.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const apiTable = require('../src/api_table.json');
const GS = require('../lib/gpu-stream');
const { Executor: SoftwareExecutor } = require('../lib/gpu-stream-software');

const extraWat = String.raw`
  (func (export "test_wrap_seed")
      (param $ddraw_vtbl i32) (param $surface_vtbl i32) (param $device_vtbl i32)
    (global.set $DX_VTBL_DDRAW (local.get $ddraw_vtbl))
    (global.set $DX_VTBL_DDSURF2 (local.get $surface_vtbl))
    (global.set $DX_VTBL_D3DDEV1 (local.get $device_vtbl)))
  (func (export "test_wrap_create_surface") (param $desc i32) (param $out i32) (result i32)
    (local $ddraw i32)
    (local.set $ddraw (call $dx_create_com_obj (i32.const 1) (global.get $DX_VTBL_DDRAW)))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDraw_CreateSurface
      (local.get $ddraw) (local.get $desc) (local.get $out) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_wrap_create_device") (param $surface i32) (param $out i32) (result i32)
    (call $d3dim_create_device
      (i32.const 0) (local.get $surface) (local.get $out) (global.get $DX_VTBL_D3DDEV1))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_wrap_dib") (param $surface i32) (result i32)
    (i32.load offset=20 (call $dx_from_this (local.get $surface))))
  (func (export "test_wrap_pitch") (param $surface i32) (result i32)
    (i32.load16_u offset=18 (call $dx_from_this (local.get $surface))))
  (func (export "test_wrap_get_handle")
      (param $api i32) (param $texture i32) (param $device i32) (param $out i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $dispatch_api_table
      (local.get $api) (local.get $texture) (local.get $device)
      (local.get $out) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_wrap_set_rs") (param $device i32) (param $state i32) (param $value i32)
    (call $d3dim_set_render_state (local.get $device) (local.get $state) (local.get $value)))
  (func (export "test_wrap_draw") (param $device i32) (param $rt i32) (param $vertices i32)
    (call $d3dim_draw_tl_triangle_dp
      (local.get $device) (call $dx_from_this (local.get $rt)) (i32.const 0)
      (call $g2w (local.get $vertices))
      (call $g2w (i32.add (local.get $vertices) (i32.const 32)))
      (call $g2w (i32.add (local.get $vertices) (i32.const 64)))))
  ;; The GPU arm: the same 0x20000 draw the core issues, into the producer.
  (func (export "test_wrap_gpu_draw") (param $device i32) (param $vertices i32) (param $count i32) (result i32)
    (global.set $d3dim_gpu_on (i32.const 1))
    (call $d3dim_worker_try_draw (local.get $device) (i32.const 4) (i32.const 3)
      (local.get $vertices) (local.get $count)))
  (func (export "test_wrap_gpu_fence") (result i32)
    (call $d3dim_gpu_call (i32.const 0x20001) (i32.const 0) (i32.const 0)))
`;

function makeSurface(wat, desc, out, width, height) {
  for (let i = 0; i < 128; i += 4) wat.guest_write32(desc + i, 0);
  wat.guest_write32(desc, 108);
  wat.guest_write32(desc + 4, 0x1007);
  wat.guest_write32(desc + 8, height);
  wat.guest_write32(desc + 12, width);
  wat.guest_write32(desc + 72, 32);
  wat.guest_write32(desc + 76, 0x40);
  wat.guest_write32(desc + 84, 16);
  wat.guest_write32(desc + 88, 0xf800);
  wat.guest_write32(desc + 92, 0x07e0);
  wat.guest_write32(desc + 96, 0x001f);
  wat.guest_write32(desc + 104, 0x40);
  assert.strictEqual(wat.test_wrap_create_surface(desc, out) >>> 0, 0);
  return wat.guest_read32(out) >>> 0;
}

const RED = 0xf800, GREEN = 0x07e0, BLUE = 0x001f, WHITE = 0xffff;

async function software() {
  // GPU stream consumer: drain the producer's ring into the software
  // executor, keeping each DRAW_UP's vertex bytes as the executor saw them.
  let wat, memory, sw = null, ring = null, ringAddr = 0;
  const gpuDraws = [];
  const tee = {
    caps: () => sw.caps(),
    execute(rec) {
      if (rec.op === GS.OP.DRAW_UP) {
        const f = rec.fields, b = Buffer.from(rec.arena(f.voff, f.count * f.stride));
        gpuDraws.push({ prim: f.prim, stride: f.stride, count: f.count, dv: new DataView(b.buffer, b.byteOffset, b.length) });
      }
      sw.execute(rec);
    },
  };
  ({ exports: wat, memory } = await bootRenderHarness({ extraWat, fonts: 'none', extraHostOverrides: {
    gpu_stream_kick: (addr, mode) => {
      addr >>>= 0;
      if (!sw) sw = new SoftwareExecutor({ getExports: () => wat, getMemory: () => memory.buffer });
      if (!ring || ringAddr !== addr) { ring = new GS.Ring(() => memory.buffer, addr); ringAddr = addr; }
      GS.drain([ring], tee);
      if ((mode | 0) === GS.CONST.KICK_CLOSE) { sw.close(); sw = null; ring = null; ringAddr = 0; }
      return 1;
    },
  } }));
  const mem = new DataView(memory.buffer);
  const desc = 0x410000, out = 0x410100, devOut = 0x410110, vertices = 0x411000;
  const W = 16;

  wat.test_wrap_seed(0x51000000, 0x52000000, 0x53000000);
  const rt = makeSurface(wat, desc, out, W, W);
  const texture = makeSurface(wat, desc, out + 4, 4, 4);
  assert.strictEqual(wat.test_wrap_create_device(rt, devOut) >>> 0, 0);
  const device = wat.guest_read32(devOut) >>> 0;
  const rtDib = wat.test_wrap_dib(rt) >>> 0, texDib = wat.test_wrap_dib(texture) >>> 0;
  const texPitch = wat.test_wrap_pitch(texture);
  // Columns red, green, blue, white; rows identical, so v never matters here.
  for (let y = 0; y < 4; y++) [RED, GREEN, BLUE, WHITE].forEach((c, x) =>
    mem.setUint16(texDib + y * texPitch + x * 2, c, true));

  const api = apiTable.find(entry => entry.name === 'IDirect3DTexture2_GetHandle');
  assert.strictEqual(wat.test_wrap_get_handle(api.id, texture, device, out + 8) >>> 0, 0);
  wat.test_wrap_set_rs(device, 1, wat.guest_read32(out + 8) >>> 0);
  wat.test_wrap_set_rs(device, 26, 0);   // no dither: exact colours

  const f32 = new DataView(new ArrayBuffer(4));
  const float = (addr, v) => { f32.setFloat32(0, v, true); wat.guest_write32(addr, f32.getUint32(0, true)); };
  // Vertex 0 at the left edge with u = 0.875 (white); vertices 1 and 2 at the
  // right with u = 0.125 (red). Straight interpolation walks back through
  // blue and green; wrapped, it walks white -> red across the seam.
  const draw = () => {
    [[0, 0, 0.875], [W - 1, 0, 0.125], [W - 1, W - 1, 0.125]].forEach(([x, y, u], i) => {
      const p = vertices + i * 32;
      float(p, x); float(p + 4, y); float(p + 8, 0.5); float(p + 12, 1);
      wat.guest_write32(p + 16, 0xffffffff);
      wat.guest_write32(p + 20, 0xff000000);
      float(p + 24, u); float(p + 28, 0.5);
    });
    for (let i = 0; i < W * W; i++) mem.setUint16(rtDib + i * 2, 0, true);
    wat.test_wrap_draw(device, rt, vertices);
    const row = [];
    for (let x = 1; x < W - 1; x++) row.push(mem.getUint16(rtDib + (1 * W + x) * 2, true));
    return row;
  };
  const middle = row => row.filter(c => c === GREEN || c === BLUE).length;
  const hexes = row => row.map(c => c.toString(16)).join(' ');

  let row = draw();
  assert(middle(row) > 0, `no wrap: interpolation crosses green/blue, row ${hexes(row)}`);

  wat.test_wrap_set_rs(device, 5, 1);    // WRAPU
  row = draw();
  assert.strictEqual(middle(row), 0, `WRAPU: the short way never samples green/blue, row ${hexes(row)}`);
  assert(row.includes(WHITE) && row.includes(RED), `WRAPU: white then red, row ${hexes(row)}`);

  // WRAPV alone must not touch u.
  wat.test_wrap_set_rs(device, 5, 0);
  wat.test_wrap_set_rs(device, 6, 1);
  row = draw();
  assert(middle(row) > 0, `WRAPV alone leaves u straight, row ${hexes(row)}`);
  wat.test_wrap_set_rs(device, 6, 0);

  // DX6+ says it through WRAP0 (128): D3DWRAP_U = 1.
  wat.test_wrap_set_rs(device, 128, 1);
  row = draw();
  assert.strictEqual(middle(row), 0, `WRAP0 D3DWRAP_U wraps u, row ${hexes(row)}`);

  // The GPU arm reads the same bits from describe field 33.
  const describe = () => mem.getUint32((wat.d3dim_gpu_describe(device) >>> 0) + 33 * 4, true);
  assert.strictEqual(describe(), 1, 'describe: WRAP0 U');
  wat.test_wrap_set_rs(device, 128, 0);
  assert.strictEqual(describe(), 0, 'describe: no wrap');
  wat.test_wrap_set_rs(device, 5, 1);
  wat.test_wrap_set_rs(device, 6, 1);
  assert.strictEqual(describe(), 3, 'describe: WRAPU + WRAPV');

  // Top-left fill rule: a triangle owns its top scanline, not its bottom one.
  // NFS III draws its cockpit as 256x256 tiles that meet at y=256 with
  // TEXTUREADDRESS=WRAP; the upper tile's bottom row used to be drawn too, at
  // tv=1.001, wrapped to its texture's opaque first row: a black line across
  // the race view. Draw the LOWER quad first so the upper one cannot hide a
  // stolen row by being overwritten.
  wat.test_wrap_set_rs(device, 5, 0); wat.test_wrap_set_rs(device, 6, 0);
  const quad = (y0, y1) => [[[0, y0], [W, y0], [W, y1]], [[0, y0], [W, y1], [0, y1]]];
  const drawTri = (pts, color) => {
    pts.forEach(([x, y], i) => {
      const p = vertices + i * 32;
      float(p, x); float(p + 4, y); float(p + 8, 0.5); float(p + 12, 1);
      wat.guest_write32(p + 16, color);
      wat.guest_write32(p + 20, 0xff000000);
      float(p + 24, 0.5); float(p + 28, y === y0Of(pts) ? 0.001 : 1.001);
    });
    wat.test_wrap_draw(device, rt, vertices);
  };
  const y0Of = pts => Math.min(...pts.map(q => q[1]));
  const fillTex = c => { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) mem.setUint16(texDib + y * texPitch + x * 2, c, true); };
  const rowColors = y => { const s = new Set(); for (let x = 0; x < W - 1; x++) s.add(mem.getUint16(rtDib + (y * W + x) * 2, true)); return [...s]; };
  for (const textured of [true, false]) {
    wat.test_wrap_set_rs(device, 1, textured ? wat.guest_read32(out + 8) >>> 0 : 0);
    for (let i = 0; i < W * W; i++) mem.setUint16(rtDib + i * 2, 0, true);
    fillTex(BLUE);
    for (const tri of quad(8, W)) drawTri(tri, 0xff0000ff);   // lower: blue
    fillTex(RED);
    for (const tri of quad(0, 8)) drawTri(tri, 0xffff0000);   // upper: red
    const label = textured ? 'textured' : 'flat';
    assert.deepStrictEqual(rowColors(7), [RED], `${label}: row 7 belongs to the upper quad (${rowColors(7)})`);
    assert.deepStrictEqual(rowColors(8), [BLUE], `${label}: the shared row 8 belongs to the lower quad, not the upper one (${rowColors(8).map(c => c.toString(16))})`);
  }

  // The same rule across x: a span owns its left column, not its right one.
  // Two quads meet at x=8; the RIGHT one is drawn first, so a left quad that
  // paints column 8 cannot hide it. The left quad is split along the
  // diagonal that gives one triangle a top apex ON the shared edge, (8,0):
  // that row's span has zero width and must draw nothing.
  const quadX = (x0, x1) => [[[x0, 0], [x1, 0], [x0, W]], [[x1, 0], [x1, W], [x0, W]]];
  const colColors = x => { const s = new Set(); for (let y = 0; y < W; y++) s.add(mem.getUint16(rtDib + (y * W + x) * 2, true)); return [...s]; };
  for (const textured of [true, false]) {
    wat.test_wrap_set_rs(device, 1, textured ? wat.guest_read32(out + 8) >>> 0 : 0);
    for (let i = 0; i < W * W; i++) mem.setUint16(rtDib + i * 2, 0, true);
    fillTex(BLUE);
    for (const tri of quadX(8, W)) drawTri(tri, 0xff0000ff);   // right: blue
    fillTex(RED);
    for (const tri of quadX(0, 8)) drawTri(tri, 0xffff0000);   // left: red
    const label = textured ? 'textured' : 'flat';
    const hex = cs => cs.map(c => c.toString(16));
    assert.deepStrictEqual(colColors(7), [RED], `${label}: column 7 belongs to the left quad (${hex(colColors(7))})`);
    assert.deepStrictEqual(colColors(8), [BLUE], `${label}: the shared column 8 belongs to the right quad, not the left one (${hex(colColors(8))})`);
  }

  // ---- GPU arm: the WAT producer's per-triangle fix-up ----
  // Same device and texture, now through $d3dim_gpu_call(0x20000) with
  // $d3dim_gpu_on = 1. Each later vertex of a triangle moves by a whole
  // texture toward that triangle's first vertex when they are more than half
  // a texture apart; the DRAW_UP vertices carry the corrected coordinates.
  wat.test_wrap_set_rs(device, 1, wat.guest_read32(out + 8) >>> 0);
  for (let y = 0; y < 4; y++) [RED, GREEN, BLUE, WHITE].forEach((c, x) =>
    mem.setUint16(texDib + y * texPitch + x * 2, c, true));
  const gpu = (wrapU, wrapV, uvs, at = null) => {
    wat.test_wrap_set_rs(device, 5, wrapU); wat.test_wrap_set_rs(device, 6, wrapV);
    uvs.forEach(([u, v], i) => {
      const p = vertices + i * 32;
      const [x, y] = at ? at[i] : [(i % 3) * 5, 2 + (i % 3)];
      float(p, x); float(p + 4, y); float(p + 8, 0.5); float(p + 12, 1);
      wat.guest_write32(p + 16, 0xffffffff); wat.guest_write32(p + 20, 0xff000000);
      float(p + 24, u); float(p + 28, v);
    });
    const from = gpuDraws.length;
    assert.strictEqual(wat.test_wrap_gpu_draw(device, vertices, uvs.length), 1, 'the draw is taken, not declined');
    assert.strictEqual(wat.test_wrap_gpu_fence(), 1);
    const got = gpuDraws.slice(from);
    assert.strictEqual(got.length, 1, 'one DRAW_UP');
    const d = got[0];
    assert.strictEqual(d.prim, GS.CONST.PRIM_TRIANGLELIST, 'recorded primitive is a triangle list');
    assert.strictEqual(d.stride, 32, 'TL vertex stride');
    assert.strictEqual(d.count, uvs.length, 'every vertex is submitted');
    return Array.from({ length: d.count }, (_, i) =>
      [d.dv.getFloat32(i * 32 + 24, true), d.dv.getFloat32(i * 32 + 28, true)]);
  };
  const tri = [[0.875, 0.875], [0.125, 0.125], [0.5, 0.5]];
  assert.deepStrictEqual(gpu(0, 0, tri), tri, 'GPU, no wrap: coordinates untouched');
  assert.deepStrictEqual(gpu(1, 0, tri), [[0.875, 0.875], [1.125, 0.125], [0.5, 0.5]],
    'GPU, WRAPU: u crosses the seam, v untouched');
  assert.deepStrictEqual(gpu(0, 1, tri), [[0.875, 0.875], [0.125, 1.125], [0.5, 0.5]],
    'GPU, WRAPV: v crosses the seam, u untouched');
  assert.deepStrictEqual(gpu(1, 1, tri), [[0.875, 0.875], [1.125, 1.125], [0.5, 0.5]],
    'GPU, WRAPU+WRAPV: both cross');
  // A second triangle is fixed up relative to its own first vertex.
  const two = [[0.1, 0.5], [0.2, 0.5], [0.3, 0.5], [0.95, 0.5], [0.05, 0.5], [0.9, 0.5]];
  const gotU = gpu(1, 0, two).map(([u]) => Math.round(u * 100) / 100);
  assert.deepStrictEqual(gotU, [0.1, 0.2, 0.3, 0.95, 1.05, 0.9], `GPU, per-triangle reference: ${gotU}`);

  // And the pixels: the seam triangle drawn by the software GPU executor
  // never samples green/blue once WRAPU is on (it does without it).
  const seam = () => {
    for (let i = 0; i < W * W; i++) mem.setUint16(rtDib + i * 2, 0, true);
    gpu(wrapOn, 0, [[0.875, 0.5], [0.125, 0.5], [0.125, 0.5]], [[0, 0], [W - 1, 0], [W - 1, W - 1]]);
    const row = [];
    for (let x = 1; x < W - 1; x++) row.push(mem.getUint16(rtDib + (1 * W + x) * 2, true));
    return row;
  };
  let wrapOn = 0;
  row = seam();
  assert(middle(row) > 0, `GPU no wrap: interpolation crosses green/blue, row ${hexes(row)}`);
  wrapOn = 1;
  row = seam();
  assert.strictEqual(middle(row), 0, `GPU WRAPU: the short way never samples green/blue, row ${hexes(row)}`);
  assert(row.includes(WHITE) && row.includes(RED), `GPU WRAPU: white then red, row ${hexes(row)}`);
}

(async () => {
  await software();
  console.log('PASS D3DIM texture wrap: WRAPU/WRAPV/WRAP0 on software, describe field 33, GPU producer per-triangle fix-up');
})().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
