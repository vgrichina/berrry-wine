#!/usr/bin/env node
'use strict';
// Price --uop-sse on the hottest SSE blocks of Spelunky Classic HD, with the
// game's own bytes.
//
//   node tools/uop-sse-bench.js [--iters=N] [--reps=N] [--kernels=a,b] [--arms=threaded,uop,sse,fast,ssefast]
//                               [--wasm=FILE] [--json=FILE]
// (--wasm: e.g. a build with a name section, for a profile that names handlers)
//
// Each kernel is a straight run of real instructions cut out of
// SpelunkyClassicHD.exe (docs/re-notes/spelunky-classic-hd.md: the census's
// top SSE-holding blocks) and wrapped in a counted loop, so the block is the
// body of a loop the uop tier takes. The input state is synthetic but of the
// game's shape: small int16 coordinates where the code movsx-es words, finite
// floats near 1 where it loads singles, the same values every arm. The one
// absolute operand the blocks read ([0x821b7c], a float constant) is
// repointed into the bench buffer -- the game's data section is not mapped
// in a bench instance. Nothing else in the bytes is changed.
//
// Arms, interleaved per rep with the order rotated (bench-loops' method),
// each at its own code address:
//   threaded   the uop tier off
//   uop        the tier as it ships (SSE instructions end a program's region
//              or decline the loop: whatever 07e does with them by default)
//   sse        the tier with --uop-sse (07e kind 34)
//   fast       threaded with --sse-fast (06c dedicated handlers 502-511)
//   ssefast    --uop-sse and --sse-fast together
// Every arm's final registers, flags and a hash of the buffer (the kernels
// store into it, and the XMM file is stored after the loop) must equal the
// threaded arm's. Reported: min and median ns per loop iteration, and the
// uop counters the run moved (enters, blocks, kind-34 sites, window-miss
// services).
const fs = require('fs');
const path = require('path');
const BL = require('./bench-loops');
const ROOT = path.join(__dirname, '..');
const EXE = path.join(ROOT, 'test/binaries/candidates/spelunky-classic-hd/extracted-1.1.7/SpelunkyClassicHD.exe');

const args = Object.fromEntries(process.argv.slice(2).map((s) => {
  const m = s.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] === undefined ? true : m[2]] : [s, true];
}));
const ITERS = +(args.iters || 200000);
const REPS = +(args.reps || 7);

// ---- PE file reading: VA range -> bytes ----
function sliceVA(pe, va0, va1) {
  const dv = new DataView(pe.buffer, pe.byteOffset);
  const lfa = dv.getUint32(0x3C, true);
  const nsec = dv.getUint16(lfa + 6, true);
  const optSize = dv.getUint16(lfa + 20, true);
  const base = dv.getUint32(lfa + 24 + 28, true);
  for (let k = 0; k < nsec; k++) {
    const s = lfa + 24 + optSize + 40 * k;
    const rva = dv.getUint32(s + 12, true), raw = dv.getUint32(s + 20, true), rawSize = dv.getUint32(s + 16, true);
    if (va0 - base >= rva && va1 - base <= rva + rawSize) {
      return Array.from(pe.subarray(raw + (va0 - base - rva), raw + (va1 - base - rva)));
    }
  }
  throw new Error(`VA 0x${va0.toString(16)} not in a section`);
}
// Replace every 4-byte little-endian occurrence of `from` with `to`.
function repoint(bytes, from, to) {
  let n = 0;
  for (let k = 0; k + 4 <= bytes.length; k++) {
    if (bytes[k] === (from & 0xFF) && bytes[k + 1] === ((from >>> 8) & 0xFF) &&
        bytes[k + 2] === ((from >>> 16) & 0xFF) && bytes[k + 3] === (from >>> 24)) {
      bytes.splice(k, 4, to & 0xFF, (to >>> 8) & 0xFF, (to >>> 16) & 0xFF, to >>> 24);
      n++;
    }
  }
  return n;
}
const d32 = (v) => [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];
const movImm = (r, v) => [0xB8 + r, ...d32(v)];                   // mov r32, imm32
const R = { eax: 0, ecx: 1, edx: 2, ebx: 3, esp: 4, ebp: 5, esi: 6, edi: 7 };
// movss xmmK, [abs]
const movssAbs = (k, a) => [0xF3, 0x0F, 0x10, 0x05 | (k << 3), ...d32(a)];
// movups [abs + 16K], xmmK for K = 0..7
const saveXmm = (a) => [0, 1, 2, 3, 4, 5, 6, 7].flatMap((k) => [0x0F, 0x11, 0x05 | (k << 3), ...d32(a + 16 * k)]);
const CONST_VA = 0x821b7c;

