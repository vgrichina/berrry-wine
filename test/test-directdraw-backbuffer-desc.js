#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_dx_backbuffer_seed") (param $ddraw_vtbl i32) (param $surface_vtbl i32)
    (global.set $DX_VTBL_DDRAW (local.get $ddraw_vtbl))
    (global.set $DX_VTBL_DDSURF2 (local.get $surface_vtbl)))
  (func (export "test_dx_backbuffer_create") (param $desc i32) (param $out i32) (result i32)
    (local $ddraw i32)
    (local.set $ddraw (call $dx_create_com_obj (i32.const 1) (global.get $DX_VTBL_DDRAW)))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDraw_CreateSurface
      (local.get $ddraw) (local.get $desc) (local.get $out) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_dx_backbuffer_desc") (param $surface i32) (param $desc i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDrawSurface_GetSurfaceDesc
      (local.get $surface) (local.get $desc) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_dx_backbuffer_get") (param $surface i32) (param $caps i32) (param $out i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDrawSurface_GetAttachedSurface
      (local.get $surface) (local.get $caps) (local.get $out) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_dx_surface_dib_wa") (param $surface i32) (result i32)
    (i32.load offset=20 (call $dx_from_this (local.get $surface))))
  (func (export "test_dx_video_used") (result i32) (global.get $dx_vidmem_used))
  (func (export "test_dx_surface_lock") (param $surface i32) (param $rect i32) (param $desc i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDrawSurface_Lock
      (local.get $surface) (local.get $rect) (local.get $desc) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_dx_surface_release") (param $surface i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDrawSurface_Release
      (local.get $surface) (i32.const 0) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
`;

(async () => {
  const { exports: wat } = await bootRenderHarness({ extraWat });
  const createDesc = 0x410000;
  const primaryOut = 0x410100;
  const queryDesc = 0x410200;
  const caps = 0x410300;
  const attachedOut = 0x410304;
  const lockDesc = 0x410400;
  const lockRect = 0x410500;

  // The concrete vtable values only need to be non-zero for this direct
  // handler test; dx_from_this resolves objects through their wrapper slot.
  wat.test_dx_backbuffer_seed(0x51000000, 0x52000000);
  wat.guest_write32(createDesc, 108);
  wat.guest_write32(createDesc + 4, 0x21); // DDSD_CAPS|BACKBUFFERCOUNT
  wat.guest_write32(createDesc + 20, 1);
  wat.guest_write32(createDesc + 104, 0x218); // PRIMARY|FLIP|COMPLEX

  assert.strictEqual(wat.test_dx_backbuffer_create(createDesc, primaryOut) >>> 0, 0);
  const primary = wat.guest_read32(primaryOut) >>> 0;
  assert(primary, 'primary surface should be published');

  const primaryDibWa = wat.test_dx_surface_dib_wa(primary) >>> 0;
  assert(primaryDibWa >= 0x1C000000 && primaryDibWa < 0x20000000,
    `DirectDraw pixels must use the dedicated DIB backing, got WASM 0x${primaryDibWa.toString(16)}`);
  assert.strictEqual(wat.test_dx_surface_lock(primary, 0, lockDesc) >>> 0, 0);
  const lockedGuest = wat.guest_read32(lockDesc + 36) >>> 0;
  const primaryPitch = wat.guest_read32(lockDesc + 16) >>> 0;
  const primaryBytesPerPixel = (wat.guest_read32(lockDesc + 84) >>> 0) / 8;
  assert(lockedGuest >= 0x50000000 && lockedGuest < 0x54000000,
    `Lock must return the DIB guest mapping, got 0x${lockedGuest.toString(16)}`);

  wat.guest_write32(lockRect, 37);
  wat.guest_write32(lockRect + 4, 29);
  wat.guest_write32(lockRect + 8, 137);
  wat.guest_write32(lockRect + 12, 69);
  assert.strictEqual(wat.test_dx_surface_lock(primary, lockRect, lockDesc) >>> 0, 0);
  assert.strictEqual(wat.guest_read32(lockDesc + 36) >>> 0,
    (lockedGuest + 29 * primaryPitch + 37 * primaryBytesPerPixel) >>> 0,
    'locking a subrectangle must return its upper-left pixel, not the surface base');
  assert.strictEqual(wat.guest_read32(lockDesc + 16) >>> 0, primaryPitch,
    'a subrectangle lock must retain the full-surface pitch');

  assert.strictEqual(wat.test_dx_backbuffer_desc(primary, queryDesc) >>> 0, 0);
  assert(wat.guest_read32(queryDesc + 4) & 0x20,
    'GetSurfaceDesc should report DDSD_BACKBUFFERCOUNT');
  assert.strictEqual(wat.guest_read32(queryDesc + 20) >>> 0, 1,
    'GetSurfaceDesc should retain the created back-buffer count');
  // No memory flag was requested, so DirectDraw placed it in local video
  // memory and says so: LOCALVIDMEM|VIDEOMEMORY join the requested caps.
  assert.strictEqual(wat.guest_read32(queryDesc + 104) >>> 0, 0x10004218,
    'primary description should retain PRIMARY|FLIP|COMPLEX caps and report its placement');

  wat.guest_write32(caps, 0x4); // DDSCAPS_BACKBUFFER
  assert.strictEqual(wat.test_dx_backbuffer_get(primary, caps, attachedOut) >>> 0, 0);
  const attached = wat.guest_read32(attachedOut) >>> 0;
  assert(attached, 'GetAttachedSurface should return the linked back buffer');
  assert.strictEqual(wat.guest_read32(attached) >>> 0, 0x52000000,
    'attached surface should retain the DirectDrawSurface vtable');

  assert.strictEqual(wat.test_dx_surface_lock(attached, 0, lockDesc) >>> 0, 0);
  const backPixels = wat.guest_read32(lockDesc + 36) >>> 0;
  wat.guest_write32(backPixels, 0x12345678);
  // Diablo's dialogs draw two rows below the visible display. Preserve that
  // aperture without making every offscreen texture pay for extra rows.
  wat.guest_write32(lockedGuest + 481 * primaryPitch, 0xabcdef01);
  assert.strictEqual(wat.guest_read32(backPixels) >>> 0, 0x12345678,
    'primary overscan must not overwrite its back buffer');

  const usedBeforeRelease = wat.gdi_dib_arena_stat(0) >>> 0;
  assert.strictEqual(wat.test_dx_surface_release(primary) >>> 0, 0);
  assert((wat.gdi_dib_arena_stat(0) >>> 0) < usedBeforeRelease,
    'releasing a DirectDraw surface should return its DIB pages');

  const usedBeforeTextures = wat.gdi_dib_arena_stat(0) >>> 0;
  const videoBeforeTextures = wat.test_dx_video_used() >>> 0;
  for (let offset = 0; offset < 108; offset += 4) wat.guest_write32(createDesc + offset, 0);
  wat.guest_write32(createDesc, 108);
  wat.guest_write32(createDesc + 4, 0x1007);
  wat.guest_write32(createDesc + 8, 256);
  wat.guest_write32(createDesc + 12, 256);
  wat.guest_write32(createDesc + 72, 32);
  wat.guest_write32(createDesc + 76, 0x40);
  wat.guest_write32(createDesc + 84, 32);
  wat.guest_write32(createDesc + 88, 0xff0000);
  wat.guest_write32(createDesc + 92, 0x00ff00);
  wat.guest_write32(createDesc + 96, 0x0000ff);
  wat.guest_write32(createDesc + 104, 0x840);
  const textures = [];
  // SYSTEMMEMORY pixels must leave video storage and accounting untouched.
  for (let i = 0; i < 240; i++) {
    assert.strictEqual(wat.test_dx_backbuffer_create(createDesc, primaryOut) >>> 0, 0,
      `offscreen surface ${i} should fit the pixel budget`);
    const surface = wat.guest_read32(primaryOut) >>> 0;
    assert.strictEqual(wat.test_dx_surface_lock(surface, 0, lockDesc) >>> 0, 0);
    const pixels = wat.guest_read32(lockDesc + 36) >>> 0;
    wat.guest_write32(pixels, i + 1);
    wat.guest_write32(pixels + 256 * 256 * 4 - 4, i + 1000);
    textures.push({ surface, pixels, i });
  }
  assert.strictEqual(wat.gdi_dib_arena_stat(0) >>> 0, usedBeforeTextures,
    'system-memory surfaces must not consume DIB video pages');
  assert.strictEqual(wat.test_dx_video_used() >>> 0, videoBeforeTextures,
    'system-memory surfaces must not reduce available video memory');
  for (const { surface, pixels, i } of textures) {
    assert.strictEqual(wat.guest_read32(pixels) >>> 0, i + 1);
    assert.strictEqual(wat.guest_read32(pixels + 256 * 256 * 4 - 4) >>> 0, i + 1000);
    assert.strictEqual(wat.test_dx_surface_release(surface) >>> 0, 0);
  }
  assert.strictEqual(wat.gdi_dib_arena_stat(0) >>> 0, usedBeforeTextures,
    'releasing the texture set must return every allocation');
  // More than the full sparse pool cumulatively: leaked heap storage would
  // exhaust it, even though the DIB occupancy check above still passes.
  for (let cycle = 0; cycle < 6; cycle++) {
    const surfaces = [];
    for (let i = 0; i < 240; i++) {
      assert.strictEqual(wat.test_dx_backbuffer_create(createDesc, primaryOut) >>> 0, 0,
        `released system-memory storage must be reusable (cycle ${cycle}, surface ${i})`);
      surfaces.push(wat.guest_read32(primaryOut) >>> 0);
    }
    for (const surface of surfaces) assert.strictEqual(wat.test_dx_surface_release(surface) >>> 0, 0);
  }
  // Complex SYSTEMMEMORY textures must keep every mip out of video storage.
  wat.guest_write32(createDesc + 104, 0x401808); // MIPMAP|TEXTURE|SYSTEM|COMPLEX
  assert.strictEqual(wat.test_dx_backbuffer_create(createDesc, primaryOut) >>> 0, 0);
  let mip = wat.guest_read32(primaryOut) >>> 0;
  const mipRefs = [mip];
  wat.guest_write32(caps, 0x401000);
  for (let size = 256; size > 1; size >>= 1) {
    assert.strictEqual(wat.test_dx_backbuffer_get(mip, caps, attachedOut) >>> 0, 0);
    mip = wat.guest_read32(attachedOut) >>> 0;
    mipRefs.push(mip);
    assert.strictEqual(wat.test_dx_surface_lock(mip, 0, lockDesc) >>> 0, 0);
    wat.guest_write32(wat.guest_read32(lockDesc + 36) >>> 0, size);
  }
  assert.strictEqual(wat.gdi_dib_arena_stat(0) >>> 0, usedBeforeTextures);
  assert.strictEqual(wat.test_dx_video_used() >>> 0, videoBeforeTextures);
  for (const surface of mipRefs) assert.strictEqual(wat.test_dx_surface_release(surface) >>> 0, 0);

  console.log('PASS  DirectDraw surface descriptions preserve back buffers and subrectangle Lock pointers');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
