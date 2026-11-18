'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm');
const {compile}=require('../tools/watx.js');
const {bootstrap,validateReport}=require('../tools/nfs3-normal-worker-control.cjs');
const {fields}=require('../tools/nfs3-consumer-scheduling-observer.cjs');
const {g2w}=require('../lib/mem-utils.js');
// Native data initialization, not an observer write. Distinct sentinels at all
// original field addresses detect wrong image base, field order and byte order.
const expected=fields.map((p,i)=>[p,(0x12345600+i)>>>0]);
const data=expected.map(([p,n])=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return `(data (i32.const ${g2w(p,0x400000)}) "${[...b].map(n=>'\\'+n.toString(16).padStart(2,'0')).join('')}")`;}).join('\n');
const source=`(import "host" "memory" (memory 64))
(import "host" "get_ticks" (func $ticks (result i32)))
(import "host" "gpu_stream_kick" (func $kick (result i32)))
${data}
(func $run (param $n i32) (result i32) (drop (call $ticks)) (drop (call $kick)) (i32.add (local.get $n) (i32.const 1)))
(func $base (result i32) (i32.const 4194304))
(func $pc (result i32) (i32.const 5001510))
(func $thread (result i32) (i32.const 7))
(func $zero (result i32) (i32.const 0))
(func $forbidden (result i32) (unreachable))
(export "run" (func $run)) (export "get_image_base" (func $base))
(export "get_eip" (func $pc)) (export "get_current_thread_id" (func $thread))
(export "get_yield_reason" (func $zero)) (export "get_last_run_blocks" (func $zero))
(export "set_trace_eip_range" (func $forbidden)) (export "get_sleep_yielded" (func $forbidden))`;
const compiled=compile(source,new Map(),{runtimeBuiltins:false,standardWat:true,tailCalls:false});
assert(compiled.success,compiled.error);const moduleBytes=compiled.wasmBinary;
async function check(asyncInstantiation){
 let mono=0,ticks=0,kicks=0;const memory=new WebAssembly.Memory({initial:64});
 const wasm={Instance:WebAssembly.Instance,instantiate:WebAssembly.instantiate};
 const context={WebAssembly:wasm,memUtils:{g2w},performance:{now:()=>mono+=101},Date,DataView,Proxy,Reflect};
 vm.runInNewContext(bootstrap(),context);
 const imports={host:{memory,get_ticks:()=>{ticks++;return 1234;},gpu_stream_kick:()=>{kicks++;return 99;}}};
 const module=new WebAssembly.Module(moduleBytes);
 const instance=asyncInstantiation?await wasm.instantiate(module,imports):new wasm.Instance(module,imports);
 assert(instance instanceof WebAssembly.Instance);const before=Buffer.from(memory.buffer);
 for(let i=0;i<4;i++)assert.equal(instance.exports.run(i),i+1);
 assert.equal(ticks,4);assert.equal(kicks,4);assert.deepEqual(Buffer.from(memory.buffer),before);
 const report=JSON.parse(JSON.stringify(context.nfs3SchedulingReport()));validateReport(report);
 for(const row of report.rows)assert.deepEqual(row.fields,expected);
 assert(report.rows.some(r=>r.phase==='run-enter'));assert(report.rows.some(r=>r.phase==='run-exit'));
 assert(report.rows.some(r=>r.phase==='get_ticks'));assert(report.rows.some(r=>r.phase==='gpu_stream_kick'));
 const bad=structuredClone(report);bad.rows[0].fields[0][0]++;assert.throws(()=>validateReport(bad));
 const failed=structuredClone(report);failed.errors=['mapping'];assert.throws(()=>validateReport(failed));
 return {asyncInstantiation,samples:report.count,fields:fields.length,nativeReturnPreserved:true,exactImports:true,memoryUnchanged:true};
}
Promise.all([check(false),check(true)]).then(results=>console.log(JSON.stringify({pass:true,results}))).catch(e=>{console.error(e);process.exitCode=1;});
