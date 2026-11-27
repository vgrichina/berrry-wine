#!/usr/bin/env node
'use strict';
// The Delphi System RTTI/LStr helper fold (src/10-helpers-delphi-fold.wat,
// threaded handler 395; on by default, set_delphi_fold(0) = --no-delphi-fold).
//
// Spelunky Classic's own System unit bytes (0x401000..0x407000, plus the
// RValue/RToken typeinfo) are placed at their own VAs in two instances, one
// with the fold off and one with it on; the memory manager's FreeMem pointer
// goes to a stub that zeroes the freed block's refcount word so a free is
// visible. Every call runs in both, and registers, EIP, flags and the whole
// working buffer must agree -- under the branch clock with the blocks each run
// retires too, and under the default clock. Native, partial (native up to the
// free, then the body resumes at its CALL) and fallback counts are checked per
// case, so a case meant to stay native cannot silently fall back (or the
// reverse).
//
// Then: every batch budget from 1 to each call's block count stops on the
// same instruction with the same state; a System.Move whose code differs
// makes _CopyRecord fall back; a body patched before its first decode never
// matches; and a GUEST STORE into the middle of a body -- or of a callee the
// native form includes -- after the fold has run makes the next call run the
// patched guest code (the fold registers every byte it rests on for
// code-write invalidation; its block's page-index cover is only the first
// instruction).
//
// _InitializeRecord / _InitializeArray run over the image's RValue and over
// synthetic RTTI (every kind they take, records of static arrays of records,
// three deep, an empty static array) into a buffer of nonzero junk; System.Move
// runs every size class of the FILD form, and of Game Maker 7's REP MOVSD form
// (from Metrojd, placed at a VA of its own), apart and overlapping both ways.
//
// The GM fold (same handler, ids 10-13 and _FinalizeArray over records,
// set_gm_fold mask): Spelunky Classic's Game Maker 8 runner bytes for the
// variable-list scan (0x4a8a46.., placed as a stub that returns at the loop
// exit), the 2-D and 1-D instance-table reads (0x4aee54..0x4aef21, called at
// their own VAs) and _FinalizeArray over RValue arrays (the 16-Value GML
// argument arrays), each element's release shared, literal, nil, last
// (the guest's record loop resumes at that element) or repeated.
//
// Needs test/binaries/candidates/spelunky-classic (skips when absent); the
// REP Move cases need candidates/metrojd/metrojd_gm7.exe.

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const bench = require(path.join(ROOT, 'tools', 'bench-loops.js'));
const EXE = path.join(ROOT, 'test/binaries/candidates/spelunky-classic/extracted/Spelunky.exe');

let fails = 0;
const fail = (m) => { fails++; console.log('FAIL ' + m); };

function peImage(file) {
  const buf = fs.readFileSync(file);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const pe = dv.getUint32(0x3c, true), n = dv.getUint16(pe + 6, true), opt = dv.getUint16(pe + 20, true);
  const base = dv.getUint32(pe + 52, true);
  const secs = [];
  for (let i = 0; i < n; i++) {
    const s = pe + 24 + opt + i * 40;
    secs.push({ va: base + dv.getUint32(s + 12, true), vs: dv.getUint32(s + 8, true),
      raw: dv.getUint32(s + 20, true), rs: dv.getUint32(s + 16, true) });
  }
  return (va, len) => {
    const out = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      const s = secs.find((x) => va + i >= x.va && va + i < x.va + x.vs);
      const off = s ? va + i - s.va : -1;
      out[i] = s && off < s.rs ? buf[s.raw + off] : 0;
    }
    return out;
  };
}

const REGS = ['eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi'];
const BUF = 0x00a00000, STACK = 0x00900000, STUB = 0x00980000, POKE = STUB + 0x40;
const RVALUE = 0x5436f4, RTOKEN = 0x543710, ANSI = 0x4010d0;
const H = { clr: 0x405934, asg: 0x405988, frec: 0x4064e8, farr: 0x406534, crec: 0x40674c };
const MOVE = 0x4030a8;
// _InitializeRecord / _InitializeArray
const IR = 0x406418, IA = 0x406448;
const REPMV = STUB + 0x100, DFSTUB = STUB + 0x80;
const MJ = path.join(ROOT, 'test/binaries/candidates/metrojd/metrojd_gm7.exe');
// GM fold: the var scan as a stub (dec esi; cmp esi,0; jl X; the loop; X: ret),
// and the instance-table reads at their own VAs
const VSCAN = STUB + 0x200, VSCAN_HEAD = VSCAN + 6;
const I2W = 0x4aeee0, I2B = 0x4aee7c, I1 = 0x4aee54;
const REP_BODY = fs.existsSync(MJ) ? peImage(MJ)(0x402a90, 0x40) : null;
const le32 = (v) => [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];
// delphi_fold_stat keys
const NATIVE = 0, FALLBACK = 1, PARTIAL = 2, SMC_DROPS = 4;

