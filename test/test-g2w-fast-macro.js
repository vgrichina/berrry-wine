#!/usr/bin/env node

'use strict';

// The g2w-fast macro (src/03-registers.wat) replaces $g2w's direct-window test
//   (wa >=s 0) && (wa <u END)
// with the single compare
//   wa <u END
// and hands every miss to $g2w_slow with the guest address rebuilt from wa.
// That is only the same function if END <= 0x80000000 (so wa <u END forces
// bit 31 clear) and the rebuild is the exact mod-2^32 inverse. This pins both
// and then checks the compiled module agrees with the old definition on
// direct, DIB, sparse, unmapped and wraparound addresses, through $g2w itself
// ("guest_to_wasm") and through the accessors that now expand the macro
// ("guest_read8/32", "guest_write8/32").

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');
const RegionMap = require('../lib/region-map.generated.js');

const NULL_SENTINEL = 0xF0;
const DIB_GUEST_BASE = 0x50000000;
const DIB_GUEST_CAPACITY = 0x03F00000;
const DIB_BACKING_BASE = RegionMap.BASE.DIB_BACKING_BASE;

// The span bound, read from its one declaration so the check cannot drift.
const regions = fs.readFileSync(path.join(__dirname, '..', 'src', '00-regions.wat'), 'utf8');
const spanMatch = regions.match(
  /\(region\.declare-span \$DIRECT_WINDOW \(base (0x[0-9A-Fa-f_]+)\) \(end (0x[0-9A-Fa-f_]+)\)/);
assert(spanMatch, '$DIRECT_WINDOW span declaration not found in src/00-regions.wat');
const SPAN_BASE = parseInt(spanMatch[1].replace(/_/g, ''), 16);
const END = parseInt(spanMatch[2].replace(/_/g, ''), 16);

let checks = 0;
function ok(cond, msg) { assert(cond, msg); checks++; }
const hex = (v) => '0x' + (v >>> 0).toString(16);

// 1. The proof's premises.
ok(SPAN_BASE === 0, `the direct window must start at 0 (got ${hex(SPAN_BASE)})`);
ok(END > 0 && END <= 0x80000000,
  `region.end $DIRECT_WINDOW must be <= 0x80000000 for one unsigned compare to imply wa >=s 0 (got ${hex(END)})`);

const oldDirect = (wa) => ((wa | 0) >= 0) && ((wa >>> 0) < END);
const newDirect = (wa) => (wa >>> 0) < END;

// 2. The two predicates agree on every edge and on a deterministic sweep.
const edges = [0, 1, END - 1, END, END + 1, 0x7FFFFFFF, 0x80000000, 0x80000001,
  0xFFFFFFFF, 0xFFFFFFFE, 0xF8000000, 0x88000000];
let seed = 0x12345678;
const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0);
for (let i = 0; i < 200000; i++) edges.push(rnd());
for (const wa of edges) {
  if (oldDirect(wa) !== newDirect(wa)) assert.fail(`predicates disagree at wa=${hex(wa)}`);
}
checks++;

