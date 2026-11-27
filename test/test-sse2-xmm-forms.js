#!/usr/bin/env node
'use strict';

// SSE2 XMM forms used by the GameMaker:Studio 1.4 runner (Spelunky Classic HD):
// each case loads xmm0/xmm1 from memory, runs one instruction, stores xmm0 and
// EAX, and compares the full 128 bits so a form that clobbers the upper lanes
// is caught as well as one that computes the wrong low lane.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');

const le32 = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24 & 255];
const f64words = (...ds) => {
  const buf = Buffer.alloc(ds.length * 8);
  ds.forEach((d, i) => buf.writeDoubleLE(d, i * 8));
  return Array.from({ length: ds.length * 2 }, (_, i) => buf.readUInt32LE(i * 4));
};
const f32bits = v => { const b = Buffer.alloc(4); b.writeFloatLE(v); return b.readUInt32LE(); };
const qwords = (...qs) => qs.flatMap(q => [Number(BigInt.asUintN(64, q) & 0xffffffffn), Number(BigInt.asUintN(64, q) >> 32n)]);

(async () => {
  const wasm = process.env.WINE_ASSEMBLY_WASM
    ? fs.readFileSync(process.env.WINE_ASSEMBLY_WASM) : compileSrcWasm();
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { exports: null, getMemory: () => memory.buffer };
  const { host } = createHostImports(ctx);
  Object.assign(host, { memory, log() {}, log_i32() {}, exit() {} });
  const { instance } = await WebAssembly.instantiate(wasm, { host });
  const e = ctx.exports = instance.exports;
  const exe = fs.readFileSync(path.join(__dirname, 'binaries/notepad.exe'));
  new Uint8Array(memory.buffer).set(exe, e.get_staging());
  e.load_pe(exe.length);
  const base = e.get_image_base();
  const A = base + 0x80000, B = A + 32, OUT = B + 32;
  let count = 0;

  // pre: bytes before the op (EAX setup); op: instruction bytes, where the
  // token 'M' is replaced by a [B] memory operand (ModRM 05 + disp32).
  function run(label, a, b, op, expect, { pre = [], eax } = {}) {
    a.forEach((v, i) => e.guest_write32(A + i * 4, v >>> 0));
    b.forEach((v, i) => e.guest_write32(B + i * 4, v >>> 0));
    const body = op.flatMap(x => (x === 'M' ? [0x05, ...le32(B)] : [x]));
    const code = [
      0x0f, 0x10, 0x05, ...le32(A),
      0x0f, 0x10, 0x0d, ...le32(B),
      ...pre, ...body,
      0x0f, 0x11, 0x05, ...le32(OUT),
      0xa3, ...le32(OUT + 16),
      0xc3,
    ];
    const pc = base + 0x1000 + count++ * 256, sp = base + 0xd00000;
    code.forEach((v, i) => e.guest_write8(pc + i, v));
    e.guest_write32(sp, 0); e.set_esp(sp); e.set_eip(pc); e.run(10000);
    assert.strictEqual(e.get_eip(), 0, `${label} returns`);
    assert.strictEqual(e.get_esp() >>> 0, sp + 4, `${label} stack`);
    if (expect) {
      assert.deepStrictEqual(Array.from({ length: 4 }, (_, i) => e.guest_read32(OUT + i * 4) >>> 0),
        expect.map(v => v >>> 0), `${label} xmm0`);
    }
    if (eax !== undefined) assert.strictEqual(e.guest_read32(OUT + 16) >>> 0, eax >>> 0, `${label} eax`);
  }

  const x = [0x11111111, 0x22222222, 0x33333333, 0x44444444];
  const y = [0x01020304, 0x80000000, 0xfffffff0, 0x00000007];

  for (const mem of [false, true]) {
    const src = mem ? 'M' : 0xc1;
    run(`ADDPD mem=${mem}`, f64words(1.5, -2), f64words(2.25, 8), [0x66, 0x0f, 0x58, src], f64words(3.75, 6));
    run(`MULPD mem=${mem}`, f64words(1.5, -2), f64words(4, 0.25), [0x66, 0x0f, 0x59, src], f64words(6, -0.5));
    run(`SUBPD mem=${mem}`, f64words(1.5, -2), f64words(4, 0.25), [0x66, 0x0f, 0x5c, src], f64words(-2.5, -2.25));
    run(`PADDQ mem=${mem}`, qwords(0xffffffffn, -1n), qwords(1n, 2n), [0x66, 0x0f, 0xd4, src], qwords(0x100000000n, 1n));
    run(`PSUBQ mem=${mem}`, qwords(0n, 5n), qwords(1n, 2n), [0x66, 0x0f, 0xfb, src], qwords(-1n, 3n));
    run(`PSUBD mem=${mem}`, [5, 0, 7, 0x80000000], [6, 1, 7, 1], [0x66, 0x0f, 0xfa, src], [0xffffffff, 0xffffffff, 0, 0x7fffffff]);
    run(`PCMPEQD mem=${mem}`, x, [0x11111111, 0, 0x33333333, 0], [0x66, 0x0f, 0x76, src], [0xffffffff, 0, 0xffffffff, 0]);
    run(`PMAXSW mem=${mem}`, [0x7fff8000, 0x00010002, 0, 0xffff0001], [0x80007fff, 0x00020001, 0xffff0000, 0x0000ffff],
      [0x66, 0x0f, 0xee, src], [0x7fff7fff, 0x00020002, 0, 0x00000001]);
    run(`PXOR mem=${mem}`, x, y, [0x66, 0x0f, 0xef, src], x.map((v, i) => v ^ y[i]));
    run(`PAND mem=${mem}`, x, y, [0x66, 0x0f, 0xdb, src], x.map((v, i) => v & y[i]));
    run(`PANDN mem=${mem}`, x, y, [0x66, 0x0f, 0xdf, src], x.map((v, i) => ~v & y[i]));
    run(`POR mem=${mem}`, x, y, [0x66, 0x0f, 0xeb, src], x.map((v, i) => v | y[i]));
    run(`UNPCKLPD mem=${mem}`, x, y, [0x66, 0x0f, 0x14, src], [x[0], x[1], y[0], y[1]]);
    run(`UNPCKHPD mem=${mem}`, x, y, [0x66, 0x0f, 0x15, src], [x[2], x[3], y[2], y[3]]);
    run(`PSHUFD mem=${mem}`, x, y, [0x66, 0x0f, 0x70, src, 0x1b], [y[3], y[2], y[1], y[0]]);
    run(`SHUFPD mem=${mem}`, x, y, [0x66, 0x0f, 0xc6, src, 0x01], [x[2], x[3], y[0], y[1]]);
    run(`MOVQ F3 mem=${mem}`, x, y, [0xf3, 0x0f, 0x7e, src], [y[0], y[1], 0, 0]);
    run(`SQRTSD mem=${mem}`, x, f64words(6.25, 99), [0xf2, 0x0f, 0x51, src], [...f64words(2.5), x[2], x[3]]);
    run(`CVTSD2SS mem=${mem}`, x, f64words(-1.5, 99), [0xf2, 0x0f, 0x5a, src], [f32bits(-1.5), x[1], x[2], x[3]]);
    run(`CMPSD lt mem=${mem}`, [...f64words(1), x[2], x[3]], f64words(2, 0), [0xf2, 0x0f, 0xc2, src, 0x01],
      [0xffffffff, 0xffffffff, x[2], x[3]]);
    run(`CMPSD unord mem=${mem}`, [...f64words(NaN), x[2], x[3]], f64words(2, 0), [0xf2, 0x0f, 0xc2, src, 0x03],
      [0xffffffff, 0xffffffff, x[2], x[3]]);
    run(`CVTTSD2SI mem=${mem}`, x, f64words(-2.75, 0), [0xf2, 0x0f, 0x2c, mem ? 'M' : 0xc1], null, { eax: -2 });
    run(`CVTSD2SI mem=${mem}`, x, f64words(2.5, 0), [0xf2, 0x0f, 0x2d, mem ? 'M' : 0xc1], null, { eax: 2 });
    run(`CVTTSD2SI overflow mem=${mem}`, x, f64words(3e9, 0), [0xf2, 0x0f, 0x2c, mem ? 'M' : 0xc1], null, { eax: 0x80000000 });
  }
  // CVTSI2SD from a register and from m32: only the low double changes.
  run('CVTSI2SD reg', x, y, [0xf2, 0x0f, 0x2a, 0xc0], [...f64words(-7), x[2], x[3]], { pre: [0xb8, ...le32(-7)] });
  run('CVTSI2SD m32', x, [-9, 0xdeadbeef, 0, 0], [0xf2, 0x0f, 0x2a, 'M'], [...f64words(-9), x[2], x[3]]);
  // PSRLQ/PSLLQ by immediate shift xmm0 itself (0F 73 /2 and /6, rm=xmm0).
  run('PSRLQ imm', qwords(0x8000000000000010n, 0xf0n), y, [0x66, 0x0f, 0x73, 0xd0, 4], qwords(0x0800000000000001n, 0xfn));
  run('PSLLQ imm', qwords(1n, 0x8000000000000001n), y, [0x66, 0x0f, 0x73, 0xf0, 1], qwords(2n, 2n));
  run('PSRLQ xmm count', qwords(0x100n, 0x80n), qwords(4n, 0n), [0x66, 0x0f, 0xd3, 0xc1], qwords(0x10n, 0x8n));
  run('PSLLQ xmm count', qwords(0x100n, 0x80n), qwords(64n, 0n), [0x66, 0x0f, 0xf3, 0xc1], qwords(0n, 0n));
  // PMOVMSKB eax, xmm1: the top bit of each of the 16 bytes.
  run('PMOVMSKB', x, [0x80000080, 0x00000000, 0x00800000, 0xffffffff], [0x66, 0x0f, 0xd7, 0xc1], null, { eax: 0xf409 });
  // MOVQ m64, xmm0 (66 0F D6) stores only the low qword.
  run('MOVQ store', x, [0, 0, 0xcafef00d, 0], [0x66, 0x0f, 0xd6, 'M'], x);
  assert.deepStrictEqual([e.guest_read32(B) >>> 0, e.guest_read32(B + 4) >>> 0, e.guest_read32(B + 8) >>> 0],
    [x[0], x[1], 0xcafef00d], 'MOVQ m64 store writes eight bytes');
  // COMISD sets ZF/PF/CF like FCOMI: read them back with SETB/SETZ/SETP.
  for (const [l, r, cf, zf, pf] of [[1, 2, 1, 0, 0], [2, 1, 0, 0, 0], [3, 3, 0, 1, 0], [NaN, 1, 1, 1, 1]]) {
    e.guest_write32(OUT + 20, 0xffffffff);
    run(`COMISD ${l},${r}`, f64words(l, 0), f64words(r, 0),
      [0x66, 0x0f, 0x2f, 0xc1, 0x0f, 0x92, 0xc0, 0x0f, 0x94, 0xc4, 0x0f, 0x9a, 0xc3, 0x88, 0x1d, ...le32(OUT + 20)],
      null, { pre: [0x31, 0xc0, 0x31, 0xdb], eax: cf | zf << 8 });
    assert.strictEqual(e.guest_read32(OUT + 20) & 0xff, pf, `COMISD ${l},${r} PF`);
    run(`UCOMISD ${l},${r}`, f64words(l, 0), f64words(r, 0),
      [0x66, 0x0f, 0x2e, 0xc1, 0x0f, 0x92, 0xc0, 0x0f, 0x94, 0xc4],
      null, { pre: [0x31, 0xc0], eax: cf | zf << 8 });
  }
  console.log(`test-sse2-xmm-forms: ${count} cases passed`);
})().catch(err => { console.error(err); process.exit(1); });
