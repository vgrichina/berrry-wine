#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { makeFixture } = require('../tools/kernel32-native-fixture');
const { bootRenderHarness } = require('./render-helper');
const rows = require('../src/api_table.json');
let extraWat = `
  (func (export "test_last_error") (result i32) (global.get $last_error))
  (func (export "test_cached_dispatch") (param $address i32)
    (global.set $steps (i32.const 100))
    (call $th_thunk_call (i32.shr_u (i32.sub (local.get $address) (global.get $thunk_guest_base)) (i32.const 3))))
`;
for (const name of ['WriteProcessMemory', 'ReadProcessMemory', 'GetModuleHandleA', 'GetProcAddress', 'VirtualAlloc', 'VirtualProtect']) {
  const row = rows.find(r => r.name === name);
  extraWat += `
  (func (export "test_${name}") (param $a i32) (param $b i32) (param $c i32) (param $d i32) (param $e i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00430000))
    (call $gs32 (i32.const 0x00430014) (local.get $e))
    ${row ? `(call $handle_${row.handler || name} (local.get $a) (local.get $b) (local.get $c) (local.get $d) (local.get $e) (i32.const 0))` : '(i32.store (global.get $reg_base) (i32.const 0))'}
    (i32.load (global.get $reg_base)))`;
}
(async () => {
  const { exports: e, module, memory, host } = await bootRenderHarness({ extraWat, fonts: 'none', extraHostOverrides: { get_ticks: () => 777 } });
  const fixture = makeFixture();
  new Uint8Array(memory.buffer).set(fixture, e.get_staging());
  assert(e.load_pe(fixture.length));
  const bytes = (p, data) => [...data].forEach((v, i) => e.guest_write8(p + i, v));
  const string = s => { const p = e.guest_alloc(s.length + 1) >>> 0; bytes(p, Buffer.from(s + '\0')); return p; };
  const kernel = e.test_GetModuleHandleA(string('kernel32.dll')) >>> 0;
  assert(e.test_GetProcAddress(kernel, string('WriteProcessMemory')), 'WriteProcessMemory resolves');
  const alloc = n => e.guest_alloc(n) >>> 0;
  const src = alloc(64), dst = alloc(64), count = alloc(4), backup = alloc(16);
  bytes(src, [1, 2, 3, 4, 5, 6]);
  assert.strictEqual(e.test_WriteProcessMemory(-1, dst, src, 6, count), 1);
  assert.strictEqual(e.get_esp() >>> 0, 0x00430018, 'five-argument stdcall cleanup');
  assert.strictEqual(e.guest_read32(count), 6);
  assert.strictEqual(e.guest_read32(dst), 0x04030201);
  assert.strictEqual(e.test_ReadProcessMemory(-1, dst, backup, 6, count), 1);
  assert.strictEqual(e.guest_read32(backup), 0x04030201);
  assert.strictEqual(e.test_WriteProcessMemory(42, dst, src, 6, count), 0);
  assert.strictEqual(e.test_last_error(), 6);
  assert.strictEqual(e.guest_read32(count), 0);
  assert.strictEqual(e.test_WriteProcessMemory(-1, 0xfffffff0, src, 32, count), 0);
  assert.strictEqual(e.test_last_error(), 299);
  assert.strictEqual(e.test_WriteProcessMemory(-1, dst, 0, 6, count), 0);
  assert.strictEqual(e.test_WriteProcessMemory(-1, dst, src, 6, 0x70000000), 0);
  assert.strictEqual(e.test_last_error(), 998);
  assert.strictEqual(e.test_WriteProcessMemory(-1, 0, 0, 0, count), 1);
  const sparse = e.test_VirtualAlloc(0, 0x2000, 0x3000, 4) >>> 0;
  assert(sparse);
  assert.strictEqual(e.test_VirtualProtect(sparse + 0x1000, 0x1000, 2, count), 1);
  e.guest_write8(sparse + 0xfff, 99);
  assert.strictEqual(e.test_WriteProcessMemory(-1, sparse + 0xfff, src, 2, count), 0);
  assert.strictEqual(e.guest_read8(sparse + 0xfff), 99, 'no partial write across protected page');
  assert.strictEqual(e.guest_read32(count), 0);

  const tickEntry = e.test_GetProcAddress(kernel, string('GetTickCount')) >>> 0;
  assert(tickEntry);
  assert.strictEqual(e.guest_read8(tickEntry), 0xe9, 'KERNEL32 exports an actual x86 JMP');
  const nativeThunk = (tickEntry + 5 + e.guest_read32(tickEntry + 1)) >>> 0;
  assert.strictEqual(e.thunk_word(nativeThunk, 1), rows.find(r => r.name === 'GetTickCount').id);
  // Preserve the complete original thunk-hook coverage, and exercise the
  // same real call forms/cache invalidation on the new PE export entry too.
  for (const tick of [tickEntry, nativeThunk]) {
  const descriptor = [e.thunk_word(nativeThunk, 0), e.thunk_word(nativeThunk, 1)];
  assert.strictEqual(e.test_ReadProcessMemory(-1, tick, backup, 8, count), 1);
  const worker = (await WebAssembly.instantiate(module, { host })).exports;
  worker.init_thread(1, e.get_image_base(), e.get_code_start(), e.get_code_end(),
    e.get_thunk_base(), e.get_thunk_end(), e.get_num_thunks(), 0);
  const stack = alloc(256) + 128, hook = alloc(32), slot = alloc(4);
  e.guest_write32(slot, tick);
  bytes(hook, [0xb8, 0x39, 0x30, 0, 0, 0xc3]); // mov eax,12345; ret
  const callReg = Buffer.from([0xb9, 0, 0, 0, 0, 0xff, 0xd1, 0xc3]);
  callReg.writeUInt32LE(tick, 1);
  const callMem = Buffer.from([0xff, 0x15, 0, 0, 0, 0, 0xc3]); callMem.writeUInt32LE(slot, 2);
  const jumpReg = Buffer.from([0xb9, 0, 0, 0, 0, 0xff, 0xe1]); jumpReg.writeUInt32LE(tick, 1);
  const callers = [callReg, callMem, jumpReg].map(b => { const p = alloc(32); bytes(p, b); return p; });
  const rel = alloc(32), relBytes = Buffer.from([0xe8, 0, 0, 0, 0, 0xc3]);
  relBytes.writeInt32LE((tick - rel - 5) | 0, 1); bytes(rel, relBytes); callers.push(rel);
  const run = (guest, code) => {
    e.guest_write32(stack, 0); guest.set_esp(stack); guest.set_eip(code); guest.clear_yield();
    for (let i = 0; i < 8 && guest.get_eip(); i++) guest.run(100);
    assert.strictEqual(guest.get_eip(), 0, 'guest function returns');
    assert.strictEqual(guest.get_esp() >>> 0, stack + 4, 'hook preserves call stack');
    return guest.get_eax();
  };
  for (const code of callers) assert.strictEqual(run(e, code), 777, 'original API before patch');
  const patch = Buffer.from([0xe9, 0, 0, 0, 0]); patch.writeInt32LE((hook - tick - 5) | 0, 1); bytes(src, patch);
  assert.strictEqual(worker.test_WriteProcessMemory(-1, tick, src, 5, count), 1);
  assert.deepStrictEqual([e.thunk_word(nativeThunk, 0), e.thunk_word(nativeThunk, 1)], descriptor,
    'diagnostics retain original API identity while guest bytes contain a hook');
  for (const code of callers) {
    assert.strictEqual(run(e, code), 12345, 'already-decoded caller executes installed hook');
    assert.strictEqual(run(worker, code), 12345, 'Worker sees installed hook');
  }
  // The dedicated cached thunk opcode bypasses the CALL/JMP membership check.
  if (tick === nativeThunk) {
  e.guest_write32(stack, 0); e.set_esp(stack); e.test_cached_dispatch(tick);
  assert.strictEqual(e.get_eip() >>> 0, tick, 'cached dispatch redirects to visible guest bytes');
  e.clear_yield(); e.run(100); assert.strictEqual(e.get_eax(), 12345);
  }
  assert.strictEqual(e.test_WriteProcessMemory(-1, tick, backup, 5, count), 1);
  for (const code of callers) assert.strictEqual(run(worker, code), 777, 'restoring five bytes restores API');
  // Patches are decoded by the x86 engine, not an E9-only hook shortcut.
  bytes(src, [0xb8, 0x85, 0x1a, 0, 0, 0xc3]);
  assert.strictEqual(e.test_WriteProcessMemory(-1, tick, src, 6, count), 1);
  assert.strictEqual(run(e, callers[0]), 6789);
  assert.strictEqual(e.test_WriteProcessMemory(-1, tick, backup, 8, count), 1);
  assert.strictEqual(run(e, callers[0]), 777);
  }
  assert.strictEqual(e.test_WriteProcessMemory(-1, tickEntry, src, 6, count), 1);
  new Uint8Array(memory.buffer).set(fixture, e.get_staging());
  assert(e.load_pe(fixture.length));
  const reloadedKernel = e.test_GetModuleHandleA(string('kernel32.dll')) >>> 0;
  e.test_GetProcAddress(reloadedKernel, string('WriteProcessMemory'));
  const reloadedTick = e.test_GetProcAddress(reloadedKernel, string('GetTickCount')) >>> 0;
  assert.strictEqual(e.test_ReadProcessMemory(-1, reloadedTick, backup, 8, count), 1);
  assert.strictEqual(e.guest_read8(reloadedTick), 0xe9, 'new process discards patched KERNEL32 image');
  const reloadedThunk = (reloadedTick + 5 + e.guest_read32(reloadedTick + 1)) >>> 0;
  assert.strictEqual(e.thunk_word(reloadedThunk, 1), rows.find(r => r.name === 'GetTickCount').id,
    'reloaded image exposes a fresh native descriptor');
  const freshStack = e.guest_alloc(256) + 128;
  e.set_esp(freshStack); e.call_func(reloadedTick, 0, 0, 0, 0);
  for (let i = 0; i < 8 && e.get_eip(); i++) e.run(100);
  assert.strictEqual(e.get_eip(), 0); assert.strictEqual(e.get_eax(), 777);
  assert.strictEqual(e.get_esp() >>> 0, freshStack - 16, 'reloaded zero-argument API cleanup');
  console.log('PASS process-memory copy, protected-page failure, API hook/restore and shared cached callers');
})().catch(error => { console.error(error.stack || error); process.exit(1); });
