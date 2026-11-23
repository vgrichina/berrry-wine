'use strict';

const assert = require('node:assert/strict');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');

// Independent Microsoft contract and PRIMARY Scan 1 Make verified before oracle:
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-mapvirtualkeya
// https://learn.microsoft.com/en-us/windows/win32/inputdev/about-keyboard-input#scan-codes
// https://github.com/microsoft/Windows-driver-samples/blob/main/input/layout/kbdus/kbdus.c
// https://github.com/microsoft/win32metadata/blob/main/generation/WinSDK/RecompiledIdlHeaders/um/kbd.h
// US driver T1D/T2A/T36/T38 and E0 X1D/X38 select the six sided modifiers.
// Type 0 returns the scan byte; only type 4 retains E0 for right Ctrl/Alt.
const apis = ['MapVirtualKeyA', 'MapVirtualKeyW', 'MapVirtualKeyExA', 'MapVirtualKeyExW'];
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
  const b = Buffer.alloc(0x800), pe = 0x80, opt = pe + 24, section = opt + 0xe0;
  const u16 = (p, v) => b.writeUInt16LE(v, p), u32 = (p, v) => b.writeUInt32LE(v, p);
  u16(0, 0x5a4d); u32(0x3c, pe); u32(pe, 0x4550);
  u16(pe + 4, 0x14c); u16(pe + 6, 1); u16(pe + 20, 0xe0); u16(pe + 22, 0x10f);
  u16(opt, 0x10b); u32(opt + 4, 0x600); u32(opt + 16, 0x1000);
  u32(opt + 20, 0x1000); u32(opt + 28, 0x400000);
  u32(opt + 32, 0x1000); u32(opt + 36, 0x200);
  u32(opt + 56, 0x2000); u32(opt + 60, 0x200); u32(opt + 92, 16);
  u32(opt + 104, 0x1100); u32(opt + 108, 40);
  b.write('.text\0\0\0', section, 'ascii');
  u32(section + 8, 0x600); u32(section + 12, 0x1000);
  u32(section + 16, 0x600); u32(section + 20, 0x200); u32(section + 36, 0xe0000060);
  for (let i = 0; i < apis.length; i++) {
    const offset = 0x200 + i * 0x20;
    // LEA preserves flags; CALL supplies the real stdcall return address.
    b.set([0x8d, 0x64, 0x24, 4, 0xff, 0x15], offset);
    u32(offset + 6, 0x401160 + i * 4); b[offset + 10] = 0xe9;
    u32(offset + 11, (-(0x401000 + i * 0x20 + 15)) >>> 0);
    const name = 0x11a0 + i * 0x20;
    u32(0x340 + i * 4, name); u32(0x360 + i * 4, name);
    b.write(apis[i] + '\0', name - 0x1000 + 0x202, 'ascii');
  }
  u32(0x300, 0x1140); u32(0x30c, 0x1180); u32(0x310, 0x1160);
  b.write('USER32.dll\0', 0x380, 'ascii');
  return b;
}

