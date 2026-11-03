'use strict';

// Canonical artifact and original notepad PUSH EBP. No WAT transform, synthetic
// instruction, guest handler or callback. Optional --wasm supplies the retained
// old module for the failing control, using the identical regression.
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const crypto = require('crypto');
const { createHostImports } = require('../lib/host-imports');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
async function main() {
  const wasm = fs.readFileSync(process.argv.find(a => a.startsWith('--wasm='))?.slice(7) || path.join(__dirname, '../build/wine-assembly.wasm'));
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { exports: null, getMemory: () => memory.buffer };
  const imports = createHostImports(ctx);
  imports.host.memory = memory; imports.host.log = () => {}; imports.host.log_i32 = () => {};
  const e = (await WebAssembly.instantiate(wasm, { host: imports.host })).instance.exports;
  ctx.exports = e;
  const pe = fs.readFileSync(path.join(__dirname, 'binaries/notepad.exe'));
  new Uint8Array(memory.buffer).set(pe, e.get_staging()); assert(e.load_pe(pe.length));
  const pc = e.get_eip() >>> 0, area = e.guest_alloc(4096) >>> 0;
  assert.equal(pc, 0x4010cc); assert.equal(e.guest_read8(pc), 0x55);
  e.guest_write32(area, 0x42c80000); e.guest_write32(area + 4, 0x42c80000);
  e.set_ebp(0x42a00000); e.set_esp(0x40000004); e.set_fault_unmapped(2);
  const physical = p => p - e.get_image_base() + e.get_guest_base();
  const snap = () => ({
    regs: Object.fromEntries(['eax','ebx','ecx','edx','ebp','esi','edi','esp','eip'].map(n => [n, e['get_' + n]() >>> 0])),
    flags: ['op','a','b','res','sign_shift'].map(n => e['get_flag_' + n]()),
    // Observe through host memory: protected readers deliberately reject sparse addresses.
    stack: Buffer.from(new Uint8Array(memory.buffer, physical(area + 1024), 128)).toString('hex'),
    vitals: Buffer.from(new Uint8Array(memory.buffer, physical(area), 8)).toString('hex'),
  });
  e.set_rep_store_step(area);
  const before = snap();
  assert.throws(() => e.run(1), WebAssembly.RuntimeError);
  const after = snap();
  const report = { moduleSHA256: sha(wasm), pc, originalOpcode: 0x55, before, after, cases: [] };
  if (process.env.JEDI_EVIDENCE) {
    fs.mkdirSync(process.env.JEDI_EVIDENCE, { recursive: true });
    fs.writeFileSync(path.join(process.env.JEDI_EVIDENCE, 'scalar-push-initial.json'), JSON.stringify(report, null, 2) + '\n');
  }
  assert.deepEqual(after, before, 'cold fault: CPU, flags, stack and vitals must precede all PUSH effects');
  // The first run populated the ordinary decoder cache. Retry the SAME fault
  // without any host restoration and require all 512 MiB to remain identical.
  const memoryBefore = sha(Buffer.from(memory.buffer));
  assert.throws(() => e.run(1), WebAssembly.RuntimeError);
  assert.deepEqual(snap(), before);
  assert.equal(sha(Buffer.from(memory.buffer)), memoryBefore, 'cached fault: full linear memory unchanged');
  report.cases.push({ name: 'absent stack, cold and cached retry', memorySHA256: memoryBefore, passed: true });

  // Repair the mapping while disarmed, then restart at the unchanged real PC.
  e.set_rep_store_step(0);
  assert.equal(e.test_virtual_map_commit(0x40000000, 4096) >>> 0, 0x40000000);
  e.set_rep_store_step(area);
  e.run(1);
  assert.equal(e.get_esp() >>> 0, 0x40000000);
  assert.equal(e.get_eip() >>> 0, pc + 1);
  e.set_rep_store_step(0);
  assert.equal(e.guest_read32(0x40000000) >>> 0, 0x42a00000);
  report.cases.push({ name: 'mapping repair and architectural restart', passed: true });

  // The low two destination bytes exist, the high two do not. Checking only
  // the initial translation would allow a partial write and/or early ESP.
  e.set_eip(pc); e.set_esp(0x40001002);
  e.guest_write32(0x40000ffc, 0x6d6d6d6d);
  e.set_rep_store_step(area);
  const crossingBefore = snap();
  assert.throws(() => e.run(1), WebAssembly.RuntimeError);
  assert.deepEqual(snap(), crossingBefore);
  const crossingMemory = sha(Buffer.from(memory.buffer));
  assert.throws(() => e.run(1), WebAssembly.RuntimeError);
  assert.deepEqual(snap(), crossingBefore);
  assert.equal(sha(Buffer.from(memory.buffer)), crossingMemory);
  e.set_rep_store_step(0);
  assert.equal(e.guest_read32(0x40000ffc) >>> 0, 0x6d6d6d6d, 'no partially written low bytes');
  assert.equal(e.test_virtual_map_commit(0x40001000, 4096) >>> 0, 0x40001000);
  e.set_rep_store_step(area); e.run(1);
  assert.equal(e.get_eip() >>> 0, pc + 1); assert.equal(e.get_esp() >>> 0, 0x40000ffe);
  e.set_rep_store_step(0);
  assert.equal(e.guest_read32(0x40000ffe) >>> 0, 0x42a00000);
  report.cases.push({ name: 'unaligned page-crossing fault, full-memory retry and restart', passed: true, memorySHA256: crossingMemory });

  // Ordinary instruction-watch stepping does not enable protected execution.
  // It allows exactly the original PUSH to run without executing later PE code.
  e.set_eip(pc); e.set_esp(area + 2048); e.set_instruction_watchpoint(area);
  const ordinaryFlags = snap().flags;
  e.run(1);
  assert.equal(e.get_esp() >>> 0, area + 2044);
  assert.equal(e.get_eip() >>> 0, pc + 1);
  assert.equal(e.guest_read32(area + 2044) >>> 0, 0x42a00000);
  assert.deepEqual(snap().flags, ordinaryFlags);
  report.cases.push({ name: 'ordinary unarmed successful PUSH', passed: true });
  if (process.env.JEDI_EVIDENCE) fs.writeFileSync(path.join(process.env.JEDI_EVIDENCE, 'scalar-push-result.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('PASS original scalar PUSH: fault preservation, full-memory retry, mapping restart and unarmed success');
}
main().catch(e => { console.error(e.stack); process.exitCode = 1; });
