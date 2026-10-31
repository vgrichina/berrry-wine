#!/usr/bin/env node
// Generate src/01c-big5-tables.generated.wat: the code page 950 (Big5, as
// Microsoft ships it) multibyte <-> Unicode tables used by the DBCS family
// in src/10-helpers.wat ($cp_char_decode / $ansi_char_encode) and, through
// it, by MultiByteToWideChar / WideCharToMultiByte and the GDI A funnels.
//
// Source of truth: Microsoft's own table, the same input Wine's
// tools/make_unicode reads to build its c_950 tables —
//
//   bestfit950.txt  https://www.unicode.org/Public/MAPPINGS/VENDORS/MICSFT/WindowsBestFit/bestfit950.txt
//                   SHA-256 cf8c23389a42a226ea707f7ec32c665556d1fc3364db25bd765ce64d54eaee2a
//   CP950.TXT       https://www.unicode.org/Public/MAPPINGS/VENDORS/MICSFT/WINDOWS/CP950.TXT
//                   SHA-256 ed403857b05e07ecd5667c7eff6b25898cb1fefe2d06cfe718d82d631e6058b6
//
// As in Wine, the sources are NOT vendored: the generator reads them from
// .cache/codepages/ (gitignored), downloading and SHA-256-verifying them on
// first use, and the generated .wat it writes is what is committed and what
// ships. bestfit950.txt is the whole table — CPINFO (MaxCharSize 2, default
// char 0x3F / U+003F), MBTABLE (single bytes, including 0x80 -> U+0080 and
// 0xFF -> U+F8F8), DBCSRANGE (lead bytes 0x81..0xFE), one DBCSTABLE per lead
// byte (every pair Windows decodes, the 6,217 user-defined EUDC pairs mapped
// contiguously into the Private Use Area), and WCTABLE (every WCHAR Windows
// encodes, best-fit mappings included). CP950.TXT is Microsoft's round-trip
// subset; the generator asserts bestfit950 agrees with it on every entry.
//
// --check (wired into tools/build.sh) must work offline, so it never fetches:
//   1. the committed file's header must name exactly the pinned source
//      SHA-256s and carry a SHA-256 of its own data body that still matches
//      (a hand edit, or a regeneration from other bytes, fails here);
//   2. the tables are parsed back out of the committed .wat and the
//      structural invariants and sentinels below are re-asserted on them;
//   3. when the pinned sources are present in .cache/codepages/, the file is
//      also regenerated from them and must match byte for byte.
//
// Table shapes:
//   $BIG5_DECODE_TABLE: u16[256] single-byte table (MBTABLE; 0 at the lead
//     bytes, which never index it), then u16[(lead - LEAD_FIRST) * 157 +
//     trailIndex] for leads LEAD_FIRST..LEAD_LAST, trailIndex = trail - 0x40
//     for 0x40..0x7E (0..62) and trail - 0xA1 + 63 for 0xA1..0xFE (63..156).
//     0 = no DBCSTABLE entry (decodes to the default char).
//   $BIG5_ENCODE_TABLE: u32 (codepoint << 16) | bytes, sorted by code point
//     for binary search: bytes < 0x100 is one byte, else (lead << 8) | trail.
//     Every WCTABLE entry >= U+0080 (U+0000..U+007F encode as themselves,
//     asserted). Best-fit entries are kept: Windows' WideCharToMultiByte
//     applies them by default and Win98 has no WC_NO_BEST_FIT_CHARS.
//
// There are no HKSCS or non-BMP characters here: CP950 has none. Characters
// outside WCTABLE (HKSCS-only ones such as U+014B among them) encode to the
// default char, as on Windows.
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CHECK = process.argv.includes('--check');
const argValue = name => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const CACHE = path.join(ROOT, '.cache', 'codepages');
const WAT_PATH = path.join(ROOT, 'src', '01c-big5-tables.generated.wat');

