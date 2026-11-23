#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const { makeFixture, BASE, API, iat } = require('../tools/kernel32-native-fixture');

// Literal expectations, independent of the handler. Exact divisions deliberately
// avoid imposing a rounding/tie policy. The final three preserve truncation and
// the existing exact RichEdit sentinel exception.
const cases = [
  [2147483647, 2, 1, -1], [-2147483648, 2, 1, -1],
  [-2147483648, -1, 1, -1], [-2147483648, 1, -1, -1],
  [1073741824, 2, 1, -1], [-1073741825, 2, 1, -1],
  [2147483647, 2147483647, 1, -1],
  [-2147483648, -2147483648, 1, -1],
  [-2147483648, 2147483647, 1, -1],
  [2147483647, 1, 1, 2147483647], [-2147483648, 1, 1, -2147483648],
  [2147483647, 2, 2, 2147483647], [-2147483648, 2, 2, -2147483648],
  [2147483647, 2147483647, 2147483647, 2147483647],
  [-2147483648, -2147483648, -2147483648, -2147483648],
  [-2147483648, 2147483647, 2147483647, -2147483648],
  [2147483647, -2147483648, -2147483648, 2147483647],
  [1073741823, 2, 1, 2147483646], [-1073741824, 2, 1, -2147483648],
  [12, 15, 3, 60], [-12, 15, 3, -60], [12, -15, 3, -60],
  [12, 15, -3, -60], [-12, -15, 3, 60], [-12, 15, -3, 60],
  [12, -15, -3, 60], [-12, -15, -3, -60],
  [0, 2147483647, 1, 0], [-2147483648, 0, -1, 0],
  [0, 0, 0, -1], [12, 15, 0, -1], [-2147483648, -2147483648, 0, -1],
  [7, 1, 3, 2], [-7, 1, 3, -2], [32767, 96, 1440, 16],
  [32766, 96, 1440, 2184], [32767, 95, 1440, 2161],
];

(async () => {
  const h = await bootRenderHarness({ fonts: 'none' }), e = h.exports;
  const pe = makeFixture(), raw = rva => rva - 0x1000 + 0x200;
  const slot = BASE + 0x1900 + API.length * 4;
  assert.equal(pe.readUInt32LE(raw(slot - BASE)), 0);
  pe.writeUInt32LE(0x1c00, raw(slot - BASE));
  pe.write('MulDiv\0', raw(0x1c02));
  new Uint8Array(h.memory.buffer).set(pe, e.get_staging());
  assert(e.load_pe(pe.length));
  const stack = e.get_esp(), read = p => e.guest_read32(p) >>> 0;
  function call(pointer, args) {
    e.set_esp(stack); e.clear_yield();
    e.call_func(pointer, ...Array.from({ length: 4 }, (_, i) => args[i] || 0));
    const sp = e.get_esp();
    e.run(1000);
    assert.equal(e.get_eip(), 0, 'public guest call returned');
    assert.equal(e.get_esp(), sp + 4 * (args.length + 1), 'stdcall cleanup');
    return e.get_eax();
  }
  const api = (name, args = []) => call(read(iat(name)), args);
  function string(text) {
    const p = e.guest_alloc(text.length + 1);
    Buffer.from(text + '\0').forEach((b, i) => e.guest_write8(p + i, b));
    return p;
  }
  const kernel = api('LoadLibraryA', [string('KERNEL32.DLL')]) >>> 0;
  assert(kernel && kernel !== BASE);
  assert.equal(read(kernel) & 0xffff, 0x5a4d, 'real KERNEL32 PE');
  const entry = require('../src/kernel32-exports.json').exports.find(x => x.name === 'MulDiv');
  assert(entry, 'KERNEL32 public export identity');
  const dynamic = api('GetProcAddress', [kernel, string('MulDiv')]) >>> 0;
  const exp = kernel + read(kernel + read(kernel + 0x3c) + 120);
  const eat = kernel + read(kernel + read(exp + 28) + (entry.ordinal - read(exp + 16)) * 4);
  assert.equal(dynamic, eat, 'GetProcAddress resolves actual EAT');
  assert.equal(api('GetProcAddress', [kernel, entry.ordinal]) >>> 0, dynamic);
  assert.equal(e.guest_read8(dynamic), 0xe9, 'execute real export JMP');
  const imported = read(slot);
  assert(imported && imported !== 0x1c00, 'loader resolved static import');
  const regs = ['ecx', 'edx', 'ebx', 'ebp', 'esi', 'edi'];
  const flags = ['op', 'a', 'b', 'res', 'sign_shift'];
  const failures = [];
  let checks = 0;
  for (const pointer of [imported, dynamic]) {
    for (const [a, b, denominator, expected] of cases) {
      api('SetLastError', [1234]);
      e.test_shift(32, 4, -1985229329, 0, 1, -1); // Seed nonzero lazy flags, count zero.
      regs.forEach((r, i) => e['set_' + r](0x12345670 + i));
      const beforeRegs = regs.map(r => e['get_' + r]());
      const beforeFlags = flags.map(f => e['get_flag_' + f]());
      const beforeConditionFlags = e.test_shift_flags();
      const actual = call(pointer, [a, b, denominator]);
      assert.deepEqual(regs.map(r => e['get_' + r]()), beforeRegs, 'other registers');
      assert.deepEqual(flags.map(f => e['get_flag_' + f]()), beforeFlags, 'lazy flags');
      assert.equal(e.test_shift_flags(), beforeConditionFlags, 'condition flags');
      assert.equal(api('GetLastError'), 1234, 'last error unchanged');
      checks++;
      if (actual !== expected) failures.push({ a, b, denominator, expected, actual });
    }
  }
  h.hostCtx.stopAudio();
  assert.deepEqual(failures, [], 'signed overflow must return -1; literal results');
  console.log(`PASS MulDiv ${checks} public static/dynamic calls: signed bounds, products, overflow, signs, zero, sentinel, stdcall, registers and flags`);
})().catch(error => { console.error(error); process.exitCode = 1; });
