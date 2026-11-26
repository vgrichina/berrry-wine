#!/usr/bin/env node
'use strict';

// WAT representation microbenchmarks: the module generator.
//
//   node tools/wat-microbench/gen.js --out=DIR [--wat2wasm=PATH] [--only=family]
//
// Writes DIR/<id>.wat, DIR/<id>.wasm and DIR/manifest.json. Each module is a
// standalone wasm (own memory, no imports) exporting `run(k) -> i32`: run k
// iterations of one FIXED guest workload, keep the state in the module between
// calls, and return a checksum of the whole architectural state. Every
// variant of one program performs the same guest work with a different
// representation, so their checksums must be identical; tools/wat-microbench/
// run.js refuses a row whose checksum disagrees with its control on any
// engine. The ids are `<family>.<program>.<variant>`; the control variant of
// each program is marked in the manifest, and `<control>~copy` is a byte-
// identical second copy of it, timed as a separate module, which is the null
// band.
//
// Families (docs/design/wat-representation-bench.md has the verdicts):
//   regs      guest registers: linear memory / globals / locals / i64 pairs;
//             narrow AL/AH/AX writes as store8/16 vs 32-bit merge
//   flags     lazy (op/a/b/res, today's) vs eager vs dead-flag elimination,
//             with lahf/sahf, adc, and fcom/fnstsw/sahf/jcc sequences
//   dispatch  threaded return_call_indirect (today's dispatch-next) vs one
//             br_table loop vs call_indirect loop vs a compiled region
//   memacc    g2w translation: inline / call g2w / call gl32 / hoisted /
//             page table, against an unchecked floor
//   sse       XMM file via $xmm_addr calls / inline memory / v128 locals /
//             v128 globals; scalar ss/sd through lanes vs whole-vector ops
//   lock      LOCK-prefixed RMW: today's i64 CAS loop vs atomic.rmw vs plain,
//             on shared and non-shared memory
//   encoding  interpreter op word: (handler, operand) pair (today's) vs one
//             packed word vs separate fields vs immediate-in-stream vs
//             pre-scaled register addresses
//   clock     block budget: two globals per block (today's) vs one global vs
//             local vs per instruction vs weighted vs per back edge vs none
//   ext       memory64 and multi-memory costs (where engines have them)
//
// The guest programs are generated from fixed seeds, so the modules are
// reproducible byte for byte (wat2wasm is deterministic).

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// ---------------------------------------------------------------------------
// layout (inside each standalone module; nothing to do with the emulator map)
const REGS = 0x100;     // 8 x i32 guest registers (memory register file)
const DATA = 0x1000;    // 4 KB scalar data window
const CODE = 0x2000;    // interpreter bytecode
const FDATA = 0x3000;   // 512 x f64
const XMM = 0x4000;     // 8 x v128
const XDATA = 0x5000;   // 4 KB float data for movaps
const CNT = 0x6000;     // 4 KB of lock counters
const PT = 0x8000;      // flat page table, indexed by guest page number
const GBASE = 0x10000;  // guest window base in linear memory
const IMG = 0x400000;   // guest image base
const GWIN = 0x100000;  // 1 MB guest window
const PAGES = 32;       // 2 MB memory
const OPS_PER_CALL = 1 << 20;

function rng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0);
  };
  return {
    u32: next,
    f: () => next() / 4294967296,
    int: (n) => next() % n,
    pick: (a) => a[next() % a.length],
  };
}

const hex = (n) => '0x' + (n >>> 0).toString(16);
const c32 = (n) => `(i32.const ${hex(n)})`;

// ---------------------------------------------------------------------------
// common module pieces

function memDecl({ shared = false, mem64 = false } = {}) {
  return `  (memory $m (export "mem") ${mem64 ? 'i64 ' : ''}${PAGES} ${PAGES}${shared ? ' shared' : ''})`;
}

// $mix: the checksum step. $fillw: deterministic LCG fill of `words` words.
// Address arithmetic in these helpers is i32; ext's memory64 variant gets its
// own copy (MEM64 flag) because its addresses are i64.
function commonFuncs(mem64 = false) {
  const A = (e) => (mem64 ? `(i64.extend_i32_u ${e})` : e);
  return `
  (global $inited (mut i32) (i32.const 0))
  (func $mix (param $h i32) (param $v i32) (result i32)
    (i32.mul (i32.rotl (i32.xor (local.get $h) (local.get $v)) (i32.const 13)) (i32.const 0x9E3779B1)))
  (func $fillw (param $a i32) (param $words i32) (param $s i32) (param $mask i32) (param $or i32)
    (block $d (loop $l
      (br_if $d (i32.eqz (local.get $words)))
      (local.set $s (i32.add (i32.mul (local.get $s) (i32.const 1664525)) (i32.const 1013904223)))
      (i32.store ${A('(local.get $a)')} (i32.or (i32.and (local.get $s) (local.get $mask)) (local.get $or)))
      (local.set $a (i32.add (local.get $a) (i32.const 4)))
      (local.set $words (i32.sub (local.get $words) (i32.const 1)))
      (br $l))))
  (func $hashw (param $h i32) (param $a i32) (param $words i32) (result i32)
    (block $d (loop $l
      (br_if $d (i32.eqz (local.get $words)))
      (local.set $h (call $mix (local.get $h) (i32.load ${A('(local.get $a)')})))
      (local.set $a (i32.add (local.get $a) (i32.const 4)))
      (local.set $words (i32.sub (local.get $words) (i32.const 1)))
      (br $l)))
    (local.get $h))`;
}

function moduleText(parts) {
  return `(module\n${parts.filter(Boolean).join('\n')}\n)\n`;
}

// The run wrapper every family shares: init once, prologue, k iterations of
// body, epilogue, checksum.
function runFunc({ locals = '', prologue = '', body, epilogue = '', checksum, loopLabel = '$L' }) {
  return `
  (func $run (export "run") (param $k i32) (result i32)
    ${locals}
    (if (i32.eqz (global.get $inited)) (then (call $init) (global.set $inited (i32.const 1))))
    (if (i32.le_s (local.get $k) (i32.const 0)) (then (return ${checksum})))
    ${prologue}
    (loop ${loopLabel}
${body}
      (br_if ${loopLabel} (local.tee $k (i32.sub (local.get $k) (i32.const 1)))))
    ${epilogue}
    ${checksum})`;
}

// ---------------------------------------------------------------------------
// family: regs

function regsProgram(narrow) {
  const r = rng(narrow ? 0x1111 : 0x2222);
  const ops = [];
  for (let i = 0; i < 48; i++) {
    const d = r.int(8), s = r.int(8);
    if (narrow && r.f() < 0.3) {
      const t = r.f();
      if (t < 0.4) ops.push({ k: 'movb', d: r.int(4), s });
      else if (t < 0.7) ops.push({ k: 'movh', d: r.int(4), s });
      else ops.push({ k: 'movw', d, s });
      continue;
    }
    const u = r.f();
    if (u < 0.25) ops.push({ k: 'add', d, s });
    else if (u < 0.40) ops.push({ k: 'sub', d, s });
    else if (u < 0.55) ops.push({ k: 'xori', d, imm: r.u32() });
    else if (u < 0.70) ops.push({ k: 'rol', d, c: 1 + r.int(31) });
    else if (u < 0.90) ops.push({ k: 'ld', d, s });
    else ops.push({ k: 'st', d, s });
  }
  return ops;
}

// A = { get(r), set(r, e), narrow?(kind, d, srcExpr) }, dataLoad/dataStore
// name the memory the DATA window lives in.
function emitRegOp(op, A) {
  const g = A.get, set = A.set;
  const dl = A.dataLoad || ((a) => `(i32.load offset=${DATA} ${a})`);
  const ds = A.dataStore || ((a, v) => `(i32.store offset=${DATA} ${a} ${v})`);
  const addr = (s) => `(i32.and ${g(s)} (i32.const 0xFFC))`;
  switch (op.k) {
    case 'add': return set(op.d, `(i32.add ${g(op.d)} ${g(op.s)})`);
    case 'sub': return set(op.d, `(i32.sub ${g(op.d)} ${g(op.s)})`);
    case 'xori': return set(op.d, `(i32.xor ${g(op.d)} ${c32(op.imm)})`);
    case 'rol': return set(op.d, `(i32.rotl ${g(op.d)} (i32.const ${op.c}))`);
    case 'ld': return set(op.d, dl(addr(op.s)));
    case 'st': return ds(addr(op.s), g(op.d));
    case 'movb':
      if (A.narrow) return A.narrow('b', op.d, g(op.s));
      return set(op.d, `(i32.or (i32.and ${g(op.d)} (i32.const 0xFFFFFF00)) (i32.and ${g(op.s)} (i32.const 0xFF)))`);
    case 'movh':
      if (A.narrow) return A.narrow('h', op.d, g(op.s));
      return set(op.d, `(i32.or (i32.and ${g(op.d)} (i32.const 0xFFFF00FF)) (i32.shl (i32.and ${g(op.s)} (i32.const 0xFF)) (i32.const 8)))`);
    case 'movw':
      if (A.narrow) return A.narrow('w', op.d, g(op.s));
      return set(op.d, `(i32.or (i32.and ${g(op.d)} (i32.const 0xFFFF0000)) (i32.and ${g(op.s)} (i32.const 0xFFFF)))`);
  }
  throw new Error(op.k);
}

const R8 = [0, 1, 2, 3, 4, 5, 6, 7];
const memReg = (r) => `(i32.load offset=${REGS + 4 * r} (i32.const 0))`;
const memRegSet = (r, e) => `(i32.store offset=${REGS + 4 * r} (i32.const 0) ${e})`;
const loadRegsToLocals = (pfx = '$r') => R8.map((r) => `(local.set ${pfx}${r} ${memReg(r)})`).join(' ');
const flushLocalsToRegs = (pfx = '$r') => R8.map((r) => memRegSet(r, `(local.get ${pfx}${r})`)).join(' ');
const regLocals = (pfx = '$r', t = 'i32') => R8.map((r) => `(local ${pfx}${r} ${t})`).join(' ');

function regsInit(extra = '') {
  return `
  (func $init
    (call $fillw (i32.const ${REGS}) (i32.const 8) (i32.const 0x1234) (i32.const -1) (i32.const 0))
    (call $fillw (i32.const ${DATA}) (i32.const 1024) (i32.const 0x5678) (i32.const -1) (i32.const 0))
    ${extra})`;
}
const regsChecksum = `(call $hashw (call $hashw (i32.const 0x811C9DC5) (i32.const ${REGS}) (i32.const 8)) (i32.const ${DATA}) (i32.const 1024))`;