async function main() {
  const wasm = compileSrcWasm((file, source) => file === '13-exports.wat' ? source + extra : source);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { exports: null, getMemory: () => memory.buffer };
  const { host } = createHostImports(ctx);
  const state = new Uint8Array(256);
  let hostReads = 0, hostWrites = 0;
  Object.assign(host, { memory, log: () => {}, log_i32: () => {}, exit: () => {},
    crash_unimplemented: () => { throw Error('unexpected unimplemented opcode'); },
    wait_multiple: () => 0, shell_execute: () => 33,
    get_key_state: vk => { hostReads++; return state[vk] || 0; },
    get_key_down_state: vk => { hostReads++; return state[vk] || 0; },
    set_key_down_state: (vk, value) => { hostWrites++; state[vk] = value; } });
  const { instance } = await WebAssembly.instantiate(wasm, { host });
  const e = ctx.exports = instance.exports, mem = new Uint8Array(memory.buffer);
  const dv = new DataView(memory.buffer), pe = makePe();
  mem.set(pe, e.get_staging()); assert.equal(e.load_pe(pe.length) >>> 0, 0x401000);
  for (let i = 0; i < apis.length; i++) {
    const thunk = e.guest_read32(0x401160 + i * 4) >>> 0;
    assert(thunk >= (e.get_thunk_base() >>> 0) && thunk < (e.get_thunk_base() >>> 0) + 0x40000, apis[i] + ' public USER32 IAT');
  }
  const g = p => e.guest_to_wasm(p) >>> 0, stackArea = 0x700000, guestState = 0x401400, output = 0x401510;
  const regs = ['eax', 'ecx', 'edx', 'ebx', 'ebp', 'esi', 'edi'];
  const seeds = regs.map((_, i) => 0x12345000 + i * 0x101);
  const bank = [19.25, -20.5, 21.75, -22.25, 23.5, -24.75, 25.125, -26.5];
  const flags = () => [e.get_flag_op(), e.get_flag_a(), e.get_flag_b(), e.get_flag_res(),
    e.get_flag_sign_shift(), e.test_saved_cf(), e.test_flags()];
  let calls = 0, mismatchCount = 0;
  const failures = [], mismatchesByApi = {};
  function check(api, code, type, expected, skew) {
    const label = JSON.stringify({ api, code, type, expected, skew, modifiers: Array.from(state) });
    const stack = stackArea + skew, entry = 0x401000 + apis.indexOf(api) * 0x20;
    const top = (calls + Math.floor(calls / controls.length)) % 8;
    const cw = 0x037f | ((Math.floor(calls / (controls.length * 8)) % 4) << 10);
    e.test_seed(top, cw); bank.forEach((v, i) => e.test_put(i, v));
    regs.forEach((r, i) => e['set_' + r](seeds[i]));
    mem.set(state, g(guestState)); mem.fill(0xa5, g(output), g(output) + 16);
    mem.fill(0xcd, g(stackArea) - 4, g(stackArea) + 48);
    const args = api.includes('Ex') ? [code, type, 0x04090409] : [code, type];
    args.forEach((v, i) => dv.setUint32(g(stack + 4 + i * 4), v, true));
    const savedStack = mem.slice(g(stackArea) - 4, g(stackArea) + 48);
    new DataView(savedStack.buffer, savedStack.byteOffset).setUint32(4 + skew, entry + 10, true);
    const savedFlags = flags(), tags = e.get_fpu_tags(), savedState = state.slice();
    assert(savedFlags[0] !== 0 && savedFlags[6] !== 0, 'nonzero lazy/condition flags');
    const reads = hostReads, writes = hostWrites;
    e.set_esp(stack); e.set_eip(entry); e.run(10000);
    assert.equal(e.get_eip(), 0, label + ' x86 return');
    assert.equal(e.get_esp(), stack + (api.includes('Ex') ? 16 : 12), label + ' stdcall ESP');
    assert.deepEqual(regs.slice(1).map(r => e['get_' + r]()), seeds.slice(1), label + ' six preserved GPRs');
    assert.deepEqual(flags(), savedFlags, label + ' lazy/condition flags');
    assert.equal(e.get_fpu_top(), top, label + ' TOP'); assert.equal(e.get_fpu_tags(), tags, label + ' tags');
    assert.equal(e.test_cw(), cw, label + ' CW'); assert.equal(e.get_fpu_sw(), 0x4700, label + ' SW');
    bank.forEach((v, i) => assert.equal(e.test_st(i), v, label + ' ST' + i));
    assert.deepEqual(mem.slice(g(stackArea) - 4, g(stackArea) + 48), savedStack, label + ' stack canaries/arguments/CALL frame');
    assert.deepEqual(mem.slice(g(guestState), g(guestState) + 256), savedState, label + ' guest keyboard state');
    assert.deepEqual(state, savedState, label + ' host keyboard state');
    assert.equal(hostReads, reads, label + ' no host state reads'); assert.equal(hostWrites, writes, label + ' no host state writes');
    assert(mem.slice(g(output), g(output) + 16).every(v => v === 0xa5), label + ' output canaries');
    const actual = e.get_eax() >>> 0;
    if (actual !== expected) {
      mismatchCount++; mismatchesByApi[api] = (mismatchesByApi[api] || 0) + 1;
      if (failures.length < 12) failures.push({ api, code, type, expected, actual });
    }
    calls++;
  }
  // Literal values from Microsoft, independent of the implementation.
  const controls = [];
  for (const [vk, scan, extended] of [
    [0xA0, 0x2A, 0x2A], [0xA1, 0x36, 0x36],
    [0xA2, 0x1D, 0x1D], [0xA3, 0x1D, 0xE01D],
    [0xA4, 0x38, 0x38], [0xA5, 0x38, 0xE038],
    [0x10, 0x2A, 0x2A], [0x11, 0x1D, 0x1D], [0x12, 0x38, 0x38],
  ]) controls.push([vk, 0, scan], [vk, 4, extended], [vk, 2, 0]);
  // Reverse translation distinguishes sides in type 3. The existing type 1
  // implementation accepts base scans only; preserve its extended-scan guard.
  for (const [scan, generic, sided] of [
    [0x2A, 0x10, 0xA0], [0x36, 0x10, 0xA1],
    [0x1D, 0x11, 0xA2], [0xE01D, 0x11, 0xA3],
    [0x38, 0x12, 0xA4], [0xE038, 0x12, 0xA5],
  ]) controls.push([scan, 1, scan > 0xFF ? 0 : generic], [scan, 3, sided]);
  // Full-width invalid inputs must not alias the new six-key range.
  for (const vk of [0xA0, 0xA1, 0xA2, 0xA3, 0xA4, 0xA5]) {
    for (const code of [vk + 0x100, vk + 0x10000, (0x80000000 + vk) >>> 0])
      controls.push([code, 0, 0], [code, 4, 0]);
    for (const type of [0x100, 0x104, 0x10004, 0xFFFFFFFF])
      controls.push([vk, type, 0]);
  }
  controls.push([0, 0, 0], [0x9F, 0, 0], [0xA6, 0, 0], [0xFF, 0, 0],
    [0x41, 0, 0x1E], [0x24, 0, 0x47], [0x24, 4, 0xE047],
    [0x90, 0, 0x45], [0x90, 4, 0xE045]);
  // Query results must be independent of held modifiers and lock toggles.
  for (const pattern of [0, 1, 0x80, 0x81]) {
    state.fill(0);
    for (const vk of [0x10, 0x11, 0x12, 0x14, 0x90, 0x91,
      0xA0, 0xA1, 0xA2, 0xA3, 0xA4, 0xA5]) state[vk] = pattern;
    for (const api of apis) for (const skew of [0, 4])
      for (const [code, type, expected] of controls) check(api, code, type, expected, skew);
  }
  console.log(JSON.stringify({ calls, mismatchCount, mismatchesByApi, firstMismatches: failures }, null, 2));
  assert.equal(mismatchCount, 0, 'independent literal sided type0 scans and type4 E0 distinction');
  console.log('PASS four public USER32 PE/IAT/x86 MapVirtualKey APIs: six sided and three generic modifiers, type0/type4/reverse, full-width guards, ESP/GPR/flags/FPU/canaries');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
