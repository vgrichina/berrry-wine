'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeVm } = require('../tools/toyvm/vm');
const { runDos } = require('../tools/toyvm/run-dos');
const { setCpuLevel } = require('../tools/toyvm/decode');
const isa = require('../tools/toyvm/isa');
setCpuLevel(386);
const evidence = process.argv.find(x => x.startsWith('--evidence='))?.slice(11);
if (evidence) fs.mkdirSync(evidence, { recursive: true });
const u32 = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24 & 255];
const mov = (r, n) => [0xb8 + r, ...u32(n)];
const store = (p, n) => [0xc7, 0x05, ...u32(p), ...u32(n)];
const observations = [];
// This fixture owns ToyVM guest physical page 18 for CR3, independently of
// Wine-Assembly's linear-memory region map (whose GUEST_BASE happens to match).
const guestPageDirectory = 18 * 4096;

async function dosCom(variant, tier = {}) {
  const com = Buffer.alloc(0x9000);
  const put = (physical, n) => com.writeUInt32LE(n >>> 0, physical - 0x10100);
  const boot = [0xfa, 0x0f, 0x01, 0x16, 0xe0, 1, 0x0f, 0x01, 0x1e, 0xe6, 1,
    0x66, ...mov(0, guestPageDirectory), 0x0f, 0x22, 0xd8,
    0x66, ...mov(0, 0x80000011), 0x0f, 0x22, 0xc0,
    0xea, 0, 2, 8, 0];
  com.set(boot, 0);
  com.writeUInt16LE(0x3f, 0xe0); com.writeUInt32LE(0x18000, 0xe2);
  com.writeUInt16LE(0x7ff, 0xe6); com.writeUInt32LE(0x17000, 0xe8);
  com.writeUInt16LE(0x3ff, 0xec); com.writeUInt32LE(0, 0xee);
  put(0x17070, 0x00080400); put(0x17074, 0x00008e00);
  put(0x17180, 0x00080700); put(0x17184, 0x0000ee00);
  // 32-bit CS at base10000; flat writable DS/ES/SS.
  put(0x18008, 0x0000ffff); put(0x1800c, 0x00cf9a01);
  put(0x18010, 0x0000ffff); put(0x18014, 0x00cf9200);
  put(0x18018, 0x0000ffff); put(0x1801c, 0x00cffa01);
  put(0x18020, 0x0000ffff); put(0x18024, 0x00cff200);
  put(0x18028, 0x90000067); put(0x1802c, 0x00008901);
  // Real-mode return descriptors: 16-bit, byte granular, 64K, base10000.
  put(0x18030, 0x0000ffff); put(0x18034, 0x00009a01);
  put(0x18038, 0x0000ffff); put(0x1803c, 0x00009201);
  put(0x19004, 0x90000); put(0x19008, 0x10);
  put(guestPageDirectory, 0x13007); put(guestPageDirectory + 0x100, 0x14007);
  for (let i = 0; i < 1024; i++) put(0x13000 + i * 4, (i * 4096) | 7);
  for (const [i, p] of [0x30000, 0x50000, 0x60000, 0x70000].entries()) put(0x14000 + i * 4, p | 7);
  const main = [0x66, 0xb8, 0x10, 0, 0x8e, 0xd8, 0x8e, 0xc0, 0x8e, 0xd0,
    ...mov(4, 0x90000), ...mov(7, 0x40000), ...mov(1, 4096), ...mov(0, 0x76543210), 0xf3, 0xab,
    ...mov(6, 0x40000), ...mov(7, 0x10000000), ...mov(1, 4096), 0xf3, 0xa5,
    // Actual COM scalar #PF and REP #PF, with a guest repair/IRETD handler.
    ...store(0x14004, 0), ...store(0x10000ffe, 0x12345678),
    0xa1, ...u32(0x10000ffe), 0xa3, ...u32(0x71000),
    ...store(0x14004, 0), ...mov(6, 0x10000ffe), ...mov(7, 0x71004), ...mov(1, 4), 0xf3, 0xa4,
    // CR3 remap and a store through a physical code alias.
    ...store(0x16000, 0x13007), ...store(0x16100, 0x15007), ...store(0x15000, 0x60007),
    ...mov(0, 0x16000), 0x0f, 0x22, 0xd8,
    0xa1, ...u32(0x10000000), 0xa3, ...u32(0x71008),
    ...store(0x15008, 0x10007), ...store(0x10002501, 0x01020304),
    0xe8, ...u32(0),
    ...store(0x15004, 0x50007), ...store(0x60ffc, 0x44b89090), ...store(0x50000, 0xc3112233),
    0xe8, ...u32(0), 0xa3, ...u32(0x71028),
    // User write-protection #PF uses a guest-loaded TSS and ring-0 stack.
    0x66, 0xb8, 0x28, 0, 0x0f, 0, 0xd8, ...store(0x15000, 0x60005),
    0x68, ...u32(0x23), 0x68, ...u32(0x80000), 0x6a, 2,
    0x6a, 0x1b, 0x68, ...u32(0x900), 0xcf];
  const finish = [
    ...store(0x17070, 0x00080600), 0xcd, 14,
    0x89, 0x25, ...u32(0x7102c),
    ...store(0x17020, 0x00080650), ...store(0x17024, 0x00008e00),
    ...mov(0, 0x7fffffff), 0x83, 0xc0, 1, 0xce,
    0x89, 0x25, ...u32(0x71030),
    ...mov(0, 0x11), 0x0f, 0x22, 0xc0,
    ...mov(0, 0), 0x0f, 0x22, 0xd8,
    0xea, ...u32(0xa00), 0x30, 0];
  const call = main.indexOf(0xe8);
  main.splice(call + 1, 4, ...u32(0x500 - (0x200 + call + 5)));
  const crossCall = main.indexOf(0xe8, call + 5);
  main.splice(crossCall + 1, 4, ...u32(0x0fff0ffe - (0x200 + crossCall + 5)));
  com.set(main, 0x100); com.set(finish, 0x600);
  // Clearing PE and a real-mode far jump do not clear cached CS.D. First
  // enter the 16-bit protected segment, restore real-compatible data/stack
  // caches, then clear PE and jump to the ordinary 16-bit DOS exit. Otherwise
  // B8 00 4C CD 21 is MOV EAX,21CD4C00 and execution wanders through RAM,
  // eventually changing copy data and even finding an accidental DOS exit.
  com.set([0xb8, 0x38, 0, 0x8e, 0xd8, 0x8e, 0xc0, 0x8e, 0xd0,
    0x8e, 0xe0, 0x8e, 0xe8, 0x66, ...mov(4, 0xfffe),
    0x66, ...mov(0, 0x10), 0x0f, 0x22, 0xc0, 0xea, 0, 8, 0, 0x10], 0x900);
  com.set([0xb8, 0, 0x10, 0x8e, 0xd8, 0x8e, 0xc0, 0x8e, 0xd0,
    0x8e, 0xe0, 0x8e, 0xe8, 0x0f, 0x01, 0x1e, 0xec, 1,
    0xb8, 0, 0x4c, 0xcd, 0x21], 0x700);
  com.set([0x60, 0x0f, 0x20, 0xd0, 0xa3, ...u32(0x71010),
    0x8b, 0x44, 0x24, 0x20, 0xa3, ...u32(0x71014),
    0x89, 0x0d, ...u32(0x71018), 0x89, 0x35, ...u32(0x7101c),
    0x8b, 0x44, 0x24, 0x30, 0xa3, ...u32(0x71020),
    0x8b, 0x44, 0x24, 0x34, 0xa3, ...u32(0x71024),
    ...store(0x14004, 0x50007), ...store(0x15000, 0x60007),
    0x61, 0x83, 0xc4, 4, 0xcf], 0x300);
  com.set([...mov(0, 0), 0xa3, ...u32(0x7100c), 0xc3], 0x400);
  com[0x500] = 0xcf; com[0x550] = 0xcf;
  com.set([...store(0x10000000, 0x98765432), 0xcd, 0x30], 0x800);
  const dir = evidence || fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'toyvm-paged-com-'));
  const file = path.join(dir, `mapped-copy-${variant}-${Object.keys(tier).join('') || 'interpreter'}.COM`);
  fs.writeFileSync(file, com);
  const r = await runDos({ exe: file, variant, pspSeg: 0x1000, loadSeg: 0x1000,
    budget: 200000, seconds: 3, autoKey: false, sound: false, log() {}, ...tier });
  if (!r.machine.exited) console.error({ regs: r.vm.getAll(), cr0: r.vm.exports.get_cr0() >>> 0,
    cr3: r.vm.exports.get_cr3() >>> 0, dispatched: r.dispatched, unimplemented: r.unimplemented,
    stuckAt: r.stuckAt, badSelector: r.badSelector, protectedTransferStop: r.protectedTransferStop });
  assert.equal(r.machine.exited, true, 'actual COM returns through normal DOS exit');
  assert.equal(r.machine.exitCode, 0);
  assert.equal(r.ranOutOfTime, false);
  assert.equal(r.vm.exports.get_d32(), 0, 'DOS exit executes with 16-bit CS defaults');
  assert.equal(r.vm.exports.get_cr0() >>> 0, 0x10);
  assert.equal(r.vm.exports.get_cr3() >>> 0, 0);
  assert.equal(r.vm.get('cs'), 0x1000, 'exit stays on the intended real-mode path');
  assert.equal(r.vm.get('gip'), 0x817, 'exit immediately follows the intended INT21');
  const v = new DataView(r.vm.mem.buffer);
  // REP copied linear10000000..10003fff through PTEs to these four pages.
  // Keep every untouched dword checked; assert each deliberate overwrite below.
  for (const p of [0x30000, 0x50000, 0x60000, 0x70000]) {
    for (let i = 0; i < 4096; i += 4) {
      if ((p === 0x30000 && i === 4092) || (p === 0x50000 && i === 0) ||
          (p === 0x60000 && (i === 0 || i === 4092))) continue;
      assert.equal(v.getUint32(p + i, true), 0x76543210, `copy ${variant}/${JSON.stringify(tier)} at ${(p+i).toString(16)}`);
    }
  }
  for (let i = 0; i < 16384; i += 4) {
    assert.equal(v.getUint32(0x40000 + i, true), 0x76543210, 'REP source remains intact');
  }
  assert.equal(v.getUint32(0x30ffc, true), 0x56783210, 'scalar store spans mapped pages');
  assert.equal(v.getUint32(0x50000, true), 0xc3112233, 'cross-page MOV immediate tail and RET');
  assert.equal(v.getUint32(0x60ffc, true), 0x44b89090, 'cross-page NOP/NOP/MOV prefix');
  assert.equal(v.getUint32(0x10501, true), 0x01020304, 'physical alias patches called MOV immediate');
  assert.equal(v.getUint32(0x71000, true), 0x12345678);
  assert.equal(v.getUint32(0x71004, true), 0x12345678);
  assert.equal(v.getUint32(0x71008, true), 0x76543210);
  assert.equal(v.getUint32(0x7100c, true), 0x01020304);
  assert.equal(v.getUint32(0x71010, true), 0x10000000);
  assert.equal(v.getUint32(0x71014, true), 7);
  assert.equal(v.getUint32(0x71020, true), 0x80000);
  assert.equal(v.getUint32(0x71024, true), 0x23);
  assert.equal(v.getUint32(0x60000, true), 0x98765432);
  assert.equal(v.getUint32(0x71028, true), 0x11223344, 'actual COM cross-page instruction fetch');
  assert.equal(v.getUint32(0x7102c, true), 0x8ffec, 'actual software INT14 frame has no error word');
  assert.equal(v.getUint32(0x71030, true), 0x8ffec, 'actual INTO/IRETD preserves stack');
  assert.equal(v.getUint16(0, true), 0x100, 'original IVT vector0 offset');
  assert.equal(v.getUint16(2, true), 0xf000, 'original IVT vector0 segment');
  observations.push({ variant, tier: Object.keys(tier), actualDosCom: true, exitCode: r.machine.exitCode,
    dispatched: r.dispatched, cr0: r.vm.exports.get_cr0() >>> 0 });
}

