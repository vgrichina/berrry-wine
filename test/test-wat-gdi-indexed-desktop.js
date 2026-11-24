'use strict';
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

(async () => {
  const h = await bootRenderHarness({ width: 160, height: 120, extraWat: `
    (func (export "test_indexed_caps") (param i32 i32) (result i32)
      (local $esp i32)
      (local.set $esp (i32.load offset=16 (global.get $reg_base)))
      (call $handle_GetDeviceCaps (local.get 0) (local.get 1)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
      (i32.store offset=16 (global.get $reg_base) (local.get $esp))
      (i32.load (global.get $reg_base)))
    (func (export "test_indexed_mode") (param $buf i32) (param $wide i32) (result i32)
      (local $esp i32)
      (local.set $esp (i32.load offset=16 (global.get $reg_base)))
      (if (local.get $wide)
        (then (call $handle_EnumDisplaySettingsW (i32.const 0) (i32.const -1)
          (local.get $buf) (i32.const 0) (i32.const 0) (i32.const 0)))
        (else (call $handle_EnumDisplaySettingsA (i32.const 0) (i32.const -1)
          (local.get $buf) (i32.const 0) (i32.const 0) (i32.const 0))))
      (i32.store offset=16 (global.get $reg_base) (local.get $esp))
      (i32.load (global.get $reg_base)))
  ` });
  const w = h.exports, dv = new DataView(h.memory.buffer);
  const hwnd = 0x10001;
  w.set_desktop_color_depth(8);
  h.renderer.createWindow(hwnd, 0x10000000, 0, 0, 64, 48, 'Indexed palette', 0);
  w.wnd_table_set(hwnd, 0);
  w.ctrl_set_geom(hwnd, 0, 0, 64, 48);
  w.wnd_set_style_export(hwnd, 0x10000000);
  w.test_gdi_client_rect_set(hwnd, 0, 0, 64, 48);
  const dc = w.test_call_GetDC(hwnd);
  assert(dc);
  assert.equal(w.test_indexed_caps(dc, 12), 8);
  assert.equal(w.test_indexed_caps(dc, 14), 1);
  assert.equal(w.test_indexed_caps(dc, 104), 256);
  assert(w.test_indexed_caps(dc, 38) & 0x100);
  const mode = w.guest_alloc(220);
  for (const wide of [0, 1]) {
    w.guest_write16(mode + (wide ? 68 : 36), wide ? 220 : 156);
    assert.equal(w.test_indexed_mode(mode, wide), 1);
    assert.equal(w.guest_read32(mode + (wide ? 168 : 104)), 8, 'mode queries agree with GDI');
  }
  const record = w.test_gdi_window_surface_record(hwnd);
  assert.equal(dv.getUint32(record + 24, true), 8, 'actual backing is indexed');
  assert.equal(dv.getUint32(record + 20, true), 64, 'one byte per pixel');
  const bits = dv.getUint32(record + 16, true);
  const p = w.guest_alloc(16);
  w.guest_write16(p, 0x300); w.guest_write16(p + 2, 3);
  w.guest_write32(p + 4, 0x010000ed); // reserved red
  w.guest_write32(p + 8, 0x0000da00); // ordinary green
  w.guest_write32(p + 12, 0x01009999); // another reserved color
  const pal = w.test_call_CreatePalette(p);
  assert(pal);
  w.test_call_SelectPalette(dc, pal, 0);
  assert.equal(w.test_call_RealizePalette(dc), 3);
  assert.equal(w.test_call_RealizePalette(dc), 0, 'unchanged realization');
  w.test_call_SetPixel(dc, 4, 4, 0x01000000);
  const index = new Uint8Array(h.memory.buffer)[bits + 4 * 64 + 4];
  assert(index >= 10 && index < 246, 'reserved colors use a dynamic slot');
  const pixel = () => [...h.renderer.getWindowCanvas(hwnd).canvas.getContext('2d').getImageData(4,4,1,1).data];
  assert.deepEqual(pixel(), [237, 0, 0, 255]);
  const offscreen = w.test_call_CreateCompatibleBitmap(dc, 16, 16);
  const offscreenRecord = w.test_gdi_object_record(offscreen);
  assert.equal(dv.getUint32(offscreenRecord + 16, true), 8, 'device-compatible backing retains indices too');
  const memdc = w.test_call_CreateCompatibleDC(dc);
  w.test_call_SelectObject(memdc, offscreen);
  w.test_call_SelectPalette(memdc, pal, 0);
  w.test_call_SetPixel(memdc, 1, 1, 0x01000000);
  assert.equal(w.test_call_BitBlt(dc, 8, 8, 1, 1, memdc, 1, 1, 0x00cc0020), 1);
  assert.equal(new Uint8Array(h.memory.buffer)[bits + 8 * 64 + 8], index, 'DDB copy preserves the physical palette index');
  w.test_call_SetPixel(dc, 5, 5, 0x01000002);
  const update = w.guest_alloc(8);
  w.guest_write32(update, 0x00e10000); // blue
  w.guest_write32(update + 4, 0x00ffffff); // nonreserved must stay green
  const pending = w.guest_alloc(4);
  w.guest_write32(pending, 0x01a000a0);
  assert.equal(w.test_call_SetPaletteEntries(pal, 2, 1, pending), 1);
  assert.equal(w.test_call_AnimatePalette(pal, 0, 2, update), 1);
  assert.equal(new Uint8Array(h.memory.buffer)[bits + 4 * 64 + 4], index,
    'palette animation must not rewrite pixels');
  assert.deepEqual(pixel(), [0, 0, 225, 255], 'existing pixel repainted without guest drawing');
  assert.deepEqual([...h.renderer.getWindowCanvas(hwnd).canvas.getContext('2d').getImageData(8,8,1,1).data],
    [0,0,225,255], 'a previously blitted offscreen pixel animates too');
  assert.deepEqual([...h.renderer.getWindowCanvas(hwnd).canvas.getContext('2d').getImageData(5,5,1,1).data],
    [153,153,0,255], 'AnimatePalette only programs its requested range');
  const out = w.guest_alloc(8);
  w.test_call_GetPaletteEntries(pal, 0, 2, out);
  assert.equal(w.guest_read32(out + 4) >>> 0, 0x0000da00);
  const rect = w.guest_alloc(16);
  const pen = w.test_call_CreatePen(0, 1, 0x000000ff);
  w.test_call_SelectObject(dc, pen);
  [3, 3, 6, 6].forEach((v, i) => w.guest_write32(rect + i * 4, v));
  assert.equal(w.test_call_FillRect(dc, rect, 16), 1, 'system button-face shape draws in indexed mode');
  assert.deepEqual(pixel(), [192, 192, 192, 255], 'native controls retain visible backgrounds');
  const dup = w.guest_alloc(12);
  w.guest_write16(dup, 0x300); w.guest_write16(dup + 2, 2);
  w.guest_write32(dup + 4, 0x010000ed); w.guest_write32(dup + 8, 0x010000ed);
  const duplicatePalette = w.test_call_CreatePalette(dup);
  w.test_call_SelectPalette(dc, duplicatePalette, 0);
  w.test_call_RealizePalette(dc);
  const bmi = w.guest_alloc(44), dib = w.guest_alloc(4);
  for (let i = 0; i < 44; i += 4) w.guest_write32(bmi + i, 0);
  w.guest_write32(bmi, 40); w.guest_write32(bmi + 4, 2); w.guest_write32(bmi + 8, -1);
  w.guest_write16(bmi + 12, 1); w.guest_write16(bmi + 14, 8);
  w.guest_write32(bmi + 32, 2); w.guest_write16(bmi + 40, 0); w.guest_write16(bmi + 42, 1);
  w.guest_write32(dib, 0x100);
  assert.equal(w.test_call_SetDIBitsToDevice(dc, 20, 20, 2, 1, 0, 0, 0, 1, dib, bmi, 1), 1);
  w.test_call_SelectPalette(memdc, duplicatePalette, 0);
  assert.equal(w.test_call_SetDIBitsToDevice(memdc, 0, 0, 2, 1, 0, 0, 0, 1, dib, bmi, 1), 1);
  assert.equal(w.test_call_BitBlt(dc, 20, 20, 2, 1, memdc, 0, 0, 0x00cc0020), 1);
  const pixels = new Uint8Array(h.memory.buffer);
  assert.notEqual(pixels[bits + 20 * 64 + 20], pixels[bits + 20 * 64 + 21],
    'DIB_PAL_COLORS must preserve separately animated duplicate colors');
  w.guest_write32(update, 0x00e10000);
  w.test_call_AnimatePalette(duplicatePalette, 1, 1, update);
  assert.deepEqual([...h.renderer.getWindowCanvas(hwnd).canvas.getContext('2d').getImageData(20,20,2,1).data],
    [237,0,0,255, 0,0,225,255]);
  w.guest_write32(dup + 4, 0x000000e0);
  w.guest_write32(dup + 8, 0x02000007);
  const unrealized = w.test_call_CreatePalette(dup);
  w.test_call_SelectPalette(dc, unrealized, 0);
  assert.equal(w.test_call_SetDIBitsToDevice(dc, 20, 20, 2, 1, 0, 0, 0, 1, dib, bmi, 1), 1);
  assert.deepEqual([...h.renderer.getWindowCanvas(hwnd).canvas.getContext('2d').getImageData(20,20,2,1).data],
    [237,0,0,255, 192,192,192,255], 'unrealized colors use nearest slots; PC_EXPLICIT keeps the requested slot');
  assert.equal(w.test_call_DeleteObject(duplicatePalette), 1);
  // Default truecolor remains available and reallocates the same-size backing.
  w.set_desktop_color_depth(32);
  w.test_call_GetDC(hwnd);
  assert.equal(w.test_indexed_caps(dc, 12), 32);
  assert.equal(dv.getUint32(record + 24, true), 32);
  assert.equal(dv.getUint32(record + 20, true), 256);
  console.log('PASS indexed desktop caps/backing, realization, retained-pixel palette animation, truecolor restoration');
})().catch(e => { console.error(e); process.exitCode = 1; });
