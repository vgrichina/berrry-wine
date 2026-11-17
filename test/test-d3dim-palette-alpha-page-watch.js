#!/usr/bin/env node
'use strict';

// Full source-closure VM integration, after palette candidate patches 01-05.
// No export substitutions: descriptor, decoder, writes and leases are real.
// Real textured D3DIM draws go through the WAT GPU stream producer
// (src/09abg-d3dim-gps.wat $d3g_texture: texture cache keyed by signature
// and page-watch generations) into the real software executor
// (lib/gpu-stream-software.js), whose texture resource holds what was
// decoded and uploaded. It does not create WebGL.
const assert = require('assert');
const GS = require('../lib/gpu-stream');
const { Executor: SoftwareExecutor } = require('../lib/gpu-stream-software');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (export "pa_alloc" (func $heap_alloc))
  (export "pa_w2g" (func $w2g))
  (export "pa_entry" (func $dx_from_this))
  (export "pa_bind" (func $d3dim_set_texture))
  (func (export "pa_capacity") (result i32) (global.get $DX_MAX))
  (func (export "pa_refs") (param $obj i32) (result i32)
    (load.field DxObject refcount (call $dx_from_this (local.get $obj))))
  (func (export "pa_type") (param $obj i32) (result i32)
    (i32.load (call $dx_from_this (local.get $obj))))
  (func (export "pa_release") (param $obj i32) (result i32)
    (call $handle_IDirectDrawPalette_Release (local.get $obj) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
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
  (export "pa_heap_top" (func $heap_low_watermark))
  ;; DrawPrimitive(D3DPT_TRIANGLELIST, D3DVT_TLVERTEX) as the handler does it.
  (func (export "pa_draw") (param $device i32) (param $vertices i32) (param $count i32)
    (call $d3dim_draw_primitive (local.get $device) (i32.const 4) (i32.const 3)
      (local.get $vertices) (local.get $count)))
`;

(async () => {
  let e, memory, gps = null, ring = null, ringAddr = 0;
  const hostCalls = [];
  const h = await bootRenderHarness({ extraWat, fonts: 'none', extraHostOverrides: {
    gpu_gl_call: (...args) => { hostCalls.push(args[0]); return 0; },
    gpu_stream_kick: (r, mode) => {
      r >>>= 0;
      if (!gps) gps = new SoftwareExecutor({ getExports: () => e, getMemory: () => memory.buffer });
      if (!ring || ringAddr !== r) { ring = new GS.Ring(() => memory.buffer, r); ringAddr = r; }
      GS.drain([ring], gps);
      if ((mode | 0) === GS.CONST.KICK_CLOSE) { gps.close(); gps = null; ring = null; ringAddr = 0; }
      return 1;
    } } });
  e = h.exports; memory = h.memory;
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
    // The software executor rasterizes in this same wasm instance and its
    // WAT rasterizer heap-allocates per draw, writing those blocks through
    // notifying stores. A palette placed in one of their freed holes shares
    // a 4 KB page with them, so every drain bumps its page watch and the
    // cache (correctly, at page granularity) re-uploads. Fill the holes
    // first so the palette comes from fresh heap, between page-sized pads.
    for (let i = 0; i < 100000; i++) {
      const top = e.pa_heap_top() >>> 0;
      if (alloc(1024) >= top) break;
    }
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

  // Real page-watch directory (as test-page-watch.js reads it).
  const u32 = new Uint32Array(memory.buffer), u64 = new BigUint64Array(memory.buffer);
  const root = e.page_watch_root() >>> 0;
  const cell = wa => Atomics.load(u32, (root >>> 2) + (wa >>> 22)) + ((wa >>> 12) & 1023) * 16;
  const refs = wa => cell(wa) ? Atomics.load(u32, cell(wa) >>> 2) : 0;
  const generation = wa => cell(wa) ? Atomics.load(u64, (cell(wa) + 8) >>> 3) : 0n;

  // Descriptor words the producer reads ($d3dim_gpu_describe).
  const describe = () => {
    const d = e.d3dim_gpu_describe(device) >>> 0; assert(d);
    const w = off => new DataView(memory.buffer).getUint32(d + off, true);
    return { texture: w(28), texBpp: w(40), texPitch: w(44), texDib: w(48), keyed: w(52),
      palette: w(60), paletteAlpha: w(156) };
  };
  e.set_page_watch_audit(0);
  let d = describe();
  assert(d.texture === (e.pa_entry(texture) >>> 0));
  assert.equal(d.texBpp, 8); assert.equal(d.keyed, 0);
  const dibGuest = e.pa_w2g(d.texDib) >>> 0;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++)
    e.guest_write8(dibGuest + y * d.texPitch + x, 7 + x % 3);
  // Allocate decoder scratch before the cache acquires page leases.
  assert(e.d3dim_gpu_decode_texture(d.texture, 0));

  // A full-target textured quad: TLVERTEX {x, y, z, rhw, color, specular, u, v}.
  const vertices = alloc(6 * 32);
  const f32 = v => { const b = new DataView(new ArrayBuffer(4)); b.setFloat32(0, v, true); return b.getUint32(0, true); };
  [[0,0,0,0],[4,0,1,0],[0,4,0,1],[4,0,1,0],[4,4,1,1],[0,4,0,1]].forEach(([x, y, u, v], i) => {
    for (const [off, value] of [[0,f32(x)],[4,f32(y)],[8,f32(0.5)],[12,f32(1)],[16,0xffffffff],[20,0],[24,f32(u)],[28,f32(v)]])
      e.guest_write32(vertices + i * 32 + off, value);
  });
  const uploads = () => e.d3dim_gps_stat(8);
  const draw = () => {
    const draws = e.d3dim_gps_stat(0), fallbacks = e.d3dim_gps_stat(1);
    e.pa_draw(device, vertices, 6);
    assert.equal(e.d3dim_gps_stat(0), draws + 1, 'the producer took the textured draw');
    assert.equal(e.d3dim_gps_stat(1), fallbacks, 'no software fallback');
  };
  // The executor's copy of the 4x4 texture: the newest one uploaded.
  const uploaded = () => {
    GS.drain([ring], gps); // records written since the producer's last kick
    const t = [...gps.res.values()].filter(r => r.kind === GS.KIND.TEX2D && r.width === 4 && r.height === 4)
      .sort((a, b) => b.id - a.id)[0];
    assert(t, 'a texture resource exists'); return t.levels[0].pixels;
  };
  const watched = p => p ? [generation(d.texDib), generation(p)] : [generation(d.texDib)];

  const refresh = (mode, expectedAlpha, expectedPalette) => {
    d = describe();
    assert.equal(d.paletteAlpha, mode); assert.equal(d.palette, expectedPalette);
    const before = uploads();
    draw();
    const atDraw = watched(expectedPalette);
    assert.equal(uploads(), before + 1, 'exactly one new decode/cache generation');
    assert(refs(d.texDib) > 0, 'actual texture page lease');
    if (expectedPalette) assert(refs(expectedPalette) > 0, 'actual palette page lease');
    const pixels = uploaded();
    for (let x = 0; x < 3; x++) assert.deepEqual(Array.from(pixels.slice(x*4,x*4+4)),
      [...(expectedPalette ? rgb : [7+x,7+x,7+x]), expectedAlpha[x]]);
    assert.deepEqual(watched(expectedPalette), atDraw, 'executing the draw wrote no watched page');
    for (let i = 0; i < 8; i++) draw();
    uploaded();
    assert.deepEqual(watched(expectedPalette), atDraw, 'no watched page written while reusing');
    assert.equal(uploads(), before + 1, 'stable reuse after refresh');
  };
  refresh(1, [0,128,255], alphaData);
  const setFlags = (pal, data, values) => {
    const before = bytes(data), gen = generation(data);
    values.forEach((a,i) => e.guest_write32(entries + 4*i, entry(a)));
    assert.equal(call(e.pa_entries, pal, 7, 3, entries), 0);
    const after = bytes(data);
    const changes = before.flatMap((v,i) => v === after[i] ? [] : [i]);
    assert.deepEqual(changes, [31,35,39], 'only three peFlags bytes changed');
    assert(generation(data) > gen, 'real SetEntries memcpy notifies the active palette lease');
  };
  setFlags(alpha, alphaData, [255,0,128]);
  refresh(1, [255,0,128], alphaData);
  setFlags(alpha, alphaData, [0,128,255]);
  refresh(1, [0,128,255], alphaData);
  assert.deepEqual(bytes(alphaData), bytes(ordinaryData));
  assert.equal(call(e.pa_attach, texture, ordinary), 0);
  refresh(0, [255,255,255], ordinaryData);
  assert.equal(call(e.pa_attach, texture, alpha), 0);
  refresh(1, [0,128,255], alphaData);
  assert.equal(call(e.pa_attach, texture, 0), 0);
  assert.equal(e.get_dx_primary_pal_wa(), 0, 'detach grayscale oracle requires no primary fallback');
  refresh(0, [255,255,255], 0);
  assert.equal(call(e.pa_attach, texture, ordinary), 0);
  refresh(0, [255,255,255], ordinaryData);
  setFlags(ordinary, ordinaryData, [255,0,128]);
  refresh(0, [255,255,255], ordinaryData);
  // Real COM ownership and allocator reuse, without a synthetic refcount or
  // forced allocator cursor. This remains a single-thread full-VM test: it
  // does NOT establish that Release drains a production Worker queue.
  assert.equal(e.pa_refs(ordinary), 2);
  assert.equal(call(e.pa_attach, texture, ordinary), 0);
  assert.equal(e.pa_refs(ordinary), 2, 'same attachment does not leak a reference');
  assert.equal(call(e.pa_attach, texture, alpha), 0);
  refresh(1, [0,128,255], alphaData);
  assert.equal(e.pa_refs(ordinary), 1, 'replacement releases previous attachment');
  assert.equal(e.pa_refs(alpha), 2);
  const retiredEntry = e.pa_entry(alpha) >>> 0;
  // Keep every unused DX slot live, so retiring alpha leaves exactly one
  // reusable slot. Filler objects need no guest heap payload or PE assets.
  let filled = false;
  for (let i = 0; i <= e.pa_capacity(); i++) {
    if (!e.pa_ddraw()) { filled = true; break; }
  }
  assert(filled, 'bounded production allocator exhaustion');
  assert.equal(call(e.pa_release, alpha), 1, 'caller Release preserves attachment');
  assert.equal(e.pa_type(alpha), 3);
  const kept = uploads();
  draw();
  assert.equal(uploads(), kept, 'caller Release preserves cached generation');
  assert.equal(call(e.pa_attach, texture, 0), 0);
  assert.equal(e.pa_type(alpha), 0, 'final detach retires palette');
  refresh(0, [255,255,255], 0);
  const replacement = palette(4);
  assert.equal(e.pa_entry(replacement) >>> 0, retiredEntry, 'actual retired slot reused');
  assert.equal(e.pa_refs(replacement), 1, 'reused slot has fresh ownership');
  assert.equal(call(e.pa_attach, texture, replacement), 0);
  refresh(0, [255,255,255], e.pa_palette_data(replacement) >>> 0);
  assert.equal(call(e.pa_release, replacement), 1);
  assert.equal(call(e.pa_attach, texture, 0), 0);
  assert.equal(e.pa_type(replacement), 0);
  refresh(0, [255,255,255], 0);
  assert.equal(call(e.pa_release, ordinary), 0, 'unattached final Release retires palette');
  assert.deepEqual(hostCalls, [], 'the WAT producer never calls the host gpu_gl_call');
  console.log('PASS full-VM palette-alpha upload cache: real API, descriptor, decoder, page watches and WAT producer');
})().catch(error => { console.error(error); process.exitCode = 1; });