async function fixture(variant) {
  // Each fixture owns a large imported WebAssembly.Memory. Reclaim completed
  // fixtures when the caller explicitly enables collection for this suite.
  global.gc?.();
  const vm = await makeVm(variant);
  const e = vm.exports, v = new DataView(vm.mem.buffer);
  // The decoder level alone does not configure the VM's FLAGS mask. An
  // 8086's reserved high bits include the bit which becomes 386 EFLAGS.NT.
  // These synthetic protected-mode fixtures require an actual 386 CPU mask.
  e.set_cpu(386);
  const put = (p, n) => v.setUint32(p, n >>> 0, true);
  const descriptor = (p, access) => { put(p, 0xffff); put(p + 4, 0x00cf0000 | access << 8); };
  descriptor(0x19008, 0x9a); descriptor(0x19010, 0x92);
  descriptor(0x19018, 0xfa); descriptor(0x19020, 0xf2);
  e.mset_gdtb(0x19000); e.mset_gdtl(0x2f); e.mset_idtb(0x1a000); e.mset_idtl(0x7ff);
  e.mset_cr0(1); e.mset_linmask(isa.LIN_MASK_FLAT);
  vm.setAll({ cs: 8, ds: 16, es: 16, ss: 16, sp: 0x80000, ip: 0x10000, flags: 2 });
  put(0x20000, 0x21007);
  for (let i = 0; i < 1024; i++) put(0x21000 + i * 4, (i * 4096) | 7);
  put(0x20100, 0x22007); put(0x22000, 0x30007); put(0x22004, 0x50007);
  put(0x1a070, 0x00080000 | 0x6000); put(0x1a074, 0x00008e00);
  // Actual guest control-register instructions, then the caller's program.
  const boot = [...mov(0, 0x20000), 0x0f, 0x22, 0xd8, ...mov(0, 0x80000011), 0x0f, 0x22, 0xc0];
  vm.mem.set(boot, 0x10000);
  const start = 0x10000 + boot.length;
  for (let i = 0; i < 4; i++) assert(vm.stepOne());
  assert.equal(e.get_cr0() >>> 0, 0x80000011);
  return { vm, e, v, put, start };
}
async function nonPagedCom(variant) {
  const code = Buffer.from([0x66, ...mov(0, 0x11111111), 0x67, 0x66, 0xa3, ...u32(0x100900),
    0xb8, 0x10, 0x43, 0xcd, 0x2f, 0x89, 0x1e, 0, 2, 0x8c, 0xc0, 0xa3, 2, 2,
    0xb4, 9, 0xba, 1, 0, 0xff, 0x1e, 0, 2,
    0x66, ...mov(0, 0x22222222), 0x67, 0x66, 0xa3, ...u32(0x100900), 0xb8, 0, 0x4c, 0xcd, 0x21]);
  const dir = evidence || fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'toyvm-a20-com-'));
  const file = path.join(dir, `nonpaged-a20-${variant}.COM`); fs.writeFileSync(file, code);
  const r = await runDos({ exe: file, variant, pspSeg: 0x1000, loadSeg: 0x1000,
    budget: 20000, seconds: 2, autoKey: false, sound: false, log() {} });
  assert.equal(r.machine.exited, true); assert.equal(r.machine.exitCode, 0);
  const v = new DataView(r.vm.mem.buffer);
  assert.equal(v.getUint32(0x10900, true), 0x11111111, 'original nonpaged A20-off wrap');
  assert.equal(v.getUint32(0x110900, true), 0x22222222, 'guest XMS allocation opens the nonpaged bus');
  observations.push({ variant, actualNonPagedA20Com: true, exitCode: 0 });
}

