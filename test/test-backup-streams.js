#!/usr/bin/env node
'use strict';

const assert = require('assert');
const apiTable = require('../src/api_table.json');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_backup_read_id") (result i32)
    (call $lookup_api_id "BackupRead"))
  (func (export "test_backup_write_id") (result i32)
    (call $lookup_api_id "BackupWrite"))
  (func (export "test_backup_seek_id") (result i32)
    (call $lookup_api_id "BackupSeek"))

  (func (export "test_backup_read")
      (param $h i32) (param $buf i32) (param $n i32) (param $count i32)
      (param $abort i32) (param $security i32) (param $context i32)
      (param $esp0 i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $esp0))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))
      (local.get $security))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))
      (local.get $context))
    (call $handle_BackupRead
      (local.get $h) (local.get $buf) (local.get $n) (local.get $count)
      (local.get $abort) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_backup_write")
      (param $h i32) (param $buf i32) (param $n i32) (param $count i32)
      (param $abort i32) (param $security i32) (param $context i32)
      (param $esp0 i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $esp0))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))
      (local.get $security))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))
      (local.get $context))
    (call $handle_BackupWrite
      (local.get $h) (local.get $buf) (local.get $n) (local.get $count)
      (local.get $abort) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_backup_seek")
      (param $h i32) (param $low i32) (param $high i32)
      (param $actualLow i32) (param $actualHigh i32) (param $context i32)
      (param $esp0 i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $esp0))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))
      (local.get $context))
    (call $handle_BackupSeek
      (local.get $h) (local.get $low) (local.get $high)
      (local.get $actualLow) (local.get $actualHigh) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_set_last_error") (param $value i32)
    (global.set $last_error (local.get $value)))
