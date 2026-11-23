'use strict';

const assert = require('node:assert/strict');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');

// Microsoft US layout: aVkToWch1 has literal NUMPAD0..9 (plain only),
// aVkToWch2 has DECIMAL '.' in plain/Shift, all with attribute 0.
// https://raw.githubusercontent.com/microsoft/Windows-driver-samples/main/input/layout/kbdus/kbdus.c
// These are supplied literal VKs, independent of physical NumLock mapping.
// Unsupported modifier combinations retain no translation and no output write.
const keypad = [
  [0x60, 0x30], [0x61, 0x31], [0x62, 0x32], [0x63, 0x33],
  [0x64, 0x34], [0x65, 0x35], [0x66, 0x36], [0x67, 0x37],
  [0x68, 0x38], [0x69, 0x39], [0x6e, 0x2e],
];
const extra = `
(func (export "test_seed") (param $top i32) (param $cw i32)
 (call $fpu_reset (local.get $cw))
 (global.set $fpu_top (local.get $top)) (global.set $fpu_sw (i32.const 0x4700))
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
  for (const [offset, iat] of [[0x200, 0x401140], [0x220, 0x401144]]) {
    // LEA ESP,[ESP+4]; CALL [IAT]; JMP 0. CALL's entry frame is the
    // original ESP; the terminal JMP exposes exactly the API's stdcall pop.
    b.set([0x8d, 0x64, 0x24, 4, 0xff, 0x15], offset);
    u32(offset + 6, iat); b[offset + 10] = 0xe9;
    u32(offset + 11, (-(0x401000 + offset - 0x200 + 15)) >>> 0);
  }
  u32(0x300, 0x1130); u32(0x30c, 0x1180); u32(0x310, 0x1140);
  u32(0x330, 0x1190); u32(0x334, 0x11a0);
  u32(0x340, 0x1190); u32(0x344, 0x11a0);
  b.write('USER32.dll\0', 0x380, 'ascii');
  b.write('ToAscii\0', 0x392, 'ascii'); b.write('ToAsciiEx\0', 0x3a2, 'ascii');
  return b;
}

async function main() {
  const wasm = compileSrcWasm((file, source) => file === '13-exports.wat' ? source + extra : source);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { exports: null, getMemory: () => memory.buffer };
  const { host } = createHostImports(ctx);
  Object.assign(host, { memory, log: () => {}, log_i32: () => {}, exit: () => {},
    crash_unimplemented: () => { throw Error('unexpected unimplemented opcode'); },
    wait_multiple: () => 0, shell_execute: () => 33 });
  const { instance } = await WebAssembly.instantiate(wasm, { host });
  const e = ctx.exports = instance.exports, mem = new Uint8Array(memory.buffer);
  const dv = new DataView(memory.buffer), pe = makePe();
  mem.set(pe, e.get_staging()); assert.equal(e.load_pe(pe.length) >>> 0, 0x401000);
  for (const address of [0x401140, 0x401144]) {
    const thunk = e.guest_read32(address) >>> 0;
    assert(thunk >= (e.get_thunk_base() >>> 0) && thunk < (e.get_thunk_base() >>> 0) + 0x40000, 'public USER32 IAT');
  }
  const g = p => e.guest_to_wasm(p) >>> 0, stack = 0x700000;
  const state = 0x401200, output = 0x401310;
  const regs = ['eax', 'ecx', 'edx', 'ebx', 'ebp', 'esi', 'edi'];
  const seeds = regs.map((_, i) => 0x12345000 + i * 0x101);
  const bank = [19.25, -20.5, 21.75, -22.25, 23.5, -24.75, 25.125, -26.5];
  const flags = () => [e.get_flag_op(), e.get_flag_a(), e.get_flag_b(), e.get_flag_res(),
    e.get_flag_sign_shift(), e.test_saved_cf(), e.test_flags()];
  const failures = [];
  const mismatchesByVk = {};
  let calls = 0, mismatchCount = 0, translated = 0, unsupported = 0;
  function check(api, vk, shift, ctrl, alt, caps, num, expected) {
    const label = JSON.stringify({ api, vk, shift, ctrl, alt, caps, num, expected });
    const top = calls % 8, cw = 0x037f | ((Math.floor(calls / 8) % 4) << 10);
    e.test_seed(top, cw); bank.forEach((v, i) => e.test_put(i, v));
    regs.forEach((r, i) => e['set_' + r](seeds[i]));
    mem.fill(0, g(state), g(state) + 256);
    for (const [key, value] of [[0x10, shift], [0x11, ctrl], [0x12, alt], [0x14, caps], [0x90, num]])
      mem[g(state) + key] = value;
    const beforeState = mem.slice(g(state), g(state) + 256);
    mem.fill(0xa5, g(output), g(output) + 8);
    mem.fill(0xcd, g(stack) - 4, g(stack) + 36);
    const entry = api === 'ToAscii' ? 0x401000 : 0x401020;
    const args = [vk, 0, state, output + 2, 0, 0x04090409];
    args.slice(0, api === 'ToAscii' ? 5 : 6).forEach((v, i) => dv.setUint32(g(stack + 4 + i * 4), v, true));
    const beforeArgs = mem.slice(g(stack) + 4, g(stack) + 36), savedFlags = flags();
    assert(savedFlags[0] !== 0 && savedFlags[6] !== 0, 'nonzero lazy/condition flags');
    const tags = e.get_fpu_tags();
    e.set_esp(stack); e.set_eip(entry); e.run(10000);
    assert.equal(e.get_eip(), 0, label + ' x86 return');
    assert.equal(e.get_esp(), stack + (api === 'ToAscii' ? 24 : 28), label + ' stdcall ESP');
    // EAX is the return value; all six other GPRs retain their distinct seeds.
    assert.deepEqual(regs.slice(1).map(r => e['get_' + r]()), seeds.slice(1), label + ' six preserved GPRs');
    assert.deepEqual(flags(), savedFlags, label + ' lazy/condition flags');
    assert.equal(e.get_fpu_top(), top, label + ' TOP'); assert.equal(e.get_fpu_tags(), tags, label + ' tags');
    assert.equal(e.test_cw(), cw, label + ' CW'); assert.equal(e.get_fpu_sw(), 0x4700, label + ' SW');
    bank.forEach((v, i) => assert.equal(e.test_st(i), v, label + ' ST' + i));
    assert.deepEqual(mem.slice(g(state), g(state) + 256), beforeState, label + ' keyboard state');
    assert.deepEqual(mem.slice(g(stack) + 4, g(stack) + 36), beforeArgs, label + ' args/suffix');
    assert.equal(dv.getUint32(g(stack) - 4, true), 0xcdcdcdcd, label + ' stack prefix');
    assert.equal(dv.getUint32(g(stack), true), entry + 10, label + ' real x86 CALL return address');
    const actual = dv.getUint16(g(output) + 2, true), returned = e.get_eax();
    const count = expected === null ? 0 : 1, word = expected === null ? 0xa5a5 : expected;
    if (returned !== count || actual !== word) {
      mismatchCount++;
      mismatchesByVk[vk] = (mismatchesByVk[vk] || 0) + 1;
      if (failures.length < 20) failures.push({ label, returned, actual, count, word });
    }
    for (const i of [0, 1, 4, 5, 6, 7]) assert.equal(mem[g(output) + i], 0xa5, label + ' output canary');
    calls++; if (expected === null) unsupported++; else translated++;
  }
  for (const api of ['ToAscii', 'ToAsciiEx']) {
    for (const [vk, literal] of keypad)
      for (const shift of [0, 1, 0x7f, 0x80, 0x81])
        for (const ctrl of [0, 1, 0x7f, 0x80, 0x81])
          for (const alt of [0, 1, 0x7f, 0x80, 0x81])
            for (const caps of [0, 1, 0x80, 0x81])
              for (const num of [0, 1, 0x80, 0x81]) {
                const supported = !(ctrl & 0x80) && !(alt & 0x80) && (vk === 0x6e || !(shift & 0x80));
                check(api, vk, shift, ctrl, alt, caps, num, supported ? literal : null);
              }
    // Independent controls for existing operator, letter and control branches.
    for (const [vk, shift, ctrl, alt, caps, expected] of [
      [0x6a, 0, 0, 0, 0, 0x2a], [0x6b, 0x80, 0, 0, 1, 0x2b],
      [0x6d, 0, 0x80, 0x80, 1, 0x2d], [0x6f, 0x80, 0x80, 0x80, 0, 0x2f],
      [0x41, 0, 0, 0, 0, 0x61], [0x41, 0x80, 0, 0, 0, 0x41],
      [0x5a, 0, 0x80, 0, 1, 0x1a], [0x41, 0x80, 0x80, 0, 1, 0x01],
      [0x0d, 0, 0x80, 0, 0, 0x0a], [0x08, 0, 0x80, 0, 0, 0x7f],
      [0x32, 0x80, 0x80, 0, 0, 0], [0x03, 0x80, 0x80, 0, 0, null],
      [0x5f, 0, 0, 0, 0, null], [0x6c, 0, 0, 0, 0, null], [0x70, 0, 0, 0, 0, null],
    ]) check(api, vk, shift, ctrl, alt, caps, 0, expected);
  }
  console.log(JSON.stringify({ calls, translated, unsupported, mismatchCount, mismatchesByVk, firstMismatches: failures }, null, 2));
  assert.equal(mismatchCount, 0, 'literal US keypad count/WORD results');
  console.log('PASS public USER32 PE/IAT/x86 ToAscii/ToAsciiEx keypad digits/decimal, modifier/toggle controls, ESP+24/+28, seven GPR results, flags and FPU');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
