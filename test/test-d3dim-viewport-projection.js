'use strict';

// A Device7 caller asks its render target for DDSURFACEDESC2, then builds
// its viewport from those dimensions. Returning the surface's canonical v2
// wrapper makes that valid query fail and collapses projected XYZ vertices.
const assert = require('assert');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');
const apis = require('../src/api_table.json');
const extraWat = String.raw`
 (func (export "make_dd") (result i32)
   (call $dx_create_com_obj (i32.const 1) (global.get $DX_VTBL_DDRAW2)))
 (func (export "invoke") (param $id i32) (param $sp i32)
     (param $a i32) (param $b i32) (param $c i32) (param $d i32) (result i32)
   (i32.store offset=16 (global.get $reg_base) (local.get $sp))
   (call $dispatch_api_table (local.get $id) (local.get $a) (local.get $b)
     (local.get $c) (local.get $d) (i32.const 0) (i32.const 0))
   (i32.load (global.get $reg_base)))
 (func $vp_surface_vtbl (export "surface_vtbl") (param $v i32) (result i32)
   (if (i32.eq (local.get $v) (i32.const 7)) (then (return (global.get $DX_VTBL_DDSURF7))))
   (if (i32.eq (local.get $v) (i32.const 4)) (then (return (global.get $DX_VTBL_DDSURF4))))
   (global.get $DX_VTBL_DDSURF))
 (func $vp_device_vtbl (export "device_vtbl") (param $v i32) (result i32)
   (if (i32.eq (local.get $v) (i32.const 7)) (then (return (global.get $DX_VTBL_D3DDEV7))))
   (if (i32.eq (local.get $v) (i32.const 3)) (then (return (global.get $DX_VTBL_D3DDEV3))))
   (global.get $DX_VTBL_D3DDEV2))
 (func (export "surface_view") (param $p i32) (param $v i32) (result i32)
   (call $dx_surface_view (local.get $p) (call $vp_surface_vtbl (local.get $v))))
 (func (export "make_device") (param $surface i32) (param $out i32) (param $v i32) (result i32)
   (call $d3dim_create_device (i32.const 0) (local.get $surface) (local.get $out)
     (call $vp_device_vtbl (local.get $v)))
   (i32.load (global.get $reg_base)))
 (func (export "device_view") (param $p i32) (param $v i32) (result i32)
   (call $dx_get_wrapper_for_vtbl (call $dx_slot_of (call $dx_from_this (local.get $p)))
     (call $vp_device_vtbl (local.get $v))))
 (func (export "refs") (param $p i32) (result i32)
   (load.field DxObject refcount (call $dx_from_this (local.get $p))))
 (func (export "slot") (param $p i32) (result i32) (call $dx_slot_of (call $dx_from_this (local.get $p))))
 (func (export "aux_refs") (param $p i32) (result i32) (call $dx_aux_refs (local.get $p)))
 (func (export "project") (param $device i32) (param $vin i32) (param $out i32)
   (local $state i32)
   (local.set $state (call $d3ddev_state (local.get $device)))
   (call $d3ddev_composite_wvp (local.get $state))
   (call $vertex_project (local.get $state) (call $g2w (local.get $vin)) (call $g2w (local.get $out))))
`;

