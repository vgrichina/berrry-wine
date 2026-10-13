#!/usr/bin/env node
'use strict';
// The sparse backing pool is 316MB, and Black & White 2's land wants more than
// that. The module therefore imports (memory 8192 16384 shared): a host may
// create the 512MB every platform has always used, or up to 1GB, and the half
// above 0x20000000 is a second backing window that only exists in the second
// case. Nothing may read that window without asking memory.size first.
//
// Both halves are checked here in one process, because the interesting
// property is the DIFFERENCE: identical WAT, two memories, and the commit that
// fails on the small one succeeds on the large one with backing above the map.
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const { REGIONS } = require('../lib/region-map.generated.js');

const EXT_BASE = REGIONS.THREAD_RPC.end;
const EXTRA_WAT = `
  (func (export "commit") (param $guest i32) (param $size i32) (result i32)
    (call $virtual_map_commit (local.get $guest) (local.get $size)))
  (func (export "backing_of") (param $guest i32) (result i32)
    (call $g2w (local.get $guest)))
  (func (export "ext_base") (result i32) (call $virtual_backing_ext_base))
  (func (export "ext_end") (result i32) (call $virtual_backing_ext_end))
  (func (export "ext_cursor") (result i32) (call $virtual_backing_ext_cursor))
  (func (export "capacity") (result i32) (call $virtual_backing_capacity))
  (func (export "available") (result i32) (call $virtual_backing_available))
`;

const boot = pages => bootRenderHarness({
  fonts: 'none', extraWat: EXTRA_WAT,
  memory: new WebAssembly.Memory({ initial: pages, maximum: pages, shared: true }),
});

// Fill the primary pool with commits of this size, leaving the tail free, so
// the next request cannot be placed under 0x1BC00000 in one piece.
const CHUNK = 16 * 1024 * 1024;

// Commit until either the pool refuses or a commit comes back on extension
// backing, whichever happens first. `guest` is then the next free guest
// address and `spilled` the request that crossed over, if any.
function fillPrimary(e) {
  const poolSize = REGIONS.VIRTUAL_BACKING_BASE.size;
  let guest = 0x60000000, placed = 0, spilled = 0;
  for (let i = 0; i < poolSize / CHUNK + 4; i++) {
    if (!(e.commit(guest, CHUNK) >>> 0)) break;
    if ((e.backing_of(guest) >>> 0) >= EXT_BASE) { spilled = guest; guest += CHUNK; break; }
    placed += CHUNK; guest += CHUNK;
  }
  return { placed, guest, spilled };
}

(async () => {
  // --- 512MB: the default every host has always created. No extension at all.
  {
    const { exports: e } = await boot(8192);
    assert.strictEqual(e.ext_base() >>> 0, EXT_BASE);
    assert.strictEqual(e.ext_end() >>> 0, 0, 'no window above a 512MB memory');
    assert.strictEqual(e.ext_cursor() >>> 0, EXT_BASE, 'cursor still parks at the base');
    assert.strictEqual(e.capacity() >>> 0, REGIONS.VIRTUAL_BACKING_BASE.size);
    assert.ok(e.available() >>> 0 <= REGIONS.VIRTUAL_BACKING_BASE.size);
    const { placed, guest } = fillPrimary(e);
    assert.ok(placed > 0.9 * REGIONS.VIRTUAL_BACKING_BASE.size, `only placed ${placed}`);
    // The pool is spent, and there is nowhere else: the split fallback halves
    // this down to the 64KB granule and still cannot place it.
    assert.strictEqual(e.commit(guest, CHUNK) >>> 0, 0, 'exhaustion is still exhaustion');
  }

  // --- 1GB: the same build, with the window behind it.
  {
    const { exports: e } = await boot(16384);
    assert.strictEqual(e.ext_end() >>> 0, 0x40000000, 'window runs to the end of memory');
    assert.strictEqual(e.capacity() >>> 0,
      (REGIONS.VIRTUAL_BACKING_BASE.size + 0x40000000 - EXT_BASE) >>> 0);
    const { placed, guest, spilled } = fillPrimary(e);
    assert.ok(spilled, 'a commit should have crossed into the extension');
    assert.ok(placed > 0.9 * REGIONS.VIRTUAL_BACKING_BASE.size,
      `crossed over with only ${placed} bytes of the primary pool spent`);
    const backing = e.backing_of(spilled) >>> 0;
    assert.strictEqual(backing, EXT_BASE, 'the first ext commit sits at the window base');
    assert.strictEqual(e.ext_cursor() >>> 0, (EXT_BASE + CHUNK) >>> 0);
    const before = e.available() >>> 0;
    // Guest bytes committed up there must survive a round trip; a PTE that
    // truncated the backing address would read back somebody else's memory.
    e.guest_write32(spilled, 0x5a5a1234);
    e.guest_write32(spilled + CHUNK - 4, 0x0badc0de);
    assert.strictEqual(e.guest_read32(spilled) >>> 0, 0x5a5a1234);
    assert.strictEqual(e.guest_read32(spilled + CHUNK - 4) >>> 0, 0x0badc0de);
    assert.strictEqual(e.backing_of(spilled + CHUNK - 4) >>> 0, backing + CHUNK - 4);
    // A second commit continues the bump rather than aliasing the first.
    assert.strictEqual(e.commit(guest, CHUNK) >>> 0, guest);
    assert.strictEqual(e.backing_of(guest) >>> 0, backing + CHUNK);
    assert.strictEqual(e.available() >>> 0, before - CHUNK, 'available tracks the ext cursor');
    assert.strictEqual(e.guest_read32(spilled) >>> 0, 0x5a5a1234, 'first commit intact');
  }
  console.log('PASS sparse backing extension: absent on 512MB, takes over-pool commits on 1GB');
})().catch(error => { console.error(error); process.exitCode = 1; });
