#!/usr/bin/env node
'use strict';

// Semantic regression for UE1 SoftDrv's MMX surface clear,
//
//   movq [edi],mm0 / add edi,8 / dec ecx / jnz body
//
// (Deus Ex demo softdrv+0x10d3ed70, 24.6% of all block entries in its 3D logo
// window; Unreal SE softdrv+0x10931ed0/+0x10931ff0.) The H419 op 0x80000005
// lowering must agree with ordinary x86 on the filled bytes, EDI/ECX, every
// arithmetic flag and the MMX file for: aligned and unaligned fills, fills
// across several pages with qwords straddling each page edge, other register
// assignments, a single iteration, an unmapped destination, a fill that
// rewrites previously decoded code, a fill that rewrites the loop's own
// bytes, and --branch-clock budget stops. Near-miss encodings must not match.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

const EXTRA_WAT = `
  (func (export "test_fill_matches") (result i32) (global.get $mmx_fill64_matches))
  (func (export "test_fill_runs") (result i32) (global.get $mmx_fill64_runs))
  (func (export "test_fill_qwords") (result i64) (global.get $mmx_fill64_qwords))
  (func (export "test_fill_bulk") (result i64) (global.get $mmx_fill64_bulk_qwords))
  (func (export "test_mmx_get") (param $i i32) (result i64) (call $mmx_get (local.get $i)))
  (func (export "test_mmx_set") (param $i i32) (param $v i64) (call $mmx_set (local.get $i) (local.get $v)))
  (func (export "test_flags") (result i32)
    (i32.or (call $get_cf)
      (i32.or (i32.shl (call $get_zf) (i32.const 1))
        (i32.or (i32.shl (call $get_sf) (i32.const 2))
          (i32.or (i32.shl (call $get_of) (i32.const 3))
                  (i32.shl (call $get_pf) (i32.const 4)))))))
`;

// movq [edi],mm0 / add edi,8 / dec ecx / jnz -9 / ret
const DX_LOOP = [0x0f, 0x7f, 0x07, 0x83, 0xc7, 0x08, 0x49, 0x75, 0xf7, 0xc3];
// movq [esi],mm3 / add esi,8 / dec edx / jnz -9 / ret
const ALT_LOOP = [0x0f, 0x7f, 0x1e, 0x83, 0xc6, 0x08, 0x4a, 0x75, 0xf7, 0xc3];

