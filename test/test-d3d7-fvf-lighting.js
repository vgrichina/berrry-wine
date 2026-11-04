#!/usr/bin/env node
'use strict';

// IDirect3DDevice7 fixed-function lighting for FVF vertices with a normal.
// Device7 keeps its own D3DLIGHT7 table, enable mask and D3DMATERIAL7, and
// none of them reached the renderer: XYZ|NORMAL|DIFFUSE|SPECULAR vertices drawn
// with D3DRENDERSTATE_LIGHTING were packed as pre-lit and kept their diffuse
// dword. Colin McRae Rally 2.0's car (DIFFUSEMATERIALSOURCE=MATERIAL, diffuse
// dword 0) rendered solid black. This drives the real Device7 state setters and
// $d3dim_d7_light_vertices over packed vertices and checks the colours.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_d7lit_state") (param $state i32)
    (global.set $d3dim_state_override (local.get $state)))
  (func (export "test_d7lit_rs") (param $rs i32) (param $v i32)
    (call $d3dim_set_render_state (i32.const 0) (local.get $rs) (local.get $v)))
  (func (export "test_d7lit_set_light") (param $i i32) (param $l i32)
    (call $d3dim_device7_set_light (i32.const 0) (local.get $i) (local.get $l)))
  (func (export "test_d7lit_enable") (param $i i32) (param $on i32)
    (call $d3dim_device7_light_enable (i32.const 0) (local.get $i) (local.get $on)))
  (func (export "test_d7lit_material") (param $m i32)
    (call $d3dim_device7_set_material (i32.const 0) (local.get $m)))
  (func (export "test_d7lit_pack") (param $fvf i32) (param $src i32) (param $n i32) (result i32)
    (call $d3dim_pack_fvf_vertices (local.get $fvf) (local.get $src) (local.get $n) (i32.const 0)))
  (func (export "test_d7lit_light") (param $fvf i32) (param $src i32) (param $packed i32)
      (param $n i32) (param $type i32) (result i32)
    (call $d3dim_d7_light_vertices (i32.const 0) (local.get $fvf) (local.get $src)
      (local.get $packed) (local.get $n) (local.get $type)))
  (func (export "test_d7lit_vtxtype") (param $fvf i32) (result i32)
    (call $d3dim_fvf_vtxtype (local.get $fvf)))
