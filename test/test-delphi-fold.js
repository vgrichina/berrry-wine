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
// Needs test/binaries/candidates/spelunky-classic (skips when absent).

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
// delphi_fold_stat keys
const NATIVE = 0, FALLBACK = 1, PARTIAL = 2, SMC_DROPS = 4;

async function delphiInstance(img, on, branchClock) {
  const inst = await bench.newInstance();
  const { e, mem, g2w } = inst;
  for (const [va, len] of [[0x401000, 0x6000], [0x5436e0, 0x80], [0x589720, 0x20]]) mem.set(img(va, len), g2w(va));
  // FreeMem stub: [eax-8] (the AnsiString refcount word) = 0xDEAD, eax = 0
  mem.set([0xC7, 0x40, 0xF8, 0xAD, 0xDE, 0, 0, 0x31, 0xC0, 0xC3], g2w(STUB));
  // poke stub: xor byte [edx], 1 ; ret -- a guest store, so it goes through
  // the code-write path a self-modifying program would
  mem.set([0x80, 0x32, 0x01, 0xC3], g2w(POKE));
  new DataView(e.memory.buffer).setUint32(g2w(0x589730), STUB, true);
  e.set_uop(0);
  e.set_delphi_fold(on ? 1 : 0);
  if (e.get_delphi_fold() !== (on ? 1 : 0)) fail('set_delphi_fold did not take');
  e.set_branch_clock(branchClock ? 1 : 0);
  return inst;
}

function layoutBuf(inst, spec) {
  const { mem, g2w } = inst;
  mem.fill(0, g2w(BUF), g2w(BUF) + 0x2000);
  const dv = new DataView(inst.e.memory.buffer);
  const w = (ga, v) => dv.setUint32(g2w(ga), v >>> 0, true);
  spec(w);
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
  const ID = { [H.clr]: 1, [H.asg]: 2, [H.frec]: 3, [H.farr]: 4, [H.crec]: 5 };
  const smcPair = (label, name, target, matchOk = false) => {
    const c = byName(name), id = ID[c.entry];
    return pair(img, label, c, async (inst, isOn) => {
      layoutBuf(inst, c.buf);
      call(inst, c.entry, c.regs);
      if (isOn && inst.e.delphi_fold_stat(10 + id) < 1 && inst.e.delphi_fold_stat(PARTIAL) < 1) fail(`${label}: warm-up was not folded`);
      const d0 = inst.e.delphi_fold_stat(SMC_DROPS);
      poke(inst, target);
      inst.smcDrops = inst.e.delphi_fold_stat(SMC_DROPS) - d0;
      inst.nativeBefore = inst.e.delphi_fold_stat(10 + id);
      inst.fallbackBefore = inst.e.delphi_fold_stat(20 + id);
    }, (d) => {
      // The patched helper (the call's own entry) must not run natively; an
      // intact helper it calls may (_CopyRecord's guest body calls _LStrAsg).
      // matchOk: the entry still matches and must fall back (a patched Move
      // leaves _CopyRecord's own bytes intact).
      const e = d.on.e;
      if (!d.on.smcDrops) return 'the poke dropped no range group';
      if (e.delphi_fold_stat(10 + id) !== d.on.nativeBefore) return 'the patched helper still ran natively';
      if (!matchOk && e.delphi_fold_stat(20 + id) !== d.on.fallbackBefore) return 'the patched helper still matched';
      if (matchOk && e.delphi_fold_stat(20 + id) === d.on.fallbackBefore) return 'did not fall back';
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