async function run(variant) {
  const { vm, e, v, put, start } = await fixture(variant);
  const code = [...store(0x10000ffe, 0x12345678), 0xa1, ...u32(0x10000ffe), 0xa3, ...u32(0x70000)];
  vm.mem.set(code, start);
  const ivt = vm.mem.slice(0, 1024);
  for (let i = 0; i < 3; i++) assert(vm.stepOne());
  assert.deepEqual([...vm.mem.slice(0x30ffe, 0x31000)], [0x78, 0x56]);
  assert.deepEqual([...vm.mem.slice(0x50000, 0x50002)], [0x34, 0x12]);
  assert.equal(v.getUint32(0x70000, true), 0x12345678);
  assert.deepEqual(vm.mem.slice(0, 1024), ivt, 'high paged write preserves IVT');
  assert.equal(v.getUint32(0x22000, true) & 0x60, 0x60);
  assert.equal(v.getUint32(0x22004, true) & 0x60, 0x60);

  // Fault handler makes the absent second page present, discards the error
  // code and returns. The faulting store must execute again in its entirety.
  const handler = [...store(0x22004, 0x50007), 0x83, 0xc4, 4, 0xcf];
  vm.mem.set(handler, 0x6000);
  put(0x22004, 0);
  vm.set('gip', start); vm.set('sp', 0x80000);
  const before = vm.mem.slice(0x30ffe, 0x31000);
  vm.mem.set(store(0x10000ffe, 0xaabbccdd), start);
  assert(vm.stepOne());
  assert.equal(e.get_cr2() >>> 0, 0x10001000);
  assert.equal(vm.get('gip'), 0x6000);
  assert.equal(vm.get('sp'), 0x7fff0);
  assert.equal(v.getUint32(0x7fff0, true), 2, '#PF error write/supervisor/not-present');
  assert.equal(v.getUint32(0x7fff4, true), start, '#PF restart EIP');
  assert.equal(v.getUint32(0x7fff8, true), 8, '#PF CS');
  assert.equal(v.getUint32(0x7fffc, true) & 0x10000, 0x10000, '#PF frame sets RF');
  assert.deepEqual(vm.mem.slice(0x30ffe, 0x31000), before, 'faulting scalar has no partial write');
  for (let i = 0; i < 4; i++) assert(vm.stepOne());
  assert.equal(vm.get('sp'), 0x80000);
  assert.equal(v.getUint16(0x30ffe, true), 0xccdd);
  assert.equal(v.getUint16(0x50000, true), 0xaabb);
  // Instruction bytes cross between the two noncontiguous physical pages.
  put(0x22004, 0x50007);
  vm.mem.set([0xb8, 0x44], 0x30ffe); vm.mem.set([0x33, 0x22, 0x11], 0x50000);
  vm.set('gip', 0x10000ffe); assert(vm.stepOne());
  assert.equal(vm.raw('ax') >>> 0, 0x11223344);
  assert.equal(vm.get('gip'), 0x10001003);
  // A reached one-byte instruction at the last mapped byte must not fetch
  // the not-present following page speculatively.
  put(0x22004, 0); vm.mem[0x30fff] = 0x90;
  vm.set('gip', 0x10000fff); assert(vm.stepOne());
  assert.equal(vm.get('gip'), 0x10001000);
  // REP commits completed iterations, then restarts with remaining count.
  vm.mem.set([0xf3, 0xa4], start);
  vm.mem.set([0x71, 0x72], 0x30ffe); vm.mem.set([0x73, 0x74], 0x50000);
  vm.setAll({ ip: start, si: 0, di: 0, cx: 0, sp: 0x80000 });
  e.set_si(0x10000ffe); e.set_di(0x70000); e.set_cx(4);
  assert(vm.stepOne());
  assert.equal(e.get_si() >>> 0, 0x10001000);
  assert.equal(e.get_di() >>> 0, 0x70002);
  assert.equal(e.get_cx() >>> 0, 2);
  assert.deepEqual([...vm.mem.slice(0x70000, 0x70002)], [0x71, 0x72]);
  assert.equal(v.getUint32(vm.get('sp'), true), 0, 'REP read #PF error');
  for (let i = 0; i < 4; i++) assert(vm.stepOne());
  assert.equal(e.get_cx() >>> 0, 0);
  assert.deepEqual([...vm.mem.slice(0x70000, 0x70004)], [0x71, 0x72, 0x73, 0x74]);
  // User protection fault switches to the cached TSS ring-0 stack. The
  // frame retains old SS/ESP and IRETD restores the interrupted user context.
  e.mset_pm_tr_valid(1); e.mset_pm_tr_base(0x1b000); e.mset_pm_tr_limit(103); e.mset_pm_tr_access(0x89);
  put(0x1b004, 0x90000); put(0x1b008, 16);
  put(0x22000, 0x30005);
  vm.mem.set([...store(0x22000, 0x30007), 0x83, 0xc4, 4, 0xcf], 0x6000);
  vm.mem.set(store(0x10000000, 0x98765432), start);
  vm.set('cs', 0x1b); vm.set('ss', 0x23); vm.set('ds', 0x23); vm.set('es', 0x23);
  vm.set('sp', 0x80000); vm.set('gip', start);
  assert(vm.stepOne());
  assert.equal(vm.get('cs'), 8);
  assert.equal(vm.get('ss'), 16);
  assert.equal(vm.get('sp'), 0x8ffe8);
  assert.equal(v.getUint32(0x8ffe8, true), 7);
  assert.equal(v.getUint32(0x8fff8, true), 0x80000);
  assert.equal(v.getUint32(0x8fffc, true), 0x23);
  for (let i = 0; i < 4; i++) assert(vm.stepOne());
  assert.equal(vm.get('cs'), 0x1b); assert.equal(vm.get('ss'), 0x23);
  assert.equal(vm.get('sp'), 0x80000);
  assert.equal(v.getUint32(0x30000, true), 0x98765432);
  vm.set('cs', 8); vm.set('ss', 16); vm.set('ds', 16); vm.set('es', 16);
  // CR3 replaces the high mapping; reloading the same value is an epoch.
  put(0x23000, 0x21007); put(0x23100, 0x24007); put(0x24000, 0x60007); put(0x60000, 0x87654321);
  vm.mem.set([...mov(0, 0x23000), 0x0f, 0x22, 0xd8, 0xa1, ...u32(0x10000000)], start);
  vm.set('gip', start);
  for (let i = 0; i < 3; i++) assert(vm.stepOne());
  assert.equal(vm.raw('ax') >>> 0, 0x87654321);
  const epoch = e.pg_epoch();
  vm.mem.set([...mov(0, 0x23000), 0x0f, 0x22, 0xd8], start); vm.set('gip', start);
  assert(vm.stepOne()); assert(vm.stepOne()); assert.equal(e.pg_epoch(), epoch + 1, 'same CR3 reload invalidates cached state');
  // A store through a high physical alias changes the next fetched immediate.
  put(0x24008, 0x10007);
  const patchTarget = start + 10;
  vm.mem.set([...store(0x10002000 + patchTarget + 1 - 0x10000, 0x01020304), ...mov(0, 0)], start);
  vm.set('gip', start); assert(vm.stepOne()); assert(vm.stepOne());
  assert.equal(vm.raw('ax') >>> 0, 0x01020304);
  // Software INT14 has no #PF error code. Invalid software gates are #GP,
  // rather than the double-fault classification for a real #PF delivery.
  vm.mem.set([0xcd, 14], start); vm.mem[0x6000] = 0xcf;
  vm.set('gip', start); vm.set('sp', 0x80000); assert(vm.stepOne());
  assert.equal(vm.get('sp'), 0x7fff4);
  assert.equal(v.getUint32(0x7fff4, true), start + 2);
  assert(vm.stepOne()); assert.equal(vm.get('gip'), start + 2);
  put(0x1a074, 0x00008000); // present, invalid type
  put(0x1a068, 0x00086100); put(0x1a06c, 0x00008e00);
  vm.set('gip', start); assert(vm.stepOne());
  assert.equal(vm.get('gip'), 0x6100);
  assert.equal(v.getUint32(vm.get('sp'), true), 14 * 8 + 2);
  assert.equal(v.getUint32(vm.get('sp') + 4, true), start);
  vm.set('cs', 8); vm.set('ss', 16); vm.set('sp', 0x80000);
  put(0x1a040, 0x00086200); put(0x1a044, 0x00008e00);
  vm.mem[0x6200] = 0xcf;
  require('../tools/toyvm/paging-exec').exception(vm, 8, 0, start, false, start, true);
  assert.equal(vm.get('sp'), 0x7fff4, 'external IRQ8 has no #DF error code');
  assert.equal(v.getUint32(vm.get('sp'), true), start);
  assert(vm.stepOne()); assert.equal(vm.get('sp'), 0x80000);
  put(0x24000, 0); vm.mem.set(store(0x10000000, 1), start); vm.set('gip', start);
  assert(vm.stepOne()); assert.equal(vm.get('gip'), 0x6200, 'real #PF plus invalid gate becomes #DF');
  assert.equal(v.getUint32(vm.get('sp'), true), 0, '#DF error code');
  assert.equal(v.getUint32(vm.get('sp') + 4, true), start);
  // Nonpaged linear masking remains the original bus contract after PG off.
  vm.mem.set([...mov(0, 0x11), 0x0f, 0x22, 0xc0], start); vm.set('gip', start);
  assert(vm.stepOne()); assert(vm.stepOne());
  vm.mem.set(store(0x100123, 0x11223344), start); e.set_linmask(isa.LIN_MASK_REAL); vm.set('gip', start);
  assert(vm.stepOne()); assert.equal(v.getUint32(0x123, true), 0x11223344);
  e.set_linmask(isa.LIN_MASK_FLAT); vm.set('gip', start); assert(vm.stepOne());
  assert.equal(v.getUint32(0x100123, true), 0x11223344);
  e.mset_cr0(0x80000011); vm.set('gip', start);
  // INTO is software-origin, and gate DPL applies at CPL3.
  put(0x1a020, 0x00086200); put(0x1a024, 0x00008e00);
  vm.mem[start] = 0xce; vm.set('cs', 0x1b); vm.set('ss', 0x23);
  vm.set('sp', 0x80000); vm.set('gip', start); e.pg_set_flags(0x802);
  assert(vm.stepOne()); assert.equal(vm.get('gip'), 0x6100);
  assert.equal(v.getUint32(vm.get('sp'), true), 4 * 8 + 2);
  assert.equal(v.getUint32(vm.get('sp') + 4, true), start);
  // Direct unsupported entry must return before a paged guest instruction.
  const savedIp = vm.get('gip'), savedAx = vm.raw('ax');
  e.run(isa.THREAD_BASE, 10);
  assert.equal(vm.get('gip'), savedIp); assert.equal(vm.raw('ax'), savedAx);
  observations.push({ variant, highCopy: true, scalarRestart: true, cr2: e.get_cr2() >>> 0 });
  if (evidence) {
    fs.writeFileSync(path.join(evidence, `${variant}-instruction-fixture.bin`), vm.mem.slice(0x10000, 0x10100));
    fs.writeFileSync(path.join(evidence, `${variant}.wasm`), vm.bytes);
  }
}
async function systemReads(variant) {
  const { vm, e, v, put, start } = await fixture(variant);
  // POP [ESP+disp] computes its destination after incrementing ESP. The
  // original installer uses two such pops to rearrange a return frame.
  vm.set('sp', 0x7ffe0); put(0x7ffe0, 0x12345678); put(0x7ffe8, 0xaaaaaaaa); put(0x7ffec, 0);
  vm.mem.set([0x8f, 0x44, 0x24, 8], start); vm.set('gip', start); assert(vm.stepOne());
  assert.equal(vm.get('sp'), 0x7ffe4); assert.equal(v.getUint32(0x7ffec, true), 0x12345678);
  assert.equal(v.getUint32(0x7ffe8, true), 0xaaaaaaaa);
  vm.set('sp', 0x7fff4); put(0x7fff4, 0x87654321); put(0x21200, 0);
  vm.set('gip', start); assert(vm.stepOne());
  assert.equal(e.get_cr2() >>> 0, 0x80000); assert.equal(v.getUint32(vm.get('sp'), true), 2);
  vm.mem.set([...store(0x21200, 0x80007), 0x83, 0xc4, 4, 0xcf], 0x6000);
  for (let i = 0; i < 4; i++) assert(vm.stepOne());
  assert.equal(vm.get('sp'), 0x7fff8); assert.equal(v.getUint32(0x80000, true), 0x87654321);
  put(0x30ff4, 0xffff); put(0x30ff8, 0x00cf9a00);
  put(0x30ffc, 0xffff); put(0x50000, 0x00cf9200);
  e.mset_gdtb(0x10000fec);
  vm.mem.set([...mov(0, 16), 0x0f, 3, 0xd0, 0x0f, 2, 0xc8, 0x8e, 0xd8], start);
  vm.set('gip', start);
  for (let i = 0; i < 4; i++) assert(vm.stepOne());
  assert.equal(e.get_dx() >>> 0, 0xffffffff, 'LSL noncontiguous descriptor');
  assert.equal(e.get_cx() >>> 0 & 0xff00, 0x9200, 'LAR noncontiguous descriptor');
  assert.equal(e.get_dsb() >>> 0, 0);
  put(0x22008, 0x60007); put(0x2200c, 0);
  v.setUint16(0x60ffe, 0x2f, true); put(0x70000, 0x19000);
  const lgdt = [0x0f, 1, 0x15, ...u32(0x10002ffe)];
  vm.mem.set(lgdt, start); vm.set('gip', start); vm.set('sp', 0x80000);
  vm.mem.set([...store(0x2200c, 0x70007), 0x83, 0xc4, 4, 0xcf], 0x6000);
  assert(vm.stepOne()); assert.equal(e.get_cr2() >>> 0, 0x10003000);
  assert.equal(e.mget_gdtb() >>> 0, 0x10000fec, 'faulting LGDT rolls back table state');
  for (let i = 0; i < 4; i++) assert(vm.stepOne());
  assert.equal(e.mget_gdtb() >>> 0, 0x19000, 'cross-page LGDT restarts');
  observations.push({ variant, crossPageSystemReads: true, lgdtRestart: true });
}
async function traceGuard() {
  const { moduleWat } = require('../tools/toyvm/trace-jit');
  const { compileWat } = require('../lib/compile-wat');
  const wat = moduleWat('(i32.store (i32.const 1234) (i32.const 99))');
  const bytes = await compileWat(() => wat, { files: ['paging-trace-guard.wat'], cacheKey: 'paging-trace-guard' });
  const memory = new WebAssembly.Memory({ initial: isa.MEM_PAGES, maximum: isa.MEM_PAGES });
  const { exports: e } = await WebAssembly.instantiate(new WebAssembly.Module(bytes),
    { host: { memory, port_in: () => 255, port_out() {}, fmath() {} } });
  e.mset_cr0(0x80000011); e.spin(1);
  assert.equal(new DataView(memory.buffer).getUint32(1234, true), 0, 'standalone optimized trace refuses paged entry');
}
async function v86Restart(variant) {
  const { vm, e, v, put } = await fixture(variant);
  e.mset_pm_tr_valid(1); e.mset_pm_tr_base(0x1b000); e.mset_pm_tr_limit(103); e.mset_pm_tr_access(0x89);
  put(0x1b004, 0x90000); put(0x1b008, 16);
  put(0x210c0, 0); v.setUint16(0x30010, 0x1234, true);
  vm.mem.set([0xa1, 0x10, 0, 0xcf], 0x40100);
  vm.mem.set([...store(0x210c0, 0x30007), 0x83, 0xc4, 4, 0xcf], 0x6000);
  e.mset_vm86(1); vm.setAll({ cs: 0x4000, ds: 0x3000, es: 0x3000, ss: 0x2000,
    fs: 0, gs: 0, ip: 0x100, sp: 0x12348000, flags: 0x3002 });
  assert(vm.stepOne()); assert.equal(e.get_cr2() >>> 0, 0x30010);
  assert.equal(vm.get('sp'), 0x8ffd8); assert.equal(v.getUint32(0x8ffd8, true), 4);
  assert.equal(v.getUint32(0x8ffe4, true) & 0x30000, 0x30000, 'V86 #PF saves VM and RF');
  assert.equal(v.getUint32(0x8ffe8, true), 0x12348000);
  for (let i = 0; i < 4; i++) assert(vm.stepOne());
  assert.equal(e.get_vm86(), 1); assert.equal(vm.get('cs'), 0x4000);
  assert.equal(vm.get('sp'), 0x12348000); assert.equal(vm.get('ax'), 0x1234);
  v.setUint16(0x28000, 0x110, true); v.setUint16(0x28002, 0x4000, true); v.setUint16(0x28004, 0x3002, true);
  assert(vm.stepOne()); assert.equal(vm.get('gip'), 0x110);
  assert.equal(vm.get('sp'), 0x12348006, '16-bit V86 IRET preserves upper ESP');
  observations.push({ variant, virtual8086PageFaultRestart: true });
}
async function physicalBus(variant) {
  const { vm, e, v, put, start } = await fixture(variant);
  // This operand overwrites the very PTE mapping its own four bytes.
  vm.mem.set(store(0x21084, 0x60007), start); vm.set('gip', start);
  assert(vm.stepOne()); assert.equal(v.getUint32(0x21084, true), 0x60007);
  assert.equal(v.getUint32(0x20086, true), 0, 'scalar self-remap never splits across physical pages');
  put(0x21084, 0x21007); put(0x22000, 0xa0007); put(0x22004, 0);
  put(isa.VGA_CTL_KEY, isa.VGA_KEY_ON); put(isa.VGA_CTL_MASK, 15);
  put(isa.VGA_CTL_GC + 5 * 4, 1); put(isa.VGA_CTL_GC + 4 * 4, 2);
  put(isa.VGA_CTL_GC + 8 * 4, 255); put(isa.VGA_CTL_LATCH, 0x88776655);
  put(isa.VGA_CTL_READS, 0); put(isa.VGA_CTL_WRITES, 0);
  for (let i = 0; i < 4; i++) vm.mem[isa.VGA_PLANES + i * isa.VGA_PLANE_SIZE + 0x123] = 0x11 * (i + 1);
  vm.mem.set([0xc6, 5, ...u32(0x10000123), 0xaa, 0xa0, ...u32(0x10000123)], start); vm.set('gip', start);
  assert(vm.stepOne());
  for (let i = 0; i < 4; i++) assert.equal(vm.mem[isa.VGA_PLANES + i * isa.VGA_PLANE_SIZE + 0x123], 0x55 + i * 0x11);
  assert.equal(v.getUint32(isa.VGA_CTL_READS, true), 0, 'paged VGA store does not invent a latch read');
  assert(vm.stepOne()); assert.equal(vm.get('ax') & 255, 0x77);
  // ENTER writes a VGA-backed user stack before its next source faults. The
  // transaction restores all four planes; the #PF frame uses the RAM TSS stack.
  e.mset_pm_tr_valid(1); e.mset_pm_tr_base(0x1b000); e.mset_pm_tr_limit(103); e.mset_pm_tr_access(0x89);
  put(0x1b004, 0x90000); put(0x1b008, 16); put(isa.VGA_CTL_WRITES, 0);
  for (let i = 0; i < 4; i++) vm.mem[isa.VGA_PLANES + i * isa.VGA_PLANE_SIZE + 0x11c] = 0x11 * (i + 1);
  vm.set('cs', 0x1b); vm.set('ss', 0x23); vm.set('ds', 0x23); vm.set('es', 0x23);
  vm.set('sp', 0x10000120); e.set_bp(0x10001004);
  vm.mem.set([0xc8, 0, 0, 2], start); vm.set('gip', start); assert(vm.stepOne());
  assert.equal(e.get_cr2() >>> 0, 0x10001000);
  for (let i = 0; i < 4; i++) assert.equal(vm.mem[isa.VGA_PLANES + i * isa.VGA_PLANE_SIZE + 0x11c], 0x11 * (i + 1));
  assert.equal(v.getUint32(isa.VGA_CTL_WRITES, true), 0, 'fault rollback restores the VGA transaction');
  observations.push({ variant, scalarSelfMapping: true, physicalVgaBus: true, vgaTransactionRestart: true });
}
async function exceptionDiagnostics() {
  const { vm, e, put, start } = await fixture('tailcall');
  const { exception, exceptionState } = require('../tools/toyvm/paging-exec');
  put(0x1a040, 0x00280000); put(0x1a044, 0x00008500); // #DF task gate
  put(0x19028, 0x90000067); put(0x1902c, 0x00008901);
  e.mset_cr2(0xdeadbeef); e.pg_set_error(0x55);
  // #PF -> invalid gate #GP -> #DF -> invalid task register. Preserve the
  // original #PF address/error and every intermediate descriptor, even though
  // the caller receives an Error rather than a normal VM report.
  put(0x1a070, 0); put(0x1a074, 0);
  const before = vm.mem.slice(0, isa.GUEST_RAM_SIZE);
  const state = exceptionState(vm, 8, 0, start, false, false);
  assert.deepEqual(vm.mem.slice(0, isa.GUEST_RAM_SIZE), before, 'inspection does not set page-table A/D or touch device latches');
  assert.equal(e.get_cr2() >>> 0, 0xdeadbeef); assert.equal(e.pg_error(), 0x55);
  assert.equal(state.gate.type, 5); assert.equal(state.gate.present, true);
  assert.equal(state.target.selector, 0x28);
  assert.deepEqual(state.target.bytes, [0x67, 0, 0, 0x90, 1, 0x89, 0, 0]);
  let failure;
  try { exception(vm, 14, 6, start); } catch (err) { failure = err; }
  assert.match(failure.message, /386 shutdown: fault delivering #DF/);
  const chain = failure.pagingException.chain;
  assert.deepEqual(chain.map(x => x.vector), [14, 8]);
  assert.equal(chain[0].error, 6); assert.equal(chain[0].failure.vector, 13);
  assert.equal(chain[0].cr2, 0xdeadbeef); assert.equal(chain[1].error, 0);
  assert.equal(chain[1].gate.type, 5); assert.equal(chain[1].returnIp, start);
  assert.equal(vm.get('gip'), start); assert.equal(vm.get('cs'), 8);
  // Diagnostics must describe bad/unreadable descriptors without causing a
  // second architectural fault, resetting error state, or fabricating bytes.
  put(0x21068, 0); // unmap IDT page
  e.pg_set_error(7); e.mset_cr2(0x12345678);
  const unreadable = exceptionState(vm, 8, 0, start, false, false);
  assert.equal(unreadable.gate.unavailable, 'PTE not present');
  assert.deepEqual(unreadable.gate.bytes, []);
  assert.equal(e.get_cr2() >>> 0, 0x12345678); assert.equal(e.pg_error(), 7);
  put(0x21068, 0xa0007);
  assert.equal(exceptionState(vm, 8, 0, start, false, false).gate.unavailable, 'not ordinary RAM');
  // A not-present gate is described as such, without claiming a switch was
  // valid. Snapshotting out-of-bounds targets likewise does not validate them.
  put(0x21068, 0x1a007); put(0x1a044, 0x00000500);
  const absent = exceptionState(vm, 8, 0, start, false, false);
  assert.equal(absent.gate.present, false);
  e.mset_gdtl(7);
  assert.equal(exceptionState(vm, 8, 0, start, false, false).target.inBounds, false);
  e.mset_gdtl(0x2f);
  // Software INT privilege failure must reach #GP instead of the task-gate
  // target validation; it saves the faulting IP and IDT selector error code.
  put(0x1a180, 0x00280000); put(0x1a184, 0x00008500);
  put(0x1a068, 0x00086000); put(0x1a06c, 0x00008e00);
  vm.set('cs', 0x1b); vm.set('ss', 0x23); vm.set('sp', 0x80000);
  e.mset_pm_tr_valid(1); e.mset_pm_tr_base(0x1b000);
  e.mset_pm_tr_limit(103); e.mset_pm_tr_access(0x89);
  put(0x1b004, 0x90000); put(0x1b008, 16);
  exception(vm, 0x30, 0, start + 2, true, start);
  assert.equal(vm.get('cs'), 8); assert.equal(vm.get('gip'), 0x6000);
  assert.equal(new DataView(vm.mem.buffer).getUint32(vm.get('sp'), true), 0x182);
  assert.equal(new DataView(vm.mem.buffer).getUint32(vm.get('sp') + 4, true), start);
  assert.equal(e.pg_pending(), 0); assert.equal(e.pg_error(), 0);
  observations.push({ retainedNestedExceptionChain: true, readOnlyDiagnostics: true,
    absentGateAndInvalidTarget: true, softwarePrivilegeNegative: true });
}
async function failureCapture() {
  const com = Buffer.alloc(0x9000);
  const put = (p, n) => com.writeUInt32LE(n >>> 0, p - 0x10100);
  com.set([0xfa, 0x0f, 0x01, 0x16, 0xe0, 1, 0x0f, 0x01, 0x1e, 0xe6, 1,
    0x66, ...mov(0, guestPageDirectory), 0x0f, 0x22, 0xd8,
    0x66, ...mov(0, 0x80000011), 0x0f, 0x22, 0xc0, 0xea, 0, 2, 8, 0]);
  com.writeUInt16LE(0x2f, 0xe0); com.writeUInt32LE(0x18000, 0xe2);
  com.writeUInt16LE(0x7ff, 0xe6); com.writeUInt32LE(0x17000, 0xe8);
  put(0x18008, 0xffff); put(0x1800c, 0x00cf9a01);
  put(0x18010, 0xffff); put(0x18014, 0x00cf9200);
  put(0x18028, 0x90000067); put(0x1802c, 0x00008901);
  put(0x17070, 0x00280000); put(0x17074, 0x00008500);
  put(guestPageDirectory, 0x13007);
  for (let i = 0; i < 1024; i++) put(0x13000 + i * 4, i * 4096 | 7);
  com.set([0x66, 0xb8, 16, 0, 0x8e, 0xd8, 0x8e, 0xc0, 0x8e, 0xd0,
    ...mov(4, 0x90000), 0xa1, ...u32(0x10000000)], 0x100);
  const dir = evidence || fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'toyvm-exception-capture-'));
  const exe = path.join(dir, 'fault.COM'), json = path.join(dir, 'failure.json'), png = path.join(dir, 'failure.png');
  fs.writeFileSync(exe, com); fs.rmSync(json, { force: true }); fs.rmSync(png, { force: true });
  const lines = [];
  await assert.rejects(runDos({ exe, pspSeg: 0x1000, loadSeg: 0x1000, budget: 10000,
    seconds: 5, sound: false, traceFault: true, faultJson: json, faultPng: png,
    log: line => lines.push(line) }), /386 shutdown: fault delivering #DF/);
  const state = JSON.parse(fs.readFileSync(json));
  assert.equal(state.chain.length, 2); assert.equal(state.chain[0].vector, 14);
  assert.equal(state.chain[0].cr2, 0x10000000); assert.equal(state.chain[0].error, 0);
  assert.equal(state.chain[0].target.selector, 0x28);
  assert(lines.some(line => line.startsWith('paged exception failure: ')));
  const image = fs.readFileSync(png);
  assert.equal(image.subarray(1, 4).toString(), 'PNG');
  assert(image.readUInt32BE(16) > 0 && image.readUInt32BE(20) > 0);
  observations.push({ captureBeforeThrow: true, guestFailurePreserved: true });
}

