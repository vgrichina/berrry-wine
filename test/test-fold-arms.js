#!/usr/bin/env node
'use strict';
// fold-bench arms (01-header $fold_arms, run.js --fold-arms=M; all off by default).
//
// D (8): Delphi RTL HLE. Spelunky Classic's own System unit bytes
// (0x401000..0x407000, plus the RValue/RToken typeinfo) are placed at their own
// VAs in two instances; the memory manager's FreeMem pointer goes to a stub
// that zeroes the freed block's refcount word so a free is visible. Every call
// runs once with D off and once with D on, and registers, EIP, flags and the
// whole working buffer must agree. Native, partial (native up to the free,
// then the body resumes at its CALL) and fallback counts are checked per case,
// so a case meant to stay native cannot silently fall back (or the reverse). A one-byte patch to a helper body must stop it matching.
//
// A (1): a loop calling a `rep ret` function compiles and is exact.
// B (3): the same with the pending CALL/RET seams stepped in the fast loop.
// C (4): a load from a read-only image dword lowers to a constant, and a
// guest store to that dword kills the program (the next run sees the new value).

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
const BUF = 0x00a00000, STACK = 0x00900000, STUB = 0x00980000;
const RVALUE = 0x5436f4, RTOKEN = 0x543710, ANSI = 0x4010d0;
const H = { clr: 0x405934, asg: 0x405988, frec: 0x4064e8, farr: 0x406534, crec: 0x40674c };

async function delphiInstance(img, arms) {
  const inst = await bench.newInstance();
  const { e, mem, g2w } = inst;
  if (inst.imageBase !== 0x400000 && inst.imageBase + 0x10000 > 0x401000) {
    // the copied System unit must not overlap a live image at another base
  }
  for (const [va, len] of [[0x401000, 0x6000], [0x5436e0, 0x80], [0x589720, 0x20]]) mem.set(img(va, len), g2w(va));
  // FreeMem stub: [eax-8] (the AnsiString refcount word) = 0xDEAD, eax = 0
  mem.set([0xC7, 0x40, 0xF8, 0xAD, 0xDE, 0, 0, 0x31, 0xC0, 0xC3], g2w(STUB));
  new DataView(e.memory.buffer).setUint32(g2w(0x589730), STUB, true);
  e.set_uop(0);
  e.set_fold_arms(arms);
  return inst;
}

// Build a fresh working buffer: strings and records described by `spec`.
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
  const ok = bench.runToCompletion(e, entry, STACK);
  const out = { ok, eip: e.get_eip() >>> 0, flags: e.uop_flags() };
  for (const r of REGS) out[r] = e['get_' + r]() >>> 0;
  out.mem = Buffer.from(inst.mem.subarray(inst.g2w(BUF), inst.g2w(BUF) + 0x2000)).toString('base64');
  return out;
}

// AnsiString at ga: refcount, length, chars; returns the string pointer.
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
  { name: 'LStrAsg frees old', entry: H.asg, want: 'p',
    buf: (w) => { w(BUF, str(w, BUF + 0x100, 1, 'old')); str(w, BUF + 0x200, 1, 'new'); },
    regs: { eax: BUF, edx: BUF + 0x208 } },
  { name: 'FinalizeArray 0', entry: H.farr, want: 'n', buf: () => {}, regs: { eax: BUF, edx: ANSI, ecx: 0 } },
  { name: 'FinalizeArray 1 str', entry: H.farr, want: 'n',
    buf: (w) => { w(BUF, str(w, BUF + 0x100, 5, 's')); }, regs: { eax: BUF, edx: ANSI, ecx: 1 } },
  { name: 'FinalizeArray 1 str last', entry: H.farr, want: 'p',
    buf: (w) => { w(BUF, str(w, BUF + 0x100, 1, 's')); }, regs: { eax: BUF, edx: ANSI, ecx: 1 } },
  { name: 'LStrAsg frees old, nil src', entry: H.asg, want: 'p',
    buf: (w) => { w(BUF, str(w, BUF + 0x100, 1, 'old')); }, regs: { eax: BUF, edx: 0 } },
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

