#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { VirtualFS, createFilesystemImports } = require('../lib/filesystem');
const { processSharedCtx } = require('../lib/worker-imports');
const { sigs } = require('../lib/host-import-sigs.generated.json');

// Real VFS and host imports, no compiled guest or large linear memory needed.
const memory = new ArrayBuffer(4096);
new Uint8Array(memory).set(Buffer.from('c:\\descriptor.dat\0'), 64);
const vfs = new VirtualFS();
const ctx = { vfs, getMemory: () => memory };
const main = createFilesystemImports(ctx);
const worker = createFilesystemImports({ ...processSharedCtx(ctx), getMemory: () => memory, threadId: 2 });
const other = createFilesystemImports({ vfs: new VirtualFS(), getMemory: () => memory });
const raw = vfs.createFile('c:\\descriptor.dat', 0xc0000000, 2);
vfs.writeFile(raw, Buffer.from('abcdef'), 6);
assert.strictEqual(main.fs_crt_descriptor_query(raw), 0, 'raw Win32 handle is foreign');
assert.strictEqual(main.fs_crt_descriptor_query(0), 0, 'stdin is not a disk descriptor');
const fd = main.fs_crt_open(64, 0x8002);
assert.notStrictEqual(fd, 0xffffffff);
assert.strictEqual(main.fs_crt_descriptor_query(fd), 15);
assert.strictEqual(worker.fs_crt_descriptor_query(fd), 15, 'process-shared record');
assert.strictEqual(other.fs_crt_descriptor_query(fd), 0, 'process isolation');
vfs.setFilePointer(fd, 2, 0);
const count = vfs.handles.size;
const record = vfs.getOpenFile(fd);
const entry = vfs.files.get(record.path);
const data = entry.data;
// An access query must not read even resident data, nor ask a lazy provider.
Object.defineProperty(entry, 'data', { configurable: true, get() { throw Error('query read data'); } });
assert.strictEqual(worker.fs_crt_descriptor_query(fd), 15);
Object.defineProperty(entry, 'data', { configurable: true, writable: true, value: data });
assert.strictEqual(record.pos, 2);
assert.strictEqual(vfs.handles.size, count);
const dup = worker.fs_duplicate_handle(fd, 0, 0, 2);
assert.strictEqual(main.fs_crt_descriptor_query(dup), 15);
const restricted = worker.fs_duplicate_handle(fd, 0x80000000, 0, 0);
assert.strictEqual(main.fs_crt_descriptor_query(restricted), 11, 'query uses granted duplicate rights');
assert.strictEqual(worker.fs_duplicate_handle(restricted, 0xc0000000, 0, 0), -5);
assert.strictEqual(vfs.writeFile(restricted, new Uint8Array(0), 0).error, 5);
vfs.closeHandle(restricted);
const buf = new Uint8Array(2);
assert.strictEqual(vfs.readFile(dup, buf, 2).bytesRead, 2);
assert.strictEqual(Buffer.from(buf).toString(), 'cd');
assert.strictEqual(record.pos, 4, 'duplicated descriptor shares cursor');
assert.strictEqual(vfs.writeFile(fd, Buffer.from('XY'), 2).bytesWritten, 2);
assert.strictEqual(Buffer.from(entry.data).toString(), 'abcdXY');
assert.strictEqual(worker.fs_close_handle(fd), 1);
assert.strictEqual(main.fs_crt_descriptor_query(fd), 0);
assert.strictEqual(vfs.readFile(fd, buf, 0).error, 6);
assert.strictEqual(vfs.writeFile(fd, buf, 0).error, 6);
assert.strictEqual(vfs.setFilePointer(fd, 0, 0), 0xffffffff);
assert.strictEqual(worker.fs_duplicate_handle(fd, 0, 0, 2), -6);
assert.strictEqual(worker.fs_close_handle(fd), 0);
assert.strictEqual(main.fs_crt_descriptor_query(dup), 15, 'duplicate lifetime survives');

