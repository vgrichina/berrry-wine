#!/usr/bin/env node
'use strict';

// Direct3D never writes a pixel outside the current viewport, and that holds
// for pre-transformed (XYZRHW) vertices too: the viewport rectangle is the
// clip region on the render target. Both rasterizers clipped only to the
// whole target. Age of Wonders II draws its lower UI panel into the back
// buffer once and then redraws just the map viewport every frame, so its
// terrain mesh painted straight over the panel and left black wedges where
// the mesh runs off the map (AOW2-RENDERING-COVERAGE, Threads and no-Threads
// renderers alike).
//
// This draws a TL quad covering the whole target through the real
// $d3dim_draw_primitive funnel: with no viewport it fills everything, with a
// viewport only the viewport changes. It also checks that the clip reaches
// the WebGL executor's descriptor (fields 34-38) while a draw is in progress
// and is gone after it.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_vpc_seed")
      (param $ddraw_vtbl i32) (param $surface_vtbl i32) (param $device_vtbl i32)
    (global.set $DX_VTBL_DDRAW (local.get $ddraw_vtbl))
    (global.set $DX_VTBL_DDSURF2 (local.get $surface_vtbl))
    (global.set $DX_VTBL_D3DDEV1 (local.get $device_vtbl)))
  (func (export "test_vpc_create_surface") (param $desc i32) (param $out i32) (result i32)
    (local $ddraw i32)
    (local.set $ddraw (call $dx_create_com_obj (i32.const 1) (global.get $DX_VTBL_DDRAW)))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDraw_CreateSurface
      (local.get $ddraw) (local.get $desc) (local.get $out) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_vpc_create_device") (param $surface i32) (param $out i32) (result i32)
    (call $d3dim_create_device
      (i32.const 0) (local.get $surface) (local.get $out) (global.get $DX_VTBL_D3DDEV1))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_vpc_dib") (param $surface i32) (result i32)
    (i32.load offset=20 (call $dx_from_this (local.get $surface))))
  (func (export "test_vpc_pitch") (param $surface i32) (result i32)
    (i32.load16_u offset=18 (call $dx_from_this (local.get $surface))))
  (func (export "test_vpc_set_rs") (param $device i32) (param $state i32) (param $value i32)
    (call $d3dim_set_render_state (local.get $device) (local.get $state) (local.get $value)))
  ;; The device's recorded viewport rect, as SetViewport/SetViewport2 store it.
  (func (export "test_vpc_viewport") (param $device i32)
      (param $x i32) (param $y i32) (param $w i32) (param $h i32)
    (local $sw i32)
    (local.set $sw (call $g2w (call $d3ddev_state (local.get $device))))
    (i32.store (i32.add (local.get $sw) (global.get $D3DIM_OFF_VP_RECT)) (local.get $x))
    (i32.store (i32.add (local.get $sw) (i32.add (global.get $D3DIM_OFF_VP_RECT) (i32.const 4))) (local.get $y))
    (i32.store (i32.add (local.get $sw) (i32.add (global.get $D3DIM_OFF_VP_RECT) (i32.const 8))) (local.get $w))
    (i32.store (i32.add (local.get $sw) (i32.add (global.get $D3DIM_OFF_VP_RECT) (i32.const 12))) (local.get $h)))
  ;; TRIANGLELIST (4) of TLVERTEX (3).
  (func (export "test_vpc_draw") (param $device i32) (param $vertices i32) (param $count i32)
    (call $d3dim_draw_primitive (local.get $device) (i32.const 4) (i32.const 3)
      (local.get $vertices) (local.get $count)))
  ;; A draw scope around the exported d3dim_gpu_describe, as a draw has.
  (func (export "test_vpc_clip_begin") (param $device i32)
    (call $d3dim_clip_begin (local.get $device)))
  (func (export "test_vpc_clip_end") (call $d3dim_clip_end))
  (func (export "test_vpc_clip_on") (result i32) (global.get $d3dim_clip_on))
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
  assert.strictEqual(wat.test_vpc_create_surface(desc, out) >>> 0, 0);
  return wat.guest_read32(out) >>> 0;
}

