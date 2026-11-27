#!/usr/bin/env node
'use strict';

// Differential fuzz for the H451 x87 island body.
//
// $x87_island_fast (07b-loop-match.wat) keeps TOP, the two tag bytes and
// ST(0) in locals and dispatches each op through a br_table instead of
// calling $fpu_exec_mem/$fpu_exec_reg. Its contract is to be bit-identical to
// $x87_island_generic, the per-op walk it replaced, which is what
// --no-x87-island-predecode selects. This test runs random x87 sequences --
// every form the fast body inlines, plus a sprinkling of the ones it hands to
// the generic arm (FLDENV/FNSTENV/FRSTOR/FNSAVE, m80, BCD, FXAM, FCMOV,
// transcendentals, FNINIT/FNCLEX) -- through three arms of one instance:
//
//   fast     island family only, $x87_island_fast
//   generic  island family only, $x87_island_generic
//   plain    no x87 folding at all: the ordinary H188/H189/H190 handlers
//
// and requires, after every sequence, byte-identical FPU_FILE (all eight f64
// payloads and exact-integer shadows), TOP, tag bytes, status and control
// words, the guest scratch buffer, EAX and the lazy EFLAGS record, and the
// same --trace-fpu event stream (so sticky exception flags are raised at the
// same points and in the same order).
//
// Each sequence starts from an FRSTOR of a random image: random TOP, random
// valid/empty tags (so push overflow and pop underflow both fire), random
// rounding control, and register payloads drawn from a pool of specials
// (signed zeros, infinities, NaNs, denormals, integer boundaries).

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createHostImports } = require('../lib/host-imports');
const { compileSrcWasm } = require('./compile-src');

const ROOT = path.join(__dirname, '..');
const CASES = Number(process.env.X87_FUZZ_CASES || 400);
const SEED = Number(process.env.X87_FUZZ_SEED || 0x5eed87);

const wasm = compileSrcWasm((file, source) => file === '13-exports.wat' ? source + `
  (func (export "test_g2w") (param $guest i32) (result i32)
    (call $g2w (local.get $guest)))
  (func (export "test_fpu_base") (result i32) (global.get $fpu_base))
  (func (export "test_fpu_raw_tag") (result i32) (global.get $fpu_raw_tag))
  (func (export "test_fpu_cw") (result i32) (global.get $fpu_cw))
` : source);
const exe = fs.readFileSync(path.join(ROOT, 'test', 'binaries', 'notepad.exe'));

