#!/usr/bin/env node
'use strict';

// The downward reserve cursor is a bump allocator over guest ADDRESS SPACE, and
// it used to be one-way: nothing ever handed a released reservation's range
// back. Warcraft III's campaign load churns reserve/release at ~5MB/s of
// address space, so it walked the cursor from VIRTUAL_ALLOC_TOP_INIT to
// VIRTUAL_ALLOC_MIN in six minutes and then failed every allocation while
// three quarters of the backing pool was still free. Address-space exhaustion
// and backing exhaustion both reach the guest as a NULL VirtualAlloc, which is
// why this needs its own test rather than a bigger pool.

const assert = require('assert');
const path = require('path');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');
const RegionMap = require('../lib/region-map.generated.js');

const MAP_STATE = RegionMap.BASE.VIRTUAL_MAP_STATE;

const extraWat = String.raw`
  (func (export "test_reserve_reset")
    (call $zero_memory (global.get $VIRTUAL_MAP_STATE)
      (i32.add (global.get $VIRTUAL_MAP_STATE_SIZE)
        (global.get $VIRTUAL_MAP_TABLE_SIZE)))
    (call $zero_memory (global.get $VIRTUAL_RESERVE_TABLE)
      (global.get $VIRTUAL_RESERVE_TABLE_SIZE))
    (call $zero_memory (global.get $VIRTUAL_HOLE_TABLE)
      (global.get $VIRTUAL_HOLE_TABLE_SIZE))
    (call $zero_memory (global.get $GUEST_PAGE_TABLE)
      (global.get $GUEST_PAGE_TABLE_SIZE))
    (i32.store (region.addr $VIRTUAL_MAP_STATE 4)
      (global.get $VIRTUAL_BACKING_BASE))
    (global.set $virtual_alloc_top (global.get $VIRTUAL_ALLOC_TOP_INIT))
    (global.set $heap_sparse_ptr (i32.const 0))
    (global.set $heap_sparse_end (i32.const 0)))
  (func (export "test_alloc_top_init") (result i32)
    (global.get $VIRTUAL_ALLOC_TOP_INIT))
  (func (export "test_alloc_min") (result i32)
    (global.get $VIRTUAL_ALLOC_MIN))
  ;; MEM_RESERVE only (0x2000): address space with no backing and no record.
  (func (export "test_reserve") (param $size i32) (result i32)
    (global.set $esp (i32.const 0x00500000))
    (call $handle_VirtualAlloc
      (i32.const 0) (local.get $size) (i32.const 0x2000)
      (i32.const 0x04) (i32.const 0) (i32.const 0))
    (global.get $eax))
  ;; MEM_RESERVE|MEM_COMMIT (0x3000): one call, one record.
  (func (export "test_reserve_commit") (param $size i32) (result i32)
    (global.set $esp (i32.const 0x00500000))
    (call $handle_VirtualAlloc
      (i32.const 0) (local.get $size) (i32.const 0x3000)
      (i32.const 0x04) (i32.const 0) (i32.const 0))
    (global.get $eax))
  (func (export "test_commit_at") (param $guest i32) (param $size i32) (result i32)
    (global.set $esp (i32.const 0x00500000))
    (call $handle_VirtualAlloc
      (local.get $guest) (local.get $size) (i32.const 0x1000)
      (i32.const 0x04) (i32.const 0) (i32.const 0))
    (global.get $eax))
  (func (export "test_release") (param $guest i32) (result i32)
    (global.set $esp (i32.const 0x00500000))
    (call $handle_VirtualFree
      (local.get $guest) (i32.const 0) (i32.const 0x8000)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (global.get $eax))
`;