async function delphiInstance(img, on, branchClock, gmMask) {
  const inst = await bench.newInstance();
  const { e, mem, g2w } = inst;
  for (const [va, len] of [[0x401000, 0x6000], [0x5436e0, 0x80], [0x589720, 0x20], [0x4aee40, 0x100]]) mem.set(img(va, len), g2w(va));
  mem.set([...img(0x4a8a46, 0x1B), 0xC3], g2w(VSCAN));
  // FreeMem stub: [eax-8] (the AnsiString refcount word) = 0xDEAD, eax = 0
  mem.set([0xC7, 0x40, 0xF8, 0xAD, 0xDE, 0, 0, 0x31, 0xC0, 0xC3], g2w(STUB));
  // poke stub: xor byte [edx], 1 ; ret -- a guest store, so it goes through
  // the code-write path a self-modifying program would
  mem.set([0x80, 0x32, 0x01, 0xC3], g2w(POKE));
  new DataView(e.memory.buffer).setUint32(g2w(0x589730), STUB, true);
  // Game Maker 7's REP MOVSD System.Move, from Metrojd, at a VA of its own
  // (it is matched by its bytes); and `std; call it; cld; ret`
  if (REP_BODY) {
    mem.set(REP_BODY, g2w(REPMV));
    mem.set([0xFD, 0xE8, ...le32(REPMV - (DFSTUB + 6)), 0xFC, 0xC3], g2w(DFSTUB));
  }
  e.set_uop(0);
  e.set_delphi_fold(on ? 1 : 0);
  if (gmMask !== undefined) e.set_gm_fold(gmMask);
  if (e.get_delphi_fold() !== (on ? 1 : 0)) fail('set_delphi_fold did not take');
  e.set_branch_clock(branchClock ? 1 : 0);
  return inst;
}

function layoutBuf(inst, spec) {
  const { mem, g2w } = inst;
  mem.fill(0, g2w(BUF), g2w(BUF) + 0x2000);
  const dv = new DataView(inst.e.memory.buffer);
  const w = (ga, v) => dv.setUint32(g2w(ga), v >>> 0, true);
  const b = (ga, v) => { mem[g2w(ga)] = v & 0xFF; };
  spec(w, b);
}

function call(inst, entry, regs) {
  const { e } = inst;
  for (const r of ['eax', 'ecx', 'edx', 'ebx', 'ebp', 'esi', 'edi']) e['set_' + r]((regs[r] || 0) >>> 0);
  e.set_esp(STACK);
  new DataView(e.memory.buffer).setUint32(inst.g2w(STACK), 0, true);
  e.set_eip(entry);
  let ok = false, blocks = 0;
  for (let i = 0; i < 4096 && !ok; i++) { e.run(0x7FFFFFFF); blocks += e.get_last_run_blocks(); ok = e.get_eip() === 0; }
  const out = { ok, blocks, eip: e.get_eip() >>> 0, flags: e.uop_flags() };
  for (const r of REGS) out[r] = e['get_' + r]() >>> 0;
  out.mem = Buffer.from(inst.mem.subarray(inst.g2w(BUF), inst.g2w(BUF) + 0x2000)).toString('base64');
  return out;
}
const poke = (inst, ga) => call(inst, POKE, { edx: ga });

const str = (w, ga, rc, text) => {
  w(ga, rc); w(ga + 4, text.length);
  for (let i = 0; i < text.length; i += 4) {
    let v = 0;
    for (let k = 0; k < 4 && i + k < text.length; k++) v |= text.charCodeAt(i + k) << (8 * k);
    w(ga + 8 + i, v);
  }
  return ga + 8;
};

