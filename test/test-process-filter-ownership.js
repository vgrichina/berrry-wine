'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const extraWat = String.raw`
  (func (export "filter_reset")
    (global.set $image_base (i32.const 0))
    (call $invocation_process_begin)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x300000))
    (call $gs32 (i32.const 0x300000) (i32.const 0x123456))
    (i32.atomic.store (global.get $TOP_EXCEPTION_FILTER) (i32.const 0x402000)))
  (func (export "filter_begin")
    (drop (call $top_filter_begin (i32.const 0) (i32.const 0))))
  (func (export "filter_finish")
    (local $f i32)
    (local.set $f (call $top_filter_frame (i32.sub (global.get $top_filter_depth) (i32.const 1))))
    (i32.store offset=16 (global.get $reg_base) (i32.load offset=4 (local.get $f)))
    (i32.store (global.get $reg_base) (i32.const 1))
    (call $top_filter_continue))
  (func (export "filter_corrupt") (param $offset i32)
    (local $f i32)
    (local.set $f (call $top_filter_frame (i32.sub (global.get $top_filter_depth) (i32.const 1))))
    (i32.store (i32.add (local.get $f) (local.get $offset)) (i32.const -1)))
  (func (export "filter_stale") (call $top_filter_continue))
  (func (export "filter_depth") (result i32) (global.get $top_filter_depth))
`;
(async () => {
  const { exports: x } = await bootRenderHarness({ extraWat });
  x.filter_reset(); x.filter_begin(); x.filter_finish();
  assert.equal(x.filter_depth(), 0);
  assert.throws(() => x.filter_stale(), WebAssembly.RuntimeError, 'repeated return is stale');
  for (const offset of [8, 16, 24, 32, 40]) {
    x.filter_reset(); x.filter_begin(); x.filter_corrupt(offset);
    assert.throws(() => x.filter_finish(), WebAssembly.RuntimeError, `reject retained field ${offset}`);
    assert.equal(x.filter_depth(), 1, 'rejection precedes private frame pop');
  }
  x.filter_reset();
  for (let i = 0; i < 8; i++) x.filter_begin();
  assert.throws(() => x.filter_begin(), WebAssembly.RuntimeError, 'capacity fails explicitly');
  assert.equal(x.filter_depth(), 8);
  for (let i = 0; i < 8; i++) x.filter_finish();
  assert.equal(x.filter_depth(), 0, 'every nested invocation unwinds independently');
  x.filter_reset(); x.filter_begin(); x.filter_reset();
  assert.throws(() => x.filter_stale(), WebAssembly.RuntimeError, 'retired root cannot restore a caller');
  console.log('PASS filter callback custody: exact ESP/mode/parent/child/root, stale return, capacity and nested LIFO');
})().catch(e => { console.error(e); process.exitCode = 1; });
