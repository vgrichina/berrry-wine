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
  (func (export "test_d7l_metadata") (param $surface i32) (param $pal i32) (param $key i32) (result i32)
    (local $entry i32) (local $out i32) (local $obj i32) (local $data i32) (local $esp i32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (local.set $entry (call $dx_from_this (local.get $surface)))
    (local.set $out (call $heap_alloc (i32.const 4)))
    (call $handle_IDirectDraw_CreatePalette (i32.const 0) (i32.const 4)
      (local.get $pal) (local.get $out) (i32.const 0) (i32.const 0))
    (if (i32.load (global.get $reg_base)) (then (unreachable))) ;; assert CreatePalette DD_OK
    (local.set $obj (i32.load (call $g2w (local.get $out))))
    (call $handle_IDirectDrawSurface_SetPalette (local.get $surface) (local.get $obj)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (if (i32.load (global.get $reg_base)) (then (unreachable))) ;; assert SetPalette DD_OK
    (call $handle_IDirectDrawPalette_Release (local.get $obj)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (if (i32.ne (i32.load (global.get $reg_base)) (i32.const 1)) (then (unreachable))) ;; surface owns one reference
    (local.set $data (call $w2g (call $dx_surf_pal_get (local.get $entry))))
    (call $heap_free (local.get $out))
    (store.field DxObject misc2 (local.get $entry) (local.get $key))
    (store.field DxObject flags (local.get $entry)
      (i32.or (load.field DxObject flags (local.get $entry)) (i32.const 0x100)))
    (i32.store offset=16 (global.get $reg_base) (local.get $esp))
    (local.get $data))
  (func (export "test_d7l_key") (param $surface i32) (result i32)
    (load.field DxObject misc2 (call $dx_from_this (local.get $surface))))
  (func (export "test_d7l_set_key") (param $surface i32) (param $key i32)
    (store.field DxObject misc2 (call $dx_from_this (local.get $surface)) (local.get $key)))
  (func (export "test_d7l_rect") (param $dst i32) (param $point i32) (param $src i32) (param $rect i32) (result i32)
    (call $handle_IDirect3DDevice7_Load (i32.const 0) (local.get $dst) (local.get $point)
      (local.get $src) (local.get $rect) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "test_d7l_seed") (param $ddraw_vtbl i32) (param $surface_vtbl i32) (param $palette_vtbl i32)
    (global.set $DX_VTBL_DDPAL (local.get $palette_vtbl))
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
  (func (export "test_d7l_link") (param $surface i32) (param $next i32)
    (store.field DxObject misc0 (call $dx_from_this (local.get $surface)) (local.get $next)))
  (func (export "test_d7l_bpp") (param $surface i32) (param $bpp i32)
    (store.field DxObject bpp (call $dx_from_this (local.get $surface)) (local.get $bpp)))
  (func (export "test_d7l_wrong") (result i32)
    (call $dx_create_com_obj (i32.const 1) (global.get $DX_VTBL_DDRAW)))
  (func (export "test_d7l_release") (param $surface i32) (result i32)
    (call $handle_IDirectDrawSurface_Release (local.get $surface)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "test_d7l_set_esp") (param $v i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $v)))
  (func (export "test_d7l_get_esp") (result i32)
    (i32.load offset=16 (global.get $reg_base)))
  (func (export "test_d7l_load") (param $dst i32) (param $src i32)
    (call $handle_IDirect3DDevice7_Load
      (i32.const 0) (local.get $dst) (i32.const 0) (local.get $src) (i32.const 0)
      (i32.const 0)))
`;

function makeMipTexture(wat, desc, out, size, bpp = 16) {
  for (let i = 0; i < 128; i += 4) wat.guest_write32(desc + i, 0);
  wat.guest_write32(desc, 108);
  wat.guest_write32(desc + 4, 0x1007); // CAPS|HEIGHT|WIDTH|PIXELFORMAT
  wat.guest_write32(desc + 8, size);
  wat.guest_write32(desc + 12, size);
  wat.guest_write32(desc + 72, 32);
  wat.guest_write32(desc + 76, bpp === 8 ? 0x60 : 0x40); // RGB | optional PALETTEINDEXED8
  wat.guest_write32(desc + 84, bpp);
  wat.guest_write32(desc + 88, bpp === 8 ? 0 : 0xf800);
  wat.guest_write32(desc + 92, bpp === 8 ? 0 : 0x07e0);
  wat.guest_write32(desc + 96, bpp === 8 ? 0 : 0x001f);
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

  wat.test_d7l_seed(0x51000000, 0x52000000, 0x53000000);
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
  const sourcePalette = wat.test_d7l_metadata(src, 0x430000, 0x1234) >>> 0;
  const destPalette = wat.test_d7l_metadata(dst, 0x431000, 0x4321) >>> 0;
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

  // Exercise the public handler, including its HRESULT and 28-byte epilogue,
  // for both nullable-geometry forms. Bad later links must not look like a
  // legitimate end of chain, even in a source tail the destination won't use.
  const wrong = wat.test_d7l_wrong() >>> 0;
  const released = makeMipTexture(wat, desc, out + 12, 1);
  assert.strictEqual(wat.test_d7l_release(released), 0);
  const snapshot = () => dstLevels.map((d, level) => ({
    pixels: Buffer.from(new Uint8Array(memory.buffer, wat.test_d7l_dib(d) >>> 0,
      ((sizes[level] * 2 + 3) & ~3) * sizes[level])),
    key: wat.test_d7l_key(d) >>> 0,
    palette: level ? null : Array.from({ length: 256 }, (_, i) =>
      wat.guest_read32(destPalette + i * 4) >>> 0),
  }));
  const invoke = (d, s, p, expected, label) => {
    wat.test_d7l_set_esp(STACK);
    wat.guest_write32(STACK + 28, 0xdeadbeef);
    assert.strictEqual(wat.test_d7l_rect(d, p, s, 0) >>> 0, expected, label);
    assert.strictEqual(wat.test_d7l_get_esp() >>> 0, STACK + 28, `${label}: ABI`);
    assert.strictEqual(wat.guest_read32(STACK + 28) >>> 0, 0xdeadbeef);
  };
  const reject = (d, s, p, expected, label) => {
    const before = snapshot();
    invoke(d, s, p, expected, label);
    assert.deepStrictEqual(snapshot(), before, `${label}: no pixels/palette/key changed`);
  };
  // Make metadata propagation observable if a rejected call starts copying.
  wat.test_d7l_set_key(src, 0x5678);
  wat.guest_write32(sourcePalette, 0xabcdef);
  for (const p of [0, point]) {
    for (const bad of [0, wrong, released, src + 1]) {
      reject(bad, src, p, 0x80070057, `invalid destination ${bad}, point=${p}`);
      reject(dst, bad, p, 0x80070057, `invalid source ${bad}, point=${p}`);
    }
    for (const [chain, next] of [[srcLevels, srcLevels[2]], [dstLevels, dstLevels[2]]]) {
      for (const bad of [wrong, released, chain[0]]) {
        wat.test_d7l_link(chain[1], bad);
        reject(dst, src, p, 0x80070057, `bad later link ${bad}, point=${p}`);
        wat.test_d7l_link(chain[1], next);
      }
    }
    // A malformed unused source tail still makes the complete chain invalid.
    wat.test_d7l_link(srcLevels[2], wrong);
    reject(dst, src, p, 0x80070057, 'invalid source tail');
    wat.test_d7l_link(srcLevels[2], 0);
    wat.test_d7l_bpp(dstLevels[2], 4);
    reject(dst, src, p, 0x80004001, 'unsupported later format');
    wat.test_d7l_bpp(dstLevels[2], 16);
    wat.test_d7l_link(srcLevels[1], 0);
    reject(dst, src, p, 0x80070057, 'source misses required destination level');
    wat.test_d7l_link(srcLevels[1], srcLevels[2]);
  }
  // Full nullable geometry must keep copying all mip pixels and metadata.
  wat.test_d7l_set_key(src, 0x1234);
  wat.guest_write32(sourcePalette, 0);
  clear();
  invoke(dst, src, 0, 0, 'valid complete full copy after rejections');
  dstLevels.forEach((d, level) => {
    const dib = wat.test_d7l_dib(d) >>> 0, n = sizes[level], pitch = (n * 2 + 3) & ~3;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++)
      assert.strictEqual(mem.getUint16(dib + y * pitch + x * 2, true), 0x1111 * (level + 1));
  });
  assert.strictEqual(wat.test_d7l_key(dst) >>> 0, 0x1234);
  for (let i = 0; i < 256; i++)
    assert.strictEqual(wat.guest_read32(destPalette + i * 4) >>> 0, i * 0x010101);
  // Preserve Texture::Load's indexed-palette expansion for both pixels and
  // the packed color key when the full form shares the rectangular path.
  const indexed = makeMipTexture(wat, desc, out + 16, 4, 8);
  const converted = makeMipTexture(wat, desc, out + 20, 4);
  levels(wat, indexed).forEach((s, level) => {
    const indexedPalette = wat.test_d7l_metadata(s, 0x432000 + level * 0x1000, 5) >>> 0;
    wat.guest_write32(indexedPalette + 5 * 4, 0x000000ff); // PALETTEENTRY red
    const n = sizes[level], pitch = (n + 3) & ~3;
    new Uint8Array(memory.buffer, wat.test_d7l_dib(s) >>> 0, pitch * n).fill(5);
  });
  for (const p of [0, point]) {
    invoke(converted, indexed, p, 0, 'indexed conversion');
    assert.strictEqual(wat.test_d7l_key(converted) >>> 0, 0xf800);
    levels(wat, converted).forEach((s, level) => {
      const n = sizes[level], pitch = (n * 2 + 3) & ~3;
      const dib = wat.test_d7l_dib(s) >>> 0;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++)
        assert.strictEqual(mem.getUint16(dib + y * pitch + x * 2, true), 0xf800);
    });
  }
  console.log('PASS IDirect3DDevice7::Load: stdcall, mip chains, rectangles and invalid bounds');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
