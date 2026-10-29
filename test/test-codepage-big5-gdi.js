#!/usr/bin/env node
'use strict';

// Big5 funnel tests (DBCS stage 2): the five GDI text funnels decode an
// ANSI string once, up front, when the process ANSI page has conversion
// tables — so under ACP 950 the A surfaces must measure, fit and advance
// exactly what the W surfaces do with the decoded text, character for
// character, while under ACP 1252 the A surfaces must keep answering for
// the raw bytes one-for-one, byte-for-byte what they always did.
//
// Widths are asserted A-against-W, never absolutely: until stage 3 the
// glyph layer still clamps a character to its low byte for widths, on
// BOTH paths equally, so equality is the contract this stage owns.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

// 遊戲人數 / 總資金 in Big5 and UTF-16 (same constants as stage 1).
const GAME_COUNT_BYTES = [0xB9, 0x43, 0xC0, 0xB8, 0xA4, 0x48, 0xBC, 0xC6];
const GAME_COUNT_WIDE = [0x904A, 0x6232, 0x4EBA, 0x6578];
const FUNDS_BYTES = [0xC1, 0x60, 0xB8, 0xEA, 0xAA, 0xF7];
const FUNDS_WIDE = [0x7E3D, 0x8CC7, 0x91D1];

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
  (func (export "index_gid") (param $face i32) (param $code i32) (result i32)
    (call $tt_glyph_index (call $tt_face_data (local.get $face)) (call $tt_face_size (local.get $face)) (local.get $code)))`;

(async () => {
  const { exports: e, memory, hostCtx } = await bootRenderHarness({ extraWat });
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

  // The full face, not the harness's ANSI subset (same move as
  // test-gdi-glyph-index.js): the glyph-index case below needs real gids.
  hostCtx.vfs.files.set('c:\\windows\\fonts\\arial.ttf', {
    data: new Uint8Array(fs.readFileSync(
      path.join(__dirname, '../fonts/liberation/LiberationSans-Regular.ttf'))),
    attrs: 0x20,
  });

  const faceName = allocWide([...'Arial'].map(ch => ch.charCodeAt(0)));
  const font = e.test_call_CreateFontW(-16, 0, 0, 0, 400, 0, 0, 0, 0, 0, 0, 0, 0, faceName);
  assert.ok(font, 'CreateFontW Arial');
  const dc = e.test_call_CreateCompatibleDC(0);
  const bmi = alloc(40);
  const bitsOut = alloc(4);
  const WIDTH = 128, HEIGHT = 32;
  e.guest_write32(bmi, 40);
  e.guest_write32(bmi + 4, WIDTH);
  e.guest_write32(bmi + 8, -HEIGHT);
  e.guest_write16(bmi + 12, 1);
  e.guest_write16(bmi + 14, 32);
  const bitmap = e.test_call_CreateDIBSection(0, bmi, 0, bitsOut, 0, 0);
  assert.ok(bitmap, 'CreateDIBSection');
  e.test_call_SelectObject(dc, bitmap);
  e.test_call_SelectObject(dc, font);
  const pixels = wa(e.guest_read32(bitsOut));
  // OPAQUE bk, black on white, TA_UPDATECP so TextOut/ExtTextOut leave
  // their advance in the DC's current position (field 12).
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
  const currentX = () => e.test_gdi_dc_get_field(dc, 12, 0);

  const size = alloc(8);
  const fitBuf = alloc(4);
  const dxBuf = alloc(64);
  const extentA = (ptr, count) => {
    assert.strictEqual(e.test_call_GetTextExtentPoint32A(dc, ptr, count, size), 1);
    return view().getInt32(wa(size), true);
  };
  const extentW = (ptr, count) => {
    assert.strictEqual(e.test_call_GetTextExtentPoint32W(dc, ptr, count, size), 1);
    return view().getInt32(wa(size), true);
  };
  const exPoint = (call, ptr, count, maxExt) => {
    mem().fill(0, wa(dxBuf), wa(dxBuf) + 64);
    e.guest_write32(fitBuf, -1);
    assert.strictEqual(call(dc, ptr, count, maxExt, fitBuf, dxBuf, size), 1);
    return {
      fit: view().getInt32(wa(fitBuf), true),
      dx: Array.from({ length: 8 }, (_, i) => view().getInt32(wa(dxBuf) + i * 4, true)),
      cx: view().getInt32(wa(size), true),
    };
  };

  const gameA = allocBytes(GAME_COUNT_BYTES);
  const gameW = allocWide(GAME_COUNT_WIDE);
  const fundsA = allocBytes(FUNDS_BYTES);
  const fundsW = allocWide(FUNDS_WIDE);
  // What the legacy path sees in the Big5 bytes: each byte its own char.
  const gameLegacyW = allocWide(GAME_COUNT_BYTES);

  // ---- ACP 1252 (the default): the bytes are eight characters. ----
  assert.strictEqual(e.get_ansi_code_page(), 1252, 'harness boots at CP1252');
  const legacyWidth = extentA(gameA, 8);
  assert.strictEqual(legacyWidth, extentW(gameLegacyW, 8),
    'CP1252: A extent of the bytes == W extent of the byte-valued chars');
  const legacyEx = exPoint(e.test_call_GetTextExtentExPointA, gameA, 8, 0x7fffffff);
  assert.strictEqual(legacyEx.fit, 8, 'CP1252: fit counts bytes as characters');
  assert.strictEqual(legacyEx.cx, legacyWidth, 'CP1252: ExPoint total == extent');

  // ---- ACP 950: the funnels decode. ----
  e.set_ansi_code_page(950);
  assert.strictEqual(e.get_ansi_code_page(), 950);

  // $host_measure_text, via GetTextExtentPoint32A/W.
  const decodedWidth = extentW(gameW, 4);
  assert.strictEqual(extentA(gameA, 8), decodedWidth,
    'CP950: A extent of 8 Big5 bytes == W extent of the 4 decoded chars');
  assert.strictEqual(extentA(fundsA, 6), extentW(fundsW, 3),
    'CP950: funds string measures by its 3 characters');
  assert.notStrictEqual(decodedWidth, legacyWidth,
    'CP950: decoding actually engaged (4-char width != 8-byte width)');

  // $gdi_text_extent_ex: fit and dx count characters, not bytes.
  const exW = exPoint(e.test_call_GetTextExtentExPointW, gameW, 4, 0x7fffffff);
  const exA = exPoint(e.test_call_GetTextExtentExPointA, gameA, 8, 0x7fffffff);
  assert.strictEqual(exA.fit, 4, 'CP950: ExPointA fit is a character count');
  assert.strictEqual(exA.cx, exW.cx, 'CP950: ExPointA total == ExPointW total');
  assert.deepStrictEqual(exA.dx.slice(0, 4), exW.dx.slice(0, 4),
    'CP950: ExPointA dx entries are per-character prefixes, like W');
  const exFit2 = exPoint(e.test_call_GetTextExtentExPointA, gameA, 8, exW.dx[1]);
  assert.strictEqual(exFit2.fit, 2,
    'CP950: a maxExt at the second character boundary fits 2 characters, not 3-4 bytes');

  // $gdi_native_text_out: TA_UPDATECP advance.
  resetSurface();
  assert.strictEqual(e.test_call_TextOutW(dc, 0, 0, gameW, 4), 1);
  const advanceW = currentX();
  resetSurface();
  assert.strictEqual(e.test_call_TextOutA(dc, 0, 0, gameA, 8), 1);
  assert.strictEqual(currentX(), advanceW, 'CP950: TextOutA advance == TextOutW advance');
  assert.strictEqual(advanceW, decodedWidth, 'TextOut advance == measured extent');

  // $gdi_native_ext_text_out without glyph indices: same decode.
  resetSurface();
  assert.strictEqual(e.test_call_ExtTextOutA(dc, 0, 0, 0, 0, gameA, 8, 0), 1);
  assert.strictEqual(currentX(), advanceW, 'CP950: ExtTextOutA advance == TextOutW advance');

  // $gdi_native_draw_text: DT_CALCRECT measures the decoded string.
  const DT_CALCRECT = 0x400, DT_SINGLELINE = 0x20;
  const rect = alloc(16);
  const drawRect = (call, ptr, count) => {
    [0, 0, 500, 100].forEach((n, i) => e.guest_write32(rect + i * 4, n));
    const height = call(dc, ptr, count, rect, DT_CALCRECT | DT_SINGLELINE);
    return { height, right: view().getInt32(wa(rect) + 8, true) };
  };
  const drawW = drawRect(e.test_call_DrawTextW, gameW, 4);
  const drawA = drawRect(e.test_call_DrawTextA, gameA, 8);
  assert.strictEqual(drawA.right, drawW.right, 'CP950: DrawTextA CALCRECT width == DrawTextW');
  assert.strictEqual(drawA.height, drawW.height, 'CP950: DrawTextA CALCRECT height == DrawTextW');

  // ETO_GLYPH_INDEX: the WORD array is glyph indices, never characters —
  // under ACP 950 it must reach the pipeline exactly as under any page.
  const faceNameA = allocBytes([...Buffer.from('Arial\0', 'latin1')]);
  const face = e.test_tt_face_for_logfont(wa(faceNameA), 400, 0);
  assert.ok(face >= 0, 'native face for Arial');
  const gid = e.index_gid(face, 65);
  assert.ok(gid, 'cmap gid for A');
  const gidText = alloc(4);
  e.guest_write16(gidText, gid);
  const wideA = allocWide([65]);
  resetSurface();
  assert.strictEqual(e.test_call_ExtTextOutW(dc, 0, 0, 0, 0, wideA, 1, 0), 1);
  const glyphRef = capture();
  const glyphAdvance = currentX();
  assert.ok(glyphRef.some((v, i) => i % 4 !== 3 && v === 0), 'reference glyph has ink');
  resetSurface();
  assert.strictEqual(e.test_call_ExtTextOutA(dc, 0, 0, 16, 0, gidText, 1, 0), 1);
  assert.deepStrictEqual(capture(), glyphRef,
    'CP950: ETO_GLYPH_INDEX A call paints the indexed glyph, not a decoded character');
  assert.strictEqual(currentX(), glyphAdvance,
    'CP950: ETO_GLYPH_INDEX advance is the glyph advance');

  // ---- Back to CP1252: byte-for-byte the legacy answers again. ----
  e.set_ansi_code_page(1252);
  assert.strictEqual(extentA(gameA, 8), legacyWidth,
    'CP1252 restored: A extent of the bytes is the legacy width again');
  assert.strictEqual(
    exPoint(e.test_call_GetTextExtentExPointA, gameA, 8, 0x7fffffff).fit, 8,
    'CP1252 restored: fit counts bytes again');

  console.log('PASS codepage-big5-gdi: CP950 funnels decode (extent/ExPoint fit+dx/TextOut/ExtTextOut/DrawText), ETO_GLYPH_INDEX exempt, CP1252 byte-for-byte');
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