async function delphiCases() {
  if (!fs.existsSync(EXE)) { console.log('SKIP delphi: ' + path.relative(ROOT, EXE) + ' absent'); return; }
  const img = peImage(EXE);
  const off = await delphiInstance(img, 0);
  const on = await delphiInstance(img, 8);
  for (const c of CASES) {
    layoutBuf(off, c.buf); layoutBuf(on, c.buf);
    const n0 = on.e.fold_stat(0), f0 = on.e.fold_stat(1), p0 = on.e.fold_stat(4);
    const a = call(off, c.entry, c.regs), b = call(on, c.entry, c.regs);
    const dn = on.e.fold_stat(0) - n0, df = on.e.fold_stat(1) - f0, dp = on.e.fold_stat(4) - p0;
    const diffs = [];
    if (!a.ok || !b.ok) diffs.push('did not return');
    for (const k of ['eip', 'flags', ...REGS]) if (a[k] !== b[k]) diffs.push(`${k} ${a[k].toString(16)} vs ${b[k].toString(16)}`);
    if (a.mem !== b.mem) diffs.push('memory differs');
    if (c.want === 'n' && (dn < 1 || df)) diffs.push(`want native, got native=${dn} fallback=${df}`);
    if (c.want === 'f' && df < 1) diffs.push(`want fallback, got native=${dn} fallback=${df}`);
    if (c.want === 'p' && (dp < 1 || df)) diffs.push(`want partial, got partial=${dp} fallback=${df}`);
    if (c.want === 'n' && dp) diffs.push(`want native, got partial=${dp}`);
    console.log(`${c.name.padEnd(28)} ${diffs.length ? 'FAIL ' + diffs.join(', ') : 'ok'} (native=${dn} partial=${dp} fallback=${df})`);
    if (diffs.length) fails++;
  }
  // A patched body is not the System unit any more: a fresh instance with one
  // byte of LStrClr changed (outside the masked rel32) must decode as plain
  // guest code.
  const pat = await delphiInstance(img, 8);
  pat.mem[pat.g2w(H.clr + 0x10)] ^= 0x01;
  layoutBuf(pat, (w) => { w(BUF, str(w, BUF + 0x100, 2, 'abc')); });
  const n0 = pat.e.fold_stat(0) + pat.e.fold_stat(1);
  call(pat, H.clr, { eax: BUF });
  const n1 = pat.e.fold_stat(0) + pat.e.fold_stat(1);
  if (n1 !== n0) fail(`patched LStrClr still matched (${n1 - n0} HLE calls)`);
  else console.log('patched body declines          ok');
}

// ---- A/B/C on the uop tier ------------------------------------------------
const d32 = (v) => [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];
function relCall(at, to) { const r = to - (at + 5); return [0xE8, ...d32(r)]; }

async function uopArm(name, arms, want) {
  const inst = await bench.newInstance();
  const { e, mem, g2w } = inst;
  const a = bench.layout(inst.imageBase, 0x20000);
  const code = a.code;
  // head: call f; dec ecx; jnz head; ret      f: add ebx,ecx; rep ret
  const f = code + 0x40;
  mem.set([...relCall(code, f), 0x49, 0x75, 0xF8, 0xC3], g2w(code));
  mem.set([0x01, 0xCB, 0xF3, 0xC3], g2w(f));
  e.set_fold_arms(arms);
  e.set_uop(1);
  const pc = e.uop_compile(code);
  const enters0 = e.uop_stats(4);
  e.set_ebx(0); e.set_ecx(3000);
  const ok = bench.runToCompletion(e, code, a.stackTop);
  const ebx = e.get_ebx() >>> 0, enters = e.uop_stats(4) - enters0;
  const errs = [];
  if (!ok) errs.push('did not return');
  if (ebx !== (3000 * 3001 / 2) >>> 0) errs.push(`ebx ${ebx}`);
  if (want && !pc) errs.push('did not compile');
  if (want && !enters) errs.push('never entered');
  console.log(`${name.padEnd(28)} ${errs.length ? 'FAIL ' + errs.join(', ') : 'ok'} (compiled=${pc ? 1 : 0} enters=${enters})`);
  if (errs.length) fails++;
}