// Task-switch prerequisites only. LTR initializes TR without a task switch;
// Nonpaged NT IRET keeps its explicit stop; paged task returns are tested below.
async function initialTaskFlags(variant, cpu, runLive = true) {
  // Real PUSHF observes DOS entry before the guest changes any flag. The
  // browser's LiveRun initialization is exercised in Node, with its animation
  // callback replaced by bounded ordinary DosSession steps (no rendering).
  const com = Buffer.from([0x9c, 0x58, 0xa3, 0, 3, 0xb8, 0, 0x4c, 0xcd, 0x21]);
  const dir = evidence || fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'toyvm-entry-flags-'));
  try {
    const exe = path.join(dir, `flags-${variant}-${cpu}.COM`); fs.writeFileSync(exe, com);
    const r = await runDos({ exe, variant, cpu, budget: 1000, seconds: 3,
      pspSeg: 0x1000, loadSeg: 0x1000, sound: false, autoKey: false, log() {} });
    assert.equal(r.machine.exited, true); assert.equal(r.machine.exitCode, 0);
    const expected = cpu >= 386 ? 0x202 : 0xf202;
    assert.equal(new DataView(r.vm.mem.buffer).getUint16(0x10300, true), expected, 'native initial FLAGS follows CPU model');
    // The separate JIT worker bundle intentionally does not embed LiveRun.
    if (!runLive) { observations.push({ variant, cpu, nativeEntryFlags: expected }); return; }
    const { LiveRun } = require('../tools/toyvm/live');
    const live = new LiveRun({ exe: 'FLAGS.COM', files: { 'FLAGS.COM': com }, variant, cpu,
      pspSeg: 0x1000, loadSeg: 0x1000, sound: false });
    live.tick = function() {
      assert.equal(this.vm.exports.pg_flags() & 0xffff, expected, 'LiveRun initial FLAGS follows CPU model');
      for (let i = 0; i < 100 && !this.machine.exited; i++) this.session.step();
      this.running = false;
    };
    await live.start();
    assert.equal(live.machine.exited, true); assert.equal(live.machine.exitCode, 0);
    assert.equal(new DataView(live.vm.mem.buffer).getUint16(0x10300, true), expected, 'LiveRun executes actual PUSHF');
    observations.push({ variant, cpu, nativeAndLiveEntryFlags: expected });
  } finally { if (!evidence) fs.rmSync(dir, { recursive: true, force: true }); }
}

async function taskRegisterCom(variant, tier = {}) {
  const com = Buffer.alloc(0x800);
  com.set([0xfa, 0x0f, 0x01, 0x16, 0x80, 1, 0x66, ...mov(0, 0x11),
    0x0f, 0x22, 0xc0, 0xea, 0, 2, 8, 0]);
  com.writeUInt16LE(0x1f, 0x80); com.writeUInt32LE(0x10800, 0x82);
  com.set([0xb8, 0x10, 0, 0x8e, 0xd8, 0x8e, 0xc0, 0x8e, 0xd0,
    0xbc, 0, 0xff, 0x9c, 0x58, 0xa3, 4, 3, // original FLAGS
    0xb8, 0x18, 0, 0x0f, 0, 0xd8, // LTR AX
    0x0f, 0, 0xcb, 0x89, 0x1e, 0, 3, // STR BX; store
    0xa0, 0x1d, 8, 0xa2, 2, 3, // actual TSS access byte
    0x9c, 0x58, 0xa3, 6, 3, // FLAGS after LTR
    0x0f, 0x20, 0xc0, 0x66, 0xa3, 8, 3,
    0x66, ...mov(0, 0x10), 0x0f, 0x22, 0xc0, 0xea, 0, 4, 0, 0x10], 0x100);
  com.set([0xb8, 0, 0x10, 0x8e, 0xd8, 0x8e, 0xc0, 0x8e, 0xd0,
    0xb8, 0, 0x4c, 0xcd, 0x21], 0x300);
  // Code and data are real-compatible 16-bit segments at base10000.
  for (const [off, lo, hi] of [[0x708, 0x0000ffff, 0x00009a01],
    [0x710, 0x0000ffff, 0x00009201], [0x718, 0x00000067, 0x00008917]]) {
    com.writeUInt32LE(lo, off); com.writeUInt32LE(hi, off + 4);
  }
  const dir = evidence || fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'toyvm-ltr-'));
  try {
    const exe = path.join(dir, `ltr-${variant}-${Object.keys(tier).join('') || 'base'}.COM`);
    fs.writeFileSync(exe, com);
    const r = await runDos({ exe, variant, ...tier, budget: 10000, seconds: 3,
      pspSeg: 0x1000, loadSeg: 0x1000, sound: false, autoKey: false, log() {} });
    assert.equal(r.machine.exited, true, 'LTR COM reaches its intended DOS exit');
    assert.equal(r.machine.exitCode, 0); assert.equal(r.ranOutOfTime, false);
    assert.equal(r.vm.get('gip'), 0x40e);
    const v = new DataView(r.vm.mem.buffer), e = r.vm.exports;
    assert.equal(v.getUint16(0x10300, true), 0x18, 'STR returns LTR selector');
    assert.equal(r.vm.mem[0x10302], 0x8b, 'real LTR marks the descriptor busy');
    assert.equal(v.getUint16(0x10304, true), 2, '386 starts with NT clear and CLI clears IF');
    assert.equal(v.getUint16(0x10304, true), v.getUint16(0x10306, true), 'LTR preserves FLAGS');
    assert.equal(v.getUint32(0x10308, true), 0x11, 'LTR does not set CR0.TS');
    assert.equal(e.mget_tr(), 0x18); assert.equal(e.mget_pm_tr_base(), 0x170000);
    assert.equal(e.mget_pm_tr_limit(), 103); assert.equal(e.mget_pm_tr_access(), 0x8b);
    assert.equal(e.mget_pm_tr_valid(), 1);
    assert(r.vm.mem.subarray(0x170000, 0x170068).every(x => x === 0), 'LTR does not save/load TSS state');
    observations.push({ variant, tier, ltrActualCom: true, busy: 0x8b, cr0: 0x11 });
  } finally { if (!evidence) fs.rmSync(dir, { recursive: true, force: true }); }
}

