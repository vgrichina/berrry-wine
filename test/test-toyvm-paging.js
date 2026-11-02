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
  const vm = await makeVm(variant);
  const e = vm.exports, v = new DataView(vm.mem.buffer);
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
  // #PF -> invalid gate #GP -> #DF -> unsupported task gate. Preserve the
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
  assert.match(failure.message, /unsupported 386 task-gate/);
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
  // unsupported stop; it saves the faulting IP and IDT selector error code.
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
    log: line => lines.push(line) }), /unsupported 386 task-gate transfer/);
  const state = JSON.parse(fs.readFileSync(json));
  assert.equal(state.chain.length, 1); assert.equal(state.chain[0].vector, 14);
  assert.equal(state.chain[0].cr2, 0x10000000); assert.equal(state.chain[0].error, 0);
  assert.equal(state.chain[0].target.selector, 0x28);
  assert(lines.some(line => line.startsWith('paged exception failure: ')));
  const image = fs.readFileSync(png);
  assert.equal(image.subarray(1, 4).toString(), 'PNG');
  assert(image.readUInt32BE(16) > 0 && image.readUInt32BE(20) > 0);
  observations.push({ captureBeforeThrow: true, guestFailurePreserved: true });
}
(async () => {
  await exceptionDiagnostics();
  await failureCapture();
  if (process.argv.includes('--exception-diagnostics-only')) {
    console.log('PASS retained chain/read-only state/invalid and absent descriptors/software privilege/error state/real COM failure JSON+PNG');
    return;
  }
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