// RValue: {kind:i32, real:f64, string at +0x10, pad} size 0x18
const CASES = [
  { name: 'LStrClr shared', entry: H.clr, want: 'n',
    buf: (w) => { w(BUF, str(w, BUF + 0x100, 2, 'abc')); }, regs: { eax: BUF } },
  { name: 'LStrClr nil', entry: H.clr, want: 'n', buf: () => {}, regs: { eax: BUF } },
  { name: 'LStrClr literal', entry: H.clr, want: 'n',
    buf: (w) => { w(BUF, str(w, BUF + 0x100, -1, 'lit')); }, regs: { eax: BUF } },
  { name: 'LStrClr last ref', entry: H.clr, want: 'p',
    buf: (w) => { w(BUF, str(w, BUF + 0x100, 1, 'abc')); }, regs: { eax: BUF } },
  { name: 'LStrAsg shared', entry: H.asg, want: 'n',
    buf: (w) => { w(BUF, str(w, BUF + 0x100, 3, 'old')); w(BUF + 4, str(w, BUF + 0x200, 2, 'new!')); },
    regs: { eax: BUF, edx: BUF + 0x208 } },
  { name: 'LStrAsg nil dest', entry: H.asg, want: 'n',
    buf: (w) => { str(w, BUF + 0x200, 1, 'new'); }, regs: { eax: BUF, edx: BUF + 0x208 } },
  { name: 'LStrAsg nil src', entry: H.asg, want: 'n',
    buf: (w) => { w(BUF, str(w, BUF + 0x100, 2, 'old')); }, regs: { eax: BUF, edx: 0 } },
  { name: 'LStrAsg same', entry: H.asg, want: 'n',
    buf: (w) => { w(BUF, str(w, BUF + 0x100, 2, 'xy')); }, regs: { eax: BUF, edx: BUF + 0x108 } },
  { name: 'LStrAsg both nil', entry: H.asg, want: 'n', buf: () => {}, regs: { eax: BUF, edx: 0 } },
  { name: 'LStrAsg literal src', entry: H.asg, want: 'f',
    buf: (w) => { w(BUF, str(w, BUF + 0x100, 2, 'old')); str(w, BUF + 0x200, -1, 'lit'); },
    regs: { eax: BUF, edx: BUF + 0x208 } },
  { name: 'LStrAsg frees old', entry: H.asg, want: 'p',
    buf: (w) => { w(BUF, str(w, BUF + 0x100, 1, 'old')); str(w, BUF + 0x200, 1, 'new'); },
    regs: { eax: BUF, edx: BUF + 0x208 } },
  { name: 'LStrAsg frees old, nil src', entry: H.asg, want: 'p',
    buf: (w) => { w(BUF, str(w, BUF + 0x100, 1, 'old')); }, regs: { eax: BUF, edx: 0 } },
  { name: 'LStrAsg unaligned slot', entry: H.asg, want: 'f',
    buf: (w) => { str(w, BUF + 0x200, 2, 'new'); }, regs: { eax: BUF + 2, edx: BUF + 0x208 } },
  { name: 'FinalizeArray 0', entry: H.farr, want: 'n', buf: () => {}, regs: { eax: BUF, edx: ANSI, ecx: 0 } },
  { name: 'FinalizeArray 1 str', entry: H.farr, want: 'n',
    buf: (w) => { w(BUF, str(w, BUF + 0x100, 5, 's')); }, regs: { eax: BUF, edx: ANSI, ecx: 1 } },
  { name: 'FinalizeArray 1 str last', entry: H.farr, want: 'p',
    buf: (w) => { w(BUF, str(w, BUF + 0x100, 1, 's')); }, regs: { eax: BUF, edx: ANSI, ecx: 1 } },
  { name: 'FinalizeArray 3 str', entry: H.farr, want: 'f',
    buf: (w) => { w(BUF, str(w, BUF + 0x100, 5, 's')); }, regs: { eax: BUF, edx: ANSI, ecx: 3 } },
  { name: 'FinalizeRecord RValue', entry: H.frec, want: 'n',
    buf: (w) => { w(BUF, 1); w(BUF + 0x10, str(w, BUF + 0x100, 4, 'rv')); }, regs: { eax: BUF, edx: RVALUE } },
  { name: 'FinalizeRecord RValue nil', entry: H.frec, want: 'n',
    buf: (w) => { w(BUF, 1); }, regs: { eax: BUF, edx: RVALUE } },
  { name: 'FinalizeRecord RValue last', entry: H.frec, want: 'p',
    buf: (w) => { w(BUF, 1); w(BUF + 0x10, str(w, BUF + 0x100, 1, 'rv')); }, regs: { eax: BUF, edx: RVALUE } },
  { name: 'FinalizeRecord RToken', entry: H.frec, want: 'f',
    buf: (w) => { w(BUF + 0x20, str(w, BUF + 0x100, 4, 'tk')); }, regs: { eax: BUF, edx: RTOKEN } },
  { name: 'CopyRecord RValue', entry: H.crec, want: 'n',
    buf: (w) => {
      for (let k = 0; k < 6; k++) { w(BUF + k * 4, 0x11111111 * (k + 1)); w(BUF + 0x40 + k * 4, 0x0A0B0C00 + k); }
      w(BUF + 0x10, str(w, BUF + 0x100, 2, 'dst')); w(BUF + 0x50, str(w, BUF + 0x200, 3, 'src'));
    }, regs: { eax: BUF, edx: BUF + 0x40, ecx: RVALUE } },
  { name: 'CopyRecord RValue nil src', entry: H.crec, want: 'n',
    buf: (w) => { w(BUF + 0x10, str(w, BUF + 0x100, 2, 'dst')); w(BUF + 0x40, 7); },
    regs: { eax: BUF, edx: BUF + 0x40, ecx: RVALUE } },
  { name: 'CopyRecord RValue frees', entry: H.crec, want: 'f',
    buf: (w) => { w(BUF + 0x10, str(w, BUF + 0x100, 1, 'dst')); w(BUF + 0x50, str(w, BUF + 0x200, 3, 'src')); },
    regs: { eax: BUF, edx: BUF + 0x40, ecx: RVALUE } },
  { name: 'CopyRecord RValue overlap', entry: H.crec, want: 'f',
    buf: (w) => { w(BUF + 0x18, str(w, BUF + 0x200, 3, 'src')); },
    regs: { eax: BUF, edx: BUF + 0x8, ecx: RVALUE } },
  { name: 'CopyRecord RToken', entry: H.crec, want: 'f',
    buf: (w) => { w(BUF + 0x60, str(w, BUF + 0x200, 3, 'src')); },
    regs: { eax: BUF, edx: BUF + 0x40, ecx: RTOKEN } },
];