async function main() {
  const wasmBytes = compileSrcWasm((filename, source) =>
    filename === '13-exports.wat' ? `${source}\n${extraWat}\n` : source);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const context = {
    getMemory: () => memory.buffer,
    renderer: null,
    resourceJson: { menus: {}, dialogs: {}, strings: {}, bitmaps: {} },
    onExit: () => {},
  };
  const imports = createHostImports(context);
  imports.host.memory = memory;
  for (const name of ['create_thread', 'exit_thread', 'terminate_thread',
    'create_event', 'set_event', 'reset_event', 'wait_single', 'wait_multiple']) {
    imports.host[name] = () => 0;
  }
  imports.host.com_create_instance = () => 0x80004002;
  const { instance } = await WebAssembly.instantiate(wasmBytes, imports);
  context.exports = instance.exports;
  const e = instance.exports;
  const view = new DataView(memory.buffer);
  const cursor = () => view.getUint32(MAP_STATE + 8, true) >>> 0;
  const reserveCount = () => view.getUint32(MAP_STATE + 16, true) >>> 0;
  const TOP = e.test_alloc_top_init() >>> 0;
  const MIN = e.test_alloc_min() >>> 0;

  // 1. Reserve+commit then release, repeatedly. Every cycle must hand the same
  //    address back: this is the shape a loader that loads and unloads assets
  //    produces, and the one that used to walk the cursor to the floor.
  e.test_reserve_reset();
  const first = e.test_reserve_commit(0x100000) >>> 0;
  assert.notStrictEqual(first, 0, 'the first reserve+commit must succeed');
  assert.strictEqual(e.test_release(first) >>> 0, 1, 'MEM_RELEASE must succeed');
  assert.strictEqual(cursor(), TOP,
    'releasing the only reservation must give the whole arena back');
  for (let i = 0; i < 64; i++) {
    const block = e.test_reserve_commit(0x100000) >>> 0;
    assert.strictEqual(block, first, `cycle ${i} must reuse the released address`);
    assert.strictEqual(e.test_release(block) >>> 0, 1, `cycle ${i} release`);
  }

  // 2. A live neighbour bounds the reclaim: the cursor may come back only as
  //    far as the lowest range still owned, never past it.
  e.test_reserve_reset();
  const keep = e.test_reserve_commit(0x100000) >>> 0;
  const temp = e.test_reserve_commit(0x100000) >>> 0;
  assert(temp < keep, 'the arena grows downward');
  assert.strictEqual(e.test_release(temp) >>> 0, 1, 'releasing the lower block');
  assert.strictEqual(cursor(), keep,
    'the reclaim must stop at the lowest mapping still live');

  // 3. A MEM_RESERVE with no commit has no map record, so a reclaim that took
  //    the minimum over records alone would hand its range out twice. This is
  //    Warcraft III's actual shape -- reserve a range, commit part of it -- and
  //    it is why uncommitted reservations get their own table.
  e.test_reserve_reset();
  const bare = e.test_reserve(0x200000) >>> 0;
  assert.notStrictEqual(bare, 0, 'a bare MEM_RESERVE must succeed');
  assert.strictEqual(reserveCount(), 1, 'the bare reservation must be recorded');
  const partial = e.test_commit_at(bare + 0x100000, 0x10000) >>> 0;
  assert.strictEqual(partial, bare + 0x100000, 'committing part of it must succeed');
  const below = e.test_reserve_commit(0x10000) >>> 0;
  assert(below < bare, 'the next reservation sits below the bare one');
  assert.strictEqual(e.test_release(below) >>> 0, 1, 'release the block below');
  assert.strictEqual(cursor(), bare,
    'the reclaim must not rise above a reservation that was never committed');
  const again = e.test_reserve_commit(0x10000) >>> 0;
  assert.strictEqual(again, below,
    'the space below the bare reservation is reusable, the reservation is not');

  // Releasing the bare reservation itself drops its entry, even though it has
  // no map record for the release path to find.
  assert.strictEqual(e.test_release(again) >>> 0, 1, 'release the reused block');
  assert.strictEqual(e.test_release(bare + 0x100000) >>> 0, 1, 'release the committed part');
  assert.strictEqual(e.test_release(bare) >>> 0, 1, 'release the bare reservation');
  assert.strictEqual(reserveCount(), 0, 'its table entry must be gone');
  assert.strictEqual(cursor(), TOP, 'and the whole arena must come back');

  // 4. The churn that broke it: many reservations live at once, each partly
  //    committed, allocated and released out of order. The cursor must stay
  //    far from the floor rather than marching toward it.
  e.test_reserve_reset();
  const live = [];
  for (let i = 0; i < 200; i++) {
    const block = e.test_reserve(0x40000) >>> 0;
    assert.notStrictEqual(block, 0, `churn reserve ${i} must succeed`);
    assert.strictEqual(e.test_commit_at(block, 0x10000) >>> 0, block,
      `churn commit ${i} must succeed`);
    live.push(block);
    // Drop an older one every other round, oldest first: out-of-order release
    // is what makes the reclaim a minimum rather than a stack pop.
    if (i % 2 === 1) {
      const dead = live.shift();
      assert.strictEqual(e.test_release(dead) >>> 0, 1, `churn release ${i}`);
    }
  }
  assert(cursor() > MIN + (TOP - MIN) / 2,
    `churn must not walk the cursor toward the floor (cursor 0x${cursor().toString(16)})`);
  // Releasing the survivors walks it all the way back: nothing is leaked, and
  // the cursor is a function of what is live, not of how much has ever been
  // reserved.
  for (const block of live) assert.strictEqual(e.test_release(block) >>> 0, 1);
  assert.strictEqual(reserveCount(), 0, 'no reservation entry may outlive its range');
  assert.strictEqual(cursor(), TOP,
    'a fully drained arena must hand back every address it ever reserved');

  console.log('PASS  released reservations give their guest address space back');
}

main().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
