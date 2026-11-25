#!/usr/bin/env node
'use strict';
// --sse-fast (06c handlers 502-511) against $th_sse_rr, the handler they
// were cut out of: every form, register pairs including dst == src, on
// operands drawn from signed zeros, denormals, infinities, quiet /
// signalling / negative NaNs, round-to-even halves, values past float range
// and past int32 range, and random bits. Each case is decoded twice, at two
// fresh addresses, once with set_sse_fast(0) and once with (1); the XMM
// file, the GPRs and the flags (ZF, PF, CF via setcc) must come out
// byte-identical, and the fast run must have dispatched the form's dedicated
// handler (the handler histogram), so a selector that never fires fails.
//
//   WINE_ASSEMBLY_WASM=path  test another module (default build/wine-assembly.wasm)
const path = require('path');
const BL = require('../tools/bench-loops');

const d32 = (v) => [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];
const F32 = [0, 0x80000000, 0x3F800000, 0xBF800000, 0x3FC00000, 0x00011D7C, 0x80011D7C, 0x7F800000, 0xFF800000,
  0x7FC00000, 0x7F800001, 0xFFC00001, 0x4F32D05E, 0xCF000001, 0x3F000000, 0x40200000, 0x7F7FFFFF, 0x00000001];
const F64 = [0n, 0x8000000000000000n, 0x3FF0000000000000n, 0xBFF0000000000000n, 0x4004000000000000n,
  0x7FF0000000000000n, 0xFFF0000000000000n, 0x7FF8000000000000n, 0x7FF0000000000001n, 0xFFF8000000000001n,
  0x0000000000000001n, 0x800012D687E3D9A4n, 0x41E0000000000000n, 0x47EFFFFFE0000000n, 0x47F0000000000000n,
  0x36A0000000000000n, 0x3810000000000000n, 0x7FEFFFFFFFFFFFFFn];
const INTS = [0, 1, -1, 0x7FFFFFFF, -0x80000000, 16777217, -16777217, 0x40000001, 12345678];

// [name, prefix bytes, opcode, r/m is a GPR source?, dedicated handler]
const FORMS = [
  ['cvtss2sd', [0xF3], 0x5A, false, 502], ['cvtps2pd', [], 0x5A, false, 503], ['cvtsd2ss', [0xF2], 0x5A, false, 504],
  ['cvtpd2ps', [0x66], 0x5A, false, 505], ['addsd', [0xF2], 0x58, false, 506], ['mulsd', [0xF2], 0x59, false, 507],
  ['subsd', [0xF2], 0x5C, false, 508], ['comisd', [0x66], 0x2F, false, 509], ['ucomisd', [0x66], 0x2E, false, 509],
  ['cvtsi2ss', [0xF3], 0x2A, true, 510], ['cvtsi2sd', [0xF2], 0x2A, true, 511],
];