function regsVariant(ops, kind) {
  let A, locals = '', prologue = '', epilogue = '', globals = '';
  if (kind === 'mem' || kind === 'mem-merge') {
    A = { get: memReg, set: memRegSet };
    if (kind === 'mem') {
      // today's $set_reg8/$set_reg16: i32.store8 / i32.store16 into the slot
      A.narrow = (w, d, src) => w === 'b' ? `(i32.store8 offset=${REGS + 4 * d} (i32.const 0) ${src})`
        : w === 'h' ? `(i32.store8 offset=${REGS + 4 * d + 1} (i32.const 0) ${src})`
          : `(i32.store16 offset=${REGS + 4 * d} (i32.const 0) ${src})`;
    }
  } else if (kind === 'mem-gbase') {
    globals = `  (global $rb (mut i32) (i32.const ${REGS}))`;
    A = {
      get: (r) => `(i32.load offset=${4 * r} (global.get $rb))`,
      set: (r, e) => `(i32.store offset=${4 * r} (global.get $rb) ${e})`,
    };
    A.narrow = (w, d, src) => w === 'b' ? `(i32.store8 offset=${4 * d} (global.get $rb) ${src})`
      : w === 'h' ? `(i32.store8 offset=${4 * d + 1} (global.get $rb) ${src})`
        : `(i32.store16 offset=${4 * d} (global.get $rb) ${src})`;
  } else if (kind === 'glob') {
    globals = R8.map((r) => `  (global $g${r} (mut i32) (i32.const 0))`).join('\n');
    A = { get: (r) => `(global.get $g${r})`, set: (r, e) => `(global.set $g${r} ${e})` };
    prologue = R8.map((r) => `(global.set $g${r} ${memReg(r)})`).join(' ');
    epilogue = R8.map((r) => memRegSet(r, `(global.get $g${r})`)).join(' ');
  } else if (kind === 'local') {
    locals = regLocals();
    A = { get: (r) => `(local.get $r${r})`, set: (r, e) => `(local.set $r${r} ${e})` };
    prologue = loadRegsToLocals();
    epilogue = flushLocalsToRegs();
  } else if (kind === 'i64pair') {
    locals = [0, 1, 2, 3].map((p) => `(local $p${p} i64)`).join(' ');
    A = {
      get: (r) => (r & 1)
        ? `(i32.wrap_i64 (i64.shr_u (local.get $p${r >> 1}) (i64.const 32)))`
        : `(i32.wrap_i64 (local.get $p${r >> 1}))`,
      set: (r, e) => (r & 1)
        ? `(local.set $p${r >> 1} (i64.or (i64.and (local.get $p${r >> 1}) (i64.const 0xFFFFFFFF)) (i64.shl (i64.extend_i32_u ${e}) (i64.const 32))))`
        : `(local.set $p${r >> 1} (i64.or (i64.and (local.get $p${r >> 1}) (i64.const 0xFFFFFFFF00000000)) (i64.extend_i32_u ${e})))`,
    };
    prologue = [0, 1, 2, 3].map((p) => `(local.set $p${p} (i64.load offset=${REGS + 8 * p} (i32.const 0)))`).join(' ');
    epilogue = [0, 1, 2, 3].map((p) => `(i64.store offset=${REGS + 8 * p} (i32.const 0) (local.get $p${p}))`).join(' ');
  } else throw new Error(kind);
  const body = ops.map((op) => '      ' + emitRegOp(op, A)).join('\n');
  return moduleText([memDecl(), commonFuncs(), globals, regsInit(),
    runFunc({ locals, prologue, body, epilogue, checksum: regsChecksum })]);
}

function famRegs() {
  const progs = [];
  const wide = regsProgram(false), narrow = regsProgram(true);
  progs.push({
    program: 'wide', opsPerIter: wide.length, control: 'mem',
    variants: ['mem', 'mem-gbase', 'glob', 'local', 'i64pair'].map((v) => ({ variant: v, wat: regsVariant(wide, v) })),
  });
  progs.push({
    program: 'narrow', opsPerIter: narrow.length, control: 'mem',
    variants: ['mem', 'mem-merge', 'mem-gbase', 'glob', 'local', 'i64pair'].map((v) => ({ variant: v, wat: regsVariant(narrow, v) })),
  });
  return progs;
}

// ---------------------------------------------------------------------------
// family: flags

const CF = 0x1, PF = 0x4, ZF = 0x40, SF = 0x80, OF = 0x800, ALLF = CF | PF | ZF | SF | OF;
const CC_USES = { z: ZF, nz: ZF, b: CF, ae: CF, be: CF | ZF, a: CF | ZF, s: SF, o: OF, p: PF, l: SF | OF, ge: SF | OF, le: ZF | SF | OF, g: ZF | SF | OF };

function flagsAluProgram() {
  const r = rng(0x3333);
  const items = [];
  const prod = () => ({ k: 'prod', op: r.pick(['add', 'sub', 'and', 'xor', 'add', 'sub']), d: r.int(8), s: r.int(8) });
  items.push(prod());
  while (items.length < 40) {
    const n = items.length;
    if (n === 12) { items.push({ k: 'lahf' }); continue; }
    if (n === 24) {
      items.push({ k: 'sahf' });
      items.push({ k: 'jcc', cc: r.pick(['b', 'z', 'be', 'a', 's', 'p']), x: r.int(8), i1: r.u32(), i2: r.u32() });
      continue;
    }
    const u = r.f();
    const last = items[items.length - 1].k;
    if (u < 0.15) {
      items.push({ k: 'prod', op: 'cmp', d: r.int(8), s: r.int(8) });
      items.push({ k: 'jcc', cc: r.pick(Object.keys(CC_USES)), x: r.int(8), i1: r.u32(), i2: r.u32() });
    } else if (u < 0.22) items.push({ k: 'prod', op: 'adc', d: r.int(8), s: r.int(8) });
    else if (u < 0.40 && last !== 'jcc') items.push({ k: 'jcc', cc: r.pick(Object.keys(CC_USES)), x: r.int(8), i1: r.u32(), i2: r.u32() });
    else items.push(prod());
  }
  return items;
}

// liveOut[i]: flag bits some later reader needs after item i. Region exit
// (the loop back edge also leads to it) needs every flag.
function flagLiveness(items) {
  const out = new Array(items.length);
  let live = ALLF;
  for (let i = items.length - 1; i >= 0; i--) {
    out[i] = live;
    const it = items[i];
    if (it.k === 'prod') { live = it.op === 'adc' ? CF : 0; }
    else if (it.k === 'jcc') live |= CC_USES[it.cc];
    else if (it.k === 'lahf') live |= CF | PF | ZF | SF;
    else if (it.k === 'sahf') live &= ~(CF | PF | ZF | SF);
    else if (it.k === 'fpu') {
      // fld; fcomp; fnstsw ax; sahf; jcc; add -- the add defines all flags,
      // sahf only CF/PF/ZF/SF and nothing in between reads OF.
      live = 0;
    }
  }
  return out;
}

// lazy flag state as today: $fop $fss $fa $fb $fres (+ $fcf for adc), and the
// $get_* if-chains of src/03-registers.wat. ops: 1 add, 2 sub/cmp, 3 logic,
// 6 adc, 9 raw (sahf).
const LAZY_GLOBALS = ['$fop', '$fss', '$fa', '$fb', '$fres', '$fcf'].map((g) =>
  `  (global ${g} (mut i32) (i32.const ${g === '$fop' ? 3 : g === '$fss' ? 31 : 0}))`).join('\n');
const LAZY_GETTERS = `
  (func $get_zf (result i32)
    (if (result i32) (i32.eq (global.get $fop) (i32.const 9))
      (then (i32.and (i32.shr_u (global.get $fres) (i32.const 6)) (i32.const 1)))
      (else (i32.eqz (global.get $fres)))))
  (func $get_sf (result i32)
    (if (result i32) (i32.eq (global.get $fop) (i32.const 9))
      (then (i32.and (i32.shr_u (global.get $fres) (i32.const 7)) (i32.const 1)))
      (else (i32.and (i32.shr_u (global.get $fres) (global.get $fss)) (i32.const 1)))))
  (func $get_pf (result i32)
    (if (result i32) (i32.eq (global.get $fop) (i32.const 9))
      (then (i32.and (i32.shr_u (global.get $fres) (i32.const 2)) (i32.const 1)))
      (else (i32.xor (i32.and (i32.popcnt (i32.and (global.get $fres) (i32.const 0xFF))) (i32.const 1)) (i32.const 1)))))
  (func $get_cf (result i32)
    (if (result i32) (i32.eq (global.get $fop) (i32.const 1))
      (then (i32.lt_u (global.get $fres) (global.get $fa)))
    (else (if (result i32) (i32.eq (global.get $fop) (i32.const 2))
      (then (i32.lt_u (global.get $fa) (global.get $fb)))
    (else (if (result i32) (i32.eq (global.get $fop) (i32.const 6))
      (then (i32.or (i32.lt_u (global.get $fres) (global.get $fa))
                    (i32.and (global.get $fcf) (i32.eq (global.get $fres) (global.get $fa)))))
    (else (if (result i32) (i32.eq (global.get $fop) (i32.const 9))
      (then (i32.and (global.get $fres) (i32.const 1)))
      (else (i32.const 0))))))))))
  (func $get_of (result i32)
    (if (result i32) (i32.or (i32.eq (global.get $fop) (i32.const 1)) (i32.eq (global.get $fop) (i32.const 6)))
      (then (i32.shr_u (i32.and (i32.xor (global.get $fa) (global.get $fres)) (i32.xor (global.get $fb) (global.get $fres))) (i32.const 31)))
    (else (if (result i32) (i32.eq (global.get $fop) (i32.const 2))
      (then (i32.shr_u (i32.and (i32.xor (global.get $fa) (global.get $fb)) (i32.xor (global.get $fa) (global.get $fres))) (i32.const 31)))
    (else (if (result i32) (i32.eq (global.get $fop) (i32.const 9))
      (then (i32.and (i32.shr_u (global.get $fres) (i32.const 11)) (i32.const 1)))
      (else (i32.const 0))))))))`;

function lazyCond(cc) {
  const cf = '(call $get_cf)', zf = '(call $get_zf)', sf = '(call $get_sf)', of = '(call $get_of)', pf = '(call $get_pf)';
  switch (cc) {
    case 'z': return zf; case 'nz': return `(i32.eqz ${zf})`;
    case 'b': return cf; case 'ae': return `(i32.eqz ${cf})`;
    case 'be': return `(i32.or ${cf} ${zf})`; case 'a': return `(i32.eqz (i32.or ${cf} ${zf}))`;
    case 's': return sf; case 'o': return of; case 'p': return pf;
    case 'l': return `(i32.ne ${sf} ${of})`; case 'ge': return `(i32.eq ${sf} ${of})`;
    case 'le': return `(i32.or ${zf} (i32.ne ${sf} ${of}))`; case 'g': return `(i32.eqz (i32.or ${zf} (i32.ne ${sf} ${of})))`;
  }
  throw new Error(cc);
}
function eagerCond(cc, fl = '(local.get $fl)') {
  const bit = (b, sh) => `(i32.and (i32.shr_u ${fl} (i32.const ${sh})) (i32.const 1))`;
  const cf = bit(CF, 0), zf = bit(ZF, 6), sf = bit(SF, 7), of = bit(OF, 11), pf = bit(PF, 2);
  switch (cc) {
    case 'z': return zf; case 'nz': return `(i32.eqz ${zf})`;
    case 'b': return cf; case 'ae': return `(i32.eqz ${cf})`;
    case 'be': return `(i32.ne (i32.and ${fl} (i32.const 0x41)) (i32.const 0))`;
    case 'a': return `(i32.eqz (i32.and ${fl} (i32.const 0x41)))`;
    case 's': return sf; case 'o': return of; case 'p': return pf;
    case 'l': return `(i32.ne ${sf} ${of})`; case 'ge': return `(i32.eq ${sf} ${of})`;
    case 'le': return `(i32.or ${zf} (i32.ne ${sf} ${of}))`; case 'g': return `(i32.eqz (i32.or ${zf} (i32.ne ${sf} ${of})))`;
  }
  throw new Error(cc);
}

