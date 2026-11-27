#!/usr/bin/env node
'use strict';
// tl;dr: known-routine signature census (docs/design/known-routine-framework.md
// §3/§11). extract signatures from a reference PE, scan a corpus for them,
// weigh a --handler-hist JSON by routine, and `find` the MSVC string/memory
// routine variants src/10-helpers-msvc-routines.wat matches in given PEs.
// Promoted from scratch/runs/20261125-known-routine-census/scripts/krsig.js.
//
//   node tools/kr-sig.js extract --ref=PE --tag=TAG [--names=a,b] [--va=name=0xVA ...]
//        [--all-exports] [--prefix=32] [--body=256] --out=sigs.json [--append]
//   node tools/kr-sig.js scan --sigs=sigs.json --root=DIR [--root=DIR] --out=scan.json
//        [--max-mb=24]
//   node tools/kr-sig.js weigh --sigs=sigs.json --hist=H.json --pe=NAME=PATH ...
//        [--top-unmatched=30] [--json=OUT]
//
// A signature is FLIRT-shaped: the first PREFIX bytes of the reference body,
// cut at an instruction boundary, with every byte the loader or linker may
// change masked out:
//   - a base-relocation (HIGHLOW) target inside the body;
//   - the rel32 of E8/E9/0F8x (callee/jump target moves with the layout);
//   - in a reference with no .reloc (Delphi/Borland exes), any in-instruction
//     4-byte window whose value is an address inside the reference image.
// plus the masked remainder of the body up to BODY bytes (or the next known
// function start) as a second, full-length check. A scan reports `prefix` and
// `full` matches separately: prefix-only matches are variants worth a second
// signature, full matches are the same code.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const { readPE } = require(path.join(ROOT, 'lib/pe'));
const { disasmAt } = require(path.join(ROOT, 'tools/disasm'));