async function taskRegisterChecks(variant) {
  const f = await fixture(variant), { vm, e, put, v, start } = f;
  const { STOP } = require('../tools/toyvm/pm-transfer');
  const cache = () => ['tr', 'pm_tr_valid', 'pm_tr_base', 'pm_tr_limit', 'pm_tr_access']
    .map(n => e[`mget_${n}`]() >>> 0);
  const reset = () => {
    e.mset_cr0(0x80000011); e.mset_vm86(0); e.mset_gdtb(0x19000); e.mset_gdtl(0x2f);
    e.mset_idtb(0x1c000); e.mset_idtl(0x7ff); e.mset_pm_xfer_stop(0);
    for (let i = 0; i < 1024; i++) put(0x21000 + i * 4, (i * 4096) | 7);
    put(0x22000, 0x30007);
    put(0x19008, 0xffff); put(0x1900c, 0x00cf9a00);
    put(0x19010, 0xffff); put(0x19014, 0x00cf9200);
    put(0x19028, 0xb0000067); put(0x1902c, 0x00008901);
    for (const vec of [6, 11, 13, 14]) {
      put(0x1c000 + vec * 8, 0x00086000); put(0x1c004 + vec * 8, 0x00008e00);
    }
    vm.setAll({ cs: 8, ds: 16, es: 16, ss: 16, sp: 0x80000, ip: start, flags: 2, ax: 0x28 });
    e.mset_tr(0x30); e.mset_pm_tr_base(0x1b000); e.mset_pm_tr_limit(103);
    e.mset_pm_tr_access(0x8b); e.mset_pm_tr_valid(1);
    put(0x1b004, 0x90000); put(0x1b008, 16);
    e.mset_cr2(0xdeadbeef); e.pg_clear(); e.pg_set_error(0);
    vm.mem.set([0x0f, 0, 0xd8], start); // actual LTR AX
  };
  let cases = 0;
  for (const spec of [
    { name: '386', access: 0x89, limit: 103, selector: 0x28 },
    { name: 'RPL/DPL ignored', access: 0xe9, limit: 103, selector: 0x2b },
    { name: '286', access: 0x81, limit: 43, selector: 0x28 },
    { name: 'short TSS accepted by LTR, not task switch', access: 0x89, limit: 0, selector: 0x28 },
    { name: 'memory operand', access: 0x89, limit: 103, selector: 0x28, memory: true },
    { name: 'operand size ignored', access: 0x89, limit: 103, selector: 0x28, prefix: true },
  ]) {
    reset(); vm.set('ax', spec.selector);
    put(0x19028, 0xb0000000 | spec.limit); vm.mem[0x1902d] = spec.access;
    // The TSS itself is deliberately not mapped. LTR must not read it.
    put(0x2106c, 0);
    if (spec.memory) {
      v.setUint16(0x30000, spec.selector, true);
      vm.mem.set([0x0f, 0, 0x1d, ...u32(0x10000000)], start);
    }
    if (spec.prefix) vm.mem.set([0x66, 0x0f, 0, 0xd8], start);
    assert(vm.stepOne());
    assert.equal(vm.get('gip'), start + (spec.memory ? 7 : spec.prefix ? 4 : 3), spec.name);
    assert.deepEqual(cache(), [spec.selector, 1, 0x1b000, spec.limit, spec.access | 2]);
    assert.equal(vm.mem[0x1902d], spec.access | 2);
    assert.equal(e.get_cr0() >>> 0, 0x80000011); assert.equal(e.get_cr3(), 0x20000);
    assert.equal(e.pg_flags(), 2); assert.equal(vm.get('sp'), 0x80000);
    // Hidden cache must survive later descriptor changes.
    put(0x19028, 0); put(0x1902c, 0);
    assert.deepEqual(cache(), [spec.selector, 1, 0x1b000, spec.limit, spec.access | 2]);
    cases++;
  }
  const negatives = [
    ...[0, 1, 2, 3, 4, 0x2c, 0x30].map(selector => ({ name: `selector-${selector}`, selector, vector: 13, error: selector & 0xfffc })),
    ...[0x8b, 0x83, 0x92, 0x82, 0x0b].map(access => ({ name: `type-${access}`, access, vector: 13, error: 0x28 })),
    ...[0x09, 0x01].map(access => ({ name: `not-present-${access}`, access, vector: 11, error: 0x28 })),
    { name: 'GDT page', vector: 14, error: 0, address: 0x1a028, setup() {
      e.mset_gdtl(0x102f); vm.set('ax', 0x1028); put(0x21068, 0);
    } },
    { name: 'descriptor crosses page', vector: 14, error: 0, address: 0x1a000, setup() {
      e.mset_gdtb(0x19fd4); put(0x19fdc, 0xffff); put(0x19fe0, 0x00cf9a00);
      put(0x19ffc, 0xb0000067); put(0x21068, 0);
    } },
    { name: 'memory operand page', vector: 14, error: 0, address: 0x10000000, setup() {
      vm.mem.set([0x0f, 0, 0x1d, ...u32(0x10000000)], start); put(0x22000, 0);
    } },
    { name: 'privilege before memory page', vector: 13, error: 0, setup() {
      vm.set('cs', 0x1b); vm.set('ss', 0x23);
      vm.mem.set([0x0f, 0, 0x1d, ...u32(0x10000000)], start); put(0x22000, 0);
    } },
    { name: 'V86 #UD before memory page', vector: 6, faultIp: 0x200, setup() {
      e.mset_vm86(1); vm.set('cs', 0x1000); vm.set('gip', 0x200);
      vm.mem.set([0x67, 0x0f, 0, 0x1d, ...u32(0x10000000)], 0x10200); put(0x22000, 0);
    } },
  ];
  for (const spec of negatives) {
    reset(); if (spec.selector !== undefined) vm.set('ax', spec.selector);
    if (spec.access !== undefined) vm.mem[0x1902d] = spec.access;
    if (spec.setup) spec.setup();
    const before = cache(), access = vm.mem[0x1902d], tss = vm.mem.slice(0x1b000, 0x1b068);
    assert(vm.stepOne(), spec.name);
    assert.equal(vm.get('gip'), 0x6000, spec.name + ' delivers fault');
    assert.equal(vm.get('intno'), spec.vector, spec.name);
    if (spec.error !== undefined) assert.equal(v.getUint32(vm.get('sp'), true), spec.error, spec.name + ' exact error');
    assert.equal(v.getUint32(vm.get('sp') + (spec.error !== undefined ? 4 : 0), true), spec.faultIp || start, spec.name + ' saved faulting EIP');
    assert.deepEqual(cache(), before, spec.name + ' preserves previous TR/cache');
    assert.equal(vm.mem[0x1902d], access, spec.name + ' does not set busy');
    assert.deepEqual(vm.mem.slice(0x1b000, 0x1b068), tss, spec.name + ' does not save task');
    assert.equal(e.get_cr2() >>> 0, spec.address || 0xdeadbeef, spec.name + ' CR2');
    cases++;
  }
  // A real nested-task IRET must not read a stack frame, even if that frame
  // happens to be valid. Both operand sizes stop and preserve task/stack state.
  for (const paged of [false]) for (const wide of [false, true]) {
    reset(); if (!paged) e.mset_cr0(0x11);
    e.pg_set_flags(0x4002);
    vm.mem.set(wide ? [0xcf] : [0x66, 0xcf], start);
    put(0x80000, start + 0x100); put(0x80004, 8); put(0x80008, 2);
    const before = cache(), frame = vm.mem.slice(0x7fff0, 0x80020);
    assert(vm.stepOne()); assert.equal(e.mget_pm_xfer_stop(), STOP.unsupportedSystem);
    assert.equal(vm.get('gip'), start); assert.equal(vm.get('sp'), 0x80000);
    assert.equal(e.pg_flags(), 0x4002); assert.deepEqual(cache(), before);
    assert.deepEqual(vm.mem.slice(0x7fff0, 0x80020), frame);
    cases++;
  }
  // Nonpaged invalid LTR retains its explicit unsupported-stop contract. Do
  // not start reflecting a guessed architectural exception through the IVT.
  for (const mode of ['real', 'v86', 'ring3', 'busy', 'absent', 'null']) {
    reset(); e.mset_cr0(mode === 'real' ? 0x10 : 0x11);
    if (mode === 'v86') e.mset_vm86(1);
    if (mode === 'ring3') vm.set('cs', 0x1b);
    if (mode === 'busy') vm.mem[0x1902d] = 0x8b;
    if (mode === 'absent') vm.mem[0x1902d] = 9;
    if (mode === 'null') vm.set('ax', 0);
    const before = cache(); assert(vm.stepOne());
    assert.equal(e.mget_pm_xfer_stop(), mode === 'ring3' ? STOP.privilege :
      ['real', 'v86'].includes(mode) ? STOP.unsupportedSystem :
      mode === 'busy' ? STOP.type : mode === 'absent' ? STOP.notPresent : STOP.descriptor, mode);
    assert.deepEqual(cache(), before); assert.equal(vm.get('sp'), 0x80000);
    cases++;
  }
  observations.push({ variant, ltrAndNonpagedReturnCases: cases, ltrOnly: true });
}

// Real INT/LTR/IRET instructions with independent CR3 mappings. Host fixture
// construction is supplemented by an actual boot-to-DOS-exit COM below.
async function taskSwitchFixture(variant) {
  const f = await fixture(variant), { vm, e, v, put, start } = f;
  const descriptor = (selector, base, limit, access, wide = false) => {
    const p = 0x19000 + selector;
    put(p, (limit & 0xffff) | (base & 0xffff) << 16);
    put(p + 4, (base & 0xff000000) | (base >>> 16 & 255) | access << 8 |
      (limit & 0xf0000) | (wide ? 0x400000 : 0));
  };
  const gate = (vec, selector, access = 0x85) => {
    put(0x1a000 + vec * 8, selector << 16); put(0x1a004 + vec * 8, access << 8);
  };
  e.mset_gdtl(0x5f);
  descriptor(0x28, 0x1b000, 103, 0x89);
  descriptor(0x30, 0x1c000, 103, 0xe9); // TSS DPL is ignored by interrupt
  descriptor(0x38, 0x40000, 0xffff, 0x9a, true);
  descriptor(0x40, 0x60000, 0xffff, 0x92, true);
  descriptor(0x48, 0x80000, 0xffff, 0x92);
  descriptor(0x50, 0x1e000, 0x17, 0x82);
  descriptor(0x58, 0x1d000, 103, 0x89);
  put(0x1e008, 0xffff); put(0x1e00c, 0x00cf9200);
  put(0x23000, 0x24007); put(0x23100, 0x25007);
  for (let i = 0; i < 1024; i++) put(0x24000 + i * 4, i * 4096 | 7);
  put(0x25000, 0x50007);
  put(0x30000, 0x11112222); put(0x50000, 0x33334444);
  const tss = (base, ip, cs, ss, sp, ds = 16, ldt = 0, cr3 = 0x23000) => {
    put(base + 28, cr3); put(base + 32, ip); put(base + 36, 0x10202);
    isa.REG16.forEach((_, i) => put(base + 40 + i * 4, i === 4 ? sp : (i + 1) * 0x11111111));
    [0x48, cs, ss, ds, 0, 16].forEach((s, i) => put(base + 72 + i * 4, s));
    put(base + 96, ldt); put(base + 100, 0);
  };
  tss(0x1c000, 0x100, 0x38, 0x40, 0x2000, 0xc, 0x50);
  tss(0x1d000, 0x6200, 8, 16, 0x90000);
  put(0x1d048, 16); // fault task must not share the tested ES descriptor
  // The original task's CR3 and LDTR are static fields; a switch must not
  // overwrite them even if software deliberately changed the live registers.
  put(0x1b01c, 0x20000); put(0x1b060, 0);
  gate(0x30, 0x30);
  for (const vector of [8, 10, 11, 12, 13, 14]) gate(vector, 0x58);
  vm.set('fs', 16); vm.set('gs', 16);
  vm.mem.set([0x66, 0xb8, 0x28, 0, 0x0f, 0, 0xd8, ...mov(0, 0x87654321), 0xcd, 0x30, 0x90], start);
  vm.set('gip', start);
  for (let i = 0; i < 3; i++) assert(vm.stepOne());
  assert.equal(e.mget_tr(), 0x28); assert.equal(vm.mem[0x1902d], 0x8b);
  const intIp = vm.get('gip');
  vm.mem.set([0xa1, ...u32(0x10000000), 0xa3, ...u32(0x71000), 0xcf], 0x40100);
  vm.mem.set([0x83, 0xc4, 4, 0xcf], 0x6200);
  return { ...f, descriptor, gate, tss, intIp };
}

async function taskSwitchInstructions(variant) {
  const { vm, e, v, put, intIp } = await taskSwitchFixture(variant);
  const oldRegs = isa.REG16.map(r => vm.raw(r) >>> 0), oldFlags = e.pg_flags();
  const oldStack = vm.mem.slice(0x7ffe0, 0x80020);
  assert(vm.stepOne());
  assert.equal(e.mget_tr(), 0x30); assert.equal(e.mget_cr3(), 0x23000);
  assert.equal(e.mget_cr0() >>> 0, 0x80000019);
  assert.equal(vm.get('gip'), 0x100); assert.equal(e.pg_flags() & 0x14200, 0x14200);
  assert.equal(v.getUint16(0x1c000, true), 0x28);
  assert.equal(vm.mem[0x1902d], 0x8b); assert.equal(vm.mem[0x19035], 0xeb);
  assert.equal(v.getUint32(0x1b020, true), intIp + 2);
  assert.equal(v.getUint32(0x1b024, true), oldFlags);
  assert.equal(v.getUint32(0x1b01c, true), 0x20000);
  assert.equal(v.getUint32(0x1b060, true), 0);
  oldRegs.forEach((n, i) => assert.equal(v.getUint32(0x1b028 + i * 4, true), n));
  assert.deepEqual(vm.mem.slice(0x7ffe0, 0x80020), oldStack, 'task gate makes no outgoing stack frame');
  assert.equal(e.mget_ldt(), 0x50); assert.equal(e.mget_ldtb(), 0x1e000);
  for (const [s, base, limit, access] of [['cs', 0x40000, 0xffff, 0x9b],
    ['ss', 0x60000, 0xffff, 0x93], ['es', 0x80000, 0xffff, 0x93],
    ['ds', 0, 0xffffffff, 0x93], ['gs', 0, 0xffffffff, 0x93]]) {
    assert.equal(e[`mget_${s}b`]() >>> 0, base, s + ' base');
    assert.equal(e[`mget_pm_${s}_limit`]() >>> 0, limit, s + ' limit');
    assert.equal(e[`mget_pm_${s}_access`](), access, s + ' access');
    assert.equal(e[`mget_pm_${s}_valid`](), 1, s + ' valid');
  }
  assert.equal(e.mget_pm_fs_valid(), 0, 'null FS is unusable');
  assert.equal(e.mget_fsb(), 0); assert.equal(e.mget_d32(), 1);
  assert(vm.stepOne()); assert(vm.stepOne()); assert(vm.stepOne());
  assert.equal(v.getUint32(0x71000, true), 0x33334444, 'actual incoming MOV uses its CR3');
  assert.equal(e.mget_tr(), 0x28); assert.equal(e.mget_cr3(), 0x20000);
  assert.equal(vm.get('gip'), intIp + 2); assert.equal(vm.get('cs'), 8);
  oldRegs.forEach((n, i) => assert.equal(vm.raw(isa.REG16[i]) >>> 0, n));
  assert.equal(e.pg_flags(), oldFlags);
  assert.equal(vm.mem[0x19035], 0xe9, 'NT IRET releases outgoing busy');
  assert.equal(v.getUint32(0x1c020, true), 0x10b, 'resumption follows IRET');
  assert.equal(v.getUint32(0x1c024, true) & 0x4000, 0, 'NT cleared in suspended task');
  vm.mem.set([0xa1, ...u32(0x10000000)], intIp + 2);
  assert(vm.stepOne()); assert.equal(vm.raw('ax') >>> 0, 0x11112222, 'reverse CR3 uses old mapping');
  observations.push({ variant, actualInterruptTaskGateAndNestedIret: true, twoCr3Mappings: true });
}