// eager flag word for result $res of op on $a $b (adc: carry-in $cin), only
// the bits in `need` (others are dead and left 0).
function eagerFlags(op, need) {
  const parts = [];
  if (need & CF) {
    if (op === 'add') parts.push('(i32.lt_u (local.get $res) (local.get $a))');
    else if (op === 'sub' || op === 'cmp') parts.push('(i32.lt_u (local.get $a) (local.get $b))');
    else if (op === 'adc') parts.push('(i32.or (i32.lt_u (local.get $res) (local.get $a)) (i32.and (local.get $cin) (i32.eq (local.get $res) (local.get $a))))');
  }
  if (need & PF) parts.push('(i32.shl (i32.xor (i32.and (i32.popcnt (i32.and (local.get $res) (i32.const 0xFF))) (i32.const 1)) (i32.const 1)) (i32.const 2))');
  if (need & ZF) parts.push('(i32.shl (i32.eqz (local.get $res)) (i32.const 6))');
  if (need & SF) parts.push('(i32.and (i32.shr_u (local.get $res) (i32.const 24)) (i32.const 0x80))');
  if (need & OF) {
    if (op === 'add' || op === 'adc') parts.push('(i32.shl (i32.shr_u (i32.and (i32.xor (local.get $a) (local.get $res)) (i32.xor (local.get $b) (local.get $res))) (i32.const 31)) (i32.const 11))');
    else if (op === 'sub' || op === 'cmp') parts.push('(i32.shl (i32.shr_u (i32.and (i32.xor (local.get $a) (local.get $b)) (i32.xor (local.get $a) (local.get $res))) (i32.const 31)) (i32.const 11))');
  }
  if (!parts.length) return '(i32.const 0)';
  return parts.reduce((acc, p) => `(i32.or ${acc} ${p})`);
}

const OPEXPR = { add: 'i32.add', sub: 'i32.sub', cmp: 'i32.sub', and: 'i32.and', xor: 'i32.xor' };
const LAZYCODE = { add: 1, sub: 2, cmp: 2, and: 3, xor: 3, adc: 6 };
const L = (r) => `(local.get $r${r})`;
const LS = (r, e) => `(local.set $r${r} ${e})`;
const AH = '(i32.and (i32.shr_u (local.get $r0) (i32.const 8)) (i32.const 0xFF))';
const setAH = (e) => LS(0, `(i32.or (i32.and (local.get $r0) (i32.const 0xFFFF00FF)) (i32.shl ${e} (i32.const 8)))`);

function emitFlagItem(it, live, mode) {
  // mode: lazy | lazy-dce | eager | eager-dce
  const lazy = mode.startsWith('lazy'), dce = mode.endsWith('dce');
  const out = [];
  if (it.k === 'prod') {
    out.push(`(local.set $a ${L(it.d)}) (local.set $b ${L(it.s)})`);
    if (it.op === 'adc') {
      out.push(`(local.set $cin ${lazy ? '(call $get_cf)' : '(i32.and (local.get $fl) (i32.const 1))'})`);
      out.push('(local.set $res (i32.add (i32.add (local.get $a) (local.get $b)) (local.get $cin)))');
    } else out.push(`(local.set $res (${OPEXPR[it.op]} (local.get $a) (local.get $b)))`);
    if (it.op !== 'cmp') out.push(LS(it.d, '(local.get $res)'));
    if (dce && live === 0) return out.join(' ');
    if (lazy) {
      const code = LAZYCODE[it.op];
      out.push(`(global.set $fop (i32.const ${code})) (global.set $fss (i32.const 31))`);
      if (code !== 3) out.push('(global.set $fa (local.get $a)) (global.set $fb (local.get $b))');
      out.push('(global.set $fres (local.get $res))');
      if (code === 6) out.push('(global.set $fcf (local.get $cin))');
    } else {
      out.push(`(local.set $fl ${eagerFlags(it.op, dce ? live : ALLF)})`);
    }
  } else if (it.k === 'jcc') {
    const cond = lazy ? lazyCond(it.cc) : eagerCond(it.cc);
    out.push(LS(it.x, `(select (i32.add ${L(it.x)} ${c32(it.i1)}) (i32.xor ${L(it.x)} ${c32(it.i2)}) ${cond})`));
  } else if (it.k === 'lahf') {
    if (lazy) {
      out.push(setAH(`(i32.or (i32.or (i32.shl (call $get_sf) (i32.const 7)) (i32.shl (call $get_zf) (i32.const 6))) (i32.or (i32.or (i32.shl (call $get_pf) (i32.const 2)) (i32.const 2)) (call $get_cf)))`));
    } else {
      out.push(setAH('(i32.or (i32.and (local.get $fl) (i32.const 0xC5)) (i32.const 2))'));
    }
  } else if (it.k === 'sahf') {
    if (lazy) {
      out.push('(local.set $t (call $get_of))');
      out.push(`(global.set $fop (i32.const 9)) (global.set $fres (i32.or (i32.and ${AH} (i32.const 0xC5)) (i32.shl (local.get $t) (i32.const 11))))`);
    } else {
      out.push(`(local.set $fl (i32.or (i32.and (local.get $fl) (i32.const 0xFFFFFF3A)) (i32.and ${AH} (i32.const 0xC5))))`);
    }
  }
  return out.join(' ');
}

// materialised CF|PF|ZF|SF|OF, for the checksum
const LAZY_MATERIAL = '(i32.or (i32.or (i32.or (call $get_cf) (i32.shl (call $get_pf) (i32.const 2))) (i32.or (i32.shl (call $get_zf) (i32.const 6)) (i32.shl (call $get_sf) (i32.const 7)))) (i32.shl (call $get_of) (i32.const 11)))';

function flagsModule(itemsCode, mode, extraGlobals = '', extraInit = '') {
  const lazy = mode.startsWith('lazy');
  const locals = `${regLocals()} (local $a i32) (local $b i32) (local $res i32) (local $cin i32) (local $t i32) (local $fl i32) (local $fa64 f64) (local $fb64 f64) (local $sw i32) (local $cond i32)`;
  const prologue = loadRegsToLocals() + (lazy ? '' : ' (local.set $fl (global.get $flsave))');
  const epilogue = flushLocalsToRegs() + (lazy ? '' : ' (global.set $flsave (local.get $fl))');
  const material = lazy ? LAZY_MATERIAL : '(i32.and (global.get $flsave) (i32.const 0x8C5))';
  const checksum = `(call $mix (call $mix (call $hashw (i32.const 0x811C9DC5) (i32.const ${REGS}) (i32.const 8)) ${material}) (global.get $fsw))`;
  return moduleText([memDecl(), commonFuncs(), LAZY_GLOBALS,
    '  (global $flsave (mut i32) (i32.const 0x44))', '  (global $fsw (mut i32) (i32.const 0))', extraGlobals,
    LAZY_GETTERS, regsInit(extraInit),
    runFunc({ locals, prologue, body: itemsCode, epilogue, checksum })]);
}

function flagsFpuProgram() {
  const r = rng(0x4444);
  const groups = [];
  for (let g = 0; g < 8; g++) {
    groups.push({ k: 'fpu', ia: 1 + (g % 3), off: 8 * (1 + r.int(60)), cc: r.pick(['a', 'b', 'be', 'ae', 'z']), x: 4 + (g % 4), i1: r.u32(), i2: r.u32(), last: g === 7 });
  }
  return groups;
}

function emitFpuGroup(gr, mode) {
  // fld [FDATA+ra&0xFF8]; fcomp [FDATA+(ra+off)&0xFF8]; fnstsw ax; sahf; jcc; add ra, rx
  const out = [];
  out.push(`(local.set $fa64 (f64.load offset=${FDATA} (i32.and ${L(gr.ia)} (i32.const 0xFF8))))`);
  out.push(`(local.set $fb64 (f64.load offset=${FDATA} (i32.and (i32.add ${L(gr.ia)} (i32.const ${gr.off})) (i32.const 0xFF8))))`);
  out.push('(global.set $fsw (i32.or (i32.shl (f64.lt (local.get $fa64) (local.get $fb64)) (i32.const 8)) (i32.shl (f64.eq (local.get $fa64) (local.get $fb64)) (i32.const 14))))');
  out.push(LS(0, '(i32.or (i32.and (local.get $r0) (i32.const 0xFFFF0000)) (global.get $fsw))'));
  if (mode === 'lazy') {
    out.push('(local.set $t (call $get_of))');
    out.push(`(global.set $fop (i32.const 9)) (global.set $fres (i32.or (i32.and ${AH} (i32.const 0xC5)) (i32.shl (local.get $t) (i32.const 11))))`);
    out.push(LS(gr.x, `(select (i32.add ${L(gr.x)} ${c32(gr.i1)}) (i32.xor ${L(gr.x)} ${c32(gr.i2)}) ${lazyCond(gr.cc)})`));
  } else if (mode === 'eager') {
    out.push(`(local.set $fl (i32.or (i32.and (local.get $fl) (i32.const 0xFFFFFF3A)) (i32.and ${AH} (i32.const 0xC5))))`);
    out.push(LS(gr.x, `(select (i32.add ${L(gr.x)} ${c32(gr.i1)}) (i32.xor ${L(gr.x)} ${c32(gr.i2)}) ${eagerCond(gr.cc)})`));
  } else {
    // fused fcomp+fnstsw+sahf+jcc: the condition straight from the compare.
    const a = '(local.get $fa64)', b = '(local.get $fb64)';
    const cond = { a: `(f64.gt ${a} ${b})`, b: `(f64.lt ${a} ${b})`, be: `(f64.le ${a} ${b})`, ae: `(f64.ge ${a} ${b})`, z: `(f64.eq ${a} ${b})` }[gr.cc];
    out.push(LS(gr.x, `(select (i32.add ${L(gr.x)} ${c32(gr.i1)}) (i32.xor ${L(gr.x)} ${c32(gr.i2)}) ${cond})`));
  }
  // add ra, rx (defines all flags)
  out.push(`(local.set $a ${L(gr.ia)}) (local.set $b ${L(gr.x)}) (local.set $res (i32.add (local.get $a) (local.get $b))) ${LS(gr.ia, '(local.get $res)')}`);
  if (mode === 'lazy') out.push('(global.set $fop (i32.const 1)) (global.set $fss (i32.const 31)) (global.set $fa (local.get $a)) (global.set $fb (local.get $b)) (global.set $fres (local.get $res))');
  else if (mode === 'eager' || gr.last) out.push(`(local.set $fl ${eagerFlags('add', ALLF)})`);
  return out.join(' ');
}

