'use strict';
const assert=require('node:assert/strict');
const {createObserver,install}=require('../tools/nfs3-consumer-scheduling-observer.cjs');
let ms=0,ticks=0,runs=0,flags=0;
const memory=new WebAssembly.Memory({initial:1}),bytes=new Uint8Array(memory.buffer);
bytes[12]=77;const before=Buffer.from(bytes);
const e={run(a){runs++;ms+=20;return a+1;},get_eip:()=>0x401000,
  get_current_thread_id:()=>7,get_yield_reason:()=>9,get_last_run_blocks:()=>20,
  get_image_base:()=>0x400000,get_sleep_yielded:()=>{flags++;},set_trace_eip_range:()=>{throw Error('debug forbidden');}};
const o=createObserver({mono:()=>ms,now:()=>ms,capacity:2,intervalMs:10,game:true,
  translate:p=>p,addresses:[12]});
const h={memory,get_ticks:()=>++ticks,gpu_stream_kick:()=>5};
const instance={exports:e},wrapped=o.prepare({host:h})(instance);
assert.equal(wrapped.exports.run(4),5);ms+=20;
assert.equal(h.get_ticks(),1);ms+=20;assert.equal(wrapped.exports.run(7),8);
assert.equal(h.gpu_stream_kick(),5);
const r=o.report();assert.equal(r.hosts[0].runs,2);assert.equal(r.hosts[0].blocks,40);
assert.equal(r.hosts[0].yields[9],2);assert(r.overwritten>0);assert.equal(r.rows.length,2);
assert.deepEqual(r.rows[0].fields,[[12,77]]);assert.equal(runs,2);assert.equal(ticks,1);
assert.equal(flags,0);assert.deepEqual(Buffer.from(bytes),before);assert.deepEqual(r.errors,[]);
assert.throws(()=>createObserver({intervalMs:0}),/interval/);
// Verify actual WebAssembly instance identity and immutable exports work through
// the facade, using the empty module; compiled emulator controls test run().
const wasm={Instance:WebAssembly.Instance,instantiate:WebAssembly.instantiate};
const restore=install(createObserver(),wasm);
const empty=new WebAssembly.Module(Buffer.from('0061736d01000000','hex'));
const actual=new wasm.Instance(empty,{});assert(actual instanceof WebAssembly.Instance);
restore();assert.equal(wasm.Instance,WebAssembly.Instance);
console.log('PASS native facade, bounded sampling, clock result preservation, no debug or read-clear calls');
