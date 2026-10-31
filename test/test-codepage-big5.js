#!/usr/bin/env node
// Big5 (CP950) conversion regression tests: the $ansi_char_decode /
// $ansi_char_encode family and the MultiByteToWideChar /
// WideCharToMultiByte semantics built on it (DBCS stage 1), against
// Microsoft's CP950 table (bestfit950.txt): EUDC pairs in the Private Use
// Area, U+003F for what the table does not map, best-fit encode, and one
// lead-byte range (0x81..0xFE) shared by every lead-byte API. Pages without
// conversion tables (CP1252, CP932, ...) must keep the historical identity
// behavior byte-for-byte; those contracts are pinned here too.

const fs = require('fs');
const path = require('path');
const { createHostImports } = require('../lib/host-imports');
const { compileSrcWasm } = require('./compile-src');
// $GUEST_BASE, from the map declared in src/00-regions.wat.
const RegionMap = require('../lib/region-map.generated.js');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');

// 遊戲人數 / 總資金 / 細明體 in Big5 and UTF-16.
const GAME_COUNT_BYTES = [0xB9, 0x43, 0xC0, 0xB8, 0xA4, 0x48, 0xBC, 0xC6];
const GAME_COUNT_WIDE = [0x904A, 0x6232, 0x4EBA, 0x6578];
const FUNDS_BYTES = [0xC1, 0x60, 0xB8, 0xEA, 0xAA, 0xF7];
const FUNDS_WIDE = [0x7E3D, 0x8CC7, 0x91D1];
const FACE_BYTES = [0xB2, 0xD3, 0xA9, 0xFA, 0xC5, 0xE9]; // 細明體 (MingLiU)
const FACE_WIDE = [0x7D30, 0x660E, 0x9AD4];

const MB_ERR_INVALID_CHARS = 0x00000008;
const WC_NO_BEST_FIT_CHARS = 0x00000400;
const ERROR_INSUFFICIENT_BUFFER = 122;
const ERROR_NO_UNICODE_TRANSLATION = 1113;