// Synthetic RTTI at TI (inside the compared buffer, outside every zeroed
// span): [kind, L, name(L)] then, from +2+L, the kind's data. Record (0x0E):
// size, field count, {PPTypeInfo, offset} per field. Static array (0x0D):
// element stride, count, PPTypeInfo. Each typeinfo X has a PPTypeInfo cell.
const TI = BUF + 0x1800;
const T = { ansi: ANSI };
const PP = {};
function rtti(w, b) {
  let at = TI;
  const cell = (name, ti) => { PP[name] = at; w(at, ti); at += 4; };
  const head = (name, kind, label) => {
    at = (at + 3) & ~3;
    T[name] = at; b(at, kind); b(at + 1, label.length);
    for (let i = 0; i < label.length; i++) b(at + 2 + i, label.charCodeAt(i));
    at += 2 + label.length;
    return at;
  };
  const rec = (name, size, fields) => {
    const d = head(name, 0x0E, name.toUpperCase());
    w(d, size); w(d + 4, fields.length);
    fields.forEach(([t, off], i) => { w(d + 8 + 8 * i, PP[t]); w(d + 12 + 8 * i, off); });
    at = d + 8 + 8 * fields.length;
    cell(name, T[name]);
  };
  const arr = (name, stride, count, el) => {
    const d = head(name, 0x0D, name);
    w(d, stride); w(d + 4, count); w(d + 8, PP[el]);
    at = d + 12;
    cell(name, T[name]);
  };
  const leaf = (name, kind) => { head(name, kind, name); cell(name, T[name]); };
  cell('ansi', ANSI);
  leaf('wstr', 0x0B); leaf('var', 0x0C); leaf('intf', 0x0F); leaf('dyn', 0x11);
  rec('r1', 0x10, [['ansi', 4], ['ansi', 0xC]]);
  arr('a1', 0x20, 2, 'r1');                       // two r1 per element
  arr('a0', 0x08, 0, 'ansi');                     // an empty static array
  rec('r2', 0x60, [['ansi', 0], ['a1', 8], ['var', 0x28], ['intf', 0x38], ['wstr', 0x3C], ['dyn', 0x40], ['a0', 0x44]]);
  arr('a2', 0x60, 2, 'r2');                       // array of records of arrays of records
  rec('r3', 0xC8, [['a2', 0], ['ansi', 0xC4]]);
}
rtti(() => {}, () => {});   // T/PP addresses only
// the buffer the Init cases zero: every byte nonzero first
const junk = (w, b) => { for (let k = 0; k < 0x400; k += 4) w(BUF + k, 0x5A000000 + k); rtti(w, b); };
const INIT = [
  ['InitRecord RValue', IR, { edx: RVALUE }, 'n'],
  ['InitRecord r1', IR, { edx: T.r1 }, 'n'],
  ['InitRecord r2 (all kinds, nested)', IR, { edx: T.r2 }, 'n'],
  ['InitRecord r3 (3 deep)', IR, { edx: T.r3 }, 'n'],
  ['InitArray ansi 0', IA, { edx: ANSI, ecx: 0 }, 'n'],
  ['InitArray ansi 1', IA, { edx: ANSI, ecx: 1 }, 'n'],
  ['InitArray ansi 7', IA, { edx: ANSI, ecx: 7 }, 'n'],
  ['InitArray ansi -1', IA, { edx: ANSI, ecx: -1 }, 'f'],
  ['InitArray wstr 2', IA, { edx: T.wstr, ecx: 2 }, 'n'],
  ['InitArray variant 3', IA, { edx: T.var, ecx: 3 }, 'n'],
  ['InitArray intf 1', IA, { edx: T.intf, ecx: 1 }, 'n'],
  ['InitArray dynarray 4', IA, { edx: T.dyn, ecx: 4 }, 'n'],
  ['InitArray RValue 3', IA, { edx: RVALUE, ecx: 3 }, 'n'],
  ['InitArray r2 2', IA, { edx: T.r2, ecx: 2 }, 'n'],
  ['InitArray a1 3 (static, nested)', IA, { edx: T.a1, ecx: 3 }, 'n'],
  ['InitArray a0 2 (empty elements)', IA, { edx: T.a0, ecx: 2 }, 'n'],
];
// (A kind the bodies do not take, or a record with no managed field, runs
// the guest's RunError path / a do-while over garbage: declined natively,
// not exercised here.)
for (const [name, entry, regs, want] of INIT) CASES.push({ name, entry, want, buf: junk, regs: { eax: BUF + 0x10, ...regs } });
// a typeinfo inside the span it would zero: the guest body re-reads it
CASES.push({ name: 'InitArray zeroes its typeinfo', entry: IA, want: 'f',
  buf: (w, b) => { junk(w, b); b(BUF + 0x18, 0x0A); b(BUF + 0x19, 0); }, regs: { eax: BUF + 0x10, edx: BUF + 0x18, ecx: 4 } });

// System.Move(eax = src, edx = dst, ecx = n): every size class of both
// forms, forward, backward and overlapping both ways, odd alignments.
const pattern = (w) => { for (let k = 0; k < 0x800; k += 4) w(BUF + k, (0x01020304 * (k + 1)) ^ 0xA5C3E10F); };
const MOVES = [];
for (const n of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 15, 16, 17, 24, 25, 32, 33, 40, 64, 100, 257]) {
  MOVES.push([`${n} apart`, 0x100, 0x500 + (n & 3), n]);
}
for (const n of [3, 8, 12, 20, 40, 100, 257]) {
  MOVES.push([`${n} dst=src-3`, 0x203, 0x200, n]);
  MOVES.push([`${n} dst=src+5`, 0x200, 0x205, n]);
  MOVES.push([`${n} dst=src+9`, 0x201, 0x20A, n]);
}
MOVES.push(['40 dst<src far', 0x600, 0x101, 40], ['0 same', 0x100, 0x100, 0], ['50 same', 0x100, 0x100, 50]);
for (const [label, s, d, n] of MOVES) {
  CASES.push({ name: `Move ${label}`, entry: MOVE, want: 'n', buf: pattern, regs: { eax: BUF + s, edx: BUF + d, ecx: n } });
  if (REP_BODY) CASES.push({ name: `REP Move ${label}`, entry: REPMV, want: 'n', buf: pattern, regs: { eax: BUF + s, edx: BUF + d, ecx: n } });
}
CASES.push({ name: 'Move -1', entry: MOVE, want: 'n', buf: pattern, regs: { eax: BUF, edx: BUF + 0x100, ecx: -1 } });
if (REP_BODY) {
  CASES.push({ name: 'REP Move -1', entry: REPMV, want: 'f', buf: pattern, regs: { eax: BUF, edx: BUF + 0x100, ecx: -1 } });
  CASES.push({ name: 'REP Move under DF=1', entry: DFSTUB, want: 'f', buf: pattern, regs: { eax: BUF + 0x300, edx: BUF + 0x100, ecx: 8 } });
}