`;

const XYZ = 0x2, NORMAL = 0x10, DIFFUSE = 0x40, SPECULAR = 0x80, TEX1 = 0x100;
const LIGHTING = 137, AMBIENT = 139, COLORVERTEX = 141, DIFFUSEMATERIALSOURCE = 145;

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
  const wf = (a, v) => { f32[0] = v; e.guest_write32(a, u32[0]); };
  const zero = (a, n) => { for (let i = 0; i < n; i += 4) e.guest_write32(a + i, 0); };

  function freshDevice() {
    const state = e.guest_alloc(4096) >>> 0;
    zero(state, 4096);
    for (let i = 0; i < 4; i++) wf(state + (i * 4 + i) * 4, 1);   // WORLD = identity
    e.test_d7lit_state(state);
    return state;
  }
  function setMaterial(diffuse, ambient, emissive = [0, 0, 0, 0]) {
    const m = e.guest_alloc(68) >>> 0;
    zero(m, 68);
    diffuse.forEach((v, i) => wf(m + i * 4, v));
    ambient.forEach((v, i) => wf(m + 16 + i * 4, v));
    emissive.forEach((v, i) => wf(m + 48 + i * 4, v));
    e.test_d7lit_material(m);
  }
  function setLight(index, l) {
    const p = e.guest_alloc(104) >>> 0;
    zero(p, 104);
    e.guest_write32(p, l.type);
    (l.diffuse || [0, 0, 0, 0]).forEach((v, i) => wf(p + 4 + i * 4, v));
    (l.ambient || [0, 0, 0, 0]).forEach((v, i) => wf(p + 36 + i * 4, v));
    (l.position || [0, 0, 0]).forEach((v, i) => wf(p + 52 + i * 4, v));
    (l.direction || [0, 0, 1]).forEach((v, i) => wf(p + 64 + i * 4, v));
    wf(p + 76, l.range ?? 1000);
    wf(p + 80, 1);
    (l.atten || [1, 0, 0]).forEach((v, i) => wf(p + 84 + i * 4, v));
    e.test_d7lit_set_light(index, p);
  }
  // One vertex at the origin facing -Z (towards a light shining along +Z).
  function vertex(fvf, diffuse = 0, specular = 0) {
    const words = [0, 0, 0];
    if (fvf & NORMAL) words.push(0, 0, -1);
    if (fvf & DIFFUSE) words.push(diffuse);
    if (fvf & SPECULAR) words.push(specular);
    if (fvf & TEX1) words.push(0.25, 0.75);
    const p = e.guest_alloc(words.length * 4) >>> 0;
    words.forEach((v, i) => {
      if (Number.isInteger(v) && v > 1) e.guest_write32(p + i * 4, v);
      else wf(p + i * 4, v);
    });
    return p;
  }
  function lit(fvf, diffuse = 0, specular = 0x11223344) {
    const src = vertex(fvf, diffuse, specular);
    const packed = e.test_d7lit_pack(fvf, src, 1) >>> 0;
    const type = e.test_d7lit_light(fvf, src, packed, 1, e.test_d7lit_vtxtype(fvf)) >>> 0;
    return { type, color: e.guest_read32(packed + 16) >>> 0, spec: e.guest_read32(packed + 20) >>> 0,
      tu: e.guest_read32(packed + 24) >>> 0 };
  }
  const hex = v => '0x' + (v >>> 0).toString(16);
  const FVF = XYZ | NORMAL | DIFFUSE | SPECULAR | TEX1;

  // A device that never used Device7 SetLight/SetMaterial is left alone, even lit.
  freshDevice();
  e.test_d7lit_rs(LIGHTING, 1);
  assert.strictEqual(hex(lit(FVF, 0x80123456).color), hex(0x80123456), 'no Device7 state: pre-lit colour kept');

  // LIGHTING never set: still pre-lit, the old behaviour.
  freshDevice();
  setMaterial([1, 1, 1, 1], [1, 1, 1, 1]);
  assert.strictEqual(hex(lit(FVF, 0x80123456).color), hex(0x80123456), 'LIGHTING unset: pre-lit colour kept');

  // CMR2's car: material source, zero diffuse dword, AMBIENT render state only.
  e.test_d7lit_rs(LIGHTING, 1);
  e.test_d7lit_rs(AMBIENT, 0xff404040);
  let r = lit(FVF, 0);
  assert.strictEqual(r.type, 2, 'lit vertices are drawn as LVERTEX');
  assert.strictEqual(hex(r.color), hex(0xff404040), 'ambient only: RS_AMBIENT x material ambient');
  assert.strictEqual(r.spec & 0xffffff, 0, 'disabled computed specular RGB is black');

  // Directional red light along +Z hits a -Z normal head on.
  setLight(0, { type: 3, diffuse: [1, 0, 0, 1], direction: [0, 0, 1] });
  assert.strictEqual(hex(lit(FVF, 0).color), hex(0xff404040), 'a set but disabled light adds nothing');
  e.test_d7lit_enable(0, 1);
  assert.strictEqual(hex(lit(FVF, 0).color), hex(0xffff4040), 'enabled directional light adds N.L x diffuse');

  // Facing away from the light: no diffuse.
  setLight(0, { type: 3, diffuse: [1, 0, 0, 1], direction: [0, 0, -1] });
  assert.strictEqual(hex(lit(FVF, 0).color), hex(0xff404040), 'back-facing normal gets no diffuse');

  // Point light 1 unit in front, attenuation 1/(2 + 0 + 0): half green, plus its ambient.
  e.test_d7lit_enable(0, 0);
  setLight(1, { type: 1, diffuse: [0, 1, 0, 1], ambient: [0, 0, 0.5, 1], position: [0, 0, -1], atten: [2, 0, 0], range: 10 });
  e.test_d7lit_enable(1, 1);
  assert.strictEqual(hex(lit(FVF, 0).color), hex(0xff40c080), 'point light: attenuated diffuse and ambient');
  setLight(1, { type: 1, diffuse: [0, 1, 0, 1], position: [0, 0, -1], atten: [2, 0, 0], range: 0.5 });
  assert.strictEqual(hex(lit(FVF, 0).color), hex(0xff404040), 'point light beyond dvRange adds nothing');
  e.test_d7lit_enable(1, 0);

  // DIFFUSEMATERIALSOURCE=COLOR1 with COLORVERTEX: the vertex colour is the
  // diffuse reflectance and supplies the alpha.
  setLight(0, { type: 3, diffuse: [1, 1, 1, 1], direction: [0, 0, 1] });
  e.test_d7lit_enable(0, 1);
  e.test_d7lit_rs(AMBIENT, 0);
  e.test_d7lit_rs(COLORVERTEX, 1);
  e.test_d7lit_rs(DIFFUSEMATERIALSOURCE, 1);
  assert.strictEqual(hex(lit(FVF, 0x80204080).color), hex(0x80204080), 'COLOR1 diffuse source');
  e.test_d7lit_rs(DIFFUSEMATERIALSOURCE, 0);
  setMaterial([0.5, 0.5, 0.5, 0.25], [0, 0, 0, 0], [0, 0, 0.25, 0]);
  assert.strictEqual(hex(lit(FVF, 0x80204080).color), hex(0x408080c0), 'material diffuse + emissive, material alpha');

  // XYZ|NORMAL|TEX1 (a D3DVERTEX) is converted to a lit LVERTEX, UVs intact.
  r = lit(XYZ | NORMAL | TEX1);
  assert.strictEqual(r.type, 2, 'D3DVERTEX comes back as LVERTEX');
  assert.strictEqual(hex(r.color), hex(0x408080c0));
  // Black specular whose alpha, the vertex fog factor, is 255 (no fog): with
  // 0 there, FOGENABLE fogged every D3D-lit vertex solid (Evolva's world).
  assert.strictEqual(r.spec >>> 0, 0xFF000000,
    'D3DVERTEX normal dwords replaced by a no-fog black specular');
  f32[0] = 0.25;
  assert.strictEqual(r.tu, u32[0], 'tu kept');

  // Pre-transformed vertices are never lit.
  r = { type: e.test_d7lit_light(0x144, vertex(XYZ), 0, 1, 3) };
  assert.strictEqual(r.type, 3, 'XYZRHW passes through');

  console.log('PASS  D3D7 FVF lighting: material/vertex sources, ambient, directional/point lights, enable mask, range');
})().catch(err => { console.error(err && err.stack || err); process.exit(1); });