async function taskSwitchFaults(variant) {
  // A page fault saving the old TSS restarts the actual INT. The guest handler
  // repairs the page, then IRET returns to INT, which must not see target busy.
  {
    const { vm, e, v, put, intIp, descriptor } = await taskSwitchFixture(variant);
    put(0x1a070, 0x00086200); put(0x1a074, 0x00008e00);
    vm.mem.copyWithin(0x1f000, 0x1c000, 0x1c068);
    descriptor(0x30, 0x1f000, 103, 0xe9);
    descriptor(0x28, 0x1bfb0, 103, 0x89);
    vm.mem.fill(0xa5, 0x1bfb0, 0x1c018);
    // Reload relocated outgoing TSS using real LTR, before making its second
    // page absent. Several writes precede the first failing selector save.
    vm.mem.set([0x66, 0xb8, 0x28, 0, 0x0f, 0, 0xd8, 0xcd, 0x30], intIp);
    assert(vm.stepOne()); assert(vm.stepOne());
    const restartIp = vm.get('gip'), bytes = vm.mem.slice(0x1bfb0, 0x1c018);
    put(0x21070, 0);
    assert(vm.stepOne());
    assert.equal(e.mget_tr(), 0x28); assert.equal(e.mget_cr2(), 0x1c000);
    assert.equal(v.getUint32(vm.get('sp') + 4, true), restartIp);
    assert.deepEqual(vm.mem.slice(0x1bfb0, 0x1c018), bytes, 'partial outgoing save is fully undone');
    assert.equal(vm.mem[0x19035], 0xe9, 'no incoming busy bit on partial save fault');
  }
  {
    const { vm, e, v, put, intIp, descriptor } = await taskSwitchFixture(variant);
    put(0x1a070, 0x00086200); put(0x1a074, 0x00008e00);
    descriptor(0x30, 0x1cff0, 103, 0xe9);
    put(0x21074, 0); // second page of the new TSS
    assert(vm.stepOne());
    assert.equal(e.mget_tr(), 0x28); assert.equal(e.mget_cr3(), 0x20000);
    assert.equal(e.mget_cr2(), 0x1d00c);
    assert.equal(v.getUint32(vm.get('sp') + 4, true), intIp);
    assert.equal(vm.mem[0x19035], 0xe9, 'split incoming TSS fault is restartable');
  }
  {
    const { vm, e, v, put, intIp } = await taskSwitchFixture(variant);
    // Keep #PF on an ordinary gate to inspect the precommit frame directly.
    put(0x1a070, 0x00086200); put(0x1a074, 0x00008e00);
    put(0x2106c, 0); // outgoing TSS page
    const target = vm.mem.slice(0x1c000, 0x1c068);
    assert(vm.stepOne());
    assert.equal(e.mget_tr(), 0x28); assert.equal(e.mget_cr3(), 0x20000);
    assert.equal(e.mget_cr2(), 0x1b020);
    assert.equal(v.getUint32(vm.get('sp') + 4, true), intIp);
    assert.equal(vm.mem[0x19035], 0xe9); assert.deepEqual(vm.mem.slice(0x1c000, 0x1c068), target);
    vm.mem.set([...store(0x2106c, 0x1b007), 0x83, 0xc4, 4, 0xcf], 0x6200);
    for (let i = 0; i < 4; i++) assert(vm.stepOne());
    assert.equal(e.mget_tr(), 0x30); assert.equal(vm.get('gip'), 0x100);
  }
  // Invalid incoming DS is detected after commit; #TS runs as a third task.
  // Its real guest instructions repair the saved new task and nested IRET
  // must reload/revalidate that task at its first instruction, then return A.
  {
    const { vm, e, v, put, intIp } = await taskSwitchFixture(variant);
    put(0x1c054, 0x60); // outside GDT and incoming LDT
    assert(vm.stepOne());
    assert.equal(e.mget_tr(), 0x58); assert.equal(v.getUint16(0x1d000, true), 0x30);
    assert.equal(v.getUint32(vm.get('sp'), true), 0x60, 'incoming selector error');
    assert.equal(v.getUint32(0x1c020, true), 0x100, 'fault belongs to incoming first EIP');
    assert.equal(v.getUint32(0x1b020, true), intIp + 2, 'outgoing save survives incoming fault');
    assert.equal(vm.mem[0x19035], 0xeb, 'incoming task remains busy while fault handler nested');
    vm.mem.set([...store(0x1c054, 0xc), 0x83, 0xc4, 4, 0xcf], 0x6200);
    for (let i = 0; i < 3; i++) assert(vm.stepOne());
    assert.equal(e.mget_tr(), 0x30); assert.equal(vm.get('gip'), 0x100);
    for (let i = 0; i < 3; i++) assert(vm.stepOne());
    assert.equal(e.mget_tr(), 0x28); assert.equal(vm.get('gip'), intIp + 2);
  }
  // LDT page is absent only in the new address space. #PF's task sees the
  // incoming CR3 and EIP and repairs it with a real store before backlink IRET.
  {
    const { vm, e, v, put, intIp } = await taskSwitchFixture(variant);
    // LDT linear10002000 maps to physical1e000 through incoming PTE[2].
    put(0x19050, 0x20000017); put(0x19054, 0x10008200);
    put(0x25008, 0);
    assert(vm.stepOne());
    assert.equal(e.mget_tr(), 0x58); assert.equal(e.mget_cr3(), 0x23000);
    assert.equal(e.mget_cr2() >>> 0, 0x10002008);
    assert.equal(v.getUint32(0x1c020, true), 0x100);
    assert.equal(v.getUint32(0x1b020, true), intIp + 2);
    vm.mem.set([...store(0x25008, 0x1e007), 0x83, 0xc4, 4, 0xcf], 0x6200);
    for (let i = 0; i < 3; i++) assert(vm.stepOne());
    assert.equal(e.mget_tr(), 0x30); assert.equal(e.mget_ldtb() >>> 0, 0x10002000);
    for (let i = 0; i < 3; i++) assert(vm.stepOne());
    assert.equal(e.mget_tr(), 0x28);
  }
  observations.push({ variant, outgoingSaveRestart: true, incomingSegmentFaultRepair: true,
    incomingAddressSpacePageFaultRepair: true });
}

// Execute the retained transition after a real task gate and backlink return.
// No cache is patched by the harness: descriptors and instructions establish it.
async function segmentCacheTransitions(variant) {
  const returned = async (nullFs = false) => {
    const f = await taskSwitchFixture(variant);
    f.vm.mem[0x40100] = 0xcf;
    assert(f.vm.stepOne());
    if (nullFs) f.put(0x1b058, 0);
    assert(f.vm.stepOne());
    assert.equal(f.e.mget_tr(), 0x28);
    return f;
  };
  const sequence = (f, bytes) => {
    f.vm.mem.set(bytes, f.vm.get('gip'));
    const end = f.vm.get('gip') + bytes.length;
    for (let n = 0; f.vm.get('gip') !== end && n < 100; n++) {
      assert(f.vm.stepOne()); assert.equal(f.e.mget_tr(), 0x28, 'no unexpected task fault');
    }
    assert.equal(f.vm.get('gip'), end);
  };
  const off = [...mov(0, 0x11), 0x0f, 0x22, 0xc0, ...mov(0, 0x10), 0x0f, 0x22, 0xc0];
  const on = [...mov(0, 0x80000011), 0x0f, 0x22, 0xc0];
  {
    const f = await returned(), { vm, e, v } = f;
    const cache = name => ['valid', 'limit', 'access'].map(n => e[`mget_pm_${name}_${n}`]() >>> 0);
    const names = ['es', 'ss', 'ds', 'fs', 'gs'];
    const before = Object.fromEntries(names.map(n => [n, cache(n)]));
    // Deliberately change the table: neither CR0 nor real MOV may reread it.
    f.put(0x19010, 0); f.put(0x19014, 0);
    sequence(f, off);
    for (const name of names) assert.deepEqual(cache(name), before[name]);
    sequence(f, [...mov(0, 0x110), 0x8e, 0xc0, 0x8e, 0xd0, 0x8e, 0xd8, 0x8e, 0xe0, 0x8e, 0xe8]);
    for (const name of names) {
      assert.deepEqual(cache(name), before[name], name + ' retains hidden attributes');
      assert.equal(e[`get_${name}b`]() >>> 0, 0x1100);
    }
    assert.equal(e.mget_spm() >>> 0, 0xffffffff);
    sequence(f, [...mov(4, 0x104), ...mov(1, 0x12345678), ...on, 0x51]);
    assert.equal(vm.raw('sp') >>> 0, 0x100);
    assert.equal(v.getUint32(0x1200, true), 0x12345678, 'retained MOV SS / PE+PG / PUSH repro');
    // All four data registers and a readable CS are still authoritative.
    for (const prefix of [0x26, 0x3e, 0x64, 0x65]) {
      sequence(f, [prefix, 0xa1, ...u32(0x100)]);
      assert.equal(vm.raw('ax') >>> 0, 0x12345678);
    }
    observations.push({ variant, realSegmentReentry: true, caches: before, pushed: v.getUint32(0x1200, true) });
  }
  // SS.B must be independent of CS.D, including a real-mode SS load.
  for (const wide of [false, true]) {
    const f = await returned(), { vm, e, v } = f;
    f.descriptor(0x48, 0, 0xffff, 0x92, wide);
    sequence(f, [...mov(0, 0x48), 0x8e, 0xd0]);
    assert.equal(e.get_d32(), 1);
    sequence(f, [...off, ...mov(0, 0x110), 0x8e, 0xd0]);
    assert.equal(e.mget_spm() >>> 0, wide ? 0xffffffff : 0xffff);
    sequence(f, [...mov(4, wide ? 0x104 : 0x10002), ...on, 0x66, 0x51]);
    assert.equal(vm.raw('sp') >>> 0, wide ? 0x102 : 0);
    assert.equal(v.getUint16(wide ? 0x1202 : 0x1100, true), vm.get('cx'));
  }
  // Real reloads cannot launder a restricted cache before protected reentry.
  for (const [name, access, limit, bytes, vector] of [
    ['SS limit', 0x92, 0xff, [0x51], 12],
    ['SS expand down', 0x96, 0x1ff, [0x51], 12],
    ['DS read only', 0x90, 0xffff, store(0x100, 0xdeadbeef), 13],
    ['DS limit', 0x92, 0xff, [0xa1, ...u32(0x100)], 13],
  ]) {
    const f = await returned(), { vm, e, v } = f;
    const stack = name.startsWith('SS');
    f.descriptor(0x48, 0, limit, access, true);
    sequence(f, [...mov(0, 0x48), 0x8e, stack ? 0xd0 : 0xd8, ...off,
      ...mov(0, 0x110), 0x8e, stack ? 0xd0 : 0xd8, ...mov(4, 0x104), ...on]);
    const ip = vm.get('gip'), original = vm.mem.slice(0x1200, 0x1204);
    vm.mem.set(bytes, ip); assert(vm.stepOne());
    assert.equal(e.mget_tr(), 0x58, name); assert.equal(vm.get('intno'), vector, name);
    assert.equal(v.getUint32(0x1b020, true), ip, name + ' restarts instruction');
    assert.deepEqual(vm.mem.slice(0x1200, 0x1204), original);
  }
  // A protected null data selector stays unusable; PE/PG alone do not load it.
  {
    const f = await returned(), { vm, e } = f;
    sequence(f, [...mov(0, 0), 0x8e, 0xe0, ...off, ...on]);
    assert.equal(e.mget_pm_fs_valid(), 0);
    vm.mem.set([0x64, 0xa1, ...u32(0x100)], vm.get('gip')); assert(vm.stepOne());
    assert.equal(vm.get('intno'), 13); assert.equal(e.mget_tr(), 0x58);
  }
  // An explicit real-mode load makes a formerly null data register usable;
  // a mode-bit change alone (above) must not do so.
  {
    const f = await returned(true), { vm, e, v } = f;
    assert.equal(e.mget_pm_fs_valid(), 0);
    assert.equal(e.mget_pm_fs_limit(), 0);
    sequence(f, [...mov(0, 0), 0x8e, 0xe0, ...off, ...mov(0, 0x110), 0x8e, 0xe0, ...on]);
    v.setUint32(0x1200, 0xabcdef01, true);
    sequence(f, [0x64, 0xa1, ...u32(0x100)]);
    assert.equal(vm.raw('ax') >>> 0, 0xabcdef01);
    assert.equal(e.mget_pm_fs_limit(), 0xffff);
    assert.equal(e.mget_pm_fs_access(), 0x93);
  }
  // Real far JMP loads a paragraph CS, retains D, and restores its 64K limit.
  {
    const f = await returned(), { vm, e } = f;
    sequence(f, off);
    vm.mem.set([0xea, ...u32(0x200), 0x00, 0x30], vm.get('gip'));
    assert(vm.stepOne()); assert.equal(vm.get('cs'), 0x3000);
    assert.equal(e.get_csb() >>> 0, 0x30000); assert.equal(e.get_d32(), 1);
    assert.equal(e.mget_pm_cs_limit(), 0xffff); assert.equal(e.mget_pm_cs_valid(), 1);
    vm.mem.set([...on, 0x90], 0x30200); sequence(f, [...on, 0x90]);
  }
  // Actual IRETD enters VM86 with six fresh caches, not unreal attributes.
  for (const tooLarge of [false, true]) {
    const f = await returned(), { vm, e } = f;
    const frame = [0x100, 0x4000, 0x23002, 0x12348000, 0x2000, 0x3000, 0x3000, 0, 0];
    sequence(f, [...frame].reverse().flatMap(n => [0x68, ...u32(n)]));
    vm.mem[vm.get('gip')] = 0xcf; assert(vm.stepOne());
    assert.equal(e.get_vm86(), 1); assert.equal(e.get_d32(), 0);
    assert.equal(e.mget_spm(), 0xffff);
    for (const name of isa.SEG) {
      assert.equal(e[`mget_pm_${name}_valid`](), 1);
      assert.equal(e[`mget_pm_${name}_limit`](), 0xffff);
      assert.equal(e[`mget_pm_${name}_access`](), name === 'cs' ? 0xfb : 0xf3);
      assert.equal(e[`get_${name}b`]() >>> 0, vm.get(name) << 4);
    }
    if (tooLarge) {
      vm.mem.set([0x67, 0xa1, ...u32(0x10000)], 0x40100);
      assert(vm.stepOne()); assert.equal(e.mget_tr(), 0x58);
      assert.equal(vm.get('intno'), 13, 'VM86 A32 cannot escape 64K');
    } else {
      vm.mem.set([0x50, 0x58, 0xb8, 0, 0, 0x8e, 0xe0, 0x64, 0xa1, 0x10, 0], 0x40100);
      for (let n = 0; n < 5; n++) assert(vm.stepOne());
      assert.equal(e.get_vm86(), 1); assert.equal(e.mget_tr(), 0x28);
      assert.equal(vm.raw('sp') >>> 0, 0x8000);
      assert.equal(e.mget_pm_fs_valid(), 1, 'VM86 selector zero is a usable paragraph');
    }
  }
  observations.push({ variant, segmentCacheNegativeCases: 5, independentStackWidths: 2, realFarJump: true, vm86CacheResetAndLimit: true });
}