// The branch clock is exact under A. The program's head is a loop; one path
// closes it, the other calls f from three sites, so f's RET has three
// candidate return addresses -- more than the compiler dispatches on -- and A
// lowers it as an exit at the RET, taken on every call. One batch of every budget 1..80 must stop on the same
// instruction with the same registers as arm 0 (where that RET is unsupported).
// A phantom charge shifts where a batch ends. NOTE: this shape does not
// reproduce the one clock bug found so far (a charged JMP to the deopt stub at
// A's RET exit, 4.8x the blocks per batch in Heroes II; it passes with that
// bug put back) -- whole-run equality of API calls, blocks and presents
// across arms 0/1/3/7 under --branch-clock is what guards that.
async function armAClock() {
  const state = async (arms, budget) => {
    const inst = await bench.newInstance();
    const { e, mem, g2w } = inst;
    const a = bench.layout(inst.imageBase, 0x20000);
    // L:    dec esi; jz done; test esi,3; jnz skip; call f; call f; call f
    // skip: jmp L      done: ret
    // f:    add ebx,ecx; inc ecx; ret   (three return addresses: A exits at the RET)
    const f = a.code + 0x40, c = a.code;
    mem.set([0x4E, 0x74, 0x19, 0xF7, 0xC6, 3, 0, 0, 0, 0x75, 0x0F,
      ...relCall(c + 0xB, f), ...relCall(c + 0x10, f), ...relCall(c + 0x15, f), 0xEB, 0xE4, 0xC3], g2w(c));
    mem.set([0x01, 0xCB, 0x41, 0xC3], g2w(f));
    e.set_fold_arms(arms); e.set_uop(1); e.set_branch_clock(1);
    e.uop_compile(c);
    // warm up: 2000 trips install the program (a compile alone does not)
    e.set_ebx(0); e.set_ecx(0); e.set_esi(2000);
    bench.runToCompletion(e, a.code, a.stackTop);
    const enters0 = e.uop_stats(4);
    e.set_esp(a.stackTop);
    new DataView(e.memory.buffer).setUint32(g2w(a.stackTop), 0, true);
    e.set_ebx(0); e.set_ecx(0); e.set_esi(40); e.set_eip(a.code);
    e.run(budget);
    if (arms) entersA += e.uop_stats(4) - enters0;
    return `eip=${(e.get_eip() >>> 0).toString(16)} ebx=${e.get_ebx()} ecx=${e.get_ecx()} esi=${e.get_esi()} esp=${(e.get_esp() >>> 0).toString(16)}`;
  };
  let entersA = 0;
  const bad = [];
  for (let b = 1; b <= 80; b++) {
    const s0 = await state(0, b), s1 = await state(1, b);
    if (s0 !== s1) bad.push(`budget ${b}: arm0 ${s0} / armA ${s1}`);
  }
  if (!entersA) fail('A branch clock: the program was never entered');
  else if (bad.length) fail(`A branch clock: ${bad.length} budgets differ, ${bad.slice(0, 3).join('; ')}`);
  else console.log(`${'A branch clock exact'.padEnd(28)} ok (budgets 1..80, A enters=${entersA})`);
}

async function armC() {
  const inst = await bench.newInstance();
  const { e, mem, g2w } = inst;
  const a = bench.layout(inst.imageBase, 0x20000);
  const dv = () => new DataView(e.memory.buffer);
  // A dword inside the image's first section (notepad .text, not writable).
  const ro = inst.imageBase + 0x1010;
  const orig = dv().getUint32(g2w(ro), true);
  const code = a.code;
  // head: mov eax,[ro]; add ebx,eax; dec ecx; jnz head; ret
  mem.set([0xA1, ...d32(ro), 0x01, 0xC3, 0x49, 0x75, 0xF6, 0xC3], g2w(code));
  // poke: mov [ro],edx; ret
  const poke = code + 0x100;
  mem.set([0x89, 0x15, ...d32(ro), 0xC3], g2w(poke));
  e.set_fold_arms(4);
  e.set_uop(1);
  const folds0 = e.fold_stat(2);
  const pc = e.uop_compile(code);
  const errs = [];
  if (!pc) errs.push('did not compile');
  if (e.fold_stat(2) === folds0) errs.push('no load was folded');
  const run = (n) => { e.set_ebx(0); e.set_ecx(n); bench.runToCompletion(e, code, a.stackTop); return e.get_ebx() >>> 0; };
  const r1 = run(1000);
  if (r1 !== Math.imul(orig, 1000) >>> 0) errs.push(`first run ${r1.toString(16)}`);
  const kills0 = e.uop_stats(3);
  e.set_edx(0x1234567);
  bench.runToCompletion(e, poke, a.stackTop);
  if (dv().getUint32(g2w(ro), true) !== 0x1234567) errs.push('store did not land');
  if (e.uop_stats(3) === kills0) errs.push('store to a folded dword killed nothing');
  const r2 = run(1000);
  if (r2 !== Math.imul(0x1234567, 1000) >>> 0) errs.push(`after store ${r2.toString(16)} (stale constant)`);
  console.log(`${'C fold + write kills'.padEnd(28)} ${errs.length ? 'FAIL ' + errs.join(', ') : 'ok'} (folds=${e.fold_stat(2) - folds0})`);
  if (errs.length) fails++;
  // A writable-section dword is never folded.
  const inst2 = await bench.newInstance();
  inst2.e.set_fold_arms(4); inst2.e.set_uop(1);
  const b2 = bench.layout(inst2.imageBase, 0x20000);
  inst2.mem.set([0xA1, ...d32(b2.buf), 0x01, 0xC3, 0x49, 0x75, 0xF6, 0xC3], inst2.g2w(b2.code));
  const f0 = inst2.e.fold_stat(2);
  inst2.e.uop_compile(b2.code);
  if (inst2.e.fold_stat(2) !== f0) fail('C folded a load outside a read-only section');
  else console.log('C writable data not folded       ok');
}

async function main() {
  bench.ensureBuilt();
  await delphiCases();
  await uopArm('A rep ret (arm off)', 0, false);
  await uopArm('A rep ret', 1, true);
  await uopArm('B seams in fast loop', 3, true);
  await armAClock();
  await armC();
  if (fails) { console.log(`FAIL: ${fails}`); process.exit(1); }
  console.log('PASS');
}
main().catch((err) => { console.error(err.stack || String(err)); process.exit(1); });
