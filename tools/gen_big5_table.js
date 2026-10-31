#!/usr/bin/env node
// Generate src/01c-big5-tables.generated.wat: the Big5 (code page 950)
// multibyte <-> Unicode conversion tables used by the DBCS decode family in
// src/10-helpers.wat ($ansi_char_decode / $ansi_char_encode) and, through it,
// by MultiByteToWideChar / WideCharToMultiByte.
//
// Source of truth, pinned: the WHATWG Encoding Standard's Big5 index,
// vendored verbatim (the "big5" member of the spec's indexes.json) at
// tools/index-big5.json. The generator verifies the vendored file's SHA-256
// and size against the pins below before reading a single entry, so the
// tables can only ever be rebuilt from exactly this mapping — never from
// whatever a runtime's bundled ICU happens to ship, which is how an earlier
// revision of this table came to decode FA40 as the U+E000 private-use
// reading and encode U+5341 as the A2 CC duplicate.
//
//   Source:        https://encoding.spec.whatwg.org/indexes.json
//   Source SHA-256: b7c8961095f0b4cae8f4a16a5011e7c84047a60c1277e28ee8df9e56074ee509
//   Source size:    530213 bytes (retrieved 2026-10-31)
//   Vendored:       tools/index-big5.json (the "big5" array, 19782 pointers)
//   Vendored SHA-256: 05072eb1bfd55a489c0e4aa2926591eec0fe97431ddfcf4e78927508aabfc886
//   Vendored size:    118699 bytes
//
// The Big5 index is frozen by web compatibility, so regeneration is
// deterministic. This mirrors tools/gen_api_table.js: the .wat output is
// committed, and `node tools/gen_big5_table.js --check` (wired into
// tools/build.sh) refuses a stale copy.
//
// Table shapes (fixed by construction, see DBCS-RESEARCH.md §5.1 step 1):
//   Decode: u16[(lead - 0xA1) * 157 + trailIndex], lead 0xA1..0xFE,
//     trailIndex = trail - 0x40 for trails 0x40..0x7E (0..62) and
//     trail - 0xA1 + 63 for trails 0xA1..0xFE (63..156). 0 = unmapped pair.
//     Big5 lead bytes 0x81..0xA0 carry no standard repertoire (the WHATWG
//     pairs that exist there are Big5-UAO vendor extensions), so the table
//     starts at 0xA1 exactly like the repertoire Windows CP950 converts.
//   Encode: u32 entries (codepoint << 16) | (lead << 8) | trail, sorted by
//     codepoint for binary search, one entry per distinct code point >= 0x80
//     (ASCII encodes as itself and needs no entry).
//
// Reverse-map preferences, explicit: 33 code points have two pointers in
// the table's domain — the standard Big5 code and an Eten/HKSCS duplicate
// (in most cases the duplicate is the F9..FE extension-block code). For
// those, ENCODE_PREFERENCE below names the standard code, the one Windows
// CP950 emits (U+5341 is A4 51, not A2 CC); the generator asserts the list
// is exactly the set of duplicated code points in the domain, so no
// duplicate is ever resolved by scan order or by accident. Decode is
// unaffected: both pointers decode to the code point.
//
// Non-BMP pointers: 291 in-domain pointers (the Big5-2003/HKSCS
// supplementary repertoire, e.g. FA 40 -> U+20547) name code points above
// the BMP. One WCHAR per character is the table's contract and CP950 has
// no such characters at all, so those pairs stay unmapped here — the
// index is still the pinned WHATWG one (the generator checks FA 40 at the
// index level), never the U+E000 private-use reading an ICU-derived table
// substituted for them.
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CHECK = process.argv.includes('--check');

const INDEX_PATH = path.join(__dirname, 'index-big5.json');
const INDEX_SHA256 = '05072eb1bfd55a489c0e4aa2926591eec0fe97431ddfcf4e78927508aabfc886';
const INDEX_SIZE = 118699;
const INDEX_POINTERS = 19782; // (0xFE - 0x81 + 1) leads * 157 trails

const LEAD_MIN = 0xA1;
const LEAD_MAX = 0xFE;
const TRAILS_PER_LEAD = 157; // 63 (0x40..0x7E) + 94 (0xA1..0xFE)
const DECODE_COUNT = (LEAD_MAX - LEAD_MIN + 1) * TRAILS_PER_LEAD;

