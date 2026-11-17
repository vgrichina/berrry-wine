#!/usr/bin/env node
// Every texture a D3D9 device creates bumps that device's texture generation
// at program state +25596.
//
// The old JS host (lib/d3d9-host.js, deleted d3d9-retire S4) keyed converted
// texture snapshots on a mip record's address and trusted a hit on the dirty
// sequence alone while this word had not moved; any producer cache keyed the
// same way relies on this bump. The address can only name a different texture
// after a new one is allocated there, so the bump in $d3d9_texture_create_kind
// is the whole guarantee. If a creation path ever stops bumping it, a released
// texture's snapshot is served for its replacement with nothing to notice.
'use strict';
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const D3DFMT_A8R8G8B8 = 21, D3DPOOL_MANAGED = 1;

(async () => {
  const { exports: e } = await bootRenderHarness({ fonts: 'none', extraWat: `
    (func (export "new_device") (result i32)
      (local $device i32)
      (local.set $device (call $dx_create_com_obj (i32.const 20) (global.get $DX_VTBL_D3DDEV9)))
      (store.field DxObject misc1 (call $dx_from_this (local.get $device)) (call $d3d9_program_alloc))
      (local.get $device))
    (func (export "generation") (param $d i32) (result i32)
      (call $gl32 (i32.add (call $d3d9_program_state (local.get $d)) (i32.const 25596))))
    (func (export "create") (param $d i32) (param $w i32) (param $h i32) (param $out i32) (result i32)
      (call $d3d9_texture_create (local.get $d) (local.get $w) (local.get $h) (i32.const 1)
        (i32.const 0) (i32.const ${D3DFMT_A8R8G8B8}) (i32.const ${D3DPOOL_MANAGED}) (local.get $out))
      (i32.load offset=0 (global.get $reg_base)))
  ` });
  e.init_dx_com_thunks();
  const a = e.new_device(), b = e.new_device(), out = 0x00409000;

  assert.strictEqual(e.generation(a), 0, 'a new device starts at generation 0');
  assert.strictEqual(e.create(a, 64, 64, out) >>> 0, 0, 'texture created');
  assert.strictEqual(e.generation(a), 1, 'creating a texture bumps its device');
  assert.strictEqual(e.create(a, 32, 32, out) >>> 0, 0, 'second texture created');
  assert.strictEqual(e.generation(a), 2, 'and every creation bumps it again');
  assert.strictEqual(e.generation(b), 0, 'another device keeps its own count');

  // A refused request allocates nothing, so no address can have been reused.
  const before = e.generation(a);
  assert.notStrictEqual(e.create(a, 0, 64, out) >>> 0, 0, 'a zero-width texture is refused');
  assert.strictEqual(e.generation(a), before, 'a refusal before allocation does not bump');

  console.log('PASS test-d3d9-texture-generation');
})().catch(error => { console.error(error); process.exit(1); });
