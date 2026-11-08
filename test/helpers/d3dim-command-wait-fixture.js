'use strict';
const assert=require('assert/strict');
const {compileSrcWasm}=require('../compile-src');
const extra=String.raw`
 (global $handoff_pause (mut i32) (i32.const 0))
 (func (export "q_init")
  (global.set $image_base (i32.const 0x400000)) (call $heap_init (i32.const 0x3000000))
  (call $dx_coop_hwnd_set (i32.const 0x77)) (call $dx_exclusive_set (i32.const 1)))
 (func $q_together (export "q_together") (param $f i32) (param $b i32) (param $d i32) (result i32)
  (local $r i32)
  (global.set $d3dim_flip_desc (local.get $d)) (global.set $d3dim_worker_pending (i32.const 1))
  (local.set $r (call $d3dim_worker_try_flip (local.get $f) (local.get $b)))
  (call $d3dim_worker_fence) (local.get $r))
 (func (export "q_pause_at") (param $wa i32) (global.set $handoff_pause (local.get $wa)))
 (func (export "q_together_store") (param $f i32) (param $b i32) (param $d i32)
  (drop (call $q_together (local.get $f) (local.get $b) (local.get $d)))
  (call $gs32 (i32.add (i32.const 0x50000000) (i32.sub (i32.load offset=20 (local.get $f)) (global.get $DIB_BACKING_BASE))) (i32.const 0xff440000)))
`;
module.exports = () => compileSrcWasm((f,s)=>{
 if(f==='03-registers.wat'){
  const store='(i32.store (local.get $wa) (local.get $v))\n        (call $page_watch_write_one (local.get $wa))';assert(s.includes(store));
  return s.replace(store,`(i32.store (local.get $wa) (local.get $v))
   (if (global.get $handoff_pause) (then
    (i32.atomic.store offset=4 (global.get $handoff_pause) (i32.const 1))
    (drop (memory.atomic.notify (i32.add (global.get $handoff_pause) (i32.const 4)) (i32.const 1)))
    (drop (memory.atomic.wait32 (global.get $handoff_pause) (i32.const 0) (i64.const 15000000000)))))
   (call $page_watch_write_one (local.get $wa))`);
 }
 return f==='13-exports.wat'?s+extra:s;
});
