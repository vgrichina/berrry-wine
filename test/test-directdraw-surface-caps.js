#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_dx_caps_aux") (param $surface i32) (result i32)
    (call $dx_get_wrapper_for_vtbl (call $dx_slot_of (call $dx_from_this (local.get $surface)))
      (i32.const 0x53000000)))
  (func (export "test_dx_caps_refs") (param $surface i32) (result i32)
    (load.field DxObject refcount (call $dx_from_this (local.get $surface))))
  (func (export "test_dx_caps_seed") (param $ddraw_vtbl i32) (param $surface_vtbl i32)
    (global.set $DX_VTBL_DDRAW (local.get $ddraw_vtbl))
    (global.set $DX_VTBL_DDSURF2 (local.get $surface_vtbl)))
  (func (export "test_dx_caps_create") (param $desc i32) (param $out i32) (result i32)
    (local $ddraw i32)
    (local.set $ddraw (call $dx_create_com_obj (i32.const 1) (global.get $DX_VTBL_DDRAW)))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDraw_CreateSurface
      (local.get $ddraw) (local.get $desc) (local.get $out) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_dx_caps_get_attached") (param $surface i32) (param $caps i32) (param $out i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDrawSurface_GetAttachedSurface
      (local.get $surface) (local.get $caps) (local.get $out) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_dx_caps_desc") (param $surface i32) (param $desc i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDrawSurface_GetSurfaceDesc
      (local.get $surface) (local.get $desc) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_dx_caps_lock") (param $surface i32) (param $desc i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDrawSurface_Lock
      (local.get $surface) (i32.const 0) (local.get $desc) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_dx_caps_release") (param $surface i32) (result i32)
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
  const attachedCaps = 0x410104;
  const attachedOut = 0x410108;
  const queryDesc = 0x410200;

  wat.test_dx_caps_seed(0x51000000, 0x52000000);
  wat.guest_write32(createDesc, 108);
  wat.guest_write32(createDesc + 4, 0x21); // DDSD_CAPS|BACKBUFFERCOUNT
  wat.guest_write32(createDesc + 20, 1);
  const requested = 0x6218; // PRIMARY|3DDEVICE|VIDEOMEMORY|FLIP|COMPLEX
  wat.guest_write32(createDesc + 104, requested);

  assert.strictEqual(wat.test_dx_caps_create(createDesc, primaryOut) >>> 0, 0);
  const primary = wat.guest_read32(primaryOut) >>> 0;
  assert(primary, 'primary surface should be created');

  assert.strictEqual(wat.test_dx_caps_desc(primary, queryDesc) >>> 0, 0);
  assert.strictEqual(wat.guest_read32(queryDesc + 104) >>> 0, requested | 0x20,
    'primary GetSurfaceDesc must preserve requested allocation/render caps and add FRONTBUFFER');

  wat.guest_write32(attachedCaps, 0x401000); // DDSCAPS_TEXTURE|MIPMAP
  wat.guest_write32(attachedOut, 0xdeadbeef);
  assert.strictEqual(
    wat.test_dx_caps_get_attached(primary, attachedCaps, attachedOut) >>> 0,
    0x887600ff,
    'GetAttachedSurface must reject a child missing any requested capability');
  // Current runtime policy (also asserted by the mip-chain regression), not
  // a native Win98 failure-output oracle: clear rather than publish a child.
  assert.strictEqual(wat.guest_read32(attachedOut) >>> 0, 0,
    'a failed attachment query clears output instead of publishing a back buffer');

  wat.guest_write32(attachedCaps, 0x4); // DDSCAPS_BACKBUFFER
  assert.strictEqual(
    wat.test_dx_caps_get_attached(primary, attachedCaps, attachedOut) >>> 0, 0);
  const attached = wat.guest_read32(attachedOut) >>> 0;
  assert(attached, 'attached back buffer should be returned');
  assert.strictEqual(wat.test_dx_caps_refs(attached), 2,
    'attachment ownership plus one caller reference');
  assert.strictEqual(wat.test_dx_caps_get_attached(primary, attachedCaps, attachedOut), 0);
  assert.strictEqual(wat.guest_read32(attachedOut) >>> 0, attached);
  assert.strictEqual(wat.test_dx_caps_refs(attached), 3,
    'each successful query transfers a separate reference');
  wat.guest_write32(attachedCaps, 0x401000);
  assert.strictEqual(wat.test_dx_caps_get_attached(primary, attachedCaps, attachedOut) >>> 0,
    0x887600ff);
  assert.strictEqual(wat.test_dx_caps_refs(attached), 3,
    'a rejected query must not AddRef');
  assert.strictEqual(wat.test_dx_caps_release(attached), 2);
  assert.strictEqual(wat.test_dx_caps_release(attached), 1,
    'releasing both caller references leaves the attachment alive');
  wat.guest_write32(attachedCaps, 0x4);

  // Invalid receiver/NULL parameters must fail before touching output or
  // acquiring another child reference. Error precedence is tested one fault
  // at a time; arbitrary non-NULL page permissions are outside this test.
  const fake = wat.guest_alloc(8);
  wat.guest_write32(fake, 0x52000000);
  wat.guest_write32(fake + 4, 0);
  for (const receiver of [0, 0xdeadbeef, primary + 1, fake]) {
    wat.guest_write32(attachedOut, 0xdeadbeef);
    assert.strictEqual(wat.test_dx_caps_get_attached(receiver, attachedCaps, attachedOut) >>> 0,
      0x88760082, 'invalid receiver is not a live registered surface');
    assert.strictEqual(wat.guest_read32(attachedOut) >>> 0, 0xdeadbeef);
    assert.strictEqual(wat.get_esp(), 0x30010);
    assert.strictEqual(wat.test_dx_caps_refs(attached), 1);
  }
  for (const [caps, out] of [[0, attachedOut], [attachedCaps, 0]]) {
    wat.guest_write32(attachedOut, 0xdeadbeef);
    assert.strictEqual(wat.test_dx_caps_get_attached(primary, caps, out) >>> 0,
      0x80070057, 'NULL parameter is invalid');
    assert.strictEqual(wat.guest_read32(attachedOut) >>> 0, 0xdeadbeef);
    assert.strictEqual(wat.get_esp(), 0x30010);
    assert.strictEqual(wat.test_dx_caps_refs(attached), 1);
  }
  const aux = wat.test_dx_caps_aux(primary) >>> 0;
  assert.notStrictEqual(aux, primary);
  assert.strictEqual(wat.test_dx_caps_get_attached(aux, attachedCaps, attachedOut), 0,
    'a registered auxiliary interface still resolves the same live surface');
  assert.strictEqual(wat.guest_read32(attachedOut) >>> 0, attached);
  assert.strictEqual(wat.test_dx_caps_release(attached), 1);

  const savedSlot = wat.guest_read32(primary + 4);
  wat.guest_write32(primary + 4, 0xffffffff);
  assert.strictEqual(wat.test_dx_caps_get_attached(primary, attachedCaps, attachedOut) >>> 0,
    0x88760082, 'corrupt wrapper slot is rejected, never clamped to slot zero');
  wat.guest_write32(primary + 4, savedSlot);
  assert.strictEqual(wat.test_dx_caps_desc(attached, queryDesc) >>> 0, 0);
  assert.strictEqual(wat.guest_read32(queryDesc + 104) >>> 0, 0x601c,
    'back buffer must inherit 3DDEVICE and VIDEOMEMORY while replacing PRIMARY');
  // Dispose the child only after all live-child checks; the parent still has
  // its stale implicit link, which must not resurrect the retired object.
  assert.strictEqual(wat.test_dx_caps_release(attached), 0);
  assert.strictEqual(wat.test_dx_caps_get_attached(primary, attachedCaps, attachedOut) >>> 0,
    0x887600ff, 'a retired child cannot be returned or AddRefed');
  assert.strictEqual(wat.test_dx_caps_refs(attached), 0);
  assert.strictEqual(wat.test_dx_caps_get_attached(attached, attachedCaps, attachedOut) >>> 0,
    0x88760082, 'a retired receiver is invalid');

  const defaultDesc = 0x410300;
  const defaultPrimaryOut = 0x410400;
  const defaultAttachedOut = 0x410404;
  wat.guest_write32(defaultDesc, 108);
  wat.guest_write32(defaultDesc + 4, 0x21); // DDSD_CAPS|BACKBUFFERCOUNT
  wat.guest_write32(defaultDesc + 20, 1);
  wat.guest_write32(defaultDesc + 104, 0x218); // PRIMARY|FLIP|COMPLEX
  assert.strictEqual(wat.test_dx_caps_create(defaultDesc, defaultPrimaryOut) >>> 0, 0);
  const defaultPrimary = wat.guest_read32(defaultPrimaryOut) >>> 0;
  wat.guest_write32(attachedCaps, 0x4004); // BACKBUFFER|VIDEOMEMORY
  assert.strictEqual(
    wat.test_dx_caps_get_attached(defaultPrimary, attachedCaps, defaultAttachedOut) >>> 0, 0,
    'an internally allocated flip-chain back buffer reports video memory');
  const defaultAttached = wat.guest_read32(defaultAttachedOut) >>> 0;
  assert.strictEqual(wat.test_dx_caps_desc(defaultAttached, queryDesc) >>> 0, 0);
  // A primary requested with no memory flag is placed in local video memory,
  // and its back buffer inherits both placement bits.
  assert.strictEqual(wat.guest_read32(queryDesc + 104) >>> 0, 0x1000401c,
    'default back-buffer caps include actual LOCALVIDMEM|VIDEOMEMORY placement');

  const externalDesc = 0x411000;
  const externalOut = 0x411100;
  const externalPixels = 0x412000;
  const arenaBefore = wat.gdi_dib_arena_stat(0) >>> 0;
  wat.guest_write32(externalPixels, 0x44332211);
  wat.guest_write32(externalDesc, 124);
  wat.guest_write32(externalDesc + 4, 0x180f); // WIDTH|HEIGHT|PITCH|LPSURFACE|PIXELFORMAT
  wat.guest_write32(externalDesc + 8, 2);
  wat.guest_write32(externalDesc + 12, 3);
  wat.guest_write32(externalDesc + 16, 16);
  wat.guest_write32(externalDesc + 36, externalPixels);
  wat.guest_write32(externalDesc + 72, 32);
  wat.guest_write32(externalDesc + 76, 0x41); // DDPF_RGB|DDPF_ALPHAPIXELS
  wat.guest_write32(externalDesc + 84, 32);
  wat.guest_write32(externalDesc + 88, 0x00ff0000);
  wat.guest_write32(externalDesc + 92, 0x0000ff00);
  wat.guest_write32(externalDesc + 96, 0x000000ff);
  wat.guest_write32(externalDesc + 100, 0xff000000);
  wat.guest_write32(externalDesc + 104, 0x840); // OFFSCREENPLAIN|SYSTEMMEMORY
  assert.strictEqual(wat.test_dx_caps_create(externalDesc, externalOut) >>> 0, 0);
  const external = wat.guest_read32(externalOut) >>> 0;
  assert(external, 'caller-backed system-memory surface should be created');
  assert.strictEqual(wat.gdi_dib_arena_stat(0) >>> 0, arenaBefore,
    'caller-backed surface must not allocate DIB arena pages');
  assert.strictEqual(wat.test_dx_caps_lock(external, queryDesc) >>> 0, 0);
  assert.strictEqual(wat.guest_read32(queryDesc + 16) >>> 0, 16,
    'Lock must preserve the caller-provided pitch');
  assert.strictEqual(wat.guest_read32(queryDesc + 36) >>> 0, externalPixels,
    'Lock must return the caller-provided pixel pointer');
  assert.strictEqual(wat.guest_read32(externalPixels) >>> 0, 0x44332211,
    'CreateSurface must not clear caller-owned pixels');
  assert.strictEqual(wat.test_dx_caps_release(external) >>> 0, 0);
  assert.strictEqual(wat.gdi_dib_arena_stat(0) >>> 0, arenaBefore,
    'releasing caller-backed surface must not free DIB arena pages');
  assert.strictEqual(wat.guest_read32(externalPixels) >>> 0, 0x44332211,
    'releasing caller-backed surface must not alter caller memory');

  console.log('PASS  DirectDraw surface descriptions preserve creation and inherited back-buffer caps');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
