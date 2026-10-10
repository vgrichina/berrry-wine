#!/usr/bin/env node
'use strict';

// IDirect3DDevice7::Load(this, lpDestTex, lpDestPoint, lpSrcTex, lprcSrcRect,
// dwFlags) is six stdcall dwords. Our handler used to pop seven and copy
// nothing: Deus Ex's D3DDrv uploads every texture through it, and the extra
// dword left its SetTexture epilogue restoring a garbage EBX, so the next
// SetTexture got a NULL FTextureInfo and asserted "Pool". The whole-texture
// form must also copy every level of the mip chain, not only level 0.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_d7l_metadata") (param $surface i32) (param $pal i32) (param $key i32)
    (local $entry i32)
    (local.set $entry (call $dx_from_this (local.get $surface)))
    (call $dx_surf_pal_set (local.get $entry) (call $g2w (local.get $pal)))
    (store.field DxObject misc2 (local.get $entry) (local.get $key))
    (store.field DxObject flags (local.get $entry)
      (i32.or (load.field DxObject flags (local.get $entry)) (i32.const 0x100))))
  (func (export "test_d7l_key") (param $surface i32) (result i32)
    (load.field DxObject misc2 (call $dx_from_this (local.get $surface))))
  (func (export "test_d7l_rect") (param $dst i32) (param $point i32) (param $src i32) (param $rect i32) (result i32)
    (call $handle_IDirect3DDevice7_Load (i32.const 0) (local.get $dst) (local.get $point)
      (local.get $src) (local.get $rect) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "test_d7l_seed") (param $ddraw_vtbl i32) (param $surface_vtbl i32)
    (global.set $DX_VTBL_DDRAW (local.get $ddraw_vtbl))
    (global.set $DX_VTBL_DDSURF2 (local.get $surface_vtbl)))
  (func (export "test_d7l_create_surface") (param $desc i32) (param $out i32) (result i32)
    (local $ddraw i32)
    (local.set $ddraw (call $dx_create_com_obj (i32.const 1) (global.get $DX_VTBL_DDRAW)))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDraw_CreateSurface
      (local.get $ddraw) (local.get $desc) (local.get $out) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_d7l_dib") (param $surface i32) (result i32)
    (i32.load offset=20 (call $dx_from_this (local.get $surface))))
  (func (export "test_d7l_next") (param $surface i32) (result i32)
    (load.field DxObject misc0 (call $dx_from_this (local.get $surface))))
  (func (export "test_d7l_set_esp") (param $v i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $v)))
  (func (export "test_d7l_get_esp") (result i32)
    (i32.load offset=16 (global.get $reg_base)))
  (func (export "test_d7l_load") (param $dst i32) (param $src i32)
    (call $handle_IDirect3DDevice7_Load
      (i32.const 0) (local.get $dst) (i32.const 0) (local.get $src) (i32.const 0)
      (i32.const 0)))
