#!/usr/bin/env node
'use strict';

// Full source-closure VM integration, after palette candidate patches 01-05.
// No export substitutions: descriptor, decoder, writes and leases are real.
// This exercises CPU-side GPU upload preparation; it does not create WebGL.
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const { D3DIMGpu } = require('../lib/d3dim-gpu');

const extraWat = String.raw`
  (export "pa_alloc" (func $heap_alloc))
  (export "pa_w2g" (func $w2g))
  (export "pa_entry" (func $dx_from_this))
  (export "pa_bind" (func $d3dim_set_texture))
  (func (export "pa_seed") (param $vt i32)
    (global.set $DX_VTBL_DDRAW (local.get $vt))
    (global.set $DX_VTBL_DDSURF2 (i32.add (local.get $vt) (i32.const 256)))
    (global.set $DX_VTBL_DDPAL (i32.add (local.get $vt) (i32.const 512)))
    (global.set $DX_VTBL_D3DDEV1 (i32.add (local.get $vt) (i32.const 768))))
  (func (export "pa_stack") (param $sp i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $sp)))
  (func (export "pa_ddraw") (result i32)
    (call $dx_create_com_obj (i32.const 1) (global.get $DX_VTBL_DDRAW)))
  (func (export "pa_surface") (param $dd i32) (param $desc i32) (param $out i32) (result i32)
    (call $handle_IDirectDraw_CreateSurface (local.get $dd) (local.get $desc)
      (local.get $out) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "pa_palette") (param $dd i32) (param $caps i32) (param $entries i32) (param $out i32) (result i32)
    (call $handle_IDirectDraw_CreatePalette (local.get $dd) (local.get $caps)
      (local.get $entries) (local.get $out) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "pa_attach") (param $surface i32) (param $palette i32) (result i32)
    (call $handle_IDirectDrawSurface_SetPalette (local.get $surface) (local.get $palette)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "pa_entries") (param $palette i32) (param $start i32) (param $count i32) (param $entries i32) (result i32)
    (call $handle_IDirectDrawPalette_SetEntries (local.get $palette) (i32.const 0)
      (local.get $start) (local.get $count) (local.get $entries) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "pa_device") (param $surface i32) (param $out i32) (result i32)
    (call $d3dim_create_device (i32.const 0) (local.get $surface)
      (local.get $out) (global.get $DX_VTBL_D3DDEV1))
    (i32.load (global.get $reg_base)))
  (func (export "pa_palette_data") (param $palette i32) (result i32)
    (load.field DxObject misc1 (call $dx_from_this (local.get $palette))))
`;

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none' });
  e.heap_init(0x2000000); // guest heap extent, as in test-page-watch.js
  const alloc = n => { const p = e.pa_alloc(n) >>> 0; assert(p); return p; };
  const stack = alloc(4096) + 2048;
  const call = (fn, ...args) => { e.pa_stack(stack); return fn(...args) >>> 0; };
  // Distinct allocated vtable identities are required by COM validation.
  // Handlers are called directly, so no PE/thunk initialization is needed.
  e.pa_seed(alloc(1024));
  const dd = e.pa_ddraw() >>> 0; assert(dd);
  const desc = alloc(128), out = alloc(16), entries = alloc(1024);
  const surface = (bpp, caps) => {
    for (let i = 0; i < 128; i += 4) e.guest_write32(desc + i, 0);
    for (const [off, value] of [[0,108],[4,0x1007],[8,4],[12,4],[72,32],
      [76,bpp === 8 ? 0x60 : 0x40],[84,bpp],[104,caps]]) e.guest_write32(desc + off, value);
    if (bpp === 16) for (const [off, value] of [[88,0xf800],[92,0x7e0],[96,0x1f]])
      e.guest_write32(desc + off, value);
    assert.equal(call(e.pa_surface, dd, desc, out), 0);
    const p = e.guest_read32(out) >>> 0; assert(p); return p;
  };
  const texture = surface(8, 0x1000); // DDSCAPS_TEXTURE: alpha palettes require this.
  const rt = surface(16, 0x2040); // 3DDEVICE | OFFSCREENPLAIN
  assert.equal(call(e.pa_device, rt, out), 0);
  const device = e.guest_read32(out) >>> 0; assert(device);
  e.pa_bind(device, 0, texture);
  const rgb = [23, 57, 202];
  const entry = alpha => rgb[0] | rgb[1] << 8 | rgb[2] << 16 | alpha << 24;
  for (let i = 0; i < 256; i++) e.guest_write32(entries + 4 * i, entry(255));
  [0,128,255].forEach((a,i) => e.guest_write32(entries + 4 * (7+i), entry(a)));
  const palette = caps => {
    // Separate palette pages from later allocator/descriptor traffic.
    alloc(8192);
    assert.equal(call(e.pa_palette, dd, caps, entries, out), 0);
    const p = e.guest_read32(out) >>> 0; assert(p); alloc(8192); return p;
  };
  const alpha = palette(0x404), ordinary = palette(0x4); // ALPHA | 8BIT, 8BIT
  const alphaData = e.pa_palette_data(alpha) >>> 0;
  const ordinaryData = e.pa_palette_data(ordinary) >>> 0;
  const bytes = p => Array.from(new Uint8Array(memory.buffer, p, 1024));
  assert.deepEqual(bytes(alphaData), bytes(ordinaryData), 'mode controls start byte-identical');
  assert.equal(call(e.pa_attach, rt, alpha), 0x88760250, 'nontexture rejects alpha palette');
  assert.equal(call(e.pa_attach, texture, alpha), 0);
  const gpu = new D3DIMGpu({ getExports: () => e, getMemory: () => memory.buffer,
    createCanvas: () => { throw Error('unexpected GL creation'); },
    onError: message => { throw Error(message); } });
  const target = { textureKeys: new Set() };
  e.set_page_watch_audit(0);
  gpu._view();
  let d = gpu._describe(device);
  assert(d && d.texture === (e.pa_entry(texture) >>> 0));
  assert.equal(d.texBpp, 8); assert.equal(d.keyed, 0);
  const dibGuest = e.pa_w2g(d.texDib) >>> 0;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++)
    e.guest_write8(dibGuest + y * d.texPitch + x, 7 + x % 3);
  // Allocate decoder scratch before the cache acquires page leases.
  assert(e.d3dim_gpu_decode_texture(d.texture, 0));
  const refresh = (mode, expectedAlpha, expectedPalette, previousKey) => {
    d = gpu._describe(device); assert(d);
    assert.equal(d.paletteAlpha, mode); assert.equal(d.palette, expectedPalette);
    const uploads = gpu.stats.textureUploads;
    const image = gpu._texture(target, d); assert(image && image.pixels);
    assert.equal(gpu.stats.textureUploads, uploads + 1, 'exactly one new decode/cache generation');
    if (previousKey) assert.notEqual(image.key, previousKey);
    const cached = gpu.textures.get(d.texture);
    assert(cached.watch, 'actual texture page lease');
    assert.equal(cached.raw, null, 'watch path must not fall back to byte shadows');
    if (expectedPalette) {
      assert(cached.paletteWatch, 'actual palette page lease');
      assert.equal(cached.paletteRaw, null);
      assert.equal(cached.paletteWatch.changes(), null, 'palette generation acknowledged');
    } else assert.equal(cached.paletteWatch, null);
    for (let x = 0; x < 3; x++) assert.deepEqual(Array.from(image.pixels.slice(x*4,x*4+4)),
      [...(expectedPalette ? rgb : [7+x,7+x,7+x]), expectedAlpha[x]]);
    for (let i = 0; i < 8; i++) {
      const hit = gpu._texture(target, gpu._describe(device));
      assert.equal(hit.key, image.key); assert.equal(hit.pixels, undefined);
    }
    assert.equal(gpu.stats.textureUploads, uploads + 1, 'stable reuse after refresh');
    assert.equal(gpu.stats.textureByteChecks, 0, 'real page-watch path throughout');
    return image.key;
  };
  let key = refresh(1, [0,128,255], alphaData);
  const setFlags = (pal, data, values) => {
    const before = bytes(data);
    const watch = gpu.textures.get(d.texture).paletteWatch;
    assert.equal(watch.changes(), null);
    values.forEach((a,i) => e.guest_write32(entries + 4*i, entry(a)));
    assert.equal(call(e.pa_entries, pal, 7, 3, entries), 0);
    const after = bytes(data);
    const changes = before.flatMap((v,i) => v === after[i] ? [] : [i]);
    assert.deepEqual(changes, [31,35,39], 'only three peFlags bytes changed');
    assert(watch.changes(), 'real SetEntries memcpy notifies the active palette lease');
  };
  setFlags(alpha, alphaData, [255,0,128]);
  key = refresh(1, [255,0,128], alphaData, key);
  setFlags(alpha, alphaData, [0,128,255]);
  key = refresh(1, [0,128,255], alphaData, key);
  assert.deepEqual(bytes(alphaData), bytes(ordinaryData));
  assert.equal(call(e.pa_attach, texture, ordinary), 0);
  key = refresh(0, [255,255,255], ordinaryData, key);
  assert.equal(call(e.pa_attach, texture, alpha), 0);
  key = refresh(1, [0,128,255], alphaData, key);
  assert.equal(call(e.pa_attach, texture, 0), 0);
  assert.equal(e.get_dx_primary_pal_wa(), 0, 'detach grayscale oracle requires no primary fallback');
  key = refresh(0, [255,255,255], 0, key);
  assert.equal(call(e.pa_attach, texture, ordinary), 0);
  key = refresh(0, [255,255,255], ordinaryData, key);
  setFlags(ordinary, ordinaryData, [255,0,128]);
  refresh(0, [255,255,255], ordinaryData, key);
  assert(gpu.stats.pageChecks > 0);
  assert.equal(gpu.stats.dirtyAuditMisses, 0);
  gpu.stop();
  console.log('PASS full-VM palette-alpha upload cache: real API, descriptor, decoder and page watches');
})().catch(error => { console.error(error); process.exitCode = 1; });