const REGS = ['eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi'];
const PATTERN = 0x0123456789abcdefn;
const PATTERN_BYTES = Array.from({ length: 8 }, (_, i) => Number((PATTERN >> BigInt(8 * i)) & 0xffn));

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat: EXTRA_WAT, fonts: 'none' });
  const fixture = fs.readFileSync(path.join(__dirname, 'binaries', 'notepad.exe'));
  const bytes = new Uint8Array(memory.buffer);
  const dv = new DataView(memory.buffer);
  bytes.set(fixture, e.get_staging());
  assert(e.load_pe(fixture.length), 'fixture PE loads');

  const imageBase = e.get_image_base() >>> 0;
  const guestBase = e.get_guest_base() >>> 0;
  const imageWa = ga => (ga - imageBase + guestBase) >>> 0;
  const wa = ga => imageWa(ga);
  const codeBase = (imageBase + 0x2600) >>> 0;
  const stack = (imageBase + 0xd00000) >>> 0;
  let codeSlot = 0;

  function install(body) {
    const ga = (codeBase + codeSlot++ * 0x100) >>> 0;
    bytes.set(body, imageWa(ga));
    return ga;
  }

  const setReg = (name, v) => e['set_' + name](v >>> 0);
  const getReg = name => e['get_' + name]() >>> 0;

  function state() {
    return {
      regs: Object.fromEntries(REGS.filter(r => r !== 'esp').map(r => [r, getReg(r)])),
      flags: e.test_flags(),
      mm: [0, 1, 2, 3, 4, 5, 6, 7].map(i => e.test_mmx_get(i)),
    };
  }

  // Run one loop from `code` with the given registers; the loop's RET pops the
  // zero sentinel. `budget` > 0 stops early instead (branch-clock tests).
  function run(code, regs, { budget = 0 } = {}) {
    for (const r of REGS) if (r !== 'esp') setReg(r, regs[r] || 0);
    // A known carry and zero flag going in, so a fold that forgot the ADD's
    // carry (DEC preserves it) cannot pass by accident.
    for (let i = 0; i < 8; i++) e.test_mmx_set(i, BigInt.asIntN(64, PATTERN ^ BigInt(i * 0x1111)));
    e.set_esp(stack);
    dv.setUint32(imageWa(stack), 0, true);
    e.set_eip(code);
    e.run(budget || 1000000);
    if (!budget) assert.strictEqual(e.get_eip() >>> 0, 0, 'loop returns to the sentinel');
    return { ...state(), eip: e.get_eip() >>> 0 };
  }

  const arena = e.guest_alloc(0x20000) >>> 0;
  let arenaCursor = 0x100;
  function region(len) {
    const ga = (arena + arenaCursor) >>> 0;
    arenaCursor += (len + 0x1ff) & ~0xff;
    return ga;
  }

  // Run baseline (ordinary MMX blocks) and fused on identical code copies and
  // identically seeded destinations; return both.
  function ab(body, regsFor, dstReg, len, { seed = 0xcc, place, budget } = {}) {
    const code0 = install(body);
    const code1 = install(body);
    const d0 = place ? place(0) : region(len + 16);
    const d1 = place ? place(1) : region(len + 16);
    bytes.fill(seed, wa(d0), wa(d0) + len + 16);
    bytes.fill(seed, wa(d1), wa(d1) + len + 16);
    e.set_loop_mmx_fill_emit(0);
    const m0 = e.test_fill_matches();
    const base = run(code0, regsFor(d0), { budget });
    assert.strictEqual(e.test_fill_matches(), m0, 'disabled matcher emits ordinary blocks');
    e.set_loop_mmx_fill_emit(1);
    const fused = run(code1, regsFor(d1), { budget });
    const out0 = Array.from(bytes.subarray(wa(d0), wa(d0) + len + 16));
    const out1 = Array.from(bytes.subarray(wa(d1), wa(d1) + len + 16));
    // Registers that held the destination differ by construction; compare deltas.
    base.regs[dstReg] = (base.regs[dstReg] - d0) >>> 0;
    fused.regs[dstReg] = (fused.regs[dstReg] - d1) >>> 0;
    // A budget stop leaves EIP inside the arm's own code copy.
    if (budget) {
      base.eip = (base.eip - code0) >>> 0;
      fused.eip = (fused.eip - code1) >>> 0;
    }
    return { base, fused, out0, out1, d0, d1 };
  }

  // 1. The Deus Ex loop, 8-byte aligned, 7 qwords.
  {
    const before = e.test_fill_matches();
    const runsBefore = e.test_fill_runs();
    const r = ab(DX_LOOP, d => ({ edi: d, ecx: 7, eax: 0x11223344 }), 'edi', 56);
    assert.strictEqual(e.test_fill_matches(), before, 'physical-image repair declines staged fill lowering');
    assert.strictEqual(e.test_fill_runs(), runsBefore, 'ordinary instructions preserve intermediate fault state');
    assert.deepStrictEqual(r.out1, r.out0, 'aligned fill bytes agree');
    assert.deepStrictEqual(r.out1.slice(0, 8), PATTERN_BYTES, 'pattern is mm0, little-endian');
    assert.strictEqual(r.out1[56], 0xcc, 'no byte past the last qword');
    assert.deepStrictEqual(r.fused, r.base, 'GPRs, flags and MMX agree');
    assert.strictEqual(r.fused.regs.ecx, 0);
    assert.strictEqual(r.fused.regs.edi, 56);
  }

  // 2. Several pages, EDI 4 mod 8 so a qword straddles every page edge.
  {
    const count = 1500;
    const bulkBefore = e.test_fill_bulk();
    const place = arm => {
      const page = ((arena + 0x4fff + arm * 0x5000) & ~0xfff) >>> 0;
      return (page + 0x7fc) >>> 0;
    };
    const r = ab(DX_LOOP, d => ({ edi: d, ecx: count }), 'edi', count * 8, { place });
    assert.deepStrictEqual(r.out1, r.out0, 'multi-page unaligned fill bytes agree');
    assert.deepStrictEqual(r.fused, r.base, 'multi-page state agrees');
    const bulk = Number(e.test_fill_bulk() - bulkBefore);
    assert.strictEqual(bulk, 0, 'all page boundaries use ordinary stores');
  }

  // 3. Another register assignment: esi base, edx counter, mm3.
  {
    const before = e.test_fill_matches();
    const r = ab(ALT_LOOP, d => ({ esi: d, edx: 33, ecx: 0x55 }), 'esi', 33 * 8);
    assert.strictEqual(e.test_fill_matches(), before, 'alternate register form also declines staged lowering');
    assert.deepStrictEqual(r.out1, r.out0, 'alternate-register fill agrees');
    assert.deepStrictEqual(r.fused, r.base, 'alternate-register state agrees');
    assert.strictEqual(r.fused.regs.ecx, 0x55, 'unrelated registers untouched');
  }

  // 4. One iteration, and an EDI whose ADD carries out of bit 31 on the way.
  {
    const r = ab(DX_LOOP, d => ({ edi: d, ecx: 1 }), 'edi', 8);
    assert.deepStrictEqual(r.out1, r.out0);
    assert.deepStrictEqual(r.fused, r.base, 'single iteration state agrees');
  }

  // 5. Unmapped destination: both arms go through the sentinel.
  {
    const hole = 0x6ff00000;
    const code0 = install(DX_LOOP), code1 = install(DX_LOOP);
    e.set_loop_mmx_fill_emit(0);
    const base = run(code0, { edi: hole, ecx: 20 });
    e.set_loop_mmx_fill_emit(1);
    const fused = run(code1, { edi: hole, ecx: 20 });
    assert.deepStrictEqual(fused, base, 'unmapped destination state agrees');
  }

  // 6. The fill rewrites a function that has already been decoded and run.
  // Pattern = `mov eax,2 / ret / nop / nop`; the old function returned 1.
  {
    const fn = [0xb8, 0x01, 0x00, 0x00, 0x00, 0xc3, 0x90, 0x90];
    const newCode = 0x9090c300000002b8n;
    for (const enabled of [0, 1]) {
      const target = install(fn);
      const loop = install(DX_LOOP);
      e.set_loop_mmx_fill_emit(enabled);
      run(target, {});
      assert.strictEqual(getReg('eax'), 1, 'original function decoded and run');
      e.set_esp(stack); dv.setUint32(imageWa(stack), 0, true);
      setReg('edi', target); setReg('ecx', 1);
      e.test_mmx_set(0, BigInt.asIntN(64, newCode));
      e.set_eip(loop); e.run(1000000);
      assert.strictEqual(e.get_eip() >>> 0, 0);
      run(target, {});
      assert.strictEqual(getReg('eax'), 2, `rewritten function re-decoded (fold ${enabled})`);
    }
  }

  // 7. The fill runs forward over its own loop. Pattern = eight RETs, starting
  // two qwords below the loop: the third store rewrites the MOVQ, and the next
  // iteration must execute the new bytes (RET) with ECX = 7.
  {
    const results = [];
    for (const enabled of [0, 1]) {
      const loop = install(DX_LOOP);
      const dst = (loop - 16) >>> 0;
      bytes.fill(0x90, wa(dst), wa(dst) + 16);
      e.set_loop_mmx_fill_emit(enabled);
      for (const r of REGS) if (r !== 'esp') setReg(r, 0);
      setReg('edi', dst); setReg('ecx', 10);
      e.test_mmx_set(0, BigInt.asIntN(64, 0xc3c3c3c3c3c3c3c3n));
      e.set_esp(stack); dv.setUint32(imageWa(stack), 0, true);
      e.set_eip(loop); e.run(1000000);
      assert.strictEqual(e.get_eip() >>> 0, 0, 'rewritten loop returned');
      results.push({ ecx: getReg('ecx'), edi: (getReg('edi') - dst) >>> 0, flags: e.test_flags(),
        // The three stores, plus the loop's untouched tail (add/dec/jnz/ret).
        bytes: Array.from(bytes.subarray(wa(dst), wa(dst) + 26)) });
    }
    assert.strictEqual(results[0].ecx, 7, 'ordinary x86 stops after rewriting its own MOVQ');
    assert.deepStrictEqual(results[1], results[0], 'self-overwriting fill agrees');
  }

  // 8. --branch-clock: a small block budget stops both arms on the same
  // iteration, so a fixed batch lands on the same guest state.
  {
    e.set_branch_clock(1);
    for (const budget of [3, 10, 64]) {
      const r = ab(DX_LOOP, d => ({ edi: d, ecx: 200 }), 'edi', 1600, { budget });
      assert.deepStrictEqual(r.out1, r.out0, `budget ${budget}: bytes agree`);
      assert.deepStrictEqual(r.fused, r.base, `budget ${budget}: state agrees`);
      assert(r.fused.regs.ecx > 0, `budget ${budget} stopped mid-loop`);
    }
    e.set_branch_clock(0);
  }

  // 9. Near misses decode as ordinary x86 and still execute correctly.
  const nearMisses = {
    'stride 16': [0x0f, 0x7f, 0x07, 0x83, 0xc7, 0x10, 0x49, 0x75, 0xf7, 0xc3],
    'movq [edi+8]': [0x0f, 0x7f, 0x47, 0x08, 0x83, 0xc7, 0x08, 0x49, 0x75, 0xf6, 0xc3],
    'add other reg': [0x0f, 0x7f, 0x07, 0x83, 0xc6, 0x08, 0x49, 0x75, 0xf7, 0xc3],
    'counter is base': [0x0f, 0x7f, 0x07, 0x83, 0xc7, 0x08, 0x4f, 0x75, 0xf7, 0xc3],
    'jnz elsewhere': [0x90, 0x0f, 0x7f, 0x07, 0x83, 0xc7, 0x08, 0x49, 0x75, 0xf6, 0xc3],
    'movd store': [0x0f, 0x7e, 0x07, 0x83, 0xc7, 0x08, 0x49, 0x75, 0xf7, 0xc3],
    'jz exit': [0x0f, 0x7f, 0x07, 0x83, 0xc7, 0x08, 0x49, 0x74, 0xf7, 0xc3],
  };
  for (const [name, body] of Object.entries(nearMisses)) {
    const before = e.test_fill_matches();
    e.set_loop_mmx_fill_emit(1);
    const code = install(body);
    const dst = region(0x100);
    setReg('esi', dst);
    if (name === 'jz exit') {
      run(code, { edi: dst, ecx: 1 });
    } else if (name === 'counter is base') {
      e.set_eip(code); // decode only: dec edi as a counter would never end
      e.run(1);
    } else {
      run(code, { edi: dst, ecx: 3, esi: dst });
    }
    assert.strictEqual(e.test_fill_matches(), before, `near miss "${name}" is not lowered`);
  }

  console.log('PASS MMX qword fill lowering: exact match, pages, registers, unmapped, SMC, self-overwrite, branch clock, near misses');
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
