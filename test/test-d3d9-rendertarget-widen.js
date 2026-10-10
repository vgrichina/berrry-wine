#!/usr/bin/env node
// RGB565 targets retain their packed format only when the software precision
// contract is enabled. Other backends retain the existing compatibility
// widening (not exact565 precision), as does A4R4G4B4.
'use strict';
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const D3DFMT_A8R8G8B8 = 21, D3DFMT_X8R8G8B8 = 22, D3DFMT_R5G6B5 = 23, D3DFMT_A4R4G4B4 = 26;
const D3DUSAGE_RENDERTARGET = 1, D3DUSAGE_DYNAMIC = 0x200;
const D3DPOOL_DEFAULT = 0, D3DPOOL_MANAGED = 1;
const D3DERR_INVALIDCALL = 0x8876086c;

(async () => {
  let software565=false;
  const { exports: e } = await bootRenderHarness({ fonts: 'none',
    extraHostOverrides:{gpu_gl_call:(op,p,a)=>op===0x30017&&a===23&&software565?1:0},extraWat: `
    (func (export "new_device") (result i32)
      (local $device i32)
      (local.set $device (call $dx_create_com_obj (i32.const 20) (global.get $DX_VTBL_D3DDEV9)))
      (store.field DxObject misc1 (call $dx_from_this (local.get $device)) (call $d3d9_program_alloc))
      (local.get $device))
    ;; Every argument explicit -- usage, format and pool are exactly what this
    ;; test varies, and the existing texture harness pins two of the three.
    (func (export "create") (param $d i32) (param $w i32) (param $h i32)
      (param $usage i32) (param $format i32) (param $pool i32) (param $out i32) (result i32)
      (call $d3d9_texture_create (local.get $d) (local.get $w) (local.get $h) (i32.const 1)
        (local.get $usage) (local.get $format) (local.get $pool) (local.get $out))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "desc") (param $t i32) (param $level i32) (param $out i32) (result i32)
      (call $d3d9_texture_desc (local.get $t) (local.get $level) (local.get $out)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "lock") (param $t i32) (param $level i32) (param $out i32) (result i32)
      (call $d3d9_texture_lock (local.get $t) (local.get $level) (local.get $out)
        (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "unlock") (param $t i32) (param $level i32) (result i32)
      (call $handle_IDirect3DTexture9_UnlockRect (local.get $t) (local.get $level)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
  ` });
  e.init_dx_com_thunks();
  const d = e.new_device(), out = 0x00409000, desc = out + 256, locked = out + 512;

  // Returns the format the record actually stores, or the failing HRESULT.
  const storedFormat = (usage, format, pool, w = 512, h = 512) => {
    e.guest_write32(out, 0);
    const hr = e.create(d, w, h, usage, format, pool, out) >>> 0;
    if (hr !== 0) return hr;
    const t = e.guest_read32(out) >>> 0;
    assert.ok(t, 'a success must produce a texture');
    assert.strictEqual(e.desc(t, 0, desc), 0);
    return { format: e.guest_read32(desc), texture: t };
  };

  // The case B&W2 actually asks for, at its actual size.
  assert.strictEqual(storedFormat(D3DUSAGE_RENDERTARGET,D3DFMT_R5G6B5,D3DPOOL_DEFAULT).format,
    D3DFMT_X8R8G8B8,'preserve historical BW2 widening without software precision contract');
  software565=true;
  const rt565 = storedFormat(D3DUSAGE_RENDERTARGET, D3DFMT_R5G6B5, D3DPOOL_DEFAULT);
  assert.strictEqual(rt565.format, D3DFMT_R5G6B5,'software target retains actual packed565 format');
  assert.strictEqual(e.guest_read32(rt565.texture+64+8),512*2,'real 16-bit texture pitch');

  // The separate A4R4G4B4 compatibility behavior stays unchanged.
  assert.strictEqual(storedFormat(D3DUSAGE_RENDERTARGET, D3DFMT_A4R4G4B4, D3DPOOL_DEFAULT).format,
    D3DFMT_A8R8G8B8, 'an A4R4G4B4 render target is stored as A8R8G8B8');

  // Render-target texture CPU locking remains unavailable.
  assert.strictEqual(e.lock(rt565.texture, 0, locked) >>> 0, D3DERR_INVALIDCALL,
    'a render target is not lockable');

  // Widening is scoped to render targets. A plain texture in a 16-bit format
  // keeps the format it asked for -- it may be locked and written as raw
  // 16-bit texels, which is exactly the case widening would corrupt.
  for (const format of [D3DFMT_R5G6B5, D3DFMT_A4R4G4B4]) {
    assert.strictEqual(storedFormat(0, format, D3DPOOL_MANAGED, 64, 64).format, format,
      `a non-render-target ${format} texture keeps its own format`);
  }

  // A 32-bit render target is unaffected either way.
  for (const format of [D3DFMT_A8R8G8B8, D3DFMT_X8R8G8B8]) {
    assert.strictEqual(storedFormat(D3DUSAGE_RENDERTARGET, format, D3DPOOL_DEFAULT, 64, 64).format,
      format, `a ${format} render target is untouched`);
  }

  // Every gate the widening sits in front of still holds. These ran before the
  // change and must still run after it: widening a format is not a licence to
  // create a render target anywhere but D3DPOOL_DEFAULT, nor to accept a usage
  // that is more than D3DUSAGE_RENDERTARGET alone.
  assert.strictEqual(storedFormat(D3DUSAGE_RENDERTARGET, D3DFMT_R5G6B5, D3DPOOL_MANAGED),
    D3DERR_INVALIDCALL, 'a render target outside D3DPOOL_DEFAULT is still refused');
  assert.strictEqual(
    storedFormat(D3DUSAGE_RENDERTARGET | D3DUSAGE_DYNAMIC, D3DFMT_R5G6B5, D3DPOOL_DEFAULT),
    D3DERR_INVALIDCALL, 'a dynamic render target is still refused');

  // Sensitivity check: the format gate this widening sits in front of is still
  // there and still rejecting. D3DFMT_R8G8B8 (20) is a supported texture format
  // that the widening deliberately does not cover -- it is 24-bit, so there is
  // no 32-bit format it maps to without inventing an alpha channel. If this
  // ever starts succeeding, the gate has been removed rather than narrowed and
  // the assertions above stop meaning anything.
  assert.strictEqual(storedFormat(D3DUSAGE_RENDERTARGET, 20, D3DPOOL_DEFAULT, 64, 64),
    D3DERR_INVALIDCALL, 'the render-target format gate still rejects what it does not widen');

  console.log('PASS test-d3d9-rendertarget-widen');
})().catch(error => { console.error(error); process.exit(1); });