const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = (n, d) => { const a = argv.find(x => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const flags = n => argv.filter(x => x.startsWith(`--${n}=`)).map(x => x.slice(n.length + 3));
const has = n => argv.includes(`--${n}`);
const hex = v => '0x' + (v >>> 0).toString(16);

function dataDir(pe, idx) {
  const b = pe.buf, optOff = pe.peOff + 24;
  const magic = b.readUInt16LE(optOff);
  const base = optOff + (magic === 0x20b ? 112 : 96);
  return { rva: b.readUInt32LE(base + idx * 8), size: b.readUInt32LE(base + idx * 8 + 4) };
}
function sizeOfImage(pe) { return pe.buf.readUInt32LE(pe.peOff + 24 + 56); }

function exportsOf(pe) {
  const b = pe.buf, d0 = dataDir(pe, 0), out = [];
  if (!d0.rva) return out;
  const d = pe.va2off(pe.imageBase + d0.rva);
  if (d < 0) return out;
  const nFuncs = b.readUInt32LE(d + 20), nNames = b.readUInt32LE(d + 24);
  const aof = pe.va2off(pe.imageBase + b.readUInt32LE(d + 28));
  const aon = pe.va2off(pe.imageBase + b.readUInt32LE(d + 32));
  const ano = pe.va2off(pe.imageBase + b.readUInt32LE(d + 36));
  for (let i = 0; i < nNames; i++) {
    const no = pe.va2off(pe.imageBase + b.readUInt32LE(aon + i * 4));
    let name = '';
    for (let j = no; b[j] && name.length < 128; j++) name += String.fromCharCode(b[j]);
    const idx = b.readUInt16LE(ano + i * 2);
    if (idx >= nFuncs) continue;
    const rva = b.readUInt32LE(aof + idx * 4);
    if (rva >= d0.rva && rva < d0.rva + d0.size) continue; // forwarder
    out.push({ name, va: (pe.imageBase + rva) >>> 0 });
  }
  out.sort((x, y) => x.va - y.va);
  return out;
}

function relocSet(pe) {
  const set = new Set();
  const d = dataDir(pe, 5);
  if (!d.rva) return null;
  let off = pe.va2off(pe.imageBase + d.rva);
  if (off < 0) return null;
  const end = off + d.size;
  const b = pe.buf;
  while (off + 8 <= end) {
    const page = b.readUInt32LE(off), bsz = b.readUInt32LE(off + 4);
    if (bsz < 8) break;
    for (let p = off + 8; p < off + bsz; p += 2) {
      const e = b.readUInt16LE(p);
      if ((e >> 12) === 3) set.add((pe.imageBase + page + (e & 0xfff)) >>> 0);
    }
    off += bsz;
  }
  return set;
}

// [{va, len, bytes, text}] for instructions from va, up to maxBytes.
function insns(pe, va, maxBytes) {
  const off = pe.va2off(va);
  if (off < 0) return [];
  const lines = disasmAt(pe.buf, off, va, Math.ceil(maxBytes / 1) + 4);
  const out = [];
  let total = 0;
  for (const l of lines) {
    const m = l.match(/^([0-9a-f]{8})\s+((?:[0-9a-f]{2} )+)\s*(.*)$/);
    if (!m) break;
    const bytes = m[2].trim().split(' ').map(x => parseInt(x, 16));
    out.push({ va: parseInt(m[1], 16) >>> 0, len: bytes.length, bytes, text: m[3] });
    total += bytes.length;
    if (total >= maxBytes) break;
  }
  return out;
}

function buildSig(pe, relocs, name, va, limit, prefixLen, tag) {
  const lo = pe.imageBase, hi = (pe.imageBase + sizeOfImage(pe)) >>> 0;
  const list = insns(pe, va, limit);
  const bytes = [], mask = [];
  let prefixCut = 0, ended = false;
  for (const ins of list) {
    if (bytes.length + ins.len > limit) break;
    const m = new Array(ins.len).fill(1);
    const b0 = ins.bytes[0], b1 = ins.bytes[1];
    // prefixes are rare in these bodies; handle 66/F3/F2 lead bytes loosely
    if (b0 === 0xe8 || b0 === 0xe9) for (let k = 1; k < 5; k++) m[k] = 0;
    if (b0 === 0x0f && b1 >= 0x80 && b1 <= 0x8f) for (let k = 2; k < 6; k++) m[k] = 0;
    for (let k = 0; k < ins.len; k++) {
      if (relocs && relocs.has((ins.va + k) >>> 0)) for (let j = 0; j < 4 && k + j < ins.len; j++) m[k + j] = 0;
    }
    if (!relocs && ins.len >= 5) {
      for (let k = 1; k + 4 <= ins.len; k++) {
        const v = (ins.bytes[k] | (ins.bytes[k + 1] << 8) | (ins.bytes[k + 2] << 16) | (ins.bytes[k + 3] << 24)) >>> 0;
        if (v >= lo && v < hi) for (let j = 0; j < 4; j++) m[k + j] = 0;
      }
    }
    bytes.push(...ins.bytes); mask.push(...m);
    if (bytes.length <= prefixLen) prefixCut = bytes.length;
    // a RET/JMP-indirect ends a straight body only if nothing later is reached;
    // keep going (the body cap is the next function start), but note the end.
    if (/^ret/.test(ins.text) && bytes.length >= 8) ended = ended || bytes.length;
  }
  if (!prefixCut) prefixCut = Math.min(bytes.length, prefixLen);
  const anchor = bestAnchor(bytes, mask, prefixCut);
  return { name, tag, refVa: hex(va), len: bytes.length, prefix: prefixCut, firstRet: ended || null,
    hex: bytes.map((x, i) => mask[i] ? x.toString(16).padStart(2, '0') : '..').join(''), anchor };
}

// The longest fully unmasked run inside the prefix (indexOf needle).
function bestAnchor(bytes, mask, n) {
  let best = [0, 0], s = -1;
  for (let i = 0; i <= n; i++) {
    if (i < n && mask[i]) { if (s < 0) s = i; }
    else if (s >= 0) { if (i - s > best[1]) best = [s, i - s]; s = -1; }
  }
  return { off: best[0], len: Math.min(best[1], 16) };
}

function parseSig(s) {
  const n = s.hex.length / 2, bytes = new Uint8Array(n), mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const t = s.hex.slice(i * 2, i * 2 + 2);
    if (t !== '..') { bytes[i] = parseInt(t, 16); mask[i] = 1; }
  }
  return { ...s, bytes, mask, needle: Buffer.from(bytes.slice(s.anchor.off, s.anchor.off + s.anchor.len)) };
}

function cmpAt(buf, at, sig, n) {
  if (at < 0 || at + n > buf.length) return false;
  for (let i = 0; i < n; i++) if (sig.mask[i] && buf[at + i] !== sig.bytes[i]) return false;
  return true;
}

function extract() {
  const ref = flag('ref');
  const tag = flag('tag', path.basename(ref));
  const pe = readPE(ref);
  const relocs = relocSet(pe);
  const exps = exportsOf(pe);
  const prefixLen = parseInt(flag('prefix', '32'), 10);
  const bodyCap = parseInt(flag('body', '256'), 10);
  const wanted = [];
  const names = (flag('names', '') || '').split(',').filter(Boolean);
  if (has('all-exports')) for (const e of exps) wanted.push(e);
  for (const nm of names) {
    const e = exps.find(x => x.name === nm);
    if (e) wanted.push(e); else console.error(`warn: ${nm} not exported by ${ref}`);
  }
  for (const kv of flags('va')) {
    const i = kv.indexOf('=');
    wanted.push({ name: kv.slice(0, i), va: parseInt(kv.slice(i + 1), 16) >>> 0 });
  }
  // --find=name=HEX: seed a routine by a short hand-known opening (the first
  // occurrence in the reference's code sections); the signature itself is
  // then extracted from the reference's real bytes like any other.
  for (const kv of flags('find')) {
    const i = kv.indexOf('=');
    const needle = Buffer.from(kv.slice(i + 1), 'hex');
    let found = 0;
    for (const sec of pe.sections) {
      if (found || !sec.isCode) continue;
      const view = pe.buf.subarray(sec.rawOff, sec.rawOff + sec.rawSize);
      const at = view.indexOf(needle);
      if (at >= 0) found = (pe.imageBase + sec.rva + at) >>> 0;
    }
    if (found) wanted.push({ name: kv.slice(0, i), va: found });
    else console.error(`warn: --find ${kv.slice(0, i)} not in ${ref}`);
  }
  // known starts bound each body
  const starts = [...new Set([...exps.map(e => e.va), ...wanted.map(w => w.va)])].sort((a, b) => a - b);
  const out = has('append') && fs.existsSync(flag('out')) ? JSON.parse(fs.readFileSync(flag('out'), 'utf8')) : [];
  for (const w of wanted) {
    const next = starts.find(v => v > w.va);
    const limit = Math.max(8, Math.min(bodyCap, next ? next - w.va : bodyCap));
    const s = buildSig(pe, relocs, w.name, w.va, limit, prefixLen, tag);
    s.extent = Math.min(0x800, next ? next - w.va : 0x200);
    if (s.prefix < 8) { console.error(`skip ${w.name}: body ${s.len} bytes`); continue; }
    out.push(s);
  }
  fs.writeFileSync(flag('out'), JSON.stringify(out, null, 1));
  console.log(`${tag}: ${wanted.length} wanted, ${out.length} sigs total, relocs ${relocs ? relocs.size : 'none'}`);
}

const walkedDirs = new Set();
function* walk(dir) {
  let real;
  try { real = fs.realpathSync(dir); } catch (_) { return; }
  if (walkedDirs.has(real)) return;
  walkedDirs.add(real);
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    let st;
    try { st = fs.statSync(p); } catch (_) { continue; }
    if (st.isDirectory()) yield* walk(p);
    else if (/\.(exe|dll|ocx|scr|bpl|tlb|drv|acm|ax|ime|x32|vxd|cpl|so|dat|bin|ifs)$/i.test(e.name) && st.size > 8192) yield { p, size: st.size };
  }
}

