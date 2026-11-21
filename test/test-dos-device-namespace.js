#!/usr/bin/env node
'use strict';

// QueryDosDeviceA and DefineDosDeviceA are one coherent Win9x-style namespace:
// mounted VFS drive letters provide system definitions, while DefineDosDevice
// pushes and removes bounded metadata mappings visible to every WASM instance
// in the process.  This test deliberately does not open a mapped name: the
// browser has no kernel device object behind these namespace junctions.
const assert = require('assert');
const apiTable = require('../src/api_table.json');
const { bootRenderHarness } = require('./render-helper');

const EXTRA_WAT = String.raw`
  (func (export "test_call_QueryDosDeviceA")
      (param $name i32) (param $out i32) (param $max i32)
      (param $esp0 i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $esp0))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0))
    (call $handle_QueryDosDeviceA
      (local.get $name) (local.get $out) (local.get $max)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_call_DefineDosDeviceA")
      (param $flags i32) (param $name i32) (param $target i32)
      (param $esp0 i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $esp0))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0))
    (call $handle_DefineDosDeviceA
      (local.get $flags) (local.get $name) (local.get $target)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_set_last_error") (param $value i32)
    (global.set $last_error (local.get $value)))
  (func (export "test_query_dos_device_id") (result i32)
    (call $lookup_api_id "QueryDosDeviceA"))
  (func (export "test_define_dos_device_id") (result i32)
    (call $lookup_api_id "DefineDosDeviceA"))
`;

const DDD_RAW_TARGET_PATH = 0x1;
const DDD_REMOVE_DEFINITION = 0x2;
const DDD_EXACT_MATCH_ON_REMOVE = 0x4;
const DDD_NO_BROADCAST_SYSTEM = 0x8;
const ERROR_FILE_NOT_FOUND = 2;
const ERROR_NOT_ENOUGH_MEMORY = 8;
const ERROR_INVALID_PARAMETER = 87;
const ERROR_INSUFFICIENT_BUFFER = 122;
const ERROR_INVALID_NAME = 123;
const LAST_ERROR_SENTINEL = 0x5a5aa55a;
const esp0 = 0x07390000;

function helpers(e) {
  const alloc = n => e.guest_alloc(n) >>> 0;
  const writeA = value => {
    const bytes = Buffer.from(`${value}\0`, 'latin1');
    const ptr = alloc(bytes.length);
    bytes.forEach((byte, i) => e.guest_write8(ptr + i, byte));
    return ptr;
  };
  const readBytes = (ptr, count) => {
    const bytes = [];
    for (let i = 0; i < count; i++) bytes.push(e.guest_read8(ptr + i));
    return bytes;
  };
  const readMultiSz = (ptr, count) => {
    const strings = [];
    let current = [];
    for (const byte of readBytes(ptr, count)) {
      if (byte) {
        current.push(byte);
      } else if (current.length) {
        strings.push(Buffer.from(current).toString('latin1'));
        current = [];
      } else {
        break;
      }
    }
    return strings;
  };
  return { alloc, writeA, readBytes, readMultiSz };
}

function callQuery(e, name, out, max) {
  const result = e.test_call_QueryDosDeviceA(name, out, max, esp0) >>> 0;
  assert.strictEqual(e.get_esp() >>> 0, esp0 + 16,
    'QueryDosDeviceA pops return address plus three arguments');
  return result;
}

function callDefine(e, flags, name, target) {
  const result = e.test_call_DefineDosDeviceA(flags, name, target, esp0) >>> 0;
  assert.strictEqual(e.get_esp() >>> 0, esp0 + 16,
    'DefineDosDeviceA pops return address plus three arguments');
  return result;
}