`;

(async () => {
  let harness;
  let writeLimit = -1;
  let failSeek = false;
  harness = await bootRenderHarness({
    fonts: 'none', extraWat,
    extraHostOverrides: {
      fs_write_file(handle, bufGA, nToWrite, nWrittenGA) {
        const e = harness.exports;
        const vfs = harness.hostCtx.vfs;
        const requested = nToWrite >>> 0;
        const actual = writeLimit < 0
          ? requested : Math.min(requested, writeLimit >>> 0);
        const data = new Uint8Array(
          harness.memory.buffer, e.guest_to_wasm(bufGA), actual);
        const result = vfs.writeFile(handle, data, actual);
        if (nWrittenGA) e.guest_write32(nWrittenGA, result.ok ? actual : 0);
        return result.ok ? 1 : 0;
      },
      fs_set_file_pointer(handle, distance, moveMethod) {
        if (failSeek) return -1;
        return harness.hostCtx.vfs.setFilePointer(handle, distance, moveMethod);
      },
    },
  });
  const { exports: e, hostCtx } = harness;
  const vfs = hostCtx.vfs;
  const esp0 = 0x07390000;
  const LAST_ERROR_SENTINEL = 0x5a5aa55a;
  const ERROR_INVALID_HANDLE = 6;
  const ERROR_SEEK = 25;
  const ERROR_NOT_SUPPORTED = 50;
  const ERROR_INVALID_PARAMETER = 87;

  const apiNames = ['BackupRead', 'BackupWrite', 'BackupSeek'];
  const apiIds = apiNames.map(name => apiTable.find(api => api.name === name));
  const priorTail = apiTable.find(api => api.name === 'PropertySheetW');
  assert(priorTail, 'the serialized API lane predecessor is present');
  apiIds.forEach((api, index) => {
    assert(api, `${apiNames[index]} is exported`);
    assert.strictEqual(api.nargs, index === 2 ? 6 : 7);
    assert.strictEqual(api.convention, 'stdcall');
    assert.strictEqual(api.id, priorTail.id + index + 1,
      `${api.name} was not appended after the prior stable API tail`);
  });
  assert.strictEqual(e.test_backup_read_id(), apiIds[0].id);
  assert.strictEqual(e.test_backup_write_id(), apiIds[1].id);
  assert.strictEqual(e.test_backup_seek_id(), apiIds[2].id);

  const alloc = n => e.guest_alloc(n) >>> 0;
  const read32 = p => e.guest_read32(p) >>> 0;
  const write32 = (p, n) => e.guest_write32(p, n);
  const buffer = alloc(256);
  const count = alloc(4);
  const actualLow = alloc(4);
  const actualHigh = alloc(4);
  const readContext = alloc(4);
  const writeContext = alloc(4);
  write32(readContext, 0);
  write32(writeContext, 0);

  const putBytes = (ptr, bytes) => {
    for (let i = 0; i < bytes.length; i++) e.guest_write8(ptr + i, bytes[i]);
  };
  const getBytes = (ptr, length) => Uint8Array.from(
    { length }, (_, i) => e.guest_read8(ptr + i));
  const readCall = (h, n, context = readContext, opts = {}) =>
    e.test_backup_read(h, opts.buffer === undefined ? buffer : opts.buffer,
      n, opts.count === undefined ? count : opts.count, opts.abort || 0,
      opts.security || 0, context, esp0);
  const writeCall = (h, n, context = writeContext, opts = {}) =>
    e.test_backup_write(h, opts.buffer === undefined ? buffer : opts.buffer,
      n, opts.count === undefined ? count : opts.count, opts.abort || 0,
      opts.security || 0, context, esp0);
  const seekCall = (h, low, high, context, lowOut = actualLow,
    highOut = actualHigh) => e.test_backup_seek(
      h, low, high, lowOut, highOut, context, esp0);
  const seedError = () => e.test_set_last_error(LAST_ERROR_SENTINEL);
  const expectErrorPreserved = label => assert.strictEqual(
    e.test_get_last_error() >>> 0, LAST_ERROR_SENTINEL, label);
  const checkEsp = (delta, label) => assert.strictEqual(
    e.get_esp() >>> 0, (esp0 + delta) >>> 0, label);

  const source = Uint8Array.from(
    { length: 67 }, (_, i) => (0x10 + i * 17) & 0xff);
  vfs.files.set('c:\\backup-source.bin', { data: source.slice(), attrs: 0x20 });
  const sourceHandle = vfs.createFile('c:\\backup-source.bin', 0x80000000, 3);
  assert.ok(sourceHandle);
  vfs.handles.get(sourceHandle).pos = 6;

  // Every nonempty buffer is larger than the documented 20-byte fixed header.
  // The first call still returns only three payload bytes, exercising partial
  // stream transfer without inventing undersized-header behavior.
  const serialized = [];
  for (const request of [23, 32, 32]) {
    seedError();
    assert.strictEqual(readCall(sourceHandle, request), 1);
    const got = read32(count);
    serialized.push(...getBytes(buffer, got));
    checkEsp(32, 'BackupRead pops return address plus seven arguments');
    expectErrorPreserved('successful BackupRead preserves last-error');
    if (got === 0) break;
  }
  seedError();
  assert.strictEqual(readCall(sourceHandle, 64), 1);
  assert.strictEqual(read32(count), 0,
    'a successful zero count marks the end of all backup streams');
  expectErrorPreserved('BackupRead EOF preserves last-error');
  assert.notStrictEqual(read32(readContext), 0,
    'BackupRead retains an opaque context until the documented abort call');
  assert.strictEqual(serialized.length, 20 + source.length);
  const header = Buffer.from(serialized.slice(0, 20));
  assert.strictEqual(header.readUInt32LE(0), 1, 'only BACKUP_DATA is advertised');
  assert.strictEqual(header.readUInt32LE(4), 0, 'no unsupported stream attributes');
  assert.strictEqual(header.readUInt32LE(8), source.length, 'stream size low');
  assert.strictEqual(header.readUInt32LE(12), 0, 'bounded VFS stream size high');
  assert.strictEqual(header.readUInt32LE(16), 0, 'unnamed stream has no name');
  assert.deepStrictEqual(serialized.slice(20), [...source]);
  assert.strictEqual(vfs.handles.get(sourceHandle).pos, source.length,
    'a fresh BackupRead context starts at the unnamed stream beginning');

  vfs.files.set('c:\\backup-dest.bin', {
    data: new Uint8Array(140).fill(0xee), attrs: 0x20,
  });
  const destHandle = vfs.createFile('c:\\backup-dest.bin', 0x40000000, 3);
  assert.ok(destHandle);
  let inputOffset = 0;
  for (const request of [23, 32, 32]) {
    if (inputOffset >= serialized.length) break;
    const amount = Math.min(request, serialized.length - inputOffset);
    putBytes(buffer, serialized.slice(inputOffset, inputOffset + amount));
    seedError();
    assert.strictEqual(writeCall(destHandle, amount), 1);
    assert.strictEqual(read32(count), amount,
      'BackupWrite reports serialized header and payload bytes consumed');
    inputOffset += amount;
    checkEsp(32, 'BackupWrite pops return address plus seven arguments');
    expectErrorPreserved('successful BackupWrite preserves last-error');
  }
  assert.strictEqual(inputOffset, serialized.length);
  assert.deepStrictEqual(
    [...vfs.files.get('c:\\backup-dest.bin').data], [...source],
    'BackupWrite restores and truncates the complete unnamed data stream');

  // Respect the host's byte count even when a successful write is short.
  const partialContext = alloc(4);
  write32(partialContext, 0);
  vfs.files.set('c:\\backup-partial-write.bin', {
    data: new Uint8Array(0), attrs: 0x20,
  });
  const partialHandle = vfs.createFile(
    'c:\\backup-partial-write.bin', 0x40000000, 2);
  const partialHeader = Buffer.alloc(20);
  partialHeader.writeUInt32LE(1, 0);
  partialHeader.writeUInt32LE(55, 8);
  const partialPayload = Uint8Array.from(
    { length: 55 }, (_, i) => (0xa0 + i) & 0xff);
  putBytes(buffer, Buffer.concat([
    partialHeader, Buffer.from(partialPayload.subarray(0, 3)),
  ]));
  assert.strictEqual(writeCall(partialHandle, 23, partialContext), 1);
  putBytes(buffer, partialPayload.subarray(3, 26));
  writeLimit = 2;
  assert.strictEqual(writeCall(partialHandle, 23, partialContext), 1);
  assert.strictEqual(read32(count), 2,
    'BackupWrite reports the actual successful host byte count');
  assert.deepStrictEqual(
    [...vfs.files.get('c:\\backup-partial-write.bin').data],
    [...partialPayload.subarray(0, 5)]);
  writeLimit = -1;
  putBytes(buffer, partialPayload.subarray(5, 30));
  assert.strictEqual(writeCall(partialHandle, 25, partialContext), 1);
  putBytes(buffer, partialPayload.subarray(30));
  assert.strictEqual(writeCall(partialHandle, 25, partialContext), 1);
  assert.deepStrictEqual(
    [...vfs.files.get('c:\\backup-partial-write.bin').data],
    [...partialPayload]);
  assert.strictEqual(writeCall(0, 0, partialContext, {
    buffer: 0, count: 0, abort: 1,
  }), 1);

  // A host that returns success without consuming a requested payload byte
  // is a write fault, not a successful zero-progress loop. The same byte can
  // be retried after the host starts making progress again.
  const zeroWriteContext = alloc(4);
  write32(zeroWriteContext, 0);
  vfs.files.set('c:\\backup-zero-write.bin', {
    data: new Uint8Array(0), attrs: 0x20,
  });
  const zeroWriteHandle = vfs.createFile(
    'c:\\backup-zero-write.bin', 0x40000000, 2);
  const oneByteHeader = Buffer.alloc(20);
  oneByteHeader.writeUInt32LE(1, 0);
  oneByteHeader.writeUInt32LE(24, 8);
  const zeroWritePayload = Uint8Array.from(
    { length: 24 }, (_, i) => 0x60 + i);
  putBytes(buffer, Buffer.concat([
    oneByteHeader, Buffer.from(zeroWritePayload.subarray(0, 1)),
  ]));
  assert.strictEqual(writeCall(zeroWriteHandle, 21, zeroWriteContext), 1);
  putBytes(buffer, zeroWritePayload.subarray(1));
  writeLimit = 0;
  assert.strictEqual(writeCall(zeroWriteHandle, 23, zeroWriteContext), 0);
  assert.strictEqual(read32(count), 0);
  assert.strictEqual(e.test_get_last_error(), 29);
  assert.deepStrictEqual(
    [...vfs.files.get('c:\\backup-zero-write.bin').data],
    [...zeroWritePayload.subarray(0, 1)]);
  writeLimit = -1;
  assert.strictEqual(writeCall(zeroWriteHandle, 23, zeroWriteContext), 1);
  assert.deepStrictEqual(
    [...vfs.files.get('c:\\backup-zero-write.bin').data],
    [...zeroWritePayload]);
  assert.strictEqual(writeCall(0, 0, zeroWriteContext, {
    buffer: 0, count: 0, abort: 1,
  }), 1);

  // The abort call ignores every non-context argument, frees the internal
  // allocation, zeros the caller's slot, and remains harmless if repeated.
  seedError();
  assert.strictEqual(readCall(0xdeadbeef, 0xffffffff, readContext, {
    buffer: 0xf0000000, count: 0xf0000000, abort: 1, security: 1,
  }), 1);
  assert.strictEqual(read32(readContext), 0);
  checkEsp(32, 'BackupRead abort has the same stdcall ABI');
  expectErrorPreserved('BackupRead abort preserves last-error');
  assert.strictEqual(readCall(0, 0, readContext, {
    buffer: 0, count: 0, abort: 1,
  }), 1, 'aborting an already empty context slot is safe');
  assert.strictEqual(readCall(sourceHandle, 21, readContext), 1,
    'a released slot starts a fresh BackupRead operation');
  assert.strictEqual(read32(count), 21);
  assert.deepStrictEqual([...getBytes(buffer, 4)], [1, 0, 0, 0],
    'fresh context starts again at the WIN32_STREAM_ID header');
  assert.strictEqual(readCall(0, 0, readContext, {
    buffer: 0, count: 0, abort: 1,
  }), 1);
  seedError();
  assert.strictEqual(writeCall(0xdeadbeef, 0xffffffff, writeContext, {
    buffer: 0xf0000000, count: 0xf0000000, abort: 1, security: 1,
  }), 1);
  assert.strictEqual(read32(writeContext), 0);
  expectErrorPreserved('BackupWrite abort preserves last-error');

  // Unsupported or malformed stream metadata is rejected before a single
  // destination byte is written, even when payload follows in the same call.
  const badContext = alloc(4);
  write32(badContext, 0);
  vfs.files.set('c:\\backup-bad.bin', { data: new Uint8Array(0), attrs: 0x20 });
  const badHandle = vfs.createFile('c:\\backup-bad.bin', 0x40000000, 2);
  const alternate = Buffer.alloc(24);
  alternate.writeUInt32LE(4, 0); // BACKUP_ALTERNATE_DATA: not modeled
  alternate.writeUInt32LE(4, 8);
  alternate.writeUInt32LE(0, 12);
  alternate.writeUInt32LE(0, 16);
  alternate.fill(0x77, 20);
  putBytes(buffer, alternate);
  assert.strictEqual(writeCall(badHandle, alternate.length, badContext), 0);
  assert.strictEqual(read32(count), 0);
  assert.strictEqual(e.test_get_last_error(), ERROR_NOT_SUPPORTED);
  assert.strictEqual(vfs.files.get('c:\\backup-bad.bin').data.length, 0,
    'unsupported header plus payload is transactional');
  assert.strictEqual(writeCall(0, 0, badContext, {
    buffer: 0, count: 0, abort: 1,
  }), 1);

  // Microsoft requires every nonempty transfer buffer to be larger than the
  // fixed header. Undersized calls fail before allocating context or writing.
  const named = Buffer.alloc(20);
  named.writeUInt32LE(1, 0);
  named.writeUInt32LE(3, 8);
  named.writeUInt32LE(2, 16); // a name is unsupported in this VFS
  putBytes(buffer, named.subarray(0, 9));
  assert.strictEqual(writeCall(badHandle, 9, badContext), 0);
  assert.strictEqual(read32(count), 0);
  assert.strictEqual(read32(badContext), 0);
  assert.strictEqual(e.test_get_last_error(), ERROR_INVALID_PARAMETER);
  assert.strictEqual(vfs.files.get('c:\\backup-bad.bin').data.length, 0);
  assert.strictEqual(readCall(sourceHandle, 20, badContext), 0);
  assert.strictEqual(read32(badContext), 0);
  assert.strictEqual(e.test_get_last_error(), ERROR_INVALID_PARAMETER);
  const namedAndPayload = Buffer.concat([named, Buffer.from([1])]);
  putBytes(buffer, namedAndPayload);
  assert.strictEqual(writeCall(badHandle, 21, badContext), 0);
  assert.strictEqual(read32(count), 0);
  assert.strictEqual(e.test_get_last_error(), ERROR_NOT_SUPPORTED);
  assert.strictEqual(vfs.files.get('c:\\backup-bad.bin').data.length, 0);
  assert.strictEqual(writeCall(0, 0, badContext, {
    buffer: 0, count: 0, abort: 1,
  }), 1);

  // If the file shrinks after its stream header was emitted, a zero-progress
  // host EOF is a read fault. Restoring the bytes lets the same context retry.
  const shrinkPath = 'c:\\backup-shrink.bin';
  const shrinkBytes = Uint8Array.from([0x31, 0x32, 0x33]);
  vfs.files.set(shrinkPath, { data: shrinkBytes.slice(), attrs: 0x20 });
  const shrinkHandle = vfs.createFile(shrinkPath, 0x80000000, 3);
  const shrinkContext = alloc(4);
  write32(shrinkContext, 0);
  assert.strictEqual(readCall(shrinkHandle, 21, shrinkContext), 1);
  assert.strictEqual(read32(count), 21);
  vfs.files.get(shrinkPath).data = new Uint8Array(0);
  assert.strictEqual(readCall(shrinkHandle, 21, shrinkContext), 0);
  assert.strictEqual(read32(count), 0);
  assert.strictEqual(e.test_get_last_error(), 30);
  vfs.files.get(shrinkPath).data = shrinkBytes.slice();
  assert.strictEqual(readCall(shrinkHandle, 21, shrinkContext), 1,
    'premature EOF does not consume opaque context progress');
  assert.strictEqual(read32(count), 2);
  assert.deepStrictEqual([...getBytes(buffer, 2)], [...shrinkBytes.subarray(1)]);
  assert.strictEqual(readCall(0, 0, shrinkContext, {
    buffer: 0, count: 0, abort: 1,
  }), 1);

  // Seek is payload-relative, forward-only, and never crosses the current
  // stream. Test both exact and overlong movements plus the header boundary.
  const seekSourceContext = alloc(4);
  write32(seekSourceContext, 0);
  const seekHandle = vfs.createFile('c:\\backup-source.bin', 0x80000000, 3);
  assert.strictEqual(readCall(seekHandle, 21, seekSourceContext), 1);
  assert.strictEqual(read32(count), 21);
  assert.strictEqual(vfs.handles.get(seekHandle).pos, 1);
  failSeek = true;
  assert.strictEqual(seekCall(seekHandle, 3, 0, seekSourceContext), 0,
    'a host cursor failure is not claimed as movement');
  assert.strictEqual(read32(actualLow), 0);
  assert.strictEqual(read32(actualHigh), 0);
  assert.strictEqual(vfs.handles.get(seekHandle).pos, 1);
  assert.strictEqual(e.test_get_last_error(), ERROR_SEEK);
  failSeek = false;
  seedError();
  assert.strictEqual(seekCall(seekHandle, 3, 0, seekSourceContext), 1);
  assert.strictEqual(read32(actualLow), 3);
  assert.strictEqual(read32(actualHigh), 0);
  assert.strictEqual(vfs.handles.get(seekHandle).pos, 4);
  checkEsp(28, 'BackupSeek pops return address plus six arguments');
  expectErrorPreserved('successful BackupSeek preserves last-error');
  assert.strictEqual(readCall(seekHandle, 21, seekSourceContext), 1);
  assert.deepStrictEqual([...getBytes(buffer, 21)], [...source.slice(4, 25)]);
  assert.strictEqual(seekCall(seekHandle, 99, 0, seekSourceContext), 0);
  assert.strictEqual(read32(actualLow), source.length - 25,
    'failed overlong seek reports and performs the actual remaining amount');
  assert.strictEqual(read32(actualHigh), 0);
  assert.strictEqual(e.test_get_last_error(), ERROR_SEEK);
  assert.strictEqual(vfs.handles.get(seekHandle).pos, source.length);
  assert.strictEqual(readCall(seekHandle, 21, seekSourceContext), 1);
  assert.strictEqual(read32(count), 0);
  assert.strictEqual(readCall(0, 0, seekSourceContext, {
    buffer: 0, count: 0, abort: 1,
  }), 1);

  const headerContext = alloc(4);
  write32(headerContext, 0);
  const headerHandle = vfs.createFile('c:\\backup-source.bin', 0x80000000, 3);
  assert.strictEqual(readCall(headerHandle, 0, headerContext, {
    buffer: 0,
  }), 1);
  assert.strictEqual(read32(count), 0);
  assert.strictEqual(seekCall(headerHandle, 1, 0, headerContext), 0);
  assert.strictEqual(read32(actualLow), 0);
  assert.strictEqual(e.test_get_last_error(), ERROR_SEEK);
  assert.strictEqual(vfs.handles.get(headerHandle).pos, 0,
    'BackupSeek cannot skip the stream header');
  assert.strictEqual(readCall(0, 0, headerContext, {
    buffer: 0, count: 0, abort: 1,
  }), 1);

  // Write-side seeking creates an ordinary zero-filled gap through the same
  // file-handle cursor used by WriteFile; it does not invent a sparse stream.
  const seekWriteContext = alloc(4);
  write32(seekWriteContext, 0);
  vfs.files.set('c:\\backup-seek-write.bin', {
    data: new Uint8Array(0), attrs: 0x20,
  });
  const seekWriteHandle = vfs.createFile(
    'c:\\backup-seek-write.bin', 0x40000000, 2);
  const seekWriteHeader = Buffer.alloc(20);
  seekWriteHeader.writeUInt32LE(1, 0);
  seekWriteHeader.writeUInt32LE(26, 8);
  putBytes(buffer, Buffer.concat([seekWriteHeader, Buffer.from([1])]));
  assert.strictEqual(writeCall(seekWriteHandle, 21, seekWriteContext), 1);
  assert.strictEqual(seekCall(seekWriteHandle, 2, 0, seekWriteContext), 1);
  const seekWriteTail = Uint8Array.from(
    { length: 23 }, (_, i) => i + 2);
  putBytes(buffer, seekWriteTail);
  assert.strictEqual(writeCall(seekWriteHandle, 23, seekWriteContext), 1);
  assert.deepStrictEqual(
    [...vfs.files.get('c:\\backup-seek-write.bin').data],
    [1, 0, 0, ...seekWriteTail]);
  assert.strictEqual(writeCall(0, 0, seekWriteContext, {
    buffer: 0, count: 0, abort: 1,
  }), 1);

  // Invalid handles and pointers fail with bounded writes and precise errors.
  const invalidContext = alloc(4);
  write32(invalidContext, 0);
  write32(count, 0xcccccccc);
  assert.strictEqual(readCall(0xdeadbeef, 21, invalidContext), 0);
  assert.strictEqual(read32(count), 0);
  assert.strictEqual(read32(invalidContext), 0);
  assert.strictEqual(e.test_get_last_error(), ERROR_INVALID_HANDLE);
  assert.strictEqual(readCall(sourceHandle, 21, 0), 0);
  assert.strictEqual(e.test_get_last_error(), ERROR_INVALID_PARAMETER);
  assert.strictEqual(readCall(sourceHandle, 21, invalidContext, {
    buffer: 0xf0000000,
  }), 0);
  assert.strictEqual(e.test_get_last_error(), ERROR_INVALID_PARAMETER);
  assert.strictEqual(writeCall(destHandle, 21, invalidContext, {
    buffer: 0xf0000000,
  }), 0);
  assert.strictEqual(e.test_get_last_error(), ERROR_INVALID_PARAMETER);

  // bProcessSecurity asks the API to process security streams if they exist;
  // it does not make an ordinary BACKUP_DATA stream unsupported.
  write32(invalidContext, 0);
  assert.strictEqual(readCall(sourceHandle, 21, invalidContext, {
    security: 1,
  }), 1);
  assert.strictEqual(read32(count), 21);
  assert.strictEqual(read32(buffer), 1);
  assert.strictEqual(readCall(0, 0, invalidContext, {
    buffer: 0, count: 0, abort: 1,
  }), 1);

  const securityWriteContext = alloc(4);
  write32(securityWriteContext, 0);
  const securityWritePath = 'c:\\backup-security-flag.bin';
  vfs.files.set(securityWritePath, { data: new Uint8Array(0), attrs: 0x20 });
  const securityWriteHandle = vfs.createFile(
    securityWritePath, 0x40000000, 2);
  const securityFlagStream = Buffer.alloc(21);
  securityFlagStream.writeUInt32LE(1, 0);
  securityFlagStream.writeUInt32LE(1, 8);
  securityFlagStream[20] = 0x5c;
  putBytes(buffer, securityFlagStream);
  assert.strictEqual(writeCall(securityWriteHandle, 21, securityWriteContext, {
    security: 1,
  }), 1);
  assert.deepStrictEqual([...vfs.files.get(securityWritePath).data], [0x5c]);
  assert.strictEqual(writeCall(0, 0, securityWriteContext, {
    buffer: 0, count: 0, abort: 1,
  }), 1);

  const securityStreamContext = alloc(4);
  write32(securityStreamContext, 0);
  const securityStream = Buffer.alloc(21);
  securityStream.writeUInt32LE(3, 0); // BACKUP_SECURITY_DATA
  securityStream.writeUInt32LE(1, 8);
  putBytes(buffer, securityStream);
  assert.strictEqual(writeCall(badHandle, 21, securityStreamContext, {
    security: 1,
  }), 0, 'an actual unsupported security stream is rejected');
  assert.strictEqual(e.test_get_last_error(), ERROR_NOT_SUPPORTED);
  assert.strictEqual(writeCall(0, 0, securityStreamContext, {
    buffer: 0, count: 0, abort: 1,
  }), 1);

  // A read context is not interchangeable with BackupWrite state.
  write32(invalidContext, 0);
  assert.strictEqual(readCall(sourceHandle, 21, invalidContext), 1);
  assert.notStrictEqual(read32(invalidContext), 0);
  assert.strictEqual(writeCall(sourceHandle, 0, invalidContext, {
    buffer: 0,
  }), 0);
  assert.strictEqual(e.test_get_last_error(), ERROR_INVALID_PARAMETER);
  assert.strictEqual(seekCall(sourceHandle, 1, 0, invalidContext, 0, actualHigh), 0);
  assert.strictEqual(e.test_get_last_error(), ERROR_INVALID_PARAMETER);
  assert.strictEqual(readCall(0, 0, invalidContext, {
    buffer: 0, count: 0, abort: 1,
  }), 1);

  console.log('PASS BackupRead/BackupWrite/BackupSeek unnamed stream, partial buffers, seek, abort, errors and stdcall ABI');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