function scan() {
  const sigs = JSON.parse(fs.readFileSync(flag('sigs'), 'utf8')).map(parseSig).filter(s => s.anchor.len >= 4);
  const maxBytes = parseFloat(flag('max-mb', '24')) * 1e6;
  const seen = new Map();
  const files = [];
  const strings = ['inflate 1.', 'deflate 1.', 'Jean-loup Gailly', 'Borland', 'Embarcadero', 'FastMM', 'Microsoft Visual C++ Runtime Library', 'MSVBVM60.DLL', 'MSVBVM50.DLL', 'SOFTWARE\\Borland\\Delphi'];
  for (const r of flags('root')) for (const f of walk(r)) {
    if (f.size > maxBytes) continue;
    let buf;
    try { buf = fs.readFileSync(f.p); } catch (_) { continue; }
    if (buf.readUInt16LE(0) !== 0x5a4d) continue;
    const sha = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12);
    if (seen.has(sha)) { seen.get(sha).paths.push(f.p); continue; }
    let pe;
    try { pe = readPE(buf); } catch (_) { continue; }
    const rec = { sha, paths: [f.p], size: f.size, imageBase: hex(pe.imageBase), hits: {}, strings: [] };
    seen.set(sha, rec);
    for (const s of strings) if (buf.indexOf(s, 0, 'latin1') >= 0) rec.strings.push(s);
    for (const sec of pe.sections) {
      if (!sec.isCode || !sec.rawSize) continue;
      const lo = sec.rawOff, hi = Math.min(buf.length, sec.rawOff + sec.rawSize);
      const view = buf.subarray(lo, hi);
      for (const sig of sigs) {
        let at = view.indexOf(sig.needle);
        while (at >= 0) {
          const start = at - sig.anchor.off;
          if (cmpAt(view, start, sig, sig.prefix)) {
            const full = cmpAt(view, start, sig, sig.len);
            const k = sig.tag + ':' + sig.name;
            const h = rec.hits[k] || (rec.hits[k] = { prefix: 0, full: 0, vas: [] });
            h.prefix++; if (full) h.full++;
            if (h.vas.length < 4) h.vas.push(hex(pe.imageBase + sec.rva + start) + (full ? '' : '~'));
          }
          at = view.indexOf(sig.needle, at + 1);
        }
      }
    }
    files.push(rec);
  }
  fs.writeFileSync(flag('out'), JSON.stringify(files, null, 1));
  // summary: per signature, distinct binaries with a prefix / full match
  const by = new Map();
  for (const f of files) for (const [k, h] of Object.entries(f.hits)) {
    const e = by.get(k) || { k, prefix: 0, full: 0 };
    e.prefix++; if (h.full) e.full++;
    by.set(k, e);
  }
  const rows = [...by.values()].sort((a, b) => b.prefix - a.prefix);
  console.log(`scanned ${files.length} distinct PE images`);
  for (const r of rows) console.log(`${String(r.prefix).padStart(5)} ${String(r.full).padStart(5)}  ${r.k}`);
}