(async () => {
  const { exports: e, memory } = await bootRenderHarness();
  const imageBase = e.get_image_base() >>> 0;
  const GUEST_BASE = RegionMap.GUEST_BASE;
  const waOf = (ga) => ((ga >>> 0) - imageBase + GUEST_BASE) >>> 0;
  const gaOf = (wa) => ((wa >>> 0) - GUEST_BASE + imageBase) >>> 0;

  // 3. The miss-path rebuild is the exact inverse of the forward arithmetic,
  //    wraparound included.
  for (const ga of [0, 1, imageBase, 0xFFFFFFFF, (imageBase - GUEST_BASE) >>> 0,
    ((imageBase - GUEST_BASE) - 1) >>> 0, DIB_GUEST_BASE, 0x80000000, rnd(), rnd()]) {
    if (gaOf(waOf(ga)) !== (ga >>> 0)) assert.fail(`rebuild is not the inverse at ga=${hex(ga)}`);
  }
  checks++;

  // The old $g2w, as a model: direct window, then the one chain $g2w_slow runs.
  const oldG2w = (ga) => {
    const wa = waOf(ga);
    if (oldDirect(wa)) return wa;
    return e.test_g2w_slow(ga) >>> 0;
  };
  const g2w = (ga) => e.guest_to_wasm(ga) >>> 0;

  // 4. Direct window: the ends and the image itself.
  const directLo = gaOf(0);                 // wa = 0
  const directHi = gaOf(END - 1);           // wa = END - 1
  for (const ga of [imageBase, imageBase + 0x1234, directLo, directHi]) {
    ok(g2w(ga) === waOf(ga), `direct ${hex(ga)} -> ${hex(g2w(ga))}, want ${hex(waOf(ga))}`);
  }

  // 5. Just outside it, both ways, is a miss handed to the slow chain.
  const justAbove = gaOf(END);              // wa = END
  const justBelow = gaOf(0xFFFFFFFF);       // wa = -1 (the wraparound side)
  for (const ga of [justAbove, justBelow, gaOf(0x80000000), gaOf(0x7FFFFFFF)]) {
    ok(g2w(ga) === oldG2w(ga), `miss ${hex(ga)}: macro ${hex(g2w(ga))} vs old ${hex(oldG2w(ga))}`);
    ok(!newDirect(waOf(ga)), `${hex(ga)} should not be a direct-window address`);
  }

  // 6. DIB arena: first, interior and last byte, and the first byte past it.
  for (const off of [0, 0x1000, DIB_GUEST_CAPACITY - 1]) {
    const ga = DIB_GUEST_BASE + off;
    ok(g2w(ga) === DIB_BACKING_BASE + off, `DIB ${hex(ga)} -> ${hex(g2w(ga))}`);
  }
  ok(g2w(DIB_GUEST_BASE + DIB_GUEST_CAPACITY) === NULL_SENTINEL,
    'the first byte past the DIB arena is unmapped');

  // 7. Sparse: reserve and commit a section, then translate through it.
  const base = e.guest_section_reserve(0x3000) >>> 0;
  ok(base !== 0, 'guest_section_reserve should succeed');
  ok(!newDirect(waOf(base)), `a sparse reservation must lie outside the direct window (${hex(base)})`);
  ok(e.guest_section_commit(base, 0, 0x3000, 4) !== 0, 'guest_section_commit should succeed');
  const sparseWa = g2w(base);
  ok(sparseWa !== NULL_SENTINEL, 'a committed sparse page must translate');
  ok(g2w(base + 0x10) === sparseWa + 0x10, 'sparse translation is affine within a page');
  ok(g2w(base) === oldG2w(base), 'sparse: macro and old model agree');

  // Round-trip through the macro-expanding accessors.
  e.guest_write32(base + 8, 0xCAFEF00D);
  ok((e.guest_read32(base + 8) >>> 0) === 0xCAFEF00D, 'gs32/gl32 round trip on a sparse page');
  ok(new DataView(memory.buffer).getUint32(g2w(base + 8), true) === 0xCAFEF00D,
    'gs32 wrote where $g2w says the byte is');
  e.guest_write8(base + 0x2FFF, 0x5A);
  ok(e.guest_read8(base + 0x2FFF) === 0x5A, 'gs8/gl8 round trip at the end of a sparse run');

  const heapGa = e.guest_alloc(16) >>> 0;
  e.guest_write32(heapGa, 0x01020304);
  ok(new DataView(memory.buffer).getUint32(waOf(heapGa), true) === 0x01020304,
    'gs32 on a direct-window heap address lands at the affine address');
  ok(e.guest_read8(heapGa + 3) === 0x01, 'gl8 on a direct-window address');

  // Dwords wholly inside the direct window may cross a guest page without
  // another translation. Partial spans at either window edge must instead
  // assemble bytes from their actual mappings, never adjacent private memory.
  const bytes = new Uint8Array(memory.buffer);
  const savedEnd = bytes.slice(END - 8, END);
  bytes.set([0x12, 0x34, 0x56, 0x78, 0x9A, 0xBC, 0xDE, 0xF0], END - 8);
  const stateNames = ['eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi', 'eip',
    'flag_op', 'flag_a', 'flag_b', 'flag_res', 'flag_sign_shift'];
  const state = () => stateNames.map(n => e[`get_${n}`]() >>> 0);
  const beforeReads = state();
  try {
    for (const edge of [0, 0x2000, END]) {
      for (let offset = -5; offset <= 5; offset++) {
        const ga = gaOf((edge + offset) >>> 0);
        let expected = 0;
        for (let i = 0; i < 4; i++) expected |= e.guest_read8((ga + i) >>> 0) << (i * 8);
        ok((e.guest_read32(ga) >>> 0) === (expected >>> 0),
          `gl32 span at ${hex(ga)} agrees with separately translated bytes`);
      }
    }
    assert.deepStrictEqual(state(), beforeReads, 'direct and partial reads preserve registers and lazy flags');
    checks++;
  } finally {
    bytes.set(savedEnd, END - 8);
  }

  // 8. Unmapped: high, wrapped and just-past-the-window addresses all miss to
  //    the sentinel, exactly as the old chain did.
  for (const ga of [0xFFFFFFFF, 0xFFFFF000, 0x7FFFF000, justAbove]) {
    ok(g2w(ga) === oldG2w(ga), `unmapped ${hex(ga)}: macro ${hex(g2w(ga))} vs old ${hex(oldG2w(ga))}`);
  }
  // (The top of the address space is not a safe "unmapped" probe: sparse
  // reservations are placed top-down. Past the DIB arena is.)
  const unmapped = DIB_GUEST_BASE + DIB_GUEST_CAPACITY + 0x1000;
  ok(g2w(unmapped) === NULL_SENTINEL, `${hex(unmapped)} is unmapped`);
  ok(e.guest_read32(unmapped) === 0, 'an unmapped read answers 0');

  // 9. A sweep of guest addresses: the compiled macro equals the old model.
  for (let i = 0; i < 20000; i++) {
    const ga = rnd();
    const got = g2w(ga);
    const want = oldG2w(ga);
    if (got !== want) assert.fail(`sweep ${hex(ga)}: macro ${hex(got)} vs old ${hex(want)}`);
  }
  checks++;

  console.log(`test-g2w-fast-macro: ${checks} checks passed`);
})().catch((err) => { console.error(err); process.exit(1); });
