'use strict';

const assert = require('node:assert/strict');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');

// Contract, not a native Windows observation: C whitespace, at most one sign,
// and zero when no conversion occurs. All expected integers are literal.
// https://learn.microsoft.com/en-us/cpp/c-runtime-library/reference/atol-atol-l-wtol-wtol-l
// https://learn.microsoft.com/en-us/cpp/c-runtime-library/reference/isspace-iswspace-isspace-l-iswspace-l?view=msvc-170
// WG14 N1548 7.22.1.2 and 7.22.1.4.
const rows = [
  ['empty', [0, 52, 50, 0], 0],
  ['positive', Buffer.from('42\0'), 42],
  ['negative', Buffer.from('-42\0'), -42],
  ['plus', Buffer.from('+42\0'), 42],
  ['minus plus', Buffer.from('-+42\0'), 0],
  ['plus minus', Buffer.from('+-42\0'), 0],
  ['plus plus', Buffer.from('++42\0'), 0],
  ['minus minus', Buffer.from('--42\0'), 0],
  ['minus only', Buffer.from('-\0'), 0],
  ['plus only', Buffer.from('+\0'), 0],
  ['nonsense', Buffer.from('xyz42\0'), 0],
  ['space after sign', Buffer.from('- 42\0'), 0],
  ['tab after sign', Buffer.from('+\t42\0'), 0],
  ['mixed whitespace', [9, 10, 11, 12, 13, 32, 9, 45, 52, 50, 0], -42],
  ['whitespace only', [9, 10, 11, 12, 13, 32, 0, 52, 50, 0], 0],
  ['signed32 maximum', Buffer.from('2147483647\0'), 2147483647],
  ['signed32 minimum', Buffer.from('-2147483648\0'), -2147483648],
  ['plus maximum trailing', Buffer.from('+2147483647tail\0'), 2147483647],
  ['minimum trailing', Buffer.from('-2147483648tail\0'), -2147483648],
  ['trailing text', Buffer.from('123tail99\0'), 123],
  ['trailing space', Buffer.from('-12 99\0'), -12],
  ['trailing control', [49, 50, 1, 57, 0], 12],
  ['embedded NUL', [49, 50, 0, 57, 0], 12],
  ['leading zeroes', Buffer.from('00042\0'), 42],
  ['negative zero', Buffer.from('-0\0'), 0],
  ['decimal suffix', Buffer.from('12.5\0'), 12],
  ['hex prefix', Buffer.from('0x42\0'), 0],
];
for (const ch of [0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20]) {
  rows.push([`whitespace ${ch}`, [ch, 52, 50, 0], 42]);
  rows.push([`whitespace ${ch} plus`, [ch, 43, 52, 50, 0], 42]);
  rows.push([`whitespace ${ch} minus`, [ch, 45, 52, 50, 0], -42]);
  rows.push([`whitespace ${ch} two signs`, [ch, 45, 43, 52, 50, 0], 0]);
}
for (const ch of [...Array.from({ length: 33 }, (_, i) => i), 0x7f, 0x80, 0x85, 0xa0, 0xff]) {
  if ([9, 10, 11, 12, 13, 32].includes(ch)) continue;
  rows.push([`invalid prefix ${ch}`, [ch, 52, 50, 0], 0]);
  rows.push([`invalid prefix ${ch} after space`, [32, ch, 45, 52, 50, 0], 0]);
}

// Inspection exports seed state only; atol always runs through PE/IAT/x86.
const extra = `
(func (export "test_seed") (param $top i32) (param $cw i32)
 (call $fpu_reset (local.get $cw))
 (global.set $fpu_top (local.get $top))
 (global.set $fpu_sw (i32.const 18176))
 (global.set $flag_op (i32.const 8)) (global.set $flag_a (i32.const 1))
 (global.set $flag_b (i32.const 0)) (global.set $flag_res (i32.const -1))
 (global.set $saved_cf (i32.const 1)) (global.set $flag_sign_shift (i32.const 31)))
(func (export "test_put") (param $i i32) (param $v f64)
 (call $fpu_set (local.get $i) (local.get $v)))
(func (export "test_st") (param $i i32) (result f64) (call $fpu_get (local.get $i)))
(func (export "test_cw") (result i32) (global.get $fpu_cw))
(func (export "test_cf") (result i32) (global.get $saved_cf))
(func (export "test_flags") (result i32)
 (i32.or (call $get_cf)
  (i32.or (i32.shl (call $get_pf) (i32.const 2))
   (i32.or (i32.shl (call $get_zf) (i32.const 6))
    (i32.or (i32.shl (call $get_sf) (i32.const 7))
     (i32.shl (call $get_of) (i32.const 11)))))))
`;

