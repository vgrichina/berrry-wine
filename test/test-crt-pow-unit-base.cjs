'use strict';

const assert = require('node:assert/strict');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');

// Microsoft CRT pow API and official WG14 N1548 Annex F.10.4.4:
// https://learn.microsoft.com/en-us/cpp/c-runtime-library/reference/pow-powf-powl?view=msvc-170
// https://www.open-std.org/jtc1/sc22/wg14/www/docs/n1548.pdf
// pow(+1, y) returns 1 for any y, even a NaN. Quiet NaNs only;
// no signaling, floating exception, or NaN payload assertions.
function fromBits(hex) { return Buffer.from(hex, 'hex').readDoubleBE(); }
const quietNaNBits = [
  '7ff8000000000000', 'fff8000000000000',
  '7ff8000000000001', 'fff8000000000001',
  '7fffffffffffffff', 'ffffffffffffffff',
];
const unitExponentBits = [
  ...quietNaNBits, '7ff0000000000000', 'fff0000000000000',
  '0000000000000000', '8000000000000000',
  '0000000000000001', '8000000000000001',
  '3ff0000000000000', 'bff0000000000000',
  '3fe0000000000000', 'bfe0000000000000',
  '4008000000000000', 'c008000000000000',
  '7fefffffffffffff', 'ffefffffffffffff',
];
const rows = unitExponentBits.map(hex => [1, fromBits(hex), '3ff0000000000000']);
// Literal exact results or NaN classification for unchanged other-base paths.
// The -1/infinite-exponent rows pin existing host compatibility behavior.
rows.push(
  [-1, 3, 'bff0000000000000'], [-1, 2, '3ff0000000000000'],
  [-1, -3, 'bff0000000000000'], [-1, 0.5, 'NaN'],
  [-1, Infinity, 'NaN'], [-1, -Infinity, 'NaN'],
  [fromBits('3fefffffffffffff'), 1, '3fefffffffffffff'],
  [fromBits('3ff0000000000001'), 1, '3ff0000000000001'],
  [fromBits('3fefffffffffffff'), Infinity, '0000000000000000'],
  [fromBits('3ff0000000000001'), Infinity, '7ff0000000000000'],
  [fromBits('3fefffffffffffff'), -Infinity, '7ff0000000000000'],
  [fromBits('3ff0000000000001'), -Infinity, '0000000000000000'],
  [0, 3, '0000000000000000'], [-0, 3, '8000000000000000'],
  [0, 2, '0000000000000000'], [-0, 2, '0000000000000000'],
  [0, -3, '7ff0000000000000'], [-0, -3, 'fff0000000000000'],
  [-0, -2, '7ff0000000000000'], [-0, 0.5, '0000000000000000'],
  [0, 0, '3ff0000000000000'], [-0, -0, '3ff0000000000000'],
  [fromBits('0000000000000001'), 1, '0000000000000001'],
  [fromBits('8000000000000001'), 1, '8000000000000001'],
  [fromBits('0000000000000001'), 2, '0000000000000000'],
  [fromBits('0000000000000001'), -1, '7ff0000000000000'],
  [Infinity, 2, '7ff0000000000000'], [-Infinity, 3, 'fff0000000000000'],
  [-Infinity, 2, '7ff0000000000000'], [Infinity, -2, '0000000000000000'],
  [-Infinity, -3, '8000000000000000'], [-Infinity, -2, '0000000000000000'],
  [Infinity, 0, '3ff0000000000000'],
  [2, 3, '4020000000000000'], [2, -3, '3fc0000000000000'],
  [-2, 3, 'c020000000000000'], [-2, 4, '4030000000000000'],
  [-2, 0.5, 'NaN'], [4, 0.5, '4000000000000000'],
  [4, -0.5, '3fe0000000000000'], [0.25, 0.5, '3fe0000000000000'],
);
for (const hex of quietNaNBits) {
  const q = fromBits(hex);
  for (const x of [-1, 0, -0, 2, Infinity, fromBits('3ff0000000000001')]) rows.push([x, q, 'NaN']);
  rows.push([q, 1, 'NaN'], [q, 0, '3ff0000000000000'], [q, -0, '3ff0000000000000']);
}

