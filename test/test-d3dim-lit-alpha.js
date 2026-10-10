'use strict';
// SCR-FALLINGL-BLACK-LEAVES: a lit vertex takes its alpha from the bound
// material's diffuse alpha. d3drm's shadow pass (Plus! 98 Falling Leaves)
// binds black diffuse with a=0.5 and blends SRCALPHA/INVSRCALPHA; packing a
// constant 0xFF alpha drew every leaf shadow as an opaque black silhouette.
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const apis = require('../src/api_table.json');
const extraWat = String.raw`
 (func (export "make_material") (result i32)
   (call $dx_create_com_obj (i32.const 25) (global.get $DX_VTBL_D3DMAT1)))
 (func (export "material_handle") (param $p i32) (result i32)
   (call $dx_slot_of (call $dx_from_this (local.get $p))))
 (func (export "make_state") (result i32)
   (local $s i32)
   (local.set $s (call $heap_alloc (i32.const 4096)))
   (call $guest_memset (local.get $s) (i32.const 0) (i32.const 4096))
   ;; identity world matrix at state+0
   (call $gs32 (local.get $s) (i32.const 0x3f800000))
   (call $gs32 (i32.add (local.get $s) (i32.const 20)) (i32.const 0x3f800000))
   (call $gs32 (i32.add (local.get $s) (i32.const 40)) (i32.const 0x3f800000))
   (call $gs32 (i32.add (local.get $s) (i32.const 60)) (i32.const 0x3f800000))
   (local.get $s))
 (func (export "bind_material") (param $s i32) (param $h i32)
   (call $gs32 (i32.add (local.get $s) (i32.const 2308)) (local.get $h)))
 (func (export "set_light") (param $light i32)
   (global.set $d3dim_light_n (i32.const 1))
   (global.set $d3dim_light0 (local.get $light)))
 (func (export "lit") (param $s i32) (param $v i32) (result i32)
   (call $d3dim_vertex_lit_color (local.get $s) (call $g2w (local.get $v))))
 (func (export "invoke") (param $id i32) (param $p i32) (param $arg i32) (param $sp i32) (result i32)
   (i32.store offset=16 (global.get $reg_base) (local.get $sp))
   (call $dispatch_api_table (local.get $id) (local.get $p) (local.get $arg)
     (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
   (i32.load (global.get $reg_base)))
`;
(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none' }); e.init_dx_com_thunks();
  const stack = e.guest_alloc(64), matIn = e.guest_alloc(80), light = e.guest_alloc(76), vertex = e.guest_alloc(32);
  const f32 = (p, v) => e.guest_write32(p, new Uint32Array(new Float32Array([v]).buffer)[0]);
  // Directional white light shining down -Z onto a +Z normal: N.L = 1.
  for (let i = 0; i < 76; i += 4) e.guest_write32(light + i, 0);
  e.guest_write32(light, 76); e.guest_write32(light + 4, 3);
  [1, 1, 1, 1].forEach((v, i) => f32(light + 8 + i * 4, v));
  [0, 0, -1].forEach((v, i) => f32(light + 36 + i * 4, v));
  [0, 0, 0, 0, 0, 1, 0, 0].forEach((v, i) => f32(vertex + i * 4, v));
  e.set_light(light);
  // Handle 0 means 'no material'; in a real app DirectDraw holds slot 0.
  e.make_material();
  const state = e.make_state();
  const call = (p, method, arg) => {
    assert.strictEqual(e.invoke(apis.find(a => a.name === 'IDirect3DMaterial_' + method).id, p, arg, stack), 0, method);
  };
  const material = (rgb, alpha) => {
    const p = e.make_material();
    for (let i = 0; i < 80; i += 4) e.guest_write32(matIn + i, 0);
    e.guest_write32(matIn, 80);
    [...rgb, alpha].forEach((v, i) => f32(matIn + 4 + i * 4, v));   // dcvDiffuse
    call(p, 'SetMaterial', matIn);
    return e.material_handle(p);
  };
  const alphaOf = color => (color >>> 24) & 255;
  assert.strictEqual(alphaOf(e.lit(state, vertex)), 255, 'no material: opaque');
  e.bind_material(state, material([0, 0, 0], 0.5));
  const shadow = e.lit(state, vertex) >>> 0;
  assert.strictEqual(alphaOf(shadow), 128, 'black a=0.5 shadow material: half alpha, not 0xFF');
  assert.strictEqual(shadow & 0xffffff, 0, 'black shadow stays black');
  e.bind_material(state, material([1, 1, 1], 1));
  assert.strictEqual(alphaOf(e.lit(state, vertex)), 255, 'opaque material: 0xFF');
  e.bind_material(state, material([1, 0, 0], 0));
  const clear = e.lit(state, vertex) >>> 0;
  assert.strictEqual(alphaOf(clear), 0, 'a=0 material: alpha 0 (D3D uses material diffuse alpha)');
  assert.strictEqual((clear >>> 16) & 255, 255, 'colour channels still lit');
  console.log('PASS d3dim lit vertex alpha = material diffuse alpha (fallingl shadows)');
})().catch(error => { console.error(error); process.exitCode = 1; });
