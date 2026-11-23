#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');

const STACK = 0x00700000;
// Minimal PE32 importing MSVCRT!atoi by name. Its x86 entry jumps through
// the loader-patched IAT, so the real import resolver and dispatch ABI run.
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
  b.set([0xff, 0x25, 0x40, 0x11, 0x40, 0], 0x200); // jmp [0x401140]
  u32(0x300, 0x1130); u32(0x30c, 0x1180); u32(0x310, 0x1140);
  u32(0x330, 0x1190); u32(0x340, 0x1190);
  b.write('MSVCRT.dll\0', 0x380, 'ascii'); b.write('atoi\0', 0x392, 'ascii');
  return b;
}

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none' });
  const pe = makePe();
  new Uint8Array(memory.buffer).set(pe, e.get_staging());
  assert.equal(e.load_pe(pe.length) >>> 0, 0x401000, 'MSVCRT importing PE loads');
  const arena = e.guest_alloc(256) >>> 0;
  const wa = e.guest_to_wasm(arena) >>> 0;
  const bytes = new Uint8Array(memory.buffer);
  assert.equal(e.guest_read32(0x401140) >>> 0, e.get_thunk_base() >>> 0,
    'public MSVCRT!atoi import resolves to production thunk');
  const api = require('../src/api_table.json').find(entry => entry.name === 'atoi');
  assert.equal(api.nargs, 1);
  assert.equal(api.convention, 'cdecl');
  assert.equal(e.guest_read32((e.get_thunk_base() >>> 0) + 4) >>> 0, api.id,
    'IAT thunk dispatches the atoi API');

  // Expected integers are literal contract values, independent of the parser.
  // Every input is a valid contiguous buffer, including bytes after its NUL.
  const cases = [
    ['empty then hidden digits', [0, 0x34, 0x32, 0], 0],
    ['spaces then NUL then hidden digits', [0x20, 0x20, 0, 0x34, 0x32, 0], 0],
    ['all whitespace then NUL then hidden signed digits', [9, 10, 11, 12, 13, 32, 0, 45, 55, 0], 0],
    ['positive', Buffer.from('12345\0'), 12345],
    ['negative', Buffer.from('-12345\0'), -12345],
    ['plus', Buffer.from('+27\0'), 27],
    ['zero', Buffer.from('0\0'), 0],
    ['negative zero', Buffer.from('-0\0'), 0],
    ['leading zeroes', Buffer.from('00042\0'), 42],
    ['trailing letters', Buffer.from('-42tail99\0'), -42],
    ['trailing space and digits', Buffer.from('12 34\0'), 12],
    ['trailing control', [49, 50, 1, 51, 0], 12],
    ['digits stop at NUL', [49, 50, 0, 51, 52, 0], 12],
    ['non-digit', Buffer.from('x123\0'), 0],
    ['sign only then hidden digits', [45, 0, 57, 0], 0],
    ['plus only then hidden digits', [43, 0, 57, 0], 0],
    ['sign then whitespace', Buffer.from('- 12\0'), 0],
    ['two signs', Buffer.from('+-12\0'), 0],
    ['decimal suffix', Buffer.from('12.5\0'), 12],
    ['hex prefix is decimal zero', Buffer.from('0x10\0'), 0],
    ['largest defined positive', Buffer.from('2147483647\0'), 2147483647],
    ['smallest defined negative', Buffer.from('-2147483648\0'), -2147483648],
  ];
  for (const ch of [9, 10, 11, 12, 13, 32]) {
    cases.push([`whitespace ${ch} before negative`, [ch, 45, 52, 50, 0], -42]);
    cases.push([`whitespace ${ch} only then hidden digits`, [ch, 0, 52, 50, 0], 0]);
  }
  // All remaining C0 controls and DEL must stop parsing, even before a sign.
  for (const ch of [...Array.from({ length: 33 }, (_, i) => i), 127]) {
    if ([9, 10, 11, 12, 13, 32].includes(ch)) continue;
    cases.push([`non-whitespace control ${ch}`, [ch, 52, 50, 0], 0]);
    cases.push([`non-whitespace control ${ch} before sign`, [32, ch, 45, 52, 50, 0], 0]);
  }
  for (const ch of [0x85, 0xa0, 0xff])
    cases.push([`non-C-locale byte ${ch}`, [ch, 52, 50, 0], 0]);

  const failures = [];
  for (const [label, input, expected] of cases) {
    bytes.fill(0xcd, wa, wa + 256);
    bytes.set(input, wa + 64);
    const before = Buffer.from(bytes.subarray(wa, wa + 256));
    e.guest_write32(STACK, 0); // interpreter return sentinel
    e.guest_write32(STACK + 4, arena + 64);
    e.guest_write32(STACK + 8, 0x13579bdf);
    const saved = { ebx: 0x12345678, ebp: 0x23456789, esi: 0x3456789a, edi: 0x456789ab };
    for (const [reg, value] of Object.entries(saved)) e[`set_${reg}`](value);
    e.set_esp(STACK);
    e.set_eip(0x401000);
    e.run(10000);
    assert.equal(e.get_eip() >>> 0, 0, `${label}: returned`);
    assert.equal(e.get_esp() >>> 0, STACK + 4, `${label}: cdecl pops return address only`);
    assert.equal(e.guest_read32(STACK + 4) >>> 0, arena + 64, `${label}: argument retained`);
    assert.equal(e.guest_read32(STACK + 8) >>> 0, 0x13579bdf, `${label}: stack canary`);
    for (const [reg, value] of Object.entries(saved))
      assert.equal(e[`get_${reg}`]() >>> 0, value, `${label}: preserved ${reg}`);
    assert.deepEqual(Buffer.from(bytes.subarray(wa, wa + 256)), before, `${label}: input/canaries unchanged`);
    const actual = e.get_eax() | 0;
    if (actual !== expected) failures.push({ label, input: [...input], expected, actual });
  }
  console.log(JSON.stringify({ cases: cases.length, failures }, null, 2));
  assert.equal(failures.length, 0, 'MSVCRT!atoi literal results');
  console.log(`PASS MSVCRT!atoi: ${cases.length} terminator/classification/parsing cases; cdecl and input preserved`);
})().catch(error => { console.error(error); process.exitCode = 1; });