// ---- GM fold cases ----
// Var list at BUF: [+4] rows, [+8] count; rows of 40 bytes, id at +0. The
// stub enters with esi = count, eax = list, edx = id, ecx = -1.
const vlist = (base, ids) => (w) => {
  w(BUF + 4, base); w(BUF + 8, ids.length);
  ids.forEach((id, i) => { w(base + 40 * i, id); w(base + 40 * i + 8, 0x1000 + i); });
};
const ids = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const VS = [
  ['varscan hit middle', ids(50, (i) => 100000 + i), 100020, BUF + 0x100],
  ['varscan hit duplicate (last wins)', ids(50, (i) => (i === 5 || i === 30 ? 777 : 100000 + i)), 777, BUF + 0x100],
  ['varscan hit top row', ids(50, (i) => 100000 + i), 100049, BUF + 0x100],
  ['varscan hit row 0', ids(150, (i) => 100000 + i), 100000, BUF + 0x100],
  ['varscan miss', ids(150, (i) => 100000 + i), 5, BUF + 0x100],
  ['varscan one row hit', [42], 42, BUF + 0x100],
  ['varscan one row miss', [42], 43, BUF + 0x100],
  ['varscan row id straddles a page', ids(30, (i) => 100000 + i), 100003, BUF + 0xFFD - 40 * 10],
  ['varscan miss across pages', ids(60, (i) => 100000 + i), 9, BUF + 0xFFD - 40 * 10],
];
for (const [name, list, id, base] of VS) {
  CASES.push({ name, entry: VSCAN, want: 'n', buf: vlist(base, list), regs: { eax: BUF, edx: id, ecx: -1, esi: list.length } });
}
CASES.push({ name: 'varscan empty list', entry: VSCAN, want: '-', buf: vlist(BUF + 0x100, []), regs: { eax: BUF, edx: 1, ecx: -1, esi: 0 } });
// Instance table at BUF: 2-D counts A = [+C], rows B = [+D] (C/D 0x84/0x80
// or 0x7C/0x78); A is a dynarray (length at A-4) of per-row counts.
const itab = (C, D, nil) => (w) => {
  const A = BUF + 0x208, B = BUF + 0x300;
  if (!nil) { w(BUF + C, A); w(A - 4, 3); }
  w(BUF + D, B);
  [2, 0, 4].forEach((c, i) => { w(A + 4 * i, c); w(B + 4 * i, BUF + 0x400 + 0x40 * i); });
  for (let k = 0; k < 0x30; k += 4) w(BUF + 0x400 + k * 4, 0xC0DE0000 + k);
};
for (const [label, entry, C, D] of [['inst2w', I2W, 0x84, 0x80], ['inst2b', I2B, 0x7C, 0x78], ['inst1', I1, 0x7C, 0x78]]) {
  const two = entry !== I1;
  const pts = two ? [[-1, 0], [3, 0], [7, 1], [0, -1], [0, 2], [1, 0], [0, 1], [2, 3], [2, 0]] : [[-1, 0], [3, 0], [0, 0], [2, 0]];
  for (const [i, j] of pts) CASES.push({ name: `${label} [${i}][${j}]`, entry, want: 'n', buf: itab(C, D), regs: { eax: BUF, edx: i, ecx: j } });
  CASES.push({ name: `${label} nil table`, entry, want: 'n', buf: itab(C, D, true), regs: { eax: BUF, edx: 0, ecx: 0 } });
}
// _FinalizeArray over RValue (0x18 bytes, string at +0x10): per element a
// release kind -- null nil, 's' shared (rc 3), 'l' literal, 'f' last ref (rc
// 1), 'd' rc 2, or a number naming an earlier element whose string it repeats.
const rvals = (spec) => (w) => {
  const at = [];
  spec.forEach((k, i) => {
    w(BUF + 0x18 * i, 1); w(BUF + 0x18 * i + 8, 0x3FF00000 + i);
    let p = 0;
    if (k === 's') p = str(w, BUF + 0x1000 + 0x20 * i, 3, 'sh' + i);
    if (k === 'l') p = str(w, BUF + 0x1000 + 0x20 * i, -1, 'lt' + i);
    if (k === 'f') p = str(w, BUF + 0x1000 + 0x20 * i, 1, 'fr' + i);
    if (k === 'd') p = str(w, BUF + 0x1000 + 0x20 * i, 2, 'du' + i);
    if (typeof k === 'number') p = at[k];
    at.push(p);
    w(BUF + 0x18 * i + 0x10, p);
  });
};
const sixteen = (f) => Array.from({ length: 16 }, (_, i) => f(i));
for (const [name, spec, want] of [
  ['FinalizeArray RValue x16 nil', sixteen(() => null), 'n'],
  ['FinalizeArray RValue x16 mixed', sixteen((i) => ['s', null, 'l', null][i & 3]), 'n'],
  ['FinalizeArray RValue x16 one string 16 times', sixteen((i) => (i ? 0 : 's')), 'p'],
  ['FinalizeArray RValue x1', ['s'], 'n'],
  ['FinalizeArray RValue x16 last ref at 5', sixteen((i) => (i === 5 ? 'f' : i & 1 ? 's' : null)), 'p'],
  ['FinalizeArray RValue x16 last ref at 15', sixteen((i) => (i === 15 ? 'f' : null)), 'p'],
  ['FinalizeArray RValue last ref at 0', ['f', 's', null], 'f'],
  ['FinalizeArray RValue repeated rc 2', [null, 's', 'd', 2, null], 'p'],
  ['FinalizeArray RValue repeated rc 3 and a literal', ['s', null, 0, 'l', 3], 'n'],
  ['FinalizeArray RValue x100 nil', Array.from({ length: 100 }, () => null), 'n'],
]) CASES.push({ name, entry: H.farr, want, buf: rvals(spec), regs: { eax: BUF, edx: RVALUE, ecx: spec.length } });
CASES.push({ name: 'FinalizeArray RToken x2', entry: H.farr, want: 'f',
  buf: (w) => { w(BUF + 0x20, str(w, BUF + 0x1000, 4, 'tk')); }, regs: { eax: BUF, edx: RTOKEN, ecx: 2 } });