async function taskSwitchSuite() {
  for (const variant of ['tailcall', 'switch', 'calls', 'repl_tailcall']) {
    await taskSwitchInstructions(variant); await taskSwitchFaults(variant);
    await taskSwitchNegatives(variant); await taskSwitchErrorWord(variant);
    await taskCacheFaults(variant); await taskSwitchedFpu(variant);
    await segmentCacheTransitions(variant);
    await taskSwitchCom(variant);
  }
  for (const tier of [{ uopOnly: true }, { uop: true }, { treeFold: true }]) await taskSwitchCom('tailcall', tier);
}

async function taskSwitchedFpu(variant) {
  // Real incoming ESC faults at its first instruction. A same-task #NM
  // handler executes privileged CLTS and IRET; retry then really loads/stores
  // the x87 value without a second fault or an advanced saved EIP.
  const f = await taskSwitchFixture(variant), { vm, e, v, put } = f;
  put(0x1a038, 0x00086300); put(0x1a03c, 0x00008e00);
  vm.mem.set([0x0f, 6, 0xcf], 0x6300);
  vm.mem.set([0xd9, 0xe8, 0xd9, 0x1d, ...u32(0x71020), 0xcf], 0x40100);
  put(0x1c024, 0xfffc0001); // reserved bits must not enter architectural EFLAGS
  assert(vm.stepOne()); assert(e.get_cr0() & 8);
  assert.equal(e.pg_flags() >>> 0, 0x4003, 'incoming 386 reserved FLAGS bits normalized');
  assert(vm.stepOne()); assert.equal(vm.get('gip'), 0x6300);
  assert.equal(e.mget_tr(), 0x30); assert.equal(e.get_cr3(), 0x23000);
  assert.equal(v.getUint32(0x61ff4, true), 0x100);
  assert(vm.stepOne()); assert.equal(e.get_cr0() & 8, 0, 'guest CLTS clears TS');
  assert(vm.stepOne()); assert.equal(vm.get('gip'), 0x100);
  assert(vm.stepOne()); assert(vm.stepOne());
  assert.equal(v.getFloat32(0x71020, true), 1);
  assert(vm.stepOne()); assert.equal(e.mget_tr(), 0x28);
  assert(e.get_cr0() & 8, 'reverse task return sets TS again');
  for (const [name, cr0, code, fault] of [
    ['ESC TS without MP', 8, [0xd9, 0xe8], true],
    ['ESC EM', 4, [0xd9, 0xe8], true],
    ['WAIT MP+TS', 10, [0x9b], true],
    ['WAIT TS without MP', 8, [0x9b], false],
    ['WAIT EM without TS', 6, [0x9b], false],
  ]) {
    const g = await taskSwitchFixture(variant);
    g.put(0x1a038, 0x00086300); g.put(0x1a03c, 0x00008e00);
    g.vm.mem.set(code, 0x40100); assert(g.vm.stepOne());
    g.e.mset_cr0((g.e.get_cr0() & ~14) | cr0);
    assert(g.vm.stepOne());
    assert.equal(g.vm.get('gip'), fault ? 0x6300 : 0x100 + code.length, name);
    assert.equal(g.e.mget_tr(), 0x30, name + ' remains incoming task');
  }
  const user = await taskSwitchFixture(variant);
  user.descriptor(0x38, 0x40000, 0xffff, 0xfa, true);
  user.descriptor(0x40, 0x60000, 0xffff, 0xf2, true);
  user.descriptor(0x48, 0x80000, 0xffff, 0xf2);
  user.put(0x1e00c, 0x00cff200);
  for (const [offset, selector] of [[72, 0x4b], [76, 0x3b], [80, 0x43], [84, 0xf], [92, 0x23]])
    user.put(0x1c000 + offset, selector);
  user.vm.mem.set([0x0f, 6], 0x40100);
  assert(user.vm.stepOne()); assert.equal(user.vm.get('cs'), 0x3b);
  assert(user.vm.stepOne()); assert.equal(user.e.mget_tr(), 0x58);
  assert.equal(user.vm.get('intno'), 13, 'CPL3 CLTS faults');
  assert.equal(user.v.getUint32(0x1c020, true), 0x100, 'CLTS fault restarts at incoming EIP');
  assert.equal(user.v.getUint32(0x8fffc, true), 0, 'CLTS #GP error is zero');

}

async function taskCacheFaults(variant) {
  for (const [name, prepare, code, vector] of [
    ['null FS', () => {}, [0x64, 0xa1, ...u32(0x10000000)], 13],
    ['DS limit', f => { f.put(0x1e008, 0xff); f.put(0x1e00c, 0x00409200); }, [0xa1, ...u32(0x10000000)], 13],
    ['read-only DS', f => { f.vm.mem[0x1e00d] = 0x90; }, store(0x10, 0xdeadbeef), 13],
    ['SS limit', f => { f.v.setUint16(0x19040, 0xfff, true); }, [0x50], 12],
    ['expand-down SS', f => { f.vm.mem[0x19045] = 0x96; f.v.setUint16(0x19040, 0x1fff, true); }, [0x50], 12],
  ]) {
    const f = await taskSwitchFixture(variant); prepare(f);
    f.vm.mem.set(code, 0x40100); assert(f.vm.stepOne());
    assert.equal(f.e.mget_tr(), 0x30);
    const oldStack = f.vm.mem.slice(0x61ff0, 0x62000);
    assert(f.vm.stepOne());
    assert.equal(f.e.mget_tr(), 0x58, name); assert.equal(f.vm.get('intno'), vector, name);
    assert.equal(f.v.getUint32(0x1c020, true), 0x100, name + ' restarts incoming instruction');
    assert.deepEqual(f.vm.mem.slice(0x61ff0, 0x62000), oldStack, name + ' leaves no partial write');
  }
  // Fault in the incoming image of a backlink IRET must use A's first EIP,
  // not the IRET instruction in B. Repair through the nested fault task.
  const f = await taskSwitchFixture(variant), { vm, e, v, put, intIp } = f;
  vm.mem[0x40100] = 0xcf; assert(vm.stepOne());
  put(0x1b054, 0x60); assert(vm.stepOne());
  assert.equal(e.mget_tr(), 0x58); assert.equal(v.getUint16(0x1d000, true), 0x28);
  assert.equal(v.getUint32(0x1b020, true), intIp + 2);
  assert.equal(v.getUint32(0x1c020, true), 0x101);
  assert.equal(vm.mem[0x19035], 0xe9, 'outgoing IRET busy clear survives incoming fault');
  vm.mem.set([...store(0x1b054, 16), 0x83, 0xc4, 4, 0xcf], 0x6200);
  for (let i = 0; i < 3; i++) assert(vm.stepOne());
  assert.equal(e.mget_tr(), 0x28); assert.equal(vm.get('gip'), intIp + 2);
  observations.push({ variant, incomingCacheAccessFaults: 5, postCommitIretFaultRepair: true });
}

async function taskSwitchCom(variant, tier = {}) {
  const com = Buffer.alloc(0xb000);
  const put = (p, n) => com.writeUInt32LE(n >>> 0, p - 0x10100);
  com.set([0xfa, 0x0f, 1, 0x16, 0xe0, 1, 0x0f, 1, 0x1e, 0xe6, 1,
    0x66, ...mov(0, guestPageDirectory), 0x0f, 0x22, 0xd8,
    0x66, ...mov(0, 0x80000011), 0x0f, 0x22, 0xc0, 0xea, 0, 2, 8, 0]);
  com.writeUInt16LE(0x3f, 0xe0); put(0x101e2, 0x18000);
  com.writeUInt16LE(0x7ff, 0xe6); put(0x101e8, 0x17000);
  com.writeUInt16LE(0x3ff, 0xec); put(0x101ee, 0);
  put(0x18008, 0xffff); put(0x1800c, 0x00cf9a01);
  put(0x18010, 0xffff); put(0x18014, 0x00cf9200);
  put(0x18028, 0x90000067); put(0x1802c, 0x00008901);
  put(0x18020, 0xa0000067); put(0x18024, 0x00008901);
  put(0x18030, 0xffff); put(0x18034, 0x00009a01);
  put(0x18038, 0xffff); put(0x1803c, 0x00009201);
  put(0x17180, 0x00200000); put(0x17184, 0x00008500);
  put(guestPageDirectory, 0x13007); put(0x12100, 0x14007);
  put(0x16000, 0x15007); put(0x16100, 0x1b007);
  for (let i = 0; i < 1024; i++) { put(0x13000 + i * 4, i * 4096 | 7); put(0x15000 + i * 4, i * 4096 | 7); }
  put(0x14000, 0x30007); put(0x1b000, 0x50007);
  put(0x1901c, guestPageDirectory); put(0x1a01c, 0x16000);
  put(0x1a020, 0x400); put(0x1a024, 0x202);
  isa.REG16.forEach((_, i) => put(0x1a028 + i * 4, i === 4 ? 0x80000 : (i + 1) * 0x11111111));
  [16, 8, 16, 16, 0, 16].forEach((s, i) => put(0x1a048 + i * 4, s));
  const main = [0x66, 0xb8, 16, 0, 0x8e, 0xd8, 0x8e, 0xc0, 0x8e, 0xd0,
    0x8e, 0xe0, 0x8e, 0xe8, ...mov(4, 0x90000),
    0x66, 0xb8, 0x28, 0, 0x0f, 0, 0xd8, ...mov(0, 0x87654321),
    ...store(0x30000, 0x11112222), ...store(0x50000, 0x33334444), 0xcd, 0x30];
  const returnIp = 0x200 + main.length;
  main.push(0xa3, ...u32(0x71004), 0xa1, ...u32(0x10000000), 0xa3, ...u32(0x71008),
    0x9c, 0x58, 0xa3, ...u32(0x7100c), 0x0f, 0x20, 0xd8, 0xa3, ...u32(0x71010),
    ...mov(0, 0x11), 0x0f, 0x22, 0xc0, ...mov(0, 0), 0x0f, 0x22, 0xd8,
    0xea, ...u32(0xa00), 0x30, 0);
  com.set(main, 0x100);
  const incoming = [0xa1, ...u32(0x10000000), 0xa3, ...u32(0x71000),
    0x66, 0x0f, 0, 0xc8, 0x66, 0xa3, ...u32(0x71018),
    0x9c, 0x58, 0xa3, ...u32(0x7101c), 0x89, 0x25, ...u32(0x71020), 0xcf];
  com.set(incoming, 0x300);
  com.set([0xb8, 0x38, 0, 0x8e, 0xd8, 0x8e, 0xc0, 0x8e, 0xd0,
    0x8e, 0xe0, 0x8e, 0xe8, 0x66, ...mov(4, 0xfffe),
    0x66, ...mov(0, 0x10), 0x0f, 0x22, 0xc0, 0xea, 0, 8, 0, 0x10], 0x900);
  com.set([0xb8, 0, 0x10, 0x8e, 0xd8, 0x8e, 0xc0, 0x8e, 0xd0,
    0x8e, 0xe0, 0x8e, 0xe8, 0x0f, 1, 0x1e, 0xec, 1,
    0xb8, 0, 0x4c, 0xcd, 0x21], 0x700);
  const dir = evidence || fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'toyvm-task-com-'));
  const exe = path.join(dir, `tasks-${variant}-${Object.keys(tier).join('') || 'interpreter'}.COM`);
  fs.writeFileSync(exe, com);
  const r = await runDos({ exe, variant, ...tier, pspSeg: 0x1000, loadSeg: 0x1000,
    budget: 10000, seconds: 3, sound: false, log() {} });
  assert.equal(r.machine.exited, true, 'task-switch COM returns through intended DOS exit');
  assert.equal(r.machine.exitCode, 0); assert.equal(r.ranOutOfTime, false);
  const v = new DataView(r.vm.mem.buffer), rd = p => v.getUint32(p, true);
  assert.equal(rd(0x71000), 0x33334444); assert.equal(rd(0x71004), 0x87654321);
  assert.equal(rd(0x71008), 0x11112222); assert.equal(rd(0x7100c) & 0x4000, 0);
  assert.equal(rd(0x71010), guestPageDirectory); assert.equal(v.getUint16(0x71018, true), 0x20);
  assert.equal(rd(0x7101c) & 0x4000, 0x4000); assert.equal(rd(0x71020), 0x80000);
  assert.equal(rd(0x19020), returnIp); assert.equal(rd(0x1a020), 0x400 + incoming.length);
  assert.equal(v.getUint16(0x1a000, true), 0x28); assert.equal(rd(0x1a024) & 0x4000, 0);
  assert.equal(r.vm.mem[0x1802d], 0x8b); assert.equal(r.vm.mem[0x18025], 0x89);
  assert.equal(r.vm.get('cs'), 0x1000); assert.equal(r.vm.get('gip'), 0x817);
  assert.equal(r.vm.exports.get_d32(), 0); assert.equal(r.vm.exports.get_cr0(), 0x10);
  observations.push({ variant, tier, actualTaskSwitchCom: true, dispatched: r.dispatched, exitCode: 0 });
}

