#!/usr/bin/env node
// delphi-detect.js -- flag Delphi / Borland Pascal (and Free Pascal) PE32
// binaries, guess the compiler/RTL generation, and check them for the
// System-unit helper bodies that fold-bench arm D runs natively.
//
// Usage:
//   node tools/delphi-detect.js [--json] [--all] [--any-ext] [--apps]
//                               [--max-mb=N] PATH...
//
//   PATH      files or directories (directories are walked recursively;
//             symlinks are followed once, cycles are skipped).
//   --all     also print PEs that are not Pascal (default: Pascal only).
//   --any-ext look at every file with an MZ header, not just
//             .exe/.dll/.bpl/.dpl/.scr/.ocx/.cpl/.drv/.ax/.bin/.dat names.
//   --apps    say whether lib/apps.js names the file (by repo path or by
//             basename -- a basename hit is reported as "name?").
//   --json    one JSON object per line instead of the table.
//   --max-mb  cap on section bytes read per file (default 64).
//
// The file is read, never executed. Evidence collected per PE:
//   sections  CODE/DATA/BSS (Borland linker up to 2007), .itext (2009+)
//   strings   Borland / CodeGear / Embarcadero, the RTL's locale registry
//             key (which names the RTL generation), length-prefixed RTTI
//             names (TObject, TApplication, Boolean, UnicodeString),
//             FastMM, @System@ / System.pas, "FPC x.y.z", Game Maker.
//   header    TimeDateStamp 0x2A425E19 (the fixed stamp the Borland linker
//             wrote through Delphi 2006), linker version, packer sections.
//   overlay   Game Maker data magic 1234321 (0x0012D591) in the first 1 MB
//             after the last section; Inno Setup's "rDlPtS" / "zlb\x1a".
//   arm D     the bodies -- 1 _LStrClr 2 _LStrAsg 3 _FinalizeRecord
//             4 _FinalizeArray 5 _CopyRecord 6 _InitializeRecord
//             7 _InitializeArray -- identified exactly as
//             src/10-helpers-delphi-fold.wat ($dfold_at / $d_check) does:
//             the first dword, then FNV-1a over the body with every
//             E8/E9 rel32 left out, then the callees the native form
//             stands in for (3 -> 4 -> 1, 4 -> 1, 5 -> 2, 6 <-> 7). Plus
//             which System.Move the program links ("move="): the FILD/FISTP
//             form with its jump table (id 8) or the REP MOVSD form (id 9),
//             both folded and both what _CopyRecord's leading Move assumes.
//   GM fold   "gm=": the Game Maker runner bodies the same handler folds
//             (varscan, inst2w, inst2b, inst1 with their DynArray-length
//             callee; lineloop / pointloop, the collision_line/_point scan
//             over one object's instances, with their reads and bbox tests;
//             eventpass, the GM8 collision-event pass over the pair list,
//             with its reads and instance-pair box test; "records" =
//             _FinalizeArray whose record loop calls the
//             System _FinalizeRecord back-to-back), with a count each.
//             "exact" = body and callees match (D would fire); "body" =
//             body matches, a callee does not (D falls back); "variantNN" =
//             no exact body, but some body is NN% byte-equal (rel32s left
//             out) to the reference at the same offsets (another RTL build;
//             D does not fire); "-" = nothing within 60%.
//
// The version is a GUESS from those fingerprints; treat it as a bucket:
//   loc:Borland\Delphi (Software\Borland\Delphi\Locales) -> Delphi 3-5,
//   loc:Borland (Software\Borland\Locales)    -> Delphi 6-7, or 2005-2007
//                                                 with an .itext section,
//   loc:CodeGear -> 2007/2009, loc:Embarcadero -> 2010/XE+, RTTI
//   UnicodeString -> 2009+. Only the 0x2A425E19 stamp + CODE/DATA -> 2-7.
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const flag = n => args.includes('--' + n);
const opt = (n, d) => { const a = args.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const JSON_OUT = flag('json'), ALL = flag('all'), ANY_EXT = flag('any-ext'), APPS = flag('apps');
const MAX_BYTES = Number(opt('max-mb', 64)) * 1024 * 1024;
const roots = args.filter(a => !a.startsWith('--'));
if (!roots.length) {
  console.error('usage: node tools/delphi-detect.js [--json] [--all] [--any-ext] [--apps] [--max-mb=N] PATH...');
  process.exit(2);
}
const EXTS = new Set(['.exe', '.dll', '.bpl', '.dpl', '.scr', '.ocx', '.cpl', '.drv', '.ax', '.bin', '.dat', '.icd', '.tmp']);

// ---- arm D signatures (mirror of fold-bench src/10-helpers.wat) ----------
const D = {
  1: { name: 'LStrClr', first: 0xd285108b, len: 0x23, fnv: 0xcacb444e, masks: [0x1D] },
  2: { name: 'LStrAsg', first: 0x2474d285, len: 0x43, fnv: 0xa1749f54, masks: [0x10, 0x1C, 0x3E] },
  3: { name: 'FinalizeRecord', first: 0x8a53c931, len: 0x31, fnv: 0xfa8250b0, masks: [0x21] },
  4: { name: 'FinalizeArray', first: 0x0f00f983, len: 0xEA, fnv: 0xe8843657,
       masks: [0x3F, 0x4B, 0x50, 0x57, 0x5C, 0x68, 0x71, 0x7D, 0x9A, 0xB0, 0xC0, 0xD1, 0xE1] },
  5: { name: 'CopyRecord', first: 0x55575653, len: 0x11A, fnv: 0xbfece31d,
       masks: [0x28, 0x67, 0x71, 0x82, 0x93, 0xB7, 0xD0, 0xDD, 0xF0, 0x111] },
  6: { name: 'InitializeRecord', first: 0x8a53c931, len: 0x2F, fnv: 0x9323153d, masks: [0x21] },
  7: { name: 'InitializeArray', first: 0x840fc985, len: 0x93, fnv: 0x5b56943e, masks: [0x3C, 0x71, 0x87] },
};
// System.Move: 8 FILD/FISTP (its jump-table address +0x11 and table
// +0x38..+0x5C are absolute, left out and checked against the entry),
// 9 REP MOVSD (Game Maker 5/7 runners).
const M = {
  8: { name: 'FILD', first: 0x3174d039, len: 0xFD, fnv: 0xfdefbda4, masks: [0x11], range: [0x38, 0x5C] },
  9: { name: 'REP', first: 0xc6895756, len: 0x40, fnv: 0xfa2e0fd2, masks: [] },
};
const MOVE_TABLE = [0x35, 0xB6, 0xBC, 0xC3, 0xD0, 0xD5, 0xE0, 0xED, 0xF8];
// The GM fold ($gm_fold): Game Maker runner routines, identical in the GM5,
// GM7 and GM8 runners. 10 the variable-list backward scan loop, 11/12 the
// 2-D instance-table reads (disp32 / disp8 fields), 13 the 1-D one, each
// calling 14 DynArray length (+0x17/+0x14/+0x11, checked). Plus whether
// _FinalizeArray's record loop (+0xB0) calls the System unit's
// _FinalizeRecord, which calls it back (+0x21): the record-array fold.
const G = {
  10: { name: 'varscan', first: 0x8bb61c8d, len: 0x15, fnv: 0x988ad2c0, masks: [] },
  11: { name: 'inst2w', first: 0x55575653, len: 0x41, fnv: 0xeab1a823, masks: [0x17], callee: 0x17 },
  12: { name: 'inst2b', first: 0x55575653, len: 0x38, fnv: 0xa935754b, masks: [0x14], callee: 0x14 },
  13: { name: 'inst1', first: 0x8b575653, len: 0x25, fnv: 0x67490794, masks: [0x11], callee: 0x11 },
  14: { name: 'dynlen', first: 0x0374c085, len: 0x08, fnv: 0x567cdfc7, masks: [] },
  // collision_line / collision_point over one object's instances: the scan
  // loop at its head (`cmp byte [ebp+8],0`), whose three instance reads are
  // id 11 and whose test is 17 / 18 (A1 absolutes: the instance table global,
  // all four equal), and the bbox tests (matched as callees only).
  15: { name: 'lineloop', first: 0x00087d80, len: 0x89, fnv: 0x9b2b3507, masks: [0x12, 0x27, 0x58, 0x61, 0x75, 0x7d, 0x7, 0x1c, 0x4d, 0x6a],
        reads: [0x12, 0x27, 0x58], test: [0x61, 17], abs: [0x7, 0x1c, 0x4d, 0x6a] },
  16: { name: 'pointloop', first: 0x00087d80, len: 0x79, fnv: 0xb8c87edf, masks: [0x12, 0x27, 0x4c, 0x55, 0x69, 0x71, 0x7, 0x1c, 0x41, 0x5e],
        reads: [0x12, 0x27, 0x4c], test: [0x55, 18], abs: [0x7, 0x1c, 0x41, 0x5e] },
  17: { name: 'linetest', first: 0x83ec8b55, len: 0x2b3, fnv: 0x2c975ca7, masks: [0x227, 0x230, 0x244, 0x24d, 0x268, 0x271, 0x27a, 0x283, 0x293, 0x2a2] },
  18: { name: 'pointtest', first: 0x51ec8b55, len: 0xfe, fnv: 0xeea92a4b, masks: [0x85, 0x8e, 0xa2, 0xab, 0xc6, 0xcf, 0xdf, 0xee] },
  // the GM8 collision-event pass (the fold's heads 19/20/21 at +0x24 / +0x6E
  // / +0xAE): its 1-D reads (+0x55 +0x9C) one id 13, its 2-D reads (+0x7D
  // +0xCF) one id 12, its instance-pair box test (+0xDC) id 22, the pair
  // list global at +0x25 = +0x37 and the instance table's at +0x4A = +0x6F =
  // +0x91 = +0xC2 (A1 absolutes)
  22: { name: 'pairtest', first: 0x55575653, len: 0x16b, fnv: 0x16e41878, masks: [0x93, 0x9c, 0xbf, 0xc8, 0xe4, 0xed, 0x110, 0x120, 0x129, 0x14b, 0x15a] },
  23: { name: 'eventpass', first: 0x55575653, len: 0x268, fnv: 0x71836914,
        masks: [0x55, 0x7d, 0x9c, 0xcf, 0xdc, 0x109, 0x11c, 0x12f, 0x142, 0x157, 0x16c, 0x189, 0x190, 0x1b7, 0x1de, 0x1e9,
                0x200, 0x213, 0x226, 0x239, 0x8, 0x25, 0x37, 0x4a, 0x6f, 0x91, 0xc2] },
};
// The reference bodies those hashes were taken from (Spelunky Classic 1.1,
// Game Maker 8 runner, at 0x405934 / 0x405988 / 0x4064e8 / 0x406534 /
// 0x40674c), used only to rate a non-matching body by its byte similarity.
const REF_HEX = {
  1: '8b1085d2741cc700000000008b4af8497c10f0ff4af8750a508d42f8e85fd4ffff58c3',
  2: '85d274248b4af8417f1a50528b42fce85c00000089c258528b48fce800d7ffff5a58eb04f0ff42f8871085d274148b4af8497c0ef0ff4af875088d42f8e8ead3ffffc3',
  3: '31c9538a4a01565789c38d74110a8b7c11068b168b460401d88b12b901000000e82700000083c6084f7fe789d85f5e5bc3',
  4: '83f9000f84e00000005053565789c389d689cf31d28a068a56013c0a74253c0b743e3c0c74513c0d745c3c0e74763c0f0f84840000003c110f848b000000e99700000083f90189d87f0ae8b1f3ffffe99100000089cae8c9f3ffffe98500000083f90189d87f07e8c8fbffffeb7789cae8d7fbffffeb6e89d883c310e867ffffff4f7ff3eb5f5589d58b542e0a89d8035c2e028b4c2e068b12e862ffffff4f7fe85deb415589d589d8035c2e0289f2e800ffffff4f7ff05deb2b89d883c304e8181000004f7ff3eb1c89d889f283c304e8230900004f7ff1eb0b5f5e5b58b002e9cfc8ffff5f5e5b58c3',
  5: '5356575589c389d631c08a41018d7c080a8b6ffc31c08b4ff8518b4f0429c17e0b89c201f001dae830c9ffff8b47048b178b128a0a80f90a743180f90b743d80f90c744980f90d745580f90e747080f90f0f848000000080f9110f8488000000b0025d5f5e5be931c7ffff8b143001d8e8c7f1ffffb804000000eb7d8b143001d8e8d2f9ffffb804000000eb6c8d143001d8e851ffffffb810000000eb5b31c98a4a01ff741102ff7411068b4c110a8b098d143001d8e86100000058eb3b31c98a4a018b4c11025189d18d143001d8e82cffffff58eb228b143001d8e8fb0d0000b804000000eb1189d18b143001d8e828070000b80400000003470483c7084d0f8514ffffff5929c17e0a8d141801f0e847c8ffff5d5f5e5bc3',
  6: '31c9538a4a01565789c38d74110a8b7c11068b168b460401d88b12b901000000e80b00000083c6084f7fe75f5e5bc3',
  7: '85c90f848a00000053565789c389d689cf31d28a068a560131c93c0a74223c0b741e3c0c74243c0d74333c0e744d3c0f740e3c11740ab0025f5e5be960caffff890b83c3044f7ff8eb45890b894b04894b08894b0c83c3104f7fefeb325589d58b542e0a89d8035c2e028b4c2e068b12e88bffffff4f7fe85deb145589d589d8035c2e0289f2e845ffffff4f7ff05d5f5e5bc3',
};
const REF = {};
for (const id in REF_HEX) {
  REF[id] = Buffer.from(REF_HEX[id], 'hex');
  if (REF[id].length !== D[id].len) throw new Error(`reference body ${id} is ${REF[id].length} bytes, want ${D[id].len}`);
}
const VARIANT_MIN = 0.6; // fraction of unmasked bytes equal at the same offset

// image: { base, secs: [{rva, vsize, buf}] } -- reads by RVA
function rd8(img, rva) { for (const s of img.secs) { const o = rva - s.rva; if (o >= 0 && o < s.buf.length) return s.buf[o]; } return -1; }
function rd32(img, rva) {
  for (const s of img.secs) { const o = rva - s.rva; if (o >= 0 && o + 4 <= s.buf.length) return s.buf.readUInt32LE(o); }
  return -1;
}
const T = id => D[id] || M[id] || G[id];
function masked(id, o) {
  const t = T(id);
  return t.masks.some(m => o - m >= 0 && o - m < 4) || (t.range && o >= t.range[0] && o < t.range[1]);
}
function bodyHash(img, rva, id) {
  let h = 0x811c9dc5;
  for (let i = 0; i < T(id).len; i++) {
    if (masked(id, i)) continue;
    const b = rd8(img, rva + i); if (b < 0) return -1;
    h = Math.imul(h ^ b, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
function sig(img, rva, id) { return rd32(img, rva) === T(id).first && bodyHash(img, rva, id) === T(id).fnv; }
function rel(img, rva, o) { const v = rd32(img, rva + o); return v < 0 ? -1 : (rva + o + 4 + (v | 0)) >>> 0; }
function calleesOk(img, rva, id) {
  if (id === 3) { const fa = rel(img, rva, 0x21); return sig(img, fa, 4) && sig(img, rel(img, fa, 0x4B), 1); }
  if (id === 4) return sig(img, rel(img, rva, 0x4B), 1);
  if (id === 5) return sig(img, rel(img, rva, 0x71), 2);
  if (id === 6) return iaPair(img, rel(img, rva, 0x21), rva);
  if (id === 7) { const ir = rel(img, rva, 0x87); return sig(img, ir, 6) && iaPair(img, rva, ir); }
  return true;
}
function iaPair(img, ia, ir) {
  return sig(img, ia, 7) && rel(img, ia, 0x71) === ia && rel(img, ia, 0x87) === ir && rel(img, ir, 0x21) === ia;
}
// which System.Move form starts at rva: 'FILD', 'REP' or null
function moveForm(img, rva) {
  const va = img.base + rva;   // the two absolute fields hold VAs
  if (sig(img, rva, 8) && rd32(img, rva + 0x11) === ((va + 0x58) >>> 0)
      && MOVE_TABLE.every((o, i) => rd32(img, rva + 0x38 + 4 * i) === ((va + o) >>> 0))) return 'FILD';
  return sig(img, rva, 9) ? 'REP' : null;
}
// Similarity of the bytes at b[o..] to reference body id (masked bytes
// skipped); returns 0 as soon as the threshold can no longer be reached.
function similarity(b, o, id) {
  const ref = REF[id], n = D[id].len;
  if (o + n > b.length) return 0;
  let total = 0; for (let i = 0; i < n; i++) if (!masked(id, i)) total++;
  const allowed = Math.floor(total * (1 - VARIANT_MIN));
  let miss = 0;
  for (let i = 0; i < n; i++) {
    if (masked(id, i)) continue;
    if (b[o + i] !== ref[i] && ++miss > allowed) return 0;
  }
  return (total - miss) / total;
}
// GM fold bodies: VAs (as RVAs) of each exact match
// a collision scan loop's callees: id 11 (with its DynArray length) at each
// read, its bbox test, and one instance-table global in every A1 field
function gmLoopOk(img, rva, g) {
  for (const o of g.reads) { const r = rel(img, rva, o); if (!sig(img, r, 11) || !sig(img, rel(img, r, 0x17), 14)) return false; }
  if (!sig(img, rel(img, rva, g.test[0]), g.test[1])) return false;
  return g.abs.every((o) => rd32(img, rva + o) === rd32(img, rva + g.abs[0]));
}
function cevOk(img, rva) {
  const r1 = rel(img, rva, 0x55), r2 = rel(img, rva, 0x7D);
  if (rel(img, rva, 0x9C) !== r1 || !sig(img, r1, 13) || !sig(img, rel(img, r1, 0x11), 14)) return false;
  if (rel(img, rva, 0xCF) !== r2 || !sig(img, r2, 12) || !sig(img, rel(img, r2, 0x14), 14)) return false;
  if (!sig(img, rel(img, rva, 0xDC), 22)) return false;
  if (rd32(img, rva + 0x25) !== rd32(img, rva + 0x37)) return false;
  return [0x6F, 0x91, 0xC2].every((o) => rd32(img, rva + o) === rd32(img, rva + 0x4A));
}
function scanG(img, faRVAs) {
  const out = {};
  for (const id of [10, 11, 12, 13, 15, 16, 23]) out[G[id].name] = [];
  for (const s of img.secs) {
    if (!s.exec) continue;
    for (let o = 0; o + 4 <= s.buf.length; o++) {
      const w = s.buf.readUInt32LE(o);
      for (const id of [10, 11, 12, 13, 15, 16, 23]) {
        if (w !== G[id].first || bodyHash(img, s.rva + o, id) !== G[id].fnv) continue;
        if (id === 23 && !cevOk(img, s.rva + o)) continue;
        if (G[id].callee && !sig(img, rel(img, s.rva + o, G[id].callee), 14)) continue;
        if (G[id].reads && !gmLoopOk(img, s.rva + o, G[id])) continue;
        out[G[id].name].push(s.rva + o);
      }
    }
  }
  out.records = faRVAs.filter((fa) => { const fr = rel(img, fa, 0xB0); return sig(img, fr, 3) && rel(img, fr, 0x21) === fa; });
  return out;
}
function scanD(img) {
  const out = {};
  for (const id of Object.keys(D).map(Number)) out[id] = { exact: 0, body: 0, variant: 0, best: 0, at: [] };
  const ids = Object.keys(D).map(Number);
  const moves = { FILD: 0, REP: 0 };
  for (const s of img.secs) {
    if (!s.exec) continue;
    const b = s.buf;
    for (let o = 0; o + 4 <= b.length; o++) {
      const w = b.readUInt32LE(o);
      if (w === M[8].first || w === M[9].first) { const m = moveForm(img, s.rva + o); if (m) moves[m]++; }
      for (const id of ids) {
        const r = out[id];
        if (w === D[id].first && bodyHash(img, s.rva + o, id) === D[id].fnv) {
          if (calleesOk(img, s.rva + o, id)) { r.exact++; r.at.push(s.rva + o); } else r.body++;
          continue;
        }
        // cheap filter: the first two bytes of the reference
        if (b[o] !== REF[id][0] || b[o + 1] !== REF[id][1]) continue;
        const sim = similarity(b, o, id);
        if (sim) { r.variant++; if (sim > r.best) r.best = sim; }
      }
    }
  }
  return { ids: out, moveForm: moves };
}

// ---- PE reading (bounded) ------------------------------------------------
function readAt(fd, pos, len) { const b = Buffer.alloc(len); const n = fs.readSync(fd, b, 0, len, pos); return b.subarray(0, n); }
function parsePE(file) {
  const st = fs.statSync(file);
  if (st.size < 0x200) return null;
  const fd = fs.openSync(file, 'r');
  try {
    const hdr = readAt(fd, 0, 0x1000);
    if (hdr.length < 0x40 || hdr[0] !== 0x4D || hdr[1] !== 0x5A) return null;
    const pe = hdr.readUInt32LE(0x3C);
    if (pe + 0x18 > hdr.length || hdr.readUInt32LE(pe) !== 0x4550) return { notPE: true };
    const machine = hdr.readUInt16LE(pe + 4), nsec = hdr.readUInt16LE(pe + 6);
    const stamp = hdr.readUInt32LE(pe + 8), optSize = hdr.readUInt16LE(pe + 20), chars = hdr.readUInt16LE(pe + 22);
    const opt = pe + 24, magic = hdr.readUInt16LE(opt);
    const linker = `${hdr[opt + 2]}.${hdr[opt + 3]}`;
    const imageBase = magic === 0x10b ? hdr.readUInt32LE(opt + 28) : 0;
    const entry = hdr.readUInt32LE(opt + 16);
    let so = opt + optSize; const secs = []; let rawEnd = 0, total = 0;
    for (let i = 0; i < nsec && so + 40 <= hdr.length; i++, so += 40) {
      const name = hdr.toString('latin1', so, so + 8).replace(/\0.*$/s, '');
      const vsize = hdr.readUInt32LE(so + 8), rva = hdr.readUInt32LE(so + 12);
      const rawSize = hdr.readUInt32LE(so + 16), rawPtr = hdr.readUInt32LE(so + 20), sc = hdr.readUInt32LE(so + 36);
      rawEnd = Math.max(rawEnd, rawPtr + rawSize);
      const want = Math.min(rawSize, Math.max(0, MAX_BYTES - total));
      const buf = rawPtr && want ? readAt(fd, rawPtr, want) : Buffer.alloc(0);
      total += buf.length;
      secs.push({ name, rva, vsize, rawSize, buf, exec: (sc & 0x20000020) !== 0 });
    }
    const overlay = st.size > rawEnd + 16 ? readAt(fd, rawEnd, Math.min(1 << 20, st.size - rawEnd)) : Buffer.alloc(0);
    return { machine, magic, stamp, linker, imageBase, entry, chars, secs, overlay, size: st.size, overlaySize: Math.max(0, st.size - rawEnd) };
  } finally { fs.closeSync(fd); }
}

const has = (bufs, s) => bufs.some(b => b.indexOf(s) >= 0);
const lp = s => Buffer.concat([Buffer.from([s.length]), Buffer.from(s, 'latin1')]);
const u16 = s => Buffer.from(s, 'utf16le');
function verInfo(bufs, key) {
  const k = u16(key + '\0');
  for (const b of bufs) {
    const i = b.indexOf(k); if (i < 0) continue;
    let j = (i + k.length + 3) & ~3; // the value is dword aligned (sections start aligned)
    let s = ''; for (; j + 1 < b.length; j += 2) { const c = b.readUInt16LE(j); if (!c) break; s += String.fromCharCode(c); if (s.length > 80) break; }
    if (s && /^[\x20-\x7e\u00a0-\u00ff]+$/.test(s)) return s.trim();
  }
  return null;
}

function analyse(file) {
  const p = parsePE(file);
  if (!p || p.notPE) return null;
  const r = { path: file, size: p.size, pe32: p.magic === 0x10b && p.machine === 0x14c, linker: p.linker,
    stamp: '0x' + p.stamp.toString(16).padStart(8, '0') };
  const names = p.secs.map(s => s.name);
  r.sections = names.join(',');
  const bufs = p.secs.map(s => s.buf).concat([p.overlay.subarray(0, 0x10000)]);
  const ev = [];
  const E = (cond, tag) => { if (cond) ev.push(tag); return !!cond; };
  const borlandSecs = E(names.includes('CODE') && names.includes('DATA'), 'CODE/DATA');
  E(names.includes('BSS'), 'BSS');
  const itext = E(names.includes('.itext'), '.itext');
  const borlandStamp = E(p.stamp === 0x2A425E19, 'stamp-2A425E19');
  const packer = names.find(n => /^(UPX\d|\.aspack|\.adata|ASPack|PEC2|\.petite|\.MPRESS\d|\.nsp\d|PECompact|\.themida|\.vmp\d|\.enigma\d|kkrunchy)$/i.test(n)) || null;
  if (packer) ev.push('packed:' + packer);
  const tobj = E(has(bufs, lp('TObject')), 'RTTI:TObject');
  E(has(bufs, lp('TApplication')), 'RTTI:TApplication');
  E(has(bufs, lp('Boolean')), 'RTTI:Boolean');
  const ustr = E(has(bufs, lp('UnicodeString')), 'RTTI:UnicodeString');
  const borland = E(has(bufs, Buffer.from('Borland')), 'Borland');
  const codegear = E(has(bufs, Buffer.from('CodeGear')), 'CodeGear');
  const embt = E(has(bufs, Buffer.from('Embarcadero')), 'Embarcadero');
  const fastmm = E(has(bufs, Buffer.from('FastMM')), 'FastMM');
  const cbuilder = E(has(bufs, Buffer.from('@System@')), '@System@') && !names.includes('CODE') && !names.includes('.itext') && !/\\.bpl$/i.test(file);
  E(has(bufs, Buffer.from('System.pas')) || has(bufs, Buffer.from('SYSTEM.PAS')), 'System.pas');
  E(has(bufs, u16('DVCLAL')), 'DVCLAL');
  E(has(bufs, u16('PACKAGEINFO')), 'PACKAGEINFO');
  const locD = E(has(bufs, Buffer.from('Software\\Borland\\Delphi\\Locales')), 'loc:Borland\\Delphi');
  const locB = E(has(bufs, Buffer.from('Software\\Borland\\Locales')), 'loc:Borland');
  const locC = E(has(bufs, Buffer.from('Software\\CodeGear\\Locales')), 'loc:CodeGear');
  const locE = E(has(bufs, Buffer.from('Software\\Embarcadero\\Locales')), 'loc:Embarcadero');
  const rtl = E(has(bufs, Buffer.from('SOFTWARE\\Borland\\Delphi\\RTL')), 'Delphi\\RTL');
  let fpc = null;
  for (const b of bufs) { const m = /FPC (\d+\.\d+\.\d+) \[(\d{4}\/\d\d\/\d\d)\]/.exec(b.toString('latin1')); if (m) { fpc = m[1] + ' ' + m[2]; break; } }
  if (fpc) ev.push('FPC ' + fpc);
  const lcl = E(has(bufs, Buffer.from('TCustomForm')) && !!fpc, 'LCL');
  const gmStr = has(bufs, Buffer.from('Game Maker')) || has(bufs, Buffer.from('GameMaker')) || has(bufs, u16('Game Maker'));
  let gmMagic = false;
  { const m = Buffer.from([0x91, 0xD5, 0x12, 0x00]); gmMagic = p.overlay.indexOf(m) >= 0 || bufs.slice(0, -1).some(b => b.indexOf(m) >= 0 && gmStr); }
  E(gmStr, 'GameMaker-str'); E(gmMagic, 'GM-magic-1234321');
  const inno = E(has(bufs, Buffer.from('Inno Setup')) || p.overlay.indexOf(Buffer.from('rDlPtS')) >= 0, 'InnoSetup');
  r.product = verInfo(bufs, 'ProductName'); r.fileVersion = verInfo(bufs, 'FileVersion');
  r.company = verInfo(bufs, 'CompanyName');

  // verdict
  const pascal = !!fpc || (tobj && (borlandSecs || borland || codegear || embt || itext || borlandStamp)) || (borlandSecs && borlandStamp);
  r.pascal = pascal;
  if (gmStr || gmMagic) r.gameMaker = true;
  if (inno) r.inno = true;
  r.packer = packer; r.evidence = ev;
  if (pascal || ALL) {
    const img = { base: p.imageBase, secs: p.secs.map(s => ({ rva: s.rva, buf: s.buf, exec: s.exec })) };
    const d = scanD(img);
    r.armD = {};
    for (const id in d.ids) {
      const x = d.ids[id];
      r.armD[D[id].name] = x.exact ? 'exact' : x.body ? 'body' : x.variant ? `variant${Math.round(x.best * 100)}` : '-';
    }
    r.armDExactRVAs = Object.fromEntries(Object.entries(d.ids).filter(([, x]) => x.exact).map(([id, x]) => [D[id].name, x.at.map(a => '0x' + (a + p.imageBase).toString(16))]));
    r.moveForm = Object.entries(d.moveForm).filter(([, n]) => n).map(([k, n]) => `${k}x${n}`).join('+') || '-';
    const g = scanG(img, d.ids[4].at);
    r.gmFoldRVAs = Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.map(a => '0x' + (a + p.imageBase).toString(16))]));
    r.gmFold = Object.entries(g).filter(([, v]) => v.length).map(([k, v]) => `${k}x${v.length}`).join('+') || '-';
    const v = Object.values(r.armD), nd = v.length;
    r.armDSummary = v.every(x => x === 'exact') ? `exact(${nd}/${nd})` : v.some(x => x === 'exact') ? `partial(${v.filter(x => x === 'exact').length}/${nd})`
      : v.some(x => x !== '-') ? 'variant' : 'none';
  }
  let ver = null;
  if (fpc) ver = (lcl ? 'Lazarus/FPC ' : 'FPC ') + fpc.split(' ')[0];
  else if (pascal) {
    // System-unit bodies first: they name the RTL that is actually linked
    // (calibrated on rtl60/rtl70.bpl, vcl50.bpl, the GM7/GM8 runners and
    // Inno Setup 5.5 Unicode); the locale keys only bound it.
    const a = Object.fromEntries(Object.entries(r.armD || {}).filter(([k]) => [1, 2, 3, 4, 5].some(id => D[id].name === k)));
    const all5 = Object.values(a).every(x => x === 'exact');
    if (locE) ver = 'Delphi 2010/XE+';
    else if (locC) ver = ustr ? 'Delphi 2009' : 'Delphi 2007/2009';
    else if (ustr || (itext && /^variant9/.test(a.LStrClr || ''))) ver = 'Delphi 2009+ (UnicodeString RTL)';
    else if (all5) ver = itext ? 'Delphi 2005-2007' : 'Delphi 6-7';
    // a helper the program never links is '-': exact-or-absent still says 6-7
    else if (Object.values(a).every(x => x === 'exact' || x === '-') && a.LStrClr === 'exact')
      ver = itext ? 'Delphi 2005-2007' : 'Delphi 6-7';
    else if (a.LStrClr === 'exact' && a.LStrAsg === 'exact') ver = 'Delphi 5';
    else if (locB && locD) ver = 'Delphi 5-7';
    else if (locB) ver = itext ? 'Delphi 2005-2007?' : 'Delphi 6-2006?';
    else if (locD) ver = 'Delphi 3-4';
    else if (rtl) ver = 'Delphi 2-4';
    else if (borlandSecs && borlandStamp) ver = 'Delphi 2-4?';
    else ver = 'Pascal (unknown)';
    if (cbuilder) ver += ' (C++Builder)';
    if (embt && !locE) ver += ' [Embarcadero str]';
    if (fastmm) ver += ' +FastMM';
  }
  r.version = ver;
  return r;
}

let appsText = null;
function appsHit(file) {
  if (appsText === null) { try { appsText = fs.readFileSync(path.join(__dirname, '..', 'lib', 'apps.js'), 'utf8'); } catch { appsText = ''; } }
  const rel = path.relative(path.join(__dirname, '..'), path.resolve(file)).split(path.sep).join('/');
  const tail = rel.replace(/^test\/binaries\//, '').replace(/^candidates\//, '');
  if (appsText.includes(tail)) return 'yes';
  const base = path.basename(file);
  return new RegExp(`['/]${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`, 'i').test(appsText) ? 'name?' : 'no';
}

const seen = new Set();
function* walk(p) {
  let st; try { st = fs.statSync(p); } catch { return; }
  let real; try { real = fs.realpathSync(p); } catch { return; }
  if (st.isDirectory()) {
    if (seen.has(real)) return; seen.add(real);
    let ents; try { ents = fs.readdirSync(p).sort(); } catch { return; }
    for (const e of ents) yield* walk(path.join(p, e));
  } else if (st.isFile()) {
    if (!ANY_EXT && !EXTS.has(path.extname(p).toLowerCase())) return;
    yield p;
  }
}

let nPE = 0, nPas = 0;
for (const root of roots) for (const f of walk(root)) {
  let r; try { r = analyse(f); } catch (e) { if (ALL) console.error(`${f}: ${e.message}`); continue; }
  if (!r) continue; nPE++;
  if (!r.pascal && !ALL) continue;
  if (r.pascal) nPas++;
  if (APPS) r.registered = appsHit(f);
  if (JSON_OUT) { console.log(JSON.stringify(r)); continue; }
  const d = r.armD ? `${r.armDSummary} [${Object.entries(r.armD).map(([k, v]) => k + ':' + v).join(' ')}] move=${r.moveForm} gm=${r.gmFold}` : '';
  console.log([r.path, r.pascal ? (r.version || '?') : 'not-pascal', r.gameMaker ? 'GM' : '', r.inno ? 'Inno' : '', r.packer ? 'packed:' + r.packer : '',
    APPS ? 'apps:' + r.registered : '', d, r.product ? `"${r.product}${r.fileVersion ? ' ' + r.fileVersion : ''}"` : ''].filter(Boolean).join(' | '));
}
if (!JSON_OUT) console.error(`${nPE} PE files, ${nPas} Pascal`);