// Code point -> [lead, trail]: the standard Big5 code for every code point
// the pinned index maps from two pointers inside the table's domain.
const ENCODE_PREFERENCE = new Map(Object.entries({
  0x2550: [0xA2, 0xA4], 0x255E: [0xA2, 0xA5], 0x2561: [0xA2, 0xA7],
  0x256A: [0xA2, 0xA6], 0x256D: [0xA2, 0x7E], 0x256E: [0xA2, 0xA1],
  0x256F: [0xA2, 0xA3], 0x2570: [0xA2, 0xA2], 0x3003: [0xA1, 0xB2],
  0x4EDD: [0xC9, 0x69], 0x5029: [0xAD, 0xC5], 0x507D: [0xB0, 0xB0],
  0x5305: [0xA5, 0x5D], 0x5341: [0xA4, 0x51], 0x5344: [0xA2, 0xCD],
  0x5345: [0xA4, 0xCA], 0x537F: [0xAD, 0xEB], 0x5A77: [0xB4, 0x40],
  0x5E75: [0xC9, 0xDB], 0x5EF4: [0xC6, 0xCF], 0x5F58: [0xD8, 0xF4],
  0x6490: [0xBC, 0xB5], 0x65E0: [0xC6, 0xD3], 0x6674: [0xB4, 0xB8],
  0x675E: [0xA7, 0xFB], 0x6C9C: [0xCB, 0x58], 0x6E1D: [0xB4, 0xFC],
  0x6E2F: [0xB4, 0xE4], 0x716E: [0xB5, 0x4E], 0x745C: [0xB7, 0xEC],
  0x74E9: [0xA2, 0x60], 0x7676: [0xC6, 0xD5], 0x7809: [0xCF, 0xF1],
}).map(([cp, pair]) => [Number(cp), pair]));

function trailByte(trailIndex) {
  return trailIndex < 63 ? 0x40 + trailIndex : 0xA1 + (trailIndex - 63);
}

function loadIndex() {
  const raw = fs.readFileSync(INDEX_PATH);
  if (raw.length !== INDEX_SIZE) {
    throw new Error(`tools/index-big5.json is ${raw.length} bytes, pinned size is ${INDEX_SIZE}`);
  }
  const sha = crypto.createHash('sha256').update(raw).digest('hex');
  if (sha !== INDEX_SHA256) {
    throw new Error(`tools/index-big5.json SHA-256 ${sha} != pinned ${INDEX_SHA256}`);
  }
  const index = JSON.parse(raw.toString('utf8'));
  if (!Array.isArray(index) || index.length !== INDEX_POINTERS) {
    throw new Error(`Big5 index must be ${INDEX_POINTERS} pointers, got ${index && index.length}`);
  }
  return index;
}

function buildTables() {
  const index = loadIndex();
  // Index pointers enumerate (lead, trail) from lead 0x81; the table's
  // domain starts at 0xA1.
  const pointerOf = (lead, t) => (lead - 0x81) * TRAILS_PER_LEAD + t;

  // Source sentinel, at the index level: FA 40 is U+20547 in the WHATWG
  // index. An ICU-derived mapping reads it as U+E000 instead; that is the
  // substitution this pin exists to keep out.
  if (index[pointerOf(0xFA, 0)] !== 0x20547) {
    throw new Error('sentinel: index pointer for FA 40 must be U+20547 (WHATWG), not U+E000');
  }

  const decode = new Uint16Array(DECODE_COUNT);
  const pointersByCp = new Map();
  let nonBmp = 0;
  for (let lead = LEAD_MIN; lead <= LEAD_MAX; lead++) {
    for (let t = 0; t < TRAILS_PER_LEAD; t++) {
      const cp = index[pointerOf(lead, t)];
      if (cp === null || cp === undefined) continue; // unmapped pair
      // Non-BMP pointers stay unmapped (see the header note); the count
      // is part of the pinned source's shape.
      if (cp > 0xFFFF) { nonBmp++; continue; }
      decode[(lead - LEAD_MIN) * TRAILS_PER_LEAD + t] = cp;
      if (!pointersByCp.has(cp)) pointersByCp.set(cp, []);
      pointersByCp.get(cp).push([lead, trailByte(t)]);
    }
  }
  if (nonBmp !== 291) {
    throw new Error(`expected 291 non-BMP in-domain pointers in the pinned index, got ${nonBmp}`);
  }

  // Sentinels over the built table.
  const decAt = (lead, trail) =>
    decode[(lead - LEAD_MIN) * TRAILS_PER_LEAD +
      (trail <= 0x7E ? trail - 0x40 : trail - 0xA1 + 63)];
  if (decAt(0xB2, 0xD3) !== 0x7D30) throw new Error('sentinel: B2 D3 must decode to U+7D30');
  if (decAt(0xFA, 0x40) !== 0) throw new Error('sentinel: FA 40 (U+20547, non-BMP) must stay unmapped in the WCHAR table, never U+E000');

  const encodeByCp = new Map();
  for (const [cp, pairs] of pointersByCp) {
    if (cp < 0x80) continue;
    if (pairs.length === 1) {
      encodeByCp.set(cp, (pairs[0][0] << 8) | pairs[0][1]);
    }
  }
  // Every duplicated code point must be decided by ENCODE_PREFERENCE, and
  // every preference must name one of its real pointers — the two lists
  // are the same set, checked both ways.
  const duplicated = [...pointersByCp.entries()]
    .filter(([cp, pairs]) => cp >= 0x80 && pairs.length > 1)
    .map(([cp]) => cp);
  for (const cp of duplicated) {
    const pref = ENCODE_PREFERENCE.get(cp);
    if (!pref) {
      throw new Error(`U+${cp.toString(16).toUpperCase()} has ${pointersByCp.get(cp).length} pointers but no ENCODE_PREFERENCE entry`);
    }
    const ok = pointersByCp.get(cp).some(([l, t]) => l === pref[0] && t === pref[1]);
    if (!ok) {
      throw new Error(`ENCODE_PREFERENCE for U+${cp.toString(16).toUpperCase()} is not one of its index pointers`);
    }
    encodeByCp.set(cp, (pref[0] << 8) | pref[1]);
  }
  for (const cp of ENCODE_PREFERENCE.keys()) {
    if (!duplicated.includes(cp)) {
      throw new Error(`ENCODE_PREFERENCE names U+${cp.toString(16).toUpperCase()}, which is not duplicated in the domain`);
    }
  }
  if (encodeByCp.get(0x5341) !== 0xA451) throw new Error('sentinel: U+5341 must encode as A4 51');

  const encode = [...encodeByCp.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([cp, pair]) => ((cp << 16) | pair) >>> 0);
  return { decode, encode };
}

