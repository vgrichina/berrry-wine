'use strict';

// The sparse reserve cursor only ever moves down, and the reclaim can only
// raise it as far as the lowest live range. So one long-lived allocation near
// the floor makes the whole arena above it unreachable however empty it is.
//
// Black & White 2 lands exactly there. Once the abandoned steps of its land
// loader's growth series are handed back, the one 121 MB buffer it kept sits at
// 0x164f0000 -- 106 MB of address space under it, ~800 MB free above -- and the
// 191 MB step it asks for next is refused with "no guest address space left to
// reserve", after which the game throws std::bad_alloc and dies.
//
// A reservation that will not fit under the cursor is placed in a gap instead:
// a candidate slides down from the ceiling past whatever range it hits until it
// fits. This pins that, and pins what must NOT happen -- a gap placement that
// overlaps a live range, or one made while an untracked reservation is out.

const assert = require('assert');
const fs = require('fs');
const { compileSrcWasm } = require('./compile-src');
const sigs = require('../lib/host-import-sigs.generated.json').sigs;
const regions = require('../lib/region-map.generated');

const MB = 1024 * 1024;
const IMAGE_BASE = 0x400000;
// The arena's floor is not a constant: it is the first 64KB boundary past the
// direct window, which moves with the image base (see $virtual_alloc_min). The
// module is asked for it rather than a number being written down here, because
// every scenario below is "a tenant this far above the floor" or "a cursor one
// page above the floor" and a stale copy would silently stop testing that.
// Read from the module for the same reason the floor is: the ceiling has moved
// twice (0x40000000, then 0x50000000, now the top of user space) and every case
// below is expressed relative to it.

const extraWat = `
  (func (export "test_gap_reset")
    (call $zero_memory (global.get $VIRTUAL_MAP_STATE)
      (i32.add (global.get $VIRTUAL_MAP_STATE_SIZE) (global.get $VIRTUAL_MAP_TABLE_SIZE)))
    (call $zero_memory (global.get $VIRTUAL_RESERVE_TABLE)
      (global.get $VIRTUAL_RESERVE_TABLE_SIZE))
    (call $zero_memory (global.get $VIRTUAL_HOLE_TABLE)
      (global.get $VIRTUAL_HOLE_TABLE_SIZE))
    (call $zero_memory (global.get $GUEST_PAGE_TABLE) (global.get $GUEST_PAGE_TABLE_SIZE))
    (i32.store offset=4 (global.get $VIRTUAL_MAP_STATE) (global.get $VIRTUAL_BACKING_BASE))
    (global.set $virtual_alloc_top (global.get $VIRTUAL_ALLOC_TOP_INIT)))
  (func (export "test_gap_floor") (result i32) (call $virtual_alloc_min))
  (func (export "test_gap_top") (result i32) (global.get $VIRTUAL_ALLOC_TOP_INIT))
  (func (export "test_gap_cursor") (result i32)
    (i32.load offset=8 (global.get $VIRTUAL_MAP_STATE)))
  (func (export "test_gap_set_cursor") (param $v i32)
    (i32.store offset=8 (global.get $VIRTUAL_MAP_STATE) (local.get $v))
    (global.set $virtual_alloc_top (local.get $v)))
  (func (export "test_gap_reserve") (param $size i32) (result i32)
    (call $virtual_reserve_down (local.get $size)))
  (func (export "test_gap_commit") (param $guest i32) (param $size i32) (result i32)
    (call $virtual_map_commit (local.get $guest) (local.get $size)))
  (func (export "test_gap_records") (result i32)
    (i32.load (global.get $VIRTUAL_MAP_STATE)))
  (func (export "test_gap_rec_guest") (param $i i32) (result i32)
    (i32.load (i32.add (global.get $VIRTUAL_MAP_TABLE) (i32.shl (local.get $i) (i32.const 4)))))
  (func (export "test_gap_rec_size") (param $i i32) (result i32)
    (i32.load offset=4 (i32.add (global.get $VIRTUAL_MAP_TABLE) (i32.shl (local.get $i) (i32.const 4)))))
  (func (export "test_gap_bare_reserve") (param $guest i32) (param $size i32)
    (call $virtual_reserve_record
      (local.get $guest) (local.get $size) (i32.const 0x04)))
  (func (export "test_gap_set_floor") (param $v i32)
    (i32.store offset=20 (global.get $VIRTUAL_MAP_STATE) (local.get $v)))
`;

