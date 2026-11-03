'use strict';

// Execute the canonical artifact and unchanged original PE first. Synthetic
// bytes below are isolated admission controls, never a substitute for the PE.
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const crypto = require('crypto');
const { createHostImports } = require('../lib/host-imports');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
async function main() {
  const wasm = fs.readFileSync(path.join(__dirname, '../build/wine-assembly.wasm'));
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { exports: null, getMemory: () => memory.buffer }, imports = createHostImports(ctx);
  imports.host.memory = memory; imports.host.log = () => {}; imports.host.log_i32 = () => {};
  const e = (await WebAssembly.instantiate(wasm, { host: imports.host })).instance.exports;
  ctx.exports = e;
  const pe = fs.readFileSync(path.join(__dirname, 'binaries/notepad.exe'));
  assert.equal(sha(pe), 'e7b01ab85a35ba6f577067d13efa522dc3d605de7712340e4acaf7065f866340');
  new Uint8Array(memory.buffer).set(pe, e.get_staging()); assert(e.load_pe(pe.length));
  const area = e.guest_alloc(8192) >>> 0, stack = area + 4096;
  const names = ['eax','ecx','edx','ebx','esp','ebp','esi','edi'];
  const flags = () => ['op','a','b','res','sign_shift'].map(n => e['get_flag_' + n]() >>> 0);
  const snap = () => ({ regs: names.map(n => e['get_' + n]() >>> 0), pc: e.get_eip() >>> 0, flags: flags(),
    vitals: [e.guest_read32(area), e.guest_read32(area + 4)],
    operand: [0,4,8,12].map(offset => e.guest_read32(area + 1024 + offset) >>> 0) });
  const arm = protectedMode => protectedMode ? e.set_rep_store_step(area) : e.set_instruction_watchpoint(area);
  const disarm = () => { e.set_rep_store_step(0); e.set_instruction_watchpoint(0); };
  e.guest_write32(area, 0x42c80000); e.guest_write32(area + 4, 0x42c80000);
  const report = { moduleSHA256: sha(wasm), peSHA256: sha(pe), cases: [], original: [] };
  // Real PUSH, MOV, SUB, all unchanged, stepping from the actual PE entry.
  assert.equal(e.get_eip() >>> 0, 0x4010cc);
  assert.deepEqual(Array.from({ length: 6 }, (_, i) => e.guest_read8(0x4010cc + i)), [0x55,0x8b,0xec,0x83,0xec,0x44]);
  e.set_esp(stack); e.set_ebp(0x12345678); arm(true);
  for (const pc of [0x4010cc, 0x4010cd, 0x4010cf]) {
    assert.equal(e.get_eip() >>> 0, pc);
    const before = snap(); e.run(1); report.original.push({ before, after: snap() });
  }
  assert.equal(e.get_eip() >>> 0, 0x4010d2);
  assert.equal(e.get_esp() >>> 0, stack - 4 - 0x44);
  assert.equal(e.get_ebp() >>> 0, stack - 4);
  assert.deepEqual(flags(), [2, stack - 4, 0x44, stack - 4 - 0x44, 31]);
  const protectedOriginal = snap(); disarm();
  e.set_eip(0x4010cf); e.set_esp(stack - 4); arm(false); e.run(1);
  assert.deepEqual(snap(), protectedOriginal, 'original SUB protected/unarmed parity'); disarm();
  report.cases.push('unchanged original PE PUSH/MOV/SUB and exact SUB lazy flags/ESP');

  // Both immediate encodings, every register, carry/overflow/zero/sign edges.
  // ADD/OR/AND/SUB/XOR/CMP are admitted; ADC/SBB remain outside this proof.
  const pc = area + 128;
  let controls = 0;
  for (const op of [0,1,4,5,6,7]) for (let reg = 0; reg < 8; reg++)
    for (const encoding of [0x81,0x83]) for (const a of [0,0x7fffffff,0x80000000,0xffffffff])
      for (const imm of (encoding === 0x83 ? [0,0x44,-1,-128] : [0,0x80000000,0xffffffff])) {
        const b = imm >>> 0;
        const bytes = encoding === 0x83 ? [encoding,0xc0 | op << 3 | reg,imm & 255] :
          [encoding,0xc0 | op << 3 | reg,b & 255,b >>> 8 & 255,b >>> 16 & 255,b >>> 24];
        let reference;
        for (const protectedMode of [false,true]) {
          disarm(); bytes.forEach((x, i) => e.guest_write8(pc + i, x));
          names.forEach((n, i) => e['set_' + n](i === reg ? a : 0x11220000 + i));
          e.set_eip(pc);
          // Seed nondefault lazy a/b even for logic (which preserves them).
          e.test_shift(32, 4, 0x12345678, 1, 1, 0x2468);
          const before = snap(); arm(protectedMode); e.run(1);
          const after = snap(), r = (op === 0 ? a + b : op === 1 ? a | b : op === 4 ? a & b : op === 6 ? a ^ b : a - b) >>> 0;
          const expectedRegs = before.regs.slice(); if (op !== 7) expectedRegs[reg] = r;
          assert.deepEqual(after.regs, expectedRegs);
          assert.equal(after.pc, pc + bytes.length); assert.deepEqual(after.vitals, before.vitals);
          assert.deepEqual(after.flags, op === 0 || op === 5 || op === 7 ?
            [op === 0 ? 1 : 2,a >>> 0,b,r,31] : [3,before.flags[1],before.flags[2],r,31]);
          if (!protectedMode) reference = after; else assert.deepEqual(after, reference);
          disarm();
          const arithmetic = op === 0 || op === 5 || op === 7;
          const cf = !arithmetic ? 0 : op === 0 ? +(a + b > 0xffffffff) : +(a < b);
          const of = !arithmetic ? 0 : op === 0 ? ((~(a ^ b) & (a ^ r)) >>> 31) : (((a ^ b) & (a ^ r)) >>> 31);
          assert.equal(e.test_shift_flags(), cf | +(r === 0) << 1 | (r >>> 31) << 2 | of << 3,
            'materialized CF/ZF/SF/OF agree with independent arithmetic');
        }
        controls++;
      }
  disarm(); report.cases.push({ name: 'register/flags independent model and protected/unarmed parity', controls });

  // Prime an ordinary cached decode before arming, then reject; also reject
  // cold and retry without host repair. Memory forms, prefixes, carry forms,
  // byte aliases and neighbouring register ALU encodings stay excluded.
  const excluded = [];
  for (const opcode of [0x81,0x83]) {
    const tail = opcode === 0x81 ? [1,0,0,0] : [1];
    for (const modrm of [0x28,0x68,0xa8]) excluded.push([opcode,modrm,...(modrm === 0x68 ? [0] : modrm === 0xa8 ? [0,0,0,0] : []),...tail]);
    excluded.push([opcode,0xec,...tail]);
    // The plain register SUB above is allowed; prefix each copy below.
    const plain = excluded.pop();
    for (const prefix of [0x66,0x67,0xf0,0xf2,0xf3,0x26,0x2e,0x36,0x3e,0x64,0x65]) excluded.push([prefix,...plain]);
    for (const regOp of [2,3]) excluded.push([opcode,0xc0 | regOp << 3,...tail]);
  }
  excluded.push([0x80,0xe8,1],[0x82,0xe8,1],[0x29,0xc0]);
  let rejectionCount = 0;
  for (const bytes of excluded) for (const cached of [false,true]) {
    disarm(); bytes.forEach((x,i) => e.guest_write8(pc + i,x));
    names.forEach(n => e['set_' + n](area + 1024)); e.set_eip(pc);
    if (cached) {
      arm(false);
      // Address-size Group1 is already unsupported by the ordinary decoder;
      // it cannot populate a cached block. All other forms prime normally.
      if (bytes[0] === 0x67) assert.throws(() => e.run(1), WebAssembly.RuntimeError);
      else e.run(1);
      // Keep this ordinary cache live until arming itself invalidates it.
      e.set_eip(pc);
    }
    arm(true); const before = snap();
    assert.throws(() => e.run(1), WebAssembly.RuntimeError); assert.deepEqual(snap(), before);
    const memoryBefore = sha(Buffer.from(memory.buffer));
    assert.throws(() => e.run(1), WebAssembly.RuntimeError); assert.deepEqual(snap(), before);
    assert.equal(sha(Buffer.from(memory.buffer)), memoryBefore, 'rejected retry preserves full memory');
    rejectionCount++;
  }
  disarm(); report.cases.push({ name: 'cold and previously ordinary-cached exclusions, full-memory retry', rejectionCount });
  if (process.env.JEDI_EVIDENCE) fs.writeFileSync(path.join(process.env.JEDI_EVIDENCE, 'register-alu-result.json'), JSON.stringify(report,null,2) + '\n');
  console.log(`PASS canonical original SUB; ${controls} ALU model/parity controls; ${rejectionCount} cold/cached exclusions`);
}
main().catch(e => { console.error(e.stack); process.exitCode = 1; });
