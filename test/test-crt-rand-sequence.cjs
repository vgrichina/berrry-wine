#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');

// Microsoft publishes this literal output for srand(1792):
// https://learn.microsoft.com/en-us/cpp/c-runtime-library/reference/rand?view=msvc-170
const microsoft10 = [5890, 1279, 19497, 1207, 11420, 3377, 15317, 29489, 9716, 23323];

function reference(seed, count) {
  let state = BigInt(seed);
  return Array.from({ length: count }, () => {
    state = (state * 214013n + 2531011n) % (1n << 32n);
    return Number((state >> 16n) & 32767n);
  });
}

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
  // rand: ordinary CALL [IAT]; RET. srand: forward seed, CALL, cdecl cleanup, RET.
  b.set([0xff, 0x15, 0x40, 0x11, 0x40, 0, 0xc3], 0x200);
  b.set([0xff, 0x74, 0x24, 4, 0xff, 0x15, 0x44, 0x11, 0x40, 0,
    0x8d, 0x64, 0x24, 4, 0xc3], 0x220);
  u32(0x300, 0x1130); u32(0x30c, 0x1180); u32(0x310, 0x1140);
  for (const p of [0x330, 0x340]) { u32(p, 0x1190); u32(p + 4, 0x11a0); }
  b.write('MSVCRT.dll\0', 0x380, 'ascii');
  b.write('rand\0', 0x392, 'ascii'); b.write('srand\0', 0x3a2, 'ascii');
  return b;
}

(async () => {
  assert.deepEqual(reference(1792, 10), microsoft10, 'independent reference matches Microsoft literals');
  const h = await bootRenderHarness({ fonts: 'none' }), e = h.exports;
  try {
    const pe = makePe();
    new Uint8Array(h.memory.buffer).set(pe, e.get_staging());
    assert.equal(e.load_pe(pe.length) >>> 0, 0x401000);
    for (const iat of [0x401140, 0x401144])
      assert((e.guest_read32(iat) >>> 0) >= (e.get_thunk_base() >>> 0), 'resolved MSVCRT IAT');
    const regs = ['ecx', 'edx', 'ebx', 'ebp', 'esi', 'edi'];
    const flags = ['op', 'a', 'b', 'res', 'sign_shift'], stack = 0x700000;
    let calls = 0;
    function call(seed) {
      const srand = seed !== undefined;
      e.guest_write32(stack, 0); e.guest_write32(stack + 4, srand ? seed : 0xaabbccdd);
      e.test_shift(32, 4, -1985229329, 0, 1, -1);
      regs.forEach((r, i) => e['set_' + r](0x12345670 + i));
      const savedRegs = regs.map(r => e['get_' + r]());
      const savedFlags = flags.map(f => e['get_flag_' + f]()), conditions = e.test_shift_flags();
      assert(savedFlags.some(v => v !== 0) && conditions !== 0, 'nonzero flags');
      e.set_esp(stack); e.set_eip(srand ? 0x401020 : 0x401000); e.run(10000);
      assert.equal(e.get_eip() >>> 0, 0, 'returned through x86 CALL/RET');
      assert.equal(e.get_esp() >>> 0, stack + 4, 'cdecl ESP+4');
      assert.deepEqual(regs.map(r => e['get_' + r]()), savedRegs, 'registers');
      assert.deepEqual(flags.map(f => e['get_flag_' + f]()), savedFlags, 'lazy flags');
      assert.equal(e.test_shift_flags(), conditions, 'condition flags');
      assert.equal(e.guest_read32(stack + 4) >>> 0, srand ? seed : 0xaabbccdd, 'argument/canary');
      calls++;
      return e.get_eax() >>> 0;
    }
    const failures = [];
    for (const seed of [1792, 0, 1, 0x7fffffff, 0x80000000, 0xffffffff]) {
      const expected = reference(seed, 512), sequences = [];
      for (let repeat = 0; repeat < 2; repeat++) {
        call(seed);
        const sequence = Array.from({ length: expected.length }, () => call());
        sequence.forEach((value, i) => {
          assert(value <= 32767, 'rand output range');
          const want = seed === 1792 && i < 10 ? microsoft10[i] : expected[i];
          if (value !== want) failures.push({ seed, repeat, index: i, expected: want, actual: value });
        });
        sequences.push(sequence);
      }
      assert.deepEqual(sequences[0], sequences[1], 'reseed reproduces seed ' + seed);
    }
    console.log(JSON.stringify({ calls, mismatchCount: failures.length, firstMismatches: failures.slice(0, 20) }, null, 2));
    assert.deepEqual(failures.slice(0, 20), [], 'Microsoft literal ten and unsigned BigInt sequences');
    console.log(`PASS rand ${calls} public calls: sequence, reseeding, range, cdecl, registers, flags`);
  } finally { h.hostCtx.stopAudio(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
