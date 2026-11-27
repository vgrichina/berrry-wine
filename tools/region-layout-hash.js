#!/usr/bin/env node
// region-layout-hash.js — one fingerprint for one placed memory map.
//
// WHY THIS EXISTS
// The wasm and lib/region-map.generated.js are two halves of the same map, and
// since wave 3 the bases in both are the ALLOCATOR's output. Pair a shaken
// artifact with the canonical mirror and nothing fails: every host import reads
// guest memory at the address the mirror names, the guest wrote it somewhere
// else, and the app draws a plausible wrong picture. tools/region-shake-smoke.js
// pairs them correctly on purpose, but `test/run.js --wasm=shaken.wasm` with no
// $WINE_REGION_MAP was silently mismatched and had no way to notice.
//
// So both sides carry a hash of the layout they were built for — the wasm in a
// `wine-region-layout` custom section (emitted by tools/build-compile-wat.js,
// invisible to execution), the mirror in `LAYOUT_HASH` — and the hosts compare
// them at load. A mismatch names both hashes and refuses to run.
//
// THE INPUT IS THE PLACEMENT, NOTHING ELSE. One line per region, `NAME:BASE:SIZE`
// in fixed-width hex, sorted by name, so the hash answers exactly "did any
// region land somewhere else, change size, appear or disappear" and is blind to
// everything that is not that: comments, ownership, declaration order, which
// compiler mode built it. Both artifacts (tail-call and compat) are built from
// one layout and therefore carry the same hash — that is correct, they ARE the
// same map.
//
// CLI:
//   node tools/region-layout-hash.js                  # the canonical layout's hash
//   node tools/region-layout-hash.js --shake=gap      # a shaken one's
//   node tools/region-layout-hash.js --wasm=FILE      # what an artifact carries
//   node tools/region-layout-hash.js --lines          # the hashed text itself
//   node tools/region-layout-hash.js --check --wasm=FILE [--mirror=FILE]
//     Compare bytes with the selected host mirror (default: WINE_REGION_MAP,
//     then lib/region-map.generated.js). No compiler, WASM engine or app runs.
//     Exit 0: stamps match; 1: mismatch or unstamped (compatibility unknown);
//     2: invalid input. This checks layout identity, not full WASM validity.
'use strict';

const crypto = require('crypto');

// The wasm custom section both halves meet in. A custom section is skipped by
// every engine, so this is inert at runtime — the artifact grows by ~40 bytes
// and executes identically.
const SECTION_NAME = 'wine-region-layout';

// 16 hex characters of SHA-256. Long enough that a collision is not a thing that
// happens to a map of 175 regions, short enough to read out of an error message
// and compare by eye.
const HASH_CHARS = 16;

const hx = (n) => (n >>> 0).toString(16).toUpperCase().padStart(8, '0');

// `regions` is anything with { name, base, size } — tools/region-layout.js's
// `regions`, the compiler's `result.regions.regions`, or
// tools/check-region-decls.js's declarations. The `$` on a name is optional and
// stripped, so the two spellings in the tree cannot produce two hashes.
function layoutLines(regions) {
  return regions
    .map(r => `${String(r.name).replace(/^\$/, '')}:${hx(r.base)}:${hx(r.size)}`)
    .sort();
}

function layoutHash(regions) {
  const text = layoutLines(regions).join('\n') + '\n';
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, HASH_CHARS);
}

// The placement as the COMPILER reports it, which is the input the build
// stamps into the artifact. Callers must not assemble their own region list:
// tools/check-region-decls.js's declarations, for instance, omit the
// `region.declare-span` entry, and hashing 174 regions on one side and 175 on
// the other produces a permanent, meaningless mismatch. One source, one hash.
function hashOfLayout(shake) {
  const { layout } = require('./region-layout.js');
  return layoutHash(layout(shake ? { shake } : {}).regions);
}

// ---------------------------------------------------------------------------
// The wasm side
// ---------------------------------------------------------------------------

function uleb(n) {
  const out = [];
  let v = n >>> 0;
  do { let b = v & 0x7f; v >>>= 7; if (v) b |= 0x80; out.push(b); } while (v);
  return Buffer.from(out);
}