function famFlags() {
  const alu = flagsAluProgram();
  const live = flagLiveness(alu);
  const insns = alu.length;
  const aluMods = ['lazy', 'lazy-dce', 'eager', 'eager-dce'].map((mode) => ({
    variant: mode,
    wat: flagsModule(alu.map((it, i) => '      ' + emitFlagItem(it, live[i], mode)).join('\n'), mode),
  }));
  const fpu = flagsFpuProgram();
  const fdInit = `(call $fillfd)`;
  const fillfd = `
  (func $fillfd (local $i i32) (local $s i32)
    (local.set $s (i32.const 0x9999))
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $i) (i32.const 512)))
      (local.set $s (i32.add (i32.mul (local.get $s) (i32.const 1664525)) (i32.const 1013904223)))
      (f64.store offset=${FDATA} (i32.shl (local.get $i) (i32.const 3))
        (f64.mul (f64.convert_i32_u (i32.shr_u (local.get $s) (i32.const 29))) (f64.const 0.5)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $l))))`;
  const fpuMods = ['lazy', 'eager', 'fused'].map((mode) => ({
    variant: mode,
    wat: flagsModule(fpu.map((g) => '      ' + emitFpuGroup(g, mode)).join('\n'), mode === 'lazy' ? 'lazy' : 'eager', fillfd, fdInit),
  }));
  return [
    { program: 'alu', opsPerIter: insns, control: 'lazy', variants: aluMods },
    { program: 'fpu', opsPerIter: fpu.length * 6, control: 'lazy', variants: fpuMods },
  ];
}

// ---------------------------------------------------------------------------
// families: dispatch + encoding (one bytecode ISA, several engines/encodings)

const BC = ['ADD', 'ADDI', 'XOR', 'ROLI', 'LD', 'ST', 'MOV', 'SUB', 'ORI', 'SHRX', 'END'];
const BCI = Object.fromEntries(BC.map((n, i) => [n, i]));
const HAS_IMM = new Set(['ADDI', 'ROLI', 'ORI', 'SHRX']);

function bcProgram() {
  const r = rng(0x5555);
  const w = [['ADD', 20], ['ADDI', 10], ['XOR', 10], ['ROLI', 10], ['LD', 15], ['ST', 8], ['MOV', 7], ['SUB', 10], ['ORI', 5], ['SHRX', 5]];
  const tot = w.reduce((a, x) => a + x[1], 0);
  const ops = [];
  for (let i = 0; i < 32; i++) {
    let u = r.int(tot), k = 0;
    while (u >= w[k][1]) { u -= w[k][1]; k++; }
    const name = w[k][0];
    let imm = (r.u32() & 0xFFFF);
    if (name === 'ROLI' || name === 'SHRX') imm = 1 + (imm % 31);
    if (name === 'ORI') imm &= 0x0F0F;
    ops.push({ name, d: r.int(8), s: r.int(8), imm: (imm << 16) >> 16 });
  }
  ops.push({ name: 'END', d: 0, s: 0, imm: 0 });
  return ops;
}

// Semantics of one op given operand expressions. F: { dA, sA, imm } where dA
// and sA are wasm ADDRESSES of the d/s register slots.
function bcArm(name, F) {
  const ld = (a) => `(i32.load ${a})`;
  const st = (a, v) => `(i32.store ${a} ${v})`;
  const D = () => ld(F.dA()), S = () => ld(F.sA());
  switch (name) {
    case 'ADD': return st(F.dA(), `(i32.add ${D()} ${S()})`);
    case 'ADDI': return st(F.dA(), `(i32.add ${D()} ${F.imm()})`);
    case 'XOR': return st(F.dA(), `(i32.xor ${D()} ${S()})`);
    case 'ROLI': return st(F.dA(), `(i32.rotl ${D()} ${F.imm()})`);
    case 'LD': return st(F.dA(), `(i32.load offset=${DATA} (i32.and ${S()} (i32.const 0xFFC)))`);
    case 'ST': return `(i32.store offset=${DATA} (i32.and ${S()} (i32.const 0xFFC)) ${D()})`;
    case 'MOV': return st(F.dA(), S());
    case 'SUB': return st(F.dA(), `(i32.sub ${D()} ${S()})`);
    case 'ORI': return st(F.dA(), `(i32.or ${D()} ${F.imm()})`);
    case 'SHRX': return `(local.set $t ${D()}) ` + st(F.dA(), `(i32.xor (local.get $t) (i32.shr_u (local.get $t) ${F.imm()}))`);
  }
  throw new Error(name);
}

const regAddr = (rExpr) => `(i32.add (i32.const ${REGS}) (i32.shl ${rExpr} (i32.const 2)))`;

// encodings: bytes of the program + field extractors relative to $ip
function encode(ops, enc) {
  const words = [];
  for (const o of ops) {
    const op = BCI[o.name];
    if (enc === 'pair') words.push(op, (o.d | (o.s << 4) | ((o.imm & 0xFFFF) << 16)) >>> 0);
    else if (enc === 'preaddr') {
      const dA = REGS + 4 * o.d, sA = REGS + 4 * o.s;
      words.push(op, (HAS_IMM.has(o.name) ? (dA | ((o.imm & 0xFFFF) << 16)) : (dA | (sA << 16))) >>> 0);
    } else if (enc === 'packed32') words.push((op | (o.d << 8) | (o.s << 12) | ((o.imm & 0xFFFF) << 16)) >>> 0);
    else if (enc === 'separate') words.push(op, o.d, o.s, o.imm >>> 0);
    else if (enc === 'immstream') {
      words.push((op | (o.d << 8) | (o.s << 12)) >>> 0);
      if (HAS_IMM.has(o.name)) words.push(o.imm >>> 0);
    } else throw new Error(enc);
  }
  const buf = Buffer.alloc(words.length * 4);
  words.forEach((w, i) => buf.writeUInt32LE(w >>> 0, i * 4));
  return buf;
}
const dataSeg = (addr, buf) => `  (data (i32.const ${addr}) "${[...buf].map((b) => '\\' + b.toString(16).padStart(2, '0')).join('')}")`;

// Field extractors for the loop engine: $ip is a local pointing at the op;
// $w holds the first word, $o the operand word when the encoding has one.
function fieldsFor(enc) {
  switch (enc) {
    case 'pair': return {
      head: '(local.set $o (i32.load offset=4 (local.get $ip)))', step: () => 8,
      dA: () => regAddr('(i32.and (local.get $o) (i32.const 15))'),
      sA: () => regAddr('(i32.and (i32.shr_u (local.get $o) (i32.const 4)) (i32.const 15))'),
      imm: () => '(i32.shr_s (local.get $o) (i32.const 16))',
    };
    case 'preaddr': return {
      head: '(local.set $o (i32.load offset=4 (local.get $ip)))', step: () => 8,
      dA: () => '(i32.and (local.get $o) (i32.const 0xFFFF))',
      sA: () => '(i32.shr_u (local.get $o) (i32.const 16))',
      imm: () => '(i32.shr_s (local.get $o) (i32.const 16))',
    };
    case 'packed32': return {
      head: '', step: () => 4,
      dA: () => regAddr('(i32.and (i32.shr_u (local.get $w) (i32.const 8)) (i32.const 15))'),
      sA: () => regAddr('(i32.and (i32.shr_u (local.get $w) (i32.const 12)) (i32.const 15))'),
      imm: () => '(i32.shr_s (local.get $w) (i32.const 16))',
    };
    case 'separate': return {
      head: '', step: () => 16,
      dA: () => regAddr('(i32.load offset=4 (local.get $ip))'),
      sA: () => regAddr('(i32.load offset=8 (local.get $ip))'),
      imm: () => '(i32.load offset=12 (local.get $ip))',
    };
    case 'immstream': return {
      head: '', step: (name) => (HAS_IMM.has(name) ? 8 : 4),
      dA: () => regAddr('(i32.and (i32.shr_u (local.get $w) (i32.const 8)) (i32.const 15))'),
      sA: () => regAddr('(i32.and (i32.shr_u (local.get $w) (i32.const 12)) (i32.const 15))'),
      imm: () => '(i32.load offset=4 (local.get $ip))',
    };
  }
  throw new Error(enc);
}

const bcInit = regsInit;
const bcChecksum = regsChecksum;
const bcLocals = '(local $ip i32) (local $w i32) (local $o i32) (local $t i32)';
const opMask = (enc) => (enc === 'packed32' || enc === 'immstream') ? '(i32.and (local.get $w) (i32.const 0xFF))' : '(local.get $w)';

// One-function br_table loop over the bytecode. The run wrapper is bypassed:
// END decrements $k and leaves when it reaches zero.
function loopEngine(ops, enc) {
  const F = fieldsFor(enc);
  const names = BC;
  let nest = `(br_table ${names.map((n) => '$c_' + n).join(' ')} $c_bad ${opMask(enc)})`;
  for (const n of names) nest = `(block $c_${n} ${nest})\n${armBody(n)}`;
  function armBody(n) {
    if (n === 'END') {
      return `        (br_if $exit (i32.eqz (local.tee $k (i32.sub (local.get $k) (i32.const 1)))))
        (local.set $ip (i32.const ${CODE})) (br $top)`;
    }
    // Fields read before $ip moves; the step is per-arm for immstream.
    return `        ${bcArm(n, F)} (local.set $ip (i32.add (local.get $ip) (i32.const ${F.step(n)}))) (br $top)`;
  }
  const body = `
  (func $run (export "run") (param $k i32) (result i32) ${bcLocals}
    (if (i32.eqz (global.get $inited)) (then (call $init) (global.set $inited (i32.const 1))))
    (if (i32.le_s (local.get $k) (i32.const 0)) (then (return ${bcChecksum})))
    (local.set $ip (i32.const ${CODE}))
    (block $exit (loop $top
      (local.set $w (i32.load (local.get $ip))) ${F.head}
      (block $c_bad
${nest})
      (unreachable)))
    ${bcChecksum})`;
  return moduleText([memDecl(), commonFuncs(), dataSeg(CODE, encode(ops, enc)), bcInit(), body]);
}

