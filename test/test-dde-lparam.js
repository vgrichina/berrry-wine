#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');

const STACK = 0x00300000;
const WM_DDE_ADVISE = 0x03e2;
const WM_DDE_UNADVISE = 0x03e3;
const WM_DDE_ACK = 0x03e4;
const WM_DDE_DATA = 0x03e5;
const WM_DDE_REQUEST = 0x03e6;
const WM_DDE_POKE = 0x03e7;
const WM_DDE_EXECUTE = 0x03e8;

const extraWat = String.raw`
  (func (export "test_reuse_dde_lparam")
      (param $lparam i32) (param $msg_in i32) (param $msg_out i32)
      (param $lo i32) (param $hi i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_ReuseDDElParam
      (local.get $lparam) (local.get $msg_in) (local.get $msg_out)
      (local.get $lo) (local.get $hi) (i32.const 0))
    (i64.or
      (i64.extend_i32_u (i32.load offset=0 (global.get $reg_base)))
      (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))

  (func (export "test_unpack_dde_lparam")
      (param $msg i32) (param $lparam i32)
      (param $lo_out i32) (param $hi_out i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_UnpackDDElParam
      (local.get $msg) (local.get $lparam)
      (local.get $lo_out) (local.get $hi_out)
      (i32.const 0) (i32.const 0))
    (i64.or
      (i64.extend_i32_u (i32.load offset=0 (global.get $reg_base)))
      (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))

  (func (export "test_dde_object_valid")
      (param $lparam i32) (param $msg i32) (result i32)
    (call $dde_lparam_object_valid (local.get $lparam) (local.get $msg)))
  (func (export "test_set_last_error") (param $value i32)
    (global.set $last_error (local.get $value)))
`;

function low32(value) {
  return Number(value & 0xffffffffn) >>> 0;
}

function high32(value) {
  return Number(value >> 32n) >>> 0;
}