const SOURCES = {
  bestfit: {
    file: 'bestfit950.txt',
    url: 'https://www.unicode.org/Public/MAPPINGS/VENDORS/MICSFT/WindowsBestFit/bestfit950.txt',
    sha256: 'cf8c23389a42a226ea707f7ec32c665556d1fc3364db25bd765ce64d54eaee2a',
  },
  cp950: {
    file: 'CP950.TXT',
    url: 'https://www.unicode.org/Public/MAPPINGS/VENDORS/MICSFT/WINDOWS/CP950.TXT',
    sha256: 'ed403857b05e07ecd5667c7eff6b25898cb1fefe2d06cfe718d82d631e6058b6',
  },
};

const TRAILS_PER_LEAD = 157; // 63 (0x40..0x7E) + 94 (0xA1..0xFE)
const SB_ENTRIES = 256;

const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
const hex = (n, w = 4) => '0x' + n.toString(16).toUpperCase().padStart(w, '0');
function fail(msg) { throw new Error(`gen_big5_table: ${msg}`); }

function trailIndex(trail) {
  if (trail >= 0x40 && trail <= 0x7E) return trail - 0x40;
  if (trail >= 0xA1 && trail <= 0xFE) return trail - 0xA1 + 63;
  return -1;
}
function trailByte(t) { return t < 63 ? 0x40 + t : 0xA1 + (t - 63); }

// ---- sources ------------------------------------------------------------