for (const [flags, expected] of [[0x8000, 11], [0x8001, 13], [0x4000, 19], [0, 35]]) {
  const h = main.fs_crt_open(64, flags);
  assert.strictEqual(worker.fs_crt_descriptor_query(h), expected);
  const pos = vfs.getOpenFile(h).pos;
  if (!(flags & 1)) assert.strictEqual(vfs.writeFile(h, buf, 0).error, 5);
  else assert.strictEqual(vfs.readFile(h, buf, 0).error, 5);
  assert.strictEqual(vfs.getOpenFile(h).pos, pos, 'access failure preserves cursor');
  vfs.closeHandle(h);
}
const append = worker.fs_crt_open(64, 0x800a);
const appendDup = main.fs_duplicate_handle(append, 0, 0, 2);
assert.strictEqual(main.fs_crt_descriptor_query(appendDup), 79);
for (const h of [append, appendDup]) {
  vfs.setFilePointer(h, 1, 0);
  assert.strictEqual(vfs.writeFile(h, Buffer.from('!'), 1).bytesWritten, 1);
}
assert.strictEqual(Buffer.from(entry.data).toString(), 'abcdXY!!', 'append at each write after seek');
const before = vfs.handles.size;
for (const flags of [0x8203, 0xc202]) assert.strictEqual(main.fs_crt_open(64, flags), 0xffffffff);
assert.strictEqual(vfs.handles.size, before, 'invalid flags reserve no handle');
assert.strictEqual(Buffer.from(entry.data).toString(), 'abcdXY!!', 'invalid flags cannot truncate');
let providerReads = 0;
const adopted = main.fs_crt_open(64, 0x8002);
vfs.setFilePointer(adopted, 3, 0);
assert.strictEqual(worker.fs_crt_descriptor_adopt(adopted, 6, 0, 0x1234), 0);
assert.strictEqual(vfs.getOpenFile(adopted).pos, 3);
assert.strictEqual(main.fs_crt_descriptor_adopt(adopted, 6, 0, 0x5678), 22);
const adoptedDup = main.fs_duplicate_handle(adopted, 0, 0, 2);
assert.strictEqual(vfs.getOpenFile(adoptedDup).crtStreamOwner, undefined);
assert.strictEqual(worker.fs_crt_descriptor_adopt(adoptedDup, 6, 0, 0x5678), 0);
vfs.closeHandle(adopted);
assert.strictEqual(main.fs_crt_descriptor_adopt(adopted, 6, 0, 0x9999), 9);
assert.strictEqual(vfs.getOpenFile(adoptedDup).pos, 3);
vfs.closeHandle(adoptedDup);
for (const [flags, rights, appendMode, error] of [
  [0x8000, 4, 0, 13], [0x8001, 2, 0, 13], [0x8002, 6, 1, -1],
  [0x4002, 6, 0, -1], [2, 6, 0, -1],
]) {
  const d = main.fs_crt_open(64, flags);
  assert.strictEqual(worker.fs_crt_descriptor_adopt(d, rights, appendMode, 0x1234), error);
  assert.strictEqual(vfs.getOpenFile(d).crtStreamOwner, undefined);
  assert.strictEqual(vfs.getOpenFile(d).pos, 0);
  vfs.closeHandle(d);
}
assert.strictEqual(Buffer.from(entry.data).toString(), 'abcdXY!!', 'adoption never truncates');
const provider = { size: 73,
  readRangeSync() { providerReads++; throw Error('query materialized lazy file'); },
  readRange() { providerReads++; throw Error('query materialized lazy file'); },
};
vfs.setProviderFile('c:\\descriptor.dat', { provider });
const lazy = worker.fs_crt_open(64, 0x8000);
assert.strictEqual(main.fs_crt_descriptor_query(lazy), 11);
assert.strictEqual(vfs.getOpenFile(lazy).pos, 0);
const lazyDup = main.fs_duplicate_handle(lazy, 0, 0, 2);
assert.strictEqual(worker.fs_crt_descriptor_query(lazyDup), 11);
assert.strictEqual(providerReads, 0, 'open/dup/query never materialize provider data');
vfs.closeHandle(lazy);
vfs.closeHandle(lazyDup);
// Broker metadata is generated from WAT imports; non-void calls use the
// generic synchronous main-host RPC, not a Worker-local VFS approximation.
assert.deepStrictEqual(sigs.fs_crt_open, { params: ['i32', 'i32'], results: ['i32'] });
assert.deepStrictEqual(sigs.fs_crt_descriptor_query, { params: ['i32'], results: ['i32'] });
assert.deepStrictEqual(sigs.fs_crt_descriptor_adopt, { params: ['i32', 'i32', 'i32', 'i32'], results: ['i32'] });
console.log('CRT descriptor metadata: PASS');

