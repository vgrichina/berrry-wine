#!/usr/bin/env node

'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const PROCESS_HEAP = 0x00beef00;
const LAST_ERROR_SENTINEL = 0x13572468;

const extraWat = String.raw`
  (func (export "test_heap_validate")
      (param $heap i32) (param $flags i32) (param $ptr i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_HeapValidate
      (local.get $heap) (local.get $flags) (local.get $ptr)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_heap_create") (result i32)
    (local $saved_esp i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_HeapCreate
      (i32.const 0) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_heap_destroy") (param $heap i32) (result i32)
    (local $saved_esp i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_HeapDestroy
      (local.get $heap) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_heap_alloc")
      (param $heap i32) (param $size i32) (result i32)
    (local $saved_esp i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_HeapAlloc
      (local.get $heap) (i32.const 0) (local.get $size)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_heap_free") (param $heap i32) (param $ptr i32) (result i32)
    (local $saved_esp i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_HeapFree
      (local.get $heap) (i32.const 0) (local.get $ptr)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_set_last_error") (param $value i32)
    (global.set $last_error (local.get $value)))
  (func (export "test_get_esp") (result i32)
    (i32.load offset=16 (global.get $reg_base)))
`;

(async () => {
  const memory = new WebAssembly.Memory({
    initial: 8192,
    maximum: 8192,
    shared: true,
  });
  const main = await bootRenderHarness({ extraWat, fonts: 'none', memory });
  const worker = await bootRenderHarness({ extraWat, fonts: 'none', memory });
  const a = main.exports;
  const b = worker.exports;

  a.init_thread(1, 0x00400000, 0, 0, 0, 0, 0);
  a.heap_init(0x00420000);
  b.init_thread(2, 0x00400000, 0, 0, 0, 0, 0);

  a.test_set_last_error(LAST_ERROR_SENTINEL);
  assert.strictEqual(a.test_heap_validate(PROCESS_HEAP, 0, 0), 1,
    'an untouched process heap has a valid empty arena set');
  assert.strictEqual(a.test_get_esp() >>> 0, 0x00300010,
    'HeapValidate pops three stdcall arguments');
  assert.strictEqual(a.test_get_last_error() >>> 0, LAST_ERROR_SENTINEL,
    'success leaves last error unchanged');
  assert.strictEqual(a.test_heap_validate(PROCESS_HEAP, 1, 0), 1,
    'HEAP_NO_SERIALIZE is the one supported access flag');
  assert.strictEqual(a.test_heap_validate(PROCESS_HEAP, 0x08, 0), 0,
    'unsupported heap flags are rejected');
  assert.strictEqual(a.test_get_last_error() >>> 0, LAST_ERROR_SENTINEL,
    'flag failure leaves last error unchanged');
  assert.strictEqual(a.test_heap_validate(0x00410004, 0, 0), 0,
    'an unmapped forged heap handle is rejected without dereferencing it');

  const privateHeap = a.test_heap_create() >>> 0;
  assert(privateHeap, 'HeapCreate returns a private heap record');
  assert.strictEqual(a.test_heap_validate(privateHeap, 0, 0), 1,
    'a live private heap record is accepted');
  assert.strictEqual(a.test_heap_validate(privateHeap, 1, 0), 1,
    'private heaps also accept HEAP_NO_SERIALIZE');

  const block = a.test_heap_alloc(privateHeap, 64) >>> 0;
  assert(block, 'HeapAlloc creates a block to validate');
  assert.strictEqual(a.test_heap_validate(privateHeap, 0, block), 1,
    'an exact live allocation validates');
  assert.strictEqual(a.test_heap_validate(privateHeap, 0, block + 1), 0,
    'an unaligned interior pointer is rejected');
  a.guest_write32(block + 12, 16);
  assert.strictEqual(a.test_heap_validate(privateHeap, 0, block + 16), 0,
    'a plausible header planted before an aligned interior pointer is rejected');
  assert.strictEqual(a.test_heap_validate(privateHeap, 0, 0xfffffff4), 0,
    'a wrapped forged block pointer is rejected safely');

  assert.strictEqual(a.test_heap_free(privateHeap, block), 1);
  assert.strictEqual(a.test_heap_validate(privateHeap, 0, block), 0,
    'a block on this instance\'s free list does not validate');
  assert.strictEqual(a.test_heap_validate(privateHeap, 0, 0), 1,
    'a structurally sound heap containing a free block still validates');

  const remote = b.test_heap_alloc(privateHeap, 48) >>> 0;
  assert(remote, 'a second Worker can allocate from the shared heap model');
  assert.strictEqual(a.test_heap_validate(privateHeap, 0, remote), 1,
    'shared arena metadata proves another Worker\'s live allocation');
  assert.strictEqual(b.test_heap_free(privateHeap, remote), 1);
  assert.strictEqual(b.test_heap_validate(privateHeap, 0, remote), 0,
    'the freeing Worker sees its free-list membership');
  assert.strictEqual(a.test_heap_validate(privateHeap, 0, remote), 0,
    'shared live-byte accounting prevents another Worker blessing the freed block');
  assert.strictEqual(a.test_heap_validate(privateHeap, 0, 0), 0,
    'whole-heap validation fails conservatively when a remote free list is unobservable');

  const corrupt = a.test_heap_alloc(privateHeap, 32) >>> 0;
  assert(corrupt, 'a local block is available for header-integrity coverage');
  const originalHeader = a.guest_read32(corrupt - 4) >>> 0;
  a.guest_write32(corrupt - 4, 8);
  assert.strictEqual(a.test_heap_validate(privateHeap, 0, corrupt), 0,
    'an undersized allocation header is invalid');
  assert.strictEqual(a.test_heap_validate(privateHeap, 0, 0), 0,
    'whole-heap validation detects the malformed extent');
  a.guest_write32(corrupt - 4, originalHeader);

  assert.strictEqual(a.test_heap_destroy(privateHeap), 1);
  assert.strictEqual(a.test_heap_validate(privateHeap, 0, 0), 0,
    'a destroyed private heap record is not a valid handle');
  assert.strictEqual(a.test_get_last_error() >>> 0, LAST_ERROR_SENTINEL,
    'all HeapValidate failures leave last error unchanged');

  console.log('PASS  HeapValidate proves exact live blocks and bounded heap integrity');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