// mulberry32
let seed = SEED >>> 0;
function rnd() {
  seed = (seed + 0x6D2B79F5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ri = n => Math.floor(rnd() * n);
const pick = a => a[ri(a.length)];

const le32 = v => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];

const SPECIAL_BITS = [
  0x0000000000000000n, 0x8000000000000000n, 0x7FF0000000000000n, 0xFFF0000000000000n,
  0x7FF8000000000000n, 0xFFF8000000000123n, 0x7FF4000000000001n, 0x0000000000000001n,
  0x800FFFFFFFFFFFFFn, 0x41E0000000000000n /* 2^31 */, 0xC1E0000000200000n,
  0x43E0000000000000n /* 2^63 */, 0x40DFFFE666666666n /* ~32767.6 */,
  0x3FF0000000000000n, 0xBFF0000000000000n, 0x3FE0000000000000n,
  0x3FF8000000000000n /* 1.5 */, 0x4004000000000000n /* 2.5 */,
];
function randomF64Bits() {
  const k = ri(10);
  const b = new DataView(new ArrayBuffer(8));
  if (k < 3) return pick(SPECIAL_BITS);
  if (k < 6) b.setFloat64(0, (rnd() - 0.5) * Math.pow(10, ri(12) - 3));
  else if (k < 8) b.setFloat64(0, Math.round((rnd() - 0.5) * 2 ** (ri(40) + 1)));
  else if (k < 9) b.setFloat64(0, (ri(64) - 32) / 4);
  else b.setFloat64(0, (rnd() - 0.5) * 1e300);
  return b.getBigUint64(0);
}

function fillBuffer(dv, w) {
  for (let off = 0; off < 512; off += 8) {
    const k = ri(6);
    if (k === 0) {
      dv.setFloat32(w + off, (rnd() - 0.5) * 1000, true);
      dv.setFloat32(w + off + 4, pick([0, -0, Infinity, NaN, 1.5, -3, 1e-40, 65536.5]), true);
    } else if (k === 1) {
      dv.setInt32(w + off, (ri(2 ** 16) - 2 ** 15) * pick([1, 1, 7, 65536]), true);
      dv.setInt16(w + off + 4, ri(65536) - 32768, true);
      dv.setInt16(w + off + 6, pick([0, 1, -1, 32767, -32768]), true);
    } else if (k === 2) {
      for (let i = 0; i < 8; i++) dv.setUint8(w + off + i, ri(256));
    } else {
      dv.setBigUint64(w + off, randomF64Bits(), true);
    }
  }
}

// FRSTOR image: 28-byte env + 8 x 10-byte registers. Each register is its
// f64 bits followed by a zero sign/exponent word, which $fpu_load_m80 reads
// back as that exact f64 (its compatibility path).
function fillState(dv, w) {
  const rc = ri(4);
  const cw = pick([0x007F, 0x027F, 0x037F]) | (rc << 10);
  const top = ri(8);
  const sw = (top << 11) | (ri(4) === 0 ? ri(0x40) : 0) | pick([0, 0x4000, 0x0100, 0x4500]);
  let tw = 0;
  for (let i = 0; i < 8; i++) if (ri(3) === 0) tw |= 3 << (i * 2);
  for (let i = 0; i < 28; i++) dv.setUint8(w + i, 0);
  dv.setUint32(w, cw, true);
  dv.setUint32(w + 4, sw, true);
  dv.setUint32(w + 8, tw, true);
  for (let i = 0; i < 8; i++) {
    dv.setBigUint64(w + 28 + i * 10, randomF64Bits(), true);
    dv.setUint16(w + 28 + i * 10 + 8, 0, true);
  }
}

// ---- instruction generators ------------------------------------------
// Memory operands: [esi+disp8] (H190) or [abs32] (H188). The scratch buffer
// is 512 bytes at DATA; the environment/save forms use the upper half.
let DATA = 0;
function memOperand(reg, width) {
  const limit = 256 - width;
  const disp = ri(4) === 0 ? ri(limit) : (ri(limit >> 3) << 3);
  if (ri(3) === 0) return [(0 << 6) | (reg << 3) | 5, ...le32((DATA + disp) >>> 0)];
  // ESI = DATA+128, so the signed disp8 reaches DATA..DATA+255.
  return [(1 << 6) | (reg << 3) | 6, (disp - 128) & 255];
}
const absHigh = reg => [(reg << 3) | 5, ...le32((DATA + 0x100 + ri(8) * 4) >>> 0)];
const regForm = (op, reg, i) => [op, 0xC0 | (reg << 3) | i];

const common = [
  // D8/DA/DC/DE memory arithmetic, every reg (FADD..FDIVR, FCOM, FCOMP)
  () => [0xD8, ...memOperand(ri(8), 4)],
  () => [0xDA, ...memOperand(ri(8), 4)],
  () => [0xDC, ...memOperand(ri(8), 8)],
  () => [0xDE, ...memOperand(ri(8), 2)],
  // loads
  () => [0xD9, ...memOperand(0, 4)],
  () => [0xDD, ...memOperand(0, 8)],
  () => [0xDB, ...memOperand(0, 4)],
  () => [0xDF, ...memOperand(0, 2)],
  () => [0xDF, ...memOperand(5, 8)],
  // stores
  () => [0xD9, ...memOperand(pick([2, 3]), 4)],
  () => [0xDD, ...memOperand(pick([2, 3]), 8)],
  () => [0xDB, ...memOperand(pick([2, 3]), 4)],
  () => [0xDF, ...memOperand(pick([2, 3]), 2)],
  () => [0xDF, ...memOperand(7, 8)],
  // control/status words
  () => [0xD9, ...memOperand(7, 2)],
  () => [0xDD, ...memOperand(7, 2)],
  // register forms
  () => regForm(0xD8, ri(8), ri(8)),
  () => regForm(0xD9, 0, ri(8)),                    // FLD ST(i)
  () => regForm(0xD9, 1, ri(8)),                    // FXCH
  () => [0xD9, pick([0xE0, 0xE1, 0xE4])],           // FCHS FABS FTST
  () => [0xD9, 0xE8 + ri(7)],                       // constants
  () => [0xD9, pick([0xFA, 0xFC, 0xF6, 0xF7, 0xD0])], // FSQRT FRNDINT FDECSTP FINCSTP FNOP
  () => regForm(0xDC, pick([0, 1, 4, 5, 6, 7]), ri(8)),
  () => regForm(0xDD, pick([0, 2, 3, 4, 5]), ri(8)),
  () => regForm(0xDE, pick([0, 1, 4, 5, 6, 7]), ri(8)),
  () => [0xDE, 0xD9],                               // FCOMPP
  () => regForm(0xDB, pick([5, 6]), ri(8)),         // FUCOMI FCOMI
  () => regForm(0xDF, pick([5, 6]), ri(8)),         // FUCOMIP FCOMIP
  () => [0xDF, 0xE0],                               // FNSTSW AX
];
// Forms the fast body sends to the generic arm, kept rarer.
const rare = [
  () => [0xD9, ...memOperand(5, 2)],                // FLDCW (random word)
  () => [0xD9, ...absHigh(pick([4, 6]))],           // FLDENV / FNSTENV
  () => [0xDD, ...absHigh(pick([4, 6]))],           // FRSTOR / FNSAVE
  () => [0xDB, ...memOperand(pick([5, 7]), 10)],    // FLD / FSTP m80
  () => [0xDF, ...memOperand(pick([4, 6]), 10)],    // FBLD / FBSTP
  () => [0xD9, 0xE5],                               // FXAM
  () => [0xD9, pick([0xF0, 0xF1, 0xF2, 0xF3, 0xF4, 0xF5, 0xF8, 0xF9, 0xFB, 0xFD, 0xFE, 0xFF])],
  () => regForm(0xDA, ri(3), ri(8)),                // FCMOVB/E/BE
  () => regForm(0xDB, ri(3), ri(8)),                // FCMOVNB/NE/NBE
  () => [0xDA, 0xE9],                               // FUCOMPP
  () => [0xDB, pick([0xE2, 0xE3])],                 // FNCLEX / FNINIT
];

function genSequence() {
  const n = 3 + ri(ri(3) === 0 ? 60 : 14);
  const out = [];
  // Occasionally lead with a SIB form: H188 with $SIB_SENTINEL, legal only
  // as an island's first op. [esi+ecx*1+disp8], ecx = 8.
  if (ri(5) === 0) {
    out.push([pick([0xD9, 0xDD, 0xD8, 0xDC]), (1 << 6) | (0 << 3) | 4, 0x0E, ri(16) * 8]);
  }
  while (out.length < n) out.push(ri(12) === 0 ? pick(rare)() : pick(common)());
  return out;
}

// ---- one instance, three arms per case ------------------------------------
async function main() {
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { exports: null, getMemory: () => memory.buffer };
  const host = createHostImports(ctx).host;
  let logs = [];
  Object.assign(host, { memory, exit() {}, log() {}, log_i32(v) { logs.push(v >>> 0); },
    crash_unimplemented() {}, wait_multiple: () => 0, shell_execute: () => 33 });
  const { instance } = await WebAssembly.instantiate(wasm, { host });
  ctx.exports = instance.exports;
  const e = instance.exports;
  const mem = new Uint8Array(memory.buffer);
  const dv = new DataView(memory.buffer);
  mem.set(exe, e.get_staging());
  assert(e.load_pe(exe.length), 'fixture PE must load');
  const g2w = ga => e.test_g2w(ga) >>> 0;

  const imageBase = e.get_image_base() >>> 0;
  DATA = (imageBase + 0x50000) >>> 0;
  const stateAddr = (imageBase + 0x51000) >>> 0;
  const stack = (imageBase + 0xD00000) >>> 0;
  let codeCursor = (imageBase + 0x100000) >>> 0;

  e.set_fpu_trace(1);
  e.set_x87_affine_fusion(0);
  e.set_x87_fuse_debug(16, 0, -1);   // the island family alone

  const bufImage = new Uint8Array(512);
  const stateImage = new Uint8Array(108);
  const fileImage = new Uint8Array(128);

  function runArm(bytes, arm) {
    // identical starting world for every arm
    mem.set(bufImage, g2w(DATA));
    mem.set(stateImage, g2w(stateAddr));
    const fb = e.test_fpu_base() >>> 0;
    mem.set(fileImage, fb);
    e.set_x87_pipeline4_fusion(arm === 'plain' || arm === 'nodirect' ? 0 : 1);
    e.set_x87_island_predecode(arm === 'fast' ? 1 : 0);
    // 'nodirect': the plain walk with 06 $fpu_exec_mem's direct-f64 memory
    // forms off (--no-fpu-direct), so the inline forms meet the calls they
    // replaced on every random state, empty and full slots included
    e.set_fpu_direct(arm === 'nodirect' ? 0 : 1);
    const code = codeCursor;
    codeCursor = (codeCursor + 0x400) >>> 0;
    const prologue = [0xDD, 0x25, ...le32(stateAddr), 0x39, 0xDA];  // frstor [state]; cmp edx,ebx
    // (the CMP gives FCMOVcc the same EFLAGS in every arm: the lazy flags
    // otherwise carry over from whichever arm ran before)
    const epilogue = [0x89, 0xD2, 0xC3];                             // mov edx,edx; ret
    mem.set([...prologue, ...bytes, ...epilogue], g2w(code));
    dv.setUint32(g2w(stack), 0, true);
    e.set_eax(0x12345678); e.set_ecx(8); e.set_edx(0x10203040);
    e.set_ebx(caseEbx); e.set_ebp(0x66778899);
    e.set_esi((DATA + 128) >>> 0); e.set_edi(DATA); e.set_esp(stack); e.set_eip(code);
    logs = [];
    const runs0 = e.get_x87_island_runs() >>> 0;
    e.run(100000);
    assert.strictEqual(e.get_eip() >>> 0, 0, `${arm}: code must return`);
    return {
      islands: (e.get_x87_island_runs() >>> 0) - runs0,
      file: Buffer.from(mem.slice(fb, fb + 128)).toString('hex'),
      top: e.get_fpu_top(), tag: e.get_fpu_tags(), raw: e.test_fpu_raw_tag(),
      sw: e.get_fpu_sw(), cw: e.test_fpu_cw(),
      buf: Buffer.from(mem.slice(g2w(DATA), g2w(DATA) + 512)).toString('hex'),
      eax: e.get_eax() >>> 0,
      flags: [e.get_flag_res(), e.get_flag_op(), e.get_flag_a(), e.get_flag_b(),
        e.get_flag_sign_shift()].map(v => v >>> 0),
      // [0xCAF00001, bits, raised, eip] records; the arms run at different
      // code addresses, so the EIP is reported relative to this arm's code.
      trace: logs.map((v, i) => (i % 4 === 3 ? ((v - code) | 0) : v)).join(','),
    };
  }

  function compare(seq) {
    const bytes = seq.flat();
    const fast = runArm(bytes, 'fast');
    const generic = runArm(bytes, 'generic');
    const plain = runArm(bytes, 'plain');
    const nodirect = runArm(bytes, 'nodirect');
    if (generic.islands !== fast.islands) {
      return { fast, msg: `island count ${fast.islands} vs ${generic.islands}` };
    }
    for (const [name, ref] of [['generic', generic], ['plain', plain], ['nodirect', nodirect]]) {
      for (const key of ['file', 'top', 'tag', 'raw', 'sw', 'cw', 'buf', 'eax', 'flags', 'trace']) {
        const a = JSON.stringify(fast[key]);
        const b = JSON.stringify(ref[key]);
        if (a !== b) {
          return { fast, msg: `fast vs ${name} differ in ${key}\n  fast: ${a}\n  ${name}: ${b}\n` +
            `  fpu trace fast: ${fast.trace}\n  fpu trace ${name}: ${ref.trace}` };
        }
      }
    }
    return { fast, msg: null };
  }

  let caseEbx = 0;
  let islandsSeen = 0;
  let totalOps = 0;
  for (let c = 0; c < CASES; c++) {
    const caseSeed = seed;
    let seq = genSequence();
    totalOps += seq.length;
    fillBuffer(new DataView(bufImage.buffer), 0);
    fillState(new DataView(stateImage.buffer), 0);
    for (let i = 0; i < 128; i++) fileImage[i] = ri(256);
    caseEbx = pick([0x10203040, 0x10203041, 0x0F000000, 0x90000000]);
    let r = compare(seq);
    if (r.fast.islands > 0) islandsSeen++;
    if (r.msg) {
      // Shrink: drop ops one at a time while the case still fails. The
      // starting images are kept, so every retry starts from the same world.
      // First the shortest failing prefix, so the last op is the divergent one.
      for (let k = 1; k < seq.length; k++) {
        const t = compare(seq.slice(0, k));
        if (t.msg) { seq = seq.slice(0, k); r = t; break; }
      }
      for (let i = seq.length - 2; i >= 0; i--) {
        const trial = seq.slice(0, i).concat(seq.slice(i + 1));
        if (!trial.length) continue;
        const t = compare(trial);
        if (t.msg) { seq = trial; r = t; }
      }
      const hex = seq.map(ins => ins.map(x => x.toString(16).padStart(2, '0')).join(' '));
      assert.fail(`case ${c} (seed state 0x${caseSeed.toString(16)}): ${r.msg}\n` +
        `  ops (shrunk):\n    ${hex.join('\n    ')}`);
    }
  }
  assert.strictEqual(islandsSeen, 0, 'physical-image repair routes every sequence through ordinary x87');
  console.log(`PASS x87 island fast == generic == unfused: ${CASES} sequences, ` +
    `${totalOps} ops, ${islandsSeen} with islands`);
}

main().catch(err => { console.error(err && err.stack || err); process.exit(1); });
