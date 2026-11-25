#!/usr/bin/env node
'use strict';

// Semantic regression for MSVC's Pentium/MMX 64-byte memcpy loop, used very
// heavily while UT2003 precaches packages.  The exact H419 lowering must match
// ordinary x86 for disjoint, overlapping, and page-split guest mappings and
// must preserve the MMX/GPR/flag state visible after the loop.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

const EXTRA_WAT = `
  (func (export "test_mmx_copy64_set_enabled") (param $v i32)
    (global.set $mmx_copy64_enabled (local.get $v)))
  (func (export "test_mmx_copy64_matches") (result i32)
    (global.get $mmx_copy64_matches))
  (func (export "test_mmx_copy64_runs") (result i32)
    (global.get $mmx_copy64_runs))
  (func (export "test_mmx_copy64_lines") (result i64)
    (global.get $mmx_copy64_lines))
  (func (export "test_mmx_copy64_bytes") (result i64)
    (global.get $mmx_copy64_bytes))
  (func (export "test_mmx_copy64_mmx") (param $i i32) (result i64)
    (call $mmx_get (local.get $i)))
  (func (export "test_mmx_copy64_cf") (result i32) (call $get_cf))
  (func (export "test_mmx_copy64_zf") (result i32) (call $get_zf))
`;

const BODY = Uint8Array.from([
  0x0f, 0x18, 0x86, 0x38, 0x02, 0x00, 0x00, // prefetchnta [esi+0x238]
  0x0f, 0x6f, 0x06,                         // movq mm0,[esi]
  0x0f, 0x6f, 0x4e, 0x08,                   // movq mm1,[esi+8]
  0x0f, 0x7f, 0x07,                         // movq [edi],mm0
  0x0f, 0x7f, 0x4f, 0x08,                   // movq [edi+8],mm1
  0x0f, 0x6f, 0x56, 0x10,                   // movq mm2,[esi+16]
  0x0f, 0x6f, 0x5e, 0x18,                   // movq mm3,[esi+24]
  0x0f, 0x7f, 0x57, 0x10,                   // movq [edi+16],mm2
  0x0f, 0x7f, 0x5f, 0x18,                   // movq [edi+24],mm3
  0x0f, 0x6f, 0x46, 0x20,                   // movq mm0,[esi+32]
  0x0f, 0x6f, 0x4e, 0x28,                   // movq mm1,[esi+40]
  0x0f, 0x7f, 0x47, 0x20,                   // movq [edi+32],mm0
  0x0f, 0x7f, 0x4f, 0x28,                   // movq [edi+40],mm1
  0x0f, 0x6f, 0x56, 0x30,                   // movq mm2,[esi+48]
  0x0f, 0x6f, 0x5e, 0x38,                   // movq mm3,[esi+56]
  0x0f, 0x7f, 0x57, 0x30,                   // movq [edi+48],mm2
  0x0f, 0x7f, 0x5f, 0x38,                   // movq [edi+56],mm3
  0x83, 0xc6, 0x40,                         // add esi,64
  0x83, 0xc7, 0x40,                         // add edi,64
  0x49,                                     // dec ecx
  0x75, 0xb2,                               // jnz body
]);
const LOOP = Uint8Array.from([...BODY, 0xc3]);
const STREAM_BODY = Uint8Array.from([
  0x0f,0x6f,0x06, 0x0f,0x6f,0x4e,0x08, 0x0f,0x6f,0x56,0x10,
  0x0f,0x6f,0x5e,0x18, 0x0f,0x6f,0x66,0x20, 0x0f,0x6f,0x6e,0x28,
  0x0f,0x6f,0x76,0x30, 0x0f,0x6f,0x7e,0x38, 0x83,0xc6,0x40,
  0x0f,0xe7,0x07, 0x0f,0xe7,0x4f,0x08, 0x0f,0xe7,0x57,0x10,
  0x0f,0xe7,0x5f,0x18, 0x0f,0xe7,0x67,0x20, 0x0f,0xe7,0x6f,0x28,
  0x0f,0xe7,0x77,0x30, 0x0f,0xe7,0x7f,0x38, 0x83,0xc7,0x40,
  0x48, 0x75,0xb9,
]);
const STREAM_LOOP = Uint8Array.from([...STREAM_BODY, 0xc3]);
const PIPELINED_BODY = Uint8Array.from([
  0x0f,0x18,0x86,0x38,0x02,0x00,0x00, 0x0f,0x6f,0x06, 0x83,0xc7,0x40,
  0x0f,0x6f,0x4e,0x08, 0x83,0xc6,0x40, 0x0f,0x6f,0x56,0xd0,
  0x0f,0xe7,0x47,0xc0, 0x0f,0x6f,0x46,0xd8, 0x0f,0xe7,0x4f,0xc8,
  0x0f,0x6f,0x4e,0xe0, 0x0f,0xe7,0x57,0xd0, 0x0f,0x6f,0x56,0xe8,
  0x0f,0xe7,0x47,0xd8, 0x0f,0x6f,0x46,0xf0, 0x0f,0xe7,0x4f,0xe0,
  0x0f,0x6f,0x4e,0xf8, 0x0f,0xe7,0x57,0xe8, 0x0f,0xe7,0x47,0xf0,
  0x49, 0x0f,0xe7,0x4f,0xf8, 0x75,0xb1,
]);
const PIPELINED_LOOP = Uint8Array.from([...PIPELINED_BODY, 0xc3]);