// Test exports only seed and inspect state. The arithmetic runs through a real
// PE import of MSVCRT.dll!pow and literal x86 CALL [IAT], cdecl cleanup, RET.
const extra = `
(func (export "test_seed") (param $top i32) (param $cw i32) (param $sw i32)
 (call $fpu_reset (local.get $cw))
 (global.set $fpu_top (local.get $top))
 (global.set $fpu_sw (local.get $sw))
 (global.set $flag_op (i32.const 8)) (global.set $flag_a (i32.const 1))
 (global.set $flag_b (i32.const 0)) (global.set $flag_res (i32.const -1))
 (global.set $saved_cf (i32.const 1)) (global.set $flag_sign_shift (i32.const 31)))
(func (export "test_put") (param $i i32) (param $v f64)
 (call $fpu_set (local.get $i) (local.get $v)))
(func (export "test_st") (param $i i32) (result f64) (call $fpu_get (local.get $i)))
(func (export "test_cw") (result i32) (global.get $fpu_cw))
(func (export "test_saved_cf") (result i32) (global.get $saved_cf))
(func (export "test_flags") (result i32)
 (i32.or (call $get_cf)
  (i32.or (i32.shl (call $get_pf) (i32.const 2))
   (i32.or (i32.shl (call $get_zf) (i32.const 6))
    (i32.or (i32.shl (call $get_sf) (i32.const 7))
     (i32.shl (call $get_of) (i32.const 11)))))))
`;

function makePe() {
  const b = Buffer.alloc(0x600), pe = 0x80, opt = pe + 24, section = opt + 0xe0;
  const u16 = (p, v) => b.writeUInt16LE(v, p), u32 = (p, v) => b.writeUInt32LE(v, p);
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
  // Forward both double arguments, highest dword first. Each PUSH adjusts ESP.
  b.set([0xff, 0x74, 0x24, 16, 0xff, 0x74, 0x24, 16,
    0xff, 0x74, 0x24, 16, 0xff, 0x74, 0x24, 16,
    0xff, 0x15, 0x40, 0x11, 0x40, 0,
    0x8d, 0x64, 0x24, 16, 0xc3], 0x200);
  u32(0x300, 0x1130); u32(0x30c, 0x1180); u32(0x310, 0x1140);
  u32(0x330, 0x1190); u32(0x340, 0x1190);
  b.write('MSVCRT.dll\0', 0x380, 'ascii'); b.write('pow\0', 0x392, 'ascii');
  return b;
}

const bitView = new DataView(new ArrayBuffer(8));
function bits(value) {
  bitView.setFloat64(0, value, false);
  return bitView.getBigUint64(0, false).toString(16).padStart(16, '0');
}

