#!/usr/bin/env node
'use strict';

// A host import that throws on the main thread must stop the guest thread
// that called it, as it does in-process, not hand it a 0. NFS II's installer
// hit a TypeError inside the VFS's CreateFile in Worker mode; the broker
// logged one line and answered 0, and the guest carried on as if the file
// had merely failed to open. Checks the worker rethrows naming the import,
// the main side reports the original stack, and the slot is usable again.

const assert = require('assert');
const RPC = require('../lib/guest-rpc');

const memory = { buffer: new SharedArrayBuffer(8192 * 65536) };
const gpuCalls = [];
const sigs = {
  gpu_gl_call: { params: ['i32', 'i32', 'i32'], results: ['i32'] },
  fs_create_file: { params: ['i32', 'i32'], results: ['i32'] },
  fs_get_file_size: { params: ['i32'], results: ['i32'] },
};
const reported = [];
const main = RPC.createMainBroker(memory, {
  gpu_gl_call: (...args) => {
    gpuCalls.push(args);
    if (args[2] === 99) throw new TypeError('published GL front is unavailable');
    return 0x800;
  },
  fs_create_file: () => { throw new TypeError('this._fileIdentity is not a function'); },
  fs_get_file_size: h => h + 1,
}, sigs, { onError: (name, err) => reported.push([name, err.stack]) });

const worker = RPC.createWorkerImports(memory, sigs, message => {
  assert.strictEqual(message.t, 'rpc');
  main.serveRpc(message.slot);
}, { slot: 3 });

assert.throws(() => worker.imports.host.fs_create_file(1, 2),
  /host import fs_create_file threw on the main thread/,
  'a thrown import surfaces in the calling worker instead of returning 0');
assert.strictEqual(reported.length, 1);
assert.strictEqual(reported[0][0], 'fs_create_file');
assert.match(reported[0][1], /TypeError: this\._fileIdentity is not a function\n\s+at /,
  'the main side gets the original error with its stack');

assert.strictEqual(worker.imports.host.fs_get_file_size(41), 42,
  'the slot answers normally after an error response');

console.log('PASS  a host import that throws in Worker mode stops its caller, not returns 0');

// D3D9 capabilities now live in WAT. Its retired direct-host opcode must
// fail locally rather than accidentally invoking a leftover page handler.
for (const format of [23, 0]) {
  assert.throws(() => worker.imports.host.gpu_gl_call(0x30017, 0, format),
    /unexpected direct OpenGL worker call/, 'retired D3D9 calls are refused');
}
assert.deepStrictEqual(gpuCalls, [], 'retired calls never reach the broker');
// 0x30018 is now the Worker-local D3D state wait; use an opcode nothing owns.
assert.throws(() => worker.imports.host.gpu_gl_call(0x3ffff, 0, 0),
  /unexpected direct OpenGL worker call/, 'unknown calls still fail loudly');
console.log('PASS retired D3D9 direct capability calls are refused locally');
{
  const events=[],messages=[];
  const traceSigs={
    ctrl_paint_trace:{params:Array(7).fill('i32'),results:[]},
    ctrl_sb_trace:{params:Array(10).fill('i32'),results:[]},
    fs_get_file_size:{params:['i32'],results:['i32']},
  };
  const broker=RPC.createMainBroker(memory,{
    ctrl_paint_trace:(...args)=>events.push(['paint',...args]),
    ctrl_sb_trace:(...args)=>events.push(['scroll',...args]),
    fs_get_file_size:h=>{events.push(['fence',h]);return 42;},
  },traceSigs);
  const traces=RPC.createWorkerImports(memory,traceSigs,msg=>{
    messages.push(msg.t);
    if(msg.t==='calls')broker.serveCalls(msg);else broker.serveRpc(msg.slot);
  },{slot:4});
  const args=[0x10001,0x301,-20,30,640,961,0x4000001];
  traces.imports.host.ctrl_paint_trace(...args);args[2]=999;
  traces.imports.host.ctrl_sb_trace(2,-3,4,5,6,1,8,-9,10,11);
  assert.strictEqual(traces.stats.sync,0,'diagnostic records never park the guest');
  assert.strictEqual(traces.imports.host.fs_get_file_size(7),42);
  assert.deepStrictEqual(events,[['paint',0x10001,0x301,-20,30,640,961,0x4000001],
    ['scroll',2,-3,4,5,6,1,8,-9,10,11],['fence',7]],
    'trace snapshots arrive in order before the following synchronous call');
  assert.strictEqual(messages.at(-1),'rpc');
  assert.strictEqual(traces.stats.async,2);
  console.log('PASS control trace snapshots are asynchronous and ordered');
}
// The current pre-GDI materialization route still brokers synchronously.
// Exercise a real throw there, then reuse the same caller slot successfully.
assert.throws(() => worker.imports.host.gpu_gl_call(0x10002, 0x10001, 99),
  /host import gpu_gl_call threw on the main thread/);
assert.strictEqual(reported.length, 2);
assert.strictEqual(reported[1][0], 'gpu_gl_call');
assert.match(reported[1][1], /TypeError: published GL front is unavailable\n\s+at /);
assert.strictEqual(worker.imports.host.gpu_gl_call(0x10002, 0x10001, 0), 0x800);
assert.deepStrictEqual(gpuCalls, [[0x10002, 0x10001, 99], [0x10002, 0x10001, 0]],
  'the valid broker route preserves both calls after an error response');
assert.deepStrictEqual(gpuCalls.at(-1), [0x10002, 0x10001, 0],
  'OpenGL pre-GDI readback synchronizes through the page broker');
console.log('PASS current GL materialization reports host errors and reuses its slot');
