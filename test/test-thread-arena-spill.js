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
  const [ALLOC, END, BASE, SPILL, SPILL_BASE, SPILL_END, PENDING, ENTERS] = [0, 1, 2, 3, 4, 5, 6, 7];

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