(async () => {
  const memory = new WebAssembly.Memory({
    initial: 8192, maximum: 8192, shared: true,
  });
  const main = await bootRenderHarness({ extraWat: EXTRA_WAT, fonts: 'none', memory });
  const e = main.exports;
  const h = helpers(e);
  const out = h.alloc(2048);

  for (const [name, expectedId, lookup] of [
    ['QueryDosDeviceA', 3618, e.test_query_dos_device_id],
    ['DefineDosDeviceA', 3619, e.test_define_dos_device_id],
  ]) {
    const api = apiTable.find(entry => entry.name === name);
    assert.deepStrictEqual(
      api && { id: api.id, nargs: api.nargs, convention: api.convention },
      { id: expectedId, nargs: 3, convention: 'stdcall' },
      `${name} keeps its append-only API identity and ABI`);
    assert.strictEqual(lookup() >>> 0, expectedId,
      `the generated hash table resolves ${name}`);
  }

  e.test_set_last_error(LAST_ERROR_SENTINEL);
  let size = callQuery(e, h.writeA('c:'), out, 2048);
  assert.strictEqual(size, '\\Device\\HarddiskVolume1'.length + 2,
    'one-name query reports every stored byte including the double NUL');
  assert.deepStrictEqual(h.readMultiSz(out, size), ['\\Device\\HarddiskVolume1']);
  assert.strictEqual(e.test_get_last_error() >>> 0, LAST_ERROR_SENTINEL,
    'successful query preserves incoming last-error');

  size = callQuery(e, 0, out, 2048);
  assert.strictEqual(size, 7, 'C: and D: plus final NUL occupy seven bytes');
  assert.deepStrictEqual(h.readMultiSz(out, size), ['C:', 'D:'],
    'NULL name enumerates the VFS-visible system drive namespace');

  for (let i = 0; i < 32; i++) e.guest_write8(out + i, 0xa5);
  assert.strictEqual(callQuery(e, h.writeA('C:'), out, 5), 0,
    'an undersized query buffer fails');
  assert.strictEqual(e.test_get_last_error() >>> 0, ERROR_INSUFFICIENT_BUFFER);
  assert.deepStrictEqual(h.readBytes(out, 32), Array(32).fill(0xa5),
    'buffer-too-small failure is transactional');

  assert.strictEqual(callQuery(e, h.writeA('missing'), out, 2048), 0);
  assert.strictEqual(e.test_get_last_error() >>> 0, ERROR_FILE_NOT_FOUND,
    'an unknown device name reports ERROR_FILE_NOT_FOUND');
  assert.strictEqual(callQuery(e, h.writeA('C:\\'), out, 2048), 0);
  assert.strictEqual(e.test_get_last_error() >>> 0, ERROR_INVALID_NAME,
    'a trailing slash is not a legal device name');
  assert.strictEqual(callQuery(e, h.writeA('C:'), 0, 2048), 0);
  assert.strictEqual(e.test_get_last_error() >>> 0, ERROR_INVALID_PARAMETER,
    'a sufficiently-sized NULL output is rejected without touching memory');

  const x = h.writeA('x:');
  const rawOne = h.writeA('\\Device\\Ramdisk0');
  const rawTwo = h.writeA('\\Device\\Ramdisk1');
  e.test_set_last_error(LAST_ERROR_SENTINEL);
  assert.strictEqual(callDefine(e, DDD_RAW_TARGET_PATH, x, rawOne), 1);
  assert.strictEqual(callDefine(e,
    DDD_RAW_TARGET_PATH | DDD_NO_BROADCAST_SYSTEM, x, rawTwo), 1,
    'DDD_NO_BROADCAST_SYSTEM is accepted even though no host broadcast exists');
  assert.strictEqual(e.test_get_last_error() >>> 0, LAST_ERROR_SENTINEL,
    'successful definitions preserve last-error');
  size = callQuery(e, h.writeA('X:'), out, 2048);
  assert.deepStrictEqual(h.readMultiSz(out, size), [
    '\\Device\\Ramdisk1', '\\Device\\Ramdisk0',
  ], 'new definitions stack ahead of undeleted prior mappings');

  size = callQuery(e, 0, out, 2048);
  assert.deepStrictEqual(h.readMultiSz(out, size), ['C:', 'D:', 'X:'],
    'enumeration returns each custom name once, in addition to system names');

  // Instantiate the worker after both definitions. Its data segments rewrite
  // only immutable strings, not the shared mapping records.
  const worker = await bootRenderHarness({ extraWat: EXTRA_WAT, fonts: 'none', memory });
  worker.exports.set_current_thread_id(2);
  const wh = helpers(worker.exports);
  const workerOut = wh.alloc(512);
  size = callQuery(worker.exports, wh.writeA('x:'), workerOut, 512);
  assert.deepStrictEqual(wh.readMultiSz(workerOut, size), [
    '\\Device\\Ramdisk1', '\\Device\\Ramdisk0',
  ], 'definitions are shared across the process main/Worker instances');

  assert.strictEqual(callDefine(e,
    DDD_RAW_TARGET_PATH | DDD_REMOVE_DEFINITION | DDD_EXACT_MATCH_ON_REMOVE,
    x, rawOne), 1, 'exact removal can remove an older mapping without popping current');
  size = callQuery(e, x, out, 2048);
  assert.deepStrictEqual(h.readMultiSz(out, size), ['\\Device\\Ramdisk1']);

  const z = h.writeA('Z:');
  const disk1 = h.writeA('\\Device\\Disk1');
  const disk10 = h.writeA('\\Device\\Disk10');
  assert.strictEqual(callDefine(e, DDD_RAW_TARGET_PATH, z, disk1), 1);
  assert.strictEqual(callDefine(e, DDD_RAW_TARGET_PATH, z, disk10), 1);
  assert.strictEqual(callDefine(e,
    DDD_RAW_TARGET_PATH | DDD_REMOVE_DEFINITION, z, disk1), 1,
    'default removal treats lpTargetPath as a prefix and removes first match');
  size = callQuery(e, z, out, 2048);
  assert.deepStrictEqual(h.readMultiSz(out, size), ['\\Device\\Disk1'],
    'prefix removal selected the newer Disk10 mapping');
  assert.strictEqual(callDefine(e,
    DDD_RAW_TARGET_PATH | DDD_REMOVE_DEFINITION | DDD_EXACT_MATCH_ON_REMOVE,
    z, disk1), 1);
  assert.strictEqual(callQuery(e, z, out, 2048), 0);
  assert.strictEqual(e.test_get_last_error() >>> 0, ERROR_FILE_NOT_FOUND);

  const y = h.writeA('Y:');
  assert.strictEqual(callDefine(e, 0, y, h.writeA('C:/FAR')), 1,
    'a representable absolute DOS path is converted rather than stored raw');
  size = callQuery(e, y, out, 2048);
  assert.deepStrictEqual(h.readMultiSz(out, size), ['\\??\\C:\\FAR']);
  assert.strictEqual(callDefine(e, DDD_REMOVE_DEFINITION, y, 0), 1,
    'NULL removal target pops the current mapping');
  assert.strictEqual(callQuery(e, y, out, 2048), 0);
  assert.strictEqual(e.test_get_last_error() >>> 0, ERROR_FILE_NOT_FOUND);

  assert.strictEqual(callDefine(e, DDD_EXACT_MATCH_ON_REMOVE,
    h.writeA('Q:'), h.writeA('C:\\TEMP')), 0,
    'DDD_EXACT_MATCH_ON_REMOVE is invalid without DDD_REMOVE_DEFINITION');
  assert.strictEqual(e.test_get_last_error() >>> 0, ERROR_INVALID_PARAMETER);
  assert.strictEqual(callDefine(e, 0,
    h.writeA('BAD:'), h.writeA('C:\\TEMP')), 0);
  assert.strictEqual(e.test_get_last_error() >>> 0, ERROR_INVALID_NAME,
    'only a drive letter may end in a colon');
  assert.strictEqual(callDefine(e, 0,
    h.writeA('Q:'), h.writeA('relative\\path')), 0);
  assert.strictEqual(e.test_get_last_error() >>> 0, ERROR_INVALID_NAME,
    'relative DOS targets are refused when no safe object-path conversion exists');
  assert.strictEqual(callDefine(e, 0x10,
    h.writeA('Q:'), h.writeA('C:\\TEMP')), 0);
  assert.strictEqual(e.test_get_last_error() >>> 0, ERROR_INVALID_PARAMETER,
    'unknown DefineDosDevice flags are rejected');

  // Fill the bounded table with distinct live names. X: remains live above;
  // the 32nd additional definition therefore reaches the honest capacity.
  for (let i = 0; i < 32; i++) {
    const ok = callDefine(e, DDD_RAW_TARGET_PATH,
      h.writeA(`DEV${i}`), h.writeA(`\\Device\\Test${i}`));
    if (i < 31) assert.strictEqual(ok, 1, `record ${i} should fit`);
    else {
      assert.strictEqual(ok, 0, 'the fixed namespace reports capacity exhaustion');
      assert.strictEqual(e.test_get_last_error() >>> 0, ERROR_NOT_ENOUGH_MEMORY);
    }
  }
  size = callQuery(e, x, out, 2048);
  assert.deepStrictEqual(h.readMultiSz(out, size), ['\\Device\\Ramdisk1'],
    'capacity failure leaves existing mappings intact');

  console.log('dos-device namespace tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