function hexBytes(bytes) {
  return [...bytes].map(b => '\\' + b.toString(16).padStart(2, '0')).join('');
}

function renderWat({ decode, encode }) {
  let out = '';
  out += '  ;; Static Big5 (code page 950) conversion tables.\n';
  out += `  ;;   $BIG5_DECODE_TABLE: ${DECODE_COUNT} u16 entries indexed by\n`;
  out += '  ;;     (lead - 0xA1) * 157 + trailIndex (trailIndex: trail-0x40 for\n';
  out += '  ;;     0x40..0x7E, trail-0xA1+63 for 0xA1..0xFE); 0 = unmapped pair.\n';
  out += `  ;;   $BIG5_ENCODE_TABLE: ${encode.length} u32 entries sorted by code point,\n`;
  out += '  ;;     entry = (codepoint << 16) | (lead << 8) | trail; binary search.\n';
  out += '  ;; Source: the WHATWG Encoding Standard Big5 index, pinned and\n';
  out += '  ;; vendored at tools/index-big5.json (SHA-256 verified by the\n';
  out += '  ;; generator; see tools/gen_big5_table.js for provenance and the\n';
  out += '  ;; explicit reverse-map preferences for duplicated code points).\n';
  out += '  ;; Generated by tools/gen_big5_table.js — do not edit by hand\n';
  out += '  (data (region.addr $BIG5_DECODE_TABLE 0)\n';
  const dbuf = Buffer.alloc(2);
  for (let lead = LEAD_MIN; lead <= LEAD_MAX; lead++) {
    for (let t = 0; t < TRAILS_PER_LEAD; t += 16) {
      const bytes = [];
      for (let k = t; k < Math.min(t + 16, TRAILS_PER_LEAD); k++) {
        dbuf.writeUInt16LE(decode[(lead - LEAD_MIN) * TRAILS_PER_LEAD + k], 0);
        bytes.push(dbuf[0], dbuf[1]);
      }
      const tag = t === 0 ? `  ;; lead 0x${lead.toString(16).toUpperCase()}` : '';
      out += `    "${hexBytes(bytes)}"${tag}\n`;
    }
  }
  out += '  )\n';
  out += '  (data (region.addr $BIG5_ENCODE_TABLE 0)\n';
  const ebuf = Buffer.alloc(4);
  for (let i = 0; i < encode.length; i += 8) {
    const bytes = [];
    for (let k = i; k < Math.min(i + 8, encode.length); k++) {
      ebuf.writeUInt32LE(encode[k], 0);
      bytes.push(ebuf[0], ebuf[1], ebuf[2], ebuf[3]);
    }
    const firstCp = (encode[i] >>> 16).toString(16).toUpperCase().padStart(4, '0');
    out += `    "${hexBytes(bytes)}"  ;; U+${firstCp}..\n`;
  }
  out += '  )\n';
  out += `  (global $BIG5_DECODE_COUNT i32 (i32.const ${DECODE_COUNT}))\n`;
  out += `  (global $BIG5_ENCODE_COUNT i32 (i32.const ${encode.length}))\n`;
  return out;
}

const tables = buildTables();
const watData = renderWat(tables);
const watPath = path.join(__dirname, '..', 'src', '01c-big5-tables.generated.wat');

if (CHECK) {
  const currentWat = fs.existsSync(watPath) ? fs.readFileSync(watPath, 'utf8') : '';
  if (watData !== currentWat) {
    console.error('ERROR: src/01c-big5-tables.generated.wat is stale; run node tools/gen_big5_table.js');
    process.exit(1);
  }
  console.log(`gen_big5_table --check: 01c-big5-tables.generated.wat is current ` +
    `(${DECODE_COUNT} decode entries, ${tables.encode.length} encode entries)`);
  process.exit(0);
}

fs.writeFileSync(watPath, watData);
console.log(`Generated ${watPath}`);
console.log(`Decode data segment: ${DECODE_COUNT * 2} bytes; encode: ${tables.encode.length * 4} bytes`);