(async () => {
  const wasmBytes = process.argv[2] ? fs.readFileSync(process.argv[2])
    : compileSrcWasm((filename, source) =>
      filename === '13-exports.wat' ? `${source}\n${extraWat}\n` : source);
  const module = await WebAssembly.compile(wasmBytes);

  let ALLOC_TOP = 0;
  // host.js creates the memory with initial === maximum: 8192 pages for every
  // app, more for a `bigMemory` one, whose pages above 0x20000000 become the
  // second sparse backing window.
  async function boot(pages = 8192) {
    const memory = new WebAssembly.Memory({ initial: pages, maximum: pages, shared: true });
    const host = { memory };
    for (const [n, s] of Object.entries(sigs)) host[n] = s.results?.length ? () => 0 : () => {};
    const e = (await WebAssembly.instantiate(module, { host })).exports;
    e.init_thread(0, IMAGE_BASE, 0, 0, 0, 0, 0);
    e.test_gap_reset();
    ALLOC_TOP = e.test_gap_top() >>> 0;
    return e;
  }
  const live = (e) => {
    const out = [];
    for (let i = 0, n = e.test_gap_records(); i < n; i++) {
      out.push([e.test_gap_rec_guest(i) >>> 0, e.test_gap_rec_size(i) >>> 0]);
    }
    return out;
  };
  const overlaps = (e, base, size) => live(e).some(([b, s]) =>
    b < base + size && b + s > base);

  // 1. A tenant near the floor must not cost the arena above it. This is the
  //    measured shape: one live range low down, a request that cannot fit
  //    beneath it, and hundreds of megabytes free overhead. 121 + 191 MB is
  //    more than the 512 MB map's sparse backing pool holds, and B&W2 is a
  //    `bigMemory` app for exactly that reason, so boot it the way host.js
  //    does: 16384 pages is the smallest rung of its bigMemory ladder.
  {
    const e = await boot(16384);
    const ALLOC_MIN = e.test_gap_floor() >>> 0;
    // 106 MB of address space under the tenant, which is less than the 191 MB
    // asked for next -- the whole point of the case. Measured against the floor
    // rather than written as 0x164f0000, so it stays "cannot fit beneath it"
    // whatever the floor is.
    const low = ALLOC_MIN + 106 * MB;
    assert(e.test_gap_commit(low, 121 * MB), 'the long-lived low buffer');
    e.test_gap_set_cursor(low);
    const got = e.test_gap_reserve(191 * MB) >>> 0;
    assert(got, '191MB must be placed even though only 106MB sits below the tenant');
    assert(got >= ALLOC_MIN && got + 191 * MB <= ALLOC_TOP, 'inside the sparse arena');
    assert(!overlaps(e, got, 191 * MB), 'a gap placement never overlaps a live range');
    assert(got > low, 'and it went above the tenant, where the free space is');
    assert.strictEqual(got & 0xffff, 0, '64KB granularity');
    assert(e.test_gap_commit(got, 191 * MB), 'the placed range commits');
  }

  // 2. It really is first-fit from the ceiling and it really slides: fill the
  //    top with tenants and the placement lands under all of them.
  {
    const e = await boot();
    const ALLOC_MIN = e.test_gap_floor() >>> 0;
    const tenants = [];
    for (let i = 0; i < 6; i++) {
      const base = ALLOC_TOP - (i + 1) * 32 * MB;
      assert(e.test_gap_commit(base, 24 * MB), `tenant ${i}`);
      tenants.push(base);
    }
    e.test_gap_set_cursor(ALLOC_MIN + 0x10000);
    const got = e.test_gap_reserve(20 * MB) >>> 0;
    assert(got, 'a 20MB gap exists between the tenants');
    assert(!overlaps(e, got, 20 * MB), 'no overlap');
    // Each tenant is 24MB in a 32MB stride, so the 8MB holes cannot hold it and
    // the only fit is below the lowest tenant.
    assert(got + 20 * MB <= tenants[tenants.length - 1], 'slid past every tenant');
  }

  // 3. A bare MEM_RESERVE nothing has committed is still an owner.
  {
    const e = await boot();
    const ALLOC_MIN = e.test_gap_floor() >>> 0;
    e.test_gap_bare_reserve(0x40000000, 64 * MB);
    e.test_gap_set_cursor(ALLOC_MIN + 0x10000);
    const got = e.test_gap_reserve(48 * MB) >>> 0;
    assert(got, 'placed');
    assert(got >= 0x40000000 + 64 * MB || got + 48 * MB <= 0x40000000,
      'a gap placement respects an uncommitted reservation');
  }

  // 4. Once a reservation has gone untracked, the arena is bump-only again:
  //    the sticky floor says something is spoken for without saying what.
  {
    const e = await boot();
    const ALLOC_MIN = e.test_gap_floor() >>> 0;
    e.test_gap_set_floor(0x30000000);
    e.test_gap_set_cursor(ALLOC_MIN + 0x10000);
    assert.strictEqual(e.test_gap_reserve(64 * MB) >>> 0, 0,
      'no gap placement while an unnamed reservation is out');
  }

  // 5. A request bigger than the whole arena is still refused.
  {
    const e = await boot();
    const ALLOC_MIN = e.test_gap_floor() >>> 0;
    e.test_gap_set_cursor(ALLOC_MIN + 0x10000);
    assert.strictEqual(e.test_gap_reserve(ALLOC_TOP - ALLOC_MIN + 0x1000000) >>> 0, 0,
      'a request larger than the arena fails rather than wrapping');
  }

  console.log('Sparse reserve gap placement PASS: tenant near the floor, slide, bare reserve, sticky floor, oversize');
})().catch((e) => { console.error(e); process.exitCode = 1; });