// Each kernel: real bytes [from, to), the registers it reads as pointers,
// the counter register it leaves alone, and a small fixup appended to the
// body (the stack or pointer adjustment the cut-out code expects undone).
// Layout (offsets from a.buf): +0 int16 words (edi), +0x100 floats (ebx),
// +0x300 the repointed constant, +0x400 the stack frame, +0x1000 dest (esi /
// eax), +0x3000 the int inputs, +0x4000 saved XMM file.
const KERNELS = {
  // exe+0x4358b1: 110 insns / 86 SSE, the census's top block (title 3.5M
  // weighted SSE insns): float matrix setup, cvtss2sd/addsd/cvtsd2ss chains
  // and 3x-replicated movss stores. Counter EBP (the block only stores it).
  'm4358b1': {
    from: 0x4358b1, to: 0x435a81, counter: 'ebp',
    regs: (a) => ({ esi: a.buf + 0x1000, edi: a.buf, ebx: a.buf + 0x100 }),
    xmm: [0x3F99999A, 0x3FC00000],                      // 1.2f, 1.5f
    frame: true,
  },
  // exe+0x438468: 62 insns / 48 SSE, a mesh-vertex loop's body (EAX walks
  // the output 0x90 a pass: put back each iteration). Counter ECX.
  'm438468': {
    from: 0x438468, to: 0x438587, counter: 'ecx',
    regs: (a) => ({ eax: a.buf + 0x1000, edi: a.buf, esi: a.buf + 0x200, ebx: 0x12345, ebp: 0x23456 }),
    xmm: [0x3F99999A, 0x3FC00000, 0x40000000, 0x40400000, 0x3F000000, 0xBF800000, 0x41200000, 0],
    fix: [[0x2D, ...d32(0x90)], [0x83, 0xC6, 0x06]],     // sub eax, 0x90; add esi, 6
    frame: true,
  },
  // exe+0x4d3bf5: 17 insns / 14 SSE, single<->double adds feeding a call's
  // stack arguments (the call itself is not cut: add esp, 8 undoes the
  // sub). Counter EBP.
  'm4d3bf5': {
    from: 0x4d3bf5, to: 0x4d3c41, counter: 'ebp',
    regs: (a) => ({ esi: a.buf + 0x100 - 0xB4 }),
    xmm: [],
    fix: [[0x83, 0xC4, 0x08]],
    frame: true,
  },
  // exe+0x4c78e1: 22 insns / 21 SSE, int->single->double distance math
  // ending in COMISD; the flags are folded into EBX (seta bl / add edi, ebx)
  // instead of the game's ja. Counter ECX.
  'm4c78e1': {
    from: 0x4c78e1, to: 0x4c7935, counter: 'ecx',
    regs: () => ({ ebp: 17, esi: 5, eax: -9, edx: 40 }),
    xmm: [0, 0x40400000, 0x41A00000],
    fix: [[0x0F, 0x97, 0xC3], [0x01, 0xDF]],
    frame: false,
  },
};

function build(k, a, pe) {
  const body = sliceVA(pe, k.from, k.to);
  const hits = repoint(body, CONST_VA, a.buf + 0x300);
  const code = [];
  // xmm entry state, then the regs, then the frame
  k.xmm.forEach((v, i) => code.push(...movssAbs(i, a.buf + 0x3000 + 4 * i)));
  for (const [r, v] of Object.entries(k.regs(a))) code.push(...movImm(R[r], v >>> 0));
  code.push(...movImm(R[k.counter], ITERS));
  if (k.frame) code.push(0x81, 0xEC, ...d32(0x80));         // sub esp, 0x80
  const head = code.length;
  code.push(...body, ...(k.fix || []).flat());
  code.push(0x48 + R[k.counter]);                          // dec counter
  const rel = head - (code.length + 6);
  code.push(0x0F, 0x85, ...d32(rel));                      // jnz head
  if (k.frame) code.push(0x81, 0xC4, ...d32(0x80));        // add esp, 0x80
  code.push(...saveXmm(a.buf + 0x4000), 0xC3);
  return { bytes: code, hits, insnBytes: body.length };
}

function seed(mem, g2w, a, k) {
  const b = g2w(a.buf);
  mem.fill(0, b, b + 0x6000);
  const dv = new DataView(mem.buffer, mem.byteOffset);
  for (let i = 0; i < 64; i++) dv.setInt16(b + 2 * i, ((i * 37) % 200) - 100, true);
  for (let i = 0; i < 64; i++) dv.setFloat32(b + 0x100 + 4 * i, 0.5 + i / 64, true);
  dv.setFloat32(b + 0x300, 1.0, true);
  k.xmm.forEach((v, i) => dv.setUint32(b + 0x3000 + 4 * i, v, true));
}
// the stack frame the cut-out code reads ([esp+0x18..0x68])
function seedStack(mem, g2w, a) {
  const dv = new DataView(mem.buffer, mem.byteOffset);
  const top = g2w(a.stackTop - 0x80);
  for (let i = 0; i < 0x20; i++) dv.setFloat32(top + 4 * i, 0.25 + i / 8, true);
  dv.setUint32(top + 0x18, 0x3F800000, true);
}
function hashBuf(mem, g2w, a) {
  let h = 0x811C9DC5;
  const s = g2w(a.buf);
  for (let k = 0; k < 0x5000; k++) h = Math.imul(h ^ mem[s + k], 16777619);
  return h >>> 0;
}