function download(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        if (!redirects) return reject(new Error(`too many redirects: ${url}`));
        return resolve(download(new URL(res.headers.location, url).href, redirects - 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`GET ${url}: HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// The pinned bytes of one source, or null when absent and fetching is off.
// A present file with the wrong hash is always fatal: it is not the table.
async function loadSource(key, { fetch }) {
  const src = SOURCES[key];
  const override = argValue(key);
  const file = override ? path.resolve(override) : path.join(CACHE, src.file);
  if (!fs.existsSync(file)) {
    if (override) fail(`--${key}=${override}: no such file`);
    if (!fetch) return null;
    console.log(`gen_big5_table: fetching ${src.url}`);
    const bytes = await download(src.url);
    if (sha256(bytes) !== src.sha256) {
      fail(`${src.url} SHA-256 ${sha256(bytes)} != pinned ${src.sha256}; refusing it`);
    }
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(file, bytes);
  }
  const bytes = fs.readFileSync(file);
  if (sha256(bytes) !== src.sha256) {
    fail(`${file} SHA-256 ${sha256(bytes)} != pinned ${src.sha256}; delete it to re-fetch`);
  }
  return bytes.toString('latin1');
}

// bestfit950.txt -> { cpinfo, mb: Map, leadFirst, leadLast, dbcs: Map, wc: Map }
function parseBestfit(text) {
  const lines = text.split(/\r?\n/).map(l => l.replace(/[;#].*$/, '').trim());
  const out = { mb: new Map(), dbcs: new Map(), wc: new Map() };
  let section = null, remaining = 0, leadSeq = [], leadPos = 0, lead = -1;
  for (let i = 0; i < lines.length; i++) {
    const tok = lines[i].split(/\s+/).filter(Boolean);
    if (!tok.length) continue;
    const word = tok[0].toUpperCase();
    if (/^[A-Z]/.test(word)) {
      if (remaining) fail(`bestfit950: ${section} ended ${remaining} entries early at line ${i + 1}`);
      section = word;
      const n = Number(tok[1]);
      if (word === 'CODEPAGE') { if (n !== 950) fail(`CODEPAGE ${tok[1]}`); continue; }
      if (word === 'CPINFO') {
        out.cpinfo = { maxCharSize: Number(tok[1]), defaultChar: Number(tok[2]), defaultWchar: Number(tok[3]) };
        continue;
      }
      if (word === 'ENDCODEPAGE') { section = null; continue; }
      if (word === 'DBCSTABLE') {
        if (leadPos >= leadSeq.length) fail('more DBCSTABLEs than DBCSRANGE lead bytes');
        lead = leadSeq[leadPos++];
      }
      if (!['MBTABLE', 'DBCSRANGE', 'DBCSTABLE', 'WCTABLE'].includes(word)) fail(`unknown section ${word}`);
      remaining = n;
      continue;
    }
    const a = Number(tok[0]), b = Number(tok[1]);
    if (!Number.isInteger(a) || !Number.isInteger(b)) fail(`bad entry at line ${i + 1}: ${lines[i]}`);
    if (!remaining) fail(`entry outside a section at line ${i + 1}`);
    remaining--;
    if (section === 'MBTABLE') out.mb.set(a, b);
    else if (section === 'DBCSRANGE') {
      if (out.leadFirst !== undefined) fail('more than one DBCSRANGE pair (the table shape assumes one)');
      out.leadFirst = a; out.leadLast = b;
      for (let l = a; l <= b; l++) leadSeq.push(l);
    } else if (section === 'DBCSTABLE') out.dbcs.set((lead << 8) | a, b);
    else if (section === 'WCTABLE') {
      if (out.wc.has(a)) fail(`WCTABLE lists U+${hex(a)} twice`);
      out.wc.set(a, b);
    }
  }
  if (remaining) fail(`bestfit950: ${section} truncated`);
  if (leadPos !== leadSeq.length) fail(`DBCSRANGE has ${leadSeq.length} leads but ${leadPos} DBCSTABLEs`);
  return out;
}

// CP950.TXT -> [[bytes, codepoint]]
function parseCp950(text) {
  const rows = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const [a, b] = line.split(/\s+/);
    if (b === undefined) continue; // undefined byte (e.g. 0x80 has no entry)
    rows.push([Number(a), Number(b)]);
  }
  return rows;
}

// ---- tables -------------------------------------------------------------

function buildTables(bf, cp950Rows) {
  const { cpinfo } = bf;
  if (!cpinfo || cpinfo.maxCharSize !== 2 || cpinfo.defaultChar !== 0x3F || cpinfo.defaultWchar !== 0x3F) {
    fail(`CPINFO must be "2 0x3f 0x003f", got ${JSON.stringify(cpinfo)}`);
  }
  const { leadFirst, leadLast } = bf;
  if (leadFirst !== 0x81 || leadLast !== 0xFE) fail(`DBCSRANGE ${hex(leadFirst, 2)}..${hex(leadLast, 2)}, expected 0x81..0xFE`);
  const isLead = b => b >= leadFirst && b <= leadLast;

  // Single bytes: MBTABLE must cover exactly the non-lead bytes.
  const sb = new Uint16Array(SB_ENTRIES);
  for (let b = 0; b < 256; b++) {
    if (isLead(b)) { if (bf.mb.has(b)) fail(`MBTABLE maps lead byte ${hex(b, 2)}`); continue; }
    if (!bf.mb.has(b)) fail(`MBTABLE has no entry for non-lead byte ${hex(b, 2)}`);
    sb[b] = bf.mb.get(b);
    if (b < 0x80 && sb[b] !== b) fail(`MBTABLE ${hex(b, 2)} is not ASCII identity`);
  }

  const leads = leadLast - leadFirst + 1;
  const db = new Uint16Array(leads * TRAILS_PER_LEAD);
  for (const [pair, cp] of bf.dbcs) {
    const lead = pair >> 8, trail = pair & 0xFF;
    const t = trailIndex(trail);
    if (t < 0) fail(`DBCSTABLE pair ${hex(pair)} has a trail outside 0x40-0x7E/0xA1-0xFE`);
    if (cp === 0 || cp > 0xFFFF) fail(`DBCSTABLE pair ${hex(pair)} -> ${hex(cp)} is not one BMP WCHAR`);
    db[(lead - leadFirst) * TRAILS_PER_LEAD + t] = cp;
  }

  // Encode: every WCTABLE entry >= U+0080.
  const encode = [];
  for (const [cp, bytes] of bf.wc) {
    if (cp < 0x80) { if (bytes !== cp) fail(`WCTABLE U+${hex(cp)} is not ASCII identity`); continue; }
    if (bytes > 0xFF) {
      const lead = bytes >> 8, trail = bytes & 0xFF;
      if (!isLead(lead) || trailIndex(trail) < 0) fail(`WCTABLE U+${hex(cp)} -> ${hex(bytes)} is not a valid pair`);
    } else if (isLead(bytes)) fail(`WCTABLE U+${hex(cp)} -> lone lead byte ${hex(bytes, 2)}`);
    encode.push(((cp << 16) | bytes) >>> 0);
  }
  encode.sort((a, b) => a - b);

  const tables = { sb, db, encode, leadFirst, leadLast, defaultChar: 0x3F, defaultWchar: 0x3F };
  assertCp950Agreement(tables, cp950Rows);
  assertInvariants(tables);
  return tables;
}

function decodeOf(t, bytes) {
  if (bytes < 0x100) return t.sb[bytes];
  const lead = bytes >> 8, ti = trailIndex(bytes & 0xFF);
  if (lead < t.leadFirst || lead > t.leadLast || ti < 0) return 0;
  return t.db[(lead - t.leadFirst) * TRAILS_PER_LEAD + ti];
}
function encodeOf(t, cp) {
  if (cp < 0x80) return cp;
  let lo = 0, hi = t.encode.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1, c = t.encode[mid] >>> 16;
    if (cp < c) hi = mid; else if (cp > c) lo = mid + 1; else return t.encode[mid] & 0xFFFF;
  }
  return -1;
}

// Every CP950.TXT entry decodes identically from bestfit950's tables, and
// every CP950.TXT code point encodes to one of its CP950.TXT byte sequences.
function assertCp950Agreement(t, rows) {
  if (rows.length < 13000) fail(`CP950.TXT has only ${rows.length} entries`);
  const bytesByCp = new Map();
  for (const [bytes, cp] of rows) {
    const got = decodeOf(t, bytes);
    if (got !== cp) fail(`CP950.TXT ${hex(bytes)} -> U+${hex(cp)}, bestfit950 decodes U+${hex(got)}`);
    if (!bytesByCp.has(cp)) bytesByCp.set(cp, []);
    bytesByCp.get(cp).push(bytes);
  }
  for (const [cp, list] of bytesByCp) {
    const got = encodeOf(t, cp);
    if (!list.includes(got)) fail(`CP950.TXT U+${hex(cp)} is ${list.map(b => hex(b)).join('/')}, bestfit950 encodes ${hex(got)}`);
  }
}

// Shape + sentinels, asserted on generation and again by --check on the
// tables parsed back out of the committed .wat.
function assertInvariants(t) {
  const expect = (what, got, want) => {
    if (got !== want) fail(`sentinel ${what}: got ${hex(got)}, want ${hex(want)}`);
  };
  if (t.leadFirst !== 0x81 || t.leadLast !== 0xFE) fail('lead range must be 0x81..0xFE');
  if (t.db.length !== (t.leadLast - t.leadFirst + 1) * TRAILS_PER_LEAD) fail('decode table size');
  // EUDC blocks map contiguously into the Private Use Area.
  const eudc = [[0xFA, 0xFE, 0xE000, 0xE310], [0x8E, 0xA0, 0xE311, 0xEEB7],
    [0x81, 0x8D, 0xEEB8, 0xF6B0], [0xC6, 0xC8, 0xF6B1, 0xF848]];
  for (const [l0, l1, u0, u1] of eudc) {
    let next = u0;
    for (let lead = l0; lead <= l1; lead++) {
      for (let ti = 0; ti < TRAILS_PER_LEAD; ti++) {
        if (lead === 0xC6 && trailByte(ti) < 0xA1) continue; // C640..C67E are standard chars
        const w = t.db[(lead - t.leadFirst) * TRAILS_PER_LEAD + ti];
        if (w !== next) fail(`EUDC ${hex((lead << 8) | trailByte(ti))} -> U+${hex(w)}, want U+${hex(next)}`);
        next++;
      }
    }
    if (next - 1 !== u1) fail(`EUDC block ${hex(l0, 2)}..${hex(l1, 2)} ends at U+${hex(next - 1)}, want U+${hex(u1)}`);
  }
  expect('decode FA40', decodeOf(t, 0xFA40), 0xE000);
  expect('decode FEFE', decodeOf(t, 0xFEFE), 0xE310);
  expect('decode 8140', decodeOf(t, 0x8140), 0xEEB8);
  expect('decode C6A1', decodeOf(t, 0xC6A1), 0xF6B1);
  expect('decode F9FE', decodeOf(t, 0xF9FE), 0x2593);
  expect('decode B2D3', decodeOf(t, 0xB2D3), 0x7D30);
  expect('decode 0x80', decodeOf(t, 0x80), 0x0080);
  expect('decode 0xFF', decodeOf(t, 0xFF), 0xF8F8);
  expect('decode A3E2 (unmapped)', decodeOf(t, 0xA3E2), 0);
  expect('encode U+5341', encodeOf(t, 0x5341), 0xA451);
  expect('encode U+2550', encodeOf(t, 0x2550), 0xF9F9);
  expect('encode U+255E', encodeOf(t, 0x255E), 0xF9E9);
  expect('encode U+2561', encodeOf(t, 0x2561), 0xF9EB);
  expect('encode U+256A', encodeOf(t, 0x256A), 0xF9EA);
  expect('encode U+00A5 (best fit)', encodeOf(t, 0x00A5), 0xA244);
  expect('encode U+E000', encodeOf(t, 0xE000), 0xFA40);
  expect('encode U+F848', encodeOf(t, 0xF848), 0xC8FE);
  expect('encode U+0080', encodeOf(t, 0x0080), 0x80);
  expect('encode U+F8F8', encodeOf(t, 0xF8F8), 0xFF);
  expect('encode U+2593', encodeOf(t, 0x2593), 0xF9FE);
  expect('encode U+014B (HKSCS-only)', encodeOf(t, 0x014B), -1);
  for (let i = 1; i < t.encode.length; i++) {
    if ((t.encode[i] >>> 16) <= (t.encode[i - 1] >>> 16)) fail('encode table not strictly sorted');
  }
  // Every mapped pair round-trips or is one of a duplicate set whose
  // preferred encoding decodes to the same character.
  for (let lead = t.leadFirst; lead <= t.leadLast; lead++) {
    for (let ti = 0; ti < TRAILS_PER_LEAD; ti++) {
      const w = t.db[(lead - t.leadFirst) * TRAILS_PER_LEAD + ti];
      if (!w) continue;
      const e = encodeOf(t, w);
      if (e < 0 || decodeOf(t, e) !== w) fail(`U+${hex(w)} from ${hex((lead << 8) | trailByte(ti))} does not round-trip`);
    }
  }
}

// ---- render / parse -----------------------------------------------------

function hexBytes(bytes) { return [...bytes].map(b => '\\' + b.toString(16).padStart(2, '0')).join(''); }

function renderBody(t) {
  let out = '';
  out += '  (data (region.addr $BIG5_DECODE_TABLE 0)\n';
  const u16 = (arr, from, to, tag) => {
    const bytes = [];
    for (let k = from; k < to; k++) bytes.push(arr[k] & 0xFF, arr[k] >> 8);
    out += `    "${hexBytes(bytes)}"${tag ? `  ;; ${tag}` : ''}\n`;
  };
  for (let i = 0; i < SB_ENTRIES; i += 16) u16(t.sb, i, i + 16, i === 0 ? 'single bytes (MBTABLE)' : '');
  for (let lead = t.leadFirst; lead <= t.leadLast; lead++) {
    const base = (lead - t.leadFirst) * TRAILS_PER_LEAD;
    for (let k = 0; k < TRAILS_PER_LEAD; k += 16) {
      u16(t.db, base + k, base + Math.min(k + 16, TRAILS_PER_LEAD), k === 0 ? `lead ${hex(lead, 2)}` : '');
    }
  }
  out += '  )\n';
  out += '  (data (region.addr $BIG5_ENCODE_TABLE 0)\n';
  for (let i = 0; i < t.encode.length; i += 8) {
    const bytes = [];
    for (let k = i; k < Math.min(i + 8, t.encode.length); k++) {
      const v = t.encode[k];
      bytes.push(v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, v >>> 24);
    }
    out += `    "${hexBytes(bytes)}"  ;; U+${(t.encode[i] >>> 16).toString(16).toUpperCase().padStart(4, '0')}..\n`;
  }
  out += '  )\n';
  out += `  (global $BIG5_LEAD_FIRST i32 (i32.const ${hex(t.leadFirst, 2)}))\n`;
  out += `  (global $BIG5_LEAD_LAST i32 (i32.const ${hex(t.leadLast, 2)}))\n`;
  out += `  (global $BIG5_DEFAULT_CHAR i32 (i32.const ${hex(t.defaultChar, 2)}))\n`;
  out += `  (global $BIG5_DEFAULT_WCHAR i32 (i32.const ${hex(t.defaultWchar)}))\n`;
  out += `  (global $BIG5_SB_ENTRIES i32 (i32.const ${SB_ENTRIES}))\n`;
  out += `  (global $BIG5_DECODE_COUNT i32 (i32.const ${SB_ENTRIES + t.db.length}))\n`;
  out += `  (global $BIG5_ENCODE_COUNT i32 (i32.const ${t.encode.length}))\n`;
  return out;
}

function renderWat(t) {
  const body = renderBody(t);
  let head = '';
  head += '  ;; Code page 950 (Big5, Microsoft) conversion tables.\n';
  head += `  ;;   $BIG5_DECODE_TABLE: ${SB_ENTRIES} u16 single-byte entries, then\n`;
  head += `  ;;     ${t.db.length} u16 pair entries indexed (lead - 0x81) * 157 + trailIndex\n`;
  head += '  ;;     (trail-0x40 for 0x40..0x7E, trail-0xA1+63 for 0xA1..0xFE); 0 = unmapped.\n';
  head += `  ;;   $BIG5_ENCODE_TABLE: ${t.encode.length} u32 entries (codepoint << 16) | bytes,\n`;
  head += '  ;;     sorted by code point; bytes < 0x100 is a single byte. Best fit included.\n';
  head += '  ;; Generated by tools/gen_big5_table.js from Microsoft bestfit950.txt — do not edit.\n';
  head += `  ;; source bestfit950.txt sha256 ${SOURCES.bestfit.sha256}\n`;
  head += `  ;; source CP950.TXT sha256 ${SOURCES.cp950.sha256}\n`;
  head += `  ;; body sha256 ${sha256(body)}\n`;
  return head + body;
}

// The committed .wat back into tables, for the offline --check.
function parseWat(text) {
  const header = name => {
    const m = text.match(new RegExp(`;; ${name} sha256 ([0-9a-f]{64})`));
    return m ? m[1] : null;
  };
  const bodyAt = text.indexOf('  (data (region.addr $BIG5_DECODE_TABLE 0)');
  if (bodyAt < 0) fail('committed .wat has no decode data segment');
  const body = text.slice(bodyAt);
  const segment = name => {
    const start = body.indexOf(`(data (region.addr ${name} 0)`);
    const end = body.indexOf('\n  )\n', start);
    if (start < 0 || end < 0) fail(`committed .wat has no ${name} segment`);
    const bytes = [];
    for (const m of body.slice(start, end).matchAll(/"([^"]*)"/g)) {
      for (const h of m[1].matchAll(/\\([0-9a-f]{2})/g)) bytes.push(parseInt(h[1], 16));
    }
    return Buffer.from(bytes);
  };
  const global = name => {
    const m = body.match(new RegExp(`\\(global \\${name} i32 \\(i32\\.const (0x[0-9A-Fa-f]+|\\d+)\\)\\)`));
    if (!m) fail(`committed .wat has no ${name}`);
    return Number(m[1]);
  };
  const dec = segment('$BIG5_DECODE_TABLE');
  const enc = segment('$BIG5_ENCODE_TABLE');
  const u16 = Array.from({ length: dec.length / 2 }, (_, i) => dec.readUInt16LE(i * 2));
  const t = {
    leadFirst: global('$BIG5_LEAD_FIRST'), leadLast: global('$BIG5_LEAD_LAST'),
    defaultChar: global('$BIG5_DEFAULT_CHAR'), defaultWchar: global('$BIG5_DEFAULT_WCHAR'),
    sb: Uint16Array.from(u16.slice(0, SB_ENTRIES)), db: Uint16Array.from(u16.slice(SB_ENTRIES)),
    encode: Array.from({ length: enc.length / 4 }, (_, i) => enc.readUInt32LE(i * 4)),
  };
  if (global('$BIG5_DECODE_COUNT') !== u16.length) fail('$BIG5_DECODE_COUNT disagrees with the segment');
  if (global('$BIG5_ENCODE_COUNT') !== t.encode.length) fail('$BIG5_ENCODE_COUNT disagrees with the segment');
  return { t, body, bestfit: header('source bestfit950.txt'), cp950: header('source CP950.TXT'), bodySha: header('body') };
}

async function main() {
  if (CHECK) {
    if (!fs.existsSync(WAT_PATH)) fail('src/01c-big5-tables.generated.wat is missing');
    const committed = fs.readFileSync(WAT_PATH, 'utf8');
    const parsed = parseWat(committed);
    if (parsed.bestfit !== SOURCES.bestfit.sha256 || parsed.cp950 !== SOURCES.cp950.sha256) {
      fail('committed table names other source hashes than the pinned ones; regenerate it');
    }
    if (parsed.bodySha !== sha256(parsed.body)) fail('committed table body does not match its recorded SHA-256 (hand edit?); regenerate it');
    assertInvariants(parsed.t);
    const bf = await loadSource('bestfit', { fetch: false });
    const cp = await loadSource('cp950', { fetch: false });
    let mode = 'header + invariants (sources not cached: offline check)';
    if (bf && cp) {
      if (renderWat(buildTables(parseBestfit(bf), parseCp950(cp))) !== committed) {
        fail('src/01c-big5-tables.generated.wat is stale; run node tools/gen_big5_table.js');
      }
      mode = 'regenerated from cached pinned sources, identical';
    }
    console.log(`gen_big5_table --check: 01c-big5-tables.generated.wat is current ` +
      `(${parsed.t.encode.length} encode entries; ${mode})`);
    return;
  }
  const bf = await loadSource('bestfit', { fetch: true });
  const cp = await loadSource('cp950', { fetch: true });
  const tables = buildTables(parseBestfit(bf), parseCp950(cp));
  fs.writeFileSync(WAT_PATH, renderWat(tables));
  console.log(`Generated ${WAT_PATH}`);
  console.log(`decode: ${(SB_ENTRIES + tables.db.length) * 2} bytes; encode: ${tables.encode.length} entries, ${tables.encode.length * 4} bytes`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
