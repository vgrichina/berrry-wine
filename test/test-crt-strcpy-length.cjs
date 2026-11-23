#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');

// Public MSVCRT/KERNEL32 imports, reached by guest x86 CALL [IAT].
function makePe() {
  const b = Buffer.alloc(0x1200), pe = 0x80, opt = pe + 24, section = opt + 0xe0;
  const u16 = (p, v) => b.writeUInt16LE(v, p);
  const u32 = (p, v) => b.writeUInt32LE(v, p);
  u16(0, 0x5a4d); u32(0x3c, pe); u32(pe, 0x4550);
  u16(pe + 4, 0x14c); u16(pe + 6, 1); u16(pe + 20, 0xe0); u16(pe + 22, 0x10f);
  u16(opt, 0x10b); u32(opt + 4, 0x1000); u32(opt + 16, 0x1000);
  u32(opt + 20, 0x1000); u32(opt + 28, 0x400000);
  u32(opt + 32, 0x1000); u32(opt + 36, 0x200);
  u32(opt + 56, 0x41000); u32(opt + 60, 0x200); u32(opt + 92, 16);
  u32(opt + 104, 0x1100); u32(opt + 108, 60);
  b.write('.text\0\0\0', section, 'ascii');
  u32(section + 8, 0x40000); u32(section + 12, 0x1000);
  u32(section + 16, 0x1000); u32(section + 20, 0x200); u32(section + 36, 0xe0000060);
  u32(0x300, 0x1180); u32(0x30c, 0x1200); u32(0x310, 0x11a0);
  u32(0x314, 0x1188); u32(0x320, 0x1210); u32(0x324, 0x11a8);
  b.write('MSVCRT.dll\0', 0x400, 'ascii'); b.write('KERNEL32.dll\0', 0x410, 'ascii');
  ['strcpy', 'HeapCreate', 'HeapAlloc', 'HeapFree', 'HeapDestroy'].forEach((name, i) => {
    const slot = i === 0 ? 0 : i + 1, rva = 0x1240 + i * 0x20;
    u32(0x380 + slot * 4, rva); u32(0x3a0 + slot * 4, rva);
    b.write(name + '\0', rva - 0xe00 + 2, 'ascii');
    const nargs = [2, 3, 3, 3, 1][i], code = [];
    for (let n = 0; n < nargs; n++) code.push(0xff, 0x74, 0x24, nargs * 4);
    code.push(0xff, 0x15, 0xa0 + slot * 4, 0x11, 0x40, 0);
    // Discard forwarded cdecl arguments without changing condition flags.
    if (i === 0) code.push(0x8d, 0x64, 0x24, 8, 0xc3);
    else code.push(0xc2, nargs * 4, 0);
    b.set(code, 0x200 + i * 32);
  });
  return b;
}

// Microsoft requires the full source including NUL and the original dest.
// https://learn.microsoft.com/en-us/cpp/c-runtime-library/reference/strcpy-wcscpy-mbscpy
// Independently spelled input and expected cycles include high, nonzero bytes.
const inputCycle = Buffer.from('A\x80z\xff09\x01Q', 'latin1');
const expectedCycle = [65, 128, 122, 255, 48, 57, 1, 81];
const lengths = [0, 1, 19, 65535, 65536, 65537, 70000];

