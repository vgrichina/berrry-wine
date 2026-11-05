#!/usr/bin/env node
// The per-block executor (H458, src/07c-block-exec.wat) against the threaded
// interpreter, one basic block at a time.
//
// docs/block-executor-design.md is the design. What this test is FOR is the
// one claim the design cannot argue its way to: that a block run with the
// eight GPRs in wasm locals ends in exactly the state the same block ends in
// when every op is dispatched through $next -- registers, EFLAGS, memory, EIP.
//
// Method: run identical x86 twice in ONE instance, at two different code
// addresses, with --block-exec on for one of them. Two addresses because the
// gate is read at DECODE time, so a flag flipped between two runs of the same
// address would not steer the second one; and one instance because a second
// instance would also be a second heap, a second cache and a second set of
// lazy-flag globals, which is three more ways for the arms to differ for
// reasons that are not the executor.
//
// Every snippet ends `pushfd ; pop ebp ; ret`. That is not decoration:
//   * `pushfd` is a FALLBACK op in this prototype, so every single case also
//     exercises the spill/call_indirect/reload path with a handler that reads
//     the lazy-flag globals -- which is the strongest available check that the
//     executor left them at the exact architectural join;
//   * it lands the whole of EFLAGS in EBP, so the snapshot compares flags as
//     a value instead of inferring them from a branch;
//   * `ret` is the block's terminator, which this design deliberately leaves
//     in the threaded stream.
//
// Run: node test/test-block-exec.js