async function main() {
  const wasmBytes = compileSrcWasm();
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { getMemory: () => memory.buffer, renderer: null, resourceJson: {} };
  const base = createHostImports(ctx);
  base.host.memory = memory;
  base.host.create_thread = () => 0;
  base.host.exit_thread = () => 0;
  base.host.terminate_thread = () => 0;
  base.host.create_event = () => 0;
  base.host.set_event = () => 0;
  base.host.reset_event = () => 0;
  base.host.wait_single = () => 0;
  base.host.wait_multiple = () => 0;
  base.host.com_create_instance = () => 0x80004002;

  const { instance } = await WebAssembly.instantiate(wasmBytes, base);
  const e = instance.exports;
  const u8 = new Uint8Array(memory.buffer);
  const view = new DataView(memory.buffer);
  const wa = gp => RegionMap.g2w(gp, e.get_image_base());

  let pass = 0;
  let fail = 0;
  function check(name, ok, detail = '') {
    if (ok) {
      pass++;
      console.log('PASS  ' + name);
    } else {
      fail++;
      console.log('FAIL  ' + name + (detail ? '  ' + detail : ''));
    }
  }
  const eq = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
  const fmt = a => '[' + a.map(v => '0x' + v.toString(16).toUpperCase()).join(' ') + ']';

  const srcB = e.guest_alloc(128);
  const dstW = e.guest_alloc(256);
  const srcW = e.guest_alloc(256);
  const dstB = e.guest_alloc(128);
  const aux = e.guest_alloc(16);

  const setBytes = (gp, bytes) => u8.set(bytes, wa(gp));
  const getBytes = (gp, n) => [...u8.slice(wa(gp), wa(gp) + n)];
  const setWide = (gp, ws) => ws.forEach((w, i) => view.setUint16(wa(gp) + 2 * i, w, true));
  const getWide = (gp, n) => Array.from({ length: n }, (_, i) => view.getUint16(wa(gp) + 2 * i, true));
  const unpackDec = p => ({ wc: p & 0xFFFF, len: (p >>> 16) & 0xFF, bad: (p >>> 24) & 1 });
  const unpackEnc = p => ({ b0: p & 0xFF, b1: (p >>> 8) & 0xFF, len: (p >>> 16) & 0xFF, unmapped: (p >>> 24) & 1 });

  // ---- $ansi_char_decode ----
  setBytes(srcB, FACE_BYTES);
  let d = unpackDec(e.test_cp_char_decode(950, srcB, 2));
  check('CP950 decode B2D3 is U+7D30, 2 bytes', d.wc === 0x7D30 && d.len === 2 && d.bad === 0, JSON.stringify(d));
  d = unpackDec(e.test_cp_char_decode(950, srcB, 1));
  check('CP950 lone lead at end is the default U+003F, 1 byte, invalid', d.wc === 0x3F && d.len === 1 && d.bad === 1, JSON.stringify(d));
  setBytes(srcB, [0xB2, 0x20]);
  d = unpackDec(e.test_cp_char_decode(950, srcB, 2));
  check('CP950 bad trail is U+003F and consumes the lead byte only', d.wc === 0x3F && d.len === 1 && d.bad === 1, JSON.stringify(d));
  setBytes(srcB, [0xA3, 0xE2]);
  d = unpackDec(e.test_cp_char_decode(950, srcB, 2));
  check('CP950 unmapped pair A3E2 is U+003F (not U+FFFD), 2 bytes, invalid', d.wc === 0x3F && d.len === 2 && d.bad === 1, JSON.stringify(d));
  setBytes(srcB, [0x41]);
  d = unpackDec(e.test_cp_char_decode(950, srcB, 1));
  check('CP950 ASCII decodes as itself', d.wc === 0x41 && d.len === 1 && d.bad === 0, JSON.stringify(d));
  // Microsoft's EUDC -> Private Use Area blocks (both ends), F9FE, and 十.
  for (const [bytes, wc] of [[[0xFA, 0x40], 0xE000], [[0xFE, 0xFE], 0xE310], [[0x8E, 0x40], 0xE311],
    [[0xA0, 0xFE], 0xEEB7], [[0x81, 0x40], 0xEEB8], [[0x8D, 0xFE], 0xF6B0], [[0xC6, 0xA1], 0xF6B1],
    [[0xC8, 0xFE], 0xF848], [[0xF9, 0xFE], 0x2593], [[0xA4, 0x51], 0x5341]]) {
    setBytes(srcB, bytes);
    d = unpackDec(e.test_cp_char_decode(950, srcB, 2));
    check(`CP950 decode ${fmt(bytes)} is U+${wc.toString(16).toUpperCase()}, valid`,
      d.wc === wc && d.len === 2 && d.bad === 0, JSON.stringify(d));
  }
  for (const [b, wc] of [[0x80, 0x0080], [0xFF, 0xF8F8]]) {
    setBytes(srcB, [b]);
    d = unpackDec(e.test_cp_char_decode(950, srcB, 1));
    check(`CP950 single byte 0x${b.toString(16).toUpperCase()} is U+${wc.toString(16).toUpperCase().padStart(4, '0')}`,
      d.wc === wc && d.len === 1 && d.bad === 0, JSON.stringify(d));
  }
  setBytes(srcB, [0x80]);
  d = unpackDec(e.test_cp_char_decode(1252, srcB, 1));
  check('CP1252 byte 0x80 keeps the identity convention', d.wc === 0x80 && d.len === 1 && d.bad === 0, JSON.stringify(d));
  setBytes(srcB, [0x81, 0x40]);
  d = unpackDec(e.test_cp_char_decode(932, srcB, 2));
  check('CP932 (no table yet) keeps identity decode', d.wc === 0x81 && d.len === 1 && d.bad === 0, JSON.stringify(d));

  // ---- $ansi_char_encode ----
  let n = unpackEnc(e.test_cp_char_encode(950, 0x7D30));
  check('CP950 encode U+7D30 is B2 D3', n.b0 === 0xB2 && n.b1 === 0xD3 && n.len === 2 && n.unmapped === 0, JSON.stringify(n));
  n = unpackEnc(e.test_cp_char_encode(950, 0x2603));
  check('CP950 unmapped U+2603 falls back to "?" flagged', n.b0 === 0x3F && n.len === 1 && n.unmapped === 1, JSON.stringify(n));
  n = unpackEnc(e.test_cp_char_encode(950, 0x5341));
  check('CP950 encode U+5341 (十) is A4 51, not the A2 CC duplicate',
    n.b0 === 0xA4 && n.b1 === 0x51 && n.len === 2 && n.unmapped === 0, JSON.stringify(n));
  for (const [wc, bytes, what] of [[0x2550, [0xF9, 0xF9], 'box drawing prefers F9xx'], [0x255E, [0xF9, 0xE9], 'box drawing'],
    [0x2561, [0xF9, 0xEB], 'box drawing'], [0x256A, [0xF9, 0xEA], 'box drawing'], [0x00A5, [0xA2, 0x44], 'best fit'],
    [0xE000, [0xFA, 0x40], 'PUA -> EUDC'], [0xEEB8, [0x81, 0x40], 'PUA -> EUDC'], [0xF6B1, [0xC6, 0xA1], 'PUA -> EUDC'],
    [0xE310, [0xFE, 0xFE], 'PUA -> EUDC'], [0x2593, [0xF9, 0xFE], 'F9FE round trip'], [0x0080, [0x80], 'single byte'],
    [0xF8F8, [0xFF], 'single byte']]) {
    n = unpackEnc(e.test_cp_char_encode(950, wc));
    const got = n.len === 1 ? [n.b0] : [n.b0, n.b1];
    check(`CP950 encode U+${wc.toString(16).toUpperCase().padStart(4, '0')} is ${fmt(bytes)} (${what})`,
      eq(got, bytes) && n.unmapped === 0, JSON.stringify(n));
  }
  n = unpackEnc(e.test_cp_char_encode(950, 0x014B));
  check('CP950 HKSCS-only U+014B is the default "?" flagged', n.b0 === 0x3F && n.len === 1 && n.unmapped === 1, JSON.stringify(n));
  n = unpackEnc(e.test_cp_char_encode(1252, 0x20AC));
  check('CP1252 encode keeps low-byte truncation', n.b0 === 0xAC && n.len === 1 && n.unmapped === 0, JSON.stringify(n));

  // ---- The opt-in gate: outside a CP950 launch the API is the legacy
  // ---- identity copy, whatever page the caller names. ----
  // (The harness boots at ACP 1252 and nothing above changed it.)
  setBytes(srcB, GAME_COUNT_BYTES);
  let r = e.test_multi_byte_to_wide_char(950, 0, srcB, GAME_COUNT_BYTES.length, dstW, 3);
  check('ACP1252: MB2WC(950) short buffer truncates silently, no Win32 semantics',
    r === 3 && eq(getWide(dstW, 3), [0xB9, 0x43, 0xC0]), `r=${r} ${fmt(getWide(dstW, 3))}`);
  setBytes(srcB, [0x41, 0x80, 0x9F]);
  r = e.test_multi_byte_to_wide_char(65001, 0, srcB, 3, dstW, 16);
  check('ACP1252: MB2WC(65001) is the identity expansion, not error 87',
    r === 3 && eq(getWide(dstW, 3), [0x41, 0x80, 0x9F]), `r=${r} ${fmt(getWide(dstW, 3))}`);
  r = e.test_multi_byte_to_wide_char(850, 0, srcB, 3, dstW, 16);
  check('ACP1252: MB2WC(850) is the identity expansion, not error 87',
    r === 3 && eq(getWide(dstW, 3), [0x41, 0x80, 0x9F]), `r=${r} ${fmt(getWide(dstW, 3))}`);
  setWide(srcW, GAME_COUNT_WIDE);
  view.setUint32(wa(aux), 0xDEAD, true);
  r = e.test_wide_char_to_multi_byte(950, 0, srcW, 4, dstB, 32, 0, aux);
  check('ACP1252: WC2MB(950) truncates to low bytes, lpUsedDefaultChar untouched',
    r === 4 && eq(getBytes(dstB, 4), [0x4A, 0x32, 0xBA, 0x78]) && view.getUint32(wa(aux), true) === 0xDEAD,
    `r=${r} ${fmt(getBytes(dstB, 4))} used=${view.getUint32(wa(aux), true)}`);
  r = e.test_wide_char_to_multi_byte(950, 0, srcW, 4, dstB, 2, 0, 0);
  check('ACP1252: WC2MB short buffer truncates silently', r === 2, `r=${r}`);

  // ---- MultiByteToWideChar (inside the CP950 launch from here) ----
  e.set_ansi_code_page(950);
  setBytes(srcB, GAME_COUNT_BYTES);
  r = e.test_multi_byte_to_wide_char(950, 0, srcB, GAME_COUNT_BYTES.length, dstW, 16);
  check('MB2WC CP950 decodes 遊戲人數', r === 4 && eq(getWide(dstW, 4), GAME_COUNT_WIDE), `r=${r} ${fmt(getWide(dstW, 4))}`);
  r = e.test_multi_byte_to_wide_char(950, 0, srcB, GAME_COUNT_BYTES.length, 0, 0);
  check('MB2WC size query (NULL dst) returns the wide count', r === 4, `r=${r}`);
  r = e.test_multi_byte_to_wide_char(950, 0, srcB, GAME_COUNT_BYTES.length, dstW, 0);
  check('MB2WC size query (0 dstLen) returns the wide count', r === 4, `r=${r}`);
  r = e.test_multi_byte_to_wide_char(950, 0, srcB, GAME_COUNT_BYTES.length, dstW, 3);
  check('MB2WC too-small buffer fails with ERROR_INSUFFICIENT_BUFFER',
    r === 0 && e.test_get_last_error() === ERROR_INSUFFICIENT_BUFFER, `r=${r} err=${e.test_get_last_error()}`);
  setBytes(srcB, [...FUNDS_BYTES, 0]);
  r = e.test_multi_byte_to_wide_char(950, 0, srcB, -1, dstW, 16);
  check('MB2WC -1 converts 總資金 including the terminator', r === 4 && eq(getWide(dstW, 4), [...FUNDS_WIDE, 0]), `r=${r} ${fmt(getWide(dstW, 4))}`);
  setBytes(srcB, [0xB2, 0x20]);
  r = e.test_multi_byte_to_wide_char(950, MB_ERR_INVALID_CHARS, srcB, 2, dstW, 16);
  check('MB2WC MB_ERR_INVALID_CHARS rejects a bad trail byte',
    r === 0 && e.test_get_last_error() === ERROR_NO_UNICODE_TRANSLATION, `r=${r} err=${e.test_get_last_error()}`);
  r = e.test_multi_byte_to_wide_char(950, 0, srcB, 2, dstW, 16);
  check('MB2WC without the flag maps bad trail to U+003F and moves on',
    r === 2 && eq(getWide(dstW, 2), [0x3F, 0x20]), `r=${r} ${fmt(getWide(dstW, 2))}`);
  setBytes(srcB, [0xB9, 0x43, 0xB2]);
  r = e.test_multi_byte_to_wide_char(950, 0, srcB, 3, dstW, 16);
  check('MB2WC lone final lead byte yields the char plus U+003F',
    r === 2 && eq(getWide(dstW, 2), [0x904A, 0x3F]), `r=${r} ${fmt(getWide(dstW, 2))}`);
  r = e.test_multi_byte_to_wide_char(950, MB_ERR_INVALID_CHARS, srcB, 3, dstW, 16);
  check('MB2WC MB_ERR_INVALID_CHARS rejects a lone final lead byte',
    r === 0 && e.test_get_last_error() === ERROR_NO_UNICODE_TRANSLATION, `r=${r} err=${e.test_get_last_error()}`);
  setBytes(srcB, [0xFA, 0x40, 0x81, 0x40, 0xC6, 0xA1]);
  r = e.test_multi_byte_to_wide_char(950, MB_ERR_INVALID_CHARS, srcB, 6, dstW, 16);
  check('MB2WC MB_ERR_INVALID_CHARS accepts EUDC pairs (they map to the PUA)',
    r === 3 && eq(getWide(dstW, 3), [0xE000, 0xEEB8, 0xF6B1]), `r=${r} ${fmt(getWide(dstW, 3))}`);
  // Pages with no table keep the legacy identity path inside a CP950 launch.
  setBytes(srcB, [0x41, 0x80, 0x9F]);
  for (const cp of [65001, 850, 1200]) {
    r = e.test_multi_byte_to_wide_char(cp, 0, srcB, 3, dstW, 16);
    check(`ACP950: MB2WC(${cp}) keeps the legacy identity expansion, not error 87`,
      r === 3 && eq(getWide(dstW, 3), [0x41, 0x80, 0x9F]), `r=${r} ${fmt(getWide(dstW, 3))} err=${e.test_get_last_error()}`);
  }
  setWide(srcW, [0x41, 0x7D30]);
  r = e.test_wide_char_to_multi_byte(65001, 0, srcW, 2, dstB, 32, 0, 0);
  check('ACP950: WC2MB(CP_UTF8) keeps the legacy low-byte copy, not error 87',
    r === 2 && eq(getBytes(dstB, 2), [0x41, 0x30]), `r=${r} ${fmt(getBytes(dstB, 2))}`);
  r = e.test_multi_byte_to_wide_char(950, 0, srcB, 0, dstW, 16);
  check('MB2WC zero-length input returns 0', r === 0, `r=${r}`);
  setBytes(srcB, [0x41, 0x80, 0x9F]);
  r = e.test_multi_byte_to_wide_char(1252, 0, srcB, 3, dstW, 16);
  check('MB2WC CP1252 stays the identity expansion', r === 3 && eq(getWide(dstW, 3), [0x41, 0x80, 0x9F]), `r=${r} ${fmt(getWide(dstW, 3))}`);

  // CP_ACP follows the process page (already 950 here; stage wiring is
  // host-side, the conversion layer must honor it).
  setBytes(srcB, FUNDS_BYTES);
  r = e.test_multi_byte_to_wide_char(0, 0, srcB, FUNDS_BYTES.length, dstW, 16);
  check('MB2WC CP_ACP decodes Big5 when the process ACP is 950',
    r === 3 && eq(getWide(dstW, 3), FUNDS_WIDE), `r=${r} ${fmt(getWide(dstW, 3))}`);

  // ---- WideCharToMultiByte ----
  setWide(srcW, GAME_COUNT_WIDE);
  r = e.test_wide_char_to_multi_byte(950, 0, srcW, 4, dstB, 32, 0, 0);
  check('WC2MB CP950 encodes 遊戲人數', r === 8 && eq(getBytes(dstB, 8), GAME_COUNT_BYTES), `r=${r} ${fmt(getBytes(dstB, 8))}`);
  r = e.test_wide_char_to_multi_byte(950, 0, srcW, 4, 0, 0, 0, 0);
  check('WC2MB size query returns the byte count', r === 8, `r=${r}`);
  r = e.test_wide_char_to_multi_byte(950, 0, srcW, 4, dstB, 4, 0, 0);
  check('WC2MB too-small buffer fails with ERROR_INSUFFICIENT_BUFFER',
    r === 0 && e.test_get_last_error() === ERROR_INSUFFICIENT_BUFFER, `r=${r} err=${e.test_get_last_error()}`);
  setWide(srcW, [...FUNDS_WIDE, 0]);
  r = e.test_wide_char_to_multi_byte(950, 0, srcW, -1, dstB, 32, 0, 0);
  check('WC2MB -1 encodes 總資金 including the terminator', r === 7 && eq(getBytes(dstB, 7), [...FUNDS_BYTES, 0]), `r=${r} ${fmt(getBytes(dstB, 7))}`);
  setWide(srcW, [0x2603]);
  view.setUint32(wa(aux), 0xDEAD, true);
  r = e.test_wide_char_to_multi_byte(950, 0, srcW, 1, dstB, 32, 0, aux);
  check('WC2MB unmapped char emits "?" and raises lpUsedDefaultChar',
    r === 1 && getBytes(dstB, 1)[0] === 0x3F && view.getUint32(wa(aux), true) === 1,
    `r=${r} byte=${fmt(getBytes(dstB, 1))} used=${view.getUint32(wa(aux), true)}`);
  u8[wa(aux + 8)] = 0x2A; // custom default char '*'
  r = e.test_wide_char_to_multi_byte(950, 0, srcW, 1, dstB, 32, aux + 8, aux);
  check('WC2MB honors a caller-supplied default char',
    r === 1 && getBytes(dstB, 1)[0] === 0x2A && view.getUint32(wa(aux), true) === 1,
    `r=${r} byte=${fmt(getBytes(dstB, 1))}`);
  setBytes(aux + 8, [0xB2, 0xD3]); // caller-supplied default char 細, a Big5 pair
  r = e.test_wide_char_to_multi_byte(950, 0, srcW, 1, dstB, 32, aux + 8, aux);
  check('WC2MB emits a two-byte lpDefaultChar whole, never truncated to its lead byte',
    r === 2 && eq(getBytes(dstB, 2), [0xB2, 0xD3]) && view.getUint32(wa(aux), true) === 1,
    `r=${r} bytes=${fmt(getBytes(dstB, 2))} used=${view.getUint32(wa(aux), true)}`);
  setWide(srcW, [0x00A5]);
  r = e.test_wide_char_to_multi_byte(950, 0, srcW, 1, dstB, 32, 0, aux);
  check('WC2MB best-fits U+00A5 to A2 44 by default without raising lpUsedDefaultChar',
    r === 2 && eq(getBytes(dstB, 2), [0xA2, 0x44]) && view.getUint32(wa(aux), true) === 0,
    `r=${r} bytes=${fmt(getBytes(dstB, 2))} used=${view.getUint32(wa(aux), true)}`);
  r = e.test_wide_char_to_multi_byte(950, WC_NO_BEST_FIT_CHARS, srcW, 1, dstB, 32, 0, aux);
  check('WC2MB WC_NO_BEST_FIT_CHARS turns the U+00A5 best fit into "?" and raises lpUsedDefaultChar',
    r === 1 && getBytes(dstB, 1)[0] === 0x3F && view.getUint32(wa(aux), true) === 1,
    `r=${r} bytes=${fmt(getBytes(dstB, 1))} used=${view.getUint32(wa(aux), true)}`);
  setWide(srcW, [0x2550]);
  r = e.test_wide_char_to_multi_byte(950, WC_NO_BEST_FIT_CHARS, srcW, 1, dstB, 32, 0, aux);
  check('WC2MB WC_NO_BEST_FIT_CHARS keeps a round-trip mapping (U+2550 -> F9 F9)',
    r === 2 && eq(getBytes(dstB, 2), [0xF9, 0xF9]) && view.getUint32(wa(aux), true) === 0,
    `r=${r} bytes=${fmt(getBytes(dstB, 2))} used=${view.getUint32(wa(aux), true)}`);
  setWide(srcW, [0x014B]);
  r = e.test_wide_char_to_multi_byte(950, 0, srcW, 1, dstB, 32, 0, aux);
  check('WC2MB HKSCS-only U+014B emits "?" and raises lpUsedDefaultChar',
    r === 1 && getBytes(dstB, 1)[0] === 0x3F && view.getUint32(wa(aux), true) === 1,
    `r=${r} bytes=${fmt(getBytes(dstB, 1))} used=${view.getUint32(wa(aux), true)}`);
  setWide(srcW, [0x3F]);
  r = e.test_wide_char_to_multi_byte(950, 0, srcW, 1, dstB, 32, 0, aux);
  check('WC2MB a literal "?" is not the default char: lpUsedDefaultChar stays clear',
    r === 1 && getBytes(dstB, 1)[0] === 0x3F && view.getUint32(wa(aux), true) === 0,
    `r=${r} used=${view.getUint32(wa(aux), true)}`);
  setWide(srcW, [0x7D30]);
  r = e.test_wide_char_to_multi_byte(950, 0, srcW, 1, dstB, 32, 0, aux);
  check('WC2MB mapped char leaves lpUsedDefaultChar clear',
    r === 2 && view.getUint32(wa(aux), true) === 0, `r=${r} used=${view.getUint32(wa(aux), true)}`);
  setWide(srcW, [0x20AC, 0x41]);
  r = e.test_wide_char_to_multi_byte(1252, 0, srcW, 2, dstB, 32, 0, 0);
  check('WC2MB CP1252 stays low-byte truncation', r === 2 && eq(getBytes(dstB, 2), [0xAC, 0x41]), `r=${r} ${fmt(getBytes(dstB, 2))}`);

  // ---- Round trips ----
  setBytes(srcB, GAME_COUNT_BYTES);
  r = e.test_multi_byte_to_wide_char(950, 0, srcB, GAME_COUNT_BYTES.length, dstW, 16);
  const back = e.test_wide_char_to_multi_byte(950, 0, dstW, r, dstB, 32, 0, 0);
  check('Big5 -> wide -> Big5 round-trips 遊戲人數',
    back === GAME_COUNT_BYTES.length && eq(getBytes(dstB, back), GAME_COUNT_BYTES), `back=${back} ${fmt(getBytes(dstB, back))}`);
  setBytes(srcB, FACE_BYTES);
  r = e.test_multi_byte_to_wide_char(950, 0, srcB, FACE_BYTES.length, dstW, 16);
  check('MB2WC decodes the 細明體 face name bytes',
    r === 3 && eq(getWide(dstW, 3), FACE_WIDE), `r=${r} ${fmt(getWide(dstW, 3))}`);

  setBytes(srcB, [0x80, 0xFF, 0xFA, 0x40, 0xF9, 0xF9, 0xF9, 0xFE]);
  r = e.test_multi_byte_to_wide_char(950, 0, srcB, 8, dstW, 16);
  const back2 = e.test_wide_char_to_multi_byte(950, 0, dstW, r, dstB, 32, 0, 0);
  check('0x80, 0xFF, EUDC FA40, F9F9, F9FE round-trip byte for byte',
    r === 5 && eq(getWide(dstW, 5), [0x80, 0xF8F8, 0xE000, 0x2550, 0x2593]) &&
    back2 === 8 && eq(getBytes(dstB, 8), [0x80, 0xFF, 0xFA, 0x40, 0xF9, 0xF9, 0xF9, 0xFE]),
    `r=${r} ${fmt(getWide(dstW, 5))} back=${back2} ${fmt(getBytes(dstB, 8))}`);

  // ---- One lead-byte truth (ACP 950) ----
  // IsDBCSLeadByte, IsDBCSLeadByteEx(950), GetCPInfo(950).LeadByte,
  // CharNextA, CharNextExA(950), CharPrevA, _mbsinc and the decoder must
  // agree, byte by byte, on which bytes lead a pair.
  const cpinfo = e.guest_alloc(20);
  r = e.test_call_GetCPInfo(950, cpinfo);
  const info = getBytes(cpinfo, 18);
  check('GetCPInfo(950): MaxCharSize 2, DefaultChar "?", LeadByte 81..FE then 00 00',
    r === 1 && view.getUint32(wa(cpinfo), true) === 2 && info[4] === 0x3F && info[5] === 0 &&
    info[6] === 0x81 && info[7] === 0xFE && info[8] === 0 && info[9] === 0, `r=${r} ${fmt(info)}`);
  const inRanges = b => {
    for (let k = 6; k + 1 < 18 && (info[k] || info[k + 1]); k += 2) if (b >= info[k] && b <= info[k + 1]) return true;
    return false;
  };
  const probe = e.guest_alloc(8);
  const disagreements = [];
  for (let b = 1; b < 256; b++) {
    setBytes(probe, [b, 0x40, 0x41, 0]);
    const views = {
      IsDBCSLeadByte: e.test_call_IsDBCSLeadByte(b) !== 0,
      IsDBCSLeadByteEx: e.test_call_IsDBCSLeadByteEx(950, b) !== 0,
      GetCPInfo: inRanges(b),
      CharNextA: e.test_call_CharNextA(probe) === probe + 2,
      CharNextExA: e.test_call_CharNextExA(950, probe, 0) === probe + 2,
      CharPrevA: e.test_call_CharPrevA(probe, probe + 2) === probe,
      _mbsinc: e.test_mbsinc(probe) === probe + 2,
      decoder: unpackDec(e.test_cp_char_decode(950, probe, 4)).len === 2,
    };
    const vals = Object.values(views);
    if (!vals.every(v => v === vals[0]) || vals[0] !== (b >= 0x81 && b <= 0xFE)) {
      disagreements.push(`0x${b.toString(16)} ${JSON.stringify(views)}`);
    }
  }
  check('every lead-byte API agrees on 0x81..0xFE for all 255 non-NUL bytes',
    disagreements.length === 0, disagreements.slice(0, 4).join(' | '));
  // A4 40 81 40 41: the byte before offset 4 is a trail (0x40) whose
  // pair starts at 2; only a forward walk from the start can know that.
  setBytes(probe, [0xA4, 0x40, 0x81, 0x40, 0x41, 0]);
  check('CharPrevA/CharPrevExA step back over a whole pair, never before the start',
    e.test_call_CharPrevA(probe, probe + 4) === probe + 2 &&
    e.test_call_CharPrevExA(950, probe, probe + 4, 0) === probe + 2 &&
    e.test_call_CharPrevA(probe, probe + 2) === probe &&
    e.test_call_CharPrevA(probe, probe) === probe,
    `${e.test_call_CharPrevA(probe, probe + 4) - probe}`);
  setBytes(probe, [0x81, 0]);
  check('CharNextA does not pair a lead byte with the terminator',
    e.test_call_CharNextA(probe) === probe + 1 && e.test_call_CharNextA(probe + 1) === probe + 1);
  e.set_ansi_code_page(1252);
  setBytes(probe, [0xA4, 0x40, 0x41, 0]);
  check('ACP1252: CharNextA/CharPrevA/IsDBCSLeadByte give the one-byte answers; CharNextExA(950) still pairs',
    e.test_call_CharNextA(probe) === probe + 1 && e.test_call_CharPrevA(probe, probe + 2) === probe + 1 &&
    e.test_call_IsDBCSLeadByte(0xA4) === 0 && e.test_call_CharNextExA(950, probe, 0) === probe + 2);
  e.set_ansi_code_page(950);

  // ---- $ansi_to_wide honors the process ACP ----
  e.set_ansi_code_page(1252);
  setBytes(srcB, [0x41, 0x80, 0x00]);
  r = e.test_ansi_to_wide(srcB, dstW, 16);
  check('$ansi_to_wide under CP1252 is unchanged', r === 2 && eq(getWide(dstW, 3), [0x41, 0x80, 0]), `r=${r} ${fmt(getWide(dstW, 3))}`);
  e.set_ansi_code_page(950);
  setBytes(srcB, [...FUNDS_BYTES, 0]);
  r = e.test_ansi_to_wide(srcB, dstW, 16);
  check('$ansi_to_wide under ACP 950 decodes Big5', r === 3 && eq(getWide(dstW, 3), FUNDS_WIDE), `r=${r} ${fmt(getWide(dstW, 3))}`);
  e.set_ansi_code_page(1252);

  console.log(`--- codepage-big5: ${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
