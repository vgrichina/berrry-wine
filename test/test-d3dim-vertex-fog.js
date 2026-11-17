#!/usr/bin/env node
'use strict';

// D3D vertex fog on the software rasterizer, and the state the GPU arm reads.
//
// With D3DRENDERSTATE_FOGENABLE (28) on and FOGTABLEMODE (35) NONE, a
// transformed vertex carries its own fog factor in the specular alpha: 255 is
// unfogged, 0 is entirely D3DRENDERSTATE_FOGCOLOR (34), and the factor is
// interpolated across the face. Neither D3DIM arm implemented it, so MW3's
// distance fog (which it enables for the whole world) drew nothing at all.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const apiTable = require('../src/api_table.json');

const extraWat = String.raw`
  (func (export "test_fog_seed")
      (param $ddraw_vtbl i32) (param $surface_vtbl i32) (param $device_vtbl i32)
    (global.set $DX_VTBL_DDRAW (local.get $ddraw_vtbl))
    (global.set $DX_VTBL_DDSURF2 (local.get $surface_vtbl))
    (global.set $DX_VTBL_D3DDEV1 (local.get $device_vtbl)))
  (func (export "test_fog_create_surface") (param $desc i32) (param $out i32) (result i32)
    (local $ddraw i32)
    (local.set $ddraw (call $dx_create_com_obj (i32.const 1) (global.get $DX_VTBL_DDRAW)))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDraw_CreateSurface
      (local.get $ddraw) (local.get $desc) (local.get $out) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_fog_create_device") (param $surface i32) (param $out i32) (result i32)
    (call $d3dim_create_device
      (i32.const 0) (local.get $surface) (local.get $out) (global.get $DX_VTBL_D3DDEV1))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_fog_dib") (param $surface i32) (result i32)
    (i32.load offset=20 (call $dx_from_this (local.get $surface))))
  (func (export "test_fog_get_handle")
      (param $api i32) (param $texture i32) (param $device i32) (param $out i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $dispatch_api_table
      (local.get $api) (local.get $texture) (local.get $device)
      (local.get $out) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_fog_bind_handle") (param $device i32) (param $handle i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirect3DDevice3_SetRenderState
      (local.get $device) (i32.const 1) (local.get $handle)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_fog_set_rs") (param $device i32) (param $state i32) (param $value i32)
    (call $d3dim_set_render_state (local.get $device) (local.get $state) (local.get $value)))
  (func (export "test_fog_draw") (param $device i32) (param $rt i32) (param $vertices i32)
    ;; One TL triangle through the GPU stream producer, landed for the CPU.
    (call $d3dim_worker_route (local.get $device) (i32.const 4) (local.get $vertices) (i32.const 3))
    (call $d3dim_worker_fence))
  (func (export "test_fog_on") (result i32) (global.get $rast_fog_on))
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
  assert.strictEqual(wat.test_fog_create_surface(desc, out) >>> 0, 0);
  return wat.guest_read32(out) >>> 0;
}

(async () => {
  const { exports: wat, memory } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const mem = new DataView(memory.buffer);
  const desc = 0x410000, out = 0x410100, devOut = 0x410110, vertices = 0x411000;
  const W = 16;

  wat.test_fog_seed(0x51000000, 0x52000000, 0x53000000);
  const rt = makeSurface(wat, desc, out, W, W);
  const texture = makeSurface(wat, desc, out + 4, 2, 2);
  assert.strictEqual(wat.test_fog_create_device(rt, devOut) >>> 0, 0);
  const device = wat.guest_read32(devOut) >>> 0;
  const rtDib = wat.test_fog_dib(rt) >>> 0, texDib = wat.test_fog_dib(texture) >>> 0;
  for (let i = 0; i < 4; i++) mem.setUint16(texDib + i * 2, 0xffff, true);

  const api = apiTable.find(entry => entry.name === 'IDirect3DTexture2_GetHandle');
  assert.strictEqual(wat.test_fog_get_handle(api.id, texture, device, out + 8) >>> 0, 0);
  assert.strictEqual(wat.test_fog_bind_handle(device, wat.guest_read32(out + 8) >>> 0) >>> 0, 0);
  wat.test_fog_set_rs(device, 26, 0);   // no dither: exact colours

  // A right triangle over the top-left of the target: vertex 0 at the left
  // edge, vertices 1 and 2 at x = 15. White texture, white diffuse.
  const f32 = new DataView(new ArrayBuffer(4));
  const float = (addr, v) => { f32.setFloat32(0, v, true); wat.guest_write32(addr, f32.getUint32(0, true)); };
  const draw = (fogAlphas, diffuse = [0xffffffff, 0xffffffff, 0xffffffff]) => {
    [[0, 0], [W - 1, 0], [W - 1, W - 1]].forEach(([x, y], i) => {
      const p = vertices + i * 32;
      float(p, x); float(p + 4, y); float(p + 8, 0.5); float(p + 12, 1);
      wat.guest_write32(p + 16, diffuse[i] >>> 0);
      wat.guest_write32(p + 20, (fogAlphas[i] << 24) >>> 0);
      float(p + 24, 0.25); float(p + 28, 0.25);
    });
    for (let i = 0; i < W * W; i++) mem.setUint16(rtDib + i * 2, 0, true);
    wat.test_fog_draw(device, rt, vertices);
    assert.strictEqual(wat.test_fog_on(), 0, 'a fogged D3D triangle left the span fog on');
  };
  const px = (x, y) => mem.getUint16(rtDib + (y * W + x) * 2, true);
  const hex = v => `0x${v.toString(16)}`;
  const BLUE = 0x001f, WHITE = 0xffff;

  draw([0, 0, 0]);
  assert.strictEqual(px(12, 2), WHITE, `fog disabled: factor 0 is ignored, got ${hex(px(12, 2))}`);

  wat.test_fog_set_rs(device, 28, 1);            // FOGENABLE
  wat.test_fog_set_rs(device, 34, 0xff0000ff);   // FOGCOLOR blue
  draw([255, 255, 255]);
  assert.strictEqual(px(12, 2), WHITE, `factor 255 is unfogged, got ${hex(px(12, 2))}`);
  draw([0, 0, 0]);
  assert.strictEqual(px(12, 2), BLUE, `factor 0 is the fog colour, got ${hex(px(12, 2))}`);

  // Unfogged at the left vertex, fully fogged at the right two: red falls
  // off along x.
  draw([255, 0, 0]);
  const red = x => px(x, 1) >> 11;
  assert(red(2) > red(8) && red(8) > red(13),
    `the factor is interpolated across the face: red ${red(2)}, ${red(8)}, ${red(13)}`);
  assert.strictEqual(px(13, 1) & 0x1f, 0x1f, 'blue stays full toward the fogged edge');

  // Table fog (FOGTABLEMODE != NONE) is a different computation, from depth;
  // it is not the vertex factor and neither arm draws it.
  wat.test_fog_set_rs(device, 35, 3);
  draw([0, 0, 0]);
  assert.strictEqual(px(12, 2), WHITE, `table fog does not take the vertex factor, got ${hex(px(12, 2))}`);

  // The GPU arm reads the same decision from d3dim_gpu_describe.
  const d = wat.d3dim_gpu_describe(device) >>> 0;
  assert.strictEqual(mem.getUint32(d + 31 * 4, true), 0, 'describe: table fog is not vertex fog');
  wat.test_fog_set_rs(device, 35, 0);
  const d2 = wat.d3dim_gpu_describe(device) >>> 0;
  assert.strictEqual(mem.getUint32(d2 + 31 * 4, true), 1, 'describe: vertex fog on');
  assert.strictEqual(mem.getUint32(d2 + 32 * 4, true), 0xff0000ff, 'describe: fog colour');

  // Untextured: the flat single-colour path cannot vary per pixel, so a
  // fogged face goes through the interpolating span on a white texel.
  assert.strictEqual(wat.test_fog_bind_handle(device, 0) >>> 0, 0);
  draw([0, 0, 0]);
  assert.strictEqual(px(12, 2), BLUE, `untextured factor 0 is the fog colour, got ${hex(px(12, 2))}`);
  draw([255, 0, 0]);
  assert(red(2) > red(8) && red(8) > red(13),
    `untextured factor is interpolated: red ${red(2)}, ${red(8)}, ${red(13)}`);
  wat.test_fog_set_rs(device, 28, 0);
  draw([0, 0, 0]);
  assert.strictEqual(px(12, 2), WHITE, `untextured, fog off: diffuse, got ${hex(px(12, 2))}`);

  // Untextured with no fog is Gouraud too, as on the GPU arm: a red left
  // vertex and blue right ones blend along x instead of taking vertex 0's
  // colour for the whole face.
  draw([255, 255, 255], [0xffff0000, 0xff0000ff, 0xff0000ff]);
  assert(red(2) > red(8) && red(8) > red(13),
    `untextured Gouraud: red ${red(2)}, ${red(8)}, ${red(13)}`);
  assert((px(13, 1) & 0x1f) > (px(2, 1) & 0x1f), 'untextured Gouraud: blue rises toward the right');

  console.log('PASS D3DIM vertex fog: specular-alpha factor, interpolated, table fog excluded, GPU describe, untextured, untextured Gouraud');
})().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
