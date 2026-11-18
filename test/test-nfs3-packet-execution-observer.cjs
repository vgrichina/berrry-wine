'use strict';
const assert=require('node:assert/strict');
const {createObserver}=require('../tools/nfs3-packet-execution-observer.cjs');
// A focused boundary-reader test; real compiled emulator controls are separate.
const memory=new WebAssembly.Memory({initial:130});const bytes=new Uint8Array(memory.buffer);
let calls=0,armed=0;const original=()=>{calls++;return 7;};
const e={get_image_base:()=>0x400000,get_current_thread_id:()=>2,get_process_id:()=>1000,
  set_trace_eip_range:(on,lo,hi)=>{assert.deepEqual([on,lo,hi],[1,0x431140,0x4c5130]);armed++;}};
for(const r of ['eax','ebx','ecx','edx','esi','edi','esp','ebp'])e['get_'+r]=()=>r==='edx'?0x79a338:0;
const d=new DataView(memory.buffer);d.setUint32(0x79a338,0xff00,true);
const before=Buffer.from(bytes),observer=createObserver({translate:p=>p,capacity:2,importantCapacity:2});
const h={memory,log:original,log_eip:original};const bind=observer.wrapImports({host:h});bind({exports:e});
assert.equal(h.log(1,2),7);assert.equal(h.log(1,2),7);assert.equal(armed,1);
for(const pc of [0x48e125,0x4c4a30,0x4c4a69,123])assert.equal(h.log_eip(pc),7);
const report=observer.report();assert.equal(calls,6);assert.equal(report.callbacks,4);
assert.equal(report.count,3);assert.equal(report.overwritten,1);assert.equal(report.importantCount,3);
assert.equal(report.importantOverwritten,1);assert.deepEqual(report.errors,[]);
assert.deepEqual(report.rows[0].admission,{player:0,source:0x79a338,bytes:[0,255,0,0],slot:0x7d1714,before:[0,0,0,0],occupied:0});
assert.equal(report.rows[0].thread,2);assert.deepEqual(Buffer.from(bytes),before);
assert.throws(()=>createObserver({translate:p=>p,capacity:0}),/capacity/);
console.log('PASS block-entry filtering, admission identity, bounded retention, unchanged memory/import returns and one-time trace arming');