async function main() {
  const bytes = compileSrcWasm((file, source) => file === '13-exports.wat' ? source + extra : source);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { exports: null, getMemory: () => memory.buffer };
  const { host } = createHostImports(ctx);
  Object.assign(host, { memory, log: () => {}, log_i32: () => {}, exit: () => {},
    crash_unimplemented: () => { throw Error('unexpected unimplemented opcode'); },
    wait_multiple: () => 0, shell_execute: () => 33 });
  const { instance } = await WebAssembly.instantiate(bytes, { host });
  const e = ctx.exports = instance.exports, mem = new Uint8Array(memory.buffer);
  const dv = new DataView(memory.buffer), pe = makePe();
  mem.set(pe, e.get_staging()); assert.equal(e.load_pe(pe.length) >>> 0, 0x401000);
  const thunk = e.guest_read32(0x401140) >>> 0;
  assert(thunk >= (e.get_thunk_base() >>> 0) && thunk < (e.get_thunk_base() >>> 0) + 0x40000,
    'resolved public MSVCRT pow IAT');
  const g = a => e.guest_to_wasm(a) >>> 0, stack = 0x700000;
  const regs = ['eax', 'ecx', 'edx', 'ebx', 'ebp', 'esi', 'edi'];
  const flags = () => [e.get_flag_op(), e.get_flag_a(), e.get_flag_b(),
    e.get_flag_res(), e.get_flag_sign_shift(), e.test_saved_cf(), e.test_flags()];
  const bank = [19.25, -20.5, 21.75, -22.25, 23.5, -24.75, 25.125];
  const failures = [];
  let calls = 0;
  for (const rc of [0, 1, 2, 3]) for (let top = 0; top < 8; top++) {
    for (const [x, y, expected] of rows) {
      const cw = 0x037f | (rc << 10), sw = 0x4700;
      e.test_seed(top, cw, sw);
      bank.forEach((v, i) => e.test_put(i, v));
      regs.forEach((r, i) => e['set_' + r](0x12345000 + i * 0x101));
      dv.setUint32(g(stack), 0, true);
      dv.setFloat64(g(stack + 4), x, true); dv.setFloat64(g(stack + 12), y, true);
      dv.setUint32(g(stack + 20), 0xaabbccdd, true);
      const beforeArgs = Buffer.from(mem.slice(g(stack), g(stack) + 24));
      const savedRegs = regs.map(r => e['get_' + r]()), savedFlags = flags();
      assert(savedFlags[0] !== 0 && savedFlags[6] !== 0, 'nonzero lazy/condition flags');
      const tags = e.get_fpu_tags();
      e.set_esp(stack); e.set_eip(0x401000);
      e.set_bp(0x401016); e.run(10000);
      assert.equal(e.get_eip(), 0x401016, 'public pow return before caller cleanup');
      assert.equal(e.get_esp(), stack - 16, 'public cdecl handler consumes only return address (ESP+4)');
      assert.equal(e.guest_read32(stack - 20) >>> 0, 0x401016, 'real CALL return slot');
      assert.deepEqual(Buffer.from(mem.slice(g(stack - 16), g(stack))), beforeArgs.subarray(4, 20), 'forwarded argument bytes');
      e.run(10000); e.clear_bp();
      const label = `pow(${Object.is(x, -0) ? '-0' : x},${y}) RC${rc} TOP${top}`;
      assert.equal(e.get_eip(), 0, label + ' x86 return');
      assert.equal(e.get_esp(), stack + 4, label + ' cdecl ESP+4');
      assert.deepEqual(regs.map(r => e['get_' + r]()), savedRegs, label + ' GPRs');
      assert.deepEqual(flags(), savedFlags, label + ' lazy/condition flags');
      assert.equal(e.test_cw(), cw, label + ' CW');
      assert.equal(e.get_fpu_sw(), sw, label + ' SW');
      assert.equal(e.get_fpu_top(), (top + 7) & 7, label + ' pushed TOP');
      assert.equal(e.get_fpu_tags(), tags | (1 << ((top + 7) & 7)), label + ' pushed tag');
      bank.forEach((v, i) => assert.equal(bits(e.test_st(i + 1)), bits(v), label + ' other ST' + (i + 1)));
      assert.deepEqual(Buffer.from(mem.slice(g(stack), g(stack) + 24)), beforeArgs, label + ' arguments/canary');
      const actual = Number.isNaN(e.test_st(0)) ? 'NaN' : bits(e.test_st(0));
      if (actual !== expected) failures.push({ label, actual, expected });
      calls++;
    }
  }
  console.log(JSON.stringify({ calls, mismatchCount: failures.length, firstMismatches: failures.slice(0, 20) }, null, 2));
  assert.deepEqual(failures.slice(0, 20), [], 'literal pow binary64 results');
  console.log('PASS pow: exact +1 base, varied quietNaN/finite/infinite/zero exponents, unchanged other-base controls, public PE/IAT/x86, cdecl, FPU, GPRs, flags');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