async function main() {
  const bytes = compileSrcWasm((filename, source) =>
    filename === '13-exports.wat' ? `${source}\n${extraWat}\n` : source);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const context = { exports: null, getMemory: () => memory.buffer };
  const imports = createHostImports(context);
  imports.host.memory = memory;
  imports.host.exit = () => {};
  imports.host.log = () => {};
  imports.host.log_i32 = () => {};
  imports.host.crash_unimplemented = () => {};
  imports.host.wait_multiple = () => 0;
  imports.host.terminate_thread = () => 0;
  imports.host.shell_execute = () => 33;
  const { instance } = await WebAssembly.instantiate(bytes, imports);
  const e = instance.exports;
  context.exports = e;

  const loOut = e.guest_alloc(8) >>> 0;
  const hiOut = e.guest_alloc(8) >>> 0;

  const reuse = (lparam, msgIn, msgOut, lo, hi) => {
    const result = e.test_reuse_dde_lparam(lparam, msgIn, msgOut, lo, hi);
    assert.strictEqual(high32(result), STACK + 24,
      'ReuseDDElParam pops five stdcall arguments and the return address');
    return low32(result);
  };
  const unpack = (msg, lparam, loPointer = loOut, hiPointer = hiOut) => {
    const result = e.test_unpack_dde_lparam(msg, lparam, loPointer, hiPointer);
    assert.strictEqual(high32(result), STACK + 20,
      'UnpackDDElParam pops four stdcall arguments and the return address');
    return low32(result);
  };

  e.test_set_last_error(0x12345678);
  let packed = reuse(0x22110001, WM_DDE_REQUEST, WM_DDE_DATA,
    0x12345678, 0x9abc);
  assert.notStrictEqual(packed, 0, 'REQUEST -> DATA allocates an opaque pair');
  assert.strictEqual(e.test_dde_object_valid(packed, WM_DDE_DATA), 1);
  assert.strictEqual(e.test_get_last_error() >>> 0, 0x12345678,
    'successful reuse does not invent a last-error value');

  e.guest_write32(loOut, 0xcccccccc);
  e.guest_write32(hiOut, 0xdddddddd);
  assert.strictEqual(unpack(WM_DDE_DATA, packed), 1);
  assert.strictEqual(e.guest_read32(loOut) >>> 0, 0x12345678,
    'packed messages retain the full 32-bit HGLOBAL-like low value');
  assert.strictEqual(e.guest_read32(hiOut) >>> 0, 0x9abc);
  assert.strictEqual(e.test_dde_object_valid(packed, WM_DDE_DATA), 1,
    'UnpackDDElParam does not consume the packing object');

  const reused = reuse(packed, WM_DDE_DATA, WM_DDE_POKE,
    0xfedcba98, 0x4567);
  assert.strictEqual(reused, packed,
    'two allocated message layouts reuse the same packing object');
  assert.strictEqual(e.test_dde_object_valid(packed, WM_DDE_DATA), 0,
    'the object is retagged for the outgoing message');
  assert.strictEqual(e.test_dde_object_valid(packed, WM_DDE_POKE), 1);
  assert.strictEqual(unpack(WM_DDE_POKE, packed), 1);
  assert.strictEqual(e.guest_read32(loOut) >>> 0, 0xfedcba98);
  assert.strictEqual(e.guest_read32(hiOut) >>> 0, 0x4567);

  e.guest_write32(loOut, 0xaaaaaaaa);
  e.guest_write32(hiOut, 0xbbbbbbbb);
  assert.strictEqual(unpack(WM_DDE_ADVISE, packed), 0,
    'a packing object cannot be decoded under a different DDE message');
  assert.strictEqual(e.guest_read32(loOut) >>> 0, 0xaaaaaaaa);
  assert.strictEqual(e.guest_read32(hiOut) >>> 0, 0xbbbbbbbb,
    'failed unpacking leaves both outputs untouched');

  const inlineAck = reuse(packed, WM_DDE_POKE, WM_DDE_ACK, 0x1234, 0xbeef);
  assert.strictEqual(inlineAck, 0xbeef1234,
    'an atom-based acknowledgement is a 16:16 inline pair');
  assert.strictEqual(e.test_dde_object_valid(packed, WM_DDE_POKE), 0,
    'converting to an inline result frees the incoming packing object');
  assert.strictEqual(unpack(WM_DDE_ACK, inlineAck), 1);
  assert.strictEqual(e.guest_read32(loOut) >>> 0, 0x1234);
  assert.strictEqual(e.guest_read32(hiOut) >>> 0, 0xbeef);

  assert.strictEqual(unpack(WM_DDE_REQUEST, 0xabcd0042), 1);
  assert.strictEqual(e.guest_read32(loOut) >>> 0, 0x42,
    'REQUEST keeps its clipboard format in the low word');
  assert.strictEqual(e.guest_read32(hiOut) >>> 0, 0xabcd,
    'REQUEST keeps its atom in the high word');
  assert.strictEqual(unpack(WM_DDE_UNADVISE, 0x33440055), 1);
  assert.strictEqual(e.guest_read32(loOut) >>> 0, 0x55);
  assert.strictEqual(e.guest_read32(hiOut) >>> 0, 0x3344);

  const commandHandle = 0x04123454;
  assert.strictEqual(unpack(WM_DDE_EXECUTE, commandHandle), 1);
  assert.strictEqual(e.guest_read32(loOut) >>> 0, 0,
    'EXECUTE has no low-word payload');
  assert.strictEqual(e.guest_read32(hiOut) >>> 0, commandHandle,
    'EXECUTE carries its global-memory object directly in lParam');

  const executeAck = reuse(commandHandle, WM_DDE_EXECUTE, WM_DDE_ACK,
    0x8000, commandHandle);
  assert.notStrictEqual(executeAck, 0);
  assert.notStrictEqual(executeAck, commandHandle,
    'an EXECUTE acknowledgement packs flags plus the full 32-bit handle');
  assert.strictEqual(e.test_dde_object_valid(executeAck, WM_DDE_ACK), 1);
  assert.strictEqual(unpack(WM_DDE_ACK, executeAck), 1);
  assert.strictEqual(e.guest_read32(loOut) >>> 0, 0x8000);
  assert.strictEqual(e.guest_read32(hiOut) >>> 0, commandHandle);

  const request = reuse(executeAck, WM_DDE_ACK, WM_DDE_REQUEST, 13, 0x7788);
  assert.strictEqual(request, 0x7788000d);
  assert.strictEqual(e.test_dde_object_valid(executeAck, WM_DDE_ACK), 0,
    'a packed ACK is consumed when reused for an inline REQUEST');
  assert.strictEqual(reuse(0, WM_DDE_REQUEST, WM_DDE_EXECUTE, 0xdeadbeef,
    commandHandle), commandHandle,
    'EXECUTE ignores the compatibility low value and returns the HGLOBAL directly');

  e.guest_write32(loOut, 0x11111111);
  e.guest_write32(hiOut, 0x22222222);
  assert.strictEqual(unpack(WM_DDE_DATA, 0x7fffffff), 0,
    'an always-packed message rejects a forged packing handle');
  assert.strictEqual(e.guest_read32(loOut) >>> 0, 0x11111111);
  assert.strictEqual(e.guest_read32(hiOut) >>> 0, 0x22222222);
  assert.strictEqual(reuse(0x7fffffff, WM_DDE_DATA, WM_DDE_ACK, 1, 2), 0,
    'ReuseDDElParam rejects a forged allocated input');

  e.guest_write32(loOut, 0x33333333);
  assert.strictEqual(unpack(WM_DDE_REQUEST, 0xabcd0042, loOut, 0), 0,
    'both output pointers are required and validated before either write');
  assert.strictEqual(e.guest_read32(loOut) >>> 0, 0x33333333);
  assert.strictEqual(unpack(0x03e1, 0, loOut, hiOut), 0,
    'WM_DDE_TERMINATE has no packable payload');
  assert.strictEqual(reuse(0, 0x03e1, WM_DDE_REQUEST, 1, 2), 0,
    'unsupported incoming messages fail instead of fabricating ownership');
  assert.strictEqual(e.test_get_last_error() >>> 0, 0x12345678,
    'the packing APIs preserve last error because their contract defines none');

  console.log('PASS  Reuse/UnpackDDElParam preserve Win32 message layouts and packing ownership');
}

main().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