(async () => {
  const h = await bootRenderHarness({ fonts: 'none' }), e = h.exports;
  try {
    const bytes = new Uint8Array(h.memory.buffer), pe = makePe(), stack = 0x700000;
    bytes.set(pe, e.get_staging());
    assert.equal(e.load_pe(pe.length) >>> 0, 0x401000);
    const slots = [0, 2, 3, 4, 5].map(i => e.guest_read32(0x4011a0 + i * 4) >>> 0);
    slots.forEach(p => assert(p >= (e.get_thunk_base() >>> 0), 'resolved public import'));
    assert.equal(new Set(slots).size, 5, 'distinct public IAT entries');
    function invoke(index, args, cleanup) {
      [0, ...args, 0x13579bdf].forEach((v, i) => e.guest_write32(stack + i * 4, v));
      e.set_esp(stack); e.set_eip(0x401000 + index * 32); e.run(10000);
      assert.equal(e.get_eip() >>> 0, 0, 'public wrapper returned');
      assert.equal(e.get_esp() >>> 0, stack + 4 + cleanup, 'public stack cleanup');
      return e.get_eax() >>> 0;
    }
    const heap = invoke(1, [0, 4096, 0], 12), capacity = 0x12000, guard = 37;
    assert(heap, 'private HeapCreate');
    const source = invoke(2, [heap, 0, capacity], 12);
    const destination = invoke(2, [heap, 0, capacity], 12);
    assert(source && destination, 'sufficient live HeapAlloc buffers');
    const regs = ['ecx', 'edx', 'ebx', 'ebp', 'esi', 'edi'];
    const flags = ['op', 'a', 'b', 'res', 'sign_shift'], failures = [], counts = {};
    for (const [kind, src, dst] of [['image', 0x402000, 0x418000], ['private', source, destination]]) {
      assert(src + capacity <= dst || dst + capacity <= src, 'nonoverlapping buffers');
      const sw = e.guest_to_wasm(src) >>> 0, dw = e.guest_to_wasm(dst) >>> 0;
      for (let i = 0; i < capacity; i++) {
        assert.equal(e.guest_to_wasm(src + i) >>> 0, sw + i, kind + ' contiguous source');
        assert.equal(e.guest_to_wasm(dst + i) >>> 0, dw + i, kind + ' contiguous destination');
      }
      counts[kind] = 0;
      for (const length of lengths) {
        const label = `${kind}/${length}`, input = src + guard, output = dst + guard;
        bytes.fill(0xb6, sw, sw + capacity);
        bytes.fill(0xcd, dw, dw + capacity);
        for (let i = 0; i < length; i++) bytes[sw + guard + i] = inputCycle[i % inputCycle.length];
        bytes[sw + guard + length] = 0;
        const before = Buffer.from(bytes.subarray(sw, sw + capacity));
        const args = [0, output, input, 0x13579bdf];
        args.forEach((v, i) => e.guest_write32(stack + i * 4, v));
        e.test_shift(32, 4, -1985229329, 0, 1, -1);
        regs.forEach((r, i) => e['set_' + r](0x12345670 + i));
        const savedRegs = regs.map(r => e['get_' + r]());
        const savedFlags = flags.map(f => e['get_flag_' + f]()), conditions = e.test_shift_flags();
        assert(savedFlags[0] && conditions, 'nonzero lazy/condition flags');
        e.set_esp(stack); e.set_eip(0x401000); e.run(10000);
        assert.equal(e.get_eip() >>> 0, 0, label + ' returned');
        assert.equal(e.get_esp() >>> 0, stack + 4, label + ' cdecl ESP+4');
        assert.equal(e.get_eax() >>> 0, output, label + ' original guest destination');
        args.forEach((v, i) => assert.equal(e.guest_read32(stack + i * 4) >>> 0, v >>> 0, label + ' arguments'));
        assert.deepEqual(regs.map(r => e['get_' + r]()), savedRegs, label + ' registers');
        assert.deepEqual(flags.map(f => e['get_flag_' + f]()), savedFlags, label + ' lazy flags');
        assert.equal(e.test_shift_flags(), conditions, label + ' condition flags');
        assert.deepEqual(Buffer.from(bytes.subarray(sw, sw + capacity)), before, label + ' unchanged source/all source canaries');
        let mismatches = 0, first = null;
        // Inspect EVERY byte, even on the intentionally failing old baseline.
        for (let i = 0; i < capacity; i++) {
          const relative = i - guard;
          const expected = relative < 0 || relative > length ? 0xcd
            : relative === length ? 0 : expectedCycle[relative % 8];
          const actual = bytes[dw + i];
          if (actual !== expected) {
            mismatches++;
            if (first === null) first = { relative, expected, actual };
          }
        }
        if (mismatches) failures.push({ label, mismatches, first, nul: bytes[dw + guard + length] });
        counts[kind]++;
      }
    }
    assert.equal(invoke(3, [heap, 0, source], 12), 1, 'HeapFree source');
    assert.equal(invoke(3, [heap, 0, destination], 12), 1, 'HeapFree destination');
    assert.equal(invoke(4, [heap], 4), 1, 'HeapDestroy private');
    console.log(JSON.stringify({ counts, lengths, expectedCycle, failures }, null, 2));
    assert.deepEqual(failures, [], 'every copied byte, NUL and outside destination canary');
    console.log('PASS strcpy public PE/IAT/x86: full length, image/private buffers, source/canaries, guest return, cdecl, registers, nonzero flags');
  } finally { h.hostCtx.stopAudio(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
