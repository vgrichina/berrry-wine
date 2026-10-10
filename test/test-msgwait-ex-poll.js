#!/usr/bin/env node
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const {bootRenderHarness}=require('./render-helper');
const extraWat=String.raw`
 (func (export "mq_poll") (param $count i32) (param $ms i32) (param $mask i32) (param $flags i32) (result i32)
   (local $sp i32) (local $answer i32)
   (local.set $sp (i32.load offset=16 (global.get $reg_base)))
   (call $handle_MsgWaitForMultipleObjectsEx (local.get $count) (i32.const 0)
     (local.get $ms) (local.get $mask) (local.get $flags) (i32.const 0))
   (local.set $answer (i32.load (global.get $reg_base)))
   (if (i32.ne (i32.load offset=16 (global.get $reg_base)) (i32.add (local.get $sp) (i32.const 24))) (then (unreachable)))
   (i32.store offset=16 (global.get $reg_base) (local.get $sp))
   (local.get $answer))
 (func (export "mq_pending") (result i32) (global.get $pending_input_packed))
 (func (export "mq_hwnd") (result i32) (global.get $pending_input_hwnd))
 (func (export "mq_lparam") (result i32) (global.get $pending_input_lparam))
 (func (export "mq_clear_input") (global.set $pending_input_packed (i32.const 0)))
 (func (export "mq_post") (drop (call $post_queue_push (i32.const 0) (i32.const 1024) (i32.const 7) (i32.const 9))))
 (func (export "mq_clear_posts")
   (call $post_queue_reset)
   (drop (call $shared_post_queue_read (call $w2g (call $paint_scratch_take)) (i32.const 1))))
 (func (export "mq_posts") (result i32)
   (i32.add (call $post_queue_total_count) (call $shared_post_queue_total_count)))
 (func (export "mq_paint") (param $p i32) (global.set $paint_pending (local.get $p)))
 (func (export "mq_queue_apc") (param $pfn i32)
   (i32.store offset=16 (global.get $reg_base) (i32.const 0x07000000))
   (call $handle_QueueUserAPC (local.get $pfn) (i32.const -2) (i32.const 42) (i32.const 0) (i32.const 0) (i32.const 0)))
 (func (export "mq_apc_wait") (param $ret i32)
   (i32.store offset=16 (global.get $reg_base) (i32.const 0x07000000))
   (call $gs32 (i32.const 0x07000000) (local.get $ret))
   (call $gs32 (i32.const 0x07000018) (i32.const 0))
   (global.set $eip (i32.const 0))
   (call $handle_MsgWaitForMultipleObjectsEx (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 255) (i32.const 6) (i32.const 0)))
`;
(async()=>{
 let now=0,polls=0,event=0;
 const {exports:e,memory}=await bootRenderHarness({fonts:'none',extraWat,extraHostOverrides:{
   get_ticks:()=>now,check_input:()=>{polls++;const v=event;event=0;return v;},
   check_input_hwnd:()=>0x10001,check_input_lparam:()=>0x00350001,
 }});
 const poll=(flags=6)=>e.mq_poll(0,0,255,flags);
 for(const flags of [4,5,6,7])assert.strictEqual(poll(flags),258,'empty immediate wait is a timeout');
 e.mq_post();assert.strictEqual(poll(),0);assert.strictEqual(poll(),0);
 assert.strictEqual(e.mq_posts(),1,'INPUTAVAILABLE repeatedly observes unread post');e.mq_clear_posts();
 e.mq_paint(1);assert.strictEqual(poll(),0);e.mq_paint(0);assert.strictEqual(poll(),258);
 event=(65<<16)|0x100;assert.strictEqual(poll(),0);const before=polls;
 assert.strictEqual(poll(),0);assert.strictEqual(polls,before,'cached input prevents a second destructive probe');
 assert.strictEqual(e.mq_pending(),(65<<16)|0x100);assert.strictEqual(e.mq_hwnd(),0x10001);
 assert.strictEqual(e.mq_lparam(),0x00350001);e.mq_clear_input();assert.strictEqual(poll(),258);
 e.test_timer_set(0,77,100,0);now=99;assert.strictEqual(poll(),258);now=100;
 assert.strictEqual(poll(),0);assert.strictEqual(poll(),0,'due timer remains pending after poll');
 // Modes requiring the queue changed-bit latch, masked host-queue inspection,
 // object waits or parking must not silently pretend to implement them.
 for(const args of [[1,0,255,6],[0,1,255,6],[0,-1,255,6],[0,0,1,6],[0,0,255,0]])
   assert.throws(()=>e.mq_poll(...args),WebAssembly.RuntimeError);
 const pe=fs.readFileSync(path.join(__dirname,'binaries/calc.exe'));
 new Uint8Array(memory.buffer).set(pe,e.get_staging());assert(e.load_pe(pe.length));
 const alloc=n=>e.guest_alloc(n)>>>0,seen=alloc(8),answer=alloc(8),apc=alloc(32),ret=alloc(16);
 const u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
 e.guest_write32(seen,0);e.guest_write32(answer,0);
 new Uint8Array(memory.buffer).set([0x8b,0x44,0x24,4,0xa3,...u32(seen),0xc2,4,0],e.guest_to_wasm(apc));
 new Uint8Array(memory.buffer).set([0xa3,...u32(answer),0xc3],e.guest_to_wasm(ret));
 e.mq_queue_apc(apc);e.mq_apc_wait(ret);
 for(let i=0;i<20&&e.get_eip();i++)e.run(1000);
 assert.strictEqual(e.guest_read32(seen),42,'alertable poll actually invokes the queued APC');
 assert.strictEqual(e.guest_read32(answer),0xc0,'APC returns WAIT_IO_COMPLETION');
 assert.strictEqual(e.get_esp()>>>0,0x0700001c,'five-argument wait and callback preserve the caller stack');
 console.log('PASS MsgWaitEx immediate all-input poll: queue retention, input fields, timers, APC and explicit unsupported modes');
})().catch(e=>{console.error(e);process.exitCode=1;});
