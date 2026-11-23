'use strict';

const assert = require('node:assert/strict');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');

// Microsoft primary contract verified before asserting these literals:
// US ausVK[0x45]=T45|KBDEXT|KBDMULTIVK. SDK T45=_EQ(NUMLOCK),
// _EQ(v4)=(VK_##v4), KBDEXT=0x0100, KBDMULTIVK=0x0200, VK_NUMLOCK=0x90.
// Type0 returns 0x45; type4 includes its extended prefix and returns 0xE045.
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-mapvirtualkeyexa
// https://raw.githubusercontent.com/microsoft/Windows-driver-samples/main/input/layout/kbdus/kbdus.c
// https://raw.githubusercontent.com/microsoft/win32metadata/main/generation/WinSDK/RecompiledIdlHeaders/um/kbd.h
// https://raw.githubusercontent.com/microsoft/win32metadata/main/generation/WinSDK/RecompiledIdlHeaders/um/WinUser.h
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
  // Exact new mapping plus literal existing compatibility; no masked aliases.
  const controls = [
    [0x90, 0, 0x45], [0x90, 4, 0xE045],
    [0x90, 1, 0], [0x90, 2, 0], [0x90, 3, 0],
    [0xE045, 1, 0], [0xE045, 3, 0],
    [0x8F, 0, 0], [0x8F, 4, 0],
    [0x190, 0, 0], [0x190, 4, 0], [0x10090, 0, 0], [0x10090, 4, 0],
    [0x80000090, 0, 0], [0x80000090, 4, 0], [0xFFFF0090, 0, 0], [0xFFFF0090, 4, 0],
    [0x90, 0x100, 0], [0x90, 0x104, 0], [0x90, 0x10004, 0],
    [0x90, 0x80000004, 0], [0x90, 0xFFFFFFFF, 0],
    [0x44, 1, 0x79], [0x44, 3, 0x79],
    [0x91, 0, 0x46], [0x91, 4, 0x46],
    [0x46, 1, 0x91], [0x46, 3, 0x91],
    [0x91, 1, 0], [0x91, 2, 0], [0x91, 3, 0],
    [0x92, 0, 0], [0x92, 4, 0],
    [0x191, 0, 0], [0x191, 4, 0], [0x10091, 0, 0], [0x10091, 4, 0],
    [0x80000091, 0, 0], [0x80000091, 4, 0], [0xFFFF0091, 0, 0], [0xFFFF0091, 4, 0],
    [0x91, 0x100, 0], [0x91, 0x104, 0], [0x91, 0x10004, 0],
    [0x91, 0x80000004, 0], [0x91, 0xFFFFFFFF, 0],
    [0x45, 1, 0x90], [0x47, 1, 0x67], [0x45, 3, 0x90], [0x47, 3, 0x67],
    [0x14, 0, 0x3A], [0x14, 4, 0x3A],
    [0x3A, 1, 0x14], [0x3A, 3, 0x14],
    [0x14, 1, 0x54], [0x14, 2, 0], [0x14, 3, 0x54],
    [0x13, 0, 0], [0x15, 0, 0], [0x13, 4, 0], [0x15, 4, 0],
    [0x114, 0, 0], [0x114, 4, 0], [0x10014, 0, 0], [0x10014, 4, 0],
    [0x80000014, 0, 0], [0x80000014, 4, 0], [0xFFFF0014, 0, 0], [0xFFFF0014, 4, 0],
    [0x14, 0x100, 0], [0x14, 0x104, 0], [0x14, 0x10004, 0],
    [0x14, 0x80000004, 0], [0x14, 0xFFFFFFFF, 0],
    [0x39, 1, 0x20], [0x3B, 1, 0x70], [0x39, 3, 0x20], [0x3B, 3, 0x70],
    [0xE11D, 3, 0x13],
    [0xE11D, 0, 0], [0xE11D, 1, 0], [0xE11D, 2, 0], [0xE11D, 4, 0],
    [0xE11C, 3, 0], [0xE11E, 3, 0], [0xE145, 3, 0],
    [0xE10D, 3, 0], [0xE11F, 3, 0],
    [0x1E11D, 3, 0], [0x100E11D, 3, 0], [0x8000E11D, 3, 0],
    [0xFFFFE11D, 3, 0], [0x111D, 3, 0], [0x011D, 3, 0], [0x1001D, 3, 0],
    [0xE11D, 0x103, 0], [0xE11D, 0x10003, 0],
    [0xE11D, 0x80000003, 0], [0xE11D, 0xFFFFFFFF, 0],
    [0x13, 0, 0], [0x13, 2, 0], [0x13, 4, 0],
    [0xE046, 3, 0x03], [0x0046, 1, 0x91], [0x0046, 3, 0x91],
    [0xE01C, 3, 0x0D], [0x1C, 1, 0x0D], [0x1C, 3, 0x0D],
    [0xE046, 1, 0], [0xE046, 0, 0], [0xE046, 2, 0], [0xE046, 4, 0],
    [0xE045, 3, 0], [0xE04A, 3, 0], [0xE146, 3, 0], [0x0146, 3, 0],
    [0x1E046, 3, 0], [0x100E046, 3, 0], [0x8000E046, 3, 0],
    [0xFFFFE046, 3, 0], [0x10046, 3, 0],
    [0xE046, 0x103, 0], [0xE046, 0x10003, 0],
    [0xE046, 0x80000003, 0], [0xE046, 0xFFFFFFFF, 0],
    [0x03, 0, 0x46], [0x03, 4, 0],
    [0xE01C, 1, 0], [0xE01C, 0, 0], [0xE01C, 2, 0], [0xE01C, 4, 0],
    [0x0D, 0, 0x1C], [0x0D, 2, 0x0D], [0x0D, 4, 0x1C],
    [0xE01B, 3, 0], [0xE01E, 3, 0], [0xE11C, 3, 0], [0x011C, 3, 0],
    [0x1E01C, 3, 0], [0x100E01C, 3, 0], [0x8000E01C, 3, 0],
    [0xFFFFE01C, 3, 0], [0xFFFFFFFF, 3, 0], [0x1001C, 3, 0],
    [0xE01C, 0x103, 0], [0xE01C, 0x10003, 0],
    [0xE01C, 0x80000003, 0], [0xE01C, 0xFFFFFFFF, 0],
    [0xE01D, 3, 0xA3], [0xE038, 3, 0xA5],
    [0xE035, 3, 0x6F], [0xE037, 3, 0x2C],
    [0xE05B, 3, 0x5B], [0xE05C, 3, 0x5C], [0xE05D, 3, 0x5D],
    [0xE047, 3, 0x24], [0xE048, 3, 0x26], [0xE049, 3, 0x21],
    [0xE04B, 3, 0x25], [0xE04D, 3, 0x27], [0xE04F, 3, 0x23],
    [0xE050, 3, 0x28], [0xE051, 3, 0x22], [0xE052, 3, 0x2D], [0xE053, 3, 0x2E],
    [0x1D, 1, 0x11], [0x1D, 3, 0xA2], [0x38, 1, 0x12], [0x38, 3, 0xA4],
    [0x41, 0, 0x1E], [0x41, 2, 0x41], [0x41, 4, 0x1E],
    [0x03, 2, 0x03], [0x6F, 4, 0xE035], [0x24, 4, 0xE047],
  ];
  for (const shift of [0, 1, 0x80, 0x81]) for (const ctrl of [0, 0x80])
    for (const alt of [0, 0x80]) for (const caps of [0, 1])
      for (const num of [0, 1, 0x80, 0x81]) {
        state.fill(0);
        for (const [vk, v] of [[0x10, shift], [0x11, ctrl], [0x12, alt], [0x14, caps], [0x90, num], [0x91, num]]) state[vk] = v;
        for (const api of apis) for (const skew of [0, 4])
          for (const [code, type, expected] of controls) check(api, code, type, expected, skew);
      }
  console.log(JSON.stringify({ calls, mismatchCount, mismatchesByApi, firstMismatches: failures }, null, 2));
  assert.equal(mismatchCount, 0, 'independent literal VK_NUMLOCK type0 scan45/type4 E045 and unchanged compatibility');
  console.log('PASS all four public USER32 PE/IAT/x86 MapVirtualKey APIs, NumLock scan, ScrollLock scan, CapsLock scan, Pause scan, Break scan, keypad Enter, modifiers/toggles, full-width controls, ESP+12/+16, seven GPR results, flags/FPU/canaries');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