function i64le(bytes, off) {
  let v = 0n;
  for (let i = 7; i >= 0; i--) v = (v << 8n) | BigInt(bytes[off + i]);
  return BigInt.asIntN(64, v);
}

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
  const wa = ga => e.test_g2w ? e.test_g2w(ga) >>> 0 : imageWa(ga);
  const codeBase = (imageBase + 0x2600) >>> 0;
  const stack = (imageBase + 0xd00000) >>> 0;
  let codeSlot = 0;

  function install(body = LOOP) {
    const ga = (codeBase + codeSlot++ * 0x100) >>> 0;
    bytes.set(body, imageWa(ga));
    return ga;
  }

  function run(code, src, dst, count) {
    e.set_esi(src); e.set_edi(dst); e.set_ecx(count); e.set_esp(stack);
    dv.setUint32(imageWa(stack), 0, true);
    e.set_eip(code); e.run(100000);
    assert.strictEqual(e.get_eip() >>> 0, 0, 'copy loop returns to sentinel');
    return {
      esiDelta: ((e.get_esi() >>> 0) - src) >>> 0,
      ediDelta: ((e.get_edi() >>> 0) - dst) >>> 0,
      ecx: e.get_ecx() >>> 0,
      cf: e.test_mmx_copy64_cf(), zf: e.test_mmx_copy64_zf(),
      mm: [0, 1, 2, 3].map(i => e.test_mmx_copy64_mmx(i)),
    };
  }

  function runStream(code, src, dst, count) {
    e.set_esi(src); e.set_edi(dst); e.set_eax(count); e.set_esp(stack);
    dv.setUint32(imageWa(stack), 0, true);
    e.set_eip(code); e.run(100000);
    assert.strictEqual(e.get_eip() >>> 0, 0, 'stream copy loop returns to sentinel');
    return {
      esiDelta: ((e.get_esi() >>> 0) - src) >>> 0,
      ediDelta: ((e.get_edi() >>> 0) - dst) >>> 0,
      eax: e.get_eax() >>> 0,
      cf: e.test_mmx_copy64_cf(), zf: e.test_mmx_copy64_zf(),
      mm: [0,1,2,3,4,5,6,7].map(i => e.test_mmx_copy64_mmx(i)),
    };
  }

  const baselineCode = install();
  const fusedCode = install();
  const arena = e.guest_alloc(0xa000) >>> 0;
  const src = (arena + 0x100) >>> 0;
  const baselineDst = (arena + 0x1100) >>> 0;
  const fusedDst = (arena + 0x2100) >>> 0;
  const count = 7;
  const input = Uint8Array.from({ length: count * 64 }, (_, i) => (i * 73 + 19) & 0xff);
  bytes.set(input, wa(src));
  bytes.fill(0xcc, wa(baselineDst), wa(baselineDst) + input.length);
  bytes.fill(0xcc, wa(fusedDst), wa(fusedDst) + input.length);

  e.test_mmx_copy64_set_enabled(0);
  const baseline = run(baselineCode, src, baselineDst, count);
  assert.strictEqual(e.test_mmx_copy64_matches(), 0, 'disabled matcher emits ordinary MMX handlers');
  e.test_mmx_copy64_set_enabled(1);
  const fused = run(fusedCode, src, fusedDst, count);
  assert.strictEqual(e.test_mmx_copy64_matches(), 0, 'physical-image repair declines staged copy lowering');
  assert.strictEqual(e.test_mmx_copy64_runs(), 0, 'ordinary instructions own each physical-image commit');
  assert.strictEqual(e.test_mmx_copy64_lines(), 0n);
  assert.strictEqual(e.test_mmx_copy64_bytes(), 0n);
  assert.deepStrictEqual(Array.from(bytes.subarray(wa(fusedDst), wa(fusedDst) + input.length)),
    Array.from(bytes.subarray(wa(baselineDst), wa(baselineDst) + input.length)),
    'bulk lowering agrees with ordinary MMX bytes');
  assert.deepStrictEqual(fused, baseline, 'bulk lowering preserves GPR, flags, and final MMX values');
  assert.deepStrictEqual(fused.mm, [32, 40, 48, 56].map(off => i64le(input, (count - 1) * 64 + off)),
    'mm0..mm3 retain the final cache line tail');

  // Overlap must retain the original forward-copy behavior rather than
  // memory.copy's memmove behavior. Compare separate, identically seeded spans.
  const overlapBaselineCode = install();
  const overlapFusedCode = install();
  const overlapA = (arena + 0x3100) >>> 0;
  const overlapB = (arena + 0x4100) >>> 0;
  const overlapInput = Uint8Array.from({ length: 192 }, (_, i) => (i * 29 + 7) & 0xff);
  bytes.set(overlapInput, wa(overlapA));
  bytes.set(overlapInput, wa(overlapB));
  e.test_mmx_copy64_set_enabled(0);
  const overlapBaseline = run(overlapBaselineCode, overlapA, overlapA + 16, 2);
  e.test_mmx_copy64_set_enabled(1);
  const overlapFused = run(overlapFusedCode, overlapB, overlapB + 16, 2);
  assert.deepStrictEqual(Array.from(bytes.subarray(wa(overlapB), wa(overlapB) + 192)),
    Array.from(bytes.subarray(wa(overlapA), wa(overlapA) + 192)),
    'overlap fallback preserves the original interleaved forward copy');
  assert.deepStrictEqual(overlapFused, overlapBaseline,
    'overlap fallback preserves final architectural state');

  // Force a line across a page edge so the mapping-aware qword fallback runs.
  const splitBaselineCode = install();
  const splitFusedCode = install();
  const page = ((arena + 0x5fff) & ~0xfff) >>> 0;
  const splitSrcA = (page - 32) >>> 0;
  const splitSrcB = (page + 0x1000 - 32) >>> 0;
  const splitDstA = (page + 0x2000 - 24) >>> 0;
  const splitDstB = (page + 0x3000 - 24) >>> 0;
  const splitInput = Uint8Array.from({ length: 64 }, (_, i) => (255 - i * 11) & 0xff);
  bytes.set(splitInput, wa(splitSrcA)); bytes.set(splitInput, wa(splitSrcB));
  e.test_mmx_copy64_set_enabled(0);
  const splitBaseline = run(splitBaselineCode, splitSrcA, splitDstA, 1);
  e.test_mmx_copy64_set_enabled(1);
  const splitFused = run(splitFusedCode, splitSrcB, splitDstB, 1);
  assert.deepStrictEqual(Array.from(bytes.subarray(wa(splitDstB), wa(splitDstB) + 64)),
    Array.from(bytes.subarray(wa(splitDstA), wa(splitDstA) + 64)),
    'page-split fallback agrees with ordinary MMX');
  assert.deepStrictEqual(splitFused, splitBaseline, 'page-split architectural state agrees');

  const near = Uint8Array.from(LOOP);
  near[13] = 9; // movq mm1,[esi+9], valid x86 but not the proved shape
  const nearCode = install(near);
  const beforeNear = e.test_mmx_copy64_matches();
  run(nearCode, src, arena + 0x8100, 1);
  assert.strictEqual(e.test_mmx_copy64_matches(), beforeNear,
    'one-byte near miss remains ordinary x86');

  const streamBaselineCode = install(STREAM_LOOP);
  const streamFusedCode = install(STREAM_LOOP);
  const streamDstA = (arena + 0x6100) >>> 0;
  const streamDstB = (arena + 0x7100) >>> 0;
  bytes.fill(0, wa(streamDstA), wa(streamDstA) + input.length);
  bytes.fill(0, wa(streamDstB), wa(streamDstB) + input.length);
  e.test_mmx_copy64_set_enabled(0);
  const streamBaseline = runStream(streamBaselineCode, src, streamDstA, count);
  const beforeStream = e.test_mmx_copy64_matches();
  e.test_mmx_copy64_set_enabled(1);
  const streamFused = runStream(streamFusedCode, src, streamDstB, count);
  assert.strictEqual(e.test_mmx_copy64_matches(), beforeStream,
    'exact MOVNTQ stream body lowers once');
  assert.deepStrictEqual(Array.from(bytes.subarray(wa(streamDstB), wa(streamDstB) + input.length)),
    Array.from(bytes.subarray(wa(streamDstA), wa(streamDstA) + input.length)),
    'stream bulk lowering agrees with ordinary MOVNTQ bytes');
  assert.deepStrictEqual(streamFused, streamBaseline,
    'stream bulk lowering preserves GPR, flags, and final MMX0..7 values');

  const pipeBaselineCode = install(PIPELINED_LOOP);
  const pipeFusedCode = install(PIPELINED_LOOP);
  const pipeDstA = (arena + 0x8200) >>> 0;
  const pipeDstB = (arena + 0x8e00) >>> 0;
  bytes.fill(0, wa(pipeDstA), wa(pipeDstA) + input.length);
  bytes.fill(0, wa(pipeDstB), wa(pipeDstB) + input.length);
  e.test_mmx_copy64_set_enabled(0);
  const pipeBaseline = run(pipeBaselineCode, src, pipeDstA, count);
  const beforePipe = e.test_mmx_copy64_matches();
  e.test_mmx_copy64_set_enabled(1);
  const pipeFused = run(pipeFusedCode, src, pipeDstB, count);
  assert.strictEqual(e.test_mmx_copy64_matches(), beforePipe,
    'exact pipelined MOVNTQ body lowers once');
  assert.deepStrictEqual(Array.from(bytes.subarray(wa(pipeDstB), wa(pipeDstB) + input.length)),
    Array.from(bytes.subarray(wa(pipeDstA), wa(pipeDstA) + input.length)),
    'pipelined bulk lowering agrees with ordinary MOVNTQ bytes');
  assert.deepStrictEqual(pipeFused, pipeBaseline,
    'pipelined bulk lowering preserves GPR, flags, and final MMX state');
  assert.deepStrictEqual(pipeFused.mm.slice(0, 3), [48, 56, 40].map(off =>
    i64le(input, (count - 1) * 64 + off)),
  'pipelined mm0..mm2 retain qwords 6, 7, and 5');

  // This shape alternates loads and stores after its first three reads. A
  // load-all-then-store fallback would look right for disjoint copies but
  // differ here, so compare the exact overlapping forward-copy result.
  const pipeOverlapBaselineCode = install(PIPELINED_LOOP);
  const pipeOverlapFusedCode = install(PIPELINED_LOOP);
  const pipeOverlapA = (arena + 0x5200) >>> 0;
  const pipeOverlapB = (arena + 0x5600) >>> 0;
  bytes.set(overlapInput, wa(pipeOverlapA));
  bytes.set(overlapInput, wa(pipeOverlapB));
  e.test_mmx_copy64_set_enabled(0);
  const pipeOverlapBaseline = run(pipeOverlapBaselineCode, pipeOverlapA, pipeOverlapA + 16, 2);
  e.test_mmx_copy64_set_enabled(1);
  const pipeOverlapFused = run(pipeOverlapFusedCode, pipeOverlapB, pipeOverlapB + 16, 2);
  assert.deepStrictEqual(Array.from(bytes.subarray(wa(pipeOverlapB), wa(pipeOverlapB) + 192)),
    Array.from(bytes.subarray(wa(pipeOverlapA), wa(pipeOverlapA) + 192)),
    'pipelined overlap fallback preserves alternating load/store order');
  assert.deepStrictEqual(pipeOverlapFused, pipeOverlapBaseline,
    'pipelined overlap fallback preserves final architectural state');

  console.log('PASS MSVC MMX copy64 lowering: exact match, bulk, overlap, page split, pipelined state, near miss');
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