// Threaded: one function per op, each ending in today's dispatch-next shape
// (steps test, load handler+operand pair, bump $ip, bound check,
// return_call_indirect). Operand passed as the parameter, as $handler_t does.
function threadedEngine(ops) {
  const F = {
    dA: () => regAddr('(i32.and (local.get $op) (i32.const 15))'),
    sA: () => regAddr('(i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 15))'),
    imm: () => '(i32.shr_s (local.get $op) (i32.const 16))',
  };
  const dispatch = `
    (if (i32.le_s (global.get $steps) (i32.const 0)) (then (return)))
    (local.set $nx_fn (i32.load (global.get $ip)))
    (local.set $nx_op (i32.load offset=4 (global.get $ip)))
    (global.set $ip (i32.add (global.get $ip) (i32.const 8)))
    (if (i32.ge_u (local.get $nx_fn) (i32.const 16)) (then (unreachable)))
    (return_call_indirect (type $h) (local.get $nx_op) (local.get $nx_fn))`;
  const handlers = BC.map((n) => {
    const body = n === 'END'
      ? `(global.set $kk (i32.sub (global.get $kk) (i32.const 1)))
    (if (i32.eqz (global.get $kk)) (then (return)))
    (global.set $ip (i32.const ${CODE}))`
      : bcArm(n, F);
    return `
  (func $th_${n} (type $h) (param $op i32) (local $nx_fn i32) (local $nx_op i32) (local $t i32)
    ${body}${dispatch})`;
  }).join('');
  const parts = [memDecl(), commonFuncs(), '  (type $h (func (param i32)))',
    `  (table $handlers 16 funcref)`, `  (elem (i32.const 0) ${BC.map((n) => '$th_' + n).join(' ')})`,
    '  (global $ip (mut i32) (i32.const 0))', '  (global $kk (mut i32) (i32.const 0))',
    '  (global $steps (mut i32) (i32.const 0x7FFFFFFF))',
    dataSeg(CODE, encode(ops, 'pair')), bcInit(), handlers, `
  (func $enter (local $nx_fn i32) (local $nx_op i32)
    (local.set $nx_fn (i32.load (global.get $ip)))
    (local.set $nx_op (i32.load offset=4 (global.get $ip)))
    (global.set $ip (i32.add (global.get $ip) (i32.const 8)))
    (call_indirect (type $h) (local.get $nx_op) (local.get $nx_fn)))
  (func $run (export "run") (param $k i32) (result i32)
    (if (i32.eqz (global.get $inited)) (then (call $init) (global.set $inited (i32.const 1))))
    (if (i32.le_s (local.get $k) (i32.const 0)) (then (return ${bcChecksum})))
    (global.set $kk (local.get $k))
    (global.set $ip (i32.const ${CODE}))
    (call $enter)
    ${bcChecksum})`];
  return moduleText(parts);
}

// call_indirect inside a loop: each handler returns 1 to continue, 0 to stop.
function callIndirectEngine(ops) {
  const F = {
    dA: () => regAddr('(i32.and (local.get $op) (i32.const 15))'),
    sA: () => regAddr('(i32.and (i32.shr_u (local.get $op) (i32.const 4)) (i32.const 15))'),
    imm: () => '(i32.shr_s (local.get $op) (i32.const 16))',
  };
  const handlers = BC.map((n) => {
    const body = n === 'END'
      ? `(global.set $kk (i32.sub (global.get $kk) (i32.const 1)))
    (global.set $ip (i32.const ${CODE}))
    (i32.ne (global.get $kk) (i32.const 0))`
      : `${bcArm(n, F)} (i32.const 1)`;
    return `
  (func $ci_${n} (type $h) (param $op i32) (result i32) (local $t i32)
    ${body})`;
  }).join('');
  return moduleText([memDecl(), commonFuncs(), '  (type $h (func (param i32) (result i32)))',
    '  (table $handlers 16 funcref)', `  (elem (i32.const 0) ${BC.map((n) => '$ci_' + n).join(' ')})`,
    '  (global $ip (mut i32) (i32.const 0))', '  (global $kk (mut i32) (i32.const 0))',
    dataSeg(CODE, encode(ops, 'pair')), bcInit(), handlers, `
  (func $run (export "run") (param $k i32) (result i32) (local $fn i32) (local $op i32)
    (if (i32.eqz (global.get $inited)) (then (call $init) (global.set $inited (i32.const 1))))
    (if (i32.le_s (local.get $k) (i32.const 0)) (then (return ${bcChecksum})))
    (global.set $kk (local.get $k))
    (global.set $ip (i32.const ${CODE}))
    (loop $top
      (local.set $fn (i32.load (global.get $ip)))
      (local.set $op (i32.load offset=4 (global.get $ip)))
      (global.set $ip (i32.add (global.get $ip) (i32.const 8)))
      (br_if $top (call_indirect (type $h) (local.get $op) (local.get $fn))))
    ${bcChecksum})`]);
}

// A compiled region: the ops are wasm code with constant register slots.
// region-brtable splits them into basic blocks joined by a br_table on a
// block-id local (how a region JIT lays out a CFG); region-direct is the same
// code as one straight loop body (structured control, the upper bound).
const BLOCK_SPLIT = [5, 6, 4, 7, 5, 5];
function regionEngine(ops, kind) {
  const C = (r) => () => `(i32.const ${REGS + 4 * r})`;
  const opCode = (o) => bcArm(o.name, { dA: C(o.d), sA: C(o.s), imm: () => `(i32.const ${o.imm})` });
  const body = ops.slice(0, 32);
  let funcBody;
  if (kind === 'direct') {
    funcBody = `
    (loop $top
${body.map((o) => '      ' + opCode(o)).join('\n')}
      (br_if $top (local.tee $k (i32.sub (local.get $k) (i32.const 1)))))`;
  } else {
    const blocks = [];
    let at = 0;
    for (const n of BLOCK_SPLIT) { blocks.push(body.slice(at, at + n)); at += n; }
    const nb = blocks.length;
    const names = blocks.map((_, i) => `$b${i}`).concat(['$bend']);
    let nest = `(br_table ${names.join(' ')} $bend (local.get $blk))`;
    names.forEach((n, i) => {
      const code = i < nb
        ? `${blocks[i].map(opCode).join(' ')} (local.set $blk (i32.const ${i + 1})) (br $top)`
        : `(br_if $exit (i32.eqz (local.tee $k (i32.sub (local.get $k) (i32.const 1))))) (local.set $blk (i32.const 0)) (br $top)`;
      nest = `(block ${n} ${nest})\n        ${code}`;
    });
    funcBody = `
    (local.set $blk (i32.const 0))
    (block $exit (loop $top
${nest}))`;
  }
  return moduleText([memDecl(), commonFuncs(), bcInit(), `
  (func $run (export "run") (param $k i32) (result i32) (local $blk i32) (local $t i32)
    (if (i32.eqz (global.get $inited)) (then (call $init) (global.set $inited (i32.const 1))))
    (if (i32.le_s (local.get $k) (i32.const 0)) (then (return ${bcChecksum})))
    ${funcBody}
    ${bcChecksum})`]);
}

function famDispatch() {
  const ops = bcProgram();
  return [{
    program: 'bc33', opsPerIter: ops.length, control: 'threaded', features: { },
    variants: [
      { variant: 'threaded', wat: threadedEngine(ops), features: ['tail-call'] },
      { variant: 'loop-brtable', wat: loopEngine(ops, 'pair') },
      { variant: 'callind-loop', wat: callIndirectEngine(ops) },
      { variant: 'region-brtable', wat: regionEngine(ops, 'brtable') },
      { variant: 'region-direct', wat: regionEngine(ops, 'direct') },
    ],
  }];
}

function famEncoding() {
  const ops = bcProgram();
  return [{
    program: 'bc33', opsPerIter: ops.length, control: 'pair',
    variants: ['pair', 'packed32', 'separate', 'immstream', 'preaddr'].map((e) => ({ variant: e, wat: loopEngine(ops, e) })),
  }];
}

// ---------------------------------------------------------------------------
// family: memacc (guest address translation)

