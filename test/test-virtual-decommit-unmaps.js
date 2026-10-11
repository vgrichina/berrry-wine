#!/usr/bin/env node
'use strict';

// MEM_DECOMMIT takes pages out of translation; MEM_COMMIT brings them back.
//
// On Windows touching a decommitted page is an access violation, and Serious
// Sam's CTStream depends on it: it slides a two-page window over a
// reservation, decommits the pages behind it, and when a seek returns to one
// its exception filter commits the page and reads it from disk again. A
// decommitted page that kept translating read as zeros instead, and loading a
// level failed with "Chunk ID validation failed. Expected ID "BRAR" but found
// """. The backing must still come back zero on the next commit (the MSVC
// small-block heap relies on that, see $virtual_map_decommit_zero), and
// committing pages that are still live must leave their contents alone.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "t_valloc") (param $addr i32) (param $size i32) (param $type i32) (result i32)
    (local $sp i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_VirtualAlloc (local.get $addr) (local.get $size) (local.get $type)
      (i32.const 4) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (i32.load (global.get $reg_base)))
  (func (export "t_vfree") (param $addr i32) (param $size i32) (param $type i32) (result i32)
    (local $sp i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_VirtualFree (local.get $addr) (local.get $size) (local.get $type)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (i32.load (global.get $reg_base)))
  (func (export "t_g2w") (param $ga i32) (result i32) (call $g2w (local.get $ga)))
  (func (export "t_sentinel") (result i32) (global.get $NULL_SENTINEL))
  (func (export "t_set_image_base") (param $b i32) (global.set $image_base (local.get $b)))
`;

const MEM_COMMIT = 0x1000, MEM_RESERVE = 0x2000, MEM_DECOMMIT = 0x4000;

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none' });
  e.t_set_image_base(0x400000);
  const sentinel = e.t_sentinel() >>> 0;
  const mapped = ga => (e.t_g2w(ga) >>> 0) !== sentinel;

  const base = e.t_valloc(0, 0x10000, MEM_RESERVE) >>> 0;
  assert(base, 'reservation placed');
  assert.strictEqual(e.t_valloc(base, 0x2000, MEM_COMMIT) >>> 0, base, 'commit two pages');
  e.guest_write32(base + 0x10, 0x11111111);
  e.guest_write32(base + 0x1010, 0x22222222);

  // Decommit page 0: it misses, page 1 is untouched.
  assert.strictEqual(e.t_vfree(base, 0x1000, MEM_DECOMMIT), 1);
  assert(!mapped(base), 'a decommitted page no longer translates');
  assert(!mapped(base + 0xFFC), '...anywhere in it');
  assert(mapped(base + 0x1000), 'the page after it still does');
  assert.strictEqual(e.guest_read32(base + 0x1010) >>> 0, 0x22222222, 'and keeps its contents');

  // Recommit page 0: translates again, zero-filled.
  assert.strictEqual(e.t_valloc(base, 0x1000, MEM_COMMIT) >>> 0, base, 'recommit page 0');
  assert(mapped(base), 'recommitted page translates');
  assert.strictEqual(e.guest_read32(base + 0x10), 0, 'and comes back zero');

  // A decommit that is not page aligned takes every page it touches.
  e.guest_write32(base + 0x10, 0x33333333);
  assert.strictEqual(e.t_vfree(base + 0x1800, 0x10, MEM_DECOMMIT), 1);
  assert(!mapped(base + 0x1000), 'page 1 decommitted by a partial range');
  assert(mapped(base), 'page 0 untouched');

  // Recommitting both pages: live page 0 keeps its data, page 1 is fresh.
  assert.strictEqual(e.t_valloc(base, 0x2000, MEM_COMMIT) >>> 0, base, 'recommit both');
  assert.strictEqual(e.guest_read32(base + 0x10) >>> 0, 0x33333333, 'committing a live page leaves it alone');
  assert(mapped(base + 0x1000), 'page 1 translates again');
  assert.strictEqual(e.guest_read32(base + 0x1010), 0, 'page 1 zero');

  // A commit that starts inside the record and runs past it republishes the
  // decommitted part as well as committing the new tail.
  assert.strictEqual(e.t_vfree(base + 0x1000, 0x1000, MEM_DECOMMIT), 1);
  assert.strictEqual(e.t_valloc(base + 0x1000, 0x2000, MEM_COMMIT) >>> 0, base + 0x1000, 'overlapping commit');
  assert(mapped(base + 0x1000) && mapped(base + 0x2000), 'both the old page and the new tail translate');
  e.guest_write32(base + 0x1ffc, 0x44444444);
  e.guest_write32(base + 0x2000, 0x55555555);
  assert.deepStrictEqual([e.guest_read32(base + 0x1ffc) >>> 0, e.guest_read32(base + 0x2000) >>> 0],
    [0x44444444, 0x55555555], 'distinct bytes either side of the record edge');

  // A size-0 decommit names an allocation by its base and reaches only that
  // allocation. Taking every record to its own end used to decommit -- and
  // with unmapping, unmap -- every live allocation above the base.
  const x = e.t_valloc(0, 0x10000, MEM_RESERVE | MEM_COMMIT) >>> 0;
  const y = e.t_valloc(0, 0x10000, MEM_RESERVE | MEM_COMMIT) >>> 0;
  assert(x && y && x !== y, 'two separate allocations');
  const [lo, hi] = x < y ? [x, y] : [y, x];
  e.guest_write32(lo + 0x20, 0x66666666);
  e.guest_write32(hi + 0x20, 0x77777777);
  assert.strictEqual(e.t_vfree(lo, 0, MEM_DECOMMIT), 1, 'size-0 decommit of the lower allocation');
  assert(!mapped(lo + 0x20), 'the named allocation is decommitted');
  assert(mapped(hi + 0x20), 'the allocation above it stays mapped');
  assert.strictEqual(e.guest_read32(hi + 0x20) >>> 0, 0x77777777, 'and keeps its contents');

  console.log('PASS MEM_DECOMMIT unmaps pages until they are committed again, zero-filled');
})().catch(error => { console.error(error.stack || error); process.exit(1); });
