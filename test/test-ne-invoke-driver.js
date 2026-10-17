'use strict';
const assert = require('node:assert/strict');
const { invokeNeEntry } = require('../lib/ne-invoke');
// Host orchestration checks; selector/RETF/depth semantics are independently
// exercised by test-win32-ne-context's actual compiled helpers.
async function main() {
  const entry={target:0x170002,ds:31,instance:5,heap:32};
  function fixture(run) {
    let live=false,done=false,ends=0,runs=0,reason=0;
    const e={win16_bridge_frame_begin(){assert(!live);live=true;return 9n;},
      win16_bridge_invoke_begin(token,...args){assert.equal(token,9n);assert.deepEqual(args,Object.values(entry));return 1;},
      run(n){runs++;run?.({n,finish(){done=true;},yield(v){reason=v;}});},
      win16_bridge_invoke_result(){return done?0xef01abcdn:-1n;},get_yield_reason(){return reason;},
      win16_bridge_frame_end(token){assert.equal(token,9n);assert(live);live=false;ends++;return 1;}};
    return {e,state:()=>({live,ends,runs})};
  }
  let f=fixture(r=>r.finish());assert.equal(await invokeNeEntry(f.e,entry),0xef01abcd);assert.deepEqual(f.state(),{live:false,ends:1,runs:1});
  const trap=Error('guest trap');f=fixture(()=>{throw trap;});await assert.rejects(invokeNeEntry(f.e,entry),e=>e===trap);assert.equal(f.state().ends,1);
  f=fixture();await assert.rejects(invokeNeEntry(f.e,entry,{maxBlocks:6,sliceBlocks:2}),/budget exhausted/);assert.deepEqual(f.state(),{live:false,ends:1,runs:3});
  f=fixture(r=>r.yield(5));await assert.rejects(invokeNeEntry(f.e,entry),/Unsupported.*5/);assert.equal(f.state().ends,1);
  let serviced=false;f=fixture(r=>r.yield(5));await assert.rejects(invokeNeEntry(f.e,entry,{serviceYield:()=>{serviced=true;return new Promise(()=>{});}}),/owned settlement protocol/);assert.equal(serviced,false);assert.equal(f.state().ends,0);
  const abort=new AbortController();f=fixture(()=>abort.abort(Error('cancel in synchronous callback')));await assert.rejects(invokeNeEntry(f.e,entry,{signal:abort.signal}),/cancel in synchronous callback/);assert.equal(f.state().ends,1);
  f=fixture();await assert.rejects(invokeNeEntry(f.e,entry,{signal:abort.signal}),/cancel in synchronous callback/);assert.deepEqual(f.state(),{live:false,ends:0,runs:0});
  f=fixture();f.e.win16_bridge_invoke_begin=()=>0;await assert.rejects(invokeNeEntry(f.e,entry),/lease busy/);assert.equal(f.state().ends,1);
  f=fixture(()=>{throw trap;});f.e.win16_bridge_frame_end=()=>0;await assert.rejects(invokeNeEntry(f.e,entry),e=>e instanceof AggregateError&&e.errors[0]===trap);
  console.log('PASS bounded NE host driver: return, trap, wait rejection, cancellation, budget and teardown failure');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