(async () => {
  const bytes = compileSrcWasm((file, source) => file === '13-exports.wat' ? source + '\n' + extraWat : source);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { getMemory: () => memory.buffer };
  const imports = createHostImports(ctx); imports.host.memory = memory;
  const { instance } = await WebAssembly.instantiate(bytes, imports), e = instance.exports; ctx.exports = e;
  e.init_dx_com_thunks();
  const sp = e.guest_alloc(128), desc = e.guest_alloc(128), out = e.guest_alloc(4);
  const devOut = e.guest_alloc(4), viewport = e.guest_alloc(24), vin = e.guest_alloc(16), projected = e.guest_alloc(32);
  const read = p => e.guest_read32(p) >>> 0, write = (p, v) => e.guest_write32(p, v >>> 0);
  const scratch = new DataView(new ArrayBuffer(4));
  const float = (p, v) => { scratch.setFloat32(0, v, true); write(p, scratch.getUint32(0, true)); };
  const readFloat = p => { scratch.setUint32(0, read(p), true); return scratch.getFloat32(0, true); };
  const call = (name, args, pop) => {
    const id = apis.find(x => x.name === name)?.id; assert.notStrictEqual(id, undefined, name);
    write(sp + pop, 0xdeadbeef);
    const hr = e.invoke(id, sp, ...[...args, 0, 0, 0, 0].slice(0, 4)) >>> 0;
    assert.strictEqual(e.get_esp(), sp + pop, name + ' stdcall');
    assert.strictEqual(read(sp + pop), 0xdeadbeef, name + ' stack guard');
    return hr;
  };
  const clearDesc = size => { for (let i = 0; i < 128; i += 4) write(desc + i, 0); write(desc, size); };
  clearDesc(108); write(desc + 4, 0x1007); write(desc + 8, 480); write(desc + 12, 640);
  write(desc + 104, 0x2040); // OFFSCREENPLAIN | 3DDEVICE
  assert.strictEqual(call('IDirectDraw_CreateSurface', [e.make_dd(), desc, out, 0], 20), 0);
  const surface = read(out), canonicalVtbl = read(surface);
  const surf7 = e.surface_view(surface, 7) >>> 0;
  assert(surf7); assert.strictEqual(e.make_device(surf7, devOut, 7) >>> 0, 0);
  const device = read(devOut);

  for (const [version, surfaceVersion] of [[7, 7], [3, 4], [2, 1]]) {
    const alias = e.device_view(device, version) >>> 0, size = version === 2 ? 108 : 124;
    const refs = e.refs(surface);
    assert.strictEqual(call(`IDirect3DDevice${version}_GetRenderTarget`, [alias, out], 12), 0);
    const target = read(out);
    assert.strictEqual(e.slot(target), e.slot(surface), 'same render-target COM identity');
    clearDesc(size);
    assert.strictEqual(call('IDirectDrawSurface_GetSurfaceDesc', [target, desc], 12), 0,
      `Device${version} target must accept its caller's ${size}-byte surface descriptor`);
    assert.strictEqual(read(target), e.surface_vtbl(surfaceVersion) >>> 0, 'caller interface selects surface ABI');
    assert.strictEqual(read(surface), canonicalVtbl, 'canonical wrapper remains stable');
    assert.strictEqual(read(desc + 8), 480); assert.strictEqual(read(desc + 12), 640);
    assert.strictEqual(e.refs(surface), refs + 1, 'GetRenderTarget acquires exactly one reference');
    if (version === 7) {
      [0, 0, read(desc + 12), read(desc + 8), 0, 0x3f800000].forEach((v, i) => write(viewport + 4 * i, v));
      assert.strictEqual(call('IDirect3DDevice7_SetViewport', [device, viewport], 12), 0);
      float(vin, -1); float(vin + 4, 1); float(vin + 8, 0.5);
      e.project(device, vin, projected);
      assert.strictEqual(readFloat(projected), 0); assert.strictEqual(readFloat(projected + 4), 0);
      float(vin, 1); float(vin + 4, -1); e.project(device, vin, projected);
      assert.strictEqual(readFloat(projected), 640); assert.strictEqual(readFloat(projected + 4), 480);
    }
    call('IDirectDrawSurface_Release', [target], 8);
    assert.strictEqual(e.refs(surface), refs, 'Release balances acquired surface reference');
  }
  assert.strictEqual(call('IDirect3DDevice7_GetRenderTarget', [device, 0], 12), 0x80004003);
  console.log('PASS Device2/3/7 render-target ABI, descriptor dimensions, viewport projection, identity, references and stdcall');
})().catch(error => { console.error(error); process.exitCode = 1; });
