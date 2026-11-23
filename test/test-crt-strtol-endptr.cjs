#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');

// A PE32 imports both CRT exports; each entry jumps through its resolved IAT.
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
  b.set([0xff, 0x25, 0x40, 0x11, 0x40, 0], 0x200);
  b.set([0xff, 0x25, 0x44, 0x11, 0x40, 0], 0x210);
  u32(0x300, 0x1130); u32(0x30c, 0x1180); u32(0x310, 0x1140);
  u32(0x330, 0x1190); u32(0x334, 0x11a0);
  u32(0x340, 0x1190); u32(0x344, 0x11a0);
  b.write('MSVCRT.dll\0', 0x380, 'ascii');
  b.write('strtol\0', 0x392, 'ascii'); b.write('strtoul\0', 0x3a2, 'ascii');
  return b;
}

// Literal [text, base, value, consumed] rows. No host parser supplies the oracle.
const signed = [
  ['', 10, 0, 0], [' \t\r\n\v\f', 0, 0, 0], ['+', 10, 0, 0], ['-', 16, 0, 0],
  ['  +', 0, 0, 0], ['\t-', 8, 0, 0], ['  xyz', 10, 0, 0], [' \t- g', 16, 0, 0],
  ['  +?12', 36, 0, 0], ['  2', 2, 0, 0], ['  +-1', 10, 0, 0],
  ['42tail', 10, 42, 2], [' \t-42!', 10, -42, 5], ['+123', 0, 123, 4],
  ['0779', 0, 63, 3], ['-077!', 8, -63, 4], ['09', 0, 0, 1],
  ['0x2a!', 0, 42, 4], [' \t-0X2A!', 16, -42, 7], ['0XfF', 0, 255, 4],
  ['10102', 2, 10, 4], ['zZ!', 36, 1295, 2], ['+Z', 36, 35, 2],
  ['2147483647', 10, 2147483647, 10], ['-2147483648', 10, -2147483648, 11],
  ['0x', 0, 0, 1], ['0xg', 0, 0, 1], ['+0xg', 0, 0, 2], ['  -0Xg', 16, 0, 4],
  ['0X', 16, 0, 1], ['0xg', 16, 0, 1], ['+0xg', 16, 0, 2],
  ['0x10', 10, 0, 1], ['0xg', 36, 1204, 3], ['-0', 0, 0, 2],
  ['12\x0134', 10, 12, 2], ['12\0' + '34', 10, 12, 2], ['\0' + '42', 10, 0, 0],
];
const unsigned = [
  ['', 0, 0, 0], ['\t\n\v\f\r ', 10, 0, 0], ['-', 10, 0, 0], ['+', 36, 0, 0],
  ['  -', 0, 0, 0], [' \t+', 16, 0, 0], ['  nope', 10, 0, 0], ['  +g', 16, 0, 0],
  ['  -?7', 8, 0, 0], ['  8', 8, 0, 0], ['  --1', 10, 0, 0],
  ['123!', 10, 123, 3], [' \t+42!', 0, 42, 5], ['-1', 10, 4294967295, 2],
  ['0758', 0, 61, 3], ['+17!', 8, 15, 3], ['08', 0, 0, 1],
  ['0X2b!', 0, 43, 4], ['  +0xF!', 16, 15, 6], ['ff!', 16, 255, 2],
  ['11102', 2, 14, 4], ['Zz!', 36, 1295, 2], ['10!', 36, 36, 2],
  ['4294967295', 10, 4294967295, 10], ['0xffffffff', 0, 4294967295, 10],
  ['0x', 0, 0, 1], ['0Xg', 0, 0, 1], ['+0xg', 0, 0, 2], ['  -0xg', 16, 0, 4],
  ['0x', 16, 0, 1], ['0xg', 16, 0, 1], ['+0Xg', 16, 0, 2],
  ['0x10', 8, 0, 1], ['0xg', 36, 1204, 3], ['-0', 0, 0, 2],
  ['34\x0156', 10, 34, 2], ['34\0' + '56', 10, 34, 2], [' \0' + '42', 10, 0, 0],
];