function compare(a, b, withBlocks) {
  const diffs = [];
  if (!a.ok || !b.ok) diffs.push('did not return');
  for (const k of ['eip', 'flags', ...(withBlocks ? ['blocks'] : []), ...REGS]) {
    if (a[k] !== b[k]) diffs.push(`${k} ${a[k].toString(16)} vs ${b[k].toString(16)}`);
  }
  if (a.mem !== b.mem) diffs.push('memory differs');
  return diffs;
}

async function casesUnder(img, branchClock) {
  const tag = branchClock ? 'branch clock' : 'default clock';
  const off = await delphiInstance(img, false, branchClock);
  const on = await delphiInstance(img, true, branchClock);
  for (const c of CASES) {
    layoutBuf(off, c.buf); layoutBuf(on, c.buf);
    const s0 = [NATIVE, FALLBACK, PARTIAL].map((k) => on.e.delphi_fold_stat(k));
    const a = call(off, c.entry, c.regs), b = call(on, c.entry, c.regs);
    const [dn, df, dp] = [NATIVE, FALLBACK, PARTIAL].map((k, i) => on.e.delphi_fold_stat(k) - s0[i]);
    const diffs = compare(a, b, branchClock);
    if (c.want === 'n' && (dn < 1 || df || dp)) diffs.push(`want native, got native=${dn} partial=${dp} fallback=${df}`);
    if (c.want === 'f' && df < 1) diffs.push(`want fallback, got native=${dn} fallback=${df}`);
    if (c.want === 'p' && (dp < 1 || df)) diffs.push(`want partial, got partial=${dp} fallback=${df}`);
    if (c.want === '-' && (dn || df || dp)) diffs.push(`want no fold, got native=${dn} partial=${dp} fallback=${df}`);
    if (off.e.delphi_fold_stat(NATIVE) + off.e.delphi_fold_stat(FALLBACK) + off.e.delphi_fold_stat(PARTIAL)) {
      diffs.push('the fold fired with set_delphi_fold(0)');
    }
    console.log(`[${tag}] ${c.name.padEnd(28)} ${diffs.length ? 'FAIL ' + diffs.join(', ') : 'ok'} (native=${dn} partial=${dp} fallback=${df})`);
    if (diffs.length) fails++;
  }
  return { off, on };
}

// Every batch budget from 1 to a call's block count: a batch that runs out
// inside a helper must stop on the instruction, with the state, the threaded
// body stops at -- the fold pays for a path only when the budget covers it.
function everyBudget(off, on, tag) {
  let cut = 0;
  const bad = [];
  for (const c of CASES) {
    layoutBuf(off, c.buf);
    const full = call(off, c.entry, c.regs).blocks;
    // the same full call in `on` too, so both start every budget from the
    // same lazy flags (a stub whose first block writes none shows them)
    layoutBuf(on, c.buf);
    call(on, c.entry, c.regs);
    for (let b = 1; b <= full + 1; b++) {
      const st = [];
      for (const inst of [off, on]) {
        layoutBuf(inst, c.buf);
        const { e } = inst;
        for (const r of ['eax', 'ecx', 'edx', 'ebx', 'ebp', 'esi', 'edi']) e['set_' + r]((c.regs[r] || 0) >>> 0);
        e.set_esp(STACK);
        new DataView(e.memory.buffer).setUint32(inst.g2w(STACK), 0, true);
        e.set_eip(c.entry);
        e.run(b);
        const o = [e.get_eip() >>> 0, e.get_last_run_blocks(), e.uop_flags(), ...REGS.map((r) => e['get_' + r]() >>> 0)];
        o.push(Buffer.from(inst.mem.subarray(inst.g2w(BUF), inst.g2w(BUF) + 0x2000)).toString('base64'));
        st.push(o.join(','));
      }
      cut++;
      if (st[0] !== st[1]) bad.push(`${c.name} budget ${b}: ${st[0].slice(0, 90)} / ${st[1].slice(0, 90)}`);
    }
  }
  if (bad.length) fail(`[${tag}] every budget: ${bad.length} of ${cut} differ; ${bad.slice(0, 2).join(' | ')}`);
  else console.log(`${`[${tag}] every budget`.padEnd(43)} ok (${cut} batches)`);
}

