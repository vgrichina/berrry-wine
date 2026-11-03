#!/usr/bin/env node
'use strict';
// QueueUserAPC: an APC queued to thread T runs on T, only inside T's alertable
// wait, and that wait returns WAIT_IO_COMPLETION. One instance plays both
// threads by switching $current_thread_id, which is exactly what selects the
// shared per-thread inbox; the host side (handle -> tid, alert) is stubbed and
// recorded. Covers: bad handle, the current-thread pseudo-handle, a cross-thread
// queue that a non-alertable wait must not consume, a target parked in an
// alertable SleepEx (delivered at resumption, the sleep's 0 replaced by 0xC0),
// a target parked in an alertable WaitForSingleObjectEx (apc_wake_wait), FIFO
// order, and ExitThread dropping what is still queued.
const assert=require('assert'),fs=require('fs'),path=require('path');
const {bootRenderHarness}=require('./render-helper');
const extraWat=`
  (func $qa_frame (param $n i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x07000000))
    (call $gs32 (i32.const 0x07000000) (local.get $n)))
  (global $qa_entry (mut i32) (i32.const 0))
  (func (export "qa_kernel") (result i32) (call $kernel32_ensure_locked))
  (func (export "qa_lookup") (param $kernel i32) (param $name i32) (result i32)
    (call $qa_frame (i32.const 0))
    (global.set $last_error (i32.const 0))
    (call $handle_GetProcAddress (local.get $kernel) (local.get $name) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "qa_set_entry") (param $entry i32) (global.set $qa_entry (local.get $entry)))
  (func (export "qa_queue") (param $pfn i32) (param $h i32) (param $data i32) (result i32)
    (call $qa_frame (i32.const 0))
    (call $gs32 (i32.const 0x07000004) (local.get $pfn))
    (call $gs32 (i32.const 0x07000008) (local.get $h))
    (call $gs32 (i32.const 0x0700000c) (local.get $data))
    (global.set $eip (global.get $qa_entry))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "qa_last_error") (result i32) (global.get $last_error))
  ;; SleepEx(ms, alertable) called from guest code at $ret: the frame is
  ;; [ret][ms][alertable][0], the trailing 0 being $ret's own return (halt).
  (func (export "qa_sleep") (param $ms i32) (param $alertable i32) (param $ret i32)
    (call $qa_frame (local.get $ret))
    (call $gs32 (i32.const 0x07000004) (local.get $ms))
    (call $gs32 (i32.const 0x07000008) (local.get $alertable))
    (call $gs32 (i32.const 0x0700000c) (i32.const 0))
    (global.set $eip (i32.const 0))
    (call $handle_SleepEx (local.get $ms) (local.get $alertable) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    ;; $run's auto-pop: a handler that left EIP alone resumes at the return.
    (if (i32.eqz (global.get $eip)) (then (global.set $eip (local.get $ret)))))
  (func (export "qa_wait") (param $alertable i32) (param $ret i32)
    (call $qa_frame (local.get $ret))
    (call $gs32 (i32.const 0x07000004) (i32.const 0xe0007))
    (call $gs32 (i32.const 0x07000008) (i32.const -1))
    (call $gs32 (i32.const 0x0700000c) (local.get $alertable))
    (call $gs32 (i32.const 0x07000010) (i32.const 0))
    (global.set $eip (i32.const 0))
    (call $handle_WaitForSingleObjectEx (i32.const 0xe0007) (i32.const -1) (local.get $alertable) (i32.const 0) (i32.const 0) (i32.const 0))
    (if (i32.eqz (global.get $eip)) (then (global.set $eip (local.get $ret)))))
  (func (export "qa_new_api_call")
    (global.set $apc_alert_sleep (i32.const 0))
    (global.set $wait_alertable (i32.const 0)))
  ;; The test multiplexes two threads in one instance. Preserve the target's
  ;; instance-private sleep mark while the sender executes its real API thunk.
  (func (export "qa_save_sleep") (param $p i32)
    (call $gs32 (local.get $p) (global.get $apc_alert_sleep))
    (call $gs32 (i32.add (local.get $p) (i32.const 4)) (global.get $apc_alert_ret))
    (call $gs32 (i32.add (local.get $p) (i32.const 8)) (global.get $apc_alert_esp)))
  (func (export "qa_restore_sleep") (param $p i32)
    (global.set $apc_alert_sleep (call $gl32 (local.get $p)))
    (global.set $apc_alert_ret (call $gl32 (i32.add (local.get $p) (i32.const 4))))
    (global.set $apc_alert_esp (call $gl32 (i32.add (local.get $p) (i32.const 8)))))
  (func (export "qa_exit_thread") (call $apc_drop_shared_current))
`;
const u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255];
(async()=>{
  const alerts=[];
  let targets=new Map();
  const {exports:e,memory}=await bootRenderHarness({fonts:'none',extraWat,
    extraHostOverrides:{
      thread_apc_target:(h,caller)=>targets.has(h>>>0)?targets.get(h>>>0):0,
      thread_alert:tid=>alerts.push(tid),
      wait_single:()=>0xffff,
    }});
  const pe=fs.readFileSync(path.join(__dirname,'binaries/calc.exe'));
  new Uint8Array(memory.buffer).set(pe,e.get_staging());assert.ok(e.load_pe(pe.length));
  const alloc=n=>e.guest_alloc(n)>>>0,read=p=>e.guest_read32(p)>>>0,write=(p,n)=>e.guest_write32(p,n);
  const seen=alloc(64),after=alloc(16),apc=alloc(64),retcode=alloc(32);
  const reset=()=>{for(let i=0;i<64;i+=4)write(seen+i,0);write(after,0xdeadbeef);};
  // APC routine (stdcall, 1 arg): seen.log[count++] = (tid << 16) | dwData
  new Uint8Array(memory.buffer).set([
    0x8b,0x0d,...u32(seen),            // mov ecx,[count]
    0x8b,0x44,0x24,4,                  // mov eax,[esp+4]
    0x89,0x04,0x8d,...u32(seen+4),     // mov [log+ecx*4],eax
    0x41,0x89,0x0d,...u32(seen),       // inc ecx; mov [count],ecx
    0xc2,4,0,                          // ret 4
  ],e.guest_to_wasm(apc));
  // Wait return site: record EAX, then return to 0 (halts run()).
  new Uint8Array(memory.buffer).set([0xa3,...u32(after),0xc3],e.guest_to_wasm(retcode));
  const runToHalt=()=>{for(let i=0;i<20&&e.get_eip();i++)e.run(1000);};
  const asThread=tid=>e.set_current_thread_id(tid);

  const api=require('../src/api_table.json').find(a=>a.name==='QueueUserAPC');
  assert.strictEqual(api.id,4164);assert.strictEqual(api.nargs,3);assert.strictEqual(api.convention,'stdcall');
  const putA=s=>{const p=alloc(s.length+1);for(let i=0;i<=s.length;i++)e.guest_write8(p+i,s.charCodeAt(i)||0);return p;};
  const kernel=e.qa_kernel()>>>0;
  assert(kernel,'synthetic KERNEL32 PE mapped');
  assert.strictEqual(e.guest_read8(kernel)|(e.guest_read8(kernel+1)<<8),0x5a4d);
  assert.strictEqual(read(kernel+read(kernel+0x3c)),0x4550);
  const name=putA('QueueUserAPC'),entry=e.qa_lookup(kernel,name)>>>0;
  assert(entry,`explicit KERNEL32 GetProcAddress(QueueUserAPC) must resolve; error=${e.qa_last_error()}`);
  assert.strictEqual(e.get_esp()>>>0,0x0700000c,'GetProcAddress pops two args');
  assert.strictEqual(e.guest_read8(entry),0xe9,'actual PE E9 trampoline');
  const target=(entry+5+read(entry+1))>>>0;
  assert.strictEqual(read(target+4),4164,'trampoline dispatches existing handler');
  assert.strictEqual(e.qa_lookup(kernel,595)>>>0,entry,'explicit ordinal lookup');
  assert.strictEqual(e.qa_lookup(kernel,putA('queueuserapc')),0,'case-sensitive export');
  assert.strictEqual(e.qa_last_error(),127);
  e.qa_set_entry(entry);
  const queue=(pfn,h,data)=>{
    // The sender is runnable; a multiplexed target wait must not park it.
    e.clear_yield();e.qa_queue(pfn,h,data);runToHalt();
    assert.strictEqual(e.get_eip(),0,'actual trampoline returns');
    assert.strictEqual(e.get_esp()>>>0,0x07000010,'three-argument stdcall cleanup');
    return e.get_eax()>>>0;
  };
  console.log('PASS explicit KERNEL32 PE name/ordinal595/case-sensitive lookup; E9 entry maps API4164/stdcall3');
  // Invalid handle / null routine.
  reset();asThread(1);
  assert.strictEqual(queue(apc,0x1234,7),0);assert.strictEqual(e.qa_last_error(),6);
  assert.strictEqual(queue(0,-2,7),0);assert.strictEqual(e.qa_last_error(),87);
  assert.strictEqual(e.get_esp()>>>0,0x07000010,'QueueUserAPC pops three arguments');

  // Current-thread pseudo-handle: no host round trip, delivered in an
  // alertable SleepEx(0) on the same thread.
  assert.strictEqual(queue(apc,-2,0x11),1);
  assert.deepStrictEqual(alerts,[],'no alert for the caller itself');
  e.qa_sleep(0,0,retcode);runToHalt();
  assert.strictEqual(read(seen),0,'non-alertable sleep never runs an APC');
  assert.strictEqual(read(after),0);
  e.qa_sleep(0,1,retcode);runToHalt();
  assert.strictEqual(read(seen),1);assert.strictEqual(read(seen+4),0x11);
  assert.strictEqual(read(after),0xc0,'SleepEx returns WAIT_IO_COMPLETION');
  assert.strictEqual(e.get_esp()>>>0,0x07000010,'APC + SleepEx frames balanced');

  // Cross-thread: main (1) queues two APCs to thread 3 by handle.
  reset();targets=new Map([[0xe1002,3]]);
  assert.strictEqual(queue(apc,0xe1002,0x31),1);
  assert.strictEqual(queue(apc,0xe1002,0x32),1);
  assert.deepStrictEqual(alerts,[3,3]);
  e.qa_sleep(0,1,retcode);runToHalt();
  assert.strictEqual(read(seen),0,"main's alertable wait must not run thread 3's APC");
  assert.strictEqual(read(after),0);
  asThread(3);
  e.qa_sleep(0,0,retcode);runToHalt();
  assert.strictEqual(read(seen),0,'target non-alertable sleep leaves it queued');
  e.qa_sleep(0,1,retcode);runToHalt();
  assert.deepStrictEqual([read(seen),read(seen+4),read(seen+8)],[2,0x31,0x32],'both, FIFO, in one wait');
  assert.strictEqual(read(after),0xc0);
  assert.strictEqual(e.get_esp()>>>0,0x07000010);

  // Target parked in an alertable SleepEx(1000) with nothing queued.
  reset();
  e.qa_sleep(1000,1,retcode);
  assert.strictEqual(e.apc_alertable_sleeping(),1,'parked alertable sleep is visible to thread_alert');
  assert.strictEqual(e.get_eip()>>>0,retcode);
  const parkedSleep=alloc(12);
  e.qa_save_sleep(parkedSleep);
  const parkedStack=new Uint8Array(memory.buffer,e.guest_to_wasm(0x07000000),32).slice();
  asThread(1);alerts.length=0;
  assert.strictEqual(queue(apc,0xe1002,0x41),1);
  assert.deepStrictEqual(alerts,[3]);
  // Real worker instances have private sleep globals and separate stacks.
  // This one-instance harness must restore both after running the sender.
  asThread(3);e.qa_restore_sleep(parkedSleep);
  new Uint8Array(memory.buffer,e.guest_to_wasm(0x07000000),32).set(parkedStack);
  e.set_esp(0x0700000c);e.set_eip(retcode);
  runToHalt();
  assert.deepStrictEqual([read(seen),read(seen+4)],[1,0x41],'APC runs on resumption');
  assert.strictEqual(read(after),0xc0,'the parked sleep now returns WAIT_IO_COMPLETION');
  assert.strictEqual(e.get_esp()>>>0,0x07000010);
  assert.strictEqual(e.apc_alertable_sleeping(),0);

  // A parked sleep that times out with nothing queued just returns 0.
  reset();e.qa_sleep(1000,1,retcode);runToHalt();
  assert.strictEqual(read(after),0);assert.strictEqual(e.apc_alertable_sleeping(),0);
  // Another API call ends the alertable window: a later APC waits for the next one.
  reset();e.qa_sleep(1000,1,retcode);e.qa_new_api_call();
  assert.strictEqual(e.apc_alertable_sleeping(),0);
  e.clear_yield();

  // Target parked in an alertable WaitForSingleObjectEx (yield 1).
  reset();e.qa_wait(1,retcode);
  assert.strictEqual(e.get_yield_reason(),1);assert.strictEqual(e.get_wait_stack_bytes(),16);
  assert.strictEqual(e.apc_wake_wait(),0,'nothing queued: stays parked');
  asThread(1);assert.strictEqual(queue(apc,0xe1002,0x51),1);
  asThread(1);assert.strictEqual(e.apc_wake_wait(),0,"another thread's queue does not wake main");
  // Restore thread 3's parked frame (qa_queue used the same scratch stack).
  e.qa_wait(1,retcode);
  asThread(3);
  assert.strictEqual(e.apc_wake_wait(),1);
  assert.strictEqual(e.get_yield_reason(),0);
  runToHalt();
  assert.deepStrictEqual([read(seen),read(seen+4)],[1,0x51]);
  assert.strictEqual(read(after),0xc0);
  assert.strictEqual(e.get_esp()>>>0,0x07000014,'WaitForSingleObjectEx frame popped');
  // Non-alertable parked wait is never woken by an APC.
  reset();e.qa_wait(0,retcode);
  asThread(1);queue(apc,0xe1002,0x61);asThread(3);e.qa_wait(0,retcode);
  assert.strictEqual(e.apc_wake_wait(),0);
  e.clear_yield();

  // Thread exit drops what is still queued; a new thread 3 starts empty.
  e.qa_exit_thread();
  e.qa_sleep(0,1,retcode);runToHalt();
  assert.strictEqual(read(seen),0);assert.strictEqual(read(after),0);
  console.log('PASS QueueUserAPC: cross-thread inboxes, alertable-only delivery, parked sleep/wait wake, FIFO, exit drop');
})().catch(error=>{console.error(error);process.exitCode=1;});