function memaccModule(kind, { mem64 = false } = {}) {
  const A = (e) => (mem64 ? `(i64.extend_i32_u ${e})` : e);
  const END = GBASE + GWIN;
  // translate: ga -> wa per variant
  const affine = (ga) => `(i32.add (i32.sub ${ga} (global.get $image_base)) (global.get $GUEST_BASE))`;
  const helpers = `
  (global $image_base (mut i32) (i32.const ${hex(IMG)}))
  (global $GUEST_BASE i32 (i32.const ${hex(GBASE)}))
  ;; never reached (every address is in the window); stands for $g2w_slow.
  (func $g2w_slow (param $ga i32) (result i32)
    (if (i32.lt_u (i32.sub (local.get $ga) (i32.const 0x80000000)) (i32.const 0x01000000)) (then (unreachable)))
    (if (i32.ge_u (i32.sub (local.get $ga) (global.get $image_base)) (i32.const ${hex(GWIN)})) (then (unreachable)))
    ${affine('(local.get $ga)')})
  (func $g2w (param $ga i32) (result i32) (local $wa i32)
    (local.set $wa ${affine('(local.get $ga)')})
    (if (result i32) (i32.lt_u (local.get $wa) (i32.const ${hex(END)}))
      (then (local.get $wa)) (else (call $g2w_slow (local.get $ga)))))
  ;; today's $gl32/$gs32 hot path: shared-heap test, whole-dword window test, load.
  (func $gl32_slow (param $ga i32) (result i32) (i32.load ${A('(call $g2w_slow (local.get $ga))')}))
  (func $gl32 (param $ga i32) (result i32) (local $wa i32)
    (if (i32.lt_u (i32.sub (local.get $ga) (i32.const 0x80000000)) (i32.const 0x01000000)) (then (return (call $gl32_slow (local.get $ga)))))
    (local.set $wa ${affine('(local.get $ga)')})
    (if (i32.le_u (local.get $wa) (i32.const ${hex(END - 4)})) (then (return (i32.load ${A('(local.get $wa)')}))))
    (call $gl32_slow (local.get $ga)))
  (func $gs32 (param $ga i32) (param $v i32) (local $wa i32)
    (if (i32.lt_u (i32.sub (local.get $ga) (i32.const 0x80000000)) (i32.const 0x01000000)) (then (unreachable)))
    (local.set $wa ${affine('(local.get $ga)')})
    (if (i32.le_u (local.get $wa) (i32.const ${hex(END - 4)})) (then (i32.store ${A('(local.get $wa)')} (local.get $v)) (return)))
    (i32.store ${A('(call $g2w_slow (local.get $ga))')} (local.get $v)))
  (func $pte_slow (param $ga i32) (result i32) (unreachable))
  (func $pte_g2w (param $ga i32) (result i32) (local $p i32)
    (local.set $p (i32.load ${A(`(i32.add (i32.const ${PT}) (i32.shl (i32.shr_u (local.get $ga) (i32.const 12)) (i32.const 2)))`)}))
    (if (result i32) (i32.eqz (local.get $p)) (then (call $pte_slow (local.get $ga)))
      (else (i32.add (local.get $p) (i32.and (local.get $ga) (i32.const 0xFFF))))))`;
  const inlineTr = (ga) => `(block (result i32)
          (local.set $wa ${affine(ga)})
          (if (result i32) (i32.lt_u (local.get $wa) (i32.const ${hex(END)}))
            (then (local.get $wa)) (else (call $g2w_slow (i32.add (i32.sub (local.get $wa) (global.get $GUEST_BASE)) (global.get $image_base))))))`;
  const pteInline = (ga) => `(block (result i32)
          (local.set $p (i32.load ${A(`(i32.add (i32.const ${PT}) (i32.shl (i32.shr_u ${ga} (i32.const 12)) (i32.const 2)))`)}))
          (if (result i32) (i32.eqz (local.get $p)) (then (call $pte_slow ${ga}))
            (else (i32.add (local.get $p) (i32.and ${ga} (i32.const 0xFFF))))))`;
  const lines = [];
  for (let g = 0; g < 4; g++) {
    lines.push('(local.set $x (i32.add (i32.mul (local.get $x) (i32.const 1664525)) (i32.const 1013904223)))');
    lines.push(`(local.set $ga (i32.add (i32.const ${hex(IMG)}) (i32.and (local.get $x) (i32.const 0xFFFF0))))`);
    const ga = (off) => off ? `(i32.add (local.get $ga) (i32.const ${off}))` : '(local.get $ga)';
    let LD, ST;
    if (kind === 'inline') { LD = (o) => `(i32.load ${A(inlineTr(ga(o)))})`; ST = (o, v) => `(i32.store ${A(inlineTr(ga(o)))} ${v})`; }
    else if (kind === 'call-g2w') { LD = (o) => `(i32.load ${A(`(call $g2w ${ga(o)})`)})`; ST = (o, v) => `(i32.store ${A(`(call $g2w ${ga(o)})`)} ${v})`; }
    else if (kind === 'call-gl32') { LD = (o) => `(call $gl32 ${ga(o)})`; ST = (o, v) => `(call $gs32 ${ga(o)} ${v})`; }
    else if (kind === 'nocheck') { LD = (o) => `(i32.load offset=${o} ${A(affine(ga(0)))})`; ST = (o, v) => `(i32.store offset=${o} ${A(affine(ga(0)))} ${v})`; }
    else if (kind === 'hoisted') {
      // one window test for the whole 16-byte group
      lines.push(`(local.set $wa ${affine(ga(0))})`);
      lines.push(`(local.set $wb (if (result i32) (i32.le_u (local.get $wa) (i32.const ${hex(END - 16)})) (then (local.get $wa)) (else (call $g2w_slow (local.get $ga)))))`);
      LD = (o) => `(i32.load offset=${o} ${A('(local.get $wb)')})`; ST = (o, v) => `(i32.store offset=${o} ${A('(local.get $wb)')} ${v})`;
    } else if (kind === 'pte-inline') { LD = (o) => `(i32.load ${A(pteInline(ga(o)))})`; ST = (o, v) => `(i32.store ${A(pteInline(ga(o)))} ${v})`; }
    else if (kind === 'pte-call') { LD = (o) => `(i32.load ${A(`(call $pte_g2w ${ga(o)})`)})`; ST = (o, v) => `(i32.store ${A(`(call $pte_g2w ${ga(o)})`)} ${v})`; }
    else if (kind === 'pte-hoisted') {
      lines.push(`(local.set $wb ${pteInline(ga(0))})`);
      LD = (o) => `(i32.load offset=${o} ${A('(local.get $wb)')})`; ST = (o, v) => `(i32.store offset=${o} ${A('(local.get $wb)')} ${v})`;
    } else throw new Error(kind);
    lines.push(`(local.set $v0 ${LD(0)}) (local.set $v1 ${LD(4)}) (local.set $v2 ${LD(8)})`);
    lines.push(ST(12, '(i32.xor (i32.add (local.get $v0) (local.get $v1)) (local.get $acc))'));
    lines.push('(local.set $acc (i32.add (i32.rotl (i32.xor (local.get $acc) (local.get $v2)) (i32.const 5)) (local.get $v1)))');
  }
  const init = `
  (func $init (local $i i32)
    (call $fillw (i32.const ${GBASE}) (i32.const ${GWIN / 4}) (i32.const 0xABCD) (i32.const -1) (i32.const 0))
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $i) (i32.const ${GWIN >> 12})))
      (i32.store ${A(`(i32.add (i32.const ${PT + (IMG >> 12) * 4}) (i32.shl (local.get $i) (i32.const 2)))`)}
        (i32.add (i32.const ${GBASE}) (i32.shl (local.get $i) (i32.const 12))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $l))))
  (global $gx (mut i32) (i32.const 0x13579))
  (global $gacc (mut i32) (i32.const 0))`;
  const checksum = `(call $mix (call $mix (call $hashw (i32.const 0x811C9DC5) (i32.const ${GBASE}) (i32.const 1024)) (global.get $gacc)) (global.get $gx))`;
  return moduleText([memDecl({ mem64 }), commonFuncs(mem64), helpers, init,
    runFunc({
      locals: '(local $x i32) (local $acc i32) (local $ga i32) (local $wa i32) (local $wb i32) (local $p i32) (local $v0 i32) (local $v1 i32) (local $v2 i32)',
      prologue: '(local.set $x (global.get $gx)) (local.set $acc (global.get $gacc))',
      body: lines.map((l) => '      ' + l).join('\n'),
      epilogue: '(global.set $gx (local.get $x)) (global.set $gacc (local.get $acc))',
      checksum,
    })]);
}

function famMemacc() {
  return [{
    program: 'g16', opsPerIter: 16, control: 'inline',
    variants: ['inline', 'call-g2w', 'call-gl32', 'hoisted', 'nocheck', 'pte-inline', 'pte-call', 'pte-hoisted']
      .map((v) => ({ variant: v, wat: memaccModule(v) })),
  }];
}

// ---------------------------------------------------------------------------
// family: sse

const NORM32 = { and: '(v128.const i32x4 0x007FFFFF 0x007FFFFF 0x007FFFFF 0x007FFFFF)', or: '(v128.const i32x4 0x3F800000 0x3F800000 0x3F800000 0x3F800000)' };
const NORM64 = { and: '(v128.const i64x2 0x000FFFFFFFFFFFFF 0x000FFFFFFFFFFFFF)', or: '(v128.const i64x2 0x3FF0000000000000 0x3FF0000000000000)' };

function sseAccess(kind) {
  if (kind === 'mem-call') return {
    get: (i) => `(call $xmm_get (i32.const ${i}))`, set: (i, e) => `(call $xmm_set (i32.const ${i}) ${e})`,
    globals: '  (global $xmm_base (mut i32) (i32.const ' + XMM + `))
  (func $xmm_addr (param $i i32) (result i32)
    (i32.add (global.get $xmm_base) (i32.shl (i32.and (local.get $i) (i32.const 7)) (i32.const 4))))
  (func $xmm_get (param $i i32) (result v128) (v128.load (call $xmm_addr (local.get $i))))
  (func $xmm_set (param $i i32) (param $v v128) (v128.store (call $xmm_addr (local.get $i)) (local.get $v)))`,
    addr: (i) => `(call $xmm_addr (i32.const ${i}))`,
  };
  if (kind === 'mem-inline') return {
    get: (i) => `(v128.load offset=${16 * i} (global.get $xmm_base))`, set: (i, e) => `(v128.store offset=${16 * i} (global.get $xmm_base) ${e})`,
    globals: `  (global $xmm_base (mut i32) (i32.const ${XMM}))`, addr: (i) => `(i32.add (global.get $xmm_base) (i32.const ${16 * i}))`,
  };
  if (kind === 'mem-const') return {
    get: (i) => `(v128.load offset=${XMM + 16 * i} (i32.const 0))`, set: (i, e) => `(v128.store offset=${XMM + 16 * i} (i32.const 0) ${e})`,
    globals: '', addr: (i) => `(i32.const ${XMM + 16 * i})`,
  };
  if (kind === 'locals') return {
    get: (i) => `(local.get $x${i})`, set: (i, e) => `(local.set $x${i} ${e})`, globals: '',
    locals: R8.map((i) => `(local $x${i} v128)`).join(' '),
    prologue: R8.map((i) => `(local.set $x${i} (v128.load offset=${XMM + 16 * i} (i32.const 0)))`).join(' '),
    epilogue: R8.map((i) => `(v128.store offset=${XMM + 16 * i} (i32.const 0) (local.get $x${i}))`).join(' '),
  };
  if (kind === 'globals') return {
    get: (i) => `(global.get $x${i})`, set: (i, e) => `(global.set $x${i} ${e})`,
    globals: R8.map((i) => `  (global $x${i} (mut v128) (v128.const i64x2 0 0))`).join('\n'),
    prologue: R8.map((i) => `(global.set $x${i} (v128.load offset=${XMM + 16 * i} (i32.const 0)))`).join(' '),
    epilogue: R8.map((i) => `(v128.store offset=${XMM + 16 * i} (i32.const 0) (global.get $x${i}))`).join(' '),
  };
  throw new Error(kind);
}

function ssePackedProgram() {
  const r = rng(0x6666);
  const groups = [];
  for (let g = 0; g < 6; g++) {
    const d = r.int(8);
    const ops = [];
    for (let j = 0; j < 3; j++) {
      const u = r.f(), s = r.int(8);
      if (u < 0.3) ops.push({ k: 'addps', d, s });
      else if (u < 0.55) ops.push({ k: 'mulps', d, s });
      else if (u < 0.7) ops.push({ k: 'pshufd', d, s, imm: r.int(256) });
      // subps, not xorps: xor of two normalised floats clears the exponent
      // and feeds denormals (microcode assists) into the next mulps.
      else if (u < 0.8) ops.push({ k: 'subps', d, s });
      else ops.push({ k: 'load', d });
    }
    groups.push({ d, ops, store: g === 5 });
  }
  return groups;
}

function shufd(imm) {
  const lanes = [0, 1, 2, 3].map((i) => (imm >> (2 * i)) & 3);
  return lanes.flatMap((l) => [0, 1, 2, 3].map((b) => 4 * l + b)).join(' ');
}

function ssePackedModule(kind) {
  const X = sseAccess(kind);
  const prog = ssePackedProgram();
  const lines = [];
  for (const g of prog) {
    for (const o of g.ops) {
      if (o.k === 'addps') lines.push(X.set(o.d, `(f32x4.add ${X.get(o.d)} ${X.get(o.s)})`));
      else if (o.k === 'mulps') lines.push(X.set(o.d, `(f32x4.mul ${X.get(o.d)} ${X.get(o.s)})`));
      else if (o.k === 'subps') lines.push(X.set(o.d, `(f32x4.sub ${X.get(o.d)} ${X.get(o.s)})`));
      else if (o.k === 'pshufd') lines.push(X.set(o.d, `(i8x16.shuffle ${shufd(o.imm)} ${X.get(o.s)} ${X.get(o.s)})`));
      else if (o.k === 'load') lines.push(X.set(o.d, `(v128.load offset=${XDATA} (local.get $i))`));
    }
    lines.push(X.set(g.d, `(v128.and ${X.get(g.d)} ${NORM32.and})`));
    lines.push(X.set(g.d, `(v128.or ${X.get(g.d)} ${NORM32.or})`));
    if (g.store) lines.push(`(v128.store offset=${XDATA} (local.get $i) ${X.get(g.d)})`);
    lines.push('(local.set $i (i32.and (i32.add (local.get $i) (i32.const 16)) (i32.const 0xFF0)))');
  }
  const opsPerIter = prog.reduce((a, g) => a + g.ops.length + 2 + (g.store ? 1 : 0), 0);
  return { opsPerIter, wat: sseModule(X, lines) };
}

