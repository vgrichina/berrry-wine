#!/usr/bin/env node

'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_map_affinity") (param i32) (result i32)
    (call $virtual_map_commit (local.get 0) (i32.const 4096)))
  (func (export "test_alloc") (param $bytes i32) (result i32)
    (call $heap_alloc (local.get $bytes)))
  (func (export "test_peek32") (param $ptr i32) (result i32)
    (call $gl32 (local.get $ptr)))
  (func (export "test_poke32") (param $ptr i32) (param $value i32)
    (call $gs32 (local.get $ptr) (local.get $value)))
  (func (export "test_process_id") (result i32)
    (call $current_process_id))
  (func (export "test_open_process") (param $pid i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_OpenProcess
      (i32.const 0x0400) (i32.const 0) (local.get $pid)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_get_process_affinity")
      (param $process i32) (param $process_mask i32) (param $system_mask i32)
      (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_GetProcessAffinityMask
      (local.get $process) (local.get $process_mask) (local.get $system_mask)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_set_thread_affinity")
      (param $thread i32) (param $mask i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_SetThreadAffinityMask
      (local.get $thread) (local.get $mask) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_set_last_error") (param $value i32)
    (global.set $last_error (local.get $value)))
`;

(async () => {
  const CURRENT_PROCESS = -1;
  const CURRENT_THREAD = -2;
  const REAL_THREAD = 0x0e1000;
  const main = { priority: 0 };
  const worker = { priority: 1 };
  const resolve = (handle, tid) => {
    handle >>>= 0;
    tid >>>= 0;
    if (handle === 0xfffffffe) return tid === 1 ? main : tid === 2 ? worker : null;
    return handle === REAL_THREAD ? worker : null;
  };
  const affinityValidationCalls = [];

  const { exports: e } = await bootRenderHarness({
    extraWat,
    fonts: 'none',
    extraHostOverrides: {
      get_thread_priority: (handle, tid) => {
        affinityValidationCalls.push([handle >>> 0, tid >>> 0]);
        const thread = resolve(handle, tid);
        return thread ? thread.priority : 0x7fffffff;
      },
    },
  });

  const processMask = e.test_alloc(4) >>> 0;
  const systemMask = e.test_alloc(4) >>> 0;
  const page = 0x30000000, unrelated = 0x28000000;
  for (const ga of [page, unrelated, page + 4096]) assert.strictEqual(e.test_map_affinity(ga) >>> 0, ga);
  assert.notStrictEqual(e.guest_to_wasm(page + 4096), e.guest_to_wasm(page) + 4096);
  const bytes = (ga, n) => Array.from({ length: n }, (_, i) => e.guest_read8(ga + i));
  for (let i = 0; i < 4096; i++) e.guest_write8(unrelated + i, 0xa5);
  for (let split = 1; split <= 4; split++) for (const field of [0, 1]) {
    const edge = page + 4096 - split;
    const pointers = field === 0 ? [edge, systemMask] : [processMask, edge];
    for (const handle of [CURRENT_PROCESS, 0x7777]) {
      for (let i = -1; i <= 4; i++) e.guest_write8(edge + i, 0xcc);
      const other = pointers[1 - field];
      e.test_poke32(other, 0xcccccccc);
      e.test_set_last_error(0x1234);
      const valid = handle === CURRENT_PROCESS;
      assert.strictEqual(e.test_get_process_affinity(handle, ...pointers), valid ? 1 : 0);
      assert.strictEqual(e.get_esp() >>> 0, 0x00300010);
      assert.strictEqual(e.test_get_last_error(), valid ? 0x1234 : 6);
      assert.deepStrictEqual(bytes(edge - 1, 6), valid
        ? [0xcc, 1, 0, 0, 0, 0xcc] : Array(6).fill(0xcc), `field ${field} split ${split}`);
      assert.strictEqual(e.test_peek32(other) >>> 0, valid ? 1 : 0xcccccccc);
    }
  }
  assert.deepStrictEqual(bytes(unrelated, 4096), Array(4096).fill(0xa5));
  e.test_poke32(processMask, 0x12345678);
  e.test_poke32(systemMask, 0x76543210);
  e.test_set_last_error(0x1111);
  assert.strictEqual(
    e.test_get_process_affinity(CURRENT_PROCESS, processMask, systemMask), 1,
    'the current-process pseudo-handle has an affinity mask');
  assert.strictEqual(e.test_peek32(processMask), 1,
    'the browser process is confined to its one modeled logical CPU');
  assert.strictEqual(e.test_peek32(systemMask), 1,
    'the browser Win98 machine exposes one system logical CPU');
  assert.strictEqual(e.test_get_last_error(), 0x1111,
    'successful GetProcessAffinityMask preserves LastError');
  assert.strictEqual(e.get_esp() >>> 0, 0x00300010,
    'GetProcessAffinityMask pops its three stdcall arguments');

  const process = e.test_open_process(e.test_process_id()) >>> 0;
  assert.notStrictEqual(process, 0,
    'OpenProcess returns a durable handle for the modeled process');
  assert.strictEqual(e.test_get_process_affinity(process, processMask, systemMask), 1,
    'a durable current-process handle observes the same affinity');

  e.test_poke32(processMask, 0x13579bdf);
  e.test_poke32(systemMask, 0x2468ace0);
  assert.strictEqual(e.test_get_process_affinity(0x7777, processMask, systemMask), 0,
    'a fabricated process handle is rejected');
  assert.strictEqual(e.test_get_last_error(), 6,
    'GetProcessAffinityMask reports ERROR_INVALID_HANDLE');
  assert.strictEqual(e.test_peek32(processMask) >>> 0, 0x13579bdf,
    'failure leaves the process-mask output undefined rather than fabricating data');
  assert.strictEqual(e.test_peek32(systemMask) >>> 0, 0x2468ace0,
    'failure does not fabricate a system mask either');

  e.test_set_last_error(0x2222);
  assert.strictEqual(e.test_set_thread_affinity(CURRENT_THREAD, 1), 1,
    'the current thread accepts the only processor in the browser machine');
  assert.deepStrictEqual(affinityValidationCalls.pop(), [0xfffffffe, 1],
    'the current-thread pseudo-handle resolves in the calling thread context');
  assert.strictEqual(e.test_get_last_error(), 0x2222,
    'successful SetThreadAffinityMask preserves LastError');
  assert.strictEqual(e.get_esp() >>> 0, 0x0030000c,
    'SetThreadAffinityMask pops its two stdcall arguments');

  e.set_current_thread_id(2);
  assert.strictEqual(e.test_set_thread_affinity(CURRENT_THREAD, 1), 1,
    'a worker current-thread pseudo-handle resolves to that worker');
  assert.deepStrictEqual(affinityValidationCalls.pop(), [0xfffffffe, 2]);
  assert.strictEqual(e.test_set_thread_affinity(REAL_THREAD, 1), 1,
    'a durable worker handle accepts the single-CPU mask');
  assert.deepStrictEqual(affinityValidationCalls.pop(), [REAL_THREAD, 2]);

  assert.strictEqual(e.test_set_thread_affinity(REAL_THREAD, 0), 0,
    'an empty affinity mask is not a subset selecting a runnable CPU');
  assert.strictEqual(e.test_get_last_error(), 87,
    'an empty mask reports ERROR_INVALID_PARAMETER');
  assert.strictEqual(e.test_set_thread_affinity(REAL_THREAD, 2), 0,
    'a mask outside the modeled process affinity is rejected');
  assert.strictEqual(e.test_get_last_error(), 87,
    'an out-of-process mask reports ERROR_INVALID_PARAMETER');

  assert.strictEqual(e.test_set_thread_affinity(0x7777, 1), 0,
    'a fabricated thread handle cannot claim affinity success');
  assert.strictEqual(e.test_get_last_error(), 6,
    'SetThreadAffinityMask reports ERROR_INVALID_HANDLE');
  assert.strictEqual(e.test_set_thread_affinity(0x7777, 2), 0,
    'handle validation precedes interpretation of a fabricated thread mask');
  assert.strictEqual(e.test_get_last_error(), 6,
    'the invalid handle remains the reported failure');

  console.log('PASS process/thread affinity reflects the single-CPU browser machine with real handle errors');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
