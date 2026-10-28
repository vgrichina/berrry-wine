#!/usr/bin/env node
// Big5 (CP950) conversion regression tests: the $ansi_char_decode /
// $ansi_char_encode family and the MultiByteToWideChar /
// WideCharToMultiByte semantics built on it (DBCS stage 1). Pages without
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
const ERROR_INVALID_PARAMETER = 87;
const ERROR_INSUFFICIENT_BUFFER = 122;
const ERROR_NO_UNICODE_TRANSLATION = 1115;

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
  check('CP950 truncated pair is U+FFFD, 1 byte, invalid', d.wc === 0xFFFD && d.len === 1 && d.bad === 1, JSON.stringify(d));
  setBytes(srcB, [0xB2, 0x20]);
  d = unpackDec(e.test_cp_char_decode(950, srcB, 2));
  check('CP950 bad trail consumes the lead byte only', d.wc === 0xFFFD && d.len === 1 && d.bad === 1, JSON.stringify(d));
  setBytes(srcB, [0xA3, 0xC0]);
  d = unpackDec(e.test_cp_char_decode(950, srcB, 2));
  check('CP950 unmapped pair is U+FFFD, 2 bytes, invalid', d.wc === 0xFFFD && d.len === 2 && d.bad === 1, JSON.stringify(d));
  setBytes(srcB, [0x41]);
  d = unpackDec(e.test_cp_char_decode(950, srcB, 1));
  check('CP950 ASCII decodes as itself', d.wc === 0x41 && d.len === 1 && d.bad === 0, JSON.stringify(d));
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
  n = unpackEnc(e.test_cp_char_encode(1252, 0x20AC));
  check('CP1252 encode keeps low-byte truncation', n.b0 === 0xAC && n.len === 1 && n.unmapped === 0, JSON.stringify(n));

  // ---- MultiByteToWideChar ----
  setBytes(srcB, GAME_COUNT_BYTES);
  let r = e.test_multi_byte_to_wide_char(950, 0, srcB, GAME_COUNT_BYTES.length, dstW, 16);
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
  check('MB2WC without the flag maps bad trail to U+FFFD and moves on',
    r === 2 && eq(getWide(dstW, 2), [0xFFFD, 0x20]), `r=${r} ${fmt(getWide(dstW, 2))}`);
  setBytes(srcB, [0xB9, 0x43, 0xB2]);
  r = e.test_multi_byte_to_wide_char(950, 0, srcB, 3, dstW, 16);
  check('MB2WC truncated final pair yields the char plus U+FFFD',
    r === 2 && eq(getWide(dstW, 2), [0x904A, 0xFFFD]), `r=${r} ${fmt(getWide(dstW, 2))}`);
  r = e.test_multi_byte_to_wide_char(1200, 0, srcB, 3, dstW, 16);
  check('MB2WC unsupported code page fails with ERROR_INVALID_PARAMETER',
    r === 0 && e.test_get_last_error() === ERROR_INVALID_PARAMETER, `r=${r} err=${e.test_get_last_error()}`);
  r = e.test_multi_byte_to_wide_char(950, 0, srcB, 0, dstW, 16);
  check('MB2WC zero-length input returns 0', r === 0, `r=${r}`);
  setBytes(srcB, [0x41, 0x80, 0x9F]);
  r = e.test_multi_byte_to_wide_char(1252, 0, srcB, 3, dstW, 16);
  check('MB2WC CP1252 stays the identity expansion', r === 3 && eq(getWide(dstW, 3), [0x41, 0x80, 0x9F]), `r=${r} ${fmt(getWide(dstW, 3))}`);

  // CP_ACP follows the process page once the host sets it (stage wiring is
  // host-side; the conversion layer must already honor it).
  e.set_ansi_code_page(950);
  setBytes(srcB, FUNDS_BYTES);
  r = e.test_multi_byte_to_wide_char(0, 0, srcB, FUNDS_BYTES.length, dstW, 16);
  check('MB2WC CP_ACP decodes Big5 when the process ACP is 950',
    r === 3 && eq(getWide(dstW, 3), FUNDS_WIDE), `r=${r} ${fmt(getWide(dstW, 3))}`);
  e.set_ansi_code_page(1252);

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

  // ---- $ansi_to_wide honors the process ACP ----
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
