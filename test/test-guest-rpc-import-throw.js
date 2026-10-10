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
  gpu_gl_call: (...args) => { gpuCalls.push(args); return args[2] === 23 ? 1 : 0x800; },
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

// D3D9 CheckDeviceFormat uses the same synchronous broker in Worker mode.
assert.strictEqual(worker.imports.host.gpu_gl_call(0x30017, 0, 23), 1);
assert.strictEqual(worker.imports.host.gpu_gl_call(0x30017, 0, 0), 0x800);
assert.deepStrictEqual(gpuCalls, [[0x30017, 0, 23], [0x30017, 0, 0]]);
assert.throws(() => worker.imports.host.gpu_gl_call(0x30018, 0, 0),
  /unexpected direct OpenGL worker call/, 'unknown calls still fail loudly');
console.log('PASS D3D9 format capability query reaches the page broker');
