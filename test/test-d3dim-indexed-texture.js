#!/usr/bin/env node
'use strict';

// Device3 DrawIndexedPrimitive must take the same bound-texture path as
// DrawPrimitive. MW3 obtains a legacy Texture2 handle, binds it through
// D3DRENDERSTATE_TEXTUREHANDLE, then submits its world as indexed vertices.
// Both halves of that authentic chain are covered here: bypassing either one
// produces recognizable terrain geometry with every texture removed.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');
const apiTable = require('../src/api_table.json');

const extraWat = String.raw`
  (func (export "test_diptex_seed")
      (param $ddraw_vtbl i32) (param $surface_vtbl i32) (param $device_vtbl i32)
    (global.set $DX_VTBL_DDRAW (local.get $ddraw_vtbl))
    (global.set $DX_VTBL_DDSURF2 (local.get $surface_vtbl))
    (global.set $DX_VTBL_D3DDEV1 (local.get $device_vtbl)))

  (func (export "test_diptex_create_surface") (param $desc i32) (param $out i32) (result i32)
    (local $ddraw i32)
    (local.set $ddraw (call $dx_create_com_obj (i32.const 1) (global.get $DX_VTBL_DDRAW)))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDraw_CreateSurface
      (local.get $ddraw) (local.get $desc) (local.get $out) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_diptex_create_device") (param $surface i32) (param $out i32) (result i32)
    ;; Legacy creation policy deliberately permits viewports larger than this
    ;; tiny raster target. Strict Device2/3 setters have separate coverage.
    (call $d3dim_create_device
      (i32.const 0) (local.get $surface) (local.get $out) (global.get $DX_VTBL_D3DDEV1))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_diptex_create_viewport") (result i32)
    (call $dx_create_com_obj (i32.const 23) (i32.const 0x54000000)))

  (func (export "test_diptex_attach_viewport") (param $device i32) (param $viewport i32)
    (i32.store offset=8 (call $dx_from_this (local.get $viewport)) (local.get $device)))

  (func (export "test_diptex_set_current_viewport") (param $device i32) (param $viewport i32)
    (call $d3dim_set_current_viewport (local.get $device) (local.get $viewport)))

  (func (export "test_diptex_set_viewport") (param $viewport i32) (param $desc i32)
    (call $d3dim_viewport_set (local.get $viewport) (local.get $desc)))
  (export "test_diptex_set_viewport2" (func $d3dim_viewport_set2))
  (export "test_diptex_set_viewport7" (func $d3dim_device7_set_viewport))
  (func (export "test_diptex_project_clip") (param $device i32) (param $vertex i32)
      (param $out i32) (param $header i32) (param $w f32)
    (local $state i32) (local $sw i32)
    (local.set $state (call $d3ddev_state (local.get $device)))
    (local.set $sw (call $g2w (local.get $state)))
    (call $d3ddev_composite_wvp (local.get $state))
    (f32.store offset=252 (local.get $sw) (local.get $w))
    (call $vertex_project (local.get $state) (call $g2w (local.get $vertex)) (call $g2w (local.get $out)))
    (call $d3dim_exec_clip_status (local.get $header) (i32.add (local.get $sw) (i32.const 4064))))
  (func (export "test_diptex_snapshot") (param $device i32) (param $out i32)
    (memory.copy (call $g2w (local.get $out)) (call $g2w (call $d3ddev_state (local.get $device))) (i32.const 4096)))
  (func (export "test_diptex_override") (param $snapshot i32)
    (global.set $d3dim_state_override (local.get $snapshot)))
  (func (export "test_diptex_point") (param $device i32) (param $vertex i32)
    (call $d3dim_draw_primitive (local.get $device) (i32.const 1) (i32.const 2) (local.get $vertex) (i32.const 1)))

  (func (export "test_diptex_viewport_state")
      (param $device i32) (param $index i32) (result i32)
    (call $gl32 (i32.add
      (call $d3ddev_state (local.get $device))
      (i32.add (global.get $D3DIM_OFF_VP_RECT) (i32.mul (local.get $index) (i32.const 4))))))

  (func (export "test_diptex_current_viewport") (param $device i32) (result i32)
    (call $gl32 (i32.add (call $d3ddev_state (local.get $device))
      (global.get $D3DIM_OFF_CUR_VP))))

  (func (export "test_diptex_viewport_slot") (param $viewport i32) (result i32)
    (call $dx_slot_of (call $dx_from_this (local.get $viewport))))

  (func (export "test_diptex_dib") (param $surface i32) (result i32)
    (i32.load offset=20 (call $dx_from_this (local.get $surface))))

  (func (export "test_diptex_format") (param $surface i32) (result i32)
    (call $dx_surf_fmt_get (call $dx_from_this (local.get $surface))))

  (func (export "test_diptex_get_handle")
      (param $api i32) (param $texture i32) (param $device i32) (param $out i32)
      (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $dispatch_api_table
      (local.get $api) (local.get $texture) (local.get $device)
      (local.get $out) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_diptex_esp") (result i32) (i32.load offset=16 (global.get $reg_base)))

  (func (export "test_diptex_bind_handle") (param $device i32) (param $handle i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirect3DDevice3_SetRenderState
      (local.get $device) (i32.const 1) (local.get $handle)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_diptex_set_rs") (param $device i32) (param $state i32) (param $value i32)
    (call $d3dim_set_render_state (local.get $device) (local.get $state) (local.get $value)))

  (func (export "test_diptex_set_tss") (param $device i32) (param $type i32) (param $value i32)
    (call $d3dim_set_tss (local.get $device) (i32.const 0) (local.get $type) (local.get $value)))

  (func (export "test_diptex_set_colorkey") (param $surface i32) (param $key i32)
    (local $entry i32)
    (local.set $entry (call $dx_from_this (local.get $surface)))
    (i32.store offset=24 (local.get $entry) (local.get $key))
    (i32.store offset=28 (local.get $entry)
      (i32.or (i32.load offset=28 (local.get $entry)) (i32.const 0x100))))

  (func (export "test_diptex_load") (param $dst i32) (param $src i32)
    (call $d3dim_texture_load (local.get $dst) (local.get $src)))

  (func (export "test_diptex_colorkey") (param $surface i32) (result i32)
    (i32.load offset=24 (call $dx_from_this (local.get $surface))))

  (func (export "test_diptex_flags") (param $surface i32) (result i32)
    (i32.load offset=28 (call $dx_from_this (local.get $surface))))

  (func (export "test_diptex_clip_depth")
      (param $device i32) (param $a i32) (param $b i32) (param $out i32) (param $plane i32)
    (local $state i32) (local $sw i32)
    (local.set $state (call $d3ddev_state (local.get $device)))
    (local.set $sw (call $g2w (local.get $state)))
    (f32.store (i32.add (local.get $sw) (global.get $D3DIM_OFF_VP_SCALE)) (f32.const 4.0))
    (f32.store (i32.add (local.get $sw)
      (i32.add (global.get $D3DIM_OFF_VP_SCALE) (i32.const 4))) (f32.const 4.0))
    (f32.store (i32.add (local.get $sw) (global.get $D3DIM_OFF_VP_ORIGIN)) (f32.const 4.0))
    (f32.store (i32.add (local.get $sw)
      (i32.add (global.get $D3DIM_OFF_VP_ORIGIN) (i32.const 4))) (f32.const 4.0))
    (call $d3dim_interp_tl_clip_vertex
      (local.get $state) (call $g2w (local.get $a)) (call $g2w (local.get $b))
      (call $g2w (local.get $out)) (local.get $plane)))

  (func (export "test_diptex_lvertex_stride") (result i32)
    (call $d3dim_vertex_type_stride (i32.const 2)))

  (func (export "test_diptex_prepare_lvertices")
      (param $device i32) (param $vertices i32) (param $prepared i32)
    (local $state i32) (local $src i32) (local $dst i32) (local $stride i32)
    (local.set $state (call $d3ddev_state (local.get $device)))
    (call $d3ddev_composite_wvp (local.get $state))
    (local.set $src (call $g2w (local.get $vertices)))
    (local.set $dst (call $g2w (local.get $prepared)))
    (local.set $stride (call $d3dim_vertex_type_stride (i32.const 2)))
    (call $d3dim_prepare_draw_vertex
      (local.get $state) (i32.const 2) (local.get $src) (local.get $dst))
    (call $d3dim_prepare_draw_vertex
      (local.get $state) (i32.const 2)
      (i32.add (local.get $src) (local.get $stride))
      (i32.add (local.get $dst) (i32.const 32))))

  (func (export "test_diptex_get_tss") (param $device i32) (param $type i32) (param $out i32) (result i32)
    (call $d3dim_get_tss (local.get $device) (i32.const 0) (local.get $type) (local.get $out))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_diptex_attach") (param $parent i32) (param $child i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDrawSurface_AddAttachedSurface
      (local.get $parent) (local.get $child)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_diptex_draw")
      (param $device i32) (param $vertices i32) (param $indices i32)
    ;; Direct handler calls still read the tail arguments from the guest stack.
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $gs32 (i32.const 0x30014) (i32.const 3))
    (call $gs32 (i32.const 0x30018) (local.get $indices))
    (call $gs32 (i32.const 0x3001c) (i32.const 3))
    (call $handle_IDirect3DDevice3_DrawIndexedPrimitive
      (local.get $device) (i32.const 4) (i32.const 0x3c4)
      (local.get $vertices) (i32.const 3) (i32.const 0)))

  (func (export "test_diptex_draw_tl_triangle")
      (param $device i32) (param $rt i32) (param $vertices i32)
    (call $d3dim_draw_tl_triangle_dp
      (local.get $device) (call $dx_from_this (local.get $rt)) (i32.const 0)
      (call $g2w (local.get $vertices))
      (call $g2w (i32.add (local.get $vertices) (i32.const 48)))
      (call $g2w (i32.add (local.get $vertices) (i32.const 96)))))

  (func (export "test_diptex_draw_wrapped_span")
      (param $rt i32) (param $texture i32)
    (call $viewport_draw_textured_span
      (call $dx_from_this (local.get $rt))
      (call $dx_from_this (local.get $texture))
      (i32.const 0) (i32.const 2) (i32.const 1)
      (i32.const 1) (i32.const 3) (i32.const 0)
      (i32.const 2) (i32.const 2) (i32.const 0)
      (i32.const 0)
      (i32.const 0) (i32.const 0)
      (i32.const 0)
      (i32.const 0) (f32.const 0.0) (f32.const 0.0) (f32.const 1.0) (i32.const 0xffffffff) (f32.const 0.5)
      (i32.const 4) (f32.const 1.0) (f32.const 0.0) (f32.const 1.0) (i32.const 0xffffffff) (f32.const 0.5)
      (i32.const 0) (i32.const 8) (i32.const 0)))

  (func (export "test_diptex_caps") (param $api i32) (param $device i32)
      (param $hw i32) (param $hel i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $dispatch_api_table (local.get $api) (local.get $device)
      (local.get $hw) (local.get $hel) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))

  (func (export "test_diptex_sample")
      (param $texture i32) (param $u f32) (param $v f32) (param $linear i32) (result i32)
    (local $entry i32)
    (local.set $entry (call $dx_from_this (local.get $texture)))
    (call $d3dim_texture_sample_prepared
      (i32.load16_u offset=12 (local.get $entry))
      (i32.load16_u offset=14 (local.get $entry))
      (i32.load16_u offset=16 (local.get $entry))
      (i32.load16_u offset=18 (local.get $entry))
      (i32.load offset=20 (local.get $entry))
      (call $dx_surf_fmt_get (local.get $entry))
      (call $dx_surf_pal_get (local.get $entry))
      (call $dx_surf_pal_alpha (local.get $entry))
      (local.get $u) (local.get $v)
      (i32.const 1) (i32.const 1) (local.get $linear)))
`;

