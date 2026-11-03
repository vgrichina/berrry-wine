'use strict';

// Canonical artifact, unchanged original PE and original loaded import first.
// Isolated encoding/mapping controls below never replace that original probe.
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
  const area = e.guest_alloc(8192) >>> 0, pc = area + 128, stack = area + 4096;
  const physical = p => (p - e.get_image_base() + e.get_guest_base()) >>> 0;
  const raw = (p, n) => Buffer.from(new Uint8Array(memory.buffer, physical(p), n)).toString('hex');
  const names = ['eax','ecx','edx','ebx','esp','ebp','esi','edi'];
  const snap = () => ({ regs: names.map(n => e['get_' + n]() >>> 0), pc: e.get_eip() >>> 0,
    flags: ['op','a','b','res','sign_shift'].map(n => e['get_flag_' + n]() >>> 0),
    vitals: raw(area, 8), stack: raw(stack - 256, 512), apiCalls: e.get_api_calls() >>> 0 });
  const disarm = () => { e.set_rep_store_step(0); e.set_instruction_watchpoint(0); };
  const arm = () => e.set_rep_store_step(area);
  const originalBytes = [0xff,0x15,0xe0,0x63,0x40,0];
  const readBytes = (p, n) => Array.from({ length: n }, (_, i) => e.guest_read8(p + i));
  e.guest_write32(area, 0x42c80000); e.guest_write32(area + 4, 0x42c80000);
  const report = { moduleSHA256: sha(wasm), peSHA256: sha(pe), original: [], cases: [] };
  assert.equal(e.get_eip() >>> 0, 0x4010cc);
  assert.deepEqual(readBytes(0x4010d3, 6), originalBytes);
  const target = e.guest_read32(0x4063e0) >>> 0;
  report.originalTarget = target;
  report.originalService = JSON.parse(fs.readFileSync(path.join(__dirname,'../src/api_table.json')))[e.thunk_word(target,1) >>> 0];
  // Keep the actual loaded PE's startup stack, registers and import intact.
  arm();
  for (const p of [0x4010cc,0x4010cd,0x4010cf,0x4010d2]) {
    assert.equal(e.get_eip() >>> 0, p); const before = snap(); e.run(1);
    report.original.push({ before, after: snap() });
  }
  const callBefore = snap(), originalESP = e.get_esp() >>> 0;
  assert.equal(callBefore.pc, 0x4010d3);
  e.run(100); // A large grant must still stop before service execution.
  const callAfter = snap(), expected = structuredClone(callBefore);
  expected.pc = target; expected.regs[4] = originalESP - 4;
  assert.deepEqual(callAfter, expected);
  assert.equal(e.guest_read32(originalESP - 4) >>> 0, 0x4010d9);
  report.original.push({ before: callBefore, after: callAfter, returnAddress: 0x4010d9 });
  // The service has no protected continuation. Both FIRST entry and retry
  // must preserve the entire memory, CPU, lazy flags, stack and vitals.
  const serviceMemory = sha(Buffer.from(memory.buffer));
  for (let i = 0; i < 2; i++) {
    assert.throws(() => e.run(100), WebAssembly.RuntimeError);
    assert.deepEqual(snap(), callAfter); assert.equal(sha(Buffer.from(memory.buffer)), serviceMemory);
  }
  report.cases.push({ name: 'original CALL commits once, service rejects before effects', serviceMemory });
  // Resume the exact original frame normally; no fabricated import/handler.
  disarm(); e.set_instruction_watchpoint(area); e.run(1);
  assert.equal(e.get_eip() >>> 0, 0x4010d9); assert.equal(e.get_esp() >>> 0, originalESP);
  assert.equal(e.get_api_calls() >>> 0, callBefore.apiCalls + 1);
  report.ordinaryOriginalService = snap(); disarm();
  assert.deepEqual(readBytes(0x4010d3, 6), originalBytes);
  assert.equal(e.guest_read32(0x4063e0) >>> 0, target);
  // Diagnostic follow-through after the explicitly unarmed service restart.
  // This does not establish protected continuity across the refused service.
  arm(); report.postServiceOriginal = [];
  for (let i = 0; i < 128; i++) {
    const before = snap(), bytes = readBytes(before.pc, 12);
    try { e.run(1); report.postServiceOriginal.push({ before,after:snap(),bytes }); }
    catch (error) {
      assert(error instanceof WebAssembly.RuntimeError); assert.deepEqual(snap(),before);
      report.postServiceOriginal.push({ before,after:snap(),bytes,error:error.message }); break;
    }
  }
  assert(report.postServiceOriginal.at(-1).error,'retain next original protected frontier'); disarm();

  // Mapping controls use isolated FF15 operands and an existing original-code
  // target. No guest handler is manufactured. Ordinary prime then arm directly
  // to ensure a previously published ordinary block cannot skip protection.
  const instruction = addr => [0xff,0x15,addr & 255,addr >>> 8 & 255,addr >>> 16 & 255,addr >>> 24];
  const put = bytes => bytes.forEach((b, i) => e.guest_write8(pc + i, b));
  const operand = area + 1024, regularTarget = 0x4010d2;
  const seed = () => { names.forEach((n, i) => e['set_' + n](0x11220000 + i));
    e.set_esp(stack); e.set_eip(pc); e.test_shift(32,4,0x12345678,1,1,0x2468); };
  const prime = (addr, cached) => {
    disarm(); put(instruction(addr)); seed();
    if (cached) {
      // Establish a successful ordinary cache before changing only ESP or
      // mapping state; arming itself must retire it.
      e.set_instruction_watchpoint(area); e.run(1); e.set_eip(pc); e.set_esp(stack);
    }
  };
  let rejects = 0;
  const rejected = name => {
    const before = snap();
    assert.throws(() => e.run(1), WebAssembly.RuntimeError); assert.deepEqual(snap(), before, name);
    const full = sha(Buffer.from(memory.buffer));
    assert.throws(() => e.run(1), WebAssembly.RuntimeError); assert.deepEqual(snap(), before, name + ' retry');
    assert.equal(sha(Buffer.from(memory.buffer)), full, name + ' full memory retry');
    rejects++; return before;
  };
  e.guest_write32(operand, regularTarget);
  for (const cached of [false,true]) for (const crossing of [false,true]) {
    const base = 0x40000000 + (cached ? 0x20000 : 0) + (crossing ? 0x10000 : 0);
    prime(operand, cached);
    if (crossing) { assert.equal(e.test_virtual_map_commit(base,4096) >>> 0, base); e.guest_write32(base + 4092,0x6d6d6d6d); }
    const esp = base + (crossing ? 4098 : 4); e.set_esp(esp); arm();
    rejected(`stack ${crossing ? 'straddling' : 'absent'} cached=${cached}`);
    disarm(); if (crossing) assert.equal(e.guest_read32(base + 4092) >>> 0, 0x6d6d6d6d);
    assert.equal(e.test_virtual_map_commit(base + (crossing ? 4096 : 0),4096) >>> 0, base + (crossing ? 4096 : 0));
    arm(); e.run(100); assert.equal(e.get_eip() >>> 0, regularTarget); assert.equal(e.get_esp() >>> 0, esp - 4);
    disarm(); assert.equal(e.guest_read32(esp - 4) >>> 0, pc + 6);
  }
  for (const cached of [false,true]) for (const crossing of [false,true]) {
    const base = 0x41000000 + (cached ? 0x20000 : 0) + (crossing ? 0x10000 : 0);
    const addr = base + (crossing ? 4094 : 0);
    disarm();
    // Ordinary sentinel-mode loads may read an absent page. Stop at the CALL
    // boundary without executing its target; protected retry must refuse that
    // same mapping even with this ordinary block already in cache.
    e.set_fault_unmapped(0);
    if (crossing) {
      assert.equal(e.test_virtual_map_commit(base,4096) >>> 0, base);
      e.guest_write8(addr,regularTarget & 255); e.guest_write8(addr + 1,regularTarget >>> 8 & 255);
    }
    prime(addr,cached);
    arm(); rejected(`target ${crossing ? 'straddling' : 'absent'} cached=${cached}`);
    disarm(); assert.equal(e.test_virtual_map_commit(base + (crossing ? 4096 : 0),crossing ? 4096 : 8192) >>> 0, base + (crossing ? 4096 : 0));
    e.guest_write32(addr,regularTarget); arm(); e.run(100);
    assert.equal(e.get_eip() >>> 0, regularTarget); assert.equal(e.get_esp() >>> 0, stack - 4);
    disarm(); assert.equal(e.guest_read32(stack - 4) >>> 0, pc + 6);
  }
  // Reject DIB readback addresses even though they are mapped. Also exercise
  // wraparound spans: every byte must be safe before a load/store begins.
  for (const [addr,esp] of [[0x50000000,stack],[operand,0x50000004],[0xfffffffe,stack],[operand,2]]) {
    prime(addr,false); e.set_esp(esp); arm(); rejected('unaudited DIB or wrapped span');
  }
  disarm(); report.cases.push({ name: 'mapping rejection/restart and full-memory retry', rejects });
  for (const invalidTarget of [0,0xfffe0001,0xffffffff,0x50000000,0x48000000]) {
    e.guest_write32(operand,invalidTarget); prime(operand,false); arm();
    rejected('unaudited service/unmapped target ' + invalidTarget.toString(16)); disarm();
  }
  e.guest_write32(operand,regularTarget);

  // Interleaved commits make neighboring guest pages noncontiguous in WASM.
  // Both the target load and return store must gather/scatter all four bytes.
  for (const base of [0x42000000,0x43000000]) {
    assert.equal(e.test_virtual_map_commit(base,4096) >>> 0,base);
    assert.equal(e.test_virtual_map_commit(base + 0x10000,4096) >>> 0,base + 0x10000);
    assert.equal(e.test_virtual_map_commit(base + 4096,4096) >>> 0,base + 4096);
  }
  const splitOperand = 0x42000ffe, splitStack = 0x43001002;
  e.guest_write32(splitOperand,regularTarget); prime(splitOperand,false); e.set_esp(splitStack);
  arm(); const splitBefore = snap(); e.run(100);
  const splitExpected = structuredClone(splitBefore); splitExpected.pc = regularTarget; splitExpected.regs[4] -= 4;
  assert.deepEqual(snap(),splitExpected); disarm();
  assert.equal(e.guest_read32(splitStack - 4) >>> 0,pc + 6);
  assert.equal(e.guest_read32(splitOperand) >>> 0,regularTarget);
  // Aliasing operand and return slot must read the old target before storing.
  e.guest_write32(stack - 4,regularTarget); prime(stack - 4,false); arm(); e.run(100);
  assert.equal(e.get_eip() >>> 0,regularTarget); disarm();
  assert.equal(e.guest_read32(stack - 4) >>> 0,pc + 6);
  report.cases.push('split noncontiguous source/stack and operand/return-slot alias');

  // An ordinary-cached real import must acquire the same architectural stop.
  e.guest_write32(operand,target); prime(operand,true); arm();
  const cachedService = snap(); e.run(100);
  assert.equal(e.get_eip() >>> 0,target); assert.equal(e.get_esp() >>> 0,stack - 4);
  assert.equal(e.get_api_calls() >>> 0,cachedService.apiCalls);
  rejected('cached real import service entry'); disarm();
  e.guest_write32(operand,regularTarget);

  // Previously unaudited FF forms remain rejected, including every prefix.
  const excluded = [[0xff,0xd0],[0xff,0x10],[0xff,0x54,0x24,0],[0xff,0x55,0],
    [0xff,0x95,0,0,0,0],[0xff,0xc0],[0xff,0xc8],[0xff,0xe0],[0xff,0xf0]];
  for (const prefix of [0x66,0x67,0xf0,0xf2,0xf3,0x26,0x2e,0x36,0x3e,0x64,0x65]) excluded.push([prefix,...instruction(operand)]);
  for (const bytes of excluded) for (const cached of [false,true]) {
    disarm(); put(bytes); seed();
    if (cached) {
      e.set_instruction_watchpoint(area);
      if (bytes[0] === 0x67 || bytes[0] === 0x65) assert.throws(() => e.run(1),WebAssembly.RuntimeError);
      else {
        try { e.run(1); }
        catch (error) { error.message += ' ordinary prime ' + Buffer.from(bytes).toString('hex'); throw error; }
      }
      e.set_eip(pc); e.set_esp(stack);
    }
    arm(); rejected('excluded FF encoding ' + Buffer.from(bytes).toString('hex') + ' cached=' + cached);
  }
  disarm(); report.cases.push({ name: 'unaudited FF forms excluded cold/ordinary-cached', count: excluded.length * 2 });
  // Fresh ordinary CALL preserves its historical inline import dispatch.
  e.set_eip(0x4010d3); e.set_esp(stack); e.set_instruction_watchpoint(area);
  const ordinaryBefore = snap(); e.run(1); assert.equal(e.get_eip() >>> 0, 0x4010d9);
  assert.equal(e.get_esp() >>> 0, stack); assert.equal(e.get_api_calls() >>> 0, ordinaryBefore.apiCalls + 1);
  assert.deepEqual(snap().flags, ordinaryBefore.flags); disarm();
  report.controllerQualified = false; report.allWritersQualified = false;
  if (process.env.JEDI_EVIDENCE) fs.writeFileSync(path.join(process.env.JEDI_EVIDENCE,'memory-call-result.json'),JSON.stringify(report,null,2) + '\n');
  console.log(`PASS canonical original memory CALL, protected service boundary, ${rejects} mapping/encoding rejection and retry controls`);
}
main().catch(e => { console.error(e.stack); process.exitCode = 1; });
