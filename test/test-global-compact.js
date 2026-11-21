#!/usr/bin/env node
'use strict';

// GlobalCompact is a live Civ II MGE import. Win32 global allocations use the
// process heap, so this legacy entry point must report the same largest free
// block as HeapCompact(GetProcessHeap(), 0), not terminate the application.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

const ROOT = path.join(__dirname, '..');
const STACK = 0x00300000;

const extraWat = String.raw`
  (func (export "test_global_compact") (param $minimum i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const ${STACK}))
    (call $handle_GlobalCompact
      (local.get $minimum) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_heap_compact")
      (param $heap i32) (param $flags i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const ${STACK}))
    (call $handle_HeapCompact
      (local.get $heap) (local.get $flags) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_compact_esp") (result i32)
    (i32.load offset=16 (global.get $reg_base)))

  (func (export "test_process_heap") (result i32)
    (global.get $PROCESS_HEAP_HANDLE))

  (func (export "test_set_last_error") (param $value i32)
    (global.set $last_error (local.get $value)))

`;

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none' });
  e.init_thread(1, 0x00400000, 0, 0, 0, 0, 0);
  e.heap_init(0x00420000);

  const first = e.guest_alloc(64) >>> 0;
  const middle = e.guest_alloc(256) >>> 0;
  const last = e.guest_alloc(64) >>> 0;
  assert(first && middle && last, 'test heap allocations succeeded');
  e.guest_free(middle);

  const processHeap = e.test_process_heap() >>> 0;
  const heapLargest = e.test_heap_compact(processHeap, 0) >>> 0;
  assert(heapLargest >= 256,
    'HeapCompact observes the released middle allocation');
  assert.strictEqual(e.test_compact_esp() >>> 0, STACK + 12,
    'HeapCompact retains its two-argument stdcall cleanup');

  assert.strictEqual(e.test_global_compact(0) >>> 0, heapLargest,
    'GlobalCompact reports the process heap largest free block');
  assert.strictEqual(e.test_compact_esp() >>> 0, STACK + 8,
    'GlobalCompact performs its one-argument stdcall cleanup');
  assert.strictEqual(e.test_global_compact(0xffffffff) >>> 0, heapLargest,
    'the Win16 minimum-free hint does not invent or hide Win32 heap space');

  e.test_set_last_error(0x1234);
  assert.strictEqual(e.test_heap_compact(processHeap, 2), 0,
    'HeapCompact rejects flags other than HEAP_NO_SERIALIZE');
  assert.strictEqual(e.test_get_last_error(), 87,
    'unsupported flags report ERROR_INVALID_PARAMETER');
  assert.strictEqual(e.test_heap_compact(0x12345678, 0), 0,
    'HeapCompact rejects a forged heap handle');
  assert.strictEqual(e.test_get_last_error(), 6,
    'a forged heap handle reports ERROR_INVALID_HANDLE');
  assert.strictEqual(e.test_heap_compact(processHeap, 1) >>> 0, heapLargest,
    'HEAP_NO_SERIALIZE is the one supported call flag');

  e.guest_free(first);
  e.guest_free(last);
  const coalesced = e.test_global_compact(0) >>> 0;
  assert(coalesced > heapLargest,
    `the result tracks the allocator's real coalesced free list (${coalesced} > ${heapLargest})`);
  assert.strictEqual(e.test_get_last_error(), 0,
    'successful compaction leaves NO_ERROR even when returning real free space');

  const api = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'src', 'api_table.json'), 'utf8'))
    .find(entry => entry.name === 'GlobalCompact');
  assert.deepStrictEqual(
    { nargs: api.nargs, convention: api.convention },
    { nargs: 1, convention: 'stdcall' },
    'dispatch metadata preserves GlobalCompact\'s public ABI');

  const source = fs.readFileSync(
    path.join(ROOT, 'src', '09a-handlers2-runtime.wat'), 'utf8');
  const body = source.split('(func $handle_GlobalCompact', 2)[1]
    .split('\n  (func $handle_', 1)[0];
  assert(!body.includes('$crash_unimplemented'),
    'GlobalCompact no longer terminates a guest');
  assert(body.includes('$handle_HeapCompact'),
    'GlobalCompact reuses the canonical process-heap compaction path');

  console.log('PASS  GlobalCompact reports the process heap largest free block');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