// MW3 submits D3DFVF_XYZRHW|DIFFUSE|SPECULAR|TEX3. TEX3 makes each source
// vertex 48 bytes, and TEXCOORDINDEX changes which of its three UV sets feeds
// stage 0 for base/detail/light-map passes. Treating it as a 32-byte
// D3DTLVERTEX shifts vertex 1/2 onto texture data and produces screen sheets;
// always copying UV0 makes later passes visibly swim across the base texture.
const VERTEX_STRIDE = 48;

function makeSurface(wat, desc, out, width, height, format = {}) {
  const {
    flags = 0x40,
    bpp = 16,
    rMask = 0xf800,
    gMask = 0x07e0,
    bMask = 0x001f,
    aMask = 0,
    caps = 0x40,
  } = format;
  for (let i = 0; i < 128; i += 4) wat.guest_write32(desc + i, 0);
  wat.guest_write32(desc, 108);
  wat.guest_write32(desc + 4, 0x1007); // CAPS|HEIGHT|WIDTH|PIXELFORMAT
  wat.guest_write32(desc + 8, height);
  wat.guest_write32(desc + 12, width);
  wat.guest_write32(desc + 72, 32);
  wat.guest_write32(desc + 76, flags);
  wat.guest_write32(desc + 84, bpp);
  wat.guest_write32(desc + 88, rMask);
  wat.guest_write32(desc + 92, gMask);
  wat.guest_write32(desc + 96, bMask);
  wat.guest_write32(desc + 100, aMask);
  wat.guest_write32(desc + 104, caps);
  assert.strictEqual(wat.test_diptex_create_surface(desc, out) >>> 0, 0);
  return wat.guest_read32(out) >>> 0;
}

function writeFloat(wat, addr, value) {
  const bits = new ArrayBuffer(4);
  new DataView(bits).setFloat32(0, value, true);
  wat.guest_write32(addr, new DataView(bits).getUint32(0, true));
}

