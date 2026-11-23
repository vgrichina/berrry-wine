#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');

// Real PE32 USER32 import, resolved by the loader. The x86 entry forwards
// its three stack arguments, calls the IAT, then returns with stdcall cleanup.
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
  b.set([0xff, 0x74, 0x24, 12, 0xff, 0x74, 0x24, 12, 0xff, 0x74, 0x24, 12,
    0xff, 0x15, 0x40, 0x11, 0x40, 0, 0xc2, 12, 0], 0x200);
  u32(0x300, 0x1130); u32(0x30c, 0x1180); u32(0x310, 0x1140);
  u32(0x330, 0x1190); u32(0x340, 0x1190);
  b.write('USER32.dll\0', 0x380, 'ascii'); b.write('GetKeyNameTextA\0', 0x392, 'ascii');
  return b;
}

// Capacity includes NUL per Microsoft's independently checked contract:
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getkeynametexta
// Zero capacity permits no writes. Negative sizes are rejected defensively,
// matching W; Microsoft does not explicitly define negative-size behavior.
// Only allocated valid buffers are tested. Unknown scan names and special-key
// spelling below preserve this runtime's published US mapping.
const alphabet = [
  [0x1e, 'A'], [0x30, 'B'], [0x2e, 'C'], [0x20, 'D'], [0x12, 'E'],
  [0x21, 'F'], [0x22, 'G'], [0x23, 'H'], [0x17, 'I'], [0x24, 'J'],
  [0x25, 'K'], [0x26, 'L'], [0x32, 'M'], [0x31, 'N'], [0x18, 'O'],
  [0x19, 'P'], [0x10, 'Q'], [0x13, 'R'], [0x1f, 'S'], [0x14, 'T'],
  [0x16, 'U'], [0x2f, 'V'], [0x11, 'W'], [0x2d, 'X'], [0x15, 'Y'], [0x2c, 'Z'],
];
const names = [
  ...alphabet.map(([scan, name]) => [scan << 16, name]),
  [0x00010000, 'Esc'], [0x000e0000, 'Backspace'], [0x000f0000, 'Tab'],
  [0x001c0000, 'Enter'], [0x001d0000, 'Ctrl'], [0x002a0000, 'Shift'],
  [0x00380000, 'Alt'], [0x00390000, 'Space'], [0x003a0000, 'Caps Lock'],
  [0x00450000, 'Num Lock'], [0x00460000, 'Scroll Lock'],
  [0x003b0000, 'F1'], [0x00440000, 'F10'], [0x00580000, 'F12'],
  [0x00370000, 'Num *'], [0x00470000, 'Num 7'], [0x00530000, 'Num .'],
  [0x01470000, 'Home'], [0x01490000, 'Page Up'], [0x01510000, 'Page Down'],
  [0x01480000, 'Up'], [0x01530000, 'Delete'],
  [0x00000000, '?'], [0x007f0000, '?'], [0x01ff0000, '?'],
];

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none' });
  const bytes = new Uint8Array(memory.buffer), pe = makePe();
  bytes.set(pe, e.get_staging());
  assert.equal(e.load_pe(pe.length) >>> 0, 0x401000, 'USER32 importing PE loads');
  const thunk = e.guest_read32(0x401140) >>> 0;
  assert.equal(thunk, e.get_thunk_base() >>> 0, 'loader resolves USER32 IAT');
  const api = require('../src/api_table.json').find(a => a.name === 'GetKeyNameTextA');
  assert.equal(api.nargs, 3);
  assert.equal(e.guest_read32(thunk + 4), api.id, 'public IAT selects A dispatch');
  const arena = e.guest_alloc(160) >>> 0, wa = e.guest_to_wasm(arena) >>> 0;
  const stack = 0x700000, regs = ['ecx', 'edx', 'ebx', 'ebp', 'esi', 'edi'];
  const flags = ['op', 'a', 'b', 'res', 'sign_shift'], failures = [];
  let calls = 0;
  for (const [lp, name] of names) for (const extra of [0, 0xe2000001]) {
    for (const size of [0, -1, -2, -2147483648, 1, 2, 64]) {
      const label = `${(lp | extra) >>> 0}/${name}/size=${size}`;
      const copied = size > 0 ? name.slice(0, size - 1) : '';
      // Compare EVERY byte, including unused capacity after NUL, against an
      // independent expected image. Neither padding nor overrun is permitted.
      bytes.fill(0xa5, wa, wa + 160);
      const expected = Buffer.from(bytes.subarray(wa, wa + 160));
      if (size > 0) { expected.write(copied, 32, 'ascii'); expected[32 + copied.length] = 0; }
      const args = [0, (lp | extra) >>> 0, arena + 32, size >>> 0, 0x13579bdf];
      args.forEach((v, i) => e.guest_write32(stack + 4 * i, v));
      e.test_shift(32, 4, -1985229329, 0, 1, -1);
      regs.forEach((reg, i) => e['set_' + reg](0x12345670 + i));
      const savedRegs = regs.map(r => e['get_' + r]());
      const savedFlags = flags.map(f => e['get_flag_' + f]());
      const conditions = e.test_shift_flags();
      assert(savedFlags.some(v => v !== 0) && conditions !== 0, 'nonzero flag fixture');
      e.set_esp(stack); e.set_eip(0x401000); e.run(10000);
      assert.equal(e.get_eip() >>> 0, 0, label + ' returned through x86 call');
      assert.equal(e.get_esp() >>> 0, stack + 16, label + ' stdcall');
      args.forEach((v, i) => assert.equal(e.guest_read32(stack + 4 * i) >>> 0, v, label + ' stack'));
      assert.deepEqual(regs.map(r => e['get_' + r]()), savedRegs, label + ' registers');
      assert.deepEqual(flags.map(f => e['get_flag_' + f]()), savedFlags, label + ' lazy flags');
      assert.equal(e.test_shift_flags(), conditions, label + ' condition flags');
      const actual = Buffer.from(bytes.subarray(wa, wa + 160));
      if (e.get_eax() !== copied.length || !actual.equals(expected))
        failures.push({ label, expectedReturn: copied.length, actualReturn: e.get_eax(),
          mismatches: [...actual.keys()].filter(i => actual[i] !== expected[i]) });
      calls++;
    }
  }
  console.log(JSON.stringify({ calls, failed: failures.length, failures }));
  assert.equal(failures.length, 0, 'literal prefixes/return/NUL and every buffer canary');
  console.log(`PASS ${calls} USER32 GetKeyNameTextA capacity public calls`);
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
