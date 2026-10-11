#!/usr/bin/env node
'use strict';

// A full decoded-code arena whose flush has to wait (a nested synchronous run
// still executes out of it) used to keep decoding past THREAD_END, into the
// next thread's partition. On Serious Sam that rewrote the winmm timer
// thread's callback stream; the timer thread then ran main's zlib copy loop
// with a count of -1 and the copy walked guest memory into main's registers.
// Now the thread decodes into its own $THREAD_SPILL slot until the deferred
// flush runs, and no emit may cross THREAD_END at all.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createHostImports } = require('../lib/host-imports');
const { compileSrcWasm } = require('./compile-src');

async function main() {
  const wasm = compileSrcWasm();
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { getMemory: () => memory.buffer, renderer: null, resourceJson: {} };
  const base = createHostImports(ctx);
  base.host.memory = memory;
  const logged = [];
  base.host.log_i32 = v => logged.push(v >>> 0);
  base.host.create_thread = () => 0;
  base.host.exit_thread = () => 0;
  base.host.terminate_thread = () => 0;
  base.host.create_event = () => 0;
  base.host.set_event = () => 0;
  base.host.reset_event = () => 0;
  base.host.wait_single = () => 0;
  base.host.wait_multiple = () => 0;
  const { instance } = await WebAssembly.instantiate(wasm, base);
  const x = instance.exports;
  ctx.exports = x;
  const get = k => x.test_arena_get(k) >>> 0;
  const [ALLOC, END, BASE, SPILL, SPILL_BASE, SPILL_END, PENDING, ENTERS, RECYCLES, PINS, DEPTH] =
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  // The pins are only true if every nesting change is seen: no bare
  // increment or decrement of $sync_msg_depth outside its two helpers.
  const srcDir = path.join(__dirname, '..', 'src');
  for (const f of fs.readdirSync(srcDir).filter(n => n.endsWith('.wat'))) {
    const text = fs.readFileSync(path.join(srcDir, f), 'utf8');
    const bare = text.match(/global\.set \$sync_msg_depth\s+\(i32\.(add|sub)/g) || [];
    const allowed = f === '04-cache.wat' ? 2 : 0;
    assert.strictEqual(bare.length, allowed,
      `${f}: change $sync_msg_depth through $sync_depth_enter/$sync_depth_leave`);
  }

  // Main thread layout: the spill slot is outside the arena, and 0x80000 long.
  const end0 = get(END);
  assert.ok(get(SPILL_BASE) >= end0 || get(SPILL_END) <= get(BASE), 'spill slot outside the arena');
  assert.strictEqual(get(SPILL_END) - get(SPILL_BASE), 0x80000);

  // Not nested and full: the flush runs, nothing spills.
  x.test_arena_set_alloc(end0 - 100);
  x.test_arena_set_depth(0);
  x.test_arena_reserve();
  assert.strictEqual(get(ALLOC), get(BASE), 'a free flush rewinds to the base');
  assert.strictEqual(get(SPILL), 0);

  // Nested and full: the flush defers, the allocator moves into the spill slot.
  x.test_arena_set_alloc(end0 - 100);
  x.test_arena_set_depth(1);
  x.test_arena_reserve();
  assert.strictEqual(get(SPILL), 1, 'nested and full: spill');
  assert.strictEqual(get(ALLOC), get(SPILL_BASE));
  assert.strictEqual(get(END), get(SPILL_END), 'THREAD_END is the spill end while spilled');
  assert.strictEqual(get(PENDING), 1, 'the real flush stays pending');
  assert.strictEqual(get(ENTERS), 1);
  x.test_arena_emit(0x1234);
  assert.strictEqual(get(ALLOC), get(SPILL_BASE) + 4, 'emits land in the spill slot');
  // Still nested: a second reserve does not re-enter or move anything.
  x.test_arena_reserve();
  assert.strictEqual(get(ENTERS), 1);

  // The spill fills while still nested (Serious Sam's fault-filter run inflates
  // level files at depth 1 and filled main's 512KB slot at batch 1865). No
  // suspended frame resumes into the spill, so it starts over from its base.
  x.test_arena_set_alloc(get(SPILL_END) - 100);
  x.test_arena_reserve();
  assert.strictEqual(get(RECYCLES), 1, 'a full spill with no pins recycles');
  assert.strictEqual(get(ALLOC), get(SPILL_BASE), 'from the spill base');
  assert.strictEqual(get(SPILL), 1, 'still spilled');
  assert.strictEqual(get(END), get(SPILL_END));
  assert.strictEqual(get(PENDING), 1, 'the real flush is still owed');
  assert.strictEqual(get(ENTERS), 1, 'recycling is not a second enter');

  // A frame that was executing OUT OF THE SPILL when it started a nested run
  // pins it: recycling would rewrite the block it returns into.
  x.test_arena_set_depth(0);
  x.test_arena_set_ip(get(SPILL_BASE) + 0x40);
  x.test_arena_depth_enter();
  assert.strictEqual(get(DEPTH), 1);
  assert.strictEqual(get(PINS), 1, 'depth-0 frame suspended in the spill: bit 0');
  x.test_arena_set_alloc(get(SPILL_END) - 100);
  x.test_arena_reserve();
  assert.strictEqual(get(RECYCLES), 1, 'pinned: no recycle');
  assert.strictEqual(get(ALLOC), get(SPILL_END) - 100, 'pinned: nothing moved');
  // One level deeper the same pin still forbids it (bit 0 is below depth 2).
  x.test_arena_set_ip(get(BASE) + 0x40);
  x.test_arena_depth_enter();
  assert.strictEqual(get(PINS), 1, 'a frame in the main arena adds no pin');
  x.test_arena_reserve();
  assert.strictEqual(get(RECYCLES), 1, 'a pin below the current depth still forbids it');
  x.test_arena_depth_leave();
  // The pinned frame resumes (its nested run returned): its pin goes with it.
  x.test_arena_depth_leave();
  assert.strictEqual(get(DEPTH), 0);
  assert.strictEqual(get(PINS), 0, 'leaving depth 1 clears bit 0');

  // A frame suspended in the main arena does not stop the nested run from
  // recycling: main-arena blocks are never reused while spilled.
  x.test_arena_set_ip(get(BASE) + 0x40);
  x.test_arena_depth_enter();
  assert.strictEqual(get(PINS), 0);
  x.test_arena_reserve();
  assert.strictEqual(get(RECYCLES), 2, 'main-arena frame below: recycle');
  assert.strictEqual(get(ALLOC), get(SPILL_BASE));

  // A pin ABOVE the current depth's frames is irrelevant: a frame pinned at
  // depth 1 does not exist once the run is back at depth 1.
  x.test_arena_set_ip(get(SPILL_BASE) + 0x80);
  x.test_arena_depth_enter();
  assert.strictEqual(get(PINS), 2, 'depth-1 frame in the spill: bit 1');
  x.test_arena_depth_leave();
  assert.strictEqual(get(PINS), 0);
  x.test_arena_set_alloc(get(SPILL_END) - 100);
  x.test_arena_reserve();
  assert.strictEqual(get(RECYCLES), 3);
  x.test_arena_depth_leave();
  x.test_arena_set_depth(1);
  x.test_arena_set_alloc(get(SPILL_BASE) + 4);

  // The nested run ends: the deferred flush restores the real arena.
  x.test_arena_set_depth(0);
  assert.strictEqual(x.test_arena_flush(), 1);
  assert.strictEqual(get(SPILL), 0);
  assert.strictEqual(get(END), end0, 'THREAD_END restored');
  assert.strictEqual(get(ALLOC), get(BASE));

  // The guard: no emit may cross THREAD_END, spilled or not.
  x.test_arena_set_alloc(end0 - 2);
  assert.throws(() => x.test_arena_emit(0xDEAD), /unreachable/, 'emit past THREAD_END traps');
  assert.ok(logged.includes(0xCA00F11F), 'the exhaustion marker is logged');

  console.log('PASS  decoded-code arena spills when a nested run blocks the flush, and never writes past THREAD_END');
}

main().catch(e => { console.error(e); process.exit(1); });