const fs = require('fs');
const path = require('path');
const { createHostImports } = require(path.join(__dirname, '..', 'lib/host-imports'));
const RegionMap = require('../lib/region-map.generated.js');

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? '  ' + detail : ''}`); }
}

// ---- x86 encoders. Register numbering is the architectural one:
// 0=eax 1=ecx 2=edx 3=ebx 4=esp 5=ebp 6=esi 7=edi.
const EAX = 0, ECX = 1, EDX = 2, EBX = 3, ESP = 4, EBP = 5, ESI = 6, EDI = 7;
const le32 = v => [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];
const movRI = (r, v) => [0xB8 + r, ...le32(v)];
const movRR = (d, s) => [0x89, 0xC0 | (s << 3) | d];
const aluRR = (opc, d, s) => [opc, 0xC0 | (s << 3) | d];
const ADD = 0x01, OR = 0x09, ADC = 0x11, SBB = 0x19, AND = 0x21, SUB = 0x29,
      XOR = 0x31, CMP = 0x39;
// 81 /digit  -- digit is the ALU index: 0 add 1 or 2 adc 3 sbb 4 and 5 sub 6 xor 7 cmp
const aluRI = (digit, r, v) => [0x81, 0xC0 | (digit << 3) | r, ...le32(v)];
const leaRO = (d, base, disp) => [0x8D, 0x80 | (d << 3) | base, ...le32(disp)];
const incR = r => [0x40 + r];
const decR = r => [0x48 + r];
const negR = r => [0xF7, 0xD8 | r];
const notR = r => [0xF7, 0xD0 | r];
const shlRI = (r, n) => [0xC1, 0xE0 | r, n & 0xFF];
const shrRI = (r, n) => [0xC1, 0xE8 | r, n & 0xFF];
const sarRI = (r, n) => [0xC1, 0xF8 | r, n & 0xFF];
const load32 = (d, base, disp) => [0x8B, 0x80 | (d << 3) | base, ...le32(disp)];
const store32 = (s, base, disp) => [0x89, 0x80 | (s << 3) | base, ...le32(disp)];
const load32abs = (d, abs) => [0x8B, 0x05 | (d << 3), ...le32(abs)];
const store32abs = (s, abs) => [0x89, 0x05 | (s << 3), ...le32(abs)];
// ---- read-modify-write memory forms (round 12 lever C, §19). The opcode is
// the `OP r/m32, r32` direction (0x01 ADD, 0x09 OR, 0x21 AND, 0x29 SUB,
// 0x31 XOR, 0x39 CMP), so the MEMORY operand is the destination -- the mirror
// of load32/aluRR, where it is the source.
const aluMR = (opc, base, disp, reg) => [opc, 0x80 | (reg << 3) | base, ...le32(disp)];
const aluMabsR = (opc, abs, reg) => [opc, 0x05 | (reg << 3), ...le32(abs)];
const aluMI = (digit, base, disp, imm) =>
  [0x81, 0x80 | (digit << 3) | base, ...le32(disp), ...le32(imm)];
const aluMabsI = (digit, abs, imm) =>
  [0x81, 0x05 | (digit << 3), ...le32(abs), ...le32(imm)];
const incM = (base, disp) => [0xFF, 0x80 | base, ...le32(disp)];
const decM = (base, disp) => [0xFF, 0x88 | base, ...le32(disp)];
const notM = (base, disp) => [0xF7, 0x90 | base, ...le32(disp)];
const negM = (base, disp) => [0xF7, 0x98 | base, ...le32(disp)];
const incMabs = abs => [0xFF, 0x05, ...le32(abs)];
const negMabs = abs => [0xF7, 0x1D, ...le32(abs)];
// The BYTE twin, which lever C deliberately does not split.
const aluM8R8 = (base, disp, r8) => [0x00, 0x80 | (r8 << 3) | base, ...le32(disp)];
const movR8R8 = (d, s) => [0x88, 0xC0 | (s << 3) | d];
const aluR8I8 = (digit, r8, v) => [0x80, 0xC0 | (digit << 3) | r8, v & 0xFF];
const load8 = (d8, base, disp) => [0x8A, 0x80 | (d8 << 3) | base, ...le32(disp)];
const store8 = (s8, base, disp) => [0x88, 0x80 | (s8 << 3) | base, ...le32(disp)];
const movzx8 = (d, base, disp) => [0x0F, 0xB6, 0x80 | (d << 3) | base, ...le32(disp)];
const movsx8 = (d, base, disp) => [0x0F, 0xBE, 0x80 | (d << 3) | base, ...le32(disp)];
// mod=10 rm=100 -> SIB follows, then disp32. scale is the shift amount 0..3.
const sib = (scale, idx, base) => (scale << 6) | (idx << 3) | base;
const leaSib = (d, base, idx, sc, disp) =>
  [0x8D, 0x84 | (d << 3), sib(sc, idx, base), ...le32(disp)];
const load32sib = (d, base, idx, sc, disp) =>
  [0x8B, 0x84 | (d << 3), sib(sc, idx, base), ...le32(disp)];
const store32sib = (s, base, idx, sc, disp) =>
  [0x89, 0x84 | (s << 3), sib(sc, idx, base), ...le32(disp)];
const movsx8sib = (d, base, idx, sc, disp) =>
  [0x0F, 0xBE, 0x84 | (d << 3), sib(sc, idx, base), ...le32(disp)];
const store8sib = (s8, base, idx, sc, disp) =>
  [0x88, 0x84 | (s8 << 3), sib(sc, idx, base), ...le32(disp)];
const load16 = (d, base, disp) => [0x66, 0x8B, 0x80 | (d << 3) | base, ...le32(disp)];
const store16 = (s, base, disp) => [0x66, 0x89, 0x80 | (s << 3) | base, ...le32(disp)];
const load16abs = (d, abs) => [0x66, 0x8B, 0x05 | (d << 3), ...le32(abs)];
const pushR = r => [0x50 + r];
const popR = r => [0x58 + r];
const pushI = v => [0x68, ...le32(v)];
// Memory-SOURCE ALU: `op r32, [base+disp32]` and `op r32, [abs]`. These are the
// forms round 11's split takes apart, and nothing else in this file emits one.
// The opcode is the register-destination direction (0x03 add, 0x0B or, 0x23
// and, 0x2B sub, 0x33 xor, 0x3B cmp) — one higher than the r/m-destination
// opcode the aluRR encoder above uses.
const ADD_RM = 0x03, OR_RM = 0x0B, AND_RM = 0x23, SUB_RM = 0x2B,
      XOR_RM = 0x33, CMP_RM = 0x3B;
const aluRM = (opc, d, base, disp) => [opc, 0x80 | (d << 3) | base, ...le32(disp)];
const aluRAbs = (opc, d, abs) => [opc, 0x05 | (d << 3), ...le32(abs)];
const imulRM = (d, base, disp) => [0x0F, 0xAF, 0x80 | (d << 3) | base, ...le32(disp)];
const CDQ = [0x99];
const PUSHFD = [0x9C];
const RET = [0xC3];
const NOP = [0x90];

async function main() {
  const ROOT = path.join(__dirname, '..');
  const WASM_PATH = process.env.WINE_ASSEMBLY_WASM || path.join(ROOT, 'build', 'wine-assembly.wasm');
  const wasmBytes = fs.readFileSync(WASM_PATH);
  const exeBytes = fs.readFileSync(path.join(__dirname, 'binaries', 'notepad.exe'));
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { exports: null, getMemory: () => memory.buffer };
  const base = createHostImports(ctx);
  const h = base.host;
  h.memory = memory;
  h.exit = () => {};
  h.log = () => {};
  h.log_i32 = () => {};
  h.crash_unimplemented = () => {};
  h.wait_multiple = () => 0;
  h.shell_execute = () => 33;

  const { instance } = await WebAssembly.instantiate(wasmBytes, { host: h });
  ctx.exports = instance.exports;
  const e = instance.exports;
  const mem = new Uint8Array(e.memory.buffer);
  const dv = new DataView(e.memory.buffer);
  mem.set(exeBytes, e.get_staging());
  e.load_pe(exeBytes.length);

  const imageBase = e.get_image_base();
  const g2w = a => RegionMap.g2w(a, imageBase);

  if (typeof e.set_block_exec !== 'function') {
    console.log('FAIL: set_block_exec is not exported — the build predates 07c-block-exec.wat');
    process.exit(1);
  }
  // The gate must be OFF in a fresh instance. This is the whole ship-safety
  // claim, so it is asserted rather than assumed.
  check('the executor is OFF in a fresh instance', e.get_block_exec() === 0,
    `get_block_exec()=${e.get_block_exec()}`);
  // Round 18 (section 28). The side exit ships ON, and this is the only place
  // that can say so: every `arm()` below writes the switch, so after the first
  // one the global reports the last arm's request and not the default.
  check('the round-18 side exit is ON in a fresh instance',
    e.get_block_exec_tail_exits() === 1,
    `get_block_exec_tail_exits()=${e.get_block_exec_tail_exits()}`);

  // Multi-block discovery is hotness-gated in production: a head must be
  // branched to K times before the CFG walk is attempted at all, so the walk
  // is paid once per hot head instead of once per decode. A snippet in this
  // file runs a handful of iterations and would never reach the shipped K, so
  // the gate is dropped to the first entry here — this file is about what the
  // matcher builds, not about how long it waits before building it. The gate
  // and the budget have cases of their own further down, which set these back.
  //
  // Two, not one: the FIRST branch into a head is the edge that compiles it,
  // and a walk needs the head already compiled (see $bx_walk_try). At the
  // shipped K that is invisible — by the 24th entry every real head has been
  // compiled for a long time — so one is the only value that would behave
  // differently from production here.
  e.set_block_exec_walk_k(2);

  const STACK_TOP = imageBase + 0xD00000;
  const DATA = imageBase + 0x900000;   // scratch the snippets read and write
  const DATA_LEN = 256;

  let codeOffset = 0;
  const nextCode = () => { const a = imageBase + 0x20000 + codeOffset; codeOffset += 512; return a; };

  // The seven registers a snippet may set up. ESP is excluded (the harness
  // owns it) and EBP is the EFLAGS sink.
  const SEED = { eax: 0x1234ABCD, ecx: 0x0000000F, edx: 0x7FFFFFFF,
                 ebx: DATA, esi: 0x00000004, edi: 0xFFFFFFFE };

  function seedData() {
    for (let i = 0; i < DATA_LEN; i++) mem[g2w(DATA) + i] = (i * 7 + 3) & 0xFF;
  }

  // The lazy-flag globals survive between runs, so whatever ran last decides
  // the CF an `adc` at the top of the next block adds in. That is not a
  // property of the executor and it made the arms differ by one. Every arm
  // therefore runs this first: `xor ebp,ebp` leaves CF=0 OF=0 ZF=1 SF=0 from a
  // known join, and `ret` returns to the sentinel.
  const flagsInitAddr = nextCode();
  {
    const b = [...aluRR(XOR, EBP, EBP), ...RET];
    for (let i = 0; i < b.length; i++) mem[g2w(flagsInitAddr) + i] = b[i];
  }
  function normalizeFlags() {
    e.set_esp(STACK_TOP);
    dv.setUint32(g2w(STACK_TOP), 0, true);
    e.set_eip(flagsInitAddr);
    e.run(100);
  }

  // Run one arm. `blockExec` steers the DECODE of a fresh address, so the two
  // arms are genuinely two different compilations of the same bytes.
  // Round 16's leaf switch, read by `arm`. It is a variable and not an
  // argument because every existing call site predates the leaf and must keep
  // running with it in its shipped state (on).
  let leafGate = true;
  // Round 17's second leaf (H464). Same reasoning: every call site predates it
  // and must keep running with it in its shipped state (on).
  let leafFbGate = true;
  // Round 18's side exit (section 28). Same contract once more: every call
  // site above predates it and must keep running with it in its shipped state
  // (on), and the round-18 section at the bottom of this file is the only
  // place that varies it.
  let tailGate = true;

  // `opts.addr` places the snippet at an address the caller already knows.
  // Round 18's indirect-jump case needs it: a `jmp r32` target has to be
  // baked into the bytes as a literal, so the bytes cannot be assembled until
  // the address is chosen, and each arm is a different address by design.
  function arm(bytes, blockExec, seed, opts) {
    const addr = (opts && opts.addr) || nextCode();
    e.set_stack_fusion(opts && opts.stackFusion === false ? 0 : 1);
    const wa = g2w(addr);
    for (let i = 0; i < bytes.length; i++) mem[wa + i] = bytes[i];
    seedData();
    normalizeFlags();
    // The shipped floor is 12 micro-ops -- the measured crossover where a
    // descriptor starts paying for its entry/exit cost (see the note on
    // $block_exec_min_uops). Every case here is a hand-written block of two to
    // a dozen ops chosen to isolate ONE micro-op kind, so at the shipped floor
    // they would all decline and each arm would silently run the same threaded
    // code twice. Coverage is the point of this file, so it drops the floor to
    // the minimum a descriptor can express; the throughput question is
    // tools/bench-loops.js's and fold-ab's, not this file's.
    e.set_block_exec_min_uops(2);
    e.set_block_exec(blockExec ? 1 : 0);
    const regs = Object.assign({}, SEED, seed || {});
    e.set_eax(regs.eax); e.set_ecx(regs.ecx); e.set_edx(regs.edx);
    e.set_ebx(regs.ebx); e.set_esi(regs.esi); e.set_edi(regs.edi);
    e.set_ebp(0);
    e.set_esp(STACK_TOP);
    dv.setUint32(g2w(STACK_TOP), 0, true);   // sentinel return address
    // Round 16 (section 25). The one-block leaf (H463) is a separate handler,
    // so which of the two an install landed on is observable rather than
    // inferred. `leafGate` is the arm switch for the leaf itself: with it off
    // every install goes back through the general region handler, which is the
    // A/B that proves the leaf is an optimization and not a behaviour change.
    e.set_block_exec_leaf(leafGate ? 1 : 0);
    e.set_block_exec_leaf_fb(leafFbGate ? 1 : 0);
    e.set_block_exec_tail_exits(tailGate ? 1 : 0);
    const tailRegionsBefore = e.get_block_exec_tail_regions();
    const tailMembersBefore = e.get_block_exec_tail_members();
    const tailRunsBefore = e.get_block_exec_tail_exit_runs();
    const tailAdmittedBefore = e.get_block_exec_tail_admitted();
    const leafBefore = e.get_block_exec_leaf_runs();
    const leafFbBefore = e.get_block_exec_leaf_fb_runs();
    const runsBefore = e.get_block_exec_runs();
    const installsBefore = e.get_block_exec_installs();
    const fbBefore = e.get_block_exec_fallback_ops();
    const natBefore = e.get_block_exec_native_ops();
    // Round 11's decode-time pass keeps its own meters. Capturing them per arm
    // is what lets a case assert that a transform FIRED or, more often, that
    // it correctly did not — a "the two arms agree" check cannot tell a sound
    // rewrite from no rewrite at all.
    const passBefore = {
      split: e.get_bx_pass_split(), rle: e.get_bx_pass_rle(),
      movelim: e.get_bx_pass_movelim(), immfold: e.get_bx_pass_immfold(),
      stlf: e.get_bx_pass_stlf(),
      x87: e.get_bx_x87_uops(),
      // Round 15 (section 24). `x87run` is the cheap kind -- a FUSED run that
      // went in as TU_X87RUN -- and is a subset of `x87`. `x87native` is the
      // other round-15 path and is disjoint from both: a BARE H188-H190 that
      // $tree_uop_classify turned into one of 07b's own native x87 micro-ops.
      x87run: e.get_bx_x87run_uops(),
      x87native: e.get_bx_x87_native_uops(),
      rmw: e.get_bx_pass_rmw(),
    };
    const smcExitsBefore = e.get_block_exec_region_smc_exits();
    e.set_eip(addr);
    e.run(100000);
    const out = {
      addr,
      regionSmcExits: e.get_block_exec_region_smc_exits() - smcExitsBefore,
      eip: e.get_eip() >>> 0,
      eax: e.get_eax() >>> 0, ecx: e.get_ecx() >>> 0, edx: e.get_edx() >>> 0,
      ebx: e.get_ebx() >>> 0, esp: e.get_esp() >>> 0, ebp: e.get_ebp() >>> 0,
      esi: e.get_esi() >>> 0, edi: e.get_edi() >>> 0,
      data: Buffer.from(mem.subarray(g2w(DATA), g2w(DATA) + DATA_LEN)).toString('hex'),
      installs: e.get_block_exec_installs() - installsBefore,
      runs: e.get_block_exec_runs() - runsBefore,
      leafRuns: e.get_block_exec_leaf_runs() - leafBefore,
      leafFbRuns: e.get_block_exec_leaf_fb_runs() - leafFbBefore,
      tailRegions: e.get_block_exec_tail_regions() - tailRegionsBefore,
      tailMembers: e.get_block_exec_tail_members() - tailMembersBefore,
      tailRuns: e.get_block_exec_tail_exit_runs() - tailRunsBefore,
      tailAdmitted: Number(e.get_block_exec_tail_admitted() - tailAdmittedBefore),
      declWhy: e.get_block_exec_decl_why(),
      lastFallbackFn: e.get_block_exec_last_fallback_fn(),
      fallbacks: Number(e.get_block_exec_fallback_ops() - fbBefore),
      natives: Number(e.get_block_exec_native_ops() - natBefore),
      x87uops: Number(e.get_bx_x87_uops() - passBefore.x87),
      x87run: Number(e.get_bx_x87run_uops() - passBefore.x87run),
      x87native: Number(e.get_bx_x87_native_uops() - passBefore.x87native),
      pass: {
        split: Number(e.get_bx_pass_split() - passBefore.split),
        rle: Number(e.get_bx_pass_rle() - passBefore.rle),
        movelim: Number(e.get_bx_pass_movelim() - passBefore.movelim),
        immfold: Number(e.get_bx_pass_immfold() - passBefore.immfold),
        stlf: Number(e.get_bx_pass_stlf() - passBefore.stlf),
        rmw: Number(e.get_bx_pass_rmw() - passBefore.rmw),
      },
    };
    e.set_block_exec(0);
    return out;
  }

  const hexRegs = s => ['eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi']
    .map(k => `${k}=${s[k].toString(16).padStart(8, '0')}`).join(' ');

  // A block always ends with the flags probe and the terminator.
  const block = body => [...body, ...PUSHFD, ...popR(EBP), ...RET];

  let totalNative = 0, totalFallback = 0, totalInstalls = 0;

  function equiv(name, body, seed, opts) {
    const bytes = block(body);
    const off = arm(bytes, false, seed, opts);
    const on = arm(bytes, true, seed, opts);
    totalNative += on.natives; totalFallback += on.fallbacks; totalInstalls += on.installs;
    const regsOk = ['eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi']
      .every(k => off[k] === on[k]);
    const memOk = off.data === on.data;
    const eipOk = off.eip === on.eip;
    let why = '';
    if (!regsOk) why = `\n         off ${hexRegs(off)}\n         on  ${hexRegs(on)}`;
    else if (!memOk) why = ' (guest memory differs)';
    else if (!eipOk) why = ` (eip ${off.eip.toString(16)} vs ${on.eip.toString(16)})`;
    check(name, regsOk && memOk && eipOk, why);
    // A "pass" from a block the executor declined proves nothing about the
    // executor, so installation is asserted separately unless the case is
    // explicitly ABOUT a decline.
    if (!(opts && opts.mayDecline)) {
      check(`  ${name}: installed`, on.installs >= 1,
        `installs=${on.installs} declWhy=${on.declWhy} — declined, so the two ` +
        `arms just ran the same threaded code twice and the pass above is empty`);
    }
    return { off, on };
  }

  console.log('\n-- every implemented micro-op kind, against threaded --');

  equiv('MOV_RR / MOV_RI',
    [...movRI(EAX, 0xDEADBEEF), ...movRR(ECX, EAX), ...movRR(EDX, ECX)]);
  equiv('LEA_RO',
    [...leaRO(EAX, EBX, 0x40), ...leaRO(ECX, EAX, -0x10), ...movRR(EDX, ECX)]);
  equiv('ADD/SUB r,r and r,imm',
    [...aluRR(ADD, EAX, ECX), ...aluRI(0, EAX, 0x7FFFFFF0),
     ...aluRR(SUB, EDX, ECX), ...aluRI(5, EDX, 0x00010000)]);
  equiv('AND/OR/XOR r,r and r,imm',
    [...aluRR(AND, EAX, EDX), ...aluRI(4, EAX, 0x0F0F0F0F),
     ...aluRR(OR, ECX, EAX), ...aluRI(1, ECX, 0x80000000),
     ...aluRR(XOR, EDX, ECX), ...aluRI(6, EDX, 0xFFFFFFFF)]);
  equiv('CMP r,r and CMP r,imm write flags and no register',
    [...movRI(EAX, 5), ...movRI(ECX, 5), ...aluRR(CMP, EAX, ECX),
     ...aluRI(7, EAX, 6)]);
  equiv('INC / DEC preserve CF',
    [...aluRI(0, EAX, 1), ...incR(ECX), ...decR(EDX), ...incR(EDI)]);
  equiv('NEG / NOT',
    [...negR(EAX), ...notR(ECX), ...negR(EDX), ...notR(EDI)]);
  equiv('SHL / SHR / SAR by imm8',
    [...shlRI(EAX, 5), ...shrRI(ECX, 3), ...sarRI(EDX, 9), ...shlRI(EDI, 1)]);
  equiv('SHL by 0 writes no flags at all',
    [...aluRR(CMP, EAX, EAX), ...shlRI(ECX, 0), ...movRR(EDX, ECX)]);
  equiv('LOAD32 / STORE32 base+disp',
    [...load32(EAX, EBX, 0x10), ...load32(ECX, EBX, 0x14),
     ...aluRR(ADD, EAX, ECX), ...store32(EAX, EBX, 0x20)]);
  equiv('LOAD32_ABS / STORE32_ABS',
    [...load32abs(EAX, DATA + 0x30), ...aluRI(6, EAX, 0x5A5A5A5A),
     ...store32abs(EAX, DATA + 0x34), ...load32abs(ECX, DATA + 0x34)]);
  equiv('MOV_SUB_RR (mov r8,r8) and the AH..BH lanes',
    [...movR8R8(0, 3), ...movR8R8(5, 0), ...movR8R8(2, 7), ...movR8R8(4, 1)]);
  equiv('ALU_SUB_RI (byte ALU r8,imm8)',
    [...aluR8I8(0, 0, 0x7F), ...aluR8I8(5, 1, 0x01),
     ...aluR8I8(4, 4, 0x0F), ...aluR8I8(7, 3, 0x10)]);
  equiv('LOAD8_RO / STORE8_RO with a high-byte lane',
    [...load8(0, EBX, 0x08), ...load8(4, EBX, 0x09),
     ...store8(0, EBX, 0x40), ...store8(4, EBX, 0x41)]);
  equiv('MOVZX8 / MOVSX8 base+disp write the whole destination',
    [...movzx8(EAX, EBX, 0x11), ...movsx8(ECX, EBX, 0x12),
     ...movzx8(EDX, EBX, 0x13), ...movsx8(EDI, EBX, 0x14)]);
  equiv('LEA_SIB / LOAD32_SIB / STORE32_SIB',
    [...leaSib(EAX, EBX, ESI, 2, 0x10), ...load32sib(ECX, EBX, ESI, 2, 0x10),
     ...aluRI(0, ECX, 1), ...store32sib(ECX, EBX, ESI, 2, 0x30)]);
  // Split one instruction per case: a byte SIB store carries its data
  // register, its lane and its address in three different fields of the same
  // encoding, and a combined case that fails names none of them.
  equiv('MOVSX8_SIB, scale 1',
    [...movsx8sib(EAX, EBX, ESI, 0, 0x18), ...movRR(ECX, EAX), ...incR(EDX)]);
  equiv('MOVSX8_SIB, scale 2',
    [...movsx8sib(EAX, EBX, ESI, 1, 0x18), ...movRR(ECX, EAX), ...incR(EDX)]);
  equiv('STORE8_SIB, low lane (AL)',
    [...movRI(EAX, 0x000000A7), ...store8sib(0, EBX, ESI, 0, 0x50), ...incR(EDX)]);
  equiv('STORE8_SIB, high lane (AH)',
    [...movRI(EAX, 0x0000B900), ...store8sib(4, EBX, ESI, 0, 0x51), ...incR(EDX)]);
  equiv('STORE8_SIB, high lane of another container (CH)',
    [...movRI(ECX, 0x00007300), ...store8sib(5, EBX, ESI, 0, 0x52), ...incR(EDX)]);
  equiv('MOVSX8_SIB then STORE8_SIB through the same base',
    [...movsx8sib(EAX, EBX, ESI, 0, 0x18), ...movsx8sib(ECX, EBX, ESI, 1, 0x18),
     ...store8sib(0, EBX, ESI, 0, 0x50), ...store8sib(4, EBX, ESI, 0, 0x51)]);
  equiv('LOAD16 / STORE16 / LOAD16_ABS keep the container top half',
    [...load16(EAX, EBX, 0x20), ...load16abs(ECX, DATA + 0x24),
     ...store16(EAX, EBX, 0x60), ...load16(EDX, EBX, 0x60)]);
  equiv('PUSH_R / POP_R move ESP through a local',
    [...pushR(EAX), ...pushR(ECX), ...popR(EDX), ...popR(EDI)], null, { stackFusion: false });
  equiv('PUSH_I',
    [...pushI(0x11223344), ...pushI(0xFFFFFFFF), ...popR(EAX), ...popR(ECX)], null, { stackFusion: false });
  equiv('a long straight-line block, 24 ops',
    Array.from({ length: 6 }, (_, i) => [
      ...aluRI(0, EAX, i + 1), ...aluRR(XOR, ECX, EAX),
      ...shlRI(EDX, 1), ...incR(EDI),
    ]).flat());

  console.log('\n-- the fallback path --');

  // ADC/SBB used to be outside the executor's vocabulary and this case existed
  // to exercise the spill / call_indirect / reload path through them. The merge
  // with H454 brought its ADC/SBB micro-ops in, so they are native now and this
  // case is a plain correctness case again -- the fallback path is covered by
  // the pushfd below it and by the explicit fallback cases further down.
  const adc = equiv('ADC r,r mid-block (now a native carry-in op)',
    [...aluRI(0, EAX, 0x80000000), ...aluRR(ADC, ECX, EDX),
     ...aluRR(XOR, EDI, ECX), ...incR(EAX)]);
  check('  ADC is native after the H454 merge', adc.on.fallbacks <= 1,
    `fallbacks=${adc.on.fallbacks} lastFallbackFn=${adc.on.lastFallbackFn} (pushfd is the only one left)`);
  equiv('SBB r,imm mid-block',
    [...aluRR(CMP, EAX, EDX), ...aluRI(3, ECX, 0x1000),
     ...aluRR(SUB, EDI, ECX), ...decR(EDX)]);
  equiv('IMUL r,r mid-block (a fallback that writes a register)',
    [...movRI(EAX, 0x00010001), ...movRI(ECX, 0x00000101),
     [0x0F, 0xAF, 0xC1], ...aluRR(ADD, EDX, EAX)].flat());
  equiv('two fallbacks back to back',
    [...aluRR(ADC, EAX, ECX), ...aluRR(SBB, EDX, EDI),
     ...aluRR(XOR, ESI, EAX), ...incR(ECX)]);
  equiv('a fallback as the FIRST body op',
    [...aluRR(ADC, EAX, ECX), ...movRR(EDX, EAX),
     ...shlRI(EDX, 2), ...aluRI(0, EDI, 7)]);

  console.log('\n-- a fault mid-block --');

  // $g2w has no mapping for guest 0, so the miss lands on NULL_SENTINEL: the
  // read returns 0 and the write goes nowhere. The point is not that it
  // faults loudly, it is that BOTH arms absorb it identically and that the
  // ops after it see the same register file -- a mid-block miss is exactly
  // where an executor holding registers in locals could diverge and then look
  // like a decoder bug thousands of instructions later.
  const flt = equiv('a load from an unmapped address, mid-block',
    [...movRI(EAX, 0x55), ...load32abs(ECX, 0), ...aluRR(ADD, EAX, ECX),
     ...store32abs(EAX, 0), ...load32(EDX, EBX, 0x10)]);
  check('  the faulting arm still finished the block', flt.on.eip === 0,
    `eip=0x${flt.on.eip.toString(16)}`);
  equiv('a store through a null base register, mid-block',
    [...movRI(EDI, 0), ...store32(EAX, EDI, 0x24),
     ...load32(ECX, EDI, 0x24), ...aluRR(OR, EDX, ECX)]);

  console.log('\n-- self-modifying code after decode --');

  {
    // Decode the block, run it, then overwrite the guest bytes and run again.
    // The second run must see the NEW code in both arms. This is the existing
    // page-invalidation machinery ($invalidate_code_write ->
    // $page_retire_at), and it keeps working only because the executor's H458
    // op is the block's FIRST op and the retirement stamp is 8 bytes wide.
    const v1 = block([...movRI(EAX, 0x1111), ...aluRI(0, EAX, 1),
                      ...movRR(ECX, EAX), ...incR(EDX)]);
    const v2 = block([...movRI(EAX, 0x2222), ...aluRI(0, EAX, 2),
                      ...movRR(ECX, EAX), ...decR(EDX)]);
    if (v1.length !== v2.length) throw new Error('the SMC pair must be the same length');

    const smc = (blockExec) => {
      const addr = nextCode();
      const wa = g2w(addr);
      const runAt = () => {
        seedData();
        e.set_eax(SEED.eax); e.set_ecx(SEED.ecx); e.set_edx(SEED.edx);
        e.set_ebx(SEED.ebx); e.set_esi(SEED.esi); e.set_edi(SEED.edi);
        e.set_ebp(0); e.set_esp(STACK_TOP);
        dv.setUint32(g2w(STACK_TOP), 0, true);
        e.set_eip(addr);
        e.run(100000);
        return `${(e.get_eax() >>> 0).toString(16)}/${(e.get_ecx() >>> 0).toString(16)}/${(e.get_edx() >>> 0).toString(16)}`;
      };
      e.set_block_exec_min_uops(2);
      e.set_block_exec(blockExec ? 1 : 0);
      for (let i = 0; i < v1.length; i++) mem[wa + i] = v1[i];
      const first = runAt();
      // Write the new code through the GUEST store path, so the code-page
      // bitmap and the retirement walk are the ones the app would trip.
      e.set_ebx(addr);
      for (let i = 0; i < v2.length; i += 4) {
        const word = v2[i] | (v2[i + 1] << 8) | (v2[i + 2] << 16) | (v2[i + 3] << 24);
        e.set_eax(word >>> 0);
        const w = nextCode();
        const ww = g2w(w);
        const st = [...store32(EAX, EBX, i), ...RET];
        for (let k = 0; k < st.length; k++) mem[ww + k] = st[k];
        e.set_esp(STACK_TOP); dv.setUint32(g2w(STACK_TOP), 0, true);
        e.set_eip(w); e.run(1000);
      }
      const second = runAt();
      e.set_block_exec(0);
      return { first, second };
    };
    const soff = smc(false);
    const son = smc(true);
    check('SMC: the first run agrees', soff.first === son.first,
      `${soff.first} vs ${son.first}`);
    check('SMC: the rewritten block is re-decoded and agrees',
      soff.second === son.second, `${soff.second} vs ${son.second}`);
    check('SMC: the rewrite actually changed the answer',
      soff.first !== soff.second, `${soff.first} == ${soff.second}`);
  }

  console.log('\n-- breakpoints --');

  {
    // Breakpoints are a $run-loop-head facility, so they are BLOCK ENTRY only
    // in the threaded interpreter too. The contract this test pins is not
    // "a mid-block breakpoint fires" (it never did) but "the two arms agree
    // about which breakpoints fire and about the state at the stop".
    const body = [...movRI(EAX, 0x1000), ...aluRI(0, EAX, 1),
                  ...movRR(ECX, EAX), ...incR(EDX), ...movRR(EDI, ECX)];
    const bytes = block(body);
    // $bp_skip_once alternates: a halt at an address arms a skip so the very
    // next entry runs the block instead of halting again. That latch is a
    // process global and survives between arms, so a naive off-then-on pair
    // measures the LATCH, not the executor -- the first arm halted, the second
    // did not, and the two disagreed for a reason that has nothing to do with
    // block-exec. Each arm therefore drives the latch to a known state first,
    // then records two consecutive entries: the documented behaviour is
    // "skipped, then halted".
    const at = (blockExec, bpDelta) => {
      const addr = nextCode();
      const wa = g2w(addr);
      for (let i = 0; i < bytes.length; i++) mem[wa + i] = bytes[i];
      e.set_bp(bpDelta === null ? 0 : addr + bpDelta);
      const once = () => {
        seedData();
        normalizeFlags();
        e.set_block_exec_min_uops(2);
      e.set_block_exec(blockExec ? 1 : 0);
        e.set_eax(SEED.eax); e.set_ecx(SEED.ecx); e.set_edx(SEED.edx);
        e.set_ebx(SEED.ebx); e.set_esi(SEED.esi); e.set_edi(SEED.edi);
        e.set_ebp(0); e.set_esp(STACK_TOP);
        dv.setUint32(g2w(STACK_TOP), 0, true);
        e.set_eip(addr);
        e.run(100000);
        const eip = e.get_eip() >>> 0;
        const where = eip === 0 ? 'ran' : (eip === addr ? 'halted@entry' : `halted@+${eip - addr}`);
        return `${where}|${(e.get_eax() >>> 0).toString(16)}|` +
               `${(e.get_ecx() >>> 0).toString(16)}|${(e.get_edx() >>> 0).toString(16)}`;
      };
      // Prime: keep entering until one entry halts, so the latch is armed.
      let guard = 0;
      while (bpDelta !== null && !once().startsWith('halted') && ++guard < 4) { /* prime */ }
      const first = once(), second = once();
      e.set_bp(0);
      e.set_block_exec(0);
      return `${first} THEN ${second}`;
    };
    // 5 is inside the block: `mov eax,imm32` is five bytes, so this is the
    // second instruction's address and never a block entry -- in the threaded
    // interpreter either, which is why the contract asserted here is that the
    // two arms AGREE, not that a mid-block breakpoint fires.
    const midOff = at(false, 5), midOn = at(true, 5);
    check('a mid-block breakpoint behaves identically in both arms',
      midOff === midOn, `${midOff}  vs  ${midOn}`);
    check('  and a mid-block breakpoint fires in neither',
      !midOff.includes('halted'), midOff);
    const entryOff = at(false, 0), entryOn = at(true, 0);
    check('an entry breakpoint stops in both arms, at the same state',
      entryOff === entryOn, `${entryOff}  vs  ${entryOn}`);
    check('  and it really stopped at the entry, with the block not yet run',
      entryOff.includes('halted@entry|1234abcd'), entryOff);
  }

  console.log('\n-- multi-block regions --');

  // A region is several basic blocks under ONE descriptor, so every case below
  // needs real control flow inside the snippet. These are the encodings the
  // single-block cases above never needed.
  const JZ = 4, JNZ = 5, JB = 2, JAE = 3, JL = 0xC, JGE = 0xD;
  const jccRel32 = (cc, rel) => [0x0F, 0x80 | cc, ...le32(rel)];
  const jmpRel32 = rel => [0xE9, ...le32(rel)];
  // Round 18 (section 28). `call rel32` is five bytes like `jmp rel32` and is
  // relative to the END of the instruction in exactly the same way, so the
  // assembler below treats the two identically -- the only thing that differs
  // is which terminator the decoder emits and, therefore, whether the region
  // classifier can model it.
  const callRel32 = rel => [0xE8, ...le32(rel)];
  const jmpAbsR = r => [0xFF, 0xE0 | r];            // jmp r32 (indirect)
  const loopRel8 = rel => [0xE2, rel & 0xFF];       // loop rel8

  // A two-pass assembler, because a multi-block snippet's displacements are
  // not knowable until every block's length is. A piece is a byte array, a
  // `{label}` marker, or a `{j, cc, to}` jump naming a label; jumps are always
  // the rel32 form so pass one's size estimate is exact.
  function asm(pieces) {
    const at = new Map();
    let off = 0;
    for (const p of pieces) {
      if (p.label !== undefined) { at.set(p.label, off); continue; }
      off += p.j !== undefined
        ? (p.j === 'jmp' || p.j === 'call' ? 5 : 6) : p.length;
    }
    const out = [];
    for (const p of pieces) {
      if (p.label !== undefined) continue;
      if (p.j === undefined) { out.push(...p); continue; }
      const size = p.j === 'jmp' || p.j === 'call' ? 5 : 6;
      const rel = at.get(p.to) - (out.length + size);
      out.push(...(p.j === 'jmp' ? jmpRel32(rel)
        : p.j === 'call' ? callRel32(rel) : jccRel32(p.cc, rel)));
    }
    return out;
  }

  // The flags probe the single-block cases append cannot be used here: it
  // would land in whichever block happens to be last rather than on the path
  // the case is about. These snippets end in `pushfd; pop ebp; ret` written
  // explicitly at the join.
  const JOIN = [...PUSHFD, ...popR(EBP), ...RET];

  let regionInstalls = 0, regionEntries = 0;

  // Same differential contract as `equiv`, plus the assertion that makes the
  // case mean anything: a descriptor of at least two blocks was installed.
  // Without it a pass says only that two identical threaded compilations agree.
  function region(name, bytes, seed, opts) {
    const off = arm(bytes, false, seed);
    const riBefore = e.get_block_exec_region_installs();
    const probesBefore = e.get_block_exec_walk_probes();
    const attemptsBefore = e.get_block_exec_walk_attempts();
    const nofitBefore = [];
    for (let r = 1; r <= 9; r += 1) nofitBefore.push(e.get_block_exec_region_nofit(r));
    const entBefore = [];
    for (let n = 2; n <= 16; n += 1) entBefore.push(e.get_block_exec_entries_by_n(n));
    const on = arm(bytes, true, seed);
    const installs = e.get_block_exec_region_installs() - riBefore;
    let entries = 0;
    for (let n = 2; n <= 16; n += 1) {
      entries += e.get_block_exec_entries_by_n(n) - entBefore[n - 2];
    }
    regionInstalls += installs; regionEntries += entries;
    const regsOk = ['eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi']
      .every(k => off[k] === on[k]);
    const ok = regsOk && off.data === on.data && off.eip === on.eip;
    check(name, ok, ok ? '' :
      `\n         off ${hexRegs(off)}\n         on  ${hexRegs(on)}` +
      `\n         eip ${off.eip.toString(16)} vs ${on.eip.toString(16)}` +
      (off.data === on.data ? '' : '\n         guest memory differs'));
    if (!(opts && opts.mayDecline)) {
      check(`  ${name}: a multi-block region installed and ran`,
        installs >= 1 && entries >= 1,
        `regionInstalls=${installs} multiBlockEntries=${entries} ` +
        `why=${e.get_block_exec_region_why()} ` +
        // Which half failed: no attempt at all means no head was ever branched
        // to (discovery never started), an attempt with no install means the
        // walk ran and the closure was refused.
        `hotProbes=${e.get_block_exec_walk_probes() - probesBefore} ` +
        `walkAttempts=${e.get_block_exec_walk_attempts() - attemptsBefore} ` +
        // $bx_region_why keeps only the LAST reason, and "the closure came out
        // shorter than two blocks" overwrites the per-member refusal that made
        // it short. The classify histogram is where that survives.
        `nofit=[${nofitBefore.map((b, i) =>
          `${i + 1}:${e.get_block_exec_region_nofit(i + 1) - b}`)
          .filter(t => !t.endsWith(':0')).join(' ')}]` +
        ` — declined, so this case proves nothing`);
    }
    return { off, on, installs, entries };
  }

  {
    // Two blocks and a back edge: the loop head tests and branches, the body
    // falls through to it. The back edge is INTERNAL -- it resolves to a
    // member, not an exit -- which is the property that makes a loop worth
    // folding at all.
    region('2-block if/else loop', asm([
      [...movRI(ECX, 6), ...movRI(EAX, 0)],
      { label: 'top' },
      [...aluRI(7, ECX, 0)],                       // cmp ecx,0
      { j: 'jcc', cc: JZ, to: 'out' },
      [...aluRR(ADD, EAX, ECX), ...decR(ECX)],
      { j: 'jmp', to: 'top' },
      { label: 'out' },
      JOIN,
    ]));

    // A diamond: one test, two arms, one join. Both arms are members and the
    // join is a member too, so the whole shape is one descriptor and neither
    // arm costs a transfer.
    //
    // The leading `jmp` is not decoration. Discovery starts at heads the guest
    // BRANCHES to, which is what makes the walk cost once per hot head rather
    // than once per decode; a diamond with no back edge and no branch into its
    // test block is never a head at all. In a real binary that entry edge is
    // the call or the branch that reaches the function; here it has to be
    // written down.
    // Six iterations, not two. Discovery is hotness-gated, so a region is
    // installed a couple of entries INTO the loop and only the iterations
    // after that one enter it; a snippet that stops as soon as the descriptor
    // exists installs it and proves nothing about running it.
    region('diamond (both arms and the join in one region)', asm([
      [...movRI(ECX, 6)],
      { label: 'top' },
      [...aluRI(7, ESI, 4)],                       // cmp esi,4
      { j: 'jcc', cc: JB, to: 'low' },
      [...movRI(EAX, 0x1111), ...aluRR(ADD, EAX, ESI)],
      { j: 'jmp', to: 'join' },
      { label: 'low' },
      [...movRI(EAX, 0x2222), ...aluRR(SUB, EAX, ESI)],
      { label: 'join' },
      [...movRR(EDX, EAX), ...incR(EDX), ...decR(ESI), ...decR(ECX)],
      { j: 'jcc', cc: JNZ, to: 'top' },
      JOIN,
    ]));

    // A three-state machine driven off guest memory: several blocks, several
    // internal edges and one exit. This is the shape the census counted as
    // 5-16 block, in miniature.
    region('state machine over guest memory', asm([
      [...movRI(ECX, 8), ...movRI(EAX, 0)],
      { label: 'top' },
      [...aluRI(7, ECX, 0)],
      { j: 'jcc', cc: JZ, to: 'out' },
      // `test edx,1` here; the `and edx,1` twin, which writes a register as
      // well as the flags, is a terminator producer too since round 10 and has
      // its own case below.
      [...load32(EDX, EBX, 0x40), 0xF7, 0xC0 | EDX, ...le32(1)],
      { j: 'jcc', cc: JZ, to: 'even' },
      [...aluRI(0, EAX, 0x10), ...store32(EAX, EBX, 0x44)],
      { j: 'jmp', to: 'step' },
      { label: 'even' },
      [...aluRI(5, EAX, 3), ...store32(EAX, EBX, 0x48)],
      { label: 'step' },
      [...decR(ECX)],
      { j: 'jmp', to: 'top' },
      { label: 'out' },
      JOIN,
    ]));

    // The head reached by a TAKEN Jcc, going forward. Round 9's discovery
    // walked $decode_run's fall-through chain, so a region whose head is a
    // branch target was invisible to it however hot it got; this is the case
    // that was measured at ~0% coverage and is the reason the walk exists.
    region('a region whose head is a forward Jcc target', asm([
      [...movRI(ECX, 6), ...movRI(EAX, 0)],
      [...aluRI(7, ESI, 0)],                       // cmp esi,0 (seeded 4)
      { j: 'jcc', cc: JNZ, to: 'top' },
      [...movRI(EAX, 0xDEAD)],                     // never runs
      { j: 'jmp', to: 'out' },
      { label: 'top' },
      [...aluRI(7, ECX, 0)],
      { j: 'jcc', cc: JZ, to: 'out' },
      [...aluRR(ADD, EAX, ECX), ...decR(ECX)],
      { j: 'jmp', to: 'top' },
      { label: 'out' },
      JOIN,
    ]));

    // The head reached ONLY by a back edge: the first entry falls through into
    // it, so the one branch that ever targets it is the loop's own `jmp` at
    // the bottom. Three blocks, so the region is not the degenerate two.
    region('a region entered from a loop back edge', asm([
      [...movRI(ECX, 6), ...movRI(EAX, 0)],
      { label: 'top' },
      [...aluRI(7, ECX, 0)],
      { j: 'jcc', cc: JZ, to: 'out' },
      [...load32(EDX, EBX, 0x50), ...aluRI(4, EDX, 1)],   // and edx,1
      { j: 'jcc', cc: JZ, to: 'even' },
      [...aluRI(0, EAX, 5)],
      { label: 'even' },
      [...decR(ECX)],
      { j: 'jmp', to: 'top' },
      { label: 'out' },
      JOIN,
    ]));

    // `and r,imm` as the terminator's flag producer -- term_kind 9. Round 9
    // declined this shape 1.8M times on Diablo alone (`noFlagProducer`), which
    // is what item 2 of round 10 is about. The `and` writes EDX as well as the
    // flags, so a wrong fold shows up in the register compare, not only in the
    // branch.
    region('ALU r,imm as the terminator flag producer', asm([
      [...movRI(ECX, 6), ...movRI(EAX, 0)],
      { label: 'top' },
      [...movRR(EDX, ECX), ...aluRI(4, EDX, 3)],   // and edx,3
      { j: 'jcc', cc: JZ, to: 'four' },
      [...aluRI(0, EAX, 0x11)],
      { j: 'jmp', to: 'step' },
      { label: 'four' },
      [...aluRI(5, EAX, 7)],
      { label: 'step' },
      [...decR(ECX)],
      { j: 'jcc', cc: JNZ, to: 'top' },
      { label: 'out' },
      JOIN,
    ]));

    // `sub r,r` as the producer -- term_kind 8, the register-register half of
    // the same widening.
    region('ALU r,r as the terminator flag producer', asm([
      [...movRI(ECX, 6), ...movRI(EAX, 0)],
      { label: 'top' },
      [...movRR(EDX, ECX), ...aluRR(SUB, EDX, ESI)],   // sub edx,esi
      { j: 'jcc', cc: JZ, to: 'hit' },
      [...aluRI(0, EAX, 0x11)],
      { j: 'jmp', to: 'step' },
      { label: 'hit' },
      [...aluRI(5, EAX, 7)],
      { label: 'step' },
      [...decR(ECX)],
      { j: 'jcc', cc: JNZ, to: 'top' },
      { label: 'out' },
      JOIN,
    ]));
  }

  {
    // The two cost bounds on discovery, checked by forcing them rather than by
    // reading the code: a budget too small to reach the closure must DECLINE
    // (not install a truncated region), and a head that keeps declining must
    // stop being attempted at all.
    const wide = asm([
      [...movRI(ECX, 40), ...movRI(EAX, 0)],
      { label: 'top' },
      [...aluRI(7, ECX, 0)],
      { j: 'jcc', cc: JZ, to: 'out' },
      [...load32(EDX, EBX, 0x50), ...aluRI(4, EDX, 1)],
      { j: 'jcc', cc: JZ, to: 'even' },
      [...aluRI(0, EAX, 5)],
      { j: 'jmp', to: 'step' },
      { label: 'even' },
      [...aluRI(5, EAX, 3)],
      { label: 'step' },
      [...decR(ECX)],
      { j: 'jmp', to: 'top' },
      { label: 'out' },
      JOIN,
    ]);

    e.set_block_exec_walk_budget(1);
    const whyAll = [];
    for (let w = 1; w <= 9; w += 1) whyAll.push(e.get_block_exec_region_why_n(w));
    const whyBefore = e.get_block_exec_region_why_n(8);
    const insBefore = e.get_block_exec_region_installs();
    const attBefore = e.get_block_exec_walk_attempts();
    const probeBefore = e.get_block_exec_walk_probes();
    const budgetOff = arm(wide, false);
    const budgetOn = arm(wide, true);
    const budgetDeclines = e.get_block_exec_region_why_n(8) - whyBefore;
    const declinesAny = whyAll.reduce(
      (n, b, i) => n + (e.get_block_exec_region_why_n(i + 1) - b), 0);
    const budgetInstalls = e.get_block_exec_region_installs() - insBefore;
    const attempts = e.get_block_exec_walk_attempts() - attBefore;
    const probes = e.get_block_exec_walk_probes() - probeBefore;

    // "Cleanly" is the claim: nothing installs, the decline is recorded, and
    // the guest gets the same answer either way. Which reason is recorded is
    // not fixed — a budget of one stops the walk before the head's successors
    // are ever classified, so the closure comes out short (reason 6) rather
    // than over budget (reason 8); either is a refusal, and neither truncates.
    check('a budget too small to reach the closure declines',
      declinesAny >= 1 && budgetInstalls === 0,
      `walkBudget declines=${budgetDeclines} installs=${budgetInstalls} ` +
      `attempts=${attempts} probes=${probes} ` +
      `why=[${whyAll.map((b, i) => `${i + 1}:${e.get_block_exec_region_why_n(i + 1) - b}`)
        .filter(t => !t.endsWith(':0')).join(' ')}]`);
    check('  and the block still runs correctly',
      ['eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi']
        .every(k => budgetOff[k] === budgetOn[k]) &&
      budgetOff.data === budgetOn.data && budgetOff.eip === budgetOn.eip,
      `off ${hexRegs(budgetOff)}\n         on  ${hexRegs(budgetOn)}`);
    // 40 iterations at K=2 is about twenty gate firings on the loop head. The
    // memo caps what those cost: a head that has declined its limit is never
    // walked again, so attempts stop while probes keep arriving.
    check('  a head that keeps declining stops being attempted',
      attempts < probes && attempts <= 12,
      `attempts=${attempts} probes=${probes}`);
    check('    and the memo is what stopped them',
      e.get_block_exec_walk_memo() > 0,
      `memoRefusals=${e.get_block_exec_walk_memo()}`);
    e.set_block_exec_walk_budget(24);
  }

  {
    // Entry from OUTSIDE into a member. The region publishes over its whole
    // guest extent, so the interior address is not in the index as a block of
    // its own; jumping there must decode it on its own terms and produce the
    // same answer as the threaded build, not run the region from its head.
    const pieces = asm([
      [...movRI(EAX, 0x100)],
      { label: 'mid' },
      [...aluRI(7, ECX, 0)],
      { j: 'jcc', cc: JZ, to: 'out' },
      [...aluRI(0, EAX, 7), ...decR(ECX)],
      { j: 'jmp', to: 'mid' },
      { label: 'out' },
      JOIN,
    ]);
    // Where `mid` lands: after the 5-byte `mov eax,imm32`.
    const MID = 5;
    const inner = (blockExec) => {
      const addr = nextCode();
      const wa = g2w(addr);
      for (let i = 0; i < pieces.length; i++) mem[wa + i] = pieces[i];
      e.set_block_exec_min_uops(2);
      e.set_block_exec(blockExec ? 1 : 0);
      const go = (from) => {
        seedData();
        normalizeFlags();
        e.set_block_exec_min_uops(2);
        e.set_block_exec(blockExec ? 1 : 0);
        e.set_eax(0); e.set_ecx(4); e.set_edx(0); e.set_ebx(DATA);
        e.set_esi(SEED.esi); e.set_edi(SEED.edi); e.set_ebp(0);
        e.set_esp(STACK_TOP);
        dv.setUint32(g2w(STACK_TOP), 0, true);
        e.set_eip(from);
        e.run(100000);
        return `${(e.get_eax() >>> 0).toString(16)}/${(e.get_ecx() >>> 0).toString(16)}`;
      };
      const head = go(addr);          // builds the region
      const mid = go(addr + MID);     // enters a member from outside
      const again = go(addr);         // and the head still works afterwards
      e.set_block_exec(0);
      return `${head} ${mid} ${again}`;
    };
    const eoff = inner(false), eon = inner(true);
    check('a jump into the middle of a region agrees with threaded',
      eoff === eon, `${eoff}  vs  ${eon}`);
  }

  {
    // SMC of a MEMBER, not of the head. The region covers the member's bytes,
    // so the ordinary per-page cover marks have to retire the whole region --
    // if they only retired a block that no longer exists in the index, the
    // stale region would keep running the old code.
    const mk = (delta) => asm([
      [...movRI(EAX, 0), ...movRI(ECX, 3)],
      { label: 'top' },
      [...aluRI(7, ECX, 0)],
      { j: 'jcc', cc: JZ, to: 'out' },
      [...aluRI(0, EAX, delta), ...decR(ECX)],     // <- the member that is rewritten
      { j: 'jmp', to: 'top' },
      { label: 'out' },
      JOIN,
    ]);
    const v1 = mk(0x11), v2 = mk(0x22);
    if (v1.length !== v2.length) throw new Error('the member-SMC pair must be the same length');
    const memberSmc = (blockExec) => {
      const addr = nextCode();
      const wa = g2w(addr);
      for (let i = 0; i < v1.length; i++) mem[wa + i] = v1[i];
      const runAt = () => {
        seedData();
        normalizeFlags();
        e.set_block_exec_min_uops(2);
        e.set_block_exec(blockExec ? 1 : 0);
        e.set_eax(0); e.set_ecx(0); e.set_edx(0); e.set_ebx(DATA);
        e.set_esi(SEED.esi); e.set_edi(SEED.edi); e.set_ebp(0);
        e.set_esp(STACK_TOP);
        dv.setUint32(g2w(STACK_TOP), 0, true);
        e.set_eip(addr);
        e.run(100000);
        return (e.get_eax() >>> 0).toString(16);
      };
      e.set_block_exec_min_uops(2);
      e.set_block_exec(blockExec ? 1 : 0);
      const first = runAt();
      // Rewrite through the guest store path, as the head-SMC case does.
      for (let i = 0; i < v2.length; i += 4) {
        if (v1[i] === v2[i] && v1[i + 1] === v2[i + 1]
            && v1[i + 2] === v2[i + 2] && v1[i + 3] === v2[i + 3]) continue;
        const word = v2[i] | (v2[i + 1] << 8) | (v2[i + 2] << 16) | (v2[i + 3] << 24);
        const w = nextCode();
        const ww = g2w(w);
        const st = [...store32(EAX, EBX, i), ...RET];
        for (let k = 0; k < st.length; k++) mem[ww + k] = st[k];
        e.set_eax(word >>> 0); e.set_ebx(addr);
        e.set_esp(STACK_TOP); dv.setUint32(g2w(STACK_TOP), 0, true);
        e.set_eip(w); e.run(1000);
      }
      const second = runAt();
      e.set_block_exec(0);
      return { first, second };
    };
    const moff = memberSmc(false), mon = memberSmc(true);
    check('SMC of a region member: the first run agrees',
      moff.first === mon.first, `${moff.first} vs ${mon.first}`);
    check('SMC of a region member: the rewrite is seen',
      moff.second === mon.second, `${moff.second} vs ${mon.second}`);
    check('SMC of a region member: the rewrite changed the answer',
      moff.first !== moff.second, `${moff.first} == ${moff.second}`);
  }

  {
    // A fault inside a region. With --fault-null unarmed an unmapped access
    // reads the NULL sentinel and writes nowhere; the contract is that a
    // region absorbs it exactly as threaded code does, from a member block
    // rather than from the head.
    // Round 13: the region walker no longer decodes, so a member has to be a
    // block the guest has ALREADY run, and a one-block descriptor standing on
    // one has to be taken back and republished first ($bx_raw_want). Both cost
    // iterations, so the loop count here is about giving discovery room, not
    // about the fault this case is measuring.
    region('an unmapped access from a member matches threaded', asm([
      [...movRI(ECX, 20), ...movRI(EAX, 0)],
      { label: 'top' },
      [...aluRI(7, ECX, 0)],
      { j: 'jcc', cc: JZ, to: 'out' },
      [...load32abs(EDX, 0x7F000000), ...aluRR(ADD, EAX, EDX), ...decR(ECX)],
      { j: 'jmp', to: 'top' },
      { label: 'out' },
      JOIN,
    ]));
  }

  {
    // Budget expiry mid-region. `run(3)` cannot finish the loop, so the region
    // must side-exit at a block edge with every register published and resume
    // from a real basic-block entry. Driving both arms in the same small
    // slices is the only way to see that the stop points agree.
    const bytes = asm([
      [...movRI(ECX, 12), ...movRI(EAX, 0)],
      { label: 'top' },
      [...aluRI(7, ECX, 0)],
      { j: 'jcc', cc: JZ, to: 'out' },
      [...aluRI(0, EAX, 5), ...decR(ECX)],
      { j: 'jmp', to: 'top' },
      { label: 'out' },
      JOIN,
    ]);
    const sliced = (blockExec) => {
      const addr = nextCode();
      const wa = g2w(addr);
      for (let i = 0; i < bytes.length; i++) mem[wa + i] = bytes[i];
      seedData();
      normalizeFlags();
      e.set_block_exec_min_uops(2);
      e.set_block_exec(blockExec ? 1 : 0);
      e.set_eax(0); e.set_ecx(0); e.set_edx(0); e.set_ebx(DATA);
      e.set_esi(SEED.esi); e.set_edi(SEED.edi); e.set_ebp(0);
      e.set_esp(STACK_TOP);
      dv.setUint32(g2w(STACK_TOP), 0, true);
      e.set_eip(addr);
      const trace = [];
      for (let i = 0; i < 200 && (e.get_eip() >>> 0) !== 0; i += 1) {
        e.run(3);
        const eip = e.get_eip() >>> 0;
        trace.push(`${eip === 0 ? 'ran' : eip - addr}:${(e.get_eax() >>> 0).toString(16)}` +
                   `/${(e.get_ecx() >>> 0).toString(16)}`);
      }
      e.set_block_exec(0);
      return trace.join(' ');
    };
    const boff = sliced(false), bon = sliced(true);
    check('a region interrupted by the block budget resumes identically',
      boff === bon,
      `\n         off ${boff.slice(0, 200)}\n         on  ${bon.slice(0, 200)}`);
    check('  and it really was interrupted', boff.split(' ').length > 3,
      `${boff.split(' ').length} slices`);
  }

  {
    // A breakpoint on a member's entry. Breakpoints are a $run-loop-head
    // facility, so the contract is the same one the single-block case pins:
    // the two arms agree about which entries halt and about the state there.
    const bytes = asm([
      [...movRI(ECX, 3), ...movRI(EAX, 0)],
      { label: 'top' },
      [...aluRI(7, ECX, 0)],
      { j: 'jcc', cc: JZ, to: 'out' },
      [...aluRI(0, EAX, 9), ...decR(ECX)],
      { j: 'jmp', to: 'top' },
      { label: 'out' },
      JOIN,
    ]);
    const TOP = 10;   // two 5-byte `mov r,imm32`
    const withBp = (blockExec) => {
      const addr = nextCode();
      const wa = g2w(addr);
      for (let i = 0; i < bytes.length; i++) mem[wa + i] = bytes[i];
      e.set_bp(addr + TOP);
      const once = () => {
        seedData();
        normalizeFlags();
        e.set_block_exec_min_uops(2);
        e.set_block_exec(blockExec ? 1 : 0);
        e.set_eax(0); e.set_ecx(0); e.set_edx(0); e.set_ebx(DATA);
        e.set_esi(SEED.esi); e.set_edi(SEED.edi); e.set_ebp(0);
        e.set_esp(STACK_TOP);
        dv.setUint32(g2w(STACK_TOP), 0, true);
        e.set_eip(addr);
        e.run(100000);
        const eip = e.get_eip() >>> 0;
        return `${eip === 0 ? 'ran' : `@+${eip - addr}`}|` +
               `${(e.get_eax() >>> 0).toString(16)}/${(e.get_ecx() >>> 0).toString(16)}`;
      };
      let guard = 0;
      while (!once().startsWith('@') && ++guard < 4) { /* prime the skip latch */ }
      const r = `${once()} THEN ${once()}`;
      e.set_bp(0);
      e.set_block_exec(0);
      return r;
    };
    const pOff = withBp(false), pOn = withBp(true);
    check('a breakpoint inside a region behaves identically in both arms',
      pOff === pOn, `${pOff}  vs  ${pOn}`);
  }

  console.log(`  ${regionInstalls} multi-block regions installed, ` +
    `${regionEntries} entries into one`);
  check('the multi-block matcher installed something in this run',
    regionInstalls >= 3, `regionInstalls=${regionInstalls}`);

  console.log('\n-- declines --');

  console.log('\n-- round 11: the decode-time load/op split --');

  // Everything below is differential in the same way as the rest of this file,
  // but a differential pass is NOT the assertion that matters here. A pass
  // that never fires also produces two identical arms, so each case asserts
  // the meter as well: `rle >= 1` for the ones where a load really is
  // redundant, and `rle === 0` for the ones where the alias rule must refuse.
  // The negatives are the point — §16.2's rule is only worth writing down if
  // something checks that it is obeyed.
  const store8abs = (s8, abs) => [0x88, 0x05 | (s8 << 3), ...le32(abs)];

  const splitCase = (name, body, want, seed) => {
    const r = equiv(name, body, seed);
    const p = r.on.pass;
    for (const k of Object.keys(want)) {
      const [op, n] = want[k];
      const got = p[k];
      check(`  ${name}: ${k} ${op} ${n}`,
        op === '>=' ? got >= n : got === n,
        `${k}=${got} (split=${p.split} rle=${p.rle} movelim=${p.movelim} ` +
        `immfold=${p.immfold} stlf=${p.stlf})`);
    }
    return r;
  };

  // (b) redundant-load elimination, the positive. Two dword reads of one
  // absolute address with nothing between them that the rule kills, so the
  // second becomes a register move off the first.
  splitCase('two loads of one address: the second is eliminated',
    [...load32abs(EAX, DATA + 0x30), ...aluRR(XOR, ECX, ECX),
     ...load32abs(EDX, DATA + 0x30), ...aluRR(ADD, EDX, ECX)],
    { rle: ['>=', 1] });

  // The alias rule, clause by clause. Each of these would be a correctness bug
  // if the load were eliminated, and each is a *shape* the rule names rather
  // than a value it computed, because nothing at decode time knows the values.
  splitCase('an aliasing store between two loads blocks elimination',
    [...load32abs(EAX, DATA + 0x30), ...store32abs(ECX, DATA + 0x30),
     ...load32abs(EDX, DATA + 0x30), ...aluRR(ADD, EDX, EAX)],
    { rle: ['==', 0] });

  splitCase('a DISJOINT store between two loads does not block it',
    [...load32abs(EAX, DATA + 0x30), ...store32abs(ECX, DATA + 0x40),
     ...load32abs(EDX, DATA + 0x30), ...aluRR(ADD, EDX, EAX)],
    { rle: ['>=', 1] });

  // Partial-width overlap: one byte inside the dword. The ranges intersect, so
  // the fact dies even though the widths differ — this is the case a
  // same-width-only comparison would get wrong.
  splitCase('a byte store INSIDE the loaded dword blocks elimination',
    [...load32abs(EAX, DATA + 0x30), ...store8abs(ECX, DATA + 0x31),
     ...load32abs(EDX, DATA + 0x30), ...aluRR(ADD, EDX, EAX)],
    { rle: ['==', 0] });

  splitCase('a byte store one past the dword does not block it',
    [...load32abs(EAX, DATA + 0x30), ...store8abs(ECX, DATA + 0x34),
     ...load32abs(EDX, DATA + 0x30), ...aluRR(ADD, EDX, EAX)],
    { rle: ['>=', 1] });

  // The base register written between the two loads: same displacement, two
  // different addresses.
  splitCase('a write to the base register between two loads blocks it',
    [...load32(EAX, EBX, 0x30), ...incR(EBX),
     ...load32(EDX, EBX, 0x30), ...aluRR(ADD, EDX, EAX)],
    { rle: ['==', 0] });

  // An op the classifier does not model — `cdq` is a FALLBACK here — stands in
  // for every opaque thing a block can contain, a call included: the pass
  // cannot see what it touched, so every fact dies.
  splitCase('an unmodelled op between two loads blocks it',
    [...load32abs(EAX, DATA + 0x30), ...CDQ,
     ...load32abs(EDX, DATA + 0x30), ...aluRR(ADD, EDX, EAX)],
    { rle: ['==', 0] });

  // push/pop move ESP and write memory the pass does not model as a store.
  splitCase('a push/pop pair between two loads blocks it',
    [...load32abs(EAX, DATA + 0x30), ...pushR(ECX), ...popR(ECX),
     ...load32abs(EDX, DATA + 0x30), ...aluRR(ADD, EDX, EAX)],
    { rle: ['==', 0] });

  // (a) the split itself: `op r32,[mem]` is one micro-op today only as a
  // FALLBACK, so taking it apart into a load into a temp lane plus the
  // register form is what converts it to native. The differential is the whole
  // assertion for correctness; `split >= 1` says it actually happened.
  splitCase('add r32,[base+disp] is split into a load and a register add',
    [...aluRM(ADD_RM, EAX, EBX, 0x10), ...aluRR(XOR, ECX, ECX),
     ...aluRM(SUB_RM, EDX, EBX, 0x14), ...aluRR(ADD, EDX, ECX)],
    { split: ['>=', 1] });

  splitCase('and/or/xor/cmp r32,[abs] split the same way',
    [...aluRAbs(AND_RM, EAX, DATA + 0x20), ...aluRAbs(OR_RM, ECX, DATA + 0x24),
     ...aluRAbs(XOR_RM, EDX, DATA + 0x28), ...aluRAbs(CMP_RM, EBX, DATA + 0x2C)],
    { split: ['>=', 1] });

  splitCase('imul r32,[base+disp] splits',
    [...imulRM(EAX, EBX, 0x18), ...aluRR(XOR, ECX, ECX),
     ...imulRM(EDX, EBX, 0x1C), ...aluRR(ADD, EDX, ECX)],
    { split: ['>=', 1] });

  // A split load feeding a second op at the SAME address: the temp lane the
  // first split wrote is itself a fact, so the second split's load is
  // redundant. This is the compound case the two transforms only reach
  // together, and the one that would break loudly if the lane allocator
  // reused a live lane.
  splitCase('two memory-source ops on one address share the loaded lane',
    [...aluRM(ADD_RM, EAX, EBX, 0x10), ...aluRM(SUB_RM, EDX, EBX, 0x10),
     ...aluRR(XOR, ECX, ECX), ...aluRR(ADD, ECX, EAX)],
    { split: ['>=', 2], rle: ['>=', 1] });

  // (d) register-move elimination and (e) immediate folding. Both are about a
  // micro-op disappearing rather than a memory access, so the meter is the
  // only way to see them at all.
  // The source here is a LOAD, not an immediate, on purpose: a move off a
  // known constant is folded by (e) instead and the move never reaches (d),
  // which is exactly what the first draft of this case measured by accident.
  // And the consumer must REDEFINE the moved register — `mov ecx,eax ; add
  // edx,ecx` is not a move-elimination shape at all, because ecx stays live.
  splitCase('a move feeding the next op that redefines it is removed',
    [...load32abs(EAX, DATA + 0x30), ...movRR(ECX, EAX), ...aluRR(ADD, ECX, ESI),
     ...aluRR(XOR, EDI, ECX)],
    { movelim: ['>=', 1] });

  splitCase('a move the next op simply overwrites is removed',
    [...load32abs(EAX, DATA + 0x30), ...movRR(ECX, EAX), ...movRR(ECX, EDX),
     ...aluRR(XOR, EDI, ECX)],
    { movelim: ['>=', 1] });

  splitCase('a move off a known constant folds to an immediate',
    [...movRI(EAX, 0x0000BEEF), ...movRR(ECX, EAX), ...aluRR(ADD, EDX, ECX),
     ...aluRR(XOR, EDI, EDX)],
    { immfold: ['>=', 1] });

  // Store-to-load forwarding is REMOVED, not merely unused: the $g2w NULL
  // sentinel discards a store to an unmapped address and returns 0 for the
  // load, so a forwarded value and the real one differ with nothing to say so.
  // This asserts the meter stays at zero, which is what stops the transform
  // being reintroduced under the same name without the sentinel being fixed.
  const stlfProbe = splitCase('store-to-load forwarding never fires',
    [...movRI(EAX, 0x1234ABCD), ...store32abs(EAX, DATA + 0x30),
     ...load32abs(EDX, DATA + 0x30), ...aluRR(XOR, ECX, EDX)],
    { stlf: ['==', 0] });
  check('  a store still kills the fact rather than seeding one',
    stlfProbe.on.pass.rle === 0, `rle=${stlfProbe.on.pass.rle}`);

  // And the case that caught it: a store through a register holding an
  // unmapped address, followed by a read back. The threaded arm reads 0.
  splitCase('a store through a null base register, then a read back',
    [...movRI(EBX, 0), ...movRI(EAX, 0x1234ABCD), ...store32(EAX, EBX, 0x40),
     ...load32(ECX, EBX, 0x40), ...aluRR(XOR, EDX, ECX)],
    { stlf: ['==', 0] });

  // ------------------------------------------------------------------
  // Round 12 section 18: carrying a load fact ACROSS a region edge.
  //
  // Section 16.2 always permitted this where the target has a single
  // predecessor inside the region; round 11 carried nothing, because the edge
  // set is not resolved until every member has been classified. These four
  // cases are the rule's four corners, and each asserts BOTH that the two arms
  // agree and what the pass did, since "the arms agree" cannot tell a sound
  // carry from no carry at all.
  // ------------------------------------------------------------------
  {
    // (1) THE CARRY ITSELF. The same shape round 11 used to assert
    // `rle === 0` across the edge: the head loads DATA+0x30, falls through to
    // a block that loads it again, and nothing in between kills the fact, so
    // the second load is now a register move. Deliberately re-written from the
    // round-11 case rather than added beside it, because that assertion was a
    // statement about the implementation's conservatism, not about the rule.
    const carried = asm([
      [...movRI(ECX, 6), ...movRI(EAX, 0)],
      { label: 'top' },
      [...load32abs(EDX, DATA + 0x30), ...aluRR(ADD, EAX, EDX),
       ...decR(ECX), ...aluRI(7, ECX, 0)],
      { j: 'jcc', cc: JZ, to: 'out' },
      [...load32abs(EDI, DATA + 0x30), ...aluRR(ADD, EAX, EDI),
       ...aluRR(XOR, ESI, ESI)],
      { j: 'jmp', to: 'top' },
      { label: 'out' },
      JOIN,
    ]);
    const r = region('a fact carried along a fall-through is reused', carried);
    check('  the carried load was eliminated',
      r.on.pass.rle >= 1, `rle=${r.on.pass.rle}`);
    // ...and the A/B partner really is one: with the carry off the same bytes
    // eliminate nothing, which is what makes the counter above attributable to
    // this lever rather than to an in-block redundancy.
    e.set_block_exec_carry(0);
    const offArm = arm(carried, true);
    e.set_block_exec_carry(1);
    check('  --no-block-exec-carry eliminates nothing',
      offArm.pass.rle === 0, `rle=${offArm.pass.rle}`);
    check('  and both carry arms agree with threaded',
      offArm.eax === r.off.eax && offArm.edi === r.off.edi,
      `eax ${offArm.eax.toString(16)} vs ${r.off.eax.toString(16)}`);
  }

  {
    // (2) A TWO-PREDECESSOR JOIN. The diamond's join is reached from both arms,
    // so neither arm's exit state describes it and no fact may cross. The arms
    // are kept load-free so the only load pair in the region is the head's and
    // the join's -- otherwise a carry into an ARM (legal: each has one
    // predecessor) would count in the same meter and the assertion would be
    // about the wrong edge.
    // The branch ALTERNATES (EBX flips in the join) for a round-13 reason: a
    // walk only ever collects blocks the guest has RUN, so an arm that is never
    // taken is not a member, and the join it feeds then has one in-region
    // predecessor instead of two -- which makes the carry legal and leaves this
    // case asserting nothing. Flipping every iteration runs both arms from the
    // first two, well before discovery converges. The trip count is also
    // raised, because discovery now needs a couple of iterations to take its
    // members back from the one-block installer.
    // There is exactly ONE load in the region, and it is in the join. The fact
    // it produces travels the back edge into `top` (one in-region predecessor,
    // so that carry is legal) and on into whichever arm runs -- and has to be
    // REFUSED at the join's own entry, which both arms reach. A second load in
    // the head would make the meter ambiguous: the carry into an arm is legal
    // and would count in the same counter as the illegal one.
    const r = region('a fact is NOT carried into a two-predecessor join', asm([
      [...movRI(ECX, 20), ...movRI(EAX, 0), ...movRI(EBX, 0)],
      { label: 'top' },
      [...aluRI(7, EBX, 0)],
      { j: 'jcc', cc: JZ, to: 'low' },
      [...aluRI(0, EAX, 0x11)],
      { j: 'jmp', to: 'join' },
      { label: 'low' },
      [...aluRI(5, EAX, 7)],
      { label: 'join' },
      [...load32abs(EDI, DATA + 0x30), ...aluRR(ADD, EAX, EDI),
       ...aluRI(6, EBX, 1), ...decR(ECX)],
      { j: 'jcc', cc: JNZ, to: 'top' },
      { label: 'out' },
      JOIN,
    ]));
    check('  nothing was eliminated at the join',
      r.on.pass.rle === 0,
      `rle=${r.on.pass.rle} installs=${r.installs} entries=${r.entries}`);
  }

  {
    // ROUND 13 REGRESSION -- AN INSTALL MUST NOT COST A DECODE.
    //
    // Discovery used to re-decode, twice over: the region walker ran
    // $decode_run on every candidate successor, and the one-block installer
    // displaced the threaded stream a later walk needed, so the same block was
    // decoded again and again. On the 1000-batch quake2 window that was
    // 3,108,885 block decodes against 781,266 with the family off. The walker
    // now classifies out of the compiled page ($page_cached_ops) and never
    // decodes; a descriptor standing on a block discovery wants carries a
    // verbatim copy of the stream it displaced.
    //
    // Measuring that here is a hard assertion rather than a number: run ONE
    // loop from ONE address until everything about it has settled, and the
    // last run must decode nothing at all. A walker that decodes shows up as a
    // nonzero count on every run, forever, because the hot gate re-arms.
    const bytes = asm([
      [...movRI(ECX, 400), ...movRI(EAX, 0)],
      { label: 'top' },
      [...aluRI(7, ECX, 0)],
      { j: 'jcc', cc: JZ, to: 'out' },
      [...aluRR(ADD, EAX, ECX), ...decR(ECX)],
      { j: 'jmp', to: 'top' },
      { label: 'out' },
      JOIN,
    ]);
    const addr = nextCode();
    const wa = g2w(addr);
    for (let i = 0; i < bytes.length; i += 1) mem[wa + i] = bytes[i];
    e.set_block_exec_min_uops(2);
    e.set_block_exec(1);
    const runOnce = () => {
      seedData();
      normalizeFlags();
      e.set_eax(SEED.eax); e.set_ecx(SEED.ecx); e.set_edx(SEED.edx);
      e.set_ebx(SEED.ebx); e.set_esi(SEED.esi); e.set_edi(SEED.edi);
      e.set_ebp(0);
      e.set_esp(STACK_TOP);
      dv.setUint32(g2w(STACK_TOP), 0, true);
      const d0 = e.get_cache_stores();
      const i0 = e.get_block_exec_installs();
      const r0 = e.get_block_exec_region_installs();
      e.set_eip(addr);
      e.run(200000);
      return {
        decodes: e.get_cache_stores() - d0,
        installs: e.get_block_exec_installs() - i0,
        regions: e.get_block_exec_region_installs() - r0,
        eax: e.get_eax() >>> 0,
      };
    };
    const first = runOnce();
    let settled = first;
    let totalDecodes = first.decodes;
    for (let k = 0; k < 8; k += 1) {
      settled = runOnce();
      totalDecodes += settled.decodes;
    }
    check('  a settled loop decodes nothing on a re-run',
      settled.decodes === 0,
      `decodes=${settled.decodes} (first run ${first.decodes}, ` +
      `9 runs ${totalDecodes}) installs=${settled.installs} ` +
      `regions=${settled.regions}`);
    // The decode count is only meaningful if the executor really did claim it.
    check('  ...with the block installed',
      e.get_block_exec_installs() > 0, 'no install at all');
    check('  and it still computes the same sum',
      settled.eax === first.eax,
      `${settled.eax.toString(16)} vs ${first.eax.toString(16)}`);
  }

  {
    // (3) A STORE ON THE CARRIED EDGE. Same single-predecessor fall-through as
    // (1), with a store to the very address the fact names sitting between the
    // two loads. The kill rule is unchanged by the carry, so the second load
    // must survive -- and if it did not the differential compare would catch
    // it, because the store changes what is there.
    const r = region('a store on the carried edge kills the fact', asm([
      [...movRI(ECX, 6), ...movRI(EAX, 0)],
      { label: 'top' },
      [...load32abs(EDX, DATA + 0x30), ...aluRR(ADD, EAX, EDX),
       ...incR(EDX), ...store32abs(EDX, DATA + 0x30),
       ...decR(ECX), ...aluRI(7, ECX, 0)],
      { j: 'jcc', cc: JZ, to: 'out' },
      [...load32abs(EDI, DATA + 0x30), ...aluRR(ADD, EAX, EDI),
       ...aluRR(XOR, ESI, ESI)],
      { j: 'jmp', to: 'top' },
      { label: 'out' },
      JOIN,
    ]));
    check('  the store killed it',
      r.on.pass.rle === 0, `rle=${r.on.pass.rle}`);
  }

  {
    // (4) A BASE WRITE AT THE JOIN. This is the case the carry could not have
    // been written without: the head's FOLDED TERMINATOR producer is `inc ebx`,
    // which writes the fact's base register and is not in the micro-op list at
    // all, so a walk that only looked at micro-ops would carry a fact naming an
    // address the edge just moved. `jz out` is never taken (EBX is a large
    // pointer) and the body restores EBX, so the loop stays inside DATA.
    const r = region('a base write by the terminator kills the fact', asm([
      [...movRI(ECX, 6), ...movRI(EAX, 0)],
      { label: 'top' },
      [...load32(EDX, EBX, 0x30), ...aluRR(ADD, EAX, EDX), ...incR(EBX)],
      { j: 'jcc', cc: JZ, to: 'out' },
      [...load32(EDI, EBX, 0x30), ...aluRR(ADD, EAX, EDI),
       ...decR(EBX), ...decR(ECX)],
      { j: 'jcc', cc: JNZ, to: 'top' },
      { label: 'out' },
      JOIN,
    ]));
    check('  the terminator base write killed it',
      r.on.pass.rle === 0, `rle=${r.on.pass.rle}`);
  }

  // ------------------------------------------------------------------
  // Round 12 section 19: the READ-MODIFY-WRITE store split (lever C).
  //
  // Round 11 split only the load side. `[m] OP= reg` and its family were whole
  // instruction fallbacks, so an in-place increment cost a spill of eight GPRs,
  // a call_indirect and a reload. They are now three micro-ops: a TU_LOAD into
  // a lane, the register-form op on that lane, and a TU_STORE back.
  //
  // Every case below runs through `equiv`, whose block ends `pushfd ; pop ebp`,
  // so EBP is compared as well as the registers and the data -- which is what
  // makes "RMW with flags read by the terminator" an assertion in all of them
  // rather than one case. `neg` and `inc` differ from each other precisely in
  // which flags they leave, and CF in particular is what a wrong lowering
  // loses.
  // ------------------------------------------------------------------
  console.log('\n-- read-modify-write memory forms (round 12, §19) --');
  {
    const rmw = (name, body, seed) => {
      const r = equiv(name, body, seed);
      check(`  ${name}: split into load/op/store`, r.on.pass.rmw >= 1,
        `rmw=${r.on.pass.rmw} split=${r.on.pass.split}`);
      return r;
    };

    rmw('ADD/SUB/XOR [base+disp], reg (H127)',
      [...aluMR(0x01, EBX, 0x40, ECX), ...aluMR(0x29, EBX, 0x44, EDX),
       ...aluMR(0x31, EBX, 0x48, ESI)]);
    rmw('AND/OR [addr], reg (H47)',
      [...aluMabsR(0x21, DATA + 0x50, ECX), ...aluMabsR(0x09, DATA + 0x54, EDX)]);
    rmw('ADD/SUB [base+disp], imm32 (H131)',
      [...aluMI(0, EBX, 0x58, 0x00010203), ...aluMI(5, EBX, 0x5C, 0x7F)]);
    rmw('XOR/AND [addr], imm32 (H51)',
      [...aluMabsI(6, DATA + 0x60, 0xFFFF0000),
       ...aluMabsI(4, DATA + 0x64, 0x0F0F0F0F)]);
    rmw('INC/DEC/NOT/NEG [base+disp] (H135)',
      [...incM(EBX, 0x68), ...decM(EBX, 0x6C), ...notM(EBX, 0x70),
       ...negM(EBX, 0x74)]);
    rmw('INC/NEG [addr] (H68)',
      [...incMabs(DATA + 0x78), ...negMabs(DATA + 0x7C)]);

    // CMP is the one member of these opcode families that does NOT store --
    // $th_alu_m32_r skips its write-back when alu == 7 and so does the split.
    // A store here would write a value the instruction never produces, so the
    // assertion is that the form split (two micro-ops, load + TU_CMP_RR) with
    // NO store half.
    const cmpr = equiv('CMP [base+disp], reg splits without a store',
      [...aluMR(0x39, EBX, 0x40, ECX), ...aluMabsI(7, DATA + 0x44, 0x1234)]);
    check('  no store half was emitted for CMP', cmpr.on.pass.rmw === 0,
      `rmw=${cmpr.on.pass.rmw}`);
    check('  but the loads were still split', cmpr.on.pass.split >= 2,
      `split=${cmpr.on.pass.split}`);

    // A PARTIAL-WIDTH RMW. The byte twin needs the sub-register vocabulary on
    // the lane, so it is deliberately left a whole-instruction fallback -- the
    // point of the case is that it still executes correctly, and that the
    // meter shows it took the other path rather than being silently lowered as
    // a dword.
    const byteRmw = equiv('a byte RMW is NOT split and still agrees',
      [...aluM8R8(EBX, 0x40, 1), ...aluMR(0x01, EBX, 0x44, EDX)]);
    check('  only the dword form split', byteRmw.on.pass.rmw === 1,
      `rmw=${byteRmw.on.pass.rmw}`);
    check('  and the byte form went through a fallback',
      byteRmw.on.fallbacks >= 1, `fallbacks=${byteRmw.on.fallbacks}`);

    // THE BASE WRITTEN BY THE OP ITSELF. `add [eax],eax` reads EAX as the base
    // AND as the addend; the lowering must add the ORIGINAL EAX into memory and
    // must not disturb EAX. It is safe by construction -- the op writes the
    // lane -- and this is the case that says so out loud.
    rmw('add [eax],eax -- the base is its own operand',
      [...aluMR(0x01, EAX, 0, EAX), ...aluMR(0x01, EAX, 4, EAX)],
      { eax: DATA + 0x20 });

    // AN EARLIER STORE OVERLAPPING THE RMW's ADDRESS. The store half kills
    // facts exactly as a plain store does, and store-to-load forwarding stays
    // removed (§16.3 item 3), so the RMW's load must go to memory and read what
    // the store put there. A wrong answer here shows up in the data compare,
    // not only in the meter.
    const over = equiv('an RMW under an earlier store to the same address',
      [...movRI(ESI, 0x0BADF00D), ...store32(ESI, EBX, 0x40),
       ...aluMR(0x01, EBX, 0x40, ECX), ...load32(EDX, EBX, 0x40)]);
    check('  nothing was forwarded from the store', over.on.pass.stlf === 0,
      `stlf=${over.on.pass.stlf}`);

    // THE LOAD HALF REUSING A LIVE FACT. `mov eax,[ebx+0x40]` followed by
    // `add [ebx+0x40],imm` names the same address with nothing in between, so
    // the RMW's load is the redundant one and becomes a register move. The
    // store half then kills the fact, which is why the second load after it is
    // NOT eliminated -- one `rle`, not two.
    const reuse = equiv('the RMW load reuses a live fact, its store kills it',
      [...load32(EAX, EBX, 0x40), ...aluMI(0, EBX, 0x40, 7),
       ...load32(ECX, EBX, 0x40), ...aluRR(ADD, EDX, ECX)]);
    check('  exactly one load was eliminated', reuse.on.pass.rle === 1,
      `rle=${reuse.on.pass.rle} — 0 means the fact did not reach the RMW, ` +
      `2 means the store failed to kill it`);

    // The A/B partner, on the same bytes: with --no-block-exec-rmw every form
    // above is a fallback again, and the answers must not move.
    const both = [...aluMR(0x01, EBX, 0x40, ECX), ...incM(EBX, 0x44),
                  ...negMabs(DATA + 0x48)];
    const withRmw = arm(block(both), true);
    e.set_block_exec_rmw(0);
    const noRmw = arm(block(both), true);
    e.set_block_exec_rmw(1);
    check('--no-block-exec-rmw agrees byte for byte',
      withRmw.data === noRmw.data && withRmw.ebp === noRmw.ebp,
      withRmw.data === noRmw.data ? `eflags ${withRmw.ebp.toString(16)} vs ` +
        `${noRmw.ebp.toString(16)}` : 'guest memory differs');
    check('  and it really was the other path', noRmw.pass.rmw === 0 &&
      withRmw.pass.rmw === 3, `off=${noRmw.pass.rmw} on=${withRmw.pass.rmw}`);
  }

  {
    // Below $block_exec_min_uops the H458 dispatch is not repaid, so the
    // matcher must refuse rather than install a losing descriptor. This one
    // cannot use the standard flags probe, since `pushfd ; pop ebp` is two
    // more body ops and would carry any block over the threshold.
    const bare = [...incR(EAX), ...RET];
    const tinyOff = arm(bare, false);
    const tinyOn = arm(bare, true);
    check('a one-body-op block is declined', tinyOn.installs === 0,
      `installs=${tinyOn.installs}`);
    check('  and it still executes correctly', tinyOff.eax === tinyOn.eax,
      `${tinyOff.eax.toString(16)} vs ${tinyOn.eax.toString(16)}`);
    check('  for the "too short" reason', tinyOn.declWhy === 1,
      `declWhy=${tinyOn.declWhy}`);
    // --fault-null=stop would let a native memory op trap with the register
    // file still in locals, so the whole family stands down while it is armed.
    e.set_fault_unmapped(2);
    const armed = equiv('nothing installs while --fault-null is armed',
      [...aluRI(0, EAX, 1), ...aluRR(XOR, ECX, EAX), ...incR(EDX), ...decR(EDI)],
      null, { mayDecline: true });
    check('  the fault-null decline held', armed.on.installs === 0,
      `installs=${armed.on.installs}`);
    e.set_fault_unmapped(0);
  }

  // ------------------------------------------------------------------
  // Round 12 (OPEN-6): x87-carrying blocks are no longer declined.
  //
  // The executor runs AFTER the x87 fusers now, and an x87 op -- fused or bare
  // -- is a FALLBACK micro-op: spill eight, call the real handler with $ip at
  // its inline words, reload eight. The x87 stack, tag word and status word
  // are globals the executor never models, so they survive by not being
  // touched. Every case below is run with the fold ARMED, because that is the
  // configuration the ordering change exists for and the one where a wrong
  // span turns a fused op's inline address words into a handler index.
  //
  // FNINIT opens every body: the x87 stack is global state that outlives an
  // arm, so without it the second arm of a case starts on whatever depth the
  // first one left and the two arms differ for a reason that is not the
  // executor's.
  // ------------------------------------------------------------------
  console.log('\n-- round 12: x87 inside the executor --');

  const FNINIT = [0xDB, 0xE3];
  // D9 /0 fld m32, D9 /3 fstp m32, D8 /0 fadd m32, D8 /1 fmul m32,
  // D8 /3 fcomp m32, DB /0 fild m32, DB /3 fistp m32.
  const x87m = (op, digit, base, disp) => [op, 0x80 | (digit << 3) | base, ...le32(disp)];
  const fldM   = (base, disp) => x87m(0xD9, 0, base, disp);
  const fstpM  = (base, disp) => x87m(0xD9, 3, base, disp);
  const faddM  = (base, disp) => x87m(0xD8, 0, base, disp);
  const fmulM  = (base, disp) => x87m(0xD8, 1, base, disp);
  const fcompM = (base, disp) => x87m(0xD8, 3, base, disp);
  const fildM  = (base, disp) => x87m(0xDB, 0, base, disp);
  const fistpM = (base, disp) => x87m(0xDB, 3, base, disp);
  const FXCH1  = [0xD9, 0xC9];        // fxch st(1)
  const FLDST0 = [0xD9, 0xC0];        // fld st(0)
  const FNSTSW = [0xDF, 0xE0];        // fnstsw ax
  const SAHF   = [0x9E];

  // Known operands, planted by the SNIPPET rather than by the harness: `arm`
  // refills the scratch from seedData() inside each arm, so anything written
  // from JS before the run is gone by the time the block executes. A
  // `mov dword [ebx+disp], imm32` costs one more micro-op and buys a case that
  // can say which way a compare went.
  const movMI = (base, disp, v) => [0xC7, 0x80 | base, ...le32(disp), ...le32(v)];
  const F1_5 = 0x3FC00000, F2_25 = 0x40100000, F_0_75 = 0xBF400000, F8 = 0x41000000;
  const plantFloats = [
    ...movMI(EBX, 0x80, F1_5), ...movMI(EBX, 0x84, F2_25),
    ...movMI(EBX, 0x88, F_0_75), ...movMI(EBX, 0x8C, F8),
    ...movMI(EBX, 0x90, 1234), ...movMI(EBX, 0x94, (-77) >>> 0),
  ];

  e.set_x87_pipeline4_fusion(1);
  e.set_x87_affine_fusion(1);
  // Lever A is OFF by default (section 17.5), so every case in this section has
  // to arm it explicitly -- otherwise the two arms run the same threaded code
  // and the section proves nothing. Restored at the end of the section.
  e.set_block_exec_x87(1);

  // Every x87 case opens with FNINIT and then plants its own operands, so the
  // floats it reads are named values rather than whatever seedData's fill
  // happened to leave at that offset — a denormal or a NaN would still be
  // identical in both arms, but a case that cannot say what it computed can
  // only report agreement and never a wrong answer.
  const x87equiv = (name, body, opts) =>
    equiv(name, [...FNINIT, ...plantFloats, ...body], null, opts);

  // (1) fld / fstp to memory standing inside an otherwise integer block. This
  //     is the shape §4c named as the whole cost: quake2's `+0x10011cd1` family
  //     is x87 for a few ops and integer span-walking for the rest.
  {
    const r = x87equiv('fld/fstp m32 inside an integer block',
      [...load32(EAX, EBX, 0x10), ...aluRI(0, EAX, 1),
       ...fldM(EBX, 0x80), ...faddM(EBX, 0x84), ...fstpM(EBX, 0xA0),
       ...aluRR(XOR, ECX, EAX), ...load32(EDX, EBX, 0x14),
       ...aluRR(ADD, EDX, ECX)]);
    check('  the block installed with x87 inside it', r.on.installs >= 1,
      `installs=${r.on.installs} declWhy=${r.on.declWhy}`);
    check('  and the x87 arrived as a fallback micro-op', r.on.x87uops >= 1,
      `x87uops=${r.on.x87uops}`);
  }

  // (2) fild / fistp -- the int->float->int trip through a stack slot, which
  //     is the other half of §4c's decline-1 bucket.
  {
    const r = x87equiv('fild/fistp m32 inside an integer block',
      [...load32(EAX, EBX, 0x10), ...aluRI(4, EAX, 0xFF),
       ...fildM(EBX, 0x90), ...fmulM(EBX, 0x80), ...fistpM(EBX, 0xA4),
       ...load32(ECX, EBX, 0xA4), ...aluRR(ADD, EAX, ECX)]);
    check('  fild/fistp installed', r.on.installs >= 1,
      `installs=${r.on.installs} declWhy=${r.on.declWhy}`);
    check('  and counted an x87 micro-op', r.on.x87uops >= 1,
      `x87uops=${r.on.x87uops}`);
  }

  // (3) fcomp + fnstsw ax + sahf + Jcc as the block's terminator. §4c's
  //     decline-2: mw3 enters five of these 5-7 op blocks ~100,000 times each.
  //     The interesting part is that `fnstsw ax` WRITES EAX from inside a
  //     fallback, so the executor's reload of the eight locals after the call
  //     is what makes the following integer code see it.
  {
    const bytes = asm([
      [...FNINIT, ...plantFloats,
       ...fldM(EBX, 0x80), ...fcompM(EBX, 0x84), ...FNSTSW, ...SAHF],
      { j: 'jcc', cc: JB, to: 'lower' },
      [...movRI(EDX, 0x11111111), ...aluRR(XOR, ECX, ECX)],
      { j: 'jmp', to: 'out' },
      { label: 'lower' },
      [...movRI(EDX, 0x22222222), ...aluRI(0, ECX, 3)],
      { label: 'out' },
      JOIN,
    ]);
    const off = arm(bytes, false);
    const on = arm(bytes, true);
    const ok = ['eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi']
      .every(k => off[k] === on[k]) && off.data === on.data && off.eip === on.eip;
    check('fcomp + fnstsw ax + sahf + Jcc terminator', ok,
      ok ? '' : `\n         off ${hexRegs(off)}\n         on  ${hexRegs(on)}`);
    check('  the compare really took the lower branch',
      (off.edx >>> 0) === 0x22222222, `edx=${off.edx.toString(16)}`);
  }

  // (4) An fxch chain. §4c found fxch is inside the island's accepted set
  //     wherever it is contiguous, so this is the case that proves a FUSED run
  //     (H451) is walked past by its span and not op by op — a wrong span here
  //     runs an address word as a handler index and the arms diverge loudly.
  {
    const r = x87equiv('an fxch chain inside a fused island',
      [...fldM(EBX, 0x80), ...fldM(EBX, 0x84), ...FXCH1, ...FLDST0,
       ...FXCH1, ...faddM(EBX, 0x88), ...fstpM(EBX, 0xA8), ...fstpM(EBX, 0xAC),
       ...load32(EAX, EBX, 0xA8), ...aluRR(XOR, ECX, EAX)]);
    check('  the fxch chain installed', r.on.installs >= 1,
      `installs=${r.on.installs} declWhy=${r.on.declWhy}`);
    check('  and it went in as one or more x87 fallbacks', r.on.x87uops >= 1,
      `x87uops=${r.on.x87uops}`);
  }

  // (5) THE ALIAS CASE. An x87 op between two loads of one address must kill
  //     the fact: an x87 store writes memory the pass cannot model at all, so
  //     `rle` has to stay at zero here. This is the §16.2 clause "any x87
  //     micro-op ... kills every fact", and it is now reachable for the first
  //     time, because before round 12 the block would simply have declined.
  {
    const r = x87equiv('an x87 op between two loads of one address kills the fact',
      [...load32abs(EAX, DATA + 0x30), ...aluRR(XOR, ECX, ECX),
       ...fldM(EBX, 0x80), ...fstpM(EBX, 0x30),
       ...load32abs(EDX, DATA + 0x30), ...aluRR(ADD, EDX, EAX)]);
    check('  the fact was killed (rle stayed at zero)', r.on.pass.rle === 0,
      `rle=${r.on.pass.rle}`);
    check('  and the block still installed', r.on.installs >= 1,
      `installs=${r.on.installs} declWhy=${r.on.declWhy}`);
  }

  // (6) The control: with the fold DISARMED the same block still has to work.
  //
  //     ROUND 15 CHANGED WHAT THIS ASSERTS. A bare 188/189/190 used to be a
  //     span-1 TU_FALLBACK, so the case checked `x87uops >= 4`. It now goes to
  //     $tree_uop_classify first and comes back as one of 07b's own NATIVE x87
  //     micro-ops, so the count that moves is `x87native` and `x87uops` stays
  //     at zero -- which is the improvement, not a regression. The bare-op
  //     fallback residue still exists and case (6b) is what exercises it.
  {
    e.set_x87_pipeline4_fusion(0);
    e.set_x87_affine_fusion(0);
    const r = x87equiv('bare x87 ops with the fold disarmed',
      [...load32(EAX, EBX, 0x10), ...fldM(EBX, 0x80), ...faddM(EBX, 0x84),
       ...fmulM(EBX, 0x88), ...fstpM(EBX, 0xB0), ...aluRI(0, EAX, 7),
       ...load32(ECX, EBX, 0xB0), ...aluRR(XOR, EDX, ECX)]);
    check('  it installed with the fold off too', r.on.installs >= 1,
      `installs=${r.on.installs} declWhy=${r.on.declWhy}`);
    check('  and every bare x87 op is a NATIVE micro-op (round 15)',
      r.on.x87native >= 4 && r.on.x87uops === 0,
      `x87native=${r.on.x87native} x87uops=${r.on.x87uops}`);
    check('  and they are inside opsNative, not opsFallback',
      r.on.natives >= 4, `natives=${r.on.natives} fallbacks=${r.on.fallbacks}`);

    // (6b) THE BARE-OP RESIDUE. FNSTSW AX is DF E0 -- group 7, which
    //      $tree_x87_reg_ok declines outright because the *register* set
    //      forbids anything that touches a general register or the lazy-flag
    //      globals. Its own kind TU_X87_SW_AX exists and the classifier does
    //      emit it, so this case's job is the OTHER half: FNSTENV (D9 /6), a
    //      memory form $fpu_exec_mem does implement but whose (group, reg) the
    //      native predicate accepts, versus FCOMIP (DF /6), which writes
    //      EFLAGS and is declined -- so the block must still install with that
    //      one arriving as a TU_FALLBACK and the answer must still match.
    {
      const FCOMIP = [0xDF, 0xF1];   // fcomip st, st(1)
      const r2 = x87equiv('a declined bare x87 form stays on the fallback path',
        [...load32(EAX, EBX, 0x10), ...fldM(EBX, 0x80), ...fldM(EBX, 0x84),
         ...FCOMIP, ...aluRI(0, EAX, 5), ...load32(ECX, EBX, 0x14),
         ...aluRR(XOR, EDX, ECX)]);
      check('  the block with a declined x87 form still installed',
        r2.on.installs >= 1,
        `installs=${r2.on.installs} declWhy=${r2.on.declWhy}`);
      check('  and that op is a fallback, not a native micro-op',
        r2.on.x87uops >= 1, `x87uops=${r2.on.x87uops}`);
    }

    // (6c) FNSTSW AX as a bare op: the one x87 instruction that WRITES a
    //      general register. It has its own micro-op kind (TU_X87_SW_AX),
    //      which publishes EAX, calls, and reloads EAX alone -- so the
    //      following integer code has to see the status word. The equiv check
    //      compares EAX between the arms, which is exactly the question.
    {
      const r3 = x87equiv('fnstsw ax writes EAX from inside the executor',
        [...fldM(EBX, 0x80), ...fcompM(EBX, 0x84), ...FNSTSW,
         ...aluRI(4, EAX, 0x4700), ...load32(ECX, EBX, 0x10),
         ...aluRR(ADD, ECX, EAX)]);
      check('  the fnstsw block installed', r3.on.installs >= 1,
        `installs=${r3.on.installs} declWhy=${r3.on.declWhy}`);
    }
    e.set_x87_pipeline4_fusion(1);
    e.set_x87_affine_fusion(1);
  }

  // ------------------------------------------------------------------
  // Round 15 (section 24): the FUSED run as a cheap native micro-op.
  //
  // Everything above ran through the round-12 TU_FALLBACK arm. These cases
  // are about TU_X87RUN: the fused body called directly, with only the
  // registers it reads published and none reloaded.
  // ------------------------------------------------------------------
  console.log('\n-- round 15: the fused x87 run as TU_X87RUN --');

  // (8) BASE REGISTER READ. Every address in these bodies is `R[base] + disp`
  //     and the base register lives in an executor LOCAL, not in the global
  //     the body reads -- so if the publish mask were wrong the body would
  //     form its addresses off a stale EBX and read the wrong floats. EBX is
  //     written by the block BEFORE the fused run so a stale global is a
  //     different number and not a coincidence.
  {
    const r = x87equiv('the fused run reads its base register through the mask',
      [...load32(EAX, EBX, 0x10), ...aluRI(0, EBX, 0),
       ...fldM(EBX, 0x80), ...faddM(EBX, 0x84), ...fmulM(EBX, 0x88),
       ...fstpM(EBX, 0xB4),
       ...load32(ECX, EBX, 0xB4), ...aluRR(XOR, EDX, ECX)]);
    check('  the fused run installed', r.on.installs >= 1,
      `installs=${r.on.installs} declWhy=${r.on.declWhy}`);
    check('  and it went in as the CHEAP kind', r.on.x87run >= 1,
      `x87run=${r.on.x87run} x87uops=${r.on.x87uops}`);
  }

  // (9) The same block with a base register the block MOVES between the two
  //     halves of the run. `add ebx, 0` above is a no-op on purpose; here the
  //     integer code around the run really does change EBX, which is what
  //     catches a mask computed once and published at the wrong time.
  {
    const r = x87equiv('a base register written before the run is the one used',
      [...aluRI(0, EBX, 0), ...load32(EAX, EBX, 0x10),
       ...fldM(EBX, 0x80), ...faddM(EBX, 0x84), ...fmulM(EBX, 0x8C),
       ...fstpM(EBX, 0xB8), ...aluRR(ADD, EAX, EAX),
       ...load32(ECX, EBX, 0xB8)]);
    check('  it installed', r.on.installs >= 1,
      `installs=${r.on.installs} declWhy=${r.on.declWhy}`);
  }

  // (10) THE X87 STATE IS UNTOUCHED BY THE EXECUTOR. The stack, the tag word
  //      and the status word are globals neither arm's executor models; the
  //      fused body produces them through $fpu_* exactly as the threaded path
  //      does. Read them back directly rather than inferring them from a
  //      stored float: a fold that got TOP right and the tags wrong would
  //      still store the right number.
  {
    const bytes = [...FNINIT, ...plantFloats,
      ...load32(EAX, EBX, 0x10),
      ...fldM(EBX, 0x80), ...faddM(EBX, 0x84), ...fmulM(EBX, 0x88),
      ...fstpM(EBX, 0xBC),
      ...fldM(EBX, 0x84), ...fldM(EBX, 0x88),
      ...aluRR(XOR, ECX, EAX)];
    const full = block(bytes);
    const readState = () => ({
      top: e.get_fpu_top ? e.get_fpu_top() : -1,
      sw: e.get_fpu_sw ? e.get_fpu_sw() : -1,
      tags: e.get_fpu_tags ? e.get_fpu_tags() : -1,
    });
    const off = arm(full, false); const offState = readState();
    const on = arm(full, true);   const onState = readState();
    check('the x87 stack/status/tag globals match the threaded arm',
      offState.top === onState.top && offState.sw === onState.sw
        && offState.tags === onState.tags,
      `off top=${offState.top} sw=${offState.sw} tags=${offState.tags} / ` +
      `on top=${onState.top} sw=${onState.sw} tags=${onState.tags}`);
    check('  and the block executed natively for the integer half',
      on.installs >= 1, `installs=${on.installs} declWhy=${on.declWhy}`);
    check('  registers and memory still agree',
      ['eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi']
        .every(k => off[k] === on[k]) && off.data === on.data,
      `\n         off ${hexRegs(off)}\n         on  ${hexRegs(on)}`);
  }

  // (11) THE ISLAND'S DECLINE. $th_x87_island forwards whatever (group, reg,
  //      rm) it finds to $fpu_exec_reg, and FCOMIP writes EFLAGS -- a form
  //      $tree_x87_reg_ok declines. So a fused island holding one must fall
  //      back to the trampoline arm rather than take the partial publish, and
  //      the two arms must still agree.
  {
    const FCOMIP = [0xDF, 0xF1];
    const r = x87equiv('an island holding a declined form stays on the trampoline',
      [...load32(EAX, EBX, 0x10),
       ...fldM(EBX, 0x80), ...fldM(EBX, 0x84), ...FXCH1, ...FCOMIP,
       ...fstpM(EBX, 0xC0),
       ...aluRI(0, EAX, 3), ...load32(ECX, EBX, 0x14)]);
    check('  the island block still installed', r.on.installs >= 1,
      `installs=${r.on.installs} declWhy=${r.on.declWhy}`);
  }

  // (7) A region whose member holds an x87 op. Round 15 REFUSED this -- the
  //     region classifier saw raw 188..190 and called $bx_op_unsafe -- and the
  //     case asserted only that the two arms still agreed. Round 16 lifted the
  //     refusal (section 26), so the member is now emitted with the same kinds
  //     the one-block path uses and this case is the agreement half of that;
  //     the kinds themselves are pinned in the round-16 section at the end of
  //     this file. `mayDecline` stays, because whether a region installs here
  //     is a cost-model decision, not the property under test.
  {
    const r = region('a region whose member holds x87 agrees with threaded', asm([
      [...FNINIT, ...plantFloats, ...movRI(ECX, 4), ...movRI(EAX, 0)],
      { label: 'top' },
      [...load32abs(EDX, DATA + 0x30), ...aluRR(ADD, EAX, EDX),
       ...fldM(EBX, 0x80), ...fstpM(EBX, 0xB8),
       ...decR(ECX), ...aluRI(7, ECX, 0)],
      { j: 'jcc', cc: JNZ, to: 'top' },
      JOIN,
    ]), null, { mayDecline: true });
    check('  the x87 member did not stop the two arms agreeing',
      r !== undefined, 'region() returned nothing');
  }

  e.set_x87_pipeline4_fusion(0);
  e.set_x87_affine_fusion(0);
  e.set_block_exec_x87(0);   // back to the shipped default

  // ======================================================================
  // ROUND 14 -- the DESCRIPTOR CHUNK, and what happens when it fills.
  // docs/block-executor-design.md section 23.
  //
  // A page owns two chunks now: the threaded one and a second one holding
  // block-executor descriptors. Both are capped at 16KB by the 14-bit offsets
  // in the per-page byte index, so the descriptor chunk CAN fill -- and the
  // whole point of splitting them is what happens then.
  //
  // Round 13 had one chunk, and overflowing it does not fail locally:
  // $page_publish DROPS THE WHOLE PAGE and every block on it is decoded again.
  // That is why round 13 had to buy admission control with installs (region
  // installs 38,881 -> 1,101). Overflowing the descriptor chunk must instead
  // DECLINE the one install and leave the page -- its threaded code, its
  // index, its other descriptors -- exactly where it was.
  //
  // The case builds a 4KB guest page packed with ~180 tiny blocks, which is
  // far more descriptor than 16KB holds, and asserts three things: the two
  // arms still compute the same answer, the overflow really happened, and the
  // page was not dropped and recompiled behind it.
  // ======================================================================
  console.log('\n-- round 14: descriptor-chunk overflow --');
  {
    // A fresh, 4KB-ALIGNED page well above the cursor the cases above walk.
    const pageBase = (imageBase + 0x40000 + codeOffset + 0xFFF) & ~0xFFF;
    const BLOCK_BYTES = 17;                 // add eax,imm32 (6) x2 ; jmp (5)
    const N = Math.floor((4096 - JOIN.length) / BLOCK_BYTES);
    const bytes = [];
    for (let i = 0; i < N; i++) {
      bytes.push(...aluRI(0, EAX, i + 1));          // add eax, i+1   (5)
      bytes.push(...aluRI(0, EAX, 0x10000 + i));    // add eax, ...    (5)
      // jmp to the next block; the last one falls into the join below.
      bytes.push(...jmpRel32(0));                   // patched below   (5)
      const at = bytes.length - 4;
      const rel = 0;                                // next block starts here
      for (let k = 0; k < 4; k++) bytes[at + k] = (rel >>> (8 * k)) & 0xFF;
    }
    bytes.push(...JOIN);
    check('  the overflow page fits in one 4KB guest page',
      bytes.length <= 4096, `${bytes.length} bytes, ${N} blocks`);

    function runPage(blockExec) {
      const wa = g2w(pageBase);
      for (let i = 0; i < bytes.length; i++) mem[wa + i] = bytes[i];
      // Every block on this page must be forgotten between the arms, or the
      // second arm runs the first arm's compiled code and installs nothing.
      e.invalidate_code_range(pageBase, 4096);
      seedData();
      normalizeFlags();
      e.set_block_exec_min_uops(2);
      e.set_block_exec(blockExec ? 1 : 0);
      e.set_eax(0); e.set_ecx(SEED.ecx); e.set_edx(SEED.edx);
      e.set_ebx(SEED.ebx); e.set_esi(SEED.esi); e.set_edi(SEED.edi);
      e.set_ebp(0);
      e.set_esp(STACK_TOP);
      dv.setUint32(g2w(STACK_TOP), 0, true);
      const before = {
        compiles: e.get_page_compiles(),
        full: e.get_page_desc_chunk_full(),
        noRoom: e.get_block_exec_no_room(),
        allocs: e.get_page_desc_chunk_allocs(),
        installs: e.get_block_exec_installs(),
      };
      e.set_eip(pageBase);
      e.run(100000);
      return {
        eax: e.get_eax() >>> 0, ecx: e.get_ecx() >>> 0, edx: e.get_edx() >>> 0,
        ebx: e.get_ebx() >>> 0, esi: e.get_esi() >>> 0, edi: e.get_edi() >>> 0,
        eip: e.get_eip() >>> 0,
        compiles: e.get_page_compiles() - before.compiles,
        full: e.get_page_desc_chunk_full() - before.full,
        noRoom: e.get_block_exec_no_room() - before.noRoom,
        allocs: e.get_page_desc_chunk_allocs() - before.allocs,
        installs: e.get_block_exec_installs() - before.installs,
      };
    }

    const off = runPage(false);
    const on  = runPage(true);

    // (1) CORRECTNESS. A chunk that overflowed must not change what the guest
    //     computes -- the declined blocks simply run as threaded code.
    const same = ['eax', 'ecx', 'edx', 'ebx', 'esi', 'edi', 'eip']
      .every(k => off[k] === on[k]);
    check('a descriptor-chunk overflow does not change the result', same,
      same ? '' : `off eax=${off.eax.toString(16)} eip=${off.eip.toString(16)} / ` +
                  `on eax=${on.eax.toString(16)} eip=${on.eip.toString(16)}`);

    // (2) The case is only worth anything if the chunk ACTUALLY filled. A
    //     descriptor chunk was allocated, descriptors were installed into it,
    //     and then room ran out.
    check('  a descriptor chunk was allocated for the page', on.allocs >= 1,
      `descChunkAllocs=${on.allocs}`);
    check('  descriptors installed on it', on.installs >= 1,
      `installs=${on.installs}`);
    check('  and then it ran out of room', on.noRoom + on.full >= 1,
      `noRoom=${on.noRoom} descChunkFull=${on.full} installs=${on.installs} ` +
      `of ${N} blocks — the page was not packed tightly enough to overflow`);

    // (3) THE ROUND'S CLAIM. Overflow degraded to a decline. A DROPPED page is
    //     visible as page compiles: the page is recompiled from scratch and
    //     every block on it decoded again, so the armed arm would compile this
    //     one page many times over. It compiles it as often as the off arm
    //     does, which for a single straight run is once.
    check('an overflow DECLINES the install and never drops the page',
      on.compiles <= off.compiles + 1,
      `pageCompiles off=${off.compiles} on=${on.compiles} — ` +
      `the armed arm recompiled the page, so the overflow dropped it`);

    e.set_block_exec(0);
  }

  console.log('\n-- round 16: the one-block leaf (H463) --');

  {
    // Every case above ends in the flags probe, and `pushfd` is a FALLBACK op.
    // A descriptor carrying a fallback can never take the leaf -- the leaf's
    // contract is exactly "one block, no exits, no fallback pool, no x87 run"
    // -- so the 269 cases above exercise H458 and say nothing at all about
    // H463. These cases end at the terminator instead, which is what a real
    // one-block install looks like, and compare registers and memory only.
    const leafBlock = body => [...body, ...RET];

    function leafEquiv(name, body, seed) {
      const bytes = leafBlock(body);
      const off = arm(bytes, false, seed);
      const on = arm(bytes, true, seed);
      totalNative += on.natives; totalFallback += on.fallbacks;
      totalInstalls += on.installs;
      const regsOk = ['eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi']
        .every(k => off[k] === on[k]);
      const memOk = off.data === on.data;
      const eipOk = off.eip === on.eip;
      let why = '';
      if (!regsOk) why = `\n         off ${hexRegs(off)}\n         on  ${hexRegs(on)}`;
      else if (!memOk) why = ' (guest memory differs)';
      else if (!eipOk) why = ` (eip ${off.eip.toString(16)} vs ${on.eip.toString(16)})`;
      check(`leaf: ${name}`, regsOk && memOk && eipOk, why);
      check(`  leaf: ${name}: entered through H463`, on.leafRuns >= 1,
        `installs=${on.installs} runs=${on.runs} leafRuns=${on.leafRuns} ` +
        `declWhy=${on.declWhy} — the block did not take the leaf, so this ` +
        `case measured the general region handler again`);
      check(`  leaf: ${name}: no fallback op ran`, on.fallbacks === 0,
        `fallbacks=${on.fallbacks}`);
      return { off, on };
    }

    leafEquiv('register ALU chain',
      [...movRI(EAX, 0xDEADBEEF), ...aluRR(ADD, EAX, ECX),
       ...movRR(EDX, EAX), ...aluRI(6, EDX, 0x0F0F0F0F), ...incR(EBX)]);
    leafEquiv('LEA and the memory forms',
      [...leaRO(ESI, EBX, 0x20), ...load32(EAX, EBX, 0x10),
       ...aluRR(ADD, EAX, ECX), ...store32(EAX, EBX, 0x14),
       ...load32(EDX, EBX, 0x14)]);
    leafEquiv('shifts and the 8/16-bit forms',
      [...movRI(EAX, 0x00FF00FF), ...shlRI(EAX, 4), ...shrRI(EAX, 2),
       ...movRR(ECX, EAX), ...aluRR(XOR, EDX, ECX)]);

    // THE CONTRACT, from the other side. A block that carries a fallback must
    // never reach the PURE leaf, which has no spill/reload path and no
    // fallback pool to point at -- its arms 57 and 60 are `unreachable`. Since
    // round 17 it goes to H464 instead of H458, so this checks both halves:
    // not H463, and the descriptor did install and run.
    {
      const r = equiv('a fallback keeps the block off the PURE leaf',
        [...movRI(EAX, 0x1234), ...aluRI(0, EAX, 1), ...movRR(ECX, EAX),
         ...incR(EDX)]);
      check('  the fallback-carrying block did NOT take H463',
        r.on.leafRuns === 0 && r.on.runs >= 1,
        `runs=${r.on.runs} leafRuns=${r.on.leafRuns} — a descriptor with a ` +
        `fallback pool was handed to H463, which cannot service one`);
    }

    // The leaf as an A/B against itself: same bytes, leaf gate off. The
    // install still happens (on H458) and the answer is bit-identical.
    {
      const body = [...movRI(EAX, 0x01020304), ...aluRR(SUB, EAX, ECX),
                    ...movRR(EDI, EAX), ...leaRO(ESI, EAX, 0x08),
                    ...aluRR(AND, EDX, EDI)];
      const bytes = leafBlock(body);
      leafGate = true;
      const withLeaf = arm(bytes, true);
      leafGate = false;
      const without = arm(bytes, true);
      leafGate = true;
      const same = ['eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi']
        .every(k => withLeaf[k] === without[k]) &&
        withLeaf.data === without.data && withLeaf.eip === without.eip;
      check('leaf on and leaf off compute the same state', same,
        `\n         leaf ${hexRegs(withLeaf)}\n         gen  ${hexRegs(without)}`);
      check('  leaf on took H463', withLeaf.leafRuns >= 1,
        `leafRuns=${withLeaf.leafRuns}`);
      check('  leaf off still installed, on H458', without.leafRuns === 0 &&
        without.installs >= 1 && without.runs >= 1,
        `installs=${without.installs} runs=${without.runs} ` +
        `leafRuns=${without.leafRuns}`);
    }

    // SMC of a LEAF install. The retirement stamp is written over the block's
    // first op, and the leaf is reached through a different handler index than
    // the region executor -- so a stamp check that only recognised H458 would
    // leave a stale leaf descriptor live here. ($bx_is_desc_word is the one
    // place that knows both indices.)
    {
      const v1 = leafBlock([...movRI(EAX, 0x1111), ...aluRI(0, EAX, 1),
                            ...movRR(ECX, EAX), ...incR(EDX)]);
      const v2 = leafBlock([...movRI(EAX, 0x2222), ...aluRI(0, EAX, 2),
                            ...movRR(ECX, EAX), ...decR(EDX)]);
      if (v1.length !== v2.length) throw new Error('the leaf SMC pair must be the same length');

      const smcLeaf = (blockExec) => {
        const addr = nextCode();
        const wa = g2w(addr);
        const runAt = () => {
          seedData();
          e.set_eax(SEED.eax); e.set_ecx(SEED.ecx); e.set_edx(SEED.edx);
          e.set_ebx(SEED.ebx); e.set_esi(SEED.esi); e.set_edi(SEED.edi);
          e.set_ebp(0); e.set_esp(STACK_TOP);
          dv.setUint32(g2w(STACK_TOP), 0, true);
          e.set_eip(addr);
          e.run(100000);
          return `${(e.get_eax() >>> 0).toString(16)}/${(e.get_ecx() >>> 0).toString(16)}/${(e.get_edx() >>> 0).toString(16)}`;
        };
        e.set_block_exec_min_uops(2);
        e.set_block_exec_leaf(1);
        e.set_block_exec(blockExec ? 1 : 0);
        const leaf0 = e.get_block_exec_leaf_runs();
        for (let i = 0; i < v1.length; i++) mem[wa + i] = v1[i];
        const first = runAt();
        const leafFirst = e.get_block_exec_leaf_runs() - leaf0;
        e.set_ebx(addr);
        for (let i = 0; i < v2.length; i += 4) {
          const word = v2[i] | (v2[i + 1] << 8) | (v2[i + 2] << 16) | (v2[i + 3] << 24);
          e.set_eax(word >>> 0);
          const w = nextCode();
          const ww = g2w(w);
          const st = [...store32(EAX, EBX, i), ...RET];
          for (let k = 0; k < st.length; k++) mem[ww + k] = st[k];
          e.set_esp(STACK_TOP); dv.setUint32(g2w(STACK_TOP), 0, true);
          e.set_eip(w); e.run(1000);
        }
        const second = runAt();
        e.set_block_exec(0);
        return { first, second, leafFirst };
      };
      const soff = smcLeaf(false);
      const son = smcLeaf(true);
      check('leaf SMC: the install really was a leaf install', son.leafFirst >= 1,
        `leafRuns=${son.leafFirst} — nothing leaf-shaped was invalidated`);
      check('leaf SMC: the first run agrees', soff.first === son.first,
        `${soff.first} vs ${son.first}`);
      check('leaf SMC: the rewritten block is re-decoded and agrees',
        soff.second === son.second, `${soff.second} vs ${son.second}`);
      check('leaf SMC: the rewrite actually changed the answer',
        soff.first !== soff.second, `${soff.first} == ${soff.second}`);
    }

  // ======================================================================
  }
  // ROUND 16 -- x87 AS A REGION MEMBER OP.
  // docs/block-executor-design.md section 26.
  //
  // Round 15 taught the ONE-BLOCK installer the fused x87 run (TU_X87RUN) and
  // 07b's bare native kinds (50..53). The region classifier kept refusing all
  // of it as $bx_op_unsafe, so a hot loop whose body held one fld/fstp pair was
  // truncated at that member and usually fell under the two-block minimum.
  // Round 16 gives $bx_rg_classify_block the same $x87_fused_span arithmetic.
  //
  // The claim under test is NOT "x87 works in the executor" -- section 24
  // already established that for the one-block family. It is the narrower
  // and more falsifiable one: a region member is emitted with the SAME kinds
  // and the SAME publish mask, because a one-block descriptor is a one-member
  // region to $th_block_exec and the micro-op arrays are interchangeable by
  // construction. So each case below pins the KIND the member went in as, via
  // the per-family counters ($bx_rg_x87run_uops and friends), and not merely
  // that the two arms agreed -- two identical threaded compilations always
  // agree, and a case that only checks agreement would pass with the whole
  // round 16 arm deleted.
  //
  // The alias case is the one the design asks for explicitly rather than
  // assumes: $bx_mem_shape gives kinds 50..53 and 60 shape 3 ("not understood"),
  // which kills every fact -- but that is a property of a shared table, not of
  // anything the region path does, so it is asserted here rather than reasoned
  // about.
  // ======================================================================
  console.log('\n-- round 16: x87 inside a region member --');
  {
    e.set_x87_pipeline4_fusion(1);
    e.set_x87_affine_fusion(1);
    e.set_block_exec_x87(1);
    check('  region x87 is armed by default', e.get_block_exec_x87_regions() === 1,
      `x87Regions lever = ${e.get_block_exec_x87_regions()}`);

    // Snapshot every round-16 family counter around one region() call. The
    // uop counters are i64 exports, so they arrive as BigInt.
    const rgX87 = () => ({
      regions: e.get_block_exec_rg_x87_regions(),
      run: Number(e.get_block_exec_rg_x87run()),
      native: Number(e.get_block_exec_rg_x87_native()),
      fb: Number(e.get_block_exec_rg_x87_fb()),
    });
    const x87region = (name, bytes, opts) => {
      const before = rgX87();
      const r = region(name, bytes, null, opts);
      const after = rgX87();
      r.rg = {
        regions: after.regions - before.regions,
        run: after.run - before.run,
        native: after.native - before.native,
        fb: after.fb - before.fb,
      };
      return r;
    };

    // The loop body every case below varies. Six iterations because discovery
    // is hotness-gated (K), and the back edge is internal so the closure is a
    // real multi-block region and not two one-block descriptors in a row.
    const loop = body => asm([
      [...FNINIT, ...plantFloats, ...movRI(ECX, 6), ...movRI(EAX, 0)],
      { label: 'top' },
      [...load32abs(EDX, DATA + 0x30), ...aluRR(ADD, EAX, EDX)],
      { j: 'jmp', to: 'mid' },
      { label: 'mid' },
      [...body, ...decR(ECX), ...aluRI(7, ECX, 0)],
      { j: 'jcc', cc: JNZ, to: 'top' },
      JOIN,
    ]);

    // (1) THE FUSED RUN INSIDE A MEMBER. fld/fadd/fmul/fstp over one base
    //     register is the shape $x87_fused_span reports a span for, and the
    //     member must carry it as ONE micro-op of the cheap kind -- not as
    //     four, and not as a trampoline fallback. `run` moving is the whole
    //     assertion; `fb` staying put is what separates "it went in cheap"
    //     from "it went in at all".
    {
      const r = x87region('a fused x87 run inside a region member',
        loop([...fldM(EBX, 0x80), ...faddM(EBX, 0x84), ...fmulM(EBX, 0x88),
              ...fstpM(EBX, 0xB0)]));
      check('  the member went in as the CHEAP fused kind (TU_X87RUN)',
        r.rg.run >= 1 && r.rg.fb === 0,
        `rgX87run=${r.rg.run} rgX87fb=${r.rg.fb} rgX87native=${r.rg.native}`);
      check('  and the region was counted as holding x87',
        r.rg.regions >= 1, `x87Regions=${r.rg.regions} installs=${r.installs}`);
    }

    // (2) BARE x87 INSIDE A MEMBER. With both fusers disarmed the same four
    //     instructions reach the classifier as raw 188..190, go through
    //     $tree_uop_classify, and come back as 07b's own NATIVE kinds -- so
    //     `native` moves and `run` does not. This is the round-15 one-block
    //     case (6) reproduced on the region path, and it is a different code
    //     path in $bx_rg_classify_block, not the same one with a flag off.
    {
      e.set_x87_pipeline4_fusion(0);
      e.set_x87_affine_fusion(0);
      const r = x87region('bare x87 ops inside a region member',
        loop([...fldM(EBX, 0x80), ...faddM(EBX, 0x84), ...fmulM(EBX, 0x88),
              ...fstpM(EBX, 0xB4)]));
      check('  every bare op is a NATIVE member micro-op, none a fallback',
        r.rg.native >= 4 && r.rg.fb === 0,
        `rgX87native=${r.rg.native} rgX87fb=${r.rg.fb} rgX87run=${r.rg.run}`);
      e.set_x87_pipeline4_fusion(1);
      e.set_x87_affine_fusion(1);
    }

    // (3) THE FACT IS KILLED ACROSS THE x87 MEMBER. Two loads of one absolute
    //     address with an x87 store between them. $bx_mem_shape must give the
    //     x87 micro-op shape 3, so the redundant-load elimination (`rle`)
    //     cannot fire across it -- if it did, the second load would be
    //     rewritten to the first one's value and the block would read a float
    //     it never stored. Asserted, because the design only says the shared
    //     table "already treats these as fact-killing".
    {
      const r = x87region('an x87 member kills the alias fact across it', asm([
        [...FNINIT, ...plantFloats, ...movRI(ECX, 6), ...movRI(EAX, 0)],
        { label: 'top' },
        [...load32abs(EDX, DATA + 0x30), ...aluRR(ADD, EAX, EDX)],
        { j: 'jmp', to: 'mid' },
        { label: 'mid' },
        [...load32abs(ESI, DATA + 0x38),
         ...fldM(EBX, 0x80), ...faddM(EBX, 0x84), ...fmulM(EBX, 0x88),
         ...fstpM(EBX, 0x38),
         ...load32abs(EDI, DATA + 0x38), ...aluRR(ADD, ESI, EDI),
         ...decR(ECX), ...aluRI(7, ECX, 0)],
        { j: 'jcc', cc: JNZ, to: 'top' },
        JOIN,
      ]));
      check('  the fact was killed (rle stayed at zero)', r.on.pass.rle === 0,
        `rle=${r.on.pass.rle}`);
      check('  and the x87 still went in as a member micro-op',
        r.rg.run + r.rg.native + r.rg.fb >= 1,
        `run=${r.rg.run} native=${r.rg.native} fb=${r.rg.fb}`);
    }

    // (4) THE REFUSAL. The region classifier must refuse exactly what the
    //     one-block classifier refuses and nothing more, so both halves of
    //     that boundary are pinned:
    //
    //      * FCOMIP (DF /6) writes EFLAGS, which $tree_x87_reg_ok declines --
    //        it has no native kind, so it has to arrive as a member FALLBACK
    //        (the spill/call_indirect/reload trampoline), never silently as a
    //        native one. A native kind here would run the op without
    //        publishing the lazy-flag globals it writes.
    //      * FNSTSW AX (DF E0) is group 7 and writes a GENERAL register, but
    //        it is NOT refused: it has its own kind, TU_X87_SW_AX, which
    //        publishes and reloads EAX alone. The one-block path emits it
    //        (round 15 case 6c) so the member path must too, and the arms have
    //        to agree on EAX -- otherwise the integer code after it branches
    //        on a status word the executor never wrote.
    {
      const FCOMIP = [0xDF, 0xF1];
      const r = x87region('a declined x87 form inside a member takes the trampoline',
        loop([...fldM(EBX, 0x80), ...fldM(EBX, 0x84), ...FCOMIP,
              ...fstpM(EBX, 0xB8)]), { mayDecline: true });
      check('  the declined form is a member FALLBACK, not a native kind',
        r.rg.fb >= 1, `rgX87fb=${r.rg.fb} rgX87run=${r.rg.run} ` +
        `rgX87native=${r.rg.native} installs=${r.installs}`);

      const r2 = x87region('fnstsw ax writes EAX from inside a region member',
        loop([...fldM(EBX, 0x80), ...fcompM(EBX, 0x84), ...FNSTSW,
              ...aluRI(4, EAX, 0x4700)]));
      check('  and it went in as a member micro-op rather than declining',
        r2.rg.run + r2.rg.native + r2.rg.fb >= 1,
        `run=${r2.rg.run} native=${r2.rg.native} fb=${r2.rg.fb}`);
    }

    // (5) THE SUB-LEVER. --no-block-exec-x87-regions puts the region path back
    //     on round-15 behaviour with the one-block path untouched, which is
    //     what every A/B in section 26 is taken against. Without this case the
    //     flag could be dead and the measurement would be comparing a build
    //     with itself.
    {
      e.set_block_exec_x87_regions(0);
      const r = x87region('with the sub-lever off a member holding x87 is refused',
        loop([...fldM(EBX, 0x80), ...faddM(EBX, 0x84), ...fmulM(EBX, 0x88),
              ...fstpM(EBX, 0xBC)]), { mayDecline: true });
      check('  no x87 reached any region member',
        r.rg.run === 0 && r.rg.native === 0 && r.rg.fb === 0
          && r.rg.regions === 0,
        `run=${r.rg.run} native=${r.rg.native} fb=${r.rg.fb} ` +
        `regions=${r.rg.regions}`);
      e.set_block_exec_x87_regions(1);
    }

    e.set_x87_pipeline4_fusion(0);
    e.set_x87_affine_fusion(0);
    e.set_block_exec_x87(0);   // back to the shipped default
    check('  the round-16 sub-lever is left at its default',
      e.get_block_exec_x87_regions() === 1);
  }

  // ======================================================================
  // ROUND 17 -- THE FALLBACK-CARRYING LEAF (H464) AND THE CHUNK RESERVE.
  // docs/block-executor-design.md section 27.
  //
  // Round 16's leaf (H463) refuses any descriptor that carries a fallback
  // pool, so a one-block descriptor with a single `pushfd` in it paid the
  // whole 10 KB general region function. H464 is the same leaf with a
  // fallback arm: spill the eight registers, run the real threaded handler
  // out of the fallback pool, reload them, carry on natively.
  //
  // The cases below are about the SEAM, because that is the only thing the
  // second function can get wrong: a register the fallback needs that was
  // never spilled reads stale, and a register the fallback wrote that is not
  // reloaded is silently dropped on the floor. Both directions are asserted
  // against the threaded arm, not against each other.
  // ======================================================================
  console.log('\n-- round 17: the fallback leaf (H464) and the chunk reserve --');
  {
    // `bswap r32`: register-only, absent from $bx_op_unsafe, and
    // $tree_uop_classify has no kind for it -- so it lands as a real
    // TU_FALLBACK inside an otherwise all-native block, which is exactly the
    // shape this round is about. NOTE for anyone reaching for a fallback op:
    // `adc r,r` is NOT one any more. It became a native executor kind at some
    // point and tools/bench-loops.js's blk_fb8 shape (and section 25's
    // description of it as the fallback control) are both stale because of it.
    const bswapR = r => [0x0F, 0xC8 + r];
    // No flags probe: `pushfd` is itself a fallback, and a case that wants to
    // say WHICH fallback ran cannot afford a second one it did not ask for.
    const fbBlock = body => [...body, ...RET];

    // The leaf_fb twin of leafEquiv: same equivalence, plus the assertion
    // that the block really entered H464 and really executed a fallback.
    function fbEquiv(name, body, seed) {
      const bytes = fbBlock(body);
      const off = arm(bytes, false, seed);
      const on = arm(bytes, true, seed);
      totalNative += on.natives; totalFallback += on.fallbacks;
      totalInstalls += on.installs;
      const regsOk = ['eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi']
        .every(k => off[k] === on[k]);
      const memOk = off.data === on.data;
      const eipOk = off.eip === on.eip;
      let why = '';
      if (!regsOk) why = `\n         off ${hexRegs(off)}\n         on  ${hexRegs(on)}`;
      else if (!memOk) why = ' (guest memory differs)';
      else if (!eipOk) why = ` (eip ${off.eip.toString(16)} vs ${on.eip.toString(16)})`;
      check(`leaf_fb: ${name}`, regsOk && memOk && eipOk, why);
      check(`  leaf_fb: ${name}: entered through H464`, on.leafFbRuns >= 1,
        `installs=${on.installs} runs=${on.runs} leafRuns=${on.leafRuns} ` +
        `leafFbRuns=${on.leafFbRuns} declWhy=${on.declWhy} — the block did ` +
        `not take the fallback leaf, so this case measured something else`);
      check(`  leaf_fb: ${name}: a fallback really ran`, on.fallbacks >= 1,
        `fallbacks=${on.fallbacks} natives=${on.natives} — the op chosen as ` +
        `the fallback has become a native kind, so the seam was never crossed`);
      check(`  leaf_fb: ${name}: the pure leaf was not used`, on.leafRuns === 0,
        `leafRuns=${on.leafRuns}`);
      return { off, on };
    }

    // (1) ENTRY. The plainest possible shape: natives, one fallback, RET.
    fbEquiv('one fallback between native ops',
      [...movRI(EAX, 0x12345678), ...bswapR(EAX), ...movRR(ECX, EAX),
       ...incR(EDX)]);

    // (2) THE SPILL DIRECTION. `ebx` is written by a NATIVE micro-op (so it
    //     lives in a wasm local, not in the global) and then read by the
    //     fallback. If the spill were missing or partial, the threaded
    //     handler would bswap whatever $ebx held before the block.
    fbEquiv('a native write is visible to the fallback that reads it',
      [...movRI(EBX, 0x0A0B0C0D), ...bswapR(EBX), ...movRR(EAX, EBX)]);

    // (3) THE RELOAD DIRECTION. The fallback writes `esi`; the native ops
    //     after it consume that value. A missing reload leaves the local
    //     holding the pre-fallback value and the block computes with it.
    fbEquiv('a fallback write is visible to the natives that read it',
      [...movRI(ESI, 0xCAFEBABE), ...bswapR(ESI), ...aluRR(ADD, EAX, ESI),
       ...movRR(EDI, ESI), ...aluRR(XOR, ECX, ESI)]);

    // (4) The seam is crossed more than once, and the ops between two
    //     fallbacks must not be re-run or skipped by the resume arithmetic.
    fbEquiv('two fallbacks in one block',
      [...movRI(EAX, 0x00112233), ...bswapR(EAX), ...aluRI(0, EAX, 0x10),
       ...movRR(ECX, EAX), ...bswapR(ECX), ...aluRR(SUB, EDX, ECX)]);

    // (5) Boundary positions: the very first micro-op, and the very last one
    //     before the terminator. Both are the arithmetic most likely to be
    //     off by one.
    fbEquiv('the FIRST micro-op is the fallback',
      [...bswapR(EBX), ...movRR(EAX, EBX), ...aluRR(ADD, ECX, EBX),
       ...incR(EDX)]);
    fbEquiv('the LAST micro-op is the fallback',
      [...movRI(EDI, 0x77665544), ...aluRI(0, EDI, 3), ...movRR(EDX, EDI),
       ...bswapR(EDI)]);

    // (6) Memory either side of the seam. A store before the fallback and a
    //     load after it: the fallback path must not disturb the descriptor's
    //     view of guest memory.
    fbEquiv('stores and loads either side of a fallback',
      [...load32(EAX, EBX, 0x10), ...store32(EAX, EBX, 0x24),
       ...bswapR(EAX), ...store32(EAX, EBX, 0x28),
       ...load32(ECX, EBX, 0x24), ...aluRR(ADD, ECX, EAX)]);

    // (7) THE A/B AGAINST ITSELF. Gate H464 off and the same bytes install on
    //     H458 instead -- an optimization, not a behaviour change. This is the
    //     round-17 twin of round 16's `leaf on and leaf off` case.
    {
      const bytes = fbBlock([...movRI(EAX, 0x01020304), ...bswapR(EAX),
                             ...aluRR(SUB, EAX, ECX), ...movRR(EDI, EAX),
                             ...bswapR(EDI), ...aluRR(AND, EDX, EDI)]);
      leafFbGate = true;
      const withFb = arm(bytes, true);
      leafFbGate = false;
      const without = arm(bytes, true);
      leafFbGate = true;
      const same = ['eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi']
        .every(k => withFb[k] === without[k]) &&
        withFb.data === without.data && withFb.eip === without.eip;
      check('leaf_fb on and leaf_fb off compute the same state', same,
        `\n         leaf_fb ${hexRegs(withFb)}\n         gen     ${hexRegs(without)}`);
      check('  leaf_fb on took H464', withFb.leafFbRuns >= 1,
        `leafFbRuns=${withFb.leafFbRuns}`);
      check('  leaf_fb off still installed, on H458',
        without.leafFbRuns === 0 && without.leafRuns === 0 &&
        without.installs >= 1 && without.runs >= 1,
        `installs=${without.installs} runs=${without.runs} ` +
        `leafRuns=${without.leafRuns} leafFbRuns=${without.leafFbRuns}`);
      check('  both arms ran the same number of fallback ops',
        withFb.fallbacks === without.fallbacks,
        `leaf_fb=${withFb.fallbacks} gen=${without.fallbacks}`);
    }

    // (8) SMC OF A LEAF_FB INSTALL. The retirement stamp is a handler index
    //     written over the block's first word, and H464 is a THIRD index
    //     $bx_is_desc_word has to recognise. If it did not, a rewritten block
    //     would keep running its stale descriptor -- the exact bug round 16
    //     had to fix for H463.
    {
      const v1 = fbBlock([...movRI(EAX, 0x1111), ...bswapR(EAX),
                          ...movRR(ECX, EAX), ...incR(EDX)]);
      const v2 = fbBlock([...movRI(EAX, 0x2222), ...bswapR(EAX),
                          ...movRR(ECX, EAX), ...decR(EDX)]);
      if (v1.length !== v2.length) throw new Error('the leaf_fb SMC pair must be the same length');

      const smcFb = (blockExec) => {
        const addr = nextCode();
        const wa = g2w(addr);
        const runAt = () => {
          seedData();
          e.set_eax(SEED.eax); e.set_ecx(SEED.ecx); e.set_edx(SEED.edx);
          e.set_ebx(SEED.ebx); e.set_esi(SEED.esi); e.set_edi(SEED.edi);
          e.set_ebp(0); e.set_esp(STACK_TOP);
          dv.setUint32(g2w(STACK_TOP), 0, true);
          e.set_eip(addr);
          e.run(100000);
          return `${(e.get_eax() >>> 0).toString(16)}/${(e.get_ecx() >>> 0).toString(16)}/${(e.get_edx() >>> 0).toString(16)}`;
        };
        e.set_block_exec_min_uops(2);
        e.set_block_exec_leaf(1);
        e.set_block_exec_leaf_fb(1);
        e.set_block_exec(blockExec ? 1 : 0);
        const fb0 = e.get_block_exec_leaf_fb_runs();
        for (let i = 0; i < v1.length; i++) mem[wa + i] = v1[i];
        const first = runAt();
        const fbFirst = e.get_block_exec_leaf_fb_runs() - fb0;
        e.set_ebx(addr);
        for (let i = 0; i < v2.length; i += 4) {
          const word = v2[i] | (v2[i + 1] << 8) | (v2[i + 2] << 16) | (v2[i + 3] << 24);
          e.set_eax(word >>> 0);
          const w = nextCode();
          const ww = g2w(w);
          const st = [...store32(EAX, EBX, i), ...RET];
          for (let k = 0; k < st.length; k++) mem[ww + k] = st[k];
          e.set_esp(STACK_TOP); dv.setUint32(g2w(STACK_TOP), 0, true);
          e.set_eip(w); e.run(1000);
        }
        const second = runAt();
        e.set_block_exec(0);
        return { first, second, fbFirst };
      };
      const soff = smcFb(false);
      const son = smcFb(true);
      check('leaf_fb SMC: the install really was a leaf_fb install',
        son.fbFirst >= 1,
        `leafFbRuns=${son.fbFirst} — nothing H464-shaped was invalidated`);
      check('leaf_fb SMC: the first run agrees', soff.first === son.first,
        `${soff.first} vs ${son.first}`);
      check('leaf_fb SMC: the rewritten block is re-decoded and agrees',
        soff.second === son.second, `${soff.second} vs ${son.second}`);
      check('leaf_fb SMC: the rewrite actually changed the answer',
        soff.first !== soff.second, `${soff.first} == ${soff.second}`);
    }

    // ==================================================================
    // PART B -- THE PER-PAGE REGION RESERVE.
    //
    // Section 26.2: the two descriptor families share one 16KB per-page
    // chunk on a first-come basis, so a page full of cheap one-block
    // descriptors can leave a region candidate with nowhere to publish. The
    // reserve is the fix: N bytes at the end of the chunk that ONLY the
    // region path may spend. It defaults to 0, so the shipped behaviour is
    // round 16's exactly; these cases are about the mechanism.
    //
    // The page below is round 14's overflow page -- ~180 tiny one-block
    // shapes in one 4KB guest page, far more descriptor than 16KB holds.
    // ==================================================================
    {
      const pageBase = (imageBase + 0x60000 + codeOffset + 0xFFF) & ~0xFFF;
      const BLOCK_BYTES = 17;
      const N = Math.floor((4096 - JOIN.length) / BLOCK_BYTES);
      const bytes = [];
      for (let i = 0; i < N; i++) {
        bytes.push(...aluRI(0, EAX, i + 1));
        bytes.push(...aluRI(0, EAX, 0x10000 + i));
        bytes.push(...jmpRel32(0));
      }
      bytes.push(...JOIN);

      function runReserve(reserve) {
        const wa = g2w(pageBase);
        for (let i = 0; i < bytes.length; i++) mem[wa + i] = bytes[i];
        e.invalidate_code_range(pageBase, 4096);
        seedData();
        normalizeFlags();
        e.set_block_exec_min_uops(2);
        e.set_page_desc_rg_reserve(reserve);
        e.set_block_exec(1);
        e.set_eax(0); e.set_ecx(SEED.ecx); e.set_edx(SEED.edx);
        e.set_ebx(SEED.ebx); e.set_esi(SEED.esi); e.set_edi(SEED.edi);
        e.set_ebp(0); e.set_esp(STACK_TOP);
        dv.setUint32(g2w(STACK_TOP), 0, true);
        const before = {
          installs: e.get_block_exec_installs(),
          declines: e.get_page_desc_reserve_declines(),
          compiles: e.get_page_compiles(),
        };
        e.set_eip(pageBase);
        e.run(100000);
        const out = {
          eax: e.get_eax() >>> 0, ecx: e.get_ecx() >>> 0,
          edx: e.get_edx() >>> 0, eip: e.get_eip() >>> 0,
          installs: e.get_block_exec_installs() - before.installs,
          declines: e.get_page_desc_reserve_declines() - before.declines,
          compiles: e.get_page_compiles() - before.compiles,
        };
        e.set_block_exec(0);
        e.set_page_desc_rg_reserve(0);
        return out;
      }

      const r0 = runReserve(0);
      const r8k = runReserve(8192);

      // (1) The reserve must be inert as far as the guest is concerned. It
      //     only ever declines an INSTALL, and a declined block runs as
      //     threaded code -- so the answer cannot move.
      const same = r0.eax === r8k.eax && r0.ecx === r8k.ecx &&
        r0.edx === r8k.edx && r0.eip === r8k.eip;
      check('the region reserve does not change what the guest computes', same,
        `r0 eax=${r0.eax.toString(16)} eip=${r0.eip.toString(16)} / ` +
        `r8k eax=${r8k.eax.toString(16)} eip=${r8k.eip.toString(16)}`);

      // (2) The default is off, so a zero reserve must never account for a
      //     single decline. (If it did, the shipped build would differ from
      //     round 16 and every A/B above would be measuring two changes.)
      check('  a zero reserve declines nothing', r0.declines === 0,
        `reserveDeclines=${r0.declines} at reserve=0`);

      // (3) The mechanism fires, and the counter only counts declines the
      //     reserve CAUSED -- requests that would have overflowed the chunk
      //     anyway are the chunk's business, not the reserve's.
      check('  a nonzero reserve declines one-block installs it caused',
        r8k.declines >= 1,
        `reserveDeclines=${r8k.declines} installs=${r8k.installs} — the ` +
        `reserve never bound, so this page is not packed tightly enough`);
      check('  and it costs one-block installs, as it must',
        r8k.installs < r0.installs,
        `installs r0=${r0.installs} r8k=${r8k.installs}`);

      // (4) A reserve buys room by DECLINING, never by dropping the page.
      //     A dropped page is visible as a recompile, and a recompile costs
      //     a decode of every block on it (sections 22/23's kill rule).
      check('a reserve never drops the page', r8k.compiles <= r0.compiles + 1,
        `pageCompiles r0=${r0.compiles} r8k=${r8k.compiles}`);

      check('the reserve is left at its shipped default',
        e.get_page_desc_rg_reserve() === 0,
        `rgReserve=${e.get_page_desc_rg_reserve()}`);
    }
  }

  // ------------------------------------------------------------------
  // ROUND 18 -- THE SIDE EXIT THROUGH AN UNMODELLED TERMINATOR (§28).
  //
  // Before this round the region classifier refused any block whose
  // terminator it could not model -- a call, a ret, an indirect branch, a
  // loop/jecxz -- and the whole region walk stopped at the edge INTO such a
  // block. That refusal (`termNotModelled`) was the top classify refusal in
  // five of the six apps censused in §14.2.
  //
  // `term_kind 10` admits the member anyway and models NOTHING about what its
  // terminator does. The member's body runs natively like any other; at its
  // end the executor sets `$ip` to that member's OWN copied terminator, spills
  // and returns to `$next` -- byte for byte what the one-block path has always
  // done at `tail_ip`, except that the pointer is per-member instead of one
  // per descriptor. So a `call` is not inlined, a `ret` is not modelled, and
  // an indirect jump's target is never computed here: the threaded
  // interpreter does all of it, exactly as before.
  //
  // Every case below therefore has the same shape of proof. Three arms of the
  // same bytes -- threaded, round 17 (the side exit refused), round 18 -- must
  // agree on every register, on guest memory and on the final EIP, and the
  // round-18 arm must show the side exit actually admitted. Agreement alone
  // would be satisfied by a region that never installed.
  // ------------------------------------------------------------------
  console.log('\n-- round 18: side exit through an unmodelled terminator --');
  {
    // The round-15/16 x87 encoders are scoped to their own section, so case
    // (7) below carries its own copy rather than widening theirs.
    const x87m18 = (op, digit, base, disp) =>
      [op, 0x80 | (digit << 3) | base, ...le32(disp)];
    const fldM18 = (base, disp) => x87m18(0xD9, 0, base, disp);
    const fstpM18 = (base, disp) => x87m18(0xD9, 3, base, disp);

    // Three arms, not two. The r17 arm is what makes this a test of the side
    // exit rather than a test of the executor: it holds the executor, both
    // leaves and the walk exactly where round 17 left them and varies only
    // whether the classifier may admit a kind-10 member.
    // `bytes` may be a byte array or a function of the address the arm will
    // run at, for a snippet that has to name its own address (case 3).
    function tailRegion(name, bytes, seed, opts) {
      const mk = typeof bytes === 'function'
        ? () => { const a = nextCode(); return [bytes(a), { addr: a }]; }
        : () => [bytes, undefined];
      let [b, o] = mk();
      const threaded = arm(b, false, seed, o);
      tailGate = false;
      [b, o] = mk();
      const r17 = arm(b, true, seed, o);
      tailGate = true;
      const riBefore = e.get_block_exec_region_installs();
      const declBefore = {};
      for (const w of [1, 2, 3, 4, 5, 6, 8, 9]) declBefore[w] = e.get_block_exec_region_why_n(w);
      [b, o] = mk();
      const r18 = arm(b, true, seed, o);
      const installs = e.get_block_exec_region_installs() - riBefore;
      const keys = ['eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi'];
      const agree = (a, b) => keys.every(k => a[k] === b[k]) &&
        a.data === b.data && a.eip === b.eip;
      const ok = agree(threaded, r17) && agree(threaded, r18);
      check(name, ok, ok ? '' :
        `\n         threaded ${hexRegs(threaded)}` +
        `\n         r17      ${hexRegs(r17)}` +
        `\n         r18      ${hexRegs(r18)}` +
        `\n         eip ${threaded.eip.toString(16)} / ` +
        `${r17.eip.toString(16)} / ${r18.eip.toString(16)}` +
        (threaded.data === r18.data ? '' : '\n         guest memory differs'));
      if (!(opts && opts.mayDecline)) {
        check(`  ${name}: a kind-10 member was admitted and ran`,
          r18.tailMembers >= 1 && r18.tailRuns >= 1,
          `tailMembers=${r18.tailMembers} tailRegions=${r18.tailRegions} ` +
          `sideExits=${r18.tailRuns} admitted=${r18.tailAdmitted} ` +
          `regionInstalls=${installs} lastNoTail=${e.get_block_exec_tail_norm()} ` +
          `why=${e.get_block_exec_region_why()} decl=[${
            [1, 2, 3, 4, 5, 6, 8, 9].map(w =>
              `${w}:${e.get_block_exec_region_why_n(w) - declBefore[w]}`)
              .filter(t => !t.endsWith(':0')).join(' ')}]` +
          ` — nothing side-exited, so this case proves nothing`);
        // And the round-17 arm must NOT have one. Without this the case could
        // pass on a build where the gate does nothing at all.
        check(`  ${name}: round 17 refused it, as it must`,
          r17.tailMembers === 0 && r17.tailRuns === 0,
          `r17 tailMembers=${r17.tailMembers} sideExits=${r17.tailRuns}`);
      }
      return { threaded, r17, r18, installs };
    }

    // Every block below is deliberately FAT -- a dozen or so micro-ops of
    // filler arithmetic. The shipped cost model prices a descriptor against a
    // fixed entry cost ($BX_C_ENTRY, 190) plus a transfer per exit, so the
    // two- and three-op blocks the earlier sections of this file use decline
    // as `notWorthIt` (declWhy 1) and both arms then run the same threaded
    // code. That is a real property of the executor and not something to
    // lower the floor around: `arm()` already drops $block_exec_min_uops, but
    // the cost model is what decides whether the REGION installs, and it is
    // the thing these cases have to get past honestly.
    const filler = (n) => {
      const out = [];
      for (let i = 0; i < n; i++) {
        out.push(...(i & 1 ? aluRR(ADD, EDX, ESI) : aluRR(XOR, EDX, EDI)));
      }
      return out;
    };

    // (1) A MEMBER ENDING IN `call`. The loop body calls a leaf that adds to
    //     eax and returns. The call is the body block's terminator, so before
    //     this round the region stopped at the edge into the body and the
    //     descriptor was one block (or nothing).
    //
    //     The call's fall-through is deliberately NOT an interior edge: the
    //     callee runs threaded and returns to call+5 through a `ret`, which
    //     re-enters the region only as a fresh ENTRY at whatever block starts
    //     there. That is why a kind-10 member is a dead end with no in-region
    //     successors, and it is what makes "do not model the call" sound.
    tailRegion('member ending in call rel32', asm([
      [...movRI(ECX, 8), ...movRI(EAX, 0)],
      { label: 'top' },
      [...filler(10), ...aluRI(7, ECX, 0)],        // ... ; cmp ecx,0
      { j: 'jcc', cc: JZ, to: 'out' },
      [...filler(10), ...decR(ECX)],
      { j: 'call', to: 'leaf' },
      [...filler(6), ...aluRR(ADD, EAX, ECX)],
      { j: 'jmp', to: 'top' },
      { label: 'out' },
      [...filler(6), ...JOIN],
      { label: 'leaf' },
      [...aluRI(0, EAX, 3), ...RET],               // add eax,3 ; ret
    ]));

    // (2) A MEMBER ENDING IN `ret`. The `ret` is inside the region's closure
    //     -- one arm of a diamond returns rather than joining -- so the
    //     classifier must admit that arm as a kind-10 member and let the
    //     threaded `ret` do the transfer. Nothing about the return address is
    //     modelled; the executor only spills and hands `$ip` the copied `ret`.
    //     Note where the `ret`s have to be to be TESTABLE. A walk never
    //     decodes (round 13), so a successor block that has not run yet has no
    //     published ops and can only become an exit -- which means a `ret` on
    //     a loop's one-time exit path is invisible to this. The callee below
    //     is entered on every trip of the outer loop and BOTH its arms return,
    //     so both `ret`s are hot by the time the walk from the callee's head
    //     runs.
    tailRegion('member ending in ret', asm([
      [...movRI(ECX, 10), ...movRI(EDI, 0)],
      { label: 'outer' },
      [...filler(6), ...decR(ECX)],
      { j: 'call', to: 'fn' },
      [...aluRR(ADD, EDI, EAX), ...aluRI(7, ECX, 0)],
      { j: 'jcc', cc: JNZ, to: 'outer' },
      [...filler(4), ...JOIN],
      { label: 'fn' },
      [...filler(10), ...aluRI(7, ECX, 5)],        // cmp ecx,5
      { j: 'jcc', cc: JB, to: 'low' },
      [...filler(10), ...movRI(EAX, 0x1111), ...aluRR(ADD, EAX, ECX), ...RET],
      { label: 'low' },
      [...filler(10), ...movRI(EAX, 0x2222), ...aluRR(SUB, EAX, ECX), ...RET],
    ]));

    // (3) A MEMBER ENDING IN AN INDIRECT `jmp r32`. The target is a runtime
    //     value, so there is no static successor to walk to even in
    //     principle. This is the case that makes "side exit" the right shape:
    //     a modelling approach would have to give up here, and this one does
    //     not have to know anything.
    //
    //     The indirect jump is on the HOT path, not the exit path, for the
    //     same reason the `ret` case above is arranged the way it is: it is
    //     taken on every trip, and only the last trip leaves through the
    //     ordinary conditional branch.
    //
    //     The target is a literal, so the snippet cannot be assembled until
    //     its own address is known -- hence the builder form of `tailRegion`.
    //     The jump goes forward to the loop's own tail block, which is taken
    //     on every trip, so the kind-10 member is hot by the time the walk
    //     runs rather than sitting on a one-shot exit path.
    tailRegion('member ending in indirect jmp r32', (addr) => {
      // Two passes: assemble once to learn the tail label's offset, then
      // again with the real absolute address in the `mov edx,imm32`.
      const build = (tgtAbs) => asm([
        [...movRI(ECX, 10), ...movRI(EAX, 0)],
        { label: 'top' },
        [...filler(10), ...aluRI(7, ECX, 0)],
        { j: 'jcc', cc: JZ, to: 'out' },
        [...filler(10), ...decR(ECX), ...aluRI(0, EAX, 5),
         ...movRI(EDX, tgtAbs), ...jmpAbsR(EDX)],
        { label: 'tail' },
        [...filler(6), ...aluRI(0, EAX, 0x100)],
        { j: 'jmp', to: 'top' },
        { label: 'out' },
        // EDX is the indirect jump's scratch and therefore holds a different
        // literal in each arm by construction. Clear it before the flags probe
        // so the arms are comparable on the registers the SNIPPET computes.
        [...filler(6), ...aluRR(XOR, EDX, EDX), ...JOIN],
      ]);
      // The `tail` label's offset does not depend on the immediate -- `mov
      // edx,imm32` is five bytes whatever it holds -- so it can be summed
      // from the piece lengths ahead of it, with the jcc's six.
      const tailOff =
        movRI(ECX, 10).length + movRI(EAX, 0).length +
        filler(10).length + aluRI(7, ECX, 0).length + 6 +
        filler(10).length + decR(ECX).length + aluRI(0, EAX, 5).length +
        movRI(EDX, 0).length + jmpAbsR(EDX).length;
      return build(addr + tailOff);
    });

    // (4) A MEMBER ENDING IN `loop`. `loop` both decrements ecx and branches,
    //     which is precisely the kind of terminator the classifier has no
    //     term_kind for -- and note the member's body must NOT be credited
    //     with the decrement, because the threaded terminator performs it
    //     after the executor has spilled.
    {
      // `loop` is rel8 and asm() only emits rel32 jumps, so this one is laid
      // out by hand: [head][body ... loop back to body][join].
      const head = [...movRI(EAX, 0), ...movRI(ECX, 7)];
      const body = [...filler(10), ...aluRI(0, EAX, 2), ...aluRI(0, EDX, 1)];
      const back = -(body.length + 2);
      const bytes = [...head, ...body, ...loopRel8(back), ...JOIN];
      tailRegion('member ending in loop rel8', bytes, null, { mayDecline: true });
    }

    // (5) SMC IN THE CALLEE WHILE THE REGION IS LIVE. The callee is threaded
    //     code the region never owned, so rewriting it must invalidate the
    //     callee and leave the descriptor alone -- and the answer must follow
    //     the NEW bytes. Round 13's rule is what makes this work: a region's
    //     page-index footprint is its HEAD BLOCK only, members keep their own
    //     entries, and a write to a page drops that page.
    //
    //     The GUEST does the write. A host-side poke into linear memory is not
    //     self-modifying code as far as this emulator is concerned -- nothing
    //     marks the page, so the stale threaded stream keeps running and the
    //     case would be asserting something that was never promised. So the
    //     snippet stores a new immediate into its own callee with a
    //     `mov dword [abs],imm32`, and the two configurations differ only in
    //     the VALUE stored: the control writes back the immediate already
    //     there, so both take the identical invalidation path and the only
    //     variable is whether the new bytes were honoured.
    {
      const storeAbsI32 = (abs, v) => [0xC7, 0x05, ...le32(abs), ...le32(v)];
      // The store's operand is a literal, so the snippet has to be assembled
      // against the address it will run at -- twice, because the callee's
      // offset inside the blob is what the store points at. `mov
      // dword [abs],imm32` is ten bytes whatever it holds, so the two passes
      // have identical layout and the second one is exact.
      const smcBytes = (addr, newImm) => {
        const leafBody = [...aluRI(0, EAX, 3), ...RET];
        const shape = (immAbs) => asm([
          [...movRI(ECX, 6), ...movRI(EAX, 0)],
          { label: 'top' },
          [...filler(10), ...aluRI(7, ECX, 0)],
          { j: 'jcc', cc: JZ, to: 'out' },
          [...filler(10), ...decR(ECX), ...storeAbsI32(immAbs, newImm)],
          { j: 'call', to: 'leaf' },
          { j: 'jmp', to: 'top' },
          { label: 'out' },
          [...filler(6), ...JOIN],
          { label: 'leaf' },
          leafBody,
        ]);
        const probe = shape(0);
        const leafOff = probe.length - leafBody.length;
        const out = shape(addr + leafOff + 2);   // the imm32 of `add eax,imm32`
        if (out.length !== probe.length) throw new Error('smc layout shifted');
        // Pin the layout: a change to the encoders must fail here rather than
        // silently aim the store at a ModRM byte.
        if (out[leafOff] !== 0x81 || out[leafOff + 2] !== 3 ||
            out[out.length - 1] !== 0xC3) {
          throw new Error('smc: store target is not the callee immediate');
        }
        return out;
      };
      const runSmc = (newImm, blockExec) => {
        const a = nextCode();
        return arm(smcBytes(a, newImm), blockExec, null, { addr: a });
      };
      const ctlThreaded = runSmc(3, false);
      const ctlRegion = runSmc(3, true);
      const smcThreaded = runSmc(0x20, false);
      const smcRegion = runSmc(0x20, true);
      // Without this the case could "pass" on a build where nothing sees the
      // store at all -- the region would agree with a threaded run that was
      // equally stale.
      check('  SMC case: the interpreter itself sees the store',
        ctlThreaded.eax !== smcThreaded.eax,
        `threaded control eax=${ctlThreaded.eax.toString(16)} ` +
        `rewrite eax=${smcThreaded.eax.toString(16)}`);
      check('SMC in the callee is seen while the region is live',
        smcRegion.eax === smcThreaded.eax && smcRegion.eip === smcThreaded.eip,
        `region eax=${smcRegion.eax.toString(16)} ` +
        `threaded eax=${smcThreaded.eax.toString(16)} — the rewrite was not ` +
        `observed, so stale code ran under the descriptor`);
      check('  and the control agrees between the two as well',
        ctlRegion.eax === ctlThreaded.eax,
        `region eax=${ctlRegion.eax.toString(16)} ` +
        `threaded eax=${ctlThreaded.eax.toString(16)}`);
      // The write drops the page holding the live region. Continuing to its
      // CALL tail would execute the retired descriptor. Demand an actual
      // multi-block execution followed by the new instruction-boundary exit.
      check('  the live region exits at the code-writing instruction',
        smcRegion.tailRegions >= 1 && smcRegion.regionSmcExits >= 1,
        `regions=${smcRegion.tailRegions} smcExits=${smcRegion.regionSmcExits}`);
    }

    // (6) RE-ENTRY AT call+5. The callee returns into the middle of the
    //     region's extent, and that landing must be a normal block entry --
    //     not a resumption of the descriptor, and not a reason to retire it.
    //     A region that got retired on every return would show up as a region
    //     install count that climbs with the trip count, so this case counts.
    {
      const loop = trips => asm([
        [...movRI(ECX, trips), ...movRI(EAX, 0)],
        { label: 'top' },
        [...filler(10), ...aluRI(7, ECX, 0)],
        { j: 'jcc', cc: JZ, to: 'out' },
        [...filler(10), ...decR(ECX)],
        { j: 'call', to: 'leaf' },
        [...filler(6), ...aluRR(ADD, EAX, ECX)],   // this IS call+5's block
        { j: 'jmp', to: 'top' },
        { label: 'out' },
        [...filler(6), ...JOIN],
        { label: 'leaf' },
        [...aluRI(0, EAX, 1), ...RET],
      ]);
      // The install COUNT AT ONE TRIP COUNT cannot answer this. The counter is
      // global and this snippet has several hot heads -- the loop top, the
      // callee, the return landing, the exit block -- so a healthy run
      // installs a handful of regions at warm-up no matter what happens on
      // return, and "a handful" and "one per return" are indistinguishable at
      // a dozen trips. What separates them is how the count SCALES with the
      // trip count: an install per return tracks it, warm-up does not.
      // Both snippets go on pages of their own, well past everything
      // `nextCode()` hands out. Descriptors live in a per-page chunk (round
      // 14), and by this point in the file the pages the other cases share
      // are full -- a snippet placed there declines with `noRoom` (declWhy 3)
      // and measures the chunk rather than the return landing.
      let scalePage = imageBase + 0x80000;
      const measure = trips => {
        const where = scalePage; scalePage += 0x10000;
        const ri = e.get_block_exec_region_installs();
        const pr = e.get_block_exec_walk_probes();
        const at = e.get_block_exec_walk_attempts();
        const dw = {};
        for (const w of [1, 2, 3, 4, 5, 6, 8, 9]) dw[w] = e.get_block_exec_region_why_n(w);
        const r = arm(loop(trips), true, null, { addr: where });
        return { installs: e.get_block_exec_region_installs() - ri,
                 sideExits: r.tailRuns, eax: r.eax,
                 probes: e.get_block_exec_walk_probes() - pr,
                 attempts: e.get_block_exec_walk_attempts() - at,
                 decl: [1, 2, 3, 4, 5, 6, 8, 9]
                   .map(w => `${w}:${e.get_block_exec_region_why_n(w) - dw[w]}`)
                   .filter(t => !t.endsWith(':0')).join(' ') };
      };
      const few = measure(40);
      const many = measure(400);
      check('returning to call+5 does not retire the region',
        many.sideExits >= few.sideExits * 5 &&
        many.installs <= few.installs + 8,
        `40 trips: installs=${few.installs} sideExits=${few.sideExits} ` +
        `probes=${few.probes} attempts=${few.attempts} decl=[${few.decl}]; ` +
        `400 trips: installs=${many.installs} sideExits=${many.sideExits} ` +
        `probes=${many.probes} attempts=${many.attempts} decl=[${many.decl}] — ` +
        `the installs tracked the trip count, so the return landing is ` +
        `invalidating the descriptor`);
    }

    // (7) AN x87 MEMBER IN A REGION THAT ALSO HAS A kind-10 TAIL. Round 16 let
    //     x87 into a region; this checks the two features compose, because the
    //     x87 path and the side exit both touch what the executor must have
    //     spilled before it hands control back to `$next`.
    tailRegion('x87 member beside a call tail', asm([
      [...movRI(ECX, 5), ...movRI(EAX, 0)],
      { label: 'top' },
      [...filler(10), ...aluRI(7, ECX, 0)],
      { j: 'jcc', cc: JZ, to: 'out' },
      [...filler(8), ...fldM18(EBX, 0x80), ...fstpM18(EBX, 0xA0), ...decR(ECX)],
      { j: 'call', to: 'leaf' },
      { j: 'jmp', to: 'top' },
      { label: 'out' },
      [...filler(6), ...JOIN],
      { label: 'leaf' },
      [...aluRI(0, EAX, 7), ...RET],
    ]), null, { mayDecline: true });

    // (8) THE GATE. Off must be round 17 exactly -- no admissions, no side
    //     exits -- and the switch must be left in its shipped state.
    {
      tailGate = false;
      const off = arm(asm([
        [...movRI(ECX, 6), ...movRI(EAX, 0)],
        { label: 'top' },
        [...filler(10), ...aluRI(7, ECX, 0)],
        { j: 'jcc', cc: JZ, to: 'out' },
        [...filler(10), ...decR(ECX)],
        { j: 'call', to: 'leaf' },
        { j: 'jmp', to: 'top' },
        { label: 'out' },
        [...filler(6), ...JOIN],
        { label: 'leaf' },
        [...aluRI(0, EAX, 3), ...RET],
      ]), true, null);
      tailGate = true;
      check('the gate off admits nothing and side-exits never',
        off.tailAdmitted === 0 && off.tailRuns === 0,
        `admitted=${off.tailAdmitted} sideExits=${off.tailRuns}`);
      // The shipped default is asserted on the FRESH instance at the top of
      // this file, not here: `arm()` writes the switch on every call, so by
      // this point the global says only what the last arm asked for. Put it
      // back where the rest of the file expects it.
      e.set_block_exec_tail_exits(1);
    }
  }

  console.log('\n-- coverage of this run --');
  const tot = totalNative + totalFallback;
  console.log(`  ${totalInstalls} blocks installed, ${totalNative} ops native, ` +
    `${totalFallback} fallback (${tot ? (100 * totalNative / tot).toFixed(1) : '-'}% native)`);
  check('the executor actually ran natively for most ops',
    tot > 0 && totalNative / tot > 0.6,
    `native share ${tot ? (100 * totalNative / tot).toFixed(1) : 0}%`);
  check('the gate is left OFF', e.get_block_exec() === 0);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
