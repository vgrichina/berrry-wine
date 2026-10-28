#!/usr/bin/env node
'use strict';

// Big5 glyph tests (DBCS stage 3): with a Traditional Chinese face
// selected, characters outside the rasterized strike's 0..255 coverage
// resolve through the face's cmap on demand — so under ACP 950 a TextOutA
// of Big5 bytes paints exactly what TextOutW paints with the decoded
// characters, pixel for pixel, and measures the same. The face itself is
// reached three ways, all of which must land on the same TC substitute:
// by its Latin name (MingLiU), by the Big5 bytes a Big5 guest actually
// passes to CreateFontA (細明體), and by the charset fallback alone (an
// unresolvable name with charset 136). A string of unmapped characters
// is the .notdef control: the real glyphs must not look like it.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

// 遊戲人數 in Big5 and UTF-16 (same constants as stages 1-2).
const GAME_COUNT_BYTES = [0xB9, 0x43, 0xC0, 0xB8, 0xA4, 0x48, 0xBC, 0xC6];
const GAME_COUNT_WIDE = [0x904A, 0x6232, 0x4EBA, 0x6578];
// 細明體 as raw Big5 bytes — the face name as CreateFontA delivers it.
const MINGLIU_BYTES = [0xB2, 0xD3, 0xA9, 0xFA, 0xC5, 0xE9];
const CHINESEBIG5_CHARSET = 136;