(async () => {
  const h = await bootRenderHarness({ fonts: 'none' }), e = h.exports;
  try {
    const pe = makePe(), bytes = new Uint8Array(h.memory.buffer);
    bytes.set(pe, e.get_staging());
    assert.equal(e.load_pe(pe.length) >>> 0, 0x401000);
    const first = e.guest_read32(0x401140) >>> 0, second = e.guest_read32(0x401144) >>> 0;
    assert(first >= (e.get_thunk_base() >>> 0), 'strtol IAT resolved');
    assert(second >= (e.get_thunk_base() >>> 0) && first !== second, 'distinct strtoul IAT resolved');
    const arena = e.guest_alloc(256) >>> 0, wa = e.guest_to_wasm(arena) >>> 0;
    const stack = 0x700000, regs = ['ecx', 'edx', 'ebx', 'ebp', 'esi', 'edi'];
    const flags = ['op', 'a', 'b', 'res', 'sign_shift'], failures = [];
    let calls = 0;
    for (const [name, entry, rows] of [['strtol', 0x401000, signed], ['strtoul', 0x401010, unsigned]]) {
      for (const [text, base, expected, consumed] of rows) for (const withEnd of [true, false]) {
        const label = `${name} ${JSON.stringify(text)} base=${base} end=${withEnd}`;
        bytes.fill(0xcd, wa, wa + 256);
        bytes.set(Buffer.from(text + '\0', 'latin1'), wa + 64);
        const before = Buffer.from(bytes.subarray(wa, wa + 256));
        const args = [0, arena + 64, withEnd ? arena + 192 : 0, base, 0x13579bdf];
        args.forEach((v, i) => e.guest_write32(stack + i * 4, v));
        e.test_shift(32, 4, -1985229329, 0, 1, -1);
        regs.forEach((r, i) => e['set_' + r](0x12345670 + i));
        const savedRegs = regs.map(r => e['get_' + r]());
        const savedFlags = flags.map(f => e['get_flag_' + f]()), conditions = e.test_shift_flags();
        e.set_esp(stack); e.set_eip(entry); e.run(10000);
        assert.equal(e.get_eip() >>> 0, 0, label + ' returned');
        assert.equal(e.get_esp() >>> 0, stack + 4, label + ' cdecl');
        args.forEach((v, i) => assert.equal(e.guest_read32(stack + i * 4) >>> 0, v >>> 0, label + ' stack'));
        assert.deepEqual(regs.map(r => e['get_' + r]()), savedRegs, label + ' registers');
        assert.deepEqual(flags.map(f => e['get_flag_' + f]()), savedFlags, label + ' lazy flags');
        assert.equal(e.test_shift_flags(), conditions, label + ' condition flags');
        const actual = name === 'strtol' ? e.get_eax() | 0 : e.get_eax() >>> 0;
        const end = withEnd ? e.guest_read32(arena + 192) >>> 0 : null;
        if (actual !== expected || (withEnd && end !== arena + 64 + consumed))
          failures.push({ label, expected, actual, expectedOffset: consumed, actualOffset: end === null ? null : end - arena - 64 });
        // Ignore only the authorized four-byte output when checking every byte.
        const after = Buffer.from(bytes.subarray(wa, wa + 256));
        if (withEnd) before.copy(after, 192, 192, 196);
        assert.deepEqual(after, before, label + ' input/output canaries');
        calls++;
      }
    }
    console.log(JSON.stringify({ calls, failures }, null, 2));
    assert.deepEqual(failures, [], 'CRT literal value/endptr matrices');
    console.log(`PASS strtol/strtoul ${calls} calls: literal results/endptr, NULL output, cdecl, registers, flags, canaries`);
  } finally { h.hostCtx.stopAudio(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