function sseModule(X, lines) {
  const init = `
  (func $init
    (call $fillw (i32.const ${XMM}) (i32.const 32) (i32.const 0x7777) (i32.const 0x007FFFFF) (i32.const 0x3F800000))
    (call $fillw (i32.const ${XDATA}) (i32.const 1024) (i32.const 0x8888) (i32.const 0x007FFFFF) (i32.const 0x3F800000)))
  (global $gi (mut i32) (i32.const 0))`;
  const checksum = `(call $mix (call $hashw (call $hashw (i32.const 0x811C9DC5) (i32.const ${XMM}) (i32.const 32)) (i32.const ${XDATA}) (i32.const 1024)) (global.get $gi))`;
  return moduleText([memDecl(), commonFuncs(), X.globals, init,
    runFunc({
      locals: `(local $i i32) ${X.locals || ''}`,
      prologue: `(local.set $i (global.get $gi)) ${X.prologue || ''}`,
      body: lines.map((l) => '      ' + l).join('\n'),
      epilogue: `(global.set $gi (local.get $i)) ${X.epilogue || ''}`,
      checksum,
    })]);
}

// scalar: xmm0-3 carry f32 scalars (addss/mulss/subss), xmm4-7 f64 (addsd/
// mulsd/subsd); each group ends in a full-width andps/orps normalise, which
// is a packed op in every variant.
function sseScalarProgram() {
  const r = rng(0x7777);
  const groups = [];
  for (let g = 0; g < 8; g++) {
    const f64 = g & 1;
    const base = f64 ? 4 : 0;
    const d = base + r.int(4);
    const ops = [];
    for (let j = 0; j < 3; j++) ops.push({ k: r.pick(['add', 'mul', 'sub', 'add']), d, s: base + r.int(4), f64 });
    groups.push({ d, ops, f64 });
  }
  return groups;
}

function sseScalarModule(kind) {
  // kind: s-lane-call (today: $xmm_get/$xmm_set + extract/replace lane 0),
  // s-mem (f32/f64 load+store of lane 0 at its address), s-v128op (whole-
  // vector op, then shuffle lane 0 into d), s-locals-lane (v128 locals,
  // extract/replace)
  const X = sseAccess(kind === 's-locals-lane' ? 'locals' : kind === 's-mem' ? 'mem-inline' : 'mem-call');
  const prog = sseScalarProgram();
  const lines = [];
  for (const g of prog) {
    for (const o of g.ops) {
      const T = o.f64 ? 'f64' : 'f32', V = o.f64 ? 'f64x2' : 'f32x4';
      if (kind === 's-mem') {
        const a = (i) => `offset=${16 * i} (global.get $xmm_base)`;
        lines.push(`(${T}.store ${a(o.d)} (${T}.${o.k} (${T}.load ${a(o.d)}) (${T}.load ${a(o.s)})))`);
      } else if (kind === 's-v128op') {
        const merge = o.f64 ? '0 1 2 3 4 5 6 7 24 25 26 27 28 29 30 31' : '0 1 2 3 20 21 22 23 24 25 26 27 28 29 30 31';
        lines.push(`(local.set $vd ${X.get(o.d)})`);
        lines.push(X.set(o.d, `(i8x16.shuffle ${merge} (${V}.${o.k} (local.get $vd) ${X.get(o.s)}) (local.get $vd))`));
      } else {
        lines.push(`(local.set $vd ${X.get(o.d)})`);
        lines.push(X.set(o.d, `(${V}.replace_lane 0 (local.get $vd) (${T}.${o.k} (${V}.extract_lane 0 (local.get $vd)) (${V}.extract_lane 0 ${X.get(o.s)})))`));
      }
    }
    const N = g.f64 ? NORM64 : NORM32;
    if (kind === 's-mem') {
      const a = `offset=${16 * g.d} (global.get $xmm_base)`;
      lines.push(`(v128.store ${a} (v128.or (v128.and (v128.load ${a}) ${N.and}) ${N.or}))`);
    } else {
      lines.push(X.set(g.d, `(v128.and ${X.get(g.d)} ${N.and})`));
      lines.push(X.set(g.d, `(v128.or ${X.get(g.d)} ${N.or})`));
    }
  }
  const opsPerIter = prog.reduce((a, g) => a + g.ops.length + 2, 0);
  X.locals = `${X.locals || ''} (local $vd v128)`;
  const init = `
  (func $init
    (call $fillw (i32.const ${XMM}) (i32.const 16) (i32.const 0x7777) (i32.const 0x007FFFFF) (i32.const 0x3F800000))
    (call $fillw (i32.const ${XMM + 64}) (i32.const 16) (i32.const 0x7778) (i32.const 0x000FFFFF) (i32.const 0x3FF00000)))
  (global $gi (mut i32) (i32.const 0))`;
  const checksum = `(call $hashw (i32.const 0x811C9DC5) (i32.const ${XMM}) (i32.const 32))`;
  return {
    opsPerIter, wat: moduleText([memDecl(), commonFuncs(), X.globals, init,
      runFunc({
        locals: `(local $i i32) ${X.locals}`, prologue: X.prologue || '',
        body: lines.map((l) => '      ' + l).join('\n'), epilogue: X.epilogue || '', checksum,
      })]),
  };
}

function famSse() {
  const packed = ['mem-call', 'mem-inline', 'mem-const', 'locals', 'globals'].map((v) => ({ variant: v, ...ssePackedModule(v) }));
  const scalar = ['s-lane-call', 's-mem', 's-v128op', 's-locals-lane'].map((v) => ({ variant: v, ...sseScalarModule(v) }));
  return [
    { program: 'packed', opsPerIter: packed[0].opsPerIter, control: 'mem-call', variants: packed.map((v) => ({ ...v, features: ['simd'] })) },
    { program: 'scalar', opsPerIter: scalar[0].opsPerIter, control: 's-lane-call', variants: scalar.map((v) => ({ ...v, features: ['simd'] })) },
  ];
}

// ---------------------------------------------------------------------------
// family: lock

function lockProgram() {
  const r = rng(0x8888);
  const items = [];
  for (let i = 0; i < 8; i++) {
    const k = ['add', 'xadd', 'cmpxchg', 'inc'][i % 4];
    items.push({ k, a: 1 + r.int(3), v: r.int(4) });
    if (k === 'cmpxchg') items.push({ k, a: items[items.length - 1].a, v: r.int(4), again: true });
    if (i % 2) items.push({ k: 'alu', d: 1 + r.int(3), s: r.int(4), c: 1 + r.int(30) });
  }
  return items;
}

function lockModule(kind, shared) {
  // kind: cas64 (today's: i64.atomic.load, merge, i64.atomic.rmw.cmpxchg retry
  // loop), rmw (one i32.atomic.rmw.* per op), plain (load/op/store).
  const items = lockProgram();
  const lines = [];
  const addr = (a) => `(i32.add (i32.const ${CNT}) (i32.and ${L(a)} (i32.const 0xFFC)))`;
  // new value of the locked op given $old; returns statements setting $new
  // and (for cmpxchg) $wr (1 = store wanted) and the register writes.
  for (const it of items) {
    if (it.k === 'alu') {
      lines.push(LS(it.d, `(i32.xor (i32.rotl (i32.add ${L(it.d)} ${L(it.s)}) (i32.const ${it.c})) (i32.const 0x2545F491))`));
      continue;
    }
    lines.push(`(local.set $ad ${addr(it.a)})`);
    const newExpr = { add: `(i32.add (local.get $old) ${L(it.v)})`, xadd: `(i32.add (local.get $old) ${L(it.v)})`, inc: '(i32.add (local.get $old) (i32.const 1))', cmpxchg: L(it.v) }[it.k];
    const after = () => {
      const s = [];
      if (it.k === 'xadd') s.push(LS(it.v, '(local.get $old)'));
      if (it.k === 'cmpxchg') s.push(`(if (i32.ne (local.get $old) (local.get $r0)) (then ${LS(0, '(local.get $old)')}))`);
      s.push(`(global.set $fres ${it.k === 'cmpxchg' ? '(i32.sub (local.get $r0) (local.get $old))' : newExpr})`);
      return s.join(' ');
    };
    if (kind === 'plain') {
      lines.push('(local.set $old (i32.load (local.get $ad)))');
      if (it.k === 'cmpxchg') lines.push(`(if (i32.eq (local.get $old) (local.get $r0)) (then (i32.store (local.get $ad) ${newExpr})))`);
      else lines.push(`(i32.store (local.get $ad) ${newExpr})`);
      lines.push(after());
    } else if (kind === 'rmw') {
      if (it.k === 'cmpxchg') lines.push(`(local.set $old (i32.atomic.rmw.cmpxchg (local.get $ad) (local.get $r0) ${L(it.v)}))`);
      else lines.push(`(local.set $old (i32.atomic.rmw.add (local.get $ad) ${it.k === 'inc' ? '(i32.const 1)' : L(it.v)}))`);
      lines.push(after());
    } else {
      lines.push('(local.set $wq (i32.and (local.get $ad) (i32.const -8)))');
      lines.push('(local.set $sh (i64.extend_i32_u (i32.shl (i32.and (local.get $ad) (i32.const 7)) (i32.const 3))))');
      lines.push('(local.set $qm (i64.shl (i64.const 0xFFFFFFFF) (local.get $sh)))');
      const store = it.k === 'cmpxchg' ? '(i32.eq (local.get $old) (local.get $r0))' : '(i32.const 1)';
      lines.push(`(loop $cas
        (local.set $q (i64.atomic.load (local.get $wq)))
        (local.set $old (i32.wrap_i64 (i64.shr_u (local.get $q) (local.get $sh))))
        (if ${store} (then
          (local.set $nq (i64.or (i64.and (local.get $q) (i64.xor (local.get $qm) (i64.const -1)))
            (i64.shl (i64.extend_i32_u ${newExpr}) (local.get $sh))))
          (br_if $cas (i64.ne (i64.atomic.rmw.cmpxchg (local.get $wq) (local.get $q) (local.get $nq)) (local.get $q))))))`);
      lines.push(after());
    }
  }
  const ops = items.length;
  const init = `
  (func $init
    (call $fillw (i32.const ${REGS}) (i32.const 8) (i32.const 0x1234) (i32.const -1) (i32.const 0))
    (call $fillw (i32.const ${CNT}) (i32.const 1024) (i32.const 0x4321) (i32.const 0xFF) (i32.const 0)))
  (global $fres (mut i32) (i32.const 0))`;
  const checksum = `(call $mix (call $hashw (call $hashw (i32.const 0x811C9DC5) (i32.const ${REGS}) (i32.const 8)) (i32.const ${CNT}) (i32.const 1024)) (global.get $fres))`;
  return {
    opsPerIter: ops, wat: moduleText([memDecl({ shared }), commonFuncs(), init,
      runFunc({
        locals: `${regLocals()} (local $ad i32) (local $old i32) (local $wq i32) (local $sh i64) (local $qm i64) (local $q i64) (local $nq i64)`,
        prologue: loadRegsToLocals(), body: lines.map((l) => '      ' + l).join('\n'), epilogue: flushLocalsToRegs(), checksum,
      })]),
  };
}