// ---- weigh: charge hist blocks to signature matches ---------------------------
function weigh() {
  const sigs = JSON.parse(fs.readFileSync(flag('sigs'), 'utf8')).map(parseSig).filter(s => s.anchor.len >= 4);
  const hist = JSON.parse(fs.readFileSync(flag('hist'), 'utf8'));
  const exeBase = parseInt(flag('exe-base', '0x400000'), 16) >>> 0;
  const peMap = new Map(flags('pe').map(kv => { const i = kv.indexOf('='); return [kv.slice(0, i).toLowerCase(), kv.slice(i + 1)]; }));
  const mods = [];
  for (const [name, pair] of Object.entries(hist.mods || {})) {
    const nm = (name.includes('.') ? name : name + '.dll').replace(/^\//, '').toLowerCase();
    if (mods.find(m => m.base === pair[0])) continue;
    mods.push({ name: nm, base: pair[0] >>> 0, origBase: pair[1] >>> 0 });
  }
  if (!mods.find(m => m.base === exeBase)) mods.push({ name: 'exe', base: exeBase, origBase: exeBase });
  mods.sort((a, b) => a.base - b.base);
  // routine ranges per module: [start, end, label]
  const ranges = [];
  for (const m of mods) {
    const p = peMap.get(m.name) || (m.name === 'exe' ? peMap.get('exe') : null);
    if (!p) continue;
    const pe = readPE(p);
    m.pe = pe; m.size = sizeOfImage(pe);
    const exps = exportsOf(pe);
    if (exps.length && !has('no-exports') && m.base !== exeBase) {
      for (let i = 0; i < exps.length; i++) {
        const end = i + 1 < exps.length ? exps[i + 1].va : exps[i].va + 0x400;
        ranges.push({ mod: m.name, lo: exps[i].va, hi: Math.min(end, exps[i].va + 0x4000), label: `${m.name}!${exps[i].name}`, kind: 'export' });
      }
    }
    for (const sec of pe.sections) {
      if (!sec.isCode || !sec.rawSize) continue;
      const view = pe.buf.subarray(sec.rawOff, Math.min(pe.buf.length, sec.rawOff + sec.rawSize));
      for (const sig of sigs) {
        let at = view.indexOf(sig.needle);
        while (at >= 0) {
          const start = at - sig.anchor.off;
          if (cmpAt(view, start, sig, sig.prefix)) {
            const full = cmpAt(view, start, sig, sig.len);
            const va = (pe.imageBase + sec.rva + start) >>> 0;
            ranges.push({ mod: m.name, lo: va, hi: va + Math.max(sig.extent || sig.len, sig.len, 16), label: `${sig.tag}:${sig.name}${full ? '' : '~'}`, kind: full ? 'sig' : 'sig~', full });
          }
          at = view.indexOf(sig.needle, at + 1);
        }
      }
    }
  }
  const total = hist.blockHits || 1;
  const uopBlocks = (hist.uop && hist.uop.blocks) || 0;
  const charge = new Map(), unmatched = [];
  let matched = 0;
  for (const [h, hits] of hist.blocks || []) {
    const addr = parseInt(h, 16) >>> 0;
    let m = null;
    for (const x of mods) { if (addr >= x.base) m = x; else break; }
    if (!m) continue;
    const va = (addr - m.base + m.origBase) >>> 0;
    // a signature range beats an export range (more specific)
    // full matches first, then prefix-only; the nearest start wins
    const near = k => ranges.filter(r => r.kind === k && r.mod === m.name && va >= r.lo && va < r.hi).sort((a, b) => b.lo - a.lo)[0];
    let r = near('sig') || near('sig~');
    if (!r) r = ranges.find(r => r.kind === 'export' && r.mod === m.name && va >= r.lo && va < r.hi);
    if (r) { charge.set(r.label, (charge.get(r.label) || 0) + hits); matched += hits; }
    else unmatched.push({ mod: m.name, va: hex(va), hits });
  }
  const rows = [...charge.entries()].sort((a, b) => b[1] - a[1]);
  const top = parseInt(flag('top', '30'), 10);
  console.log(`${flag('hist')}\n  threaded block entries ${total}, uop blocks ${uopBlocks} (not attributable), listed blocks ${(hist.blocks || []).length}`);
  for (const [k, v] of rows.slice(0, top)) console.log(`  ${(100 * v / total).toFixed(2).padStart(6)}%  ${String(v).padStart(10)}  ${k}`);
  const byMod = new Map();
  for (const u of unmatched) byMod.set(u.mod, (byMod.get(u.mod) || 0) + u.hits);
  console.log('  unmatched by module: ' + [...byMod.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(100 * v / total).toFixed(1)}%`).join(', '));
  const nu = parseInt(flag('top-unmatched', '0'), 10);
  for (const u of unmatched.sort((a, b) => b.hits - a.hits).slice(0, nu)) console.log(`   ? ${(100 * u.hits / total).toFixed(2)}% ${u.mod} ${u.va}`);
  if (flag('json')) fs.writeFileSync(flag('json'), JSON.stringify({ hist: flag('hist'), total, uopBlocks, rows, unmatchedByMod: [...byMod.entries()] }, null, 1));
}

// ---- whole-body signatures (src/10-helpers-msvc-routines.wat) ---------------
// A native body stands in for EVERY byte of its guest body, so it is matched
// on all of them, not on a prefix: the first 16 bytes compared outright, then
// an FNV-1a over the body with the absolute in-body addresses left out (jump
// tables and `jmp [table+reg*4]` operands, which move with the load address),
// and each of those checked to equal entry + its reference offset. That holds
// at any load address and in any module, relocated or not.
const REGISTRY = path.join(ROOT, 'tools/known-routines.json');
const WAT = path.join(ROOT, 'src/10-helpers-msvc-routines.wat');
const fnv = (bytes, skip) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) if (!skip.has(i)) h = Math.imul(h ^ bytes[i], 0x01000193) >>> 0;
  return h >>> 0;
};
function peBytes(pe, va, len) {
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) { const o = pe.va2off(va + i); out[i] = o >= 0 ? pe.buf[o] : 0; }
  return out;
}
// Body signature at va: fixups are the dwords whose value is an address in
// [va, va+len) -- by .reloc when the PE has one, else by value.
function bodySig(pe, va, len) {
  const bytes = peBytes(pe, va, len);
  const relocs = relocSet(pe);
  const fix = [];
  for (let i = 0; i + 4 <= len; i++) {
    const v = (bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24)) >>> 0;
    const inBody = v >= va && v < va + len;
    if (relocs ? relocs.has((va + i) >>> 0) : inBody) {
      if (!inBody) throw new Error(`reloc at +0x${i.toString(16)} points outside the body (0x${v.toString(16)})`);
      fix.push([i, v - va]);
      i += 3;
    }
  }
  const skip = new Set();
  for (const [o] of fix) for (let k = 0; k < 4; k++) skip.add(o + k);
  const head = [0, 4, 8, 12].map(o => (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0);
  return { len, head, fix, fnv: fnv(bytes, skip), relocs: !!relocs };
}
// Does the body signature `s` match buf at file offset `off` (image VA `va`)?
function bodyMatchAt(buf, off, va, s) {
  if (off < 0 || off + s.len > buf.length) return false;
  for (let k = 0; k < 4; k++) if (buf.readUInt32LE(off + 4 * k) !== s.head[k]) return false;
  for (const [o, rel] of s.fix) if (buf.readUInt32LE(off + o) !== ((va + rel) >>> 0)) return false;
  const skip = new Set();
  for (const [o] of s.fix) for (let k = 0; k < 4; k++) skip.add(o + k);
  return fnv(buf.subarray(off, off + s.len), skip) === s.fnv;
}
function registry() {
  const reg = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
  for (const e of reg.entries) {
    const file = path.join(ROOT, e.ref.path);
    if (!fs.existsSync(file)) { e.missing = true; continue; }
    const pe = readPE(file);
    e.sig = bodySig(pe, parseInt(e.ref.va, 16) >>> 0, parseInt(e.len, 16));
    if (e.sig.fix.length !== e.fixups) throw new Error(`${e.name}: ${e.sig.fix.length} fixups, registry says ${e.fixups}`);
  }
  return reg;
}
// `body --pe=PATH --va=0xVA --len=0xN`: print one body signature.
function body() {
  const pe = readPE(flag('pe'));
  console.log(JSON.stringify(bodySig(pe, parseInt(flag('va'), 16) >>> 0, parseInt(flag('len'), 16))));
}
// `find --root=DIR [--root=DIR] [--json=OUT]`: every image holding a registry
// entry's whole body, at which VAs; distinct images by content hash.
function find() {
  const reg = registry();
  const sigs = reg.entries.filter(e => !e.missing);
  const seen = new Set();
  const per = new Map(sigs.map(e => [e.id, { id: e.id, name: e.name, variant: e.variant, images: 0, sites: 0, examples: [] }]));
  const out = [];
  for (const r of flags('root')) for (const f of walk(r)) {
    if (f.size > parseFloat(flag('max-mb', '40')) * 1e6) continue;
    let buf;
    try { buf = fs.readFileSync(f.p); } catch (_) { continue; }
    if (buf.length < 64 || buf.readUInt16LE(0) !== 0x5a4d) continue;
    const sha = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12);
    if (seen.has(sha)) continue;
    seen.add(sha);
    let pe;
    try { pe = readPE(buf); } catch (_) { continue; }
    const rec = { path: path.relative(ROOT, f.p), sha, hits: {} };
    for (const sec of pe.sections) {
      if (!sec.isCode || !sec.rawSize) continue;
      const lo = sec.rawOff, hi = Math.min(buf.length, sec.rawOff + sec.rawSize);
      for (const e of sigs) {
        const needle = Buffer.alloc(16);
        e.sig.head.forEach((v, k) => needle.writeUInt32LE(v, 4 * k));
        let at = buf.indexOf(needle, lo);
        while (at >= 0 && at < hi) {
          const va = (pe.imageBase + sec.rva + (at - lo)) >>> 0;
          if (bodyMatchAt(buf, at, va, e.sig)) (rec.hits[e.id] = rec.hits[e.id] || []).push(hex(va));
          at = buf.indexOf(needle, at + 1);
        }
      }
    }
    for (const [id, vas] of Object.entries(rec.hits)) {
      const p = per.get(+id); p.images++; p.sites += vas.length;
      if (p.examples.length < 6) p.examples.push(`${rec.path}@${vas.join(',')}`);
    }
    if (Object.keys(rec.hits).length) out.push(rec);
  }
  console.log(`scanned ${seen.size} distinct PE images`);
  for (const p of per.values()) console.log(`  id ${p.id} ${p.name} (${p.variant}): ${p.images} images, ${p.sites} sites`);
  if (flag('json')) fs.writeFileSync(flag('json'), JSON.stringify({ per: [...per.values()], images: out }, null, 1));
}
// `wat [--check]`: the signature functions between the GENERATED markers of
// src/10-helpers-msvc-routines.wat, from the registry's reference bodies.
function wat() {
  const reg = registry();
  const miss = reg.entries.filter(e => e.missing);
  if (miss.length) { console.error(`reference bodies absent: ${miss.map(e => e.ref.path).join(', ')}`); process.exit(3); }
  const h = v => '0x' + (v >>> 0).toString(16).padStart(8, '0');
  const L = [];
  L.push('  ;; GENERATED by `node tools/kr-sig.js wat` from tools/known-routines.json -- do not edit.');
  for (const e of reg.entries) L.push(`  ;;   ${e.id} ${e.name} (${e.variant}, ${e.impl}): ${e.ref.path}@${e.ref.va}, sha256 ${e.ref.sha256.slice(0, 16)}`);
  // head dword (the per-decode prefilter), body length, first-insn length
  for (const [fn, val] of [['kr_first', e => h(e.sig.head[0])], ['kr_len', e => '0x' + e.sig.len.toString(16)], ['kr_k', e => String(e.k)]]) {
    L.push(`  (func $${fn} (param $id i32) (result i32)`);
    for (const e of reg.entries) L.push(`    (if (i32.eq (local.get $id) (i32.const ${e.id})) (then (return (i32.const ${val(e)}))))`);
    L.push('    (i32.const 0))');
  }
  // the whole-body check: head, every absolute field, then the hash between them
  L.push('  (func $kr_sig (param $ga i32) (param $id i32) (result i32)');
  L.push('    (local $h i32)');
  for (const e of reg.entries) {
    const s = e.sig;
    L.push(`    (if (i32.eq (local.get $id) (i32.const ${e.id}))`);
    L.push('      (then');
    for (let k = 0; k < 4; k++)
      L.push(`        (if (i32.ne (call $gl32 (i32.add (local.get $ga) (i32.const ${4 * k}))) (i32.const ${h(s.head[k])})) (then (return (i32.const 0))))`);
    for (const [o, r] of s.fix)
      L.push(`        (if (i32.ne (call $gl32 (i32.add (local.get $ga) (i32.const 0x${o.toString(16)}))) (i32.add (local.get $ga) (i32.const 0x${r.toString(16)}))) (then (return (i32.const 0))))`);
    L.push('        (local.set $h (i32.const 0x811c9dc5))');
    let at = 0;
    for (const [o] of [...s.fix, [s.len]]) {
      if (o > at) L.push(`        (local.set $h (call $kr_fnv_span (local.get $h) (local.get $ga) (i32.const 0x${at.toString(16)}) (i32.const 0x${o.toString(16)})))`);
      at = o + 4;
    }
    L.push(`        (return (i32.eq (local.get $h) (i32.const ${h(s.fnv)})))))`);
  }
  L.push('    (i32.const 0))');
  L.push(`  (global $KR_MAX_ID i32 (i32.const ${Math.max(...reg.entries.map(e => e.id))}))`);
  const gen = L.join('\n') + '\n';
  const src = fs.readFileSync(WAT, 'utf8');
  const a = src.indexOf(';; BEGIN kr-sig generated\n'), b = src.indexOf('  ;; END kr-sig generated');
  if (a < 0 || b < 0) throw new Error('markers missing in ' + WAT);
  const cur = src.slice(a + ';; BEGIN kr-sig generated\n'.length, b);
  if (has('check')) {
    if (cur !== gen) { console.error('kr-sig wat: src/10-helpers-msvc-routines.wat signature block is stale; run node tools/kr-sig.js wat'); process.exit(1); }
    console.log('kr-sig wat: signature block fresh');
    return;
  }
  fs.writeFileSync(WAT, src.slice(0, a + ';; BEGIN kr-sig generated\n'.length) + gen + src.slice(b));
  console.log(`kr-sig wat: wrote ${reg.entries.length} signatures`);
}

if (cmd === 'extract') extract();
else if (cmd === 'scan') scan();
else if (cmd === 'weigh') weigh();
else if (cmd === 'body') body();
else if (cmd === 'find') find();
else if (cmd === 'wat') wat();
else { console.error('usage: kr-sig.js extract|scan|weigh|body|find|wat ...'); process.exit(2); }