// Run `c` in an off and an on instance after `prep` (which may poke code
// through a guest store in both); the on instance must match and its counters
// move as `check` says.
async function pair(img, label, c, prep, check) {
  const off = await delphiInstance(img, false, true), on = await delphiInstance(img, true, true);
  await prep(off, false); await prep(on, true);
  layoutBuf(off, c.buf); layoutBuf(on, c.buf);
  const s = (k) => on.e.delphi_fold_stat(k);
  const before = [NATIVE, FALLBACK, PARTIAL, SMC_DROPS].map(s);
  const a = call(off, c.entry, c.regs), b = call(on, c.entry, c.regs);
  const d = [NATIVE, FALLBACK, PARTIAL, SMC_DROPS].map((k, i) => s(k) - before[i]);
  const diffs = compare(a, b, true);   // pair() instances run the branch clock
  const why = check({ native: d[0], fallback: d[1], partial: d[2], drops: d[3], on });
  if (why) diffs.push(why);
  console.log(`${label.padEnd(43)} ${diffs.length ? 'FAIL ' + diffs.join(', ') : 'ok'} (native=${d[0]} partial=${d[2]} fallback=${d[1]})`);
  if (diffs.length) fails++;
}

async function main() {
  bench.ensureBuilt();
  if (!fs.existsSync(EXE)) { console.log('SKIP: ' + path.relative(ROOT, EXE) + ' absent'); return; }
  const img = peImage(EXE);
  const { off, on } = await casesUnder(img, true);
  everyBudget(off, on, 'branch clock');
  // The default clock counts threaded block cuts, which the fold does not
  // model (any decode-time tier moves that clock: A/Bs use --branch-clock).
  // Its cases still must agree on registers, flags and memory.
  await casesUnder(img, false);
  const byName = (n) => CASES.find((x) => x.name === n);

  // Another System.Move (one byte of its code changed before any decode):
  // CopyRecord with bytes before its string field cannot vouch for that
  // Move's branches, so it runs the body -- exactly, blocks included.
  await pair(img, 'CopyRecord, other Move', byName('CopyRecord RValue'),
    (inst) => { inst.mem[inst.g2w(MOVE + 0x1A)] ^= 0x01; },
    (d) => (d.fallback < 1 ? 'did not fall back' : ''));

  // A body patched before its first decode is not the System unit.
  await pair(img, 'patched LStrClr never matches', byName('LStrClr shared'),
    (inst) => { inst.mem[inst.g2w(H.clr + 0x10)] ^= 0x01; },
    (d) => (d.native + d.fallback + d.partial ? `still matched (${d.native + d.fallback + d.partial} calls)` : ''));

  // Self-modifying code: run the helper (decoded as the fold, cover = first
  // instruction), then a guest store flips a byte in the MIDDLE of the body,
  // outside that cover. The next call must run the patched guest code. The
  // patched byte (+0x10 of _LStrClr) turns its `jl` at +0xF into another
  // condition, which an off/on mismatch would show.
  const ID = { [H.clr]: 1, [H.asg]: 2, [H.frec]: 3, [H.farr]: 4, [H.crec]: 5, [IR]: 6, [IA]: 7, [MOVE]: 8, [REPMV]: 9,
    [VSCAN]: 10, [I2W]: 11, [I2B]: 12, [I1]: 13 };
  // delphi_fold_stat keys: 11-19 / 21-29 native / fallback for 1-9, 30-33 /
  // 40-43 for the GM ids 10-13
  const NK = (id) => (id < 10 ? 10 + id : 20 + id), FK = (id) => (id < 10 ? 20 + id : 30 + id);
  const smcPair = (label, name, target, matchOk = false) => {
    const c = byName(name), id = ID[c.entry];
    return pair(img, label, c, async (inst, isOn) => {
      layoutBuf(inst, c.buf);
      call(inst, c.entry, c.regs);
      if (isOn && inst.e.delphi_fold_stat(NK(id)) < 1 && inst.e.delphi_fold_stat(PARTIAL) < 1) fail(`${label}: warm-up was not folded`);
      const d0 = inst.e.delphi_fold_stat(SMC_DROPS);
      poke(inst, target);
      inst.smcDrops = inst.e.delphi_fold_stat(SMC_DROPS) - d0;
      inst.nativeBefore = inst.e.delphi_fold_stat(NK(id));
      inst.fallbackBefore = inst.e.delphi_fold_stat(FK(id));
    }, (d) => {
      // The patched helper (the call's own entry) must not run natively; an
      // intact helper it calls may (_CopyRecord's guest body calls _LStrAsg).
      // matchOk: the entry still matches and must fall back (a patched Move
      // leaves _CopyRecord's own bytes intact).
      const e = d.on.e;
      if (!d.on.smcDrops) return 'the poke dropped no range group';
      if (e.delphi_fold_stat(NK(id)) !== d.on.nativeBefore) return 'the patched helper still ran natively';
      if (!matchOk && e.delphi_fold_stat(FK(id)) !== d.on.fallbackBefore) return 'the patched helper still matched';
      if (matchOk && e.delphi_fold_stat(FK(id)) === d.on.fallbackBefore) return 'did not fall back';
      return '';
    });
  };
  await smcPair('SMC mid-body: LStrClr +0x10', 'LStrClr shared', H.clr + 0x10);
  await smcPair('SMC mid-body: CopyRecord +0x90', 'CopyRecord RValue', H.crec + 0x90);
  // A callee: _FinalizeArray's native form includes _LStrClr; patching
  // _LStrClr's middle must unclaim _FinalizeArray too.
  await smcPair('SMC callee: FinalizeArray via LStrClr', 'FinalizeArray 1 str', H.clr + 0x10);
  // System.Move, which _CopyRecord's native form assumes for its leading copy.
  await smcPair('SMC Move: CopyRecord', 'CopyRecord RValue', MOVE + 0x1A, true);
  // _InitializeRecord's mov ecx,1 -> 0; _InitializeArray's flat-loop stride
  // 4 -> 5, directly and as _InitializeRecord's callee; System.Move's cmp
  // ecx,8 -> cmp cl,8 and its jump table; the REP form's and ecx,3 -> 2
  await smcPair('SMC mid-body: InitRecord +0x1D', 'InitRecord RValue', IR + 0x1D);
  await smcPair('SMC mid-body: InitArray +0x44', 'InitArray ansi 7', IA + 0x44);
  await smcPair('SMC callee: InitRecord via InitArray', 'InitRecord r1', IA + 0x44);
  await smcPair('SMC callee: InitArray via InitRecord', 'InitArray RValue 3', IR + 0x1D);
  await smcPair('SMC mid-body: Move +0x1A', 'Move 16 apart', MOVE + 0x1A);
  await smcPair('SMC jump table: Move +0x3C', 'Move 9 apart', MOVE + 0x3C);
  if (REP_BODY) await smcPair('SMC mid-body: REP Move +0x19', 'REP Move 7 apart', REPMV + 0x19);
  // Move fold off by a changed byte, CopyRecord falls back with it.
  await pair(img, 'patched Move never matches', byName('Move 24 apart'),
    (inst) => { inst.mem[inst.g2w(MOVE + 0x1A)] ^= 0x01; },
    (d) => (d.native + d.fallback + d.partial ? `still matched (${d.native + d.fallback + d.partial} calls)` : ''));
  // CopyRecord over the REP form: its leading Move is that form's branches.
  if (REP_BODY) {
    await pair(img, 'CopyRecord over the REP Move', byName('CopyRecord RValue'),
      (inst) => {
        const dv = new DataView(inst.e.memory.buffer);
        dv.setInt32(inst.g2w(H.crec + 0x28), REPMV - (H.crec + 0x2C), true);
        dv.setInt32(inst.g2w(H.crec + 0x111), REPMV - (H.crec + 0x115), true);
      },
      (d) => (d.native < 1 || d.fallback ? `want native, got native=${d.native} fallback=${d.fallback}` : ''));
  }
  // GM fold: the var scan's cmp edx,[edi+ebx*8] -> cmp edx,[edi+ebx*8+..]
  // (its jnz at +9 -> jz), an instance read's jge, _FinalizeRecord under the
  // record loop (FinalizeArray still matches and must fall back).
  await smcPair('SMC mid-loop: varscan +0x9', 'varscan hit middle', VSCAN_HEAD + 0x9);
  await smcPair('SMC mid-body: inst2w +0x1D', 'inst2w [1][0]', I2W + 0x1D);
  await smcPair('SMC mid-body: inst1 +0x17', 'inst1 [2][0]', I1 + 0x17);
  await smcPair('SMC callee: record FinalizeArray via FinalizeRecord', 'FinalizeArray RValue x16 mixed', H.frec + 0x1D, true);
  // set_gm_fold(0): the GM ids are left alone and the record arrays fall
  // back, while the Delphi helpers still fold
  {
    const off = await delphiInstance(img, false, true), on = await delphiInstance(img, true, true, 0);
    let bad = 0;
    for (const n of ['varscan hit middle', 'inst2w [1][0]', 'inst1 [2][0]', 'FinalizeArray RValue x16 mixed', 'LStrClr shared']) {
      const c = byName(n);
      layoutBuf(off, c.buf); layoutBuf(on, c.buf);
      const st = [30, 31, 33, 34, 0].map((k) => on.e.delphi_fold_stat(k));
      const a = call(off, c.entry, c.regs), b = call(on, c.entry, c.regs);
      const moved = [30, 31, 33, 34, 0].map((k, i) => on.e.delphi_fold_stat(k) - st[i]);
      const diffs = compare(a, b, true);
      if (moved.slice(0, 4).some((x) => x)) diffs.push('a GM fold ran under set_gm_fold(0): ' + moved.join(','));
      if (n === 'LStrClr shared' && moved[4] < 1) diffs.push('the Delphi fold stopped too');
      if (diffs.length) { bad++; console.log(`gm_fold 0: ${n} FAIL ${diffs.join(', ')}`); }
    }
    if (bad) fails++; else console.log(`${'set_gm_fold(0) leaves the GM ids alone'.padEnd(43)} ok`);
  }
  const smc = (target, name) => async (inst) => {
    const c = byName(name);
    layoutBuf(inst, c.buf);
    call(inst, c.entry, c.regs);
    poke(inst, target);
  };
  // A write outside every registered range drops nothing.
  await pair(img, 'unrelated store keeps the fold', byName('LStrClr shared'), smc(0x401000 + 0x20, 'LStrClr shared'),
    (d) => (d.drops ? `dropped ${d.drops} group(s)` : d.native < 1 ? 'no longer native' : ''));

  if (fails) { console.log(`FAIL: ${fails}`); process.exit(1); }
  console.log('PASS');
}
main().catch((err) => { console.error(err.stack || String(err)); process.exit(1); });