const extraWat = String.raw`
  (func (export "test_call_TextOutW")
        (param i32 i32 i32 i32 i32) (result i32)
    (local $saved_esp i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_TextOutW
      (local.get 0) (local.get 1) (local.get 2) (local.get 3) (local.get 4)
      (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_call_GetTextExtentPoint32W")
        (param i32 i32 i32 i32) (result i32)
    (local $saved_esp i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_GetTextExtentPoint32W
      (local.get 0) (local.get 1) (local.get 2) (local.get 3)
      (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_make_font_bytes")
        (param $height i32) (param $weight i32) (param $charset i32)
        (param $face i32) (result i32)
    (local $h i32)
    (local.set $h (call $gdi_font_create (local.get $height)
      (local.get $weight) (i32.const 0) (local.get $face)))
    (call $gdi_font_set_width (local.get $h) (i32.const 0))
    (call $gdi_font_set_pitch_and_family (local.get $h) (i32.const 0))
    (call $gdi_font_set_charset (local.get $h) (local.get $charset))
    (call $gdi_bitmap_font_bind (local.get $h) (local.get $face))
    (local.get $h))`;

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat });
  const mem = () => new Uint8Array(memory.buffer);
  const view = () => new DataView(memory.buffer);
  const wa = guest => e.guest_to_wasm(guest) >>> 0;
  const alloc = n => e.guest_alloc(n) >>> 0;
  const allocBytes = bytes => {
    const p = alloc(bytes.length + 1);
    mem().set(bytes, wa(p));
    mem()[wa(p) + bytes.length] = 0;
    return p;
  };
  const allocWide = codes => {
    const p = alloc(codes.length * 2 + 2);
    codes.forEach((c, i) => e.guest_write16(p + i * 2, c));
    return p;
  };

  const dc = e.test_call_CreateCompatibleDC(0);
  const bmi = alloc(40);
  const bitsOut = alloc(4);
  const WIDTH = 160, HEIGHT = 32;
  e.guest_write32(bmi, 40);
  e.guest_write32(bmi + 4, WIDTH);
  e.guest_write32(bmi + 8, -HEIGHT);
  e.guest_write16(bmi + 12, 1);
  e.guest_write16(bmi + 14, 32);
  const bitmap = e.test_call_CreateDIBSection(0, bmi, 0, bitsOut, 0, 0);
  assert.ok(bitmap, 'CreateDIBSection');
  e.test_call_SelectObject(dc, bitmap);
  const pixels = wa(e.guest_read32(bitsOut));
  e.test_gdi_dc_set_field(dc, 28, 1, 2);
  e.test_gdi_dc_set_field(dc, 20, 0, 0);
  e.test_gdi_dc_set_field(dc, 24, 0xffffff, 0xffffff);
  e.test_gdi_dc_set_field(dc, 32, 1, 0);
  const resetSurface = () => {
    mem().fill(255, pixels, pixels + WIDTH * HEIGHT * 4);
    for (let i = 3; i < WIDTH * HEIGHT * 4; i += 4) mem()[pixels + i] = 0;
    e.test_gdi_dc_set_field(dc, 12, 0, 0);
    e.test_gdi_dc_set_field(dc, 16, 0, 0);
  };
  const capture = () => mem().slice(pixels, pixels + WIDTH * HEIGHT * 4);
  const inked = buf => {
    let n = 0;
    for (let i = 0; i < buf.length; i += 4) if (buf[i] === 0) n++;
    return n;
  };

  const size = alloc(8);
  const extent = (call, ptr, count) => {
    assert.strictEqual(call(dc, ptr, count, size), 1);
    return view().getInt32(wa(size), true);
  };

  e.set_ansi_code_page(950);

  const gameA = allocBytes(GAME_COUNT_BYTES);
  const gameW = allocWide(GAME_COUNT_WIDE);
  const notdefW = allocWide([0xE000, 0xE000, 0xE000, 0xE000]);

  const drawWith = (font, call, ptr, count) => {
    e.test_call_SelectObject(dc, font);
    resetSurface();
    assert.strictEqual(call(dc, 0, 0, ptr, count), 1);
    return capture();
  };

  // -- The face by its Latin name. --
  const mingliuName = allocWide([...'MingLiU'].map(ch => ch.charCodeAt(0)));
  const fontByName = e.test_call_CreateFontW(
    -16, 0, 0, 0, 700, 0, 0, 0, CHINESEBIG5_CHARSET, 0, 0, 0, 0, mingliuName);
  assert.ok(fontByName, 'CreateFontW MingLiU');

  const refW = drawWith(fontByName, e.test_call_TextOutW, gameW, 4);
  assert.ok(inked(refW) > 200,
    `the TC glyphs actually paint (inked ${inked(refW)} pixels)`);
  const refNotdef = drawWith(fontByName, e.test_call_TextOutW, notdefW, 4);
  assert.notDeepStrictEqual(refW, refNotdef,
    'real glyphs do not look like four .notdef boxes');

  const refA = drawWith(fontByName, e.test_call_TextOutA, gameA, 8);
  assert.deepStrictEqual(refA, refW,
    'CP950: TextOutA of the Big5 bytes paints TextOutW pixel-for-pixel');

  e.test_call_SelectObject(dc, fontByName);
  const widthW = extent(e.test_call_GetTextExtentPoint32W, gameW, 4);
  const widthA = extent(e.test_call_GetTextExtentPoint32A, gameA, 8);
  assert.strictEqual(widthA, widthW, 'CP950: A measure == W measure');
  assert.ok(widthW >= 56,
    `four full-width glyphs at 16px measure wide (got ${widthW})`);

  // -- The same face named in Big5 bytes, as the game asks for it. --
  const mingliuBytes = allocBytes(MINGLIU_BYTES);
  const fontByBytes = e.test_make_font_bytes(
    -16, 700, CHINESEBIG5_CHARSET, wa(mingliuBytes));
  assert.ok(fontByBytes, 'font with a Big5-byte face name');
  assert.deepStrictEqual(
    drawWith(fontByBytes, e.test_call_TextOutW, gameW, 4), refW,
    'face named 細明體 in Big5 bytes paints the same glyphs');

  // -- Charset fallback alone: a name that resolves to nothing, charset 136. --
  const unknownBytes = allocBytes([...Buffer.from('NoSuchFaceXYZ', 'latin1')]);
  const fontByCharset = e.test_make_font_bytes(
    -16, 700, CHINESEBIG5_CHARSET, wa(unknownBytes));
  assert.ok(fontByCharset, 'font with unresolvable name + charset 136');
  assert.deepStrictEqual(
    drawWith(fontByCharset, e.test_call_TextOutW, gameW, 4), refW,
    'charset 136 fallback paints the same glyphs');

  // The same unknown name WITHOUT the Big5 charset must not pick up the
  // TC face: it falls back to the Latin default, whose strike has no CJK
  // glyphs — the four characters come out as something else entirely.
  const fontLatin = e.test_make_font_bytes(-16, 700, 0, wa(unknownBytes));
  assert.ok(fontLatin, 'font with unresolvable name + charset 0');
  assert.notDeepStrictEqual(
    drawWith(fontLatin, e.test_call_TextOutW, gameW, 4), refW,
    'without charset 136 the unknown name does not reach the TC face');

  console.log('PASS codepage-big5-glyphs: CP950 TextOutA == TextOutW pixel-for-pixel in the TC face; face reached by Latin name, Big5-byte name and charset-136 fallback; .notdef control differs');
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