async function taskSwitchNegatives(variant) {
  const beforeCommit = [
    ['null', f => f.gate(0x30, 0), 13, 0],
    ['local', f => f.gate(0x30, 0x34), 13, 0x34],
    ['bounds', f => f.gate(0x30, 0x60), 13, 0x60],
    ['wrong type before presence', f => { f.vm.mem[0x19035] = 0x12; }, 13, 0x30],
    ['busy before presence', f => { f.vm.mem[0x19035] = 0x6b; }, 13, 0x30],
    ['busy', f => { f.vm.mem[0x19035] = 0xeb; }, 13, 0x30],
    ['not present before short', f => { f.vm.mem[0x19035] = 0x69; f.v.setUint16(0x19030, 0, true); }, 11, 0x30],
    ['short before TSS read', f => { f.v.setUint16(0x19030, 102, true); f.put(0x21070, 0); }, 10, 0x30],
    ['gate absent', f => f.gate(0x30, 0x60, 5), 11, 0x182],
    ['gate wrong type before presence', f => f.gate(0x30, 0x60, 1), 13, 0x182],
  ];
  const afterCommit = [
    ['LDT local', f => f.put(0x1c060, 0x54), 10, 0x54],
    ['LDT outside', f => f.put(0x1c060, 0x60), 10, 0x60],
    ['LDT absent', f => { f.vm.mem[0x19055] = 2; }, 10, 0x50],
    ['LDT type', f => { f.vm.mem[0x19055] = 0x92; }, 10, 0x50],
    ['CS null', f => f.put(0x1c04c, 0), 10, 0],
    ['CS type', f => f.put(0x1c04c, 16), 10, 16],
    ['CS privilege', f => f.put(0x1c04c, 0x3b), 10, 0x38],
    ['CS absent', f => { f.vm.mem[0x1903d] = 0x1a; }, 11, 0x38],
    ['CS short', f => f.v.setUint16(0x19038, 0xff, true), 13, 0],
    ['SS null', f => f.put(0x1c050, 0), 10, 0],
    ['SS type', f => f.put(0x1c050, 8), 10, 8],
    ['SS privilege', f => f.put(0x1c050, 0x43), 10, 0x40],
    ['SS absent', f => { f.vm.mem[0x19045] = 0x12; }, 12, 0x40],
    ['DS bounds', f => f.put(0x1c054, 0x60), 10, 0x60],
    ['DS type', f => f.put(0x1c054, 0x30), 10, 0x30],
    ['DS execute only', f => { f.vm.mem[0x1903d] = 0x98; f.put(0x1c054, 0x38); }, 10, 0x38],
    ['DS privilege', f => f.put(0x1c054, 0xf), 10, 0xc],
    ['DS absent', f => { f.vm.mem[0x1e00d] = 0x12; }, 11, 0xc],
    ['ES absent', f => { f.vm.mem[0x1904d] = 0x12; }, 11, 0x48],
    ['FS bounds', f => f.put(0x1c058, 0x60), 10, 0x60],
    ['GS bounds', f => f.put(0x1c05c, 0x60), 10, 0x60],
  ];
  for (const committed of [false, true]) for (const [name, mutate, vector, error] of committed ? afterCommit : beforeCommit) {
    const f = await taskSwitchFixture(variant), { vm, e, v, intIp } = f;
    mutate(f);
    const backlink = v.getUint16(0x1c000, true);
    try { assert(vm.stepOne()); }
    catch (err) { console.error({ name, committed, diagnostic: err.pagingException }); throw err; }
    assert.equal(e.mget_tr(), 0x58, name + ' invokes fault task');
    assert.equal(vm.get('intno'), vector, name + ' vector');
    assert.equal(v.getUint32(vm.get('sp'), true), error, name + ' error');
    assert.equal(v.getUint16(0x1d000, true), committed ? 0x30 : 0x28, name + ' fault context');
    assert.equal(v.getUint32(0x1b020, true), committed ? intIp + 2 : intIp, name + ' old saved EIP');
    if (committed) assert.equal(v.getUint32(0x1c020, true), 0x100, name + ' incoming saved EIP');
    else assert.equal(v.getUint16(0x1c000, true), backlink, name + ' no target backlink mutation');
  }
  // Both IRET sizes select the backlink, never an ordinary valid-looking frame.
  for (const wide of [false, true]) {
    const { vm, e, v, intIp } = await taskSwitchFixture(variant);
    vm.mem.set(wide ? [0xcf] : [0x66, 0xcf], 0x40100);
    assert(vm.stepOne()); assert(vm.stepOne());
    assert.equal(e.mget_tr(), 0x28); assert.equal(vm.get('gip'), intIp + 2);
    assert.equal(v.getUint32(0x1c020, true), wide ? 0x101 : 0x102);
  }
  for (const [name, backlink, access, vector, error] of [
    ['null', 0, 0x8b, 10, 0], ['local', 0x2c, 0x8b, 10, 0x2c],
    ['not busy', 0x28, 0x89, 10, 0x28], ['absent', 0x28, 0xb, 11, 0x28],
  ]) {
    const { vm, e, v, put } = await taskSwitchFixture(variant);
    vm.mem[0x40100] = 0xcf; assert(vm.stepOne());
    put(0x1c000, backlink); vm.mem[0x1902d] = access;
    const stackBytes = vm.mem.slice(0x61ff0, 0x62020);
    assert(vm.stepOne()); assert.equal(vm.get('intno'), vector, name);
    assert.equal(v.getUint16(0x1d000, true), 0x30, 'IRET rejected before changing task');
    assert.equal(v.getUint32(vm.get('sp'), true), error, name);
    assert.deepEqual(vm.mem.slice(0x61ff0, 0x62020), stackBytes, 'no ordinary IRET frame read/pop');
  }
  observations.push({ variant, taskSwitchNegativeCases: beforeCommit.length + afterCommit.length + 6 });
}

async function taskSwitchErrorWord(variant) {
  const { vm, e, v, put, gate, intIp } = await taskSwitchFixture(variant);
  gate(14, 0x30);
  vm.mem.set([0xa1, ...u32(0x11000000)], intIp);
  // Actual missing-page read enters B, pushes exactly one dword in B's stack,
  // and returns to retry the faulting MOV after B's real instruction repairs it.
  vm.mem.set([...store(0x20110, 0x22007), 0x83, 0xc4, 4, 0xcf], 0x40100);
  assert(vm.stepOne());
  assert.equal(e.mget_tr(), 0x30); assert.equal(vm.get('sp'), 0x1ffc);
  assert.equal(v.getUint32(0x61ffc, true), 0);
  assert.equal(v.getUint32(0x1b020, true), intIp);
  for (let i = 0; i < 3; i++) assert(vm.stepOne());
  assert.equal(e.mget_tr(), 0x28); assert.equal(vm.get('gip'), intIp);
  assert(vm.stepOne()); assert.equal(vm.raw('ax') >>> 0, 0x11112222);
  // A software INT with the same vector does not deliver an exception word.
  vm.mem.set([0xcd, 14], vm.get('gip')); assert(vm.stepOne());
  assert.equal(e.mget_tr(), 0x30); assert.equal(vm.get('sp'), 0x2000);

  const f = await taskSwitchFixture(variant);
  f.gate(14, 0x30); f.vm.mem.set([0xa1, ...u32(0x11000000)], f.intIp);
  f.put(0x24184, 0); // incoming error-word stack page61 not present
  f.put(0x61ffc, 0xfeedface);
  assert(f.vm.stepOne());
  assert.equal(f.e.mget_tr(), 0x58); assert.equal(f.vm.get('intno'), 8, '#PF during #PF delivery becomes #DF');
  assert.equal(f.e.mget_cr2(), 0x61ffc);
  assert.equal(f.v.getUint16(0x1d000, true), 0x30, 'error-word failure is in incoming task');
  assert.equal(f.v.getUint32(0x1c038, true), 0x2000, 'no partial push');
  assert.equal(f.v.getUint32(0x61ffc, true), 0xfeedface);
  assert.equal(f.v.getUint32(0x1c020, true), 0x100);
  observations.push({ variant, actualPageFaultTaskErrorWordAndRetry: true, softwareIntNoErrorWord: true,
    incomingErrorWordFault: true });
}

async function taskRegisterSuite() {
  for (const variant of ['tailcall', 'switch', 'calls', 'repl_tailcall']) {
    for (const cpu of [86, 186, 386]) await initialTaskFlags(variant, cpu);
    await taskRegisterCom(variant); await taskRegisterChecks(variant);
  }
  for (const tier of [{ uopOnly: true }, { uop: true }, { treeFold: true }]) await taskRegisterCom('tailcall', tier);
  if (evidence) fs.writeFileSync(path.join(evidence, 'task-register.json'), JSON.stringify(observations, null, 2));
}

(async () => {
  if (process.argv.includes('--segment-cache-only')) {
    for (const variant of ['tailcall', 'switch', 'calls', 'repl_tailcall']) await segmentCacheTransitions(variant);
    if (evidence) fs.writeFileSync(path.join(evidence, 'segment-cache.json'), JSON.stringify(observations, null, 2));
    console.log('PASS real segment cache transitions, unreal attributes, independent SS.B and protected negatives');
    return;
  }
  if (process.argv.includes('--task-switch-only')) {
    await taskSwitchSuite();
    if (evidence) fs.writeFileSync(path.join(evidence, 'task-switch.json'), JSON.stringify(observations, null, 2));
    console.log('PASS task switch commit, two CR3 mappings, real INT/LTR/nested IRET and guest fault repair');
    return;
  }
  if (!process.argv.includes('--exception-diagnostics-only')) await taskRegisterSuite();
  if (process.argv.includes('--task-register-only')) {
    console.log('PASS actual LTR busy/cache/negatives and explicit nonpaged NT IRET stops');
    return;
  }
  await exceptionDiagnostics();
  await failureCapture();
  if (process.argv.includes('--exception-diagnostics-only')) {
    console.log('PASS retained chain/read-only state/invalid and absent descriptors/software privilege/error state/real COM failure JSON+PNG');
    return;
  }
  await taskSwitchSuite();
  for (const variant of ['tailcall', 'switch', 'calls', 'repl_tailcall']) await run(variant);
  for (const variant of ['tailcall', 'switch', 'calls', 'repl_tailcall']) await systemReads(variant);
  for (const variant of ['tailcall', 'switch', 'calls', 'repl_tailcall']) await v86Restart(variant);
  for (const variant of ['tailcall', 'switch', 'calls', 'repl_tailcall']) await physicalBus(variant);
  await traceGuard();
  for (const variant of ['tailcall', 'switch', 'calls', 'repl_tailcall']) {
    await dosCom(variant); await nonPagedCom(variant);
  }
  await dosCom('tailcall', { uopOnly: true });
  await dosCom('tailcall', { uop: true });
  await dosCom('tailcall', { treeFold: true });
  if (evidence) fs.writeFileSync(path.join(evidence, 'observations.json'), JSON.stringify(observations, null, 2));
  console.log('PASS four variants: paged scalar/fetch/IVT, same/inner #PF restart, REP partial, CR3 remap, physical alias, entry guard');
})().catch(e => { console.error(e); process.exitCode = 1; });
