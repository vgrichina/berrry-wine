#!/usr/bin/env node
// LOCK-prefixed read-modify-write (07-decoder.wat $try_emit_locked, handler
// 499 $th_lock_rmw) gives the same architectural result as the plain handlers.
//
// In both thread modes the decoder routes every supported LOCK RMW and
// every XCHG with memory through one compare-and-swap handler instead of the
// ordinary per-form handlers. That handler re-derives each form's result and
// flags, so this runs every supported form twice -- cooperative mode 0 and
// concurrent mode 1 -- from fresh code addresses, and requires
// identical memory, EAX/ECX and arithmetic flags, plus an absolute expected
// value so "both wrong the same way" cannot pass. It also checks the encoding
// itself: both modes must dispatch handler 499: separate processes can share
// system heap bytes even when guest threads use the cooperative scheduler.
//
// Operands: aligned, unaligned-within-a-qword (still the atomic path), and one
// that crosses an 8-byte boundary (the split-lock mutex path).
//
// Run: node test/test-lock-prefix-atomic.js

const fs = require('fs');
const path = require('path');
const { createHostImports } = require(path.join(__dirname, '..', 'lib/host-imports'));
const RegionMap = require('../lib/region-map.generated.js');

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
  const dv = new DataView(e.memory.buffer);
  const mem = new Uint8Array(e.memory.buffer);
  mem.set(exeBytes, e.get_staging());
  e.load_pe(exeBytes.length);
  const imageBase = e.get_image_base();
  const g2w = addr => RegionMap.g2w(addr, imageBase);
  const le32 = v => [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];

  // Data in the scratch window test-x86-ops.js uses; code well clear of it
  // (each run takes a fresh 256-byte slot so the block cache never reuses a
  // block decoded under the other mode).
  const DATA = imageBase + 0x8100;
  let codeOffset = 0;
  function runCode(bytes, setup) {
    const codeAddr = imageBase + 0x100000 + codeOffset;
    codeOffset += 256;
    const wa = g2w(codeAddr);
    for (let i = 0; i < bytes.length; i++) mem[wa + i] = bytes[i];
    mem[wa + bytes.length] = 0xC3;
    const stackTop = imageBase + 0xD00000;
    e.set_esp(stackTop);
    dv.setUint32(g2w(stackTop), 0, true);
    setup();
    e.set_eip(codeAddr);
    e.run(100000);
    if (e.get_eip() !== 0) throw new Error(`code at 0x${codeAddr.toString(16)} did not return`);
  }

  const HIST = 499;
  const histCount = () => dv.getUint32(e.get_handler_hist_base() + HIST * 4, true);

  let pass = 0, fail = 0;
  const check = (ok, label, detail) => {
    if (ok) pass++;
    else { fail++; console.log(`  FAIL ${label}${detail ? '  ' + detail : ''}`); }
  };

  // Each case: instruction bytes taking the operand address as a callback, the
  // initial memory dword at that address, registers, and the expected dword.
  // pushfd; pop edi follows, and CF|ZF|SF|OF of EDI are compared.
  const STC = [0xF9], CLC = [0xF8];
  const abs = (pre, modrmOp, a) => [...pre, modrmOp, ...le32(a)];
  const cases = [
    { name: 'lock inc dword', code: a => abs([0xF0, 0xFF], 0x05, a), mem: 0x7FFFFFFF, want: 0x80000000 },
    { name: 'lock dec dword', code: a => abs([0xF0, 0xFF], 0x0D, a), mem: 1, want: 0 },
    { name: 'lock inc word', code: a => abs([0xF0, 0x66, 0xFF], 0x05, a), mem: 0x1234FFFF, want: 0x12340000 },
    { name: 'lock dec byte', code: a => abs([0xF0, 0xFE], 0x0D, a), mem: 0x11223300, want: 0x112233FF },
    { name: 'lock not dword', code: a => abs([0xF0, 0xF7], 0x15, a), mem: 0x0F0F0F0F, want: 0xF0F0F0F0 },
    { name: 'lock neg dword', code: a => abs([0xF0, 0xF7], 0x1D, a), mem: 5, want: 0xFFFFFFFB },
    { name: 'lock add dword,ecx', code: a => abs([0xF0, 0x01], 0x0D, a), mem: 0xFFFFFFF0, ecx: 0x20, want: 0x10 },
    { name: 'lock sub dword,ecx', code: a => abs([0xF0, 0x29], 0x0D, a), mem: 3, ecx: 5, want: 0xFFFFFFFE },
    { name: 'lock or dword,ecx', code: a => abs([0xF0, 0x09], 0x0D, a), mem: 0x00F0, ecx: 0x0F00, want: 0x0FF0 },
    { name: 'lock and dword,ecx', code: a => abs([0xF0, 0x21], 0x0D, a), mem: 0xFF00, ecx: 0x0FF0, want: 0x0F00 },
    { name: 'lock xor dword,ecx', code: a => abs([0xF0, 0x31], 0x0D, a), mem: 0xAAAA, ecx: 0xAAAA, want: 0 },
    { name: 'lock adc dword,ecx (CF=1)', code: a => [...STC, ...abs([0xF0, 0x11], 0x0D, a)], mem: 0xFFFFFFFF, ecx: 0, want: 0 },
    { name: 'lock sbb dword,ecx (CF=1)', code: a => [...STC, ...abs([0xF0, 0x19], 0x0D, a)], mem: 0, ecx: 0, want: 0xFFFFFFFF },
    { name: 'lock add byte,cl', code: a => abs([0xF0, 0x00], 0x0D, a), mem: 0x000000F0, ecx: 0x20, want: 0x00000010 },
    { name: 'lock add dword,imm32', code: a => [...abs([0xF0, 0x81], 0x05, a), ...le32(0x12345678)], mem: 1, want: 0x12345679 },
    { name: 'lock sub dword,imm8', code: a => [...abs([0xF0, 0x83], 0x2D, a), 0x01], mem: 0, want: 0xFFFFFFFF },
    { name: 'lock or byte,imm8', code: a => [...abs([0xF0, 0x80], 0x0D, a), 0x81], mem: 0x55, want: 0xD5 },
    { name: 'lock xadd dword', code: a => abs([0xF0, 0x0F, 0xC1], 0x0D, a), mem: 10, ecx: 5, want: 15, wantEcx: 10 },
    { name: 'lock xadd byte', code: a => abs([0xF0, 0x0F, 0xC0], 0x0D, a), mem: 0xAABBCCFF, ecx: 0x11111102, want: 0xAABBCC01, wantEcx: 0x111111FF },
    { name: 'lock cmpxchg dword (equal)', code: a => abs([0xF0, 0x0F, 0xB1], 0x0D, a), mem: 7, eax: 7, ecx: 9, want: 9, wantEax: 7 },
    { name: 'lock cmpxchg dword (differ)', code: a => abs([0xF0, 0x0F, 0xB1], 0x0D, a), mem: 7, eax: 8, ecx: 9, want: 7, wantEax: 7 },
    { name: 'lock cmpxchg byte (equal)', code: a => abs([0xF0, 0x0F, 0xB0], 0x0D, a), mem: 0x00000042, eax: 0x42, ecx: 0x99, want: 0x00000099 },
    { name: 'xchg dword,ecx (implicit lock)', code: a => abs([0x87], 0x0D, a), mem: 0x11111111, ecx: 0x22222222, want: 0x22222222, wantEcx: 0x11111111 },
    { name: 'xchg byte,cl', code: a => abs([0x86], 0x0D, a), mem: 0xAABBCC11, ecx: 0x22, want: 0xAABBCC22, wantEcx: 0x11 },
  ];
  // SIB-addressed form: lock inc dword [ebx+esi*4+8].
  cases.push({ name: 'lock inc dword [ebx+esi*4+8]',
    code: () => [0xF0, 0xFF, 0x44, 0xB3, 0x08], mem: 41, want: 42,
    sib: a => ({ ebx: a - 8 - 4 * 3, esi: 3 }) });

  const offsets = [0, 3, 6]; // aligned, unaligned inside a qword, split lock
  const unsupported = new Set();
  for (const c of cases) {
    for (const off of (c.sib ? [0] : offsets)) {
      const a = DATA + off;
      const results = [];
      for (const mode of [0, 1]) {
        e.set_lock_atomic_mode(mode);
        e.reset_handler_hist();
        e.set_handler_hist_enabled(1);
        const bytes = [...c.code(a), 0x9C, 0x5F]; // pushfd; pop edi
        try {
          runCode(bytes, () => {
            for (let i = 0; i < 16; i++) mem[g2w(DATA - 4 + i)] = 0xEE;
            dv.setUint32(g2w(a), c.mem >>> 0, true);
            e.set_eax(c.eax === undefined ? 0x5A5A5A5A : c.eax);
            e.set_ecx(c.ecx === undefined ? 0 : c.ecx);
            if (c.sib) { const r = c.sib(a); e.set_ebx(r.ebx); e.set_esi(r.esi); }
          });
        } catch (err) {
          // The cooperative decoder has no handler for a few forms (XADD
          // r/m8): nothing to compare against, so mode 1 is held to the
          // expected values alone.
          if (mode !== 0) throw err;
          e.set_handler_hist_enabled(0);
          results.push(null);
          continue;
        }
        e.set_handler_hist_enabled(0);
        const around = [];
        for (let i = 0; i < 16; i++) around.push(mem[g2w(DATA - 4 + i)]);
        results.push({ mode, word: dv.getUint32(g2w(a), true), eax: e.get_eax() >>> 0, ecx: e.get_ecx() >>> 0,
          flags: e.get_edi() & 0x8C1, around: around.join(','), hits: histCount() });
      }
      const [m0, m1] = results;
      const label = `${c.name} @+${off}`;
      if (!m0) {
        unsupported.add(c.name);
        check(m1.word === (c.want >>> 0), `${label}: mode 1 result (no plain handler)`, `got 0x${m1.word.toString(16)}`);
        if (c.wantEcx !== undefined) check(m1.ecx === (c.wantEcx >>> 0), `${label}: ecx`, `got 0x${m1.ecx.toString(16)}`);
        if (c.wantEax !== undefined) check(m1.eax === (c.wantEax >>> 0), `${label}: eax`, `got 0x${m1.eax.toString(16)}`);
        check(m1.hits > 0, `${label}: mode 1 dispatches handler 499`);
        continue;
      }
      check(m0.word === (c.want >>> 0), `${label}: mode 0 result`, `got 0x${m0.word.toString(16)} want 0x${(c.want >>> 0).toString(16)}`);
      check(m1.word === m0.word && m1.around === m0.around, `${label}: memory matches mode 0`,
        `mode1 0x${m1.word.toString(16)} mode0 0x${m0.word.toString(16)}`);
      check(m1.flags === m0.flags, `${label}: flags match mode 0`, `mode1 0x${m1.flags.toString(16)} mode0 0x${m0.flags.toString(16)}`);
      check(m1.eax === m0.eax && m1.ecx === m0.ecx, `${label}: registers match mode 0`,
        `eax ${m1.eax.toString(16)}/${m0.eax.toString(16)} ecx ${m1.ecx.toString(16)}/${m0.ecx.toString(16)}`);
      if (c.wantEcx !== undefined) check(m1.ecx === (c.wantEcx >>> 0), `${label}: ecx`, `got 0x${m1.ecx.toString(16)}`);
      if (c.wantEax !== undefined) check(m1.eax === (c.wantEax >>> 0), `${label}: eax`, `got 0x${m1.eax.toString(16)}`);
      check(m1.hits > 0, `${label}: mode 1 dispatches handler 499`);
      check(m0.hits > 0, `${label}: mode 0 retains atomic semantics for process peers`);
    }
  }

  // A register-form XCHG and a LOCK-less RMW stay on the ordinary handlers
  // even in mode 1.
  e.set_lock_atomic_mode(1);
  e.reset_handler_hist();
  e.set_handler_hist_enabled(1);
  runCode([0x87, 0xCA, 0x01, 0x0D, ...le32(DATA)], () => { e.set_ecx(1); e.set_edx(2); dv.setUint32(g2w(DATA), 0, true); });
  e.set_handler_hist_enabled(0);
  check(histCount() === 0, 'mode 1: xchg reg,reg and unlocked add [m] keep the ordinary handlers');
  e.set_lock_atomic_mode(0);

  if (unsupported.size) console.log(`  note: no cooperative handler to compare against for: ${[...unsupported].join(', ')}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