(async () => {
  const textureApi = apiTable.find(entry =>
    entry.name === 'IDirect3DTexture_GetHandle');
  const texture2Api = apiTable.find(entry =>
    entry.name === 'IDirect3DTexture2_GetHandle');
  assert(textureApi && texture2Api,
    'both public legacy texture-handle APIs remain registered');
  assert.strictEqual(textureApi.id, 1476, 'Texture GetHandle API id remains stable');
  assert.strictEqual(texture2Api.id, 1483, 'Texture2 GetHandle API id remains stable');
  assert.strictEqual(textureApi.nargs, 5);
  assert.strictEqual(texture2Api.nargs, 5);
  assert.strictEqual(texture2Api.handler, 'IDirect3DTexture_GetHandle',
    'Texture2 dispatch aliases the canonical texture-handle implementation');

  const root = path.join(__dirname, '..');
  const dispatch = fs.readFileSync(
    path.join(root, 'src/09b2-dispatch-table.generated.wat'), 'utf8');
  assert.match(dispatch,
    /;; 1483: IDirect3DTexture2_GetHandle[\s\S]*?call \$handle_IDirect3DTexture_GetHandle/,
    'generated dispatch routes Texture2 GetHandle through the canonical handler');
  const d3dimSource = fs.readFileSync(
    path.join(root, 'src/09aa-handlers-d3dim.wat'), 'utf8');
  assert(!d3dimSource.includes('(func $handle_IDirect3DTexture2_GetHandle'),
    'the duplicate Texture2 GetHandle wrapper is absent');

  const h = await bootRenderHarness({ extraWat, fonts: 'none' });
  const { exports: wat, memory } = h;
  const mem = new DataView(memory.buffer);
  const desc = 0x410000;
  const out = 0x410100;
  const devOut = 0x410110;
  const vertices = 0x411000;
  const indices = 0x411100;
  const lvertices = 0x412000;
  const lprepared = 0x412100;
  const clipVertices = 0x412200;

  wat.test_diptex_seed(0x51000000, 0x52000000, 0x53000000);
  const rt = makeSurface(wat, desc, out, 8, 8);
  const texture = makeSurface(wat, desc, out + 4, 2, 2);
  assert(rt && texture);

  // MCM creates its HUD in a keyed RGB565 system-memory surface, then loads
  // it into a distinct RGB555 texture. Texture::Load must carry and convert
  // the key metadata as well as the pixels, because only the destination is
  // subsequently bound for rendering.
  const loadedTexture = makeSurface(wat, desc, out + 24, 2, 2, {
    rMask: 0x7c00,
    gMask: 0x03e0,
    bMask: 0x001f,
  });
  wat.test_diptex_set_colorkey(texture, 0xf81f);
  wat.test_diptex_load(loadedTexture, texture);
  assert(wat.test_diptex_flags(loadedTexture) & 0x100,
    'Texture::Load dropped the source color-key flag');
  assert.strictEqual(wat.test_diptex_colorkey(loadedTexture), 0x7c1f,
    'Texture::Load did not convert the source color key to the destination format');
  assert.strictEqual(wat.test_diptex_create_device(rt, devOut) >>> 0, 0);
  const device = wat.guest_read32(devOut) >>> 0;
  assert(device);
  const rtDib = wat.test_diptex_dib(rt) >>> 0;

  // D3D viewport rectangles belong to viewport objects, not globally to the
  // device. MCM configures a 128x128 texture viewport after its 640x480 race
  // viewport; updating the inactive object must not compress every subsequent
  // world projection into the upper-left corner. Selecting either viewport
  // must restore that object's saved rectangle into the transform cache.
  const largeViewport = wat.test_diptex_create_viewport() >>> 0;
  const smallViewport = wat.test_diptex_create_viewport() >>> 0;
  const vpDesc = 0x410200;
  const setViewportDesc = (width, height) => {
    wat.guest_write32(vpDesc, 44); // sizeof(D3DVIEWPORT)
    wat.guest_write32(vpDesc + 4, 0);
    wat.guest_write32(vpDesc + 8, 0);
    wat.guest_write32(vpDesc + 12, width);
    wat.guest_write32(vpDesc + 16, height);
    writeFloat(wat, vpDesc + 20, width / 2);
    writeFloat(wat, vpDesc + 24, height / 2);
  };
  wat.test_diptex_attach_viewport(device, largeViewport);
  wat.test_diptex_attach_viewport(device, smallViewport);
  wat.test_diptex_set_current_viewport(device, largeViewport);
  setViewportDesc(640, 480);
  wat.test_diptex_set_viewport(largeViewport, vpDesc);
  setViewportDesc(128, 128);
  wat.test_diptex_set_viewport(smallViewport, vpDesc);
  assert.deepStrictEqual([
    wat.test_diptex_current_viewport(device),
    wat.test_diptex_viewport_slot(largeViewport),
    wat.test_diptex_viewport_state(device, 2),
    wat.test_diptex_viewport_state(device, 3),
  ], [wat.test_diptex_viewport_slot(largeViewport), wat.test_diptex_viewport_slot(largeViewport), 640, 480],
  'inactive texture viewport replaced the race transform viewport');
  wat.test_diptex_set_current_viewport(device, smallViewport);
  assert.deepStrictEqual([
    wat.test_diptex_viewport_state(device, 2),
    wat.test_diptex_viewport_state(device, 3),
  ], [128, 128], 'selecting the texture viewport did not restore its rectangle');
  wat.test_diptex_set_current_viewport(device, largeViewport);
  assert.deepStrictEqual([
    wat.test_diptex_viewport_state(device, 2),
    wat.test_diptex_viewport_state(device, 3),
  ], [640, 480], 'reselecting the race viewport did not restore its rectangle');

  // D3DLVERTEX is eight DWORDs: xyz, a reserved DWORD, diffuse, specular,
  // then uv. MCM writes that authentic 32-byte layout. A 28-byte stride makes
  // every vertex after the first begin at the previous vertex's tv field,
  // while reading diffuse at +12 mistakes dwReserved for the colour.
  const lvertex = (i, x, color, specular, u, v) => {
    const p = lvertices + i * 32;
    writeFloat(wat, p + 0, x);
    writeFloat(wat, p + 4, 0);
    writeFloat(wat, p + 8, 0.5);
    wat.guest_write32(p + 12, i ? 0xcafebabe : 0xdeadbeef);
    wat.guest_write32(p + 16, color);
    wat.guest_write32(p + 20, specular);
    writeFloat(wat, p + 24, u);
    writeFloat(wat, p + 28, v);
  };
  lvertex(0, -0.5, 0xffc02010, 0x10203040, 0.25, 0.5);
  lvertex(1, 0.5, 0xff10c020, 0x50607080, 0.75, 1.0);
  assert.strictEqual(wat.test_diptex_lvertex_stride(), 32,
    'D3DLVERTEX omitted its reserved DWORD from the vertex stride');
  wat.test_diptex_prepare_lvertices(device, lvertices, lprepared);
  assert.deepStrictEqual([
    wat.guest_read32(lprepared + 16) >>> 0,
    wat.guest_read32(lprepared + 20) >>> 0,
    wat.guest_read32(lprepared + 24) >>> 0,
    wat.guest_read32(lprepared + 28) >>> 0,
    wat.guest_read32(lprepared + 32 + 16) >>> 0,
    wat.guest_read32(lprepared + 32 + 20) >>> 0,
    wat.guest_read32(lprepared + 32 + 24) >>> 0,
    wat.guest_read32(lprepared + 32 + 28) >>> 0,
  ], [
    0xffc02010, 0x10203040, 0x3e800000, 0x3f000000,
    0xff10c020, 0x50607080, 0x3f400000, 0x3f800000,
  ], 'legacy lit vertices lost their diffuse/specular/uv fields or 32-byte boundary');

  // Identity WVP, but an off-centre clip volume [1,3] x [0,2], z [.25,.75].
  // Its centre is screen(4,4), not the default volume's off-target (12,0).
  const customViewport = () => {
    [44,0,0,8,8].forEach((n,i)=>wat.guest_write32(vpDesc+i*4,n));
    [1,2,2,2,0.25,0.75].forEach((n,i)=>writeFloat(wat,vpDesc+20+i*4,n));
    wat.test_diptex_set_viewport2(largeViewport,vpDesc);
  };
  customViewport();
  lvertex(0,2,0xffff0000,0,0,0);
  writeFloat(wat,lvertices+4,1);
  writeFloat(wat,lvertices+8,0.375);
  const preparedXYZ=()=>[0,4,8,12].map(n=>mem.getFloat32(wat.guest_to_wasm(lprepared)+n,true));
  wat.test_diptex_prepare_lvertices(device,lvertices,lprepared);
  assert.deepStrictEqual(preparedXYZ(),[4,4,0.25,1],'clip volume must affect homogeneous projection');
  new Uint8Array(memory.buffer,rtDib,8*8*2).fill(0);
  wat.test_diptex_point(device,lvertices);
  assert.notStrictEqual(mem.getUint16(rtDib+(4*8+4)*2,true),0,'custom-volume point reaches the render target');
  const clipHeader = wat.guest_alloc(32);
  const projectClip = (xyz, w = 1) => {
    xyz.forEach((n, i) => writeFloat(wat, lvertices + i * 4, n));
    wat.guest_write32(clipHeader + 12, 0x3f000);
    wat.test_diptex_project_clip(device, lvertices, lprepared, clipHeader, w);
    return wat.guest_read32(clipHeader + 12) >>> 0;
  };
  for (const [xyz, code] of [
    [[2,1,.5],0], [[.5,1,.5],1], [[3.5,1,.5],2],
    [[2,2.5,.5],4], [[2,-.5,.5],8], [[2,1,.125],16], [[2,1,.875],32],
  ]) {
    assert.strictEqual(projectClip(xyz), code | (code << 12), `custom clip planes: ${xyz}`);
  }
  assert.strictEqual(projectClip([-2,-1,-.375], -1), 0x3f03f, 'negative w remains outside all six planes');
  assert.deepStrictEqual(preparedXYZ(), [4,4,.25,-1], 'clip translations must scale with negative w');
  projectClip([2,1,.375]);
  for (const [offset, value, isFloat] of [
    [12,0,false], [16,0,false], [28,0,true], [32,0,true], [40,.25,true],
  ]) {
    customViewport();
    if (isFloat) writeFloat(wat,vpDesc+offset,value);
    else wat.guest_write32(vpDesc+offset,value);
    wat.test_diptex_set_viewport2(largeViewport,vpDesc);
    wat.test_diptex_prepare_lvertices(device,lvertices,lprepared);
    assert.deepStrictEqual(preparedXYZ(),[4,4,.25,1],`degenerate field ${offset} preserves transform cache`);
  }
  customViewport();
  const snapshot=wat.guest_alloc(4096);
  wat.test_diptex_snapshot(device,snapshot);
  setViewportDesc(8,8);wat.test_diptex_set_viewport(largeViewport,vpDesc);
  wat.test_diptex_prepare_lvertices(device,lvertices,lprepared);
  assert.deepStrictEqual(preparedXYZ(),[12,0,0.375,1],'default volume clears the custom transform');
  wat.test_diptex_override(snapshot);
  wat.test_diptex_prepare_lvertices(device,lvertices,lprepared);
  assert.deepStrictEqual(preparedXYZ(),[4,4,0.25,1],'queued snapshot must not read the live viewport descriptor');
  wat.test_diptex_override(0);
  customViewport();wat.test_diptex_set_current_viewport(device,smallViewport);
  wat.test_diptex_prepare_lvertices(device,lvertices,lprepared);
  assert.deepStrictEqual(preparedXYZ(),[192,0,0.375,1],'switching restores the other viewport transform');
  wat.test_diptex_set_current_viewport(device,largeViewport);
  wat.test_diptex_prepare_lvertices(device,lvertices,lprepared);
  assert.deepStrictEqual(preparedXYZ(),[4,4,0.25,1]);
  // Device7 uses its own normalized clip volume, never a stale legacy one.
  const vp7 = wat.guest_alloc(24);
  [0,0,8,8,0,0x3f800000].forEach((n,i)=>wat.guest_write32(vp7+i*4,n));
  wat.test_diptex_set_viewport7(device,vp7);
  wat.test_diptex_prepare_lvertices(device,lvertices,lprepared);
  assert.deepStrictEqual(preparedXYZ(),[12,0,.375,1]);
  setViewportDesc(8,8);
  writeFloat(wat,vpDesc+20,2);
  writeFloat(wat,vpDesc+24,1);
  wat.test_diptex_set_viewport(largeViewport,vpDesc);
  projectClip([.5,.5,.375]);
  assert.deepStrictEqual(preparedXYZ(),[5,3.5,.375,1],'legacy nondefault scales must affect projection');
  setViewportDesc(640,480);wat.test_diptex_set_viewport(largeViewport,vpDesc);

  // The direct DrawPrimitive path receives projected vertices, so its near
  // clipper reconstructs homogeneous coordinates from screen xy, z/w and
  // 1/w. This edge crosses z=0 at t=.2 while w remains positive (.6).
  // Missing clipping leaves camera-near MCM terrain as an old-frame hole.
  const clipVertex = (p, z, q, u, color) => {
    writeFloat(wat, p + 0, 0);
    writeFloat(wat, p + 4, 4);
    writeFloat(wat, p + 8, z);
    writeFloat(wat, p + 12, q);
    wat.guest_write32(p + 16, color);
    wat.guest_write32(p + 20, 0);
    writeFloat(wat, p + 24, u);
    writeFloat(wat, p + 28, 0);
  };
  clipVertex(clipVertices, 0.25, 1.0, 0.0, 0xff000000);
  clipVertex(clipVertices + 32, 1.0, -1.0, 1.0, 0xffffffff);
  wat.test_diptex_clip_depth(device, clipVertices, clipVertices + 32, clipVertices + 64, 0);
  const clipOut = clipVertices + 64;
  const clipFloat = offset => {
    const bits = new ArrayBuffer(4);
    new DataView(bits).setUint32(0, wat.guest_read32(clipOut + offset), true);
    return new DataView(bits).getFloat32(0, true);
  };
  assert(Math.abs(clipFloat(0) - 0) < 0.001 && Math.abs(clipFloat(4) - 4) < 0.001,
    `near-plane intersection did not preserve the projected edge position (${clipFloat(0)},${clipFloat(4)})`);
  assert.strictEqual(clipFloat(8), 0, 'near-plane intersection did not land at z=0');
  assert(Math.abs(clipFloat(12) - (5 / 3)) < 0.001,
    'near-plane intersection did not retain positive reciprocal W');
  assert(Math.abs(clipFloat(24) - 0.2) < 0.001,
    'near-plane intersection did not interpolate texture coordinates');

  // A four-colour RGB565 texture.  The surface pitch can exceed width*2, so
  // seed it through its actual DX entry metadata rather than assuming 4 bytes.
  const texDib = wat.test_diptex_dib(texture) >>> 0;
  // DirectDraw's 2x2 allocation uses a DWORD-aligned 4-byte pitch.
  mem.setUint16(texDib + 0, 0xf800, true); // red
  mem.setUint16(texDib + 2, 0x07e0, true); // green
  mem.setUint16(texDib + 4, 0x001f, true); // blue
  mem.setUint16(texDib + 6, 0xffe0, true); // yellow

  // MW3's third terrain pass selects TEX2 even when the game left that pair
  // as NaN/Infinity. Its bound texture is uniformly white, so the pass must be
  // a no-op. Before non-finite UV canonicalization, linear filtering fetched
  // four valid texels but fed NaN weights into packed colour interpolation;
  // trunc_sat converted every channel to zero and erased the foreground.
  for (let i = 0; i < 4; i++) mem.setUint16(texDib + i * 2, 0xf800, true);
  assert.strictEqual(wat.test_diptex_sample(texture, NaN, Infinity, 1) >>> 0, 0xffff0000,
    'linear filtering turned a uniform texture black for non-finite UVs');
  mem.setUint16(texDib + 0, 0xf800, true);
  mem.setUint16(texDib + 2, 0x07e0, true);
  mem.setUint16(texDib + 4, 0x001f, true);
  mem.setUint16(texDib + 6, 0xffe0, true);

  // Three TL vertices covering the upper-left half of the 8x8 target.
  const vertex = (i, x, y, u, v) => {
    const p = vertices + i * VERTEX_STRIDE;
    writeFloat(wat, p + 0, x);
    writeFloat(wat, p + 4, y);
    writeFloat(wat, p + 8, 0.5);
    writeFloat(wat, p + 12, 1.0);
    // Half-intensity diffuse verifies the fixed-function MODULATE path used
    // for MW3's lighting, not merely that raw texture texels are copied.
    wat.guest_write32(p + 16, 0xff808080);
    wat.guest_write32(p + 20, 0);
    writeFloat(wat, p + 24, u);
    writeFloat(wat, p + 28, v);
    // Additional TEX1/TEX2 coordinates are selected into the canonical stage-0
    // pair according to D3DTSS_TEXCOORDINDEX.
    writeFloat(wat, p + 32, 0.25);
    writeFloat(wat, p + 36, 0.50);
    writeFloat(wat, p + 40, 0.75);
    writeFloat(wat, p + 44, 1.00);
  };
  vertex(0, 0, 0, 0.05, 0.05);
  vertex(1, 7, 0, 0.95, 0.05);
  vertex(2, 0, 7, 0.05, 0.95);
  wat.guest_write32(indices, 0x00010000); // u16 indices 0,1
  wat.guest_write32(indices + 4, 0x00000002); // u16 index 2

  // A tall texture catches samplers that use width for the V coordinate.
  // Exercise normal surface creation, GetHandle, binding and indexed drawing;
  // sampling only a square texture cannot substantiate the capability report.
  const rectangle = makeSurface(wat, desc, out + 12, 2, 4);
  const rectangleDib = wat.test_diptex_dib(rectangle) >>> 0;
  const rectangleRows = [0xf800, 0x07e0, 0x001f, 0xffe0];
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 2; x++) mem.setUint16(rectangleDib + y * 4 + x * 2, rectangleRows[y], true);
  }
  for (const [row, rgba] of [[0, 0xffff0000], [1, 0xff00ff00], [2, 0xff0000ff], [3, 0xffffff00]]) {
    assert.strictEqual(wat.test_diptex_sample(rectangle, 0.25, (row + 0.5) / 4, 0) >>> 0, rgba,
      'rectangular texture row ' + row + ' uses its own height');
  }
  assert.strictEqual(wat.test_diptex_get_handle(texture2Api.id, rectangle, device, out + 16), 0);
  assert.strictEqual(wat.test_diptex_bind_handle(device, wat.guest_read32(out + 16)), 0);
  for (let i = 0; i < 3; i++) {
    wat.guest_write32(vertices + i * VERTEX_STRIDE + 16, 0xffffffff);
    writeFloat(wat, vertices + i * VERTEX_STRIDE + 24, 0.25);
    writeFloat(wat, vertices + i * VERTEX_STRIDE + 28, 0.875);
  }
  new Uint8Array(memory.buffer, rtDib, 8 * 8 * 2).fill(0);
  wat.test_diptex_draw(device, vertices, indices);
  assert.strictEqual(mem.getUint16(rtDib + 16 + 2, true), 0xffe0,
    'indexed draw samples the fourth row of a 2x4 texture');
  console.log('[rectangular-texture] CreateSurface, four rows and fourth-row indexed draw passed');
  vertex(0, 0, 0, 0.05, 0.05);
  vertex(1, 7, 0, 0.95, 0.05);
  vertex(2, 0, 7, 0.05, 0.95);
  new Uint8Array(memory.buffer, rtDib, 8 * 8 * 2).fill(0);

  // Public legacy and D3D7 GetCaps must describe the same rectangular
  // texture support exercised below. SQUAREONLY is a restriction, not a
  // feature to include in an otherwise generous capability mask.
  const capsHW = wat.guest_alloc(256), capsHEL = wat.guest_alloc(256);
  for (const [name, is7] of [
    ['IDirect3DDevice_GetCaps', false], ['IDirect3DDevice2_GetCaps', false],
    ['IDirect3DDevice3_GetCaps', false], ['IDirect3DDevice7_GetCaps', true],
  ]) {
    wat.guest_write32(capsHW, 252); wat.guest_write32(capsHEL, 252);
    const api = apiTable.find(entry => entry.name === name);
    assert(api, name);
    assert.strictEqual(wat.test_diptex_caps(api.id, device, capsHW, is7 ? 0 : capsHEL), 0, name);
    assert.strictEqual(wat.test_diptex_esp(), is7 ? 0x3000c : 0x30010, name + ' stdcall cleanup');
    for (const caps of is7 ? [capsHW] : [capsHW, capsHEL]) {
      for (const offset of is7 ? [36, 92] : [76, 132]) {
        assert.strictEqual(wat.guest_read32(caps + offset) & 0x20, 0,
          name + ' must not require square textures (line and triangle caps)');
      }
    }
  }

  const handleOut = out + 8;
  let textureHandle = 0;
  for (const api of [textureApi, texture2Api]) {
    wat.guest_write32(handleOut, 0xdeadbeef);
    assert.strictEqual(
      wat.test_diptex_get_handle(api.id, texture, device, handleOut) >>> 0, 0,
      `${api.name} returns D3D_OK`);
    const handle = wat.guest_read32(handleOut) >>> 0;
    assert(handle, `${api.name} returned a null handle`);
    if (textureHandle) {
      assert.strictEqual(handle, textureHandle,
        `${api.name} did not return the texture's stable slot handle`);
    } else {
      textureHandle = handle;
    }
    assert.strictEqual(wat.test_diptex_esp() >>> 0, 0x30010,
      `${api.name} pops this, device, output, and return address`);
  }
  assert.strictEqual(wat.test_diptex_bind_handle(device, textureHandle) >>> 0, 0);
  wat.test_diptex_draw(device, vertices, indices);

  const pixels = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) pixels.push(mem.getUint16(rtDib + y * 16 + x * 2, true));
  }
  const textured = new Set(pixels.filter(p => p && p !== 0xffff));
  assert(textured.has(0x8000) || textured.has(0x0400)
      || textured.has(0x0010) || textured.has(0x8400),
    `indexed triangle ignored the bound texture (pixels: ${[...new Set(pixels)].map(p => p.toString(16))})`);

  const clearRt = value => {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) mem.setUint16(rtDib + y * 16 + x * 2, value, true);
    }
  };

  // Globe exposes both of these states in its Render menu. The emulated
  // device advertises them in dwRasterCaps, so changing the state must reach
  // pixels rather than merely changing the application's menu checkmark.
  for (let i = 0; i < 4; i++) mem.setUint16(texDib + i * 2, 0x8410, true);
  for (let i = 0; i < 3; i++) wat.guest_write32(vertices + i * VERTEX_STRIDE + 16, 0xff777777);
  wat.test_diptex_set_rs(device, 2, 0);  // ANTIALIAS=NONE
  wat.test_diptex_set_rs(device, 26, 0); // DITHERENABLE=FALSE
  clearRt(0x001f);
  wat.test_diptex_draw(device, vertices, indices);
  const undithered = Array.from({ length: 64 }, (_, i) => mem.getUint16(rtDib + i * 2, true));
  wat.test_diptex_set_rs(device, 26, 1);
  clearRt(0x001f);
  wat.test_diptex_draw(device, vertices, indices);
  const dithered = Array.from({ length: 64 }, (_, i) => mem.getUint16(rtDib + i * 2, true));
  assert.notDeepStrictEqual(dithered, undithered,
    'D3DRENDERSTATE_DITHERENABLE never reached RGB565 quantization');
  assert(new Set(dithered.filter(p => p !== 0x001f)).size >
      new Set(undithered.filter(p => p !== 0x001f)).size,
    'dithered triangle did not distribute quantization across a Bayer pattern');

  for (let i = 0; i < 4; i++) mem.setUint16(texDib + i * 2, 0xffff, true);
  for (let i = 0; i < 3; i++) wat.guest_write32(vertices + i * VERTEX_STRIDE + 16, 0xffffffff);
  wat.test_diptex_set_rs(device, 26, 0);
  clearRt(0x001f);
  wat.test_diptex_draw(device, vertices, indices);
  const hardEdge = mem.getUint16(rtDib + 2 * 16, true);
  const hardInterior = mem.getUint16(rtDib + 2 * 16 + 2, true);
  wat.test_diptex_set_rs(device, 2, 1); // D3DANTIALIAS_SORTDEPENDENT
  clearRt(0x001f);
  wat.test_diptex_draw(device, vertices, indices);
  const smoothEdge = mem.getUint16(rtDib + 2 * 16, true);
  const smoothInterior = mem.getUint16(rtDib + 2 * 16 + 2, true);
  assert.notStrictEqual(smoothEdge, hardEdge,
    'D3DRENDERSTATE_ANTIALIAS did not blend a polygon boundary');
  assert.notStrictEqual(smoothEdge, 0x001f,
    'anti-aliased boundary discarded the polygon instead of blending it');
  assert.strictEqual(smoothInterior, hardInterior,
    'anti-aliasing changed interior pixels instead of only polygon boundaries');

  // Restore the original texture, vertices and menu-state defaults for the
  // clipping/filter/blend/depth cases below.
  mem.setUint16(texDib + 0, 0xf800, true);
  mem.setUint16(texDib + 2, 0x07e0, true);
  mem.setUint16(texDib + 4, 0x001f, true);
  mem.setUint16(texDib + 6, 0xffe0, true);
  vertex(0, 0, 0, 0.05, 0.05);
  vertex(1, 7, 0, 0.95, 0.05);
  vertex(2, 0, 7, 0.05, 0.95);
  wat.test_diptex_set_rs(device, 2, 0);

  // Positive RHW only proves that a transformed vertex remains in front of
  // the eye. Direct3D's near plane is clip-z=0: this third vertex has w=1 but
  // z/w=-.5, so the triangle must stop halfway down the target. Classifying
  // solely by RHW rasterized the uncut triangle through (6,6), producing the
  // giant terrain wedges and repeated rider-name billboards seen in MCM once
  // its moving camera approached them.
  const nearPlane = [
    [0, 0, 0.5, 1.0, 0.0, 0.0],
    [7, 0, 0.5, 1.0, 1.0, 0.0],
    [7, 7, -0.5, 1.0, 1.0, 1.0],
  ];
  nearPlane.forEach(([x, y, z, q, u, v], i) => {
    const p = vertices + i * VERTEX_STRIDE;
    writeFloat(wat, p + 0, x); writeFloat(wat, p + 4, y);
    writeFloat(wat, p + 8, z); writeFloat(wat, p + 12, q);
    wat.guest_write32(p + 16, 0xffffffff);
    wat.guest_write32(p + 20, 0);
    writeFloat(wat, p + 24, u); writeFloat(wat, p + 28, v);
  });
  clearRt(0x001f);
  wat.test_diptex_draw_tl_triangle(device, rt, vertices);
  assert.notStrictEqual(mem.getUint16(rtDib, true), 0x001f,
    'near-plane clipping discarded the visible half of the triangle');
  assert.strictEqual(mem.getUint16(rtDib + 6 * 16 + 6 * 2, true), 0x001f,
    'positive-RHW vertex behind clip z=0 was rasterized without clipping');

  // A negative-RHW endpoint can lie beyond D3D's far plane while clip-z
  // remains positive.  Such an edge enters the visible volume at z=w, not at
  // z=0.  Treating every negative RHW as a near-plane crossing collapses both
  // generated endpoints onto the original vertices and loses the visible
  // strip (the same failure turns MCM terrain into long fans at the horizon).
  const farEntry = [
    [1, 1, 0.5, 1.0, 0.0, 0.0],
    [6, 1, 0.5, 1.0, 1.0, 0.0],
    [3, 5, -0.5, -1.0, 0.5, 1.0],
  ];
  farEntry.forEach(([x, y, z, q, u, v], i) => {
    const p = vertices + i * VERTEX_STRIDE;
    writeFloat(wat, p + 0, x); writeFloat(wat, p + 4, y);
    writeFloat(wat, p + 8, z); writeFloat(wat, p + 12, q);
    wat.guest_write32(p + 16, 0xffffffff);
    wat.guest_write32(p + 20, 0);
    writeFloat(wat, p + 24, u); writeFloat(wat, p + 28, v);
  });
  // Clipping this negative-W input yields the projected polygon
  // (0,-1), (1,1), (6,1), (7.5,-1), whose winding is counterclockwise.
  // The default CCW cull must reject it. Test the visible strip with culling
  // disabled and with CW culling, then independently check CCW rejection.
  for (const [index, expectedX] of [[0, 0], [1, 7.5]]) {
    wat.test_diptex_clip_depth(device, vertices + index * VERTEX_STRIDE,
      vertices + 2 * VERTEX_STRIDE, clipOut, 1);
    for (const [offset, expected] of [[0, expectedX], [4, -1], [8, 1], [12, 2]]) {
      assert(Math.abs(clipFloat(offset) - expected) < 0.001,
        `far-plane intersection edge=${index} field=${offset}: ${clipFloat(offset)} vs ${expected}`);
    }
  }
  for (const cull of [1, 2, 3]) {
    wat.test_diptex_set_rs(device, 22, cull);
    clearRt(0x001f);
    wat.test_diptex_draw_tl_triangle(device, rt, vertices);
    if (cull === 3) {
      assert(Array.from({ length: 64 }, (_, i) => mem.getUint16(rtDib + i * 2, true))
        .every(pixel => pixel === 0x001f), 'CCW culling accepted the clipped back face');
    } else {
      assert.notStrictEqual(mem.getUint16(rtDib + 3 * 2, true), 0x001f,
        `far-plane visible strip missing with cull=${cull}`);
    }
  }
  // The sampler checks below reuse this CCW clipped strip; make their
  // no-culling requirement explicit instead of relying on the old default.
  wat.test_diptex_set_rs(device, 22, 1);

  // A 0..4 screen span covers pixels 0..3. Pixel 4 is the geometric edge,
  // not a fragment centre; drawing it samples u=1.0, which WRAP aliases to
  // texture column zero and exposes an opaque one-pixel seam beside MCM's
  // right-to-transparent HUD gradient.
  clearRt(0x001f);
  wat.test_diptex_draw_wrapped_span(rt, texture);
  assert.deepStrictEqual([
    mem.getUint16(rtDib + 0, true),
    mem.getUint16(rtDib + 2, true),
    mem.getUint16(rtDib + 4, true),
    mem.getUint16(rtDib + 6, true),
    mem.getUint16(rtDib + 8, true),
  ], [0xf800, 0xf800, 0x07e0, 0x07e0, 0x001f],
  'right-inclusive span wrapped u=1.0 to texture column zero');

  // MW3 changes TEXCOORDINDEX between its base/detail/light-map passes. The
  // chosen set must survive FVF repacking, and SELECTARG1 must not darken it
  // with the vertex diffuse colour.
  wat.test_diptex_set_tss(device, 1, 2);  // COLOROP=SELECTARG1 (texture)
  wat.test_diptex_set_tss(device, 4, 2);  // ALPHAOP=SELECTARG1
  wat.test_diptex_set_tss(device, 11, 1); // TEXCOORDINDEX=1 => constant .25,.50
  wat.test_diptex_set_tss(device, 13, 1); // ADDRESSU=WRAP
  wat.test_diptex_set_tss(device, 14, 1); // ADDRESSV=WRAP
  wat.test_diptex_set_tss(device, 16, 1); // MAGFILTER=POINT
  wat.test_diptex_set_tss(device, 17, 1); // MINFILTER=POINT
  assert.strictEqual(wat.test_diptex_get_tss(device, 11, out + 20) >>> 0, 0);
  assert.strictEqual(wat.guest_read32(out + 20), 1, 'extended TEXCOORDINDEX state did not round-trip');
  clearRt(0);
  wat.test_diptex_draw(device, vertices, indices);
  // The strip this leaves runs between the two vertices in front of the eye,
  // at x=1 and x=6: a screen-space vertex is covered from the pixel whose
  // CENTRE it passes, so the clipper's fractional endpoints round rather than
  // truncate, and column 0 stays clear. Probing the strip's interior for the
  // texture's constant .25/.50 texel keeps this an assertion about
  // TEXCOORDINDEX while still pinning that coverage rule: the old probe at
  // pixel 0 only ever passed because truncation biased every fractional
  // vertex half a pixel to the left.
  assert.strictEqual(mem.getUint16(rtDib + 3 * 2, true), 0x001f,
    'TEXCOORDINDEX=1 did not select the second FVF coordinate set');
  assert.strictEqual(mem.getUint16(rtDib, true), 0,
    'a fractional clipped vertex covered the pixel to its left');

  // Coordinate 1.0 wraps to the first row but clamps to the final row. This
  // catches the old unconditional-wrap sampler independently of UV selection.
  wat.test_diptex_set_tss(device, 11, 2); // constant .75,1.0
  wat.test_diptex_set_tss(device, 13, 3); // ADDRESSU=CLAMP
  wat.test_diptex_set_tss(device, 14, 3); // ADDRESSV=CLAMP
  clearRt(0);
  wat.test_diptex_draw(device, vertices, indices);
  assert.strictEqual(mem.getUint16(rtDib + 3 * 2, true), 0xffe0,
    'D3DTADDRESS_CLAMP sampled the wrapped edge texel');

  // Linear filtering at the exact centre averages all four texels. Keep the
  // assertion tolerant of the final channel rounding but reject point output.
  for (let i = 0; i < 3; i++) {
    writeFloat(wat, vertices + i * VERTEX_STRIDE + 32, 0.5);
    writeFloat(wat, vertices + i * VERTEX_STRIDE + 36, 0.5);
  }
  wat.test_diptex_set_tss(device, 11, 1);
  wat.test_diptex_set_tss(device, 16, 2); // MAGFILTER=LINEAR
  wat.test_diptex_set_tss(device, 17, 2); // MINFILTER=LINEAR
  clearRt(0);
  wat.test_diptex_draw(device, vertices, indices);
  const filtered = mem.getUint16(rtDib + 3 * 2, true);
  assert(filtered === 0x7be7 || filtered === 0x8408,
    `linear centre sample was not the four-texel average (0x${filtered.toString(16)})`);

  // Perspective correction carries u*rhw and rhw through the scan converter.
  // At (4,1), affine u selects green while the proper quotient remains red.
  wat.test_diptex_set_tss(device, 11, 0);
  wat.test_diptex_set_tss(device, 16, 1);
  wat.test_diptex_set_tss(device, 17, 1);
  const perspective = [
    [0, 0, 1.0, 0.0, 0.0],
    [7, 0, 0.1, 1.0, 0.0],
    [0, 7, 0.1, 0.0, 0.0],
  ];
  perspective.forEach(([x, y, q, u, v], i) => {
    const p = vertices + i * VERTEX_STRIDE;
    writeFloat(wat, p + 0, x); writeFloat(wat, p + 4, y);
    writeFloat(wat, p + 12, q); writeFloat(wat, p + 24, u); writeFloat(wat, p + 28, v);
  });
  clearRt(0);
  wat.test_diptex_draw(device, vertices, indices);
  assert.strictEqual(mem.getUint16(rtDib + 1 * 16 + 4 * 2, true), 0xf800,
    'TL texture coordinates were interpolated affinely instead of by RHW');

  // Restore the baseline state and vertices used by the blend/format/Z tests.
  wat.test_diptex_set_tss(device, 1, 4);  // COLOROP=MODULATE
  wat.test_diptex_set_tss(device, 4, 4);  // ALPHAOP=MODULATE
  wat.test_diptex_set_tss(device, 13, 1);
  wat.test_diptex_set_tss(device, 14, 1);
  for (let i = 0; i < 3; i++) writeFloat(wat, vertices + i * VERTEX_STRIDE + 12, 1.0);
  vertex(0, 0, 0, 0.05, 0.05);
  vertex(1, 7, 0, 0.95, 0.05);
  vertex(2, 0, 7, 0.05, 0.95);

  // MW3 uses ZERO/SRCCOLOR for fixed-function light-map passes. Ignoring the
  // blend state paints the source texture opaquely; the requested operation
  // instead keeps the destination and modulates it by the sampled texture.
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) mem.setUint16(rtDib + y * 16 + x * 2, 0x8410, true);
  }
  for (let i = 0; i < 3; i++) wat.guest_write32(vertices + i * VERTEX_STRIDE + 16, 0xffffffff);
  wat.test_diptex_set_rs(device, 27, 1); // ALPHABLENDENABLE
  wat.test_diptex_set_rs(device, 19, 1); // SRCBLEND=ZERO
  wat.test_diptex_set_rs(device, 20, 3); // DESTBLEND=SRCCOLOR
  wat.test_diptex_draw(device, vertices, indices);
  assert.strictEqual(mem.getUint16(rtDib, true), 0x8000,
    'ZERO/SRCCOLOR did not modulate the existing render-target pixel');

  // The same path must retain TL vertex alpha for MW3's fade/effect passes.
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) mem.setUint16(rtDib + y * 16 + x * 2, 0x001f, true);
  }
  for (let i = 0; i < 3; i++) wat.guest_write32(vertices + i * VERTEX_STRIDE + 16, 0x80ffffff);
  wat.test_diptex_set_rs(device, 19, 5); // SRCBLEND=SRCALPHA
  wat.test_diptex_set_rs(device, 20, 6); // DESTBLEND=INVSRCALPHA
  wat.test_diptex_draw(device, vertices, indices);
  assert.strictEqual(mem.getUint16(rtDib, true), 0x800f,
    'SRCALPHA/INVSRCALPHA discarded interpolated vertex alpha');

  // Same-bit-depth formats are not interchangeable. MW3 creates ARGB4444
  // light/detail textures whose common grey texels (for example 0xF678) look
  // like neon green/purple noise when incorrectly decoded as RGB565.
  const alphaTexture = makeSurface(wat, desc, out + 12, 2, 2, {
    flags: 0x41, // DDPF_RGB | DDPF_ALPHAPIXELS
    rMask: 0x0f00,
    gMask: 0x00f0,
    bMask: 0x000f,
    aMask: 0xf000,
  });
  assert.strictEqual(wat.test_diptex_format(alphaTexture), 4,
    'CreateSurface discarded the ARGB4444 channel masks');
  const alphaDib = wat.test_diptex_dib(alphaTexture) >>> 0;
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 2; x++) mem.setUint16(alphaDib + y * 4 + x * 2, 0xf678, true);
  }
  assert.strictEqual(
    wat.test_diptex_get_handle(texture2Api.id, alphaTexture, device, handleOut) >>> 0,
    0);
  assert.strictEqual(wat.test_diptex_bind_handle(device, wat.guest_read32(handleOut) >>> 0) >>> 0, 0);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) mem.setUint16(rtDib + y * 16 + x * 2, 0x001f, true);
  }
  for (let i = 0; i < 3; i++) wat.guest_write32(vertices + i * VERTEX_STRIDE + 16, 0xffffffff);
  wat.test_diptex_draw(device, vertices, indices);
  assert.strictEqual(mem.getUint16(rtDib, true), 0x63b1,
    'ARGB4444 grey texel was not decoded using its declared channel masks');

  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 2; x++) mem.setUint16(alphaDib + y * 4 + x * 2, 0x0877, true);
  }
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) mem.setUint16(rtDib + y * 16 + x * 2, 0x001f, true);
  }
  wat.test_diptex_draw(device, vertices, indices);
  assert.strictEqual(mem.getUint16(rtDib, true), 0x001f,
    'transparent ARGB4444 texel did not preserve the destination');

  // MW3 attaches a real 16-bit DirectDraw Z surface, clears it to zero, and
  // renders with reversed GREATEREQUAL depth.  A private renderer-only plane
  // or submission-order drawing makes the lower-Z green pass overwrite red.
  const zSurface = makeSurface(wat, desc, out + 16, 8, 8, {
    flags: 0x400, // DDPF_ZBUFFER
    bpp: 16,
    rMask: 0,
    gMask: 0,
    bMask: 0,
    caps: 0x00020000, // DDSCAPS_ZBUFFER
  });
  assert.strictEqual(wat.test_diptex_attach(rt, zSurface) >>> 0, 0);
  const zDib = wat.test_diptex_dib(zSurface) >>> 0;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      mem.setUint16(rtDib + y * 16 + x * 2, 0, true);
      mem.setUint16(zDib + y * 16 + x * 2, 0, true);
    }
  }
  assert.strictEqual(wat.test_diptex_bind_handle(device, textureHandle) >>> 0, 0);
  wat.test_diptex_set_rs(device, 7, 1);  // ZENABLE
  wat.test_diptex_set_rs(device, 14, 1); // ZWRITEENABLE
  wat.test_diptex_set_rs(device, 23, 7); // ZFUNC=GREATEREQUAL
  wat.test_diptex_set_rs(device, 27, 0); // ALPHABLENDENABLE
  for (let i = 0; i < 3; i++) {
    const p = vertices + i * VERTEX_STRIDE;
    writeFloat(wat, p + 8, 0.75);
    wat.guest_write32(p + 16, 0xffffffff);
    writeFloat(wat, p + 24, 0.05);
    writeFloat(wat, p + 28, 0.05);
  }
  for (let i = 0; i < 4; i++) mem.setUint16(texDib + i * 2, 0xf800, true);
  wat.test_diptex_draw(device, vertices, indices);
  assert(mem.getUint16(zDib + 2 * 16 + 2 * 2, true) > 0,
    'draw did not update the attached DirectDraw Z surface');
  assert.strictEqual(mem.getUint16(rtDib + 2 * 16 + 2 * 2, true), 0xf800);

  for (let i = 0; i < 4; i++) mem.setUint16(texDib + i * 2, 0x07e0, true);
  for (let i = 0; i < 3; i++) writeFloat(wat, vertices + i * VERTEX_STRIDE + 8, 0.25);
  wat.test_diptex_draw(device, vertices, indices);
  assert.strictEqual(mem.getUint16(rtDib + 2 * 16 + 2 * 2, true), 0xf800,
    'lower reversed-Z triangle incorrectly overwrote the visible surface');

  for (let i = 0; i < 3; i++) writeFloat(wat, vertices + i * VERTEX_STRIDE + 8, 0.90);
  wat.test_diptex_draw(device, vertices, indices);
  assert.strictEqual(mem.getUint16(rtDib + 2 * 16 + 2 * 2, true), 0x07e0,
    'higher reversed-Z triangle did not pass GREATEREQUAL');

  // MCM's 16-bit HUD textures use 0xf81f magenta as a source color key and
  // enable D3DRENDERSTATE_COLORKEYENABLE. A keyed texel is a discarded
  // fragment: it must preserve both the render target and its attached Z.
  for (let i = 0; i < 4; i++) mem.setUint16(texDib + i * 2, 0xf81f, true);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      mem.setUint16(rtDib + y * 16 + x * 2, 0x001f, true);
      mem.setUint16(zDib + y * 16 + x * 2, 0x2222, true);
    }
  }
  for (let i = 0; i < 3; i++) writeFloat(wat, vertices + i * VERTEX_STRIDE + 8, 0.75);
  wat.test_diptex_set_colorkey(texture, 0xf81f);
  wat.test_diptex_set_rs(device, 41, 1); // COLORKEYENABLE
  wat.test_diptex_draw(device, vertices, indices);
  assert.strictEqual(mem.getUint16(rtDib + 2 * 16 + 2 * 2, true), 0x001f,
    'enabled texture color key painted its magenta source texel');
  assert.strictEqual(mem.getUint16(zDib + 2 * 16 + 2 * 2, true), 0x2222,
    'discarded texture color-key fragment modified attached depth');

  wat.test_diptex_set_rs(device, 41, 0);
  wat.test_diptex_draw(device, vertices, indices);
  assert.strictEqual(mem.getUint16(rtDib + 2 * 16 + 2 * 2, true), 0xf81f,
    'disabled texture color key still discarded the source texel');
  assert.notStrictEqual(mem.getUint16(zDib + 2 * 16 + 2 * 2, true), 0x2222,
    'opaque texture sample did not update attached depth');

  console.log(`PASS D3DIM legacy LVERTEX layout, homogeneous depth clipping, and Texture2 indexed triangles use dither/edge-AA, color keys, FVF UV sets, perspective/filter/address states, declared formats, blending, and attached reversed-Z (${textured.size} texture colours)`);
})().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