`;

function makeMipTexture(wat, desc, out, size) {
  for (let i = 0; i < 128; i += 4) wat.guest_write32(desc + i, 0);
  wat.guest_write32(desc, 108);
  wat.guest_write32(desc + 4, 0x1007); // CAPS|HEIGHT|WIDTH|PIXELFORMAT
  wat.guest_write32(desc + 8, size);
  wat.guest_write32(desc + 12, size);
  wat.guest_write32(desc + 72, 32);
  wat.guest_write32(desc + 76, 0x40);  // DDPF_RGB
  wat.guest_write32(desc + 84, 16);
  wat.guest_write32(desc + 88, 0xf800);
  wat.guest_write32(desc + 92, 0x07e0);
  wat.guest_write32(desc + 96, 0x001f);
  wat.guest_write32(desc + 104, 0x401008); // TEXTURE|MIPMAP|COMPLEX
  assert.strictEqual(wat.test_d7l_create_surface(desc, out) >>> 0, 0);
  return wat.guest_read32(out) >>> 0;
}

const levels = (wat, top) => {
  const out = [];
  for (let s = top; s; s = wat.test_d7l_next(s) >>> 0) out.push(s);
  return out;
};

(async () => {
  const h = await bootRenderHarness({ extraWat, fonts: 'none' });
  const { exports: wat, memory } = h;
  const mem = new DataView(memory.buffer);
  const desc = 0x410000;
  const out = 0x410100;
  const STACK = 0x00420000;

  wat.test_d7l_seed(0x51000000, 0x52000000);
  const src = makeMipTexture(wat, desc, out, 4);
  const dst = makeMipTexture(wat, desc, out + 4, 4);
  const srcLevels = levels(wat, src);
  const dstLevels = levels(wat, dst);
  assert.strictEqual(srcLevels.length, 3, '4x4 pyramid is 4x4, 2x2, 1x1');
  assert.strictEqual(dstLevels.length, 3);

  // A distinct 16-bit value per level in the source; the destination is zero.
  const sizes = [4, 2, 1];
  srcLevels.forEach((s, level) => {
    const dib = wat.test_d7l_dib(s) >>> 0;
    for (let i = 0; i < sizes[level] * sizes[level]; i++) {
      mem.setUint16(dib + i * 2, 0x1111 * (level + 1), true);
    }
  });

  for (let i = 0; i < 32; i += 4) wat.guest_write32(STACK + i, 0);
  wat.test_d7l_set_esp(STACK);
  wat.test_d7l_load(dst, src);
  assert.strictEqual((wat.test_d7l_get_esp() >>> 0) - STACK, 4 + 6 * 4,
    'Load pops its return address and six dwords (this included)');

  dstLevels.forEach((d, level) => {
    const dib = wat.test_d7l_dib(d) >>> 0;
    for (let i = 0; i < sizes[level] * sizes[level]; i++) {
      assert.strictEqual(mem.getUint16(dib + i * 2, true), 0x1111 * (level + 1),
        `level ${level} texel ${i} was copied`);
    }
  });

  const point = 0x410200, rect = 0x410220;
  const clear = () => dstLevels.forEach((d, level) => {
    const pitch = (sizes[level] * 2 + 3) & ~3;
    new Uint8Array(memory.buffer, wat.test_d7l_dib(d) >>> 0, pitch * sizes[level]).fill(0);
  });
  clear();
  const sourcePalette = 0x430000, destPalette = 0x431000;
  wat.test_d7l_metadata(src, sourcePalette, 0x1234);
  wat.test_d7l_metadata(dst, destPalette, 0x4321);
  for (let i = 0; i < 256; i++) wat.guest_write32(sourcePalette + i * 4, i * 0x010101);
  wat.guest_write32(point, 0); wat.guest_write32(point + 4, 0);
  [1, 1, 3, 3].forEach((v, i) => wat.guest_write32(rect + i * 4, v));
  wat.test_d7l_set_esp(STACK);
  assert.strictEqual(wat.test_d7l_rect(dst, point, src, rect) >>> 0, 0);
  assert.strictEqual(wat.test_d7l_key(dst) >>> 0, 0x1234);
  for (let i = 0; i < 256; i++)
    assert.strictEqual(wat.guest_read32(destPalette + i * 4) >>> 0, i * 0x010101);
  assert.strictEqual((wat.test_d7l_get_esp() >>> 0) - STACK, 28);
  dstLevels.forEach((d, level) => {
    const base = wat.test_d7l_dib(d) >>> 0, n = sizes[level], pitch = (n * 2 + 3) & ~3;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const expected = level || (x < 2 && y < 2) ? 0x1111 * (level + 1) : 0;
      assert.strictEqual(mem.getUint16(base + y * pitch + x * 2, true), expected,
        `rect copy level ${level} (${x},${y}) preserves outside pixels`);
    }
  });
  clear();
  wat.guest_write32(point, 3); // 2-wide copy cannot fit at x=3.
  wat.test_d7l_set_esp(STACK);
  assert.strictEqual(wat.test_d7l_rect(dst, point, src, rect) >>> 0, 0x80070057);
  assert.strictEqual(mem.getUint16(wat.test_d7l_dib(dst) >>> 0, true), 0);
  // Nonzero destination point, with mip edges rounded outward.
  wat.guest_write32(point, 1); wat.guest_write32(point + 4, 1);
  [0, 0, 2, 2].forEach((v, i) => wat.guest_write32(rect + i * 4, v));
  wat.test_d7l_set_esp(STACK);
  assert.strictEqual(wat.test_d7l_rect(dst, point, src, rect) >>> 0, 0);
  const base = wat.test_d7l_dib(dst) >>> 0;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++)
    assert.strictEqual(mem.getUint16(base + y * 8 + x * 2, true),
      x >= 1 && x < 3 && y >= 1 && y < 3 ? 0x1111 : 0);
  // A destination may start at a smaller source mip level.
  const small = makeMipTexture(wat, desc, out + 8, 2);
  wat.guest_write32(point, 0); wat.guest_write32(point + 4, 0);
  [1, 1, 3, 3].forEach((v, i) => wat.guest_write32(rect + i * 4, v));
  wat.test_d7l_set_esp(STACK);
  assert.strictEqual(wat.test_d7l_rect(small, point, src, rect) >>> 0, 0);
  for (let i = 0; i < 4; i++)
    assert.strictEqual(mem.getUint16((wat.test_d7l_dib(small) >>> 0) + i * 2, true), 0x2222);
  console.log('PASS IDirect3DDevice7::Load: stdcall, mip chains, rectangles and invalid bounds');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