const REGS = ['eax', 'ecx', 'edx', 'ebx', 'ebp', 'esi', 'edi'];
function runArm(inst, a, k, built, arm, codeAddr) {
  const { e, mem, g2w } = inst;
  seed(mem, g2w, a, k);
  seedStack(mem, g2w, a);
  mem.set(built.bytes, g2w(codeAddr));
  e.set_uop(arm === 'threaded' || arm === 'fast' ? 0 : 1);
  e.set_uop_sse(arm === 'sse' || arm === 'ssefast' ? 1 : 0);
  if (e.set_sse_fast) e.set_sse_fast(arm === 'fast' || arm === 'ssefast' ? 1 : 0);
  e.set_uop_trace_heads(0);
  for (const r of REGS) e['set_' + r](0);
  e.set_esp(a.stackTop);
  new DataView(mem.buffer, mem.byteOffset).setUint32(g2w(a.stackTop), 0, true);
  e.set_eip(codeAddr);
  const c0 = { enters: e.uop_stats(4), blocks: e.uop_stats(5), sites: e.uop_cstat(37), svcs: e.uop_sse_svcs() >>> 0 };
  const t0 = process.hrtime.bigint();
  let n = 0;
  while ((e.get_eip() >>> 0) !== 0 && n < 1e6) { e.run(100000); n++; }
  const ns = Number(process.hrtime.bigint() - t0);
  const st = {
    ns, nsPerIter: ns / ITERS, regs: REGS.map((r) => e['get_' + r]() >>> 0).join(','), flags: e.uop_flags(),
    mem: hashBuf(mem, g2w, a), ok: (e.get_eip() >>> 0) === 0,
    enters: e.uop_stats(4) - c0.enters, blocks: e.uop_stats(5) - c0.blocks,
    sites: e.uop_cstat(37) - c0.sites, svcs: (e.uop_sse_svcs() >>> 0) - c0.svcs,
  };
  e.set_uop_sse(0);
  if (e.set_sse_fast) e.set_sse_fast(0);
  return st;
}

async function main() {
  BL.ensureBuilt();
  const pe = fs.readFileSync(EXE);
  const inst = await (args.wasm ? BL.newInstance(path.resolve(String(args.wasm))) : BL.newInstance());
  const a = BL.layout(inst.imageBase, 0x10000);
  const e = inst.e;
  const names = args.kernels ? String(args.kernels).split(',') : Object.keys(KERNELS);
  const arms = args.arms ? String(args.arms).split(',') : ['threaded', 'uop', 'sse'];
  const out = { iters: ITERS, reps: REPS, node: process.version, kernels: {} };
  let slot = 0, fails = 0;
  for (const name of names) {
    const k = KERNELS[name];
    const built = build(k, a, pe);
    const addr = {};
    for (const arm of arms) addr[arm] = a.code + 0x1000 * slot++;
    const runs = Object.fromEntries(arms.map((x) => [x, []]));
    for (let r = 0; r < REPS + 1; r++) {
      const order = arms.map((_, i) => arms[(i + r) % arms.length]);
      for (const arm of order) {
        const st = runArm(inst, a, k, built, arm, addr[arm]);
        if (r > 0) runs[arm].push(st);          // rep 0 warms (decode, install)
      }
    }
    const ref = (runs.threaded || runs[arms[0]])[0];
    const row = { from: '0x' + k.from.toString(16), bytes: built.insnBytes, repointed: built.hits };
    for (const arm of arms) {
      const v = runs[arm].map((s) => s.nsPerIter).sort((x, y) => x - y);
      const bad = runs[arm].filter((s) => !s.ok || s.regs !== ref.regs || s.flags !== ref.flags || s.mem !== ref.mem);
      if (bad.length) fails++;
      const last = runs[arm][runs[arm].length - 1];
      row[arm] = { min: +v[0].toFixed(1), med: +v[v.length >> 1].toFixed(1), same: !bad.length,
        enters: last.enters, blocks: last.blocks, sites: last.sites, svcs: last.svcs };
    }
    out.kernels[name] = row;
    const f = (x) => `${x} ${row[x].min.toFixed(1)}/${row[x].med.toFixed(1)}${row[x].same ? '' : ' DIFF'}`;
    const g = (x) => `${x} enters=${row[x].enters} blocks=${row[x].blocks}` + (x === 'sse' || x === 'ssefast' ? ` sites=${row[x].sites} svcs=${row[x].svcs}` : '');
    console.log(`${name} (${row.bytes}B)  ns/iter min/med  ${arms.map(f).join('  ')}  | ${arms.filter((x) => x !== 'threaded').map(g).join('  ')}`);
  }
  if (args.json) fs.writeFileSync(args.json, JSON.stringify(out, null, 1) + '\n');
  if (fails) { console.log(`FAIL: ${fails} arm(s) differ from threaded`); process.exit(1); }
}
main().catch((err) => { console.error(err.stack || String(err)); process.exit(1); });