// A custom section is `0x00, size, nameLen, name, payload` and may appear
// anywhere a section may, so appending it to a finished module is legal and
// leaves every other section byte-for-byte where it was.
function encodeSection(hash) {
  const name = Buffer.from(SECTION_NAME, 'utf8');
  const payload = Buffer.from(hash, 'utf8');
  const body = Buffer.concat([uleb(name.length), name, payload]);
  return Buffer.concat([Buffer.from([0x00]), uleb(body.length), body]);
}

// Stamping is IDEMPOTENT: an already-stamped module has its old section
// removed first. Without that, re-stamping leaves two `wine-region-layout`
// sections and every reader — ours and `WebAssembly.Module.customSections`,
// which returns them in order — takes the FIRST, i.e. the stale one. A check
// that reads the hash the module used to have is worse than no check.
function appendSection(wasmBytes, hash) {
  const bytes = toBuffer(wasmBytes);
  const at = findSection(bytes);
  const body = at ? Buffer.concat([bytes.subarray(0, at.start), bytes.subarray(at.end)]) : bytes;
  return Buffer.concat([body, encodeSection(hash)]);
}

function toBuffer(wasmBytes) {
  if (Buffer.isBuffer(wasmBytes)) return wasmBytes;
  if (ArrayBuffer.isView(wasmBytes)) {
    return Buffer.from(wasmBytes.buffer, wasmBytes.byteOffset, wasmBytes.byteLength);
  }
  return Buffer.from(wasmBytes);
}

// Walks the section list and returns { start, end, hash } for our custom
// section, or null. `start`/`end` bracket the whole section including its id
// and size, so a caller can excise it.
function findSection(wasmBytes) {
  const bytes = toBuffer(wasmBytes);
  if (bytes.length < 8) return null;
  let p = 8; // magic + version
  while (p < bytes.length) {
    const sectionStart = p;
    const id = bytes[p++];
    let size = 0, shift = 0, b;
    do {
      if (p >= bytes.length) return null;
      b = bytes[p++];
      size |= (b & 0x7f) << shift;
      shift += 7;
    } while (b & 0x80);
    const end = p + size;
    if (end > bytes.length) return null;
    if (id === 0) {
      let q = p, nameLen = 0, nshift = 0, nb, truncated = false;
      do {
        if (q >= end) { truncated = true; break; }
        nb = bytes[q++];
        nameLen |= (nb & 0x7f) << nshift;
        nshift += 7;
      } while (nb & 0x80);
      if (!truncated && q + nameLen <= end &&
          bytes.toString('utf8', q, q + nameLen) === SECTION_NAME) {
        return { start: sectionStart, end, hash: bytes.toString('utf8', q + nameLen, end) };
      }
    }
    p = end;
  }
  return null;
}

// Reads the hash back out. Takes bytes rather than a path so a browser host,
// which already has the ArrayBuffer it is about to instantiate, does not have
// to fetch the artifact twice. Returns null when the section is absent — an
// artifact built before this landed, which the caller reports in its own words.
function readSection(wasmBytes) {
  const at = findSection(wasmBytes);
  return at ? at.hash : null;
}

// ---------------------------------------------------------------------------

// Preflight is stricter than the legacy reporting reader: a truncated file,
// duplicate stamp or malformed hash must never look like a compatible pair.
// Only section framing is inspected; code and other payloads remain opaque.
function preflightStamp(bytes) {
  if (bytes.length < 8 || !bytes.subarray(0, 8).equals(Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]))) {
    throw new Error('invalid WASM magic/version');
  }
  let p = 8, stamp = null;
  const length = (limit) => {
    let value = 0;
    for (let i = 0; i < 5; i++) {
      if (p >= limit) throw new Error('truncated WASM length');
      const b = bytes[p++];
      if (i === 4 && (b & 0xf0)) throw new Error('invalid WASM u32 length');
      value += (b & 0x7f) * 2 ** (7 * i);
      if (!(b & 0x80)) return value;
    }
    throw new Error('invalid WASM length');
  };
  while (p < bytes.length) {
    const id = bytes[p++];
    if (id > 13) throw new Error(`invalid WASM section id ${id}`);
    const size = length(bytes.length), end = p + size;
    if (end > bytes.length) throw new Error('truncated WASM section');
    if (id === 0) {
      const nameSize = length(end), nameEnd = p + nameSize;
      if (nameEnd > end) throw new Error('truncated WASM custom section name');
      const name = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(p, nameEnd));
      if (name === SECTION_NAME) {
        if (stamp !== null) throw new Error(`duplicate '${SECTION_NAME}' section`);
        stamp = bytes.toString('utf8', nameEnd, end);
        if (!/^[0-9a-f]{16}$/.test(stamp)) throw new Error(`invalid '${SECTION_NAME}' fingerprint`);
      }
    }
    p = end;
  }
  return stamp;
}