function famLock() {
  const vs = [['cas64', 'cas64', true], ['rmw', 'rmw', true], ['plain', 'plain', true],
    ['cas64-ns', 'cas64', false], ['rmw-ns', 'rmw', false], ['plain-ns', 'plain', false]];
  const mods = vs.map(([name, kind, shared]) => {
    const m = lockModule(kind, shared);
    const features = [];
    if (shared) features.push('shared-memory');
    if (kind !== 'plain') features.push('atomics');
    return { variant: name, wat: m.wat, opsPerIter: m.opsPerIter, features };
  });
  return [{ program: 'rmw8', opsPerIter: mods[0].opsPerIter, control: 'cas64', variants: mods }];
}

// ---------------------------------------------------------------------------
// family: clock (budget charging in a compiled region)

const CLOCK_BLOCKS = [3, 5, 8, 4, 6, 4];
function clockModule(kind) {
  const r = rng(0x9999);
  const blocks = CLOCK_BLOCKS.map((n) => Array.from({ length: n }, () => ({ k: r.pick(['add', 'xor', 'rol', 'sub']), d: r.int(8), s: r.int(8), c: 1 + r.int(31) })));
  const insn = (o) => {
    switch (o.k) {
      case 'add': return LS(o.d, `(i32.add ${L(o.d)} ${L(o.s)})`);
      case 'sub': return LS(o.d, `(i32.sub ${L(o.d)} (i32.xor ${L(o.s)} (i32.const 0x5bd1e995)))`);
      case 'xor': return LS(o.d, `(i32.xor ${L(o.d)} (i32.rotl ${L(o.s)} (i32.const ${o.c})))`);
      case 'rol': return LS(o.d, `(i32.rotl ${L(o.d)} (i32.const ${o.c}))`);
    }
  };
  const total = CLOCK_BLOCKS.reduce((a, b) => a + b, 0);
  const exitIf = (cond) => `(br_if $exit ${cond})`;
  const blockHead = (n) => {
    switch (kind) {
      case 'blk-2global': return `${exitIf('(i32.le_s (global.get $budget) (i32.const 0))')} (global.set $budget (i32.sub (global.get $budget) (i32.const 1))) (global.set $steps (i32.sub (global.get $steps) (i32.const 1)))`;
      case 'blk-global': return `${exitIf('(i32.le_s (global.get $budget) (i32.const 0))')} (global.set $budget (i32.sub (global.get $budget) (i32.const 1)))`;
      case 'blk-local': return `${exitIf('(i32.le_s (local.get $bud) (i32.const 0))')} (local.set $bud (i32.sub (local.get $bud) (i32.const 1)))`;
      case 'blk-weighted': return `${exitIf(`(i32.lt_s (local.tee $t (i32.sub (global.get $budget) (i32.const ${n}))) (i32.const 0))`)} (global.set $budget (local.get $t))`;
      default: return '';
    }
  };
  const perInsn = (kind === 'insn-global')
    ? ` ${exitIf('(i32.le_s (global.get $budget) (i32.const 0))')} (global.set $budget (i32.sub (global.get $budget) (i32.const 1)))`
    : (kind === 'insn-local') ? ` ${exitIf('(i32.le_s (local.get $bud) (i32.const 0))')} (local.set $bud (i32.sub (local.get $bud) (i32.const 1)))` : '';
  const names = blocks.map((_, i) => `$b${i}`).concat(['$bend']);
  let nest = `(br_table ${names.join(' ')} $bend (local.get $blk))`;
  names.forEach((nm, i) => {
    const code = i < blocks.length
      ? `${blockHead(blocks[i].length)} ${blocks[i].map((o) => insn(o) + perInsn).join(' ')} (local.set $blk (i32.const ${i + 1})) (br $top)`
      : `${kind === 'backedge' ? `${exitIf(`(i32.lt_s (local.tee $t (i32.sub (global.get $budget) (i32.const ${total}))) (i32.const 0))`)} (global.set $budget (local.get $t))` : ''} (br_if $exit (i32.eqz (local.tee $k (i32.sub (local.get $k) (i32.const 1))))) (local.set $blk (i32.const 0)) (br $top)`;
    nest = `(block ${nm} ${nest})\n        ${code}`;
  });
  const localBud = kind.endsWith('-local');
  const ret = `(call $mix (call $hashw (i32.const 0x811C9DC5) (i32.const ${REGS}) (i32.const 8)) (local.get $k))`;
  return {
    opsPerIter: total, wat: moduleText([memDecl(), commonFuncs(),
      '  (global $budget (mut i32) (i32.const 0))', '  (global $steps (mut i32) (i32.const 0))', regsInit(), `
  (func $run (export "run") (param $k i32) (result i32) ${regLocals()} (local $blk i32) (local $t i32) (local $bud i32)
    (if (i32.eqz (global.get $inited)) (then (call $init) (global.set $inited (i32.const 1))))
    (if (i32.le_s (local.get $k) (i32.const 0)) (then (return ${ret})))
    ;; the budget never runs out here: every exit test is a not-taken branch
    (global.set $budget (i32.const 0x7FFFFFFF)) (global.set $steps (i32.const 0x7FFFFFFF))
    (local.set $bud (i32.const 0x7FFFFFFF))
    ${loadRegsToLocals()}
    (local.set $blk (i32.const 0))
    (block $exit (loop $top
${nest}))
    ${localBud ? '(global.set $budget (local.get $bud))' : ''}
    ${flushLocalsToRegs()}
    ${ret})`]),
  };
}

function famClock() {
  const vs = ['blk-2global', 'blk-global', 'blk-local', 'blk-weighted', 'insn-global', 'insn-local', 'backedge', 'none'];
  const mods = vs.map((v) => ({ variant: v, ...clockModule(v) }));
  return [{ program: 'r30', opsPerIter: mods[0].opsPerIter, control: 'blk-2global', variants: mods }];
}

// ---------------------------------------------------------------------------
// family: ext (memory64, multi-memory)

function famExt() {
  const m64 = [
    { variant: 'm32', wat: memaccModule('inline') },
    { variant: 'm64', wat: memaccModule('inline', { mem64: true }), features: ['memory64'] },
    { variant: 'm32-nocheck', wat: memaccModule('nocheck') },
    { variant: 'm64-nocheck', wat: memaccModule('nocheck', { mem64: true }), features: ['memory64'] },
  ];
  // regs in a second memory: regs family "wide" program, memory register file
  const wide = regsProgram(false);
  const mmMod = (second) => {
    const A = second ? {
      get: (r) => `(i32.load $rf offset=${4 * r} (i32.const 0))`,
      set: (r, e) => `(i32.store $rf offset=${4 * r} (i32.const 0) ${e})`,
    } : { get: memReg, set: memRegSet };
    const body = wide.map((op) => '      ' + emitRegOp(op, A)).join('\n');
    const sync = second
      ? R8.map((r) => memRegSet(r, `(i32.load $rf offset=${4 * r} (i32.const 0))`)).join(' ')
      : '';
    const pro = second ? R8.map((r) => `(i32.store $rf offset=${4 * r} (i32.const 0) ${memReg(r)})`).join(' ') : '';
    return moduleText([memDecl(), second ? '  (memory $rf 1 1)' : '', commonFuncs(), regsInit(),
      runFunc({ prologue: pro, body, epilogue: sync, checksum: regsChecksum })]);
  };
  return [
    { program: 'mem64', opsPerIter: 16, control: 'm32', variants: m64 },
    { program: 'multimem', opsPerIter: wide.length, control: 'mem0', variants: [{ variant: 'mem0', wat: mmMod(false) }, { variant: 'mem1', wat: mmMod(true), features: ['multi-memory'] }] },
  ];
}

// ---------------------------------------------------------------------------

const FAMILIES = { regs: famRegs, flags: famFlags, dispatch: famDispatch, memacc: famMemacc, sse: famSse, lock: famLock, encoding: famEncoding, clock: famClock, ext: famExt };

// Writes every module (WAT always, wasm when wat2wasm is given) and returns
// the manifest.
function generate(out, { wat2wasm = null, only = null } = {}) {
  fs.mkdirSync(out, { recursive: true });
  const manifest = [];
  for (const [fam, fn] of Object.entries(FAMILIES)) {
    if (only && !only.includes(fam)) continue;
    for (const prog of fn()) {
      const variants = prog.variants.slice();
      const ctl = variants.find((v) => v.variant === prog.control);
      if (!ctl) throw new Error(`${fam}.${prog.program}: no control ${prog.control}`);
      variants.push({ ...ctl, variant: `${prog.control}~copy` });
      for (const v of variants) {
        const id = `${fam}.${prog.program}.${v.variant}`;
        const watPath = path.join(out, id + '.wat');
        const wasmPath = path.join(out, id + '.wasm');
        fs.writeFileSync(watPath, v.wat);
        if (wat2wasm) {
          try {
            execFileSync(wat2wasm, ['--enable-all', watPath, '-o', wasmPath], { stdio: ['ignore', 'pipe', 'pipe'] });
          } catch (e) {
            throw new Error(`wat2wasm failed for ${id}:\n${e.stderr}`);
          }
        }
        const opsPerIter = v.opsPerIter || prog.opsPerIter;
        manifest.push({
          id, family: fam, program: prog.program, variant: v.variant,
          control: v.variant === prog.control, copyOf: v.variant.endsWith('~copy') ? `${fam}.${prog.program}.${prog.control}` : null,
          features: v.features || [], opsPerIter,
          kPerCall: Math.max(1, Math.round(OPS_PER_CALL / opsPerIter)),
          wasmBytes: wat2wasm ? fs.statSync(wasmPath).size : null,
        });
      }
    }
  }
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 1));
  return manifest;
}

function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] ?? true] : [a, true]; }));
  const out = path.resolve(args.out || 'scratch/wat-microbench/mods');
  const wat2wasm = args.wat2wasm || process.env.WAT2WASM || 'wat2wasm';
  const only = args.only ? String(args.only).split(',') : null;
  try {
    const manifest = generate(out, { wat2wasm, only });
    console.log(`${manifest.length} modules -> ${path.relative(process.cwd(), out) || out}`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

if (require.main === module) main();
module.exports = { FAMILIES, generate };
