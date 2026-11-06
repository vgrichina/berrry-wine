'use strict';
// Host-import regression only; compiled guest durability is tested separately.
const assert = require('node:assert/strict');
const {VirtualFS, createFilesystemImports} = require('../lib/filesystem');
const {attach} = require('../lib/vfs-overlay');
const {memoryStore} = require('../lib/overlay-store');
const rows = [];
for (const traced of [false, true]) {
  const reads = [], logs = [], vfs = new VirtualFS(), memory = new ArrayBuffer(65536);
  vfs.setProviderFile('c:\\probe.dat', {provider: {size: 1048576,
    async readRange(off, len) { reads.push({off, len}); return new Uint8Array(len); },
  }});
  const overlay = attach(vfs, {store: memoryStore()});
  const h = vfs.createFile('c:\\probe.dat', 0x40000000, 3);
  const bytes = new Uint8Array(memory), dv = new DataView(memory);
  bytes.set([11, 22, 33, 44], 1024); bytes.fill(0xa5, 2047, 2053);
  const host = createFilesystemImports({vfs, getMemory: () => memory,
    trace: new Set(traced ? ['fs'] : [])});
  const log = console.log;
  try {
    console.log = line => logs.push(line);
    assert.equal(host.fs_write_file_result(h, 1024, 4, 2048), 0);
  } finally { console.log = log; }
  assert.equal(dv.getUint32(2048, true), 4);
  assert.equal(bytes[2047], 0xa5); assert.equal(bytes[2052], 0xa5);
  assert.deepEqual(reads, [], 'tracing must not fetch untouched nonresident bytes');
  assert.equal(vfs.files.get('c:\\probe.dat')._size, 1048576);
  if (traced) assert.match(logs[0], /wrote=0x4.*size=0x100000/);
  rows.push({written: dv.getUint32(2048, true), position: vfs.handles.get(h).pos,
    dirty: overlay.dirtyPaths(), reads});
}
assert.deepEqual(rows[1], rows[0], 'trace on/off have identical write semantics');
console.log('PASS host-only lazy WriteFile tracing parity: ' + JSON.stringify(rows));