function makePe() {
  const b = Buffer.alloc(0x600), pe = 0x80, opt = pe + 24, section = opt + 0xe0;
  const u16 = (p, v) => b.writeUInt16LE(v, p);
  const u32 = (p, v) => b.writeUInt32LE(v, p);
  u16(0, 0x5a4d); u32(0x3c, pe); u32(pe, 0x4550);
  u16(pe + 4, 0x14c); u16(pe + 6, 1); u16(pe + 20, 0xe0); u16(pe + 22, 0x10f);
  u16(opt, 0x10b); u32(opt + 4, 0x400); u32(opt + 16, 0x1000);
  u32(opt + 20, 0x1000); u32(opt + 28, 0x400000);
  u32(opt + 32, 0x1000); u32(opt + 36, 0x200);
  u32(opt + 56, 0x2000); u32(opt + 60, 0x200); u32(opt + 92, 16);
  u32(opt + 104, 0x1100); u32(opt + 108, 40);
  b.write('.text\0\0\0', section, 'ascii');
  u32(section + 8, 0x400); u32(section + 12, 0x1000);
  u32(section + 16, 0x400); u32(section + 20, 0x200); u32(section + 36, 0xe0000060);
  b.set([0xff, 0x74, 0x24, 4, 0xff, 0x15, 0x40, 0x11, 0x40, 0,
    0x8d, 0x64, 0x24, 4, 0xc3], 0x200); // push arg; call [IAT]; lea esp,[esp+4]; ret
  u32(0x300, 0x1130); u32(0x30c, 0x1180); u32(0x310, 0x1140);
  u32(0x330, 0x1190); u32(0x340, 0x1190);
  b.write('MSVCRT.dll\0', 0x380, 'ascii'); b.write('atol\0', 0x392, 'ascii');
  return b;
}


async function main() {
  const module = compileSrcWasm((file, source) => file === '13-exports.wat' ? source + extra : source);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { exports: null, getMemory: () => memory.buffer };
  const { host } = createHostImports(ctx);
  Object.assign(host, { memory, log: () => {}, log_i32: () => {}, exit: () => {},
    crash_unimplemented: () => { throw Error('unexpected unimplemented opcode'); },
    wait_multiple: () => 0, shell_execute: () => 33 });
  const { instance } = await WebAssembly.instantiate(module, { host });
  const e = ctx.exports = instance.exports, bytes = new Uint8Array(memory.buffer), pe = makePe();
  bytes.set(pe, e.get_staging());
  assert.equal(e.load_pe(pe.length) >>> 0, 0x401000, 'MSVCRT importing PE loads');
  const api = require('../src/api_table.json').find(entry => entry.name === 'atol');
  assert.equal(api.nargs, 1); assert.equal(api.convention, 'cdecl');
  const thunk = e.guest_read32(0x401140) >>> 0;
  assert.equal(thunk, e.get_thunk_base() >>> 0, 'public MSVCRT IAT thunk');
  assert.equal(e.guest_read32(thunk + 4) >>> 0, api.id, 'atol dispatch id');
  const arena = e.guest_alloc(256) >>> 0, wa = e.guest_to_wasm(arena) >>> 0, stack = 0x700000;
  const regs = ['ecx', 'edx', 'ebx', 'ebp', 'esi', 'edi'];
  const flags = () => [e.get_flag_op(), e.get_flag_a(), e.get_flag_b(), e.get_flag_res(),
    e.get_flag_sign_shift(), e.test_cf(), e.test_flags()];
  const bank = [19.25, -20.5, 21.75, -22.25, 23.5, -24.75, 25.125, -26.5];
  const failures = [];
  let calls = 0;
  for (const rc of [0, 1, 2, 3]) for (let top = 0; top < 8; top++) {
    for (const [name, input, expected] of rows) {
      const label = `${name} RC${rc} TOP${top}`, cw = 0x037f | (rc << 10);
      e.test_seed(top, cw); bank.forEach((v, i) => e.test_put(i, v));
      regs.forEach((reg, i) => e['set_' + reg](0x12345000 + i * 0x101));
      e.set_eax(0x76543210);
      bytes.fill(0xcd, wa, wa + 256); bytes.set(input, wa + 64);
      const before = Buffer.from(bytes.subarray(wa, wa + 256));
      e.guest_write32(stack, 0); e.guest_write32(stack + 4, arena + 64);
      e.guest_write32(stack + 8, 0x13579bdf);
      const stackWa = e.guest_to_wasm(stack) >>> 0;
      const args = Buffer.from(bytes.subarray(stackWa, stackWa + 12));
      const savedRegs = regs.map(reg => e['get_' + reg]()), savedFlags = flags(), tags = e.get_fpu_tags();
      assert(savedFlags[0] !== 0 && savedFlags[6] !== 0, 'nonzero lazy/condition flags');
      e.set_esp(stack); e.set_eip(0x401000); e.run(10000);
      assert.equal(e.get_eip(), 0, label + ' x86 return');
      assert.equal(e.get_esp(), stack + 4, label + ' cdecl ESP+4 (seventh non-EAX GPR)');
      assert.deepEqual(regs.map(reg => e['get_' + reg]()), savedRegs, label + ' six other GPRs');
      assert.deepEqual(flags(), savedFlags, label + ' lazy/condition flags');
      assert.equal(e.test_cw(), cw, label + ' CW');
      assert.equal(e.get_fpu_sw(), 0x4700, label + ' SW');
      assert.equal(e.get_fpu_top(), top, label + ' TOP');
      assert.equal(e.get_fpu_tags(), tags, label + ' tags');
      bank.forEach((v, i) => assert.equal(e.test_st(i), v, label + ' ST' + i));
      assert.deepEqual(Buffer.from(bytes.subarray(stackWa, stackWa + 12)), args, label + ' args/canary');
      assert.deepEqual(Buffer.from(bytes.subarray(wa, wa + 256)), before, label + ' input/canaries');
      const actual = e.get_eax() | 0;
      if (actual !== expected) failures.push({ label, input: [...input], expected, actual });
      calls++;
    }
  }
  console.log(JSON.stringify({ calls, rows: rows.length, mismatchCount: failures.length, firstMismatches: failures.slice(0, 24) }, null, 2));
  assert.equal(failures.length, 0, 'literal MSVCRT!atol prefix results');
  console.log('PASS atol C whitespace/single sign, public PE/IAT/x86, cdecl/GPRs/flags/FPU/input');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