function main() {
  const args = process.argv.slice(2);
  const seen = new Set();
  for (const a of args) {
    const match = /^--(wasm|shake|lines|check|mirror)(?:=(.*))?$/.exec(a);
    if (!match || seen.has(match[1])) throw new Error(`invalid or duplicate argument: ${a}`);
    seen.add(match[1]);
    if (['wasm', 'mirror'].includes(match[1]) && !match[2]) throw new Error(`${a}: requires a file path`);
    if (['check', 'lines'].includes(match[1]) && match[2] !== undefined) throw new Error(`${a}: takes no value`);
    if (match[1] === 'shake' && match[2] === '') throw new Error(`${a}: requires a shake mode`);
  }
  const arg = (n) => {
    const hit = process.argv.find(a => a === `--${n}` || a.startsWith(`--${n}=`));
    if (!hit) return null;
    const eq = hit.indexOf('=');
    return eq < 0 ? true : hit.slice(eq + 1);
  };
  const wasm = arg('wasm');
  if (arg('mirror') && !arg('check')) throw new Error('--mirror requires --check');
  if (arg('check')) {
    if (!wasm || arg('lines') || arg('shake')) throw new Error('--check requires --wasm=FILE and cannot use --lines or --shake');
    const path = require('path');
    const mirror = path.resolve(arg('mirror') || process.env.WINE_REGION_MAP ||
      path.join(__dirname, '../lib/region-map.generated.js'));
    // Use the host's own mirror selection, including its override mechanism.
    // Explicit --mirror wins over the environment for this CLI invocation.
    process.env.WINE_REGION_MAP = mirror;
    const selected = require('../lib/region-map.generated.js');
    if (!selected || typeof selected.LAYOUT_HASH !== 'string' ||
        !/^[0-9a-f]{16}$/.test(selected.LAYOUT_HASH)) throw new Error(`invalid mirror LAYOUT_HASH: ${mirror}`);
    const found = preflightStamp(require('fs').readFileSync(wasm));
    console.log(`wasm   ${path.resolve(wasm)}: ${found === null ? 'UNSTAMPED' : found}`);
    console.log(`mirror ${mirror}: ${selected.LAYOUT_HASH}`);
    if (found === null) {
      console.error(`region-layout-hash: compatibility UNKNOWN: no '${SECTION_NAME}' stamp; preflight cannot certify this pair`);
      return 1;
    }
    if (found !== selected.LAYOUT_HASH) {
      console.error('region-layout-hash: region layout MISMATCH');
      return 1;
    }
    console.log('region-layout-hash: region layout MATCH (stamp compatibility only)');
    return 0;
  }
  if (wasm) {
    const found = readSection(require('fs').readFileSync(wasm));
    if (!found) {
      console.error(`region-layout-hash: ${wasm} carries no '${SECTION_NAME}' section`);
      return 1;
    }
    console.log(found);
    return 0;
  }
  const shake = arg('shake');
  const { layout } = require('./region-layout.js');
  const L = layout({ shake: shake === true ? 'gap' : shake });
  if (arg('lines')) { for (const line of layoutLines(L.regions)) console.log(line); return 0; }
  console.log(layoutHash(L.regions));
  return 0;
}

if (require.main === module) {
  try { process.exit(main()); }
  catch (err) { console.error(String(err && err.message || err)); process.exit(2); }
}

module.exports = { layoutHash, layoutLines, hashOfLayout, appendSection, readSection, findSection, encodeSection,
                   SECTION_NAME, HASH_CHARS };
