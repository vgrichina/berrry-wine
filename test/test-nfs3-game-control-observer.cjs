'use strict';

const assert = require('node:assert/strict');
const {createObserver, install} = require('../tools/nfs3-game-control-observer.cjs');
const {compile} = require('../tools/watx');

// Exercise real native import entry/return and both instantiation routes.
// This small module models the dispatcher ABI, not DirectInput semantics.
const source = `
 (import "host" "memory" (memory 1))
 (import "host" "log" (func $log (param i32 i32)))
 (import "host" "log_i32" (func $int (param i32)))
 (import "host" "log_api_exit" (func $exit))
 (import "host" "get_key_down_state" (func $key (param i32) (result i32)))
 (global $sp (mut i32) (i32.const 1000))
 (global $eax (mut i32) (i32.const 0))
 (func (export "get_image_base") (result i32) (i32.const 0))
 (func (export "get_current_thread_id") (result i32) (i32.const 2))
 (func (export "get_process_id") (result i32) (i32.const 1000))
 (func (export "get_esp") (result i32) (global.get $sp))
 (func (export "get_eax") (result i32) (global.get $eax))
 (func (export "get_yield_reason") (result i32) (i32.const 0))
 (func (export "get_yield_flag") (result i32) (i32.const 0))
 (data (i32.const 100) "<ord>")
 (func (export "poll") (param $bad i32) (result i32)
   (global.set $sp (i32.const 1000))
   (i32.store (i32.const 1004) (i32.const 2000))
   (i32.store (i32.const 1008) (i32.const 8))
   (i32.store (i32.const 1012) (i32.const 3000))
   (call $int (i32.const 0xc0de0000))
   (call $log (i32.const 100) (i32.const 5))
   (i32.store8 (i32.const 3007) (i32.shr_u (call $key (i32.const 38)) (i32.const 8)))
   (global.set $eax (i32.const 0))
   (global.set $sp (i32.add (i32.const 1016) (local.get $bad)))
   (call $exit)
   (i32.load8_u (i32.const 3007)))`;
const result = compile(source, new Map(), {standardWat:true, runtimeBuiltins:false});
assert(result.wasmBinary, JSON.stringify(result.errors));
const module_ = new WebAssembly.Module(result.wasmBinary);

async function run(enabled, asyncRoute) {
  let calls = 0;
  const observer = createObserver({capacity:2, translate:ptr=>ptr,
    apiNames:[{name:'IDirectInputDevice_GetDeviceState'}]});
  const restore = enabled ? install(observer) : () => {};
  try {
    const memory = new WebAssembly.Memory({initial:1});
    const imports = {host:{memory, log(){calls++;}, log_i32(){calls++;}, log_api_exit(){calls++;},
      get_key_down_state(key){calls++;assert.equal(key,38);return 0x8000;}}};
    const instance = asyncRoute ? await WebAssembly.instantiate(module_, imports)
      : new WebAssembly.Instance(module_, imports);
    assert(instance instanceof WebAssembly.Instance);
    const returns = [instance.exports.poll(0), instance.exports.poll(4), instance.exports.poll(0)];
    return {returns, calls, bytes:Array.from(new Uint8Array(memory.buffer)), report:observer.report()};
  } finally {restore();}
}
(async()=>{
  for (const asyncRoute of [false,true]) {
    const off = await run(false,asyncRoute), on = await run(true,asyncRoute);
    assert.deepEqual(on.returns,off.returns);assert.equal(on.calls,off.calls);assert.deepEqual(on.bytes,off.bytes);
    assert.deepEqual(on.returns,[128,128,128]);assert.equal(on.calls,12);
    assert.equal(on.report.instances,1);assert.equal(on.report.count,3);assert.equal(on.report.overwritten,1);
    assert.deepEqual(on.report.errors,[]);
    const [bad,good] = on.report.rows;
    assert.equal(bad.complete,false);assert.equal(bad.bytes,undefined);
    assert.equal(good.complete,true);assert.equal(good.bytes[7],128);assert.equal(good.thread,2);
    assert.equal(good.liveReads[0].result,32768);assert.equal(good.gameAction,false);
  }
  const observer = createObserver({translate:ptr=>ptr});
  const original = {get_key_down_state(){throw Error('original exception');}};
  const memory = new WebAssembly.Memory({initial:1});
  observer.wrapImports({host:{memory,log(){},...original}});
  assert.throws(()=>original.get_key_down_state(),/original exception/);
  assert.throws(()=>createObserver({capacity:Infinity}),/capacity/);
  console.log('PASS native constructor/async observer on-off identical buffers, returns and import counts; ordinal, thread, bounded ring and incomplete-return exclusion');
})().catch(error=>{console.error(error);process.exitCode=1;});