async function main() {
  if (!process.env.WINE_ASSEMBLY_WASM) BL.ensureBuilt();
  const inst = await (process.env.WINE_ASSEMBLY_WASM ? BL.newInstance(path.resolve(process.env.WINE_ASSEMBLY_WASM)) : BL.newInstance());
  const { e, mem, g2w } = inst;
  if (!e.set_sse_fast) throw new Error('module has no set_sse_fast export');
  const a = BL.layout(inst.imageBase, 0x10000);
  const dv = new DataView(mem.buffer, mem.byteOffset);
  const IN = a.buf, OUT = a.buf + 0x200;
  let x = 0x13579BDF;
  const rnd = () => (x = (Math.imul(x, 1103515245) + 12345) | 0) >>> 0;
  let slot = 0, cases = 0, fails = 0;
  const fail = [];
  const run = (bytes, fast) => {
    const at = a.code + 0x1000 * slot++;
    mem.set(bytes, g2w(at));
    e.set_sse_fast(fast);
    e.set_uop(0);
    e.set_esp(a.stackTop);
    dv.setUint32(g2w(a.stackTop), 0, true);
    e.set_eip(at);
    for (let k = 0; k < 100 && (e.get_eip() >>> 0) !== 0; k++) e.run(100000);
    if ((e.get_eip() >>> 0) !== 0) throw new Error('did not return: eip=0x' + (e.get_eip() >>> 0).toString(16) + ' at=0x' + at.toString(16) + ' yield=' + e.get_yield_reason() + ' blocks=' + e.get_last_run_blocks());
    return Buffer.from(mem.subarray(g2w(OUT), g2w(OUT) + 0xA0)).toString('hex');
  };
  const hist = (h) => new DataView(mem.buffer, mem.byteOffset).getUint32(g2w ? e.get_handler_hist_base() + 4 * h : 0, true);
  for (const [name, pfx, opc, gpr, want] of FORMS) {
    for (let t = 0; t < 48; t++) {
      // inputs: 8 XMM registers, two lanes each a f64 special or two f32 specials or random
      for (let k = 0; k < 8; k++) {
        for (let q = 0; q < 2; q++) {
          const at = g2w(IN + 16 * k + 8 * q), m = rnd() % 4;
          if (m === 0) dv.setBigUint64(at, F64[rnd() % F64.length], true);
          else if (m === 1) { dv.setUint32(at, F32[rnd() % F32.length], true); dv.setUint32(at + 4, F32[rnd() % F32.length], true); }
          else { dv.setUint32(at, rnd(), true); dv.setUint32(at + 4, rnd(), true); }
        }
      }
      const regs = [0, 1, 2, 3, 5, 6, 7].map(() => (rnd() % 3 ? INTS[rnd() % INTS.length] : rnd()) | 0);
      const dst = t % 8, src = (t % 3 === 0) ? dst : (t * 5 + 3) % 8;
      const srcReg = gpr ? [0, 1, 2, 3, 5, 6, 7][t % 7] : src;
      const code = [];
      for (let k = 0; k < 8; k++) code.push(0x0F, 0x10, 0x05 | (k << 3), ...d32(IN + 16 * k));   // movups xmmK, [IN+16K]
      [0, 1, 2, 3, null, 5, 6, 7].forEach((r, i) => { if (r !== null) code.push(0xB8 + r, ...d32(regs[i > 4 ? i - 1 : i])); });
      code.push(...pfx, 0x0F, opc, 0xC0 | (dst << 3) | srcReg);
      // ZF PF CF, then the XMM file and the GPRs
      code.push(0x0F, 0x94, 0x05, ...d32(OUT + 0x80), 0x0F, 0x9A, 0x05, ...d32(OUT + 0x81), 0x0F, 0x92, 0x05, ...d32(OUT + 0x82));
      for (let k = 0; k < 8; k++) code.push(0x0F, 0x11, 0x05 | (k << 3), ...d32(OUT + 16 * k));
      [0, 1, 2, 3, 5, 6, 7].forEach((r, i) => code.push(0x89, 0x05 | (r << 3), ...d32(OUT + 0x84 + 4 * i)));
      code.push(0xC3);
      mem.fill(0, g2w(OUT), g2w(OUT) + 0xA0);
      const ref = run(code, 0);
      mem.fill(0, g2w(OUT), g2w(OUT) + 0xA0);
      e.reset_handler_hist(); e.set_handler_hist_enabled(1);
      const got = run(code, 1);
      e.set_handler_hist_enabled(0);
      if (hist(want) !== 1) { fails++; if (fail.length < 8) fail.push(`${name} t=${t}: handler ${want} ran ${hist(want)} times`); }
      cases++;
      if (ref !== got) { fails++; if (fail.length < 8) fail.push(`${name} t=${t} dst=${dst} src=${srcReg}\n  ref ${ref}\n  got ${got}`); }
    }
  }
  e.set_sse_fast(0);
  if (fails) { console.log(fail.join('\n')); console.log(`FAIL: ${fails}/${cases}`); process.exit(1); }
  console.log(`sse-fast handlers: ${cases} cases over ${FORMS.length} forms identical to $th_sse_rr. PASS`);
}
main().catch((err) => { console.error(err.stack || String(err)); process.exit(1); });