(async () => {
  const { exports: wat, memory } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const mem = () => new DataView(memory.buffer);
  const desc = 0x410000, out = 0x410100, devOut = 0x410110, vertices = 0x411000;
  const W = 16, RED = 0xf800;

  wat.test_vpc_seed(0x51000000, 0x52000000, 0x53000000);
  const rt = makeSurface(wat, desc, out, W, W);
  assert.strictEqual(wat.test_vpc_create_device(rt, devOut) >>> 0, 0);
  const device = wat.guest_read32(devOut) >>> 0;
  const dib = wat.test_vpc_dib(rt) >>> 0, pitch = wat.test_vpc_pitch(rt);
  wat.test_vpc_set_rs(device, 26, 0);   // no dither: exact colours
  wat.test_vpc_set_rs(device, 22, 1);   // no culling: winding does not matter here

  const f32 = new DataView(new ArrayBuffer(4));
  const float = (addr, v) => { f32.setFloat32(0, v, true); wat.guest_write32(addr, f32.getUint32(0, true)); };
  // Two triangles covering the whole 16x16 target, opaque red.
  const corners = [[0, 0], [W, 0], [0, W], [W, 0], [W, W], [0, W]];
  corners.forEach(([x, y], i) => {
    const p = vertices + i * 32;
    float(p, x); float(p + 4, y); float(p + 8, 0.5); float(p + 12, 1);
    wat.guest_write32(p + 16, 0xffff0000); wat.guest_write32(p + 20, 0);
    float(p + 24, 0); float(p + 28, 0);
  });
  const clear = () => { const m = mem(); for (let i = 0; i < W * pitch; i += 2) m.setUint16(dib + i, 0, true); };
  const px = (x, y) => mem().getUint16(dib + y * pitch + x * 2, true);
  const drawn = () => { let n = 0; for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (px(x, y) === RED) n++; return n; };

  // No viewport recorded: the whole target.
  clear();
  wat.test_vpc_draw(device, vertices, 6);
  assert.strictEqual(drawn(), W * W, 'no viewport: the quad covers the whole target');
  assert.strictEqual(wat.test_vpc_clip_on(), 0, 'no clip outside a draw');

  // Viewport x=4..11, y=2..9 (8x8 at 4,2): nothing outside it changes.
  wat.test_vpc_viewport(device, 4, 2, 8, 8);
  clear();
  wat.test_vpc_draw(device, vertices, 6);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const inside = x >= 4 && x < 12 && y >= 2 && y < 10;
    assert.strictEqual(px(x, y) === RED, inside,
      `viewport 4,2 8x8: pixel ${x},${y} ${inside ? 'inside must be drawn' : 'outside must stay clear'}`);
  }
  assert.strictEqual(wat.test_vpc_clip_on(), 0, 'the clip ends with the draw');

  // A viewport running past the target is clipped to the target.
  wat.test_vpc_viewport(device, 10, 10, 100, 100);
  clear();
  wat.test_vpc_draw(device, vertices, 6);
  assert.strictEqual(drawn(), 6 * 6, 'viewport past the target: only its on-target part');

  // The viewport covering the whole target is no clip at all.
  wat.test_vpc_viewport(device, 0, 0, W, W);
  clear();
  wat.test_vpc_draw(device, vertices, 6);
  assert.strictEqual(drawn(), W * W, 'full-target viewport: whole target');

  // The WebGL executor sees the same rectangle (descriptor fields 34-38).
  wat.test_vpc_viewport(device, 4, 2, 8, 8);
  wat.test_vpc_clip_begin(device);
  const d = wat.d3dim_gpu_describe(device) >>> 0;
  wat.test_vpc_clip_end();
  assert.ok(d, 'describe returned a descriptor');
  const field = i => mem().getUint32(d + i * 4, true);
  assert.deepStrictEqual([field(34), field(35), field(36), field(37), field(38)], [1, 4, 2, 12, 10],
    'describe publishes the draw clip as on, x0, y0, x1, y1');
  assert.strictEqual(wat.test_vpc_clip_on(), 0, 'no clip after the described draw');
  // The executor describes queued draws later, outside any draw scope: the
  // clip must come from the device state, not from the draw-scope globals.
  const q = wat.d3dim_gpu_describe(device) >>> 0;
  assert.deepStrictEqual([field(34), field(35), field(36), field(37), field(38)].map((_, i) =>
    mem().getUint32(q + (34 + i) * 4, true)), [1, 4, 2, 12, 10],
    'describe outside a draw still publishes the viewport clip');
  assert.strictEqual(wat.test_vpc_clip_on(), 0, 'describing does not open a draw clip');
  wat.test_vpc_viewport(device, 0, 0, 0, 0);
  assert.strictEqual(mem().getUint32((wat.d3dim_gpu_describe(device) >>> 0) + 34 * 4, true), 0,
    'no viewport: describe publishes no clip');

  console.log('PASS test-d3dim-viewport-clip');
})().catch(e => { console.error(e); process.exit(1); });
